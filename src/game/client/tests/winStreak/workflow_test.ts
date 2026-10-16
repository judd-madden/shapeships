declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  observeAuthoritativeWinStreakGame,
  projectAuthoritativeWinStreakGame,
  registerTrackedGameDraft,
} from '../../winStreak/authoritative';
import {
  WinStreakProfileStore,
  type ExclusiveRunner,
  type StorageLike,
} from '../../winStreak/profile';
import {
  completeBotGameCreation,
  completeWinStreakRestart,
  creationViewModelFromReservation,
  failBotGameCreation,
  markBotGameCreationStarted,
  reconcileTrackedWinStreakGame,
  recordCreatedGameForRecovery,
  recoverCreatedBotGame,
  releaseCreationReservation,
  reserveAfterConfirmedAbandonment,
  reserveBotGameCreation,
} from '../../winStreak/workflow';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function serialRunner(onLockChange?: (locked: boolean) => void): ExclusiveRunner {
  let queue: Promise<unknown> = Promise.resolve();
  return async <T>(work: () => T | Promise<T>) => {
    const guarded = async () => {
      onLockChange?.(true);
      try {
        return await work();
      } finally {
        onLockChange?.(false);
      }
    };
    const run = queue.then(guarded, guarded);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}

function gameState(args: {
  gameId: string;
  status?: 'active' | 'finished';
  winner?: string | null;
  reason?: string | null;
  appliedCount?: number;
}) {
  return {
    gameId: args.gameId,
    status: args.status ?? 'active',
    turnNumber: 2,
    players: [
      { id: 'human', role: 'player' },
      { id: 'bot', role: 'player' },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: { kind: 'bot' },
    },
    requester: {
      playerId: 'human',
      winStreakReset: { canRestart: false, lifecycle: null },
    },
    gameData: {
      winStreakBonus: {
        appliedCount: args.appliedCount ?? 0,
        recipientPlayerId: 'bot',
      },
    },
    result: {
      winnerPlayerId: args.winner ?? null,
      resultReason: args.reason ?? null,
    },
  };
}

function preflight(store: WinStreakProfileStore) {
  const profile = store.getSnapshot();
  return {
    generation: profile.generation,
    trackedGameId: profile.trackedGame?.gameId ?? null,
    trackedGameStatus: profile.trackedGame?.status ?? null,
  };
}

async function reserve(
  store: WinStreakProfileStore,
  kind: 'create' | 'rematch' = 'create',
  sourceGameId: string | null = null,
) {
  const result = await reserveBotGameCreation(
    store,
    kind,
    sourceGameId,
    preflight(store),
  );
  assert(result.kind === 'reserved');
  return result.reservation;
}

Deno.test('shared lock lets only one tab reserve the same streak generation', async () => {
  const storage = new FakeStorage();
  const sharedRunner = serialRunner();
  const firstTab = new WinStreakProfileStore(storage, sharedRunner);
  const secondTab = new WinStreakProfileStore(storage, sharedRunner);
  await firstTab.mutate((profile) => { profile.currentCount = 6; });
  const validated = preflight(firstTab);

  const [first, second] = await Promise.all([
    reserveBotGameCreation(firstTab, 'create', null, validated),
    reserveBotGameCreation(secondTab, 'create', null, validated),
  ]);

  assert((first.kind === 'reserved') !== (second.kind === 'reserved'));
  const winner = first.kind === 'reserved' ? first.reservation :
    second.kind === 'reserved' ? second.reservation : null;
  assert(winner?.requestedCount === 6);
});

Deno.test('reconciliation performs network work outside the profile lock', async () => {
  let locked = false;
  const store = new WinStreakProfileStore(
    new FakeStorage(),
    serialRunner((next) => { locked = next; }),
  );
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'A', 'human'));

  const result = await reconcileTrackedWinStreakGame(store, {
    async getGameState() {
      assert(!locked, 'network request ran while the profile lock was held');
      return new Response(JSON.stringify(gameState({ gameId: 'A' })), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert(result.kind === 'unfinished');
});

Deno.test('reconciliation discards a response after the tracked generation changes', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'A', 'human'));

  const result = await reconcileTrackedWinStreakGame(store, {
    async getGameState() {
      await store.mutate((profile) => { profile.generation += 1; });
      return new Response(JSON.stringify(gameState({ gameId: 'A' })), { status: 200 });
    },
  });

  assert(result.kind === 'stale');
});

Deno.test('ambiguous creation is retained until explicit release while rejection is cleared', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const ambiguous = await reserve(store);
  assert(await markBotGameCreationStarted(store, ambiguous));
  await failBotGameCreation(store, ambiguous, { ambiguous: true, error: 'lost response' });
  assert(store.getSnapshot().creationReservation?.status === 'ambiguous');
  assert(creationViewModelFromReservation(store.getSnapshot().creationReservation).requiresExplicitRelease);
  assert((await reserveBotGameCreation(store, 'create', null, preflight(store))).kind === 'blocked');
  await releaseCreationReservation(store);
  assert(store.getSnapshot().creationReservation === null);

  const rejected = await reserve(store);
  await failBotGameCreation(store, rejected, { ambiguous: false, error: 'bad request' });
  assert(store.getSnapshot().creationReservation === null);
});

Deno.test('stale creation success keeps recovery game instead of replacing progression', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'A', 'human'));
  const reservation = await reserve(store, 'rematch', 'A');
  await store.mutate((profile) => { profile.generation += 1; });

  const result = await completeBotGameCreation(store, reservation, 'B', 'recovered-human');

  assert(result === 'stale');
  assert(store.getSnapshot().trackedGame?.gameId === 'A');
  assert(store.getSnapshot().creationReservation?.recoveryGameId === 'B');
  assert(store.getSnapshot().creationReservation?.status === 'stale_success');
});

Deno.test('success arriving after explicit release is retained as recovery data', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const reservation = await reserve(store);
  await releaseCreationReservation(store);

  const result = await completeBotGameCreation(store, reservation, 'LATE', 'human');

  assert(result === 'stale');
  assert(store.getSnapshot().trackedGame === null);
  assert(store.getSnapshot().creationReservation?.status === 'stale_success');
  assert(store.getSnapshot().creationReservation?.recoveryGameId === 'LATE');
});

Deno.test('persisted unowned reservation projects as ambiguous, never as active creation', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const reservation = await reserve(store);
  assert(await markBotGameCreationStarted(store, reservation));

  const interrupted = creationViewModelFromReservation(store.getSnapshot().creationReservation);
  const locallyOwned = creationViewModelFromReservation(
    store.getSnapshot().creationReservation,
    'idle',
    null,
    reservation.token,
  );
  assert(interrupted.status === 'ambiguous');
  assert(interrupted.requiresExplicitRelease);
  assert(locallyOwned.status === 'creating');
});

Deno.test('restart completion cannot overwrite a changed profile generation', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'SOURCE', 'human'));
  const generation = store.getSnapshot().generation;
  await store.mutate((profile) => { profile.generation += 1; });

  const result = await completeWinStreakRestart(
    store,
    'SOURCE',
    'REPLACEMENT',
    'human',
    generation,
  );

  assert(result === 'stale');
  assert(store.getSnapshot().trackedGame?.gameId === 'SOURCE');
});

Deno.test('clear preflight becomes stale after another caller registers a game', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 4; });
  const callerA = await reconcileTrackedWinStreakGame(store, {
    getGameState: async () => { throw new Error('unexpected request'); },
  });
  assert(callerA.kind === 'clear');

  const callerB = await reserveBotGameCreation(store, 'create', null, callerA.preflight);
  assert(callerB.kind === 'reserved');
  assert(await completeBotGameCreation(store, callerB.reservation, 'B', 'human') === 'registered');

  const stale = await reserveBotGameCreation(store, 'create', null, callerA.preflight);
  assert(stale.kind === 'stale');
  assert(store.getSnapshot().trackedGame?.gameId === 'B');
  assert(store.getSnapshot().currentCount === 4);
});

Deno.test('stale abandonment confirmation cannot retire a newer tracked game', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 5;
    registerTrackedGameDraft(profile, 'A', 'human');
  });
  const confirmation = await reconcileTrackedWinStreakGame(store, {
    getGameState: async () => new Response(JSON.stringify(gameState({
      gameId: 'A', appliedCount: 5,
    })), { status: 200 }),
  });
  assert(confirmation.kind === 'unfinished');
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'B', 'human'));
  const rebound = await reconcileTrackedWinStreakGame(
    store,
    { getGameState: async () => { throw new Error('must not fetch game B'); } },
    { expectedTrackedGameId: 'A' },
  );
  assert(rebound.kind === 'stale');

  const result = await reserveAfterConfirmedAbandonment(
    store,
    'create',
    null,
    'A',
    confirmation.preflight,
  );

  assert(result.kind === 'stale');
  assert(store.getSnapshot().trackedGame?.gameId === 'B');
  assert(store.getSnapshot().trackedGame?.status === 'unfinished');
  assert(store.getSnapshot().currentCount === 5);
});

Deno.test('confirmed abandonment retires and reserves atomically', async () => {
  const storage = new FakeStorage();
  const store = new WinStreakProfileStore(storage, serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 5;
    registerTrackedGameDraft(profile, 'A', 'human');
  });
  const confirmation = await reconcileTrackedWinStreakGame(store, {
    getGameState: async () => new Response(JSON.stringify(gameState({
      gameId: 'A', appliedCount: 5,
    })), { status: 200 }),
  });
  assert(confirmation.kind === 'unfinished');

  const result = await reserveAfterConfirmedAbandonment(
    store,
    'create',
    null,
    'A',
    confirmation.preflight,
  );

  assert(result.kind === 'reserved');
  const persisted = JSON.parse(storage.values.values().next().value as string);
  assert(persisted.currentCount === 0);
  assert(persisted.trackedGame.gameId === 'A');
  assert(persisted.trackedGame.status === 'retired');
  assert(persisted.creationReservation.token === result.reservation.token);
  assert(result.reservation.requestedCount === 0);
});

Deno.test('confirmation-time terminal result settles before creation reservation', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 2;
    registerTrackedGameDraft(profile, 'A', 'human');
  });
  const reconciled = await reconcileTrackedWinStreakGame(
    store,
    {
      getGameState: async () => new Response(JSON.stringify(gameState({
        gameId: 'A',
        status: 'finished',
        winner: 'human',
        reason: 'decisive',
        appliedCount: 2,
      })), { status: 200 }),
    },
    { expectedTrackedGameId: 'A' },
  );
  assert(reconciled.kind === 'clear');
  assert(store.getSnapshot().currentCount === 3);

  const reserved = await reserveBotGameCreation(store, 'create', null, reconciled.preflight);
  assert(reserved.kind === 'reserved');
  assert(reserved.reservation.requestedCount === 3);
});

Deno.test('recovered active creation is tracked before its result settles exactly once', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 2; });
  const reservation = await reserve(store);
  await recordCreatedGameForRecovery(store, reservation, 'RECOVERED', 'identity unavailable');

  const recovered = await recoverCreatedBotGame(store, {
    getGameState: async () => new Response(JSON.stringify(gameState({
      gameId: 'RECOVERED', appliedCount: 2,
    })), { status: 200 }),
  });
  assert(recovered.kind === 'recovered');
  assert(store.getSnapshot().trackedGame?.gameId === 'RECOVERED');
  assert(store.getSnapshot().creationReservation === null);

  const finished = projectAuthoritativeWinStreakGame(gameState({
    gameId: 'RECOVERED',
    status: 'finished',
    winner: 'human',
    reason: 'decisive',
    appliedCount: 2,
  }), 'human');
  assert(finished);
  await Promise.all([
    observeAuthoritativeWinStreakGame(store, finished, { allowDiscovery: false }),
    observeAuthoritativeWinStreakGame(store, finished, { allowDiscovery: false }),
  ]);
  assert(store.getSnapshot().currentCount === 3);
});

Deno.test('recovery settles an already-finished created game before returning', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 2; });
  const reservation = await reserve(store);
  await recordCreatedGameForRecovery(store, reservation, 'FINISHED', 'response interrupted');

  const result = await recoverCreatedBotGame(store, {
    getGameState: async () => new Response(JSON.stringify(gameState({
      gameId: 'FINISHED',
      status: 'finished',
      winner: 'bot',
      reason: 'timeout',
      appliedCount: 2,
    })), { status: 200 }),
  });

  assert(result.kind === 'recovered' && result.settled);
  assert(store.getSnapshot().currentCount === 0);
  assert(store.getSnapshot().endedStreak?.endingGameId === 'FINISHED');
  assert(store.getSnapshot().trackedGame?.status === 'settled');
  assert(store.getSnapshot().creationReservation === null);
});

Deno.test('recovery conflict preserves newer progression and recovery data', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 2; });
  const reservation = await reserve(store);
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'NEWER', 'human'));
  assert(await completeBotGameCreation(store, reservation, 'RECOVERED', 'human') === 'stale');

  const result = await recoverCreatedBotGame(store, {
    getGameState: async () => new Response(JSON.stringify(gameState({
      gameId: 'RECOVERED', appliedCount: 2,
    })), { status: 200 }),
  });

  assert(result.kind === 'conflict');
  assert(store.getSnapshot().trackedGame?.gameId === 'NEWER');
  assert(store.getSnapshot().currentCount === 2);
  assert(store.getSnapshot().creationReservation?.recoveryGameId === 'RECOVERED');
});

Deno.test('mismatched recovered state retains its reservation data', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const reservation = await reserve(store);
  await recordCreatedGameForRecovery(store, reservation, 'EXPECTED', 'response interrupted');

  const result = await recoverCreatedBotGame(store, {
    getGameState: async () => new Response(JSON.stringify(gameState({
      gameId: 'DIFFERENT',
    })), { status: 200 }),
  });

  assert(result.kind === 'error');
  assert(store.getSnapshot().trackedGame === null);
  assert(store.getSnapshot().creationReservation?.recoveryGameId === 'EXPECTED');
});

Deno.test('creation recovery never opens a second creation reservation', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const reservation = await reserve(store);
  await recordCreatedGameForRecovery(store, reservation, 'RECOVERED', 'response interrupted');
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requestStarted!: () => void;
  const requestStartedGate = new Promise<void>((resolve) => { requestStarted = resolve; });
  const recovery = recoverCreatedBotGame(store, {
    getGameState: async () => {
      requestStarted();
      await responseGate;
      return new Response(JSON.stringify(gameState({ gameId: 'RECOVERED' })), { status: 200 });
    },
  });
  await requestStartedGate;

  const duplicate = await reserveBotGameCreation(store, 'create', null, preflight(store));
  assert(duplicate.kind === 'blocked');
  releaseResponse();
  assert((await recovery).kind === 'recovered');
});

Deno.test('concurrent repeated recovery calls are idempotent', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const reservation = await reserve(store);
  await recordCreatedGameForRecovery(store, reservation, 'RECOVERED', 'response interrupted');
  let arrivals = 0;
  let releaseBoth!: () => void;
  const bothArrived = new Promise<void>((resolve) => { releaseBoth = resolve; });
  const transport = {
    getGameState: async () => {
      arrivals += 1;
      if (arrivals === 2) releaseBoth();
      await bothArrived;
      return new Response(JSON.stringify(gameState({ gameId: 'RECOVERED' })), { status: 200 });
    },
  };

  const [first, second] = await Promise.all([
    recoverCreatedBotGame(store, transport),
    recoverCreatedBotGame(store, transport),
  ]);

  assert(first.kind === 'recovered');
  assert(second.kind === 'recovered');
  assert(store.getSnapshot().trackedGame?.gameId === 'RECOVERED');
  assert(store.getSnapshot().creationReservation === null);
});
