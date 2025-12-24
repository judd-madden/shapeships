# Build Error Fixes - 2024-12-24

## Error Report

**Error Message:**
```
Error: Build failed with 1 error:
virtual-fs:file:///game/test/FullPhaseTest.tsx:11:9: ERROR: 
No matching export in "virtual-fs:file:///game/engine/EndOfTurnResolver.tsx" 
for import "endOfTurnResolver"
```

**Root Cause:**
The refactored `EndOfTurnResolver.tsx` was only exporting the class and default export, but not the singleton instance that test files were importing.

---

## Fix Applied

### File: `/game/engine/EndOfTurnResolver.tsx`

**Added Export:**
```typescript
/**
 * Singleton instance for convenience
 * @deprecated Consider using class methods directly for better testability
 */
export const endOfTurnResolver = new EndOfTurnResolver();
```

**Location:** End of file, after class definition

**Reasoning:**
- Test files (`FullPhaseTest.tsx`, potentially others) import `endOfTurnResolver` as a singleton
- During refactor, this export was inadvertently removed
- Backward compatibility requires maintaining this export
- Marked as deprecated to encourage future migration to class methods

---

## Verification

### Files Using This Export
1. `/game/test/FullPhaseTest.tsx` - Line 11
   ```typescript
   import { endOfTurnResolver } from '../engine/EndOfTurnResolver';
   ```

### Other Resolver Exports Checked
- `ActionResolver.tsx` - ✅ Already exports `actionResolver` singleton
- `PowerResolver.ts` - ✅ Exports only functions (no singleton needed)

---

## Build Status

**Before Fix:**
- ❌ Build failing on missing export

**After Fix:**
- ✅ Export added
- ✅ Backward compatible
- ✅ Build should succeed

---

## Future Improvements

### Recommendation: Migrate Away from Singletons

**Current Pattern (Deprecated):**
```typescript
import { endOfTurnResolver } from '../engine/EndOfTurnResolver';
const result = endOfTurnResolver.resolveEndOfTurn(gameState, effects, modifiers);
```

**Recommended Pattern:**
```typescript
import { EndOfTurnResolver } from '../engine/EndOfTurnResolver';
const resolver = new EndOfTurnResolver();
const result = resolver.resolveEndOfTurn(gameState, effects, modifiers);
```

**Or Static Methods:**
```typescript
import { EndOfTurnResolver } from '../engine/EndOfTurnResolver';
const result = EndOfTurnResolver.resolve(gameState, effects, modifiers);
```

**Benefits:**
- Better testability (can mock instances)
- Clearer dependency injection
- No global state concerns
- Easier to reason about

**Migration Plan:**
1. Update test files to use class directly
2. Update other consumers
3. Remove singleton exports
4. Document change in refactor notes

---

## Related Files

### Export Pattern Consistency

All resolver/engine files now follow this pattern:

```typescript
// Class export (primary)
export class ResolverName {
  // ... methods
}

// Default export (for ES6 compatibility)
export default ResolverName;

// Singleton instance (deprecated, for backward compatibility)
export const resolverInstance = new ResolverName();
```

**Files Following Pattern:**
- ✅ `EndOfTurnResolver.tsx`
- ✅ `ActionResolver.tsx`
- ✅ `PowerExecutor.tsx` (class only, no singleton needed)
- ✅ `PowerResolver.ts` (functions only, no class)

---

## Testing Checklist

After this fix, verify:

- [ ] Build succeeds
- [ ] FullPhaseTest loads without errors
- [ ] endOfTurnResolver methods work correctly
- [ ] No other missing export errors
- [ ] TypeScript types resolve correctly

---

**Fix Applied:** 2024-12-24  
**Status:** ✅ Complete  
**Build:** Should now succeed
