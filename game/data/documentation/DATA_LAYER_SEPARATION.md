# Data Layer Separation - Complete

**Date:** 2026-01-07  
**Status:** ✅ Complete

## Summary

Refactored ShipDefinitions.json.ts to be "data only" by moving helper functions to appropriate core/engine modules.

## Changes Made

### 1. `/game/data/ShipDefinitions.json.ts` - NOW DATA ONLY

**Removed:**
- ❌ `ComponentToken` type → moved to engine
- ❌ `parseComponentToken()` → moved to engine
- ❌ `getComponentRequirements()` → moved to engine
- ❌ `SHIP_DEFINITIONS_BY_ID` map → moved to core
- ❌ `getShipDefinitionById()` → moved to core

**Kept:**
- ✅ `SHIP_DEFINITIONS_JSON` (const data array)
- ✅ `ShipDefinitionJSON`, `ShipPowerJSON`, `EnergyCostJSON` (type exports)
- ✅ Dev-only validation: unique IDs + no real '\n' in power.text

### 2. `/game/engine/shipDerivations/componentTokens.ts` - NEW FILE

**Purpose:** DSL parsing for component ship tokens

**Exports:**
- `ComponentToken` type (id | requirement with charge state)
- `parseComponentToken(token)` - Parse single DSL token
- `parseComponentRequirements(componentShips)` - Parse array of tokens

**Features:**
- Dev-only format validation (must match `/^[A-Z0-9]+(\(0\))?$/`)
- Handles plain IDs: `"DEF"` → `{ kind: 'id', id: 'DEF' }`
- Handles depleted: `"CAR(0)"` → `{ kind: 'requirement', id: 'CAR', chargeState: 'depleted' }`

### 3. `/game/data/ShipDefinitions.core.ts` - ENHANCED

**Added:**
- `getShipByIdOrThrow(id)` - Throws if ship not found (for must-exist cases)

**Already Had:**
- `SHIP_DEFINITIONS_CORE_MAP` - O(1) lookup by ID
- `getShipById(id)` - Returns undefined if not found
- `getAllShips()`, `getShipsBySpecies()`, `getShipsByType()`

### 4. `/game/data/ShipDefinitions.engine.ts` - FIXED

**Fixed Solar Power conversion:**
- ❌ OLD: Read from `componentShips[]` (incorrect)
- ✅ NEW: Read from `energyCost` field (correct)

**Removed:**
- ❌ `parseSolarEnergyCost()` - no longer needed

**Added:**
- `convertEnergyCost(energyCost)` - Convert core energyCost to engine EnergyCost
- Handles xBlue → variable: 'ship_line_cost' conversion

**Updated:**
- `parseComponentShips()` - Removed obsolete "skip energy strings" comment
- Now only processes component ship tokens (never energy text)

## Architecture After Refactoring

```
┌─────────────────────────────────────────────────────────────┐
│ /game/data/ShipDefinitions.json.ts                         │
│ ───────────────────────────────────────────────────────────│
│ • SHIP_DEFINITIONS_JSON (const data)                       │
│ • Type exports only                                         │
│ • Minimal validation (unique IDs, no real newlines)        │
│ • NO HELPERS                                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ /game/data/ShipDefinitions.core.ts                         │
│ ───────────────────────────────────────────────────────────│
│ • SHIP_DEFINITIONS_CORE (array)                            │
│ • SHIP_DEFINITIONS_CORE_MAP (by-id lookup)                 │
│ • getShipById(), getShipByIdOrThrow()                      │
│ • getShipsBySpecies(), getShipsByType()                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
          ┌─────────────┴─────────────┐
          ↓                           ↓
┌──────────────────────┐    ┌─────────────────────────────┐
│ CORE → ENGINE        │    │ CORE → UI                   │
│ ────────────────────│    │ ───────────────────────────│
│ ShipDefinitions.    │    │ ShipDefinitions.tsx        │
│   engine.ts         │    │                             │
│                     │    │ Adds graphics to core      │
│ Converts core to    │    │ definitions                 │
│ engine runtime      │    │                             │
│ types               │    │                             │
└──────────────────────┘    └─────────────────────────────┘
          ↓
┌──────────────────────────────────────────────────────────────┐
│ /game/engine/shipDerivations/componentTokens.ts             │
│ ────────────────────────────────────────────────────────────│
│ • parseComponentToken() - DSL parser                        │
│ • parseComponentRequirements() - Array parser               │
│ • ComponentToken type                                        │
│                                                              │
│ Used by cost calculators and ship building logic           │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
JSON (authoritative source)
  ↓
ShipDefinitions.json.ts (data + types + validation)
  ↓
ShipDefinitions.core.ts (core array + indexing)
  ↓
  ├─→ ShipDefinitions.engine.ts → Engine runtime
  │     ├─→ Uses componentTokens.ts for DSL parsing
  │     └─→ Converts energyCost field for Solar Powers
  │
  └─→ ShipDefinitions.tsx → UI with graphics
```

## Verification

✅ **No imports of removed helpers from JSON module**
- Searched for: `parseComponentToken`, `getComponentRequirements`, `SHIP_DEFINITIONS_BY_ID`, `getShipDefinitionById` from `ShipDefinitions.json`
- Found: 0 matches in active code

✅ **JSON module only imported for data**
- Only `ShipDefinitions.core.ts` imports from JSON module
- Only imports: `SHIP_DEFINITIONS_JSON` (the data)

✅ **Solar Power data correct**
- All 9 Solar Powers have `componentShips: []`
- All 9 Solar Powers have valid `energyCost` objects
- Engine layer reads from `energyCost` field (not componentShips)

## Benefits

1. **Clear separation of concerns**
   - Data layer: Just data + minimal validation
   - Core layer: Indexing + basic helpers
   - Engine layer: DSL parsing + runtime conversion

2. **Maintainability**
   - Each module has a single, clear purpose
   - Easy to locate functionality
   - Reduced coupling

3. **Type safety**
   - Type inference from data still works
   - Engine gets properly typed conversions
   - No loss of type safety

4. **Correctness**
   - Solar Powers now correctly use energyCost field
   - No legacy CSV artifacts in active code
   - Component token parsing in appropriate module

## Migration Notes

**If you previously imported from ShipDefinitions.json.ts:**

```typescript
// ❌ OLD (no longer available)
import { 
  parseComponentToken,
  SHIP_DEFINITIONS_BY_ID,
  getShipDefinitionById 
} from './data/ShipDefinitions.json';

// ✅ NEW - Use core for indexing
import { 
  SHIP_DEFINITIONS_CORE_MAP,
  getShipById,
  getShipByIdOrThrow 
} from './data/ShipDefinitions.core';

// ✅ NEW - Use engine for DSL parsing
import { 
  parseComponentToken,
  parseComponentRequirements 
} from './engine/shipDerivations/componentTokens';
```

**If you're accessing Solar Power costs:**

```typescript
// ❌ OLD (incorrect - Solar Powers don't use componentShips)
const energyCost = parseEnergyFromComponents(ship.componentShips);

// ✅ NEW (correct - read from energyCost field)
const energyCost = ship.energyCost; // Already structured
```

## Files Modified

1. `/game/data/ShipDefinitions.json.ts` - Removed helpers
2. `/game/data/ShipDefinitions.core.ts` - Added getShipByIdOrThrow()
3. `/game/data/ShipDefinitions.engine.ts` - Fixed Solar Power conversion
4. `/game/engine/shipDerivations/componentTokens.ts` - Created (new file)

## Files Created

1. `/game/engine/shipDerivations/componentTokens.ts` - DSL parser module
2. `/game/data/documentation/DATA_LAYER_SEPARATION.md` - This file
