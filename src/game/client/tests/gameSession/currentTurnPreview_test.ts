declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  buildDrawingPreviewSafeContextFingerprint,
  createCurrentTurnPreviewScheduler,
  getCurrentTurnPreviewCandidateIdentity,
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
      ...('ownBuildCaptureIdentity' in envelope.observed &&
        envelope.observed.ownBuildCaptureIdentity
        ? { ownBuildCaptureIdentity: envelope.observed.ownBuildCaptureIdentity }
        : {}),
    },
    playerId: 'p1',
    damage: { total: 1, rows: [] },
    healing: { total: 0, rows: [] },
    build: { lines: ['1 x DEF'], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
  };
}

Deno.test('group order and requester capture identity both participate in preview identity', () => {
  const shared = {
    gameId: 'game-1',
    playerId: 'p1',
    turnNumber: 4,
    phaseKey: 'build.drawing' as const,
    safeContextFingerprint: 'safe-a',
  };
  const newestDef = getCurrentTurnPreviewCandidateIdentity({
    ...shared,
    ownBuildCaptureIdentity: 'capture-a',
    draft: {
      builds: [{ shipDefId: 'DEF', count: 1 }, { shipDefId: 'FIG', count: 1 }],
      buildGroupOrder: [
        { shipDefId: 'DEF', afterCaptureSequence: 2 },
        { shipDefId: 'FIG', afterCaptureSequence: 2 },
      ],
    },
  });
  const newestFig = getCurrentTurnPreviewCandidateIdentity({
    ...shared,
    ownBuildCaptureIdentity: 'capture-a',
    draft: {
      builds: [{ shipDefId: 'DEF', count: 1 }, { shipDefId: 'FIG', count: 1 }],
      buildGroupOrder: [
        { shipDefId: 'FIG', afterCaptureSequence: 2 },
        { shipDefId: 'DEF', afterCaptureSequence: 2 },
      ],
    },
  });
  const changedCapture = getCurrentTurnPreviewCandidateIdentity({
    ...shared,
    ownBuildCaptureIdentity: 'capture-b',
    draft: {
      builds: [{ shipDefId: 'DEF', count: 1 }, { shipDefId: 'FIG', count: 1 }],
      buildGroupOrder: [
        { shipDefId: 'DEF', afterCaptureSequence: 2 },
        { shipDefId: 'FIG', afterCaptureSequence: 2 },
      ],
    },
  });

  assert(newestDef.draftFingerprint !== newestFig.draftFingerprint, 'group order was omitted');
  assert(newestDef.identityKey !== newestFig.identityKey, 'order reused a preview candidate');
  assert(newestDef.identityKey !== changedCapture.identityKey, 'changed own capture reused a preview candidate');
});

Deno.test('EVO group metadata participates in preview identity', () => {
  const shared = {
    gameId: 'game-1',
    playerId: 'p1',
    turnNumber: 4,
    phaseKey: 'build.drawing' as const,
    safeContextFingerprint: 'safe-a',
  };
  const draftBase = {
    builds: [{ shipDefId: 'OXF', count: 1 }],
    evolverChoices: [{ sourceKey: 'evo-1', choiceId: 'oxite' as const }],
  };
  const faceNewest = getCurrentTurnPreviewCandidateIdentity({
    ...shared,
    draft: {
      ...draftBase,
      buildGroupOrder: [
        { shipDefId: 'OXF', afterCaptureSequence: 0 },
        { shipDefId: 'OXI', sourceShipDefId: 'EVO', afterCaptureSequence: 0 },
      ],
    },
  });
  const conversionNewest = getCurrentTurnPreviewCandidateIdentity({
    ...shared,
    draft: {
      ...draftBase,
      buildGroupOrder: [
        { shipDefId: 'OXI', sourceShipDefId: 'EVO', afterCaptureSequence: 0 },
        { shipDefId: 'OXF', afterCaptureSequence: 0 },
      ],
    },
  });

  assert(faceNewest.draftFingerprint !== conversionNewest.draftFingerprint);
  assert(faceNewest.identityKey !== conversionNewest.identityKey);
});

Deno.test('unchanged draft refetches its complete ledger when own capture identity changes', async () => {
  const clock = new FakeClock();
  const seenCaptures: string[] = [];
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    onStateChange: () => {},
    transport: async (_gameId, envelope) => {
      seenCaptures.push(
        'ownBuildCaptureIdentity' in envelope.observed
          ? envelope.observed.ownBuildCaptureIdentity ?? 'missing'
          : 'missing',
      );
      const result = estimate(envelope, `route-${seenCaptures.length}`);
      result.build.lines = seenCaptures.length === 1
        ? ['1 x DEF']
        : ['1 x FIG (DRE)', '1 x DEF'];
      return { status: 200, body: result };
    },
  });
  const withCapture = (ownBuildCaptureIdentity: string): CurrentTurnPreviewCandidateInput => ({
    ...candidate(1),
    ownBuildCaptureIdentity,
  });

  scheduler.setCandidate(withCapture('capture-a'));
  clock.advance(225);
  await flush();
  scheduler.setCandidate(withCapture('capture-b'));
  clock.advance(225);
  await flush();

  assert(JSON.stringify(seenCaptures) === JSON.stringify(['capture-a', 'capture-b']));
  const state = scheduler.getState();
  assert(state.kind === 'estimated', 'refreshed complete ledger was not accepted');
  if (state.kind === 'estimated') {
    assert(state.estimate.build.lines[0] === '1 x FIG (DRE)', 'new captured row was missing');
  }
});

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
  assert(
    'draft' in requests[1].envelope &&
      requests[1].envelope.draft.builds[0]?.count === 2,
    'queued draft was not newest',
  );
  requests[1].result.resolve({ status: 200, body: estimate(requests[1].envelope, 'route-b') });
  await flush();
  assert(scheduler.getState().kind === 'estimated', 'newest response not accepted');
});

Deno.test('equivalent Charge or Drawing reapplication preserves the original deadline and in-flight token', async () => {
  const clock = new FakeClock();
  const pending = deferred<{ status: number; body: unknown }>();
  const envelopes: CurrentTurnPreviewEnvelope[] = [];
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    transport: async (_gameId, envelope) => {
      envelopes.push(envelope);
      return pending.promise;
    },
    onStateChange: () => {},
  });

  scheduler.setCandidate(candidate(1));
  clock.advance(100);
  scheduler.setCandidate(candidate(1));
  clock.advance(124);
  assert(envelopes.length === 0, 'equivalent input changed the original deadline');
  clock.advance(1);
  assert(envelopes.length === 1, 'original debounce deadline did not fire');
  const token = envelopes[0].requestToken;
  scheduler.setCandidate(candidate(1));
  assert(envelopes.length === 1, 'equivalent input queued a second request');
  assert(envelopes[0].requestToken === token, 'equivalent input replaced the request token');
  pending.resolve({ status: 200, body: estimate(envelopes[0], 'route-a') });
  await flush();
  assert(scheduler.getState().kind === 'estimated');
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
    draft: candidate(1).draft!,
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

Deno.test('preview accepts a complete paired Autocast variant and rejects malformed pairs', async () => {
  const clock = new FakeClock();
  let malformed = false;
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    onStateChange: () => {},
    transport: async (_gameId, envelope) => {
      const body: any = estimate(envelope, 'route-paired');
      body.withAutocast = malformed
        ? { damage: { total: 7, rows: null }, healing: { total: 8, rows: [] } }
        : { damage: { total: 7, rows: [] }, healing: { total: 8, rows: [] } };
      return { status: 200, body };
    },
  });

  scheduler.setCandidate(candidate(1));
  clock.advance(225);
  await flush();
  const paired = scheduler.getState();
  assert(paired.kind === 'estimated');
  if (paired.kind === 'estimated') {
    assert(paired.estimate.withAutocast?.damage.total === 7);
    assert(paired.estimate.withAutocast?.healing.total === 8);
  }

  malformed = true;
  scheduler.setCandidate(candidate(2));
  clock.advance(225);
  await flush();
  assert(scheduler.getState().kind === 'unavailable');
});

Deno.test('Charge declaration candidates fingerprint complete declarations and reject outdated responses', async () => {
  const clock = new FakeClock();
  const first = deferred<{ status: number; body: unknown }>();
  let calls = 0;
  const chargeCandidate = (
    solarPowerId: 'SLIF' | 'SAST',
    autocastEnabled: boolean,
  ): CurrentTurnPreviewCandidateInput => ({
    gameId: 'game-1',
    playerId: 'p1',
    turnNumber: 4,
    phaseKey: 'battle.charge_declaration',
    safeContextFingerprint: 'charge-safe',
    declaration: {
      contractVersion: 1,
      declarationId: `preview-${solarPowerId}`,
      ordinaryChargeActions: [],
      solarCasts: [{ solarPowerId }],
      autocastEnabled,
    },
  });
  const response = (envelope: CurrentTurnPreviewEnvelope) => {
    if (!('declaration' in envelope)) throw new Error('expected Charge envelope');
    const input = chargeCandidate(
      envelope.declaration.solarCasts[0].solarPowerId as 'SLIF' | 'SAST',
      envelope.declaration.autocastEnabled,
    );
    const identity = getCurrentTurnPreviewCandidateIdentity(input);
    return {
      status: 'estimated',
      requestToken: envelope.requestToken,
      identity: {
        gameId: 'game-1',
        turnNumber: 4,
        phaseKey: 'battle.charge_declaration',
        sourceContextKey: 'charge-route',
        draftKey: 'null-draft',
        declarationFingerprint: identity.declarationFingerprint,
      },
      playerId: 'p1',
      damage: { total: 0, rows: [] },
      healing: { total: 0, rows: [] },
      withChargeDeclaration: {
        damage: { total: input.declaration!.solarCasts[0].solarPowerId === 'SAST' ? 1 : 0, rows: [] },
        healing: { total: input.declaration!.solarCasts[0].solarPowerId === 'SLIF' ? 1 : 0, rows: [] },
        autocastEnabled: input.declaration!.autocastEnabled,
        declarationFingerprint: identity.declarationFingerprint,
      },
      build: { lines: [], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
    };
  };
  const scheduler = createCurrentTurnPreviewScheduler({
    clock,
    onStateChange: () => {},
    transport: async (_gameId, envelope) => {
      calls += 1;
      return calls === 1
        ? first.promise
        : { status: 200, body: response(envelope) };
    },
  });

  const life = chargeCandidate('SLIF', true);
  const asteroid = chargeCandidate('SAST', false);
  assert(
    getCurrentTurnPreviewCandidateIdentity(life).identityKey !==
      getCurrentTurnPreviewCandidateIdentity(asteroid).identityKey,
  );
  scheduler.setCandidate(life);
  clock.advance(225);
  scheduler.setCandidate(asteroid);
  clock.advance(225);
  const firstEnvelope: CurrentTurnPreviewEnvelope = {
    observed: { turnNumber: 4, phaseKey: 'battle.charge_declaration' },
    declaration: life.phaseKey === 'battle.charge_declaration'
      ? life.declaration
      : (() => { throw new Error('expected Charge candidate'); })(),
    requestToken: '4.1',
  };
  first.resolve({ status: 200, body: response(firstEnvelope) });
  await flush();
  await flush();
  const state = scheduler.getState();
  assert(state.kind === 'estimated');
  if (state.kind === 'estimated') {
    assert(
      state.candidate.phaseKey === 'battle.charge_declaration' &&
        state.candidate.declaration.solarCasts[0].solarPowerId === 'SAST',
    );
    assert(state.estimate.withChargeDeclaration?.damage.total === 1);
    assert(state.estimate.withChargeDeclaration?.autocastEnabled === false);
  }
});

Deno.test('Charge preview requires matching identity and variant fingerprints while accepting zero totals', async () => {
  const run = async (variantMatches: boolean) => {
    const clock = new FakeClock();
    const input: CurrentTurnPreviewCandidateInput = {
      gameId: 'game-1', playerId: 'p1', turnNumber: 4,
      phaseKey: 'battle.charge_declaration', safeContextFingerprint: 'charge-safe',
      declaration: {
        contractVersion: 1, declarationId: 'preview-zero',
        ordinaryChargeActions: [], solarCasts: [], autocastEnabled: false,
      },
    };
    const fingerprint = getCurrentTurnPreviewCandidateIdentity(input).declarationFingerprint!;
    const scheduler = createCurrentTurnPreviewScheduler({
      clock,
      onStateChange: () => {},
      transport: async (_gameId, envelope) => ({
        status: 200,
        body: {
          status: 'estimated', requestToken: envelope.requestToken,
          identity: {
            gameId: 'game-1', turnNumber: 4,
            phaseKey: 'battle.charge_declaration', sourceContextKey: 'charge-safe',
            draftKey: 'null', declarationFingerprint: fingerprint,
          },
          playerId: 'p1',
          damage: { total: 1, rows: [] }, healing: { total: 1, rows: [] },
          withChargeDeclaration: {
            damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] },
            autocastEnabled: false,
            declarationFingerprint: variantMatches ? fingerprint : 'wrong',
          },
          build: { lines: [], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
        },
      }),
    });
    scheduler.setCandidate(input);
    clock.advance(225);
    await flush();
    return scheduler.getState();
  };

  const matched = await run(true);
  assert(matched.kind === 'estimated');
  if (matched.kind === 'estimated') {
    assert(matched.estimate.withChargeDeclaration?.damage.total === 0);
  }
  assert((await run(false)).kind === 'unavailable');
});
