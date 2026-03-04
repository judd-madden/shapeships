# Effects Architecture

**Location:** `/game/engine/effects/`

**Status:** Canonical Rules Kernel

---

## Purpose

This folder is the **authoritative Effects system** for Shapeships.

It serves as the **rules kernel** that feeds the battle reducer. All effect resolution logic flows through this system.

**Key characteristics:**
- Engine-only (no UI, no networking)
- Pure functions and immutable types
- Deterministic and side-effect free
- Server-safe (Deno edge function compatible)

**What lives here:**
- Canonical Effect type definitions
- Phase, timing, and survivability semantics
- JSON → Effect translation logic
- Input contracts for the battle reducer

---

## Core Concepts

### Effect

An **Effect** is an immutable, structured representation of a game action that will be resolved during battle.

Every Effect has:
- **id** - unique identifier
- **ownerPlayerId** - player who owns the effect
- **source** - where it came from (ship instance or system)
- **phase** - when it applies in battle
- **timing** - how it triggers
- **kind** - what it does
- **magnitude** - numeric value (optional)
- **target** - who/what it affects
- **survivability** - behavior if source is destroyed

Effects are **data**, not execution. The battle reducer interprets them.

### Phase (BattlePhase)

Battle resolution proceeds through **four ordered phases**:

1. **FirstStrike** - Effects that strike first (before normal resolution)
2. **ChargeDeclaration** - Player charges are declared (queued, not resolved)
3. **ChargeResponse** - Opponent charges respond (queued, not resolved)
4. **Resolution** - All damage, healing, and other effects resolve simultaneously

**Critical rule:** Phases enforce ordering. Simultaneity happens **within** phases, not across them.

### Timing (EffectTiming)

Timing determines **how** an effect activates:

- **Automatic** - Triggers every turn (continuous powers)
- **OnceOnly** - Triggers once when ship is built
- **Charge** - Requires spending a charge to activate

Timing is **separate from phase**. A charge power may resolve in FirstStrike, ChargeDeclaration, ChargeResponse, or Resolution depending on its nature.

### Survivability (SurvivabilityRule)

Survivability determines whether an effect resolves if its source ship is destroyed:

- **DiesWithSource** - Effect is canceled if source ship destroyed
- **ResolvesIfDestroyed** - Effect resolves even if source destroyed

**Examples:**
- Upon Destruction powers → `ResolvesIfDestroyed`
- FirstStrike powers → `ResolvesIfDestroyed` (strike happens before destruction)
- Continuous damage → `DiesWithSource` (ship must survive to deal damage)

---

## Explicit Non-Goals

This system does **NOT**:

❌ **Render UI** - Effects are data, not display components  
❌ **Handle persistence** - Effects are ephemeral; game state is persisted elsewhere  
❌ **Support "custom" or "conditional" effects** - All effects must map to canonical kinds  
❌ **Provide end-of-turn shortcuts** - Battle resolution is explicit, not implicit  
❌ **Manage networking** - Effects are computed server-side, then sent to clients  
❌ **Interpret natural language** - Ship powers are pre-compiled to structured data  

**Why these constraints?**

The Effects system is a **rules kernel**. It must be:
- Simple enough to test exhaustively
- Deterministic enough to reproduce bugs
- Pure enough to run in edge functions
- Explicit enough to prevent hidden state

Complex features (UI, conditionals, custom logic) live **outside** this folder.

---

## Relationship to JSON

Ship definitions are stored as JSON (see `/game/data/ShipDefinitions.json.ts`).

**JSON declares WHAT ships do:**
- "Deal 2 damage"
- "Heal 1"
- "Use 1 charge to build a Defender"

**The Engine decides WHEN and HOW:**
- Which phase does this resolve in?
- Is it automatic or charge-based?
- Does it survive source destruction?

**Translation happens via ShipPowerTranslator:**

```
Ship JSON → ShipPowerTranslator → Effect[] → BattleReducer → Updated State
```

**Critical principle:** JSON must **NOT** control ordering or simultaneity. Those are game laws, not content.

**Example:**

JSON says: "Deal 1 damage"

Translator decides:
- `phase: Resolution` (automatic damage resolves in Resolution phase)
- `timing: Automatic` (happens every turn)
- `survivability: DiesWithSource` (ship must be alive)
- `kind: Damage`
- `magnitude: 1`
- `target: opponent`

The battle reducer applies this Effect according to the rules encoded in `BattleReducer.ts`.

---

## Strong Warning

### ⚠️ New Effect Logic MUST Live Here

If you are:
- Adding a new effect type
- Changing phase resolution order
- Modifying survivability rules
- Implementing charge mechanics
- Extending ship power translation

**You MUST work in `/game/engine/effects/`.**

### ⚠️ Legacy Effects Files Must NOT Be Extended

The following files are **LEGACY** and must **NOT** be extended:

- `/game/effects/EffectAst.ts`
- `/game/effects/interpretEffect.ts`
- `/game/types/EffectTypes.ts`

These belonged to a previous architecture that used:
- `TriggeredEffect` / `EvaluatedEffect` (old resolution model)
- `resolution: 'triggered' | 'evaluated'` (replaced by phase + timing)
- End-of-turn–centric resolution (replaced by explicit battle phases)

**They are retained ONLY for:**
- Historical reference
- Migration support
- Legacy code that hasn't been updated yet

**If you see code importing from these locations:**

Add a comment: `// LEGACY EFFECTS — migrate to /game/engine/effects/ when touching this file.`

Do NOT extend the legacy code. Migrate to the canonical system instead.

---

## File Inventory

| File | Purpose |
|------|---------|
| `Effect.ts` | Canonical Effect type, enums, and discriminated unions |
| `BattleReducer.ts` | Pure reducer that applies Effects to game state |
| `ShipPowerTranslator.ts` | Translates ship JSON powers into Effects |
| `ARCHITECTURE.md` | This document |

**Expected future additions:**
- `ChargeResolver.ts` - Charge power validation and execution
- `EffectValidation.ts` - Effect schema validation utilities
- `EffectLogging.ts` - Debug/audit logging for effect resolution

---

## Design Principles

1. **Immutability** - Effects never mutate. Reducers produce new state.
2. **Determinism** - Same input → same output. No Date.now(), no random in core logic.
3. **Explicitness** - No hidden phases. No auto-triggering. All resolution is visible.
4. **Separation of Concerns** - Effects (data) ≠ Resolution (logic) ≠ Display (UI)
5. **Type Safety** - Exhaustive switches. No `any`. Discriminated unions everywhere.

---

## Testing Strategy

Effects must be testable **without**:
- React components
- Supabase
- Network requests
- UI state

**Test approach:**
1. Construct mock BattleState
2. Generate Effect[] via translator
3. Pass to BattleReducer
4. Assert on output state, health deltas, battle log

**Critical test cases:**
- Simultaneous damage/heal resolution
- Destroy effects before damage totals
- Survivability rules (source destroyed mid-battle)
- Charge power validation
- Phase ordering (FirstStrike before Resolution)
- Victory conditions

---

## Migration Path (For Legacy Code)

If you encounter legacy Effects code:

1. **Identify:** Look for `TriggeredEffect`, `EvaluatedEffect`, `resolution: 'triggered'`
2. **Map:** Determine canonical Phase, Timing, and Survivability
3. **Translate:** Use `ShipPowerTranslator` or create Effects manually
4. **Test:** Ensure battle reducer produces same results
5. **Delete:** Remove legacy code once migration verified

**Do NOT:**
- Mix legacy and canonical types in same function
- Add new cases to legacy enums
- Extend legacy Effect interfaces

---

## Questions?

**"Can I add a new EffectKind?"**

Yes, if it's a fundamental game action (Damage, Heal, Destroy, CreateShip, etc.). Add it to `Effect.ts` and update `BattleReducer.ts` to handle it.

**"Can I add a new BattlePhase?"**

Only if the game rules require it. Phases are game laws, not content. Discuss before adding.

**"Can I make Effects conditional?"**

No. Conditional logic happens **before** Effect creation, not during resolution. The translator or game engine evaluates conditions and produces concrete Effects.

**"Can I make Effects resolve differently based on game state?"**

No. Effects are immutable snapshots. If you need dynamic behavior, create different Effects based on current state **before** resolution.

**"What about 'custom' or 'complex' powers?"**

They must decompose into canonical EffectKinds. If that's impossible, the game design may need adjustment. Complex logic lives in the translator or game engine, not in Effects.

---

**Last updated:** Prompt 3 of Canonical Effects implementation  
**Maintainer:** Game Engine Team  
**Status:** Active - This is the authoritative Effects architecture
