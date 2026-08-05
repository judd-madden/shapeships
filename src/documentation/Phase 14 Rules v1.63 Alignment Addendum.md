# Phase 14 — Rules v1.63 Alignment and 14H/14I Cutover Addendum

- **Status:** Normative Phase 14 addendum
- **Pass type:** Documentation / Planning
- **Rules baseline:** Shapeships rules v1.63
- **Extends:** `Phase 14 Simplified Phases and Ship Tags.md`
- **Implementation checkpoint:** Phase 14I-S and Phase 14I-C complete; Phase 14J is next
- **Compatibility posture:** No persisted-game migration; old in-progress games may be discarded at cutover
- **Date:** 2026-08-05

---

## 1. Purpose and authority

This addendum aligns the Phase 14 roadmap with the approved v1.63 rules and the implementation checkpoint reached after Phase 14H.

It does not replace the full Phase 14 planning document. All clauses in that document remain normative except where this addendum explicitly supersedes them.

When sources conflict, use this order:

1. Explicit designer decisions recorded in this addendum.
2. Shapeships rules v1.63.
3. The existing Phase 14 normative planning document where not superseded here.
4. Verified live repository architecture and executable behavior for implementation facts.
5. Older rules, planning text, comments and historical code only as evidence of the former implementation.

The example-game pages in the current rules PDF are unfinished and are not an implementation source for 14H-R or 14I.

---

## 2. Current implementation checkpoint

Phase 14H-R is complete.

Phase 14I-S and Phase 14I-C are complete. The combined Phase 14I cutover is complete and the server and client cutovers must deploy together. The next implementation pass is Phase 14J. Broader Rules and player-facing reconciliation remains deferred to Phase 14K or later design passes.

The following Phase 14 passes are complete:

- 14A — Normative Planning Record
- 14BC — Definition Metadata and Mirror Parity
- 14D — Remove Charge Response
- 14E0 — Conflict-Safe Authoritative Persistence
- 14E — Drawing-Prelude Foundations
- 14F — Single-Pass Drawing Prelude
- 14G — Chronoswarm and Copied-Builder Behavior
- 14H — Bot and Battle Log Integration
- 14H-R — Rules v1.63 Bot and Battle Log Revision
- 14I-S — Authoritative Server Phase Cutover
- 14I-C — Functional Client Cutover

The authoritative server and functional client now use the flattened phase topology and requester-local Drawing prelude. They remain one atomic deployment unit.

The next execution order is:

1. 14J onward as already planned

---

## 3. Final player-facing turn structure

The player-facing turn has one flattened sequence:

1. Dice Roll
2. Line Generation
3. Drawing
4. Reveal
5. First Strike
6. Charges / Solar Powers
7. Turn Resolution

There are no player-facing Build/Battle major phases and no major/minor phase terminology.

The internal `build.*` and `battle.*` namespaces remain technical identifiers. Renaming those namespaces, intent names such as `BUILD_SUBMIT`, or broad internal field families is outside Phase 14 unless a specific cutover edit requires a narrow local rename.

The final authoritative internal phase sequence is:

```text
setup.species_selection

build.dice_roll
build.line_generation
build.drawing

battle.reveal
battle.first_strike
battle.charge_declaration
battle.end_of_turn_resolution
```

The final sequence excludes:

- `build.ships_that_build`
- `build.end_of_build`
- `battle.charge_response`

KNO and Cube remain internal Dice Roll stages. Drawing-prelude pass state remains an internal per-player Drawing stage, not a global phase.

---

## 4. Tag and timing interpretation

The existing Phase 14 separation between tags and activation timing remains correct.

`MAKES SHIPS` is a per-power classification. A power’s listed phase and timing metadata determine when it occurs.

The v1.63 Turn Phases wording refers specifically to **Drawing powers** tagged with `MAKES SHIPS`. It does not state that every `MAKES SHIPS` power occurs at Drawing entry.

Therefore:

- Drawing powers tagged `MAKES SHIPS` occur at the start of Drawing unless their own wording specifies a distinct Drawing trigger.
- Dreadnought remains a `MAKES SHIPS` power but occurs during Reveal.
- Simulacrum remains a `MAKES SHIPS` Solar Power whose accepted copy materialises at the start of the next turn.
- Zenith retains separate when-built, recurring Drawing and upon-destruction timings.
- No mechanic may infer timing from the tag alone.

---

## 5. Foreign-ship acquisition invariants

Foreign-ship ownership is species-restricted and must be treated as a real rules invariant, not as a theoretical all-species combination space.

### 5.1 Species that cannot gain foreign ships

Human and Xenite cannot gain foreign ships.

Consequences:

- A Xenite player can never own or control Carrier.
- A Human player can never own or control Chronoswarm.
- Native Human and native Xenite fleets do not require generic foreign-builder branches.

### 5.2 Species that can gain foreign ships

Only Centaur and Ancient can gain foreign ships.

- Centaur may gain foreign ships through its existing permanent-control mechanics.
- Ancient may gain foreign Basic Ships through Simulacrum and may later use those copied Basics in otherwise legal foreign upgrades.

All existing legality, quantity, charge, component and upgrade rules continue to apply.

### 5.3 Two-player matchup constraint

A normal match has one opposing species. A Centaur or Ancient player can therefore gain ships only from that one opposing species during that match.

This makes some theoretical cross-species combinations impossible.

In particular:

- Chronoswarm and Carrier cannot coexist under one controller in a legal normal match.
- Chronoswarm and Dreadnought cannot coexist under one controller in a legal normal match.
- A Xenite player can never gain Carrier.
- A Human player can never gain Chronoswarm.

Code and tests must not create complexity around impossible Chronoswarm/Carrier or Chronoswarm/Dreadnought interactions.

This is not permission to weaken ordinary server legality. It is a rule-space constraint that should guide source eligibility, tests and pass scope.

---

## 6. Revised Chronoswarm contract

Chronoswarm causes the controller’s eligible `MAKES SHIPS` powers to occur twice, subject to each power’s own timing and the legal matchup constraints above.

### 6.1 Drawing-prelude repetition

Within the Drawing prelude, Chronoswarm repeats the eligible recurring Xenite builder powers:

- Bug Breeder
- Queen
- Zenith’s recurring Drawing power

Carrier does not require Chronoswarm pass-two support because Chronoswarm and Carrier cannot legally coexist under one controller.

A second Drawing-prelude pass may therefore contain automatic work only. It must complete without projecting a Carrier choice or requiring an `ACTIONS_SUBMIT` batch.

### 6.2 Simulacrum repetition

An Ancient player facing Xenite may copy eligible Xenite Basics, build into Chronoswarm, and retain Simulacrum as an Ancient Solar Power.

In that rare legal state, Simulacrum may occur twice because it is tagged `MAKES SHIPS`.

This repetition belongs to Simulacrum’s existing turn-start materialisation timing. It is not moved into the Drawing prelude.

The authoritative implementation must preserve:

- the accepted Simulacrum declaration and queued-copy model;
- target and quantity legality;
- charge-state copying rules;
- Cube-created additional Simulacrum declarations;
- deterministic materialisation and history capture;
- no Queen copy target, because Queen is Upgraded.

Any repeated materialisation remains subject to the same authoritative fleet and quantity limits as ordinary Simulacrum materialisation.

### 6.3 Other timing exclusions

Chronoswarm does not relocate powers into Drawing.

- Dreadnought remains a single Reveal power. The Chronoswarm/Dreadnought combination is not legally reachable in a normal match.
- Zenith’s when-built Antlion remains a when-built Drawing consequence.
- Zenith’s upon-destruction Xenites remain an on-destruction consequence.
- Evolver remains a normal Drawing targeting power and is not repeated.

---

## 7. Reveal absorbs former End-of-Build work

The former `build.end_of_build` phase is removed in 14I.

Its two special mechanics move to the beginning of `battle.reveal`:

- Ark of Redemption sets its controller’s health to maximum.
- Dreadnought makes Fighters.

These remain distinct rules with their existing semantics:

- Ark of Redemption is a direct health set, not healing.
- Dreadnought retains its current ship-made counting rules and exclusions.
- Dreadnought does not count itself.
- Fighters made by Dreadnought do not recursively increase that same Dreadnought occurrence.
- Dreadnought remains outside the Drawing prelude.
- Dreadnought does not repeat under Chronoswarm in any legal normal matchup.

### 7.1 Reveal-entry ordering

To preserve the previous outcome order, Reveal entry must perform:

1. Ark of Redemption and Dreadnought resolution;
2. their once-per-turn idempotency marking, cues and private Battle Log capture;
3. existing Reveal preparation, including Ancient Energy generation and public Reveal state;
4. the normal Reveal presentation/hold boundary;
5. progression to First Strike.

The former resolver should be renamed to a Reveal-oriented concept. Recommended shape:

```text
resolveBuildEndOfBuild
→ resolveRevealSpecialPowers
```

The former turn marker should also become Reveal-specific, for example:

```text
buildEndOfBuildAppliedTurnNumber
→ revealSpecialPowersAppliedTurnNumber
```

Exact names may follow nearby conventions, but no active name should continue to claim that the removed End-of-Build phase exists.

---

## 8. Definition metadata amendment

Phase 14BC remains valid except for Dreadnought’s activation timing.

At the 14I cutover, update both canonical server definitions and the client mirror:

```text
DRE#0 activationTiming:
'end_of_build' → 'reveal'
```

Add `reveal` to the closed activation-timing contract and remove `end_of_build` if no remaining power uses it.

Update the exact server/client raw-coordinate parity fixture and tests in the same atomic cutover.

Ark of Redemption is custom resolver timing rather than a new tag-membership change. Its displayed timing and mirrored rules text must say Reveal, but it does not gain `MAKES SHIPS`.

---

## 9. Phase 14H-R — Rules v1.63 Bot and Battle Log Revision

- **Pass type:** Server Pass
- **Goal:** Align the completed 14H bot/history integration with the final Chronoswarm reachability rules and Reveal production ordering before 14I activates the new flow.
- **Why now:** 14H was completed against the earlier End-of-Build and pass-two Carrier assumptions.
- **Dependencies:** Completed 14F–14H and this addendum.
- **Deployability:** Review separately; active behavior releases with 14I.

### 9.1 Required bot alignment

The bot continues to use the shared authoritative requester/action projection.

For each Drawing-prelude pass:

- submit one `ACTIONS_SUBMIT` batch only when the server actually projects unresolved interactive actions;
- never invent a pass-two Carrier choice;
- allow an automatic-only Chronoswarm pass 2 to complete without a bot action;
- re-read fresh authoritative state after each accepted mutation;
- call `planBotBuildSubmit` only after the bot’s prelude is complete;
- retain the existing step cap unless evidence proves a change is required.

Remove or rewrite tests whose only purpose is to prove Carrier can act in both Chronoswarm passes.

Add coverage proving an automatic-only pass 2 settles without GET polling and without an empty action submission.

### 9.2 Private produced-build occurrence metadata

Replace the obsolete occurrence stage:

```ts
type ProducedBuildOccurrence =
  | { stage: 'drawing_prelude'; passIndex: 1 | 2 }
  | { stage: 'drawing' }
  | { stage: 'end_of_build' };
```

with:

```ts
type ProducedBuildOccurrence =
  | { stage: 'turn_start_materialisation' }
  | { stage: 'drawing_prelude'; passIndex: 1 | 2 }
  | { stage: 'drawing' }
  | { stage: 'reveal' };
```

`turn_start_materialisation` should be used where existing Simulacrum capture needs an explicit stable occurrence bucket. Do not add it redundantly if the existing capture already has an equivalent earlier durable key; use one canonical private representation.

### 9.3 Mandatory Build-row ordering

The private formatter must be able to reproduce this relative order:

1. turn-start materialisation, including Simulacrum;
2. public Dice Roll interventions;
3. Drawing-prelude pass 1;
4. Drawing-prelude pass 2;
5. revealed normal Drawing builds;
6. Drawing when-built/produced ships;
7. Reveal production, currently Dreadnought.

Visible row wording and public history shape remain unchanged.

Dreadnought production remains a Build row, for example:

```text
3 x FIG (DRE)
```

Hold produces no row.

Simulacrum repetition under Chronoswarm may aggregate identical visible rows according to the existing aggregation contract, but private occurrence data must remain deterministic and retry-safe.

### 9.4 14H-R validation

Required focused tests:

- no pass-two Carrier action expectation;
- automatic-only Chronoswarm pass 2 completes without bot input;
- bot does not submit an empty `ACTIONS_SUBMIT` batch;
- no early `BUILD_SUBMIT`;
- worst-case supported bot chain remains below the cap;
- `end_of_build` occurrence metadata is absent;
- Dreadnought capture orders in the Reveal bucket;
- Simulacrum turn-start ordering remains deterministic;
- repeated/ retried capture does not duplicate rows;
- private occurrence metadata does not leak through live game state.

No client/UI changes belong in 14H-R.

---

## 10. Phase 14I — Drawing and Reveal Cutover amendment

The existing 14I brief is superseded by this section where they differ.

**Implementation status:** 14I-S — Authoritative Server Phase Cutover and 14I-C — Functional Client Cutover are complete. The atomic-release requirement remains in force.

- **Pass type:** Mixed Pass
- **Goal:** Remove both obsolete Build phases, activate the complete per-player Drawing prelude, move Dreadnought and Redemption to Reveal, and reconcile every active phase surface.
- **Dependencies:** 14BC, 14E0, 14E–14H and 14H-R.
- **Deployability:** One atomic cutover.

### 10.1 Server cutover

14I must:

- remove `build.ships_that_build` from the canonical sequence;
- remove `build.end_of_build` from the canonical sequence;
- activate Drawing-prelude initialisation on entry to `build.drawing`;
- delete the old global Ships That Build resolver, pass loop, readiness, events and state after reusable pieces are extracted;
- preserve independent player prelude completion and requester-only `BUILD_SUBMIT` gating;
- retain hidden Drawing fleet projection and conflict-safe persistence;
- migrate Dreadnought and Ark of Redemption into Reveal entry;
- update Dreadnought activation timing to `reveal` in both definition copies;
- remove obsolete End-of-Build state and tests;
- remove the old bot Ships That Build branch;
- retain no compatibility aliases for either removed phase.

### 10.2 Chronoswarm cutover

14I must use the revised contract in Section 6:

- automatic Drawing-prelude repetition for BUG, QUE and recurring ZEN;
- no Carrier pass-two action path;
- Simulacrum repetition at turn-start materialisation when the legal Ancient/Chronoswarm state exists;
- no relocation of Simulacrum into Drawing;
- no special Chronoswarm/Dreadnought or Chronoswarm/Carrier implementation branch for impossible normal-match combinations.

### 10.3 Client/runtime cutover

The client runtime must:

- route directly from Line Generation into Drawing;
- use requester Drawing-prelude stage/pass data;
- open Carrier actions only when the server projects meaningful Carrier choices;
- submit explicit Hold choices when projected;
- never submit prelude `DECLARE_READY`;
- prevent local build submission until the requester prelude is complete;
- route to the normal catalogue immediately after completion;
- remove old Ships That Build and End-of-Build phase branches;
- keep networking centralized in the client runtime;
- reuse one desktop/mobile gameplay view-model path.

Pass identity should remain stage-aware. Pass 2 may exist as an automatic server stage without ever producing a second Carrier panel instance.

### 10.4 Active presentation cutover

At deployment, every active timeline and phase label must show the flattened v1.63 sequence:

- Dice Roll
- Line Generation
- Drawing
- Reveal
- First Strike
- Charges / Solar Powers
- Turn Resolution

Remove active player-facing references to:

- Build Phase as a major phase;
- Battle Phase as a major phase;
- Ships That Build;
- End of Build;
- Charge Response;
- major/minor phase terminology.

14I should make the mandatory surgical rules corrections required for truthful deployed behavior. The broader page-by-page editorial comparison remains 14K.

### 10.5 14I validation additions

In addition to the original 14I matrix, validate:

- neither removed Build phase exists in `PHASE_SEQUENCE`;
- Dreadnought and Ark of Redemption apply exactly once during Reveal;
- Reveal special powers occur before normal Reveal preparation;
- DRE raw metadata is `reveal` in both definition copies;
- no `end_of_build` activation or occurrence value remains active;
- no Carrier action is projected for Chronoswarm pass 2;
- legal Ancient + Chronoswarm + Simulacrum materialisation repeats correctly;
- Human and Xenite cannot gain foreign ships;
- Centaur and Ancient foreign-ship paths retain existing legality;
- impossible CHR/CAR and CHR/DRE combinations are not manufactured by tests or fixtures;
- bot, player and spectator flows remain hidden-information safe;
- desktop and mobile show the same flattened phase truth.

---

## 11. Later pass alignment

### 11.1 Phase 14J

Tag display integration remains independent after the cutover. It must preserve the per-power tag/timing separation in Section 4.

### 11.2 Phase 14K

14K remains the full online Rules reconciliation against the final approved rules PDF.

14K must distinguish:

- outdated online copy;
- deliberate online interaction wording;
- actual canonical rules/data discrepancies.

Unfinished example-game pages are excluded until separately approved.

### 11.3 Phase 14L and 14M

The correct tail order is:

- 14L — Normative Documentation Reconciliation
- 14M — Read-Only Closure Audit

Any older dependency diagram or text that labels 14K as documentation reconciliation or 14L as closure audit is superseded.

---

## 12. Completion criteria added by this addendum

Phase 14 is not complete unless all of the following are true:

### Phase structure

- Player-facing rules and UI use the seven flattened phases.
- The server has no active Ships That Build, End-of-Build or Charge Response phase.
- Internal Build/Battle namespaces remain technical only.

### Species acquisition

- Human and Xenite cannot gain foreign ships.
- Only Centaur and Ancient retain their existing legal foreign-ship paths.
- Tests and helpers respect the one-opponent-species constraint.

### Chronoswarm

- BUG, QUE and recurring ZEN repeat in the Drawing prelude.
- Carrier does not receive pass-two support.
- Simulacrum can repeat at turn-start materialisation in the rare legal Ancient + Chronoswarm state.
- No impossible Chronoswarm/Carrier or Chronoswarm/Dreadnought branch is implemented.

### Reveal

- Dreadnought and Ark of Redemption resolve at Reveal entry.
- DRE metadata says `reveal`.
- Dreadnought history remains visible as a Build row ordered in the Reveal-production bucket.

### Architecture

- Server authority, requester privacy, conditional persistence and bot internal-intent execution remain intact.
- No rule timing is inferred from presentation tags alone.
- No private occurrence metadata leaks through live DTOs.

---

## 13. Current status

Phase 14H-R and the combined Phase 14I server/client cutover are complete. The next implementation pass is Phase 14J. The Phase 14I server and client cutovers must deploy together.
