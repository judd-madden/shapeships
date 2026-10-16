declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  deriveWinStreakGameViewModel,
  observeAuthoritativeWinStreakGame,
  projectAuthoritativeWinStreakGame,
  registerTrackedGameDraft,
} from '../../winStreak/authoritative';
import { WinStreakProfileStore, type ExclusiveRunner, type StorageLike } from '../../winStreak/profile';
import {
  completeBotGameCreation,
  completeWinStreakRestart,
  failBotGameCreation,
  reserveBotGameCreation,
  resetWinStreakFromMenu,
} from '../../winStreak/workflow';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function serialRunner(): ExclusiveRunner {
  let queue: Promise<unknown> = Promise.resolve();
  return async <T>(work: () => T | Promise<T>) => {
    const run = queue.then(work, work);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}

function state(args: {
  gameId: string;
  status?: 'active' | 'finished';
  winner?: string | null;
  reason?: string | null;
  canRestart?: boolean;
  appliedCount?: number;
}) {
  return {
    gameId: args.gameId,
    status: args.status ?? 'active',
    turnNumber: 1,
    players: [
      { id: 'human', role: 'player' },
      { id: 'bot', role: 'player' },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: { kind: 'bot' },
    },
    gameData: {
      turnNumber: 1,
      winStreakBonus: { appliedCount: args.appliedCount ?? 0, recipientPlayerId: 'bot' },
    },
    requester: {
      playerId: 'human',
      winStreakReset: { canRestart: args.canRestart === true, lifecycle: null },
    },
    result: {
      winnerPlayerId: args.winner ?? null,
      resultReason: args.reason ?? null,
    },
  };
}

async function seededStore(count: number, gameId = 'A') {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = count;
    registerTrackedGameDraft(profile, gameId, 'human');
  });
  return store;
}

function preflight(store: WinStreakProfileStore) {
  const profile = store.getSnapshot();
  return {
    generation: profile.generation,
    trackedGameId: profile.trackedGame?.gameId ?? null,
    trackedGameStatus: profile.trackedGame?.status ?? null,
  };
}

async function reserve(store: WinStreakProfileStore, kind: 'create' | 'rematch', source: string | null) {
  const result = await reserveBotGameCreation(store, kind, source, preflight(store));
  assert(result.kind === 'reserved');
  return result.reservation;
}

const emptyCreation = {
  status: 'idle' as const,
  busy: false,
  error: null,
  recoveryGameId: null,
  requiresExplicitRelease: false,
};
const emptyUnfinished = {
  status: 'none' as const,
  gameId: null,
  rejoinUrl: null,
  canRejoin: false,
  canConfirmAbandonment: false,
  error: null,
};

Deno.test('positive ordinary loss saves ended streak atomically and duplicate settlement is inert', async () => {
  const store = await seededStore(5);
  const loss = projectAuthoritativeWinStreakGame(state({
    gameId: 'A', status: 'finished', winner: 'bot', reason: 'decisive', appliedCount: 5,
  }), 'human');
  assert(loss);
  await Promise.all([
    observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: false }),
    observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: false }),
  ]);
  assert(store.getSnapshot().currentCount === 0);
  assert(store.getSnapshot().endedStreak?.count === 5);
  assert(store.getSnapshot().endedStreak?.endingGameId === 'A');
});

Deno.test('resignation and timeout losses end positive streaks while a zero streak creates no snapshot', async () => {
  for (const reason of ['resignation', 'timeout']) {
    const store = await seededStore(3, reason);
    const loss = projectAuthoritativeWinStreakGame(state({
      gameId: reason, status: 'finished', winner: 'bot', reason,
    }), 'human');
    assert(loss);
    await observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: false });
    assert(store.getSnapshot().endedStreak?.count === 3);
  }
  const zero = await seededStore(0, 'ZERO');
  const zeroLoss = projectAuthoritativeWinStreakGame(state({
    gameId: 'ZERO', status: 'finished', winner: 'bot', reason: 'decisive',
  }), 'human');
  assert(zeroLoss);
  await observeAuthoritativeWinStreakGame(zero, zeroLoss, { allowDiscovery: false });
  assert(zero.getSnapshot().endedStreak === null);
});

Deno.test('win increments, draw preserves, and restart is neutral', async () => {
  const winStore = await seededStore(2, 'WIN');
  const win = projectAuthoritativeWinStreakGame(state({ gameId: 'WIN', status: 'finished', winner: 'human', reason: 'decisive' }), 'human');
  assert(win);
  await observeAuthoritativeWinStreakGame(winStore, win, { allowDiscovery: false });
  assert(winStore.getSnapshot().currentCount === 3);

  const drawStore = await seededStore(2, 'DRAW');
  const draw = projectAuthoritativeWinStreakGame(state({ gameId: 'DRAW', status: 'finished', winner: null, reason: 'agreement' }), 'human');
  assert(draw);
  await observeAuthoritativeWinStreakGame(drawStore, draw, { allowDiscovery: false });
  assert(drawStore.getSnapshot().currentCount === 2);

  const restartStore = await seededStore(2, 'RESTART');
  const restart = projectAuthoritativeWinStreakGame(state({ gameId: 'RESTART', status: 'finished', winner: null, reason: 'restart' }), 'human');
  assert(restart);
  await observeAuthoritativeWinStreakGame(restartStore, restart, { allowDiscovery: false });
  assert(restartStore.getSnapshot().currentCount === 2);
  assert(restartStore.getSnapshot().endedStreak === null);
});

Deno.test('successful creation clears ended snapshot while failed/uncompleted reservation does not', async () => {
  const store = await seededStore(5);
  await store.mutate((profile) => {
    profile.currentCount = 0;
    profile.endedStreak = { count: 5, endingGameId: 'A' };
  });
  const reservation = await reserve(store, 'create', null);
  assert(store.getSnapshot().endedStreak?.count === 5);
  await failBotGameCreation(store, reservation, { ambiguous: true, error: 'lost response' });
  assert(store.getSnapshot().endedStreak?.count === 5);
  await store.mutate((profile) => { profile.creationReservation = null; });
  const retryReservation = await reserve(store, 'create', null);
  await completeBotGameCreation(store, retryReservation, 'B', 'new-human');
  assert(store.getSnapshot().endedStreak === null);
  assert(store.getSnapshot().trackedGame?.humanPlayerId === 'new-human');
});

Deno.test('confirmed restart clears ended presentation and registers a neutral replacement', async () => {
  const store = await seededStore(4, 'SOURCE');
  await store.mutate((profile) => {
    profile.endedStreak = { count: 4, endingGameId: 'OLDER' };
  });
  await completeWinStreakRestart(store, 'SOURCE', 'REPLACEMENT', 'post-recovery-human');
  assert(store.getSnapshot().currentCount === 0);
  assert(store.getSnapshot().endedStreak === null);
  assert(store.getSnapshot().trackedGame?.gameId === 'REPLACEMENT');
  assert(store.getSnapshot().trackedGame?.humanPlayerId === 'post-recovery-human');
  assert(store.getSnapshot().retiredGameIds.includes('SOURCE'));
});

Deno.test('multiplayer projection is ignored and sealed discovery cannot enrol a game', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 3;
    profile.endedStreak = { count: 2, endingGameId: 'OLD' };
  });
  const multiplayer = state({ gameId: 'MULTI' });
  multiplayer.controllersByPlayerId.bot = { kind: 'human' };
  assert(projectAuthoritativeWinStreakGame(multiplayer, 'human') === null);
  assert(store.getSnapshot().currentCount === 3);
  assert(store.getSnapshot().endedStreak?.endingGameId === 'OLD');

  await store.mutate((profile) => { profile.automaticEnrollmentSealed = true; });
  const botGame = projectAuthoritativeWinStreakGame(state({ gameId: 'SEALED' }), 'human');
  assert(botGame);
  const observed = await observeAuthoritativeWinStreakGame(store, botGame, { allowDiscovery: true });
  assert(observed === 'ignored');
  assert(store.getSnapshot().trackedGame === null);
});

Deno.test('automatic discovery requires the server-applied bonus to match progression', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 4; });
  const mismatched = projectAuthoritativeWinStreakGame(state({
    gameId: 'OLD', appliedCount: 0,
  }), 'human');
  assert(mismatched);
  const ignored = await observeAuthoritativeWinStreakGame(store, mismatched, { allowDiscovery: true });
  assert(ignored === 'ignored');
  assert(store.getSnapshot().trackedGame === null);

  const matching = projectAuthoritativeWinStreakGame(state({
    gameId: 'NEXT', appliedCount: 4,
  }), 'human');
  assert(matching);
  const enrolled = await observeAuthoritativeWinStreakGame(store, matching, { allowDiscovery: true });
  assert(enrolled === 'enrolled');
  assert(store.getSnapshot().trackedGame?.gameId === 'NEXT');
});

Deno.test('shared cross-tab lock settles a terminal result exactly once', async () => {
  const storage = new FakeStorage();
  const runner = serialRunner();
  const firstTab = new WinStreakProfileStore(storage, runner);
  const secondTab = new WinStreakProfileStore(storage, runner);
  await firstTab.mutate((profile) => {
    profile.currentCount = 2;
    registerTrackedGameDraft(profile, 'LOCKED', 'human');
  });
  const win = projectAuthoritativeWinStreakGame(state({
    gameId: 'LOCKED', status: 'finished', winner: 'human', reason: 'decisive',
  }), 'human');
  assert(win);
  await Promise.all([
    observeAuthoritativeWinStreakGame(firstTab, win, { allowDiscovery: false }),
    observeAuthoritativeWinStreakGame(secondTab, win, { allowDiscovery: false }),
  ]);
  const reloaded = new WinStreakProfileStore(storage, runner);
  assert(reloaded.getSnapshot().currentCount === 3);
});

Deno.test('ended game presentation is scoped to its game and explicit reset prevents resurrection', async () => {
  const store = await seededStore(5);
  const loss = projectAuthoritativeWinStreakGame(state({ gameId: 'A', status: 'finished', winner: 'bot', reason: 'timeout' }), 'human');
  assert(loss);
  await observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: false });
  const matching = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(), game: loss, resetBusy: false, resetError: null,
    resetRetryAvailable: false, creation: emptyCreation, unfinishedGame: emptyUnfinished,
  });
  assert(matching.streakState === 'ended' && matching.displayCount === 5);
  const unrelated = projectAuthoritativeWinStreakGame(state({ gameId: 'OTHER' }), 'human');
  assert(unrelated);
  const hidden = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(), game: unrelated, resetBusy: false, resetError: null,
    resetRetryAvailable: false, creation: emptyCreation, unfinishedGame: emptyUnfinished,
  });
  assert(hidden.streakState === 'hidden');
  await resetWinStreakFromMenu(store);
  await observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: true });
  assert(store.getSnapshot().endedStreak === null);
});

Deno.test('retired A cannot re-enrol after B replaces and completes', async () => {
  const store = await seededStore(2, 'A');
  await resetWinStreakFromMenu(store);
  const reservation = await reserve(store, 'create', null);
  await completeBotGameCreation(store, reservation, 'B', 'human');
  const bWin = projectAuthoritativeWinStreakGame(state({ gameId: 'B', status: 'finished', winner: 'human', reason: 'decisive' }), 'human');
  assert(bWin);
  await observeAuthoritativeWinStreakGame(store, bWin, { allowDiscovery: false });
  const reopenedA = projectAuthoritativeWinStreakGame(state({ gameId: 'A' }), 'human');
  assert(reopenedA);
  await observeAuthoritativeWinStreakGame(store, reopenedA, { allowDiscovery: true });
  assert(store.getSnapshot().trackedGame?.gameId === 'B');
  assert(store.getSnapshot().retiredGameIds.includes('A'));
});
