// Parse all ships and generate report
// This processes the CSV data and identifies ships needing manual overrides

import { SHIP_CSV_DATA } from './shipCSVData';
import { parseAllShips, validateShipDefinition } from './parseShipCSV';

console.log('='.repeat(80));
console.log('🚀 SHIP CSV PARSER - PHASE 2');
console.log('='.repeat(80));
console.log('');

// Parse all ships
console.log(`📋 Processing ${SHIP_CSV_DATA.length} ships from CSV...`);
const ships = parseAllShips(SHIP_CSV_DATA);

console.log('');
console.log('='.repeat(80));
console.log('✅ PARSING COMPLETE');
console.log('='.repeat(80));
console.log(`Total ships parsed: ${ships.length}`);
console.log('');

// Validate ships
let validCount = 0;
let invalidCount = 0;
const invalidShips: Array<{ ship: any; errors: string[] }> = [];

for (const ship of ships) {
  const validation = validateShipDefinition(ship);
  if (validation.valid) {
    validCount++;
  } else {
    invalidCount++;
    invalidShips.push({ ship, errors: validation.errors });
  }
}

console.log('📊 VALIDATION RESULTS:');
console.log(`  ✅ Valid ships: ${validCount}`);
console.log(`  ❌ Invalid ships: ${invalidCount}`);
console.log('');

// Show invalid ships (if any)
if (invalidShips.length > 0) {
  console.log('❌ Ships with validation errors:');
  console.log('');
  for (const { ship, errors } of invalidShips) {
    console.log(`  ${ship.id} (${ship.name}):`);
    for (const error of errors) {
      console.log(`    - ${error}`);
    }
  }
  console.log('');
}

// Count by species
const bySpecies: Record<string, number> = {};
for (const ship of ships) {
  bySpecies[ship.species] = (bySpecies[ship.species] || 0) + 1;
}

console.log('📊 Ships by species:');
for (const [species, count] of Object.entries(bySpecies)) {
  console.log(`  ${species}: ${count}`);
}
console.log('');

// Count by type
const byType: Record<string, number> = {};
for (const ship of ships) {
  byType[ship.type] = (byType[ship.type] || 0) + 1;
}

console.log('📊 Ships by type:');
for (const [type, count] of Object.entries(byType)) {
  console.log(`  ${type}: ${count}`);
}
console.log('');

// Identify ships needing manual overrides
console.log('='.repeat(80));
console.log('⚠️  SHIPS NEEDING MANUAL OVERRIDES');
console.log('='.repeat(80));
console.log('');

const needsOverride: Array<{ ship: any; reasons: string[] }> = [];

for (const ship of ships) {
  const reasons: string[] = [];
  
  // Check each power for complexity
  for (const power of ship.powers) {
    // CUSTOM or CONDITIONAL effect types
    if (power.effectType === 'custom' || power.effectType === 'conditional') {
      reasons.push(`Power ${power.powerIndex}: ${power.effectType} - "${power.description.substring(0, 50)}..."`);
    }
    
    // Player choice required
    if (power.requiresPlayerChoice && power.choiceType !== 'or_choice') {
      reasons.push(`Power ${power.powerIndex}: Requires player choice (${power.choiceType})`);
    }
    
    // Complex special logic
    if (power.specialLogic?.customLogicId) {
      reasons.push(`Power ${power.powerIndex}: Custom logic ID - ${power.specialLogic.customLogicId}`);
    }
    
    // Passive powers
    if (power.timing === 'passive') {
      reasons.push(`Power ${power.powerIndex}: Passive modifier`);
    }
    
    // Scaling by quantity
    if (power.description.toLowerCase().includes('if you have 1') || 
        power.description.toLowerCase().includes('if you have 2') ||
        power.description.toLowerCase().includes('if you have 3')) {
      reasons.push(`Power ${power.powerIndex}: Scaling by quantity`);
    }
    
    // Dice-based conditionals
    if (power.description.toLowerCase().includes('if dice roll') ||
        power.description.toLowerCase().includes('dice roll is')) {
      reasons.push(`Power ${power.powerIndex}: Dice-based conditional`);
    }
  }
  
  if (reasons.length > 0) {
    needsOverride.push({ ship, reasons });
  }
}

console.log(`Found ${needsOverride.length} ships needing manual overrides:`);
console.log('');

// Group by species
const overridesBySpecies: Record<string, typeof needsOverride> = {
  human: [],
  xenite: [],
  centaur: [],
  ancient: []
};

for (const item of needsOverride) {
  overridesBySpecies[item.ship.species].push(item);
}

for (const [species, items] of Object.entries(overridesBySpecies)) {
  if (items.length === 0) continue;
  
  console.log(`\n📌 ${species.toUpperCase()} (${items.length} ships):`);
  console.log('─'.repeat(80));
  
  for (const { ship, reasons } of items) {
    console.log(`\n  ${ship.id} - ${ship.name}`);
    for (const reason of reasons) {
      console.log(`    ⚠️  ${reason}`);
    }
  }
}

console.log('');
console.log('='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log(`Total ships: ${ships.length}`);
console.log(`Fully automated: ${ships.length - needsOverride.length} (${Math.round((ships.length - needsOverride.length) / ships.length * 100)}%)`);
console.log(`Need manual overrides: ${needsOverride.length} (${Math.round(needsOverride.length / ships.length * 100)}%)`);
console.log('');

// List ships that parsed cleanly
const cleanShips = ships.filter(ship => 
  !needsOverride.some(item => item.ship.id === ship.id)
);

console.log(`✅ Ships that parsed cleanly (${cleanShips.length}):`);
const cleanBySpecies: Record<string, string[]> = {
  human: [],
  xenite: [],
  centaur: [],
  ancient: []
};

for (const ship of cleanShips) {
  cleanBySpecies[ship.species].push(ship.id);
}

for (const [species, ids] of Object.entries(cleanBySpecies)) {
  if (ids.length > 0) {
    console.log(`  ${species}: ${ids.join(', ')}`);
  }
}

console.log('');
console.log('='.repeat(80));
console.log('✅ PARSER REPORT COMPLETE');
console.log('='.repeat(80));
