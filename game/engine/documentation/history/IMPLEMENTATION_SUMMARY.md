# Action Resolution Implementation Summary

## What Was Implemented

This document summarizes the complete rewrite of the Action Resolution system to follow the correct Battle Phase model and End of Turn Resolution engine.

---

## Files Created/Updated

### New Type Definitions

**`/game/types/BattleTypes.tsx`** - Battle Phase commitment types
- `HiddenBattleActions` - Hidden charges and solar powers
- `ChargeDeclaration` - Single charge activation
- `SolarDeclaration` - Single solar power activation
- `BattleCommitmentState` - Complete Battle Phase state
- `TriggeredEffect` - Effects queued for End of Turn Resolution
- `EvaluatedEffect` - Effects calculated at resolution time

### New Engine Components

**`/game/engine/EndOfTurnResolver.tsx`** - End of Turn Resolution engine
- `resolveEndOfTurn()` - Main resolution algorithm
- Collects triggered effects
- Evaluates continuous effects
- Applies all effects simultaneously
- Caps health and checks win/loss

**`/game/engine/ActionResolver.tsx`** - Completely rewritten
- Removed old phase index system
- Added Battle commitment processing
- Added triggered effect creation
- Proper separation of Build/Battle/Resolution

### Updated Type Definitions

**`/game/types/GameTypes.tsx`** - Updated TurnData
- Added `triggeredEffects` field (new model)
- Added `battleCommitments` field (new model)
- Marked old fields as deprecated

### Documentation

**`/game/engine/documentation/BATTLE_PHASE_SPEC.md`** - Battle Phase specification
- Simultaneous hidden commitment model
- Exactly 2 windows max (Declaration + Response)
- No loops, no priority, no back-and-forth

**`/game/engine/documentation/END_OF_TURN_SPEC.md`** - End of Turn Resolution specification
- Triggered vs Evaluated effects
- Once-only effects persist after destruction
- Continuous effects require survival
- All effects resolve simultaneously

**`/game/engine/documentation/SYSTEM_CONSTRAINTS.md`** - Hard constraints
- Three major phases (no "Automatic Phase")
- Health only changes at End of Turn
- Battle uses simultaneous commitments
- No numeric phase indices

**`/game/engine/documentation/IMPLEMENTATION_SUMMARY.md`** - This file

---

## Core Architecture Changes

### Before (Incorrect)

```typescript
// ❌ Sequential Battle actions with priority
function battlePhase() {
  while (hasActions()) {
    const action = getNextAction();
    resolveAction(action); // Wrong: One at a time
    opponent.health -= damage; // Wrong: Health changes mid-turn
  }
}

// ❌ Automatic as a separate phase
enum Phase {
  BUILD = 0,
  AUTOMATIC = 1, // Wrong: Not a phase
  BATTLE = 2,
  RESOLUTION = 3
}
```

### After (Correct)

```typescript
// ✅ Simultaneous hidden commitments
function simultaneousDeclaration() {
  // Both players submit hidden
  const commitments = collectHiddenActions();
  
  // Reveal simultaneously
  revealActions(commitments);
  
  // Queue effects (don't apply yet)
  for (const action of commitments.allActions) {
    gameState.triggeredEffects.push(createEffect(action));
  }
}

// ✅ Three major phases with step properties
enum MajorPhase {
  BUILD_PHASE = 'build_phase',
  BATTLE_PHASE = 'battle_phase',
  END_OF_TURN_RESOLUTION = 'end_of_turn_resolution'
}

interface PhaseStep {
  name: string;
  isAutomatic: boolean; // Property, not a phase
}
```

---

## Key Algorithm: End of Turn Resolution

```typescript
function resolveEndOfTurn(gameState: GameState): EndOfTurnResult {
  const allEffects = [];
  
  // Step 1: Collect triggered effects (already queued)
  for (const effect of gameState.turnData.triggeredEffects) {
    if (effect.persistsIfSourceDestroyed) {
      allEffects.push(effect); // Always apply
    } else {
      const ship = findShip(effect.sourceShipId);
      if (ship && !ship.isDestroyed) {
        allEffects.push(effect); // Apply if ship alive
      }
    }
  }
  
  // Step 2: Evaluate continuous effects (check ship alive)
  for (const ship of allAliveShips) {
    for (const power of ship.continuousPowers) {
      allEffects.push(createEvaluatedEffect(ship, power));
    }
  }
  
  // Step 3: Apply all effects simultaneously
  const healthDeltas = tallyHealthChanges(allEffects);
  applyHealthChanges(gameState, healthDeltas);
  
  // Step 4: Cap health and check win/loss
  finalizeHealth(gameState);
  return checkGameEnd(gameState);
}
```

---

## Key Algorithm: Battle Commitments

```typescript
// Initialize at start of Battle Phase
const battleCommitments: BattleCommitmentState = {
  declaration: {},
  response: {},
  declarationRevealed: false,
  responseRevealed: false,
  anyDeclarationsMade: false
};

// Window 1: Declaration
function simultaneousDeclaration() {
  // Both players submit hidden
  battleCommitments.declaration[playerA.id] = playerAActions;
  battleCommitments.declaration[playerB.id] = playerBActions;
  
  // Reveal when both ready
  if (bothPlayersReady) {
    battleCommitments.declarationRevealed = true;
    
    // Check if any actions declared
    if (anyActions(battleCommitments.declaration)) {
      battleCommitments.anyDeclarationsMade = true;
      // Proceed to Response
    } else {
      // Skip Response, go to End of Turn
    }
  }
}

// Window 2: Conditional Response (only if declarations made)
function conditionalResponse() {
  if (!battleCommitments.anyDeclarationsMade) {
    return; // Skip
  }
  
  // Both players submit hidden
  battleCommitments.response[playerA.id] = playerAResponses;
  battleCommitments.response[playerB.id] = playerBResponses;
  
  // Reveal when both ready
  if (bothPlayersReady) {
    battleCommitments.responseRevealed = true;
    // Proceed to End of Turn Resolution
  }
}
```

---

## Critical Invariants Enforced

### Invariant 1: Health Changes Only at End of Turn

```typescript
// ✅ Correct usage
function buildShip(ship: Ship) {
  // Queue effect
  gameState.triggeredEffects.push({
    type: 'DAMAGE',
    value: 5,
    persistsIfSourceDestroyed: true
  });
  
  // Health NOT changed here
}

function resolveEndOfTurn() {
  // Health changed ONLY here
  applyHealthChanges();
}
```

### Invariant 2: Once-Only Effects Persist

```typescript
// Build Phase: Queue once-only effect
const effect: TriggeredEffect = {
  type: 'DAMAGE',
  value: 5,
  persistsIfSourceDestroyed: true // ← Key
};

// Battle Phase: Ship destroyed
ship.isDestroyed = true;

// End of Turn: Effect STILL applies
if (effect.persistsIfSourceDestroyed) {
  applyEffect(effect); // Applies even though ship destroyed
}
```

### Invariant 3: Continuous Effects Require Survival

```typescript
// End of Turn Resolution
for (const ship of allShips) {
  if (ship.isDestroyed || ship.isConsumedInUpgrade) {
    continue; // Skip destroyed ships
  }
  
  // Only alive ships generate continuous effects
  for (const power of ship.continuousPowers) {
    applyEffect(power);
  }
}
```

### Invariant 4: Battle Actions Simultaneous

```typescript
// ✅ Correct: Both submit, then reveal
const actions = {
  [playerA.id]: submitHidden(playerA),
  [playerB.id]: submitHidden(playerB)
};
revealSimultaneously(actions);

// ❌ Wrong: Sequential
const actionA = submitAndReveal(playerA);
const actionB = submitAndReveal(playerB); // No!
```

---

## Integration Points

### Full Phase Test Integration

The `/game/test/FullPhaseTest.tsx` already implements the correct flow:
- Simultaneous hidden declarations
- Lock-in functionality
- Auto-advance when both ready
- Proper phase progression

**Next step:** Update it to use the new `ActionResolver` and `EndOfTurnResolver`

### Game Engine Integration

**TODO:** Update `/game/engine/GameEngine.tsx` to:
1. Use new `ActionResolver` methods
2. Call `EndOfTurnResolver.resolveEndOfTurn()` at End of Turn Resolution
3. Remove old phase index logic
4. Use `MajorPhase` and step enums

### Server Integration

**TODO:** Update `/supabase/functions/server/index.tsx` to:
1. Store `battleCommitments` in game state
2. Store `triggeredEffects` in turn data
3. Call resolution logic at end of turn
4. Remove old accumulated damage/healing tracking

---

## Testing Checklist

### Unit Tests Needed

- [ ] `EndOfTurnResolver.resolveEndOfTurn()` with various effect combinations
- [ ] Once-only effect persists after ship destruction
- [ ] Continuous effect skipped if ship destroyed
- [ ] Health changes are atomic (all at once)
- [ ] Win/loss only checked after health finalized

### Integration Tests Needed

- [ ] Full turn cycle: Build → Battle → End of Turn → New Turn
- [ ] Battle commitments: Declaration → Response → Resolution
- [ ] Triggered effects queue correctly from Build/Battle phases
- [ ] Evaluated effects calculated fresh at End of Turn

### UI Tests Needed

- [ ] Hidden declaration panel shows/hides correctly
- [ ] Opponent ready indicator without revealing actions
- [ ] Reveal animation when both players ready
- [ ] Triggered effects display in UI
- [ ] Health bar updates only at End of Turn

---

## Migration Path

### Phase 1: Core Engine (COMPLETE)

- [x] Create `BattleTypes.tsx`
- [x] Create `EndOfTurnResolver.tsx`
- [x] Rewrite `ActionResolver.tsx`
- [x] Update `GameTypes.tsx`
- [x] Write comprehensive documentation

### Phase 2: Game Engine Update (TODO)

- [ ] Update `GameEngine.tsx` to use new resolvers
- [ ] Remove old phase index system
- [ ] Integrate `EndOfTurnResolver`
- [ ] Test with Full Phase Test

### Phase 3: Server Integration (TODO)

- [ ] Update server game state structure
- [ ] Store battle commitments
- [ ] Store triggered effects
- [ ] Call resolution at end of turn

### Phase 4: UI Polish (TODO)

- [ ] Battle commitment UI components
- [ ] Effect queue visualization
- [ ] Health change animations
- [ ] Triggered vs Evaluated effect indicators

---

## Common Questions

### Q: Why can't we apply damage during Battle Phase?

**A:** Because:
1. It violates the core invariant (health only changes at End of Turn)
2. It creates race conditions (who dies first?)
3. It makes win/loss checking inconsistent
4. It doesn't match the tabletop rules intent

### Q: Why do once-only effects persist after ship destruction?

**A:** Because:
1. The effect was already triggered (it happened)
2. It matches tabletop rules ("upon completion" is a past event)
3. It creates interesting tactical decisions (destroy ship before resolution?)

### Q: Why exactly 2 windows in Battle Phase?

**A:** Because:
1. It prevents infinite loops (no reaction to reaction to reaction...)
2. It preserves bluffing (can't see opponent's action before deciding)
3. It matches simultaneous card game mechanics
4. It's simple to implement and understand

### Q: Can we add more phases?

**A:** No. The 3-phase model is fundamental:
1. **Build Phase** - Prepare your forces
2. **Battle Phase** - Commit to actions
3. **End of Turn Resolution** - Resolve everything simultaneously

Adding more phases violates the core architecture.

---

## Success Criteria

The implementation is complete and correct when:

- [x] Battle Phase uses simultaneous hidden commitments
- [x] End of Turn Resolution applies all effects atomically
- [x] Once-only effects persist after source destruction
- [x] Continuous effects require ship survival
- [x] Health only changes at End of Turn Resolution
- [x] No numeric phase indices used
- [x] Documentation explains all invariants
- [ ] Full Phase Test integrated with new resolvers
- [ ] Game Engine uses new resolvers
- [ ] Server stores new state structure
- [ ] UI visualizes commitments and effects

---

## Next Steps

1. **Integrate with Full Phase Test**
   - Update test to use `ActionResolver.processBattleCommitment()`
   - Call `EndOfTurnResolver.resolveEndOfTurn()` at End of Turn
   - Test complete turn cycle

2. **Update Game Engine**
   - Remove old `PhaseManager` if it exists
   - Use `MajorPhase` and step enums
   - Call new resolver methods

3. **Server Integration**
   - Add `battleCommitments` to game state schema
   - Add `triggeredEffects` to turn data schema
   - Implement commit/reveal flow

4. **UI Components**
   - Hidden declaration panel
   - Effect queue visualization
   - Health change animations
   - Ready state indicators

---

## Contact & Support

If you have questions about this implementation:

1. Read `SYSTEM_CONSTRAINTS.md` first (hard rules)
2. Check `BATTLE_PHASE_SPEC.md` for Battle Phase details
3. Check `END_OF_TURN_SPEC.md` for resolution details
4. Review this summary for architecture overview

**Remember:** These constraints are non-negotiable. If an implementation violates them, it's incorrect.
