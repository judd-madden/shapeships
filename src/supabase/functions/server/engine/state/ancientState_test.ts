import assert from 'node:assert/strict';
import { advancePhaseCore } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import {
  applyAncientBattleRevealPreparation,
  createEmptyAncientState,
  getAuthoritativeAncientEnergyTotal,
  normalizeAncientGameState,
  normalizeAncientNumber,
  projectPublicAncientState,
  sanitizeAncientStateForClient,
} from './ancientState.ts';
import {
  ancientAtomicDeclarationContractApplies,
  getEligibleOrdinaryChargeSourceIdsAtDeclarationStart,
  getAvailableOrdinaryChargeResponseSourceIds,
  getRelevantSolarGridSourceIdsAtDeclarationStart,
  playerRequiresChargeDeclarationInput,
} from '../intent/chargeDeclarationEligibility.ts';

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

Deno.test('older valid accepted declaration placeholders normalize additively without a schema bump', () => {
  const state: any = createBaseState();
  state.gameData.ancient = createEmptyAncientState(state.players);
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    declarationId: 'legacy-p5-placeholder',
    playerId: 'p1',
    context: {
      contextVersion: 1,
      battleTurnNumber: 2,
      initialEnergy: { green: 1, red: 0, blue: 0 },
      energySourceIds: ['core-source'],
    },
  };
  const normalized = normalizeAncientGameState(state);
  const accepted = normalized.state.gameData.ancient.acceptedDeclarationByPlayerId.p1;
  assert.equal(normalized.state.gameData.ancient.schemaVersion, 1);
  assert.equal(accepted.contractVersion, 1);
  assert.deepEqual(accepted.ordinaryChargeActions, []);
  assert.deepEqual(accepted.solarGridChoices, []);
  assert.deepEqual(accepted.solarCasts, []);
  assert.equal(accepted.autocastEnabled, false);
  assert.equal(typeof accepted.declarationFingerprint, 'string');
  assert.equal(normalizeAncientGameState(normalized.state).changed, false);
});

Deno.test('accepted Solar casts normalize as an ordered repeated list with path-specific malformed risks', () => {
  const state: any = createBaseState();
  state.gameData.ancient = createEmptyAncientState(state.players);
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    contractVersion: 1,
    declarationId: 'ordered-casts',
    declarationFingerprint: 'stale',
    playerId: 'p1',
    context: {
      contextVersion: 1,
      battleTurnNumber: 2,
      initialEnergy: { green: 2, red: 1, blue: 0 },
      energySourceIds: [],
    },
    ordinaryChargeActions: [],
    solarGridChoices: [],
    solarCasts: [
      { solarPowerId: 'SLIF' },
      { solarPowerId: 'UNKNOWN' },
      { solarPowerId: 'SLIF', targetInstanceIds: ['b', 'a'] },
      { solarPowerId: 'SAST', order: 3 },
      { solarPowerId: 'SAST', lockedAmount: 2 },
    ],
    autocastEnabled: false,
  };

  const normalized = normalizeAncientGameState(state);
  const accepted = normalized.state.gameData.ancient.acceptedDeclarationByPlayerId.p1;
  assert.deepEqual(accepted.solarCasts, [
    { solarPowerId: 'SLIF' },
    { solarPowerId: 'SLIF', targetInstanceIds: ['a', 'b'] },
    { solarPowerId: 'SAST', lockedAmount: 2 },
  ]);
  assert.deepEqual(
    normalized.compatibilityRisks.filter((risk) =>
      risk.path.startsWith('gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts')
    ),
    [
      {
        code: 'malformed_canonical_record',
        path: 'gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts[1]',
      },
      {
        code: 'malformed_canonical_record',
        path: 'gameData.ancient.acceptedDeclarationByPlayerId.p1.solarCasts[3]',
      },
    ],
  );
  assert.deepEqual(JSON.parse(accepted.declarationFingerprint).solarCasts, accepted.solarCasts);
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

Deno.test('Battle Reveal Core Energy uses live Cores of every age and excludes other ships', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.ships = {
    p1: [
      { instanceId: 'nep-b', shipDefId: 'NEP', createdTurn: 1 },
      { instanceId: 'quantum', shipDefId: 'QUA', createdTurn: 2 },
      { instanceId: 'plu-b', shipDefId: 'PLU', createdTurn: 2 },
      { instanceId: 'spiral', shipDefId: 'SPI' },
      { instanceId: 'mer-a', shipDefId: 'MER' },
      { instanceId: 'solar-grid', shipDefId: 'SOL' },
      { instanceId: 'plu-a', shipDefId: 'PLU', createdTurn: 1 },
      { instanceId: 'cube', shipDefId: 'CUB' },
      { instanceId: 'nep-a', shipDefId: 'NEP' },
      { instanceId: 'frigate', shipDefId: 'FRI' },
    ],
    p2: [
      { instanceId: 'controlled-plu', shipDefId: 'PLU' },
      { instanceId: 'human-ship', shipDefId: 'DEF' },
    ],
  };

  const returned = applyAncientBattleRevealPreparation(state);
  assert.equal(returned, state);
  assert.deepEqual(state.gameData.ancient.energyByPlayerId.p1, {
    battleTurnNumber: 2,
    pool: { green: 2, red: 1, blue: 2 },
    sources: [
      {
        sourceId: 'ancient-core-energy:2:p1:PLU:plu-a',
        sourceInstanceId: 'plu-a',
        sourceShipDefId: 'PLU',
        battleTurnNumber: 2,
        order: 0,
        amounts: { green: 1, red: 0, blue: 0 },
      },
      {
        sourceId: 'ancient-core-energy:2:p1:PLU:plu-b',
        sourceInstanceId: 'plu-b',
        sourceShipDefId: 'PLU',
        battleTurnNumber: 2,
        order: 1,
        amounts: { green: 1, red: 0, blue: 0 },
      },
      {
        sourceId: 'ancient-core-energy:2:p1:MER:mer-a',
        sourceInstanceId: 'mer-a',
        sourceShipDefId: 'MER',
        battleTurnNumber: 2,
        order: 2,
        amounts: { green: 0, red: 1, blue: 0 },
      },
      {
        sourceId: 'ancient-core-energy:2:p1:NEP:nep-a',
        sourceInstanceId: 'nep-a',
        sourceShipDefId: 'NEP',
        battleTurnNumber: 2,
        order: 3,
        amounts: { green: 0, red: 0, blue: 1 },
      },
      {
        sourceId: 'ancient-core-energy:2:p1:NEP:nep-b',
        sourceInstanceId: 'nep-b',
        sourceShipDefId: 'NEP',
        battleTurnNumber: 2,
        order: 4,
        amounts: { green: 0, red: 0, blue: 1 },
      },
    ],
  });
  assert.deepEqual(state.gameData.ancient.energyByPlayerId.p2, {
    battleTurnNumber: 2,
    pool: { green: 0, red: 0, blue: 0 },
    sources: [],
  });
});

Deno.test('Battle Reveal replaces stale Energy and ledger idempotently while preserving unrelated Ancient state', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.turnNumber = 3;
  state.gameData.turnData.turnNumber = 3;
  state.gameData.ships = {
    p1: [{ instanceId: 'mer-current', shipDefId: 'MER' }],
    p2: [
      { instanceId: 'plu-controlled', shipDefId: 'PLU' },
      { instanceId: 'mer-controlled', shipDefId: 'MER' },
      { instanceId: 'nep-controlled', shipDefId: 'NEP' },
    ],
  };
  state.gameData.ancient.energyByPlayerId = {
    p1: {
      battleTurnNumber: 2,
      pool: { green: 8, red: 8, blue: 8 },
      sources: [{ sourceId: 'stale-p1' }],
    },
    p2: {
      battleTurnNumber: 2,
      pool: { green: 7, red: 7, blue: 7 },
      sources: [{ sourceId: 'stale-p2' }],
    },
    formerPlayer: {
      battleTurnNumber: 2,
      pool: { green: 6, red: 6, blue: 6 },
      sources: [{ sourceId: 'stale-former-player' }],
    },
  };
  state.gameData.ancient.acceptedDeclarationByPlayerId = { p1: { keep: 'declaration' } };
  state.gameData.ancient.solarLedgerByPlayerId = {
    p1: { battleTurnNumber: 2, entries: [{ keep: 'stale-p1-ledger' }] },
    p2: { battleTurnNumber: 2, entries: [{ keep: 'stale-p2-ledger' }] },
    formerPlayer: { battleTurnNumber: 2, entries: [{ keep: 'stale-former-ledger' }] },
  };
  state.gameData.ancient.pendingSimulacrumCopies = [{ keep: 'copy' }];
  state.gameData.ancient.pendingBlackHoleDestructions = [{ keep: 'destruction' }];
  state.gameData.ancient.futureUnrelatedState = { keep: true };
  const ancientObject = state.gameData.ancient;
  const unrelatedAncientState = {
    schemaVersion: ancientObject.schemaVersion,
    acceptedDeclarationByPlayerId: structuredClone(ancientObject.acceptedDeclarationByPlayerId),
    pendingSimulacrumCopies: structuredClone(ancientObject.pendingSimulacrumCopies),
    pendingBlackHoleDestructions: structuredClone(ancientObject.pendingBlackHoleDestructions),
    futureUnrelatedState: structuredClone(ancientObject.futureUnrelatedState),
  };

  applyAncientBattleRevealPreparation(state);
  assert.equal(state.gameData.ancient, ancientObject);
  assert.deepEqual(Object.keys(ancientObject.energyByPlayerId), ['p1', 'p2']);
  assert.deepEqual(ancientObject.energyByPlayerId.p1, {
    battleTurnNumber: 3,
    pool: { green: 0, red: 1, blue: 0 },
    sources: [{
      sourceId: 'ancient-core-energy:3:p1:MER:mer-current',
      sourceInstanceId: 'mer-current',
      sourceShipDefId: 'MER',
      battleTurnNumber: 3,
      order: 0,
      amounts: { green: 0, red: 1, blue: 0 },
    }],
  });
  assert.deepEqual(ancientObject.energyByPlayerId.p2, {
    battleTurnNumber: 3,
    pool: { green: 0, red: 0, blue: 0 },
    sources: [],
  });
  assert.deepEqual(ancientObject.solarLedgerByPlayerId, {
    p1: { battleTurnNumber: 3, entries: [] },
    p2: { battleTurnNumber: 3, entries: [] },
  });
  assert.deepEqual({
    schemaVersion: ancientObject.schemaVersion,
    acceptedDeclarationByPlayerId: ancientObject.acceptedDeclarationByPlayerId,
    pendingSimulacrumCopies: ancientObject.pendingSimulacrumCopies,
    pendingBlackHoleDestructions: ancientObject.pendingBlackHoleDestructions,
    futureUnrelatedState: ancientObject.futureUnrelatedState,
  }, unrelatedAncientState);

  const firstEnergy = structuredClone(ancientObject.energyByPlayerId);
  const firstLedger = structuredClone(ancientObject.solarLedgerByPlayerId);
  applyAncientBattleRevealPreparation(state);
  assert.deepEqual(ancientObject.energyByPlayerId, firstEnergy);
  assert.deepEqual(ancientObject.solarLedgerByPlayerId, firstLedger);
  assert.deepEqual({
    schemaVersion: ancientObject.schemaVersion,
    acceptedDeclarationByPlayerId: ancientObject.acceptedDeclarationByPlayerId,
    pendingSimulacrumCopies: ancientObject.pendingSimulacrumCopies,
    pendingBlackHoleDestructions: ancientObject.pendingBlackHoleDestructions,
    futureUnrelatedState: ancientObject.futureUnrelatedState,
  }, unrelatedAncientState);
});

Deno.test('Battle Reveal Core Energy is deterministic across fleet array order', () => {
  const ships = [
    { instanceId: 'nep-z', shipDefId: 'NEP' },
    { instanceId: 'plu-z', shipDefId: 'PLU' },
    { instanceId: 'mer-a', shipDefId: 'MER' },
    { instanceId: 'plu-a', shipDefId: 'PLU' },
  ];
  const first: any = normalizeAncientGameState(createBaseState()).state;
  const second: any = normalizeAncientGameState(createBaseState()).state;
  first.gameData.ships.p1 = structuredClone(ships);
  second.gameData.ships.p1 = structuredClone(ships).reverse();

  applyAncientBattleRevealPreparation(first);
  applyAncientBattleRevealPreparation(second);

  assert.deepEqual(
    first.gameData.ancient.energyByPlayerId,
    second.gameData.ancient.energyByPlayerId,
  );
  assert.deepEqual(
    first.gameData.ancient.energyByPlayerId.p1.sources.map((source: any) =>
      source.sourceInstanceId
    ),
    ['plu-a', 'plu-z', 'mer-a', 'nep-z'],
  );
});

Deno.test('Battle Reveal matches QUA selections 1 through 6 with Ancient and non-Ancient controller semantics', () => {
  for (let selectedNumber = 1; selectedNumber <= 6; selectedNumber += 1) {
    const state: any = normalizeAncientGameState(createBaseState()).state;
    state.gameData.turnData.effectiveDiceRollByPlayerId = {
      p1: selectedNumber,
      p2: selectedNumber,
    };
    state.gameData.ships = {
      p1: [{
        instanceId: `ancient-qua-${selectedNumber}`,
        shipDefId: 'QUA',
        createdTurn: 2,
        permanentConfiguration: { selectedNumber },
      }],
      p2: [{
        instanceId: `human-qua-${selectedNumber}`,
        shipDefId: 'QUA',
        createdTurn: 2,
        permanentConfiguration: { selectedNumber },
      }],
    };

    applyAncientBattleRevealPreparation(state);

    assert.deepEqual(state.gameData.ancient.energyByPlayerId.p1.pool, {
      green: 0,
      red: 0,
      blue: 2,
    });
    assert.deepEqual(state.gameData.ancient.energyByPlayerId.p2.pool, {
      green: 0,
      red: 0,
      blue: 0,
    });
    assert.deepEqual(state.gameData.powerMemory.quantumMysticRevealByInstanceId, {
      [`ancient-qua-${selectedNumber}`]: {
        battleTurnNumber: 2,
        controllerPlayerId: 'p1',
      },
      [`human-qua-${selectedNumber}`]: {
        battleTurnNumber: 2,
        controllerPlayerId: 'p2',
      },
    });
  }
});

Deno.test('Battle Reveal combines ordered Core and matching QUA Energy while ignoring non-matches and malformed configuration', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 4, p2: 2 };
  state.gameData.powerMemory = {
    onceOnlyFired: { sentinel: true },
    quantumMysticRevealByInstanceId: {
      stale: { battleTurnNumber: 1, controllerPlayerId: 'p1' },
    },
  };
  state.gameData.ships = {
    p1: [
      { instanceId: 'qua-z', shipDefId: 'QUA', permanentConfiguration: { selectedNumber: 4 } },
      { instanceId: 'nep', shipDefId: 'NEP' },
      { instanceId: 'qua-no-match', shipDefId: 'QUA', permanentConfiguration: { selectedNumber: 3 } },
      { instanceId: 'mer', shipDefId: 'MER' },
      { instanceId: 'qua-a', shipDefId: 'QUA', createdTurn: 2, permanentConfiguration: { selectedNumber: 4 } },
      { instanceId: 'qua-missing', shipDefId: 'QUA' },
      { instanceId: 'qua-fraction', shipDefId: 'QUA', permanentConfiguration: { selectedNumber: 4.5 } },
      { instanceId: 'plu', shipDefId: 'PLU' },
    ],
    p2: [],
  };

  applyAncientBattleRevealPreparation(state);
  const firstEnergy = structuredClone(state.gameData.ancient.energyByPlayerId);
  const firstMemory = structuredClone(state.gameData.powerMemory);
  applyAncientBattleRevealPreparation(state);

  assert.deepEqual(state.gameData.ancient.energyByPlayerId, firstEnergy);
  assert.deepEqual(state.gameData.powerMemory, firstMemory);
  assert.equal(state.gameData.powerMemory.onceOnlyFired.sentinel, true);
  assert.deepEqual(state.gameData.ancient.energyByPlayerId.p1.pool, {
    green: 1,
    red: 1,
    blue: 5,
  });
  assert.deepEqual(
    state.gameData.ancient.energyByPlayerId.p1.sources.map((source: any) => source.sourceInstanceId),
    ['plu', 'mer', 'nep', 'qua-a', 'qua-z'],
  );
  assert.deepEqual(
    state.gameData.ancient.energyByPlayerId.p1.sources.slice(3).map((source: any) => source.sourceId),
    [
      'ancient-quantum-mystic-energy:2:p1:qua-a',
      'ancient-quantum-mystic-energy:2:p1:qua-z',
    ],
  );
  assert.deepEqual(Object.keys(state.gameData.powerMemory.quantumMysticRevealByInstanceId), [
    'qua-a',
    'qua-z',
  ]);
});

Deno.test('QUA configuration, public Energy, and reveal memory survive JSON reload without an Ancient trigger ledger', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.turnData.effectiveDiceRollByPlayerId = { p1: 5 };
  state.gameData.ships = {
    p1: [{
      instanceId: 'qua-reload',
      shipDefId: 'QUA',
      permanentConfiguration: { selectedNumber: 5 },
    }],
    p2: [],
  };
  applyAncientBattleRevealPreparation(state);

  const reloaded = JSON.parse(JSON.stringify(state));
  const projected = projectPublicAncientState(reloaded);
  assert.equal(
    reloaded.gameData.ships.p1[0].permanentConfiguration.selectedNumber,
    5,
  );
  assert.deepEqual(reloaded.gameData.powerMemory.quantumMysticRevealByInstanceId, {
    'qua-reload': { battleTurnNumber: 2, controllerPlayerId: 'p1' },
  });
  assert.equal(projected.energyByPlayerId.p1.sources[0].sourceShipDefId, 'QUA');
  assert.equal(Object.hasOwn(projected, 'quantumMysticRevealByInstanceId'), false);
  assert.equal(Object.hasOwn(reloaded.gameData.ancient, 'quantumMysticRevealTriggers'), false);
});

Deno.test('battle.reveal entry generates public Core Energy before the unchanged visibility hold', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.turnNumber = 4;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'reveal';
  state.gameData.turnData.turnNumber = 4;
  state.gameData.turnData.currentMajorPhase = 'battle';
  state.gameData.turnData.currentSubPhase = 'reveal';
  delete state.gameData.turnData.phaseHold;
  delete state.gameData.turnData.battleRevealHoldPresentedTurnNumber;
  state.gameData.ships.p1 = [{ instanceId: 'plu-reveal', shipDefId: 'PLU' }];
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = { private: true };
  state.gameData.ancient.pendingSimulacrumCopies = [{ private: true }];
  state.gameData.ancient.pendingBlackHoleDestructions = [{ private: true }];

  const nowMs = 10_000;
  const entered = onEnterPhase(
    state,
    'build.end_of_build',
    'battle.reveal',
    nowMs,
  ).state as any;

  assert.deepEqual(entered.gameData.ancient.energyByPlayerId.p1.pool, {
    green: 1,
    red: 0,
    blue: 0,
  });
  assert.equal(entered.gameData.turnData.battleRevealHoldPresentedTurnNumber, 4);
  assert.equal(entered.gameData.turnData.phaseHold.phaseKey, 'battle.reveal');
  assert.equal(entered.gameData.turnData.phaseHold.holdReason, 'battle_reveal');
  assert.equal(entered.gameData.turnData.phaseHold.holdUntilMs - nowMs, 25);
  assert.equal(entered.gameData.currentPhase, 'battle');
  assert.equal(entered.gameData.currentSubPhase, 'reveal');
  assert.equal(entered.gameData.turnData.currentMajorPhase, 'battle');
  assert.equal(entered.gameData.turnData.currentSubPhase, 'reveal');

  const projection = projectPublicAncientState(entered);
  assert.deepEqual(
    projection.energyByPlayerId.p1,
    entered.gameData.ancient.energyByPlayerId.p1,
  );
  assert.equal('acceptedDeclarationByPlayerId' in projection, false);
  assert.equal('pendingSimulacrumCopies' in projection, false);
  assert.equal('pendingBlackHoleDestructions' in projection, false);
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

Deno.test('Solar Power ships stay outside ordinary charge declaration and response snapshots', () => {
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

Deno.test('P12 declaration input separates Energy, charged SOL, ordinary charge, acceptance, and response posture', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.gameData.turnNumber = 3;
  state.gameData.turnData.turnNumber = 3;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.turnData.currentMajorPhase = 'battle';
  state.gameData.turnData.currentSubPhase = 'charge_declaration';
  state.gameData.ancient.energyByPlayerId.p1 = {
    battleTurnNumber: 3,
    pool: { green: 1, red: 0, blue: 0 },
    sources: [],
  };
  state.gameData.ships = {
    p1: [
      { instanceId: 'charged-sol', shipDefId: 'SOL', chargesCurrent: 4 },
      { instanceId: 'depleted-sol', shipDefId: 'SOL', chargesCurrent: 0 },
      { instanceId: 'cube', shipDefId: 'CUB' },
      { instanceId: 'foreign-int', shipDefId: 'INT', chargesCurrent: 1 },
    ],
    p2: [{ instanceId: 'non-ancient-sol', shipDefId: 'SOL', chargesCurrent: 4 }],
  };
  assert.deepEqual(getRelevantSolarGridSourceIdsAtDeclarationStart(state, 'p1'), ['charged-sol']);
  assert.deepEqual(getRelevantSolarGridSourceIdsAtDeclarationStart(state, 'p2'), []);
  assert.deepEqual(getEligibleOrdinaryChargeSourceIdsAtDeclarationStart(state, 'p1'), ['foreign-int']);

  state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
    p1: ['foreign-int'], p2: [],
  };
  state.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId = {
    p1: ['charged-sol'], p2: [],
  };
  assert.equal(playerRequiresChargeDeclarationInput(state, 'p1'), true);
  assert.equal(playerRequiresChargeDeclarationInput(state, 'p2'), false);

  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    contractVersion: 1,
    declarationId: 'accepted',
    declarationFingerprint: 'fingerprint',
    playerId: 'p1',
    context: {
      contextVersion: 1,
      battleTurnNumber: 3,
      initialEnergy: { green: 1, red: 0, blue: 0 },
      energySourceIds: [],
    },
    ordinaryChargeActions: [],
    solarGridChoices: [{ sourceInstanceId: 'charged-sol', choiceId: 'hold' }],
    solarCasts: [],
    autocastEnabled: false,
  };
  assert.equal(playerRequiresChargeDeclarationInput(state, 'p1'), false);
  assert.equal(ancientAtomicDeclarationContractApplies(state, 'p1'), true);
});

Deno.test('P12 isolated declaration gates stop only for Energy, charged SOL, or ordinary charge', () => {
  const createGateState = () => {
    const state: any = normalizeAncientGameState(createBaseState()).state;
    state.gameData.turnNumber = 3;
    state.gameData.turnData.turnNumber = 3;
    state.gameData.ships = { p1: [], p2: [] };
    state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = { p1: [], p2: [] };
    state.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId = { p1: [], p2: [] };
    state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = { p1: [], p2: [] };
    state.gameData.ancient.energyByPlayerId.p1 = {
      battleTurnNumber: 3,
      pool: { green: 0, red: 0, blue: 0 },
      sources: [],
    };
    return state;
  };

  const empty = createGateState();
  empty.gameData.ships.p1 = [{ instanceId: 'cube', shipDefId: 'CUB' }];
  assert.equal(playerRequiresChargeDeclarationInput(empty, 'p1'), false);

  const energyOnly = createGateState();
  energyOnly.gameData.ancient.energyByPlayerId.p1.pool.green = 1;
  assert.equal(playerRequiresChargeDeclarationInput(energyOnly, 'p1'), true);

  const chargedSolOnly = createGateState();
  chargedSolOnly.gameData.ships.p1 = [{ instanceId: 'sol', shipDefId: 'SOL', chargesCurrent: 4 }];
  chargedSolOnly.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId.p1 = ['sol'];
  chargedSolOnly.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p1 = structuredClone(
    chargedSolOnly.gameData.ships.p1,
  );
  assert.equal(playerRequiresChargeDeclarationInput(chargedSolOnly, 'p1'), true);

  const depletedSolOnly = createGateState();
  depletedSolOnly.gameData.ships.p1 = [{ instanceId: 'sol', shipDefId: 'SOL', chargesCurrent: 0 }];
  assert.equal(playerRequiresChargeDeclarationInput(depletedSolOnly, 'p1'), false);

  const foreignChargeOnly = createGateState();
  foreignChargeOnly.gameData.ships.p1 = [{ instanceId: 'int', shipDefId: 'INT', chargesCurrent: 1 }];
  foreignChargeOnly.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId.p1 = ['int'];
  foreignChargeOnly.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p1 = structuredClone(
    foreignChargeOnly.gameData.ships.p1,
  );
  assert.equal(playerRequiresChargeDeclarationInput(foreignChargeOnly, 'p1'), true);
  assert.deepEqual(getAvailableOrdinaryChargeResponseSourceIds(foreignChargeOnly, 'p1'), ['int']);

  const nonAncient = createGateState();
  nonAncient.players[0].faction = 'human';
  nonAncient.gameData.ancient.energyByPlayerId.p1.pool.green = 8;
  nonAncient.gameData.ships.p1 = [{ instanceId: 'sol', shipDefId: 'SOL', chargesCurrent: 4 }];
  nonAncient.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId.p1 = ['sol'];
  assert.equal(playerRequiresChargeDeclarationInput(nonAncient, 'p1'), false);
  assert.deepEqual(getAvailableOrdinaryChargeResponseSourceIds(nonAncient, 'p1'), []);
});

Deno.test('response sanitizer is pure and strips Ancient internal and third-Spiral turn scratch', () => {
  const state: any = normalizeAncientGameState(createBaseState()).state;
  state.players[0].energy = 99;
  state.gameData.turnData.pendingSOLARPowerDeclarations = { p1: [{ hidden: true }] };
  state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId = {
    p1: { sourceInstanceId: 'spi-3', turnNumber: 1 },
  };
  state.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId = {
    p1: ['private-sol-snapshot'],
  };
  state.battleLogScratch = { private: true };
  const before = structuredClone(state);
  const safe = sanitizeAncientStateForClient(state) as any;

  assert.deepEqual(state, before);
  assert.equal('energy' in safe.players[0], false);
  assert.equal('ancient' in safe.gameData, false);
  assert.equal('pendingSOLARPowerDeclarations' in safe.gameData.turnData, false);
  assert.equal(
    'thirdSpiralFirstStrikeEligibilityByPlayerId' in safe.gameData.turnData,
    false,
  );
  assert.equal('solarGridDeclarationSourceIdsByPlayerId' in safe.gameData.turnData, false);
  assert.deepEqual(safe.battleLogScratch, { private: true });
});
