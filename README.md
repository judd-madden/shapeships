# Shapeships

Shapeships is a free online 1v1 strategy game where shared dice become lines, lines become ships, and ships grow into strange, powerful fleets.

Each turn, a shared dice roll gives both players lines. Lines make ships. Ships have powers. Fleets stay on the board, so every turn compounds: damage engines, healing walls, greedy economy, control pieces, upgrades, counters, and sudden lethal turns.

Shapeships isn’t about movement or targeting. Ships don't move, don't have health, and (mostly) don't interact with each other directly. When you build a ship, its power becomes a permanent part of your fleet. The game is won by building the fleet that outpaces, outlasts, or breaks your opponent’s.

**Play Shapeships:** https://shapeships.com/

## Current Game

- Create private online matches or play against a server-controlled computer opponent.
- Play Computer games include a matchup-specific narrative Mission across every player/computer species matchup and an optional Challenge to win with or without a selected ship.
- Choose timed or untimed play and develop a persistent fleet through simultaneous Build and Battle phases.
- Read the opponent's visible fleet, commit hidden choices, and adapt when both plans are revealed.
- Play through active desktop and mobile match layouts with contextual actions, targeting, rules, and timing references.
- Watch or join matches as a spectator and use in-game chat.
- Review battle logs, download match history, inspect endgame statistics, and quickly create a rematch.
- Offer or refuse draws, resign, and resolve victories through the authoritative server.

## Species

- **Human — Metal. Explosions. Expansion.** Build a foundation, produce and upgrade ships, and turn steady development into pressure.
- **Xenite — Swarm. Queen. Hive.** Multiply, mutate, and crowd the board until the whole fleet becomes the threat.
- **Centaur — Power. Timing. Domination.** Create sharp swings and punish the opponent at decisive moments.
- **Ancient — Energy. Solar Powers. Ever present.** Gather Energy and turn it into carefully timed powers that reshape battle.

All four species are available for player-controlled play and as server-controlled computer opponents.

## Technology

The client uses React, TypeScript, Vite, and Tailwind CSS. The authoritative server runs as a Supabase Edge Function using Deno and Hono.

The server determines legality, phase progression, clocks, combat, effect resolution, persistence, and canonical game state. The client renders projected state, gathers input, and submits player intents.

See [`src/README.md`](src/README.md) for repository and architecture orientation.

## Development Process

Shapeships is designer-directed. Product direction, rules, balance decisions, runtime testing, and deployment remain human-owned, with scoped AI-assisted planning, review, and implementation used where useful.

Repository agents follow the server-authoritative architecture, ownership contracts, and scoped-pass workflow defined in:

- [`AGENTS.md`](AGENTS.md)
- [Canonical architecture contract](src/documentation/contracts/canonical-handoff.md)
- [Code ownership map](src/documentation/contracts/code-ownership-map.md)
- [Codex pass template](src/documentation/workflows/CodexPassTemplate.md)

## Project Documentation

- [Current repository status](src/VERSION.md)
- [Documentation index](src/documentation/INDEX.md)
- [Canonical architecture](src/documentation/contracts/canonical-handoff.md)
- [Server/client phase contract](src/documentation/contracts/ServerClientTurnPhaseContract.md)
- [Code ownership map](src/documentation/contracts/code-ownership-map.md)

## Running Locally

### Requirements

- Node.js 20
- npm
- Supabase CLI
- Deno

### Install dependencies

```bash
npm install
```

### Start the client

```bash
npm run dev
```

The authoritative game server runs through Supabase Edge Functions. See the project documentation for local Supabase configuration and development details.

## Validation

Common repository checks include:

```bash
npm run typecheck
npm run build
deno check src/supabase/functions/server/index.tsx
deno test --allow-env --allow-read src/supabase/functions/server/tests
```

## Status

Shapeships is in public alpha with all four species playable against players or server-controlled computer opponents. Real-game balance, bot plans, matchup content, presentation, and defects remain under active refinement.
