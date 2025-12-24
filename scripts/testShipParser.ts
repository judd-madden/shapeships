// Test CSV Parser
// Run this to test the ship CSV parser and generate ShipDefinitions.tsx

import { parseAllShips, validateShipDefinition } from './parseShipCSV';
import type { ShipDefinition } from '../game/types/ShipTypes';

// ============================================================================
// SAMPLE CSV DATA (Replace with actual CSV)
// ============================================================================

// To use this script:
// 1. Replace the sampleCSVData array with actual CSV data
// 2. Run: npx tsx scripts/testShipParser.ts
// 3. Review output and add manual overrides as needed
// 4. Generate ShipDefinitions.tsx

const sampleCSVData = [
  // Example row structure:
  {
    SPECIES: 'Human',
    'SHIP TYPE': 'Basic',
    'SHIP NAME': 'Defender',
    ID: 'DEF',
    'TOTAL LINE COST': '1',
    'JOINING LINE COST': '-',
    'COMPONENT SHIPS': '-',
    'NUMBER OF POWERS': '1',
    CHARGES: '-',
    'POWER 1 SUBPHASE': 'Automatic',
    'POWER 1': 'Heal 1',
    'POWER 2 SUBPHASE': '-',
    'POWER 2': '-',
    'POWER 3 SUBPHASE': '-',
    'POWER 3': '-',
    'EXTRA RULES': '-',
    'STACK CAPTION': 'DEF',
    COLOUR: 'Pastel Green',
    'NUMBER OF GRAPHICS': '1'
  }
  // Add more ships here...
];

// ============================================================================
// RUN PARSER
// ============================================================================

function testParser() {
  console.log('🚀 Starting ship CSV parser test...\n');
  
  // Parse all ships
  const ships = parseAllShips(sampleCSVData);
  
  console.log(`\n✅ Parsed ${ships.length} ships\n`);
  
  // Validate each ship
  let validCount = 0;
  let invalidCount = 0;
  const invalidShips: Array<{ ship: ShipDefinition; errors: string[] }> = [];
  
  for (const ship of ships) {
    const validation = validateShipDefinition(ship);
    if (validation.valid) {
      validCount++;
    } else {
      invalidCount++;
      invalidShips.push({ ship, errors: validation.errors });
    }
  }
  
  console.log(`✅ Valid ships: ${validCount}`);
  console.log(`❌ Invalid ships: ${invalidCount}\n`);
  
  // Show invalid ships
  if (invalidShips.length > 0) {
    console.log('❌ Ships needing attention:\n');
    for (const { ship, errors } of invalidShips) {
      console.log(`  ${ship.id} (${ship.name}):`);
      for (const error of errors) {
        console.log(`    - ${error}`);
      }
      console.log('');
    }
  }
  
  // Count ships by species
  const bySpecies = ships.reduce((acc, ship) => {
    acc[ship.species] = (acc[ship.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📊 Ships by species:');
  for (const [species, count] of Object.entries(bySpecies)) {
    console.log(`  ${species}: ${count}`);
  }
  
  // Identify complex ships needing manual overrides
  console.log('\n⚠️  Ships likely needing manual overrides:\n');
  
  for (const ship of ships) {
    const needsOverride = ship.powers.some(power => 
      power.effectType === 'custom' || 
      power.effectType === 'conditional' ||
      power.requiresPlayerChoice === true ||
      power.specialLogic?.customLogicId
    );
    
    if (needsOverride) {
      console.log(`  ${ship.id} (${ship.name})`);
      for (const power of ship.powers) {
        if (power.effectType === 'custom' || power.effectType === 'conditional' || power.requiresPlayerChoice) {
          console.log(`    - Power ${power.powerIndex}: ${power.description}`);
        }
      }
    }
  }
  
  console.log('\n✅ Parser test complete!');
  
  return ships;
}

// ============================================================================
// GENERATE SHIP DEFINITIONS FILE
// ============================================================================

function generateShipDefinitionsFile(ships: ShipDefinition[]): string {
  // Separate ships from solar powers
  const regularShips = ships.filter(ship => ship.type !== ShipType.SOLAR_POWER);
  const solarPowers = ships.filter(ship => ship.type === ShipType.SOLAR_POWER);
  
  let output = `// Ship Definitions - Auto-generated from CSV
// Generated: ${new Date().toISOString()}
// Total Ships: ${regularShips.length}
// DO NOT EDIT MANUALLY - Regenerate using: npx tsx scripts/testShipParser.ts

import type { ShipDefinition } from '../types/ShipTypes';
import { 
  ShipType, 
  Species, 
  ShipPowerPhase,
  PowerTiming,
  PowerEffectType
} from '../types/ShipTypes';

// ============================================================================
// SHIP DEFINITIONS (${regularShips.length} ships)
// ============================================================================

export const SHIP_DEFINITIONS: ShipDefinition[] = [\n`;
  
  for (const ship of regularShips) {
    // Clean up the JSON representation
    const shipJSON = JSON.stringify(ship, null, 2)
      .replace(/"([^"]+)":/g, '$1:')  // Remove quotes from keys
      .replace(/"/g, "'");  // Use single quotes
    
    output += `  ${shipJSON},\n\n`;
  }
  
  output += `];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ship definition by ID
 * @example getShipById('DEF') // Returns Defender definition
 */
export function getShipById(id: string): ShipDefinition | undefined {
  return SHIP_DEFINITIONS.find(ship => ship.id === id);
}

/**
 * Get all ships of a specific species
 * @example getShipsBySpecies(Species.HUMAN) // Returns all Human ships
 */
export function getShipsBySpecies(species: Species): ShipDefinition[] {
  return SHIP_DEFINITIONS.filter(ship => ship.species === species);
}

/**
 * Get all basic ships, optionally filtered by species
 * @example getBasicShips(Species.XENITE) // Returns Xenite basic ships
 */
export function getBasicShips(species?: Species): ShipDefinition[] {
  const basicShips = SHIP_DEFINITIONS.filter(ship => ship.type === ShipType.BASIC);
  return species ? basicShips.filter(ship => ship.species === species) : basicShips;
}

/**
 * Get all upgraded ships, optionally filtered by species
 * @example getUpgradedShips(Species.CENTAUR) // Returns Centaur upgraded ships
 */
export function getUpgradedShips(species?: Species): ShipDefinition[] {
  const upgradedShips = SHIP_DEFINITIONS.filter(ship => ship.type === ShipType.UPGRADED);
  return species ? upgradedShips.filter(ship => ship.species === species) : upgradedShips;
}

/**
 * Get ships by type
 */
export function getShipsByType(type: ShipType): ShipDefinition[] {
  return SHIP_DEFINITIONS.filter(ship => ship.type === type);
}

/**
 * Check if a ship can be built with given line count
 */
export function canBuildShip(shipId: string, availableLines: number): boolean {
  const ship = getShipById(shipId);
  if (!ship) return false;
  
  if (ship.type === ShipType.BASIC && ship.basicCost) {
    return availableLines >= ship.basicCost.lines;
  }
  
  return false;
}

/**
 * Get ships by line cost range
 */
export function getShipsByLineCost(min: number, max: number, species?: Species): ShipDefinition[] {
  let filtered = SHIP_DEFINITIONS.filter(ship => {
    if (ship.type === ShipType.BASIC && ship.basicCost) {
      return ship.basicCost.lines >= min && ship.basicCost.lines <= max;
    }
    if (ship.type === ShipType.UPGRADED && ship.upgradedCost) {
      return ship.upgradedCost.totalLines >= min && ship.upgradedCost.totalLines <= max;
    }
    return false;
  });
  
  return species ? filtered.filter(ship => ship.species === species) : filtered;
}

// ============================================================================
// STATISTICS
// ============================================================================

export const SHIP_STATS = {
  total: ${regularShips.length},
  bySpecies: {
    human: ${regularShips.filter(s => s.species === Species.HUMAN).length},
    xenite: ${regularShips.filter(s => s.species === Species.XENITE).length},
    centaur: ${regularShips.filter(s => s.species === Species.CENTAUR).length},
    ancient: ${regularShips.filter(s => s.species === Species.ANCIENT).length}
  },
  byType: {
    basic: ${regularShips.filter(s => s.type === ShipType.BASIC).length},
    upgraded: ${regularShips.filter(s => s.type === ShipType.UPGRADED).length}
  }
};
`;
  
  return output;
}

function generateSolarPowerDefinitionsFile(ships: ShipDefinition[]): string {
  const solarPowers = ships.filter(ship => ship.type === ShipType.SOLAR_POWER);
  
  let output = `// Solar Power Definitions - Auto-generated from CSV
// Generated: ${new Date().toISOString()}
// Total Solar Powers: ${solarPowers.length}
// DO NOT EDIT MANUALLY - Regenerate using: npx tsx scripts/testShipParser.ts

import type { SolarPowerDefinition } from '../types/SolarPowerTypes';
import { ShipPowerPhase, PowerTiming, PowerEffectType } from '../types/ShipTypes';

// ============================================================================
// SOLAR POWER DEFINITIONS (${solarPowers.length} powers)
// ============================================================================

export const SOLAR_POWER_DEFINITIONS: SolarPowerDefinition[] = [\n`;
  
  for (const power of solarPowers) {
    // Convert ShipDefinition to SolarPowerDefinition format
    const solarJSON = JSON.stringify({
      id: power.id,
      name: power.name,
      energyCost: power.energyCost,
      powers: power.powers,
      rulesNotes: power.rulesNotes
    }, null, 2)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'");
    
    output += `  ${solarJSON},\n\n`;
  }
  
  output += `];

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
    return power.energyCost[color] !== undefined && power.energyCost[color] !== 0;
  });
}

/**
 * Check if player can cast solar power with available energy
 */
export function canCastSolarPower(
  powerId: string, 
  availableEnergy: { red: number; green: number; blue: number }
): boolean {
  const power = getSolarPowerById(powerId);
  if (!power || !power.energyCost) return false;
  
  // Handle variable cost (Simulacrum)
  if (typeof power.energyCost.red === 'string' ||
      typeof power.energyCost.green === 'string' ||
      typeof power.energyCost.blue === 'string') {
    // Variable cost - cannot determine without context
    return false;
  }
  
  return (
    availableEnergy.red >= (power.energyCost.red || 0) &&
    availableEnergy.green >= (power.energyCost.green || 0) &&
    availableEnergy.blue >= (power.energyCost.blue || 0)
  );
}

// ============================================================================
// STATISTICS
// ============================================================================

export const SOLAR_POWER_STATS = {
  total: ${solarPowers.length},
  byEnergyCost: {
    red: ${solarPowers.filter(p => p.energyCost?.red).length},
    green: ${solarPowers.filter(p => p.energyCost?.green).length},
    blue: ${solarPowers.filter(p => p.energyCost?.blue).length},
    mixed: ${solarPowers.filter(p => {
      const cost = p.energyCost;
      if (!cost) return false;
      const colors = [cost.red, cost.green, cost.blue].filter(c => c && c !== 0);
      return colors.length > 1;
    }).length}
  }
};
`;
  
  return output;
}

// ============================================================================
// RUN
// ============================================================================

if (require.main === module) {
  const ships = testParser();
  
  // Optionally generate the file
  // const fileContent = generateShipDefinitionsFile(ships);
  // fs.writeFileSync('../game/data/ShipDefinitions.tsx', fileContent);
}

export { testParser, generateShipDefinitionsFile, generateSolarPowerDefinitionsFile };