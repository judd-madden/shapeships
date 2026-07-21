import assert from 'node:assert/strict';
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
