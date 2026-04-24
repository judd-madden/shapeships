# Shapeships

Multiplayer, server-authoritative, turn-based fleet strategy game.

**Current repo posture:** local Vite client + Supabase Edge Functions backend, with active work across authoritative server rules, client/runtime orchestration, and presentation layers.

## Start Here

### Core project guidance
- [Repo agent rules](../AGENTS.md)
- [Documentation index](documentation/INDEX.md)

### Core architecture documents
- [Canonical handoff](documentation/contracts/canonical-handoff.md)
- [Code ownership map](documentation/contracts/code-ownership-map.md)
- [Server/client turn-phase contract](documentation/contracts/ServerClientTurnPhaseContract.md)
- [Guidelines](documentation/Guidelines.md)

## Architectural truths

### Server authority
The server is the source of truth for:
- rules
- legality
- phase advancement
- combat outcomes
- effect application
- canonical state transitions

The client renders server state, submits intents, and projects local previews, but it is not authoritative.

### Client runtime owns live wiring
Live server interaction stays centralized in `game/client/**`, especially around `useGameSession` and its extracted client effect helpers. That runtime owns session-backed joins, live state polling, chat polling, history fetches, and view-model orchestration.

### Display is presentation
Code in `game/display/**`, `components/**`, and `graphics/**` is presentation-oriented. It renders state, gathers input, and plays visual/audio feedback, but it should not become authoritative.

### Client/UI coupling is normal
In this repo, client runtime and UI work often move together in a single pass. That is acceptable as long as authoritative rules remain on the server.

## Technology stack
- **Client:** React + TypeScript + Vite + Tailwind
- **Server:** Supabase Edge Functions (Deno) + Hono
- **State transport:** session-backed HTTP calls, polling, and targeted refreshes
- **Graphics/audio:** React SVG ship components, local assets, and current in-match sound cues

## Repo layout
- `game/client/**` - session lifecycle, networking, polling helpers, view-model orchestration
- `game/display/**` - in-match presentation screens, panels, board UI
- `components/**` - shells, panels, and reusable UI primitives
- `graphics/**` - ship graphics and visual assets
- `supabase/functions/server/**` - Edge Function entrypoint, routes, authoritative engine, and server-owned shared logic
- `documentation/**` - contracts, workflows, and infrastructure notes

## Current codebase overview
- `App.tsx` is the current top-level app entry/container. It supports dev-oriented views, the active shell/player flow, and direct in-match game mode.
- `ScreenManager` and the shell components are active project code, not dead scaffolding. The login and menu flow can create private games, create computer games, and launch directly into `GameScreen`.
- `GameScreen` is the live in-match shell. It renders from `useGameSession`, which handles auto-join, authoritative state refresh, chat/history reads, intent submission, and client-only presentation state.
- The runtime currently uses a polling-based read posture. Full game-state reads remain authoritative, lightweight head reads support change detection and clock snapshots, chat is polled separately, and battle-log history is fetched on demand from the session runtime.
- In-match audio is currently lightweight and local to the client runtime. The present manifest includes a live dice cue and placeholder entries for additional species-specific sounds.

## Development posture
This project is intended to be worked on through:
1. local Vite development for the client
2. local or deployed Supabase Edge Functions for authoritative logic
3. scoped implementation passes with architecture review

See [documentation/INDEX.md](documentation/INDEX.md) for the current documentation map.
