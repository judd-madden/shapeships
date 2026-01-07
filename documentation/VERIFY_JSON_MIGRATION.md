# JSON Migration Verification Guide

**Purpose:** Verify the JSON migration is working correctly

## Quick Verification Checks

### 1. Check Ship Count

```typescript
// Run in browser console or Node
import { PURE_SHIP_DEFINITIONS } from './game/data/ShipDefinitions.core';
console.log(`Total ships: ${PURE_SHIP_DEFINITIONS.length}`);
// Expected: 79 ships
```

### 2. Verify Data Source

```bash
# Check ShipDefinitions.core.ts imports from JSON
grep "ShipDefinitions.json" game/data/ShipDefinitions.core.ts
# Expected: import { SHIP_DEFINITIONS_JSON } from './ShipDefinitions.json';
```

### 3. Verify No CSV Imports (Runtime)

```bash
# Search for CSV imports in game code (should find NONE in runtime files)
find game -name "*.ts" -o -name "*.tsx" | xargs grep -l "GEN2_SHIP_TABLE" 2>/dev/null
# Expected: No results (or only test/archive files)
```

### 4. Verify Power Text Preservation

```typescript
// Check that literal \n sequences are preserved
import { getShipById } from './game/data/ShipDefinitions.core';
const interceptor = getShipById('INT');
console.log(interceptor?.powers[0].text);
// Expected: "Interceptors have 1 charge:\\n- Deal 5 damage (uses charge) OR\\n- Heal 5 (uses charge)"
// Note: Literal \n, not actual newlines
```

### 5. Verify Uniqueness Check Works

```bash
# Start the app in development mode
# Should see console message: "✓ Ship definitions loaded: 79 ships, all IDs unique"
```

## Detailed Verification

### Test Ship Data Integrity

Create a test file to verify all ships loaded correctly:

```typescript
// test-migration.ts
import { PURE_SHIP_DEFINITIONS, getShipById } from './game/data/ShipDefinitions.core';

// Test 1: Ship count
console.assert(PURE_SHIP_DEFINITIONS.length === 79, 'Expected 79 ships');

// Test 2: Sample ship (Human basic)
const defender = getShipById('DEF');
console.assert(defender !== undefined, 'Defender should exist');
console.assert(defender?.name === 'Defender', 'Defender name mismatch');
console.assert(defender?.totalLineCost === 2, 'Defender cost mismatch');

// Test 3: Sample ship (Xenite evolved)
const oxite = getShipById('OXI');
console.assert(oxite !== undefined, 'Oxite should exist');
console.assert(oxite?.shipType === 'Basic - Evolved', 'Oxite type mismatch');

// Test 4: Sample ship (Ancient Solar Power)
const asteroid = getShipById('SAST');
console.assert(asteroid !== undefined, 'Asteroid should exist');
console.assert(asteroid?.shipType === 'Solar Power', 'Asteroid type mismatch');
console.assert(asteroid?.totalLineCost === null, 'Solar Powers should have null cost');

// Test 5: Component ships (Ancient Solar Powers use componentShips for energy display)
const siphon = getShipById('SSIP');
console.assert(siphon?.componentShips?.length === 2, 'Siphon should have 2 energy components');
console.assert(
  siphon?.componentShips?.includes('2 red energy'), 
  'Siphon should require 2 red energy'
);

// Test 6: Power text preservation (literal \n)
const carrier = getShipById('CAR');
console.assert(
  carrier?.powers[0].text.includes('\\n'),
  'Carrier power should contain literal \\n sequences'
);

console.log('✅ All migration tests passed!');
```

### Verify UI Integration

1. **Start the app in development mode**
   ```bash
   npm run dev
   # or
   deno task dev
   ```

2. **Check console for validation message**
   - Look for: `✓ Ship definitions loaded: 79 ships, all IDs unique`
   - If missing, check `NODE_ENV` is not set to 'production'

3. **Navigate to Species Rules pages**
   - Human page: Should show 16 ships (8 basic + 8 upgraded)
   - Xenite page: Should show 18 ships (8 basic + 2 evolved + 8 upgraded)
   - Centaur page: Should show 17 ships (8 basic + 9 upgraded)
   - Ancient page: Should show 17 ships (8 basic + 9 Solar Powers)

4. **Check power text rendering**
   - Find a ship with multi-line powers (e.g., Interceptor, Carrier)
   - Verify text displays with proper line breaks (UI should interpret `\n`)
   - The SpeciesRulesPanel uses `whitespace-pre-wrap` which should handle this

### Verify No Breaking Changes

```typescript
// Verify backward compatibility - all old imports should still work
import { PURE_SHIP_DEFINITIONS } from './game/data/ShipDefinitions.core';
import { SHIP_DEFINITIONS } from './game/data/ShipDefinitions';
import type { ShipDefinitionCsv } from './game/types/ShipTypes.csv';
import type { ShipDefinitionUI } from './game/types/ShipTypes.ui';

// All of these should compile without errors
```

## Expected Results

### ✅ Success Indicators

1. App builds without errors
2. Console shows: `✓ Ship definitions loaded: 79 ships, all IDs unique`
3. All Species Rules pages display correct ship counts
4. Power text displays with proper line breaks
5. No TypeScript compilation errors
6. No runtime errors related to ship definitions

### ❌ Failure Indicators

If you see any of these, the migration may have issues:

1. **TypeScript errors:** Type mismatch between JSON and core types
2. **Runtime errors:** Ship data not loading or missing ships
3. **Missing ships:** Fewer than 79 ships loaded
4. **Duplicate IDs:** Uniqueness validation throws error
5. **Power text issues:** Newlines not rendering correctly

## Troubleshooting

### Issue: "Cannot find module 'ShipDefinitions.json'"

**Solution:** Ensure the file was created at `/game/data/ShipDefinitions.json.ts` (note the `.ts` extension)

### Issue: "Type mismatch between JSON and ShipDefinitionCsv"

**Solution:** Check the `transformJsonToCore()` function in `ShipDefinitions.core.ts` - ensure it correctly maps all fields

### Issue: "Power text showing literal \\n instead of line breaks"

**Solution:** This is expected! The core data preserves literal `\n`. The UI layer (SpeciesRulesPanel) should use `whitespace-pre-wrap` to interpret these as newlines. Check the `<p>` tag styling in the panel component.

### Issue: "Ship count is not 79"

**Solution:** 
1. Verify `ShipDefinitions.json.ts` contains all 79 ships (check the array length)
2. Verify the transformation function doesn't filter any ships
3. Check for JSON syntax errors in the ship data

## Rollback (Emergency Only)

If critical issues prevent the app from working:

1. Restore `/game/data/source/GEN2_SHIP_TABLE_1.2.csv` from archive
2. Restore `/scripts/generateShipDefinitionsFromCsv.ts` from archive
3. Run `deno task gen:ships` to regenerate core file
4. Revert `ShipDefinitions.core.ts` to CSV-generated version
5. Document the issue for investigation

---

**After verification, update this checklist:**

- [ ] Ship count verified (79 ships)
- [ ] Data source confirmed (JSON)
- [ ] No CSV imports in runtime code
- [ ] Power text preserved correctly
- [ ] Uniqueness validation working
- [ ] UI displays all ships correctly
- [ ] No compilation errors
- [ ] No runtime errors

**Verification Status:** 🔄 PENDING TESTING
