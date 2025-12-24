#!/usr/bin/env -S deno test --allow-read
/**
 * Drift Test - Ensures ShipDefinitions.core.ts matches CSV
 * 
 * This test MUST FAIL if:
 * - Ship data is manually edited in ShipDefinitions.core.ts
 * - CSV is updated but generator not run
 * - Any mismatch between CSV and generated code
 * 
 * Usage:
 *   deno task test:drift
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { PURE_SHIP_DEFINITIONS } from '../game/data/ShipDefinitions.core.ts';

// Simple CSV parser for testing
function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split('\n');
  
  // Find header row
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('SPECIES,')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    throw new Error('Could not find header row');
  }
  
  const headers = lines[headerIndex].split(',').map(h => h.trim());
  const rows: any[] = [];
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    const idIndex = headers.indexOf('ID');
    if (idIndex === -1 || !values[idIndex]?.trim()) {
      continue;
    }
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return rows;
}

Deno.test("Ship Definitions must match CSV exactly", async () => {
  // Read CSV file
  const csvPath = './game/data/source/GEN2_SHIP_TABLE_1.2.csv';
  const csvContent = await Deno.readTextFile(csvPath);
  const csvRows = parseCSV(csvContent);
  
  console.log(`\n📊 Testing ${csvRows.length} ships from CSV...\n`);
  
  // Verify count matches
  assertEquals(
    PURE_SHIP_DEFINITIONS.length,
    csvRows.length,
    `Ship count mismatch! CSV has ${csvRows.length} ships, but code has ${PURE_SHIP_DEFINITIONS.length}`
  );
  
  // Test each ship
  for (let i = 0; i < csvRows.length; i++) {
    const csvRow = csvRows[i];
    const codeDef = PURE_SHIP_DEFINITIONS.find(d => d.id === csvRow.ID.trim());
    
    if (!codeDef) {
      throw new Error(`Ship "${csvRow.ID}" exists in CSV but not in code!`);
    }
    
    // Test critical fields
    const shipId = csvRow.ID.trim();
    
    assertEquals(
      codeDef.name,
      csvRow['SHIP NAME'].trim(),
      `[${shipId}] Name mismatch`
    );
    
    assertEquals(
      codeDef.species,
      csvRow.SPECIES.trim(),
      `[${shipId}] Species mismatch`
    );
    
    // Test line cost (handle N/A)
    const csvLineCost = csvRow['TOTAL LINE COST'].trim();
    const expectedLineCost = (csvLineCost === 'N/A' || !csvLineCost) ? null : parseInt(csvLineCost, 10);
    assertEquals(
      codeDef.totalLineCost,
      expectedLineCost,
      `[${shipId}] Total line cost mismatch`
    );
    
    // Test joining line cost (if present)
    const csvJoiningCost = csvRow['JOINING LINE COST'].trim();
    if (csvJoiningCost && csvJoiningCost !== 'N/A') {
      const expectedJoiningCost = parseInt(csvJoiningCost, 10);
      assertEquals(
        codeDef.joiningLineCost,
        expectedJoiningCost,
        `[${shipId}] Joining line cost mismatch`
      );
    }
    
    // Test charges (if present)
    const csvCharges = csvRow.CHARGES.trim();
    if (csvCharges) {
      const expectedCharges = parseInt(csvCharges, 10);
      assertEquals(
        codeDef.charges,
        expectedCharges,
        `[${shipId}] Charges mismatch`
      );
    }
    
    // Test number of powers
    const expectedPowers = parseInt(csvRow['NUMBER OF POWERS'].trim(), 10);
    assertEquals(
      codeDef.numberOfPowers,
      expectedPowers,
      `[${shipId}] Number of powers mismatch`
    );
    
    // Test component ships (if present)
    const csvComponents = csvRow['COMPONENT SHIPS'].trim();
    if (csvComponents && csvComponents !== 'N/A') {
      const expectedComponents = csvComponents.split(',').map(s => s.trim()).filter(s => s.length > 0);
      assertEquals(
        codeDef.componentShips,
        expectedComponents,
        `[${shipId}] Component ships mismatch`
      );
    }
    
    // Test power texts match
    for (let p = 1; p <= 3; p++) {
      const subphaseKey = `POWER ${p} SUBPHASE`;
      const textKey = `POWER ${p}`;
      
      const csvSubphase = csvRow[subphaseKey]?.trim();
      const csvText = csvRow[textKey]?.trim();
      
      if (csvSubphase && csvText) {
        const codePower = codeDef.powers[p - 1];
        if (!codePower) {
          throw new Error(`[${shipId}] Missing power ${p} in code`);
        }
        
        assertEquals(
          codePower.subphase,
          csvSubphase,
          `[${shipId}] Power ${p} subphase mismatch`
        );
        
        assertEquals(
          codePower.text,
          csvText,
          `[${shipId}] Power ${p} text mismatch`
        );
      }
    }
  }
  
  console.log(`✅ All ${csvRows.length} ships match CSV exactly!\n`);
});

Deno.test("Specific ship examples match CSV", () => {
  // Test Carrier has 2 powers with different charge costs
  const carrier = PURE_SHIP_DEFINITIONS.find(d => d.id === 'CAR');
  assertEquals(carrier?.numberOfPowers, 2, "Carrier should have 2 powers");
  assertEquals(carrier?.powers[0].text, "Make a Defender  (use 1 charge).");
  assertEquals(carrier?.powers[1].text, "Make a Fighter (use 2 charges)");
  
  // Test Starship is ID=STA, total cost 8
  const starship = PURE_SHIP_DEFINITIONS.find(d => d.id === 'STA');
  assertEquals(starship?.id, 'STA');
  assertEquals(starship?.totalLineCost, 8);
  assertEquals(starship?.powers[0].text, "Deal 8 damage, once only on the turn it is built.");
  
  // Test Frigate is Upgraded with components DEF, FIG
  const frigate = PURE_SHIP_DEFINITIONS.find(d => d.id === 'FRI');
  assertEquals(frigate?.shipType, 'Upgraded');
  assertEquals(frigate?.joiningLineCost, 3);
  assertEquals(frigate?.totalLineCost, 8);
  assertEquals(frigate?.componentShips, ['DEF', 'FIG']);
  assertEquals(frigate?.powers.length, 3);
  
  console.log("✅ Specific ship examples verified!\n");
});
