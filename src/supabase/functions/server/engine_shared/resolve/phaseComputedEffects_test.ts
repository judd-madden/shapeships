import assert from 'node:assert/strict';
import { EffectKind, EffectTiming, SurvivabilityRule } from '../effects/Effect.ts';
import { computePhaseComputedEffects } from './phaseComputedEffects.ts';
import { resolvePhase } from './resolvePhase.ts';

function createState(args: {
  p1Ships?: any[];
  p2Ships?: any[];
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
      turnData: { turnNumber: 3 },
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
