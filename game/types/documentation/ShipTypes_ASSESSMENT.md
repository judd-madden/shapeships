# ShipTypes.tsx - Mandate Compliance Assessment

**Date:** 2024-12-23  
**File:** `/game/types/ShipTypes.tsx`  
**Status:** ⚠️ Requires refinements to achieve full compliance

---

## 🎯 Assessment Against 8 Mandatory Constraints

### ✅ MANDATE 1: Phase vs Timing Are Orthogonal - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- Line 26-51: `ShipPowerPhase` enum correctly defines **when** engine looks
- Line 54-59: `PowerTiming` enum correctly defines **how** power behaves
- Line 40: `AUTOMATIC` phase = "Continuous effects resolved at End of Turn" (clear comment)
- Line 56: `ONCE_ONLY_AUTOMATIC` timing = "On completion (persists if destroyed)" (clear comment)

**Validation:**
```typescript
// These are correctly separate concepts:
ShipPowerPhase.AUTOMATIC      // WHERE: End of Turn Resolution
PowerTiming.CONTINUOUS         // HOW: Every turn, requires ship alive
PowerTiming.ONCE_ONLY_AUTOMATIC // HOW: Once and persists
```

✅ No conflation detected. These are orthogonal dimensions.

---

### ✅ MANDATE 2: EVENT / UPON_DESTRUCTION Are Event Hooks - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- Line 45-48: Explicit warning comment about EVENT powers
- Line 48: `EVENT = 'event'` with clear documentation
- Line 57: `UPON_DESTRUCTION = 'upon_destruction'` timing exists
- Lines 45-47: "⚠️ EVENT powers are hooks triggered by state changes... They are NOT iterated as part of phase execution"

**Validation:**
```typescript
// Correct usage for Zenith:
phase: ShipPowerPhase.EVENT,           // Not iterable
timing: PowerTiming.UPON_DESTRUCTION,  // Event hook
triggerEvent: 'on_ship_destroyed'      // Line 145 - explicit event
```

✅ Clear separation established. Event hooks properly distinguished from phases.

---

### ⚠️ MANDATE 3: Passive Powers Never Execute - PARTIAL COMPLIANCE

**Status:** ⚠️ **NEEDS REFINEMENT**

**Issues Found:**

1. **Line 50: Redundant `PASSIVE` in phase enum**
   ```typescript
   PASSIVE = 'passive'  // Rule modifier, not an effect generator
   ```
   - ❌ This should not be in `ShipPowerPhase`
   - ✅ Only `PowerTiming.PASSIVE` should exist

2. **Line 128: Redundant `powerType` field**
   ```typescript
   powerType?: 'Active' | 'Passive';
   ```
   - ❌ This duplicates `PowerTiming.PASSIVE`
   - ❌ Creates confusion: what if `powerType === 'Passive'` but `timing !== PowerTiming.PASSIVE`?

**Recommended Fixes:**

```typescript
// REMOVE from ShipPowerPhase enum (line 50):
// PASSIVE = 'passive'  // ❌ DELETE THIS

// REMOVE from ShipPower interface (line 128):
// powerType?: 'Active' | 'Passive';  // ❌ DELETE THIS

// CANONICAL SIGNAL: Only use PowerTiming.PASSIVE
if (power.timing === PowerTiming.PASSIVE) {
  // This is a rule modifier, never execute
}
```

**Rationale:** Single source of truth prevents conflicting signals.

---

### ✅ MANDATE 4: Triggered vs Evaluated Effects Must Stay Separate - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- Line 55: `CONTINUOUS` = "Every turn (requires ship alive at End of Turn)"
- Line 56: `ONCE_ONLY_AUTOMATIC` = "On completion (persists if destroyed)"
- Interface structure supports both patterns without mixing

**Validation:**
```typescript
// TriggeredEffect pattern (persists):
timing: PowerTiming.ONCE_ONLY_AUTOMATIC
// → Creates TriggeredEffect during Build/Battle
// → Resolves at End of Turn even if ship destroyed

// EvaluatedEffect pattern (requires alive):
timing: PowerTiming.CONTINUOUS
// → Computed fresh at End of Turn
// → Only if !isDestroyed && !isConsumedInUpgrade
```

✅ No mixing detected. Clear separation maintained.

---

### ⚠️ MANDATE 5: Legacy Effect Types Are Non-Resolving - PARTIAL COMPLIANCE

**Status:** ⚠️ **NEEDS DOCUMENTATION**

**Legacy types identified:**
- Line 86: `COUNT_AND_DAMAGE`
- Line 87: `COUNT_AND_HEAL`
- Line 88: `DICE_BASED`
- Line 89: `CONDITIONAL`

**Issue:** No explicit warning that these must not be resolved directly.

**Recommended Addition:**

```typescript
// Line 84-92: Add explicit warnings
// Legacy (for backward compatibility) - PARSING/EVALUATION HELPERS ONLY
// ⚠️ DO NOT RESOLVE DIRECTLY - These must expand to concrete effect types
USE_CHARGE = 'use_charge',           // → Expands to DAMAGE/HEAL/etc
COUNT_AND_DAMAGE = 'count_and_damage', // → Expands to DEAL_DAMAGE
COUNT_AND_HEAL = 'count_and_heal',     // → Expands to HEAL
DICE_BASED = 'dice_based',             // → Expands to concrete effect
CONDITIONAL = 'conditional',           // → Expands to concrete effect
```

**Rationale:** Prevent engine implementers from accidentally resolving `CONDITIONAL` directly.

---

### ❌ MANDATE 6: Ship Destruction Must Be Explicit State - NON-COMPLIANT

**Status:** ❌ **FAIL**

**Missing Fields in ShipInstance (line 275-302):**

```typescript
export interface ShipInstance {
  // ... existing fields ...
  
  // ❌ MISSING: isDestroyed field
  // ❌ MISSING: destroyedOnTurn field
  
  isDepleted: boolean;  // ✅ Has this
  // ... rest of interface
}
```

**Required Fix:**

```typescript
export interface ShipInstance {
  // Reference to definition
  definitionId: string;
  instanceId: string;
  ownerId: string;
  
  // State tracking
  chargesRemaining?: number;
  isDepleted: boolean;
  
  // ✅ ADD THESE:
  isDestroyed: boolean;        // Ship has been destroyed
  destroyedOnTurn?: number;    // Turn ship was destroyed (for event hooks)
  isConsumedInUpgrade?: boolean; // Ship consumed in upgrade (alternative to destroyed)
  
  // Turn tracking
  createdOnTurn: number;
  usedThisTurn: boolean;
  
  // ... rest of interface
}
```

**Rationale:** EVENT hooks, passive filtering, and resolution ordering depend on explicit destruction state.

---

### ⚠️ MANDATE 7: Energy Cost Precedence Rule - PARTIAL COMPLIANCE

**Status:** ⚠️ **NEEDS DOCUMENTATION**

**Multiple energy cost locations exist:**
- Line 249-254: `ShipDefinition.energyCost`
- Line 154-159: `SpecialLogic.energyCost`

**Issue:** No explicit precedence rule documented.

**Recommended Documentation:**

```typescript
// Line 249-254: Add comment
// Energy cost for this ship/power
// If SpecialLogic.energyCost also exists, that takes precedence (conditional override)
// DO NOT double-charge - check SpecialLogic first, fall back to this
energyCost?: {
  red?: number;
  green?: number;
  blue?: number;
  variable?: 'ship_line_cost';
};

// Line 154-159: Add comment
// Energy cost override (takes precedence over ShipDefinition.energyCost)
// Use this for conditional/variable costs (e.g., Simulacrum: X blue = ship's line cost)
energyCost?: {
  red?: number;
  green?: number;
  blue?: number;
  variable?: 'ship_line_cost';
};
```

**Rationale:** Prevent double-charging bugs during implementation.

---

### ✅ MANDATE 8: Manual Overrides Are Expected (70/30 Rule) - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- Line 192: `customLogicId?: string` field exists
- Interface structure supports both automated parsing and manual overrides
- Special logic fields (countType, conditionType, scalingByQuantity, etc.) enable rich automated parsing

**Validation:**
```typescript
// Simple ships: Parse automatically
effectType: PowerEffectType.DEAL_DAMAGE
baseAmount: 2

// Complex ships: Use customLogicId
customLogicId: 'frigate_trigger'
customLogicId: 'science_vessel_scaling'
customLogicId: 'chronoswarm_extra_build_phase'
```

✅ Architecture explicitly supports 70/30 split. Not treated as workaround.

---

## 📋 Summary: Compliance Report

| Mandate | Status | Action Required |
|---------|--------|-----------------|
| 1. Phase vs Timing Orthogonal | ✅ PASS | None |
| 2. EVENT/UPON_DESTRUCTION Hooks | ✅ PASS | None |
| 3. Passive Powers Never Execute | ⚠️ PARTIAL | Remove redundant fields |
| 4. Triggered vs Evaluated Separation | ✅ PASS | None |
| 5. Legacy Types Non-Resolving | ⚠️ PARTIAL | Add documentation |
| 6. Explicit Destruction State | ❌ FAIL | Add required fields |
| 7. Energy Cost Precedence | ⚠️ PARTIAL | Add documentation |
| 8. Manual Overrides Expected | ✅ PASS | None |

**Overall Grade:** 5/8 PASS, 3/8 PARTIAL, 1/8 FAIL

---

## 🔧 Required Fixes for Full Compliance

### Priority 1: CRITICAL (Breaks Engine)

**Fix 1: Add Destruction State to ShipInstance**
```typescript
// In ShipInstance interface (line 275):
export interface ShipInstance {
  // ... existing fields ...
  
  // ADD THESE:
  isDestroyed: boolean;
  destroyedOnTurn?: number;
  isConsumedInUpgrade?: boolean;
  
  // ... rest of interface
}
```

---

### Priority 2: HIGH (Prevents Confusion)

**Fix 2: Remove Redundant Passive Signals**
```typescript
// DELETE line 50:
// PASSIVE = 'passive'  // ❌ REMOVE from ShipPowerPhase

// DELETE line 128:
// powerType?: 'Active' | 'Passive';  // ❌ REMOVE from ShipPower

// CANONICAL: Only use PowerTiming.PASSIVE
```

---

### Priority 3: MEDIUM (Documentation Improvements)

**Fix 3: Document Legacy Effect Types**
```typescript
// Line 84-92: Add warnings
// ⚠️ PARSING/EVALUATION HELPERS ONLY - DO NOT RESOLVE DIRECTLY
USE_CHARGE = 'use_charge',           // → Expands to concrete effect
COUNT_AND_DAMAGE = 'count_and_damage', // → Expands to DEAL_DAMAGE
COUNT_AND_HEAL = 'count_and_heal',     // → Expands to HEAL
DICE_BASED = 'dice_based',             // → Expands to concrete effect
CONDITIONAL = 'conditional',           // → Expands to concrete effect
```

**Fix 4: Document Energy Cost Precedence**
```typescript
// ShipDefinition.energyCost (line 249):
// Base energy cost (SpecialLogic.energyCost takes precedence if exists)

// SpecialLogic.energyCost (line 154):
// Conditional override (takes precedence over ShipDefinition.energyCost)
```

---

## ✅ Validation Checklist

After applying fixes, verify:

- [ ] `ShipInstance` has `isDestroyed` field
- [ ] `ShipInstance` has `destroyedOnTurn` field
- [ ] `ShipInstance` has `isConsumedInUpgrade` field
- [ ] `ShipPowerPhase.PASSIVE` removed
- [ ] `ShipPower.powerType` removed
- [ ] Only `PowerTiming.PASSIVE` used for passive detection
- [ ] Legacy effect types have "DO NOT RESOLVE" warnings
- [ ] Energy cost precedence documented
- [ ] All 8 mandates achieve PASS status

---

## 🎯 Final Recommendation

**Current Status:** Type system is conceptually correct but needs refinements.

**Action Items:**
1. Apply Priority 1 fix (destruction state) immediately
2. Apply Priority 2 fix (remove redundant passive) immediately
3. Apply Priority 3 fixes (documentation) before engine integration

**Timeline:** 30 minutes to achieve full compliance.

**Risk if not fixed:** 
- Missing destruction state will break EVENT hooks
- Redundant passive signals will cause implementation confusion
- Legacy types may be resolved directly by mistake

**This model will be approved after these 3 priorities are addressed.**
