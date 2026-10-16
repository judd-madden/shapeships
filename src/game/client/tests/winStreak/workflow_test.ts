declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  deriveWinStreakGameViewModel,
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
  executeReservedBotGameCreation,
  failBotGameCreation,
  markBotGameCreationStarted,
  prepareBotGameCreation,
  reconcileTrackedWinStreakGame,
  recordCreatedGameForRecovery,
  recoverCreatedBotGame,
  releaseCreationReservation,
  reserveBotGameCreation,
  visibleRejoinCandidate,
  verifyTrackedGameForRejoin,
} from '../../winStreak/workflow';
import { acceptedIntentState, publicGameState } from './fixtures';

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

Deno.test('real public lifecycle tracks the first win and carries it into the next fixed bonus', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  const sentCounts: number[] = [];

  const firstPreparation = await prepareBotGameCreation({
    store,
    kind: 'create',
    sourceGameId: null,
    transport: { getGameState: async () => { throw new Error('unexpected reconciliation'); } },
  });
  assert(firstPreparation.kind === 'reserved');
  const firstCreation = await executeReservedBotGameCreation({
    store,
    reservation: firstPreparation.reservation,
    request: async (count) => {
      sentCounts.push(count);
      return new Response(JSON.stringify({ gameId: 'FIRST' }), { status: 200 });
    },
    getHumanPlayerId: async () => 'human',
    invalidResponseMessage: 'invalid first creation',
  });
  assert(firstCreation.kind === 'registered');
  assert(sentCounts[0] === 0);
  assert(store.getSnapshot().trackedGame?.gameId === 'FIRST');

  const active = projectAuthoritativeWinStreakGame(publicGameState({
    gameId: 'FIRST',
    appliedCount: 0,
  }), 'human');
  assert(active);
  await observeAuthoritativeWinStreakGame(store, active, { allowDiscovery: true });

  const finishedFullState = projectAuthoritativeWinStreakGame(publicGameState({
    gameId: 'FIRST',
    status: 'finished',
    winner: 'human',
    reason: 'decisive',
    appliedCount: 0,
  }), 'human');
  const finishedIntentState = projectAuthoritativeWinStreakGame(acceptedIntentState({
    gameId: 'FIRST',
    status: 'finished',
    winner: 'human',
    reason: 'decisive',
    appliedCount: 0,
  }), 'human');
  assert(finishedFullState && finishedIntentState);
  const notificationsBeforeWin = notifications;
  await Promise.all([
    observeAuthoritativeWinStreakGame(store, finishedFullState, { allowDiscovery: false }),
    observeAuthoritativeWinStreakGame(store, finishedIntentState, { allowDiscovery: false }),
  ]);
  assert(store.getSnapshot().currentCount === 1);
  assert(notifications === notificationsBeforeWin + 1);
  const firstWinVm = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(),
    game: finishedFullState,
    resetBusy: false,
    resetError: null,
    resetRetryAvailable: false,
  });
  assert(firstWinVm.streakState === 'active');
  assert(firstWinVm.displayCount === 1);
  assert(firstWinVm.shouldShowContent);

  const nextPreparation = await prepareBotGameCreation({
    store,
    kind: 'create',
    sourceGameId: null,
    transport: { getGameState: async () => { throw new Error('settled game should not reconcile'); } },
  });
  assert(nextPreparation.kind === 'reserved');
  const nextCreation = await executeReservedBotGameCreation({
    store,
    reservation: nextPreparation.reservation,
    request: async (count) => {
      sentCounts.push(count);
      return new Response(JSON.stringify({ gameId: 'SECOND' }), { status: 200 });
    },
    getHumanPlayerId: async () => 'human',
    invalidResponseMessage: 'invalid next creation',
  });
  assert(nextCreation.kind === 'registered');
  assert(sentCounts[1] === 1);
  assert(store.getSnapshot().trackedGame?.gameId === 'SECOND');

  const secondWin = projectAuthoritativeWinStreakGame(publicGameState({
    gameId: 'SECOND',
    status: 'finished',
    winner: 'human',
    reason: 'decisive',
    appliedCount: 1,
  }), 'human');
  assert(secondWin);
  await observeAuthoritativeWinStreakGame(store, secondWin, { allowDiscovery: false });
  assert(store.getSnapshot().currentCount === 2);
  const secondWinVm = deriveWinStreakGameViewModel({
    profile: store.getSnapshot(),
    game: secondWin,
    resetBusy: false,
    resetError: null,
    resetRetryAvailable: false,
  });
  assert(secondWinVm.displayCount === 2);
  assert(secondWinVm.appliedBonus.count === 1);
  assert(secondWinVm.appliedBonus.recipientSide === 'opponent');
  unsubscribe();
});

Deno.test('menu creation and bot rematch execution both send the settled count', async () => {
  for (const kind of ['create', 'rematch'] as const) {
    const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
    await store.mutate((profile) => {
      profile.currentCount = 1;
      registerTrackedGameDraft(profile, 'SETTLED', 'human');
      profile.trackedGame!.status = 'settled';
      profile.trackedGame!.resultEligible = false;
    });
    const prepared = await prepareBotGameCreation({
      store,
      kind,
      sourceGameId: kind === 'rematch' ? 'SETTLED' : null,
      transport: { getGameState: async () => { throw new Error('unexpected reconciliation'); } },
    });
    assert(prepared.kind === 'reserved');
    let sentCount: number | null = null;
    const result = await executeReservedBotGameCreation({
      store,
      reservation: prepared.reservation,
      request: async (count) => {
        sentCount = count;
        return new Response(JSON.stringify({ gameId: `NEXT-${kind}` }), { status: 200 });
      },
      getHumanPlayerId: async () => 'human',
      invalidResponseMessage: 'invalid creation',
    });
    assert(result.kind === 'registered');
    assert(sentCount === 1);
    assert(store.getSnapshot().trackedGame?.gameId === `NEXT-${kind}`);
  }
});

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
      return new Response(JSON.stringify(publicGameState({ gameId: 'A' })), {
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
      return new Response(JSON.stringify(publicGameState({ gameId: 'A' })), { status: 200 });
    },
  });

  assert(result.kind === 'stale');
});

Deno.test('a deliberate new attempt releases ambiguity without replaying the old request', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  const ambiguous = await reserve(store);
  assert(await markBotGameCreationStarted(store, ambiguous));
  await failBotGameCreation(store, ambiguous, { ambiguous: true, error: 'lost response' });
  assert(store.getSnapshot().creationReservation?.status === 'ambiguous');
  assert((await reserveBotGameCreation(store, 'create', null, preflight(store))).kind === 'blocked');
  let reconciliationReads = 0;
  const distinct = await prepareBotGameCreation({
    store,
    kind: 'create',
    sourceGameId: null,
    transport: {
      getGameState: async () => {
        reconciliationReads += 1;
        throw new Error('no tracked game should be read');
      },
    },
  });
  assert(distinct.kind === 'reserved');
  assert(distinct.reservation.token !== ambiguous.token);
  assert(reconciliationReads === 0);

  await releaseCreationReservation(store);
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

Deno.test('direct creation retires an authoritative unfinished game and reserves at zero', async () => {
  const storage = new FakeStorage();
  const store = new WinStreakProfileStore(storage, serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 5;
    registerTrackedGameDraft(profile, 'A', 'human');
  });
  const result = await prepareBotGameCreation({
    store,
    kind: 'create',
    sourceGameId: null,
    transport: {
    getGameState: async () => new Response(JSON.stringify(publicGameState({
      gameId: 'A', appliedCount: 5,
    })), { status: 200 }),
    },
  });

  assert(result.kind === 'reserved');
  const persisted = JSON.parse(storage.values.values().next().value as string);
  assert(persisted.currentCount === 0);
  assert(persisted.trackedGame.gameId === 'A');
  assert(persisted.trackedGame.status === 'retired');
  assert(persisted.creationReservation.token === result.reservation.token);
  assert(result.reservation.requestedCount === 0);
});

Deno.test('direct creation settles a terminal win before reserving', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 2;
    registerTrackedGameDraft(profile, 'A', 'human');
  });
  const prepared = await prepareBotGameCreation({
    store,
    kind: 'create',
    sourceGameId: null,
    transport: {
      getGameState: async () => new Response(JSON.stringify(publicGameState({
        gameId: 'A',
        status: 'finished',
        winner: 'human',
        reason: 'decisive',
        appliedCount: 2,
      })), { status: 200 }),
    },
  });
  assert(prepared.kind === 'reserved');
  assert(store.getSnapshot().currentCount === 3);
  assert(prepared.reservation.requestedCount === 3);
});

Deno.test('direct creation resets losses and preserves draws', async () => {
  for (const reason of ['decisive', 'resignation', 'timeout']) {
    const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
    await store.mutate((profile) => {
      profile.currentCount = 4;
      registerTrackedGameDraft(profile, reason, 'human');
    });
    const prepared = await prepareBotGameCreation({
      store,
      kind: 'create',
      sourceGameId: null,
      transport: {
        getGameState: async () => new Response(JSON.stringify(publicGameState({
          gameId: reason,
          status: 'finished',
          winner: 'bot',
          reason,
          appliedCount: 4,
        })), { status: 200 }),
      },
    });
    assert(prepared.kind === 'reserved');
    assert(prepared.reservation.requestedCount === 0);
  }

  const drawStore = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await drawStore.mutate((profile) => {
    profile.currentCount = 4;
    registerTrackedGameDraft(profile, 'DRAW', 'human');
  });
  const draw = await prepareBotGameCreation({
    store: drawStore,
    kind: 'create',
    sourceGameId: null,
    transport: {
      getGameState: async () => new Response(JSON.stringify(publicGameState({
        gameId: 'DRAW',
        status: 'finished',
        reason: 'agreement',
        appliedCount: 4,
      })), { status: 200 }),
    },
  });
  assert(draw.kind === 'reserved');
  assert(draw.reservation.requestedCount === 4);
});

Deno.test('failed reconciliation retires the association but preserves settled progression', async () => {
  for (const response of [
    () => Promise.reject(new Error('timeout')),
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.resolve(new Response('{', { status: 200 })),
  ]) {
    const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
    await store.mutate((profile) => {
      profile.currentCount = 6;
      registerTrackedGameDraft(profile, 'UNRESOLVED', 'human');
    });
    const prepared = await prepareBotGameCreation({
      store,
      kind: 'create',
      sourceGameId: null,
      transport: { getGameState: response },
    });
    assert(prepared.kind === 'reserved');
    assert(prepared.reservation.requestedCount === 6);
    assert(store.getSnapshot().trackedGame?.status === 'retired');
  }
});

Deno.test('verified rejoin requires current identity, active bot state, and matching bonus', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 2;
    registerTrackedGameDraft(profile, 'ACTIVE', 'human');
  });
  const candidate = await verifyTrackedGameForRejoin(store, {
    getGameState: async () => new Response(JSON.stringify(publicGameState({
      gameId: 'ACTIVE', appliedCount: 2,
    })), { status: 200 }),
  });
  assert(candidate?.gameId === 'ACTIVE');
  assert(visibleRejoinCandidate(2, candidate, false)?.gameId === 'ACTIVE');
  assert(visibleRejoinCandidate(0, candidate, false) === null);
  assert(visibleRejoinCandidate(2, candidate, true) === null);

  const identityStore = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await identityStore.mutate((profile) => {
    profile.currentCount = 2;
    registerTrackedGameDraft(profile, 'IDENTITY', 'human');
  });
  const wrongRequesterState = publicGameState({ gameId: 'IDENTITY', appliedCount: 2 });
  wrongRequesterState.requester.playerId = 'someone-else';
  assert(await verifyTrackedGameForRejoin(identityStore, {
    getGameState: async () => new Response(JSON.stringify(wrongRequesterState), { status: 200 }),
  }) === null);
  assert(identityStore.getSnapshot().trackedGame?.status === 'unfinished');
  assert(identityStore.getSnapshot().trackedGame?.resultEligible === true);
  assert(identityStore.getSnapshot().currentCount === 2);

  const mismatch = await verifyTrackedGameForRejoin(store, {
    getGameState: async () => new Response(JSON.stringify(publicGameState({
      gameId: 'ACTIVE', appliedCount: 1,
    })), { status: 200 }),
  });
  assert(mismatch === null);
  assert(store.getSnapshot().trackedGame?.status === 'unfinished');
  assert(store.getSnapshot().trackedGame?.resultEligible === true);
  assert(store.getSnapshot().currentCount === 2);
});

Deno.test('active zero streak stays eligible and a later verified first win settles', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'FIRST', 'human'));
  const activeCandidate = await verifyTrackedGameForRejoin(store, {
    getGameState: async () => new Response(JSON.stringify(publicGameState({
      gameId: 'FIRST',
      appliedCount: 0,
    })), { status: 200 }),
  });
  assert(activeCandidate === null);
  assert(store.getSnapshot().trackedGame?.status === 'unfinished');
  assert(store.getSnapshot().trackedGame?.resultEligible === true);

  const finishedCandidate = await verifyTrackedGameForRejoin(store, {
    getGameState: async () => new Response(JSON.stringify(publicGameState({
      gameId: 'FIRST',
      status: 'finished',
      winner: 'human',
      reason: 'decisive',
      appliedCount: 0,
    })), { status: 200 }),
  });
  assert(finishedCandidate === null);
  assert(store.getSnapshot().currentCount === 1);
  assert(store.getSnapshot().trackedGame?.status === 'settled');
});

Deno.test('retired records are skipped and inaccessible quiet checks preserve eligibility', async () => {
  const retired = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await retired.mutate((profile) => {
    profile.currentCount = 3;
    registerTrackedGameDraft(profile, 'RETIRED', 'human');
    profile.trackedGame!.status = 'retired';
    profile.trackedGame!.resultEligible = false;
  });
  let fetched = false;
  assert(await verifyTrackedGameForRejoin(retired, {
    getGameState: async () => {
      fetched = true;
      return new Response(null, { status: 200 });
    },
  }) === null);
  assert(!fetched);

  const inaccessible = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await inaccessible.mutate((profile) => {
    profile.currentCount = 3;
    registerTrackedGameDraft(profile, 'MISSING', 'human');
  });
  assert(await verifyTrackedGameForRejoin(inaccessible, {
    getGameState: async () => new Response(null, { status: 404 }),
  }) === null);
  assert(inaccessible.getSnapshot().trackedGame?.status === 'unfinished');
  assert(inaccessible.getSnapshot().trackedGame?.resultEligible === true);
  assert(inaccessible.getSnapshot().currentCount === 3);
});

Deno.test('transient and malformed quiet checks preserve later settlement eligibility', async () => {
  for (const [gameId, getGameState] of [
    ['TRANSIENT', async () => new Response(null, { status: 503 })],
    ['MALFORMED', async () => new Response('{', { status: 200 })],
  ] as const) {
    const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
    await store.mutate((profile) => registerTrackedGameDraft(profile, gameId, 'human'));

    assert(await verifyTrackedGameForRejoin(store, { getGameState }) === null);
    assert(store.getSnapshot().trackedGame?.status === 'unfinished');
    assert(store.getSnapshot().trackedGame?.resultEligible === true);

    const win = projectAuthoritativeWinStreakGame(publicGameState({
      gameId,
      status: 'finished',
      winner: 'human',
      reason: 'decisive',
    }), 'human');
    assert(win);
    await observeAuthoritativeWinStreakGame(store, win, { allowDiscovery: false });
    assert(store.getSnapshot().currentCount === 1);
  }
});

Deno.test('stale quiet verification cannot settle or advertise a newer association', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'OLD', 'human'));
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requestStarted!: () => void;
  const requestStartedGate = new Promise<void>((resolve) => { requestStarted = resolve; });
  const verification = verifyTrackedGameForRejoin(store, {
    getGameState: async () => {
      requestStarted();
      await responseGate;
      return new Response(JSON.stringify(publicGameState({
        gameId: 'OLD',
        status: 'finished',
        winner: 'human',
        reason: 'decisive',
      })), { status: 200 });
    },
  });
  await requestStartedGate;
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'NEW', 'human'));
  releaseResponse();

  assert(await verification === null);
  assert(store.getSnapshot().trackedGame?.gameId === 'NEW');
  assert(store.getSnapshot().trackedGame?.status === 'unfinished');
  assert(store.getSnapshot().currentCount === 0);
});

Deno.test('creation handoff prevents a pending quiet verification from settling', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => registerTrackedGameDraft(profile, 'SOURCE', 'human'));
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requestStarted!: () => void;
  const requestStartedGate = new Promise<void>((resolve) => { requestStarted = resolve; });
  const verification = verifyTrackedGameForRejoin(store, {
    getGameState: async () => {
      requestStarted();
      await responseGate;
      return new Response(JSON.stringify(publicGameState({
        gameId: 'SOURCE',
        status: 'finished',
        winner: 'human',
        reason: 'decisive',
      })), { status: 200 });
    },
  });
  await requestStartedGate;
  const reservation = await reserveBotGameCreation(store, 'rematch', 'SOURCE', preflight(store));
  assert(reservation.kind === 'reserved');
  releaseResponse();

  assert(await verification === null);
  assert(store.getSnapshot().currentCount === 0);
  assert(store.getSnapshot().trackedGame?.status === 'unfinished');
  assert(store.getSnapshot().creationReservation?.token === reservation.reservation.token);
});

Deno.test('recovered active creation is tracked before its result settles exactly once', async () => {
  const store = new WinStreakProfileStore(new FakeStorage(), serialRunner());
  await store.mutate((profile) => { profile.currentCount = 2; });
  const reservation = await reserve(store);
  await recordCreatedGameForRecovery(store, reservation, 'RECOVERED', 'identity unavailable');

  const recovered = await recoverCreatedBotGame(store, {
    getGameState: async () => new Response(JSON.stringify(publicGameState({
      gameId: 'RECOVERED', appliedCount: 2,
    })), { status: 200 }),
  });
  assert(recovered.kind === 'recovered');
  assert(store.getSnapshot().trackedGame?.gameId === 'RECOVERED');
  assert(store.getSnapshot().creationReservation === null);

  const finished = projectAuthoritativeWinStreakGame(publicGameState({
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
    getGameState: async () => new Response(JSON.stringify(publicGameState({
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
    getGameState: async () => new Response(JSON.stringify(publicGameState({
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
    getGameState: async () => new Response(JSON.stringify(publicGameState({
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
      return new Response(JSON.stringify(publicGameState({ gameId: 'RECOVERED' })), { status: 200 });
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
      return new Response(JSON.stringify(publicGameState({ gameId: 'RECOVERED' })), { status: 200 });
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
