import assert from 'node:assert/strict';
import { applyIntent, type IntentRequest } from './IntentReducer.ts';

function createBuildState() {
  return {
    gameId: 'intent-reducer-qua-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 25, lines: 30, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 25, lines: 12, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 1,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: { p1: [], p2: [] },
      turnData: { commitments: {} },
    },
  };
}

function buildIntent(payload: unknown): IntentRequest {
  return {
    gameId: 'intent-reducer-qua-test',
    intentType: 'BUILD_SUBMIT',
    turnNumber: 1,
    payload,
    nonce: 'qua-test-nonce',
  };
}

function createFirstStrikeState(removalKind: 'guardian' | 'sacrificial_pool' | 'domination') {
  const opponentSource = removalKind === 'guardian'
    ? { instanceId: 'opponent-source', shipDefId: 'GUA', chargesCurrent: 2 }
    : removalKind === 'sacrificial_pool'
      ? { instanceId: 'opponent-source', shipDefId: 'SAC', createdTurn: 3 }
      : { instanceId: 'opponent-source', shipDefId: 'DOM', createdTurn: 3 };

  return {
    gameId: `intent-reducer-spiral-${removalKind}`,
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 50, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      phaseReadiness: [],
      ships: {
        p1: [
          { instanceId: 'spi-1', shipDefId: 'SPI', createdTurn: 1 },
          { instanceId: 'spi-2', shipDefId: 'SPI', createdTurn: 1 },
          { instanceId: 'spi-3', shipDefId: 'SPI', createdTurn: 3 },
          { instanceId: 'p1-def', shipDefId: 'DEF' },
        ],
        p2: [
          opponentSource,
          { instanceId: 'spiral-target', shipDefId: 'FIG' },
        ],
      },
      powerMemory: { onceOnlyFired: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        thirdSpiralFirstStrikeEligibilityByPlayerId: {
          p1: { sourceInstanceId: 'spi-3', turnNumber: 3 },
        },
      },
    },
  };
}

function powerActionIntent(
  gameId: string,
  sourceInstanceId: string,
  actionId: string,
  choiceId: string,
  targets: { targetInstanceId?: string; targetInstanceIds?: string[] },
): IntentRequest {
  return {
    gameId,
    intentType: 'ACTION',
    turnNumber: 3,
    nonce: `${sourceInstanceId}-${actionId}`,
    payload: {
      actionType: 'power',
      sourceInstanceId,
      actionId,
      choiceId,
      ...targets,
    },
  };
}

function readyIntent(gameId: string, playerId: string): IntentRequest {
  return {
    gameId,
    intentType: 'DECLARE_READY',
    turnNumber: 3,
    nonce: `ready-${playerId}`,
    payload: {},
  };
}

Deno.test('BUILD_SUBMIT accepts every legal Quantum Mystic selected number', async () => {
  for (let selectedNumber = 1; selectedNumber <= 6; selectedNumber += 1) {
    const result = await applyIntent(
      createBuildState(),
      'p1',
      buildIntent({
        builds: [{ shipDefId: 'QUA', count: 1 }],
        quantumMysticSelections: [selectedNumber],
      }),
      1000,
    );
    assert.equal(result.ok, true, `selection ${selectedNumber}`);
  }
});

Deno.test('BUILD_SUBMIT rejects malformed Quantum Mystic selection shapes and counts atomically', async () => {
  const invalidPayloads: unknown[] = [
    { builds: [{ shipDefId: 'QUA', count: 1 }] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: '4' },
    { builds: [{ shipDefId: 'QUA', count: 2 }], quantumMysticSelections: [1] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [1, 2] },
    { builds: [{ shipDefId: 'DEF', count: 1 }], quantumMysticSelections: [1] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [0] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [-1] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [1.5] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [Number.NaN] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: ['1'] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [null] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [7] },
  ];

  for (const payload of invalidPayloads) {
    const state = createBuildState();
    const before = structuredClone(state);
    const result = await applyIntent(state, 'p1', buildIntent(payload), 1000);
    assert.equal(result.ok, false, JSON.stringify(payload));
    assert.equal(result.rejected?.code, 'BAD_PAYLOAD');
    assert.deepEqual(result.state, before);
  }
});

Deno.test('BUILD_SUBMIT permits no QUA selection field or an empty array when no QUA is requested', async () => {
  for (const payload of [
    { builds: [{ shipDefId: 'DEF', count: 1 }] },
    { builds: [{ shipDefId: 'DEF', count: 1 }], quantumMysticSelections: [] },
  ]) {
    const result = await applyIntent(createBuildState(), 'p1', buildIntent(payload), 1000);
    assert.equal(result.ok, true);
  }
});

Deno.test('BUILD_SUBMIT preserves existing optional Frigate trigger behavior', async () => {
  const omitted = await applyIntent(
    createBuildState(),
    'p1',
    buildIntent({ builds: [{ shipDefId: 'FRI', count: 1 }] }),
    1000,
  );
  assert.equal(omitted.ok, true);

  const malformedState = createBuildState();
  const before = structuredClone(malformedState);
  const malformed = await applyIntent(
    malformedState,
    'p1',
    buildIntent({ builds: [{ shipDefId: 'FRI', count: 1 }], frigateTriggers: [7] }),
    1000,
  );
  assert.equal(malformed.ok, false);
  assert.equal(malformed.rejected?.code, 'BAD_PAYLOAD');
  assert.deepEqual(malformed.state, before);
});

Deno.test('staged Spiral First Strike survives simultaneous Guardian, SAC, and DOM source removal', async () => {
  for (const removalKind of ['guardian', 'sacrificial_pool', 'domination'] as const) {
    let state: any = createFirstStrikeState(removalKind);
    const gameId = state.gameId;

    const spiralAction = await applyIntent(
      state,
      'p1',
      powerActionIntent(gameId, 'spi-3', 'SPI#0', 'destroy', {
        targetInstanceId: 'spiral-target',
      }),
      1000,
    );
    assert.equal(spiralAction.ok, true, removalKind);
    state = spiralAction.state;

    const opponentAction = await applyIntent(
      state,
      'p2',
      removalKind === 'guardian'
        ? powerActionIntent(gameId, 'opponent-source', 'GUA#0', 'destroy', {
            targetInstanceId: 'spi-3',
          })
        : removalKind === 'sacrificial_pool'
          ? powerActionIntent(gameId, 'opponent-source', 'SAC#0', 'destroy', {
              targetInstanceId: 'spi-3',
            })
          : powerActionIntent(gameId, 'opponent-source', 'DOM#0', 'steal', {
              targetInstanceIds: ['spi-3', 'p1-def'],
            }),
      1001,
    );
    assert.equal(opponentAction.ok, true, removalKind);
    state = opponentAction.state;

    const p1Ready = await applyIntent(state, 'p1', readyIntent(gameId, 'p1'), 1002);
    assert.equal(p1Ready.ok, true, removalKind);
    state = p1Ready.state;
    const resolved = await applyIntent(state, 'p2', readyIntent(gameId, 'p2'), 1003);
    assert.equal(resolved.ok, true, removalKind);
    state = resolved.state;

    assert.equal(
      state.gameData.ships.p2.some((ship: any) => ship.instanceId === 'spiral-target'),
      false,
      removalKind,
    );
    assert.equal(
      state.gameData.voidShipsByPlayerId.p2.some(
        (ship: any) => ship.instanceId === 'spiral-target'
      ),
      true,
      removalKind,
    );
    assert.equal(state.gameData.powerMemory.onceOnlyFired['spi-3::SPI#0'], true, removalKind);
    assert.equal(state.players[0].health, 45, removalKind);

    if (removalKind === 'domination') {
      assert.equal(
        state.gameData.ships.p2.some((ship: any) => ship.instanceId === 'spi-3'),
        true,
      );
    } else {
      assert.equal(
        state.gameData.voidShipsByPlayerId.p1.some((ship: any) => ship.instanceId === 'spi-3'),
        true,
      );
    }

    const spiralCaptureEvents = resolved.events.filter(
      (event: any) =>
        event.type === 'BATTLE_LOG_CAPTURE_BATTLE_DESTROY' &&
        event.playerId === 'p1' &&
        event.sourceShipDefId === 'SPI',
    );
    assert.deepEqual(
      spiralCaptureEvents.map((event: any) => event.targetShipDefIds),
      [['FIG']],
      removalKind,
    );
    assert.equal(
      resolved.events.some(
        (event: any) =>
          event.type === 'POWER_USED' &&
          event.playerId === 'p1' &&
          event.sourceInstanceId === 'spi-3'
      ),
      true,
      removalKind,
    );
    assert.equal(
      state.gameData.turnData.shipActivationCueBatches.some((batch: any) =>
        batch.sources.some((source: any) =>
          source.playerId === 'p1' && source.sourceInstanceId === 'spi-3'
        )
      ),
      true,
      removalKind,
    );
  }
});
