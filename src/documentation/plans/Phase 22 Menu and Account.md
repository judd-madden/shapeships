# Phase 22 — Menu and Account

## Planning baseline and scoped implementation roadmap

- **Owner:** Judd Madden
- **Prepared:** November 16, 2026
- **Status:** Agreed product direction; individual implementation passes and exact visual specifications are planned with Judd before implementation.
- **Audience:** Codex working in the live Shapeships repository.
- **Suggested repository location:** `src/documentation/plans/Phase 22 Menu and Account.md`
- **Architecture:** Existing server-authoritative game, client-owned networking/session orchestration, presentation-only display components.
- **Delivery order:** Front end first; account services and account win streaks afterward; final integration and owner review.

> This document is the phase roadmap, not an instruction to implement the entire phase at once. Judd and the planning assistant will prepare each pass here, including the relevant layout reference and exact visual requirements. Codex then checks the live repository, plans the affected files and implements that scoped pass. The approved pass brief may refine this roadmap. Do not invent missing visual measurements or expand a pass into unrelated work.

## 1. Authority and implementation workflow

### 1.1 Source precedence

1. Judd's latest explicit decisions and the approved individual pass brief.
2. This document's agreed product and behaviour requirements.
3. Current executable code for behaviour that is not explicitly changing.
4. Supplied design references for visual intent.

An incidental mockup/code conflict normally favours the codebase. An explicit product change in this document or a later approved brief overrides that default. For example, Single Player becomes untimed by default, while the existing **5 + 3** preset remains correct despite **5 + 0** appearing in the designs.

Read the current repository instructions and relevant canonical documents before implementation, including the documentation index, canonical handoff, ownership map and Codex pass template. Inspect the working tree and preserve concurrent owner changes.

### 1.2 Per-pass workflow

For each separately scoped pass:

1. Receive the pass brief, layout references and any exact visual specifications from Judd.
2. Inspect the live code and identify existing primitives, state owners and behaviour to retain.
3. Present the concrete file plan and any material mismatch before editing, following the repository workflow.
4. Implement only the agreed pass, reusing the existing architecture.
5. Perform proportionate checks and report changes, validation and remaining owner-review items.
6. Update this document's implementation record when the pass includes that documentation update.

Use separate Server and Client/UI passes wherever practical. Do not turn this phase into a general refactor, a new routing framework or a rewrite of the game session runtime.

## 2. Purpose and scope

Improve the first impression and organisation of the game menus, and introduce optional accounts through the player-facing benefit of claiming a name.

### 2.1 Included

- Revised entry screen, including ordinary, claimed-name, incorrect-password and banned-name states.
- New Welcome/Home menu page.
- Revised shared header, profile rail, navigation and responsive menu composition.
- Updated Single Player and Multiplayer page contents.
- Claim Name/account registration page accessed from the profile rail.
- Guest and signed-in/claimed identity presentations.
- Username/password accounts with no user-supplied email, phone or identity-verification requirement.
- Remembered sign-in, logout and manual Discord-assisted password recovery.
- Claimed-name ownership, banned-name filtering, badges and abuse prevention.
- Account persistence for five preferences: sound effects, health flash, chat open/closed, preferred desktop sister tab and music on/off.
- Account-owned current win streaks, eligible guest import and cross-device unfinished-game rejoin.
- Desktop and mobile presentation, including a persistent mobile bottom navigation with Home.
- Menu UI for future music playback and a deferred Stats action.

### 2.2 Deferred or outside this phase

- Music playback, soundtrack loading and music engine work.
- Functional account Stats, account game history, ratings, ranked matchmaking and leaderboards.
- Historical ownership attribution based solely on matching old guest names.
- Moving Mission Findings, Mission completion or Lore unread state to account storage.
- Redesigning the Rules or Lore page contents.
- Gameplay balance, combat rules, species rules and changes to the existing streak bonus rule.
- Broad build/configuration changes, generic infrastructure platforms and unrelated cleanup.

The supplied Stats layout is a future reference. Its presence does not authorise implementation of the page or its data services in Phase 22.

## 3. Existing integration points to verify in the live repository

These paths describe the known integration points; inspect their current contents before every affected pass.

| Area | Existing owner / behaviour | Phase 22 implication |
| --- | --- | --- |
| Entry/menu switching | `src/components/ScreenManager.tsx` | Preserve invite continuation while adding account-aware entry states. |
| Entry composition | `src/components/shells/LoginShell.tsx`, `src/components/panels/AlphaEntryPanel.tsx` | Reuse the shell/form split and existing input/button primitives. |
| Menu composition | `src/components/shells/MenuShell.tsx` | Add Welcome and account navigation; update shared chrome once. |
| Introductory menu content | `src/components/panels/MultiplayerPanel.tsx` | Separate Welcome material from multiplayer setup; do not accidentally remove unrelated content without the pass specifying its disposition. |
| Shared game setup | `src/components/panels/CreatePrivateGamePanel.tsx` | Retain shared timer controls and submission behaviour for both modes. |
| App-level launch/session wiring | `src/App.tsx` | Preserve game creation, invite routing and return-from-game behaviour. |
| Local player identity | `src/game/hooks/usePlayer.tsx` | Reconcile presentation identity with authenticated account/session truth. |
| Application sessions | `src/utils/sessionManager.ts` | Existing game sessions are tab-isolated; remembered accounts must coexist with that model. |
| Server sessions / names | Server auth routes, session middleware and game routes | Protect names at server entry points, not just through entry-screen lookups. |
| Existing auth scaffolding | Login/create-account/forgot-password panels and disabled signup route | Dormant email-based scaffolding is not a completed username-only account implementation. |
| Win streak | `src/game/client/winStreak/**`, existing game routes and display helpers | Reuse existing lifecycle rules and presentation while moving signed-in ownership to the server. |
| Audio / flash | `src/game/display/GameScreen.tsx`, existing audio runtime | Connect the menu Sound control and account preferences to the existing effects/flash behaviour. |
| Chat / battle-log preference | `src/game/display/layout/LeftRail.tsx` | Sync the existing preference semantics; do not invent a new mobile panel model. |
| Mission Findings / Lore unread | Existing mission session helpers and Lore panels | Retain session-based progression and current unread handling. |

Current Change Name behaviour clears the local player and application session. It must not be blindly reused for successful claiming, returning-account restoration or other transitions that should preserve an active game.

Server participant identity is currently session-based, while several game requests accept client-supplied display names. Account identity must be integrated deliberately without globally rewriting participant IDs or trusting client name/badge assertions.

## 4. Locked product behaviour

### 4.1 Guest access and name ownership

- Guest play remains available without an account.
- An unclaimed, permitted name can be used through the normal guest entry flow.
- A claimed name requires its owner's authenticated account, including password entry when no remembered sign-in is available.
- Banned names cannot be used by guests or newly claimed accounts.
- Preserve the existing name format: **3–20 ASCII letters or numbers, no spaces or symbols**, unless a later pass explicitly changes it.
- Treat casing variants as one claim for uniqueness; retain the chosen display casing.
- Apply common evasion handling for moderation separately from ownership normalisation. Decoding a digit for profanity matching must not automatically make two otherwise distinct legal usernames the same account.
- The displayed guest examples in the mockups do not independently authorise a new automatic guest-name generation flow.

### 4.2 Claiming a new account

- Claiming creates an optional Shapeships account and signs the player in immediately.
- Require username, password and the selected anti-bot check; no email address is collected.
- The supplied form specifies **10+ password characters with no additional character-class requirements**. Hashing-library limitations must be handled explicitly; never silently truncate passwords.
- A successful claim opens **Welcome with a success message** and the claimed identity rail.
- Carry the guest's existing eligible current streak into the new account, including supported unfinished-game continuation.
- Initialise the account's five agreed preferences from the current guest/device values.
- Claiming must not discard the current game session or silently strand an existing game.

### 4.3 Signing into an existing account

- Entering a claimed name uses the password state of the entry screen.
- Successful sign-in restores the account identity and account preferences, and applies the guest/account streak reconciliation in section 8.
- Remember sign-in on the same browser across visits; do not add a Remember Me requirement.
- An ordinary remembered return opens the menu. Welcome is the normal menu entry point; a direct game invite or explicit rejoin still continues to its intended game.
- Bad password, unavailable service and temporary throttling remain distinct operational states.

### 4.4 Logout and changing names

- Explicit Logout signs the player out and returns to name entry.
- A deliberate logout must not immediately restore the same account through a still-valid remembered credential.
- Guest Change Name retains its existing user-facing role of returning to entry. Audit its session effects against active games and new account imports.
- Logging out is not a streak loss or reset by itself. Account streak changes follow the gameplay rules and explicit fresh-game/reset actions.
- Do not copy the account streak into an independently importable guest record on logout.
- Define the precise cross-tab sign-out and in-flight-request handling in the account/session pass; avoid leaving a sibling tab with silent authority to mutate the signed-out account.

### 4.5 Recovery and badges

- Password recovery is manual assistance through Judd on Discord; no email-reset flow is introduced.
- A Discord message alone is not sufficient proof for transferring an unknown player's account. Provide a practical owner-only reset procedure, including credential/session revocation as appropriate.
- Passwords remain unreadable to administrators; recovery resets credentials rather than retrieving the original password.
- Support account-owned badge information, including the claimed-name presentation and an owner-granted Founder-style badge if included in the relevant pass.
- Badge presentation and Founder eligibility/artwork are supplied per pass. Do not automatically award Founder to every registration without an explicit decision.

## 5. Shared screen and presentation requirements

### 5.1 Entry

The numbered Login references are states of one screen:

| Reference | Meaning |
| --- | --- |
| `Login Screen 1.png` | Ordinary name entry. |
| `Login Screen 2.png` | Claimed name; password required, with show/hide control. |
| `Login Screen 3.png` | Incorrect password and Discord recovery directions. |
| `Login Screen 4.png` | Banned name and disabled progression. |

Support checking, submission/loading, generic validation, network failure and cooldown feedback through the established styling. Judd will not supply separate drawings for every operational state.

Editing the name must invalidate obsolete lookup/error/password context. Delayed responses for an earlier name must not overwrite the current entry state. Preserve keyboard submission and existing invite-specific entry behaviour.

The entry design includes a video area. Use a media/poster integration, not a live embedded game board. Source, desktop/mobile presentation and playback/loading behaviour are decided in the entry pass. Do not infer autoplay or add music playback from the placeholder.

### 5.2 Menu shell and profile rail

- Reuse the existing shell, background, typography system, primitives and graphic components.
- Shared desktop menu navigation: Welcome, Single Player, Multiplayer, Rules and Lore.
- Shared mobile bottom navigation remains persistent, gains Home/Welcome and is restyled to the supplied references.
- Account/claim navigation is accessed from the profile rail; it is not a new permanent bottom-navigation item.
- The guest rail offers Change Name and Claim Name. The claimed rail shows account identity/claim indicator, Logout and the deferred Stats action.
- Music UI is a deferred control and must not pretend that playback has started. Its exact inactive presentation is set in the shell pass.
- Sound is functional and uses the same preference as in-game sound effects.
- Retain Lore unread state and its current clearing behaviour.
- Include adequate page-bottom space for the persistent mobile navigation; long content must remain reachable.

### 5.3 Welcome

- Welcome becomes the normal menu landing page rather than the old Multiplayer hub.
- Present the four-step visual introduction: choose species, use dice, build fleet, win.
- Reuse existing species/dice/ship assets wherever they match the supplied design.
- Guest and claimed Welcome references are variants of the same page, not duplicated screen implementations.
- Do not turn the illustrative species/ship graphics into an unrequested interactive tutorial.

### 5.4 Single Player

- Default to **Not Timed** with the timer grid collapsed.
- Timed mode expands the existing shared timer controls.
- Preserve **5 + 3**, **10 + 5**, **15 + 10** and **30 + 20** presets and their actual submitted values.
- Retain existing game-creation, Missions, Challenges, streak bonus and reset/rejoin semantics.
- Keep the existing conditional streak badge, Reset treatment and Rejoin warning. Their absence from a base mockup does not remove them.
- Add the supplied explanatory feature rows without changing the underlying features.

### 5.5 Multiplayer

- Present private-game setup directly on the Multiplayer page, avoiding the existing extra hub-to-create step.
- Preserve private-game creation, invite URLs, join behaviour and existing multiplayer timer defaults.
- Retain the Discord opponent-finding action, positioned responsively as shown.
- Do not introduce public matchmaking or ranked play.

### 5.6 Claim Name

- Use the supplied form and account explanation, with responsive treatment agreed in its pass.
- Prefill from the current guest name where appropriate, while allowing an eligible different name to be claimed.
- Clearly state that claiming creates an account and requires no email.
- Account-storage copy must describe the preferences actually saved in this phase.
- Replace the mockup's claim of an encrypted password with accurate plain-language secure-storage wording or "securely hashed".
- Future Stats, history and ranked features mentioned in copy remain future intentions, not Phase 22 implementation scope.
- The illustrated CAPTCHA is not a locked provider choice.

### 5.7 Rules, Lore and Stats

Rules and Lore keep their existing page contents and behaviour within the revised shell. Their responsive fit may be checked without redesigning those pages.

Stats remains a deferred no-op in the profile rail. Do not implement placeholder statistics, queries or ratings. Any inactive tooltip/label is specified in the relevant UI pass.

## 6. Account preferences

All five agreed preferences follow a signed-in account across sessions and devices:

| Preference | Required integration |
| --- | --- |
| Sound effects on/off | Menu Sound control and existing game audio use one preference. |
| Health flash on/off | Existing in-game flash behaviour consumes the account preference. |
| Chat open/closed | Preserve the current open/minimised meaning where that chat layout exists. |
| Preferred desktop sister tab | Remember the last deliberate Battle Log or Turn Phases selection; expansion remains transient and mobile is unchanged. |
| Music on/off | Default On, persisted locally and later synced to accounts; the Phase 22 toggle is a working no-op with playback outside these passes. |

- Guest preferences continue to function locally.
- Creating an account seeds preferences from the current local values.
- Signing into an existing account applies its saved preferences; guest settings do not silently replace them.
- Use the existing local values as a loading/cache fallback without allowing initial default writes to overwrite newly fetched account settings.
- Preference failure must not interrupt a game. Save failures and concurrent edits need a bounded, explicit policy in the implementation pass.
- Persist deliberate user changes, not transient animation state or every render.
- Do not add polling loops solely for preference synchronisation; restore on sign-in/device entry and use a proportionate update strategy.
- Mission Findings, Lore unread state and Mission completion remain session-based.
- Audit other existing preferences, such as Ancient autocast or Mission minimisation, and preserve their current storage behaviour. They are not implicitly included in account sync.

## 7. Account and name-service architecture

### 7.1 Required separation

The browser renders account state and sends requests. Server code verifies credentials, owns claims and badges, authorises account operations and enforces banned-name rules. Networking remains in the client/runtime seam rather than being scattered across screen components.

Use Supabase-backed account data and the existing server application/session boundary. A custom account table/service is a viable direction for username-only credentials. The server pass must select and document the concrete schema and credential/session implementation against the live repository. Do not silently enable the dormant email flow or require a fabricated user email to satisfy it.

Keep account IDs distinct from game participant/session IDs. Link authenticated accounts to supported game sessions/seats with explicit authorisation. Remembering an account across browser visits does not justify sharing one game-session token across all tabs or replacing all historical participant IDs.

### 7.2 Names and moderation

- Claims require database-enforced uniqueness and atomic creation; a preliminary availability lookup is not sufficient.
- Apply ownership and banned-name checks to all relevant entry, create-game, join/spectator and name-assignment paths, not just the visible form.
- Use an editable Supabase-backed banned-name seed and owner-managed additions/exceptions.
- A reviewed subset of the Shutterstock/LDNOOBW word lists is an initial source candidate; retain required attribution if used.
- Catch common case/digit/evasion variants while avoiding blanket substring rules that unnecessarily reject innocent names.
- Separate offensive-name rules from names reserved for official/system use or known community members.
- Plan initial reservation of Judd's/official names and existing regulars' names before public claims are enabled. Historical guest name use is not identity proof.
- Provide minimal owner operations to block/unblock claims, correct filtering and manage badges; a new admin dashboard is not required by this phase.

### 7.3 Credential and abuse controls

- Store only salted password hashes using a maintained password-hashing implementation appropriate to the runtime. Never plaintext, reversible password storage or a fast general-purpose hash alone.
- Keep credential hashes and privileged account data inaccessible through public browser queries.
- Issue and verify authenticated credentials on the server; include expiry, renewal and revocation in the remembered-sign-in design.
- Never log passwords, full credentials or recovery secrets.
- Validate CAPTCHA tokens server-side at the protected action, not only through a checked UI box.
- Rate-limit claims, name lookups and password attempts as appropriate, with cooldowns against automated guessing and bulk reservations.
- Browser/session limits are supplemental signals. Back them with server controls and trusted request-source/IP handling; do not use spoofable client IDs as the only protection.
- Permit ordinary shared-household use. Exact thresholds and the CAPTCHA provider are chosen in the account server pass; do not add device fingerprinting or additional personal-information collection by default.
- Name lookup intentionally reveals that a public name is claimed. Do not replace this agreed flow with a generic account-existence-hiding journey.

## 8. Account win streak contract

### 8.1 Existing gameplay semantics remain

- Streak eligibility remains single-player against the computer; multiplayer does not contribute.
- A qualifying victory increments once; loss or resignation resets according to existing lifecycle rules.
- Preserve restart/reset handling, pending-game recovery, rematch flow and bonus-line behaviour.
- Renaming or switching presentation alone is not a streak loss.
- The bonus is applied to the computer, once, through the existing server mechanism.
- Menu Reset keeps its existing intent; starting a fresh game while another streak game is unfinished keeps the existing reset consequence.

### 8.2 Ownership and reconciliation

- Signed-in current streak state is server-owned at account level. Local state is a cache, not the authority for account results or resets.
- Guest play retains its browser-based streak behaviour.
- New account: carry the existing eligible guest current streak.
- Existing-account sign-in: reconcile any completed tracked games first, then retain the **higher eligible current streak** from guest and account.
- Equal counts retain the account streak and its tracked game.
- Compare current runs, not historical highest streaks. Do not merge counts or combine wins from independent runs.
- The selected streak retains its linked unfinished game and continuation rights.
- If both sources have unfinished games, follow the higher streak's game, using the account game on a tie. The unselected game must no longer contribute to the account streak; this does not authorise silently resigning or deleting it.

### 8.3 Import integrity

- Import is a one-time transfer of identified guest progress, not repeated `max(localCount, accountCount)` during every sync.
- A consumed import or stale tab must not resurrect a streak after a later loss, resignation or reset.
- A genuinely new independent guest run can be imported on a later sign-in.
- Validate eligibility and supported continuity using existing authoritative game/session evidence. A client-reported integer alone is not trustworthy evidence for an account streak.
- Audit what evidence exists for already-local guest streaks before implementing migration. If full eligible-run verification is unavailable, present the concrete gap and proposed migration treatment in that pass; do not silently invent proof, accept unlimited client counts or drop the agreed carry-over feature.
- Reuse the existing eligible-game reconciliation rules and supported recovery evidence rather than rebuilding a competing lifecycle.

### 8.4 Concurrency and cross-device continuation

- One active account streak run; multiple devices/tabs must not independently advance it.
- Rejoining the selected unfinished game from another signed-in device is supported.
- Starting fresh resets the current account run under the existing product rules.
- Make result application idempotent per game, and protect account mutations/import/reset selection against concurrent requests.
- A lower-count later server revision can represent a legitimate loss/reset. Never resolve ongoing account state by choosing the largest count.
- Authorise rejoin by account ownership of the appropriate participant without granting access to another player's seat or rewriting canonical game history.
- Existing active tab sessions and live game clients require explicit compatibility review before activation.

## 9. Visual specification method and reference inventory

### 9.1 Per-layout briefs

The following images establish the intended screens. Exact dimensions, typography, spacing, component changes, interaction styling and responsive rules are supplied to Codex in the individual layout pass.

Do not infer precise CSS values from image pixels, introduce arbitrary breakpoints or treat an omitted conditional element as a request for removal. Existing styles are the starting point, but the designs include substantial new elements and changes. Reuse does not mean ignoring the supplied visual differences.

Each visual brief should identify:

- The layout and relevant state(s), including desktop/mobile scope for that pass.
- Exact approved measurements and existing primitives to retain or extend.
- Responsive behaviour, scrolling and persistent navigation treatment.
- Real callbacks/preferences that remain connected and any explicit development-only account fixtures.
- Conditional states not pictured, especially win streak, reset and rejoin.
- Owner visual acceptance notes.

Judd will pass each layout separately. Desktop/mobile layouts may be scheduled independently; exact pass numbering and grouping are agreed as the briefs are prepared. Related numbered states of one screen share its behaviour model.

### 9.2 Received references

| File | Role |
| --- | --- |
| `Login Screen 1.png` | Desktop ordinary entry. |
| `Login Screen 2.png` | Desktop claimed-name/password state. |
| `Login Screen 3.png` | Desktop incorrect-password state. |
| `Login Screen 4.png` | Desktop banned-name state. |
| `Menu Screen - welcome.png` | Desktop guest Welcome and shared menu chrome. |
| `Menu Screen - welcome (claimed veiw).png` | Desktop claimed identity variant; filename retained as supplied. |
| `Menu Screen - Single Player.png` | Desktop Single Player and explanatory feature rows. |
| `Menu Screen - Multiplayer.png` | Desktop direct private-game setup and Discord action. |
| `Menu Screen - Claim Name.png` | Desktop account registration and explanatory copy. |
| `Menu Screen - Player Stats.png` | Deferred future reference only. |
| `Mobile - Entry.png` | Mobile ordinary entry and video area. |
| `Mobile - Welcome.png` | Compact mobile Welcome with persistent navigation. |
| `Mobile Large - welcome.png` | Larger mobile Welcome variation. |
| `Mobile - Single Player.png` | Mobile untimed Single Player and persistent navigation. |
| `Mobile - Single Player Timed.png` | Expanded mobile timer grid. |
| `Mobile - Multiplayer.png` | Mobile private-game setup and Discord placement. |

Mobile claimed-account, registration and operational entry variants may be derived from the shared designs in their approved briefs; extra drawings are not required for every state. Home and bottom navigation remain shared, including on taller pages where not visible in a reference image.

## 10. Delivery stages and pass decomposition

These stages define dependency order, not permission for one large implementation. Within each stage, use small separately planned passes.

### 22A — Shared menu foundations

**Type:** Client/UI.

- Inventory current navigation/session/game-launch behaviour and reusable primitives.
- Establish the revised shared menu header, profile rail, guest/claimed visual variants and desktop/mobile navigation foundations.
- Add Welcome/Home routing within the existing menu structure.
- Provide explicit inactive Music/Stats controls and functional Sound preference wiring as scoped.
- Preserve the ability to reach existing game setup, Rules and Lore throughout.

**Exit:** Shared presentation is available for the individual screen passes, without a backend account dependency.

### 22B — Individual layouts and interactive account previews

Order and fixtures amended — see 19 November amendment 9.

**Type:** Client/UI; one supplied layout per scoped pass.

Prepare separate briefs for entry, Welcome, Single Player, Multiplayer, Claim Name and their responsive layouts. Sequence shared dependencies first; refine exact subpass identifiers when each brief is approved.

- Keep real guest entry/game creation operational where their existing services are sufficient.
- Use explicit, controlled development fixtures for account lookup, claiming, sign-in and failure states before backend services exist.
- Keep fixture/service boundaries replaceable without duplicating screen state machines.
- Do not implement temporary browser password storage or show public users a false successful reservation.
- Include existing conditional streak/reset/rejoin surfaces in the revised layouts.
- Complete owner visual review across desktop and mobile before final account integration.

**Exit:** Revised menus are navigable and playable; all required account UI states can be reviewed without real account writes.

### 22C — Account server foundations

Order and fixtures amended — see 19 November amendment 9.

**Type:** Server, followed by a scoped client-runtime connection only when separately planned.

Split as needed into account/session data and credentials, claim/login/remember/logout, name enforcement and abuse controls, preference persistence, and minimal owner recovery/badge operations.

- Audit existing sessions and choose the concrete username-only implementation.
- Implement atomic ownership, secure credentials and explicit remembered-session lifecycle.
- Enforce names through existing create/join/session boundaries.
- Implement the five preference fields and authoritative account identity/badge responses.
- Supply configuration/migration and rollback notes for Judd, including external CAPTCHA setup.
- Allow future account-to-game association where needed for identity/streak ownership; do not build Stats/history aggregation or ratings.

**Exit:** Account operations and preference services have focused server coverage and documented activation requirements.

### 22D — Account streak authority, imports and recovery

**Type:** Server foundation passes, then scoped client/runtime adaptation.

- Audit guest reconciliation evidence and preserve current streak semantics.
- Implement authoritative account lifecycle, result deduplication, reset and concurrency handling.
- Implement one-time higher-current-streak import and tracked-game selection.
- Support authorised cross-device continuation without breaking existing participant ownership.
- Adapt client streak workflows to consume account authority while retaining guest behaviour and existing presentation.

**Exit:** Account streaks behave consistently across devices, imports and repeated/concurrent requests; stale clients cannot restore retired progress.

### 22E — Live integration and acceptance

**Type:** Scoped Client/UI integration plus separately scoped server corrections if needed.

- Replace development account fixtures with real runtime services.
- Connect success messaging, remembered entry, logout, preferences and account streak recovery.
- Check invites, new games, rematches, spectators, rejoin and return-to-menu paths against the live repository.
- Confirm guest flow remains usable and Rules/Lore retain their intended behaviour.
- Review desktop/mobile states, remove or isolate development fixtures and record deferred functionality accurately.
- Review deployment compatibility and activation sequence; a planning or implementation pass does not itself deploy anything.

**Exit:** Judd accepts the screens and representative account flows, and the targeted server checks pass.

## 11. Validation posture

### 11.1 Client and display

- Judd performs the principal visual and interaction review.
- Do not add automated tests for cosmetic changes, layout values, copy, responsive classes or basic component rendering.
- Do not create a frontend test suite or screenshot-test project for this phase.
- Use routine typecheck/build commands required by the repository/pass.
- Add a narrowly focused client behavioural test only when a concrete nonvisual risk justifies it, such as stale identity responses, import replay or a known lifecycle regression. Prefer existing test infrastructure.
- Do not run broad suites repeatedly after a clean scoped result without a new reason.

### 11.2 Account and streak server checks

Use focused tests for the new authority and persistence behaviour, including:

- Claim uniqueness/casing, concurrent claim attempts and server-side name enforcement.
- Password verification, authenticated access, remembered-session renewal/revocation and recovery reset behaviour.
- CAPTCHA failure/replay handling and configured abuse-control boundaries.
- Preference ownership and safe updates.
- Victory applied once; loss/resign/reset not restored by stale writes or imports.
- Eligible guest import, higher-current-streak selection, ties and consumed-import replay.
- Two unfinished runs, cross-device rejoin authorisation and simultaneous new-game/reset/result requests.

Choose representative edge cases over exhaustive permutations or tests that mirror implementation details. Reuse existing streak/game tests and helpers where possible.

### 11.3 Representative owner review

Review ordinary guest entry; claimed/banned/error entry; claim success; returning sign-in; logout; all five preference settings; guest-to-account streak import; existing-account higher-streak selection; unfinished-game continuation on another device; fresh-game reset; private invite entry; mobile navigation/scrolling; and existing streak Reset/Rejoin presentation.

## 12. Deployment and compatibility

- Frontend layout work may be reviewable before accounts are enabled. Public account claims must remain unavailable until real ownership enforcement and required services are ready.
- Inspect any pre-existing sessions using a name before enabling a new claim. Define a transition policy that prevents future impersonation while preserving legitimate active-game continuity.
- Keep existing guest endpoints and active games compatible unless a reviewed activation step explicitly requires otherwise.
- Include account mapping/rejoin authorisation changes in the review of existing clients and tabs. Do not assume server-only activation is harmless without checking the affected paths.
- Apply database changes and secrets/configuration through the approved operational workflow, with clear rollback/disable steps.
- Enable public claims only after required names are reserved, moderation data is seeded and credential/abuse/streak checks are complete.

## 13. Details to settle in the relevant pass

The following are implementation/pass details, not permission to reopen settled product decisions:

- Exact visual values, new graphic/icon assets and remaining responsive compositions.
- Video source/poster, desktop/mobile media treatment and playback/loading behaviour.
- Exact success-message presentation and inactive Music/Stats UI.
- CAPTCHA provider and rate/cooldown thresholds.
- Account schema, hashing/session implementation, expiry and precise cross-tab logout policy.
- The verified guest-streak migration evidence and treatment of any unsupported legacy record.
- Minimal owner recovery/block/badge workflow and initial name-reservation list.
- Founder badge eligibility/artwork if included in its pass.
- Compatibility/activation policy for already-running sessions and games.

Resolve these in a concrete scoped brief against the live code. Do not invent a broad new screen, service or data migration to fill an unspecified detail.

## 14. Completion criteria

Phase 22 is complete when:

- Revised entry, Welcome, Single Player, Multiplayer and Claim Name layouts are owner-reviewed on desktop and mobile.
- The shared guest/claimed rail and persistent mobile Home/navigation work consistently.
- Single Player defaults untimed, the grid collapses correctly and 5 + 3 remains the actual minimum preset.
- Existing game launch, invite, rejoin, rematch, reset and Rules/Lore behaviour are retained except for approved changes.
- Optional username/password accounts work without email collection; claims and banned names are enforced by the server.
- Claim success opens Welcome with confirmation; remembered returns open the menu; Logout returns to entry.
- All five agreed preferences follow the account without breaking guest preferences.
- Account streaks support eligible one-time import, higher-current-run selection and cross-device recovery without duplicate results or stale resurrection.
- Required credential, abuse, account/streak persistence and concurrency checks pass.
- Music playback, functional Stats/ratings/history and account Lore progression remain accurately deferred.
- Activation/configuration, owner recovery and any unresolved limitations are documented for Judd.

## Approved amendments — 18 November 2026 (Judd)

These approved decisions override conflicting text elsewhere in this planning baseline:

1. The menu uses its mobile layout and bottom navigation at ≤767px, matching the game.
2. Music is a working no-op toggle in Phase 22, default On and persisted locally. It is the fifth synced account preference. Music playback is required before the production push and is outside Phase 22 passes.
3. The claimed rail shows inactive, greyed "My Stats" with a coming-soon tooltip.
4. Visual specs come from the supplied 1x PNGs. Existing code governs type sizes and responsive behavior unless a pass brief states otherwise.
5. Soundtrack links and Player Shout-outs move from the old Multiplayer hub to Lore as additional content, without a Lore redesign.
6. Entry uses two self-hosted clips (desktop landscape and mobile portrait) with posters: muted autoplay loop, no controls. Reduced motion shows the poster, and the video never delays the form.
7. Rail/nav icons and Welcome illustrations are supplied as SVG and built as primitives/graphics.
8. Accounts use dedicated Postgres tables through SQL migrations, not the KV table. Drop or replace the unused `screen_names` stub in 22C.
9. The CAPTCHA provider is Cloudflare Turnstile.
10. Remembered sign-in lasts 90 days idle, renewed on use.
11. There is no Founder tier. The claimed-name shield is the only badge and appears for every signed-in account.
12. Battle-log preference remembers the last desktop sister tab deliberately chosen (Battle Log versus Turn Phases), stored per device. This replaces finish-only, tab-scoped persistence; the win-streak tab does not change it and expansion remains transient.

## Approved amendments — 19 November 2026 (Judd)

1. Soundtrack links and Player Shout-outs are disabled for Phase 22. Their code is retained, commented out, in `SoundtrackAndShoutoutsArchive.tsx`. Nothing is added to Lore. This supersedes 18 November amendment 5.
2. The Multiplayer hub is retired. The Multiplayer nav opens private-game setup directly, with the Discord action.
3. 22B is split into 22B.1 (shared setup + Single Player) and 22B.2 (Multiplayer). The win-streak badge/Reset stay right of the heading; Rejoin stays under the subheading.
4. Mobile bottom-nav labels use bold weight (owner adjustment), superseding the black weight specified in 22A.2. Record only; `MenuBottomNav` is unchanged.
5. The Rejoin warning sits directly above the PLAY COMPUTER button. This supersedes item 3's "Rejoin stays under the subheading".
6. From 768px up, the setup header height is deterministic (fixed line boxes; accessories cannot grow the heading row). The first divider aligns across Single Player and Multiplayer in all win-streak and Discord states.
7. Each setup page remembers its last deliberate timing choice and preset on this device (localStorage via menuSetupMemory). This is not an account-synced preference.
8. Mobile centres the Not timed / Timed row.
9. Delivery order: account server first. 22C starts with 22C.0, a design and audit pass recorded in `Phase 22 Addendum - Account Design.md`, which Judd reviews and locks before any SQL or server code. The remaining Entry account states and the Claim Name page are built after the account server, against the real requests, with no development fixtures for account states. This supersedes the fixture bullets and exit wording in §10 22B, and "Replace development account fixtures" in §10 22E. 22B continues with Judd's Entry content edits and the entry video (at the end of 22B).
10. Judd applies database changes by pasting SQL into the Supabase SQL editor. Each change ships as a forward script, a single-query verification and a rollback script, kept in the repo.
11. Development runs the Edge Function locally in Docker (`deno task local-live`) against the live database. Development accounts and rows there are acceptable, and activation includes cleaning them up. Automated tests never touch the live database.
12. Supabase plan: Free. The account design fits its Edge Function limits (2s CPU per request, 256MB memory). Free has no automatic database backups, so a backup decision is part of activation.
13. Security is proportionate for a no-email account: standard practice, with no MFA, device fingerprinting or extra personal data. Password storage uses a standard slow, salted hash.
14. Turnstile remains the CAPTCHA. Development uses Cloudflare's published test keys; Judd creates the Cloudflare account and production keys before activation.

15. The account design record is locked (19 November) with Judd's answers and the lock amendments in its §2.13. Implementation follows the locked record.
16. An owner password reset forces a change-password step. Judd designs the screen; it is built with the Entry/Claim account UI.
17. Backups: weekly manual exports with the Supabase CLI, plus one before every SQL set, stored privately outside the repository. A restore rehearsal is part of activation.

## 15. Implementation record

### 22A.1 — Shared preferences, icon primitives and Welcome illustrations

- **Pass:** Client/UI; client runtime owns the five-preference store, while game display, icon primitives and graphics consume or present client-owned state. No server, account/network, menu layout or tooling changes.
- **Scope:** Shared factory-backed preferences with per-field subscriptions and deliberate writes; GameScreen and LeftRail migration; nine icon primitives; three Welcome illustrations with instance-safe IDs; Build Kit examples; approved amendments and preference-count consistency above. Judd approved the focused preference-hook mock in the existing health-bar lifecycle test as an extension to the original file allowlist.
- **Behavior:** Sound and Health Flash update live across tabs. Chat minimization and preferred sister view seed local rail state at mount; external changes apply on the next mount. Existing downstream props, mobile behavior and win-streak tab behavior are preserved.
- **Validation:** `npm run typecheck`, `npm run build`, and the separate strict TypeScript check of all three Welcome illustrations passed. After the approved test-mock update, `npm run test:client` passed: 830 passed, 7 skipped (optional browser replay disabled), including all 10 new preference tests. New icons are checked transitively through the primitives barrel; the excluded Build Kit is the only consumer of the Welcome illustrations. Build reported the existing large-chunk warning.
- **Browser/runtime checks:** Not run — browser/Vite testing handled by user.
- **Owner review:** Pending (Judd): desktop/mobile toggle and reload persistence; existing saved values; chat and sister-tab persistence; unchanged win-streak tab; cross-tab Sound/Health Flash and stable open-rail layout; nine icons and three illustrations in the Build Kit.

### 22A.2 — Menu shell, profile rail, navigation and Welcome

- **Pass and ownership:** Client/UI, display-owned shared menu chrome and Welcome presentation. The rail consumes the existing client preference store; no account networking, game authority, preference internals, primitives, graphics, entry flow or tooling changed.
- **Scope:** MenuShell integration; local menu header, identity helper, profile rail and desktop/tablet/mobile navigation; WelcomePanel. Welcome is the default on each menu mount, including return from a game. Existing panel bodies, Change Name callback, game creation/fullscreen handling, Play Computer entry effect, win-streak Reset/Rejoin, private-game sub-panel/highlighting and Lore unread clearing are preserved. The Multiplayer hub, headline, soundtrack and shout-outs remain unchanged for 22B.
- **Identity preview:** Only the identity helper reads `accountPreview`. In development, `?accountPreview=claimed` enables claimed presentation and persists it in tab-scoped sessionStorage; `?accountPreview=guest` clears the flag. Storage failures are tolerated. Production always presents guest identity, and the built JavaScript contains no preview parameter. Claim Name and preview Logout have no action; My Stats is focusable, grey and `aria-disabled`, with its coming-soon tooltip. No account service or fixtures were introduced.
- **Rail and navigation:** One-row/slanted rail from 1280px and two-row rail below; left navigation from 1025px, horizontal navigation at 768–1024px and fixed Home/bottom navigation through 767px. Every new button has a visible pastel-purple focus outline. Tooltips support desktop fine-pointer hover and keyboard focus, suppress touch display and use `role="tooltip"`/`aria-describedby`. Music and Sound toggle their existing shared preferences; Music does not play audio.
- **640–767px:** Mobile chrome throughout: bottom navigation, two-row rail with a 26px maximum name, 20px action icons, 14px labels, an explicitly overridden 14px status dot, and full-width distributed 12px social links. No menu-chrome layout switch remains at `sm`; only the approved existing logo/title size tiers remain there. The untouched Single Player/Rejoin presentation retains its own existing typography breakpoints.
- **Welcome:** One shared guest/claimed page with the existing illustrations. The decorative die selects a random face 1–6 once per Welcome mount, uses the existing one-second mount roll/pulse with a fixed defined animation key and rotation disabled, and rolls again after returning to Welcome. The existing reduced-motion hook disables the mount animation. It has no sound or relationship to game dice. Dice itself is unchanged.
- **Approved adjustments:** Header stays stacked below 1024px, with wrapping social links in the row from 1024px. Desktop Welcome columns stay 300px while the gap shrinks as needed below 64px. Name fitting may use an emergency 12px floor, preserving the full name and claimed badge beyond the original preferred 26px/18px minima.
- **Proposed values (P), owner review pending:** Slant clearance approximately 24px at its bottom/84px at its top; claimed badge 32px with 12px gap, mobile 20px with 8px gap; action-pair gap 28px; action-label maximum width 64px below 400px (removed from 400px in the refinement below); tablet action labels 16px; rail-to-content spacing 64px at ≥1280px, 32px at 768–1279px and at least 20px on mobile (Welcome may centre within the remaining height); headline-to-grid spacing 72px/32px. Dice boxes are 173px/89px to account for the source PNG's transparent margins and produce approximately 156px/80px visible faces.
- **Validation:** `npm run typecheck` and `npm run build` passed. Build retains the existing large-chunk warning. Static traversal of all 54 configured client/display test roots found no changed file in their import graphs, so `test:client` was not run; no tests were added. Generated CSS contains the important responsive status-dot overrides, focus outlines, Welcome grid and fine-pointer tooltip rules. Production output excludes `accountPreview`.
- **Browser/runtime checks:** Not run — browser/Vite testing handled by user.
- **Owner review:** Pending (Judd): guest/claimed rails and wide 20-character names at 1920, 1440, 1280, 1279, 1024, 768, 414 and 360px; 640–767px mobile chrome; header link wrapping near 1024px; keyboard focus; desktop hover/focus tooltips and touch suppression; Music/Sound persistence into the next game; navigation/highlights and Lore dots/clearing; long-page safe-area clearance; Welcome landing/remount random roll and reduced motion; unchanged Change Name, Single Player/streak, Multiplayer/create flow, Rules and Lore.
- **Existing primitive caveat:** The app entry does not use StrictMode and Dice's mount-ref logic supports this mount animation. Changing reduced motion during an active roll clears its timers and shows the selected face, but leaves its internal rolling flag set; this existing Dice behavior was not changed. Future StrictMode adoption would also require a separate review of that primitive's mount-ref behavior.
- **19 November 2026 refinement — references and scope:** `Mobile Large - welcome.png` (420×891) is the reference for mobile Welcome centring and large-mobile rail actions, with `Mobile - Welcome.png` (360×800) and Judd's 408px development screenshot as comparisons. Changes are confined to MenuShell, WelcomePanel, the profile action row and this 22A.2 record; header, navigation, other panel bodies, primitives, preferences and tooling are untouched.
- **Mobile Welcome centring (≤767px only):** The inner shell reserves the small viewport height minus the existing 20px top padding and the bottom nav's 86px plus safe-area inset, using `100svh` with a `100vh` fallback. The existing outer 120px-plus-safe-area scroll clearance remains outside this centring space. Welcome's content area grows with symmetric 20px minimum gutters, and automatic vertical margins centre the headline/grid as a single block only when space remains. Content taller than the available height stays in top-aligned scrolling flow. Desktop/tablet Welcome and all other panels retain their top alignment.
- **Large-mobile/two-row action refinement (400–1279px):** Icons stay above single-line labels with the 64px cap removed. Account pair, divider and Music/Sound pair use equal edge/inter-group spacing without horizontal row padding; within-pair gaps remain 28px. Height is content-driven, with 18px top/bottom padding and a 42px divider (at least 78px overall, rather than a forced 71px). The same layout applies to claimed Logout/My Stats. Below 400px and the one-row rail from 1280px are unchanged.
- **Refinement validation and review:** `npm run typecheck` and `npm run build` passed; the existing large-chunk warning remains. No tests added or run. Responsive CSS pickup and the zero-padding rule's tablet precedence were checked in the build output. Browser/runtime checks: Not run — browser/Vite testing handled by user. Owner review pending at 360×800, 390×844, 412×915, 414×896 and 420×891; short 360×640 scrolling; toolbar stability; guest/claimed labels around 400px and through 1279px; unchanged other panels and one-row rail.

### 22B.1 — Shared game-setup panel and Single Player page

- **Pass and ownership:** Client/UI, display-owned setup layout and explanatory content. Changes are confined to CreatePrivateGamePanel, Single Player props/accessory presentation in MenuShell, the new SinglePlayerFeatures component and this record. No server rules, networking, preferences, primitives, menu chrome, tooling or tests changed.
- **Timing and mounts:** The shared panel accepts optional `defaultTimed` (default true) and `footer` props. Single Player passes false and opens Not timed with presets/helper collapsed; Multiplayer's create screen retains Timed, 15 + 10. Both remain in their existing distinct conditional slots, so initial timing/preset state cannot carry between modes. Selecting a preset, toggling Not timed and returning to Timed on the same screen retains that preset. The 5 + 3, 10 + 5, 15 + 10 and 30 + 20 values and null timer fields for untimed submission are unchanged.
- **Shared layout:** Not timed precedes Timed on one left-aligned row, with a 40px option gap. The grid sits 40px below it, replacing the old side-column layout. Untimed presets and helper collapse at every width with the existing 150ms max-height/opacity transition; collapsed presets are disabled, pointer interaction is blocked and collapsed content is hidden from accessibility APIs. From 768px, the helper sits at the radio row's right edge and may wrap; below 768px, it is centred beneath the grid. Existing dividers, block gaps, tile treatments, button variants and 1080px content maximum remain.
- **1280–1535px layout (owner refinement):** The two-column grid retains `max-w-[560px]`, left-aligned beneath the radio row with unused content width to its right. It does not stretch into wider tiles. At 1536px (`2xl`), the existing cap override allows a four-column full-width row.
- **Single Player:** Heading is "Play Computer" and subheading is "Start a game against a computer opponent." The white PLAY COMPUTER button remains. Streak badge/Reset remain on the heading row's right side on desktop/tablet; mobile stacks and centres the accessories. Rejoin remains directly below the subheading. Existing conditions, Reset confirmation/busy behavior, entry effect, fullscreen attempt, creation callbacks, errors and CREATING... state are preserved. The Multiplayer hub remains in place for 22B.2; its create screen adopted the shared setup layout early by design.
- **Features:** A presentation-only semantic section contains the SINGLE PLAYER FEATURES h3 and a definition list for Win Streaks, Missions and Challenges, using the supplied copy and italics on "with" and "without". Rows use grey-90 background alpha of 100%/70%/50%, with fully opaque white text. Desktop/tablet uses 20px text, 150px label columns, 24px vertical/32px horizontal padding and 8px row gaps. Mobile uses 15px labels, 13px descriptions at 1.3 line height, 100px label columns, 16px padding and 6px row gaps. Rows expand naturally when descriptions wrap.
- **Proposed values (P), owner review pending:** 64px desktop/tablet button-to-feature gap (32px mobile) and 8px row radius. Desktop single-line rows are approximately 72px tall from 24px line height plus padding.
- **Type sizes deliberately retained for owner review:** Mobile heading base 24px (design about 30px); desktop helper 20px (design 16px); mobile helper base 15px (design about 12px); mobile subheading base 15px (design 16px). Existing `sm` type tiers remain: 640–767px uses 36px heading, 20px subheading/helper and 26px radio labels while retaining mobile alignment and accessory stacking. Layout alignment switches at 768px.
- **Validation:** `npm run typecheck` and `npm run build` passed. Build retains the existing large-chunk warning. Static generated-CSS inspection confirmed the 560px cap, 768px layout rules, 1536px cap override/four-column grid, collapse transition and feature background-alpha rules. `git diff --check` passed. No tests added or run.
- **Browser/runtime checks:** Not run — browser/Vite testing handled by user.
- **Owner review:** Pending (Judd): Single Player at 1920, 1440, 1280, 1024, 768, 414 and 360px; untimed initial state, 15 + 10 on first Timed selection, retained selections during toggles and fresh defaults after switching modes; helper placement/wrapping; timed/untimed game creation; streak/Reset positioning and confirmation, Rejoin placement; feature copy, italics, fading backgrounds and wrapping; Multiplayer hub → Create Private Game still opening Timed, 15 + 10 and creating correctly. Check the capped two-column layout at 1280–1535px and the preserved type differences above.

### 22B.2 — Multiplayer page, Discord action and hub retirement

- **Pass and ownership:** Client/UI, display-owned menu routing, shared setup presentation and one Build Kit primitive variant. Changes are confined to MenuShell, CreatePrivateGamePanel, MenuNavigation types, MenuButton, BuildKitShowcase, the retired MultiplayerPanel, the new commented archive and this plan. No server authority, networking, preferences, game creation services, entry, tooling or tests changed.
- **Direct setup and mounts:** Multiplayer now mounts CreatePrivateGamePanel directly with its existing private-game submit handler, fullscreen attempt and onGameCreated callback. The createPrivateGame panel ID/sub-panel and unused onBack prop are removed. Single Player and Multiplayer retain distinct conditional slots, so their initial Not timed versus Timed / 15 + 10 defaults cannot carry across. Multiplayer highlights normally through the shared navigation page ID. Existing creation, loading/error handling, invite URLs and join flow are preserved.
- **Discord action:** The shared panel accepts optional secondaryAction content. At 1280px and above it sits right of the heading/subheading group, top-aligned with the heading; at 768–1279px it sits below CREATE PRIVATE GAME, left-aligned; through 767px it sits below that button, centred. Complementary display:none wrappers expose only one action at a time. The real button uses DiscordIcon and FIND OPPONENTS ON DISCORD, opening https://discord.gg/MjPtf4G6Gt in a new tab with noopener,noreferrer. Enabled hover scales to 105%; keyboard focus has a pastel-purple outline.
- **Primitive and Build Kit:** MenuButton adds communityOutline, optional leadingIcon and outlineSize (desktop, compact or responsive; desktop by default for this variant). Desktop is 352×72px with 18px black-weight text and 28px horizontal padding; compact is 280×56px with 14px black-weight text and 16px horizontal padding. Responsive sizing switches at 768px. Both use a black background, 2px pastel-blue border, 10px radius, pastel-blue label/icon, 24px icon and 8px gap. Existing variants are unchanged. Build Kit shows both fixed sizes under Menu Screens Buttons.
- **Hub retirement and archive:** MultiplayerPanel is deleted. SoundtrackAndShoutoutsArchive.tsx preserves both datasets, SectionHeading and its props, required imports and both section JSX blocks entirely as line comments, with the owner restoration header. It is not imported. Nothing is added to Lore. The hub headline remains on Welcome.
- **Preserved presentation and reference differences:** All other 22B.1 shared setup layout, typography and timer values remain, including 5 + 3 rather than the PNGs' 5 + 0. Single Player streak badge/Reset and Rejoin placement/behavior are unchanged. Header, rail, Welcome, Rules and Lore are untouched. Amendment 4 records the owner-approved bold mobile bottom-nav labels; MenuBottomNav is unchanged.
- **Proposed values (P), owner review pending:** Below-primary placement at 768–1279px; 24px primary-to-Discord gap below 1280px (existing 16px action-stack gap plus 8px margin); compact horizontal padding 16px; heading-group-to-Discord horizontal gap 24px at 1280px and above.
- **Validation:** npm run typecheck and npm run build passed; build retains the existing large-chunk warning. git diff --check passed. Static source checks found no imports of the archive or deleted hub and no obsolete panel-ID references (the unrelated App creation callback remains). The archive's datasets, helper and section JSX were compared with the retired hub and preserved exactly; every nonempty archive line is commented. Generated CSS includes responsive dimensions, complementary display rules, purple focus outlines and enabled hover scaling. Build Kit wiring was statically reviewed because the configured typecheck excludes its directory. No tests added or run.
- **Browser/runtime checks:** Not run — browser/Vite testing handled by user.
- **Owner review:** Pending (Judd) at 1920, 1440, 1280, 1024, 768, 414 and 360px: direct setup with Timed / 15 + 10; independent timing defaults when switching Single Player and Multiplayer; creation and invite URLs; navigation highlighting; Discord placement, dimensions, new-tab behavior and keyboard focus; absent soundtrack/shout-outs and unchanged Lore; Build Kit examples at both sizes.

### 22B refinement — Setup header consistency, Rejoin placement and timing memory

- **Pass and ownership:** Client/UI follow-up to 22B.1/22B.2. Display owns the shared setup layout, intent callbacks and MenuShell wiring; the new client-runtime menuSetupMemory helper owns device-local persistence. Only CreatePrivateGamePanel, MenuShell, menuSetupMemory.ts and this plan changed. No five-preference store/account sync, win-streak logic/view models, primitives, menu chrome, Welcome, Lore, networking, server, tooling or tests changed.
- **Deterministic header:** Heading line boxes are 28px at 24px text and 42px at the existing 36px sm tier. Subheading line boxes are 18px at 15px text and 24px at the existing 20px sm tier. From 768px the heading row is explicitly 42px high with vertically centred content; the accessory wrapper is non-wrapping, retains its existing gaps and stays right-aligned. Mobile keeps the existing stacked, centred heading/accessory/subheading order. Discord remains top-aligned in its existing right column from 1280px.
- **Static divider verification:** From 768px the header is 42 + 16 + 24 = 82px; the 40px badge fits the heading row, compact Reset stays on one line, and the 72px Discord action is shorter than the header. No streak, active streak, ended streak, Rejoin candidate and Multiplayer therefore share the same header height. Including the unchanged outer block gap, the first divider's top offset from the panel top is 132px at 1920px and 112px at 1440, 1280, 1024 and 768px. Generated CSS confirms the explicit line heights, 768px fixed heading-row/centred-items rules and 1280px Discord visibility. This is static layout verification, not a browser measurement; owner visual review remains pending.
- **Rejoin placement:** The unused subheadingAccessory prop is replaced by primaryActionNotice. Rejoin is below the second divider, directly above the primary button, with notice then creation error then button order. Copy, pastel-red styling, underlined link, condition and tracked-game callback are preserved. The notice is centred on mobile and left-aligned from 768px.
- **Mobile timing row:** Not timed / Timed is centred through 767px for both setup pages. From 768px it remains left-aligned with the unchanged helper at the right end.
- **Device-local timing memory:** menuSetupMemory exports typed page/preset/record contracts plus readMenuSetupMemory and writeMenuSetupMemory. The separate keys are shapeships.menuSetup.playComputer.v1 and shapeships.menuSetup.multiplayer.v1, each storing { timed, presetKey }. Reads validate a boolean timed field and one of the four existing preset keys; absent, malformed or invalid values return null. Reads/writes catch unavailable-storage and serialization errors. This data is separate from the five account-synced preferences.
- **Initialization and deliberate writes:** MenuShell reads the selected page's record on entry and passes initialTimed/initialPresetKey to the panel. Separate conditional panel slots remain. No valid record means Single Player starts Not timed / 15 + 10 and Multiplayer Timed / 15 + 10. The panel owns current state and emits onSetupChange only from mode activation (click or Enter/Space) or preset-tile activation. MenuShell writes the page-specific record on each deliberate activation, including reselecting a current value. There are no mount, render, effect or creation writes. The last preset remains saved when switching to Not timed; submission still uses current state and null timer fields when untimed.
- **Validation:** npm run typecheck and npm run build passed; build retains the existing large-chunk warning. git diff --check passed. Static review confirmed only the four allowed files changed, old subheadingAccessory/defaultTimed references are gone, storage implementation is confined to the new helper, page keys are distinct, and write call sites are deliberate-action callbacks. Generated CSS confirms line boxes, fixed heading height, accessory no-wrap and mobile/desktop timing-row alignment. No tests added or run.
- **Browser/runtime checks:** Not run — browser/Vite testing handled by user.
- **Owner review:** Pending (Judd): divider parity across all five states at 1920, 1440, 1280, 1024 and 768px; single-line streak/Reset fit including confirmation text; Rejoin positioning/link behavior; centred mobile timing row; Single Player Timed / 5 + 3 persistence through Rules navigation, games and reloads; independent Multiplayer memory; clearing site storage restores page defaults.
- **Risks and assumptions:** Storage can be blocked or full; deliberate choices still update the current panel, but persistence is best-effort. Saved choices are reread on page entry, without live cross-tab synchronization. Existing text sizes/gaps and Reset confirmation copy are retained; horizontal accessory fit at narrower desktop/tablet widths remains for owner review. No measured header min-heights, absolute positioning or runtime measuring scripts were introduced.

### 22C.0 — Account design and audit

- **Pass and ownership:** Server Pass, design and audit only, with read-only inspection of client runtime/session code. Account/name authority, credentials, data access and transactions remain server-owned; no implementation crosses ownership layers.
- **Files:** New [Phase 22 Addendum - Account Design.md](Phase%2022%20Addendum%20-%20Account%20Design.md); this roadmap's amendments 9–14, two §10 pointers and this record. No code, executable SQL, config, environment, tests or client changes.
- **Scope:** Repository/session/name-trust audit and supplied database inventory; proposed data/access model, hashing, tokens/linkage, complete request/error contract, moderation/abuse, five-preference sync, procedural owner operations, activation/rollback and scoped follow-up passes. Owner refinements R1–R8 are incorporated; executable owner SQL is deferred, and local reset tooling is a separate pass.
- **Design status:** **proposed, awaiting owner lock**. Judd and the planning assistant review the audit and **10 open questions** before locking proposals and briefing 22C.1. Approval to produce the record does not activate accounts or approve its proposed implementation decisions.
- **Resolved maintenance:** Judd confirmed duplicate KV indexes removed on 19 November 2026; `kv_store_825e19ab` now has **2 indexes**. The inventory's former index counts and 270 MB table size are historical; no post-cleanup size was measured here. Index maintenance is outside account passes. Activation still checks current total database size/headroom against the Free plan's 500 MB limit.
- **Validation:** Not run — documentation-only pass (typecheck, build and tests). Static documentation/diff review only. No database requests, hosted probes, benchmark or deployment.
- **Risks and assumptions:** Hosted hash CPU/memory, trusted source-IP extraction, production Turnstile configuration, backup choice, SQL privileges/constraints and active-seat compatibility require later verification. Normalization must be locked before the first real hash; owner recovery follow-up, Auth-user disposition and optional KV browser-grant hardening remain questions in the record.

### 22C.1 — Account lock, SQL set 01 and dormant mode

- **Pass and ownership:** Server Pass. Account contracts, schema/access and endpoint admission are server-owned. No client/UI, gameplay rules, session/me, CORS configuration, environment or tooling changes.
- **Files:** Account Design lock/amendments; this roadmap; supabase/manual/account/README.md and 01-forward/verify/rollback.sql; server accounts/accountsMode.ts and accountResponses.ts; routes/account_routes.ts; index.tsx import/registration only; tests/routes/account_routes_test.ts.
- **Design lock:** Locked 19 November 2026 (Judd), LA1–LA13. NFC, forced password change, hourly token renewal, implicit revision-free session linking, read-route exemptions, non-on seat/session fallback, names-only emergency mode, backup/recovery decisions and alternative IP activation are recorded. Later account functionality remains in its scoped passes.
- **SQL:** Set 01 is manual and unapplied. Forward validates every prerequisite before removing the inventoried empty stub and creating eight RLS/no-policy account tables. It counters inherited grants and revokes only browser grants on the four named KV tables. Both mutating scripts are one transaction, with no CASCADE drops or transaction-incompatible commands. Rollback refuses populated account tables unless its explicit data-loss override is enabled. Verification is one SELECT with an overall result, object/access/constraint/index checks, Auth count 1 and retained KV row counts.
- **Dormant service:** ACCOUNTS_MODE parses once per worker; unset/invalid => off, invalid emits one sanitized warning. After existing CORS middleware, app.all covers bare accounts and accounts/*: off/names-only => 503 ACCOUNTS_NOT_ENABLED without Retry-After or account-service dependency access; on => JSON 404 NOT_FOUND. Account errors are no-store and support explicit matching retry delays. Existing preflight/routes are preserved.
- **Validation:** deno task check and git diff --check passed. Only the explicitly named account_routes_test.ts ran, with cached dependencies, named environment permissions and no --allow-net: 8 passed, 0 failed. PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION remained unset. Existing Deno warnings about ignored allowImportingTsExtensions/allowJs remain. No npm checks/build, live DB, local-live or deployment.
- **SQL test status:** Static inventory/script review only; disposable PostgreSQL not run because no psql/postgres executable is available and Docker's daemon is unavailable. Planning-assistant mock tests must cover clean forward/verify/rollback, failing-precondition atomicity and populated rollback refusal before application.
- **Risks and assumptions:** SQL runtime/ACL guarantees await mock and owner verification. Exact historical KV ACL letters were not inventoried; rollback re-grants ALL, the approved harmless RLS-protected superset. KV counts are sanity checks, not exact historical baselines. Service grants and schema scope/action identifiers are explicit in the SQL README for later passes. Names-only name enforcement and seat fallback are contracts for later passes, not implemented gameplay changes here.
- **Owner steps, in order:** Send three SQL files to planning assistant for mock testing; take private manual export; paste full forward script as postgres; run verification and send results; optionally identify Auth user through Dashboard → Authentication; leave ACCOUNTS_MODE unset and enable on in .env.local-live only when 22C.2 lands. No deployment is implied.

### 22C.2a — Credential/token foundations and SQL set 02

- **Pass and ownership:** Server Pass, first review stage of 22C.2. New accounts/passwordPolicy.ts, passwordHashing.ts, hashAdmission.ts, tokens.ts, nameKeys.ts and accountRepository.ts; manual account SQL set 02 and README; deno.lock adds only hash-wasm@4.12.0; five new focused test files under tests/accounts/. No endpoint wiring or game/client/UI changes in this stage.
- **SQL status:** Set 01 is owner-reported applied on 20 November 2026, verification PASS with zero failures. Set 02 was owner-reported applied on 20 November 2026 with **02-verify PASS**: exactly ten service-only invoker functions, empty search paths, mutator lock_timeout=2s, transactional claim/issuance/password change, CAS rehash, read-only identity and independently authorized link helper. Verification checks the exact signature set/configuration and retained RLS/ACL posture; rollback drops only set 02 functions with RESTRICT and refuses later routines. No SQL was executed by this pass.
- **Security refinements:** Link helpers independently validate account/token ownership, active status, version, expiry and revocation. Credential reads reveal no block status; ACCOUNT_BLOCKED can be reported by credential routes only after password verification. Claim advisory key (22002, 1) is reserved for set 04's exclusive rule-edit lock. First-link insertion serializes through the binding PK and a locked ownership recheck.
- **Credentials:** NFC with malformed-Unicode rejection and locked point/byte limits; fixed-cost Argon2id through hash-wasm@4.12.0; strict PHC validation and constant-time digest comparison; four worker slots, no queue, finally release. Opaque 32-byte tokens store only SHA-256. Owner clarification: noncurrent hash costs are service faults; future cost changes explicitly allowlist a previous set. The rehash/CAS path remains available for an injected outdated-policy result.
- **Validation:** deno task check passed. Explicit cached/frozen no-network tests password_test.ts, hashAdmission_test.ts, tokens_test.ts, nameKeys_test.ts and accountRepository_test.ts: **8 passed, 0 failed**. Existing ignored-compiler-option warnings remain. One synthetic local hash measured 27.2 ms wall time; this is not hosted CPU, peak memory or a statistical benchmark. git diff --check passed. No npm checks, live integration, database, local-live, environment edits or deployment.
- **Handoff:** Shapeships-22C.2a-report.txt and Shapeships-22C.2a.zip capture this stage before 22C.2b edits. Judd sends them for PostgreSQL 17.6 mock tests, backs up, then may apply set 02 and verify while mode remains off. 22C.2b can proceed meanwhile; local on-mode waits for that stage, and public activation remains separately gated.
- **Remaining risks:** Fakes/adapter tests do not prove SQL concurrency or ACL runtime behavior. The planning-assistant mock must exercise direct helper misuse, simultaneous claims/first links, CAS/reset races, exact signature/configuration checks and rollback/precondition atomicity. No design deviation; protection, gameplay enforcement, owner routines and cleanup remain in their later passes.

### 22C.2b — Enabled account service and compatible session metadata

- **Pass and ownership:** Server Pass, second review stage of 22C.2. Added accounts/accountRequests.ts, humanCheck.ts, rateLimit.ts and accountService.ts. Updated accounts/accountResponses.ts, routes/account_routes.ts and index.tsx. Added tests/accounts/fakeAccountRepository.ts, accountTestFixture.ts, accountService_test.ts and tests/routes/account_enabled_routes_test.ts. Set 02 SQL behavior is unchanged; its original delivery pass did not apply it. Judd confirmed application on 20 November 2026 with **02-verify PASS**. Stage-a revision 2 removes one trailing blank line from 02-forward.sql and updates the report/manifest; its ZIP otherwise preserves the original checkpoint, retained as Shapeships-22C.2a-v1.zip.
- **Routes and boundaries:** The existing mode guard lazily acquires the service only when on. Claim, sign-in, password change, resume and logout use the service-role RPC adapter and locked envelopes. Strict JSON/body schemas enforce the streamed 8 KiB cap, reject ownership assertions/unknown fields and preserve the five preference values. Account responses, including preflight and errors, are no-store. Unknown paths/methods return JSON 404/405. Logout accepts an empty body and ignores optional session headers; unknown/missing/revoked/expired credentials remain idempotent.
- **Credential behavior:** Blocked accounts return the same INVALID_CREDENTIALS response as unknown accounts for wrong passwords; only verified credentials can reveal ACCOUNT_BLOCKED. Forced-change sign-in returns PASSWORD_CHANGE_REQUIRED without a token and records verification success. Password change validates the new policy first, checks NFC equality only after verification, and verifies/hashes sequentially in one admission. Opportunistic rehash writes only after successful issuance, uses CAS without advancing security version and cannot turn an already committed sign-in into an unavailable response.
- **Protection seams:** Claims fail closed by default with CAPTCHA_UNAVAILABLE and Retry-After 5; no production CAPTCHA/network implementation is included. Sign-in has no CAPTCHA yet. Explicitly marked 22C.3 rate hooks cover entry, validated targets, pre-hash admission, verification outcomes and token operations; their default is allow. Gateway/session/account credential headers are removed from limiter context; token hooks receive digests. Hosted mode remains off.
- **Session compatibility and accepted index adjustments (R4):** CORS permits X-Account-Token and exposes Retry-After through shared production/test options. Generic debug URL logging excludes account traffic and /session/me; safe account logs contain category/code only. The shared session-validator catch no longer logs raw exceptions. The session/me handler is registered through a testable seam, adds validated matching-link identity or null without renewal/link writes, skips account dependencies in non-on modes, and never gates the underlying session read on optional-account failures. Existing session 401 statuses, bodies/messages and the game-session validator/requireSession behavior remain intact. Game routes, participant provenance and session/start are untouched.
- **Validation:** deno task check passed. All seven explicitly enumerated new test files below ran with cached/frozen dependencies, only the two named environment permissions and no --allow-net: **39 passed, 0 failed**. Coverage includes staged transaction rollback, simultaneous claims/first links, direct helper misuse through the fake, token deadlines/renewal/revocation, security-version and credential-only races, forced/voluntary password change, one-admission sequencing, real hash round-trip/rehash, CORS/modes, exact legacy session 401 envelopes and credential/log privacy. Existing ignored-compiler-option warnings remain. The final synthetic local single-hash wall time was 25.9 ms; no hosted CPU/memory measurement is claimed. git diff --check passed. No npm checks, live-integration flags, database, local-live, environment/config changes or deployment.

```powershell
deno task check
deno test --cached-only --frozen '--allow-env=ACCOUNTS_MODE,ENABLE_SERVER_DEBUG_LOGS' src/supabase/functions/server/tests/accounts/password_test.ts src/supabase/functions/server/tests/accounts/hashAdmission_test.ts src/supabase/functions/server/tests/accounts/tokens_test.ts src/supabase/functions/server/tests/accounts/nameKeys_test.ts src/supabase/functions/server/tests/accounts/accountRepository_test.ts src/supabase/functions/server/tests/accounts/accountService_test.ts src/supabase/functions/server/tests/routes/account_enabled_routes_test.ts
git diff --check
```

- **SQL/handoff status and owner steps:** The stage-a ZIP contains 28 entries with an SHA-256 manifest and is a review snapshot, not a database backup or full repository. Send it and its separate report for the planning assistant's PostgreSQL 17.6 mock, then back up privately, apply set 02 and run its verification. After any failed editor run, execute rollback; alone. Set 02 can be applied while mode is off; only Judd changes local on-mode after 22C.2b and successful SQL verification. Claims intentionally stay closed until 22C.3. No hosted enablement follows.
- **Risks/assumptions:** Fake transactions and adapter tests do not establish real SQL isolation/ACL guarantees. PostgreSQL mock/owner verification and hosted Argon2 compatibility/CPU/memory remain required. Real rate limiting, Turnstile/replay protection, gameplay/name binding, moderation seeds, owner routines and cleanup remain deferred as scoped. Owner clarification accepts only the current hash costs, with an injected obsolete-policy result testing the real replacement/CAS path. The narrow index logging/session extraction adjustments were explicitly accepted; no locked design decisions were reopened.

### 22C.3a — Turnstile, persisted limits, name-check and SQL set 03

- **Pass/ownership:** Server Pass. Changed accounts/accountRepository.ts, accountService.ts, humanCheck.ts and rateLimit.ts; added accounts/clientIp.ts, nameRules.ts and accountServiceLoader.ts; index.tsx changes only account logging and loader wiring. Extended tests/accounts/accountRepository_test.ts and fakeAccountRepository.ts; added fakeAccountProtection.ts and the seven focused test files enumerated in the manual account README. No client/UI/game-route or configuration changes.
- **Manual package:** Added 03-forward.sql, generated 03-seed-name-rules.sql, 03-verify.sql and 03-rollback.sql, plus sources/build-name-rules.ts, sources/README.md and generated sources/name-rules-report.md. Retained all three owner-supplied JSON inputs. Updated the manual README and Account Design addendum (§2.14). The package and provenance/report are the handoff reference.
- **Current database status, owner-reported 20 November 2026:** sets 01 and **02 applied**, both verification scripts PASS; on-mode local-live smoke passed all eight checks. These confirmations supersede historical unapplied/owner-step wording in the 22C.2 delivery notes above. **Set 03 remains unapplied**; this pass made no database/local-live/deployment request.
- **Moderation amendment (R1/R5):** The built dsojevic file omits allow_partial; supplement missing fields from grouped src/en.json by ID, disambiguating repeated IDs by match/severity/tags. Provenance records all three SHA-256 values and both profanity hashes on seeded rows. Result: **520 contains bans, 107 exact bans, 469 reservations**. Essex/Sussex/Sextant/Grape pass after restoring the source flags. Therapist still matches rapist; its proposed exact exception is not inserted. Document passes moderation but remains reserved. The report includes every reserved name compactly, all transformations/drops and the full removed Snapchat block. B4dw0rd is a labelled synthetic-rule test only.
- **SQL:** Forward validates set 02 and retained set 01 security posture, adds strict matcher/masking constraints and resume_global/logout_global scopes, replaces account_check_name without changing its signature/SQLSTATEs, and adds four invoker/service-only RPCs. Verification expects fourteen exact functions/configurations and supersedes 02-verify; it reports counts and runs SQL matcher spot checks. Seed reruns take exclusive lock (22002,1), replace only generated-source rows and preserve owner conflicts. Rollback restores set 02 verbatim and refuses later sets or retained wildcard/masking dependencies.
- **Protection:** Atomic database-clock counters implement L13, recognized versus unknown-token selection, largest retry delay and cumulative verification-failure escalation. Turnstile validates hostname/action/age with a five-second deadline and a ten-minute persisted replay guard. Claim consumes immediately before creation; sign-in/password consumes before hashing. IP modes are explicit development/header:<name>/la13, IPv4-mapped addresses share IPv4 subjects, IPv6 uses /64 and subjects use HMAC-SHA256. Missing required configuration fails closed. Cleanup handles at most 100 expired counter/replay rows, at most once per worker minute; token/owner cleanup remains 22C.4.
- **LA13 owner-review constants (R2):** name-check 600/minute, claim **300/hour**, sign-in **600/15 minutes**, password 60/15 minutes, resume/logout 1,200/minute each. These apply only in explicit LA13 mode, with applicable target/token limits; password/sign-in share failure scopes. Turnstile is required on every LA13 claim/sign-in/password operation. Already admitted concurrent verifications may finish before their failures commit; these counters do not reserve hash slots.
- **Configuration/actions (R3/R4):** README gives the exact additional local block for ACCOUNTS_TURNSTILE_SECRET (published pass dummy), ACCOUNTS_LOCAL_TEST_MODE=true, ACCOUNTS_TURNSTILE_HOSTNAMES=example.com, ACCOUNTS_IP_SOURCE=development and a 64-hex-character secret placeholder with a Windows PowerShell cryptographic-generation command. Widget action is **claim** for claim and **sign-in** for escalated sign-in and password. Only local dummy-key responses relax hostname/action behavior, and only the fixed dummy token skips replay. Environment files are unchanged.
- **Routes/logging:** Mode-guarded name-check needs no game session, validates only {name}, returns four no-store outcomes and stored claimed casing, and treats banned/reserved as outcomes. Existing ownership wins over a reservation; bans win over ownership. Lazy import rejection clears the cache for retry. Logging records safe IDs/results/durations/scope/retry information without raw IPs, secrets, credentials, proofs, subject hashes or DB errors.
- **Validation:** deno task check PASS; all fifteen explicitly enumerated account/route test files in the manual README PASS (**70 tests, zero failures**) with cached/frozen dependencies, only named environment/read permissions and no --allow-net. Deterministic generator output comparisons PASS; generated SQL is 223,794 UTF-8 bytes in one file. git diff --check PASS for authored work; the staged check preserves 25 original whitespace-only lines in the supplied gist, and passes excluding only that byte-pinned snapshot. Existing Deno ignored-option warnings remain (allowImportingTsExtensions/allowJs). The live-integration flag is unset. No database, local-live, environment/config edits, deployment or hosted hash benchmark.
- **Remaining owner steps/risks:** Planning assistant mock-tests set 03 on PostgreSQL 17.6, including every review case, rule/claim locking, real counter/replay concurrency, ACLs and rollback; include historical names if supplied. Then private backup → forward → seed → verify, local settings and extended claim smoke. Generated review uses the TypeScript contract matcher; actual SQL was not executed here. Review Therapist's exception, Document/other reservations and the named LA13 constants before activation. 22C.3b owns gameplay name enforcement/provenance/LA6 suspension and a local gameplay test; 22C.4 owns preferences and owner routines.

### 22C.3a fix — Turnstile proof-age clock tolerance — 21 November 2026

- **Server Pass:** humanCheck.ts now uses `TURNSTILE_CLOCK_SKEW_TOLERANCE_MS = 60000`, accepting proof ages from -60,000 through 300,000 ms inclusive in all modes. This prevents small server/Cloudflare clock differences from rejecting fresh proofs; the five-minute maximum and all success, hostname, action, dummy-key and replay checks are unchanged. The contract is recorded in addendum L14.
- **Validation:** `deno task check` PASS; explicitly listed `humanCheck_test.ts` and `accountService_test.ts` PASS (**25 tests, zero failures**) with cached/frozen dependencies, only the named ACCOUNTS_MODE/ENABLE_SERVER_DEBUG_LOGS environment permissions and no `--allow-net`. Coverage includes future proofs at 2/59/60 seconds, rejection at 60,001 ms/61 seconds and over five minutes old, and the captured dummy response including metadata with test-mode/real-secret restrictions. Existing Deno ignored-option warnings remain. No SQL, configuration, database, local-live or deployment changes; no commit.

### 22C.3b — Game-request names, account provenance and seat authority — 21 November 2026

- **Pass/ownership:** Server Pass. Human identity resolution, assignment eligibility and account seat checks belong on the authoritative server. The engine receives the same session-derived participant IDs; networking/client/display code is untouched. Judd reports SQL sets 01–03 applied, 03-verify PASS on 21 November and the 14-check account smoke PASS; this supersedes historical set-03-unapplied notes above. This pass does not access the live database.
- **Changed server files** (relative to `src/supabase/functions/server/`): `accounts/accountRepository.ts`, new `accounts/gameRequestIdentity.ts`, `index.tsx`, `routes/auth_routes.ts`, `routes/game_routes.ts`, `routes/intent_routes.ts`, `engine/state/GameStateTypes.ts`, `engine/state/ancientState.ts`; `tests/accounts/fakeAccountRepository.ts`, new `tests/accounts/gameIdentityFixture.ts`, new `tests/accounts/gameRequestIdentity_test.ts`; new `tests/routes/game_identity_fixture.ts`, `off_mode_game_contract_test.ts`, `game_name_identity_routes_test.ts`, `session_start_identity_routes_test.ts`, `computer_game_identity_routes_test.ts`. Documentation changes are this §15 record and addendum §2.15.
- **Off / R2:** Every mutation route has an explicit mode guard before resolver acquisition, including error handling. The nine original contracts remain intact: no name/account work, no new errors, unchanged validation ordering, original create/rematch/reset trim behavior and raw join/session labels. A throwing acquisition spy proves the resolver is never invoked. Constructors add no field for anonymous/off participants. The shared sanitizer's only change is omitting `accountId`; equality tests compare otherwise identical projections.
- **Assignments:** The shared resolver selects verified linked account casing, otherwise the bound guest name, otherwise a validated legacy hint. Anonymous hints cannot replace a binding; bind-once uses a JSON-value CAS on the session-token KV row and synchronizes the session-id metadata mirror. A different concurrent winning name returns 409 so the retry uses that binding without a second name RPC. Guest surrounding whitespace is trimmed before the 3–20 ASCII alphanumeric check; internal whitespace is invalid. New account participants/spectators carry server-derived accountId, never body-provided provenance. Existing guest participants are not converted on claim/sign-in; new seats use the current account name.
- **Owner deviation / L12, O5 and R1 — 21 November 2026:** Names are checked when assigned, never during play. This supersedes the active-action ban policy in L12/O5 and Part D of the original 22C.3b brief. Intents/chat, rejoin, non-promoting role switches and completed streak-reset replays retain stored labels without name RPCs or rule reads. Guests ignore irrelevant account credentials and make no account calls during play. New assignments, including promotions/rematches/replacements, still validate the chosen name afresh and fail closed on service failure (503, Retry-After 5); an old source label is not separately checked. On-mode account seats retain LA6 matching-token/account/security-version/active-link authority. Names-only retains session authority and provenanced source-name reuse. Leave-spectator uses only session authority in every mode, removes only the requester's own spectator entry, and needs no account token. Reads/polls remain exempt.
- **Refinement files:** `accounts/gameRequestIdentity.ts`, `accounts/accountRepository.ts`, `routes/game_routes.ts`, the single resolver-log option line in `index.tsx`, `tests/accounts/{fakeAccountRepository.ts,gameIdentityFixture.ts,gameRequestIdentity_test.ts}`, `tests/routes/game_name_identity_routes_test.ts`, this §15 and addendum §2.15. No intent-route, client, SQL, environment or configuration changes.
- **Server generation / R4:** Computer construction and System action/chat emission are never resolver inputs. No checks were inserted into the engine or bot runner. Human requested names still undergo reservation/moderation. The on-mode route lifecycle test plays through species/Mission/matchup setup and bot turns, sends chat, finishes with legal SURRENDER, rematches and resets into a neutral replacement. It deliberately bans the two server labels in its fake rules and verifies neither label reaches the name service during server execution. The test does not fabricate a terminal game state.
- **Caching / R3:** Only the linked-identity cache remains: at most 1,024 entries, expiring after 15 seconds and capped by token expiry. Windows begin at lookup start, so slow responses and memoized CAS retries cannot extend them. Per-request promises include failures, limiting assignments to one name RPC and account authorization to one joined identity read. Changed participant name/provenance on reload produces 409 rather than authorizing stale identity. Logout/password/reset/block suspend account authority within 15 seconds; a previously authorized KV request can finish. Due-only renewal uses the existing hourly-throttled resume RPC without sessionId and never relinks an action. Name verdict/rule caches, live-rule paging, the fail-open path and its resolver log option are removed; `accounts/nameRules.ts` remains for 22C.3a parity tests.
- **Renewal exception:** Hourly `account_resume` renewal retains account moderation and may return `NAME_BANNED`; guests are unaffected.

#### D3 — Exact gameplay error envelopes

| Route (existing function prefix omitted) | Name/account failure JSON |
| --- | --- |
| POST `/session/start` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/create-game` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/create-computer-game` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/new-game-from/:gameId` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/reset-win-streak/:gameId` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/join-game/:gameId` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/switch-role/:gameId` | `{error: CODE, message: SAFE_MESSAGE}` |
| POST `/leave-spectator/:gameId` | No name/account check; existing session, spectator-role and persistence envelopes only |
| POST `/intent` (including chat) | `{ok:false,state:null,events:[],rejected:{code:CODE,message:SAFE_MESSAGE}}` |

Messages/statuses come from the locked ACCOUNT_ERRORS table: INVALID_NAME / INVALID_REQUEST 400; GAME_SESSION_INVALID / ACCOUNT_TOKEN_REQUIRED / ACCOUNT_TOKEN_INVALID / ACCOUNT_TOKEN_EXPIRED 401; NAME_BANNED / NAME_RESERVED / CLAIMED_NAME_REQUIRES_ACCOUNT / ACCOUNT_BLOCKED 403; SESSION_LINK_CONFLICT 409 if returned by linking; ACCOUNT_SERVICE_UNAVAILABLE 503 with Retry-After 5. These failures are no-store. The session-name binder reads the token row directly with `maybeSingle()`: a successful no-row result or session mismatch remains GAME_SESSION_INVALID, while real database/transport errors return ACCOUNT_SERVICE_UNAVAILABLE without a CAS or mirror write. Existing requireSession 401 bodies/messages are unchanged, particularly `Invalid or expired session token`; account errors do not trigger sessionManager's session replacement. Identity/name changes during CAS retries use the existing game-conflict style `{error:"Game changed during identity resolution; retry the request"}` (409), or the intent envelope with rejected code STATE_CONFLICT and that message. These are concurrency outcomes, not account codes. Other existing errors keep their original envelopes.

#### R3 — On-mode account database calls

Counts below are client-to-database operations beyond the unchanged session/game/history KV operations. They are tested with the pinned Supabase client and instrumented repositories, not claimed as hosted SQL measurements. Each joined identity GET is one operation even though it joins token/account/link tables. Missing or malformed inputs may return before any operation; cache hits count zero.

| Route / branch | Name RPCs | Identity GETs | Other account operations |
| --- | --- | --- | --- |
| Unnamed anonymous session start | 0 | 0 | 0 |
| Named anonymous session start | 1 | 0 | 0 |
| Account session start | 0 | 1 | 1 resume/link RPC, including its renewal handling |
| Create-game / create-computer-game | 1 | 0–1 | 0–1 due-renewal RPC |
| Join: new player or spectator | 1 | 0–1 | 0–1 due-renewal RPC |
| New-game-from / new streak replacement / promotion | 1 | 0–1 | 0–1 due-renewal RPC |
| Join: existing participant | 0 | 0–1 | 0–1 due-renewal RPC |
| Switch-role without promotion | 0 | 0–1 | 0–1 due-renewal RPC |
| Leave-spectator | 0 | 0 | 0 |
| Completed streak-reset replay | 0 | 0–1 | 0–1 due-renewal RPC; no new assignment |
| Intent / chat | 0 | 0–1 | 0–1 due-renewal RPC |
| Game-state / head / history / chat-state / previews | 0 | 0 | 0 |
| Server Computer/System creation and internal bot execution | 0 | 0 | 0 |

The identity count is zero for guest seats regardless of optional account headers, and for anonymous assignments without an account token. Existing guest seats and all names-only seats make no account calls during play. Direct live-rule reads are eliminated. New-name RPCs remain authoritative. Observed route assertions include: cold account join after two CAS conflicts = 1 name RPC + 1 identity GET; hour-due intent after two conflicts = 0 name RPCs + 1 identity GET + 1 renewal RPC; its immediate successor = zero account operations; assigning a different account label from a banned guest source = 1 name RPC for the chosen account name, without checking the source label. No fallback diagnostic lookup occurs after a failed identity read.

#### D2 — Client name inputs left for 22C.5 / 22B

- `src/game/hooks/usePlayer.tsx`: generates two-word names, restores sessionStorage names without validation, and accepts arbitrary updatePlayerName values.
- `src/game/client/gameSession/playerName.ts`: trusts prop and localStorage names and generates a spaced friendly fallback.
- `src/App.tsx`: Single Player/Multiplayer launchers and development Create Game forward player.name; session-ID/streak lookup also forwards that name. The session-debug reset control checks only nonempty trimmed text. `startPlayerSession` trusts its caller; ordinary AlphaEntryPanel validates format locally but does not check server eligibility.
- `src/game/client/gameSession/clienteffects/useNetworkingEffects.ts`: auto-join and its retry send the unchecked effectivePlayerName after ensureSession.
- `src/utils/sessionManager.ts`: creation and opt-in session recovery accept arbitrary displayName; storage reuse may retain an older local label. `src/game/client/useGameSession.ts` also forwards effective names into session/streak lookup. These networking helpers currently do not attach account tokens, so account-owned gameplay requires the later 22C.5 integration. Claim/account error mapping is likewise deferred. No client fixes are bundled here.

#### Validation and explicit regression enumeration

- **R6 baseline before production changes:** off_mode_game_contract_test.ts, **9 passed, 0 failed**. Only the two new test/fixture files existed at that point; route implementations were unmodified. The baseline command appears below. Post-implementation: the same nine contract tests pass, with unchanged expectations and the resolver acquisition spy active.
- **Final refinement checks:** `deno task check --frozen` PASS; all **83 offline server test files, 814 tests plus 16 steps, zero failures**; `git diff --check` PASS. The nine off-mode contracts and parity matcher are unchanged. The file enumeration below matches the actual offline selection. Existing ignored-option warnings (allowImportingTsExtensions/allowJs) remain. No live integration, network grant, SQL execution, npm checks, environment/configuration changes, deployment or commit.
- Coverage includes all assignment paths in both enforced modes; banned existing guest/account seats sending real gameplay intents and chat, rejoining, switching roles, leaving and replaying completed resets without name calls; banned rematches/promotions/replacements; unchanged LA6 identity/cache/renewal boundaries; token-free spectator departure and body-ID spoof protection; binder database/transport 503 versus missing/mismatched-session 401; bind-once/CAS winners, source-name changes, projection privacy and trusted bot lifecycle. Rule-read assertions count actual fake rule evaluations rather than an unused live-rule API spy.

```powershell
# R6 baseline command, run before editing production routes; repeated afterward:
deno test --cached-only --frozen '--allow-env=ACCOUNTS_MODE,ENABLE_SERVER_DEBUG_LOGS' src/supabase/functions/server/tests/routes/off_mode_game_contract_test.ts

deno task check --frozen
if (Test-Path Env:PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION) { throw 'Live integration variable must be unset' }
$serverTestFiles = @(rg --files src/supabase/functions/server/tests -g '*test.ts' | Where-Object { $_ -notmatch 'intent_persistence_live_integration_test\.ts$' } | Sort-Object)
$serverTestFiles
deno test --cached-only --frozen '--allow-env=ACCOUNTS_MODE,ENABLE_SERVER_DEBUG_LOGS' '--allow-read=src/supabase/functions/server/engine/bot/botRunner.ts,src/game/data/ShipDefinitions.json.ts,supabase/manual/account' @serverTestFiles
git diff --check
```

PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION was verified **unset**. The excluded file is `routes/intent_persistence_live_integration_test.ts`. Every selected test file is listed below, relative to `src/supabase/functions/server/tests/`:

```text
accounts/accountRepository_test.ts
accounts/accountService_test.ts
accounts/accountServiceLoader_test.ts
accounts/clientIp_test.ts
accounts/gameRequestIdentity_test.ts
accounts/hashAdmission_test.ts
accounts/humanCheck_test.ts
accounts/nameKeys_test.ts
accounts/nameRules_test.ts
accounts/nameRulesGenerator_test.ts
accounts/password_test.ts
accounts/rateLimit_test.ts
accounts/tokens_test.ts
engine/ancient/blackHoleSolarPower_test.ts
engine/ancient/manualSolarDeclaration_test.ts
engine/ancient/simulacrumSolarPower_test.ts
engine/ancient/solarPowerResolvers_test.ts
engine/bot/ancientAuthoredPlans_test.ts
engine/bot/ancientBotPlanner_test.ts
engine/bot/ancientBotRunner_test.ts
engine/bot/ancientBuildPayload_test.ts
engine/bot/ancientFirstStrike_test.ts
engine/bot/ancientFullGameValidation_test.ts
engine/bot/ancientPlans_test.ts
engine/bot/botControllerProjection_test.ts
engine/bot/botRunner_test.ts
engine/bot/buildPlanner_test.ts
engine/bot/drawingPreludeBotRunner_test.ts
engine/intent/buildForeignLegality_test.ts
engine/intent/buildSubmitResolution_test.ts
engine/intent/chargeDeclarationResolution_test.ts
engine/intent/drawingPreludeIntent_test.ts
engine/intent/drawingPreludeResolution_test.ts
engine/intent/IntentReducer_test.ts
engine/intent/matchupIntroIntent_test.ts
engine/intent/missionChallengeIntent_test.ts
engine/lines/computeLineBonusForPlayer_test.ts
engine/mission/missionChallenge_test.ts
engine/phase/chargeDeclarationPhase_test.ts
engine/phase/cubeDiceManipulation_test.ts
engine/phase/drawingPreludeCutover_test.ts
engine/phase/drawingPreludeFoundation_test.ts
engine/phase/thirdSpiralFirstStrike_test.ts
engine/phase/turnPhaseProgress_test.ts
engine/phase/winStreakLineGeneration_test.ts
engine/state/ancientState_test.ts
engine/state/battleLogCurrentTurnProjection_test.ts
engine/state/battleLogHistory_test.ts
engine/state/currentTurnEstimator_performance_test.ts
engine/state/currentTurnEstimator_test.ts
engine/state/drawingPreludeProjection_test.ts
engine/state/drawingPreludeState_test.ts
engine/state/speciesSelection_test.ts
engine_shared/dreadnoughtRevealCounting_test.ts
engine_shared/effects/appliedEffectVerification_test.ts
engine_shared/effects/applyEffects_test.ts
engine_shared/maximumHealth_test.ts
engine_shared/resolve/ancientSolarBreakdown_test.ts
engine_shared/resolve/destroyRules_test.ts
engine_shared/resolve/phaseComputedEffects_test.ts
engine_shared/shipDefinitionMetadata_test.ts
routes/account_enabled_routes_test.ts
routes/account_name_check_routes_test.ts
routes/account_routes_test.ts
routes/ancient_state_routes_test.ts
routes/bot_game_state_read_only_test.ts
routes/computer_game_identity_routes_test.ts
routes/current_turn_projection_performance_test.ts
routes/current_turn_projection_routes_test.ts
routes/game_history_checkpoint_recovery_test.ts
routes/game_id_allocation_test.ts
routes/game_name_identity_routes_test.ts
routes/game_record_mutation_concurrency_test.ts
routes/game_state_head_test.ts
routes/game_state_timeout_persistence_concurrency_test.ts
routes/intent_persistence_adapter_test.ts
routes/intent_persistence_concurrency_test.ts
routes/missionChallengeRoutes_test.ts
routes/off_mode_game_contract_test.ts
routes/session_start_identity_routes_test.ts
routes/species_selection_visibility_routes_test.ts
routes/timeControlPresets_test.ts
routes/win_streak_routes_test.ts
```

#### Owner local gameplay checklist and remaining boundary

Judd runs this first with ACCOUNTS_MODE=off, then on, using separate browser contexts and valid unclaimed alphanumeric names (the development-generated spaced defaults intentionally remain unfixed):

1. Browser A creates multiplayer; B joins. Select species, continue the intro, play several turns, and exchange chat.
2. C joins as spectator. B switches to spectator; C promotes to player. C demotes; B promotes back. C leaves spectating and rejoins. Verify roles, labels and system/presence messages.
3. Reload/rejoin A and B with their original sessions; verify names and participant IDs remain unchanged.
4. Finish by surrendering, create a rematch, and join it from the other browser. Verify the new game and its messages.
5. Create/play a computer game through bot turns and chat. Separately create an eligible positive-streak computer game, reset before the first human build, verify the zero-bonus replacement and rejoin it. The reset control is available only for a positive streak; a zero-streak game is not a valid reset fixture.
6. In on mode, use fresh guest sessions to try System and Computer (NAME_RESERVED) and Smoke347059 (CLAIMED_NAME_REQUIRES_ACCOUNT), all 403. Ordinary bound-name requests cannot rename an existing session by changing body hints.

The joined PostgREST read and session JSON CAS are pinned-client/fake tested; this pass does not prove live ACL/isolation or hosted runtime behavior. Judd reports the owner local gameplay check passed with ACCOUNTS_MODE=off and account-smoke-3 passed 19/19 with on, including banned/reserved/claimed guest-name entry refusals. This refinement was validated offline; no post-refinement browser run or public activation was performed. Session-token binding and its metadata mirror are separate KV writes, with the token row authoritative. Account linking and KV game/session writes are not one cross-store transaction; a request already authorized may finish during revocation. The assignment-only owner deviation and names-only provenance refinements are recorded in addendum §2.15. Durable ownership/import/cross-device evidence remains 22D; preferences and owner routines remain 22C.4.


### 22C.4 — Preferences, owner routines and guest session renewal (SQL set 04)

- **Pass/ownership:** Server Pass based on clean HEAD 4c28a2a7. Account authorization, transactional preferences and owner operations are server-owned; guest renewal is session validation/persistence. No client/UI, .env, Deno/build configuration, deployment, live/local-live request or commit. The approved file plan preceded edits; Judd approved the rateLimit.ts addition.
- **Preferences / R2:** GET and PUT /accounts/preferences use A without S validation, renewal or linking. PUT validates a nonempty subset of exactly five booleans and a positive bigint-range decimal revision, derives its account from the token and increments revision once under the existing account-first locks. SQL rechecks token expiry after all row locks. Update returns a normal {status:"updated"/"conflict",preferences}; the service converts conflict to 409 with top-level latest preferences. There is no P2211 or exception DETAIL parsing. P2212 maps to INVALID_REQUEST; existing authorization errors retain resume's precedence. No unauthorized conflict snapshot is disclosed. Read-only GET does not use resume.
- **Admission/modes:** Existing account_token and account_unknown_ip scopes are reused, including recognition in PostgreSQL. LA13 introduces preferences_global, shared by GET/PUT, 1,200/minute. Existing 120/token/minute still applies. off and names-only remain dormant before lazy service dependencies; ordinary game polling gets no limiter.
- **Guest renewal / R1:** requireSession's existing token read now carries optional lastRenewedAt. The in-memory due check uses that value or createdAt. A non-due accepted intent makes **zero extra DB operations**. A due attempt makes **at most four**: token read — token JSON-value CAS — mirror read — mirror JSON-value CAS. Each row has one attempt and no retry loop. A fresh row that already renewed stops after one read; a failed token CAS stops after two. Persisted timestamps plus CAS allow at most one successful renewal/hour across requests/workers. Concurrent stale requests may each attempt their bounded CAS; only the winner proceeds to its mirror. These are extra KV operations, separate from the pre-existing game/history/session read and account-token authority/renewal budgets in 22C.3b.
- **Renewal behavior:** Accepted /intent 200 paths, including duplicate-success and committed fallback, run the hook after acceptance in every mode, including off. TTL becomes 24 hours after the last renewal, keeping the existing strict greater-than expiry boundary and immutable createdAt. Stored fields and concurrent names survive CAS. No response adds lastRenewedAt. Rejected intents, reads/polls, session start and unrelated game mutations do not renew. Token and mirror are separate writes: a mirror error/conflict cannot undo the authoritative token renewal, and no maintenance failure changes the accepted response. Missing mirrors are left alone rather than blind-created.
- **Owner clarification/deviation:** Inspection found the existing engine rejects spectator ACTION/chat with PLAYER_NOT_ACTIVE. Judd explicitly chose to preserve that rule instead of broadening the pass; rejected spectator chat does not renew. The hook is role-independent for any accepted spectator intent. No reducer/gameplay legality change was made.
- **Housekeeping:** createGameSessionNameBinder now takes (client,kvSet), removing unused _kvGet at production/test callers. The initial nine off-mode characterization expectations remain unchanged.
- **Owner operations:** Seven postgres-only invoker functions deny effective EXECUTE to PUBLIC/anon/authenticated/service_role, recheck role defensively and never return credentials/hashes. UUID mutators validate expected version under locks, report safe counts/events and require a nonempty note up to 500 characters. Block/revoke/reset increment version and revoke/detach; unblock only activates and records an event. Lookup is case-insensitive, read-only and returns effective active-token/link counts. Reset requires active status and validates exact current PHC format, parameters, byte lengths and canonical base64, then sets must_change_password=true. Cleanup is capped at 100 links, 100 link-free tokens and the reused 100-rate-row cleanup per call; retain dead tokens seven days. Explicit development deletion caps input at 20 UUIDs, reports missing IDs, removes selected dependencies/events and records one accountless cleanup event. Dependency/trigger guards prevent broadening deletion beyond the existing six account FKs. No rule editing or reserve/release routine exists; the seed is unchanged.
- **SQL package:** Set 04 adds nine functions and replaces account_rate_hit only to admit preferences_global, for 23 total functions (16 service, seven owner). All have search_path=''; mutators lock_timeout=2s. No tables/policies/indexes are created. Forward carries all 03-verify checks and original limiter-source preconditions; verification is one SELECT superseding 03-verify. Rollback verifies signatures/configuration/ACLs/source and refuses any preferences_global counter rows or unexpected dependencies instead of deleting them. It restores set 03 limiter/constraint and drops new functions with RESTRICT, retaining all account data and previously completed owner actions.
- **Contract location:** Account Design addendum **§2.16** consolidates account request/success/error contracts, gateway/S/A headers, modes, game account behavior, guest renewal, rates and client obligations. Clients send their account name or no hint, attach A to linked sessions, send invalid bound-name assignments back to Entry and retry resume without S on GAME_SESSION_INVALID. L9 hydration/generation/coalescing/single-retry duties are included. Appendix A and the pass roadmap remove superseded owner rule-edit plans.

#### Set 04 exact added interfaces

~~~text
account_get_preferences(p_token_hash bytea) RETURNS jsonb
account_update_preferences(p_token_hash bytea,p_patch jsonb,p_expected_revision bigint) RETURNS jsonb
account_owner_lookup(p_display_name text) RETURNS jsonb
account_owner_block(p_account_id uuid,p_expected_security_version bigint,p_note text) RETURNS jsonb
account_owner_unblock(p_account_id uuid,p_expected_security_version bigint,p_note text) RETURNS jsonb
account_owner_sign_out_everywhere(p_account_id uuid,p_expected_security_version bigint,p_note text) RETURNS jsonb
account_owner_apply_password_reset(p_account_id uuid,p_expected_security_version bigint,p_password_hash text,p_password_format text,p_note text) RETURNS jsonb
account_owner_cleanup(p_note text) RETURNS jsonb
account_owner_delete_development_accounts(p_account_ids uuid[],p_note text) RETURNS jsonb
~~~

The **22C.T reset-generator call** is frozen as:

~~~sql
public.account_owner_apply_password_reset(
  p_account_id uuid,
  p_expected_security_version bigint,
  p_password_hash text,
  p_password_format text,
  p_note text
) RETURNS jsonb
~~~

Format nfc-argon2id-v1; Argon2id v19, memory 19456 KiB, iterations 2, parallelism 1, 16-byte salt, 32-byte hash. Generate/hash/deliver the temporary secret only in the separately authorized Tooling pass. SQL returns accountId/status/string securityVersion/new-revocation counts/eventId/updatedAt, never the credential. Expected owner mock outcomes and single-SELECT examples for every routine are in supabase/manual/account/README.md.

#### Changed files

- `src/supabase/functions/server/tests/routes/account_enabled_routes_test.ts`
- `src/documentation/plans/Phase 22 Addendum - Account Design.md`
- `src/documentation/plans/Phase 22 Menu and Account.md`
- `src/supabase/functions/server/accounts/accountRepository.ts`
- `src/supabase/functions/server/accounts/accountResponses.ts`
- `src/supabase/functions/server/accounts/accountService.ts`
- `src/supabase/functions/server/accounts/gameRequestIdentity.ts`
- `src/supabase/functions/server/accounts/rateLimit.ts`
- `src/supabase/functions/server/index.tsx`
- `src/supabase/functions/server/routes/intent_routes.ts`
- `src/supabase/functions/server/tests/accounts/accountRepository_test.ts`
- `src/supabase/functions/server/tests/accounts/fakeAccountRepository.ts`
- `src/supabase/functions/server/tests/accounts/gameRequestIdentity_test.ts`
- `src/supabase/functions/server/tests/accounts/gameSessionRenewalFixture.ts`
- `src/supabase/functions/server/tests/accounts/gameSessionRenewal_test.ts`
- `src/supabase/functions/server/tests/accounts/rateLimit_test.ts`
- `src/supabase/functions/server/tests/routes/account_preferences_routes_test.ts`
- `src/supabase/functions/server/tests/routes/game_identity_fixture.ts`
- `src/supabase/functions/server/tests/routes/session_renewal_routes_test.ts`
- `supabase/manual/account/04-forward.sql`
- `supabase/manual/account/04-rollback.sql`
- `supabase/manual/account/04-verify.sql`
- `supabase/manual/account/README.md`

#### Validation and limits

- **Final validation:** deno task check PASS; all **86 offline server files, 833 tests plus 16 steps, zero failures**; git diff --check PASS. Static SQL inventory/source checks PASS (nine additions, 23 signatures, ten exact rollback body guards, original limiter restoration and balanced dollar tags); these are not PostgreSQL execution. The first full run exposed the historical preferences-404 assertion; it now targets an unknown preferences subpath and checks unsupported preference methods. All nine off-mode expectations stayed unchanged.
- Focused tests cover preference ownership/types/keys/revisions/conflict snapshots, normal RPC decoding, no token/link effects, revocation races in both orders, mode/admission behavior and renewal hourly/expiry/call-count/name-CAS/error/read boundaries. Nine existing off-mode contract assertions remain unchanged.
- PostgreSQL execution **not run** here: psql/postgres are unavailable on PATH and Docker access is unavailable. Planning-assistant **PostgreSQL 17.6 mock review remains required before Judd applies set 04**, followed by private backup, entire forward and entire verification. No fake claims to prove SQL isolation/ACLs. README lists every prerequisite and owner result/count/event expectation.
- Existing ignored compiler options allowImportingTsExtensions/allowJs remain; no configuration change. Keep PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION unset and grant no --allow-net. The exact offline selection below excludes the live integration module. Runtime reads are limited to public manual-account sources and the two source files existing architecture/parity tests inspect; no secrets or environment files are read.

~~~powershell
deno task check
if (Test-Path Env:PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION) { throw 'Live integration flag must be unset.' }
$offlineTestFiles = @(rg --files src/supabase/functions/server -g '*_test.ts' | Where-Object { $_ -notmatch 'intent_persistence_live_integration_test\.ts$' } | Sort-Object)
deno test --cached-only --frozen '--allow-env=ACCOUNTS_MODE,ENABLE_SERVER_DEBUG_LOGS' '--allow-read=supabase/manual/account,src/supabase/functions/server/engine/bot/botRunner.ts,src/game/data/ShipDefinitions.json.ts' @offlineTestFiles
git diff --check
~~~

Exact offline test files (relative to src/supabase/functions/server/tests/):

~~~text
accounts/accountRepository_test.ts
accounts/accountServiceLoader_test.ts
accounts/accountService_test.ts
accounts/clientIp_test.ts
accounts/gameRequestIdentity_test.ts
accounts/gameSessionRenewal_test.ts
accounts/hashAdmission_test.ts
accounts/humanCheck_test.ts
accounts/nameKeys_test.ts
accounts/nameRulesGenerator_test.ts
accounts/nameRules_test.ts
accounts/password_test.ts
accounts/rateLimit_test.ts
accounts/tokens_test.ts
engine/ancient/blackHoleSolarPower_test.ts
engine/ancient/manualSolarDeclaration_test.ts
engine/ancient/simulacrumSolarPower_test.ts
engine/ancient/solarPowerResolvers_test.ts
engine/bot/ancientAuthoredPlans_test.ts
engine/bot/ancientBotPlanner_test.ts
engine/bot/ancientBotRunner_test.ts
engine/bot/ancientBuildPayload_test.ts
engine/bot/ancientFirstStrike_test.ts
engine/bot/ancientFullGameValidation_test.ts
engine/bot/ancientPlans_test.ts
engine/bot/botControllerProjection_test.ts
engine/bot/botRunner_test.ts
engine/bot/buildPlanner_test.ts
engine/bot/drawingPreludeBotRunner_test.ts
engine/intent/IntentReducer_test.ts
engine/intent/buildForeignLegality_test.ts
engine/intent/buildSubmitResolution_test.ts
engine/intent/chargeDeclarationResolution_test.ts
engine/intent/drawingPreludeIntent_test.ts
engine/intent/drawingPreludeResolution_test.ts
engine/intent/matchupIntroIntent_test.ts
engine/intent/missionChallengeIntent_test.ts
engine/lines/computeLineBonusForPlayer_test.ts
engine/mission/missionChallenge_test.ts
engine/phase/chargeDeclarationPhase_test.ts
engine/phase/cubeDiceManipulation_test.ts
engine/phase/drawingPreludeCutover_test.ts
engine/phase/drawingPreludeFoundation_test.ts
engine/phase/thirdSpiralFirstStrike_test.ts
engine/phase/turnPhaseProgress_test.ts
engine/phase/winStreakLineGeneration_test.ts
engine/state/ancientState_test.ts
engine/state/battleLogCurrentTurnProjection_test.ts
engine/state/battleLogHistory_test.ts
engine/state/currentTurnEstimator_performance_test.ts
engine/state/currentTurnEstimator_test.ts
engine/state/drawingPreludeProjection_test.ts
engine/state/drawingPreludeState_test.ts
engine/state/speciesSelection_test.ts
engine_shared/dreadnoughtRevealCounting_test.ts
engine_shared/effects/appliedEffectVerification_test.ts
engine_shared/effects/applyEffects_test.ts
engine_shared/maximumHealth_test.ts
engine_shared/resolve/ancientSolarBreakdown_test.ts
engine_shared/resolve/destroyRules_test.ts
engine_shared/resolve/phaseComputedEffects_test.ts
engine_shared/shipDefinitionMetadata_test.ts
routes/account_enabled_routes_test.ts
routes/account_name_check_routes_test.ts
routes/account_preferences_routes_test.ts
routes/account_routes_test.ts
routes/ancient_state_routes_test.ts
routes/bot_game_state_read_only_test.ts
routes/computer_game_identity_routes_test.ts
routes/current_turn_projection_performance_test.ts
routes/current_turn_projection_routes_test.ts
routes/game_history_checkpoint_recovery_test.ts
routes/game_id_allocation_test.ts
routes/game_name_identity_routes_test.ts
routes/game_record_mutation_concurrency_test.ts
routes/game_state_head_test.ts
routes/game_state_timeout_persistence_concurrency_test.ts
routes/intent_persistence_adapter_test.ts
routes/intent_persistence_concurrency_test.ts
routes/missionChallengeRoutes_test.ts
routes/off_mode_game_contract_test.ts
routes/session_renewal_routes_test.ts
routes/session_start_identity_routes_test.ts
routes/species_selection_visibility_routes_test.ts
routes/timeControlPresets_test.ts
routes/win_streak_routes_test.ts
~~~

### 22C.T — Local owner password-reset generator — 22 November 2026

- **Pass type / layer:** small Tooling Pass. Added local tooling outside the deployed function folder and one account test file; production hashing/policy/token modules, server routes, SQL, UI, environment files and Deno configuration are unchanged. No SQL, deployment or commit was performed.
- **Owner amendments R1–R3:** generate 12 uniformly sampled characters from the existing 31-symbol alphabet, rejecting bytes 248-255, and display them once as three groups of four. This is the explicit owner-approved deviation from original addendum §2.8 (20 characters/four groups of five), now recorded in §2.17 with the approximately 59-bit rationale. Notes reject controls/line breaks and use plain standard SQL literals with apostrophes doubled. README includes the separate one-time global-cache download command.
- **Behavior:** validates UUID, positive bigint version and optional nonblank/≤500-character note; uses unchanged production hash/verify and frozen PHC/format checks before emitting either block. SQL is exactly one named-argument account_owner_apply_password_reset SELECT, without plaintext. Self-check failures expose no generated values or raw exceptions. Runtime requires no Deno permissions, environment variables, network, database or service-role key; generated password/hash values are never saved.
- **Owner flow / limits:** README supplies O3 ownership proof, lookup, generator, SQL/result review, private delivery and forced password change. Stale P2241 requires a fresh lookup and fresh generation, never edited/reused output. Standard SQL literals assume standard_conforming_strings=on. Judd reports set 04 applied, 04-verify PASS and account-smoke-4 9/9 on 22 November 2026; no live validation was performed here. The unbuilt 22B forced-change screen still prevents end-to-end player recovery.

#### Changed files

- `supabase/manual/account/tools/owner-password-reset.ts`
- `src/supabase/functions/server/tests/accounts/ownerPasswordResetGenerator_test.ts`
- `supabase/manual/account/README.md`
- `src/documentation/plans/Phase 22 Addendum - Account Design.md`
- `src/documentation/plans/Phase 22 Menu and Account.md` (§15)

#### Validation

- Focused generator tests: **10 passed, zero failures**. Nine behavior tests explicitly disable all permissions; the source/import guard uses only the existing public manual-account read grant. Cases cover all 248 accepted byte mappings, all eight rejected bytes, policy-valid twelve-character passwords, production verification, grouped delivery, safe single-statement SQL, bigint/Unicode/control boundaries and secret-free failures. No generated secret snapshot is saved.
- `deno task check`: **PASS**. Existing ignored compiler-option warnings for allowImportingTsExtensions/allowJs remain.
- Actual CLI: **PASS** with synthetic UUID/version and the exact no-config/cached-only/node-modules-dir=none/no-prompt command below, without permission grants. Only password/hash-redacted output was reported; values were held only in memory and no SQL was executed. An invalid-UUID CLI invocation returned status 1 with a safe message.
- Full offline suite: **PASS — 87 files, 843 tests plus 16 steps, zero failures**; all files are explicitly listed below. The live-integration flag was verified unset; no --allow-net, --allow-run or new read/environment grant was used.
- Final `git diff --check`: **PASS**. Only the five scoped files changed; SQL, production code, configuration and lockfiles remain unchanged. No generated password/hash was saved or included in the report.

~~~powershell
deno run --no-config --cached-only --node-modules-dir=none --no-prompt .\supabase\manual\account\tools\owner-password-reset.ts "11111111-1111-4111-8111-111111111111" "1" "Owner password reset"
deno task check
if (Test-Path Env:PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION) { throw 'Live integration flag must be unset.' }
$offlineTestFiles = @(rg --files src/supabase/functions/server -g '*_test.ts' | Where-Object { $_ -notmatch 'intent_persistence_live_integration_test\.ts$' } | Sort-Object)
deno test --cached-only --frozen --no-prompt '--allow-env=ACCOUNTS_MODE,ENABLE_SERVER_DEBUG_LOGS' '--allow-read=supabase/manual/account,src/supabase/functions/server/engine/bot/botRunner.ts,src/game/data/ShipDefinitions.json.ts' @offlineTestFiles
git diff --check
~~~

Exact 22C.T offline test files (relative to src/supabase/functions/server/tests/); routes/intent_persistence_live_integration_test.ts is excluded:

~~~text
accounts/accountRepository_test.ts
accounts/accountService_test.ts
accounts/accountServiceLoader_test.ts
accounts/clientIp_test.ts
accounts/gameRequestIdentity_test.ts
accounts/gameSessionRenewal_test.ts
accounts/hashAdmission_test.ts
accounts/humanCheck_test.ts
accounts/nameKeys_test.ts
accounts/nameRules_test.ts
accounts/nameRulesGenerator_test.ts
accounts/ownerPasswordResetGenerator_test.ts
accounts/password_test.ts
accounts/rateLimit_test.ts
accounts/tokens_test.ts
engine/ancient/blackHoleSolarPower_test.ts
engine/ancient/manualSolarDeclaration_test.ts
engine/ancient/simulacrumSolarPower_test.ts
engine/ancient/solarPowerResolvers_test.ts
engine/bot/ancientAuthoredPlans_test.ts
engine/bot/ancientBotPlanner_test.ts
engine/bot/ancientBotRunner_test.ts
engine/bot/ancientBuildPayload_test.ts
engine/bot/ancientFirstStrike_test.ts
engine/bot/ancientFullGameValidation_test.ts
engine/bot/ancientPlans_test.ts
engine/bot/botControllerProjection_test.ts
engine/bot/botRunner_test.ts
engine/bot/buildPlanner_test.ts
engine/bot/drawingPreludeBotRunner_test.ts
engine/intent/buildForeignLegality_test.ts
engine/intent/buildSubmitResolution_test.ts
engine/intent/chargeDeclarationResolution_test.ts
engine/intent/drawingPreludeIntent_test.ts
engine/intent/drawingPreludeResolution_test.ts
engine/intent/IntentReducer_test.ts
engine/intent/matchupIntroIntent_test.ts
engine/intent/missionChallengeIntent_test.ts
engine/lines/computeLineBonusForPlayer_test.ts
engine/mission/missionChallenge_test.ts
engine/phase/chargeDeclarationPhase_test.ts
engine/phase/cubeDiceManipulation_test.ts
engine/phase/drawingPreludeCutover_test.ts
engine/phase/drawingPreludeFoundation_test.ts
engine/phase/thirdSpiralFirstStrike_test.ts
engine/phase/turnPhaseProgress_test.ts
engine/phase/winStreakLineGeneration_test.ts
engine/state/ancientState_test.ts
engine/state/battleLogCurrentTurnProjection_test.ts
engine/state/battleLogHistory_test.ts
engine/state/currentTurnEstimator_performance_test.ts
engine/state/currentTurnEstimator_test.ts
engine/state/drawingPreludeProjection_test.ts
engine/state/drawingPreludeState_test.ts
engine/state/speciesSelection_test.ts
engine_shared/dreadnoughtRevealCounting_test.ts
engine_shared/effects/appliedEffectVerification_test.ts
engine_shared/effects/applyEffects_test.ts
engine_shared/maximumHealth_test.ts
engine_shared/resolve/ancientSolarBreakdown_test.ts
engine_shared/resolve/destroyRules_test.ts
engine_shared/resolve/phaseComputedEffects_test.ts
engine_shared/shipDefinitionMetadata_test.ts
routes/account_enabled_routes_test.ts
routes/account_name_check_routes_test.ts
routes/account_preferences_routes_test.ts
routes/account_routes_test.ts
routes/ancient_state_routes_test.ts
routes/bot_game_state_read_only_test.ts
routes/computer_game_identity_routes_test.ts
routes/current_turn_projection_performance_test.ts
routes/current_turn_projection_routes_test.ts
routes/game_history_checkpoint_recovery_test.ts
routes/game_id_allocation_test.ts
routes/game_name_identity_routes_test.ts
routes/game_record_mutation_concurrency_test.ts
routes/game_state_head_test.ts
routes/game_state_timeout_persistence_concurrency_test.ts
routes/intent_persistence_adapter_test.ts
routes/intent_persistence_concurrency_test.ts
routes/missionChallengeRoutes_test.ts
routes/off_mode_game_contract_test.ts
routes/session_renewal_routes_test.ts
routes/session_start_identity_routes_test.ts
routes/species_selection_visibility_routes_test.ts
routes/timeControlPresets_test.ts
routes/win_streak_routes_test.ts
~~~
