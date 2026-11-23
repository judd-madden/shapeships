import { getPlayerPreferencesStore, type createPlayerPreferencesStore } from '../preferences/playerPreferences';
import { gameFunctionBaseUrl } from '../../../utils/supabase/runtimeConfig';
import { publicAnonKey } from '../../../utils/supabase/info';
import { createAccountApi } from './accountApi';
import { createPreferenceSync, isAccountAuthorityError, operationError } from './preferenceSync';
import type {
  AccountApi, AccountClock, AccountEntryBody, AccountOperationError, AccountResult,
  AccountSnapshot, AccountState, ChangePasswordRequest, ClaimRequest, PreferenceSyncStatus, SignInRequest,
} from './types';

export const ACCOUNT_TOKEN_STORAGE_KEY = 'shapeships.accountToken.v1';
const LOGOUT_RETRY_DELAYS = [1000, 3000, 10000];
const idlePreferences: PreferenceSyncStatus = Object.freeze({ saving: false, unsaved: false });
export const SIGNED_OUT_ACCOUNT_SNAPSHOT: AccountSnapshot = Object.freeze({
  status: 'signedOut', lastError: null, remoteLogoutPending: false, preferenceSync: idlePreferences,
});

export const accountClock: AccountClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

interface PendingLogout {
  token: string;
  generation: number;
  attempts: number;
  timer: unknown;
  inFlight: boolean;
  notBefore: number;
  dormant: boolean;
}

export function createAccountStore({ api, storage, eventTarget, clock, preferences }: {
  api: AccountApi;
  storage: Storage | null;
  eventTarget: EventTarget | null;
  clock: AccountClock;
  preferences: ReturnType<typeof createPlayerPreferencesStore>;
}) {
  let generation = 0;
  let authSequence = 0;
  let nameSequence = 0;
  let disposed = false;
  let token: string | null = null;
  let tokenPersistence: 'localStorage' | 'memory' = 'memory';
  let suppressStoredResume = false;
  let identityId: string | null = null;
  let state: AccountState = { status: 'signedOut' };
  let lastError: AccountOperationError | null = null;
  let preferenceSync = idlePreferences;
  let snapshot = SIGNED_OUT_ACCOUNT_SNAPSHOT;
  const listeners = new Set<() => void>();
  const remoteLogouts = new Set<PendingLogout>();

  function publish(): void {
    if (disposed) return;
    snapshot = Object.freeze({ ...state, lastError, remoteLogoutPending: remoteLogouts.size > 0, preferenceSync });
    listeners.forEach((listener) => listener());
  }
  function removeMatching(captured: string | null): void {
    if (!captured) return;
    try {
      if (storage?.getItem(ACCOUNT_TOKEN_STORAGE_KEY) === captured) storage.removeItem(ACCOUNT_TOKEN_STORAGE_KEY);
    } catch {
      // If deletion is blocked, this tab must not restore that remembered authority.
      suppressStoredResume = true;
    }
  }
  function invalidate(reason: string, error: AccountOperationError | null = null, clearStorage = true): void {
    if (clearStorage) removeMatching(token);
    generation++;
    authSequence++;
    token = null;
    identityId = null;
    state = { status: 'signedOut', reason };
    lastError = error;
    sync.stop();
  }

  const sync = createPreferenceSync({
    api, preferences, clock,
    isCurrent: (captured) => !disposed && captured === generation,
    onPreferences: (envelope) => {
      if (state.status === 'signedIn') {
        state = { ...state, preferences: envelope };
        publish();
      }
    },
    onStatus: (status) => {
      preferenceSync = status;
      publish();
    },
    onError: (error) => {
      lastError = error;
      publish();
    },
    onAuthorityError: (error) => invalidate(error.code, error),
  });

  function readToken(): string | null {
    if (token && tokenPersistence === 'memory') return token;
    if (suppressStoredResume) return null;
    try {
      const stored = storage?.getItem(ACCOUNT_TOKEN_STORAGE_KEY) ?? null;
      tokenPersistence = stored ? 'localStorage' : 'memory';
      return stored;
    } catch { return token; }
  }
  function writeToken(fresh: string): void {
    suppressStoredResume = false;
    token = fresh;
    tokenPersistence = 'memory';
    try {
      if (storage) {
        storage.setItem(ACCOUNT_TOKEN_STORAGE_KEY, fresh);
        tokenPersistence = 'localStorage';
      }
    } catch { /* The sign-in remains valid in memory, without a persistence claim. */ }
  }
  async function safe<T>(operation: () => Promise<AccountResult<T>>): Promise<AccountResult<T>> {
    try { return await operation(); } catch { return { kind: 'unavailable' }; }
  }
  async function enter(name: string, operation: () => Promise<AccountResult<AccountEntryBody>>): Promise<void> {
    if (disposed) return;
    const captured = generation, sequence = ++authSequence;
    lastError = null;
    publish();
    if (disposed || captured !== generation || sequence !== authSequence) return;
    const result = await safe(operation);
    if (disposed || captured !== generation || sequence !== authSequence) {
      if (result.kind === 'ok') void safe(() => api.logout(result.data.accountToken));
      return;
    }
    if (result.kind === 'ok') {
      const data = result.data;
      const preserve = identityId === data.account.id;
      generation++;
      writeToken(data.accountToken);
      identityId = data.account.id;
      state = {
        status: 'signedIn', identity: data.account, preferences: data.preferences, expiresAt: data.expiresAt,
        linkedSessionId: data.link.sessionId, tokenPersistence,
      };
      sync.start({ token: data.accountToken, generation }, data.preferences, preserve);
    } else {
      lastError = operationError(result);
      if (result.kind === 'error' && result.code === 'PASSWORD_CHANGE_REQUIRED') {
        removeMatching(token);
        generation++;
        token = null;
        identityId = null;
        state = { status: 'passwordChangeRequired', name };
        sync.stop();
      } else publish();
    }
  }

  function completeRemoteLogout(pending: PendingLogout): void {
    if (pending.timer !== null) clock.clearTimeout(pending.timer);
    remoteLogouts.delete(pending);
    publish();
  }
  async function revoke(pending: PendingLogout): Promise<void> {
    if (disposed || pending.inFlight || !remoteLogouts.has(pending)) return;
    if (pending.timer !== null) clock.clearTimeout(pending.timer);
    pending.timer = null;
    pending.inFlight = true;
    const result = await safe(() => api.logout(pending.token));
    if (disposed || !remoteLogouts.has(pending)) return;
    pending.inFlight = false;
    if (result.kind === 'ok' || (result.kind === 'error' && isAccountAuthorityError(result.code))) {
      if (pending.generation === generation) lastError = null;
      completeRemoteLogout(pending);
      return;
    }
    if (pending.generation === generation) lastError = operationError(result);
    pending.dormant = result.kind === 'error' && result.code === 'ACCOUNTS_NOT_ENABLED';
    pending.notBefore = clock.now() + (result.retryAfterSeconds ?? 0) * 1000;
    const transient = result.kind === 'unavailable' || (result.kind === 'error'
      && ['ACCOUNT_SERVICE_UNAVAILABLE', 'INTERNAL_ERROR', 'RATE_LIMITED', 'AUTH_BUSY', 'CAPTCHA_UNAVAILABLE'].includes(result.code));
    if (transient && pending.attempts < LOGOUT_RETRY_DELAYS.length) {
      const delay = Math.max(LOGOUT_RETRY_DELAYS[pending.attempts++], pending.notBefore - clock.now());
      pending.timer = clock.setTimeout(() => { pending.timer = null; void revoke(pending); }, delay);
    }
    publish();
  }
  function onOnline(): void {
    for (const pending of remoteLogouts) {
      if (pending.dormant || pending.inFlight) continue;
      if (pending.notBefore <= clock.now()) void revoke(pending);
      else if (pending.timer === null) {
        pending.timer = clock.setTimeout(() => { pending.timer = null; void revoke(pending); }, pending.notBefore - clock.now());
      }
    }
  }
  function onStorage(event: Event): void {
    const value = event as Event & { key?: string | null; newValue?: string | null; oldValue?: string | null; storageArea?: Storage | null };
    if (!storage || value.storageArea !== storage) return;
    if (value.key !== null && value.key !== ACCOUNT_TOKEN_STORAGE_KEY) return;
    if (suppressStoredResume && typeof value.newValue === 'string' && value.newValue) {
      try {
        if (storage.getItem(ACCOUNT_TOKEN_STORAGE_KEY) === value.newValue) suppressStoredResume = false;
      } catch { /* Keep the local logout fence while storage is inaccessible. */ }
    }
    if (!token) return;
    if (value.key !== null && value.oldValue !== undefined && value.oldValue !== token) return;
    // Read the current value so a delayed event cannot erase a newer local sign-in.
    try {
      if (storage.getItem(ACCOUNT_TOKEN_STORAGE_KEY) === token) return;
    } catch {
      if (value.key !== null && value.oldValue !== token) return;
    }
    if (value.key !== null && (value.newValue === undefined || value.newValue === token)) return;
    invalidate('LOGGED_OUT', null, false);
  }
  // Cache only the opaque credential at lazy construction, never identity or a request.
  token = readToken();
  eventTarget?.addEventListener('storage', onStorage);
  eventTarget?.addEventListener('online', onOnline);

  return {
    getSnapshot: (): AccountSnapshot => snapshot,
    hasRememberedToken: (): boolean => !disposed && Boolean(readToken()),
    // A validated account still cannot enter play if its game-session bootstrap fails.
    // Retain the credential for next visit, but expose no identity or guest account writes.
    suspendForSessionFailure(code = 'ACCOUNT_SERVICE_UNAVAILABLE'): void {
      if (disposed || state.status !== 'signedIn') return;
      generation++;
      authSequence++;
      state = { status: 'unavailable' };
      lastError = { code };
      preferenceSync = idlePreferences;
      sync.pause();
      publish();
    },
    subscribe(listener: () => void): () => void {
      if (!disposed) listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    // Bootstrap/linking only. Ordinary game requests should use the session guard below.
    getAccountToken: (): string | null => state.status === 'signedIn' ? token : null,
    getAccountTokenForSession: (sessionId: string): string | null =>
      state.status === 'signedIn' && state.linkedSessionId === sessionId ? token : null,
    async resume(sessionToken?: string): Promise<void> {
      if (disposed) return;
      const stored = readToken();
      if (!stored) {
        invalidate('ACCOUNT_TOKEN_REQUIRED');
        return;
      }
      if (stored !== token) {
        generation++;
        token = stored;
        identityId = null;
        state = { status: 'resuming' };
        sync.stop();
      }
      const captured = generation, sequence = ++authSequence;
      const current = () => !disposed && captured === generation && sequence === authSequence;
      state = { status: 'resuming' };
      lastError = null;
      sync.pause();
      publish();
      if (!current()) return;
      let result = await safe(() => api.resume(stored, sessionToken));
      if (!current()) return;
      if (sessionToken !== undefined && result.kind === 'error' && result.code === 'GAME_SESSION_INVALID') {
        result = await safe(() => api.resume(stored));
        if (!current()) return;
      }
      if (result.kind === 'ok') {
        const data = result.data;
        identityId = data.account.id;
        state = {
          status: 'signedIn', identity: data.account, preferences: data.preferences, expiresAt: data.expiresAt,
          linkedSessionId: data.link?.sessionId ?? null, tokenPersistence,
        };
        sync.start({ token: stored, generation }, data.preferences, true);
      } else if (result.kind === 'error' && isAccountAuthorityError(result.code)) {
        invalidate(result.code, operationError(result));
      } else {
        lastError = operationError(result);
        state = result.kind === 'error' && result.code === 'ACCOUNTS_NOT_ENABLED'
          ? { status: 'dormant' }
          : { status: 'unavailable', ...(result.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: result.retryAfterSeconds }) };
        publish();
      }
    },
    claim: (request: ClaimRequest, sessionToken: string): Promise<void> => enter(request.name, () => api.claim(request, sessionToken)),
    signIn: (request: SignInRequest, sessionToken: string): Promise<void> => enter(request.name, () => api.signIn(request, sessionToken)),
    changePassword: (request: ChangePasswordRequest, sessionToken: string): Promise<void> => enter(request.name, () => api.changePassword(request, sessionToken)),
    invalidateNameChecks(): void {
      nameSequence++;
    },
    async nameCheck(name: string) {
      if (disposed) return null;
      const captured = generation, sequence = ++nameSequence;
      const result = await safe(() => api.nameCheck(name));
      if (disposed || captured !== generation || sequence !== nameSequence) return null;
      lastError = result.kind === 'ok' ? null : operationError(result);
      publish();
      return result;
    },
    async logout(): Promise<void> {
      if (disposed) return;
      // A sibling's replacement token belongs to that sibling until explicit resume.
      const captured = token;
      removeMatching(captured);
      invalidate('LOGGED_OUT', null, false);
      if (!captured) return;
      const pending: PendingLogout = { token: captured, generation, attempts: 0, timer: null, inFlight: false, notBefore: 0, dormant: false };
      remoteLogouts.add(pending);
      publish();
      await revoke(pending);
    },
    retryUnsavedPreferences(): void { if (!disposed) sync.retry(); },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation++;
      token = null;
      identityId = null;
      sync.dispose();
      for (const pending of remoteLogouts) if (pending.timer !== null) clock.clearTimeout(pending.timer);
      remoteLogouts.clear();
      eventTarget?.removeEventListener('storage', onStorage);
      eventTarget?.removeEventListener('online', onOnline);
      listeners.clear();
    },
  };
}

export type AccountStore = ReturnType<typeof createAccountStore>;
let defaultStore: AccountStore | undefined;

export function getAccountStore(): AccountStore {
  if (!defaultStore) {
    const eventTarget = typeof window === 'undefined' ? null : window;
    let storage: Storage | null = null;
    try { storage = eventTarget?.localStorage ?? null; } catch { /* Privacy mode. */ }
    defaultStore = createAccountStore({
      api: createAccountApi({ baseUrl: gameFunctionBaseUrl, anonKey: publicAnonKey, fetch: globalThis.fetch, timeoutMs: 12000 }),
      storage, eventTarget, clock: accountClock, preferences: getPlayerPreferencesStore(),
    });
  }
  return defaultStore;
}
