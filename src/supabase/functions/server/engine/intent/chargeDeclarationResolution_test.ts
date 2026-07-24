import assert from 'node:assert/strict';
import {
  fingerprintChargeDeclaration,
  normalizeChargeDeclarationPayload,
  resolveChargeDeclarationSubmission,
  resolveChargeDeclarationSubmissionWithDependencies,
} from './chargeDeclarationResolution.ts';
import type { ManualSolarResolverRegistry } from '../ancient/manualSolarDeclaration.ts';
import { advancePhaseCore } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import { resolveBuildSubmitAuthoritatively } from './buildSubmitResolution.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1,
    declarationId: 'declaration-1',
    ordinaryChargeActions: [],
    solarGridChoices: [],
    solarCasts: [],
    autocastEnabled: false,
    ...overrides,
  };
}

function createState(): any {
  return {
    gameId: 'charge-declaration-resolution-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 20, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 20, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [],
      ships: {
        p1: [
          { instanceId: 'int-1', shipDefId: 'INT', chargesCurrent: 2 },
          { instanceId: 'int-2', shipDefId: 'INT', chargesCurrent: 2 },
          { instanceId: 'sol-a', shipDefId: 'SOL', chargesCurrent: 4 },
          { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 1 },
        ],
        p2: [],
      },
      voidShipsByPlayerId: { p1: [], p2: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleByPlayerId: { p1: true, p2: false },
        chargeDeclarationEligibleSourceIdsByPlayerId: { p1: ['int-1', 'int-2'], p2: [] },
        solarGridDeclarationSourceIdsByPlayerId: { p1: ['sol-a', 'sol-b'], p2: [] },
        chargeDeclarationFleetSnapshotByPlayerId: {
          p1: [
            { instanceId: 'int-1', shipDefId: 'INT', chargesCurrent: 2 },
            { instanceId: 'int-2', shipDefId: 'INT', chargesCurrent: 2 },
            { instanceId: 'sol-a', shipDefId: 'SOL', chargesCurrent: 4 },
            { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 1 },
          ],
          p2: [],
        },
        chargePowerUsedByInstanceId: {},
        anyChargesSpentInDeclaration: false,
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {
          p1: {
            battleTurnNumber: 3,
            pool: { green: 1, red: 0, blue: 0 },
            sources: [{
              sourceId: 'initial-core',
              sourceInstanceId: 'core-1',
              sourceShipDefId: 'PLU',
              battleTurnNumber: 3,
              order: 0,
              amounts: { green: 1, red: 0, blue: 0 },
            }],
          },
          p2: { battleTurnNumber: 3, pool: { green: 0, red: 0, blue: 0 }, sources: [] },
        },
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {
          p1: { battleTurnNumber: null, entries: [] },
          p2: { battleTurnNumber: null, entries: [] },
        },
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
}

function solarHealthEffect(
  id: string,
  kind: EffectKind.Damage | EffectKind.Heal,
  targetPlayerId: string,
): Effect {
  return {
    id,
    ownerPlayerId: 'p1',
    source: { type: 'ship', instanceId: 'solar-fixture-source', shipDefId: 'SLIF' },
    timing: 'battle.charge_declaration',
    activationTag: EffectTiming.OnceOnly,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId: targetPlayerId },
    kind,
    amount: 2,
  };
}

Deno.test('charge declaration payload normalization is versioned, explicit, and deterministically fingerprinted', () => {
  const first = normalizeChargeDeclarationPayload(payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      { sourceInstanceId: 'sol-a', choiceId: 'use' },
    ],
    solarCasts: [
      { solarPowerId: 'SLIF' },
      { solarPowerId: 'SAST', targetInstanceIds: ['target-b', 'target-a'] },
      { solarPowerId: 'SLIF' },
    ],
  }));
  const second = normalizeChargeDeclarationPayload(payload({
    declarationId: 'different-id',
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'use' },
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
    ],
    solarCasts: [
      { solarPowerId: 'SLIF' },
      { solarPowerId: 'SAST', targetInstanceIds: ['target-a', 'target-b'] },
      { solarPowerId: 'SLIF' },
    ],
  }));
  assert.equal(fingerprintChargeDeclaration(first), fingerprintChargeDeclaration(second));
  assert.deepEqual(first.solarCasts, [
    { solarPowerId: 'SLIF' },
    { solarPowerId: 'SAST', targetInstanceIds: ['target-a', 'target-b'] },
    { solarPowerId: 'SLIF' },
  ]);
  const reversed = normalizeChargeDeclarationPayload(payload({
    solarCasts: [{ solarPowerId: 'SAST' }, { solarPowerId: 'SLIF' }],
  }));
  assert.notEqual(
    fingerprintChargeDeclaration(reversed),
    fingerprintChargeDeclaration(normalizeChargeDeclarationPayload(payload({
      solarCasts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SAST' }],
    }))),
  );
  const autocastOn = normalizeChargeDeclarationPayload(payload({ autocastEnabled: true }));
  assert.equal(autocastOn.autocastEnabled, true);
  assert.notEqual(
    fingerprintChargeDeclaration(autocastOn),
    fingerprintChargeDeclaration(normalizeChargeDeclarationPayload(payload({ autocastEnabled: false }))),
  );
  assert.deepEqual(
    normalizeChargeDeclarationPayload(payload({
      solarCasts: ['SLIF', 'SSTA', 'SAST', 'SSUP', 'SCON', 'SSIM', 'SSIP', 'SVOR', 'SBLA']
        .map((solarPowerId) => ({ solarPowerId })),
    })).solarCasts.map((cast) => cast.solarPowerId),
    ['SLIF', 'SSTA', 'SAST', 'SSUP', 'SCON', 'SSIM', 'SSIP', 'SVOR', 'SBLA'],
  );
  for (const invalid of [
    payload({ contractVersion: 2 }),
    payload({ declarationId: '' }),
    payload({ solarCasts: [{ solarPowerId: 'UNKNOWN' }] }),
    payload({ solarCasts: [{ solarPowerId: 'SLIF', order: 0 }] }),
    payload({ solarCasts: [{ solarPowerId: 'SLIF', targetInstanceId: 'one', targetInstanceIds: ['two'] }] }),
    payload({ solarCasts: [{ solarPowerId: 'SLIF', targetInstanceIds: ['same', 'same'] }] }),
    payload({ solarCasts: [{ solarPowerId: 'SLIF', lockedAmount: 1.5 }] }),
    payload({ autocastEnabled: 'true' }),
  ]) {
    assert.throws(() => normalizeChargeDeclarationPayload(invalid));
  }
});

Deno.test('ordinary charge list rejects duplicate source entries before transactional application', () => {
  assert.throws(() => normalizeChargeDeclarationPayload(payload({
    ordinaryChargeActions: [
      { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'hold' },
      { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage' },
    ],
  })), /Duplicate ordinary charge source/);
});

Deno.test('mixed ordinary charge and independent SOL Use/Hold choices commit deterministically', () => {
  const state = createState();
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage',
      }],
      solarGridChoices: [
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
        { sourceInstanceId: 'sol-a', choiceId: 'use' },
      ],
    }),
    nowMs: 1000,
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'int-1').chargesCurrent, 1);
  assert.equal(result.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-a').chargesCurrent, 3);
  assert.equal(result.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-b').chargesCurrent, 1);
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 2, red: 1, blue: 1 });
  assert.deepEqual(
    result.state.gameData.ancient.energyByPlayerId.p1.sources.map((source: any) => source.sourceId),
    ['initial-core', 'ancient-solar-grid-energy:3:p1:sol-a'],
  );
  assert.equal(result.state.gameData.turnData.anyChargesSpentInDeclaration, true);
  assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.context, {
    contextVersion: 1,
    battleTurnNumber: 3,
    initialEnergy: { green: 1, red: 0, blue: 0 },
    energySourceIds: ['initial-core'],
  });
  assert.deepEqual(result.state.gameData.ancient.solarLedgerByPlayerId.p1, {
    battleTurnNumber: 3,
    entries: [],
  });
  assert.equal(state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'int-1').chargesCurrent, 2);
  assert.equal(state.gameData.ancient.acceptedDeclarationByPlayerId.p1, undefined);
});

Deno.test('fixture manual Solar resolvers commit ordered payments, pending effects, accepted casts, and ledger atomically', () => {
  const state = createState();
  const resolvers: ManualSolarResolverRegistry = {
    SLIF: {
      acceptedFields: {},
      resolve(context) {
        const candidateState = structuredClone(context.state);
        candidateState.gameData.solarFixture = [...(candidateState.gameData.solarFixture ?? []), context.castIndex];
        return {
          candidateState,
          paidEnergy: context.castIndex === 0
            ? { green: 1, red: 0, blue: 0 }
            : { green: 0, red: 0, blue: 1 },
          effects: [solarHealthEffect(
            `${context.castIdentity}:health`,
            context.castIndex === 0 ? EffectKind.Damage : EffectKind.Heal,
            context.castIndex === 0 ? 'p2' : 'p1',
          )],
        };
      },
    },
  };
  const declaration = payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'use' },
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
    ],
    solarCasts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SLIF' }],
  });
  const result = resolveChargeDeclarationSubmissionWithDependencies({
    state,
    playerId: 'p1',
    payload: declaration,
    nowMs: 1000,
  }, { manualSolarResolvers: resolvers });

  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 1, red: 1, blue: 0 });
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.sources.map((source: any) => source.sourceId), [
    'initial-core',
    'ancient-solar-grid-energy:3:p1:sol-a',
  ]);
  assert.deepEqual(result.state.gameData.solarFixture, [0, 1]);
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 2 });
  assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: 2 });
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 20);
  assert.equal(result.events.some((event: any) => event.type === 'EFFECT_APPLIED'), false);
  assert.equal(
    (result.state.gameData.turnData.shipActivationCueBatches ?? [])
      .flatMap((batch: any) => batch.sources ?? [])
      .some((source: any) => source.sourceInstanceId === 'solar-fixture-source'),
    false,
  );
  assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts, [
    { solarPowerId: 'SLIF' },
    { solarPowerId: 'SLIF' },
  ]);
  assert.deepEqual(result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries.map((entry: any) => ({
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
      paidEnergy: { green: 0, red: 0, blue: 1 },
    },
  ]);

  result.state.gameData.currentSubPhase = 'charge_response';
  const retry = resolveChargeDeclarationSubmissionWithDependencies({
    state: result.state,
    playerId: 'p1',
    payload: declaration,
    nowMs: 1001,
  }, { manualSolarResolvers: resolvers });
  assert.equal(retry.status, 'idempotent');
  assert.deepEqual(retry.events, []);
  assert.deepEqual(retry.state.gameData.pendingTurn.damageByPlayerId, { p2: 2 });
  assert.equal(retry.state.gameData.ancient.solarLedgerByPlayerId.p1.entries.length, 2);
});

Deno.test('production Simulacrum commits ordered queue records, exact blue payments, and public ledger metadata atomically', () => {
  const state = createState();
  state.gameData.ships.p2 = [
    { instanceId: 'enemy-car', shipDefId: 'CAR', chargesCurrent: 5 },
    { instanceId: 'enemy-def', shipDefId: 'DEF' },
  ];
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p2 = [
    { instanceId: 'enemy-car', shipDefId: 'CAR', chargesCurrent: 3 },
    { instanceId: 'enemy-def', shipDefId: 'DEF' },
  ];
  state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId.p1 = [];
  state.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId.p1 = [];
  state.gameData.ancient.energyByPlayerId.p1.pool = {
    green: 0,
    red: 0,
    blue: 8,
  };

  const declaration = payload({
    solarCasts: [
      { solarPowerId: 'SSIM', targetInstanceId: 'enemy-car' },
      { solarPowerId: 'SSIM', targetInstanceId: 'enemy-def' },
    ],
  });
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: declaration,
    nowMs: 1000,
  });

  assert.equal(result.status, 'applied');
  assert.deepEqual(
    result.state.gameData.ancient.pendingSimulacrumCopies.map((record: any) => ({
      copiedShipDefId: record.copiedShipDefId,
      queueOrder: record.queueOrder,
      capturedStartOfBattleCharges: record.capturedStartOfBattleCharges,
      permanentConfiguration: record.permanentConfiguration,
      status: record.status,
    })),
    [
      {
        copiedShipDefId: 'CAR',
        queueOrder: 0,
        capturedStartOfBattleCharges: 3,
        permanentConfiguration: {},
        status: 'queued',
      },
      {
        copiedShipDefId: 'DEF',
        queueOrder: 1,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
        status: 'queued',
      },
    ],
  );
  assert.deepEqual(
    result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries.map((entry: any) => ({
      solarPowerId: entry.solarPowerId,
      paidEnergy: entry.paidEnergy,
      target: entry.targets?.[0],
      simulacrum: entry.simulacrum,
    })),
    [
      {
        solarPowerId: 'SSIM',
        paidEnergy: { green: 0, red: 0, blue: 6 },
        target: { playerId: 'p2', shipInstanceId: 'enemy-car' },
        simulacrum: {
          sourceTargetInstanceId: 'enemy-car',
          copiedShipDefId: 'CAR',
          capturedStartOfBattleCharges: 3,
          permanentConfiguration: {},
        },
      },
      {
        solarPowerId: 'SSIM',
        paidEnergy: { green: 0, red: 0, blue: 2 },
        target: { playerId: 'p2', shipInstanceId: 'enemy-def' },
        simulacrum: {
          sourceTargetInstanceId: 'enemy-def',
          copiedShipDefId: 'DEF',
          capturedStartOfBattleCharges: 0,
          permanentConfiguration: {},
        },
      },
    ],
  );
  assert.deepEqual(
    result.state.gameData.ancient.energyByPlayerId.p1.pool,
    { green: 0, red: 0, blue: 0 },
  );

  const exactPending = structuredClone(
    result.state.gameData.ancient.pendingSimulacrumCopies,
  );
  const exactLedger = structuredClone(
    result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries,
  );
  const retry = resolveChargeDeclarationSubmission({
    state: result.state,
    playerId: 'p1',
    payload: declaration,
    nowMs: 1001,
  });
  assert.equal(retry.status, 'idempotent');
  assert.deepEqual(
    retry.state.gameData.ancient.pendingSimulacrumCopies,
    exactPending,
  );
  assert.deepEqual(
    retry.state.gameData.ancient.solarLedgerByPlayerId.p1.entries,
    exactLedger,
  );
});

Deno.test('production Simulacrum rolls back its complete declaration for a duplicate or unaffordable later cast', () => {
  for (const scenario of [
    {
      casts: [
        { solarPowerId: 'SSIM', targetInstanceId: 'enemy-def' },
        { solarPowerId: 'SSIM', targetInstanceId: 'enemy-def' },
      ],
      blue: 10,
      error: /primary target already selected/,
    },
    {
      casts: [
        { solarPowerId: 'SSIM', targetInstanceId: 'enemy-def' },
        { solarPowerId: 'SSIM', targetInstanceId: 'enemy-fig' },
      ],
      blue: 2,
      error: /Insufficient blue Energy/,
    },
  ]) {
    const state = createState();
    state.gameData.ships.p2 = [
      { instanceId: 'enemy-def', shipDefId: 'DEF' },
      { instanceId: 'enemy-fig', shipDefId: 'FIG' },
    ];
    state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p2 =
      structuredClone(state.gameData.ships.p2);
    state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId.p1 = [];
    state.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId.p1 = [];
    state.gameData.ancient.energyByPlayerId.p1.pool = {
      green: 0,
      red: 0,
      blue: scenario.blue,
    };
    const before = structuredClone(state);

    assert.throws(() =>
      resolveChargeDeclarationSubmission({
        state,
        playerId: 'p1',
        payload: payload({ solarCasts: scenario.casts }),
        nowMs: 1000,
      }), scenario.error);
    assert.deepEqual(state, before);
  }
});

Deno.test('later unaffordable fixture cast rolls back ordinary charge, Grid, Energy, effects, ledger, and acceptance', () => {
  const state = createState();
  const before = structuredClone(state);
  const resolvers: ManualSolarResolverRegistry = {
    SLIF: {
      acceptedFields: {},
      resolve(context) {
        const candidateState = structuredClone(context.state);
        candidateState.gameData.solarFixture = ['earlier-cast'];
        return {
          candidateState,
          paidEnergy: { green: 1, red: 0, blue: 0 },
          effects: [solarHealthEffect(`${context.castIdentity}:damage`, EffectKind.Damage, 'p2')],
        };
      },
    },
    SAST: {
      acceptedFields: {},
      resolve(context) {
        return {
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 0, red: 2, blue: 0 },
          effects: [],
        };
      },
    },
  };

  assert.throws(() => resolveChargeDeclarationSubmissionWithDependencies({
    state,
    playerId: 'p1',
    payload: payload({
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage',
      }],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'use' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SAST' }],
    }),
    nowMs: 1000,
  }, { manualSolarResolvers: resolvers }), /Insufficient red Energy/);
  assert.deepEqual(state, before);
});

Deno.test('production Simulacrum rejects a missing target without changing state', () => {
  const state = createState();
  const before = structuredClone(state);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{ solarPowerId: 'SSIM' }],
    }),
    nowMs: 1000,
  }), /requires targetInstanceId/);
  assert.deepEqual(state, before);
});

Deno.test('production Black Hole commits normalized targets and locked damage without changing either fleet', () => {
  const state = createState();
  state.gameData.ships.p1.push(
    { instanceId: 'plu-live', shipDefId: 'PLU' },
    { instanceId: 'mer-live', shipDefId: 'MER' },
  );
  state.gameData.ships.p2.push(
    { instanceId: 'enemy-sta', shipDefId: 'STA' },
    { instanceId: 'enemy-int', shipDefId: 'INT' },
    { instanceId: 'enemy-fam', shipDefId: 'FAM' },
  );
  state.gameData.ancient.energyByPlayerId.p1.pool = {
    green: 4,
    red: 4,
    blue: 4,
  };
  const before = structuredClone(state);
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{
        solarPowerId: 'SBLA',
        targetInstanceIds: ['enemy-sta', 'enemy-int'],
      }],
    }),
    nowMs: 1000,
  });

  assert.deepEqual(state, before);
  assert.deepEqual(result.state.gameData.ships, before.gameData.ships);
  assert.deepEqual(
    result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts,
    [{
      solarPowerId: 'SBLA',
      targetInstanceIds: ['enemy-int', 'enemy-sta'],
    }],
  );
  assert.deepEqual(
    result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries,
    [{
      entryId: 'ancient-solar:3:p1:declaration-1:manual:0',
      order: 0,
      solarPowerId: 'SBLA',
      sourceMode: 'manual',
      paidEnergy: { green: 4, red: 4, blue: 4 },
      lockedAmount: 2,
      targets: [
        { playerId: 'p2', shipInstanceId: 'enemy-int' },
        { playerId: 'p2', shipInstanceId: 'enemy-sta' },
      ],
    }],
  );
  assert.deepEqual(
    result.state.gameData.ancient.pendingBlackHoleDestructions,
    [{
      pendingDestructionId:
        'ancient-solar:3:p1:declaration-1:manual:0:black-hole-destruction',
      declarationId: 'declaration-1',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targetInstanceIds: ['enemy-int', 'enemy-sta'],
      battleTurnNumber: 3,
      lockedDamage: 2,
      status: 'committed',
    }],
  );
  assert.deepEqual(
    result.state.gameData.ancient.energyByPlayerId.p1.pool,
    { green: 0, red: 0, blue: 0 },
  );
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 2 });
  assert.equal(result.state.players[1].health, 20);
});

Deno.test('production FAM and Vortex share Charge Declaration snapshot TYPE semantics', () => {
  const state = createState();
  state.gameData.ships.p1.push({
    instanceId: 'fam-live',
    shipDefId: 'FAM',
    chargesCurrent: 2,
  });
  state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId.p1.push('fam-live');
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p1 = [
    {
      instanceId: 'fam-live',
      shipDefId: 'FAM',
      chargesCurrent: 2,
      createdTurn: 1,
    },
    {
      instanceId: 'fam-repeat',
      shipDefId: 'FAM',
      chargesCurrent: 0,
      createdTurn: 9,
      permanentConfiguration: { selectedNumber: 4 },
    },
    {
      instanceId: 'sol-a',
      shipDefId: 'SOL',
      chargesCurrent: 4,
    },
    {
      instanceId: 'sol-b',
      shipDefId: 'SOL',
      chargesCurrent: 1,
      createdTurn: 7,
    },
    {
      instanceId: 'int-removed-during-declaration',
      shipDefId: 'INT',
      chargesCurrent: 1,
      permanentConfiguration: { selectedNumber: 6 },
    },
  ];
  state.gameData.ships.p1 = state.gameData.ships.p1.filter(
    (candidate: any) => candidate.shipDefId !== 'INT',
  );
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 2, red: 2, blue: 2 };

  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      ordinaryChargeActions: [{
        actionType: 'power',
        actionId: 'FAM#0',
        sourceInstanceId: 'fam-live',
        choiceId: 'damage',
      }],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{ solarPowerId: 'SVOR' }],
    }),
    nowMs: 1000,
  });

  assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts, [
    { solarPowerId: 'SVOR' },
  ]);
  assert.deepEqual(result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries, [{
    entryId: 'ancient-solar:3:p1:declaration-1:manual:0',
    order: 0,
    solarPowerId: 'SVOR',
    sourceMode: 'manual',
    paidEnergy: { green: 2, red: 2, blue: 2 },
    lockedAmount: 6,
  }]);
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, {
    green: 0,
    red: 0,
    blue: 0,
  });
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 9 });
  assert.deepEqual(result.state.gameData.pendingTurn.breakdownEntries.map((entry: any) => ({
    sourceLabel: entry.sourceLabel,
    sourceShipDefId: entry.sourceShipDefId,
    baseAmount: entry.baseAmount,
    finalAmount: entry.finalAmount,
  })), [
    {
      sourceLabel: undefined,
      sourceShipDefId: 'FAM',
      baseAmount: 3,
      finalAmount: 3,
    },
    {
      sourceLabel: 'ancient-solar:SVOR',
      sourceShipDefId: undefined,
      baseAmount: 6,
      finalAmount: 6,
    },
  ]);
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 20);

  result.state.gameData.ships.p1 = [];
  assert.equal(
    result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries[0].lockedAmount,
    6,
  );
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 9 });
});

Deno.test('Vortex participates in ordered payments and a later unaffordable cast rolls back Black Hole', () => {
  const orderedState = createState();
  orderedState.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 3, blue: 2 };
  const ordered = resolveChargeDeclarationSubmission({
    state: orderedState,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [
        { solarPowerId: 'SLIF' },
        { solarPowerId: 'SVOR' },
        { solarPowerId: 'SAST' },
      ],
    }),
    nowMs: 1000,
  });
  assert.deepEqual(
    ordered.state.gameData.ancient.solarLedgerByPlayerId.p1.entries.map((entry: any) => ({
      solarPowerId: entry.solarPowerId,
      order: entry.order,
      paidEnergy: entry.paidEnergy,
    })),
    [
      { solarPowerId: 'SLIF', order: 0, paidEnergy: { green: 1, red: 0, blue: 0 } },
      { solarPowerId: 'SVOR', order: 1, paidEnergy: { green: 2, red: 2, blue: 2 } },
      { solarPowerId: 'SAST', order: 2, paidEnergy: { green: 0, red: 1, blue: 0 } },
    ],
  );
  assert.deepEqual(ordered.state.gameData.ancient.energyByPlayerId.p1.pool, {
    green: 0,
    red: 0,
    blue: 0,
  });

  const rollbackState = createState();
  rollbackState.gameData.ships.p1.push({
    instanceId: 'plu-live',
    shipDefId: 'PLU',
  });
  rollbackState.gameData.ancient.energyByPlayerId.p1.pool = {
    green: 4,
    red: 4,
    blue: 4,
  };
  const before = structuredClone(rollbackState);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: rollbackState,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [
        { solarPowerId: 'SBLA' },
        { solarPowerId: 'SVOR' },
      ],
    }),
    nowMs: 1000,
  }), /Insufficient green Energy for SVOR/);
  assert.deepEqual(rollbackState, before);
});

Deno.test('production Siphon locks selected spend separately from triangular ledger and pending values', () => {
  const state = createState();
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 3, blue: 0 };
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{ solarPowerId: 'SSIP', lockedAmount: 3 }],
    }),
    nowMs: 1000,
  });

  assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts, [
    { solarPowerId: 'SSIP', lockedAmount: 3 },
  ]);
  assert.deepEqual(result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries, [{
    entryId: 'ancient-solar:3:p1:declaration-1:manual:0',
    order: 0,
    solarPowerId: 'SSIP',
    sourceMode: 'manual',
    paidEnergy: { green: 3, red: 3, blue: 0 },
    lockedAmount: 6,
  }]);
  assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: 6 });
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 6 });
  assert.deepEqual(result.state.gameData.pendingTurn.breakdownEntries.map((entry: any) => ({
    effectId: entry.effectId,
    kind: entry.kind,
    baseAmount: entry.baseAmount,
    finalAmount: entry.finalAmount,
  })), [
    {
      effectId: 'ancient-solar:3:p1:declaration-1:manual:0:heal',
      kind: 'Heal',
      baseAmount: 6,
      finalAmount: 6,
    },
    {
      effectId: 'ancient-solar:3:p1:declaration-1:manual:0:damage',
      kind: 'Damage',
      baseAmount: 6,
      finalAmount: 6,
    },
  ]);
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 20);
});

Deno.test('multiple Siphons resolve sequentially when each remains affordable', () => {
  const state = createState();
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 5, red: 5, blue: 0 };
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [
        { solarPowerId: 'SSIP', lockedAmount: 2 },
        { solarPowerId: 'SSIP', lockedAmount: 3 },
      ],
    }),
    nowMs: 1000,
  });

  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 0, red: 0, blue: 0 });
  assert.deepEqual(result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries.map((entry: any) => ({
    paidEnergy: entry.paidEnergy,
    lockedAmount: entry.lockedAmount,
  })), [
    { paidEnergy: { green: 2, red: 2, blue: 0 }, lockedAmount: 3 },
    { paidEnergy: { green: 3, red: 3, blue: 0 }, lockedAmount: 6 },
  ]);
  assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: 9 });
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 9 });
});

Deno.test('earlier manual casts and Siphon payments constrain later casts in order', () => {
  const lifeThenSiphon = createState();
  lifeThenSiphon.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 3, blue: 0 };
  const beforeLifeThenSiphon = structuredClone(lifeThenSiphon);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: lifeThenSiphon,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [
        { solarPowerId: 'SLIF' },
        { solarPowerId: 'SSIP', lockedAmount: 3 },
      ],
    }),
    nowMs: 1000,
  }), /Insufficient green Energy for SSIP/);
  assert.deepEqual(lifeThenSiphon, beforeLifeThenSiphon);

  const siphonThenStarBirth = createState();
  siphonThenStarBirth.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 2 };
  siphonThenStarBirth.gameData.ancient.energyByPlayerId.p1.pool = { green: 4, red: 2, blue: 0 };
  const beforeSiphonThenStarBirth = structuredClone(siphonThenStarBirth);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: siphonThenStarBirth,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [
        { solarPowerId: 'SSIP', lockedAmount: 2 },
        { solarPowerId: 'SSTA' },
      ],
    }),
    nowMs: 1000,
  }), /Insufficient green Energy for SSTA/);
  assert.deepEqual(siphonThenStarBirth, beforeSiphonThenStarBirth);
});

Deno.test('manual Siphon reduces the pool consumed by fixed mono-colour Autocast', () => {
  const state = createState();
  state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 2 };
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 5, red: 5, blue: 0 };
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{ solarPowerId: 'SSIP', lockedAmount: 2 }],
      autocastEnabled: true,
    }),
    nowMs: 1000,
  });

  const entries = result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries;
  assert.deepEqual(entries.map((entry: any) => [entry.solarPowerId, entry.sourceMode]), [
    ['SSIP', 'manual'],
    ['SSTA', 'autocast'],
    ['SSUP', 'autocast'],
  ]);
  assert.equal(entries.some((entry: any) => entry.solarPowerId === 'SSIP' && entry.sourceMode === 'autocast'), false);
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 0, red: 0, blue: 0 });
});

Deno.test('a later invalid Siphon rejects the entire production declaration atomically', () => {
  const state = createState();
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 3, blue: 0 };
  const before = structuredClone(state);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage',
      }],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'use' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [
        { solarPowerId: 'SSIP', lockedAmount: 2 },
        { solarPowerId: 'SSIP', lockedAmount: 3 },
      ],
    }),
    nowMs: 1000,
  }), /Insufficient green Energy for SSIP/);
  assert.deepEqual(state, before);
});

Deno.test('invalid later ordinary action and invalid SOL coverage leave the entire input state unchanged', () => {
  for (const invalidPayload of [
    payload({
      ordinaryChargeActions: [
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage' },
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-2', choiceId: 'forged' },
      ],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
    payload({
      ordinaryChargeActions: [
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage' },
      ],
      solarGridChoices: [{ sourceInstanceId: 'sol-a', choiceId: 'use' }],
    }),
    payload({
      ordinaryChargeActions: [
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'forged', choiceId: 'damage' },
      ],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
  ]) {
    const state = createState();
    const before = structuredClone(state);
    assert.throws(() => resolveChargeDeclarationSubmission({
      state, playerId: 'p1', payload: invalidPayload, nowMs: 1000,
    }));
    assert.deepEqual(state, before);
  }
});

Deno.test('snapshotted SOL moved to VOID can use its charge and identical accepted retry is eventless', () => {
  const state = createState();
  const moved = state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-b');
  state.gameData.ships.p1 = state.gameData.ships.p1.filter((ship: any) => ship.instanceId !== 'sol-b');
  state.gameData.voidShipsByPlayerId.p1.push(moved);
  const declaration = payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'hold' },
      { sourceInstanceId: 'sol-b', choiceId: 'use' },
    ],
  });
  const applied = resolveChargeDeclarationSubmission({ state, playerId: 'p1', payload: declaration, nowMs: 1000 });
  assert.equal(applied.state.gameData.voidShipsByPlayerId.p1[0].chargesCurrent, 0);
  applied.state.gameData.currentSubPhase = 'charge_response';
  const retry = resolveChargeDeclarationSubmission({
    state: applied.state, playerId: 'p1', payload: declaration, nowMs: 1001,
  });
  assert.equal(retry.status, 'idempotent');
  assert.deepEqual(retry.events, []);
  assert.equal(retry.state.gameData.voidShipsByPlayerId.p1[0].chargesCurrent, 0);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: applied.state,
    playerId: 'p1',
    payload: payload({ declarationId: 'new-id', solarGridChoices: declaration.solarGridChoices }),
    nowMs: 1002,
  }), /different charge declaration/);
});

Deno.test('non-Ancient and forged or depleted SOL submissions are rejected', () => {
  const nonAncient = createState();
  nonAncient.players[0].faction = 'human';
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: nonAncient,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
    nowMs: 1000,
  }), /Only Ancient players/);

  const depleted = createState();
  depleted.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId.p1 = ['sol-b'];
  depleted.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p1 = [
    { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 0 },
  ];
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: depleted,
    playerId: 'p1',
    payload: payload({ solarGridChoices: [{ sourceInstanceId: 'sol-b', choiceId: 'use' }] }),
    nowMs: 1000,
  }), /Invalid snapshotted Solar Grid/);
});

Deno.test('a previous Battle accepted record does not block a new declaration', () => {
  const firstState = createState();
  const firstPayload = payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'hold' },
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
    ],
  });
  const first = resolveChargeDeclarationSubmission({
    state: firstState, playerId: 'p1', payload: firstPayload, nowMs: 1000,
  });
  const nextBattle = first.state;
  nextBattle.gameData.turnNumber = 4;
  nextBattle.gameData.turnData.turnNumber = 4;
  nextBattle.gameData.currentSubPhase = 'charge_declaration';
  nextBattle.gameData.turnData.currentSubPhase = 'charge_declaration';
  nextBattle.gameData.ancient.energyByPlayerId.p1.battleTurnNumber = 4;
  const second = resolveChargeDeclarationSubmission({
    state: nextBattle,
    playerId: 'p1',
    payload: payload({
      declarationId: 'battle-4-declaration',
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
    nowMs: 2000,
  });
  assert.equal(second.status, 'applied');
  assert.equal(second.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.declarationId, 'battle-4-declaration');
  assert.equal(second.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.context.battleTurnNumber, 4);
});

Deno.test('production Autocast follows the exact fixed category order and exhausts mono-colour Energy', () => {
  const scenarios = [
    {
      energy: { green: 0, red: 10, blue: 0 },
      expected: ['SSUP', 'SSUP', 'SSUP', 'SAST'],
    },
    {
      energy: { green: 8, red: 0, blue: 0 },
      expected: ['SSTA', 'SSTA', 'SLIF', 'SLIF'],
    },
    {
      energy: { green: 0, red: 0, blue: 4 },
      expected: ['SCON', 'SCON', 'SCON', 'SCON'],
    },
    {
      energy: { green: 4, red: 4, blue: 2 },
      expected: ['SSTA', 'SSUP', 'SCON', 'SCON', 'SLIF', 'SAST'],
    },
  ];

  for (const scenario of scenarios) {
    const state = createState();
    state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 3, p2: 5 };
    state.gameData.ancient.energyByPlayerId.p1.pool = scenario.energy;
    const result = resolveChargeDeclarationSubmission({
      state,
      playerId: 'p1',
      payload: payload({
        solarGridChoices: [
          { sourceInstanceId: 'sol-a', choiceId: 'hold' },
          { sourceInstanceId: 'sol-b', choiceId: 'hold' },
        ],
        autocastEnabled: true,
      }),
      nowMs: 1000,
    });
    const entries = result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries;
    assert.deepEqual(entries.map((entry: any) => entry.solarPowerId), scenario.expected);
    assert.deepEqual(entries.map((entry: any) => entry.order), scenario.expected.map((_, index) => index));
    assert.equal(entries.every((entry: any) => entry.sourceMode === 'autocast'), true);
    assert.equal(entries.some((entry: any) => entry.solarPowerId === 'SVOR'), false);
    assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, {
      green: 0,
      red: 0,
      blue: 0,
    });
    assert.equal(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.autocastEnabled, true);
    assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts, []);
    assert.equal(
      entries.filter((entry: any) => entry.solarPowerId === 'SSTA' || entry.solarPowerId === 'SSUP')
        .every((entry: any) => entry.lockedAmount === 6),
      true,
    );
  }
});

Deno.test('manual casts remain first and Autocast continues with deterministic identities and effects', () => {
  const state = createState();
  state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 4 };
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 5, red: 4, blue: 2 };
  const declaration = payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'hold' },
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
    ],
    solarCasts: [
      { solarPowerId: 'SLIF' },
      { solarPowerId: 'SAST' },
      { solarPowerId: 'SCON' },
    ],
    autocastEnabled: true,
  });
  const result = resolveChargeDeclarationSubmission({ state, playerId: 'p1', payload: declaration, nowMs: 1000 });
  const entries = result.state.gameData.ancient.solarLedgerByPlayerId.p1.entries;
  assert.deepEqual(entries.map((entry: any) => [entry.solarPowerId, entry.sourceMode, entry.order]), [
    ['SLIF', 'manual', 0],
    ['SAST', 'manual', 1],
    ['SCON', 'manual', 2],
    ['SSTA', 'autocast', 3],
    ['SSUP', 'autocast', 4],
    ['SCON', 'autocast', 5],
    ['SLIF', 'autocast', 6],
  ]);
  assert.deepEqual(entries.map((entry: any) => entry.entryId), [
    'ancient-solar:3:p1:declaration-1:manual:0',
    'ancient-solar:3:p1:declaration-1:manual:1',
    'ancient-solar:3:p1:declaration-1:manual:2',
    'ancient-solar:3:p1:declaration-1:autocast:0',
    'ancient-solar:3:p1:declaration-1:autocast:1',
    'ancient-solar:3:p1:declaration-1:autocast:2',
    'ancient-solar:3:p1:declaration-1:autocast:3',
  ]);
  assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts, [
    { solarPowerId: 'SLIF' },
    { solarPowerId: 'SAST' },
    { solarPowerId: 'SCON' },
  ]);
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 0, red: 0, blue: 0 });
  assert.deepEqual(result.state.gameData.pendingTurn.healByPlayerId, { p1: 9 });
  assert.deepEqual(result.state.gameData.pendingTurn.damageByPlayerId, { p2: 8 });
  assert.equal(result.state.players[0].lines, 2);
  assert.equal(
    (result.state.gameData.turnData.shipActivationCueBatches ?? [])
      .flatMap((batch: any) => batch.sources ?? [])
      .some((source: any) => String(source.sourceInstanceId).includes('ancient-solar')),
    false,
  );
});

Deno.test('Autocast toggle off preserves unspent Energy and true retries are eventless', () => {
  const state = createState();
  state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 2 };
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 3, blue: 1 };
  const choices = [
    { sourceInstanceId: 'sol-a', choiceId: 'hold' },
    { sourceInstanceId: 'sol-b', choiceId: 'hold' },
  ];
  const off = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({ solarGridChoices: choices, autocastEnabled: false }),
    nowMs: 1000,
  });
  assert.deepEqual(off.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 3, red: 3, blue: 1 });
  assert.deepEqual(off.state.gameData.ancient.solarLedgerByPlayerId.p1.entries, []);

  const onState = createState();
  onState.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 2 };
  onState.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 3, blue: 1 };
  const onPayload = payload({ solarGridChoices: choices, autocastEnabled: true });
  const applied = resolveChargeDeclarationSubmission({
    state: onState, playerId: 'p1', payload: onPayload, nowMs: 1000,
  });
  const snapshot = structuredClone(applied.state);
  applied.state.gameData.currentSubPhase = 'charge_response';
  const retry = resolveChargeDeclarationSubmission({
    state: applied.state, playerId: 'p1', payload: onPayload, nowMs: 1001,
  });
  assert.equal(retry.status, 'idempotent');
  assert.deepEqual(retry.events, []);
  assert.deepEqual({ ...retry.state, gameData: { ...retry.state.gameData, currentSubPhase: 'charge_declaration' } }, snapshot);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: applied.state,
    playerId: 'p1',
    payload: payload({ solarGridChoices: choices, autocastEnabled: false }),
    nowMs: 1002,
  }), /different charge declaration/);
});

Deno.test('late injected Autocast failure rolls back ordinary charge, Grid, manual and automatic effects, lines, and acceptance', () => {
  const state = createState();
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 3, red: 0, blue: 1 };
  const before = structuredClone(state);
  const resolvers: ManualSolarResolverRegistry = {
    SLIF: {
      acceptedFields: {},
      resolve(context) {
        return {
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 1, red: 0, blue: 0 },
          effects: [solarHealthEffect(`${context.castIdentity}:heal`, EffectKind.Heal, 'p1')],
        };
      },
    },
    SCON: {
      acceptedFields: {},
      resolve(context) {
        return {
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 0, red: 0, blue: 1 },
          effects: [{
            id: `${context.castIdentity}:gain-lines`,
            ownerPlayerId: 'p1',
            source: { type: 'system', reason: 'late-autocast-test' },
            timing: 'battle.charge_declaration',
            activationTag: EffectTiming.Charge,
            survivability: SurvivabilityRule.ResolvesIfDestroyed,
            target: { playerId: 'p1' },
            kind: EffectKind.GainLines,
            amount: 1,
            appliesToFutureBuildPhases: true,
          }],
        };
      },
    },
    SSTA: {
      acceptedFields: {},
      resolve(context) {
        return {
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 3, red: 0, blue: 0 },
          effects: [solarHealthEffect(`${context.castIdentity}:heal`, EffectKind.Heal, 'p1')],
        };
      },
    },
    SAST: {
      acceptedFields: {},
      resolve() {
        throw new Error('forced late Autocast failure');
      },
    },
  };

  assert.throws(() => resolveChargeDeclarationSubmissionWithDependencies({
    state,
    playerId: 'p1',
    payload: payload({
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage',
      }],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'use' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: [{ solarPowerId: 'SLIF' }, { solarPowerId: 'SCON' }],
      autocastEnabled: true,
    }),
    nowMs: 1000,
  }, { manualSolarResolvers: resolvers }), /forced late Autocast failure/);
  assert.deepEqual(state, before);
});

Deno.test('Convert lines survive the real turn bump, combine with following generation, and clamp at Build persistence', () => {
  const state = createState();
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 0, red: 0, blue: 9 };
  const converted = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
      solarCasts: Array.from({ length: 9 }, () => ({ solarPowerId: 'SCON' })),
    }),
    nowMs: 1000,
  });
  assert.equal(converted.state.players[0].lines, 9);
  assert.equal(converted.state.players[0].joiningLines, 0);

  converted.state.currentPhase = 'battle';
  converted.state.currentSubPhase = 'end_of_turn_resolution';
  converted.state.gameData.currentPhase = 'battle';
  converted.state.gameData.currentSubPhase = 'end_of_turn_resolution';
  converted.state.gameData.turnData.currentMajorPhase = 'battle';
  converted.state.gameData.turnData.currentSubPhase = 'end_of_turn_resolution';
  const transitioned = advancePhaseCore(converted.state, 1500);
  assert.equal(transitioned.ok, true);
  if (!transitioned.ok) return;
  const transitionedState: any = transitioned.state;
  assert.equal(transitioned.to, 'build.dice_roll');
  assert.equal(transitionedState.gameData.turnNumber, 4);
  assert.equal(transitionedState.gameData.turnData.turnNumber, 4);
  assert.equal(transitionedState.players[0].lines, 9);
  assert.equal(transitionedState.players[0].joiningLines, 0);

  const followingBuild = transitionedState;
  followingBuild.gameData.turnData.diceRolled = true;
  followingBuild.gameData.turnData.diceFinalized = true;
  followingBuild.gameData.turnData.effectiveDiceRoll = 4;
  followingBuild.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 4, p2: 4 };
  followingBuild.gameData.turnData.linesDistributed = false;
  delete followingBuild.gameData.turnData.buildAppliedTurnNumber;
  // Stop the public on-enter helper after this hook so the focused fixture does
  // not auto-walk later phases and begin another turn.
  followingBuild.status = 'finished';

  const entered = onEnterPhase(followingBuild, 'build.dice_roll', 'build.line_generation', 2000);
  const lineGrant = entered.events.find((event: any) =>
    event.type === 'LINES_GRANTED' && event.playerId === 'p1'
  );
  assert.ok(lineGrant);
  assert.equal(lineGrant.newTotal, lineGrant.totalGranted + 9);
  assert.equal(lineGrant.newTotal > 12, true);
  assert.equal(entered.state.players[0].lines, lineGrant.newTotal);
  assert.equal(entered.state.players[0].joiningLines, 0);

  const persisted = resolveBuildSubmitAuthoritatively({
    state: entered.state,
    turnNumber: 4,
    nowMs: 2001,
  });
  assert.equal(persisted.state.players[0].lines, 12);
  assert.equal(persisted.state.players[0].joiningLines, 0);
  assert.equal(
    persisted.events.some((event: any) =>
      event.type === 'BUILD_RESOURCES_PERSISTED' &&
      event.playerId === 'p1' &&
      event.ordinaryLines === 12 &&
      event.joiningLines === 0
    ),
    true,
  );
});
