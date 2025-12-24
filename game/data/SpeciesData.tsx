// ⚠️ DEPRECATED - This file is kept for GameTestInterface.tsx only
// Production code should use ShipDefinitions.tsx instead
// This file will be removed when test interface is migrated
//
// Centralized species and ship data for Shapeships
// Supports cross-species ship copying/stealing and future species expansion

// Species categories for organization and future expansion
export enum SpeciesCategory {
  OFFICIAL = 'official',
  UNOFFICIAL = 'unofficial'
}

// Base species interface
export interface Species {
  id: string;
  name: string;
  category: SpeciesCategory;
  description?: string;
  specialMechanics: SpecialMechanic[];
  ships: Ship[];
  // Solar Powers (Ancient species only)
  solarPowers?: SolarPower[];
  // Graphics reference - maps to /graphics/{species}/assets.tsx
  graphicsFolder: string;
}

// Special mechanics that apply to entire species
export interface SpecialMechanic {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'active' | 'triggered';
  // When this mechanic applies (e.g., 'game_start', 'turn_start', 'ship_destroyed')
  triggers?: string[];
}

// Ship definition with power requirements for subphases
export interface Ship {
  id: string;
  name: string;
  speciesId: string; // Original species, even if copied/stolen
  category: ShipCategory;
  // Basic ship costs
  lineCost: number;
  // Upgraded ship requirements (only for upgraded ships)
  upgradeRequirements?: UpgradeRequirement[];
  joiningLinesCost?: number; // Additional lines needed beyond basic ships
  // Ship stats
  healthValue: number; // Health provided when ship is destroyed
  damageValue: number; // Damage dealt in battle phase
  energyGeneration?: number; // Energy generated per turn (Ancient ships only)
  joiningLinesGeneration?: number; // Joining lines generated per turn (Centaur ships only)
  powers: ShipPower[];
  // Copying/stealing mechanics
  canBeCopied: boolean;
  canBeStolen: boolean;
  copyRestrictions?: string[]; // Species IDs that cannot copy this ship
  stealRestrictions?: string[]; // Species IDs that cannot steal this ship
}

// Ship categories for different building mechanics
export enum ShipCategory {
  BASIC = 'basic',
  UPGRADED = 'upgraded',
  SOLAR_POWER = 'solar_power' // Ancient Solar Powers (not ships but powers)
}

// Requirements for building upgraded ships
export interface UpgradeRequirement {
  shipId: string; // Basic ship ID required
  quantity: number; // Number of this ship needed
}

// Individual ship powers - phase requirements will be defined when implementing power system
export interface ShipPower {
  id: string;
  name: string;
  description: string;
  // Power type affects when and how it can be used
  type: 'passive' | 'activated' | 'triggered' | 'once_only_automatic';
  // Timing priority (for multiple powers in same phase)
  priority?: number;
  // Resource costs
  costs?: PowerCost[];
  // Targeting and effects
  targeting?: PowerTargeting;
  effects: PowerEffect[];
  // Scaling mechanics
  scaling?: PowerScaling;
}

// Power scaling for effects that count things
export interface PowerScaling {
  type: 'count_ships' | 'count_species' | 'count_health' | 'count_lines' | 'count_joining_lines' | 'count_energy' | 'flat';
  filter?: ScalingFilter; // What to count
  multiplier?: number; // Multiply the count by this (default 1)
  baseAmount?: number; // Add this to the scaled amount
  maxAmount?: number; // Cap the effect at this amount
}

export interface ScalingFilter {
  shipTypes?: string[]; // Count specific ship types
  species?: string[]; // Count ships from specific species
  owner?: 'self' | 'opponent' | 'all'; // Whose things to count
  condition?: string; // Additional conditions (e.g., 'destroyed', 'in_play')
}

export interface PowerCost {
  type: 'lines' | 'joining_lines' | 'health' | 'charges' | 'ships' | 'energy'; // Added joining_lines for Centaur species
  amount: number;
  // Optional conditions for the cost
  conditions?: string[];
}

// Solar Power definition (Ancient species special powers) - phase requirements TBD
export interface SolarPower {
  id: string;
  name: string;
  description: string;
  energyCost: number; // Energy required to use this Solar Power
  // Targeting and effects
  targeting?: PowerTargeting;
  effects: PowerEffect[];
  // Scaling mechanics
  scaling?: PowerScaling;
}

export interface PowerTargeting {
  type: 'self' | 'ally' | 'enemy' | 'any_player' | 'all_players';
  range?: 'unlimited' | 'adjacent' | 'same_zone';
  filters?: string[]; // Additional targeting restrictions
}

export interface PowerEffect {
  type: 'damage' | 'healing' | 'lines' | 'joining_lines' | 'energy' | 'build_ship' | 'destroy_ship' | 'move_ship' | 'modify_stats' | 'special';
  amount?: number;
  target?: 'owner' | 'opponent' | 'all_players' | 'self_ship' | 'target_ship'; // Clarified targeting
  conditions?: string[];
  // Special effects for unique mechanics
  specialData?: any;
}

// ============================================================================
// OFFICIAL SPECIES DATA
// ============================================================================

export const OFFICIAL_SPECIES: Species[] = [
  {
    id: 'human',
    name: 'Human',
    category: SpeciesCategory.OFFICIAL,
    description: 'Placeholder - awaiting detailed species mechanics',
    graphicsFolder: 'human',
    specialMechanics: [
      // Placeholder - will be filled when you provide mechanics
      {
        id: 'human_special',
        name: 'Human Special Mechanic',
        description: 'To be defined based on your specifications',
        type: 'passive'
      }
    ],
    ships: [
      // Basic ships for testing
      {
        id: 'defender',
        name: 'Defender',
        speciesId: 'human',
        category: ShipCategory.BASIC,
        lineCost: 2,
        healthValue: 1,
        damageValue: 0,
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'defender_heal',
            name: 'Heal',
            description: 'Heal 1 during automatic phase',
            type: 'passive',
            effects: [
              {
                type: 'healing',
                amount: 1,
                target: 'owner'
              }
            ]
          }
        ]
      },
      {
        id: 'fighter',
        name: 'Fighter',
        speciesId: 'human',
        category: ShipCategory.BASIC,
        lineCost: 3,
        healthValue: 1,
        damageValue: 1,
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'fighter_attack',
            name: 'Attack',
            description: 'Deal 1 damage during automatic phase',
            type: 'passive',
            effects: [
              {
                type: 'damage',
                amount: 1,
                target: 'opponent'
              }
            ]
          }
        ]
      },
      {
        id: 'interceptor',
        name: 'Interceptor',
        speciesId: 'human',
        category: ShipCategory.BASIC,
        lineCost: 2,
        healthValue: 1,
        damageValue: 2,
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'first_strike',
            name: 'First Strike',
            description: 'Attacks before other ships in battle',
            type: 'activated',
            priority: 1,
            effects: [
              {
                type: 'damage',
                amount: 2,
                target: 'opponent'
              }
            ]
          }
        ]
      },
      {
        id: 'constructor',
        name: 'Constructor',
        speciesId: 'human',
        category: ShipCategory.BASIC,
        lineCost: 3,
        healthValue: 2,
        damageValue: 0,
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'build_ships',
            name: 'Build Ships',
            description: 'Can build other ships during build phase',
            type: 'activated',
            costs: [
              {
                type: 'lines',
                amount: 1
              }
            ],
            effects: [
              {
                type: 'build_ship',
                target: 'owner',
                specialData: {
                  allowedShips: ['fighter', 'defender']
                }
              }
            ]
          }
        ]
      }
    ]
  },

  {
    id: 'xenite',
    name: 'Xenite',
    category: SpeciesCategory.OFFICIAL,
    description: 'Placeholder - awaiting detailed species mechanics',
    graphicsFolder: 'xenite',
    specialMechanics: [
      {
        id: 'xenite_special',
        name: 'Xenite Special Mechanic',
        description: 'To be defined based on your specifications',
        type: 'passive'
      }
    ],
    ships: [
      {
        id: 'xenite_basic',
        name: 'Xenite Basic Ship',
        speciesId: 'xenite',
        category: ShipCategory.BASIC,
        lineCost: 1,
        healthValue: 1,
        damageValue: 1,
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'xenite_basic_power',
            name: 'Basic Power',
            description: 'Placeholder power',
            type: 'passive',
            effects: [
              {
                type: 'damage',
                amount: 1
              }
            ]
          }
        ]
      }
    ]
  },

  {
    id: 'centaur',
    name: 'Centaur',
    category: SpeciesCategory.OFFICIAL,
    description: 'Centaur species uses both normal lines and specialized joining lines for ship construction',
    graphicsFolder: 'centaur',
    specialMechanics: [
      {
        id: 'dual_line_system',
        name: 'Dual Line System',
        description: 'Centaurs generate both normal lines and joining lines for enhanced ship building',
        type: 'passive'
      },
      {
        id: 'joining_line_generation',
        name: 'Joining Line Generation',
        description: 'Some Centaur ships generate joining lines that can only be used for upgrading ships',
        type: 'passive'
      }
    ],
    ships: [
      {
        id: 'centaur_basic',
        name: 'Centaur Basic Ship',
        speciesId: 'centaur',
        category: ShipCategory.BASIC,
        lineCost: 1, // Built with normal lines
        healthValue: 1,
        damageValue: 1,
        joiningLinesGeneration: 1, // ALSO generates 1 joining line per turn (additional resource)
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'centaur_basic_power',
            name: 'Basic Power',
            description: 'Placeholder power',
            type: 'passive',
            effects: [
              {
                type: 'damage',
                amount: 1
              }
            ]
          }
        ]
      }
    ]
  },

  {
    id: 'ancient',
    name: 'Ancient',
    category: SpeciesCategory.OFFICIAL,
    description: 'Ancient species uses both lines (for ship building) and energy (for Solar Powers)',
    graphicsFolder: 'ancient',
    specialMechanics: [
      {
        id: 'dual_resource_system',
        name: 'Dual Resource System',
        description: 'Ancients use lines for ships AND energy for Solar Powers',
        type: 'passive'
      },
      {
        id: 'solar_powers',
        name: 'Solar Powers',
        description: 'Ancients have access to Solar Powers during charge subphases using energy',
        type: 'active',
        triggers: ['charge_declaration', 'charge_response']
      }
    ],
    solarPowers: [
      // Example Solar Powers - to be replaced with actual Solar Powers
      {
        id: 'solar_blast',
        name: 'Solar Blast',
        description: 'Deal damage using energy (not lines)',
        energyCost: 2,
        effects: [
          {
            type: 'damage',
            amount: 3,
            target: 'opponent'
          }
        ]
      },
      {
        id: 'solar_heal',
        name: 'Solar Heal',
        description: 'Heal using energy (not lines)',
        energyCost: 1,
        effects: [
          {
            type: 'healing',
            amount: 2,
            target: 'owner'
          }
        ]
      }
    ],
    ships: [
      {
        id: 'ancient_basic',
        name: 'Ancient Basic Ship',
        speciesId: 'ancient',
        category: ShipCategory.BASIC,
        lineCost: 1, // Built with lines like all ships
        healthValue: 1,
        damageValue: 1,
        energyGeneration: 1, // ALSO generates 1 energy per turn (additional resource)
        canBeCopied: true,
        canBeStolen: true,
        powers: [
          {
            id: 'ancient_basic_power',
            name: 'Basic Power',
            description: 'Placeholder power',
            type: 'passive',
            effects: [
              {
                type: 'damage',
                amount: 1
              }
            ]
          }
        ]
      }
    ]
  }
];

// ============================================================================
// EXAMPLE SHIPS WITH SUBPHASE REQUIREMENTS (for reference/testing)
// ============================================================================

// Example Guardian ship (mentioned in GamePhases as having First Strike)
export const EXAMPLE_GUARDIAN: Ship = {
  id: 'guardian',
  name: 'Guardian',
  speciesId: 'human', // Example assignment
  category: ShipCategory.BASIC,
  lineCost: 3,
  healthValue: 2,
  damageValue: 2,
  canBeCopied: true,
  canBeStolen: false, // Example restriction
  powers: [
    {
      id: 'first_strike',
      name: 'First Strike',
      description: 'Acts first in Battle Phase',
      type: 'activated',
      priority: 1,
      effects: [
        {
          type: 'damage',
          amount: 2
        }
      ]
    },
    {
      id: 'guardian_damage',
      name: 'Combat Damage',
      description: 'Standard combat damage',
      type: 'passive',
      effects: [
        {
          type: 'damage',
          amount: 2
        }
      ]
    }
  ]
};

// Example Shipyard (mentioned in GamePhases as building ships)
export const EXAMPLE_SHIPYARD: Ship = {
  id: 'shipyard',
  name: 'Shipyard',
  speciesId: 'human', // Example assignment
  category: ShipCategory.BASIC,
  lineCost: 4,
  healthValue: 3,
  damageValue: 0,
  canBeCopied: true,
  canBeStolen: true,
  powers: [
    {
      id: 'build_ships',
      name: 'Build Ships',
      description: 'Can build other ships before Drawing phase',
      type: 'activated',
      costs: [
        {
          type: 'lines',
          amount: 1 // Variable based on ship being built
        }
      ],
      targeting: {
        type: 'self'
      },
      effects: [
        {
          type: 'build_ship',
          specialData: {
            shipTypes: ['basic', 'fighter'] // Example allowed ships
          }
        }
      ]
    }
  ]
};

// ============================================================================
// EXAMPLE UPGRADED SHIPS
// ============================================================================

// Example Upgraded Ship: Super Guardian (requires 2 Guardians + 1 Fighter)
export const EXAMPLE_SUPER_GUARDIAN: Ship = {
  id: 'super_guardian',
  name: 'Super Guardian',
  speciesId: 'human',
  category: ShipCategory.UPGRADED,
  lineCost: 0, // Not built with lines directly
  upgradeRequirements: [
    { shipId: 'guardian', quantity: 2 },
    { shipId: 'fighter', quantity: 1 }
  ],
  joiningLinesCost: 3, // Additional lines needed beyond the ships
  healthValue: 5,
  damageValue: 4,
  canBeCopied: false, // Upgraded ships harder to copy
  canBeStolen: false,
  powers: [
    {
      id: 'super_first_strike',
      name: 'Enhanced First Strike',
      description: 'Powerful first strike that scales with other ships',
      type: 'activated',
      priority: 1,
      scaling: {
        type: 'count_ships',
        filter: { owner: 'self', shipTypes: ['guardian', 'fighter'] },
        multiplier: 1,
        baseAmount: 3,
        maxAmount: 8
      },
      effects: [
        {
          type: 'damage',
          amount: 0, // Will be calculated by scaling
          target: 'opponent'
        }
      ]
    }
  ]
};

// Example Ancient Energy Generator (built with lines, generates energy)
export const EXAMPLE_ENERGY_GENERATOR: Ship = {
  id: 'solar_collector',
  name: 'Solar Collector',
  speciesId: 'ancient',
  category: ShipCategory.BASIC,
  lineCost: 2, // Built with lines (like all ships)
  healthValue: 1,
  damageValue: 0,
  energyGeneration: 3, // Generates energy for Solar Powers (additional resource)
  canBeCopied: true,
  canBeStolen: true,
  powers: [
    {
      id: 'energy_boost',
      name: 'Energy Boost',
      description: 'Generate extra energy upon completion (bonus to energy generation)',
      type: 'triggered',
      effects: [
        {
          type: 'energy',
          amount: 2,
          target: 'owner'
        }
      ]
    }
  ]
};

// Example Centaur Joining Lines Generator (built with lines, generates joining lines)
export const EXAMPLE_CENTAUR_FORGEMASTER: Ship = {
  id: 'centaur_forgemaster',
  name: 'Centaur Forgemaster',
  speciesId: 'centaur',
  category: ShipCategory.BASIC,
  lineCost: 3, // Built with normal lines (like all ships)
  healthValue: 2,
  damageValue: 1,
  joiningLinesGeneration: 2, // Generates joining lines for upgrades (specialized resource)
  canBeCopied: true,
  canBeStolen: true,
  powers: [
    {
      id: 'forge_enhancement',
      name: 'Forge Enhancement',
      description: 'Generate extra joining lines upon completion (bonus to joining line generation)',
      type: 'triggered',
      effects: [
        {
          type: 'joining_lines',
          amount: 1,
          target: 'owner'
        }
      ]
    }
  ]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Get all species (for future expansion with unofficial species)
export function getAllSpecies(): Species[] {
  return [...OFFICIAL_SPECIES];
}

// Get species by ID
export function getSpeciesById(speciesId: string): Species | null {
  return getAllSpecies().find(species => species.id === speciesId) || null;
}

// Get all ships from all species (for copying/stealing mechanics)
export function getAllShips(): Ship[] {
  return getAllSpecies().flatMap(species => species.ships);
}

// Get ship by ID (searches across all species)
export function getShipById(shipId: string): Ship | null {
  return getAllShips().find(ship => ship.id === shipId) || null;
}

// Get ships available to a species (including copied/stolen)
export function getAvailableShips(speciesId: string, ownedShips: string[] = []): Ship[] {
  const species = getSpeciesById(speciesId);
  if (!species) return [];

  const availableShips = [...species.ships];
  
  // Add copied/stolen ships based on owned ships
  // This would be implemented based on your specific copying/stealing rules
  
  return availableShips;
}

// Check if a ship can be copied by a species
export function canSpeciesCopyShip(speciesId: string, ship: Ship): boolean {
  if (!ship.canBeCopied) return false;
  if (ship.copyRestrictions?.includes(speciesId)) return false;
  return true;
}

// Check if a ship can be stolen by a species
export function canSpeciesStealShip(speciesId: string, ship: Ship): boolean {
  if (!ship.canBeStolen) return false;
  if (ship.stealRestrictions?.includes(speciesId)) return false;
  return true;
}

// ============================================================================
// SHIP UPGRADING MECHANICS
// ============================================================================

// Check if player can build an upgraded ship
export function canBuildUpgradedShip(upgradedShip: Ship, playerShips: Ship[]): boolean {
  if (upgradedShip.category !== ShipCategory.UPGRADED) return false;
  if (!upgradedShip.upgradeRequirements) return false;

  // Count available basic ships
  const availableShips = new Map<string, number>();
  playerShips.forEach(ship => {
    if (ship.category === ShipCategory.BASIC) {
      availableShips.set(ship.id, (availableShips.get(ship.id) || 0) + 1);
    }
  });

  // Check if all requirements are met
  return upgradedShip.upgradeRequirements.every(req => {
    const available = availableShips.get(req.shipId) || 0;
    return available >= req.quantity;
  });
}

// Get the basic ships that would be consumed when building an upgraded ship
export function getUpgradeRequiredShips(upgradedShip: Ship): UpgradeRequirement[] {
  return upgradedShip.upgradeRequirements || [];
}

// Calculate total cost for building an upgraded ship (joining lines + basic ships)
export function calculateUpgradeCost(upgradedShip: Ship): { joiningLines: number; requiredShips: UpgradeRequirement[] } {
  return {
    joiningLines: upgradedShip.joiningLinesCost || 0,
    requiredShips: upgradedShip.upgradeRequirements || []
  };
}

// ============================================================================
// ANCIENT ENERGY SYSTEM
// ============================================================================
// NOTE: Ancient species gets BOTH lines (like all species) AND energy (unique resource)
// - Lines: Used for building ships (like all species)
// - Energy: Additional resource used for Solar Powers only

// Calculate total energy generation for a player per turn (from Ancient ships)
export function calculateEnergyGeneration(playerShips: Ship[]): number {
  return playerShips.reduce((total, ship) => {
    if (ship.category !== ShipCategory.BASIC && ship.category !== ShipCategory.UPGRADED) return total;
    return total + (ship.energyGeneration || 0);
  }, 0);
}

// Get available Solar Powers for Ancient species
export function getAvailableSolarPowers(speciesId: string): SolarPower[] {
  if (speciesId !== 'ancient') return [];
  
  const ancientSpecies = getSpeciesById('ancient');
  return ancientSpecies?.solarPowers || [];
}

// Check if player can use a Solar Power (requires sufficient energy)
export function canUseSolarPower(solarPower: SolarPower, playerEnergy: number): boolean {
  return playerEnergy >= solarPower.energyCost;
}

// Calculate energy cost for multiple Solar Powers
export function calculateTotalEnergyCost(solarPowers: SolarPower[]): number {
  return solarPowers.reduce((total, power) => total + power.energyCost, 0);
}

// ============================================================================
// CENTAUR JOINING LINES SYSTEM
// ============================================================================
// NOTE: Centaur species gets BOTH lines (like all species) AND joining lines (upgrade resource)
// - Lines: Used for building ships (like all species) and can also be used as joining lines
// - Joining Lines: Specialized resource that can ONLY be used for joining (upgrading ships)

// Calculate total joining lines generation for a player per turn (from Centaur ships)
export function calculateJoiningLinesGeneration(playerShips: Ship[]): number {
  return playerShips.reduce((total, ship) => {
    if (ship.category !== ShipCategory.BASIC && ship.category !== ShipCategory.UPGRADED) return total;
    return total + (ship.joiningLinesGeneration || 0);
  }, 0);
}

// Check if player can afford to upgrade a ship (considering both line types)
export function canAffordUpgrade(upgradedShip: Ship, playerLines: number, playerJoiningLines: number): boolean {
  const upgradeCost = upgradedShip.joiningLinesCost || 0;
  const totalAvailableForJoining = playerLines + playerJoiningLines; // Normal lines can be used as joining lines
  return totalAvailableForJoining >= upgradeCost;
}

// Calculate optimal line usage for upgrade (prefer using joining lines first)
export function calculateOptimalUpgradePayment(upgradeCost: number, playerLines: number, playerJoiningLines: number): {
  useJoiningLines: number;
  useNormalLines: number;
  canAfford: boolean;
} {
  const totalAvailable = playerLines + playerJoiningLines;
  
  if (totalAvailable < upgradeCost) {
    return { useJoiningLines: 0, useNormalLines: 0, canAfford: false };
  }
  
  // Prefer to use joining lines first (since they're specialized)
  const useJoiningLines = Math.min(playerJoiningLines, upgradeCost);
  const remainingCost = upgradeCost - useJoiningLines;
  const useNormalLines = Math.min(playerLines, remainingCost);
  
  return {
    useJoiningLines,
    useNormalLines,
    canAfford: true
  };
}

// Get Centaur ships that generate joining lines
export function getCentaurJoiningLineGenerators(playerShips: Ship[]): Ship[] {
  return playerShips.filter(ship => 
    ship.speciesId === 'centaur' && 
    (ship.joiningLinesGeneration || 0) > 0 &&
    !ship.isDestroyed &&
    !ship.isConsumedInUpgrade
  );
}

// ============================================================================
// POWER SCALING CALCULATIONS
// ============================================================================

// Calculate scaled effect amount based on power scaling
export function calculateScaledEffect(power: ShipPower, gameContext: any): number {
  if (!power.scaling || power.scaling.type === 'flat') {
    return power.effects[0]?.amount || 0;
  }

  let count = 0;
  const scaling = power.scaling;

  // This would be implemented based on actual game state structure
  switch (scaling.type) {
    case 'count_ships':
      count = gameContext.shipCount || 0;
      break;
    case 'count_species':
      count = gameContext.speciesCount || 0;
      break;
    case 'count_health':
      count = gameContext.healthCount || 0;
      break;
    case 'count_lines':
      count = gameContext.lineCount || 0;
      break;
    case 'count_joining_lines':
      count = gameContext.joiningLineCount || 0;
      break;
    case 'count_energy':
      count = gameContext.energyCount || 0;
      break;
  }

  const multiplier = scaling.multiplier || 1;
  const baseAmount = scaling.baseAmount || 0;
  let scaledAmount = (count * multiplier) + baseAmount;

  // Apply maximum cap if specified
  if (scaling.maxAmount !== undefined) {
    scaledAmount = Math.min(scaledAmount, scaling.maxAmount);
  }

  return scaledAmount;
}

// Export default species data for easy importing
export default {
  OFFICIAL_SPECIES,
  getAllSpecies,
  getSpeciesById,
  getAllShips,
  getShipById,
  getAvailableShips,
  canSpeciesCopyShip,
  canSpeciesStealShip,
  // Ship upgrading mechanics
  canBuildUpgradedShip,
  getUpgradeRequiredShips,
  calculateUpgradeCost,
  // Ancient energy system
  calculateEnergyGeneration,
  getAvailableSolarPowers,
  canUseSolarPower,
  calculateTotalEnergyCost,
  // Centaur joining lines system
  calculateJoiningLinesGeneration,
  canAffordUpgrade,
  calculateOptimalUpgradePayment,
  getCentaurJoiningLineGenerators,
  // Power scaling
  calculateScaledEffect
};