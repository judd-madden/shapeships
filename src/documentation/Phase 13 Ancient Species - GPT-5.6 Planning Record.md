# Phase 13 Ancient Species

## GPT-5.6 Planning Record

> **Historical planning record:** This document preserves the approved Phase 13 planning baseline and the assumptions used to design and sequence the Ancient implementation. Ancient implementation is now complete for the approved Phase 13 scope and is ready for real-player testing and balance refinement. Some rules, access assumptions, and implementation details in the body were superseded through later separately approved passes. See [the current repository status](../VERSION.md) for current implementation status. Current canonical definitions and authoritative server behavior govern current gameplay where later approved changes differ from this record.

> **Status: Normative Phase 13 planning document. Ancient is not yet a playable production species.**

This document is the approved Phase 13 planning baseline. It records the Ancient rules model, intended architecture, and slice-by-slice implementation sequence. Normative planning status does not mean Ancient is implemented or production-enabled, and it does not authorize an unscoped implementation pass.

Balance values remain subject to gameplay testing. Implementation proceeds only through separately approved, narrowly scoped slices. Rules and architecture recorded as locked below remain normative unless the designer explicitly supersedes them; they must not be silently reinterpreted during implementation.

---

## 1. Status and authority

### 1.1 Pass status

- Pass type: Documentation / Planning Pass.
- Current result: approved normative Phase 13 roadmap.
- Approval state: planning baseline approved; each implementation slice still requires separate approval.
- Production state: Ancient remains unavailable as a playable production species.
- Development state: human-only local/development selection is planned for P5A once the normalized state foundation is safe; this document does not enable it by itself.
- Implementation posture: proceed only through separately approved, narrowly scoped slices.
- Runtime validation: deferred to implementation slices and user gameplay testing.

### 1.2 Source precedence

Where earlier material conflicts, use this order:

1. Designer decisions in the Phase 13 development-access/graphics-test refinement, final refinement, and correction/alignment briefs, with the most recent explicit decision taking precedence.
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
- make Ancient available to human players in the normal local/development selection flow through P5A once its normalized state can initialize, hydrate, and project safely, so later slices can be tested through real game flow;
- keep Ancient unavailable in public production selection until P30 hardening, explicit designer approval, and narrow public enablement.

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
- existing Ancient identifiers include the old Uranus Core identity;
- the current catalogue and fleet layout are scaffolding to inspect, not architecture to replace wholesale.

No data migration is assumed at planning time. A migration should be added only if normalization and current persisted-state compatibility prove insufficient during the relevant state slice.

---

## 5. Approved locked rules model

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

- Show all eligible charge-based ships together, including `SOL` and controlled foreign charge sources such as `INT` (Interceptor), `ANT` (Antlion), `WIS` (Ship of Wisdom), `FAM` (Ship of Family), and future eligible sources. This list is illustrative, not exhaustive.
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
9. Validate every Simulacrum primary and Cube-created queued copy, including distinct-target restrictions and aggregate ownership limits across the full declaration and any earlier accepted copies this turn.
10. If enabled, run fixed autocast against the remaining pool and apply any deferred Cube repeats to its first eligible cast.
11. Produce one deterministic ordered Solar ledger.
12. Create pending effects and durable pending records, including committed Black Hole target-destruction records that do not yet mutate either fleet.
13. Mark the player ready.

If any part is invalid, none of the declaration may persist: no charge spend, Energy change, copied ship, target destruction, staged effect, ledger entry, or readiness change.

Implementation must not rely on an early mutation followed by a later validation failure. Validation against a cloned/working state or an equivalent transactional boundary is required.

### 5.7 Visibility and reveal

Initial Battle-Reveal Energy generated from Cores and matching Quantum Mystics is authoritative public state. Its total may be projected to the acting player, opponent, and spectators because it is derivable from the public fleet and dice.

Before final Ready:

- Solar Grid Use/Hold choices, the provisional Energy they add, drafted Solar spending, the local remaining-Energy preview, cast order, targets, Siphon amount, and Autocast setting remain client-local;
- opponents and spectators continue seeing the last authoritative public Energy state and receive none of those provisional changes;
- no new server-side private Solar commit/reveal store is introduced.

After the accepted declaration reaches the normal authoritative reveal/commit timing:

- committed charge choices follow existing public visibility;
- Solar casts and their ordered ledger are public;
- accepted Solar Grid Energy, committed spending, and authoritative remaining Energy are public through the approved DTO/projection;
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
- Heal and deal damage based on energy spent. You must spend an EQUAL amount of green and red energy.
- 4-7 of each: 3X-4 healing and damage.
- 8+ of each: (X-4)×5 healing and damage.
- Legal `X` values are 4 through `min(available green, available red)` at that point in the ordered draft.
- There is no separately authored upper bound.
- Lock `X`, healing, and damage when final Ready is accepted.
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
- For Black Hole, “owned” means present in the caster's authoritative fleet under the server's current-controller semantics. A Core is an owned `PLU`, `MER`, or `NEP` ship instance. Count every such instance when final Ready is accepted and lock that total as Black Hole's damage amount.
- Copied, stolen, transferred, or otherwise acquired `PLU`, `MER`, and `NEP` instances count while owned by the caster. Quantum Mystic, Solar Grid, Cube, and every other ship definition do not count.
- Later destruction, transfer, or other fleet changes do not alter the locked damage amount.
- Choose targets in the final Ready draft. Final Ready validates and commits those targets and creates an authoritative pending targeted-destruction record, but it does not immediately or visibly remove ships during that individual submission.
- After the declaration window completes through the existing authoritative phase flow, resolve the committed destruction through the shared pre-Automatic destruction seam before ordinary Automatic effects are calculated. No new server or client-visible subphase is introduced.
- That destruction seam preserves:
  - already-declared charge effects;
  - once-only effects that already became eligible;
  - omission of ordinary Automatic damage/healing from ships that do not survive.
- Stage the locked `PLU`/`MER`/`NEP`-based damage for normal end-of-turn resolution.
- Black Hole remains available when the opponent has fewer than two legal targets.

#### Simulacrum (`SSIM`)

- Cost: `X` blue, where `X` is the target ship's canonical line cost.
- Manual only; never autocast.
- Legal targets are enemy basic ships only.
- Cube is not a legal target.
- Affordability is evaluated against remaining blue Energy at Simulacrum's position in the ordered declaration.
- A player may manually cast Simulacrum multiple times in one Charge Declaration when every cast is affordable in sequence.
- Each enemy ship instance may be selected by a primary Simulacrum cast no more than once per turn. Different eligible instances, including instances of different ship definitions, may be selected by later casts.
- If the first eligible repeatable Solar Power is Simulacrum, every Cube queues one additional copy of that first cast's target. Those mandatory copies are not additional primary target selections, and later Simulacrum casts receive no further Cube repeats.
- Every accepted primary and Cube-created copy is queued for the following Drawing.

When final Ready is accepted:

- for each cast, capture an immutable authoritative snapshot of the target's copyable configuration;
- capture the target's exact numeric charge count from the authoritative snapshot taken at the start of the current Battle Phase;
- later movement, transfer, or destruction of the source does not cancel the queued copy;
- validate the complete queued set against ownership limits, including current controlled copies, pending copies from earlier primary casts in this declaration, pending copies from earlier accepted casts this turn, each new primary copy, and every mandatory Cube copy;
- reject the declaration atomically if any cast or mandatory Cube copy makes the complete set illegal; do not create a partial copy set.

The copy snapshot includes only approved canonical configuration, including:

- ship definition identity;
- permanent selected-number configuration such as Frigate or Quantum Mystic;
- the exact start-of-Battle charge count captured for that target, including zero.

It must not copy:

- source instance ID, owner, or source creation turn;
- prior once-only eligibility or fired state;
- staged effects;
- charge-used-this-turn and other used markers;
- destruction selections;
- transient combat state.

The captured charge count is not the target's printed maximum and is not its later post-spend count. For example, if an Interceptor had 1 charge in the authoritative start-of-Battle snapshot and spends it during the current declaration, its queued copy still materializes with 1 charge.

At the beginning of the following `build.drawing`, before ordinary draft resolution:

1. Materialize every queued copy with a fresh instance ID.
2. Assign the current Drawing turn as its creation turn.
3. Initialize fresh once-only eligibility and exactly the captured start-of-Battle charge count.
4. Place it into the owner's hidden Drawing fleet.
5. Let the owner upgrade it in the same Drawing through ordinary build rules.
6. Keep it hidden from opponents and spectators under normal Drawing projection.
7. Reveal it publicly at Battle Reveal.
8. Record it as a Simulacrum-produced build without double-counting history.

The copied ship follows normal built-this-turn behavior. A copied Quantum Mystic may match immediately, and a copied third Spiral may create its once-only First Strike action.

Quantity validation applies to every definition with a maximum, including Spiral, Quantum Mystic, Neptune Core, Orb, Vigor, and future capped ships. A player may legitimately cause Cube to repeat an earlier eligible power and then cast Simulacrum multiple times later. If Simulacrum itself is the first eligible repeatable cast, only that first cast receives the Cube repeats.

### 5.11 Autocast

Autocast is an explicit final-Ready convenience, not a separate rule authority and not a substitute for manual casting.

- Every single-colour Solar Power remains manually castable while Autocast is enabled.
- Final Ready carries an explicit Autocast boolean; the server never infers it from browser state.
- Autocast defaults to enabled when the user has no stored preference, and the client remembers the user's most recent setting locally.
- The remembered setting is convenience-only, not authoritative game state. Changing or losing local storage cannot affect server legality, and every final Ready still submits the explicit current boolean.
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
- lock ordered casts, dice-derived amounts, Siphon spend, Vortex type count, and Black Hole's count of currently owned `PLU`, `MER`, and `NEP` instances under current-controller semantics;
- apply Cube repetition;
- create the public ledger;
- persist Convert and pending Simulacrum records;
- validate and commit Black Hole targets, lock the previously counted `PLU`/`MER`/`NEP` damage value, and create the pending targeted-destruction record without mutating the opponent's fleet during that individual submission;
- stage Battle health effects.

After the declaration window completes through the existing authoritative phase flow, resolve committed Black Hole target destruction through the shared pre-Automatic seam. This occurs before ordinary Automatic effects are calculated and does not require a new phase.

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
- Black Hole target commitment, the locked current-controller count of owned `PLU`/`MER`/`NEP` instances, and delayed shared pre-Automatic destruction;
- Simulacrum target-instance uniqueness, exact start-of-Battle charge snapshots, queueing, aggregate limits, idempotent materialization, and reveal timing;
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
- the default-enabled, locally remembered Autocast preference and its explicit current submission value;
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

1. Rename the old Uranus Core identity from `URA`/Uranus to `NEP`/Neptune across direct identity-bearing references without changing rules, behavior, or visuals.
2. Align canonical server definitions and mirrored client definitions with the approved rules without implementing gameplay.

P2 is a pure ID/name migration. Its inventory is limited to canonical and mirrored definition identity fields plus static lookup, catalogue, Fleet, resolver, test, or development references that directly encode `URA` or Uranus. The existing ship graphic must remain visually unchanged; a literal export or lookup key may be renamed only when required to preserve that same graphic under `NEP`. P2 does not align unrelated rules text, create Solar icons, or perform broad Ancient presentation work. Legacy-only files must be inspected and classified before any edit; their presence does not automatically authorize touching them.

Solar Power graphics are a separate P4 presentation concern. P4 covers primitives for Life, Star Birth, Asteroid, Supernova, Convert, Siphon, Vortex, Black Hole, and all four Simulacrum matchup variants; Solar Power ID graphic resolution; and only the catalogue/Fleet presentation support those icons require.

Every new P4 primitive must also be registered in the repository's existing development graphics test/gallery. That development-only surface must preserve its existing entries and show every Solar icon, all four Simulacrum variants, and meaningful supported states or props in a clear arrangement sufficient to inspect colour treatment, geometry, sizing, ID resolution, and matchup selection. Reuse the existing gallery unless inspection proves it cannot support the primitives; do not create a separate Solar-only graphics tool by default. P4 does not rename `URA`, alter Neptune Core identity or its ship graphic, change ShipDefinitions, or implement gameplay.

### 6.7 Development access versus public production access

- P5A may expose Ancient only to human players through the normal server-authoritative local/development species-selection flow after P5 proves initialization, hydration, normalization, and projection are safe.
- Development access is explicitly work in progress. Unimplemented ships or powers may remain unavailable or non-functional until their own slices and must not be presented as complete.
- Bots remain unable to select Ancient unless a separate approved bot-support pass is added.
- Public production selection remains disabled until P30, full hardening, and explicit designer approval.
- The exact development/public gating mechanism and P5A file allowlist are implementation decisions to resolve after repository inspection; this roadmap does not prescribe a filename, storage key, or feature-flag mechanism.

### 6.8 Presentation direction

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
| I-09 | Development/public selection gating and P5A file scope | Normal authoritative human development selection with public production and bots still gated; exact mechanism follows inspection |
| I-10 | Existing graphics-test component and Solar icon layout | Reuse the development-only gallery, preserve existing entries, and expose every Solar primitive and supported SSIM variant clearly |

These are not unresolved game rules and do not weaken the normative planning baseline.

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
- durable pending Simulacrum copy records with source-instance uniqueness and exact captured start-of-Battle charge counts;
- durable pending Black Hole target-destruction records;
- a locked Black Hole damage count derived only from currently owned `PLU`, `MER`, and `NEP` instances under current-controller semantics at final Ready;
- per-instance permanent selected-number configuration;
- Spiral-derived maximum-health state or derivation;
- replay/idempotency markers for declaration and copy materialization.

Names and exact nesting are deferred to I-01 and I-02. Public fields must be deliberately projected; server-only scratch must remain stripped.

### 8.3 Phase integration

- Battle Reveal preparation resets and regenerates Energy.
- Existing `battle.charge_declaration` owns the one final submission.
- Existing `battle.charge_response` remains structurally unchanged.
- Final Ready commits Black Hole targets without fleet mutation; after the declaration window, the existing authoritative flow resolves them through the shared pre-Automatic destruction seam.
- End of Turn resolves staged health changes and ordinary surviving Automatic effects.
- Following `build.drawing` materializes pending Simulacrum copies before ordinary draft resolution.
- Next Battle Reveal reveals Drawing additions and replaces the previous ledger.

### 8.4 Projection and hidden information

- Available actions remain server-computed and requester-specific.
- Initial Core/Quantum Mystic Energy is authoritative public state at Battle Reveal.
- Local Solar Grid additions, drafted spending, remaining-Energy previews, cast order, targets, Siphon amount, and Autocast setting never enter public state before Ready; other viewers continue seeing the last authoritative public Energy.
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
| P1 | Documentation | Finalize and promote this record as the normative Phase 13 roadmap | None | Diff, stale-assumption audit, scope audit |
| P2 | Mixed, non-functional identity migration | Rename the existing Uranus Core identity from `URA`/Uranus to `NEP`/Neptune across direct identity references, preserving the existing graphic and all behavior; no Solar icons or broad rules alignment | P1 | Stale ID/name searches, definition parity, typecheck/build/server checks, and confirmation that no visual asset or gameplay changed |
| P3 | Mixed, definition data only | Align both Ancient definition copies with locked IDs, costs, limits, timings, and text; no effects | P2 | Definition parity and rule-text audit |
| P4 | Client/UI primitives | Add Life, Star Birth, Asteroid, Supernova, Convert, Siphon, Vortex, Black Hole, and all four Simulacrum icon/presentation variants; register every primitive in the existing development graphics test/gallery; add Solar Power ID resolution and required catalogue/Fleet support; no Neptune identity, ShipDefinitions, or gameplay changes | P3 | Every ID/variant and meaningful supported state visible in the existing dev gallery; correct colour/geometry/size/mapping; existing entries preserved; development-only posture; typecheck, build, and user visual verification |
| P5 | Server state/DTO foundation | Add normalized Energy, source breakdown, declaration/ledger/pending-copy concepts, projections, and compatibility posture | P3 | Server checks, projection/privacy tests, normalization tests |
| P5A | Client/UI or narrow Mixed, determined after inspection | Allow human players to select Ancient through the normal local/development species-selection flow for incremental testing while preserving the public production and bot gates | P3, P5 | Safe initialization/hydration/reconnect; human development selection succeeds; production selection and bot Ancient remain disabled; existing species unchanged; incomplete powers not presented as complete |
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
| P17 | Server | Implement Siphon variable spend and locked piecewise effect values | P14 | Boundary values, safe linear arithmetic, and ordered affordability |
| P18 | Client/UI | Implement adaptive Siphon spend selection and ledger presentation | P17 | Large ranges, revision, mobile fit |
| P19 | Server | Implement Vortex live distinct-type lock and damage staging | P14 | Type-count semantics and source changes |
| P20 | Server | Commit Black Hole targets and the owned `PLU`/`MER`/`NEP` count under current-controller semantics at Ready without fleet mutation, then resolve destruction after the declaration window through the existing pre-Automatic seam | P7, P14 | 0/1/2+ targets; zero/mixed/copied/controlled Core counts; post-Ready fleet changes; non-Core exclusion; protection and simultaneous timing |
| P21 | Client/UI | Implement Black Hole target selection and outcome presentation | P20 | Exact target requirement and responsive UX |
| P22 | Server | Implement multiple sequential Simulacrum casts, per-target-instance uniqueness, exact start-of-Battle charge snapshots, aggregate pending-copy limits, durable queue, hidden Drawing materialization, and idempotency | P14 | Sequential costs, duplicate target rejection, aggregate primary/Cube limits, exact captured charges, reload/retry, reveal |
| P23 | Client/UI | Implement multi-cast Simulacrum targeting, sequential cost preview, duplicate-instance prevention, pending-copy, and Drawing presentation | P22 | Different instances/definitions, first-cast Cube repeats, privacy, exact charge display, same-Drawing upgrade |
| P24 | Server | Implement Cube repeat selection, multiplicity, limits, and all eligible effect copies | P15, P17–P22 | Manual-first, auto fallback, no recursion, all-or-none SSIM |
| P25 | Client/UI | Present automatic Cube repeats in draft/ledger without adding a Cube interaction | P24 | Multiple Cubes, manual/auto source clarity |
| P26 | Client/UI display | Implement Energy display and Ancient Fleet row layout with responsive fitting and FLIP | P5, committed ledger | Desktop/mobile, row stability, spectator |
| P27 | Mixed history/projection | Integrate Energy/Solar breakdown, public ledger persistence, and battle-log/history capture | P14–P24 | Phase lifetime, following Build, no double count |
| P28 | Client/UI animation | Add restrained Energy, cast, copy, and ledger transition cues from authoritative state | P26–P27 | Reconnect/remount determinism; reduced churn |
| P29 | Mixed hardening | Run regression, reload, concurrency, hidden-info, normalization, and full gameplay matrices through the P5A development selection flow | P5A, P6–P28 | Typecheck/build/server checks plus user runtime; no development/public gate leakage |
| P30 | Mixed, narrow public enablement | Enable Ancient in public production human species-selection surfaces only after full hardening and explicit designer approval; development selection already exists from P5A | P29 and designer sign-off | Intended production human paths, bot safeguards, spectator/reconnect smoke tests, existing species stability, and no development-only warning/gate leakage |

Slices may be split further when inspection reveals multiple owners. They must not be collapsed into a broad Ancient mega-pass.

---

## 10. Regression and migration risk register

| Risk | Why it matters | Required mitigation |
| --- | --- | --- |
| Global declaration gating regresses | Ancient logic could stop every Ancient player or bypass foreign charge actions | Extend existing server gating; test zero-input, Energy, SOL, and foreign-charge cases |
| Charge Response changes accidentally | Solar declarations could alter shared response behavior | Keep response rules unchanged and add regression coverage |
| Invalid final submission partially applies | Early charge/Energy mutation could survive a later invalid cast | Validate/apply transactionally against a working state |
| Provisional Energy drifts from server truth | Local SOL or cast edits can show false affordability | Recompute locally from one draft; replace with accepted server state; show rejection cleanly |
| Private Energy draft leaks or hides public initial Energy | Other viewers could see intent or lose legitimate Battle-Reveal information | Project initial Core/QUA Energy publicly while keeping only provisional SOL/spend changes requester-local |
| Stale old Uranus identifiers remain | Identity mismatch can break definitions, lookups, resolvers, or persisted state | Keep P2 to direct ID/name references, run stale searches, and preserve the existing graphic and behavior |
| Identity work drifts into Solar graphics | P2 and P4 could become an unsafe mixed presentation rewrite | Keep P2 identity-only and P4 Solar-icon-only, with explicit no-touch checks |
| Development Ancient access leaks into production or bots | An incomplete species could become publicly selectable or enter unsupported bot play | P5A must gate human local/development selection separately and P30 must audit production exposure and bot exclusions |
| Development selection overstates completeness | Testers could mistake unavailable ships or powers for implemented rules | Mark Ancient as work in progress and expose only functionality completed by its approved slices |
| Solar primitives lack gallery coverage | Missing, clipped, miscoloured, or wrongly mapped icons may reach later UI slices unnoticed | Register every Solar icon and all four SSIM variants in the existing development graphics test while preserving existing entries |
| Energy remains a scalar or loses colour/source detail | Payment and UI attribution become ambiguous | Normalize a three-colour source-aware structure |
| Ledger clears at turn increment | Required following-Build display disappears | Store ledger with Battle lifetime, not only disposable turn data |
| Pending copies duplicate after reload/retry | Simulacrum can create extra permanent ships | Durable record plus deterministic IDs/idempotency marker |
| Simulacrum ignores aggregate limits | Multiple primary casts and Cube copies can exceed caps | Validate current controlled copies plus every earlier/current primary and Cube-created pending copy |
| Cube repeats bypass limits | Mandatory repeats could create a partial illegal copy set | Reject the whole declaration when the full repeat set is illegal |
| Simulacrum clones transient state | Copies could inherit damage-time markers, ownership, or spent once-only state | Explicit allowlisted snapshot and fresh instance initialization |
| Simulacrum restores the wrong charge count | Printed maximum or post-spend state would violate the snapshot rule | Persist and materialize the exact numeric charge count from the authoritative start-of-Battle snapshot |
| Non-Ancient controllers gain Solar access | Stolen Ancient ships could create unintended species mechanics | Gate Energy and Solar use by controller species while retaining specified ordinary effects |
| Black Hole disappears with fewer than two targets | Rules require full-cost use even with one or zero legal targets | Availability and resolver tests for 0/1/2+ targets |
| Black Hole counts the wrong ships as Cores | Vague type/category logic could include QUA/SOL/CUB or exclude acquired Cores | Under current-controller semantics, count only owned `PLU`, `MER`, and `NEP` instances at Ready and lock the result |
| Black Hole mutates a fleet on individual Ready | One player's submission could invalidate an opponent still drafting | Commit targets only, then resolve after the declaration window through the shared pre-Automatic seam |
| Destroyed ships still fire ordinary Automatic effects | Black Hole timing could violate survival semantics | Resolve committed destruction before ordinary Automatic calculation and use existing survival checks |
| Destroyed charge source loses a declared effect | A committed charge must survive later source destruction | Persist accepted charge effect independently of source survival |
| Spiral max-health loss fails to clamp | Player health can exceed new maximum | Central derived-max update with immediate authoritative clamp |
| Hidden Drawing information leaks | Pending Simulacrum copies reveal strategy | Reuse requester-aware Drawing projection |
| Existing species regress | Shared phase, build, effects, and projection seams are touched | Run cross-species declaration/build/battle matrix |
| Desktop and mobile diverge | Two-stage draft and three fleet rows are layout-sensitive | Dedicated responsive slices and user visual testing |
| History records effects twice | Declaration and resolution integrations may duplicate one event | Define canonical record ownership and test counts |
| Existing scaffolding is mistaken for finished architecture | Stale types can pull work into the wrong layer | Inspect ownership and reuse only verified seams |
| An unnecessary migration is introduced | Broad stored-state writes increase risk | Prefer normalization; require evidence before a migration pass |
| Autocast depends on local preference storage | Missing or altered browser storage could affect authoritative behavior | Default the UI to enabled, remember locally, and always submit an explicit server-validated boolean |

---

## 11. Validation strategy

### 11.1 Documentation-pass validation

For this pass:

- inspect the final diff;
- confirm only this planning document changed;
- confirm the record now states normative status;
- search for stale development/public selection, P4 graphics-test, Black Hole Core-definition, and previously removed rule wording;
- verify roadmap P1–P30 plus P5A, the decision register, risk register, and validation matrix are present;
- verify Markdown links;
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

For P2 specifically, verify:

- all live `URA` and Uranus Core identity references are removed or deliberately documented;
- canonical and mirrored identity fields remain aligned;
- the same existing ship graphic is preserved under the new identity;
- no SVG path, visual asset, styling, Solar icon, unrelated rules text, or gameplay behavior changes.

For P4 specifically, verify:

- Life, Star Birth, Asteroid, Supernova, Convert, Siphon, Vortex, Black Hole, and all four Simulacrum matchup variants resolve to the intended primitives;
- every primitive and meaningful supported state/prop is visible in the existing development graphics test in a clear inspection arrangement;
- no icon is missing, duplicated, clipped, incorrectly coloured, or mapped to the wrong Solar Power ID or matchup;
- the graphics test remains development-only and all pre-existing entries remain intact;
- `npm run typecheck` and `npm run build` pass, while browser visual verification is reported as performed by the user rather than Codex.

For P5A specifically, verify:

- a human player can select Ancient through the normal server-authoritative local/development species-selection flow;
- Ancient player state initializes, normalizes, projects, reloads, and reconnects safely;
- public production selection remains disabled and bots cannot select Ancient;
- existing species-selection behavior is unchanged;
- unimplemented Ancient ships or powers are unavailable, non-functional, or clearly not presented as complete.

For P30 specifically, verify:

- Ancient appears only in intended public production human-selection surfaces after designer sign-off;
- bots still cannot select Ancient unless a separate approved bot-support plan exists;
- development-only warnings or gates do not leak into production;
- existing species-selection, spectator, reload, and reconnect paths remain safe.

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
- Black Hole targets commit without mutating the opponent's fleet during an individual Ready submission.
- Committed Black Hole destruction resolves only after the declaration window through the shared authoritative pre-Automatic seam.
- The opponent's already-drafted declaration remains valid under normal simultaneous-declaration rules.
- Retry/reconnect cannot double-apply.
- Solar and Grid declarations do not create a new Charge Response selection.
- Existing response-bearing charge actions still behave normally.

### 11.4 Energy and Autocast matrix

Verify:

- Battle Reveal clears previous Energy before generation.
- Pluto, Mercury, Neptune, and matching Quantum Mystic produce the correct colours.
- Initial Core/Quantum Mystic Energy is public to players and spectators at Battle Reveal.
- Provisional Solar Grid Energy, drafted spending, remaining-Energy preview, cast order, targets, Siphon amount, and Autocast setting remain private to the acting player.
- Other viewers keep seeing the last authoritative public Energy until normal declaration reveal/commit, after which accepted Grid Energy, spending, and remaining Energy are public.
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
- With no stored preference, Autocast defaults to enabled.
- The most recent local setting is remembered but never treated as authoritative state.
- Every final Ready sends the explicit current Autocast boolean; missing or changed local storage does not affect server legality.
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

- minimum `X = 4`;
- all values through current `min(green, red)`;
- correct `3X-4` healing and damage for `X=4-7`;
- correct `(X-4)×5` healing and damage for `X>=8`;
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
- zero owned Cores locks damage 0;
- mixed owned `PLU`, `MER`, and `NEP` instances all count;
- copied, stolen, transferred, or otherwise acquired `PLU`/`MER`/`NEP` instances count when owned under current-controller semantics;
- Quantum Mystic, Solar Grid, Cube, and every other non-Core ship are excluded;
- destruction, transfer, or fleet changes after Ready do not alter the locked damage;
- targets and pending destruction commit without immediate opponent fleet mutation during individual Ready;
- destruction resolves after the declaration window and before ordinary Automatic calculation;
- the opponent's already-drafted declaration remains valid under normal simultaneous rules;
- declared charge effects survive destroyed sources;
- ordinary Automatic effects from destroyed ships are omitted;
- already-created once-only actions survive;
- no Autocast or Cube repeat.

### 11.7 Simulacrum and Cube matrix

Simulacrum:

- cost equals canonical target line cost;
- only enemy basic ships are targetable;
- Cube cannot be targeted;
- multiple primary casts in one declaration may target different eligible instances, including different ship definitions;
- each primary cost is paid sequentially from the remaining blue Energy;
- a second primary cast targeting the same source instance is rejected;
- Cube repeats only the first eligible Simulacrum cast, and later Simulacrum casts receive no additional Cube repeats;
- immutable snapshot survives target destruction, transfer, and reconnect;
- Frigate and Quantum Mystic selections copy;
- transient/source identity/used state does not copy;
- the exact numeric charge count comes from the authoritative start-of-Battle snapshot, including zero;
- copied charge count is neither the printed maximum nor the target's post-spend count;
- fresh instance ID, creation turn, and once-only state accompany the captured charge count;
- materializes before Drawing draft and may upgrade in that Drawing;
- owner sees it during hidden Drawing; others do not;
- reveals at Battle Reveal;
- same-turn Mystic and third-Spiral rules apply;
- reload/retry cannot duplicate;
- aggregate quantity limits include current controlled copies, earlier primary copies in the declaration, earlier accepted pending copies that turn, every new primary copy, and all mandatory Cube copies.

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

- initial Core/Quantum Mystic Energy is authoritative public state at Battle Reveal;
- provisional Solar Grid Energy and draft spending are visible only to the acting player;
- spectators and opponents receive no provisional remaining Energy, cast order, targets, Siphon amount, or Autocast value;
- authoritative accepted Energy and ledger state become public only through normal declaration reveal/commit posture;
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
- bots or automated seats, which must not select Ancient unless a separate approved bot-support plan explicitly adds support; neither P5A nor P30 does so;
- P5A local/development human Ancient selection with public production and bot selection still disabled;
- P30 public-production exposure with no development-only leakage and no change to the bot exclusion absent a separate approved bot plan.

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
- non-Ancient controllers gaining an Ancient Energy economy;
- blocking human development selection behind the final public-production P30 gate.

Any implementation proposal that reintroduces one of these assumptions conflicts with this record.

---

## 13. Submission-stage status

This planning pass changes documentation only.

It does not:

- change server rules;
- change client runtime behavior;
- change display or graphics;
- modify canonical or mirrored definitions;
- perform the planned Uranus Core to Neptune Core ID/name migration;
- add tests;
- change tooling;
- enable Ancient in either local/development or public production species selection;
- add Solar icons to the development graphics test.

The planning baseline is now approved. Implementation still proceeds only through separate inspection, file planning, and explicit approval for each narrowly scoped slice.

---

## 14. Next implementation gate

This normative planning record is approved. The next gate is inspection, a concrete file allowlist, and explicit pass approval for:

> **P2 — dedicated non-functional `URA`/Uranus to `NEP`/Neptune identity migration.**

That pass must inventory every direct live ID/name reference, propose an exact allowlist, preserve the existing graphic and all behavior, and validate both server and client identity continuity. It must not modify SVG paths or visual assets, create Solar icons, align unrelated rules text, or implement Energy, Solar Powers, or balance changes.

After P2 is separately completed and approved, P3 aligns the canonical server definitions and mirrored client definitions with the locked rules as a separate data-only change. P4 remains the unrelated Solar Power icon/presentation-primitives pass and must register every new Solar primitive, including all four Simulacrum variants, in the existing development graphics test.

After P5 establishes safe Ancient initialization, hydration, normalization, and projection, P5A may separately enable human-only local/development selection through the normal authoritative flow so subsequent functional slices can be tested in real games. That development access does not expose Ancient publicly, enable bot selection, or imply unfinished rules are complete.

P30 is the later public/production Ancient enablement gate after P29 hardening and explicit designer sign-off. No gameplay implementation should begin before the identity and definition foundations are reviewed in order, and normative status must not be treated as blanket implementation authorization.
