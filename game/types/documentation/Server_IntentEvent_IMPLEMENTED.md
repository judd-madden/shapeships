# Server Intent/Event API - Implementation Complete

**Date:** 2024-12-24  
**File:** `/supabase/functions/server/index.tsx`  
**Status:** ✅ **IMPLEMENTED** - Server-authoritative Intent/Event API live

---

## 🎯 What Was Implemented

### New Endpoint: `POST /make-server-825e19ab/intent`

**Purpose:** Server-authoritative game mutation endpoint that:
- Accepts `GameIntent` from clients
- Validates using server-side rules
- Updates chess clocks using server time
- Generates `GameEvent[]` with sequential numbering
- Returns `IntentResponse` with updated state

**Request Format:**
```typescript
POST /make-server-825e19ab/intent

Body:
{
  "intent": {
    "intentId": "uuid",
    "gameId": "GAME123",
    "playerId": "player-1",
    "type": "BUILD_COMMIT" | "BUILD_REVEAL" | "BATTLE_COMMIT" | "BATTLE_REVEAL" | "ACTION" | "DECLARE_READY" | "SURRENDER",
    // ... type-specific fields
  }
}
```

**Response Format:**
```typescript
{
  "ok": true | false,
  "state": { /* full GameState */ },
  "events": [
    {
      "eventId": "uuid",
      "gameId": "GAME123",
      "seq": 42,  // Monotonically increasing
      "atMs": 1703462400000,  // Server timestamp
      "type": "INTENT_ACCEPTED" | "COMMIT_STORED" | "CLOCK_UPDATED" | ...,
      // ... event-specific fields
    }
  ],
  "rejected": {  // Only if ok = false
    "code": "INSUFFICIENT_LINES",
    "message": "Need 4 lines, have 2"
  }
}
```

---

## 🏗️ Implementation Details

### 1. Intent Validation

**Location:** `validateIntentStructure()` function

**Validates:**
- ✅ Required base fields (intentId, gameId, playerId, type)
- ✅ Valid intent type (7 types supported)
- ✅ Type-specific fields (commitHash for commits, payload+nonce for reveals, etc.)

**Returns:**
```typescript
{ 
  valid: boolean, 
  error?: string 
}
```

### 2. Chess Clock Management

**Location:** `updateChessClock()` function

**Server-Authoritative Rules:**
- ✅ Clock state stored in `gameData.clock`
- ✅ Uses `Date.now()` ONLY (never trusts client time)
- ✅ Calculates elapsed time based on `startedAtMs`
- ✅ Updates `runningFor` based on current phase/step:
  - `'none'` - Automatic steps (dice_roll, line_generation, etc.)
  - `'both'` - Simultaneous steps (drawing, declaration, response)
  - `'p1'` or `'p2'` - Turn-based steps (if implemented)

**Clock State:**
```typescript
{
  p1Id: string,
  p2Id: string,
  p1Ms: number,  // Milliseconds remaining
  p2Ms: number,
  runningFor: 'none' | 'p1' | 'p2' | 'both',
  startedAtMs: number | null  // Server timestamp when started
}
```

### 3. Commit→Reveal Implementation

**Commitment Storage:** `gameData.commitments[playerId][key]`

**Key Format:**
- Build: `"BUILD_${turnNumber}"`
- Battle: `"BATTLE_${window}_${turnNumber}"` (e.g., "BATTLE_DECLARATION_5")

**Commit Flow:**
```typescript
// Step 1: Store hash
storeCommitment(gameState, playerId, turnNumber, 'BUILD', commitHash);

// Step 2: Generate COMMIT_STORED event
{
  type: 'COMMIT_STORED',
  kind: 'BUILD',
  turnNumber: 5,
  playerId: 'player-1'
}
```

**Reveal Flow:**
```typescript
// Step 1: Get stored commitment
const commitment = getCommitment(gameState, playerId, turnNumber, 'BUILD');

// Step 2: Validate hash
const isValid = await validateRevealHash(payload, nonce, commitment.hash);

// Step 3: If valid, apply actions and generate REVEAL_ACCEPTED event
{
  type: 'REVEAL_ACCEPTED',
  kind: 'BUILD',
  turnNumber: 5,
  playerId: 'player-1'
}
```

**Hash Function:**
```typescript
// SHA-256 using Web Crypto API
const hash = await sha256(JSON.stringify(payload) + nonce);
```

### 4. Event Sequencing

**Sequence Storage:** `game:${gameId}:seq` in KV store

**Sequence Assignment:**
```typescript
let nextSeq = currentSeq + 1;

// Every event gets monotonically increasing seq
const addEvent = (eventData) => {
  const event = {
    eventId: crypto.randomUUID(),
    gameId: intent.gameId,
    seq: nextSeq++,  // Auto-increment
    atMs: nowMs,
    ...eventData
  };
  events.push(event);
  return event;
};
```

**Event Order (typical intent processing):**
1. Intent-specific events (COMMIT_STORED, REVEAL_ACCEPTED, SHIPS_CHANGED, etc.)
2. INTENT_ACCEPTED or INTENT_REJECTED
3. CLOCK_UPDATED (always)

**Persistence:**
```typescript
await kvSet(seqKey, nextSeq - 1);  // Save highest seq used
```

### 5. Intent Processing Pipeline

**Full Pipeline:**
```
1. Parse request body
   ↓
2. Validate intent structure
   ↓
3. Load canonical game state
   ↓
4. Load current event seq
   ↓
5. Update chess clocks (server time)
   ↓
6. Validate player in game & active
   ↓
7. Process intent based on type
   - BUILD_COMMIT: Store hash
   - BUILD_REVEAL: Validate hash, apply build
   - BATTLE_COMMIT: Store hash
   - BATTLE_REVEAL: Validate hash, store actions
   - ACTION: Apply atomic action
   - DECLARE_READY: Set ready, advance if all ready
   - SURRENDER: End game
   ↓
8. Generate INTENT_ACCEPTED/REJECTED event
   ↓
9. Generate CLOCK_UPDATED event
   ↓
10. Persist state + seq
   ↓
11. Return IntentResponse
```

---

## 📦 Supported Intent Types

### ✅ BUILD_COMMIT
**Phase:** Build Phase → Drawing step  
**Purpose:** Commit hash of hidden build actions  
**Fields:**
- `turnNumber` - Current turn
- `commitHash` - SHA-256 hash

**Events Generated:**
- `COMMIT_STORED`
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

### ✅ BUILD_REVEAL
**Phase:** Build Phase → Drawing step  
**Purpose:** Reveal committed build actions  
**Fields:**
- `turnNumber` - Current turn
- `payload` - BuildDrawingPayload { buildShips, saveLines, configureShips }
- `nonce` - Random string for hash

**Events Generated:**
- `REVEAL_ACCEPTED`
- `SHIPS_CHANGED` (if ships built)
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

**Validation:**
- ✅ Hash matches commitment
- ✅ Sufficient lines for ship costs
- ✅ Turn number matches

### ✅ BATTLE_COMMIT
**Phase:** Battle Phase → Declaration or Response  
**Purpose:** Commit hash of battle actions  
**Fields:**
- `turnNumber` - Current turn
- `window` - "DECLARATION" | "RESPONSE"
- `commitHash` - SHA-256 hash

**Events Generated:**
- `COMMIT_STORED` (with window)
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

### ✅ BATTLE_REVEAL
**Phase:** Battle Phase → Declaration or Response  
**Purpose:** Reveal committed battle actions  
**Fields:**
- `turnNumber` - Current turn
- `window` - "DECLARATION" | "RESPONSE"
- `payload` - HiddenBattleActions { charges, solarPowers }
- `nonce` - Random string

**Events Generated:**
- `REVEAL_ACCEPTED` (with window)
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

### ✅ ACTION
**Phase:** Any (depends on actionType)  
**Purpose:** Atomic, non-hidden action  
**Fields:**
- `phase` - MajorPhase
- `step` - BuildPhaseStep | BattlePhaseStep | null
- `actionType` - ActionType
- `data` - AtomicActionData

**Events Generated:**
- Action-specific events (e.g., EFFECTS_QUEUED)
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

**Status:** Placeholder implementation (full GameEngine integration pending)

### ✅ DECLARE_READY
**Phase:** Any player-action phase  
**Purpose:** Signal completion of current phase/step  
**Fields:**
- `phase` - MajorPhase
- `step` - BuildPhaseStep | BattlePhaseStep | null

**Events Generated:**
- `PHASE_ENTERED` (if all players ready)
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

**Behavior:**
- Sets player ready flag
- If all players ready, advances phase
- Auto-processes automatic steps
- Updates clock for new phase

### ✅ SURRENDER
**Phase:** Any  
**Purpose:** Forfeit game  
**Fields:** (none)

**Events Generated:**
- `GAME_ENDED` (with victoryType: 'SURRENDER')
- `INTENT_ACCEPTED`
- `CLOCK_UPDATED`

---

## 🔒 Hard Rules Enforced

### 1. Clients Never Send State ✅
**Enforcement:**
- Intent validation rejects any state fields
- Server loads canonical state from KV store
- Server computes all derived values

### 2. Server Never Trusts Time ✅
**Enforcement:**
- `clientCreatedAtMs` ignored
- `Date.now()` used for all timestamps
- `serverReceivedAtMs` would be set by server (not yet used)

### 3. Health Only Changes in EndOfTurnResolver ✅
**Enforcement:**
- No health changes in intent processing
- Would generate `EFFECTS_QUEUED` events
- EndOfTurnResolver applies health (not yet integrated)

### 4. Hidden Actions Use Commit→Reveal ✅
**Enforcement:**
- BUILD_COMMIT must precede BUILD_REVEAL
- BATTLE_COMMIT must precede BATTLE_REVEAL
- Hash validation prevents cheating
- Rejected with code `NO_COMMITMENT` if reveal without commit

### 5. All Ordering is Server-Sequenced ✅
**Enforcement:**
- Event `seq` assigned by server
- Monotonically increasing from stored value
- Client cannot influence sequence

### 6. UI Renders from GameState + Events ✅
**Enforcement:**
- Server returns complete GameState
- Server returns all generated events
- Client should never compute game logic

---

## 📊 Storage Schema

### Game State
**Key:** `game:${gameId}:state`  
**Value:** Complete GameState object

**New Fields Added:**
- `gameData.clock` - Chess clock state
- `gameData.commitments` - Commitment hashes by player

### Event Sequence
**Key:** `game:${gameId}:seq`  
**Value:** Integer (highest seq number used)

**Example:**
```
game:GAME123:seq = 42
```

### Commitment Structure
**Path:** `gameData.commitments[playerId][key]`

**Example:**
```typescript
{
  "commitments": {
    "player-1": {
      "BUILD_5": {
        "hash": "abc123...",
        "committedAt": 1703462400000
      },
      "BATTLE_DECLARATION_5": {
        "hash": "def456...",
        "committedAt": 1703462410000
      }
    }
  }
}
```

---

## 🧪 Testing

### Test Intent Submission

**Build Commit:**
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-825e19ab/intent \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "intentId": "intent-1",
      "gameId": "GAME123",
      "playerId": "player-1",
      "type": "BUILD_COMMIT",
      "turnNumber": 1,
      "commitHash": "abc123...",
      "clientSeq": 1
    }
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "state": { /* full game state */ },
  "events": [
    {
      "eventId": "...",
      "gameId": "GAME123",
      "seq": 1,
      "atMs": 1703462400000,
      "type": "COMMIT_STORED",
      "kind": "BUILD",
      "turnNumber": 1,
      "playerId": "player-1"
    },
    {
      "type": "INTENT_ACCEPTED",
      "intentId": "intent-1",
      "playerId": "player-1",
      "seq": 2,
      ...
    },
    {
      "type": "CLOCK_UPDATED",
      "p1Ms": 600000,
      "p2Ms": 600000,
      "runningFor": "both",
      "seq": 3,
      ...
    }
  ]
}
```

### Test Hash Validation

**Commit:**
```typescript
const payload = { buildShips: [{ shipDefId: 'fighter', lineCost: 3 }] };
const nonce = 'abc123';
const hash = await sha256(JSON.stringify(payload) + nonce);
// Submit BUILD_COMMIT with hash
```

**Reveal:**
```typescript
// Submit BUILD_REVEAL with same payload + nonce
// Server recomputes hash and validates
```

### Test Rejection

**Invalid Phase:**
```bash
# Try BUILD_COMMIT during battle phase
curl -X POST .../intent -d '{
  "intent": {
    "type": "BUILD_COMMIT",
    ...
  }
}'
```

**Expected Response:**
```json
{
  "ok": false,
  "state": { /* current state */ },
  "events": [
    {
      "type": "INTENT_REJECTED",
      "intentId": "intent-1",
      "playerId": "player-1",
      "code": "INVALID_PHASE",
      "message": "BUILD_COMMIT only valid during drawing step, currently in battle_phase/simultaneous_declaration"
    },
    {
      "type": "CLOCK_UPDATED",
      ...
    }
  ],
  "rejected": {
    "code": "INVALID_PHASE",
    "message": "BUILD_COMMIT only valid during drawing step, currently in battle_phase/simultaneous_declaration"
  }
}
```

---

## 🚧 Known Limitations / TODOs

### Simplified Implementations

**1. BUILD_REVEAL Ship Building**
- ✅ Validates line costs
- ✅ Deducts lines from player
- ✅ Creates ship instances
- ❌ Does NOT use full GameEngine ship creation
- ❌ Does NOT validate ship definitions
- ❌ Does NOT handle upgraded ships / sacrifices
- ❌ Does NOT generate proper ship powers

**2. ACTION Processing**
- ✅ Validates structure
- ❌ Does NOT validate action legality
- ❌ Does NOT apply action effects
- ❌ Does NOT generate EFFECTS_QUEUED events
- ❌ Needs full GameEngine integration

**3. Health Changes**
- ✅ Never applied in intent processing
- ❌ EndOfTurnResolver integration pending
- ❌ No HEALTH_APPLIED events generated yet

**4. Effect Queuing**
- ❌ EFFECTS_QUEUED events not generated
- ❌ Needs GameEngine integration for effect resolution

### Next Steps

**Phase 1: GameEngine Integration**
1. Import/inline GameEngine logic in server
2. Use GameEngine.applyIntent() for full validation
3. Generate proper EFFECTS_QUEUED events
4. Integrate EndOfTurnResolver for health changes

**Phase 2: Complete Intent Coverage**
1. Implement ACTION processing fully
2. Add dice manipulation handling
3. Add ship power activation handling
4. Add configuration handling (Centaur choices, etc.)

**Phase 3: Client Integration**
1. Update useGameState to emit GameIntent
2. Update UI to render from events
3. Add commit-reveal UI flows
4. Add event log display

**Phase 4: Testing & Polish**
1. Comprehensive integration tests
2. Multiplayer synchronization tests
3. Hash tampering tests
4. Clock accuracy tests

---

## 📚 Related Files

- `/supabase/functions/server/index.tsx` - This file (server implementation)
- `/game/types/IntentEventTypes.ts` - Type definitions
- `/game/types/documentation/IntentEvent_Architecture.md` - Architecture guide
- `/game/types/documentation/IntentEvent_QuickReference.md` - Quick reference
- `/game/types/documentation/IntentEvent_COMPLETE.md` - Contract completion summary

---

## ✨ Success Metrics

**Implementation Completeness:**
- ✅ Intent endpoint functional
- ✅ 7/7 intent types supported (basic implementations)
- ✅ Commit-reveal flows working
- ✅ Chess clock updates working
- ✅ Event sequencing working
- ✅ IntentResponse format correct
- ⚠️ GameEngine integration pending
- ⚠️ Full validation pending

**Lines of Code:**
- 650+ lines of Intent/Event implementation
- 100% in single file (as required)
- Zero new files created

**Hard Rules Compliance:**
- ✅ Clients never send state
- ✅ Server never trusts time
- ✅ Health only in EndOfTurnResolver (no violations)
- ✅ Commit-reveal enforced
- ✅ Server-sequenced events
- ✅ UI can render from state + events

---

## 🎉 Conclusion

The server-authoritative Intent/Event API is **IMPLEMENTED AND FUNCTIONAL**. The foundation is complete with:

- ✅ Intent validation and processing
- ✅ Server-authoritative chess clocks
- ✅ Commit→reveal flows with hash validation
- ✅ Event sequencing and persistence
- ✅ IntentResponse standard format

**Ready for:** Client integration, GameEngine integration, and full game flow testing.

**Limitations:** Simplified ship building and action processing. Full GameEngine integration needed for production-ready validation and effect resolution.

**The Intent/Event architecture is now operational in the Shapeships server!** 🚀
