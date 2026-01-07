/**
 * ENERGY COST TYPES - UNIFIED SCHEMA
 * 
 * Single source of truth for Solar Power energy cost structure.
 * 
 * USAGE:
 * - Core layer (ShipDefinitions.core.ts): Uses EnergyCost for ship data
 * - Engine layer (ShipDefinitions.engine.ts): Converts to optional-field version with 'variable' property
 * - UI components: Use EnergyCost for rendering energy displays
 * 
 * CANONICAL STRUCTURE (Core/UI):
 * - red: number (required, defaults to 0)
 * - green: number (required, defaults to 0)
 * - blue: number (required, defaults to 0)
 * - xBlue: boolean (true = variable blue cost based on ship lines)
 * 
 * ENGINE STRUCTURE (ShipTypes.engine.ts):
 * - red?: number (optional)
 * - green?: number (optional)
 * - blue?: number (optional)
 * - variable?: 'ship_line_cost' (for X blue)
 * 
 * NOTE: Pink is NOT an energy color - it's a dice color for Chronoswarm.
 */

/**
 * Energy cost for Solar Powers
 * All fields required (use 0 for unused colors)
 */
export interface EnergyCost {
  /** Red energy required */
  red: number;
  
  /** Green energy required */
  green: number;
  
  /** Blue energy required (fixed amount) */
  blue: number;
  
  /** Variable blue energy (X = number of lines in ship) */
  xBlue: boolean;
}

/**
 * Create an empty energy cost (zero energy)
 */
export function createEmptyEnergyCost(): EnergyCost {
  return {
    red: 0,
    green: 0,
    blue: 0,
    xBlue: false
  };
}

/**
 * Check if energy cost is empty (all zeros, no X blue)
 */
export function isEmptyEnergyCost(cost: EnergyCost): boolean {
  return cost.red === 0 && cost.green === 0 && cost.blue === 0 && !cost.xBlue;
}

/**
 * Check if player has sufficient energy to pay cost
 * 
 * @param playerEnergy - Player's current energy reserves
 * @param cost - Energy cost to check
 * @param shipLines - Number of lines in ship (for X blue cost)
 * @returns true if player can afford cost
 */
export function canAffordEnergyCost(
  playerEnergy: EnergyCost,
  cost: EnergyCost,
  shipLines: number = 0
): boolean {
  const blueRequired = cost.xBlue ? shipLines : cost.blue;
  
  return (
    playerEnergy.red >= cost.red &&
    playerEnergy.green >= cost.green &&
    playerEnergy.blue >= blueRequired
  );
}

/**
 * Subtract energy cost from player energy
 * 
 * @param playerEnergy - Player's current energy reserves
 * @param cost - Energy cost to deduct
 * @param shipLines - Number of lines in ship (for X blue cost)
 * @returns New energy state after deduction
 */
export function deductEnergyCost(
  playerEnergy: EnergyCost,
  cost: EnergyCost,
  shipLines: number = 0
): EnergyCost {
  const blueRequired = cost.xBlue ? shipLines : cost.blue;
  
  return {
    red: playerEnergy.red - cost.red,
    green: playerEnergy.green - cost.green,
    blue: playerEnergy.blue - blueRequired,
    xBlue: false // Player energy never has xBlue
  };
}

/**
 * Add energy to player energy reserves
 * 
 * @param playerEnergy - Player's current energy reserves
 * @param gain - Energy to add
 * @returns New energy state after addition
 */
export function addEnergy(
  playerEnergy: EnergyCost,
  gain: Partial<EnergyCost>
): EnergyCost {
  return {
    red: playerEnergy.red + (gain.red ?? 0),
    green: playerEnergy.green + (gain.green ?? 0),
    blue: playerEnergy.blue + (gain.blue ?? 0),
    xBlue: false // Player energy never has xBlue
  };
}