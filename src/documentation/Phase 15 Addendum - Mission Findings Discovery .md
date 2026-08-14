# Phase 15 — Missions & Challenges
## Normative Addendum — Mission Findings Discovery

Project: Shapeships  
Status: Normative planning addendum  
Scope: session-scoped discovery link between Play Computer Missions and Lore > Mission Findings

This addendum extends:
- `Phase 15 Missions and Challenges.md`

If later implementation instructions conflict with this addendum, this addendum wins for Mission Findings discovery behavior within its scope unless explicitly superseded.

The core Phase 15 Mission & Challenge rules remain unchanged. This addendum does **not** make Lore authoritative, does not add gameplay rewards, and does not create account-level progression.

-------------------------------------------------------------------------------
## 1. Purpose
-------------------------------------------------------------------------------

This addendum defines a lightweight joining layer between:

- authored Play Computer Missions; and
- the existing Lore > Mission Findings rows.

Its purpose is to:
- let seeing a Mission reveal the related Lore Mission Finding;
- make Mission Findings feel discovered through play rather than fully readable from the start;
- keep the relationship stable even if Mission titles, locations, or prose later change;
- preserve the existing server-authoritative Mission assignment model;
- keep discovery persistence local and session-scoped until real player accounts exist;
- avoid turning the feature into an achievements, rewards, or progression system.

The game result is irrelevant to discovery.

A player discovers a Mission Finding by actually being shown an associated Mission.

-------------------------------------------------------------------------------
## 2. Locked product behavior
-------------------------------------------------------------------------------

### 2.1 Mission Findings are blurred by default

Each Mission Finding row is visually blurred by default.

Target blur:

```text
20px
```

The blur applies to the row's meaningful content, including its topic/title, author, and finding copy.

Row layout and spacing should remain stable while locked so revealing a Finding does not cause the Lore page to reflow.

Dividers or other structural layout chrome may remain unblurred.

### 2.2 Seeing an associated Mission reveals the Finding

A Mission Finding becomes revealed when the player is actually presented with any Mission that references that Finding.

The game result does not matter.

The player does not need to:
- win;
- complete the Optional Challenge;
- press PLAY after reading;
- finish the game.

The requirement is simply that the Mission content was genuinely visible to the player.

### 2.3 Assignment alone does not reveal

The following do **not** reveal a Mission Finding:

- server-side Mission assignment;
- polling or hydration;
- `introPending` existing;
- automatic Mission intro acknowledgement;
- winning or losing a game whose Mission was never opened;
- reaching the postgame surface without opening Mission & Challenge.

This distinction is locked.

### 2.4 Minimized Mission intros do not reveal automatically

If `Minimize Missions` is already enabled for the browser session and a later Play Computer game auto-acknowledges its Mission intro without showing the Mission:

> the associated Mission Finding remains blurred.

If the player later opens that same Mission through:
- the in-game `Mission & Challenge` Menu action; or
- the postgame `Mission & Challenge` surface;

the Finding is revealed at that point.

### 2.5 Repeated views are idempotent

Seeing the same Mission or another Mission linked to the same Finding again does not create duplicate state or any new effect.

The Finding simply remains revealed for the rest of the browser session.

-------------------------------------------------------------------------------
## 3. Stable Finding identity
-------------------------------------------------------------------------------

### 3.1 Mission Findings require stable IDs

Every Mission Finding row receives one stable identifier.

Conceptual shape:

```ts
type MissionFinding = {
  id: string;
  topic: string;
  author: string;
  content: string;
};
```

Exact type/file naming may follow the existing Lore implementation.

### 3.2 Display text is not identity

Do not use:
- the displayed topic/location;
- the row index;
- rendered prose;
- matchup shorthand such as `HvH`;

as the durable identity of a Finding.

Topics and copy may change later without invalidating discovery.

### 3.3 Mission stories reference a Finding ID

Each authored Mission story receives a `findingId`.

Conceptually:

```ts
type MissionStory = {
  id: string;
  playerSpecies: 'human' | 'xenite' | 'centaur' | 'ancient';
  opponentSpecies: 'human' | 'xenite' | 'centaur';
  findingId: string;
  title: string;
  location: string;
  author: string;
  paragraphs: string[];
};
```

This is additive to the existing Mission content model.

### 3.4 Mapping is Mission-to-Finding, not Finding-to-matchup

The joining contract is:

```text
Mission story -> findingId
```

not:

```text
Finding row -> exactly one matchup
```

This is deliberate.

Multiple:
- directional matchups;
- Mission stories within one matchup;
- future additional stories;

may reference the same Mission Finding.

The current number of Mission Finding rows therefore does not need to equal the number of directional bot matchup pools.

-------------------------------------------------------------------------------
## 4. Mapping workflow
-------------------------------------------------------------------------------

### 4.1 Designer-supplied mapping

The designer may supply mappings in shorthand such as:

```text
MINTAKA > HvH
```

or any equivalent human-readable mapping list.

Implementation should translate that authoring decision into stable `findingId` references on the relevant Mission story records.

### 4.2 Matchup remains known from Mission content

The game already knows the Mission's directional matchup through the Mission story's existing player/opponent species metadata.

Do not duplicate matchup logic inside the Lore row merely to support discovery.

### 4.3 Future content expansion

If additional Missions are later added to one directional pool, each story independently declares the Finding it reveals.

Adding Mission variety must not require changing the Lore discovery architecture.

-------------------------------------------------------------------------------
## 5. Ownership and architecture
-------------------------------------------------------------------------------

### 5.1 Server owns Mission assignment, not Lore discovery state

The server continues to own:
- Mission assignment;
- `missionId`;
- challenge assignment;
- `introPending`;
- requester Mission projection.

The server does **not** own whether a Lore Finding has been viewed in this first version.

### 5.2 Requester Mission projection carries `findingId`

The human requester's Mission projection should include the assigned Mission's stable `findingId` along with the Mission content already required by Phase 15.

Do not add a separate server endpoint just for Lore discovery.

### 5.3 Client owns seen-Finding session state

The client owns the session-local set of revealed Finding IDs.

This is presentation/progression convenience state only.

It is not:
- canonical game state;
- gameplay legality;
- a Mission result;
- an achievement;
- a reward;
- server-synced progression.

### 5.4 Lore remains static client-owned content

The existing Lore > Mission Findings content remains static repository-owned client content.

The discovery layer only determines whether each row is rendered blurred or clear.

Do not move Lore prose to the server solely for this feature.

### 5.5 No new architectural layer

Do not introduce:
- a generic progression framework;
- a generic unlock engine;
- a new persistence service;
- a cross-app event bus;

for this feature.

Use a small focused helper and the existing Mission/Lore seams.

-------------------------------------------------------------------------------
## 6. Session persistence
-------------------------------------------------------------------------------

### 6.1 Use `sessionStorage`

For the current pre-account product, discovered Finding IDs are stored in browser `sessionStorage`.

Recommended key:

```text
shapeships.missionFindingsSeen.v1
```

Exact spelling may be adjusted slightly to match nearby conventions, but it must be:
- versioned;
- session-scoped;
- dedicated to Mission Finding discovery.

### 6.2 Stored shape

A compact set/list of stable Finding IDs is sufficient.

Conceptually:

```json
["mintaka", "betelgeuse", "delta-aquarii"]
```

Do not store:
- whole Mission records;
- game IDs;
- win/loss results;
- timestamps;
- duplicate history rows;

unless a later product requirement explicitly needs them.

### 6.3 Reset semantics are acceptable

For this version it is acceptable that discoveries are lost when the browser session ends or session storage is otherwise cleared.

A later real-account system may replace this with durable player-backed progression.

That future migration is out of scope for Phase 15.

### 6.4 Storage size is negligible

The discovery set is intentionally tiny and does not create a meaningful browser-storage concern.

### 6.5 Storage failure posture

If `sessionStorage` is unavailable or throws:
- gameplay continues normally;
- Missions still work;
- Lore may behave as if no Findings have been persistently revealed for that session;
- no server or gameplay fallback is required.

-------------------------------------------------------------------------------
## 7. What counts as visibly seen
-------------------------------------------------------------------------------

### 7.1 Initial Mission intro

If the normal opening Mission & Challenge presentation is actually shown to the player, its `findingId` is marked seen.

The mark occurs because the Mission content became visible, not because PLAY was pressed.

### 7.2 In-game reopen

Opening `Mission & Challenge` from the in-game Menu marks the associated `findingId` seen.

Closing the reopened Mission has no additional effect.

### 7.3 Postgame reopen

Opening the postgame `Mission & Challenge` surface marks the associated `findingId` seen.

The game result remains irrelevant.

### 7.4 Hidden or skipped presentation

Do not mark a Finding seen merely because:
- a Mission component exists but is not the active visible surface;
- auto-ack skipped the opening Mission;
- a Mission VM hydrated in memory;
- a postgame button exists but was never opened.

The implementation should mark discovery from the actual presentation/open state, not from raw data availability.

### 7.5 Desktop and mobile semantics are identical

Desktop and mobile Mission surfaces use the same seen-Finding semantics.

Do not create separate mobile discovery rules.

-------------------------------------------------------------------------------
## 8. Lore presentation
-------------------------------------------------------------------------------

### 8.1 Locked row state

Each Mission Finding row has two presentation states:

```text
unseen -> blurred
seen   -> clear
```

There is no partial reveal state in Phase 15.

### 8.2 Approximate blur

Target:

```css
filter: blur(20px);
```

Exact implementation may use equivalent Tailwind/CSS if required by the existing Lore component.

### 8.3 Layout stability

Locked and unlocked versions should occupy the same layout space.

Do not collapse hidden rows or replace them with shorter placeholder text.

### 8.4 Concealment, not security

This blur is a presentation spoiler/concealment device.

The underlying static Lore content may remain present in the client/DOM.

Phase 15 does not require secure server-side withholding of Lore prose.

-------------------------------------------------------------------------------
## 9. Relationship to Minimize Missions
-------------------------------------------------------------------------------

Mission minimization and Mission Finding discovery are separate session concerns.

`Minimize Missions` controls whether future opening Mission intros are automatically shown.

Mission Findings discovery tracks which Findings were actually presented.

Therefore:

```text
auto-acknowledged but never opened -> not seen
opened at any Mission surface      -> seen
```

Do not make the `MISSION_INTRO_ACK` reducer action mutate Lore discovery state.

Do not infer seen state from `introPending === false`.

-------------------------------------------------------------------------------
## 10. Relationship to Mission results and challenges
-------------------------------------------------------------------------------

Mission Findings discovery is independent of:
- Mission success;
- Optional Challenge success;
- WITH/WITHOUT target;
- final fleet;
- timeout;
- resignation;
- draw;
- Battle Log history.

The existing Phase 15 final evaluator remains unchanged.

No server terminal path requires Mission Finding writes.

-------------------------------------------------------------------------------
## 11. Recommended implementation impact
-------------------------------------------------------------------------------

This addendum adjusts the existing Phase 15 sequence rather than creating a second large program.

### Phase 15B — Server Mission & Challenge foundations

Add:
- `findingId` to authored Mission story metadata;
- requester projection of the assigned Mission's `findingId`;
- content validation that every shipped Mission has a non-empty/stable Finding reference.

Do not add:
- server-side seen state;
- a discovery intent;
- Lore content to canonical state.

### Phase 15D — Client runtime and session preference

Add:
- a focused `sessionStorage` helper/store for seen Finding IDs;
- read/add/idempotence behavior;
- graceful storage failure handling.

Keep this separate from the existing `Minimize Missions` preference even if both use `sessionStorage`.

### Phase 15E — Desktop intro + in-game reopen

Add:
- mark assigned `findingId` seen when the initial Mission is visibly presented;
- mark it seen when the in-game Mission surface is opened.

Do not mark from raw VM hydration or auto-ack.

### Phase 15F — Mobile Mission & Challenge presentation

Add:
- the same visible/open discovery behavior on mobile;
- reuse the same client helper/state.

### Phase 15G — Endgame integration

Add:
- mark the assigned `findingId` seen when the postgame Mission & Challenge surface is opened.

Result status does not affect the mark.

### Phase 15H — Mission Findings discovery integration

**Type:** Client/UI Pass

**Goal:** connect the existing Lore Mission Findings rows to the session discovery state.

Includes:
- stable IDs on Mission Finding rows;
- default ~20px blur for unseen rows;
- clear rendering for seen rows;
- read discovery state through one focused client helper/seam;
- preserve existing Lore layout/content;
- verify repeated unlocks are idempotent.

Out of scope:
- account persistence;
- server progression;
- secure content withholding;
- gameplay rewards;
- Mission assignment changes;
- Lore redesign.

### Later numbering

The existing Multiplayer Matchup Intro addendum remains:

```text
Phase 15I — Multiplayer Matchup Intro
```

The main document's existing Content Expansion / Polish follow-up should move from `15H` to:

```text
Phase 15J — Content Expansion / Polish
```

-------------------------------------------------------------------------------
## 12. Validation expectations
-------------------------------------------------------------------------------

Across the affected Phase 15 passes, validate:

### Mission metadata

- every shipped Mission story has a stable `findingId`;
- the correct Finding mapping is preserved for each designer-supplied Mission mapping;
- multiple Missions may safely reference one Finding;
- assignment stability/reroll behavior is unchanged.

### Seen semantics

- visible initial Mission marks its Finding seen;
- pressing PLAY is not required for the mark;
- winning is not required;
- losing/drawing is not required;
- auto-minimized/auto-acknowledged Mission remains unseen;
- opening that Mission later from Menu marks it seen;
- opening that Mission postgame marks it seen;
- repeated opening remains idempotent.

### Session persistence

- revealed IDs survive normal navigation/reload within the browser session where supported by `sessionStorage`;
- unrelated Finding IDs remain locked;
- storage failure does not break gameplay.

### Lore

- unseen rows render blurred at approximately 20px;
- seen rows render clearly;
- unlock does not change row height/layout materially;
- existing Lore navigation/responsiveness remains intact.

### Regression

- Mission assignment/clock behavior is unchanged;
- Challenge evaluation is unchanged;
- multiplayer remains unaffected;
- Minimize Missions continues to auto-ack future intros without falsely revealing Findings.

-------------------------------------------------------------------------------
## 13. Non-goals
-------------------------------------------------------------------------------

This addendum does not add:

- account-backed persistence;
- cross-device discovery;
- permanent browser `localStorage` progression;
- achievements;
- rewards;
- percentages/completion meters;
- gameplay modifiers;
- unlock animations beyond ordinary presentation polish;
- server-side Lore secrecy;
- a requirement to finish or win a Mission;
- a requirement for one Mission Finding row per matchup;
- a new canonical phase;
- a new Mission networking seam.

-------------------------------------------------------------------------------
## 14. Bottom line
-------------------------------------------------------------------------------

Mission Findings become lightweight session discoveries tied to actual Mission viewing.

The durable content relationship is:

```text
Mission story -> stable findingId -> Lore Mission Finding row
```

The reveal rule is:

```text
Mission visibly shown -> reveal Finding for this browser session
Mission assigned but never shown -> keep Finding blurred
```

This keeps the feature:
- simple;
- local;
- session-scoped;
- compatible with minimized Mission intros;
- independent of wins and Challenges;
- ready to migrate to real account persistence later without changing Mission assignment architecture.
