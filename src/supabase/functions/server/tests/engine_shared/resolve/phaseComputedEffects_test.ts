import assert from 'node:assert/strict';
import { EffectKind, EffectTiming, SurvivabilityRule } from '../../../engine_shared/effects/Effect.ts';
import { computePhaseComputedEffects } from '../../../engine_shared/resolve/phaseComputedEffects.ts';
import { resolvePhase } from '../../../engine_shared/resolve/resolvePhase.ts';
import { replaceChargeDeclarationVisibilityState } from '../../../engine/state/chargeDeclarationVisibility.ts';
import { sanitizeAncientStateForClient } from '../../../engine/state/ancientState.ts';

function createState(args: {
  p1Ships?: any[];
  p2Ships?: any[];
  p1VoidShips?: any[];
  p2VoidShips?: any[];
  cubeSelectionByPlayerId?: Record<string, unknown>;
  markerByInstanceId?: Record<string, unknown>;
}) {
  return {
    gameId: 'phase-computed-qua-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 20, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 20, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      ships: { p1: args.p1Ships ?? [], p2: args.p2Ships ?? [] },
      voidShipsByPlayerId: {
        p1: args.p1VoidShips ?? [],
        p2: args.p2VoidShips ?? [],
      },
      turnData: {
        turnNumber: 3,
        cubeDiceSelectionByPlayerId: args.cubeSelectionByPlayerId,
      },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: {},
        quantumMysticRevealByInstanceId: args.markerByInstanceId ?? {},
      },
    },
  } as any;
}

function qua(instanceId: string) {
  return {
    instanceId,
    shipDefId: 'QUA',
    permanentConfiguration: { selectedNumber: 3 },
  };
}

function spi(instanceId: string) {
  return { instanceId, shipDefId: 'SPI' };
}

function sol(instanceId: string, chargesCurrent: number) {
  return { instanceId, shipDefId: 'SOL', chargesCurrent };
}

function cub(instanceId: string) {
  return { instanceId, shipDefId: 'CUB' };
}

Deno.test('lower-health Defense Swarm branch emits an attributed Automatic Heal 6', () => {
  const state = createState({
    p1Ships: [{ instanceId: 'defense-swarm-1', shipDefId: 'DSW' }],
  });
  state.players[0].health = 12;
  state.players[1].health = 20;

  const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects
    .filter((effect) => (effect.source as any).shipDefId === 'DSW');

  assert.deepEqual(effects, [
    {
      id: 'defenseswarm_3_defense-swarm-1',
      ownerPlayerId: 'p1',
      source: { type: 'ship', instanceId: 'defense-swarm-1', shipDefId: 'DSW' },
      timing: 'battle.end_of_turn_resolution',
      activationTag: EffectTiming.Automatic,
      survivability: SurvivabilityRule.DiesWithSource,
      target: { playerId: 'p1' },
      kind: EffectKind.Heal,
      amount: 6,
    },
  ]);
});

Deno.test('coherent Cube selection emits one attributed Automatic Damage 3 per live Cube', () => {
  const state = createState({
    p1Ships: [cub('cube-a'), cub('cube-b')],
    cubeSelectionByPlayerId: {
      p1: { choiceId: 'cube:cube-a', sourceInstanceId: 'cube-a', value: 4 },
    },
  });
  const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects
    .filter((effect) => (effect.source as any).shipDefId === 'CUB');

  assert.deepEqual(effects, [
    {
      id: 'cube_damage_3_cube-a',
      ownerPlayerId: 'p1',
      source: { type: 'ship', instanceId: 'cube-a', shipDefId: 'CUB' },
      timing: 'battle.end_of_turn_resolution',
      activationTag: EffectTiming.Automatic,
      survivability: SurvivabilityRule.DiesWithSource,
      target: { playerId: 'p2' },
      kind: EffectKind.Damage,
      amount: 3,
    },
    {
      id: 'cube_damage_3_cube-b',
      ownerPlayerId: 'p1',
      source: { type: 'ship', instanceId: 'cube-b', shipDefId: 'CUB' },
      timing: 'battle.end_of_turn_resolution',
      activationTag: EffectTiming.Automatic,
      survivability: SurvivabilityRule.DiesWithSource,
      target: { playerId: 'p2' },
      kind: EffectKind.Damage,
      amount: 3,
    },
  ]);
});

Deno.test('main, missing, malformed, and incoherent Cube selections emit no damage', () => {
  const selections = [
    { choiceId: 'main', sourceInstanceId: 'cube-a', value: 4 },
    undefined,
    { choiceId: 'cube:', sourceInstanceId: '', value: 4 },
    { choiceId: 'cube:cube-a', value: 4 },
    { choiceId: 'cube:cube-a', sourceInstanceId: 'cube-b', value: 4 },
  ];

  for (const selection of selections) {
    const state = createState({
      p1Ships: [cub('cube-a')],
      cubeSelectionByPlayerId: selection === undefined ? {} : { p1: selection },
    });
    const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects;
    assert.equal(
      effects.some((effect) => (effect.source as any).shipDefId === 'CUB'),
      false,
    );
  }
});

Deno.test('equal main and Cube values still trigger from the coherent retained selection', () => {
  const state = createState({
    p1Ships: [cub('cube-a')],
    cubeSelectionByPlayerId: {
      p1: { choiceId: 'cube:cube-a', sourceInstanceId: 'cube-a', value: 5 },
    },
  });
  state.gameData.turnData.baseDiceRoll = 5;
  state.gameData.turnData.effectiveDiceRoll = 5;
  state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 5, p2: 5 };

  const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects
    .filter((effect) => (effect.source as any).shipDefId === 'CUB');
  assert.equal(effects.length, 1);
  assert.equal((effects[0] as any).amount, 3);
});

Deno.test('only current live Cubes emit when the selected source is already VOID', () => {
  const state = createState({
    p1Ships: [cub('cube-survivor')],
    p1VoidShips: [cub('cube-selected')],
    cubeSelectionByPlayerId: {
      p1: {
        choiceId: 'cube:cube-selected',
        sourceInstanceId: 'cube-selected',
        value: 3,
      },
    },
  });
  const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects
    .filter((effect) => (effect.source as any).shipDefId === 'CUB');

  assert.deepEqual(
    effects.map((effect) => (effect.source as any).instanceId),
    ['cube-survivor'],
  );
});

Deno.test('Cube selection stays player-specific while damage follows current control', () => {
  const formerControllerOnly = createState({
    p1Ships: [cub('cube-p1-survivor')],
    p2Ships: [cub('cube-transferred')],
    cubeSelectionByPlayerId: {
      p1: {
        choiceId: 'cube:cube-transferred',
        sourceInstanceId: 'cube-transferred',
        value: 6,
      },
    },
  });
  const formerControllerEffects = computePhaseComputedEffects(
    formerControllerOnly,
    'battle.end_of_turn_resolution',
  ).effects.filter((effect) => (effect.source as any).shipDefId === 'CUB');
  assert.deepEqual(
    formerControllerEffects.map((effect) => ({
      ownerPlayerId: effect.ownerPlayerId,
      instanceId: (effect.source as any).instanceId,
    })),
    [{ ownerPlayerId: 'p1', instanceId: 'cube-p1-survivor' }],
  );

  const bothControllersSelected = createState({
    p1Ships: [cub('cube-p1-survivor')],
    p2Ships: [cub('cube-transferred')],
    cubeSelectionByPlayerId: {
      p1: {
        choiceId: 'cube:cube-transferred',
        sourceInstanceId: 'cube-transferred',
        value: 6,
      },
      p2: { choiceId: 'cube:cube-p2-source', sourceInstanceId: 'cube-p2-source', value: 2 },
    },
  });
  const bothControllerEffects = computePhaseComputedEffects(
    bothControllersSelected,
    'battle.end_of_turn_resolution',
  ).effects.filter((effect) => (effect.source as any).shipDefId === 'CUB');
  assert.deepEqual(
    bothControllerEffects.map((effect) => ({
      ownerPlayerId: effect.ownerPlayerId,
      instanceId: (effect.source as any).instanceId,
      targetPlayerId: effect.target.playerId,
    })),
    [
      { ownerPlayerId: 'p1', instanceId: 'cube-p1-survivor', targetPlayerId: 'p2' },
      { ownerPlayerId: 'p2', instanceId: 'cube-transferred', targetPlayerId: 'p1' },
    ],
  );
});

Deno.test('Cube damage participates in Automatic modifiers, breakdown, and idempotency', () => {
  const state = createState({
    p1Ships: [
      cub('cube-1'),
      { instanceId: 'science-1', shipDefId: 'SCI' },
      { instanceId: 'science-2', shipDefId: 'SCI' },
      { instanceId: 'science-3', shipDefId: 'SCI' },
    ],
    cubeSelectionByPlayerId: {
      p1: { choiceId: 'cube:cube-1', sourceInstanceId: 'cube-1', value: 2 },
    },
  });

  const first = resolvePhase(state, 'battle.end_of_turn_resolution');
  assert.equal(first.state.players.find((player: any) => player.id === 'p2')?.health, 14);
  assert.equal(first.state.gameData.lastTurnDamageByPlayerId?.p2, 6);
  assert.equal(
    first.state.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Cube' && row.count === 1 && row.amount === 3,
    ),
    true,
  );
  assert.equal(
    first.state.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Science Vessel' && row.amount === 3,
    ),
    true,
  );

  const second = resolvePhase(first.state, 'battle.end_of_turn_resolution');
  assert.equal(second.state.players.find((player: any) => player.id === 'p2')?.health, 14);
  assert.deepEqual(second.events, []);
});

Deno.test('live depleted SOL emits one attributed Automatic Heal 2 per source for any controller', () => {
  const state = createState({
    p1Ships: [sol('sol-a', 0), sol('sol-b', 0), sol('sol-charged', 1)],
    p2Ships: [sol('sol-non-ancient', 0)],
  });
  const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects
    .filter((effect) => (effect.source as any).shipDefId === 'SOL');
  assert.deepEqual(
    effects.map((effect) => ({
      id: effect.id,
      ownerPlayerId: effect.ownerPlayerId,
      targetPlayerId: effect.target.playerId,
      amount: (effect as any).amount,
    })),
    [
      { id: 'solar_grid_3_sol-a', ownerPlayerId: 'p1', targetPlayerId: 'p1', amount: 2 },
      { id: 'solar_grid_3_sol-b', ownerPlayerId: 'p1', targetPlayerId: 'p1', amount: 2 },
      { id: 'solar_grid_3_sol-non-ancient', ownerPlayerId: 'p2', targetPlayerId: 'p2', amount: 2 },
    ],
  );
  for (const effect of effects) {
    assert.equal(effect.activationTag, EffectTiming.Automatic);
    assert.equal(effect.survivability, SurvivabilityRule.DiesWithSource);
  }
});

Deno.test('destroyed or malformed-charge SOL does not emit depleted healing', () => {
  const state = createState({ p1Ships: [sol('charged', 2), { instanceId: 'missing-charge', shipDefId: 'SOL' }] });
  state.gameData.voidShipsByPlayerId = { p1: [sol('destroyed', 0)], p2: [] };
  const effects = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution').effects;
  assert.equal(effects.some((effect) => (effect.source as any).shipDefId === 'SOL'), false);
});

Deno.test('SOL heal participates in Automatic modifiers, attribution breakdown, and idempotency', () => {
  const state = createState({
    p1Ships: [sol('sol-1', 0), { instanceId: 'science', shipDefId: 'SCI' }],
  });
  const first = resolvePhase(state, 'battle.end_of_turn_resolution');
  assert.equal(first.state.players.find((player: any) => player.id === 'p1')?.health, 24);
  assert.equal(first.state.gameData.lastTurnHealByPlayerId?.p1, 4);
  assert.equal(
    first.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Solar Grid' && row.amount === 2,
    ),
    true,
  );
  assert.equal(
    first.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Science Vessel' && row.amount === 2,
    ),
    true,
  );
  const second = resolvePhase(first.state, 'battle.end_of_turn_resolution');
  assert.equal(second.state.players.find((player: any) => player.id === 'p1')?.health, 24);
  assert.deepEqual(second.events, []);
});

Deno.test('Spiral emits one attributed Automatic heal per live source for totals 1, 4, and 9', () => {
  for (const [count, expectedTotal] of [[1, 1], [2, 4], [3, 9]]) {
    const state = createState({
      p1Ships: Array.from({ length: count }, (_, index) => spi(`spi-${index}`)),
    });
    const result = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution');
    const effects = result.effects.filter((effect) =>
      (effect.source as any).shipDefId === 'SPI'
    );

    assert.equal(effects.length, count);
    assert.equal(effects.reduce((total, effect) => total + (effect as any).amount, 0), expectedTotal);
    for (const effect of effects) {
      assert.equal(effect.ownerPlayerId, 'p1');
      assert.equal(effect.target.playerId, 'p1');
      assert.equal(effect.activationTag, EffectTiming.Automatic);
      assert.equal(effect.survivability, SurvivabilityRule.DiesWithSource);
      assert.equal((effect as any).amount, count);
    }
  }
});

Deno.test('Spiral uses current controller, live fleet count, shared modifiers, and breakdown', () => {
  const state = createState({
    p1Ships: [spi('spi-live'), { instanceId: 'science', shipDefId: 'SCI' }],
    p2Ships: [spi('spi-human-a'), spi('spi-human-b')],
  });
  state.players[1].faction = 'human';

  const result = resolvePhase(state, 'battle.end_of_turn_resolution');
  assert.equal(result.state.gameData.lastTurnHealByPlayerId?.p1, 2);
  assert.equal(result.state.gameData.lastTurnHealByPlayerId?.p2, 4);
  assert.equal(
    result.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Spiral' && row.amount === 1,
    ),
    true,
  );
  assert.equal(
    result.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Science Vessel' && row.amount === 1,
    ),
    true,
  );

  const afterLoss = createState({ p1Ships: [spi('spi-survivor')] });
  const effectsAfterLoss = computePhaseComputedEffects(
    afterLoss,
    'battle.end_of_turn_resolution',
  ).effects.filter((effect) => (effect.source as any).shipDefId === 'SPI');
  assert.deepEqual(effectsAfterLoss.map((effect) => (effect.source as any).instanceId), ['spi-survivor']);
  assert.equal((effectsAfterLoss[0] as any).amount, 1);
});

Deno.test('live current-turn QUA marker emits one ordinary attributed heal', () => {
  const state = createState({
    p1Ships: [qua('qua-1')],
    markerByInstanceId: { 'qua-1': { battleTurnNumber: 3, controllerPlayerId: 'p1' } },
  });
  const result = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution');
  const effect = result.effects.find((candidate) =>
    (candidate.source as any).instanceId === 'qua-1'
  );

  assert.deepEqual(effect, {
    id: 'quantum_mystic_3_qua-1',
    ownerPlayerId: 'p1',
    source: { type: 'ship', instanceId: 'qua-1', shipDefId: 'QUA' },
    timing: 'battle.end_of_turn_resolution',
    activationTag: EffectTiming.Automatic,
    survivability: SurvivabilityRule.DiesWithSource,
    target: { playerId: 'p1' },
    kind: EffectKind.Heal,
    amount: 5,
  });
});

Deno.test('Charge Declaration projection hides QUA reveal memory without changing its later heal', () => {
  const state = createState({
    p1Ships: [qua('qua-projected')],
    markerByInstanceId: {
      'qua-projected': { battleTurnNumber: 3, controllerPlayerId: 'p1' },
    },
  });
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.turnData.currentMajorPhase = 'battle';
  state.gameData.turnData.currentSubPhase = 'charge_declaration';
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(state.gameData.ships);
  replaceChargeDeclarationVisibilityState(state);
  const canonicalMemoryBefore = structuredClone(
    state.gameData.powerMemory.quantumMysticRevealByInstanceId,
  );

  const projected: any = sanitizeAncientStateForClient(state, 'p1');
  assert.deepEqual(projected.gameData.powerMemory, {
    frigateTriggerByInstanceId: {},
  });
  assert.equal(
    projected.gameData.ships.p1[0].permanentConfiguration.selectedNumber,
    3,
  );
  assert.deepEqual(
    state.gameData.powerMemory.quantumMysticRevealByInstanceId,
    canonicalMemoryBefore,
  );

  const resolved = resolvePhase(state, 'battle.end_of_turn_resolution');
  assert.equal(
    resolved.state.players.find((player: any) => player.id === 'p1')?.health,
    25,
  );
  assert.equal(
    resolved.events.some((event: any) =>
      event.type === 'EFFECT_APPLIED' &&
      event.kind === 'Heal' &&
      event.effectId === 'quantum_mystic_3_qua-projected'
    ),
    true,
  );
});

Deno.test('missing, malformed, stale, and destroyed QUA markers emit no heal', () => {
  const states = [
    createState({ p1Ships: [qua('qua-1')] }),
    createState({ p1Ships: [qua('qua-1')], markerByInstanceId: { 'qua-1': { battleTurnNumber: 3 } } }),
    createState({ p1Ships: [qua('qua-1')], markerByInstanceId: { 'qua-1': { battleTurnNumber: 2, controllerPlayerId: 'p1' } } }),
    createState({ markerByInstanceId: { 'qua-1': { battleTurnNumber: 3, controllerPlayerId: 'p1' } } }),
  ];

  for (const state of states) {
    const result = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution');
    assert.equal(result.effects.some((effect) => (effect.source as any).shipDefId === 'QUA'), false);
  }
});

Deno.test('stolen live QUA heals its reveal-time controller rather than its current fleet owner', () => {
  const state = createState({
    p2Ships: [qua('qua-stolen')],
    markerByInstanceId: {
      'qua-stolen': { battleTurnNumber: 3, controllerPlayerId: 'p1' },
    },
  });
  const result = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution');
  const effect = result.effects.find((candidate) =>
    (candidate.source as any).instanceId === 'qua-stolen'
  );
  assert.equal(effect?.ownerPlayerId, 'p1');
  assert.equal(effect?.target.playerId, 'p1');
});

Deno.test('multiple QUA markers stack and retain ordinary computed effects', () => {
  const state = createState({
    p1Ships: [qua('qua-a'), qua('qua-b'), { instanceId: 'man', shipDefId: 'MAN' }, { instanceId: 'x1', shipDefId: 'XEN' }, { instanceId: 'x2', shipDefId: 'XEN' }],
    markerByInstanceId: {
      'qua-a': { battleTurnNumber: 3, controllerPlayerId: 'p1' },
      'qua-b': { battleTurnNumber: 3, controllerPlayerId: 'p1' },
    },
  });
  const result = computePhaseComputedEffects(state, 'battle.end_of_turn_resolution');
  assert.equal(
    result.effects.filter((effect) => (effect.source as any).shipDefId === 'QUA').length,
    2,
  );
  assert.equal(
    result.effects.some((effect) =>
      (effect.source as any).shipDefId === 'MAN' && (effect as any).amount === 1
    ),
    true,
  );
});

Deno.test('QUA heal uses existing Automatic modifiers, breakdown, and end-of-turn idempotency', () => {
  const state = createState({
    p1Ships: [qua('qua-1'), { instanceId: 'science', shipDefId: 'SCI' }],
    markerByInstanceId: { 'qua-1': { battleTurnNumber: 3, controllerPlayerId: 'p1' } },
  });
  const first = resolvePhase(state, 'battle.end_of_turn_resolution');
  assert.equal(first.state.players.find((player: any) => player.id === 'p1')?.health, 30);
  assert.equal(first.state.gameData.lastTurnHealByPlayerId?.p1, 10);
  assert.equal(
    first.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Quantum Mystic' && row.amount === 5,
    ),
    true,
  );
  assert.equal(
    first.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1?.some(
      (row: any) => row.label === 'Science Vessel' && row.amount === 5,
    ),
    true,
  );

  const second = resolvePhase(first.state, 'battle.end_of_turn_resolution');
  assert.equal(second.state.players.find((player: any) => player.id === 'p1')?.health, 30);
  assert.deepEqual(second.events, []);
});
