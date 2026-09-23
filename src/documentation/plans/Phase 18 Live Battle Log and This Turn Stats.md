# Phase 18 — Live Battle Log and “This Turn” Stats

## Normative Planning and Pass-Decomposition Document

- **Status:** Planning; no Phase 18 implementation has begun in the supplied snapshot
- **Phase type:** Live battle presentation and server-calculated estimates; not a new gameplay phase
- **Primary scope:** Current-turn ship builds in the Battle Log; estimated current-turn damage and healing; desktop and mobile stat presentation
- **Architecture baseline:** Server-authoritative Shapeships after the Phase 14 phase simplification, Phase 16 head polling, and current Phase 7 Battle Log / Phase 12 stats implementations
- **Code snapshot inspected:** Supplied `0918-root(3).zip`, inspected 2026-09-23. Recheck the live repository at the start of every pass.
- **Design references:** Revised desktop Battle Log / middle stats mockup `003c7cce-0683-4cab-9761-1f6d744ccda3.png` and mobile breakdown modal mockup `81ca32b8-115a-4f48-b6ba-7e16a4af1e83.png`. These show intended structure and examples, not a complete visual specification.
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

Do not overwrite executable rules with an illustrative number from a mockup. The revised desktop example shows `~13` because the two shown Tactical Cruisers contribute 10 and three Fighters contribute 3 in that illustrated state. It does not establish a fixed per-ship formula.

## 1.3 Working method and design checkpoints

Codex plans and implements **one pass at a time on the live codebase**. Before each pass it reads the applicable architecture and agent files, inspects current source, proposes a narrow file plan, and allows review. After implementation it reports changed files, tests, and remaining risks.

**Visual-spec reminder:** Before starting **18B** (Battle Log display), **18F** (desktop/responsive stats), and **18G** (mobile stats), ask Judd for the detailed visual specification for that surface. The mockups alone are insufficient to lock exact widths, gaps, typography, scroll behavior, popover sizing, or responsive breakpoints. Record the supplied values in that pass’s reviewed file plan.

This is a planned review checkpoint, not permission to improvise layout or to block the earlier server passes.

---

# 2. Purpose, scope, and non-goals

## 2.1 Purpose

As a player draws ships, the Battle Log should show this turn’s own ship builds. Alongside the existing actual Last Turn damage and healing, the middle stats should show the best available estimate for the current turn. The opponent’s current build and estimates become visible when both builds reveal.

The feature should make a live build understandable while preserving simultaneous hidden builds and the server’s authority over all combat.

## 2.2 In scope

- A distinct, live **This Turn** build area above completed Battle Log turns.
- Requester-only own builds during Drawing, including server-produced builds as they occur; opponent hidden until Reveal.
- The same two-sided live build area once both builds have revealed.
- Server-calculated estimated damage and healing, with grouped breakdown rows.
- A small, authenticated, read-only build-preview request as the player edits a draft.
- Frozen own preview after submission and two-sided estimates after reveal.
- Clear estimated/hidden/pending/actual states.
- Desktop and responsive middle stats reordering; mobile breakdown modal reordering and own This Turn area.
- A single **Final Turn** actual-results treatment when a game ends through a resolved final turn.
- Targeted tests for server privacy, calculation parity, lifecycle, and client request races.

## 2.3 Out of scope

- Combat rebalance, new ship powers, new charges, or altered healing/damage rules.
- New gameplay subphases or changes to BUILD_SUBMIT’s simultaneous reveal boundary.
- Server persistence of every unsubmitted draft.
- An independent client damage/healing rules engine.
- Live charge prediction or a prediction of an opponent’s undisclosed choices.
- A historical Battle Log schema migration or rewrite of completed-turn archive behavior.
- A general DTO, persistence, polling, or networking redesign.
- Adding new generic rate-limiting infrastructure unless a measured issue demands a separate reviewed pass.
- A broad refactor of `IntentReducer.ts`, `resolvePhase.ts`, or `useGameSession.ts`.

---

# 3. Locked player-facing behavior

## 3.1 Battle Log before and after Reveal

During Drawing:

- Show the current turn in a clearly separate Battle Log area above completed turns.
- The viewing player’s side accumulates ships built this turn as they happen. Include automatic and produced ships with their source tags where the established Battle Log format provides them.
- Opponent side shows the mockup’s concealed state (`???` or the finally specified equivalent), regardless of whether the opponent has already submitted.
- Do not show opponent build counts, names of new ships, hidden drawing-prelude production, or details inferred from a calculation.
- Draft display updates without committing the build. Once this player submits, their row reflects the frozen submission.

At the simultaneous build reveal:

- Populate both sides from the revealed authoritative builds, including any reveal-time produced ships.
- Continue to update current-turn ship rows if an actual later action produces or removes an item that belongs in the current-turn build record, following the existing Battle Log capture semantics.
- Keep completed turns in their normal archive order. The new row is not an archived turn and does not increment completed-turn count.

At resolution/turn rollover, hand the live presentation to the existing completed-turn history exactly once. Refresh/reconnect must not show duplicate turns or briefly reveal an opponent’s build from the wrong turn.

## 3.2 This Turn damage and healing

- While a player edits an unsubmitted build, their own damage and healing estimates update from the newest server preview response.
- Opponent numbers remain `?` before Reveal.
- After Reveal, both sides show estimates derived from the now-visible state; subsequent fleet changes may update them until resolution.
- Display estimates with an approximation marker such as `~13` and an information tooltip using copy in the spirit of: **“This damage may change depending on opponent actions.”** Cover healing too in the final microcopy if needed.
- The estimate is **generated damage/healing**, consistent with current Last Turn breakdown semantics. It is not predicted health loss, final net health, or healing after a health-cap clamp.
- Use `0` with the approximation treatment for a calculated zero, `?` for concealed opponent data, and a distinct pending/unavailable presentation when no valid current estimate exists.
- Charges and Solar casts made or declared for the battle do not appear in the estimate. Their resulting damage/healing appears in the actual Last Turn/Final Turn results.

## 3.3 Last Turn and Final Turn

Last Turn continues to show the authoritative completed previous turn while a new turn is being played.

When an end-of-turn resolution **actually produces the final turn’s damage/healing**, remove the parallel estimate presentation, show one set of actuals, and label that set **Final Turn**. Reuse the existing authoritative last-turn totals and breakdowns.

If the match ends through surrender, timeout, or another path **without resolving the current turn**, do not relabel an older completed turn as Final Turn. Hide an unresolved current estimate and retain only whatever completed history is actually supported by canonical state.

Do not treat the presentation hold, delayed archive fetch, or terminal `status` by itself as proof that current-turn damage/healing resolved.

## 3.4 Mobile intent

The supplied mobile mockup reorders breakdown content into Saved Lines / Bonus Lines, then Last Turn Damage / Healing, followed by **This Turn Damage / Healing on the local player’s modal**. The opponent modal is not to reveal This Turn before Reveal; the supplied mockup calls for This Turn just for self on mobile. The precise post-Reveal opponent-modal treatment should be checked with Judd at the 18G visual-spec checkpoint rather than inferred from desktop.

Server data after Reveal may contain both players’ estimates; mobile may present a subset of that already-public data.

---

# 4. Current repository baseline and ownership

## 4.1 Build and reveal are already distinct

`src/supabase/functions/server/engine/intent/IntentReducer.ts` handles `BUILD_SUBMIT` during `build.drawing`. The first submit stores a private commit/reveal payload and marks readiness. Only after **all active players submit** does `resolveBuildSubmitAuthoritatively` apply both builds and advance toward `battle.reveal`.

`src/supabase/functions/server/engine/intent/buildSubmitResolution.ts` constructs ships, consumes lines/components, handles configuration and production, and updates turn-scoped counters. It currently mutates its working state; it is not an existing read-only preview API.

`src/supabase/functions/server/engine/phase/onEnterPhase.ts` creates a real Reveal visibility hold. Reveal-time powers, notably Dreadnought Fighter production and Redemption’s direct health reset, can affect the situation before later combat actions.

## 4.2 The client already has a local fleet preview, not a combat preview

`src/game/client/gameSession/provisionalBuild.ts` projects a draft fleet and catalogue/economy state from local draft counts. This is useful for instant ship display but is not a complete combat evaluator. It does not provide every canonical per-instance/event fact needed for Dreadnought, Queen, consumed components, once-only memory, and all power effects.

`src/game/client/gameSession/intents.ts` builds the ordered `BUILD_SUBMIT` payload with counts, Frigate triggers, Quantum Mystic selections, and Evolver choices. Use the same choices for a preview request, but do not dispatch `BUILD_SUBMIT` until Ready.

`src/game/client/useGameSession.ts` owns the draft buffer, current build preview, authoritative state acceptance, and board view model. Networking remains in the client runtime; display components do not send preview requests.

## 4.3 Polling cannot carry each draft

`src/game/client/gameSession/clienteffects/useNetworkingEffects.ts` generally polls `/game-state-head/:gameId` about every two seconds while active. It only fetches full `/game-state/:gameId` on a changed head, safety refresh, or other required sync. Neither endpoint uploads draft edits.

Saving each draft to canonical state to make polling “see” it would add writes, revisions, and privacy hazards. Phase 18 adds an explicit small request on changed drafts, with a direct response; it does **not** use polling as the draft transport or alter the persisted game-state head.

## 4.4 Existing Battle Log and stats sources

`src/supabase/functions/server/engine/state/battleLogHistory.ts` maintains current-turn capture atoms internally and archives completed `BattleLogTurnSummary` rows. Build capture includes manual and produced ships as well as non-ship presentation events; do not publish the scratch object or reuse all formatted lines wholesale for the ship-only live row.

`src/game/client/gameSession/battleLog.ts` maps separately fetched completed history. `src/game/display/shared/BattleLogPanelContent.tsx` is shared by desktop and mobile Battle Log surfaces. `src/game/client/gameSession/types.ts` and `mapVm.ts` define the presentation seam.

`src/supabase/functions/server/engine_shared/resolve/phaseComputedEffects.ts` collects count-based, tiered, once-only, dice-based, and opponent-sensitive power effects. `resolvePhase.ts` gathers effects, applies Science Vessel modifiers, records breakdown entries, and derives actual Last Turn totals; full turn resolution also performs destruction, health changes, and victory evaluation. The preview must reuse the relevant rules on isolated state without performing a real resolution.

`src/supabase/functions/server/routes/game_routes.ts` builds the full GET DTO, including public fleets and Last Turn stats plus requester breakdowns. `src/supabase/functions/server/routes/intent_routes.ts` has a separate response sanitizer. New projection fields need a deliberate visibility contract on every response surface that carries them.

## 4.5 Display seams and layout constraint

`src/game/display/layout/BoardStage.tsx` owns the center stats placement. Its center column becomes narrow at existing breakpoints; simply appending two extra stat rows is likely to overflow or damage readability. The revised desktop design changes the order and grouping of Health, Saved Lines, Bonus Lines, Last Turn, and This Turn.

`src/game/display/layout/boardStage/useBoardStatHover.tsx` and `src/game/display/layout/boardStage/BoardStatBreakdownHoverCard.tsx` own desktop breakdown hover behavior in the supplied snapshot. `src/game/display/mobile/MobileStatBreakdownPopovers.tsx` and `MobileGameLayout.tsx` own the mobile modal/popover behavior. A longer mobile modal requires viewport and scroll treatment, not an assumed fixed height.

---

# 5. Current-turn Battle Log contract

## 5.1 Live summary is separate from history

Define a small view-facing live-build model tied to `gameId + turnNumber`. The source must state which sides are visible, and return **ship-build rows only**. The completed-history response retains its existing `turns` and `completedTurnCount` meaning.

Suggested semantic shape, not a mandated TypeScript name:

```text
currentTurnBuild: {
  turnNumber,
  visibleBuildLinesByPlayerId,  // built ships with source annotation where applicable
  concealedPlayerIds,           // before Reveal
  visibility: "requester_only" | "revealed"
}
```

The server must derive current-turn rows from its capture/build facts, not from the player’s present fleet alone: an upgraded/consumed ship, a produced ship, and a newly built ship have different Battle Log meanings.

## 5.2 Source of instant draft rows

During Drawing, the client can immediately overlay the local draft’s **manual** build choices and existing requester-visible prelude rows, using current client build presentation. The next server preview response can return a canonical ship-only build projection for that exact draft, including legal/skipped attempts, production, configuration, and source tags.

The overlay and returned rows must be alternatives for the same draft version, not additive lists; otherwise a clicked ship appears twice.

Server-side settled/revealed rows override the local overlay. A rejected or stale preview must not invent completed builds.

## 5.3 Visibility and lifecycle

Before Reveal, only the authenticated player receives own current-turn build details. A spectator receives no private side; a player cannot see the opponent through the new endpoint, full GET, or an intent response. Submission status is allowed where already public but never implies build content.

After Reveal, both players’ current-turn build rows are public to all authorized viewers. On resolution and archive insertion, coordinate with the existing history fetch so no matching turn appears both live and completed. Handle refresh during Drawing, Ready-waiting, Reveal hold, terminal resolution, and archive-fetch lag.

---

# 6. “This Turn” estimate semantics

## 6.1 Definition

For a player `P`, `thisTurn.damage` is the current best estimate of **P’s generated damage against the opponent**, and `thisTurn.healing` is the estimate of **P’s generated healing/sustain** under the same breakdown conventions used by Last Turn.

During Drawing the inputs are:

- the server’s current public turn context and authoritative known own state;
- the player’s submitted draft choices applied on a temporary copy;
- the opponent fleet **already public to this player at this point**, not a newer hidden fleet;
- only deterministic, currently knowable effects that will be available at end-of-turn under these assumed inputs.

After Reveal the inputs are the actually revealed current fleets and current public battle state, with later changes reflected when available.

Estimate status and source phase must accompany the numbers. A server-computed estimate is still provisional because its *inputs* cannot predict later opponent actions or charge choices.

## 6.2 Effect inclusion rules

Reuse canonical definitions and effect math for:

- automatic damage/healing from the assumed fleet;
- applicable once-only effects of ships built this turn, including server build/event facts;
- dice-dependent effects using the effective per-player roll already determined by the game;
- conditional effects with fully known inputs, e.g. Frigate’s configured trigger;
- Science Vessel adjustments, represented with breakdown rows that sum to the displayed total;
- reveal-produced Fighter contributions once deterministically known on the temporary build or actually present after Reveal;
- depleted Solar Grid’s ordinary automatic healing, if it is part of the normal current combat rules;
- self-damage as a signed sustain/healing breakdown where the canonical Last Turn breakdown uses that convention.

Exclude:

- ordinary charged power uses and pending charge declarations;
- charged Solar consumption, manual Solar casts, and Autocast’s charged results, even if a related Reveal action has already happened;
- speculative First Strike, destruction, steal, Black Hole, or opponent build decisions;
- direct Reveal health resets such as Redemption as “healing”;
- capped/uncapped future net health guesses.

Do not obtain the estimate by reading the current `pendingTurn` total unfiltered; it may already contain charge or other effects excluded by this contract.

## 6.3 Nontrivial parity cases

The server calculation must retain per-instance creation turn, removed/void ship history, build-created counters, and component consumption where canonical powers inspect them. Notable tests include:

- same-turn once-only powers, including a source later consumed in an upgrade;
- Queen’s count of ships made this turn and exclusion of its own produced Xenites where current rules require it;
- multiple Dreadnoughts and the current per-instance consumed-component exclusion when Reveal creates Fighters;
- a mixed fleet with Tactical Cruiser type-count effects and Fighter damage;
- Science Vessel tier multipliers and adjustment rows;
- opponent-sensitive OXite/Asterite and health-comparison effects using only viewer-visible inputs;
- permanent Frigate/Quantum configurations and Evolver conversions;
- Ancient Solar depletion vs charge use;
- all four species and foreign/copied ship combinations when relevant.

Avoid manually reconstructing a ship’s effect from its display label. If an effect cannot be evaluated safely with allowed inputs, mark that part or the estimate unavailable rather than silently showing a fabricated exact-looking amount.

## 6.4 Stable totals and breakdown rows

The sum of estimate damage breakdown amounts equals displayed estimated damage; the sum of healing/sustain rows equals displayed estimated healing under the existing signed convention. Preserve actual existing row ordering, labels, grouping, and Science Vessel adjustment semantics where possible.

Current actual `lastTurnDamageByPlayerId` is damage **received** by its keyed player. A This Turn player’s damage is damage **dealt to the other player**; map attacker and target correctly instead of reusing the target keyed field as if it meant dealt damage.

No estimate writes `lastTurn...` fields, modifies `powerMemory` on canonical state, creates real ships, spends lines/charges, sets readiness, advances phase, or changes health.

---

# 7. Server preview calculation and read-only request

## 7.1 Preferred request

Add one authenticated **read-only POST** for changed build drafts, for example `POST /build-preview/:gameId` in the existing server routes. The exact path can be selected during the reviewed server route pass.

Input should contain the current turn and the same compact build choices later used by `BUILD_SUBMIT`: ship counts, Frigate triggers, Quantum Mystic selections, and Evolver choices; optionally an opaque client request token. Never accept a client-supplied player ID, opponent fleet, raw server state, or requested visibility level.

The endpoint loads the current game once, derives identity from the authenticated session, checks player role, game status, turn, Drawing phase, prelude eligibility, and whether the player has already submitted. Bound and validate payload size/counts and reject malformed or obsolete requests without modifying the game.

For an unsubmitted player, calculate only that player’s estimate and current-turn build projection. For a submitted player, use the frozen **stored own submission** and ignore/reject new editable drafts; normal full-state refresh may carry this frozen projection instead. Do not permit a spectator or the opponent to preview somebody else’s unsubmitted choices.

Response: only the requesting player’s current turn/version identity, estimate status, own damage/healing totals and rows, and own build rows needed for presentation. Return no canonical state, hidden opponent counters, intermediate effect list, secret fleet, or opponent estimate before Reveal.

## 7.2 Simulation seam

Build a preview on a disposable, isolated state. Reuse or narrowly extract the current server build-order, ship-creation, power-collection, modifier, and breakdown helpers. It is acceptable to clone a bounded state and run existing mutation-oriented helpers **only if** no clone change is persisted, no hidden input influences output, and their side effects are understood and tested.

Do not run the complete normal `resolveBattleEndOfTurn` in a live GET/preview request: it also handles pending declarations, Black Hole destruction, actual health/victory and idempotency memory. Do not call `computePhaseComputedEffects` on the canonical in-memory object merely to “read” it; it can update once-only memory.

The estimator can evaluate only the requesting player’s relevant effects after constructing a safe opposing context. In particular, it must not calculate from the canonical opponent fleet and then remove an opponent field from the response: hidden fleet types/health/build counters can leak through the requester’s own totals.

## 7.3 Request frequency and failure behavior

The client should debounce edits (initial target roughly 150–300 ms, tune in the client pass), send one current payload per settled change, and cancel or ignore obsolete responses. It must not make a fresh request every head poll or persist a draft per click.

Heavy simulations and client requests should remain bounded; the small wire payload does not by itself guarantee low server CPU or database cost. Inspect request latency and server behavior during implementation. Back off on failure/429 and give the player a non-misleading unavailable state; build and Ready must remain functional if this optional estimate fails.

The preview is advisory. `BUILD_SUBMIT` still independently validates and applies the submitted payload through the authoritative reducer.

---

# 8. Visibility and DTO contract

## 8.1 Before Reveal

`requester` may contain the authenticated player’s frozen own build/estimate after submission; a draft preview response contains only that player’s own version. Public DTO fields must not include opponent build details or either player’s private pre-reveal estimates.

The current Drawing-prelude fleet projector, `projectDrawingPreludeFleetsForViewer`, returns the viewer’s fleet and the last public snapshot for the other side. Treat that as a **visibility policy**, not a shortcut for a full safe simulation state. Other canonical fields—current-turn production counters, removed ships, power memory, internal capture atoms, temporary declarations—must be audited or explicitly reset/projected before effect calculation.

No private output may appear in `publicState`, raw legacy response fields, intent response state/events, a spectator response, or the persisted head. Test all relevant surfaces for the new fields.

## 8.2 At Reveal and afterward

Once the same existing all-submitted/reveal barrier is satisfied, the full game-state DTO can include a two-sided public `thisTurn` estimate and two-sided current-turn build projection. This public version comes from revealed authoritative fleets and is available to authorized spectators. The client’s changed-head poll causes a full-state refresh; the head itself stays small.

If later authoritative fleet/state changes affect the estimated calculation before resolution, a subsequent full-state refresh may revise the estimates. Still exclude charged effects by origin.

`intent_routes.ts` uses a separate sanitizer from `game_routes.ts`. If implementation adds these projections to any intent response, explicitly apply the same privacy rules there. The simpler default is to keep preview data in the preview response and full-state DTO, then refresh after an accepted submit; never pass new internal preview data through the raw intent state by accident.

## 8.3 After resolution and after terminal changes

The client must distinguish:

- **current unsubmitted / frozen / revealed estimate**;
- **resolved current turn with actual Last Turn data**;
- **terminal match without a resolved current turn**.

Use turn identity and canonical resolution/finalization markers, not merely `status === "finished"`, to decide whether the actual label is Final Turn. Completed history and current-turn build presentation should hand off without duplicate rows.

---

# 9. Client runtime and asynchronous behavior

## 9.1 One payload path and one networking owner

Use a shared client helper to produce the build-choice payload for both preview and final `BUILD_SUBMIT`. The preview request may explicitly mark incomplete draft configuration (e.g. QUA number awaiting selection) and return an unavailable estimate until the choice is complete; it must not silently substitute a number or weaken final submission validation.

Networking lives under `src/game/client/**`, likely coordinated from `useGameSession.ts` with a small dedicated client runtime hook/helper if that improves isolation. `src/game/display/**` consumes the resulting view model.

Keep the existing instant local fleet preview for ship rendering and immediate own manual Battle Log updates. Server responses supply the rule-heavy numbers and settled ship rows. The client does **not** reconstruct damage/healing rules locally.

## 9.2 Request and response identity

Tag local requests with `gameId`, `turnNumber`, a locally increasing draft generation/token, and the current payload fingerprint. The server returns its source revision/phase/turn. A response is displayable only if it matches the still-active game/turn/draft and was computed in an appropriate phase.

If the player edits twice rapidly, submits, the opponent reveals, switches game, or a response arrives after the turn changes, discard the old response. Submission freezes the display from the frozen payload; after reveal, authoritative full-state data supersedes any in-flight private draft result.

Do not let a stale preview overwrite an authoritative revealed or actual stat, even if the stale request completes last.

## 9.3 Pending and errors

Own Battle Log manual ship rows should react immediately. Numbers may show a subtle pending indicator during calculation; do not present the previous draft’s amount as if it belongs to the new draft. A failed preview may show `—` / “Estimate unavailable” while the player can still build and submit.

On refresh while unsubmitted, reconstruct the draft according to existing client draft persistence, then request a matching estimate; on refresh while committed, use the server’s own frozen projection. Avoid a flash of opponent details or of a previous turn’s estimate.

---

# 10. Desktop and mobile presentation gates

## 10.1 18B — Battle Log detailed visual spec required

Before Codex plans the client Battle Log pass, obtain Judd’s spacing, row height, type sizes, separators, padding, own/opponent alignment, concealed placeholder, scroll/pinning behavior, and mobile takeover treatment.

The supplied desktop mockup establishes a separate grey live row directly below Battle Log names, above the completed archive. Decide with Judd whether that row remains pinned while historical turns scroll, and exactly how it appears on small screens.

Pass 18B should be able to consume the live summary without reaching into server internals.

## 10.2 18F — Desktop and responsive middle stats detailed visual spec required

Before Codex plans the desktop stats pass, obtain exact positions/spacing/typography at the live app’s breakpoints, including the narrow center column, the tooltip trigger/hit area, hover card placement, hidden/pending values, and treatment when Last Turn has no predecessor.

The revised mockup establishes the intended **order and grouping**: Health; Saved Lines; Bonus; Last Turn Damage and Healing; This Turn Damage and Healing. It shows `~13`, not the earlier `~14`. Exact coordinates and breakpoint rules remain for Judd’s pass-level spec.

Review status of the two side columns, varying numerical widths and negative values, long breakdown labels, and very tall/small windows. Preserve accessibility for the information tooltip.

## 10.3 18G — Mobile modal detailed visual spec required

Before Codex plans the mobile stats pass, obtain exact modal sections, padding, responsive height/scroll limits, anchor/arrow placement, dismiss behavior, and touch target sizes. Confirm with Judd the opponent modal’s post-Reveal This Turn treatment.

The supplied mobile mockup shows own modal sections in this order: Saved/Bonus, Last Turn Damage/Healing, and separate This Turn Damage/Healing; the own estimate area uses an additional divider and background treatment. The opponent modal is shorter in the example. Keep the actions/game controls usable when the modal is open.

The mobile view consumes the same server-authored numbers and breakdowns; it has no separate damage/healing evaluator.

---

# 11. Recommended implementation sequence

Seven main passes, each planned and reviewed separately. Candidate filenames are audit leads, not blanket editing permission. Tests can be added inside each pass’s corresponding ownership folder.

## Phase 18A — Server current-turn Battle Log projection

**Pass type:** Server Pass  
**Goal:** Create a private/revealed, ship-only current-turn build projection without altering completed history.

### Candidate file plan

- `src/supabase/functions/server/engine/state/battleLogHistory.ts`: project current capture/build atoms into ship-only live rows, preserving source tags and turn identity.
- `src/supabase/functions/server/routes/game_routes.ts`: expose requester-only versus revealed rows through the full-state DTO, or a narrowly factored projection helper.
- Focused tests in `src/supabase/functions/server/tests/engine/state/**` and `tests/routes/**`.

### Required behavior

- Include manual, produced, Drawing-prelude, and Reveal-time build rows when those events have occurred.
- Filter out reroll/chronoswarm/cube interventions and battle actions from the live ship list.
- Hide opponent rows before Reveal from players and spectators; publish both only after the existing barrier.
- Do not alter `BattleLogTurnSummary`, completed-turn count, archived turns, persisted scratch schema, or the head.

### Validation target

Two independent viewers and a spectator see only allowed rows at Drawing, one-submitted, Reveal, resolution, and refresh. No completed-history duplication.

### Does not include

Client display, provisional draft ship overlay, or damage/healing preview.

---

## Phase 18B — Client Battle Log live row

**Pass type:** Client/UI Pass  
**Goal:** Display the separate This Turn ship-build area, with immediate own draft updates and safe concealment.

### Entry gate

**Remind Judd to supply the detailed Battle Log visual spec before Codex makes its file plan.**

### Candidate file plan

- `src/game/client/gameSession/types.ts`, `battleLog.ts`, `mapVm.ts`, and `useGameSession.ts` for live-row view model plus local draft overlay.
- `src/game/display/shared/BattleLogPanelContent.tsx` and existing desktop/mobile host components for the specified layout.
- Focused client mapper/display tests if the projection or handoff warrants them.

### Required behavior

- One live row above archived turns; correct names/orientation for players and spectators.
- Own draft builds respond to edits without waiting for a server stat request; no accidental duplicate when authoritative rows replace the overlay.
- Opponent stays concealed before Reveal even if the opponent submits first.
- When matching archive turn arrives, remove the live row without changing archive count.

### Does not include

Client combat formulas, server rules, or final desktop/mobile stat layouts. 18E may later feed canonical draft ship rows from the preview response through this same view model.

---

## Phase 18C — Server estimate evaluator and parity tests

**Pass type:** Server Pass  
**Goal:** Produce read-only current-turn damage/healing estimates from a temporary visible-state simulation using canonical server rules.

### Candidate file plan

- Narrow new helper under `src/supabase/functions/server/engine/state/**` or `engine_shared/resolve/**`, placed after Codex audits which layer owns the existing reusable functions.
- `src/supabase/functions/server/engine/intent/buildSubmitResolution.ts` and `engine_shared/resolve/resolvePhase.ts` only for narrowly justified helper extraction or safe simulator access.
- Existing `phaseComputedEffects.ts`, `drawingShipCreation.ts`, and `applyEffects.ts` only where required for a canonical parity seam; avoid broad refactors.
- New focused `src/supabase/functions/server/tests/**` fixtures.

### Required behavior

- Compute a player’s draft build on an isolated copy, then damage/healing and grouped rows from allowed effects.
- Project public opponent context **before** applying any opponent-dependent calculation; carry the correct own creation/removal counters.
- Exclude charges/Solar casts and any already accumulated pending charge amount.
- Identical safe inputs produce identical estimates; repeated preview calls leave canonical state and history untouched.
- Parity fixtures compare estimator against actual authoritative resolution under matched, no-further-actions conditions. Where the deliberate omissions cause a difference, assert the difference.

### Does not include

An HTTP endpoint, broad changes to gameplay effects, client networking, or UI.

---

## Phase 18D — Server preview endpoint and reveal DTO

**Pass type:** Server Pass  
**Goal:** Make the estimator available safely to the requester during Drawing and to authorized viewers after Reveal.

### Candidate file plan

- `src/supabase/functions/server/routes/game_routes.ts` or a narrowly registered route module for the authenticated, read-only POST.
- `src/supabase/functions/server/routes/intent_routes.ts` only if a new projection touches its response; otherwise document its unchanged sanitizer and test no leakage.
- `src/supabase/functions/server/engine/state/drawingPreludeProjection.ts` or small projection helper if needed for viewer-visible inputs.
- Route tests under `src/supabase/functions/server/tests/routes/**`.

### Required behavior

- Same small choices as BUILD_SUBMIT; authenticated session determines player.
- Enforce phase, turn, role, commitment, bounded payload, and visibility.
- Do not persist previews, increment `stateRevision`, alter clocks/readiness, or change the persisted game head.
- Requester gets only their own estimate before Reveal, including frozen own estimate while committed if delivered via GET.
- After Reveal full GET carries both estimates; spectator sees nothing early and both after reveal.
- Reject/drop a preview requested for a phase or turn that changed; surface no hidden opponent-dependent value.

### Does not include

Client requests or presentation.

---

## Phase 18E — Client preview networking and view-model integration

**Pass type:** Client/UI Pass, client runtime focused  
**Goal:** Wire changed local build choices to the server preview and map returned estimates to board and Battle Log view models.

### Candidate file plan

- `src/game/client/gameSession/intents.ts`: share build-choice payload construction without weakening final submit.
- `src/game/client/gameSession/clienteffects/useBuildDraftSync.ts`: inspect whether its no-op stub is an appropriate narrow home; do not force a broad refactor.
- `src/game/client/useGameSession.ts`, `gameSession/types.ts`, `mapVm.ts` and a small networking helper/hook if appropriate.
- Focused client tests for debouncing, supersession, freeze, reconnect, and turn/phase changes.

### Required behavior

- Debounced direct POST on changed draft; no polling-upload loop.
- Immediate local ship rows; server-provided numbers and settled ship rows only when identity matches the current draft.
- Ready freezes own values; reveal full-state data supersedes private preview; actual completed stats supersede estimate.
- Distinguish zero, hidden, pending, unavailable, and actual; no wrong-turn flashes.
- Failure of the optional estimate does not block drawing or Ready.

### Does not include

Desktop or mobile spacing/visual polish; no combat formula in client runtime/display.

---

## Phase 18F — Desktop and responsive stats presentation

**Pass type:** Client/UI Pass  
**Goal:** Apply the rethought center-column order and desktop breakdown presentation across existing breakpoints.

### Entry gate

**Remind Judd to supply the detailed desktop and responsive visual spec before Codex makes its file plan.**

### Candidate file plan

- `src/game/display/layout/BoardStage.tsx` and its actual current hover-card/hover-state components.
- `src/game/client/gameSession/types.ts` / mapping only if 18E left a small presentation seam to finish.
- Existing relevant display styles/tests, without altering Tailwind/Vite config.

### Required behavior

- Implement ordered groups from `10.2` with both sides’ visibility states.
- Own estimate and opponent `?` before Reveal; both estimated after Reveal.
- Breakdown tooltip/hover rows, approximation marker, readable narrow-column layout.
- When actual final resolution exists, one Final Turn set replaces overlapping Last/This Turn sections.

### Does not include

New server calculations or a mobile modal redesign.

---

## Phase 18G — Mobile stat breakdown modals

**Pass type:** Client/UI Pass  
**Goal:** Apply the reordered mobile breakdown modal and own This Turn area without duplicating the estimator.

### Entry gate

**Remind Judd to supply the detailed mobile visual spec and confirm opponent post-Reveal treatment before Codex makes its file plan.**

### Candidate file plan

- `src/game/display/mobile/MobileStatBreakdownPopovers.tsx` and `MobileGameLayout.tsx`.
- Existing mobile anchor/dismissal helpers and presentation tests if needed.
- View-model changes only if strictly required by the reviewed mobile spec.

### Required behavior

- Saved/Bonus then Last Turn, with a separate This Turn section on the own modal while estimated.
- Correct hidden/pending/revealed/final state; no private opponent build or stats leak.
- Scrollable/anchored content usable at short viewport heights, long labels, and touch sizes.
- Final Turn actuals appear once with no stale approximate section.

### Does not include

Server changes, separate mobile power math, or unrelated actions/catalogue redesign.

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

Follow the current `CodexPassTemplate.md` rule: Codex does not run the Vite dev server, browser automation, or manual UI verification unless Judd explicitly requests it. Report: **“Not run — browser/Vite testing handled by user.”** Judd reviews the visual behavior in the live app at the design checkpoints and after the relevant passes.

## 12.2 Server behavioral matrix

At minimum prove:

1. Both player identities and a spectator receive the correct current-turn rows before/after Reveal, including first-submitter waiting.
2. Hidden opponent prelude/build information cannot affect a requester’s estimate. Construct two canonical states with identical viewer-visible data but different hidden opponent fleets/counters; their pre-Reveal response must be identical.
3. Draft simulation causes zero persistent writes, no revision/head changes, no consumed charges, no readiness/clock/health/once-only-memory changes.
4. No-op draft, a single manual build, mixed produced/manual builds, upgraded/component consumption, configured FRI/QUA, EVO conversions, Queen, multiple Dreadnoughts, Science Vessel modifiers, and opponent-dependent effects give the intended rows.
5. Automatic depletion healing where applicable is included; charged Solar/ordinary effects are omitted; actual resolved Last Turn includes charge contributions.
6. Rows sum to totals. Self damage and health-cap cases distinguish generated healing from net health.
7. Bad role, wrong phase/turn, malformed/oversized payload, submitted replacement attempt, and request racing Reveal return safe behavior.
8. Refresh and final-turn archiving preserve turn identity; surrender/timeout before current-turn resolution do not fabricate Final Turn actuals.

## 12.3 Concrete product walkthrough

| Point | Battle Log | Middle stats | Source |
| --- | --- | --- | --- |
| Drawing, no draft | Own current-turn production if any; opponent concealed | Own estimate once available; opponent `?` | Requester-safe GET/preview |
| Add two Tactical Cruisers and three Fighters in illustrative mock state | Own build rows change immediately | New valid response can show `~13` damage with 10 + 3 rows | Read-only POST; rule value depends on actual assumed fleet |
| Edit while older request is in flight | Show newest own draft | Pending/newest response only; never old response | Client draft generation |
| Submit first | Own frozen rows, opponent concealed | Own frozen estimate, opponent `?` | Stored own commit via requester projection |
| Both submit / Reveal | Both players’ actual built-ship rows | Two-sided estimates; `~` remains | Public full GET after changed head |
| Charge declaration and eventual turn resolution | History receives resolved actions and build summary | Last Turn actuals include charge results | Existing authoritative resolution/archive |
| Resolved terminal turn | Last completed turn in archive | One actual **Final Turn** set | Canonical last-turn stats and resolved-turn marker |
| Terminal without resolving current turn | No invented completed current turn | No fabricated Final Turn damage/healing | Canonical completion reason/turn markers |

The example `~13` applies only to the pictured test state; never hardcode those numbers.

## 12.4 Client race and recovery cases

- Rapid add/remove/add with responses arriving in reverse order.
- Submit while debounce timer or preview POST is in flight.
- Opponent’s Reveal arriving between a preview load and its response.
- Reload during own Drawing, one-submitted waiting, Reveal hold, and end-of-turn hold.
- Switch game or seat, spectator join, bot opponent, and untimed idle/hidden polling.
- Network failure and retry/backoff without blocking BUILD_SUBMIT.
- A new turn while the previous turn’s history refresh is pending.

---

# 13. Risks and review decisions

## 13.1 Main server complication: visibility is an input rule

Returning only own fields is insufficient if own output depends on hidden opposing ships. The server must calculate pre-Reveal estimates in a consciously constructed **viewer-visible** context and prove noninterference with hidden changes. This is the highest priority server test gate.

## 13.2 Main calculation complication: read-only reuse

Current build and battle helpers have side effects on the supplied state. Reusing them safely requires isolated state, narrow extraction where appropriate, correct per-instance events, and explicit excluded charge sources. A preview that calls real turn resolution indiscriminately can cause incorrect rows or secret-derived values even without saving the clone.

## 13.3 Main client complication: timing and dual sources

The local fleet/log changes immediately, while the numeric estimate arrives asynchronously. Submitted/frozen, revealed, and resolved data arrive through different paths. Tie each to game, turn, visibility phase, and draft generation; design the handoff before writing display conditionals.

## 13.4 Performance posture

An authenticated POST for a settled edit is reasonable; a write on every click or full-state refresh every two seconds is not part of this plan. The code review should measure/query the cost of loading a game and simulating a draft. If the simulation is too costly, optimize the read-only computation or request cadence inside the dedicated pass rather than sacrificing privacy or client/server parity.

## 13.5 Visual spec remains deliberately open

The updated mockups lock order, emphasis, and example content. Judd will supply exact responsive spacing and interaction behavior at 18B, 18F, and 18G. Codex should surface any conflict with actual center-column width, mobile viewport, or existing modal anchors in those pass plans.

---

# 14. Completion criteria

Phase 18 is complete when:

- own ship builds appear live in a distinct Battle Log current-turn area, including produced builds, with the opponent concealed until Reveal;
- after Reveal both ship-build sides populate, and the live row hands off to one completed history row without duplication;
- a changed unsubmitted build obtains its own server-calculated damage/healing estimate and grouped rows from a read-only request;
- no large independent client combat evaluator is introduced;
- preview requests never commit, persist, advance, consume, or alter canonical game state/head;
- before Reveal no player or spectator can infer hidden opposing builds from any new row, statistic, endpoint, or response shape;
- after Reveal both sides receive estimates from public authoritative state; charges remain absent from estimates and appear in actual resolution;
- stale, failing, and racing requests cannot overwrite a newer draft, Reveal, completed turn, or different game;
- desktop and responsive stats follow the supplied detailed spec at 18F and preserve readability;
- mobile modals follow the supplied detailed spec at 18G, with own This Turn breakdown and correct touch/scroll behavior;
- terminal resolution replaces estimate/Last Turn duplication with a single actual Final Turn set, without mislabeling a prior turn after an unresolved termination;
- the focused server/client regression tests and appropriate type/build checks pass; and
- Judd has been reminded for, supplied, and reviewed the detailed visual specs at the three client presentation checkpoints.
