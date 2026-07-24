import type {
  AncientSolarDisplayEntry,
  AncientSolarDisplaySourceMode,
  LiveRowAncientSolarPowerId,
} from './types';
import type {
  AncientChargeDeclarationWorkflow,
  AncientManualSolarCast,
  FrozenAncientChargeDeclarationAttempt,
} from './ancientChargeDeclaration';
import { calculateAncientSiphonEffect } from '../../data/ancientSiphonRules';

const LIVE_ROW_ANCIENT_SOLAR_POWER_IDS = new Set<string>([
  'SLIF',
  'SSTA',
  'SAST',
  'SSUP',
  'SCON',
  'SSIP',
  'SVOR',
  'SBLA',
]);

const ANCIENT_SOLAR_DISPLAY_SOURCE_MODES = new Set<string>([
  'manual',
  'autocast',
  'cube',
]);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isLiveRowAncientSolarPowerId(
  value: unknown
): value is LiveRowAncientSolarPowerId {
  return typeof value === 'string' && LIVE_ROW_ANCIENT_SOLAR_POWER_IDS.has(value);
}

function isAncientSolarDisplaySourceMode(
  value: unknown
): value is AncientSolarDisplaySourceMode {
  return typeof value === 'string' && ANCIENT_SOLAR_DISPLAY_SOURCE_MODES.has(value);
}

function getAuthoritativeSiphonEffectCaption(record: Record<string, unknown>): number | undefined {
  if (record.solarPowerId !== 'SSIP' || !record.paidEnergy || typeof record.paidEnergy !== 'object') {
    return undefined;
  }

  const paidEnergy = record.paidEnergy as Record<string, unknown>;
  if (paidEnergy.red !== paidEnergy.green || paidEnergy.blue !== 0) {
    return undefined;
  }

  const expectedEffect = calculateAncientSiphonEffect(paidEnergy.green);
  return expectedEffect !== null && record.lockedAmount === expectedEffect
    ? record.lockedAmount
    : undefined;
}

function buildDisplayKey(args: {
  playerId: string;
  battleTurnNumber: number;
  sourceMode: AncientSolarDisplaySourceMode;
  order: number;
}): string {
  return `solar:${args.playerId}:${args.battleTurnNumber}:${args.sourceMode}:${args.order}`;
}

export function normalizeAuthoritativeAncientSolarEntries(args: {
  playerId: string | null | undefined;
  ledger: unknown;
}): AncientSolarDisplayEntry[] {
  if (!args.playerId || !args.ledger || typeof args.ledger !== 'object') {
    return [];
  }

  const ledger = args.ledger as Record<string, unknown>;
  const battleTurnNumber = ledger.battleTurnNumber;
  if (battleTurnNumber !== null && !isNonNegativeInteger(battleTurnNumber)) {
    return [];
  }
  if (!isNonNegativeInteger(battleTurnNumber) || !Array.isArray(ledger.entries)) {
    return [];
  }

  const candidates = ledger.entries.flatMap((entry, originalIndex) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    if (
      !isNonNegativeInteger(record.order) ||
      !isAncientSolarDisplaySourceMode(record.sourceMode) ||
      !isLiveRowAncientSolarPowerId(record.solarPowerId)
    ) {
      return [];
    }

    return [{
      originalIndex,
      order: record.order,
      sourceMode: record.sourceMode,
      solarPowerId: record.solarPowerId,
      effectCaption: getAuthoritativeSiphonEffectCaption(record),
    }];
  });

  candidates.sort((a, b) => a.order - b.order || a.originalIndex - b.originalIndex);

  const seenIdentities = new Set<string>();
  const entries: AncientSolarDisplayEntry[] = [];
  for (const candidate of candidates) {
    const identity = `${candidate.sourceMode}:${candidate.order}`;
    if (seenIdentities.has(identity)) continue;
    seenIdentities.add(identity);
    entries.push({
      displayKey: buildDisplayKey({
        playerId: args.playerId,
        battleTurnNumber,
        sourceMode: candidate.sourceMode,
        order: candidate.order,
      }),
      solarPowerId: candidate.solarPowerId,
      order: candidate.order,
      sourceMode: candidate.sourceMode,
      isLocalPreview: false,
      ...(candidate.effectCaption !== undefined
        ? { effectCaption: candidate.effectCaption }
        : {}),
    });
  }

  return entries;
}

function buildLocalManualEntries(args: {
  playerId: string;
  battleTurnNumber: number;
  casts: readonly AncientManualSolarCast[];
}): AncientSolarDisplayEntry[] {
  return args.casts.map((cast, order) => {
    const effectCaption = cast.solarPowerId === 'SSIP'
      ? calculateAncientSiphonEffect(cast.lockedAmount) ?? undefined
      : undefined;

    return {
      displayKey: buildDisplayKey({
        playerId: args.playerId,
        battleTurnNumber: args.battleTurnNumber,
        sourceMode: 'manual',
        order,
      }),
      solarPowerId: cast.solarPowerId,
      order,
      sourceMode: 'manual',
      isLocalPreview: true,
      ...(effectCaption !== undefined ? { effectCaption } : {}),
    };
  });
}

export function deriveAncientSolarDisplayEntries(args: {
  playerId: string | null | undefined;
  ledger: unknown;
  allowLocalPreview: boolean;
  currentBattleTurnNumber: number;
  currentWorkflowKey: string;
  workflow: AncientChargeDeclarationWorkflow | null;
  frozenAttempt: FrozenAncientChargeDeclarationAttempt | null;
  isAuthoritativelyReady: boolean;
}): AncientSolarDisplayEntry[] {
  const authoritativeEntries = normalizeAuthoritativeAncientSolarEntries({
    playerId: args.playerId,
    ledger: args.ledger,
  });

  if (
    !args.playerId ||
    !args.allowLocalPreview ||
    args.isAuthoritativelyReady ||
    !isNonNegativeInteger(args.currentBattleTurnNumber)
  ) {
    return authoritativeEntries;
  }

  const matchingWorkflow = args.workflow?.key === args.currentWorkflowKey
    ? args.workflow
    : null;
  const matchingAttempt = args.frozenAttempt?.workflowKey === args.currentWorkflowKey
    ? args.frozenAttempt
    : null;
  if (!matchingWorkflow && !matchingAttempt) {
    return authoritativeEntries;
  }

  const casts = matchingAttempt?.body.payload.solarCasts ?? matchingWorkflow?.localManualSolarCasts ?? [];
  return buildLocalManualEntries({
    playerId: args.playerId,
    battleTurnNumber: args.currentBattleTurnNumber,
    casts,
  });
}
