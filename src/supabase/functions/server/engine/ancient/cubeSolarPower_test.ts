import assert from 'node:assert/strict';
import type {
  AncientSolarLedgerEntry,
  AncientSolarPowerId,
} from '../state/GameStateTypes.ts';
import type { ManualSolarResolverRegistry } from './manualSolarDeclaration.ts';
import {
  countControlledCubesAtReady,
  findFirstManualCubeRepeatSource,
  isCubeRepeatableSolarPowerId,
  resolveCubeSolarRepeats,
} from './cubeSolarPower.ts';

function ledgerEntry(
  solarPowerId: AncientSolarPowerId,
  order: number,
  overrides: Partial<AncientSolarLedgerEntry> = {},
): AncientSolarLedgerEntry {
  return {
    entryId: `manual:${order}`,
    order,
    solarPowerId,
    sourceMode: 'manual',
    paidEnergy: { green: 1, red: 0, blue: 0 },
    ...overrides,
  };
}

Deno.test('Cube repeat policy selects the first eligible manual cast and excludes non-repeatable powers', () => {
  for (const powerId of ['SLIF', 'SSTA', 'SAST', 'SSUP', 'SCON', 'SSIM'] as const) {
    assert.equal(isCubeRepeatableSolarPowerId(powerId), true, powerId);
  }
  for (const powerId of ['SSIP', 'SVOR', 'SBLA'] as const) {
    assert.equal(isCubeRepeatableSolarPowerId(powerId), false, powerId);
  }

  const source = findFirstManualCubeRepeatSource({
    acceptedCasts: [
      { solarPowerId: 'SSIP', lockedAmount: 4 },
      { solarPowerId: 'SVOR' },
      { solarPowerId: 'SSTA' },
      { solarPowerId: 'SSIM', targetInstanceId: 'later-target' },
    ],
    ledgerEntries: [
      ledgerEntry('SSIP', 0, { lockedAmount: 8 }),
      ledgerEntry('SVOR', 1, { lockedAmount: 4 }),
      ledgerEntry('SSTA', 2, { lockedAmount: 7 }),
      ledgerEntry('SSIM', 3),
    ],
  });
  assert.deepEqual(source, {
    cast: { solarPowerId: 'SSTA' },
    ledgerEntry: ledgerEntry('SSTA', 2, { lockedAmount: 7 }),
  });
  assert.equal(findFirstManualCubeRepeatSource({
    acceptedCasts: [{ solarPowerId: 'SSIP', lockedAmount: 4 }, { solarPowerId: 'SBLA' }],
    ledgerEntries: [ledgerEntry('SSIP', 0), ledgerEntry('SBLA', 1)],
  }), null);
});

Deno.test('Cube multiplicity is counted only from the caster live fleet and can be locked before later mutation', () => {
  const state: any = {
    gameData: {
      ships: {
        p1: [
          { instanceId: 'cube-a', shipDefId: 'CUB' },
          { instanceId: 'cube-b', shipDefId: 'CUB' },
          { instanceId: 'other', shipDefId: 'FIG' },
        ],
        p2: [{ instanceId: 'enemy-cube', shipDefId: 'CUB' }],
      },
      voidShipsByPlayerId: { p1: [{ instanceId: 'void-cube', shipDefId: 'CUB' }] },
      ancient: {
        pendingSimulacrumCopies: [{ copiedShipDefId: 'CUB', status: 'queued' }],
      },
    },
  };
  const lockedCubeCount = countControlledCubesAtReady(state, 'p1');
  assert.equal(lockedCubeCount, 2);
  state.gameData.ships.p1 = [];

  const resolvers: ManualSolarResolverRegistry = {
    SLIF: {
      acceptedFields: {},
      resolve(context) {
        return {
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 1, red: 0, blue: 0 },
          effects: [],
          ledgerMetadata: { lockedAmount: 1 },
        };
      },
    },
  };
  const result = resolveCubeSolarRepeats({
    state,
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 0, red: 0, blue: 0 },
    lockedCubeCount,
    source: {
      cast: { solarPowerId: 'SLIF' },
      ledgerEntry: ledgerEntry('SLIF', 0, { lockedAmount: 1 }),
    },
    resolvers,
    initialLedgerOrder: 4,
  });
  assert.deepEqual(result.ledgerEntries.map((entry) => ({
    entryId: entry.entryId,
    order: entry.order,
    sourceMode: entry.sourceMode,
    paidEnergy: entry.paidEnergy,
  })), [
    {
      entryId: 'ancient-solar:3:p1:declaration-1:cube:0',
      order: 4,
      sourceMode: 'cube',
      paidEnergy: { green: 0, red: 0, blue: 0 },
    },
    {
      entryId: 'ancient-solar:3:p1:declaration-1:cube:1',
      order: 5,
      sourceMode: 'cube',
      paidEnergy: { green: 0, red: 0, blue: 0 },
    },
  ]);
  assert.deepEqual(result.remainingEnergy, { green: 0, red: 0, blue: 0 });
});

Deno.test('Cube repeat rejects recursive sources and authoritative metadata drift only', () => {
  const baseArgs = {
    state: { gameData: {} },
    playerId: 'p1',
    declarationId: 'declaration-1',
    battleTurnNumber: 3,
    initialEnergy: { green: 0, red: 0, blue: 0 },
    lockedCubeCount: 1,
    resolvers: {
      SSTA: {
        acceptedFields: {},
        resolve: (context: any) => ({
          candidateState: structuredClone(context.state),
          paidEnergy: { green: 3, red: 0, blue: 0 },
          effects: [],
          ledgerMetadata: { lockedAmount: 8 },
        }),
      },
    } satisfies ManualSolarResolverRegistry,
    initialLedgerOrder: 1,
  };
  assert.throws(() => resolveCubeSolarRepeats({
    ...baseArgs,
    source: {
      cast: { solarPowerId: 'SSTA' },
      ledgerEntry: ledgerEntry('SSTA', 0, { lockedAmount: 7 }),
    },
  }), /metadata drifted/);
  assert.throws(() => resolveCubeSolarRepeats({
    ...baseArgs,
    source: {
      cast: { solarPowerId: 'SSTA' },
      ledgerEntry: {
        ...ledgerEntry('SSTA', 0, { lockedAmount: 8 }),
        sourceMode: 'cube',
      },
    },
  }), /recursive/);
});
