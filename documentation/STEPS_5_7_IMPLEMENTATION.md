# Steps 5-7 Implementation Guide

**Date:** 2024-12-24  
**Status:** 📝 **SUPERSEDED** - See new documentation

---

*This file moved from /supabase/functions/server/STEPS_5_7_IMPLEMENTATION.md*

This implementation guide has been superseded by the Option B approach documented in:

- `/documentation/OPTION_B_FINAL_STATUS.md` - Overall status
- `/documentation/ENGINE_DELEGATION_PLAN.md` - Implementation strategy
- `/documentation/QUICK_REF_COMPLETE_DELEGATION.md` - Step-by-step guide

**Why superseded:**
The original plan (Steps 5-7) was to create an IntentEngine compatibility layer. The new approach (Option B) instead:
1. Creates pure data layer (✅ complete)
2. Makes engine importable by Deno
3. Delegates directly to real engine (no compatibility layer needed)

This is cleaner and eliminates the risk of creating yet another parallel implementation.

---

## Historical Context

This document originally outlined creating an `IntentEngine` class in the server to handle BUILD_REVEAL, ACTION, and BATTLE_REVEAL intents. However, we realized this would create a third implementation of game logic:
1. Client engine (`/game/engine/`)
2. Server engine (ServerPhaseEngine)
3. Intent engine (IntentEngine) ← **Avoided this**

Instead, Option B makes the client engine importable by the server, achieving true single source of truth.

---

See `/documentation/` folder for current implementation status and next steps.
