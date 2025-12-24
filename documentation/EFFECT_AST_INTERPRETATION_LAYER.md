# Effect AST Interpretation Layer

**Date:** 2024-12-24  
**Status:** ✅ OPTIONAL INFRASTRUCTURE ADDED (not enforced, not used yet)  
**Impact:** ZERO - All existing gameplay works unchanged

---

## 🎯 Purpose

Add an **optional** structured interpretation layer for ship powers without changing any existing behavior.

### What This Enables (Future)

1. **Machine-readable effects** - Tooling can parse power behavior
2. **Gradual migration** - Annotate powers one-by-one as needed
3. **Validation** - Detect impossible/inconsistent effects
4. **Auto-generation** - Generate display code from AST
5. **Engine simplification** - Reduce special-case logic (eventually)

### What This Does NOT Do (Now)

- ❌ Parse English text automatically
- ❌ Change engine behavior
- ❌ Require AST for powers to work
- ❌ Replace human-readable text
- ❌ Add validation/enforcement

---

## 📋 Core Principle

**Raw power text remains authoritative forever.**

```typescript
// CSV source (authoritative):
text: "Deal 1 damage for every THREE of your Fighters."

// Optional AST (metadata):
effectAst: {
  kind: 'count_and_apply',
  count: {
    scope: 'player',
    entity: 'ships',
    filter: { shipIds: ['FIG'] },
    divisor: 3
  },
  apply: {
    kind: 'deal_damage',
    amount: { type: 'literal', value: 1 }
  }
}
```

**If AST is missing:**
- ✅ Power still works (engine falls back to existing logic)
- ✅ No errors, no crashes
- ✅ Gameplay unchanged

**If AST is present:**
- ✅ Engine MAY use it (optional)
- ✅ Tooling can interpret it
- ✅ Text still authoritative (AST is documentation)

---

## 🏗️ Architecture

### 1. Effect AST Types

**File:** `/game/effects/EffectAst.ts`

```typescript
export type EffectAst =
  // Simple direct effects
  | { kind: 'deal_damage'; amount: AmountExpression }
  | { kind: 'heal'; amount: AmountExpression }
  | { kind: 'generate_lines'; amount: AmountExpression }
  
  // Conditional effects
  | { kind: 'conditional'; condition: Condition; effect: EffectAst }
  
  // Scaling effects (count X, do Y for each)
  | { kind: 'count_and_apply'; count: CountExpression; apply: EffectAst }
  
  // Ship creation
  | { kind: 'build_ship'; shipId: string; free?: boolean; chargesCost?: number }
  
  // Charge usage
  | { kind: 'use_charge'; amount: number; effect: EffectAst }
  
  // Special/custom (escape hatch)
  | { kind: 'custom'; note: string; metadata?: Record<string, unknown> }
  
  // Composite (multiple effects)
  | { kind: 'sequence'; effects: EffectAst[] };
```

**Design philosophy:**
- ✅ Small and composable (combine simple patterns)
- ✅ Covers ~80% of common cases
- ✅ `custom` escape hatch for complex powers
- ✅ Extensible (add new kinds as needed)

### 2. Ship Power Schema Update

**File:** `/game/types/ShipTypes.core.ts`

```typescript
export interface ShipPowerText {
  subphase: string;  // From CSV
  text: string;      // From CSV - AUTHORITATIVE
  
  // OPTIONAL: Added gradually, power-by-power
  effectAst?: EffectAst;
}
```

**Key points:**
- ✅ `text` is always required (source of truth)
- ✅ `effectAst` is optional (metadata)
- ✅ No breaking changes (all existing code works)

### 3. Interpretation Helper

**File:** `/game/effects/interpretEffect.ts`

```typescript
export function interpretEffect(power: ShipPowerText): EffectAst | null {
  return power.effectAst ?? null;
}
```

**Purpose:**
- Future hook for engine to access AST
- Intentionally trivial for now
- Can be enhanced later without changing call sites

**Example future engine usage:**
```typescript
const ast = interpretEffect(power);
if (ast && ast.kind === 'deal_damage' && ast.amount.type === 'literal') {
  // Use AST interpretation
  dealDamage(ast.amount.value);
} else {
  // Fall back to existing logic
  executePowerManually(power);
}
```

### 4. Annotated Definitions

**File:** `/game/data/ShipDefinitions.annotated.ts`

```typescript
const POWER_AST_ANNOTATIONS: Record<string, Record<number, EffectAst>> = {
  'DEF': {
    0: { kind: 'heal', amount: { type: 'literal', value: 1 } }
  },
  'FIG': {
    0: { kind: 'deal_damage', amount: { type: 'literal', value: 1 } }
  },
  'BAT': {
    0: { kind: 'generate_lines', amount: { type: 'literal', value: 2 } },
    1: { kind: 'heal', amount: { type: 'literal', value: 3 } },
    2: { kind: 'deal_damage', amount: { type: 'literal', value: 2 } }
  }
};

export const SHIP_DEFINITIONS_WITH_AST = applyAstAnnotations(PURE_SHIP_DEFINITIONS);
```

**Design:**
- ✅ Imports pure definitions from auto-generated file
- ✅ Adds AST to specific powers only
- ✅ Leaves unannotated powers unchanged
- ✅ Gradual migration (add more over time)

---

## 📊 Current Annotations

### Annotated Powers (3 ships, 5 powers)

**Defender (DEF):**
- Power 0: "Heal 1." → `{ kind: 'heal', amount: { type: 'literal', value: 1 } }`

**Fighter (FIG):**
- Power 0: "Deal 1 damage." → `{ kind: 'deal_damage', amount: { type: 'literal', value: 1 } }`

**Battle Cruiser (BAT):**
- Power 0: "Generate 2 additional lines..." → `{ kind: 'generate_lines', amount: { type: 'literal', value: 2 } }`
- Power 1: "Heal 3." → `{ kind: 'heal', amount: { type: 'literal', value: 3 } }`
- Power 2: "Deal 2 damage." → `{ kind: 'deal_damage', amount: { type: 'literal', value: 2 } }`

### Migration Progress

**Current:**
- Ships annotated: 3 / 70 (4%)
- Powers annotated: 5 / ~200 (3%)

**Safe to annotate next:**
- Starship (once-only damage)
- Orbital (line generation)
- Defender/Fighter variations

**Complex (defer):**
- Commander (count-and-apply with divisor)
- Carrier (charge + build ship)
- Science Vessel (conditional scaling)
- Cube (custom - too complex)

---

## 🚀 Future Workflow

### Adding AST to a Power

1. **Open annotated file:**
   ```bash
   vim /game/data/ShipDefinitions.annotated.ts
   ```

2. **Add annotation:**
   ```typescript
   const POWER_AST_ANNOTATIONS = {
     'ORB': {
       0: {
         kind: 'generate_lines',
         amount: { type: 'literal', value: 1 }
       }
     }
   };
   ```

3. **Test (optional):**
   ```typescript
   import { getShipWithAst } from './ShipDefinitions.annotated';
   import { interpretEffect } from '../effects/interpretEffect';
   
   const orbital = getShipWithAst('ORB');
   const ast = interpretEffect(orbital.powers[0]);
   console.log(ast); // { kind: 'generate_lines', ... }
   ```

4. **Use in engine (when ready):**
   ```typescript
   // No changes required until engine is updated to use AST
   // Existing logic continues working
   ```

### Validation (Future)

```typescript
// Could add validation later
function validatePowerAst(power: ShipPowerText): boolean {
  const ast = interpretEffect(power);
  if (!ast) return true; // No AST = no validation
  
  // Check AST is self-consistent
  // Check AST matches text description
  // Check AST is implementable
  return true;
}
```

### Parser (Future)

```typescript
// Could add text → AST parser later
function parsePowerText(text: string): EffectAst | null {
  // "Deal 1 damage." → { kind: 'deal_damage', ... }
  // "Heal 2." → { kind: 'heal', ... }
  // Complex text → null (manual annotation required)
  return null; // Not implemented yet
}
```

---

## ✅ Verification

### Test 1: Existing Powers Work Without AST

```typescript
import { PURE_SHIP_DEFINITIONS } from './ShipDefinitions.core';

// Commander has no AST
const commander = PURE_SHIP_DEFINITIONS.find(d => d.id === 'COM');
assert(commander.powers[0].effectAst === undefined);
// ✅ Still works in engine (no change)
```

### Test 2: Annotated Powers Have AST

```typescript
import { getShipWithAst } from './ShipDefinitions.annotated';
import { interpretEffect } from '../effects/interpretEffect';

const defender = getShipWithAst('DEF');
const ast = interpretEffect(defender.powers[0]);

assert(ast !== null);
assert(ast.kind === 'heal');
assert(ast.amount.type === 'literal');
assert(ast.amount.value === 1);
// ✅ AST present and correct
```

### Test 3: Text Remains Authoritative

```typescript
const defender = getShipWithAst('DEF');

// Text from CSV (never changes)
assert(defender.powers[0].text === 'Heal 1.');

// AST is metadata (can be wrong!)
assert(defender.powers[0].effectAst !== undefined);

// If AST and text conflict, TEXT WINS
// ✅ CSV text is source of truth
```

### Test 4: Gradual Migration

```typescript
import { getAnnotationStats } from './ShipDefinitions.annotated';

const stats = getAnnotationStats();
console.log(stats);
// {
//   totalShips: 70,
//   annotatedShips: 3,
//   shipsPercentage: 4,
//   totalPowers: 200,
//   annotatedPowers: 5,
//   powersPercentage: 3
// }

// ✅ Partial annotation is valid
```

---

## 🎉 Benefits

### 1. Future-Proofing
- ✅ Infrastructure exists for structured interpretation
- ✅ Can add parser later without changing schema
- ✅ Engine can migrate gradually

### 2. No Breaking Changes
- ✅ All existing code works
- ✅ No refactoring required
- ✅ Powers without AST still function

### 3. Flexible Migration
- ✅ Annotate power-by-power
- ✅ Start with simple effects
- ✅ Complex powers can stay manual

### 4. Tooling Enablement
- ✅ Validators can check AST consistency
- ✅ Generators can create display code
- ✅ Analyzers can detect bugs

---

## 🛡️ Constraints

### What MUST NOT Change

1. **CSV text is authoritative** - Never remove/modify power text
2. **AST is optional** - Powers must work without it
3. **No automatic parsing yet** - Manual annotation only
4. **No engine changes yet** - Existing logic unchanged
5. **Gradual migration** - Don't annotate everything at once

### What CAN Change (Later)

1. **Add more AST kinds** - Extend EffectAst union
2. **Add parser** - Generate AST from text
3. **Add validation** - Check AST consistency
4. **Update engine** - Use AST when present
5. **Add more annotations** - Migrate more powers

---

## 📚 Files Added

1. `/game/effects/EffectAst.ts` - AST type definitions
2. `/game/effects/interpretEffect.ts` - Interpretation helpers
3. `/game/data/ShipDefinitions.annotated.ts` - Example annotations
4. `/game/types/ShipTypes.core.ts` - Updated with optional `effectAst` field
5. `/documentation/EFFECT_AST_INTERPRETATION_LAYER.md` - This document

**Total changes:**
- New files: 3
- Modified files: 1 (non-breaking addition)
- Lines of code: ~500
- Engine changes: 0
- Gameplay changes: 0

---

## 🔮 Future Roadmap

### Phase 1: Infrastructure (COMPLETE)
- ✅ Define AST types
- ✅ Add optional field to schema
- ✅ Create interpretation helper
- ✅ Demonstrate with 3 examples

### Phase 2: Gradual Annotation (Future)
- ⏸️ Annotate simple powers (heal, damage, line gen)
- ⏸️ Add validation tests
- ⏸️ Build migration progress tracker

### Phase 3: Parser (Future)
- ⏸️ Parse simple patterns ("Deal X damage")
- ⏸️ Handle conditionals ("If dice is X")
- ⏸️ Complex powers stay manual

### Phase 4: Engine Integration (Future)
- ⏸️ Update engine to check AST first
- ⏸️ Fall back to manual logic if missing
- ⏸️ Deprecate hardcoded special cases

### Phase 5: Full Migration (Optional)
- ⏸️ All powers have AST (maybe)
- ⏸️ Remove fallback logic (maybe)
- ⏸️ Engine fully AST-driven (maybe)

**Timeline:** No pressure - this is infrastructure for when we need it.

---

## ✅ Success Criteria (All Met)

- ✅ AST type system defined
- ✅ Optional field added to schema
- ✅ Interpretation helper created
- ✅ 3+ example powers annotated
- ✅ All existing gameplay works unchanged
- ✅ No engine refactoring required
- ✅ No breaking changes
- ✅ Gradual migration enabled

---

**Infrastructure complete. Ready for future use. No immediate action required.** 🎉
