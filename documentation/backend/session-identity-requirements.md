# Backend Session Identity Requirements
## Alpha v3 - Server Authority Enforcement

**Last Updated:** 2026-01-05  
**Status:** ✅ Enforced on all mutating endpoints

---

## Core Principle

**Server-minted identity is required for all mutating actions.**

- ❌ Client CANNOT send authoritative `playerId` or `opponentId`
- ✅ Server derives identity from session token (X-Session-Token header)
- ✅ All game state changes require valid session token
- ✅ Read-only operations on private data also require session token

---

## Session Token Flow

### Important: Dual-Header Architecture

**Supabase Edge Functions require MULTIPLE headers for proper operation:**

**Standard Request Headers (All Requests):**
```http
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json
X-Session-Token: {SESSION_TOKEN}  ← Only for protected endpoints
```

**Header Responsibilities:**

1. **`Authorization: Bearer {SUPABASE_ANON_KEY}`**
   - Required for Supabase edge function infrastructure access
   - Same for all requests (public anon key)
   - Validates request can reach the edge function
   - ⚠️ NEVER send session token in this header

2. **`apikey: {SUPABASE_ANON_KEY}`**
   - Alternative header for Supabase infrastructure
   - Same value as Authorization (without "Bearer" prefix)
   - Ensures compatibility across Supabase clients

3. **`X-Session-Token: {SESSION_TOKEN}`**
   - Required for application-level identity (protected endpoints only)
   - Unique per user session
   - Server derives playerId from this token
   - ⚠️ NEVER send in Authorization header

4. **`Content-Type: application/json`**
   - Standard header for JSON request/response bodies
   - Required for POST requests with body

**Why this architecture?**
- Cannot use `Authorization` for both infrastructure and app identity
- Edge function needs anon key to authorize function invocation
- Application needs session token to identify the player
- Separate headers prevent accidental token misuse

---

### 1. Session Creation (Public Endpoint)
```http
POST /make-server-825e19ab/session/start
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json

Response:
{
  "sessionToken": "a3f2e1...9c8d7b",
  "message": "Session created successfully"
}
```

**Behavior:**
- Public endpoint (no session required)
- Generates crypto-secure 64-character hex token
- Creates stable `sessionId` (internal identity)
- Stores in KV: `session_token_{token}` → session data
- 24-hour TTL (Alpha v3 configuration)

**Client Responsibility:**
- Store token in `localStorage` (key: `ss_sessionToken`)
- Include in all subsequent requests as `X-Session-Token: {token}`
- ⚠️ NEVER send session token in `Authorization` header

---

### 2. Mutating Endpoints (Session Required)

All endpoints that modify game state require the standard header set with `X-Session-Token`.

#### **Create Private Game**
```http
POST /make-server-825e19ab/create-game
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
Content-Type: application/json

{
  "playerName": "Alice"
}
```

**Server Behavior:**
- Validates Supabase anon key (edge function access)
- Validates `sessionToken` via `requireSession(c)` from X-Session-Token header
- Derives `playerId = session.sessionId` (SERVER AUTHORITY)
- Ignores any client-sent `playerId` field
- Creates game with server-minted player identity

**Alpha Constraint:**
- Private games only (no public matchmaking)
- Single player joins at creation
- Invite URL shared manually

---

#### **Join Private Game**
```http
POST /make-server-825e19ab/join-game/{gameId}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
Content-Type: application/json

{
  "playerName": "Bob",
  "role": "player"
}
```

**Server Behavior:**
- Validates `sessionToken` via `requireSession(c)`
- Derives `playerId = session.sessionId` (SERVER AUTHORITY)
- Prevents duplicate joins (same sessionId already in game)
- Adds player/spectator with server-minted identity

**Role Enforcement:**
- Maximum 2 active players per game
- Additional joiners forced to spectator role
- Spectators cannot switch to player if game full

---

#### **Send Action/Turn**
```http
POST /make-server-825e19ab/send-action/{gameId}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
Content-Type: application/json

{
  "actionType": "build_ship",
  "content": { "shipName": "Wedge", ... }
}
```

**Server Behavior:**
- Validates `sessionToken` via `requireSession(c)`
- Derives `playerId = session.sessionId` (SERVER AUTHORITY)
- Validates action allowed for player's current phase
- Applies game logic and stores result
- Returns updated game state

**Action Types:**
- `select_species` - Choose faction
- `roll_dice` - Roll dice for lines
- `build_ship` - Build ship with lines
- `save_lines` - Bank lines for next turn
- `set_ready` - Mark ready for phase advancement
- `message` - Send chat message
- `phase_action` - Perform phase-specific action (roll_dice, advance_phase, pass_turn, end_turn)

---

### DEV Action Submission (Alpha v3)

**Canonical Endpoint:** `POST /send-action/:gameId`

**Why /send-action (not /intent)?**
- `/intent` endpoint is the future canonical contract with commit/reveal protocol
- `/send-action` is simpler and fully functional for Alpha testing
- `/intent` requires complex validation (BUILD_COMMIT, BUILD_REVEAL, BATTLE_COMMIT, etc.)
- For Alpha E2E testing, `/send-action` provides minimal complexity

**Minimal Valid Payload Examples:**

```json
// Simplest action (no content required)
{
  "actionType": "set_ready"
}

// Species selection (content required)
{
  "actionType": "select_species",
  "content": { "species": "human" }
}

// Build ship (content required)
{
  "actionType": "build_ship",
  "content": { "shipId": "hu_wedge" }
}

// Save lines (content required)
{
  "actionType": "save_lines",
  "content": { "amount": 1 }
}

// Roll dice (no content required)
{
  "actionType": "roll_dice"
}

// Phase action (content required)
{
  "actionType": "phase_action",
  "content": { "action": "advance_phase" }
}

// Message (content is plain string)
{
  "actionType": "message",
  "content": "Hello!"
}
```

**DEV Harness Testing:**
- Use SessionDebugCard in Development Dashboard
- Submit actions with proper session headers
- Automatically refetches game state after submission
- Validates end-to-end flow: session → action → state update

---

#### **Switch Role**
```http
POST /make-server-825e19ab/switch-role/{gameId}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
Content-Type: application/json

{
  "newRole": "spectator"
}
```

**Server Behavior:**
- Validates `sessionToken` via `requireSession(c)`
- Derives `playerId = session.sessionId` (SERVER AUTHORITY)
- Switches player between `player` and `spectator` roles
- Validates game capacity (max 2 players)

---

#### **Intent API (Experimental)**
```http
POST /make-server-825e19ab/intent
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
Content-Type: application/json

{
  "intent": {
    "type": "BUILD_SHIP",
    "gameId": "game_abc123",
    "shipName": "Wedge"
  }
}
```

**Server Behavior:**
- Validates `sessionToken` via `requireSession(c)`
- **Overrides** `intent.playerId` with `session.sessionId`
- Delegates to game engine for validation
- Returns canonical event stream

**Note:** Client may send `playerId` in intent, but it is **IGNORED**.

---

### 3. Read-Only Endpoints

#### **Get Game State (Private - Session Required)**
```http
GET /make-server-825e19ab/game-state/{gameId}
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
X-Session-Token: {sessionToken}
```

**Server Behavior:**
- Validates `sessionToken` via `requireSession(c)`
- Derives `playerId = session.sessionId`
- Verifies player is participant (or spectator) in game
- Returns full game state (no hidden info filtering in Alpha)

**Why Session Required:**
- Game state contains private information
- Prevents unauthorized game state access
- Enforces participant-only viewing

**Alpha Simplification:**
- No hidden info filtering yet (all players see full state)
- Post-Alpha: Filter based on commit/reveal protocol

---

#### **Public Endpoints (No Session Required)**

These endpoints do not require session tokens:

```http
GET /make-server-825e19ab/health
GET /make-server-825e19ab/test-connection
GET /make-server-825e19ab/system-test
GET /make-server-825e19ab/endpoints
POST /make-server-825e19ab/echo
```

**Rationale:**
- Health checks for monitoring
- Test endpoints for deployment validation
- Metadata endpoints (list available endpoints)

---

## Authorization Enforcement

### Server Implementation

**Middleware Helper:**
```typescript
const requireSession = async (c: Context) => {
  // Extract session token from custom header
  const sessionToken = c.req.header('X-Session-Token');
  
  if (!sessionToken) {
    return c.json({ 
      error: 'Unauthorized',
      message: 'Missing X-Session-Token header'
    }, 401);
  }

  const session = await validateSessionToken(sessionToken);
  
  if (!session) {
    return c.json({ 
      error: 'Unauthorized',
      message: 'Invalid or expired session token'
    }, 401);
  }

  return session; // { sessionId, createdAt }
};
```

**Usage in Endpoints:**
```typescript
app.post("/make-server-825e19ab/create-game", async (c) => {
  // Validate session token and get server-side identity
  const session = await requireSession(c);
  if (session.error) return session; // Return 401 if validation failed

  const { playerName } = await c.req.json();
  
  // SERVER AUTHORITY: Derive identity from session
  const playerId = session.sessionId;
  
  // Client-sent playerId is IGNORED
  // ...
});
```

---

## Session Lifecycle

### Creation
1. Client calls `POST /session/start`
2. Server generates crypto-secure token (32 random bytes → 64 hex chars)
3. Server creates stable `sessionId` (internal identity key)
4. Server stores: `session_token_{token}` → `{ sessionId, createdAt }`
5. Client stores token in `localStorage`

### Usage
1. Client includes `Authorization: Bearer {token}` in all game requests
2. Server validates token exists and not expired (24h TTL)
3. Server derives `playerId = sessionId` from token
4. Game logic proceeds with server-minted identity

### Expiration
- **Alpha v3:** 24-hour TTL (long for testing convenience)
- **Post-Alpha:** 1-hour access token + 30-day refresh token
- Expired tokens return `401 Unauthorized`
- Client must create new session via `/session/start`

### Revocation
- **Alpha v3:** No explicit revocation endpoint
- Token expires after 24 hours
- **Post-Alpha:** Add `/session/revoke` and `/session/revoke-all`

---

## Security Guarantees

### What is Enforced ✅

1. **Server Identity Authority**
   - Server owns identity mapping (token → sessionId → playerId)
   - Client cannot forge or impersonate identities

2. **Crypto-Secure Tokens**
   - 32 random bytes (256 bits of entropy)
   - Unguessable tokens prevent brute force

3. **Action Attribution**
   - All actions traced to server-validated sessions
   - Audit trail links actions to sessionIds

4. **Game Isolation**
   - Sessions validated before game state access
   - Prevents cross-game data leakage

### What is NOT Enforced (Alpha Limitations) ⚠️

1. **No Rate Limiting**
   - Session creation not rate-limited
   - Action submission not throttled

2. **No Multi-Device Management**
   - Token in `localStorage` (single device)
   - No session listing/revocation UI

3. **Long TTL**
   - 24-hour sessions (convenience over security)
   - No auto-refresh mechanism

4. **No IP Validation**
   - Token valid from any IP
   - No device fingerprinting

---

## Migration from Legacy System

### Backward Compatibility

**Server accepts but ignores client-sent `playerId` fields:**
```typescript
// Client may send (legacy):
{ playerName: "Alice", playerId: "client_generated_id" }

// Server ignores playerId, uses session:
const playerId = session.sessionId; // ✅ Server authority
```

**Why:**
- Existing dev tools (App.tsx, GameTestInterface) still send `playerId`
- Server gracefully handles old request format
- No client errors during transition

### Breaking Changes

**None for Alpha v3 production flow:**
- MenuShell (primary entry point) updated to use session tokens
- GameShell uses session tokens
- Dev tools continue working (server ignores their playerIds)

**Future breaking changes (Post-Alpha):**
- Remove `playerId` field acceptance from request schemas
- Enforce session token on all endpoints (no public read access)
- Add authorization for spectators (read-only sessions)

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Missing X-Session-Token header. Session token required for this endpoint."
}
```

**Causes:**
- No `X-Session-Token` header
- Token not found in KV store
- Token expired (> 24 hours old)

**Client Action:**
- Call `POST /session/start` to get new token
- Retry request with new token in `X-Session-Token` header

---

### 403 Forbidden
```json
{
  "error": "Player not in game (session not recognized)"
}
```

**Causes:**
- Valid session, but `sessionId` not a participant in requested game
- Trying to access game state without being joined
- Session from different game instance

**Client Action:**
- Verify correct game ID
- Join game before attempting actions
- Check session matches participant

---

### 404 Not Found
```json
{
  "error": "Game not found"
}
```

**Causes:**
- Game ID doesn't exist
- Game deleted/expired
- Typo in game ID

**Client Action:**
- Verify game ID
- Create new game if old game expired

---

## Testing

### Manual Test Flow

1. **Create Session:**
```bash
curl -X POST https://{PROJECT_ID}.supabase.co/functions/v1/make-server-825e19ab/session/start \
  -H "Authorization: Bearer {ANON_KEY}"
# → { "sessionToken": "a3f2..." }
```

2. **Create Game with Session:**
```bash
TOKEN="a3f2..."
curl -X POST https://{PROJECT_ID}.supabase.co/functions/v1/make-server-825e19ab/create-game \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "X-Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"playerName":"Test Player"}'
# → { "gameId": "game_abc123" }
```

3. **Verify Server Logs:**
```
✅ Session created: session_1704470400_xyz
Creating game - Session: session_1704470400_xyz, Display name: Test Player
Game created: game_abc123
```

4. **Test Unauthorized Access:**
```bash
curl -X POST https://{PROJECT_ID}.supabase.co/functions/v1/make-server-825e19ab/create-game \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"playerName":"Test"}'
# → 401 Unauthorized (missing X-Session-Token)
```

---

## DEV Test Harness

### Session + Game Debug Card

**Location:** `/App.tsx` - `SessionDebugCard` component in Development Dashboard  
**Availability:** DEV mode only (not visible in PLAYER mode)  
**Purpose:** Alpha v3 E2E testing without navigating to player UI

**Features:**
- Display session status and token preview (first 6 chars only)
- Display current gameId (if known)
- Show last API result (success/error + HTTP status code)
- Quick-test buttons for all core endpoints

**Controls:**
1. **Start / Refresh Session** - Calls `POST /session/start` or `ensureSession()`
2. **Create Private Game** - Calls `POST /create-game` with test player name
3. **Join Game** - Input field accepts gameId or full invite URL, calls `POST /join-game/:gameId`
4. **Fetch Game State** - Calls `GET /game-state/:gameId` for current game
5. *(Send Dummy Action omitted - payload shape varies by game phase)*

**Error Logging:**
- All errors include server response body text in console logs
- Token preview only (first 6 chars) in UI and logs, never full token
- HTTP status codes displayed in result card

**Usage Example:**
```
1. Open DEV mode (not PLAYER mode)
2. Navigate to Development Dashboard
3. Find "Alpha v3 Session Testing" section
4. Click "Start / Refresh Session" → Session token created
5. Click "Create Private Game" → Game created, gameId displayed
6. Copy gameId, paste in "Join Game" input (in different browser/tab)
7. Click "Fetch Game State" → Verify game state contains both players
```

**Integration:**
- Uses `authenticatedPost()` and `authenticatedFetch()` from `/utils/sessionManager.ts`
- Automatically includes both `Authorization` and `X-Session-Token` headers
- No manual header configuration needed

---

## Summary

| Aspect | Requirement | Status |
|--------|-------------|--------|
| Session creation | Public endpoint | ✅ Implemented |
| Token security | Crypto-secure 256-bit | ✅ Implemented |
| TTL | 24 hours (Alpha) | ✅ Implemented |
| Create game | Requires session | ✅ Enforced |
| Join game | Requires session | ✅ Enforced |
| Send action | Requires session | ✅ Enforced |
| Switch role | Requires session | ✅ Enforced |
| Intent API | Requires session | ✅ Enforced |
| Get game state | Requires session | ✅ Enforced |
| Server derives identity | playerId = sessionId | ✅ Enforced |
| Client-sent IDs ignored | Legacy compat | ✅ Enforced |
| Public lobby | Not in Alpha | ❌ Not implemented |
| Email/password auth | Not in Alpha | ❌ Disabled |

**All mutating endpoints now enforce server-minted session identity.**
