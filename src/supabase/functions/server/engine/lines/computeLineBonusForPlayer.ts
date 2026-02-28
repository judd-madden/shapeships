/**
 * COMPUTE BONUS LINES FOR PLAYER
 * 
 * Server-authoritative computation of bonus lines from ship powers.
 * 
 * Bonus lines come from passive ship effects (e.g., Orbitals).
 * They contribute to the player's available lines pool:
 * 
 *   availableLines = diceLines + savedLines + bonusLines
 * 
 * IMPLEMENTATION:
 * - Pattern B: Derived from persistent ship instances
 * - Scans player's fleet and counts bonus line sources
 * - Uses server-authoritative ship definitions
 * - Deterministic and idempotent
 * 
 * CURRENT BONUS LINE SOURCES:
 * - ORB (Orbital): +1 line per Orbital (capped by shipDef.maxQuantity)
 *   - Power: "Generate an additional line in each future build phase."
 *   - Subphase: "Line Generation"
 * - BAT (Battle Cruiser): +2 lines per Battlecruiser (uncapped)
 *   - Power: "Generate two additional lines in each future build phase."
 *   - Subphase: "Line Generation"
 * - OXF (Oxite Face): +1 line per instance (uncapped)
 *   - Power: "Generate an additional line in each future build phase."
 *   - Subphase: "Line Generation"
 * - ASF (Asteroid Field): +1 line per instance (uncapped)
 *   - Power: "Generate an additional line in each future build phase."
 *   - Subphase: "Line Generation"
 * 
 * FUTURE: Structured powers overlay for bonus lines
 * When structured powers expand beyond DEF/FIG, this function should:
 * 1. Query ship.structuredPowers for powers with timing: 'build.line_generation'
 * 2. Sum effect.amount for EffectKind.AddLines
 * 3. Apply per-ship caps and multipliers
 */

import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';

// ============================================================================
// BONUS LINE SOURCE MAPPING (INTERIM)
// ============================================================================

/**
 * Interim mapping of shipDefId → bonus lines per instance
 * 
 * This is a deterministic lookup table until structured powers
 * expand to cover all bonus line sources.
 * 
 * IMPORTANT:
 * - This is server-authoritative (not in client code)
 * - Must be kept in sync with ship definitions JSON
 * - Will be replaced by structured powers overlay
 */
const BONUS_LINES_PER_SHIP: Record<string, number> = {
  'ORB': 1, // Orbital: +1 line per instance (capped via shipDef.maxQuantity)
  'BAT': 2, // Battle Cruiser: +2 lines per instance (uncapped)
  'OXF': 1, // Oxite Face: +1 line per instance (uncapped)
  'ASF': 1, // Asteroid Field: +1 line per instance (uncapped)
};

/**
 * FUTURE: COMPLEX BONUS LINE RULES (NOT IMPLEMENTED YET)
 *
 * These are still "bonus lines" but require turn context (dice roll) or special thresholds,
 * so they are NOT part of the simple per-ship registry above.
 *
 * - SCI#3 (Science Vessel threshold):
 *   If the player has at least 3x SCI in their fleet, gain bonus lines equal to the dice roll this turn.
 *   (Triggers once when threshold is met; not per additional SCI beyond 3, unless rules change.)
 *
 * - VIG (Ship of Vigor):
 *   Gain +2 bonus lines when the dice roll is EVEN this turn.
 *   (Clarify later whether multiple VIG stack; for now treat as a future decision.)
 *
 * - POW (Ark of Power):
 *   Gain +4 bonus lines when the dice roll is EVEN this turn.
 *   (Clarify later whether multiple POW stack; for now treat as a future decision.)
 *
 * FUTURE: JOINING LINES (CENTAUR) (NOT IMPLEMENTED YET)
 *
 * Joining lines are a separate resource from bonus lines and likely need separate computation/projection.
 *
 * - LEG: +4 joining lines once, immediately during build.drawing
 * - RED: +2 joining lines each future build phase
 * - DOM: +2 joining lines each future build phase
 */

// ============================================================================
// COMPUTE BONUS LINES
// ============================================================================

/**
 * Compute bonus lines for a player from their current fleet.
 * 
 * This is the authoritative server-side computation.
 * 
 * @param gameData - Game data object containing ships
 * @param playerId - Player ID to compute bonus for
 * @returns Total bonus lines (integer >= 0)
 */
export function computeLineBonusForPlayer(gameData: any, playerId: string): number {
  // Get player's ship instances from gameData (supports both state shapes)
  const ships =
    gameData?.ships?.[playerId] ??
    gameData?.gameData?.ships?.[playerId] ??
    [];
  
  if (ships.length === 0) {
    return 0;
  }
  
  // Count ships by definition ID
  const shipCounts: Record<string, number> = {};
  
  for (const shipInstance of ships) {
    const shipDefId = shipInstance.shipDefId;
    shipCounts[shipDefId] = (shipCounts[shipDefId] || 0) + 1;
  }
  
  // Compute total bonus lines
  let totalBonus = 0;
  
  for (const [shipDefId, count] of Object.entries(shipCounts)) {
    const bonusPerShip = BONUS_LINES_PER_SHIP[shipDefId];
    
    if (!bonusPerShip) {
      // This ship doesn't grant bonus lines
      continue;
    }
    
    // Get maxQuantity from ship definitions (cap for this ship type)
    const shipDef = getShipById(shipDefId);
    if (!shipDef) {
      console.warn(`[computeLineBonusForPlayer] Unknown shipDefId: ${shipDefId}, skipping`);
      continue;
    }
    
    const maxQuantity = shipDef.maxQuantity;
    
    // Apply cap from ship definition if defined, otherwise treat as uncapped
    const effectiveCount = typeof maxQuantity === 'number' ? Math.min(count, maxQuantity) : count;
    
    // Add bonus contribution
    const bonus = bonusPerShip * effectiveCount;
    totalBonus += bonus;
  }
  
  return totalBonus;
}

// ============================================================================
// FUTURE: STRUCTURED POWERS INTEGRATION
// ============================================================================

/**
 * Future implementation pattern (once structured powers expand):
 * 
 * ```typescript
 * export function computeLineBonusForPlayer(gameData: any, playerId: string): number {
 *   const ships = gameData?.ships?.[playerId] || [];
 *   let totalBonus = 0;
 *   
 *   for (const shipInstance of ships) {
 *     const shipDef = getShipWithStructuredPowers(shipInstance.shipDefId);
 *     
 *     // Filter for line generation powers
 *     const linePowers = shipDef.structuredPowers.filter(
 *       p => p.timing === 'build.line_generation' &&
 *            p.type === 'effect' &&
 *            p.kind === EffectKind.AddLines
 *     );
 *     
 *     for (const power of linePowers) {
 *       totalBonus += power.amount || 0;
 *     }
 *   }
 *   
 *   return totalBonus;
 * }
 * ```
 */