-- Entire file as postgres; ACCOUNTS_MODE off; reverse later sets first.
-- Preserves account/credential/token/link data; removes generated rules and set 03-only counter scopes.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $preconditions$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Set 03 rollback requires postgres'; END IF;
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
      ('public.account_identity(bytea,text)'),
      ('public.account_name_status(text)'),
      ('public.account_rate_hit(jsonb,bytea)'),
      ('public.account_captcha_consume(bytea,boolean)'),
      ('public.account_cleanup_rate_limits()')
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
      ('public.account_identity(bytea,text)'),
      ('public.account_name_status(text)'),
      ('public.account_rate_hit(jsonb,bytea)'),
      ('public.account_captcha_consume(bytea,boolean)'),
      ('public.account_cleanup_rate_limits()')
    ) SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_'
      AND NOT EXISTS (SELECT 1 FROM expected e WHERE pg_catalog.to_regprocedure(e.signature)::oid = p.oid)
  ) THEN
    RAISE EXCEPTION 'Set 03 signatures differ or later-set functions exist; reverse later sets first';
  END IF;
END;
$preconditions$;
SELECT pg_catalog.pg_advisory_xact_lock(22002,1);
DO $dependencies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_name_rules'::regclass
    AND attname='safe_substrings' AND NOT attisdropped) THEN RAISE EXCEPTION 'Set 03 column missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_name_rules
    WHERE source NOT LIKE 'seed03:dsojevic-profanity-en.json@%' AND source NOT LIKE 'seed03:btrsco-reserved-usernames.json@%'
      AND (pg_catalog.cardinality(safe_substrings)>0 OR pg_catalog.strpos(match_key,'*')>0)) THEN
    RAISE EXCEPTION 'Owner or retained rules depend on set 03 masking/wildcards; review before rollback';
  END IF;
END;
$dependencies$;
DELETE FROM public.account_name_rules WHERE source LIKE 'seed03:dsojevic-profanity-en.json@%' OR source LIKE 'seed03:btrsco-reserved-usernames.json@%';
DELETE FROM public.account_rate_limits WHERE scope IN ('resume_global','logout_global');
CREATE OR REPLACE FUNCTION public.account_check_name(p_name_key text, p_moderation_key text, p_check_reserved boolean)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF p_name_key IS NULL OR p_moderation_key IS NULL OR
     p_name_key COLLATE "C" !~ '^[a-z0-9]{3,20}$' OR
     p_moderation_key <> pg_catalog.translate(p_name_key, '0123456789', 'oizeasgtbg') OR p_check_reserved IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_NAME_KEY';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_name_rules r
    WHERE r.kind = 'banned' AND r.match_kind = 'exact' AND r.match_key = p_moderation_key)
    OR (NOT EXISTS (SELECT 1 FROM public.account_name_rules r
        WHERE r.kind = 'exception' AND r.match_key = p_moderation_key)
      AND EXISTS (SELECT 1 FROM public.account_name_rules r WHERE r.kind = 'banned'
        AND r.match_kind = 'contains' AND pg_catalog.strpos(p_moderation_key, r.match_key) > 0)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2209', MESSAGE = 'ACCOUNT_NAME_BANNED';
  END IF;
  IF p_check_reserved AND EXISTS (SELECT 1 FROM public.account_name_rules r
    WHERE r.kind = 'reserved' AND r.match_key = p_name_key) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2210', MESSAGE = 'ACCOUNT_NAME_RESERVED';
  END IF;
END;
$function$;

DROP FUNCTION public.account_name_status(text) RESTRICT;
DROP FUNCTION public.account_rate_hit(jsonb,bytea) RESTRICT;
DROP FUNCTION public.account_captcha_consume(bytea,boolean) RESTRICT;
DROP FUNCTION public.account_cleanup_rate_limits() RESTRICT;
ALTER TABLE public.account_name_rules DROP CONSTRAINT account_name_rules_safe_substrings_check;
ALTER TABLE public.account_name_rules DROP COLUMN safe_substrings RESTRICT;
ALTER TABLE public.account_name_rules DROP CONSTRAINT account_name_rules_match_key_check;
ALTER TABLE public.account_name_rules ADD CONSTRAINT account_name_rules_match_key_check CHECK (char_length(match_key) BETWEEN 1 AND 64);
ALTER TABLE public.account_rate_limits DROP CONSTRAINT account_rate_limits_scope_check;
ALTER TABLE public.account_rate_limits ADD CONSTRAINT account_rate_limits_scope_check CHECK (scope IN (
  'name_check_ip','name_check_target','claim_ip','claim_target','signin_ip','signin_failure_ip_target',
  'signin_failure_target','account_token','account_unknown_ip','captcha_replay','name_check_global','claim_global','signin_global','password_global'));
COMMIT;