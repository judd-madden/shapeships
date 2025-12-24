// Solar Power Definitions - Auto-generated from CSV
// Generated: 2024-12-23
// Total Solar Powers: 9
// DO NOT EDIT MANUALLY - Regenerate using: npx tsx scripts/generateShipFiles.ts

import type { SolarPowerDefinition } from '../types/SolarPowerTypes';
import { ShipPowerPhase, PowerTiming, PowerEffectType } from '../types/ShipTypes';

// ============================================================================
// SOLAR POWER DEFINITIONS (9 powers)
// ============================================================================

export const SOLAR_POWER_DEFINITIONS: SolarPowerDefinition[] = [
  {
    id: 'SAST',
    name: 'Asteroid',
    energyCost: { red: 1 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage.'
    }]
  },

  {
    id: 'SSUP',
    name: 'Supernova',
    energyCost: { red: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'Deal damage equal to the dice roll +4.',
      specialLogic: {
        customLogicId: 'supernova_dice_plus_4',
        damageFormula: 'dice + 4'
      }
    }]
  },

  {
    id: 'SLIF',
    name: 'Life',
    energyCost: { green: 1 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 1,
      description: 'Heal 1.'
    }]
  },

  {
    id: 'SSTA',
    name: 'Star Birth',
    energyCost: { green: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'Heal equal to the dice roll +5.',
      specialLogic: {
        customLogicId: 'star_birth_dice_plus_5',
        healFormula: 'dice + 5'
      }
    }]
  },

  {
    id: 'SCON',
    name: 'Convert',
    energyCost: { blue: 1 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GAIN_LINES,
      baseAmount: 1,
      description: 'Generate an additional line next build phase.'
    }],
    rulesNotes: '* Convert is the only way energy can be converted back into lines. Lines can be saved.'
  },

  {
    id: 'SSIM',
    name: 'Simulacrum',
    energyCost: { blue: 'X' },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COPY_SHIP,
      baseAmount: 1,
      description: 'Make a copy of a basic enemy ship. X = Number of lines in ship.',
      requiresPlayerChoice: true,
      choiceType: 'target_selection',
      specialLogic: {
        customLogicId: 'simulacrum_copy',
        variableCostFormula: 'target_ship_lines',
        targetType: 'basic_only'
      }
    }],
    rulesNotes: 'Each ship may only be copied ONCE per turn. Ships with charges are copied as they are at the START of this turn. Copied ships CAN be upgraded. A Cube-cast makes an extra copy of target ship. Cannot copy Cube.'
  },

  {
    id: 'SSIP',
    name: 'Siphon',
    energyCost: { red: 2, green: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'Deal 1 damage for each Core you have. Heal 1 for each Core you have.',
      specialLogic: {
        customLogicId: 'siphon_count_cores',
        countType: 'cores',
        damagePerCore: 1,
        healPerCore: 1
      }
    }]
  },

  {
    id: 'SVOR',
    name: 'Vortex',
    energyCost: { red: 2, green: 2, blue: 1 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 2,
      description: 'Deal 2 damage for each TYPE of ship you have.',
      specialLogic: {
        countType: 'ship_types',
        countMultiplier: 1,
        damageMultiplier: 2
      }
    }]
  },

  {
    id: 'SBLA',
    name: 'Black Hole',
    energyCost: { red: 3, green: 3, blue: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DESTROY_SHIP,
      baseAmount: 2,
      description: 'Destroy TWO of the opponent\'s basic ships. Deal 4 damage.',
      requiresPlayerChoice: true,
      choiceType: 'target_selection',
      specialLogic: {
        customLogicId: 'black_hole_destroy_and_damage',
        destroyQuantity: 2,
        targetType: 'basic_only',
        additionalDamage: 4
      }
    }]
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get solar power definition by ID
 * @example getSolarPowerById('SAST') // Returns Asteroid definition
 */
export function getSolarPowerById(id: string): SolarPowerDefinition | undefined {
  return SOLAR_POWER_DEFINITIONS.find(power => power.id === id);
}

/**
 * Get all solar powers
 */
export function getAllSolarPowers(): SolarPowerDefinition[] {
  return SOLAR_POWER_DEFINITIONS;
}

/**
 * Get solar powers by energy cost type
 * @example getSolarPowersByEnergy('red') // Returns all red energy powers
 */
export function getSolarPowersByEnergy(color: 'red' | 'green' | 'blue'): SolarPowerDefinition[] {
  return SOLAR_POWER_DEFINITIONS.filter(power => {
    if (!power.energyCost) return false;
    const cost = power.energyCost[color];
    return cost !== undefined && cost !== 0 && cost !== '0';
  });
}

/**
 * Check if player can cast solar power with available energy
 */
export function canCastSolarPower(
  powerId: string, 
  availableEnergy: { red: number; green: number; blue: number },
  variableCost?: number
): boolean {
  const power = getSolarPowerById(powerId);
  if (!power || !power.energyCost) return false;
  
  // Handle variable cost (Simulacrum)
  if (power.energyCost.blue === 'X') {
    if (variableCost === undefined) return false;
    return availableEnergy.blue >= variableCost;
  }
  
  // Check each color
  const redCost = typeof power.energyCost.red === 'number' ? power.energyCost.red : 0;
  const greenCost = typeof power.energyCost.green === 'number' ? power.energyCost.green : 0;
  const blueCost = typeof power.energyCost.blue === 'number' ? power.energyCost.blue : 0;
  
  return (
    availableEnergy.red >= redCost &&
    availableEnergy.green >= greenCost &&
    availableEnergy.blue >= blueCost
  );
}

/**
 * Get energy cost for a solar power (handling variable costs)
 */
export function getEnergyCost(
  powerId: string,
  variableCost?: number
): { red: number; green: number; blue: number } | null {
  const power = getSolarPowerById(powerId);
  if (!power || !power.energyCost) return null;
  
  const cost = {
    red: typeof power.energyCost.red === 'number' ? power.energyCost.red : 0,
    green: typeof power.energyCost.green === 'number' ? power.energyCost.green : 0,
    blue: power.energyCost.blue === 'X' && variableCost !== undefined 
      ? variableCost 
      : typeof power.energyCost.blue === 'number' ? power.energyCost.blue : 0
  };
  
  return cost;
}

// ============================================================================
// STATISTICS
// ============================================================================

export const SOLAR_POWER_STATS = {
  total: 9,
  byEnergyCost: {
    red: 2,      // Asteroid, Supernova
    green: 2,    // Life, Star Birth
    blue: 2,     // Convert, Simulacrum
    mixed: 3     // Siphon, Vortex, Black Hole
  },
  byCostAmount: {
    low: 3,      // 1 energy: Asteroid, Life, Convert
    medium: 3,   // 2-3 single color: Supernova, Star Birth, Simulacrum(X)
    high: 3      // Mixed: Siphon(2+2), Vortex(2+2+1), Black Hole(3+3+3)
  }
};
