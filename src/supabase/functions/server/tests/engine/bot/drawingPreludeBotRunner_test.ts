import assert from 'node:assert/strict';
import {
  buildDrawingPreludeCarrierIntentForBot,
  MAX_BOT_STEPS_PER_REQUEST,
  runBotsUntilSettled,
} from '../../../engine/bot/botRunner.ts';
import type { AuthoredBotPlan } from '../../../engine/bot/botTypes.ts';
import { advanceDrawingPreludeForPlayer } from '../../../engine/intent/drawingPreludeResolution.ts';
import { projectDrawingPreludeCarrierActions } from '../../../engine/state/drawingPreludeProjection.ts';

function createCarrierBotDrawingState(args: {
  twoBots?: boolean;
  carrierCount?: number;
  charges?: number;
} = {}): any {
  const twoBots = args.twoBots === true;
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
      requiredPassCount: 1,
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
        chronoswarmRolls: [],
        chronoswarmCountByPlayerId: { p1: 0, p2: 0 },
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

function createLegalHumanXeniteBotDrawingState(): any {
  const state = createCarrierBotDrawingState({
    twoBots: true,
    carrierCount: 2,
    charges: 2,
  });
  const xeniteFleet = [
    { instanceId: 'p2-chronoswarm', shipDefId: 'CHR', createdTurn: 1 },
    { instanceId: 'p2-queen', shipDefId: 'QUE', createdTurn: 1 },
  ];

  state.players[1].faction = 'xenite';
  state.controllersByPlayerId.p2 = {
    kind: 'bot',
    speciesId: 'XEN',
    chosenPlanId: 'xen_chrono_queen_standard',
  };
  state.gameData.ships.p2 = xeniteFleet;
  state.gameData.turnData.buildDrawingPublicFleetByPlayerId.p2 = structuredClone(xeniteFleet);
  state.gameData.turnData.chronoswarmRolls = [4];
  state.gameData.turnData.chronoswarmCountByPlayerId.p2 = 1;
  state.gameData.turnData.drawingPreludeByPlayerId.p2 = {
    turnNumber: 3,
    requiredPassCount: 2,
    activePassIndex: 1,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{
      key: 'p2-queen:QUE#0',
      sourceInstanceId: 'p2-queen',
      shipDefId: 'QUE',
      rawPowerIndex: 0,
      mode: 'automatic',
    }],
    resolvedSourcePowerKeysByPass: {},
  };
  return state;
}

Deno.test('Drawing-prelude bot intent mirrors projector sources, choices, pass tokens, and explicit Hold', () => {
  const state = createCarrierBotDrawingState({ carrierCount: 2, charges: 2 });
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

Deno.test('one Human bot submits one Carrier batch and only then submits its Drawing build', async () => {
  const state = createCarrierBotDrawingState();
  const result = await runBotsUntilSettled({ state, nowMs: 100 });
  const submitted = result.events.filter((event: any) =>
    event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
  );
  assert.deepEqual(
    submitted.map((event: any) => event.type),
    ['POWERS_BATCH_SUBMITTED', 'BUILD_SUBMITTED'],
  );
  assert.deepEqual(
    result.state.gameData.turnData.drawingPreludeByPlayerId.p1
      .resolvedSourcePowerKeysByPass,
    { 1: ['p1-car-1:CAR#0'] },
  );
  assert.equal(result.botStepsApplied, 2);
  assert.equal(result.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'), false);
});

Deno.test('authoritative forced Hold lets the bot build without submitting a Carrier batch', async () => {
  const state = createCarrierBotDrawingState({ charges: 0 });
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

Deno.test('legal Xenite Chronoswarm automatics complete both passes before the bot submits its build', async () => {
  const state = createLegalHumanXeniteBotDrawingState();
  state.controllersByPlayerId.p1 = { kind: 'human' };

  const beforeAuthoritativeCompletion = await runBotsUntilSettled({ state, nowMs: 80 });
  assert.equal(beforeAuthoritativeCompletion.botStepsApplied, 0);
  assert.equal(
    beforeAuthoritativeCompletion.events.some((event: any) =>
      event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
    ),
    false,
  );

  const advanced = advanceDrawingPreludeForPlayer({ state, playerId: 'p2', nowMs: 90 });
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const xenitePrelude = advanced.state.gameData.turnData?.drawingPreludeByPlayerId?.p2;
  assert.equal(xenitePrelude?.status, 'complete');
  assert.equal(xenitePrelude?.activePassIndex, 2);
  assert.deepEqual(xenitePrelude?.resolvedSourcePowerKeysByPass, {
    1: ['p2-queen:QUE#0'],
    2: ['p2-queen:QUE#0'],
  });
  assert.deepEqual(
    advanced.events.filter((event: any) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'
    ).map((event: any) => event.producedBuildOccurrence),
    [
      { stage: 'drawing_prelude', passIndex: 1 },
      { stage: 'drawing_prelude', passIndex: 2 },
    ],
  );
  assert.equal(
    advanced.events.some((event: any) => event.type === 'POWERS_BATCH_SUBMITTED'),
    false,
  );

  const result = await runBotsUntilSettled({ state: advanced.state, nowMs: 100 });
  assert.deepEqual(
    result.events.filter((event: any) =>
      event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
    ).map((event: any) => ({ type: event.type, playerId: event.playerId })),
    [{ type: 'BUILD_SUBMITTED', playerId: 'p2' }],
  );
  assert.equal(result.botStepsApplied, 1);
});

Deno.test('complete bot builds independently while a human opponent awaits its single Carrier pass', async () => {
  const state = createCarrierBotDrawingState({ twoBots: true, charges: 0 });
  state.controllersByPlayerId.p2 = { kind: 'human' };
  state.gameData.ships.p2[0].chargesCurrent = 2;

  const completed = advanceDrawingPreludeForPlayer({
    state,
    playerId: 'p1',
    nowMs: 90,
  });
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
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
    1,
  );
});

Deno.test('multiple Carriers use one batch and malformed or Hold-only claimed states fail safely', async () => {
  const multi = await runBotsUntilSettled({
    state: createCarrierBotDrawingState({ carrierCount: 2, charges: 2 }),
    nowMs: 100,
  });
  assert.deepEqual(
    multi.events.filter((event: any) => event.type === 'POWERS_BATCH_SUBMITTED')
      .map((event: any) => event.count),
    [2],
  );

  const malformed = createCarrierBotDrawingState();
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

  const holdOnly = createCarrierBotDrawingState({ charges: 0 });
  const holdOnlyResult = await runBotsUntilSettled({ state: holdOnly, nowMs: 100 });
  assert.equal(holdOnlyResult.botStepsApplied, 0);
  assert.equal(
    holdOnlyResult.events.some((event: any) =>
      event.reason === 'invalid_drawing_prelude_state'
    ),
    true,
  );
});

Deno.test('missing current-turn Drawing prelude stops the bot loop without intents or cap exhaustion', async () => {
  const missing = createCarrierBotDrawingState();
  delete missing.gameData.turnData.drawingPreludeByPlayerId;
  delete missing.gameData.turnData.buildDrawingPublicFleetByPlayerId;

  const result = await runBotsUntilSettled({ state: missing, nowMs: 100 });
  assert.equal(result.botStepsApplied, 0);
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'BOT_RUNNER_SKIPPED' &&
      event.reason === 'invalid_drawing_prelude_state'
    ),
    true,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'POWERS_BATCH_SUBMITTED' ||
      event.type === 'BUILD_SUBMITTED' ||
      event.type === 'BOT_RUNNER_LIMIT_REACHED'
    ),
    false,
  );
  assert.deepEqual(result.state, missing);
});

Deno.test('legal Human Carrier and Xenite Chronoswarm bots cover both prelude branches below the cap', async () => {
  const state = createLegalHumanXeniteBotDrawingState();
  const xeniteAdvanced = advanceDrawingPreludeForPlayer({
    state,
    playerId: 'p2',
    nowMs: 90,
  });
  assert.equal(xeniteAdvanced.ok, true);
  if (!xeniteAdvanced.ok) return;
  assert.equal(
    xeniteAdvanced.state.gameData.turnData?.drawingPreludeByPlayerId?.p2.status,
    'complete',
  );
  assert.equal(
    xeniteAdvanced.events.some((event: any) => event.type === 'POWERS_BATCH_SUBMITTED'),
    false,
  );

  const result = await runBotsUntilSettled({
    state: xeniteAdvanced.state,
    nowMs: 100,
  });
  const drawingAcceptedEvents = result.events.filter((event: any) =>
    event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
  );
  const uniqueDrawingAcceptedEvents = drawingAcceptedEvents.filter(
    (event: any, index: number, all: any[]) =>
      all.findIndex((candidate: any) =>
        candidate.type === event.type && candidate.playerId === event.playerId
      ) === index,
  );
  assert.deepEqual(
    uniqueDrawingAcceptedEvents.map((event: any) => ({
      type: event.type,
      playerId: event.playerId,
      ...(event.type === 'POWERS_BATCH_SUBMITTED' ? { count: event.count } : {}),
    })),
    [
      { type: 'POWERS_BATCH_SUBMITTED', playerId: 'p1', count: 2 },
      { type: 'BUILD_SUBMITTED', playerId: 'p1' },
      { type: 'BUILD_SUBMITTED', playerId: 'p2' },
    ],
  );
  const drawingAcceptedStepCount = result.botStepsApplied;
  assert.equal(drawingAcceptedStepCount, 3);
  assert.equal(drawingAcceptedStepCount < MAX_BOT_STEPS_PER_REQUEST, true);
  assert.deepEqual(
    Object.keys(result.state.gameData.turnData.commitments.BUILD_3).sort(),
    ['p1', 'p2'],
  );
});

Deno.test('two legal single-pass Human Carrier bots define the four-step accepted-intent ceiling', async () => {
  // Automatic Xenite passes add authoritative work but no accepted bot-intent step.
  const result = await runBotsUntilSettled({
    state: createCarrierBotDrawingState({ twoBots: true, carrierCount: 2 }),
    nowMs: 100,
  });
  const drawingAcceptedEvents = result.events.filter((event: any) =>
    event.type === 'POWERS_BATCH_SUBMITTED' || event.type === 'BUILD_SUBMITTED'
  );
  const uniqueDrawingAcceptedEvents = drawingAcceptedEvents.filter(
    (event: any, index: number, all: any[]) =>
      all.findIndex((candidate: any) =>
        candidate.type === event.type && candidate.playerId === event.playerId
      ) === index,
  );
  assert.equal(uniqueDrawingAcceptedEvents.length, 4);
  assert.equal(
    uniqueDrawingAcceptedEvents.filter((event: any) => event.type === 'POWERS_BATCH_SUBMITTED').length,
    2,
  );
  assert.equal(
    uniqueDrawingAcceptedEvents.filter((event: any) => event.type === 'BUILD_SUBMITTED').length,
    2,
  );
  const drawingAcceptedStepCount = result.botStepsApplied;
  assert.equal(drawingAcceptedStepCount, 4);
  assert.equal(drawingAcceptedStepCount < MAX_BOT_STEPS_PER_REQUEST, true);
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
