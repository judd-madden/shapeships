import assert from 'node:assert/strict';
import { applyIntent, type IntentRequest } from './IntentReducer.ts';
import { normalizeAncientGameState } from '../state/ancientState.ts';

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

  return normalizeAncientGameState({
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
  }).state;
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

function createAtomicChargeState(args: {
  solCharges?: number;
  p2Ready?: boolean;
  p1HasInterceptor?: boolean;
} = {}): any {
  const solCharges = args.solCharges ?? 4;
  const p1Ships: any[] = [{ instanceId: 'sol-1', shipDefId: 'SOL', chargesCurrent: solCharges }];
  if (args.p1HasInterceptor) {
    p1Ships.unshift({ instanceId: 'p1-int', shipDefId: 'INT', chargesCurrent: 1 });
  }
  return {
    gameId: 'atomic-charge-reducer-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 20, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 20, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: args.p2Ready
        ? [{ playerId: 'p2', isReady: true, currentStep: 'battle.charge_declaration' }]
        : [],
      ships: {
        p1: p1Ships,
        p2: [{ instanceId: 'p2-int', shipDefId: 'INT', chargesCurrent: 1 }],
      },
      voidShipsByPlayerId: { p1: [], p2: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleByPlayerId: {
          p1: args.p1HasInterceptor === true,
          p2: true,
        },
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          p1: args.p1HasInterceptor ? ['p1-int'] : [],
          p2: ['p2-int'],
        },
        solarGridDeclarationSourceIdsByPlayerId: { p1: ['sol-1'], p2: [] },
        chargeDeclarationFleetSnapshotByPlayerId: {
          p1: structuredClone(p1Ships),
          p2: [{ instanceId: 'p2-int', shipDefId: 'INT', chargesCurrent: 1 }],
        },
        chargePowerUsedByInstanceId: {},
        anyChargesSpentInDeclaration: false,
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {
          p1: { battleTurnNumber: 3, pool: { green: 0, red: 0, blue: 0 }, sources: [] },
          p2: { battleTurnNumber: 3, pool: { green: 0, red: 0, blue: 0 }, sources: [] },
        },
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {
          p1: { battleTurnNumber: null, entries: [] },
          p2: { battleTurnNumber: null, entries: [] },
        },
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
}

function chargeDeclarationIntent(args: {
  declarationId?: string;
  ordinaryChargeActions?: any[];
  solarChoice?: 'use' | 'hold';
  solarCasts?: any[];
  autocastEnabled?: boolean;
} = {}): IntentRequest {
  return {
    gameId: 'atomic-charge-reducer-test',
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload: {
      contractVersion: 1,
      declarationId: args.declarationId ?? 'atomic-declaration-1',
      ordinaryChargeActions: args.ordinaryChargeActions ?? [],
      solarGridChoices: [{ sourceInstanceId: 'sol-1', choiceId: args.solarChoice ?? 'hold' }],
      solarCasts: args.solarCasts ?? [],
      autocastEnabled: args.autocastEnabled ?? false,
    },
  };
}

Deno.test('unknown Solar casts reject without readiness or state mutation', async () => {
  const state = createAtomicChargeState();
  const before = structuredClone(state);
  const result = await applyIntent(
    state,
    'p1',
    chargeDeclarationIntent({ solarCasts: [{ solarPowerId: 'UNKNOWN' }] }),
    1000,
  );
  assert.equal(result.ok, false);
  assert.match(result.rejected?.message ?? '', /Unknown Solar Power ID/);
  assert.deepEqual(result.state, before);
  assert.deepEqual(result.events, []);
  assert.equal(
    result.state.gameData.phaseReadiness.some((entry: any) => entry.playerId === 'p1' && entry.isReady),
    false,
  );
});

Deno.test('CHARGE_DECLARATION_SUBMIT commits production Autocast, readiness, and no Solar activation events', async () => {
  const state = createAtomicChargeState();
  const result = await applyIntent(
    state,
    'p1',
    chargeDeclarationIntent({ solarChoice: 'use', autocastEnabled: true }),
    1000,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, {
    green: 0,
    red: 0,
    blue: 0,
  });
  assert.deepEqual(
    result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries.map((entry: any) => [
      entry.solarPowerId,
      entry.sourceMode,
      entry.order,
    ]),
    [
      ['SCON', 'autocast', 0],
      ['SLIF', 'autocast', 1],
      ['SAST', 'autocast', 2],
    ],
  );
  assert.equal(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.autocastEnabled, true);
  assert.equal(
    result.state.gameData.phaseReadiness.some(
      (entry: any) => entry.playerId === 'p1' && entry.isReady,
    ),
    true,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'POWER_USED' && String(event.sourceInstanceId).includes('ancient-solar')
    ),
    false,
  );
  assert.equal(
    result.events.some((event: any) => String(event.type).startsWith('BATTLE_LOG_')),
    false,
  );
  assert.equal(
    (result.state.gameData.turnData.shipActivationCueBatches ?? [])
      .flatMap((batch: any) => batch.sources ?? [])
      .some((source: any) => String(source.sourceInstanceId).includes('ancient-solar')),
    false,
  );
});

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

Deno.test('Ancient atomic contract permits chat and rejects every legacy declaration path before and after acceptance', async () => {
  let state = createAtomicChargeState();
  const chat = await applyIntent(state, 'p1', {
    gameId: state.gameId,
    intentType: 'ACTION',
    turnNumber: 3,
    payload: { actionType: 'message', content: 'still drafting' },
  }, 1000);
  assert.equal(chat.ok, true);
  assert.equal(chat.events.some((event: any) => event.type === 'CHAT_MESSAGE'), true);

  for (const intent of [
    powerActionIntent(state.gameId, 'p2-int', 'INT#0', 'hold', {}),
    {
      gameId: state.gameId,
      intentType: 'ACTIONS_SUBMIT' as const,
      turnNumber: 3,
      payload: { actions: [] },
    },
    readyIntent(state.gameId, 'p1'),
  ]) {
    const rejected = await applyIntent(createAtomicChargeState(), 'p1', intent, 1001);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.rejected?.code, 'PHASE_NOT_ALLOWED');
  }

  const accepted = await applyIntent(state, 'p1', chargeDeclarationIntent(), 1002);
  assert.equal(accepted.ok, true);
  state = accepted.state;
  assert.equal(state.gameData.currentSubPhase, 'charge_declaration');
  assert.equal(
    state.gameData.phaseReadiness.some((entry: any) => entry.playerId === 'p1' && entry.isReady),
    true,
  );

  const afterAcceptanceLegacy = await applyIntent(
    state,
    'p1',
    readyIntent(state.gameId, 'p1'),
    1003,
  );
  assert.equal(afterAcceptanceLegacy.ok, false);
  assert.equal(afterAcceptanceLegacy.rejected?.code, 'PHASE_NOT_ALLOWED');
});

Deno.test('identical accepted declaration retries after phase advancement without replaying or changing state', async () => {
  const initial = createAtomicChargeState({ p2Ready: true, p1HasInterceptor: true });
  const intent = chargeDeclarationIntent({
    ordinaryChargeActions: [{
      actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p1-int', choiceId: 'damage',
    }],
  });
  const accepted = await applyIntent(initial, 'p1', intent, 1000);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.gameData.currentSubPhase, 'charge_response');
  assert.equal(accepted.events.some((event: any) => event.type === 'CHARGE_DECLARATION_ACCEPTED'), true);
  const beforeRetry = structuredClone(accepted.state);

  const retry = await applyIntent(accepted.state, 'p1', intent, 1001);
  assert.equal(retry.ok, true);
  assert.deepEqual(retry.events, []);
  assert.deepEqual(retry.state, beforeRetry);

  const changed = await applyIntent(
    retry.state,
    'p1',
    chargeDeclarationIntent({
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p1-int', choiceId: 'heal',
      }],
    }),
    1002,
  );
  assert.equal(changed.ok, false);
  assert.match(changed.rejected?.message ?? '', /different charge declaration/);

  const newId = await applyIntent(
    retry.state,
    'p1',
    chargeDeclarationIntent({
      declarationId: 'different-id',
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'p1-int', choiceId: 'damage',
      }],
    }),
    1003,
  );
  assert.equal(newId.ok, false);
});

Deno.test('non-Ancient legacy charge and Ready behavior remains available', async () => {
  const state = createAtomicChargeState();
  const action = await applyIntent(
    state,
    'p2',
    powerActionIntent(state.gameId, 'p2-int', 'INT#0', 'hold', {}),
    1000,
  );
  assert.equal(action.ok, true);
  const ready = await applyIntent(action.state, 'p2', readyIntent(state.gameId, 'p2'), 1001);
  assert.equal(ready.ok, true);
});

Deno.test('atomic declaration routing rejects stale turns, wrong phases, and malformed contracts', async () => {
  const stale = chargeDeclarationIntent();
  stale.turnNumber = 2;
  const staleResult = await applyIntent(createAtomicChargeState(), 'p1', stale, 1000);
  assert.equal(staleResult.ok, false);
  assert.equal(staleResult.rejected?.code, 'BAD_TURN');

  const wrongPhaseState = createAtomicChargeState();
  wrongPhaseState.gameData.currentSubPhase = 'first_strike';
  wrongPhaseState.gameData.turnData.currentSubPhase = 'first_strike';
  const wrongPhase = await applyIntent(wrongPhaseState, 'p1', chargeDeclarationIntent(), 1000);
  assert.equal(wrongPhase.ok, false);
  assert.equal(wrongPhase.rejected?.code, 'WRONG_PHASE');

  const malformed = chargeDeclarationIntent();
  (malformed.payload as any).contractVersion = 99;
  const malformedResult = await applyIntent(createAtomicChargeState(), 'p1', malformed, 1000);
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.rejected?.code, 'BAD_PAYLOAD');
});

Deno.test('final SOL charge submitted atomically produces its depleted Heal 2 in the same turn', async () => {
  let state = createAtomicChargeState({ solCharges: 1 });
  const declaration = await applyIntent(
    state,
    'p1',
    chargeDeclarationIntent({ solarChoice: 'use' }),
    1000,
  );
  assert.equal(declaration.ok, true);
  state = declaration.state;
  assert.equal(state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-1').chargesCurrent, 0);
  assert.deepEqual(state.gameData.ancient.energyByPlayerId.p1.pool, { green: 1, red: 1, blue: 1 });
  assert.equal(state.gameData.turnData.anyChargesSpentInDeclaration, false);
  assert.equal(state.players.find((player: any) => player.id === 'p1').health, 20);

  const resolved = await applyIntent(state, 'p2', readyIntent(state.gameId, 'p2'), 1001);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.players.find((player: any) => player.id === 'p1').health, 22);
  assert.equal(
    resolved.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-1').chargesCurrent,
    0,
  );
  assert.equal(
    resolved.events.some((event: any) =>
      event.type === 'EFFECT_APPLIED' &&
      event.kind === 'Heal' &&
      event.effectId === 'solar_grid_3_sol-1'
    ),
    true,
  );
});
