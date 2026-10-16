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
import {
  acceptedIntentState,
  legacyInternalGameState,
  publicGameState,
} from './fixtures';

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

Deno.test('real public controller projection identifies the participating human and bot', () => {
  const projected = projectAuthoritativeWinStreakGame(publicGameState({
    gameId: 'PUBLIC',
    appliedCount: 3,
  }));
  assert(projected);
  assert(projected.humanPlayerId === 'human');
  assert(projected.botPlayerId === 'bot');
  assert(projected.appliedBonusCount === 3);
  assert(projected.appliedBonusRecipientPlayerId === 'bot');
});

Deno.test('public controllers take precedence while requester-less intent and legacy states stay compatible', () => {
  const preferredPublic = publicGameState({ gameId: 'PREFERRED' });
  preferredPublic.controllersByPlayerId.human = { kind: 'human' };
  assert(projectAuthoritativeWinStreakGame(preferredPublic));

  const contradictoryPublic = publicGameState({ gameId: 'CONTRADICTORY' });
  contradictoryPublic.controllersByPlayerId.human = { kind: 'human' };
  contradictoryPublic.publicState.controllersByPlayerId.human = { kind: 'human' };
  assert(projectAuthoritativeWinStreakGame(contradictoryPublic) === null);

  const intent = projectAuthoritativeWinStreakGame(acceptedIntentState({
    gameId: 'INTENT',
  }), 'human');
  assert(intent?.humanPlayerId === 'human');
  assert(projectAuthoritativeWinStreakGame(acceptedIntentState({ gameId: 'NO-IDENTITY' })) === null);

  const legacy = projectAuthoritativeWinStreakGame(legacyInternalGameState({
    gameId: 'LEGACY',
  }));
  assert(legacy?.humanPlayerId === 'human');
});

Deno.test('spectators, extra players, and non-bot opponents are excluded', () => {
  const spectator = publicGameState({ gameId: 'SPECTATOR', requesterPlayerId: 'spectator' });
  spectator.publicState.players.push({ id: 'spectator', role: 'spectator' });
  assert(projectAuthoritativeWinStreakGame(spectator) === null);

  const extraPlayer = publicGameState({ gameId: 'EXTRA' });
  extraPlayer.publicState.players.push({ id: 'third', role: 'player' });
  extraPlayer.publicState.controllersByPlayerId.third = { kind: 'player' };
  assert(projectAuthoritativeWinStreakGame(extraPlayer) === null);

  const nonBotOpponent = publicGameState({ gameId: 'NON-BOT' });
  nonBotOpponent.publicState.controllersByPlayerId.bot = { kind: 'player' };
  assert(projectAuthoritativeWinStreakGame(nonBotOpponent) === null);
});

Deno.test('positive ordinary loss saves ended streak atomically and duplicate settlement is inert', async () => {
  const store = await seededStore(5);
  const loss = projectAuthoritativeWinStreakGame(publicGameState({
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
    const loss = projectAuthoritativeWinStreakGame(publicGameState({
      gameId: reason, status: 'finished', winner: 'bot', reason,
    }), 'human');
    assert(loss);
    await observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: false });
    assert(store.getSnapshot().currentCount === 0);
    assert(store.getSnapshot().endedStreak?.count === 3);
    assert(store.getSnapshot().endedStreak?.endingGameId === reason);
  }
  const zero = await seededStore(0, 'ZERO');
  const zeroLoss = projectAuthoritativeWinStreakGame(publicGameState({
    gameId: 'ZERO', status: 'finished', winner: 'bot', reason: 'decisive',
  }), 'human');
  assert(zeroLoss);
  await observeAuthoritativeWinStreakGame(zero, zeroLoss, { allowDiscovery: false });
  assert(zero.getSnapshot().endedStreak === null);
});

Deno.test('win increments, draw preserves, and restart is neutral', async () => {
  const winStore = await seededStore(2, 'WIN');
  const win = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'WIN', status: 'finished', winner: 'human', reason: 'decisive' }), 'human');
  assert(win);
  await observeAuthoritativeWinStreakGame(winStore, win, { allowDiscovery: false });
  assert(winStore.getSnapshot().currentCount === 3);

  const drawStore = await seededStore(2, 'DRAW');
  const draw = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'DRAW', status: 'finished', winner: null, reason: 'agreement' }), 'human');
  assert(draw);
  await observeAuthoritativeWinStreakGame(drawStore, draw, { allowDiscovery: false });
  assert(drawStore.getSnapshot().currentCount === 2);

  const restartStore = await seededStore(2, 'RESTART');
  const restart = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'RESTART', status: 'finished', winner: null, reason: 'restart' }), 'human');
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
  const multiplayer = publicGameState({ gameId: 'MULTI' });
  multiplayer.publicState.controllersByPlayerId.bot = { kind: 'player' };
  assert(projectAuthoritativeWinStreakGame(multiplayer, 'human') === null);
  assert(store.getSnapshot().currentCount === 3);
  assert(store.getSnapshot().endedStreak?.endingGameId === 'OLD');

  await store.mutate((profile) => { profile.automaticEnrollmentSealed = true; });
  const botGame = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'SEALED' }), 'human');
  assert(botGame);
  const observed = await observeAuthoritativeWinStreakGame(store, botGame, { allowDiscovery: true });
  assert(observed === 'ignored');
  assert(store.getSnapshot().trackedGame === null);
});

Deno.test('automatic discovery requires the server-applied bonus to match progression', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 4; });
  const mismatched = projectAuthoritativeWinStreakGame(publicGameState({
    gameId: 'OLD', appliedCount: 0,
  }), 'human');
  assert(mismatched);
  const ignored = await observeAuthoritativeWinStreakGame(store, mismatched, { allowDiscovery: true });
  assert(ignored === 'ignored');
  assert(store.getSnapshot().trackedGame === null);

  const matching = projectAuthoritativeWinStreakGame(publicGameState({
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
  const win = projectAuthoritativeWinStreakGame(publicGameState({
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
  const loss = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'A', status: 'finished', winner: 'bot', reason: 'timeout' }), 'human');
  assert(loss);
  await observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: false });
  const matching = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(), game: loss, resetBusy: false, resetError: null,
    resetRetryAvailable: false,
  });
  assert(matching.streakState === 'ended' && matching.displayCount === 5);
  const unrelated = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'OTHER' }), 'human');
  assert(unrelated);
  const hidden = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(), game: unrelated, resetBusy: false, resetError: null,
    resetRetryAvailable: false,
  });
  assert(hidden.streakState === 'hidden');
  await resetWinStreakFromMenu(store);
  await observeAuthoritativeWinStreakGame(store, loss, { allowDiscovery: true });
  assert(store.getSnapshot().endedStreak === null);
});

Deno.test('in-game reset eligibility requires unfinished source without restart recovery', async () => {
  const store = await seededStore(2);
  const active = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'A', canRestart: false }), 'human');
  assert(active);
  const activeVm = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(), game: active, resetBusy: false, resetError: null,
    resetRetryAvailable: false,
  });
  assert(activeVm.reset.canSubmit);

  for (const status of ['pending', 'completed'] as const) {
    const recovering = projectAuthoritativeWinStreakGame(publicGameState({
      gameId: 'A',
      restartLifecycle: {
        kind: 'source',
        status,
        sourceGameId: 'A',
        replacementGameId: 'B',
      },
    }), 'human');
    assert(recovering);
    const recoveryVm = deriveWinStreakGameViewModel({
      profile: store.getSnapshot(), game: recovering, resetBusy: false, resetError: null,
      resetRetryAvailable: false,
    });
    assert(!recoveryVm.reset.canSubmit);
  }

  const finished = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'A', status: 'finished' }), 'human');
  assert(finished);
  const finishedVm = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(), game: finished, resetBusy: false, resetError: null,
    resetRetryAvailable: false,
  });
  assert(!finishedVm.reset.canSubmit);
});

Deno.test('retired A cannot re-enrol after B replaces and completes', async () => {
  const store = await seededStore(2, 'A');
  await resetWinStreakFromMenu(store);
  const reservation = await reserve(store, 'create', null);
  await completeBotGameCreation(store, reservation, 'B', 'human');
  const bWin = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'B', status: 'finished', winner: 'human', reason: 'decisive' }), 'human');
  assert(bWin);
  await observeAuthoritativeWinStreakGame(store, bWin, { allowDiscovery: false });
  const reopenedA = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'A' }), 'human');
  assert(reopenedA);
  await observeAuthoritativeWinStreakGame(store, reopenedA, { allowDiscovery: true });
  assert(store.getSnapshot().trackedGame?.gameId === 'B');
  assert(store.getSnapshot().retiredGameIds.includes('A'));
});
