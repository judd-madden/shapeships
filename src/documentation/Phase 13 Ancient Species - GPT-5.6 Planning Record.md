# Phase 13 Ancient Species

## GPT-5.6 Planning Record

> **Status:** Planning only. Ancient is not yet a playable production species.
>
> This document is subject to revision as individual rules and implementation
> slices are reviewed. Partial Ancient definitions, graphics, and UI scaffolding
> already present in the repository do not constitute implemented gameplay.

## 1. Status

Phase 13 is a planned, multi-pass implementation program for Shapeships' fourth
species, Ancient. No broad Ancient implementation pass is authorized by this
document.

- **Planning only.**
- **No Phase 13 production implementation has begun under this roadmap.**
- **All rules and sequencing remain subject to revision before their dependent
  implementation slices.**

Partial Ancient scaffolding that predates this roadmap is inventoried below and
must not be mistaken for playable functionality.

The current working rules come from:

- the **Ancient Species 1.5 Test** rules PDF supplied by the game designer on
  18 July 2026;
- the accompanying Phase 13 design and engineering notes supplied in the same
  planning thread;
- the repository architecture and ownership contracts.

Where those sources are incomplete or disagree, this document records the
question instead of inventing a rule. A question only needs to be resolved before
the implementation slice that depends on it; unrelated slices may proceed after
their own decision gates are approved.

Once approved, this document is normative for Phase 13 scope, sequencing, and
architectural boundaries. It is not a substitute for the final human-approved
game rules. The architecture contracts remain authoritative if this planning
record conflicts with them:

- [Canonical handoff](contracts/canonical-handoff.md)
- [Code ownership map](contracts/code-ownership-map.md)
- [Server/client turn-phase contract](contracts/ServerClientTurnPhaseContract.md)
- [Codex pass template](workflows/CodexPassTemplate.md)

## 2. Purpose

Ancient cannot be introduced safely as one feature patch. It adds a turn-scoped
three-colour resource, repeated actions within Charge Declaration, automatic
fallback powers, new targeting and copying behavior, a public Solar Power ledger,
and species-specific presentation across desktop and mobile.

The work also crosses several guarded ownership layers:

- authoritative rule and phase resolution on the server;
- requester-safe projections and client-runtime orchestration;
- mirrored player-facing definition data;
- catalogue, Fleet Area, targeting, stats, graphics, and animation presentation.

Treating those concerns as one pass would make rule review, regression isolation,
and rollback unnecessarily difficult. Phase 13 therefore uses small, reviewable
slices with explicit dependencies and validation gates. Existing Human, Xenite,
Centaur, core phase, spectator, and computer-opponent behavior must remain stable
throughout the program.

## 3. AI-Assisted Development Workflow

The human game designer owns product intent, selects the current rules, resolves
ambiguities, approves each pass, reviews the resulting code, and performs browser
and gameplay testing.

GPT-5.6 supports the design and engineering process by:

- analysing rule interactions and edge cases;
- separating authoritative, runtime, and presentation responsibilities;
- identifying state, timing, privacy, migration, and regression risks;
- maintaining this implementation sequence;
- converting approved slices into detailed Codex-ready pass briefs;
- reviewing Codex plans and results before the next slice begins.

Codex is the repository-attached inspection and implementation agent. Once a
slice is approved, Codex reads the owning seams, proposes a concrete file plan,
edits only the authorized files, and runs validation appropriate to that pass.

This workflow does not imply that GPT-5.6 authored the existing Shapeships
codebase, that Ancient is currently playable, or that every Ancient rule is
final. Human review, testing, and approval remain required.

## 4. Current Repository Baseline

The repository already contains partial Ancient preparation:

- server-canonical and client-mirrored Ancient ShipDefinitions blocks;
- rules-page rendering for Ancient definitions;
- basic Ancient graphics and a static Ancient catalogue placeholder;
- Ancient action-panel registry entries and provisional Fleet Area rows;
- an Ancient species-selection card whose confirmation path is deliberately
  blocked by the client;
- older client-side energy and Solar Power types that do not represent a complete
  authoritative implementation.

The authoritative server state does not yet define a complete coloured-energy
ledger or Solar Power cast lifecycle. Some current route and phase code contains
scalar-energy or future-energy scaffolding. These seams must be inspected and
either replaced, normalized, or deliberately reused during the relevant passes;
they must not be treated as proven contracts merely because they exist.

The shared phase sequence still includes `battle.charge_response`. Removing that
phase would affect every species and is not an implicit part of Ancient work.

## 5. Current Rules Baseline

### 5.1 Working decisions

The following rules are the current product baseline, subject to later balance
changes after gameplay testing.

- Energy is unique to Ancient and has three colours: red, green, and blue.
- Energy is used to cast Solar Powers and cannot be saved across turns.
- Multiple Solar Powers may be cast in a turn when the Ancient player can afford
  them.
- Solar Powers occur during Battle Phase > Charge Declaration.
- A non-Ancient player cannot cast Solar Powers merely because they acquired an
  Ancient ship that can generate energy.
- Server state and resolution remain authoritative for energy, affordability,
  power availability, payment, targeting, ordering, and outcomes.

### 5.2 Basic Ships

| ID | Ship | Cost | Current rules baseline | Known implementation concern |
|---|---|---:|---|---|
| `PLU` | Pluto Core | 3 | Gain 1 green energy each Battle Phase. Cannot be destroyed or stolen. | Energy timing and shared destroy/steal filters must be authoritative. |
| `MER` | Mercury Core | 4 | Gain 1 red energy each Battle Phase. Cannot be destroyed or stolen. | Same Core family behavior as PLU, with a different colour. |
| `QUA` | Quantum Mystic | 5 | On build, choose a permanent number from 1 to 6. When the dice match, gain 2 blue energy and heal 5, including on the build turn. Maximum 6. | Reuse Frigate-style selection and stacking while keeping QUA memory distinct. |
| `SPI` | Spiral | 6 | The PDF states: heal 1 for each Spiral; increase maximum health by 5; once only on the turn the third Spiral is built, destroy one basic enemy ship. Maximum 3. | The supplied engineering notes describe a different three-tier rule set; see Decision A-01. |
| `NEP` | Neptune Core | 7 | Gain 1 blue energy each Battle Phase. Cannot be destroyed or stolen. Maximum 6. | Replaces the current provisional `URA` / Uranus identity throughout definitions and presentation. |
| `SOL` | Solar Grid | 8 | Four charges. Spend a charge to gain 1 energy of each colour for this Battle Phase. After all charges are used, heal 2 each turn. | SOL must precede Solar Power selection and update availability immediately. |
| `CUB` | Cube | 9 | Once per Cube per turn, repeat the first green, red, or blue Solar Power cast that turn. | Ordering, multiple Cubes, autocast-only turns, and SSIM repetition need explicit handling. |

The Phase 13 notes additionally require energy from Cores built during the current
Drawing phase to be available in that turn's Battle Phase.

### 5.3 Solar Powers

| ID | Power | Energy cost | Current rules baseline | Known implementation concern |
|---|---|---|---|---|
| `SLIF` | Life | 1 green | Heal 1. | Automatic-only behavior comes from the Phase 13 notes, not the PDF. |
| `SAST` | Asteroid | 1 red | Deal 1 damage. | Automatic-only behavior comes from the Phase 13 notes, not the PDF. |
| `SSTA` | Star Birth | 3 green | Heal equal to dice + 3. | Display should show the current dynamic amount. |
| `SSUP` | Supernova | 3 red | Deal damage equal to dice + 3. | Display should show the current dynamic amount. |
| `SCON` | Convert | 1 blue | Generate one additional line for the next Build Phase. Convert is the only way to turn energy back into lines; lines may be saved. | Requires a turn-crossing authoritative line grant and clear ledger aggregation. |
| `SSIM` | Simulacrum | X blue | Copy a basic enemy ship, where X is its line cost. Each ship can be copied once per turn; charge state is copied from the start of the Battle Phase; copied ships can be upgraded; Cube makes an extra copy of the same target; Cube cannot be copied. | Target snapshot, queued creation timing, foreign state, privacy, and four matchup icons. |
| `SSIP` | Siphon | Equal red and green, minimum 2 of each | Heal and deal damage according to the amount spent. The PDF table shows 2→3, 3→6, 4→10, 5→15, 6→21, 7→28, 8→36, and 9→45. | The displayed `X!` continuation and the supplied “factorial” note do not match the triangular sequence; see Decision A-03. |
| `SBLA` | Black Hole | 4 red, 4 green, 4 blue | Destroy two opponent basic ships, then deal 1 damage for each Core owned. | Paired targeting, Core definition, and simultaneous destruction behavior must be locked. |
| `SVOR` | Vortex | 2 red, 2 green, 2 blue | Deal 2 damage for each type of ship owned. | The authoritative type-count snapshot timing must be defined. |

The supplied Phase 13 notes add this automatic-cast rule:

- `SAST`, `SLIF`, and `SCON` are the only one-energy powers.
- They are never manually cast.
- When no non-one-energy Solar Power remains available to the player, remaining
  one-energy powers are cast automatically from the available energy.
- If the player chooses not to cast an available larger power, the remaining
  energy is still resolved through the automatic one-energy powers.

This rule is a current planning requirement but is absent from the supplied 1.5
Test PDF, so it remains explicitly reviewable before its server pass.

## 6. Open Decision Register

Unresolved questions do not block the whole phase. Each item blocks only the
slice whose acceptance criteria depend on it.

### A-01 — Spiral rule source

The PDF gives Spiral healing, maximum-health, and third-Spiral destruction
effects. The supplied engineering notes instead describe:

1. a first-tier maximum-health effect;
2. a second-tier one-line discount on Ancient non-Core ships;
3. a third-tier First Strike destroy action.

The current rule text, tier ordering, max-health behavior when a Spiral is lost,
and any build discount must be approved before the Spiral definition and
functional passes.

### A-02 — Automatic one-energy lifecycle

Confirm whether autocast eligibility is evaluated after each manual cast, only
after an explicit hold, or both. Define deterministic colour ordering when
several one-energy powers can be cast and whether the display presents individual
casts or an aggregated record.

### A-03 — Siphon formula and upper bound

The PDF values form a triangular sequence while its continuation is labelled
`X!`, and the engineering note calls the values factorial. Approve the actual
formula, the maximum selectable amount, and the UI range before SSIP work.

### A-04 — Charge Response posture

Keep `battle.charge_response` unchanged during initial Ancient implementation.
If testing later supports removing it, use a separate explicit Mixed Pass with
cross-species phase, clock, action, log, spectator, and client routing validation.

### A-05 — Energy preparation timing

Define the exact authoritative boundary for resetting energy, counting live
Cores, applying same-turn QUA generation, and completing SOL choices. The likely
seam is Battle Reveal followed by an Ancient preparation step inside Charge
Declaration, but the server phase contract must decide.

### A-06 — Hidden information and ordering

Decide whether each manual Solar cast becomes public immediately or whether
pending powers and targets remain requester-only until submission or resolution.
Cube still requires a deterministic private ordered history even if public
reveal is delayed.

### A-07 — Simulacrum creation contract

Confirm that SSIM queues automatic creation during the following Drawing phase,
which state is copied besides charge count, what happens if the target leaves play,
and how reload, rematch, and state migration preserve the pending copy.

### A-08 — Cross-species build modifiers

If Spiral's proposed discount is retained, decide whether it affects any
SSIM-created foreign ships or only native `QUA`, `SPI`, `SOL`, and `CUB` builds.

### A-09 — Cube edge cases

Define multiple-Cube ordering, whether every Cube repeats the same first eligible
cast, how an autocast-only turn selects a repeat, whether Cube-generated casts can
trigger another Cube, and the exact SSIM same-target behavior.

### A-10 — Black Hole destruction

Approve the target restrictions, whether two distinct targets are mandatory,
the behavior when fewer than two targets exist, and how charge/once-only effects
survive simultaneous destruction.

### A-11 — Vortex type counting

Define “type” consistently with the existing TAC/FAM family and decide whether
the count is captured at cast time or evaluated later after other Charge
Declaration actions have changed fleets.

### A-12 — Public display semantics

Approve which energy totals, cast records, SSIM targets, and pending outcomes are
public to the opponent and spectators at each point in Charge Declaration.

## 7. Architectural Constraints

### 7.1 Preserve server authority

The server owns:

- energy generation, reset, availability, payment, and spending order;
- Solar Power legality and automatic-cast decisions;
- source and target eligibility;
- Cube repetition and SSIM creation;
- damage, healing, destruction, maximum health, and line grants;
- canonical cast records and phase progression.

The client may display affordability and previews derived from server projections,
but a stale or incorrect preview cannot make a cast legal.

### 7.2 Keep networking in the client runtime

Display components render view models and emit callbacks. They must not call the
server directly, own retry/state-revision behavior, or reconstruct authoritative
rules.

### 7.3 Keep display presentation-only

The catalogue, Fleet Area, energy display, target glow, hover cards, stats, and
animations consume projected state. They do not independently decide energy,
autocast, Cube ordering, or target legality.

### 7.4 Isolate Ancient systems until reuse is proven

Ancient-specific server behavior should normally live under a focused seam such
as `src/supabase/functions/server/engine/ancient/**`. A generic `/energy/` system
should only be introduced if another real consumer establishes a reusable
contract. Shared targeting, effects, building, and phase helpers remain shared
when their current contracts genuinely apply.

### 7.5 Preserve deterministic resolution

Identical authoritative state and submitted intents must produce identical
energy payments, cast order, automatic powers, Cube repeats, targets, queued
effects, and pending builds. Iteration order must not depend on object insertion,
client timing, or display order.

### 7.6 Do not regress existing species

Human, Xenite, and Centaur rules are unchanged by default. Shared helper changes
require explicit regression cases. Ancient-specific exceptions should stay near
the Ancient-owned seam unless a cross-species rule is deliberately approved.

## 8. Proposed System Decomposition

### 8.1 Authoritative Ancient server seam

Likely responsibilities include:

- a normalized red/green/blue energy value;
- energy generation and payment helpers;
- an ordered Solar cast record;
- manual availability and automatic one-energy resolution;
- SOL preparation and Cube repeat state;
- SSIM target snapshots and pending creation;
- Ancient-specific rule predicates.

This is a responsibility boundary, not a final file list. Each Codex pass must
inspect current owners and propose exact files before editing.

### 8.2 Existing server integrations

Ancient work will likely integrate with:

- server state types and turn-scoped state normalization;
- phase entry and phase input-gating;
- `availableActions` projection and authoritative action resolution;
- shared destroy/steal targeting;
- build submission and foreign-ship legality;
- queued effect and end-of-turn resolution;
- battle log capture and game-history finalization.

Ancient helpers should supply data and predicates to these systems rather than
forking complete copies of them.

### 8.3 State and timing concepts

Likely authoritative concepts are:

- **Energy pool:** current available red, green, and blue energy for an Ancient
  player during the current Battle Phase.
- **Generation record:** optional source-aware detail for debugging, UI, and
  deterministic recomputation without making presentation authoritative.
- **SOL preparation status:** records whether mandatory use/hold choices have
  completed before Solar selection.
- **Ordered cast record:** one record per manual, automatic, or Cube-generated
  cast, including power, cost, order, source mode, and target references.
- **Private pending selections:** requester-owned choices that must not leak to
  opponents or spectators before the approved reveal boundary.
- **Public Solar ledger:** revealed casts projected for Fleet Area presentation.
- **Battle-start ship snapshot:** the charge state used by SSIM when copying a
  target later in Charge Declaration.
- **Pending Simulacrum creation:** a durable turn-crossing record consumed by the
  following Drawing phase.
- **Dynamic maximum health:** if retained for Spiral, a server-derived value used
  consistently by healing clamps, destruction, victory, and client presentation.

Exact field names and nesting remain implementation decisions. Turn-scoped data
should live in turn state unless it must survive the turn boundary, as SSIM may.

### 8.4 Client runtime and projections

The client runtime should receive:

- authoritative current energy and approved public generation detail;
- requester-only available Solar actions and target descriptors;
- safe ordered or aggregated ledger entries;
- dynamic amounts such as dice-based healing/damage;
- pending UI state required for the Ancient catalogue and action panels.

The runtime may own local hover, tab, draft-selection, and optimistic presentation
state. It must submit intents using fresh server turn and state-revision values and
then reconcile to authoritative state.

### 8.5 Display responsibilities

Display work includes:

- Ancient species selection once the feature gate is approved;
- dedicated Solar Power icons, including four SSIM matchup variants;
- reference and in-game Ancient catalogue modes;
- energy counts, coloured dots, affordability dimming, hover cards, and info modal;
- SOL, Cube, SSIP, SBLA, and SSIM interaction panels;
- blue SSIM target glow and selected-ship presentation;
- Fleet Area rows for Cores/QUA, other basics, and the Solar ledger;
- central ENERGY versus LINES/JOINING LINES presentation;
- last-turn per-ship and per-power breakdowns;
- entry and activation animations after behavior is stable;
- desktop and mobile parity.

## 9. Provisional Implementation Sequence

Every implementation slice will be expanded into a new brief using the
[Codex pass template](workflows/CodexPassTemplate.md). Exact allowlists are set
after inspecting the owning seam. The sequence below is provisional and may be
reordered when a dependency becomes clearer.

| Pass | Type | Goal | Primary layer and likely scope | Dependencies | Validation expectation |
|---|---|---|---|---|---|
| P0 | Documentation / Planning | Establish this Phase 13 record and decision register. | `src/documentation/**` only. | Supplied PDF, planning notes, architecture docs. | Link/path inspection and documentation diff review. |
| P1 | Mixed data-definition | Align server-canonical and client-mirrored Ancient definitions with the approved rule snapshot, including `URA` → `NEP`. No gameplay. | Both ShipDefinitions files only unless inspection proves another mirrored data owner is required. | A-01 resolved for any affected Spiral text. | `npm run typecheck`, `npm run build`, Deno checks, mirrored-block comparison, stale-ID search. |
| P2 | Client/UI | Align Neptune identity and add approved Solar Power icon primitives, including four SSIM matchup variants. | `src/graphics/ancient/**`, shared presentation primitives, graphic resolvers. | Final assets and P1 IDs. | Typecheck, build, human visual review. |
| P3 | Server | Introduce the smallest usable coloured-energy state and normalization contract. Remove or reconcile scalar scaffolding. | Server Ancient seam, state types, route initialization/projection. | A-05 and A-12 sufficiently resolved. | Deno checks, targeted initialization/reload/state-projection cases. |
| P4 | Server | Implement PLU, MER, and NEP generation and Battle Phase reset. | Ancient energy seam plus phase-entry integration. | P3. | Deno checks, same-turn build cases, deterministic local Supabase tests. |
| P5 | Server | Enforce Core destroy and steal protection through existing targeting owners. | Shared targeting/resolution with narrow Ancient predicates. | P1 IDs. | Deno checks and GUA/DOM/other target regression cases. |
| P6 | Server | Implement QUA trigger storage, same-turn match, blue energy, healing, and cap. | Build resolution, power memory, computed effects, Ancient energy seam. | P3-P4. | Deno checks, multi-QUA trigger and build-turn cases. |
| P7 | Client/UI | Add QUA selection, caption, stacking, preview, and mobile parity by reusing Frigate patterns. | Client runtime/view model and display panels/fleet rendering. | P6 projection. | Typecheck, build, human desktop/mobile testing. |
| P8A-P8C | Server, then Client/UI as needed | Implement approved Spiral tiers as separate slices: maximum-health/healing, any build discount, and third-tier First Strike. | Server resolution/build/targeting; thin client projections and panels only where required. | A-01 and A-08 resolved. | Deno checks per tier, typecheck/build for UI slices, max-health/destruction regression matrix. |
| P9 | Server | Implement SOL use/hold preparation, charge spending, immediate energy gain, and depleted healing. | Ancient seam, charge actions, phase gating, end-of-turn effects. | P3 and A-05/A-06. | Deno checks, last-charge timing, hold/use, reload and idempotency cases. |
| P10 | Client/UI | Present SOL's mandatory choice and updated energy without owning legality. | Client projections and action panels, desktop/mobile. | P9. | Typecheck, build, human SOL flow testing. |
| P11 | Server | Establish the ordered multi-cast Solar lifecycle and implement SSTA as the first simple manual vertical slice. | Ancient Solar action resolution, energy payment, action projection, effect queue. | P3, P9, A-06. | Deno checks for affordability, payment, order, duplicate submission, and dice amount. |
| P12 | Client/UI | Rebuild the Ancient catalogue's reference and interactive shell around projected actions and energy. | Ancient catalogue, hover-card model, info modal, scaled desktop/mobile canvases. | P2, P11. | Typecheck, build, human catalogue review. |
| P13A | Server | Implement the automatic one-energy lifecycle with SAST. | Ancient autocast and queued damage. | A-02 resolved, P11. | Deterministic autocast/hold/exhaustion tests and Deno checks. |
| P13B | Server | Add SLIF through the established autocast path. | Ancient autocast and queued healing. | P13A. | Deno checks and heal-at-cap/breakdown cases. |
| P13C | Server | Add SCON and the next-Build line grant through the established autocast path. | Ancient autocast plus durable build-resource state. | P13A and line-grant contract. | Deno checks, turn-transition/reload/save-lines cases. |
| P14 | Server | Implement SSUP as an isolated dice-scaled manual Solar Power. | Existing P11 manual-cast path and queued damage. | P11. | Deno checks and dice-boundary cases. |
| P15 | Server | Implement SSIP legality, equal-colour spending, authoritative value choices, payment, damage, and healing. | Ancient Solar seam and action projection. | A-03 resolved, P11. | Deno checks, exact table/formula boundaries and unaffordable payload rejection. |
| P16 | Client/UI | Add the SSIP amount table and selection panel from server-projected options. | Client runtime and action-panel display. | P15. | Typecheck, build, human desktop/mobile testing. |
| P17 | Server | Implement SVOR using the approved shared type-count rule and timing. | Ancient Solar seam plus existing distinct-type helper where valid. | A-11 resolved, P11. | Deno checks with fleet changes during Charge Declaration. |
| P18 | Server | Implement SBLA paired-target legality, destruction, and Core-count damage. | Ancient Solar seam, shared destroy rules, action projection. | A-10 resolved, P5, P11. | Deno checks for 0/1/2 targets, protected ships, charges, once-only effects, and idempotency. |
| P19 | Client/UI | Add SBLA paired targeting and selection feedback by extending existing targeting UX. | Client targeting runtime, action panel, Fleet Area highlight. | P18 descriptors. | Typecheck, build, human desktop/mobile targeting. |
| P20 | Server | Implement SSIM target legality, start-of-Battle charge snapshot, once-per-target rule, and queued Drawing creation. | Ancient Solar seam, state persistence, build/foreign legality. | A-07/A-08/A-12 resolved, P11. | Deno checks for every species target, reload, upgrade, disappearance, Cube exclusion, and duplicate target. |
| P21 | Client/UI | Add SSIM blue targeting, selected graphic, matchup icon, and pending/revealed presentation. | Client targeting and Ancient catalogue/Fleet Area. | P2, P20. | Typecheck, build, human H/X/C/A matchup testing. |
| P22 | Server | Implement Cube repetition after all repeatable Solar semantics are stable. | Ancient ordered cast ledger and Solar resolvers. | A-09 resolved, P13-P21. | Deno checks for multiple Cubes, no manual cast, recursion prevention, and same-target SSIM copy. |
| P23 | Client/UI | Add the Cube-only chooser required when only automatic powers can be repeated. | Client projections and action panel. | P22. | Typecheck, build, human chooser testing. |
| P24 | Client/UI | Finalize Ancient energy readouts, catalogue eligibility, central stats switching, Fleet Area rows, and Solar ledger. | Client view models and display layout. | Stable P3-P23 projections. | Typecheck, build, human desktop/mobile/layout testing. |
| P25 | Mixed | Attribute last-turn damage and healing to Ancient ships and Solar Powers in battle logs, history, and breakdown stats. | Server history capture/finalization plus client stats view model/display. | Stable cast identity and effect attribution. | Deno checks, typecheck, build, history/reload/finished-game cases. |
| P26 | Client/UI | Add designer-approved entry and activation animations. | Ancient graphics and presentation-only animation seams. | Stable behavior, icons, and layout. | Typecheck, build, human visual testing. |
| P27 | Mixed hardening | Audit spectator projections, reconnect/resume, rematch, mobile, state migration, and computer-opponent compatibility. | Server projection/state normalization and client/display guards only as findings require. | Functional slices complete. | Full static checks plus targeted local Supabase and manual matrix. |
| P28 | Client/UI acceptance | Enable Ancient species selection after the implementation acceptance gate passes. | Existing species-selection runtime and desktop/mobile views. | P1-P27 complete or explicitly waived. | Typecheck, build, all matchup and existing-species regression matches. |

Ancient bot plans are not included in Phase 13 by default. Ancient remains excluded
as a computer-controlled species unless a later server-only bot-planning program
is explicitly approved. Existing Human, Xenite, and Centaur bots must still behave
safely when facing a human-controlled Ancient player.

## 10. Regression and Migration Risks

| Risk | Why it matters | Required posture |
|---|---|---|
| Existing species | Shared phase, targeting, effect, and history seams serve H/X/C. | Prefer Ancient-local predicates and run cross-species regression cases after every shared edit. |
| Phase progression | Multiple casts, mandatory SOL, autocast, and Cube can leave phases waiting or auto-advancing incorrectly. | Server owns a bounded, idempotent lifecycle; test hold, no-option, partial-option, reconnect, and duplicate-submit paths. |
| Hidden information | Pending casts or targets may reveal opponent choices before the approved boundary. | Separate requester-only pending state from public/revealed ledger projection. |
| DTO drift | Scalar energy scaffolding and older client types can conflict with the new coloured state. | Define one authoritative server schema, normalize old states, and map explicit public/requester fields. |
| State persistence | SSIM and SCON cross a turn boundary; QUA and charge snapshots persist across requests. | Use durable canonical state with lazy defaults and reload tests; do not rely on component memory. |
| Determinism | Cast order changes Cube, payment, and outcomes. | Store explicit sequence values and deterministic tie-breaking; avoid object-key or render-order semantics. |
| Bots | Existing bots may encounter Ancient targets without understanding Ancient rules. | Keep Ancient unavailable as a bot species and ensure server legality protects all opponents. |
| Spectators | Spectators consume public state but must not receive requester-only actions. | Add projection tests and read-only manual spectator checks. |
| Mobile | The catalogue and ledger are unusually dense and may exceed current scaling assumptions. | Treat mobile parity as part of each UI slice and perform a final dedicated audit. |
| Battle logs/history | Solar Powers are not ordinary fleet ship instances but still need source attribution. | Define stable cast/source identity before stats and history implementation. |
| Cross-species copies | SSIM-created ships interact with charges, upgrades, type counts, and future modifiers. | Route creation through existing build/foreign legality and preserve only approved state. |
| Charge Response | Removing it would alter all species and clock/action routing. | Defer and isolate behind a separate explicit Mixed Pass if later approved. |
| Partial scaffolding | Existing placeholders can appear more complete than they are. | Inspect before reuse, delete or replace stale scaffolding only inside an approved pass, and avoid parallel competing models. |

Database migrations are not currently assumed. If stored game-state shape changes can
not be handled through backward-compatible normalization, migration or game-version
policy must be proposed as its own explicit pass before implementation.

## 11. Validation Strategy

### 11.1 Static validation

Use the checks appropriate to each pass:

- `deno check src/supabase/functions/server/index.tsx`
- `deno task check`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Documentation-only passes require link/path and diff review rather than TypeScript,
Deno, Vite, or browser validation.

### 11.2 Targeted server validation

Where the current harness permits, add or extend deterministic tests for:

- energy initialization, generation, reset, payment, and exhaustion;
- phase waiting and auto-advance behavior;
- action payload rejection and duplicate submission;
- manual, automatic, and Cube cast order;
- target legality and protected Cores;
- effect queue and end-of-turn attribution;
- turn-crossing SCON and SSIM state;
- reload and older-state normalization.

The human developer can run local Supabase during server-heavy slices. Runtime
testing must not be claimed by Codex unless it was actually performed.

### 11.3 Manual gameplay matrix

Before Ancient selection is enabled, the human developer should test:

- Ancient vs Human, Xenite, Centaur, and Ancient;
- baseline Human/Xenite/Centaur matches without Ancient present;
- Core generation on the same turn as building;
- QUA trigger selection, matching, non-matching, and stacking;
- every approved Spiral tier and destruction ordering;
- SOL use, hold, final charge, and depleted healing;
- multiple manual Solar casts, hold, no-option autocast, and partial leftover energy;
- multiple Cubes and the autocast-only chooser;
- SSIP minimum, maximum, and unaffordable values;
- SBLA with fewer than two legal targets and charge/once-only targets;
- SSIM against H/X/C/A, charged targets, upgrades, reload, and Cube;
- Solar ledger reset at the next Battle Reveal;
- per-power battle-log and last-turn breakdown attribution;
- reconnect/resume, spectator, rematch, desktop, and mobile behavior.

## 12. Submission-Stage Status

This repository artifact records substantive GPT-5.6-assisted engineering
planning for the Ancient species as part of the project's GPT-5.6 and Codex
hackathon submission: rule analysis, architecture, ownership boundaries, state
and timing concepts, risk review, decision gates, validation, and an
implementation sequence suitable for future Codex passes.

Ancient implementation has intentionally not begun as part of this planning pass.
The feature is not represented as complete or playable, and unresolved rules are
recorded openly. Later Codex sessions will convert only approved portions of this
record into scoped repository changes.

## 13. Next Decision Gate

The first implementation pass may begin when:

1. the human developer approves this planning record as the Phase 13 working
   roadmap;
2. the exact P1 definition snapshot is approved, including Neptune identity and
   the Spiral text selected under A-01;
3. the P1 Codex brief names exact allowed files and exclusions using the pass
   template;
4. server-canonical and client-mirrored definition changes are reviewed as data
   only, without claiming Ancient gameplay functionality.

Not every open question must be resolved before P1. Subsequent questions are
approved slice by slice immediately before their dependent pass, allowing the
program to progress without pretending the entire species is already finalized.
