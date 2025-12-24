# Quick Reference - ShapeShips Action Resolution

## 🚀 Quick Start

**New to this codebase? Start here:**

1. Read `SYSTEM_CONSTRAINTS.md` (5 minutes) - Learn what you CANNOT do
2. Skim `IMPLEMENTATION_SUMMARY.md` (10 minutes) - Understand the architecture
3. Reference this page when coding

---

## The Three Commandments

### 1. Health Only Changes at End of Turn

```typescript
// ❌ NEVER DO THIS
player.health -= damage;

// ✅ ALWAYS DO THIS
gameState.turnData.triggeredEffects.push({
  effectType: 'DAMAGE',
  value: damage,
  persistsIfSourceDestroyed: true
});
```

### 2. Battle = Simultaneous Hidden Commitments

```typescript
// ❌ NEVER DO THIS
const actionA = waitFor(playerA);
reveal(actionA);
const actionB = waitFor(playerB);

// ✅ ALWAYS DO THIS
const actions = {
  [playerA.id]: waitForHidden(playerA),
  [playerB.id]: waitForHidden(playerB)
};
revealSimultaneously(actions);
```

### 3. Use Named Enums, Not Numbers

```typescript
// ❌ NEVER DO THIS
if (phase === 2) { }

// ✅ ALWAYS DO THIS
if (currentStep === BuildPhaseStep.SHIPS_THAT_BUILD) { }
```

---

## Common Tasks

### Creating a Triggered Effect

```typescript
import { TriggeredEffect } from '../types/BattleTypes';

const effect: TriggeredEffect = {
  id: `effect-${shipId}-${Date.now()}`,
  sourceShipId: shipId,
  sourcePlayerId: playerId,
  targetPlayerId: opponentId,
  effectType: 'DAMAGE', // or 'HEAL'
  value: 5,
  persistsIfSourceDestroyed: true, // Most effects
  description: 'Interceptor charge: 5 damage',
  triggeredAt: new Date().toISOString()
};

gameState.turnData.triggeredEffects.push(effect);
```

### Processing Battle Commitments

```typescript
import { actionResolver } from '../engine/ActionResolver';
import { HiddenBattleActions } from '../types/BattleTypes';

// Player declares actions (hidden)
const playerActions: HiddenBattleActions = {
  charges: [
    { shipId: 'INT', powerIndex: 0, timestamp: new Date().toISOString() }
  ],
  solarPowers: []
};

// Process when both players ready
const result = actionResolver.processBattleCommitment(
  gameState,
  playerId,
  playerActions,
  'declaration' // or 'response'
);

if (result.success) {
  // Add triggered effects to game state
  gameState.turnData.triggeredEffects.push(...result.triggeredEffects);
}
```

### Running End of Turn Resolution

```typescript
import { endOfTurnResolver } from '../engine/EndOfTurnResolver';

// At End of Turn Resolution phase
const result = endOfTurnResolver.resolveEndOfTurn(
  gameState,
  gameState.turnData.triggeredEffects
);

// Result contains:
// - healthChanges: { [playerId]: { damage, healing, netChange } }
// - shipsDestroyed: string[]
// - gameEnded: boolean
// - winner?: string

if (result.gameEnded) {
  gameState.status = 'completed';
  // Handle game end
}
```

### Checking Phase/Step

```typescript
import { MajorPhase, BuildPhaseStep, BattlePhaseStep } from '../engine/GamePhases';

const currentPhase = gameState.turnData.currentMajorPhase;
const currentStep = gameState.turnData.currentStep;

// Check major phase
if (currentPhase === MajorPhase.BUILD_PHASE) {
  // Build phase logic
}

// Check specific step
if (currentStep === BuildPhaseStep.SHIPS_THAT_BUILD) {
  // Ships That Build logic
}

if (currentStep === BattlePhaseStep.SIMULTANEOUS_DECLARATION) {
  // Declaration logic
}
```

---

## Effect Types Cheat Sheet

### Triggered Effects (Queue Early, Resolve at End)

**Properties:**
- Created during Build/Battle Phase
- Stored in `gameState.turnData.triggeredEffects`
- Applied during End of Turn Resolution
- Can persist after source ship destroyed

**Examples:**
- Once-only ship completion effects
- Charges activated in Battle Phase
- Solar Powers used in Battle Phase

**Code:**
```typescript
const effect: TriggeredEffect = {
  persistsIfSourceDestroyed: true, // Key property
  // ... other fields
};
```

### Evaluated Effects (Calculate at Resolution Time)

**Properties:**
- NOT queued early - calculated fresh at End of Turn
- Require ship to be alive at resolution
- Examples: Continuous Automatic effects

**Code:**
```typescript
// Don't create these manually - EndOfTurnResolver creates them
// during resolveEndOfTurn() by checking alive ships
```

---

## Battle Phase Windows

### Window 1: Declaration (Always)

```typescript
// Step 2 of Battle Phase
currentStep === BattlePhaseStep.SIMULTANEOUS_DECLARATION

// Both players submit hidden
// Reveal when both ready
// Branch: If any actions → Response, else → End of Turn
```

### Window 2: Response (Conditional)

```typescript
// Step 3 of Battle Phase (only if declarations made)
currentStep === BattlePhaseStep.CONDITIONAL_RESPONSE

// Both players submit hidden
// Reveal when both ready
// Then → End of Turn Resolution
```

---

## Common Pitfalls

### ❌ Pitfall: Applying effects immediately

```typescript
// Wrong
function useCharge() {
  opponent.health -= 5; // NO!
}
```

**✅ Fix:**
```typescript
function useCharge() {
  gameState.turnData.triggeredEffects.push({
    effectType: 'DAMAGE',
    value: 5,
    // ... other fields
  });
}
```

### ❌ Pitfall: Sequential Battle actions

```typescript
// Wrong
const actionA = getPlayerAction(playerA);
processAction(actionA);
const actionB = getPlayerAction(playerB); // Sequential!
```

**✅ Fix:**
```typescript
const commitments = {
  [playerA.id]: getHiddenActions(playerA),
  [playerB.id]: getHiddenActions(playerB)
};
revealAndProcess(commitments); // Simultaneous!
```

### ❌ Pitfall: Skipping once-only effects if ship destroyed

```typescript
// Wrong
if (!ship.isDestroyed) {
  applyEffect(onceOnlyEffect); // NO! Wrong for once-only
}
```

**✅ Fix:**
```typescript
if (effect.persistsIfSourceDestroyed || !ship.isDestroyed) {
  applyEffect(effect); // Check flag first
}
```

### ❌ Pitfall: Using magic numbers for phases

```typescript
// Wrong
if (phaseIndex === 2) { } // What is 2?
```

**✅ Fix:**
```typescript
if (currentStep === BuildPhaseStep.SHIPS_THAT_BUILD) { } // Clear!
```

---

## Type Import Quick Reference

```typescript
// Major enums
import { MajorPhase, BuildPhaseStep, BattlePhaseStep } from '../engine/GamePhases';

// Battle types
import { 
  HiddenBattleActions,
  ChargeDeclaration,
  SolarDeclaration,
  BattleCommitmentState,
  TriggeredEffect,
  EvaluatedEffect
} from '../types/BattleTypes';

// Engine instances
import { actionResolver } from '../engine/ActionResolver';
import { endOfTurnResolver } from '../engine/EndOfTurnResolver';

// Game types
import { GameState, PlayerShip, Player } from '../types/GameTypes';
```

---

## Decision Tree: "Where does this effect go?"

```
Is the effect...

┌─ Created during Build/Battle Phase?
│  └─ Does it persist if source ship destroyed?
│     ├─ YES → TriggeredEffect with persistsIfSourceDestroyed: true
│     └─ NO → TriggeredEffect with persistsIfSourceDestroyed: false
│
└─ Calculated at End of Turn Resolution?
   └─ Must ship be alive to generate effect?
      └─ YES → EvaluatedEffect (created by EndOfTurnResolver)
```

---

## Phase Step Reference

### Build Phase Steps

```typescript
enum BuildPhaseStep {
  DICE_ROLL = 'dice_roll',                 // Auto
  LINE_GENERATION = 'line_generation',     // Auto
  SHIPS_THAT_BUILD = 'ships_that_build',   // Interactive
  DRAWING = 'drawing',                     // Interactive
  END_OF_BUILD = 'end_of_build'            // Auto
}
```

### Battle Phase Steps

```typescript
enum BattlePhaseStep {
  FIRST_STRIKE = 'first_strike',                       // Auto
  SIMULTANEOUS_DECLARATION = 'simultaneous_declaration', // Interactive (hidden)
  CONDITIONAL_RESPONSE = 'conditional_response'         // Interactive (hidden)
}
```

### End of Turn Resolution

```typescript
enum MajorPhase {
  END_OF_TURN_RESOLUTION = 'end_of_turn_resolution' // Auto
}
// No steps - entire phase is automatic
```

---

## When to Use What

### Use `TriggeredEffect` when:
- Building a ship with "Upon Completion" effect
- Activating a Charge in Battle Phase
- Using a Solar Power
- Effect should resolve even if ship destroyed later

### Use `EvaluatedEffect` (indirectly) when:
- Ship has "Each turn" Continuous effect
- Effect should NOT resolve if ship destroyed
- EndOfTurnResolver creates these automatically

### Use `BattleCommitmentState` when:
- Managing Battle Phase actions
- Storing hidden player declarations
- Tracking Declaration vs Response window

### Use `ActionResolver` when:
- Processing player actions
- Creating triggered effects
- Validating action legality

### Use `EndOfTurnResolver` when:
- Applying all effects for the turn
- Finalizing health changes
- Checking win/loss conditions

---

## Error Messages

If you see these errors, you violated a constraint:

**"Health modification outside End of Turn Resolution detected"**
→ You changed `player.health` during Build/Battle Phase

**"Invalid phase structure detected"**
→ You created an "Automatic Phase" or used wrong enum

**"Sequential Battle Phase actions detected"**
→ You processed actions one at a time instead of simultaneously

**"Once-only effect incorrectly skipped"**
→ You skipped a once-only effect because ship was destroyed

---

## Need More Info?

**Quick questions:** Check this page

**Battle Phase details:** Read `BATTLE_PHASE_SPEC.md`

**End of Turn details:** Read `END_OF_TURN_SPEC.md`

**Hard constraints:** Read `SYSTEM_CONSTRAINTS.md`

**Architecture overview:** Read `IMPLEMENTATION_SUMMARY.md`

**Full README:** See `ACTION_RESOLUTION_README.md`
