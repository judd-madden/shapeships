/**
 * Animation Stagger Logic
 * =======================
 * 
 * Pure functions for computing staggered animation delays:
 * 1. Opponent fleet entry delays (opponent side only)
 * 2. Paired activation delays (both sides, synchronized by grid position)
 * 
 * NO DOM queries. NO state. Pure computation only.
 */

// ============================================================================
// TYPES
// ============================================================================

export type OpponentFleetEntryPlan = {
  opponent: Record<string, number>; // new opponent shipInstanceId -> delayMs
};

export type ActivationStaggerPlan = {
  myIndexByShipId: Record<string, number>;       // shipInstanceId -> index
  opponentIndexByShipId: Record<string, number>; // shipInstanceId -> index
};

// ============================================================================
// OPPONENT ENTRY STAGGER
// ============================================================================

/**
 * Computes entry animation delays for new opponent ships.
 * 
 * @param prevOpponentIds - Set of opponent ship IDs from previous state
 * @param opponentOrderedShipIds - Current opponent ships in render order
 * @param stepMs - Delay step between ships (default 400ms)
 * @returns { plan, nextPrevIds } - Plan with delays for new ships + updated ID set
 */
export function computeOpponentEntryPlan(
  prevOpponentIds: ReadonlySet<string>,
  opponentOrderedShipIds: readonly string[],
  stepMs: number = 400
): { plan: OpponentFleetEntryPlan; nextPrevIds: Set<string> } {
  // Build current IDs set
  const currentIds = new Set(opponentOrderedShipIds);

  // Identify new IDs (not in previous set)
  const newIds = new Set<string>();
  for (const id of currentIds) {
    if (!prevOpponentIds.has(id)) {
      newIds.add(id);
    }
  }

  // Build delay plan in visual order
  const opponent: Record<string, number> = {};
  let staggerIndex = 0;

  for (const id of opponentOrderedShipIds) {
    if (newIds.has(id)) {
      opponent[id] = staggerIndex * stepMs;
      staggerIndex++;
    }
  }

  return {
    plan: { opponent },
    nextPrevIds: currentIds,
  };
}

// ============================================================================
// PAIRED ACTIVATION STAGGER
// ============================================================================

/**
 * Computes activation animation delays for both fleets, synchronized by grid position.
 * 
 * Ships at the same index activate at the same time, creating paired visual rhythm.
 * 
 * @param myOrderedShipIds - My ships in render order (row1→row4, left→right)
 * @param opponentOrderedShipIds - Opponent ships in render order
 * @returns { myIndexByShipId, opponentIndexByShipId } - Index maps for both sides
 */
export function computeActivationStaggerPlan(
  myOrderedShipIds: readonly string[],
  opponentOrderedShipIds: readonly string[]
): ActivationStaggerPlan {
  const myIndexByShipId: Record<string, number> = {};
  const opponentIndexByShipId: Record<string, number> = {};

  const maxLen = Math.max(myOrderedShipIds.length, opponentOrderedShipIds.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < myOrderedShipIds.length) {
      myIndexByShipId[myOrderedShipIds[i]] = i;
    }
    if (i < opponentOrderedShipIds.length) {
      opponentIndexByShipId[opponentOrderedShipIds[i]] = i;
    }
  }

  return {
    myIndexByShipId,
    opponentIndexByShipId,
  };
}
