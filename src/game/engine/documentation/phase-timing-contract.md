# Phase & Timing Contract - Critical Rules for Engine Implementation

**Date:** 2024-12-23  
**Purpose:** Define precise semantics for ShipPowerPhase and PowerTiming to prevent engine bugs  
**Audience:** Future developers implementing game phases and power execution

---

## 🎯 Core Principle

**ShipPowerPhase** and **PowerTiming** serve different purposes:
- **Phase** = WHEN in the turn structure to check for this power
- **Timing** = HOW OFTEN and UNDER WHAT CONDITIONS the power fires

**CRITICAL:** Do NOT conflate phase iteration with timing execution.

---

## 📋 ShipPowerPhase Semantics

### Iterable Phases (Scheduled by Engine)

These phases are **iterated** by the game engine in order:

#### Build Phase
1. `DICE_ROLL` - Roll dice at start of turn
2. `LINE_GENERATION` - Add lines based on dice
3. `SHIPS_THAT_BUILD` - Activate ships with build powers
4. `DRAWING` - Build/upgrade ships
5. `END_OF_BUILD` - Final build phase effects

#### Battle Phase
6. `FIRST_STRIKE` - Charge-based powers before simultaneous
7. `SIMULTANEOUS_DECLARATION` - Both players secretly declare charges
8. `CONDITIONAL_RESPONSE` - Response powers (if charges were used)

#### End of Turn
9. `AUTOMATIC` - Continuous effects, resolved simultaneously

**Engine Contract:**
- These phases are **scheduled** by GamePhasesEngine
- Powers with these phases are **checked** during that phase
- Timing determines whether they **execute**

### Special Phases (NOT Iterable)

These are **NOT phases** in the scheduling sense - they are hooks or modifiers:

#### `EVENT`
**Purpose:** Event-driven hooks (destruction, completion, ship build triggers)  
**When fired:** NOT scheduled - fires when event occurs  
**Examples:** 
- UPON_DESTRUCTION: Zenith makes 3 Xenites when destroyed
- ON_SHIP_COMPLETED: Dreadnought triggers when ships built

**Engine Contract:**
- **DO NOT** iterate `EVENT` as a phase
- **DO NOT** schedule `EVENT` in phase progression
- **DO** fire when `handleShipDestroyed()` or similar events occur
- Event handlers must check `timing === UPON_DESTRUCTION` to filter

#### `DICE_MANIPULATION`
**Purpose:** Modify dice roll before line generation  
**When fired:** During DICE_ROLL phase, before applying results  
**Examples:** 
- Ark of Knowledge: Reroll dice
- Leviathan: Force dice to 6

**Engine Contract:**
- Check PassiveModifiers during DICE_ROLL
- Apply modifications before LINE_GENERATION
- NOT a separate iterable phase

#### `PASSIVE`
**Purpose:** Rule modifiers queried by validators  
**When fired:** NEVER - these are queries, not executors  
**Examples:**
- Hive: Ships in upgrades count
- Sacrificial Pool: Ships cannot be destroyed
- Science Vessel (1+): Double healing

**Engine Contract:**
- **DO NOT** execute passive powers
- **DO** query PassiveModifiers when validating actions
- PassiveModifiers return information, not effects

---

## ⏱️ PowerTiming Semantics

### CONTINUOUS
**Fires:** Every turn during its phase  
**Requires:** Ship must be alive at time of resolution  
**Example:** Defender heals 3 every turn

**Engine Contract:**
```typescript
if (power.timing === PowerTiming.CONTINUOUS) {
  if (ship.isDepleted) return; // Skip if destroyed
  if (gameState.currentPhase !== power.phase) return; // Skip if wrong phase
  executePower(power, context); // Execute
}
```

### ONCE_ONLY_AUTOMATIC
**Fires:** Once, on turn built, during its phase  
**Persists:** Effect persists even if ship destroyed before resolution  
**Example:** Orbital gives 1 line when built

**Engine Contract:**
```typescript
if (power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC) {
  if (ship.createdOnTurn !== currentTurn) return; // Only on build turn
  
  const alreadyUsed = ship.powerUsageHistory.some(
    usage => usage.powerIndex === power.powerIndex
  );
  if (alreadyUsed) return; // Only fires once
  
  executePower(power, context); // Execute even if ship destroyed later
  recordUsage(ship, power); // Mark as used
}
```

**CRITICAL:** Ship destruction after power fires does NOT prevent effect.

### UPON_DESTRUCTION
**Fires:** When ship is destroyed  
**Requires:** phase === EVENT (not scheduled)  
**Example:** Zenith makes 3 Xenites when destroyed

**Engine Contract:**
```typescript
function handleShipDestroyed(ship: ShipInstance) {
  const shipDef = getShipById(ship.definitionId);
  
  // Find UPON_DESTRUCTION powers
  const destructionPowers = shipDef.powers.filter(
    p => p.timing === PowerTiming.UPON_DESTRUCTION
  );
  
  // Execute each destruction power
  destructionPowers.forEach(power => {
    executePower(power, context); // Always fires
  });
  
  // Then mark ship as destroyed
  ship.isDepleted = true;
}
```

**CRITICAL:** Destruction powers fire **before** ship is marked destroyed.

### PASSIVE
**Fires:** NEVER (query-based)  
**Used by:** Validators, not executors  
**Example:** Leviathan forces dice to 6

**Engine Contract:**
```typescript
// ❌ WRONG: Trying to execute passive
if (power.timing === PowerTiming.PASSIVE) {
  executePower(power, context); // NO! Passives don't execute
}

// ✅ CORRECT: Query passive in validator
function rollDice(playerId: string, gameState: GameState): number {
  const override = PassiveModifiers.getDiceRollOverride(playerId, gameState);
  if (override !== null) return override; // Leviathan forces 6
  
  return Math.floor(Math.random() * 6) + 1; // Normal roll
}
```

---

## 🚨 Critical Architectural Rules

### Rule 1: EVENT Phase is NOT Iterable

**Problem:** If you iterate `ShipPowerPhase.EVENT`, destruction powers will fire every turn.

**Solution:**
```typescript
// ❌ WRONG
const ALL_PHASES = Object.values(ShipPowerPhase);
ALL_PHASES.forEach(phase => {
  executePhase(phase); // Will execute EVENT as a phase!
});

// ✅ CORRECT
const ITERABLE_PHASES = [
  ShipPowerPhase.DICE_ROLL,
  ShipPowerPhase.LINE_GENERATION,
  // ... rest of scheduled phases
  // EVENT, DICE_MANIPULATION, PASSIVE are NOT here
];
```

### Rule 2: DRAWING Phase is Overloaded

**Context 1:** "When built" effects (ONCE_ONLY_AUTOMATIC)
```typescript
// Orbital: When built, gain 1 line
{
  phase: ShipPowerPhase.DRAWING,
  timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
  effectType: PowerEffectType.GAIN_LINES
}
```

**Context 2:** "Each future build phase" effects (CONTINUOUS)
```typescript
// Zenith: Each future build phase, dice conditional
{
  phase: ShipPowerPhase.SHIPS_THAT_BUILD,
  timing: PowerTiming.CONTINUOUS,
  effectType: PowerEffectType.CONDITIONAL
}
```

**Engine Contract:**
- During DRAWING phase, check **all ships**
- ONCE_ONLY_AUTOMATIC fires if `ship.createdOnTurn === currentTurn`
- CONTINUOUS fires every turn (if ship alive)

### Rule 3: SIMULTANEOUS_DECLARATION Requires Readiness Gating

**Problem:** Both players must act secretly, then reveal together.

**Engine Contract:**
```typescript
// During SIMULTANEOUS_DECLARATION phase
function handleSimultaneousDeclaration(gameState: GameState): GameState {
  // 1. Both players select charges in secret (UI buffers actions)
  // 2. When both click "Ready", reveal simultaneously
  // 3. THEN execute SIMULTANEOUS_DECLARATION powers
  
  if (!bothPlayersReady(gameState)) {
    return gameState; // Wait for both players
  }
  
  // Both ready - now execute
  return executeSimultaneousDeclaration(gameState);
}
```

**CRITICAL:** Actions are **buffered**, not executed immediately.

### Rule 4: Destruction Ordering is Critical

**Order:**
1. Ship takes lethal damage
2. Mark ship for destruction (don't mutate yet)
3. Fire UPON_DESTRUCTION powers
4. Queue destruction effects
5. Then mark ship as destroyed
6. Then remove from active ships

**Why:** If you destroy first, UPON_DESTRUCTION powers won't find the ship.

**Engine Contract:**
```typescript
function applyDamage(ship: ShipInstance, amount: number): GameState {
  ship.health -= amount;
  
  if (ship.health <= 0) {
    // 1. Mark for destruction (but don't destroy yet)
    const markedForDestruction = [...markedShips, ship];
    
    // 2. Fire UPON_DESTRUCTION powers
    const destructionEffects = getPowersWithTiming(ship, PowerTiming.UPON_DESTRUCTION);
    destructionEffects.forEach(power => queueEffect(power));
    
    // 3. NOW mark as destroyed
    ship.isDepleted = true;
  }
  
  return gameState;
}
```

### Rule 5: FIRST_STRIKE Readiness - Auto-Ready for Players Without Charges

**Problem:** First Strike only applies to players with charge-based ships.

**Engine Contract:**
```typescript
function handleFirstStrikePhase(gameState: GameState): GameState {
  const player1HasCharges = hasAnyChargeShips(gameState.player1.ships);
  const player2HasCharges = hasAnyChargeShips(gameState.player2.ships);
  
  // Auto-ready players without First Strike actions
  if (!player1HasCharges) {
    gameState.player1.isReady = true;
  }
  if (!player2HasCharges) {
    gameState.player2.isReady = true;
  }
  
  // Wait for both players ready (or auto-readied)
  if (!gameState.player1.isReady || !gameState.player2.isReady) {
    return gameState; // Not ready yet
  }
  
  // Both ready - execute First Strike
  return executeFirstStrike(gameState);
}
```

**CRITICAL:** This rule is NOT encoded in ship data - it's engine behavior.

### Rule 6: DRAWING Phase Dual-Use Semantics

**Context 1:** "When built" effects (ONCE_ONLY_AUTOMATIC)
- Fires once on the turn the ship is built
- Timing: ONCE_ONLY_AUTOMATIC
- Example: Orbital gains 1 line when built

**Context 2:** "Each future build phase" effects (CONTINUOUS)
- Fires every turn during DRAWING phase
- Timing: CONTINUOUS
- Example: Zenith's dice conditional fires every build phase

**Engine Contract:**
```typescript
function executeDrawingPhase(gameState: GameState): GameState {
  // Get all ships with DRAWING phase powers
  const allShips = getAllPlayerShips(gameState);
  
  allShips.forEach(ship => {
    const shipDef = getShipById(ship.definitionId);
    const drawingPowers = shipDef.powers.filter(p => p.phase === ShipPowerPhase.DRAWING);
    
    drawingPowers.forEach(power => {
      if (power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC) {
        // Only fires on turn built, only once
        if (ship.createdOnTurn === gameState.turnNumber) {
          const alreadyUsed = ship.powerUsageHistory.some(
            u => u.powerIndex === power.powerIndex
          );
          if (!alreadyUsed) {
            executePower(power, context);
            recordUsage(ship, power);
          }
        }
      } else if (power.timing === PowerTiming.CONTINUOUS) {
        // Fires every turn (if ship alive)
        if (!ship.isDepleted) {
          executePower(power, context);
        }
      }
    });
  });
  
  return gameState;
}
```

**CRITICAL:** DRAWING is evaluated:
1. Once immediately after build completion (ONCE_ONLY)
2. Again in every future build phase (CONTINUOUS)

### Rule 7: ONCE_ONLY_AUTOMATIC Requires State Tracking

**Problem:** ONCE_ONLY powers must track usage per ship instance.

**Engine Contract:**
```typescript
interface ShipInstance {
  // ... other fields
  powerUsageHistory: PowerUsageRecord[];
}

interface PowerUsageRecord {
  turn: number;
  powerIndex: number;
  phase: ShipPowerPhase;
  effect: string;
  amount?: number;
}

function shouldFireOnceOnlyPower(ship: ShipInstance, power: ShipPower): boolean {
  // Must be built this turn
  if (ship.createdOnTurn !== currentTurn) return false;
  
  // Must not have fired already
  const alreadyUsed = ship.powerUsageHistory.some(
    usage => usage.powerIndex === power.powerIndex
  );
  
  return !alreadyUsed;
}
```

**CRITICAL:** 
- Track usage per ship instance, not per definition
- Never reset (ships built later get fresh tracking)
- Persists even if ship destroyed after firing

### Rule 8: CONDITIONAL vs CUSTOM Effect Types

**CONDITIONAL:**
- Structured branching based on game state
- Still resolves into standard effects (HEAL, DEAL_DAMAGE, BUILD_SHIP, etc.)
- Example: Defense Swarm heals 3 OR 7 based on health comparison

**CUSTOM:**
- Complex logic requiring special handler
- Still resolves into standard effects
- Example: Science Vessel multipliers, Ark of Knowledge scaling

**Engine Contract:**
```typescript
function executePower(power: ShipPower, context: PowerExecutionContext): GameState {
  if (power.effectType === PowerEffectType.CONDITIONAL) {
    // Evaluate condition, then execute standard effect
    const effect = evaluateConditional(power, context);
    return executeStandardEffect(effect, context);
  }
  
  if (power.effectType === PowerEffectType.CUSTOM) {
    // Route to special logic, but expect standard effects back
    const effects = SpecialLogic.handle(power.specialLogic.customLogicId, context);
    return executeStandardEffects(effects, context);
  }
  
  // Standard effect
  return executeStandardEffect(power, context);
}
```

**CRITICAL:**
- CONDITIONAL ≠ arbitrary branching
- CUSTOM ≠ freeform side effects
- Both must return standard effect types

### Rule 9: PASSIVE Powers - Query Only, Never Execute

**Problem:** Passive powers modify rules, they don't generate effects.

**Engine Contract:**
```typescript
// ❌ WRONG: Trying to execute passive
function executePhase(phase: ShipPowerPhase, gameState: GameState): GameState {
  const allPowers = getAllPowersForPhase(phase);
  
  allPowers.forEach(power => {
    executePower(power, context); // Will try to execute PASSIVE!
  });
}

// ✅ CORRECT: Query passive in validator
function calculateHealing(playerId: string, baseHealing: number, gameState: GameState): number {
  const multiplier = PassiveModifiers.getHealingMultiplier(playerId, gameState);
  return baseHealing * multiplier; // Science Vessel doubles healing
}

function canDestroyShip(shipId: string, gameState: GameState): boolean {
  const isProtected = PassiveModifiers.isShipProtectedFromDestruction(shipId, gameState);
  return !isProtected; // Sacrificial Pool prevents destruction
}
```

**CRITICAL:**
- PASSIVE powers have `timing: PowerTiming.PASSIVE`
- Never call `executePower()` on passive powers
- Always query via PassiveModifiers system
- Passive modifiers return information, not effects

### Rule 10: PASSIVE Powers Must Not Have baseAmount

**Validation Rule:**
```typescript
function validateShipDefinition(ship: ShipDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  
  ship.powers.forEach(power => {
    if (power.timing === PowerTiming.PASSIVE && power.baseAmount !== undefined) {
      errors.push({
        shipId: ship.id,
        powerIndex: power.powerIndex,
        error: 'PASSIVE powers must not have baseAmount (they are queries, not effects)'
      });
    }
  });
  
  return errors;
}
```

**CRITICAL:**
- Passive powers are rule modifiers, not effect generators
- baseAmount implies execution, which passives never do
- If you need a value, use specialLogic configuration

---

## 📐 Phase/Timing Matrix

| Phase | CONTINUOUS | ONCE_ONLY | UPON_DESTRUCTION | PASSIVE |
|-------|------------|-----------|------------------|---------|
| DICE_ROLL | ✅ Check modifiers | ❌ N/A | ❌ N/A | ✅ Query override |
| SHIPS_THAT_BUILD | ✅ Execute | ✅ If built this turn | ❌ N/A | ✅ Query restrictions |
| DRAWING | ✅ Execute | ✅ If built this turn | ❌ N/A | ❌ N/A |
| AUTOMATIC | ✅ Execute | ✅ If built this turn | ❌ N/A | ✅ Query multipliers |
| EVENT | ❌ NOT A PHASE | ❌ NOT A PHASE | ✅ Execute on event | ❌ N/A |
| PASSIVE | ❌ NOT A PHASE | ❌ NOT A PHASE | ❌ NOT A PHASE | ✅ Always query |

---

## 🧪 Test Cases for Validation

### Test 1: Zenith Destruction (EVENT + UPON_DESTRUCTION)
```typescript
// Setup: Zenith in play
// Action: Destroy Zenith with Guardian charge
// Expected: 3 Xenites created BEFORE Zenith removed
// Failure mode: Xenites not created, or only 2 created
```

### Test 2: Orbital Once-Only (DRAWING + ONCE_ONLY_AUTOMATIC)
```typescript
// Setup: Build Orbital turn 1
// Action: Complete turn 1, start turn 2
// Expected: 1 line gained turn 1, 0 lines turn 2
// Failure mode: Orbital fires every turn
```

### Test 3: Leviathan Passive (PASSIVE + DICE_ROLL)
```typescript
// Setup: Leviathan in play
// Action: Roll dice
// Expected: Dice result = 6 (forced by Leviathan)
// Failure mode: Normal 1-6 roll
```

### Test 4: Science Vessel Multiplier (PASSIVE + AUTOMATIC)
```typescript
// Setup: 1 Science Vessel, 1 Defender
// Action: End of Turn Resolution
// Expected: Defender healing doubled (6 instead of 3)
// Failure mode: Normal healing (3)
```

---

## 📝 Implementation Checklist

### Phase Engine
- [ ] Only iterate SCHEDULED phases (not EVENT, PASSIVE, DICE_MANIPULATION)
- [ ] Check timing during phase execution
- [ ] Query PassiveModifiers during DICE_ROLL
- [ ] Buffer actions during SIMULTANEOUS_DECLARATION
- [ ] Wait for both players ready before executing

### Power Executor
- [ ] Check `timing` before executing
- [ ] Skip CONTINUOUS if ship destroyed
- [ ] Execute ONCE_ONLY even if ship destroyed later
- [ ] Never execute PASSIVE (query only)
- [ ] Fire UPON_DESTRUCTION in handleShipDestroyed()

### Destruction Handler
- [ ] Fire UPON_DESTRUCTION powers before marking destroyed
- [ ] Queue effects before removing ship
- [ ] Persist effects even after ship removed
- [ ] Check persistsIfSourceDestroyed flag

### Passive Modifiers
- [ ] Never execute effects
- [ ] Return query results only
- [ ] Called by validators, not executors
- [ ] Check ship alive/active state

---

## 🎯 Summary

**Phase** = Scheduling (when to check)  
**Timing** = Execution (how often to fire)  
**EVENT** = Not a phase (event-driven)  
**PASSIVE** = Not an executor (query-based)

**Critical Rules:**
1. Don't iterate EVENT, PASSIVE, or DICE_MANIPULATION
2. ONCE_ONLY persists even if ship destroyed
3. UPON_DESTRUCTION fires before ship removed
4. PASSIVE is queried, never executed
5. SIMULTANEOUS_DECLARATION requires readiness gating

---

**This document is normative - follow it exactly to prevent engine bugs.**