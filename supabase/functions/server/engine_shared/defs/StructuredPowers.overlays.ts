/**
 * STRUCTURED POWERS OVERLAYS
 * 
 * Flattened overlay for ship structured powers.
 * Keyed by `${shipDefId}#${powerIndex}`.
 * 
 * This pass implements only DEF and FIG for Human species.
 * Future passes will expand to all 15 Human ships and other species.
 * 
 * PHASE KEY MAPPING:
 * - JSON "Automatic" subphase → 'battle.end_of_turn_resolution'
 */

import type { StructuredShipPower } from '../effects/translateShipPowers.ts';
import { EffectKind } from '../effects/Effect.ts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Ship power key format: "{shipDefId}#{powerIndex}"
 * Example: "DEF#0" for Defender's first power
 */
export type ShipPowerKey = `${string}#${number}`;

// ============================================================================
// HUMAN SPECIES STRUCTURED POWERS
// ============================================================================

/**
 * Structured power definitions for Human ships
 * 
 * Current coverage: DEF, FIG
 * Pending: COM, INT, CAR, GUA, DRE, BOM, MIN, CRU, DES, REP, SCO, FRI, BAT
 */
export const STRUCTURED_POWERS_HUMAN: Record<ShipPowerKey, StructuredShipPower[]> = {
  // ==========================================================================
  // DEFENDER (DEF)
  // ==========================================================================
  // JSON: "Heal 1." (Automatic)
  // Maps to: battle.end_of_turn_resolution
  'DEF#0': [
    {
      type: 'effect',
      timing: 'battle.end_of_turn_resolution',
      kind: EffectKind.Heal,
      amount: 1,
      targetPlayer: 'self'
    }
  ],

  // ==========================================================================
  // FIGHTER (FIG)
  // ==========================================================================
  // JSON: "Deal 1 damage." (Automatic)
  // Maps to: battle.end_of_turn_resolution
  'FIG#0': [
    {
      type: 'effect',
      timing: 'battle.end_of_turn_resolution',
      kind: EffectKind.Damage,
      amount: 1,
      targetPlayer: 'opponent'
    }
  ]
};

// ============================================================================
// VALIDATION & LOOKUP
// ============================================================================

/**
 * Get structured powers for a specific ship power
 * 
 * @param shipDefId - Ship definition ID (e.g., 'DEF')
 * @param powerIndex - Zero-based power index
 * @returns Structured powers array, or undefined if not found
 */
export function getStructuredPowers(
  shipDefId: string,
  powerIndex: number
): StructuredShipPower[] | undefined {
  const key: ShipPowerKey = `${shipDefId}#${powerIndex}`;
  return STRUCTURED_POWERS_HUMAN[key];
}

/**
 * Check if a ship power has structured powers defined
 * 
 * @param shipDefId - Ship definition ID
 * @param powerIndex - Zero-based power index
 * @returns True if structured powers exist
 */
export function hasStructuredPowers(
  shipDefId: string,
  powerIndex: number
): boolean {
  const key: ShipPowerKey = `${shipDefId}#${powerIndex}`;
  return key in STRUCTURED_POWERS_HUMAN;
}
