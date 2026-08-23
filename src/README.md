# Shapeships

Shapeships is a server-authoritative, simultaneous-turn 1v1 fleet strategy game.

**Current repo posture:** a React/Vite client and Supabase Edge Function server, with active work across authoritative rules, client/runtime orchestration, and desktop and mobile presentation.

## Start Here

### Core project guidance

- [Repo agent rules](../AGENTS.md)
- [Documentation index](documentation/INDEX.md)
- [Current repository status](VERSION.md)

### Core architecture documents

- [Canonical handoff](documentation/contracts/canonical-handoff.md)
- [Code ownership map](documentation/contracts/code-ownership-map.md)
- [Server/client turn-phase contract](documentation/contracts/ServerClientTurnPhaseContract.md)
- [Guidelines](documentation/Guidelines.md)

## Architectural Truths

### Server authority

The server is the source of truth for:

- rules and legality
- phase advancement and clocks
- combat outcomes and effect application
- persistence and canonical state transitions

The client renders projected server state, submits intents, and provides local previews, but it is not authoritative.

### Client runtime owns live wiring

Live server interaction stays centralized in `game/client/**`, especially `useGameSession` and its extracted effects. This layer owns session-backed joins, state and chat polling, on-demand history reads, intent submission, and view-model orchestration.

### Display is presentation

Code in `game/display/**`, `components/**`, and `graphics/**` renders state, gathers input, and presents visual or audio feedback. It must not own server communication or authoritative rules.

### Client/UI coupling is normal

Client runtime and display work may move together in a Client/UI pass as long as authoritative gameplay remains on the server.

## Technology Stack

- **Client:** React, TypeScript, Vite, and Tailwind CSS
- **Server:** Supabase Edge Functions using Deno and Hono
- **State transport:** session-backed HTTP calls, polling, targeted refreshes, and on-demand history reads
- **Graphics and audio:** React SVG ship components, local assets, live dice and destruction cues, and placeholder species cues

Species-specific sound coverage remains incomplete.

## Repository Layout

- `game/client/**` — session lifecycle, networking, polling, intent submission, and view-model orchestration
- `game/display/**` — desktop and mobile match screens, panels, board UI, animation, and feedback
- `components/**` — application shells, rules screens, panels, and reusable UI primitives
- `graphics/**` — species ship graphics and visual assets
- `supabase/functions/server/**` — Edge Function entrypoint, routes, authoritative engine, and server-owned shared logic
- `supabase/functions/server/tests/**` — centralized authoritative-server regression tests; this is not production runtime code
- `documentation/**` — current status, contracts, workflows, planning records, and infrastructure notes

## Current Codebase Overview

- `App.tsx` is the active top-level entry and development launcher; the player shell and scaffolding remain intentional active project code.
- `ScreenManager` and the shell components provide display-name entry, menus, private and computer game creation, rules, and direct match launch.
- `GameScreen` is the live match shell and switches between active desktop and mobile layouts.
- `useGameSession` centralizes auto-join, session-backed networking, authoritative refreshes, chat, history, intent submission, and client-only presentation state.
- Full state and lightweight head reads support authoritative polling and clock snapshots, chat is polled separately, and battle history is fetched on demand.
- Server reads return requester-, opponent-, and spectator-safe projections, including available actions and filtered hidden commitments.
- Authoritative server tests are centralized under `supabase/functions/server/tests/**`.

## Current Product Posture

Shapeships supports private multiplayer and computer games in timed and untimed formats. Human, Xenite, Centaur, and Ancient are available for player-controlled play; Human, Xenite, and Centaur also support computer opponents.

Ancient is implemented for player-controlled play and is entering real-player testing and balance refinement. Ancient computer-opponent support remains deferred.

See [VERSION.md](VERSION.md) for the detailed holistic product snapshot.

## Development Posture

Development uses:

1. local Vite development for the client
2. local or deployed Supabase Edge Functions for authoritative logic
3. scoped implementation passes with architecture review

See [documentation/INDEX.md](documentation/INDEX.md) for the documentation map.
