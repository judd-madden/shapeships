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
 * - SCI tier 3: gain bonus lines equal to effective dice roll
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
import { getCopyTierFromFleet } from '../../engine_shared/resolve/phaseComputedEffects.ts';

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
 * - LEG: +4 joining lines once, immediately during build.drawing
 */

export type LineBonusBreakdown = {
  bonusLines: number;
  bonusLinesOnEven: number;
  joiningBonusLines: number;
  ordinaryRows: Array<{
    rowKind: 'ship' | 'adjustment';
    label: string;
    count?: number;
    amount: number;
    amountText: string;
  }>;
  evenOnlyRows: Array<{
    rowKind: 'ship' | 'adjustment';
    label: string;
    count?: number;
    amount: number;
    amountText: string;
  }>;
  joiningRows: Array<{
    rowKind: 'ship' | 'adjustment';
    label: string;
    count?: number;
    amount: number;
    amountText: string;
  }>;
};

function pluralizeShipName(name: string): string {
  if (/[^aeiou]y$/i.test(name)) {
    return `${name.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh)$/i.test(name)) {
    return `${name}es`;
  }

  return `${name}s`;
}

function getShipDisplayName(shipDefId: string, count: number): string {
  const shipDef = getShipById(shipDefId);
  const shipName = shipDef?.name ?? shipDefId;
  return count === 1 ? shipName : pluralizeShipName(shipName);
}

function buildShipBreakdownRow(
  shipDefId: string,
  count: number,
  amount: number,
  suffix = '',
): LineBonusBreakdown['ordinaryRows'][number] {
  return {
    rowKind: 'ship',
    label: getShipDisplayName(shipDefId, count),
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

export function computeLineBonusesForPlayer(
  gameData: any,
  playerId: string,
): LineBonusBreakdown {
  const ships =
    gameData?.ships?.[playerId] ??
    gameData?.gameData?.ships?.[playerId] ??
    [];

  if (ships.length === 0) {
    return {
      bonusLines: 0,
      bonusLinesOnEven: 0,
      joiningBonusLines: 0,
      ordinaryRows: [],
      evenOnlyRows: [],
      joiningRows: [],
    };
  }

  const shipCounts: Record<string, number> = {};

  for (const shipInstance of ships) {
    const shipDefId = shipInstance.shipDefId;
    shipCounts[shipDefId] = (shipCounts[shipDefId] || 0) + 1;
  }

  const effectiveDiceRoll = getEffectiveDiceRollFromGameData(gameData, playerId);
  const hasEvenEffectiveDiceRoll =
    typeof effectiveDiceRoll === 'number' && effectiveDiceRoll % 2 === 0;

  let bonusLines = 0;
  let bonusLinesOnEven = 0;
  let joiningBonusLines = 0;
  const ordinaryRows: LineBonusBreakdown['ordinaryRows'] = [];
  const evenOnlyRows: LineBonusBreakdown['evenOnlyRows'] = [];
  const joiningRows: LineBonusBreakdown['joiningRows'] = [];

  for (const [shipDefId, count] of Object.entries(shipCounts)) {
    const effectiveCount = getCappedContributingCount(shipDefId, count);
    if (effectiveCount <= 0) continue;

    const bonusPerShip = BONUS_LINES_PER_SHIP[shipDefId];
    if (bonusPerShip) {
      const amount = bonusPerShip * effectiveCount;
      bonusLines += amount;
      ordinaryRows.push(buildShipBreakdownRow(shipDefId, effectiveCount, amount));
    }

    const joiningBonusPerShip = JOINING_BONUS_LINES_PER_SHIP[shipDefId];
    if (joiningBonusPerShip) {
      const amount = joiningBonusPerShip * effectiveCount;
      joiningBonusLines += amount;
      joiningRows.push(buildShipBreakdownRow(shipDefId, effectiveCount, amount, 'j'));
    }
  }

  const vigorCount = shipCounts.VIG ?? 0;
  if (vigorCount > 0 && hasEvenEffectiveDiceRoll) {
    const effectiveCount = getCappedContributingCount('VIG', vigorCount);
    const amount = 2 * effectiveCount;
    bonusLinesOnEven += amount;
    evenOnlyRows.push(buildShipBreakdownRow('VIG', effectiveCount, amount, 'e'));
  }

  const powerArkCount = shipCounts.POW ?? 0;
  if (powerArkCount > 0 && hasEvenEffectiveDiceRoll) {
    const effectiveCount = getCappedContributingCount('POW', powerArkCount);
    const amount = 4 * effectiveCount;
    bonusLinesOnEven += amount;
    evenOnlyRows.push(buildShipBreakdownRow('POW', effectiveCount, amount, 'e'));
  }

  bonusLines += bonusLinesOnEven;

  const sciTier = getCopyTierFromFleet(ships, 'SCI', 3);
  if (sciTier >= 3 && typeof effectiveDiceRoll === 'number') {
    bonusLines += effectiveDiceRoll;
    ordinaryRows.push(buildAdjustmentRow('Science Vessel', effectiveDiceRoll));
  }

  return {
    bonusLines,
    bonusLinesOnEven,
    joiningBonusLines,
    ordinaryRows: sortRows(ordinaryRows),
    evenOnlyRows: sortRows(evenOnlyRows),
    joiningRows: sortRows(joiningRows),
  };
}
