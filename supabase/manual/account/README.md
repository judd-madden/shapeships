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
