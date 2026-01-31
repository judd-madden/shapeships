/**
 * FLEET POWER AVAILABILITY CHECK
 * 
 * Server-authoritative helper to determine if a player has any fleet powers
 * that can act in the current phase.
 * 
 * Used by onEnterPhase to determine whether a phase should pause for player
 * input or auto-advance.
 * 
 * ARCHITECTURE:
 * - Phase owns the question "do we pause or auto-advance?"
 * - Fleet is just data; phase decides flow control
 * - Prevents future path churn when fleet logic evolves
 * 
 * GUARDRAILS:
 * - No client code imports
 * - No raw text parsing
 * - Uses canonical ship definitions
 * - Pure function (no mutation, no side effects)
 */

import type { PhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';

/**
 * Returns true if the given player has at least one fleet power
 * that is eligible to act in the current phase.
 *
 * This is used by onEnterPhase to determine whether a phase
 * should pause for player input or auto-advance.
 * 
 * @param state - Current game state
 * @param phaseKey - Phase to check (format: "major.sub")
 * @param playerId - Player ID to check
 * @param allowedSubphases - Optional list of subphase strings to match against
 * @returns true if player has any eligible powers in this phase
 */
export function fleetHasAvailablePowers(
  state: any,
  phaseKey: PhaseKey,
  playerId: string,
  allowedSubphases?: string[]
): boolean {
  const ships =
    state?.ships?.[playerId] ??
    state?.gameData?.ships?.[playerId] ??
    [];

  for (const ship of ships) {
    const def = getShipById(ship.shipDefId);
    if (!def?.powers || def.powers.length === 0) continue;

    for (const power of def.powers) {
      // If allowedSubphases provided, check if power.subphase is in that list
      if (allowedSubphases && allowedSubphases.length > 0) {
        if (power.subphase && allowedSubphases.includes(power.subphase)) {
          return true;
        }
        continue; // Skip fallback matching if allowedSubphases was provided
      }
      
      /**
       * Fallback power eligibility matching rules:
       * - If power declares an explicit phaseKey, match exactly
       * - If power declares a subphase string, derive subphase from phaseKey and match
       */
      if (power.phaseKey && power.phaseKey === phaseKey) {
        return true;
      }

      // Derive subphase from phaseKey (deterministic, no state dependency)
      const phaseSub = String(phaseKey).split('.')[1];

      if (power.subphase && power.subphase === phaseSub) {
        return true;
      }
    }
  }

  return false;
}