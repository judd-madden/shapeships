# Session Flow - Quick Reference Guide

**Last Updated:** January 6, 2026

---

## TL;DR

**Golden Rule:** MainMenu only renders when `player` AND `sessionToken` exist.

Entry screen → Creates session → Updates player → Then navigates

---

## Entry Point Flow

```typescript
// User clicks PLAY on LoginScreen
LoginScreen → onPlay("PlayerName")
                ↓
            ScreenManager.handleNameSubmit("PlayerName")
                ↓
            await ensureSession()  // Creates/validates token
                ↓
            updatePlayerName()     // Stores in sessionStorage
                ↓
            setCurrentShell('menu') // Navigate only after ready
```

---

## Session Token Lifecycle

### Creation
```typescript
// When user clicks PLAY:
await ensureSession();
// → Calls POST /session/start
// → Receives { sessionToken: "abc123..." }
// → Stores in localStorage['ss_sessionToken']
```

### Usage
```typescript
// Automatic in all backend calls:
authenticatedPost('/create-game', { ... });
// → Reads token from localStorage
// → Includes X-Session-Token: abc123...
// → Server validates and derives identity
```

### Destruction
```typescript
// When user clicks BACK or logs out:
clearSession();
// → Removes localStorage['ss_sessionToken']
clearPlayer();
// → Removes sessionStorage['shapeships-player-*']
```

---

## Player Data Lifecycle

### Creation
```typescript
// In ScreenManager after session exists:
updatePlayerName("PlayerName");
// → Stores in sessionStorage['shapeships-player-name']
// → Updates player state in usePlayer hook
```

### Access
```typescript
// In any component using usePlayer:
const { player } = usePlayer();
// player = { id: "...", name: "PlayerName", isSpectator: false }
```

### Validation
```typescript
// MenuShell validates on every render:
if (!player || !player.name) {
  onExit(); // Redirect to entry
}
```

---

## Component Responsibilities

### LoginScreen (Pure UI)
- ❌ NO session logic
- ❌ NO API calls
- ✅ Collects player name
- ✅ Triggers `onPlay(name)` callback

### ScreenManager (Coordinator)
- ✅ Creates session via `ensureSession()`
- ✅ Updates player name via `updatePlayerName()`
- ✅ Orchestrates navigation
- ✅ Handles errors

### MenuShell (Protected Screen)
- ✅ Validates player exists
- ✅ Auto-redirects if invalid
- ✅ Uses backend APIs
- ❌ Never shows "Guest 234"

---

## Storage Locations

| Data | Location | Key | Example |
|------|----------|-----|---------|
| Session Token | localStorage | `ss_sessionToken` | `"abc123def456..."` |
| Player ID | sessionStorage | `shapeships-player-id` | `"player_abc_123"` |
| Player Name | sessionStorage | `shapeships-player-name` | `"PlayerName"` |
| Spectator Flag | sessionStorage | `shapeships-is-spectator` | `"false"` |

---

## Common Scenarios

### ✅ Normal Login
```
Entry → "Alice" → PLAY
  → ensureSession() creates token
  → updatePlayerName("Alice")
  → Navigate to menu
  → MenuShell shows "Alice" ✅
```

### ✅ Exit and Re-Login (The Bug Fix!)
```
Menu (Alice) → BACK
  → clearSession() + clearPlayer()
  → Entry → "Bob" → PLAY
  → ensureSession() creates NEW token
  → updatePlayerName("Bob")
  → Navigate to menu
  → MenuShell shows "Bob" ✅ (was "Guest 234" before)
```

### ✅ Session Failure
```
Entry → "Alice" → PLAY
  → ensureSession() fails (network error)
  → alert("Failed to start session")
  → User stays on Entry ✅
```

### ✅ Invalid Player Detected
```
MenuShell renders but player is null
  → useEffect detects invalid state
  → onExit() called
  → Redirect to Entry ✅
```

---

## API Endpoints

### Create Session
```http
POST /make-server-825e19ab/session/start
Authorization: Bearer <SUPABASE_ANON_KEY>

Response:
{
  "sessionToken": "abc123...",
  "message": "Session created successfully"
}
```

### Use Session
```http
POST /make-server-825e19ab/create-game
Authorization: Bearer <SUPABASE_ANON_KEY>
X-Session-Token: abc123...

Body:
{
  "playerName": "Alice",
  "playerId": "player_abc_123"
}
```

---

## Header Contract

**CRITICAL:** Two separate headers for different purposes:

| Header | Value | Purpose |
|--------|-------|---------|
| `Authorization` | `Bearer <SUPABASE_ANON_KEY>` | Edge function access |
| `X-Session-Token` | `<sessionToken>` | Player identity |

**⚠️ NEVER:** Put session token in Authorization header!

---

## Debugging Checklist

### "Guest 234" appears
- [ ] Check: Is `player.name` set in sessionStorage?
- [ ] Check: Is `handleNameSubmit` awaiting `ensureSession()`?
- [ ] Check: Is MenuShell guard working?
- [ ] Check: Is there a race condition?

### Session creation fails
- [ ] Check: Is backend server running?
- [ ] Check: Is `SUPABASE_ANON_KEY` configured?
- [ ] Check: Network tab for 401/500 errors
- [ ] Check: Console for error messages

### Player name doesn't update
- [ ] Check: Is `clearPlayer()` called on exit?
- [ ] Check: Is `clearSession()` called on exit?
- [ ] Check: Is new session created on re-entry?
- [ ] Check: SessionStorage values in DevTools

---

## Code Patterns

### DO ✅
```typescript
// Atomic session creation
const handleNameSubmit = async (name: string) => {
  await ensureSession();
  updatePlayerName(name);
  navigate('menu');
};

// Guard protected screens
if (!player || !player.name) {
  onExit();
  return null;
}

// Clean exit
const handleExit = () => {
  clearSession();
  clearPlayer();
  navigate('entry');
};
```

### DON'T ❌
```typescript
// Navigate before session ready
const handleNameSubmit = (name: string) => {
  updatePlayerName(name);
  navigate('menu'); // BAD: Session not created yet!
};

// Use fallback in protected screens
const displayName = player?.name || "Guest 234"; // BAD: Hides bugs!

// Skip cleanup on exit
const handleExit = () => {
  navigate('entry'); // BAD: Leaves old session active!
};
```

---

## Console Logs to Expect

### Successful Flow
```
🎮 Starting session for player: Alice
✅ Session token created/validated
✅ Player name set: Alice
✅ Navigation to menu complete
```

### Exit Flow
```
🚪 Exit: Player and session cleared, returned to entry
```

### Error Flow
```
❌ Failed to start session: Error: Network error
```

### Guard Triggered
```
⚠️ MenuShell rendered without valid player - redirecting to entry
🚪 Exit: Player and session cleared, returned to entry
```

---

## Related Files

- `/components/ScreenManager.tsx` - Session orchestration
- `/components/shells/MenuShell.tsx` - Protected screen with guard
- `/screens/LoginScreen.tsx` - Pure UI entry point
- `/utils/sessionManager.ts` - Session token utilities
- `/game/hooks/usePlayer.tsx` - Player state management

---

**Quick Reference Version:** v1.0  
**Last Verified:** January 6, 2026
