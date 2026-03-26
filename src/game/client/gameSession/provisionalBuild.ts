import { getShipDefinitionById, ENGINE_SHIP_DEFINITIONS } from '../../data/ShipDefinitions.engine';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { deriveFleetStackInfo } from './fleets';
import type { BoardFleetSummary, EvolverChoiceId } from './types';

type BuildEconomySnapshot = {
  ordinaryLinesAvailable?: number | null;
  joiningLinesAvailable?: number | null;
};

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
  myFleetPreview: BoardFleetSummary[];
  provisionalShipCountsById: Partial<Record<ShipDefId, number>>;
  evolverRowIds: string[];
}

const FIXED_BUILD_ORDER: ShipDefId[] = ENGINE_SHIP_DEFINITIONS.map((shipDef) => shipDef.id);

function toNonNegativeInt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
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

function expandDraftBuildEntries(
  draftCounts: Record<string, number>,
  turnNumber: number,
  frigateSelectedTriggers: number[]
): DraftBuildEntry[] {
  const entries: DraftBuildEntry[] = [];
  const previewCountByShipDefId: Partial<Record<ShipDefId, number>> = {};
  const zenCount = toNonNegativeInt(draftCounts.ZEN);
  const antCount = toNonNegativeInt(draftCounts.ANT);
  const freeAntCount = Math.min(antCount, zenCount);
  const paidAntCount = Math.max(0, antCount - freeAntCount);
  let frigateCursor = 0;

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
        const triggerRaw = frigateSelectedTriggers[frigateCursor] ?? 1;
        let frigateTrigger = Number(triggerRaw);
        if (!Number.isFinite(frigateTrigger)) frigateTrigger = 1;
        frigateTrigger = Math.max(1, Math.min(6, Math.floor(frigateTrigger)));
        frigateCursor += 1;

        entries.push({
          shipDefId,
          frigateTrigger,
          rowId: makePreviewRowId(shipDefId, turnNumber, previewCountByShipDefId),
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
      continue;
    }

    buckets.set(stackInfo.stackKey, {
      shipDefId: stackInfo.shipDefId,
      count: 1,
      condition: stackInfo.condition,
      currentCharges: stackInfo.currentCharges ?? null,
      caption: stackInfo.caption ?? null,
    });
  }

  const summary: BoardFleetSummary[] = Array.from(buckets.entries()).map(([stackKey, bucket]) => ({
    shipDefId: bucket.shipDefId,
    count: bucket.count,
    stackKey,
    condition: bucket.condition,
    currentCharges: bucket.currentCharges ?? null,
    caption: bucket.caption ?? null,
  }));

  summary.sort((a, b) => {
    if (a.shipDefId !== b.shipDefId) {
      return a.shipDefId.localeCompare(b.shipDefId);
    }

    const aIsActive = a.stackKey.includes('__inst_');
    const bIsActive = b.stackKey.includes('__inst_');
    const aIsCharged = a.condition === 'charges_1';
    const bIsCharged = b.condition === 'charges_1';
    const aIsDepleted = a.condition === 'charges_0';
    const bIsDepleted = b.condition === 'charges_0';

    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    if (aIsCharged && !bIsCharged) return -1;
    if (!aIsCharged && bIsCharged) return 1;
    if (aIsDepleted && !bIsDepleted) return 1;
    if (!aIsDepleted && bIsDepleted) return -1;

    return a.stackKey.localeCompare(b.stackKey);
  });

  return summary;
}

function reserveUpgradeComponents(
  entries: InternalFleetEntry[],
  shipDefId: ShipDefId
): number[] | null {
  const shipDef = getShipDefinitionById(shipDefId);
  const upgradedCost = shipDef?.upgradedCost;
  if (!upgradedCost) return [];

  const reservedIndices = new Set<number>();

  for (const component of upgradedCost.components) {
    for (let i = 0; i < component.quantity; i++) {
      const nextIndex = entries.findIndex((entry, index) => {
        if (reservedIndices.has(index)) return false;
        if (entry.shipDefId !== component.shipId) return false;
        if (component.mustBeDepleted && entry.chargesCurrent > 0) return false;
        return true;
      });

      if (nextIndex < 0) {
        return null;
      }

      reservedIndices.add(nextIndex);
    }
  }

  return Array.from(reservedIndices).sort((a, b) => a - b);
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
  buildEconomy: BuildEconomySnapshot | null | undefined;
  frigateSelectedTriggers: number[];
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  frigateTriggerByInstanceId?: Record<string, unknown>;
}): ProvisionalBuildResult {
  const {
    turnNumber,
    myShips,
    draftCounts,
    buildEconomy,
    frigateSelectedTriggers,
    evolverChoicesByRowId,
    frigateTriggerByInstanceId = {},
  } = args;

  let remainingOrdinaryLines = toNonNegativeInt(buildEconomy?.ordinaryLinesAvailable);
  let remainingJoiningLines = toNonNegativeInt(buildEconomy?.joiningLinesAvailable);
  let isValid = true;

  const workingFleetEntries = buildAuthoritativeFleetEntries(myShips, frigateTriggerByInstanceId);
  const draftBuildEntries = expandDraftBuildEntries(draftCounts, turnNumber, frigateSelectedTriggers);

  for (const buildEntry of draftBuildEntries) {
    const shipDef = getShipDefinitionById(buildEntry.shipDefId);
    if (!shipDef) {
      isValid = false;
      break;
    }

    const currentShipCount = workingFleetEntries.filter(
      (entry) => entry.shipDefId === buildEntry.shipDefId
    ).length;

    if (
      typeof shipDef.maxQuantity === 'number' &&
      currentShipCount >= shipDef.maxQuantity
    ) {
      isValid = false;
      break;
    }

    if (shipDef.basicCost) {
      const ordinaryCost = buildEntry.freeReason === 'zenith_antlion'
        ? 0
        : shipDef.basicCost.totalLines;

      if (remainingOrdinaryLines < ordinaryCost) {
        isValid = false;
        break;
      }

      remainingOrdinaryLines -= ordinaryCost;
      workingFleetEntries.push({
        rowId: buildEntry.rowId!,
        shipDefId: buildEntry.shipDefId,
        chargesCurrent: shipDef.maxCharges ?? 0,
        frigateTrigger: buildEntry.frigateTrigger,
      });
      continue;
    }

    if (shipDef.upgradedCost) {
      const reservedComponentIndices = reserveUpgradeComponents(
        workingFleetEntries,
        buildEntry.shipDefId
      );

      if (reservedComponentIndices == null) {
        isValid = false;
        break;
      }

      const joiningCost = shipDef.upgradedCost.joiningLines;
      const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
      const ordinaryShortfall = joiningCost - joiningSpend;

      if (remainingOrdinaryLines < ordinaryShortfall) {
        isValid = false;
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
      });
    }
  }

  const evolverRowIds = workingFleetEntries
    .filter((entry) => entry.shipDefId === 'EVO')
    .map((entry) => entry.rowId);

  const fleetAfterEvolverParity = applyEvolverPreviewParity({
    entries: workingFleetEntries,
    evolverRowIds,
    evolverChoicesByRowId,
    turnNumber,
  });

  return {
    draftCounts,
    isValid,
    remainingOrdinaryLines,
    remainingJoiningLines,
    myFleetPreview: buildPreviewFleetSummary(fleetAfterEvolverParity),
    provisionalShipCountsById: countShipsById(fleetAfterEvolverParity),
    evolverRowIds,
  };
}

export function canProvisionallyAddShip(args: {
  turnNumber: number;
  myShips: any[];
  draftCounts: Record<string, number>;
  shipDefId: ShipDefId;
  buildEconomy: BuildEconomySnapshot | null | undefined;
  frigateSelectedTriggers: number[];
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  frigateTriggerByInstanceId?: Record<string, unknown>;
}): boolean {
  const nextDraft = addShipToBuildDraft(args.draftCounts, args.shipDefId);
  return evaluateProvisionalBuild({
    turnNumber: args.turnNumber,
    myShips: args.myShips,
    draftCounts: nextDraft,
    buildEconomy: args.buildEconomy,
    frigateSelectedTriggers: args.frigateSelectedTriggers,
    evolverChoicesByRowId: args.evolverChoicesByRowId,
    frigateTriggerByInstanceId: args.frigateTriggerByInstanceId,
  }).isValid;
}
