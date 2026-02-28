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
 * Current coverage: DEF, FIG, BAT
 * Pending: COM, INT, CAR, GUA, DRE, BOM, MIN, CRU, DES, REP, SCO, FRI
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
      timings: ['battle.end_of_turn_resolution'],
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
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 1,
      targetPlayer: 'opponent'
    }
  ],

  // ==========================================================================
  // BATTLE CRUISER (BAT)
  // ==========================================================================
  // See /engine/lines/ for line bonus logic.
  // JSON power index 1: "Heal 3." (Automatic)
  'BAT#1': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Heal,
      amount: 3,
      targetPlayer: 'self',
    },
  ],

  // JSON power index 2: "Deal 2 damage." (Automatic)
  'BAT#2': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 2,
      targetPlayer: 'opponent',
    },
  ],

  // ==========================================================================
  // INTERCEPTOR (INT)
  // ==========================================================================
  // JSON power index 0: Choice power (Charge Declaration, Charge Response)
  // Options: damage (5 damage), heal (5 heal), hold (no effect)
  'INT#0': [
    {
      type: 'choice',
      timings: ['battle.charge_declaration', 'battle.charge_response'],
      requiresCharge: true,
      chargeCost: 1,
      options: [
        {
          choiceId: 'damage',
          label: '', // UI copy in ShipChoiceRegistry only
          effects: [
            {
              type: 'effect',
              timings: [], // Inherited from parent
              kind: EffectKind.SpendCharge,
              amount: 1,
              targetPlayer: 'self'
            },
            {
              type: 'effect',
              timings: [], // Inherited from parent
              kind: EffectKind.Damage,
              amount: 5,
              targetPlayer: 'opponent'
            }
          ]
        },
        {
          choiceId: 'heal',
          label: '', // UI copy in ShipChoiceRegistry only
          effects: [
            {
              type: 'effect',
              timings: [], // Inherited from parent
              kind: EffectKind.SpendCharge,
              amount: 1,
              targetPlayer: 'self'
            },
            {
              type: 'effect',
              timings: [], // Inherited from parent
              kind: EffectKind.Heal,
              amount: 5,
              targetPlayer: 'self'
            }
          ]
        },
        {
          choiceId: 'hold',
          label: '', // UI copy in ShipChoiceRegistry only
          effects: []
        }
      ]
    }
  ],

  // ==========================================================================
  // CARRIER (CAR)
  // ==========================================================================
  // Choice power in build.ships_that_build:
  // - defender: SpendCharge(1) + CreateShip('DEF')
  // - fighter:  SpendCharge(2) + CreateShip('FIG')
  // - hold:     no effect
  'CAR#0': [
    {
      type: 'choice',
      timings: ['build.ships_that_build'],
      requiresCharge: true,
      // NOTE: power-level chargeCost is NOT used for gating here (options have different costs)
      options: [
        {
          choiceId: 'defender',
          label: '', // UI copy in ShipChoiceRegistry only
          requiresCharge: true,
          chargeCost: 1,
          effects: [
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.SpendCharge,
              amount: 1,
              targetPlayer: 'self',
            },
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.CreateShip,
              shipDefId: 'DEF',
              targetPlayer: 'self',
            },
          ],
        },
        {
          choiceId: 'fighter',
          label: '', // UI copy in ShipChoiceRegistry only
          requiresCharge: true,
          chargeCost: 2,
          effects: [
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.SpendCharge,
              amount: 2,
              targetPlayer: 'self',
            },
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.CreateShip,
              shipDefId: 'FIG',
              targetPlayer: 'self',
            },
          ],
        },
        {
          choiceId: 'hold',
          label: '',
          requiresCharge: false,
          chargeCost: 0,
          effects: [],
        },
      ],
    },
  ],


// ==========================================================================
// FRIGATE (FRI)
// ==========================================================================
// JSON power index 2: "Heal 2." (Automatic)
'FRI#2': [
  {
    type: 'effect',
    timings: ['battle.end_of_turn_resolution'],
    kind: EffectKind.Heal,
    amount: 2,
    targetPlayer: 'self',
  },
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