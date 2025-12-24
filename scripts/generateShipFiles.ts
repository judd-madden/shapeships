// Generate Ship Definition Files
// Processes CSV data and creates final ship definition files

import { SHIP_CSV_DATA } from './shipCSVData';
import { parseAllShips } from './parseShipCSV';
import { generateShipDefinitionsFile, generateSolarPowerDefinitionsFile } from './testShipParser';
import { ShipType } from '../game/types/ShipTypes';

console.log('='.repeat(80));
console.log('📦 GENERATING SHIP DEFINITION FILES');
console.log('='.repeat(80));
console.log('');

// Parse all ships
console.log(`📋 Processing ${SHIP_CSV_DATA.length} ships from CSV...`);
const allShips = parseAllShips(SHIP_CSV_DATA);

console.log(`✅ Parsed ${allShips.length} ships`);
console.log('');

// Separate by type
const regularShips = allShips.filter(ship => ship.type !== ShipType.SOLAR_POWER);
const solarPowers = allShips.filter(ship => ship.type === ShipType.SOLAR_POWER);

console.log(`📊 Breakdown:`);
console.log(`  Regular ships: ${regularShips.length}`);
console.log(`  Solar powers: ${solarPowers.length}`);
console.log('');

// Generate files
console.log('🔨 Generating ShipDefinitions.tsx...');
const shipDefsContent = generateShipDefinitionsFile(allShips);

console.log('🔨 Generating SolarPowerDefinitions.tsx...');
const solarPowerContent = generateSolarPowerDefinitionsFile(allShips);

console.log('');
console.log('='.repeat(80));
console.log('✅ GENERATION COMPLETE');
console.log('='.repeat(80));
console.log('');
console.log('📁 Files generated:');
console.log('  - ShipDefinitions.tsx');
console.log('  - SolarPowerDefinitions.tsx');
console.log('');
console.log('📊 Statistics:');
console.log(`  Total ships: ${regularShips.length}`);
console.log(`  Total solar powers: ${solarPowers.length}`);
console.log('');

// Export the content for file writing
export { shipDefsContent, solarPowerContent };
