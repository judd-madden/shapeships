import { getShipDefinitionById, ENGINE_SHIP_DEFINITIONS } from '../../data/ShipDefinitions.engine';
import { isShipDefId, SHIP_DEFINITIONS_CORE_MAP } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import { deriveFleetStackInfo, sortFleetSummariesBySemanticOrder } from './fleets';
import type { BoardFleetSummary, EvolverChoiceId } from './types';

type BuildEconomySnapshot = {
  ordinaryLinesAvailable?: number | null;
  joiningLinesAvailable?: number | null;
};

const SAVED_LINE_CAP = 12;

type InternalFleetEntry = {
  rowId: string;
  shipDefId: ShipDefId;
  chargesCurrent: number;
  frigateTrigger?: number;
};

type DraftBuildEntry =
  | {
      shipDefId: ShipDefId;
      freeReason?: undefined;
      frigateTrigger?: number;
      rowId?: string;
    }
  | {
      shipDefId: 'ANT';
      freeReason: 'zenith_antlion';
      frigateTrigger?: undefined;
      rowId?: string;
    };

export interface ProvisionalBuildResult {
  draftCounts: Record<string, number>;
  isValid: boolean;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  projectedSavedOrdinaryLines: number;
  projectedSavedJoiningLines: number;
  projectedSavedCombinedLines: number;
  myFleetPreview: BoardFleetSummary[];
  provisionalShipCountsById: Partial<Record<ShipDefId, number>>;
  evolverRowIds: string[];
  canAddShipById: Partial<Record<ShipDefId, boolean>>;
  displayCostByShipId: Partial<Record<ShipDefId, number>>;
  eligibilityByShipId: Partial<Record<ShipDefId, ProvisionalShipEligibility>>;
}

export type ProvisionalShipEligibilityState =
  | 'CAN_BUILD'
  | 'NEED_COMPONENTS'
  | 'NOT_ENOUGH_LINES'
  | 'MAX_LIMIT'
  | 'RULE_RESTRICTED';

export type ProvisionalRestrictionReason =
  | 'FOREIGN_BASIC'
  | 'FOREIGN_INTERACTIVE_UPGRADE';

export interface ProvisionalShipEligibility {
  state: ProvisionalShipEligibilityState;
  missingComponentTokens?: string[];
  restrictionReason?: ProvisionalRestrictionReason;
}

const FIXED_BUILD_ORDER: ShipDefId[] = ENGINE_SHIP_DEFINITIONS.map((shipDef) => shipDef.id);
const BLOCKED_FOREIGN_INTERACTIVE_UPGRADE_IDS = new Set<ShipDefId>([
  'FRI',
  'GUA',
  'SAC',
  'KNO',
  'DOM',
]);

function toNonNegativeInt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function normalizeSpeciesId(value: unknown): SpeciesId | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'human':
    case 'xenite':
    case 'centaur':
    case 'ancient':
      return normalized;
    default:
      return null;
  }
}

function getForeignBuildRestriction(args: {
  nativeSpecies: SpeciesId | null | undefined;
  shipDefId: ShipDefId;
}): ProvisionalRestrictionReason | null {
  const shipDef = getShipDefinitionById(args.shipDefId);
  if (!shipDef) return null;

  const nativeSpecies = normalizeSpeciesId(args.nativeSpecies);
  const shipSpecies = normalizeSpeciesId(shipDef.species);

  if (!nativeSpecies || !shipSpecies || nativeSpecies === shipSpecies) {
    return null;
  }

  if (shipDef.basicCost) {
    return 'FOREIGN_BASIC';
  }

  if (shipDef.upgradedCost && BLOCKED_FOREIGN_INTERACTIVE_UPGRADE_IDS.has(args.shipDefId)) {
    return 'FOREIGN_INTERACTIVE_UPGRADE';
  }

  return null;
}

function normalizeChargesCurrent(ship: any, shipDefId: ShipDefId): number {
  const rawCharges = ship?.chargesCurrent;
  if (typeof rawCharges === 'number' && Number.isFinite(rawCharges)) {
    return Math.max(0, Math.floor(rawCharges));
  }

  const maxCharges = getShipDefinitionById(shipDefId)?.maxCharges ?? 0;
  return Math.max(0, maxCharges);
}

function buildAuthoritativeFleetEntries(
  ships: any[],
  frigateTriggerByInstanceId: Record<string, unknown>
): InternalFleetEntry[] {
  const entries: InternalFleetEntry[] = [];

  for (const ship of ships) {
    const rawShipDefId = String(ship?.shipDefId ?? '');
    if (!isShipDefId(rawShipDefId)) continue;

    const rowId = ship?.instanceId ?? ship?.id;
    if (typeof rowId !== 'string' || rowId.length === 0) continue;

    const frigateTriggerRaw = frigateTriggerByInstanceId?.[rowId];
    const frigateTrigger = Number.isInteger(frigateTriggerRaw)
      ? Math.max(1, Math.min(6, Number(frigateTriggerRaw)))
      : undefined;

    entries.push({
      rowId,
      shipDefId: rawShipDefId,
      chargesCurrent: normalizeChargesCurrent(ship, rawShipDefId),
      frigateTrigger,
    });
  }

  return entries;
}

function countShipsById(
  entries: InternalFleetEntry[]
): Partial<Record<ShipDefId, number>> {
  const counts: Partial<Record<ShipDefId, number>> = {};

  for (const entry of entries) {
    counts[entry.shipDefId] = (counts[entry.shipDefId] ?? 0) + 1;
  }

  return counts;
}

function countShipEntriesById(entries: InternalFleetEntry[], shipDefId: ShipDefId): number {
  let count = 0;

  for (const entry of entries) {
    if (entry.shipDefId === shipDefId) {
      count += 1;
    }
  }

  return count;
}

function getPrintedShipTotalLineCost(shipDefId: ShipDefId): number {
  const shipDef = SHIP_DEFINITIONS_CORE_MAP[shipDefId];
  const totalLineCost = Number(shipDef?.totalLineCost);
  return Number.isFinite(totalLineCost) && totalLineCost > 0 ? totalLineCost : 0;
}

function getComponentToken(shipId: ShipDefId, mustBeDepleted?: boolean): string {
  return mustBeDepleted ? `${shipId}(0)` : shipId;
}

function makePreviewRowId(
  shipDefId: ShipDefId,
  turnNumber: number,
  previewIndexByShipDefId: Partial<Record<ShipDefId, number>>
): string {
  const nextIndex = previewIndexByShipDefId[shipDefId] ?? 0;
  previewIndexByShipDefId[shipDefId] = nextIndex + 1;

  if (shipDefId === 'EVO') {
    return `preview_evo_${turnNumber}_${nextIndex}`;
  }

  return `preview_${shipDefId.toLowerCase()}_${turnNumber}_${nextIndex}`;
}

export function getDraftPreviewFrigateRowIds(
  turnNumber: number,
  frigateCount: number
): string[] {
  const previewIndexByShipDefId: Partial<Record<ShipDefId, number>> = {};
  const rowIds: string[] = [];
  const safeFrigateCount = Math.max(0, Math.floor(frigateCount));

  for (let index = 0; index < safeFrigateCount; index += 1) {
    rowIds.push(makePreviewRowId('FRI', turnNumber, previewIndexByShipDefId));
  }

  return rowIds;
}

function expandDraftBuildEntries(
  draftCounts: Record<string, number>,
  turnNumber: number,
  frigateSelectedTriggers: number[],
  frigatePreviewTriggerByRowId?: Record<string, number>
): DraftBuildEntry[] {
  const entries: DraftBuildEntry[] = [];
  const previewCountByShipDefId: Partial<Record<ShipDefId, number>> = {};
  const zenCount = toNonNegativeInt(draftCounts.ZEN);
  const antCount = toNonNegativeInt(draftCounts.ANT);
  const freeAntCount = Math.min(antCount, zenCount);
  const paidAntCount = Math.max(0, antCount - freeAntCount);
  const frigateRowIds = getDraftPreviewFrigateRowIds(turnNumber, toNonNegativeInt(draftCounts.FRI));
  let frigateIndex = 0;

  for (const shipDefId of FIXED_BUILD_ORDER) {
    const totalCount = toNonNegativeInt(draftCounts[shipDefId]);
    if (totalCount <= 0) continue;

    if (shipDefId === 'ANT') {
      for (let i = 0; i < paidAntCount; i++) {
        entries.push({ shipDefId: 'ANT' });
      }
      continue;
    }

    if (shipDefId === 'ZEN') {
      for (let i = 0; i < totalCount; i++) {
        entries.push({ shipDefId: 'ZEN' });
        if (i < freeAntCount) {
          entries.push({ shipDefId: 'ANT', freeReason: 'zenith_antlion' });
        }
      }
      continue;
    }

    if (shipDefId === 'FRI') {
      for (let i = 0; i < totalCount; i++) {
        const rowId =
          frigateRowIds[frigateIndex] ??
          makePreviewRowId(shipDefId, turnNumber, previewCountByShipDefId);
        const triggerRaw =
          frigatePreviewTriggerByRowId?.[rowId] ??
          frigateSelectedTriggers[frigateIndex] ??
          1;
        let frigateTrigger = Number(triggerRaw);
        if (!Number.isFinite(frigateTrigger)) frigateTrigger = 1;
        frigateTrigger = Math.max(1, Math.min(6, Math.floor(frigateTrigger)));
        frigateIndex += 1;

        entries.push({
          shipDefId,
          frigateTrigger,
          rowId,
        });
      }
      continue;
    }

    for (let i = 0; i < totalCount; i++) {
      entries.push({
        shipDefId,
        rowId: makePreviewRowId(shipDefId, turnNumber, previewCountByShipDefId),
      });
    }
  }

  return entries.map((entry) =>
    entry.rowId
      ? entry
      : {
          ...entry,
          rowId: makePreviewRowId(entry.shipDefId, turnNumber, previewCountByShipDefId),
        }
  );
}

function buildPreviewFleetSummary(
  entries: InternalFleetEntry[]
): BoardFleetSummary[] {
  const frigateTriggerByRowId: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.shipDefId === 'FRI' && Number.isInteger(entry.frigateTrigger)) {
      frigateTriggerByRowId[entry.rowId] = entry.frigateTrigger!;
    }
  }

  const buckets = new Map<
    string,
    {
      shipDefId: ShipDefId;
      count: number;
      condition?: 'charges_1' | 'charges_0';
      currentCharges?: number | null;
      caption?: string | null;
      memberInstanceIds: string[];
    }
  >();

  for (const entry of entries) {
    const stackInfo = deriveFleetStackInfo(
      {
        shipDefId: entry.shipDefId,
        instanceId: entry.rowId,
        chargesCurrent: entry.chargesCurrent,
      },
      frigateTriggerByRowId
    );

    if (!stackInfo) continue;

    const existing = buckets.get(stackInfo.stackKey);
    if (existing) {
      existing.count += 1;
      if (stackInfo.caption != null) {
        existing.caption = stackInfo.caption;
      }
      existing.memberInstanceIds.push(entry.rowId);
      continue;
    }

    buckets.set(stackInfo.stackKey, {
      shipDefId: stackInfo.shipDefId,
      count: 1,
      condition: stackInfo.condition,
      currentCharges: stackInfo.currentCharges ?? null,
      caption: stackInfo.caption ?? null,
      memberInstanceIds: [entry.rowId],
    });
  }

  return sortFleetSummariesBySemanticOrder(
    Array.from(buckets.entries()).map(([stackKey, bucket]) => ({
      shipDefId: bucket.shipDefId,
      count: bucket.count,
      stackKey,
      renderKey: `render__${stackKey}`,
      memberInstanceIds: [...bucket.memberInstanceIds],
      condition: bucket.condition,
      currentCharges: bucket.currentCharges ?? null,
      caption: bucket.caption ?? null,
    }))
  );
}

function reserveUpgradeComponents(
  entries: InternalFleetEntry[],
  shipDefId: ShipDefId
): number[] | null {
  const reservation = reserveUpgradeComponentsDetailed(entries, shipDefId, false);
  return reservation.missingComponentTokens.length > 0 ? null : reservation.reservedIndices;
}

function reserveUpgradeComponentsDetailed(
  entries: InternalFleetEntry[],
  shipDefId: ShipDefId,
  allowPartial: boolean
): {
  reservedIndices: number[];
  missingComponentTokens: string[];
  reservedComponentValue: number;
} {
  const shipDef = getShipDefinitionById(shipDefId);
  const upgradedCost = shipDef?.upgradedCost;
  if (!upgradedCost) {
    return {
      reservedIndices: [],
      missingComponentTokens: [],
      reservedComponentValue: 0,
    };
  }

  const reservedIndices = new Set<number>();
  const missingComponentTokens: string[] = [];
  let reservedComponentValue = 0;

  for (const component of upgradedCost.components) {
    for (let i = 0; i < component.quantity; i++) {
      const nextIndex = entries.findIndex((entry, index) => {
        if (reservedIndices.has(index)) return false;
        if (entry.shipDefId !== component.shipId) return false;
        if (component.mustBeDepleted && entry.chargesCurrent > 0) return false;
        return true;
      });

      if (nextIndex < 0) {
        missingComponentTokens.push(getComponentToken(component.shipId, component.mustBeDepleted));
        if (!allowPartial) {
          return {
            reservedIndices: [],
            missingComponentTokens,
            reservedComponentValue,
          };
        }
        continue;
      }

      reservedIndices.add(nextIndex);
      reservedComponentValue += getPrintedShipTotalLineCost(component.shipId);
    }
  }

  return {
    reservedIndices: Array.from(reservedIndices).sort((a, b) => a - b),
    missingComponentTokens,
    reservedComponentValue,
  };
}

function projectPersistedSavedResources(
  remainingOrdinaryLines: number,
  remainingJoiningLines: number
): {
  ordinaryLines: number;
  joiningLines: number;
  combinedLines: number;
} {
  const ordinaryLines = Math.max(0, Math.min(remainingOrdinaryLines, SAVED_LINE_CAP));
  const remainingCapacity = Math.max(0, SAVED_LINE_CAP - ordinaryLines);
  const joiningLines = Math.max(0, Math.min(remainingJoiningLines, remainingCapacity));

  return {
    ordinaryLines,
    joiningLines,
    combinedLines: ordinaryLines + joiningLines,
  };
}

function evaluateCatalogueEligibility(args: {
  nativeSpecies: SpeciesId | null | undefined;
  entries: InternalFleetEntry[];
  shipDefId: ShipDefId;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): {
  eligibility: ProvisionalShipEligibility;
  canAdd: boolean;
  displayCost: number;
} {
  const { entries, shipDefId, remainingOrdinaryLines, remainingJoiningLines } = args;
  const shipDef = getShipDefinitionById(shipDefId);
  const printedTotalCost = getPrintedShipTotalLineCost(shipDefId);
  const currentShipCount = countShipEntriesById(entries, shipDefId);
  const maxQuantityReached =
    typeof shipDef?.maxQuantity === 'number' && currentShipCount >= shipDef.maxQuantity;

  if (!shipDef) {
    return {
      eligibility: { state: 'NOT_ENOUGH_LINES' },
      canAdd: false,
      displayCost: printedTotalCost,
    };
  }

  const restrictionReason = getForeignBuildRestriction({
    nativeSpecies: args.nativeSpecies,
    shipDefId,
  });
  if (restrictionReason) {
    return {
      eligibility: {
        state: 'RULE_RESTRICTED',
        restrictionReason,
      },
      canAdd: false,
      displayCost: printedTotalCost,
    };
  }

  if (shipDef.basicCost) {
    const canAdd = remainingOrdinaryLines >= shipDef.basicCost.totalLines;
    return {
      eligibility: { state: maxQuantityReached ? 'MAX_LIMIT' : canAdd ? 'CAN_BUILD' : 'NOT_ENOUGH_LINES' },
      canAdd: !maxQuantityReached && canAdd,
      displayCost: shipDef.basicCost.totalLines,
    };
  }

  if (shipDef.upgradedCost) {
    const reservation = reserveUpgradeComponentsDetailed(entries, shipDefId, true);
    const displayCost = Math.max(0, printedTotalCost - reservation.reservedComponentValue);

    if (maxQuantityReached) {
      return {
        eligibility: { state: 'MAX_LIMIT' },
        canAdd: false,
        displayCost,
      };
    }

    if (reservation.missingComponentTokens.length > 0) {
      return {
        eligibility: {
          state: 'NEED_COMPONENTS',
          missingComponentTokens: reservation.missingComponentTokens,
        },
        canAdd: false,
        displayCost,
      };
    }

    const joiningCost = shipDef.upgradedCost.joiningLines;
    const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
    const ordinaryShortfall = joiningCost - joiningSpend;
    const canAdd = remainingOrdinaryLines >= ordinaryShortfall;

    return {
      eligibility: { state: canAdd ? 'CAN_BUILD' : 'NOT_ENOUGH_LINES' },
      canAdd,
      displayCost,
    };
  }

  return {
    eligibility: { state: 'NOT_ENOUGH_LINES' },
    canAdd: false,
    displayCost: printedTotalCost,
  };
}

function deriveCatalogueState(args: {
  nativeSpecies: SpeciesId | null | undefined;
  entries: InternalFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): Pick<
  ProvisionalBuildResult,
  'canAddShipById' | 'displayCostByShipId' | 'eligibilityByShipId'
> {
  const { entries, remainingOrdinaryLines, remainingJoiningLines } = args;
  const canAddShipById: Partial<Record<ShipDefId, boolean>> = {};
  const displayCostByShipId: Partial<Record<ShipDefId, number>> = {};
  const eligibilityByShipId: Partial<Record<ShipDefId, ProvisionalShipEligibility>> = {};

  for (const shipDef of ENGINE_SHIP_DEFINITIONS) {
    const evaluated = evaluateCatalogueEligibility({
      nativeSpecies: args.nativeSpecies,
      entries,
      shipDefId: shipDef.id,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    canAddShipById[shipDef.id] = evaluated.canAdd;
    displayCostByShipId[shipDef.id] = evaluated.displayCost;
    eligibilityByShipId[shipDef.id] = evaluated.eligibility;
  }

  return {
    canAddShipById,
    displayCostByShipId,
    eligibilityByShipId,
  };
}

function applyEvolverPreviewParity(args: {
  entries: InternalFleetEntry[];
  evolverRowIds: string[];
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  turnNumber: number;
}): InternalFleetEntry[] {
  const { entries, evolverRowIds, evolverChoicesByRowId, turnNumber } = args;
  const nextEntries = [...entries];
  let previewEvolutionIndex = 0;

  for (const rowId of evolverRowIds) {
    const choiceId = evolverChoicesByRowId[rowId] ?? 'hold';
    if (choiceId !== 'oxite' && choiceId !== 'asterite') continue;

    const xenIndex = nextEntries.findIndex((entry) => entry.shipDefId === 'XEN');
    if (xenIndex < 0) break;

    nextEntries.splice(xenIndex, 1);
    nextEntries.push({
      rowId: `preview_evolve_${turnNumber}_${previewEvolutionIndex++}`,
      shipDefId: choiceId === 'oxite' ? 'OXI' : 'AST',
      chargesCurrent: 0,
    });
  }

  return nextEntries;
}

function deriveActionableEvolverRowIds(entries: InternalFleetEntry[]): string[] {
  const eligibleXenCount = entries.filter((entry) => entry.shipDefId === 'XEN').length;
  if (eligibleXenCount <= 0) {
    return [];
  }

  return entries
    .filter((entry) => entry.shipDefId === 'EVO')
    .slice(0, eligibleXenCount)
    .map((entry) => entry.rowId);
}

function isUpgradedDraftBuildEntry(buildEntry: DraftBuildEntry): boolean {
  return Boolean(getShipDefinitionById(buildEntry.shipDefId)?.upgradedCost);
}

type FutureDemandContext = {
  nativeSpecies: SpeciesId | null | undefined;
  turnNumber: number;
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  upgradedEntries: DraftBuildEntry[];
};

function partitionDraftBuildEntries(draftBuildEntries: DraftBuildEntry[]): {
  nonUpgradedEntries: DraftBuildEntry[];
  upgradedEntries: DraftBuildEntry[];
} {
  const nonUpgradedEntries: DraftBuildEntry[] = [];
  const upgradedEntries: DraftBuildEntry[] = [];

  for (const buildEntry of draftBuildEntries) {
    if (isUpgradedDraftBuildEntry(buildEntry)) {
      upgradedEntries.push(buildEntry);
      continue;
    }

    nonUpgradedEntries.push(buildEntry);
  }

  return {
    nonUpgradedEntries,
    upgradedEntries,
  };
}

function cloneInternalFleetEntries(entries: InternalFleetEntry[]): InternalFleetEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function applyBasicDraftBuildEntry(args: {
  nativeSpecies: SpeciesId | null | undefined;
  buildEntry: DraftBuildEntry;
  workingFleetEntries: InternalFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): {
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  didApply: boolean;
} {
  const { buildEntry, workingFleetEntries } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  const shipDef = getShipDefinitionById(buildEntry.shipDefId);

  if (!shipDef?.basicCost) {
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
      didApply: false,
    };
  }

  if (
    getForeignBuildRestriction({
      nativeSpecies: args.nativeSpecies,
      shipDefId: buildEntry.shipDefId,
    })
  ) {
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
      didApply: false,
    };
  }

  const ordinaryCost = buildEntry.freeReason === 'zenith_antlion'
    ? 0
    : shipDef.basicCost.totalLines;

  if (remainingOrdinaryLines < ordinaryCost) {
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
      didApply: false,
    };
  }

  remainingOrdinaryLines -= ordinaryCost;
  workingFleetEntries.push({
    rowId: buildEntry.rowId!,
    shipDefId: buildEntry.shipDefId,
    chargesCurrent: shipDef.maxCharges ?? 0,
    frigateTrigger: buildEntry.frigateTrigger,
  });

  if (buildEntry.shipDefId === 'LEG') {
    remainingJoiningLines += 4;
  }

  return {
    remainingOrdinaryLines,
    remainingJoiningLines,
    didApply: true,
  };
}

function simulateResolvedUpgradedDemand(args: {
  nativeSpecies: SpeciesId | null | undefined;
  targetShipDefId: ShipDefId;
  upgradedEntries: DraftBuildEntry[];
  workingFleetEntries: InternalFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): number {
  const {
    targetShipDefId,
    upgradedEntries,
    workingFleetEntries,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  let freeingDemand = 0;

  for (const buildEntry of upgradedEntries) {
    const shipDef = getShipDefinitionById(buildEntry.shipDefId);
    if (!shipDef?.upgradedCost) {
      continue;
    }

    if (
      getForeignBuildRestriction({
        nativeSpecies: args.nativeSpecies,
        shipDefId: buildEntry.shipDefId,
      })
    ) {
      continue;
    }

    const currentShipCount = countShipEntriesById(workingFleetEntries, buildEntry.shipDefId);
    if (
      typeof shipDef.maxQuantity === 'number' &&
      currentShipCount >= shipDef.maxQuantity
    ) {
      continue;
    }

    const reservedComponentIndices = reserveUpgradeComponents(
      workingFleetEntries,
      buildEntry.shipDefId
    );

    if (reservedComponentIndices == null) {
      continue;
    }

    const joiningCost = shipDef.upgradedCost.joiningLines;
    const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
    const ordinaryShortfall = joiningCost - joiningSpend;

    if (remainingOrdinaryLines < ordinaryShortfall) {
      continue;
    }

    freeingDemand += reservedComponentIndices.reduce((count, reservedIndex) => {
      return count + (workingFleetEntries[reservedIndex]?.shipDefId === targetShipDefId ? 1 : 0);
    }, 0);

    for (let i = reservedComponentIndices.length - 1; i >= 0; i--) {
      workingFleetEntries.splice(reservedComponentIndices[i], 1);
    }

    remainingJoiningLines -= joiningSpend;
    remainingOrdinaryLines -= ordinaryShortfall;
    workingFleetEntries.push({
      rowId: buildEntry.rowId!,
      shipDefId: buildEntry.shipDefId,
      chargesCurrent: shipDef.maxCharges ?? 0,
      frigateTrigger: buildEntry.frigateTrigger,
    });
  }

  return freeingDemand;
}

function simulateFutureResolvedUpgradedDemandForBasicAttempt(args: {
  targetShipDefId: ShipDefId;
  currentBuildEntry: DraftBuildEntry;
  remainingNonUpgradedEntries: DraftBuildEntry[];
  futureDemandContext: FutureDemandContext;
  workingFleetEntries: InternalFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): number {
  const {
    targetShipDefId,
    currentBuildEntry,
    remainingNonUpgradedEntries,
    futureDemandContext,
    workingFleetEntries,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  const simulatedWorkingFleetEntries = cloneInternalFleetEntries(workingFleetEntries);

  const currentAttemptResolution = applyBasicDraftBuildEntry({
    nativeSpecies: futureDemandContext.nativeSpecies,
    buildEntry: currentBuildEntry,
    workingFleetEntries: simulatedWorkingFleetEntries,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });

  if (!currentAttemptResolution.didApply) {
    return 0;
  }

  remainingOrdinaryLines = currentAttemptResolution.remainingOrdinaryLines;
  remainingJoiningLines = currentAttemptResolution.remainingJoiningLines;

  const remainingBasicStageResolution = resolveDraftBuildStage({
    nativeSpecies: futureDemandContext.nativeSpecies,
    buildEntries: remainingNonUpgradedEntries,
    workingFleetEntries: simulatedWorkingFleetEntries,
    remainingOrdinaryLines,
    remainingJoiningLines,
    futureDemandContext,
  });

  if (!remainingBasicStageResolution.isStageValid) {
    return 0;
  }

  const evolverRowIds = deriveActionableEvolverRowIds(simulatedWorkingFleetEntries);

  const postEvolverFleetEntries = applyEvolverPreviewParity({
    entries: simulatedWorkingFleetEntries,
    evolverRowIds,
    evolverChoicesByRowId: futureDemandContext.evolverChoicesByRowId,
    turnNumber: futureDemandContext.turnNumber,
  });

  return simulateResolvedUpgradedDemand({
    nativeSpecies: futureDemandContext.nativeSpecies,
    targetShipDefId,
    upgradedEntries: futureDemandContext.upgradedEntries,
    workingFleetEntries: postEvolverFleetEntries,
    remainingOrdinaryLines: remainingBasicStageResolution.remainingOrdinaryLines,
    remainingJoiningLines: remainingBasicStageResolution.remainingJoiningLines,
  });
}

function resolveDraftBuildStage(args: {
  nativeSpecies: SpeciesId | null | undefined;
  buildEntries: DraftBuildEntry[];
  workingFleetEntries: InternalFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  futureDemandContext?: FutureDemandContext;
}): {
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  isStageValid: boolean;
} {
  const {
    buildEntries,
    workingFleetEntries,
    futureDemandContext,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  let isStageValid = true;

  for (let buildEntryIndex = 0; buildEntryIndex < buildEntries.length; buildEntryIndex += 1) {
    const buildEntry = buildEntries[buildEntryIndex];
    const shipDef = getShipDefinitionById(buildEntry.shipDefId);
    if (!shipDef) {
      isStageValid = false;
      break;
    }

    if (
      getForeignBuildRestriction({
        nativeSpecies: args.nativeSpecies,
        shipDefId: buildEntry.shipDefId,
      })
    ) {
      isStageValid = false;
      break;
    }

    const maxQuantity = shipDef.maxQuantity;
    const currentShipCount = countShipEntriesById(workingFleetEntries, buildEntry.shipDefId);
    let maxQuantityReached =
      typeof maxQuantity === 'number' &&
      currentShipCount >= maxQuantity;

    if (maxQuantityReached && shipDef.basicCost && futureDemandContext && typeof maxQuantity === 'number') {
      const freeingDemand = simulateFutureResolvedUpgradedDemandForBasicAttempt({
        targetShipDefId: buildEntry.shipDefId,
        currentBuildEntry: buildEntry,
        remainingNonUpgradedEntries: buildEntries.slice(buildEntryIndex + 1),
        futureDemandContext,
        workingFleetEntries,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });
      maxQuantityReached = currentShipCount - freeingDemand >= maxQuantity;
    }

    if (maxQuantityReached) {
      isStageValid = false;
      break;
    }

    if (shipDef.basicCost) {
      const basicResolution = applyBasicDraftBuildEntry({
        nativeSpecies: args.nativeSpecies,
        buildEntry,
        workingFleetEntries,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });

      if (!basicResolution.didApply) {
        isStageValid = false;
        break;
      }

      remainingOrdinaryLines = basicResolution.remainingOrdinaryLines;
      remainingJoiningLines = basicResolution.remainingJoiningLines;

      continue;
    }

    if (shipDef.upgradedCost) {
      const reservedComponentIndices = reserveUpgradeComponents(
        workingFleetEntries,
        buildEntry.shipDefId
      );

      if (reservedComponentIndices == null) {
        isStageValid = false;
        break;
      }

      const joiningCost = shipDef.upgradedCost.joiningLines;
      const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
      const ordinaryShortfall = joiningCost - joiningSpend;

      if (remainingOrdinaryLines < ordinaryShortfall) {
        isStageValid = false;
        break;
      }

      for (let i = reservedComponentIndices.length - 1; i >= 0; i--) {
        workingFleetEntries.splice(reservedComponentIndices[i], 1);
      }

      remainingJoiningLines -= joiningSpend;
      remainingOrdinaryLines -= ordinaryShortfall;
      workingFleetEntries.push({
        rowId: buildEntry.rowId!,
        shipDefId: buildEntry.shipDefId,
        chargesCurrent: shipDef.maxCharges ?? 0,
        frigateTrigger: buildEntry.frigateTrigger,
      });
      continue;
    }

    isStageValid = false;
    break;
  }

  return {
    remainingOrdinaryLines,
    remainingJoiningLines,
    isStageValid,
  };
}

export function addShipToBuildDraft(
  draftCounts: Record<string, number>,
  shipDefId: ShipDefId
): Record<string, number> {
  const nextDraft = { ...draftCounts };
  nextDraft[shipDefId] = (draftCounts[shipDefId] || 0) + 1;

  if (shipDefId === 'ZEN') {
    nextDraft.ANT = (draftCounts.ANT || 0) + 1;
  }

  return nextDraft;
}

export function evaluateProvisionalBuild(args: {
  turnNumber: number;
  myShips: any[];
  draftCounts: Record<string, number>;
  nativeSpecies: SpeciesId | null | undefined;
  buildEconomy: BuildEconomySnapshot | null | undefined;
  frigateSelectedTriggers: number[];
  frigatePreviewTriggerByRowId?: Record<string, number>;
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  frigateTriggerByInstanceId?: Record<string, unknown>;
}): ProvisionalBuildResult {
  const {
    turnNumber,
    myShips,
    draftCounts,
    nativeSpecies,
    buildEconomy,
    frigateSelectedTriggers,
    frigatePreviewTriggerByRowId,
    evolverChoicesByRowId,
    frigateTriggerByInstanceId = {},
  } = args;

  let remainingOrdinaryLines = toNonNegativeInt(buildEconomy?.ordinaryLinesAvailable);
  let remainingJoiningLines = toNonNegativeInt(buildEconomy?.joiningLinesAvailable);
  let isValid = true;

  let workingFleetEntries = buildAuthoritativeFleetEntries(myShips, frigateTriggerByInstanceId);
  const draftBuildEntries = expandDraftBuildEntries(
    draftCounts,
    turnNumber,
    frigateSelectedTriggers,
    frigatePreviewTriggerByRowId
  );
  const { nonUpgradedEntries, upgradedEntries } = partitionDraftBuildEntries(draftBuildEntries);
  const basicStageResolution = resolveDraftBuildStage({
    nativeSpecies,
    buildEntries: nonUpgradedEntries,
    workingFleetEntries,
    remainingOrdinaryLines,
    remainingJoiningLines,
    futureDemandContext: {
      nativeSpecies,
      turnNumber,
      evolverChoicesByRowId,
      upgradedEntries,
    },
  });
  remainingOrdinaryLines = basicStageResolution.remainingOrdinaryLines;
  remainingJoiningLines = basicStageResolution.remainingJoiningLines;
  isValid = basicStageResolution.isStageValid && isValid;

  const evolverRowIds = deriveActionableEvolverRowIds(workingFleetEntries);

  workingFleetEntries = applyEvolverPreviewParity({
    entries: workingFleetEntries,
    evolverRowIds,
    evolverChoicesByRowId,
    turnNumber,
  });
  const upgradedStageResolution = resolveDraftBuildStage({
    nativeSpecies,
    buildEntries: upgradedEntries,
    workingFleetEntries,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });
  remainingOrdinaryLines = upgradedStageResolution.remainingOrdinaryLines;
  remainingJoiningLines = upgradedStageResolution.remainingJoiningLines;
  isValid = upgradedStageResolution.isStageValid && isValid;

  const catalogueState = deriveCatalogueState({
    nativeSpecies,
    entries: workingFleetEntries,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });
  const projectedSavedResources = projectPersistedSavedResources(
    remainingOrdinaryLines,
    remainingJoiningLines
  );

  return {
    draftCounts,
    isValid,
    remainingOrdinaryLines,
    remainingJoiningLines,
    projectedSavedOrdinaryLines: projectedSavedResources.ordinaryLines,
    projectedSavedJoiningLines: projectedSavedResources.joiningLines,
    projectedSavedCombinedLines: projectedSavedResources.combinedLines,
    myFleetPreview: buildPreviewFleetSummary(workingFleetEntries),
    provisionalShipCountsById: countShipsById(workingFleetEntries),
    evolverRowIds,
    canAddShipById: catalogueState.canAddShipById,
    displayCostByShipId: catalogueState.displayCostByShipId,
    eligibilityByShipId: catalogueState.eligibilityByShipId,
  };
}

export function canProvisionallyAddShip(args: {
  turnNumber: number;
  myShips: any[];
  draftCounts: Record<string, number>;
  shipDefId: ShipDefId;
  nativeSpecies: SpeciesId | null | undefined;
  buildEconomy: BuildEconomySnapshot | null | undefined;
  frigateSelectedTriggers: number[];
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  frigateTriggerByInstanceId?: Record<string, unknown>;
}): boolean {
  const provisionalBuild = evaluateProvisionalBuild({
    turnNumber: args.turnNumber,
    myShips: args.myShips,
    draftCounts: args.draftCounts,
    nativeSpecies: args.nativeSpecies,
    buildEconomy: args.buildEconomy,
    frigateSelectedTriggers: args.frigateSelectedTriggers,
    evolverChoicesByRowId: args.evolverChoicesByRowId,
    frigateTriggerByInstanceId: args.frigateTriggerByInstanceId,
  });

  return toNonNegativeInt(args.draftCounts[args.shipDefId]) > 0 && provisionalBuild.isValid;
}
