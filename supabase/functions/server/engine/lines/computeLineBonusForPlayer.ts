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
 * - ORB (Orbital): +1 line per Orbital (max 6)
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
  'ORB': 1, // Orbital: +1 line per instance
};

/**
 * Ship-specific caps for bonus line sources
 * 
 * Some ships have maximum fleet counts that affect bonus lines.
 */
const BONUS_LINES_CAPS: Record<string, number> = {
  'ORB': 6, // Max 6 Orbitals (from ship extraRules)
};

// ============================================================================
// COMPUTE BONUS LINES
// ============================================================================

/**
 * Compute bonus lines for a player from their current fleet.
 * 
 * This is the authoritative server-side computation.
 * 
 * @param state - Current game state
 * @param playerId - Player ID to compute bonus for
 * @returns Total bonus lines (integer >= 0)
 */
export function computeLineBonusForPlayer(state: any, playerId: string): number {
  // Get player's ship instances from state
  const ships = state.gameData?.ships?.[playerId] || [];
  
  if (ships.length === 0) {
    return 0;
  }
  
  // Count ships by definition ID
  const shipCounts: Record<string, number> = {};
  
  for (const shipInstance of ships) {
    const shipDefId = shipInstance.shipDefId;
    
    // Validate ship definition exists (defensive)
    const shipDef = getShipById(shipDefId);
    if (!shipDef) {
      console.warn(`[computeLineBonusForPlayer] Unknown shipDefId: ${shipDefId}, skipping`);
      continue;
    }
    
    // Count this ship
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
    
    // Apply cap if defined
    const cap = BONUS_LINES_CAPS[shipDefId];
    const effectiveCount = cap ? Math.min(count, cap) : count;
    
    // Add bonus contribution
    const bonus = bonusPerShip * effectiveCount;
    totalBonus += bonus;
    
    console.log(
      `[computeLineBonusForPlayer] Player ${playerId}: ` +
      `${effectiveCount}x ${shipDefId} = +${bonus} lines` +
      (cap && count > cap ? ` (capped at ${cap})` : '')
    );
  }
  
  console.log(`[computeLineBonusForPlayer] Player ${playerId}: Total bonus = ${totalBonus} lines`);
  
  return totalBonus;
}

// ============================================================================
// FUTURE: STRUCTURED POWERS INTEGRATION
// ============================================================================

/**
 * Future implementation pattern (once structured powers expand):
 * 
 * ```typescript
 * export function computeLineBonusForPlayer(state: any, playerId: string): number {
 *   const ships = state.gameData?.ships?.[playerId] || [];
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
