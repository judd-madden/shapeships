# Shapeships

Multiplayer, server-authoritative, turn-based fleet strategy game.

**Current state:** local Vite client + Supabase Edge Functions backend, with active implementation work across server rules, client/runtime wiring, and UI presentation.

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

The client renders server state and submits intents only.

### Single networking seam
All live server interaction should remain centralized in the client runtime layer, primarily through `game/client/**` and the session orchestration around `useGameSession`.

### Display is presentation
Code in `game/display/**`, `components/**`, and `graphics/**` is presentation-oriented. It should not become authoritative.

### Client/UI coupling is normal
In this repo, client runtime and UI work often move together in a single pass. That is acceptable as long as authoritative rules remain on the server.

## Technology stack
- **Client:** React + TypeScript + Vite + Tailwind
- **Server:** Supabase Edge Functions (Deno) + Hono
- **State:** server KV + client polling / refresh
- **Graphics:** React SVG ship components and local assets

## Repo layout
- `game/client/**` — session lifecycle, networking, view-model orchestration
- `game/display/**` — presentation screens, panels, board UI
- `components/**` — reusable shells and UI primitives
- `graphics/**` — ship graphics and visual assets
- `supabase/functions/server/**` — authoritative game engine and routes
- `documentation/**` — canonical docs and workflow docs

## Development posture
This project is intended to be worked on through:
1. local Vite development for the client
2. local/server-linked Supabase Edge Functions for authoritative logic
3. scoped implementation passes with architecture review

See [documentation/INDEX.md](documentation/INDEX.md) for the current documentation map.

## Current entry posture

During active development, `App.tsx` functions as the development dashboard and launcher.

This is intentional.

The shell/scaffolding area (menu, rules, shell-based flow) is still active project code and is intended to become the primary player-facing entry path over time.

Agents must not treat the shell/scaffolding path as obsolete unless a pass explicitly says so.