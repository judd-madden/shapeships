# Action Resolution Layer - UPDATED

## 🚨 CRITICAL UPDATE (2024-12-23)

**This document has been superseded by the new Battle Phase and End of Turn Resolution model.**

**Please read these documents instead:**

1. **`SYSTEM_CONSTRAINTS.md`** - Non-negotiable hard constraints
2. **`BATTLE_PHASE_SPEC.md`** - Correct Battle Phase model (simultaneous commitments)
3. **`END_OF_TURN_SPEC.md`** - Correct End of Turn Resolution model
4. **`IMPLEMENTATION_SUMMARY.md`** - Complete rewrite overview

---

## What Changed?

### Old Model (DEPRECATED)

```typescript
// ❌ Sequential Battle actions with priority
// ❌ Numeric phase indices (0, 1, 2, 3...)
// ❌ "Automatic Phase" as separate phase
// ❌ Health changes during Battle Phase
// ❌ Per-action resolution with loops
```

### New Model (CURRENT)

```typescript
// ✅ Simultaneous hidden commitments
// ✅ Named enums (MajorPhase, BuildPhaseStep, BattlePhaseStep)
// ✅ "Automatic" as a step property, not a phase
// ✅ Health changes ONLY at End of Turn Resolution
// ✅ Two commitment windows max (Declaration + Response)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│          UI Components (React)              │
│  - FullPhaseTest.tsx                        │
│  - Hidden declaration panels                │
│  - Lock-in buttons                          │
│  - Effect queue visualization               │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│       Action Resolution Layer               │
│  - ActionResolver.tsx                       │
│  - processBattleCommitment()                │
│  - resolveBuildAction()                     │
│  - initializeBattleCommitments()            │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│     End of Turn Resolution Engine           │
│  - EndOfTurnResolver.tsx                    │
│  - resolveEndOfTurn()                       │
│  - Collects triggered effects               │
│  - Evaluates continuous effects             │
│  - Applies all effects simultaneously       │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│         Phase Engine (GamePhases)           │
│  - 3-phase system (Build, Battle, End)     │
│  - Named step enums                         │
│  - Step properties (isAutomatic)            │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│        Game Engine (GameEngine)             │
│  - Pure game logic                          │
│  - Ship data, health, resources             │
│  - State mutations                          │
└─────────────────────────────────────────────┘
```

---

## Core Invariants (NON-NEGOTIABLE)

### 1. Three Major Phases Only

```typescript
enum MajorPhase {
  BUILD_PHASE = 'build_phase',
  BATTLE_PHASE = 'battle_phase',
  END_OF_TURN_RESOLUTION = 'end_of_turn_resolution'
}
```

**No "Automatic Phase"** - It's a step property, not a phase.

### 2. Health Changes Only at End of Turn

```typescript
// ✅ Correct
function buildShip() {
  gameState.triggeredEffects.push({...}); // Queue for later
}

function resolveEndOfTurn() {
  applyHealthChanges(); // ONLY here
}

// ❌ Wrong
function useCh() {
  opponent.health -= damage; // NO! Health changes mid-turn
}
```

### 3. Battle Phase = Simultaneous Commitments

```typescript
// ✅ Correct
const commitments = {
  declaration: {
    playerA: { charges: [...], solarPowers: [...] },
    playerB: { charges: [...], solarPowers: [...] }
  },
  declarationRevealed: false
};

// Both submit, then reveal together
revealWhenBothReady(commitments);

// ❌ Wrong
const actionA = playerADeclares(); // Sequential
const actionB = playerBResponds(); // No!
```

### 4. Once-Only Effects Persist

```typescript
// Effect queued during Build Phase
const effect: TriggeredEffect = {
  type: 'DAMAGE',
  value: 5,
  persistsIfSourceDestroyed: true // ← Key
};

// Ship destroyed in Battle Phase
ship.isDestroyed = true;

// End of Turn: Effect STILL applies
if (effect.persistsIfSourceDestroyed) {
  applyEffect(effect); // Applies even though ship gone
}
```

### 5. Continuous Effects Require Survival

```typescript
// End of Turn Resolution
for (const ship of allShips) {
  if (ship.isDestroyed) continue; // Skip destroyed

  // Only alive ships generate continuous effects
  applyAutomaticEffects(ship);
}
```

---

## New Type Definitions

### Battle Commitments

```typescript
interface HiddenBattleActions {
  charges: ChargeDeclaration[];
  solarPowers: SolarDeclaration[];
}

interface BattleCommitmentState {
  declaration?: { [playerId: string]: HiddenBattleActions };
  response?: { [playerId: string]: HiddenBattleActions };
  declarationRevealed: boolean;
  responseRevealed: boolean;
  anyDeclarationsMade: boolean;
}
```

### Triggered Effects

```typescript
interface TriggeredEffect {
  id: string;
  sourceShipId: string;
  sourcePlayerId: string;
  targetPlayerId: string;
  effectType: 'DAMAGE' | 'HEAL';
  value: number;
  persistsIfSourceDestroyed: boolean; // Key property
  description: string;
  triggeredAt: string;
}
```

### Evaluated Effects

```typescript
interface EvaluatedEffect {
  sourceShipId: string;
  sourcePlayerId: string;
  targetPlayerId: string;
  effectType: 'DAMAGE' | 'HEAL';
  value: number;
  requiresShipAlive: true;
}
```

---

## New API Reference

### ActionResolver

#### `processBattleCommitment()`

Process Battle Phase hidden commitments.

```typescript
processBattleCommitment(
  gameState: GameState,
  playerId: string,
  actions: HiddenBattleActions,
  window: 'declaration' | 'response'
): {
  success: boolean;
  error?: string;
  triggeredEffects: TriggeredEffect[];
}
```

#### `initializeBattleCommitments()`

Create empty Battle commitment state.

```typescript
initializeBattleCommitments(): BattleCommitmentState
```

#### `submitBattleActions()`

Submit hidden actions for a player.

```typescript
submitBattleActions(
  commitmentState: BattleCommitmentState,
  playerId: string,
  actions: HiddenBattleActions,
  window: 'declaration' | 'response'
): BattleCommitmentState
```

#### `areBothPlayersReady()`

Check if both players submitted actions.

```typescript
areBothPlayersReady(
  gameState: GameState,
  commitmentState: BattleCommitmentState,
  window: 'declaration' | 'response'
): boolean
```

### EndOfTurnResolver

#### `resolveEndOfTurn()`

Apply all effects and finalize health changes.

```typescript
resolveEndOfTurn(
  gameState: GameState,
  triggeredEffects: TriggeredEffect[]
): EndOfTurnResult
```

**Returns:**
```typescript
{
  healthChanges: {
    [playerId]: { damage: number, healing: number, netChange: number }
  },
  shipsDestroyed: string[],
  gameEnded: boolean,
  winner?: string,
  effectsApplied: Array<{
    effectId: string,
    description: string,
    applied: boolean,
    reason?: string
  }>
}
```

---

## Battle Phase Flow (Correct)

### Step 1: First Strike (Automatic)

- Resolve First Strike powers
- Destroy ships immediately
- No player input

### Step 2: Simultaneous Declaration

```typescript
// Both players submit hidden
commitments.declaration[playerA.id] = { charges: [...], solarPowers: [...] };
commitments.declaration[playerB.id] = { charges: [...], solarPowers: [...] };

// Reveal when both ready
commitments.declarationRevealed = true;

// Branch
if (anyActions(commitments.declaration)) {
  proceedToResponse();
} else {
  skipToEndOfTurn();
}
```

### Step 3: Conditional Response (if needed)

```typescript
// Only if declarations were made
if (commitments.anyDeclarationsMade) {
  // Both players submit hidden
  commitments.response[playerA.id] = { charges: [...], solarPowers: [...] };
  commitments.response[playerB.id] = { charges: [...], solarPowers: [...] };
  
  // Reveal when both ready
  commitments.responseRevealed = true;
}

// Proceed to End of Turn Resolution
```

---

## End of Turn Resolution Flow (Correct)

```typescript
function resolveEndOfTurn(gameState, triggeredEffects) {
  const allEffects = [];
  
  // Step 1: Collect triggered effects (already queued)
  for (const effect of triggeredEffects) {
    if (effect.persistsIfSourceDestroyed || !isShipDestroyed(effect.sourceShipId)) {
      allEffects.push(effect);
    }
  }
  
  // Step 2: Evaluate continuous effects
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

## Migration Guide

### From Old ActionResolver

**Old code:**
```typescript
// ❌ Old
if (phaseIndex === 4) { // Magic number
  // Charge phase
}

opponent.health -= damage; // Health change mid-turn
```

**New code:**
```typescript
// ✅ New
if (currentStep === BattlePhaseStep.SIMULTANEOUS_DECLARATION) {
  // Named enum
}

gameState.triggeredEffects.push({
  type: 'DAMAGE',
  value: damage,
  // Will resolve at End of Turn
});
```

### From Old Effect System

**Old code:**
```typescript
// ❌ Old
gameState.accumulatedDamage[playerId] += damage;
// Applied whenever
```

**New code:**
```typescript
// ✅ New
gameState.turnData.triggeredEffects.push({
  id: generateId(),
  effectType: 'DAMAGE',
  value: damage,
  persistsIfSourceDestroyed: true,
  // Applied ONLY at End of Turn Resolution
});
```

---

## Testing Checklist

### Core Invariants

- [ ] Health NEVER changes outside End of Turn Resolution
- [ ] Once-only effects apply even if source destroyed
- [ ] Continuous effects skipped if source destroyed
- [ ] Battle actions are simultaneous (not sequential)
- [ ] Exactly 2 Battle windows max (Declaration + Response)

### Battle Phase

- [ ] Hidden actions not revealed until both ready
- [ ] Opponent can't see your actions before locking in
- [ ] Response only happens if declarations made
- [ ] No infinite loops or back-and-forth

### End of Turn Resolution

- [ ] All effects tally before applying
- [ ] Health changes are atomic (all at once)
- [ ] Win/loss only checked after health finalized
- [ ] Effect order doesn't matter (same result)

---

## Documentation Links

**Start here:**
- `SYSTEM_CONSTRAINTS.md` - Hard rules (READ FIRST)

**Battle Phase:**
- `BATTLE_PHASE_SPEC.md` - Simultaneous commitment model

**End of Turn:**
- `END_OF_TURN_SPEC.md` - Resolution algorithm

**Overview:**
- `IMPLEMENTATION_SUMMARY.md` - Complete rewrite summary

---

## FAQ

**Q: Why can't I apply damage during Battle Phase?**

A: Core invariant - health only changes at End of Turn Resolution. This prevents race conditions and makes win/loss checking consistent.

**Q: Why do once-only effects persist after ship destruction?**

A: The effect already happened (in the past). Destroying the ship later doesn't undo history.

**Q: Why exactly 2 Battle windows?**

A: Prevents infinite loops. Preserves bluffing. Matches tabletop card game mechanics.

**Q: What happened to numeric phase indices?**

A: Replaced with named enums to prevent off-by-one errors and make code self-documenting.

**Q: Where did "Automatic Phase" go?**

A: It was never a phase - it's a property of steps. Steps can be `isAutomatic: true`.

---

## Version History

- **v2.0.0** (2024-12-23): Complete rewrite
  - New Battle commitment model
  - New End of Turn Resolution engine
  - Removed numeric phase indices
  - Removed "Automatic Phase"
  - Added triggered vs evaluated effects
  - Updated all documentation

- **v1.0.0** (2024-01-18): Initial implementation (DEPRECATED)
  - Old sequential action model
  - Old phase index system
  - Old effect queueing
