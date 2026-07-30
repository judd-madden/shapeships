import assert from 'node:assert/strict';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
} from '../../../engine_shared/effects/Effect.ts';
import {
  resolveManualSolarDeclaration,
  resolveSolarCastSequence,
} from '../../../engine/ancient/manualSolarDeclaration.ts';
import {
  buildMonoColourAutocastCasts,
  MONO_COLOUR_SOLAR_COSTS,
  PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
  SIPHON_SOLAR_RESOLVER,
  VORTEX_SOLAR_RESOLVER,
} from '../../../engine/ancient/solarPowerResolvers.ts';

// Mono-colour resolver tests

function createMonoColourState(): any {
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

function resolveMonoColour(state: any, casts: any[], initialEnergy: any) {
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
  const state = createMonoColourState();
  const result = resolveMonoColour(state, [
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
      const state = createMonoColourState();
      const before = structuredClone(state);
      assert.throws(() => resolveMonoColour(
        state,
        [{ solarPowerId, ...field }],
        { green: cost.green, red: cost.red, blue: cost.blue },
      ), /does not accept/);
      assert.deepEqual(state, before);
    }
  }
});

Deno.test('dice-derived powers use per-player effective dice boundaries and reject invalid values atomically', () => {
  const lowState = createMonoColourState();
  lowState.gameData.turnData.effectiveDiceRollByPlayerId.p1 = 1;
  assert.equal(resolveMonoColour(lowState, [{ solarPowerId: 'SSTA' }], { green: 3, red: 0, blue: 0 })
    .ledgerEntries[0].lockedAmount, 4);

  const highState = createMonoColourState();
  highState.gameData.turnData.effectiveDiceRollByPlayerId.p1 = 6;
  assert.equal(resolveMonoColour(highState, [{ solarPowerId: 'SSUP' }], { green: 0, red: 3, blue: 0 })
    .ledgerEntries[0].lockedAmount, 9);

  for (const dice of [undefined, 0, 7, 1.5, Number.NaN]) {
    const state = createMonoColourState();
    state.gameData.turnData.effectiveDiceRollByPlayerId.p1 = dice;
    delete state.gameData.turnData.effectiveDiceRoll;
    const before = structuredClone(state);
    assert.throws(() => resolveMonoColour(
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
      const state = createMonoColourState();
      state.players = players;
      const before = structuredClone(state);
      assert.throws(() => resolveMonoColour(
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
    const state = createMonoColourState();
    state.players = [{ id: 'p1', role: 'player', health: 20, lines: 0, joiningLines: 0 }];
    const result = resolveMonoColour(
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
  const exact = resolveMonoColour(createMonoColourState(), [{ solarPowerId: 'SLIF' }], { green: 1, red: 0, blue: 0 });
  assert.deepEqual(exact.remainingEnergy, { green: 0, red: 0, blue: 0 });

  const state = createMonoColourState();
  const before = structuredClone(state);
  assert.throws(() => resolveMonoColour(
    state,
    [{ solarPowerId: 'SSTA' }],
    { green: 2, red: 0, blue: 0 },
  ), /Insufficient green Energy/);
  assert.deepEqual(state, before);
});

// Siphon resolver tests

function createSiphonState(): any {
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

function resolveSiphon(state: any, lockedAmount: number, energy: { green: number; red: number; blue: number }) {
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
    state: createSiphonState(),
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
    const result = resolveSiphon(
      createSiphonState(),
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
  const maximumSafe = resolveSiphon(
    createSiphonState(),
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
    const state = createSiphonState();
    const before = structuredClone(state);
    assert.throws(() => resolveSiphon(state, 4, energy), message);
    assert.deepEqual(state, before);
  }

  assert.throws(() => resolveSolarCastSequence({
    state: createSiphonState(),
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
    const state = createSiphonState();
    state.players = players;
    const before = structuredClone(state);
    assert.throws(() => resolveSiphon(state, 4, { green: 4, red: 4, blue: 0 }), /exactly two active player seats/);
    assert.deepEqual(state, before);
  }
});

// Vortex resolver tests

const EXACT_COST = { green: 2, red: 2, blue: 2 };

function ship(
  instanceId: string,
  shipDefId: string,
  overrides: Record<string, unknown> = {},
): any {
  return { instanceId, shipDefId, ...overrides };
}

function createVortexState(args: {
  liveFleet?: any[];
  snapshot?: unknown;
  includeSnapshotEntry?: boolean;
} = {}): any {
  const snapshotByPlayerId: Record<string, unknown> = {};
  if (args.includeSnapshotEntry !== false) {
    snapshotByPlayerId.p1 = args.snapshot ?? [];
  }
  return {
    players: [
      { id: 'p1', role: 'player', health: 20 },
      { id: 'p2', role: 'player', health: 20 },
      { id: 'spectator', role: 'spectator', health: 20 },
    ],
    gameData: {
      ships: { p1: args.liveFleet ?? [], p2: [] },
      turnData: {
        chargeDeclarationFleetSnapshotByPlayerId: snapshotByPlayerId,
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
    },
  };
}

function resolveVortex(state: any, energy = EXACT_COST, cast: any = { solarPowerId: 'SVOR' }) {
  return resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'vortex-test',
    battleTurnNumber: 3,
    initialEnergy: energy,
    casts: [cast],
    resolvers: { SVOR: VORTEX_SOLAR_RESOLVER },
  });
}

Deno.test('Vortex pays its exact cost and counts distinct snapshot shipDefIds only', () => {
  const scenarios = [
    {
      snapshot: [
        ship('fam-a', 'FAM', { chargesCurrent: 3, createdTurn: 1 }),
        ship('fam-b', 'FAM', {
          chargesCurrent: 0,
          createdTurn: 9,
          permanentConfiguration: { selectedNumber: 4 },
        }),
      ],
      expectedDamage: 2,
    },
    {
      snapshot: [
        ship('fam-a', 'FAM'),
        ship('fam-b', 'FAM', { chargesCurrent: 1 }),
        ship('sol-a', 'SOL', { createdTurn: 2 }),
        ship('int-a', 'INT', { permanentConfiguration: { selectedNumber: 6 } }),
      ],
      expectedDamage: 6,
    },
  ];

  for (const scenario of scenarios) {
    const state = createVortexState({
      snapshot: scenario.snapshot,
      liveFleet: [ship('live-only', 'DEF')],
    });
    const before = structuredClone(state);
    const result = resolveVortex(state);

    assert.deepEqual(state, before);
    assert.deepEqual(result.remainingEnergy, { green: 0, red: 0, blue: 0 });
    assert.deepEqual(result.acceptedCasts, [{ solarPowerId: 'SVOR' }]);
    assert.deepEqual(result.ledgerEntries[0], {
      entryId: 'ancient-solar:3:p1:vortex-test:manual:0',
      order: 0,
      solarPowerId: 'SVOR',
      sourceMode: 'manual',
      paidEnergy: EXACT_COST,
      lockedAmount: scenario.expectedDamage,
    });
    assert.deepEqual(result.effects, [{
      id: 'ancient-solar:3:p1:vortex-test:manual:0:damage',
      ownerPlayerId: 'p1',
      source: { type: 'system', reason: 'ancient-solar:SVOR' },
      timing: 'battle.end_of_turn_resolution',
      activationTag: EffectTiming.Charge,
      survivability: SurvivabilityRule.ResolvesIfDestroyed,
      target: { playerId: 'p2' },
      kind: EffectKind.Damage,
      amount: scenario.expectedDamage,
    }]);
    assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, {
      p2: scenario.expectedDamage,
    });
    assert.equal(result.state.players[0].health, 20);
    assert.equal(result.state.players[1].health, 20);
  }
});

Deno.test('Vortex treats an empty snapshot as authoritative and stages locked zero damage', () => {
  const state = createVortexState({
    snapshot: [],
    liveFleet: [ship('live-a', 'FAM'), ship('live-b', 'SOL'), ship('live-c', 'INT')],
  });
  const result = resolveVortex(state);

  assert.equal(result.ledgerEntries[0].lockedAmount, 0);
  assert.equal((result.effects[0] as any).amount, 0);
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 0 });
  assert.deepEqual(result.state.gameData.pendingTurn.breakdownEntries.map((entry: any) => ({
    sourceLabel: entry.sourceLabel,
    baseAmount: entry.baseAmount,
    finalAmount: entry.finalAmount,
  })), [{
    sourceLabel: 'ancient-solar:SVOR',
    baseAmount: 0,
    finalAmount: 0,
  }]);
  assert.equal(result.state.players[1].health, 20);
});

Deno.test('Vortex inherits FAM live-fleet fallback for missing and malformed snapshots', () => {
  const liveFleet = [
    ship('live-a', 'FAM'),
    ship('live-b', 'FAM', { chargesCurrent: 0 }),
    ship('live-c', 'SOL'),
    ship('live-d', 'INT'),
  ];
  const states = [
    createVortexState({ liveFleet, includeSnapshotEntry: false }),
    createVortexState({ liveFleet, snapshot: { malformed: true } }),
  ];

  for (const state of states) {
    const result = resolveVortex(state);
    assert.equal(result.ledgerEntries[0].lockedAmount, 6);
    assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 6 });
  }
});

Deno.test('Vortex retains the Charge Declaration snapshot after a live ship is removed', () => {
  const state = createVortexState({
    snapshot: [
      ship('family', 'FAM'),
      ship('solar', 'SOL'),
      ship('interceptor', 'INT'),
    ],
    liveFleet: [
      ship('family', 'FAM'),
      ship('solar', 'SOL'),
    ],
  });
  const result = resolveVortex(state);

  assert.equal(result.ledgerEntries[0].lockedAmount, 6);
  assert.notEqual(result.ledgerEntries[0].lockedAmount, 4);
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 6 });

  result.state.gameData.ships.p1 = [];
  assert.equal(result.ledgerEntries[0].lockedAmount, 6);
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 6 });
});

Deno.test('Vortex rejects authored fields, Autocast, unaffordability, and malformed seats atomically', () => {
  for (const field of [
    { targetInstanceId: 'target' },
    { targetInstanceIds: ['target'] },
    { lockedAmount: 6 },
  ]) {
    const state = createVortexState({ snapshot: [ship('family', 'FAM')] });
    const before = structuredClone(state);
    assert.throws(
      () => resolveVortex(state, EXACT_COST, { solarPowerId: 'SVOR', ...field }),
      /does not accept/,
    );
    assert.deepEqual(state, before);
  }

  assert.throws(() => resolveSolarCastSequence({
    state: createVortexState({ snapshot: [ship('family', 'FAM')] }),
    playerId: 'p1',
    declarationId: 'vortex-autocast',
    battleTurnNumber: 3,
    initialEnergy: EXACT_COST,
    casts: [{ solarPowerId: 'SVOR' }],
    resolvers: { SVOR: VORTEX_SOLAR_RESOLVER },
    sourceMode: 'autocast',
    initialLedgerOrder: 0,
  }), /manual Solar cast/);

  for (const [energy, message] of [
    [{ green: 1, red: 2, blue: 2 }, /green Energy/],
    [{ green: 2, red: 1, blue: 2 }, /red Energy/],
    [{ green: 2, red: 2, blue: 1 }, /blue Energy/],
  ] as const) {
    const state = createVortexState({ snapshot: [ship('family', 'FAM')] });
    const before = structuredClone(state);
    assert.throws(() => resolveVortex(state, energy), message);
    assert.deepEqual(state, before);
  }

  const malformedSeatSets = [
    [],
    [{ id: 'p1', role: 'player' }],
    [{ id: 'p2', role: 'player' }, { id: 'p3', role: 'player' }],
    [{ id: 'p1', role: 'player' }, { id: 'p1', role: 'player' }],
    [{ id: 'p1', role: 'player' }, { id: 'p2', role: 'player' }, { id: 'p3', role: 'player' }],
  ];
  for (const players of malformedSeatSets) {
    const state = createVortexState({ snapshot: [ship('family', 'FAM')] });
    state.players = players;
    const before = structuredClone(state);
    assert.throws(() => resolveVortex(state), /exactly two active player seats/);
    assert.deepEqual(state, before);
  }
});
