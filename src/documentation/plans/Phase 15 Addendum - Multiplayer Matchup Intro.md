# Phase 15 — Missions & Challenges
## Normative Addendum — Multiplayer Matchup Intro

Project: Shapeships  
Status: Normative planning addendum  
Scope: multiplayer-only matchup presentation and authoritative pre-opening gate immediately after species selection

This addendum extends:
- [Phase 15 Missions and Challenges - Revised with Mission Findings](<Phase 15 Missions and Challenges - Revised with Mission Findings.md>)

If later implementation instructions conflict with this addendum, this addendum wins for the multiplayer matchup-intro behavior within its scope unless explicitly superseded.

The core Phase 15 Mission & Challenge rules remain Play Computer only. This addendum does **not** add Missions or Challenges to multiplayer.

-------------------------------------------------------------------------------
## 1. Purpose
-------------------------------------------------------------------------------

This addendum defines a short matchup intro for normal multiplayer games.

Its purpose is to:
- give both players a clear matchup reveal immediately after species selection;
- briefly present player names and species before Turn 1 begins;
- pause both authoritative clocks for the duration of that presentation;
- ensure the opening dice roll does not occur until the matchup intro has finished;
- reuse the clock-gating and intro-state posture established during Phase 15 rather than inventing a separate client-only pause system;
- keep the feature outside the canonical turn-phase sequence.

The intended presentation is approximately four seconds long and follows the supplied matchup design: local player, `vs`, opponent, with each species shown beneath its player name.

-------------------------------------------------------------------------------
## 2. Scope position relative to Phase 15
-------------------------------------------------------------------------------

The main Phase 15 document defines the Mission & Challenge intro for Play Computer games.

That intro and this multiplayer intro share some infrastructure concerns:
- both occur immediately after species selection;
- both require server-authoritative clock gating;
- both are presentation gates rather than new turn phases;
- both need refresh-safe client/runtime projection.

However, their gameplay timing is deliberately different.

### 2.1 Play Computer Mission intro remains unchanged

For Play Computer:
- Mission & Challenge remains the opening presentation;
- normal opening game work may proceed behind the Mission modal as already defined;
- the bot may act while the human Mission intro is still pending;
- PLAY/acknowledgement releases the human interaction/clock gate.

### 2.2 Multiplayer matchup intro is a true pre-opening gate

For multiplayer:
- no Turn 1 opening work occurs behind the matchup intro;
- no opening dice roll occurs;
- no Line Generation occurs;
- no Drawing/prelude work occurs;
- neither player may begin gameplay during the intro.

This distinction is locked.

-------------------------------------------------------------------------------
## 3. Locked product behavior
-------------------------------------------------------------------------------

### 3.1 Multiplayer only

The matchup intro applies to games with two human-controlled player seats.

It does not apply to:
- Play Computer games;
- bot-controlled seats;
- Mission & Challenge presentation;
- spectator-only viewing as a required v1 presentation surface.

Use authoritative controller/seat metadata where available rather than inferring multiplayer from player names.

### 3.2 Trigger timing

The intro begins once the final required species selection has been accepted and both player species are authoritative.

It occurs exactly once per game at the initial transition out of species selection.

It must not retrigger because of:
- polling;
- rerendering;
- refresh;
- reconnect;
- repeated/idempotent species submission;
- desktop/mobile layout changes.

A new multiplayer game receives a new intro normally.

### 3.3 Duration

Target authoritative intro duration:

```text
4000 ms
```

The visual animation should fit inside that window.

Small visual timing refinements may be made during implementation, but the feature should remain approximately four seconds and must not become a user-controlled waiting screen.

### 3.4 Automatic; no PLAY or skip control

The multiplayer matchup intro is automatic.

There is:
- no PLAY button;
- no Ready action;
- no close button;
- no skip button;
- no player acceptance step.

After the intro window completes, normal opening gameplay begins automatically through the authoritative transition path.

-------------------------------------------------------------------------------
## 4. No opening dice roll during the intro
-------------------------------------------------------------------------------

### 4.1 The dice genuinely has not rolled yet

While the matchup intro is pending:

> the Turn 1 opening dice roll must not have occurred.

Do not:
- generate the roll and hide it;
- store a secret opening result for later reveal;
- run Line Generation from a hidden roll;
- trigger the dice animation early;
- trigger dice audio early.

The first real opening roll occurs only after the matchup intro gate has completed.

### 4.2 Normal opening path resumes afterward

When the gate completes:
- continue through the existing authoritative Turn 1 opening path;
- generate the opening dice exactly once;
- run normal Line Generation exactly once;
- enter the normal first interactive build state according to the current phase architecture;
- allow the existing dice animation/audio/presentation timing to react to that genuine roll.

This addendum must not create a second dice-generation path.

-------------------------------------------------------------------------------
## 5. Clock behavior
-------------------------------------------------------------------------------

### 5.1 Both clocks are paused

While the multiplayer matchup intro is pending:

> neither player's authoritative chess clock accrues time.

This must use the server clock-live contract.

Do not implement the feature by visually freezing client clocks while authoritative time continues to run.

### 5.2 Clock timestamp hygiene

The existing clock machinery should remain fresh while the gate is pending so releasing the intro does not back-charge the four-second presentation interval to either player.

The first live gameplay clock interval begins only once the intro gate has completed and normal opening gameplay has been released.

### 5.3 Untimed games

Untimed multiplayer games still show the same matchup intro.

They simply have no clock accrual to gate.

-------------------------------------------------------------------------------
## 6. Authoritative gate model
-------------------------------------------------------------------------------

### 6.1 Not a new phase

Do not add a canonical phase such as:

```text
setup.matchup_intro
```

Do not add matchup intro to `PHASE_SEQUENCE`.

The matchup intro is opening-gate state associated with the species-selection-to-Turn-1 transition.

### 6.2 Recommended semantic state

After the Phase 15 intro/clock work exists, implementation should reuse or generalize that infrastructure where clean rather than creating an unrelated timing system.

A multiplayer gate may conceptually expose state equivalent to:

```ts
type MatchupIntroState = {
  pending: boolean;
  startedAt: string;
  endsAt: string;
};
```

Exact field names and placement are not locked and must follow the live repository after inspection.

What is locked is:
- authoritative knowledge that the matchup intro is pending;
- an authoritative timing/deadline basis for the approximately four-second window;
- no normal opening progression until the gate completes;
- no client-only authority over whether Turn 1 has begun.

### 6.3 Completion should use the existing write seam

The server is not required to run a background scheduler.

Recommended posture:
- clients animate against the authoritative intro deadline;
- once the deadline has elapsed, the client runtime submits a small idempotent completion intent through the existing networking seam;
- the first valid completion after the deadline releases the match globally and invokes the normal opening transition;
- a racing duplicate completion from the other player is a safe no-op/idempotent result.

A conceptual intent name such as:

```text
MATCHUP_INTRO_COMPLETE
```

is acceptable, subject to inspection of current intent naming and reducer structure.

### 6.4 Do not mutate on GET polling

`GET /game-state` and lightweight polling remain read-only.

Do not advance the matchup intro, roll the dice, or mutate phase state merely because a polling request observes that the deadline has passed.

-------------------------------------------------------------------------------
## 7. Refresh, reconnect, and synchronization
-------------------------------------------------------------------------------

### 7.1 Refresh during the intro

If a player refreshes while the intro is still inside its authoritative window:
- the same matchup remains active;
- no new intro instance is created;
- no dice is rolled because of the refresh;
- the client resumes the remaining presentation from authoritative timing where practical.

The implementation does not need to replay the full four seconds after every refresh.

### 7.2 Reconnect after the deadline

If the deadline has already elapsed but the gate has not yet been released:
- the returning client should not restart a fresh four-second intro;
- the client runtime should promptly use the normal completion path;
- the server then begins the normal opening exactly once.

### 7.3 Two-client synchronization

Both player clients consume the same authoritative gate timing.

The intro should therefore be broadly synchronized without requiring frame-perfect animation synchronization between browsers.

The server transition, dice roll, and clock release are authoritative; exact CSS animation frames are not.

-------------------------------------------------------------------------------
## 8. Presentation contract
-------------------------------------------------------------------------------

### 8.1 Core content

The matchup intro presents:
- local player name;
- local player species;
- centered `vs`;
- opponent player name;
- opponent species.

For normal player view, preserve the existing player-relative board orientation:
- local player on the local-player side;
- opponent on the opponent side.

### 8.2 Species presentation

Species labels should use the existing species naming and colour language already used by the game UI.

Do not introduce a duplicate species-definition or colour map solely for the matchup intro.

### 8.3 Background game surface

The existing game surface may be visible beneath/around the animation as appropriate to the approved design.

However, while the gate is pending the screen must not imply that Turn 1 gameplay has already started.

In particular, do not present as active:
- a rolled dice value;
- available build lines;
- Drawing interaction;
- Ready interaction;
- first-turn green helper content.

### 8.4 No gameplay interaction

The intro is a short blocking presentation for ordinary gameplay.

Display should not expose actionable gameplay controls during the gate, and the server must not accept ordinary gameplay intents before the gate has completed.

Any narrow terminal/administrative exception required by the current reducer should be decided during implementation without widening this feature.

### 8.5 Desktop and mobile

The matchup intro is a game-level multiplayer feature and should ultimately work on both desktop and mobile.

The supplied desktop design is the primary visual reference.

Exact mobile composition may adapt responsively while preserving:
- both player names;
- both species;
- `vs` relationship;
- the same authoritative duration/gate.

Do not create separate mobile timing or gameplay logic.

### 8.6 Reduced motion

Reduced motion may replace movement-heavy transitions with simpler fades/static presentation.

Reduced motion does **not** change the authoritative matchup-intro duration or release gameplay early.

-------------------------------------------------------------------------------
## 9. Relationship to existing helpers and sound
-------------------------------------------------------------------------------

### 9.1 First-turn green helper

The first-turn helper must not appear during the multiplayer matchup intro.

Because no opening dice roll has occurred yet, its normal eligibility should begin only after the matchup gate completes and the real opening flow reaches the appropriate state.

Do not add a second helper-specific timer.

### 9.2 Dice sound

The existing dice sound remains tied to the genuine dice presentation event.

Because the opening dice does not roll during the matchup intro, no dice sound should fire during it.

### 9.3 No new matchup sound scope

This addendum does not add:
- matchup music;
- new species intro audio;
- voiceover;
- a new sound cue family.

Any future matchup-specific audio is a separate sound/presentation decision.

-------------------------------------------------------------------------------
## 10. Spectator posture
-------------------------------------------------------------------------------

Spectators do not participate in releasing the matchup gate.

A spectator joining during the short pre-opening window may consume the same public authoritative match state, but dedicated spectator matchup-intro presentation is not required by this addendum.

A spectator joining after normal gameplay has started must not cause the intro to replay or affect clocks/phase progression.

-------------------------------------------------------------------------------
## 11. Recommended implementation order
-------------------------------------------------------------------------------

This work should be implemented **after the existing Phase 15 Mission & Challenge intro/clock foundations are complete and stable**.

Do not silently fold this feature into the current Phase 15B–H implementation passes.

Recommended follow-up:

### Phase 15I — Multiplayer Matchup Intro

**Type:** Narrow Mixed Pass

### Goal

Add the multiplayer-only four-second matchup intro using the established intro/clock infrastructure while preventing any opening dice/gameplay work until the intro completes.

### Server/runtime responsibilities

- identify two-human multiplayer games from authoritative controller metadata;
- create the one-time matchup gate after both species are confirmed;
- keep clocks non-live while pending;
- prevent the normal opening transition/dice roll while pending;
- expose public gate timing/state through the existing DTO/runtime seam;
- accept one idempotent post-deadline completion action;
- release the normal opening path exactly once.

### Client/UI responsibilities

- map authoritative gate timing into one shared matchup-intro VM;
- schedule completion through the existing client networking seam;
- render the supplied desktop matchup presentation;
- provide responsive mobile presentation without separate gameplay logic;
- suppress ordinary gameplay controls/helper presentation until release;
- respect reduced motion.

### Out of scope

- Missions/Challenges in multiplayer;
- bot changes;
- phase-machine redesign;
- new dice logic;
- sound expansion;
- spectator-specific intro UX;
- unrelated clock changes.

Because the server gate and client completion/presentation must agree atomically, this is intentionally a narrowly scoped Mixed Pass rather than a display-only timer.

-------------------------------------------------------------------------------
## 12. Validation expectations
-------------------------------------------------------------------------------

The multiplayer matchup-intro pass is complete when all of the following are true.

### 12.1 Authoritative opening behavior

- two-human multiplayer enters the matchup gate once after both species are confirmed;
- no opening dice value exists during the gate;
- no Line Generation or Drawing work occurs during the gate;
- the normal opening dice is generated exactly once after release;
- no duplicate opening work occurs when both clients race to complete the gate.

### 12.2 Clock behavior

- both timed clocks remain paused for the intro;
- the intro interval is not back-charged on release;
- normal clocks begin only with released gameplay;
- untimed games still show the intro without clock-specific errors.

### 12.3 Refresh/reconnect

- refresh does not restart or duplicate authoritative intro state;
- refresh/reconnect during the four-second window uses the same deadline;
- reconnect after the deadline does not impose a new four-second wait;
- polling alone does not mutate the game or roll dice.

### 12.4 Mode separation

- Play Computer Mission intro behavior is unchanged;
- multiplayer receives no Mission or Challenge assignment;
- spectator connections do not release or restart the gate.

### 12.5 Presentation

- both player names and species render correctly;
- matchup `vs` presentation follows the supplied design intent;
- no dice/build/Ready/helper state appears active before release;
- desktop and mobile use the same authoritative gate/runtime state;
- reduced motion preserves the same gameplay wait while simplifying animation.

### 12.6 Engineering validation

For the implementation pass, run the relevant normal checks:
- `npm run typecheck`;
- `npm run build`;
- `deno check src/supabase/functions/server/index.tsx`;
- targeted server tests for gate, clock, idempotency, and opening-dice behavior where practical.

Do not run Vite/dev-server/browser automation from Codex unless explicitly requested.

Report browser/runtime validation as:

```text
Not run — browser/Vite testing handled by user.
```

-------------------------------------------------------------------------------
## 13. Locked guidance summary
-------------------------------------------------------------------------------

- matchup intro is **multiplayer only**;
- it begins immediately after both species selections are authoritative;
- it is approximately **4 seconds**;
- it has no PLAY/Ready/skip interaction;
- both authoritative clocks are paused for the intro;
- **the opening dice does not roll at all until the intro completes**;
- no Line Generation, Drawing, or other Turn 1 opening work runs behind it;
- it is an opening gate, **not a new canonical phase**;
- use the Phase 15 intro/clock infrastructure where clean, but preserve the different Play Computer Mission timing semantics;
- release through the existing authoritative write/networking seam, not GET polling or a display-only timer;
- normal first-turn dice, sound, helper, and gameplay behavior resumes after release;
- no Missions or Challenges are added to multiplayer by this addendum.

-------------------------------------------------------------------------------
## 14. Bottom line
-------------------------------------------------------------------------------

After species selection, a multiplayer match gets a short synchronized matchup moment before the game starts:

```text
PLAYER / SPECIES   vs   PLAYER / SPECIES
```

For roughly four seconds:
- clocks are paused;
- gameplay is blocked;
- no dice has been rolled;
- Turn 1 opening work has not begun.

When the gate completes, the server releases the existing opening path and the real first dice roll begins the match.

This should be implemented only after the current Phase 15 Mission/clock work is stable, as a separate narrow follow-up pass that reuses those foundations without changing the Play Computer Mission model.
