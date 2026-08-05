import assert from 'node:assert/strict';
import { Hono } from 'npm:hono';
import { registerIntentRoutes } from '../../routes/intent_routes.ts';
import type {
  ConditionalWriteResult,
  IntentPersistence,
} from '../../routes/intent_persistence.ts';
import { normalizeAncientGameState } from '../../engine/state/ancientState.ts';
import { replaceChargeDeclarationVisibilityState } from '../../engine/state/chargeDeclarationVisibility.ts';
import { applyIntent } from '../../engine/intent/IntentReducer.ts';
import { filterDrawingPreludeEventsForViewer } from '../../engine/state/drawingPreludeProjection.ts';
import { buildBattleLogTurnSummaryFromScratch } from '../../engine/state/battleLogHistory.ts';

type Write = { key: string; value: any };

class ScriptedPersistence implements IntentPersistence {
  readonly store = new Map<string, any>();
  readonly writes: Write[] = [];
  readonly operationLog: string[] = [];
  gameUpdateScript: Array<'conflict' | 'error'> = [];
  gameConflictReplacementStates: any[] = [];
  failHistoryLoads = false;
  historyInsertConflictStore: any | null = null;
  historyLoadCount = 0;
  private gameLoadBarrier: Promise<void> | null = null;
  private releaseGameLoads: (() => void) | null = null;
  private waitingGameLoads = 0;

  enableTwoLoadBarrier() {
    this.gameLoadBarrier = new Promise((resolve) => {
      this.releaseGameLoads = resolve;
    });
  }

  async load(key: string) {
    if (key.startsWith('game_history_') && this.failHistoryLoads) {
      return { status: 'error' as const, error: { message: 'history unavailable' } };
    }
    if (key.startsWith('game_history_')) this.historyLoadCount += 1;
    if (!this.store.has(key)) return { status: 'missing' as const };
    const value = structuredClone(this.store.get(key));
    if (key.startsWith('game_') && !key.startsWith('game_history_') && this.gameLoadBarrier) {
      this.waitingGameLoads += 1;
      if (this.waitingGameLoads === 2) this.releaseGameLoads?.();
      await this.gameLoadBarrier;
      if (this.waitingGameLoads === 2) {
        this.gameLoadBarrier = null;
        this.releaseGameLoads = null;
      }
    }
    return { status: 'found' as const, value };
  }

  async conditionalUpdate(args: Parameters<IntentPersistence['conditionalUpdate']>[0]): Promise<ConditionalWriteResult> {
    if (args.revisionField === 'stateRevision') {
      const scripted = this.gameUpdateScript.shift();
      if (scripted === 'conflict') {
        const replacement = this.gameConflictReplacementStates.shift();
        if (replacement) this.store.set(args.key, structuredClone(replacement));
        this.operationLog.push('game-conflict');
        return { status: 'conflict' };
      }
      if (scripted === 'error') {
        return { status: 'error', error: { message: 'game write failed' } };
      }
    }
    const current = this.store.get(args.key);
    if (!current) return { status: 'conflict' };
    const hasRevision = Object.prototype.hasOwnProperty.call(
      current,
      args.revisionField,
    );
    const matches = args.expected.kind === 'missing'
      ? !hasRevision
      : args.expected.kind === 'valid' &&
        current[args.revisionField] === args.expected.revision;
    if (!matches) return { status: 'conflict' };
    const value = structuredClone(args.value);
    this.store.set(args.key, value);
    this.writes.push({ key: args.key, value });
    this.operationLog.push(
      args.revisionField === 'stateRevision' ? 'game-updated' : 'history-updated',
    );
    return { status: 'updated' };
  }

  async insertIfMissing(key: string, value: any): Promise<ConditionalWriteResult> {
    if (key.startsWith('game_history_') && this.historyInsertConflictStore) {
      this.store.set(key, structuredClone(this.historyInsertConflictStore));
      this.historyInsertConflictStore = null;
      return { status: 'conflict' };
    }
    if (this.store.has(key)) return { status: 'conflict' };
    const copy = structuredClone(value);
    this.store.set(key, copy);
    this.writes.push({ key, value: copy });
    this.operationLog.push(
      key.startsWith('game_history_') ? 'history-inserted' : 'row-inserted',
    );
    return { status: 'updated' };
  }
}

function createApp(
  persistence: ScriptedPersistence,
  sideStore = new Map<string, any>(),
) {
  const app = new Hono();
  registerIntentRoutes(
    app,
    async (key) => structuredClone(sideStore.get(key)),
    async (key, value) => {
      sideStore.set(key, structuredClone(value));
      persistence.operationLog.push(`side-write:${key}`);
    },
    async (c) => ({ sessionId: c.req.header('x-player-id') ?? 'p1' }),
    persistence,
  );
  return app;
}

function createBuildState(gameId: string) {
  return normalizeAncientGameState({
    gameId,
    status: 'active',
    stateRevision: 5,
    turnNumber: 1,
    players: [
      { id: 'p1', name: 'One', role: 'player', faction: 'human', health: 25, lines: 12, joiningLines: 0 },
      { id: 'p2', name: 'Two', role: 'player', faction: 'human', health: 25, lines: 12, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 1,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: { p1: [], p2: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 1,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        commitments: {},
      },
    },
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
  }).state;
}

function createDrawingPreludeCarrierState(gameId: string) {
  const state: any = createBuildState(gameId);
  state.gameData.ships.p1 = [{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 1, createdTurn: 0 }];
  state.gameData.turnData.drawingPreludeByPlayerId = {
    p1: {
      turnNumber: 1,
      requiredPassCount: 1,
      activePassIndex: 1,
      status: 'awaiting_actions',
      eligibleSourcePowers: [{ key: 'car-1:CAR#0', sourceInstanceId: 'car-1', shipDefId: 'CAR', rawPowerIndex: 0, mode: 'interactive' }],
      resolvedSourcePowerKeysByPass: {},
    },
  };
  state.gameData.turnData.buildDrawingPublicFleetByPlayerId = {
    p1: structuredClone(state.gameData.ships.p1),
    p2: [],
  };
  return state;
}

function createIndependentDrawingPreludeSubmissionState(gameId: string) {
  const state: any = createBuildState(gameId);
  state.gameData.ships.p2 = [{ instanceId: 'p2-car', shipDefId: 'CAR', chargesCurrent: 1, createdTurn: 0 }];
  state.gameData.turnData.drawingPreludeByPlayerId = {
    p1: {
      turnNumber: 1,
      requiredPassCount: 1,
      activePassIndex: 1,
      status: 'complete',
      eligibleSourcePowers: [],
      resolvedSourcePowerKeysByPass: {},
    },
    p2: {
      turnNumber: 1,
      requiredPassCount: 1,
      activePassIndex: 1,
      status: 'awaiting_actions',
      eligibleSourcePowers: [{ key: 'p2-car:CAR#0', sourceInstanceId: 'p2-car', shipDefId: 'CAR', rawPowerIndex: 0, mode: 'interactive' }],
      resolvedSourcePowerKeysByPass: {},
    },
  };
  state.gameData.turnData.buildDrawingPublicFleetByPlayerId = { p1: [], p2: structuredClone(state.gameData.ships.p2) };
  return state;
}

function createBotCubeState(gameId: string, cubeValues: [number, number]) {
  const cubeShips = cubeValues.map((_, index) => ({
    instanceId: `transferred-cube-0${index + 1}`,
    shipDefId: 'CUB',
    createdTurn: 1,
  }));
  return normalizeAncientGameState({
    gameId,
    status: 'active',
    stateRevision: 5,
    turnNumber: 2,
    players: [
      { id: 'human', name: 'Human', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', name: 'Bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'CEN', chosenPlanId: 'cen_greed_kno_des' },
    },
    gameData: {
      turnNumber: 2,
      currentPhase: 'build',
      currentSubPhase: 'dice_roll',
      diceRoll: 2,
      ships: {
        human: [],
        bot: [...cubeShips, {
          instanceId: 'owned-kno',
          shipDefId: 'KNO',
          createdTurn: 1,
        }],
      },
      phaseReadiness: [{
        playerId: 'human',
        isReady: true,
        currentStep: 'build.dice_roll',
      }],
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 2,
        currentMajorPhase: 'build',
        currentSubPhase: 'dice_roll',
        diceManipulationStage: 'cube',
        diceRolled: true,
        diceFinalized: false,
        baseDiceRoll: 2,
        effectiveDiceRoll: 2,
        diceRoll: 2,
        effectiveDiceRollByPlayerId: { human: 2, bot: 2 },
        cubeDiceRollsByPlayerId: {
          bot: cubeShips.map((ship, index) => ({
            sourceInstanceId: ship.instanceId,
            value: cubeValues[index],
          })),
        },
        visibleCubeDiceValueByPlayerId: { bot: cubeValues[0] },
        chronoswarmRolls: [],
        chronoswarmCountByPlayerId: { human: 0, bot: 0 },
        chronoswarmSharedRollCount: 0,
      },
    },
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
  }).state;
}

function intentRequest(app: Hono, gameId: string, playerId: string, body: any) {
  return app.request('/make-server-825e19ab/intent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-player-id': playerId,
    },
    body: JSON.stringify({ gameId, turnNumber: 1, ...body }),
  });
}

Deno.test('concurrent duplicate Drawing-prelude Carrier action commits once and stale retry is HTTP 400', async () => {
  const gameId = 'concurrent-drawing-prelude-carrier';
  const persistence = new ScriptedPersistence();
  const initialState = createDrawingPreludeCarrierState(gameId);
  persistence.store.set(`game_${gameId}`, initialState);
  persistence.enableTwoLoadBarrier();
  const app = createApp(persistence);
  const body = {
    intentType: 'ACTION' as const,
    nonce: 'carrier-defender',
    payload: { actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-1', choiceId: 'defender' },
  };

  const responses = await Promise.all([
    intentRequest(app, gameId, 'p1', body),
    intentRequest(app, gameId, 'p1', body),
  ]);
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 400]);
  const rejectedResponse = responses.find((response) => response.status === 400)!;
  const rejectedBody = await rejectedResponse.json();
  assert.equal(rejectedBody.rejected.code, 'BAD_PAYLOAD');
  const acceptedResponse = responses.find((response) => response.status === 200)!;
  const acceptedBody = await acceptedResponse.json();
  assert.equal(acceptedBody.events.some((event: any) => event.type === 'EFFECT_APPLIED'), true);
  assert.equal(acceptedBody.events.some((event: any) => event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'), true);
  assert.equal(acceptedBody.events.some((event: any) => event.type === 'POWER_USED'), true);
  assert.equal(acceptedBody.events.some((event: any) => 'drawingPreludeVisibility' in event), false);

  const canonicalResult = await applyIntent(initialState, 'p1', {
    gameId,
    turnNumber: 1,
    ...body,
  }, 10);
  assert.equal(canonicalResult.ok, true);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(canonicalResult.state, 'p2', canonicalResult.events), []);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(canonicalResult.state, undefined, canonicalResult.events), []);

  const committed = persistence.store.get(`game_${gameId}`);
  assert.equal(committed.stateRevision, 6);
  assert.equal(committed.gameData.ships.p1.filter((ship: any) => ship.shipDefId === 'DEF').length, 1);
  assert.equal(committed.gameData.turnData.drawingPreludeByPlayerId.p1.resolvedSourcePowerKeysByPass[1].length, 1);
  assert.equal(committed.gameData.turnData.shipActivationCueBatches[0].sources.length, 1);
  assert.equal(
    committed.battleLogScratch.currentTurnCapture.buildAtomsByPlayerId.p1.filter((atom: any) => atom.kind === 'produced_build').length,
    1,
  );
  const summary = buildBattleLogTurnSummaryFromScratch({
    scratch: committed.battleLogScratch,
    finalizedTurnNumber: 1,
    finalizedState: committed,
  });
  assert.equal(summary.buildLinesByPlayerId.p1.length, 1);
  assert.match(summary.buildLinesByPlayerId.p1[0], /DEF/);
  assert.deepEqual(
    buildBattleLogTurnSummaryFromScratch({
      scratch: committed.battleLogScratch,
      finalizedTurnNumber: 1,
      finalizedState: committed,
    }).buildLinesByPlayerId.p1,
    summary.buildLinesByPlayerId.p1,
  );
  assert.equal(persistence.writes.filter((write) => write.key === `game_${gameId}`).length, 1);
});

Deno.test('complete requester may submit while opponent Drawing prelude remains awaiting', async () => {
  const gameId = 'independent-drawing-prelude-submit';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createIndependentDrawingPreludeSubmissionState(gameId));
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT',
    nonce: 'p1-independent',
    payload: { builds: [{ shipDefId: 'DEF', count: 1 }] },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.state.gameData.currentSubPhase, 'drawing');

  const storedAfterSubmit = persistence.store.get(`game_${gameId}`);
  assert.equal(storedAfterSubmit.stateRevision, 6);
  assert.ok(storedAfterSubmit.gameData.turnData.commitments.BUILD_1.p1);
  assert.equal(storedAfterSubmit.gameData.turnData.commitments.BUILD_1.p2, undefined);
  assert.equal(storedAfterSubmit.gameData.turnData.drawingPreludeByPlayerId.p2.status, 'awaiting_actions');
  assert.equal(storedAfterSubmit.gameData.currentSubPhase, 'drawing');
  assert.equal(storedAfterSubmit.gameData.ships.p1.some((ship: any) => ship.shipDefId === 'DEF'), false);
});

Deno.test('concurrent p1 and p2 BUILD_SUBMIT requests retry CAS and preserve both accepted mutations', async () => {
  const gameId = 'concurrent-builds';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createBuildState(gameId));
  persistence.enableTwoLoadBarrier();
  const app = createApp(persistence);

  const [p1Response, p2Response] = await Promise.all([
    intentRequest(app, gameId, 'p1', {
      intentType: 'BUILD_SUBMIT',
      nonce: 'p1-nonce',
      payload: { builds: [] },
    }),
    intentRequest(app, gameId, 'p2', {
      intentType: 'BUILD_SUBMIT',
      nonce: 'p2-nonce',
      payload: { builds: [] },
    }),
  ]);

  assert.equal(p1Response.status, 200);
  assert.equal(p2Response.status, 200);
  const stored = persistence.store.get(`game_${gameId}`);
  assert.equal(stored.stateRevision, 7);
  const commitments = stored.gameData.turnData.commitments.BUILD_1;
  assert.ok(commitments.p1);
  assert.ok(commitments.p2);
  assert.equal(
    persistence.writes.filter((write) => write.key === `game_${gameId}`).length,
    2,
  );
});

Deno.test('three game conflicts return 409 with no accepted events or side effects', async () => {
  const gameId = 'conflict-exhaustion';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createBuildState(gameId));
  persistence.gameUpdateScript = ['conflict', 'conflict', 'conflict'];
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT',
    nonce: 'p1-nonce',
    payload: { builds: [] },
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.ok, false);
  assert.equal(body.rejected.code, 'PERSISTENCE_CONFLICT_RETRY_EXHAUSTED');
  assert.deepEqual(body.events, []);
  assert.equal(persistence.writes.length, 0);
  assert.equal(persistence.store.get(`game_${gameId}`).stateRevision, 5);
});

Deno.test('bot effects are abandoned after conflict and rerun from the reloaded authoritative state', async () => {
  const gameId = 'bot-conflict-retry';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createBotCubeState(gameId, [4, 6]));
  const replacement: any = createBotCubeState(gameId, [5, 3]);
  replacement.stateRevision = 6;
  persistence.gameUpdateScript = ['conflict'];
  persistence.gameConflictReplacementStates = [replacement];
  const response = await createApp(persistence).request(
    '/make-server-825e19ab/intent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-player-id': 'human' },
      body: JSON.stringify({
        gameId,
        turnNumber: 2,
        intentType: 'ACTION',
        nonce: 'human-message',
        payload: { actionType: 'message', content: 'rerun bots' },
      }),
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.state.stateRevision, 7);
  assert.deepEqual(
    body.state.gameData.turnData.cubeDiceSelectionByPlayerId.bot,
    {
      choiceId: 'cube:transferred-cube-01',
      value: 5,
      sourceInstanceId: 'transferred-cube-01',
    },
  );
  assert.equal(
    body.events.some((event: any) => event.type === 'BOT_INTENT_REJECTED'),
    false,
  );
  assert.equal(
    body.events.filter((event: any) =>
      event.type === 'PLAYER_READY' && event.playerId === 'bot'
    ).length,
    2,
  );
  assert.deepEqual(
    persistence.operationLog.slice(0, 2),
    ['game-conflict', 'game-updated'],
  );
});

Deno.test('chat is appended once only after the successful game CAS', async () => {
  const gameId = 'chat-cas-ordering';
  const persistence = new ScriptedPersistence();
  const sideStore = new Map<string, any>();
  persistence.store.set(`game_${gameId}`, createBuildState(gameId));
  persistence.gameUpdateScript = ['conflict'];
  const app = createApp(persistence, sideStore);
  const response = await app.request('/make-server-825e19ab/intent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-player-id': 'p1' },
    body: JSON.stringify({
      gameId,
      turnNumber: 1,
      intentType: 'ACTION',
      nonce: 'chat-nonce',
      payload: { actionType: 'message', content: 'one message' },
    }),
  });
  const body = await response.json();
  const chatKey = `game_${gameId}_chat`;

  assert.equal(response.status, 200);
  assert.equal(body.events.filter((event: any) => event.type === 'CHAT_MESSAGE').length, 1);
  assert.equal(sideStore.get(chatKey).entries.length, 1);
  assert.equal(sideStore.get(chatKey).entries[0].content, 'one message');
  assert.deepEqual(persistence.operationLog, [
    'game-conflict',
    'game-updated',
    `side-write:${chatKey}`,
  ]);
});

Deno.test('conflict reload can turn an initially legal intent into an authoritative rejection without stale events', async () => {
  const gameId = 'conflict-then-rejection';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createBuildState(gameId));
  const replacement: any = createBuildState(gameId);
  replacement.stateRevision = 6;
  replacement.currentSubPhase = 'line_generation';
  replacement.gameData.currentSubPhase = 'line_generation';
  replacement.gameData.turnData.currentSubPhase = 'line_generation';
  persistence.gameUpdateScript = ['conflict'];
  persistence.gameConflictReplacementStates = [replacement];
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.rejected.code, 'WRONG_PHASE');
  assert.deepEqual(body.events, []);
  assert.equal(persistence.writes.length, 0);
  assert.equal(persistence.store.get(`game_${gameId}`).stateRevision, 6);
  assert.deepEqual(persistence.operationLog, ['game-conflict']);
});

Deno.test('malformed explicit game revisions fail before reducer apply or persistence', async () => {
  const invalidValues = [null, '5', true, 0, -1, 1.5, [], {}];
  for (const invalidValue of invalidValues) {
    const gameId = `invalid-${JSON.stringify(invalidValue)}`;
    const persistence = new ScriptedPersistence();
    const state: any = createBuildState(gameId);
    state.stateRevision = invalidValue;
    persistence.store.set(`game_${gameId}`, state);
    const response = await intentRequest(createApp(persistence), gameId, 'p1', {
      intentType: 'BUILD_SUBMIT',
      nonce: 'p1-nonce',
      payload: { builds: [] },
    });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.rejected.code, 'INVALID_PERSISTED_STATE_REVISION');
    assert.equal(persistence.writes.length, 0);
  }
});

Deno.test('a genuinely missing game revision is normalized from base revision one and conditionally written once', async () => {
  const gameId = 'missing-revision';
  const persistence = new ScriptedPersistence();
  const state: any = createBuildState(gameId);
  delete state.stateRevision;
  persistence.store.set(`game_${gameId}`, state);
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] },
  });

  assert.equal(response.status, 200);
  assert.equal(persistence.store.get(`game_${gameId}`).stateRevision, 2);
  assert.equal(persistence.writes.length, 1);
});

Deno.test('a pre-commit game database error returns 500 without mutating the stored game', async () => {
  const gameId = 'precommit-error';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createBuildState(gameId));
  persistence.gameUpdateScript = ['error'];
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] },
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.rejected.code, 'PERSISTENCE_ERROR');
  assert.equal(persistence.store.get(`game_${gameId}`).stateRevision, 5);
  assert.equal(persistence.writes.length, 0);
});

Deno.test('modern canonical scratch avoids history reads during accepted intent preparation', async () => {
  const gameId = 'modern-scratch-no-history-read';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createBuildState(gameId));
  persistence.failHistoryLoads = true;
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] },
  });

  assert.equal(response.status, 200);
  assert.equal(persistence.historyLoadCount, 0);
  assert.equal(persistence.store.get(`game_${gameId}`).stateRevision, 6);
});

Deno.test('legacy scratch fallback distinguishes missing history from a history read error', async () => {
  const errorGameId = 'legacy-history-error';
  const failedPersistence = new ScriptedPersistence();
  const failedState: any = createBuildState(errorGameId);
  delete failedState.battleLogScratch;
  failedPersistence.store.set(`game_${errorGameId}`, failedState);
  failedPersistence.failHistoryLoads = true;
  const failedResponse = await intentRequest(
    createApp(failedPersistence),
    errorGameId,
    'p1',
    { intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] } },
  );
  const failedBody = await failedResponse.json();
  assert.equal(failedResponse.status, 500);
  assert.equal(failedBody.rejected.code, 'PERSISTENCE_ERROR');
  assert.equal(failedPersistence.writes.length, 0);
  assert.equal(failedPersistence.store.get(`game_${errorGameId}`).stateRevision, 5);

  const missingGameId = 'legacy-history-missing';
  const missingPersistence = new ScriptedPersistence();
  const missingState: any = createBuildState(missingGameId);
  delete missingState.battleLogScratch;
  missingPersistence.store.set(`game_${missingGameId}`, missingState);
  const missingResponse = await intentRequest(
    createApp(missingPersistence),
    missingGameId,
    'p1',
    { intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] } },
  );
  assert.equal(missingResponse.status, 200);
  assert.equal(missingPersistence.historyLoadCount, 1);
  assert.equal(missingPersistence.store.get(`game_${missingGameId}`).stateRevision, 6);
});

function createTerminalDeclarationState(gameId: string) {
  const ships = {
    p1: [{ instanceId: 'p1-int', shipDefId: 'INT', chargesCurrent: 1 }],
    p2: [{ instanceId: 'p2-int', shipDefId: 'INT', chargesCurrent: 1 }],
  };
  const state: any = normalizeAncientGameState({
    gameId,
    status: 'active',
    stateRevision: 5,
    turnNumber: 3,
    players: [
      { id: 'p1', name: 'One', role: 'player', faction: 'human', isActive: true, health: 20, lines: 0, joiningLines: 0 },
      { id: 'p2', name: 'Two', role: 'player', faction: 'human', isActive: true, health: 5, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [],
      ships,
      voidShipsByPlayerId: { p1: [], p2: [] },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: { p1: ['p1-int'], p2: ['p2-int'] },
        solarGridDeclarationSourceIdsByPlayerId: { p1: [], p2: [] },
        chargeDeclarationFleetSnapshotByPlayerId: structuredClone(ships),
        chargePowerUsedByInstanceId: {},
      },
    },
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
  }).state;
  replaceChargeDeclarationVisibilityState(state);
  return state;
}

function terminalSubmitter(app: Hono, gameId: string) {
  return (playerId: string, body: any) =>
    app.request('/make-server-825e19ab/intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-player-id': playerId },
      body: JSON.stringify({ gameId, turnNumber: 3, ...body }),
    });
}

async function reachTerminalFinalization(submit: ReturnType<typeof terminalSubmitter>) {
  assert.equal((await submit('p2', {
    intentType: 'ACTION',
    nonce: 'p2-hold',
    payload: { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p2-int', choiceId: 'hold' },
  })).status, 200);
  assert.equal((await submit('p2', {
    intentType: 'DECLARE_READY', nonce: 'p2-ready', payload: {},
  })).status, 200);
  assert.equal((await submit('p1', {
    intentType: 'ACTION',
    nonce: 'p1-damage',
    payload: { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p1-int', choiceId: 'damage' },
  })).status, 200);
}

Deno.test('post-CAS history failure cannot turn a terminal accepted intent into HTTP failure', async () => {
  const gameId = 'history-after-commit';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createTerminalDeclarationState(gameId));
  const app = createApp(persistence);
  const submit = terminalSubmitter(app, gameId);
  await reachTerminalFinalization(submit);

  persistence.failHistoryLoads = true;
  const finalResponse = await submit('p1', {
    intentType: 'DECLARE_READY', nonce: 'p1-ready', payload: {},
  });
  const finalBody = await finalResponse.json();
  assert.equal(finalResponse.status, 200);
  assert.equal(finalBody.ok, true);
  assert.equal(finalBody.state.status, 'finished');
  assert.ok(finalBody.events.some((event: any) => event.type === 'GAME_OVER'));
  const committed = persistence.store.get(`game_${gameId}`);
  assert.equal(committed.status, 'finished');
  assert.equal(committed.battleLogScratch.archiveCheckpoint.acceptedStateRevision, committed.stateRevision);
  assert.equal(persistence.store.has(`game_history_${gameId}`), false);

  const committedRevision = committed.stateRevision;
  persistence.failHistoryLoads = false;
  await submit('p1', {
    intentType: 'DECLARE_READY', nonce: 'after-finish', payload: {},
  });
  const history = persistence.store.get(`game_history_${gameId}`);
  assert.equal(history.completedTurnCount, 1);
  assert.equal(history.turns.length, 1);
  assert.equal(persistence.store.get(`game_${gameId}`).stateRevision, committedRevision);
});

Deno.test('history CAS conflict reloads the newest store before appending the checkpoint', async () => {
  const gameId = 'history-conflict-reload';
  const persistence = new ScriptedPersistence();
  persistence.store.set(`game_${gameId}`, createTerminalDeclarationState(gameId));
  const app = createApp(persistence);
  const submit = terminalSubmitter(app, gameId);
  await reachTerminalFinalization(submit);
  persistence.historyInsertConflictStore = {
    gameId,
    revision: 1,
    completedTurnCount: 1,
    turns: [{
      turnNumber: 1,
      diceValue: 1,
      players: [],
      buildLinesByPlayerId: {},
      battleLinesByPlayerId: {},
    }],
    currentTurnCapture: null,
  };
  const historyLoadsBefore = persistence.historyLoadCount;

  const response = await submit('p1', {
    intentType: 'DECLARE_READY', nonce: 'p1-ready', payload: {},
  });
  assert.equal(response.status, 200);
  const history = persistence.store.get(`game_history_${gameId}`);
  assert.equal(history.revision, 2);
  assert.deepEqual(history.turns.map((turn: any) => turn.turnNumber), [1, 3]);
  assert.ok(persistence.historyLoadCount - historyLoadsBefore >= 2);
});

Deno.test('unresolved checkpoint survives an accepted non-finalizing CAS byte-for-byte', async () => {
  const gameId = 'checkpoint-preservation';
  const persistence = new ScriptedPersistence();
  const state: any = createBuildState(gameId);
  const checkpoint = {
    finalizedTurnNumber: 4,
    acceptedStateRevision: 4,
    summary: {
      turnNumber: 4,
      diceValue: 6,
      players: [],
      buildLinesByPlayerId: { p1: ['1 x Scout'] },
      battleLinesByPlayerId: { p1: ['1 x Frigate hit'] },
    },
  };
  state.battleLogScratch.archiveCheckpoint = structuredClone(checkpoint);
  persistence.store.set(`game_${gameId}`, state);
  persistence.failHistoryLoads = true;
  const response = await intentRequest(createApp(persistence), gameId, 'p1', {
    intentType: 'BUILD_SUBMIT', nonce: 'p1', payload: { builds: [] },
  });

  assert.equal(response.status, 200);
  assert.equal(
    JSON.stringify(persistence.store.get(`game_${gameId}`).battleLogScratch.archiveCheckpoint),
    JSON.stringify(checkpoint),
  );
});

Deno.test('unresolved or divergent earlier checkpoint blocks only the newer finalizing CAS', async () => {
  for (const mode of ['unresolved', 'divergent'] as const) {
    const gameId = `blocked-finalization-${mode}`;
    const persistence = new ScriptedPersistence();
    const state = createTerminalDeclarationState(gameId);
    const checkpoint = {
      finalizedTurnNumber: 2,
      acceptedStateRevision: 4,
      summary: {
        turnNumber: 2,
        diceValue: 2,
        players: [],
        buildLinesByPlayerId: { p1: ['1 x Scout'] },
        battleLinesByPlayerId: { p1: [] },
      },
    };
    state.battleLogScratch.archiveCheckpoint = structuredClone(checkpoint);
    persistence.store.set(`game_${gameId}`, state);
    if (mode === 'unresolved') {
      persistence.failHistoryLoads = true;
    } else {
      persistence.store.set(`game_history_${gameId}`, {
        gameId,
        revision: 1,
        completedTurnCount: 1,
        turns: [{
          ...checkpoint.summary,
          buildLinesByPlayerId: { p1: ['1 x Destroyer'] },
        }],
        currentTurnCapture: null,
      });
    }
    const app = createApp(persistence);
    const submit = (playerId: string, body: any) =>
      app.request('/make-server-825e19ab/intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-player-id': playerId },
        body: JSON.stringify({ gameId, turnNumber: 3, ...body }),
      });

    assert.equal((await submit('p2', {
      intentType: 'ACTION', nonce: 'p2-hold',
      payload: { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p2-int', choiceId: 'hold' },
    })).status, 200);
    assert.equal((await submit('p2', {
      intentType: 'DECLARE_READY', nonce: 'p2-ready', payload: {},
    })).status, 200);
    assert.equal((await submit('p1', {
      intentType: 'ACTION', nonce: 'p1-damage',
      payload: { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p1-int', choiceId: 'damage' },
    })).status, 200);
    const revisionBeforeFinalization = persistence.store.get(`game_${gameId}`).stateRevision;
    const blocked = await submit('p1', {
      intentType: 'DECLARE_READY', nonce: 'p1-ready', payload: {},
    });
    const blockedBody = await blocked.json();

    assert.equal(blocked.status, mode === 'unresolved' ? 503 : 500);
    assert.equal(
      blockedBody.rejected.code,
      mode === 'unresolved'
        ? 'HISTORY_ARCHIVE_FINALIZATION_BLOCKED'
        : 'HISTORY_ARCHIVE_DIVERGENCE',
    );
    assert.deepEqual(blockedBody.events, []);
    assert.equal(
      persistence.store.get(`game_${gameId}`).stateRevision,
      revisionBeforeFinalization,
    );
    assert.equal(
      JSON.stringify(persistence.store.get(`game_${gameId}`).battleLogScratch.archiveCheckpoint),
      JSON.stringify(checkpoint),
    );
  }
});
