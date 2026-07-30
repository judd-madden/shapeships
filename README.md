# Shapeships

Shapeships is a free online 1v1 strategy game where shared dice become lines, lines become ships, and ships grow into strange, powerful fleets.

Players build simultaneously, reveal their choices, and develop permanent fleets of damage engines, healing walls, economy pieces, upgrades, counters, and control effects.

**Play Shapeships:** https://shapeships.juddmadden.com

## Current Features

- Online 1v1 multiplayer
- Server-controlled computer opponents
- Simultaneous hidden build turns
- Four player-selectable species: Human, Xenite, Centaur, and Ancient
- Dozens of ships with distinct powers
- Server-authoritative rules and combat resolution
- Desktop and mobile layouts
- Spectator mode and spectator chat
- Battle logs and downloadable match history
- End-of-game match statistics
- Timed and untimed games

Ancient implementation is complete for the approved Phase 13 scope and is entering real-player testing and balance refinement.

## Technology

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Supabase Edge Functions
- Deno
- Hono

Shapeships is server-authoritative. The server determines legality, phase progression, combat results, effect resolution, and canonical game state. The client renders server state, gathers player input, and submits intents.

See [`src/README.md`](src/README.md) for more detailed project and architecture documentation.

## GPT-5.6 and Codex

Shapeships is developed through an AI-assisted design and engineering workflow using both GPT-5.6 and Codex.

### GPT-5.6

GPT-5.6 was used for the large-scale design and implementation planning of Shapeships’ fourth species, Ancient, and continues to support later refinement and hardening.

This work includes:

- analysing interconnected rules and edge cases
- separating reusable mechanics from genuinely new systems
- defining server, client-runtime, and display responsibilities
- identifying regression risks to the existing species
- sequencing the work into small implementation passes
- evaluating implementation plans
- preparing scoped implementation briefs for Codex

The original approved planning and implementation roadmap is available here:

- [Phase 13 Ancient Species — GPT-5.6 Planning Record](src/documentation/Phase%2013%20Ancient%20Species%20-%20GPT-5.6%20Planning%20Record.md)

The planning record preserves useful historical design reasoning, but it is not the current implementation-status source. See [`src/VERSION.md`](src/VERSION.md) for the current repository snapshot.

### Codex

Codex has been the primary repository-attached implementation agent used throughout Shapeships development.

Codex is used to:

- inspect the live repository before changes are made
- propose file-level implementation plans
- implement scoped server, client-runtime, and UI passes
- preserve the server-authoritative architecture
- run TypeScript, build, and Deno validation
- report changed files, risks, assumptions, and validation results

Repository guidance for Codex and other coding agents is defined in:

- [`AGENTS.md`](AGENTS.md)
- [Canonical architecture contract](src/documentation/contracts/canonical-handoff.md)
- [Code ownership map](src/documentation/contracts/code-ownership-map.md)
- [Codex pass template](src/documentation/workflows/CodexPassTemplate.md)

### Development Workflow

1. I define the game design, product intent, and acceptance criteria.
2. GPT-5.6 helps analyse complex systems and turn them into reviewed engineering plans.
3. Codex inspects the repository and implements approved work through tightly scoped passes.
4. I review the code, run the game, test gameplay and presentation, and direct further refinements.

GPT-5.6 and Codex are used for substantive design and engineering work, not only for incidental text generation or decorative content.

## Project Documentation

Key documentation includes:

- [Documentation index](src/documentation/INDEX.md)
- [Canonical architecture](src/documentation/contracts/canonical-handoff.md)
- [Server/client phase contract](src/documentation/contracts/ServerClientTurnPhaseContract.md)
- [Code ownership map](src/documentation/contracts/code-ownership-map.md)
- [Codex pass template](src/documentation/workflows/CodexPassTemplate.md)

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
```

## Status

Shapeships is in public alpha and remains under active development.

Human, Xenite, Centaur, and Ancient are available for player-controlled play in the current source build. Ancient is entering real-player testing and balance refinement. Ancient computer-opponent support remains deferred.
