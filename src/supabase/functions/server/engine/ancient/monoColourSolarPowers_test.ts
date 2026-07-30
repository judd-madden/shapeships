import assert from 'node:assert/strict';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { resolveManualSolarDeclaration } from './manualSolarDeclaration.ts';
import {
  buildMonoColourAutocastCasts,
  MONO_COLOUR_SOLAR_COSTS,
  PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
} from './solarPowerResolvers.ts';

function createState(): any {
  return {
    players: [
      { id: 'p1', role: 'player', health: 20, lines: 0, joiningLines: 7 },
      { id: 'p2', role: 'player', health: 20, lines: 0, joiningLines: 3 },
      { id: 'spectator', role: 'spectator', health: 20, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnData: {
        effectiveDiceRoll: 6,
        effectiveDiceRollByPlayerId: { p1: 2, p2: 5 },
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
    },
  };
}

function resolve(state: any, casts: any[], initialEnergy: any) {
  return resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'mono-colour-test',
    battleTurnNumber: 3,
    initialEnergy,
    casts,
    resolvers: PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
  });
}

Deno.test('mono-colour costs, registry membership, and fixed Autocast priority are authoritative', () => {
  assert.equal(Object.isFrozen(MONO_COLOUR_SOLAR_COSTS), true);
  for (const cost of Object.values(MONO_COLOUR_SOLAR_COSTS)) {
    assert.equal(Object.isFrozen(cost), true);
  }
  assert.deepEqual(MONO_COLOUR_SOLAR_COSTS, {
    SLIF: { green: 1, red: 0, blue: 0 },
    SSTA: { green: 3, red: 0, blue: 0 },
    SAST: { green: 0, red: 1, blue: 0 },
    SSUP: { green: 0, red: 3, blue: 0 },
    SCON: { green: 0, red: 0, blue: 1 },
  });
  assert.deepEqual(Object.keys(PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS).sort(), [
    'SAST', 'SCON', 'SLIF', 'SSTA', 'SSUP',
  ]);
  for (const unsupported of ['SSIP', 'SVOR', 'SBLA', 'SSIM']) {
    assert.equal((PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS as any)[unsupported], undefined);
  }

  const ids = (energy: any) => buildMonoColourAutocastCasts(energy).map((cast) => cast.solarPowerId);
  assert.deepEqual(ids({ green: 0, red: 10, blue: 0 }), ['SSUP', 'SSUP', 'SSUP', 'SAST']);
  assert.deepEqual(ids({ green: 8, red: 0, blue: 0 }), ['SSTA', 'SSTA', 'SLIF', 'SLIF']);
  assert.deepEqual(ids({ green: 0, red: 0, blue: 4 }), ['SCON', 'SCON', 'SCON', 'SCON']);
  assert.deepEqual(
    ids({ green: 4, red: 4, blue: 2 }),
    ['SSTA', 'SSUP', 'SCON', 'SCON', 'SLIF', 'SAST'],
  );
});

Deno.test('all mono-colour resolvers use deterministic Solar system effects and authoritative paths', () => {
  const state = createState();
  const result = resolve(state, [
    { solarPowerId: 'SLIF' },
    { solarPowerId: 'SSTA' },
    { solarPowerId: 'SAST' },
    { solarPowerId: 'SSUP' },
    { solarPowerId: 'SCON' },
    { solarPowerId: 'SCON' },
  ], { green: 4, red: 4, blue: 2 });

  assert.deepEqual(result.remainingEnergy, { green: 0, red: 0, blue: 0 });
  assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: 6 });
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 6 });
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 20);
  assert.equal(result.state.players[0].lines, 0);
  assert.equal(result.state.players[0].joiningLines, 7);
  assert.equal(result.ledgerEntries.length, 6);
  assert.deepEqual(result.ledgerEntries.map((entry) => entry.lockedAmount), [
    undefined, 5, undefined, 5, undefined, undefined,
  ]);
  assert.deepEqual(
    result.ledgerEntries
      .filter((entry) => entry.solarPowerId === 'SCON')
      .map((entry) => entry.sourceMode),
    ['manual', 'manual'],
  );
  assert.equal(result.effects.length, 4);
  assert.deepEqual(
    result.effects.map((effect) => effect.source),
    [
      { type: 'system', reason: 'ancient-solar:SLIF' },
      { type: 'system', reason: 'ancient-solar:SSTA' },
      { type: 'system', reason: 'ancient-solar:SAST' },
      { type: 'system', reason: 'ancient-solar:SSUP' },
    ],
  );
  assert.equal(
    result.effects.some((effect) => effect.kind === EffectKind.GainLines),
    false,
  );
});

Deno.test('mono-colour production powers reject every irrelevant client field', () => {
  for (const solarPowerId of ['SLIF', 'SSTA', 'SAST', 'SSUP', 'SCON'] as const) {
    const cost = MONO_COLOUR_SOLAR_COSTS[solarPowerId];
    for (const field of [
      { targetInstanceId: 'target' },
      { targetInstanceIds: ['target'] },
      { lockedAmount: 4 },
    ]) {
      const state = createState();
      const before = structuredClone(state);
      assert.throws(() => resolve(
        state,
        [{ solarPowerId, ...field }],
        { green: cost.green, red: cost.red, blue: cost.blue },
      ), /does not accept/);
      assert.deepEqual(state, before);
    }
  }
});

Deno.test('dice-derived powers use per-player effective dice boundaries and reject invalid values atomically', () => {
  const lowState = createState();
  lowState.gameData.turnData.effectiveDiceRollByPlayerId.p1 = 1;
  assert.equal(resolve(lowState, [{ solarPowerId: 'SSTA' }], { green: 3, red: 0, blue: 0 })
    .ledgerEntries[0].lockedAmount, 4);

  const highState = createState();
  highState.gameData.turnData.effectiveDiceRollByPlayerId.p1 = 6;
  assert.equal(resolve(highState, [{ solarPowerId: 'SSUP' }], { green: 0, red: 3, blue: 0 })
    .ledgerEntries[0].lockedAmount, 9);

  for (const dice of [undefined, 0, 7, 1.5, Number.NaN]) {
    const state = createState();
    state.gameData.turnData.effectiveDiceRollByPlayerId.p1 = dice;
    delete state.gameData.turnData.effectiveDiceRoll;
    const before = structuredClone(state);
    assert.throws(() => resolve(
      state,
      [{ solarPowerId: 'SSTA' }],
      { green: 3, red: 0, blue: 0 },
    ), /effective dice/);
    assert.deepEqual(state, before);
  }
});

Deno.test('damage powers require exactly two current active player seats including one caster', () => {
  const malformedSeatSets = [
    [],
    [{ id: 'p1', role: 'player' }],
    [{ id: 'p2', role: 'player' }, { id: 'p3', role: 'player' }],
    [{ id: 'p1', role: 'player' }, { id: 'p1', role: 'player' }],
    [{ id: 'p1', role: 'player' }, { id: 'p2', role: 'player' }, { id: 'p3', role: 'player' }],
  ];
  for (const players of malformedSeatSets) {
    for (const solarPowerId of ['SAST', 'SSUP'] as const) {
      const state = createState();
      state.players = players;
      const before = structuredClone(state);
      assert.throws(() => resolve(
        state,
        [{ solarPowerId }],
        solarPowerId === 'SAST'
          ? { green: 0, red: 1, blue: 0 }
          : { green: 0, red: 3, blue: 0 },
      ), /exactly two active player seats/);
      assert.deepEqual(state, before);
    }
  }
});

Deno.test('healing powers do not require an opposing active player seat', () => {
  for (const solarPowerId of ['SLIF', 'SSTA'] as const) {
    const state = createState();
    state.players = [{ id: 'p1', role: 'player', health: 20, lines: 0, joiningLines: 0 }];
    const result = resolve(
      state,
      [{ solarPowerId }],
      solarPowerId === 'SLIF'
        ? { green: 1, red: 0, blue: 0 }
        : { green: 3, red: 0, blue: 0 },
    );
    assert.equal(result.state.gameData.pendingTurn.healByPlayerId.p1, solarPowerId === 'SLIF' ? 1 : 5);
  }
});

Deno.test('exact mono-colour exhaustion succeeds and insufficient payment leaves input state unchanged', () => {
  const exact = resolve(createState(), [{ solarPowerId: 'SLIF' }], { green: 1, red: 0, blue: 0 });
  assert.deepEqual(exact.remainingEnergy, { green: 0, red: 0, blue: 0 });

  const state = createState();
  const before = structuredClone(state);
  assert.throws(() => resolve(
    state,
    [{ solarPowerId: 'SSTA' }],
    { green: 2, red: 0, blue: 0 },
  ), /Insufficient green Energy/);
  assert.deepEqual(state, before);
});
