# Phase 20 — Game UI Updates and Health Bars

## Planning baseline and scoped implementation roadmap

- **Owner:** Judd Madden
- **Status:** Approved direction; implementation details remain subject to owner review at each pass
- **Prepared:** 2026-10-21
- **Audited source:** supplied `1020.zip`
- **Phase 20A:** Game UI Updates — complete and review before activating Phase 20B
- **Phase 20B:** Health Bars — dynamic scales, dedicated animation sequence and integration
- **Architecture:** server-authoritative gameplay; client-owned presentation
- **Suggested repository location:** `\src\documentation\plans\Phase 20 Game UI and Health Bars.md`

> This is the main planning baseline, not permission to implement every pass in one operation. Judd will supply designs and review individual pass plans and implementations. At Judd's discretion, an approved individual pass plan may change the scope, sequence, measurements or behaviour proposed here. Further responsive requirements are expected. Preserve all existing behaviour unless a change is explicitly part of the approved pass.

### 2026-10-21 — Combined 20A.1 + 20A.2 implementation

- Combined the affected presentation inventory with desktop board/header foundations. Header and fleet columns now share the existing 200/230px centre column and 8px gaps; clocks and headers remain mounted across setup transitions.
- Initial header tiers: 768–1399px uses name/clock/status/species sizes 16/16/12/10px; 1400–1919px uses 24/20/14/12px; 1920px+ uses 36/28/18/15px. Pill heights are 36/42/50px. Header reservations are 68/78/90px. Stacking below 1200px with a 124px reservation is a proposed fallback pending visual review.
- Desktop increment cues sit centred 2px below their clocks; lifecycle and mobile treatment are unchanged. Decorative 24px tracks share a blank 56px legend lane and shrink from at most 330px to zero before central scrolling is necessary.
- Existing stats retain their typography, spacing, grouping, formatting and gates. The central scroll gutter accommodates existing horizontal row overhang, including Centaur/joining variants. Scrolling dismisses active health/stat/economy cards immediately, including retained exit content; fresh entry/focus captures a new anchor.
- Dice/helpers remain in LeftRail. Stat regrouping and typography remain deferred to 20A.4; active health bars and mobile changes remain deferred to their respective passes.
- Owner visual review is **pending** for L/M/S reference sizes, intermediate/narrow desktops, long names/statuses, increment cues, short-screen collapse/scrolling, setup/intros/missions, finished games and unchanged mobile presentation. No Vite/browser testing was performed by Codex.

---

## Contents

1. Authority, review and change control
2. Purpose, scope and non-goals
3. Verified repository baseline
4. Behaviour-preservation contract
5. Target board organisation
6. Stats, economy and inspection semantics
7. Desktop dice extraction and helper displays
8. Responsive and visual specification method
9. Phase 20A: Game UI Updates passes
10. Phase 20B: authoritative inputs and server posture
11. Health bars: scale and legend contract
12. Health bars: rendering and animation contract
13. Timing, presentation lifecycle and recovery
14. Phase 20B: Health Bars passes
15. Validation and owner review
16. Decisions and unresolved details
17. Completion criteria
18. Appendix A: design references and image calibration
19. Appendix B: initial visual specification
20. Appendix C: worked resolution scenarios
21. Appendix D: individual pass brief template

---

## 1. Authority, review and change control

### 1.1 Source precedence

For the intended change, use this order:

1. Judd's current instructions, supplied designs and explicitly approved individual pass plan.
2. The live repository, including changes made after `1020.zip`, for existing behaviour and implementation facts.
3. Current repository architecture contracts, agent instructions and development guidelines, subject to explicit owner direction.
4. Locked requirements in this document.
5. Provisional specifications and recommended pass decomposition in this document.
6. Historical planning documents as context, not authority for restoring old behaviour.

An instruction to move or restyle an element does not imply permission to simplify its behaviour. If new designs omit an existing feature, preserve that feature and identify where it fits. Do not interpret absence from a mockup as a removal request.

### 1.2 Decision classes

| Classification | Meaning |
| --- | --- |
| Locked | Explicitly established project direction or preservation requirement. |
| Provisional | A proposed implementation or design detail to review when its pass is reached. |
| Open | Requires owner design/input or a further focused code audit before being fixed. |
| Verified baseline | Observed in `1020.zip`; re-check against the live repository before editing. |

Do not silently promote a provisional recommendation into a locked requirement. In particular, precise responsive rules, new CSS dimensions, timing values, preference changes and several animation details remain reviewable.

### 1.3 Pass workflow

For each pass:

1. Read the live instructions, architecture contracts and `CodexPassTemplate.md`.
2. Review the designs supplied for that pass and compare affected components with current code.
3. Inventory existing behaviour, conditionals, consumers and nearby elements, including items absent from the mockups.
4. Produce a concrete file plan, affected-behaviour summary and explicit list of unresolved design choices.
5. Implement only the scope authorised for that pass, resolving routine implementation choices within that scope.
6. Run relevant automated checks and report what was and was not verified.
7. Judd performs browser review; incorporate feedback before proceeding to dependent passes.

Judd can merge, split, reorder or revise passes. Record material departures in a short change note with the affected requirement and replacement decision; do not preserve contradictory specifications.

### 1.4 Reviewable increments

Every pass must leave a runnable, coherent application. Avoid half-wired consumers, temporary gameplay rules and duplicated active controls. Component extraction should carry existing rendering and callbacks first; later styling should not conceal a simultaneous behavioural rewrite.

Phase 20A must be usable and reviewable with inactive health-bar placeholders. Phase 20B must not be started as an unreviewed extension of a layout pass.

## 2. Purpose, scope and non-goals

### 2.1 Purpose

Reorganise the board around the two health pools, the damage and healing affecting them, and a shared dice/economy area. Add animated health bars that communicate the increasing scale of combat, including large damage offset by large healing, while retaining Shapeships' restrained digital-board-game character.

A turn moving from 25 health to 23 may eventually involve a displayed damage excursion to −60 and recovery to 23. The display should make that scale understandable while retaining exact final health and all current strategic information.

### 2.2 Phase 20A scope

- Desktop board container and central-column layout.
- Revised player name, connection, clock and status arrangement.
- Desktop dice moved out of LeftRail into the central board area, with existing helper displays.
- Dice, saved lines and bonus lines grouped together.
- Damage/healing grouped by the health pool affected, with current and last-turn values.
- Desktop hover changes and mobile paired popovers with internal time tabs.
- Mobile status-layout changes and horizontal placeholder bars.
- Fleet value presentation, subject to approval of its exact locations and treatment.
- Responsive integration and preservation of all existing conditional elements.

### 2.3 Phase 20B scope

- Authoritative input audit and narrowly scoped server changes only if necessary.
- Real bars and dynamic shared legend.
- Normal linear scaling, increased maximum health and conditional compression of negative values.
- Dedicated presentation controller for multiple visual stages of a single resolved update.
- Coordinated damage, healing, overheal and final-result presentation.
- Desktop and mobile rendering, lifecycle recovery and timing review.

### 2.4 Non-goals

- No ship-to-health beams, missiles or new ship-destruction effects.
- No changes to balance, targeting, charge resolution, victory rules, bots or combat order.
- No replacement networking stack, polling loop or authoritative resolution system.
- No broad fleet-graphics, catalogue, rules-screen or end-game-stats redesign.
- No mobile dice relocation or helper-behaviour redesign by implication.
- No new styling framework, build/configuration changes or general repository cleanup.
- No removal of existing features merely to match a simplified mockup.

## 3. Verified repository baseline

These are navigation and reuse facts from `1020.zip`, not a licence to use stale code over the live repository.

| Area | Current files / facts | Planning implication |
| --- | --- | --- |
| Root display | `src/game/display/GameScreen.tsx` selects desktop/mobile layouts and passes shared VM/actions and preferences. | Preserve the existing entry and orchestration seams. |
| Desktop composition | `layout/MainStage.tsx`, `layout/TopHud.tsx`, `layout/BoardStage.tsx`, `layout/LeftRail.tsx`. | Audit ownership before moving rows between containers. |
| Desktop stats | `layout/boardStage/boardStatPresentation.ts`, `BoardStatBreakdownHoverCard.tsx`, `useBoardStatHover.ts`, `healthBreakdownPresentation.ts`. | Reuse formatting, concealment and breakdown semantics. |
| Mobile composition | `mobile/MobileGameLayout.tsx`, `MobileBoardView.tsx`, `MobileStatusRail.tsx`, `MobileBottomPhase.tsx`. | Preserve fleet sizing, interactions and bottom controls while changing the status band. |
| Mobile inspection | `mobile/MobileStatBreakdownPopovers.tsx`, `mobileStatPresentation.ts`. | Evolve the existing paired popovers and gesture/anchor handling. |
| Mobile dice helpers | `mobile/MobileDiceModifierSlots.tsx`, `game/client/gameSession/mobileDiceModifierSlots.ts`. | Mobile dice and helper behaviour remain in place. |
| Shared die | `src/components/ui/primitives/dice/Dice.tsx`. | Reuse the die and its existing animation input; do not recreate it. |
| Runtime | `src/game/client/useGameSession.ts`, `gameSession/types.ts`, `mapVm.ts`, `thisTurnPresentation.ts`. | VM/input changes belong here, not inside layout JSX. |
| Presentation lifecycle | `gameSession/clienteffects/useEndOfTurnPresentation.ts`, `useTurnPhasePresentation.ts`, `turnPhasePresentationTiming.ts`, `turnStartPresentationGates.ts`. | Extend the current sequence and continuity gates rather than starting a competing lifecycle. |
| Stats graphs | `display/stats/gameStatsScales.ts`, `gameStatsChartGeometry.ts`. | Existing positive/negative mapping is a reference; do not assume its negative `−INF` treatment is the live-bar specification. |
| Server resolution | `src/supabase/functions/server/engine_shared/resolve/resolvePhase.ts`. | Already computes authoritative gross damage/healing, clamped final health and actual net delta. |
| History | `server/engine/state/battleLogHistory.ts`. | History already carries final health/max health, damage taken, healing and net delta. Reuse where appropriate. |

Additional verified details:

- The mobile layout selector currently uses `(max-width: 767px)`; several desktop styles distinguish `768–1599px` from larger widths. Individual visibility classes must also be checked; these are not a complete new responsive specification.
- Desktop dice helper selection currently produces two display slots. If CHR is present, it occupies the right slot; the left receives the first non-CHR candidate. Non-CHR candidate order is KNO, LEV, then existing Cube entries. Without CHR, the first two non-CHR candidates are displayed.
- The mobile selection is separate: one selected helper group per player, with existing CHR/CUB/LEV/KNO precedence and CHR-side handling.
- Chronoswarm shared extra rolls are capped at three by server code. Do not design for an arbitrary unbounded row of helper dice.
- Existing desktop left/right helper slots are not simply a general-purpose player-ownership layout. Relocation must preserve current selection and meaning unless an explicit redesign approves otherwise.
- Existing end-of-turn client timing includes a 2000ms minimum turn-resolution presentation and a derived turn-start dice delay. These are dependencies to audit, not spare timing budget to change casually.
- `BoardStage.tsx` already animates health numbers. Phase 20B must coordinate or replace that presentation so two independent animations do not compete.

The live repository may contain more recent Centaur bonus-display fixes or other work. Preserve those improvements. Never revert to the ZIP's older behaviour during an extraction.

## 4. Behaviour-preservation contract

### 4.1 Required inventory before each affected pass

Map every affected visible element to its source data, gating conditions, callbacks, hover/tap content and consumers. Review its behaviour in relevant setup, active, spectator and finished modes. Record overlooked elements rather than dropping them.

The following checklist is a minimum, not an exhaustive list of everything in the application:

| Area | Behaviour to preserve |
| --- | --- |
| Identity | Viewer-relative player ordering, spectator seat ordering, names, connection state, unresolved-species concealment and existing species access. |
| Clocks | Canonical values, running/paused state, increments, clock presentation and untimed variants; no layout-owned clock logic. |
| Status/actions | Ready, drawing, waiting, submitting, errors and finished states; disabled/conditional Ready text; callbacks and double-submit protection. |
| Setup/intros | Species selection, matchup intro, missions and acknowledgement holds; first-turn helper eligibility and dismissal. |
| Dice | Presentation keys, visual roll, modifier values, overrides, Cube highlighting/choice flow, rerolls, Chronoswarm rolls and settling gates. |
| Phase display | Turn number, milestone movement/holds, phase/subphase text and start-of-turn transitions. |
| Economy | Saved ordinary/joining lines, ordinary bonuses, Centaur lines on even, joining bonuses, win-streak bonus details and existing source breakdowns. |
| Estimates | Requester-private draft projections, charge-declaration updates, manual Solar plus remaining Autocast handling, incomplete/uncertain values and stale-response protections. |
| Concealment | Opponent `?` states, Dice Roll concealment, dice-settle holds, hidden build/charge/Autocast details and no hidden information through new geometry or tooltips. |
| Battle log | This Turn card, history recovery, export, scrolling/expansion, introductory text and original applied streak bonus. |
| Fleet | Entry/activation/layout animations, targeting, stacks, hover/tap, Solar ledger, copied ships, delayed materialisation and reveal sequencing. |
| Menus/overlays | Rules/species tabs, ship catalogue/modals, menu takeovers, missions, chat/draw offers, spectators and overlay precedence. |
| Finished games | Health finish, narrow victory/draw, resignation/timeout/disconnect or other existing finish reasons, stats handoff, replayed/persisted state and rematch/navigation. |
| Preferences | Existing sound and Health Flash state, persistence and controls, until a specific preference change is approved. |
| Responsive behaviour | Existing supported viewports, short heights, scrolling, safe areas, orientation policy, zoom/resizing and breakpoint transitions. |

### 4.2 Preserve semantics, not only displayed totals

Regrouping damage and healing does not change their owners or targets. Moving controls must not alter intent creation or phase availability. Extracting a component must not remount it on every poll or introduce another independent sound/animation trigger.

Do not replace existing structured rows with hand-built strings that lose source labels, plurality, joining-line distinctions or estimate metadata.

### 4.3 Elements absent from designs

If an omitted element can fit naturally while preserving its behaviour, include it in the file plan. If placement requires a design decision, explicitly list it for the pass review. Work that does not depend on the decision may continue; do not invent a removal or silently redesign an unrelated area.

### 4.4 Snapshot baseline and updates

Before a substantial container replacement, record relevant current behaviour and owner-supplied reference screenshots. Later fixes become the preservation baseline for subsequent passes. A new layout screenshot is not sufficient evidence that estimates, clocks or phase gating remained correct.

## 5. Target board organisation

### 5.1 Desktop

The intended organisation is:

- Player header row: identity/connection, clock and status, arranged as in the current approved design.
- Two fleet areas flanking the central health region.
- Vertical health bars with one shared legend, exact health values and existing net-delta presentation.
- Adjacent damage/healing groups attached conceptually to the health pool affected.
- Shared die below the health values, with existing helper slots nearby.
- Saved lines, bonus lines and potentially Fleet Value below the die.
- Existing phase heading, conditional Ready/action rail and lower action panel remain accessible.
- LeftRail remains responsible for its retained brand/log/phase/chat surfaces after dice extraction.

Do not move all controls into a single new container merely because they appear close in the mockup. Preserve existing ownership unless a small presentation extraction makes the layout simpler.

### 5.2 Mobile

- Opponent fleet above the status band; requester fleet below, retaining current ordering and fleet interaction.
- Opponent identity/status/health/stats row above the paired horizontal bars; requester row below.
- Bars share a horizontal legend and mapping, with the same value direction.
- Existing mobile die and clocks remain in their current functional placement. The new bars/stat layout must fit around them.
- Existing bottom phase text, Ready button, catalogue/species tabs and takeover behaviour remain operational.
- Tapping the applicable stats group opens the paired inspection surfaces.

Exact responsive positioning remains subject to further owner requirements. Do not turn these observations into an unreviewed all-width layout contract.

### 5.3 Phase A placeholders

Placeholders establish final bar/legend space and visual proportions, without dynamic scaling or a resolution animation controller. A simple static current-health depiction is acceptable if approved for the pass. They must not suggest fabricated intermediate combat outcomes.

Current exact health, net delta and interactions remain available. Switching Phase B on later should replace the placeholder interior without requiring another structural board redesign.

## 6. Stats, economy and inspection semantics

### 6.1 Group by affected health pool

| Location | Red contribution | Green contribution |
| --- | --- | --- |
| Requester's health side | Opponent damage dealt to requester | Requester's healing |
| Opponent's health side | Requester damage dealt to opponent | Opponent's healing |

Use the corresponding viewer-relative terms for spectators. Do not assume every viewer is one of the two players.

Apply this grouping to current values, last-turn values and their breakdowns. This is a presentation change; keep damage-dealt and damage-taken data meanings distinct in the VM.

### 6.2 Current and last turn

- Current values consume the existing presented This Turn pipeline, including its uncertainty and concealment metadata.
- Last-turn values use resolved totals and resolved breakdowns.
- Large/current and smaller/last values must stay recognisable as different time periods.
- No new renderer may bypass the dice-settle gate or infer a hidden opponent estimate.
- Unknown values remain unknown; do not substitute numeric zero or derive bar previews from them.
- Preserve `AUTOCAST ESTIMATE` and its current applicability. A generic time tab must not erase this qualifier or expose it for an opponent.

### 6.3 Desktop inspection

Use existing hover infrastructure where possible. A health-side battle breakdown shows incoming damage and own healing together, with correct owners in its headings. Preserve access to last-turn information, health/max-health detail and economy breakdowns even where mockups show only the current hover state.

Anchor placement, collision handling and exact current/last inspection interaction are reviewed in 20A.4. No feature is removed because only one hover is drawn in a reference image.

### 6.4 Mobile paired popovers

The intended direction is two paired cards with:

1. A stable current economy summary above the tabs: saved resources, Fleet Value if enabled, and bonus sources.
2. Internal `THIS TURN ESTIMATE` and `LAST TURN` selection for battle contributions.
3. Two contribution columns grouped by affected health pool.

Use one shared selected period. Activating either card's tab changes both cards and both selected indicators. Never show one card's current estimate against the other card's last-turn result accidentally.

The economy header remains current on both tabs. Establish that scope through separation and labels, not by making historical values look current.

Provisional interaction defaults for 20A.6 review:

- Open initially on This Turn Estimate.
- Remember selection when closing/reopening during the same game turn.
- Do not unexpectedly change selection while the user is inspecting an open card.
- Specify turn rollover, new game and end-game behaviour explicitly in the individual pass plan.
- On Turn 1, treat unavailable previous history as unavailable, not invented breakdowns; retain existing meaningful neutral totals where applicable.

Preserve outside-tap dismissal, tap-versus-drag handling, pointer containment and anchors. Tab taps must not dismiss the pair or activate the board behind it. Long content must remain reachable within the available viewport.

### 6.5 Economy and fleet value

- Keep ordinary saved lines and joining resources separate.
- Preserve all Centaur bonus categories and their established conditional visibility, including zero where current behaviour intentionally shows it.
- Preserve source breakdowns and win-streak bonus explanation.
- Fleet Value is a secondary metric, not a new resource or ship count. Reuse existing canonical valuation/presentation inputs; do not invent a local cost formula in JSX.
- Its display locations, purple treatment and compact label are provisional. Prefer a clear `Fleet Value` label in detail surfaces even if the on-board label is abbreviated.
- Audit availability and privacy for a live current fleet value; an end-of-turn history value alone must not be relabelled as current.
- Current opponent build concealment applies to Fleet Value as well as ship graphics.

## 7. Desktop dice extraction and helper displays

### 7.1 Extraction contract

Move the desktop die and helpers out of LeftRail into a presentation component mounted in the central area. Reuse the existing Dice primitive, values, animation keys and slot VM. Keep server communication and rule decisions in the runtime/server.

Avoid a temporary duplicate visible die. Do not keep the old dice block running invisibly merely to preserve an effect trigger; move the required presentation input/lifecycle correctly.

### 7.2 Limited supported helper states

Design around the live selection policy rather than hypothetical unlimited combinations. Baseline helper categories:

| Helper | Existing presentation meaning |
| --- | --- |
| LEV | Fixed six display with source graphic. |
| KNO | Source graphic and its existing no-die/spacer behaviour. |
| CHR | Shared extra-roll array, capped at three; existing animation key. |
| CUB | Per-player Cube die value, source graphic and used/highlight state. |

Preserve selection order, mirrored/multiple-source treatment and current-turn eligibility. Ship instances created this turn must not begin showing as eligible helpers earlier than existing gates allow.

The approved design may rearrange the helper group internally, for example wrapping three CHR dice beside the source graphic. That does not authorise changing which values exist or who owns them. Do not reinterpret desktop slot left/right as ownership without checking the current contract and receiving design direction.

### 7.3 First-turn build helper

LeftRail currently also hosts first-turn helper presentation. Inventory its anchor, timing, dismissal and intro dependencies when extracting the die. Preserve that guidance, adapting its anchor only where the move requires it and the pass plan specifies it.

### 7.4 Mobile invariant

Do not relocate or redesign mobile dice/helpers in 20A.3. Shared primitive changes must preserve mobile sizes, clocks, modifier slots and settling behaviour. If later responsive work needs a mobile change, make it explicit in that pass.

## 8. Responsive and visual specification method

### 8.1 Measurements are not assumptions

Appendix A records exact received image dimensions. Appendix B separates existing CSS values, raster measurements and proposed CSS values. Do not apply a screenshot-wide scale factor without knowing the design viewport/export relationship.

In particular, do not increase every text size to match a visually enlarged preview. Existing UI typography and shared components are the starting point. Font family/weight/line-height and box geometry must be specified separately; visible glyph height is not CSS font size.

### 8.2 Owner-supplied responsive requirements

Further requirements are expected. Before each layout pass, settle the relevant ranges and behaviours with Judd's latest design. Preserve current supported layouts in unmodified ranges; never hide a feature at an unplanned width to make one mockup fit.

The eventual responsive specification must address:

- Wide desktop, intermediate/narrow desktop and the current mobile boundary.
- Width and height independently, including short desktop windows.
- Main-stage/fleet space after left rail and centre allocations.
- Long names, long statuses, three-digit and larger totals, negative signs and estimate/uncertainty suffixes.
- All existing bonus categories and real helper combinations.
- Popover collision, available height, scrolling and safe-area insets.
- Existing mobile orientation policy; no unsolicited landscape redesign.
- Resize/breakpoint crossing during an active health animation.

### 8.3 Layout principles

Use existing Tailwind patterns, shared colours and text components where appropriate. Prefer local component sizing and breakpoint rules to scaling an entire board with transforms. Do not solve overflow by clipping essential statistics, disabling zoom or shrinking all text indiscriminately.

Container passes establish available space. Atomic component passes control typography, rows, graphical segments and interaction affordances. Keep these responsibilities clear without inventing a general design-system framework for this feature.

## 9. Phase 20A — Game UI Updates passes

The following sequence is recommended. Each pass may be revised by Judd; exact new component names are proposals, not mandatory APIs.

### 20A.1 — Presentation foundations and behaviour inventory

**Type:** Client/UI Pass. **Dependency:** approved designs/calibration for the elements being extracted.

**Goal:** Establish reusable presentation pieces and an explicit preservation baseline without changing gameplay behaviour.

**Expected scope:** affected portions of `layout/TopHud.tsx`, `BoardStage.tsx`, desktop/mobile stat presentation helpers, `gameSession/types.ts`/mapping only if a small additive VM field is necessary, and narrowly scoped sibling display components.

**Work:** inventory header/status/clock and metric variations; extract reusable rendering only where it supports the approved composition; preserve formatting and hover payloads; identify any missing live fleet-value input; draft the layout-specific dimensions for review.

**Out of scope:** server, dynamic bars, broad session refactoring, changing helper selection or estimate scheduling.

**Acceptance:** current views remain functional; every moved behaviour has an identified consumer; new components retain existing props/callback semantics. No regression caused by extraction remounts.

### 20A.2 — Desktop board containers and player header

**Type:** Client/UI Pass. **Dependency:** 20A.1 and approved desktop responsive rules for this pass.

**Goal:** Implement the desktop structure, revised identity/clock/status row and reserved bar space.

**Expected scope:** `GameScreen.tsx`, `layout/MainStage.tsx`, `TopHud.tsx`, `BoardStage.tsx`, `LeftRail.tsx` only for required retained-surface layout adjustments, plus new local presentation containers.

**Work:** allocate the centre region and fleet sides; mount inactive vertical bar/legend placeholders; preserve setup/intro alternatives; position the player header and lower action interfaces. Keep existing die functional until its dedicated move.

**Acceptance:** fleets, header, statuses, clocks, lower catalogue/action panel, Ready and overlays remain reachable at approved widths/heights. Placeholders do not change current health truth or visibility. Names/statuses do not overlap essential controls.

**Owner review:** container proportions and responsive behaviour, including elements missing from the mockups.

### 20A.3 — Desktop dice and helper relocation

**Type:** Client/UI Pass. **Dependency:** central container available from 20A.2.

**Goal:** Render the existing desktop die/helpers centrally and remove their old LeftRail presentation.

**Expected scope:** `LeftRail.tsx`, new desktop dice presentation component, `BoardStage.tsx`/`MainStage.tsx`, directly required prop plumbing and first-turn helper anchoring.

**Work:** preserve die/roll keys and helper slot selection; implement approved limited helper layouts; relocate first-turn guidance if required; let retained LeftRail panels use the released space.

**Acceptance:** one visible desktop main die; no duplicate roll/sound; LEV/KNO/CHR/CUB variants match existing behaviour; Cube interaction/highlight and intro/dice-settle holds survive. Mobile dice/helpers are unchanged.

### 20A.4 — Desktop stats, economy and inspection

**Type:** Client/UI Pass. **Dependency:** 20A.1–20A.3 as required by final layout.

**Goal:** Implement affected-health-pool grouping, economy placement and complete hover access.

**Expected scope:** `BoardStage.tsx`, `boardStatPresentation.ts`, `BoardStatBreakdownHoverCard.tsx`, `useBoardStatHover.ts`, `healthBreakdownPresentation.ts`; runtime/types only for specific missing presentation inputs.

**Work:** current/last red/green groups, requester/opponent owner mapping, economy categories, optional Fleet Value, anchors and popover bounds. Consume existing presented estimate states and maintain Autocast qualifiers.

**Acceptance:** numeric values and breakdowns agree with the old presentation for the same state; owner mapping is correct; last-turn access remains; concealed values stay concealed. Centaur ordinary/even/joining and streak sources are retained.

### 20A.5 — Mobile status composition and placeholders

**Type:** Client/UI Pass. **Dependency:** shared presentation semantics and owner-supplied mobile design.

**Goal:** Implement the revised mobile rows and horizontal placeholder space around existing dice/clocks.

**Expected scope:** `MobileStatusRail.tsx`, `MobileBoardView.tsx`, `MobileGameLayout.tsx` and directly related layout components/props.

**Work:** player rows, reordered stats, inactive horizontal bars/shared legend, names/statuses and net delta; integrate with existing fleet regions and bottom controls. Preserve current mobile die/modifier placement.

**Acceptance:** approved phone widths/heights remain usable; no clipped names/totals essential to decisions; fleet tapping/targeting and bottom actions still work; all current stats and detail entry points remain available.

### 20A.6 — Mobile paired inspection and shared time tabs

**Type:** Client/UI Pass. **Dependency:** 20A.5 anchors and shared stats semantics.

**Goal:** Implement the paired popover design and a shared current/last period selection.

**Expected scope:** `MobileStatBreakdownPopovers.tsx`, `mobileStatPresentation.ts`, existing anchor/selection owner in `MobileStatusRail.tsx` or its current parent, and directly related shared presentation helpers.

**Work:** stable economy header, damage/healing columns, tab controls, selected-period lifecycle, bounded scrolling and valid empty/concealed/Autocast states.

**Acceptance:** either card switches both; headers remain current; taps do not dismiss or reach the board; long content and tiny viewports remain navigable; last-turn values use resolved data. No duplication of estimate logic.

### 20A.7 — Integration, responsive review and Phase A acceptance

**Type:** Client/UI Pass. **Dependency:** all approved 20A passes.

**Goal:** Resolve interactions across the reorganised board and establish the reviewed Phase B geometry.

**Expected scope:** only components and helpers touched by Phase A, plus direct regression fixes identified during owner review.

**Work:** review the preservation matrix, live post-ZIP changes, setup, spectator and finished views, first-turn guidance, menus and responsive transitions. Remove obsolete presentation fragments only after their behaviour has a working replacement.

**Acceptance:** Phase A stands alone with inactive bars, approved layout and all existing behaviours retained. Record remaining open Phase B choices. Judd reviews this checkpoint before active health bars are introduced.

## 10. Phase 20B — Authoritative inputs and server posture

### 10.1 Existing health calculation

The supplied resolver performs the equivalent of:

```text
rawEnd = startHealth - damageTaken + healingReceived
finalHealth = min(rawEnd, authoritativeMaxHealth)
actualNetDelta = finalHealth - startHealth
```

It applies the aggregate outcome simultaneously, then evaluates victory using authoritative results. Phase 20B's sequential damage/healing display is explanatory animation, not a new combat order. Going below zero midway through that animation is not itself a defeat event.

### 10.2 Presentation snapshot inputs

For each completed resolution, assemble a coherent snapshot containing:

| Input | Requirement |
| --- | --- |
| Identity | Game, resolved turn and existing stable resolution/presentation identity; player IDs and viewer orientation. |
| Start | Health at the start of aggregate health application. |
| Contributions | Resolved damage taken and gross healing received, including healing later lost to the maximum clamp. |
| End | Authoritative final health and actual net delta. |
| Maximum | Authoritative maximum applicable to that resolution; current/start maximum where required to explain a genuine maximum change. |
| Outcome | Existing terminal flag, finish reason and authoritative winner/draw information. |
| Continuity | Whether the viewer observed this live or is loading/recovering an already settled result. |

This is a semantic input specification, not a demand for a new server DTO or duplicate persisted state. Reuse current structures where they supply these facts.

### 10.3 Starting health and overheal

Because the existing net delta is actual clamped change, `startHealth = finalHealth - actualNetDelta` can recover the aggregate starting health from the matching resolved snapshot. Do not substitute `healing - damage` as the net when recovering this value: it fails in overheal cases.

Aggregated health events also contain `previousHealth`, `newHealth`, damage and heal. Choose the route that is reliable across intent responses, polling and history recovery. Never combine one turn's health with another turn's contributions.

Intermediate visual positions and surplus-healing display can be derived from these authoritative inputs in a pure presentation helper. They must not write canonical health or decide victory.

### 10.4 Server changes: conditional, narrow and explicit

No server update is presumed necessary. 20B.1 must determine whether current inputs cover live play, terminal turns, polling, spectators and recovery. If an input is missing, propose the smallest compatible extension, including projection/privacy and historical fallback.

If server work is needed, make it a separate Server Pass with a concrete file plan. A client/server change that must ship together may be a Mixed Pass only within explicitly approved scope. Do not add a general combat replay system, new endpoint or duplicate resolver for presentation convenience.

Authoritative hold-duration changes are server/contract work, not a CSS adjustment. First try to fit the agreed animation into the current presentation lifecycle. If that is insufficient, propose the timing-contract change explicitly with its clock/automation impact.

### 10.5 Missing or incompatible data

On missing historical contributions or mismatched identities, show the authoritative settled health. Do not fabricate a dramatic sequence. Older games and sparse histories must remain viewable.

## 11. Health bars — Scale and legend contract

### 11.1 Shared mapping

- Both players use the same mapping for a displayed resolution.
- Desktop uses a vertical mapping; mobile uses the corresponding horizontal mapping.
- The positive range includes the relevant authoritative maximums, with a default baseline of 0–35.
- The negative range includes the lowest displayed damage-stage value and any final negative values.
- Overheal does not expand the positive range merely to show unused healing.

### 11.2 Protected positive section

Reserve a minimum readable amount of bar space for the positive-health interval. The protected size differs by breakpoint and remains an owner-reviewed design value.

This is a screen-space guarantee, not a minimum player health or a new maximum-health rule. If the relevant maximum exceeds 35, such as an Ancient maximum-health increase, the shared positive range must accommodate it. Retain a way to identify each player's actual cap when caps differ.

### 11.3 Conditional negative compression

Use the same units-per-pixel above and below zero while that fits the available space and positive-section guarantee. Only when required, compress the negative region independently. Within each region use a clear, monotonic mapping rather than an unexplained arbitrary curve.

The eventual threshold, rounding and protected-space values belong in reviewed configuration/calculation helpers, not scattered JSX constants. A small axis-break cue is a proposal for review; the required outcome is that differing positive/negative scales remain understandable.

Do not compress each player's negatives differently. A value of −60 must occupy the same position for both bars in the same view.

### 11.4 Legend labels

- Keep zero identifiable.
- Keep the positive top/maximum context identifiable.
- Use legible rounded intervals such as 5, 10, 20 or larger steps as space/range requires.
- Reduce intermediate label density before allowing collisions.
- Exact health remains available in the main number even where ticks are sparse.
- Do not show a finite floor label while silently clipping more extreme values; enlarge/recalculate the range coherently.
- Separate tick-label thinning from scale calculation; omitting a label must not move the mapped value.

### 11.5 Scale lifecycle

Provisional default: determine the necessary range from a complete resolution snapshot, transition to it before contribution motion, and freeze it throughout damage/healing/overheal. Both bars change mapping together.

Whether to retain an expanded range after settling, contract at a later boundary or use hysteresis remains open. Avoid oscillation near thresholds. Never rescale continuously because each animation frame changes the current value.

On resize/breakpoint crossing, preserve logical sequence progress where practical. If that cannot be supported safely, settle to authoritative state; do not replay damage because the orientation changed.

## 12. Health bars — Rendering and animation contract

### 12.1 Layers

Use one shared logical animation model with orientation-specific rendering. A practical presentation decomposition is:

1. Track and maximum-health extent.
2. White health fill for the displayed positive-health portion.
3. Red damage segment/movement.
4. Green healing segment/movement, including approved surplus treatment.
5. Zero marker, shared legend and any scale-break/cap markers.
6. Exact numerical health/net display, coordinated with the sequence.

The layers are presentation components, not a new authoritative game engine. Keep bar geometry, scale calculation and lifecycle ownership separable so tuning one does not require rewriting the others.

### 12.2 Semantic stages

The labels below describe states, not mandatory code identifiers:

| Stage | Visual purpose | Exit condition |
| --- | --- | --- |
| Settled start | Establish previous health and applicable maximum. | Valid new live resolution accepted once. |
| Scale preparation | Establish shared domain/legend without inventing a health change. | Mapping ready. |
| Damage reveal/movement | Show red contribution and reduce displayed position toward `start − damage`. | Damage stage complete or absent. |
| Damage clearance | Clear the approved red trail/segment and preserve zero continuity. | Ready for healing; may overlap only as reviewed. |
| Healing reveal/movement | Show green recovery from damage-stage position toward final health. | Reaches authoritative cap/final position. |
| Surplus healing completion | Express unused healing within the approved track treatment without increasing white fill beyond cap. | Surplus presentation complete or absent. |
| Settle | Clear transient colours and display authoritative final state. | Coordinated end-of-turn handoff. |
| Terminal settled | Show final loss/draw/narrow-victory treatment using authoritative outcome. | Normal finished-game navigation. |

One resolved update may contain several visual stages. Skip irrelevant stages for zero damage/healing; do not force empty delays. Both players share stage boundaries so the comparison remains readable even if only one has a contribution.

### 12.3 Negative values and outcomes

Preserve the visible zero reference when motion crosses below zero. Positive white fill should not imply stored negative health. Transient red/green geometry must make below-zero movement understandable.

Defeat/victory feedback happens only at the appropriate settled terminal stage, using canonical outcome. Both players can finish below zero under existing result rules; never decide the winner from a simplistic `health > 0` display check. Non-health finishes must not invent a damage volley.

### 12.4 Overheal

- White health fill stops at the player's authoritative maximum.
- Gross healing remains visible in totals/breakdowns, subject to existing semantics.
- Surplus animation stays within the approved track treatment; it does not create temporary stored health above the cap or stretch the positive legend to raw healing totals.
- Starting at full health with healing, damage followed by excess healing, and increased-cap cases need explicit reviewed sequences.
- The final visual state is exact authoritative health with transient colour cleared.

The supplied sheet proposes a green sweep/clearance within a full white bar. Its exact geometry and timing remain reviewable in 20B.3–20B.4.

### 12.5 Numerical health and net delta

Choose explicitly whether the main health number follows the temporary damage/healing position or remains settled until the final transition. The designs establish bar motion more fully than numerical-counter behaviour. This decision must be confirmed before integration; do not leave the existing independent number animation running by accident.

The persistent net delta is actual authoritative change, including clamping. It must not become gross healing minus damage in overheal cases. Preview/estimate changes do not trigger a resolved-health animation.

## 13. Timing, presentation lifecycle and recovery

### 13.1 Dedicated controller, existing lifecycle

Provide a dedicated health-bar presentation controller/hook with explicit stages, a captured immutable input snapshot and one configuration location for timing. Connect it to the existing end-of-turn lifecycle, keys and turn-start gates.

Do not create a second polling/subscription path. Do not advance authoritative phases from bar-rendering components. Reuse the existing continuation seam and keep networking in the runtime.

### 13.2 Tweakable parameters

The following should be centrally adjustable, with initial values settled during the animation pass:

| Parameter | Purpose |
| --- | --- |
| Scale preparation/transition | Time to establish the new shared mapping. |
| Damage reveal and travel | Red motion and health movement. |
| Damage pause/clear | Readability between contributions. |
| Healing reveal and travel | Green recovery. |
| Surplus-healing completion | Bounded feedback after cap arrival. |
| Final clearance/settle | Return to the stable bar. |
| Easing by stage | Shape movement without changing authoritative values. |
| Reduced-motion policy | Direct/shortened presentation with identical final data. |

Do not put unexplained timing literals into several components. Avoid duration proportional to every point of damage; extreme totals must not create extremely long turns. Evaluate elapsed time rather than assuming each frame/timer fires punctually.

### 13.3 Continuity rules

- Accept a live resolution identity once; polls and rerenders must not replay it.
- Capture both players' inputs together. Later VM updates must not alter an in-flight sequence's damage or cap.
- On game/viewer identity change, cancel old presentation and initialise the correct state.
- Initial load or hard refresh normally shows settled authoritative state, not a replay of old damage. Confirm any deliberate exception in the pass plan.
- Missing a turn or resuming after a long background interval must not queue an unbounded replay backlog.
- Old callbacks must not overwrite a newer turn or another game.
- Resize/remount and desktop/mobile switches must not trigger another resolution, sound or outcome announcement.
- Terminal resolution must complete its approved presentation before the existing finished-game handoff, without leaving the game stuck behind an animation.
- Animation disabled/reduced-motion modes must still release the existing lifecycle correctly.

### 13.4 Existing clocks, holds and other effects

Preserve clock authority and pause semantics. Animation cannot earn players extra decision time or block an opponent according to whether a local preference is enabled.

Audit existing turn-resolution overlay, Health Flash, health-number animation, sounds, fleet activations and next-dice timing. Decide which coexist, which need coordination and which are replaced. Do not layer every old and new effect indiscriminately.

Renaming Health Flash to Battle Effects, tying bar motion to it or adding a separate preference remains open. Bar information should remain available even if motion is disabled; the exact control policy is owner-reviewed.

## 14. Phase 20B — Health Bars passes

### 20B.1 — Resolution snapshot and data continuity

**Type:** Client/UI Pass by default; separate Server Pass or explicitly approved Mixed Pass only if needed. **Dependency:** Phase A accepted.

**Goal:** Supply coherent, reusable authoritative facts for the presentation sequence across supported update paths.

**Expected client scope:** `useGameSession.ts`, `gameSession/types.ts`, current resolved-history/selection helpers, `clienteffects/useEndOfTurnPresentation.ts` and focused adjacent pure helpers.

**Work:** audit live/poll/history/terminal paths; recover starting health correctly; preserve identity/orientation; define sparse-history fallback; confirm current maximum changes and fleet-value data if still relevant.

**Conditional server scope:** only existing resolution/history/projection seams proven insufficient, with a separately reviewed file plan and compatibility tests. No new gameplay resolution logic.

**Acceptance:** scenarios in Appendix C produce coherent inputs; overheal recovery is correct; duplicate/polling paths identify the same resolution; historical missing data settles safely. No hidden projections leak.

### 20B.2 — Shared scale and legend calculations

**Type:** Client/UI Pass. **Dependency:** semantic snapshot and reviewed responsive scale rules.

**Goal:** Implement pure scale/tick calculations shared by both bars and orientations.

**Expected scope:** new focused health-bar presentation/scale helpers in display or runtime presentation ownership as appropriate; reference existing stats helpers without changing graph behaviour unintentionally.

**Work:** default positive range, increased caps, per-breakpoint positive-space protection, negative compression threshold, rounded ticks, label thinning and scale retention policy.

**Acceptance:** mapping is monotonic, consistent for both players and exact at zero/caps; −300 does not squash positive health beyond its approved minimum; labels do not dictate geometry. Focused numerical tests cover threshold/extreme cases.

### 20B.3 — Atomic bars and legend rendering

**Type:** Client/UI Pass. **Dependency:** 20B.2 and reviewed bar appearance.

**Goal:** Render vertical/horizontal bars from explicit presentation state, without owning resolution scheduling.

**Expected scope:** new local bar/segment/legend components and approved existing styling locations; placeholder replacement seams only.

**Work:** tracks, fill, red/green overlays, zero/cap markers, differing maximums, compressed negative cue and surplus-healing visual treatment. Support inspection of named states in the existing suitable development surface if agreed; do not build a new framework.

**Acceptance:** individual supplied animation-sheet states are representable at intended dimensions; values are not clipped or misleading; no timers/networking/rule calculations inside the atomic renderer.

### 20B.4 — Dedicated multi-stage animation controller

**Type:** Client/UI Pass. **Dependency:** 20B.1–20B.3 and reviewed stage/timing decisions.

**Goal:** Turn one resolved snapshot into a bounded, cancellable and coordinated sequence.

**Expected scope:** dedicated presentation controller/hook, central timing configuration and existing end-of-turn hook integration. Avoid broad `useGameSession.ts` restructuring.

**Work:** stage transitions, both-player coordination, no-op skipping, immutable snapshots, cancellation, progress, disabled/reduced motion and terminal completion signalling.

**Acceptance:** one sequence per identity; identical logical stages for both orientations; deterministic time-based transitions; extreme values do not extend turns indefinitely. Tests cover skips, interruption, duplicates and terminal completion.

### 20B.5 — Desktop live integration

**Type:** Client/UI Pass. **Dependency:** controller and atomic rendering complete.

**Goal:** Activate desktop bars and coordinate the desktop health numbers/overlays with the existing phase presentation.

**Expected scope:** `BoardStage.tsx`, direct parent props, existing health presentation consumers and new bar components.

**Acceptance:** live contributions and final health agree; no old/new counter competition; next dice, outcomes, popovers and fleet presentation follow the approved sequence. Mobile remains coherent until its integration pass.

### 20B.6 — Mobile live integration

**Type:** Client/UI Pass. **Dependency:** shared controller and reviewed mobile scale/layout.

**Goal:** Activate horizontal bars without another animation engine or dice change.

**Expected scope:** `MobileStatusRail.tsx`, direct mobile presentation props and shared bar/controller consumers.

**Acceptance:** the same resolution renders correctly horizontally; both bars/legend stay aligned; stats taps/popovers, clocks, existing dice/helpers and fleet interactions survive. Breakpoint transition does not replay the resolution.

### 20B.7 — Outcomes, lifecycle, preferences and tuning

**Type:** Client/UI Pass; a separate explicit Server/Mixed Pass if a proven timing-contract change is still required. **Dependency:** both live integrations.

**Goal:** Complete difficult cases and review the visual experience as a whole.

**Work:** overheal/full-health sequences, changing maximums, zero/negative and narrow-victory/draw finishes, non-health finishes, spectator ordering, sparse histories, reconnect/background tabs, resize, reduced motion/preferences and old-effect coordination.

**Acceptance:** Appendix C and the preservation matrix pass appropriate automated checks and owner runtime review; no replay loops, premature loss feedback or presentation deadlocks. Timing configuration and responsive decisions are documented for future tuning.

## 15. Validation and owner review

### 15.1 Automated checks

Use the live repository's actual scripts/configuration. Run relevant existing client/display tests and appropriate typecheck/build checks for affected passes. Server checks/tests are required only when server work occurs, using the repository's established commands.

Meaningful focused new tests are warranted for cross-player metric mapping, shared tab state where nontrivial, recovered health snapshots, scale mathematics, animation transitions and continuity. Do not create tests that merely assert CSS strings or duplicate reversible layout implementation.

Pure tests can verify data/state transitions; they cannot prove visual fidelity, responsive fit, hover placement or good animation pacing.

### 15.2 Runtime verification belongs to Judd unless explicitly requested otherwise

Follow `CodexPassTemplate.md`: Codex should not start Vite, perform browser/Playwright/manual runtime testing or claim it inspected mobile/desktop motion unless explicitly requested for that pass.

Report runtime validation as: `Not run — browser/Vite testing handled by user`.

For each pass, give a concise owner checklist focused on changes and likely regressions, rather than asking the owner to retest every feature after every small extraction.

### 15.3 Representative review matrix

| Category | Representative cases |
| --- | --- |
| Display fit | Approved wide/intermediate desktop; 360px mobile reference; other owner-required mobile widths; short heights. |
| Players | Each species, mirrors, mixed matchups; requester/spectator order. |
| Headers | Long names/statuses, disconnect/reconnect, timed/untimed, ready/submitting/waiting. |
| Helpers | No helper, LEV, KNO, 1–3 CHR rolls, Cube entries/highlighting and actual selected two-slot combinations. |
| Economy | Ordinary/even/joining categories, saved joining lines, streak bonus and long source lists. |
| Estimates | Drawing private draft; incomplete opponent information; Dice Roll `?`; charge selection; manual Solar plus Autocast; resolved last-turn inspection. |
| Bars | Appendix C cases; unequal caps; split scale; sparse ticks; both orientations. |
| Lifecycle | Setup/intros, normal transition, health finish, non-health finish, refresh, history recovery, background/resume, resize. |
| Interaction | Targeting, catalogue/ship hover, popover tabs/dismissal, chat/draw offer, menus/takeovers, postgame stats and rematch. |

No single screenshot or all-passing unit suite establishes that the entire matrix passed. Report actual coverage and remaining items honestly.

## 16. Decisions and unresolved details

This register is part of the plan and should be updated as passes are approved.

| ID | Topic | Initial status / decision | Settle by |
| --- | --- | --- | --- |
| D01 | Phase order | Locked: 20A first; placeholders allowed; active bars in 20B. | Established |
| D02 | Pixel calibration | Open: received extra-dice raster is 2048px wide; owner original is reported as 2241px. Intended CSS viewport/export scale not yet confirmed. | 20A.1–20A.2 measurements |
| D03 | Responsive rules | Open: further owner requirements expected; current 767/768/1599 boundaries are baseline facts only. | Each affected layout pass |
| D04 | Header and omitted elements | Target direction established; exact species/clock/status/intro variants need inventory and pass design. | 20A.1–20A.2 |
| D05 | Fleet Value | Proposed inclusion; exact placement, compact label, source and visibility must be reviewed. | 20A.4–20A.6 |
| D06 | Shared mobile time tabs | Intended direction: one period selection controls both cards. Reset/rollover/endgame policy provisional. | 20A.6 |
| D07 | Desktop last-turn inspection | Preserve access; exact interaction/anchor remains reviewable. | 20A.4 |
| D08 | Helper placement | Relocation approved; existing selection preserved; exact cluster geometry subject to current designs. | 20A.3 |
| D09 | Server extension | Conditional, not presumed necessary. | 20B.1 |
| D10 | Positive-space clamp | Required concept; pixels/fraction per breakpoint and increased-cap behaviour need specification. | 20B.2 |
| D11 | Negative compression | Required only when needed; threshold, tick steps and scale-break appearance provisional. | 20B.2–20B.3 |
| D12 | Scale retention | Open: when/how to contract after a large turn and any hysteresis. | 20B.2 |
| D13 | Counter behaviour | Open: main number follows intermediate values or transitions to final separately. | Before 20B.5 |
| D14 | Overheal | Cap white fill; do not expand positive range for surplus. Exact green sweep/clearance provisional. | 20B.3–20B.4 |
| D15 | Animation timings | Open: named settings and bounded whole sequence; agree with existing hold/next-dice lifecycle. | 20B.4 |
| D16 | Preferences | Open: Health Flash, Battle Effects name, bar-motion switch, reduced-motion and existing sound coordination. | 20B.4–20B.7 |
| D17 | Outcome markers | Preserve canonical outcomes; exact loss/draw/narrow-victory styling provisional. | 20B.3/20B.7 |
| D18 | Placeholder treatment | Static/non-active; exact drawn fill and legend treatment owner-reviewed. | 20A.2/20A.5 |

Additional discovered requirements should be added here with their affected pass. A later approved pass plan may supersede an entry at Judd's discretion.

## 17. Completion criteria

### Phase 20A complete

- Desktop layout and header reorganised and owner-reviewed.
- Desktop die/helpers moved with behaviour retained; mobile die unchanged.
- Stats grouped correctly by affected health pool; all current/last and economy detail remains accessible.
- Mobile layout/popovers and shared time selection implemented and reviewed.
- Placeholders reserve accepted bar geometry without active sequences.
- Further responsive requirements relevant to Phase A are incorporated.
- Current conditional features and live post-ZIP fixes remain intact.

### Phase 20B complete

- Coherent authoritative resolution inputs available without duplicated rule authority.
- Shared legend handles increased caps, negative excursions and protected positive space.
- Both orientations render the approved damage/healing/overheal sequence.
- Animation controller has explicit states and centrally tweakable timings.
- Exact health/outcomes remain authoritative; estimates never trigger actual damage sequences.
- Existing clocks, holds, next dice, intros and finished-game transitions remain correct.
- Missing data, reloads and interruptions settle safely; duplicates do not replay.
- Preferences and old/new effect coordination have an explicit approved policy.
- Relevant automated checks and Judd's runtime/design reviews are recorded.

---

## Appendix A — Design references and image calibration

### A.1 Received references

| Reference | Received pixels | Purpose |
| --- | --- | --- |
| `image(20261020-235222).png` | 2048 × 1167 | Desktop layout with extra helper dice. |
| `image(20261020-235227).png` | 2048 × 1141 | Desktop stats/hover organisation. |
| `image(20261020-235238).png` | 1413 × 2048 | Health-bar animation/state sheet, legend and overheal explorations. |
| `image(20261020-235250).png` | 360 × 800 | Populated mobile board and horizontal bars. |
| `image(20261020-235259).png` | 360 × 800 | Mobile paired popovers and time tabs. |
| `EXISTING UI.png` | 2047 × 1042 | Current rendered UI reference; not the new target. |

References are supplied during review; these filenames identify them and do not imply the images already exist in the repository. Judd will show Codex the appropriate designs at each step. Keep later revisions identifiable instead of mixing conflicting versions.

### A.2 Calibration contract

The extra-dice file here is 2048px wide. Judd reports 2241px for the original. The ratio is approximately 1.094, not 1.5. Do not assert an upload/export cause without evidence and do not solve a font discrepancy with a blanket multiplier.

Until the intended CSS viewport/export relationship is known:

- Raster dimensions are reference-image facts only.
- Existing code values are reliable baseline CSS facts.
- Target CSS dimensions are explicitly proposed and owner-reviewable.
- Compare like-for-like viewport sizes when Judd supplies runtime screenshots.
- A design not showing all content does not define the empty space as a permanently fixed fleet area.

## Appendix B — Initial visual specification

This appendix makes the spec concrete while preventing unverified measurements from becoming accidental requirements. Values marked P or R are reviewable. It is expected to be refined with each pass's supplied designs and responsive requirements.

**Codes:** E = existing CSS in `1020.zip`; R = approximate raster measurement from named reference; P = proposed initial CSS value; O = open.

### B.1 Existing CSS anchors

| Element | Value / baseline | Class | Notes |
| --- | --- | --- | --- |
| Mobile selector | ≤767px | E | Existing media-query threshold; not permission to change breakpoint policy. |
| Intermediate desktop styling | 768–1599px | E | Existing targeted overrides. |
| Desktop outer horizontal padding | 30px; 16px intermediate | E | `GameScreen.tsx`. |
| Desktop left-rail width | 290px | E | Check all visibility/parent rules before altering. |
| Brand type | 45px/45px; 40px/40px intermediate | E | Existing font-size/line-height. |
| Centre stats column | 230px; 200px intermediate | E | Existing `BoardStage.tsx` width. Target may differ. |
| Desktop health number | 64px/64px; 56px/56px intermediate | E | Preserve until target typography is calibrated. |
| Desktop net delta | 28px/28px | E | Existing health display. |
| Standard desktop metric | 36px/36px; 30px/30px intermediate | E | New hierarchy may use smaller proposed values. |
| Desktop helper die | 60px square | E | Existing helper rendering. |
| Desktop helper source graphic | 52px square | E | Existing helper rendering. |
| Intermediate desktop main die | 140px square override | E | Shared primitive supplies its other existing dimensions. |
| Mobile main die | 52px square in a 56px-wide column | E | Keep mobile behaviour/placement. |
| Mobile helper dice/graphics | 22px square | E | Keep existing helper component. |
| Mobile health | 26px/26px | E | `MobileStatusRail.tsx`. |
| Mobile net delta | 15px/16px | E | Font-size/line-height. |
| Mobile name | 17px/19px | E | Existing truncation and connection indicator. |
| Mobile status | 13px/16px | E | Existing tone mapping. |
| Mobile current / secondary stats | 15px / 10px | E | Exact target hierarchy reviewed separately. |
| Mobile popover viewport margin | 16px | E | Existing constant. |
| Mobile popover content padding | 16px horizontal, 12px vertical | E | Existing frames. |

### B.2 Desktop target geometry observations

Reference: `image(20261020-235222).png`, 2048 × 1167. Raster coordinates are approximate and describe this image, not every viewport.

| Element | Reference measurement | Class | Target CSS policy |
| --- | --- | --- | --- |
| Shared health axis | Near x=1165 | R | Centre within the main board after the left rail; not whole-window centre. |
| Bar tracks | About 26px wide, 402px high, starting near y=18 | R | Proposed starting width 24–26 CSS px only if calibration supports 1:1; height governed by reviewed layout. |
| Gap between tracks | About 72px including legend region | R | Preserve a readable central tick-label lane; exact gap O. |
| Health-number row | Near y=441–485 | R | Below bars; use E typography initially rather than reading glyph height as font-size. |
| Net-delta row | Near y=497–517 | R | Directly associated with its health number. |
| Main die visible box | About 134px square, near x=1099/y=538 | R | Review against existing Dice primitive; no compulsory 134px CSS assignment. |
| Helper dice visible boxes | About 50px square | R | Do not overwrite existing 60px helper sizing solely from a potentially scaled export. |
| Saved/bonus region | Beneath die, around y=695–771 | R | Content-driven rows accommodating Centaur/joining cases. |
| Lower action panel top | Near y=875 | R | Existing action-panel and viewport-height behaviour must govern final placement. |

Header arrangement follows the supplied design, but fixed x coordinates are inappropriate for long names and responsive widths. Use stable layout slots, sensible min/max constraints and existing full-name inspection behaviour where available. Specify actual overflow decisions in 20A.2.

### B.3 Provisional component-level starting values

These are deliberate proposals, not claimed pixel-perfect readings. Replace them with owner-approved values before the relevant implementation.

| Element | Initial proposal | Class | Review |
| --- | --- | --- | --- |
| Desktop bar track | Square-ended dark track, white fill, red/green transient layers | P | 20B.3; use existing palette tokens. |
| Desktop legend text | Start at 11–12 CSS px; fit labels by density, not blanket scaling | P | 20A.2/20B.2. |
| Desktop current contribution | Start at 28 CSS px, bold | P | 20A.4; compare with existing 36px metric and calibrated target. |
| Desktop last contribution | Start at 18 CSS px, reduced emphasis | P | 20A.4; keep sufficient contrast. |
| Desktop economy | Start at 28px primary values and 11–13px labels | P | 20A.4; test joining/even lines. |
| Desktop header text | Reuse current appropriate header components/sizes before making targeted changes | P | 20A.1/20A.2. |
| Fleet Value | Secondary row; purple where approved | P | Exact font/label/location O. |
| Hover headings/body | Reuse current typography where compatible | P | 20A.4; preserve source-row readability. |

### B.4 Mobile target reference

Reference: `image(20261020-235250).png`, 360 × 800. Treat as a 360px design reference, not proof of every supported width.

| Element | Reference observation / initial specification | Class |
| --- | --- | --- |
| Outer inset | 16px | R and E alignment |
| Status-band upper identity row | Around y=209 onward | R; placement depends on fleet container |
| Upper bar | Roughly x=16–272, y=254–266 | R |
| Shared legend | Between bars, around y=271–278 | R |
| Lower bar | Roughly x=16–272, y=285–297 | R |
| Bar thickness | Approximately 12px | R; proposed initial 12 CSS px if approved |
| Bar/legend width | Approximately 256px at this reference width | R; responsive available width, not global constant |
| Die/clock column | Existing 56px column and 52px die | E; preserve functional placement |
| Requester identity row | Below bars, around y=306 onward | R |
| Bottom Ready button | Approximately 328px wide with 16px side insets in reference | R; preserve existing interaction and responsive controls |
| Top fleet / bottom fleet | Real stack content above/below status band | Required placement; heights not locked by screenshot |

For negative values, horizontal zero must be allowed to move within the scale while positive space remains protected. Do not fix the white-fill origin permanently to the far-left edge when negative space is present.

### B.5 Mobile inspection target

Reference: `image(20261020-235259).png`, 360 × 800.

| Element | Initial specification | Class |
| --- | --- | --- |
| Card width | Available viewport minus 16px margins; about 328px at reference | E/R |
| Card placement | Opponent card above its row, requester card below its row, collision-clamped | Target; exact available-height policy O |
| Card padding | Start from existing 16px horizontal / 12px vertical | E/P |
| Card corners/border | Existing restrained dark popover treatment | P; match supplied design |
| Economy header | Two columns; saved/Fleet Value and bonus sources | Target; exact row wrap O |
| Time tabs | Single shared selected period; visible controls in both cards | Target |
| Battle detail | Incoming red contribution and own green contribution, two columns | Target |
| Detail text | Start around 11–12 CSS px with existing family and source-row weights | P; review readability/long names |
| Totals | Aligned at row ends; preserve approx/concealment metadata | Required semantics |
| Height | Content/available-space driven, not the exact mockup card height | Required constraint |

### B.6 Responsive values intentionally not invented

Exact bar heights, narrow-desktop rail widths, header stacking, protected positive pixel spans, compression thresholds and additional phone/tablet rules remain open. Each affected pass must receive the relevant owner requirements and turn them into an explicit table before implementation.

---

## Appendix C — Worked resolution scenarios

These scenarios are illustrative presentation fixtures, not balance changes or a substitute for canonical finish rules. `D` is damage taken; `H` is gross healing received. Clamp final health to the authoritative maximum only, as in the current resolver.

| Scenario | Start / cap | D / H | Damage-stage position | Raw end → final | Actual net | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| No contribution | 25 / 35 | 0 / 0 | 25 | 25 → 25 | 0 | No empty dramatic sequence. |
| Damage only | 25 / 35 | 4 / 0 | 21 | 21 → 21 | −4 | Basic red movement. |
| Healing only | 14 / 35 | 0 / 15 | 14 | 29 → 29 | +15 | Basic green movement. |
| Both, positive throughout | 25 / 35 | 12 / 6 | 13 | 19 → 19 | −6 | Two contributions, modest final loss. |
| Below zero then recovery | 25 / 35 | 85 / 83 | −60 | 23 → 23 | −2 | Large battle hidden by small net. |
| Net zero with large contributions | 25 / 35 | 85 / 85 | −60 | 25 → 25 | 0 | Animate meaningful contributions despite zero net. |
| Extreme damage and overheal | 35 / 35 | 200 / 299 | −165 | 134 → 35 | 0 | Split scale and capped white fill. |
| Already full, healing only | 35 / 35 | 0 / 20 | 35 | 55 → 35 | 0 | Surplus feedback without fabricated health. |
| Increased maximum | 35 / 50 | 0 / 20 | 35 | 55 → 50 | +15 | Actual cap change distinct from surplus. |
| Final below zero | 12 / 35 | 30 / 5 | −18 | −13 → −13 | −25 | Recover some health but finish negative. |
| Exact zero | 12 / 35 | 20 / 8 | −8 | 0 → 0 | −12 | Zero marker and canonical outcome handling. |

Additional paired fixtures:

- Different player maximums with the same shared mapping.
- Both final health values negative, using the server's actual narrow-victory/draw outcome.
- One player has no contributions while the other has the full sequence.
- A maximum change with no ordinary health change; preserve its separate presentation meaning.
- Missing prior history, missing breakdown rows and older schema values: settle safely.
- Same resolution delivered through intent response then polling: no duplicate animation.
- New game, spectator orientation change or resize midway through healing: no stale completion write.
- Background tab resumes beyond the intended sequence duration: reach final state without replay backlog.
- Current estimate changes before resolution: do not launch actual damage/healing animation.

## Appendix D — Individual pass brief template

Use the live `src/documentation/workflows/CodexPassTemplate.md`; this supplement makes Phase 20 expectations explicit.

```text
Pass: Phase 20A.N / 20B.N — [name]
Pass type: Client/UI / Server / explicitly approved Mixed

Goal:
[One reviewable result.]

Current authority and designs:
- Phase 20 main plan, with these approved amendments: [...]
- Designs supplied for this pass: [...]
- Responsive ranges and CSS-size calibration: [...]

Inspect first:
- Live instructions/contracts/template.
- Current components, VM inputs, conditionals, consumers and tests.
- Features absent from the mockup that must be preserved.

File plan:
- Exact files and purpose of each edit.
- Any new presentation component and why extraction is useful.

Preserved behaviour:
- [Specific affected items from the preservation matrix.]

Proposed changes:
- [Containers.]
- [Atomic rendering / typography / interactions.]
- [Runtime snapshot or lifecycle work, if applicable.]

Out of scope:
- [Rules, networking, config, unrelated components and later passes.]

Open details:
- [Only material decisions relevant to this pass; preserve safe defaults elsewhere.]

Validation:
- Relevant existing automated checks and meaningful focused tests.
- Not run — browser/Vite testing handled by user, unless explicitly requested.
- Short owner review checklist.

Completion report:
- Files changed, behaviour changed and behaviour preserved.
- Checks actually run and their results.
- Known gaps, design assumptions and main-plan amendments.
```

The goal is careful progress through reviewed increments. The plan must support Judd's evolving designs while keeping the game working at every stage.
