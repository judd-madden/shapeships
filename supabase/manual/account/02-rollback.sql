-- Entire file as postgres; ACCOUNTS_MODE off; reverse later sets first.
-- Function-only rollback preserves all set 01 rows/tables/grants.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $preconditions$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Set 02 rollback requires postgres'; END IF;
  IF EXISTS (
    WITH expected(signature) AS (VALUES
      ('public.account_check_name(text,text,boolean)'),
      ('public.account_link_session(text,uuid,uuid)'),
      ('public.account_read_credential(text)'),
      ('public.account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean)'),
      ('public.account_finish_signin(uuid,bigint,text,text,bytea,text)'),
      ('public.account_resume(bytea,text)'),
      ('public.account_logout(bytea)'),
      ('public.account_change_password(uuid,bigint,text,text,text,text,bytea,text)'),
      ('public.account_rehash(uuid,bigint,text,text,text,text)'),
      ('public.account_identity(bytea,text)')
    ) SELECT 1 FROM expected WHERE pg_catalog.to_regprocedure(signature) IS NULL
  ) OR EXISTS (
    WITH expected(signature) AS (VALUES
      ('public.account_check_name(text,text,boolean)'),
      ('public.account_link_session(text,uuid,uuid)'),
      ('public.account_read_credential(text)'),
      ('public.account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean)'),
      ('public.account_finish_signin(uuid,bigint,text,text,bytea,text)'),
      ('public.account_resume(bytea,text)'),
      ('public.account_logout(bytea)'),
      ('public.account_change_password(uuid,bigint,text,text,text,text,bytea,text)'),
      ('public.account_rehash(uuid,bigint,text,text,text,text)'),
      ('public.account_identity(bytea,text)')
    ) SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_'
      AND NOT EXISTS (SELECT 1 FROM expected e WHERE pg_catalog.to_regprocedure(e.signature)::oid = p.oid)
  ) THEN
    RAISE EXCEPTION 'Set 02 signatures differ or later-set functions exist; reverse later sets first';
  END IF;
END;
$preconditions$;
DROP FUNCTION public.account_read_credential(text) RESTRICT;
DROP FUNCTION public.account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean) RESTRICT;
DROP FUNCTION public.account_finish_signin(uuid,bigint,text,text,bytea,text) RESTRICT;
DROP FUNCTION public.account_resume(bytea,text) RESTRICT;
DROP FUNCTION public.account_logout(bytea) RESTRICT;
DROP FUNCTION public.account_change_password(uuid,bigint,text,text,text,text,bytea,text) RESTRICT;
DROP FUNCTION public.account_rehash(uuid,bigint,text,text,text,text) RESTRICT;
DROP FUNCTION public.account_identity(bytea,text) RESTRICT;
DROP FUNCTION public.account_link_session(text,uuid,uuid) RESTRICT;
DROP FUNCTION public.account_check_name(text,text,boolean) RESTRICT;
COMMIT;
