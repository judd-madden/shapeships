// Ship definitions for Shapeships
// Based on the example ships provided

import {
  ShipDefinition,
  ShipType,
  Species,
  ShipPowerPhase,
  PowerEffectType,
  SHIP_COLORS
} from '../types/ShipTypes';

// ============================================================================
// HUMAN BASIC SHIPS
// ============================================================================

export const DEFENDER: ShipDefinition = {
  id: 'DEF',
  name: 'Defender',
  species: Species.HUMAN,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_GREEN,
  graphics: [
    { filename: 'defender.svg', condition: 'default' }
  ],
  basicCost: {
    lines: 2
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.HEAL,
      baseAmount: 1,
      description: 'Heal 1',
      isOptional: false
    }
  ]
};

export const INTERCEPTOR: ShipDefinition = {
  id: 'INT',
  name: 'Interceptor',
  species: Species.HUMAN,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_PURPLE,
  graphics: [
    { 
      filename: 'interceptor1.svg', 
      condition: 'charges_remaining',
      chargesRequired: 1
    },
    { 
      filename: 'interceptor0.svg', 
      condition: 'depleted',
      chargesRequired: 0
    }
  ],
  basicCost: {
    lines: 4
  },
  maxCharges: 1,
  chargesPerTurn: 1,
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.CHARGE_DECLARATION,
      effectType: PowerEffectType.USE_CHARGE,
      baseAmount: 5,
      description: 'Use Charge to Heal 5',
      requiresCharge: true,
      isOptional: true,
      specialLogic: {
        customLogicId: 'interceptor_heal_option'
      }
    },
    {
      powerIndex: 2,
      phase: ShipPowerPhase.CHARGE_DECLARATION,
      effectType: PowerEffectType.USE_CHARGE,
      baseAmount: 5,
      description: 'Use Charge to deal 5 damage',
      requiresCharge: true,
      isOptional: true,
      specialLogic: {
        customLogicId: 'interceptor_damage_option'
      }
    }
  ],
  description: 'Can heal 5 OR deal 5 damage OR be held. Once charge is used, ship is depleted.'
};

// Fighter and Orbital would be defined here (referenced by Battlecruiser)
// For now, creating placeholders
export const FIGHTER: ShipDefinition = {
  id: 'FIG',
  name: 'Fighter',
  species: Species.HUMAN,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_BLUE,
  graphics: [
    { filename: 'fighter.svg', condition: 'default' }
  ],
  basicCost: {
    lines: 3
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage',
      isOptional: false
    }
  ]
};

export const ORBITAL: ShipDefinition = {
  id: 'ORB',
  name: 'Orbital',
  species: Species.HUMAN,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_YELLOW,
  graphics: [
    { filename: 'orbital.svg', condition: 'default' }
  ],
  basicCost: {
    lines: 3
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.LINE_GENERATION,
      effectType: PowerEffectType.GAIN_LINES,
      baseAmount: 1,
      description: 'Gain 1 bonus line',
      isOptional: false
    }
  ]
};

// ============================================================================
// HUMAN UPGRADED SHIPS
// ============================================================================

export const BATTLECRUISER: ShipDefinition = {
  id: 'BTC',
  name: 'Battlecruiser',
  species: Species.HUMAN,
  type: ShipType.UPGRADED,
  color: SHIP_COLORS.CYAN,
  graphics: [
    { filename: 'battlecruiser.svg', condition: 'default' }
  ],
  upgradedCost: {
    componentShips: [
      { shipId: 'DEF', quantity: 1, mustBeDepleted: false },
      { shipId: 'FIG', quantity: 2, mustBeDepleted: false },
      { shipId: 'ORB', quantity: 1, mustBeDepleted: false }
    ],
    joiningLines: 6,
    totalLines: 20 // DEF(2) + FIG(3)*2 + ORB(3) + joining(6) = 20
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.LINE_GENERATION,
      effectType: PowerEffectType.GAIN_LINES,
      baseAmount: 2,
      description: 'Gain 2 bonus lines',
      isOptional: false
    },
    {
      powerIndex: 2,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage',
      isOptional: false
    },
    {
      powerIndex: 3,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.HEAL,
      baseAmount: 3,
      description: 'Heal 3',
      isOptional: false
    }
  ]
};

// ============================================================================
// XENITE SHIPS
// ============================================================================

// Placeholder for component ships referenced by Queen
export const XENITE: ShipDefinition = {
  id: 'XEN',
  name: 'Xenite',
  species: Species.XENITE,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_GREEN,
  graphics: [
    { filename: 'xenite.svg', condition: 'default' }
  ],
  basicCost: {
    lines: 2
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage',
      isOptional: false
    }
  ]
};

export const ANTLION: ShipDefinition = {
  id: 'ANT',
  name: 'Antlion',
  species: Species.XENITE,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_PURPLE,
  graphics: [
    { filename: 'antlion.svg', condition: 'default' }
  ],
  basicCost: {
    lines: 3
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage',
      isOptional: false
    }
  ]
};

export const BUG_BREEDER: ShipDefinition = {
  id: 'BRD',
  name: 'Bug Breeder',
  species: Species.XENITE,
  type: ShipType.BASIC,
  color: SHIP_COLORS.PASTEL_BLUE,
  graphics: [
    { filename: 'bugbreeder3.svg', condition: 'charges_remaining', chargesRequired: 3 },
    { filename: 'bugbreeder2.svg', condition: 'charges_remaining', chargesRequired: 2 },
    { filename: 'bugbreeder1.svg', condition: 'charges_remaining', chargesRequired: 1 },
    { filename: 'bugbreeder0.svg', condition: 'depleted', chargesRequired: 0 }
  ],
  basicCost: {
    lines: 4
  },
  maxCharges: 3,
  chargesPerTurn: 1,
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Xenite (uses 1 charge)',
      requiresCharge: true,
      isOptional: false,
      specialLogic: {
        customLogicId: 'build_xenite'
      }
    }
  ],
  description: 'Builds a Xenite each turn for 3 turns, then is depleted.'
};

export const QUEEN: ShipDefinition = {
  id: 'QUE',
  name: 'Queen',
  species: Species.XENITE,
  type: ShipType.UPGRADED,
  color: SHIP_COLORS.CYAN,
  graphics: [
    { filename: 'queen.svg', condition: 'default' }
  ],
  upgradedCost: {
    componentShips: [
      { shipId: 'XEN', quantity: 1, mustBeDepleted: false },
      { shipId: 'ANT', quantity: 2, mustBeDepleted: false },
      { shipId: 'BRD', quantity: 1, mustBeDepleted: true } // Must be depleted
    ],
    joiningLines: 6,
    totalLines: 20 // XEN(2) + ANT(3)*2 + BRD(4) + joining(6) = 20
  },
  powers: [
    {
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      effectType: PowerEffectType.BUILD_SHIP,
      description: 'Build a Xenite',
      isOptional: false,
      specialLogic: {
        customLogicId: 'build_xenite'
      }
    },
    {
      powerIndex: 2,
      phase: ShipPowerPhase.AUTOMATIC,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 3,
      description: 'Deal 3 damage for each ship you made this turn',
      isOptional: false,
      specialLogic: {
        countType: 'ships_built_this_turn',
        countMultiplier: 3,
        excludeShipsFrom: ['QUE'], // Excludes ships built from Queens
        customLogicId: 'queen_count_damage'
      }
    }
  ],
  rulesNotes: 'Does not count ships built from this Queen or other Queens. Includes all drawn ships, upgraded ships, ships from Bug Breeders, Zeniths, Sacrificial Pools.'
};

// ============================================================================
// SHIP REGISTRY
// ============================================================================

// Central registry of all ship definitions
export const SHIP_REGISTRY: Record<string, ShipDefinition> = {
  // Human
  DEF: DEFENDER,
  INT: INTERCEPTOR,
  FIG: FIGHTER,
  ORB: ORBITAL,
  BTC: BATTLECRUISER,
  
  // Xenite
  XEN: XENITE,
  ANT: ANTLION,
  BRD: BUG_BREEDER,
  QUE: QUEEN
};

// Helper function to get ship definition
export function getShipDefinition(shipId: string): ShipDefinition | undefined {
  return SHIP_REGISTRY[shipId];
}

// Helper function to get all ships for a species
export function getShipsBySpecies(species: Species): ShipDefinition[] {
  return Object.values(SHIP_REGISTRY).filter(ship => ship.species === species);
}

// Helper function to get all basic ships for a species
export function getBasicShipsBySpecies(species: Species): ShipDefinition[] {
  return Object.values(SHIP_REGISTRY).filter(
    ship => ship.species === species && ship.type === ShipType.BASIC
  );
}

// Helper function to get all upgraded ships for a species
export function getUpgradedShipsBySpecies(species: Species): ShipDefinition[] {
  return Object.values(SHIP_REGISTRY).filter(
    ship => ship.species === species && ship.type === ShipType.UPGRADED
  );
}
