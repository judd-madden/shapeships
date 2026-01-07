# Ship Data Archive

This directory contains **deprecated and archived** ship definition files that are no longer used in the codebase.

## ⚠️ DO NOT USE THESE FILES

The files in this archive are **read-only reference material** for historical context only.

## What's Archived

### `ShipTypes.csv.ts` (Archived: 2026-01-07)

**Reason:** Migrated to JSON-native core types.

**Old System:**
```
CSV files → ShipTypes.csv.ts → ShipDefinitionCsv → Engine
```

**New System:**
```
ShipDefinitions.json.ts → ShipTypes.core.ts → ShipDefinitionCore → Engine
```

**Key Changes:**
- ❌ Removed `numberOfPowers` field (use `powers.length` instead)
- ✅ `componentShips` is always `string[]` (never undefined)
- ✅ `extraRules` is always `string` (never undefined, defaults to empty string)
- ✅ JSON is now the single source of truth
- ✅ No CSV compatibility layer remains

## Current System (Active Files)

| File | Purpose |
|------|---------|
| `/game/data/ShipDefinitions.json.ts` | **Source of truth** - All ship data in JSON format |
| `/game/types/ShipTypes.core.ts` | Core type definitions (JSON-native) |
| `/game/data/ShipDefinitions.core.ts` | Core ship definitions array + helpers |
| `/game/data/ShipDefinitions.engine.ts` | Engine layer conversion (Core → Engine types) |
| `/game/data/ShipDefinitions.tsx` | UI layer decorator (adds graphics to core) |

## Data Flow

```
JSON (authoritative)
  ↓
ShipTypes.core.ts (types)
  ↓
ShipDefinitions.core.ts (data + helpers)
  ↓
  ├─→ ShipDefinitions.engine.ts → Engine runtime
  └─→ ShipDefinitions.tsx → UI with graphics
```

## Migration Notes

### For Code That Previously Used CSV Types:

**Before:**
```typescript
import type { ShipDefinitionCsv } from './types/ShipTypes.csv';

const ship: ShipDefinitionCsv = { /* ... */ };
const powerCount = ship.numberOfPowers; // ❌ Removed
```

**After:**
```typescript
import type { ShipDefinitionCore } from './types/ShipTypes.core';

const ship: ShipDefinitionCore = { /* ... */ };
const powerCount = ship.powers.length; // ✅ Use array length
```

### For Code That Used PURE_SHIP_DEFINITIONS:

**Before:**
```typescript
import { PURE_SHIP_DEFINITIONS } from './data/ShipDefinitions.core';
// Returns ShipDefinitionCsv[]
```

**After:**
```typescript
import { SHIP_DEFINITIONS_CORE } from './data/ShipDefinitions.core';
// Returns ShipDefinitionCore[]
```

## Why JSON?

1. **Native TypeScript support** - No parsing step required
2. **Better validation** - Comprehensive dev-only schema checks
3. **Cleaner types** - No optional fields that are always present
4. **Single source** - No intermediate CSV → code transformation
5. **Version control friendly** - Diffs are clear and reviewable

## Questions?

See `/documentation/JSON_MIGRATION_COMPLETE.md` for full migration documentation.
