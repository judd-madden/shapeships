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
