declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  buildDrawingPreviewSafeContextFingerprint,
  createCurrentTurnPreviewScheduler,
  type CurrentTurnPreviewCandidateInput,
  type CurrentTurnPreviewEnvelope,
  type PreviewSchedulerClock,
} from '../../gameSession/currentTurnPreview';

function assert(condition: unknown, message = 'assertion failed'): void {
  if (!condition) throw new Error(message);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

class FakeClock implements PreviewSchedulerClock {
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

function candidate(count: number, safeContextFingerprint = 'safe-a'): CurrentTurnPreviewCandidateInput {
  return {
    gameId: 'game-1',
    playerId: 'p1',
    turnNumber: 4,
    phaseKey: 'build.drawing',
    safeContextFingerprint,
    draft: { builds: count ? [{ shipDefId: 'DEF', count }] : [] },
  };
}

function estimate(envelope: CurrentTurnPreviewEnvelope, sourceContextKey: string) {
  return {
    status: 'estimated',
    requestToken: envelope.requestToken,
    identity: {
      gameId: 'game-1',
      turnNumber: 4,
      phaseKey: 'build.drawing',
      sourceContextKey,
      draftKey: 'server-draft',
    },
    playerId: 'p1',
    damage: { total: 1, rows: [] },
    healing: { total: 0, rows: [] },
    build: { lines: ['1 x DEF'], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

Deno.test('production scheduler debounces, coalesces, and accepts only its newest candidate', async () => {
  const clock = new FakeClock();
  const requests: Array<{ envelope: CurrentTurnPreviewEnvelope; result: ReturnType<typeof deferred<any>> }> = [];
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    transport: (_gameId, envelope) => {
      const result = deferred<any>();
      requests.push({ envelope, result });
      return result.promise;
    },
    onStateChange: () => {},
  });

  scheduler.setCandidate(candidate(0));
  clock.advance(224);
  assert(requests.length === 0, 'request launched before 225ms');
  scheduler.setCandidate(candidate(1));
  clock.advance(224);
  assert(requests.length === 0, 'rapid edit did not restart debounce');
  clock.advance(1);
  assert(requests.length === 1, 'settled candidate did not launch');

  scheduler.setCandidate(candidate(2));
  clock.advance(225);
  assert(requests.length === 1, 'more than one request was in flight');
  requests[0].result.resolve({ status: 200, body: estimate(requests[0].envelope, 'route-a') });
  await flush();
  assert(requests.length === 2, 'newest queued candidate did not launch');
  assert(requests[1].envelope.draft.builds[0]?.count === 2, 'queued draft was not newest');
  requests[1].result.resolve({ status: 200, body: estimate(requests[1].envelope, 'route-b') });
  await flush();
  assert(scheduler.getState().kind === 'estimated', 'newest response not accepted');
});

Deno.test('scheduler reuses cached A after A to B to A without rewriting its response token', async () => {
  const clock = new FakeClock();
  const requestTokens: string[] = [];
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    transport: async (_gameId, envelope) => {
      requestTokens.push(envelope.requestToken);
      return { status: 200, body: estimate(envelope, `route-${requestTokens.length}`) };
    },
    onStateChange: () => {},
  });

  scheduler.setCandidate(candidate(1));
  clock.advance(225);
  await flush();
  scheduler.setCandidate(candidate(2));
  clock.advance(225);
  await flush();
  scheduler.setCandidate(candidate(1));

  const state = scheduler.getState();
  assert(state.kind === 'estimated', 'cached A was not published');
  if (state.kind !== 'estimated') return;
  assert(requestTokens.length === 2, 'cached A launched another request');
  assert(
    state.candidate.requestToken !== state.estimate.requestToken,
    'cached response token was rewritten for the new generation',
  );
});

Deno.test('safe full-state fingerprint ignores Battle Log identity but changes for estimator inputs', () => {
  const state: any = {
    gameId: 'game-1',
    meta: { turnNumber: 4, phaseKey: 'build.drawing' },
    publicState: {
      players: [{ id: 'p1', role: 'player', faction: 'human', health: 30, maxHealth: 35 }],
      ships: { p1: [] },
      visibleDice: { effectiveDiceRollByPlayerId: { p1: 3 } },
      thisTurn: { identity: { sourceContextKey: 'public-a' }, battleLog: { buildLinesByPlayerId: {} } },
      clock: { serverNowMs: 1 },
    },
    requester: { drawingPrelude: { status: 'complete' }, buildEconomy: { ordinaryLinesAvailable: 3 } },
    stateRevision: 1,
    gameData: { turnData: {} },
  };
  const first = buildDrawingPreviewSafeContextFingerprint({ state, requesterPlayerId: 'p1', eligible: true });
  state.publicState.thisTurn.identity.sourceContextKey = 'public-b';
  state.publicState.thisTurn.battleLog.buildLinesByPlayerId.p1 = ['changed'];
  state.publicState.clock.serverNowMs = 2;
  state.stateRevision = 2;
  const presentationOnly = buildDrawingPreviewSafeContextFingerprint({ state, requesterPlayerId: 'p1', eligible: true });
  assert(first === presentationOnly, 'presentation-only full GET triggered preview');
  state.publicState.visibleDice.effectiveDiceRollByPlayerId.p1 = 5;
  const relevant = buildDrawingPreviewSafeContextFingerprint({ state, requesterPlayerId: 'p1', eligible: true });
  assert(first !== relevant, 'safe estimator input did not trigger preview');
});

Deno.test('production queue does not POST for Battle Log-only GET changes', async () => {
  const clock = new FakeClock();
  const state: any = {
    gameId: 'game-1', meta: { turnNumber: 4, phaseKey: 'build.drawing' },
    publicState: {
      players: [{ id: 'p1', role: 'player', faction: 'human', health: 30, maxHealth: 35 }],
      ships: { p1: [] }, visibleDice: { effectiveDiceRollByPlayerId: { p1: 3 } },
      thisTurn: { identity: { sourceContextKey: 'public-a' }, battleLog: { buildLinesByPlayerId: {} } },
    },
    requester: { drawingPrelude: { status: 'complete' }, buildEconomy: { ordinaryLinesAvailable: 3 } },
    gameData: { turnData: {} },
  };
  let calls = 0;
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    onStateChange: () => {},
    transport: async (_gameId, envelope) => {
      calls += 1;
      return { status: 200, body: estimate(envelope, `route-${calls}`) };
    },
  });
  const input = () => candidate(
    0,
    buildDrawingPreviewSafeContextFingerprint({ state, requesterPlayerId: 'p1', eligible: true }),
  );
  scheduler.setCandidate(input());
  clock.advance(225);
  await flush();
  state.publicState.thisTurn.identity.sourceContextKey = 'public-b';
  state.publicState.thisTurn.battleLog.buildLinesByPlayerId.p1 = ['1 x FIG'];
  scheduler.setCandidate(input());
  clock.advance(1000);
  assert(calls === 1, 'Battle Log-only full GET enqueued a POST');
  state.publicState.visibleDice.effectiveDiceRollByPlayerId.p1 = 5;
  scheduler.setCandidate(input());
  clock.advance(225);
  await flush();
  assert(calls === 2, 'safe input change did not recalculate unchanged draft');
});

Deno.test('preview route key is learned separately and stale-key retry happens once', async () => {
  const clock = new FakeClock();
  const envelopes: CurrentTurnPreviewEnvelope[] = [];
  let call = 0;
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    onStateChange: () => {},
    transport: async (_gameId, envelope) => {
      envelopes.push(envelope);
      call += 1;
      if (call === 1) return { status: 200, body: estimate(envelope, 'route-a') };
      if (call === 2) {
        return { status: 409, body: { reason: 'source_context_changed', retry: { allowed: true, sourceContextKey: 'route-b' } } };
      }
      return { status: 200, body: estimate(envelope, 'route-b') };
    },
  });
  scheduler.setCandidate(candidate(0));
  clock.advance(225);
  await flush();
  assert(envelopes[0].observed.sourceContextKey === undefined, 'first request leaked a full-GET key');
  scheduler.setCandidate(candidate(1));
  clock.advance(225);
  await flush();
  assert(envelopes[1].observed.sourceContextKey === 'route-a', 'route key was not reused');
  assert(envelopes[2].observed.sourceContextKey === 'route-b', 'stale-key retry was not immediate');
  assert(envelopes.length === 3, 'stale key retried more than once');
});

Deno.test('pause invalidates in-flight acceptance and resume recovers the draft', async () => {
  const clock = new FakeClock();
  const pending = deferred<any>();
  let calls = 0;
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    onStateChange: () => {},
    transport: (_gameId, envelope) => {
      calls += 1;
      return calls === 1
        ? pending.promise
        : Promise.resolve({ status: 200, body: estimate(envelope, 'route-b') });
    },
  });
  scheduler.setCandidate(candidate(1));
  clock.advance(225);
  scheduler.pause('submission_pending');
  pending.resolve({ status: 200, body: estimate({
    observed: { turnNumber: 4, phaseKey: 'build.drawing' },
    draft: candidate(1).draft,
    requestToken: '4.1',
  }, 'route-a') });
  await flush();
  assert(scheduler.getState().kind === 'paused', 'paused response was accepted');
  scheduler.resume(candidate(1));
  clock.advance(225);
  await flush();
  assert(scheduler.getState().kind === 'estimated', 'rejected Ready recovery did not resume');
  scheduler.dispose();
  scheduler.setCandidate(candidate(2));
  clock.advance(1000);
  assert(calls === 2, 'disposed scheduler launched work');
});
