# Shapeships — Current Repo Status

**Snapshot date:** August 23, 2026

**Status:** Active alpha codebase

## Game at a Glance

Shapeships is a server-authoritative, simultaneous-turn 1v1 fleet strategy game. A shared dice roll gives both players lines, lines build ships, and each permanent ship adds powers that shape future turns.

Fleets remain visible while current-turn choices stay private. Players read the developing board, commit different plans from the same dice, reveal together, and let the server resolve legality, effects, combat, and victory.

## Core Match Flow

- The server rolls shared dice, generates each player's available lines, and resolves any start-of-Drawing work.
- In Drawing, players build permanent fleet pieces, save resources, and complete upgrades or other species-specific development; interactive Drawing preludes are requester-local while both players can progress independently.
- Each player submits a hidden Drawing plan through atomic `BUILD_SUBMIT`; the server keeps it private until both plans are ready to resolve.
- The player-facing sequence is Dice Roll, Line Generation, Drawing, Reveal, First Strike, Charges / Solar Powers, and Turn Resolution.
- Damage and healing resolve simultaneously during Turn Resolution before the server checks victory and advances the match.

## Play Modes

- Private online multiplayer through shared game links
- Server-controlled computer opponents
- Timed and untimed games
- Spectator participation and in-game chat
- Draw offers, refusal or acceptance, resignation, and authoritative victory handling
- Completed-game rematches, including direct computer rematches and player rematch links
- Persistent battle history, downloadable logs, and endgame statistics

The active creation flow exposes one standard 1v1 game variant.

## Species Support

| Species | Player-controlled | Computer opponent |
| --- | --- | --- |
| Human | Yes | Yes |
| Xenite | Yes | Yes |
| Centaur | Yes | Yes |
| Ancient | Yes | Deferred |

- **Human:** Builds a foundation, produces and upgrades ships, then turns steady expansion into pressure, defence, or a late-game engine.
- **Xenite:** Multiplies, mutates, and fills the board until the swarm itself becomes the threat.
- **Centaur:** Creates sharp timing windows and heavy swings that punish opponents when they are vulnerable.
- **Ancient:** Manages Energy and flexible Solar Powers, with implemented targeting, copying, delayed threats, dice effects, and battle presentation.

Ancient is implemented for the approved player-controlled scope and is entering real-player balance testing. Ancient computer-opponent support remains deferred.

## Player-Facing Features

- Active desktop and mobile match interfaces with species selection and contextual actions
- Fleet, ship, targeting, resource, clock, and phase presentation
- Ship catalogue classifications for powers that `MAKE SHIPS` or `TARGET SHIPS`; tags describe powers without determining their timing
- Integrated core rules, species references, and turn-timing guidance
- Spectator counts, chat, draw controls, resignation, victory summaries, and rematches
- Battle logs, on-demand persisted history, downloadable match records, and endgame statistics
- Local sound and board-flash preferences, animation, visual feedback, and targeted reduced-motion handling

## Missions & Challenges

Each Play Computer game assigns the human player one matchup-specific narrative Mission and one optional Challenge to win with or without a selected ship. Missions do not change gameplay rules, and Missions & Challenges do not apply to normal multiplayer games.

The Mission is presented after species selection. While its intro is pending, the server gates the human player's ordinary gameplay and pauses timed-game clocks; the client acknowledges it through the existing session networking seam. Players can minimize Mission intros for later computer games in the same browser session.

When the game finishes, the server evaluates Mission success from the authoritative winner and Challenge success from the human player's final active fleet. After a live terminal Health Resolution presentation clears, the client automatically shows the existing Mission result unless Missions are minimized for the session; reopening or hydrating an already-finished game does not trigger that automatic presentation. Successfully completing certain Missions unlocks related Mission Findings in Lore for the current browser session, with some grouped Findings requiring multiple relevant Missions to be completed.

Separately, multiplayer games show a brief post-species matchup introduction before gameplay begins, with clocks paused authoritatively during the introduction.

## Runtime and Architecture

- React, TypeScript, Vite, and Tailwind CSS client
- Deno and Hono Supabase Edge Function server
- Server-minted, session-backed identity associated with temporary display names
- Server-owned rules, legality, phases, clocks, effects, persistence, combat, and canonical state
- Polling-based authoritative state and chat reads, with targeted refreshes and on-demand history retrieval
- Requester-, opponent-, and spectator-specific projections that protect hidden choices
- Drawing uses atomic `BUILD_SUBMIT`; internal commitment/reveal records, hashing, hidden-information projection, reconciliation, and idempotent resolution remain active
- Canonical server ship definitions with a mirrored client copy for rendering and previews
- Centralized server tests under `supabase/functions/server/tests/**`

Recent maintenance strengthened revision-safe timeout and seat-management persistence, hardened collision-safe game-ID allocation, verified bounded bot action handling, and expanded ship-definition mirror parity coverage. It also removed obsolete external `BUILD_COMMIT` / `BUILD_REVEAL` and dead Battle counterparts, plus the unused Alpha harness, while retaining the active internal Drawing commitment and privacy machinery.

## Automated Validation

At this snapshot, the centralized server suite contains 44 TypeScript `_test.ts` files. This document does not claim a new passing-case total because the suite was not run for this documentation-only update.

The approved validation commands are:

```bash
npm run typecheck
npm run build
deno check src/supabase/functions/server/index.tsx
deno test --allow-env src/supabase/functions/server/tests
```

No broad automated browser-test baseline is included in this validation posture.

## Current Alpha Limitations

- The active creation flow offers one standard 1v1 variant and no automatic in-app matchmaking.
- Identity is session- and display-name-based rather than a complete account-authentication system.
- Ancient computer-opponent support remains deferred.
- Dice and destruction cues are active, but wider species-specific sound coverage is incomplete.
- Broad browser automation is not part of the current regression baseline.

The public game URL does not establish that every current source revision has been deployed.

## Current Development Focus

Current work emphasizes real-player testing, balance and matchup evaluation, and defect discovery through live matches across Ancient, the simplified turn flow, Missions and Lore, multiplayer introductions, and the mobile/runtime experience.

Targeted validation continues around desktop and mobile polish, reconnect behavior, spectators, rematches, battle logs, downloadable history, statistics, and fixes informed by observed play.

## References

- [Documentation index](documentation/INDEX.md)
- [Canonical architecture](documentation/contracts/canonical-handoff.md)
- [Server/client turn-phase contract](documentation/contracts/ServerClientTurnPhaseContract.md)
- [Phase 13 Ancient Species — GPT-5.6 Planning Record](<documentation/plans/Phase 13 Ancient Species - GPT-5.6 Planning Record.md>)
