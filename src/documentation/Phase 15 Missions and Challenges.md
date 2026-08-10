# Phase 15 — Missions & Challenges

## Normative Planning and Pass-Decomposition Document

- **Status:** Normative implementation roadmap
- **Phase type:** Product/meta-game feature; not a new turn phase
- **Primary mode:** Play Computer only
- **Architecture baseline:** Current server-authoritative repository
- **Current-code authority:** Executable code is the source of truth for implementation details
- **Last audited against supplied codebase:** 2026-08-10

---

## Contents

1. Status and authority
2. Purpose
3. Locked product model
4. Scope and non-goals
5. Current repository facts relevant to Phase 15
6. Mission content model
7. Matchup matrix and initial writing scope
8. Challenge model
9. Challenge ship eligibility
10. Assignment and randomness
11. Canonical Mission & Challenge state
12. Intro flow and clock pause
13. Mission intro acknowledgement
14. Minimize Missions session preference
15. First-turn helper interaction
16. Client/runtime contract
17. Mission & Challenge presentation
18. Ship reference behavior and pluralization
19. In-game reopen behavior
20. End-of-game evaluation
21. End-of-game presentation
22. Time-control preset adjustment: 5+0 → 5+3
23. Visibility and spectator posture
24. Content-authoring workflow
25. Recommended implementation sequence
26. Validation strategy
27. Risks and review gates
28. Completion criteria
29. Deferred design decisions
30. Bottom line

---

# 1. Status and authority

## 1.1 Planning status

This document is the normative Phase 15 planning baseline for Missions & Challenges.

It defines the product behavior, ownership boundaries, data model, clock interaction, and recommended implementation sequence.

Implementation must still proceed through separately approved scoped Codex passes. Each pass should inspect the live repository and present a concrete file plan before editing.

## 1.2 Source precedence

For Phase 15 implementation, use this order:

1. Current executable codebase.
2. Current architecture/contracts and repository agent rules.
3. Locked decisions in this Phase 15 document.
4. Current active Rules documentation where relevant.
5. Historical phase planning records only as implementation history.

Do not restore or preserve obsolete behavior merely because an older planning document describes it.

## 1.3 Architectural stance

Shapeships remains server-authoritative.

The server owns:

- Mission & Challenge assignment;
- canonical persistence of the assignment;
- authoritative intro-pending state;
- clock-live gating;
- challenge eligibility inputs;
- final challenge evaluation against the authoritative final fleet;
- final mission/challenge result derivation.

The client runtime owns:

- networking through the existing session/intent seam;
- local session preference for minimizing future mission intros;
- automatic intro acknowledgement when that preference is already enabled;
- view-model projection and UI orchestration.

Display owns:

- modal/overlay presentation;
- hover/tap inspection;
- close/open state;
- checkbox interaction;
- postgame visual treatment.

Display must not evaluate final challenge success or directly mutate canonical Mission & Challenge state.

---

# 2. Purpose

Phase 15 adds a lightweight narrative and optional-objective layer to Play Computer games.

Every Play Computer game receives:

1. exactly one matchup-specific **Mission**; and
2. exactly one randomly assigned **Optional Challenge**.

The two are presented together as one Mission & Challenge experience.

The feature is intended to:

- give computer games more identity and replay variety;
- create matchup-specific fiction without changing gameplay rules;
- give players an optional fleet-building constraint to pursue;
- reuse the existing ship catalogue/rules presentation rather than creating duplicate ship content;
- support community-authored Mission stories later through simple content entries;
- remain completely absent from multiplayer gameplay.

Phase 15 does not add a campaign, progression system, rewards system, achievements system, or new turn phase.

---

# 3. Locked product model

The following product decisions are locked.

## 3.1 One Mission and one Challenge

Every Play Computer game has:

- one Mission;
- one Optional Challenge.

Neither is accepted or declined.

The player simply presses **PLAY** to begin normal interaction with the game.

## 3.2 Play Computer only

Missions & Challenges exist only in games with a bot-controlled opponent seat.

They do not appear in normal multiplayer games.

## 3.3 Mission is narrative only

A Mission contains narrative content and has no gameplay effects.

Mission success means:

> the human player won the game.

## 3.4 Challenge is optional and non-authoritative to gameplay rules

A Challenge does not change:

- build legality;
- ship rules;
- combat;
- bot behavior;
- phase progression;
- victory conditions;
- rewards.

It is an optional condition evaluated only against the finished match.

## 3.5 Final-fleet condition only

Challenge success is based on the player's **active final fleet at game end**.

The game does not care whether the target ship:

- was built earlier and later destroyed;
- was once owned and later lost;
- was acquired by transfer/steal;
- existed temporarily during the game.

Only the authoritative active fleet at the terminal game state matters.

## 3.6 Win required

Challenge success requires both:

1. the human player won; and
2. the final fleet satisfies the assigned WITH/WITHOUT condition.

A player who loses or draws does not complete the Optional Challenge even if the fleet condition itself happens to be true.

## 3.7 No per-ship challenge writing

Phase 15 does not introduce authored challenge descriptions for individual ships.

The selected ship's existing canonical reference/rules presentation provides ship information.

The only generated challenge instruction is conceptually:

- **Win with {plural ship name}**; or
- **Win without {plural ship name}**.

---

# 4. Scope and non-goals

## 4.1 In scope

- Server-owned Mission content registry/pools.
- Directional matchup-specific Mission assignment.
- One durable Mission assignment per Play Computer game.
- One durable Optional Challenge assignment per Play Computer game.
- Any fleet-capable ship from the human player's species as a challenge target.
- WITH / WITHOUT challenge condition.
- Server-authoritative `introPending` behavior.
- Server-authoritative clock pause while the intro is pending.
- A small server-backed intro acknowledgement through the normal client networking seam.
- A session-only `Minimize Missions` preference, default OFF.
- Automatic acknowledgement on later computer games when minimization was already enabled.
- Initial Mission & Challenge modal/overlay after species selection.
- In-game Menu reopen action.
- Desktop and mobile presentation.
- Existing ship-reference hover/tap reuse.
- Endgame Mission & Challenge button and result overlay.
- Final Mission and Challenge result derivation.
- Deferring the first-turn green build helper until the intro has completed.
- Replace the selectable 5+0 time-control preset with 5+3.
- Static invitation to submit Mission ideas through the existing Discord community path / `#shapeships` or DM.

## 4.2 Out of scope

- Multiplayer Missions & Challenges.
- Challenge acceptance/decline UI.
- Challenge gameplay modifiers.
- Rewards, XP, unlocks, currency, badges, leaderboards, or progression.
- Bot strategy changes based on a challenge.
- Campaign ordering or persistent story progression.
- Branching narrative choices.
- Per-ship authored challenge prose.
- Duplicated ship-rule text in Mission content.
- Ancient Solar Powers as challenge targets.
- Mid-game challenge re-rolling.
- A new `setup.mission` or other global turn phase.
- A second networking seam for Mission actions.
- A generic mission scripting engine.
- A generalized achievements framework.
- Final endgame button/marker styling; that design is explicitly deferred.

---

# 5. Current repository facts relevant to Phase 15

The supplied current codebase establishes several useful seams.

## 5.1 Computer-game species selection already resolves both sides together

During `SPECIES_SUBMIT`, a human in a computer game supplies:

- their own species; and
- the computer species.

The server then sets the bot species and chooses a deterministic bot plan before advancing out of species selection.

This is the correct authoritative seam for Mission & Challenge assignment because both matchup directions are known there.

## 5.2 Computer-game controller metadata already exists

Computer games use `controllersByPlayerId` with:

- human controller metadata for the player seat; and
- bot controller metadata for the computer seat.

Phase 15 should use that existing controller truth to identify Play Computer games rather than infer computer mode from player names.

## 5.3 Current clocks become live after species selection and Turn 1

The current clock helper considers clocks live once:

- exactly two player seats exist;
- both species are confirmed; and
- `turnNumber >= 1`.

Phase 15 must extend that server-authoritative clock-live condition so a pending Mission intro pauses the clock without inventing UI-side clock behavior.

## 5.4 Play Computer and private multiplayer share the setup time-control panel

The current `CreatePrivateGamePanel` is reused for Play Computer setup.

The lowest selectable preset is currently 5+0 in both the client preset list and the server whitelist.

The Phase 15 clock-adjacent cleanup replaces that selectable preset with 5+3.

## 5.5 Session-scoped UI preference precedent exists

The current Battle Log preference uses `window.sessionStorage` and a versioned Shapeships key.

Phase 15 should use the same general session-only posture for minimizing Mission intros.

## 5.6 Ship-name pluralization already exists

The current codebase already has mirrored server/client ship-name pluralization helpers, including special handling for names such as:

- `Ship of ...` → `Ships of ...`;
- `Ark of ...` → `Arks of ...`;
- normal `y`, `s`, `x`, `z`, `ch`, and `sh` plural cases.

Phase 15 must reuse this existing behavior rather than add Mission-specific plural rules.

## 5.7 Standard ship reference presentation already exists

The current client already derives ship reference information through the existing ship rules adapter and hover-card family.

Phase 15 should reuse that reference presentation for the selected challenge ship rather than authoring separate rules content.

## 5.8 First-turn build helper already has centralized eligibility at GameScreen

The first-turn green helper is currently driven from shared GameScreen eligibility and presented on desktop/mobile.

Phase 15 should suppress eligibility while the Mission intro is pending, then allow the existing helper to appear normally after PLAY/acknowledgement.

---

# 6. Mission content model

## 6.1 Mission stories are authored data

Mission stories must be plain authored data rather than imperative code.

Recommended semantic shape:

```ts
type MissionStory = {
  id: string;
  playerSpecies: 'human' | 'xenite' | 'centaur' | 'ancient';
  opponentSpecies: 'human' | 'xenite' | 'centaur';
  title: string;
  location: string;
  author: string;
  paragraphs: string[];
};
```

Exact type/file names may follow repository conventions.

## 6.2 Year is global

Mission year is always:

```text
2814
```

Do not require the author to repeat `2814` in every Mission story record.

Treat it as fixed Phase 15 presentation/content metadata unless a later narrative decision changes it.

## 6.3 Stable IDs

Every Mission story requires a stable unique ID.

IDs must remain stable once shipped so an assigned game can continue referring to the same story.

## 6.4 Player-name token

Mission prose may use one narrow supported player-name token.

Example conceptual token:

```text
[player]
```

or an equivalent explicit syntax chosen during implementation.

Do not create a general templating language in Phase 15.

## 6.5 Author field

Every Mission story has an `author` field.

This supports:

- first-party stories;
- future community-contributed Mission stories;
- visible attribution in the Mission header.

## 6.6 Submission invitation is UI copy, not story data

The footer invitation to submit Mission ideas is static product UI.

It should not be copied into every Mission record.

The current design intent is equivalent to:

> Have a mission idea? Share it on Discord #shapeships or DM juddly.

Reuse the existing Shapeships Discord destination/pattern rather than inventing a separate community URL.

---

# 7. Matchup matrix and initial writing scope

## 7.1 Direction matters

Mission pools are directional.

A Mission written from a Human player's perspective against Xenites belongs to a different pool from a Mission written from a Xenite player's perspective against Humans.

`Human → Xenite` and `Xenite → Human` are separate pools.

## 7.2 Current Play Computer matchup matrix

The current human player may select:

- Human;
- Xenite;
- Centaur;
- Ancient.

The current bot may select:

- Human;
- Xenite;
- Centaur.

Therefore the current Phase 15 matrix has **12 directional matchup pools**:

| Player | Computer | Pool |
|---|---|---|
| Human | Human | H → H |
| Human | Xenite | H → X |
| Human | Centaur | H → C |
| Xenite | Human | X → H |
| Xenite | Xenite | X → X |
| Xenite | Centaur | X → C |
| Centaur | Human | C → H |
| Centaur | Xenite | C → X |
| Centaur | Centaur | C → C |
| Ancient | Human | A → H |
| Ancient | Xenite | A → X |
| Ancient | Centaur | A → C |

## 7.3 Initial content target

Phase 15 may launch/test with exactly **one authored Mission story per current matchup pool**.

Initial writing requirement:

> 12 Mission stories.

The system must support adding more stories to any pool later without changing assignment architecture.

## 7.4 Future Ancient bot support

If Ancient later becomes a supported computer species, the full four-species directional matrix becomes 16 pools.

That future expansion must not require redesigning Phase 15.

---

# 8. Challenge model

## 8.1 Assignment shape

Each game receives one challenge with:

```ts
type MissionChallengeCondition = 'with' | 'without';

type ShipChallenge = {
  shipDefId: ShipDefId;
  condition: MissionChallengeCondition;
};
```

Exact naming may follow server conventions.

## 8.2 Player species only

The challenge ship is selected only from eligible fleet ships belonging to the **human player's chosen species**.

Examples:

- Human player → Human challenge ship;
- Xenite player → Xenite challenge ship;
- Centaur player → Centaur challenge ship;
- Ancient player → Ancient fleet ship.

The opponent's species does not affect the challenge-ship pool.

## 8.3 WITH

`with` means:

> At least one active instance of the selected ship definition exists in the human player's final authoritative fleet.

## 8.4 WITHOUT

`without` means:

> Zero active instances of the selected ship definition exist in the human player's final authoritative fleet.

## 8.5 Optional means no gameplay obligation

The player is never blocked from:

- building the target ship in a WITHOUT challenge;
- failing to build the target ship in a WITH challenge;
- ignoring the challenge entirely.

No legality or warning system should enforce the objective.

---

# 9. Challenge ship eligibility

## 9.1 Locked semantic rule

A Phase 15 challenge may target **any canonical fleet-capable ship definition belonging to the human player's species**.

This includes:

- Basic ships;
- Upgraded ships;
- Xenite `Basic - Evolved` ships;
- Ancient Basic fleet ships.

It excludes:

- Ancient Solar Powers;
- any future canonical definition that cannot exist as a normal fleet ship at game end.

## 9.2 Current eligible counts

The supplied current definition set contains:

| Species | Eligible fleet ships |
|---|---:|
| Human | 15 |
| Xenite | 17 |
| Centaur | 15 |
| Ancient | 7 |
| **Total** | **54** |

The Ancient definition set also contains 9 Solar Powers. Those are not challenge targets.

## 9.3 Derive from canonical server definitions

The server must derive challenge eligibility from canonical ship definitions rather than maintain a manually duplicated 54-ID challenge list unless code inspection proves an explicit list is safer.

The semantic filter is fleet-capability, not merely a specific pair of string labels such as `Basic | Upgraded`.

Current `Basic - Evolved` and Ancient behavior must be preserved.

## 9.4 Future-proofing

If new ship types are introduced later, do not automatically make a non-fleet definition challenge-eligible merely because it lives in the same definitions file.

The locked rule remains:

> Can this definition legitimately exist in the player's active fleet at game end?

---

# 10. Assignment and randomness

## 10.1 Assignment timing

Mission & Challenge assignment occurs once the human player's `SPECIES_SUBMIT` in a Play Computer game establishes both:

- the human species; and
- the computer species.

This is the same authoritative decision seam where current code establishes the bot species/plan.

## 10.2 Assignment happens once

A game receives one durable assignment.

The following must not reroll it:

- repeated/idempotent species submission;
- refresh;
- polling;
- reopening the Mission & Challenge modal;
- switching desktop/mobile layouts;
- minimizing Missions;
- game completion.

## 10.3 Controlled deterministic selection

Selection should be deterministic from stable game/matchup input so retries cannot produce a different assignment.

Recommended posture:

- use the game ID plus explicit independent salts/keys;
- choose Mission story from the directional matchup pool;
- choose challenge ship from the human-species eligible fleet list;
- choose WITH/WITHOUT independently.

This mirrors the current codebase's preference for deterministic authored bot-plan selection.

The exact hash/helper implementation is not locked, but randomness must be explicit, controlled, and stable for the game.

## 10.4 WITH/WITHOUT weighting

Phase 15 should treat WITH and WITHOUT as an unbiased binary choice unless a later balance/content decision explicitly introduces weighting.

## 10.5 No reroll button

There is no player-facing reroll interaction in Phase 15.

---

# 11. Canonical Mission & Challenge state

## 11.1 Recommended semantic state

A computer game should persist one canonical assignment conceptually equivalent to:

```ts
type MissionChallengeAssignment = {
  playerId: string;
  missionId: string;
  challenge: {
    shipDefId: ShipDefId;
    condition: 'with' | 'without';
  };
  introPending: boolean;
};
```

Exact field placement and naming should follow current server state conventions after inspection.

## 11.2 Store assignment, not duplicated challenge copy

Canonical state should persist stable assignment identifiers/data needed for behavior.

Do not persist generated UI strings such as:

```text
Win without Tactical Cruisers
```

The client can compose display copy from:

- the stored condition;
- the canonical ship definition; and
- the existing pluralization helper.

## 11.3 Mission content resolution

Mission content should have one authoritative authored registry.

Preferred posture:

- server owns the Mission pool/content used for assignment;
- canonical assignment stores the stable `missionId`;
- the requester projection resolves the matching Mission content for the human player.

Do not create a separately maintained client Mission-content mirror unless implementation proves it necessary.

## 11.4 Requester DTO, not broad raw-state leakage

Canonical Mission & Challenge state must not accidentally become public merely because current `/game-state` still has migration-era broad response families.

The game-state projection should deliberately expose Mission & Challenge data to the relevant human requester through the normalized requester-facing seam.

The bot does not need it.

---

# 12. Intro flow and clock pause

## 12.1 No new turn phase

The Mission intro is not a canonical phase.

Do not add:

- `setup.mission`;
- `build.mission`;
- a Mission phase key;
- Mission readiness to `PHASE_SEQUENCE`.

Normal phase progression continues.

## 12.2 Normal opening game work may proceed behind the intro

After species selection resolves:

- the server may advance through the normal opening work;
- the bot may perform its normal automatic actions;
- the game may arrive at the normal first Drawing state;
- the computer may already appear Ready behind the Mission modal.

This matches the intended design.

## 12.3 Clock must remain paused

While the human player's Mission intro is pending:

> server-authoritative chess clocks do not accrue.

This must be implemented by extending the existing server clock-live condition, not by visually freezing the client timer while server time continues to run.

## 12.4 Pause both seats through the existing clock-live contract

The intro is a match-level opening gate.

While `introPending === true`, the current clock helper should report clocks as not live and keep its timestamp fresh so acknowledgement does not back-charge elapsed reading time.

## 12.5 Untimed games

Untimed games have no clock to pause, but still use the same Mission intro/acknowledgement state.

---

# 13. Mission intro acknowledgement

## 13.1 PLAY has one small server-backed responsibility

The initial **PLAY** button acknowledges the pending Mission intro.

It does not:

- accept the Optional Challenge;
- modify gameplay rules;
- advance a turn phase;
- Ready the player;
- submit a build;
- change the bot plan.

It only clears the authoritative intro gate.

## 13.2 Use the existing intent/networking seam

The acknowledgement should travel through the existing client runtime and authoritative intent/persistence path.

Do not create a display-owned fetch call or second networking seam.

A dedicated small intent such as conceptually:

```text
MISSION_INTRO_ACK
```

is preferred, subject to concrete implementation planning against the current reducer.

## 13.3 Idempotent

Acknowledgement must be idempotent.

Repeating it after the intro is already acknowledged should not corrupt state, reroll assignment, or fail the game.

## 13.4 Human seat only

Only the human-controlled player seat for that computer game may acknowledge the intro.

The bot must never clear the player's intro gate.

## 13.5 Prevent free gameplay under a paused clock

While intro is pending, the human player must not be able to submit gameplay actions under the paused clock by bypassing the UI.

The server must reject or otherwise gate ordinary human gameplay intents until acknowledgement has cleared `introPending`.

This gate must be narrow:

- it exists only for the human player in a computer game;
- it must not stop the bot's normal server-side actions;
- it must not become a new phase system.

Administrative/terminal exceptions, if any are needed by the current reducer, should be decided narrowly during the server pass. The core requirement is that the player cannot play the game for free while the clock is paused.

## 13.6 Refresh safety

If the browser refreshes before PLAY:

- assignment remains the same;
- `introPending` remains true;
- clock remains paused;
- the Mission modal appears again.

---

# 14. Minimize Missions session preference

## 14.1 Session-only preference

The checkbox is a browser-session preference only.

Recommended key:

```text
shapeships.minimizeMissions.v1
```

Exact key spelling may change slightly to match nearby conventions, but it must be versioned and session-scoped.

## 14.2 Default OFF

If no stored preference exists:

```text
Minimize Missions = OFF
```

The first applicable Mission intro is shown.

## 14.3 Meaning

When enabled, the preference means:

> On future Play Computer games in this browser session, do not automatically show the opening Mission modal.

The underlying Mission & Challenge assignment still exists.

## 14.4 Current modal still requires PLAY

Checking `Minimize Missions this session` on the currently visible intro does not itself dismiss that intro.

The player still presses PLAY for the current game.

The preference applies to later computer-game intros in the same browser session.

## 14.5 Automatic acknowledgement on later games

If the client loads a later computer game and:

- a Mission assignment exists;
- `introPending === true`; and
- the session preference is already ON;

then the client runtime should automatically submit the normal Mission intro acknowledgement.

The server remains authoritative and keeps the clock paused until that acknowledgement is accepted.

## 14.6 Failure fallback

If automatic acknowledgement fails or cannot be confirmed:

- do not silently leave the player in a paused hidden state;
- show the Mission intro;
- let the player press PLAY normally.

## 14.7 Reopen remains available

Minimization never removes Mission & Challenge from:

- the in-game Menu; or
- the end-of-game surface.

---

# 15. First-turn helper interaction

## 15.1 Green helper waits for Mission intro

The existing first-turn green helper beginning with:

> The dice gives lines to both players.

must not compete with the initial Mission modal.

While `introPending === true`, its eligibility is suppressed.

## 15.2 Normal behavior resumes after acknowledgement

After PLAY/acknowledgement:

- the Mission intro closes;
- the first-turn helper becomes eligible through its existing behavior;
- its existing delay, fade, dismiss, desktop/mobile behavior, and Ready interaction remain unchanged.

Do not redesign the helper as part of Phase 15.

## 15.3 Minimized games

If a future Mission intro is auto-acknowledged because minimization is enabled, the first-turn helper appears only after acknowledgement is accepted.

---

# 16. Client/runtime contract

## 16.1 Central VM

The client runtime should expose one Mission & Challenge view-model surface usable by desktop and mobile.

Conceptually it needs:

- whether the current viewer has a Mission & Challenge;
- Mission story fields;
- challenge ship ID;
- challenge condition;
- whether intro is pending;
- whether the game is finished;
- final Mission success where available;
- final Challenge success where available.

Exact type names should follow the current `gameSession/types.ts` structure.

## 16.2 Central action callback

Display should receive a callback for intro acknowledgement rather than calling the server directly.

## 16.3 Session preference helper

Avoid spreading `sessionStorage` reads/writes across several display files.

A small client helper/hook is preferred for:

- reading the default OFF preference;
- persisting changes;
- handling unavailable storage gracefully;
- driving automatic acknowledgement.

Do not turn `useGameSession` into a broad settings subsystem merely for this feature.

## 16.4 Desktop/mobile share truth

Desktop and mobile Mission & Challenge surfaces consume the same VM and callbacks.

Do not create separate mobile mission logic.

---

# 17. Mission & Challenge presentation

## 17.1 Initial modal hierarchy

The current design establishes this hierarchy:

1. `YOUR MISSION` label;
2. metadata row:
   - YEAR 2814;
   - LOCATION;
   - AUTHOR;
3. large Mission title;
4. Mission paragraph(s);
5. challenge ship graphic;
6. `OPTIONAL CHALLENGE` label/icon;
7. WITH/WITHOUT challenge instruction;
8. large PLAY button;
9. secondary footer containing:
   - Mission-idea submission invitation;
   - `Minimize Missions this session` checkbox.

The exact dimensions may be refined during UI implementation.

## 17.2 Modal blocks gameplay interaction

While the initial intro is pending:

- gameplay controls behind it are not interactable;
- the board may remain visible;
- normal live state may continue updating;
- PLAY is the intended entry into normal player interaction.

## 17.3 Do not over-darken by default

The supplied design keeps the game visible behind the Mission container.

Do not assume a full-screen opaque takeover is required unless responsive/mobile implementation proves it necessary.

## 17.4 Content overflow

Mission stories may contain a couple of paragraphs.

The component must tolerate longer authored content without breaking PLAY access.

On constrained viewports, allow the content region to scroll rather than permanently pushing the primary action off-screen.

## 17.5 Footer remains secondary

The community invitation and Minimize checkbox are intentionally secondary to the Mission and PLAY action.

---

# 18. Ship reference behavior and pluralization

## 18.1 Graphic reuse

The challenge uses the existing canonical ship graphic resolver.

Do not create Mission-specific duplicate SVG assets.

## 18.2 Standard reference hover/tap

The challenge ship is a reference surface.

Desktop:

- hovering the challenge ship uses the normal Ship Catalogue/reference-style hover presentation;
- show the existing canonical ship rules/name/cost/timing/powers through the shared adapter/card family;
- no build eligibility or challenge-specific extra rules are required.

Mobile/touch:

- use the existing interactive reference-card/tap posture appropriate to the current mobile ship-detail behavior;
- provide a close path;
- do not depend on hover.

The exact shared component may be chosen during implementation after inspecting current hover-card consumers.

## 18.3 Generous hit area

The ship graphic's interaction target must be larger than sparse SVG strokes.

Use a sensible invisible/box hit target around the graphic.

## 18.4 Existing pluralization only

Challenge instruction copy must reuse the existing ship pluralization helper.

Do not hardcode `s` or maintain a Mission-specific plural-name field.

Examples already handled by current code include:

- Tactical Cruiser → Tactical Cruisers;
- Ship of Fear → Ships of Fear;
- Ark of Redemption → Arks of Redemption.

Conceptual copy:

```text
Win with {pluralized ship name}
Win without {pluralized ship name}
```

---

# 19. In-game reopen behavior

## 19.1 Menu action

During an active Play Computer game, the human player's Menu gains:

```text
Mission & Challenge
```

It sits alongside the existing game actions such as Offer Draw and Resign.

The intended emphasis may use the existing Shapeships purple action language similar to the purple Create Private Game family, subject to final UI implementation.

## 19.2 Same assignment

Opening the Menu action shows the same assigned Mission and Challenge.

It never rerolls anything.

## 19.3 Close instead of PLAY

The mid-game reopened version has a normal close/back-to-game affordance rather than the initial PLAY acknowledgement behavior.

Closing it has no server effect.

## 19.4 Preference remains session-only

If the Minimize control is shown in the reopened surface, changing it affects future intros only.

It does not remove or change the current game's assignment.

## 19.5 Computer-game human only

Do not add this menu action to ordinary multiplayer players.

Spectator behavior is deferred unless a later product decision explicitly adds Mission viewing for spectators.

---

# 20. End-of-game evaluation

## 20.1 Evaluate from authoritative terminal truth

Phase 15 should not require every separate terminal path to write a special challenge-result mutation.

Preferred posture:

- persist the assignment;
- when the game is finished, derive Mission/Challenge result from the canonical terminal state using one pure server helper.

This avoids duplicated handling across:

- normal battle victory;
- timeout;
- resignation;
- draw agreement;
- other existing terminal reasons.

## 20.2 Mission success

```ts
missionSucceeded = winnerPlayerId === humanPlayerId;
```

A draw means Mission failed.

## 20.3 Final fleet source

Challenge fleet evaluation uses the authoritative active fleet container for the human player at the terminal state.

It does not use:

- Battle Log text;
- build history;
- destroyed/VOID ship history;
- consumed upgrade components;
- a client-side reconstruction.

## 20.4 WITH evaluator

Conceptually:

```ts
fleetConditionMet = finalFleet.some(
  ship => ship.shipDefId === challenge.shipDefId
);
```

## 20.5 WITHOUT evaluator

Conceptually:

```ts
fleetConditionMet = finalFleet.every(
  ship => ship.shipDefId !== challenge.shipDefId
);
```

## 20.6 Challenge success

Conceptually:

```ts
challengeSucceeded = missionSucceeded && fleetConditionMet;
```

## 20.7 Current ownership is what matters

If a ship has been legally transferred/stolen and is in the human player's active final fleet, it counts according to its current authoritative ownership.

The system does not care how that instance entered the fleet.

---

# 21. End-of-game presentation

## 21.1 Single Mission & Challenge button

The finished-game surface gains one Mission & Challenge button.

The exact button styling/status marker will be designed later and is not locked by this document.

## 21.2 Reuse the postgame overlay posture

Opening Mission & Challenge at game end should use the same general overlay/layer philosophy as the existing Game Stats surface:

- overlay the central board/endgame content area;
- preserve the surrounding HUD/action structure as appropriate;
- do not create a new route/page for this content.

Exact positioning and dimensions remain a UI-pass decision.

## 21.3 One postgame overlay at a time

Game Stats and Mission & Challenge should not sit open over one another.

The game-screen presentation should treat them as mutually exclusive central postgame surfaces.

## 21.4 Show both results explicitly inside

The postgame Mission & Challenge surface shows:

- Mission success/failure;
- Optional Challenge success/failure;
- the same Mission story;
- the same challenge ship;
- the same WITH/WITHOUT objective.

A tick/cross treatment is intended; exact visual design is deferred.

## 21.5 No alternate story text required

Phase 15 does not require separate victory/failure prose for each Mission.

The same authored story is reused.

---

# 22. Time-control preset adjustment: 5+0 → 5+3

## 22.1 Locked selectable preset change

Because Phase 15 already touches the clock-live contract, the lowest selectable time-control preset is updated from:

```text
5 + 0
```

to:

```text
5 + 3
```

## 22.2 Shared impact

The current setup panel is shared by private multiplayer and Play Computer.

Therefore the supported selectable preset set becomes:

- 5+3;
- 10+5;
- 15+10;
- 30+20.

This is intentionally a general new-game setup change, not computer-game-only UI.

## 22.3 Server/client must change together

The client preset and server accepted preset whitelist/error copy must remain aligned.

Do not ship a client-only 5+3 option while the server still accepts only 5+0, or vice versa.

## 22.4 Existing games

Do not migrate or rewrite existing live/persisted 5+0 games as part of Phase 15.

The selectable-creation preset changes going forward.

Current rematch inheritance should be inspected during the timer-preset pass. Do not broaden the pass into a historical-clock migration unless explicitly approved.

---

# 23. Visibility and spectator posture

## 23.1 Human requester owns the personal Mission surface

For Phase 15 v1, Mission & Challenge is a human-player Play Computer feature.

Project the assignment to the relevant human requester.

The bot does not need Mission data.

## 23.2 No gameplay secrecy requirement

Mission and Challenge content is not hidden strategic information in the same sense as Drawing drafts.

However, Phase 15 should still avoid broad DTO leakage and should expose the feature deliberately through the requester contract rather than accidental raw-state serialization.

## 23.3 Spectators deferred

Spectator Mission & Challenge presentation is not required for Phase 15 v1.

Do not add spectator menu actions or special spectator result UI unless separately approved.

This does not prevent a later spectator pass from exposing the same public narrative content.

---

# 24. Content-authoring workflow

## 24.1 Primary writing surface

Mission stories should live in one clearly identifiable authored-data module/file or a very small content folder.

The preferred author experience is:

1. choose the directional matchup pool;
2. add a record with stable ID, title, location, author, and paragraphs;
3. no gameplay code changes;
4. no challenge-copy changes;
5. no client rules duplication.

## 24.2 Initial content coverage gate

Before the feature is considered launchable, every one of the 12 current matchup pools must contain at least one Mission story.

This should be validated programmatically in server tests or content validation rather than discovered in the browser.

## 24.3 Additional stories

Adding stories later should increase variety automatically.

No new code branch should be required per story.

## 24.4 Community stories

Future community Mission ideas can use the same schema with their author attribution.

No separate community-content subsystem is required for Phase 15.

---

# 25. Recommended implementation sequence

Implementation should remain sliced. The following sequence is normative at the program level; each Codex pass must still inspect current files and propose its own concrete file plan.

## Phase 15A — Planning document

**Type:** Documentation Pass

This document.

---

## Phase 15B — Server Mission & Challenge foundations

**Type:** Server Pass

### Goal

Add the authoritative Mission/Challenge assignment, intro gate, result evaluator, and requester projection without implementing the visible UI yet.

### Expected scope

- Mission story data/types and matchup pools;
- challenge eligibility derivation from canonical ship definitions;
- deterministic assignment helper;
- canonical assignment state;
- assignment during Play Computer species resolution;
- `introPending` state;
- Mission intro acknowledgement intent/reducer support;
- server-side guard preventing human gameplay under pending intro;
- server clock-live gating for pending intro;
- requester Mission & Challenge DTO projection;
- pure finished-game Mission/Challenge evaluator.

### Required server validation

At minimum cover:

- all 12 matchup pools have content;
- assignment is directional;
- assignment is stable/idempotent;
- challenge target belongs to human species;
- Solar Powers are excluded;
- Xenite evolved and Ancient Basic ships remain eligible;
- intro pauses clocks;
- acknowledgement unpauses according to normal clock conditions;
- gameplay submissions cannot exploit the paused intro;
- bot activity is not blocked by the human intro;
- WITH/WITHOUT evaluator uses final active fleet;
- loss/draw prevents challenge success;
- timeout/resignation terminal truth evaluates consistently through the shared result helper.

---

## Phase 15C — 5+3 minimum preset alignment

**Type:** Mixed Pass

### Goal

Replace the selectable 5+0 creation preset with 5+3 in the shared game-creation UI and authoritative server validation together.

### Scope

- shared create-game preset data;
- server preset whitelist/config/error copy;
- only direct related tests/copy.

### Out of scope

- Mission UI;
- broader clock redesign;
- migration of existing games;
- unrelated timer tuning.

This pass is intentionally Mixed because client/server preset values must remain atomic and aligned.

---

## Phase 15D — Client runtime and session preference

**Type:** Client Runtime Pass

### Goal

Expose Mission & Challenge state/actions to presentation and implement the session-only minimize behavior.

### Expected scope

- Mission & Challenge runtime types/VM;
- requester DTO selectors/mapping;
- intro acknowledgement callback through existing intent path;
- `sessionStorage` preference helper, default OFF;
- automatic acknowledgement for later games when preference is ON;
- safe fallback to visible intro when auto-ack fails.

### Constraints

- networking remains in the client runtime;
- no Mission display layout in this pass unless a tiny bootstrap placeholder is required;
- no challenge result computation in the client.

---

## Phase 15E — Desktop intro + in-game reopen

**Type:** Client/UI Pass

### Goal

Implement the desktop Mission & Challenge experience from the approved design.

### Includes

- initial modal/container;
- Mission metadata/story rendering;
- challenge graphic;
- pluralized WITH/WITHOUT instruction;
- standard ship-reference hover;
- PLAY action;
- static Discord/community footer;
- Minimize Missions checkbox;
- gameplay interaction block while intro pending;
- first-turn green helper deferred until acknowledgement;
- purple Mission & Challenge Menu action;
- mid-game reopen with Close behavior.

### Validation posture

- typecheck/build;
- no new client unit tests required for straightforward static layout behavior;
- browser/Vite validation handled by user.

---

## Phase 15F — Mobile Mission & Challenge presentation

**Type:** Client/UI Pass

### Goal

Provide the same feature on the existing mobile game shell without creating mobile gameplay logic.

### Includes

- initial mobile Mission presentation;
- safe scrolling for longer story content;
- PLAY remains reachable;
- mobile/touch ship reference inspection;
- Menu takeover Mission & Challenge action;
- mid-game reopen with Close;
- same session preference;
- first-turn helper deferral remains shared.

### Constraints

- consume the same VM/actions as desktop;
- no raw game-state reads;
- no duplicate challenge evaluator.

---

## Phase 15G — Endgame integration

**Type:** Client/UI Pass, with Server Pass only if final projection was deliberately deferred from 15B

### Goal

Expose Mission & Challenge results from the existing finished-game presentation.

### Includes

- single Mission & Challenge postgame button;
- mutually exclusive Stats/Mission central overlay state;
- Mission tick/cross;
- Challenge tick/cross;
- same story/challenge/reference content;
- desktop and mobile integration.

### Deferred detail

Exact endgame button icon/status-marker design remains a later visual decision and should not block functional integration.

---

## Phase 15H — Content expansion / polish

**Type:** Content/Client-UI follow-up as needed

### Goal

Expand the Mission pools and tune copy/layout after real-game testing.

Potential work:

- additional stories per matchup;
- community-authored stories;
- copy editing;
- long-title/location/author edge cases;
- modal responsive polish.

Do not mix unrelated gameplay changes into this content pass.

---

# 26. Validation strategy

## 26.1 Server checks

Server-affecting passes should run the normal server checks appropriate to current repo tooling, including where applicable:

- `deno check src/supabase/functions/server/index.tsx`;
- `deno task check` if available;
- targeted server tests for Mission/clock/result behavior.

## 26.2 Client checks

Client/UI passes should run:

- `npm run typecheck`;
- `npm run build`.

Do not run Vite/dev server or browser automation unless explicitly requested.

Report browser validation as:

```text
Not run — browser/Vite testing handled by user.
```

## 26.3 Required behavioral validation

Across the full Phase 15 program, validate at least:

### Assignment

- each human/bot matchup receives the correct directional pool;
- one assignment only;
- refresh does not reroll;
- same assignment reopens during play;
- multiplayer receives no assignment.

### Challenges

- Human basic and upgraded targets;
- Xenite basic, evolved, and upgraded targets;
- Centaur basic and upgraded targets;
- Ancient Basic targets;
- Ancient Solar Powers never selected;
- WITH success with one matching final instance;
- WITHOUT success with zero matching final instances;
- destroyed/VOID earlier copies do not count;
- current final ownership counts;
- challenge is false on loss/draw.

### Intro/clock

- timed computer game clock remains paused before PLAY;
- clock resumes only after acknowledgement under normal clock-live rules;
- refresh while pending does not back-charge time;
- bot can become Ready while intro remains pending;
- human gameplay cannot be submitted before acknowledgement;
- untimed game behaves normally without clock state.

### Minimize

- default is OFF;
- checking it persists only for the browser session;
- current visible intro still requires PLAY;
- next computer game auto-acks;
- assignment remains reopenable;
- failed auto-ack falls back to visible intro.

### UI

- first-turn helper appears after intro, not behind it;
- challenge reference card uses existing rules presentation;
- pluralization is correct for ordinary, Ship of, and Ark of names;
- in-game reopen does not send acknowledgement again;
- postgame Stats and Mission overlays do not overlap.

### Time presets

- shared setup shows 5+3 rather than 5+0;
- server accepts 5+3;
- server no longer advertises 5+0 as a selectable supported preset;
- other presets remain unchanged.

---

# 27. Risks and review gates

## 27.1 Clock exploit risk

The largest rules-adjacent risk is pausing the clock while still allowing the human to submit gameplay intents.

Server-side input gating while `introPending` is true is mandatory.

## 27.2 DTO leakage risk

Current live-state responses still contain migration-era broad families.

Do not add Mission state to canonical storage and assume it will remain requester-only automatically.

Inspect and explicitly project/sanitize it.

## 27.3 Content coverage risk

A missing directional pool would violate the locked one-Mission-per-computer-game contract.

Coverage should be testable from authored content data.

## 27.4 Definition eligibility drift

Do not hardcode only `Basic | Upgraded` and accidentally exclude:

- Xenite evolved basics;
- Ancient fleet basics.

Conversely, do not include Solar Powers simply because they share a definitions file.

## 27.5 Client auto-ack race

When minimization is enabled, automatic acknowledgement must not cause:

- duplicate network spam;
- repeated full-state loops;
- a hidden permanently paused game on failure.

Use a small in-flight/idempotence guard and authoritative refresh confirmation.

## 27.6 First-turn helper race

The green first-turn helper is already delayed/animated.

Mission acknowledgement must gate eligibility cleanly rather than mounting the helper invisibly behind the Mission modal and then producing a stale animation state.

## 27.7 Postgame terminal-path drift

Avoid separate challenge-result writes in timeout, resignation, battle resolution, etc.

A shared pure final-state evaluator is preferred specifically to prevent drift.

## 27.8 `useGameSession` growth

Phase 15 adds another orchestration concern.

Prefer a focused helper/module for Mission session preference/auto-ack logic rather than embedding all behavior inline in an already large session hook.

---

# 28. Completion criteria

Phase 15 is complete when all of the following are true:

- every Play Computer game receives exactly one Mission and one Optional Challenge;
- normal multiplayer games never receive the feature;
- the current 12 directional matchup pools are supported;
- initial content can launch with one Mission per pool;
- challenge targets are chosen from the human player's canonical fleet-capable species definitions;
- all current Human, Xenite, Centaur, and Ancient fleet ships are eligible as intended;
- Ancient Solar Powers are excluded;
- assignment is stable for the life of the game;
- the initial Mission intro appears after species selection without becoming a turn phase;
- clocks remain server-authoritatively paused until intro acknowledgement;
- the human cannot exploit the clock pause to submit gameplay actions;
- the bot may continue normal opening behavior behind the intro;
- PLAY acknowledges the intro through the normal client/server seam;
- Minimize Missions is session-only, default OFF, and auto-acknowledges later intros safely;
- the first-turn green helper waits until the intro is complete;
- challenge ship rules use the existing reference hover/tap system;
- challenge wording reuses the existing pluralization helpers;
- Mission & Challenge can be reopened from the in-game Menu with a Close affordance;
- final Mission success is derived from victory;
- final Challenge success is derived from victory plus the authoritative active final fleet condition;
- a single endgame Mission & Challenge button can reopen the result surface;
- Stats and Mission postgame overlays are mutually exclusive;
- the selectable lowest timer preset is 5+3 rather than 5+0;
- server, client runtime, desktop, and mobile ownership boundaries remain clean.

---

# 29. Deferred design decisions

The following are deliberately not locked by this planning document and may be decided during their UI/content passes:

1. Exact desktop modal width/height after real text is inserted.
2. Exact mobile layout and whether the footer stacks vertically.
3. Exact endgame Mission & Challenge button icon/tick/cross treatment.
4. Exact postgame overlay geometry relative to the current Stats implementation.
5. Exact animation/fade timing for intro appearance and close.
6. Exact reference-card shared component chosen for the challenge graphic, provided the existing canonical rules adapter/presentation is reused.
7. Exact stable token syntax for player-name substitution.
8. Exact Mission file/folder naming.
9. How many additional Mission stories ship beyond the initial one-per-matchup test set.
10. Whether spectators may view Mission & Challenge in a later phase.

These decisions must not reopen the locked server/clock/evaluation model above.

---

# 30. Bottom line

Phase 15 is a contained Play Computer meta-feature:

- **one directional matchup Mission**;
- **one random fleet-based WITH/WITHOUT Challenge**;
- **one durable assignment per game**;
- **no gameplay modification**;
- **no challenge acceptance step**;
- **server-paused clocks until PLAY**;
- **session-only optional minimization, default OFF**;
- **normal ship-reference hover/tap instead of per-ship challenge content**;
- **final evaluation from the authoritative active fleet only**;
- **in-game and postgame reopen surfaces**;
- **5+3 replaces 5+0 as the lowest selectable timer preset**.

The first content-writing target is 12 Mission stories: one for each currently supported directional human-player/computer-species matchup.
