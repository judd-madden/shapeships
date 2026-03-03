# Shapeships — Development Status

**Development Phase:** Client Wiring (stable) + Phase 3 (Human Powers infrastructure) in progress  
**Date:** March 4, 2026  
**Status:** Active alpha — turn cycle is playable; powers/actions are being layered in server-authoritatively

---

## Summary (what this build is)

This build is no longer “Make workflow” driven. It is a local Vite client wired to a Supabase Edge Functions server.

The core loop is working:
- Join / session identity
- Phase-driven turn cycle
- Commit → reveal where required
- Server-authoritative state updates with client polling

Phase 3 work is now focused on:
- Canonical dice fields (base + effective)
- Computed effects in a single server home
- Server-projected `availableActions` (choice/target actions) rendered by the client
- End-of-turn resolution stability (aggregate then mutate)

---

## What’s implemented (reliable)

### Turn loop + concealment
- Hidden declarations via commit/reveal (species + build)
- Turn-aware opponent visibility:
  - ships from prior turns visible during build
  - ships created this turn hidden until battle

### Server-truth dice
- Dice is stored server-side for the turn:
  - `baseDiceRoll`
  - `effectiveDiceRoll`
- Client displays dice as server truth (no client RNG authority)

### Action plumbing (foundation)
- Server can project “choice actions” via `availableActions`
- Client maps `availableActions` → action panels → ACTION intents
- Charge-based and build-time choice flows are supported by the same general mechanism

### Computed effects (single home)
- “Computed mechanics” (count/tier/once-only/trigger) live in one place on the server (no per-ship special-case scattering).
- This is intended to be reused for:
  - end-of-turn resolution
  - build preview projections (server-truth previews)

---

## Known gaps (explicit)

### UI/UX
- Some battle-phase UI remains utilitarian (panels first, polish later)
- Loading/sending feedback is still being refined in a few flows
- Lines economy / eligibility enforcement is intentionally deferred in places (phase-by-phase rollout)

### Game coverage
- Human powers are mid-implementation (vertical slices are landing ship-by-ship)
- Non-human species powers are out of scope until the Human pass is complete

---

## Next milestones (near-term)

1) Finish Phase 3.0A/3.0B guardrails:
   - strict “health mutation boundary” (aggregate in pendingTurn; mutate only in end-of-turn resolution)
   - complete event/log projections needed for UI deltas

2) Continue Phase 3 ship slices using the shared action system:
   - Frigate trigger choice (set once per instance, dice match trigger)
   - Interceptor charge choice (heal/damage, spend charge)
   - Carrier “ships that build” (per-option charge costs, CreateShip)
   - Guardian targeting (DestroyShip)

3) Stabilize server-projected preview totals so build preview and resolution share the same computation identity.

---

## References

- `documentation/contracts/canonical-handoff.md` (primary)
- `documentation/contracts/ServerClientTurnPhaseContract.md`
- `documentation/INDEX.md`
- `guidelines/Guidelines.md`