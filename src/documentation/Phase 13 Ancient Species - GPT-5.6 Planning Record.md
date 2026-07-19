# Phase 13 Ancient Species

## GPT-5.6 Planning Record

> **Status: Corrected planning record — awaiting designer approval. Ancient is not yet a playable production species.**

This document is a planning artifact. It records the corrected Ancient rules model, the intended architecture, and a slice-by-slice implementation sequence. It does not authorize implementation, enable Ancient in species selection, or claim that the rules are production-ready.

Balance values remain subject to playtesting. Rules and architecture recorded as locked below should not be reopened during implementation unless the designer explicitly changes them.

---

## 1. Status and authority

### 1.1 Pass status

- Pass type: Documentation / Planning Pass.
- Current result: corrected and aligned first implementation plan.
- Approval state: awaiting designer approval.
- Production state: Ancient remains unavailable as a playable production species.
- Implementation posture: proceed only in separately approved, narrowly scoped slices after this record is approved.
- Runtime validation: deferred to implementation slices and user gameplay testing.

### 1.2 Source precedence

Where earlier material conflicts, use this order:

1. Designer decisions in the Phase 13 correction and alignment brief.
2. The current Ancient 1.5 rules PDF and supplied rules image, except where explicitly corrected here.
3. PRE-PLAN amendments.
4. Older pre-plan material as historical context only.
5. The previous version of this planning record for structure only.
6. Current repository architecture for ownership and integration boundaries.

The locked decisions in this record supersede the former A-01 through A-12 open-rule register and the contradictory assumptions that accompanied it.

---

## 2. Purpose

Phase 13 introduces Ancient as a fully server-authoritative species whose three-colour Energy economy drives ordered Solar Power declarations during the existing Battle Charge Declaration phase.

The implementation must:

- preserve the existing phase machine and global charge gating;
- keep provisional drafting private and client-local until final Ready;
- validate and commit charge choices, Solar Grid choices, Solar casts, targets, variable spend, Cube repeats, and autocast as one authoritative declaration;
- expose accepted public state through normal server projections;
- integrate delayed effects, copied ships, ship limits, build flow, battle history, and existing automatic-effect semantics without inventing parallel systems;
- keep networking in the client runtime and presentation in display components;
- avoid regressions for every existing species, spectator posture, desktop layout, and mobile layout;
- leave Ancient disabled until the final enablement slice.

---

## 3. AI-assisted development workflow

This phase is intentionally decomposed into reviewable passes.

The human game designer owns product intent, rule changes, balance decisions, pass approval, code review, and browser/gameplay testing. GPT-5.6 supports rules analysis, dependency planning, risk identification, and preparation of scoped implementation briefs. Codex inspects the repository, proposes the concrete file plan, implements only an approved slice, and reports evidence-backed validation. None of those supporting roles replaces designer approval.

For every implementation slice:

1. Re-read:
   - `src/documentation/contracts/canonical-handoff.md`
   - `src/documentation/contracts/code-ownership-map.md`
   - `src/documentation/Guidelines.md`
   - `src/documentation/workflows/CodexPassTemplate.md`
   - this planning record
2. Inspect the owning code seam before proposing edits.
3. State the pass type, file allowlist, protected seams, assumptions, and validation.
4. Present a concrete file plan before editing.
5. Keep server authority, client orchestration, and display ownership separate.
6. Validate the smallest relevant surface and report exactly what was and was not run.
7. Do not silently combine roadmap slices or widen a pass into mixed scope.

The roadmap is an ordering and dependency guide, not pre-approval for all files named or implied by a slice.

---

## 4. Current repository baseline

The repository already contains partial Ancient-shaped data, presentation, and legacy type scaffolding, but not a coherent playable implementation.

Relevant current seams include:

- canonical server ship definitions and a mirrored client definition copy;
- existing Ancient catalogue and graphics components;
- the global `battle.charge_declaration` and `battle.charge_response` phase flow;
- authoritative available-action projection in the server route layer;
- requester-only action projection and public-state filtering;
- batched declaration submission infrastructure;
- end-of-turn pending damage/heal aggregation;
- ordinary Automatic effect handling;
- Drawing build resolution, working-fleet quantity checks, and build idempotency;
- hidden Drawing projection and Saved Lines persistence;
- charge-declaration fleet snapshots;
- server-only battle-log scratch plus persisted battle history.

These are integration points, not evidence that Ancient rules already work. In particular:

- current Energy-shaped fields and Solar types are incomplete and may be stale;
- a batched action API does not by itself prove that a rejected Ancient declaration cannot partially mutate state;
- turn-scoped scratch may clear too early for the required Solar ledger;
- existing definition text does not yet represent the corrected rules;
- existing Ancient graphics and identifiers include the old Neptune Core identity;
- the current catalogue and fleet layout are scaffolding to inspect, not architecture to replace wholesale.

No data migration is assumed at planning time. A migration should be added only if normalization and current persisted-state compatibility prove insufficient during the relevant state slice.

---

## 5. Corrected locked rules model

Everything in this section is a game-rule decision, not an open implementation question.

### 5.1 Energy ownership and lifecycle

- Energy is unique to an Ancient player.
- The only Energy colours are green, red, and blue.
- Energy is used only to cast Solar Powers.
- Energy cannot be saved across Battle Phases.
- An Ancient player may manually declare multiple Solar Powers in one turn if the declaration can pay for them in sequence.
- The server is authoritative for Energy generation, reset, source attribution, affordability, payment, targets, ordering, autocast, Cube repeats, effects, and outcomes.

At the beginning of Battle, during authoritative Battle Reveal preparation:

1. Clear the previous Battle's Energy.
2. Inspect the Ancient player's current qualifying sources.
3. Generate green Energy from Pluto Cores, red Energy from Mercury Cores, and blue Energy from Neptune Cores.
4. Generate Quantum Mystic Energy for every Mystic whose selected number matches the current dice roll.
5. Include qualifying ships built in the current turn.
6. Record deterministic source attribution sufficient for display and debugging.

Solar Grid Energy is not part of this initial generation. It is provisionally added by the local Charge Declaration draft and becomes authoritative only when final Ready is accepted.

At the next Battle Reveal, unspent Energy is cleared before the new Battle's sources are counted.

### 5.2 Non-Ancient controllers

A player whose species is not Ancient:

- has no usable Ancient Energy pool;
- cannot cast Solar Powers;
- gains no usable Energy from a controlled Pluto, Mercury, Neptune, Quantum Mystic, or charged Solar Grid;
- is not offered Solar Grid Use/Hold for Energy;
- receives the Quantum Mystic's heal when its selected number matches, while the generated blue Energy is discarded;
- receives depleted Solar Grid healing through the ordinary Automatic effect;
- receives no Cube behavior.

Core protection and all other ordinary ship rules continue to apply to a controlled Ancient ship unless a specific locked rule above says otherwise.

### 5.3 Global Charge Declaration gating

Ancient must preserve the existing global server gating and auto-ready behavior.

- Do not force an Ancient stop merely because the player is Ancient.
- Zero usable Energy, no charged Solar Grid, and no eligible foreign charge action means no input is required.
- A depleted Solar Grid does not create an action stop.
- Cube by itself does not create an action stop.
- Usable Energy does require input because every single-colour Solar Power can be manually declared.
- A charged Solar Grid or any eligible non-Ancient charge source requires normal declaration input.
- Autocast runs only when the player submits final Ready. It must not run from an entry shortcut or auto-ready path.

### 5.4 Charge Response posture

`battle.charge_response` remains the shared response phase.

- Solar Power and Solar Grid declarations do not themselves create a response selection.
- Solar declarations do not add a new response type.
- Existing charge effects retain their existing response rules.
- Removing or redesigning Charge Response in the future is a separate Mixed Pass and is not part of Phase 13.

### 5.5 One phase, two local workflow stages

Ancient uses two client-local stages inside the single server phase `battle.charge_declaration`.

#### Stage 1 — charge actions

- Show all eligible charge-based ships together, including Solar Grid and foreign or controlled charge sources such as Intelligence, Antlion, Wisdom, Familiar, and future eligible sources.
- Each charged Solar Grid receives an explicit Use or Hold choice.
- The local button reads `READY — Proceed to Powers`.
- Proceeding does not submit to the server, spend charges, reveal intent, mark the player ready, or advance a server subphase.
- The player can return to this stage and revise choices before final Ready.

#### Stage 2 — Solar Powers

- Start from the authoritative initial Energy plus locally selected Solar Grid Energy, less locally drafted Solar spending.
- Allow ordered manual declarations of all legal Solar Powers.
- Support required targets, Simulacrum target-cost inspection, Siphon variable spend, order revision, remaining-Energy inspection, and the Autocast toggle.
- If the player has usable Energy but no charge choices, open directly into this stage.
- Avoid rendering an empty stage when the player has neither Solar actions nor charge choices.

Both stages are private draft UI. They are not new server phases.

### 5.6 One atomic final Ready declaration

Final Ready submits one conceptual declaration containing:

- all ordinary charge choices;
- explicit Use/Hold for every relevant Solar Grid instance;
- the ordered manual Solar Power list;
- targets and locked variable spends;
- the explicit Autocast boolean.

Exact DTO and field names are implementation decisions. Semantically, the server must validate and apply the accepted declaration in this order:

1. Validate the phase, actor, declaration shape, ordinary charge choices, and Solar Grid choices.
2. Require a per-instance Hold or Use for every relevant Solar Grid.
3. Spend accepted charges.
4. Stage ordinary charge effects through existing authoritative machinery.
5. Add accepted Solar Grid Energy.
6. Validate manual Solar casts sequentially against the remaining pool and current legal context.
7. Spend each accepted cost.
8. Apply every Cube to the first eligible repeatable manual cast, or mark the repeats for the first eligible autocast when no manual candidate exists.
9. Validate Simulacrum primary and Cube-created queued copies, including aggregate ownership limits.
10. If enabled, run fixed autocast against the remaining pool and apply any deferred Cube repeats to its first eligible cast.
11. Produce one deterministic ordered Solar ledger.
12. Create pending effects and durable pending records.
13. Mark the player ready.

If any part is invalid, none of the declaration may persist: no charge spend, Energy change, copied ship, target destruction, staged effect, ledger entry, or readiness change.

Implementation must not rely on an early mutation followed by a later validation failure. Validation against a cloned/working state or an equivalent transactional boundary is required.

### 5.7 Visibility and reveal

Before final Ready:

- charge choices, Solar Grid choices, cast order, provisional Energy, targets, and Autocast settings remain client-local;
- opponents and spectators receive none of that draft state;
- no new server-side private Solar commit/reveal store is introduced.

After accepted Ready and normal declaration reveal:

- committed charge choices follow existing public visibility;
- Solar casts and their ordered ledger are public;
- Energy is public through the approved DTO/projection;
- targets and outcomes are public where their normal timing makes them relevant.

The client runtime may own the local draft and reconciliation logic. Display components render and edit that draft through callbacks; they do not communicate with the server directly.

### 5.8 Public Solar ledger

The Solar ledger describes the accepted declarations for the current or most recent Battle.

- It is deterministic and ordered.
- It distinguishes manual, autocast, and Cube source modes.
- It records stable identifiers, paid cost, locked dynamic amount, target references, Simulacrum presentation data, and data needed by breakdown/history.
- Each cast normally renders as an individual icon; Convert may be aggregated if that is clearer.
- It persists through Charge Declaration, Charge Response, First Strike, later Battle resolution, and the following Build Phase.
- It clears or is replaced only at the next Battle Reveal.
- It must not live solely in disposable turn scratch that clears when the turn number advances.
- Its row-three presentation must support existing FLIP and `FitToBox` behavior without making animation state authoritative.

Current Energy is for the current Battle only. The ledger has the longer display lifetime described above.

### 5.9 Basic ships

#### Pluto Core (`PLU`)

- Cost: 3 lines.
- Generate 1 green Energy at each Battle Reveal preparation.
- A Pluto Core built this turn participates.
- It cannot be destroyed or stolen.

#### Mercury Core (`MER`)

- Cost: 4 lines.
- Generate 1 red Energy at each Battle Reveal preparation.
- A Mercury Core built this turn participates.
- It cannot be destroyed or stolen.

#### Neptune Core (`NEP`)

- Cost: 7 lines.
- Generate 1 blue Energy at each Battle Reveal preparation.
- A Neptune Core built this turn participates.
- It cannot be destroyed or stolen.
- Maximum owned quantity: 6.
- `NEP` and Neptune replace the old `URA` and Uranus identity. That rename is a dedicated non-functional migration slice before rules work.

#### Quantum Mystic (`QUA`)

- Cost: 5 lines.
- When built or created, choose a number from 1 through 6.
- The selected number is permanent instance configuration and must be visible with the same number-caption/stacking posture used by equivalent selected-number ships.
- At Battle Reveal preparation, if the dice roll matches, generate 2 blue Energy and stage heal 5 for end-of-turn resolution.
- The match applies on the turn the Mystic is built.
- If the Mystic is destroyed after preparation, its generated Energy remains but its ordinary Automatic heal is omitted under normal survival semantics.
- A non-Ancient controller receives the heal but discards the Energy.
- Maximum owned quantity: 6.
- A Simulacrum copy preserves the selected number.

#### Spiral (`SPI`)

- Cost: 6 lines at all times.
- Maximum owned quantity: 3.
- Each Spiral heals 1 for each effective owned Spiral at ordinary end-of-turn Automatic timing:
  - one Spiral: total heal 1;
  - two Spirals: total heal 4;
  - three Spirals: total heal 9.
- Each effective owned Spiral increases maximum health by 5.
- Gaining maximum health does not heal.
- Losing an effective Spiral lowers maximum health immediately and clamps current health to the new maximum.
- Once only, when the third Spiral is built or created during Drawing, its owner may destroy one legal basic enemy ship at First Strike.
- A Simulacrum-created third Spiral qualifies.
- A transfer or steal is not a build and does not retroactively create the once-only action.
- If the third Spiral is later targeted or destroyed, an already-created once-only action still occurs.
- Any forced creation path must respect the maximum of 3. Simulacrum cannot create a fourth.

#### Solar Grid (`SOL`)

- Cost: 8 lines.
- Starts with 4 charges.
- In Charge Declaration, each charged Grid must be set to:
  - Use: spend 1 charge and provisionally gain 1 green, 1 red, and 1 blue Energy for this Battle; or
  - Hold: spend nothing and gain nothing.
- Grid choice precedes Solar Power drafting locally and is committed only by final Ready.
- Beginning with the turn on which its final charge is used, a depleted Grid heals 2 at ordinary end-of-turn Automatic timing.
- A depleted Grid creates no Charge Declaration action.
- A non-Ancient controller cannot use a Grid for Energy but still receives its depleted Automatic heal.

#### Cube (`CUB`)

- Cost: 9 lines.
- Once per Cube per turn, repeat the first eligible repeatable Solar Power cast that turn.
- Every Cube repeats the same first eligible cast.
- Repeats cost no Energy and do not recursively trigger Cube.
- Repeatable powers: Life, Star Birth, Asteroid, Supernova, Convert, and Simulacrum.
- Excluded powers: Siphon, Vortex, and Black Hole.
- If the repeated power is Simulacrum, every Cube creates another copy of the same target.
- Cube itself is not a legal Simulacrum target.
- The first eligible manual cast determines the repeat when one exists.
- Otherwise the first eligible autocast determines the repeat.
- Cube has no separate selection interaction.
- Enabling or disabling Autocast never prevents Cube from repeating an earlier eligible manual cast.

### 5.10 Solar Powers

All Solar Powers are declared in Charge Declaration. Multiple powers may be declared manually in a server-validated order. Health changes are staged for end-of-turn resolution unless a rule below names another timing.

#### Life (`SLIF`)

- Cost: 1 green.
- Heal 1 at end of turn.
- Manual, autocast, and Cube-repeat eligible.

#### Star Birth (`SSTA`)

- Cost: 3 green.
- Heal current dice roll + 3 at end of turn.
- Lock the dice-derived amount when final Ready is accepted.
- Manual, autocast, and Cube-repeat eligible.

#### Asteroid (`SAST`)

- Cost: 1 red.
- Deal 1 damage at end of turn.
- Manual, autocast, and Cube-repeat eligible.

#### Supernova (`SSUP`)

- Cost: 3 red.
- Deal current dice roll + 3 damage at end of turn.
- Lock the dice-derived amount when final Ready is accepted.
- Manual, autocast, and Cube-repeat eligible.

#### Convert (`SCON`)

- Cost: 1 blue.
- Generate 1 ordinary Saved Line for the next Build Phase.
- Saved Lines use the existing persistent resource semantics.
- Manual, autocast, and Cube-repeat eligible.
- The public ledger may aggregate repeated Convert casts for readability.

#### Siphon (`SSIP`)

- Manual only; never autocast and never Cube-repeated.
- Spend equal green and red Energy, with a minimum of 2 of each.
- If the locked amount of each colour is `x`, both healing and damage are `x(x + 1) / 2`.
- Legal `x` values are 2 through `min(available green, available red)` at that point in the ordered draft.
- There is no separately authored upper bound.
- Lock `x`, healing, and damage when final Ready is accepted.
- Stage healing and damage for end-of-turn resolution.
- A scalable large-value selector may be refined in its own UI slice.

#### Vortex (`SVOR`)

- Cost: 2 green, 2 red, and 2 blue.
- Manual only; never autocast and never Cube-repeated.
- Deal 2 damage for each distinct ship type the player has under existing authoritative ship-type semantics.
- Lock the live-fleet distinct-type count when final Ready is accepted.
- Stage damage for end-of-turn resolution.

#### Black Hole (`SBLA`)

- Cost: 4 green, 4 red, and 4 blue.
- Manual only; never autocast and never Cube-repeated.
- Destroy up to two legal opponent basic ships:
  - if at least two legal targets exist, choose exactly two;
  - if one legal target exists, destroy one;
  - if none exist, destroy none.
- Protected Cores are never legal targets.
- The full Energy cost is paid and Core-count damage still applies even when fewer than two legal targets exist.
- Lock the relevant authoritative Core count when final Ready is accepted.
- Choose targets in the final Ready draft.
- Resolve destruction through a pre-end-of-turn authoritative seam that preserves:
  - already-declared charge effects;
  - once-only effects that already became eligible;
  - omission of ordinary Automatic damage/healing from ships that do not survive.
- Stage the Core-count damage for normal end-of-turn resolution.
- Black Hole remains available when the opponent has fewer than two legal targets.

#### Simulacrum (`SSIM`)

- Cost: `X` blue, where `X` is the target ship's canonical line cost.
- Manual only; never autocast.
- Legal targets are enemy basic ships only.
- Cube is not a legal target.
- Affordability is evaluated against remaining blue Energy at Simulacrum's position in the ordered declaration.
- The player may make only one primary Simulacrum cast and target selection per turn.
- Every Cube must repeat that same target.
- The entire primary-plus-Cube copy set is queued for the following Drawing.

When final Ready is accepted:

- capture an immutable authoritative snapshot of the target's copyable configuration;
- later movement, transfer, or destruction of the source does not cancel the queued copy;
- validate the complete queued set against ownership limits, including controlled ships, earlier pending copies, the primary copy, and every Cube copy;
- reject the declaration atomically if the complete set is illegal; do not create a partial copy set.

The copy snapshot includes only approved canonical configuration, including:

- ship definition identity;
- permanent selected-number configuration such as Frigate or Quantum Mystic;
- approved permanent charge configuration, with the created copy starting at the normal beginning-of-Battle charge value.

It must not copy:

- source instance ID, owner, or source creation turn;
- prior once-only eligibility or fired state;
- staged effects;
- used markers;
- destruction selections;
- transient combat state.

At the beginning of the following `build.drawing`, before ordinary draft resolution:

1. Materialize every queued copy with a fresh instance ID.
2. Assign the current Drawing turn as its creation turn.
3. Initialize fresh once-only eligibility and normal battle-start charges.
4. Place it into the owner's hidden Drawing fleet.
5. Let the owner upgrade it in the same Drawing through ordinary build rules.
6. Keep it hidden from opponents and spectators under normal Drawing projection.
7. Reveal it publicly at Battle Reveal.
8. Record it as a Simulacrum-produced build without double-counting history.

The copied ship follows normal built-this-turn behavior. A copied Quantum Mystic may match immediately, and a copied third Spiral may create its once-only First Strike action.

Quantity validation applies to every definition with a maximum, including Spiral, Quantum Mystic, Neptune Core, Orb, Vigor, and future capped ships. A player may legitimately cause Cube to repeat an earlier eligible power and then cast Simulacrum later; only a first eligible Simulacrum is repeated.

### 5.11 Autocast

Autocast is an explicit final-Ready convenience, not a separate rule authority and not a substitute for manual casting.

- Every single-colour Solar Power remains manually castable while Autocast is enabled.
- Final Ready carries an explicit Autocast boolean; the server never infers it from browser state.
- The client may remember or default the toggle locally.
- Autocast runs after manual casts, their Energy costs, and any Cube repeat they establish.
- If Autocast is off, remaining Energy expires at the next Battle Reveal.
- Autocast can cast only Star Birth, Supernova, Convert, Life, and Asteroid.
- It never casts Simulacrum, Siphon, Vortex, or Black Hole.

The fixed server-authored loop is:

1. Cast Star Birth while green Energy is at least 3.
2. Cast Supernova while red Energy is at least 3.
3. Cast Convert while blue Energy is at least 1.
4. Cast Life while green Energy is at least 1.
5. Cast Asteroid while red Energy is at least 1.

Examples:

- 10 red produces three Supernovas and one Asteroid.
- 8 green produces two Star Births and two Life casts.
- 4 blue produces four Converts.

This sequence is intentionally predictable. It is not an optimizer and does not choose targets or variable-cost powers.

Player-facing explanation:

> When you press Ready, Autocast spends remaining Energy on Star Birth, Supernova, Convert, Life, then Asteroid. It never casts Simulacrum, Siphon, Vortex, or Black Hole.

### 5.12 Resolution and survival timing

At accepted final Ready, the server may authoritatively:

- spend charges and Energy;
- stage ordinary charge effects;
- lock ordered casts, dice-derived amounts, Siphon spend, Vortex type count, and Black Hole Core count;
- apply Cube repetition;
- create the public ledger;
- persist Convert and pending Simulacrum records;
- destroy Black Hole targets through the approved pre-end-of-turn seam;
- stage Battle health effects.

At end-of-turn resolution:

- resolve staged Solar healing and damage through the existing aggregate pipeline;
- resolve depleted Solar Grid healing;
- resolve surviving ordinary Automatic effects;
- suppress an ordinary Automatic effect whose source did not survive to its normal resolution check;
- preserve already-declared charge effects and already-created once-only actions even if their source was later destroyed.

---

## 6. Architectural constraints

### 6.1 Server authority

The authoritative server owns:

- Ancient eligibility;
- three-colour Energy state and Battle reset;
- deterministic generation and source breakdown;
- global declaration gating and auto-ready;
- final declaration validation and transactional application;
- ordered affordability and payment;
- Solar Grid charge consumption;
- targets and locked dynamic values;
- autocast sequence;
- Cube selection and repeats;
- Black Hole destruction;
- Simulacrum snapshots, queueing, limits, idempotent materialization, and reveal timing;
- Spiral maximum-health and once-only rules;
- pending effects, breakdown, history, and public ledger.

Client projections may estimate affordability for interaction, but the server decides.

### 6.2 Client runtime

The client runtime owns:

- the private two-stage draft;
- local Solar Grid Use/Hold state;
- ordered provisional Solar casts;
- provisional Energy arithmetic;
- target and variable-spend selection state;
- local Back/revision behavior;
- explicit Autocast preference;
- final DTO construction and submission;
- rejection reconciliation and accepted-state replacement.

Networking and session orchestration stay out of display components.

### 6.3 Display

Display components may:

- render the draft, authoritative Energy, available actions, ledger, fleet, and catalogue;
- gather charge, target, ordering, spend, and toggle input;
- render row-one Energy sources, row-two basic ships, and row-three Solar ledger;
- animate committed changes from authoritative state;
- use existing responsive fitting and FLIP utilities.

They must not decide legality, infer hidden state, pay Energy, execute effects, materialize copies, or advance phases.

### 6.4 Existing systems first

Prefer narrow extensions of:

- global charge action gating;
- available-action computation and requester-only projection;
- charge spending and ordinary charge effect staging;
- pending end-of-turn damage/heal;
- Automatic survival semantics;
- Saved Lines;
- Drawing hidden-information projection;
- build quantity validation;
- instance creation and selected-number configuration;
- battle-log scratch/history;
- fleet layout, activation cues, FLIP, and `FitToBox`.

Do not introduce a second phase machine, direct display networking, duplicate build resolver, or Ancient-only public-state channel.

### 6.5 Determinism and normalization

All order-sensitive behavior needs stable ordering and replay-safe identifiers. Server normalization must safely read older persisted state that lacks new optional fields. Pending Simulacrum materialization and final declaration application need idempotency guards.

Do not add a storage migration by default. If persisted records cannot be normalized safely, the state slice must stop and propose a narrowly scoped migration before writing one.

### 6.6 Identity and definitions are separate

Implementation begins with two deliberately non-functional slices:

1. Rename the old Neptune Core identity everywhere from `URA`/Uranus to `NEP`/Neptune without changing rules or behavior.
2. Align canonical server definitions and mirrored client definitions with the approved rules without implementing gameplay.

The identity inventory includes definitions, graphics filenames/exports, catalogue, Fleet rendering, resolver references, development surfaces, and stale identifiers. Legacy-only files must be inspected and classified before any edit; their presence does not automatically authorize touching them.

### 6.7 Presentation direction

The final board direction is:

- row 1: Cores and Quantum Mystics;
- row 2: ordinary Ancient basic ships;
- row 3: committed Solar ledger;
- central resource presentation: current Energy, plus existing copied-line and joining-line concepts where applicable.

The rules image and mockups provide direction, not exact responsive measurements. Desktop and mobile details belong in their later display slices.

---

## 7. Implementation-specific decision register

The rules model is locked. The former rule questions A-01 through A-12 are obsolete.

Only these implementation choices remain:

| ID | Implementation decision | Required outcome |
| --- | --- | --- |
| I-01 | Final declaration DTO fields and versioning | One explicit, server-validated declaration with stable order and Autocast boolean |
| I-02 | Authoritative helper and file layout | Small ownership-aligned seams; no parallel engine |
| I-03 | Large Siphon selector interaction | Supports every legal value without making legality client-authoritative |
| I-04 | Battle-log wording and Convert aggregation | Deterministic, readable, and not double-counted |
| I-05 | Solar ledger and Energy animation details | Presentation-only and stable on desktop/mobile |
| I-06 | Final responsive board measurements | Preserve surrounding layouts and current fitting behavior |
| I-07 | Persisted-state migration necessity | Add only if normalization cannot safely read existing games |
| I-08 | Balance tuning after gameplay tests | Designer-owned; does not change architecture |

These are not unresolved game rules and do not block approval of the corrected planning model.

---

## 8. Proposed system decomposition

### 8.1 Definitions and identity

- Canonical Ancient definition identity remains server-owned.
- The client definition copy remains a presentation/preview mirror.
- Rename identity before editing rule data so stale identifiers are easier to audit.
- Keep rule-data alignment separate from effect execution.

### 8.2 Authoritative state concepts

The implementation is expected to need normalized concepts equivalent to:

- current three-colour Energy;
- deterministic Battle-start Energy source attribution;
- an immutable Battle-start or declaration context for locked values;
- an atomic accepted declaration record;
- ordered Solar ledger entries with manual/autocast/Cube source mode;
- durable pending Simulacrum copy records;
- per-instance permanent selected-number configuration;
- Spiral-derived maximum-health state or derivation;
- replay/idempotency markers for declaration and copy materialization.

Names and exact nesting are deferred to I-01 and I-02. Public fields must be deliberately projected; server-only scratch must remain stripped.

### 8.3 Phase integration

- Battle Reveal preparation resets and regenerates Energy.
- Existing `battle.charge_declaration` owns the one final submission.
- Existing `battle.charge_response` remains structurally unchanged.
- Black Hole uses an approved pre-end-of-turn destruction seam.
- End of Turn resolves staged health changes and ordinary surviving Automatic effects.
- Following `build.drawing` materializes pending Simulacrum copies before ordinary draft resolution.
- Next Battle Reveal reveals Drawing additions and replaces the previous ledger.

### 8.4 Projection and hidden information

- Available actions remain server-computed and requester-specific.
- Local Ancient drafts never enter public state before Ready.
- Accepted declarations use the established reveal posture.
- Simulacrum-created ships are visible to their owner during hidden Drawing and hidden from other viewers until the normal reveal.
- Battle-log scratch remains server-only.
- Public ledger and Energy DTOs must not leak unrelated hidden build information.

### 8.5 Effect and history integration

- Energy generation, Solar Grid contribution, spending, autocast, and Cube must share one ordered declaration calculation.
- Health effects should feed the existing pending-turn aggregation and breakdown.
- Convert should feed existing Saved Lines.
- Simulacrum should feed ordinary instance/build machinery with an explicit production source.
- Battle history should consume accepted canonical records, not reconstruct intent from UI or animations.
- The same event must not be recorded once at declaration and again at resolution unless the history schema intentionally distinguishes declaration from outcome.

---

## 9. Slice-by-slice implementation roadmap

Every slice requires a fresh inspect-and-plan gate. File lists below are ownership directions, not fixed allowlists.

| Slice | Pass type | Goal | Depends on | Minimum validation focus |
| --- | --- | --- | --- | --- |
| P1 | Documentation | Correct and approve this planning record | None | Diff, stale-assumption audit, scope audit |
| P2 | Mixed, non-functional identity migration | Rename `URA`/Uranus identity to `NEP`/Neptune across canonical, mirror, graphics, exports, resolvers, catalogue, Fleet, and dev references | P1 approval | Typecheck, build, server check, identifier audit |
| P3 | Mixed, definition data only | Align both Ancient definition copies with locked IDs, costs, limits, timings, and text; no effects | P2 | Definition parity and rule-text audit |
| P4 | Client/UI primitives | Align Neptune graphics/export and reusable Ancient icon/presentation primitives | P2–P3 | Typecheck, build, user visual check |
| P5 | Server state/DTO foundation | Add normalized Energy, source breakdown, declaration/ledger/pending-copy concepts, projections, and compatibility posture | P3 | Server checks, projection/privacy tests, normalization tests |
| P6 | Server | Reset and generate Core Energy at Battle Reveal with deterministic attribution | P5 | Same-turn builds, reset, non-Ancient discard |
| P7 | Server | Enforce Ancient Core protection consistently in relevant destroy/steal legality | P3 | Existing protected-target matrices |
| P8 | Server | Implement Quantum Mystic selection, match Energy, heal staging, limits, and controller semantics | P5–P6 | Dice 1–6, survival, same-turn, non-Ancient |
| P9 | Client/UI | Add Quantum Mystic build selection, captions, stacking, and projections | P8 | Desktop/mobile selection and reveal |
| P10 | Server | Implement Spiral heal totals, dynamic max health, immediate clamp, and quantity cap | P3, P5 | Gain/loss/transfer/destruction health matrix |
| P11 | Server | Implement third-Spiral Drawing eligibility and First Strike action through existing generic projections | P10 | Build/copy versus steal, source destruction, once-only |
| P12 | Server contract | Define and enforce the one atomic final Charge Declaration, including global gating and SOL choices | P5 | Rejection rollback, auto-ready, foreign charges |
| P13 | Client runtime/UI | Implement the two local stages, Back/revision, provisional Energy, and one final Ready submit | P12 | No early submit or draft leakage; responsive flow |
| P14 | Server | Implement ordered manual Solar declaration, payment, ledger, and pending effect foundation | P12 | Sequential affordability and deterministic order |
| P15 | Mixed | Implement five mono-colour powers, fixed authoritative Autocast, and the explicit client toggle | P14 | Priority examples, manual-plus-auto, toggle off |
| P16 | Client/UI | Align Ancient catalogue and rule explanations with implemented foundation | P3, P15 | Text parity, no client authority |
| P17 | Server | Implement Siphon variable spend and locked triangular effect values | P14 | Boundary values and ordered affordability |
| P18 | Client/UI | Implement adaptive Siphon spend selection and ledger presentation | P17 | Large ranges, revision, mobile fit |
| P19 | Server | Implement Vortex live distinct-type lock and damage staging | P14 | Type-count semantics and source changes |
| P20 | Server | Implement Black Hole legality, target-count rules, pre-end-of-turn destruction, and Core damage | P7, P14 | 0/1/2+ targets, protection, timing |
| P21 | Client/UI | Implement Black Hole target selection and outcome presentation | P20 | Exact target requirement and responsive UX |
| P22 | Server | Implement Simulacrum snapshots, aggregate limit validation, durable queue, hidden Drawing materialization, and idempotency | P14 | Limits, reload/retry, config freshness, reveal |
| P23 | Client/UI | Implement Simulacrum targeting, cost preview, pending-copy and Drawing presentation | P22 | Primary-only selection, privacy, same-Drawing upgrade |
| P24 | Server | Implement Cube repeat selection, multiplicity, limits, and all eligible effect copies | P15, P17–P22 | Manual-first, auto fallback, no recursion, all-or-none SSIM |
| P25 | Client/UI | Present automatic Cube repeats in draft/ledger without adding a Cube interaction | P24 | Multiple Cubes, manual/auto source clarity |
| P26 | Client/UI display | Implement Energy display and Ancient Fleet row layout with responsive fitting and FLIP | P5, committed ledger | Desktop/mobile, row stability, spectator |
| P27 | Mixed history/projection | Integrate Energy/Solar breakdown, public ledger persistence, and battle-log/history capture | P14–P24 | Phase lifetime, following Build, no double count |
| P28 | Client/UI animation | Add restrained Energy, cast, copy, and ledger transition cues from authoritative state | P26–P27 | Reconnect/remount determinism; reduced churn |
| P29 | Mixed hardening | Run regression, reload, concurrency, hidden-info, normalization, and full gameplay matrices | P6–P28 | Typecheck/build/server checks plus user runtime |
| P30 | Mixed, narrow enablement | Add Ancient to the intended species-selection surfaces only after approval | P29 and designer sign-off | Selection paths, bot/spectator safeguards, smoke test |

Slices may be split further when inspection reveals multiple owners. They must not be collapsed into a broad Ancient mega-pass.

---

## 10. Regression and migration risk register

| Risk | Why it matters | Required mitigation |
| --- | --- | --- |
| Global declaration gating regresses | Ancient logic could stop every Ancient player or bypass foreign charge actions | Extend existing server gating; test zero-input, Energy, SOL, and foreign-charge cases |
| Charge Response changes accidentally | Solar declarations could alter shared response behavior | Keep response rules unchanged and add regression coverage |
| Invalid final submission partially applies | Early charge/Energy mutation could survive a later invalid cast | Validate/apply transactionally against a working state |
| Provisional Energy drifts from server truth | Local SOL or cast edits can show false affordability | Recompute locally from one draft; replace with accepted server state; show rejection cleanly |
| Stale old Neptune identifiers remain | Identity mismatch can break definitions, graphics, resolvers, or persisted state | Dedicated P2 inventory and identifier audit before rules |
| Energy remains a scalar or loses colour/source detail | Payment and UI attribution become ambiguous | Normalize a three-colour source-aware structure |
| Ledger clears at turn increment | Required following-Build display disappears | Store ledger with Battle lifetime, not only disposable turn data |
| Pending copies duplicate after reload/retry | Simulacrum can create extra permanent ships | Durable record plus deterministic IDs/idempotency marker |
| Simulacrum ignores aggregate limits | Multiple Cubes can exceed caps | Validate the complete queued set against fleet and earlier pending copies |
| Cube repeats bypass limits | Mandatory repeats could create a partial illegal copy set | Reject the whole declaration when the full repeat set is illegal |
| Simulacrum clones transient state | Copies could inherit damage-time markers, ownership, or spent once-only state | Explicit allowlisted snapshot and fresh instance initialization |
| Non-Ancient controllers gain Solar access | Stolen Ancient ships could create unintended species mechanics | Gate Energy and Solar use by controller species while retaining specified ordinary effects |
| Black Hole disappears with fewer than two targets | Rules require full-cost use even with one or zero legal targets | Availability and resolver tests for 0/1/2+ targets |
| Destroyed ships still fire ordinary Automatic effects | Black Hole timing could violate survival semantics | Use the approved destruction seam and existing survival checks |
| Destroyed charge source loses a declared effect | A committed charge must survive later source destruction | Persist accepted charge effect independently of source survival |
| Spiral max-health loss fails to clamp | Player health can exceed new maximum | Central derived-max update with immediate authoritative clamp |
| Hidden Drawing information leaks | Pending Simulacrum copies reveal strategy | Reuse requester-aware Drawing projection |
| Existing species regress | Shared phase, build, effects, and projection seams are touched | Run cross-species declaration/build/battle matrix |
| Desktop and mobile diverge | Two-stage draft and three fleet rows are layout-sensitive | Dedicated responsive slices and user visual testing |
| History records effects twice | Declaration and resolution integrations may duplicate one event | Define canonical record ownership and test counts |
| Existing scaffolding is mistaken for finished architecture | Stale types can pull work into the wrong layer | Inspect ownership and reuse only verified seams |
| An unnecessary migration is introduced | Broad stored-state writes increase risk | Prefer normalization; require evidence before a migration pass |

---

## 11. Validation strategy

### 11.1 Documentation-pass validation

For this pass:

- inspect the final diff;
- confirm only this planning document changed;
- search for obsolete rule assumptions and stale old identity outside explicit migration context;
- verify the 30 roadmap slices, decision register, risk register, and validation matrix are present;
- run `git diff --check`;
- do not run browser or gameplay tests.

### 11.2 Static validation for implementation slices

Run as relevant:

- `npm run typecheck`;
- `npm run build`;
- `deno check src/supabase/functions/server/index.tsx`;
- `deno task check`;
- `git diff --check`;
- targeted identifier, ownership, public-projection, and no-touch searches.

Report routine existing warnings separately from actual failures. A production build does not replace browser or gameplay verification.

### 11.3 Authoritative phase and atomicity matrix

Verify:

- Ancient with no Energy, no charged Grid, and no foreign charge is auto-readied through existing gating.
- Ancient with usable Energy receives Charge Declaration input even if no Grid is charged.
- Charged Grid creates input; depleted Grid does not.
- Cube alone does not create input.
- A foreign or controlled eligible charge source still creates normal input.
- A non-Ancient controller receives no Energy-only stop.
- Moving from charge actions to powers sends no request and changes no authoritative state.
- Back/revision changes only the local draft.
- Final Ready contains all required per-instance Grid choices.
- Any invalid ordinary charge, Grid choice, Solar order, target, spend, Cube result, or Simulacrum limit leaves authoritative state unchanged.
- Accepted Ready spends charges/Energy once, stages effects once, creates one ledger, and marks readiness once.
- Retry/reconnect cannot double-apply.
- Solar and Grid declarations do not create a new Charge Response selection.
- Existing response-bearing charge actions still behave normally.

### 11.4 Energy and Autocast matrix

Verify:

- Battle Reveal clears previous Energy before generation.
- Pluto, Mercury, Neptune, and matching Quantum Mystic produce the correct colours.
- Ships built this turn generate.
- Source attribution is deterministic.
- Held Grid spends no charge and adds no Energy.
- Used Grid spends one charge and adds exactly one of each colour.
- Final-charge use begins depleted healing that same turn.
- Manual casts remain available while Autocast is enabled.
- Autocast begins only after all manual costs and Cube selection.
- 10 red becomes Supernova ×3 plus Asteroid ×1.
- 8 green becomes Star Birth ×2 plus Life ×2.
- 4 blue becomes Convert ×4.
- Autocast never selects Siphon, Vortex, Black Hole, or Simulacrum.
- Toggle off leaves remaining Energy unspent until normal reset.
- Non-Ancient controllers discard generated Energy and cannot cast.

### 11.5 Basic-ship matrix

Quantum Mystic:

- each selection 1–6;
- same-turn match and non-match;
- multiple Mystics;
- maximum 6;
- copy preserves number;
- destroyed after preparation keeps Energy but loses ordinary heal;
- non-Ancient controller gets heal only.

Spiral:

- one/two/three totals are 1/4/9;
- max health changes by 5 per effective Spiral;
- gain does not heal;
- loss immediately clamps;
- third built in Drawing creates the First Strike action once;
- copied third qualifies;
- transfer/steal does not qualify;
- later destruction does not erase an already-created action;
- maximum 3 across ordinary and copied creation.

Solar Grid:

- independent Hold/Use across multiple instances;
- accurate provisional and accepted Energy;
- charged versus depleted gating;
- same-turn final-charge heal;
- survival semantics for ordinary heal;
- non-Ancient Energy suppression with depleted heal retained.

### 11.6 Solar Power matrix

Ordered mono-colour powers:

- sequential affordability;
- repeated manual casts;
- locked dice values;
- end-of-turn aggregation and breakdown;
- Convert Saved Lines visible in following Build.

Siphon:

- minimum `x = 2`;
- all values through current `min(green, red)`;
- correct `x(x + 1) / 2` healing and damage;
- locked value unaffected by later state changes;
- no Autocast or Cube repeat.

Vortex:

- zero, one, and multiple distinct live ship types;
- type aliases/transform semantics follow existing canonical counting;
- locked count does not drift after Ready;
- no Autocast or Cube repeat.

Black Hole:

- zero legal targets remains castable and pays full cost;
- one legal target requires one selection;
- two or more require exactly two selections;
- protected Cores excluded;
- locked Core-count damage is correct;
- declared charge effects survive destroyed sources;
- ordinary Automatic effects from destroyed ships are omitted;
- already-created once-only actions survive;
- no Autocast or Cube repeat.

### 11.7 Simulacrum and Cube matrix

Simulacrum:

- cost equals canonical target line cost;
- only enemy basic ships are targetable;
- Cube cannot be targeted;
- one primary selection per turn;
- immutable snapshot survives target destruction, transfer, and reconnect;
- Frigate and Quantum Mystic selections copy;
- transient/source identity/used state does not copy;
- fresh instance ID, creation turn, once-only state, and charges;
- materializes before Drawing draft and may upgrade in that Drawing;
- owner sees it during hidden Drawing; others do not;
- reveals at Battle Reveal;
- same-turn Mystic and third-Spiral rules apply;
- reload/retry cannot duplicate;
- aggregate quantity limits include fleet, controlled ships, pending copies, primary copy, and all Cube copies.

Cube:

- zero, one, and multiple Cubes;
- all Cubes repeat the same first eligible cast;
- first eligible manual cast wins;
- first eligible Autocast cast is used only when no manual eligible cast exists;
- no Energy is spent for repeats;
- no recursion;
- excluded powers are skipped;
- manual repeat still occurs with Autocast off;
- repeated Simulacrum is all-or-none under quantity limits;
- an earlier eligible repeat and later Simulacrum can coexist.

### 11.8 Ledger, history, privacy, and UI matrix

Verify:

- draft intent is visible only to its owner;
- accepted ledger order and source modes are stable;
- Energy and ledger projections expose no hidden Drawing data;
- ledger persists through Charge Declaration, Charge Response, First Strike, later Battle, and following Build;
- ledger clears/replaces at next Battle Reveal;
- Convert aggregation, if used, preserves exact counts;
- breakdown totals equal applied health/resource effects;
- battle history records accepted declarations and outcomes once;
- Simulacrum production is attributed once;
- reconnect/remount reconstructs from authoritative committed state;
- row-one/row-two/row-three layout fits desktop and mobile;
- FLIP and fitting changes do not alter game state;
- spectator views receive only approved public state.

### 11.9 Cross-species regression matrix

At minimum, exercise:

- Ancient versus Ancient;
- Ancient versus each production species family;
- non-Ancient ownership/control of each Ancient basic ship category;
- ordinary charged ships alongside Solar Grid;
- existing charge declaration auto-ready and response flows without Ancient present;
- hidden Drawing and upgrade flow without Simulacrum;
- desktop, mobile, reconnect, spectator, rematch, and game-history surfaces;
- bots or automated seats, which must not select Ancient until a dedicated supported policy exists or the enablement slice explicitly handles them.

---

## 12. Obsolete assumptions removed

The corrected plan no longer relies on:

- an extra server Solar subphase;
- server-stored private Solar drafts before final Ready;
- one forced Ancient declaration stop for every Ancient turn;
- an implicit browser-derived Autocast setting;
- a restricted manual-cast model for the single-colour powers;
- a separate Cube selection action;
- discounted Spiral construction;
- copy-by-cloning of live Simulacrum targets;
- partial Simulacrum creation when Cube repeats exceed a limit;
- disposable turn-only storage for the Solar ledger;
- Solar declarations changing Charge Response;
- non-Ancient controllers gaining an Ancient Energy economy.

Any implementation proposal that reintroduces one of these assumptions conflicts with this record.

---

## 13. Submission-stage status

This planning pass changes documentation only.

It does not:

- change server rules;
- change client runtime behavior;
- change display or graphics;
- modify canonical or mirrored definitions;
- rename the existing Neptune Core identity;
- add tests;
- change tooling;
- enable Ancient in species selection.

Implementation should proceed slice by slice only after designer approval of this corrected record.

---

## 14. Next decision gate

The next gate is designer approval of this corrected planning record.

After approval, the first implementation pass is:

> **P2 — dedicated non-functional `URA`/Uranus to `NEP`/Neptune identity migration.**

That pass must inventory every live identity reference, propose an exact allowlist, preserve behavior, and validate both server and client builds. It must not implement Energy, Solar Powers, or balance changes.

The following pass, P3, aligns the canonical server definitions and mirrored client definitions with the locked rules as a separate data-only change.

No gameplay implementation should begin before those identity and definition foundations are reviewed in order.
