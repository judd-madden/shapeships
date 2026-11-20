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

**Current owner-reported state:** set 01 was applied on 20 November 2026 and its verification reported PASS with zero failures. The set 01 implementation notes above describe its original delivery state. **Set 02 is delivered unapplied.**

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
