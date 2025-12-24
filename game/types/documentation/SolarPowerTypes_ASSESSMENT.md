# SolarPowerTypes.tsx - Mandate Compliance Assessment

**Date:** 2024-12-23  
**File:** `/game/types/SolarPowerTypes.tsx`  
**Status:** ⚠️ Structurally correct, needs critical documentation

---

## 🎯 Assessment Against 7 Mandatory Constraints

### ✅ MANDATE 1: Solar Powers Are NOT Ships - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- ✅ No `health` field
- ✅ No `isDestroyed` field
- ✅ No board position data
- ✅ No ship lifecycle coupling
- Clean separation from ShipInstance/ShipDefinition

**Validation:**
```typescript
export interface SolarPowerDefinition {
  id: string;
  name: string;
  energyCost: { ... };  // NOT line cost
  effect: { ... };
  // ✅ No health, no destruction, no board state
}
```

✅ **COMPLIANT** - Solar powers are structurally independent from ships.

---

### ⚠️ MANDATE 2: Solar Powers Always Produce TriggeredEffects - PARTIAL

**Status:** ⚠️ **NEEDS DOCUMENTATION**

**Current State:**
- Interface structure supports TriggeredEffect creation
- No explicit documentation of this requirement
- No warning against treating as continuous/evaluated effects

**Missing Documentation:**
- No comment stating "Always enqueues TriggeredEffect"
- No comment stating "Resolves during End of Turn Resolution"
- No comment stating "Persists even if caster ships destroyed"

**Recommended Addition:**

```typescript
// Line 6-8: Add critical implementation note
// ============================================================================
// CRITICAL IMPLEMENTATION RULE: Solar Powers ALWAYS Produce TriggeredEffects
// ============================================================================
//
// Solar Powers:
// - Enqueue TriggeredEffects when declared
// - Resolve during End of Turn Resolution
// - Persist even if caster loses all ships
//
// DO NOT:
// - Treat Solar Powers as continuous effects
// - Treat them as evaluated effects
// - Require source ship to survive
//
// Example: Black Hole destroys Zenith → Zenith's destruction trigger still fires
// ============================================================================
```

**Rationale:** Engine implementers must understand this invariant to avoid bugs.

---

### ✅ MANDATE 3: Solar Powers Have No Phase or Timing Fields - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
```typescript
export interface SolarPowerDefinition {
  id: string;
  name: string;
  energyCost: { ... };
  effect: { ... };
  // ✅ No `phase` field
  // ✅ No `timing` field
}
```

**Validation:**
- Timing is enforced externally (declared in Battle Phase, resolved at End of Turn)
- No internal phase logic
- Clean separation from ShipPower timing model

✅ **COMPLIANT** - Solar powers correctly omit phase/timing fields.

---

### ⚠️ MANDATE 4: Valid Solar Effect Types (Constraint) - PARTIAL

**Status:** ⚠️ **NEEDS CONSTRAINT OR DOCUMENTATION**

**Current Issue:**
- Line 24: `type: PowerEffectType` - imports ALL effect types from ShipTypes
- No constraint preventing invalid types like:
  - `PASSIVE` (not allowed for Solar)
  - `CONTINUOUS` (not allowed for Solar)
  - `REROLL_DICE` (not applicable to Solar)

**Valid Solar Effect Types (from mandate):**
- ✅ `DEAL_DAMAGE` (Asteroid)
- ✅ `HEAL` (Life)
- ✅ `BUILD_SHIP` (hypothetical)
- ✅ `DESTROY_SHIP` (Black Hole)
- ✅ `COPY_SHIP` (Simulacrum)
- ✅ `CUSTOM` (complex logic)

**Solution Options:**

**Option A: Create restricted enum (RECOMMENDED)**
```typescript
// Restrict to TriggeredEffect-producing types only
export type SolarPowerEffectType = 
  | PowerEffectType.DEAL_DAMAGE
  | PowerEffectType.HEAL
  | PowerEffectType.BUILD_SHIP
  | PowerEffectType.DESTROY_SHIP
  | PowerEffectType.COPY_SHIP
  | PowerEffectType.CUSTOM;

export interface SolarPowerDefinition {
  effect: {
    type: SolarPowerEffectType;  // ← Constrained
    // ...
  };
}
```

**Option B: Add documentation warning**
```typescript
export interface SolarPowerDefinition {
  effect: {
    // CONSTRAINT: Must use TriggeredEffect types only
    // Valid: DEAL_DAMAGE, HEAL, BUILD_SHIP, DESTROY_SHIP, COPY_SHIP, CUSTOM
    // Invalid: PASSIVE, CONTINUOUS, REROLL_DICE (not applicable to Solar)
    type: PowerEffectType;
    // ...
  };
}
```

**Recommendation:** Use Option A for type safety.

---

### ⚠️ MANDATE 5: Energy Cost Rules - PARTIAL

**Status:** ⚠️ **NEEDS DOCUMENTATION**

**Current State:**
- ✅ `energyCost` exists on `SolarPowerDefinition`
- ✅ Variable cost supported (`ship_line_cost` for Simulacrum)
- ❌ No comment about deduction timing
- ❌ No warning against double-charging

**Recommended Documentation:**

```typescript
export interface SolarPowerDefinition {
  // Energy cost (AUTHORITATIVE - deducted at declaration time)
  // - Variable cost (ship_line_cost) applies only to Simulacrum
  // - Energy is deducted when Solar Power is declared
  // - DO NOT double-charge or infer cost elsewhere
  energyCost: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';  // Simulacrum only
  };
  // ...
}
```

**Rationale:** Prevent double-charging bugs during implementation.

---

### ❌ MANDATE 6: Survival Independence Must Be Preserved - NON-COMPLIANT

**Status:** ❌ **FAIL**

**Critical Missing Documentation:**
- No comment stating effects persist after caster destruction
- No comment about survival independence
- No warning against invalidating declared Solar Powers

**This is CRITICAL for game correctness:**

Example scenario:
1. Ancient player declares Black Hole (destroy target ship)
2. Black Hole destroys Zenith
3. Zenith has "Upon Destruction: Deal 5 damage"
4. Both effects must resolve at End of Turn, even if Ancient player loses all ships before resolution

**Required Documentation:**

```typescript
// ============================================================================
// SURVIVAL INDEPENDENCE (CRITICAL)
// ============================================================================
//
// Once a Solar Power is declared:
// ✅ Effect resolves even if caster loses all ships
// ✅ Must not be invalidated by destruction, surrender, or board state changes
// ✅ Enqueued TriggeredEffect persists to End of Turn Resolution
//
// Example: Black Hole destroys Zenith
// - Black Hole effect: TriggeredEffect (destroy ship)
// - Zenith destruction trigger: TriggeredEffect (deal damage)
// - Both resolve at End of Turn, regardless of Ancient player's ship count
// ============================================================================
```

**Rationale:** Without this documentation, implementers may incorrectly cancel Solar effects.

---

### ⚠️ MANDATE 7: Execution Context Is Authoritative - PARTIAL

**Status:** ⚠️ **NEEDS DOCUMENTATION**

**Current State:**
- ✅ `SolarPowerExecutionContext` exists (line 42-53)
- ✅ Contains all required fields:
  - `solarPower`: Definition
  - `casterId`: Player who cast
  - `targetPlayerId`, `targetShipId`: Targeting
  - `currentDiceRoll`: Dice-based effects
  - `energySpent`: Cost tracking

**Missing Documentation:**
- No comment stating "Use this for validation, targeting, effect creation"
- No warning against reaching into global state

**Recommended Documentation:**

```typescript
// ============================================================================
// SOLAR POWER EXECUTION CONTEXT (AUTHORITATIVE)
// ============================================================================
//
// Use SolarPowerExecutionContext for:
// ✅ Validation (can this Solar be cast?)
// ✅ Targeting (who/what is affected?)
// ✅ Dice-based effects (Asteroid damage)
// ✅ Effect creation (build TriggeredEffect)
//
// DO NOT reach into global state beyond this context.
// All required information is provided in this interface.
// ============================================================================

export interface SolarPowerExecutionContext {
  // ... fields ...
}
```

**Rationale:** Clarifies that context is self-contained.

---

## 📋 Summary: Compliance Report

| Mandate | Status | Action Required |
|---------|--------|-----------------|
| 1. Solar Powers Are NOT Ships | ✅ PASS | None |
| 2. Always Produce TriggeredEffects | ⚠️ PARTIAL | Add critical implementation note |
| 3. No Phase or Timing Fields | ✅ PASS | None |
| 4. Valid Solar Effect Types | ⚠️ PARTIAL | Add type constraint or documentation |
| 5. Energy Cost Rules | ⚠️ PARTIAL | Document deduction timing |
| 6. Survival Independence | ❌ FAIL | Add critical survival docs |
| 7. Execution Context Authoritative | ⚠️ PARTIAL | Document context usage |

**Overall Grade:** 2/7 PASS, 4/7 PARTIAL, 1/7 FAIL

---

## 🔧 Required Fixes for Full Compliance

### Priority 1: CRITICAL (Breaks Game Logic)

**Fix 1: Document Survival Independence (Mandate 6)**
```typescript
// Add at line 6-8 (before SOLAR POWER DEFINITION section):
// ============================================================================
// SURVIVAL INDEPENDENCE (CRITICAL)
// ============================================================================
//
// Once a Solar Power is declared:
// ✅ Effect resolves even if caster loses all ships
// ✅ Must not be invalidated by destruction, surrender, or board state changes
// ✅ Enqueued TriggeredEffect persists to End of Turn Resolution
//
// Example: Black Hole destroys Zenith
// - Black Hole effect: TriggeredEffect (destroy ship)
// - Zenith destruction trigger: TriggeredEffect (deal damage)
// - Both resolve at End of Turn, regardless of Ancient player's ship count
// ============================================================================
```

**Fix 2: Document TriggeredEffect Requirement (Mandate 2)**
```typescript
// Add immediately after Survival Independence docs:
// ============================================================================
// CRITICAL IMPLEMENTATION RULE: Solar Powers ALWAYS Produce TriggeredEffects
// ============================================================================
//
// Solar Powers:
// - Enqueue TriggeredEffects when declared
// - Resolve during End of Turn Resolution
// - Persist even if caster loses all ships
//
// DO NOT:
// - Treat Solar Powers as continuous effects
// - Treat them as evaluated effects
// - Require source ship to survive
// ============================================================================
```

---

### Priority 2: HIGH (Type Safety)

**Fix 3: Constrain Effect Types (Mandate 4)**
```typescript
// Add before SolarPowerDefinition (line 10):
// Restrict to TriggeredEffect-producing types only
export type SolarPowerEffectType = 
  | PowerEffectType.DEAL_DAMAGE
  | PowerEffectType.HEAL
  | PowerEffectType.BUILD_SHIP
  | PowerEffectType.DESTROY_SHIP
  | PowerEffectType.COPY_SHIP
  | PowerEffectType.CUSTOM;

// Then change line 25:
effect: {
  type: SolarPowerEffectType;  // ← Use constrained type
  // ...
};
```

---

### Priority 3: MEDIUM (Documentation Clarity)

**Fix 4: Document Energy Cost Rules (Mandate 5)**
```typescript
// Update energyCost field (line 16):
// Energy cost (AUTHORITATIVE - deducted at declaration time)
// - Variable cost (ship_line_cost) applies only to Simulacrum
// - Energy is deducted when Solar Power is declared
// - DO NOT double-charge or infer cost elsewhere
energyCost: {
  red?: number;
  green?: number;
  blue?: number;
  variable?: 'ship_line_cost';  // Simulacrum only
};
```

**Fix 5: Document Execution Context Authority (Mandate 7)**
```typescript
// Update SolarPowerExecutionContext comment (line 38-40):
// ============================================================================
// SOLAR POWER EXECUTION CONTEXT (AUTHORITATIVE)
// ============================================================================
//
// Use SolarPowerExecutionContext for:
// ✅ Validation (can this Solar be cast?)
// ✅ Targeting (who/what is affected?)
// ✅ Dice-based effects (Asteroid damage)
// ✅ Effect creation (build TriggeredEffect)
//
// DO NOT reach into global state beyond this context.
// All required information is provided in this interface.
// ============================================================================
```

---

## ✅ Validation Checklist

After applying fixes, verify:

- [ ] Survival independence documented (critical for Black Hole + Zenith)
- [ ] TriggeredEffect requirement documented
- [ ] `SolarPowerEffectType` type created with only valid types
- [ ] Energy cost deduction timing documented
- [ ] Execution context authority documented
- [ ] All 7 mandates achieve PASS status

---

## 🎯 Final Recommendation

**Current Status:** Type system is structurally correct but lacks critical documentation.

**Action Items:**
1. Apply Priority 1 fixes (survival independence + TriggeredEffect docs) **IMMEDIATELY**
2. Apply Priority 2 fix (type constraint) before implementing Solar engine
3. Apply Priority 3 fixes (documentation) before engine integration

**Timeline:** 20 minutes to achieve full compliance.

**Risk if not fixed:**
- Missing survival docs will cause incorrect Solar cancellation bugs
- Missing TriggeredEffect docs will lead to immediate resolution bugs
- Missing type constraint allows invalid effect types

**Critical Scenario:**
```typescript
// Black Hole destroys Zenith
// Zenith has "Upon Destruction: Deal 5 damage"
// Without survival independence docs, implementer may cancel Black Hole effect
// → Zenith destruction trigger never fires
// → Game logic broken
```

**This model will be approved after Priority 1 and Priority 2 are addressed.**

---

## 📖 Reference

- Handover Prompt: 7 mandatory constraints for Solar Powers
- Related Type: `/game/types/ShipTypes.tsx` (TriggeredEffect vs EvaluatedEffect)
- Engine Integration: End of Turn Resolution system
