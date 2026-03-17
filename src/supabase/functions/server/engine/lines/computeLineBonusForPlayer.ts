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
  joiningBonusLines: number;
};

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
      joiningBonusLines: 0,
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
  let joiningBonusLines = 0;

  for (const [shipDefId, count] of Object.entries(shipCounts)) {
    const effectiveCount = getCappedContributingCount(shipDefId, count);
    if (effectiveCount <= 0) continue;

    const bonusPerShip = BONUS_LINES_PER_SHIP[shipDefId];
    if (bonusPerShip) {
      bonusLines += bonusPerShip * effectiveCount;
    }

    const joiningBonusPerShip = JOINING_BONUS_LINES_PER_SHIP[shipDefId];
    if (joiningBonusPerShip) {
      joiningBonusLines += joiningBonusPerShip * effectiveCount;
    }
  }

  if (hasEvenEffectiveDiceRoll) {
    const vigorCount = shipCounts.VIG ?? 0;
    if (vigorCount > 0) {
      bonusLines += 2 * getCappedContributingCount('VIG', vigorCount);
    }

    const powerArkCount = shipCounts.POW ?? 0;
    if (powerArkCount > 0) {
      bonusLines += 4 * getCappedContributingCount('POW', powerArkCount);
    }
  }

  const sciTier = getCopyTierFromFleet(ships, 'SCI', 3);
  if (sciTier >= 3 && typeof effectiveDiceRoll === 'number') {
    bonusLines += effectiveDiceRoll;
  }

  return {
    bonusLines,
    joiningBonusLines,
  };
}
