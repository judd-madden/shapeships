# Power Resolution Architecture

**Status:** Active  
**Last Updated:** 2024-12-24  
**Architecture Version:** 3-Layer + Canonical Resolver

## Overview

This document describes the canonical power resolution system for Shapeships. The architecture enforces a clean separation between data layers and provides a graceful degradation model where structured interpretation is optional.

## Core Principle

> **CSV text is authoritative. Structure is optional. The engine must degrade gracefully.**

## Architecture Layers

### Layer 1: CSV (Lossless)

**File:** `/game/types/ShipTypes.csv.ts`

**Purpose:** Source of truth - preserves exact CSV data

**Rules:**
- Raw strings only (`subphase`, `text`)
- No enums, no interpretation
- Maps directly to CSV columns
- Server-safe (no React)

**Type:** `ShipDefinitionCsv`

### Layer 2: Engine Runtime

**File:** `/game/types/ShipTypes.engine.ts`

**Purpose:** Canonical types for game engine

**Rules:**
- Enums allowed (`Species`, `ShipType`, `ShipPowerPhase`, `PowerTiming`)
- `EngineShipPower.kind` is **OPTIONAL**
- Must retain `rawText` and `rawSubphase`
- Server-safe (no React)

**Type:** `EngineShipDefinition`, `EngineShipPower`

### Layer 3: Data Compilation

**File:** `/game/data/ShipDefinitions.engine.ts`

**Purpose:** Transforms CSV → Engine types

**Rules:**
- Deterministic mapping
- Conservative inference (only obvious cases)
- Explicit manual overrides
- Preserves raw text always

## Power Resolution Model

### The 4-Path Resolution Order

When the engine needs to execute a ship power, it follows this strict order:

```
1. If effectAst exists
   → Interpret via AST interpreter
   
2. Else if kind exists
   → Execute via EffectKind handler
   
3. Else if manual handler exists
   → Execute ship-specific logic
   
4. Else
   → NO-OP (log warning in dev only)
```

### Why This Order?

- **AST First:** Most flexible, allows complex conditional logic
- **Kind Second:** Covers ~80% of simple powers (heal, damage, lines)
- **Manual Third:** Ship-specific edge cases
- **NO-OP Last:** Graceful degradation - game still works with CSV text only

## Canonical Components

### PowerResolver

**File:** `/game/engine/PowerResolver.ts`

**Responsibility:** Single entry point for ALL power resolution

**Key Function:**
```typescript
resolveShipPower(
  power: EngineShipPower,
  context: PowerResolutionContext
) → PowerResolutionResult
```

**Output:**
- `effects: TriggeredEffect[]` - Effects to enqueue for end-of-turn
- `stateMutations?: Partial<GameState>` - Immediate non-health changes
- `requiresChoice?: boolean` - Player input needed
- `resolutionPath: 'AST' | 'KIND' | 'MANUAL' | 'NOOP'` - Which path was used

### ManualPowerOverrides

**File:** `/game/engine/ManualPowerOverrides.ts`

**Responsibility:** Ship-specific logic for complex powers

**Rules:**
- Keyed by: `${shipId}_${powerIndex}`
- Used ONLY when AST and kind are undefined
- Must be documented
- Should be minimal (prefer AST or kind)

**Example:**
```typescript
const MANUAL_OVERRIDES = {
  'FRI_1': (power, context) => {
    // Frigate trigger number logic
    if (diceRoll === ship.frigateTargetNumber) {
      return { effects: [damageEffect], ... };
    }
    return { effects: [] };
  }
};
```

## Engine File Responsibilities

### PowerExecutor (Refactored)

**File:** `/game/engine/PowerExecutor.tsx`

**Role:** Orchestrator, not interpreter

**Responsibilities:**
- Calls `PowerResolver` for all powers
- Manages charge spending
- Tracks power usage (once-only)
- Enqueues effects into `TurnData`

**NO LONGER:**
- ❌ Parsing power text
- ❌ Ship-specific branching
- ❌ Effect type switching

### EndOfTurnResolver

**File:** `/game/engine/EndOfTurnResolver.tsx`

**Role:** Apply enqueued effects at end of turn

**Responsibilities:**
- Apply triggered effects
- Apply evaluated effects (continuous powers)
- Resolve health changes
- Check victory conditions

**MUST NOT:**
- ❌ Inspect ship text
- ❌ Interpret ship logic
- ❌ Execute powers directly

### SpecialLogic (Deprecated)

**File:** `/game/engine/SpecialLogic.tsx`

**Status:** Being phased out

**Migration Path:**
- Move simple logic → set `power.kind` in `ShipDefinitions.engine.ts`
- Move complex logic → `ManualPowerOverrides.ts`
- Remove parallel execution paths

### PassiveModifiers

**File:** `/game/engine/PassiveModifiers.tsx`

**Role:** Query ship presence for passive effects

**Operates ONLY on:**
- Ship presence (e.g., "If you have 3 Science Vessels...")
- Ship tags/metadata
- Passive timing flags

**MUST NOT:**
- ❌ Execute powers
- ❌ Interpret raw text
- ❌ Generate effects

## Effect Flow

### Health Effects (Enqueued)

```
Power → PowerResolver → TriggeredEffect → TurnData.triggeredEffects
                                              ↓
                                        EndOfTurnResolver
                                              ↓
                                        Apply to health
```

### Resource Effects (Immediate)

```
Power → PowerResolver → stateMutations → Apply immediately
```

### Why Split?

**Core Invariant:** All damage and healing resolve together at end-of-turn

- Prevents mid-turn death
- Simplifies turn structure
- Allows "simultaneous" effects

## Migration Guide

### Adding Structure to a Ship

**Option 1: Set Effect Kind (Simple Powers)**

In `ShipDefinitions.engine.ts`:

```typescript
MANUAL_POWER_OVERRIDES: {
  'DEF': {
    0: {
      kind: EffectKind.HEAL,
      baseAmount: 1
    }
  }
}
```

**Option 2: Add Manual Override (Complex Powers)**

In `ManualPowerOverrides.ts`:

```typescript
'FRI_1': (power, context) => {
  const { ship, diceRoll } = context;
  if (diceRoll === ship.customState?.frigateTargetNumber) {
    return {
      effects: [createDamageEffect(6)],
      description: 'Frigate trigger hit!'
    };
  }
  return { effects: [] };
}
```

**Option 3: Add AST (Future)**

```typescript
{
  subphase: 'Automatic',
  text: 'Heal 1.',
  effectAst: {
    type: 'effect',
    kind: 'heal',
    value: { type: 'literal', value: 1 }
  }
}
```

### Removing Old Code

**Safe to Delete:**
- Ship-specific logic in `PowerExecutor`
- Text parsing in engine files
- Duplicate effect type enums

**Keep:**
- Documentation in `/history/`
- CSV files
- Type definitions

## Progress Tracking

### Current Status

- ✅ 3-layer architecture complete
- ✅ PowerResolver implemented
- ✅ ManualPowerOverrides system ready
- ⚠️ PowerExecutor needs refactor
- ⚠️ EndOfTurnResolver needs cleanup
- ⚠️ SpecialLogic needs deprecation

### Coverage Statistics

**Ships with structured powers:** TBD  
**Ships using manual overrides:** ~15-20  
**Ships using CSV only:** ~60-65  

**Target:**
- 50%+ with kind or AST
- 20% with manual overrides
- 30% CSV-only acceptable

## FAQs

### Q: What happens if a power has no kind, no AST, and no manual override?

**A:** The power becomes a NO-OP. The game still works, the ship just doesn't execute that power. A warning is logged in dev mode. This is intentional graceful degradation.

### Q: Can I still add new ships with just CSV text?

**A:** Yes! The CSV is the source of truth. You can playtest with text-only, then add structure incrementally.

### Q: Where should I add new ship-specific logic?

**A:** 
1. First try: Set `kind` in `ShipDefinitions.engine.ts` overrides
2. If complex: Add to `ManualPowerOverrides.ts`
3. Never: Scattered across engine files

### Q: Why not parse CSV text in the engine?

**A:** Parsing text is error-prone and creates tight coupling. The compilation layer (`ShipDefinitions.engine.ts`) is the ONLY place that interprets CSV text. Engine code works with structured types only.

### Q: What's the difference between stateMutations and effects?

**A:**
- **Effects:** Health changes (damage, healing) - enqueued for end-of-turn
- **StateMutations:** Non-health changes (lines, energy) - applied immediately

This preserves the core invariant that health only changes at end-of-turn.

## Related Documentation

- `ShipDefinitionLayers.md` - Detailed layer specifications
- `EffectResolution.md` - Effect application order
- `TurnPhaseFlow.md` - Turn structure and phase transitions

---

**Maintained by:** Engine Architecture Team  
**Questions:** See `/guidelines/` or ask in #dev-engine
