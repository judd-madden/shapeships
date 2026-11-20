# Phase 22 Addendum — Account Design

- **Pass:** 22C.0 — Server Pass, design and audit only; client/runtime inspection is read-only.
- **Date / owner:** 19 November 2026 / Judd Madden.
- **Status:** proposed, awaiting owner lock. Approval to write this record does not approve its proposed account implementation.
- **Purpose:** establish the account contract before SQL or server code, then build Entry account states and Claim Name against real requests.
- **Allowed files:** this record and `Phase 22 Menu and Account.md` only. No executable SQL, code, configuration, tests, database requests or deployment in this pass.
- **Decision labels:** **A** already approved, with source; **P** proposed, with reason and alternatives; **O** owner question in §2.12. Unlabelled audit statements in §1 are observations, not decisions.
- **Owner review:** read §1 and the **10 open questions** in §2.12 first, then lock or amend the P decisions. Brief 22C.1 from the locked record.

## 1. Audit

Repository citations give inspected file/line ranges, before any later implementation. Database evidence is the supplied `C:\Design\Shapeships\development\analysis\Supabase Snippet DB Inventory.csv`, identified below by its `section` and `object` columns. Judd confirmed the query scanned all non-Supabase schemas. Later owner corrections are identified separately; this pass made no database connection.

### 1.1 Game sessions

| Area | Current behaviour | Evidence |
| --- | --- | --- |
| Minting | `/session/start` creates 32 random bytes encoded as 64 hex characters. The separate internal ID is `session_<timestamp>_<Math.random suffix>`, not the secret. | [auth_routes.ts](../../supabase/functions/server/routes/auth_routes.ts#L15-L74), lines 15–74. |
| Persistence | Writes the same record, including the raw game token, `sessionId`, `createdAt` and optional `displayName`, to `session_token_<token>` and `session_id_<sessionId>`. These are sequential writes, not a transaction. | Same file, lines 49–64; [index.tsx](../../supabase/functions/server/index.tsx#L55-L118), lines 55–118, uses `public.kv_store_825e19ab`. |
| Validation | Looks up the token key and rejects age greater than 24 hours; returns session ID, creation time and name. `requireSession` reads `X-Session-Token`. No sliding renewal, refresh-token mechanism or expired-row cleanup exists in this path. | [index.tsx](../../supabase/functions/server/index.tsx#L129-L195), lines 129–195. |
| Tab isolation | `ss_sessionToken`, `ss_sessionId` and `ss_displayName` use `sessionStorage`. Cached token + ID return immediately without server validation. Token without ID invokes `/session/me`; 401/403 clears it, other errors retain it. | [sessionManager.ts](../../utils/sessionManager.ts#L16-L26), lines 16–26 and 105–182. Duplicating a browser tab can initially copy sessionStorage; tabs are not cryptographic device identities. |
| Metadata | `GET /session/me` returns `{sessionId, createdAt, displayName}` after validation, with no account, preferences or badge. | [index.tsx](../../supabase/functions/server/index.tsx#L250-L282), lines 250–282. |
| Clearing / expiry recovery | `clearSession` removes only browser keys; it does not revoke server rows. Opt-in new-game recovery replaces an expired session, explicitly unsafe for an existing match. | [sessionManager.ts](../../utils/sessionManager.ts#L248-L255), lines 248–255 and 335–389. |

### 1.2 Name trust and presentation paths

| Path | Current source and checks | Evidence |
| --- | --- | --- |
| Session start | Accepts optional `displayName` without a type, format, ownership, banned or reserved-name check. | [auth_routes.ts](../../supabase/functions/server/routes/auth_routes.ts#L38-L74), lines 38–74. |
| Create multiplayer / computer game | Server derives participant ID from the session, but accepts trimmed body `playerName`; only checks that the resulting string is nonempty. Game constructors persist it. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L218-L375), lines 218–375, 1329–1369 and 1402–1438. |
| Reset win streak | Reuses the existing human participant's stored name; checks nonempty. This is also a new-seat name assignment path. | Same file, lines 1475–1484 and 1581–1595. |
| New game from finished game | Uses the requesting participant's stored name; checks nonempty, but does not recheck present-day name eligibility. | Same file, lines 1766–1803 and 1820–1888. |
| Join / spectator entry | Accepts body `playerName`, checking truthiness rather than string/format. New participants store it; rejoining participants keep their stored identity/role. Join action text also interpolates the submitted name. | Same file, lines 1915–1932 and 1978–2045. |
| Switch role / leave spectator | Uses stored participant identity and name; promotion therefore needs future enforcement even though the request contains no new name. | Same file, lines 2187–2293 and 2301–2465. |
| Game state, head and history | Project previously stored participant names. They do not establish name ownership. | Same file, routes at lines 2527, 2951 and 3033. |
| Chat | Message sender name comes from the participant, not message body; the route stores emitted names. `/chat-state` returns stored entries. | [IntentReducer.ts](../../supabase/functions/server/engine/intent/IntentReducer.ts#L2604-L2627), lines 2604–2627; [intent_routes.ts](../../supabase/functions/server/routes/intent_routes.ts#L351-L370), lines 351–370 and 813–840. |
| System / bot senders | Server uses participant/action ID `system` with display `System`; bot display is `Computer`. Both names need reservation. | [game_routes.ts](../../supabase/functions/server/routes/game_routes.ts#L267-L375), lines 267–375, 2024–2043 and 2457–2465. |
| Entry and local names | Alpha Entry enforces `^[A-Za-z0-9]{3,20}$` only in the client. `usePlayer` has temporary client IDs/names; the game helper can generate two-word names containing a space. These bypass the agreed name format outside ordinary Entry. | [AlphaEntryPanel.tsx](../../components/panels/AlphaEntryPanel.tsx#L29-L67), lines 29–67; [usePlayer.tsx](../../game/hooks/usePlayer.tsx#L15-L87), lines 15–87; [playerName.ts](../../game/client/gameSession/playerName.ts#L1-L49), lines 1–49. |

No executable repository reference to `screen_names`, or code creating its experimental objects or the duplicate KV indexes, was found by repository search. Existing server names are metadata, not account proof; matching an old name must not transfer ownership.

### 1.3 Database inventory and resolved maintenance

**Coverage:** `public` is the only non-Supabase schema found. There are **no functions, views or ordinary triggers in public**, including no remaining screen-name functions/triggers. Platform event triggers are separate objects, listed below. Sources: inventory sections 02–15 plus Judd's R1 coverage confirmation.

| Relation | Snapshot rows / size | RLS / force RLS | Policies and effective browser access |
| --- | --- | --- | --- |
| `public.kv_store_825e19ab` | 12,250 / 270 MB | true / false | No policies; browser roles have grants but RLS denies rows and writes. Server uses service role. |
| `public.kv_store_825e19ab_pre_alpha_archive_20260429` | 4,179 / 7,544 kB | true / false | No policies; same RLS barrier. Audit only; propose no cleanup. |
| `public.kv_store_2243ca4c` | 3 / 696 kB | true / false | No policies; same RLS barrier. Unreferenced; propose no cleanup. |
| `public.kv_store_67bdd4b5` | 0 / 216 kB | true / false | No policies; same RLS barrier. Unreferenced; propose no cleanup. |
| `public.screen_names` | 0 / 32 kB | true / false | `public read`: SELECT for PUBLIC using true. `no direct inserts`: INSERT for PUBLIC check false. Browser roles can read any rows; writes are denied by RLS. |

- **Privileges finding:** all five tables grant SELECT/INSERT/UPDATE/DELETE to both `anon` and `authenticated`; RLS is the only row-access barrier. The screen-name public-read policy is unnecessary exposure for the future account model, even though the table is empty. Grants alone do not mean the KV rows are currently exposed. Sources: sections 03, 08 and 11.
- **Default privileges:** in `public`, objects owned by either `postgres` or `supabase_admin` automatically grant browser roles table privileges, sequence usage/read/write and function execution. New account objects must explicitly revoke these grants in the same transaction that creates them. PostgreSQL's PUBLIC function execution must also be revoked. Source: section 13.
- **Browser dependency:** [App.tsx](../../App.tsx#L605-L617), lines 605–617, is the only browser table query found: the development Supabase test selects one active-KV row. Optional KV browser-grant revocation would make this show a permission error; server service-role access remains. See O10; no privilege change is made here.

| `screen_names` object | Snapshot definition / dependency |
| --- | --- |
| Columns | `user_id uuid NOT NULL`; `screen_name text NOT NULL`; `screen_name_lower text NOT NULL`; `created_at timestamptz NOT NULL DEFAULT now()`. |
| Constraints | `screen_names_lower_unique`: UNIQUE(screen_name_lower); `screen_names_user_id_unique`: UNIQUE(user_id); `screen_names_user_id_fkey`: user_id → auth.users(id), ON DELETE CASCADE. No primary key is listed. |
| Indexes | Unique indexes backing both unique constraints; `idx_screen_names_created_at`, btree(created_at). |
| Policies | `public read` and `no direct inserts`, as above. No ordinary triggers, functions or views depend on the table in the inspected public schema. |
| Auth users | `auth.users` has **1 row**. The inventory does not identify its owner or purpose. Account design will not depend on Supabase Auth users. See O9. |

Sources: sections 04, 05, 07, 08 and 17.

| Operational fact | Finding / disposition |
| --- | --- |
| Duplicate indexes — **resolved, 19 November 2026** | Historical inventory: active KV had 213 indexes: primary key + 212 identical btree(key text_pattern_ops) indexes. Each unused KV had 25 pattern indexes + primary key, 26 total. Judd subsequently confirmed duplicate KV index removal and **2 indexes now on `kv_store_825e19ab`**. This is owner-confirmed, not re-queried. No current counts for the other tables or post-cleanup size are inferred. Maintenance is resolved and outside account passes. |
| Database size | 270 MB was the active table's historical size, not total current database usage. Activation must check current total size and headroom against the Free plan's [500 MB database limit](https://supabase.com/pricing). Do not reuse the stale size as a post-cleanup measurement. |
| API role | `authenticator`: `session_preload_libraries=safeupdate`, `statement_timeout=8s`, `lock_timeout=8s`. Keep RPCs short and every UPDATE/DELETE scoped by WHERE. Section 16. |
| Extensions | `pgcrypto` 1.3, `uuid-ossp` 1.1 and `pg_stat_statements` 1.11 in `extensions`; `pg_graphql` 1.5.11 in `graphql`; `plpgsql` 1.0 in `pg_catalog`; `supabase_vault` 0.3.1 in `vault`. **No pg_cron installed.** Section 14. |
| Event triggers | `graphql_watch_ddl`, `graphql_watch_drop`, `issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`, `pgrst_drop_watch`, all enabled O. Their presence does not imply pg_cron/pg_net is installed. Section 15. Retain platform triggers. |

### 1.4 Dormant scaffolding and reusable seams

| Finding | Later disposition | Evidence |
| --- | --- | --- |
| `/signup` has its own hardcoded disable flag and otherwise an unimplemented email-based stub. The kernel also declares an auth-disable constant. | Retire the obsolete signup path safely; do not enable it to build username accounts. | [auth_routes.ts](../../supabase/functions/server/routes/auth_routes.ts#L81-L114), lines 81–114; [index.tsx](../../supabase/functions/server/index.tsx#L13-L17), lines 13–17. |
| Login and Forgot Password call Supabase email/password and email reset; Create Account directly fetches `/signup`, bypassing the networking seam. | Replace dormant email behaviour in later UI passes. Reuse input/button, loading and password-display primitives where suitable. No fabricated email addresses. | [LoginPanel.tsx](../../components/panels/LoginPanel.tsx#L18-L47), lines 18–47; [ForgotPasswordPanel.tsx](../../components/panels/ForgotPasswordPanel.tsx#L18-L39), lines 18–39; [CreateAccountPanel.tsx](../../components/panels/CreateAccountPanel.tsx#L20-L59), lines 20–59. [Phase 16](Phase%2016%20-%20Server%20Hardening%20and%20Cleanup.md#L365-L375), lines 365–375, explicitly deferred account networking and generic rate limiting. |
| Shell authentication is disabled; name submission invokes the existing runtime callback. Change Name / logout delegate to session reset. | Preserve shells as active code; replace identity wiring, not whole screens or routing. Claim must not reuse reset. | [ScreenManager.tsx](../../components/ScreenManager.tsx#L12-L106), lines 12–106; [App.tsx](../../App.tsx#L325-L329), lines 325–329, clears player and session. |
| Preference store has five fields and an internal `applySnapshot`; it is not returned as a public hook. | Expose a presentation-safe external-snapshot application in 22C.5. Do not treat it as already callable, or route hydration through deliberate save callbacks. | [playerPreferences.ts](../../game/client/preferences/playerPreferences.ts#L1-L101), lines 1–101. |
| Streak profile is local; tracked games carry `humanPlayerId`; current-session ID supplies that ID. | 22D needs verified account-to-participant provenance, not a display-name match or client count. No streak design here. | [types.ts](../../game/client/winStreak/types.ts#L39-L73), lines 39–73; [profile.ts](../../game/client/winStreak/profile.ts#L7-L24), lines 7–24 and 157–239; [useWinStreakProfile.ts](../../game/client/winStreak/useWinStreakProfile.ts#L32-L80), lines 32–80. |

### 1.5 Runtime constraints and source-IP confidence

- Hosted Free Edge workers have **256 MB memory shared by concurrent requests** and **2 seconds CPU per request**; waiting on I/O is not CPU time. Free worker wall-clock lifetime is 150 seconds, not a hash CPU budget. Local Docker timings do not establish hosted CPU cost. Sources: [Supabase limits](https://supabase.com/docs/guides/functions/limits) and [Wasm support](https://supabase.com/docs/guides/functions/wasm).
- Server uses supabase-js 2.49.8 with server-only URL/key fallbacks; KV helpers access public through PostgREST. [index.tsx](../../supabase/functions/server/index.tsx#L22-L118), lines 22–118.
- Browser sends anon `Authorization: Bearer <publicAnonKey>`, `apikey`, and game `X-Session-Token`; Authorization is not application identity. CORS is `*`, permits these headers and GET/POST/PUT/DELETE/OPTIONS, exposes Content-Length only. [sessionManager.ts](../../utils/sessionManager.ts#L268-L295), lines 268–295; [index.tsx](../../supabase/functions/server/index.tsx#L206-L216), lines 206–216.
- `deno task local-live` uses Docker-served `make-server-825e19ab`, `.env.local-live` and `--no-verify-jwt`; config points that function at the existing server entrypoint. [deno.json](../../../deno.json#L23-L35), lines 23–35; [config.toml](../../../supabase/config.toml#L25-L26), lines 25–26. No environment files or secret values were inspected.
- `ENABLE_TEST_ROUTES` must equal `true` to register diagnostics; test-connection/system-test write and delete real KV rows if enabled. Do not invoke them for this audit. [index.tsx](../../supabase/functions/server/index.tsx#L222-L225), lines 17 and 222–225; [test_routes.ts](../../supabase/functions/server/routes/test_routes.ts#L30-L186), lines 30–186.
- **IP confidence: low / unverified.** No verified managed-service guarantee was found establishing that `cf-connecting-ip` or a particular X-Forwarded-For position is overwritten safely on every hosted ingress. Neither is authoritative merely because present. Candidate: infrastructure-written `cf-connecting-ip`, only after activation verification. Send forged, missing, duplicate and multi-value versions of candidate headers through the real function URL from two networks; compare observed ingress with known source addresses, and confirm the trust contract with Supabase. Record the exact header/chain rule. Do not deploy an echo endpoint that exposes credentials. If a trustworthy extractor cannot be established, keep public claim/sign-in disabled rather than accept arbitrary fallback headers; investigate a trusted ingress separately.

## 2. Design record

### Approved baseline

| ID | Status / source | Locked behaviour |
| --- | --- | --- |
| A1 | **A** — main plan §4, §7; 18 November amendments 8–10 | Dedicated Postgres accounts; no email; names 3–20 ASCII alphanumerics; unique case-folded ownership with chosen casing retained; passwords at least 10 characters, no class rules/truncation; Turnstile; remembered sign-in 90 days idle, renewed on use. |
| A2 | **A** — main plan §4.2–§4.5, §6; 18 November amendment 11 | Preserve the current game session on claim; deliberate logout returns to Entry and cannot auto-restore; Discord-assisted reset with unreadable passwords; only the claimed-name shield, for every signed-in account; exactly five synced preferences. |
| A3 | **A** — 19 November amendments 9–14 / approved 22C.0 brief | Server first, owner lock before SQL/code, real account requests before remaining Entry/Claim UI, SQL pasted by Judd, local Docker against live DB, no automated live-DB tests, Free plan, proportionate security and published development CAPTCHA keys. |
| A4 | **A** — owner R1–R8 and subsequent maintenance correction, 19 November | Explicit grants/RPC safety; four-hash proposal; decoded moderation tiers/exceptions; local reset tooling instead of a deployed owner route; linking in 22C.2; 22C.5 client-runtime only; duplicate-index maintenance resolved and excluded. |
| A5 | **A** — owner's clarification during planning | No executable SQL in 22C.0, including the appendix. Owner procedures are described here; scripts ship later. |

### 2.1 Data model and access

**P1 — Public, prefixed tables reached through existing service-role supabase-js/PostgREST.** Reason: works with the current server seam without exposing a new schema or adding a direct SQL connection. Alternatives rejected: browser Auth access, account KV records, or a private schema requiring exposed wrapper RPCs/custom connection configuration.

All columns below are NOT NULL unless marked nullable. Tables have RLS enabled with no policies for browser roles. UUIDs are server/database generated, times are `timestamptz` in UTC, and foreign keys point only to these account tables, not `auth.users`.

| Table | Columns / constraints / indexes — proposed under P1 |
| --- | --- |
| `account_accounts` | `id uuid` PK; `display_name text` constrained to ASCII alphanumerics length 3–20; generated `name_key text` = lowercase display name under deterministic ASCII/C semantics, UNIQUE; `status text` checked `active/blocked`, default active; `security_version bigint` default 1, positive; `created_at`, `updated_at`. Display casing is immutable in this phase. Unique ownership index is the arbiter. |
| `account_credentials` | `account_id uuid` PK/FK accounts ON DELETE CASCADE; `password_hash text` (bounded encoded-hash length, no plaintext); `password_format text` identifies normalization policy + hash format; `updated_at`. Separate credentials reduce accidental selection with identity fields. |
| `account_tokens` | `id uuid` PK; `account_id uuid` FK CASCADE; `token_hash bytea` UNIQUE, exactly 32 bytes; `security_version bigint`; `created_at`, `last_used_at`, `expires_at`; `revoked_at` nullable. Index `(account_id)` for bulk revocation and `(expires_at)` for bounded cleanup. No raw token or device metadata. |
| `account_session_links` | `session_id text` PK, from a validated KV session; `account_id uuid` FK CASCADE; `token_id uuid` FK tokens CASCADE; `revision bigint` positive; `linked_at`, `updated_at`; `detached_at` nullable. Index account_id and token_id. No FK into KV JSON. This small relation makes account linkage/revocation transactional without writing two KV session copies. Server verifies token ownership matches account_id. |
| `account_preferences` | `account_id uuid` PK/FK CASCADE; five boolean columns `sound_enabled`, `health_flash_enabled`, `chat_minimized`, `battle_log_preferred`, `music_enabled`; `revision bigint` positive default 1; `updated_at`. No other device preferences enter this row. |
| `account_name_rules` | `id uuid` PK; `kind text` checked `banned/reserved/exception`; `match_kind text` checked `exact/contains`; `match_key text` length 1–64; `source text` length 1–256; `note text` length ≤500; `created_at`, `updated_at`. UNIQUE(kind, match_kind, match_key). Reserved and exception rows allow exact only; reserved keys use ownership normalization, other keys use moderation decoding. |
| `account_rate_limits` | `scope text` checked against implemented limiter/replay scopes; `subject_hash bytea` exactly 32 bytes; `window_start timestamptz`; `count integer` nonnegative; `expires_at`; composite PK `(scope, subject_hash, window_start)`; expiry index. IP/target subjects use keyed HMAC, not raw IP. A dedicated replay scope uses a token digest with constant window_start to reject repeated successful CAPTCHA use. |
| `account_owner_events` | `id uuid` PK; `account_id uuid` nullable FK accounts ON DELETE SET NULL; `rule_key text` nullable; `action text` checked against supported owner operations; `note text` ≤500; `created_at`. Index `(account_id, created_at)`. No password, token, IP, Discord message or extra personal-data fields. SQL editor owner is the operator; no pretend player-supplied actor field. |

**P2 — Deny browser roles and use service-role-only SECURITY INVOKER RPCs.** Reason: combine privilege isolation with RLS and preserve existing privileged server access. Alternatives rejected: relying on RLS alone, browser-owned policies, SECURITY DEFINER elevation or unrestricted RPC execution.

- Revoke all privileges from `PUBLIC`, `anon` and `authenticated` on each new table and sequence, and revoke their function EXECUTE; explicitly grant only required table/sequence privileges and RPC EXECUTE to `service_role`. Do this before committing each SQL set. No identity/credential views or realtime publication.
- RPCs use **SECURITY INVOKER**, `search_path = ''` and fully qualified objects. `service_role` bypasses RLS; invoker functions do not grant authority to callers lacking privileges. Supabase recommends explicit execution controls: [database functions](https://supabase.com/docs/guides/database/functions).
- Do not alter schema-wide default privileges for unrelated objects in this pass series. Counter their inherited grants explicitly per object, then verify actual ACLs, RLS and absence of policies. Optional KV privilege hardening is O10, outside this default account-object change.
- RPCs have short work and bounded rows; no password hashing or network calls inside a transaction. Every UPDATE/DELETE has a WHERE clause for safeupdate, including owner and cleanup routines. Lock rows in stable order and return conflicts promptly rather than wait through the eight-second API timeout.

**P3 — Transactional service RPCs with constraint-backed claim uniqueness.** Reason: PostgREST client calls cannot group separate inserts atomically. Alternatives rejected: lookup-then-insert, multi-request compensation or browser-asserted ownership.

- `account_claim`: receive validated display/key, encoded hash/format, first token hash, validated session ID, and five preference values; recheck moderation/reservation and insert all account rows plus session link in one transaction. Claims take a shared transaction-level advisory lock on one fixed name-rules lock key; owner rule changes take the exclusive form of that same lock, so a contains-rule edit also serializes correctly. UNIQUE name_key means exactly one same-name claim wins; map its specific conflict to NAME_TAKEN. Any other failure rolls everything back.
- `account_finish_signin`: after Edge verification, compare the observed credential/security version under lock, then issue token and link. A concurrent reset/block must cause rejection, not mint a usable token from a stale password verification.
- Token authorization/renewal, logout, link/unlink, preference updates and owner reset/block use short RPC transactions. Account writes lock and revalidate token/status/security version within the same transaction, including commit-time authorization. Inputs never contain trusted account IDs from the browser.
- No pg_cron dependency. Opportunistic cleanup deletes at most 100 expired counters/revoked-or-expired tokens per successful account entry operation, at most once per minute per worker as an optimization, with row-level bounds in the RPC. Owner cleanup handles a backlog in repeated batches. Worker memory is never the source of truth for rate limits or expiry.

**P4 — Manual numbered SQL packages outside migrations.** Reason: match Judd's SQL-editor workflow and avoid accidental CLI application. Alternatives rejected: automatic migrations, unversioned Dashboard edits or combined unreviewable scripts.

- Proposed folder: `supabase/manual/account/`; each set has `NN-forward.sql`, `NN-verify.sql` (one SELECT yielding a structured result), `NN-rollback.sql`, and its pass notes. Create no package in 22C.0.
- Forward scripts run in one transaction, acquire only short locks and fail if preconditions drift. Do not alter, delete rows from, rebuild indexes on or otherwise modify the active game KV table; O10 can authorize a separate grant-only exception. Do not change the three unrelated KV tables by default.
- Set 01 checks `screen_names` is still empty, explicitly removes the two named policies, FK and unique constraints (their backing indexes disappear), drops the remaining created_at index and table with RESTRICT. No public functions/views/ordinary triggers need dropping. Leave platform event triggers and the Auth user alone. Stop on unexpected dependencies or nonzero rows; never use CASCADE to hide drift.
- Rollback restores the empty stub's inspected columns, constraints/indexes, policies and original grants; it does not recreate a deleted Auth user or reverse separate index maintenance. Reverse later SQL sets before earlier ones. Capture exact object signatures in each verification/rollback package.

### 2.2 Passwords

**P5 — Argon2id through pinned `npm:hash-wasm@4.12.0`.** Reason: OWASP's preferred memory-hard algorithm, with embedded Wasm and Deno support, avoiding native modules. Alternatives rejected: bcrypt's legacy status/72-byte constraint, scrypt's higher default memory, and PBKDF2 as the first choice when Argon2 is viable. Sources: [OWASP parameters](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [library v4.12.0](https://github.com/Daninet/hash-wasm/tree/v4.12.0), [hosted Wasm support](https://supabase.com/docs/guides/functions/wasm). Hosted compatibility remains to be measured, not assumed from those sources.

| Decision | Proposed contract |
| --- | --- |
| Parameters | Argon2id v19, memory 19,456 KiB (19 MiB), iterations 2, parallelism 1; random 16-byte salt per credential; 32-byte hash; encoded PHC output. Meets the cited OWASP minimum. |
| Input | Minimum 10 and maximum 128 **Unicode code points after the chosen normalization**, maximum 512 UTF-8 bytes after normalization. Reject malformed Unicode and oversized raw request bodies (8 KiB total account JSON cap); reject normalized over-limit passwords, never truncate or trim. Permit whitespace and all well-formed Unicode, with no class rules. |
| Normalization — **O1** | Settle before any real hash. Recommend NFC from current [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html); older 800-63B recommended NFKC/NFKD. NFKC is an explicit alternative. This record does not claim full NIST compliance or reopen the approved 10-character minimum. |
| Client parity | Claim form counts code points of the same normalized input, not UTF-16 `string.length`. Server remains authoritative. Shared fixtures cover astral characters, combining marks and compatibility characters. |
| Format / migration | Store a format identifier such as `nfc-v1` alongside the PHC hash after O1 is locked. Verification applies the recorded policy. Rehash on successful sign-in when parameters become outdated; compare-and-swap against the hash/version that was verified. Do not reinterpret old normalization formats silently. |
| Plaintext | Normal request hashing/verification runs only inside Edge. Never send passwords to SQL, log bodies or persist them in browser storage. The approved local owner command in §2.8 is the sole offline exception; it hashes the generated temporary secret locally with the same parameters. |
| Hash admission | Four concurrent hash jobs maximum per worker, including verification and rehash. Acquire before starting work; release in finally. No unbounded queue: a fifth request gets 503 AUTH_BUSY with Retry-After: 2. This is capacity, not a bad password or abuse throttle. |
| Memory | Four × 19 MiB = 76 MiB algorithm working memory. Budget another 16 MiB for Wasm/temporary overhead and reserve at least 128 MiB for runtime and simultaneous gameplay: planning total 220 MiB against 256 MiB. These are estimates, not measurements; include retained Wasm memory/GC peaks and warm workers in profiling. Eight hashes would already use 152 MiB before overhead, so no uncapped Promise.all. |
| CPU estimate / activation | Planning estimate **0.1–0.5 seconds CPU per hash, low confidence and unmeasured**. A verify + rehash may require two sequential hashes, plus runtime work. Measure cold/warm hosted CPU and peak memory at concurrency 1 and 4, using synthetic credentials and platform CPU telemetry rather than wall time alone. Target p95 complete-request CPU below 1 second and all measured cases comfortably below the 2-second limit. Keep accounts disabled if this fails; reduce concurrency or revisit the implementation without lowering the approved security floor. |

No local or hosted hashing benchmark ran in 22C.0. Verify unsupported/malformed stored hashes as a service fault, not as a password mismatch; never pass attacker-controlled cost parameters to the hash library.

### 2.3 Remembered sign-in

**P6 — One opaque bearer token per browser sign-in, 32 cryptographically random bytes, base64url encoded; store only SHA-256(token) in Postgres.** Reason: high entropy makes fast token hashing appropriate, unlike passwords. Alternatives rejected: plaintext tokens in DB, self-contained long-lived JWTs without immediate revocation, or rotating every request and racing sibling tabs.

- **A1:** expires after 90 days idle, renewed on use. **P6:** no absolute lifetime initially. Renew `last_used_at` and `expires_at = server now + 90 days` atomically on every accepted account-token use; proposed server write throttle is **zero** to honor the exact idle contract without hidden rounding/grace. Ordinary guest traffic does not touch account tokens. Measure account-authorized polling/write cost at activation before proposing a nonzero throttle. No background polling solely to renew identity.
- **P6:** token goes in `X-Account-Token`, never Authorization, URL, logs or body error messages. LocalStorage key `shapeships.accountToken.v1` supplies remembered return and same-origin sibling tabs; fall back to in-memory sign-in if storage is unavailable, with no claim of cross-visit persistence. Cross-origin Edge cookies would be third-party; do not rely on them. LocalStorage bears an XSS risk: keep script trust restricted and never render untrusted markup.
- **P6:** add X-Account-Token to CORS allowHeaders and Retry-After to exposeHeaders. Use PUT for preference/link updates, retaining existing allowed methods; no credentialed cookies are needed with `*`. Send no-store on account responses. Retain the anon gateway headers and per-tab game header unchanged.
- **P6:** logout revokes that token and detaches every session linked through it, including sibling tabs; other browser sign-in tokens survive. Reset/block revoke all account tokens and detach all links, advancing security_version so cached/stale authority cannot survive. Unblock does not revive credentials/tokens already revoked.
- **P6:** on deliberate logout capture the current token, immediately remove matching shared storage, set a tab-local logout/generation fence and broadcast a storage/BroadcastChannel event. Clear matching in-memory identity and pending account writes; return Entry. Ignore responses started under an old generation and never let resume responses recreate a token; best-effort revoke any fresh token returned by a now-stale sign-in/claim response. Scope clearing/events to the captured identity generation so a later explicit sign-in is not erased by an old logout completion. POST logout uses the captured token once; revoked/expired/missing credentials still clear local state. If offline/revocation fails, report the failure distinctly, retain no local token, and retry revocation in memory while the tab lives. Remote revocation cannot be promised offline; another malicious holder may retain authority until server revocation/expiry.

### 2.4 Accounts and game sessions

**P7 — Transactional account-session links alongside unchanged KV game sessions.** Reason: preserve participant identity and make link/revocation atomic without dual KV-copy mutation. Alternatives rejected: using account ID as player ID, copying account authority into client state, or trusting a stale account ID embedded in KV forever.

- Validate X-Session-Token first. Link its `sessionId` to the token's server-derived account ID/display name in `account_session_links`; do not write the raw account token into KV. The identity resolver reads the live link, token revocation/expiry/security version and account status. A link alone never grants account authority without a matching valid X-Account-Token on that request.
- Claim/sign-in can link the current session in their DB transaction. Claim never calls clearSession/clearPlayer or changes participant ID. Resume restores account identity/preferences; a separate idempotent PUT link applies them to the current valid per-tab session. No auto-new session recovery during a match.
- Active link to a different account produces SESSION_LINK_CONFLICT; explicit unlink followed by authorized relink is required. Revision checks prevent an older link/unlink response overwriting a newer one. A session without a name may exist for bootstrap; game creation requires a server-approved bound name.
- New account-owned participants carry a server-assigned accountId as provenance while keeping their session-derived id. Existing guest participants retain their names/history when the same session claims a different name; new seats use the claimed display name. A guest game does not become account-owned merely because its label matches. Record the validated claim/session association for 22D; do not implement import or cross-device seat transfer here.
- On intent/chat, rejoin and other account-owned seat operations, require the live linked identity to match the participant's stored accountId; never downgrade such a seat to guest authority when a header is omitted. 22D needs durable account-to-participant evidence for imported guest runs and cross-device rejoin: expiring token/link rows alone are insufficient. 22D must record that durable evidence before its import/rejoin features and public activation; 22C's transient links must not be treated as permanent ownership proof.
- **O6 proposal:** logout suspends account-owned seat actions until the same account relinks; it does not resign/delete the seat or reset streaks. Legacy guest seats can continue only under their existing participant/session authority and transition rules in §2.6. No account mutation is allowed by a detached link. Reset similarly requires reauthentication for account-owned seats; block denies those actions and all account operations. Current 24-hour game-session expiry still applies.
- Account writes and logout/reset/block serialize on token/account rows: writes committed before revocation stand; writes behind it fail. An already authorized KV game request may finish after logout, but cannot mutate account data or obtain new account authority. Later requests must revalidate. State this explicitly in client handling; a broadcast is UX coordination, not the security control.
- Guest Change Name retains its Entry role; audit/reuse its clearing deliberately, not for claim. Account logout uses account lifecycle operations, not the old fake logout. Cross-device rejoin and streak reconciliation remain 22D, requiring verified participant ownership, idempotent result evidence and stale-import protection, not a name match.

### 2.5 Requests and responses

**P8 — Account routes under the existing function prefix, with stable JSON contracts.** Reason: one client networking seam and explicit operational errors. Alternatives rejected: direct browser DB/Auth calls, putting secrets in Authorization/query strings, or mapping every failure to incorrect password.

Paths below are relative to `/make-server-825e19ab`. `G` means the existing anon Authorization/apikey gateway headers; `S` means X-Session-Token; `A` means X-Account-Token. All request bodies use JSON/Content-Type application/json; responses use Cache-Control no-store. Account ID is derived, never accepted as an ownership assertion.

| Shared response value | Proposed shape |
| --- | --- |
| `identity` | `{id: UUID, displayName: string, badge: "claimed-name"}`; only returned for a validated active account. |
| `preferences` | `{values: {soundEnabled, healthFlashEnabled, chatMinimized, battleLogPreferred, musicEnabled}, revision: decimal-string, updatedAt: ISO-UTC}`; all five values boolean. |
| `link` | `{sessionId: string, accountId: UUID, displayName: string, revision: decimal-string}`. Revoked/detached links are not returned as authenticated identity. |
| Error envelope | `{ok:false, error:{code: stable-string, message: safe-string, field?: string, retryAfterSeconds?: integer}}`; optionally current preferences on revision conflict. Retry-After is an integer number of seconds when supplied; UI uses code, not message parsing. |

| Request | Headers and body | Success | Applicable error sets below |
| --- | --- | --- | --- |
| POST `/accounts/name-check` | G; `{name}`. Do not send credentials. | 200 `{ok:true, nameKey, displayName, outcome:"available"/"claimed"/"banned"/"reserved"}`. Claimed returns stored display casing; others echo validated casing. Banned/reserved are lookup outcomes, not unavailable-service errors. | C, N, L |
| POST `/accounts/claim` | G,S; `{name,password,turnstileToken,preferences:<all five boolean values>}`. Session must have no active different account link. | 201 `{ok:true, account:identity, preferences, accountToken, expiresAt, link}`. Open Welcome with success and claimed rail; preserve session/invite context. | C, N, L, T, H, S, plus NAME_TAKEN / NAME_BANNED / NAME_RESERVED / SESSION_LINK_CONFLICT |
| POST `/accounts/sign-in` | G,S; `{name,password,turnstileToken?:string}`; require CAPTCHA only after server escalation. | 200 same envelope as claim, with a fresh remembered token and account preferences; no guest-preference overwrite. | C, N, L, T, H, S, plus INVALID_CREDENTIALS / ACCOUNT_BLOCKED / NAME_BANNED / SESSION_LINK_CONFLICT |
| POST `/accounts/resume` | G,A; `{}`. Does not require or replace a game session. | 200 `{ok:true,account:identity,preferences,expiresAt}`; renew existing token, never return a replacement raw token. | C, A, L, plus NAME_BANNED |
| POST `/accounts/logout` | G, captured A if present; `{}`; no S required. | 204, including missing, expired or already revoked tokens; revoke a recognized token even for a blocked account. Clear local state regardless. | C, L, excluding body-field validation when empty; no credential-validity error. Unavailable/disabled still means remote revocation is unconfirmed. |
| GET `/accounts/preferences` | G,A; no body. | 200 `{ok:true,preferences}`. | C except body errors, A, L, plus NAME_BANNED |
| PUT `/accounts/preferences` | G,A; `{patch:<nonempty subset of five booleans>,expectedRevision:decimal-string}`. Reject unknown fields and non-booleans. | 200 `{ok:true,preferences}` after atomic revision increment. | C, A, L, plus NAME_BANNED / PREFERENCE_CONFLICT |
| GET `/session/me` (compatible extension) | G,S; optional A. | Existing `{sessionId,createdAt,displayName}`, plus `account` (validated identity or null) and `accountLinkRevision` (decimal-string or null, including a detached row's revision). Supplies the revision needed after reload before link/unlink. Flag off returns the existing metadata plus null extensions without account DB access. | Existing session 401 contract retained. When A is supplied and accounts enabled: C except ACCOUNTS_NOT_ENABLED/body errors, A, plus NAME_BANNED. No new generic game-polling rate limit. |
| PUT `/accounts/session-link` | G,S,A; `{expectedRevision:decimal-string-or-null}`; null only for no existing row. | 200 `{ok:true,link}`. Same-token same-binding retry is idempotent; mismatched revision/account is conflict. | C, A, L, S, plus NAME_BANNED / SESSION_LINK_CONFLICT / LINK_CONFLICT |
| DELETE `/accounts/session-link` | G,S,A; `{expectedRevision:decimal-string}`. A must own the active binding. | 200 `{ok:true,sessionId,linked:false,revision}`; detaches only this tab/session, not the remembered token. | C, A, L, S, plus LINK_CONFLICT / LINK_FORBIDDEN |

Error sets are exhaustive application outcomes for these routes; network failures and gateway non-JSON 5xx/504 responses map to unavailable, never incorrect password. Invalid lookup names use an error; a claimed name intentionally remains visible to lookup callers (A1 / main plan §7.3). Existing game endpoints retain the session-expiry `message` consumed by sessionManager's opt-in recovery; new account error codes must not silently break that compatibility contract.

| Set / code | HTTP | When / UI mapping |
| --- | --- | --- |
| C: `ACCOUNTS_NOT_ENABLED` | 503 | Default-off account feature, checked before DB/secret access. Account controls unavailable; ordinary guest flow remains. **Not** an owner block. No automatic retry loop. |
| C: `ACCOUNT_SERVICE_UNAVAILABLE` | 503 | DB/network/transaction timeout or required configuration unavailable; Retry-After 5. Entry/Claim retain input and show service unavailable. Never claim a name was free from a failed lookup. |
| C: `INTERNAL_ERROR` | 500 | Unexpected sanitized application failure; same unavailable presentation. No internal SQL/error details. |
| C: `INVALID_REQUEST` | 400 | Malformed JSON, missing/wrong fields, unknown preference keys, invalid revision, unexpected accountId or credentials fields; show local field/form validation. |
| C: `REQUEST_TOO_LARGE` | 413 | Account JSON exceeds 8 KiB; show validation, never truncate. |
| C: `UNSUPPORTED_MEDIA_TYPE` | 415 | Body route without JSON content type; request error. |
| N: `INVALID_NAME` | 400 | Anything outside 3–20 ASCII letters/numbers, including spaces; ordinary Entry/Claim name error. |
| N: `INVALID_PASSWORD` | 400 | Password violates normalized point/byte limits or contains ill-formed Unicode; field error. Applies only where a password is submitted. |
| L: `RATE_LIMITED` | 429 | Any persisted IP/target limit reached; Retry-After and matching retryAfterSeconds. Distinct throttled state; wait, then retry deliberately. |
| T: `CAPTCHA_REQUIRED` | 403 | Claim lacks proof or sign-in escalation requires it; acquire challenge without clearing name/password. |
| T: `CAPTCHA_INVALID` | 403 | Siteverify failed, expired token, wrong production hostname/action; fresh challenge. |
| T: `CAPTCHA_REPLAY` | 409 | Already redeemed proof, including atomic local replay guard; fresh challenge. |
| T: `CAPTCHA_UNAVAILABLE` | 503 | Siteverify network/timeout; Retry-After 5; fail closed and show service unavailable. |
| H: `AUTH_BUSY` | 503 | Four worker hash slots occupied; Retry-After 2, distinct capacity try-again text. No password failure recorded. |
| S: `GAME_SESSION_INVALID` | 401 | Missing/expired/invalid tab token; return to session-entry recovery, preserving invite. Never silently replace an active match's identity. |
| A: `ACCOUNT_TOKEN_REQUIRED` | 401 | Account header absent; show signed-out Entry. |
| A: `ACCOUNT_TOKEN_INVALID` | 401 | Malformed, unknown, revoked or wrong security-version token; clear account authority. |
| A: `ACCOUNT_TOKEN_EXPIRED` | 401 | Idle deadline passed; clear remembered identity, return to password state for the known claimed name. |
| A / sign-in: `ACCOUNT_BLOCKED` | 403 | Owner disabled the account; distinct blocked-account state, not global dormancy, bad password or banned spelling. |
| `NAME_TAKEN` | 409 | Claim lost uniqueness race/already claimed; Claim offers sign-in. |
| `NAME_BANNED` | 403 | Enforcement denies a banned name, including a signed-in account whose name is now banned; Entry banned state. Account data remains until owner action. |
| `NAME_RESERVED` | 403 | Guest entry/claim/new name assignment denied for reserved name; separate explanation, no password prompt pretending an account exists. |
| `CLAIMED_NAME_REQUIRES_ACCOUNT` | 403 | Existing guest/game endpoint attempts a protected name without matching linked account; Entry claimed-name password state. |
| `INVALID_CREDENTIALS` | 401 | Wrong password or nonexistent account at sign-in; Entry incorrect-password state and Discord recovery copy. This does not hide the intentionally public lookup result. |
| `SESSION_LINK_CONFLICT` | 409 | Session is actively linked to a different account; require explicit account switch/unlink. |
| `LINK_CONFLICT` | 409 | Stale binding revision; refetch identity/link before retry, never blind overwrite. |
| `LINK_FORBIDDEN` | 403 | Valid token belongs to another active session binding; no mutation. |
| `PREFERENCE_CONFLICT` | 409 | Revision differs; include latest authorized preference envelope. Preserve deliberate patch for bounded retry. |
| `METHOD_NOT_ALLOWED` / `NOT_FOUND` | 405 / 404 | Unsupported account-route method/path, safe JSON error; unavailable/request-error UI rather than wrong password. |

**P9 — Preference sync uses revision-checked partial updates.** Reason: unrelated-device changes should not be overwritten by a cached full object. Alternatives rejected: blind full snapshots, render-driven saves or preference polling.

- Claim seeds all five current guest values. Sign-in/resume applies account values through a public external-snapshot seam added in 22C.5, without generating save requests. Local values remain a loading fallback; no initial-default writes may race account hydration.
- On deliberate edits, debounce/coalesce a patch for 300 ms. On PREFERENCE_CONFLICT, rebase that patch onto the returned latest values and retry once with its revision. If it conflicts/fails again, keep the local action visible, mark unsaved, and offer retry on the next deliberate action or menu entry. Do not block gameplay or add polling.
- Disconnect pending saves on logout/account generation change. Same-field conflicts use the last accepted explicit user action; no higher-revision/old-account response can restore a signed-out account. No device setup timing, Mission/Lore state or Ancient autocast becomes account-synced.
- **A2 local keys:** soundEnabled → `shapeships.soundEnabled.v1`; healthFlashEnabled → `shapeships.boardFlashEnabled.v1`; chatMinimized → `shapeships.chatMinimized.v1`; battleLogPreferred → `shapeships.preferBattleLog.v2`; musicEnabled → `shapeships.musicEnabled.v1`. Existing defaults: true, true, false, false, true, respectively. The existing store remains the key source of truth.
- **O7 presentation gaps:** reserved-name explanation, blocked-account message, sign-in CAPTCHA escalation, account-switch conflict, unsaved preference/retry and offline logout warning have no dedicated visual specification yet. Recommend existing inline operational feedback; do not invent screens in this pass. Ordinary/claimed/password-error/banned Entry and Claim are already product-defined.

### 2.6 Name enforcement and moderation

**P10 — Resolve names on the server from validated session/account context.** Reason: a preliminary lookup and client regex cannot protect names. Alternatives rejected: trusting body playerName, enforcing only session start or renaming historical participants by matching strings.

- While accounts are enabled, `/session/start` accepts omitted name for bootstrap; a supplied name must be permitted. With a valid account token, bind the server's claimed casing; reject a mismatching requested name. Anonymous start rejects claimed, reserved and banned names. Existing session IDs remain intact on account link.
- Create-game, create-computer-game, new-game-from, reset-win-streak, join (including spectators) and switch-role promotion all run the same identity/name resolver. Retain legacy body playerName only as a compatibility hint, never as authority. If a legacy session lacks a bound name, validate its hint and bind once before creating a new participant. A present bound name cannot be replaced by an arbitrary body value.
- Claimed names require matching active account linkage and token on new assignments. Banned names fail for everyone. Reserved names block guests and claims until Judd removes/releases the rule; an already owning active account is not dispossessed by a reservation. Ownership and ban checks run again inside transactional claim/name-rule operations.
- Use stored participant names for existing-match chat/history; do not relabel old events. New system messages use the actual stored/resolved participant, not an untrusted join-body name. Reserve `System` and `Computer` before enabling accounts, plus owner-approved official/regular names.

**P11 — Two reviewed moderation tiers, with exact exceptions.** Reason: exact-only decoding is bypassed by prefixes/suffixes, while a broad substring dictionary blocks innocent names. Alternatives rejected: blanket dictionary substring matching, ownership leet-folding or automatic import of the entire upstream list.

| Layer | Proposed matching |
| --- | --- |
| Ownership / reservation | ASCII lowercase only; `Pilot1` and `pilot1` are one claim, but `Pilot1` and `Piloti` remain different ownership keys. Reserved rules use exact ownership keys. |
| Moderation decoding | ASCII lowercase, then deterministic `0→o`, `1→i`, `2→z`, `3→e`, `4→a`, `5→s`, `6→g`, `7→t`, `8→b`, `9→g`. Apply the same decoder when validating seed keys. Names contain only ASCII alphanumerics, so no punctuation/Unicode decoder is needed. |
| Banned exact | Reject full decoded-key equality against reviewed exact entries. |
| Banned contains | Reject occurrences from a deliberately short, owner-reviewed severe-term list anywhere in decoded names. Review prefix/suffix and digit evasion examples for every seed. |
| Exceptions | Exact decoded innocent-name allowlist can exempt a reviewed false positive from contains matching, never an exact banned entry, reservation, claimed-name ownership check or owner account block. Store source/note explaining each exception. |
| Seeds | A reviewed subset of [Shutterstock/LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), not a live network dependency. Keep source URL, pinned upstream revision, license/attribution (CC BY 4.0) and owner changes beside SQL set 03; live rows reside in account_name_rules. No moderation list is invented/loaded by 22C.0. See O4. |

**P12 / O5 — Grandfather existing unclaimed guest seats narrowly.** Reason: preserve active games without allowing ongoing impersonation. Alternatives rejected: ejecting everyone at activation, taking ownership from historic labels, or allowing a legacy name in unlimited new games.

- On claim, do not search/delete/rewrite all game KV rows. A previously created guest participant in a waiting/active game may keep its immutable label for that game, rejoin only with its existing valid session and receive no claimed shield/account rights. New participants, promotions, rematches and replacement games revalidate the current name rules; claiming does not grant another guest the claimant's identity.
- At activation, apply the same seat-specific compatibility rule to existing guest participants, including legacy spaced names, while requiring valid names for new assignments. Exact existing participant/session provenance is the exception; never a client-supplied claim of prior use.
- Banned names are not grandfathered for active actions: pause/reject further actions under that name until owner intervention; retain history. Account block also has no grandfather exemption. O5 must lock the disruption policy before enforcement activation.

### 2.7 Abuse controls

**P13 — Atomic Postgres counters, keyed by trusted ingress IP and target.** Reason: worker memory is lost and not shared. Alternatives rejected: memory-only counters, browser/device IDs as proof, new Redis infrastructure or permanent account lockouts from guessed passwords.

| Operation | Proposed limit / scope | Response |
| --- | --- | --- |
| Name check | 120 requests per IP / 60 seconds; 30 per normalized target / 60 seconds. | 429 with seconds until the latest blocking window ends. |
| Claim | 10 attempts per IP / hour; 3 per normalized target / 15 minutes; Turnstile every claim. | Same; failed/duplicate attempts still consume request limits. Allows several household accounts without fingerprinting. |
| Sign-in attempts | 60 attempts per IP / 15 minutes. Wrong-password limits: 10 per IP+target / 15 minutes and 30 per target across IPs / 15 minutes. | Same. Three prior IP+target failures, or ten target failures, require Turnstile before the next hash. A CAPTCHA never bypasses a hard limit. |
| Other account entry operations | Resume/preferences/link/logout: 120 requests per token / minute once recognized; malformed/unknown-token traffic 120 per trusted IP / minute. Ordinary game polling retains its existing traffic posture. | Same where applicable; do not impose a new generic gameplay limiter. An already revoked/missing logout remains idempotent. |

- Fixed windows use database server time and atomic insert/increment under lock; enforce every applicable bucket together and return the largest retry delay. Format/body failures consume the IP entry bucket where possible; only validated name keys enter target buckets. Requests above the limit do not hash or call Siteverify. No permanent name lockout; distributed target attacks can still cause a short denial of service, a stated tradeoff of target protection.
- HMAC canonical IP/target subjects using a server-only rate-limit secret; retain counters only through window expiry plus one hour, then bounded cleanup. Canonicalize IPv4 and IPv6 consistently; use IPv6 /64 for IP limiting. Do not log/store raw addresses or fingerprint devices. Local-only development uses an explicit fixed development source bucket; production must not infer trust from client headers or enable that fallback. Missing/unverified hosted IP yields service unavailable on public name-check/claim/sign-in until §1.5 verification passes.
- Token-authorized read/update admission can use token-row identity; game identity enforcement does not itself impose the 120/minute account-route limit. Token renewal remains server-side on authorized use as specified in P6; measure resulting DB load rather than adding a hidden polling limiter.

**P14 — Turnstile claim protection and escalated sign-in.** Reason: prevent bulk claims and expensive guessing without challenging every ordinary remembered return. Alternatives rejected: trusting widget state, disabling protection on upstream errors or treating CAPTCHA success as authentication.

- Edge POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify`, with a 5-second deadline, after cheap input/rate checks and before hashing. Validate success, configured production hostname, expected action (`claim` or `sign-in`), and proof age. Tokens normally expire after five minutes and are intended for single use. Do not log the secret or response token. [Cloudflare validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- To cover concurrent redemption/network convergence, also consume a SHA-256 proof digest atomically in the replay scope of account_rate_limits; keep it for ten minutes. Claim consumes it with account creation; escalated sign-in consumes it before hashing. A failed sign-in still consumes its proof. A fresh CAPTCHA is required after a uniqueness conflict or replay; do not automatically retry a claim with the same proof.
- Local Docker uses the [published test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/): visible pass sitekey `1x00000000000000000000AA`, pass secret `1x0000000000000000000000000000000AA`; fail secret `2x0000000000000000000000000000000AA`; spent secret `3x0000000000000000000000000000000AA`. These are public dummy values, not production secrets.
- Dummy success returns hostname `example.com`, no action, and a reusable dummy token. Only explicit local-test mode may expect that hostname, omit action comparison and skip digest reuse for that fixed dummy token. Production rejects test keys/dummy responses and never relaxes hostname/action checks. Unit fakes still exercise production replay/hostname logic.
- Cloudflare timeout/unreachability fails closed for claims and for sign-ins currently requiring proof; ordinary non-escalated sign-in/resume does not depend on Cloudflare.

**P15 — Minimal structured logging.** Reason: diagnose operations without retaining credentials or extra personal data. Alternatives rejected: raw bodies/headers, SQL arguments, credential objects, full IP logging or token prefixes.

- Log request ID, route category, safe result/error code, duration, rate-limit scope/retry delay and hashed-worker-capacity events; for authenticated owner operations log account UUID, action and time in the owner events table. Keep transient security logs to platform retention, counters to bounded expiry, and owner events until account cleanup/owner retention review.
- Never log passwords, generated temporary passwords, account/game tokens (including prefixes), CAPTCHA proofs, secrets, complete credential rows or raw DB exception objects. Sanitize upstream errors into codes. Existing sessionManager debug token-prefix logging and Authorization-misuse diagnostics need targeted removal/redaction when the networking seam is touched; account code must not copy that pattern.

### 2.8 Owner operations

**P16 — SQL-editor procedures plus a local reset generator, without a deployed owner route or admin UI.** Reason: preserve Judd's operational workflow and keep player passwords unreadable. Alternatives rejected: reading/retrieving passwords, plaintext hashing in Postgres, an exposed owner endpoint or resurrecting email recovery.

- The appendix below is procedural, not executable, per A5. Later server passes supply owner-only routines and complete numbered SQL-editor scripts; the separately scoped Tooling pass supplies the local command/task.
- The local command generates 32 random bytes as a 43-character temporary password, normalizes/counts/hashes with the locked production policy and prints the temporary secret **once to Judd's private terminal**, separate from the SQL-only output. This intentional one-time delivery is not application logging. It takes an account UUID and expected security version, not the player's current/new chosen password. It has no DB/network permission at runtime and no service-role credential. Dependency installation is separate.
- Printed SQL contains the encoded salted hash and metadata only; a short transaction verifies account/version, replaces the credential, increments security_version, revokes every token, detaches links and records reset time/note. SQL verification reports affected account/version/revocation counts, never a credential row. Judd privately delivers the temporary password only after ownership checks and SQL success. O2 decides whether it remains a usable password or needs a later change-password design.
- **O3:** Discord contact alone does not prove ownership. Prefer an established community identity plus independently known account evidence, or a still-valid signed-in session demonstrated through an owner-agreed process. If Judd cannot establish ownership, decline reset; never transfer a known regular's name on the basis of its spelling/history alone. Do not add security questions or extra personal-data collection.
- **A2:** shield is derived from active signed-in identity, needs no badge table/column or owner-granted tier. Blocked/signed-out players do not get a current identity shield; historical game labels are not badge authority.

### 2.9 Activation, safety and rollback

**P17 — Default-off `ACCOUNTS_ENABLED`, enabled explicitly in local-live development only until owner activation.** Reason: intermediate deployed server passes must not expose incomplete account or name services. Alternatives rejected: changing old auth flags to turn everything on, automatic activation after SQL or live account-state fixtures.

| Stage | Required posture |
| --- | --- |
| Intermediate server delivery | Check flag before any account DB/hash/Turnstile work; false/unset gives 503 ACCOUNTS_NOT_ENABLED for account endpoints. Retain ordinary guest endpoints and existing games. Helpers must not query missing account tables on this dormant path. Old `/signup` stays disabled/retired. |
| Development | Judd uses Docker `deno task local-live` against the live DB with account flag on and explicit local Turnstile test mode. Development rows are acceptable; no automated tests use this configuration. Do not read, edit or publish environment files in 22C.0. |
| Enablement boundary | Do not enable public claims until server linkage, enforcement, rate controls, owner recovery, real Entry/Claim wiring and the required 22D continuity/import work are ready. Completing 22C server passes is not authorization to bypass later phase acceptance. |
| Emergency disable | Flag off returns dormant responses and stops account operations. Stop presenting claim success/remembered authority; client shows accounts unavailable and preserves local unsaved state safely. Because flag-off legacy guest behaviour does not consult account tables, protected-name enforcement is also unavailable: this is an emergency service rollback with an ownership-protection gap, not a transparent signed-in mode. Avoid public new entries during the rollback window; prefer keeping the last working deployment until a controlled rollback. |

**P18 — Owner activation checklist with measured gates.** Reason: configuration and database assumptions need hosted evidence. Alternatives rejected: local timing as proof, assuming a Free backup or deploying to test unfinished production account flows.

1. Owner locks all P/O decisions needed for the next pass; normalization is locked before first real hash. Confirm current repository/session compatibility and required 22D evidence at the eventual public activation point.
2. Judd applies numbered SQL sets in order and runs each single-SELECT verification: objects/ACLs/RLS, constraint/index presence, service-only invoker RPCs, empty search paths, stub removal and no unintended KV changes. No SQL runs as part of this design pass.
3. Load and review `System`, `Computer`, official/regular reservations, both moderation tiers and exceptions; confirm owner correction/release procedure. Retest existing-session transition policy, spectators and rematch/replacement paths.
4. Check **current total database size and growth headroom against 500 MB**, including new tables/indexes and after Judd's resolved duplicate-index cleanup. The CSV's old 270 MB table figure is not a current measurement. Bound token/counter growth and prove bounded cleanup without pg_cron.
5. Judd creates the free Cloudflare account and production site/secret keys; configure allowed hostnames/action names and Supabase secrets, reject dummy keys/test mode in hosted production, then validate real hostname/action/replay/failure paths.
6. Measure hosted hash CPU/memory and cold/warm behaviour with synthetic secrets at concurrency 1/4, plus simultaneous gameplay, verification + rehash and excess-request handling. Record actual runtime/library versions and results; do not lower the password floor merely to pass limits.
7. Verify the trusted IP header/chain with forged/duplicate/missing headers from two networks and Supabase's ingress contract. No public claim/sign-in activation on an unverified extractor.
8. Clean identified development accounts/rows, revoke their tokens and verify no live production account was selected. Keep legitimate game KV records/history untouched. Resolve O9 and O10 only if approved.
9. Confirm X-Account-Token CORS allowance and exposed Retry-After, real browser preflight, anon/game-header separation, no-store responses, no plaintext/token logs, same-browser remembered return and sibling-tab revocation. Keep ENABLE_TEST_ROUTES off on the hosted function.
10. **O8:** make the backup decision, export before destructive changes/activation and retain a tested restore path. Free has no automatic backups; Supabase recommends manual exports for Free projects. [Backup documentation](https://supabase.com/docs/guides/platform/backups). Backups contain hashes/token digests and need private storage.
11. Owner accepts guest, claimed, banned, reserved, blocked, incorrect-password, throttled, unavailable and dormant states; claim/current-game preservation, logout and all five preferences; only then enable production flag and observe sanitized error/429/AUTH_BUSY counts and CPU/memory. No generic telemetry project is added.

**P19 — Disable first, reverse numbered SQL sets only in an owner-controlled rollback.** Reason: isolate application access before removing dependent objects. Alternatives rejected: dropping live account tables while account routes run, cascading into game KV or claiming a schema rollback preserves account data.

- First disable account entry/claims and set account flag off; confirm clients cannot keep mutating accounts. Record the name-protection gap above and coordinate the temporary guest-entry restriction as part of the rollback operation, not a hidden permanent product change.
- Prefer flag-only disable while retaining data for a fix. A full rollback runs set 04 → 03 → 02 → 01 reversals and restores the inspected empty screen_names stub. It **loses accounts, password hashes, claimed ownership, remembered tokens, preferences, links, moderation seeds/counters and owner-event records** unless exported/restored separately. Current account tokens become unusable. Legitimate game KV rows and game-session IDs remain, but account-owned continuation is unavailable until services/data are restored; no streak reset is invented here.
- No rollback reintroduces removed duplicate KV indexes, deletes the stray Auth user or undoes independent maintenance. Optional KV-grant hardening, if approved, has its own exact ACL rollback. Do not run any rollback from this pass.

### 2.10 Focused test plan

**P20 — Injected repositories, clocks, randomness, hashing and Siteverify seams.** Reason: existing Hono route fixtures already exercise behaviour through memory persistence without the live database. Alternatives rejected: importing the serving index as a test fixture, using local-live credentials or disguising live integration as a unit test.

| Later pass | Focused tests / acceptance |
| --- | --- |
| 22C.1 | Data-adapter argument/error mapping, unique-constraint conflict mapping and service-only object verification specification. Owner SQL verification checks actual ACLs/constraints; fakes do not prove Postgres isolation. |
| 22C.2 | Claim casing/uniqueness and simultaneous claims through transactional fake; failed claim has no partial rows; password 9/10/128/129-point and byte boundaries, normalized astral/combining inputs, no truncation, real hash round-trip/rehash, four-hash cap/finally release; token idle boundary, renewal, logout-one versus reset/block-all, stale verified-password race, unlink/relink revisions and retained game-session ID. |
| 22C.3 | Fake-clock rate windows and retry-after, household scopes, distributed target limits, cheap checks before hash; Siteverify timeout/failure/wrong hostname/action/expired proof, duplicate proof/concurrent replay, production rejecting dummy mode; names on start/create/computer/reset/rematch/join/spectator/promotion, protected-seat intent/chat rejecting missing/wrong account identity, spoofed body names, System/Computer reservation, exact/contains/leet/exception cases and legacy-seat transition. |
| 22C.4 | Preference ownership, unknown key/type rejection, initial claim values, stale revisions, logout/reset racing a preference write; owner block/unblock never resurrects tokens, bounded cleanup scopes and no credential/log leakage. |
| 22C.T | Local generator applies locked normalization/parameters, produces a valid hash, contains no plaintext in generated SQL, scopes all mutations, uses expected UUID/version and requires no runtime network/DB credential. No snapshot of a real secret. |
| 22C.5 | Only targeted existing client behavioural tests where justified: stale resume after logout, sibling-tab authority removal, external preference hydration without save-back, generation-scoped pending updates and claim preserving active session/invite. No cosmetic/layout test suite. |

- Existing pattern: [win_streak_routes_test.ts](../../supabase/functions/server/tests/routes/win_streak_routes_test.ts#L18-L115), lines 18–115, injects MemoryPersistence and requireSession into registerGameRoutes and calls Hono `app.request`; reuse this shape for account routes, not the serving kernel. Fake transactions model uniqueness, serialization and injected failures; separately acknowledge real SQL guarantees require constraint/SQL review and owner verification, not pretend fake proof.
- Existing hazard: [intent_persistence_live_integration_test.ts](../../supabase/functions/server/tests/routes/intent_persistence_live_integration_test.ts#L1-L61), lines 1–61, is gated by `PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION=1` and writes active KV rows. Explicitly exclude it from every account test command. Do not run integration shell scripts or diagnostic routes against local-live.
- Later targeted Deno commands enumerate only fake-backed test files, grant no --allow-net, and use cached dependencies; allow only named environment variables needed by module imports (currently ENABLE_SERVER_DEBUG_LOGS). Keep live-integration flags unset. Inject Siteverify rather than allowing real Cloudflare access. A fetch fake must reject unexpected destinations. Add no test tasks or tests in 22C.0.
- **22C.0 validation:** Not run — documentation-only pass (typecheck, build and tests). Static documentation review and diff checks only; no database requests or deployment.

### 2.11 Remaining passes and SQL ownership

**P21 — Small server-first passes followed by isolated tooling/runtime/UI passes.** Reason: name enforcement depends on real token linkage and UI depends on stable requests. Alternatives rejected: a mixed server/UI mega-pass, account-state development fixtures, or treating index maintenance as account work.

| Pass | Type / rough size | Deliverable / SQL set |
| --- | --- | --- |
| 22C.1 | Server / medium | Create tables, constraints, RLS/ACLs, explicit stub removal and SQL delivery/verification/rollback skeleton. **Set 01**. Optional grant-only KV hardening only if O10 is locked yes; Auth user deletion remains a separate owner Dashboard operation, not SQL. |
| 22C.2 | Server / large; split internally if needed | Password module, claim/sign-in/resume/logout, token issuance/renewal/revocation and **game-session linking/unlinking**. **Set 02** transactional identity/token/link RPCs. Preference row creation is already part of claim, not deferred. Keep deployed account flag off. |
| 22C.3 | Server / large | Shared name enforcement, reservation/moderation seed and rules, rate-counter/replay RPCs, Turnstile checks and security logging. Depends on 22C.2 linkage. **Set 03**. Fail closed while account protection is incomplete. |
| 22C.4 | Server / medium | Preference read/revision update, owner reset/block/rule/revocation/bounded cleanup routines and final account contract review. **Set 04**. Credentials/links already support security-version revocation from 22C.2. |
| 22C.T | Tooling / small, explicitly separate | Local Deno owner-reset generator/task using the production credential module and no deployed route. No SQL set; prints editor SQL calling the set 04 operation. The local-live env enablement/secrets setup is Judd's documented operation. |
| 22C.5 | **Client-runtime, no UI** / medium (Client/UI ownership category, runtime-only scope) | Central account requests/storage, token/generation lifecycle, cross-tab logout and preference external-snapshot seam. No Entry/Claim layout, fixture account states or server edits. No SQL. |
| Remaining 22B account work | Client/UI / separately briefed | Entry claimed/password/banned/blocked/operational states and Claim Name against the real requests; preserve invitations and active sessions. Judd's Entry content edits remain 22B; Entry video is at the end of 22B. No SQL. |
| 22D | Separate Server then Client/runtime passes | Account streak authority/import evidence and cross-device continuation, as already locked in the main plan. This record supplies only identity/provenance needs, not its schema/algorithm. |
| 22E | Scoped Client/UI integration / separate server corrections if needed | Live acceptance, compatibility and owner activation review. The old fixture-replacement wording is superseded by amendment 9. No deployment follows automatically. |

All sets are authored only after owner lock, reviewed/applied manually by Judd, and ship their own forward/single-SELECT verification/rollback. **KV index maintenance is resolved and outside all these passes.** Public activation waits for the main phase's continuity and integration acceptance; server-first does not move 22D behaviour into 22C.0.

### 2.12 Open questions for Judd

**10 questions.** Recommendations below remain O until owner lock; no response is assumed from approval to create this record.

| # | Decision / options | Recommended answer / consequence |
| --- | --- | --- |
| **O1** | Password normalization: NFC; NFKC; no normalization. | **NFC**, matching current NIST guidance. NFKC is viable if chosen explicitly but changes compatibility characters. Lock before the first real hash; server, Claim validation and local reset generator must agree. |
| **O2** | After temporary-password sign-in: **(a)** change-password step; **(b)** temporary password stays until a later phase; **(c)** release and reclaim the name. | **(b)** initially: the generated high-entropy password works through existing sign-in, with no new player UI. (a) needs a supplied change-password design and credential/token contract before implementation. (c) discards account identity/preferences and future ownership associations; do not release a name merely to avoid reset design. |
| **O3** | Recovery proof: established community identity plus independent account evidence; still-valid-session evidence where available; no recovery if proof is insufficient. | Use the first two as available and **decline when insufficient**. Judd defines what evidence he can actually verify; a new Discord message alone never transfers an account. No extra personal-data collection. |
| **O4** | Seeds: approve a reviewed LDNOOBW subset with short severe contains-list/exceptions and explicit official/regular reservations; or provide a wholly owner-authored list. | **Reviewed subset plus owner additions**, with license/source/revision and per-entry review. Judd supplies/approves regulars' names; do not infer identity from historic guests. |
| **O5** | Existing guest seats when names are claimed/activation occurs: grandfather only the current waiting/active match; require immediate re-entry; defer claims until all matches drain. | **Current-match grandfathering**, with no shield/account rights/new-seat reuse. Banned-name actions still stop, which can interrupt an existing game; lock this exception before enforcement activation. |
| **O6** | Logout and account-owned seats: suspend actions until same-account relink; allow guest continuation; abandon the seat. | **Suspend, preserve the seat/session/history**, no resignation or streak reset. Reset/block revoke account authority too. Requests already authorized for KV gameplay may finish; no account mutation survives transactional revocation. |
| **O7** | Operational presentation: existing inline messages/challenges/retry controls; or separately designed screens for reserved/blocked/link conflict/unsaved/offline-logout states. | **Inline feedback in later 22B**, keeping blocked, dormant, bad-password, throttle and unavailable distinct. Escalated sign-in Turnstile needs an explicit Entry treatment. No UI is built here. |
| **O8** | Free-plan backups: private manual export before changes/activation and regularly thereafter; paid automatic backup plan; explicit acceptance of account-data-loss risk. | **Manual export before changes/activation, then weekly**, with private storage and a restore rehearsal on an isolated target. Confirm Judd owns the operation; never claim Free has automatic backups. |
| **O9** | Stray `auth.users` row: leave it; or identify it and delete through Dashboard → Authentication after screen_names is dropped. | **Leave until identified**; the inventory cannot prove it is disposable. If confirmed obsolete, Judd deletes it through Authentication, not raw SQL or this account pass. |
| **O10** | KV browser-role grants: leave existing RLS-only barrier; or revoke anon/authenticated grants in 22C.1 as optional hardening. | **Revoke if owner accepts the development-test permission error** at App.tsx:608. Make it an explicit grant-only exception with ACL rollback; no game-row/index changes and no cleanup of unrelated tables. |

## Appendix A — Owner procedure specifications (no executable SQL)

These are the exact workflows later scripts must implement. The approved no-SQL refinement supersedes the original request for copy-paste SQL inside 22C.0. No procedure here has been run.

| Procedure | Inputs and ordered operation | Verification / limits |
| --- | --- | --- |
| Password reset | Establish ownership under O3. Obtain exact account UUID/current security version using a read-only owner lookup. Run the future local generator privately. Paste **only its SQL output** into the editor. Transaction locks/checks account+version, changes encoded credential/format, advances security version, revokes all tokens, detaches links and appends reset event. After success, privately send the temporary secret and ordinary sign-in directions. | One SELECT reports matching UUID, updated version/time, reset event and zero active old-version tokens/links. No password/hash output in verification. Stale UUID/version, missing/blocked account or missing normalization lock stops the operation. O2 controls any subsequent change-password work. |
| Block / unblock account | Lookup exact UUID; record reason without personal details. Block transaction changes status, increments security version, revokes all tokens and detaches all links; append event. Unblock changes status to active and records event only. | Verify status/version and no active tokens/links after block. Unblock never resurrects revoked tokens; normal password sign-in issues new ones. |
| Block / unblock a name | Add/remove an exact banned rule through the locked decoder, source and reason; existing active accounts immediately fail the name gate. For a targeted account suspension use account block rather than changing a broad moderation term. | Verify decoded key/kind/match and representative affected/innocent names. Removing a name rule does not unblock an account status; exact banned rules cannot be bypassed by exceptions. |
| Add/remove banned entry or exception | Specify exact versus severe contains, decoded key, source and note; reviewed exceptions are exact only. Serialize with claim name/rule checks; commit rule edit and owner event together. | Single SELECT reports the rule and test outcomes for reviewed cases, never a full credential/account dump. Broad changes are reviewed before activation; keep RPC work bounded. |
| Reserve / release | Specify exact case-folded ownership key, source and reason. Seed System and Computer; reserve owner-approved official/regular names. Remove reservation only after intended ownership/release is confirmed. | Verify rule, current ownership and expected guest/claim outcome. Reservation never transfers an existing account. Release is not password recovery. |
| Revoke all account tokens | Lookup exact UUID; advance security version, revoke all token rows and detach links in a short transaction; append event. No credential change or streak reset. | Verify new version and zero active links/tokens. Account may sign in again if active, permitted and password unchanged. |
| Expired token/counter cleanup | Run bounded owner batches by explicit expiry/revocation predicates, retaining the ten-minute CAPTCHA replay guard and counter expiry margin. No pg_cron assumed. | SELECT counts remaining eligible rows and batch counts. No unbounded DELETE, no active tokens, and no game KV deletion. Repeat manually for backlog. |
| Pre-launch development cleanup | Judd reviews an explicit UUID allowlist and confirms no real accounts are included. Revoke/detach first, remove those accounts and their dependent credentials/tokens/preferences/links/events under scoped predicates; clean development-only rules/counters by exact reviewed keys. | One SELECT confirms allowlisted rows are gone and nonselected account counts are retained. Never select accounts by a guessed name prefix or delete all Auth users. Leave game/session KV rows/history untouched. |
| Badge inspection | Validate active account identity and return the claimed-name shield. | No badge SQL/storage/owner grant exists. No Founder tier. |

## Appendix B — Completion and remaining risks

- **Scope:** two documentation files only. This belongs to server design because account/name authority, credentials and transactions are server responsibilities; client inspection defines compatibility, not a mixed implementation pass.
- **Validation:** Not run — documentation-only pass (typecheck, build and tests). Inspect the final documentation diff, references, all requested sections, decision labels and matching question count. No database requests, hosted probes, hashing benchmark or deployment.
- **Remaining gates:** ten owner questions; real hosted Wasm/CPU/memory behaviour; trusted IP ingress contract; production Turnstile configuration; current DB size/backup; SQL ACL/constraint verification; live existing-seat compatibility. The approximate resource budgets and fake-backed concurrency tests are not production measurements.
- **Resolved:** duplicate KV index maintenance, owner-confirmed 19 November 2026; active KV now has two indexes. Do not carry this forward as unfinished account work or infer a current size from the old CSV.
- **Next action:** Judd and the planning assistant lock/amend this record, then brief 22C.1. No SQL/server/client implementation is authorized by merely writing the design record.


