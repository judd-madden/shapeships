# PassiveModifiers.tsx - Contract Compliance Assessment

**Date:** 2024-12-23  
**File:** `/game/engine/PassiveModifiers.tsx`  
**Status:** ⚠️ Functional but requires significant architectural refactoring

---

## 🎯 Assessment Against 13 Mandatory Constraints

### ⚠️ CONSTRAINT 1: Core Principle - Passive Powers DO NOT Execute Effects - PARTIAL

**Status:** ⚠️ **PARTIAL COMPLIANCE**

**What's Correct:**
- ✅ No effect queuing
- ✅ No direct health modification
- ✅ No End of Turn execution
- Methods are queries, not executors

**Issues Found:**

1. **Line 369-389: `calculateSpiralEffect()` blurs boundaries**
   ```typescript
   static calculateSpiralEffect(
     playerId: string,
     gameState: GameState,
     effectType: 'heal' | 'damage'
   ): number
   ```
   - ❌ This calculates an effect amount, not a rule modifier
   - ❌ Should be in effect calculator, not PassiveModifiers
   - Passive should only answer "does Spiral modify rules?" not "what damage?"

2. **Line 276-282: `calculateSacrificialPoolXenites()` is effect calculation**
   ```typescript
   static calculateSacrificialPoolXenites(shipId: string): number
   ```
   - ❌ Calculates outcome (xenites generated)
   - ❌ Should be in action processor, not PassiveModifiers

**Recommendation:**
- Move calculation methods to effect calculators
- Keep only rule modifier queries in PassiveModifiers

---

### ⚠️ CONSTRAINT 2: Single Authoritative System - PARTIAL

**Status:** ⚠️ **PARTIAL COMPLIANCE**

**What's Correct:**
- ✅ Single `PassiveModifiers` class exists
- ✅ Centralized location for passive queries

**Critical Missing Infrastructure:**

1. **No `updateModifiers(gameState)` method**
   ```typescript
   // ❌ MISSING: Central update mechanism
   updateModifiers(gameState: GameState): void {
     // Scan all ships
     // Extract PASSIVE powers
     // Register modifiers
   }
   ```

2. **No central registration state**
   - Each method independently scans ships
   - No cached modifier registry
   - Performance issue: O(n) scan per query instead of O(1) lookup

3. **No modifier registry data structure**
   ```typescript
   // ❌ MISSING: Central registry
   private modifiers: Map<string, Map<string, { count: number }>> = new Map();
   ```

**Recommendation:**
- Add `updateModifiers()` as central entry point
- Add internal registry to cache modifiers
- Change queries to O(1) lookups instead of O(n) scans

---

### ❌ CONSTRAINT 3: When PassiveModifiers Runs - NON-COMPLIANT

**Status:** ❌ **FAIL**

**Contract Requirements:**
```typescript
updateModifiers(gameState) MUST be called:
- At the start of every phase
- After any ship is built/destroyed/consumed/stolen
```

**Current Implementation:**
- ❌ No `updateModifiers()` method exists
- ❌ No trigger points documented
- ❌ No recomputation mechanism
- ❌ No integration with phase engine

**Required Fix:**
```typescript
export class PassiveModifiers {
  private modifiers: Map<string, Map<string, ModifierData>> = new Map();
  
  // REQUIRED: Central update method
  updateModifiers(gameState: GameState): void {
    this.modifiers.clear();
    
    // Scan all players
    for (const [playerId, ships] of Object.entries(gameState.gameData.ships || {})) {
      this.scanPlayerShips(playerId, ships);
    }
  }
  
  private scanPlayerShips(playerId: string, ships: ShipInstance[]): void {
    // Extract passive powers and register modifiers
  }
}
```

**Integration Points:**
```typescript
// In GamePhases.tsx or GameEngine.tsx
passiveModifiers.updateModifiers(gameState);  // At phase start
passiveModifiers.updateModifiers(gameState);  // After ship built
passiveModifiers.updateModifiers(gameState);  // After ship destroyed
```

---

### ⚠️ CONSTRAINT 4: What Ships Are Scanned - PARTIAL

**Status:** ⚠️ **PARTIAL COMPLIANCE**

**What's Correct:**
- ✅ Consistently checks `isDepleted || isDestroyed`
- Lines 27, 45, 63, 84, 108, 127, 151, 172, 247, 263, 326 all filter correctly

**Missing Check:**
- ❌ Does NOT check `isConsumedInUpgrade`

**Contract Requirement:**
```typescript
if (ship.isDestroyed || ship.isConsumedInUpgrade) skip;
```

**Current Pattern:**
```typescript
// ❌ INCOMPLETE
if (ship.isDepleted || ship.isDestroyed) return false;

// ✅ SHOULD BE
if (ship.isDepleted || ship.isDestroyed || ship.isConsumedInUpgrade) return false;
```

**Occurrences to Fix:**
- Line 27, 45, 63, 84, 108, 127, 151, 172, 247, 263, 326

**Recommendation:**
- Add `isConsumedInUpgrade` check to all ship filters
- Create helper method: `isShipActive(ship)` for consistency

---

### ❌ CONSTRAINT 5: How Passive Powers Are Identified - NON-COMPLIANT

**Status:** ❌ **FAIL - CRITICAL ARCHITECTURAL ISSUE**

**Contract Requirement:**
```typescript
power.timing === PowerTiming.PASSIVE
```

**Current Implementation:**
```typescript
// ❌ WRONG: Uses hardcoded ship IDs
ship.definitionId === 'SAC'   // Line 28
ship.definitionId === 'HVE'   // Line 46
ship.definitionId === 'LEV'   // Line 64
ship.definitionId === 'SPI'   // Line 86
```

**Why This Is Wrong:**
1. Doesn't use the type system (`PowerTiming.PASSIVE`)
2. Can't discover new passive powers automatically
3. Violates single source of truth (ship definitions)
4. Not extensible

**Required Approach:**
```typescript
// ✅ CORRECT: Scan ship powers
const shipDef = getShipById(ship.definitionId);
if (!shipDef) continue;

for (const power of shipDef.powers) {
  if (power.timing === PowerTiming.PASSIVE) {
    // Register this modifier
    const modifierId = power.specialLogic?.customLogicId;
    if (modifierId) {
      this.registerModifier(playerId, modifierId);
    }
  }
}
```

**This is a fundamental refactor requirement.**

---

### ❌ CONSTRAINT 6: Modifier Identity Rules - NON-COMPLIANT

**Status:** ❌ **FAIL**

**Contract Requirement:**
```typescript
// Centrally defined modifier IDs
export const PASSIVE_MODIFIER_IDS = {
  SHIPS_CANNOT_BE_DESTROYED: 'ships_cannot_be_destroyed',
  SHIPS_IN_UPGRADES_COUNT: 'ships_in_upgrades_count',
  CHRONOSWARM_EXTRA_BUILD_PHASE: 'chronoswarm_extra_build_phase',
  SPIRAL_INCREASE_MAX_HEALTH: 'spiral_increase_max_health',
  // ... etc
} as const;
```

**Current Implementation:**
- ❌ No `PASSIVE_MODIFIER_IDS` constant
- ❌ Methods use ship IDs (`'SAC'`, `'HVE'`) instead of modifier IDs
- ❌ No central ID validation
- ❌ No protection against runtime ID invention

**Required Fix:**
1. Create `PASSIVE_MODIFIER_IDS` constant
2. Map ship definitions to modifier IDs
3. Validate IDs during registration
4. Use modifier IDs in query methods

**Example:**
```typescript
export const PASSIVE_MODIFIER_IDS = {
  SACRIFICIAL_POOL: 'ships_cannot_be_destroyed',
  HIVE: 'ships_in_upgrades_count',
  LEVIATHAN: 'dice_read_as_6',
  SPIRAL_MAX_HEALTH: 'spiral_increase_max_health',
  // ... etc
} as const;

// In ship definition (SAC):
powers: [{
  timing: PowerTiming.PASSIVE,
  specialLogic: {
    customLogicId: PASSIVE_MODIFIER_IDS.SACRIFICIAL_POOL
  }
}]
```

---

### ✅ CONSTRAINT 7: Counting Rules (Scaling) - COMPLIANT

**Status:** ✅ **PASS**

**Evidence:**
- ✅ Line 84-92: Spiral counting (2+ = +15 max health)
- ✅ Line 107-113: Ark of Knowledge counting (3+ = equalize)
- ✅ Line 126-138: Ark of Knowledge reroll scaling (1→1, 2→2)
- ✅ Line 171-185: Chronoswarm dice scaling (capped at 3)

**Implementation:**
```typescript
const spiralCount = playerShips.filter(/* ... */).length;
if (spiralCount >= 2) return 15;

const chronoswarmCount = playerShips.filter(/* ... */).length;
if (chronoswarmCount >= 3) return 3;
if (chronoswarmCount >= 2) return 2;
if (chronoswarmCount >= 1) return 1;
```

✅ **COMPLIANT** - Counting logic is correct.

---

### ⚠️ CONSTRAINT 8: Query API (Authoritative) - PARTIAL

**Status:** ⚠️ **PARTIAL COMPLIANCE - API MISMATCH**

**Contract Requirement:**
```typescript
canShipBeDestroyed(
  targetPlayerId: string,
  sourcePlayerId: string
): boolean
```

**Current Implementation:**
```typescript
// ❌ WRONG SIGNATURE
static isDestructionPrevented(
  targetShip: ShipInstance,
  gameState: GameState
): boolean
```

**Issues:**
1. Signature doesn't match contract
2. Doesn't distinguish self-destruction vs opponent destruction
3. Missing source player parameter
4. Returns inverted logic (prevented vs can_be)

**Required Signature:**
```typescript
canShipBeDestroyed(
  targetPlayerId: string,
  sourcePlayerId: string
): boolean {
  // Players may destroy their own ships
  if (targetPlayerId === sourcePlayerId) return true;
  
  // Check if target has protection modifier
  return !this.hasModifier(targetPlayerId, PASSIVE_MODIFIER_IDS.SACRIFICIAL_POOL);
}
```

**Missing Generic Methods:**
```typescript
// ❌ MISSING
hasModifier(playerId: string, modifierId: string): boolean
countModifier(playerId: string, modifierId: string): number

// ✅ EXISTS (but should use generic methods)
doShipsInUpgradesCount(playerId: string): boolean
hasExtraBuildPhase(playerId: string): boolean
getChronoswarmDiceCount(playerId: string): number
getMaxHealthIncrease(playerId: string): number
```

**Recommendation:**
- Refactor `isDestructionPrevented` → `canShipBeDestroyed` with contract signature
- Add `hasModifier()` and `countModifier()` as generic query methods
- Implement other queries on top of generic methods

---

### ⚠️ CONSTRAINT 9: Passive Modifiers Are NOT Effects - PARTIAL

**Status:** ⚠️ **PARTIAL COMPLIANCE**

**What's Correct:**
- ✅ No TriggeredEffect creation
- ✅ No EvaluatedEffect creation
- ✅ No direct health modification
- ✅ No End of Turn resolution

**Boundary Violations:**

1. **Line 369-389: `calculateSpiralEffect()` is effect calculation**
   - Should be in effect calculator, not PassiveModifiers
   - Passive should only answer "does Spiral exist?" not "what's the damage?"

2. **Line 276-282: `calculateSacrificialPoolXenites()` is outcome calculation**
   - Should be in action processor
   - PassiveModifiers should only validate legality

**Contract Guidance:**
- PassiveModifiers: "Can I do this?" (legality)
- Effect Calculator: "What happens if I do?" (outcome)

**Recommendation:**
- Move calculation methods out of PassiveModifiers
- Keep only boolean/number queries about rule state

---

### ✅ CONSTRAINT 10: Explicit Non-Responsibilities - COMPLIANT

**Status:** ✅ **PASS**

**Verification:**
- ✅ No damage/healing queuing
- ✅ No player health modification
- ✅ No direct ship modification
- ✅ No animations
- ✅ No energy costs
- ✅ No charge interaction
- ✅ No turn history storage

✅ **COMPLIANT** - No forbidden responsibilities detected.

---

### ❌ CONSTRAINT 11: Example Correct Usage - NON-COMPLIANT

**Status:** ❌ **FAIL**

**Contract Example:**
```typescript
passiveModifiers.updateModifiers(gameState);

if (!passiveModifiers.canShipBeDestroyed(targetId, sourceId)) {
  return error("Ship cannot be destroyed due to Sacrificial Pool");
}
```

**Current State:**
- ❌ No `updateModifiers()` method
- ❌ `canShipBeDestroyed()` signature doesn't match
- ❌ Example usage pattern not supported

**This cannot be achieved without refactoring.**

---

### ⚠️ CONSTRAINT 12: Architectural Law - PARTIAL

**Status:** ⚠️ **PARTIAL COMPLIANCE**

**Contract:**
> "Passive powers change what is legal.  
> Active powers change what happens.  
> This boundary must never be blurred."

**Analysis:**
- ✅ Concept is correctly understood
- ⚠️ Some methods blur the line (calculateSpiralEffect, calculateSacrificialPoolXenites)
- ⚠️ Implementation structure doesn't enforce boundary

**Recommendation:**
- Rename class methods to emphasize legality checks
- Move outcome calculations elsewhere
- Document architectural law in file header

---

### ✅ CONSTRAINT 13: If Unsure, Ask - N/A

**Status:** N/A (implementation guidance, not validation criterion)

---

## 📋 Summary: Compliance Report

| Constraint | Status | Action Required |
|------------|--------|-----------------|
| 1. Core Principle | ⚠️ PARTIAL | Move calculation methods out |
| 2. Single Authoritative System | ⚠️ PARTIAL | Add updateModifiers() + registry |
| 3. When PassiveModifiers Runs | ❌ FAIL | Implement updateModifiers() |
| 4. What Ships Are Scanned | ⚠️ PARTIAL | Add isConsumedInUpgrade check |
| 5. How Passive Powers Identified | ❌ FAIL | Scan power.timing === PASSIVE |
| 6. Modifier Identity Rules | ❌ FAIL | Add PASSIVE_MODIFIER_IDS |
| 7. Counting Rules | ✅ PASS | None |
| 8. Query API | ⚠️ PARTIAL | Fix canShipBeDestroyed signature |
| 9. Modifiers Are NOT Effects | ⚠️ PARTIAL | Move calculations out |
| 10. Non-Responsibilities | ✅ PASS | None |
| 11. Example Correct Usage | ❌ FAIL | Requires refactor |
| 12. Architectural Law | ⚠️ PARTIAL | Clarify boundaries |
| 13. If Unsure, Ask | N/A | N/A |

**Overall Grade:** 2/12 PASS, 6/12 PARTIAL, 4/12 FAIL

---

## 🔧 Required Refactoring for Full Compliance

### Priority 1: CRITICAL (Breaks Contract)

**Refactor 1: Implement Central Update Mechanism**

```typescript
export class PassiveModifiers {
  private modifiers: Map<string, Map<string, { count: number }>> = new Map();
  
  // CRITICAL: Add this method
  updateModifiers(gameState: GameState): void {
    this.modifiers.clear();
    
    // Scan all players
    for (const [playerId, ships] of Object.entries(gameState.gameData.ships || {})) {
      this.scanPlayerShips(playerId, ships, gameState);
    }
  }
  
  private scanPlayerShips(playerId: string, ships: ShipInstance[], gameState: GameState): void {
    for (const ship of ships) {
      // ✅ CORRECT FILTER
      if (ship.isDestroyed || ship.isConsumedInUpgrade || ship.isDepleted) continue;
      
      const shipDef = getShipById(ship.definitionId);
      if (!shipDef) continue;
      
      // ✅ CORRECT IDENTIFICATION
      for (const power of shipDef.powers) {
        if (power.timing === PowerTiming.PASSIVE) {
          const modifierId = power.specialLogic?.customLogicId;
          if (modifierId) {
            this.registerModifier(playerId, modifierId);
          }
        }
      }
    }
  }
  
  private registerModifier(playerId: string, modifierId: string): void {
    if (!PASSIVE_MODIFIER_IDS_SET.has(modifierId)) {
      console.warn(`Unknown passive modifier ID: ${modifierId}`);
      return;
    }
    
    if (!this.modifiers.has(playerId)) {
      this.modifiers.set(playerId, new Map());
    }
    
    const playerMods = this.modifiers.get(playerId)!;
    const existing = playerMods.get(modifierId) || { count: 0 };
    existing.count += 1;
    playerMods.set(modifierId, existing);
  }
}
```

**Refactor 2: Add PASSIVE_MODIFIER_IDS**

```typescript
export const PASSIVE_MODIFIER_IDS = {
  SACRIFICIAL_POOL: 'ships_cannot_be_destroyed',
  HIVE: 'ships_in_upgrades_count',
  LEVIATHAN: 'dice_read_as_6',
  SPIRAL_MAX_HEALTH: 'spiral_increase_max_health',
  ARK_KNOWLEDGE_EQUALIZE: 'equalize_damage_healing',
  ARK_KNOWLEDGE_REROLL: 'dice_reroll',
  CHRONOSWARM_BUILD_PHASE: 'chronoswarm_extra_build_phase',
  CHRONOSWARM_DICE_SCALING: 'chronoswarm_dice_scaling',
  // ... etc
} as const;

const PASSIVE_MODIFIER_IDS_SET = new Set(Object.values(PASSIVE_MODIFIER_IDS));
```

**Refactor 3: Fix canShipBeDestroyed Signature**

```typescript
// ❌ DELETE THIS
static isDestructionPrevented(targetShip: ShipInstance, gameState: GameState): boolean

// ✅ ADD THIS
canShipBeDestroyed(targetPlayerId: string, sourcePlayerId: string): boolean {
  // Players may destroy their own ships
  if (targetPlayerId === sourcePlayerId) return true;
  
  // Check if target has protection modifier
  return !this.hasModifier(targetPlayerId, PASSIVE_MODIFIER_IDS.SACRIFICIAL_POOL);
}
```

---

### Priority 2: HIGH (API Compliance)

**Refactor 4: Add Generic Query Methods**

```typescript
hasModifier(playerId: string, modifierId: string): boolean {
  return this.modifiers.get(playerId)?.has(modifierId) || false;
}

countModifier(playerId: string, modifierId: string): number {
  return this.modifiers.get(playerId)?.get(modifierId)?.count || 0;
}
```

**Refactor 5: Implement Queries Using Generic Methods**

```typescript
doShipsInUpgradesCount(playerId: string): boolean {
  return this.hasModifier(playerId, PASSIVE_MODIFIER_IDS.HIVE);
}

hasExtraBuildPhase(playerId: string): boolean {
  return this.hasModifier(playerId, PASSIVE_MODIFIER_IDS.CHRONOSWARM_BUILD_PHASE);
}

getChronoswarmDiceCount(playerId: string): number {
  const count = this.countModifier(playerId, PASSIVE_MODIFIER_IDS.CHRONOSWARM_DICE_SCALING);
  return Math.min(count, 3);  // Capped at 3
}

getMaxHealthIncrease(playerId: string): number {
  const count = this.countModifier(playerId, PASSIVE_MODIFIER_IDS.SPIRAL_MAX_HEALTH);
  return count >= 2 ? 15 : 0;
}
```

---

### Priority 3: MEDIUM (Code Quality)

**Refactor 6: Move Calculations Out**

```typescript
// ❌ DELETE FROM PassiveModifiers:
static calculateSpiralEffect(...)
static calculateSacrificialPoolXenites(...)

// ✅ MOVE TO /game/engine/EffectCalculator.tsx (or similar)
```

**Refactor 7: Add isConsumedInUpgrade Check**

```typescript
// Update all ship filters:
if (ship.isDestroyed || ship.isConsumedInUpgrade || ship.isDepleted) continue;
```

---

## ✅ Validation Checklist

After refactoring, verify:

- [ ] `updateModifiers(gameState)` method exists
- [ ] `PASSIVE_MODIFIER_IDS` constant defined
- [ ] Modifier registry uses Map data structure
- [ ] Ship scanning checks `power.timing === PowerTiming.PASSIVE`
- [ ] Ship scanning checks `isConsumedInUpgrade`
- [ ] `canShipBeDestroyed(targetPlayerId, sourcePlayerId)` signature matches contract
- [ ] `hasModifier()` and `countModifier()` generic methods exist
- [ ] Calculation methods moved out of PassiveModifiers
- [ ] All 12 constraints achieve PASS status

---

## 🎯 Final Recommendation

**Current Status:** Functional but architecturally non-compliant.

**Action Items:**
1. Apply Priority 1 refactors (central update, modifier IDs, API signature) **IMMEDIATELY**
2. Apply Priority 2 refactors (generic query methods) before engine integration
3. Apply Priority 3 refactors (code quality) during next iteration

**Timeline:** 2-3 hours to achieve full compliance.

**Risk if not refactored:**
- Cannot integrate with phase engine (no updateModifiers() trigger)
- Cannot discover new passive powers automatically (hardcoded ship IDs)
- API mismatch breaks destruction logic (Sacrificial Pool, Black Hole, Guardian)
- Performance degradation (O(n) scans instead of O(1) lookups)
- Not extensible for future passive powers

**Critical Scenario:**
```typescript
// Current: Cannot do this
passiveModifiers.updateModifiers(gameState);

// Current: Wrong signature
passiveModifiers.canShipBeDestroyed(targetId, sourceId);  // Breaks

// After refactor: Correct usage
passiveModifiers.updateModifiers(gameState);
if (!passiveModifiers.canShipBeDestroyed(targetId, sourceId)) {
  return error("Ship protected by Sacrificial Pool");
}
```

**This system requires significant refactoring before production use.**

---

## 📖 Reference Documents

- Contract: 13-point PassiveModifiers System Contract
- Related: `/game/types/ShipTypes.tsx` (PowerTiming.PASSIVE)
- Engine Integration: GamePhases.tsx, GameEngine.tsx
