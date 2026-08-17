# Shapeships

Shapeships is a free online 1v1 strategy game where shared dice become lines, lines become ships, and ships grow into strange, powerful fleets.

Each turn, a shared dice roll gives both players lines. Lines make ships. Ships have powers. Fleets stay on the board, so every turn compounds: damage engines, healing walls, greedy economy, control pieces, upgrades, counters, and sudden lethal turns.

Shapeships isn’t about movement or targeting. Ships don't move, don't have health, and (mostly) don't interact with each other directly. When you build a ship, its power becomes a permanent part of your fleet. The game is won by building the fleet that outpaces, outlasts, or breaks your opponent’s.

**Play Shapeships:** https://shapeships.juddmadden.com

## Current Game

- Create private online matches or play against a server-controlled computer opponent.
- Play Computer games include a matchup-specific narrative Mission and an optional Challenge to win with or without a selected ship.
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

All four species are available for player-controlled play. Human, Xenite, and Centaur also support computer opponents; Ancient computer-opponent support remains deferred.

## Technology

The client uses React, TypeScript, Vite, and Tailwind CSS. The authoritative server runs as a Supabase Edge Function using Deno and Hono.

The server determines legality, phase progression, clocks, combat, effect resolution, persistence, and canonical game state. The client renders projected state, gathers input, and submits player intents.

See [`src/README.md`](src/README.md) for repository and architecture orientation.

## GPT-5.6 and Codex

Shapeships began as a dice-and-paper design in which simple shared rules create complicated strategic decisions. Its species support distinct build orders and matchup theories, while repeated games expose counters, balance questions, and new ways to use the same dice.

The game is developed through a designer-directed workflow using GPT-5.6 and Codex:

- The game designer owns product direction, rules, balance decisions, approval, runtime testing, and deployment.
- GPT-5.6 supports systems analysis, rule reasoning, architecture planning, risk analysis, implementation sequencing, plan evaluation, and refinement.
- Codex inspects and edits the live repository through approved, scoped passes that preserve the server-authoritative architecture.
- The process was used extensively for the Ancient species and continues to support the broader game.

GPT-5.6 and Codex provide substantive design and engineering support, not incidental copywriting, but neither autonomously owns product decisions or deployment.

The original approved Ancient design and implementation roadmap is preserved as a detailed example of the GPT-5.6 planning process:

- [Phase 13 Ancient Species — GPT-5.6 Planning Record](src/documentation/Phase%2013%20Ancient%20Species%20-%20GPT-5.6%20Planning%20Record.md)

That record provides historical planning context rather than current repository status. See [`src/VERSION.md`](src/VERSION.md) for the current snapshot.

Repository guidance for Codex and other coding agents is defined in:

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
deno test --allow-env src/supabase/functions/server/tests
```

## Status

Shapeships is in public alpha with four player-selectable species and active real-player testing and balancing. Ancient is the newest species entering that testing, and Ancient computer-opponent support remains deferred.
