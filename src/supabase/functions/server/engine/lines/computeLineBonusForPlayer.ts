/**
 * COMPUTE LINE BONUSES FOR PLAYER
 *
 * Server-authoritative computation of build-phase line bonuses from ship powers.
 *
 * Ordinary bonus lines contribute to the player's available lines pool:
 *
 *   availableLines = diceLines + savedLines + bonusLines
 *
 * Bonus joining lines are projected separately:
 *
 *   availableJoiningLines = joiningBonusLines
 *
 * IMPLEMENTATION:
 * - Pattern B: Derived from persistent ship instances
 * - Scans player's fleet and counts bonus line sources
 * - Uses server-authoritative ship definitions
 * - Deterministic and idempotent
 *
 * CURRENT ORDINARY BONUS LINE SOURCES:
 * - ORB (Orbital): +1 line per Orbital (capped by shipDef.maxQuantity)
 * - BAT (Battle Cruiser): +2 lines per Battlecruiser (uncapped)
 * - OXF (Oxite Face): +1 line per instance (uncapped)
 * - ASF (Asterite Face): +1 line per instance (uncapped)
 * - VIG (Ship of Vigor): +2 lines per instance on even effective dice
 * - POW (Ark of Power): +4 lines per instance on even effective dice
 * - SCI tier 2: gain bonus lines equal to effective dice roll
 *
 * CURRENT BONUS JOINING LINE SOURCES:
 * - RED (Ark of Redemption): +2 joining lines per future build phase
 * - DOM (Ark of Domination): +2 joining lines per future build phase
 *
 * FUTURE: Structured powers overlay for line bonuses
 * When structured powers expand beyond current coverage, this function should:
 * 1. Query ship.structuredPowers for powers with timing: 'build.line_generation'
 * 2. Sum ordinary and joining line effects from one authoritative path
 * 3. Apply per-ship caps and multipliers
 */

import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { getCanonicalShipFamilyDisplayName } from '../../engine_shared/defs/ShipDefinitionNames.ts';
import { getCopyTierFromFleet } from '../../engine_shared/resolve/phaseComputedEffects.ts';
import type { LastTurnBreakdownRow } from '../state/GameStateTypes.ts';
import {
  getDirectMaterializedSimulacrumInstanceIdsForPlayer,
} from '../ancient/simulacrumSolarPower.ts';

const BONUS_LINES_PER_SHIP: Record<string, number> = {
  ORB: 1,
  BAT: 2,
  OXF: 1,
  ASF: 1,
};

const JOINING_BONUS_LINES_PER_SHIP: Record<string, number> = {
  RED: 2,
  DOM: 2,
};

/**
 * Stored/saved joining lines are distinct from joiningBonusLines and are not handled here.
 *
 * FUTURE:
 * - LEG: +4 joining lines once through immediate creation consequences
 */

export type LineBonusBreakdown = {
  bonusLines: number;
  bonusLinesOnEven: number;
  joiningBonusLines: number;
  contributingSourceInstanceIds: string[];
  ordinaryRows: LastTurnBreakdownRow[];
  evenOnlyRows: LastTurnBreakdownRow[];
  joiningRows: LastTurnBreakdownRow[];
};

function buildShipBreakdownRow(
  shipDefId: string,
  count: number,
  amount: number,
  suffix = '',
): LineBonusBreakdown['ordinaryRows'][number] {
  return {
    rowKind: 'ship',
    label: getCanonicalShipFamilyDisplayName(shipDefId, count),
    count,
    amount,
    amountText: `${amount}${suffix}`,
  };
}

function buildAdjustmentRow(
  label: string,
  amount: number,
): LineBonusBreakdown['ordinaryRows'][number] {
  return {
    rowKind: 'adjustment',
    label,
    amount,
    amountText: String(amount),
  };
}

function sortRows<T extends { amount: number; label: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.label.localeCompare(b.label);
  });
}

function getQualifyingConvertCount(
  authoritativeGameData: any,
  playerId: string,
  currentTurnNumber: unknown,
): number {
  if (
    !Number.isInteger(currentTurnNumber) ||
    (currentTurnNumber as number) < 1
  ) {
    return 0;
  }

  const ledger =
    authoritativeGameData?.ancient?.solarLedgerByPlayerId?.[playerId];
  if (
    !ledger ||
    typeof ledger !== 'object' ||
    !Number.isInteger(ledger.battleTurnNumber) ||
    ledger.battleTurnNumber !== (currentTurnNumber as number) - 1 ||
    !Array.isArray(ledger.entries)
  ) {
    return 0;
  }

  return ledger.entries.filter(
    (entry: unknown) =>
      entry !== null &&
      typeof entry === 'object' &&
      (entry as { solarPowerId?: unknown }).solarPowerId === 'SCON',
  ).length;
}

function getEffectiveDiceRollFromGameData(
  gameData: any,
  playerId: string,
): number | undefined {
  const gd = gameData?.gameData ?? gameData;
  const td = gd?.turnData;

  const perPlayer = td?.effectiveDiceRollByPlayerId?.[playerId];
  if (typeof perPlayer === 'number') return perPlayer;

  const roll =
    td?.effectiveDiceRoll ??
    td?.baseDiceRoll ??
    td?.diceRoll ??
    gd?.diceRoll;
  return typeof roll === 'number' ? roll : undefined;
}

function getCappedContributingCount(shipDefId: string, count: number): number {
  const shipDef = getShipById(shipDefId);
  if (!shipDef) {
    console.warn(
      `[computeLineBonusesForPlayer] Unknown shipDefId: ${shipDefId}, skipping`,
    );
    return 0;
  }

  const maxQuantity = shipDef.maxQuantity;
  return typeof maxQuantity === 'number' ? Math.min(count, maxQuantity) : count;
}

function isEligibleLineGenerationSource(
  ship: any,
  currentTurnNumber: unknown,
  directMaterializedSimulacrumInstanceIds: ReadonlySet<string>,
): boolean {
  if (
    typeof currentTurnNumber !== 'number' ||
    !Number.isFinite(currentTurnNumber)
  ) {
    return true;
  }

  const createdTurn = ship?.createdTurn;
  if (typeof createdTurn !== 'number' || !Number.isFinite(createdTurn)) {
    return true;
  }

  if (createdTurn < currentTurnNumber) return true;
  return createdTurn === currentTurnNumber &&
    typeof ship?.instanceId === 'string' &&
    directMaterializedSimulacrumInstanceIds.has(ship.instanceId);
}

export function computeLineBonusesForPlayer(
  gameData: any,
  playerId: string,
): LineBonusBreakdown {
  const authoritativeGameData = gameData?.gameData ?? gameData;
  const fleet = authoritativeGameData?.ships?.[playerId];
  const ships = Array.isArray(fleet) ? fleet : [];
  const currentTurnNumber = authoritativeGameData?.turnNumber;
  const convertCount = getQualifyingConvertCount(
    authoritativeGameData,
    playerId,
    currentTurnNumber,
  );
  const directMaterializedSimulacrumInstanceIds =
    getDirectMaterializedSimulacrumInstanceIdsForPlayer(
      authoritativeGameData,
      playerId,
    );
  const lineGenerationShips = ships.filter((ship: any) =>
    isEligibleLineGenerationSource(
      ship,
      currentTurnNumber,
      directMaterializedSimulacrumInstanceIds,
    )
  );
  const shipCounts: Record<string, number> = {};
  const shipInstancesByDefId: Record<string, any[]> = {};

  for (const shipInstance of lineGenerationShips) {
    const shipDefId = shipInstance.shipDefId;
    shipCounts[shipDefId] = (shipCounts[shipDefId] || 0) + 1;
    if (!shipInstancesByDefId[shipDefId]) {
      shipInstancesByDefId[shipDefId] = [];
    }
    shipInstancesByDefId[shipDefId].push(shipInstance);
  }

  const effectiveDiceRoll = getEffectiveDiceRollFromGameData(
    authoritativeGameData,
    playerId,
  );
  const hasEvenEffectiveDiceRoll =
    typeof effectiveDiceRoll === 'number' && effectiveDiceRoll % 2 === 0;

  let bonusLines = convertCount;
  let bonusLinesOnEven = 0;
  let joiningBonusLines = 0;
  const ordinaryRows: LineBonusBreakdown['ordinaryRows'] = [];
  const evenOnlyRows: LineBonusBreakdown['evenOnlyRows'] = [];
  const joiningRows: LineBonusBreakdown['joiningRows'] = [];
  const contributingSourceInstanceIds: string[] = [];
  const contributingSourceInstanceIdSet = new Set<string>();

  if (convertCount > 0) {
    ordinaryRows.push({
      rowKind: 'solar_power',
      solarPowerId: 'SCON',
      label: 'Convert',
      count: convertCount,
      amount: convertCount,
      amountText: String(convertCount),
    });
  }

  const addContributors = (shipDefId: string, count: number) => {
    const candidates = shipInstancesByDefId[shipDefId] ?? [];
    for (const ship of candidates.slice(0, count)) {
      const instanceId = ship?.instanceId;
      if (
        typeof instanceId !== 'string' ||
        instanceId.length === 0 ||
        contributingSourceInstanceIdSet.has(instanceId)
      ) {
        continue;
      }
      contributingSourceInstanceIdSet.add(instanceId);
      contributingSourceInstanceIds.push(instanceId);
    }
  };

  for (const [shipDefId, count] of Object.entries(shipCounts)) {
    const effectiveCount = getCappedContributingCount(shipDefId, count);
    if (effectiveCount <= 0) continue;

    const bonusPerShip = BONUS_LINES_PER_SHIP[shipDefId];
    if (bonusPerShip) {
      const amount = bonusPerShip * effectiveCount;
      bonusLines += amount;
      ordinaryRows.push(buildShipBreakdownRow(shipDefId, effectiveCount, amount));
      addContributors(shipDefId, effectiveCount);
    }

    const joiningBonusPerShip = JOINING_BONUS_LINES_PER_SHIP[shipDefId];
    if (joiningBonusPerShip) {
      const amount = joiningBonusPerShip * effectiveCount;
      joiningBonusLines += amount;
      joiningRows.push(buildShipBreakdownRow(shipDefId, effectiveCount, amount, 'j'));
      addContributors(shipDefId, effectiveCount);
    }
  }

  const vigorCount = shipCounts.VIG ?? 0;
  if (vigorCount > 0 && hasEvenEffectiveDiceRoll) {
    // VIG build quantity is capped elsewhere, but DOM can legally transfer
    // additional owned VIG in Centaur mirrors; all owned VIG contribute.
    const effectiveCount = vigorCount;
    const amount = 2 * effectiveCount;
    bonusLinesOnEven += amount;
    evenOnlyRows.push(buildShipBreakdownRow('VIG', effectiveCount, amount, 'e'));
    addContributors('VIG', effectiveCount);
  }

  const powerArkCount = shipCounts.POW ?? 0;
  if (powerArkCount > 0 && hasEvenEffectiveDiceRoll) {
    const effectiveCount = getCappedContributingCount('POW', powerArkCount);
    const amount = 4 * effectiveCount;
    bonusLinesOnEven += amount;
    evenOnlyRows.push(buildShipBreakdownRow('POW', effectiveCount, amount, 'e'));
    addContributors('POW', effectiveCount);
  }

  bonusLines += bonusLinesOnEven;

  const sciTier = getCopyTierFromFleet(lineGenerationShips, 'SCI', 3);
  if (sciTier >= 2 && typeof effectiveDiceRoll === 'number') {
    bonusLines += effectiveDiceRoll;
    ordinaryRows.push(buildAdjustmentRow('Science Vessel', effectiveDiceRoll));
    addContributors('SCI', 2);
  }

  return {
    bonusLines,
    bonusLinesOnEven,
    joiningBonusLines,
    contributingSourceInstanceIds,
    ordinaryRows: sortRows(ordinaryRows),
    evenOnlyRows: sortRows(evenOnlyRows),
    joiningRows: sortRows(joiningRows),
  };
}
