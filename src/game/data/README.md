# /game/data — Ship Data & Content Layer

**Status:** Canonical content layer  
**Authority:** Source of truth for ship rules, costs, and powers

---

## Purpose

`/game/data` contains the **canonical ship content** for Shapeships, organized in three layers:

1. **JSON Layer** — Pure content (costs, text, rules)
2. **Core Layer** — Normalized data structures + helpers
3. **Effects Overlay** — Structured semantics (lives in `/engine/data/effects/`)

This separation ensures clear boundaries between content, data access, and game logic.

---

## Three-Layer Architecture

### 1. JSON Layer (Pure Content)

**File:** `ShipDefinitions.json.ts`

**Purpose:**
- Define ship costs (lines, energy, components)
- Specify power text exactly as players see it
- Declare ship types (basic, upgraded, core, ark)
- List species associations

**Constraints:**
- ✅ **Pure data only** — no logic, no functions
- ✅ **Human-readable** — matches player-facing rules documentation
- ✅ **Stable format** — changes require migration notes
- ❌ **No computed values** — derived properties belong in core layer
- ❌ **No effect logic** — interpretation belongs in `/engine`

**Example:**
```typescript
{
  id: 'DEF',
  name: 'Defender',
  speciesId: 'human',
  type: 'basic',
  basicCost: { lines: 10 },
  powers: [
    {
      powerIndex: 0,
      rawText: 'Automatic: Heal 5',
      phase: 'automatic',
      timing: 'continuous'
    }
  ]
}
```

### 2. Core Layer (Normalized Access)

**File:** `ShipDefinitions.core.ts`

**Purpose:**
- Provide type-safe access to ship data
- Export normalized ship arrays by species
- Offer lookup helpers (`getShipById`, `getShipsBySpecies`)
- Define stable TypeScript types for ship structures

**Constraints:**
- ✅ **Read-only access** — no mutation of JSON data
- ✅ **Memoized lookups** — cache expensive queries
- ✅ **Type safety** — strict TypeScript types
- ❌ **No gameplay logic** — just data access
- ❌ **No effect interpretation** — that belongs in `/engine`

**Example:**
```typescript
export function getShipById(shipId: ShipDefId): CoreShipDefinition | null {
  return SHIP_DEFINITIONS_BY_ID.get(shipId) ?? null;
}

export const HUMAN_SHIPS = SHIP_DEFINITIONS.filter(
  ship => ship.speciesId === 'human'
);
```

### 3. Effects Overlay (Structured Semantics)

**Location:** `/engine/data/effects/` *(future canonical location)*

**Current transitional location:** `/game/engine/effects/ShipPowerTranslator.ts`

**Purpose:**
- Translate raw power text into structured effect AST
- Define effect kinds (`HEAL`, `DAMAGE`, `BUILD_SHIP`, etc.)
- Specify effect targets, amounts, conditionals
- Provide semantic layer for engine interpretation

**Constraints:**
- ✅ **Additive semantics** — enhances JSON, doesn't replace it
- ✅ **Engine-consumable** — structured for effect interpreter
- ✅ **Preserves raw text** — always includes `rawText` for display
- ❌ **Not authoritative** — JSON is still source of truth
- ❌ **No execution logic** — interpretation happens in `/engine`

**Example:**
```typescript
{
  shipDefId: 'DEF',
  powerIndex: 0,
  effectAst: {
    kind: EffectKind.HEAL,
    target: { type: 'self' },
    value: { type: 'constant', amount: 5 },
    timing: 'continuous'
  }
}
```

---

## File Inventory

### JSON & Core
- `ShipDefinitions.json.ts` — Pure ship content (canonical)
- `ShipDefinitions.core.ts` — Normalized access layer
- `ShipDefinitions.engine.ts` — Engine-specific extensions (transitional)
- `ShipDefinitionsUI.tsx` — UI-specific helpers (display logic only)

### Species Data
- `SpeciesData.tsx` — Species-specific rules and metadata

### Adapters
- `ShipRulesAdapter.tsx` — Maps ship data to UI rules display

---

## Architectural Rules

### ✅ DO:
- Keep JSON simple, readable, and stable
- Add new ships by extending the JSON array
- Use core layer for lookups and type safety
- Reference raw text for all UI displays
- Migrate effect semantics to `/engine/data/effects/` over time

### ❌ DON'T:
- Put gameplay logic in JSON files
- Compute derived values at read time without memoization
- Duplicate ship data across multiple sources
- Create ship definitions outside the JSON layer
- Bypass core layer for direct JSON access in game code

---

## Migration Path

**Current state (transitional):**
- JSON layer is canonical ✅
- Core layer provides access ✅
- Effects overlay partially in `/game/engine/effects/` 🔄
- Engine-specific extensions in `ShipDefinitions.engine.ts` 🔄

**Target state:**
- JSON layer remains canonical ✅
- Core layer provides access ✅
- Effects overlay migrates to `/engine/data/effects/` ⏳
- Engine extensions merge into canonical `/engine` ⏳

---

## Related Documentation

- `/engine/README.md` — Canonical engine architecture
- `/game/engine/effects/ARCHITECTURE.md` — Effect system design
- `/documentation/contracts/canonical-handoff.md` — System-wide contracts
- `/game/types/ShipTypes.*.ts` — Ship type definitions

---

## Key Principles

1. **JSON is truth** — All ship content starts in JSON
2. **Core is access** — Type-safe lookups, no logic
3. **Effects are semantics** — Structured overlay for engine
4. **Raw text always preserved** — Never lose human-readable rules
5. **One source, many consumers** — UI, engine, and tools all read from JSON

---

## Questions?

**"Can I add computed fields to JSON?"**  
❌ No. Add them to the core layer as functions.

**"Can I add effect logic to ship definitions?"**  
❌ No. Effect interpretation belongs in `/engine`.

**"Can I modify ship costs at runtime?"**  
❌ No. Ship definitions are immutable content.

**"Where do I add new ship powers?"**  
✅ Add to JSON layer, then extend effects overlay if needed.

**"Can I create species-specific ship helpers?"**  
✅ Yes, in `SpeciesData.tsx` or core layer functions.
