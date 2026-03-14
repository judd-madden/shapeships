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
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';

function shipHasInteractiveShipsThatBuildChoice(ship: any, phaseKey: PhaseKey): boolean {
  if (phaseKey !== 'build.ships_that_build') return false;

  const shipDef = getShipDefinition(ship?.shipDefId);
  if (!shipDef?.structuredPowers) return false;

  for (const power of shipDef.structuredPowers) {
    if (power.type !== 'choice') continue;
    if (!power.timings.includes(phaseKey)) continue;

    const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
    const eligibleChoices = power.options.filter((option) => {
      if (option.choiceId === 'hold') return true;

      const requiresCharge = (option.requiresCharge ?? false) || (power.requiresCharge ?? false);
      if (!requiresCharge) return true;

      const chargeCost = option.chargeCost ?? power.chargeCost ?? 1;
      return chargesCurrent >= chargeCost;
    });

    if (eligibleChoices.some((option) => option.choiceId !== 'hold')) {
      return true;
    }
  }

  return false;
}

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
    if (phaseKey === 'build.ships_that_build') {
      if (shipHasInteractiveShipsThatBuildChoice(ship, phaseKey)) {
        return true;
      }
      continue;
    }

    const def = getShipById(ship.shipDefId);
    if (!def?.powers || def.powers.length === 0) continue;

    // Charge-awareness: ships with charges only count if they have charges remaining
    const maxCharges = Number((def as any)?.charges ?? 0);
    const chargesCurrent = Number((ship as any)?.chargesCurrent ?? 0);
    
    // Skip depleted charge ships (they cannot use their powers)
    if (maxCharges > 0 && chargesCurrent <= 0) {
      continue;
    }

    for (const power of def.powers) {
      // If allowedSubphases provided, check if power.subphase is in that list
      if (allowedSubphases && allowedSubphases.length > 0) {
        if (power.subphase && allowedSubphases.includes(power.subphase)) {
          return true;
        }
        continue; // Skip fallback matching if allowedSubphases was provided
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
