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
- Account persistence for sound effects, health flash, chat open/closed and battle-log open/closed preferences.
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
- Initialise the account's four agreed preferences from the current guest/device values.
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

All four agreed preferences follow a signed-in account across sessions and devices:

| Preference | Required integration |
| --- | --- |
| Sound effects on/off | Menu Sound control and existing game audio use one preference. |
| Health flash on/off | Existing in-game flash behaviour consumes the account preference. |
| Chat open/closed | Preserve the current open/minimised meaning where that chat layout exists. |
| Battle log open/closed | Map to existing battle-log visibility/preference semantics, with appropriate mobile presentation. |

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

**Type:** Server, followed by a scoped client-runtime connection only when separately planned.

Split as needed into account/session data and credentials, claim/login/remember/logout, name enforcement and abuse controls, preference persistence, and minimal owner recovery/badge operations.

- Audit existing sessions and choose the concrete username-only implementation.
- Implement atomic ownership, secure credentials and explicit remembered-session lifecycle.
- Enforce names through existing create/join/session boundaries.
- Implement the four preference fields and authoritative account identity/badge responses.
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

Review ordinary guest entry; claimed/banned/error entry; claim success; returning sign-in; logout; all four preference settings; guest-to-account streak import; existing-account higher-streak selection; unfinished-game continuation on another device; fresh-game reset; private invite entry; mobile navigation/scrolling; and existing streak Reset/Rejoin presentation.

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
- All four agreed preferences follow the account without breaking guest preferences.
- Account streaks support eligible one-time import, higher-current-run selection and cross-device recovery without duplicate results or stale resurrection.
- Required credential, abuse, account/streak persistence and concurrency checks pass.
- Music playback, functional Stats/ratings/history and account Lore progression remain accurately deferred.
- Activation/configuration, owner recovery and any unresolved limitations are documented for Judd.

## 15. Implementation record

No implementation passes are recorded in this initial planning baseline. Add brief entries as scoped passes complete: pass identifier, approved scope changes, affected ownership boundaries, validation and owner visual-review status.
