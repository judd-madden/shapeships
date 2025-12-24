# RulesEngine Refactor Summary

## Overview

Completely refactored RulesEngine.tsx to align with the phase-driven, readiness-gated, resolver-authoritative architecture.

---

## ❌ What Was Removed (Critical Issues Fixed)

### **1. checkWinCondition() Violation**

**Old Code:**
```typescript
checkWinCondition(gameState: GameState): Player | null {
  // Placeholder win condition logic
  const activePlayers = gameState.players.filter(player => {
    return true; // Will be replaced with actual ship counting
  });

  if (activePlayers.length === 1) {
    return activePlayers[0];
  }

  return null;
}
```

**Problem:** Violated core invariant: "Win/loss is checked ONLY in EndOfTurnResolver"

**Fix:**
```typescript
checkWinCondition(gameState: GameState): Player | null {
  // ⚠️ ARCHITECTURAL NOTE:
  // Win/loss determination is handled EXCLUSIVELY by EndOfTurnResolver.
  // This method exists to satisfy the GameRules interface but should NOT
  // be used for actual win condition checking.
  
  // Return already-determined winner (if set by EndOfTurnResolver)
  return gameState.winner || null;
}
```

**Impact:** ✅ No longer calculates winners - delegates to EndOfTurnResolver

---

### **2. Outdated Phase API Names**

**Old Code:**
```typescript
if (!this.phasesEngine.isActionValidForPhase(action, gameState)) {
  return false;
}

const currentPhase = this.phasesEngine.getCurrentPhase(gameState);
const validActionTypes = this.phasesEngine.getValidActionsForPhase(currentPhase, playerId, gameState);
const phaseTransition = this.phasesEngine.shouldTransitionPhase(newGameState);
newGameState = this.phasesEngine.transitionToPhase(newGameState, phaseTransition);
```

**Problem:** These methods don't exist in new GamePhasesEngine
- Can't reason about Build vs Battle vs Resolution
- Can't enforce step-level legality (Drawing vs Ships That Build)
- Drifts out of sync with readiness logic

**New Code:**
```typescript
if (!this.phasesEngine.isActionValidForStep(action, gameState)) {
  return false;
}

const currentStep = this.phasesEngine.getCurrentStep(gameState);
const validActionTypes = this.phasesEngine.getValidActionsForStep(currentStep, playerId, gameState);
const phaseTransition = this.phasesEngine.shouldTransitionStep(newGameState);
newGameState = this.phasesEngine.transitionToStep(newGameState, phaseTransition);
```

**Impact:** ✅ Speaks in MajorPhase + Step vocabulary, delegates to correct methods

---

### **3. Outdated Action Taxonomy**

**Old Actions:**
```typescript
case 'move':
  return this.validateMove(action, gameState);
case 'attack':
  return this.validateAttack(action, gameState);
case 'special':
  return this.validateSpecial(action, gameState);
case 'combat_response':
  return this.validateCombatResponse(action, gameState);
```

**Problem:** Generic actions don't match Shapeships phase model
- No free-form "attack" - damage is declared, not applied
- No positioning/"move"
- "special" is too vague

**New Actions:**
```typescript
// Build Phase
case 'build_ship':
case 'upgrade_ship':
case 'save_lines':
case 'use_ship_building_power':
case 'use_drawing_phase_power':

// Battle Phase
case 'use_first_strike_power':
case 'declare_charge':
case 'use_solar_power':

// General
case 'pass':
case 'declare_ready':
case 'surrender':
```

**Impact:** ✅ Action types match actual game phases and mechanics

---

### **4. Unanchored First Strike Validation**

**Old Code:**
```typescript
private validateFirstStrikePower(action: GameAction, gameState: GameState): boolean {
  // Validate that player has ships with first strike powers
  // Placeholder - will implement based on your ship/power data
  return true;
}
```

**Problem:** No linkage to:
- Whether player is required to act
- Whether ship actually has First Strike power
- Whether phase requires readiness

**New Code:**
```typescript
private validateFirstStrikePower(action: GameAction, gameState: GameState): boolean {
  // Validate during FIRST_STRIKE step
  const currentStep = this.phasesEngine.getCurrentStep(gameState);
  if (currentStep !== BattlePhaseStep.FIRST_STRIKE) return false;
  
  const { shipId, targetShipId } = action.data || {};
  if (!shipId) return false;
  
  // Check if ship has First Strike power and charges
  const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
  const ship = playerShips.find(s => s.id === shipId);
  if (!ship || ship.isDestroyed) return false;
  
  // Validate ship has First Strike capability (e.g. Guardian with charges)
  if (ship.shipId !== 'GUA') return false;
  if ((ship.currentCharges || 0) <= 0) return false;
  
  // If target specified, validate it exists
  if (targetShipId) {
    const targetExists = Object.values(gameState.gameData?.ships || {}).some(ships =>
      ships.some(s => s.id === targetShipId && !s.isDestroyed)
    );
    if (!targetExists) return false;
  }
  
  return true;
}
```

**Impact:** ✅ Anchored to phase system, validates actual ship capabilities

---

## ⚠️ What Was Refactored (Partial Fit → Proper Fit)

### **1. validateAction() Now Delegates Correctly**

**Old Pattern:** Tried to do too much
- Check game status ✅ (kept)
- Check phase legality ❌ (wrong API)
- Validate action semantics ✅ (kept but improved)

**New Pattern:**
```typescript
validateAction(action: GameAction, gameState: GameState): boolean {
  // Game must be active
  if (gameState.status !== 'active') return false;

  // Check if action is valid for current step (delegated)
  if (!this.phasesEngine.isActionValidForStep(action, gameState)) return false;

  // Action-specific validation (appropriate checks only)
  switch (action.type) {
    case 'build_ship':
      return this.validateBuildShip(action, gameState);
    // ... etc
  }
}
```

**Impact:** ✅ Correct delegation to phase engine, focused semantic checks

---

### **2. getValidMoves() Is Now Declarative**

**Old Pattern:** Constructed concrete actions with IDs
```typescript
validMoves.push({
  id: `declare_ready_${Date.now()}`,
  playerId,
  type: 'declare_ready',
  data: {},
  timestamp: new Date().toISOString()
});
```

**Problem:**
- IDs minted in wrong place
- Creates coupling between rules and UI
- UI should construct payloads

**New Pattern:**
```typescript
// ⚠️ NOTE: This returns action TYPE hints, not concrete actions.
// UI constructs the full action payload with targets/parameters,
// then RulesEngine validates it.

for (const actionType of validActionTypes) {
  validMoves.push({
    id: `template_${actionType}`, // Template only
    playerId,
    type: actionType,
    data: {}, // UI will populate
    timestamp: ''
  });
}
```

**Impact:** ✅ Returns hints, UI constructs payloads, engine validates

---

## ✅ What Was Kept (Correct Patterns)

### **1. Separation of Concerns Intent**

**Kept Comment:**
```typescript
// Rules engine - Shapeships action validation and coordination
// 
// ARCHITECTURE:
// - GamePhasesEngine: Owns WHEN things can happen
// - RulesEngine (this file): Owns WHETHER an action is legal, records player intent
// - ShipPowersEngine: Owns WHAT powers do
// - EndOfTurnResolver: Owns WHAT actually happens
```

**Why:** Clear separation is core to maintainability

---

### **2. Delegating Power Logic to ShipPowersEngine**

**Kept Pattern:**
```typescript
const activation: PowerActivation = {
  powerId: `${shipId}_building_power_${powerIndex}`,
  shipId,
  playerId: action.playerId
};

return this.powersEngine.canActivatePower(activation, gameState);
```

**Why:** ShipPowersEngine owns power mechanics (once-only, continuous, charges)

---

### **3. declare_ready Handling**

**Kept:**
```typescript
case 'declare_ready':
  return true; // Always allow declaring ready

// ...

private applyDeclareReady(action: GameAction, gameState: GameState): GameState {
  return this.phasesEngine.setPlayerReady(gameState, action.playerId);
}
```

**Why:** Matches readiness-first model exactly

---

## 🎯 New Architecture: What This Engine Now Does

### **✅ Validates Action Legality**
```typescript
private validateBuildShip(action: GameAction, gameState: GameState): boolean {
  // Check step
  const currentStep = this.phasesEngine.getCurrentStep(gameState);
  if (currentStep !== BuildPhaseStep.DRAWING) return false;
  
  // Check resources
  const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
  if (availableLines < (cost || 0)) return false;
  
  return true;
}
```

---

### **✅ Stores Player Intent (Declarations)**
```typescript
private applyDeclareCharge(action: GameAction, gameState: GameState): GameState {
  // Store charge declaration in pending (hidden until both players ready)
  const pendingCharges = turnData?.pendingChargeDeclarations || {};
  const playerPendingCharges = pendingCharges[action.playerId] || [];
  
  playerPendingCharges.push({
    playerId: action.playerId,
    shipId,
    powerIndex,
    targetPlayerId,
    targetShipId,
    timestamp: new Date().toISOString()
  });
  
  return { ...gameState, gameData: { ...gameState.gameData, turnData: { ...turnData, pendingChargeDeclarations: { ...pendingCharges, [action.playerId]: playerPendingCharges } } } };
}
```

---

### **✅ Triggers Phase Transitions via Readiness**
```typescript
applyAction(action: GameAction, gameState: GameState): GameState {
  let newGameState = { ...gameState };

  // Apply action
  switch (action.type) {
    case 'declare_ready':
      newGameState = this.applyDeclareReady(action, newGameState);
      break;
    // ... etc
  }

  // Check for phase transitions
  const phaseTransition = this.phasesEngine.shouldTransitionStep(newGameState);
  if (phaseTransition) {
    newGameState = this.phasesEngine.transitionToStep(newGameState, phaseTransition);
  }

  return newGameState;
}
```

---

## 🚫 What This Engine Does NOT Do

### **❌ Does NOT Decide Winners**
```typescript
// ❌ OLD: Calculated winners
if (activePlayers.length === 1) {
  return activePlayers[0];
}

// ✅ NEW: Returns already-determined winner
return gameState.winner || null;
```

**Authority:** EndOfTurnResolver

---

### **❌ Does NOT Apply Damage**
```typescript
// ✅ Stores declarations only
playerPendingCharges.push({
  playerId: action.playerId,
  shipId,
  powerIndex,
  targetPlayerId,
  targetShipId,
  timestamp: new Date().toISOString()
});

// ❌ Does NOT modify health here
```

**Authority:** EndOfTurnResolver

---

### **❌ Does NOT Manage Turn Order**
```typescript
// ✅ Delegates phase transitions
const phaseTransition = this.phasesEngine.shouldTransitionStep(newGameState);
if (phaseTransition) {
  newGameState = this.phasesEngine.transitionToStep(newGameState, phaseTransition);
}

// ❌ Does NOT decide when phases change
```

**Authority:** GamePhasesEngine

---

## Action Type Taxonomy (Complete List)

### **Build Phase Actions**
1. `build_ship` - Draw a new ship (DRAWING step)
2. `upgrade_ship` - Upgrade existing ship (DRAWING step)
3. `save_lines` - Save lines for future turns (DRAWING step)
4. `use_ship_building_power` - Activate ship building power (SHIPS_THAT_BUILD step)
5. `use_drawing_phase_power` - Activate drawing phase power (DRAWING step)

### **Battle Phase Actions**
6. `use_first_strike_power` - Activate First Strike (FIRST_STRIKE step)
7. `declare_charge` - Declare charge activation (SIMULTANEOUS_DECLARATION or CONDITIONAL_RESPONSE)
8. `use_solar_power` - Use SOLAR power (SIMULTANEOUS_DECLARATION or CONDITIONAL_RESPONSE)

### **General Actions**
9. `pass` - Skip action window (any interactive step)
10. `declare_ready` - Confirm readiness (any interactive step)
11. `surrender` - Forfeit game (any time)

---

## Validation Patterns

### **Step-Gated Validation**
```typescript
const currentStep = this.phasesEngine.getCurrentStep(gameState);
if (currentStep !== BuildPhaseStep.DRAWING) return false;
```

**Why:** Actions are only valid in specific steps

---

### **Resource-Gated Validation**
```typescript
const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
if (availableLines < (cost || 0)) return false;
```

**Why:** Players must have required resources

---

### **Ship-Gated Validation**
```typescript
const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
const ship = playerShips.find(s => s.id === shipId);
if (!ship || ship.isDestroyed) return false;
```

**Why:** Ship must exist, be owned, and not destroyed

---

### **Delegated Validation**
```typescript
const activation: PowerActivation = { ... };
return this.powersEngine.canActivatePower(activation, gameState);
```

**Why:** Complex power logic belongs in ShipPowersEngine

---

## Application Patterns

### **Resource Deduction**
```typescript
const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
const newAvailableLines = availableLines - (cost || 0);

return {
  ...gameState,
  gameData: {
    ...gameState.gameData,
    turnData: {
      ...gameState.gameData?.turnData,
      availableLines: {
        ...gameState.gameData?.turnData?.availableLines,
        [action.playerId]: newAvailableLines
      }
    }
  }
};
```

---

### **Declaration Storage**
```typescript
const pendingCharges = turnData?.pendingChargeDeclarations || {};
const playerPendingCharges = pendingCharges[action.playerId] || [];

playerPendingCharges.push({ ...declaration });

return {
  ...gameState,
  gameData: {
    ...gameState.gameData,
    turnData: {
      ...turnData,
      pendingChargeDeclarations: {
        ...pendingCharges,
        [action.playerId]: playerPendingCharges
      }
    }
  }
};
```

---

### **Readiness Triggering**
```typescript
private applyPass(action: GameAction, gameState: GameState): GameState {
  // Passing is equivalent to declaring ready without making declarations
  return this.phasesEngine.setPlayerReady(gameState, action.playerId);
}
```

---

## Files Modified

1. **`/game/engine/RulesEngine.tsx`**
   - Complete rewrite: ~280 lines → ~600 lines (more comprehensive)
   - Removed outdated action types (move, attack, special, combat_response)
   - Added Shapeships-specific actions (11 action types)
   - Fixed phase API calls (isActionValidForStep, getCurrentStep, etc.)
   - Removed win condition logic (delegated to EndOfTurnResolver)
   - Added step-gated validation patterns
   - Added declaration storage patterns
   - Comprehensive inline documentation

2. **`/game/engine/documentation/RULESENGINE_REFACTOR.md`**
   - New comprehensive documentation (this file)

---

## Testing Checklist

- [ ] Build Phase actions validate step correctly
- [ ] Battle Phase declarations stored in pending (not applied immediately)
- [ ] Resource deduction (lines) works correctly
- [ ] Ship existence/ownership validation works
- [ ] First Strike validation checks ship type and charges
- [ ] Solar Power validation checks energy costs
- [ ] declare_ready triggers phase transitions
- [ ] pass is treated as declare_ready
- [ ] surrender sets winner correctly
- [ ] checkWinCondition returns gameState.winner (not calculating)
- [ ] getValidMoves returns templates (not concrete actions)

---

## Migration Notes

### If Code Called Old Action Types:
```typescript
// ❌ OLD
{ type: 'attack', ... }
{ type: 'move', ... }
{ type: 'special', ... }

// ✅ NEW
{ type: 'declare_charge', ... }
{ type: 'build_ship', ... }
{ type: 'use_solar_power', ... }
```

### If Code Called Old Phase API:
```typescript
// ❌ OLD
phasesEngine.getCurrentPhase(gameState)
phasesEngine.isActionValidForPhase(action, gameState)
phasesEngine.shouldTransitionPhase(gameState)
phasesEngine.transitionToPhase(gameState, transition)

// ✅ NEW
phasesEngine.getCurrentStep(gameState)
phasesEngine.isActionValidForStep(action, gameState)
phasesEngine.shouldTransitionStep(gameState)
phasesEngine.transitionToStep(gameState, transition)
```

### If Code Called checkWinCondition():
```typescript
// ❌ OLD: Trusted RulesEngine to calculate winner
const winner = rulesEngine.checkWinCondition(gameState);

// ✅ NEW: Read winner from gameState (set by EndOfTurnResolver)
const winner = gameState.winner;
```

---

## Final Verdict

**Before:** ✅ Structurally sound, ❌ Philosophically behind

**After:** ✅ Structurally sound, ✅ Philosophically aligned

RulesEngine now correctly:
- Validates actions in step-specific context
- Records player intent (doesn't execute effects)
- Delegates to specialized engines
- Triggers phase transitions via readiness
- Enforces hard architectural boundaries

**Status: RulesEngine refactor complete! Now aligned with phase-driven, readiness-gated, resolver-authoritative architecture.** 🎯
