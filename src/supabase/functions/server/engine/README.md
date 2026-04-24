# `/supabase/functions/server/engine`

This directory contains the current authoritative server runtime logic that sits between the route layer and the deterministic helpers under `engine_shared/`.

It is not a purely ceremonial wrapper. In the current repo, `engine/` contains live authoritative code for intent handling, phase progression, line computation, clocks, bot behavior, state shaping, and other server-owned runtime concerns.

## Current posture

The present split is pragmatic and somewhat transitional:
- `routes/` owns HTTP concerns, session checks, KV access, and response shaping
- `engine/` owns stateful server-side logic and orchestration used by those routes
- `engine_shared/` contains deterministic shared helpers, definitions, tables, and resolution code that both routes and `engine/` import heavily

This means the current package is not a perfectly isolated clean-room architecture. Some responsibilities are still shared across route and engine layers for practical reasons. What remains stable is the authority boundary: the authoritative runtime still lives under `src/supabase/functions/server/**`.

## Current structure

The current directory includes:
- `intent/` - authoritative intent reduction, commit/reveal helpers, hashing, and build-submit resolution
- `phase/` - phase advancement, phase-entry behavior, phase-field synchronization, and power-availability helpers
- `clock/` - authoritative clock setup and accrual helpers
- `lines/` - server-owned line bonus computation
- `bot/` - current bot planning and runtime helpers
- `state/` - server game-state and battle-log history helpers
- `util/` - smaller server utilities such as dice rolling

## Relationship to `engine_shared/`

`engine_shared/` currently holds deterministic shared surfaces such as:
- phase tables
- ship definitions and definition overlays
- effect models and effect application
- shared resolve helpers and power-resolution helpers

`engine/` imports those shared surfaces heavily, but it also contains authoritative logic that is specific to the live server runtime. In other words:
- `engine_shared/` is important to the current architecture
- `engine/` is still part of the authoritative server, not a non-authoritative adapter

## Relationship to routes

Routes do not only pass data through untouched. In the current codebase they also:
- validate session-backed request identity
- load and persist KV-backed state
- prepare read-safe projections
- filter hidden information for requesting players
- project runtime-facing response fields such as `availableActions`, clock snapshots, and history/chat surfaces

That means the current runtime seam is shared between routes and `engine/`, not a perfectly strict "routes thin, engine thick" split.

## Guardrails for work in this directory

- Keep server authority here or in adjacent server-owned shared code, not in client/display layers.
- Prefer reusing existing `engine_shared/` helpers when they already model the deterministic part of the problem.
- Do not describe this folder as the entire server architecture by itself; the live request path also depends on `routes/` and `engine_shared/`.
- Be cautious about claiming a migration is complete unless the current imports and file tree support that claim.

## Related documentation

- `src/supabase/functions/server/README.md`
- `src/engine/README.md`
- `src/documentation/contracts/canonical-handoff.md`
