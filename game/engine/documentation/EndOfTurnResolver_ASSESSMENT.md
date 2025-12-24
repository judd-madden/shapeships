# EndOfTurnResolver.tsx - Contract Compliance Assessment

**Date:** 2024-12-23  
**File:** `/game/engine/EndOfTurnResolver.tsx`  
**Status:** ⚠️ Directionally correct but requires critical fixes

---

## 🎯 Assessment Against Contract Requirements

### ✅ CORE INVARIANTS - MOSTLY COMPLIANT

**Status:** ✅ 5/5 invariants correctly implemented

1. ✅ Health only changes during End of Turn Resolution (line 232-239)
2. ✅ All effects resolve simultaneously (line 190-226 - tally before apply)
3. ✅ Once-only effects resolve even if source destroyed (line 75-76)
4. ✅ Continuous effects require ship survival (line 145-146)
5. ✅ Win/loss checked ONLY after resolution (line 124)

**Verdict:** Core architecture is sound.

---

### ❌ CRITICAL FIX 1: Ship Identity Must Use Instance IDs - NON-COMPLIANT

**Status:** ❌ **FAIL - CRITICAL BUG**

**Issues Found:**

1. **Line 69: `sourceShipId` is ambiguous**
   ```typescript
   interface TriggeredEffect {
     sourceShipId: string;  // ❌ Is this instance ID or definition ID?
   }
   ```
   - Contract requires: `sourceShipInstanceId` for instance, `sourceShipId` for definition

2. **Line 85-86: findShip() uses wrong ID**
   ```typescript
   const sourceShip = this.findShip(gameState, effect.sourceShipId);
   ```
   - `effect.sourceShipId` may be definition ID (e.g., "DEF")
   - Should be: `effect.sourceShipInstanceId`

3. **Line 149: Reading ship.shipId instead of ship.definitionId**
   ```typescript
   const shipData = getShipById(ship.shipId);  // ❌ Wrong field
   ```
   - GameTypes.tsx line 203: Field is called `shipId` (definition reference)
   - This is confusing - should be `ship.definitionId` or clarify naming

4. **Line 166: Effect uses definition ID instead of instance ID**
   ```typescript
   evaluatedEffects.push({
     sourceShipId: ship.shipId,  // ❌ This is definition ID
   ```

**Required Fix:**
```typescript
// ✅ CORRECT naming
interface QueuedEffect {
  sourceShipInstanceId?: string;  // PlayerShip.id (instance)
  sourceShipId?: string;          // ShipDefinition.id (for display only)
}

// ✅ CORRECT usage
const sourceShip = this.findShip(gameState, effect.sourceShipInstanceId);
```

---

### ❌ CRITICAL FIX 2: Continuous Effects Must Use Structured Power Data - NON-COMPLIANT

**Status:** ❌ **FAIL - TEXT PARSING PRESENT**

**Issues Found:**

1. **Line 159: parsePowerEffect() text parsing**
   ```typescript
   const effect = this.parsePowerEffect(power.description);
   ```
   - ❌ Parses text strings to extract effect
   - Contract explicitly forbids this

2. **Line 322-347: parsePowerEffect() implementation**
   ```typescript
   private parsePowerEffect(description: string): {
     effectType: 'DAMAGE' | 'HEAL';
     value: number;
   } {
     const damageMatch = description.match(/(\d+)\s*damage/i);
     // ...
   }
   ```
   - ❌ Regex parsing of description strings
   - Brittle, error-prone, forbidden by contract

3. **Line 154: Wrong timing check**
   ```typescript
   p.timing === 'Continuous'  // ❌ Wrong - should use PowerTiming enum
   ```
   - Should be: `p.timing === PowerTiming.CONTINUOUS`

**Required Fix:**
```typescript
// ✅ CORRECT: Use structured power data
for (const power of shipDef.powers) {
  // Check phase and timing
  if (power.phase === ShipPowerPhase.AUTOMATIC && 
      power.timing === PowerTiming.CONTINUOUS) {
    
    // Read from structured fields
    const effectType = power.effectType;
    const value = power.baseAmount || 0;
    
    // For complex logic, delegate to SpecialLogic
    if (power.specialLogic) {
      // Use SpecialLogic evaluator
    }
  }
}
```

---

### ❌ CRITICAL FIX 3: Use a Single Unified Effect Queue - PARTIAL

**Status:** ⚠️ **PARTIAL - Structure exists but incomplete**

**What's Correct:**
- Line 70: Uses unified array `allEffects: Array<TriggeredEffect | EvaluatedEffect>`
- Both effect types processed together

**Issues Found:**

1. **No unified QueuedEffect type**
   - Contract specifies single interface with all possible fields
   - Current: Two separate interfaces (TriggeredEffect, EvaluatedEffect)

2. **Missing effect types in TriggeredEffect**
   - Contract lists: DAMAGE, HEAL, SET_HEALTH_MAX, INCREASE_MAX_HEALTH, GAIN_LINES, GAIN_JOINING_LINES, GAIN_ENERGY
   - Current: Only DAMAGE, HEAL supported

3. **TurnData storage not verified**
   - Contract: "TurnData.triggeredEffects stores only QueuedEffect[]"
   - Need to verify this integration

**Required Fix:**
```typescript
// Create unified effect type (aligns with contract spec)
export interface QueuedEffect {
  id: string;
  type: 'DAMAGE' | 'HEAL' | 'SET_HEALTH_MAX' | 'INCREASE_MAX_HEALTH'
        | 'GAIN_LINES' | 'GAIN_JOINING_LINES' | 'GAIN_ENERGY';

  sourcePlayerId: string;
  sourceShipInstanceId?: string;  // Instance ID
  sourceShipId?: string;          // Definition ID (display only)

  targetPlayerId: string;
  value?: number;
  energyColor?: 'red' | 'green' | 'blue' | 'all';

  persistsIfSourceDestroyed: boolean;
  description: string;
  createdAt: string;
}
```

---

### ✅ CRITICAL FIX 4: Continuous Effects Are Evaluated, Not Queued - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- Line 104-106: Continuous effects evaluated at End of Turn
- Line 137: `evaluateContinuousEffects()` generates effects dynamically
- Line 145-146: Destroyed ships filtered out before evaluation
- Not enqueued during Build/Battle phases

**Verdict:** This is correctly implemented.

---

### ❌ CRITICAL FIX 5: Max Health Logic Must Be Correct - NON-COMPLIANT

**Status:** ❌ **FAIL - INCORRECT FIELD ACCESS**

**Issues Found:**

1. **Line 248: Wrong field path**
   ```typescript
   const maxHealth = gameState.gameData?.rules?.maxHealth ?? 35;
   ```
   - ❌ `gameState.gameData.rules.maxHealth` does not exist
   - Contract: "Do NOT read gameState.gameData.rules.maxHealth"

2. **Missing player-specific max health**
   - Contract: "player.maxHealth ?? gameState.settings.maxHealth ?? DEFAULT_MAX"
   - Current: Only uses global config

3. **Missing passive modifier check**
   - Contract: "Also account for passive modifiers (e.g. Spiral increasing max health)"
   - No integration with PassiveModifiers system

4. **Missing max health effect types**
   - Contract lists: SET_HEALTH_MAX, INCREASE_MAX_HEALTH
   - Not implemented in tallyHealthChanges()

**Required Fix:**
```typescript
private finalizeHealth(gameState: GameState, passiveModifiers: PassiveModifiers): void {
  const DEFAULT_MAX_HEALTH = 30;
  
  for (const player of gameState.players) {
    if (player.role !== 'player') continue;
    
    // ✅ CORRECT: Check player → settings → default
    const baseMax = player.maxHealth 
      ?? gameState.settings?.maxHealth 
      ?? DEFAULT_MAX_HEALTH;
    
    // ✅ CORRECT: Account for passive modifiers (Spiral)
    const passiveIncrease = passiveModifiers.getMaxHealthIncrease(player.id);
    
    const maxHealth = baseMax + passiveIncrease;
    
    // Cap health
    if (player.health > maxHealth) {
      player.health = maxHealth;
    } else if (player.health <= 0) {
      player.health = 0;
      player.isActive = false;
    }
  }
}
```

---

### ⚠️ CRITICAL FIX 6: Resolver Must Be Immutable - PARTIAL

**Status:** ⚠️ **INCONSISTENT - Mutates gameState directly**

**Current Approach:**
- Line 232-239: Mutates `player.health` directly
- Line 261: Mutates `player.isActive` directly
- No new GameState returned (void methods)

**Contract Options:**
1. Preferred: Return new GameState
2. Acceptable: Mutate consistently if entire engine does

**Current State:**
- Resolver mutates
- Need to check if rest of engine is consistent

**Recommendation:**
- Document current approach in engine architecture
- Ensure all engine components follow same pattern
- If switching to immutable, refactor entire engine together

---

## 📋 Summary: Compliance Report

| Fix | Status | Severity | Action Required |
|-----|--------|----------|-----------------|
| 1. Ship Instance IDs | ❌ FAIL | CRITICAL | Fix ID naming and usage |
| 2. No Text Parsing | ❌ FAIL | CRITICAL | Use structured power data |
| 3. Unified Effect Queue | ⚠️ PARTIAL | HIGH | Create QueuedEffect type |
| 4. Continuous Evaluated | ✅ PASS | N/A | None |
| 5. Max Health Logic | ❌ FAIL | CRITICAL | Fix field access + modifiers |
| 6. Immutability | ⚠️ PARTIAL | MEDIUM | Document or refactor |

**Core Invariants:** ✅ 5/5 PASS  
**Critical Fixes:** ❌ 3/6 FAIL, ⚠️ 2/6 PARTIAL, ✅ 1/6 PASS

---

## 🔧 Required Refactoring Summary

### Priority 1: CRITICAL (Breaks Game Logic)

**Refactor 1: Fix Ship Instance ID Usage**
- Rename `sourceShipId` → `sourceShipInstanceId` (instance ID)
- Add `sourceShipId` (definition ID, optional, display only)
- Update findShip() calls to use instance IDs
- Fix evaluateContinuousEffects() to use instance IDs

**Refactor 2: Remove Text Parsing**
- Delete parsePowerEffect() entirely
- Read from `power.effectType` and `power.baseAmount`
- Use PowerTiming enum instead of strings
- Delegate complex logic to SpecialLogic evaluator

**Refactor 3: Fix Max Health Logic**
- Remove `gameState.gameData.rules.maxHealth` access
- Use `player.maxHealth ?? gameState.settings.maxHealth ?? DEFAULT`
- Integrate with PassiveModifiers.getMaxHealthIncrease()
- Implement SET_HEALTH_MAX and INCREASE_MAX_HEALTH effect types

### Priority 2: HIGH (Type Safety)

**Refactor 4: Create Unified QueuedEffect Type**
- Define QueuedEffect interface per contract spec
- Support all effect types (DAMAGE, HEAL, GAIN_LINES, etc.)
- Update resolveEndOfTurn() signature to use QueuedEffect[]
- Update tallyHealthChanges() to handle all effect types

### Priority 3: MEDIUM (Code Quality)

**Refactor 5: Document Mutation Strategy**
- Add comment explaining mutation approach
- Verify consistency with rest of engine
- Consider future immutable refactor if needed

---

## 🎯 Critical Bugs to Fix

### Bug 1: Instance ID Collision

**Scenario:**
- Player has 2 Defenders (same definition ID "DEF")
- Both have continuous damage powers
- Effect uses `sourceShipId: "DEF"` (definition ID)
- findShip() returns first match
- Second Defender's effect attributed to first

**Impact:** Effects duplicated or misattributed

**Fix:** Use `sourceShipInstanceId` (unique per ship instance)

### Bug 2: Text Parsing Failure

**Scenario:**
- Ship power description changes: "3 damage" → "Deals 3 damage"
- Regex fails to match
- Effect resolves with value 0

**Impact:** Ships stop dealing damage silently

**Fix:** Read from `power.baseAmount` instead of parsing text

### Bug 3: Max Health Crash

**Scenario:**
- `gameState.gameData.rules` is undefined
- Code accesses `gameState.gameData.rules.maxHealth`
- Runtime error

**Impact:** Game crashes at End of Turn

**Fix:** Use correct field path with proper fallback chain

---

## ✅ What Works Correctly

**Strengths:**
- ✅ Core architecture (tally before apply) is correct
- ✅ Continuous vs triggered distinction correctly implemented
- ✅ Simultaneous resolution correctly implemented
- ✅ Win/loss checking after health changes
- ✅ Ship survival filtering for continuous effects

**Keep:**
- Overall structure and flow
- Tally → Apply → Finalize → Check pattern
- Effect separation logic

---

## 📖 Reference Documents

- Contract: "End of Turn Resolver Corrections & Contract"
- Current: `/game/engine/EndOfTurnResolver.tsx`
- Types: `/game/types/BattleTypes.tsx`, `/game/types/ShipTypes.tsx`
- Related: PassiveModifiers integration required

**Estimated Refactoring Time:** 3-4 hours

**This resolver requires critical refactoring before production use.**
