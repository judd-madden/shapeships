import assert from 'node:assert/strict';
import { applyIntent, type IntentRequest } from '../../../engine/intent/IntentReducer.ts';
import type { GameState } from '../../../engine/state/GameStateTypes.ts';
import { normalizeAncientGameState } from '../../../engine/state/ancientState.ts';
import { resolvePowerAction } from '../../../engine_shared/resolve/resolvePowerAction.ts';

function stateWithCarrier(): GameState {
  return {
    gameId: 'prelude-intent',
    status: 'active',
    stateRevision: 4,
    players: [
      { id: 'p1', name: 'One', role: 'player', faction: 'human', health: 25, lines: 10, joiningLines: 0 },
      { id: 'p2', name: 'Two', role: 'player', faction: 'human', health: 25, lines: 10, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: { p1: [{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2, createdTurn: 1 }], p2: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        commitments: {},
        drawingPreludeByPlayerId: {
          p1: {
            turnNumber: 3,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: 'awaiting_actions',
            eligibleSourcePowers: [{ key: 'car-1:CAR#0', sourceInstanceId: 'car-1', shipDefId: 'CAR', rawPowerIndex: 0, mode: 'interactive' }],
            resolvedSourcePowerKeysByPass: {},
          },
        },
        buildDrawingPublicFleetByPlayerId: { p1: [], p2: [] },
      },
    },
    actions: [],
    events: [],
    battleLogScratch: { currentTurnCapture: null, lastFinalizedTurnNumber: null, archiveCheckpoint: null },
  } as GameState;
}

function request(intentType: IntentRequest['intentType'], payload?: unknown): IntentRequest {
  return { gameId: 'prelude-intent', intentType, turnNumber: 3, payload };
}

Deno.test('current Drawing-prelude claim routes Carrier ACTION and stale replay fail-closed', async () => {
  const state = stateWithCarrier();
  const intent = request('ACTION', { actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-1', choiceId: 'defender', passIndex: 1 });
  const accepted = await applyIntent(state, 'p1', intent, 10);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.events.some((event: any) => event.type === 'POWERS_BATCH_SUBMITTED'), false);
  const replay = await applyIntent(accepted.state, 'p1', intent, 11);
  assert.equal(replay.ok, false);
  assert.equal(replay.rejected?.code, 'BAD_PAYLOAD');
  assert.deepEqual(replay.events, []);
  assert.strictEqual(replay.state, accepted.state);
});

Deno.test('current privacy claim with missing requester entry cannot fall through for single or batch powers', async () => {
  const state = stateWithCarrier();
  state.gameData.turnData!.drawingPreludeByPlayerId = {
    p2: {
      turnNumber: 3,
      requiredPassCount: 1,
      activePassIndex: 1,
      status: 'complete',
      eligibleSourcePowers: [],
      resolvedSourcePowerKeysByPass: {},
    },
  };
  const action = { actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-1', choiceId: 'defender', passIndex: 1 };
  for (const intent of [request('ACTION', action), request('ACTIONS_SUBMIT', { actions: [action] })]) {
    const result = await applyIntent(state, 'p1', intent, 10);
    assert.equal(result.ok, false);
    assert.equal(result.rejected?.code, 'INTERNAL_ERROR');
    assert.strictEqual(result.state, state);
    assert.deepEqual(result.events, []);
  }
  assert.equal(state.gameData.ships?.p1?.length, 1);
});

Deno.test('chat ACTION remains unaffected by active Drawing-prelude ownership', async () => {
  const state = stateWithCarrier();
  state.gameData.turnData!.drawingPreludeByPlayerId = {
    p2: { turnNumber: 3, requiredPassCount: 1, activePassIndex: 1, status: 'complete', eligibleSourcePowers: [], resolvedSourcePowerKeysByPass: {} },
  };
  const result = await applyIntent(state, 'p1', request('ACTION', { actionType: 'message', content: 'hello' }), 10);
  assert.equal(result.ok, true);
  assert.equal(result.events.some((event: any) => event.type === 'CHAT_MESSAGE'), true);
});

Deno.test('BUILD_SUBMIT gate precedes payload parsing and accepts structurally valid two-pass completion', async () => {
  const awaiting = stateWithCarrier();
  const incomplete = await applyIntent(awaiting, 'p1', request('BUILD_SUBMIT'), 10);
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.rejected?.code, 'DRAWING_PRELUDE_INCOMPLETE');

  const malformed = stateWithCarrier();
  malformed.gameData.turnData!.drawingPreludeByPlayerId = {
    p2: { turnNumber: 3, requiredPassCount: 1, activePassIndex: 1, status: 'complete', eligibleSourcePowers: [], resolvedSourcePowerKeysByPass: {} },
  };
  const missing = await applyIntent(malformed, 'p1', request('BUILD_SUBMIT'), 10);
  assert.equal(missing.rejected?.code, 'DRAWING_PRELUDE_INCOMPLETE');

  const awaitingPass2 = stateWithCarrier();
  awaitingPass2.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 3,
    requiredPassCount: 2,
    activePassIndex: 2,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{ key: 'car-1:CAR#0', sourceInstanceId: 'car-1', shipDefId: 'CAR', rawPowerIndex: 0, mode: 'interactive' }],
    resolvedSourcePowerKeysByPass: { 1: ['car-1:CAR#0'] },
  };
  const pass2Incomplete = await applyIntent(awaitingPass2, 'p1', request('BUILD_SUBMIT'), 10);
  assert.equal(pass2Incomplete.rejected?.code, 'DRAWING_PRELUDE_INCOMPLETE');

  const complete = stateWithCarrier();
  complete.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 3,
    requiredPassCount: 2,
    activePassIndex: 2,
    status: 'complete',
    eligibleSourcePowers: [],
    resolvedSourcePowerKeysByPass: {},
  };
  const parsedAfterGate = await applyIntent(complete, 'p1', request('BUILD_SUBMIT'), 10);
  assert.equal(parsedAfterGate.rejected?.code, 'BAD_PAYLOAD');

  const accepted = await applyIntent(complete, 'p1', {
    ...request('BUILD_SUBMIT', { builds: [] }),
    nonce: 'two-pass-complete',
  }, 11);
  assert.equal(accepted.ok, true);
});

Deno.test('Drawing rejects generic readiness and requires a present current-turn prelude for BUILD_SUBMIT', async () => {
  const state = stateWithCarrier();
  delete state.gameData.turnData!.drawingPreludeByPlayerId;
  delete state.gameData.turnData!.buildDrawingPublicFleetByPlayerId;

  const ready = await applyIntent(state, 'p1', request('DECLARE_READY'), 10);
  assert.equal(ready.ok, false);
  assert.equal(ready.rejected?.code, 'PHASE_NOT_ALLOWED');
  assert.strictEqual(ready.state, state);

  const build = await applyIntent(
    state,
    'p1',
    { ...request('BUILD_SUBMIT', { builds: [] }), nonce: 'missing-prelude' },
    11,
  );
  assert.equal(build.ok, false);
  assert.equal(build.rejected?.code, 'DRAWING_PRELUDE_INCOMPLETE');
  assert.strictEqual(build.state, state);
});

Deno.test('generic structured power resolution rejects CAR during Drawing', () => {
  const state = stateWithCarrier();
  assert.throws(
    () => resolvePowerAction({
      state,
      playerId: 'p1',
      phaseKey: 'build.drawing',
      actionId: 'CAR#0',
      sourceInstanceId: 'car-1',
      choiceId: 'defender',
    }),
    /only through the authoritative Drawing-prelude reducer/,
  );
});

Deno.test('Drawing-prelude Carrier intents require the current explicit pass token', async () => {
  const state = stateWithCarrier();
  const missing = await applyIntent(state, 'p1', request('ACTION', {
    actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-1', choiceId: 'defender',
  }), 10);
  assert.equal(missing.ok, false);
  assert.equal(missing.rejected?.code, 'BAD_PAYLOAD');
  assert.strictEqual(missing.state, state);

  const pass2 = structuredClone(state);
  pass2.gameData.turnData!.chronoswarmRolls = [4];
  pass2.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    ...pass2.gameData.turnData!.drawingPreludeByPlayerId!.p1,
    requiredPassCount: 2,
    activePassIndex: 2,
    resolvedSourcePowerKeysByPass: { 1: ['car-1:CAR#0'] },
  };
  const stale = await applyIntent(pass2, 'p1', request('ACTION', {
    actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-1', choiceId: 'defender', passIndex: 1,
  }), 11);
  assert.equal(stale.ok, false);
  assert.equal(stale.rejected?.code, 'BAD_PAYLOAD');
  assert.strictEqual(stale.state, pass2);
});

Deno.test('empty Drawing-prelude batch is a player payload rejection without mutation', async () => {
  const state = stateWithCarrier();
  const result = await applyIntent(state, 'p1', request('ACTIONS_SUBMIT', { actions: [] }), 10);
  assert.equal(result.ok, false);
  assert.equal(result.rejected?.code, 'BAD_PAYLOAD');
  assert.strictEqual(result.state, state);
});

Deno.test('Carrier-produced DEF and depleted CAR participate in the same Drawing EAR build', async () => {
  const state = normalizeAncientGameState(stateWithCarrier()).state;
  state.gameData.ships!.p1.push(
    { instanceId: 'existing-def', shipDefId: 'DEF', createdTurn: 1 },
    { instanceId: 'existing-orb', shipDefId: 'ORB', createdTurn: 1 },
  );
  state.gameData.ships!.p1[0].chargesCurrent = 1;
  state.gameData.turnData!.drawingPreludeByPlayerId!.p2 = {
    turnNumber: 3,
    requiredPassCount: 1,
    activePassIndex: 1,
    status: 'complete',
    eligibleSourcePowers: [],
    resolvedSourcePowerKeysByPass: {},
  };

  const carrier = await applyIntent(
    state,
    'p1',
    request('ACTION', { actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-1', choiceId: 'defender', passIndex: 1 }),
    10,
  );
  assert.equal(carrier.ok, true);
  const p1Submit = await applyIntent(carrier.state, 'p1', {
    ...request('BUILD_SUBMIT', { builds: [{ shipDefId: 'EAR', count: 1 }] }),
    nonce: 'p1-ear',
  }, 11);
  assert.equal(p1Submit.ok, true);
  const p2Submit = await applyIntent(p1Submit.state, 'p2', {
    ...request('BUILD_SUBMIT', { builds: [] }),
    nonce: 'p2-empty',
  }, 12);
  assert.equal(p2Submit.ok, true);
  assert.equal(p2Submit.state.gameData.ships.p1.some((ship: any) => ship.shipDefId === 'EAR'), true);
});
