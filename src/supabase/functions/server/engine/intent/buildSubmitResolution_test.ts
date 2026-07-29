import assert from 'node:assert/strict';
import { materializeQueuedSimulacrumCopiesAtTurnStart } from '../ancient/simulacrumSolarPower.ts';
import { resolveBuildSubmitAuthoritatively } from './buildSubmitResolution.ts';

function createResolutionState(args: {
  lines: number;
  payload: Record<string, unknown>;
  ships?: any[];
  turnNumber?: number;
}): any {
  const turnNumber = args.turnNumber ?? 1;
  return {
    gameId: 'build-resolution-qua-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 25, lines: args.lines, joiningLines: 0 },
    ],
    gameData: {
      turnNumber,
      ships: { p1: args.ships ?? [] },
      turnData: {
        commitments: {
          [`BUILD_${turnNumber}`]: {
            p1: { revealPayload: args.payload },
          },
        },
      },
    },
  };
}

function resolve(state: any) {
  return resolveBuildSubmitAuthoritatively({
    state,
    turnNumber: state.gameData.turnNumber,
    nowMs: 1000,
  });
}

Deno.test('build resolution persists ordered QUA selected numbers on successful creation', () => {
  const state = createResolutionState({
    lines: 15,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 3 }],
      quantumMysticSelections: [6, 2, 4],
    },
  });

  resolve(state);
  assert.deepEqual(
    state.gameData.ships.p1.map((ship: any) => ship.permanentConfiguration?.selectedNumber),
    [6, 2, 4],
  );
});

Deno.test('skipped QUA attempts persist no shifted configuration', () => {
  const state = createResolutionState({
    lines: 5,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 2 }],
      quantumMysticSelections: [1, 6],
    },
  });

  const result = resolve(state);
  assert.equal(state.gameData.ships.p1.length, 1);
  assert.equal(state.gameData.ships.p1[0].permanentConfiguration.selectedNumber, 1);
  assert.equal(
    result.events.some((event) =>
      event.type === 'BUILD_ATTEMPT_SKIPPED' &&
      event.shipDefId === 'QUA' &&
      event.attemptIndex === 1 &&
      event.reason === 'insufficient_ordinary_lines'
    ),
    true,
  );
});

Deno.test('legacy invalid committed QUA attempts skip before spending resources', () => {
  for (const quantumMysticSelections of [undefined, [0], [7], ['4']]) {
    const payload: Record<string, unknown> = {
      builds: [{ shipDefId: 'QUA', count: 1 }],
      ...(typeof quantumMysticSelections === 'undefined' ? {} : { quantumMysticSelections }),
    };
    const state = createResolutionState({ lines: 5, payload });
    const result = resolve(state);

    assert.deepEqual(state.gameData.ships.p1, []);
    assert.equal(state.players[0].lines, 5);
    assert.equal(
      result.events.some((event) =>
        event.type === 'BUILD_ATTEMPT_SKIPPED' &&
        event.reason === 'invalid_permanent_configuration'
      ),
      true,
    );
  }
});

Deno.test('generic maximum quantity permits six QUA and skips a seventh', () => {
  const sixState = createResolutionState({
    lines: 30,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 6 }],
      quantumMysticSelections: [1, 2, 3, 4, 5, 6],
    },
  });
  resolve(sixState);
  assert.equal(sixState.gameData.ships.p1.length, 6);

  const seventhState = createResolutionState({
    lines: 5,
    ships: sixState.gameData.ships.p1,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 1 }],
      quantumMysticSelections: [3],
    },
  });
  const seventh = resolve(seventhState);
  assert.equal(seventhState.gameData.ships.p1.length, 6);
  assert.equal(seventhState.players[0].lines, 5);
  assert.equal(
    seventh.events.some((event) =>
      event.type === 'BUILD_ATTEMPT_SKIPPED' && event.reason === 'max_quantity_reached'
    ),
    true,
  );
});

Deno.test('generic maximum quantity builds three Spirals and skips an over-cap attempt without spending its lines', () => {
  const threeState = createResolutionState({
    lines: 18,
    payload: { builds: [{ shipDefId: 'SPI', count: 3 }] },
  });
  resolve(threeState);
  assert.equal(threeState.gameData.ships.p1.filter((ship: any) => ship.shipDefId === 'SPI').length, 3);
  assert.equal(threeState.players[0].lines, 0);

  const fourthState = createResolutionState({
    lines: 6,
    ships: threeState.gameData.ships.p1,
    payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
  });
  const fourth = resolve(fourthState);
  assert.equal(fourthState.gameData.ships.p1.filter((ship: any) => ship.shipDefId === 'SPI').length, 3);
  assert.equal(fourthState.players[0].lines, 6);
  assert.equal(
    fourth.events.some((event) =>
      event.type === 'BUILD_ATTEMPT_SKIPPED' &&
      event.shipDefId === 'SPI' &&
      event.reason === 'max_quantity_reached'
    ),
    true,
  );
});

Deno.test('Spiral Drawing eligibility records only the exact successful two-to-three creation', () => {
  for (const startingCount of [0, 1]) {
    const state = createResolutionState({
      lines: 6,
      ships: Array.from({ length: startingCount }, (_, index) => ({
        instanceId: `existing-${index + 1}`,
        shipDefId: 'SPI',
      })),
      payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
    });
    resolve(state);
    assert.equal(
      state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId,
      undefined,
    );
  }

  const state = createResolutionState({
    lines: 6,
    ships: [
      { instanceId: 'existing-1', shipDefId: 'SPI' },
      { instanceId: 'existing-2', shipDefId: 'SPI' },
    ],
    payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
  });
  resolve(state);
  const createdThird = state.gameData.ships.p1[2];
  assert.deepEqual(
    state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId,
    { p1: { sourceInstanceId: createdThird.instanceId, turnNumber: 1 } },
  );
});

Deno.test('multi-Spiral Drawing records only the ordered threshold-crossing instance', () => {
  for (const scenario of [
    { startingCount: 1, buildCount: 2, expectedIndex: 2 },
    { startingCount: 0, buildCount: 3, expectedIndex: 2 },
  ]) {
    const state = createResolutionState({
      lines: scenario.buildCount * 6,
      ships: Array.from({ length: scenario.startingCount }, (_, index) => ({
        instanceId: `existing-${index + 1}`,
        shipDefId: 'SPI',
      })),
      payload: { builds: [{ shipDefId: 'SPI', count: scenario.buildCount }] },
    });
    resolve(state);
    const marker = state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId.p1;
    assert.equal(marker.sourceInstanceId, state.gameData.ships.p1[scenario.expectedIndex].instanceId);
    assert.equal(marker.turnNumber, 1);
  }
});

Deno.test('failed and over-cap Spiral attempts do not create or replace eligibility', () => {
  const insufficient = createResolutionState({
    lines: 0,
    ships: [
      { instanceId: 'existing-1', shipDefId: 'SPI' },
      { instanceId: 'existing-2', shipDefId: 'SPI' },
    ],
    payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
  });
  resolve(insufficient);
  assert.equal(
    insufficient.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId,
    undefined,
  );

  const atCapacity = createResolutionState({
    lines: 6,
    ships: [
      { instanceId: 'existing-1', shipDefId: 'SPI' },
      { instanceId: 'existing-2', shipDefId: 'SPI' },
      { instanceId: 'existing-3', shipDefId: 'SPI' },
    ],
    payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
  });
  resolve(atCapacity);
  assert.equal(
    atCapacity.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId,
    undefined,
  );
});

Deno.test('build retry preserves the third-Spiral marker and a later replacement gets fresh eligibility', () => {
  const state = createResolutionState({
    lines: 6,
    ships: [
      { instanceId: 'existing-1', shipDefId: 'SPI' },
      { instanceId: 'existing-2', shipDefId: 'SPI' },
    ],
    payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
  });
  resolve(state);
  const firstMarker = structuredClone(
    state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId.p1,
  );
  const retry = resolve(state);
  assert.equal(retry.alreadyApplied, true);
  assert.deepEqual(
    state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId.p1,
    firstMarker,
  );

  const replacementState = createResolutionState({
    turnNumber: 4,
    lines: 6,
    ships: [
      { instanceId: 'surviving-1', shipDefId: 'SPI' },
      { instanceId: 'surviving-2', shipDefId: 'SPI' },
    ],
    payload: { builds: [{ shipDefId: 'SPI', count: 1 }] },
  });
  replacementState.gameData.powerMemory = {
    onceOnlyFired: { [`${firstMarker.sourceInstanceId}::SPI#0`]: true },
  };
  resolve(replacementState);
  const replacement = replacementState.gameData.ships.p1[2];
  assert.deepEqual(
    replacementState.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId.p1,
    { sourceInstanceId: replacement.instanceId, turnNumber: 4 },
  );
});

Deno.test('Frigate successful creation keeps its existing trigger memory', () => {
  const state = createResolutionState({
    lines: 0,
    ships: [
      { instanceId: 'def-component', shipDefId: 'DEF' },
      { instanceId: 'fig-component', shipDefId: 'FIG' },
    ],
    payload: {
      builds: [{ shipDefId: 'FRI', count: 1 }],
      frigateTriggers: [4],
    },
  });
  state.players[0].faction = 'human';
  state.players[0].joiningLines = 3;
  resolve(state);
  const frigate = state.gameData.ships.p1[0];
  assert.equal(state.gameData.powerMemory.frigateTriggerByInstanceId[frigate.instanceId], 4);
  assert.equal(frigate.permanentConfiguration, undefined);
});

Deno.test('normal LEG and ZEN builds use shared immediate Drawing consequences', () => {
  const zenState = createResolutionState({
    lines: 9,
    payload: {
      builds: [
        { shipDefId: 'ZEN', count: 1 },
        { shipDefId: 'ANT', count: 1 },
      ],
    },
  });
  zenState.players[0].faction = 'xenite';
  const zenResult = resolve(zenState);
  assert.equal(zenResult.alreadyApplied, false);
  assert.deepEqual(
    zenState.gameData.ships.p1.map((entry: any) => entry.shipDefId),
    ['ZEN', 'ANT'],
  );
  assert.equal(
    zenState.gameData.ships.p1.find((entry: any) => entry.shipDefId === 'ANT')
      ?.chargesCurrent,
    1,
  );
  assert.equal(zenState.players[0].lines, 0);
  assert.equal(zenState.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 2);
  assert.deepEqual(
    zenResult.events.filter((event: any) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_MANUAL' ||
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'
    ).map((event: any) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_MANUAL'
        ? `${event.shipDefId}:manual`
        : `${event.shipDefId}:${event.sourceShipDefId}`
    ),
    ['ZEN:manual', 'ANT:ZEN'],
  );

  const legState = createResolutionState({
    lines: 8,
    payload: { builds: [{ shipDefId: 'LEG', count: 1 }] },
  });
  legState.players[0].faction = 'centaur';
  const legResult = resolve(legState);
  assert.deepEqual(
    legState.gameData.ships.p1.map((entry: any) => entry.shipDefId),
    ['LEG'],
  );
  assert.equal(legState.players[0].lines, 0);
  assert.equal(legState.players[0].joiningLines, 4);
  assert.equal(legState.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 1);
  assert.deepEqual(
    legResult.events.filter((event: any) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_MANUAL'
    ).map((event: any) => event.shipDefId),
    ['LEG'],
  );

  const zenWithoutPayloadAnt = createResolutionState({
    lines: 9,
    payload: { builds: [{ shipDefId: 'ZEN', count: 1 }] },
  });
  zenWithoutPayloadAnt.players[0].faction = 'xenite';
  resolve(zenWithoutPayloadAnt);
  assert.deepEqual(
    zenWithoutPayloadAnt.gameData.ships.p1.map((entry: any) =>
      entry.shipDefId
    ),
    ['ZEN', 'ANT'],
  );
});

Deno.test('Drawing build resolution consumes turn-start Simulacrum copies as upgrade components', () => {
  const state = createResolutionState({
    turnNumber: 2,
    lines: 0,
    payload: { builds: [{ shipDefId: 'TAC', count: 1 }] },
  });
  state.players.push({
    id: 'p2',
    role: 'player',
    faction: 'human',
    health: 25,
    lines: 0,
    joiningLines: 0,
  });
  state.players[0].joiningLines = 3;
  state.gameData.currentPhase = 'build';
  state.gameData.currentSubPhase = 'drawing';
  state.gameData.ships.p2 = [];
  state.gameData.ancient = {
    schemaVersion: 1,
    energyByPlayerId: {},
    pendingSimulacrumCopies: [
      {
        pendingCopyId: 'copy-def-1',
        declarationId: 'declaration-1',
        ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'source-def-1',
        copiedShipDefId: 'DEF',
        queuedTurnNumber: 1,
        materializationTurnNumber: 2,
        queueOrder: 0,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
        sourceMode: 'primary',
        status: 'queued',
      },
      {
        pendingCopyId: 'copy-def-2',
        declarationId: 'declaration-1',
        ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'source-def-2',
        copiedShipDefId: 'DEF',
        queuedTurnNumber: 1,
        materializationTurnNumber: 2,
        queueOrder: 1,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
        sourceMode: 'primary',
        status: 'queued',
      },
      {
        pendingCopyId: 'copy-fig',
        declarationId: 'declaration-1',
        ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'source-fig',
        copiedShipDefId: 'FIG',
        queuedTurnNumber: 1,
        materializationTurnNumber: 2,
        queueOrder: 2,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
        sourceMode: 'primary',
        status: 'queued',
      },
    ],
  };

  const materialized = materializeQueuedSimulacrumCopiesAtTurnStart(state, 2, 900);
  const result = resolve(materialized.state);

  assert.deepEqual(
    materialized.state.gameData.ships!.p1.map((ship: any) => ship.shipDefId),
    ['TAC'],
  );
  assert.equal(materialized.state.players[0].joiningLines, 0);
  assert.equal(
    result.events.some((event) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_MANUAL' &&
      event.shipDefId === 'TAC'
    ),
    true,
  );
});

Deno.test('turn-start copied LEG joining lines fund an upgrade in the same Drawing', () => {
  const state = createResolutionState({
    turnNumber: 2,
    lines: 0,
    ships: [
      { instanceId: 'ang-1', shipDefId: 'ANG' },
      { instanceId: 'ang-2', shipDefId: 'ANG' },
    ],
    payload: { builds: [{ shipDefId: 'FUR', count: 1 }] },
  });
  state.players[0].faction = 'centaur';
  state.players.push({
    id: 'p2',
    role: 'player',
    faction: 'human',
    health: 25,
    lines: 0,
    joiningLines: 0,
  });
  state.gameData.ships.p2 = [];
  state.gameData.ancient = {
    schemaVersion: 1,
    energyByPlayerId: {},
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId: {},
    pendingBlackHoleDestructions: [],
    pendingSimulacrumCopies: [{
      pendingCopyId: 'copy-leg',
      declarationId: 'declaration-1',
      ownerPlayerId: 'p1',
      sourceTargetInstanceId: 'source-leg',
      copiedShipDefId: 'LEG',
      queuedTurnNumber: 1,
      materializationTurnNumber: 2,
      queueOrder: 0,
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
      sourceMode: 'primary',
      status: 'queued',
    }],
  };

  const materialized = materializeQueuedSimulacrumCopiesAtTurnStart(
    state,
    2,
    500,
    () => 'copied-leg',
  );
  assert.equal(materialized.state.players[0].joiningLines, 4);
  const result = resolve(materialized.state);
  assert.equal(result.alreadyApplied, false);
  assert.equal(materialized.state.players[0].joiningLines, 0);
  assert.deepEqual(
    materialized.state.gameData.ships!.p1.map((entry: any) => entry.shipDefId),
    ['LEG', 'FUR'],
  );
});

Deno.test('unused copied LEG lines clamp only through ordinary persistence', () => {
  const state = createResolutionState({
    turnNumber: 2,
    lines: 0,
    payload: { builds: [] },
  });
  state.players[0].faction = 'centaur';
  state.players[0].joiningLines = 11;
  state.players.push({
    id: 'p2',
    role: 'player',
    faction: 'human',
    health: 25,
    lines: 0,
    joiningLines: 0,
  });
  state.gameData.ships.p2 = [];
  state.gameData.ancient = {
    schemaVersion: 1,
    energyByPlayerId: {},
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId: {},
    pendingBlackHoleDestructions: [],
    pendingSimulacrumCopies: [{
      pendingCopyId: 'copy-leg',
      declarationId: 'declaration-1',
      ownerPlayerId: 'p1',
      sourceTargetInstanceId: 'source-leg',
      copiedShipDefId: 'LEG',
      queuedTurnNumber: 1,
      materializationTurnNumber: 2,
      queueOrder: 0,
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
      sourceMode: 'primary',
      status: 'queued',
    }],
  };

  const materialized = materializeQueuedSimulacrumCopiesAtTurnStart(
    state,
    2,
    500,
    () => 'copied-leg',
  );
  assert.equal(materialized.state.players[0].joiningLines, 15);
  resolve(materialized.state);
  assert.equal(materialized.state.players[0].joiningLines, 12);
});
