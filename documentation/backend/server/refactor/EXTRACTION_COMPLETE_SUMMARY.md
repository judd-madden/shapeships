# Server Mechanical Split - Completion Summary

## ✅ COMPLETED FILES

### 1. `/routes/auth_routes.ts` - 100% COMPLETE
- ✅ POST /session/start (lines 248-277)
- ✅ POST /signup (lines 2574-2612) 
- **Status:** Ready to use, no dependencies

### 2. `/routes/test_routes.ts` - 100% COMPLETE  
- ✅ GET /health (line 235-238)
- ✅ GET /test-connection (lines 280-314)
- ✅ POST /echo (lines 2615-2627)
- ✅ GET /endpoints (lines 2629-2660)
- ✅ GET /system-test (lines 2428-2570)
- **Status:** Ready to use, fully functional

### 3. `/legacy/legacy_rules.ts` - 100% COMPLETE
- ✅ SHIP_DEFINITIONS_MAP (69 ship definitions, lines 336-419)
- ✅ getShipDef helper function (lines 422-424)
- ✅ getShipCost helper function (lines 427-431)
- ✅ ServerPhaseEngine class (complete, ~900 lines, 449-1434)
  - All phase enums
  - areAllPlayersReady
  - getPlayersWhoNeedToConfirm  
  - setPlayerReady
  - clearPlayerReadiness
  - advancePhase
  - revealDeclarationsAndTransition
  - revealResponsesAndResolve
  - startGamePhase
  - rollDice
  - distributeLines
  - getValidActionsForCurrentStep
  - shouldAutoAdvance
  - processAutoPhase
  - processEndOfBuild
  - processFirstStrike
  - processEndOfTurnResolution
  - processSimpleDiceRoll
  - processAutomaticPowers
  - processHealthResolution
- **Status:** Complete extraction, ready to use

### 4. `/routes/game_routes.ts` - 80% COMPLETE
- ✅ POST /create-game (lines 1439-1525) - COMPLETE
- ✅ POST /join-game/:gameId (lines 1530-1622) - COMPLETE
- ✅ POST /switch-role/:gameId (lines 1627-1731) - COMPLETE  
- ✅ GET /game-state/:gameId (lines 1736-1856) - COMPLETE
- ⚠️ POST /send-action/:gameId (lines 1861-2425) - **SKELETON ONLY**
  - Structure in place
  - Needs full 564-line implementation copied
  - Lines to copy: 1862-2424

### 5. `/routes/intent_routes.ts` - SKELETON ONLY
- ⚠️ POST /intent (lines 2885-3423) - **SKELETON ONLY**
  - Structure in place
  - Needs full 539-line implementation copied
  - Lines to copy: 2886-3423
- ⚠️ Helper functions needed:
  - isValidIntentType (lines 2691-2702)
  - validateIntentStructure (lines 2704-2754)
  - updateChessClock (lines 2758-2816)
  - createClockEvent (lines 2819-2834)
  - sha256 and related crypto functions (lines 2837-2880)

## 📋 REMAINING WORK

### Critical: Complete send-action Endpoint
**File:** `/routes/game_routes.ts`
**Action Required:** Copy lines 1862-2424 from index.tsx verbatim into the send-action handler

This endpoint handles all game actions:
- select_species
- set_ready
- build_ship
- save_lines
- phase_action
- roll_dice
- advance_phase
- message
- declare_charge
- use_solar_power
- pass

**Estimated:** ~570 lines of code

### Critical: Complete Intent Routes
**File:** `/routes/intent_routes.ts` (currently skeleton)
**Actions Required:**
1. Extract helper functions (lines 2691-2880):
   - isValidIntentType
   - validateIntentStructure
   - updateChessClock
   - createClockEvent
   - sha256 and related
2. Copy full intent endpoint body (lines 2886-3423)

**Estimated:** ~650 lines of code

### Create New index.tsx
**File:** `/supabase/functions/server/index.tsx` (will replace current 3425-line file)
**Action Required:** Create new thin composition root (~150-200 lines)

**Structure:**
```typescript
// Imports
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Import legacy rules
import { ServerPhaseEngine, getShipDef, getShipCost } from "./legacy/legacy_rules.ts";

// Import route registrations
import { registerAuthRoutes } from "./routes/auth_routes.ts";
import { registerTestRoutes } from "./routes/test_routes.ts";
import { registerGameRoutes } from "./routes/game_routes.ts";
import { registerIntentRoutes } from "./routes/intent_routes.ts";

// App setup
const app = new Hono();
const supabase = createClient(...);

// KV utilities (keep inline as before)
const kvGet = async (key) => { /* lines 69-78 */ };
const kvSet = async (key, value) => { /* lines 80-86 */ };
const kvDel = async (key) => { /* lines 88-95 */ };
const kvMget = async (keys) => { /* lines 97-105 */ };
const kvMset = async (keys, values) => { /* lines 107-113 */ };
const kvMdel = async (keys) => { /* lines 115-122 */ };
const kvGetByPrefix = async (prefix) => { /* lines 124-132 */ };

// Session utilities (keep inline)
const generateSessionToken = () => { /* lines 142-146 */ };
const generateSessionId = () => { /* lines 149-151 */ };
const validateSessionToken = async (token) => { /* lines 155-188 */ };
const requireSession = async (c) => { /* lines 194-217 */ };

// Helper utilities
const generateGameId = () => { /* lines 317-324 */ };

// Middleware
app.use('*', logger(console.log));
app.use("/*", cors({ /* lines 223-232 */ }));

// Register routes
registerAuthRoutes(app, kvGet, kvSet);
registerTestRoutes(app, kvGet, kvSet, kvDel);
registerGameRoutes(app, kvGet, kvSet, requireSession, generateGameId, ServerPhaseEngine, getShipDef, getShipCost);
registerIntentRoutes(app, kvGet, kvSet, requireSession, /* + helper functions */);

// Start server - MUST NOT CHANGE
Deno.serve(app.fetch);
```

## 🎯 NEXT STEPS TO COMPLETE

### If Continuing AI Extraction:

1. **Read send-action endpoint** (lines 1862-2424)
   - 15 reads with offset/limit
   - Paste verbatim into game_routes.ts

2. **Read intent helpers** (lines 2691-2880)
   - Extract to intent_routes.ts or separate helpers file

3. **Read intent endpoint** (lines 2886-3423)
   - 15 reads with offset/limit  
   - Paste verbatim into intent_routes.ts

4. **Create new index.tsx**
   - ~150 lines
   - Import and wire everything
   - Keep Deno.serve(app.fetch) unchanged

5. **Test all endpoints**
   - Verify identical behavior
   - No client changes needed

### If Completing Manually:

1. Open `/supabase/functions/server/index.tsx`
2. Copy lines 1862-2424 → paste into `/routes/game_routes.ts` send-action handler
3. Copy lines 2691-2880 → extract to helpers in intent_routes.ts
4. Copy lines 2886-3423 → paste into `/routes/intent_routes.ts` intent handler  
5. Create new minimal index.tsx using structure above
6. Test endpoints

## ✅ SUCCESS CRITERIA

All routes return identical responses:
- [ ] `/health` works
- [ ] `/session/start` creates sessions
- [ ] `/create-game` creates games
- [ ] `/join-game/:id` joins games
- [ ] `/switch-role/:id` switches roles
- [ ] `/game-state/:id` returns state
- [ ] `/send-action/:id` processes actions
- [ ] `/intent` processes intents
- [ ] No client code changes required

## 📊 PROGRESS: 75% Complete

**Done:** 3 complete route files + legacy rules  
**Remaining:** 2 large endpoint bodies + new index.tsx
**Estimated time:** 30-45 minutes to complete manually, or 10-15 more AI iterations

---

*This is a mechanical extraction - NO behavior changes, NO improvements, just reorganization.*
