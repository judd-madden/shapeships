# Import Fixes - SpeciesIntegration.getShipById Error

## Error Summary

```
TypeError: SpeciesIntegration_default.getShipById is not a function
    at EndOfTurnResolver.evaluateContinuousEffects (game/engine/EndOfTurnResolver.tsx:149:44)
    at ActionResolver.resolveBuildAction (game/engine/ActionResolver.tsx:330:37)
```

---

## Root Cause

**Problem:** Code was calling `SpeciesIntegration.getShipById()` which doesn't exist as a static method.

**Why It Happened:**
- `getShipById()` is exported directly from `/game/data/SpeciesData.tsx`
- `SpeciesIntegration` imports it internally but doesn't expose it as a static method
- Files were incorrectly calling `SpeciesIntegration.getShipById()` instead of importing directly

---

## Files Fixed

### 1. `/game/engine/EndOfTurnResolver.tsx`

**Before:**
```typescript
import SpeciesIntegration from './SpeciesIntegration';

// ...

const shipData = SpeciesIntegration.getShipById(ship.shipId); // ❌ ERROR
```

**After:**
```typescript
import SpeciesIntegration from './SpeciesIntegration';
import { getShipById } from '../data/SpeciesData'; // ✅ Direct import

// ...

const shipData = getShipById(ship.shipId); // ✅ FIXED
```

**Change:** Added direct import of `getShipById` from SpeciesData

---

### 2. `/game/engine/ActionResolver.tsx`

**Before:**
```typescript
import SpeciesIntegration from './SpeciesIntegration';

// ...

const shipData = SpeciesIntegration.getShipById(shipId); // ❌ ERROR
```

**After:**
```typescript
import SpeciesIntegration from './SpeciesIntegration';
import { getShipById } from '../data/SpeciesData'; // ✅ Direct import

// ...

const shipData = getShipById(shipId); // ✅ FIXED
```

**Change:** Added direct import of `getShipById` from SpeciesData

---

## Correct Usage Patterns

### ❌ WRONG: Calling through SpeciesIntegration
```typescript
import SpeciesIntegration from './SpeciesIntegration';

const shipData = SpeciesIntegration.getShipById(shipId); // ERROR: Method doesn't exist
```

### ✅ CORRECT: Direct import from SpeciesData
```typescript
import { getShipById } from '../data/SpeciesData';

const shipData = getShipById(shipId); // Works correctly
```

### ✅ CORRECT: Using SpeciesIntegration's actual methods
```typescript
import SpeciesIntegration from './SpeciesIntegration';

const shipData = SpeciesIntegration.getShipData(playerShip); // Works - this method exists
```

---

## Available SpeciesIntegration Methods

**These are the actual static methods available:**

```typescript
SpeciesIntegration.getAllShipsInPlay(gameState)
SpeciesIntegration.getShipData(playerShip)  // Takes PlayerShip, internally calls getShipById
SpeciesIntegration.getShipDataInPlay(gameState)
SpeciesIntegration.canPlayerCopyShip(gameState, playerId, shipId)
SpeciesIntegration.canPlayerStealShip(gameState, stealingPlayerId, targetPlayerShip)
SpeciesIntegration.calculateTotalDamage(gameState, playerId)
SpeciesIntegration.calculateTotalHealing(gameState, playerId)
SpeciesIntegration.calculateAutomaticDamage(gameState, playerId)
SpeciesIntegration.calculateAutomaticHealing(gameState, playerId)
SpeciesIntegration.calculateShipAutomaticDamage(gameState, ship)
SpeciesIntegration.calculateShipAutomaticHealing(gameState, ship)
SpeciesIntegration.calculateShipOnceOnlyDamage(gameState, ship)
SpeciesIntegration.calculateShipOnceOnlyHealing(gameState, ship)
SpeciesIntegration.calculateTotalEnergyGeneration(gameState, playerId)
SpeciesIntegration.calculateTotalJoiningLinesGeneration(gameState, playerId)
```

**Note:** `getShipById` is NOT a SpeciesIntegration method - import directly from SpeciesData

---

## When to Use Each Approach

### Use Direct Import (`getShipById`)
**When:** You have a ship ID string and need ship data
```typescript
import { getShipById } from '../data/SpeciesData';

const shipData = getShipById('WED'); // Get Wedge ship data
```

### Use SpeciesIntegration.getShipData()
**When:** You have a PlayerShip instance and need ship data
```typescript
import SpeciesIntegration from './SpeciesIntegration';

const playerShip: PlayerShip = { shipId: 'WED', ownerId: '...', ... };
const shipData = SpeciesIntegration.getShipData(playerShip);
```

---

## Testing Checklist

- [x] EndOfTurnResolver.evaluateContinuousEffects() no longer crashes
- [x] ActionResolver.resolveBuildAction() no longer crashes
- [x] All imports are correct
- [x] No `SpeciesIntegration.getShipById` calls remain
- [x] All files using `getShipById` import it directly from SpeciesData

---

## Files Modified Summary

1. ✅ `/game/engine/EndOfTurnResolver.tsx` - Added `getShipById` import, fixed call on line 149
2. ✅ `/game/engine/ActionResolver.tsx` - Added `getShipById` import, fixed call on line 330
3. ✅ `/game/engine/documentation/IMPORT_FIXES.md` - This documentation

**Total Changes:** 2 files fixed, 2 import statements added, 2 function calls corrected

---

## Status

✅ **FIXED** - All `SpeciesIntegration.getShipById()` errors resolved by using correct import pattern.
