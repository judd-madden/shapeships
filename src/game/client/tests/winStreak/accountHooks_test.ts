import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useWinStreakMenu } from '../../winStreak/useWinStreakProfile';
import { useWinStreakGame } from '../../winStreak/useWinStreakGame';
import { createAccountStreakApi } from '../../account/accountApi';
import { projectAuthoritativeWinStreakGame, observeAuthoritativeWinStreakGame } from '../../winStreak/authoritative';
import { WinStreakProfileStore } from '../../winStreak/profile';
import { ACCOUNT_STREAK_ACTION_FAILED, ACCOUNT_STREAK_CONFLICT, ACCOUNT_STREAK_UNAVAILABLE } from '../../winStreak/types';
import { runtimeHarness, streak, signedIn, trackedGuest } from './accountFixtures';
import { publicGameState } from './fixtures';
import { deferred, json } from '../account/fixtures';

const hooks = vi.hoisted(() => {
  type Cell = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
  const cells: Cell[] = [];
  const effects: Array<() => void> = [];
  let index = 0;
  const cell = () => cells[index++] ?? (cells[index - 1] = {});
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !a || !b || a.length !== b.length || b.some((value, i) => !Object.is(value, a[i]));
  return {
    begin: () => { index = 0; },
    flush: () => effects.splice(0).forEach((effect) => effect()),
    reset: () => { cells.forEach((entry) => entry.cleanup?.()); cells.length = 0; effects.length = 0; index = 0; },
    useRef: (initial: unknown) => { const entry = cell(); return entry.value ?? (entry.value = { current: initial }); },
    useState: (initial: unknown) => {
      const entry = cell();
      if (!('value' in entry)) entry.value = typeof initial === 'function' ? initial() : initial;
      return [entry.value, (value: any) => { entry.value = typeof value === 'function' ? value(entry.value) : value; }];
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) => {
      const entry = cell();
      if (changed(entry.deps, deps)) { entry.value = callback; entry.deps = deps; }
      return entry.value;
    },
    useMemo: (compute: () => unknown, deps: readonly unknown[]) => {
      const entry = cell();
      if (changed(entry.deps, deps)) { entry.value = compute(); entry.deps = deps; }
      return entry.value;
    },
    useEffect: (setup: () => void | (() => void), deps?: readonly unknown[]) => {
      const entry = cell();
      if (!changed(entry.deps, deps)) return;
      entry.deps = deps;
      effects.push(() => { entry.cleanup?.(); entry.cleanup = setup() || undefined; });
    },
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  };
});
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), ...hooks }));


beforeEach(() => { hooks.reset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { hooks.reset(); vi.restoreAllMocks(); });
function render<T>(hook: () => T): T { hooks.begin(); const value = hook(); hooks.flush(); return value; }
function menuArgs(h: ReturnType<typeof runtimeHarness>) {
  return { store: h.guest, accountRuntime: h.runtime,
    createComputerGameRequest: vi.fn(async (_settings: any, _count: number) => json({ gameId: 'NEW' })),
    createAccountComputerGameRequest: vi.fn(async (_settings: any, _revision: string) => json({ gameId: 'NEW' })),
    getCurrentSession: vi.fn(async () => ({ sessionId: 'human' })),
    getGameState: vi.fn(async (_id: string) => json(publicGameState({ gameId: 'SOURCE', appliedCount: 3 }))),
    navigateToGame: vi.fn((_id: string) => {}),
  };
}
function gameArgs(h: ReturnType<typeof runtimeHarness>, canRestart = false) {
  let state = publicGameState({ gameId: 'SOURCE', appliedCount: 3, canRestart });
  const args = { store: h.guest, accountRuntime: h.runtime, effectiveGameId: 'SOURCE', effectivePlayerName: 'Pilot1',
    humanPlayerId: 'human', authoritativeGame: projectAuthoritativeWinStreakGame(state),
    getLatestAuthoritativeGame: () => projectAuthoritativeWinStreakGame(state),
    resignGame: vi.fn(async (_id: string) => ({ ok: true as const, state })), isResigning: () => false,
    awaitPendingObservation: vi.fn(async () => { if (state.status === 'finished') await h.runtime.observeTerminal('SOURCE').catch(() => undefined); }),
    getGameState: vi.fn(async (_id: string) => json(state)),
    createBotRematch: vi.fn(async (_id: string, _count: number) => json({ gameId: 'NEW' })),
    createAccountBotRematch: vi.fn(async (_id: string, _revision: string) => json({ gameId: 'NEW' })),
    resetWinStreak: vi.fn(async (_id: string) => json({ gameId: 'NEW', sourceGameId: 'SOURCE', resetStatus: 'completed' })),
    resetAccountWinStreak: vi.fn(async (_id: string, _revision: string) => json({ gameId: 'NEW', sourceGameId: 'SOURCE', resetStatus: 'completed' })),
    getCurrentHumanPlayerId: async (_name: string) => 'human', refreshGameStateOnce: async () => {}, navigateToGame: vi.fn((_id: string) => {}),
  };
  return { args, setGame(next: any) { state = next; args.authoritativeGame = projectAuthoritativeWinStreakGame(state); } };
}

test('account menu loading hides count and Reset while a click waits for the authoritative snapshot', async () => {
  const h = runtimeHarness(), gate = deferred<any>(); h.api.state.mockImplementationOnce(() => gate.promise);
  h.accounts.set(signedIn()); const args = menuArgs(h);
  const get = () => render(() => useWinStreakMenu(args));
  expect(get().viewModel).toMatchObject({ shouldShowContent: false, createDisabled: false });
  const pending = get().requestComputerGame({ timed: false });
  expect(args.createAccountComputerGameRequest).not.toHaveBeenCalled();
  gate.resolve({ kind: 'ok', data: { ok: true, streak: streak() } });
  expect(await pending).toBe('NEW'); expect(args.createComputerGameRequest).not.toHaveBeenCalled();
  expect(args.createAccountComputerGameRequest).toHaveBeenCalledExactlyOnceWith({ timed: false }, '1');
  h.runtime.dispose();
});

test('pending carry-over exposes both notice actions, blocks mutations and omits the unknown account count', async () => {
  const guest = new WinStreakProfileStore(null); await trackedGuest(guest);
  const h = runtimeHarness(guest); h.api.state.mockResolvedValueOnce({ kind: 'unavailable' }); await h.signIn();
  const args = menuArgs(h), get = () => render(() => useWinStreakMenu(args));
  expect(get().viewModel).toMatchObject({ carryOver: { guestCount: 4, accountCount: null }, createDisabled: true,
    reset: { error: ACCOUNT_STREAK_UNAVAILABLE }, rejoinCandidate: null });
  await expect(get().requestComputerGame({ timed: false })).rejects.toThrow(ACCOUNT_STREAK_UNAVAILABLE);
  expect(args.createAccountComputerGameRequest).not.toHaveBeenCalled();
  await get().actions.onKeepAccountStreak!(); expect(h.api.import.mock.lastCall?.[0].decision).toBe('decline');
  expect(get().viewModel.carryOver).toBeUndefined(); expect(get().viewModel.displayCount).toBe(3);
  h.runtime.dispose();
});

test('account menu reset errors use the existing feedback model and preserve the last count', async () => {
  const h = runtimeHarness(); await h.signIn(); h.api.reset.mockResolvedValue({ kind: 'unavailable' });
  const args = menuArgs(h), get = () => render(() => useWinStreakMenu(args));
  await get().actions.onResetWinStreak();
  expect(get().viewModel).toMatchObject({ displayCount: 3, reset: { busy: false, error: ACCOUNT_STREAK_UNAVAILABLE } });
  h.runtime.dispose();
});

test('account rematch waits for terminal reconciliation and uses its revision without local settlement', async () => {
  const h = runtimeHarness(); h.setLatest(streak({ trackedGame: { gameId: 'SOURCE', humanPlayerId: 'human', status: 'unfinished' } }));
  await h.signIn();
  const ctx = gameArgs(h); ctx.setGame(publicGameState({ gameId: 'SOURCE', appliedCount: 3, status: 'finished', winner: 'human' }));
  h.setLatest(streak({ revision: '2', currentCount: 4, trackedGame: { gameId: 'SOURCE', humanPlayerId: 'human', status: 'settled' } }));
  await render(() => useWinStreakGame(ctx.args)).actions.requestBotRematch();
  expect(ctx.args.createAccountBotRematch).toHaveBeenCalledExactlyOnceWith('SOURCE', '2');
  expect(ctx.args.createBotRematch).not.toHaveBeenCalled(); expect(ctx.args.navigateToGame).toHaveBeenCalledExactlyOnceWith('NEW');
  expect(h.api.state).toHaveBeenCalledTimes(3); expect(h.guest.getSnapshot().currentCount).toBe(0);
  h.runtime.dispose();
});

test('account early restart uses its revision and never invokes resignation or guest registration', async () => {
  const h = runtimeHarness(); await h.signIn(); const ctx = gameArgs(h, true);
  await render(() => useWinStreakGame(ctx.args)).actions.resetWinStreak();
  expect(ctx.args.resetAccountWinStreak).toHaveBeenCalledExactlyOnceWith('SOURCE', '1');
  expect(ctx.args.resignGame).not.toHaveBeenCalled(); expect(ctx.args.resetWinStreak).not.toHaveBeenCalled();
  expect(ctx.args.navigateToGame).toHaveBeenCalledExactlyOnceWith('NEW'); expect(h.guest.getSnapshot().trackedGame).toBeNull();
  h.runtime.dispose();
});

test('later account Reset retries the zero-count rematch without resigning twice', async () => {
  const h = runtimeHarness(); h.setLatest(streak({ trackedGame: { gameId: 'SOURCE', humanPlayerId: 'human', status: 'unfinished' } }));
  await h.signIn(); const ctx = gameArgs(h);
  ctx.args.resignGame.mockImplementation(async () => {
    const loss = publicGameState({ gameId: 'SOURCE', status: 'finished', winner: 'bot', reason: 'surrender', appliedCount: 3 });
    ctx.setGame(loss); h.setLatest(streak({ revision: '2', currentCount: 0,
      trackedGame: { gameId: 'SOURCE', humanPlayerId: 'human', status: 'settled' }, endedStreak: { count: 3, endingGameId: 'SOURCE' } }));
    return { ok: true, state: loss };
  });
  ctx.args.createAccountBotRematch.mockResolvedValueOnce(json({}, 503));
  const get = () => render(() => useWinStreakGame(ctx.args));
  await get().actions.resetWinStreak(); expect(get().viewModel.reset).toMatchObject({ error: ACCOUNT_STREAK_UNAVAILABLE, retryAvailable: true });
  await get().actions.resetWinStreak(); expect(ctx.args.resignGame).toHaveBeenCalledOnce();
  expect(ctx.args.createAccountBotRematch.mock.calls).toEqual([['SOURCE', '2'], ['SOURCE', '2']]);
  expect(ctx.args.navigateToGame).toHaveBeenCalledExactlyOnceWith('NEW'); h.runtime.dispose();
});

test('account rematch conflict shows fixed retry feedback and does not replay', async () => {
  const h = runtimeHarness(); await h.signIn(); const ctx = gameArgs(h);
  ctx.args.createAccountBotRematch.mockResolvedValue(json({ error: 'STREAK_CONFLICT' }, 409));
  const get = () => render(() => useWinStreakGame(ctx.args)); await get().actions.requestBotRematch();
  expect(ctx.args.createAccountBotRematch).toHaveBeenCalledOnce(); expect(ctx.args.navigateToGame).not.toHaveBeenCalled();
  expect(get().viewModel.reset).toMatchObject({ error: ACCOUNT_STREAK_CONFLICT, retryAvailable: true }); h.runtime.dispose();
});

test('guest menu entry, create, observation, rematch and restart retain counts and make zero account streak requests', async () => {
  const fetchSpy = vi.fn(async (_path: string) => json({}));
  const h = runtimeHarness(new WinStreakProfileStore(null), createAccountStreakApi(fetchSpy));
  const menu = menuArgs(h); const getMenu = () => render(() => useWinStreakMenu(menu));
  getMenu().actions.onEnterPlayComputer();
  expect(await getMenu().requestComputerGame({ timed: false })).toBe('NEW');
  expect(menu.createComputerGameRequest).toHaveBeenCalledExactlyOnceWith({ timed: false }, 0);
  expect(menu.createAccountComputerGameRequest).not.toHaveBeenCalled();
  const win = publicGameState({ gameId: 'NEW', status: 'finished', winner: 'human', appliedCount: 0 });
  await observeAuthoritativeWinStreakGame(h.guest, projectAuthoritativeWinStreakGame(win)!, { allowDiscovery: false });
  expect(h.guest.getSnapshot().currentCount).toBe(1);
  hooks.reset(); const ctx = gameArgs(h); ctx.args.effectiveGameId = 'NEW'; ctx.setGame(win);
  ctx.args.createBotRematch.mockResolvedValue(json({ gameId: 'SOURCE' }));
  await render(() => useWinStreakGame(ctx.args)).actions.requestBotRematch();
  expect(ctx.args.createBotRematch).toHaveBeenCalledExactlyOnceWith('NEW', 1);
  hooks.reset(); ctx.args.effectiveGameId = 'SOURCE'; ctx.setGame(publicGameState({ gameId: 'SOURCE', appliedCount: 1, canRestart: true }));
  await render(() => useWinStreakGame(ctx.args)).actions.resetWinStreak();
  expect(ctx.args.resetWinStreak).toHaveBeenCalledExactlyOnceWith('SOURCE');
  expect(h.guest.getSnapshot().currentCount).toBe(0);
  expect(fetchSpy.mock.calls.filter(([path]) => path.startsWith('/accounts/streak/'))).toHaveLength(0);
  expect(fetchSpy).not.toHaveBeenCalled(); h.runtime.dispose();
});

test('pending carry-over blocks in-game Reset before resignation or restart dispatch', async () => {
  const guest = new WinStreakProfileStore(null); await trackedGuest(guest);
  const h = runtimeHarness(guest); h.api.import.mockResolvedValue({ kind: 'error', code: 'STREAK_IMPORT_UNVERIFIED' });
  await h.signIn(); const ctx = gameArgs(h);
  const get = () => render(() => useWinStreakGame(ctx.args));
  expect(get().viewModel.reset.canSubmit).toBe(false);
  await get().actions.resetWinStreak(); expect(ctx.args.resignGame).not.toHaveBeenCalled();
  expect(ctx.args.createAccountBotRematch).not.toHaveBeenCalled(); expect(ctx.args.resetAccountWinStreak).not.toHaveBeenCalled(); h.runtime.dispose();
});

test('a failed completed restart refresh is not repeated by subsequent game observations', async () => {
  const h = runtimeHarness(); await h.signIn(); const ctx = gameArgs(h);
  const state = () => publicGameState({ gameId: 'SOURCE', status: 'finished', reason: 'restart', restartLifecycle: {
    kind: 'source', status: 'completed', sourceGameId: 'SOURCE', replacementGameId: 'NEW' } });
  h.api.state.mockResolvedValueOnce({ kind: 'unavailable' }); ctx.setGame(state());
  const get = () => render(() => useWinStreakGame(ctx.args)); get();
  await vi.waitFor(() => expect(get().viewModel.reset.retryAvailable).toBe(true));
  ctx.setGame(state()); get(); ctx.setGame(state()); get();
  expect(h.api.state).toHaveBeenCalledTimes(2); expect(ctx.args.navigateToGame).not.toHaveBeenCalled();
  await get().actions.resetWinStreak(); expect(ctx.args.resetAccountWinStreak).toHaveBeenCalledOnce();
  expect(ctx.args.navigateToGame).toHaveBeenCalledExactlyOnceWith('NEW'); h.runtime.dispose();
});

test('logout during account restart recovery neither navigates nor registers a guest replacement', async () => {
  const h = runtimeHarness(); await h.signIn(); const ctx = gameArgs(h); const gate = deferred<any>();
  h.api.state.mockImplementationOnce(() => gate.promise);
  ctx.setGame(publicGameState({ gameId: 'SOURCE', status: 'finished', reason: 'restart', restartLifecycle: {
    kind: 'source', status: 'completed', sourceGameId: 'SOURCE', replacementGameId: 'NEW' } }));
  const get = () => render(() => useWinStreakGame(ctx.args)); get();
  h.accounts.set({ ...h.accounts.getSnapshot(), status: 'signedOut' } as any); get();
  gate.resolve({ kind: 'ok', data: { ok: true, streak: streak() } });
  await vi.waitFor(() => expect(get().viewModel.reset.busy).toBe(false));
  expect(ctx.args.navigateToGame).not.toHaveBeenCalled(); expect(h.guest.getSnapshot().trackedGame).toBeNull();
  expect(h.guest.getSnapshot().currentCount).toBe(0); h.runtime.dispose();
});

test.each(['STREAK_IMPORT_UNVERIFIED', 'STREAK_GAME_NOT_FOUND'])(
  '%s uses only the carry-over notice, including after Retry', async code => {
    const guest = new WinStreakProfileStore(null); await trackedGuest(guest);
    const h = runtimeHarness(guest); h.api.import.mockResolvedValue({ kind: 'error', code }); await h.signIn();
    const args = menuArgs(h), get = () => render(() => useWinStreakMenu(args));
    expect(get().viewModel).toMatchObject({ carryOver: { guestCount: 4, accountCount: 3 },
      createDisabled: true, reset: { error: null }, rejoinCandidate: null });
    await get().actions.onRetryCarryOver!();
    expect(get().viewModel.reset.error).toBeNull();
    expect(get().viewModel.carryOver).toBeDefined();
    h.runtime.dispose();
  },
);

test('a proof refusal after an outage clears stale button feedback while retaining the notice', async () => {
  const guest = new WinStreakProfileStore(null); await trackedGuest(guest);
  const h = runtimeHarness(guest); h.api.state.mockResolvedValueOnce({ kind: 'unavailable' }); await h.signIn();
  const args = menuArgs(h), get = () => render(() => useWinStreakMenu(args));
  await get().requestComputerGame({ timed: false }).catch(() => undefined);
  expect(get().viewModel.reset.error).toBe(ACCOUNT_STREAK_UNAVAILABLE);
  h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_GAME_NOT_FOUND' });
  await get().actions.onRetryCarryOver!();
  expect(get().viewModel).toMatchObject({ createDisabled: true, reset: { error: null }, carryOver: { guestCount: 4 } });
  h.api.import.mockResolvedValueOnce({ kind: 'error', code: 'STREAK_GAME_NOT_FOUND' });
  await get().actions.onKeepAccountStreak!();
  expect(get().viewModel.carryOver).toBeUndefined(); expect(get().viewModel.reset.error).toBeNull();
  expect(get().viewModel.createDisabled).toBe(false);
  h.runtime.dispose();
});

test('an account restart authority refusal does not use outage copy', async () => {
  const h = runtimeHarness(); await h.signIn(); const ctx = gameArgs(h, true);
  ctx.args.resetAccountWinStreak.mockResolvedValue(json({ error: 'STREAK_SEAT_FORBIDDEN' }, 403));
  const get = () => render(() => useWinStreakGame(ctx.args)); await get().actions.resetWinStreak();
  expect(get().viewModel.reset.error).toBe(ACCOUNT_STREAK_ACTION_FAILED);
  expect(ctx.args.navigateToGame).not.toHaveBeenCalled(); h.runtime.dispose();
});
