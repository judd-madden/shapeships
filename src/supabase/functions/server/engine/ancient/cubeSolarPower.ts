import type {
  AncientEnergyPool,
  AncientNormalizedSolarCast,
  AncientSolarLedgerEntry,
  AncientSolarPowerId,
} from '../state/GameStateTypes.ts';
import {
  resolveSolarCastSequence,
  type ManualSolarDeclarationResult,
  type ManualSolarResolverRegistry,
} from './manualSolarDeclaration.ts';

const CUBE_REPEATABLE_SOLAR_POWER_IDS: ReadonlySet<AncientSolarPowerId> =
  new Set<AncientSolarPowerId>([
    'SLIF',
    'SSTA',
    'SAST',
    'SSUP',
    'SCON',
    'SSIM',
  ]);

export type CubeSolarRepeatSource = {
  cast: AncientNormalizedSolarCast;
  ledgerEntry: AncientSolarLedgerEntry;
};

export function isCubeRepeatableSolarPowerId(
  solarPowerId: AncientSolarPowerId,
): boolean {
  return CUBE_REPEATABLE_SOLAR_POWER_IDS.has(solarPowerId);
}

export function countControlledCubesAtReady(
  state: Readonly<any>,
  playerId: string,
): number {
  const fleet = state?.gameData?.ships?.[playerId];
  if (!Array.isArray(fleet)) return 0;
  return fleet.filter((ship: any) => ship?.shipDefId === 'CUB').length;
}

export function findFirstManualCubeRepeatSource(args: {
  acceptedCasts: readonly AncientNormalizedSolarCast[];
  ledgerEntries: readonly AncientSolarLedgerEntry[];
}): CubeSolarRepeatSource | null {
  if (args.acceptedCasts.length !== args.ledgerEntries.length) {
    throw new Error('Manual Solar casts and ledger entries must remain aligned');
  }
  for (const [index, cast] of args.acceptedCasts.entries()) {
    if (!isCubeRepeatableSolarPowerId(cast.solarPowerId)) continue;
    const ledgerEntry = args.ledgerEntries[index];
    if (
      ledgerEntry.sourceMode !== 'manual' ||
      ledgerEntry.solarPowerId !== cast.solarPowerId
    ) {
      throw new Error('Manual Cube repeat source does not match its ledger entry');
    }
    return {
      cast: structuredClone(cast),
      ledgerEntry: structuredClone(ledgerEntry),
    };
  }
  return null;
}

function metadataMatchesSource(
  repeat: Readonly<AncientSolarLedgerEntry>,
  source: Readonly<AncientSolarLedgerEntry>,
): boolean {
  return repeat.solarPowerId === source.solarPowerId &&
    repeat.lockedAmount === source.lockedAmount &&
    JSON.stringify(repeat.targets ?? null) ===
      JSON.stringify(source.targets ?? null) &&
    JSON.stringify(repeat.simulacrum ?? null) ===
      JSON.stringify(source.simulacrum ?? null);
}

export function resolveCubeSolarRepeats(args: {
  state: any;
  playerId: string;
  declarationId: string;
  battleTurnNumber: number;
  initialEnergy: AncientEnergyPool;
  lockedCubeCount: number;
  source: Readonly<CubeSolarRepeatSource>;
  resolvers: Readonly<ManualSolarResolverRegistry>;
  initialLedgerOrder: number;
}): ManualSolarDeclarationResult {
  if (
    !Number.isInteger(args.lockedCubeCount) ||
    args.lockedCubeCount < 0
  ) {
    throw new Error('Locked Cube count must be a non-negative integer');
  }
  if (!isCubeRepeatableSolarPowerId(args.source.cast.solarPowerId)) {
    throw new Error(
      `Solar Power is not Cube-repeatable: ${args.source.cast.solarPowerId}`,
    );
  }
  if (
    args.source.ledgerEntry.sourceMode === 'cube' ||
    args.source.ledgerEntry.solarPowerId !== args.source.cast.solarPowerId
  ) {
    throw new Error('Invalid recursive or mismatched Cube repeat source');
  }

  const result = resolveSolarCastSequence({
    state: args.state,
    playerId: args.playerId,
    declarationId: args.declarationId,
    battleTurnNumber: args.battleTurnNumber,
    initialEnergy: args.initialEnergy,
    casts: Array.from(
      { length: args.lockedCubeCount },
      () => structuredClone(args.source.cast),
    ),
    resolvers: args.resolvers,
    sourceMode: 'cube',
    initialLedgerOrder: args.initialLedgerOrder,
  });

  for (const repeat of result.ledgerEntries) {
    if (!metadataMatchesSource(repeat, args.source.ledgerEntry)) {
      throw new Error(
        `Cube repeat metadata drifted from source ${args.source.ledgerEntry.entryId}`,
      );
    }
  }
  return result;
}
