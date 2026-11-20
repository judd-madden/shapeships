# Phase 22 account SQL — manual packages

Set 01 belongs to **22C.1, Server Pass**. These files are for Judd to paste into the Supabase SQL editor as `postgres`. They are deliberately outside `supabase/migrations/`; never move them there or run them through CLI migrations, local-live or an automated live-DB test.

## Apply order

1. Send `01-forward.sql`, `01-verify.sql` and `01-rollback.sql` to the planning assistant for a disposable mock test. Test a clean forward/verify/rollback round trip and failing-precondition runs; failures must leave schema, grants and data unchanged. Test populated-table rollback refusal and the explicit destructive override only on the mock.
2. **Judd takes a manual Supabase CLI export first**, stored privately outside this repo. Keep weekly exports and take one before every later SQL set. A restore rehearsal on an isolated target is required before public activation. Keep exports private: they may contain credential hashes and token digests.
3. Paste the **entire** `01-forward.sql` into one SQL-editor run, not selected statements. It checks all prerequisites before changes, explicitly removes the empty stub, creates the eight account tables and restricts access. A failure aborts the whole transaction, including grants and DDL. Do not continue past an error or skip a guard; investigate drift first.
4. Run the entire `01-verify.sql`. It is one SELECT with one result set: the first row is the overall result, followed by individual PASS/FAIL checks. Send the result to the planning assistant. Do not activate on any FAIL.
5. Optional, separate owner step: identify the lone Auth user in Dashboard → Authentication. These scripts do not delete or alter that user.
6. **Leave `ACCOUNTS_MODE` unset.** Judd sets it to `on` in `.env.local-live` only when 22C.2 lands. No environment file is changed by this package. Public activation waits for later acceptance gates.

No script has been applied to the live database by this pass. Both mutating scripts use one transaction, short lock waits and transaction-compatible commands only. Neither uses CASCADE drops, CONCURRENTLY or VACUUM. There are no account functions, views, triggers, policies, seeds or realtime-publication changes in set 01.

## Schema and access

The locked source is [Account Design](../../../src/documentation/plans/Phase%2022%20Addendum%20-%20Account%20Design.md), L1 and §2.13. The 19 November inventory supplies the empty `screen_names` signature. Forward checks columns/defaults, all three constraints/indexes, both policies, RLS and emptiness before removal. Unexpected dependencies cause RESTRICT to fail and roll everything back.

- Independent IDs use UUID `gen_random_uuid()` defaults; credential/preference account-ID keys, the session-ID key and rate-limit composite key retain P1's shape. **There are no sequences.**
- Display names use the explicit ASCII regex `^[A-Za-z0-9]{3,20}$`. `name_key` is stored/generated as `lower(display_name COLLATE "C")`, with C-collation uniqueness.
- Credentials include `must_change_password NOT NULL DEFAULT false`; hash/format text bounds are 1–512 and 1–64 characters. Actual password handling and supported-format validation arrive in 22C.2.
- Every account table has RLS on, zero policies and no PUBLIC/anon/authenticated privileges. Inherited service-role ALL is reset too: grant SELECT/INSERT/UPDATE/DELETE only, except append-only owner events receive SELECT/INSERT/DELETE (DELETE supports explicit owner cleanup). No TRUNCATE, REFERENCES, TRIGGER, MAINTAIN or grant options. Schema-wide default privileges remain unchanged; later RPCs must separately restrict EXECUTE.
- The schema fixes limiter scope identifiers for 22C.3: `name_check_ip`, `name_check_target`, `claim_ip`, `claim_target`, `signin_ip`, `signin_failure_ip_target`, `signin_failure_target`, `account_token`, `account_unknown_ip`, `captcha_replay`, `name_check_global`, `claim_global`, `signin_global`, `password_global`. These are constraint vocabulary, not implemented rate limits. LA13 ceiling values remain a 22C.3/activation gate.
- Owner action identifiers are `password_reset`, `account_block`, `account_unblock`, `name_rule_add`, `name_rule_remove`, `tokens_revoke`, `cleanup`; name-rule operations include reservations, bans and exceptions. No deployed owner route is introduced.

LA10 is **grant-only** on the four named KV tables. No KV row or index is changed, and `service_role`/`postgres` grants on those tables are untouched. Browser grants previously relied on RLS; their revocation will make the App dashboard's direct browser KV test report a permission error. Server access continues through service role.

Verification includes actual effective browser-role ACLs, column ACLs, required service grants, constraints/indexes, no sequences/functions, stub removal, the active KV's two indexes, the one Auth user and current counts for all four KV tables. Previously populated tables must remain populated; the inventoried empty KV may still be empty. Historical KV counts are **not** current exact baselines. Counts are collateral sanity checks, not proof that every historical row is identical; the export is the recovery reference.

## Rollback

Disable account operations first. For an application-only emergency, prefer `names-only` to retain claimed-name protection; set `off` before removing the account schema. Reverse later SQL sets in descending order before set 01. Keep legitimate game/session KV records and independent index maintenance intact.

Paste the entire `01-rollback.sql` as one run. All preconditions execute before any changes; it locks/checks every account table and refuses if any has rows. There is one commented `allow_account_data_loss := true;` line inside the guard. **Uncommenting it explicitly permits destruction of all account rows**, including credentials, ownership, preferences, remembered tokens, links, moderation data/counters and owner events. Export first; the schema rollback does not restore that data. Unexpected external dependencies still fail with RESTRICT.

Rollback recreates the empty stub's four columns, three constraints/indexes, two policies and inventoried default grants (`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` to anon/authenticated/service_role). It does not recreate a deleted Auth user.

**KV ACL qualification:** the inventory proved SELECT/INSERT/UPDATE/DELETE for anon/authenticated, but did not capture exact ACL letters. Pre-Postgres-17 tables may lack MAINTAIN. The approved rollback therefore re-grants **ALL** to those two roles on all four KV tables: a harmless superset under their existing RLS barrier, not a claim of byte-for-byte historical ACL restoration. No other roles' KV grants change.

## Validation status

Static review against the supplied inventory only. Disposable PostgreSQL execution was **not run**: no local PostgreSQL executable is available and Docker's daemon is unavailable. Planning-assistant clean/failing-precondition mock tests remain required before manual application. No database, local-live or deployment was used.

## Set 02 — 22C.2a credential, token and link RPCs

**Current owner-reported state:** sets 01 and 02 were applied on 20 November 2026 and both verification scripts reported PASS. An on-mode local-live smoke test passed all eight checks, including bytea parameters, STABLE RPCs and error mapping. The notes below retain the original set 02 delivery procedure; set 03 is delivered unapplied.

Set 02 creates exactly ten functions and no tables. Its stage-a package can be mock-tested and applied before 22C.2b: the functions are unused while ACCOUNTS_MODE stays off. Do not enable local on-mode until 22C.2b is complete; never enable the hosted function before the activation gates. Claim's human-check remains closed until 22C.3.

1. Send Shapeships-22C.2a.zip and its report to the planning assistant for PostgreSQL 17.6 mock testing with set 01 applied.
2. After a successful mock review, Judd takes a private backup.
3. Run the **entire** 02-forward.sql as postgres. All routines, including helpers, are SECURITY INVOKER with an empty search_path, and browser EXECUTE is explicitly removed before COMMIT.
4. Run **02-verify.sql**, one SELECT with overall result first. Every expected signature must exist and there must be exactly ten account_* functions; extra overloads/functions fail. It accepts search_path="" alone for read-only routines, and search_path="" plus lock_timeout=2s for mutators. It also checks EXECUTE and retained table RLS/ACL posture.
5. Send the verification result to the planning assistant. Leave hosted mode off. Applying SQL does not activate account endpoints.

**After any failed forward or rollback run, run `rollback;` on its own before any further SQL.** Explicit BEGIN can leave the editor connection in an aborted transaction; do not continue by selecting later statements.

Do not rerun 01-verify.sql after set 02: its historical "no account functions yet" check deliberately fails then. Set 02 verification carries forward the relevant table/access checks without that obsolete condition. Neither verification script proves historical KV row identity.

### Signatures, payloads and errors

The exact named/type signatures are in 02-forward.sql and inventoried independently in 02-verify.sql and 02-rollback.sql:

- account_claim creates account, credential, five preferences, token and session binding atomically.
- account_read_credential returns a private credential snapshot or null, including decimal-string securityVersion. It never filters or reveals blocked status; Edge verifies the password first.
- account_finish_signin validates the observed hash, format and version before issuing a token; forced-change returns no token.
- account_resume validates, renews at most hourly and optionally links; account_logout revokes one token and its links even for blocked accounts.
- account_change_password performs credential CAS, version advancement, revoke-all/detach-all and fresh issuance atomically.
- account_rehash performs CAS and returns false if stale/blocked; it never advances security_version.
- account_identity is read-only and requires an active matching session/token/account binding.
- account_check_name enforces exact bans, contains bans with exact exceptions, and optional reservations.
- account_link_session independently validates supplied account/token IDs under locks, including ownership, status, current version, revocation and expiry. It never assumes a parent RPC already authorized them.

Entry payloads contain account, preferences, expiresAt and optional link; they never contain a raw account token. Edge adds raw tokens only to successful fresh-issuance responses. Preference revisions and security versions are text to preserve bigint precision.

SQLSTATE mapping: P2201 blocked; P2202 stale security snapshot; P2203 stale credential; P2204 session-link conflict; P2205 forced password change; P2206 invalid/stale-version token; P2207 expired token; P2208 revoked token; P2209 banned name; P2210 reserved name. The adapter maps P2202/P2203 to INVALID_CREDENTIALS, P2206/P2208 to ACCOUNT_TOKEN_INVALID, and the remaining states to their corresponding locked codes. Only 23505 with the fixed ACCOUNT_NAME_TAKEN message, emitted for the exact name-key constraint, maps to NAME_TAKEN. Other DB failures are service unavailable, with no raw details or automatic retry.

### Locking and future sets

Claim uses shared transaction advisory key **(22002, 1)**. Set 04 rule edits must use the exclusive form of that exact key. Mutators lock account, credential where needed, token, then binding; bulk token/link locks are ordered by ID/session ID. Binding INSERT ON CONFLICT DO NOTHING followed by row locking/recheck serializes simultaneous first links. The link helper independently rechecks token expiry after a binding wait. Every UPDATE/DELETE has a WHERE clause.

Tokens expire at now >= expires_at. Renewal requires last_used_at strictly older than one hour and sets both renewal time and expiry +90 days. Clock decisions use database time. No cleanup is added here; bounded cleanup remains 22C.4.

### Required mock scenarios

Run clean forward/verify/rollback/reapply and failure/precondition atomicity, inherited browser EXECUTE removal, an extra function/overload causing verification FAIL and rollback refusal, and exact proconfig checks including the two-second lock timeout. Confirm all set 01 table grants/RLS, KV rows/indexes and Auth users remain unchanged.

Exercise real concurrent same-name claims, first-link races between accounts, same-account relinks, invalid/expired/revoked prior bindings, logout/resume races, password-reset/block/stale-verification races, and all-or-nothing password changes. Call the link helper **directly** with missing token/account, wrong ownership, revoked/expired/stale-version token and blocked account; each must reject without a binding change. Test correct credential snapshots and CAS losses separately.

### Set 02 rollback

Set mode off first and reverse later account sets. Run the entire 02-rollback.sql, which refuses missing/unexpected signatures or later-set functions and drops exactly set 02 functions with RESTRICT. It preserves every table, row and table grant. Unexpected external dependencies abort the transaction; never use CASCADE to bypass them.

Stage-a unit tests use cached dependencies and no runtime network permission. Their transactional/SQL guarantees remain subject to the separate PostgreSQL mock and owner verification.

## Set 03 — 22C.3a protection, name-check and name rules

**Server Pass; delivered unapplied.** No database, local-live, deployment, environment or tooling configuration was changed by this pass. Gameplay name enforcement, participant provenance and seat suspension belong to 22C.3b; preferences/owner routines and token cleanup remain 22C.4. The new cleanup RPC here handles counters and replay rows only.

### Owner apply order

1. Send the repo snapshot/ZIP to the planning assistant for PostgreSQL 17.6 mock testing. Include all set 03 scripts and source/report files; exclude private environment files and exports.
2. Take a private backup. Run all of `03-forward.sql` as postgres, in one editor execution.
3. Run all of `03-seed-name-rules.sql`, then `03-verify.sql`. Verify returns one result set, overall row first. Every check must PASS. Set 03 has fourteen account functions; it **supersedes 02-verify.sql**, whose exact-ten-function check now intentionally FAILs.
4. Review the report's complete reserved-name list and remaining innocent-name failures before activation. Set 03 SQL is about 224 KB and is one paste, with no numbered split.
5. Add the local settings below yourself, then rerun an extended smoke test including claims. No public activation follows from applying SQL or passing local tests.

**After any failed editor run, execute `rollback;` alone before further SQL.** The editor may warn about destructive operations: forward replaces constraints, the seed deletes its own generated rows, and rollback drops functions/column and deletes generated rows. These are intentional, scoped, transactional operations; inspect the complete script before running it. No script uses CASCADE.

Forward requires the exact set 02 signatures/configurations and service-only access, retained set 01 posture and no set 03 objects. All new/replaced functions are SECURITY INVOKER with `search_path=''`; mutators have `lock_timeout=2s`. No table is created. Account table RLS, policies and grants, Auth users and game/KV data remain unchanged.

### Name policy and review

See [source provenance](sources/README.md) and the [generated review report](sources/name-rules-report.md). Three local files produce 627 banned rules (520 contains, 107 exact) and 469 reservations. The source metadata restores whole-name-only `sex`, `rape` and `cum`, so Essex/Sussex/Sextant/Grape pass. Therapist remains blocked by `rapist`; the report proposes an owner exception but does not insert it. Document is not banned, but is reserved; releasing it requires a separate reservation decision. Official/regular-player names remain due before activation. `B4dw0rd` uses a labelled synthetic test rule only.

The matcher validates a strict letter/repetition grammar, preserves `*` as a repeat marker, and scans approximately 1,100 rows with names bounded to 20 characters. Safe substrings mask every occurrence against the original decoded name without joining fragments. Exact owner exceptions override contains bans only, never exact bans, reservations or ownership. The report runs the shared TypeScript contract matcher; actual SQL behavior awaits the separate PostgreSQL mock and verification.

Seeding and rollback take exclusive advisory lock `(22002,1)`, matching claim's shared lock. Reapplication deletes only `seed03:dsojevic-profanity-en.json@...` and `seed03:btrsco-reserved-usernames.json@...` rows, including earlier hashes, and preserves conflicting owner rows with ON CONFLICT DO NOTHING. Source hashes and original entry metadata travel with generated rules.

`POST /accounts/name-check` accepts only `{name}`, without a game session. Responses are no-store `{ok:true,nameKey,displayName,outcome}` with available/claimed/banned/reserved outcomes. A ban wins; otherwise existing ownership wins over a reservation, with stored casing returned for claimed names. Bad formats return INVALID_NAME. The existing non-on mode guard remains first.

### Protection configuration

Settings are read only when the on-mode service is acquired:

| Setting | Meaning |
| --- | --- |
| `ACCOUNTS_TURNSTILE_SECRET` | Server-only Siteverify secret. Missing when proof is required gives CAPTCHA_UNAVAILABLE. Published dummy secrets are rejected outside local test mode. |
| `ACCOUNTS_TURNSTILE_HOSTNAMES` | Comma-separated exact allowed hostnames; `example.com` for the local dummy response. |
| `ACCOUNTS_LOCAL_TEST_MODE` | Exactly `true` enables local dummy behavior and permits the development IP source. Leave unset for hosted operation. |
| `ACCOUNTS_RATE_LIMIT_SECRET` | At least 32 random bytes encoded as hex (64 hex characters for the supplied generator). Missing/invalid gives ACCOUNT_SERVICE_UNAVAILABLE. Rotating it starts new rate subjects; coordinate rotation. |
| `ACCOUNTS_IP_SOURCE` | `development`, `header:<trusted-header-name>` or `la13`. Unset/invalid fails closed. Development is local-test-only. Header mode requires one valid address in that exact header, with no header/chain fallback. Hosted trust must be verified before selecting it. |

Add this **additional local-only block** to the existing `.env.local-live` with ACCOUNTS_MODE=on. Replace the placeholder with the command output; this pass does not edit that file.

```dotenv
ACCOUNTS_TURNSTILE_SECRET=1x0000000000000000000000000000000AA
ACCOUNTS_LOCAL_TEST_MODE=true
ACCOUNTS_TURNSTILE_HOSTNAMES=example.com
ACCOUNTS_IP_SOURCE=development
ACCOUNTS_RATE_LIMIT_SECRET=REPLACE_WITH_64_HEX_CHARACTERS
```

Windows PowerShell: generate 32 cryptographically random bytes as lowercase hex:

```powershell
$accountRateBytes = New-Object byte[] 32; $accountRateRng = [Security.Cryptography.RandomNumberGenerator]::Create(); $accountRateRng.GetBytes($accountRateBytes); $accountRateRng.Dispose(); -join ($accountRateBytes | ForEach-Object { $_.ToString("x2") })
```

**22B widget action contract:** claim sends **`claim`**; escalated sign-in sends **`sign-in`**; password change also sends **`sign-in`**. LA13 requires proof on every sign-in/password request and every claim. Only dummy-key local responses may use `example.com` without an action; only the fixed `XXXX.DUMMY.TOKEN.XXXX` skips local replay checks. Other proofs retain replay protection even in local mode.

Siteverify has a five-second deadline and validates success, hostname, action and a proof age between zero and five minutes. Upstream failures are CAPTCHA_UNAVAILABLE with Retry-After 5. A local replay probe prevents unnecessary upstream work for already-consumed proofs; claim consumes immediately before account creation, while sign-in/password consumes before hashing. Digests remain for ten minutes. A failed sign-in or failed claim after consumption requires a fresh proof.

### Limits and privacy

L13 thresholds remain: name-check 120/IP/minute and 30/target/minute; claim 10/IP/hour and 3/target/15 minutes; sign-in/password share 60/IP/15 minutes, 10 failures/IP+target/15 minutes and 30 failures/target/15 minutes. Three IP+target failures or ten distributed target failures require a challenge before the next verification; successful verification does not erase cumulative failures in that window. Correct blocked/forced-change credentials count as verification success. No permanent account lockout is introduced.

Explicit LA13 mode removes IP buckets, retains targets/recognized-token limits and adds the following **named constants, for owner review before activation**:

| Route | Global ceiling |
| --- | --- |
| Name check | 600/minute |
| Claim | 300/hour |
| Sign-in | 600/15 minutes |
| Password | 60/15 minutes |
| Resume | 1,200/minute |
| Logout | 1,200/minute |

Other modes use verified-source IP limits. Counter time comes from PostgreSQL; each RPC locks buckets in stable order, increments them atomically and returns the largest blocking delay. Entry windows encompass later target windows, so an earlier entry denial cannot hide a longer target delay. In-flight checks admitted before failures commit can finish; counters are not hash-slot reservations. A CAPTCHA never bypasses a hard limit.

Recognized tokens use 120/minute token buckets; malformed/unknown traffic uses 120/minute IP buckets, or the LA13 route ceiling. Arbitrary syntactically valid token digests do not get private recognized-token buckets. Token admission runs before body failures while preserving existing validation-error precedence.

Canonical IPv4 subjects unify mapped IPv6, and IPv6 uses /64. IP, target, token and global subjects use domain-separated HMAC-SHA256; raw IPs are never stored or logged. Counter expiry is window end plus one hour. Cleanup deletes at most 100 expired counter/replay rows, at most once per minute per worker. Cleanup failures do not change successful admission. No pg_cron is needed.

Structured logs contain server-generated request ID, route category, safe result code, duration and rate scope/retry delay; no raw headers/bodies, credentials, upstream errors or subject hashes are logged. Existing worker hash admission logs AUTH_BUSY through the same result path. The service-loader promise is shared while pending, retained after success, and cleared after rejection so later requests can retry.

### Validation and rollback

Focused tests are explicitly listed below; the live-integration flag must remain unset and no --allow-net is granted. Read permission is limited to the public manual account package for deterministic generator comparisons.

```powershell
deno task check
deno test --cached-only --frozen '--allow-env=ACCOUNTS_MODE,ENABLE_SERVER_DEBUG_LOGS' --allow-read=supabase/manual/account src/supabase/functions/server/tests/accounts/password_test.ts src/supabase/functions/server/tests/accounts/hashAdmission_test.ts src/supabase/functions/server/tests/accounts/tokens_test.ts src/supabase/functions/server/tests/accounts/nameKeys_test.ts src/supabase/functions/server/tests/accounts/accountRepository_test.ts src/supabase/functions/server/tests/accounts/accountService_test.ts src/supabase/functions/server/tests/accounts/nameRules_test.ts src/supabase/functions/server/tests/accounts/nameRulesGenerator_test.ts src/supabase/functions/server/tests/accounts/humanCheck_test.ts src/supabase/functions/server/tests/accounts/rateLimit_test.ts src/supabase/functions/server/tests/accounts/clientIp_test.ts src/supabase/functions/server/tests/accounts/accountServiceLoader_test.ts src/supabase/functions/server/tests/routes/account_routes_test.ts src/supabase/functions/server/tests/routes/account_enabled_routes_test.ts src/supabase/functions/server/tests/routes/account_name_check_routes_test.ts
git diff --check
```

For the separate mock, test forward/seed/verify/rollback/reapply, seed reruns with changed hashes and colliding owner rows, drift/later-set/dependency refusal, every innocent/abuse example, overlapping safe masks, shared/exclusive lock contention, concurrent fixed-window hits and proof consumption, ACL/RLS and constraint rejection. If supplied, include historical player names. Verify rollback restores set 02's exact checker, signatures and constraints without changing accounts, credentials, tokens, links, preferences, KV data or Auth users.

**22C.3a local validation:** deno task check PASS; the fifteen test files above PASS, 70 tests and zero failures, with deterministic saved-output comparisons. Generator emitted 1,096 rows / 223,794 SQL bytes. git diff --check PASS for authored work; the staged check reports 25 original whitespace-only lines in the supplied gist snapshot, preserved byte-for-byte. The staged check excluding only that snapshot passes. Existing ignored Deno compiler-option warnings remain. Live-integration flag was unset; no database/local-live/deployment was used.

Disable account operations and reverse later sets before `03-rollback.sql`. It removes generated seeds, the four new functions, masking column/constraints and the two set 03-only global counter scopes. It retains replay/other counters until expiry and restores set 02's checker verbatim. It refuses retained owner/other rules using safe substrings or wildcard keys; remove/review those dependencies explicitly first. Unexpected external dependencies abort through RESTRICT.
