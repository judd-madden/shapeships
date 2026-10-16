import assert from 'node:assert/strict';
import { Hono } from 'npm:hono';
import { runBotsUntilSettled } from '../../engine/bot/botRunner.ts';
import { accrueClocks } from '../../engine/clock/clock.ts';
import { applyIntent } from '../../engine/intent/IntentReducer.ts';
import { registerGameRoutes } from '../../routes/game_routes.ts';
import type {
  ConditionalWriteResult,
  GameHeadPersistence,
  IntentPersistence,
} from '../../routes/intent_persistence.ts';

type GameRoutePersistence = Pick<
  IntentPersistence,
  'load' | 'conditionalUpdate' | 'insertIfMissing'
> & GameHeadPersistence;

class MemoryPersistence implements GameRoutePersistence {
  readonly store = new Map<string, any>();
  conditionalAttempts = 0;
  conflictSourceOnNextWrite: { key: string; value: any } | null = null;
  errorOnConditionalAttempt: number | null = null;
  errorOnNextInsertKey: string | null = null;

  async load(key: string) {
    if (!this.store.has(key)) return { status: 'missing' as const };
    return {
      status: 'found' as const,
      value: structuredClone(this.store.get(key)),
    };
  }

  async conditionalUpdate(
    args: Parameters<IntentPersistence['conditionalUpdate']>[0],
  ): Promise<ConditionalWriteResult> {
    this.conditionalAttempts += 1;
    if (this.errorOnConditionalAttempt === this.conditionalAttempts) {
      this.errorOnConditionalAttempt = null;
      return { status: 'error', error: { message: 'injected write failure' } };
    }
    if (this.conflictSourceOnNextWrite?.key === args.key) {
      this.store.set(
        args.key,
        structuredClone(this.conflictSourceOnNextWrite.value),
      );
      this.conflictSourceOnNextWrite = null;
      return { status: 'conflict' };
    }
    const current = this.store.get(args.key);
    if (!current) return { status: 'conflict' };
    const currentRevision = current[args.revisionField];
    const matches = args.expected.kind === 'valid'
      ? currentRevision === args.expected.revision
      : args.expected.kind === 'missing' &&
        !Object.prototype.hasOwnProperty.call(current, args.revisionField);
    if (!matches) return { status: 'conflict' };
    this.store.set(args.key, structuredClone(args.value));
    return { status: 'updated' };
  }

  async insertIfMissing(
    key: string,
    value: any,
  ): Promise<ConditionalWriteResult> {
    if (this.errorOnNextInsertKey === key) {
      this.errorOnNextInsertKey = null;
      return { status: 'error', error: { message: 'injected insert failure' } };
    }
    if (this.store.has(key)) return { status: 'conflict' };
    this.store.set(key, structuredClone(value));
    return { status: 'updated' };
  }

  async loadGameHead(key: string) {
    return this.store.has(key)
      ? { status: 'found' as const, value: null }
      : { status: 'missing' as const };
  }

  async conditionalUpdateGameHead(): Promise<ConditionalWriteResult> {
    return { status: 'conflict' };
  }
}

function createFixture(candidates: string[]) {
  const persistence = new MemoryPersistence();
  const app = new Hono();
  let sessionId = 'human';
  registerGameRoutes(
    app,
    async (key) => structuredClone(persistence.store.get(key)),
    async (key, value) => {
      persistence.store.set(key, structuredClone(value));
    },
    async () => ({ sessionId }),
    () => candidates.shift() ?? 'FALLBK',
    persistence,
  );
  return {
    app,
    persistence,
    setSessionId(value: string) {
      sessionId = value;
    },
  };
}

async function post(app: Hono, path: string, body: unknown = {}) {
  const response = await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function createComputer(
  fixture: ReturnType<typeof createFixture>,
  winStreakCount?: unknown,
) {
  const payload: Record<string, unknown> = {
    playerName: 'Player One',
    timed: true,
    minutes: 5,
    incrementSeconds: 3,
  };
  if (typeof winStreakCount !== 'undefined') {
    payload.winStreakCount = winStreakCount;
  }
  return await post(
    fixture.app,
    '/make-server-825e19ab/create-computer-game',
    payload,
  );
}

Deno.test('bot creation validates and persists the fixed win-streak bonus', async () => {
  for (
    const invalid of [
      '5',
      -1,
      1.5,
      null,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]
  ) {
    const fixture = createFixture(['BAD001']);
    const result = await createComputer(fixture, invalid);
    assert.equal(result.response.status, 400, String(invalid));
    assert.equal(fixture.persistence.store.has('game_BAD001'), false);
  }

  const fixture = createFixture(['BOT001', 'BOT002']);
  const created = await createComputer(fixture, 5);
  assert.equal(created.response.status, 200);
  const state = fixture.persistence.store.get('game_BOT001');
  assert.deepEqual(state.gameData.winStreakBonus, {
    appliedCount: 5,
    recipientPlayerId: 'bot_BOT001',
  });
  assert.deepEqual(state.players.map((player: any) => player.lines), [3, 3]);

  const omitted = await createComputer(fixture);
  assert.equal(omitted.response.status, 200);
  assert.equal(
    fixture.persistence.store.get('game_BOT002').gameData.winStreakBonus.appliedCount,
    0,
  );

  const boundaryFixture = createFixture(['ZERO01', 'MAX001']);
  const zero = await createComputer(boundaryFixture, 0);
  const maximum = await createComputer(boundaryFixture, Number.MAX_SAFE_INTEGER);
  assert.equal(zero.response.status, 200);
  assert.equal(maximum.response.status, 200);
  assert.equal(
    boundaryFixture.persistence.store.get('game_ZERO01').gameData.winStreakBonus
      .appliedCount,
    0,
  );
  assert.equal(
    boundaryFixture.persistence.store.get('game_MAX001').gameData.winStreakBonus
      .appliedCount,
    Number.MAX_SAFE_INTEGER,
  );
});

Deno.test('multiplayer creation and rematches never persist streak metadata', async () => {
  const fixture = createFixture(['MULTI1', 'MULTI2']);
  const created = await post(
    fixture.app,
    '/make-server-825e19ab/create-game',
    { playerName: 'Player One', timed: false, winStreakCount: 9 },
  );
  assert.equal(created.response.status, 200);
  const source = fixture.persistence.store.get('game_MULTI1');
  assert.equal(source.gameData.winStreakBonus, undefined);

  const projectedResponse = await fixture.app.request(
    '/make-server-825e19ab/game-state/MULTI1',
  );
  const projected = await projectedResponse.json();
  assert.deepEqual(projected.publicState.winStreakBonus, {
    appliedCount: 0,
    recipientPlayerId: null,
  });

  source.status = 'finished';
  source.players.push({
    id: 'other-human',
    name: 'Player Two',
    role: 'player',
  });
  source.controllersByPlayerId = {
    human: { kind: 'human' },
    'other-human': { kind: 'human' },
  };
  fixture.persistence.store.set('game_MULTI1', source);
  const resetRejected = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/MULTI1',
  );
  assert.equal(resetRejected.response.status, 409);
  const rematch = await post(
    fixture.app,
    '/make-server-825e19ab/new-game-from/MULTI1',
    { winStreakCount: 12 },
  );
  assert.equal(rematch.response.status, 200);
  assert.equal(
    fixture.persistence.store.get('game_MULTI2').gameData.winStreakBonus,
    undefined,
  );
});

Deno.test('bot rematches use the new count and full-state projection is read-only', async () => {
  const fixture = createFixture(['SOURCE', 'REMAT1', 'REMAT2']);
  const created = await createComputer(fixture, 5);
  assert.equal(created.response.status, 200);
  const source = fixture.persistence.store.get('game_SOURCE');
  source.status = 'finished';
  source.result = 'win';
  source.resultReason = 'decisive';
  source.winnerPlayerId = 'human';
  fixture.persistence.store.set('game_SOURCE', source);

  const rematch = await post(
    fixture.app,
    '/make-server-825e19ab/new-game-from/SOURCE',
    { winStreakCount: 7 },
  );
  assert.equal(rematch.response.status, 200);
  assert.equal(
    fixture.persistence.store.get('game_REMAT1').gameData.winStreakBonus.appliedCount,
    7,
  );

  const secondSource = structuredClone(source);
  secondSource.gameId = 'SOURCE2';
  fixture.persistence.store.set('game_SOURCE2', secondSource);
  const omitted = await post(
    fixture.app,
    '/make-server-825e19ab/new-game-from/SOURCE2',
  );
  assert.equal(omitted.response.status, 200);
  assert.equal(
    fixture.persistence.store.get('game_REMAT2').gameData.winStreakBonus.appliedCount,
    0,
  );

  const projected = fixture.persistence.store.get('game_REMAT1');
  projected.status = 'active';
  projected.currentPhase = 'build';
  projected.currentSubPhase = 'drawing';
  projected.turnNumber = 1;
  projected.gameData.currentPhase = 'build';
  projected.gameData.currentSubPhase = 'drawing';
  projected.gameData.turnNumber = 1;
  projected.gameData.turnData = {
    turnNumber: 1,
    currentMajorPhase: 'build',
    currentSubPhase: 'drawing',
    effectiveDiceRoll: 4,
    effectiveDiceRollByPlayerId: { human: 4, bot_REMAT1: 4 },
    linesDistributed: false,
  };
  fixture.persistence.store.set('game_REMAT1', projected);
  const before = structuredClone(projected);
  const response = await fixture.app.request(
    '/make-server-825e19ab/game-state/REMAT1',
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.publicState.winStreakBonus, {
    appliedCount: 7,
    recipientPlayerId: 'bot_REMAT1',
  });
  assert.equal(body.publicState.bonusLinesByPlayerId.bot_REMAT1, 7);
  assert.equal(
    body.publicState.bonusBreakdownByPlayerId.bot_REMAT1.some(
      (row: any) => row.label === 'Win Streak' && row.amount === 7,
    ),
    true,
  );
  assert.equal(body.requester.winStreakReset.canRestart, true);
  assert.deepEqual(fixture.persistence.store.get('game_REMAT1'), before);

  const legacy = fixture.persistence.store.get('game_REMAT2');
  delete legacy.gameData.winStreakBonus;
  fixture.persistence.store.set('game_REMAT2', legacy);
  const legacyResponse = await fixture.app.request(
    '/make-server-825e19ab/game-state/REMAT2',
  );
  const legacyBody = await legacyResponse.json();
  assert.deepEqual(legacyBody.publicState.winStreakBonus, {
    appliedCount: 0,
    recipientPlayerId: 'bot_REMAT2',
  });
  assert.equal(legacyBody.requester.winStreakReset.canRestart, false);
});

Deno.test('restart creates one neutral zero-bonus replacement and duplicate calls reuse it', async () => {
  const fixture = createFixture(['SOURCE', 'RESET1']);
  const created = await createComputer(fixture, 5);
  assert.equal(created.response.status, 200);

  const first = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(first.response.status, 200);
  assert.deepEqual(first.body, {
    gameId: 'RESET1',
    sourceGameId: 'SOURCE',
    resetStatus: 'completed',
  });

  const source = fixture.persistence.store.get('game_SOURCE');
  assert.equal(source.status, 'finished');
  assert.equal(source.result, undefined);
  assert.equal(source.winnerPlayerId, undefined);
  assert.equal(source.resultReason, 'restart');
  assert.deepEqual(source.winStreakRestart, {
    kind: 'source',
    status: 'completed',
    replacementGameId: 'RESET1',
  });

  const replacement = fixture.persistence.store.get('game_RESET1');
  assert.deepEqual(replacement.winStreakRestart, {
    kind: 'replacement',
    sourceGameId: 'SOURCE',
  });
  assert.equal(replacement.gameData.winStreakBonus.appliedCount, 0);
  assert.equal(replacement.players[0].name, 'Player One');
  assert.deepEqual(replacement.gameData.clock.timeControl, {
    baseMs: 300_000,
    incrementMs: 3_000,
  });
  assert.equal(
    fixture.persistence.store.get('game_history_RESET1').gameId,
    'RESET1',
  );

  const sourceProjectionResponse = await fixture.app.request(
    '/make-server-825e19ab/game-state/SOURCE',
  );
  const sourceProjection = await sourceProjectionResponse.json();
  assert.equal(sourceProjection.result.resultReason, 'restart');
  assert.equal(sourceProjection.result.winnerPlayerId, null);
  assert.deepEqual(sourceProjection.requester.winStreakReset.lifecycle, {
    kind: 'source',
    status: 'completed',
    sourceGameId: 'SOURCE',
    replacementGameId: 'RESET1',
  });
  const replacementProjectionResponse = await fixture.app.request(
    '/make-server-825e19ab/game-state/RESET1',
  );
  const replacementProjection = await replacementProjectionResponse.json();
  assert.deepEqual(replacementProjection.publicState.winStreakBonus, {
    appliedCount: 0,
    recipientPlayerId: 'bot_RESET1',
  });
  assert.deepEqual(replacementProjection.requester.winStreakReset.lifecycle, {
    kind: 'replacement',
    status: 'completed',
    sourceGameId: 'SOURCE',
    replacementGameId: 'RESET1',
  });

  const ordinaryRematch = await post(
    fixture.app,
    '/make-server-825e19ab/new-game-from/SOURCE',
  );
  assert.equal(ordinaryRematch.response.status, 409);

  const duplicate = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(duplicate.response.status, 200);
  assert.deepEqual(duplicate.body, first.body);
  assert.equal(fixture.persistence.store.has('game_FALLBK'), false);
});

Deno.test('restart collision distinguishes reciprocal recovery from unrelated games and preserves history', async () => {
  const fixture = createFixture(['SOURCE', 'COLLID', 'RESET2']);
  await createComputer(fixture, 3);
  const unrelated = { gameId: 'COLLID', marker: 'do-not-touch' };
  fixture.persistence.store.set('game_COLLID', structuredClone(unrelated));

  const restarted = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(restarted.response.status, 200);
  assert.equal(restarted.body.gameId, 'RESET2');
  assert.deepEqual(fixture.persistence.store.get('game_COLLID'), unrelated);

  const source = fixture.persistence.store.get('game_SOURCE');
  source.stateRevision += 1;
  source.status = 'finished';
  source.resultReason = 'restart';
  source.winStreakRestart = {
    kind: 'source',
    status: 'pending',
    replacementGameId: 'RESET2',
  };
  fixture.persistence.store.set('game_SOURCE', source);
  const existingHistory = fixture.persistence.store.get('game_history_RESET2');
  existingHistory.turns = [{ turnNumber: 1, marker: 'preserve' }];
  existingHistory.completedTurnCount = 1;
  existingHistory.revision = 1;
  fixture.persistence.store.set('game_history_RESET2', existingHistory);

  const recovered = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(recovered.response.status, 200);
  assert.equal(recovered.body.gameId, 'RESET2');
  assert.deepEqual(
    fixture.persistence.store.get('game_history_RESET2').turns,
    [{ turnNumber: 1, marker: 'preserve' }],
  );
});

Deno.test('restart recovers after insertion, history, and completion failures', async () => {
  for (const failure of ['replacement', 'history', 'completion'] as const) {
    const fixture = createFixture(['SOURCE', 'RESET1']);
    await createComputer(fixture, 3);
    if (failure === 'replacement') {
      fixture.persistence.errorOnNextInsertKey = 'game_RESET1';
    } else if (failure === 'history') {
      fixture.persistence.errorOnNextInsertKey = 'game_history_RESET1';
    } else {
      fixture.persistence.errorOnConditionalAttempt = 2;
    }

    const failed = await post(
      fixture.app,
      '/make-server-825e19ab/reset-win-streak/SOURCE',
    );
    assert.equal(failed.response.status, 500, failure);
    assert.equal(
      fixture.persistence.store.get('game_SOURCE').winStreakRestart.status,
      'pending',
      failure,
    );

    const recovered = await post(
      fixture.app,
      '/make-server-825e19ab/reset-win-streak/SOURCE',
    );
    assert.equal(recovered.response.status, 200, failure);
    assert.deepEqual(recovered.body, {
      gameId: 'RESET1',
      sourceGameId: 'SOURCE',
      resetStatus: 'completed',
    });
    assert.equal(
      fixture.persistence.store.get('game_SOURCE').winStreakRestart.status,
      'completed',
    );
  }
});

Deno.test('restart rejects malformed or mismatched existing replacement history', async () => {
  for (const malformedHistory of [
    {
      gameId: 'RESET1',
      revision: 'bad',
      completedTurnCount: 0,
      turns: [],
      currentTurnCapture: null,
    },
    {
      gameId: 'SOMEONE_ELSE',
      revision: 0,
      completedTurnCount: 0,
      turns: [],
      currentTurnCapture: null,
    },
  ]) {
    const fixture = createFixture(['SOURCE', 'RESET1']);
    await createComputer(fixture, 3);
    fixture.persistence.errorOnNextInsertKey = 'game_history_RESET1';
    const interrupted = await post(
      fixture.app,
      '/make-server-825e19ab/reset-win-streak/SOURCE',
    );
    assert.equal(interrupted.response.status, 500);
    fixture.persistence.store.set(
      'game_history_RESET1',
      structuredClone(malformedHistory),
    );

    const retried = await post(
      fixture.app,
      '/make-server-825e19ab/reset-win-streak/SOURCE',
    );
    assert.equal(retried.response.status, 500);
    assert.equal(
      fixture.persistence.store.get('game_SOURCE').winStreakRestart.status,
      'pending',
    );
    assert.deepEqual(
      fixture.persistence.store.get('game_history_RESET1'),
      malformedHistory,
    );
  }
});

Deno.test('human first build and a concurrent accepted build defeat restart eligibility', async () => {
  const fixture = createFixture(['SOURCE', 'UNUSED']);
  await createComputer(fixture, 4);
  const source = fixture.persistence.store.get('game_SOURCE');
  source.gameData.turnNumber = 1;
  source.turnNumber = 1;
  source.currentPhase = 'build';
  source.currentSubPhase = 'drawing';
  source.gameData.currentPhase = 'build';
  source.gameData.currentSubPhase = 'drawing';
  source.gameData.turnData = {
    turnNumber: 1,
    currentMajorPhase: 'build',
    currentSubPhase: 'drawing',
    commitments: {
      BUILD_1: { human: { commitHash: 'accepted' } },
    },
  };
  fixture.persistence.store.set('game_SOURCE', source);
  const rejected = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(rejected.response.status, 409);

  delete source.gameData.turnData.commitments.BUILD_1.human;
  source.stateRevision += 1;
  source.gameData.turnData.buildAppliedTurnNumber = 1;
  fixture.persistence.store.set('game_SOURCE', source);
  const appliedRejected = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(appliedRejected.response.status, 409);

  delete source.gameData.turnData.buildAppliedTurnNumber;
  source.stateRevision += 1;
  fixture.persistence.store.set('game_SOURCE', source);
  const concurrent = structuredClone(source);
  concurrent.stateRevision += 1;
  concurrent.gameData.turnData.commitments.BUILD_1.human = {
    commitHash: 'won-the-race',
  };
  fixture.persistence.conflictSourceOnNextWrite = {
    key: 'game_SOURCE',
    value: concurrent,
  };
  const raced = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(raced.response.status, 409);
  assert.equal(fixture.persistence.store.has('game_UNUSED'), false);
});

Deno.test('bot-first submission permits restart while later and unrelated requests do not', async () => {
  const botFirst = createFixture(['SOURCE', 'RESET1']);
  await createComputer(botFirst, 4);
  const eligible = botFirst.persistence.store.get('game_SOURCE');
  eligible.turnNumber = 1;
  eligible.currentPhase = 'build';
  eligible.currentSubPhase = 'drawing';
  eligible.gameData.turnNumber = 1;
  eligible.gameData.currentPhase = 'build';
  eligible.gameData.currentSubPhase = 'drawing';
  eligible.gameData.turnData = {
    turnNumber: 1,
    currentMajorPhase: 'build',
    currentSubPhase: 'drawing',
    commitments: {
      BUILD_1: { bot_SOURCE: { commitHash: 'bot-is-ready' } },
    },
  };
  botFirst.persistence.store.set('game_SOURCE', eligible);
  const restarted = await post(
    botFirst.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(restarted.response.status, 200);

  const unrelated = createFixture(['SECOND']);
  await createComputer(unrelated, 4);
  unrelated.setSessionId('outsider');
  const forbidden = await post(
    unrelated.app,
    '/make-server-825e19ab/reset-win-streak/SECOND',
  );
  assert.equal(forbidden.response.status, 403);

  unrelated.setSessionId('human');
  const late = unrelated.persistence.store.get('game_SECOND');
  late.turnNumber = 2;
  late.gameData.turnNumber = 2;
  late.currentPhase = 'build';
  late.currentSubPhase = 'dice_roll';
  late.gameData.currentPhase = 'build';
  late.gameData.currentSubPhase = 'dice_roll';
  unrelated.persistence.store.set('game_SECOND', late);
  const tooLate = await post(
    unrelated.app,
    '/make-server-825e19ab/reset-win-streak/SECOND',
  );
  assert.equal(tooLate.response.status, 409);
});

Deno.test('expired human clock persists timeout before fresh restart eligibility', async () => {
  const fixture = createFixture(['SOURCE', 'UNUSED']);
  await createComputer(fixture, 4);
  const source = fixture.persistence.store.get('game_SOURCE');
  source.turnNumber = 1;
  source.currentPhase = 'build';
  source.currentSubPhase = 'dice_roll';
  source.gameData.turnNumber = 1;
  source.gameData.currentPhase = 'build';
  source.gameData.currentSubPhase = 'dice_roll';
  source.gameData.turnData.turnNumber = 1;
  source.gameData.turnData.currentMajorPhase = 'build';
  source.gameData.turnData.currentSubPhase = 'dice_roll';
  source.gameData.phaseReadiness = [];
  source.players[0].faction = 'human';
  source.players[1].faction = 'xenite';
  source.gameData.clock.remainingMsByPlayerId = {
    human: 1,
    bot_SOURCE: 100_000,
  };
  source.gameData.clock.lastUpdateAtMs = Date.now() - 1_000;
  fixture.persistence.store.set('game_SOURCE', source);
  const previousRevision = source.stateRevision;

  const response = await post(
    fixture.app,
    '/make-server-825e19ab/reset-win-streak/SOURCE',
  );
  assert.equal(response.response.status, 409);
  assert.deepEqual(response.body, {
    error: 'Win-streak restart is not available',
  });

  const stored = fixture.persistence.store.get('game_SOURCE');
  assert.equal(stored.status, 'finished');
  assert.equal(stored.stateRevision, previousRevision + 1);
  assert.equal(stored.result, 'win');
  assert.equal(stored.resultReason, 'timeout');
  assert.equal(stored.timeoutLoserId, 'human');
  assert.equal(stored.winnerPlayerId, 'bot_SOURCE');
  assert.equal(stored.winStreakRestart, undefined);
  assert.equal(fixture.persistence.store.has('game_UNUSED'), false);
  assert.equal(fixture.persistence.store.has('game_history_UNUSED'), false);
});

Deno.test('pending restart sources reject intents and remain inert', async () => {
  const fixture = createFixture(['SOURCE']);
  await createComputer(fixture, 4);
  const source = fixture.persistence.store.get('game_SOURCE');
  source.status = 'finished';
  source.resultReason = 'restart';
  source.winStreakRestart = {
    kind: 'source',
    status: 'pending',
    replacementGameId: 'RESET1',
  };
  const before = structuredClone(source);

  const intentResult = await applyIntent(
    source,
    'human',
    {
      gameId: 'SOURCE',
      intentType: 'BUILD_SUBMIT',
      turnNumber: 1,
      payload: {},
      nonce: 'blocked-by-restart',
    },
    Date.now() + 60_000,
  );
  assert.equal(intentResult.ok, false);
  assert.deepEqual(intentResult.state, before);
  assert.deepEqual(intentResult.events, []);

  const botResult = await runBotsUntilSettled({
    state: source,
    nowMs: Date.now() + 60_000,
  });
  assert.equal(botResult.botStepsApplied, 0);
  assert.deepEqual(botResult.state, before);
  assert.deepEqual(botResult.events, []);

  assert.deepEqual(accrueClocks(source, Date.now() + 60_000), before);
  assert.equal(source.result, undefined);
  assert.equal(source.winnerPlayerId, undefined);
});
