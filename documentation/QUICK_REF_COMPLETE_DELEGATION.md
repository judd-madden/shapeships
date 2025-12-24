# Quick Reference: Completing Server Delegation

**Use this when you're ready to complete Phase 2**

---

## ✅ What You'll Get

- Single source of truth for all game rules
- No risk of rule drift between server and client
- Change ship cost once, updates everywhere
- ~1000 fewer lines of duplicated code in server

---

## 📋 The 3-Step Process

### Step 1: Update Engine Imports (8 files, ~15 minutes)

Change this line in each file:

```typescript
// Before
import { getShipById } from '../data/ShipDefinitions';

// After
import { getShipById } from '../data/ShipDefinitions.core';
```

**Files to update:**
1. `/game/engine/RulesEngine.tsx`
2. `/game/engine/SpeciesIntegration.tsx`
3. `/game/engine/ActionResolver.tsx`
4. `/game/engine/EndOfTurnResolver.tsx`
5. `/game/engine/PowerExecutor.tsx`
6. `/game/engine/SpecialLogic.tsx`
7. `/game/engine/PassiveModifiers.tsx`
8. `/game/engine/EffectCalculator.tsx`

**Test:** `npm run dev` - client should still work

---

### Step 2: Enable Server Imports (1 file, ~5 minutes)

In `/supabase/functions/server/index.tsx`:

**Uncomment the imports:**
```typescript
// Line ~17-40: Remove the comment markers
import { GameEngine } from "../../../game/engine/GameEngine.tsx";
import { ShapeshipsRulesEngine } from "../../../game/engine/RulesEngine.tsx";
import { EndOfTurnResolver } from "../../../game/engine/EndOfTurnResolver.tsx";
import { PURE_SHIP_DEFINITIONS, getShipById } from "../../../game/data/ShipDefinitions.core.ts";
import type { GameState, Player } from "../../../game/types/GameTypes";
```

**Delete the temporary code:**
```typescript
// Lines ~188-288: Delete SHIP_DEFINITIONS_MAP
// Lines ~290-1277: Delete ServerPhaseEngine class
// Lines ~266-275: Delete getShipDef and getShipCost functions
```

**Test:** `deno check /supabase/functions/server/index.tsx` - should succeed

---

### Step 3: Refactor /intent Endpoint (~30 minutes)

Replace the intent handler with delegation logic (see `/documentation/ENGINE_DELEGATION_PLAN.md` for full code).

**Key changes:**
- Use `engine.applyIntent(gameState, intent)` instead of manual mutations
- Use `EndOfTurnResolver.resolve()` instead of manual health logic
- Use `GamePhasesEngine.shouldAutoAdvance()` instead of ServerPhaseEngine

**Test:**
- Create game
- Build ships
- Play through a turn
- Verify health changes at end of turn
- Verify multiplayer sync works

---

## 🧪 Testing Checklist

```
[ ] npm run dev - client compiles
[ ] deno check server file - server compiles
[ ] Create new game works
[ ] Join game works
[ ] Build ships works
[ ] Ship costs are correct
[ ] Battle phase works
[ ] Health changes at EOT
[ ] Game end detection works
[ ] Multiplayer sync works
```

---

## 🎯 Success Test

**Change Defender cost from 2 to 3:**

1. Edit `/game/data/ShipDefinitions.core.ts`
2. Change `basicCost: { lines: 2 }` to `basicCost: { lines: 3 }`
3. Restart server and client
4. Build a Defender
5. Verify 3 lines deducted (not 2)
6. **No server code changes needed** ✅

---

## ⚠️ If Something Breaks

**Client won't compile:**
- Check that all engine imports were updated correctly
- Verify `.core` file exists and exports `getShipById`

**Server won't compile:**
- Verify Deno can resolve the import paths
- Check that engine files have no JSX syntax
- Try: `deno cache --reload /supabase/functions/server/index.tsx`

**Game logic broken:**
- Check that `applyIntent` returns correct events
- Verify `EndOfTurnResolver` is being called
- Look for missing state mutations

**Rollback:**
- Revert all changes: `git reset --hard HEAD`
- Server was working before, will work after
- No data loss (state is in database)

---

## 📚 Reference Documents

- **Full implementation guide:** `/documentation/ENGINE_DELEGATION_PLAN.md`
- **Architecture explanation:** `/documentation/OPTION_B_IMPLEMENTATION_SUMMARY.md`
- **Blocker analysis:** `/documentation/PHASE_2_BLOCKED_STATUS.md`
- **Current status:** `/documentation/OPTION_B_FINAL_STATUS.md`

---

## 💡 Pro Tips

1. **Do it in a feature branch:** `git checkout -b feature/engine-delegation`
2. **Test after each step:** Don't do all 3 steps at once
3. **Start with Step 1:** It's the safest change
4. **Use the drift test:** It's the quickest way to verify success
5. **Don't rush:** The current setup works, take your time

---

**Estimated time:** 1-2 hours including testing  
**Risk level:** Medium (good test coverage mitigates risk)  
**Reward:** Clean architecture, no rule drift, easier maintenance

---

**Ready to start? Begin with Step 1 (update engine imports).**
