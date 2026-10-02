# Phase 18 Addendum — Charge Declaration Estimate Updates

**Status:** Server pass implemented; client migration remains follow-up  
**Scope:** Server-authoritative live estimate updates during `battle.charge_declaration` for every species  
**Relationship to Phase 18:** This addendum overrides only Phase 18's rule that both estimates remain frozen and exclude all Charge Declaration choices. The original Phase 18 planning document remains a historical record.

## 1. Objective

During Charge Declaration, update the local selecting player's own damage and healing estimates from their current private declaration choices.

The opponent and spectators must not receive those private projections. They continue to receive the public phase-entry baseline, with a `?` appended when that player had an ordinary Charge action or Solar input available at the start of Charge Declaration.

This is a broad Charge Declaration estimate feature, not an Ancient- or SSIP-specific repair.

## 2. Settled User-Facing Behaviour

| Viewer and state | Own estimate | Other player's estimate |
| --- | --- | --- |
| Player selecting during Charge Declaration | Live requester-private projection from the current local declaration draft | Public phase-entry baseline; display `13 ?` when the other player has Charge or Solar input available |
| Player Ready and waiting | Freeze and recover the accepted requester-private projection | Keep the same public baseline and `?`; do not reveal whether the opponent has selected, held, or submitted |
| Spectator | Public phase-entry baseline and `?` when applicable | Public phase-entry baseline and `?` when applicable |
| Turn Resolution / held resolved presentation | Authoritative actual value and rows | Authoritative actual value and rows |

Additional presentation rules:

- `?` is appended to the displayed public baseline as a separate uncertainty marker: `13 ?`.
- The marker means hidden Charge Declaration choices may change the value. It is not arithmetic and does not promise that the final value is greater than 13.
- Determine the marker from authoritative phase-entry eligibility, not current selection, submission, readiness, charge depletion, ledger state, or response timing.
- Keep the marker stable for the entire Charge Declaration privacy barrier, including after either player submits.
- If a player had neither an eligible ordinary Charge action nor usable Ancient Solar input at phase entry, their public baseline remains an ordinary exact estimate without `?`.
- Never expose an Ancient opponent's `withAutocast`, manual-Solar, remaining-energy, or accepted-declaration projection. Their opponent-facing value is always the ordinary public baseline plus `?` when applicable.
- Preserve the existing local wording **AUTOCAST ESTIMATE** exactly.
- Preserve the existing estimate approximation treatment, desktop/mobile layout, breakdown behaviour, dice-settle hold, resolved-stat hold, Final Turn presentation, and health/delta presentation.
- Charge and Solar Battle Log rows remain hidden until the existing visibility barrier opens. This addendum changes estimates only.

## 3. Calculation Contract

### 3.1 One normalized local declaration draft

Create one normalized requester-local Charge Declaration draft used by both preview and authoritative submission.

For every species it contains:

- the selected ordinary Charge actions;
- authoritative action and source IDs;
- selected choice IDs;
- required target IDs in canonical order; and
- hold represented consistently with submission, normally by omitting the action.

For Ancients it additionally contains:

- ordered manual Solar casts, including any completed target or locked-amount data; and
- the effective Autocast preference.

The same defaults, hold treatment, target allocation, validation inputs, and ordering must feed preview and Ready. Do not maintain a second preview-only interpretation of the UI state.

### 3.2 Authoritative simulation order

On a disposable server-side state derived from the validated Charge Declaration phase-entry snapshot:

1. Apply the local player's selected ordinary Charge actions through the canonical power resolver.
2. For Ancients, apply every completed manual Solar cast in declared order through the full production Solar resolver registry.
3. If Autocast is enabled, build and resolve mono-colour Autocasts from the energy remaining after all manual casts.
4. Calculate the complete damage and healing projection and breakdown rows from the resulting simulated state.

Return totals and rows as one matched projection. Do not combine a total from one state with rows from another.

Do not calculate ANT, INT, WIS, FAM, SSIP, SSTA, SLIF, or any other power with client-side arithmetic. FAM's dynamic amount, EQU's paired targets, copied/foreign ships, Solar targets, structural consequences, secondary automatic effects, and future powers must remain governed by canonical server rules.

Where a selected declaration changes fleets or enables secondary automatic output, the estimate must use the same authoritative effect ordering as resolution. No per-power estimate exception should be introduced merely to make one example work.

### 3.3 Required Ancient examples

- With four green energy, manual SSTA and Autocast enabled, the local estimate contains the ordinary baseline, manual SSTA, and the SLIF produced from the remaining energy.
- With ten red and fourteen green energy, manual SSIP for ten red and ten green leaves four green; the local estimate contains the ordinary baseline, SSIP, then Autocast SSTA and SLIF.
- With Autocast disabled, only the ordinary baseline, ordinary Charge actions, and manual Solar casts contribute.
- Manual SSIP, SVOR, SBLA, and SSIM must use the same complete production declaration path as authoritative submission when their required selections are complete. Incomplete targeted selections produce pending/unavailable preview state, never a fabricated zero or fallback projection.

## 4. Privacy and Noninterference Contract

The local draft and resulting live projection are requester-private.

- A preview request must not write game state, increment state revision, update the head, consume charges/energy, append history, publish events, change readiness, or advance the phase.
- Preview on a disposable clone containing the public phase-entry state plus only the requester's supplied declaration draft.
- Never allow canonical live mutations from the opponent's hidden declaration to contaminate the requester's preview.
- Public projections retain the phase-entry baseline and carry only a stable uncertainty flag.
- Responses visible to an opponent or spectator must remain identical across the hidden player's different choices, manual Solar casts, Autocast preference, hold choices, submission status, and submission timing.
- Do not remove `?` when a hidden player presses Ready. The marker ends only when the Charge Declaration privacy barrier exits and authoritative resolution replaces estimates.
- Error, pending, availability, identity, and timing-dependent response shapes must not disclose hidden choices.

The local projection remains an estimate rather than a guaranteed final outcome because hidden opponent actions may affect resolution. Existing concise uncertainty copy about opponent actions remains valid.

## 5. Implemented Server Contract

The server pass implements the following additive contract:

- `POST /charge-declaration-preview/:gameId` accepts the preferred `{ observed, declaration, requestToken? }` envelope for every player species. `declaration` is contract version 1 and contains `declarationId`, ordered `ordinaryChargeActions`, ordered `solarCasts`, and explicit `autocastEnabled`.
- The canonical declaration fingerprint is normalized JSON containing `contractVersion`, ordered ordinary actions, ordered Solar casts, and `autocastEnabled`; it deliberately excludes `declarationId`.
- Responses preserve Base `damage`/`healing`, `draftKey`, `withAutocast`, `solarSelectionKey`, and `withSolarSelection`, and add `identity.declarationFingerprint` plus `withChargeDeclaration` with matched totals, rows, Autocast setting, and fingerprint.
- Legacy `{ observed, solarSelection, requestToken? }` requests remain accepted and use the same full production Solar registry with an empty ordinary-action list.
- Public frozen Charge Declaration estimates add `chargeDeclarationUncertain`, derived only from snapped eligible ordinary sources or snapped usable Ancient energy.

The estimator creates an independent deep clone of the phase-entry template for each meaningfully distinct variant. Base collects canonical automatic effects once. `withAutocast` applies only phase-entry Autocast, `withSolarSelection` applies only the supplied or accepted manual Solar selection and its effective Autocast setting, and `withChargeDeclaration` applies the complete retained-plus-draft ordinary and Solar declaration. Each variant then collects automatic effects exactly once.

The resolver dependency audit classified the required inputs as follows:

- Existing Charge Declaration fleet and eligibility snapshots supply fleets, charges, configurations, copied sources, FAM type counts, targeting legality, and ordinary source eligibility.
- Stable public turn data supplies finalized dice facts, Cube selection, build/reveal counters, Dreadnought component memory, removed-build facts, Reveal preparation, and turn-phase progress.
- Each disposable declaration locally produces spent resources, accepted EQU reservations, altered fleets and lines, pending damage/healing, Solar ledger entries, and Ancient pending records.
- The existing visibility snapshot was extended only with phase-entry player `lines`/`joiningLines`, `pendingTurn`, relevant once-only/Frigate/Quantum Mystic memory, and pending Simulacrum/Black Hole records. In particular, public First Strike output in `pendingTurn` is reconstructed once and is never replaced by live post-entry output.

Ordinary Charge acceptance is cumulative and private. Exact accepted source/action pairs are idempotent, conflicts reject the whole request, and new sources append in authoritative request order. Preview retained-source conflicts return HTTP 409 `declaration_conflict`. Ready finalizes the whole normalized declaration, including an explicit empty declaration for all-hold/no-action recovery; every conflicting or additional preview after finalization returns HTTP 409 `already_submitted`, while exact transport retries remain eventless. Ancient atomic acceptance writes the same generic finalized record and temporarily retains the existing Ancient accepted-record mirror. All records use the existing Charge Declaration lifecycle and are redacted from client-visible turn data.

Full GET reconstructs requester projections for every species from the finalized declaration or cumulative retained actions. Preview starts at phase entry, replays retained actions exactly once, deduplicates identical draft sources, and rejects conflicts. Malformed or illegal input is unavailable, turn/phase or source-context drift is obsolete, and no failure path substitutes Base, unrelated Autocast, or fabricated zero.

The following earlier limitations are retained here as historical context for the client follow-up:

- `useGameSession.ts` already owns ordinary ship-choice state, target allocations, Ancient ordered manual casts, the Autocast preference, and frozen Ancient submission attempts.
- `ancientChargeDeclaration.ts` already builds the complete Ancient authoritative payload, while `intents.ts` separately constructs ordinary non-Ancient action batches at Ready.
- `currentTurnPreview.ts` already supplies debounce, one in-flight request, newest-candidate coalescing, caching, stale-response rejection, and one bounded source-context retry for Drawing and the narrow Solar preview.
- The scheduler currently clears its debounce timer before checking whether a re-applied candidate has the same semantic identity. Equivalent renders can therefore postpone or cancel the original request deadline; this must be corrected while generalizing the candidate.
- `thisTurnPresentation.ts` can select requester-only Autocast/Solar variants, but has not yet migrated to the generic local Charge draft projection or public Charge uncertainty marker.

## 6. Implementation Plan

### 6.1 Shared client declaration construction

Relevant files:

- `src/game/client/gameSession/ancient/ancientChargeDeclaration.ts`
- `src/game/client/gameSession/intents.ts`
- `src/game/client/useGameSession.ts`
- a neutral Charge Declaration helper module if extraction keeps the existing files focused

Changes:

- Extract or share the ordinary Charge action builder currently duplicated between Ancient atomic submission and the generic Ready flow.
- Produce a stable normalized local draft for all player species from renderable actions, choice selections, and allocated targets.
- Preserve current defaults and Ready semantics exactly. A selection omitted from local state must resolve identically in preview and submission.
- For Ancients, combine the ordinary draft with the existing ordered manual Solar casts and effective Autocast preference.
- While an Ancient submission is unresolved, use the frozen submitted attempt rather than mutable current UI state.
- Memoize the normalized draft so equivalent polling renders preserve reference and semantic identity.

### 6.2 Canonical server-side declaration simulation

Relevant files:

- `src/supabase/functions/server/engine/intent/chargeDeclarationResolution.ts`
- `src/supabase/functions/server/engine/state/currentTurnEstimator.ts`
- `src/supabase/functions/server/engine/state/chargeDeclarationVisibility.ts`

Changes:

- Extract a canonical disposable simulation core from authoritative Charge Declaration resolution, or otherwise share the same normalization and resolver sequence without duplicating rules.
- Support ordinary-only drafts for non-Ancient players and combined ordinary/Solar drafts for Ancient players.
- Use the full production manual Solar resolver registry for manual casts. Autocast remains the existing mono-colour priority applied only to remaining energy.
- Begin from the validated declaration-entry legality/visibility snapshot and overlay only the requester's draft.
- Preserve public frozen-baseline calculation as a separate mode for opponents and spectators.
- Include the normalized declaration fingerprint in estimate identity and source-context validation.
- Treat malformed, incomplete, stale, illegal, or context-mismatched drafts as unavailable/obsolete. Never substitute Base, plain Autocast, or zero.
- Preserve complete zero-valued projections and their rows as valid calculated results.

### 6.3 Preview route and requester projection

Relevant files:

- `src/supabase/functions/server/routes/current_turn_projection_routes.ts`
- server DTO/type definitions used by the route
- `src/supabase/functions/server/engine/intent/IntentReducer.ts`
- `src/supabase/functions/server/engine/state/GameStateTypes.ts`

Changes:

- Generalize `/charge-declaration-preview/:gameId` from Ancient `solarSelection` to the normalized local Charge Declaration draft.
- Allow any active player with Charge Declaration input to request their own preview.
- Retain existing authentication, player-role, turn/phase, body-size, source-context, request-token, bounds, and no-write guarantees.
- Return one requester-only complete Charge projection with paired totals and rows.
- Retain a normalized accepted ordinary declaration, or an equivalently durable requester-private accepted projection, when a non-Ancient action batch is accepted. An all-hold declaration must also have a recoverable empty accepted result.
- Prefer retaining the normalized accepted draft so the full GET can recalculate through the same estimator after Ready, refresh, reconnect, or uncertain transport recovery.
- Redact accepted ordinary declarations and all private projections from opponents and spectators, just as Ancient accepted declarations are protected.
- Extend the full GET requester projection to every player species during Charge Declaration. Before Ready it may supply the public baseline/context; after acceptance it supplies the accepted requester-private projection.
- Keep all `withAutocast` and manual-Solar variants requester-only.

The existing non-Ancient `ACTIONS_SUBMIT` then `DECLARE_READY` gameplay flow may remain. This addendum does not require converting every species to the Ancient atomic intent, provided accepted draft recovery is complete and retries remain safe.

### 6.4 Stable public uncertainty metadata

Relevant files:

- `src/supabase/functions/server/engine/intent/chargeDeclarationEligibility.ts`
- `src/supabase/functions/server/routes/current_turn_projection_routes.ts`
- client DTO/types and `thisTurnPresentation.ts`

Changes:

- Add a public projection field such as `chargeDeclarationUncertain: boolean` for each player's frozen Charge Declaration estimate.
- Derive it only from phase-entry public eligibility:
  - at least one eligible ordinary Charge source; or
  - for an Ancient, authoritative phase-entry Solar input sufficient to make a declaration choice.
- Do not derive it from accepted declarations, live depleted charges/energy, readiness, Solar ledger entries, or pending effects.
- Preserve the same value for all viewers throughout the privacy barrier.
- Do not attach private variants or hidden rows to the public projection.

### 6.5 Preview scheduler and session wiring

Relevant files:

- `src/game/client/gameSession/currentTurnPreview.ts`
- `src/game/client/useGameSession.ts`

Changes:

- Replace Solar-only candidate identity with a stable normalized Charge Declaration draft fingerprint.
- Compute semantic identity before clearing the current debounce timer.
- Reapplying an equivalent non-forced candidate must retain its original timer, generation, request token, queued state, and in-flight request.
- Changed candidates still invalidate the old generation, coalesce behind one in-flight request, reject stale responses, and receive at most one bounded source-context retry.
- Pause or switch cleanly across Drawing, Charge Declaration, accepted submission, phase change, game change, and disposal.
- Preserve all current Drawing-preview scheduler behaviour and tests.

### 6.6 Presentation selection

Relevant files:

- `src/game/client/gameSession/thisTurnPresentation.ts`
- desktop/mobile stats components and styles only where needed to render the appended `?`

Changes:

- During Charge Declaration, select the matching live requester projection for the local player's own metrics regardless of species.
- When a local candidate is pending, unavailable, or stale, do not fall through to the public Base or unrelated Autocast projection. Preserve the last valid matching local projection where allowed, otherwise show the existing pending/unavailable treatment.
- After acceptance, select the requester projection reconstructed from the accepted draft through subsequent polling and reloads.
- For the opponent, select only the public frozen baseline and append `?` when `chargeDeclarationUncertain` is true.
- For spectators, apply the same public-baseline rule independently to both players.
- Do not render opponent `AUTOCAST ESTIMATE`, manual-Solar rows, energy details, or charge-choice rows.
- Select each projection's totals and rows as one unit, including calculated zero totals.
- Preserve **AUTOCAST ESTIMATE**, all current labels, and existing resolved handoff behaviour.

### 6.7 Documentation

- Keep the original Phase 18 plan unchanged as historical documentation.
- Add this file to the Phase 18 planning set and treat it as the normative override for Charge Declaration estimates.
- Update any current technical comments or DTO documentation that still claims both estimates always freeze or that all Charge/Solar output is excluded.

## 7. Required Tests

### Server estimator and route

- Three ANT ships: each damage/heal/hold change updates only the requester's projection and preserves correct rows.
- INT and WIS damage/heal/hold parity.
- FAM uses the canonical declaration-entry distinct-type count.
- Multiple ordinary Charge sources, copied/foreign charge ships, default choices, holds, and stable ordering.
- EQU target allocation and any resulting structural/automatic-output change use canonical resolution.
- Ancient ordinary Charge actions and Solar casts combine in one projection.
- Four green: manual SSTA plus remaining-energy Autocast SLIF.
- Ten red/fourteen green: manual SSIP plus remaining-energy Autocast SSTA and SLIF.
- Autocast OFF excludes leftover-energy casts.
- Complete SSIP, SVOR, SBLA, and SSIM selections use production resolvers; incomplete targets are unavailable rather than Base/zero fallbacks.
- Complete zero-valued projections preserve totals and rows.
- Accepted ordinary and Ancient projections survive full GET polling and simulated reload.
- Preview performs zero persistence writes and does not change revision, head, readiness, charges, energy, history, events, or phase.
- Stale source context, phase change, duplicate/retried requests, malformed payloads, and bounds failures remain safe.

### Privacy

- Opponent and spectator public responses are identical across hidden damage/heal/hold choices.
- They are also identical across manual Solar choices, Autocast ON/OFF, accepted submissions, and submission timing.
- `chargeDeclarationUncertain` is stable from phase entry until barrier exit.
- Ancient opponent DTOs never contain `withAutocast`, manual-Solar, accepted-declaration, remaining-energy, or private breakdown data.
- A player with no phase-entry Charge or Solar input has no `?`; readiness changes do not alter that result.

### Client scheduler and presentation

- Equivalent pre-debounce reapplication fires at the original deadline.
- Equivalent in-flight reapplication preserves generation and request token.
- Changed drafts coalesce correctly and stale responses cannot replace the newest result.
- Ordinary and Ancient local selections use the matching requester projection.
- Pending/unavailable/stale local previews do not fall back to Base or an unrelated Autocast variant.
- Accepted requester projections remain through polling and reload.
- Opponent displays `13 ?` when flagged and plain `13` when not flagged.
- Spectators receive the correct independent marker for both sides.
- Opponent Ancient estimates never select `AUTOCAST ESTIMATE`.
- Existing Drawing scheduler, dice-settle hold, resolved-stat hold, Final Turn, and mobile/desktop regressions remain unchanged.

## 8. Validation

- Run focused client scheduler and presentation tests.
- Run focused server estimator, route, Charge Declaration resolution, and visibility tests.
- Run the broader existing Drawing and Charge Declaration regression suites.
- Run `npm run typecheck`.
- Run `npm run build`.
- Do not change balance, ship definitions, power wording, animation timing, Battle Log reveal timing, styling beyond the appended uncertainty marker, or tooling.
- Do not start Vite, Playwright, or browser/manual testing unless separately requested. Final implementation reporting should state: **Not run — browser/Vite testing handled by user.**

## 9. Completion Criteria

This addendum is complete when:

- every species receives a live requester-private Charge Declaration estimate from the exact draft that Ready would submit;
- Ancient estimates apply ordinary actions, all completed manual Solar casts, and Autocast from leftover energy in authoritative order;
- the feature contains no SSIP- or species-specific arithmetic workaround;
- accepted local estimates survive polling, refresh, and reconnect;
- opponents and spectators see only the public phase-entry baseline with stable `?` uncertainty where applicable;
- Ancient opponents never expose an Autocast estimate;
- resolution replaces projections with existing authoritative actuals; and
- all Phase 18 privacy, dice-settle, Drawing, Battle Log, and resolved-presentation regressions remain protected.

## 10. Open Questions

None. The logic required for implementation is settled by this addendum.
