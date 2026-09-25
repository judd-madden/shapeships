# Phase 18 — Live Battle Log and “This Turn” Stats

## Normative Planning and Pass-Decomposition Document

- **Status:** Planning; no Phase 18 implementation has begun in the live repository inspected 2026-09-24
- **Phase type:** Live battle presentation and server-calculated estimates; not a new gameplay phase
- **Primary scope:** A viewer-safe live current-turn Battle Log; estimated and resolved current-turn damage/healing; paired desktop and mobile stat presentation
- **Architecture baseline:** Server-authoritative Shapeships after the Phase 14 phase simplification, Phase 16 head polling, and current Phase 7 Battle Log / Phase 12 stats implementations
- **Code baseline inspected:** Current live repository on 2026-09-24; the supplied `0918-root.zip` remains a useful older snapshot only. Recheck live code at the start of every pass.
- **Design references:** Battle Log sequence, paired desktop stats sequence, paired mobile stats sequence, and corrected turn-resolution mockup supplied 2026-09-24. These lock behavior and grouping described below; their numbers and ship examples are illustrative, not rules or fixtures.
- **Implementation model:** Seven separately planned, separately reviewed passes, 18A–18G. Codex inspects the live repository and presents a concrete file plan before editing each pass; Judd reviews its plan and result.

If a later approved product decision changes this document, update the relevant contract before implementing a conflicting pass.

---

## Contents

1. Status, source precedence, and working method
2. Purpose, scope, and non-goals
3. Locked player-facing behavior
4. Current repository baseline and ownership
5. Current-turn Battle Log contract
6. “This Turn” estimate semantics
7. Server preview calculation and read-only request
8. Visibility and DTO contract
9. Client runtime and asynchronous behavior
10. Desktop and mobile presentation gates
11. Recommended implementation sequence: 18A–18G
12. Validation and example scenarios
13. Risks and review decisions
14. Completion criteria

---

# 1. Status, source precedence, and working method

## 1.1 Planning status

This is the normative product and implementation roadmap for Phase 18. It authorizes no changes to gameplay damage, healing, charges, phases, or ship definitions.

The supplied ZIP is an analysis snapshot, not the live repository. All candidate paths and functions below must be rechecked by Codex against the live code before its file plan for the relevant pass.

The seven passes are boundaries for review. Do not silently combine server and client changes into a mixed pass. Each pass should identify its allowed files, explicitly exclude neighboring work, run relevant checks, and report what was and was not validated.

## 1.2 Source precedence

For the new Phase 18 **product behavior**, use:

1. Judd’s subsequent explicit decisions and detailed visual specifications.
2. The locked behavior in this document.
3. The supplied mockups for layout direction and example content.

For **existing game rules and implementation facts**, use:

1. Current executable live server rules, state/route contracts, and ship definitions.
2. Current repository `AGENTS.md`, canonical handoff, ownership map, and pass template.
3. Current client/display code and existing tests.
4. Phase 7 Battle Log Server Contract, Phase 12 Stats, and Phases 13–17 for relevant historical intent.

Do not overwrite executable rules with an illustrative number, ship count, or ship combination from a mockup. For example, `13` and its pictured breakdown describe only that illustrated state; all values must come from current executable rules.

## 1.3 Working method and design checkpoints

Codex plans and implements **one pass at a time on the live codebase**. Before each pass it reads the applicable architecture and agent files, inspects current source, proposes a narrow file plan, and allows review. After implementation it reports changed files, tests, and remaining risks.

**Visual-spec reminder:** Before starting **18E** (Battle Log display), **18F** (desktop/responsive stats), and **18G** (mobile stats), ask Judd for the detailed visual specification for that surface. The mockups alone are insufficient to lock exact widths, gaps, typography, scroll positioning, popover sizing, hover/focus interaction, or responsive behavior. Record the supplied values in that pass’s reviewed file plan.

This is a planned review checkpoint, not permission to improvise layout or to block the earlier server passes.

---

# 2. Purpose, scope, and non-goals

## 2.1 Purpose

From the start of each turn, the Battle Log should show a live account of publicly displayable dice/build events, current builds, and later public battle actions. Alongside it, the board should pair each player’s current damage/healing estimate or resolved actual with the previous completed turn’s authoritative values. The opponent’s hidden build and current estimates become visible only when the existing barriers allow them.

The feature should make a live build understandable while preserving simultaneous hidden builds and the server’s authority over all combat.

## 2.2 In scope

- A grey live **This Turn** section at the start of the existing Battle Log scroll content, above completed turns.
- Requester-only own draft/build rows during Drawing, plus viewer-safe public dice/build events and produced builds as they occur; opponent build hidden until Reveal.
- The same live section with revealed builds and public First Strike, charge, and other captured battle actions after their existing visibility barriers open.
- Server-calculated estimated damage and healing, with grouped breakdown rows.
- A small, authenticated, read-only build-preview request for the initial empty eligible draft and later settled draft/context changes.
- Frozen own preview after submission and two-sided estimates after reveal.
- Clear estimated/hidden/pending/resolved-hold/actual states and a turn-keyed rollover handoff.
- Desktop paired current/Last metrics with combined breakdown cards; mobile paired HUD metrics and phase-sensitive content in the existing two anchored popovers.
- A single **Final Turn** actual-results treatment when a game ends through a resolved final turn.
- Bounded recovery through the existing client networking owner when an expected completed-turn history row is delayed or a history fetch fails.
- Targeted tests for server privacy, calculation parity, lifecycle, and client request races.

## 2.3 Out of scope

- Combat rebalance, new ship powers, new charges, or altered healing/damage rules.
- New gameplay subphases or changes to BUILD_SUBMIT’s simultaneous reveal boundary.
- Server or client persistence of unsubmitted drafts. An unsubmitted draft may reset on browser refresh.
- An independent client damage/healing rules engine.
- Live charge prediction or a prediction of an opponent’s undisclosed choices.
- A historical Battle Log schema migration or rewrite of completed-turn archive behavior.
- A general DTO, persistence, polling, or networking redesign.
- Adding new generic rate-limiting infrastructure unless a measured issue demands a separate reviewed pass.
- A broad refactor of `IntentReducer.ts`, `resolvePhase.ts`, or `useGameSession.ts`.

---

# 3. Locked player-facing behavior

## 3.1 Battle Log before and after Reveal

From the start of every turn, including when no archived turns exist:

- Show a grey **This Turn** section immediately after the player-name header and before completed cards. It is the first item in the **same scrolling content** as history, not a separately pinned row. As it grows, it pushes archived turns down. Apply the same content and scroll rule in the mobile Battle Log takeover.
- Suppress the existing “battle is about to begin” empty message whenever the live section exists.
- During Drawing, overlay local manual ship choices immediately as the player clicks while the server preview catches up asynchronously. Include authoritative automatic/produced builds when captured, with source tags where the archive format provides them.
- Show publicly observable dice modifiers and other build-stage effects as they become public, using the archive’s established language and grouping where possible.
- Keep the opponent build concealed as `???` (or the later approved equivalent) before Reveal, even after that opponent submits. Do not expose hidden build, prelude, or simultaneous-choice information through row presence, timing, totals, status, or response shape.
- Once the local player submits, recover the frozen own rows from that authenticated player’s stored server submission, including after refresh while waiting.

At and after the simultaneous build reveal:

- Replace draft/committed projections with both authoritative build summaries, including reveal-produced ships.
- As First Strike, Charge Declaration, and later battle work becomes public, add the archive-style battle actions above the build summary. Simultaneous declarations remain absent until their existing visibility barrier opens.
- Preserve creation-event semantics: later produced builds append, while a ship subsequently consumed, upgraded, transferred, or destroyed is not subtracted from its earlier build record.
- Keep completed cards in their normal newest-first order. The live section is not an archived turn and does not increment `completedTurnCount`.

During an uninterrupted session, retain resolved live turn `N` through the existing end-of-turn presentation. If the matching authoritative archive card—with final health, die, public actions, and build history—arrives during that presentation, treat live `N` and archived `N` as alternatives and swap them once without duplication. On presentation release/turn rollover, show a fresh live section for `N+1`. If archive `N` is still missing, defer that completed card or show a safe turn-keyed pending presentation while the existing networking owner performs a bounded retry; never relabel cached live rows as an archive card or attach them to `N+1`.

A hard refresh does not promise to replay the transient live-`N` presentation from archive data. If the loaded authoritative state still carries the matching end-of-turn hold signal, render the supported held state. If it has already entered `N+1`, render fresh live `N+1` with turn `N` in Last stats and show archived `N` only when history supplies it. On surrender, timeout, or another terminal outcome without current-turn resolution, remove the unfinished **This Turn** section from the finished Battle Log; retain genuine completed cards only.

## 3.2 Paired current and Last damage/healing

- As soon as the authoritative state says a player is eligible to build in Drawing, request an estimate for the empty draft so their existing fleet can contribute a current value before the first click. While the player edits, update from the newest still-relevant server preview response.
- Recalculate when a relevant authoritative estimate input changes even if the draft payload is unchanged. An unchanged head poll or equivalent full-state refresh is not such a change and must not trigger another draft-preview request.
- Opponent numbers remain `?` before Reveal.
- After Reveal, both sides show estimates derived from the mutually visible state; subsequent public fleet changes may update them until resolution.
- During simultaneous Charge Declaration, freeze both estimates at the last mutually public battle snapshot. Do not reflect hidden charge choices or secondary consequences such as newly depleted Solar Grid healing. Once that privacy barrier ends, use newly public state if an estimate is still relevant; actual turn resolution replaces the estimate.
- On desktop and the compact mobile HUD, each player has a large current Damage value with a smaller, quieter **Last** value directly beneath it, and the same pairing for Healing. Health, Saved Lines, and Bonus Lines retain their established positions.
- Do not prefix resting board/HUD values with `~`. Put approximation treatment in estimated breakdown headings/totals, for example `THIS TURN (ESTIMATE) ~13` on desktop or `This turn damage ~13` on mobile.
- Hover/focus on a desktop player metric opens one combined card containing that metric’s This Turn and Last Turn breakdowns wherever each exists. This combined card carries the estimate cue and any concise uncertainty copy; do not add a redundant standalone information-tooltip system.
- The estimate is **generated damage/healing**, consistent with current Last Turn breakdown semantics. It is not predicted health loss, final net health, or healing after a health-cap clamp.
- Use a prominent `0` for a calculated zero, `?` for concealed opponent current data, and a distinct pending/unavailable presentation when no valid current estimate exists. The smaller Last slot continues to show the previous authoritative value.
- Charges and Solar casts made or declared for the battle do not appear in the estimate. Their resulting damage/healing appears in the actual Last Turn/Final Turn results.

## 3.3 Resolution hold, rollover, and Final Turn

Before resolution, the smaller Last slots show the authoritative previous completed turn. When authoritative resolution for current turn `N` becomes available:

- replace the large current estimates with actual damage/healing, including applicable charge effects;
- hold those actual current values and their **This Turn** breakdowns throughout the existing end-of-turn presentation;
- remove estimate language and `~` from the held breakdown (`THIS TURN 13`, not `THIS TURN (ESTIMATE) ~13`); and
- keep the smaller Last slots and Last breakdowns on turn `N-1` during that presentation.

Only when the presentation releases into turn `N+1` do turn `N` actuals move into the smaller Last slots. The large current slots then reset to the local player’s new estimate when available and `?` for a concealed opponent. During an uninterrupted session, an early `N+1` DTO must not overwrite the presentation-owned snapshot before release.

Hard-refresh recovery is deliberately weaker. Recreate a held display only when the newly loaded authoritative state itself proves the matching end-of-turn hold is still active. If the server has already entered `N+1`, show `N+1` normally with resolved `N` in Last; do not reconstruct or replay the transient hold from archived turns alone, and do not add persisted UI state merely to replay the presentation.

When an end-of-turn resolution **actually produces a terminal turn’s damage/healing**, the held current actual becomes one **Final Turn** set rather than rolling into a new-turn Last slot. Reuse the existing one-shot health-resolution presentation and authoritative totals/breakdowns. Show it in finished board stats and the existing mobile stat popovers where accessible; do not add a new Final Turn section to the post-game Stats takeover.

If the match ends through surrender, timeout, or another path **without resolving the current turn**, do not relabel an older completed turn as Final Turn. Hide an unresolved current estimate, remove the unfinished live **This Turn** Battle Log section, and retain only whatever completed history is actually supported by canonical state.

Use the canonical resolved-turn marker as primary evidence. Do not treat the presentation hold, delayed archive fetch, or terminal `status` by itself as proof that current-turn damage/healing resolved, and do not add another persisted final-turn flag without demonstrated need.

## 3.4 Mobile paired HUD and popovers

The live mobile UI already opens the two player-anchored popovers as a pair. Preserve simultaneous opening and independent top/bottom anchoring. The cards may cover Ready or other game controls; controls underneath do not need to remain usable while the pair is open. A tap on either popover or outside the pair dismisses both, while a scroll gesture that begins inside a popover scrolls its content without dismissing. Leave exact geometry, hit areas, and touch thresholds to the 18G visual-spec pass.

- The compact HUD shows each player’s current Damage and Healing with smaller Last values beneath. Prominent HUD values never use `~`.
- **Before Reveal:** the opponent popover shows Saved/Bonus and Last Turn breakdowns while its current HUD values remain `?`. The local popover shows Saved/Bonus, This Turn estimates, then Last Turn breakdowns.
- **After Reveal:** the opponent popover intentionally replaces its detailed Last Turn breakdowns with This Turn estimates; its smaller Last HUD values remain visible. The local popover continues to show Saved/Bonus, This Turn, then Last Turn.
- Put `~` only on estimated breakdown totals. Mobile may use labels such as “This turn damage” without spelling out `ESTIMATE`; desktop and mobile wording need not be identical.
- During the resolution hold, any shown This Turn breakdown becomes actual and loses `~`; Final Turn uses the terminal treatment from `3.3`.

---

# 4. Current repository baseline and ownership

## 4.1 Build and reveal are already distinct

`src/supabase/functions/server/engine/intent/IntentReducer.ts` handles `BUILD_SUBMIT` during `build.drawing`. The first submit stores a private commit/reveal payload and marks readiness. Only after **all active players submit** does `resolveBuildSubmitAuthoritatively` apply both builds and advance toward `battle.reveal`.

`src/supabase/functions/server/engine/intent/buildSubmitResolution.ts` constructs ships, consumes lines/components, handles configuration and production, and updates turn-scoped counters. It currently mutates its working state; it is not an existing read-only preview API.

`src/supabase/functions/server/engine/phase/onEnterPhase.ts` creates a real Reveal visibility hold. Reveal-time powers, notably Dreadnought Fighter production and Redemption’s direct health reset, can affect the situation before later combat actions.

## 4.2 The client already has a local fleet preview, not a combat preview

`src/game/client/gameSession/provisionalBuild.ts` projects a draft fleet and catalogue/economy state from local draft counts. This is useful for instant ship display but is not a complete combat evaluator. It does not provide every canonical per-instance/event fact needed for Dreadnought, Queen, consumed components, once-only memory, and all power effects.

`src/game/client/gameSession/intents.ts` builds the ordered `BUILD_SUBMIT` payload with counts, Frigate triggers, Quantum Mystic selections, and Evolver choices. Use the same choices for a preview request, but do not dispatch `BUILD_SUBMIT` until Ready.

The current client defaults new Frigate and Quantum selections to `1`, and current BUILD_SUBMIT validation accepts those existing semantics. Phase 18 preserves them. An incomplete preview means an actual structural inconsistency under current rules, not a control the player has not manually changed.

`src/game/client/useGameSession.ts` owns the draft buffer, current build preview, authoritative state acceptance, and board view model. Networking remains in the client runtime; display components do not send preview requests.

The unsubmitted draft is session-local client state; there is no draft persistence to recover after browser refresh. The server does retain an authenticated player’s submitted payload while that player waits for the opponent.

## 4.3 Polling cannot carry each draft

`src/game/client/gameSession/clienteffects/useNetworkingEffects.ts` currently polls compact `/game-state-head/:gameId` about every two seconds while active and performs a safety full `/game-state/:gameId` refresh after roughly 15 seconds even when the head has not materially changed. These are current implementation cadences, not Phase 18 latency or load promises; recheck them when measuring the server passes. Neither endpoint uploads draft edits.

Saving each draft to canonical state to make polling “see” it would add writes, revisions, and privacy hazards. Phase 18 adds an explicit small request for the initial empty eligible draft and later settled draft/context changes, with a direct response; it does **not** use polling as the draft transport or alter the persisted game-state head. A poll or safety refresh whose relevant authoritative context is unchanged must not trigger another preview POST.

After Reveal, two-sided estimates travel in the normal full-state response rather than the draft POST. The current safety refresh can therefore repeat a two-sided calculation without a relevant state change. Keep the head compact and estimate-free, and include repeated full-GET calculation cost in the 18B/18C performance gate. Hover cards, mobile popovers, and the live Battle Log consume runtime state and never initiate their own estimate requests.

## 4.4 Existing Battle Log and stats sources

`src/supabase/functions/server/engine/state/battleLogHistory.ts` already owns `BattleLogCurrentTurnCapture`, event folding, archive formatting, idempotent finalization, and `BattleLogTurnSummary`. The live capture stores the base die; KNO rerolls, CHR/CUB rolls, manual and produced builds; captured charge, destroy, steal, and Frigate-hit actions; and saved-resource snapshots. `formatBuildLines` and `formatBattleLines` establish grouping and language. Reuse these atoms and formatters rather than introducing a parallel live-event schema or generic renderer.

The demonstrated coverage gap is Ancient Solar battle presentation: `buildBattleLogTurnSummaryFromScratch` currently appends those lines from the final authoritative Solar ledger only while building the archive summary. At 18A, audit all archive-only inputs and choose the narrowest safe live seam: project an already-public ledger entry with the same formatter, or add a capture atom at the existing visibility-opening point. Do not broadly duplicate finalization and do not serialize `battleLogScratch` wholesale.

Before both BUILD_SUBMITs have been applied, scratch does not contain the first submitter’s manual builds. The first server Battle Log pass therefore projects only build events already present in authoritative capture. A later server preview/DTO pass derives committed-own rows from the requester’s stored payload through the isolated canonical build projector.

`src/game/client/gameSession/battleLog.ts` maps separately fetched completed history and already tokenizes archive build/battle language. `src/game/display/shared/BattleLogPanelContent.tsx` is shared by desktop and mobile; it keeps names outside one `LeftRailScrollArea`, which currently contains either archive cards or the empty message. Insert the live section as the first item in that existing scroll area. Do not add a second scroller or sticky/pinned region.

`src/supabase/functions/server/engine_shared/resolve/phaseComputedEffects.ts` collects count-based, tiered, once-only, dice-based, and opponent-sensitive power effects. `resolvePhase.ts` gathers effects, applies Science Vessel modifiers, records breakdown entries, and derives actual Last Turn totals; full turn resolution also performs destruction, health changes, and victory evaluation. The preview must reuse the relevant rules on isolated state without performing a real resolution.

`src/supabase/functions/server/routes/game_routes.ts` builds the full GET DTO, including public fleets and Last Turn stats plus requester breakdowns. `src/supabase/functions/server/routes/intent_routes.ts` separately sanitizes state and visibility-sensitive events and already removes `battleLogScratch`. New projection fields need a deliberate visibility contract on every response surface that carries them.

## 4.5 Display seams and layout constraints

`src/game/display/layout/BoardStage.tsx` owns the center stats placement. Its center column is 200px at intermediate desktop widths; the mobile layout begins only below the current 768px cutoff, and the root/fixed action-panel composition can clip content at short heights. The live component currently renders Last Damage/Healing before Bonus; 18F must deliberately restructure this wrapper to the locked Health, Saved Lines, Bonus Lines, paired Damage, paired Healing sequence rather than append more blocks.

`src/game/display/layout/boardStage/useBoardStatHover.tsx` and `BoardStatBreakdownHoverCard.tsx` already own metric hover state and cards. Extend that seam so one metric card can group current and Last sections; do not create a separate estimate-info tooltip system. The later display pass must verify keyboard/focus access, touch/click behavior where applicable, and viewport collision/clamping.

`src/game/display/mobile/MobileStatBreakdownPopovers.tsx` and `MobileGameLayout.tsx` already render both anchored cards together from one toggle and provide viewport-dependent heights and internal scrolling. Adapt their section builder and compact status-rail fields; do not replace them with independent modal/popover state.

`src/game/client/gameSession/clienteffects/useEndOfTurnPresentation.ts` and the `healthPresentationBoardOverride` path in `useGameSession.ts` already provide a turn-keyed one-shot health-resolution snapshot. They currently hold newly resolved totals through an early transition but do not preserve the previous Last values or paired breakdown rows. Extend this existing presentation owner for the resolved-current/previous-Last pair during an uninterrupted session.

The only current authoritative reload signal for that hold is the matching `phaseHold` tuple (`battle.end_of_turn_resolution`, `end_of_turn_health`, and `holdUntilMs`). The client already recognizes it, while current servers may clear it during auto-advance. On a fresh load, use that signal when it survives; otherwise accept the authoritative `N+1` state and do not infer or replay the transient hold from `analysisByPlayerId` or archive identity alone. Existing archive analysis remains usable for completed Last values and breakdowns, not as proof that a presentation is still active. Do not introduce a persisted UI store or final-turn flag.

`useGameSession.ts` currently fetches `/game-history/:gameId` once on initial load, turn change, or finish and does not retry a failed or incomplete expected result. The existing GET route already reconciles the private archive checkpoint through `appendBattleLogTurnSummaryIdempotently`. Extend that same client networking owner with a bounded, turn-keyed retry when authoritative state says completed turn `N` should exist but history omits it or the request fails; do not add a second fetch owner, history schema, or persistence mechanism.

---

# 5. Current-turn Battle Log contract

## 5.1 Live projection is separate from completed history

Define one small viewer-safe live-turn projection tied to `gameId + turnNumber`. It exposes already-public dice/build interventions, build summaries, and battle actions in the same section order used by an archived card, but it does not pretend to be a completed `BattleLogTurnSummary`. The completed-history response retains its existing `turns` and `completedTurnCount` meaning.

Suggested semantic shape, not a mandated TypeScript name:

```text
currentTurnBattleLog: {
  turnNumber,
  buildLinesByPlayerId,
  battleLinesByPlayerId,       // actions already public to this viewer
  concealedBuildPlayerIds,     // opponent build before Reveal
  sourceRevision
}
```

The exact DTO name is not mandated. Prefer archive-compatible formatted lines and the existing client tokenizer. Preserve capture order and authoritative event identity where it already exists. If capture atoms have no durable row ID, replace a section atomically by `gameId + turnNumber + sourceRevision` rather than inventing global event IDs or deduplicating solely by display text.

The server must derive live rows from capture/build facts, not the present fleet alone: an upgraded/consumed ship, a produced ship, and a newly built ship have different Battle Log meanings. Battle actions render above build rows, matching the archive.

The grey live section is the first child of the same desktop/mobile scroll content as completed cards. It is not sticky or pinned. When it exists, suppress the pre-battle empty-history message.

## 5.2 Source of instant draft rows

During Drawing, the client immediately overlays the local draft’s **manual** build choices while retaining requester-visible authoritative prelude, die-modifier, and produced-build rows. The next server preview response returns the canonical build projection for that exact draft, including legal/skipped attempts, production, configuration, and source tags.

The authoritative current-turn capture supplies only events that have actually occurred. Before both submissions resolve, committed manual rows are not reconstructed from scratch; the preview/DTO path projects the authenticated requester’s frozen stored submission on isolated state. After Reveal, captured authoritative rows supersede draft and committed-own projections.

The local manual overlay and returned canonical manual/build projection are alternatives for the same draft version, not additive lists; authoritative public capture rows remain separate. Otherwise a clicked or produced ship can appear twice.

Server-side settled/revealed rows override the local overlay. A rejected or stale preview must not invent completed builds.

Later capture may append produced builds and public battle actions. It does not remove an earlier creation row merely because that ship is later consumed, upgraded, transferred, or destroyed.

## 5.3 Visibility and lifecycle

Before Reveal, only the authenticated player receives own draft/committed build details. A spectator receives no private build side; a player cannot see the opponent through the preview endpoint, full GET, intent response, live-row shape, or timing. Submission status is allowed where already public but never implies build content. Public die/intervention rows may appear only after their existing simultaneous-choice barrier has resolved.

After Reveal, both players’ authoritative build rows are public to authorized viewers. Add First Strike, charge, Solar, and other battle lines only once the underlying action is public under current server visibility rules. Raw capture timing is not permission to publish a row.

At resolution, use a turn-keyed handoff between the live projection, the archive finalization event/checkpoint, the separately fetched history row, and the existing presentation hold. During an uninterrupted presentation, cached live `N` and archived `N` are alternatives, never simultaneous duplicates. After release or on a fresh load already at `N+1`, do not treat cached or reconstructed live rows as completed `N`: show a turn-keyed pending state or defer card `N` until history supplies it. The existing client networking owner performs a bounded retry against the idempotent history route when expected `N` is absent or the request fails. Never attach `N` rows to live `N+1`.

Handle Drawing, Ready-waiting, Reveal hold, hidden declarations, uninterrupted resolution hold, hard refresh, terminal resolution, and archive-fetch lag as separate lifecycle cases. A terminal transition without current-turn resolution closes the unfinished live section immediately and produces neither archive `N` nor Final Turn stats.

---

# 6. “This Turn” estimate semantics

## 6.1 Definition

For a player `P`, `thisTurn.damage` is the current best estimate of **P’s generated damage against the opponent**, and `thisTurn.healing` is the estimate of **P’s generated healing/sustain** under the same breakdown conventions used by Last Turn.

During Drawing the inputs are:

- the server’s current public turn context and authoritative known own state;
- the player’s current draft choices—including the empty draft immediately upon build eligibility—applied on a temporary copy;
- the opponent fleet **already public to this player at this point**, not a newer hidden fleet;
- only deterministic, currently knowable effects that will be available at end-of-turn under these assumed inputs.

The estimate identity includes the game, turn, phase, applicable authoritative source revision/context, and normalized draft payload. The same payload must be recalculated when one of its relevant authoritative inputs changes; merely receiving another unchanged head/full-state read is not a new context.

After Reveal the inputs are the actually revealed current fleets and current mutually public battle state, with later public changes reflected when available. While simultaneous Charge Declaration privacy is active, the input remains the last mutually public snapshot from before hidden declarations began. Both players’ estimates freeze on that same snapshot until the barrier exits.

Estimate status and source phase must accompany the numbers. A server-computed estimate is still provisional because its *inputs* cannot predict later opponent actions or charge choices.

## 6.2 Effect inclusion rules

Reuse canonical definitions and effect math for:

- automatic damage/healing from the assumed fleet;
- applicable once-only effects of ships built this turn, including server build/event facts;
- dice-dependent effects using the effective per-player roll already determined by the game;
- conditional effects with fully known inputs, e.g. Frigate’s configured trigger;
- Science Vessel adjustments, represented with breakdown rows that sum to the displayed total;
- reveal-produced Fighter contributions once deterministically known on the temporary build or actually present after Reveal;
- depleted Solar Grid’s ordinary automatic healing when depletion is already mutually public and part of the normal current combat rules;
- self-damage as a signed sustain/healing breakdown where the canonical Last Turn breakdown uses that convention.

Exclude:

- ordinary charged power uses and pending charge declarations;
- charged Solar consumption, manual Solar casts, and Autocast’s charged results, even if a related Reveal action has already happened;
- any secondary effect newly enabled by a hidden Charge Declaration choice, including newly depleted Solar Grid healing, until the privacy barrier exits;
- speculative First Strike, destruction, steal, Black Hole, or opponent build decisions;
- direct Reveal health resets such as Redemption as “healing”;
- capped/uncapped future net health guesses.

Do not obtain the estimate by reading the current `pendingTurn` total unfiltered; it may already contain charge or other effects excluded by this contract.

## 6.3 Nontrivial parity cases

The server calculation must retain per-instance creation turn, removed/void ship history, build-created counters, component consumption, and relevant own Reveal consequences where canonical powers inspect them. Notable tests include:

- same-turn once-only powers, including a source later consumed in an upgrade;
- Queen’s count of ships made this turn and exclusion of its own produced Xenites where current rules require it;
- multiple Dreadnoughts and the current per-instance consumed-component exclusion when Reveal creates Fighters;
- Redemption’s Reveal health reset as an input to later health-comparison effects, but never as generated healing;
- a mixed fleet with Tactical Cruiser type-count effects and Fighter damage;
- Science Vessel tier multipliers and adjustment rows;
- opponent-sensitive OXite/Asterite and health-comparison effects using only viewer-visible inputs;
- permanent Frigate/Quantum configurations and Evolver conversions;
- Ancient Solar depletion vs charge use;
- all four species and foreign/copied ship combinations when relevant.

Avoid manually reconstructing a ship’s effect from its display label. If an effect cannot be evaluated safely with allowed inputs, mark that part or the estimate unavailable rather than silently showing a fabricated exact-looking amount.

## 6.4 Stable totals and breakdown rows

The sum of estimate damage breakdown amounts equals displayed estimated damage; the sum of healing/sustain rows equals displayed estimated healing under the existing signed convention. Preserve actual existing row ordering, labels, grouping, and Science Vessel adjustment semantics where possible.

The current metric has an explicit source/status: estimated, privacy-frozen estimate, resolved actual, hidden, pending, or unavailable. The Last metric is always an authoritative completed-turn value. At resolution, use the authoritative actual totals and breakdowns; never cosmetically remove `~` from an estimate and call it actual.

Current actual `lastTurnDamageByPlayerId` is damage **received** by its keyed player. A This Turn player’s damage is damage **dealt to the other player**; map attacker and target correctly instead of reusing the target keyed field as if it meant dealt damage.

No estimate writes `lastTurn...` fields, modifies `powerMemory` on canonical state, creates real ships, spends lines/charges, sets readiness, advances phase, or changes health.

---

# 7. Server preview calculation and read-only request

## 7.1 Preferred request

Use one authenticated **read-only POST** for the initial empty eligible draft and later settled draft/context changes, for example `POST /build-preview/:gameId` registered in the existing game routes. A dedicated request is justified because the current head/full-state GETs do not upload drafts and `BUILD_SUBMIT` is a mutating final intent; neither can safely carry an unsubmitted advisory calculation. This is a small route on the existing auth/persistence stack, not a new networking subsystem. The exact path can be selected during the reviewed server route pass.

Input should contain the client-observed turn/phase/source-context identity and the same compact build choices later used by `BUILD_SUBMIT`: ship counts, Frigate triggers, Quantum Mystic selections, and Evolver choices; optionally an opaque client request token. The observed identity is for staleness checking, never authority; the server compares it with its canonical read and returns the actual source identity. Preserve the current default-`1` Frigate and Quantum behavior and existing BUILD_SUBMIT validation. Never accept a client-supplied player ID, opponent fleet, raw server state, or requested visibility level.

The endpoint validates the session, performs one canonical game read, derives identity from that session, checks player role, game status, turn, Drawing phase, prelude eligibility, and whether the player has already submitted, then calculates only on disposable state. Bound and validate payload size/counts and reject malformed or obsolete requests without modifying the game.

Do not call `prepareGameStateRead` naively from this POST. That helper applies clock maintenance and can perform a `conditionalUpdate` when its read discovers a timeout, which would violate the preview route’s read-only contract. In 18C, inspect whether to use a lower-level non-mutating canonical load or narrowly split a read-only preparation seam. If the loaded game is expired, terminal, changed, or otherwise no longer preview-eligible, return a safe unavailable/obsolete result and let the existing authoritative head/full-state/intent path perform terminal maintenance. The preview POST never persists that maintenance, changes the head, or stores a draft.

For an unsubmitted player, calculate only that player’s estimate and current-turn build projection. For a submitted player, use the frozen **stored own submission** and ignore/reject new editable drafts; normal full-state refresh may carry this frozen projection instead. Do not permit a spectator or the opponent to preview somebody else’s unsubmitted choices.

Response: only the requesting player’s current turn/version identity, estimate status, own damage/healing totals and rows, and own build rows needed for presentation. Existing full-state GETs remain the transport for viewer-safe live capture/public events and revealed estimates. Return no canonical state, hidden opponent counters, intermediate effect list, secret fleet, or opponent estimate before Reveal.

## 7.2 Single canonical simulation seam

Use one narrow estimator path rather than a second build or combat engine:

1. Load the current game once and construct a viewer-safe state through the existing Charge Declaration and Drawing-prelude visibility projections.
2. Audit or explicitly reset/project non-fleet hidden inputs needed by effects, including production counters, removed/void history, power memory, capture internals, declaration state, and pending effects.
3. Clone that safe bounded state once. All mutation-oriented reuse happens only on this disposable clone.
4. Reuse or narrowly extract the canonical **per-player** build resolver and existing Drawing ship-creation consequences. Do not extend the resolver’s internal legality-lookahead simulations into a parallel preview builder.
5. Apply the relevant requester-owned Reveal consequences on the clone, preserving Dreadnought Fighter production and its consumed-component/self exclusions. Apply Redemption’s direct health reset only as an input to later known health comparisons; do not count it as healing.
6. Clear or isolate clone-local `pendingTurn`, collect only allowed requester-owned automatic/once-only Damage and Heal effects, apply the canonical modifiers, and reuse the existing grouped-breakdown rules.
7. Return only the compact projection and discard the clone.

Do not run the complete normal `resolveBattleEndOfTurn` in a GET/preview request. Preview calculation must not perform Black Hole destruction, aggregate health, victory evaluation, phase advancement, finalization, persistence, or mutation of canonical once-only memory. `applyEffects` may be used only after filtering to the allowed clone-local effects; it is not itself a visibility or inclusion filter.

The estimator evaluates only the requesting player’s relevant effects after constructing the safe opposing context. It must not calculate from the canonical opponent fleet and then remove an opponent field from the response: hidden fleet types, health, counters, charge choices, or memory can leak through the requester’s own totals.

## 7.3 Request frequency and failure behavior

The initial posture is one session validation, one canonical game read, and one isolated calculation per issued preview. Request the empty draft once when build eligibility first becomes current. Thereafter debounce settled edits using an illustrative initial target of roughly 150–300 ms and allow at most one preview request in flight per client. A cluster of clicks inside the settling window may coalesce into one request; clicks separated beyond it may issue separate requests.

If the draft or applicable authoritative context changes while a request is in flight, retain only the newest candidate. After the current request finishes, send that newest candidate if it is still eligible and differs by preview identity from the accepted/in-flight work. Discard every obsolete response. A browser abort may stop local response handling, but do not rely on it to save server calculation because the server may already be working.

Preview identity and duplicate suppression cover `gameId`, turn, phase, applicable authoritative source revision/context, and normalized payload—not payload alone. A relevant authoritative context change can therefore recalculate an identical draft, while an unchanged head poll or safety full refresh cannot. The client must not persist a draft or issue a fresh POST per poll, hover, popover open, or Battle Log open.

Heavy simulations and client requests should remain bounded; the small wire payload does not by itself guarantee low server CPU or database cost. Back off on failure/429 and give the player a non-misleading unavailable state; build and Ready must remain functional if this optional estimate fails.

Before 18D client rollout, 18B/18C must measure representative and complex late-game draft calculations and repeated two-sided post-Reveal full GET calculations. Report estimator calculation time separately from database-read time and total route time. Use those results to decide whether the simple calculate-on-request/full-GET approach is adequate. The debounce range, current polling cadences, anticipated request counts, and latency discussion are planning assumptions until measured. Any optimization, memoization, cache, limiter, or persistence change requires a separately reviewed decision based on those measurements.

The preview is advisory. `BUILD_SUBMIT` still independently validates and applies the submitted payload through the authoritative reducer.

---

# 8. Visibility and DTO contract

## 8.1 Before Reveal

Place authenticated requester-only current-build and estimate data under `requester`; this includes the player’s frozen own projection after submission. A compact draft preview POST response contains only that player’s own version. Put viewer-safe, already-public die/intervention/live-log rows under `publicState`. Public fields must not include opponent build details or either player’s private pre-Reveal estimates.

The existing public fleet path composes Charge Declaration and Drawing-prelude projections; `projectDrawingPreludeFleetsForViewer` returns the viewer’s fleet and the last public snapshot for the other side during Drawing. Treat these as **visibility policies**, not shortcuts for a full safe simulation state. Other canonical fields—current-turn production counters, removed ships, power memory, internal capture atoms, temporary declarations, and pending effects—must be audited or explicitly reset/projected before effect calculation.

No private output may appear in `publicState`, raw legacy `gameData`, intent response state/events, a spectator response, the history endpoint, or the persisted head. Phase 18 does not add fields to those raw/secondary surfaces by default. The existing history response remains authoritative for completed cards and its existing analysis may be reused for completed Last values and breakdowns, but not as proof that a transient resolution hold is active; do not add a second history schema for the live row. Test all relevant surfaces for absence as well as allowed presence.

## 8.2 At Reveal and afterward

Once the same existing all-submitted/reveal barrier is satisfied, `publicState` can include a two-sided public `thisTurn` estimate and two-sided current-turn live projection. This public version comes from revealed authoritative fleets/capture and is available to authorized spectators. Later battle rows are projected only when each action’s existing visibility barrier has opened. Changed-head and safety-refresh paths can both cause a full-state read; the latter may repeat the two-sided calculation with unchanged relevant state. The head itself stays compact and estimate-free.

If later **mutually public** fleet/state changes affect the calculation before resolution, a subsequent full-state refresh may revise the estimates and append newly public live-log actions. During simultaneous Charge Declaration, freeze both sides at the last mutually public pre-declaration snapshot; do not expose hidden declarations or secondary effects through totals, row presence, timing, status, availability, error shape, or build projection. After the barrier exits, use newly public state if an estimate remains relevant and publish allowed action rows. Still exclude charged effects from estimates by origin.

`intent_routes.ts` uses a separate sanitizer from `game_routes.ts`. Keep Phase 18 projections out of intent responses by default: preview data belongs in the compact POST response, requester-only/frozen data under `requester`, and mutually public revealed data under `publicState`. Refresh after an accepted submit; never pass new internal preview data through raw intent state by accident. Prefer the smallest route/module change justified by the live code.

## 8.3 After resolution and after terminal changes

The client must distinguish:

- **current unsubmitted / frozen / revealed estimate**, paired with previous Last;
- **resolved turn `N` hold**, with actual current `N` paired with previous Last `N-1`;
- **new turn `N+1`**, with prior actual `N` moved to Last and a reset current slot;
- **resolved terminal turn**, represented as one actual Final Turn set; and
- **terminal match without current-turn resolution**, which must not fabricate actuals.

Integrate these states with the existing one-shot health-resolution presentation. Use turn identity and the canonical resolved-turn marker as primary evidence—not merely `status === "finished"`—and preserve the presentation snapshot until its existing release during an uninterrupted session. Extend that ephemeral snapshot to include actual totals/breakdowns and the previous Last totals/breakdowns.

After a hard refresh, show the held pair only if the loaded authoritative state still exposes the matching `end_of_turn_health` phase hold. Archive analysis may supply completed totals/breakdowns, but it must not be used by itself to prove or replay a transient hold. If the loaded state is already `N+1`, render `N+1` with resolved `N` in Last. If expected archive `N` is delayed, keep only the archive card pending/deferred while bounded history retry runs; do not move the stats back to a held `N`, invent a cached live section, or add a persisted UI store. A terminal match without current-turn resolution has neither a held/Final Turn actual nor a live This Turn section.

---

# 9. Client runtime and asynchronous behavior

## 9.1 One payload path and one networking owner

Use a shared client helper to produce the build-choice payload for both preview and final `BUILD_SUBMIT` without weakening or changing final validation. Preserve the current default-`1` Frigate and Quantum selection behavior. An incomplete preview is unavailable only for an actual structural inconsistency under current rules, not because the player has not manually touched a defaulted control.

Networking lives under `src/game/client/**`, likely coordinated from `useGameSession.ts` with a small dedicated client runtime hook/helper if that improves isolation. The same owner already fetches completed Battle Log history and should own the bounded retry for an expected missing turn. `src/game/display/**` consumes the resulting view model and does not retry requests itself.

That runtime owner also issues the initial empty-draft preview when authoritative Drawing/build eligibility becomes active, observes relevant authoritative context changes, and coalesces later edits. Hover/focus cards, mobile popovers, and Battle Log components never fetch estimates directly.

Keep the existing instant local fleet preview for ship rendering and immediate own manual Battle Log updates. Server responses supply rule-heavy numbers, canonical build rows, and viewer-safe public capture rows. The client does **not** reconstruct damage/healing rules or infer public action timing locally.

Use one runtime-owned Phase 18 presentation model for the live log and paired metrics. It composes the local draft overlay, compact preview response, requester/public full-state projections, existing history, and the current end-of-turn presentation snapshot. Display components receive this model and do not arbitrate source precedence.

## 9.2 Request and response identity

Identify local preview candidates with `gameId`, turn, phase, applicable authoritative source revision/context, normalized payload fingerprint, and a locally increasing draft generation/token. The server returns its actual source revision/context, phase, and turn. A response is displayable only if all authoritative and draft identities still match the active view.

Debounce each newest candidate using the illustrative 150–300 ms settling target and permit at most one in-flight request. While it runs, replace—not append to—the queued candidate whenever edits or relevant authoritative inputs change. When the request settles, issue only the newest queued candidate if it remains eligible and is not equivalent to accepted/in-flight work. Do not depend on abort for server-side cancellation; ignore obsolete responses by identity.

If the player edits rapidly, submits, the opponent reveals, switches game, or a response arrives after the phase, turn, source context, or draft changes, discard the old response. Submission freezes the display from the frozen payload; after Reveal, authoritative full-state data supersedes any in-flight private draft result. Relevant authoritative input changes can enqueue the same draft payload with a new context identity; unchanged head/full-state reads cannot.

Apply source precedence by turn: active resolved presentation snapshot > authoritative revealed/public projection > matching submitted requester projection > matching draft preview > local manual overlay. During an uninterrupted session, a newer DTO for turn `N+1` must not erase resolved `N` while the existing presentation owner remains active. After a hard refresh, no prior ephemeral snapshot is assumed: only a surviving authoritative hold can establish the held state; otherwise the loaded `N+1` state wins. A stale preview must never overwrite a revealed or actual value.

## 9.3 Pending and errors

Own Battle Log manual ship rows should react immediately. Numbers may show a subtle pending indicator during calculation; do not present the previous draft’s amount as if it belongs to the new draft. A failed preview may show `—` / “Estimate unavailable” while the player can still build and submit. Failure clears or preserves only safe queued work; it never disables build controls or Ready.

On refresh while unsubmitted, allow the session-local draft to reset; do not add draft persistence. Once refreshed authoritative state confirms build eligibility, request the empty draft estimate again. On refresh while committed and waiting for the opponent, recover frozen own rows and estimate from the authenticated player’s stored server submission. Avoid a flash of opponent details or of a previous turn’s estimate.

For the Battle Log, reconcile live and archive by turn identity in one view-model update. During an uninterrupted resolution presentation, retain cached live `N` as the presentation row while history `N` is absent; when history `N` arrives, replace rather than append. At release, render live `N+1`; if archived `N` is still absent, defer that card or show a safe turn-keyed pending placeholder.

Treat “authoritative state has entered `N+1` but history omits `N`” and a failed history request as an expectation mismatch. Through the existing `useGameSession` history owner, retry a small fixed number of times with bounded backoff, cancel/supersede retries on game/turn change or successful arrival, and rely on the existing checkpoint reconciliation/idempotent response. A freshly loaded client must not assume it has cached live `N`. Exhausted retry leaves the card safely unavailable/pending without blocking play; it never duplicates `N` or assigns its rows to `N+1`. On terminal completion without turn resolution, clear live content rather than starting a retry for a turn that should not exist.

---

# 10. Desktop and mobile presentation gates

## 10.1 18E — Battle Log detailed visual spec required

Before Codex plans the client Battle Log pass, obtain Judd’s spacing, row height, type sizes, separators, padding, own/opponent alignment, concealed placeholder, initial scroll position, and responsive/mobile treatment.

The grey live section is locked as the first item in the existing scrolling content below Battle Log names, both on desktop and in the mobile takeover. It scrolls away with history, grows downward, and pushes archived cards; it is not sticky or separately pinned. Hide the existing empty-history message whenever the live section is present. Battle actions appear above the build summary. Exact dimensions and scroll-restoration behavior remain for Judd’s pass-level specification.

Pass 18E should consume the completed live-summary view model without reaching into server internals.

## 10.2 18F — Desktop and responsive middle stats detailed visual spec required

Before Codex plans the desktop stats pass, obtain exact positions/spacing/typography at the live app’s breakpoints, including the 200px intermediate-width center column, paired-value alignment, metric trigger/hit area, combined-card placement, hidden/pending values, treatment when Last has no predecessor, and behavior in short viewports where the root/fixed action-panel layout can clip content.

The revised mockup locks the sequence as Health, Saved Lines, Bonus Lines, paired Damage, then paired Healing. Damage and Healing each use prominent current values for both players, smaller quieter Last values immediately beneath, and center labels for Damage/Last and Healing/Last. Resting values do not use `~`; estimated combined-card headings/totals do.

Hover/focus on one player metric opens its combined This Turn and Last Turn breakdown card, omitting unavailable sections without inventing zero rows. Reuse the existing hover controller/card/frame and incorporate concise estimate messaging there. Verify keyboard/focus access, viewport-edge collision, the two side columns, varying numerical widths and negative values, long labels, the current 768px cutoff, and tall/short windows. Exact interaction details remain a visual-spec checkpoint.

## 10.3 18G — Mobile anchored-popover detailed visual spec required

Before Codex plans the mobile stats pass, obtain exact compact-HUD typography/alignment, popover sections, padding, responsive height/scroll limits, anchor/arrow placement, dismiss behavior, and touch target sizes.

The existing interaction opens both anchored cards together; preserve that behavior. Before Reveal, the opponent card shows Saved/Bonus then Last Turn while the local card shows Saved/Bonus, This Turn, then Last Turn. After Reveal, the opponent card shows Saved/Bonus then This Turn and drops its detailed Last Turn section, while the local ordering stays unchanged. Smaller Last values remain in both compact HUD rows. The pair may cover Ready or other controls, and covered controls need not remain usable. Tapping either card or outside the pair dismisses both; a scroll gesture inside a card scrolls it without dismissing. Exact geometry and touch thresholds remain a visual-spec checkpoint.

Prominent compact-HUD values never use `~`; estimated popover totals do. During resolution hold, current values/breakdowns become actual and keep the prior Last values in the compact HUD until rollover. The mobile view consumes the same server-authored data and has no separate evaluator. A resolved terminal turn shows one actual Final Turn set in the existing popovers where accessible; do not add it to the post-game Stats takeover.

---

# 11. Recommended implementation sequence

Seven main passes, each planned and reviewed separately. Candidate filenames are audit leads, not blanket editing permission. Tests can be added inside each pass’s corresponding ownership folder.

## Phase 18A — Server viewer-safe live Battle Log projection

**Pass type:** Server Pass
**Goal:** Project already-captured current-turn build/intervention/battle content for a viewer, preserving archive language and visibility barriers without altering completed history.

### Candidate file plan

- `src/supabase/functions/server/engine/state/battleLogHistory.ts`: reuse current capture atoms plus `formatBuildLines` / `formatBattleLines` for the live projection, preserving grouping, source tags, and turn identity.
- Existing Drawing-prelude and Charge Declaration visibility helpers for viewer gating; route and DTO exposure wait for 18C.
- Focused projector tests in `src/supabase/functions/server/tests/engine/state/**`.

### Required behavior

- Include the captured die/intervention rows, manual and produced builds, and battle action rows only when their facts exist and are public to that viewer.
- Before both submissions are applied, do not invent the first submitter’s manual rows from scratch; committed-own reconstruction belongs to 18C.
- Keep opponent build rows concealed before Reveal; do not expose simultaneous KNO/CUB/First Strike/charge choices until their current barrier resolves.
- Order public battle actions above build summaries and reuse archive formatting/token language.
- Audit archive-only Ancient Solar lines. Prefer viewer-safe projection from an already-public ledger; add a narrowly scoped capture atom at the visibility-opening point only if that cannot preserve live/archive parity safely.
- Append later produced-build events without subtracting consumed, upgraded, transferred, or destroyed ships.
- Do not alter `BattleLogTurnSummary`, completed-turn count, archived-turn order, or the head. Any scratch addition requires a demonstrated coverage gap and backward-compatible normalization tests.

### Validation target

Two independent viewers and a spectator see identical allowed public rows and only their authorized private side at Drawing, one-submitted, Reveal, First Strike, hidden declarations, barrier release, resolution, and refresh. Live formatted output matches the eventual archive for the same captured facts; no fabricated first-submitter row.

### Does not include

Route/DTO exposure, committed-own reconstruction, client display, provisional draft overlay, history UI handoff, or damage/healing preview.

---

## Phase 18B — Isolated server estimator and parity tests

**Pass type:** Server Pass
**Goal:** Produce read-only current-turn damage/healing estimates from one isolated viewer-safe simulation seam using canonical server rules.

### Candidate file plan

- Narrow helper under `src/supabase/functions/server/engine/state/**` or `engine_shared/resolve/**`, placed after Codex confirms ownership of the reusable functions.
- `src/supabase/functions/server/engine/intent/buildSubmitResolution.ts` and `engine_shared/resolve/resolvePhase.ts` only for narrowly justified extraction of the canonical per-player build/effect/breakdown seams.
- Existing `phaseComputedEffects.ts`, `drawingShipCreation.ts`, and `applyEffects.ts` only where required for canonical parity; avoid broad refactors.
- Focused estimator, parity, and repeatable measurement fixtures under `src/supabase/functions/server/tests/**`.

### Required behavior

- Construct the viewer-safe state through existing visibility projections, audit/reset non-fleet hidden inputs, then clone once.
- Apply the requester’s draft through a narrowly exposed canonical per-player build resolver, not a second build engine.
- Apply relevant own Reveal consequences, including Dreadnought production; treat Redemption’s reset as comparison input rather than healing.
- Isolate/clear clone-local pending effects, collect only allowed requester-owned automatic/once-only Damage and Heal, apply canonical modifiers, and reuse grouped breakdown rules.
- Exclude charges, Solar casts, charge-enabled secondary effects during the privacy barrier, and any accumulated canonical pending amount.
- Identical safe inputs produce identical totals/rows; repeated calculations leave canonical state, history, memory, and head untouched.
- Parity fixtures compare the estimator with authoritative resolution under matched no-further-action conditions and assert deliberate omissions.
- Measure estimator-only calculation time for representative fleets/drafts and deliberately complex late-game states, including the empty eligible draft and expensive production/once-only/opponent-sensitive combinations. Record fixture shape, environment, sample method, and results; do not turn an illustrative timing into an acceptance threshold without review.

### Performance evidence gate

18B must report estimator-only timings separately from route/database work. These measurements establish the calculation-cost portion of the gate but do not by themselves authorize client rollout or a cache; 18C completes the route/full-GET measurements.

### Does not include

An HTTP endpoint, full end-turn resolution, Black Hole, aggregate health, victory, phase advancement, persistence, client networking, or UI.

---

## Phase 18C — Preview endpoint, committed-own projection, DTO placement, and privacy tests

**Pass type:** Server Pass
**Goal:** Expose the isolated estimator safely during Drawing, recover a requester’s committed projection, and publish the viewer-safe live log plus mutually public stats through existing DTO boundaries.

### Candidate file plan

- `src/supabase/functions/server/routes/game_routes.ts` or a narrowly registered route module for the authenticated read-only POST and full-state projections, including inspection of the mutating `prepareGameStateRead` maintenance seam.
- Existing commitment and visibility projection helpers for authenticated stored-own payloads and safe input state.
- `src/supabase/functions/server/routes/intent_routes.ts` only if needed to prove absence/no leakage; Phase 18 data stays out of intent responses by default.
- Focused route/privacy/read-only tests and repeatable route measurements under `src/supabase/functions/server/tests/routes/**`.

### Required behavior

- Accept the same compact choices and current default-`1` FRI/QUA behavior as BUILD_SUBMIT; authenticated session determines the player.
- Enforce phase, turn, role, prelude eligibility, commitment state, payload bounds, and existing validation without changing BUILD_SUBMIT.
- Accept a normalized empty draft as soon as that player is build-eligible; existing ships may therefore produce nonzero current values before any click.
- Validate the session, load the canonical game once through a genuinely non-mutating read seam, and run one isolated calculation per request. Do not reuse `prepareGameStateRead` in a way that can persist timeout maintenance. If the loaded state is expired, terminal, changed, or ineligible, return safe unavailable/obsolete output and leave maintenance to the existing authoritative routes.
- Do not persist previews or timeout maintenance, increment `stateRevision`, alter clocks/readiness, store drafts, or change the head.
- For an unsubmitted player, return only that requester’s compact projection. For a submitted player waiting on the opponent, ignore/reject replacement drafts and derive frozen own rows/estimate from the stored authenticated submission.
- Put requester-only/frozen build and estimate data under `requester`, viewer-safe public live-log rows and mutually public revealed data under `publicState`, and draft data only in the compact preview response.
- Add no Phase 18 fields to raw `gameData`, the history endpoint, persisted head, or intent responses by default.
- Publish captured public dice/build interventions at their current barriers, both build sides after Reveal, and later battle actions only when public. Never serialize raw scratch.
- During simultaneous Charge Declaration, freeze both estimates at the last mutually public snapshot and withhold declaration action rows until phase exit; then release/recompute/publish only newly public data if still relevant.
- Prove full-response noninterference: states with identical viewer-visible input but different hidden Drawing, First Strike, or Charge Declaration data produce identical response status, totals, row presence/order, build/live projection, availability, timing-independent field shape, and errors.
- Reject/drop requests whose phase or turn changed without returning a hidden-derived value.
- Keep `/game-state-head/:gameId` compact and estimate-free. Full `/game-state/:gameId` responses after Reveal may calculate both public sides on changed-head reads and unchanged safety refreshes; no display component gets a separate estimate route.

### Performance evidence and rollout gate

- Combine 18B estimator timings with 18C measurements of session/auth overhead, canonical database-read time, estimator calculation time, and total preview-route time for representative and complex late-game drafts.
- Measure repeated two-sided post-Reveal full GETs against unchanged representative and complex states, because the current active safety refresh is roughly 15 seconds. Report database-read, two-sided calculation, and total route time separately.
- Record the measurement environment, fixture shapes, sample count/method, and observed variability. Current cadence, request-count, debounce, and latency statements are illustrative until this report exists.
- Before 18D begins, review the results and explicitly decide whether the simple calculate-on-request/full-GET approach is adequate. If not, plan any optimization, memoization, caching, or cadence change as a separate reviewed decision rather than silently expanding 18B/18C.

### Does not include

Client requests, view models, presentation, broad route redesign, caches, memoization, generic rate limiting, cadence changes, or extra persistence.

---

## Phase 18D — Client preview networking, draft identity, and view models

**Pass type:** Client/UI Pass, client runtime focused
**Goal:** Wire settled drafts to the preview endpoint and establish one turn-keyed runtime owner for the live log, paired metrics, resolution hold, and archive rollover before display work.

### Entry gate

The reviewed 18B/18C performance report must conclude that the simple POST/full-GET calculation posture is adequate, or a separately approved server optimization pass must land first.

### Candidate file plan

- `src/game/client/gameSession/intents.ts`: share canonical build-choice serialization without weakening final submit or changing default selections.
- `src/game/client/gameSession/clienteffects/useBuildDraftSync.ts`: inspect whether its no-op boundary is an appropriate narrow home; do not force a broad refactor.
- `src/game/client/useGameSession.ts`, `gameSession/types.ts`, `battleLog.ts`, `mapVm.ts`, and the existing `clienteffects/useEndOfTurnPresentation.ts` snapshot seam.
- Focused client tests for initial empty-draft requests, context-aware identity, debounce/coalescing, fingerprint suppression, supersession, unchanged-poll suppression, visibility transitions, uninterrupted resolution hold, hard-refresh behavior, bounded history recovery, archive handoff, terminal-without-resolution cleanup, and turn changes.

### Required behavior

- When authoritative Drawing/build eligibility becomes active, enqueue the normalized empty draft without waiting for a click. On refreshed unsubmitted sessions, do the same after eligibility is confirmed.
- Identify candidates/results by game, turn, phase, applicable authoritative source revision/context, normalized payload fingerprint, and draft generation. Recalculate an identical payload after a relevant context change; suppress unchanged head/full-state observations.
- Use the illustrative 150–300 ms settling debounce and permit at most one in-flight preview request. While it runs, retain only the newest candidate; after it settles, send that candidate if still relevant. Do not rely on abort to cancel server work, and discard obsolete responses.
- Closely spaced clicks may coalesce into one request; edits that settle separately may produce separate requests. No head-poll, safety-refresh, hover-card, popover, or Battle Log request loop.
- Compose immediate local manual rows, authoritative public live rows, and matching canonical build rows without duplication; preserve archive-style battle-above-build ordering.
- Ready freezes from the accepted/stored payload; Reveal full-state data supersedes private preview; public battle rows append only from server projection; actual resolution supersedes estimates.
- On refresh while unsubmitted, allow the draft to reset. On refresh while committed, consume the server’s requester-only frozen projection.
- Extend the existing one-shot presentation snapshot to hold resolved current actual totals/breakdowns alongside previous Last totals/breakdowns until release in an uninterrupted session. Prevent an early new-turn DTO from erasing that active ephemeral snapshot.
- On hard refresh, restore a held pair only from a still-active authoritative `end_of_turn_health` hold. If authoritative state is already `N+1`, show `N+1` with actual `N` in Last; do not replay the transient hold from archive data or add persisted UI state.
- Extend the existing `useGameSession` history-fetch owner with a bounded, turn-keyed retry when archive `N` is expected but absent or the fetch fails. Reuse the server’s archive checkpoint reconciliation and idempotent history response; cancel/supersede safely and expose a pending/deferred card after exhaustion rather than inventing live `N`.
- Swap live `N` to archive `N` once when both are available, then expose fresh live `N+1` at release. Clear the unfinished live section on terminal completion without turn resolution.
- Produce explicit desktop/mobile presentation states, including the opponent mobile popover’s pre-Reveal Last versus post-Reveal This Turn swap and the simultaneous-open pair.
- Distinguish zero, hidden, pending, unavailable, estimated, held actual, Last actual, and Final Turn without wrong-turn flashes. Optional-preview failure never blocks build or Ready.

### Does not include

Display spacing/polish, client combat formulas, server changes, a new client store/networking subsystem, or draft persistence.

---

## Phase 18E — Client Battle Log live section

**Pass type:** Client/UI Pass
**Goal:** Display the scrolling grey This Turn section from the completed Phase 18 data flow, with immediate local draft updates, public actions, and safe archive handoff.

### Entry gate

**Remind Judd to supply the detailed Battle Log visual specification before Codex makes its file plan.**

### Candidate file plan

- `src/game/display/shared/BattleLogPanelContent.tsx` and existing desktop/mobile Battle Log host components.
- `src/game/client/gameSession/types.ts`, `battleLog.ts`, `mapVm.ts`, or `useGameSession.ts` only for a small presentation seam left by 18D.
- Focused mapper/display tests for shared-scroll placement, empty-state suppression, action/build order, concealment, and handoff if warranted.

### Required behavior

- Render the live section first inside the same `LeftRailScrollArea` as archived cards on desktop and mobile; it scrolls normally and pushes history down.
- Hide the existing pre-battle empty message whenever the live section exists.
- Preserve correct names/orientation for players and spectators; opponent stays concealed before Reveal even if submitted first.
- Own unsubmitted draft rows react immediately; matching server/settled build rows replace rather than duplicate them.
- Render public dice/build interventions and battle actions using existing tokenization, with actions above builds; never reveal a hidden declaration through row appearance.
- During an uninterrupted resolution hold, keep live `N` until matching archive `N` is available, then replace atomically. At release show fresh live `N+1`; if archive `N` remains delayed, render the 18D pending/deferred state rather than retaining or reconstructing live `N` as history.
- On a fresh load already in `N+1`, do not fabricate a live `N` fallback. On terminal completion without current-turn resolution, omit the unfinished This Turn section and show only genuine completed history.

### Does not include

Client combat formulas, server rules, or final desktop/mobile stats layouts.

---

## Phase 18F — Desktop and responsive stats presentation

**Pass type:** Client/UI Pass
**Goal:** Apply the paired current/Last desktop metrics and combined breakdown cards across existing breakpoints.

### Entry gate

**Remind Judd to supply the detailed desktop and responsive visual spec before Codex makes its file plan.**

### Candidate file plan

- `src/game/display/layout/BoardStage.tsx` and its actual current hover-card/hover-state components.
- `src/game/client/gameSession/types.ts` / mapping only if 18D left a small presentation seam to finish.
- Existing relevant display styles/tests, without altering Tailwind/Vite config.

### Required behavior

- Keep Health, Saved Lines, and Bonus in place; replace Last-only Damage/Healing rows with prominent current values and smaller Last values for both players.
- Show own estimate and opponent current `?` before Reveal, both current estimates after Reveal, held current actuals during resolution, and rollover into Last only at presentation release. Resting values never use `~`.
- Consume the 18D lifecycle state as given: after a hard refresh, show a held pair only when the authoritative hold survives; otherwise show the current `N+1`/Last `N` state without reconstructing the presentation in display code.
- Extend the existing metric hover/focus card to show This Turn and Last Turn breakdowns together when available. Put `~` and estimate messaging there; do not build a second tooltip system.
- Preserve accessible triggers, viewport-aware placement, and readable 200px/short-height layouts.
- When the canonical resolved-turn marker proves terminal resolution, show one actual Final Turn set without a false prior/current duplication.

### Does not include

New server calculations or a mobile anchored-popover redesign.

---

## Phase 18G — Mobile paired HUD and stat breakdown popovers

**Pass type:** Client/UI Pass
**Goal:** Apply the paired current/Last compact HUD and phase-sensitive content in the existing simultaneously opened anchored popovers without duplicating the estimator.

### Entry gate

**Remind Judd to supply the detailed mobile visual specification before Codex makes its file plan.**

### Candidate file plan

- `src/game/display/mobile/MobileStatBreakdownPopovers.tsx` and `MobileGameLayout.tsx`.
- `src/game/display/mobile/MobileStatusRail.tsx` for compact paired current/Last fields.
- Existing mobile anchor/dismissal helpers and presentation tests if needed.
- View-model changes only if strictly required by the reviewed mobile spec.

### Required behavior

- Preserve the existing one-toggle behavior that opens both anchored cards together. The pair may cover and block Ready or other underlying controls. A tap on either card or outside dismisses both; a scroll gesture inside a card scrolls its content without dismissing. Defer exact geometry and touch thresholds to the reviewed visual spec.
- Render prominent current Damage/Healing plus smaller Last values in each compact HUD row, with no HUD `~`.
- Before Reveal, opponent shows Saved/Bonus + Last Turn while local shows Saved/Bonus + This Turn + Last Turn. After Reveal, opponent swaps detailed Last Turn for This Turn while local remains unchanged.
- Put `~` only on estimated breakdown totals. During resolution hold, show actual current values/breakdowns without `~` and retain the previous Last HUD values until rollover.
- Consume the same 18D hard-refresh rule as desktop: no mobile-only replay of a transient hold from archive data, and no persisted popover presentation state.
- Resolved Final Turn actuals appear once in the existing popovers where accessible, with no stale estimate and no new post-game Stats takeover section.
- A terminal outcome without current-turn resolution removes unfinished This Turn content and supplies no Final Turn state to the popovers.

### Does not include

Server changes, separate mobile power math, post-game Stats takeover changes, or unrelated actions/catalogue redesign.

---

# 12. Validation and example scenarios

## 12.1 Standard checks

For server passes run applicable live-repository checks, normally:

```text
deno check src/supabase/functions/server/index.tsx
deno task check
focused Deno server/route tests for the changed surfaces
```

For client/UI passes:

```text
npm run typecheck
npm run build
focused client projection/request tests where they verify behavior
```

For 18B/18C, also produce the reviewed performance report required by those passes. Keep estimator calculation, database read, and total route time distinct; record environment and fixtures so the results are interpretable rather than presenting an unqualified latency number.

Follow the current `CodexPassTemplate.md` rule: Codex does not run the Vite dev server, browser automation, or manual UI verification unless Judd explicitly requests it. Report: **“Not run — browser/Vite testing handled by user.”** Judd reviews the visual behavior in the live app at the design checkpoints and after the relevant passes.

## 12.2 Server behavioral matrix

At minimum prove:

1. Both player identities and a spectator receive only capture-backed, viewer-safe live content: public die/intervention rows at their barrier, no opponent build before Reveal, both actual builds after Reveal, and battle actions only when public. The first submitter’s manual rows are absent from scratch but recover through their requester-only committed projection.
2. Live output uses existing capture order/formatting and matches the eventual archive for the same KNO/CHR/CUB, manual/produced build, First Strike, charge, destroy/steal/Frigate, and Ancient Solar facts. Any narrow Solar addition is covered at its visibility-opening point and by backward-compatible scratch normalization.
3. Hidden opponent prelude/build information cannot affect a requester’s estimate or live projection. Construct canonical states with identical viewer-visible data but different hidden opponent fleets/counters/selections; compare the complete pre-Reveal response, including status, totals, row presence/order, build/live projection, availability, errors, and field shape.
4. First Strike and Charge Declaration noninterference use the same full-response comparison with different hidden selections, canonical pending effects, charge-depleted fleets, and secondary SOL healing. No row or estimate changes before the relevant barrier. Both estimates remain identical to the last mutually public snapshot throughout Charge Declaration, then release only newly public state.
5. Draft simulation causes zero persistent writes, no revision/head changes, no consumed charges, no readiness/clock/health/once-only-memory changes, and no mutation of canonical pending effects. A preview read that discovers an expired clock returns safe unavailable/obsolete output and does not invoke `prepareGameStateRead`’s timeout `conditionalUpdate`; an existing authoritative route remains responsible for maintenance.
6. The first eligible empty draft, a no-op draft, a single manual build, mixed produced/manual builds, upgraded/component consumption, default and configured FRI/QUA, EVO conversions, Queen, multiple Dreadnoughts, Redemption comparison input, Science Vessel modifiers, and opponent-dependent effects give the intended estimate rows. Existing ships can yield a nonzero empty-draft estimate.
7. Automatic depletion healing is included only when depletion is mutually public; charged Solar/ordinary effects and charge-enabled secondary healing are omitted while private; authoritative resolved current actuals include applicable charge contributions.
8. Estimate and actual rows sum to their totals. Self damage and health-cap cases distinguish generated healing from net health, and attacker/target orientation preserves damage dealt versus server damage-taken keys.
9. Bad role, wrong phase/turn, malformed/oversized or structurally inconsistent payload, submitted replacement attempt, and a request racing Reveal return safe behavior without changing existing BUILD_SUBMIT validation/defaults.
10. Phase 18 fields appear only in the compact preview response, `requester`, or `publicState` as allowed; they remain absent from raw `gameData`, history, head, and intent responses. Existing history analysis remains reusable without a schema fork.
11. Resolution and final-turn archiving preserve turn identity; surrender/timeout before current-turn resolution do not fabricate current or Final Turn actuals.
12. The 18B/18C measurement report covers representative and complex late-game estimator-only runs, full preview POSTs, and repeated two-sided post-Reveal full GETs against unchanged state. It separates calculation, database-read, and total route time and supports the reviewed go/no-go decision before 18D.

## 12.3 Concrete product walkthrough

| Point | Battle Log | Paired stats and popovers | Source |
| --- | --- | --- | --- |
| Turn starts and build eligibility opens, before any click | Grey This Turn exists in the shared scroller; old empty text is hidden; opponent build concealed | Runtime requests the empty draft; existing own ships may produce a current estimate, opponent remains `?`, and smaller Last values remain authoritative | Viewer-safe GET + read-only POST |
| Public dice modifier occurs | Archive-language intervention row appears without exposing a still-hidden choice | Estimates revise only if the newly public input is allowed | Capture projection after existing barrier |
| Add illustrative ships | Own manual build rows change immediately; server projection replaces rather than duplicates them | Prominent board/HUD value has no `~`; combined/mobile estimated breakdown may show `~13` with illustrative rows | Local overlay, then read-only POST |
| Edit while older request is in flight | Show newest own draft | Pending/newest response only; never old response | Client draft generation |
| Submit first | Own frozen rows, opponent `???` | Own frozen current estimate, opponent current `?`; Last unchanged | Stored own commit via requester projection |
| Both submit / Reveal | Both actual build summaries replace projections | Two-sided current estimates, no resting `~`; local mobile keeps This+Last, opponent mobile swaps Last detail for This | Public full GET after changed head |
| Public First Strike action | Action appears above build summary after its barrier | Mutually public changes may revise current estimates | Viewer-safe capture projection |
| Simultaneous Charge Declaration | No declaration row until the barrier; prior public live content remains | Both estimates freeze at the last mutually public snapshot; no hidden depletion/SOL change | Existing declaration visibility snapshot |
| Charge barrier exits | Newly public charge/action rows appear | Estimates may revise only from newly public allowed inputs | Public full GET |
| Authoritative turn `N` resolution, uninterrupted | Live `N` remains the presentation row; archive `N`, if available, replaces it once | Large current slots and This Turn breakdowns become actual, include charges, and lose `~`; small Last remains `N-1` throughout presentation | Resolution response/marker + ephemeral presentation snapshot |
| Enter turn `N+1` | Fresh live `N+1` appears; archived `N` appears when history supplies it, otherwise its card is pending/deferred | Actual `N` moves to small Last; local current resets to pending/new estimate and opponent current to `?` | Presentation release + authoritative DTO + history |
| Hard refresh while hold survives | Held live/stat state appears only when the loaded authoritative `end_of_turn_health` hold proves it remains active | Current actual `N` stays paired with Last `N-1` | Current authoritative hold; no archive-only replay |
| Hard refresh after server entered `N+1` | Fresh live `N+1`; archive `N` is shown, retried, or deferred by turn identity | Show `N+1` current and actual `N` in Last; do not replay the `N` hold | Current authoritative state + history |
| Resolved terminal turn | Final archived turn appears once | One actual **Final Turn** set in finished board stats and existing mobile popovers; none added to post-game Stats | Canonical actuals and resolved-turn marker |
| Terminal without resolving current turn | Unfinished This Turn section closes; genuine earlier cards remain and no current card is invented | No fabricated Final Turn damage/healing | Canonical completion reason/turn markers |

The example `~13` applies only to the pictured test state; never hardcode those numbers.

## 12.4 Client race and recovery cases

- Rapid add/remove/add with responses arriving in reverse order.
- Rapid clicks inside the illustrative settling window coalesce to the newest draft; clicks that settle separately may issue separate requests.
- Edits during an in-flight request replace the queued candidate; only the newest still-relevant candidate is sent after completion, there is never more than one in flight, and abort is not assumed to cancel server work.
- Repeated equivalent drafts in the same authoritative context suppress duplicate work, while the same payload after a relevant phase/source-context change recalculates.
- An unchanged head poll or safety full refresh triggers no draft POST. A changed relevant authoritative context does; opening a hover card, mobile popover, or Battle Log does not.
- Initial build eligibility and refreshed unsubmitted eligibility each enqueue the empty draft without a click.
- Submit while debounce timer or preview POST is in flight.
- Opponent’s Reveal arriving between a preview load and its response.
- Reload during own unsubmitted Drawing resets the draft without adding persistence; reload during one-submitted waiting recovers the requester’s frozen stored projection.
- Reload during Reveal hold or hidden First Strike/Charge Declaration preserves the correct visibility snapshot and does not flash a row.
- Reload while the authoritative `end_of_turn_health` hold still survives shows the supported current `N`/Last `N-1` pair. Reload after authoritative state has entered `N+1` shows `N+1` with `N` in Last and does not replay the transient hold from archive data.
- Switch game or seat, spectator join, bot opponent, and untimed idle/hidden polling.
- Preview network failure and retry/backoff do not block building or Ready/BUILD_SUBMIT; queued work remains bounded to the newest relevant candidate.
- The initial history request fails, or returns without expected archive `N`: the existing history owner performs bounded retry; success inserts `N` once, while exhaustion leaves a safe pending/deferred card and does not block play.
- Archive `N` arrives before or after the resolution/new-turn DTO: live/archive swap is once-only during an uninterrupted presentation; a fresh client at `N+1` never assumes a cached live `N`, duplicates `N`, or attaches its rows to `N+1`.
- An early turn `N+1` DTO arrives while the `N` presentation is active: held actuals and previous Last remain until release, then the pair rolls forward atomically.
- Mobile popovers are open across pre-Reveal, Reveal, resolution, and rollover updates; both remain open together and each applies its correct section policy. A tap on either card or outside dismisses the pair, while an in-card scroll scrolls without dismissal; covered controls are allowed to remain inaccessible until dismissal.
- Surrender, timeout, or another non-resolution terminal outcome removes the unfinished live section, retains earlier archive cards, and creates neither retry expectation for the unfinished turn nor Final Turn stats.

---

# 13. Risks and review decisions

## 13.1 Main server complication: visibility is an input rule

Returning only own fields is insufficient if own output depends on hidden opposing ships or declarations. The server must calculate pre-Reveal estimates in a consciously constructed **viewer-visible** context, project live rows only after each existing barrier, and freeze both estimates at the last mutually public snapshot throughout simultaneous Charge Declaration. Full-response noninterference across hidden Drawing, First Strike, and charge changes is the highest-priority server test gate.

## 13.2 Main calculation complication: read-only reuse

Current build and battle helpers have side effects on the supplied state. Reusing them safely requires one viewer-safe state, one disposable clone, narrow access to the canonical per-player builder, correct per-instance events and Reveal consequences, isolated pending effects, and explicit excluded charge sources. A preview that extends the existing legality-lookahead simulations or calls real turn resolution indiscriminately creates a second rule path, incorrect rows, or secret-derived values even without saving the clone.

## 13.3 Main live-log complication: capture coverage and archive parity

Most required live language already exists in capture atoms and archive formatters. The main demonstrated gap is archive-time Solar-ledger formatting, plus the need to gate raw capture by viewer visibility. Prefer the smallest projection/capture addition that makes live and archive output agree. Never serialize scratch or build a second generic event/history pipeline.

## 13.4 Main client complication: timing, paired history, and source precedence

Local draft rows, server previews, public live projections, resolution actuals, and archive history arrive independently. Tie them to game, turn, visibility phase, draft generation, payload fingerprint, source revision, and presentation ownership. During an uninterrupted session, the turn `N` resolution snapshot must retain actual current and previous Last while an early DTO may already say `N+1`; after a hard refresh, only a surviving authoritative hold justifies that transient state. Archive data is not a replay signal.

History can also lag or fail after state advances. The current initial/turn/finish fetch is one-shot, so add bounded expectation-driven retry in its existing owner and rely on the server’s checkpoint/idempotent merge. Keep a missing completed card pending/deferred rather than promoting cached live rows, duplicating a turn, or contaminating `N+1`. Resolve these rules in one client-runtime view model, not scattered display conditionals. Unsubmitted refresh deliberately resets rather than adding draft or presentation persistence.

## 13.5 Performance posture and rollout gate

The simple baseline performs session validation, one canonical read, and one isolated calculation for each issued draft preview. It also calculates two public sides in post-Reveal full-state responses; current active clients can request an unchanged safety full refresh after roughly 15 seconds even though compact head polling is roughly two seconds. Those live cadences and the 150–300 ms settling range describe the current code or an initial tuning target, not measured Phase 18 request counts or latency guarantees.

Coalescing limits client concurrency and redundant draft work, but it does not make server CPU free: an aborted browser request may already be calculating, and unchanged post-Reveal full GETs can repeat two-sided work. 18B/18C therefore form a hard evidence gate before 18D. Measure representative and complex late-game estimator-only runs, preview routes, and repeated unchanged two-sided full GETs; report calculation time, database-read time, and total route time separately with environment/fixture/sample context.

Review those results to accept or reject the simple approach before client rollout. Do not pre-emptively add caching, memoization, generic limiting, extra persistence, a head payload, or display-owned requests. If measurements show a problem, make the optimization and its invalidation/privacy contract a separately reviewed decision.

## 13.6 Visual spec remains deliberately open

The updated mockups lock sequence, grouping, shared scrolling, paired-value hierarchy, popover state policy, and example content. Judd will supply exact responsive spacing and interaction behavior at 18E, 18F, and 18G. Those pass plans must explicitly check the 200px intermediate-width center column, current 768px mobile cutoff, short-height/root clipping, combined-card keyboard/focus access and viewport collision, scroll restoration, and existing mobile popover anchors.

---

# 14. Completion criteria

Phase 18 is complete when:

- a grey This Turn section exists from turn start as the first item in the shared desktop/mobile Battle Log scroller, suppresses the empty-history message, grows with content, and is not separately pinned;
- local manual and produced builds appear live, public dice/build interventions use archive language, opponent builds remain `???` until Reveal, and public battle actions appear above builds only after their barriers;
- after Reveal both actual build summaries populate, and resolved live turn `N` hands off once to archive `N` when available without duplication, wrong-turn rows, or scroll-container divergence;
- when expected archive `N` is absent or its fetch fails, the existing client history owner performs bounded turn-keyed retry against the checkpoint-reconciled idempotent route; while waiting or after exhaustion the card is safely pending/deferred, never copied from an assumed cache or attached to `N+1`;
- initial Drawing/build eligibility requests the empty draft so existing ships can produce a current estimate before any click, and a changed unsubmitted build obtains its own server-calculated damage/healing estimate and grouped rows from the same read-only request;
- preview identity includes game, turn, phase, relevant authoritative source revision/context, and normalized payload, so an unchanged poll does not retrigger work while a relevant context change can recalculate an identical draft;
- preview edits use the illustrative settling debounce with one request in flight, retain only the newest queued candidate, issue it after completion only if still relevant, and discard obsolete responses without assuming abort cancels server work;
- unsubmitted refresh may reset the draft without adding persistence and requests the empty estimate again once eligibility is confirmed, while committed waiting refresh recovers frozen own rows/estimate from the authenticated stored submission;
- no large independent client combat evaluator is introduced;
- preview requests never commit, persist, advance, consume, perform timeout maintenance, store drafts, or alter canonical game state/head; an ineligible/expired preview returns safe unavailable/obsolete output for an existing authoritative route to maintain;
- before Reveal no player or spectator can infer hidden opposing builds from any new row, statistic, endpoint, or response shape;
- after Reveal both sides receive estimates from mutually public authoritative state; simultaneous Charge Declaration freezes both at the last mutually public snapshot, with full-response noninterference across hidden choices; charges remain absent from estimates and appear in actual resolution;
- Phase 18 data is placed only in the compact preview response, `requester`, or `publicState` as authorized, not raw `gameData`, history, head, or intent responses by default;
- head polling remains compact and estimate-free, full GETs remain the sole post-Reveal estimate transport, and display surfaces add no requests;
- 18B/18C report representative and complex estimator, preview-route, and repeated two-sided full-GET measurements with calculation, database-read, and total route time separated; the reviewed result approves the simple posture before 18D or triggers a separate optimization decision;
- stale, failing, and racing requests cannot overwrite a newer draft, Reveal, held resolution, completed turn, or different game;
- desktop shows paired current/Last Damage and Healing with no resting `~`; one accessible combined metric card shows available This Turn and Last Turn breakdowns and carries approximation treatment only for estimates;
- the compact mobile HUD shows current plus smaller Last values without `~`; both existing anchored popovers open together, may cover underlying controls, apply the settled before-/after-Reveal section policies, dismiss together on a tap to either card or outside, and allow in-card scrolling without dismissal;
- during an uninterrupted session, authoritative resolution changes current estimates to held actuals and actual breakdowns without `~`, keeps prior Last throughout the presentation, resists an early new-turn DTO while the presentation owner remains active, and rolls those actuals into Last only on release;
- after a hard refresh, a held display appears only when current authoritative state still proves the matching hold is active; an already-advanced `N+1` state shows `N+1` with resolved `N` in Last, without archive-only replay or new persisted UI state;
- resolved terminal resolution becomes one actual Final Turn set in finished board stats and existing mobile popovers, without adding it to post-game Stats or mislabeling a prior turn after unresolved termination;
- surrender, timeout, or another terminal outcome without current-turn resolution removes the unfinished live This Turn section, retains genuine completed history, and creates neither an archived current-turn card nor Final Turn stats;
- the focused server/client regression tests and appropriate type/build checks pass; and
- Judd has been reminded for, supplied, and reviewed the detailed visual specs at the three client presentation checkpoints.
