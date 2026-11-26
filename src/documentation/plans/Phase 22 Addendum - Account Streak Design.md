# Phase 22 Addendum — Account Streak Design

- **Pass:** 22D.0, 24 November 2026; Server Pass, audit and design only, with read-only client/runtime inspection.
- **Status:** locked 24 November 2026 (Judd). The owner lock in §2.11 supersedes the original proposals. R1–R4 were approved 25 November 2026.
- **Goal / why now:** establish the evidence and smallest safe account-streak design before 22D.1 writes server code or SQL set 05.
- **Audience:** Judd, the planning assistant and the later scoped implementation passes.
- **Open-question count:** **0**. Q1–Q6 are resolved in §2.11.
- **Original 22D.0 files:** this new record and the three requested additions to [Phase 22 Menu and Account](Phase%2022%20Menu%20and%20Account.md). No code, SQL, configuration, tests, database operations, deployment or commit.
- **22D.0 validation:** Not run — documentation-only pass. Current implementation validation is recorded in main-plan §15.
- **Decision labels:** **A** approved. P identifiers are retained for traceability; every retained P is locked as amended by §2.11. P9 is removed. Audit §1 records the original inspection, not new database measurements.

## 1. Audit

### 1.1 Current streak lifecycle

| Area | Current behavior | Evidence |
| --- | --- | --- |
| Browser record | `shapeships.winStreakProfile.v1` contains version, revision, generation, current count, tracked game, ended snapshot, creation reservation, retired IDs and discovery seal. A tracked game has game/human IDs, `unfinished/settled/retired/restart_pending` status and result eligibility. The ended snapshot is presentation after a lost run, not a current importable count. | [types.ts](../../game/client/winStreak/types.ts#L41-L76), lines 41–76; [profile.ts](../../game/client/winStreak/profile.ts#L7-L29), lines 7–29. |
| Storage and exclusion | LocalStorage is shared by tabs; storage events update other store instances. Mutations reread under the named Web Lock and increase revision on change. Generation fences asynchronous associations. Without Web Locks, the promise queue excludes work only within one document. Storage failure falls back to memory. | [profile.ts](../../game/client/winStreak/profile.ts#L131-L242), lines 131–242. |
| Retirement | Up to 64 distinct game IDs are retained without eviction. Reaching the limit sets `automaticEnrollmentSealed`; this prevents rediscovery rather than forgetting retired games. Explicit creation can still register a new game. | [profile.ts](../../game/client/winStreak/profile.ts#L77-L126), lines 77–126; [authoritative.ts](../../game/client/winStreak/authoritative.ts#L196-L211), lines 196–211 and 341–367. |
| Creation reservation | Preflight captures generation and tracked identity/status. A reservation captures that base, requested count, kind/source, token, time and recovery data. Network work occurs outside the profile lock. Reserved/creating leases last 30 seconds; reconciliation uses an 8-second request deadline. | [workflow.ts](../../game/client/winStreak/workflow.ts#L17-L60), lines 17–60 and 219–317. |
| Ambiguous creation | Definite rejection releases the reservation. Network/5xx ambiguity retains it; a later deliberate attempt releases ambiguity without replaying the old non-idempotent request. A successful response arriving after a generation change retains recovery evidence; recovery verifies requester, bonus and current association before registering/settling. | [workflow.ts](../../game/client/winStreak/workflow.ts#L478-L749), lines 478–749. |
| Results | Only an eligible unfinished tracked human-versus-bot game settles. A win adds one, capped at the safe-integer maximum; loss, including human resignation or timeout, resets to zero and records a positive ended snapshot. Draw preserves count. Restart is neutral and retires the source. Settlement retires the game, removes eligibility and advances generation, preventing repeat application. | [authoritative.ts](../../game/client/winStreak/authoritative.ts#L136-L249), lines 136–249; [authoritative_test.ts](../../game/client/tests/winStreak/authoritative_test.ts#L115-L170), lines 115–170. |
| Fresh game / rematch | Reconcile the tracked game first. A verified unfinished game is retired and the count reset before reserving new creation. A terminal game settles first. An inaccessible, malformed or failed reconciliation retires the association but preserves the browser count; do not describe that as verified continuity. Rematch uses the same preparation. | [workflow.ts](../../game/client/winStreak/workflow.ts#L325-L404), lines 325–404; [workflow_test.ts](../../game/client/tests/winStreak/workflow_test.ts#L372-L490), lines 372–490; [useWinStreakGame.ts](../../game/client/winStreak/useWinStreakGame.ts#L68-L105), lines 68–105. |
| Unusable tracked game | Reconcile retires a missing, malformed, unclassifiable or no-longer-owned tracked game without changing count, ended snapshot or run identity. Revision advances once; later reset/create/import can proceed using that revision. Import anchors and rematch/restart sources retain their strict evidence faults. |
| Menu Reset | Clears count and ended presentation, retires an unfinished/restart-pending association and advances generation. It performs no game request, resignation or deletion. | [workflow.ts](../../game/client/winStreak/workflow.ts#L757-L766), lines 757–766; [useWinStreakProfile.ts](../../game/client/winStreak/useWinStreakProfile.ts#L117-L128), lines 117–128. |
| In-game Reset | Early server-approved restart creates a neutral zero-bonus replacement with source/replacement links. Later Reset confirms resignation as the current human’s finished loss, reconciles it, then creates a zero-count rematch. Pending/completed restart recovery and submission guards prevent a competing reset or creation. | [useWinStreakGame.ts](../../game/client/winStreak/useWinStreakGame.ts#L108-L308), lines 108–308; [workflow.ts](../../game/client/winStreak/workflow.ts#L769-L795), lines 769–795. |
| Rejoin | On entering Play Computer, fetch the tracked game and strictly match game ID, requester ID and human/bot participants. Finished results settle. Advertise only an active eligible game with positive count and matching bot bonus, with no reservation/handoff. Quiet verification failure leaves eligibility intact. A zero-count unfinished game remains tracked, but has no visible Rejoin warning. | [workflow.ts](../../game/client/winStreak/workflow.ts#L407-L475), lines 407–475; [useWinStreakProfile.ts](../../game/client/winStreak/useWinStreakProfile.ts#L97-L115), lines 97–115. |
| Wiring and presentation | App sends the local count on computer creation; game runtime queues authoritative observations and uses the same store for rematch/reset. MenuShell renders the existing badge, confirmed Reset and Rejoin warning. The bonus shown in the game/log is the fixed game bonus, not a newly calculated profile count. | [App.tsx](../../App.tsx#L311-L336), lines 311–336; [useGameSession.ts](../../game/client/useGameSession.ts#L1116-L1127), lines 1116–1127 and 6686–6712; [MenuShell.tsx](../../components/shells/MenuShell.tsx#L183-L216), lines 183–216; [battleLog_test.ts](../../game/client/tests/winStreak/battleLog_test.ts#L57-L80), lines 57–80. |

- A reload can retain both the shared profile and that tab’s sessionStorage. A fresh tab/browser session can retain the profile without the original credential; browser session restoration is not guaranteed. Names and session clearing do not themselves clear this profile. See [sessionManager.ts](../../utils/sessionManager.ts#L24-L34), lines 24–34 and 317–327, and [profile_test.ts](../../game/client/tests/winStreak/profile_test.ts#L39-L62), lines 39–62.
- Guest rejoin requires the original session identity. Session expiry causes 401; ordinary game reads do not replace an active match’s session. Opt-in fresh-game recovery can replace the session and retry once. That does not prove or recover the old seat. See [sessionManager.ts](../../utils/sessionManager.ts#L441-L499), lines 441–499.

### 1.2 Server-side evidence per game

| Stored evidence | Verified fact / limitation | Source |
| --- | --- | --- |
| `game_<id>` human participant, bot controller and optional human `accountId` | Human ID originates from the validated tab session. `accountId` is server-assigned for new account seats; historic guest seats have none. Names alone prove neither ownership nor run continuity. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L289-L395), lines 289–395 and 1425–1499. |
| `gameData.winStreakBonus.appliedCount`, bot recipient | The request count is checked only for nonnegative safe-integer shape, defaulting to zero. This currently applies even to account seats. Stored difficulty is authoritative for that game, but its originating count is client-reported, not proof of preceding wins. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L158-L173), lines 158–173, 345–348, 1441–1468 and 1861–1883. |
| Bonus application | The stored count contributes ordinary lines to the recipient on turn one. Existing line-distribution guards prevent repeat distribution; streak persistence must not add another bonus application. | [computeLineBonusForPlayer.ts](../../supabase/functions/server/engine/lines/computeLineBonusForPlayer.ts#L201-L212), lines 201–212; [onEnterPhase.ts](../../supabase/functions/server/engine/phase/onEnterPhase.ts#L804-L870), lines 804–870. |
| Status, winner and reason | Engine outcomes and clock timeouts are canonical. Resignation identifies the opposing winner; draws include mutual destruction, timeout draw and agreement. Do not accept browser-reported winners. | [GameStateTypes.ts](../../supabase/functions/server/engine/state/GameStateTypes.ts#L645-L678), lines 645–678; [IntentReducer.ts](../../supabase/functions/server/engine/intent/IntentReducer.ts#L374-L405), lines 374–405 and 3245–3272; [clock.ts](../../supabase/functions/server/engine/clock/clock.ts#L285-L338), lines 285–338. |
| Source/replacement restart lifecycle | Reciprocal IDs and source pending/completed status support idempotent recovery. Eligibility ends after the human’s first build commitment or later phase; bot-first submission alone does not end it. Timeout is persisted before eligibility is reconsidered. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L735-L775), lines 735–775 and 1510–1795; [GameStateTypes.ts](../../supabase/functions/server/engine/state/GameStateTypes.ts#L145-L161), lines 145–161. |
| `createdAt`, `stateRevision`, `game_history_<id>` | Creation time and per-game revisions exist. History stores completed turns/current capture and archive evidence, not a browser streak lineage. Computer rematches create fresh games without a canonical predecessor field; the explicit restart link is a special case. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L386-L389), lines 386–389 and 1809–1924; [battleLogHistory.ts](../../supabase/functions/server/engine/state/battleLogHistory.ts#L1833-L1846), lines 1833–1846. |
| Persistence boundary | `kv_store_825e19ab` is a table in the same Postgres database used by account tables. The adapter writes JSON `value` and the TypeScript-projected `game_head` together on canonical writes. Separate API calls are not a distributed-database constraint: a short SQL RPC can write the relevant KV and account rows atomically. | [intent_persistence.ts](../../supabase/functions/server/routes/intent_persistence.ts#L8), line 8 and lines 85–183. |
| Terminal writes | Intents persist the final human/bot state by revision CAS, then isolate post-commit work. Full/head reads can persist clock timeout through the shared maintenance path. Reset has another timeout-finalization path. Result integration must cover each rather than only resignation or the client’s screen observation. | [intent_routes.ts](../../supabase/functions/server/routes/intent_routes.ts#L585-L603), lines 585–603 and 693–764; [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L1230-L1312), lines 1230–1312 and 1573–1615. |

- **No full run linkage:** per-tab participant IDs can link games played in that session, but do not identify the browser’s selected run across tabs. There is no server record of local generation, menu resets, retirement or all preceding selected wins. Sorting the session’s wins or matching difficulty counts would invent proof.
- **Retention:** no automatic game/history or guest-session KV row cleanup was found in the inspected production paths. This is an absence of implemented retention, not a promise of permanent availability. Game credentials become unusable after 24 hours idle, with hourly-due accepted-intent renewal; expired rows are not thereby deleted. Account credentials last 90 days idle and account token/link cleanup can remove old linkage. See [index.tsx](../../supabase/functions/server/index.tsx#L149-L209), lines 149–209; [gameRequestIdentity.ts](../../supabase/functions/server/accounts/gameRequestIdentity.ts#L342-L394), lines 342–394; [04-forward.sql](../../../supabase/manual/account/04-forward.sql#L499-L548), lines 499–548. No database query was run to extend these observations.

### 1.3 Existing data — supplied CSV

Source: owner-supplied `C:\Design\Shapeships\development\analysis\22D0-streak-evidence.csv`, read locally for this pass. The export contains metric/value rows, no query execution timestamp or per-game rows. The referenced evidence SQL was not present in this workspace and was not run. “Last 30 days” means the export query’s window, not a newly measured window.

| Metric | Supplied value |
| --- | --- |
| Computer games | 440 |
| Oldest / newest computer creation, UTC | 2026-10-16 04:02:24.214+00 / 2026-11-23 18:14:50.719+00 |
| Computer games in last 30 days | 272 |
| Positive applied bonus, total / last 30 days | 234 / 152 |
| Maximum stored applied count | 9 |
| Applied count : number of games | 1:99; 2:56; 3:28; 4:17; 5:13; 6:11; 7:5; 8:3; 9:2 |
| Distinct positive-bonus human session IDs | 81 |
| Finished, total / human won / computer won / missing winner | 406 / 245 / 161 / 0 |
| Finished result reasons | decisive:333; resignation:33; narrow:25; timeout:15 |
| Unfinished positive-bonus games | 15 |
| Games with restart lifecycle / missing creation time | 0 / 0 |
| KV history rows / session-token rows | 3,996 / 2,114 |

- Arithmetic cross-checks: distribution totals 234; winner and reason totals each equal 406. Derived totals are 206 games without positive bonus and 34 unfinished computer games overall. These are aggregate calculations, not extra database findings.
- Session IDs are not people or households. Token/history rows are not counts of live sessions, current streak runs, or computer-only histories. The CSV cannot identify which unfinished game a browser currently tracks, the highest current local count, or whether stored counts were honestly accumulated.
- **Risk context (owner R2):** Phase 22 streaks only display a count/badge and make the computer harder. No rewards, leaderboard or ranked play exist; Stats is deferred. At this observed scale, a bounded migration concession can be proportionate and avoids routine owner work. The maximum observed bonus of 9 does not prove a maximum legitimate current count. Judd accepts evidence-bounded carry-over without a policy cap. Ranked play or future statistics must revisit both the trust policy and treatment of migrated counts.

### 1.4 What can be verified at claim/sign-in

| Candidate | Provable from existing evidence | Not provable / locked treatment |
| --- | --- | --- |
| Completed tracked win, original valid S available | Exact human session/participant, two-player human/bot game, canonical win and fixed difficulty. The stored-bonus bound is `appliedCount + 1`. | The preceding consecutive wins, absence of local reset or existence of a newer browser run. A result bound is not full-run verification (Q1/Q3). |
| Completed draw/loss/restart | Canonical result/reason. Draw preserves a bounded base; loss/resignation makes current count zero; restart is neutral, and its replacement must be considered separately. | An ended positive presentation snapshot cannot be imported as current progress. An earlier winning anchor cannot override a known later tracked loss. |
| Unfinished tracked game, original valid S available | Direct possession of the exact human seat, active status, bot recipient and stored bonus. Linking S to A at claim/sign-in does not change its historical ID. | Whether this is the browser’s latest selected run; no server local-reset history exists. Once selected and verified, durable account ownership can be assigned without changing labels/history. |
| Anchor and participant IDs only, original credential missing | IDs can be matched to the stored human/bot game, outcome and bound. This supports the limited count concession in Q2(a). | IDs are discoverable and are not seat-ownership proof. Never convert this evidence alone into a participant `accountId`, session delegation or access to an unfinished seat. Q2 resolves this as count-only import: no participant adoption or continuation. |
| Old credential retained but expired | Historical token possession is not needed for the locked stored-anchor count concession. | It is not a valid gameplay session and cannot authorise actions. No historical-token header/storage mechanism is added; valid S supplies direct proof, otherwise Q2 permits bounded count only. |
| Local count without usable game evidence | Only the browser’s assertion. | No automatic import. Preserve it for explicit retry/decline; do not fabricate a winning chain or accept an unlimited integer. |

### 1.5 Account interactions today

| Area | Current behavior / implication | Evidence |
| --- | --- | --- |
| Seat provenance | New assigned human seats have optional server-derived `accountId`, while player IDs remain session IDs. Guest seats are not adopted by claiming a matching name. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L303-L309), lines 303–309 and 2035–2068; [Account Design §2.4](Phase%2022%20Addendum%20-%20Account%20Design.md#24-accounts-and-game-sessions), lines 174–184. |
| LA6 | On-mode account-seat mutations need matching A, live token/account state and a valid link to the requesting S. Logout suspends actions; it does not resign/reset. Reads are exempt. Identity caching is bounded to 15 seconds; account writes need transaction-time authorization. | [gameRequestIdentity.ts](../../supabase/functions/server/accounts/gameRequestIdentity.ts#L136-L215), lines 136–215; [Account Design LA6](Phase%2022%20Addendum%20-%20Account%20Design.md#213-owner-lock), lines 417–423 and 437–445. |
| Second tab/device | A remembered token is shared, but a new tab has its own S and must link it. Existing join/read/intent/reset/rematch routes find participants by `session.sessionId`; owning the same A does not currently recover the old human seat. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L1971-L2039), lines 1971–2039, 1515–1552 and 2620–2626; [intent_routes.ts](../../supabase/functions/server/routes/intent_routes.ts#L423-L476), lines 423–476. |
| Claim / sign-in / forced change | Claim preserves S; Entry ensures an unnamed S for sign-in, and forced password change completes through the same account store. Those flows install identity/preferences, not streak state. No streak import or account cache exists in that store. | [App.tsx](../../App.tsx#L379-L404), lines 379–404; [accountStore.ts](../../game/client/account/accountStore.ts#L124-L145), lines 124–145 and 297–299; [accountSessionWiring.ts](../../game/client/gameSession/accountSessionWiring.ts#L100-L177), lines 100–177. |
| Logout / outages / 22B.4 | Logout immediately removes local account authority and clears player/S through App. Sibling sign-out and account unavailable/dormant revalidation return to guest Entry; remembered outage tokens remain for explicit retry. No path clears or copies the separate streak profile. Consequently current signed-in play still uses the same browser streak store as guests. | [App.tsx](../../App.tsx#L408-L445), lines 408–445; [accountStore.ts](../../game/client/account/accountStore.ts#L286-L322), lines 286–322; [Account Design 22B.4](Phase%2022%20Addendum%20-%20Account%20Design.md#22b4-entry-account-states--24-november-2026), lines 567–580. |
| Later read seam | Complete an explicit streak reconcile/import after successful account entry/resume, refresh on real menu entry and after a terminal game, then use server revisions. Existing preferences transport is a pattern, not an instruction to poll or add account work to guest play. | [App.tsx](../../App.tsx#L432-L470), lines 432–470; [accountApi.ts](../../game/client/account/accountApi.ts), existing account transport; [useGameSession.ts](../../game/client/useGameSession.ts#L1116-L1127), lines 1116–1127. |

## 2. Design record

### Approved baseline and design discipline

| ID / label | Decision and authority |
| --- | --- |
| A1 — **A** | Computer-only eligibility; one increment per qualifying win; loss/resignation reset; existing draws, restart/reset/rematch and fixed bot-bonus semantics remain. Main plan §8.1 and this audit §1.1. |
| A2 — **A** | Account-owned current run, browser-only guests, reconcile completed games before higher-current selection, account on ties, no count merging, selected unfinished continuation and no logout export. Main plan §§4.2–4.4 and 8.2–8.4. |
| A3 — **A** | One-time imports; no replay/stale-tab resurrection; genuinely new later guest runs remain eligible; existing game/session evidence required. A bare integer is insufficient. Main plan §8.3. The evidence-bounded concession and distinct-anchor risk are accepted in §2.11; this does not claim full legacy-run proof. |
| A4 — **A** | No interim deployment or live-game migration; accounts-on local development; deploy when idle after the completed phase, likely with 23/24. Historical "off is emergency rollback" wording from 24 November amendment 1 is **superseded by 25 November amendment 4**: use `ACCOUNTS_MODE=names-only` first; `off` only before SQL rollback. |
| A5 — **A** | SQL set 05 is delivered later as manual forward/one-SELECT verification/rollback; preserve sets 01–04 access and operational conventions. No database work or SQL creation in 22D.0. Main plan 19 November amendment 10 and 24 November amendment 3. |
| A6 — **A** | Simplest safe design first; account and KV rows share Postgres; weigh atomic RPC and create-then-enroll before an operations table. Record Phase 22’s low stakes and prioritise unchanged guest play. Owner R1–R4 in the approved 22D.0 brief/refinements. |
| A7 — **A** | General account-seat and multiplayer continuation are deferred. Q6 also defers cross-device continuation of the selected computer game; only its original validated session continues it. Owner lock §2.11. |

### 2.1 Data model and access — set 05

**P1 — A: Two tables.** One current run row and one globally unique used-anchor table. Result idempotency is the tracked game plus its status transition under the run lock; only that selected game can affect the count. Ownership is the human participant’s immutable server-assigned `accountId`. Rejected alternative: a per-game ledger.

All times below are UTC `timestamptz`; fields are NOT NULL unless marked `?`. Independent IDs are UUIDs; game/player IDs remain text. Counts use bigint constrained to `0..9007199254740991`, preserving existing numeric clients; revisions use positive bigint and travel as decimal strings. No FK into KV JSON, no device/IP fields, no credentials in these tables.

| Table | Columns and constraints | Indexes / simplest need |
| --- | --- | --- |
| `public.account_streak_runs` | `account_id uuid` PK/FK accounts ON DELETE CASCADE; `run_id uuid`; `current_count bigint` default 0; `revision bigint` default 1; `tracked_game_id text?`, `human_player_id text?`, `tracked_status text?` checked `unfinished/settled/retired/restart_pending`; `ended_count bigint?` positive, `ending_game_id text?`; `created_at`, `updated_at`. Tracked tuple is all-null or all-present; ended pair is both-null or both-present. Run identity rotates on a reset/new selected run, not every result; revision increases on every visible mutation. | Account PK is sufficient for current state. No count ranking or timestamp-only index. Ended fields preserve existing loss presentation without a separate history table. |
| `public.account_streak_imports` | `anchor_game_id text` PK, globally unique; `account_id uuid?` FK ON DELETE SET NULL; `anchor_human_player_id text`; `source_session_id text?` derived from verified evidence, never a raw credential; `reported_count bigint`, `accepted_count bigint`; `evidence_kind text` checked `direct_session/stored_anchor`; `selection text` checked `guest/account/declined`; `anchor_state_revision bigint`; `continuation text` checked `none/authorised`; `consumed_at`; Only processed eligible/declined anchors are consumed; malformed or foreign-owned claims do not create tombstones. | PK closes anchor replay across accounts and account deletion. Index `(account_id,consumed_at)` supports bounded owner lookup. No expiring tombstone cleanup. Actual accepted count and evidence kind are enough migration audit; do not store passwords, tokens, chat/Discord evidence or a player-supplied “verified” flag. |

**P2 — A: Use one short atomic game/run RPC where both must change.** Reason: same-database transactions remove the creation/enrollment gap without a saga. Rejected alternatives and their actual costs:

| Approach | Failure behavior / complexity | Recommendation |
| --- | --- | --- |
| (a) Atomic RPC | Edge builds canonical candidate and `game_head` with existing TypeScript helpers. RPC locks/rechecks the account run and bounded KV source rows, checks revisions/bonus/account participant, inserts the fresh game and empty history, and updates the run in one transaction. Any failure rolls back all those writes. A lost response is recovered from the account’s selected game; never blindly replay a create request. | **P2 approved.** No rules engine in SQL; SQL validates authorization, expected versions and persistence invariants. Preserve `value`/`game_head` agreement and existing history structure. |
| (b) Create first, enroll by CAS | Guest-compatible creation persists a game, then account enrollment checks expected run revision and game ID. Failed enrollment leaves a playable but non-counting game; retry of the same ID is idempotent. It needs explicit recovery and must never show enrollment failure as a counted game. An old failed game cannot later enroll after loss/reset using a fresh revision. | Viable smaller adapter change, but not recommended: partial success introduces avoidable handling for game bonus, existing-run retirement and which game the player should enter. Record it for comparison, not as the default fallback. |
| Operations table / worker saga | Could be needed if a future operation must coordinate an irreversible external effect or unavoidably span transactions and must resume after process death with no recoverable game/run evidence. Neither condition exists here. A response lost after atomic commit is not such a case: the tracked game and run survive. | **P2 reject for now.** No concrete uncovered failure justifies an operations table. If one is found during implementation planning, name it and amend this record before adding machinery. |

**P3 — A: Lock and compare, then apply exactly once.** Simplest design: existing account → token → session-link authorization order, then run row, then bounded game rows in stable game-ID order, then consumption/selection writes. Reason: serialize results, import and reset against each other and existing revocation. Rejected: worker-local locks, “largest count wins”, or making the 15-second identity cache sufficient for account writes.

- Revalidate token security version, account status and link inside account mutation transactions, including after waits. Use a 2-second lock timeout and bounded rows/retries within the 8-second API budget. Do not hold locks while computing engine state or making HTTP calls.
- Account run creation uses insert-if-absent followed by locking/recheck. Canonical source state changes during preparation produce a revision conflict; the Edge recomputes from fresh state rather than committing a stale result or bonus.
- Reconcile the selected game from persisted canonical state inside the locked transaction before comparing runs or resetting. Require the tracked ID and unfinished status under the run lock. A retired or unselected result cannot change a new run.
- An idempotent retry returns the current snapshot, not an old success snapshot/count. Do not add an operations UUID protocol merely to duplicate these game/run identities.

**P4 — A: Small service-role RPC boundary.** Reason: keep atomic behavior testable behind an injected repository. Rejected: browser queries, arbitrary table patches or a generic client-selected database action.

| Locked RPC | Inputs from the trusted Edge boundary / atomic behavior |
| --- | --- |
| `account_streak_reconcile` | Account token digest and required validated session ID; initialize/lock the run, reconcile its one tracked canonical game, return the full snapshot. No client count/result is authoritative. |
| `account_streak_commit_game` | Token digest, validated S, expected run revision, action `create/rematch/restart`, expected source game/revision where applicable, server-prepared candidate/head/empty history. Reconcile/recheck, retire/reset when appropriate, persist and enroll atomically. Restart replay follows the stored reciprocal link and does not reset a newer run. |
| `account_streak_reset` | Token digest, S and expected revision; reconcile then zero/retire under lock. Does not resign/delete the old game. |
| `account_streak_import` | Token digest, S, expected revision, local candidate and compare/decline decision. Reload authoritative anchors and result evidence, enforce the owner-locked Q1–Q3 policy, consume/select atomically; add current participant `accountId` only after direct seat proof. |

**P5 — A: Preserve set 01–04 access and owner conventions.** Simplest design: the same prefixed public tables/RPCs with explicit grants. Reason: existing service-role PostgREST access already supports this. Rejected: another schema/connection, SECURITY DEFINER, browser policies or realtime.

- RLS on with no policies; revoke table privileges and function EXECUTE from PUBLIC, anon and authenticated, reset inherited service-role ALL and grant only needed privileges. RPCs are SECURITY INVOKER, `search_path = ''`, schema-qualified, service_role-only. No schema-wide default-privilege edits.
- Minimum service-role table grants are SELECT/INSERT/UPDATE on runs, and SELECT/INSERT on import tombstones; deletion and tombstone anonymisation remain owner operations/FK effects. Reason: ordinary runtime never needs to erase consumption evidence. Rejected: granting inherited ALL or runtime DELETE merely because earlier account tables support owner cleanup.
- The read-only owner streak lookup is postgres-only, bounded to the current run and 100 recent import rows, with no credentials. There is no exception routine, owner queue or override.
- Set 05 updates the explicit FK/trigger guards in `account_owner_cleanup` and `account_owner_delete_development_accounts` to recognize precisely these dependencies. Account deletion removes the run row but anonymises and preserves import tombstones; report those counts. Do not let a new FK make routine maintenance fail or silently cascade away replay protection. Existing guards: [04-forward.sql](../../../supabase/manual/account/04-forward.sql#L499-L610), lines 499–610.
- Deliver set 05 as `05-forward.sql` (one transaction), `05-verify.sql` (one SELECT), `05-rollback.sql`. Verify exact constraints, signatures, ACLs, RLS/no policies and source restoration. Every UPDATE/DELETE has WHERE. Every pasted-script check comparing stored text to a literal removes `\r` on both sides, including function-body and configuration checks. No executable SQL is supplied here.

### 2.2 Signed-in lifecycle and authority

**P6 — A: Reuse canonical outcomes and fixed bonus application.** Simplest design: the account run changes only for its selected game; the existing engine still decides results and applies turn-one bonus. Reason: avoid a second rules lifecycle. Rejected: client result writes, incrementing on screen mount, or recalculating a live game’s difficulty after import/reset.

| Trigger | Account behavior |
| --- | --- |
| Eligible computer creation | Ignore client `winStreakCount` for a verified account seat, including malformed values in that unused field. Reconcile first. Use current account count unless a fresh game retires a reachable unfinished tracked game, in which case use zero; an unreachable tracked game is retired with the count preserved. Store the fixed bot recipient/count once. Guest parsing remains unchanged. |
| Human win / computer win / human resignation | Win increments once; loss/resignation resets once, saving existing ended presentation. Bot resignation is a human win if canonically recorded. Use winner relative to the actual human participant. |
| Draw / restart | Preserve count on canonical draw. Restart source never increments or becomes a loss; its selected replacement starts at zero and has the normal fixed zero bonus. |
| Timeout | Apply the persisted canonical winner/draw just like other results. Cover intent, game read/head maintenance and reset maintenance paths. No invented abandonment timer. |
| Abandon tab / logout | No immediate loss. Untimed unfinished game remains selected; timed game resolves under existing clocks. Logout suspends account-seat actions under LA6, without changing the count. |
| Menu Reset | Under lock reconcile any completed result, retire the selection and set zero/new run identity; preserve the old game and its history/bonus. |
| Early in-game restart | Existing eligibility rules; atomic account path stores reciprocal source/replacement links, fresh zero-bonus game/history and zero-count selection. Keep completed replay and existing pending-source recovery semantics. Guest multi-step pending recovery is unchanged. Account-path failure rolls back, rather than requiring a new operations table. |
| Later in-game Reset | Require canonical resignation/finished loss first, then ordinary zero-count rematch. If resignation committed but creation failed, the run stays legitimately zero; retry must not replay resignation or restore the old count. |
| Rematch | Reconcile the finished source and current tracked game before creating; inherit existing timing settings and validate the new assigned name. Rematching an old source uses the same Q6 reachable/unreachable rule for the currently tracked game. |
| Stale tab / second device | Adopt newer server revision even if count is lower. Conflicting mutation returns 409 with current state; refresh before a new deliberate action. No automatic conflict retry that changes selected game or converts a retry into another reset. |

**P7 — A: Post-commit settlement plus mandatory repair at account seams.** Reason: existing intent/read contracts must survive a temporary streak write failure. Rejected: making account success a prerequisite for returning an already-committed game action, or relying on the browser to report results.

- After a successful account-authorized terminal game mutation, attempt run settlement with transaction-time authorization. If it fails, retain the canonical terminal game; next successful account reconcile/import/reset/create reads and repairs it before proceeding. Never mutate the account using a detached/revoked link. A result finishing after logout waits for later valid account reconciliation.
- Read/polling routes do not acquire A authority or add account dependencies. A read-induced timeout remains canonical and is settled at the next explicit authorized account reconcile; the client triggers that after observing a terminal game. Read success does not depend on account availability.
- Guest seats keep their complete existing profile, route, timeout and result behavior, including current browser reconciliation failure handling. Account storage/authorization failure still holds the action. Unusable tracked evidence instead retires the association while preserving count and ended snapshot, as in the guest rule.

### 2.3 Guest-to-account carry-over

**A/Q1 — Evidence-bounded carry-over, no ceiling:** accepted = min(reconciled local current count, stored bound). A stored human win permits appliedCount + 1; draw and unfinished games permit appliedCount; canonical loss permits zero. Historic stored counts originated with the client; Judd accepts that trust at Phase 22’s difficulty/badge stakes. Ranked/Stats use requires renewed review. Numeric counts retain the existing safe-integer representation limit.

| Canonical anchor result | Stored bound / handling |
| --- | --- |
| Active eligible game | `appliedCount`; unfinished continuation additionally needs real seat proof, not just matching IDs. |
| Human win | `appliedCount + 1`, with safe arithmetic at the existing safe-integer limit. Reconcile first so the final win is neither omitted nor counted twice. |
| Draw | `appliedCount`; draw preserves the current run. |
| Human loss/resignation, or known later tracked loss | Zero current progress; ended snapshot is not eligible. Do not fall back to an earlier win to avoid the loss. |
| Restart source / malformed result / unavailable game | Follow a verified replacement where available; otherwise preserve the candidate for explicit resolution and do not invent a result. No automatic integer fallback. |

**P8 — A: One account-entry comparison after authentication, not repeated max().** Reason: keeps authentication successful even if streak transfer must retry, while protecting later streak mutations. Rejected: embedding unverified progress in credential fields, replaying CAPTCHA/password requests, or comparing local/account maxima on every sync.

1. Capture the current guest profile generation, anchor and original S before any session replacement; do not persist/share raw guest session credentials in localStorage. Complete claim/sign-in/forced change through existing routes, preserving S where currently supported.
2. Fetch/reconcile account state and verify/reconcile the offered guest tracked game. The candidate includes `resultPending` to distinguish an observed unfinished/eligible local record from an already-settled count. If the server finds a now-finished win, add one to the pending local candidate before applying the stored bound; already-settled wins are not incremented again. Canonical loss overrides either candidate to zero; draw preserves it. The flag is not proof and cannot raise the stored bound. This also handles completed-game reconciliation when the old credential is missing. Authentication does not itself confer authority over that game. No guest candidate means initialize/read the account state without an import request.
3. Under one import transaction, reread the selected account game and guest anchor under their locks, checking the prepared adoption revision when needed, calculate eligible current counts, consume the identified anchor and select the higher. Tie keeps account. A conflict recomputes from server state, not a new client maximum.
4. If the guest wins and its unfinished human seat is directly proven, add `accountId` to that participant’s current state by CAS, preserving ID/name/gameplay/history and fixed bonus. Never bulk-rewrite historical games or past logs. The run retains that game’s continuation.
5. Retire the unselected account selection without resigning/deleting it. An unselected guest game remains a guest game. Neither may later count toward the selected account run. Consume the offered anchor even when the account wins.
6. After confirmed selection/decline, clear the shared guest count/ended snapshot and retire its old association under the current lock, advancing generation. Fence in-flight creation/observation/recovery by the captured account and guest generations; late guest responses must not repopulate the transferred run. Then display the account cache.
7. A failed/unconfirmed import preserves the guest evidence without optimistic consumption. Signed-in streak-changing actions wait for resolution; ordinary multiplayer/account preferences and existing authenticated game access retain their own rules. Explicit decline uses the account run, consumes a valid offered anchor where possible and retires that local candidate. No new screen is assumed.

- Before new import eligibility checks, resolve an existing anchor tombstone: a same-account retry returns current state without replay; another account is refused. For a new candidate, require a guest human participant with **no stored `accountId` and no account-run enrollment**, even when any stored account would match the signing-in account. Reason: an account-owned game or copied account cache must never become a new guest import after a later loss/reset. Directly adopted anchors remain retryable only through their existing tombstone. This is part of P8’s one-time-transfer boundary, not an additional identity mechanism.

**A/Q2 — Missing original credential:** accept bounded count from matching stored game/human IDs without owner review. An unfinished game without direct session proof carries its count only: leave it unchanged, do not adopt its participant and do not continue it.

**A/Q3 — Locked: anchor consumption plus shared-profile consumption.** Reason: avoids guest request/storage/write changes during play. Rejected default: a new guest-run authority or lineage protocol for a difficulty count. Exact guarantees and residual limitations:

- Unique consumed anchor prevents that anchor from restoring progress after loss/reset, including from another account or after deletion. Local revision/generation/retirement and account-mode fences prevent cooperating stale tabs from restoring the transferred profile. Never evict server consumption tombstones.
- A genuinely new later guest run can offer a different authoritative anchor after logout; no lifetime “already imported” flag blocks all future guest play. Do not infer run independence solely from `createdAt` or reject an otherwise eligible independent run merely because its game predates another device’s import. The no-lineage choice retains the explicit distinct-anchor limitation below.
- **Residual gap:** different anchors may belong to the same unprovable legacy run. A modified/stale client can create a newer game with an old count; Web Locks absence, disabled shared storage, or copied profiles also weaken browser consumption. Stored evidence bounds each concession but does not prove independence. Judd accepts this distinct-anchor residual risk; no guest-lineage protocol is added.
- A bounded import does not rewrite fixed difficulty. A directly proven selected unfinished game may continue in its original session even when its fixed bonus differs from the accepted current count.

**A/Q3 — Guest-path impact comparison:**

| Surface | Recommended anchor/profile treatment | Server-minted lineage alternative |
| --- | --- | --- |
| Guest requests | No new requests, headers, bodies or response fields during guest play. Import only after account authentication. | Add lineage root/predecessor/receipt fields to existing computer-create and rematch requests/responses; handle restart replacement roots and expose receipts to the eligible requester on recovery. No account requests would be permitted during guest play even for this option. |
| Guest browser storage | Ordinary v1 profile remains authoritative and unchanged during play. At successful import/decline, use its existing count, retirement, revision/generation and shared storage event mechanisms to consume/reset it; no extra lineage key. | Add optional lineage/receipt fields or a separate evidence key; define capture across tabs, zero/reset roots, creation reservations, reload, unavailable storage and consumed-root fencing. Raw session tokens must remain tab-isolated. |
| Guest server reads | Existing behavior unchanged. | Verify predecessor outcome/receipt on continuation creation, adding a bounded predecessor KV read. |
| Guest server writes | No new writes or changed guest game payloads during play. Account import may adopt the one directly proven selected guest participant. | Persist server-minted root/predecessor/verified-prefix metadata and receipt verifier in new guest game rows; restart replacement writes must start/link the correct root. Canonical terminal results can supply outcome evidence without another terminal write. Any additional root record/write must be justified separately; do not assume it is free. |
| Guest failures / meaning | Preserve all current guest behavior. Account import bears the bounded migration risk. | Lineage failure must never block or alter guest play; mark proof unavailable and retain the local streak. Stronger import eligibility would depend on having that proof, adding recovery cases. |
| Import consumption | One anchor PK and shared-profile consumption, with the stated residual risk. | Consume the root across all descendant/branched anchors; existing legacy runs still need a migration exception. |

### 2.4 Original-session continuation — Q6 locked

A signed-in streak game continues only in the session (tab) where it started, including reload and claim/sign-in in that tab with direct proof. A new tab or device keeps the account count but gains no seat authority.

For fresh computer creation or rematch, account_streak_commit_game decides reachable by comparing the tracked human_player_id with the requesting validated session ID. A reachable unfinished game is retired and resets the count to zero. An unreachable unfinished game is retired without a loss and preserves the count. Either retired game can no longer affect the run. Early restart keeps its existing neutral zero-count replacement semantics.

No effective-participant helper, session binding, rejoin RPC or account rejoin route is introduced. General account-seat and multiplayer continuation are deferred. This supersedes main-plan §8.4’s cross-device continuation promise.

### 2.5 Client runtime and unavailable behavior

**P10 — A: Mode selection over isolated stores, unchanged presentation contracts.** Simplest design: keep the guest v1 store and add an account-keyed snapshot cache behind existing runtime hooks. Reason: preserves guest lifecycle and makes logout separation explicit. Rejected: switching the one shared guest count back and forth, copying account state on logout or putting networking in MenuShell/display.

- Signed-in hooks consume a server snapshot after account entry/resume and explicit reconcile. Local account state is only a cache; terminal observations request reconciliation rather than incrementing locally. Ignore old generations, wrong account IDs and lower server revisions; a newer lower count is valid.
- No-token guests create no account request and keep today’s profile/hook behavior. Pending import evidence is isolated from account-cache writes. Successful import/decline consumes the guest source; logout starts from safe guest state, never from an account count.
- Retain menu/game VM meanings and badge, Reset, Rejoin warning, fixed-bonus hover and battle-log copy. Ended presentation stays scoped to its ending game. New status/error plumbing belongs in runtime; do not assume new layouts or screens.
- Refresh at account-entry completion, actual Single Player/menu entry, after observing a terminal game and after deliberate streak mutations; no account polling interval is added to guest play or game-state polling. Account-token storage remains token-only, without cached names.

**A/Q4 — Isolated streak outage:** keep the player signed in, show the last known successful account snapshot and hold create, rematch, reset and import behind existing retry feedback. Continue normally authorised gameplay where its usual account-seat checks succeed. Initial loading has no authoritative count; never substitute a guest count.

- Authentication failure, revoked token, block or failed account revalidation still follows the already-approved account store/Entry behavior. This rule does not keep an unvalidated remembered name visible or override 22C.5b’s unavailable/dormant fallback.
- Initial account streak loading has no count authority; do not flash the guest count as the account’s. Preserve evidence on import failure. Q4 locks the small loading/error/retry treatment needed in existing menu/game feedback; no new screen or automatically queued account mutation is assumed.

### 2.6 Requests and responses

**P11 — A: Explicit account-streak routes, additive existing game bodies.** Reason: preserve credential/CAPTCHA contracts and existing game envelopes. Rejected: overloading preference writes with results, database calls in display, or adding account requirements to guest reads.

All paths are relative to `/make-server-825e19ab`. **G** is existing gateway Authorization/apikey, **S** is X-Session-Token, **A** is X-Account-Token. New account-streak requests require G/A and the current valid linked S; they do not accept a trusted body account ID or winner. Use the existing JSON 8 KiB cap, no-store, method routing, safe logs and account rate/protection seam. No new global limiter infrastructure or CAPTCHA is needed; assign these routes to the existing authenticated-token account-operation protection, with explicit route coverage in later fakes.

Locked `AccountStreakSnapshot` = `{accountId,runId,currentCount,revision,trackedGame,endedStreak,updatedAt}`. `currentCount` is a safe number; `revision` a positive bigint decimal string; `trackedGame` is null or `{gameId,humanPlayerId,status}`; `endedStreak` is null or `{count,endingGameId}`. Cache readiness/error is client state, not invented canonical game status. Count-only imports do not project a claimed seat.

| Method/path | Request | Success / client mapping |
| --- | --- | --- |
| POST `/accounts/streak/state` | G/A/S; `{}` | 200 `{ok:true,streak:<snapshot>}` after bounded reconciliation. Used after resume/entry, menu entry, terminal observation and explicit retry. Not a polling replacement. |
| POST `/accounts/streak/import` | G/A/S; `{expectedRevision,decision:"compare"/"decline",guest:{currentCount,anchorGameId,humanPlayerId,resultPending}}`; `resultPending` is boolean and only controls bounded reconciliation as in §2.3; capture local generation only for client fencing, not as server proof | 200 `{ok:true,streak,import:{anchorGameId,selection:"guest"/"account"/"declined",acceptedCount,continuation:"none"/"authorised"}}`. Same consumed anchor for the same account returns current state without reselecting; another account is refused. Unproven unfinished games import count only and do not continue. |
| POST `/accounts/streak/reset` | G/A/S; `{expectedRevision}` | 200 `{ok:true,streak}`. Existing menu Reset busy/error handling; no optimistic count write. |
| Existing POST `/create-computer-game` and computer `/new-game-from/:id` | Preserve existing fields; account requests add `expectedStreakRevision` decimal string. Ignore their `winStreakCount` when account-owned; guests unchanged. | Preserve existing create/rematch envelopes and fields. Before launch, account runtime reads the selected server snapshot; an ambiguous response recovers via `/accounts/streak/state`, not automatic create replay. |
| Existing POST `/reset-win-streak/:id` | Account request adds `expectedStreakRevision`; guests keep existing body | Preserve `{gameId,sourceGameId,resetStatus:"completed"}`. Completed replay checks seat authority and stored lifecycle; it cannot reset a newer run even if the supplied revision is old. |
| Claim / sign-in / password / resume | Existing request/response contracts remain | Authenticate/link first, then streak reconciliation/import before streak-changing actions. Import failure does not ask for the password/CAPTCHA again. Resume without S retains existing account recovery; establish/link fresh S before new streak operations. |

**P12 — A: Fixed public codes, existing envelopes.** Reason: codes distinguish conflict/proof/authority from credential errors without parsing SQL/message strings. Rejected: leaking SQLSTATE/details to the UI or treating every failure as an expired game session.

| SQLSTATE / route condition | HTTP / public code | UI / retry behavior |
| --- | --- | --- |
| P2250 stale run/game revision | 409 `STREAK_CONFLICT`, account envelope may include latest `streak` | Adopt newer state, refresh and require a deliberate action; do not retry a reset/create blindly. |
| P2251 unusable evidence | 422 `STREAK_IMPORT_UNVERIFIED` | Keep guest evidence; inline retry/decline. No integer or ownership fallback. |
| P2252 anchor consumed by another account / blocked reuse | 409 `STREAK_IMPORT_CONSUMED` | Use account state; consume the obsolete local source. Same-account idempotent replay is 200, never a repeated max(). |
| P2253 wrong/unproven seat | 403 `STREAK_SEAT_FORBIDDEN` | No navigation/delegation or spectator fallback to gain the seat. Matching IDs alone are insufficient. |
| P2255 missing/expired game evidence | 404 `STREAK_GAME_NOT_FOUND` | Preserve unresolved candidate and show retry/decline; no invented outcome. |
| Malformed fields / unsupported media / oversized request | 400 `INVALID_REQUEST` / 415 `UNSUPPORTED_MEDIA_TYPE` / 413 `REQUEST_TOO_LARGE` | Existing inline feedback. Missing account expected revision is INVALID_REQUEST; guest requests do not acquire this requirement. |
| Existing A/S errors | Existing 401/403 `ACCOUNT_TOKEN_REQUIRED/INVALID/EXPIRED`, `ACCOUNT_BLOCKED`, `GAME_SESSION_INVALID` | Existing account/session revalidation and Entry mapping. No active-match session replacement or automatic game replay. |
| Service/lock timeout / rate limit / dormant mode | 503 `ACCOUNT_SERVICE_UNAVAILABLE`, Retry-After 5 / 429 `RATE_LIMITED` with actual delay / 503 `ACCOUNTS_NOT_ENABLED` with no Retry-After | Existing unavailable/cooldown handling; Q4 for isolated streak service failure. No automatic retry loop. |

P2250/51/52/53/55 are the locked streak codes; retain P2201–P2212 and owner P224x meanings. P2254 is retired and unused. P2256 is internal only: the repository returns gameIdTaken, never a public error code. Account envelope remains `{ok:false,error:{code,message,field?,retryAfterSeconds?},streak?}`. Game route streak failures use `{error:CODE,message}`; intent failures retain `{ok:false,state:null,events:[],rejected:{code,message}}`. Successful game/intent envelopes remain unchanged. Ordinary gameplay does not gain an expected streak revision or an account streak call per turn.

### 2.7 Activation, rollback and the guest guarantee

| Label | Decision / reason / alternatives |
| --- | --- |
| A4 — **A** | Develop/test the finished feature locally with accounts on. Judd deploys when idle after the phase is complete; no partial-deploy, not-open-yet, in-flight-game migration or grandfathering plan. Main plan 24 November amendments 1–2. |
| P13 — **A** | Emergency disable uses `ACCOUNTS_MODE=names-only` first; fix forward with data retained where possible. A mode switch is neither schema rollback nor backup. Only if Judd chooses full schema rollback: take/confirm a private backup → set `off` → ensure deployed client/server code cannot call removed routines → reverse **05 → 04 → 03 → 02 → 01**, respecting every guard. Forward/rollback are postgres-editor transactions; verify is one SELECT. |
| P14 — **A** | Empty-table set-05 rollback removes its two tables and five added routines with RESTRICT and restores the exact changed set-04 owner bodies/ACLs. Preserve every canonical game/history/session KV row. SQL reversal cannot reconstruct accounts, credentials, counts or consumed anchors; preserve/restore the private backup. |
| P15 — **A** | Rollback locks both streak tables in ACCESS EXCLUSIVE mode and refuses if either contains rows: “rollback would destroy streak data; restore from the backup instead”. Restore from the private backup; never bypass this guard or delete consumed anchors. Never use set 01's destructive override as an activation recipe. |
| A4 / P16 — **A** | Historical "off remains the emergency mode" wording is **superseded by 25 November amendment 4**. First use `names-only`: sign-in/claim and streak routes are dormant, claimed names remain protected and existing games keep session authority. Remembered owners see the "couldn't reach your account" note and may play under another name. `off` is only for the step before SQL rollback. Keep account cache separate and never export account counts into guest storage. |

**P17 — A: 22E owner acceptance:** check direct claim and existing-account higher/tie imports, finished-result reconciliation, locked count-only treatment without the original credential, guest storage/requests, two tabs and devices, menu/in-game reset, early restart/replay, rematch, logout/forced change, isolated streak outage and full account outage. Confirm original-session continuation, cross-tab count preservation, and other-seat refusal. Attach set 05 ACL/constraint/concurrency and forward/rollback/reapply results from a disposable PostgreSQL mock, private backup/restore evidence, account cleanup guards and idle deployment checklist. Reason: fakes do not prove SQL locks/ACLs. Rejected: calling inspection or fake tests live-database acceptance. This pass performs none of those operations.

### 2.8 Focused tests for later passes

**P18 — A: Reuse injected repository, clock, Hono route and memory-CAS patterns.** Reason: existing suites already model the relevant boundaries without live data. Rejected: automated live-database tests, broad UI snapshots or tests duplicating implementation branches without observable behavior. Existing examples: [win_streak_routes_test.ts](../../supabase/functions/server/tests/routes/win_streak_routes_test.ts#L18-L114), lines 18–114 and 323–723; [fakeAccountRepository.ts](../../supabase/functions/server/tests/accounts/fakeAccountRepository.ts#L56), line 56 onward; [workflow_test.ts](../../game/client/tests/winStreak/workflow_test.ts#L226-L278), lines 226–278.

| Group | Required cases / observable result |
| --- | --- |
| Atomic persistence | Inject failure at game insert, history insert, run update and import consumption: no partial account creation/enrollment/reset. Preserve correct game_head. Simulate response loss after commit: explicit state recovery finds the one selected game; no create replay or operations table required. |
| Result application | Duplicate/reordered/concurrent win, loss, resignation, draw and timeout; one application per account/game. Retired/unselected game cannot change the new run. Newer lower revision/count is accepted. |
| Races | Result versus menu reset, fresh creation, import and logout; first valid committed lock order wins. Reconciliation before comparison includes a completed tracked result exactly once. Stale expected revision does not silently abandon the selected game. |
| Imports | New-account carry-over, higher guest/account, account on tie, no merging; selected continuation preserved with direct proof. Pending first win increments before comparison; an already-settled win does not increment twice. Bound by stored bonus/result, zero on canonical loss, no ended-count import, no integer-only acceptance. Malformed anchors and every newly offered account-owned/enrolled game, including the same account’s old game, are refused. |
| Replay / guests | Same anchor replay after later loss/reset is inert; same-account retry returns current state, other-account replay refused; tombstone survives deletion. Different later genuine guest anchor can import. Explicitly demonstrate Q3’s distinct-anchor limit rather than asserting impossible full lineage proof. |
| Browser transitions | Successful import/decline resets the shared guest profile and fences sibling work, late creation/recovery and storage events. Failed import retains evidence. Account cache never seeds guest mode, including logout, token replacement, denied storage and startup outage. |
| Restart/rematch | Early eligibility boundary, bot-first/human-first races, neutral replacement, reciprocal-link replay and pending-source recovery; later resignation then zero rematch; ordinary rematch after a completed win; failures cannot reset a newer account run. |
| Continuation | The original session alone controls its human. Another linked session may read the count and create a fresh game, retiring an unreachable selection without a loss. IDs-only unfinished imports never adopt or continue. No delegated identity or general multiplayer continuation. |
| Guest regression | Existing streak tests pass, including failed-reconciliation count preservation, zero-count tracking, draw preservation, retirement sealing, bonus/log copy, current session renewal and pending restart. Spies show no additional account calls or lineage reads/writes during guest play under the recommended option. |
| Outage / API | Terminal game remains committed when run settlement fails; next valid account reconcile repairs it. Read/head timeout succeeds without A/account availability. Exact envelopes, no-store, HTTP/P225x mapping, rate seam, loading/retry/decline and no automatic game replay. |

Later SQL verification runs on a disposable database with the planning assistant: ACL/RLS/invoker/search_path, safeupdate, CRLF/LF source checks, short lock waits, both concurrency orders, populated rollback refusal and backup/restore behavior, owner dependency guards, preserved tombstones, and forward → verify → rollback → prior verify → reapply. No automatic live-database test or SQL execution in this pass.

### 2.9 Remaining passes and acceptance attachment

**P19 — A: Server foundations, server integration, then client runtime.** Keep server authority and client/UI edits in separate scoped passes.

| Pass | Type / rough size | Deliverable / SQL | Acceptance attachment |
| --- | --- | --- | --- |
| 22D.1 | Server / large | Owner-locked schema/RPC contract, repository and transaction fakes; set **05** forward, one-SELECT verify and rollback. Include owner cleanup/deletion guard updates. | Offline authorization/CAS/idempotency tests; disposable PostgreSQL acceptance with planning assistant before 22E sign-off. SQL delivered for Judd to paste, never auto-applied. |
| 22D.2 | Server / large | Account lifecycle, atomic game/history/run integration, terminal settlement/repair, anchor imports and reset/rematch/restart routes. No guest-lineage protocol under the recommendation. | Focused game/account route tests and injected failures/races. No new SQL set unless an owner-locked gap changes set 05. |
| 22D.3 | Client/UI / large | Server snapshot cache/mode switch, account-entry import and guest-profile consumption, original-session continuation, existing menu/game callbacks and retry wiring. | Client lifecycle/workflow tests and owner browser review; guest requests/storage during play remain unchanged. No server or SQL edits. |
| 22E | Existing acceptance stage; separately scoped fixes | Full local account/guest flow and desktop/mobile acceptance; backups, SQL evidence and rollback readiness. | Judd locks results before one completed-phase idle deployment. Planning/implementation is not deployment authorization. |

### 2.10 Owner questions — resolved

All six questions are resolved by §2.11. There is no pending owner queue or policy decision for implementation.

### 2.11 Owner answers — 24 November 2026

Every retained P not changed below is **A**, locked as proposed. P9 is removed.

- **Q1 → (c), no ceiling:** accepted = min(reconciled local current count, stored bound): appliedCount + 1 for a human win, appliedCount for draw/unfinished, zero for canonical loss. Historic stored counts originated at the client; Judd accepts that trust for difficulty and badge only. Revisit for ranked play or Stats.
- **Q2 → (a), unfinished sub-decision (a):** matching stored game/human IDs permit bounded count without the original session. No owner queue or exception routine. Unproven unfinished games carry count only; no accountId adoption or continuation, and the game is unchanged.
- **Q3 → (a):** no guest-play request/storage/read/write changes. Consume the anchor and reset the shared browser guest profile after confirmed import or decline. Distinct-anchor residual risk is accepted.
- **Q4 → (a):** an isolated streak outage keeps sign-in and the last successful snapshot, holding create/rematch/reset/import behind existing retry feedback.
- **Q5 → (a):** no general account-seat or multiplayer continuation in Phase 22.
- **Q6:** defer cross-device continuation. Only the original session continues the game. Elsewhere preserve count; new computer creation retires an unreachable tracked game without a loss. Original-session fresh creation while unfinished keeps the reset consequence. This supersedes main-plan §8.4. No rejoin RPC/route, binding or effective-participant helper.
- **Two tables:** current runs and globally unique used anchors only. Only the tracked game can settle, once under the run lock. Participant accountId is never overwritten and prevents new account-owned anchor imports.

**Implementation refinements — 25 November 2026 (Judd), all A**

- **R1:** commit validates game key/ID, active revision-1 state, exactly the validated human with this account and one bot, controllers, resulting bonus/recipient, matching head identity/revision/status and matching empty history before writing. Any mismatch raises P2250. TypeScript owns all game JSON preparation.
- **R2:** unrelated game-ID collisions leave the run unchanged. Internal P2256 rolls back the transaction and maps only to repository outcome gameIdTaken; 22D.2 retries fresh IDs within MAX_GAME_ID_ALLOCATION_ATTEMPTS (5). Proven current-run/restart reciprocal replay returns current state without resetting a newer run.
- **R3:** lock the anchor before tombstone lookup, then replay/consumption before new eligibility. Same-account replay returns current state; another account is refused. Anchor PK conflicts resolve the same way, never as service-unavailable. Reserve consumption before adoption/selection writes.
- **R4:** rollback locks both streak tables and refuses populated data with “rollback would destroy streak data; restore from the backup instead”. No destructive override.

**Set-05 RPC signatures and server contracts**

| Routine | SQL arguments | Return |
| --- | --- | --- |
| account_streak_reconcile | bytea token digest, text validated session | Full snapshot |
| account_streak_reset | bytea, text, bigint expected run revision | Full snapshot |
| account_streak_commit_game | bytea, text, bigint expected run revision, text action, jsonb prepared game, jsonb history, jsonb nullable source | committed + gameId + snapshot; internal P2256 becomes gameIdTaken |
| account_streak_import | bytea, text, bigint expected run revision, text decision, jsonb guest, jsonb nullable adoption | Snapshot and import outcome |
| account_owner_streak_lookup | uuid account | Current run and at most 100 recent imports; postgres only |

Prepared game rows contain key/value/game_head; history rows contain key/value. Source/adoption records contain gameId, expectedRevision (null only for an absent legacy revision field) and nullable prepared update. Every game write preserves value/head atomicity. Missing canonical evidence for import anchors or rematch/restart sources raises P2255. A missing, malformed, unclassifiable or no-longer-owned unfinished tracked game is retired with count and ended snapshot unchanged, revision + 1 and updated_at advanced. No route is registered in 22D.1.

## 3. Pass completion and owner handoff

- **22D.1 scope:** owner lock, two-table manual SQL set 05, server repository/preparation, neutral factory extraction and in-memory contract tests. No routes or game-flow integration, client changes, configuration, SQL execution, deployment or commit.
- **Layer:** account serialization, authorization and canonical state persistence remain server-owned. Shared factory extraction preserves guest behavior and structure.
- **Validation:** implementation results are recorded in main-plan §15. SQL: Not run — the planning assistant mock-tests set 05 on a disposable PostgreSQL before Judd applies it.
- **Owner steps:** on PostgreSQL 17, clean forward → verify → empty rollback → set-04 verify → reapply; separately exercise populated rollback refusal, both concurrency orders, insert-time collisions, CRLF paste and owner guards. Then Judd backs up and applies set 05, unused until 22D.2.
- **Accepted limits:** historic counts were client-originated; full legacy-run proof is absent; distinct-anchor risk remains; no unproven seat takeover or cross-device continuation. Populated schema rollback requires the private backup.
