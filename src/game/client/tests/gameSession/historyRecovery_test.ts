declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  createHistoryRecoveryCoordinator,
  deriveHistoryRecoveryExpectation,
  getHistoryRecoveryKey,
  historyContainsTurn,
  type HistoryFetchOutcome,
  type HistoryRecoveryClock,
  type HistoryRecoveryExpectation,
  type HistoryRecoveryObservation,
  type HistoryRecoveryState,
} from '../../gameSession/historyRecovery';
import type { BattleLogHistoryResponse } from '../../gameSession/types';

function assert(condition: unknown, message = 'assertion failed'): void {
  if (!condition) throw new Error(message);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

class FakeClock implements HistoryRecoveryClock {
  now = 0;
  nextId = 1;
  tasks = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  advance(ms: number): void {
    const target = this.now + ms;
    while (true) {
      const due = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0];
      if (!due) break;
      this.tasks.delete(due[0]);
      this.now = due[1].at;
      due[1].callback();
    }
    this.now = target;
  }
}

function history(gameId: string, turns: number[]): BattleLogHistoryResponse {
  return {
    gameId,
    revision: turns.length,
    completedTurnCount: turns.length,
    turns: turns.map((turnNumber) => ({
      turnNumber,
      diceValue: null,
      players: [],
      buildLinesByPlayerId: {},
      battleLinesByPlayerId: {},
    })),
  };
}

function observation(args: {
  gameId?: string;
  turnNumber?: number;
  expectation?: HistoryRecoveryExpectation | null;
  acceptedHistory?: BattleLogHistoryResponse | null;
  isFinished?: boolean;
} = {}): HistoryRecoveryObservation {
  return {
    gameId: args.gameId ?? 'game-1',
    turnNumber: args.turnNumber ?? 3,
    isFinished: args.isFinished ?? false,
    expectation: args.expectation === undefined
      ? { gameId: args.gameId ?? 'game-1', missingTurnNumber: 2 }
      : args.expectation,
    history: args.acceptedHistory ?? null,
  };
}

function harness() {
  const clock = new FakeClock();
  const requests: Array<{
    gameId: string;
    pending: ReturnType<typeof deferred<HistoryFetchOutcome>>;
  }> = [];
  const accepted: BattleLogHistoryResponse[] = [];
  const states: Array<HistoryRecoveryState | null> = [];
  const satisfied: HistoryRecoveryExpectation[] = [];
  const coordinator = createHistoryRecoveryCoordinator({
    clock,
    request: (gameId) => {
      const pending = deferred<HistoryFetchOutcome>();
      requests.push({ gameId, pending });
      return pending.promise;
    },
    onHistoryAccepted: (value) => accepted.push(value),
    onRecoveryStateChange: (value) => states.push(value),
    onExpectationSatisfied: (value) => satisfied.push(value),
  });
  return { clock, requests, accepted, states, satisfied, coordinator };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

Deno.test('initial history request remains the only request until it completes', async () => {
  const test = harness();
  test.coordinator.observe(observation());
  assert(test.requests.length === 1, 'initial observation should start one request');

  test.clock.advance(5000);
  test.coordinator.observe(observation());
  test.coordinator.observe(observation());
  assert(test.requests.length === 1, 'elapsed time and repeated observations must not overlap initial request');

  test.requests[0].pending.resolve({ kind: 'accepted', history: history('game-1', [1, 2]) });
  await flush();
  assert(test.accepted.length === 1, 'current-game response should be accepted');
  assert(test.satisfied.length === 1, 'archive in the initial response should satisfy recovery');

  test.clock.advance(5000);
  assert(test.requests.length === 1, 'no retry should follow a response containing the archive');
  test.coordinator.dispose();
});

async function assertSequentialRecovery(initialOutcome: HistoryFetchOutcome): Promise<void> {
  const test = harness();
  test.coordinator.observe(observation());
  assert(test.requests.length === 1, 'initial request missing');

  test.requests[0].pending.resolve(initialOutcome);
  await flush();
  test.clock.advance(249);
  assert(test.requests.length === 1, 'retry one started before 250 ms after completion');
  test.clock.advance(1);
  assert(test.requests.length === 2, 'retry one should start at 250 ms');

  test.clock.advance(5000);
  assert(test.requests.length === 2, 'retry two must wait for retry one completion');
  test.requests[1].pending.resolve({ kind: 'failed' });
  await flush();
  test.clock.advance(749);
  assert(test.requests.length === 2, 'retry two started before 750 ms after completion');
  test.clock.advance(1);
  assert(test.requests.length === 3, 'retry two should start at 750 ms');

  test.clock.advance(5000);
  assert(test.requests.length === 3, 'retry three must wait for retry two completion');
  test.requests[2].pending.resolve({ kind: 'accepted', history: history('game-1', [1]) });
  await flush();
  test.clock.advance(1499);
  assert(test.requests.length === 3, 'retry three started before 1500 ms after completion');
  test.clock.advance(1);
  assert(test.requests.length === 4, 'retry three should start at 1500 ms');
  assert(
    test.states.at(-1)?.status === 'pending',
    'recovery should stay pending while retry three is in flight',
  );

  test.clock.advance(5000);
  assert(test.requests.length === 4, 'retry budget must remain sequential');
  assert(test.states.at(-1)?.status === 'pending', 'in-flight final retry must not be deferred');
  test.requests[3].pending.resolve({ kind: 'accepted', history: history('game-1', [1]) });
  await flush();
  assert(test.states.at(-1)?.status === 'deferred', 'third completed retry should exhaust recovery');
  assert(test.states.at(-1)?.attempt === 3, 'deferred state should report all three retries');
  test.clock.advance(5000);
  assert(test.requests.length === 4, 'deferred recovery must not start a fourth retry');
  test.coordinator.dispose();
}

Deno.test('failed initial response starts the bounded sequential recovery after completion', async () => {
  await assertSequentialRecovery({ kind: 'failed' });
});

Deno.test('archive-missing initial response starts the bounded sequential recovery after completion', async () => {
  await assertSequentialRecovery({ kind: 'accepted', history: history('game-1', [1]) });
});

Deno.test('same-game turn supersession coalesces behind the active request', async () => {
  const test = harness();
  test.coordinator.observe(observation());
  test.coordinator.observe(observation({
    turnNumber: 4,
    expectation: { gameId: 'game-1', missingTurnNumber: 3 },
  }));
  assert(test.requests.length === 1, 'new turn must not overlap the active request');

  test.requests[0].pending.resolve({ kind: 'accepted', history: history('game-1', [1, 2, 3]) });
  await flush();
  assert(test.satisfied.length === 1, 'completion should be checked against the latest expectation');
  assert(test.satisfied[0].missingTurnNumber === 3, 'latest archive identity should be satisfied');
  test.clock.advance(5000);
  assert(test.requests.length === 1, 'satisfied latest expectation must not cause another request');
  test.coordinator.dispose();
});

Deno.test('game supersession ignores old completion and starts only the new game request', async () => {
  const test = harness();
  test.coordinator.observe(observation());
  test.coordinator.observe(observation({
    gameId: 'game-2',
    turnNumber: 2,
    expectation: { gameId: 'game-2', missingTurnNumber: 1 },
  }));
  assert(test.requests.length === 2, 'new game should start its own request');
  assert(test.requests[1].gameId === 'game-2', 'second request should target the new game');

  test.requests[0].pending.resolve({ kind: 'accepted', history: history('game-1', [1, 2]) });
  await flush();
  assert(test.accepted.length === 0, 'superseded-game response must not update history');
  assert(test.satisfied.length === 0, 'superseded-game response must not satisfy current recovery');

  test.requests[1].pending.resolve({ kind: 'accepted', history: history('game-2', [1]) });
  await flush();
  assert(test.accepted.length === 1 && test.accepted[0].gameId === 'game-2');
  assert(test.satisfied.length === 1 && test.satisfied[0].gameId === 'game-2');
  test.coordinator.dispose();
});

Deno.test('game supersession cancels a pending recovery timer', async () => {
  const test = harness();
  test.coordinator.observe(observation());
  test.requests[0].pending.resolve({ kind: 'accepted', history: history('game-1', [1]) });
  await flush();
  test.clock.advance(100);

  test.coordinator.observe(observation({
    gameId: 'game-2',
    turnNumber: 2,
    expectation: { gameId: 'game-2', missingTurnNumber: 1 },
  }));
  assert(test.requests.length === 2, 'new game should start one initial request');
  test.clock.advance(1000);
  assert(test.requests.length === 2, 'superseded game timer must not issue a request');
  test.coordinator.dispose();
});

Deno.test('archive arrival while a retry timer is pending cancels the timer', async () => {
  const test = harness();
  test.coordinator.observe(observation());
  test.requests[0].pending.resolve({ kind: 'accepted', history: history('game-1', [1]) });
  await flush();

  test.clock.advance(100);
  test.coordinator.observe(observation({ acceptedHistory: history('game-1', [1, 2]) }));
  assert(test.satisfied.length === 1, 'accepted archive should satisfy recovery immediately');
  test.clock.advance(1000);
  assert(test.requests.length === 1, 'cancelled timer must not issue a retry');
  test.coordinator.dispose();
});

Deno.test('archive arrival while a request is pending invalidates but does not overlap it', async () => {
  const test = harness();
  test.coordinator.observe(observation());
  test.coordinator.observe(observation({ acceptedHistory: history('game-1', [1, 2]) }));
  assert(test.satisfied.length === 1, 'accepted archive should satisfy recovery');

  test.coordinator.observe(observation({
    turnNumber: 4,
    expectation: { gameId: 'game-1', missingTurnNumber: 3 },
    acceptedHistory: history('game-1', [1, 2]),
  }));
  assert(test.requests.length === 1, 'new observation must remain coalesced behind the physical request');

  test.requests[0].pending.resolve({ kind: 'accepted', history: history('game-1', [1]) });
  await flush();
  assert(test.accepted.length === 0, 'invalidated response must not replace accepted history');
  assert(test.requests.length === 2, 'latest observation should start after invalidated request completes');
  assert(test.requests[1].gameId === 'game-1');
  test.coordinator.dispose();
});

Deno.test('history recovery keys and presence checks are turn-specific', () => {
  const expectation = { gameId: 'game-1', missingTurnNumber: 4 };
  assert(getHistoryRecoveryKey(expectation) === 'game-1::archive::4');
  assert(historyContainsTurn(history('game-1', [3, 4]), 4));
  assert(!historyContainsTurn(history('game-1', [3, 4]), 5));
});

Deno.test('active N+1 expects archive N while turn one expects none', () => {
  const expected = deriveHistoryRecoveryExpectation({
    gameId: 'game-1',
    currentTurnNumber: 4,
    status: 'active',
    resultReason: null,
    history: history('game-1', [1, 2]),
  });
  assert(expected?.missingTurnNumber === 3);
  assert(deriveHistoryRecoveryExpectation({
    gameId: 'game-1',
    currentTurnNumber: 1,
    status: 'active',
    resultReason: null,
  }) === null);
});

Deno.test('only resolved terminal reasons establish a current-turn archive expectation', () => {
  for (const resultReason of ['decisive', 'narrow', 'mutual_destruction']) {
    const expected = deriveHistoryRecoveryExpectation({
      gameId: 'game-1',
      currentTurnNumber: 5,
      status: 'finished',
      resultReason,
    });
    assert(expected?.missingTurnNumber === 5, `${resultReason} should expect the final archive`);
  }
  for (const resultReason of [
    'resignation',
    'timeout',
    'timeout_draw',
    'agreement',
    'unknown',
    null,
  ]) {
    assert(deriveHistoryRecoveryExpectation({
      gameId: 'game-1',
      currentTurnNumber: 5,
      status: 'finished',
      resultReason,
    }) === null, `${String(resultReason)} should not infer a resolved final archive`);
  }
});
