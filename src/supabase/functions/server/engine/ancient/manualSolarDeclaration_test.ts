import assert from 'node:assert/strict';
import {
  resolveManualSolarDeclaration,
  resolveSolarCastSequence,
  type ManualSolarResolverRegistry,
} from './manualSolarDeclaration.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';

function createState(): any {
  return {
    players: [
      { id: 'p1', health: 20 },
      { id: 'p2', health: 20 },
    ],
    gameData: {
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      durableSolarFixture: [],
    },
  };
}

function effect(id: string, kind: EffectKind.Damage | EffectKind.Heal, playerId: string): Effect {
  return {
    id,
    ownerPlayerId: 'p1',
    source: { type: 'system', reason: 'manual-solar-test' },
    timing: 'battle.charge_declaration',
    activationTag: EffectTiming.OnceOnly,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId },
    kind,
    amount: 2,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

Deno.test('manual Solar casts resolve sequentially with exact payment, pending effects, and ordered ledger entries', () => {
  const state = deepFreeze(createState());
  const resolvers: ManualSolarResolverRegistry = {
    SLIF: {
      acceptedFields: {},
      resolve(context) {
        const candidateState = structuredClone(context.state);
        candidateState.gameData.durableSolarFixture.push(context.castIndex);
        return {
          candidateState,
          paidEnergy: context.castIndex === 0
            ? { green: 1, red: 0, blue: 0 }
            : { green: 2, red: 0, blue: 0 },
          effects: [effect(
            `${context.castIdentity}:health`,
            context.castIndex === 0 ? EffectKind.Damage : EffectKind.Heal,
            context.castIndex === 0 ? 'p2' : 'p1',
          )],
          ...(context.castIndex === 0
            ? {
                ledgerMetadata: {
                  lockedAmount: 0,
                  targets: [{ playerId: 'p2', shipInstanceId: 'target-1' }],
                  simulacrum: {
                    sourceTargetInstanceId: 'target-1',
                    copiedShipDefId: 'CAR',
                    capturedStartOfBattleCharges: 0,
                    permanentConfiguration: {},
                    matchupKey: 'ancient-v-human',
                  },
                },
              }
            : {}),
        };
      },
    },
  };

  const result = resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 3, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SLIF' }],
    resolvers,
  });

  assert.deepEqual(result.remainingEnergy, { green: 0, red: 0, blue: 0 });
  assert.deepEqual(result.acceptedCasts, [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SLIF' }]);
  assert.deepEqual(result.state.gameData.durableSolarFixture, [0, 1]);
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 2 });
  assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: 2 });
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 20);
  assert.deepEqual(result.ledgerEntries.map((entry) => ({
    entryId: entry.entryId,
    order: entry.order,
    paidEnergy: entry.paidEnergy,
  })), [
    {
      entryId: 'ancient-solar:3:p1:declaration-1:manual:0',
      order: 0,
      paidEnergy: { green: 1, red: 0, blue: 0 },
    },
    {
      entryId: 'ancient-solar:3:p1:declaration-1:manual:1',
      order: 1,
      paidEnergy: { green: 2, red: 0, blue: 0 },
    },
  ]);
  assert.deepEqual(result.ledgerEntries[0], {
    entryId: 'ancient-solar:3:p1:declaration-1:manual:0',
    order: 0,
    solarPowerId: 'SLIF',
    sourceMode: 'manual',
    paidEnergy: { green: 1, red: 0, blue: 0 },
    lockedAmount: 0,
    targets: [{ playerId: 'p2', shipInstanceId: 'target-1' }],
    simulacrum: {
      sourceTargetInstanceId: 'target-1',
      copiedShipDefId: 'CAR',
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
      matchupKey: 'ancient-v-human',
    },
  });
});

Deno.test('manual Solar ledger metadata preserves valid exact Simulacrum configuration as fresh objects', () => {
  for (const [capturedStartOfBattleCharges, permanentConfiguration] of [
    [0, {}],
    [3, { selectedNumber: 1 }],
    [6, { selectedNumber: 6 }],
  ] as const) {
    const state = createState();
    const resolverConfiguration = permanentConfiguration;
    const result = resolveManualSolarDeclaration({
      state,
      playerId: 'p1',
      declarationId: `declaration-${capturedStartOfBattleCharges}-${JSON.stringify(permanentConfiguration)}`,
      battleTurnNumber: 3,
      initialEnergy: { green: 1, red: 0, blue: 0 },
      casts: [{ solarPowerId: 'SLIF' }],
      resolvers: {
        SLIF: {
          acceptedFields: {},
          resolve: (context) => ({
            candidateState: structuredClone(context.state),
            paidEnergy: { green: 1, red: 0, blue: 0 },
            effects: [],
            ledgerMetadata: {
              simulacrum: {
                sourceTargetInstanceId: 'target-1',
                copiedShipDefId: 'selectedNumber' in permanentConfiguration
                  ? 'QUA'
                  : 'CAR',
                capturedStartOfBattleCharges,
                permanentConfiguration: resolverConfiguration,
              },
            },
          }),
        },
      },
    });
    assert.deepEqual(result.ledgerEntries[0].simulacrum, {
      sourceTargetInstanceId: 'target-1',
      copiedShipDefId: 'selectedNumber' in permanentConfiguration
        ? 'QUA'
        : 'CAR',
      capturedStartOfBattleCharges,
      permanentConfiguration,
    });
    assert.notEqual(
      result.ledgerEntries[0].simulacrum?.permanentConfiguration,
      resolverConfiguration,
    );
  }
});

Deno.test('manual Solar resolvers reject unimplemented powers and structurally irrelevant fields', () => {
  const state = createState();
  assert.throws(() => resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 1, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SLIF' }],
    resolvers: {},
  }), /not implemented: SLIF/);

  assert.throws(() => resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 1, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SLIF', lockedAmount: 1 }],
    resolvers: {
      SLIF: {
        acceptedFields: {},
        resolve: () => ({ candidateState: state, paidEnergy: { green: 1, red: 0, blue: 0 }, effects: [] }),
      },
    },
  }), /does not accept lockedAmount/);
});

Deno.test('manual Solar payment validation rejects invalid components and colour-specific unaffordability before candidate adoption', () => {
  for (const paidEnergy of [
    { green: 0, red: 0, blue: 0 },
    { green: Number.NaN, red: 0, blue: 0 },
    { green: -1, red: 0, blue: 0 },
    { green: 0.5, red: 0, blue: 0 },
    { green: 0, red: 1, blue: 0 },
  ]) {
    const state = createState();
    const before = structuredClone(state);
    assert.throws(() => resolveManualSolarDeclaration({
      state,
      playerId: 'p1',
      declarationId: 'declaration-1',
      battleTurnNumber: 3,
      initialEnergy: { green: 1, red: 0, blue: 0 },
      casts: [{ solarPowerId: 'SLIF' }],
      resolvers: {
        SLIF: {
          acceptedFields: {},
          resolve(context) {
            const candidateState = structuredClone(context.state);
            candidateState.gameData.durableSolarFixture.push('must-not-commit');
            return { candidateState, paidEnergy, effects: [] };
          },
        },
      },
    }));
    assert.deepEqual(state, before);
  }
});

Deno.test('manual Solar ledger metadata is validated before candidate state adoption', () => {
  for (const ledgerMetadata of [
    { lockedAmount: Number.NaN },
    { lockedAmount: -1 },
    { lockedAmount: 1.5 },
    { targets: [] },
    { targets: [{ playerId: '' }] },
    { targets: [{ playerId: 'p2', shipInstanceId: '' }] },
    { targets: [{ playerId: 'p2', ignored: true }] },
    { simulacrum: { sourceTargetInstanceId: '', copiedShipDefId: 'CAR' } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: '' } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', matchupKey: '' } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', capturedStartOfBattleCharges: -1 } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', capturedStartOfBattleCharges: 1.5 } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', capturedStartOfBattleCharges: '1' } },
    {
      simulacrum: {
        sourceTargetInstanceId: 'target-1',
        copiedShipDefId: 'CAR',
        capturedStartOfBattleCharges: Number.NaN,
      },
    },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: null } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: [] } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: { selectedNumber: 0 } } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: { selectedNumber: 7 } } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: { selectedNumber: 1.5 } } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: { selectedNumber: '1' } } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', permanentConfiguration: { unsupported: true } } },
    { simulacrum: { sourceTargetInstanceId: 'target-1', copiedShipDefId: 'CAR', unsupported: true } },
    { unsupported: true },
  ]) {
    const state = createState();
    const before = structuredClone(state);
    assert.throws(() => resolveManualSolarDeclaration({
      state,
      playerId: 'p1',
      declarationId: 'declaration-1',
      battleTurnNumber: 3,
      initialEnergy: { green: 1, red: 0, blue: 0 },
      casts: [{ solarPowerId: 'SLIF' }],
      resolvers: {
        SLIF: {
          acceptedFields: {},
          resolve(context) {
            const candidateState = structuredClone(context.state);
            candidateState.gameData.durableSolarFixture.push('must-not-commit');
            return {
              candidateState,
              paidEnergy: { green: 1, red: 0, blue: 0 },
              effects: [],
              ledgerMetadata: ledgerMetadata as any,
            };
          },
        },
      },
    }));
    assert.deepEqual(state, before);
  }
});

Deno.test('manual Solar resolver mutation of supplied state is rejected', () => {
  const state = createState();
  const before = structuredClone(state);
  assert.throws(() => resolveManualSolarDeclaration({
    state,
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 1, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SLIF' }],
    resolvers: {
      SLIF: {
        acceptedFields: {},
        resolve(context) {
          (context.state as any).gameData.durableSolarFixture.push('mutated');
          return {
            candidateState: context.state,
            paidEnergy: { green: 1, red: 0, blue: 0 },
            effects: [],
          };
        },
      },
    },
  }), /mutated its supplied state/);
  assert.deepEqual(state, before);
});

Deno.test('generic Solar sequence supports deterministic Autocast identities and ledger offsets', () => {
  const resolvers: ManualSolarResolverRegistry = {
    SLIF: {
      acceptedFields: {},
      resolve(context) {
        assert.equal(context.sourceMode, 'autocast');
        assert.equal(context.ledgerOrder, 4 + context.castIndex);
        return {
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 1, red: 0, blue: 0 },
          effects: [],
        };
      },
    },
  };
  const result = resolveSolarCastSequence({
    state: createState(),
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 2, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SLIF' }],
    resolvers,
    sourceMode: 'autocast',
    initialLedgerOrder: 4,
  });

  assert.deepEqual(result.ledgerEntries.map((entry) => ({
    entryId: entry.entryId,
    order: entry.order,
    sourceMode: entry.sourceMode,
  })), [
    {
      entryId: 'ancient-solar:3:p1:declaration-1:autocast:0',
      order: 4,
      sourceMode: 'autocast',
    },
    {
      entryId: 'ancient-solar:3:p1:declaration-1:autocast:1',
      order: 5,
      sourceMode: 'autocast',
    },
  ]);
});

Deno.test('generic Solar sequence separates source identity indexes from contiguous ledger indexes', () => {
  const result = resolveSolarCastSequence({
    state: createState(),
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 2, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SLIF' }],
    resolvers: {
      SLIF: {
        acceptedFields: {},
        resolve(context) {
          assert.equal(context.ledgerOrder, 7 + (context.castIndex - 1));
          return {
            candidateState: structuredClone(context.state),
            paidEnergy: { green: 1, red: 0, blue: 0 },
            effects: [],
          };
        },
      },
    },
    sourceMode: 'autocast',
    initialLedgerOrder: 7,
    initialCastIndex: 1,
  });
  assert.deepEqual(result.ledgerEntries.map((entry) => ({
    entryId: entry.entryId,
    order: entry.order,
  })), [
    { entryId: 'ancient-solar:3:p1:declaration-1:autocast:1', order: 7 },
    { entryId: 'ancient-solar:3:p1:declaration-1:autocast:2', order: 8 },
  ]);
});

Deno.test('Cube Solar resolution validates canonical cost but preserves Energy and records zero payment', () => {
  const result = resolveSolarCastSequence({
    state: createState(),
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 0, red: 0, blue: 0 },
    casts: [{ solarPowerId: 'SSTA' }],
    resolvers: {
      SSTA: {
        acceptedFields: {},
        resolve(context) {
          assert.equal(context.sourceMode, 'cube');
          return {
            candidateState: structuredClone(context.state),
            paidEnergy: { green: 3, red: 0, blue: 0 },
            effects: [],
            ledgerMetadata: { lockedAmount: 7 },
          };
        },
      },
    },
    sourceMode: 'cube',
    initialLedgerOrder: 2,
  });
  assert.deepEqual(result.remainingEnergy, { green: 0, red: 0, blue: 0 });
  assert.deepEqual(result.ledgerEntries[0], {
    entryId: 'ancient-solar:3:p1:declaration-1:cube:0',
    order: 2,
    solarPowerId: 'SSTA',
    sourceMode: 'cube',
    paidEnergy: { green: 0, red: 0, blue: 0 },
    lockedAmount: 7,
  });
});
