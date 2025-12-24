# PassiveModifiers Integration Guide

**Date:** 2024-12-23  
**Status:** Ready for integration  
**Prerequisites:** PassiveModifiers.tsx refactoring complete (compliance achieved)

---

## 🎯 Overview

This guide provides step-by-step instructions for integrating the refactored PassiveModifiers system into the Shapeships game engine.

**What Changed:**
- PassiveModifiers converted from static class to instance class
- Added central `updateModifiers(gameState)` method
- Changed to O(1) lookups via registry (was O(n) scans)
- Fixed API signatures to match contract

---

## 📋 Integration Checklist

### Phase 1: Instance Creation

**1. Create PassiveModifiers Instance in GameEngine**

```typescript
// In /game/engine/GameEngine.tsx

import PassiveModifiers from './PassiveModifiers';

export class GameEngine {
  private passiveModifiers: PassiveModifiers;
  
  constructor() {
    this.passiveModifiers = new PassiveModifiers();
  }
  
  // Make available to other systems
  getPassiveModifiers(): PassiveModifiers {
    return this.passiveModifiers;
  }
}
```

**Why:** PassiveModifiers is no longer static and requires instantiation.

---

### Phase 2: Update Trigger Points

**2. Call updateModifiers() at Phase Start**

```typescript
// In /game/engine/GamePhases.tsx or GameEngine.tsx

// At the start of EVERY phase
private startPhase(gameState: GameState, phase: GamePhase): GameState {
  // CRITICAL: Update passive modifiers first
  this.passiveModifiers.updateModifiers(gameState);
  
  // Then proceed with phase logic
  // ...
}
```

**3. Call updateModifiers() After Ship Actions**

```typescript
// After building a ship
private buildShip(gameState: GameState, playerId: string, shipId: string): GameState {
  // ... ship building logic ...
  
  // CRITICAL: Update passive modifiers
  this.passiveModifiers.updateModifiers(gameState);
  
  return gameState;
}

// After destroying a ship
private destroyShip(gameState: GameState, shipId: string): GameState {
  // ... destruction logic ...
  
  // CRITICAL: Update passive modifiers
  this.passiveModifiers.updateModifiers(gameState);
  
  return gameState;
}

// After consuming a ship in upgrade
private upgradeShip(gameState: GameState, consumedShipIds: string[]): GameState {
  // ... upgrade logic ...
  
  // CRITICAL: Update passive modifiers
  this.passiveModifiers.updateModifiers(gameState);
  
  return gameState;
}
```

**Why:** Modifiers must stay synchronized with current ship state.

---

### Phase 3: Update Destruction Validators

**4. Use canShipBeDestroyed() in Validators**

```typescript
// In validators or action processors

// OLD (INCORRECT):
const isProtected = PassiveModifiers.isDestructionPrevented(targetShip, gameState);
if (isProtected) {
  return { valid: false, reason: "Ship protected" };
}

// NEW (CORRECT):
const canDestroy = this.passiveModifiers.canShipBeDestroyed(targetPlayerId, sourcePlayerId);
if (!canDestroy) {
  return { valid: false, reason: "Ship cannot be destroyed (Sacrificial Pool)" };
}
```

**Applies to:**
- Sacrificial Pool sacrifice validation
- Black Hole targeting
- Guardian protection
- Ship of Equality protection
- Any future destroy effects

**Why:** Signature changed to match contract.

---

### Phase 4: Update Dice System

**5. Use getDiceRollOverride() for Leviathan**

```typescript
// In dice rolling logic

function rollDice(playerId: string, gameState: GameState): number {
  // Check for Leviathan override
  const override = this.passiveModifiers.getDiceRollOverride(playerId);
  if (override !== null) {
    console.log(`[Dice] Leviathan forces dice to ${override}`);
    return override;
  }
  
  // Normal dice roll
  return Math.floor(Math.random() * 6) + 1;
}
```

**6. Use getDiceRerollCount() for Ark of Knowledge**

```typescript
// In dice rolling logic

function handleDiceRoll(playerId: string, gameState: GameState): number {
  let roll = this.rollDice(playerId, gameState);
  
  // Check for reroll ability
  const rerollCount = this.passiveModifiers.getDiceRerollCount(playerId);
  
  for (let i = 0; i < rerollCount; i++) {
    const reroll = this.rollDice(playerId, gameState);
    console.log(`[Dice] Ark of Knowledge reroll ${i + 1}: ${roll} -> ${reroll}`);
    roll = reroll;
  }
  
  return roll;
}
```

**Why:** Dice modifiers must query PassiveModifiers.

---

### Phase 5: Update Health Calculations

**7. Use getMaxHealthIncrease() for Spiral**

```typescript
// In health calculation logic

function getMaxHealth(playerId: string, gameState: GameState): number {
  const BASE_MAX_HEALTH = 30;
  const increase = this.passiveModifiers.getMaxHealthIncrease(playerId);
  
  const maxHealth = BASE_MAX_HEALTH + increase;
  console.log(`[Health] Max health for ${playerId}: ${maxHealth} (base ${BASE_MAX_HEALTH} + modifier ${increase})`);
  
  return maxHealth;
}
```

**Why:** Max health calculation must include Spiral modifier (2+ Spirals → +15).

---

### Phase 6: Update Damage/Healing System

**8. Use shouldEqualizeDamageHealing() for Ark of Knowledge**

```typescript
// In End of Turn Resolution

function finalizeEffects(playerId: string, gameState: GameState): { damage: number; healing: number } {
  let totalDamage = this.calculateTotalDamage(playerId, gameState);
  let totalHealing = this.calculateTotalHealing(playerId, gameState);
  
  // Check for Ark of Knowledge equalization (3+)
  if (this.passiveModifiers.shouldEqualizeDamageHealing(playerId)) {
    const average = Math.floor((totalDamage + totalHealing) / 2);
    console.log(`[Ark] Equalizing damage/healing: ${totalDamage}/${totalHealing} -> ${average}/${average}`);
    totalDamage = average;
    totalHealing = average;
  }
  
  return { damage: totalDamage, healing: totalHealing };
}
```

**Why:** Ark of Knowledge (3+) equalizes damage and healing.

---

### Phase 7: Update Chronoswarm System

**9. Use hasExtraBuildPhase() for Phase Structure**

```typescript
// In phase sequencing logic

function determineNextPhase(gameState: GameState): GamePhase {
  const currentPhase = gameState.currentPhase;
  
  // After Battle Phase, check for Chronoswarm
  if (currentPhase === 'battle_phase') {
    // Check each player for Chronoswarm
    for (const playerId of [gameState.player1Id, gameState.player2Id]) {
      if (this.passiveModifiers.hasExtraBuildPhase(playerId)) {
        console.log(`[Chronoswarm] ${playerId} gets extra build phase`);
        return 'chronoswarm_build_phase';
      }
    }
  }
  
  // Normal phase sequence
  return this.getNextPhase(currentPhase);
}
```

**10. Use getChronoswarmDiceCount() for Dice Scaling**

```typescript
// In Chronoswarm build phase

function rollChronoswarmDice(playerId: string, gameState: GameState): number[] {
  const diceCount = this.passiveModifiers.getChronoswarmDiceCount(playerId);
  console.log(`[Chronoswarm] Rolling ${diceCount} dice (capped at 3)`);
  
  const rolls: number[] = [];
  for (let i = 0; i < diceCount; i++) {
    rolls.push(this.rollDice(playerId, gameState));
  }
  
  return rolls;
}
```

**Why:** Chronoswarm creates extra build phase and scales dice (1→1, 2→2, 3+→3).

---

### Phase 8: Update Effect Calculators

**11. Use EffectCalculator for Outcome Calculations**

```typescript
// Import EffectCalculator
import EffectCalculator from './EffectCalculator';

// For Spiral healing/damage
const spiralHealing = EffectCalculator.calculateSpiralEffect(playerId, gameState, 'heal');
const spiralDamage = EffectCalculator.calculateSpiralEffect(playerId, gameState, 'damage');

// For Sacrificial Pool xenite generation
const xenitesGained = EffectCalculator.calculateSacrificialPoolXenites(sacrificedShipId);
```

**Why:** Outcome calculations moved from PassiveModifiers to EffectCalculator.

---

## 🔍 Testing Integration

### Test Scenario 1: Sacrificial Pool

```typescript
// Setup: Player has Sacrificial Pool
// Action: Opponent tries to destroy player's ship via Black Hole
// Expected: Destruction blocked

const canDestroy = passiveModifiers.canShipBeDestroyed(targetPlayerId, opponentId);
assert.strictEqual(canDestroy, false, "Sacrificial Pool should block opponent destruction");

const canSelfDestroy = passiveModifiers.canShipBeDestroyed(targetPlayerId, targetPlayerId);
assert.strictEqual(canSelfDestroy, true, "Player can destroy own ships");
```

### Test Scenario 2: Leviathan

```typescript
// Setup: Player has Leviathan
// Action: Roll dice
// Expected: All rolls read as 6

const override = passiveModifiers.getDiceRollOverride(playerId);
assert.strictEqual(override, 6, "Leviathan should force dice to 6");
```

### Test Scenario 3: Spiral Max Health

```typescript
// Setup: Player has 2+ Spirals
// Action: Calculate max health
// Expected: Base 30 + 15 = 45

const increase = passiveModifiers.getMaxHealthIncrease(playerId);
assert.strictEqual(increase, 15, "2+ Spirals should grant +15 max health");
```

### Test Scenario 4: Chronoswarm

```typescript
// Setup: Player has 3 Chronoswarms (built on previous turns)
// Action: Check for extra build phase
// Expected: Extra phase with 3 dice

const hasExtra = passiveModifiers.hasExtraBuildPhase(playerId);
assert.strictEqual(hasExtra, true, "Chronoswarm should grant extra phase");

const diceCount = passiveModifiers.getChronoswarmDiceCount(playerId);
assert.strictEqual(diceCount, 3, "3 Chronoswarms should roll 3 dice (capped)");
```

---

## ⚠️ Common Integration Mistakes

### ❌ Mistake 1: Forgetting to Call updateModifiers()

```typescript
// WRONG
function buildShip(gameState: GameState, shipId: string): GameState {
  // ... build ship ...
  return gameState; // ❌ Modifiers not updated!
}

// CORRECT
function buildShip(gameState: GameState, shipId: string): GameState {
  // ... build ship ...
  this.passiveModifiers.updateModifiers(gameState); // ✅
  return gameState;
}
```

### ❌ Mistake 2: Using Old Static Method Names

```typescript
// WRONG
const isProtected = PassiveModifiers.isDestructionPrevented(ship, gameState);

// CORRECT
const canDestroy = this.passiveModifiers.canShipBeDestroyed(targetPlayerId, sourcePlayerId);
```

### ❌ Mistake 3: Not Checking Self-Destruction

```typescript
// WRONG (blocks player from sacrificing own ships)
if (!this.passiveModifiers.canShipBeDestroyed(targetPlayerId, sourcePlayerId)) {
  return error("Cannot destroy");
}

// CORRECT (allows self-destruction)
// canShipBeDestroyed already handles this:
// if (targetPlayerId === sourcePlayerId) return true;
```

### ❌ Mistake 4: Using PassiveModifiers for Effect Calculations

```typescript
// WRONG (moved to EffectCalculator)
const xenites = this.passiveModifiers.calculateSacrificialPoolXenites(shipId);

// CORRECT
const xenites = EffectCalculator.calculateSacrificialPoolXenites(shipId);
```

---

## 📊 Performance Considerations

**Before Refactoring:**
- O(n) scan per query (iterate through all ships every time)
- Example: Checking 3 different modifiers = 3 full ship scans

**After Refactoring:**
- O(n) scan once per updateModifiers() call
- O(1) lookup per query (Map access)
- Example: Checking 3 different modifiers = 3 Map lookups (instant)

**Best Practice:**
- Call `updateModifiers()` sparingly (only when ship state changes)
- Query modifiers as many times as needed (O(1) lookups are free)

---

## 🎯 Integration Timeline

**Estimated Time:** 2-3 hours

1. Phase 1 (15 min): Create PassiveModifiers instance
2. Phase 2 (30 min): Add updateModifiers() trigger points
3. Phase 3 (20 min): Update destruction validators
4. Phase 4 (20 min): Update dice system
5. Phase 5 (15 min): Update health calculations
6. Phase 6 (15 min): Update damage/healing system
7. Phase 7 (30 min): Update Chronoswarm system
8. Phase 8 (15 min): Update effect calculators

**Testing:** 30-60 min per test scenario

---

## ✅ Integration Verification

After integration, verify:

- [ ] PassiveModifiers instance created in GameEngine
- [ ] `updateModifiers()` called at every phase start
- [ ] `updateModifiers()` called after ship build/destroy/upgrade
- [ ] Destruction validation uses `canShipBeDestroyed(targetId, sourceId)`
- [ ] Dice system uses `getDiceRollOverride()` and `getDiceRerollCount()`
- [ ] Health calculation uses `getMaxHealthIncrease()`
- [ ] Damage/healing uses `shouldEqualizeDamageHealing()`
- [ ] Chronoswarm uses `hasExtraBuildPhase()` and `getChronoswarmDiceCount()`
- [ ] Effect calculators use `EffectCalculator` for outcomes
- [ ] All 4 test scenarios pass

---

## 📖 Reference Documents

- System: `/game/engine/PassiveModifiers.tsx`
- Modifier IDs: `/game/engine/PassiveModifierIds.tsx`
- Effect Calculator: `/game/engine/EffectCalculator.tsx`
- Compliance: `/game/engine/documentation/PassiveModifiers_COMPLIANCE_ACHIEVED.md`
- Contract: PassiveModifiers System Contract (13 points)

**Ready for integration.** ✅
