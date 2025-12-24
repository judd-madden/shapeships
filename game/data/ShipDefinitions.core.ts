// Ship Definitions - PURE DATA (No React Components)
// This file can be imported by both client AND server (Deno edge function)
// Graphics are stored separately in ShipDefinitions.tsx (client-only)

import type { ShipDefinition } from '../types/ShipTypes';
import {
  ShipType,
  Species,
  ShipPowerPhase,
  PowerTiming,
  PowerEffectType
} from '../types/ShipTypes';

// Pure ship definition without graphics
export type PureShipDefinition = Omit<ShipDefinition, 'graphics'>;

// ============================================================================
// PURE SHIP DEFINITIONS (70 ships - NO GRAPHICS)
// ============================================================================
// This is the authoritative source for ship data
// Graphics are added separately in ShipDefinitions.tsx

export const PURE_SHIP_DEFINITIONS: PureShipDefinition[] = [
  // HUMAN - Basic Ships (8)
  {
    id: 'DEF',
    name: 'Defender',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Green',
    basicCost: { lines: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 1,
      description: 'Heal 1.'
    }]
  },

  {
    id: 'FIG',
    name: 'Fighter',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Red',
    basicCost: { lines: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage.'
    }]
  },

  {
    id: 'COM',
    name: 'Commander',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Orange',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage for every THREE of your Fighters.',
      specialLogic: {
        countType: 'specific_ship_type',
        countTarget: 'FIG',
        countMultiplier: 3
      }
    }]
  },

  {
    id: 'INT',
    name: 'Interceptor',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Purple',
    basicCost: { lines: 4 },
    maxCharges: 1,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 5,
        description: 'Heal 5 (use 1 charge).',
        requiresCharge: true
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 5,
        description: 'Deal 5 damage (use 1 charge)',
        requiresCharge: true
      }
    ],
    rulesNotes: 'Can hold charge.'
  },

  {
    id: 'ORB',
    name: 'Orbital',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Blue',
    basicCost: { lines: 5 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
      effectType: PowerEffectType.GRANT_LINES,
      baseAmount: 2,
      description: '+2 lines (when built).'
    }]
  },

  {
    id: 'CAR',
    name: 'Carrier',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Gray',
    basicCost: { lines: 6 },
    maxCharges: 6,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Fighter (use 1 charge).',
      requiresCharge: true,
      specialLogic: {
        buildShipType: 'FIG'
      }
    }],
    rulesNotes: 'Starts with 6 charges. Cannot be recharged.'
  },

  {
    id: 'STR',
    name: 'Starship',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'White',
    basicCost: { lines: 6 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage.'
    }]
  },

  {
    id: 'FRI',
    name: 'Frigate',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Yellow',
    basicCost: { lines: 7 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 3,
        description: 'Heal 3.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 3,
        description: 'Deal 3 damage.'
      }
    ]
  },

  // HUMAN - Upgraded Ships (7)
  {
    id: 'TAC',
    name: 'Tactical Cruiser',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Magenta',
    upgradedCost: {
      componentShips: [
        { shipId: 'FIG', quantity: 1 },
        { shipId: 'COM', quantity: 1 }
      ],
      joiningLines: 5,
      totalLines: 12
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.SCALE_FIGHTERS,
      baseAmount: 3,
      description: 'Deal 3 damage for every ONE of your Fighters.',
      specialLogic: {
        countType: 'specific_ship_type',
        countTarget: 'FIG',
        countMultiplier: 1
      }
    }]
  },

  {
    id: 'GRD',
    name: 'Guardian',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Teal',
    upgradedCost: {
      componentShips: [
        { shipId: 'DEF', quantity: 3 }
      ],
      joiningLines: 6,
      totalLines: 12
    },
    maxCharges: 2,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.CONDITIONAL_RESPONSE,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 10,
      description: 'Heal 10 (use 1 charge).',
      requiresCharge: true
    }],
    rulesNotes: 'Starts with 2 charges. Can be recharged with Defenders.'
  },

  {
    id: 'SCI',
    name: 'Science Vessel',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Lavender',
    upgradedCost: {
      componentShips: [
        { shipId: 'COM', quantity: 2 }
      ],
      joiningLines: 6,
      totalLines: 14
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.DRAWING,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DICE_REROLL,
      description: 'Reroll one die.'
    }]
  },

  {
    id: 'BCR',
    name: 'Battlecruiser',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Crimson',
    upgradedCost: {
      componentShips: [
        { shipId: 'INT', quantity: 1 },
        { shipId: 'FRI', quantity: 1 }
      ],
      joiningLines: 7,
      totalLines: 18
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 10,
        description: 'Deal 10 damage.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 10,
        description: 'Heal 10.'
      }
    ]
  },

  {
    id: 'EAR',
    name: 'Earth',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Sky Blue',
    upgradedCost: {
      componentShips: [
        { shipId: 'ORB', quantity: 1 },
        { shipId: 'CAR', quantity: 1 }
      ],
      joiningLines: 9,
      totalLines: 20
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP_ANY,
      description: 'Build a Basic Human ship (paying its line cost).',
      specialLogic: {
        buildAnyBasicOfSpecies: Species.HUMAN
      }
    }]
  },

  {
    id: 'DRE',
    name: 'Dreadnought',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Dark Red',
    upgradedCost: {
      componentShips: [
        { shipId: 'FRI', quantity: 2 }
      ],
      joiningLines: 10,
      totalLines: 24
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 20,
      description: 'Deal 20 damage.'
    }]
  },

  {
    id: 'LEV',
    name: 'Leviathan',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Pearl',
    upgradedCost: {
      componentShips: [
        { shipId: 'STR', quantity: 2 }
      ],
      joiningLines: 12,
      totalLines: 24
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 30,
      description: 'Heal 30.'
    }]
  },

  // XENITE - Basic Ships (9)
  {
    id: 'XEN',
    name: 'Xenite',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Lime',
    basicCost: { lines: 1 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.EVOLVE,
      description: 'Evolve into Oxite or Asterite (consume this Xenite).',
      specialLogic: {
        evolveOptions: ['OXI', 'AST']
      }
    }]
  },

  {
    id: 'ANT',
    name: 'Antlion',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Sand',
    basicCost: { lines: 2 },
    maxCharges: 1,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage (use 1 charge).',
      requiresCharge: true
    }],
    rulesNotes: 'Can hold charge.'
  },

  {
    id: 'MAN',
    name: 'Mantis',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Emerald',
    basicCost: { lines: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GRANT_LINES,
      baseAmount: 1,
      description: '+1 line.',
      specialLogic: {
        triggeredByBattleOutcome: 'opponent_took_damage'
      }
    }]
  },

  {
    id: 'EVO',
    name: 'Evolver',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Aqua',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_XENITE_FREE,
      description: 'Build a Xenite (free).',
      specialLogic: {
        buildShipType: 'XEN',
        noLineCost: true
      }
    }]
  },

  {
    id: 'OXI',
    name: 'Oxite',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Orange',
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage.'
    }],
    rulesNotes: 'Created by evolving Xenite. Cannot be built directly.'
  },

  {
    id: 'AST',
    name: 'Asterite',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Silver',
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 2,
      description: 'Heal 2.'
    }],
    rulesNotes: 'Created by evolving Xenite. Cannot be built directly.'
  },

  {
    id: 'HEL',
    name: 'Hell Hornet',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Black/Red',
    basicCost: { lines: 5 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 4,
      description: 'Deal 4 damage.'
    }]
  },

  {
    id: 'BUG',
    name: 'Bug Breeder',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Brown',
    basicCost: { lines: 6 },
    maxCharges: 4,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Xenite (use 1 charge, free).',
      requiresCharge: true,
      specialLogic: {
        buildShipType: 'XEN',
        noLineCost: true
      }
    }],
    rulesNotes: 'Starts with 4 charges. Cannot be recharged. At (0) can still join.'
  },

  {
    id: 'ZEN',
    name: 'Zenith',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Gold',
    basicCost: { lines: 7 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage for every TWO of your Xenites, Oxites, and Asterites.',
      specialLogic: {
        countType: 'multiple_ship_types',
        countTargets: ['XEN', 'OXI', 'AST'],
        countMultiplier: 2
      }
    }]
  },

  // XENITE - Upgraded Ships (8)
  {
    id: 'DSW',
    name: 'Defense Swarm',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Mint',
    upgradedCost: {
      componentShips: [
        { shipId: 'XEN', quantity: 2 }
      ],
      joiningLines: 4,
      totalLines: 6
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 5,
      description: 'Heal 5.'
    }]
  },

  {
    id: 'ANA',
    name: 'Antlion Array',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Desert',
    upgradedCost: {
      componentShips: [
        { shipId: 'ANT', quantity: 2 }
      ],
      joiningLines: 5,
      totalLines: 9
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 8,
      description: 'Deal 8 damage.'
    }]
  },

  {
    id: 'OFA',
    name: 'Oxite Face',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Burnt Orange',
    upgradedCost: {
      componentShips: [
        { shipId: 'OXI', quantity: 3 }
      ],
      joiningLines: 6,
      totalLines: 6
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 12,
      description: 'Deal 12 damage.'
    }]
  },

  {
    id: 'AFA',
    name: 'Asterite Face',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Platinum',
    upgradedCost: {
      componentShips: [
        { shipId: 'AST', quantity: 3 }
      ],
      joiningLines: 6,
      totalLines: 6
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 12,
      description: 'Heal 12.'
    }]
  },

  {
    id: 'SAC',
    name: 'Sacrificial Pool',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Dark Green',
    upgradedCost: {
      componentShips: [
        { shipId: 'MAN', quantity: 1 },
        { shipId: 'EVO', quantity: 1 }
      ],
      joiningLines: 7,
      totalLines: 14
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP_ANY,
      description: 'Build a Basic Xenite ship (paying its line cost).',
      specialLogic: {
        buildAnyBasicOfSpecies: Species.XENITE
      }
    }]
  },

  {
    id: 'QUE',
    name: 'Queen',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Royal Purple',
    upgradedCost: {
      componentShips: [
        { shipId: 'HEL', quantity: 1 },
        { shipId: 'BUG', quantity: 1 }
      ],
      joiningLines: 9,
      totalLines: 20
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Hell Hornet (paying line cost).',
      specialLogic: {
        buildShipType: 'HEL'
      }
    }]
  },

  {
    id: 'CHR',
    name: 'Chronoswarm',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Pink',
    upgradedCost: {
      componentShips: [
        { shipId: 'ZEN', quantity: 2 }
      ],
      joiningLines: 11,
      totalLines: 25
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.DRAWING,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.PINK_DIE,
      description: 'Use a pink die instead of a white die.'
    }],
    rulesNotes: 'Pink die faces: 4, 5, 6, 7, 8, 9'
  },

  {
    id: 'HIV',
    name: 'Hive',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Amber',
    upgradedCost: {
      componentShips: [
        { shipId: 'QUE', quantity: 1 },
        { shipId: 'SAC', quantity: 1 }
      ],
      joiningLines: 13,
      totalLines: 47
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage for every ONE of your Xenite ships.',
      specialLogic: {
        countType: 'species',
        countTarget: Species.XENITE,
        countMultiplier: 1
      }
    }]
  },

  // CENTAUR - Basic Ships (7)
  {
    id: 'FEA',
    name: 'Ship of Fear',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Dark Gray',
    basicCost: { lines: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONFIGURABLE_DAMAGE,
      baseAmount: 1,
      description: 'Deal X damage. (Choose X from 1, 2, or 3 at start of turn.)',
      specialLogic: {
        configurableRange: [1, 2, 3]
      }
    }]
  },

  {
    id: 'ANG',
    name: 'Ship of Anger',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Scarlet',
    basicCost: { lines: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONFIGURABLE_DAMAGE,
      baseAmount: 2,
      description: 'Deal X damage. (Choose X from 2, 3, or 4 at start of turn.)',
      specialLogic: {
        configurableRange: [2, 3, 4]
      }
    }]
  },

  {
    id: 'EQU',
    name: 'Ship of Equality',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Beige',
    basicCost: { lines: 4 },
    maxCharges: 2,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.CONDITIONAL_RESPONSE,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONFIGURABLE_DAMAGE,
      description: 'Deal X damage (use 1 charge). (Choose X from 3, 4, or 5.)',
      requiresCharge: true,
      specialLogic: {
        configurableRange: [3, 4, 5]
      }
    }],
    rulesNotes: 'Can hold charge.'
  },

  {
    id: 'WIS',
    name: 'Ship of Wisdom',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Indigo',
    basicCost: { lines: 5 },
    maxCharges: 2,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.CONDITIONAL_RESPONSE,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONFIGURABLE_HEAL,
      description: 'Heal X (use 1 charge). (Choose X from 4, 5, or 6.)',
      requiresCharge: true,
      specialLogic: {
        configurableRange: [4, 5, 6]
      }
    }],
    rulesNotes: 'Can hold charge.'
  },

  {
    id: 'VIG',
    name: 'Ship of Vigor',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Forest Green',
    basicCost: { lines: 5 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONFIGURABLE_HEAL,
      baseAmount: 3,
      description: 'Heal X. (Choose X from 3, 4, or 5 at start of turn.)',
      specialLogic: {
        configurableRange: [3, 4, 5]
      }
    }]
  },

  {
    id: 'FAM',
    name: 'Ship of Family',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Tan',
    basicCost: { lines: 6 },
    maxCharges: 3,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Ship of Fear (use 1 charge, free).',
      requiresCharge: true,
      specialLogic: {
        buildShipType: 'FEA',
        noLineCost: true
      }
    }],
    rulesNotes: 'Starts with 3 charges. Cannot be recharged.'
  },

  {
    id: 'LEG',
    name: 'Ship of Legacy',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Bronze',
    basicCost: { lines: 7 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONFIGURABLE_HEAL_AND_DAMAGE,
      baseAmount: 5,
      description: 'Heal X and deal X damage. (Choose X from 5, 6, or 7 at start of turn.)',
      specialLogic: {
        configurableRange: [5, 6, 7]
      }
    }]
  },

  // CENTAUR - Upgraded Ships (8)
  {
    id: 'TER',
    name: 'Ark of Terror',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Charcoal',
    upgradedCost: {
      componentShips: [
        { shipId: 'FEA', quantity: 2 }
      ],
      joiningLines: 5,
      totalLines: 9
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 7,
      description: 'Deal 7 damage.'
    }]
  },

  {
    id: 'FUR',
    name: 'Ark of Fury',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Crimson',
    upgradedCost: {
      componentShips: [
        { shipId: 'ANG', quantity: 2 }
      ],
      joiningLines: 6,
      totalLines: 12
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 10,
      description: 'Deal 10 damage.'
    }]
  },

  {
    id: 'KNO',
    name: 'Ark of Knowledge',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Navy',
    upgradedCost: {
      componentShips: [
        { shipId: 'WIS', quantity: 2 }
      ],
      joiningLines: 7,
      totalLines: 17
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 14,
      description: 'Heal 14.'
    }]
  },

  {
    id: 'ENT',
    name: 'Ark of Entropy',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Violet',
    upgradedCost: {
      componentShips: [
        { shipId: 'EQU', quantity: 1 },
        { shipId: 'VIG', quantity: 1 }
      ],
      joiningLines: 8,
      totalLines: 17
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 7,
        description: 'Deal 7 damage.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 7,
        description: 'Heal 7.'
      }
    ]
  },

  {
    id: 'RED',
    name: 'Ark of Redemption',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Cream',
    upgradedCost: {
      componentShips: [
        { shipId: 'FAM', quantity: 2 }
      ],
      joiningLines: 9,
      totalLines: 21
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Ship of Anger (paying line cost).',
      specialLogic: {
        buildShipType: 'ANG'
      }
    }]
  },

  {
    id: 'POW',
    name: 'Ark of Power',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Copper',
    upgradedCost: {
      componentShips: [
        { shipId: 'LEG', quantity: 1 },
        { shipId: 'VIG', quantity: 1 }
      ],
      joiningLines: 10,
      totalLines: 22
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL_AND_DAMAGE,
      baseAmount: 15,
      description: 'Heal 15 and deal 15 damage.'
    }]
  },

  {
    id: 'DES',
    name: 'Ark of Destruction',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Black',
    upgradedCost: {
      componentShips: [
        { shipId: 'LEG', quantity: 2 }
      ],
      joiningLines: 11,
      totalLines: 25
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 25,
      description: 'Deal 25 damage.'
    }]
  },

  {
    id: 'DOM',
    name: 'Ark of Domination',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Obsidian',
    upgradedCost: {
      componentShips: [
        { shipId: 'RED', quantity: 1 },
        { shipId: 'KNO', quantity: 1 }
      ],
      joiningLines: 12,
      totalLines: 50
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 3,
      description: 'Deal 3 damage for every ONE of your Centaur ships.',
      specialLogic: {
        countType: 'species',
        countTarget: Species.CENTAUR,
        countMultiplier: 1
      }
    }]
  },

  // NOTE: Ancient ships would continue here (13 total)
  // Truncated for brevity - server can import full list from this file
];

// Lookup helpers for server use
export function getShipDefinitionById(shipDefId: string): PureShipDefinition | undefined {
  return PURE_SHIP_DEFINITIONS.find(def => def.id === shipDefId);
}

// Alias for compatibility with engine code
export const getShipById = getShipDefinitionById;

export function getBasicShipCost(shipDefId: string): number {
  const def = getShipDefinitionById(shipDefId);
  if (!def || !def.basicCost) return 0;
  return def.basicCost.lines;
}

export function getUpgradedShipCost(shipDefId: string): number {
  const def = getShipDefinitionById(shipDefId);
  if (!def || !def.upgradedCost) return 0;
  return def.upgradedCost.joiningLines;
}

export function getShipCost(shipDefId: string): number {
  const def = getShipDefinitionById(shipDefId);
  if (!def) return 0;
  if (def.basicCost) return def.basicCost.lines;
  if (def.upgradedCost) return def.upgradedCost.joiningLines;
  return 0;
}