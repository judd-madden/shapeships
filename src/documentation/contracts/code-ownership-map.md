# Shapeships Code Ownership Map

This document is a quick reference for where changes belong.

For architectural invariants, see:
- [canonical-handoff.md](canonical-handoff.md)

For operational agent rules, see:
- [../../../AGENTS.md](../../../AGENTS.md)

## Server Engine
Directory:
- `src/supabase/functions/server/**`

Responsibilities:
- authoritative rules
- game state transitions
- combat resolution
- intent validation
- effect execution

This layer determines the final authoritative outcome of game actions.

## Client Runtime
Directory:
- `src/game/client/**`

Responsibilities:
- session management
- communication with the server
- view-model generation
- orchestration of UI state

Networking should remain centralized here.

## Display Layer
Directories:
- `src/game/display/**`
- `src/components/**`
- `src/graphics/**`

Responsibilities:
- UI rendering
- layout
- animation
- visual feedback

This layer must not become authoritative.

## Data Definitions
Canonical ship definitions live on the server.

The client keeps a mirrored local dataset for rendering and previews.
If the client mirror and server differ, the server wins.

## Shared Primitives
Shared UI components and graphics should remain reusable and presentation-oriented.

## Typical pass split
- **Server Pass** — server only
- **Client/UI Pass** — client runtime + display together
- **Tooling Pass** — config/build systems only
- **Mixed Pass** — explicit approval required
