# 🔒 ShapeShips Rules Engine - System Constraints

## CRITICAL: Read This First

This document defines **non-negotiable constraints** for the ShapeShips rules engine.

If an implementation violates ANY of these constraints, **it is incorrect** and must be rejected.

---

## Hard Constraints

### Constraint 1: Three Turn Stages (No More, No Less)

```
There are exactly THREE turn stages:
1. Build Phase
2. Battle Phase  
3. End of Turn Resolution

There is NO "Automatic Phase" as a separate stage.
```

**Why this matters:**
- "Automatic" is a property of a step, not a phase itself
- Violating this creates conceptual confusion and bugs

**Invalid implementations:**
```typescript
// ❌ WRONG
enum Phase {
  BUILD_PHASE,
  AUTOMATIC_PHASE, // No! This doesn't exist
  BATTLE_PHASE,
  END_OF_TURN
}
```

**Valid implementations:**
```typescript
// ✅ RIGHT
enum MajorPhase {
  BUILD_PHASE,
  BATTLE_PHASE,
  END_OF_TURN_RESOLUTION
}

// Steps can be automatic or interactive
interface PhaseStep {
  name: string;
  isAutomatic: boolean; // ← Property, not a phase
}
```

---

### Constraint 2: Health Only Changes at End of Turn Resolution

```
All damage and healing from all sources resolve ONLY during End of Turn Resolution.
Health never changes mid-turn.
```

**Why this matters:**
- Prevents race conditions
- Simplifies win/loss checking
- Matches tabletop rules intent

**Invalid implementations:**
```typescript
// ❌ WRONG - Health changes during Build Phase
function buildShip(ship) {
  if (ship.onCompletion.type === 'DAMAGE') {
    opponent.health -= ship.onCompletion.value; // No!
  }
}

// ❌ WRONG - Health changes during Battle Phase
function useCharge(charge) {
  target.health -= charge.damage; // No!
}
```

**Valid implementations:**
```typescript
// ✅ RIGHT - Build Phase queues effect
function buildShip(ship) {
  if (ship.onCompletion.type === 'DAMAGE') {
    gameState.triggeredEffects.push({
      type: 'DAMAGE',
      value: ship.onCompletion.value,
      // Will resolve at End of Turn
    });
  }
}

// ✅ RIGHT - Battle Phase queues effect
function useCharge(charge) {
  gameState.triggeredEffects.push({
    type: 'DAMAGE',
    value: charge.damage,
    // Will resolve at End of Turn
  });
}

// ✅ RIGHT - End of Turn applies all effects
function resolveEndOfTurn() {
  for (const effect of gameState.triggeredEffects) {
    if (effect.type === 'DAMAGE') {
      target.health -= effect.value; // OK - only place this happens
    }
  }
}
```

---

### Constraint 3: Battle Phase Uses Simultaneous Commitments

```
Battle actions are simultaneous and secret.
Both players submit hidden declarations, then reveal simultaneously.
If any actions were declared, both players get exactly ONE simultaneous response.
There is no priority, no loop, and no reacting to revealed information.
```

**Why this matters:**
- Preserves bluffing and simultaneous play
- Prevents infinite loops
- Matches tabletop card game mechanics

**Invalid implementations:**
```typescript
// ❌ WRONG - Sequential actions
function battlePhase() {
  const playerAAction = waitForPlayerAction(playerA);
  revealAction(playerAAction);
  const playerBResponse = waitForPlayerAction(playerB); // No!
}

// ❌ WRONG - Looping responses
function battlePhase() {
  while (anyPlayerHasActions()) { // No!
    processActions();
  }
}

// ❌ WRONG - Priority system
function battlePhase() {
  actions.sort((a, b) => a.priority - b.priority); // No!
  for (const action of actions) {
    resolveAction(action);
  }
}
```

**Valid implementations:**
```typescript
// ✅ RIGHT - Simultaneous hidden commitments
function simultaneousDeclaration() {
  // Both players submit hidden
  const playerAActions = waitForHiddenSubmit(playerA);
  const playerBActions = waitForHiddenSubmit(playerB);
  
  // Reveal simultaneously
  reveal(playerAActions, playerBActions);
  
  // Check if response needed
  if (anyActionsWereSubmitted()) {
    conditionalResponse(); // Exactly once
  }
}

function conditionalResponse() {
  // Both players submit hidden (one time only)
  const playerAResponse = waitForHiddenSubmit(playerA);
  const playerBResponse = waitForHiddenSubmit(playerB);
  
  // Reveal simultaneously
  reveal(playerAResponse, playerBResponse);
  
  // No further responses - proceed to End of Turn
}
```

---

### Constraint 4: Once-Only Effects Persist After Source Destruction

```
Once-only effects trigger earlier but resolve at End of Turn Resolution.
Once triggered, once-only effects resolve even if the source ship is destroyed.
```

**Why this matters:**
- Matches tabletop rules ("upon completion" happens even if ship destroyed later)
- Creates meaningful tactical decisions

**Invalid implementations:**
```typescript
// ❌ WRONG - Checking if ship still exists
function resolveEndOfTurn() {
  for (const effect of triggeredEffects) {
    const ship = findShip(effect.sourceShipId);
    if (!ship.isDestroyed) { // No! Wrong for once-only
      applyEffect(effect);
    }
  }
}
```

**Valid implementations:**
```typescript
// ✅ RIGHT - Check persistsIfSourceDestroyed flag
function resolveEndOfTurn() {
  for (const effect of triggeredEffects) {
    if (effect.persistsIfSourceDestroyed) {
      applyEffect(effect); // Always apply
    } else {
      const ship = findShip(effect.sourceShipId);
      if (!ship.isDestroyed) {
        applyEffect(effect);
      }
    }
  }
}

// Example: Once-only effect
const onceOnlyEffect: TriggeredEffect = {
  type: 'DAMAGE',
  value: 5,
  persistsIfSourceDestroyed: true, // ← Key property
  triggeredAt: 'build_phase'
};
```

---

### Constraint 5: Continuous Effects Require Ship Survival

```
Continuous automatic effects only apply if the ship survives to End of Turn Resolution.
```

**Why this matters:**
- "Each turn" effects logically require the source to exist
- Balances destroyed ships

**Invalid implementations:**
```typescript
// ❌ WRONG - Applying continuous effect from destroyed ship
function resolveEndOfTurn() {
  for (const ship of allShips) {
    for (const power of ship.continuousPowers) {
      applyEffect(power); // No! Need to check if ship alive
    }
  }
}
```

**Valid implementations:**
```typescript
// ✅ RIGHT - Check ship survival first
function resolveEndOfTurn() {
  for (const ship of allShips) {
    if (ship.isDestroyed || ship.isConsumedInUpgrade) {
      continue; // Skip destroyed ships
    }
    
    for (const power of ship.continuousPowers) {
      applyEffect(power); // OK - ship is alive
    }
  }
}
```

---

### Constraint 6: No Numeric Phase Indices

```
Do not use numeric phase indices (0, 1, 2, 3...).
Use named enums and step identifiers.
```

**Why this matters:**
- Prevents off-by-one errors
- Makes code self-documenting
- Easier to insert new steps

**Invalid implementations:**
```typescript
// ❌ WRONG - Magic numbers
const DICE_ROLL = 0;
const LINE_GENERATION = 1;
const AUTOMATIC = 2; // What does "2" mean?

if (currentPhase === 2) {
  // ???
}
```

**Valid implementations:**
```typescript
// ✅ RIGHT - Named enums
enum MajorPhase {
  BUILD_PHASE = 'build_phase',
  BATTLE_PHASE = 'battle_phase',
  END_OF_TURN_RESOLUTION = 'end_of_turn_resolution'
}

enum BuildPhaseStep {
  DICE_ROLL = 'dice_roll',
  LINE_GENERATION = 'line_generation',
  SHIPS_THAT_BUILD = 'ships_that_build',
  // ...
}

if (currentStep === BuildPhaseStep.DICE_ROLL) {
  // Clear and self-documenting
}
```

---

## Implementation Validation Checklist

Before committing any rules engine code, verify:

- [ ] Does it use exactly 3 major phases? (Build, Battle, End of Turn)
- [ ] Does health only change in End of Turn Resolution?
- [ ] Does Battle Phase use simultaneous hidden commitments?
- [ ] Do once-only effects persist after source destruction?
- [ ] Do continuous effects require ship survival?
- [ ] Are all phases/steps using named enums (not numbers)?
- [ ] Are effects queued during Build/Battle and resolved at End of Turn?
- [ ] Is there no "Automatic Phase" as a separate stage?

**If ANY answer is "no", the implementation is incorrect.**

---

## Error Messages for Violations

If you detect a constraint violation, use these error messages:

### Violation of Constraint 1:
```
Error: Invalid phase structure detected.
ShapeShips has exactly 3 major phases: Build, Battle, End of Turn Resolution.
"Automatic" is not a phase - it's a property of steps.
```

### Violation of Constraint 2:
```
Error: Health modification outside End of Turn Resolution detected.
All damage and healing must be queued as TriggeredEffects and resolved
only during End of Turn Resolution.
```

### Violation of Constraint 3:
```
Error: Sequential Battle Phase actions detected.
Battle Phase must use simultaneous hidden commitments.
Both players submit secretly, then reveal together.
```

### Violation of Constraint 4:
```
Error: Once-only effect incorrectly skipped when source destroyed.
Once-only effects must have persistsIfSourceDestroyed = true
and resolve even if source ship is destroyed before End of Turn.
```

### Violation of Constraint 5:
```
Error: Continuous effect applied from destroyed ship.
Continuous effects require ship.isDestroyed === false at
End of Turn Resolution.
```

### Violation of Constraint 6:
```
Error: Numeric phase indices detected.
Use named enums (MajorPhase, BuildPhaseStep, BattlePhaseStep)
instead of magic numbers.
```

---

## Safe Implementation Patterns

### Pattern 1: Effect Queueing

```typescript
// During Build/Battle Phase
function triggerEffect(effect: TriggeredEffect) {
  gameState.turnData.triggeredEffects.push(effect);
  // NO health changes here
}

// During End of Turn Resolution
function resolveTriggeredEffects() {
  for (const effect of gameState.turnData.triggeredEffects) {
    applyHealthChange(effect); // ONLY here
  }
}
```

### Pattern 2: Battle Commitments

```typescript
// Step 1: Hidden submission
const commitments: BattleCommitmentState = {
  declaration: {},
  declarationRevealed: false
};

// Player A submits (hidden)
commitments.declaration[playerA.id] = { charges: [...], solarPowers: [...] };

// Player B submits (hidden)
commitments.declaration[playerB.id] = { charges: [...], solarPowers: [...] };

// Step 2: Reveal
commitments.declarationRevealed = true;

// Step 3: Process (create triggered effects)
for (const playerId in commitments.declaration) {
  processCommitment(commitments.declaration[playerId]);
}
```

### Pattern 3: Effect Type Checking

```typescript
function resolveEffect(effect: TriggeredEffect | EvaluatedEffect) {
  // Check if triggered or evaluated
  if ('persistsIfSourceDestroyed' in effect) {
    // TriggeredEffect
    if (effect.persistsIfSourceDestroyed) {
      applyEffect(effect); // Always apply
    } else {
      // Check ship alive
      if (!ship.isDestroyed) {
        applyEffect(effect);
      }
    }
  } else {
    // EvaluatedEffect - already checked ship alive
    applyEffect(effect);
  }
}
```

---

## Final Word

**These constraints are non-negotiable.**

They exist because:
1. They match the tabletop game design intent
2. They prevent entire classes of bugs
3. They keep the codebase maintainable
4. They make the rules engine predictable

If you're tempted to violate a constraint, **stop and reconsider your approach**.

There is always a way to implement your feature within these constraints.
