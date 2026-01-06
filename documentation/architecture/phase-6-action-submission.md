# Phase 6: Minimal Turn Loop in DEV Harness
## End-to-End Action Submission with Session Identity

**Date:** 2026-01-05  
**Status:** ✅ Complete  
**Purpose:** Prove E2E action submission works with session identity (DEV-only first)

---

## Overview

Implemented a DEV-only UI in the SessionDebugCard that allows submitting ONE valid action for the current player and refetching game state after submission. This proves the full end-to-end flow:

```
Session Token → Action Submission → Server Validation → State Update → State Fetch
```

**Hard Rule Followed:** No payload guessing - used exact server-side expected schema.

---

## A) Canonical Action Submission Contract

### Endpoint Analysis

**Two endpoints available:**

1. **POST /send-action/:gameId** (Legacy/Simple)
   - Simple action contract
   - Required fields: `actionType` (string)
   - Optional fields: `content` (object), `timestamp` (string)
   - Action types: `select_species`, `set_ready`, `build_ship`, `save_lines`, `roll_dice`, `phase_action`, `message`
   - Already functional and working

2. **POST /intent** (Future Canonical)
   - Complex Intent/Event contract
   - Required fields: `intent.intentId`, `intent.gameId`, `intent.playerId`, `intent.type`
   - Intent types: `BUILD_COMMIT`, `BUILD_REVEAL`, `BATTLE_COMMIT`, `BATTLE_REVEAL`, `ACTION`, `DECLARE_READY`, `SURRENDER`
   - Requires commit/reveal protocol with hashes and nonces
   - Type-specific validation (commitHash, turnNumber, window, payload, nonce, phase, actionType, data)

### Decision: Use /send-action for Alpha

**Rationale:**
- `/send-action` is simpler and fully functional
- `/intent` requires complex commit/reveal mechanics not needed for Alpha testing
- Purpose is to prove E2E works, not implement full production protocol
- Server documentation says "All game mutations flow through POST /intent" but that's future-state
- `/send-action` is the working endpoint right now

**Canonical Endpoint:** `POST /send-action/:gameId`

---

## Action Type Schema (from server code)

### Required Field
```typescript
actionType: string  // Required, validated by server
```

### Action Types and Content Requirements

#### 1. `select_species`
**Content Required:** `{ species: string }`

**Valid species:** `"human" | "xenite" | "centaur" | "ancient"`

**Server behavior:**
- Validates species against allowed list
- Sets player faction
- May promote spectator to player if slots available
- Auto-sets ready after selection during setup phase

**Example:**
```json
{
  "actionType": "select_species",
  "content": { "species": "human" }
}
```

---

#### 2. `set_ready`
**Content Required:** None

**Server behavior:**
- Marks player as ready for phase advancement
- Only active players (not spectators) allowed
- May trigger phase advancement if all players ready

**Example:**
```json
{
  "actionType": "set_ready"
}
```

---

#### 3. `build_ship`
**Content Required:** `{ shipId: string }`

**Server behavior:**
- Creates ship with ID, name, health, damage values
- Deducts line cost from player
- Only active players allowed
- Validates player has enough lines

**Example:**
```json
{
  "actionType": "build_ship",
  "content": { "shipId": "hu_wedge" }
}
```

---

#### 4. `save_lines`
**Content Required:** `{ amount: number }`

**Server behavior:**
- Deducts specified lines from player
- Saves for later use (storage not yet implemented)
- Validates player has enough lines
- Only active players allowed

**Example:**
```json
{
  "actionType": "save_lines",
  "content": { "amount": 1 }
}
```

---

#### 5. `roll_dice`
**Content Required:** None

**Server behavior:**
- Rolls 1d6
- Gives lines to ALL active players (shared roll)
- Only active players allowed
- Stores roll in gameData.diceRoll

**Example:**
```json
{
  "actionType": "roll_dice"
}
```

---

#### 6. `phase_action`
**Content Required:** `{ action: string }`

**Valid actions:** `"roll_dice" | "advance_phase" | "pass_turn" | "end_turn"`

**Server behavior:**
- Performs phase-specific action
- Only active players allowed
- `roll_dice` sub-action: rolls dice and gives lines to player

**Example:**
```json
{
  "actionType": "phase_action",
  "content": { "action": "advance_phase" }
}
```

---

#### 7. `message`
**Content Required:** Plain string (not object)

**Server behavior:**
- Stores message in action log
- Allowed for all players (including spectators)

**Example:**
```json
{
  "actionType": "message",
  "content": "Hello, world!"
}
```

---

## Validation Rules (from server)

### Phase-Based Validation
```typescript
// Server validates action is allowed for current step
const validActions = ServerPhaseEngine.getValidActionsForCurrentStep(gameData, playerId);

// Key game actions get permissive treatment
const isKeyGameAction = ['build_ship', 'save_lines', 'select_species', 'roll_dice'].includes(actionType);

// Allows key actions if they make contextual sense even if not in validActions list
```

### Role-Based Restrictions
- **Spectators:** Can only send `message` and `select_species` (if slots available)
- **Active players:** Can perform all actions based on phase

### Error Responses
```json
// Missing actionType
{ "error": "Action type is required" }

// Invalid action for phase
{ 
  "error": "Action 'build_ship' not allowed in current subphase. Valid actions: set_ready, message. Current phase: setup"
}

// Spectator restriction
{ "error": "Only active players can build ships" }

// Not in game
{ "error": "Player not in game (session not recognized)" }
```

---

## B) DEV-Only Submit Action UI

### Implementation: SessionDebugCard Component

**Location:** `/App.tsx` (lines 1724-2139)

**New State:**
```typescript
const [selectedAction, setSelectedAction] = useState<string>('set_ready');
const [actionContent, setActionContent] = useState<any>({});
```

### UI Components

#### 1. Action Type Dropdown
```tsx
<select value={selectedAction} onChange={...}>
  <option value="set_ready">set_ready (no content)</option>
  <option value="select_species">select_species</option>
  <option value="build_ship">build_ship</option>
  <option value="save_lines">save_lines</option>
  <option value="roll_dice">roll_dice (no content)</option>
  <option value="phase_action">phase_action</option>
  <option value="message">message</option>
</select>
```

#### 2. Dynamic Content Fields

**Species selector (for select_species):**
```tsx
<select value={actionContent.species || ''} onChange={...}>
  <option value="">Select species...</option>
  <option value="human">human</option>
  <option value="xenite">xenite</option>
  <option value="centaur">centaur</option>
  <option value="ancient">ancient</option>
</select>
```

**Ship ID input (for build_ship):**
```tsx
<Input
  placeholder="Ship ID (e.g., hu_wedge)"
  value={actionContent.shipId || ''}
  onChange={(e) => setActionContent({ shipId: e.target.value })}
/>
```

**Amount input (for save_lines):**
```tsx
<Input
  type="number"
  placeholder="Amount (e.g., 1)"
  value={actionContent.amount || ''}
  onChange={(e) => setActionContent({ amount: e.target.value })}
/>
```

**Message input (for message):**
```tsx
<Input
  placeholder="Message text"
  value={actionContent.message || ''}
  onChange={(e) => setActionContent({ message: e.target.value })}
/>
```

**Phase action selector (for phase_action):**
```tsx
<select value={actionContent.action || ''} onChange={...}>
  <option value="">Select phase action...</option>
  <option value="roll_dice">roll_dice</option>
  <option value="advance_phase">advance_phase</option>
  <option value="pass_turn">pass_turn</option>
  <option value="end_turn">end_turn</option>
</select>
```

#### 3. Submit Button
```tsx
<Button 
  onClick={handleSubmitAction} 
  disabled={isLoading || !sessionToken || !currentGameId}
  variant="default" 
  size="sm"
>
  {isLoading ? 'Loading...' : 'Submit Action'}
</Button>
```

---

### Action Submission Handler

```typescript
const handleSubmitAction = async () => {
  // 1. Validation
  if (!currentGameId) {
    setLastResult({ success: false, message: 'No gameId set', status: 0 });
    return;
  }
  
  setIsLoading(true);
  setLastResult(null);
  
  try {
    // 2. Build payload based on selected action type
    const payload: any = { actionType: selectedAction };
    
    // 3. Add content field if action requires it
    if (selectedAction === 'select_species' && actionContent.species) {
      payload.content = { species: actionContent.species };
    } else if (selectedAction === 'build_ship' && actionContent.shipId) {
      payload.content = { shipId: actionContent.shipId };
    } else if (selectedAction === 'save_lines' && actionContent.amount) {
      payload.content = { amount: parseInt(actionContent.amount) };
    } else if (selectedAction === 'message' && actionContent.message) {
      payload.content = actionContent.message; // Plain string, not object
    } else if (selectedAction === 'phase_action' && actionContent.action) {
      payload.content = { action: actionContent.action };
    }
    
    console.log('📤 Submitting action:', payload);
    
    // 4. Submit with authenticated headers
    const response = await authenticatedPost(`/send-action/${currentGameId}`, payload);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    // 5. Parse result
    const data = await response.json();
    setLastResult({ 
      success: true, 
      message: `Action submitted: ${selectedAction} → ${data.message || 'Success'}`,
      status: response.status
    });
    console.log('✅ Action result:', data);
    
    // 6. Immediately fetch updated game state
    setTimeout(() => handleFetchGameState(), 200);
    
  } catch (error) {
    console.error('Submit action error:', error);
    setLastResult({ 
      success: false, 
      message: `Error: ${error.message}`,
      status: 0
    });
  } finally {
    setIsLoading(false);
  }
};
```

---

## Request/Response Flow

### 1. Submit Action Request

**Headers:**
```http
POST /make-server-825e19ab/send-action/{gameId}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
Content-Type: application/json
```

**Body (example: set_ready):**
```json
{
  "actionType": "set_ready"
}
```

### 2. Server Processing

1. **Validate session:** `requireSession(c)` extracts and validates X-Session-Token
2. **Derive identity:** `playerId = session.sessionId`
3. **Validate action:** Check actionType against phase-specific valid actions
4. **Apply game logic:** Update game state based on action type
5. **Store result:** Save updated game state to KV store
6. **Return response:** Send success message

### 3. Action Response

**Success (200):**
```json
{
  "message": "Marked as ready",
  "success": true
}
```

**Error (400 - invalid action):**
```json
{
  "error": "Action 'build_ship' not allowed in current subphase. Valid actions: set_ready, message. Current phase: setup"
}
```

**Error (403 - spectator):**
```json
{
  "error": "Only active players can build ships"
}
```

**Error (401 - no session):**
```json
{
  "error": "Unauthorized",
  "message": "Missing X-Session-Token header. Session token required for this endpoint."
}
```

### 4. Auto-Fetch Game State

**After successful action submission:**
```typescript
setTimeout(() => handleFetchGameState(), 200);
```

**Fetches:**
```http
GET /make-server-825e19ab/game-state/{gameId}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
```

**Response:**
```json
{
  "gameId": "game_abc123",
  "players": [...],
  "gameData": {
    "currentPhase": "ship_building",
    "turnNumber": 1,
    ...
  },
  ...
}
```

---

## C) Files Modified

### 1. `/App.tsx` (+115 lines)

**Changes:**
- Added `selectedAction` and `actionContent` state to SessionDebugCard
- Implemented `handleSubmitAction()` handler
- Added action type dropdown with 7 options
- Added dynamic content fields based on selected action
- Added Submit Action button
- Added auto-refetch of game state after successful submission
- Added separator and section header

**Lines modified:** 1724-2139

---

### 2. `/documentation/backend/session-identity-requirements.md` (+70 lines)

**Changes:**
- Added "DEV Action Submission (Alpha v3)" section
- Documented canonical endpoint choice (/send-action vs /intent)
- Provided minimal valid payload examples for all 7 action types
- Explained DEV harness testing workflow

**Section added:** Lines 180-250

---

## D) Testing Procedure

### Test Flow

1. **Start Session**
   - Click "Start / Refresh Session"
   - Verify session token shows "Yes" and preview appears

2. **Create Game**
   - Click "Create Private Game"
   - Verify success message with gameId
   - Note gameId in Current GameId field

3. **Submit Action (set_ready)**
   - Leave action type as "set_ready" (default)
   - Click "Submit Action"
   - Verify success message appears
   - Verify game state auto-fetches (check console for "✅ Game state")

4. **Submit Action (select_species)**
   - Change action type to "select_species"
   - Select species from dropdown (e.g., "human")
   - Click "Submit Action"
   - Verify success message
   - Check console for updated game state with faction set

5. **Submit Action (message)**
   - Change action type to "message"
   - Type message in text field
   - Click "Submit Action"
   - Verify message added to action log (check console)

### Expected Console Output

```
📤 Submitting action: { actionType: 'set_ready' }
✅ Action result: { message: 'Marked as ready', success: true }
🔐 Authenticated request to /game-state/game_abc123
✅ Game state: { gameId: 'game_abc123', players: [...], ... }
```

---

## E) Minimal Valid Payloads (Reference)

### Simplest Action (No Content)
```json
{ "actionType": "set_ready" }
{ "actionType": "roll_dice" }
```

### Species Selection
```json
{
  "actionType": "select_species",
  "content": { "species": "human" }
}
```

### Build Ship
```json
{
  "actionType": "build_ship",
  "content": { "shipId": "hu_wedge" }
}
```

### Save Lines
```json
{
  "actionType": "save_lines",
  "content": { "amount": 1 }
}
```

### Phase Action
```json
{
  "actionType": "phase_action",
  "content": { "action": "advance_phase" }
}
```

### Message
```json
{
  "actionType": "message",
  "content": "Hello, world!"
}
```

---

## Summary

**Phase 6 Complete:** ✅

**Canonical endpoint:** `POST /send-action/:gameId`

**Why /send-action:**
- Simpler than /intent (no commit/reveal protocol)
- Fully functional for Alpha testing
- Minimal complexity for E2E validation

**Minimal valid payload:**
```json
{ "actionType": "set_ready" }
```

**Files changed:**
1. `/App.tsx` - Added Submit Action UI to SessionDebugCard (+115 lines)
2. `/documentation/backend/session-identity-requirements.md` - Documented action schema (+70 lines)

**No endpoint changes:** Server behavior unchanged, only added client UI.

**E2E flow proven:**
```
Session Token → Action Submission → Server Validation → State Update → State Fetch → UI Display
```

**Next steps:**
- Test with two sessions in separate browser tabs (multiplayer validation)
- Verify phase-based action restrictions work correctly
- Test error handling (invalid actions, wrong phase, etc.)
