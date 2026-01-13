# Intent Protocol - Manual Verification Guide

This guide provides curl commands for manually testing the commit/reveal protocol.

## Prerequisites

```bash
# Set these environment variables
export BASE_URL="https://YOUR_PROJECT_ID.supabase.co/functions/v1"
export SUPABASE_ANON_KEY="your_anon_key_here"
export SESSION_TOKEN_A="player_a_session_token"
export SESSION_TOKEN_B="player_b_session_token"
export GAME_ID="your_game_id"
```

## Setup: Create Sessions and Game

### 1. Create Session for Player A
```bash
curl -X POST "$BASE_URL/make-server-825e19ab/session/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"displayName": "Test Player A"}'

# Response: { "sessionToken": "...", "sessionId": "...", "displayName": "Test Player A" }
# Save sessionToken as SESSION_TOKEN_A
```

### 2. Create Session for Player B
```bash
curl -X POST "$BASE_URL/make-server-825e19ab/session/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"displayName": "Test Player B"}'

# Response: { "sessionToken": "...", "sessionId": "...", "displayName": "Test Player B" }
# Save sessionToken as SESSION_TOKEN_B
```

### 3. Player A Creates Game
```bash
curl -X POST "$BASE_URL/make-server-825e19ab/create-game" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_A" \
  -d '{"playerName": "Test Player A"}'

# Response: { "gameId": "...", ... }
# Save gameId as GAME_ID
```

### 4. Player B Joins Game
```bash
curl -X POST "$BASE_URL/make-server-825e19ab/join-game/$GAME_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_B" \
  -d '{"playerName": "Test Player B", "role": "player"}'
```

## Computing Commit Hashes

Use this JavaScript snippet to compute hashes:

```javascript
// In browser console or Node.js
async function computeHash(payload, nonce) {
  const text = JSON.stringify(payload) + nonce;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Example:
const payload = { species: "human" };
const nonce = "random-uuid-here";
const hash = await computeHash(payload, nonce);
console.log('Commit hash:', hash);
```

Or use openssl:
```bash
echo -n '{"species":"human"}random-uuid-here' | openssl dgst -sha256 -hex
```

## Test 1: Player A SPECIES_COMMIT

```bash
# Generate nonce and hash first (see above)
export NONCE_A="550e8400-e29b-41d4-a716-446655440000"
export PAYLOAD_A='{"species":"human"}'
# Compute HASH_A = sha256($PAYLOAD_A + $NONCE_A)
export HASH_A="computed_hash_here"

curl -X POST "$BASE_URL/make-server-825e19ab/intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_A" \
  -d '{
    "gameId": "'"$GAME_ID"'",
    "intentType": "SPECIES_COMMIT",
    "turnNumber": 1,
    "commitHash": "'"$HASH_A"'"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "state": { ... },
  "events": [
    {
      "type": "SPECIES_COMMITTED",
      "playerId": "...",
      "turnNumber": 1,
      "atMs": 1234567890
    }
  ]
}
```

## Test 2: Player B SPECIES_COMMIT

```bash
export NONCE_B="550e8400-e29b-41d4-a716-446655440001"
export PAYLOAD_B='{"species":"xenite"}'
# Compute HASH_B = sha256($PAYLOAD_B + $NONCE_B)
export HASH_B="computed_hash_here"

curl -X POST "$BASE_URL/make-server-825e19ab/intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_B" \
  -d '{
    "gameId": "'"$GAME_ID"'",
    "intentType": "SPECIES_COMMIT",
    "turnNumber": 1,
    "commitHash": "'"$HASH_B"'"
  }'
```

## Test 3: Player A SPECIES_REVEAL

```bash
curl -X POST "$BASE_URL/make-server-825e19ab/intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_A" \
  -d '{
    "gameId": "'"$GAME_ID"'",
    "intentType": "SPECIES_REVEAL",
    "turnNumber": 1,
    "payload": '"$PAYLOAD_A"',
    "nonce": "'"$NONCE_A"'"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "state": { ... },
  "events": [
    {
      "type": "SPECIES_REVEALED",
      "playerId": "...",
      "turnNumber": 1,
      "atMs": 1234567890
    }
  ]
}
```

**Note:** No `SPECIES_RESOLVED` event yet (only one player revealed).

## Test 3.5: Verify Player B Cannot See Player A's Species

```bash
curl "$BASE_URL/make-server-825e19ab/game-state/$GAME_ID" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_B"
```

**Verify:**
- Player A's `faction` should be `null` in the response
- No commitment data should be visible

## Test 4: Player B SPECIES_REVEAL

```bash
curl -X POST "$BASE_URL/make-server-825e19ab/intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_B" \
  -d '{
    "gameId": "'"$GAME_ID"'",
    "intentType": "SPECIES_REVEAL",
    "turnNumber": 1,
    "payload": '"$PAYLOAD_B"',
    "nonce": "'"$NONCE_B"'"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "state": { ... },
  "events": [
    {
      "type": "SPECIES_REVEALED",
      "playerId": "...",
      "turnNumber": 1,
      "atMs": 1234567890
    },
    {
      "type": "SPECIES_RESOLVED",
      "turnNumber": 1,
      "atMs": 1234567890
    }
  ]
}
```

**Note:** `SPECIES_RESOLVED` event appears after both reveals.

## Test 5: Verify Final State (Player A)

```bash
curl "$BASE_URL/make-server-825e19ab/game-state/$GAME_ID" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_A"
```

**Verify:**
- Player A has `faction: "human"`
- Player B has `faction: "xenite"`
- No commitment data leaked (`gameData.commitments` should not exist)

## Test 6: Negative Test - Hash Mismatch

```bash
# Commit with a valid hash
export NONCE_BAD="550e8400-e29b-41d4-a716-446655440002"
export PAYLOAD_BAD='{"species":"centaur"}'
# Compute HASH_BAD = sha256($PAYLOAD_BAD + $NONCE_BAD)
export HASH_BAD="computed_hash_here"

curl -X POST "$BASE_URL/make-server-825e19ab/intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_A" \
  -d '{
    "gameId": "'"$GAME_ID"'",
    "intentType": "SPECIES_COMMIT",
    "turnNumber": 2,
    "commitHash": "'"$HASH_BAD"'"
  }'

# Now reveal with WRONG nonce
curl -X POST "$BASE_URL/make-server-825e19ab/intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "X-Session-Token: $SESSION_TOKEN_A" \
  -d '{
    "gameId": "'"$GAME_ID"'",
    "intentType": "SPECIES_REVEAL",
    "turnNumber": 2,
    "payload": '"$PAYLOAD_BAD"',
    "nonce": "WRONG_NONCE_12345"
  }'
```

**Expected Response:**
```json
{
  "ok": false,
  "state": { ... },
  "events": [],
  "rejected": {
    "code": "HASH_MISMATCH",
    "message": "Reveal hash does not match committed hash"
  }
}
```

## Pass Criteria

✅ **All tests must pass:**

1. ✅ Commit must exist before reveal
2. ✅ Hash mismatch must reject with `HASH_MISMATCH`
3. ✅ Species only visible after both players reveal
4. ✅ No commitment data leaked in game-state
5. ✅ State stored under `game_${GAME_ID}` key
6. ✅ No `/send-action` endpoint used

## Common Issues

**Error: "Session not found"**
- Make sure you're using the correct session token
- Session tokens must be in `X-Session-Token` header (not Authorization)

**Error: "Game not found"**
- Verify the game ID is correct
- Check that the player is actually in the game

**Hash mismatch on valid reveal**
- Make sure JSON stringify has no extra spaces
- Format: `{"species":"human"}` not `{ "species": "human" }`
- Make sure nonce matches exactly

**Commitments not filtering correctly**
- Check game_routes.ts filtering logic
- Verify `gameData.commitments` is removed from response
