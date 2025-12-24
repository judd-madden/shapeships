# EffectKind Runtime Import Fix

**Date:** 2024-12-24  
**Issue:** `ReferenceError: EffectKind is not defined`  
**Status:** ✅ **FIXED**

---

## Problem

During runtime execution of FullPhaseTest, encountered error:
```
ReferenceError: EffectKind is not defined
    at EndOfTurnResolver.mapPowerEffectToEffectKind (game/engine/EndOfTurnResolver.tsx:305:33)
```

### Root Cause

`EffectKind` was imported as a **type-only** import in EndOfTurnResolver:

```typescript
// ❌ WRONG: Type-only import (erased at runtime)
import type { 
  TriggeredEffect, 
  EvaluatedEffect, 
  AnyEffect,
  EffectKind,  // ← Type-only, unavailable at runtime!
  EffectSource,
  EffectTarget
} from '../types/EffectTypes';
```

**Why this fails:**
- TypeScript's `import type` syntax imports types for compile-time checking only
- At runtime, these imports are completely erased from the JavaScript
- When code tries to use `EffectKind.DAMAGE` at runtime → `ReferenceError`

---

## Solution

Import `EffectKind` as a **value** (not type) so it's available at runtime:

```typescript
// ✅ CORRECT: Split imports into type-only and value imports
import type { 
  TriggeredEffect, 
  EvaluatedEffect, 
  AnyEffect,
  EffectSource,
  EffectTarget
} from '../types/EffectTypes';

import { 
  EffectKind, // ✅ Import as value (not type) for runtime usage
  createEvaluatedEffect, 
  generateEffectId,
  createOpponentTarget,
  createSelfTarget
} from '../types/EffectTypes';
```

---

## Files Updated

### ✅ EndOfTurnResolver.tsx
- **Changed:** Moved `EffectKind` from `import type` block to value `import` block
- **Line:** 29 (now imported with helper functions)
- **Reason:** Used at runtime in `mapPowerEffectToEffectKind()` method

### ✅ PowerExecutor.tsx
- **Status:** Already correct (was importing as value)
- **Line:** 28 (already in value import block)
- **No changes needed**

---

## TypeScript Import Types Explained

### Type-Only Imports (`import type`)
```typescript
import type { SomeType } from './module';
```
- **Purpose:** Import ONLY for TypeScript type checking
- **Runtime:** Completely erased from compiled JavaScript
- **Use case:** Interfaces, type aliases, types used ONLY in annotations

### Value Imports
```typescript
import { SomeClass, SomeEnum } from './module';
```
- **Purpose:** Import actual JavaScript values
- **Runtime:** Available as actual objects/functions/enums
- **Use case:** Classes, functions, enums, constants used in code

### Why Enums Need Value Imports
```typescript
// EffectKind is an enum
export enum EffectKind {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  ...
}

// ❌ WRONG: Type-only import
import type { EffectKind } from './EffectTypes';
switch (effect.kind) {
  case EffectKind.DAMAGE: // ReferenceError! EffectKind doesn't exist at runtime
    ...
}

// ✅ CORRECT: Value import
import { EffectKind } from './EffectTypes';
switch (effect.kind) {
  case EffectKind.DAMAGE: // Works! EffectKind.DAMAGE = 'DAMAGE'
    ...
}
```

---

## Migration Pattern for Effects

When working with EffectTypes, follow this import pattern:

```typescript
// Type-only imports (interfaces, type aliases)
import type { 
  TriggeredEffect,      // Interface
  EvaluatedEffect,      // Interface
  AnyEffect,            // Union type
  EffectSource,         // Interface
  EffectTarget          // Interface
} from '../types/EffectTypes';

// Value imports (enums, functions, classes)
import { 
  EffectKind,           // Enum - needs runtime access
  createTriggeredEffect,    // Function
  createEvaluatedEffect,    // Function
  generateEffectId,     // Function
  createOpponentTarget, // Function
  createSelfTarget      // Function
} from '../types/EffectTypes';
```

**Rule of thumb:**
- Interfaces/types → `import type`
- Enums/functions/classes → `import` (value)

---

## Testing Verification

### Before Fix
```
❌ ReferenceError: EffectKind is not defined
   at EndOfTurnResolver.mapPowerEffectToEffectKind
```

### After Fix
```
✅ Code executes without errors
✅ EffectKind enum values accessible at runtime
✅ mapPowerEffectToEffectKind returns correct EffectKind values
```

### Test Cases
- [x] EndOfTurnResolver.evaluateContinuousEffects() executes
- [x] mapPowerEffectToEffectKind() returns correct enum values
- [x] switch statements using EffectKind work correctly
- [x] FullPhaseTest runs without ReferenceError

---

## Lessons Learned

### TypeScript Best Practices

1. **Use `import type` when possible** - Reduces bundle size, clarifies intent
2. **Import enums as values** - They need runtime access
3. **Split imports when mixing types and values** - Clearer organization

### Migration Checklist

When migrating to canonical types:
- [ ] Check if imported types are used at runtime (enums, classes)
- [ ] Move runtime types from `import type` to value `import`
- [ ] Keep pure types in `import type` block
- [ ] Test runtime execution, not just TypeScript compilation

---

## Related Documentation

- `/game/types/EffectTypes.ts` - Canonical module definition
- `/game/types/documentation/EffectTypes_MIGRATION_GUIDE.md` - Migration guide
- `/game/types/documentation/MIGRATION_FINAL_COMPLETE.md` - Complete migration summary

---

**Summary:** Fixed runtime error by importing `EffectKind` as a value instead of type-only. EffectKind is an enum that needs to be available at runtime for switch statements and comparisons. TypeScript's type-only imports are erased during compilation, causing ReferenceError when code tries to access the enum at runtime.
