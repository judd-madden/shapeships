# Server Module Organization

This directory contains all server-side code for Shapeships that runs in Supabase Edge Functions.

## Folder Structure

### `/engine_shared/` — Pure Engine Modules

Contains **pure deterministic modules** reusable across engine subsystems.

**Characteristics:**
- ✅ Pure functions (deterministic, no side effects)
- ✅ Type-only schemas and interfaces
- ✅ Translators, calculators, evaluators
- ✅ No Date.now(), Math.random(), crypto.randomUUID()
- ❌ Must NOT read/write GameState directly
- ❌ Must NOT access Supabase client or request context
- ❌ Must NOT rely on time or randomness

**Examples:**
- `effects/Effect.ts` — Effect type definitions
- `effects/translateShipPowers.ts` — Ship power → Effect translator
- `phase/PhaseTable.ts` — Phase sequence and validation
- `types/ShipTypes.ts` — Ship type definitions

**Import rules:**
- Can import from other `engine_shared/` modules
- Can import from shared type files
- Must NOT import from `/engine/`, `/routes/`, or outside `/server/`

---

### `/engine/` — Authoritative Orchestration

Contains **stateful orchestration logic** that reads/writes game state.

**Characteristics:**
- ✅ Intent processing and validation
- ✅ Phase advancement and transitions
- ✅ State mutations and persistence
- ✅ Can use `engine_shared/` pure modules
- ❌ Should delegate pure logic to `engine_shared/`

**Examples:**
- `phase/advancePhase.ts` — Phase progression logic
- `phase/onEnterPhase.ts` — Phase entry hooks

**Import rules:**
- Can import from `engine_shared/` (pure modules)
- Can import from other `/engine/` modules
- Must NOT import from outside `/server/`

---

### `/routes/` — HTTP Handlers

Contains **HTTP route handlers** for the Hono web server.

**Characteristics:**
- ✅ Request/response handling
- ✅ Authentication and authorization
- ✅ Calls `/engine/` for business logic
- ✅ Reads/writes database via KV store
- ❌ Should NOT contain game rules or validation logic

**Examples:**
- `game_routes.ts` — Game creation, state management
- (future: `intent_routes.ts`, `battle_routes.ts`)

**Import rules:**
- Can import from `/engine/` (orchestration)
- Can import from `engine_shared/` (pure modules)
- Must NOT import from outside `/server/`

---

### `/legacy/` — Deprecated Code

Contains **old implementations** that are being phased out.

**Do not use for new features.**

---

## Import Boundaries (CRITICAL)

All server code must **ONLY** import from paths inside `/supabase/functions/server/**`.

**✅ ALLOWED:**
```typescript
import { translateShipPowers } from '../engine_shared/effects/translateShipPowers.ts';
import { PHASE_SEQUENCE } from '../engine_shared/phase/PhaseTable.ts';
import { advancePhase } from '../engine/phase/advancePhase.ts';
```

**❌ FORBIDDEN:**
```typescript
import { ... } from '/game/...';
import { ... } from '../../../game/...';
import { ... } from '/engine/...';  // outside /server/
```

**Why:** Supabase Edge function bundler can only include code inside `/server/`.

---

## Deployment Constraints

Code in this directory must be **Edge-compatible**:

- ✅ Deno runtime (not Node.js)
- ✅ TypeScript with `npm:` or `jsr:` imports
- ✅ Node built-ins via `node:` specifier (e.g., `import process from "node:process"`)
- ❌ No filesystem writes (except `/tmp`)
- ❌ No reliance on local file paths outside bundle

---

## Testing

- Unit tests can live alongside modules (e.g., `*.test.ts`)
- Integration tests should use the deployed server endpoints
- See `test_all_endpoints.sh` for endpoint testing

---

## Key Principles

1. **Pure shared logic** → `/engine_shared/`
2. **Stateful orchestration** → `/engine/`
3. **HTTP handling** → `/routes/`
4. **All imports stay inside `/server/`**
5. **No Date.now(), Math.random() in `engine_shared/`**
