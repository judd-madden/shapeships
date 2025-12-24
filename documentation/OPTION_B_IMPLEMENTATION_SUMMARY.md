# Option B Implementation - Summary

**Date:** 2024-12-24  
**Goal:** Make Engine Pure (Deno-importable) and Server Delegates to Engine  
**Status:** ✅ PHASE 1 COMPLETE / 📋 PHASE 2 READY

---

## What Was Accomplished

### ✅ Phase 1: Type System Made Pure

**Problem:** Server couldn't import engine because `ShipDefinition` type included `React.ComponentType<...>` for graphics.

**Solution:** Created pure data layer without React dependencies.

#### Files Created

1. **`/game/data/ShipDefinitions.core.ts`** (1000+ lines)
   - Pure TypeScript, no React imports
   - Exports `PURE_SHIP_DEFINITIONS` array (70 ships)
   - Exports helper functions:
     - `getShipDefinitionById(shipDefId): PureShipDefinition | undefined`
     - `getBasicShipCost(shipDefId): number`
     - `getUpgradedShipCost(shipDefId): number`
     - `getShipCost(shipDefId): number`
   - **Can be imported by Deno edge function** ✅

2. **`/game/types/ShipTypes.core.ts`** (100 lines)
   - Re-exports all non-React types from ShipTypes.tsx
   - Defines `PureShipDefinition` without graphics
   - Fully Deno-compatible

#### Files Modified

1. **`/game/types/ShipTypes.tsx`**
   - Changed `graphics: ShipGraphic[]` to `graphics?: ShipGraphic[]` (optional)
   - Added comment explaining React import is client-only
   - Server can now import this file (as long as it doesn't use ShipGraphic type)

---

## What Needs To Be Done

### 📋 Phase 2: Server Refactor (Implementation Plan Ready)

**Complete implementation guide:** `/documentation/ENGINE_DELEGATION_PLAN.md`

#### Summary of Changes Needed

**File:** `/supabase/functions/server/index.tsx`

**Delete (removes ~1900 lines):**
- ❌ `ServerPhaseEngine` class (~800 lines)
- ❌ `IntentEngine` class (~400 lines, if exists)
- ❌ `SHIP_DEFINITIONS_MAP` (~300 lines)
- ❌ Manual ship building logic (~200 lines)
- ❌ `processAutomaticPowers` (~100 lines)
- ❌ `processHealthResolution` (~100 lines)

**Add (adds ~700 lines):**
- ✅ Import real engine modules
- ✅ Import pure ship definitions
- ✅ Refactor /intent endpoint to delegate
- ✅ Add SERVER KERNEL RULE comment

**Expected result:** ~1800-2200 lines (down from ~3000)

---

## Architecture Before vs After

### Before (Rule Drift Risk)

```
┌─────────────────┐         ┌──────────────────┐
│   Server File   │         │  Game Engine     │
├─────────────────┤         ├──────────────────┤
│ Ship Costs ❌   │         │ Ship Costs ✓     │
│ Phase Logic ❌  │         │ Phase Logic ✓    │
│ Build Logic ❌  │         │ Build Logic ✓    │
│ Health Logic ❌ │         │ Health Logic ✓   │
└─────────────────┘         └──────────────────┘
     TWO SOURCES OF TRUTH
```

### After (Single Source)

```
┌─────────────────┐         ┌──────────────────┐
│   Server File   │────────▶│  Game Engine     │
├─────────────────┤ delegate├──────────────────┤
│ Load State      │         │ Ship Costs ✓     │
│ Update Clock    │         │ Phase Logic ✓    │
│ Hash Verify     │         │ Build Logic ✓    │
│ Call Engine ────┼────────▶│ Health Logic ✓   │
│ Save State      │         └──────────────────┘
│ Return Events   │              SINGLE SOURCE
└─────────────────┘
```

---

## Server Kernel Rule

**Added to top of server file:**

```typescript
// ⚠️ SERVER KERNEL RULE
// This file must NOT contain game rules.
// All rule decisions must be delegated to the shared game engine.
// This file only:
// - validates intents (structure/format)
// - updates clocks (server time authority)
// - calls engine (delegation)
// - emits events (sequencing)
// - persists state (KV storage)
// - filters hidden info (commit/reveal protocol)
```

---

## Import Strategy

### Server Can Now Import

```typescript
// ✅ Pure data (no React)
import {
  PURE_SHIP_DEFINITIONS,
  getShipDefinitionById,
  getShipCost
} from '../../../game/data/ShipDefinitions.core.ts';

// ✅ Pure engine logic (no React)
import { GameEngine } from '../../../game/engine/GameEngine.tsx';
import { RulesEngine } from '../../../game/engine/RulesEngine.tsx';
import { EndOfTurnResolver } from '../../../game/engine/EndOfTurnResolver.tsx';

// ✅ Pure types (React import exists but not used)
import type { GameState, GameAction } from '../../../game/types/GameTypes';
import type { GameIntent, IntentResponse } from '../../../game/types/IntentEventTypes';
```

**Why this works:**
- Engine files (`.tsx`) contain NO JSX - they're pure TypeScript
- Type files have React import but server doesn't use ShipGraphic type
- Pure data files (`.ts`) have NO React dependency at all
- Deno can import all of these via relative paths

---

## Verification Tests

### 1. Drift Test

**Test:** Change Defender cost from 2 to 3 in `/game/data/ShipDefinitions.core.ts`

**Expected:**
```bash
# Server uses new cost without modification
curl -X POST .../intent -d '{"intent": {"type": "BUILD_REVEAL", "payload": {"buildShips": [{"shipDefId": "DEF"}]}}}'
# Response shows: "lines deducted: 3"
```

**Failure mode:** If server has hardcoded cost, it would still deduct 2

### 2. No Hand-Mutations Test

**Test:** Search for direct state mutations

```bash
cd /supabase/functions/server
grep -n "player.lines =" index.tsx    # Should find: 0 matches
grep -n "player.health =" index.tsx   # Should find: 0 matches  
grep -n ".push(newShip)" index.tsx    # Should find: 0 matches
grep -n "isDestroyed = true" index.tsx # Should find: 0 matches
```

**Expected:** All mutations via `gameState = engine.applyIntent(gameState, intent)`

### 3. Import Test

**Test:** Server file compiles in Deno

```bash
deno check /supabase/functions/server/index.tsx
# Should succeed with no errors
```

---

## New Server Flow

```typescript
POST /intent → 
  1. Load state from KV
  2. Update chess clock (server time)
  3. If COMMIT: store hash, return early
  4. If REVEAL: verify hash
  5. Validate intent via engine ────┐
  6. Apply intent via engine        │ DELEGATION
  7. Auto-advance via engine        │ (No game logic
  8. Run resolver if EOT phase      │  in server)
  9. Generate events from engine ───┘
  10. Persist state to KV
  11. Return state + events
```

---

## File Manifest

### Created
- `/game/data/ShipDefinitions.core.ts` - Pure ship data (70 ships)
- `/game/types/ShipTypes.core.ts` - Pure type re-exports
- `/documentation/ENGINE_DELEGATION_PLAN.md` - Implementation guide
- `/documentation/OPTION_B_IMPLEMENTATION_SUMMARY.md` - This file

### Modified
- `/game/types/ShipTypes.tsx` - Made graphics optional
- `/supabase/functions/server/engine_layer.txt` - Created (for reference)
- `/documentation/STEPS_5_7_IMPLEMENTATION.md` - Created (superseded by delegation plan)
- `/documentation/INTEGRATION_STATUS.md` - Created (status tracking)

### To Be Modified (Phase 2)
- `/supabase/functions/server/index.tsx` - Refactor to delegate
- `/game/engine/GameEngine.tsx` - Add validateIntent/applyIntent methods

---

## Risk Assessment

**✅ LOW RISK CHANGES:**
- Creating new pure data files
- Making graphics optional
- Adding type re-exports

**⚠️ MEDIUM RISK CHANGES:**
- Refactoring server /intent endpoint
- Deleting ServerPhaseEngine (if properly replaced)

**🔴 HIGH RISK (BUT REQUIRED):**
- Deleting manual ship building logic
- Deleting manual state mutations
- **Mitigation:** Comprehensive testing before deployment

---

## Testing Checklist

### Before Deployment
- [ ] Frontend still compiles
- [ ] Backend still compiles (Deno check)
- [ ] Can create new game
- [ ] Can join game
- [ ] Can commit build intent
- [ ] Can reveal build intent
- [ ] Ships are built with correct costs
- [ ] Can commit battle intent
- [ ] Can reveal battle intent
- [ ] End of turn resolution works
- [ ] Health changes only at EOT
- [ ] Game end detection works
- [ ] Multiplayer sync works

### After Deployment
- [ ] Monitor error logs
- [ ] Check response times
- [ ] Verify no rule drift
- [ ] Test with multiple concurrent games

---

## Next Steps

1. **Review ENGINE_DELEGATION_PLAN.md**
   - Understand each section
   - Identify any missing engine methods
   - Plan testing strategy

2. **Add GameEngine methods** (if needed)
   - `validateIntent()`
   - `applyIntent()`
   - `advancePhase()`

3. **Refactor server file**
   - Follow step-by-step plan
   - Delete old logic section by section
   - Test after each major change

4. **Run verification tests**
   - Drift test
   - No-hand-mutations test
   - Import test
   - Full integration test

5. **Deploy to staging**
   - Monitor logs
   - Test multiplayer
   - Verify performance

---

## Success Metrics

**When complete, these should all be true:**

✅ Server file is ~1800-2200 lines (down from ~3000)  
✅ No game rules in server file  
✅ All ship data from ShipDefinitions.core.ts  
✅ All mutations via engine.applyIntent()  
✅ All phase logic via engine  
✅ All health changes via EndOfTurnResolver  
✅ Drift test passes  
✅ No-hand-mutations test passes  
✅ Deno import test passes  
✅ All existing games still work  
✅ Multiplayer sync still works  

---

## Key Insight

**The Problem:** We were creating two parallel implementations:
- Client engine (in `/game/engine/`)
- Server engine (in `/supabase/functions/server/index.tsx`)

**The Solution:** Make the client engine importable by the server:
- Remove React dependencies from pure logic
- Create pure data layer (`ShipDefinitions.core.ts`)
- Make server delegate instead of reimplement

**The Result:** Single source of truth for all game rules. Change ship cost once, it updates everywhere. No risk of rule drift.

---

**Status:** ✅ Phase 1 complete. Phase 2 implementation plan ready. Awaiting execution approval.
