# Phase 17 — Ancient Bots

## Normative Planning and Pass-Decomposition Document

- **Status:** Normative planning baseline
- **Phase type:** Server-authoritative Play Computer bot expansion
- **Primary species:** Ancient
- **Architecture baseline:** Current server-authoritative bot framework after Phase 14 and the current Human/Xenite/Centaur bot expansion
- **Rules baseline:** Current executable Ancient rules and current canonical ship definitions
- **Extends:** `Phase 8 Play Computer-v1 Normative.txt` and `Phase 8 Play Computer v1 Matchup Opening Addendum.txt`
- **Ancient rules dependency:** `Phase 13 Ancient Species - GPT-5.6 Planning Record.md`, as superseded by current executable rules and Phase 14 cutovers
- **Public enablement posture:** Ancient bot strategy is implemented and validated first; normal Play Computer Ancient-opponent selection remains gated on the separate Mission/Lore follow-up required for Ancient-opponent matchup content

If later implementation instructions conflict with this document, this document wins for Phase 17 Ancient bot behavior unless explicitly superseded.

---

## Contents

1. Status and authority
2. Purpose
3. Architectural stance
4. Scope and non-goals
5. Current repository baseline
6. Phase 17 design summary
7. Ancient plan registry and deterministic opening chooser
8. Build-planning posture
9. Quantum Mystic configuration
10. Dice Roll and Cube behavior
11. Spiral First Strike behavior
12. Atomic Ancient Charge Declaration
13. Baseline Solar policy
14. Siphon decision model
15. Black Hole decision model
16. Vortex and Simulacrum opt-in policy
17. Targeting and deterministic tactical comparators
18. Copied foreign ships, ordinary charges, Carrier, and upgrades
19. Initial Ancient plan catalogue
20. Recommended pass structure
21. Validation strategy
22. Risks, tuning points, and deliberately open content decisions
23. Completion criteria
24. Public Play Computer and Mission/Lore follow-up gate
25. Bottom line

---

# 1. Status and authority

## 1.1 Planning status

This document is the normative Phase 17 planning baseline for Ancient bot support.

It defines:

- how Ancient bots fit the existing Play Computer architecture;
- the intended deterministic opening-plan chooser;
- the required Ancient-specific bot policy seams;
- which existing Human/Xenite/Centaur bot systems must be reused;
- the first authored Ancient plan family;
- the implementation pass sequence.

Implementation must still proceed through separately approved scoped Codex passes. Each pass must inspect the current repository, present a file plan before editing, and remain inside its approved ownership boundary.

## 1.2 Source precedence

For Phase 17 implementation, use this order:

1. Current executable server code and current canonical ship definitions.
2. Current repository architecture/contracts and agent rules.
3. Locked decisions in this Phase 17 document.
4. Current active player-facing rules documentation.
5. Phase 14 rules/cutover records where they describe current behavior.
6. Phase 13 Ancient planning material for historical intent only where current code has not superseded it.
7. Phase 8 Play Computer planning documents for the durable bot architecture.

Do not restore obsolete Ancient mechanics merely because they remain in an older Phase 13 description.

## 1.3 Important current-rule correction

Current executable Ancient behavior is the implementation baseline.

In particular, Solar Grid is now an automatic Battle Reveal source:

- a charged `SOL` automatically spends one charge during Reveal;
- it contributes one Energy of each colour to the Ancient Energy pool;
- there is no current Ancient bot Use/Hold decision for Solar Grid.

Phase 17 must not reintroduce the older explicit Solar Grid declaration model.

---

# 2. Purpose

Phase 17 adds Ancient as a fully supported server-side bot strategy species while preserving the existing Play Computer architecture.

Its purpose is to:

- let an Ancient bot play complete games through the same authoritative game engine as Human, Xenite, and Centaur bots;
- keep Ancient bot behavior deterministic, authored, and debuggable rather than search/simulation based;
- introduce a deterministic roll/line-threshold opening chooser before the long-form Ancient plan is locked;
- reuse the existing ordered build planner, adaptive health rules, Cube chooser, charge policies, targeting comparators, foreign-build legality, authoritative intent reducer, and bot safety loop wherever possible;
- add the minimum new machinery required for Ancient-specific permanent build configuration and atomic Solar declarations;
- support baseline intelligent Autocast, Siphon, and guarded Black Hole behavior;
- keep Vortex and Simulacrum disabled unless an authored plan explicitly allows them;
- support a first family of approximately eleven Ancient plans ranging from simple aggro to Simulacrum-heavy strategies;
- isolate the most complex Simulacrum/foreign-upgrade behavior into a later pass instead of burdening the first playable Ancient bot slice.

This is not a new AI architecture. It is an expansion of the current deterministic plan-driven bot system.

---

# 3. Architectural stance

## 3.1 Server authority remains unchanged

Shapeships remains server-authoritative.

The server continues to own:

- legality;
- phase progression;
- build validation and spending;
- permanent ship configuration;
- Energy generation and spending;
- Solar Power validation and resolution;
- target legality;
- charge spending;
- combat outcomes;
- canonical fleet state;
- bot controller metadata.

The bot chooses intentions and submits them through the internal authoritative flow. It does not become a second rules engine.

## 3.2 Bot remains a controller, not a separate Ancient rules implementation

Ancient bot behavior must use the same canonical mechanics as an Ancient human player.

The bot may decide:

- which authored plan to follow;
- what to build;
- which Quantum Mystic number to choose;
- which Cube result to use;
- which First Strike target to select;
- which ordinary charge choices to include;
- which manual Solar casts to declare and in what order;
- whether Autocast is enabled.

The bot must not independently apply:

- Energy changes;
- Solar effects;
- build legality;
- destruction;
- copied ships;
- charge spends;
- phase transitions.

Those remain authoritative server concerns.

## 3.3 Existing bot runner remains the orchestration seam

`botRunner.ts` remains the phase-aware orchestration layer.

Phase 17 should not create a parallel `ancientBotRunner` that independently loops through game phases.

Recommended posture:

- `botRunner.ts` decides when an Ancient bot needs to act;
- `ancientBotPlanner.ts` produces Ancient-specific decisions/payloads;
- `buildPlanner.ts` remains the generic build planner;
- `ancientPlans.ts` remains authored strategy data.

## 3.4 Ancient-specific strategy helper is justified

Unlike existing species, Ancient Charge Declaration requires one atomic submission that combines ordinary charge actions, ordered manual Solar casts, and an explicit Autocast boolean.

That is enough new decision surface to justify one dedicated server helper, conceptually:

```text
src/supabase/functions/server/engine/bot/ancientBotPlanner.ts
```

Exact filename may follow implementation conventions, but Ancient Solar decision logic should not be scattered across `botRunner.ts` or duplicated inside individual plan files.

## 3.5 No client-side bot strategy

No Ancient strategy logic belongs in:

- `useGameSession`;
- client Ancient charge-draft helpers;
- desktop/mobile Solar UI components;
- display code.

Client changes are deferred until normal Play Computer Ancient-opponent selection is intentionally enabled after the Mission/Lore compatibility pass.

---

# 4. Scope and non-goals

## 4.1 In scope

Phase 17 includes:

- `ANC`/Ancient support in the server bot type/plan layer as needed for bot-engine tests and strategy resolution;
- a new `ancientPlans.ts` authored plan registry;
- a deterministic deferred opening-plan chooser;
- durable selected-plan resolution once the chooser commits;
- small generic build-planner extensions where the Ancient plans expose a real reusable gap;
- Quantum Mystic permanent-number planning and `BUILD_SUBMIT` payload completion;
- Spiral third-copy First Strike target support;
- reuse of existing Cube highest-dice policy;
- construction of atomic `CHARGE_DECLARATION_SUBMIT` payloads;
- baseline Autocast behavior;
- deterministic Siphon evaluation against the Autocast alternative;
- guarded Black Hole behavior;
- plan-gated Vortex;
- plan-gated Simulacrum;
- deterministic Simulacrum target selection;
- support for ordinary foreign charge actions inside the Ancient atomic declaration where the generic bot already knows how to plan them;
- deterministic copied-Carrier choices for plans that request them;
- a narrow opportunistic foreign-upgrade policy for the Simulacrum-heavy plan if required;
- server-side tests and safety-cap validation.

## 4.2 Out of scope

Phase 17 does not include:

- minimax, Monte Carlo, simulation search, reinforcement learning, or broad lookahead;
- a general scripting language for arbitrary bot logic;
- changing Ancient gameplay rules;
- changing Solar Power balance values;
- changing the canonical Autocast order;
- new client-side Ancient Solar mechanics;
- Mission Finding changes;
- Ancient-opponent Mission story writing;
- the new Ancient-vs-Ancient Watcher finding/content pass;
- the reverse-matchup `ancient_secrets` finding expansion;
- public Play Computer Ancient-opponent selection before Mission/Lore compatibility is ready;
- broad bot framework refactors unrelated to Ancient needs;
- replacing the existing eight-step bot safety cap unless evidence proves it insufficient.

---

# 5. Current repository baseline

The current codebase already provides most of the durable bot architecture required by Phase 17.

## 5.1 Existing bot files

The active server bot layer currently contains:

```text
engine/bot/botTypes.ts
engine/bot/humanPlans.ts
engine/bot/xenitePlans.ts
engine/bot/centaurPlans.ts
engine/bot/buildPlanner.ts
engine/bot/botRunner.ts
```

Phase 17 should add Ancient support beside these files rather than reorganizing the bot folder.

## 5.2 Existing bot species support

Current `BotSpeciesId` supports:

```text
HUM
XEN
CEN
```

Current normal Play Computer payload/client selection similarly excludes Ancient as a computer species.

That exclusion is intentional until Phase 17 strategy exists and the Mission/Lore matchup matrix is ready for Ancient opponents.

## 5.3 Existing deterministic plan registries

Human, Xenite, and Centaur plans already use:

- authored plan arrays;
- stable plan IDs;
- deterministic hash-based plan choice by game seed;
- plan lookup by `chosenPlanId`.

Ancient should reuse that posture after its deferred opening chooser resolves.

## 5.4 Existing ordered build planner

The current build planner already supports:

- authored ordered build sequences;
- repeated entries to express groups;
- end loops;
- upgrade component reservation and atomic conversion posture;
- ordinary/joining line accounting;
- authoritative max quantities;
- foreign build legality;
- manual bridge components for upgrades;
- fallback ships for blocked upgrade/component paths;
- adaptive health-based build rules;
- Evolver-specific passive/targeted conversion support.

This is the correct foundation for most Ancient build plans.

## 5.5 Existing adaptive health rules

`adaptiveBuildRules` already support self/opponent health thresholds and target counts before the main plan executes.

This is the preferred foundation for Ancient behaviors such as:

- adding one or more Quantum Mystics at low health;
- adding a Pluto group when a plan needs more green Energy defensively;
- other narrowly authored health-based insertions.

Do not invent a separate Ancient health-adaptation engine where the existing rule family suffices.

## 5.6 Existing Cube policy is already species-independent

Current bot Cube behavior:

- chooses the highest projected dice value;
- when Main and Cube are tied, prefers Cube over Main.

Ancient Cube plans should inherit this behavior without an Ancient-specific Cube policy unless a later balance decision explicitly changes it.

## 5.7 Existing tactical target comparator

The current generic tactical comparator already ranks targets by:

1. higher canonical total line cost;
2. higher live remaining charges;
3. stable `instanceId` order.

This comparator should be reused for Spiral, Black Hole, and Simulacrum target ranking where the plan calls for “highest value and most charges.”

## 5.8 Existing foreign-build legality is reusable

The current build planner already understands the special foreign-build posture:

- Ancient may own foreign Basic Ships through Simulacrum;
- foreign Basic Ships cannot simply be manually built;
- legal foreign upgraded ships may be built when required foreign components actually exist.

Phase 17 should reuse this legality seam rather than reimplementing cross-species build rules in Ancient bot code.

## 5.9 Ancient build payload has a real extra requirement

`BUILD_SUBMIT` already requires `quantumMysticSelections` when new `QUA` instances are built.

The generic planner currently produces ship counts but does not append those permanent selections.

This is a small required Ancient extension analogous to the existing Frigate-trigger payload completion.

## 5.10 Ancient Charge Declaration is atomically different

Current server rules require Ancient Charge Declaration input to use:

```text
CHARGE_DECLARATION_SUBMIT
```

The accepted payload contains:

- `ordinaryChargeActions`;
- `solarCasts`;
- `autocastEnabled`.

Ordinary Ancient `ACTION`/`ACTIONS_SUBMIT` charge behavior is rejected when the Ancient atomic contract applies.

Therefore Ancient cannot be implemented by simply calling the current ordinary charge helpers sequentially and then `DECLARE_READY`.

## 5.11 Current canonical Autocast order

Current server Autocast priority is:

```text
SSTA → SSUP → SCON → SLIF → SAST
```

Autocast covers the mono-colour Solar Powers only.

It does not automatically cast:

```text
SSIM
SSIP
SVOR
SBLA
```

This is a strong fit for the intended Ancient bot baseline: special manual decisions first, then authoritative Autocast for the remainder.

## 5.12 Solar Grid requires no bot choice

A charged Solar Grid is automatically consumed at Battle Reveal and contributes its Energy before Charge Declaration.

Phase 17 should treat `SOL` as an Energy/build planning decision, not a Charge Declaration action decision.

---

# 6. Phase 17 design summary

The intended Ancient bot flow is:

```text
Computer species is Ancient
        ↓
Ancient strategy begins unresolved
        ↓
Build/Drawing has authoritative available line total
        ↓
Threshold chooser resolves or elects to save/reassess
        ↓
One long-form Ancient plan becomes durable bot metadata
        ↓
Generic build planner executes that plan
        ↓
Ancient helper appends QUA permanent selections
        ↓
Cube/Spiral decisions reuse existing bot seams
        ↓
At Charge Declaration, Ancient helper creates one atomic declaration:
  supported ordinary foreign charge actions
  + ordered manual Solar decisions
  + autocastEnabled
        ↓
Server validates/resolves normally
```

The key principle is that Ancient adds a strategy layer on top of existing server rules. It does not create a second Ancient game engine.

---

# 7. Ancient plan registry and deterministic opening chooser

## 7.1 Ancient differs from current species at plan-selection time

Human, Xenite, and Centaur currently lock a deterministic long-form plan when computer species selection is resolved.

Ancient intentionally delays the final long-form plan choice until the first useful Drawing decision because the opening line total materially changes the desired build family.

This is the principal planned departure from the existing species behavior.

## 7.2 This is compatible with the Phase 8 opening-book addendum

The Phase 8 matchup/opening addendum already authorizes a later deterministic opening layer that may read:

- authoritative turn;
- authoritative effective dice;
- saved/available line state;
- narrow public opening facts;

and then hand back to the ordinary plan system.

Phase 17 uses that approved architectural direction.

## 7.3 Authoritative chooser input

The chooser should use the authoritative ordinary line total available for the bot at `build.drawing` after Line Generation.

On Turn 1 this is currently equivalent to:

```text
3 starting saved lines + effective dice
```

Do not recalculate this manually if the authoritative player line field already contains the correct total.

On later turns after a save, use the real accumulated authoritative line total rather than continuing to assume `3 + dice`.

## 7.4 Threshold families

The initial chooser is:

| Available ordinary lines | Decision family |
|---|---|
| `>= 9` | choose one of four CUB-first plans |
| `7–8` | choose one of five NEP-first plans |
| `6` | 33% Spiral-into-Aggro, otherwise save and reassess |
| `<= 5` | 20% Simple Aggro/MER, otherwise save and reassess |

The `<= 5` band is the later-turn generalization of the original Turn-1 `4 or 5` rule.

## 7.5 Deterministic percentages

The 33/67 and 20/80 branches must not use uncontrolled runtime randomness.

Use a stable deterministic bucket derived from authoritative/publicly stable inputs such as:

```text
gameId + Ancient chooser salt + threshold class + turnNumber
```

Requirements:

- repeating the same game state produces the same decision;
- a later reassessment may legitimately land in a different deterministic bucket because the turn/threshold context changed;
- no browser/client randomness is involved;
- debug/test fixtures can predict the branch.

## 7.6 Deterministic family selection

When the chooser enters the CUB or NEP family, select one plan from that family deterministically.

Recommended seed posture:

```text
gameId + resolved Ancient family id
```

The selected long-form plan is then final for the game.

## 7.7 Plan persistence

Once a long-form Ancient plan is selected, that choice must be durable bot strategy metadata.

Do not infer the selected plan later from fleet composition because:

- ships can be destroyed;
- Simulacrum can add foreign ships;
- future transfer/control effects can change fleet shape;
- adaptive rules may make two plans temporarily look similar.

The exact metadata mechanism is an implementation detail, but the durable semantic requirement is locked.

A narrow bot-controller strategy-resolution mutation is acceptable because selecting a bot strategy is controller metadata, not a gameplay action. All actual gameplay actions must continue through `applyIntent`.

## 7.8 Unresolved chooser must not deadlock Dice Roll

Before the long-form plan is selected, the bot must still pass through early phases normally.

In particular:

- Turn-1 `build.dice_roll` must not fail merely because no final Ancient plan exists yet;
- there is no Cube to choose before one has been built;
- final plan resolution occurs no later than the first accepted Ancient `BUILD_SUBMIT` that commits a family.

The runner/plan resolution seam must explicitly support this temporary unresolved Ancient strategy state.

---

# 8. Build-planning posture

## 8.1 Prefer the ordered planner for Ancient

The newer Xenite/Centaur ordered-plan style is the preferred foundation for Ancient plans.

Use repeated ordered entries to express groups such as:

```text
PLU, PLU, PLU
MER, MER, MER
```

and use an `endLoop` for stable late-game repetition.

The legacy target-count plan style may remain supported but should not be the default authoring model for the new Ancient plan set.

## 8.2 Existing planner behavior should remain generic

Do not fork `buildPlanner.ts` into an Ancient-only build planner.

Ancient-specific behavior should be limited to:

- authored plan data;
- a small generic priority-step extension if needed;
- payload completion for QUA selections;
- explicitly Ancient dynamic policies that cannot be represented as ordinary build order.

## 8.3 Required generic gap: priority/first-affordable step

Some Ancient plans require behavior of the form:

> Prefer SOL if affordable; otherwise build NEP.

The current ordered planner does not model this cleanly.

Its existing fallback system mainly supports blocked upgrade/component paths. A normal resource failure on a primary ordered step stops/saves rather than attempting a lower-priority ordinary ship.

Phase 17 should add one narrow generic concept equivalent to:

```text
first affordable from [SOL, NEP]
```

or another equally small representation.

Requirements:

- remain generic rather than Ancient-named;
- use the same `tryAddShipToDraft`/authoritative definition inputs as existing planning;
- preserve final server legality;
- not become a general expression language.

## 8.4 Group decisions should stay narrow

Some rough Ancient plans call for choosing `MER` or `PLU` in groups of three depending on health.

Do not introduce a general conditional scripting DSL for this.

Preferred order:

1. express the behavior through existing `adaptiveBuildRules` if the final threshold logic permits it;
2. otherwise add one narrowly defined authored conditional-group primitive only if implementation demonstrates a real need.

## 8.5 Health adaptations reuse existing rules

Examples currently intended for Ancient include:

- adding QUA when self health is low;
- adding a PLU trio when a snowball plan needs more defensive green Energy;
- selecting 3 vs 6 PLU in a Black Hole/Solar plan based on health.

Where possible, these should be ordinary `adaptiveBuildRules` evaluated before the main ordered plan.

## 8.6 Max quantities remain authoritative

Ancient planner code should not create a second max-quantity table.

Current canonical limits already include:

- QUA maximum 6;
- SPI maximum 3;
- NEP maximum 6.

The generic planner and final server validator remain authoritative.

---

# 9. Quantum Mystic configuration

## 9.1 QUA needs payload completion

When the bot builds one or more Quantum Mystics, every new QUA requires a permanent selected number between 1 and 6.

Phase 17 should follow the existing Frigate pattern:

```text
generic build planner
→ BuildSubmitPayload
→ Ancient helper appends quantumMysticSelections
```

Do not move QUA selection rules into the generic fleet-cost planner.

## 9.2 Initial authored QUA selection modes

The first plan set requires at least:

### `fixed_6`

Use selected number `6` for each new QUA.

This supports the rough-plan notation:

```text
QUA on 6
```

### `match_effective_dice`

Select the current authoritative effective dice value for each new QUA.

This supports the rough-plan notation:

```text
QUA on Any
```

The intended interpretation is not random-any; it is “choose the current effective dice so the Mystic can trigger immediately on its build turn.”

## 9.3 Multiple QUA in one submission

If multiple QUA are built in the same `BUILD_SUBMIT`, produce one valid selection for each new QUA in the exact payload order expected by the authoritative build resolver.

The helper must be deterministic and tested for multi-QUA drafts.

---

# 10. Dice Roll and Cube behavior

## 10.1 Reuse current Cube policy

No Ancient-specific Cube chooser is required in the first version.

Use the current bot rule:

- choose the highest available projected dice value;
- if Main and a Cube result tie, prefer Cube.

## 10.2 Effective dice drives downstream Ancient decisions

After Cube choice resolves, the resulting authoritative effective dice is the value used by:

- Line Generation;
- QUA match checks;
- Star Birth/Supernova amounts;
- any later QUA `match_effective_dice` build configuration.

Ancient bot code should read the existing authoritative effective-dice helpers rather than reconstructing Cube effects.

---

# 11. Spiral First Strike behavior

## 11.1 SPI joins the existing first-strike target family

The third Spiral creates a once-only built-turn First Strike that may destroy one Basic enemy ship.

The server already owns:

- when that once-only action exists;
- legal Basic targets;
- action validation;
- effect resolution.

Phase 17 only needs the bot to select a target when the projected action exists.

## 11.2 Target policy

Initial Ancient Spiral policy:

```text
highest_cost_basic
```

Reuse the current tactical comparator:

1. highest total line cost;
2. most remaining charges;
3. stable instance ID.

This should be added as a normal target-policy extension, not a bespoke Spiral target engine.

---

# 12. Atomic Ancient Charge Declaration

## 12.1 This is the main new bot subsystem

Ancient Charge Declaration is the most important Phase 17 technical difference.

Current Ancient authoritative input requires one atomic declaration containing:

```ts
{
  ordinaryChargeActions,
  solarCasts,
  autocastEnabled
}
```

The Ancient bot must submit that contract directly.

## 12.2 Do not sequence ordinary bot ACTIONs first

For an Ancient bot, the runner must not:

1. send an ordinary `ACTION` for a copied Interceptor;
2. send another charge action;
3. later submit Solar Powers;
4. finally Ready.

That conflicts with the current Ancient atomic contract.

Instead, all supported ordinary charge decisions are planned as `PowerActionPayload` entries and included in the single `CHARGE_DECLARATION_SUBMIT`.

## 12.3 Reuse existing ordinary charge-choice logic as planning helpers

The existing bot already knows how to choose damage/heal behavior for:

- INT;
- ANT;
- WIS;
- FAM.

Where practical, extract/refactor the decision-producing portion so it can return action payloads independently of the wrapper intent type.

Then:

- non-Ancient bots can continue wrapping those payloads in `ACTION`/`ACTIONS_SUBMIT`;
- Ancient bots can include the same payloads in `ordinaryChargeActions`.

This avoids duplicating charge strategy rules.

## 12.4 Unsupported foreign charge sources

Simulacrum can create unusual foreign fleet combinations.

Phase 17 does not require perfect strategy support for every theoretically copyable charged Basic on day one.

For copied ordinary charge powers not yet supported by generic bot planning:

- do not invent an invalid payload;
- leave them unused unless the authoritative declaration contract requires an explicit choice;
- add support later only when a real authored Ancient plan needs it.

The bot must still be able to submit a valid Ancient declaration and progress the game.

## 12.5 Declaration ID/nonce posture

The Ancient helper must generate stable bot declaration identity consistent with the existing bot nonce/idempotency posture.

The same authoritative game/turn/declaration context must not produce a different semantic declaration on retry.

---

# 13. Baseline Solar policy

## 13.1 Autocast is the baseline

Unless an authored manual rule makes a better/specific decision, Ancient bots should submit:

```text
autocastEnabled: true
```

The server then resolves the canonical current Autocast order:

```text
SSTA → SSUP → SCON → SLIF → SAST
```

## 13.2 Special Solar Powers are manual-only bot decisions

The following powers are outside Autocast and require explicit bot policy:

```text
SSIM — Simulacrum
SSIP — Siphon
SVOR — Vortex
SBLA — Black Hole
```

## 13.3 Baseline permission posture

Initial default Ancient behavior:

- `SSIP`: allowed as baseline when it beats the Autocast alternative;
- `SBLA`: allowed as baseline when affordable and the authored health-safety condition passes;
- `SVOR`: forbidden unless the selected plan explicitly allows Vortex;
- `SSIM`: forbidden unless the selected plan explicitly allows Simulacrum;
- remaining Energy: Autocast.

This keeps normal plans predictable and prevents every Ancient strategy from opportunistically drifting into Vortex/Simulacrum merely because enough blue Energy happens to exist.

## 13.4 Manual Solar ordering

The Ancient planner must construct Solar casts in a deliberate order because Energy is spent sequentially.

The exact plan-specific ordering may differ, but the default special-power posture should be conceptually:

```text
plan-required SSIM/SVOR decisions
→ guarded SBLA
→ SSIP if it improves the result
→ Autocast remainder
```

A plan may explicitly override this order when its strategy depends on reserving Energy for a particular special power.

---

# 14. Siphon decision model

## 14.1 Siphon should not fire merely because it is affordable

The intended baseline rule is:

> Cast Siphon only when the chosen Siphon spend produces a better combined Solar damage/healing outcome than simply Autocasting that Energy.

This is evaluated before final declaration submission.

## 14.2 Compare complete outcomes, not one isolated cast

For each legal equal green/red spend `X >= 4`:

1. calculate the authoritative Siphon effect amount using the current canonical formula;
2. subtract `X` green and `X` red from the candidate Energy pool;
3. compute the canonical mono-colour Autocast sequence for the remaining Energy;
4. compare:
   - candidate Siphon + candidate remaining Autocast;
   - baseline Autocast from the original Energy pool.

Use the same current Solar costs/formulas as the server implementation. Do not maintain a separate stale balance table in plan data.

## 14.3 Comparison scope

For this first bot version, the comparison is tactical Solar output for the current Battle:

- damage and healing both count as useful output;
- blue Convert output is unchanged by Siphon because Siphon spends only green/red, so it does not create a special cross-resource comparison problem;
- exact equal-score tie-breaking must be deterministic and may prefer the simpler Autocast path.

## 14.4 Strict improvement

If no legal Siphon spend strictly improves the evaluated result, do not manually cast Siphon.

Let Autocast handle the pool.

This prevents Siphon from being used merely because it is available.

---

# 15. Black Hole decision model

## 15.1 Baseline availability

Black Hole is a baseline Ancient tactical option rather than a plan-only feature.

The bot may manually cast `SBLA` when:

- it can afford 4 green, 4 red, and 4 blue at that ordered position;
- the selected plan's Black Hole policy permits it;
- the bot's health is not below the authored safety threshold.

The exact numeric health threshold is a tuning value, not an Ancient rules value. It should live in bot policy/configuration rather than the canonical Solar resolver.

## 15.2 Black Hole can be cast with fewer than two legal targets

Current server rules allow Black Hole to cast even when fewer than two valid Basic targets exist, including no valid targets.

The bot planner must respect that authoritative behavior.

It should provide exactly the legal target count currently required by the resolver and may still cast for Core damage when target count is zero.

## 15.3 Target ranking

When one or two valid Basic targets exist, choose targets using the existing tactical comparator:

1. highest total line cost;
2. most live remaining charges;
3. stable instance ID.

When multiple Black Holes are intentionally cast in one declaration, later casts must avoid targets already reserved by earlier Black Hole casts, matching the authoritative resolver's reservation semantics.

## 15.4 Repeat count

Baseline Phase 17 policy should support an authored maximum Black Hole cast count per declaration.

Default strategy may be conservative; exact per-plan cap remains a tuning decision.

Do not hardcode “always exactly one” into the rules helper if plan authoring may reasonably request more later.

---

# 16. Vortex and Simulacrum opt-in policy

## 16.1 Explicit plan gates

Vortex and Simulacrum must be disabled by default.

Conceptually, plans need explicit policy flags/sections equivalent to:

```text
allowVortex
allowSimulacrum
```

Absence means the bot does not manually cast that Solar Power.

## 16.2 Vortex

When Vortex is allowed:

- cast only when affordable after earlier plan-priority Solar reservations;
- the authoritative server computes damage from the current charge-scoped fleet state;
- the bot does not need to duplicate the type-count rule to apply damage;
- the bot may use current public fleet/type count for strategy comparison if needed.

For the first Vortex plans, repeated Vortex use may be represented by an authored maximum cast count.

The rough plan intent “cast 1x and 2x Vortex” can therefore be implemented as affordability plus a plan cap rather than a new state machine.

## 16.3 Simulacrum target eligibility remains authoritative

The server already owns:

- Basic-only targeting;
- snapshotted start-of-Battle target state;
- target line cost as blue Energy cost;
- copied charge state;
- copied permanent configuration;
- duplicate-target protection;
- queued next-turn materialisation;
- max-quantity reservations;
- Chronoswarm repetition where legally reachable.

The bot should only select from legal candidates and submit the target instance ID.

## 16.4 Simulacrum target ranking

For “copy highest value and most charges” behavior, use the existing tactical ranking shape:

1. highest total line cost;
2. highest captured/live relevant charges;
3. stable instance ID.

Additional filter:

- if a canonical Basic ship has a charge pool and its relevant snapshotted charge count is `0`, treat it as depleted and exclude it for the Simulacrum-heavy plan;
- a Basic ship that simply has no charge mechanic is not “depleted.”

## 16.5 Simulacrum fallback to Convert

If no legal/desirable Simulacrum target exists:

- do not submit a fake Simulacrum cast;
- leave blue Energy in the pool;
- keep `autocastEnabled: true`;
- canonical Autocast converts the remaining blue Energy through `SCON`.

No special Convert bot action is required.

---

# 17. Targeting and deterministic tactical comparators

## 17.1 Reuse existing comparator before inventing new ranking code

The current bot already has a deterministic tactical target comparator.

Phase 17 should extract/reuse it where practical rather than creating separate comparator implementations for:

- SPI;
- SBLA;
- SSIM;
- existing GUA/SAC/DOM behavior.

## 17.2 Stable tie-breaking is required

Every Ancient choice must remain replayable.

When tactical values tie, use stable canonical identifiers rather than random array order.

## 17.3 No hidden-information strategy input

Ancient bot target decisions may use authoritative server state available to the bot controller, but must respect the same game visibility/legality snapshots used by the canonical resolver.

Do not select Simulacrum/charge targets from hidden Drawing information that is not part of the relevant authoritative Battle snapshot.

---

# 18. Copied foreign ships, ordinary charges, Carrier, and upgrades

## 18.1 Copied ordinary charge ships

An Ancient bot can acquire foreign Basic Ships through Simulacrum.

If a copied Basic has a charge choice already supported by the generic bot system, reuse that policy inside the Ancient atomic declaration.

Examples may include supported damage/heal charge families.

## 18.2 Copied Carrier

A copied Carrier can later participate in the normal Drawing prelude.

For the Simulacrum-heavy plan, the desired Carrier posture is deterministic pseudo-random choice rather than a fixed Defender/Fighter bias.

Recommended first behavior:

- choose deterministically between legal non-Hold Carrier production choices from a stable game/turn/source seed;
- use Hold only when it is the only legal authoritative choice;
- never use uncontrolled runtime randomness.

This may be implemented as a small additional Carrier drawing-prelude policy mode.

## 18.3 Foreign upgrades

Current generic build legality already permits Ancient to upgrade legitimately owned copied foreign Basics.

The missing strategy feature is discovery/prioritization, not legality.

The Simulacrum-heavy plan may therefore receive a narrow policy equivalent to:

```text
opportunisticForeignUpgrades: true
```

When enabled:

- inspect the opponent-species upgrade definitions;
- consider only upgrades whose foreign component requirements are satisfied by the current/drafted Ancient fleet;
- use the generic planner/server for actual affordability and legality;
- select in deterministic authored or tactical priority order;
- do not manually build foreign Basics to complete an upgrade.

Exact first-version upgrade ranking may be finalized in the Simulacrum pass. It must remain deterministic and narrow.

## 18.4 Do not generalize foreign strategy prematurely

Only the Simulacrum-heavy plan currently requires opportunistic dynamic foreign upgrades.

Do not turn Phase 17 into a general cross-species strategy framework for all bots.

---

# 19. Initial Ancient plan catalogue

The first Ancient bot family contains eleven rough plans.

The plan identities and broad strategic shapes are part of Phase 17. Exact health thresholds, some group-switch conditions, and the two complex Simulacrum scripts remain tuning/content decisions that may be refined during their implementation pass without changing the architecture.

## 19.1 CUB-first family — four plans

### A. `anc_cube_red_green`

**Working name:** Simple Cube Red/Green

Opening:

```text
CUB
```

Then:

- build `MER` or `PLU` in groups of three according to the final health-based policy;
- use ordinary Ancient baseline Solar policy;
- no Simulacrum;
- no Vortex unless later explicitly added.

This plan needs the final deterministic health/group switch rule before authoring is complete.

### B. `anc_big_standard_econ`

**Working name:** Big Standard Econ

Core order:

```text
CUB
NEP, NEP
PLU, PLU, PLU
NEP, NEP
PLU, PLU, PLU
NEP, NEP
MER x6
```

Late loop:

- equal PLU/MER growth in groups of three;
- strong Siphon posture;
- Black Hole available through baseline policy.

### C. `anc_cube_quantum_solar_snowball`

**Working name:** Cube Quantum Solar Snowball

Core concept:

```text
CUB
QUA (fixed 6)
NEP
CUB
```

Then:

- choose among QUA/NEP growth toward max 6 and CUB growth toward max 4;
- add 3 PLU at the authored low-health threshold;
- after 6 QUA and 6 NEP, transition to pure SOL growth.

This plan is one of the main users of the generic priority/first-affordable build-step extension.

### D. `anc_vortex_no_simulacrum`

**Working name:** Vortex — No Simulacrum

Core order:

```text
CUB
NEP
SPI x3
NEP x2
MER x3
PLU x3
QUA (fixed 6)
SOL
```

Then:

- Vortex explicitly allowed;
- target progression should support one Vortex and later two Vortex casts when Energy permits;
- add more SOL after the initial shell;
- Simulacrum explicitly disabled.

## 19.2 NEP-first family — five plans

### E. `anc_small_econ_siphon`

**Working name:** Small Econ Siphon

Core order:

```text
NEP x2
```

Then:

- primarily MER and PLU growth;
- build toward high Siphon values;
- baseline Siphon-vs-Autocast comparison remains active.

### F. `anc_sol_reach_black_hole`

**Working name:** Sol Reach Black Hole

Core order:

```text
NEP x3
PLU x3 or x6 adaptively
SOL
MER x3
SOL, SOL, SOL ...
```

Intent:

- establish blue and green foundation;
- reach Black Hole while still retaining strong Autocast output;
- health-based rule chooses the 3-PLU vs 6-PLU posture;
- later mass SOL.

### G. `anc_sol_blue_snowball`

**Working name:** Sol Blue Snowball

Core opening:

```text
NEP x2
```

Then:

- repeatedly prefer SOL when affordable;
- otherwise build NEP until its cap;
- add PLU when the authored health/green-support condition requires it.

This plan is the clearest initial user of `first affordable from [SOL, NEP]`.

### H. `anc_vortex_simulacrum`

**Working name:** Vortex + Simulacrum

Rough order:

```text
NEP x3
SSIM copy goal(s)
PLU x2
MER x2
QUA (match effective dice)
SPI
SOL
PLU x3
NEP
MER x2
```

Policies:

- Vortex allowed;
- Simulacrum allowed;
- initial Simulacrum script aims at low-cost copy goals before normal Solar growth;
- Autocast remains fallback when no intended copy is legal.

The rough text “once on a two-cost, once on a three-cost” requires a precise staged goal definition during Pass 17E. The implementation must not guess whether the stop condition is after the first foreign materialisation or after both authored copy goals.

### I. `anc_silly_simulacrum`

**Working name:** Silly Simulacrum

Core opening:

```text
NEP x6
```

Then:

- use Simulacrum aggressively;
- choose highest-value, highest-charge legal Basic targets;
- never copy a depleted charged ship;
- if nothing desirable is legal, leave blue for Autocast/Convert;
- copied Carrier uses deterministic pseudo-random legal choices;
- later build `SPI x3`, `PLU x3`, then mass SOL;
- opportunistically complete legal foreign upgrades when copied components make them available.

The exact per-turn maximum number of Simulacrum casts remains a Pass 17E strategy decision and must be deterministic.

## 19.3 SPI threshold family — one plan

### J. `anc_spiral_aggro`

**Working name:** Spiral Into Aggro

Core order:

```text
SPI x3
MER forever
```

Behavior:

- use the third-Spiral First Strike through the generic target comparator;
- after the Spiral shell, pursue simple red aggro;
- no Vortex;
- no Simulacrum.

## 19.4 MER threshold family — one plan

### K. `anc_mer_aggro`

**Working name:** Simple Aggro

Build behavior:

```text
MER forever
```

This is intentionally the simplest Ancient bot plan and should be one of the first full-game validation targets.

## 19.5 Chooser family mapping

The initial threshold chooser maps exactly as follows:

```text
CUB family (4)
- anc_cube_red_green
- anc_big_standard_econ
- anc_cube_quantum_solar_snowball
- anc_vortex_no_simulacrum

NEP family (5)
- anc_small_econ_siphon
- anc_sol_reach_black_hole
- anc_sol_blue_snowball
- anc_vortex_simulacrum
- anc_silly_simulacrum

SPI family (1)
- anc_spiral_aggro

MER family (1)
- anc_mer_aggro
```

This 4 / 5 / 1 / 1 structure is deliberate and should be represented directly in the Ancient plan registry rather than inferred from plan names.

---

# 20. Recommended pass structure

Phase 17 should remain a compact multi-pass program. The intended implementation is **six main passes**, with public product enablement handled only after the separate Mission/Lore compatibility follow-up.

## Phase 17A — Ancient Bot Foundations and Strategy Registry

**Pass type:** Server Pass

**Goal:** Add Ancient as a bot-strategy species internally and establish the authored plan/chooser foundation without yet requiring full Ancient gameplay decisions.

### Includes

- extend server bot types/lookup posture for Ancient;
- add `ancientPlans.ts`;
- register the eleven stable plan IDs/families;
- add the deterministic threshold chooser as a pure/testable helper;
- support unresolved Ancient strategy before first Drawing;
- persist the final selected Ancient long-form plan once the chooser commits;
- add targeted tests for threshold bands, 33/67 and 20/80 deterministic buckets, and family selection.

### Does not include

- public client Ancient-opponent selection;
- QUA build payload support;
- Solar declaration logic;
- SSIM/Vortex logic.

### Why first

Everything else needs a stable Ancient plan identity and deterministic selection seam.

---

## Phase 17B — Ancient Build Planner Extensions, QUA, and Spiral

**Pass type:** Server Pass

**Goal:** Make the generic build system capable of executing ordinary Ancient plans correctly through Drawing and First Strike.

### Includes

- add the smallest generic priority/first-affordable ordered-build primitive required by the Ancient snowball plans;
- preserve existing ordered planner semantics elsewhere;
- add QUA permanent-selection policy types;
- append `quantumMysticSelections` to bot `BUILD_SUBMIT` payloads;
- support `fixed_6` and `match_effective_dice` QUA modes;
- extend First Strike bot targeting to SPI using the existing `highest_cost_basic` comparator;
- verify existing Cube behavior works unchanged for Ancient-created CUB;
- add tests for multiple QUA in one submit, immediate current-dice selection, max quantities, and third-SPI targeting.

### Does not include

- manual Solar strategy beyond allowing no-input phases to settle;
- public Ancient bot selection.

### Validation target

Simple MER/SPI/Cube shell fixtures can reach Battle phases with legal fleets and no build-payload rejection.

---

## Phase 17C — Atomic Ancient Charge Declaration and Baseline Solar Policy

**Pass type:** Server Pass

**Goal:** Make an Ancient bot capable of completing Charge Declaration through the real atomic Ancient contract.

### Includes

- add `ancientBotPlanner.ts` or equivalent focused helper;
- build valid `CHARGE_DECLARATION_SUBMIT` payloads;
- refactor/reuse generic ordinary charge decision helpers so supported copied charge ships can populate `ordinaryChargeActions`;
- default `autocastEnabled: true`;
- implement baseline Siphon-vs-Autocast evaluation;
- implement guarded Black Hole policy and target selection;
- keep Vortex and Simulacrum disabled unless plan-authorized;
- maintain stable declaration IDs/nonces and retry determinism;
- verify a declaration is one accepted bot step under the existing safety loop.

### Does not include

- advanced SSIM behavior;
- dynamic foreign upgrades;
- final tuning of all eleven plans.

### Validation target

At least Simple Aggro, Spiral Into Aggro, Small Econ Siphon, and one SOL/Black-Hole fixture can progress through repeated full turns without Ancient declaration rejection or deadlock.

---

## Phase 17D — Core Ancient Plan Authoring and Opening Integration

**Pass type:** Server Pass

**Goal:** Author and validate the non-Simulacrum Ancient plans against the completed chooser/build/Solar foundations.

### Initial target plans

- Simple Aggro;
- Spiral Into Aggro;
- Simple Cube Red/Green;
- Small Econ Siphon;
- Sol Reach Black Hole;
- Big Standard Econ;
- Sol Blue Snowball;
- Cube Quantum Solar Snowball;
- Vortex No Simulacrum.

### Includes

- translate rough sequences into `orderedBuildPlan` data;
- add only the narrow adaptive health thresholds required by the final authored behavior;
- finalize the MER/PLU group switch for Simple Cube Red/Green;
- finalize 3-vs-6 PLU behavior for Sol Reach Black Hole;
- tune priority-step usage for the snowball plans;
- enable Vortex only for the Vortex No Simulacrum plan;
- confirm each threshold chooser family can resolve to a functioning plan.

### Does not include

- Simulacrum plans;
- opportunistic foreign upgrades;
- public Ancient-opponent UI.

### Why separate

This gets most Ancient bot variety playable before the highest-complexity Simulacrum work.

---

## Phase 17E — Vortex + Simulacrum Advanced Strategy

**Pass type:** Server Pass

**Goal:** Add the explicitly opt-in Simulacrum strategy layer and finish the two complex Ancient plans.

### Includes

- explicit `allowSimulacrum`/Simulacrum policy representation;
- staged Simulacrum copy goals for Vortex + Simulacrum;
- highest-value/highest-charge target ranking for Silly Simulacrum;
- depleted charged-ship exclusion;
- deterministic no-target fallback to Autocast/Convert;
- deterministic copied-Carrier choice mode;
- plan-specific maximum Simulacrum casts where required;
- opportunistic legal foreign-upgrade strategy for Silly Simulacrum;
- Vortex interaction/ordering when the same plan also uses Simulacrum;
- full tests around target uniqueness, Energy spending order, copied charge state, copied permanent configuration, and foreign upgrade legality.

### Explicit review gate

Before implementation, lock the remaining two authored-content ambiguities:

1. exact completion rule for the “copy one 2-cost and one 3-cost” Vortex + Simulacrum script;
2. exact per-turn copy count policy for Silly Simulacrum.

These are strategy-authoring decisions, not architecture decisions.

---

## Phase 17F — Ancient Bot Full-Game Validation, Safety, and Cleanup

**Pass type:** Server Pass / narrow follow-up

**Goal:** Validate Ancient bots as a stable fourth server bot strategy species and remove temporary scaffolding before product enablement.

### Includes

- full plan-registry tests;
- deterministic chooser replay tests;
- multi-turn bot runner tests across representative plans;
- verify eight-step bot safety cap remains sufficient with atomic Ancient declarations;
- verify no GET/read path triggers bot execution;
- verify retries/idempotency do not produce different Ancient declarations;
- verify unsupported copied foreign charge sources do not deadlock the phase;
- verify build/dice/First Strike/Charge Declaration loops settle normally;
- verify bot debug events remain useful and do not hide repeated rejection loops;
- remove any temporary implementation-only plan IDs or test hooks;
- reconcile the Phase 17 planning document if implementation required a small approved deviation.

### Completion posture

After 17F, Ancient bot strategy is considered implemented on the server.

Normal product selection is still intentionally gated on the Mission/Lore compatibility follow-up described in Section 24.

---

# 21. Validation strategy

## 21.1 Standard server checks

Each server pass should run the relevant repository checks, normally including:

```text
deno check src/supabase/functions/server/index.tsx
deno task check
```

plus focused bot/Ancient tests.

## 21.2 Pure chooser tests

Test the opening chooser independently from full games.

Coverage:

- line total `9+` enters CUB family;
- `7` and `8` enter NEP family;
- `6` produces deterministic 33/67 branch behavior across representative seeds;
- `4` and `5` produce deterministic 20/80 branch behavior;
- a save leaves strategy unresolved;
- later higher available lines re-evaluate and can commit;
- once committed, later line totals do not change the selected long-form plan.

## 21.3 Build tests

Cover:

- simple repeated MER plan;
- repeated/group entries;
- first-affordable SOL/NEP behavior;
- QUA fixed-6 selection;
- QUA current-effective-dice selection;
- multiple QUA selection ordering;
- max-quantity caps;
- low-health adaptive insertion;
- foreign-upgrade legality unchanged.

## 21.4 Cube tests

Confirm Ancient CUB uses the existing chooser:

- higher Cube beats lower Main;
- higher Main beats lower Cube;
- equal Cube/Main chooses Cube.

No new Ancient-specific result interpretation should be required.

## 21.5 Spiral tests

Cover:

- no action before the third-Spiral built-turn trigger exists;
- third Spiral selects the highest-cost legal Basic;
- charge tie-break is respected;
- stable instance tie-break is deterministic;
- no legal target does not deadlock.

## 21.6 Atomic declaration tests

Cover at minimum:

- zero manual special casts + Autocast;
- Siphon chosen when strictly superior;
- Siphon skipped when not superior;
- Black Hole with two targets;
- Black Hole with one target;
- Black Hole with zero targets;
- supported copied ordinary charge action included atomically;
- invalid declaration does not partially mutate state;
- retry/idempotent submission remains stable.

## 21.7 Simulacrum tests

Cover:

- Basic-only target selection;
- highest-value/highest-charge ranking;
- depleted charged target exclusion;
- duplicate target avoidance;
- max-quantity rejection avoidance;
- copied charges/configuration survive through the canonical Simulacrum system;
- no target falls back to blue Convert through Autocast;
- copied Carrier deterministic choice;
- legal foreign upgrade discovery never builds illegal foreign Basics.

## 21.8 Full-game bot runner tests

Representative plans should be run through multi-turn server fixtures until one of:

- game finishes;
- the fixture reaches a defined later-turn checkpoint;
- a test-specific guard proves repeated phase settlement.

At minimum include:

- Simple Aggro;
- Spiral Into Aggro;
- one Cube plan;
- one Siphon/econ plan;
- one Black Hole/SOL plan;
- one Vortex plan;
- Silly Simulacrum.

The goal is not to prove balance. It is to prove legal deterministic progression.

---

# 22. Risks, tuning points, and deliberately open content decisions

Phase 17 has several strategy values that should remain authorable rather than being disguised as rules.

## 22.1 Black Hole health safety threshold

The mechanism is locked; the exact threshold is not.

It should be tuned from gameplay and stored in bot policy.

## 22.2 MER vs PLU group switch

Simple Cube Red/Green still needs the exact health comparison that decides which three-ship group to pursue.

Do not guess this during infrastructure passes.

## 22.3 Sol Reach 3 vs 6 PLU threshold

The rough plan requires an adaptive choice between three and six PLU.

The exact health condition remains a plan-tuning value.

## 22.4 Sol Blue Snowball “add PLU if needed”

The exact “needed” condition must become a deterministic authored threshold before the plan is finalized.

## 22.5 Cube Quantum Solar priority details

The architecture supports QUA/NEP/CUB caps and low-health PLU insertion, but exact priority among available QUA/NEP/CUB choices should be finalized during 17D.

## 22.6 Vortex + Simulacrum two-copy script

The rough plan currently says:

```text
SSIM once on a two-cost, once on a three-cost
(if available, autocast if not, once foreign ships in fleet don't cast again)
```

That wording contains an ambiguity because the first copied ship materializes before a later copy goal may be completed.

Pass 17E must lock whether:

- both staged copy goals should be attempted before Simulacrum stops; or
- materializing the first foreign ship ends the Simulacrum stage.

Do not silently choose one in code.

## 22.7 Silly Simulacrum repeat count

The rough plan says “copy whatever is highest value and most charges.”

It does not yet specify whether the bot should:

- copy one target per Battle;
- cast Simulacrum repeatedly on distinct targets until blue is exhausted;
- use an authored maximum greater than one.

This must be locked before 17E implementation.

## 22.8 Foreign upgrade priority

“Make foreign upgrades if any are available” requires deterministic ordering when multiple upgrades are legal.

The first version may use an authored list or a tactical comparator such as highest total line cost then stable ship ID. The implementation pass should choose one explicitly and test it.

## 22.9 Balance tuning is not architecture churn

The following may be tuned after real games without redesigning Phase 17:

- health thresholds;
- per-plan special-power caps;
- exact build group ordering;
- plan family array order/weights if intentionally revised;
- Simulacrum copy script details.

Plan tuning should remain data-oriented wherever possible.

---

# 23. Completion criteria

Phase 17 server bot work is complete when all of the following are true:

- Ancient exists as a supported server bot strategy species;
- an Ancient bot can begin with an unresolved opening chooser;
- the chooser deterministically resolves from authoritative available lines or intentionally saves/reassesses;
- the final selected plan is durable and not inferred from fleet shape;
- all eleven Ancient plan IDs are registered;
- the generic build planner can execute the required Ancient ordered/priority behavior;
- QUA builds always include valid permanent selections;
- CUB uses the existing highest-dice/tie-to-Cube behavior;
- third-Spiral First Strike targets legally and deterministically;
- Ancient Charge Declaration uses one valid atomic `CHARGE_DECLARATION_SUBMIT`;
- supported copied ordinary charge choices can be included in that atomic declaration;
- baseline Autocast is enabled correctly;
- Siphon is used only when its evaluated outcome beats the Autocast alternative;
- Black Hole obeys affordability, health policy, and legal target count;
- Vortex and Simulacrum never fire unless explicitly enabled by the selected plan;
- Simulacrum-heavy behavior remains deterministic and respects canonical target/copy rules;
- copied Carrier and foreign-upgrade behavior do not introduce client authority or illegal builds;
- representative multi-turn Ancient bot fixtures settle without deadlock;
- the existing eight-step bot safety posture remains healthy or any required change is separately justified;
- normal Human/Xenite/Centaur bot behavior remains unchanged except for deliberate generic helper reuse.

---

# 24. Public Play Computer and Mission/Lore follow-up gate

## 24.1 Why public enablement is separate

The current normal Play Computer species contract and UI allow the computer to be:

```text
Human
Xenite
Centaur
```

Phase 15 Mission content currently assumes the same opponent-species set.

Making Ancient publicly selectable as the computer therefore creates four new directional Mission pools:

```text
Human → Ancient
Xenite → Ancient
Centaur → Ancient
Ancient → Ancient
```

The current Mission/Lore work also has pending design decisions around:

- reverse Ancient-matchup contribution to the existing Ancient-secrets finding;
- a new Ancient-vs-Ancient / Watcher finding;
- related Mission story/lore content.

Those decisions were deliberately deferred until Ancient bots existed.

## 24.2 Locked Phase 17 posture

Do not solve that narrative/meta-game work inside the Ancient bot engine passes.

Therefore:

- Phase 17A–17F implement and validate Ancient bot strategy server-side;
- normal public/client `ComputerBotSpeciesId` remains unchanged during those passes;
- the existing production computer-species picker remains Human/Xenite/Centaur;
- tests may construct Ancient bot controller state directly as needed;
- after Phase 17F, return to the Mission/Lore pass and add the required Ancient-opponent content/findings behavior;
- only then run a narrow Mixed enablement pass that widens the server `ComputerBotSpeciesPayload`, client `ComputerBotSpeciesId`, desktop/mobile species options, and related tests to include Ancient.

This keeps bot engineering independent from narrative content while still giving a clear path to product enablement.

## 24.3 No architecture redesign should be required at enablement

If Phase 17 is implemented correctly, the later enablement pass should be small:

- widen species unions/mappers;
- expose Ancient in desktop/mobile computer selection;
- allow deterministic Ancient strategy initialization;
- rely on the already-implemented Ancient runner/plans;
- rely on the already-updated Mission/Lore matrix.

The difficult work belongs in Phase 17, not in the final UI switch.

---

# 25. Bottom line

Ancient bots should remain in the same architectural stream as the existing Shapeships bots.

The correct implementation is not a new AI subsystem. It is:

- one Ancient authored plan registry;
- one deterministic deferred opening chooser;
- one small generic build-priority extension;
- QUA payload completion;
- SPI target reuse;
- one Ancient-specific atomic declaration planner;
- baseline Siphon/Black Hole intelligence;
- explicit Vortex/Simulacrum plan gates;
- a later focused Simulacrum/foreign-upgrade pass.

Most existing bot machinery remains intact:

- server-side event-driven execution;
- `applyIntent` for gameplay actions;
- ordered build planning;
- adaptive health rules;
- authoritative affordability and foreign-upgrade legality;
- Cube choice;
- target comparators;
- deterministic plan data;
- the eight-step runner safety cap.

The recommended Phase 17 program is six server-focused passes, followed by the already-planned Mission/Lore compatibility work and a small final product-enablement pass.

That is enough structure for Ancient bots without turning the feature into a sprawling twenty-pass phase or a second game engine.
