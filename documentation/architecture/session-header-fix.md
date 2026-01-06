# Session Header Architecture Fix
## Historical Reference - See Backend Documentation for Current Truth

**Date:** 2026-01-05  
**Status:** ✅ Resolved (Historical)  
**Current Documentation:** See `/documentation/backend/session-identity-requirements.md`

---

## ⚠️ Notice

**This document is a historical reference for the Phase 4 session header fix.**

For current, up-to-date information about header architecture and requirements:

👉 **See: `/documentation/backend/session-identity-requirements.md`**

That document is the **single source of truth** for:
- Standard request header format
- Dual-header architecture (Authorization + X-Session-Token)
- Why we use separate headers for infrastructure vs app identity
- Complete request examples for all endpoints
- CORS configuration requirements
- Security guardrails

---

## Historical Summary (Phase 4 Fix)

### The Problem

**Error:** Session validation failing with "Token not found"

**Root Cause:** Conflicting use of `Authorization` header
- Supabase Edge Functions need: `Authorization: Bearer {ANON_KEY}`
- Application tried to send: `Authorization: Bearer {SESSION_TOKEN}`
- Cannot use same header for both purposes

### The Solution

**Dual-Header Architecture:**

1. **`Authorization: Bearer {SUPABASE_ANON_KEY}`** - Infrastructure access
2. **`X-Session-Token: {SESSION_TOKEN}`** - Application identity

**Result:** Both Supabase infrastructure and application identity work correctly.

---

## Current Standard (Hardening Pass - 2026-01-05)

**All requests to Supabase Edge Functions now use:**

```http
Authorization: Bearer {SUPABASE_ANON_KEY}  ← Infrastructure
apikey: {SUPABASE_ANON_KEY}                ← Infrastructure (alt)
Content-Type: application/json             ← Standard
X-Session-Token: {SESSION_TOKEN}           ← Application identity
```

**Security Guardrail:**
- Client code now includes guard against accidentally using session token in Authorization header
- Throws error in development if Authorization doesn't contain anon key
- Prevents regression to Phase 4 bug

---

## Files Modified (Historical)

| Phase | File | Change |
|-------|------|--------|
| Phase 4 | `/utils/sessionManager.ts` | Added X-Session-Token header |
| Phase 4 | `/supabase/functions/server/index.tsx` | Read from X-Session-Token instead of Authorization |
| Hardening | `/utils/sessionManager.ts` | Added apikey header + security guard |
| Hardening | `/supabase/functions/server/index.tsx` | Added apikey to CORS allowHeaders |

---

## See Full Documentation

For complete current standards, request examples, and security requirements:

📖 **`/documentation/backend/session-identity-requirements.md`**
