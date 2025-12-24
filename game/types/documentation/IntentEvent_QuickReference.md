# Intent/Event Quick Reference

**For:** Developers working on Shapeships  
**Updated:** 2024-12-24

---

## 🚀 Quick Start

### Emitting an Intent (Client)

```typescript
import { GameIntent, BuildCommitIntent } from '@/game/types/IntentEventTypes';
import { sha256 } from 'crypto';

// 1. Create intent
const intent: BuildCommitIntent = {
  intentId: crypto.randomUUID(),
  gameId: gameState.gameId,
  playerId: myPlayerId,
  type: 'BUILD_COMMIT',
  turnNumber: gameState.roundNumber,
  commitHash: sha256(JSON.stringify(payload) + nonce),
  clientSeq: nextSeq++,
  clientCreatedAtMs: Date.now()
};

// 2. Submit to server
const response = await submitIntent(intent);

// 3. Handle response
if (response.ok) {
  // Intent accepted - state updated
  setGameState(response.state);
  logEvents(response.events);
} else {
  // Intent rejected - show error
  showError(response.rejected.message);
}
```

### Processing an Event (Client)

```typescript
import { GameEvent } from '@/game/types/IntentEventTypes';

const handleEvent = (event: GameEvent) => {
  switch (event.type) {
    case 'INTENT_ACCEPTED':
      console.log(`Intent ${event.intentId} accepted`);
      break;
      
    case 'INTENT_REJECTED':
      showError(event.message);
      break;
      
    case 'PHASE_ENTERED':
      console.log(`Entered ${event.phase} - ${event.step}`);
      break;
      
    case 'HEALTH_APPLIED':
      console.log(`Health changed: ${event.net}`);
      animateHealthChange(event);
      break;
      
    // ... handle other events
  }
};
```

### Validating an Intent (Server)

```typescript
import { GameIntent, IntentResponse } from '@/game/types/IntentEventTypes';

const validateIntent = (
  gameState: GameState, 
  intent: GameIntent
): { valid: boolean; code?: string; message?: string } => {
  
  // Check phase validity
  if (intent.type === 'BUILD_COMMIT' && gameState.currentPhase !== 'build_phase') {
    return {
      valid: false,
      code: 'INVALID_PHASE',
      message: 'Cannot commit build actions outside Build Phase'
    };
  }
  
  // Check resources
  if (intent.type === 'BUILD_REVEAL') {
    const totalCost = intent.payload.buildShips?.reduce(
      (sum, ship) => sum + (ship.lineCost || 0), 
      0
    ) || 0;
    
    const availableLines = gameState.gameData.resources.linesAvailable[intent.playerId];
    
    if (totalCost > availableLines) {
      return {
        valid: false,
        code: 'INSUFFICIENT_LINES',
        message: `Need ${totalCost} lines, have ${availableLines}`
      };
    }
  }
  
  // More validation...
  
  return { valid: true };
};
```

---

## 📦 Intent Cheat Sheet

### Build Phase

| Intent Type | When | Purpose |
|-------------|------|---------|
| `BUILD_COMMIT` | Drawing step | Commit hash of build actions |
| `BUILD_REVEAL` | After both committed | Reveal build actions |
| `ACTION` (dice manipulation) | Dice roll step | Use dice manipulation power |
| `DECLARE_READY` | Any build step | Signal completion |

### Battle Phase

| Intent Type | When | Purpose |
|-------------|------|---------|
| `BATTLE_COMMIT` | Declaration/Response | Commit hash of battle actions |
| `BATTLE_REVEAL` | After both committed | Reveal battle actions |
| `DECLARE_READY` | Any battle step | Signal completion |

### Universal

| Intent Type | When | Purpose |
|-------------|------|---------|
| `SURRENDER` | Anytime | Forfeit game |

---

## 📣 Event Cheat Sheet

### Lifecycle

| Event Type | Meaning | UI Action |
|------------|---------|-----------|
| `INTENT_ACCEPTED` | Intent valid | Clear pending state |
| `INTENT_REJECTED` | Intent invalid | Show error message |
| `PHASE_ENTERED` | New phase started | Update phase UI |

### Time

| Event Type | Meaning | UI Action |
|------------|---------|-----------|
| `CLOCK_UPDATED` | Clock state changed | Update timer display |

### Commitments

| Event Type | Meaning | UI Action |
|------------|---------|-----------|
| `COMMIT_STORED` | Hash stored | Show "waiting for opponent" |
| `REVEAL_ACCEPTED` | Reveal validated | Show revealed actions |

### Resolution

| Event Type | Meaning | UI Action |
|------------|---------|-----------|
| `EFFECTS_QUEUED` | Effects queued | Show pending effects |
| `SHIPS_CHANGED` | Ships created/destroyed | Animate ships |
| `HEALTH_APPLIED` | Health changed | Animate health bar |
| `GAME_ENDED` | Game over | Show victory screen |

---

## 🔄 Common Patterns

### Pattern: Hidden Action (Build Phase)

```typescript
// Step 1: Player prepares actions
const payload: BuildDrawingPayload = {
  turnNumber: 5,
  buildShips: [
    { shipDefId: 'DESTROYER', lineCost: 4 }
  ],
  saveLines: 2
};

const nonce = crypto.randomUUID();
const commitHash = sha256(JSON.stringify(payload) + nonce);

// Step 2: Commit hash
const commitIntent: BuildCommitIntent = {
  type: 'BUILD_COMMIT',
  turnNumber: 5,
  commitHash,
  // ... base fields
};

await submitIntent(commitIntent);

// Step 3: Wait for COMMIT_STORED event for both players

// Step 4: Reveal payload
const revealIntent: BuildRevealIntent = {
  type: 'BUILD_REVEAL',
  turnNumber: 5,
  payload,
  nonce,
  // ... base fields
};

await submitIntent(revealIntent);

// Step 5: Server validates hash and applies actions
```

### Pattern: Hidden Action (Battle Phase)

```typescript
// Step 1: Player chooses battle actions
const battlePayload: HiddenBattleActions = {
  charges: [
    { shipInstanceId: 'ship-123', powerIndex: 0, targets: ['ship-456'] }
  ],
  solarPowers: []
};

const nonce = crypto.randomUUID();
const commitHash = sha256(JSON.stringify(battlePayload) + nonce);

// Step 2: Commit hash
const commitIntent: BattleCommitIntent = {
  type: 'BATTLE_COMMIT',
  window: 'DECLARATION',
  turnNumber: 5,
  commitHash,
  // ... base fields
};

await submitIntent(commitIntent);

// Step 3: Wait for COMMIT_STORED events

// Step 4: Reveal
const revealIntent: BattleRevealIntent = {
  type: 'BATTLE_REVEAL',
  window: 'DECLARATION',
  turnNumber: 5,
  payload: battlePayload,
  nonce,
  // ... base fields
};

await submitIntent(revealIntent);
```

### Pattern: Atomic Action (Immediate)

```typescript
// Dice manipulation (no hiding required)
const intent: AtomicActionIntent = {
  type: 'ACTION',
  phase: MajorPhase.BUILD_PHASE,
  step: BuildPhaseStep.DICE_ROLL,
  actionType: 'DICE_MANIPULATION',
  data: { 
    type: 'CHOOSE_NUMBER', 
    chosenNumber: 6 
  },
  // ... base fields
};

const response = await submitIntent(intent);

// Server immediately validates and applies
```

### Pattern: Ready Signal

```typescript
// Player completed current step
const intent: DeclareReadyIntent = {
  type: 'DECLARE_READY',
  phase: MajorPhase.BUILD_PHASE,
  step: BuildPhaseStep.DRAWING,
  // ... base fields
};

await submitIntent(intent);

// When both players ready, server advances phase
```

---

## ⚠️ Common Mistakes

### ❌ Sending State Instead of Intent

```typescript
// WRONG
const intent = {
  type: 'BUILD_SHIP',
  newShip: { id: 'ship-123', health: 5, damage: 3 }  // Client calculated
};
```

```typescript
// RIGHT
const intent: BuildRevealIntent = {
  type: 'BUILD_REVEAL',
  payload: {
    buildShips: [{ shipDefId: 'DESTROYER' }]  // Server calculates stats
  },
  nonce: '...'
};
```

### ❌ Trusting Client Time

```typescript
// WRONG
const intent = {
  type: 'ACTION',
  timestamp: Date.now()  // Client time
};
```

```typescript
// RIGHT
const intent = {
  type: 'ACTION',
  clientCreatedAtMs: Date.now()  // Optional, server ignores
};
// Server sets serverReceivedAtMs
```

### ❌ Applying Health Outside EndOfTurnResolver

```typescript
// WRONG
if (intent.type === 'REVEAL_BUILD') {
  player.health -= damage;  // Immediate health change
}
```

```typescript
// RIGHT
if (intent.type === 'REVEAL_BUILD') {
  const effects = calculateEffects(ships);
  queueEffects(effects);  // Queue for end-of-turn
}
// Health changes ONLY in EndOfTurnResolver
```

### ❌ Revealing Without Committing

```typescript
// WRONG
const intent: BuildRevealIntent = {
  type: 'BUILD_REVEAL',
  payload: { ... }
};
// No prior commit - opponent sees actions immediately
```

```typescript
// RIGHT
// Step 1: Commit
await submitIntent(commitIntent);

// Step 2: Wait for both commits
waitForEvent('COMMIT_STORED');

// Step 3: Reveal
await submitIntent(revealIntent);
```

---

## 🧪 Testing

### Unit Test: Intent Validation

```typescript
import { BuildCommitIntent } from '@/game/types/IntentEventTypes';
import { validateIntent } from '@/game/engine/RulesEngine';

test('rejects BUILD_COMMIT outside build phase', () => {
  const gameState: GameState = {
    currentPhase: MajorPhase.BATTLE_PHASE,
    // ...
  };
  
  const intent: BuildCommitIntent = {
    type: 'BUILD_COMMIT',
    turnNumber: 5,
    commitHash: 'abc123',
    // ...
  };
  
  const result = validateIntent(gameState, intent);
  
  expect(result.valid).toBe(false);
  expect(result.code).toBe('INVALID_PHASE');
});
```

### Integration Test: Full Flow

```typescript
test('build phase commit-reveal flow', async () => {
  // 1. Commit
  const commitResponse = await submitIntent(commitIntent);
  expect(commitResponse.ok).toBe(true);
  expect(commitResponse.events).toContainEqual(
    expect.objectContaining({ type: 'COMMIT_STORED' })
  );
  
  // 2. Reveal
  const revealResponse = await submitIntent(revealIntent);
  expect(revealResponse.ok).toBe(true);
  expect(revealResponse.events).toContainEqual(
    expect.objectContaining({ type: 'REVEAL_ACCEPTED' })
  );
  
  // 3. Verify state
  expect(revealResponse.state.gameData.ships[playerId]).toHaveLength(1);
});
```

---

## 📚 Type Imports

### Client (React)

```typescript
import type {
  GameIntent,
  GameEvent,
  IntentResponse,
  BuildCommitIntent,
  BuildRevealIntent,
  BattleCommitIntent,
  BattleRevealIntent,
  AtomicActionIntent,
  DeclareReadyIntent,
  SurrenderIntent
} from '@/game/types/IntentEventTypes';
```

### Server (Edge Function)

```typescript
import type {
  GameIntent,
  GameEvent,
  IntentResponse
} from './game/types/IntentEventTypes';

// Also import validation dependencies
import type { GameState } from './game/types/GameTypes';
import { RulesEngine } from './game/engine/RulesEngine';
import { GameEngine } from './game/engine/GameEngine';
```

---

## 🔗 Related Files

- **Types:** `/game/types/IntentEventTypes.ts`
- **Architecture:** `/game/types/documentation/IntentEvent_Architecture.md`
- **Guidelines:** `/guidelines/Guidelines.md`
- **Game Phases:** `/game/engine/GamePhases.tsx`
- **Action Types:** `/game/types/ActionTypes.tsx` (legacy)

---

**Quick Tip:** When in doubt, remember the flow:
1. Client emits **Intent** (what player wants)
2. Server validates (RulesEngine)
3. Server mutates (GameEngine)
4. Server returns **IntentResponse** with **Events** (what actually happened)
5. UI renders **GameState** (server truth)
