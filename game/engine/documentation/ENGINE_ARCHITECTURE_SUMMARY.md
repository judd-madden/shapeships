# Shapeships Engine Architecture - Final State

## Core Principle: Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                     GAME ENGINE STACK                        │
└─────────────────────────────────────────────────────────────┘

GamePhasesEngine          "WHEN can things happen?"
    ↓
RulesEngine              "WHETHER is this action legal?"
    ↓
ShipPowersEngine         "WHAT do powers do?"
    ↓
EndOfTurnResolver        "WHAT actually happens?"
```

---

## 1. GamePhasesEngine (WHEN)

**Owns:**
- ✅ Phase/step transitions (Build → Battle → Resolution)
- ✅ Readiness tracking (who needs to confirm)
- ✅ Automatic vs interactive step logic
- ✅ Phase transition conditions

**Does NOT Own:**
- ❌ Action validation (RulesEngine)
- ❌ Effect resolution (EndOfTurnResolver)
- ❌ Win conditions (EndOfTurnResolver)

**Key Methods:**
```typescript
getCurrentMajorPhase(gameState): MajorPhase
getCurrentStep(gameState): BuildPhaseStep | BattlePhaseStep | null
isActionValidForStep(action, gameState): boolean
shouldTransitionStep(gameState): PhaseTransition | null
transitionToStep(gameState, transition): GameState
areAllPlayersReady(gameState): boolean
setPlayerReady(gameState, playerId): GameState
```

**Fixed Issues:**
- ❌ Removed invalid `INTERACTION_LOOP` reference
- ❌ Deleted ~150 lines of resolution logic (violates separation)
- ❌ Derived `anyDeclarationsMade` from data (not flags)
- ❌ Renamed `getPlayersActiveInChargeSolarLoop` → `getPlayersEligibleForDeclaration`

---

## 2. RulesEngine (WHETHER)

**Owns:**
- ✅ Action legality validation (step-gated, resource-gated, ship-gated)
- ✅ Recording player intent (declarations stored in turnData)
- ✅ Triggering phase transitions (via readiness)
- ✅ Coordinating between engines

**Does NOT Own:**
- ❌ Win conditions (EndOfTurnResolver)
- ❌ Damage application (EndOfTurnResolver)
- ❌ Phase transition logic (GamePhasesEngine)

**Key Methods:**
```typescript
validateAction(action, gameState): boolean
applyAction(action, gameState): GameState
checkWinCondition(gameState): Player | null  // Delegated to EndOfTurnResolver
getValidMoves(playerId, gameState): GameAction[]  // Returns templates
```

**Action Taxonomy:**
```typescript
// Build Phase
'build_ship'
'upgrade_ship'
'save_lines'
'use_ship_building_power'
'use_drawing_phase_power'

// Battle Phase
'use_first_strike_power'
'declare_charge'
'use_solar_power'

// General
'pass'
'declare_ready'
'surrender'
```

**Fixed Issues:**
- ❌ Removed outdated action types (move, attack, special, combat_response)
- ❌ Fixed phase API calls (isActionValidForStep not isActionValidForPhase)
- ❌ Made checkWinCondition delegate to EndOfTurnResolver
- ❌ Made getValidMoves declarative (templates, not concrete actions)

---

## 3. ShipPowersEngine (WHAT powers do)

**Owns:**
- ✅ Power activation logic
- ✅ Once-only vs continuous effects
- ✅ Charge management
- ✅ Source destruction checks
- ✅ Species-specific power mechanics

**Does NOT Own:**
- ❌ When powers can be activated (GamePhasesEngine)
- ❌ Final damage resolution (EndOfTurnResolver)

**Key Methods:**
```typescript
canActivatePower(activation, gameState): boolean
activatePower(activation, gameState): GameState
getAvailablePowers(shipId, gameState): Power[]
```

**Status:** ✅ Already correct, no changes needed

---

## 4. EndOfTurnResolver (WHAT happens)

**Owns:**
- ✅ Damage/healing calculation
- ✅ Health modification (ONLY place health changes)
- ✅ Win/loss determination
- ✅ Effect resolution order

**Does NOT Own:**
- ❌ Phase transitions (GamePhasesEngine)
- ❌ Action validation (RulesEngine)

**Key Methods:**
```typescript
resolveEndOfTurn(gameState): GameState
calculateDamage(gameState): { [playerId: string]: number }
calculateHealing(gameState): { [playerId: string]: number }
applyHealthChanges(gameState, damage, healing): GameState
determineWinner(gameState): Player | null
```

**Status:** ✅ Already correct (single source of truth for health)

---

## Hard Invariants (Enforced Across All Engines)

### **1. Health Changes**
```
🔒 ONLY EndOfTurnResolver modifies player health
```
- ❌ GamePhasesEngine does NOT calculate damage
- ❌ RulesEngine does NOT apply damage
- ✅ Declarations stored → EndOfTurnResolver applies

---

### **2. Win Conditions**
```
🔒 ONLY EndOfTurnResolver determines winners
```
- ❌ GamePhasesEngine does NOT check win conditions
- ❌ RulesEngine.checkWinCondition() returns gameState.winner (already set)
- ✅ EndOfTurnResolver sets gameState.winner

---

### **3. Phase Transitions**
```
🔒 ONLY GamePhasesEngine manages phase/step transitions
```
- ❌ RulesEngine does NOT decide when phases change
- ✅ RulesEngine triggers transitions via readiness
- ✅ GamePhasesEngine evaluates transition conditions

---

### **4. Derived Logic**
```
🔒 Critical checks MUST be derived from data, not trusted flags
```
- ❌ Don't trust `anyDeclarationsMade` flag
- ✅ Derive from `pendingChargeDeclarations` and `pendingSOLARPowerDeclarations`

Example:
```typescript
// ❌ BAD
return turnData.anyDeclarationsMade || false;

// ✅ GOOD
const hasPendingCharges = Object.values(turnData.pendingChargeDeclarations || {}).some(
  arr => arr && arr.length > 0
);
const hasPendingSOLAR = Object.values(turnData.pendingSOLARPowerDeclarations || {}).some(
  arr => arr && arr.length > 0
);
return hasPendingCharges || hasPendingSOLAR;
```

---

## Data Flow Examples

### **Building a Ship (Build Phase)**
```
User Input → RulesEngine.validateAction('build_ship')
           → Check step === DRAWING
           → Check availableLines >= cost
           → RulesEngine.applyAction('build_ship')
           → Deduct lines
           → Add ship to gameData.ships
           → Check shouldTransitionStep
           → (if all ready) → GamePhasesEngine.transitionToStep
```

---

### **Declaring Charge (Battle Phase)**
```
User Input → RulesEngine.validateAction('declare_charge')
           → Check step === SIMULTANEOUS_DECLARATION or CONDITIONAL_RESPONSE
           → Check ship exists and has charges
           → RulesEngine.applyAction('declare_charge')
           → Store in turnData.pendingChargeDeclarations (hidden)
           → User declares ready
           → (both ready) → GamePhasesEngine reveals declarations
           → (transition) → END_OF_TURN_RESOLUTION
           → EndOfTurnResolver.resolveEndOfTurn()
           → Apply damage from all declarations
```

---

### **End of Turn Resolution**
```
GamePhasesEngine → Transition to END_OF_TURN_RESOLUTION
                → (Higher-level integration point)
                → EndOfTurnResolver.resolveEndOfTurn()
                → Calculate damage (from charges, SOLAR, automatic)
                → Calculate healing (from ships, powers)
                → Apply health changes (ONLY place this happens)
                → Check health <= 0
                → Set gameState.winner (if applicable)
                → GamePhasesEngine checks shouldEndGame
                → (if winner exists) → END_OF_GAME
                → (else) → Start new turn
```

---

## Validation Checklist (All Engines)

### GamePhasesEngine
- [x] No invalid enum references ✅
- [x] No health change logic ✅
- [x] Phase management ONLY ✅
- [x] Derived logic (not flags) ✅
- [x] Clear function names ✅

### RulesEngine
- [x] Step-gated validation ✅
- [x] Declarations stored (not applied) ✅
- [x] No win condition calculation ✅
- [x] Correct phase API calls ✅
- [x] Shapeships-specific actions ✅

### ShipPowersEngine
- [x] Power logic only ✅
- [x] No phase management ✅
- [x] No effect resolution ✅

### EndOfTurnResolver
- [x] Single source of health changes ✅
- [x] Single source of win determination ✅
- [x] No phase management ✅

---

## Files Modified

1. ✅ `/game/engine/GamePhases.tsx` - Fixed 4 critical issues
2. ✅ `/game/engine/RulesEngine.tsx` - Complete refactor
3. ✅ `/game/engine/documentation/GAMEPHASES_ARCHITECTURE_FIXES.md` - Documentation
4. ✅ `/game/engine/documentation/RULESENGINE_REFACTOR.md` - Documentation
5. ✅ `/game/engine/documentation/ENGINE_ARCHITECTURE_SUMMARY.md` - This file

**Total Changes:** ~300 lines removed, ~600 lines added, 4 architectural violations fixed

---

## Quote from Review

> "This RulesEngine is conceptually out of date relative to the system you've now designed. It's not 'bad code', but it is still shaped like an older mental model (turn-based, action-centric, win-condition-in-rules) rather than the phase-driven, readiness-gated, resolver-authoritative architecture you've converged on."

**Status:** ✅ **FIXED**

All engines now correctly implement phase-driven, readiness-gated, resolver-authoritative architecture. Hard separation enforced. 🎯

---

## Next Steps

### Integration Points to Address
1. ⚠️ EndOfTurnResolver invocation
   - GamePhasesEngine correctly transitions TO `END_OF_TURN_RESOLUTION`
   - Need to invoke `EndOfTurnResolver.resolveEndOfTurn()` at that point
   - Should happen in ActionResolver or backend server (higher-level integration)

2. ⚠️ Action routing
   - Ensure frontend sends new action types (`build_ship`, `declare_charge`, etc.)
   - Update ActionResolver to route to RulesEngine correctly
   - Test step-gated validation in multiplayer environment

3. ⚠️ UI updates
   - Update UI to construct action payloads (not rely on getValidMoves concrete actions)
   - Show/hide actions based on current step
   - Display pending declarations correctly (hidden until revealed)

---

**Architecture Status: Clean, consistent, and ready for implementation!** 🎉
