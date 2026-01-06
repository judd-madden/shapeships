# Phase 4.5 Quick Reference
## Historical Reference - See Backend Documentation for Current Truth

**Date:** 2026-01-05  
**Status:** ✅ Complete (Historical)  
**Current Documentation:** See `/documentation/backend/session-identity-requirements.md`

---

## ⚠️ Notice

**This document is a historical quick reference for Phase 4.5.**

For current, up-to-date quick reference information:

👉 **See: `/documentation/backend/session-identity-requirements.md`**

That document contains comprehensive reference material including:
- Protected endpoint list
- Client request patterns
- Server enforcement patterns
- Testing commands
- Error responses
- DEV test harness guide

---

## Historical Quick Reference (Snapshot)

### Protected Endpoints (Session Token Required)

| Endpoint | Method | Identity Derivation |
|----------|--------|---------------------|
| `/create-game` | POST | `playerId = session.sessionId` |
| `/join-game/:gameId` | POST | `playerId = session.sessionId` |
| `/send-action/:gameId` | POST | `playerId = session.sessionId` |
| `/switch-role/:gameId` | POST | `playerId = session.sessionId` |
| `/intent` | POST | `intent.playerId = session.sessionId` (override) |
| `/game-state/:gameId` | GET | `requestingPlayerId = session.sessionId` |

---

### Dual-Header Architecture

**All protected endpoints require TWO headers:**

```http
Authorization: Bearer {SUPABASE_ANON_KEY}  ← Infrastructure auth
X-Session-Token: {SESSION_TOKEN}           ← Application identity
```

---

### Exit Behavior

| Button | Location | Session Cleared? | Returns To |
|--------|----------|------------------|------------|
| "Exit" | MenuShell | ✅ Yes | EnterNamePanel |
| "Exit Game" | GameShell | ❌ No | MenuShell |

---

### Files Modified in Phase 4.5

| File | Changes | Impact |
|------|---------|--------|
| `/supabase/functions/server/index.tsx` | +180 lines | 6 endpoints now enforce session |
| `/components/ScreenManager.tsx` | +25 lines | Exit clears session |

---

### Testing Quick Check

```bash
# 1. Create session
curl -X POST {URL}/session/start -H "Authorization: Bearer {ANON_KEY}"

# 2. Create game WITH both headers
curl -X POST {URL}/create-game \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "X-Session-Token: {TOKEN}" \
  -d '{"playerName":"Alice"}'

# 3. Missing session header → 401
curl -X POST {URL}/create-game \
  -H "Authorization: Bearer {ANON_KEY}" \
  -d '{"playerName":"Alice"}'
```

---

### Phase 4.5 Status

✅ Server owns all identity mapping  
✅ All mutating endpoints protected  
✅ Backward compatible with dev tools  
✅ Exit semantics explicit and consistent  
✅ Complete backend documentation  

---

## See Full Documentation

For complete details, migration guides, error reference, and testing procedures:

📖 **`/documentation/backend/session-identity-requirements.md`**
