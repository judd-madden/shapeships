import type { createPlayerPreferencesStore } from '../preferences/playerPreferences';
import type {
  AccountApi, AccountClock, AccountOperationError, AccountPreferences, AccountResult,
  PreferencePatch, PreferenceSyncStatus, PreferencesBody,
} from './types';

export const isAccountAuthorityError = (code: string): boolean => [
  'ACCOUNT_TOKEN_REQUIRED', 'ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED',
  'ACCOUNT_TOKEN_REVOKED', 'ACCOUNT_BLOCKED', 'NAME_BANNED',
].includes(code);

export function operationError(result: Exclude<AccountResult<unknown>, { kind: 'ok' }>): AccountOperationError {
  return Object.freeze({
    code: result.kind === 'error' ? result.code : 'ACCOUNT_SERVICE_UNAVAILABLE',
    ...(result.kind === 'error' && result.field !== undefined ? { field: result.field } : {}),
    ...(result.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: result.retryAfterSeconds }),
  });
}

interface SyncContext {
  token: string;
  generation: number;
}

/** Account-owned orchestration; local/guest preference setters remain unaware of accounts. */
export function createPreferenceSync({ api, preferences, clock, isCurrent, onPreferences, onStatus, onError, onAuthorityError }: {
  api: AccountApi;
  preferences: ReturnType<typeof createPlayerPreferencesStore>;
  clock: AccountClock;
  isCurrent(generation: number): boolean;
  onPreferences(envelope: AccountPreferences): void;
  onStatus(status: PreferenceSyncStatus): void;
  onError(error: AccountOperationError | null): void;
  onAuthorityError(error: AccountOperationError): void;
}) {
  let context: SyncContext | null = null;
  let epoch = 0;
  let active = false;
  let envelope: AccountPreferences | null = null;
  let pending: PreferencePatch = {};
  let versions: Partial<Record<keyof PreferencePatch, number>> = {};
  let serial = 0;
  let timer: unknown = null;
  let dueAt: number | null = null;
  let retryNotBefore = 0;
  let inFlight = false;
  let unsaved = false;

  const hasPending = () => Object.keys(pending).length > 0;
  const status = () => onStatus(Object.freeze({ saving: inFlight, unsaved }));
  const clearTimer = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };
  function apply(latest: AccountPreferences): void {
    const applyingEpoch = epoch, applyingContext = context;
    if (!applyingContext || !isCurrent(applyingContext.generation)) return;
    // Resume and PUT can finish out of order within the same account generation.
    if (!envelope || BigInt(latest.revision) >= BigInt(envelope.revision)) envelope = latest;
    const accepted = envelope;
    onPreferences(accepted);
    // A subscriber can synchronously log out while observing the new snapshot.
    if (applyingEpoch !== epoch || context !== applyingContext || !isCurrent(applyingContext.generation)) return;
    preferences.applyExternalSnapshot({ ...accepted.values, ...pending });
  }
  function schedule(): void {
    clearTimer();
    if (!active || !context || !hasPending() || dueAt === null || inFlight) return;
    timer = clock.setTimeout(() => {
      timer = null;
      void flush();
    }, Math.max(0, Math.max(dueAt, retryNotBefore) - clock.now()));
  }
  async function flush(): Promise<void> {
    if (!active || !context || !envelope || inFlight || !hasPending()) return;
    const captured = context, capturedEpoch = epoch;
    const current = () => capturedEpoch === epoch && isCurrent(captured.generation);
    const patch = { ...pending }, sentVersions = { ...versions };
    const submittedSerial = serial;
    dueAt = null;
    inFlight = true;
    status();
    if (!current()) return;
    if (!active) {
      inFlight = false;
      dueAt = clock.now();
      status();
      return;
    }
    let result: AccountResult<PreferencesBody>;
    try {
      result = await api.putPreferences(captured.token, patch, envelope.revision);
      if (!current()) return;
      if (result.kind === 'error' && result.code === 'PREFERENCE_CONFLICT' && result.preferences) {
        apply(result.preferences);
        if (!current()) return;
        // Pause can occur during resume; it must not start another signed-in request.
        if (active) {
          result = await api.putPreferences(captured.token, patch, envelope.revision);
          if (!current()) return;
        }
      }
    } catch {
      result = { kind: 'unavailable' };
    }
    if (!current()) return;
    inFlight = false;
    if (result.kind === 'ok') {
      for (const key of Object.keys(patch) as (keyof PreferencePatch)[]) {
        if (versions[key] === sentVersions[key]) {
          delete pending[key];
          delete versions[key];
        }
      }
      unsaved = false;
      retryNotBefore = 0;
      apply(result.data.preferences);
      if (!current()) return;
      onError(null);
    } else if (result.kind === 'error' && isAccountAuthorityError(result.code)) {
      onAuthorityError(operationError(result));
      return;
    } else {
      unsaved = true;
      retryNotBefore = clock.now() + (result.retryAfterSeconds ?? 0) * 1000;
      if (result.kind === 'error' && result.preferences) apply(result.preferences);
      if (!current()) return;
      onError(operationError(result));
      // A deliberate edit made during the request also counts as the next edit.
      if (serial === submittedSerial) dueAt = null;
    }
    if (!current()) return;
    if (!hasPending()) dueAt = null;
    status();
    schedule();
  }

  const unsubscribe = preferences.subscribeDeliberateChanges((patch) => {
    if (!active || !context || !isCurrent(context.generation)) return;
    pending = { ...pending, ...patch };
    for (const key of Object.keys(patch) as (keyof PreferencePatch)[]) versions[key] = ++serial;
    dueAt = clock.now() + 300;
    schedule();
  });

  return {
    start(next: SyncContext, latest: AccountPreferences, preservePending = false): void {
      const same = context?.token === next.token && context.generation === next.generation;
      if (!same) {
        epoch++;
        clearTimer();
        const wasInFlight = inFlight;
        inFlight = false;
        if (!preservePending) {
          envelope = null;
          pending = {};
          versions = {};
          dueAt = null;
          unsaved = false;
          retryNotBefore = 0;
        } else if (wasInFlight && dueAt === null) dueAt = clock.now() + 300;
      }
      context = next;
      active = true;
      apply(latest);
      status();
      schedule();
    },
    pause(): void {
      active = false;
      clearTimer();
    },
    retry(): void {
      if (!active || !hasPending()) return;
      // Incrementing also preserves an explicit retry requested during a request.
      serial++;
      dueAt = clock.now();
      schedule();
    },
    stop(): void {
      epoch++;
      active = false;
      context = null;
      envelope = null;
      pending = {};
      versions = {};
      dueAt = null;
      retryNotBefore = 0;
      inFlight = false;
      unsaved = false;
      clearTimer();
      status();
    },
    dispose(): void {
      this.stop();
      unsubscribe();
    },
  };
}
