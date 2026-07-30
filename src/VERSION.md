# Shapeships — Current Repo Status

**Snapshot date:** July 30, 2026
**Status:** Active alpha codebase

## Current posture

Shapeships currently consists of:

- a Vite/React client
- a session-backed shell and in-match runtime
- a Supabase Edge Function server that remains authoritative for gameplay rules and canonical state transitions
- polling-based authoritative game-state, clock, chat, and history reads
- active desktop and mobile interfaces
- active public alpha development

The current Ancient source build is ready for player testing. Deployment of a particular source revision remains a separate user-controlled action.

## Player-selectable species

Four species are implemented for player-controlled play:

- Human
- Xenite
- Centaur
- Ancient

Ancient is available through the normal player selection flow without a development-versus-production feature gate.

Ancient bot support is deferred. Existing computer opponents continue to use their supported non-Ancient species.

## Phase 13 Ancient implementation

Ancient implementation is complete for the approved Phase 13 scope.

The completed implementation includes:

- Pluto, Mercury, and Neptune Energy cores; Quantum Mystic; Spiral; Solar Grid; and Cube
- ordered Ancient Charge Declaration with private local drafting and atomic authoritative submission
- manual Solar Power casting and Autocast
- Life, Star Birth, Asteroid, Supernova, Convert, Siphon, Vortex, Black Hole, and Simulacrum
- canonical Solar ledger state, public projections, targeting, and committed-target markers
- desktop and mobile interaction flows
- battle-log, history, breakdown, and statistics integration
- requester and spectator privacy
- reload-, rematch-, and replay-safe server behavior

Cube uses Dice Manipulation. Each controlled Cube provides one additional die, and the player may choose one die to use for the turn. Cube is not a Solar Power repeater.

Simulacrum may copy Cube because Cube is a Basic ship.

## P29 structural cleanup and hardening

P29 completed:

- consolidation of client Ancient targeting in `game/client/gameSession/ancientSolarTargeting.ts`
- ordinary player-selection enablement and removal of the obsolete selection feature gate
- explicit Energy definition-category mapping
- consolidation of server Solar resolvers in `supabase/functions/server/engine/ancient/solarPowerResolvers.ts`
- stale `phaseComputedEffects.ts` audit cleanup
- centralization of server tests under `supabase/functions/server/tests/**`
- consolidation of the Solar resolver test suites
- five focused reload, replay, history, declaration-order, and privacy hardening cases

The focused hardening increased the server baseline from 221 to 226 cases. No production defect was found during P29C.

## P30 release-readiness audit

The P30 release-readiness audit reported no code-level blocker requiring a production change. The approved audit validation completed successfully, and no repository changes were required.

P30 was a code-readiness audit, not a deployment pass. Documentation alignment was intentionally deferred until P31.

## Automated validation

At this snapshot, the centralized server suite contains 20 TypeScript test files and 226 passing cases.

The approved validation commands are:

```bash
npm run typecheck
npm run build
deno check src/supabase/functions/server/index.tsx
deno test --allow-env src/supabase/functions/server/tests
```

No browser automation is included in this validation baseline.

## Current testing and balancing phase

The Ancient implementation is now ready for real-player testing and balance refinement over the coming weeks.

Real play will evaluate:

- match flow and strategic balance
- power values and species matchups
- multiplayer declaration ordering
- reload and reconnect behavior
- spectator behavior
- desktop and mobile presentation
- dense-fleet conditions
- battle logs and match statistics
- rematches
- general usability and polish

Issues found through real play may lead to focused defect fixes, balance changes, gameplay refinement, and presentation polish. This work follows completion of the approved core implementation scope.

## Deferred work

- Ancient bot support
- final balance
- further polish driven by player testing
- deployment of specific future revisions where applicable

## References

- [Documentation index](documentation/INDEX.md)
- [Canonical architecture](documentation/contracts/canonical-handoff.md)
- [Server/client turn-phase contract](documentation/contracts/ServerClientTurnPhaseContract.md)
- [Phase 13 Ancient planning record](<documentation/Phase 13 Ancient Species - GPT-5.6 Planning Record.md>)
