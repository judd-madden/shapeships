import type {
  AncientSolarDisplayEntry,
  AncientSolarDisplaySourceMode,
  AncientSimulacrumDisplayPresentation,
  LiveRowAncientSolarPowerId,
} from './types';
import type { AncientManualSolarCast } from './ancientChargeDeclaration';
import { calculateAncientSiphonEffect } from '../../data/ancientSiphonRules';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { ShipType } from '../../types/ShipTypes.engine';

const LIVE_ROW_ANCIENT_SOLAR_POWER_IDS = new Set<string>([
  'SLIF',
  'SSTA',
  'SAST',
  'SSUP',
  'SCON',
  'SSIP',
  'SVOR',
  'SBLA',
  'SSIM',
]);

const ANCIENT_SOLAR_DISPLAY_SOURCE_MODES = new Set<string>([
  'manual',
  'autocast',
]);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isLiveRowAncientSolarPowerId(
  value: unknown
): value is LiveRowAncientSolarPowerId {
  return typeof value === 'string' && LIVE_ROW_ANCIENT_SOLAR_POWER_IDS.has(value);
}

function isAncientSolarDisplaySourceMode(
  value: unknown
): value is AncientSolarDisplaySourceMode {
  return typeof value === 'string' && ANCIENT_SOLAR_DISPLAY_SOURCE_MODES.has(value);
}

function normalizeTargetMarkerInstanceIds(values: readonly unknown[]): string[] {
  return Array.from(new Set(
    values.filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )
  ));
}

function getAuthoritativeTargetMarker(
  record: Record<string, unknown>
): AncientSolarDisplayEntry['targetMarker'] {
  if (record.solarPowerId === 'SSIM') {
    const simulacrum =
      record.simulacrum &&
      typeof record.simulacrum === 'object' &&
      !Array.isArray(record.simulacrum)
        ? record.simulacrum as Record<string, unknown>
        : null;
    const targetInstanceIds = normalizeTargetMarkerInstanceIds([
      simulacrum?.sourceTargetInstanceId,
    ]);
    return targetInstanceIds.length > 0
      ? { tone: 'cyan', targetInstanceIds }
      : undefined;
  }

  if (record.solarPowerId === 'SBLA') {
    const targetInstanceIds = normalizeTargetMarkerInstanceIds(
      Array.isArray(record.targets)
        ? record.targets.map((target) =>
            target && typeof target === 'object' && !Array.isArray(target)
              ? (target as Record<string, unknown>).shipInstanceId
              : undefined
          )
        : []
    );
    return targetInstanceIds.length > 0
      ? { tone: 'red', targetInstanceIds }
      : undefined;
  }

  return undefined;
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

function normalizeSimulacrumDisplayPresentation(args: {
  copiedShipDefId: unknown;
  capturedStartOfBattleCharges: unknown;
  permanentConfiguration: unknown;
}): AncientSimulacrumDisplayPresentation | null {
  if (
    typeof args.copiedShipDefId !== 'string' ||
    !isShipDefId(args.copiedShipDefId)
  ) {
    return null;
  }

  const definition = getShipDefinitionById(args.copiedShipDefId);
  if (definition?.type !== ShipType.BASIC) {
    return null;
  }

  const maxCharges = definition.maxCharges ?? 0;
  const capturedStartOfBattleCharges =
    isNonNegativeInteger(args.capturedStartOfBattleCharges) &&
    (
      maxCharges > 0
        ? args.capturedStartOfBattleCharges <= maxCharges
        : args.capturedStartOfBattleCharges === 0
    )
      ? args.capturedStartOfBattleCharges
      : undefined;

  const permanentConfiguration =
    args.permanentConfiguration &&
    typeof args.permanentConfiguration === 'object' &&
    !Array.isArray(args.permanentConfiguration)
      ? args.permanentConfiguration as Record<string, unknown>
      : null;
  const rawSelectedNumber = permanentConfiguration?.selectedNumber;
  const selectedNumber =
    args.copiedShipDefId === 'QUA' &&
    typeof rawSelectedNumber === 'number' &&
    Number.isInteger(rawSelectedNumber) &&
    rawSelectedNumber >= 1 &&
    rawSelectedNumber <= 6
      ? rawSelectedNumber
      : undefined;

  return {
    copiedShipDefId: args.copiedShipDefId,
    ...(capturedStartOfBattleCharges !== undefined
      ? { capturedStartOfBattleCharges }
      : {}),
    ...(selectedNumber !== undefined ? { selectedNumber } : {}),
  };
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

    const simulacrumPresentation = record.solarPowerId === 'SSIM'
      ? (
          record.simulacrum &&
          typeof record.simulacrum === 'object' &&
          !Array.isArray(record.simulacrum)
            ? normalizeSimulacrumDisplayPresentation({
                copiedShipDefId: (record.simulacrum as Record<string, unknown>)
                  .copiedShipDefId,
                capturedStartOfBattleCharges:
                  (record.simulacrum as Record<string, unknown>)
                    .capturedStartOfBattleCharges,
                permanentConfiguration:
                  (record.simulacrum as Record<string, unknown>)
                    .permanentConfiguration,
              })
            : null
        )
      : undefined;
    if (record.solarPowerId === 'SSIM' && !simulacrumPresentation) {
      return [];
    }

    return [{
      originalIndex,
      authoritativeLedgerEntryId:
        typeof record.entryId === 'string' && record.entryId.length > 0
          ? record.entryId
          : undefined,
      order: record.order,
      sourceMode: record.sourceMode,
      solarPowerId: record.solarPowerId,
      effectCaption: getAuthoritativeSiphonEffectCaption(record),
      simulacrumPresentation,
      targetMarker: getAuthoritativeTargetMarker(record),
    }];
  });

  candidates.sort((a, b) => a.order - b.order || a.originalIndex - b.originalIndex);

  const seenIdentities = new Set<string>();
  const entries: AncientSolarDisplayEntry[] = [];
  for (const candidate of candidates) {
    const identity = `${candidate.sourceMode}:${candidate.order}`;
    if (seenIdentities.has(identity)) continue;
    seenIdentities.add(identity);
    const baseEntry = {
      displayKey: buildDisplayKey({
        playerId: args.playerId,
        battleTurnNumber,
        sourceMode: candidate.sourceMode,
        order: candidate.order,
      }),
      authoritativeLedgerEntryId: candidate.authoritativeLedgerEntryId,
      solarPowerId: candidate.solarPowerId,
      order: candidate.order,
      sourceMode: candidate.sourceMode,
      isLocalPreview: false,
      ...(candidate.targetMarker
        ? {
            targetMarker: {
              tone: candidate.targetMarker.tone,
              targetInstanceIds: [...candidate.targetMarker.targetInstanceIds],
            },
          }
        : {}),
    } as const;
    if (
      candidate.solarPowerId === 'SSIM' &&
      candidate.simulacrumPresentation
    ) {
      entries.push({
        ...baseEntry,
        solarPowerId: 'SSIM',
        simulacrumPresentation: candidate.simulacrumPresentation,
      });
    } else if (candidate.solarPowerId !== 'SSIM') {
      entries.push({
        ...baseEntry,
        solarPowerId: candidate.solarPowerId,
        ...(candidate.effectCaption !== undefined
          ? { effectCaption: candidate.effectCaption }
          : {}),
      });
    }
  }

  return entries;
}

function buildLocalManualEntries(args: {
  playerId: string;
  battleTurnNumber: number;
  casts: readonly AncientManualSolarCast[];
}): AncientSolarDisplayEntry[] {
  return args.casts.flatMap<AncientSolarDisplayEntry>((cast, order) => {
    if (!isLiveRowAncientSolarPowerId(cast.solarPowerId)) {
      return [];
    }
    const baseEntry = {
      displayKey: buildDisplayKey({
        playerId: args.playerId,
        battleTurnNumber: args.battleTurnNumber,
        sourceMode: 'manual',
        order,
      }),
      order,
      sourceMode: 'manual' as const,
      isLocalPreview: true,
    };
    if (cast.solarPowerId === 'SSIM') {
      if (!('copiedShipDefId' in cast)) {
        return [];
      }
      const targetInstanceIds = normalizeTargetMarkerInstanceIds([
        cast.targetInstanceId,
      ]);
      const simulacrumPresentation = normalizeSimulacrumDisplayPresentation({
        copiedShipDefId: cast.copiedShipDefId,
        capturedStartOfBattleCharges:
          cast.previewCapturedStartOfBattleCharges,
        permanentConfiguration: cast.previewPermanentConfiguration,
      });
      return simulacrumPresentation
        ? [{
            ...baseEntry,
            solarPowerId: 'SSIM' as const,
            simulacrumPresentation,
            ...(targetInstanceIds.length > 0
              ? {
                  targetMarker: {
                    tone: 'cyan' as const,
                    targetInstanceIds: [...targetInstanceIds],
                  },
                }
              : {}),
          }]
        : [];
    }

    const effectCaption = cast.solarPowerId === 'SSIP'
      ? calculateAncientSiphonEffect(cast.lockedAmount) ?? undefined
      : undefined;
    const targetInstanceIds = cast.solarPowerId === 'SBLA'
      ? normalizeTargetMarkerInstanceIds(cast.targetInstanceIds)
      : [];

    return [{
      ...baseEntry,
      solarPowerId: cast.solarPowerId,
      ...(effectCaption !== undefined ? { effectCaption } : {}),
      ...(cast.solarPowerId === 'SBLA' && targetInstanceIds.length > 0
        ? {
            targetMarker: {
              tone: 'red' as const,
              targetInstanceIds: [...targetInstanceIds],
            },
          }
        : {}),
    }];
  });
}

export function deriveAncientSolarDisplayEntries(args: {
  playerId: string | null | undefined;
  ledger: unknown;
  allowLocalPreview: boolean;
  currentBattleTurnNumber: number;
  localPreviewCasts: readonly AncientManualSolarCast[];
  isAuthoritativelyReady: boolean;
  suppressedAuthoritativeLedgerEntryIds?: ReadonlySet<string>;
}): AncientSolarDisplayEntry[] {
  const authoritativeEntries = normalizeAuthoritativeAncientSolarEntries({
    playerId: args.playerId,
    ledger: args.ledger,
  });
  const visibleAuthoritativeEntries = args.suppressedAuthoritativeLedgerEntryIds
    ? authoritativeEntries.filter((entry) =>
        entry.solarPowerId !== 'SSIM' ||
        entry.authoritativeLedgerEntryId == null ||
        !args.suppressedAuthoritativeLedgerEntryIds!.has(
          entry.authoritativeLedgerEntryId
        )
      )
    : authoritativeEntries;

  if (
    !args.playerId ||
    !args.allowLocalPreview ||
    args.isAuthoritativelyReady ||
    !isNonNegativeInteger(args.currentBattleTurnNumber)
  ) {
    return visibleAuthoritativeEntries;
  }

  if (args.localPreviewCasts.length === 0) {
    return visibleAuthoritativeEntries;
  }

  return buildLocalManualEntries({
    playerId: args.playerId,
    battleTurnNumber: args.currentBattleTurnNumber,
    casts: args.localPreviewCasts,
  });
}
