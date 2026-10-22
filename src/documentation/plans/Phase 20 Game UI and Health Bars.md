# Phase 20 — Game UI Updates and Health Bars

## Planning baseline and scoped implementation roadmap

- **Owner:** Judd Madden
- **Status:** Approved direction; implementation details remain subject to owner review at each pass
- **Prepared:** 2026-10-21
- **Audited source:** supplied `1020.zip`
- **Phase 20A:** Game UI Updates — implementation and automated validation complete through 20A.7; final owner visual acceptance pending
- **Phase 20B:** 20B.1–20B.4 implemented; 20B.4 visually reviewed by the owner. 20B.5 desktop live integration, reliable-capture/cross-turn correction, final-to-final number refinements and responsive lower-row reservations are implemented; automated checks pass and owner browser review is pending. The static legend-width test follows the owner's responsive widths. 20B.6 compact mobile live integration is implemented and automated validation passes; owner visual acceptance is pending. Remaining 20B.7 work is incomplete.
- **Architecture:** server-authoritative gameplay; client-owned presentation
- **Suggested repository location:** `\src\documentation\plans\Phase 20 Game UI and Health Bars.md`

> This is the main planning baseline, not permission to implement every pass in one operation. Judd will supply designs and review individual pass plans and implementations. At Judd's discretion, an approved individual pass plan may change the scope, sequence, measurements or behaviour proposed here. Further responsive requirements are expected. Preserve all existing behaviour unless a change is explicitly part of the approved pass.

Implementation notes below are historical pass records. For the current Phase A contract, the 20A.4 refinements supersede the original bar-height cap, spacing and wide combat cards; 20A.6 supersedes interim mobile inspection; 20A.7 supersedes earlier desktop numeric typography and selector-based positioning notes. Earlier validation counts describe those passes only.

The 20B.3 reference-keyframe refinement below supersedes the initial generic red/green overlap and travelling surplus-window examples. Its value intervals and stage boundaries are owner-confirmed requirements for 20B.4; durations and interpolation remain for that later pass.

The subsequent negative-final continuity correction supersedes the blanket retained-red removal described in the earlier refinement record. Full removal applies only to a recovering player whose final health is zero or positive; negative finals continuously retain their remaining red through clearance and settling.

### 2026-10-23 — Client/UI feature: terminal outcome letters

- **Scope:** terminal lettering in the display layer, with narrow optional-result projection through existing client health snapshots, focused existing tests and this record. This is a separate feature pass before broader **20B.7 cleanup and owner visual acceptance, which remain pending**. Server authority, gameplay, networking, preferences, sound, layout dimensions, Graphics Test examples and tooling are unchanged.
- **Canonical contract:** recognised finished outcomes map decisive/resignation/timeout wins to `V/L`, narrow wins to `NV/NL`, and mutual-destruction/agreement/timeout draws to `D/D`. Mapping uses player IDs, including reversed requester seats and spectators; mobile retains right/opponent above left/viewer. Active games, restart/unknown endings, missing/mismatched identities and contradictory results have no letters. Health never determines lettering, including `0/−5` narrow finishes and equal/unequal negative finals. Existing result envelopes omit a win/draw scalar: recognised reason plus valid winner identity remains supported, while explicitly supplied scalars are preserved and validated. Optional omission does not invalidate otherwise compatible boundary-cap capture.
- **Reveal ownership:** the existing session hook above layout branches owns paired opacity on an elapsed-time scheduler. Terminal health letters remain absent through scale/contribution motion and the complete final-to-final number tail, then fade together linearly for **400ms**. Non-health finishes wait for relevant accepted presentation without inventing contributions. Already-finished loads, unsupported settled playback, recovery and reduced motion settle immediately. Polls, source release, layout switches and ordinary rerenders cannot replay the fade; generation/identity guards cancel stale callbacks, including on disposal. Re-enabling motion cannot replay a reduced-motion finish. The existing completion receipt/navigation gate is unchanged and releases before the visual fade; Missions remain manual-only.
- **Rendering/tuning:** `HealthBar.tsx` anchors to shared mapped zero, above it on desktop and to its right on mobile. `HEALTH_BAR_OUTCOME_DESKTOP_ZERO_OFFSET_PX` and `HEALTH_BAR_OUTCOME_MOBILE_ZERO_OFFSET_PX` both start at **4px**. Bold single-line text starts at **12px desktop / 9px mobile**. A light glyph over the dark track and an identical dark copy clipped to the exact white-fill rectangle preserve contrast through small positive fills without following the endpoint. The zero marker stays above the noninteractive, absolute lettering. Full outcome meanings appear in existing bar descriptions; opacity frames add no live announcements. The 46px mobile pair, desktop responsive spacing, legends and retained negative scale are preserved.
- **Timing location:** `healthBars/healthBarAnimationConfig.ts`, `HEALTH_BAR_ANIMATION_CONFIG.outcomeLetterFadeMs = 400`; existing bar/number timings are unchanged.
- **Validation:** `npm run typecheck`, `npm run test:client` (**734 passed, 50 files**) and `npm run build` pass. The existing non-blocking >500kB chunk warning remains. Focused tests cover canonical reason/result validation, optional scalar capture/compatibility, exact-zero and negative finals, both seats/spectators, active suppression, post-number paired fade boundaries, initial loading, unsupported playback, recovery during motion/fade, source release/duplicate publications, actual desktop/mobile entry switching, stale callbacks, effect reattachment, reduced-motion settlement/re-enabling, zero-relative resize/endpoint behavior, white-fill clipping, zero layering, accessible descriptions and direct renderer props. Existing popover/takeover and manual Mission tests also pass.
- **Owner checks:** desktop/mobile zero-relative placement at short/long axes and shifted negative scales; `NV/NL` fit; contrast across tiny positive fills and dark tracks; zero-marker visibility; no reveal before number completion; a paired 400ms fade that continues through layout/popover/takeover changes without delaying result navigation. Written placement/contrast instructions supply initial values; visual acceptance remains pending.
- **Not run — browser/Vite testing handled by user.**

| Changed area | Files |
| --- | --- |
| `src/game/display/healthBars/` | `HealthBar.tsx`, `useSessionHealthBarPresentation.ts`, `healthBarAnimationConfig.ts`, new pure `healthBarOutcomePresentation.ts` |
| `src/game/display/` | `layout/BoardStage.tsx`, `mobile/MobileStatusRail.tsx` (direct outcome props only) |
| `src/game/client/gameSession/` | `types.ts`, `resolvedHealth.ts` (optional result presentation metadata only) |
| Existing tests | Client `tests/gameSession/resolvedHealth_test.ts`; display `tests/sessionHealthBarPresentation_test.ts`, `tests/sessionHealthBarLifecycle_test.ts`, `tests/healthBarRendering_test.ts`, `tests/layout/boardLayoutRefs_test.ts`, `tests/mobile/mobilePopoverRendering_test.ts` |
| Documentation | This Phase 20 planning document |

### 2026-10-22 — Client/UI refinement: retained negative scale and bounded legends

- **Scope:** display-only refinement, separate from the later 20B.7 cleanup/consolidation pass. This record and sections 11.4–11.5 supersede earlier negative-contraction and unbounded-desktop-label policies. **20B.7 remains incomplete.**
- **Retention owner:** the mounted live session presentation hook keeps only `{ gameId, negativeFloor }`, separately from controller playback identity, snapshots and completion receipts. Successful live acceptance commits the complete paired prepared minimum, including transient damage-stage lows followed by positive recovery. Valid selected settled fallbacks can deepen it too. Rejected/blocked candidates, hidden DTOs and animated intermediate values cannot deepen it.
- **Lifecycle:** first −2 prepares −5; −37 expands to −40; shallow or positive later health retains −40; −47 expands to −50. Existing outward rounding in fives applies. Incoming, outgoing/start-scale and settled fallback preparation all receive the retained floor. Release, next turns, reconciliation, resize, orientation changes, temporary absent context and same-game recovery retain it. A different game resets it; playback resets still clear stale snapshots and receipts. This memory is not shared with independent Graphics Test scenarios. Full reloads start from available current facts; no storage or missed-resolution reconstruction/replay is added.
- **Mapping:** both players and orientations use shared immutable prepared geometry, with existing positive-space protection/compression and coordinated transitions. Contributions retain frozen mappings. Positive bounds continue to follow represented health and authoritative caps and may contract; unused healing does not permanently expand them.
- **Legends:** shared `HEALTH_BAR_LEGEND_LABEL_LIMITS` sets mobile **9** and desktop **10** numeric labels maximum. Coarsen readable regional steps before exceeding the budget. Keep zero, exact positive top and useful negative context; small −5 domains label −5 without forcing −5 into larger-range increments. Mobile defaults remain `0, 5, 10, 15, 20, 25, 30, 35`; mobile −40 to 35 remains `−40, −30, −20, −10, 0, 10, 20, 30, 35`. Tick positions continue to use the shared mapper.
- **Transitions:** prepare numeric selections once per sequence/orientation/axis configuration. Reserve zero, both endpoint tops and negative context. When the full union exceeds the budget, retain deterministic mapped coverage and stage optional outgoing fades before incoming optional fades occupy the freed slots. Mandatory anchors keep ordinary crossfades; full bounded endpoint legends are used at the endpoints. No per-frame tick reselection or geometry/timing changes.
- **Preservation:** retain the owner's current **46px mobile pair**, including its existing gaps/padding, desktop responsive widths, mobile typography, number/delta behavior, terminal handoff and interactions. Renderer/layout, server, networking, browser storage, tooling and animation configuration are unchanged. Earlier 38px descriptions below are historical, superseded by the owner's supplied layout.
- **Validation:** `npm run typecheck`, `npm run test:client` (**684 passed, 50 files**) and `npm run build` pass; the existing >500kB chunk-size warning remains. An owner-authorized test-only follow-up updated the three stale `healthBarRendering_test.ts` assertions to the confirmed mobile grey-50 text and 9px font and renamed the misleading 38px live-pair test title. Renderer/styles and the 46px live pair remain unchanged. Focused coverage includes negative expansion/non-contraction, both players' transient lows, settled reconciliation (including returning to old finals without reviving a shallower completed mapping), same-game recovery/new-game reset, outgoing fallback, stale/rejected candidates and receipts, orientation/axis changes, immutable mapping, authoritative health/caps, independent gallery scenarios, and static/transition label budgets across representative and extreme finite ranges.
- **Not run — browser/Vite testing handled by user.**

### 2026-10-22 — 20B.6 compact mobile live health bars

- **Pass type:** Client/UI; display, one internal runtime option rename, focused existing tests and this plan. Server, networking, gameplay, holds/clocks, dice timing, Ready/input restrictions, desktop styles/manual widths, Graphics Test defaults and animation configuration remain unchanged. Broader 20B.7 work remains incomplete.
- **Shared ownership:** `GameScreen` still owns exactly one session health-bar controller above conditional layouts. Orientation-aware selection exposes the accepted frame's prepared desktop/mobile scale, shared rectangle states, final-to-final numbers, paired deltas and completion. Horizontal legend selection uses the same captured previous/current mobile scales and scale progress. Layout switching, source release, ordinary polls, dice publication, next-turn actions, popovers and takeovers do not reset or replay accepted work. Capture, deduplication, recovery, supersession and reduced-motion behavior are retained.
- **Compact dimensions:** mobile upper/lower bars have **10px inner height, 2px padding on every side and 14px outer height**. The shared legend lane is **10px**, making the pair **38px total without internal gaps**. Legend labels remain 10px, regular weight, line-height 1 and grey-50; opt-in compact spacing removes vertical label padding. Gallery and desktop defaults are unchanged. Both bars/legend share the actual existing left status-column width minus 4px, measured initially and through `ResizeObserver`/window resize. Endpoint labels overflow without driving flex width or adding page scrolling. The right 56px dice/clock column and flexible fleet allocation are retained; unavailable presentation keeps a neutral 38px band, and species selection retains its divider.
- **Ordering/rendering:** upper is logical right (displayed opponent/P2); lower is logical left (viewer/displayed P1). Caps, rectangle states, numbers, actual-net deltas and accessible labels follow the same ownership without changing captured player order. Auxiliary markers face above the upper bar and below the lower bar independently of cap ownership. Existing mapping, five-unit outward rounding, positive protection, cap/compression cues, square rectangles, flat grey-90 tracks and the white 3px zero marker above contributions are unchanged.
- **Numbers/deltas:** mobile consumes the same number stream as desktop: previous authoritative finals hold through every bar stage including surplus return, followed by the existing 300ms final-to-final number tween. Only displayed text is rounded. Both captured actual-net deltas reveal at bar completion. Delta lines stay reserved and hidden deltas are not announced; tabular numbers reserve the larger captured endpoint width during playback. Authoritative breakdown/estimate inputs, health/stat buttons and explicit anchors remain independent. Bootstrap/recovery values are direct; cap-only reconciliation retains valid deltas, while unrelated authoritative health suppresses stale deltas.
- **Terminal handoff:** internal `healthBarsEnabled` replaces the desktop-only option, enabling the existing identity-checked receipt gate in both layouts. Mobile's raw `endOfGame` fallback also respects pending bar/number presentation before automatic finished-panel handoff. Canonical finished state and manual navigation remain available; no gameplay hold, clock, dice or interaction lock is extended. Postgame Missions remain manual-only.
- **Validation:** `npm run typecheck`, `npm run test:client` (**660 tests across 50 files**) and `npm run build` pass. The existing non-blocking >500kB chunk-size warning remains. Coverage exercises both orientations' live lifecycle/selection, negative recovery/finals and surplus, cap reconciliation/stale deltas, player-seat/spectator upper/lower ownership, measured mobile width/legend density and zero alignment, five-unit rounding, compact geometry and outward markers, final-to-final numbers/paired deltas, desktop/mobile switches during motion and the number tail, reduced motion/recovery/supersession/stale receipts, mobile terminal handoff, real popover/takeover callbacks and manual postgame Missions. Existing desktop/controller/static/animated gallery tests pass. Element/style assertions verify contracts, not browser geometry or visual pacing.
- **Not run — browser/Vite testing handled by user.** **20B.6 implemented; owner visual acceptance pending.** Owner checklist: compact fit and endpoint labels at supported widths/short heights; opponent/viewer and spectator ordering with unequal caps; uninterrupted motion and number-tail switching; health/stat taps, paired popovers, dice/helpers, fleet targeting/inspection, action panels, chat/log/menu takeovers and manual Missions. Remaining 20B.7 outcomes/preferences/tuning work stays incomplete.

### 2026-10-22 — 20B.5 refinements: final-to-final numbers and stable lower rows

- **Pass type:** Client/UI; display and this planning update only. This record supersedes earlier desktop main-number policy and completion descriptions. Server facts, networking, rules, clocks, dice, Ready availability, phase progression, mobile, Graphics Test, reviewed bar sequences/mapping/palette/timings and manual layout adjustments remain unchanged.
- **Numbers:** `SessionHealthBarPresentation.numbers` is separate from rectangle frames. Both numbers hold captured authoritative starting health through scale preparation, damage, healing, clearance and surplus return. Only after full bar completion do changed numbers count directly to captured canonical finals with intermediate integer text, using the existing easing helper. Unchanged numbers skip movement. Unrounded values remain inside the controller; only displayed text is rounded. Bootstrap, refresh and recovery show authoritative settled numbers directly without replay.
- **Timing configuration:** `src/game/display/healthBars/healthBarAnimationConfig.ts`, `HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs = 300`. The optional production desktop tail uses the existing controller, injected scheduler, elapsed-time timeline, immutable capture and generation guards; it adds no second resolution lifecycle. Default controller/gallery behavior is unchanged. Duplicates, source release, polls, resize and next-turn interactions retain the captured work. Newer resolutions, identity/recovery, reduced motion, stop and disposal preserve cancellation; late frames catch up without a replay backlog. Reduced motion settles immediately, including during the number tail.
- **Completion:** existing bar completion still reveals captured actual net deltas after all bar motion, including surplus return. Separate overall presentation completion waits for the number tail. The session hook sends the existing identity-guarded terminal receipt only at overall completion; `MainStage` uses that same boundary before covering the board with Mission results. Captured ownership continues through the tail before normal settled reconciliation. Existing gameplay timing and locks are independent.
- **Responsive rows:** Saved reserves one metric label line; Bonus reserves two, even for missing/one-line labels and absent joining metrics. Row envelopes combine the existing 20/24/28/32px numeric line at its existing breakpoints with one/two lines of the existing 11px label typography using CSS `lh` units. Empty metric label reservations have no accessible text. Saved/Bonus envelopes and yielding separators remain mounted while existing gates withhold all contents. Fleet reserves its 18px row only at widths of at least 1400px, with no space below that breakpoint. No hidden statistics or focus targets are rendered. Horizontal placement, outward clusters, hover anchors, explicit refs, dice/helpers/guidance, delta `min-h-[1em]` and `X?` formatting remain intact. Bars still fill remaining height with the existing minimums and compressible spacers; no height locking or measurement loop is added.
- **Validation:** `npm run typecheck`, `npm run test:client` (**623 tests across 50 files**) and `npm run build` pass. The existing non-blocking >500kB chunk-size warning remains. Controller, session lifecycle/selection and layout coverage exercise final-to-final movement, separate visible/accessibility numbers versus rectangle frames, negative excursion/finals, healing, unchanged health, surplus, paired completion, duplicates/release, cross-turn changes, supersession/recovery, reduced motion, cleanup, terminal Mission gating and responsive row/anchor contracts. Element/style assertions establish reservations, not actual rendered geometry.
- **Not run — browser/Vite testing handled by user.** Browser geometry and visual acceptance remain pending, including joining/label/gate changes at unchanged viewport size and genuine resizing across typography/Fleet breakpoints. 20B.6 mobile integration and remaining 20B.7 work stay deferred.

### 2026-10-22 — 20B.5 correction: reliable live capture and playback across turns

- **Pass type:** narrowly approved Mixed Pass: authoritative presentation facts, runtime capture and display lifecycle only. Gameplay legality, combat/health results, outcomes, phase progression, holds, clocks, dice timing, Ready/input availability, reviewed rectangles/easing/configuration, mobile, Graphics Test, tooling and the owner's Tailwind/layout changes are preserved. No controller redesign or networking is added.
- **Capture contract:** aggregate-health application atomically writes optional `gameData.lastTurnHealthResolution = { resolvedTurnNumber, finalHealthByPlayerId, maxHealthByPlayerId }` alongside the existing last-turn damage/heal/net maps. The maximum is the value already used by the authoritative clamp; both active players are included even for zero contributions. Scalar maps are detached from player/fleet objects and retained outside resettable `turnData` until a newer resolution. Existing same-turn idempotency remains intact. Contributions are not duplicated in a second stored representation.
- **Projection/history:** resolving intents preserve this metadata through their existing sanitized state response. Full-state polling publishes it as `publicState.lastTurnStats.healthResolution` alongside aggregate maps, equally for players and spectators. Only completed facts are exposed; unresolved information stays concealed. Finalized history uses matching captured final health/caps and existing aggregate maps, so next-turn fleet work cannot substitute a later maximum. Legacy history normalization remains compatible; missing older provenance is unknown and is not backfilled.
- **Live eligibility:** exact turn/player identity, ordering, finite values, positive caps, nonnegative contributions and aggregate consistency are validated before immutable paired capture. Next-turn bot readiness/building/materialization and current cap/health changes do not invalidate exact captured facts. Live intent or adjacent-poll observation is still required: persisted latest-resolution metadata cannot animate initial load, refresh, gaps or foreground recovery. Safe direct terminal/legacy-boundary capture remains. Older next-turn responses without sufficient provenance settle; malformed explicit metadata cannot borrow caps from current state or history. Ordinary exact capture no longer waits for a history request. Complete candidates are exposed on the capture commit before the unchanged dice-publication release seam, without extending the capture window or any hold.
- **Playback ownership:** the existing controller owns accepted work after candidate/source release, into next-turn dice, Drawing, Ready actions and polls. Both bars, legend and main numbers use its common captured frame and frozen mapping until the entire sequence, including surplus return, completes. Later caps cannot remap active contributions. Runtime settled-state freshness follows the retained live capture independently of source release, protecting completed finals from a lagging DTO. Recovery/identity changes and genuinely newer resolutions retain existing interruption behavior without a queue; reduced motion and terminal completion gates remain intact.
- **Post-completion reconciliation:** compare authoritative health to captured final facts, never animated intermediate values. Reconcile paired settled geometry only after completion. Cap/scale-only changes retain captured paired deltas and their key when both health values equal the captured finals. New authoritative health without an eligible animation hides the old delta pair permanently for that sequence, including if health later returns to the old values. The internal completion receipt remains available for deduplication and terminal gating independently of delta visibility.
- **Superseded limitations:** the earlier 20B.1/20B.5 history race and rejection of post-advance fleet/readiness work are resolved for responses carrying the new exact metadata. Earlier pass records below describe their historical implementations. Older payload/history provenance limitations remain; mobile integration and remaining 20B.7 work are deferred.
- **Automated validation:** `npm run typecheck`, `npm run build`, `deno check src/supabase/functions/server/index.tsx` and `deno task check` pass. Eleven relevant server suites pass **186 tests plus 5 steps**, covering aggregate effects/caps, idempotency, history/checkpoint recovery, bot advancement, intent responses and player/spectator full-state projection. The source-inspection bot test requires narrowly scoped `--allow-read` in addition to `--allow-env`. Following owner confirmation, the stale inline-width assertion in `healthBarRendering_test.ts` now checks the existing desktop responsive width classes (36/42/52/76px), with no inline desktop override, and preserves the mobile axis-based width check. The renderer is unchanged. `npm run test:client` passes **600 tests across 50 files**; typecheck also passes after the assertion correction. The correction's capture, fake-clock lifecycle and reconciliation tests pass, including rejection of incomplete public envelopes that would otherwise borrow raw-state totals or provenance. Existing non-blocking build chunk-size and ignored Deno compiler-option warnings remain.
- **Delivery/compatibility:** optional additive metadata requires no stored-state migration. Deploy the updated Supabase server function and client, preferably server first; no deployment was performed in this pass. Older responses conservatively settle where exact facts are unavailable. **Not run — browser/Vite testing handled by user.** Owner browser acceptance remains pending for ordinary bot/multiplayer turns, next-turn interactions during playback, terminal handoff and cap/health reconciliation.

Changed-file inventory (paths relative to each prefix):

| Prefix | Files |
| --- | --- |
| `src/supabase/functions/server/` | `engine_shared/resolve/resolvePhase.ts`, `engine/state/GameStateTypes.ts`, `engine/state/battleLogHistory.ts`, `routes/game_routes.ts` |
| `src/game/client/` | `gameSession/types.ts`, `gameSession/selectors.ts`, `gameSession/resolvedHealth.ts`, `gameSession/clienteffects/useEndOfTurnPresentation.ts`, `useGameSession.ts`, `tests/gameSession/resolvedHealth_test.ts` |
| `src/game/display/` | `healthBars/useSessionHealthBarPresentation.ts`, `tests/sessionHealthBarPresentation_test.ts`, `tests/sessionHealthBarLifecycle_test.ts`, `tests/healthBarRendering_test.ts` |
| `src/supabase/functions/server/tests/` | `engine_shared/maximumHealth_test.ts`, `engine/state/battleLogHistory_test.ts`, `engine/bot/botRunner_test.ts`, `routes/current_turn_projection_routes_test.ts`, `routes/intent_persistence_concurrency_test.ts` |
| `src/documentation/plans/` | `Phase 20 Game UI and Health Bars.md` |

### 2026-10-22 — 20B.5 desktop live health-bar integration

- **Pass type:** Client/UI plus this planning update. **Primary layers:** display and narrow runtime presentation metadata. Reused the owner-reviewed 20B.4 sequence, renderer, easing and durations without retuning. Desktop placeholders are replaced; mobile components, Graphics Test, sounds, Health Flash, server, networking and tooling are unchanged.
- **Stable ownership/capture:** `GameScreen` owns one `useSessionHealthBarPresentation` controller above boot and desktop/mobile branches, subscribes through `useHealthBarAnimation` and passes desktop presentation directly through `MainStage` to `BoardStage`. Both orientation scales are prepared for each accepted snapshot. Capture uses the existing live `resolvedHealthSnapshot`; next-turn dice publication/source release never resets, stops or completes accepted work. Duplicate intent/poll publications do not replay; newer eligible resolutions supersede without a backlog. Completed frames/scales remain retained through ordinary next-turn updates.
- **Runtime seam:** `resolvedHealthSession` exposes the existing seat/viewer identity and continuity key independently of source release, the latest directly observed resolved turn, and authoritative settled health with nullable caps. `settledIncludesLiveResolution` distinguishes a lagging pre-resolution DTO from current settled facts, so reduced-motion completion retains captured finals while genuine later health/cap changes can update geometry even before source release. Existing live-capture eligibility and release boundaries are unchanged. Recovery/game/viewer/seat changes invalidate ownership. A newer unsupported resolution cancels stale visuals without completion and preserves controller deduplication. Bootstrap, sparse history and recovery settle directly without a counter tween or stale clipping.
- **Responsive desktop geometry:** `ResizeObserver` measures the existing flexible outer `barRegionRef` region; inner axis is `max(0, outerHeight − 4px)`. The pair is absolutely positioned so its dimensions cannot drive the measured flex allocation. Existing short-screen compression, metric reservations, hover/dice refs, contribution-stack spacing and triggers remain. Track width remains 24px inner / 28px outer with a 56px shared legend lane; approved gradient, variable colors, white zero layering and marker typography are preserved. Endpoint legend sets are prepared on sequence/dimension changes and sampled against the controller's common mapping; resize changes physical geometry/density without restarting playback.
- **Desktop main-number policy for owner review:** main health text follows the controller frame's logical health, rounded only for integer text; rectangle geometry stays unrounded. Numbers remain at starting health through scale preparation, follow intermediate negative/recovery values, hold authoritative final health during surplus and finish at captured finals. Settled/recovery updates display authoritative health directly. The former independent desktop `useAnimatedHealth` tween is removed. These display values never feed inspection sources, combat/stat calculations, victory, controls or canonical state.
- **Paired deltas:** accepted-resolution net deltas stay hidden until controller completion, including surplus return. Both reveal together using captured actual net change and a continuity/resolution/turn completion key; polls and source release retain the frame, key and deltas. Unsupported/recovery fallback preserves existing safe settled eligibility and formatting without manufacturing a delayed appearance. Authoritative LAST TURN / FINAL TURN breakdown sources and turn identities remain independent of animation.
- **Terminal seam:** a presentation-only completion receipt is matched on game/viewer/role/player ordering, continuity, resolution key and turn. Exact eligible terminal facts claim the gate at live capture before the automatic finished redirect; the existing mapper and Mission auto-result seam honor the same narrow wait. `MainStage` also defers consuming/covering the board with an early Mission result request while terminal bars run. Completion releases the handoff; recovery, unsupported/non-health finishes and mobile release safely. This wait is separate from `healthResolutionPresentationActive`: Ready/input locking, clocks, authoritative holds, next dice and the existing overlay/fleet flashes are not extended or retimed.
- **Motion/cleanup:** observes `prefers-reduced-motion` through the controller's existing immediate-final completion; Health Flash retains its existing purpose. Cancellable microtask disposal permits React development effect cleanup/setup to reattach the same usable controller, while actual unmount cancels frame work and removes observers/media listeners. No production replay/looping is added.
- **Validation:** `npm run typecheck`, `npm run test:client` (**50 files, 594 tests**) and `npm run build` passed. New coverage includes live deduplication/release, completion-timed retained deltas, shared logical numbers/rectangle frames, negative finals/overheal, settled unknown caps/recovery, lagging DTOs versus genuine later caps, unsupported newer facts, supersession/seat changes, physical resize/layout switches, terminal completion identity/Mission gating, unchanged next-turn Ready/dice/helpers, reduced motion, measurement and cleanup/reattachment. Existing authoritative breakdown, mobile, static-example, animated-example and controller tests pass. The existing non-blocking >500kB chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Desktop implementation is complete with owner browser review pending: check short/tall desktop heights, contribution hover/focus/dice guidance, negative recovery and surplus number pacing, completion delta appearance, terminal Mission/results and breakpoint/reduced-motion behavior. 20B.6 mobile integration and remaining 20B.7 outcome styling/preferences/tuning are incomplete. **20B.1 limitations remain:** matching history may arrive after the supported capture window; known subsequent fleet work conservatively settles because existing history cap metadata is post-advance; aggregate-time cap capture needs a separate Server Pass; older compatibility-cap provenance remains unavailable.

### 2026-10-22 — 20B.4 health-bar controller and animated Graphics Test

- **Pass type:** Client/UI plus this planning update. **Primary layer:** display / presentation animation. Added central timing configuration, pure sequence/scale-transition helpers, a cancellable controller and subscription hook under `display/healthBars/`, plus `AnimatedHealthBarExamples.tsx`, narrow Graphics Test mounting and focused tests. Existing static fixtures/selectors/tests, approved rectangle dimensions/palette/backgrounds, live placeholders, production counters/deltas, overlays/effects, clocks, dice, runtime, networking, server and tooling remain unchanged.
- **Sequence:** preparation captures/freeze-copies both players' resolved facts, canonical outcome, identity/context and scales. Damage moves the white health endpoint while red occupies the vacated interval; white never fills negative health. Damage clearance retracts only red above zero. Positive handoff has empty contribution rectangles; negative handoff retains `damageStageHealth→0`. Healing grows green from fixed damage-stage health to supplied final health over the complete negative red. At target, covered red is trimmed invisibly before green clearance: negative finals continuously retain `finalHealth→0`, including damage-only negative siblings. Green clearance fixes its final-health endpoint while moving its starting endpoint to it. Surplus holds white at final/capped health and grows/returns green about fixed zero, bounded to `min(max(0, damageStageHealth + grossHealingReceived − finalHealth), maxHealth)`. No stage or health sign determines canonical outcome.
- **Timing location:** `src/game/display/healthBars/healthBarAnimationConfig.ts`. `HEALTH_BAR_ANIMATION_CONFIG` initially sets minimum movement **700ms**, maximum movement **1400ms**, red-to-green handover **200ms**, scale transition **350ms**, final settle **0ms**, and cubic-bezier **(0.7, 0, 0.3, 1)**. The evaluator solves Bezier x for elapsed time before evaluating y. For each stage, maximum mapped endpoint travel across both players and prepared orientation mappings selects `clamp(travelFraction × 1400, 700, 1400)`; normalized travel uses the usable inner axis. No visible movement means no movement stage. This supersedes the earlier proposed 35-health-unit threshold: raw damage, net delta and uncompressed units do not select durations. The handover applies only when damage precedes a green contribution block, including surplus. Covered-red trimming adds no artificial timed stage. Separately named `HEALTH_BAR_ANIMATION_DEV_CONFIG.completedHoldMs` is **1200ms** and never extends production playback.
- **Scale/legend:** establish incoming mapping before contributions while logical starting health stays fixed. Bars, zero/cap markers and legend use one interpolated normalized mapping per orientation, shared by both players; endpoint maps clamp to their domains before interpolation over the union domain, preserving continuity/monotonicity. Prepare old/new label sets once per transition/dimension configuration. Numeric matches move with the mapping; entering/leaving labels fade without text interpolation. The exact incoming mapping freezes through contributions, clearance, surplus and settling and remains retained until the next resolution, when contraction is allowed. Resize/axis/orientation presentation changes consume the same elapsed playhead; tick density can be reselected without changing stages/durations.
- **Playback ownership/API:** `prepareHealthBarSequence` and `sampleHealthBarSequence` are pure, fixture-independent production helpers. `createHealthBarAnimationController` owns accepted input and exposes context/motion updates, candidate acceptance, subscriptions, Stop, explicit reset and disposal. `useHealthBarAnimation(controller)` subscribes to a caller-owned stable controller; that owner must cancel on unmount. Identity includes game/viewer/role/player order plus continuity context; resolution key/turn deduplication prevents ordinary rerenders or duplicate DTOs from replaying. Candidate absence/release does not stop owned playback. Newer accepted resolution supersedes without a backlog or obsolete completion callback. Generation guards cancel stale work; elapsed time samples delayed/background frames directly. Stop and disabled/reduced motion complete safely at exact supplied finals. Stop preserves deduplication; explicit development replay resets it deliberately.
- **Future live capture seam:** capture/start from the existing live `resolvedHealthSnapshot` produced by `useEndOfTurnPresentation`, after its upstream eligibility/provenance checks and before `releasePresentedTurnStartDice` publishes the next turn and releases the source. Source release must not call controller reset or clear its game/continuity context. The stable owner must sit above desktop/mobile consumers and pass shared playback to them. **Owner-approved:** an accepted sequence may continue into the next turn; do not extend authoritative holds, delay clocks or change dice publication/settle timing. No live hook/runtime wiring is implemented in this pass; recovery/game/viewer changes must explicitly invalidate ownership when integrated.
- **Completion/deltas:** captured actual net deltas are available independently of a paired reveal gate. Completion includes captured identity, continuity, resolution key/turn and reason; natural completion occurs only after all required stages, including surplus return. The animated demo hides both deltas while running, then reveals both together and retains them during the development hold. Stop settles and reveals both; replay hides/resets them. Existing production delta wiring is unchanged. Main health-number behavior remains an owner decision before live integration.
- **Development access:** development launcher → **Graphics Test → Animated Health Bars**, immediately after the unchanged static Health Bars block. Nine Play/Stop scenario rows reuse the original facts. Both previews share one controller/playhead at the existing gallery-only 320px desktop / 256px mobile inner axes. Initially idle; only the selected scenario loops. A separate scale-only Play/Stop example expands/contracts positive-only and compressed-negative mappings while A stays 25 and B stays 20; its selection is mutually exclusive with scenarios. A completed frame holds deltas for 1200ms before explicit replay; switching, Stop and unmount cancel frame/hold work. Background recovery never queues missed cycles. Reduced motion settles immediately using the same final facts/completion contract.
- **Validation:** `npm run typecheck`, `npm run test:client` (**48 files, 575 tests**) and `npm run build` passed. New tests cover mapped/shared bounded durations, actual easing, static boundary agreement, continuous negative red, surplus, extreme finite values, coordinated scale/legend transitions, retention/contraction, copied inputs, source release, duplicate/older delivery, supersession/reset/context changes, stale callbacks, delayed frames, disabled motion, paired completion and exclusive development looping. Existing static-reference tests remain unchanged. The existing non-blocking >500kB chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Controller/gallery implementation is complete; visual pacing, scale/legend transitions, markers and gallery layout await owner review. Live desktop/mobile adoption, production delta/counter coordination, preference/sound wiring and terminal visual treatment remain for 20B.5–20B.7. **20B.1 limitations remain:** supported live capture can depend on matching history arriving before release; known subsequent fleet work conservatively settles because existing history cap metadata is post-advance; aggregate-time cap capture requires a separate Server Pass, and older compatibility-cap provenance remains unavailable.

### 2026-10-22 — 20B.3 refinement: preserve negative-final red continuously

- **Pass type:** Client/UI, fixtures/tests plus this planning update. Changed `healthBarExampleFixtures.ts`, `healthBarExamples_test.ts` and this document. Production renderers, geometry, scale helpers, live presentation, gallery controls, timing and unrelated work remain unchanged. The existing fixture builder is exported as `createHealthBarExample` so tests exercise real fixture generation for mixed pairs without adding gallery scenarios.
- **Owner-confirmed correction:** retain the complete `damageStageHealth→0` red behind green through healing growth and target arrival. When final health remains negative, preserve `finalHealth→0` during Healing clearance, Healing cleared and Settled final. Trimming the covered old trail beneath fully grown green leaves the remaining red continuously visible. For start 12 / damage 30 / healing 5 / final −13, handoff and growth retain red −18→0; clearance and settling retain red −13→0. No empty negative bar or red reappearance at settling is permitted; no white negative fill or outcome inference is added.
- **Conditional shared removal:** include Retained red removed only if a player recovers from negative damage-stage health to zero or above. That player keeps the existing full-removal behavior; a sibling with negative final health retains its remaining final-negative red and completed green during the shared stage. Damage-only negative red remains unchanged. The standalone negative-final scenario now skips the unnecessary removal stage. All nine gallery scenario facts, both orientations and complete-resolution prepared-scale retention are preserved; surplus behavior is unchanged.
- **Validation:** `npm run typecheck`, `npm run test:client` (**45 files, 528 tests**, including **54** focused example/rendering tests) and `npm run build` passed. Updated assertions cover continuous red from damage clearance through settling, exact final-negative intervals, conditional removal-stage eligibility and absent white negative fill. Four mixed-pair regressions cover negative/positive and negative/zero recovery in either player seat, rendering both orientations with retained scales. Existing positive/zero recovery, damage-only negative, surplus and rendering coverage remains passing. The existing non-blocking >500kB chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** This corrects static reference states and the future 20B.4 contract; animation/controller and live integration remain unimplemented. Visual acceptance and prior 20B.1 provenance limitations remain pending/unchanged as documented.

### 2026-10-22 — 20B.3 refinement: corrected reference keyframes

- **Pass type:** Client/UI plus this planning update. **Primary layer:** development presentation fixtures and focused tests. Changed only `healthBarExampleFixtures.ts`, `healthBarExamples_test.ts`, `healthBarRendering_test.ts` and this document. The explicit interval renderer already expresses the confirmed states: production rendering/geometry, scale policy, gallery controls, palette, dimensions, backgrounds, legends, markers, runtime, networking and server are unchanged. No controller, timers, transitions, automatic playback or live integration was added.
- **Nonnegative handoff:** damage clearance leaves zero-length red at damage-stage health; handoff and Healing begins have zero-length green at that same health. Subsequent green growth has no red. Rules apply per player; one player's state does not force its sibling's colour.
- **Negative clearance/growth:** red clears above zero and retains the complete interval `damageStageHealth→0`. Handoff and Healing begins have green `damageStageHealth→damageStageHealth`. Healing grows/movement/target samples retain unchanged negative red behind green, including when green crosses zero. Healing reaches final health is separately inspectable, followed by Retained red removed, then Healing clearance and Healing cleared. No residual positive red enters healing, and the retained negative red top never moves below zero.
- **Negative settling:** a healed negative result first removes its pre-healing trail, then clears green, then explicitly settles to red `finalHealth→0`; no white negative fill or green remains. Damage-only negative results keep their completed negative red while the other player heals, including during the sibling's trail removal/clearance. Zero finals have no nonzero red; positive finals use their normal white fill. Final colour is supplied explicitly, with no renderer inference, victory/loss inference or outcome lettering.
- **Confirmed surplus:** unused healing is `max(0, damageStageHealth + grossHealingReceived − finalHealth)`; displayed amount is `min(unusedHealing, maxHealth)`. White stays at supplied final/capped health. The inspectable samples are Surplus begins `0→0`, grows `0→half amount`, reaches amount `0→amount`, returns `0→half amount`, and cleared with no green. The lower endpoint stays at zero throughout; this replaces the former travelling strip. No unused healing means no surplus block for that scenario; nonparticipating players retain settled state. Scale never expands for surplus. Confirmed examples peak at 20 (unused 20, cap 35), 25 (unused 25, cap 35), 35 (unused 99, cap 35), and 5 (unused 5, cap 50).
- **Coverage/access:** Graphics Test → Health Bars retains the original eight scenario facts and adds Damage-only negative final: A start 12 / damage 30 / healing 0 / final −18 / cap 35; B start 12 / damage 20 / healing 8 / final 0 / cap 35. Nine scenarios share the existing selectors and gallery-only 320px desktop / 256px mobile inner-axis examples. Both orientations consume identical logical states, each retaining its one complete-resolution prepared scale across all selected stages.
- **Validation:** `npm run typecheck`, `npm run test:client` (**45 files, 524 tests**, including **50** focused example/rendering tests) and `npm run build` passed. Tests verify per-player empty handoffs, exact retained-red endpoints, green-over-red rendering, ordered trail removal and green clearance, explicit negative/zero finals, invisible zero-length intervals, fixed-zero surplus growth/return and exact peaks, mapped endpoint containment and unchanged prepared scales in both orientations. The existing non-blocking >500kB build chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Static keyframes implement the confirmed value relationships; visual acceptance remains pending. 20B.1 cap/history provenance limitations remain unchanged. Animation/controller, durations, interpolation, live integration, numeric-counter coordination, preferences and terminal outcome styling remain for 20B.4–20B.7.

### 2026-10-22 — 20B.3 health-bar and legend rendering

- **Pass type:** Client/UI plus this planning update. **Primary layer:** display. Added reusable `HealthBar`, `HealthBarLegend` and `HealthBarPair` in `display/healthBars/HealthBar.tsx`, with presentation types and pure rectangle geometry in `healthBarPresentation.ts`. The existing `healthBarScale.ts` remains unchanged. Live BoardStage/MobileStatusRail placeholders, current health presentation, public estimates, desktop dice helpers, networking, server, Stats graphs and tooling remain unchanged.
- **Inputs and ownership:** a bar consumes one prepared shared scale, player side, orientation, caller-supplied **inner** axis length, accessible label and readonly explicit `{ health, red?: { from, to }, green?: { from, to } }` state. Cap metadata comes from the prepared scale. The pair gives the same scale/axis to both bars and the shared legend. Red and green are independently movable/clearable and can coexist. Renderers do not infer stages, outcomes or eligibility, and contain no timers, automatic playback, transitions or server interaction.
- **Geometry:** every value position uses `mapHealthBarValue`; rectangles derive from mapped endpoints before orientation. Desktop increases upward with **24px inner width**, **2px padding** on every side and **28px outer width**; mobile increases rightward with **10px inner height**, **2px padding** and **14px outer height**. Outer axis length is inner length plus 4px. White fills only positive health from zero, bounded by a known player cap; unknown caps remain unknown. Empty/unmappable contribution intervals produce no rectangle, without invented minimum lengths or silent domain clipping.
- **Palette/backgrounds:** desktop is exactly `linear-gradient(to bottom, var(--shapeships-grey-90) 0%, #101010 80%, #101010 100%)`, with full opacity at both stops and #101010 retained through the bottom. Mobile is flat `var(--shapeships-grey-90)`. Contribution layers use `var(--shapeships-red)` and `var(--shapeships-green)`; health and zero use white. Square ends, no shadows or decorative effects; static Tailwind utilities plus local numeric inline geometry follow existing conventions.
- **Layering and markers:** background → white positive fill → red → green → auxiliary markers → white zero. Zero is always present, **3px along the axis**, across the full 24px/10px interior. Only the marker rectangle shifts inward at an edge to keep it visible; scale/legend anchors remain exact. A restrained grey-50 cap tick appears outside the coloured interior only for known caps below the shared positive top. A small grey-50 double-slash cue appears outside the negative region near zero only when `negativeCompression` is active. Cap/compression-marker appearance remains **provisional for owner review**.
- **Legend:** uses `calculateHealthBarLegend` with the actual inner axis and accepted priority/spacing rules. Labels share the bar's 2px padded coordinate system and remain anchored at exact mapped positions, with endpoint overflow allowed. Desktop pairs use the **56px central legend lane**; mobile uses upper bar/shared horizontal legend/lower bar. Initial typography is **12px desktop / 10px mobile**, regular weight, line-height 1, all grey-50; sizes remain subject to owner visual review.
- **Development examples:** open **development launcher → Graphics Test → Health Bars**. `HealthBarExamples.tsx` uses production components and `healthBarExampleFixtures.ts` contains eight coherent paired scenarios: ordinary damage/healing, small damage/healing, below-zero recovery, negative final result, full-health overheal, damage plus excess healing, unequal/increased caps and extreme negative compression. Manual scenario/stage selectors show both orientations simultaneously; scenario changes reset stage selection. **320px desktop / 256px mobile inner axes are gallery example dimensions only**, with local horizontal overflow available on narrow gallery widths. Existing Graphics Test sections remain intact.
- **Fixture retention/surplus:** each orientation prepares its scale once from the complete paired resolution, never from selected intermediate poses. Static poses cover damage reveal/movement/clearance, healing reveal/movement/clearance, red/green handoff, settled starts/finals and bounded surplus sweeps/clearance. Surplus white remains capped and explicit green intervals stay within the capped positive interior; gross unused healing never expands the domain. These are inspectable examples, not approved motion/timing or an animation controller.
- **Validation:** `npm run typecheck`, `npm run test:client` (**45 files, 497 tests**, including **23** focused rendering/example tests) and `npm run build` passed. Focused tests exercise mapped/reversed/zero-crossing bounds, small intervals, positive/capped white fill, independent simultaneous layers, edge zero placement/layer order, unequal/unknown caps, compression eligibility, legend alignment and every fixture stage retaining its prepared scale. Production CSS inspection confirmed the required red/green/grey-50 utilities, regular weight and line-height utilities. The existing non-blocking >500kB chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Rendering is implemented with **owner visual review pending**: inspect both orientations, small contributions, persistent zero, unequal-cap ticks, compressed-negative cues, endpoint labels and surplus poses. Preserve documented 20B.1 cap/history provenance limitations. 20B.4–20B.7 controller, live adoption/retention, counters, timing, outcomes and preferences remain incomplete.

### 2026-10-22 — 20B.2 shared scale and legend calculations

- **Pass type:** Client/UI plus this planning update. **Primary layer:** display / pure presentation calculations. Added `src/game/display/healthBars/healthBarScale.ts` and focused `src/game/display/tests/healthBarScale_test.ts`; rendering, placeholders, runtime/snapshot behavior, public This Turn estimates, timing, gameplay, Stats graphs, server and tooling are unchanged.
- **API:** `prepareHealthBarScale(presentation, context, options)` consumes the existing live/settled 20B.1 presentation and returns frozen numeric geometry, owned identity, source mode/resolution metadata and each player's separate cap value/position. Context supplies the matching game/viewer/order identity and caller-owned session/recovery `continuityKey`; live preparation also requires the snapshot's matching key. `mapHealthBarValue(scale, value)` is the sole mapping for both players, contribution geometry, caps and legend. Nonfinite presentation values, invalid caps/settings and identity mismatches reject preparation; nonfinite/out-of-domain mapped values return `null` rather than clipping.
- **Geometry:** normalized **0 = exact domain minimum, 1 = exact domain maximum**, increasing mobile left-to-right and desktop bottom-to-top. Both players determine the domain together: positive baseline 35, available authoritative caps and represented positive starts/finals; negative starts, damage stages and finals set the finite negative extent. No outward domain rounding and no expansion for unused healing. Settled preparation uses only current health/caps; unknown caps remain `null`, never inferred as 35. Arithmetic avoids overflow even when finite endpoint magnitudes cannot safely be added.
- **Compression:** independent desktop/mobile `minimumPositiveFraction` settings initially **0.35**. Use a single linear mapping while its natural positive fraction is at least the minimum; otherwise reserve 35% for positives and linearly compress negatives into 65%. The two regions meet continuously at zero and share their mapping across both players and legend. Examples with top 35: 0–35 gives zero position 0 / positive fraction 1; −60–35 stays linear / positive fraction about 36.84%; −300–35 gives zero position 0.65 / positive fraction 0.35.
- **Legend:** `calculateHealthBarLegend(scale, options)` varies text density using usable axis length and adjustable center-spacing estimates: desktop vertical **24px**, mobile horizontal **48px** initially. Readable 5/10/20/50/100/200/500-and-larger steps are chosen independently within each mapped region, with at most 128 intermediate candidates per region. Zero and exact positive top always remain, including overlap on tiny/zero axes by owner choice; negative minimum has next priority when it fits. All positions use the mapper, with deduplicated values and no negative-zero formatting. These calculations do not implement typography measurement or grey-50 rendering.
- **Retention contract:** prepare from the complete incoming resolution; both bars and legend adopt together before contribution motion, freeze through damage/clearance/healing/surplus/settling, and retain through subsequent build/selection. `retainPreparedHealthBarScale(prepared, context)` returns the same object for matching identity/continuity, otherwise `null`; it is an identity guard, not another resolution lifecycle. The later caller explicitly prepares a replacement at the next resolution, allowing contraction, and changes context on game/viewer reset or recovery before fresh settled preparation. Terminal domains contain final health. Resize can regenerate labels from retained geometry without replay. Coordinated scale-transition animation, including keeping logical health fixed while shared mapped positions move, belongs to 20B.4; no controller, timers or interpolation were added.
- **Limitations:** this does not repair the documented 20B.1 aggregate-time cap/history provenance limitations or add eligibility, recovery or release behavior. Live adoption/retention and in-flight resize handling remain later integration/controller work. Confirmed active-bar dimensions, zero-marker layering, grey-50 legend text, cubic-bezier(0.7, 0, 0.3, 1) and central timing configuration remain requirements for later passes.
- **Validation:** `npm run typecheck`, `npm run test:client` (**42 files, 439 tests**, including **34** focused scale tests) and `npm run build` passed. Numerical tests cover ranges/caps/overheal, threshold continuity, shared mapping/orientations, extreme finite values, label spacing and bounds, retention/contraction/reset, terminal/settled data and production 20B.1 inputs. The existing non-blocking >500kB build chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Only 20B.2 is newly complete; rendering, animation and live integration remain incomplete.

### 2026-10-22 — 20B.1 resolution snapshot and data continuity

- **Pass type:** Client/UI plus this planning update. **Primary layer:** client runtime/presentation data. No bar rendering, scale calculation, animation controller, layout, server or tooling changes; current counters, overlays, flashes, sounds, clocks, dice gates and lifecycle durations retain their existing inputs/timing.
- `vm.resolvedHealth` exposes either a live immutable snapshot or authoritative settled health. Both players are captured together with game/resolved-turn/presentation identity, viewer/session role and ordering, damage **taken**, gross healing received, actual net delta, recovered aggregate start (`final − actual net`), explanatory damage-stage position, final health, applicable cap and canonical outcome. No Phase 18 estimate/snapshot or detailed breakdown is required. Prior caps are omitted because this pass has no reliable aggregate-start cap source.
- Resolving intent events and adjacent poll advancement prepare owned aggregate inputs. Same-turn canonical health finishes are eligible. Identity and source validation use existing selectors. Normal post-resolution responses may already be in the next turn's drawing phase; intent responses may omit projected caps. These paths use matching finalized history's `maxHealthEnd`, health and aggregate analysis to complete a pending **live-observed** capture through the existing history coordinator. No current/later-turn cap is borrowed. Explicit caps at a matching terminal/legacy resolution boundary can be used directly.
- A cap of **35 is valid**, just like an increased cap. Live completion plus matching finalized history provides provenance for current resolutions. Historical loading alone cannot establish a live capture; older archives may have server-normalized compatibility caps without provenance. They remain settled. Missing caps/analysis, mismatched identities/totals, inconsistent aggregates and late history after release also settle safely; absent detailed breakdown rows do not invalidate complete totals.
- The accepted snapshot owns frozen scalar data and retains the first accepted contribution/cap payload for its stable resolution identity. New N+1 DTOs and history updates do not invalidate N. Release uses the existing `turn_start_published` seam; terminal snapshots persist. Identity changes, a newer completed resolution and explicit gap/background recovery cancel eligibility. Multi-turn polling jumps never label latest totals with the previously observed turn or queue missed turns. Existing legacy hold overlays/continuation remain separate from live eligibility.
- **Limitations:** supported live capture can depend on the existing history response arriving before the established release boundary; a late response settles rather than extending timing or starting a replay. Initial load/hard refresh, skipped turns and foreground recovery do not animate historical contributions. No server follow-up is required for supported live boundaries without subsequent fleet work. Inspection found that history summaries derive `maxHealthEnd` from post-advance `nextState`; next-turn materialization/building can therefore replace the aggregate-application cap. Known materialization/new-ship/build-work/readiness markers conservatively settle those resolutions. Exact coverage of these cases needs a separate narrow Server Pass: capture the cap when aggregate health is applied and carry it through the existing finalize/history/projection seams, before next-turn fleet work. Older compatibility-normalized cap provenance is a separate unavailable historical fact; do not infer it from the value 35.
- **Validation:** `npm run typecheck`, `npm run test:client` (**41 files, 400 tests**) and `npm run build` passed. Focused production capture/transition tests cover aggregate scenarios, overheal, caps, terminal/non-health outcomes, orientation, immutability, duplicate delivery, gaps, sparse history, post-resolution fleet-work fallback and release/reset behavior. The existing non-blocking >500kB build chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Later 20B passes remain incomplete. Owner-confirmed geometry, mapping, marker, easing and timing-configuration requirements below are documentation only in this pass.

### 2026-10-21 — Combined 20A.1 + 20A.2 implementation

- Combined the affected presentation inventory with desktop board/header foundations. Header and fleet columns now share the existing 200/230px centre column and 8px gaps; clocks and headers remain mounted across setup transitions.
- Initial header tiers: 768–1399px uses name/clock/status/species sizes 16/16/12/10px; 1400–1919px uses 24/20/14/12px; 1920px+ uses 36/28/18/15px. Pill heights are 36/42/50px. Header reservations are 68/78/90px. Stacking below 1200px with a 124px reservation is a proposed fallback pending visual review.
- Desktop increment cues sit centred 2px below their clocks; lifecycle and mobile treatment are unchanged. Decorative 24px tracks share a blank 56px legend lane and shrink from at most 330px to zero as available height decreases. The central board never scrolls.
- Existing stats retain their typography, grouping, formatting and gates. The central container permits horizontal row overhang, including Centaur/joining variants, without clipping real content or creating a scroll container. In 20A.3, inter-row spacing can compress after decorative placeholders reach zero height.
- Dice/helpers remained in LeftRail for this pass and are relocated in 20A.3 below. Stat regrouping and typography remain deferred to 20A.4; active health bars and mobile changes remain deferred to their respective passes.
- Owner visual review is **pending** for L/M/S reference sizes, intermediate/narrow desktops, long names/statuses, increment cues, short-screen placeholder and spacing collapse without central scrolling, setup/intros/missions, finished games and unchanged mobile presentation. No Vite/browser testing was performed by Codex.

### 2026-10-21 — 20A.3 desktop dice and helper relocation

- **Pass type:** Client/UI. **Primary layer:** Display. Implemented desktop relocation; owner visual review is **pending**. No server, runtime, networking, shared Dice primitive, mobile or tooling changes.
- Extracted `layout/boardStage/DesktopDicePresentation.tsx`; existing dice values, animation keys, selected helper slots and guidance signals flow from GameScreen through MainStage to BoardStage. Sound and first-Ready/session dismissal remain with their existing owners.
- One desktop main die stays mounted in the shared BoardStageFrame through species selection and board/matchup transitions. Species selection hides the central slot without reserving space or adding a reveal timer. Existing intro, release/settle, modifier and reduced-motion lifecycles remain intact.
- The main die stays on the central axis. Selected helpers are positioned relative to its box and cannot intercept fleet input; their count does not affect the main die or surrounding rows. Ordinary helpers stack die above source; KNO retains its empty die cell. CHR uses first/second dice across the top, source lower-left, and third die lower-right, preserving order and absent values. Cube highlighting and missing-source handling are retained.
- Central sequence is placeholders, health/net delta, dice/helpers, saved lines, bonus lines, and the existing damage/healing groups. The centre never scrolls. Decorative placeholders yield first, followed by elastic gaps between unchanged metric rows; real metrics retain typography, horizontal overhang and inspection interactions. The grey-70 divider and headers are unchanged.
- Desktop guidance keeps its existing copy, colours, typography, 500ms appearance delay and 150ms fade. It anchors beside the die, flips sides as needed and clamps within a 12px viewport inset. Mission/matchup priority is retained. LeftRail's flexible sister-panel slot receives the released space; chat, phases, streak tabs, preferences and log expansion/scroll restoration are unchanged.

| Desktop geometry | Small: 768–1399px | Medium: 1400–1919px | Large: ≥1920px |
| --- | ---: | ---: | ---: |
| Main die | 64px | 120px | 148px |
| Helper die/cell | 28px | 44px | 56px |
| Source graphic | 24px | 40px | 52px |
| Main-to-helper gap | 8px | 10px | 12px |
| Internal helper gap | 4px | 4px | 4px |
| Vertical spacing per side | 8px | 12px | 16px |

- Dimensions are initial CSS targets from the approved pass, guided by `Game Screen L.png`, `Game Screen M.png` and `Game Screen S.png`; they remain subject to Judd's browser review. Sizing is local and explicitly overrides the primitive's default 164px box. Rotation/pulse layers can overflow without clipping, and the dice reservation is stable for all supported helper states.
- **Validation:** `npm run typecheck`, `npm run build` and `npm run test:client` passed (37 test files, 333 tests). The build reports a non-blocking >500kB chunk-size warning. An additional automated render inspection passed 22 helper scenarios with stubbed Dice/graphics, covering CHR 0–3 rolls, KNO, LEV, Cube highlighting and a missing graphic; it does not establish browser animation or layout correctness. Source comparison confirms unchanged mobile wiring, guidance eligibility/Ready orchestration and sound ownership. Production CSS inspection confirms emitted responsive dimensions, important size overrides and CHR grid rules.
- **Not run — browser/Vite testing handled by user.**
- **Pending owner review:** L/M/S sizes and intermediate/short desktops; main-die centring; no central scrolling and placeholder/gap compression; all selected helper combinations; CHR 1–3 rolls; KNO spacing; Cube highlighting; animation clearance and fleet/control collisions; setup/intros/missions; guidance delay/fade, viewport clamping and dismissal; LeftRail expansion; unchanged mobile presentation.

### 2026-10-21 — 20A.4 desktop stats, economy and consolidated inspection

- **Pass type:** Client/UI. **Primary layer:** Display, with a narrow client presentation input for Fleet Value. Implemented; owner visual review is **pending**. No server, networking, mobile, dice, header, background-divider or tooling changes; bars remain inactive and Phase 20B has not started.
- Current red/green values now sit outside the bottoms of their corresponding bar tracks. Left receives opponent damage and own healing; right receives own damage and opponent healing, preserving spectator ordering. The stacks follow the flexible bar region, with 20px bottom padding at 1920px+ and zero below it. Current values still consume `presentedThisTurnStats`, including dice-settle holds, concealment, uncertainty and estimate/Autocast metadata.
- Small/dim resolved red/green values now sit outside the health numbers, with the existing net delta beneath each number. Each entire health group opens one resolved damage/healing breakdown, using the existing health source/lifecycle validation rather than assuming `.last`. Matching actual detail requires the same turn and total; confirmed aggregate history without matching rows explicitly reports unavailable breakdown detail. LAST TURN / FINAL TURN and existing delta animation keys/gates remain intact.
- Each current stack opens one current-only, two-column damage/healing card. Concealed columns expose no rows and do not disable the other column. The separate desktop health-summary renderer and duplicate Damage/Healing rows and labels have been removed. The visible Health/max-health label is removed by owner decision for the future bar legend; accessible health descriptions retain each actual cap. Shared mobile helpers and consumers retain their existing behaviour.
- Cards reuse the existing portal, presence motion and outward flip/clamp positioning. Combined cards are 480px wide, bounded to the viewport, with internal scrolling and wrapped source labels. Trigger/card hover and focus continuity use a 150ms pointer handoff delay; Down Arrow moves keyboard focus into the scrollable card. Active anchors remeasure on content, viewport, ancestor/bar-region resize and captured scroll changes. The central board never becomes a scroll container.
- Economy order is Saved Lines, Bonus, Fleet. Ordinary/joining resources, Centaur categories, intentional zeros, bonus breakdowns and streak details remain separate. Fleet uses the exact label `Fleet`, 18px values and the same 12px central-label size as other medium/large economy rows, all pastel purple. **Fleet is hidden below 1400px** and has no new hover.
- Live Fleet Value sums summary counts times mirrored core definitions' integer `totalLineCost`, with unknown/null/noninteger costs contributing zero. The runtime exposes optional board `presentedFleetValue`, calculated from viewer-safe fleets after build-preview/materialisation filtering and before exact-target projections. Void fleets, Solar ledger entries, unmaterialised copies and targeting graphic substitutions are excluded. Historical `fleetValueEnd` is not used.

The following is the initial 20A.4 geometry record. Numeric sizes are superseded by the 20A.7 table; flexible spacing is superseded by the refinement below.

| Initial desktop stats geometry | Small: 768–1399px | Medium: 1400–1919px | Large: ≥1920px |
| --- | ---: | ---: | ---: |
| Current contribution | 20px | 24px | 28px |
| Resolved contribution, opacity 0.66 | 14px | 16px | 18px |
| Saved/Bonus values | 24px | 28px | 28px |
| Central economy labels | 11px | 12px | 12px |
| Fleet values | Hidden | 18px | 18px |
| Flexible economy gap | 4px | 6px | 8px |
| Minimum bar-region reservation for real current values | 42px | 50px | 78px |

- Decorative height above that minimum yields first, then economy gaps compress. The reservation prevents current values escaping above a fully collapsed decorative region; horizontal numeric/resource overhang remains available. Health typography and the mounted desktop die/timing are unchanged. These are local CSS targets, not screenshot-wide scaling.
- **Validation:** `npm run typecheck`, `npm run build` and `npm run test:client` passed (38 files, 346 tests). Focused coverage includes contribution ownership, concealed/available columns, Autocast/uncertainty, held/rollover/final/history detail selection, wide-card clamping and Fleet stack/privacy/preview/materialisation/targeting semantics. Production CSS inspection confirmed responsive typography, Fleet visibility, large-only 20px padding, minimum reservations and scrollable 480px cards. The build retains the existing non-blocking >500kB chunk-size warning.
- **Not run — browser/Vite testing handled by user.** Owner visual review remains **pending** for L/M/S and short/intermediate desktops, long totals/resources, hover placement/scrolling/focus continuity, setup/intros/missions/spectators/finished games and unchanged mobile presentation.

---

### 2026-10-21 — 20A.4 layout and breakdown refinements

- **Pass type:** Client/UI; display-only refinements. Implemented; owner visual review remains **pending**. This refinement supersedes the initial 330px bar-height cap, 480px/two-column combat cards, fixed previous-value offset and surrounding gap values. Fleet Value calculation, contribution ownership, resolved-source validation, presentation gates, mobile and gameplay are unchanged.
- The bar region now grows without a maximum to consume BoardStage's remaining height after real content and deliberate spacing. MainStage already reserves the action controls and lower panel outside BoardStage, so it needed no change. Economy rows share the same flex column as the health/die content: real rows retain their height while decorative bar height and zero-minimum spacers yield on short boards. Existing 42/50/78px minimum reservations for current contribution stacks remain; their bottom padding stays zero below 1920px and 20px above it. No central scrolling or fixed screen coordinates were added.
- Die spacing moved from non-shrinking padding into flexible spacers before and after the same mounted die. Only surrounding layout changed in `DesktopDicePresentation.tsx`; dimensions, helpers, guidance and dice lifecycle/timing remain intact. A flexible lower buffer keeps the final economy row above the board boundary.

| Preferred flexible spacing | Small: 768–1399px | Medium: 1400–1919px | Large: 1920–2559px | Extra-large: ≥2560px |
| --- | ---: | ---: | ---: | ---: |
| Bar to health | 4px | 6px | 12px | 16px |
| Each side of the die | 8px | 12px | 24px | 32px |
| Between economy rows | 4px | 6px | 12px | 16px |
| Lower board buffer | 8px | 12px | 16px | 24px |

- Every listed spacer can shrink to zero before essential content yields. Taller devices intentionally produce taller bars; the old 330px maximum no longer limits the composition.
- Previous red/green stacks now share the health-number grid row with centred alignment. Net delta occupies the next row in the health column, so hidden, visible and animated delta states cannot change the centring reference. Sizes, opacity, side alignment, health/delta typography and the single complete-group hover/focus trigger are preserved.
- Combat cards return to viewport-bounded **240px** width and restrained existing typography: period, divider, damage owner/coloured total and source rows, divider, healing owner/coloured total and source rows. No side-by-side panels, TOTAL row or duplicate total remains. The existing frame, padding, border, pointer, motion, internal overflow, positioning and hover/focus/keyboard access are retained; bonus and win-streak composition is unchanged.
- Current period headings show `THIS TURN (ESTIMATE)` when applicable; actual `THIS TURN`, validated `LAST TURN` and `FINAL TURN` remain plain. `AUTOCAST ESTIMATE` stays beside only its applicable contribution. Already-formatted `~`/uncertainty totals, concealed contributions, available zeroes and unavailable-detail handling are preserved. The removed health-summary card remains removed.
- **Validation:** `npm run typecheck`, `npm run build` and `npm run test:client` passed (38 files, 349 tests). Focused heading/rendering coverage verifies section order, single owner totals, local Autocast qualifiers, approximation/uncertainty text, concealment/zero and final unavailable-detail states without changing calculation expectations. Production CSS inspection confirmed compact width, structural grid alignment, L/XL flexible spacing and retained large-only current-stack padding. The existing non-blocking >500kB build chunk-size warning remains.
- **Not run — browser/Vite testing handled by user.** Owner review remains **pending** for full-height allocation above controls, varying bar heights, short-screen gap collapse, L/XL spacing, compact stacked cards, estimate/final headings, `~` totals and previous-value centring with delta hidden/visible/animating.

### 2026-10-21 — 20A.5 mobile status rearrangement and horizontal placeholders

- **Pass type:** Client/UI. **Primary layer:** Display. Implemented; owner visual review is **pending**. Changes are limited to mobile board/status composition, a presentation mapper, focused tests and this note. Desktop, server, networking, runtime, tooling and configuration are unchanged.
- The existing 32px phase strip now appears beneath mobile navigation and above the opponent fleet, with 14px horizontal insets. The navigation divider and central phase-strip instance were removed. The shared strip retains five equal segments, 20px icons, percentage-based slab sizing/movement, wrap/reposition, availability fades, reduced motion and pointer-captured press labels. It remains inside the board subtree and its existing takeover/mission gates; species selection gains no strip.
- The central band retains 14px outer insets, a 12px column gap and the existing 56px clock/die column with its 52px main die. Its left column now contains opponent row, 12px neutral track, 12px blank shared legend lane, 12px neutral track, requester row, with 3px between each row and the placeholder group. Tracks use desktop's grey-90 treatment and are decorative/noninteractive: no fills, ticks, health interpolation, scale calculations or animation. These measurements supersede the provisional mobile Appendix B.4 geometry for this pass; the image's active fills/ticks await Phase 20B.
- Metrics are ordered red damage, green healing, white saved lines, blue bonus. Opponent health receives requester damage plus opponent healing; requester health receives opponent damage plus requester healing, for both current and previous values. A display-only helper maps the existing presented inputs through existing formatters without changing damage-dealt semantics or source data. Combat columns reserve at least 28px and economy columns 24px, expanding to content; health reserves at least 38px and names retain truncation. Typography, colours, secondary opacity, joining resources and economy gates are unchanged.
- Game-only placeholders are enabled explicitly through `MobileStatusRailFrame`; its default remains the existing species-selection divider and empty health/stat states. Fleet regions remain flexible, with existing fitting, Ancient ledger layout, inspection, targeting, reveal/activation and health-flash presentation. Existing bottom controls, orientation policy, matchup/mission overlays and finished/takeover surfaces are retained. Clock increments, dice keys/rotation, mobile modifier helpers and first-turn guidance keep their existing inputs, placement and lifecycle.
- Health/stat trigger buttons retain their refs and callbacks, so anchors follow the rearranged controls. Existing paired popover contents, period behaviour, pointer containment, tap-versus-drag and dismissal are deliberately retained as interim inspection until 20A.6. Compact rows do not gain Fleet Value or shared time tabs; Phase 20B has not started.
- **Validation:** `npm run typecheck`, `npm run build` and `npm run test:client` passed (38 files, 353 tests). Focused coverage verifies both periods' incoming-damage/own-healing ownership, reversed viewer-relative orientation, source immutability, concealment, Charge uncertainty, neutral fallbacks, held actuals/dice-settle release and final values, while retaining existing popover/gesture tests. The build retains the existing non-blocking >500kB chunk-size warning.
- **Not run — browser/Vite testing handled by user.** Owner visual review remains **pending** for the 360px reference and other supported phone widths, phase movement/wrap/press labels, horizontal placeholders, reordered metrics, long names/totals, helper combinations, setup/intros/missions, spectator/finished views, existing popover access and unchanged bottom controls. Automated checks do not establish browser fit or animation correctness.

### 2026-10-21 — 20A.6 unified mobile popovers and shared period controls

- **Pass type:** Client/UI. **Primary layer:** Display. Implemented; owner visual review remains **pending**. Scope is mobile inspection/prop plumbing, one reusable resolved-metric matcher, focused tests and this note. Desktop presentation, authoritative rules, networking, valuation/estimate calculations, tooling and Phase 20B are unchanged.
- All four health/stat buttons toggle the same two full-width cards and share expanded state, without the old health-summary availability gate. The separate mobile health renderer, duplicate summary and health/stats variant-selection paths are removed. Names, clocks, dice and board backgrounds gain no toggle action. Existing mission/takeover locks, fleet-inspection exclusion and outside-tap dismissal remain.
- Opponent/top and requester/bottom cards retain the 16px viewport margins, 16px horizontal/12px vertical padding, frame/tails and bounded scrolling. Explicit board/row refs supply geometry: both tails follow the whole board midpoint and vertical positions follow their player rows, independent of trigger type. Existing viewport/orientation dismissal remains; no observers, ancestor searches or timers were added.
- Each current economy header has saved resources and purple **Fleet Value** on the left, bonus total/sources on the right. Fleet reads only the optional viewer-safe presentedFleetValue and is visible at phone widths when supplied; absence omits the row instead of inventing zero. Saved joining lines, joining bonuses, Centaur even-turn distinctions (including zero) and the applied win-streak explanation remain accessible. Changing combat period leaves economy unchanged.
- Both cards share local **LAST TURN / THIS TURN** selection. Either card updates both selected indicators. Selection persists across closing/reopening in the same game turn; the next opening after rollover resets to This Turn, and a new game resets/dismisses inspection. Existing phase/turn dismissal is preserved. Content continues to read live presented inputs; no inspection snapshots or selection timers exist.
- **Owner-confirmed period policy:** LAST TURN uses only the genuine preceding last_actual slot at presented turn minus one. Held current actuals and final results remain on the right tab. The extracted existing resolved matcher requires the expected source, exact turn and total; no equal-valued current/history fallback is used. Turn 1 has unavailable previous detail. Current inputs retain the dice-settle gate and requester/spectator privacy; the old automatic opponent-history substitution is removed.
- Combat uses incoming damage on the left and own healing on the right, with viewer-relative/spectator owner labels and one formatted total per contribution. Existing current/estimate/final heading helpers are reused. Mobile alone simplifies Autocast wording to **(ESTIMATE)** while preserving estimate inputs, approximation/uncertainty text and source rows. Concealed/unavailable columns do not hide an available sibling. Tab events stay inside the controls; ordinary content tap-dismissal, the 8px tap threshold, pointer identity/cancellation and scroll containment remain.
- **Validation:** npm run typecheck, npm run build and npm run test:client passed (**39 files, 360 tests**). Focused coverage includes period reopening/rollover/new-game identity, all four trigger callbacks/accessibility, owner mapping, economy invariance, Fleet absence/zero, joining/even/streak rows, estimate/final/uncertainty presentation, concealment, held/final/preceding-source validation, wrong-turn/equal-total rejection, tab containment, drag/cancel handling and board-centred tail geometry. The existing non-blocking >500kB build chunk-size warning remains. Automated callback/render tests do not establish browser layout or native event/scroll behavior.
- **Not run — browser/Vite testing handled by user.** Owner review remains **pending** for the 360px reference and other supported phone widths/heights, long source lists and resource/owner labels, tab switching/dismissal/scrolling, tails/clearance, spectators, held/final states and surrounding mobile controls.

### 2026-10-21 — 20A.7 typography, explicit refs and Phase A integration checkpoint

- **Pass type:** Client/UI. **Primary layer:** Display. Implementation and automated validation complete; **final owner visual acceptance pending**. Bars remain inactive. No server, gameplay, networking, runtime, tooling or configuration changes; Phase 20B has not started.
- The following exact desktop numeric tiers supersede prior health/delta, Saved/Bonus and resolved-contribution specifications, including the initial 20A.4 table and provisional Appendix B typography. **Every value uses explicit `line-height: 1` (`leading-none`), including inherited damage/healing span line heights.** Current contribution sizes already matched and were retained.

| Numeric element | Small: 768–1399px | Medium: 1400–1919px | Large: ≥1920px |
| --- | ---: | ---: | ---: |
| Health | 30px | 40px | 64px |
| Net delta | 16px | 24px | 28px |
| Current damage/healing | 20px | 24px | 28px |
| Saved Lines and Bonus values | 20px | 24px | 28px |
| Previous damage/healing | 14px | 16px | 20px |

- Both sides and all shared ordinary/joining/Centaur resource values use these tiers. Weights, colours, opacity, formatting, uncertainty markers and left-side right/right-side left alignment remain intact. Previous contributions stay centred in the health-number grid row; delta remains in its separate row with unchanged visibility/animation keys. Mobile typography/geometry, Fleet's 18px values and visibility, labels, names, clocks, hover-card typography and dice/helper dimensions are unchanged. The independent **1600px** centre-width/column-width transition remains intact.
- Stable board-root and bar-region refs are owned by `BoardStage` before its setup/board branch, attached in the shared `BoardStageFrame`, and supplied locally to the hover hook and dice component. Stat hover directly observes its trigger, board root and bar region instead of walking descriptive ancestors/querying placeholders. Dice guidance directly observes the board/bar refs instead of `closest('[data-name="Board Stage"]')`; bar observation also handles bar-height changes that leave root dimensions unchanged. Descriptive attributes remain inspection-only for these paths. Upstream dice presentation inputs do not acquire DOM-ref responsibilities.
- Existing layout-effect remeasurement, stat captured-scroll/viewport handling, disconnected/disabled trigger clearing, focus/card handoff, positioning calculations and observer/listener cleanup are retained. The same mounted die/keys remain in the same shared frame across setup and board modes. Guidance keeps its 500ms appearance delay, 150ms dismissal fade, overlay suppression and flip/clamp calculations; no context, registry, polling or timing layer was added.
- Central layout remains a full-height flex composition: uncapped bars grow into remaining space, real rows retain their height, zero-minimum spacers yield, and no central scrolling is introduced. Current-stack reservations still exactly cover two lines plus the 2px gap (42/50px), with 20px extra bottom padding at large sizes (78px). No additional spacing correction or obsolete-fragment removal was justified by source review.

| Integration area | Source review and automated evidence |
| --- | --- |
| Setup, concealment, intros, missions and player ordering | Shared frame/TopHud mounting, viewer-safe inputs and GameScreen/MainStage/mobile overlay gates retained; existing species-selection, matchup and mission coverage passes. |
| Clocks, dice/helpers and presentation holds | ClockWithIncrement inputs/lifecycle, GameScreen sound/Ready ownership, helper slots/keys and presented-stat gates retained; existing clock, helper and hold tests pass. Six new ref/observer tests cover direct targets without descriptive attributes, layout/viewport/scroll measurement, disabled/disconnected anchors, handoff, guidance delay/suppression/fade and cleanup. |
| Current/resolved/final stats | Existing affected-pool mapping, source/turn/total matching, concealment, uncertainty, Autocast qualifiers and final/history fallback retained; desktop/mobile semantic and rendering tests pass. |
| Economy, Fleet and streaks | Shared metrics cover saved/joining/even categories; existing live viewer-safe Fleet input, optional mobile row and streak details retained; Fleet, mobile economy and streak coverage passes. |
| Inspection, targeting, fitting and reveal | Desktop portal/focus wiring and mobile unified controls/period/row refs retained; FleetArea callbacks, FitToBox sizing and reveal/activation paths source-reviewed. Existing targeting/fleet presentation and inspection tests pass; native hit-testing, fitting and animation appearance require owner review. |
| Takeovers, finished surfaces and lower controls | Existing MainStage action-panel allocation and mobile mission/takeover/postgame gates/callbacks source-reviewed; no replacement or removal of working controls. |
| Responsive transitions and dense content | Production CSS confirms numeric tiers/line height and the independent 1600px centre width; shared frame identity and flex geometry source-reviewed. Short-window fit, long totals and dense resource/helper collisions remain browser-review items. |

- **Validation:** `npm run typecheck`, `npm run build` and `npm run test:client` passed (**40 files, 366 tests**, including six new behavioural cases). Production CSS inspection confirmed the emitted font sizes, media rules and `line-height: 1`. The existing non-blocking >500kB build chunk-size warning remains. Automated element doubles and source review do not establish native browser layout, focus/scroll behaviour or animation fidelity. No additional direct integration regression fixes were identified beyond observing bar-driven guidance movement.
- **Not run — browser/Vite testing handled by user.**
- **Owner review:** typography at 768/1400/1920px boundaries and the independent 1600px transition; short desktop height/bar growth/gap collapse/no central scrolling; long totals and dense Centaur/joining/helper combinations; previous-value centring with delta hidden/visible/animating; hover handoff and guidance during setup/intros/missions/resizing; representative spectator/finished views and unchanged phone layout/inspection.
- **Historical 20A.7 approval posture:** Phase B remained unapproved at this checkpoint. The separately approved 20B.1 data pass is recorded above; positive/negative scale geometry and retention (D10–D12), counter behaviour (D13), overheal (D14), timing/recovery and hold coordination (D15), preferences/reduced motion/sound (D16), and outcome styling (D17) remain for separate passes. Final Phase A visual acceptance remains a prerequisite for active fills, scales, legends and resolution animation.

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
- Desktop Fleet Value below Bonus on medium/large tiers, as implemented in 20A.4; mobile placement remains for its later pass.
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
- Saved lines, bonus lines and Fleet Value below the die; Fleet is hidden below 1400px.
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

For the later active bars, Judd has confirmed: desktop vertical bars use a **24px inner width**, **2px dark-grey container padding on every side**, and **28px outer width**. Mobile horizontal bars use a **10px inner height**, the same **2px padding on every side**, and **14px outer height**. These supersede provisional active-bar dimensions; this pass does not resize the existing Phase A placeholders.

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
- Desktop current values anchor beside bar bottoms; resolved values sit beside health numbers and use the period matching displayed health/net delta, including held/final cases.
- No new renderer may bypass the dice-settle gate or infer a hidden opponent estimate.
- Unknown values remain unknown; do not substitute numeric zero or derive bar previews from them.
- Preserve Autocast estimate inputs and their current applicability/privacy. Desktop retains `AUTOCAST ESTIMATE`; mobile 20A.6 uses `(ESTIMATE)` wording under the approved pass.

### 6.3 Desktop inspection

Desktop current stacks open compact 240px cards with vertically stacked current damage/healing sections; entire health/resolved-value groups open the same stacked treatment for validated resolved contributions. Owners and Autocast qualifiers remain attached to their applicable sections; the period heading retains its estimate qualifier. The separate desktop health-summary hover has been removed. Accessible health descriptions retain health/max-health information; visible caps await the future legend by owner decision. Economy breakdowns remain available.

20A.4 implements outward placement with viewport flip/clamp and internally scrollable cards; 20A.7 supplies explicit board/bar refs for responsive anchor measurement. Owner visual review remains pending. Mobile uses the implemented 20A.6 unified inspection contract below.

### 6.4 Mobile paired popovers

The implemented 20A.6 direction is two paired cards with:

1. A stable current economy summary above the tabs: saved resources, Fleet Value when its presented input is available, and bonus sources.
2. Internal `LAST TURN` (left) and `THIS TURN` / `THIS TURN (ESTIMATE)` / `FINAL TURN` (right) controls for combat contributions.
3. Two contribution columns grouped by affected health pool.

Use one shared selected period. Activating either card's tab changes both cards and both selected indicators. Never show one card's current estimate against the other card's last-turn result accidentally.

The economy header remains current on both tabs. Establish that scope through separation and labels, not by making historical values look current.

Implemented 20A.6 period policy (owner visual review pending):

- Open initially on This Turn; derive estimate/final wording from the presented current source.
- Remember selection when closing/reopening during the same game turn.
- Do not unexpectedly change selection while the user is inspecting an open card.
- Reset to This Turn on the next opening after a turn change; reset/dismiss on a new game. Preserve existing phase/turn dismissal. LAST TURN retains the genuine preceding slot during held/final presentation; the right tab carries current/final actuals.
- On Turn 1, treat unavailable previous history as unavailable, not invented breakdowns; retain existing meaningful neutral totals where applicable.

Preserve outside-tap dismissal, tap-versus-drag handling, pointer containment and anchors. Tab taps must not dismiss the pair or activate the board behind it. Long content must remain reachable within the available viewport.

### 6.5 Economy and fleet value

- Keep ordinary saved lines and joining resources separate.
- Preserve all Centaur bonus categories and their established conditional visibility, including zero where current behaviour intentionally shows it.
- Preserve source breakdowns and win-streak bonus explanation.
- Fleet Value is a secondary metric, not a new resource or ship count. Reuse existing canonical valuation/presentation inputs; do not invent a local cost formula in JSX.
- Desktop 20A.4 includes a pastel-purple `Fleet` row beneath Bonus, visible from 1400px. Mobile 20A.6 shows `Fleet Value` beneath Saved lines inside the paired cards at phone widths when the presented input exists; no new desktop Fleet hover is introduced.
- Live value uses filtered viewer-safe fleet summaries and mirrored integer `totalLineCost`, before transient target projections. An end-of-turn history value must not be relabelled as current.
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

20A.3 moves desktop first-turn helper presentation and its local appearance/fade lifecycle alongside the central die. Eligibility, session dismissal, Ready orchestration and intro dependencies remain with their existing owners; mobile guidance is unchanged.

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

**Goal:** Implement desktop affected-health-pool grouping, responsive economy including Fleet, and consolidated current/resolved inspection.

**Expected scope:** `BoardStage.tsx`, `boardStatPresentation.ts`, `BoardStatBreakdownHoverCard.tsx`, `useBoardStatHover.ts`, `healthBreakdownPresentation.ts`; runtime/types only for specific missing presentation inputs.

**Work:** current red/green stacks beside bar bottoms; small/dim resolved stacks beside health; combined current-stack and complete-health-group inspection; responsive economy categories and Fleet from 1400px; accurate anchors and bounded scrollable cards. Consume existing presented estimate states and maintain Autocast qualifiers. Keep resolved sources matched to displayed health and remove the obsolete desktop health-summary renderer.

**Acceptance:** numeric values and breakdowns agree with the old presentation for the same state; owner mapping is correct; last-turn access remains; concealed values stay concealed. Centaur ordinary/even/joining and streak sources are retained.

### 20A.5 — Mobile status composition and placeholders

**Type:** Client/UI Pass. **Dependency:** shared presentation semantics and owner-supplied mobile design.

**Goal:** Implement the revised mobile rows and horizontal placeholder space around existing dice/clocks.

**Expected scope:** `MobileStatusRail.tsx`, `MobileBoardView.tsx`, `MobileGameLayout.tsx` and directly related layout components/props.

**Work:** player rows, reordered stats, inactive horizontal bars/shared legend, names/statuses and net delta; integrate with existing fleet regions and bottom controls. Preserve current mobile die/modifier placement.

**Acceptance:** approved phone widths/heights remain usable; no clipped names/totals essential to decisions; fleet tapping/targeting and bottom actions still work; all current stats and detail entry points remain available.

### 20A.6 — Mobile paired inspection and shared time tabs

**Type:** Client/UI Pass. **Dependency:** 20A.5 anchors and shared stats semantics.

**Goal:** Implement the paired popover design and a shared current/last period selection. **Implemented 2026-10-21; owner visual review pending.**

**Expected scope:** `MobileStatBreakdownPopovers.tsx`, `mobileStatPresentation.ts`, existing anchor/selection owner in `MobileStatusRail.tsx` or its current parent, and directly related shared presentation helpers.

**Work:** stable economy header, damage/healing columns, tab controls, selected-period lifecycle, bounded scrolling and valid empty/concealed/Autocast states.

**Acceptance:** either card switches both; headers remain current; taps do not dismiss or reach the board; long content and tiny viewports remain navigable; last-turn values use resolved data. No duplication of estimate logic.

### 20A.7 — Typography, integration and Phase A acceptance

**Type:** Client/UI Pass. **Dependency:** all approved 20A passes.

**Goal:** Finalise exact desktop numeric typography, remove the two selector dependencies and check Phase A integration before active health bars. **Implementation and automated validation complete; final owner visual acceptance pending.**

**Expected scope:** `BoardStage.tsx`, `useBoardStatHover.tsx`, `DesktopDicePresentation.tsx`, focused behavioural tests and this plan. Other Phase A components receive only named, narrowly justified direct regression fixes.

**Work:** apply the exact 20A.7 numeric table above with line-height 1; pass explicit board-root/bar-region refs through existing composition; review the preservation matrix, setup, spectator/finished views, guidance, menus and responsive transitions. Preserve the independent 1600px width change. Remove obsolete presentation fragments only after their replacement and all consumers are verified.

**Acceptance:** implementation/automated checks complete; Phase A stands alone with inactive placeholders. Final layout/interaction acceptance remains pending Judd's browser review. Record remaining Phase B choices without implementing active fills, scales, legends or health-resolution animation.

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
- Implemented pure API: `prepareHealthBarScale`, `mapHealthBarValue`, `calculateHealthBarLegend` and `retainPreparedHealthBarScale` in `display/healthBars/healthBarScale.ts`. Prepared geometry is immutable; normalized 0 is the exact domain minimum and 1 the exact maximum. 20B.3 renders explicit static states; live adoption remains deferred.
- Desktop uses a vertical mapping; mobile uses the corresponding horizontal mapping.
- Mobile's default non-negative domain places zero on the left and positive health toward the right. When negatives are included, retain a visible zero reference within the shared mapping.
- Both orientations use the same logical damage, clearance, healing, surplus and settle stages, presentation/controller and scale rules; do not create a separate mobile animation engine.
- The positive range includes the relevant authoritative maximums, with a default baseline of 0–35.
- The negative range includes the lowest displayed damage-stage value and any starting/final negative values across both players, plus the deepest negative prepared boundary retained for the current live game. Settled preparation uses current health, available caps and that retained floor; an unknown cap remains unknown. Domain limits are independent of label density.
- Overheal does not expand the positive range merely to show unused healing.

### 11.2 Protected positive section

Reserve a minimum readable amount of bar space for the positive-health interval. The owner-approved initial fraction is **35%** for both desktop and mobile, configured independently as `HEALTH_BAR_SCALE_CONFIG.desktop.minimumPositiveFraction` and `.mobile.minimumPositiveFraction` (both 0.35).

This is a screen-space guarantee, not a minimum player health or a new maximum-health rule. If the relevant maximum exceeds 35, such as an Ancient maximum-health increase, the shared positive range must accommodate it. Retain a way to identify each player's actual cap when caps differ.

### 11.3 Conditional negative compression

Use the same units-per-pixel above and below zero while the natural positive fraction is at least the configured minimum. Only below that threshold, reserve the minimum positive fraction and linearly compress the negative region into the remainder. The mapping is continuous at zero. With top 35, −60 remains linear (positive fraction approximately 36.84%); −300 reserves 35% for positive values and 65% for negatives.

The threshold and protected fractions now live in the shared helper/configuration, without outward domain rounding or JSX constants. Zero moves with the mapping; without negatives it is at mobile left / desktop bottom. A small axis-break cue remains a proposal for rendering review; the required outcome is that differing positive/negative scales remain understandable.

Do not compress each player's negatives differently. A value of −60 must occupy the same position for both bars in the same view.

### 11.4 Legend labels

- Keep zero identifiable.
- Legend text uses the existing `grey-50` palette token.
- Keep the positive top/maximum context identifiable.
- Use legible rounded intervals such as 5, 10, 20 or larger steps as space/range requires.
- Reduce intermediate label density before allowing collisions.
- Exact health remains available in the main number even where ticks are sparse.
- Do not show a finite floor label while silently clipping more extreme values; enlarge/recalculate the range coherently.
- Separate tick-label thinning from scale calculation; omitting a label must not move the mapped value.
- Shared numeric-label limits are **9 mobile / 10 desktop**, including visible labels during coordinated transitions. Current adjustable center-spacing estimates are 24px for each orientation. Calculate readable regional steps starting at 5/10/20/50/100 and coarsen regions before exceeding the orientation's budget; candidate generation is bounded by the label limit. Typography measurement belongs to later rendering.
- Zero and exact positive top always remain, even if they overlap on tiny/zero axes (owner choice). Preserve useful negative context, including −5 for a −5 domain, without an unconditional −5 in larger domains. Deduplicate values and avoid negative zero. Each known player cap retains separate position metadata whether or not it is a tick. Preserve the default mobile labels and the readable nine-label −40-to-35 example in the refinement record above.
- Cache transition selection per sequence/orientation/axis configuration, reserving both endpoint tops and negative context. Use deterministic mapped coverage for optional thinning and stage outgoing optional fades before incoming optional fades reuse those slots when the union exceeds budget. Numeric keys and shared movement remain stable; the existing duration/easing is unchanged.

### 11.5 Scale lifecycle

Owner-confirmed: legend and mapping adjust dynamically to the complete snapshot's required damage/healing range, respecting capped positive health, increased maximums and shared negative compression. Establish the range before contribution motion and freeze it throughout damage/healing/overheal. Both bars change mapping together; surplus healing does not expand positive stored-health extent.

Owner-confirmed revised policy: retain the deepest rounded negative boundary for the current live game, including complete accepted paired resolution lows and valid selected settled fallback lows. Later incoming, outgoing/start-scale and settled preparation cannot contract that boundary. Positive maxima remain governed by represented health and authoritative caps and may contract. Both bars and legend adopt together before motion; freeze through damage, clearance, healing, surplus treatment and settling. Never derive retention from animated values, rejected candidates or hidden DTOs.

The mounted session hook owns only the game ID and negative floor, independently of playback recovery identity. Source release, next turns, settled reconciliation, resize, desktop/mobile changes, temporary absent context and same-game recovery preserve this memory. A different game resets it. The existing identity guard still rejects unrelated prepared objects, and recovery clears snapshots/completion receipts; preserving the floor cannot revive stale playback or deltas. Fresh settled preparation receives the retained floor. Independent Graphics Test scenarios have no live per-game memory. Full reloads do not reconstruct missed resolutions, and no storage is introduced. This does not change 20B.1 eligibility or release behavior.

20B.4 implements coordinated scale-transition animation preserving logical health while white bars, contribution geometry where relevant, zero/cap markers and legend share one transition mapping. Scheduling belongs to the presentation controller; live adoption remains for the integration passes.

Resize may regenerate label density without changing frozen geometry; it is not a new resolution. Both orientations consume the same controller playhead and stage durations; changing dimensions or breakpoint does not restart logical progress. Future live owners must remain mounted above the orientation-specific consumers.

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

Zero markers remain visible in every rendered state, including settled and terminal, **above all red/green layers**. Desktop uses a white marker **3px thick spanning the 24px inner width**. Mobile uses the equivalent orientation-aware marker across the 10px inner height.

### 12.2 Semantic stages

The labels below describe states, not mandatory code identifiers:

| Stage | Visual purpose | Exit condition |
| --- | --- | --- |
| Settled start | Establish previous health and applicable maximum. | Valid new live resolution accepted once. |
| Scale preparation | Establish shared domain/legend without inventing a health change. | Mapping ready. |
| Damage reveal/movement | Show red contribution and reduce displayed position toward `start − damage`. | Damage stage complete or absent. |
| Damage clearance | Clear nonnegative red to zero length; for negative damage-stage health retain red exactly from that health to zero. | Empty green handoff at damage-stage health. |
| Healing reveal/movement | Grow green from zero length at damage-stage health; retain full negative red behind it only for a negative start. | Reaches authoritative cap/final position with retained negative red still present. |
| Retained red removal | Remove the pre-healing trail only for recovery finishing at zero or above; negative-final siblings retain red from final health to zero beneath completed green. | Include only when at least one recovering player needs full removal, after target arrival. |
| Healing clearance | Contract green; negative finals continuously preserve remaining red from final health to zero. | Green clears explicitly with the same remaining negative red still visible. |
| Surplus healing completion | Express unused healing within the approved track treatment without increasing white fill beyond cap. | Surplus presentation complete or absent. |
| Settle | Clear transient colours; explicitly retain red from negative final health to zero, or normal positive white fill. | Coordinated end-of-turn handoff. |
| Terminal settled | Show final loss/draw/narrow-victory treatment using authoritative outcome. | Normal finished-game navigation. |

One resolved update may contain several visual stages. Skip irrelevant stages for zero damage/healing; do not force empty delays. Both players share stage boundaries so the comparison remains readable even if only one has a contribution.

Owner-confirmed 20B.3 refinement, including the negative-final continuity correction: handoff is an empty-green boundary, not partially grown green. Nonnegative damage-stage health has no visible red during healing. Negative damage-stage health retains its full red interval to zero throughout green growth, across zero and at the target-reaching sample. Full trail removal before green clearance applies only when recovery finishes at zero or above. A negative-final player instead retains red from final health to zero through clearance and settling, including during a sibling's shared removal stage. Add that shared stage only if at least one recovering player needs full removal. Rules apply independently per player. A player without healing keeps its completed damage state while its sibling heals; damage-only negative final red persists. The generic renderer continues to accept independent intervals without enforcing or inferring stages.

### 12.3 Negative values and outcomes

Preserve the visible zero reference when motion crosses below zero. Positive white fill should not imply stored negative health. Transient red/green geometry must make below-zero movement understandable.

Owner-confirmed: settled negative health explicitly supplies red `{ from: finalHealth, to: 0 }`, with no green or white negative fill. A zero final has no nonzero red. For healing that ends negative, keep the pre-healing red behind green through target arrival, then preserve the uncovered final-negative interval continuously while green clears and through settling. The covered old trail may be trimmed beneath completed green, without any visible disappearance of the remaining red. There is no all-red-removed state for that player. This supersedes the earlier blanket trail-removal rule. This presentation colour is not victory/loss inference; do not make the generic renderer infer red from negative intermediate health.

Defeat/victory feedback happens only at the appropriate settled terminal stage, using canonical outcome. Both players can finish below zero under existing result rules; never decide the winner from a simplistic `health > 0` display check. Non-health finishes must not invent a damage volley.

Terminal outcome lettering, implemented in the separate 2026-10-23 Client/UI feature pass:

| Canonical finished reason | Winner | Other player |
| --- | --- | --- |
| `decisive`, `resignation`, `timeout` | `V` | `L` |
| `narrow` | `NV` | `NL` |
| `mutual_destruction`, `agreement`, `timeout_draw` | `D` on both tracks | `D` on both tracks |

Require valid distinct player identities and a matching winner for wins, or no winner for recognised draws. Explicit win/draw scalars, when present, must agree; existing envelopes that omit that scalar remain supported. Active games and restart/unknown/inconsistent endings have no letters. The zero-relative text is centred across the track interior, above zero on desktop and right of zero on mobile; it never follows final health. Light/dark glyph copies clipped against the exact white fill maintain contrast while the zero marker remains above them. Full meanings join the existing accessible bar descriptions without live frame announcements.

Letters remain hidden through all bar motion and the final-to-final number tail, then share one session-owned 400ms opacity fade. Non-health finishes wait only for relevant accepted presentation. Initial finished loading, unsupported settled presentation, recovery and reduced motion show settled letters immediately. Source release, duplicate delivery, resizing, layout changes and other display interactions cannot restart the reveal. Identity/outcome changes cancel stale work. The fade never extends terminal completion receipts, navigation timing or gameplay holds; Missions remain manual-only.

### 12.4 Overheal

- White health fill stops at the player's authoritative maximum.
- Gross healing remains visible in totals/breakdowns, subject to existing semantics.
- Surplus animation stays within the approved track treatment; it does not create temporary stored health above the cap or stretch the positive legend to raw healing totals.
- Starting at full health with healing, damage followed by excess healing, and increased-cap cases use the owner-confirmed value intervals below; 20B.4 implements their bounded durations/interpolation.
- The final visual state is exact authoritative health with transient colour cleared.

Owner-confirmed surplus geometry supersedes the initial travelling green-window examples. Compute unused healing as `max(0, damageStageHealth + grossHealingReceived − finalHealth)` and displayed amount as `min(unusedHealing, maxHealth)`. Keep white at the supplied final/capped health. Grow green from `0→0` through a partial amount to `0→displayedAmount`, then shrink its upper endpoint back to zero and clear green. Its lower value endpoint remains fixed at zero, including when zero lies inside an expanded negative domain. Nonparticipating players retain settled state; omit the surplus block when neither player has unused healing. Static reference samples use half-amount growth and return; 20B.4 supplies continuous mapped-endpoint movement and bounded durations.

### 12.5 Numerical health and net delta

20B.5 refined desktop policy, adopted by mobile in 20B.6, supersedes frame-following numbers: hold previous authoritative finals through the entire bar sequence, including surplus return, then count directly to each captured next final. Both sides use the same bar-end boundary, existing easing and separately adjustable `HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs` (300ms). Skip unchanged numbers; round only displayed text and finish at exact captured finals. The same controller owns both stages; terminal presentation completion waits for the number tail while bar completion/delta reveal retain their existing timing. Settled/recovery updates show authoritative health directly, and reduced motion completes immediately. These numbers have no gameplay authority.

The persistent net delta is actual authoritative change, including clamping. It must not become gross healing minus damage in overheal cases. Preview/estimate changes do not trigger a resolved-health animation.

20B.4 exposes captured actual deltas with one paired completion gate. 20B.5 desktop and 20B.6 mobile consume that gate, revealing both deltas only after all required stages, including surplus return, and retaining them after source release. Appearance uses the matching resolution's completion identity; unsupported/recovery inputs retain safe settled eligibility without delayed replay.

## 13. Timing, presentation lifecycle and recovery

### 13.1 Dedicated controller, existing lifecycle

20B.4 provides a dedicated health-bar presentation controller/hook with explicit stages, a captured immutable input snapshot and one configuration location for timing. 20B.5 connects desktop and 20B.6 connects mobile to the existing end-of-turn live-capture seam. Capture precedes source release; stable session controller ownership continues independently after next-turn dice publication and layout switches. This supersedes the earlier expectation of live end-of-turn hook integration within 20B.4.

Do not create a second polling/subscription path. Do not advance authoritative phases from bar-rendering components. Reuse the existing continuation seam and keep networking in the runtime.

### 13.2 Tweakable parameters

Terminal lettering adds `HEALTH_BAR_ANIMATION_CONFIG.outcomeLetterFadeMs = 400` for a linear paired opacity fade after overall presentation completion. The session hook owns the fade above layout branches; it is independent of completion receipts. Zero offsets are separately named desktop/mobile constants in `HealthBar.tsx`, initially 4px, with initial bold 12px desktop / 9px mobile lettering. These are owner-tunable visual values, not layout dimensions.

Animation timings live in **`src/game/display/healthBars/healthBarAnimationConfig.ts`**. Contribution easing is **`cubic-bezier(0.7, 0, 0.3, 1)`**, evaluated by solving x for elapsed time. Movement duration is **`clamp(maxMappedEndpointTravel × 1400, 700, 1400)` ms**, measured against the usable inner axis across both players/orientation mappings. This supersedes the proposed 35-health-unit threshold. No visible movement means no movement stage. Initial scale transition is **350ms**, conditional red-to-green handover **200ms**, extra final settle **0ms**. Desktop final-to-final numbers use **300ms** via **`settledNumberTweenMs`**, starting at bar completion with the same easing. Development-only completed hold is **1200ms**, separately named in the same file. Scale thresholds/protection remain in 20B.2; remaining production preference wiring is deferred. The timing responsibilities are:

| Parameter | Purpose |
| --- | --- |
| Scale preparation/transition | Time to establish the new shared mapping. |
| Damage reveal and travel | Red motion and health movement. |
| Damage pause/clear | Readability between contributions. |
| Healing reveal and travel | Green recovery. |
| Surplus-healing completion | Bounded feedback after cap arrival. |
| Final clearance/settle | Return to the stable bar. |
| Settled desktop numbers | Count directly from previous to next final after full bar completion. |
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
- Source-snapshot release is not controller cancellation. Accepted animation may continue into the next turn without changing authoritative holds, clocks or dice timing; newer resolution input supersedes instead of queuing.
- Resize/remount and desktop/mobile switches must not trigger another resolution, sound or outcome announcement.
- Terminal completion is signalled using captured canonical outcome; future finished-game integration must not add an authoritative hold or presentation deadlock.
- Disabled/reduced motion reaches the same final state and paired completion safely; no controller operation advances authoritative phases.

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

**Implemented 2026-10-22:** see the 20B.1 implementation record above for actual source eligibility, lifetime/release, cap provenance, fallback and validation. This does not complete 20B.2 or any later pass.

### 20B.2 — Shared scale and legend calculations

**Type:** Client/UI Pass. **Dependency:** semantic snapshot and reviewed responsive scale rules.

**Goal:** Implement pure scale/tick calculations shared by both bars and orientations.

**Scope:** `display/healthBars/healthBarScale.ts`, focused display tests and this plan. Existing 20B.1 types are inputs; runtime, rendering and Stats graphs are unchanged.

**Work:** default positive range, increased caps, per-breakpoint positive-space protection, negative compression threshold, rounded ticks, label thinning and scale retention policy.

**Acceptance:** mapping is monotonic, consistent for both players and exact at zero/caps; −300 does not squash positive health beyond its approved minimum; labels do not dictate geometry. Focused numerical tests cover threshold/extreme cases.

**Implemented 2026-10-22:** pure shared scale/legend preparation, conditional piecewise-linear compression, independent label density and identity-based retention guard; see the implementation record above for API, policy and validation. 20B.3 static rendering and 20B.4 controller/gallery are subsequently implemented; live integration remains for 20B.5–20B.7.

### 20B.3 — Atomic bars and legend rendering

**Type:** Client/UI Pass. **Dependency:** 20B.2 and reviewed bar appearance.

**Goal:** Render vertical/horizontal bars from explicit presentation state, without owning resolution scheduling.

**Implemented scope:** reusable bar/legend/pair components and pure presentation geometry under `display/healthBars/`, focused display tests, static Graphics Test examples and this planning update. Existing live placeholders are unchanged.

**Work:** tracks, fill, red/green overlays, zero/cap markers, differing maximums, compressed negative cue and surplus-healing visual treatment. Support inspection of named states in the existing suitable development surface if agreed; do not build a new framework.

**Acceptance:** individual supplied animation-sheet states are representable at intended dimensions; values are not clipped or misleading; no timers/networking/rule calculations inside the atomic renderer.

**Implemented 2026-10-22:** explicit independent red/green intervals, capped positive white fill, exact track/background geometry, persistent zero, shared legend and provisional cap/compression markers. The subsequent reference-keyframe refinement corrects handoffs, retained negative trails, persistent negative-final red and zero-anchored surplus; nine manually selected paired Graphics Test scenarios provide the reference states. Automated validation passed; owner visual review remains pending. See both 20B.3 implementation records above. 20B.4 subsequently adds controller/animated examples; live integration remains deferred.

### 20B.4 — Dedicated multi-stage animation controller

**Type:** Client/UI Pass. **Dependency:** 20B.1–20B.3 and reviewed stage/timing decisions.

**Goal:** Turn one resolved snapshot into a bounded, cancellable and coordinated sequence.

**Implemented scope:** dedicated presentation controller/hook, pure sequence/scale-transition helpers, central timing configuration and animated Graphics Test examples. Live end-of-turn hook integration is explicitly deferred to 20B.5–20B.6; no `useGameSession.ts` restructuring.

**Work:** stage transitions, both-player coordination, no-op skipping, immutable snapshots, cancellation, progress, disabled/reduced motion and terminal completion signalling.

**Confirmed keyframe requirements from 20B.3 refinements:** preserve the empty positive handoff; negative clearance ending exactly at zero; unchanged negative red behind green through target arrival; and zero-anchored surplus growth/return capped to actual unused healing and owner maximum. Only recovery finishing at zero or above uses target → retained-red removal → green-clearance boundaries, with a shared removal stage only when at least one player needs it. Negative-final players continuously preserve `finalHealth→0` red through any shared removal stage, green clearance, Healing cleared and Settled final; never empty the negative bar and restore red at settling. Trimming covered old red beneath completed green must not alter visible remaining red. Apply independently per player with one retained prepared scale per orientation. These confirmed relationships supersede blanket removal, generic overlap and travelling-window examples; do not reintroduce them while implementing timing/interpolation.

**Acceptance:** one sequence per identity; identical logical stages for both orientations; deterministic time-based transitions; extreme values do not extend turns indefinitely. Tests cover skips, interruption, duplicates and terminal completion.

**Implemented 2026-10-22:** controller/gallery and automated validation complete; owner visual review pending. See the 20B.4 record above. Static examples remain intact. Live bars, production deltas/main-number coordination and preferences remain unimplemented.

### 20B.5 — Desktop live integration

**Type:** Client/UI Pass. **Dependency:** controller and atomic rendering complete.

**Goal:** Activate desktop bars and coordinate the desktop health numbers/overlays with the existing phase presentation.

**Expected scope:** `BoardStage.tsx`, direct parent props, existing health presentation consumers and new bar components.

**Acceptance:** live contributions and final health agree; no old/new counter competition; next dice, outcomes, popovers and fleet presentation follow the approved sequence. Mobile remains coherent until its integration pass.

**Implemented 2026-10-22:** stable session controller ownership, capture/release continuity metadata, responsive desktop pair, final-to-final main numbers after bar completion, bar-completion deltas, responsive lower-row reservations and narrow terminal handoff after number completion. Automated validation passed; owner browser review pending. See the implementation records above. 20B.6 is subsequently implemented; remaining 20B.7 work is incomplete.

### 20B.6 — Mobile live integration

**Type:** Client/UI Pass. **Dependency:** shared controller and reviewed mobile scale/layout.

**Goal:** Activate horizontal bars without another animation engine or dice change.

**Expected scope:** `MobileStatusRail.tsx`, direct mobile presentation props and shared bar/controller consumers.

**Acceptance:** the same resolution renders correctly horizontally; both bars/legend stay aligned; stats taps/popovers, clocks, existing dice/helpers and fleet interactions survive. Breakpoint transition does not replay the resolution.

**Implemented 2026-10-22:** measured compact 14px/10px/14px pair (38px total), shared session playback and final-to-final numbers, complete upper/lower ownership mapping, paired completion deltas and presentation-only terminal handoff after the number tail. Automated validation passes; owner visual acceptance remains pending. See the 20B.6 implementation record and owner checklist above. Remaining 20B.7 work is incomplete.

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
| D03 | Responsive rules | Phase A implemented: 767/768px mobile boundary; desktop typography tiers at 1400/1920px with independent 1600px centre-width change. Final visual acceptance and any further owner requirements remain pending. | Each affected layout pass |
| D04 | Header and omitted elements | Phase A header/setup/clock/status/intro inventory and source review complete; owner visual acceptance pending. | 20A.1–20A.7 |
| D05 | Fleet Value | Implemented: desktop purple `Fleet` below Bonus from 1400px; mobile `Fleet Value` below Saved lines in both inspection cards. Reuses the optional live viewer-safe value. Owner visual review pending. | 20A.4–20A.6 |
| D06 | Shared mobile time tabs | Implemented: shared selection retained within a game turn; reset on next opening after rollover/new game. Last uses the genuine preceding slot; held/final current actuals stay on the right. Owner visual review pending. | 20A.6 |
| D07 | Desktop last-turn inspection | Implemented: entire health/net/resolved-value group opens matching resolved damage/healing sections; current stacks open current-only sections. Both use compact 240px stacked cards. Owner visual review pending. | 20A.4 |
| D08 | Helper placement | 20A.3 implemented using the approved L/M/S CSS targets and compact CHR grid; existing selection preserved. Owner visual review pending. | 20A.3 |
| D09 | Server extension | 20B.5 correction captures resolution-time finals/caps atomically with existing aggregate maps and exposes them through intent/full-state responses. Matching finalized history uses captured caps. Exact live capture survives next-turn fleet work without history. Older provenance remains unavailable. | Implemented in approved 20B.5 Mixed Pass; deployment/owner review pending |
| D10 | Positive-space clamp | 20B.2 calculations implemented: independently configurable desktop/mobile minimum positive fraction, both initially 0.35; shared positive domain accommodates caps and positive starts/finals above baseline 35. | Live in desktop/mobile; owner visual acceptance pending |
| D11 | Negative compression | 20B.2 calculations implemented: single linear scale until natural positive share falls below minimum, then continuous piecewise-linear negative compression. 20B.3 adds an external grey-50 double-slash cue; appearance remains provisional pending owner review. | Calculations/rendering implemented; visual review pending |
| D12 | Scale retention | Session-owned negative floor deepens from complete accepted paired facts or valid selected settled fallback and never contracts within the mounted game. All preparation paths receive it; same-game recovery keeps only the floor while clearing stale playback/receipts. Different games reset it. Positive bounds may contract; contributions retain frozen mappings. Settled cap/health reconciliation and delta suppression retain their existing ownership. | Desktop/mobile refinement implemented; owner visual acceptance pending; 20B.7 incomplete |
| D13 | Counter behaviour | Refined 20B.5 policy adopted by 20B.6 mobile: numbers hold previous authoritative finals through all bar motion, then count directly to captured next finals using the same controller and easing; round only text. Overall presentation completion waits for this tail; deltas reveal at bar completion. Settled/recovery numbers are direct; reduced motion is immediate. | Desktop/mobile implemented; owner visual acceptance pending |
| D14 | Overheal | Zero-anchored, capped surplus extension/return implemented by 20B.4; white remains supplied final/capped health and mapping never expands for unused healing. Desktop/mobile numbers hold previous finals through surplus return, then update; paired deltas reveal at bar completion. | Desktop/mobile integrated; owner visual acceptance pending |
| D15 | Animation timings | Implemented central settings: mapped-travel clamp 700–1400ms, conditional 200ms handover, 350ms scale transition, 0ms extra settle, actual cubic-bezier(0.7, 0, 0.3, 1). Shared desktop/mobile settled-number tail 300ms via `settledNumberTweenMs`; development hold 1200ms separate. Raw-health threshold superseded. Playback may continue into next turn without changing authoritative timing. | Controller complete; visual tuning pending |
| D16 | Preferences | Controller/gallery support disabled/reduced motion; 20B.5 live ownership also observes reduced motion. Existing Health Flash purpose and sound ownership are unchanged; no new preference or rename. Remaining preference/sound decisions stay deferred. | Remaining work 20B.7 |
| D17 | Outcome markers | Separate terminal-letter feature implemented: canonical `V/L`, `NV/NL`, `D/D`, validated by reason/result/player identity without health inference. Session-owned paired 400ms fade follows bars and numbers; loading/recovery/reduced motion settle immediately. Zero-relative light/dark lettering and full accessible meanings preserve dimensions and completion timing. Persistent final-negative red remains unchanged. | Feature implemented; owner placement/contrast/fade acceptance and broader 20B.7 cleanup pending |
| D18 | Placeholder treatment | Phase A used neutral tracks/blank lanes: desktop 24px tracks and 56px lane; mobile 12px tracks/lane. Superseded in live board views by 20B.5/20B.6; unavailable mobile presentation reserves the active 14px/10px/14px footprint. | Historical Phase A; live integration implemented |
| D19 | Desktop numeric typography and refs | Exact 20A.7 tiers/line-height 1 and explicit board/bar refs implemented and automated checks passed; final owner visual acceptance pending. | 20A.7 |
| D20 | Active bar geometry | Desktop vertical, inner width 24px / padding 2px per side / outer width 28px; 20B.5 measures the flexible outer region and supplies inner height minus 4px. Desktop full-opacity gradient remains grey-90 at 0%, #101010 at 80% through 100%. Mobile live pair: 10px inner / 14px outer tracks, 10px shared legend, 38px total without internal gaps, flat grey-90; shared inner axis is measured left-column width minus 4px. | Desktop/mobile integrated; owner visual acceptance pending |
| D21 | Mapping and zero reference | 20B.2 mapping and 20B.3 rendering implemented: shared mapping, persistent white 3px zero above colours across the full interior, padding-aligned grey-50 legend at 12px desktop / 10px mobile, regular weight and line-height 1. Live mobile compact labels omit vertical padding. Edge marker rectangle shifts inward without changing the scale. | Live integration implemented; owner visual acceptance pending |
| D22 | Snapshot lifetime and provenance | Exact aggregate-time metadata plus a live intent/adjacent observation establishes immutable paired capture without history. Source release and N+1 DTO updates do not cancel accepted playback. Bootstrap/refresh/recovery and persisted metadata alone never initiate historical replay. Older next-turn payloads without provenance settle. | 20B.5 correction |
| D23 | Contribution keyframes | 20B.4 continuous sequence agrees with corrected static boundaries: empty nonnegative handoff, full negative red behind growing green, invisible covered-red trimming at target, continuous finalHealth→0 red through clearance/settling for negative finals. Rules apply independently per player. | Controller complete; visual review pending |

Additional discovered requirements should be added here with their affected pass. A later approved pass plan may supersede an entry at Judd's discretion.

## 17. Completion criteria

### Phase 20A complete

Implementation and automated validation are complete through 20A.7. The owner-review items below remain pending; this is not final Phase A acceptance or approval to begin Phase B.

- Desktop layout and header reorganised and owner-reviewed.
- Desktop die/helpers moved with behaviour retained; mobile die unchanged.
- Stats grouped correctly by affected health pool; all current/last and economy detail remains accessible.
- Mobile layout/popovers and shared time selection implemented and reviewed.
- Placeholders reserve accepted bar geometry without active sequences.
- Further responsive requirements relevant to Phase A are incorporated.
- Current conditional features and live post-ZIP fixes remain intact.
- Exact 20A.7 desktop numeric tiers use line-height 1; both layout-selector dependencies use explicit owner refs, with automated behavioural coverage.

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

**Codes:** E = existing CSS in `1020.zip`; R = approximate raster measurement from named reference; P = proposed initial CSS value; A = approved CSS target, pending final owner visual acceptance; O = open.

### B.1 Existing CSS anchors

This table records the historical ZIP baseline, not current implementation requirements. Phase A pass records supersede changed values; desktop numeric typography uses the exact 20A.7 table above. Do not reapply historical overrides.

| Element | Value / baseline | Class | Notes |
| --- | --- | --- | --- |
| Mobile selector | ≤767px | E | Existing media-query threshold; not permission to change breakpoint policy. |
| Intermediate desktop styling | 768–1599px | E | Existing targeted overrides. |
| Desktop outer horizontal padding | 30px; 16px intermediate | E | `GameScreen.tsx`. |
| Desktop left-rail width | 290px | E | Check all visibility/parent rules before altering. |
| Brand type | 45px/45px; 40px/40px intermediate | E | Existing font-size/line-height. |
| Centre stats column | 230px; 200px intermediate | E | Existing `BoardStage.tsx` width. Target may differ. |
| Desktop health number | 64px/64px; 56px/56px intermediate | E | Historical; superseded by 20A.7 tiers and line-height 1. |
| Desktop net delta | 28px/28px | E | Historical; superseded by 20A.7 tiers and line-height 1. |
| Standard desktop metric | 36px/36px; 30px/30px intermediate | E | Historical; use the approved per-category 20A.7 tiers. |
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
| Bar tracks | About 26px wide, 402px high, starting near y=18 | R / A | Owner-confirmed active desktop inner width 24px, padding 2px every side, outer width 28px; height governed by reviewed layout. |
| Gap between tracks | About 72px including legend region | R | Preserve a readable central tick-label lane; exact gap O. |
| Health-number row | Near y=441–485 | R | Below bars; current typography uses 20A.7 tiers, not raster glyph height. |
| Net-delta row | Near y=497–517 | R | Directly associated with its health number. |
| Main die visible box | About 134px square, near x=1099/y=538 | R | Review against existing Dice primitive; no compulsory 134px CSS assignment. |
| Helper dice visible boxes | About 50px square | R | Do not overwrite existing 60px helper sizing solely from a potentially scaled export. |
| Saved/bonus region | Beneath die, around y=695–771 | R | Content-driven rows accommodating Centaur/joining cases. |
| Lower action panel top | Near y=875 | R | Existing action-panel and viewport-height behaviour must govern final placement. |

Header arrangement follows the supplied design, but fixed x coordinates are inappropriate for long names and responsive widths. Use stable layout slots, sensible min/max constraints and existing full-name inspection behaviour where available. Specify actual overflow decisions in 20A.2.

### B.3 Provisional component-level starting values

Unimplemented entries remain proposals, not claimed pixel-perfect readings. The approved numeric targets below replace the earlier provisional 28px current/18px previous/28px economy starting values; all three categories use line-height 1. Health and delta use the full 20A.7 table.

| Element | Initial proposal | Class | Review |
| --- | --- | --- | --- |
| Desktop bar track | Vertical; inner width 24px, dark-grey padding 2px per side, outer width 28px; white fill, red/green transient layers | A geometry / P remaining treatment | 20B.3; use existing palette tokens. |
| Desktop legend text | 12 CSS px, regular weight, line-height 1, grey-50; fit labels by density | P | 20B.3 implemented; owner visual review pending. |
| Mobile legend text | 10 CSS px, regular weight, line-height 1, grey-50 | P | 20B.3 implemented; owner visual review pending. |
| Desktop current contribution | 20/24/28px at small/medium/large tiers, bold | A | 20A.7; retained matching implementation. |
| Desktop last contribution | 14/16/20px, opacity 0.66 | A | 20A.7; centred against health number, excluding delta. |
| Desktop economy | Saved/Bonus 20/24/28px; labels remain 11/12/12px | A | 20A.7; includes ordinary/joining/Centaur categories. |
| Desktop header text | Reuse current appropriate header components/sizes before making targeted changes | P | 20A.1/20A.2. |
| Fleet Value | Desktop purple `Fleet`, 18px from 1400px; mobile optional `Fleet Value` in inspection | A | Implemented 20A.4/20A.6; final owner visual acceptance pending. |
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
| Bar thickness | Owner-confirmed inner height 10px, dark-grey padding 2px per side, outer height 14px | A; replaces provisional active-bar thickness; 20B.1 documentation only |
| Live compact pair | 14px upper track + 10px shared legend + 14px lower track = 38px, without internal gaps | A; 20B.6 implemented, owner visual acceptance pending |
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

Exact bar heights, narrow-desktop rail widths, header stacking and additional phone/tablet rules remain open. 20B.2 establishes independent desktop/mobile positive-space protection at 35%, with compression only below that natural positive share; it does not add a protected pixel span. Each remaining affected pass must receive the relevant owner requirements before implementation.

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
