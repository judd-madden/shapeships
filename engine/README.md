# /engine — Canonical Import Surface

**Status:** Client Import Surface  
**Authority:** The canonical implementation lives in `/supabase/functions/server/engine_shared/`

---

## Purpose

`/engine` is the **canonical import surface** used by client code (and optionally any non-edge tooling).

The canonical implementation is bundled for Edge under:
```
supabase/functions/server/engine_shared/*
```

`/engine/*` must be either:
- **Thin re-exports** to `engine_shared/*`, or
- **A mirrored copy** (if tooling can't follow re-exports)

**Key principle:**  
Source-of-truth code is in `engine_shared` because Supabase Edge bundling only includes files under `supabase/functions/server/`.  
`/engine` exists to keep clean, stable imports and prevent drift in UI code.

---

## Constraints

- ✅ **Pure functions only** — no React, no Supabase, no I/O
- ✅ **Deterministic** — same input = same output, always
- ✅ **Framework-agnostic** — works in any JavaScript runtime
- ❌ **No UI logic** — rendering belongs in `/game/display`
- ❌ **No network calls** — persistence belongs in server runtime glue

---

## Structure

```
/engine/
  data/           # Ship definitions, species data, core rules tables
  effects/        # Effect system (re-exports from engine_shared/effects)
  phase/          # Phase table (re-exports from engine_shared/phase)
  battle/         # Battle reducer and combat mechanics
  validation/     # Eligibility, constraint checking, move validation
```

---

## Usage

### Server (Authoritative)

Server code should import from `/supabase/functions/server/engine_shared/` directly.

### Client (Preview/Simulation)

```typescript
import { BattleReducer } from '/engine/battle/BattleReducer';
import { onEnterPhase } from '/engine/phase/onEnterPhase';
import { translateShipPowers } from '/engine/effects/translateShipPowers';

// Client code uses /engine/* for clean imports
const eligible = canBuildShip(gameState, playerId, shipDefId);
```

---

## Migration Status

**Target:** `/engine` becomes a thin re-export layer to `engine_shared`.

**Current transitional imports:**
- `/game/engine/effects/*` → re-exports from `/engine/effects/*`
- `/game/engine/phase/*` → re-exports from `/engine/phase/*`

These legacy paths will eventually be removed.

---

## Non-Goals

This engine import surface does **not**:
- Manage sessions or authentication
- Persist state to databases
- Render UI components
- Handle network transport

Those concerns belong in:
- `/supabase/functions/server/engine/` — server runtime glue (orchestration)
- `/supabase/functions/server/engine_shared/` — canonical pure engine logic
- `/game/display/` — UI rendering
- `/game/client/` — client state management

---

## Principles

1. **Implementation in engine_shared** — source-of-truth code lives there
2. **Import surface in /engine** — stable client imports point here
3. **No hidden state** — all game state is explicit and serializable
4. **Testable in isolation** — no mocks required, pure functions only
5. **Single source of truth** — server and client reference the same logic

---

For implementation details, see:
- `/documentation/contracts/canonical-handoff.md` — architecture contracts
- `/supabase/functions/server/README.md` — server folder organization
- `/game/engine/effects/ARCHITECTURE.md` — effect system design