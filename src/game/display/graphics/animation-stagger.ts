/**
 * Animation Stagger Logic
 * =======================
 *
 * Pure functions for computing paired activation delays.
 *
 * NO DOM queries. NO state. Pure computation only.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ActivationStaggerPlan = {
  myIndexByShipId: Record<string, number>;       // renderKey -> index
  opponentIndexByShipId: Record<string, number>; // renderKey -> index
};

export function computeSequentialEntryDelayById(
  orderedIds: readonly string[],
  initialGapMs: number,
  gapDecreaseMs: number,
  minGapMs: number
): Record<string, number> {
  const delayById: Record<string, number> = {};
  let cumulativeDelayMs = 0;

  orderedIds.forEach((id, index) => {
    if (index > 0) {
      const gapBeforeItemMs = Math.max(
        minGapMs,
        initialGapMs - ((index - 1) * gapDecreaseMs)
      );
      cumulativeDelayMs += gapBeforeItemMs;
    }

    delayById[id] = cumulativeDelayMs;
  });

  return delayById;
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
