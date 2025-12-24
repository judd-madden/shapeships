# Option B Implementation - Phase 1 Complete, Phase 2 Blocked

**Date:** 2024-12-24  
**Status:** ⚠️ BLOCKED - Engine files have circular dependency

---

## ✅ What Was Completed (Phase 1)

1. **Created pure data layer**
   - `/game/data/ShipDefinitions.core.ts` - Pure ship data (no React)
   - `/game/types/ShipTypes.core.ts` - Pure type re-exports
   - Made `graphics` field optional in ShipTypes.tsx

2. **Added SERVER KERNEL RULE comment**
   - Top of `/supabase/functions/server/index.tsx`
   - Documents what server should/shouldn't do

3. **Created implementation plan**
   - `/documentation/ENGINE_DELEGATION_PLAN.md`
   - `/documentation/OPTION_B_IMPLEMENTATION_SUMMARY.md`

---

## ⚠️ What's Blocking Phase 2

### The Circular Dependency Problem

**Engine files import ShipDefinitions with graphics:**

```typescript
// /game/engine/RulesEngine.tsx
import { getShipById } from '../data/ShipDefinitions'; // ❌ Has React components

// /game/engine/EndOfTurnResolver.tsx
import { getShipById } from '../data/ShipDefinitions'; // ❌ Has React components

// /game/engine/PowerExecutor.tsx
import { getShipById } from '../data/ShipDefinitions'; // ❌ Has React components
```

**ShipDefinitions.tsx imports graphics:**

```typescript
// /game/data/ShipDefinitions.tsx
import { DefenderShip, FighterShip } from '../../graphics/human/assets'; // ❌ React components
```

**Graphics files use React:**

```typescript
// /graphics/human/assets.tsx
export const DefenderShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg>...</svg>
);
```

### Why This Blocks Server Import

```typescript
// Server tries to import engine
import { GameEngine } from '../../../game/engine/GameEngine.tsx';

// GameEngine imports RulesEngine
import { RulesEngine } from './RulesEngine.tsx';

// RulesEngine imports ShipDefinitions
import { getShipById } from '../data/ShipDefinitions';

// ShipDefinitions imports graphics
import { DefenderShip } from '../../graphics/human/assets';

// Graphics use React
import React from 'react';

// Deno can't run React without a bundler ❌
```

---

## Solutions

### Option 1: Refactor Engine Files (Cleanest, Most Work)

**Change all engine files** to import from the pure core file:

```typescript
// Before (in engine files)
import { getShipById } from '../data/ShipDefinitions'; // ❌

// After
import { getShipById } from '../data/ShipDefinitions.core'; // ✅
```

**Files to update:** (8 files)
- `/game/engine/RulesEngine.tsx`
- `/game/engine/SpeciesIntegration.tsx`
- `/game/engine/ActionResolver.tsx`
- `/game/engine/EndOfTurnResolver.tsx`
- `/game/engine/PowerExecutor.tsx`
- `/game/engine/SpecialLogic.tsx`
- `/game/engine/PassiveModifiers.tsx`
- `/game/engine/EffectCalculator.tsx`

**Risk:** Low - just changing import paths

### Option 2: Server Uses Simplified Logic (Interim Solution)

**Keep current server implementation** but improve it:
- Keep SHIP_DEFINITIONS_MAP (already has all ship costs)
- Keep ServerPhaseEngine (already has phase logic)
- Improve documentation and safety
- Plan to refactor later when engine is fully importable

**Risk:** Low - no breaking changes

### Option 3: Bundle Engine for Deno (Complex)

**Add build step** that bundles engine into Deno-compatible format:
- Use esbuild to bundle engine code
- Strip React dependencies
- Output pure JS module
- Server imports bundled version

**Risk:** High - adds build complexity

---

## Recommendation: Option 2 (Interim) + Option 1 (Future)

### Immediate Action (Phase 2A): Clean Up Server

1. Keep SERVER KERNEL RULE comment ✅ (already done)
2. Document that ServerPhaseEngine is **temporary**
3. Add comments explaining it will be replaced when engine is importable
4. Remove the failed import attempts
5. Keep existing logic but improve it

### Future Action (Phase 2B): Make Engine Importable

1. Update all engine files to import from `.core` files
2. Test that client still works
3. Test that server can import
4. Replace ServerPhaseEngine with real GameEngine
5. Delete duplicated logic

---

## Current Server File Status

**Line count:** 3142 lines

**Structure:**
- Lines 1-100: Hono setup, KV helpers, CORS ✅ (keep)
- Lines 100-263: SHIP_DEFINITIONS_MAP ⚠️ (temporary, will replace with core imports)
- Lines 264-276: Ship helper functions ⚠️ (temporary)
- Lines 278-1263: ServerPhaseEngine ⚠️ (temporary, will replace with real engine)
- Lines 1265-2609: Legacy endpoints ✅ (keep for now)
- Lines 2610-3142: Intent endpoint ⚠️ (needs improvement but works)

**What to do now:**
1. Add comments documenting temporary code
2. Remove failed import attempts
3. Improve intent endpoint documentation
4. Leave logic intact until engine is importable

---

## Phase 2A Implementation (Immediate)

```typescript
// At top of file (already done)
// ⚠️ SERVER KERNEL RULE
// This file must NOT contain game rules.
// All rule decisions must be delegated to the shared game engine.

// After SERVER KERNEL RULE comment, add:
// ⚠️ TEMPORARY: Until engine files can be imported by Deno
// The following code duplicates game logic from /game/engine/
// This is a known tech debt. See /documentation/OPTION_B_IMPLEMENTATION_SUMMARY.md
// 
// BLOCKER: Engine files import ShipDefinitions.tsx which imports React components
// SOLUTION: Update engine files to import from ShipDefinitions.core.ts (pure data)
//
// When engine is importable, replace:
// - SHIP_DEFINITIONS_MAP → import from ShipDefinitions.core.ts
// - ServerPhaseEngine → import from GamePhases.tsx
// - getShipDef/getShipCost → import from ShipDefinitions.core.ts
```

---

## Next Steps

**Choose one:**

1. **Conservative (Recommended):**
   - Implement Phase 2A (add documentation)
   - Plan Phase 2B (engine refactor) for later
   - Server works, tech debt is documented

2. **Aggressive:**
   - Immediately refactor all 8 engine files to use `.core` imports
   - Test client still works
   - Complete full delegation
   - Higher risk but cleaner end state

**Which approach do you want to take?**
