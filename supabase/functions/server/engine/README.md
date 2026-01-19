# /supabase/functions/server/engine — Server Orchestration & Glue

**Status:** Server-side orchestration layer  
**Authority:** Non-authoritative — calls canonical `engine_shared` logic

---

## Purpose

This directory contains **server orchestration and runtime glue** that connects the canonical game engine to the Supabase runtime environment.

**Key distinction:**
- `server/engine/*` = **server glue/orchestration** (auth, persistence, routing, intent protocol enforcement)
- `server/engine_shared/*` = **canonical pure engine code** bundled for Edge

**Responsibilities:**
1. Load game state from KV store
2. Validate intent permissions (player ownership, phase eligibility)
3. Call canonical `engine_shared` functions to compute new state
4. Persist results back to storage
5. Emit events/notifications as needed

**Non-responsibilities:**
- ❌ Defining independent game rules
- ❌ Maintaining separate phase tables
- ❌ Re-implementing engine logic
- ❌ Making authoritative gameplay decisions

**Critical rule:**  
Server glue may **not** embed rules; it must call `engine_shared`.

---

## Structure

```
/supabase/functions/server/engine/
  intent/         # Intent submission, hashing, commit/reveal protocol
  phase/          # Phase transitions and server-side phase entry hooks
  state/          # Game state types and persistence helpers
```

---

## Design Principles

### 1. Thin Wrapper Pattern

Server engine code should be **thin adapters** that:
- Load state → call `engine_shared` → save state
- Add **zero** independent game logic

❌ **Bad:**
```typescript
// Server defines its own phase timing
if (phase === 'build') {
  state.turnClock += 1;
}
```

✅ **Good:**
```typescript
// Server calls canonical engine
import { onEnterPhase } from '../engine_shared/phase/onEnterPhase';
const newState = onEnterPhase(state, 'build');
```

### 2. Permission Validation Only

Server validates **permissions** (who can act), not **rules** (what is valid):

✅ **Permission check (server):**
```typescript
if (intent.playerId !== session.playerId) {
  return { error: 'Not your turn' };
}
```

✅ **Rule check (engine_shared):**
```typescript
import { canBuildShip } from '../engine_shared/validation/buildEligibility';
if (!canBuildShip(state, playerId, shipDefId)) {
  return { error: 'Cannot build this ship' };
}
```

### 3. Stateless Functions

Avoid stateful classes. Prefer pure functions that:
- Take `(gameState, params) => newGameState`
- Have no side effects beyond persistence
- Can be unit tested without Supabase

---

## Intent Flow

```
Client sends intent
  ↓
Server validates session & permissions (server/engine)
  ↓
Server calls engine_shared to validate rules
  ↓
Server calls engine_shared to apply changes
  ↓
Server persists new state to KV store
  ↓
Server returns updated state to client
```

**Key insight:** Server orchestrates, `engine_shared` decides.

---

## Phase Entry Hooks

**Server responsibility:**
- Detect phase transitions
- Call `onEnterPhase(state, newPhase)` from `engine_shared`
- Persist dice rolls, line generation, clock updates

**Engine_shared responsibility:**
- Define what happens on phase entry
- Generate deterministic results (given explicit randomness input)

See: `server/engine_shared/phase/onEnterPhase.ts` (canonical)

---

## Migration Path

As `engine_shared` stabilizes:
1. Server imports move from `/game/engine/*` to `../engine_shared/*`
2. Server-side wrappers shrink further
3. All rule logic lives in canonical `engine_shared`

**Current status:**
- Phase table migrated to `engine_shared/phase/PhaseTable.ts`
- Effects migrated to `engine_shared/effects/`
- IntentReducer and BattleReducer still reference legacy paths

---

## Anti-Patterns to Avoid

❌ **Independent phase tables** — use `engine_shared/phase/PhaseTable`  
❌ **Server-only rules** — put them in `engine_shared` so client can preview  
❌ **Stateful managers** — use pure functions with explicit state  
❌ **Implicit side effects** — all mutations return new state explicitly  
❌ **Rule embedding** — server glue must call `engine_shared`, not duplicate logic  

---

## Related Documentation

- `/supabase/functions/server/README.md` — server folder organization
- `/engine/README.md` — client import surface
- `/documentation/contracts/canonical-handoff.md` — system-wide contracts