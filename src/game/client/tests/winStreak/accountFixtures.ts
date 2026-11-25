import { vi } from 'vitest';
import { createAccountWinStreakRuntime } from '../../winStreak/accountRuntime';
import { WinStreakProfileStore, type StorageLike, type ExclusiveRunner } from '../../winStreak/profile';
import type { AccountSnapshot, AccountStreakApi, AccountStreakSnapshot } from '../../account/types';
import { entry } from '../account/fixtures';

export const accountId = '11111111-1111-4111-8111-111111111111';
export const otherAccountId = '22222222-2222-4222-8222-222222222222';
export function streak(patch: Partial<AccountStreakSnapshot> = {}): AccountStreakSnapshot {
  return { accountId, runId: '33333333-3333-4333-8333-333333333333', currentCount: 3, revision: '1',
    trackedGame: null, endedStreak: null, updatedAt: '2026-11-25T00:00:00+00:00', ...patch };
}
export function signedIn(id = accountId): AccountSnapshot {
  const data = entry(undefined, id);
  return { status: 'signedIn', identity: data.account, preferences: data.preferences,
    linkedSessionId: 'human', expiresAt: data.expiresAt, tokenPersistence: 'memory',
    lastError: null, remoteLogoutPending: false, preferenceSync: { saving: false, unsaved: false } };
}
export function accountsHarness() {
  let value: AccountSnapshot = { status: 'signedOut', lastError: null, remoteLogoutPending: false,
    preferenceSync: { saving: false, unsaved: false } };
  const listeners = new Set<() => void>();
  return { getSnapshot: () => value,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    set(next: AccountSnapshot) { value = next; listeners.forEach(fn => fn()); },
  };
}
export function serialRunner(): ExclusiveRunner {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T> | T) => {
    const pending = queue.then(work); queue = pending.catch(() => undefined); return pending;
  };
}
export function memoryStorage(): StorageLike & { value: string | null } {
  return { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
}
export function runtimeHarness(guest = new WinStreakProfileStore(null), suppliedApi?: AccountStreakApi) {
  const accounts = accountsHarness();
  let latest = streak();
  const api = {
    state: vi.fn<AccountStreakApi['state']>(async () => ({ kind: 'ok', data: { ok: true, streak: latest } })),
    import: vi.fn<AccountStreakApi['import']>(async input => ({ kind: 'ok', data: { ok: true, streak: latest,
      import: { anchorGameId: input.guest.anchorGameId, acceptedCount: latest.currentCount,
        selection: input.decision === 'decline' ? 'declined' : 'account', continuation: 'none' } } })),
    reset: vi.fn<AccountStreakApi['reset']>(async () => ({ kind: 'ok', data: { ok: true, streak: latest } })),
  };
  const onAuthorityError = vi.fn(async (_code: string) => {});
  const runtime = createAccountWinStreakRuntime({ accounts, api: suppliedApi ?? api, guest, onAuthorityError });
  return { accounts, api, guest, runtime, onAuthorityError, setLatest(next: AccountStreakSnapshot) { latest = next; },
    async signIn(id = accountId) { accounts.set(signedIn(id)); await vi.waitFor(() => {
      if (runtime.getSnapshot().entryBusy) throw new Error('initializing');
    }); } };
}
export async function trackedGuest(store: WinStreakProfileStore, patch: Partial<import('../../winStreak/types').WinStreakProfile> = {}) {
  await store.mutate(profile => Object.assign(profile, { currentCount: 4, generation: 2,
    trackedGame: { gameId: 'GUEST', humanPlayerId: 'human', status: 'unfinished', resultEligible: true } }, patch));
}
