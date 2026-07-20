import assert from 'node:assert/strict';
import { advancePhaseCore } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import {
  createEmptyAncientState,
  getAuthoritativeAncientEnergyTotal,
  normalizeAncientGameState,
  normalizeAncientNumber,
  projectPublicAncientState,
  sanitizeAncientStateForClient,
} from './ancientState.ts';

function createBaseState() {
  return {
    gameId: 'ancient-test',
    status: 'active',
    stateRevision: 3,
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
        species: 'human',
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: 'spectator',
        role: 'spectator',
        faction: 'ancient',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 2,
      currentPhase: 'battle',
      currentSubPhase: 'end_of_turn_resolution',
      ships: { p1: [], p2: [] },
      turnData: {
        turnNumber: 2,
        currentMajorPhase: 'battle',
        currentSubPhase: 'end_of_turn_resolution',
      },
      phaseReadiness: [],
    },
    unrelated: { keep: true },
  };
}

Deno.test('canonical numeric normalization uses the locked floor-and-clamp rule', () => {
  const cases: Array<[unknown, number]> = [
    [4, 4],
    [-4, 0],
    [4.9, 4],
    [-0.4, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
    ['4', 0],
    [null, 0],
    [undefined, 0],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeAncientNumber(input), expected);
  }
});

Deno.test('fresh Ancient state uses explicit empty Battle stamps and player-role seats', () => {
  const state = createEmptyAncientState(createBaseState().players);
  assert.deepEqual(Object.keys(state.energyByPlayerId), ['p1', 'p2']);
  assert.deepEqual(state.energyByPlayerId.p1, {
    battleTurnNumber: null,
    pool: { green: 0, red: 0, blue: 0 },
    sources: [],
  });
  assert.deepEqual(state.solarLedgerByPlayerId.p1, {
    battleTurnNumber: null,
    entries: [],
  });
  assert.deepEqual(state.acceptedDeclarationByPlayerId, {});
  assert.deepEqual(state.pendingSimulacrumCopies, []);
  assert.deepEqual(state.pendingBlackHoleDestructions, []);
  assert.equal('spectator' in state.energyByPlayerId, false);
});

Deno.test('Ancient schema versions normalize with deterministic compatibility risks', () => {
  const getVersionRisks = (state: any) =>
    normalizeAncientGameState(state).compatibilityRisks.filter((risk) =>
      risk.code.includes('ancient_schema_version')
    );

  const missingFamily: any = normalizeAncientGameState(createBaseState());
  assert.equal(missingFamily.state.gameData.ancient.schemaVersion, 1);
  assert.deepEqual(getVersionRisks(createBaseState()), []);

  const missingVersion: any = createBaseState();
  missingVersion.gameData.ancient = {};
  assert.deepEqual(getVersionRisks(missingVersion), [{
    code: 'missing_ancient_schema_version',
    path: 'gameData.ancient.schemaVersion',
  }]);

  for (const invalidVersion of ['1', 1.5, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const invalid: any = createBaseState();
    invalid.gameData.ancient = { schemaVersion: invalidVersion };
    assert.deepEqual(getVersionRisks(invalid), [{
      code: 'invalid_ancient_schema_version',
      path: 'gameData.ancient.schemaVersion',
    }]);
  }

  const current: any = createBaseState();
  current.gameData.ancient = { schemaVersion: 1 };
  assert.deepEqual(getVersionRisks(current), []);

  const future: any = createBaseState();
  future.gameData.ancient = {
    schemaVersion: 2,
    energyByPlayerId: {
      p1: {
        battleTurnNumber: null,
        pool: { green: 4.9, red: 0, blue: 0 },
        sources: [null],
      },
    },
    solarLedgerByPlayerId: {},
    acceptedDeclarationByPlayerId: {},
    pendingSimulacrumCopies: [],
    pendingBlackHoleDestructions: [],
    futureAuthority: { mustNotSurvive: true },
  };
  const futureFirst = normalizeAncientGameState(future);
  const futureRepeat = normalizeAncientGameState(future);
  assert.deepEqual(futureRepeat, futureFirst);
  assert.deepEqual(getVersionRisks(future), [{
    code: 'unsupported_ancient_schema_version',
    path: 'gameData.ancient.schemaVersion',
    actualVersion: 2,
  }]);
  assert.equal(futureFirst.state.gameData.ancient.schemaVersion, 1);
  assert.equal(futureFirst.state.gameData.ancient.energyByPlayerId.p1.pool.green, 4);
  assert.equal('futureAuthority' in futureFirst.state.gameData.ancient, false);
  const riskKeys = futureFirst.compatibilityRisks.map((risk) =>
    `${risk.path}\u0000${risk.code}\u0000${risk.actualVersion ?? -1}`
  );
  assert.deepEqual(riskKeys, [...riskKeys].sort((a, b) => a.localeCompare(b)));

  const repaired = normalizeAncientGameState(futureFirst.state);
  assert.deepEqual(repaired.state, futureFirst.state);
  assert.equal(repaired.changed, false);
  assert.deepEqual(repaired.compatibilityRisks, []);
});

Deno.test('normalization ignores and removes every legacy Energy shape', () => {
  for (const legacyEnergy of [0, 12, { green: 9, red: 8, blue: 7 }, 'bad', null]) {
    const state: any = createBaseState();
    state.players[0].energy = legacyEnergy;
    const result = normalizeAncientGameState(state);
    assert.equal('energy' in result.state.players[0], false);
    assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, {
      green: 0,
      red: 0,
      blue: 0,
    });
    assert.equal(
      result.compatibilityRisks.some((risk) => risk.path.includes('energy')),
      false,
    );
  }
});

Deno.test('normalization repairs malformed canonical data deterministically', () => {
  const state: any = createBaseState();
  state.gameData.turnData.pendingSOLARPowerDeclarations = { p1: [{ legacy: true }] };
  state.gameData.ancient = {
    schemaVersion: 99,
    energyByPlayerId: {
      p1: {
        battleTurnNumber: 'bad',
        pool: { green: 4.9, red: -2, blue: Infinity },
        sources: [
          {
            sourceId: 'same',
            sourceShipDefId: 'PLU',
            battleTurnNumber: 2,
            order: 5,
            amounts: { green: 1, red: 0, blue: 0 },
          },
          {
            sourceId: 'same',
            sourceShipDefId: 'MER',
            battleTurnNumber: 2,
            order: 1,
            amounts: { green: 0, red: 1, blue: 0 },
          },
          null,
        ],
      },
    },
    solarLedgerByPlayerId: {
      p1: {
        battleTurnNumber: null,
        entries: [
          {
            entryId: 'ledger-1',
            order: 3.8,
            solarPowerId: 'SLIF',
            sourceMode: 'manual',
            paidEnergy: { green: 1, red: 0, blue: 0 },
          },
          {
            entryId: 'ledger-1',
            order: 1,
            solarPowerId: 'SAST',
            sourceMode: 'cube',
            paidEnergy: { green: 0, red: 1, blue: 0 },
          },
        ],
      },
    },
    acceptedDeclarationByPlayerId: {
      p1: {
        schemaVersion: 1,
        declarationId: 'malformed-declaration',
        playerId: 'p1',
        context: null,
      },
    },
    pendingSimulacrumCopies: [
      {
        pendingCopyId: 'copy-1',
        declarationId: 'declaration-1',
        ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'target-1',
        copiedShipDefId: 'FRI',
        queuedTurnNumber: 2.9,
        materializationTurnNumber: 3.9,
        capturedStartOfBattleCharges: -1,
        permanentConfiguration: { selectedNumber: 4.8 },
        sourceMode: 'primary',
        status: 'queued',
      },
      {
        pendingCopyId: 'copy-1',
        declarationId: 'declaration-2',
        ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'target-2',
        copiedShipDefId: 'QUA',
        queuedTurnNumber: 2,
        materializationTurnNumber: 3,
        capturedStartOfBattleCharges: 2,
        permanentConfiguration: {},
        sourceMode: 'cube',
        status: 'queued',
      },
    ],
    pendingBlackHoleDestructions: [
      {
        pendingDestructionId: 'destroy-1',
        declarationId: 'declaration-1',
        ownerPlayerId: 'p1',
        targetPlayerId: 'p2',
        targetInstanceIds: ['b', 'a', 'a'],
        battleTurnNumber: 2,
        lockedDamage: 4.9,
        status: 'committed',
      },
      {
        pendingDestructionId: 'destroy-1',
        declarationId: 'declaration-2',
        ownerPlayerId: 'p1',
        targetPlayerId: 'p2',
        targetInstanceIds: [],
        battleTurnNumber: 2,
        lockedDamage: 1,
        status: 'resolved',
      },
    ],
  };

  const first = normalizeAncientGameState(state);
  const second = normalizeAncientGameState(first.state);
  assert.equal(first.state.gameData.ancient.schemaVersion, 1);
  assert.equal(first.state.gameData.ancient.energyByPlayerId.p1.battleTurnNumber, null);
  assert.deepEqual(first.state.gameData.ancient.energyByPlayerId.p1.pool, {
    green: 4,
    red: 0,
    blue: 0,
  });
  assert.equal(first.state.gameData.ancient.energyByPlayerId.p1.sources[0].sourceShipDefId, 'MER');
  assert.equal(first.state.gameData.ancient.solarLedgerByPlayerId.p1.entries[0].solarPowerId, 'SAST');
  assert.equal(first.state.gameData.ancient.pendingSimulacrumCopies.length, 1);
  assert.equal(first.state.gameData.ancient.pendingBlackHoleDestructions.length, 1);
  assert.deepEqual(first.state.gameData.ancient.acceptedDeclarationByPlayerId, {});
  assert.equal(
    first.compatibilityRisks.some((risk) =>
      risk.code === 'malformed_canonical_record' &&
      risk.path === 'gameData.ancient.acceptedDeclarationByPlayerId.p1'
    ),
    true,
  );
  assert.equal('pendingSOLARPowerDeclarations' in first.state.gameData.turnData, false);
  assert.deepEqual(first.state.unrelated, { keep: true });
  assert.deepEqual(second.state, first.state);
  assert.equal(second.changed, false);
  assert.deepEqual(
    first.compatibilityRisks.filter((risk) => risk.code === 'duplicate_stable_id'),
    [
      {
        code: 'duplicate_stable_id',
        path: 'gameData.ancient.energyByPlayerId.p1.sources',
        stableId: 'same',
      },
      {
        code: 'duplicate_stable_id',
        path: 'gameData.ancient.pendingBlackHoleDestructions',
        stableId: 'destroy-1',
      },
      {
        code: 'duplicate_stable_id',
        path: 'gameData.ancient.pendingSimulacrumCopies',
        stableId: 'copy-1',
      },
      {
        code: 'duplicate_stable_id',
        path: 'gameData.ancient.solarLedgerByPlayerId.p1.entries',
        stableId: 'ledger-1',
      },
    ],
  );
});

Deno.test('canonical accessor uses species compatibility and current player role only', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 2, red: 3, blue: 4 };
  assert.equal(getAuthoritativeAncientEnergyTotal(state, 'p1'), 9);

  state.players[0].faction = null;
  state.players[0].species = 'ancient';
  state.players[0].isActive = false;
  assert.equal(getAuthoritativeAncientEnergyTotal(state, 'p1'), 9);

  state.players[0].role = 'spectator';
  const normalizedAfterRoleChange = normalizeAncientGameState(state).state as any;
  assert.deepEqual(
    normalizedAfterRoleChange.gameData.ancient.energyByPlayerId.p1.pool,
    { green: 2, red: 3, blue: 4 },
  );
  assert.equal(getAuthoritativeAncientEnergyTotal(normalizedAfterRoleChange, 'p1'), 0);
  assert.equal('p1' in projectPublicAncientState(normalizedAfterRoleChange).energyByPlayerId, false);
});

Deno.test('public Ancient projection exposes only cloned Energy and ledger state', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.ancient.energyByPlayerId.p1.pool.green = 3;
  state.gameData.ancient.solarLedgerByPlayerId.p1 = {
    battleTurnNumber: 4,
    entries: [{
      entryId: 'ledger-public',
      order: 0,
      solarPowerId: 'SLIF',
      sourceMode: 'manual',
      paidEnergy: { green: 1, red: 0, blue: 0 },
    }],
  };
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    declarationId: 'private-declaration',
    playerId: 'p1',
    context: {
      contextVersion: 1,
      battleTurnNumber: 4,
      initialEnergy: { green: 3, red: 0, blue: 0 },
      energySourceIds: [],
    },
  };
  state.gameData.ancient.pendingSimulacrumCopies = [{ private: true }];
  state.gameData.ancient.pendingBlackHoleDestructions = [{ private: true }];
  const before = structuredClone(state);

  const projection = projectPublicAncientState(state);
  assert.deepEqual(Object.keys(projection).sort(), [
    'energyByPlayerId',
    'schemaVersion',
    'solarLedgerByPlayerId',
  ]);
  assert.equal(projection.energyByPlayerId.p1.pool.green, 3);
  assert.equal(projection.solarLedgerByPlayerId.p1.entries[0].entryId, 'ledger-public');
  assert.equal('acceptedDeclarationByPlayerId' in projection, false);
  assert.equal('pendingSimulacrumCopies' in projection, false);
  assert.equal('pendingBlackHoleDestructions' in projection, false);
  assert.deepEqual(state, before);

  projection.energyByPlayerId.p1.pool.green = 99;
  projection.solarLedgerByPlayerId.p1.entries[0].paidEnergy.green = 99;
  assert.equal(state.gameData.ancient.energyByPlayerId.p1.pool.green, 3);
  assert.equal(
    state.gameData.ancient.solarLedgerByPlayerId.p1.entries[0].paidEnergy.green,
    1,
  );
});

Deno.test('durable Ancient state survives ordinary turn rollover without Energy reset', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.ancient.energyByPlayerId.p1 = {
    battleTurnNumber: 2,
    pool: { green: 2, red: 1, blue: 3 },
    sources: [],
  };
  state.gameData.ancient.solarLedgerByPlayerId.p1 = {
    battleTurnNumber: 2,
    entries: [{
      entryId: 'ledger-1',
      order: 0,
      solarPowerId: 'SLIF',
      sourceMode: 'manual',
      paidEnergy: { green: 1, red: 0, blue: 0 },
    }],
  };
  state.gameData.ancient.pendingSimulacrumCopies = [{
    pendingCopyId: 'copy-1',
    declarationId: 'declaration-1',
    ownerPlayerId: 'p1',
    sourceTargetInstanceId: 'target-1',
    copiedShipDefId: 'FRI',
    queuedTurnNumber: 2,
    materializationTurnNumber: 3,
    capturedStartOfBattleCharges: 1,
    permanentConfiguration: { selectedNumber: 4 },
    sourceMode: 'primary',
    status: 'queued',
  }];
  state.gameData.ancient.pendingBlackHoleDestructions = [{
    pendingDestructionId: 'destroy-1',
    declarationId: 'declaration-1',
    ownerPlayerId: 'p1',
    targetPlayerId: 'p2',
    targetInstanceIds: ['target-2'],
    battleTurnNumber: 2,
    lockedDamage: 3,
    status: 'committed',
  }];

  const advanced = advancePhaseCore(state, 1000);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.deepEqual((advanced.state as any).gameData.ancient, state.gameData.ancient);
});

Deno.test('P5 adds no Solar declaration path while ordinary charge and response behavior remain intact', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.turnData.currentMajorPhase = 'battle';
  state.gameData.turnData.currentSubPhase = 'charge_declaration';
  state.gameData.ships = {
    p1: [{ instanceId: 'solar-1', shipDefId: 'SLIF' }],
    p2: [{ instanceId: 'interceptor-1', shipDefId: 'INT', chargesCurrent: 1 }],
  };
  state.gameData.ancient.energyByPlayerId.p1.pool.green = 1;
  state.gameData.ancient.energyByPlayerId.p2.pool.green = 99;

  const declaration = onEnterPhase(
    state,
    'battle.first_strike',
    'battle.charge_declaration',
    1000,
  ).state as any;
  assert.equal(
    declaration.gameData.turnData.chargeDeclarationEligibleByPlayerId.p1,
    false,
  );
  assert.equal(
    declaration.gameData.turnData.chargeDeclarationEligibleByPlayerId.p2,
    true,
  );

  declaration.gameData.currentSubPhase = 'charge_response';
  declaration.gameData.turnData.currentSubPhase = 'charge_response';
  declaration.gameData.turnData.anyChargesSpentInDeclaration = true;
  const response = onEnterPhase(
    declaration,
    'battle.charge_declaration',
    'battle.charge_response',
    1001,
  ).state as any;
  const p2Readiness = response.gameData.phaseReadiness.find(
    (entry: any) => entry.playerId === 'p2' && entry.currentStep === 'battle.charge_response',
  );
  assert.notEqual(p2Readiness?.isReady, true);

  const nonAncientOnly: any = normalizeAncientGameState(createBaseState()).state;
  nonAncientOnly.gameData.currentPhase = 'battle';
  nonAncientOnly.gameData.currentSubPhase = 'charge_declaration';
  nonAncientOnly.gameData.turnData.currentMajorPhase = 'battle';
  nonAncientOnly.gameData.turnData.currentSubPhase = 'charge_declaration';
  nonAncientOnly.gameData.ships = {
    p1: [],
    p2: [{ instanceId: 'solar-2', shipDefId: 'SLIF' }],
  };
  nonAncientOnly.gameData.ancient.energyByPlayerId.p2.pool.green = 99;
  const nonAncientDeclaration = onEnterPhase(
    nonAncientOnly,
    'battle.first_strike',
    'battle.charge_declaration',
    1002,
  ).state as any;
  assert.notEqual(
    nonAncientDeclaration.gameData.turnData.chargeDeclarationEligibleByPlayerId.p2,
    true,
  );
});

Deno.test('response sanitizer is pure and strips only Ancient prototype/internal state', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.players[0].energy = 99;
  state.gameData.turnData.pendingSOLARPowerDeclarations = { p1: [{ hidden: true }] };
  state.battleLogScratch = { private: true };
  const before = structuredClone(state);
  const safe = sanitizeAncientStateForClient(state) as any;

  assert.deepEqual(state, before);
  assert.equal('energy' in safe.players[0], false);
  assert.equal('ancient' in safe.gameData, false);
  assert.equal('pendingSOLARPowerDeclarations' in safe.gameData.turnData, false);
  assert.deepEqual(safe.battleLogScratch, { private: true });
});
