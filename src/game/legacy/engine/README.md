# /game/engine — Transitional & Legacy Engine Code

**Status:** Mixed — contains transitional (active), legacy (deprecated), and dev-only code  
**Authority:** Non-authoritative — canonical logic lives in `/supabase/functions/server/engine_shared/`

---

## ⚠️ Important

> Legacy reference only
> This document is retained for historical/reference purposes and does not define the current authoritative Shapeships architecture or runtime behavior. For current architectural truth, see `src/documentation/contracts/canonical-handoff.md` and `src/documentation/contracts/code-ownership-map.md`.
>
> The title and status language above are preserved as historical migration-era framing and are not current project guidance.

**Do not add new logic to `/game/engine`.**

**New engine work must go in:**
```
/supabase/functions/server/engine_shared/*
```
Then exposed via `/engine/*` if needed by client.

This directory is preserved as historical migration/reference material.

---

## Directory Categories

### 1. Transitional Modules (ACTIVE — Temporary Shims)

`/game/engine/phase/*` and `/game/engine/effects/*` are **temporary shims**.

**Chain:**
```
/game/engine/phase/*     →  re-exports  →  /engine/phase/*     →  re-exports  →  engine_shared/phase/*
/game/engine/effects/*   →  re-exports  →  /engine/effects/*   →  re-exports  →  engine_shared/effects/*
```

**Status:**
- ✅ Currently imported by legacy code
- ✅ These re-export from `/engine/*` (import surface), which re-exports from `engine_shared/*` (implementation)
- 🔄 Will be removed once all imports migrate to `/engine/*`

**What you can do:**
- Import these modules if you're working in legacy code
- Make bug fixes to the canonical implementation in `engine_shared/*`
- Migrate your imports to `/engine/*` (stable client import surface)

**What you should not do:**
- Add new independent modules here
- Modify these shim files (they just re-export)
- Assume this location is permanent

**Migration target:**  
Client code should import from `/engine/*` (which points to `engine_shared/*`).

---

### 2. Legacy Client Engine (DEPRECATED)

All other files in `/game/engine` (excluding `effects/`, `phase/`, `battle/`, and dev harnesses) are part of an **old client-authoritative engine**.

```
ActionResolver.clientLegacy.tsx
GamePhases.clientLegacy.tsx
RulesEngine.clientLegacy.tsx
EffectCalculator.tsx
EndOfTurnResolver.tsx
GameEngine.tsx
ManualPowerOverrides.ts
PassiveModifierIds.tsx
PassiveModifiers.tsx
PowerExecutor.tsx
PowerResolver.ts
SpeciesIntegration.tsx
phaseLabel.ts
shipDerivations/
```

**Status:**
- ❌ **DEPRECATED** — do not use for authoritative gameplay
- ❌ Retained for reference only
- ❌ Will be archived or removed in future cleanup passes

**These files have `DEPRECATED — LEGACY CLIENT ENGINE` headers.**

**Why deprecated?**
- They were part of an earlier architecture where the client made authoritative decisions
- The current architecture uses server-authoritative `engine_shared` logic
- Keeping them prevents accidental use and signals migration status

---

### 3. Battle System (TRANSITIONAL)

```
/game/engine/battle/*        # BattleReducer, battle simulation harness
```

**Status:**
- ✅ BattleReducer is canonical and stable ("battle law")
- ✅ Used by server IntentReducer
- 🔄 Will migrate to `/engine/battle/*` in future passes
- ✅ Simulation harness is dev-only (should move to `/game/devtools/*` eventually)

**No deprecated headers** — this is active authoritative code.

---

### 4. Dev-Only Utilities (TEMPORARY)

```
/game/engine/battle/BattleSimulationHarness.ts
```

**Status:**
- ✅ Dev/test harness for battle mechanics
- 🔄 Should eventually move to `/game/devtools/*` or `/components/dev/*`
- ✅ Not used in production gameplay

**No deprecated headers** — these are tools, not deprecated rules.

---

## Migration Roadmap

### Phase 1: Stabilization (✅ Complete)
- Lock down BattleReducer as canonical
- Document effects architecture
- Establish phase contracts

### Phase 2: Transitional Shims (✅ Complete)
- Create `engine_shared/effects/*` and `engine_shared/phase/*` (canonical)
- Create `/engine/effects/*` and `/engine/phase/*` (client import surface)
- Convert `/game/engine/effects/*` and `/game/engine/phase/*` to re-export shims

### Phase 3: Client Import Migration (🔄 In Progress)
- Update client imports from `/game/engine/*` to `/engine/*`
- Remove temporary shims once migration complete

### Phase 4: Legacy Removal (Future)
- Archive or delete deprecated legacy files
- Move dev harnesses to `/game/devtools/*`
- `/game/engine` becomes empty or removed

---

## File-by-File Status Guide

| File/Directory | Status | Action |
|----------------|--------|--------|
| `effects/*` | Temporary shim → `/engine` | 🔄 Migrate imports to `/engine/effects/*` |
| `phase/*` | Temporary shim → `/engine` | 🔄 Migrate imports to `/engine/phase/*` |
| `battle/*` | Transitional → `/engine` | ✅ Use normally |
| `ActionResolver.clientLegacy.tsx` | **DEPRECATED** | ❌ Do not use |
| `GamePhases.clientLegacy.tsx` | **DEPRECATED** | ❌ Do not use |
| `RulesEngine.clientLegacy.tsx` | **DEPRECATED** | ❌ Do not use |
| `EffectCalculator.tsx` | **DEPRECATED** | ❌ Do not use |
| `EndOfTurnResolver.tsx` | **DEPRECATED** | ❌ Do not use |
| `GameEngine.tsx` | **DEPRECATED** | ❌ Do not use |
| `ManualPowerOverrides.ts` | **DEPRECATED** | ❌ Do not use |
| `PassiveModifierIds.tsx` | **DEPRECATED** | ❌ Do not use |
| `PassiveModifiers.tsx` | **DEPRECATED** | ❌ Do not use |
| `PowerExecutor.tsx` | **DEPRECATED** | ❌ Do not use |
| `PowerResolver.ts` | **DEPRECATED** | ❌ Do not use |
| `SpeciesIntegration.tsx` | **DEPRECATED** | ❌ Do not use |
| `phaseLabel.ts` | **DEPRECATED** | ❌ Do not use |
| `shipDerivations/*` | **DEPRECATED** | ❌ Do not use |

---

## Why This Structure?

This mixed structure reflects **architectural evolution**:

1. **Old client-authoritative model** (deprecated)
   - Client made gameplay decisions
   - Rules scattered across multiple files
   - No single source of truth

2. **Transitional period** (current)
   - Effects and phase logic migrated to `engine_shared/*`
   - `/engine/*` provides stable client import surface
   - `/game/engine/*` shims for backward compatibility
   - Battle system stable but not yet moved
   - Legacy code retained for reference

3. **Target state** (future)
   - All canonical logic in `engine_shared/*`
   - Server imports from `engine_shared/*` directly
   - Client imports from `/engine/*` (which re-exports `engine_shared/*`)
   - `/game/engine` becomes empty or removed

---

## Architecture Flow

```
CLIENT CODE
    ↓
  imports from /engine/* (stable import surface)
    ↓
  re-exports from supabase/functions/server/engine_shared/* (canonical implementation)
    ↑
  imported by supabase/functions/server/engine/* (server orchestration)
    ↑
SERVER CODE
```

**Key principle:**  
Source-of-truth code is in `engine_shared` because Supabase Edge bundling only includes files under `supabase/functions/server/`.

---

## Related Documentation

- `/supabase/functions/server/README.md` — server folder organization
- `/supabase/functions/server/engine/README.md` — server orchestration layer
- `/engine/README.md` — client import surface architecture
- `/documentation/contracts/canonical-handoff.md` — system-wide contracts
- `/game/engine/effects/ARCHITECTURE.md` — effect system design

---

## Questions?

**"Can I import from `/game/engine/effects/`?"**  
🔄 It works (temporary shim), but migrate to `/engine/effects/*` instead.

**"Can I import from `GameEngine.tsx`?"**  
❌ No, it's deprecated legacy code.

**"Can I add a new file to `/game/engine/`?"**  
❌ No, add it to `/supabase/functions/server/engine_shared/*` instead (then expose via `/engine/*` if needed by client).

**"Can I modify `BattleReducer.ts`?"**  
⚠️ Only for critical bug fixes. It's locked as stable "battle law."

**"Where should I put new game logic?"**  
✅ In `/supabase/functions/server/engine_shared/*`, following the canonical architecture.  
✅ Then expose via `/engine/*` if client code needs it.
