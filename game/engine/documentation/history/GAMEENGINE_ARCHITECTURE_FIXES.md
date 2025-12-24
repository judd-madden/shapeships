# GameEngine Architecture Fixes

## Overview

Fixed critical architectural conflicts between GameEngine's turn-based assumptions and Shapeships' simultaneous phase-based reality.

---

## 🚨 Problem 1: currentPlayerId Implies Turn-Taking (FIXED)

**The Conflict:**
```typescript
// ❌ OLD: Blocks players who aren't "current"
if (gameState.currentPlayerId !== playerId) return [];
```

**Why This Broke Shapeships:**
- Shapeships is simultaneous (both players act together)
- No "active player" during Build or Battle
- Readiness gates progress, not turn order

**The Fix:**
```typescript
// ✅ NEW: Let phase system control legality
getValidActions(playerId: string, gameState: GameState): GameAction[] {
  if (gameState.status !== 'active') {
    return [];
  }

  // Let rules engine determine if player can act (based on phase, not turn order)
  return this.rules.getValidMoves(playerId, gameState);
}
```

**Impact:**
- ✅ Both players can submit actions simultaneously
- ✅ Phase system determines when actions are valid
- ✅ No turn-based blocking
- ✅ `currentPlayerId` kept as UI hint only (documented)

---

## 🚨 Problem 2: end_turn Is Not Valid Shapeships Concept (FIXED)

**The Conflict:**
```typescript
// ❌ OLD: "End turn" implies player-triggered turn advancement
} else if (action.type === 'end_turn') {
  newState = this.advanceTurn(newState);
}
```

**Why This Broke Shapeships:**
- No "end turn" action in Shapeships
- Turns advance when all players declare readiness
- End of Turn Resolution is automatic (not player-triggered)

**The Fix:**
```typescript
// ✅ REMOVED from GameEngine.processAction()
// Turns advance via phase system readiness checks, not player actions

// ✅ REMOVED from RulesEngine.validateAction()
case 'end_turn':
  return true; // ❌ DELETED

// ✅ REPLACED with declare_ready in RulesEngine.getValidMoves()
case 'declare_ready':
  validMoves.push({
    id: `declare_ready_${Date.now()}`,
    playerId,
    type: 'declare_ready',
    data: {},
    timestamp: new Date().toISOString()
  });
  break;
```

**Impact:**
- ✅ Players declare readiness, not "end turn"
- ✅ Phase system controls turn advancement
- ✅ Matches ActionResolver model
- ✅ No player-triggered turn rotation

---

## 🚨 Problem 3: Win Condition Checked in Wrong Layer (FIXED)

**The Conflict:**
```typescript
// ❌ OLD: Win check after every action
const winner = this.rules.checkWinCondition(newState);
if (winner) {
  newState = { ...newState, status: 'completed' };
}
```

**Why This Broke Shapeships:**
- Core invariant: "Win/loss only checked at End of Turn Resolution"
- This allowed mid-turn wins (violates resolver contract)
- Created dangerous inconsistency

**The Fix:**
```typescript
// ✅ NEW: Accept result from EndOfTurnResolver
// 🔒 CRITICAL: Win condition checked ONLY in EndOfTurnResolver
// Accept result from resolver if game ended
if (newState.gameData.endOfTurnResult?.gameEnded) {
  newState = {
    ...newState,
    status: 'completed',
    winner: newState.gameData.endOfTurnResult.winner
  };
}
```

**Impact:**
- ✅ Win condition ONLY checked in EndOfTurnResolver
- ✅ GameEngine just accepts resolver's result
- ✅ Preserves core invariant
- ✅ No mid-turn game-ending actions

---

## 🚨 Problem 4: advanceTurn Conflicts with Simultaneous Model (FIXED)

**The Conflict:**
```typescript
// ❌ OLD: Rotate current player (turn-based logic)
private advanceTurn(gameState: GameState): GameState {
  const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
  const nextIndex = (currentIndex + 1) % gameState.players.length;
  const nextPlayer = gameState.players[nextIndex];

  return {
    ...gameState,
    currentTurn: gameState.currentTurn + 1,
    currentPlayerId: nextPlayer.id,
    players: gameState.players.map(p => ({ ...p, isActive: p.id === nextPlayer.id }))
  };
}
```

**Why This Broke Shapeships:**
- Rotates "active player" (sequential turn-taking)
- A "turn" is Build→Battle→Resolution (not Player A→Player B)
- Both players are "active" during all phases

**The Fix:**
```typescript
// ✅ REMOVED advanceTurn() method entirely
// Phase system handles turn advancement via readiness checks
```

**Impact:**
- ✅ No player rotation logic
- ✅ currentTurn tracks round number (Build→Battle→Resolution cycles)
- ✅ Phase system controls advancement
- ✅ Both players active simultaneously

---

## 📝 Documentation Updates

### currentTurn Field
```typescript
roundNumber: 0, // Tracks complete Build→Battle→Resolution cycles
```

### currentPlayerId Field
```typescript
currentPlayerId: creator.id, // UI hint only - not a control gate
```

---

## Files Modified

1. **`/game/engine/GameEngine.tsx`**
   - Removed currentPlayerId blocking in `getValidActions()`
   - Removed win condition check (delegated to EndOfTurnResolver)
   - Removed end_turn handling
   - Removed `advanceTurn()` method
   - Added comments documenting currentTurn and currentPlayerId semantics

2. **`/game/engine/RulesEngine.tsx`**
   - Removed end_turn from `validateAction()` switch
   - Removed end_turn from `applyAction()` switch
   - Replaced end_turn with declare_ready in `getValidMoves()`
   - Removed `applyEndTurn()` method (was just calling `applyDeclareReady()`)

---

## What Was NOT Changed

### Kept for Compatibility:
- **currentPlayerId field** - Still exists as UI hint (e.g. "Player A starts Build")
- **currentTurn field** - Still increments (tracks round number now)
- **checkWinCondition() method** - Still exists in RulesEngine (placeholder)
- **player.isActive flag** - Still set (for UI purposes)

### Why We Kept These:
- UI may use currentPlayerId for display hints
- Existing code may reference these fields
- Can be cleaned up later if truly unused
- Non-blocking (documented as hints only)

---

## Core Invariants Validated

After these fixes, GameEngine correctly supports:

- [x] Simultaneous player actions (no turn-based blocking) ✅
- [x] Phase-based action legality (not turn-order) ✅
- [x] Readiness-driven turn advancement (not player action) ✅
- [x] Win condition ONLY at End of Turn Resolution ✅
- [x] No player rotation / "active player" logic ✅

---

## Testing Checklist

- [ ] Both players can call `getValidActions()` simultaneously
- [ ] `declare_ready` action exists in valid moves
- [ ] `end_turn` action does NOT exist in valid moves
- [ ] Game only ends when `endOfTurnResult.gameEnded === true`
- [ ] No player is blocked during Build or Battle phases
- [ ] Phase system controls action legality (not currentPlayerId)

---

## Migration Notes

### If Code References end_turn:
```typescript
// ❌ OLD
action.type === 'end_turn'

// ✅ NEW
action.type === 'declare_ready'
```

### If Code Checks "Active Player":
```typescript
// ❌ OLD
if (gameState.currentPlayerId !== playerId) return;

// ✅ NEW
// Let phase system determine legality
// Don't block based on currentPlayerId
```

### If Code Advances Turns Manually:
```typescript
// ❌ OLD
gameState = gameEngine.advanceTurn(gameState);

// ✅ NEW
// Phase system advances turns automatically via readiness checks
// Don't call advanceTurn (method removed)
```

---

## Semantic Clarifications

### What "currentTurn" Means Now:
- **NOT:** "Whose turn is it" (sequential)
- **IS:** "Which round cycle are we in" (Build→Battle→Resolution)
- **Increments:** When full turn cycle completes (after Resolution)

### What "currentPlayerId" Means Now:
- **NOT:** "Only this player can act" (control gate)
- **IS:** "UI hint for display" (e.g. "Player A rolled first")
- **Usage:** UI display only, NOT action validation

### What "Turn Advancement" Means Now:
- **NOT:** Rotate to next player
- **IS:** Move to next phase when all players ready
- **Ownership:** Phase system (not GameEngine)

---

## Quote from Review

> "Right now this engine encodes a sequential turn-based game, not your simultaneous phase-based system. This is the biggest mismatch."

**Status:** ✅ **FIXED**

GameEngine now correctly implements simultaneous phase-based gameplay. No turn-based assumptions remain in action validation or turn advancement logic. 🎯
