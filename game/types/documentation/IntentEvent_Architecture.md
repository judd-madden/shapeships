# Intent/Event Architecture

**Created:** 2024-12-24  
**File:** `/game/types/IntentEventTypes.ts`  
**Status:** ✅ Canonical contract defined

---

## 🎯 Purpose

The Intent/Event contract establishes a **strict separation of concerns** between:

- **Client Intent** - What players attempt to do
- **Server Authority** - What the server validates and accepts
- **Engine Resolution** - How game rules process valid actions

This architecture ensures:
- ✅ **No game logic in UI** - UI only emits intents and renders state
- ✅ **Server-authoritative** - All validation happens server-side
- ✅ **Multiplayer consistency** - All players see validated state
- ✅ **Replay/logging** - Complete event log for debugging/analysis

---

## 🏗️ Architecture Flow

```
┌─────────────────┐
│  UI Component   │
│  (React)        │
└────────┬────────┘
         │
         │ 1. emit GameIntent
         ▼
┌─────────────────┐
│  useGameState   │
│  Hook           │
└────────┬────────┘
         │
         │ 2. POST /intent
         ▼
┌─────────────────┐
│  Edge Function  │
│  Server         │
└────────┬────────┘
         │
         │ 3. validate via RulesEngine
         ▼
┌─────────────────┐
│  Game Engine    │
│  (Pure Logic)   │
└────────┬────────┘
         │
         │ 4. mutate GameState
         │ 5. generate GameEvent[]
         ▼
┌─────────────────┐
│  IntentResponse │
│  { ok, state,   │
│    events }     │
└────────┬────────┘
         │
         │ 6. return to client
         ▼
┌─────────────────┐
│  UI Component   │
│  renders state  │
└─────────────────┘
```

---

## 🔒 Hard Rules

### 1. Clients Never Send State

**❌ WRONG:**
```typescript
// Client calculates damage
const damage = calculateDamage(myShips);
sendToServer({ damage });  // Server trusts client calculation
```

**✅ CORRECT:**
```typescript
// Client only declares intent
const intent: BuildCommitIntent = {
  type: 'BUILD_COMMIT',
  turnNumber: 5,
  commitHash: sha256(payload + nonce)
};
submitIntent(intent);  // Server calculates everything
```

### 2. Server Never Trusts Time

**❌ WRONG:**
```typescript
// Client sends timestamp
const intent = {
  type: 'ACTION',
  clientTimestamp: Date.now()  // Server trusts this
};
```

**✅ CORRECT:**
```typescript
// Server generates authoritative timestamp
const event: ClockUpdatedEvent = {
  type: 'CLOCK_UPDATED',
  atMs: serverTime,  // Server is source of truth
  p1Ms: timeRemaining
};
```

### 3. Health Only Changes in EndOfTurnResolver

**❌ WRONG:**
```typescript
// UI applies damage immediately
player.health -= damage;
```

**✅ CORRECT:**
```typescript
// Intent queues effects
const event: EffectsQueuedEvent = {
  type: 'EFFECTS_QUEUED',
  effects: [{ kind: EffectKind.DAMAGE, amount: 5 }]
};
// Health changes ONLY in End of Turn Resolution
const healthEvent: HealthAppliedEvent = {
  type: 'HEALTH_APPLIED',
  damage: 5,
  net: -5
};
```

### 4. Hidden Actions Use Commit → Reveal

**❌ WRONG:**
```typescript
// Send actions immediately (visible to opponent)
const intent = {
  type: 'BUILD_SHIP',
  shipDefId: 'DESTROYER'
};
```

**✅ CORRECT:**
```typescript
// Step 1: Commit hash (hidden)
const commitIntent: BuildCommitIntent = {
  type: 'BUILD_COMMIT',
  commitHash: sha256(payload + nonce)
};

// Step 2: Reveal payload (after both committed)
const revealIntent: BuildRevealIntent = {
  type: 'BUILD_REVEAL',
  payload: { buildShips: [{ shipDefId: 'DESTROYER' }] },
  nonce: nonce
};
```

### 5. All Ordering is Server-Sequenced

**❌ WRONG:**
```typescript
// Client determines event order
events.sort((a, b) => a.clientSeq - b.clientSeq);
```

**✅ CORRECT:**
```typescript
// Server sequences all events
const event: EventBase = {
  eventId: uuid(),
  seq: 42,  // Server-assigned monotonic sequence
  atMs: serverTime
};
```

### 6. UI Renders from GameState + Events

**❌ WRONG:**
```typescript
// UI calculates game state
const myDamage = ships.reduce((sum, s) => sum + s.damage, 0);
```

**✅ CORRECT:**
```typescript
// UI displays server state
const myDamage = gameState.gameData.powerResults[myPlayerId].damageToOpponent;
```

---

## 📦 Intent Types

### Build Phase Intents

**BuildCommitIntent** - Hidden build actions commitment
```typescript
{
  type: 'BUILD_COMMIT',
  turnNumber: 5,
  commitHash: 'abc123...'  // sha256(payload + nonce)
}
```

**BuildRevealIntent** - Reveal committed build actions
```typescript
{
  type: 'BUILD_REVEAL',
  turnNumber: 5,
  payload: {
    buildShips: [
      { shipDefId: 'DESTROYER', lineCost: 4 }
    ],
    saveLines: 2
  },
  nonce: 'random-string'
}
```

### Battle Phase Intents

**BattleCommitIntent** - Hidden battle actions commitment
```typescript
{
  type: 'BATTLE_COMMIT',
  window: 'DECLARATION',
  turnNumber: 5,
  commitHash: 'def456...'
}
```

**BattleRevealIntent** - Reveal committed battle actions
```typescript
{
  type: 'BATTLE_REVEAL',
  window: 'DECLARATION',
  turnNumber: 5,
  payload: {
    charges: [{ shipInstanceId: 'ship-123', powerIndex: 0 }],
    solarPowers: []
  },
  nonce: 'random-string'
}
```

### Atomic Intents

**AtomicActionIntent** - Immediate, non-hidden actions
```typescript
{
  type: 'ACTION',
  phase: MajorPhase.BUILD_PHASE,
  step: BuildPhaseStep.DICE_ROLL,
  actionType: 'DICE_MANIPULATION',
  data: { type: 'CHOOSE_NUMBER', chosenNumber: 6 }
}
```

**DeclareReadyIntent** - Signal phase completion
```typescript
{
  type: 'DECLARE_READY',
  phase: MajorPhase.BUILD_PHASE,
  step: BuildPhaseStep.DRAWING
}
```

**SurrenderIntent** - Forfeit game
```typescript
{
  type: 'SURRENDER'
}
```

---

## 📣 Event Types

### Lifecycle Events

**IntentAcceptedEvent** - Server accepted intent
```typescript
{
  type: 'INTENT_ACCEPTED',
  intentId: 'intent-123',
  playerId: 'player-1',
  seq: 42,
  atMs: 1703462400000
}
```

**IntentRejectedEvent** - Server rejected intent
```typescript
{
  type: 'INTENT_REJECTED',
  intentId: 'intent-123',
  playerId: 'player-1',
  code: 'INSUFFICIENT_LINES',
  message: 'Cannot build ship: need 4 lines, have 2'
}
```

**PhaseEnteredEvent** - Phase transition
```typescript
{
  type: 'PHASE_ENTERED',
  phase: MajorPhase.BATTLE_PHASE,
  step: BattlePhaseStep.SIMULTANEOUS_DECLARATION,
  turnNumber: 5
}
```

### Clock Events

**ClockUpdatedEvent** - Chess clock update
```typescript
{
  type: 'CLOCK_UPDATED',
  p1Ms: 600000,  // 10 minutes
  p2Ms: 540000,  // 9 minutes
  runningFor: 'p1',
  startedAtMs: 1703462400000
}
```

### Commitment Events

**CommitStoredEvent** - Hash stored (hidden)
```typescript
{
  type: 'COMMIT_STORED',
  kind: 'BUILD',
  turnNumber: 5,
  playerId: 'player-1'
}
```

**RevealAcceptedEvent** - Reveal validated
```typescript
{
  type: 'REVEAL_ACCEPTED',
  kind: 'BUILD',
  turnNumber: 5,
  playerId: 'player-1'
}
```

### Resolution Events

**EffectsQueuedEvent** - Effects queued for end-of-turn
```typescript
{
  type: 'EFFECTS_QUEUED',
  sourceIntentId: 'intent-123',
  effects: [
    { effectId: 'eff-1', kind: EffectKind.DAMAGE, amount: 5 }
  ]
}
```

**HealthAppliedEvent** - Health changed (end-of-turn only!)
```typescript
{
  type: 'HEALTH_APPLIED',
  playerId: 'player-1',
  damage: 8,
  healing: 3,
  net: -5
}
```

**ShipsChangedEvent** - Ships created/destroyed/updated
```typescript
{
  type: 'SHIPS_CHANGED',
  created: ['ship-123'],
  destroyed: ['ship-456'],
  updated: ['ship-789']
}
```

**GameEndedEvent** - Game terminal state
```typescript
{
  type: 'GAME_ENDED',
  winnerPlayerId: 'player-1',
  victoryType: 'HEALTH'
}
```

---

## 🔄 Server Response Format

**Every mutation endpoint MUST return:**

```typescript
interface IntentResponse {
  ok: boolean;                    // Was intent accepted?
  state: GameState;               // Current authoritative state
  events: GameEvent[];            // Events generated
  rejected?: {                    // Only if ok = false
    code: string;
    message: string;
  };
}
```

**Success Response:**
```typescript
{
  ok: true,
  state: { /* full GameState */ },
  events: [
    { type: 'INTENT_ACCEPTED', intentId: 'intent-123', ... },
    { type: 'SHIPS_CHANGED', created: ['ship-123'], ... }
  ]
}
```

**Rejection Response:**
```typescript
{
  ok: false,
  state: { /* unchanged GameState */ },
  events: [
    { 
      type: 'INTENT_REJECTED', 
      intentId: 'intent-123',
      code: 'INSUFFICIENT_LINES',
      message: 'Cannot build ship: need 4 lines, have 2'
    }
  ],
  rejected: {
    code: 'INSUFFICIENT_LINES',
    message: 'Cannot build ship: need 4 lines, have 2'
  }
}
```

---

## 🧩 Integration Points

### Client (React)

**useGameState Hook:**
```typescript
const { gameState, submitIntent, events } = useGameState(gameId);

const handleBuildShip = () => {
  const intent: BuildCommitIntent = {
    intentId: uuid(),
    gameId,
    playerId: myPlayerId,
    type: 'BUILD_COMMIT',
    turnNumber: gameState.roundNumber,
    commitHash: sha256(payload + nonce),
    clientSeq: nextSeq++
  };
  
  submitIntent(intent);
};
```

**UI Rendering:**
```typescript
// Render from state, not calculations
<div>Health: {gameState.players[0].health}</div>
<div>Damage Output: {gameState.gameData.powerResults[myId].damageToOpponent}</div>

// Display events in log
{events.map(event => (
  <LogEntry key={event.eventId} event={event} />
))}
```

### Server (Edge Function)

**Intent Endpoint:**
```typescript
app.post('/make-server-825e19ab/intent', async (c) => {
  const intent: GameIntent = await c.req.json();
  
  // 1. Validate via RulesEngine
  const validation = RulesEngine.validateIntent(gameState, intent);
  if (!validation.valid) {
    return c.json({
      ok: false,
      state: gameState,
      events: [{
        type: 'INTENT_REJECTED',
        intentId: intent.intentId,
        playerId: intent.playerId,
        code: validation.code,
        message: validation.message
      }],
      rejected: { code: validation.code, message: validation.message }
    });
  }
  
  // 2. Mutate via GameEngine
  const { newState, events } = GameEngine.applyIntent(gameState, intent);
  
  // 3. Persist
  await kvSet(`game:${gameId}`, newState);
  
  // 4. Return
  return c.json({
    ok: true,
    state: newState,
    events
  });
});
```

---

## 📋 Migration Checklist

### Phase 1: Types Only (Current)
- [x] Define IntentEventTypes.ts
- [x] Document architecture
- [ ] Add to Guidelines.md
- [ ] Review with team

### Phase 2: Server Integration
- [ ] Update server endpoints to accept GameIntent
- [ ] Update server to return IntentResponse
- [ ] Implement intent validation in RulesEngine
- [ ] Implement event generation in GameEngine
- [ ] Add event persistence/logging

### Phase 3: Client Integration
- [ ] Update useGameState to emit GameIntent
- [ ] Update useGameState to handle IntentResponse
- [ ] Update UI components to emit intents (not actions)
- [ ] Update UI to render from state (not calculations)
- [ ] Add event log display

### Phase 4: Deprecation
- [ ] Mark GameAction as deprecated
- [ ] Migrate all GameAction usages to GameIntent
- [ ] Remove GameAction (breaking change)

---

## 🎓 Key Concepts

### Intent vs Action

**Intent** - What player attempts (may be rejected)
```typescript
const intent: BuildCommitIntent = {
  type: 'BUILD_COMMIT',
  commitHash: 'abc...'
};
// Server may reject if invalid phase
```

**Action (deprecated)** - Old model, assumed success
```typescript
const action: GameAction = {
  type: 'build_ship',
  data: { shipDefId: 'DESTROYER' }
};
// No rejection model
```

### Event vs State Change

**Event** - What happened (immutable log)
```typescript
const event: ShipsChangedEvent = {
  type: 'SHIPS_CHANGED',
  created: ['ship-123'],
  seq: 42,
  atMs: serverTime
};
// Append-only log
```

**State Change** - Current game state
```typescript
gameState.gameData.ships[playerId].push(newShip);
// Mutable state
```

### Commit vs Reveal

**Commit** - Hash of hidden action
```typescript
const hash = sha256(JSON.stringify(payload) + nonce);
// Opponent can't see payload
```

**Reveal** - Unhashed payload
```typescript
const payload = { buildShips: [...] };
const nonce = 'random';
// Server verifies: sha256(payload + nonce) === storedHash
```

---

## 🔍 Debugging Guide

### Intent Rejected

**Check:**
1. Is intent valid for current phase/step?
2. Does player have required resources?
3. Does hash match stored commitment?
4. Is intent properly formed?

**Tools:**
- Check `rejected.code` for specific error
- Check `rejected.message` for human-readable description
- Check server logs for validation details

### Event Sequence Issues

**Check:**
1. Are events ordered by `seq` number?
2. Are there gaps in sequence?
3. Is client polling frequently enough?

**Tools:**
- Sort events by `seq` before displaying
- Log missing sequence numbers
- Check network tab for failed requests

### State Desynchronization

**Check:**
1. Is UI calculating instead of rendering state?
2. Is client mutating state locally?
3. Is polling interval too long?

**Tools:**
- Compare `gameState` to server response
- Check for local state mutations
- Enable verbose event logging

---

## 📚 Related Documentation

- `/game/types/IntentEventTypes.ts` - Type definitions
- `/guidelines/Guidelines.md` - Architecture constraints
- `/game/types/ActionTypes.tsx` - Legacy action types (deprecated)
- `/game/types/GameTypes.tsx` - Game state structure
- `/game/engine/GamePhases.tsx` - Phase/step definitions

---

**Summary:** The Intent/Event contract separates client intent from server authority. Clients emit GameIntent (attempts), server validates and returns IntentResponse with GameEvent[] (outcomes). This ensures server-authoritative game logic, multiplayer consistency, and complete event logging. UI never computes game state—only displays what server provides.
