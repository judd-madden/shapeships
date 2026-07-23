import assert from 'node:assert/strict';
import { resolvePhase } from '../../engine_shared/resolve/resolvePhase.ts';
import {
  resolveSolarCastSequence,
  type ManualSolarResolverRegistry,
} from './manualSolarDeclaration.ts';
import {
  BLACK_HOLE_SOLAR_RESOLVER,
  resolveCommittedBlackHoleDestructions,
} from './blackHoleSolarPower.ts';

const BLACK_HOLE_REGISTRY: ManualSolarResolverRegistry = {
  SBLA: BLACK_HOLE_SOLAR_RESOLVER,
};

function ship(instanceId: string, shipDefId: string, extra: Record<string, unknown> = {}) {
  return { instanceId, shipDefId, ...extra };
}

function createState(args: {
  p1Ships?: any[];
  p2Ships?: any[];
  p1Void?: any[];
  p2Void?: any[];
  p1Health?: number;
  p2Health?: number;
} = {}): any {
  return {
    gameId: 'black-hole-solar-test',
    status: 'active',
    players: [
      {
        id: 'p1',
        role: 'player',
        faction: 'ancient',
        health: args.p1Health ?? 20,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: 'p2',
        role: 'player',
        faction: 'human',
        health: args.p2Health ?? 20,
        lines: 0,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'end_of_turn_resolution',
      ships: {
        p1: args.p1Ships ?? [],
        p2: args.p2Ships ?? [],
      },
      voidShipsByPlayerId: {
        p1: args.p1Void ?? [],
        p2: args.p2Void ?? [],
      },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'end_of_turn_resolution',
        effectiveDiceRollByPlayerId: { p1: 2, p2: 4 },
      },
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: {},
      },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
}

function resolveBlackHole(args: {
  state: any;
  targetInstanceIds?: string[];
  energy?: { green: number; red: number; blue: number };
  casts?: Array<{ solarPowerId: 'SBLA'; targetInstanceIds?: string[] }>;
  sourceMode?: 'manual' | 'autocast';
}) {
  return resolveSolarCastSequence({
    state: args.state,
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: args.energy ?? { green: 12, red: 12, blue: 12 },
    casts: args.casts ?? [{
      solarPowerId: 'SBLA',
      ...(typeof args.targetInstanceIds === 'undefined'
        ? {}
        : { targetInstanceIds: args.targetInstanceIds }),
    }],
    resolvers: BLACK_HOLE_REGISTRY,
    sourceMode: args.sourceMode ?? 'manual',
    initialLedgerOrder: 0,
  });
}

function pendingRecord(args: {
  id: string;
  ownerPlayerId: string;
  targetPlayerId: string;
  targets: string[];
  battleTurnNumber?: number;
  status?: 'committed' | 'resolved';
}) {
  return {
    pendingDestructionId: args.id,
    declarationId: `${args.id}:declaration`,
    ownerPlayerId: args.ownerPlayerId,
    targetPlayerId: args.targetPlayerId,
    targetInstanceIds: args.targets,
    battleTurnNumber: args.battleTurnNumber ?? 3,
    lockedDamage: 1,
    status: args.status ?? 'committed',
  };
}

Deno.test('Black Hole enforces exact canonical target counts and preserves rejected inputs', () => {
  const scenarios = [
    {
      name: 'zero legal targets accepts omission',
      opponentShips: [
        ship('plu-protected', 'PLU'),
        ship('mer-protected', 'MER'),
        ship('nep-protected', 'NEP'),
        ship('frigate-upgraded', 'FRI'),
      ],
      targets: undefined,
      expectedTargets: [],
    },
    {
      name: 'zero legal targets accepts an empty normalized list',
      opponentShips: [ship('plu-protected', 'PLU')],
      targets: [],
      expectedTargets: [],
    },
    {
      name: 'one legal target requires one',
      opponentShips: [ship('int-one', 'INT'), ship('plu-protected', 'PLU')],
      targets: ['int-one'],
      expectedTargets: ['int-one'],
    },
    {
      name: 'more than two legal targets requires exactly two',
      opponentShips: [
        ship('sta-three', 'STA'),
        ship('fam-two', 'FAM'),
        ship('int-one', 'INT'),
      ],
      targets: ['sta-three', 'int-one'],
      expectedTargets: ['int-one', 'sta-three'],
    },
  ];

  for (const scenario of scenarios) {
    const state = createState({ p2Ships: scenario.opponentShips });
    const before = structuredClone(state);
    const result = resolveBlackHole({
      state,
      targetInstanceIds: scenario.targets,
    });
    assert.deepEqual(state, before, scenario.name);
    assert.deepEqual(
      result.state.gameData.ancient.pendingBlackHoleDestructions[0]
        .targetInstanceIds,
      scenario.expectedTargets,
      scenario.name,
    );
    assert.deepEqual(
      result.ledgerEntries[0].targets?.map((target) => target.shipInstanceId) ??
        [],
      scenario.expectedTargets,
      scenario.name,
    );
    assert.deepEqual(result.remainingEnergy, { green: 8, red: 8, blue: 8 });
    assert.deepEqual(result.state.gameData.ships.p2, scenario.opponentShips);
  }

  const invalidCases = [
    {
      state: createState({ p2Ships: [ship('int-one', 'INT')] }),
      cast: { solarPowerId: 'SBLA', targetInstanceIds: [] },
      pattern: /requires exactly 1/,
    },
    {
      state: createState({
        p2Ships: [
          ship('int-one', 'INT'),
          ship('fam-two', 'FAM'),
          ship('sta-three', 'STA'),
        ],
      }),
      cast: {
        solarPowerId: 'SBLA',
        targetInstanceIds: ['int-one', 'fam-two', 'sta-three'],
      },
      pattern: /requires exactly 2/,
    },
    {
      state: createState({
        p1Ships: [ship('own-int', 'INT')],
        p2Ships: [ship('enemy-int', 'INT')],
      }),
      cast: { solarPowerId: 'SBLA', targetInstanceIds: ['own-int'] },
      pattern: /Illegal Black Hole target/,
    },
    {
      state: createState({ p2Ships: [ship('enemy-int', 'INT')] }),
      cast: { solarPowerId: 'SBLA', targetInstanceIds: ['forged'] },
      pattern: /Illegal Black Hole target/,
    },
    {
      state: createState({
        p2Ships: [ship('enemy-int', 'INT'), ship('enemy-fam', 'FAM')],
      }),
      cast: {
        solarPowerId: 'SBLA',
        targetInstanceIds: ['enemy-int', 'enemy-int'],
      },
      pattern: /must be distinct/,
    },
  ];

  for (const invalidCase of invalidCases) {
    const before = structuredClone(invalidCase.state);
    assert.throws(() =>
      resolveBlackHole({
        state: invalidCase.state,
        casts: [invalidCase.cast as any],
      }), invalidCase.pattern);
    assert.deepEqual(invalidCase.state, before);
  }
});

Deno.test('Black Hole rejects unsupported fields, Autocast, and each insufficient Energy colour immutably', () => {
  const state = createState({ p2Ships: [] });
  for (const cast of [
    { solarPowerId: 'SBLA', targetInstanceId: 'singular' },
    { solarPowerId: 'SBLA', lockedAmount: 4 },
  ]) {
    const before = structuredClone(state);
    assert.throws(() =>
      resolveSolarCastSequence({
        state,
        playerId: 'p1',
        declarationId: 'declaration-1',
        battleTurnNumber: 3,
        initialEnergy: { green: 12, red: 12, blue: 12 },
        casts: [cast as any],
        resolvers: BLACK_HOLE_REGISTRY,
        sourceMode: 'manual',
        initialLedgerOrder: 0,
      }), /does not accept/);
    assert.deepEqual(state, before);
  }

  const beforeAutocast = structuredClone(state);
  assert.throws(() =>
    resolveBlackHole({ state, sourceMode: 'autocast' }), /manual Solar cast/);
  assert.deepEqual(state, beforeAutocast);

  for (const [colour, energy] of [
    ['green', { green: 3, red: 4, blue: 4 }],
    ['red', { green: 4, red: 3, blue: 4 }],
    ['blue', { green: 4, red: 4, blue: 3 }],
  ] as const) {
    const before = structuredClone(state);
    assert.throws(() =>
      resolveBlackHole({ state, energy }),
      new RegExp(`Insufficient ${colour} Energy`));
    assert.deepEqual(state, before);
  }
});

Deno.test('Black Hole locks live current-controller Core instances and zero damage without snapshot or VOID leakage', () => {
  const state = createState({
    p1Ships: [
      ship('plu-a', 'PLU'),
      ship('plu-b', 'PLU'),
      ship('mer-acquired', 'MER'),
      ship('nep-a', 'NEP'),
      ship('qua', 'QUA'),
      ship('sol', 'SOL'),
      ship('cub', 'CUB'),
      ship('unrelated', 'INT'),
    ],
    p1Void: [ship('plu-void', 'PLU')],
  });
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: [ship('plu-snapshot-only', 'PLU')],
  };
  const result = resolveBlackHole({ state });

  assert.equal(result.ledgerEntries[0].lockedAmount, 4);
  assert.equal(
    result.state.gameData.ancient.pendingBlackHoleDestructions[0].lockedDamage,
    4,
  );
  assert.equal(result.state.gameData.pendingTurn.damageByPlayerId.p2, 4);
  assert.equal(result.state.players[1].health, 20);

  result.state.gameData.ships.p1 = [];
  assert.equal(result.ledgerEntries[0].lockedAmount, 4);
  assert.equal(
    result.state.gameData.ancient.pendingBlackHoleDestructions[0].lockedDamage,
    4,
  );
  assert.equal(result.state.gameData.pendingTurn.damageByPlayerId.p2, 4);

  const zero = resolveBlackHole({ state: createState() });
  assert.equal(zero.ledgerEntries[0].lockedAmount, 0);
  assert.equal(
    zero.state.gameData.ancient.pendingBlackHoleDestructions[0].lockedDamage,
    0,
  );
  assert.equal(zero.state.gameData.pendingTurn.damageByPlayerId.p2, 0);
  assert.equal('targets' in zero.ledgerEntries[0], false);
});

Deno.test('multiple ordered Black Hole casts create separate commitments without changing fleets', () => {
  const state = createState({
    p1Ships: [ship('plu', 'PLU')],
    p2Ships: [ship('enemy-a', 'INT'), ship('enemy-b', 'FAM')],
  });
  const beforeFleet = structuredClone(state.gameData.ships);
  const result = resolveBlackHole({
    state,
    casts: [
      { solarPowerId: 'SBLA', targetInstanceIds: ['enemy-a', 'enemy-b'] },
      { solarPowerId: 'SBLA', targetInstanceIds: ['enemy-b', 'enemy-a'] },
    ],
  });

  assert.deepEqual(result.state.gameData.ships, beforeFleet);
  assert.deepEqual(
    result.state.gameData.ancient.pendingBlackHoleDestructions.map(
      (record: any) => record.pendingDestructionId,
    ),
    [
      'ancient-solar:3:p1:declaration-1:manual:0:black-hole-destruction',
      'ancient-solar:3:p1:declaration-1:manual:1:black-hole-destruction',
    ],
  );
  assert.deepEqual(
    result.ledgerEntries.map((entry) => [entry.order, entry.lockedAmount]),
    [[0, 1], [1, 1]],
  );
  assert.equal(result.state.gameData.pendingTurn.damageByPlayerId.p2, 2);
  assert.deepEqual(result.remainingEnergy, { green: 4, red: 4, blue: 4 });
});

Deno.test('delayed Black Hole resolution is immutable, fully ordered, missing-safe, and idempotent', () => {
  const state = createState({
    p1Ships: [ship('p1-target', 'INT')],
    p2Ships: [
      ship('target-z', 'INT'),
      ship('target-a', 'FAM'),
      ship('target-b', 'STA'),
    ],
  });
  state.gameData.ancient.pendingBlackHoleDestructions = [
    pendingRecord({
      id: 'record-z',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targets: ['target-z', 'target-a'],
    }),
    pendingRecord({
      id: 'record-a',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targets: ['target-missing', 'target-b'],
    }),
    pendingRecord({
      id: 'old-record',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targets: ['target-z'],
      battleTurnNumber: 2,
    }),
    pendingRecord({
      id: 'resolved-record',
      ownerPlayerId: 'p2',
      targetPlayerId: 'p1',
      targets: ['p1-target'],
      status: 'resolved',
    }),
  ];
  const before = structuredClone(state);
  const inputAncient = state.gameData.ancient;
  const inputPending = state.gameData.ancient.pendingBlackHoleDestructions;
  const inputFirstRecord = inputPending[0];

  const result = resolveCommittedBlackHoleDestructions(state, 3);
  const resolvedState: any = result.state;

  assert.deepEqual(state, before);
  assert.notStrictEqual(resolvedState.gameData.ancient, inputAncient);
  assert.notStrictEqual(
    resolvedState.gameData.ancient.pendingBlackHoleDestructions,
    inputPending,
  );
  assert.notStrictEqual(
    resolvedState.gameData.ancient.pendingBlackHoleDestructions[0],
    inputFirstRecord,
  );
  assert.deepEqual(
    result.events.map((event) => event.effectId),
    [
      'record-a:destroy:target-b',
      'record-z:destroy:target-a',
      'record-z:destroy:target-z',
    ],
  );
  assert.deepEqual(
    resolvedState.gameData.ancient.pendingBlackHoleDestructions.map(
      (record: any) => [record.pendingDestructionId, record.status],
    ),
    [
      ['record-z', 'resolved'],
      ['record-a', 'resolved'],
      ['old-record', 'committed'],
      ['resolved-record', 'resolved'],
    ],
  );
  assert.deepEqual(
    resolvedState.gameData.voidShipsByPlayerId.p2.map(
      (candidate: any) => candidate.instanceId,
    ),
    ['target-b', 'target-a', 'target-z'],
  );
  assert.deepEqual(
    resolvedState.gameData.ships.p2.map((candidate: any) => candidate.instanceId),
    [],
  );

  const repeated = resolveCommittedBlackHoleDestructions(resolvedState, 3);
  assert.strictEqual(repeated.state, resolvedState);
  assert.deepEqual(repeated.events, []);
  assert.deepEqual(
    repeated.state.gameData.voidShipsByPlayerId,
    resolvedState.gameData.voidShipsByPlayerId,
  );
});

Deno.test('standard Destroy semantics preserve Zenith spawning and Spiral health clamping', () => {
  const state = createState({
    p2Ships: [ship('zenith', 'ZEN'), ship('spiral', 'SPI')],
    p2Health: 40,
  });
  state.gameData.ancient.pendingBlackHoleDestructions = [
    pendingRecord({
      id: 'destroy-shared-semantics',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targets: ['spiral', 'zenith'],
    }),
  ];

  const result = resolveCommittedBlackHoleDestructions(state, 3);
  const resolvedState: any = result.state;
  assert.deepEqual(
    resolvedState.gameData.voidShipsByPlayerId.p2.map(
      (candidate: any) => candidate.instanceId,
    ),
    ['spiral', 'zenith'],
  );
  assert.deepEqual(
    resolvedState.gameData.ships.p2.map((candidate: any) => candidate.shipDefId),
    ['XEN', 'XEN'],
  );
  assert.equal(resolvedState.players[1].health, 35);
});

Deno.test('pre-Automatic Black Hole resolution is simultaneous and preserves once-only and staged Charge effects', () => {
  const state = createState({
    p1Ships: [
      ship('solar-grid', 'SOL', { chargesCurrent: 0 }),
      ship('starship', 'STA', { createdTurn: 3 }),
    ],
    p2Ships: [ship('enemy-int', 'INT')],
  });
  state.gameData.pendingTurn.damageByPlayerId.p2 = 3;
  state.gameData.ancient.pendingBlackHoleDestructions = [
    pendingRecord({
      id: 'p2-commitment',
      ownerPlayerId: 'p2',
      targetPlayerId: 'p1',
      targets: ['solar-grid', 'starship'],
    }),
    pendingRecord({
      id: 'p1-commitment',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targets: ['enemy-int'],
    }),
  ];

  const result = resolvePhase(state, 'battle.end_of_turn_resolution');
  const resolvedState: any = result.state;

  assert.deepEqual(resolvedState.gameData.ships.p1, []);
  assert.deepEqual(resolvedState.gameData.ships.p2, []);
  assert.deepEqual(
    resolvedState.gameData.voidShipsByPlayerId.p1.map(
      (candidate: any) => candidate.instanceId,
    ),
    ['solar-grid', 'starship'],
  );
  assert.deepEqual(
    resolvedState.gameData.voidShipsByPlayerId.p2.map(
      (candidate: any) => candidate.instanceId,
    ),
    ['enemy-int'],
  );
  assert.equal(resolvedState.players[0].health, 20);
  assert.equal(resolvedState.players[1].health, 9);
  assert.equal(
    result.events.some((event: any) =>
      event.effectId === 'solar_grid_3_solar-grid'
    ),
    false,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.effectId === 'starship_3_starship'
    ),
    true,
  );
  assert.equal(
    resolvedState.gameData.powerMemory.onceOnlyFired['starship::STA#0'],
    true,
  );
  assert.equal(
    resolvedState.gameData.ancient.pendingBlackHoleDestructions.every(
      (record: any) => record.status === 'resolved',
    ),
    true,
  );
});
