import { afterEach, expect, test, vi } from 'vitest';
import { createMissionProgressRuntime } from '../../../gameSession/mission/missionProgressRuntime';
import {
  LORE_UNREAD_STORAGE_KEY, MISSIONS_COMPLETED_STORAGE_KEY, MISSION_FINDINGS_COMPLETED_STORAGE_KEY,
  readCompletedMissionIds, readCompletedMissionFindingIds, readLoreUnread, clearLoreUnread,
  recordCompletedMissionId, recordCompletedMissionFindingIds,
} from '../../../gameSession/mission/missionChallengeSession';
import type { AccountMissionApi, AccountMissionBody, AccountMissionProgress, AccountResult, AccountSnapshot } from '../../../account/types';
import { deferred, entry, memoryStorage } from '../../account/fixtures';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const empty = () => ({ missions: [], findings: [] });
const ok = (missionProgress: AccountMissionProgress): AccountResult<AccountMissionBody> => ({ kind: 'ok', data: { ok: true, missionProgress } });
const idle = { lastError: null, remoteLogoutPending: false, preferenceSync: { saving: false, unsaved: false } };
const signedOut: AccountSnapshot = { status: 'signedOut', ...idle };
function signedIn(id = firstId): AccountSnapshot {
  const data = entry(undefined, id);
  return { status: 'signedIn', identity: data.account, preferences: data.preferences,
    expiresAt: data.expiresAt, linkedSessionId: null, tokenPersistence: 'memory', ...idle };
}
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
const disposals: (() => void)[] = [];
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

function harness(initial: AccountMissionProgress = empty()) {
  let account: AccountSnapshot = signedOut;
  let latest: AccountMissionProgress = initial;
  const listeners = new Set<() => void>();
  const accounts = { getSnapshot: () => account,
    getAccountToken: () => account.status === 'signedIn' ? 'token-' + account.identity.id : null,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    set(next: AccountSnapshot) { account = next; listeners.forEach(fn => fn()); },
  };
  const { storage } = memoryStorage();
  const session = memoryStorage().storage;
  const events = new EventTarget();
  const api = {
    state: vi.fn<AccountMissionApi['state']>(async () => ok(latest)),
    add: vi.fn<AccountMissionApi['add']>(async (_token, progress) => {
      latest = { missions: [...new Set([...latest.missions, ...progress.missions])],
        findings: [...new Set([...latest.findings, ...progress.findings])] };
      return ok(latest);
    }),
    reset: vi.fn<AccountMissionApi['reset']>(async () => { latest = empty(); return ok(latest); }),
  };
  const onAuthorityError = vi.fn<(code: string) => Promise<void>>(async () => {});
  const runtime = createMissionProgressRuntime({ accounts, storage, sessionStorage: session, api, onAuthorityError, eventTarget: events });
  disposals.push(runtime.dispose);
  return { accounts, storage, session, events, api, runtime, onAuthorityError,
    setLatest(value: AccountMissionProgress) { latest = value; },
    async signIn(id = firstId) { accounts.set(signedIn(id)); await settle(); },
    storageEvent(key: string | null, storageArea: Storage | null = storage) {
      events.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea }));
    },
  };
}

test.each(['signedOut', 'resuming', 'dormant', 'unavailable', 'passwordChangeRequired'] as const)(
  'guest status %s makes zero API calls on record, sync, events and reset', async status => {
    const h = harness();
    h.accounts.set({ status, ...idle, ...(status === 'passwordChangeRequired' ? { name: 'Pilot1' } : {}) } as AccountSnapshot);
    h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
    expect(h.runtime.getCompletedMissionIds()).toEqual(['mission-a']);
    await h.runtime.sync();
    h.events.dispatchEvent(new Event('online'));
    h.storageEvent(MISSIONS_COMPLETED_STORAGE_KEY);
    expect(h.runtime.reset()).toBeUndefined();
    await settle();
    expect(h.runtime.getSnapshot().mode).toBe('guest');
    expect(h.api.state).not.toHaveBeenCalled();
    expect(h.api.add).not.toHaveBeenCalled();
    expect(h.api.reset).not.toHaveBeenCalled();
  },
);

test('account entry moves exactly browser progress and caches account-first ordered union', async () => {
  const h = harness({ missions: ['mission-account'], findings: ['sol-1'] });
  h.runtime.recordMissionResult({ missionId: 'mission-browser', findingIds: ['groombridge'] });
  await h.signIn();
  expect(h.api.add).toHaveBeenCalledExactlyOnceWith('token-' + firstId, { missions: ['mission-browser'], findings: ['groombridge'] });
  expect(h.api.state).not.toHaveBeenCalled();
  expect(h.runtime.getDisplayedProgress()).toEqual({ missions: ['mission-account', 'mission-browser'], findings: ['sol-1', 'groombridge'] });
  expect(readCompletedMissionIds(h.storage)).toEqual([]);
  expect(readCompletedMissionFindingIds(h.storage)).toEqual([]);
  h.accounts.set(signedOut);
  expect(h.runtime.getSnapshot().account).toBeNull();
  expect(h.runtime.getDisplayedProgress()).toEqual(empty());
});

test('empty browser account entry fetches state and a new account drops the previous cache', async () => {
  const h = harness({ missions: ['mission-a'], findings: ['groombridge'] });
  await h.signIn();
  expect(h.api.state).toHaveBeenCalledExactlyOnceWith('token-' + firstId);
  expect(h.api.add).not.toHaveBeenCalled();
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.state.mockReturnValueOnce(pending.promise);
  h.accounts.set(signedIn(secondId));
  expect(h.runtime.getSnapshot()).toMatchObject({ mode: 'account', accountId: secondId, account: null });
  pending.resolve(ok(empty()));
  await settle();
  expect(h.runtime.getCompletedMissionIds()).toEqual([]);
});

test('recording writes before upload and coalesces many triggers into one queued pass', async () => {
  const h = harness();
  await h.signIn();
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.add.mockImplementationOnce(async (_token, progress) => {
    expect(readCompletedMissionIds(h.storage)).toEqual(progress.missions);
    expect(readCompletedMissionFindingIds(h.storage)).toEqual(progress.findings);
    return pending.promise;
  });
  h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
  await settle();
  const queued = [h.runtime.sync(), h.runtime.sync(), h.runtime.sync()];
  h.runtime.recordMissionResult({ missionId: 'mission-b', findingIds: ['sol-1'] });
  expect(h.api.add).toHaveBeenCalledTimes(1);
  pending.resolve(ok({ missions: ['mission-a'], findings: ['groombridge'] }));
  await Promise.all(queued);
  expect(h.api.add).toHaveBeenCalledTimes(2);
  expect(h.api.add.mock.calls[1][1]).toEqual({ missions: ['mission-b'], findings: ['sol-1'] });
  expect(readCompletedMissionIds(h.storage)).toEqual([]);
});

test('failure retains browser progress, only marks loadFailed without a cache and retries on next trigger', async () => {
  const h = harness();
  h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
  h.api.add.mockResolvedValueOnce({ kind: 'unavailable' });
  await h.signIn();
  expect(h.runtime.getSnapshot().loadFailed).toBe(true);
  expect(readCompletedMissionIds(h.storage)).toEqual(['mission-a']);
  await h.runtime.sync();
  expect(h.runtime.getSnapshot().loadFailed).toBe(false);
  const cache = h.runtime.getSnapshot().account;
  h.api.state.mockResolvedValueOnce({ kind: 'unavailable' });
  await h.runtime.sync();
  expect(h.runtime.getSnapshot().account).toBe(cache);
  expect(h.runtime.getSnapshot().loadFailed).toBe(false);
});

test.each(['logout', 'switch'] as const)('late successful upload after %s cleans sent IDs without adopting old state', async transition => {
  const h = harness();
  h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.add.mockReturnValueOnce(pending.promise);
  h.accounts.set(signedIn());
  await settle();
  h.accounts.set(transition === 'logout' ? signedOut : signedIn(secondId));
  // This arrived while the old account's add was pending, and must survive cleanup.
  recordCompletedMissionId('mission-new', h.storage);
  recordCompletedMissionFindingIds(['sol-1'], h.storage);
  h.api.add.mockResolvedValueOnce({ kind: 'unavailable' });
  pending.resolve(ok({ missions: ['mission-a'], findings: ['groombridge'] }));
  await settle();
  expect(readCompletedMissionIds(h.storage)).toEqual(['mission-new']);
  expect(readCompletedMissionFindingIds(h.storage)).toEqual(['sol-1']);
  expect(h.runtime.getSnapshot().account).toBeNull();
  expect(h.runtime.getSnapshot().accountId).toBe(transition === 'logout' ? null : secondId);
  if (transition === 'switch') expect(h.api.add.mock.calls[1]).toEqual(['token-' + secondId, { missions: ['mission-new'], findings: ['sol-1'] }]);
  else expect(h.runtime.getSnapshot().loadFailed).toBe(false);
});

test.each(['logout', 'switch'] as const)('late failed upload after %s keeps IDs without publishing stale errors', async transition => {
  const h = harness();
  recordCompletedMissionId('mission-a', h.storage);
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.add.mockReturnValueOnce(pending.promise);
  h.accounts.set(signedIn());
  await settle();
  h.accounts.set(transition === 'logout' ? signedOut : signedIn(secondId));
  const newRequest = deferred<AccountResult<AccountMissionBody>>();
  h.api.add.mockReturnValueOnce(newRequest.promise);
  pending.resolve({ kind: 'error', code: 'ACCOUNT_TOKEN_EXPIRED' });
  await settle();
  expect(h.runtime.getSnapshot().loadFailed).toBe(false);
  expect(h.onAuthorityError).not.toHaveBeenCalled();
  expect(readCompletedMissionIds(h.storage)).toEqual(['mission-a']);
  newRequest.resolve(ok(empty()));
  await settle();
});

test('late state response cannot replace a switched account value', async () => {
  const h = harness();
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.state.mockReturnValueOnce(pending.promise);
  h.accounts.set(signedIn());
  await settle();
  h.accounts.set(signedIn(secondId));
  h.setLatest({ missions: ['mission-new-account'], findings: [] });
  pending.resolve(ok({ missions: ['mission-old-account'], findings: [] }));
  await settle();
  expect(h.runtime.getCompletedMissionIds()).toEqual(['mission-new-account']);
});

test.each(['lore', 'online', 'unlock'] as const)('recovery cannot recover itself; only fresh %s releases the stop', async trigger => {
  const h = harness();
  h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
  h.api.add.mockResolvedValue({ kind: 'error', code: 'ACCOUNT_TOKEN_EXPIRED' });
  h.onAuthorityError.mockImplementation(async () => {
    h.accounts.set({ status: 'resuming', ...idle });
    await Promise.resolve();
    h.accounts.set(signedIn());
  });
  await h.signIn();
  expect(h.onAuthorityError).toHaveBeenCalledTimes(1);
  expect(h.api.add).toHaveBeenCalledTimes(2);
  expect(readCompletedMissionIds(h.storage)).toEqual(['mission-a']);
  h.storageEvent(MISSIONS_COMPLETED_STORAGE_KEY);
  h.storageEvent(MISSION_FINDINGS_COMPLETED_STORAGE_KEY);
  await settle();
  expect(h.api.add).toHaveBeenCalledTimes(2);
  h.api.add.mockResolvedValue(ok(empty()));
  if (trigger === 'lore') await h.runtime.sync();
  else if (trigger === 'online') h.events.dispatchEvent(new Event('online'));
  else h.runtime.recordMissionResult({ missionId: 'mission-b', findingIds: ['sol-1'] });
  await settle();
  expect(h.api.add).toHaveBeenCalledTimes(3);
  expect(readCompletedMissionIds(h.storage)).toEqual([]);
  expect(h.onAuthorityError).toHaveBeenCalledTimes(1);
});

test('authority failures coalesce recovery even when several syncs are queued', async () => {
  const h = harness();
  const pending = deferred<void>();
  h.onAuthorityError.mockReturnValue(pending.promise);
  h.api.state.mockResolvedValue({ kind: 'error', code: 'ACCOUNT_TOKEN_INVALID' });
  h.accounts.set(signedIn());
  await settle();
  const requests = [h.runtime.sync(), h.runtime.sync(), h.runtime.sync()];
  expect(h.onAuthorityError).toHaveBeenCalledTimes(1);
  pending.resolve();
  await Promise.all(requests);
  expect(h.onAuthorityError).toHaveBeenCalledTimes(1);
  expect(h.api.state).toHaveBeenCalledTimes(2);
});

test('account downloads never set unread, repeated account findings do not unlock, grouped contributions use displayed progress', async () => {
  const h = harness({ missions: ['mission-a'], findings: ['groombridge', 'rebel-alliance-human'] });
  await h.signIn();
  expect(readLoreUnread(h.storage)).toBe(false);
  expect(h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] }).didUnlockMissionFinding).toBe(false);
  expect(readLoreUnread(h.storage)).toBe(false);
  expect(h.runtime.recordMissionResult({ missionId: 'mission-b', findingIds: ['rebel-alliance-centaur'] }).didUnlockMissionFinding).toBe(true);
  expect(readLoreUnread(h.storage)).toBe(true);
  await settle();
  clearLoreUnread(h.storage);
  h.setLatest({ missions: [], findings: ['groombridge', 'sol-1'] });
  await h.runtime.sync();
  expect(readLoreUnread(h.storage)).toBe(false);
});

test('completed missions are account-first union while signed in and browser-only after logout', async () => {
  const h = harness({ missions: ['mission-a', 'mission-b'], findings: [] });
  await h.signIn();
  recordCompletedMissionId('mission-b', h.storage);
  recordCompletedMissionId('mission-c', h.storage);
  expect(h.runtime.getCompletedMissionIds()).toEqual(['mission-a', 'mission-b', 'mission-c']);
  h.accounts.set(signedOut);
  expect(h.runtime.getCompletedMissionIds()).toEqual(['mission-b', 'mission-c']);
});

test('guest reset synchronously clears both lists and unread without redundant writes', () => {
  const h = harness();
  h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
  expect(h.runtime.reset()).toBeUndefined();
  expect(h.runtime.getDisplayedProgress()).toEqual(empty());
  expect(readLoreUnread(h.storage)).toBe(false);
  vi.mocked(h.storage.setItem).mockClear(); vi.mocked(h.storage.removeItem).mockClear();
  h.runtime.reset();
  expect(h.storage.setItem).not.toHaveBeenCalled();
  expect(h.storage.removeItem).not.toHaveBeenCalled();
});

test('account reset waits for active sync, suppresses queued uploads and clears both lists/unread', async () => {
  const h = harness();
  await h.signIn();
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.add.mockReturnValueOnce(pending.promise);
  h.runtime.recordMissionResult({ missionId: 'mission-a', findingIds: ['groombridge'] });
  await settle();
  h.runtime.recordMissionResult({ missionId: 'mission-b', findingIds: ['sol-1'] });
  const reset = h.runtime.reset();
  expect(h.runtime.getSnapshot().resetBusy).toBe(true);
  expect(h.api.reset).not.toHaveBeenCalled();
  pending.resolve(ok({ missions: ['mission-a'], findings: ['groombridge'] }));
  await reset;
  expect(h.api.add).toHaveBeenCalledTimes(1);
  expect(h.api.reset).toHaveBeenCalledExactlyOnceWith('token-' + firstId);
  expect(h.runtime.getDisplayedProgress()).toEqual(empty());
  expect(readLoreUnread(h.storage)).toBe(false);
  expect(h.runtime.getSnapshot()).toMatchObject({ resetBusy: false, resetError: null });
});

test('failed account reset preserves cache, both browser lists and unread; next attempt clears the error', async () => {
  const h = harness({ missions: ['mission-account'], findings: ['groombridge'] });
  await h.signIn();
  recordCompletedMissionId('mission-browser', h.storage);
  recordCompletedMissionFindingIds(['sol-1'], h.storage);
  const cache = h.runtime.getSnapshot().account;
  h.api.reset.mockResolvedValueOnce({ kind: 'unavailable' });
  await h.runtime.reset();
  expect(h.runtime.getSnapshot().account).toBe(cache);
  expect(readCompletedMissionIds(h.storage)).toEqual(['mission-browser']);
  expect(readCompletedMissionFindingIds(h.storage)).toEqual(['sol-1']);
  expect(readLoreUnread(h.storage)).toBe(true);
  expect(h.runtime.getSnapshot().resetError).toBe("Couldn't reset Mission Findings. Please try again.");
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.reset.mockReturnValueOnce(pending.promise);
  const retry = h.runtime.reset();
  expect(h.runtime.getSnapshot().resetError).toBeNull();
  pending.resolve(ok(empty()));
  await retry;
  expect(h.runtime.getDisplayedProgress()).toEqual(empty());
});

test('logout during reset fences its success and preserves new guest progress', async () => {
  const h = harness({ missions: ['mission-a'], findings: ['groombridge'] });
  await h.signIn();
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.reset.mockReturnValueOnce(pending.promise);
  const reset = h.runtime.reset();
  await settle();
  h.accounts.set(signedOut);
  h.runtime.recordMissionResult({ missionId: 'mission-guest', findingIds: ['sol-1'] });
  pending.resolve(ok(empty()));
  await reset;
  expect(h.runtime.getCompletedMissionIds()).toEqual(['mission-guest']);
  expect(readLoreUnread(h.storage)).toBe(true);
  expect(h.runtime.getSnapshot()).toMatchObject({ mode: 'guest', account: null, resetBusy: false });
});

test('successful sync removes retired mintaka and unknown IDs even when the server drops them', async () => {
  const h = harness();
  h.runtime.recordMissionResult({ missionId: 'retired-mission', findingIds: ['mintaka'] });
  h.api.add.mockResolvedValueOnce(ok(empty()));
  await h.signIn();
  expect(readCompletedMissionFindingIds(h.storage)).toEqual([]);
  expect(readCompletedMissionIds(h.storage)).toEqual([]);
  expect(readLoreUnread(h.storage)).toBe(false);
});

test('switching accounts during reset permits a new reset without reusing the old promise', async () => {
  const h = harness({ missions: ['mission-a'], findings: ['groombridge'] });
  await h.signIn();
  const pending = deferred<AccountResult<AccountMissionBody>>();
  h.api.reset.mockReturnValueOnce(pending.promise);
  const oldReset = h.runtime.reset();
  await settle();
  await h.signIn(secondId);
  const newReset = h.runtime.reset();
  expect(newReset).not.toBe(oldReset);
  await newReset;
  expect(h.api.reset.mock.calls).toEqual([['token-' + firstId], ['token-' + secondId]]);
  // The old success must not clear progress recorded for the new account.
  h.api.add.mockResolvedValueOnce({ kind: 'unavailable' });
  h.runtime.recordMissionResult({ missionId: 'mission-new', findingIds: ['sol-1'] });
  await settle();
  pending.resolve(ok(empty()));
  await oldReset;
  expect(h.runtime.getCompletedMissionIds()).toEqual(['mission-new']);
  expect(h.runtime.getSnapshot()).toMatchObject({ accountId: secondId, resetBusy: false });
});

test('large browser lists are split into bounded requests and every sent ID is removed', async () => {
  const h = harness();
  const ids = Array.from({ length: 205 }, (_, i) => ('id-' + i).padEnd(80, 'x'));
  h.storage.setItem(MISSIONS_COMPLETED_STORAGE_KEY, JSON.stringify(ids));
  h.storage.setItem(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, JSON.stringify(ids));
  h.api.add.mockResolvedValue(ok(empty()));
  await h.signIn();
  expect(h.api.add.mock.calls.length).toBeGreaterThan(2);
  for (const [, progress] of h.api.add.mock.calls) {
    expect(progress.missions.length).toBeLessThanOrEqual(100);
    expect(progress.findings.length).toBeLessThanOrEqual(100);
    expect(new TextEncoder().encode(JSON.stringify(progress)).length).toBeLessThanOrEqual(16384);
  }
  expect(h.api.add.mock.calls.flatMap(([, p]) => p.missions)).toEqual(ids);
  expect(h.api.add.mock.calls.flatMap(([, p]) => p.findings)).toEqual(ids);
  expect(h.runtime.getDisplayedProgress()).toEqual(empty());
});

test('storage events republish but only uncached progress queues account sync; unread and no-op removals do not', async () => {
  const h = harness({ missions: ['mission-a'], findings: ['groombridge'] });
  await h.signIn();
  const listener = vi.fn(); h.runtime.subscribe(listener);
  recordCompletedMissionId('mission-a', h.storage);
  recordCompletedMissionFindingIds(['groombridge'], h.storage);
  h.storageEvent(MISSIONS_COMPLETED_STORAGE_KEY);
  h.storageEvent(MISSION_FINDINGS_COMPLETED_STORAGE_KEY);
  h.storageEvent(LORE_UNREAD_STORAGE_KEY);
  await settle();
  expect(listener).toHaveBeenCalledTimes(3);
  expect(h.api.add).not.toHaveBeenCalled();
  expect(h.api.state).toHaveBeenCalledTimes(1);
  recordCompletedMissionFindingIds(['sol-1'], h.storage);
  h.storageEvent(MISSION_FINDINGS_COMPLETED_STORAGE_KEY);
  await settle();
  expect(h.api.add).toHaveBeenCalledTimes(1);
  vi.mocked(h.storage.setItem).mockClear(); vi.mocked(h.storage.removeItem).mockClear();
  h.storageEvent(MISSIONS_COMPLETED_STORAGE_KEY);
  h.storageEvent(MISSION_FINDINGS_COMPLETED_STORAGE_KEY);
  await settle();
  expect(h.api.add).toHaveBeenCalledTimes(1);
  expect(h.storage.setItem).not.toHaveBeenCalled();
  expect(h.storage.removeItem).not.toHaveBeenCalled();
});

test('unrelated/storage-area events are ignored; online refreshes; disposal detaches events and account subscription', async () => {
  const h = harness();
  await h.signIn();
  const listener = vi.fn(); h.runtime.subscribe(listener);
  h.storageEvent('unrelated');
  h.storageEvent(MISSIONS_COMPLETED_STORAGE_KEY, h.session);
  expect(listener).not.toHaveBeenCalled();
  h.events.dispatchEvent(new Event('online'));
  await settle();
  expect(h.api.state).toHaveBeenCalledTimes(2);
  h.runtime.dispose();
  h.events.dispatchEvent(new Event('online'));
  h.storageEvent(null);
  h.accounts.set(signedIn(secondId));
  await settle();
  expect(h.api.state).toHaveBeenCalledTimes(2);
});

test('throwing API and authority callback are contained and preserve browser progress', async () => {
  const h = harness();
  recordCompletedMissionId('mission-a', h.storage);
  h.api.add.mockRejectedValueOnce(new Error('transport'));
  await h.signIn();
  expect(h.runtime.getSnapshot().loadFailed).toBe(true);
  h.api.add.mockResolvedValue({ kind: 'error', code: 'ACCOUNT_TOKEN_REVOKED' });
  h.onAuthorityError.mockRejectedValue(new Error('recovery'));
  await expect(h.runtime.sync()).resolves.toBeUndefined();
  expect(readCompletedMissionIds(h.storage)).toEqual(['mission-a']);
  expect(h.onAuthorityError).toHaveBeenCalledTimes(1);
});
