import assert from 'node:assert/strict';
import type { GameState, ShipInstance } from '../../../engine/state/GameStateTypes.ts';
import {
  getReservedFirstStrikeTargetInstanceIds,
  getReservedShipOfEqualityTargetInstanceIds,
  getValidDestroyTargets,
  getValidShipOfEqualityTargets,
  getValidTransferTargets,
  isCanonicalBasicOnlyTargetShip,
} from '../../../engine_shared/resolve/destroyRules.ts';
import { resolvePowerAction } from '../../../engine_shared/resolve/resolvePowerAction.ts';
import {
  replaceChargeDeclarationVisibilityState,
  requireChargeDeclarationLegalityState,
} from '../../../engine/state/chargeDeclarationVisibility.ts';

function ship(
  instanceId: string,
  shipDefId: string,
  overrides: Partial<ShipInstance> = {},
): ShipInstance {
  return { instanceId, shipDefId, ...overrides };
}

function createState(args: {
  ownFleet?: ShipInstance[];
  opponentFleet?: ShipInstance[];
} = {}): GameState {
  return {
    gameId: 'destroy-rules-test',
    status: 'active',
    players: [
      {
        id: 'p1',
        role: 'player',
        faction: 'ancient',
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: 'p2',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 2,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      ships: {
        p1: args.ownFleet ?? [],
        p2: args.opponentFleet ?? [],
      },
      phaseReadiness: [
        {
          playerId: 'p2',
          isReady: true,
          currentStep: 'battle.first_strike',
        },
      ],
      powerMemory: {
        onceOnlyFired: {
          'sentinel-source::sentinel-action': true,
        },
      },
      turnData: {
        turnNumber: 2,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        chargePowerUsedByInstanceId: {
          'sentinel-charge-source': 1,
        },
        pendingFirstStrikeSelectionsByPlayerId: {
          p2: {
            'sentinel-source': {
              sourceInstanceId: 'sentinel-source',
              actionId: 'sentinel-action',
              choiceId: 'sentinel-choice',
            },
          },
        },
        pendingEffects: [
          {
            id: 'sentinel-effect',
            kind: 'sentinel',
          },
        ],
      },
    },
    actions: [{ type: 'SENTINEL_ACTION' }],
  } as unknown as GameState;
}

function instanceIds(targets: Array<{ instanceId: string }>): string[] {
  return targets.map((target) => target.instanceId);
}

function markThirdSpiral(state: GameState, sourceInstanceId: string, turnNumber = 2): void {
  const turnData = state.gameData?.turnData ?? (state.gameData!.turnData = {});
  turnData.thirdSpiralFirstStrikeEligibilityByPlayerId = {
    p1: { sourceInstanceId, turnNumber },
  };
}

Deno.test('canonical basic-only classification includes evolved Basics without admitting Upgraded or Solar Powers', () => {
  for (const shipDefId of ['DEF', 'OXI', 'AST']) {
    assert.equal(isCanonicalBasicOnlyTargetShip(shipDefId), true, shipDefId);
  }
  for (const shipDefId of ['GUA', 'SLIF', 'SSIM']) {
    assert.equal(isCanonicalBasicOnlyTargetShip(shipDefId), false, shipDefId);
  }
});

Deno.test('generic destroy target derivation excludes protected Cores without changing ordinary targets', () => {
  const state = createState({
    ownFleet: [
      ship('own-plu', 'PLU'),
      ship('own-fig', 'FIG'),
      ship('own-mer', 'MER'),
      ship('own-nep', 'NEP'),
    ],
    opponentFleet: [
      ship('opponent-def', 'DEF'),
      ship('opponent-plu', 'PLU'),
      ship('opponent-gua', 'GUA'),
      ship('opponent-mer', 'MER'),
      ship('opponent-fig', 'FIG'),
      ship('opponent-nep', 'NEP'),
    ],
  });

  const opponentBasics = getValidDestroyTargets(state, {
    sourcePlayerId: 'p1',
    targetScope: 'opponent',
    restriction: 'basic_only',
  });
  assert.deepEqual(instanceIds(opponentBasics), ['opponent-def', 'opponent-fig']);
  assert.deepEqual(opponentBasics, [
    {
      instanceId: 'opponent-def',
      shipDefId: 'DEF',
      ownerPlayerId: 'p2',
      totalLineCost: 2,
    },
    {
      instanceId: 'opponent-fig',
      shipDefId: 'FIG',
      ownerPlayerId: 'p2',
      totalLineCost: 3,
    },
  ]);

  const ownBasics = getValidDestroyTargets(state, {
    sourcePlayerId: 'p1',
    targetScope: 'self',
    restriction: 'basic_only',
  });
  assert.deepEqual(instanceIds(ownBasics), ['own-fig']);

  const anyOpponentTargets = getValidDestroyTargets(state, {
    sourcePlayerId: 'p1',
    targetScope: 'opponent',
    restriction: 'any',
  });
  assert.deepEqual(instanceIds(anyOpponentTargets), [
    'opponent-def',
    'opponent-gua',
    'opponent-fig',
  ]);

  const upgradedOpponentTargets = getValidDestroyTargets(state, {
    sourcePlayerId: 'p1',
    targetScope: 'opponent',
    restriction: 'upgraded_only',
  });
  assert.deepEqual(instanceIds(upgradedOpponentTargets), ['opponent-gua']);
});

Deno.test('Ship of Equality removes protected Cores before shared-cost pairing', () => {
  const state = createState({
    ownFleet: [
      ship('own-plu', 'PLU'),
      ship('own-fig', 'FIG'),
      ship('own-mer', 'MER'),
      ship('own-int', 'INT'),
    ],
    opponentFleet: [
      ship('opponent-plu', 'PLU'),
      ship('opponent-fig', 'FIG'),
      ship('opponent-mer', 'MER'),
      ship('opponent-int', 'INT'),
    ],
  });

  const { validOwnTargets, validOpponentTargets } =
    getValidShipOfEqualityTargets(state, 'p1');

  assert.deepEqual(instanceIds(validOwnTargets), ['own-fig', 'own-int']);
  assert.deepEqual(instanceIds(validOpponentTargets), [
    'opponent-fig',
    'opponent-int',
  ]);
  assert.deepEqual(
    validOwnTargets.map((target) => target.totalLineCost),
    [3, 4],
  );
  assert.deepEqual(
    validOpponentTargets.map((target) => target.totalLineCost),
    [3, 4],
  );
});

Deno.test('Ship of Equality is not actionable when its only apparent cost match is a protected Core', () => {
  const coreOnOwnSide = getValidShipOfEqualityTargets(
    createState({
      ownFleet: [ship('own-plu', 'PLU')],
      opponentFleet: [ship('opponent-fig', 'FIG')],
    }),
    'p1',
  );
  assert.deepEqual(coreOnOwnSide, {
    validOwnTargets: [],
    validOpponentTargets: [],
  });

  const coreOnOpponentSide = getValidShipOfEqualityTargets(
    createState({
      ownFleet: [ship('own-int', 'INT')],
      opponentFleet: [ship('opponent-mer', 'MER')],
    }),
    'p1',
  );
  assert.deepEqual(coreOnOpponentSide, {
    validOwnTargets: [],
    validOpponentTargets: [],
  });
});

Deno.test('Ship of Equality target derivation retains declaration-entry fleets after canonical removal', () => {
  const state = createState({
    ownFleet: [ship('equ-source', 'EQU', { chargesCurrent: 1 }), ship('own-def', 'DEF')],
    opponentFleet: [ship('opponent-def', 'DEF')],
  });
  (state.gameData as any).currentSubPhase = 'charge_declaration';
  state.gameData!.turnData!.currentSubPhase = 'charge_declaration';
  state.gameData!.turnData!.chargeDeclarationFleetSnapshotByPlayerId = structuredClone(
    state.gameData!.ships,
  );
  replaceChargeDeclarationVisibilityState(state);

  state.gameData!.ships!.p2 = [];
  assert.deepEqual(getValidShipOfEqualityTargets(state, 'p1'), {
    validOwnTargets: [],
    validOpponentTargets: [],
  });

  const legalityState = requireChargeDeclarationLegalityState(state);
  const targets = getValidShipOfEqualityTargets(legalityState, 'p1');
  assert.deepEqual(instanceIds(targets.validOwnTargets), ['own-def']);
  assert.deepEqual(instanceIds(targets.validOpponentTargets), ['opponent-def']);
});

Deno.test('reservation derivation is deterministic, source-aware, and tolerant of malformed records', () => {
  const state: any = createState();
  state.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId.p1 = {
    'source-b': {
      actionId: 'GUA#0',
      choiceId: 'destroy',
      targetInstanceId: 'target-b',
      targetInstanceIds: ['target-c', 'target-b', null],
    },
    'source-a': {
      actionId: 'SAC#0',
      choiceId: 'destroy',
      targetInstanceId: 'target-a',
    },
    malformed: 'not-a-selection',
  };
  state.gameData.turnData.acceptedShipOfEqualityTargetsByPlayerId = {
    p1: {
      'equ-b': {
        ownTargetInstanceId: 'own-b',
        opponentTargetInstanceId: 'opponent-b',
      },
      'equ-a': {
        ownTargetInstanceId: 'own-a',
        opponentTargetInstanceId: 'opponent-a',
      },
      malformed: null,
    },
  };

  assert.deepEqual(
    getReservedFirstStrikeTargetInstanceIds(state, 'p1'),
    ['target-a', 'target-b', 'target-c'],
  );
  assert.deepEqual(
    getReservedFirstStrikeTargetInstanceIds(state, 'p1', 'source-b'),
    ['target-a'],
  );
  assert.deepEqual(
    getReservedShipOfEqualityTargetInstanceIds(structuredClone(state), 'p1'),
    ['opponent-a', 'opponent-b', 'own-a', 'own-b'],
  );
});

Deno.test('Ship of Equality filters reservations before recomputing shared costs and records only applied damage', () => {
  const state = createState({
    ownFleet: [
      ship('equ-a', 'EQU', { chargesCurrent: 1 }),
      ship('equ-b', 'EQU', { chargesCurrent: 1 }),
      ship('own-def', 'DEF'),
      ship('own-int', 'INT'),
    ],
    opponentFleet: [ship('opponent-def', 'DEF'), ship('opponent-int', 'INT')],
  });
  (state.gameData as any).currentSubPhase = 'charge_declaration';
  state.gameData!.turnData!.currentSubPhase = 'charge_declaration';
  state.gameData!.turnData!.chargeDeclarationEligibleSourceIdsByPlayerId = {
    p1: ['equ-a', 'equ-b'],
  };
  state.gameData!.turnData!.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: structuredClone(state.gameData!.ships!.p1),
    p2: structuredClone(state.gameData!.ships!.p2),
  };
  replaceChargeDeclarationVisibilityState(state);

  const dryRunBefore = structuredClone(state);
  resolvePowerAction({
    state,
    playerId: 'p1',
    phaseKey: 'battle.charge_declaration',
    actionId: 'EQU#0',
    sourceInstanceId: 'equ-a',
    choiceId: 'damage',
    targetInstanceIds: ['own-def', 'opponent-def'],
    apply: false,
  });
  assert.deepEqual(state, dryRunBefore);

  const applied = resolvePowerAction({
    state,
    playerId: 'p1',
    phaseKey: 'battle.charge_declaration',
    actionId: 'EQU#0',
    sourceInstanceId: 'equ-a',
    choiceId: 'damage',
    targetInstanceIds: ['own-def', 'opponent-def'],
  });
  assert.deepEqual(
    applied.state.gameData!.turnData!.acceptedShipOfEqualityTargetsByPlayerId?.p1?.['equ-a'],
    {
      ownTargetInstanceId: 'own-def',
      opponentTargetInstanceId: 'opponent-def',
    },
  );
  assert.deepEqual(getValidShipOfEqualityTargets(applied.state, 'p1'), {
    validOwnTargets: [
      { instanceId: 'own-int', shipDefId: 'INT', ownerPlayerId: 'p1', totalLineCost: 4 },
    ],
    validOpponentTargets: [
      { instanceId: 'opponent-int', shipDefId: 'INT', ownerPlayerId: 'p2', totalLineCost: 4 },
    ],
  });
  assert.throws(
    () => resolvePowerAction({
      state: applied.state,
      playerId: 'p1',
      phaseKey: 'battle.charge_declaration',
      actionId: 'EQU#0',
      sourceInstanceId: 'equ-b',
      choiceId: 'damage',
      targetInstanceIds: ['own-def', 'opponent-int'],
      apply: false,
    }),
    /already reserved by another EQU/,
  );
});

Deno.test('Guardian dry-run rejects a protected Core target without mutating state', () => {
  const state = createState({
    ownFleet: [ship('guardian-source', 'GUA', { chargesCurrent: 2 })],
    opponentFleet: [
      ship('protected-plu', 'PLU'),
      ship('ordinary-def', 'DEF'),
    ],
  });
  const before = structuredClone(state);

  assert.throws(
    () =>
      resolvePowerAction({
        state,
        playerId: 'p1',
        phaseKey: 'battle.first_strike',
        actionId: 'GUA#0',
        sourceInstanceId: 'guardian-source',
        choiceId: 'destroy',
        targetInstanceId: 'protected-plu',
        apply: false,
      }),
    /Target ship not valid: protected-plu/,
  );
  assert.deepEqual(state, before);
});

Deno.test('qualifying Spiral dry-run prepares one legal enemy-basic destroy effect', () => {
  const state = createState({
    ownFleet: [
      ship('spi-1', 'SPI', { createdTurn: 1 }),
      ship('spi-2', 'SPI', { createdTurn: 1 }),
      ship('spi-3', 'SPI', { createdTurn: 2 }),
    ],
    opponentFleet: [ship('ordinary-def', 'DEF')],
  });
  markThirdSpiral(state, 'spi-3');
  const before = structuredClone(state);

  const outcome = resolvePowerAction({
    state,
    playerId: 'p1',
    phaseKey: 'battle.first_strike',
    actionId: 'SPI#0',
    sourceInstanceId: 'spi-3',
    choiceId: 'destroy',
    targetInstanceId: 'ordinary-def',
    apply: false,
  });

  assert.equal(outcome.effects.length, 1);
  assert.deepEqual(outcome.onceOnlyFiredKeys, ['spi-3::SPI#0']);
  assert.deepEqual(state, before);
});

Deno.test('forged Spiral sources are rejected atomically before mutation', () => {
  const scenarios = [
    {
      name: 'first Spiral',
      sourceInstanceId: 'spi-1',
      configure: (_state: GameState) => {},
    },
    {
      name: 'second Spiral',
      sourceInstanceId: 'spi-2',
      configure: (_state: GameState) => {},
    },
    {
      name: 'unmarked third Spiral',
      sourceInstanceId: 'spi-3',
      configure: (state: GameState) => {
        delete state.gameData?.turnData?.thirdSpiralFirstStrikeEligibilityByPlayerId;
      },
    },
    {
      name: 'stolen Spiral',
      sourceInstanceId: 'spi-3',
      configure: (state: GameState) => {
        state.gameData!.turnData!.thirdSpiralFirstStrikeEligibilityByPlayerId = {
          p2: { sourceInstanceId: 'spi-3', turnNumber: 2 },
        };
      },
    },
    {
      name: 'prior-turn source',
      sourceInstanceId: 'spi-3',
      configure: (state: GameState) => markThirdSpiral(state, 'spi-3', 1),
    },
    {
      name: 'already-fired source',
      sourceInstanceId: 'spi-3',
      configure: (state: GameState) => {
        state.gameData!.powerMemory!.onceOnlyFired!['spi-3::SPI#0'] = true;
      },
    },
  ];

  for (const scenario of scenarios) {
    const state = createState({
      ownFleet: [
        ship('spi-1', 'SPI', { createdTurn: 2 }),
        ship('spi-2', 'SPI', { createdTurn: 2 }),
        ship('spi-3', 'SPI', { createdTurn: 2 }),
      ],
      opponentFleet: [ship('ordinary-def', 'DEF')],
    });
    markThirdSpiral(state, 'spi-3');
    scenario.configure(state);
    const before = structuredClone(state);
    assert.throws(
      () => resolvePowerAction({
        state,
        playerId: 'p1',
        phaseKey: 'battle.first_strike',
        actionId: 'SPI#0',
        sourceInstanceId: scenario.sourceInstanceId,
        choiceId: 'destroy',
        targetInstanceId: 'ordinary-def',
        apply: false,
      }),
      /qualifying third Spiral|already been used/,
      scenario.name,
    );
    assert.deepEqual(state, before, scenario.name);
  }
});

Deno.test('qualifying Spiral rejects protected and upgraded targets atomically', () => {
  for (const target of [ship('protected-core', 'PLU'), ship('upgraded-guardian', 'GUA')]) {
    const state = createState({
      ownFleet: [ship('spi-3', 'SPI', { createdTurn: 2 })],
      opponentFleet: [target, ship('ordinary-def', 'DEF')],
    });
    markThirdSpiral(state, 'spi-3');
    const before = structuredClone(state);
    assert.throws(
      () => resolvePowerAction({
        state,
        playerId: 'p1',
        phaseKey: 'battle.first_strike',
        actionId: 'SPI#0',
        sourceInstanceId: 'spi-3',
        choiceId: 'destroy',
        targetInstanceId: target.instanceId,
        apply: false,
      }),
      /Target ship not valid/,
    );
    assert.deepEqual(state, before);
  }
});

Deno.test('Ark of Domination dry-run rejects a protected Core in a valid two-target payload without mutating state', () => {
  const state = createState({
    ownFleet: [ship('domination-source', 'DOM', { createdTurn: 2 })],
    opponentFleet: [
      ship('ordinary-def', 'DEF'),
      ship('ordinary-fig', 'FIG'),
      ship('protected-mer', 'MER'),
    ],
  });
  const before = structuredClone(state);

  assert.throws(
    () =>
      resolvePowerAction({
        state,
        playerId: 'p1',
        phaseKey: 'battle.first_strike',
        actionId: 'DOM#0',
        sourceInstanceId: 'domination-source',
        choiceId: 'steal',
        targetInstanceIds: ['ordinary-def', 'protected-mer'],
        apply: false,
      }),
    /Target ship not valid: protected-mer/,
  );
  assert.deepEqual(state, before);
});

Deno.test('DOM transfer targets exclude Spirals only at destination capacity', () => {
  const opponentFleet = [
    ship('enemy-spi', 'SPI'),
    ship('enemy-vig', 'VIG'),
    ship('enemy-fig', 'FIG'),
  ];
  const withTwo = createState({
    ownFleet: [ship('spi-1', 'SPI'), ship('spi-2', 'SPI')],
    opponentFleet,
  });
  assert.deepEqual(
    instanceIds(getValidTransferTargets(withTwo, {
      sourcePlayerId: 'p1',
      targetScope: 'opponent',
      restriction: 'basic_only',
    })),
    ['enemy-spi', 'enemy-vig', 'enemy-fig'],
  );

  const withThree = createState({
    ownFleet: [ship('spi-1', 'SPI'), ship('spi-2', 'SPI'), ship('spi-3', 'SPI')],
    opponentFleet,
  });
  assert.deepEqual(
    instanceIds(getValidTransferTargets(withThree, {
      sourcePlayerId: 'p1',
      targetScope: 'opponent',
      restriction: 'basic_only',
    })),
    ['enemy-vig', 'enemy-fig'],
  );
});

Deno.test('DOM aggregate Spiral prevalidation accepts legal combinations and rejects over-cap atomically', () => {
  const resolveDom = (state: GameState, targetInstanceIds: string[]) =>
    resolvePowerAction({
      state,
      playerId: 'p1',
      phaseKey: 'battle.first_strike',
      actionId: 'DOM#0',
      sourceInstanceId: 'domination-source',
      choiceId: 'steal',
      targetInstanceIds,
      apply: false,
    });

  const twoOwned = createState({
    ownFleet: [
      ship('domination-source', 'DOM', { createdTurn: 2 }),
      ship('own-spi-1', 'SPI'),
      ship('own-spi-2', 'SPI'),
    ],
    opponentFleet: [
      ship('enemy-spi-1', 'SPI'),
      ship('enemy-spi-2', 'SPI'),
      ship('enemy-vig', 'VIG'),
    ],
  });
  const beforeTwoOwned = structuredClone(twoOwned);
  assert.throws(
    () => resolveDom(twoOwned, ['enemy-spi-1', 'enemy-spi-2']),
    /maximum of three controlled Spirals/,
  );
  assert.deepEqual(twoOwned, beforeTwoOwned);

  const mixed = resolveDom(twoOwned, ['enemy-spi-1', 'enemy-vig']);
  assert.equal(mixed.effects.length, 1);
  assert.deepEqual((mixed.effects[0] as any).target.shipInstanceIds, [
    'enemy-spi-1',
    'enemy-vig',
  ]);

  const oneOwned = createState({
    ownFleet: [
      ship('domination-source', 'DOM', { createdTurn: 2 }),
      ship('own-spi-1', 'SPI'),
    ],
    opponentFleet: [ship('enemy-spi-1', 'SPI'), ship('enemy-spi-2', 'SPI')],
  });
  assert.equal(resolveDom(oneOwned, ['enemy-spi-1', 'enemy-spi-2']).effects.length, 1);

  const threeOwned = createState({
    ownFleet: [
      ship('domination-source', 'DOM', { createdTurn: 2 }),
      ship('own-spi-1', 'SPI'),
      ship('own-spi-2', 'SPI'),
      ship('own-spi-3', 'SPI'),
    ],
    opponentFleet: [ship('enemy-spi-1', 'SPI'), ship('enemy-vig', 'VIG')],
  });
  const beforeThreeOwned = structuredClone(threeOwned);
  assert.throws(
    () => resolveDom(threeOwned, ['enemy-spi-1', 'enemy-vig']),
    /Expected exactly 1 target ship\(s\)/,
  );
  assert.deepEqual(threeOwned, beforeThreeOwned);
});
