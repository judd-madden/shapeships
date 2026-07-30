import assert from 'node:assert/strict';
import { EffectKind, EffectTiming, SurvivabilityRule } from '../../engine_shared/effects/Effect.ts';
import {
  resolveManualSolarDeclaration,
  resolveSolarCastSequence,
} from './manualSolarDeclaration.ts';
import { VORTEX_SOLAR_RESOLVER } from './solarPowerResolvers.ts';

const EXACT_COST = { green: 2, red: 2, blue: 2 };

function ship(
  instanceId: string,
  shipDefId: string,
  overrides: Record<string, unknown> = {},
): any {
  return { instanceId, shipDefId, ...overrides };
}

function createState(args: {
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

function resolve(state: any, energy = EXACT_COST, cast: any = { solarPowerId: 'SVOR' }) {
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
    const state = createState({
      snapshot: scenario.snapshot,
      liveFleet: [ship('live-only', 'DEF')],
    });
    const before = structuredClone(state);
    const result = resolve(state);

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
  const state = createState({
    snapshot: [],
    liveFleet: [ship('live-a', 'FAM'), ship('live-b', 'SOL'), ship('live-c', 'INT')],
  });
  const result = resolve(state);

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
    createState({ liveFleet, includeSnapshotEntry: false }),
    createState({ liveFleet, snapshot: { malformed: true } }),
  ];

  for (const state of states) {
    const result = resolve(state);
    assert.equal(result.ledgerEntries[0].lockedAmount, 6);
    assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 6 });
  }
});

Deno.test('Vortex retains the Charge Declaration snapshot after a live ship is removed', () => {
  const state = createState({
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
  const result = resolve(state);

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
    const state = createState({ snapshot: [ship('family', 'FAM')] });
    const before = structuredClone(state);
    assert.throws(
      () => resolve(state, EXACT_COST, { solarPowerId: 'SVOR', ...field }),
      /does not accept/,
    );
    assert.deepEqual(state, before);
  }

  assert.throws(() => resolveSolarCastSequence({
    state: createState({ snapshot: [ship('family', 'FAM')] }),
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
    const state = createState({ snapshot: [ship('family', 'FAM')] });
    const before = structuredClone(state);
    assert.throws(() => resolve(state, energy), message);
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
    const state = createState({ snapshot: [ship('family', 'FAM')] });
    state.players = players;
    const before = structuredClone(state);
    assert.throws(() => resolve(state), /exactly two active player seats/);
    assert.deepEqual(state, before);
  }
});
