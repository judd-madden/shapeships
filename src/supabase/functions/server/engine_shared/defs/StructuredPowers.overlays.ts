/**
 * STRUCTURED POWERS OVERLAYS
 * 
 * Flattened overlay for ship structured powers.
 * Keyed by `${shipDefId}#${powerIndex}`.
 * 
 * This pass implements the current Human overlays plus the Phase 4A Xenite
 * "easy mapper" overlays.
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
// STRUCTURED POWERS REGISTRY
// ============================================================================

/**
 * Structured power definitions keyed by `{shipDefId}#{powerIndex}`.
 *
 * Current coverage includes:
 * - Human: DEF, FIG, BAT, INT, GUA, CAR, DRE, LEV, FRI
 * - Xenite: OXI, AST, ANT, BUG
 * - Centaur: WIS, ENT, POW
 */
export const STRUCTURED_POWERS_OVERLAYS: Record<ShipPowerKey, StructuredShipPower[]> = {
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
  // GUARDIAN (GUA)
  // ==========================================================================
  // JSON power index 0: Choice power (First Strike)
  // Options: destroy target basic enemy ship, or hold charge
  'GUA#0': [
    {
      type: 'choice',
      timings: ['battle.first_strike'],
      requiresCharge: true,
      chargeCost: 1,
      options: [
        {
          choiceId: 'destroy',
          label: '', // UI copy in ShipChoiceRegistry only
          effects: [
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.SpendCharge,
              amount: 1,
              targetPlayer: 'self'
            },
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.Destroy,
              restriction: 'basic_only',
              count: 1,
              targetPlayer: 'opponent'
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
  // DREADNOUGHT (DRE)
  // ==========================================================================
  // JSON power index 1: "Deal 10 damage." (Automatic)
  'DRE#1': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 10,
      targetPlayer: 'opponent',
    },
  ],


  // ==========================================================================
  // LEVIATHAN (LEV)
  // ==========================================================================
  // JSON power index 1: "Deal 12 damage." (Automatic)
  'LEV#1': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 12,
      targetPlayer: 'opponent'
    }
  ],

  // JSON power index 2: "Heal 12." (Automatic)
  'LEV#2': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Heal,
      amount: 12,
      targetPlayer: 'self'
    }
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
],

  // ==========================================================================
  // OXITE (OXI)
  // ==========================================================================
  // JSON: "Heal 1." (Automatic)
  'OXI#0': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Heal,
      amount: 1,
      targetPlayer: 'self',
    },
  ],

  // ==========================================================================
  // ASTERITE (AST)
  // ==========================================================================
  // JSON: "Deal 1 damage." (Automatic)
  'AST#0': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 1,
      targetPlayer: 'opponent',
    },
  ],

  // ==========================================================================
  // ANTLION (ANT)
  // ==========================================================================
  // Choice power (Charge Declaration, Charge Response)
  // - damage: SpendCharge(1) + Damage(3)
  // - heal: SpendCharge(1) + Heal(4)
  // - hold: no effect
  'ANT#0': [
    {
      type: 'choice',
      timings: ['battle.charge_declaration', 'battle.charge_response'],
      requiresCharge: true,
      chargeCost: 1,
      options: [
        {
          choiceId: 'damage',
          label: '',
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
              kind: EffectKind.Damage,
              amount: 3,
              targetPlayer: 'opponent',
            },
          ],
        },
        {
          choiceId: 'heal',
          label: '',
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
              kind: EffectKind.Heal,
              amount: 4,
              targetPlayer: 'self',
            },
          ],
        },
        {
          choiceId: 'hold',
          label: '',
          effects: [],
        },
      ],
    },
  ],

  // ==========================================================================
  // SHIP OF WISDOM (WIS)
  // ==========================================================================
  // Choice power (Charge Declaration, Charge Response)
  // - damage: SpendCharge(1) + Damage(3)
  // - heal: SpendCharge(1) + Heal(4)
  // - hold: no effect
  'WIS#0': [
    {
      type: 'choice',
      timings: ['battle.charge_declaration', 'battle.charge_response'],
      requiresCharge: true,
      chargeCost: 1,
      options: [
        {
          choiceId: 'damage',
          label: '',
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
              kind: EffectKind.Damage,
              amount: 3,
              targetPlayer: 'opponent',
            },
          ],
        },
        {
          choiceId: 'heal',
          label: '',
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
              kind: EffectKind.Heal,
              amount: 4,
              targetPlayer: 'self',
            },
          ],
        },
        {
          choiceId: 'hold',
          label: '',
          effects: [],
        },
      ],
    },
  ],

  // ==========================================================================
  // SHIP OF FAMILY (FAM)
  // ==========================================================================
  // Choice power (Charge Declaration, Charge Response)
  // - damage: SpendCharge(1) + Damage(distinct owned ship types)
  // - heal: SpendCharge(1) + Heal(distinct owned ship types)
  // - hold: no effect
  // NOTE: Damage/Heal amount is authoritatively concretized in resolvePowerAction.
  'FAM#0': [
    {
      type: 'choice',
      timings: ['battle.charge_declaration', 'battle.charge_response'],
      requiresCharge: true,
      chargeCost: 1,
      options: [
        {
          choiceId: 'damage',
          label: '',
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
              kind: EffectKind.Damage,
              amount: 0,
              targetPlayer: 'opponent',
            },
          ],
        },
        {
          choiceId: 'heal',
          label: '',
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
              kind: EffectKind.Heal,
              amount: 0,
              targetPlayer: 'self',
            },
          ],
        },
        {
          choiceId: 'hold',
          label: '',
          effects: [],
        },
      ],
    },
  ],

  // ==========================================================================
  // ARK OF ENTROPY (ENT)
  // ==========================================================================
  // JSON power index 0: "Deal 7 damage." (Automatic)
  'ENT#0': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 7,
      targetPlayer: 'opponent',
    },
  ],

  // JSON power index 1: "Take 4 damage." (Automatic)
  'ENT#1': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 4,
      targetPlayer: 'self',
    },
  ],

  // ==========================================================================
  // ARK OF POWER (POW)
  // ==========================================================================
  // JSON power index 1: "Deal 2 damage." (Automatic)
  'POW#1': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 2,
      targetPlayer: 'opponent',
    },
  ],

  // JSON power index 2: "Heal 3." (Automatic)
  'POW#2': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Heal,
      amount: 3,
      targetPlayer: 'self',
    },
  ],

  // ==========================================================================
  // ARK OF DOMINATION (DOM)
  // ==========================================================================
  'DOM#1': [
    {
      type: 'choice',
      timings: ['battle.first_strike'],
      onceOnly: 'on_build_turn',
      options: [
        {
          choiceId: 'steal',
          label: '',
          effects: [
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.TransferShip,
              restriction: 'basic_only',
              count: 2,
              requiredTargetCount: 2,
              targetPlayer: 'opponent',
            },
          ],
        },
      ],
    },
  ],

  // ==========================================================================
  // SHIP OF LEGACY (LEG)
  // ==========================================================================
  // JSON power index 1: "Deal 1 damage." (Automatic)
  'LEG#1': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Damage,
      amount: 1,
      targetPlayer: 'opponent',
    },
  ],

  // JSON power index 2: "Heal 2." (Automatic)
  'LEG#2': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Heal,
      amount: 2,
      targetPlayer: 'self',
    },
  ],

  // ==========================================================================
  // ARK OF KNOWLEDGE (KNO)
  // ==========================================================================
  // JSON power index 2: "Heal 2." (Automatic)
  'KNO#2': [
    {
      type: 'effect',
      timings: ['battle.end_of_turn_resolution'],
      kind: EffectKind.Heal,
      amount: 2,
      targetPlayer: 'self',
    },
  ],

  // ==========================================================================
  // SACRIFICIAL POOL (SAC)
  // ==========================================================================
  // Choice power in build.ships_that_build:
  // - destroy: Destroy one of your own legal basic ships
  // - hold:    do nothing
  'SAC#0': [
    {
      type: 'choice',
      timings: ['build.ships_that_build'],
      options: [
        {
          choiceId: 'destroy',
          label: '',
          effects: [
            {
              type: 'effect',
              timings: [],
              kind: EffectKind.Destroy,
              restriction: 'basic_only',
              count: 1,
              targetPlayer: 'self',
            },
          ],
        },
        {
          choiceId: 'hold',
          label: '',
          effects: [],
        },
      ],
    },
  ],
};

// Back-compat export retained while callers migrate to the species-agnostic name.
export const STRUCTURED_POWERS_HUMAN = STRUCTURED_POWERS_OVERLAYS;

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
  return STRUCTURED_POWERS_OVERLAYS[key];
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
  return key in STRUCTURED_POWERS_OVERLAYS;
}
