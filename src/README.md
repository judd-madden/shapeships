# Shapeships

Multiplayer, server-authoritative, turn-based fleet strategy game.

**Current state:** Local Vite client + Supabase Edge Functions backend. Commit/reveal turn loop is working end-to-end, and Phase 3 “Human Powers” infrastructure is actively being implemented (dice canonicalization, computed effects, and server-projected actions).

---

## Start here (canonical docs)

**Primary reference**
- `documentation/contracts/canonical-handoff.md` ⭐ (the integration and architecture rules live here)

**Key contracts / indexes**
- `documentation/contracts/ServerClientTurnPhaseContract.md`
- `documentation/INDEX.md`
- `guidelines/Guidelines.md`

---

## What’s true about the architecture (non-negotiable)

**Server authority**
- The server is the source of truth for: rules, legality, phase advancement, victory, dice truth, clocks, effects, targeting validity.
- The client renders server state + submits intents only.

**Single integration seam**
- All live server calls happen in `useGameSession`.
- Display code under `game/display/**` is presentation-only: props in, callbacks out. No networking. No rule interpretation.

**Phase keys**
- Dot-notation `PhaseKey` everywhere (e.g. `build.dice_roll`, `battle.charge_declaration`).

---

## Technology stack

- **Client:** React + TypeScript + Vite + Tailwind
- **Server:** Supabase Edge Functions (Deno) + Hono
- **State:** Server KV store, client polling (turn-based cadence)
- **Graphics:** Embedded ship SVG React components (no runtime image fetch required)

---

## Current gameplay capability (high level)

- Two-player Human vs Human match flow is functional (join → species selection → build → battle → next turn)
- Commit/reveal protocol is implemented for hidden declarations (species + build)
- Turn-aware opponent fleet visibility (old ships visible, ships built this turn hidden until battle)
- Server-side dice is canonical (base + effective roll stored for the turn; client displays server truth)
- Action plumbing exists for “choice actions” (server projects availableActions; client renders panels and submits ACTION intents)

See `VERSION.md` for the detailed changelog and “what’s next”.

---

## Repo layout (mental map)

- `game/client/**`  
  Client session + polling + view-model mapping (including `useGameSession` and gameSession helpers)

- `game/display/**`  
  Pure UI: stages, panels, HUD, board rendering (no server calls)

- `supabase/functions/server/**`  
  Authoritative engine + routes + intent reducer (the only place rules and effects are applied)

- `graphics/**`  
  Ship graphics registry + per-ship components

- `documentation/**` + `guidelines/**`  
  Canonical reference and contracts

---

## Development (local)

This repo is intended to be run as:
1) Vite dev server for the client
2) Supabase Edge Functions for the server

Exact commands/config live in the project’s root tooling (package scripts + Supabase config). Keep the core constraint in mind: **client never becomes a rules engine** — if you need logic, put it on the server and project it through `/game-state`.

---

## Version history

See `VERSION.md`.