import { getAccountStore, type AccountStore } from '../../account/accountStore';
import { createAccountMissionApi } from '../../account/accountApi';
import { isAccountAuthorityError } from '../../account/preferenceSync';
import type { AccountMissionApi, AccountMissionProgress, AccountResult } from '../../account/types';
import { gameFunctionBaseUrl } from '../../../../utils/supabase/runtimeConfig';
import { publicAnonKey } from '../../../../utils/supabase/info';
import {
  clearMissionProgress, migrateMissionProgressStorage, readCompletedMissionIds,
  readCompletedMissionFindingIds, recordCompletedMissionId, recordCompletedMissionFindingIds,
  removeSyncedMissionProgress, MISSIONS_COMPLETED_STORAGE_KEY,
  MISSION_FINDINGS_COMPLETED_STORAGE_KEY, LORE_UNREAD_STORAGE_KEY, type StorageLike,
} from './missionChallengeSession';

export interface MissionProgressSnapshot {
  readonly mode: 'guest' | 'account';
  readonly accountId: string | null;
  readonly account: AccountMissionProgress | null;
  readonly loadFailed: boolean;
  readonly resetBusy: boolean;
  readonly resetError: string | null;
}

const emptyProgress: AccountMissionProgress = Object.freeze({ missions: Object.freeze([]), findings: Object.freeze([]) });
const guestSnapshot: MissionProgressSnapshot = Object.freeze({
  mode: 'guest', accountId: null, account: null, loadFailed: false, resetBusy: false, resetError: null,
});
const resetError = "Couldn't reset Mission Findings. Please try again.";

/** IDs are ASCII, so serialized string length is also the request's UTF-8 byte count. */
function* batches(progress: AccountMissionProgress): Generator<AccountMissionProgress> {
  let missionOffset = 0, findingOffset = 0;
  while (missionOffset < progress.missions.length || findingOffset < progress.findings.length) {
    const missions = progress.missions.slice(missionOffset, missionOffset + 100);
    const findings = progress.findings.slice(findingOffset, findingOffset + 100);
    while (JSON.stringify({ missions, findings }).length > 16384) {
      if (findings.length) findings.pop();
      else missions.pop();
    }
    missionOffset += missions.length;
    findingOffset += findings.length;
    yield { missions, findings };
  }
}

export function createMissionProgressRuntime({ accounts, storage, sessionStorage, api,
  onAuthorityError = async () => {}, eventTarget = null }: {
  accounts: Pick<AccountStore, 'getSnapshot' | 'subscribe' | 'getAccountToken'>;
  storage: StorageLike | null;
  sessionStorage: StorageLike | null;
  api: AccountMissionApi;
  onAuthorityError?(code: string): Promise<void>;
  eventTarget?: EventTarget | null;
}) {
  migrateMissionProgressStorage(storage, sessionStorage);
  let snapshot = guestSnapshot;
  let epoch = 0, disposed = false, queued = false;
  let syncWork: Promise<void> | null = null;
  let resetWork: Promise<void> | null = null;
  let recovery: Promise<void> | null = null;
  let recoveryAccountId: string | null = null;
  let recoveryAttempted = false, authorityStopped = false;
  const listeners = new Set<() => void>();

  function publish(patch: Partial<MissionProgressSnapshot> = {}) {
    if (disposed) return;
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach(listener => listener());
  }
  function browserProgress(): AccountMissionProgress {
    return { missions: readCompletedMissionIds(storage), findings: readCompletedMissionFindingIds(storage) };
  }
  function getDisplayedProgress(): AccountMissionProgress {
    const browser = browserProgress();
    return {
      missions: [...new Set([...(snapshot.account?.missions ?? []), ...browser.missions])],
      findings: [...new Set([...(snapshot.account?.findings ?? []), ...browser.findings])],
    };
  }
  function capture() {
    const captured = epoch;
    return () => !disposed && captured === epoch && snapshot.mode === 'account'
      && accounts.getSnapshot().status === 'signedIn';
  }
  async function safe<T>(operation: () => Promise<AccountResult<T>>): Promise<AccountResult<T>> {
    try { return await operation(); } catch { return { kind: 'unavailable' }; }
  }
  async function recover(result: AccountResult<unknown>, isCurrent: () => boolean) {
    if (!isCurrent() || result.kind !== 'error' || !isAccountAuthorityError(result.code)) return;
    if (recoveryAttempted) {
      authorityStopped = true;
      queued = false;
      return;
    }
    recoveryAttempted = true;
    const accountId = snapshot.accountId;
    const pending = Promise.resolve().then(async () => {
      if (isCurrent()) await onAuthorityError(result.code);
    }).catch(() => { /* Authority recovery is best effort and never escapes into gameplay. */ });
    recovery = pending;
    await pending;
    if (recovery === pending) recovery = null;
    // Keep the guard across resume's guest -> signedIn epoch change.
    if (!disposed && snapshot.mode === 'account' && snapshot.accountId === accountId && !authorityStopped) queued = true;
  }
  async function syncPass() {
    const isCurrent = capture(), token = accounts.getAccountToken();
    if (!isCurrent() || !token) return;
    const browser = browserProgress();
    const additions = browser.missions.length > 0 || browser.findings.length > 0;
    const requests = additions ? batches(browser) : [null];
    for (const sent of requests) {
      if (!isCurrent() || snapshot.resetBusy) return;
      const result = await safe(() => sent ? api.add(token, sent) : api.state(token));
      // A successful move belongs to the captured account even after logout/switch.
      if (result.kind === 'ok' && sent) removeSyncedMissionProgress(sent, storage);
      if (!isCurrent()) {
        if (result.kind === 'ok' && sent) publish();
        return;
      }
      if (result.kind !== 'ok') {
        publish({ loadFailed: snapshot.account === null });
        await recover(result, isCurrent);
        return;
      }
      publish({ account: Object.freeze({
        missions: Object.freeze([...result.data.missionProgress.missions]),
        findings: Object.freeze([...result.data.missionProgress.findings]),
      }), loadFailed: false });
    }
  }
  function enqueue(): Promise<void> {
    if (disposed || snapshot.mode !== 'account' || authorityStopped) return Promise.resolve();
    queued = true;
    if (!syncWork && !resetWork && !snapshot.resetBusy) {
      const work = Promise.resolve().then(async () => {
        while (queued && !disposed && snapshot.mode === 'account' && !snapshot.resetBusy && !authorityStopped) {
          queued = false;
          await syncPass();
        }
      }).finally(() => {
        if (syncWork === work) syncWork = null;
        if (queued && !resetWork && !snapshot.resetBusy && !authorityStopped) void enqueue();
      });
      syncWork = work;
    }
    return syncWork ?? Promise.resolve();
  }
  /** Explicit unlock/Lore/online triggers grant a new, bounded recovery attempt. */
  function sync(): Promise<void> {
    authorityStopped = false;
    if (!recovery) recoveryAttempted = false;
    return enqueue();
  }
  function syncAccount() {
    if (disposed) return;
    const account = accounts.getSnapshot();
    const accountId = account.status === 'signedIn' ? account.identity.id : null;
    if (accountId === snapshot.accountId) return;
    epoch++;
    queued = false;
    // A different authority must not reuse the previous account's reset promise.
    resetWork = null;
    if (accountId !== recoveryAccountId && (accountId !== null || !recovery)) {
      recoveryAccountId = accountId;
      recoveryAttempted = false;
      authorityStopped = false;
    }
    publish({ ...guestSnapshot, mode: accountId ? 'account' : 'guest', accountId });
    if (accountId) void enqueue();
  }
  function onStorage(event: Event) {
    const { key, storageArea } = event as Event & { key?: string | null; storageArea?: StorageLike | null };
    if (!storage || storageArea !== storage || (key !== null && key !== MISSIONS_COMPLETED_STORAGE_KEY
      && key !== MISSION_FINDINGS_COMPLETED_STORAGE_KEY && key !== LORE_UNREAD_STORAGE_KEY)) return;
    publish();
    if (key === LORE_UNREAD_STORAGE_KEY || snapshot.mode !== 'account') return;
    const browser = browserProgress();
    if (browser.missions.some(id => !snapshot.account?.missions.includes(id))
      || browser.findings.some(id => !snapshot.account?.findings.includes(id))) void enqueue();
  }
  const onOnline = () => { void sync(); };
  const unsubscribe = accounts.subscribe(syncAccount);
  eventTarget?.addEventListener('storage', onStorage);
  eventTarget?.addEventListener('online', onOnline);
  syncAccount();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getDisplayedProgress,
    getCompletedMissionIds: () => [...getDisplayedProgress().missions],
    recordMissionResult({ missionId, findingIds }: { missionId: string | null; findingIds: readonly string[] }) {
      if (disposed) return { didUnlockMissionFinding: false };
      const displayed = getDisplayedProgress();
      if (missionId) recordCompletedMissionId(missionId, storage);
      const { didUnlockMissionFinding } = recordCompletedMissionFindingIds(findingIds, storage, new Set(displayed.findings));
      publish();
      if (snapshot.mode === 'account') void sync();
      return { didUnlockMissionFinding };
    },
    sync,
    reset(): void | Promise<void> {
      if (disposed) return;
      if (snapshot.mode === 'guest') {
        clearMissionProgress(storage);
        publish({ resetError: null });
        return;
      }
      if (resetWork) return resetWork;
      const isCurrent = capture();
      queued = false;
      publish({ resetBusy: true, resetError: null });
      const pending = (async () => {
        await syncWork;
        if (!isCurrent()) return;
        const token = accounts.getAccountToken();
        const result = token ? await safe(() => api.reset(token)) : { kind: 'unavailable' as const };
        if (!isCurrent()) return;
        if (result.kind === 'ok') {
          queued = false;
          clearMissionProgress(storage);
          publish({ account: emptyProgress, loadFailed: false });
        } else {
          publish({ resetError });
          await recover(result, isCurrent);
        }
      })().finally(() => {
        if (resetWork === pending) resetWork = null;
        if (isCurrent()) publish({ resetBusy: false });
        if (queued) void enqueue();
      });
      resetWork = pending;
      return pending;
    },
    dispose() {
      disposed = true;
      epoch++;
      queued = false;
      unsubscribe();
      eventTarget?.removeEventListener('storage', onStorage);
      eventTarget?.removeEventListener('online', onOnline);
      listeners.clear();
    },
  };
}

export type MissionProgressRuntime = ReturnType<typeof createMissionProgressRuntime>;
let singleton: MissionProgressRuntime | undefined;
export function getMissionProgressRuntime(): MissionProgressRuntime {
  if (!singleton) {
    const accounts = getAccountStore();
    const eventTarget = typeof window === 'undefined' ? null : window;
    let storage: StorageLike | null = null, sessionStorage: StorageLike | null = null;
    try { storage = eventTarget?.localStorage ?? null; } catch { /* Privacy mode. */ }
    try { sessionStorage = eventTarget?.sessionStorage ?? null; } catch { /* Privacy mode. */ }
    singleton = createMissionProgressRuntime({ accounts, storage, sessionStorage, eventTarget,
      api: createAccountMissionApi({ baseUrl: gameFunctionBaseUrl, anonKey: publicAnonKey, fetch: globalThis.fetch, timeoutMs: 12000 }),
      onAuthorityError: async () => {
        const captured = accounts.getSnapshot();
        if (captured.status !== 'signedIn') return;
        const { getSessionToken } = await import('../../../../utils/sessionManager');
        const current = accounts.getSnapshot();
        if (current.status === 'signedIn' && current.identity.id === captured.identity.id) {
          await accounts.resume(getSessionToken() ?? undefined);
        }
      },
    });
  }
  return singleton;
}
