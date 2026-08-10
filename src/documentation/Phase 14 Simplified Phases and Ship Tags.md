# Phase 14 — Simplified Phases and Ship Tags

## Historical Planning and Pass-Decomposition Document

- **Status:** Historical Phase 14 implementation roadmap
- **Pass type:** Documentation / Planning
- **Rules baseline:** Shapeships v1.6 plus the locked Phase 14 decisions in this document
- **Architecture baseline:** Current server-authoritative repository contracts
- **Compatibility posture:** No persisted-game migration; old in-progress games may be discarded
- **Last verified against live code:** 2026-08-04

> **Historical authority:** Implementation has progressed through Phase 14K. This roadmap is retained as implementation history; later QA and rules refinements and the current executable code supersede implementation details where they differ. Current phase truth belongs in the executable code and [server/client turn-phase contract](contracts/ServerClientTurnPhaseContract.md), not this historical roadmap. The [Phase 14 Rules v1.63 Alignment Addendum](<Phase 14 Rules v1.63 Alignment Addendum.md>) records later Phase 14 refinement history.

---

## Contents

1. Status and authority
2. Source precedence
3. Purpose
4. Scope and non-goals
5. Locked Phase 14 rules
6. Authoritative ship-power tag model
7. Locked tag membership
8. Final phase contract
9. Verified current-repository audit
10. Charge Response removal architecture
11. Drawing-prelude architecture
12. Chronoswarm behavior
13. Hidden-information and concurrency model
14. Client/runtime and display implications
15. Bot implications
16. Battle Log and history implications
17. Documentation reconciliation
18. Recommended pass sequence
19. Per-pass implementation briefs
20. Test strategy
21. Risks and review gates
22. Deferred presentation decisions
23. Expected deletion/replacement list
24. Mechanisms retained and reused
25. Dependency diagram
26. Completion criteria
27. Historical first implementation recommendation

---

# 1. Status and authority

## 1.1 Planning status

This is the repository-resident normative Phase 14 planning record. It replaces the supplied external draft and incorporates the accepted live-code assessment.

Implementation prompts for Phase 14 must use this document rather than reconstructing scope from historical phase names or comments. The per-pass briefs in Section 19 are the implementation boundaries.

## 1.2 Rule status

The gameplay decisions in Sections 5, 7, 8, 10–12 and the locked presentation semantics in Section 6 are settled. Implementation may choose narrow code organization details but must not reopen those rules.

In particular, current code is evidence of the implementation being replaced. It is not authority for preserving either removed phase.

No independent claim is made that the v1.6 PDF was re-audited during preparation of this revision. The locked Phase 14 decisions and accepted assessment are the direct basis of the revised record.

## 1.3 Architecture status

Shapeships remains server-authoritative:

- the server owns phase progression, eligibility, legality, effects and canonical state;
- the client runtime owns networking, local drafts and presentation-safe orchestration;
- display components render state and gather input but do not invent rules;
- bots execute through the internal authoritative intent path;
- canonical ship definitions remain on the server with a presentation mirror on the client;
- completed Battle Log history remains separate from live game state, while private current-turn Battle Log scratch remains part of canonical hot state.

Phase 14 extends these seams. It does not introduce a new gameplay authority layer.

---

# 2. Source precedence

When sources disagree, use this order:

1. Locked Phase 14 gameplay and designer decisions in this document.
2. Shapeships v1.6 rules.
3. Verified live repository architecture and executable behavior for implementation facts.
4. Existing normative repository documents where compatible.
5. Historical code, comments and planning records only as evidence of the former implementation.

Do not preserve an obsolete phase because it remains present in code, fixtures or documentation.

---

# 3. Purpose

Phase 14 has three outcomes:

1. simplify Build by moving applicable Ships That Build behavior into an independent per-player start-of-Drawing prelude;
2. simplify Battle by making Charge Declaration the only ordinary charge-choice window;
3. add exactly two canonical per-power ship classifications for presentation and definition inspection.

The implementation must preserve existing downstream build economy, charge survivability, hidden-information behavior, bot support and history capture while removing the obsolete global phases.

---

# 4. Scope and non-goals

## 4.1 In scope

- Remove `build.ships_that_build`.
- Remove `battle.charge_response`.
- Add per-player Drawing-prelude state and orchestration.
- Preserve applicable CAR, BUG, QUE and recurring ZEN behavior at Drawing entry.
- Preserve Chronoswarm repetition of those applicable start-of-Drawing powers.
- Preserve Simulacrum and Dreadnought at their distinct timings.
- Add canonical `makes_ships` and `targets_ships` tags per power.
- Add explicit activation timing separate from tags.
- Keep the client definition mirror aligned with the server.
- Repair Drawing fleet privacy at the server DTO boundary.
- Make prelude state and events viewer-safe.
- Add the narrow conflict-safe persistence prerequisite required by independent player mutations.
- Update active desktop, mobile, bot, history, test and rules surfaces.
- Reconcile normative documentation after behavior settles.

## 4.2 Out of scope

- New balance rules.
- A generic free-form tagging system.
- Inferring tags from wording, ship IDs, ASTs, targets or timing.
- Making tags determine activation timing.
- A generic workflow/state-machine framework.
- A broad DTO redesign.
- Moving networking into display components.
- A mobile-only gameplay state machine.
- New bot strategy beyond adapting existing policy.
- A broad database redesign.
- Schema, SQL function, RPC or infrastructure changes without a separately approved pass.
- Persisted-game migration or compatibility aliases for removed phases.
- Final badge layout, typography, separators or responsive styling.
- Modernizing inactive legacy code merely to make text searches empty.

## 4.3 Compatibility posture

No persisted-game migration is required. Old in-progress games may be discarded at each atomic behavior cutover. Removed phase keys and response fields are deleted rather than aliased.

Additive definition metadata and inactive server foundations may be reverted independently as described by their passes. Active phase behavior must deploy only in its listed atomic unit.

---

# 5. Locked Phase 14 rules

## 5.1 Final phase sequence

### Setup

Preserve the current setup phases.

### Build

1. `build.dice_roll`
2. `build.line_generation`
3. `build.drawing`
4. `build.end_of_build`

### Battle

1. `battle.reveal`
2. `battle.first_strike`
3. `battle.charge_declaration`
4. `battle.end_of_turn_resolution`

Preserve KNO and Cube as internal `build.dice_roll` stages. They are not new phases.

## 5.2 Charge Declaration is final

Charge Declaration is the only ordinary charge-choice window.

- Players make all ordinary Use/Hold choices in Charge Declaration.
- Ready makes those choices final for the turn.
- There is no Charge Response, Last Chance, lethal-only exception or second Ancient Energy window.
- Declared-source survivability remains.
- Declaration-start snapshots, simultaneous privacy, one-use protection, FAM behavior, EQU reservations, Solar decisions, autocast order and Ancient atomicity remain.

## 5.3 Drawing-prelude behavior

Ships That Build becomes an independent per-player start-of-Drawing prelude inside `build.drawing`.

- Automatic powers resolve before that player enters the normal Drawing catalogue.
- Carrier choices are interactive.
- Players may finish their preludes independently.
- A player may submit a hidden Drawing build after their own prelude is complete even while the opponent remains in the prelude.
- The final Drawing phase still advances globally only after both Drawing submissions exist.
- Prelude completion is not phase readiness and requires no separate Ready click.

## 5.4 Ship-specific locked behavior

### Carrier

- Carrier is interactive at Drawing entry.
- Every eligible Carrier source is resolved once per applicable pass.
- Legal choices remain Defender, Fighter or Hold according to current affordability.
- Hold spends nothing and creates nothing.
- A Carrier with only Hold legal is resolved as a server-recorded forced Hold without UI input.

### Bug Breeder

- Bug Breeder is automatic at Drawing entry.
- Preserve existing charge costs, age rules, same-turn direct-materialisation exception and output behavior.

### Queen

- Queen is automatic at Drawing entry.
- Preserve Queen’s normal creation behavior and `queenCreatedXenitesThisTurnByPlayerId` accounting.
- Queen repeats for Chronoswarm when otherwise eligible.
- Queen is an Upgraded Ship. Simulacrum copies Basic Ships only, so Queen cannot be a Simulacrum copy and must never be added to Simulacrum direct-materialisation exceptions.
- A Queen already owned or controlled through another valid mechanism participates normally.

### Zenith

- Zenith’s recurring creation power is automatic at Drawing entry and repeats for Chronoswarm.
- Zenith’s when-built Antlion trigger remains a normal Drawing creation consequence and does not repeat.
- Zenith’s destruction creation remains at destruction timing and does not repeat.

### Chronoswarm

- One or more qualifying Chronoswarms give the owner exactly two Drawing-prelude passes.
- More than one does not create additional passes.
- Pass 1 uses the effective main roll.
- Pass 2 uses the owner’s first Chronoswarm roll.
- Applicable CAR, BUG, QUE and recurring ZEN powers repeat.

### Evolver

- Evolver remains a normal Drawing power.
- It is not part of the prelude and does not repeat for Chronoswarm.
- It receives `targets_ships` only.

### Simulacrum

- Simulacrum retains queued turn-start materialisation before Drawing.
- Materialisation is not repeated by Chronoswarm.
- Preserve the explicit current-turn copied CAR/BUG/ZEN eligibility behavior.
- Do not include Queen among copy targets or direct-materialisation cases.

### Dreadnought

- Dreadnought retains End-of-Build timing.
- It is not part of the Drawing prelude and does not repeat for Chronoswarm.

---

# 6. Authoritative ship-power tag model

## 6.1 Closed canonical type

The only authoritative tags are:

```ts
type ShipPowerTag = 'makes_ships' | 'targets_ships';
```

This is a closed union, not a generic tag registry. New values require a separate rules/design decision.

## 6.2 Placement and identity

Tags attach to individual raw power definitions. The stable coordinate is:

```text
shipDefId#rawPowerIndex
```

The raw index must be preserved explicitly. A flattened structured-power array index is not canonical identity because only overlaid powers may appear in that flattened array.

The server and client mirror may duplicate the small closed union at their ownership boundary. Production server code must not import client definitions.

## 6.3 Presentation aggregation

Presentation surfaces derive one aggregated, deduplicated ship-level tag list from the ship’s tagged powers.

Locked display order:

1. `MAKES SHIPS`
2. `TARGETS SHIPS`

Requirements:

- show each applicable tag at most once per ship/card;
- do not repeat a tag when multiple powers on the ship share it;
- do not expose raw power indexes in presentation;
- retain canonical per-power association in definition data;
- keep detailed power text, timing and wording unchanged;
- do not let presentation aggregation become authoritative.

## 6.4 No inference

Tags must not be inferred from:

- ship IDs or species;
- phase/subphase strings;
- effect ASTs;
- targeting metadata;
- action types;
- power wording;
- whether an implementation helper currently creates or targets a ship.

## 6.5 Tags do not replace timing

`makes_ships` classifies a power. It does not mean “run at Drawing entry.”

Definition metadata must separately distinguish at least:

- `start_of_drawing`;
- `when_built`;
- `on_destruction`;
- `end_of_build`;
- `turn_start_materialisation`;
- other existing timings as required by the raw definition model.

The exact type spelling may follow nearby conventions, but it must be explicit, closed enough for the affected definitions and mirrored with the tags.

## 6.6 Alignment posture

A test-only parity comparator must compare exact server-authoritative rows against the client mirror:

```text
{ shipDefId, rawPowerIndex, tags, activationTiming }
```

Ship-level aggregation is tested separately in server inspection helpers and client presentation helpers.

---

# 7. Locked tag membership

| Tag | Exact raw power membership |
|---|---|
| `makes_ships` | `CAR#0`, `DRE#0`, `BUG#0`, `ZEN#0`, `ZEN#1`, `ZEN#2`, `QUE#0`, `SSIM#0` |
| `targets_ships` | `GUA#0`, `EVO#0`, `SAC#0`, `EQU#0`, `DOM#1`, `SPI#2`, `SSIM#0`, `SBLA#0` |

Explicit exclusions:

- Evolver does not receive `makes_ships`.
- Chronoswarm receives neither tag.
- A ship is not tagged merely because an effect implementation happens to create or target ships.
- Tags attach only to the listed powers, even when another power exists on the same ship.

---

# 8. Final phase contract

## 8.1 Canonical sequence

`PHASE_SEQUENCE` remains the one canonical phase sequence and the source of the derived `PhaseKey` server contract.

The final sequence excludes:

- `build.ships_that_build`;
- `battle.charge_response`.

Client code receives partial compile-time assistance through shared phase validation, but active client routing also contains plain string comparisons. Removal therefore requires both type correction and an active-reference audit.

## 8.2 Internal stages are not phases

The following remain local authoritative stages or requester workflow metadata, not new `PHASE_SEQUENCE` entries:

- KNO rerolls;
- Cube dice manipulation;
- Drawing-prelude pass 1/pass 2;
- Drawing-prelude awaiting-actions/complete status;
- normal Drawing catalogue state;
- Drawing submitted/waiting state.

The client may render these stages but does not own them.

## 8.3 Readiness contract

- Generic input phases may continue to use `phaseReadiness` and `DECLARE_READY` as currently defined.
- Charge Declaration Ready makes all charge choices final.
- Drawing final completion is established by accepted `BUILD_SUBMIT`, not generic `DECLARE_READY`.
- Drawing-prelude completion never writes `phaseReadiness`.
- The server rejects `BUILD_SUBMIT` until the requester’s prelude is complete for the canonical current turn.

---

# 9. Verified current-repository audit

## 9.1 Architectural baseline

The live repository confirms:

- canonical phase and legality ownership on the server;
- client networking in `src/game/client/**`;
- presentation-oriented display components;
- server definitions plus a mirrored client copy;
- server-side bots using the internal intent reducer;
- viewer/requester DTO projection;
- shared desktop/mobile runtime and view-model state;
- completed-turn Battle Log history in a separate store;
- response-private current-turn `battleLogScratch` in canonical hot state.

## 9.2 Phase machinery

`src/supabase/functions/server/engine_shared/phase/PhaseTable.ts` currently contains both removed phases. `PhaseKey` is derived there, while client validation is re-exported through `src/engine/phase/PhaseTable.ts`.

`advancePhase.ts` currently repeats the global Ships That Build phase for Chronoswarm, clears readiness and emits a pass-advanced event. `onEnterPhase.ts` performs entry work and can auto-advance no-input phases. GET state polling does not call it as a mutating repair path.

Drawing is currently completed through `IntentReducer.ts::handleBuildSubmit`. Generic Ready is not its completion contract.

## 9.3 Current Ships That Build mechanics

`resolvePhase.ts::resolveShipsThatBuild` currently resolves all players globally. It:

- collects structured effects;
- adds custom BUG, QUE and ZEN creation;
- applies effects;
- updates creation counters;
- captures build events;
- emits phase/pass activation cues.

This orchestration cannot be reused intact for independent players. Its effect, counter, creation and capture pieces should be extracted.

Carrier actions are projected in `game_routes.ts::computeAvailableActionsForRequestingPlayer` and resolved through `resolvePowerAction.ts`. Current usage is marked only for non-Hold action resolution. The client’s old Ships That Build Ready flow skips Hold actions and then submits `DECLARE_READY`; both behaviors must change for the prelude.

Current automatic usage markers are incomplete for retry safety: Queen has no equivalent durable exact-power marker and a zero-output Zenith evaluation can lack proof of evaluation.

## 9.4 Drawing economy and creation reuse

`buildSubmitResolution.ts` starts from the canonical current fleet. Prelude-created ships can therefore participate in the same Drawing’s:

- provisional evaluation;
- upgrades and component consumption;
- quantity limits;
- affordability;
- depleted-charge restrictions;
- foreign-build rules.

`drawingShipCreation.ts` and existing effect paths already support creation counters and build-capture events. Queen-specific XEN accounting must remain.

Dreadnought remains separately implemented at End of Build.

## 9.5 Hidden fleet projection

`ancientState.ts::projectPublicShipsForClient` currently projects live canonical fleets broadly. `src/game/client/gameSession/fleets.ts::deriveFleets` then hides opponent current-turn builds and preserves public materialised Simulacrum ships.

Client filtering is not an adequate privacy boundary. The server must capture Drawing-entry public fleets after Simulacrum materialisation and apply one viewer-aware projection to both GET and intent responses.

## 9.6 Charge machinery

`chargeDeclarationEligibility.ts`, charge resolution helpers and visibility state currently contain both retained Declaration mechanisms and response-only branches.

Retained mechanisms include:

- declaration source and fleet snapshots;
- ordinary and Solar source identity;
- live-or-void source resolution;
- declaration input gating;
- declaration privacy and acknowledgements;
- one-use memory;
- FAM and EQU state;
- atomic Ancient declaration, ordered Solar decisions and autocast.

Response-only gates, response source filters and response timing overlays can be removed atomically with the phase.

## 9.7 Definitions and raw power identity

Canonical raw definitions are per power and can accept additive tags/timing without reshaping ship data. Structured overlays join using raw coordinates but may be flattened for runtime action consumption. Metadata and tests must retain `rawPowerIndex` explicitly.

The server and client raw definition versions currently mirror one another manually. No existing full tag/timing parity test provides the required Phase 14 guarantee.

## 9.8 Client/runtime surfaces

Active removed-phase branches exist in:

- `useGameSession.ts` routing, Ready flow, phase-instance keys and Centaur charge tabs;
- `gameSession/intents.ts` batch submission;
- available-action filtering and view-model mapping;
- action-panel registry and Carrier panel IDs;
- phase labels and Phase Breakdown;
- Turn Timings, Core Rules and Species Rules;
- mobile shared timeline/panel presentation;
- developer galleries and fixtures.

The current default phase-instance key does not distinguish Drawing-prelude pass 1, pass 2 and the normal catalogue.

## 9.9 Bot handling

The bot runner is correctly authoritative and event-driven. Its current Ships That Build branch can consume one loop step per Carrier and operates under `MAX_BOT_STEPS_PER_REQUEST = 8`.

Bots run after accepted writes, not GET polling. A new bot flow must batch all unresolved Carrier choices for a pass and prove the worst-case chain remains under the safety cap.

## 9.10 Battle Log and history

Completed summaries are stored separately, but current-turn capture scratch is stored with canonical game state and removed from responses.

Build capture already records produced ships and source tags. Current formatting aggregates/buckets rows but does not retain a Drawing-prelude pass index. Strict pass ordering requires private occurrence/pass metadata.

## 9.11 Persistence and revision

`intent_routes.ts` loads, applies, reloads and reapplies an intent before persistence. Final writes use unconditional upsert. `state_revision.ts` validates and increments a number but does not make the write conditional.

Two writers can therefore apply against the same latest revision and compete at final persistence. Phase 14E0 must prove and repair this narrowly before active independent Drawing-prelude deployment.

## 9.12 Tests, dormant code and defaults

Tests directly construct old phase values and old turn-data fields. Active fixtures and rules copy also retain both phase names.

Fresh-game construction contains stale `turnData.chargesDeclared` defaults. Active-tree types contain response-shaped members not guaranteed to be caught by `PhaseKey` compilation.

Unimported files in active source folders and explicit `legacy/**` trees must be classified by reachability. Phase 14 does not modernize dormant historical code solely for search cleanliness.

---

# 10. Charge Response removal architecture

## 10.1 Server sequence

Delete `battle.charge_response` from the canonical sequence and all active routing. After both Charge Declaration submissions resolve, progression goes directly to `battle.end_of_turn_resolution`.

## 10.2 Declaration entry and no-input advance

Declaration entry retains its source/fleet/visibility snapshots. A player with no input is handled by the current authoritative auto-advance posture. Removing the response phase must not remove data needed to resolve already-declared actions.

## 10.3 Final submission

All ordinary Use/Hold and Solar decisions are made in Declaration. Accepted Ready is final for the turn. Ancient declarations remain one atomic versioned transaction, including ordinary actions, explicit Solar Use/Hold choices, ordered casts and autocast behavior.

## 10.4 Privacy and direct advancement

Declaration choices remain hidden until the current simultaneous resolution boundary. Direct Declaration-to-End-of-Turn advancement must preserve visibility release at the same authoritative completion point.

## 10.5 Survivability

Retain:

- `chargeDeclarationEligibleSourceIdsByPlayerId`;
- `solarGridDeclarationSourceIdsByPlayerId`;
- `chargeDeclarationFleetSnapshotByPlayerId`;
- declaration visibility snapshot and acknowledgements;
- accepted Ancient declaration state;
- Solar declaration ledger;
- `chargePowerUsedByInstanceId`;
- `acceptedShipOfEqualityTargetsByPlayerId`;
- live-or-void declared-source lookup.

## 10.6 Safe state deletion

Delete after call-site validation:

- `anyChargesDeclared`;
- `anyChargesSpentInDeclaration`;
- `chargeDeclarationEligibleByPlayerId`;
- stale fresh-game `chargesDeclared` defaults;
- response member of charge timing unions;
- response source/option helpers;
- response bot policy fields;
- response client branches and callout state.

Do not delete declaration snapshots merely because their names contain charge/declaration terminology.

## 10.7 Atomic Mixed Pass

Charge Response removal remains one atomic Mixed Pass spanning server phase/state/definitions/routes, bot policy, client routing, desktop/mobile rules surfaces, fixtures and tests.

It is independent of Drawing consolidation and should occur first to reduce active phase branching. It does not depend on Phase 14E0.

---

# 11. Drawing-prelude architecture

## 11.1 Design goals

The prelude must be:

- per player rather than global;
- frozen from Drawing-entry source eligibility;
- exact per raw source power;
- retry-safe for output and no-output evaluation;
- independent of final Drawing readiness;
- private at state and event boundaries;
- reusable by humans and bots through the same server action projection.

## 11.2 Authoritative state model

Store the prelude in `gameData.turnData`:

```ts
type DrawingPreludePassIndex = 1 | 2;

type DrawingPreludeSourcePower = {
  key: string; // `${sourceInstanceId}:${shipDefId}#${rawPowerIndex}`
  sourceInstanceId: string;
  shipDefId: string;
  rawPowerIndex: number;
  mode: 'automatic' | 'interactive';
};

type DrawingPreludePlayerState = {
  turnNumber: number;
  requiredPassCount: 1 | 2;
  activePassIndex: DrawingPreludePassIndex;
  status: 'awaiting_actions' | 'complete';
  eligibleSourcePowers: DrawingPreludeSourcePower[];
  resolvedSourcePowerKeysByPass: Partial<
    Record<DrawingPreludePassIndex, string[]>
  >;
};

type TurnData = {
  drawingPreludeByPlayerId?: Record<string, DrawingPreludePlayerState>;
  buildDrawingPublicFleetByPlayerId?: Record<string, ShipInstance[]>;
};
```

The eligible descriptors are frozen once and reused for either pass. Exact resolved keys prove both automatic completion and zero-output evaluation. Do not add redundant `automaticResolvedByPass` state.

Automatic resolution is synchronous within one accepted working-state transaction. `resolving_automatic` is not a required durable status.

## 11.3 Initialisation timing

Initialise when entering `build.drawing`, after:

- turn-start Simulacrum materialisation;
- dice setup/manipulation and Chronoswarm roll capture;
- Line Generation.

Order:

1. capture each player’s Drawing-entry public fleet;
2. freeze one/two-pass count from current turn Chronoswarm data;
3. identify exact eligible start-of-Drawing source powers from canonical definitions plus explicit timing;
4. apply existing source-specific age/direct-materialisation rules;
5. begin pass 1 independently for each player.

Ships made during normal Drawing cannot join the frozen prelude source set.

## 11.4 Advancement helper

Introduce a focused concept equivalent to:

```ts
advanceDrawingPreludeForPlayer(state, playerId)
```

It must:

1. no-op if complete for the canonical current turn;
2. resolve each unevaluated automatic source for the active pass;
3. record exact resolved keys even when no effect is produced;
4. inspect unresolved interactive Carrier sources;
5. record forced Hold for a Carrier with no affordable non-Hold choice;
6. set `awaiting_actions` only when a meaningful Carrier choice remains;
7. complete the pass when all exact sources are resolved;
8. start pass 2 immediately when required;
9. otherwise set `complete`.

Valid invocation points:

- Drawing entry;
- after an accepted Carrier action/batch;
- bounded authoritative retry/reapply.

GET polling must never mutate state or repair the prelude.

## 11.5 Atomic idempotency

For every automatic source/pass, one accepted transaction must:

- verify the frozen source descriptor;
- derive effects from current authoritative state and the frozen timing context;
- apply effects to a working clone;
- update creation counters and Queen XEN accounting;
- record the exact resolved key;
- emit activation cues and Battle Log capture once;
- persist only after the entire transaction succeeds.

An effect occurring is not the usage marker.

## 11.6 Carrier actions and Hold

Project a Carrier action only when:

- canonical phase is `build.drawing`;
- requester status is `awaiting_actions`;
- it belongs to the requester’s active pass;
- the exact raw source power is in the frozen set;
- that source key is unresolved;
- at least one meaningful non-Hold choice is affordable.

The narrow requester DTO is:

```ts
requester: {
  drawingPrelude?: {
    turnNumber: number;
    status: 'awaiting_actions' | 'complete';
    passIndex: 1 | 2;
    passCount: 1 | 2;
  };
  availableActions: AvailableActionDto[];
}
```

The client submits every selected Carrier choice, including Hold, in one batch. Accepted Hold:

- spends nothing;
- creates nothing;
- resolves that source for the active pass;
- cannot be revised after acceptance;
- does not prevent the source acting in pass 2.

If Hold is the only legal choice, the server records forced Hold during advancement and exposes no pointless input step.

No prelude batch is followed by `DECLARE_READY`.

## 11.7 `BUILD_SUBMIT` gate

In `IntentReducer.ts::handleBuildSubmit`, before commit/reveal storage or duplicate-commit mutation:

```text
Accept BUILD_SUBMIT for player P only when P's Drawing prelude
is complete for the canonical current turn.
```

Existing stale-turn normalization occurs before this check. The opponent’s prelude status is irrelevant.

Player A may submit and wait while Player B remains in pass 1 or pass 2. Existing authoritative build resolution continues to wait for both submissions.

## 11.8 Downstream build reuse

Prelude ships enter the canonical fleet before normal Drawing. Existing working-fleet systems remain authoritative for:

- provisional evaluation;
- upgrade components;
- quantity limits;
- charge restrictions;
- build counters;
- Queen XEN exclusion accounting;
- activation cues;
- build capture.

## 11.9 Copied and controlled builders

Eligibility follows the current controller’s fleet and the canonical raw power definition, not selected species.

- Controlled foreign CAR, BUG, QUE and ZEN may participate when otherwise eligible.
- Preserve direct-materialisation same-turn exceptions for copied CAR/BUG/ZEN.
- Queen is not a Simulacrum copy target because it is Upgraded; no copied-Queen exception or review gate exists.
- Simulacrum materialisation itself, Evolver, Dreadnought, Zenith when-built and Zenith destruction never enter the recurring prelude set.

## 11.10 Revision and polling

Accepted entry/action transactions must produce a new authoritative revision so `/game-state-head` causes clients to fetch the changed requester state. Rejected and true no-op duplicates do not persist or bump revision.

Logical idempotency depends on exact source/pass markers. Concurrency safety additionally depends on Phase 14E0’s conditional final write.

---

# 12. Chronoswarm behavior

## 12.1 Pass count

For each player:

```text
requiredPassCount = chronoswarmCountAtDiceSetup > 0 ? 2 : 1
```

The value is frozen at Drawing entry. A Chronoswarm made later in Drawing cannot add a pass.

## 12.2 Roll semantics

- Pass 1 recurring Zenith uses the owner’s effective main die result.
- Pass 2 uses `chronoswarmRolls[0]`.
- Existing LEV/effective-die semantics remain for pass 1.
- The first Chronoswarm roll remains shared/public under current rules.

## 12.3 Repeated powers

Repeat, when eligible:

- Carrier start-of-Drawing power;
- Bug Breeder start-of-Drawing power;
- Queen start-of-Drawing power;
- Zenith recurring start-of-Drawing power.

Do not repeat:

- Evolver;
- Dreadnought;
- Simulacrum materialisation;
- Zenith when-built Antlion;
- Zenith destruction Xenites;
- any other Drawing action.

## 12.4 Independent players

Chronoswarm pass 2 is not a global phase loop.

```text
Player A: pass 1 complete → normal Drawing → BUILD_SUBMIT accepted
Player B: pass 1 Carrier choices → pass 2 automatic → pass 2 Carrier choices
Player A remains submitted/hidden while Player B finishes
```

---

# 13. Hidden-information and concurrency model

## 13.1 Declaration privacy

Charge Declaration remains simultaneously hidden until the authoritative completion/resolution boundary. Retain the visibility snapshot and requester acknowledgement mechanisms.

## 13.2 Drawing privacy

During Drawing:

- an owner sees their live authoritative fleet;
- an opponent sees that owner’s Drawing-entry public snapshot;
- a spectator sees Drawing-entry public snapshots for both players;
- already-public Simulacrum materialisation remains visible because it is in the snapshot;
- prelude production and hidden normal Drawing changes remain private;
- saved-resource masking remains.

## 13.3 Shared viewer projection boundary

One viewer-aware sanitizer must serve full game-state GET and intent responses. It must:

- project fleets according to Section 13.2;
- expose only `requester.drawingPrelude`;
- remove canonical `drawingPreludeByPlayerId`;
- remove `buildDrawingPublicFleetByPlayerId`;
- remove `battleLogScratch`;
- filter private prelude events and activation cues;
- preserve existing charge and saved-resource privacy.

Client fleet filtering may remain defensive presentation logic but is not authoritative privacy.

## 13.4 Mutation order

Within one player/pass:

1. resolve automatic builders;
2. record automatic resolved keys;
3. record forced Hold where applicable;
4. expose meaningful Carrier choices;
5. accept explicit Carrier choices/Hold;
6. advance pass or complete prelude;
7. permit normal Drawing submission.

## 13.5 Conflict-safe persistence prerequisite

The current state revision is a counter/fingerprint, not a compare-and-swap precondition. Phase 14E0 must:

- prove the collision/lost-update behavior with focused tests;
- use the smallest conditional-write mechanism supported by the current persistence layer;
- require the stored revision to match the final apply base;
- perform bounded reload/reapply on conflict;
- bump revision once for an accepted final transaction;
- avoid persistence/revision changes for rejection or a true no-op duplicate;
- preserve game/history consistency at turn finalization.

If the current KV/table interface cannot express the precondition, 14E0 stops and reports. Schema, SQL function, RPC or infrastructure work requires a separately approved database/tooling pass.

14E0 does not block behavior-neutral metadata work or Charge Response removal. It blocks active independent Drawing-prelude deployment.

---

# 14. Client/runtime and display implications

## 14.1 Runtime

The client runtime must:

- read canonical phase `build.drawing`;
- read requester prelude status/pass metadata;
- render Carrier choices from normal available actions;
- submit explicit Hold actions;
- never send prelude `DECLARE_READY`;
- prevent local `BUILD_SUBMIT` while the prelude is incomplete;
- rely on server rejection as final authority;
- refresh own fleet/provisional evaluation after accepted mutations;
- remove both obsolete phase branches.

## 14.2 Stage/pass-aware identity

One-shot routing and selection state must use an identity containing at least:

```text
gameId + playerId + turnNumber + build.drawing + requester stage + passIndex
```

This distinguishes pass 1, pass 2 and normal Drawing, prevents stale selections and stops polling from repeatedly reopening Actions after manual navigation.

While requester status is `awaiting_actions`, the reused Carrier panel takes priority over normal catalogue auto-routing. The catalogue becomes the normal route only after `complete`.

## 14.3 Panel and mobile reuse

Rename old Ships That Build panel IDs/copy to Drawing-prelude terms and reuse the component where practical. Do not clone networking or state logic for mobile.

Desktop and mobile consume the same runtime/view-model data. Layout and responsive presentation may differ.

## 14.4 Tag presentation

Every presentation surface that displays tags—including catalogue, reference-card, hover, mobile ship and rules surfaces—derives the aggregated ship tag list defined in Section 6.3.

- `MAKES SHIPS` precedes `TARGETS SHIPS`.
- Each appears at most once per ship.
- Raw power indexes are not rendered.
- Detailed power text retains its existing timing and wording.
- Presentation never determines legality or timing.

## 14.5 Active rules surfaces

The 14I cutover must make all active phase/timing surfaces truthful immediately:

- Drawing includes its start-of-Drawing prelude;
- Charge Declaration is final;
- no removed phase appears in the timeline;
- tags are classifications rather than phases;
- Simulacrum and Dreadnought retain distinct timings.

Tag visual integration may ship separately in 14J after definition metadata exists.

---

# 15. Bot implications

## 15.1 Retained architecture

Retain:

- server-side bot runner;
- internal `applyIntent` path;
- authoritative fresh state per loop step;
- event-driven execution after writes;
- authored policy;
- safety cap.

## 15.2 Batched Drawing-prelude flow

Before build planning, the bot:

1. uses the same authoritative requester/action projection as a human;
2. obtains every unresolved Carrier action for the active pass;
3. selects one legal choice, including Hold, for each source;
4. sends one `ACTIONS_SUBMIT` batch for the pass;
5. allows the shared helper to advance/pass-complete;
6. repeats for pass 2 if needed;
7. calls `planBotBuildSubmit` only after prelude completion.

Automatic BUG/QUE/ZEN behavior requires no bot policy.

## 15.3 Policy naming

Rename the source-data policy from `shipsThatBuild` to a Drawing-prelude term, for example:

```ts
drawingPrelude?: {
  CAR?: CarrierDrawingPreludePolicy;
}
```

No saved bot-plan migration is required.

## 15.4 Charge policy

Remove `battle.charge_response` from charge policy unions, defaults, authored phase arrays, runner branches and tests. The bot makes one final declaration decision.

## 15.5 Deadlock prevention

Prove the complete batched chain remains below `MAX_BOT_STEPS_PER_REQUEST`. Raising the cap is a fallback supported by evidence, not the primary solution.

Because bots do not run from GET polling, no bot prelude may depend on a later read to resume.

---

# 16. Battle Log and history implications

## 16.1 Storage contract

Retain the separate completed-turn history store and endpoint. Current-turn `battleLogScratch` remains private canonical hot state and is stripped from every state response.

Prelude pass/occurrence metadata may be added to private capture atoms. It must not be exposed through `/game-state`.

## 16.2 Build rows

Prelude creations remain Build events, for example:

- `1 x DEF (CAR)`;
- `1 x FIG (CAR)`;
- `1 x XEN (BUG)`;
- `1 x XEN (QUE)`;
- Zenith output with `ZEN` source.

Hold produces no row.

## 16.3 Ordering contract

Retain authoritative occurrence order and add `drawingPreludePassIndex` or an equivalent stable occurrence key where needed.

Mandatory relative order:

1. public dice interventions;
2. Drawing-prelude pass 1;
3. Drawing-prelude pass 2;
4. revealed normal Drawing build and when-built production under the defined aggregation policy;
5. End-of-Build production.

The formatter may aggregate identical produced rows, but tests must define whether aggregation is per pass or across the full Build phase. Do not claim pass ordering without retained occurrence data.

## 16.4 Battle rows

Replace charge declaration/response wording with Charge Declaration outcomes. Accepted-action capture otherwise remains.

---

# 17. Documentation reconciliation

## 17.1 Repository documents

After behavior settles, update:

- the Phase 13 Ancient planning record with a clear Phase 14 supersession note;
- `contracts/ServerClientTurnPhaseContract.md` with final phase order and requester-local Drawing stages;
- `INDEX.md` with this record and current normative status;
- affected bot, economy, history, mobile and spectator records present in the repository.

Historical records may retain their original context only when clearly marked superseded/non-normative.

## 17.2 Active rules UI

Mandatory phase and timing copy changes belong to 14I so deployed behavior and active rules never disagree. Tag display belongs to 14J.

## 17.3 External planning corpus

Planning documents outside the repository are not silently edited by a repository Documentation Pass. They require separately authorized writable scope. Repository normative documents must still state the final contract without depending on external files.

---

# 18. Recommended pass sequence

| Pass | Name | Type | Primary outcome | Deployability |
|---|---|---|---|---|
| 14A | Normative Planning Record | Documentation | This accepted repository record | Independent |
| 14BC | Definition Metadata and Mirror Parity | Mixed | Tags plus activation timing in both definition copies | Atomic, behavior-neutral |
| 14D | Remove Charge Response | Mixed | One final charge-choice window | Atomic |
| 14E0 | Conflict-Safe Authoritative Persistence | Server | Conditional final writes and retry proof | Independent prerequisite |
| 14E | Drawing-Prelude Foundations | Server | Inactive state, helper, snapshots and projection | Behavior-neutral/inactive |
| 14F | Single-Pass Drawing Prelude | Server | Pass 1 automatic/Carrier behavior and submit gate | Review separately; release with 14I |
| 14G | Chronoswarm and Copied-Builder Behavior | Server | Pass 2 and frozen copied/controlled eligibility | Review separately; release with 14I |
| 14H | Bot and Battle Log Integration | Server | Batched bot input and ordered private capture | Review separately; release with 14I |
| 14I | Drawing Cutover and Active Phase-Surface Reconciliation | Mixed | Remove old phase and activate complete prelude | Atomic with active 14F–14H |
| 14J | Tag Display Integration | Client/UI | Aggregated tag presentation | Independent after 14BC |
| 14K | Online Rules Pages Reconciliation | Client/UI | Update all player facing rules pages | 
| 14L | Normative Documentation Reconciliation | Documentation | Active documents aligned | After 14D/14I |
| 14M | Read-Only Closure Audit | Validation | Final evidence and narrow follow-up register | Read-only |

14F–14H may be implemented and reviewed as separate server slices, but no active deployment may expose them without 14I.

---

# 19. Per-pass implementation briefs

## Phase 14A — Normative Planning Record

- **Pass type:** Documentation Pass
- **Goal:** Create and accept this repository-resident Phase 14 source of truth.
- **Why now:** Implementation needs one reconciled contract and deployment sequence.
- **Authoritative behavior changed:** None.
- **Expected scope:** This file only.
- **Out of scope:** Source, tests, migrations, configuration and behavior changes.
- **Dependencies:** Locked decisions, live-code assessment and architecture documents.
- **Compatibility posture:** Not applicable.
- **Validation:** Internal consistency, pass-name/dependency review, superseded-claim searches and `git diff --check`.
- **Acceptance criteria:** One coherent roadmap exists with no contradictory copied-Queen, tag, persistence or pass definitions.
- **Risks:** Retaining superseded draft language; claiming unperformed PDF verification.
- **Deployability:** Independent documentation.

## Phase 14BC — Definition Metadata and Mirror Parity

- **Pass type:** Mixed Pass
- **Goal:** Add the closed per-power tag schema and explicit activation timing to canonical server definitions and the client mirror without changing mechanics.
- **Why now:** Prelude eligibility and presentation need one stable raw-power metadata contract.
- **Authoritative behavior changed:** Classification only; no resolver consumes tags.
- **Expected scope:** Server/client core power types, both raw definition copies, raw-index helpers, server inspection aggregation, client presentation aggregation, parity fixture/test and relevant definition/model tests. Touch UI/engine adapters only where active propagation or compilation requires it.
- **Out of scope:** Phase removal, prelude behavior, tag styling, client legality, text/AST inference.
- **Dependencies:** 14A.
- **Compatibility posture:** Source metadata only; no persisted-state migration.
- **Tests:** Exact raw membership; activation timing; aggregate order/deduplication; Evolver only Targets; Chronoswarm untagged; server/client parity; Deno check/tests; TypeScript typecheck/build.
- **Acceptance criteria:** Both copies expose identical `{shipDefId, rawPowerIndex, tags, activationTiming}` rows; presentation aggregation returns MAKES SHIPS then TARGETS SHIPS once each; mechanics do not consume tags.
- **Risks:** Raw/flattened index confusion, mirror drift, timing/tag conflation.
- **Deployability:** Atomic behavior-neutral Mixed Pass.

## Phase 14D — Remove Charge Response

- **Pass type:** Mixed Pass
- **Goal:** Remove `battle.charge_response` and make Charge Declaration final across server, client, bots and active UI.
- **Why now:** Independent of Drawing consolidation and reduces one major branch first.
- **Authoritative behavior changed:** Battle progression and ordinary charge opportunity.
- **Expected scope:** Phase sequence/advance/entry, turn state, charge eligibility/resolution/overlays/routes, bot types/plans/runner, client routing/Ready/tabs, action panels, opponent callout, phase/rules surfaces, fixtures and tests. Include stale `chargesDeclared` defaults and active-tree response types.
- **Out of scope:** Drawing prelude, tag display, Ancient redesign, balance changes, broad DTO migration.
- **Dependencies:** 14A; neither 14BC nor 14E0 is required.
- **Compatibility posture:** Old games unsupported; remove rather than migrate fields.
- **Tests:** Direct Declaration-to-EOT; no-input advance; final Hold; simultaneous privacy; one-use; destroyed-source survivability; FAM; EQU; Ancient atomicity/no second Energy; bot single window; no active stale labels; full server/client checks.
- **Acceptance criteria:** No active route, resolver, client, bot or UI path enters Charge Response; all retained Declaration scenarios pass.
- **Risks:** Removing retained snapshot data, privacy regression, partial deployment.
- **Deployability:** One atomic Mixed Pass.

## Phase 14E0 — Conflict-Safe Authoritative Persistence

- **Pass type:** Server Pass
- **Goal:** Make final intent persistence conditional on the revision used for the final authoritative apply.
- **Why now:** Independent per-player prelude mutations increase collision risk, and reload/reapply plus unconditional upsert is not serialization.
- **Authoritative behavior changed:** Persistence conflict handling only; no gameplay rules.
- **Expected scope:** `intent_routes.ts`, `state_revision.ts`, the narrow current KV persistence adapter and route-level concurrency/idempotency tests.
- **Out of scope:** Drawing rules, client/UI, broad persistence redesign, schema, SQL functions, RPC and infrastructure changes.
- **Dependencies:** 14A. It may occur before or after 14BC/14D but must precede active 14F–14I deployment.
- **Compatibility posture:** Existing game JSON remains valid. If the current interface cannot express a conditional write, stop and report; propose a separately approved database/tooling pass.
- **Tests:** Reproduce competing writes from one revision; conditional conflict; bounded reload/reapply; duplicate/no-op handling; exactly one final revision bump; bot-inclusive transaction; game/history consistency.
- **Acceptance criteria:** A stale writer cannot overwrite newer accepted state; retries do not duplicate effects/history; no unapproved infrastructure change is made.
- **Risks:** Unbounded retry, double revision bump, history inconsistency, silently expanding scope.
- **Deployability:** Independent narrow prerequisite.

## Phase 14E — Drawing-Prelude Foundations

- **Pass type:** Server Pass
- **Goal:** Add inactive per-player state, frozen exact source descriptors, pure advancement helpers, Drawing-entry snapshots and common viewer projection.
- **Why now:** Foundations must be tested without changing the live phase sequence.
- **Authoritative behavior changed:** None while inactive.
- **Expected scope:** `GameStateTypes.ts`, a focused Drawing-prelude helper, common viewer sanitizer/requester projector and pure tests.
- **Out of scope:** Removing the old phase, live effects, client routing, bot cutover, definition timing changes.
- **Dependencies:** 14BC and 14E0.
- **Compatibility posture:** New turn scratch is inactive; no migration.
- **Tests:** Per-player initialization; one/two pass count; raw source identity; exact Hold/no-output markers; forced Hold; reset; no readiness mutation; owner/opponent/spectator state/event projection.
- **Acceptance criteria:** Independent players and privacy can be modeled without changing live behavior.
- **Risks:** Duplicate timing truth, broad DTO redesign, accidental activation.
- **Deployability:** Behavior-neutral/inactive only.

## Phase 14F — Single-Pass Drawing Prelude

- **Pass type:** Server Pass
- **Goal:** Implement pass-1 automatic builders, Carrier actions/Hold, completion, submit gate, counters, cues, capture and privacy using the inactive foundations.
- **Why now:** Prove all non-Chronoswarm behavior first.
- **Authoritative behavior changed:** Prepared, not active until 14I.
- **Expected scope:** Prelude helper, extracted resolver pieces, Carrier stage validation, route projection, `handleBuildSubmit` pre-commit gate, existing counters/effects, common state/event sanitizer, activation cues, Battle Log capture and tests.
- **Out of scope:** Pass 2, client routing, bot routing, final phase removal.
- **Dependencies:** 14E.
- **Compatibility posture:** Dormant until cutover.
- **Tests:** BUG/QUE/ZEN idempotency; explicit and forced Carrier Hold; multiple/partial Carrier batches; no-output Zenith once; submit gate; player A submitted while B pending; same-phase build economy; Queen accounting; owner/opponent/spectator privacy; intent/bot-event leakage; one revision-visible mutation.
- **Acceptance criteria:** The helper completes a rules-correct single pass with exact once-only state and downstream fleet behavior.
- **Risks:** Double capture, hidden leak, current-turn builder re-entry, skipped Hold.
- **Deployability:** Review separately; release active only with 14I.

## Phase 14G — Chronoswarm and Copied-Builder Behavior

- **Pass type:** Server Pass
- **Goal:** Add pass 2, roll semantics and controlled/copied source eligibility to the complete helper.
- **Why now:** Chronoswarm depends on single-pass exact-source idempotency.
- **Authoritative behavior changed:** Prepared, not active until 14I.
- **Expected scope:** Prelude helper, existing Chronoswarm count/roll integration, Simulacrum direct-materialisation helpers and focused tests.
- **Out of scope:** New balance, repeating non-prelude triggers, changing Simulacrum copy targets.
- **Dependencies:** 14F.
- **Compatibility posture:** None.
- **Tests:** Exactly two passes; pass 1/main roll; pass 2/first Chronoswarm roll; CAR/BUG/QUE/recurring ZEN twice; excluded timings never repeat; foreign control; copied CAR/BUG/ZEN current behavior; Simulacrum never offers or materialises Queen; independent interleaving.
- **Acceptance criteria:** Complete rules-correct prelude in which Queen remains excluded from Simulacrum copy targets and direct-materialisation exceptions.
- **Risks:** Live-fleet re-entry, accidental non-prelude repetition, treating Upgraded Queen as copyable.
- **Deployability:** Review separately; release active only with 14I.

## Phase 14H — Bot and Battle Log Integration

- **Pass type:** Server Pass
- **Goal:** Make bots and private history capture compatible with the complete prelude.
- **Why now:** Both must be ready before the old phase is removed.
- **Authoritative behavior changed:** None until 14I.
- **Expected scope:** Bot types/runner/plans, shared requester action projection, Battle Log capture atoms/formatter and tests.
- **Out of scope:** New bot strategy, client UI, history endpoint redesign, new public log content.
- **Dependencies:** 14F–14G.
- **Compatibility posture:** Rename source plan fields directly; no saved-plan migration.
- **Tests:** One batch per pass; explicit Hold; no early build submit; worst-case chain under cap; no GET dependency; pass occurrence/order; aggregation contract; no duplicate capture.
- **Acceptance criteria:** Bots settle through both passes and history can reproduce documented order without leaking scratch.
- **Risks:** Dual path, cap exhaustion, cross-pass aggregation ambiguity.
- **Deployability:** Review separately; release active only with 14I.

## Phase 14I — Drawing Cutover and Active Phase-Surface Reconciliation

**Implementation status:** Phase 14I-S and Phase 14I-C are complete. The combined Phase 14I cutover is complete and the server and client cutovers must deploy together. The next implementation pass is Phase 14J. Broader Rules and player-facing reconciliation remains deferred to Phase 14K or later design passes.

- **Pass type:** Mixed Pass
- **Goal:** Remove `build.ships_that_build`, activate the complete prelude, route desktop/mobile through requester stages and make active phase/timing surfaces truthful.
- **Why now:** Persistence, state, mechanics, Chronoswarm, bots, history and projection are complete.
- **Authoritative behavior changed:** Final Build sequence and start-of-Drawing timing.
- **Expected scope:** Phase sequence/advance/entry; removal of global pass fields/helpers/events; prelude activation; Carrier action path; client stage/pass key, Hold batch, Ready/build gating and panel reuse; mobile routing; viewer state/event projection; phase labels; Phase Breakdown; Turn Timings; Core Rules; Species Rules; dev fixtures; complete tests.
- **Out of scope:** Final tag styling, unrelated UI redesign, new rules, migration.
- **Dependencies:** 14BC, 14E0 and 14E–14H.
- **Compatibility posture:** Old games discarded; no phase aliases.
- **Tests:** No active old phase; independent progression; one-shot routing; explicit/forced Hold; same-phase economy; state-head refresh; owner/opponent/spectator privacy; public Simulacrum; bot/human interleaving; history ordering; desktop/mobile checks.
- **Acceptance criteria:** Games never enter Ships That Build; all applicable behavior occurs inside Drawing; no active phase/rules surface describes the removed phase.
- **Risks:** Partial deployment, lost update, privacy leak, panel loop, bot wedge.
- **Deployability:** Atomic Mixed release with active 14F–14H.

## Phase 14J — Tag Display Integration

- **Pass type:** Client/UI Pass
- **Goal:** Display aggregated, deduplicated mirrored tags through existing shared presentation models.
- **Why now:** Definition metadata is stable after 14BC and is not coupled to phase cutover.
- **Authoritative behavior changed:** None.
- **Expected scope:** `ShipCardModel`, `ShipRulesAdapter`, catalogue/reference/hover cards, mobile ship/Solar modals where applicable, Species Rules tag presentation, fixed labels and galleries.
- **Out of scope:** Phase/rules corrections owned by 14I, server mechanics, new tag types, large styling redesign.
- **Dependencies:** 14BC only.
- **Compatibility posture:** None.
- **Tests:** MAKES SHIPS then TARGETS SHIPS; each once per ship; exact membership; no raw indexes; detailed timing text preserved; shared desktop/mobile data; typecheck/build.
- **Acceptance criteria:** Intended surfaces derive presentation tags from mirrored per-power data without becoming authoritative.
- **Risks:** Duplicate badges, hiding power timing, premature style specification.
- **Deployability:** Independent after 14BC; scheduled after 14I in the Phase 14 implementation order.

## Phase 14K — Online Rules Pages Reconciliation

Pass definition
Pass type: Client/UI Pass
Goal: Reconcile the complete in-app Rules section with the finalized Phase 14 rules and the latest approved rules PDF, while preserving deliberate online-specific wording and interaction explanations.
Dependencies: 14D, 14I and 14J.
Authoritative behavior changed: None.
Primary scope:
RulesPanel.tsx
CoreRulesPanel.tsx
TurnTimingsPanel.tsx
SpeciesRulesPanel.tsx
ShipRulesAdapter.tsx
shared tag presentation used by the Rules pages
directly related tests or development fixtures

The existing 14I requirement should remain: active phase surfaces must become truthful immediately at cutover. But 14I should only make the necessary surgical corrections. 14K would then perform the proper page-by-page editorial and presentation audit.

Source precedence for the pass

I would lock this explicitly:

Final locked Phase 14 decisions
Latest approved rules PDF
Explicitly accepted online-specific wording or UX adaptations
Current online Rules pages as implementation evidence only

That avoids the mistake of mechanically copying the PDF into the website.

The PDF should be the content baseline, but differences may be correct online because the website needs to explain things such as:

buttons and Ready behavior;
hidden simultaneous submissions;
automatic or forced Hold behavior;
online-only selection and targeting interactions;
server-managed timing that paper players perform manually;
mobile or interface-specific explanations.

Those should remain when they clarify the digital implementation without changing the underlying rule.

Required audit categories

The pass should classify each discrepancy rather than automatically editing it:

Outdated online wording
Update it to the PDF and Phase 14 rules.

Deliberate online adaptation
Preserve it, but verify that it describes the same underlying rule accurately.

Actual rules/data discrepancy
Do not hide it by changing the page. Raise it as a separate server/definition or mixed pass.

That last category matters because the species pages consume mirrored ship-definition text. A PDF disagreement may indicate:

stale Rules-page copy;
a legitimate online wording difference;
or an actual canonical definition problem.

Codex should not assume which one it is.

Likely content areas

The new pass should cover at least:

final Build and Battle sequence;
Drawing prelude and Carrier behavior;
removal of Charge Response;
finality of Charge Declaration;
declared charges surviving source destruction;
ordinary Automatic survival distinction;
Chronoswarm’s two Drawing-prelude passes;
Simulacrum and Dreadnought retaining different timings;
definitions and presentation of MAKES SHIPS and TARGETS SHIPS;
every tagged ship’s species-page presentation;
removal of old “Ships That Build” phase classification;
all cross-links between Core Rules, Species Rules and Turn Timings.

The Phase 14 plan already requires tags on rules surfaces and retains detailed timing wording, but that is a presentation contract, not a full editorial reconciliation.

## Phase 14L — Normative Documentation Reconciliation

- **Pass type:** Documentation Pass
- **Goal:** Remove normative contradictions from active repository documents.
- **Why now:** Final behavior and terminology must settle first.
- **Authoritative behavior changed:** None.
- **Expected scope:** Phase 13 supersession, turn/phase contract, documentation index and affected in-repository bot/economy/history/mobile/spectator planning records.
- **Out of scope:** Source behavior and external documents without authorized scope.
- **Dependencies:** 14D and 14I; tag references additionally depend on 14BC/14J as applicable.
- **Compatibility posture:** Documentation supersession only.
- **Validation:** Contradiction search against this record and active rules surfaces.
- **Acceptance criteria:** No active normative repository document promises either removed phase or a second charge window.
- **Risks:** Rewriting history without supersession notes; silently editing outside scope.
- **Deployability:** Independent documentation after behavior settles.

## Phase 14M — Read-Only Closure Audit

- **Pass type:** Read-only Validation / Assessment Pass
- **Goal:** Produce final regression and stale-contract evidence and assign any remaining defects to narrow follow-ups.
- **Why now:** Cross-layer failures are visible after every deployable slice settles.
- **Authoritative behavior changed:** None.
- **Expected scope:** Existing validation commands, active-reference searches, legacy/dormant classification, documentation review and user-run browser results.
- **Out of scope:** Source corrections, new tests, features, balance changes and broad cleanup.
- **Dependencies:** 14BC–14K.
- **Compatibility posture:** Not applicable.
- **Validation:** Full server checks/tests, client typecheck/build, stale-contract searches, privacy/bot/history evidence and reported browser matrix.
- **Acceptance criteria:** Section 26 has evidence for every criterion; each defect is assigned to a narrow Server, Client/UI, Documentation, Tooling or explicitly approved Mixed follow-up.
- **Risks:** Treating search hits as active code; expanding closure into a refactor.
- **Deployability:** Independent read-only audit.

---

# 20. Test strategy

## 20.1 Definition metadata

- Exact raw-power tag membership.
- Closed tag union rejects free-form values.
- Exact activation timing for every tagged Makes Ships power.
- Server/client parity by raw index.
- Aggregate order is MAKES SHIPS then TARGETS SHIPS.
- Duplicate per-power tags yield one ship-level display tag.
- No raw index appears in presentation.
- Evolver only Targets; Chronoswarm untagged.

## 20.2 Drawing consolidation

### Phase contract

- Final Build order only.
- KNO/Cube stages remain internal.
- No global Ships That Build loop/event/readiness.

### Prelude state and idempotency

- Per-player initialization/reset.
- Frozen exact source descriptors.
- One/two pass count.
- Every automatic/no-output source marked exactly once.
- Rejection/conflict retry produces no duplicate effects/cues/history.

### Carrier

- Defender/Fighter affordability.
- Explicit Hold action persists resolution.
- Hold-only Carrier is forced Hold.
- Multiple Carriers batch and partial/retry cases.
- Same Carrier may act once in each Chronoswarm pass.

### Drawing submission and economy

- Incomplete requester rejected before commit storage.
- Player A may submit while B remains in prelude.
- Build resolution still waits for both.
- Prelude ships participate in upgrades, components, quantity and charge restrictions.

### Chronoswarm and copied/controlled sources

- Main and first Chronoswarm rolls.
- Only CAR/BUG/QUE/recurring ZEN repeat.
- Controlled foreign sources follow controller fleet.
- Copied CAR/BUG/ZEN preserve direct-materialisation behavior.
- Queen is not a Simulacrum copy target and never appears in direct-materialisation exceptions.

### Visibility

- Owner live fleet.
- Opponent and spectator entry snapshots.
- Public materialised Simulacrum retained.
- Canonical prelude maps and Battle Log scratch removed.
- Private state, events and activation cues filtered in GET and intent responses.

### Bot/history

- One Carrier batch per pass.
- Worst-case bot chain under cap.
- No GET-resume dependency.
- Pass occurrence metadata and formatter ordering.

## 20.3 Charge Response removal

- Final Battle order.
- Direct Declaration-to-EOT.
- Declaration no-input advance.
- Final Hold and one-use behavior.
- Simultaneous privacy.
- Declared destroyed source resolves.
- FAM snapshot and EQU reservation behavior.
- Ancient declaration remains atomic with no second Energy window.
- Bot, mobile, spectator, labels, rules and fixtures contain no active response path.

## 20.4 Persistence prerequisite

- Demonstrate the preexisting collision.
- Conditional write rejects a stale base revision.
- Bounded reload/reapply succeeds or rejects deterministically.
- Accepted transaction bumps once.
- Rejection/true no-op duplicate does not persist or bump.
- Turn-finalization history remains consistent.
- Unsupported interface stops without schema/RPC/infrastructure mutation.

## 20.5 Regression matrix

Cover:

- human, Xenite, Centaur and Ancient games;
- human/human, human/bot and bot/bot where supported;
- zero/one/multiple Carrier;
- no Chronoswarm and Chronoswarm pass 2;
- copied CAR/BUG/ZEN and controlled foreign Queen;
- Simulacrum attempted Queen copy rejection/nonavailability;
- desktop, mobile and spectator hydration;
- mid-Drawing polling/reconnect;
- battle history and download;
- new game construction and turn reset.

## 20.6 Validation commands

Use per pass as applicable:

```text
deno check src/supabase/functions/server/index.tsx
deno test --allow-env src/supabase/functions/server/tests/
npm run typecheck
npm run build
```

Browser/manual validation occurs only when a later pass explicitly requests it and must be reported separately from automated evidence.

---

# 21. Risks and review gates

## 21.1 Hidden fleet leakage

- **Risk:** Canonical prelude ships leak during a hidden phase.
- **Gate:** Common state/event viewer projection tests for owner, opponent and spectator before cutover.

## 21.2 Prelude/readiness conflation

- **Risk:** Prelude completion advances Drawing or appears as final Ready.
- **Gate:** Separate state and tests proving only `BUILD_SUBMIT` establishes Drawing submission.

## 21.3 Lost update or duplicate automatic work

- **Risk:** Exact markers are overwritten by competing unconditional writes.
- **Gate:** 14E0 conditional-write proof plus exact source/pass markers.

## 21.4 Current-turn source re-entry

- **Risk:** A builder made during normal Drawing joins the same turn’s prelude.
- **Gate:** Frozen source descriptors captured once at Drawing entry.

## 21.5 Timing/tag conflation

- **Risk:** Every Makes Ships power is routed to Drawing entry.
- **Gate:** Explicit activation timing and tests for DRE, SSIM and all three Zenith powers.

## 21.6 Charge survivability regression

- **Risk:** Response cleanup deletes Declaration snapshots needed after source destruction.
- **Gate:** Retention register and targeted FAM/EQU/live-or-void tests.

## 21.7 Ancient atomicity regression

- **Risk:** Simplification splits or reorders Ancient declaration.
- **Gate:** Existing atomic declaration tests updated only for the removed second window.

## 21.8 Client panel reopen loop

- **Risk:** Stable polling repeatedly opens Actions or carries pass-1 choices into pass 2.
- **Gate:** Requester stage/pass-aware instance key and one-shot routing tests.

## 21.9 Bot cap exhaustion

- **Risk:** Multiple Carriers/pass 2 exhaust the step cap.
- **Gate:** One batch per pass and measured worst-case chain.

## 21.10 Definition mirror drift

- **Risk:** Tags/timing differ across server and client.
- **Gate:** Atomic 14BC and deterministic raw-index parity.

## 21.11 Queen copy regression

- **Risk:** A generic Makes Ships or copied-builder query incorrectly treats Queen as a Simulacrum Basic Ship copy.
- **Gate:** Definition/copy eligibility tests proving Queen is Upgraded, absent from Simulacrum copy targets and absent from direct-materialisation exceptions.

## 21.12 Scope expansion

- **Risk:** Phase simplification becomes a workflow, DTO, database or legacy modernization project.
- **Gate:** Narrow pass boundaries, stop-and-report in 14E0 and ownership-specific follow-ups from 14L.

---

# 22. Deferred presentation decisions

No gameplay or tag-semantics designer decision remains unresolved.

The following presentation details are intentionally deferred and do not block 14BC or the semantic portion of 14J:

- badge layout;
- typography;
- separators;
- exact desktop placement;
- exact mobile wrapping/responsive styling.

Any later styling decision must preserve one deduplicated ship-level list in MAKES SHIPS then TARGETS SHIPS order and must not alter timing or authority.

---

# 23. Expected deletion/replacement list

## 23.1 Phase keys and labels

Delete:

- `build.ships_that_build`;
- `battle.charge_response`;
- equivalent client enum/type members;
- active phase labels/timeline rows for both;
- wording that presents Makes Ships as a phase.

## 23.2 Response-only state and behavior

Delete:

- `anyChargesDeclared`;
- `anyChargesSpentInDeclaration`;
- `chargeDeclarationEligibleByPlayerId`;
- stale `chargesDeclared` new-game defaults;
- response timing union members;
- response eligibility/gating/action branches;
- response bot policy and client routing;
- opponent response callout and fixtures.

## 23.3 Global Ships That Build state

Delete or replace:

- `shipsThatBuildPassIndex`;
- `shipsThatBuildPassUsageByInstanceId`;
- global pass readiness;
- `SHIPS_THAT_BUILD_PASS_ADVANCED`;
- pass/participation/usage helpers tied to the global phase;
- global `resolveShipsThatBuild` dispatch after reusable internals are extracted.

Replace with per-player exact source-power/pass state.

## 23.4 UI and active-tree cleanup

Delete or replace:

- old action-panel IDs/copy;
- Charge Response timeline/rules rows;
- response gallery fixtures;
- stale Centaur response tab state;
- early-Drawing TODOs tied to the old phase;
- active-tree response types/comments no longer reachable from final behavior.

## 23.5 Dead scaffolding and historical code

Audit `BattleWindow`, battle commit/reveal helpers and similar scaffolding by active call sites before deletion. Do not conflate unused battle-commit scaffolding with ordinary Charge Response without evidence.

Explicit legacy trees and dormant active-tree files may remain when clearly classified as non-active/non-normative. They are not implementation targets merely because text search finds old names.

## 23.6 Tests and documents

Rewrite/remove active assertions and fixtures requiring removed phases. Preserve historical records only with clear supersession posture.

---

# 24. Mechanisms retained and reused

Retain and extend:

- `PHASE_SEQUENCE` and derived server `PhaseKey`;
- KNO/Cube internal dice stages;
- `onEnterPhase` for phase-entry orchestration;
- `advancePhase` for canonical progression;
- `BUILD_SUBMIT` for final Drawing submission;
- Drawing commit/reveal storage and two-player resolution boundary;
- canonical current fleet as build working base;
- drawing creation and immediate-consequence helpers;
- `applyEffects`;
- creation counters and Queen XEN accounting;
- Chronoswarm count/roll data;
- Simulacrum queued materialisation and CAR/BUG/ZEN direct-materialisation identity;
- Dreadnought End-of-Build resolver;
- charge declaration source/fleet/visibility snapshots;
- live-or-void declared-source resolution;
- one-use, FAM, EQU, Solar and Ancient declaration mechanisms;
- client runtime networking and shared desktop/mobile view model;
- server-side bot runner and internal intent path;
- private canonical `battleLogScratch` plus separate completed history;
- state revision as the public change fingerprint, extended by 14E0 into a conditional-write precondition at persistence;
- viewer/requester projection, narrowed and shared across state response paths.

Do not retain obsolete response/global-pass fields solely for compatibility.

---

# 25. Dependency diagram

```text
14A Normative Planning Record
 |
 +--> 14BC Definition Metadata and Mirror Parity -----> 14J Tag Display Integration
 |
 +--> 14D Remove Charge Response
 |
 +--> 14E0 Conflict-Safe Authoritative Persistence
          |
14BC -----+--> 14E Drawing-Prelude Foundations
                    |
                    v
              14F Single-Pass Drawing Prelude
                    |
                    v
              14G Chronoswarm and Copied-Builder Behavior
                    |
                    v
              14H Bot and Battle Log Integration
                    |
                    v
              14I Drawing Cutover and Active Phase-Surface Reconciliation

14D + 14I --------> 14K Normative Documentation Reconciliation

14BC through 14K -> 14L Read-Only Closure Audit
```

14F–14H are reviewable server slices, not independently deployable active behavior. Their active portions release atomically with 14I.

---

# 26. Completion criteria

## Phase contract

- Final Build and Battle sequences match Section 5.
- Removed phase keys do not appear in active future routing.
- KNO/Cube remain internal stages.

## Charge flow

- Charge Declaration is final.
- No response/last-chance/second Ancient Energy window exists.
- Privacy, one-use, survivability, FAM, EQU, Solar and Ancient behavior remain.

## Drawing prelude

- Per-player exact source/pass state is authoritative.
- CAR explicit/forced Hold works.
- BUG/QUE/recurring ZEN automatic behavior is once-only.
- Chronoswarm repeats only the locked powers.
- Queen is never treated as a Simulacrum copy.
- One player may submit while the opponent remains in prelude.
- Same-Drawing economy sees prelude ships.
- GET and intent state/events preserve privacy.
- Conditional final persistence prevents stale overwrite.

## Tags

- Exactly two canonical per-power tags exist.
- Exact locked raw-power membership is present in both copies.
- Activation timing remains separate.
- Presentation aggregates once per ship in locked order.
- No raw power indexes are displayed.
- No mechanic infers or consumes tags as authority.

## Architecture

- Server remains authoritative.
- Networking remains in client runtime.
- Desktop/mobile share gameplay state.
- Bots use the internal intent path and remain within the safety cap.
- Current-turn Battle Log scratch remains private; completed history remains separate.

## Cleanup and documentation

- Active types, fixtures, rules copy and tests no longer require removed phases.
- Stale `chargesDeclared` defaults are gone.
- Historical/dormant code is classified rather than casually rewritten.
- Normative repository documents carry explicit Phase 14 supersession.
- Phase 14L reports evidence and opens only narrow ownership-specific follow-ups.

---

# 27. Historical first implementation recommendation

The original accepted roadmap began with:

## Phase 14BC — Definition Metadata and Mirror Parity

Phase 14BC and the other passes through the combined Phase 14I cutover are complete. Phase 14J is the next implementation pass, as defined by the [Phase 14 Rules v1.63 Alignment Addendum](<Phase 14 Rules v1.63 Alignment Addendum.md>). The 14I server and client cutovers remain an atomic deployment unit. The rationale below is retained as completed-pass history.

It was selected as the safest first implementation pass because it:

- changes no gameplay behavior;
- establishes stable raw-power identity;
- adds tags and activation timing together;
- locks server/client parity before either gameplay or presentation consumes the data;
- can be validated without deploying either phase cutover.

In the original sequence, Phase 14D could follow independently, and Phase 14E0 had to complete before active Drawing-prelude deployment without blocking 14BC or 14D.
