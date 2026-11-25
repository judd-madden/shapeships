import { getAccountStore, type AccountStore } from '../account/accountStore';
import { createAccountStreakApi } from '../account/accountApi';
import { isAccountAuthorityError } from '../account/preferenceSync';
import type { AccountResult, AccountStreakApi, AccountStreakSnapshot, GuestStreakCandidate } from '../account/types';
import { getWinStreakProfileStore, type WinStreakProfileStore } from './profile';
import { ACCOUNT_STREAK_ACTION_FAILED, ACCOUNT_STREAK_UNAVAILABLE, type WinStreakProfile } from './types';
import { isStreakOutage, streakErrorMessage } from './accountWorkflow';

export interface CapturedGuestStreak extends GuestStreakCandidate { readonly generation: number }
export function deriveGuestStreakCandidate(profile: WinStreakProfile): CapturedGuestStreak | null {
  const tracked = profile.trackedGame;
  const resultPending = tracked?.status === 'unfinished' && tracked.resultEligible;
  if (!tracked || tracked.status === 'restart_pending' || (profile.currentCount <= 0 && !resultPending)) return null;
  return { currentCount: profile.currentCount, anchorGameId: tracked.gameId,
    humanPlayerId: tracked.humanPlayerId, resultPending: Boolean(resultPending), generation: profile.generation };
}
export interface AccountStreakRuntimeSnapshot {
  readonly mode: 'guest' | 'account';
  readonly accountId: string | null;
  readonly streak: AccountStreakSnapshot | null;
  readonly candidate: CapturedGuestStreak | null;
  readonly entryBusy: boolean;
  readonly busy: boolean;
  readonly pending: boolean;
  readonly error: string | null;
}

export function createAccountWinStreakRuntime({ accounts, guest, api, onAuthorityError = async () => {} }: {
  accounts: Pick<AccountStore, 'getSnapshot' | 'subscribe'>;
  guest: WinStreakProfileStore;
  api: AccountStreakApi;
  onAuthorityError?(code: string): Promise<void>;
}) {
  let epoch = 0, disposed = false;
  let linkedSessionId: string | null = null;
  let entry: Promise<void> | null = null;
  let snapshot: AccountStreakRuntimeSnapshot = Object.freeze({ mode: 'guest', accountId: null,
    streak: null, candidate: null, entryBusy: false, busy: false, pending: false, error: null });
  const listeners = new Set<() => void>();
  const terminals = new Map<string, Promise<void>>();
  function publish(patch: Partial<AccountStreakRuntimeSnapshot>) {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach(listener => listener());
  }
  function capture() {
    const captured = epoch, accountId = snapshot.accountId;
    return () => !disposed && epoch === captured && snapshot.mode === 'account'
      && accounts.getSnapshot().status === 'signedIn' && snapshot.accountId === accountId;
  }
  function adopt(streak: AccountStreakSnapshot, isCurrent = capture()): boolean {
    if (!isCurrent() || streak.accountId.toLowerCase() !== snapshot.accountId?.toLowerCase()
      || (snapshot.streak && BigInt(streak.revision) < BigInt(snapshot.streak.revision))) return false;
    publish({ streak, error: null });
    return true;
  }
  async function failure(result: Exclude<AccountResult<unknown>, { kind: 'ok' }>, isCurrent: () => boolean): Promise<never> {
    if (isCurrent() && result.kind === 'error' && result.streak) adopt(result.streak, isCurrent);
    if (isCurrent() && result.kind === 'error' && (isAccountAuthorityError(result.code) || result.code === 'GAME_SESSION_INVALID')) {
      await onAuthorityError(result.code);
    }
    const message = streakErrorMessage(result.kind === 'error' ? result.code : undefined);
    if (isCurrent()) publish({ error: message });
    throw new Error(message);
  }
  async function safe<T>(operation: () => Promise<AccountResult<T>>): Promise<AccountResult<T>> {
    try { return await operation(); } catch { return { kind: 'unavailable' }; }
  }
  async function refresh(): Promise<AccountStreakSnapshot> {
    const isCurrent = capture();
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    const result = await safe(() => api.state());
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    if (result.kind !== 'ok') return failure(result, isCurrent);
    if (result.data.streak.accountId.toLowerCase() !== snapshot.accountId?.toLowerCase()) {
      publish({ error: ACCOUNT_STREAK_UNAVAILABLE });
      throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    }
    adopt(result.data.streak, isCurrent);
    return snapshot.streak!;
  }
  async function consumeSource(candidate: CapturedGuestStreak, isCurrent: () => boolean) {
    if (!isCurrent() || await guest.consumeForAccount(candidate, isCurrent)) return;
    // A sibling may have settled this same anchor during import. A fresh locked
    // generation fence can retire it without another server comparison.
    const latest = await guest.inspect(deriveGuestStreakCandidate);
    if (latest?.anchorGameId === candidate.anchorGameId && latest.humanPlayerId === candidate.humanPlayerId) {
      await guest.consumeForAccount(latest, isCurrent);
    }
  }
  async function resolveCandidate(decision: 'compare' | 'decline', isCurrent: () => boolean): Promise<void> {
    const candidate = snapshot.candidate;
    if (!candidate || !isCurrent()) return;
    let latest = snapshot.streak;
    if (!latest || snapshot.error) latest = await refresh();
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!isCurrent()) return;
      const { generation: _generation, ...offered } = candidate;
      const result = await safe(() => api.import({ expectedRevision: latest!.revision, decision, guest: offered }));
      if (!isCurrent()) return;
      if (result.kind === 'ok') {
        if (result.data.import.anchorGameId !== candidate.anchorGameId
          || result.data.streak.accountId.toLowerCase() !== snapshot.accountId?.toLowerCase()) {
          throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
        }
        adopt(result.data.streak, isCurrent);
        await consumeSource(candidate, isCurrent);
        if (isCurrent()) publish({ candidate: null, pending: false, error: null });
        return;
      }
      const authorityError = result.kind === 'error' && (isAccountAuthorityError(result.code)
        || ['GAME_SESSION_INVALID', 'SESSION_LINK_CONFLICT', 'STREAK_SEAT_FORBIDDEN'].includes(result.code));
      if (attempt === 0 && result.kind === 'error' && result.code === 'STREAK_CONFLICT') {
        latest = await refresh();
        continue;
      }
      const declineResolved = decision === 'decline' && result.kind === 'error' && !authorityError
        && !isStreakOutage(result.code);
      if (result.kind === 'error' && (result.code === 'STREAK_IMPORT_CONSUMED' || declineResolved)) {
        await consumeSource(candidate, isCurrent);
        if (!isCurrent()) return;
        publish({ candidate: null, pending: false, error: null });
        await refresh();
        return;
      }
      if (result.kind === 'error' && ['STREAK_IMPORT_UNVERIFIED', 'STREAK_GAME_NOT_FOUND'].includes(result.code)) {
        publish({ pending: true, error: null });
        return;
      }
      if (result.kind === 'error' && result.code === 'STREAK_CONFLICT') await refresh().catch(() => undefined);
      return failure(result, isCurrent);
    }
  }
  async function initialize(isCurrent: () => boolean) {
    try {
      const candidate = await guest.inspect(deriveGuestStreakCandidate);
      if (!isCurrent()) return;
      publish({ candidate });
      await refresh();
      if (isCurrent() && candidate) await resolveCandidate('compare', isCurrent);
    } catch {
      if (isCurrent()) publish({ pending: snapshot.candidate !== null, error: snapshot.error ?? ACCOUNT_STREAK_ACTION_FAILED });
    } finally {
      if (isCurrent()) publish({ entryBusy: false });
    }
  }
  function syncAccount() {
    if (disposed) return;
    const account = accounts.getSnapshot();
    const accountId = account.status === 'signedIn' ? account.identity.id : null;
    const nextSessionId = account.status === 'signedIn' ? account.linkedSessionId : null;
    if (accountId === snapshot.accountId && nextSessionId === linkedSessionId
      && (accountId !== null || snapshot.mode === 'guest')) return;
    linkedSessionId = nextSessionId;
    epoch++;
    guest.fenceGuestWork();
    terminals.clear();
    entry = null;
    publish({ mode: accountId ? 'account' : 'guest', accountId,
      streak: null, candidate: null, pending: false, busy: false, entryBusy: Boolean(accountId), error: null });
    if (accountId) entry = initialize(capture());
  }
  async function ready(): Promise<AccountStreakSnapshot> {
    const isCurrent = capture();
    await entry;
    if (!isCurrent() || snapshot.pending || snapshot.candidate) throw new Error(snapshot.error ?? ACCOUNT_STREAK_ACTION_FAILED);
    if (!snapshot.streak || snapshot.error) await refresh();
    if (!isCurrent() || !snapshot.streak) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    return snapshot.streak;
  }
  async function runAction<T>(operation: (isCurrent: () => boolean) => Promise<T>): Promise<T> {
    const isCurrent = capture();
    if (!isCurrent() || snapshot.busy) throw new Error(ACCOUNT_STREAK_ACTION_FAILED);
    publish({ busy: true });
    try { return await operation(isCurrent); }
    finally { if (isCurrent()) publish({ busy: false }); }
  }
  const unsubscribe = accounts.subscribe(syncAccount);
  syncAccount();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    capture, adopt, refresh, ready, runAction,    async menuEntry(): Promise<AccountStreakSnapshot> { await entry; return refresh(); },
    async retryImport(decision: 'compare' | 'decline'): Promise<void> {
      if (snapshot.mode !== 'account' || snapshot.busy) return;
      await runAction(async isCurrent => {
        await entry;
        if (!isCurrent()) return;
        try {
          await resolveCandidate(decision, isCurrent);
          if (isCurrent()) await refresh();
        } catch (error) {
          if (isCurrent()) publish({ pending: snapshot.candidate !== null,
            error: error instanceof Error ? error.message : ACCOUNT_STREAK_ACTION_FAILED });
        }
      });
    },
    async reset(): Promise<void> {
      await runAction(async isCurrent => {
        const latest = await ready();
        const result = await safe(() => api.reset(latest.revision));
        if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
        if (result.kind !== 'ok') {
          if (result.kind === 'error' && result.code === 'STREAK_CONFLICT') await refresh().catch(() => undefined);
          return failure(result, isCurrent);
        }
        if (!adopt(result.data.streak, isCurrent)) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
        await refresh();
      });
    },
    observeTerminal(gameId: string): Promise<void> {
      if (snapshot.mode !== 'account') return Promise.resolve();
      const existing = terminals.get(gameId);
      if (existing) return existing;
      const isCurrent = capture();
      const pending = (async () => {
        await entry;
        if (isCurrent()) await refresh();
      })();
      terminals.set(gameId, pending);
      return pending;
    },
    async reconcileTerminal(gameId: string): Promise<void> {
      try {
        if (!terminals.has(gameId)) await this.observeTerminal(gameId);
        else await terminals.get(gameId);
      } catch {
        await refresh();
        terminals.set(gameId, Promise.resolve());
      }
    },
    dispose() { disposed = true; epoch++; unsubscribe(); listeners.clear(); terminals.clear(); },
  };
}
export type AccountWinStreakRuntime = ReturnType<typeof createAccountWinStreakRuntime>;
let singleton: AccountWinStreakRuntime | undefined;
export function getAccountWinStreakRuntime(): AccountWinStreakRuntime {
  if (!singleton) {
    const accounts = getAccountStore();
    singleton = createAccountWinStreakRuntime({ accounts, guest: getWinStreakProfileStore(),
      api: createAccountStreakApi(async (...args) => {
        const { authenticatedFetch } = await import('../../../utils/sessionManager');
        return authenticatedFetch(...args);
      }),
      onAuthorityError: async (code) => {
        const { getSessionToken } = await import('../../../utils/sessionManager');
        const token = getSessionToken();
        if (accounts.getSnapshot().status !== 'signedIn') return;
        await accounts.resume(token ?? undefined);
        if (code === 'GAME_SESSION_INVALID' && accounts.getSnapshot().status === 'signedIn') {
          accounts.suspendForSessionFailure(code);
        }
      },
    });
  }
  return singleton;
}
