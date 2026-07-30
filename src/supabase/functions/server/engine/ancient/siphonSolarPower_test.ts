import assert from 'node:assert/strict';
import { EffectKind, EffectTiming, SurvivabilityRule } from '../../engine_shared/effects/Effect.ts';
import {
  resolveManualSolarDeclaration,
  resolveSolarCastSequence,
} from './manualSolarDeclaration.ts';
import { SIPHON_SOLAR_RESOLVER } from './solarPowerResolvers.ts';

function createState(): any {
  return {
    players: [
      { id: 'p1', role: 'player', health: 20 },
      { id: 'p2', role: 'player', health: 20 },
      { id: 'spectator', role: 'spectator', health: 20 },
    ],
    gameData: {
      turnData: {},
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
    },
  };
}

function resolve(state: any, lockedAmount: number, energy: { green: number; red: number; blue: number }) {
  return resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'siphon-test',
    battleTurnNumber: 3,
    initialEnergy: energy,
    casts: [{ solarPowerId: 'SSIP', lockedAmount }],
    resolvers: { SSIP: SIPHON_SOLAR_RESOLVER },
  });
}

function directContext(overrides: Record<string, unknown> = {}): any {
  return {
    state: createState(),
    playerId: 'p1',
    declarationId: 'siphon-direct',
    battleTurnNumber: 3,
    castIndex: 0,
    ledgerOrder: 0,
    sourceMode: 'manual',
    castIdentity: 'ancient-solar:3:p1:siphon-direct:manual:0',
    cast: { solarPowerId: 'SSIP', lockedAmount: 4 },
    remainingEnergy: { green: 4, red: 4, blue: 0 },
    ...overrides,
  };
}

Deno.test('Siphon locks approved piecewise values with safe linear arithmetic', () => {
  for (const [selectedAmount, expectedEffect] of [
    [4, 8],
    [7, 17],
    [8, 20],
    [9, 25],
    [14, 50],
  ] as const) {
    const result = resolve(
      createState(),
      selectedAmount,
      { green: selectedAmount, red: selectedAmount, blue: 4 },
    );
    assert.deepEqual(result.remainingEnergy, { green: 0, red: 0, blue: 4 });
    assert.deepEqual(result.acceptedCasts, [{ solarPowerId: 'SSIP', lockedAmount: selectedAmount }]);
    assert.deepEqual(result.ledgerEntries[0].paidEnergy, {
      green: selectedAmount,
      red: selectedAmount,
      blue: 0,
    });
    assert.equal(result.ledgerEntries[0].lockedAmount, expectedEffect);
    assert.deepEqual(result.effects.map((effect) => ({
      id: effect.id,
      kind: effect.kind,
      target: effect.target,
      amount: 'amount' in effect ? effect.amount : undefined,
    })), [
      {
        id: 'ancient-solar:3:p1:siphon-test:manual:0:heal',
        kind: EffectKind.Heal,
        target: { playerId: 'p1' },
        amount: expectedEffect,
      },
      {
        id: 'ancient-solar:3:p1:siphon-test:manual:0:damage',
        kind: EffectKind.Damage,
        target: { playerId: 'p2' },
        amount: expectedEffect,
      },
    ]);
    for (const effect of result.effects) {
      assert.deepEqual(effect.source, { type: 'system', reason: 'ancient-solar:SSIP' });
      assert.equal(effect.timing, 'battle.end_of_turn_resolution');
      assert.equal(effect.activationTag, EffectTiming.Charge);
      assert.equal(effect.survivability, SurvivabilityRule.ResolvesIfDestroyed);
    }
    assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: expectedEffect });
    assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: expectedEffect });
    assert.equal(result.state.players[0].health, 20);
    assert.equal(result.state.players[1].health, 20);
  }

  const maximumSafeSpend =
    Math.floor(Number.MAX_SAFE_INTEGER / 5) + 4;
  const maximumSafe = resolve(
    createState(),
    maximumSafeSpend,
    { green: maximumSafeSpend, red: maximumSafeSpend, blue: 0 },
  );
  assert.equal(
    maximumSafe.ledgerEntries[0].lockedAmount,
    (maximumSafeSpend - 4) * 5,
  );
  assert.equal(Number.isSafeInteger(maximumSafe.ledgerEntries[0].lockedAmount), true);
});

Deno.test('Siphon defensively rejects invalid selected amounts and unsafe effect results', () => {
  for (const lockedAmount of [
    undefined,
    '4',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -2,
    0,
    1,
    3,
    4.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() => SIPHON_SOLAR_RESOLVER.resolve(directContext({
      cast: { solarPowerId: 'SSIP', lockedAmount },
      remainingEnergy: { green: Number.MAX_SAFE_INTEGER, red: Number.MAX_SAFE_INTEGER, blue: 0 },
    })));
  }

  const maximumSafeSpend =
    Math.floor(Number.MAX_SAFE_INTEGER / 5) + 4;
  const overflowAmount = maximumSafeSpend + 1;
  assert.throws(() => SIPHON_SOLAR_RESOLVER.resolve(directContext({
    cast: { solarPowerId: 'SSIP', lockedAmount: overflowAmount },
    remainingEnergy: { green: overflowAmount, red: overflowAmount, blue: 0 },
  })), /positive safe integer/);
});

Deno.test('Siphon rejects targets, Autocast mode, and colour-specific unaffordability', () => {
  assert.throws(() => SIPHON_SOLAR_RESOLVER.resolve(directContext({
    cast: { solarPowerId: 'SSIP', lockedAmount: 4, targetInstanceId: 'target' },
  })), /targetInstanceId/);
  assert.throws(() => SIPHON_SOLAR_RESOLVER.resolve(directContext({
    cast: { solarPowerId: 'SSIP', lockedAmount: 4, targetInstanceIds: ['target'] },
  })), /targetInstanceIds/);
  assert.throws(() => SIPHON_SOLAR_RESOLVER.resolve(directContext({ sourceMode: 'autocast' })), /manual Solar cast/);

  for (const [energy, message] of [
    [{ green: 3, red: 4, blue: 0 }, /green Energy/],
    [{ green: 4, red: 3, blue: 0 }, /red Energy/],
  ] as const) {
    const state = createState();
    const before = structuredClone(state);
    assert.throws(() => resolve(state, 4, energy), message);
    assert.deepEqual(state, before);
  }

  assert.throws(() => resolveSolarCastSequence({
    state: createState(),
    playerId: 'p1',
    declarationId: 'siphon-autocast',
    battleTurnNumber: 3,
    initialEnergy: { green: 4, red: 4, blue: 0 },
    casts: [{ solarPowerId: 'SSIP', lockedAmount: 4 }],
    resolvers: { SSIP: SIPHON_SOLAR_RESOLVER },
    sourceMode: 'autocast',
    initialLedgerOrder: 0,
  }), /manual Solar cast/);
});

Deno.test('Siphon damage requires exactly two active player seats including the caster', () => {
  const malformedSeatSets = [
    [],
    [{ id: 'p1', role: 'player' }],
    [{ id: 'p2', role: 'player' }, { id: 'p3', role: 'player' }],
    [{ id: 'p1', role: 'player' }, { id: 'p1', role: 'player' }],
    [{ id: 'p1', role: 'player' }, { id: 'p2', role: 'player' }, { id: 'p3', role: 'player' }],
  ];
  for (const players of malformedSeatSets) {
    const state = createState();
    state.players = players;
    const before = structuredClone(state);
    assert.throws(() => resolve(state, 4, { green: 4, red: 4, blue: 0 }), /exactly two active player seats/);
    assert.deepEqual(state, before);
  }
});
