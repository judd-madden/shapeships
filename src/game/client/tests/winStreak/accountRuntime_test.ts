import { expect, test, vi } from 'vitest';
import { deriveGuestStreakCandidate } from '../../winStreak/accountRuntime';
import { createEmptyWinStreakProfile, WinStreakProfileStore } from '../../winStreak/profile';
import { observeAuthoritativeWinStreakGame, projectAuthoritativeWinStreakGame } from '../../winStreak/authoritative';
import { executeReservedBotGameCreation, prepareBotGameCreation, completeWinStreakRestart } from '../../winStreak/workflow';
import { deferred, json } from '../account/fixtures';
import { otherAccountId, runtimeHarness, streak, trackedGuest, memoryStorage, serialRunner } from './accountFixtures';
import { publicGameState } from './fixtures';

async function candidateHarness() {
  const guest = new WinStreakProfileStore(null); await trackedGuest(guest); return runtimeHarness(guest);
}
test('candidate requires an anchor, excludes restart_pending, and accepts zero-count pending results', () => {
  const profile = createEmptyWinStreakProfile(); profile.currentCount = 4;
  expect(deriveGuestStreakCandidate(profile)).toBeNull();
  profile.trackedGame = { gameId: 'G', humanPlayerId: 'human', status: 'unfinished', resultEligible: true };
  profile.currentCount = 0;
  expect(deriveGuestStreakCandidate(profile)).toEqual({ currentCount: 0, anchorGameId: 'G', humanPlayerId: 'human', resultPending: true, generation: 0 });
  profile.trackedGame.status = 'restart_pending'; expect(deriveGuestStreakCandidate(profile)).toBeNull();
  profile.trackedGame.status = 'settled'; expect(deriveGuestStreakCandidate(profile)).toBeNull();
  profile.currentCount = 3; expect(deriveGuestStreakCandidate(profile)?.resultPending).toBe(false);
});

test('no candidate uses state only; cache accepts equal/newer revisions and newer lower counts', async () => {
  const h = runtimeHarness(); await h.signIn();
  expect(h.api.state).toHaveBeenCalledOnce(); expect(h.api.import).not.toHaveBeenCalled();
  expect(h.runtime.adopt(streak({ revision: '9007199254740993', currentCount: 8 }))).toBe(true);
  expect(h.runtime.adopt(streak({ revision: '9007199254740992', currentCount: 99 }))).toBe(false);
  expect(h.runtime.adopt(streak({ accountId: otherAccountId, revision: '9223372036854775807' }))).toBe(false);
  expect(h.runtime.adopt(streak({ revision: '9007199254740994', currentCount: 0 }))).toBe(true);
  expect(h.runtime.adopt(streak({ revision: '9007199254740994', currentCount: 0 }))).toBe(true);
  expect(h.runtime.getSnapshot().streak?.currentCount).toBe(0);
  h.runtime.dispose();
});

test.each(['signedOut', 'resuming', 'passwordChangeRequired', 'dormant', 'unavailable'] as const)('account status %s uses guest mode and zero streak requests', async status => {
  const h = runtimeHarness();
  h.accounts.set({ ...h.accounts.getSnapshot(), status, name: 'Pilot1' } as any);
  await Promise.resolve(); expect(h.runtime.getSnapshot().mode).toBe('guest');
  expect(h.api.state).not.toHaveBeenCalled(); expect(h.api.import).not.toHaveBeenCalled();
  h.runtime.dispose();
});

test('successful compare consumes the captured v1 source and never writes the account count to it', async () => {
  const h = await candidateHarness(); h.setLatest(streak({ currentCount: 9 })); await h.signIn();
  expect(h.api.import).toHaveBeenCalledExactlyOnceWith({ expectedRevision: '1', decision: 'compare',
    guest: { currentCount: 4, anchorGameId: 'GUEST', humanPlayerId: 'human', resultPending: true } });
  expect(h.guest.getSnapshot()).toMatchObject({ currentCount: 0, endedStreak: null, trackedGame: null,
    creationReservation: null, generation: 3, retiredGameIds: ['GUEST'] });
  expect(h.runtime.getSnapshot()).toMatchObject({ pending: false, candidate: null, streak: { currentCount: 9 } });
  h.runtime.dispose();
});

test('compare conflict refreshes and retries exactly once using the same captured candidate', async () => {
  const h = await candidateHarness();
  h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_CONFLICT' });
  h.api.state.mockResolvedValueOnce({ kind: 'ok', data: { ok: true, streak: streak() } })
    .mockResolvedValueOnce({ kind: 'ok', data: { ok: true, streak: streak({ revision: '2' }) } });
  await h.signIn();
  expect(h.api.import.mock.calls.map(([input]) => input.expectedRevision)).toEqual(['1', '2']);
  expect(h.api.import.mock.calls[0][0].guest).toEqual(h.api.import.mock.calls[1][0].guest);
  h.runtime.dispose();
  const failed = await candidateHarness(); failed.api.import.mockResolvedValue({ kind: 'error', code: 'STREAK_CONFLICT' });
  await failed.signIn(); expect(failed.api.import).toHaveBeenCalledTimes(2);
  expect(failed.runtime.getSnapshot().pending).toBe(true); expect(failed.guest.getSnapshot().currentCount).toBe(4);
  failed.runtime.dispose();
});

test.each(['STREAK_IMPORT_UNVERIFIED', 'STREAK_GAME_NOT_FOUND', 'outage'])('%s preserves candidate; explicit decline consumes it', async code => {
  const h = await candidateHarness();
  h.api.import.mockResolvedValueOnce(code === 'outage' ? { kind: 'unavailable' } : { kind: 'error', code });
  await h.signIn(); expect(h.runtime.getSnapshot().pending).toBe(true);
  expect(h.guest.getSnapshot().currentCount).toBe(4);
  await h.runtime.retryImport('decline');
  expect(h.api.import.mock.lastCall?.[0].decision).toBe('decline');
  expect(h.guest.getSnapshot().currentCount).toBe(0); expect(h.runtime.getSnapshot().pending).toBe(false);
  h.runtime.dispose();
});

test('consumed import consumes the local source and uses refreshed account state', async () => {
  const h = await candidateHarness(); h.api.import.mockResolvedValue({ kind: 'error', code: 'STREAK_IMPORT_CONSUMED' });
  await h.signIn(); expect(h.api.import).toHaveBeenCalledOnce(); expect(h.api.state).toHaveBeenCalledTimes(2);
  expect(h.runtime.getSnapshot().pending).toBe(false); expect(h.guest.getSnapshot().currentCount).toBe(0);
  h.runtime.dispose();
});

test('initial state outage preserves evidence without a fabricated account count; Retry restores it', async () => {
  const h = await candidateHarness(); h.api.state.mockResolvedValueOnce({ kind: 'unavailable' });
  await h.signIn(); expect(h.runtime.getSnapshot()).toMatchObject({ pending: true, streak: null, candidate: { currentCount: 4 } });
  expect(h.api.import).not.toHaveBeenCalled(); await h.runtime.retryImport('compare');
  expect(h.runtime.getSnapshot().candidate).toBeNull(); h.runtime.dispose();
});

test('logout/account switch discard late account responses and never seed guest state', async () => {
  const h = runtimeHarness(); await h.signIn();
  const gate = deferred<any>(); h.api.state.mockImplementationOnce(() => gate.promise);
  const pending = h.runtime.refresh().catch(() => null);
  h.accounts.set({ ...h.accounts.getSnapshot(), status: 'signedOut' } as any);
  expect(h.runtime.getSnapshot()).toMatchObject({ mode: 'guest', streak: null });
  gate.resolve({ kind: 'ok', data: { ok: true, streak: streak({ currentCount: 99, revision: '9' }) } });
  await pending; expect(h.runtime.getSnapshot().streak).toBeNull(); expect(h.guest.getSnapshot().currentCount).toBe(0);
  h.setLatest(streak({ accountId: otherAccountId })); await h.signIn(otherAccountId);
  expect(h.runtime.getSnapshot().streak?.accountId).toBe(otherAccountId);
  expect(h.runtime.adopt(streak({ revision: '99' }))).toBe(false); h.runtime.dispose();
});

test('terminal observation refreshes once, does not increment locally, and explicit repair retries a failed refresh', async () => {
  const h = runtimeHarness(); await h.signIn(); h.api.state.mockResolvedValueOnce({ kind: 'unavailable' });
  await Promise.allSettled([h.runtime.observeTerminal('GAME'), h.runtime.observeTerminal('GAME')]);
  expect(h.api.state).toHaveBeenCalledTimes(2); expect(h.runtime.getSnapshot().streak?.currentCount).toBe(3);
  h.setLatest(streak({ revision: '2', currentCount: 4 })); await h.runtime.reconcileTerminal('GAME');
  expect(h.api.state).toHaveBeenCalledTimes(3); expect(h.runtime.getSnapshot().streak?.currentCount).toBe(4);
  h.runtime.dispose();
});

test('consumption rejects stale storage events and late guest creation, observation and restart work', async () => {
  const storage = memoryStorage(), lock = serialRunner();
  const guest = new WinStreakProfileStore(storage, lock); await trackedGuest(guest);
  const before = JSON.stringify(guest.getSnapshot());
  const second = new WinStreakProfileStore(storage, lock); const secondWork = second.captureGuestWork();
  const prepared = await prepareBotGameCreation({ store: guest, transport: { getGameState: async () => json(publicGameState({ gameId: 'GUEST', appliedCount: 4, status: 'finished', winner: 'human' })) }, kind: 'rematch', sourceGameId: 'GUEST' });
  if (prepared.kind !== 'reserved') throw new Error(prepared.error);
  const response = deferred<Response>();
  const execution = executeReservedBotGameCreation({ store: guest, reservation: prepared.reservation,
    request: () => response.promise, getHumanPlayerId: async () => 'human', invalidResponseMessage: 'bad' });
  await vi.waitFor(() => expect(guest.getSnapshot().creationReservation?.status).toBe('creating'));
  const candidate = deriveGuestStreakCandidate(guest.getSnapshot())!;
  expect(await guest.consumeForAccount(candidate)).toBe(true);
  second.acceptExternalValue(storage.value); expect(secondWork()).toBe(false);
  second.acceptExternalValue(before); expect(second.getSnapshot().currentCount).toBe(0);
  guest.acceptExternalValue(before); expect(guest.getSnapshot().currentCount).toBe(0);
  response.resolve(json({ gameId: 'LATE' })); await execution;
  expect(guest.getSnapshot().creationReservation).toBeNull(); expect(guest.getSnapshot().trackedGame).toBeNull();
  const game = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'GUEST', status: 'finished', winner: 'human' }))!;
  expect(await observeAuthoritativeWinStreakGame(second, game, { allowDiscovery: true, isCurrent: secondWork })).toBe('stale');
  const restart = completeWinStreakRestart(second, 'GUEST', 'LATE-RESTART', 'human');
  second.fenceGuestWork(); expect(await restart).toBe('stale');
});

test('consumption generation fence preserves a newer independent guest association', async () => {
  const h = await candidateHarness(); const candidate = deriveGuestStreakCandidate(h.guest.getSnapshot())!;
  await h.guest.mutate(profile => { profile.generation++; profile.trackedGame!.gameId = 'NEW'; });
  expect(await h.guest.consumeForAccount(candidate)).toBe(false);
  expect(h.guest.getSnapshot().trackedGame?.gameId).toBe('NEW'); h.runtime.dispose();
});

test('preference publications do not reinitialize the account or add polling', async () => {
  const h = runtimeHarness(); await h.signIn(); const snapshot = h.accounts.getSnapshot();
  h.accounts.set({ ...snapshot, lastError: { code: 'PREFERENCE_CONFLICT' } });
  await Promise.resolve(); expect(h.api.state).toHaveBeenCalledOnce(); h.runtime.dispose();
});

test('streak authority errors invoke existing revalidation, while an isolated outage does not', async () => {
  const h = runtimeHarness(); await h.signIn();
  h.api.state.mockResolvedValueOnce({ kind: 'unavailable' }); await h.runtime.refresh().catch(() => null);
  expect(h.onAuthorityError).not.toHaveBeenCalled(); expect(h.accounts.getSnapshot().status).toBe('signedIn');
  h.api.state.mockResolvedValueOnce({ kind: 'error', code: 'ACCOUNT_TOKEN_EXPIRED' });
  await h.runtime.refresh().catch(() => null);
  expect(h.onAuthorityError).toHaveBeenCalledExactlyOnceWith('ACCOUNT_TOKEN_EXPIRED'); h.runtime.dispose();
});

test('a same-anchor result settled during import is consumed under a fresh generation fence without reimport', async () => {
  const h = await candidateHarness();
  h.api.import.mockImplementationOnce(async input => {
    await h.guest.mutate(profile => { profile.generation++; profile.currentCount++;
      profile.trackedGame!.status = 'settled'; profile.trackedGame!.resultEligible = false; });
    return { kind: 'ok', data: { ok: true, streak: streak(), import: { anchorGameId: input.guest.anchorGameId,
      selection: 'account', acceptedCount: 3, continuation: 'none' } } };
  });
  await h.signIn(); expect(h.api.import).toHaveBeenCalledOnce();
  expect(h.guest.getSnapshot().currentCount).toBe(0); expect(h.guest.getSnapshot().trackedGame).toBeNull(); h.runtime.dispose();
});

test('account consumption rechecks account authority after acquiring the guest lock', async () => {
  const release = deferred<void>(); let blocked = false;
  const guest = new WinStreakProfileStore(null, async work => { if (blocked) await release.promise; return work(); });
  await trackedGuest(guest); const captured = deriveGuestStreakCandidate(guest.getSnapshot())!;
  let current = true; blocked = true;
  const consumption = guest.consumeForAccount(captured, () => current);
  current = false; release.resolve(); expect(await consumption).toBe(false);
  expect(guest.getSnapshot().currentCount).toBe(4);
});

test('a delayed consumption event cannot replace a newer guest association', async () => {
  const store = new WinStreakProfileStore(null); await trackedGuest(store);
  await store.consumeForAccount(deriveGuestStreakCandidate(store.getSnapshot())!);
  const consumed = JSON.stringify(store.getSnapshot());
  await store.mutate(profile => { profile.generation++; profile.currentCount = 1;
    profile.trackedGame = { gameId: 'NEW-RUN', humanPlayerId: 'human', status: 'unfinished', resultEligible: true }; });
  store.acceptExternalValue(consumed);
  expect(store.getSnapshot().trackedGame?.gameId).toBe('NEW-RUN'); expect(store.getSnapshot().currentCount).toBe(1);
});

test('a full retirement ledger still fences sibling guest work on consumption', async () => {
  const storage = memoryStorage(), lock = serialRunner(); const first = new WinStreakProfileStore(storage, lock);
  await trackedGuest(first, { retiredGameIds: Array.from({ length: 64 }, (_, index) => 'OLD-' + index), automaticEnrollmentSealed: true });
  const second = new WinStreakProfileStore(storage, lock), work = second.captureGuestWork();
  await first.consumeForAccount(deriveGuestStreakCandidate(first.getSnapshot())!);
  await second.inspect(() => undefined);
  expect(work()).toBe(false); expect(second.getSnapshot().currentCount).toBe(0);
});

test.each(['STREAK_GAME_NOT_FOUND', 'STREAK_IMPORT_UNVERIFIED', 'STREAK_IMPORT_CONSUMED'])(
  'decline resolves %s locally and the consumed candidate does not return on sign-in', async code => {
    const h = await candidateHarness();
    h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_IMPORT_UNVERIFIED' })
      .mockResolvedValueOnce({ kind: 'error', code });
    await h.signIn();
    expect(h.runtime.getSnapshot()).toMatchObject({ pending: true, error: null });
    await h.runtime.retryImport('decline');
    expect(h.api.import.mock.lastCall?.[0]).toEqual({ expectedRevision: '1', decision: 'decline',
      guest: { currentCount: 4, anchorGameId: 'GUEST', humanPlayerId: 'human', resultPending: true } });
    expect(h.runtime.getSnapshot()).toMatchObject({ pending: false, candidate: null, error: null, streak: { currentCount: 3 } });
    expect(h.guest.getSnapshot()).toMatchObject({ currentCount: 0, endedStreak: null,
      trackedGame: null, creationReservation: null, generation: 3, retiredGameIds: ['GUEST'] });
    h.accounts.set({ ...h.accounts.getSnapshot(), status: 'signedOut' } as any);
    await h.signIn();
    expect(h.api.import).toHaveBeenCalledTimes(2);
    expect(h.runtime.getSnapshot()).toMatchObject({ pending: false, candidate: null });
    h.runtime.dispose();
  },
);

test.each(['STREAK_IMPORT_UNVERIFIED', 'STREAK_CONFLICT'])(
  'decline conflict refreshes and retries once, then resolves a determinate %s refusal locally', async finalCode => {
    const h = await candidateHarness();
    h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_GAME_NOT_FOUND' })
      .mockResolvedValueOnce({ kind: 'error', code: 'STREAK_CONFLICT' })
      .mockResolvedValueOnce({ kind: 'error', code: finalCode });
    await h.signIn(); h.setLatest(streak({ revision: '2' }));
    await h.runtime.retryImport('decline');
    expect(h.api.import.mock.calls.slice(1).map(([input]) => [input.decision, input.expectedRevision])).toEqual([
      ['decline', '1'], ['decline', '2'],
    ]);
    expect(h.api.import).toHaveBeenCalledTimes(3);
    expect(h.runtime.getSnapshot()).toMatchObject({ pending: false, candidate: null, error: null });
    expect(h.guest.getSnapshot().currentCount).toBe(0);
    h.runtime.dispose();
  },
);

test.each(['outage', 'ACCOUNT_SERVICE_UNAVAILABLE', 'ACCOUNT_TOKEN_EXPIRED', 'STREAK_SEAT_FORBIDDEN'])(
  'decline preserves the candidate for %s', async code => {
    const h = await candidateHarness();
    h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_GAME_NOT_FOUND' });
    await h.signIn();
    h.api.import.mockResolvedValueOnce(code === 'outage' ? { kind: 'unavailable' } : { kind: 'error', code });
    await h.runtime.retryImport('decline');
    expect(h.runtime.getSnapshot()).toMatchObject({ pending: true, candidate: { anchorGameId: 'GUEST' } });
    expect(h.guest.getSnapshot()).toMatchObject({ currentCount: 4, generation: 2 });
    h.runtime.dispose();
  },
);

test('decline after not-found retains the generation fence for a newer independent guest run', async () => {
  const h = await candidateHarness();
  h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_GAME_NOT_FOUND' });
  await h.signIn();
  const gate = deferred<any>(); h.api.import.mockImplementationOnce(() => gate.promise);
  const pending = h.runtime.retryImport('decline');
  await vi.waitFor(() => expect(h.api.import.mock.lastCall?.[0].decision).toBe('decline'));
  await h.guest.mutate(profile => { profile.generation++; profile.trackedGame!.gameId = 'NEW-RUN'; });
  gate.resolve({ kind: 'error', code: 'STREAK_GAME_NOT_FOUND' }); await pending;
  expect(h.runtime.getSnapshot()).toMatchObject({ pending: false, candidate: null });
  expect(h.guest.getSnapshot()).toMatchObject({ currentCount: 4, generation: 3, trackedGame: { gameId: 'NEW-RUN' } });
  h.runtime.dispose();
});
