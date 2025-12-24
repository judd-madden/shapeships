#!/usr/bin/env tsx
/**
 * CSV-to-TypeScript Ship Definitions Generator
 * 
 * Reads GEN2_SHIP_TABLE_1.2.csv and generates ShipDefinitions.core.ts
 * 
 * CRITICAL: CSV is the SINGLE SOURCE OF TRUTH
 * - NO interpretation of power text
 * - Preserves exact CSV strings (trimmed)
 * - Handles N/A and blank cells correctly
 * - Maintains CSV row order
 * 
 * Usage:
 *   npm run gen:ships
 *   (or) tsx scripts/generateShipDefinitionsFromCsv.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CSV PARSER
// ============================================================================

interface CSVRow {
  SPECIES: string;
  'SHIP TYPE': string;
  'SHIP NAME': string;
  ID: string;
  'TOTAL LINE COST': string;
  'JOINING LINE COST': string;
  'COMPONENT SHIPS': string;
  'NUMBER OF POWERS': string;
  CHARGES: string;
  'POWER 1 SUBPHASE': string;
  'POWER 1': string;
  'POWER 2 SUBPHASE': string;
  'POWER 2': string;
  'POWER 3 SUBPHASE': string;
  'POWER 3': string;
  'EXTRA RULES': string;
  'STACK CAPTION': string;
  COLOUR: string;
  'NUMBER OF GRAPHICS': string;
}

interface ShipPowerText {
  subphase: string;
  text: string;
}

interface ShipDefinitionCore {
  id: string;
  name: string;
  species: string;
  shipType: string;
  totalLineCost: number | null;
  joiningLineCost?: number | null;
  componentShips?: string[];
  numberOfPowers: number;
  charges?: number | null;
  powers: ShipPowerText[];
  extraRules?: string;
  stackCaption?: string;
  colour?: string;
  numberOfGraphics?: number | null;
}

/**
 * Parse CSV file into rows
 */
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n');
  
  // Find header row (skip "SHIP TABLE" row)
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('SPECIES,')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    throw new Error('Could not find header row starting with "SPECIES,"');
  }
  
  const headers = lines[headerIndex].split(',');
  const rows: CSVRow[] = [];
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(',');
    
    // Skip rows where ID is empty (blank separator rows)
    const idIndex = headers.indexOf('ID');
    if (idIndex === -1 || !values[idIndex]?.trim()) {
      continue;
    }
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] || '';
    });
    
    rows.push(row as CSVRow);
  }
  
  return rows;
}

/**
 * Parse a value that might be a number, "N/A", or blank
 */
function parseNumericOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'N/A') return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse component ships string "DEF, FIG, CAR(0)" → ['DEF', 'FIG', 'CAR(0)']
 */
function parseComponentShips(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'N/A') return undefined;
  
  return trimmed
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Convert CSV row to ShipDefinitionCore
 */
function csvRowToShipDefinition(row: CSVRow): ShipDefinitionCore {
  const powers: ShipPowerText[] = [];
  
  // Parse powers 1-3
  for (let i = 1; i <= 3; i++) {
    const subphaseKey = `POWER ${i} SUBPHASE` as keyof CSVRow;
    const textKey = `POWER ${i}` as keyof CSVRow;
    
    const subphase = row[subphaseKey]?.trim();
    const text = row[textKey]?.trim();
    
    if (subphase && text) {
      powers.push({ subphase, text });
    }
  }
  
  const definition: ShipDefinitionCore = {
    id: row.ID.trim(),
    name: row['SHIP NAME'].trim(),
    species: row.SPECIES.trim(),
    shipType: row['SHIP TYPE'].trim(),
    totalLineCost: parseNumericOrNull(row['TOTAL LINE COST']),
    numberOfPowers: parseInt(row['NUMBER OF POWERS'].trim(), 10) || 0,
    powers,
  };
  
  // Optional fields
  const joiningLineCost = parseNumericOrNull(row['JOINING LINE COST']);
  if (joiningLineCost !== null) {
    definition.joiningLineCost = joiningLineCost;
  }
  
  const componentShips = parseComponentShips(row['COMPONENT SHIPS']);
  if (componentShips) {
    definition.componentShips = componentShips;
  }
  
  const charges = parseNumericOrNull(row.CHARGES);
  if (charges !== null) {
    definition.charges = charges;
  }
  
  const extraRules = row['EXTRA RULES']?.trim();
  if (extraRules) {
    definition.extraRules = extraRules;
  }
  
  const stackCaption = row['STACK CAPTION']?.trim();
  if (stackCaption) {
    definition.stackCaption = stackCaption;
  }
  
  const colour = row.COLOUR?.trim();
  if (colour && colour !== 'N/A') {
    definition.colour = colour;
  }
  
  const numberOfGraphics = parseNumericOrNull(row['NUMBER OF GRAPHICS']);
  if (numberOfGraphics !== null) {
    definition.numberOfGraphics = numberOfGraphics;
  }
  
  return definition;
}

// ============================================================================
// TYPESCRIPT CODE GENERATOR
// ============================================================================

/**
 * Escape string for TypeScript string literal
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Generate TypeScript code for a ship definition
 */
function generateShipDefinitionCode(def: ShipDefinitionCore, indent: string = '  '): string {
  const lines: string[] = [];
  
  lines.push(`{`);
  lines.push(`${indent}id: '${escapeString(def.id)}',`);
  lines.push(`${indent}name: '${escapeString(def.name)}',`);
  lines.push(`${indent}species: '${escapeString(def.species)}',`);
  lines.push(`${indent}shipType: '${escapeString(def.shipType)}',`);
  lines.push(`${indent}totalLineCost: ${def.totalLineCost},`);
  
  if (def.joiningLineCost !== undefined) {
    lines.push(`${indent}joiningLineCost: ${def.joiningLineCost},`);
  }
  
  if (def.componentShips) {
    const ships = def.componentShips.map(s => `'${escapeString(s)}'`).join(', ');
    lines.push(`${indent}componentShips: [${ships}],`);
  }
  
  lines.push(`${indent}numberOfPowers: ${def.numberOfPowers},`);
  
  if (def.charges !== undefined) {
    lines.push(`${indent}charges: ${def.charges},`);
  }
  
  // Powers array
  lines.push(`${indent}powers: [`);
  def.powers.forEach((power, index) => {
    const isLast = index === def.powers.length - 1;
    lines.push(`${indent}  {`);
    lines.push(`${indent}    subphase: '${escapeString(power.subphase)}',`);
    lines.push(`${indent}    text: '${escapeString(power.text)}'`);
    lines.push(`${indent}  }${isLast ? '' : ','}`);
  });
  lines.push(`${indent}]`);
  
  if (def.extraRules) {
    lines.push(`${indent},extraRules: '${escapeString(def.extraRules)}'`);
  }
  
  if (def.stackCaption) {
    lines.push(`${indent},stackCaption: '${escapeString(def.stackCaption)}'`);
  }
  
  if (def.colour) {
    lines.push(`${indent},colour: '${escapeString(def.colour)}'`);
  }
  
  if (def.numberOfGraphics !== undefined) {
    lines.push(`${indent},numberOfGraphics: ${def.numberOfGraphics}`);
  }
  
  lines.push(`}`);
  
  return lines.join('\n');
}

/**
 * Generate complete ShipDefinitions.core.ts file
 */
function generateShipDefinitionsFile(ships: ShipDefinitionCore[]): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `// Ship Definitions - CORE (Auto-Generated from CSV)
// Generated: ${timestamp}
// Total Ships: ${ships.length}
//
// ⚠️  AUTO-GENERATED - DO NOT EDIT MANUALLY ⚠️
// 
// This file is generated from /game/data/source/GEN2_SHIP_TABLE_1.2.csv
// To update ship data:
//   1. Edit the CSV file
//   2. Run: npm run gen:ships
//   3. Commit both CSV and generated file
//
// CSV is the SINGLE SOURCE OF TRUTH for ship data.

import type { ShipDefinitionCsv } from '../types/ShipTypes.csv';

// ============================================================================
// PURE SHIP DEFINITIONS (${ships.length} ships - NO GRAPHICS)
// ============================================================================
// This is the authoritative source for ship data
// Graphics are added separately in ShipDefinitions.tsx

export const PURE_SHIP_DEFINITIONS: ShipDefinitionCsv[] = [
${ships.map((ship, index) => {
  const isLast = index === ships.length - 1;
  const code = generateShipDefinitionCode(ship, '  ');
  return code + (isLast ? '' : ',\n');
}).join('\n')}
];

// ============================================================================
// LOOKUP MAP
// ============================================================================

export const SHIP_DEFINITIONS_CORE_MAP: Record<string, ShipDefinitionCsv> = 
  PURE_SHIP_DEFINITIONS.reduce((map, def) => {
    map[def.id] = def;
    return map;
  }, {} as Record<string, ShipDefinitionCsv>);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ship definition by ID
 */
export function getShipDefinitionById(shipDefId: string): ShipDefinitionCsv | undefined {
  return SHIP_DEFINITIONS_CORE_MAP[shipDefId];
}

/**
 * Alias for backward compatibility
 */
export function getShipById(shipDefId: string): ShipDefinitionCsv | undefined {
  return getShipDefinitionById(shipDefId);
}

/**
 * Get basic ship line cost
 */
export function getBasicShipCost(shipDefId: string): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.totalLineCost ?? null;
}

/**
 * Get upgraded ship joining line cost
 */
export function getUpgradedShipCost(shipDefId: string): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.joiningLineCost ?? null;
}

/**
 * Get total ship cost (joining or total)
 */
export function getShipCost(shipDefId: string): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.joiningLineCost ?? ship?.totalLineCost ?? null;
}
`;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🚀 Generating ShipDefinitions.core.ts from CSV...\n');
  
  // Paths
  const csvPath = path.join(__dirname, '../game/data/source/GEN2_SHIP_TABLE_1.2.csv');
  const outputPath = path.join(__dirname, '../game/data/ShipDefinitions.core.ts');
  
  // Read CSV
  console.log('📖 Reading CSV:', csvPath);
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  console.log('⚙️  Parsing CSV...');
  const csvRows = parseCSV(csvContent);
  console.log(`   Found ${csvRows.length} ship rows\n`);
  
  // Convert to ship definitions
  console.log('🔄 Converting to ShipDefinitionCore...');
  const ships = csvRows.map(csvRowToShipDefinition);
  
  // Log summary
  const bySpecies = ships.reduce((acc, ship) => {
    acc[ship.species] = (acc[ship.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('   Ships by species:');
  Object.entries(bySpecies).forEach(([species, count]) => {
    console.log(`   - ${species}: ${count}`);
  });
  console.log('');
  
  // Generate TypeScript code
  console.log('📝 Generating TypeScript code...');
  const code = generateShipDefinitionsFile(ships);
  
  // Write file
  console.log('💾 Writing file:', outputPath);
  fs.writeFileSync(outputPath, code, 'utf-8');
  
  console.log('\n✅ Generation complete!');
  console.log(`   Output: ${outputPath}`);
  console.log(`   Ships: ${ships.length}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Review the generated file');
  console.log('   2. Run: npm run test:drift');
  console.log('   3. Commit both CSV and generated file');
}

main();