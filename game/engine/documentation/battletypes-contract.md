# BattleTypes Contract - Effect System Semantics

**Date:** 2024-12-23  
**Purpose:** Define precise semantics for TriggeredEffect and EvaluatedEffect  
**Audience:** Future developers implementing effect resolution and Battle Phase logic  

---

## 🎯 Core Principle

Effects in Shapeships resolve at **End of Turn Resolution**, but are created at different times:

- **TriggeredEffect**: Created during Build/Battle, persisted, resolves later
- **EvaluatedEffect**: Calculated at End of Turn Resolution time (ephemeral)

**CRITICAL:** The timing of creation determines persistence semantics.

---

## 📋 Effect Types Taxonomy

### EffectType (Shared with ActionTypes)

Both TriggeredEffect and EvaluatedEffect use the global EffectType enum from ActionTypes:

```typescript
export type EffectType =
  | 'DAMAGE'
  | 'HEALING'
  | 'BUILD_SHIP'
  | 'TRANSFORM_SHIP'
  | 'DESTROY_SHIP'
  | 'GENERATE_LINES'
  | 'GENERATE_JOINING_LINES'
  | 'SET_HEALTH'
  | 'STEAL_SHIP'
  | 'DICE_REROLL';
```

**Why EffectType instead of narrow 'DAMAGE' | 'HEAL'?**
- Avoids enum duplication
- Supports all triggered effects (charges can build ships, destroy ships, etc.)
- Prevents artificial limits later
- Single source of truth

**Examples:**

**Damage/Healing (common):**
```typescript
{
  effectType: 'DAMAGE',
  value: 5,
  targetPlayerId: 'opponent'
}
```

**Build Ship (charge power):**
```typescript
{
  effectType: 'BUILD_SHIP',
  targetShipType: 'XEN',
  targetPlayerId: 'self'
}
```

**Destroy Ship (charge power):**
```typescript
{
  effectType: 'DESTROY_SHIP',
  targetShipId: 'opponent-guardian-1',
  targetPlayerId: 'opponent'
}
```

---

## 🔑 TriggeredEffect vs EvaluatedEffect

### TriggeredEffect

**When Created:** During Build Phase or Battle Phase  
**When Resolved:** End of Turn Resolution  
**Persistence:** Stored in game state until resolution  
**Survival:** Persists even if source ship destroyed  

**Use Cases:**
- Once-only powers (triggered when built)
- Charge powers (used during Battle)
- Solar Powers (energy spent during Battle)
- One-time conditional effects

**Key Property:**
```typescript
persistsIfSourceDestroyed: boolean;
```

**Example Flow:**
```
Turn 1, Build Phase:
  - Player builds Orbital
  - Orbital's "when built, gain 1 line" triggers
  - TriggeredEffect created: { effectType: 'GENERATE_LINES', value: 1, persistsIfSourceDestroyed: true }
  - Effect stored in game state

Turn 1, Battle Phase:
  - Opponent destroys Orbital with Guardian charge

Turn 1, End of Turn Resolution:
  - TriggeredEffect still resolves (persistsIfSourceDestroyed = true)
  - Player gains 1 line even though Orbital destroyed
```

**Engine Contract:**
```typescript
function createTriggeredEffect(
  shipId: string,
  power: ShipPower,
  context: PowerExecutionContext
): TriggeredEffect {
  return {
    id: generateId(),
    sourceShipId: shipId,
    sourcePlayerId: context.playerId,
    targetPlayerId: power.targetType === 'SELF' ? context.playerId : context.opponentId,
    effectType: power.effectType,
    value: power.baseAmount,
    persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC || power.isCharge,
    sourceType: 'ship', // Default: ship-originated
    description: power.description,
    triggeredAt: new Date().toISOString()
  };
}
```

### EvaluatedEffect

**When Created:** At End of Turn Resolution time  
**When Resolved:** Immediately (ephemeral)  
**Persistence:** NOT stored - computed fresh each turn  
**Survival:** Requires ship to exist at resolution time  

**Use Cases:**
- Continuous Automatic effects ("each turn")
- Per-turn recurring effects
- Effects that scale based on current game state

**Key Property:**
```typescript
requiresShipAlive: true; // Ship must exist at resolution
```

**Example Flow:**
```
Turn 1, End of Turn Resolution:
  - Engine evaluates all CONTINUOUS AUTOMATIC powers
  - Xenite exists: creates EvaluatedEffect { effectType: 'DAMAGE', value: 1 }
  - Effect immediately applied
  - Effect NOT stored (ephemeral)

Turn 2, Battle Phase:
  - Xenite destroyed

Turn 2, End of Turn Resolution:
  - Engine evaluates all CONTINUOUS AUTOMATIC powers
  - Xenite does not exist: NO EvaluatedEffect created
  - Dead ships filtered upstream before evaluation
```

**Engine Contract:**
```typescript
function evaluateContinuousEffects(gameState: GameState): EvaluatedEffect[] {
  const allShips = getAllPlayerShips(gameState);
  const effects: EvaluatedEffect[] = [];
  
  allShips.forEach(ship => {
    // Skip destroyed ships (upstream filter)
    if (ship.isDepleted) return;
    
    const shipDef = getShipById(ship.definitionId);
    const continuousPowers = shipDef.powers.filter(
      p => p.phase === ShipPowerPhase.AUTOMATIC && p.timing === PowerTiming.CONTINUOUS
    );
    
    continuousPowers.forEach(power => {
      effects.push({
        sourceShipId: ship.instanceId,
        sourcePlayerId: ship.ownerId,
        targetPlayerId: power.targetType === 'SELF' ? ship.ownerId : getOpponentId(ship.ownerId),
        effectType: power.effectType,
        value: calculateValue(power, gameState), // Can scale based on current state
        requiresShipAlive: true, // Always true for evaluated effects
        sourceType: 'ship', // Default: ship-originated
        powerIndex: power.powerIndex,
        powerDescription: power.description
      });
    });
  });
  
  return effects; // Ephemeral - not stored
}
```

---

## 🔑 sourceType Semantics

### Purpose

Distinguish effect origin patterns to support:
- Per-ship effects (typical)
- Per-player effects (Hive-style global modifiers)
- Global effects (Chronoswarm, Solar Field)

**Why this matters:**
- Prevents engine from being painted into corners later
- Supports future complex powers cleanly
- Makes scaling and targeting logic explicit

### Values

#### 'ship' (Default)
**When:** Effect originates from a specific ship instance  
**Examples:**
- Xenite deals 1 damage
- Guardian charge destroys ship
- Orbital gains 1 line when built

**Semantics:**
- sourceShipId is meaningful (specific ship)
- Effect tied to ship instance
- Most common case (~90% of effects)

```typescript
{
  sourceShipId: 'xenite-5',
  sourcePlayerId: 'player1',
  effectType: 'DAMAGE',
  value: 1,
  sourceType: 'ship' // Default
}
```

#### 'player'
**When:** Effect originates from player-level modifier (not a specific ship)  
**Examples:**
- Hive: "All your ships get +1 damage"
- Species bonus: "+2 healing for all ships"
- Player-wide buff/debuff

**Semantics:**
- sourceShipId may be placeholder or empty
- Effect applies to all player's ships
- Not tied to ship survival

```typescript
{
  sourceShipId: 'hive-modifier', // Placeholder
  sourcePlayerId: 'player1',
  effectType: 'DAMAGE',
  value: 1, // +1 damage to ALL ships
  sourceType: 'player' // Player-wide modifier
}
```

**Engine Pattern:**
```typescript
function evaluatePlayerModifiers(playerId: string, gameState: GameState): EvaluatedEffect[] {
  const modifiers = getPlayerModifiers(playerId, gameState);
  
  return modifiers.map(mod => ({
    sourceShipId: `${mod.type}-modifier`, // Not a real ship
    sourcePlayerId: playerId,
    effectType: mod.effectType,
    value: mod.value,
    sourceType: 'player', // Player-wide
    powerDescription: mod.description
  }));
}
```

#### 'global'
**When:** Effect originates from game-wide rule (not player-specific)  
**Examples:**
- Chronoswarm: "All players get +1 build discount"
- Solar Field: "All damage increased by dice value"
- Global event modifiers

**Semantics:**
- sourceShipId and sourcePlayerId may be empty
- Effect applies to entire game
- Not tied to player or ship

```typescript
{
  sourceShipId: 'chronoswarm-global', // Placeholder
  sourcePlayerId: '', // No specific player
  effectType: 'GENERATE_LINES',
  value: 1, // +1 lines for all players
  sourceType: 'global' // Game-wide
}
```

**Engine Pattern:**
```typescript
function evaluateGlobalModifiers(gameState: GameState): EvaluatedEffect[] {
  const globalRules = getActiveGlobalRules(gameState);
  
  return globalRules.flatMap(rule => {
    // Apply to all players
    return [gameState.player1Id, gameState.player2Id].map(playerId => ({
      sourceShipId: `${rule.type}-global`,
      sourcePlayerId: '', // Global (no owner)
      targetPlayerId: playerId,
      effectType: rule.effectType,
      value: rule.value,
      sourceType: 'global', // Game-wide
      powerDescription: rule.description
    }));
  });
}
```

#### 'continuous' (Legacy)
**When:** Old marker for continuous effects (prefer 'ship' for new code)  
**Status:** Supported for backward compatibility  
**Recommendation:** Use 'ship' for new continuous effects

```typescript
// Old style (still works)
{
  sourceType: 'continuous'
}

// Preferred (new code)
{
  sourceType: 'ship' // More precise
}
```

### sourceType Decision Tree

```
Is this effect from a specific ship instance?
  YES → sourceType: 'ship' (default, most common)
  NO ↓

Is this effect from a player-wide modifier?
  YES → sourceType: 'player' (Hive, species bonus)
  NO ↓

Is this effect from a game-wide rule?
  YES → sourceType: 'global' (Chronoswarm, Solar Field)
```

---

## 🔑 Key Semantic Rules

### Rule 1: TriggeredEffect Persists, EvaluatedEffect Does Not

**TriggeredEffect:**
```typescript
// Created during Build Phase
const triggeredEffect = createTriggeredEffect(orbitalShip, 'when built' power);

// Stored in game state
gameState.triggeredEffects.push(triggeredEffect);

// Resolved at End of Turn (even if Orbital destroyed)
resolveTriggeredEffects(gameState.triggeredEffects);
```

**EvaluatedEffect:**
```typescript
// Computed at End of Turn Resolution time
const evaluatedEffects = evaluateContinuousEffects(gameState);

// Immediately applied (not stored)
applyEffects(evaluatedEffects);

// Next turn: recompute from scratch (no persistence)
```

**CRITICAL:** Do not store EvaluatedEffect in game state.

### Rule 2: persistsIfSourceDestroyed for TriggeredEffect Only

**Once-Only and Charges:**
```typescript
{
  persistsIfSourceDestroyed: true, // Effect survives ship death
  timing: PowerTiming.ONCE_ONLY_AUTOMATIC
}
```

**Continuous (should use EvaluatedEffect instead):**
```typescript
// ❌ WRONG: Continuous as TriggeredEffect
{
  persistsIfSourceDestroyed: false,
  timing: PowerTiming.CONTINUOUS
}

// ✅ CORRECT: Continuous as EvaluatedEffect
// Computed fresh each turn, no persistence needed
```

**Engine Contract:**
```typescript
function resolveTriggeredEffects(effects: TriggeredEffect[], gameState: GameState): GameState {
  effects.forEach(effect => {
    // Check if source ship still exists
    const sourceShip = getShipById(effect.sourceShipId, gameState);
    
    if (!sourceShip && !effect.persistsIfSourceDestroyed) {
      // Effect cancelled (ship destroyed, effect doesn't persist)
      console.log(`Effect from ${effect.sourceShipId} cancelled (ship destroyed)`);
      return;
    }
    
    // Apply effect
    applyEffect(effect, gameState);
  });
  
  return gameState;
}
```

### Rule 3: requiresShipAlive is Informational

**Purpose:** Document that EvaluatedEffect requires ship survival  
**Implementation:** Upstream filter already removes destroyed ships  

**Engine Pattern:**
```typescript
// ❌ WRONG: Redundant check (already filtered)
function applyEvaluatedEffect(effect: EvaluatedEffect, gameState: GameState) {
  if (effect.requiresShipAlive) {
    const ship = getShipById(effect.sourceShipId, gameState);
    if (!ship || ship.isDepleted) {
      return; // Redundant check!
    }
  }
  applyEffect(effect, gameState);
}

// ✅ CORRECT: Trust upstream filter
function applyEvaluatedEffect(effect: EvaluatedEffect, gameState: GameState) {
  // Ship survival already enforced during evaluation
  // requiresShipAlive is informational only
  applyEffect(effect, gameState);
}
```

**CRITICAL:** Do not re-check ship survival in effect application.

### Rule 4: EffectType Supports All Effect Types

**Not just DAMAGE and HEAL:**
```typescript
// Charge builds ship
{
  effectType: 'BUILD_SHIP',
  targetShipType: 'XEN'
}

// Charge destroys ship
{
  effectType: 'DESTROY_SHIP',
  targetShipId: 'opponent-guardian-1'
}

// Once-only generates lines
{
  effectType: 'GENERATE_LINES',
  value: 1
}

// Charge transforms ship
{
  effectType: 'TRANSFORM_SHIP',
  targetShipId: 'xenite-5',
  targetShipType: 'OXI'
}
```

**Engine Contract:**
```typescript
function applyEffect(effect: TriggeredEffect | EvaluatedEffect, gameState: GameState): GameState {
  switch (effect.effectType) {
    case 'DAMAGE':
      return applyDamage(effect.targetPlayerId, effect.value, gameState);
    case 'HEALING':
      return applyHealing(effect.targetPlayerId, effect.value, gameState);
    case 'BUILD_SHIP':
      return buildShip(effect.targetShipType, effect.targetPlayerId, gameState);
    case 'DESTROY_SHIP':
      return destroyShip(effect.targetShipId, gameState);
    case 'TRANSFORM_SHIP':
      return transformShip(effect.targetShipId, effect.targetShipType, gameState);
    case 'GENERATE_LINES':
      return addLines(effect.targetPlayerId, effect.value, gameState);
    case 'GENERATE_JOINING_LINES':
      return addJoiningLines(effect.targetPlayerId, effect.value, gameState);
    case 'SET_HEALTH':
      return setHealth(effect.targetPlayerId, effect.value, gameState);
    case 'STEAL_SHIP':
      return stealShip(effect.targetShipId, effect.targetPlayerId, gameState);
    default:
      console.error(`Unknown effect type: ${effect.effectType}`);
      return gameState;
  }
}
```

---

## 🧪 Test Cases

### Test 1: TriggeredEffect Persists After Ship Destroyed
```typescript
// Setup: Build Orbital (gains 1 line when built)
// Action: Opponent destroys Orbital before End of Turn
// Expected: TriggeredEffect still resolves, player gains 1 line
// Verification: persistsIfSourceDestroyed = true
```

### Test 2: EvaluatedEffect Requires Ship Alive
```typescript
// Setup: Xenite exists at start of turn
// Action: Destroy Xenite before End of Turn Resolution
// Expected: NO EvaluatedEffect for Xenite (filtered upstream)
// Verification: Destroyed ships excluded from evaluation
```

### Test 3: Player-Wide Modifier Uses sourceType 'player'
```typescript
// Setup: Hive power gives +1 damage to all ships
// Expected: sourceType = 'player', applies to all ships
// Verification: sourceShipId is placeholder, not specific ship
```

### Test 4: Global Modifier Uses sourceType 'global'
```typescript
// Setup: Chronoswarm active (all players get +1 build discount)
// Expected: sourceType = 'global', applies to both players
// Verification: sourcePlayerId empty, affects entire game
```

### Test 5: EffectType Supports BUILD_SHIP
```typescript
// Setup: Charge power builds Xenite
// Action: Use charge
// Expected: TriggeredEffect { effectType: 'BUILD_SHIP', targetShipType: 'XEN' }
// Verification: Not limited to DAMAGE/HEAL
```

---

## 📐 Effect Resolution Flow

### End of Turn Resolution

```typescript
function resolveEndOfTurn(gameState: GameState): GameState {
  // 1. Resolve triggered effects (persisted from earlier)
  gameState = resolveTriggeredEffects(gameState.triggeredEffects, gameState);
  
  // 2. Evaluate continuous effects (computed now)
  const evaluatedEffects = evaluateContinuousEffects(gameState);
  
  // 3. Apply evaluated effects (ephemeral)
  gameState = applyEffects(evaluatedEffects, gameState);
  
  // 4. Check for destruction (UPON_DESTRUCTION hooks)
  gameState = processDestructions(gameState);
  
  // 5. Clear triggered effects (already resolved)
  gameState.triggeredEffects = [];
  
  // 6. Check victory condition
  gameState = checkVictory(gameState);
  
  return gameState;
}
```

---

## 📝 Implementation Checklist

### TriggeredEffect Creation
- [ ] Set persistsIfSourceDestroyed correctly (true for once-only/charges)
- [ ] Store in game state until End of Turn
- [ ] Use EffectType (not narrow DAMAGE/HEAL)
- [ ] Set sourceType appropriately (ship/player/global)

### TriggeredEffect Resolution
- [ ] Check persistsIfSourceDestroyed before canceling
- [ ] Apply all effect types (not just DAMAGE/HEAL)
- [ ] Clear after resolution (don't persist to next turn)

### EvaluatedEffect Creation
- [ ] Compute at End of Turn Resolution time (not earlier)
- [ ] Filter destroyed ships upstream (requiresShipAlive is informational)
- [ ] Do NOT store in game state (ephemeral)
- [ ] Recompute fresh each turn

### EvaluatedEffect Resolution
- [ ] Apply immediately (no delay)
- [ ] Trust upstream ship survival filter
- [ ] Support all EffectType values

### sourceType Usage
- [ ] Default to 'ship' for per-ship effects
- [ ] Use 'player' for player-wide modifiers
- [ ] Use 'global' for game-wide rules
- [ ] Avoid 'continuous' (legacy, prefer 'ship')

---

## 🎯 Summary

**TriggeredEffect** = Created during turn, persisted, resolved later  
**EvaluatedEffect** = Computed at resolution time, ephemeral  
**EffectType** = Aligned with ActionTypes, supports all effects  
**sourceType** = Distinguishes ship/player/global origin  

**Critical Rules:**
1. TriggeredEffect persists, EvaluatedEffect does not
2. persistsIfSourceDestroyed for once-only/charges only
3. requiresShipAlive is informational (upstream filter)
4. EffectType supports all effect types (not just DAMAGE/HEAL)
5. sourceType prevents engine from being painted into corners

---

**This document is normative - follow it exactly to prevent effect resolution bugs.**
