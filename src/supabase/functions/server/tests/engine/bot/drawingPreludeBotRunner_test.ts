import assert from 'node:assert/strict';
import {
  buildDrawingPreludeCarrierIntentForBot,
  MAX_BOT_STEPS_PER_REQUEST,
  runBotsUntilSettled,
} from '../../../engine/bot/botRunner.ts';
import type { AuthoredBotPlan } from '../../../engine/bot/botTypes.ts';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
import { advanceDrawingPreludeForPlayer } from '../../../engine/intent/drawingPreludeResolution.ts';
import { projectDrawingPreludeCarrierActions } from '../../../engine/state/drawingPreludeProjection.ts';

function createBotDrawingState(args: {
  twoBots?: boolean;
  passCount?: 1 | 2;
  carrierCount?: number;
  charges?: number;
} = {}): any {
  const twoBots = args.twoBots === true;
  const passCount = args.passCount ?? 2;
  const carrierCount = args.carrierCount ?? 1;
  const charges = args.charges ?? 4;
  const playerIds = twoBots ? ['p1', 'p2'] : ['p1', 'p2'];
  const ships = Object.fromEntries(playerIds.map((playerId) => [
    playerId,
    playerId === 'p1' || twoBots
      ? Array.from({ length: carrierCount }, (_, index) => ({
          instanceId: `${playerId}-car-${index + 1}`,
          shipDefId: 'CAR',
          chargesCurrent: charges,
          createdTurn: 1,
        }))
      : [],
  ]));
  const drawingPreludeByPlayerId = Object.fromEntries(playerIds.map((playerId) => {
    const eligibleSourcePowers = (ships[playerId] as any[]).map((ship) => ({
      key: `${ship.instanceId}:CAR#0`,
      sourceInstanceId: ship.instanceId,
      shipDefId: 'CAR',
      rawPowerIndex: 0,
      mode: 'interactive',
    }));
    return [playerId, {
      turnNumber: 3,
      requiredPassCount: passCount,
      activePassIndex: 1,
      status: eligibleSourcePowers.length > 0 ? 'awaiting_actions' : 'complete',
      eligibleSourcePowers,
      resolvedSourcePowerKeysByPass: {},
    }];
  }));
  return {
    gameId: 'bot-drawing-prelude',
    status: 'active',
    stateRevision: 1,
    players: [
      { id: 'p1', name: 'One', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'p2', name: 'Two', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      p1: { kind: 'bot', speciesId: 'HUM', chosenPlanId: 'hum_orbital_carrier_tactical' },
      p2: twoBots
        ? { kind: 'bot', speciesId: 'HUM', chosenPlanId: 'hum_orbital_carrier_tactical' }
        : { kind: 'human' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships,
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        effectiveDiceRollByPlayerId: { p1: 4, p2: 4 },
        chronoswarmRolls: [4],
        commitments: {},
        drawingPreludeByPlayerId,
        buildDrawingPublicFleetByPlayerId: structuredClone(ships),
      },
    },
    actions: [],
    events: [],
    battleLogScratch: { currentTurnCapture: null, lastFinalizedTurnNumber: null, archiveCheckpoint: null },
  };
}

Deno.test('Drawing-prelude bot intent mirrors projector sources, choices, pass tokens, and explicit Hold', () => {
  const state = createBotDrawingState({ passCount: 1, carrierCount: 2, charges: 2 });
  const projected = projectDrawingPreludeCarrierActions(state, 'p1');
  const before = JSON.stringify(state);
  const holdPlan: AuthoredBotPlan = {
    id: 'test-hold',
    speciesId: 'HUM',
    buildGoals: [],
    drawingPrelude: { CAR: { fallbackChoiceId: 'hold' } },
  };
  const intent = buildDrawingPreludeCarrierIntentForBot({
    state,
    playerId: 'p1',
    phaseKey: 'build.drawing',
    loopStep: 0,
    plan: holdPlan,
  });
  assert.equal(intent?.intentType, 'ACTIONS_SUBMIT');
  assert.deepEqual(
    (intent?.payload as any).actions.map((action: any) => ({
      sourceInstanceId: action.sourceInstanceId,
      choiceId: action.choiceId,
      passIndex: action.passIndex,
    })),
    projected.map((action) => ({
      sourceInstanceId: action.sourceInstanceId,
      choiceId: 'hold',
      passIndex: action.passIndex,
    })),
  );
  assert.equal(JSON.stringify(state), before);
});

Deno.test('one bot submits one batch per pass and only then submits its Drawing build', async () => {
  const state = createBotDrawingState();
  const result = await runBotsUntilSettled({ state, nowMs: 100 });
  const submitted = result.events.filter((event: any) =>
    event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
  );
  assert.deepEqual(
    submitted.map((event: any) => event.type),
    ['POWERS_BATCH_SUBMITTED', 'POWERS_BATCH_SUBMITTED', 'BUILD_SUBMITTED'],
  );
  assert.deepEqual(
    result.state.gameData.turnData.drawingPreludeByPlayerId.p1
      .resolvedSourcePowerKeysByPass,
    { 1: ['p1-car-1:CAR#0'], 2: ['p1-car-1:CAR#0'] },
  );
  assert.equal(result.botStepsApplied, 3);
  assert.equal(result.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'), false);
});

Deno.test('authoritative forced Hold lets the bot build without submitting a Carrier batch', async () => {
  const state = createBotDrawingState({ passCount: 1, charges: 0 });
  const advanced = advanceDrawingPreludeForPlayer({
    state,
    playerId: 'p1',
    nowMs: 90,
  });
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.equal(
    advanced.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status,
    'complete',
  );
  assert.deepEqual(
    advanced.state.gameData.turnData?.drawingPreludeByPlayerId?.p1
      .resolvedSourcePowerKeysByPass,
    { 1: ['p1-car-1:CAR#0'] },
  );

  const result = await runBotsUntilSettled({ state: advanced.state, nowMs: 100 });
  assert.deepEqual(
    result.events.filter((event: any) =>
      event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
    ).map((event: any) => event.type),
    ['BUILD_SUBMITTED'],
  );
  assert.equal(result.botStepsApplied, 1);
});

Deno.test('pass-2 bot choice is replanned from authoritative pass-1 state', async () => {
  const state = createBotDrawingState({ charges: 4 });
  const plan: AuthoredBotPlan = {
    id: 'test-fresh-pass-choice',
    speciesId: 'HUM',
    buildGoals: [],
    drawingPrelude: {
      CAR: {
        priorityGoals: [{
          choiceId: 'defender',
          targetShipDefId: 'DEF',
          targetCount: 1,
        }],
        fallbackChoiceId: 'fighter',
      },
    },
  };
  const pass1Intent = buildDrawingPreludeCarrierIntentForBot({
    state,
    playerId: 'p1',
    phaseKey: 'build.drawing',
    loopStep: 0,
    plan,
  });
  assert.equal((pass1Intent?.payload as any).actions[0].choiceId, 'defender');
  const pass1 = await applyIntent(state, 'p1', pass1Intent!, 100);
  assert.equal(pass1.ok, true);
  if (!pass1.ok) return;
  assert.equal(
    pass1.state.gameData.ships?.p1?.filter((ship: any) => ship.shipDefId === 'DEF').length,
    1,
  );

  const projectedPass2 = projectDrawingPreludeCarrierActions(pass1.state, 'p1');
  const pass2Intent = buildDrawingPreludeCarrierIntentForBot({
    state: pass1.state,
    playerId: 'p1',
    phaseKey: 'build.drawing',
    loopStep: 1,
    plan,
  });
  assert.deepEqual(
    (pass2Intent?.payload as any).actions.map((action: any) => ({
      sourceInstanceId: action.sourceInstanceId,
      choiceId: action.choiceId,
      passIndex: action.passIndex,
    })),
    projectedPass2.map((action) => ({
      sourceInstanceId: action.sourceInstanceId,
      choiceId: 'fighter',
      passIndex: action.passIndex,
    })),
  );
});

Deno.test('one-charge two-pass Carrier needs one batch then build after automatic pass-2 Hold', async () => {
  const result = await runBotsUntilSettled({
    state: createBotDrawingState({ charges: 1 }),
    nowMs: 100,
  });
  assert.deepEqual(
    result.events.filter((event: any) =>
      event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
    ).map((event: any) => event.type),
    ['POWERS_BATCH_SUBMITTED', 'BUILD_SUBMITTED'],
  );
  assert.deepEqual(
    result.state.gameData.turnData.drawingPreludeByPlayerId.p1
      .resolvedSourcePowerKeysByPass,
    { 1: ['p1-car-1:CAR#0'], 2: ['p1-car-1:CAR#0'] },
  );
  assert.equal(result.botStepsApplied, 2);
});

Deno.test('complete bot builds independently while a human opponent awaits either prelude pass', async () => {
  for (const opponentPassIndex of [1, 2] as const) {
    const state = createBotDrawingState({ twoBots: true, charges: 0 });
    state.controllersByPlayerId.p2 = { kind: 'human' };
    state.gameData.ships.p2[0].chargesCurrent = 2;
    const opponentPrelude = state.gameData.turnData.drawingPreludeByPlayerId.p2;
    opponentPrelude.activePassIndex = opponentPassIndex;
    opponentPrelude.resolvedSourcePowerKeysByPass = opponentPassIndex === 2
      ? { 1: ['p2-car-1:CAR#0'] }
      : {};

    const completed = advanceDrawingPreludeForPlayer({
      state,
      playerId: 'p1',
      nowMs: 90,
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) continue;
    assert.equal(
      completed.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status,
      'complete',
    );

    const result = await runBotsUntilSettled({ state: completed.state, nowMs: 100 });
    assert.equal(
      result.events.some((event: any) =>
        event.type === 'BUILD_SUBMITTED' && event.playerId === 'p1'
      ),
      true,
    );
    assert.equal(result.botStepsApplied, 1);
    assert.equal(
      result.state.gameData.turnData.drawingPreludeByPlayerId.p2.status,
      'awaiting_actions',
    );
    assert.equal(
      result.state.gameData.turnData.drawingPreludeByPlayerId.p2.activePassIndex,
      opponentPassIndex,
    );
  }
});

Deno.test('multiple Carriers use one batch and malformed or Hold-only claimed states fail safely', async () => {
  const multi = await runBotsUntilSettled({
    state: createBotDrawingState({ passCount: 1, carrierCount: 2, charges: 2 }),
    nowMs: 100,
  });
  assert.deepEqual(
    multi.events.filter((event: any) => event.type === 'POWERS_BATCH_SUBMITTED')
      .map((event: any) => event.count),
    [2],
  );

  const malformed = createBotDrawingState({ passCount: 1 });
  malformed.gameData.turnData.drawingPreludeByPlayerId.p1.activePassIndex = 2;
  const malformedResult = await runBotsUntilSettled({ state: malformed, nowMs: 100 });
  assert.equal(malformedResult.botStepsApplied, 0);
  assert.equal(
    malformedResult.events.some((event: any) =>
      event.type === 'BOT_RUNNER_SKIPPED' &&
      event.reason === 'invalid_drawing_prelude_state'
    ),
    true,
  );

  const holdOnly = createBotDrawingState({ passCount: 1, charges: 0 });
  const holdOnlyResult = await runBotsUntilSettled({ state: holdOnly, nowMs: 100 });
  assert.equal(holdOnlyResult.botStepsApplied, 0);
  assert.equal(
    holdOnlyResult.events.some((event: any) =>
      event.reason === 'invalid_drawing_prelude_state'
    ),
    true,
  );
});

Deno.test('two two-pass bots complete the supported Drawing chain in six accepted steps below the cap', async () => {
  const state = createBotDrawingState({ twoBots: true });
  const result = await runBotsUntilSettled({
    state,
    nowMs: 100,
  });
  const drawingAcceptedEvents = result.events.filter((event: any) =>
    event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
  );
  assert.equal(drawingAcceptedEvents.length, 6);
  assert.equal(
    drawingAcceptedEvents.filter((event: any) =>
      event.type === 'POWERS_BATCH_SUBMITTED'
    ).length,
    4,
  );
  assert.equal(
    drawingAcceptedEvents.filter((event: any) => event.type === 'BUILD_SUBMITTED').length,
    2,
  );
  assert.equal(drawingAcceptedEvents.length < MAX_BOT_STEPS_PER_REQUEST, true);
  assert.notEqual(result.state.gameData.currentSubPhase, 'drawing');
});

Deno.test('shared bot projector retains non-HTTP, non-route architecture guards', async () => {
  const source = await Deno.readTextFile(
    new URL('../../../engine/bot/botRunner.ts', import.meta.url),
  );
  assert.equal(source.includes('projectDrawingPreludeCarrierActions'), true);
  assert.equal(source.includes("from '../../routes/"), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('GET '), false);
  assert.equal(source.includes('MAX_BOT_STEPS_PER_REQUEST = 8'), true);
});
