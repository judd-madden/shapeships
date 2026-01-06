# Phase 5: Alpha E2E Test Harness (DEV Mode)
## Session + Game Debug Card Implementation

**Date:** 2026-01-05  
**Status:** ✅ Complete  
**Purpose:** DEV-only testing panel for Alpha v3 session and game endpoints

---

## Overview

Added a "Session + Game Debug" card to the Development Dashboard (DEV mode only) for easy end-to-end testing of Alpha v3 session and game endpoints.

**Key Constraint:** No changes to PLAYER UI, server logic, or new endpoints.

---

## A) SessionDebugCard Component

**Location:** `/App.tsx` (lines ~1715-1920)  
**Visibility:** DEV mode only (not in PLAYER mode)  
**Placement:** Development Dashboard, "Alpha v3 Session Testing" section

### Features

**Status Display:**
- App Mode: Shows "DEV" badge
- Session Token: Present (Yes/No) badge
- Token Preview: First 6 characters only (e.g., `a3f2e1...`)
- Current GameId: Displays active game ID or "None"
- Last API Result: Success/Error message with HTTP status code

**Controls:**
1. **Start / Refresh Session**
   - Calls `ensureSession()` utility
   - Creates new session or returns existing
   - Updates token preview on success

2. **Create Private Game**
   - Calls `POST /create-game` via `authenticatedPost()`
   - Uses test player name: "Debug Test Player"
   - Sets currentGameId on success
   - Disabled if no session token

3. **Join Game**
   - Input field accepts:
     - Raw game ID (e.g., `game_abc123`)
     - Full invite URL (extracts `?game=` param)
   - Calls `POST /join-game/:gameId`
   - Uses test player name: "Debug Test Player 2"
   - Sets currentGameId on success
   - Disabled if no session token or empty input

4. **Fetch Game State**
   - Calls `GET /game-state/:gameId`
   - Uses currentGameId from Create/Join
   - Displays player count in result
   - Disabled if no gameId set

5. **Send Dummy Action** (OMITTED)
   - Not implemented (payload shape varies by game phase)
   - Would require phase-specific logic
   - Out of scope for Phase 5

---

## B) Implementation Details

### State Management

```typescript
const [sessionToken, setSessionToken] = useState<string | null>(null);
const [currentGameId, setCurrentGameId] = useState<string>('');
const [joinGameInput, setJoinGameInput] = useState<string>('');
const [lastResult, setLastResult] = useState<{
  success: boolean;
  message: string;
  status?: number;
} | null>(null);
const [isLoading, setIsLoading] = useState(false);
```

### Error Handling

**All endpoints:**
- Wrap in try/catch
- Log full error to console (includes server response body)
- Display user-friendly message in result card
- Show HTTP status code when available
- Never log full tokens (preview only)

**Example:**
```typescript
try {
  const response = await authenticatedPost('/create-game', { playerName: 'Test' });
  if (!response.ok) {
    const errorText = await response.text(); // Full server response
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  // Success path
} catch (error) {
  console.error('Create game error:', error); // Full error to console
  setLastResult({
    success: false,
    message: `Error: ${error.message}`, // User-friendly message
    status: 0
  });
}
```

### Token Privacy

**UI Display:**
- Token preview: First 6 characters + `...` (e.g., `a3f2e1...`)
- Never display full token in UI

**Console Logs:**
- Session creation: `token.substring(0, 6) + '...'`
- Request logs: No token included (handled by sessionManager)

---

## C) Integration with Session Manager

**Uses utilities from `/utils/sessionManager.ts`:**

1. **`getSessionToken()`**
   - Check for existing session on component mount
   - Returns token from localStorage or null

2. **`ensureSession()`**
   - Create new session if none exists
   - Return existing session if valid
   - Handles `POST /session/start` endpoint

3. **`authenticatedPost(endpoint, body)`**
   - Automatically includes both headers:
     - `Authorization: Bearer {SUPABASE_ANON_KEY}`
     - `X-Session-Token: {SESSION_TOKEN}`
   - No manual header configuration needed

4. **`authenticatedFetch(endpoint, options)`**
   - GET requests with session authentication
   - Same dual-header setup as POST

---

## D) Development Dashboard Integration

**Location:** `/App.tsx` - `DevelopmentDashboard` component

**Added Section:**
```tsx
<Separator className="my-8" />

{/* Session + Game Debug (Alpha v3) */}
<div className="mb-8">
  <h2 className="mb-4">Alpha v3 Session Testing</h2>
  <div className="max-w-md">
    <SessionDebugCard />
  </div>
</div>

<Separator className="my-8" />
```

**Placement:** After "System Status" section, before "Development Tools" section

---

## E) Files Modified

### `/App.tsx`

**Lines Added:** ~215 lines

**Changes:**
1. Import additions (lines 1-15):
   - `Input` component
   - Session manager utilities

2. SessionDebugCard component (lines ~1715-1920):
   - Complete component implementation
   - All endpoint handlers
   - UI rendering

3. Dashboard integration (lines ~2055-2065):
   - New section for Alpha v3 testing
   - SessionDebugCard placement

**No changes to:**
- Player UI components (ScreenManager, MenuShell, GameShell)
- Server logic
- Endpoints
- Game logic

---

### `/documentation/backend/session-identity-requirements.md`

**Lines Added:** ~35 lines

**Changes:**
- New section: "DEV Test Harness" (before Summary)
- Documents SessionDebugCard location and features
- Lists controls and their functions
- Provides usage example
- Notes error logging behavior

---

### `/documentation/architecture/phase-4-5-enforcement-summary.md`

**Lines Changed:** Reduced from ~800 to ~80 lines

**Changes:**
- Replaced detailed content with stub
- Added notice pointing to backend doc as source of truth
- Kept historical summary of what was done
- Marked as "Historical Reference"

---

### `/documentation/architecture/phase-4-5-quick-reference.md`

**Lines Changed:** Reduced from ~150 to ~90 lines

**Changes:**
- Replaced detailed content with stub
- Added notice pointing to backend doc
- Kept minimal quick reference
- Marked as "Historical Reference"

---

### `/documentation/architecture/phase-5-dev-test-harness.md`

**Status:** NEW (this document)

**Contents:**
- Complete Phase 5 implementation summary
- SessionDebugCard feature documentation
- Integration details
- File change summary

---

## F) No Changes Confirmed

✅ **No PLAYER UI Changes:**
- MenuShell: Unchanged
- GameShell: Unchanged
- LoginShell: Unchanged
- ScreenManager: Unchanged (only imports added for DEV mode)

✅ **No Server Logic Changes:**
- `/supabase/functions/server/index.tsx`: Unchanged
- No new endpoints added
- No endpoint behavior modified
- (Harmless logging already exists from Phase 4.5)

✅ **No New Endpoints:**
- All endpoints tested already exist
- SessionDebugCard uses existing infrastructure

✅ **No Public Lobby:**
- Private games only
- Manual invite URL sharing (existing behavior)

---

## G) Testing Workflow

### 1. Access DEV Mode

**Method 1: Default App Load**
- App starts in DEV mode by default
- Development Dashboard visible immediately

**Method 2: Switch from PLAYER Mode**
- Click "Switch to DEV Mode" button (top-right in PLAYER mode)
- Returns to Development Dashboard

---

### 2. Test Session Creation

**Steps:**
1. Find "Alpha v3 Session Testing" section
2. Observe: Session Token badge shows "No"
3. Click "Start / Refresh Session"
4. Result card shows: ✅ Success (200)
5. Session Token badge updates to "Yes"
6. Token Preview shows first 6 chars

**Expected Console Log:**
```
✅ Existing session token found
🔐 Authenticated request to /session/start
✅ Session token: a3f2e1...
```

---

### 3. Test Create Game

**Steps:**
1. Ensure session exists (Step 2)
2. Click "Create Private Game"
3. Result card shows: ✅ Success (200) - "Game created: game_abc123"
4. Current GameId updates to `game_abc123`

**Expected Console Log:**
```
🔐 Authenticated request to /create-game
✅ Game created: { gameId: "game_abc123", ... }
```

---

### 4. Test Join Game

**Method 1: Raw Game ID**
1. Copy gameId from Create Game result
2. Paste in "Game ID or invite URL" input
3. Click "Join Game"
4. Result card shows: ✅ Success - "Joined game: game_abc123"

**Method 2: Full Invite URL**
1. Create game in one browser tab
2. Copy full URL: `http://localhost:3000/?game=game_abc123`
3. Paste in input field
4. Click "Join Game"
5. SessionDebugCard extracts `game_abc123` from URL
6. Joins game successfully

**Expected Console Log:**
```
🔐 Authenticated request to /join-game/game_abc123
✅ Joined game: { gameData: ... }
```

---

### 5. Test Fetch Game State

**Steps:**
1. Ensure gameId is set (from Create or Join)
2. Click "Fetch Game State"
3. Result card shows: ✅ Success - "Game state fetched (2 players)"

**Expected Console Log:**
```
🔐 Authenticated request to /game-state/game_abc123
✅ Game state: { players: [...], gameData: {...} }
```

---

### 6. Test Error Scenarios

**No Session:**
1. Clear localStorage: `localStorage.removeItem('ss_sessionToken')`
2. Reload page
3. Try "Create Private Game" → Button disabled ✅

**Invalid Game ID:**
1. Enter "invalid_game_123" in Join Game input
2. Click "Join Game"
3. Result card shows: ❌ Error - "HTTP 404: Game not found"

**Missing GameId for Fetch:**
1. Don't create/join any game
2. Try "Fetch Game State" → Button disabled ✅

---

## H) User Experience

### Visual Feedback

**Loading State:**
- All buttons show "Loading..." when isLoading=true
- Prevents duplicate requests

**Success:**
- Green result card with ✅
- HTTP status code displayed
- Concise success message

**Error:**
- Red result card with ❌
- HTTP status code (if available)
- Error message from server

**Disabled States:**
- No session → Create/Join/Fetch buttons disabled
- No gameId → Fetch button disabled
- Empty join input → Join button disabled

### Token Security

**Never exposed:**
- Full session token in UI
- Full token in console logs (preview only)
- Token in error messages

**Exposed safely:**
- First 6 characters in UI (sufficient for debugging)
- Token existence (Yes/No badge)

---

## I) Comparison with Existing Test Views

### SessionDebugCard vs MultiplayerTestView

| Feature | SessionDebugCard | MultiplayerTestView |
|---------|------------------|---------------------|
| Purpose | Quick endpoint testing | Full game testing |
| Scope | Session + game endpoints | Complete game flow |
| Gameplay | No gameplay logic | Full game interface |
| Player Names | Hardcoded test names | User-configurable |
| Use Case | API validation | Integration testing |

**SessionDebugCard is NOT a replacement for MultiplayerTestView.**

SessionDebugCard provides:
- ✅ Quick endpoint sanity checks
- ✅ Session token debugging
- ✅ Manual game ID testing
- ✅ Minimal UI (fits in dashboard card)

MultiplayerTestView provides:
- ✅ Full game testing
- ✅ Species selection
- ✅ Turn-by-turn gameplay
- ✅ Ship building and combat

Both coexist for different testing needs.

---

## J) Documentation Tidying

### Backend Documentation (Maintained)

**`/documentation/backend/session-identity-requirements.md`:**
- ✅ Added DEV Test Harness section
- ✅ Documents SessionDebugCard features
- ✅ Provides usage examples
- ✅ Notes error logging behavior
- ✅ Remains single source of truth

### Architecture Summaries (Simplified)

**`/documentation/architecture/phase-4-5-enforcement-summary.md`:**
- ✅ Reduced from ~800 to ~80 lines
- ✅ Marked as "Historical Reference"
- ✅ Points to backend doc as current truth
- ✅ Keeps essential historical summary

**`/documentation/architecture/phase-4-5-quick-reference.md`:**
- ✅ Reduced from ~150 to ~90 lines
- ✅ Marked as "Historical Reference"
- ✅ Points to backend doc for current info
- ✅ Keeps minimal quick reference

**Rationale:**
- Avoid maintaining duplicate information
- Single source of truth: `/documentation/backend/session-identity-requirements.md`
- Historical docs remain for Phase 4.5 context

---

## K) Phase 5 Status

### Requirements Met ✅

| Requirement | Status |
|-------------|--------|
| DEV-only panel | ✅ SessionDebugCard in DEV mode |
| Display app mode | ✅ Shows "DEV" badge |
| Display session status | ✅ Token present + preview |
| Display current gameId | ✅ Shows active game or "None" |
| Display last API result | ✅ Success/error + status code |
| Start/Refresh Session | ✅ Calls ensureSession() |
| Create Private Game | ✅ Uses CREATE_PRIVATE_GAME endpoint |
| Join Game | ✅ Accepts gameId or URL |
| Fetch Game State | ✅ Calls game-state/:gameId |
| Send Dummy Action | ⏸️ Omitted (payload varies by phase) |
| Error logging | ✅ Includes server response body |
| Token privacy | ✅ Preview only, no full tokens |
| Documentation | ✅ Backend doc updated, stubs created |
| No PLAYER UI changes | ✅ Confirmed |
| No new endpoints | ✅ Confirmed |
| No server logic changes | ✅ Confirmed |

---

## L) Next Steps (Post-Phase 5)

**Recommended:**
1. Deploy edge function (if not already deployed)
2. Test SessionDebugCard in deployed environment
3. Use for Alpha v3 private game validation
4. Gather feedback on additional debug controls needed

**Future Enhancements (Not in Phase 5):**
- Add "Send Dummy Action" with phase-aware payloads
- Add session expiration countdown
- Add gameId history (recently created/joined games)
- Add quick copy buttons for gameId and invite URL

---

## Summary

**Phase 5 Complete:** ✅

Added a DEV-only Session + Game Debug card to the Development Dashboard for quick Alpha v3 endpoint testing. No changes to player UI, server logic, or endpoints.

**Files Modified:**
- `/App.tsx` (+215 lines): SessionDebugCard component + dashboard integration
- `/documentation/backend/session-identity-requirements.md` (+35 lines): DEV harness docs
- `/documentation/architecture/phase-4-5-enforcement-summary.md` (-720 lines): Simplified to stub
- `/documentation/architecture/phase-4-5-quick-reference.md` (-60 lines): Simplified to stub
- `/documentation/architecture/phase-5-dev-test-harness.md` (NEW): This document

**Total Impact:** ~215 lines of functional code, documentation consolidated to single source of truth.
