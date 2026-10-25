import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { observeAuthoritativeWinStreakGame, projectAuthoritativeWinStreakGame, registerTrackedGameDraft } from '../../winStreak/authoritative';
import { WinStreakProfileStore } from '../../winStreak/profile';
import { useWinStreakGame, type WinStreakResignationResult } from '../../winStreak/useWinStreakGame';
import { recoverCreatedBotGame } from '../../winStreak/workflow';
import { acceptedIntentState, publicGameState } from './fixtures';

// Exercise the production hook and store in Node using the repo's hook-double pattern.
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
function loss() {
  return publicGameState({ gameId: 'SOURCE', appliedCount: 3, status: 'finished', winner: 'bot', reason: 'surrender' });
}

async function setup(canRestart = false) {
  const store = new WinStreakProfileStore(null);
  await store.mutate((profile) => {
    profile.currentCount = 3;
    registerTrackedGameDraft(profile, 'SOURCE', 'human');
  });
  let liveGame = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'SOURCE', appliedCount: 3, canRestart }));
  const args = {
    effectiveGameId: 'SOURCE', effectivePlayerName: 'Player name', humanPlayerId: 'human',
    authoritativeGame: liveGame,
    getLatestAuthoritativeGame: () => liveGame,
    resignGame: vi.fn(async (_source: string): Promise<WinStreakResignationResult> => ({ ok: true, state: loss() })),
    isResigning: vi.fn(() => false),
    awaitPendingObservation: vi.fn(async () => {}),
    getGameState: vi.fn(async (_source: string): Promise<Response> => json(loss())),
    createBotRematch: vi.fn(async (_source: string, _count: number) => json({ gameId: 'REPLACEMENT' })),
    resetWinStreak: vi.fn(async (_source: string) => json({
      gameId: 'REPLACEMENT', sourceGameId: 'SOURCE', resetStatus: 'completed',
    })),
    getCurrentHumanPlayerId: vi.fn(async (_name: string) => 'human'),
    refreshGameStateOnce: vi.fn(async () => {}),
    navigateToGame: vi.fn((_id: string) => {}), store,
  };
  const render = () => { hooks.begin(); const result = useWinStreakGame(args); hooks.flush(); return result; };
  return {
    args, store, render,
    setGame: (state: any, updatePresentation = true) => {
      liveGame = projectAuthoritativeWinStreakGame(state);
      if (updatePresentation) args.authoritativeGame = liveGame;
    },
  };
}

beforeEach(() => { hooks.reset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { hooks.reset(); vi.restoreAllMocks(); });

test('early Reset reads latest server eligibility and registers its dedicated zero-streak replacement', async () => {
  const ctx = await setup();
  const { args, store, render } = ctx;
  const { actions } = render();
  const selectingSpecies = publicGameState({ gameId: 'SOURCE', appliedCount: 3, canRestart: true });
  selectingSpecies.meta.phaseKey = 'setup.species_selection';
  ctx.setGame(selectingSpecies, false);
  await actions.resetWinStreak();
  expect(args.resetWinStreak).toHaveBeenCalledExactlyOnceWith('SOURCE');
  expect(args.resignGame).not.toHaveBeenCalled();
  expect(args.createBotRematch).not.toHaveBeenCalled();
  expect(args.navigateToGame).toHaveBeenCalledExactlyOnceWith('REPLACEMENT');
  expect(store.getSnapshot().currentCount).toBe(0);
  expect(store.getSnapshot().trackedGame).toMatchObject({ gameId: 'REPLACEMENT', humanPlayerId: 'human' });
});

test('later Reset waits for resignation, pending observation and authoritative reconciliation before creating', async () => {
  const { args, store, render } = await setup();
  const resignation = deferred<WinStreakResignationResult>();
  const observation = deferred<void>();
  const reconciliation = deferred<Response>();
  args.resignGame.mockImplementation(() => resignation.promise);
  args.awaitPendingObservation.mockResolvedValueOnce(undefined).mockImplementationOnce(() => observation.promise);
  args.getGameState.mockImplementation(() => reconciliation.promise);
  args.createBotRematch.mockImplementation(async (_source, count) => {
    expect(count).toBe(0);
    expect(store.getSnapshot().currentCount).toBe(0);
    expect(store.getSnapshot().trackedGame?.status).toBe('settled');
    return json({ gameId: 'REPLACEMENT' });
  });
  const { actions } = render();
  const pending = actions.resetWinStreak();
  await vi.waitFor(() => expect(args.resignGame).toHaveBeenCalledOnce());
  expect(render().viewModel.reset.busy).toBe(true);
  await actions.resetWinStreak();
  await actions.requestBotRematch();
  expect(args.resignGame).toHaveBeenCalledOnce();
  expect(args.createBotRematch).not.toHaveBeenCalled();
  expect(args.getGameState).not.toHaveBeenCalled();
  resignation.resolve({ ok: true, state: acceptedIntentState({
    gameId: 'SOURCE', status: 'finished', winner: 'bot', reason: 'surrender', appliedCount: 3,
  }) });
  await vi.waitFor(() => expect(args.awaitPendingObservation).toHaveBeenCalledTimes(2));
  expect(args.getGameState).not.toHaveBeenCalled();
  observation.resolve();
  await vi.waitFor(() => expect(args.getGameState).toHaveBeenCalledExactlyOnceWith('SOURCE'));
  expect(args.createBotRematch).not.toHaveBeenCalled();
  expect(args.navigateToGame).not.toHaveBeenCalled();
  reconciliation.resolve(json(loss()));
  await pending;
  expect(args.resetWinStreak).not.toHaveBeenCalled();
  expect(args.createBotRematch).toHaveBeenCalledExactlyOnceWith('SOURCE', 0);
  expect(args.getCurrentHumanPlayerId).toHaveBeenCalledExactlyOnceWith('Player name');
  expect(args.navigateToGame).toHaveBeenCalledExactlyOnceWith('REPLACEMENT');
  expect(store.getSnapshot().trackedGame?.gameId).toBe('REPLACEMENT');
  expect(render().viewModel.reset.busy).toBe(false);
});

test('later Reset reconciles again when the intent observation already settled the loss', async () => {
  const { args, store, render } = await setup();
  args.awaitPendingObservation.mockResolvedValueOnce(undefined).mockImplementationOnce(async () => {
    await observeAuthoritativeWinStreakGame(store, projectAuthoritativeWinStreakGame(loss())!, { allowDiscovery: false });
  });
  await render().actions.resetWinStreak();
  expect(args.getGameState).toHaveBeenCalledOnce();
  expect(args.createBotRematch).toHaveBeenCalledExactlyOnceWith('SOURCE', 0);
});

test.each(['HTTP failure', 'rejected intent', 'missing game', 'duplicate resignation', 'exception'])(
  'resignation %s prevents creation and navigation', async (failure) => {
    const { args, store, render } = await setup();
    if (failure === 'exception') args.resignGame.mockRejectedValue(new Error(failure));
    else args.resignGame.mockResolvedValue({ ok: false, error: failure });
    await render().actions.resetWinStreak();
    expect(args.getGameState).not.toHaveBeenCalled();
    expect(args.createBotRematch).not.toHaveBeenCalled();
    expect(args.navigateToGame).not.toHaveBeenCalled();
    expect(store.getSnapshot().currentCount).toBe(3);
    expect(render().viewModel.reset).toMatchObject({ error: failure, busy: false, retryAvailable: false });
  },
);

test.each([
  {},
  publicGameState({ gameId: 'OTHER', status: 'finished', winner: 'bot' }),
  publicGameState({ gameId: 'SOURCE', humanPlayerId: 'different-human', status: 'finished', winner: 'bot' }),
  publicGameState({ gameId: 'SOURCE' }),
  publicGameState({ gameId: 'SOURCE', status: 'finished', winner: 'human' }),
  publicGameState({ gameId: 'SOURCE', status: 'finished', reason: 'agreement' }),
])('invalid accepted resignation state blocks the next game (%#)', async (state) => {
  const { args, render } = await setup();
  args.resignGame.mockResolvedValue({ ok: true, state });
  await render().actions.resetWinStreak();
  expect(args.createBotRematch).not.toHaveBeenCalled();
  expect(args.navigateToGame).not.toHaveBeenCalled();
  expect(render().viewModel.reset.error).toContain('did not confirm');
});

test.each(['http', 'network', 'malformed', 'unfinished', 'profile changed', 'observation failed'])(
  'reconciliation %s prevents creation/navigation', async (failure) => {
    const { args, store, render } = await setup();
    if (failure === 'http') args.getGameState.mockResolvedValue(new Response(null, { status: 503 }));
    if (failure === 'network') args.getGameState.mockRejectedValue(new Error('network'));
    if (failure === 'malformed') args.getGameState.mockResolvedValue(new Response('{'));
    if (failure === 'unfinished') args.getGameState.mockResolvedValue(json(publicGameState({ gameId: 'SOURCE' })));
    if (failure === 'profile changed') args.getGameState.mockImplementation(async () => {
      await store.mutate((profile) => registerTrackedGameDraft(profile, 'NEWER', 'human'));
      return json(loss());
    });
    if (failure === 'observation failed') args.awaitPendingObservation
      .mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('observation failed'));
    await render().actions.resetWinStreak();
    expect(args.createBotRematch).not.toHaveBeenCalled();
    expect(args.navigateToGame).not.toHaveBeenCalled();
    expect(store.getSnapshot().creationReservation).toBeNull();
    expect(render().viewModel.reset.error).toBeTruthy();
  },
);

test('changing games during resignation prevents replacement creation or navigation', async () => {
  const { args, render } = await setup();
  const gate = deferred<WinStreakResignationResult>();
  args.resignGame.mockImplementation(() => gate.promise);
  const pending = render().actions.resetWinStreak();
  await vi.waitFor(() => expect(args.resignGame).toHaveBeenCalledOnce());
  args.effectiveGameId = 'OTHER';
  render();
  gate.resolve({ ok: true, state: loss() });
  await pending;
  expect(args.createBotRematch).not.toHaveBeenCalled();
  expect(args.navigateToGame).not.toHaveBeenCalled();
});

test('changing games while creation acquires the profile lock cancels before dispatch', async () => {
  const { args, store, render } = await setup();
  const unsubscribe = store.subscribe(() => {
    if (store.getSnapshot().creationReservation?.status === 'creating') {
      args.effectiveGameId = 'OTHER';
      render();
    }
  });
  await render().actions.resetWinStreak();
  unsubscribe();
  expect(args.createBotRematch).not.toHaveBeenCalled();
  expect(args.navigateToGame).not.toHaveBeenCalled();
  expect(store.getSnapshot().creationReservation).toBeNull();
});

test.each(['http', 'network', 'malformed'])(
  'dedicated restart %s failure never falls through to resignation and remains recoverable', async (failure) => {
    const ctx = await setup(true);
    const { args, render } = ctx;
    if (failure === 'http') args.resetWinStreak.mockResolvedValueOnce(new Response(null, { status: 503 }));
    if (failure === 'network') args.resetWinStreak.mockRejectedValueOnce(new Error('lost response'));
    if (failure === 'malformed') args.resetWinStreak.mockResolvedValueOnce(json({ gameId: 'WRONG' }));
    await render().actions.resetWinStreak();
    expect(render().viewModel.reset.retryAvailable).toBe(true);
    expect(args.navigateToGame).not.toHaveBeenCalled();
    ctx.setGame(publicGameState({ gameId: 'SOURCE', appliedCount: 3, canRestart: false }));
    await render().actions.resetWinStreak();
    expect(args.resetWinStreak).toHaveBeenCalledTimes(2);
    expect(args.resignGame).not.toHaveBeenCalled();
    expect(args.createBotRematch).not.toHaveBeenCalled();
    expect(args.navigateToGame).toHaveBeenCalledExactlyOnceWith('REPLACEMENT');
  },
);

test('pending dedicated restart is retried even when normal restart eligibility is false', async () => {
  const ctx = await setup();
  ctx.setGame(publicGameState({ gameId: 'SOURCE', status: 'finished', reason: 'restart', restartLifecycle: {
    kind: 'source', status: 'pending', sourceGameId: 'SOURCE', replacementGameId: 'REPLACEMENT',
  } }));
  ctx.render();
  expect(ctx.render().viewModel.reset.retryAvailable).toBe(true);
  await ctx.render().actions.resetWinStreak();
  expect(ctx.args.resetWinStreak).toHaveBeenCalledOnce();
  expect(ctx.args.resignGame).not.toHaveBeenCalled();
  expect(ctx.args.navigateToGame).toHaveBeenCalledExactlyOnceWith('REPLACEMENT');
});

test('a dedicated eligibility rejection does not auto-resign; a new Reset follows the latest eligibility', async () => {
  const ctx = await setup(true);
  ctx.args.resetWinStreak.mockResolvedValueOnce(new Response('Not eligible', { status: 409 }));
  await ctx.render().actions.resetWinStreak();
  expect(ctx.args.resignGame).not.toHaveBeenCalled();
  expect(ctx.args.createBotRematch).not.toHaveBeenCalled();
  ctx.setGame(publicGameState({ gameId: 'SOURCE', appliedCount: 3, canRestart: false }));
  await ctx.render().actions.resetWinStreak();
  expect(ctx.args.resignGame).toHaveBeenCalledExactlyOnceWith('SOURCE');
  expect(ctx.args.createBotRematch).toHaveBeenCalledExactlyOnceWith('SOURCE', 0);
});

test('completed dedicated restart recovery excludes other submissions and navigates only once', async () => {
  const ctx = await setup();
  ctx.setGame(publicGameState({ gameId: 'SOURCE', status: 'finished', reason: 'restart', restartLifecycle: {
    kind: 'source', status: 'completed', sourceGameId: 'SOURCE', replacementGameId: 'REPLACEMENT',
  } }));
  const { actions } = ctx.render();
  await Promise.all([actions.resetWinStreak(), actions.requestBotRematch()]);
  await vi.waitFor(() => expect(ctx.args.navigateToGame).toHaveBeenCalledOnce());
  ctx.render();
  expect(ctx.args.resetWinStreak).not.toHaveBeenCalled();
  expect(ctx.args.createBotRematch).not.toHaveBeenCalled();
  expect(ctx.args.navigateToGame).toHaveBeenCalledExactlyOnceWith('REPLACEMENT');
  expect(ctx.store.getSnapshot().currentCount).toBe(0);
});

test('dedicated restart does not replace a newer tracked game after its response arrives', async () => {
  const { args, store, render } = await setup(true);
  args.resetWinStreak.mockImplementation(async () => {
    await store.mutate((profile) => registerTrackedGameDraft(profile, 'NEWER', 'human'));
    return json({ gameId: 'REPLACEMENT', sourceGameId: 'SOURCE', resetStatus: 'completed' });
  });
  await render().actions.resetWinStreak();
  expect(args.navigateToGame).not.toHaveBeenCalled();
  expect(store.getSnapshot().trackedGame?.gameId).toBe('NEWER');
});

test.each(['rejected', 'ambiguous', 'network', 'malformed'])(
  'later creation %s failure preserves existing reservation handling and prevents navigation', async (failure) => {
    const { args, store, render } = await setup();
    if (failure === 'rejected') args.createBotRematch.mockResolvedValue(new Response(null, { status: 400 }));
    if (failure === 'ambiguous') args.createBotRematch.mockResolvedValue(new Response(null, { status: 503 }));
    if (failure === 'network') args.createBotRematch.mockRejectedValue(new Error('lost response'));
    if (failure === 'malformed') args.createBotRematch.mockResolvedValue(json({}));
    await render().actions.resetWinStreak();
    await render().actions.resetWinStreak();
    expect(args.createBotRematch).toHaveBeenCalledExactlyOnceWith('SOURCE', 0);
    expect(args.navigateToGame).not.toHaveBeenCalled();
    expect(store.getSnapshot().creationReservation?.status).toBe(failure === 'rejected' ? undefined : 'ambiguous');
    expect(store.getSnapshot().currentCount).toBe(0);
  },
);

test('successful creation with failed identity recovery keeps the replacement for existing recovery', async () => {
  const { args, store, render } = await setup();
  args.getCurrentHumanPlayerId.mockRejectedValueOnce(new Error('identity lookup interrupted'));
  await render().actions.resetWinStreak();
  expect(args.navigateToGame).not.toHaveBeenCalled();
  expect(store.getSnapshot().creationReservation).toMatchObject({ status: 'stale_success', recoveryGameId: 'REPLACEMENT' });
  const recovered = await recoverCreatedBotGame(store, {
    getGameState: async () => json(publicGameState({ gameId: 'REPLACEMENT', appliedCount: 0 })),
  });
  expect(recovered.kind).toBe('recovered');
  expect(store.getSnapshot().trackedGame).toMatchObject({ gameId: 'REPLACEMENT', humanPlayerId: 'human' });
  expect(args.createBotRematch).toHaveBeenCalledOnce();
});

test('existing resignation and New Game submissions block Reset synchronously', async () => {
  const { args, render } = await setup();
  const { actions } = render();
  args.isResigning.mockReturnValue(true);
  await actions.resetWinStreak();
  expect(args.resignGame).not.toHaveBeenCalled();
  args.isResigning.mockReturnValue(false);
  const gate = deferred<void>();
  args.awaitPendingObservation.mockImplementation(() => gate.promise);
  const newGame = actions.requestBotRematch();
  await actions.resetWinStreak();
  expect(args.resignGame).not.toHaveBeenCalled();
  gate.resolve();
  await newGame;
});
