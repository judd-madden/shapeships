-- Set 03 / 22C.3a. Entire file as postgres, after backup and sets 01/02.
-- No new tables, KV changes, network calls, hashing or automatic application.
BEGIN;
SET LOCAL lock_timeout = '2s';
DO $preconditions$
DECLARE v_name text; v_expected record; v_oid oid; v_table record;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Set 03 requires postgres'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND pg_catalog.left(p.proname,8)='account_') <> 10 THEN
    RAISE EXCEPTION 'Set 03 requires exactly the ten set 02 functions';
  END IF;
  FOR v_expected IN SELECT * FROM (VALUES
    ('account_check_name(text,text,boolean)',false,'void'),
    ('account_link_session(text,uuid,uuid)',true,'jsonb'),
    ('account_read_credential(text)',false,'jsonb'),
    ('account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean)',true,'jsonb'),
    ('account_finish_signin(uuid,bigint,text,text,bytea,text)',true,'jsonb'),
    ('account_resume(bytea,text)',true,'jsonb'), ('account_logout(bytea)',true,'void'),
    ('account_change_password(uuid,bigint,text,text,text,text,bytea,text)',true,'jsonb'),
    ('account_rehash(uuid,bigint,text,text,text,text)',true,'boolean'),
    ('account_identity(bytea,text)',false,'jsonb')) e(signature,mutator,result_type)
  LOOP
    v_oid := pg_catalog.to_regprocedure('public.' || v_expected.signature);
    IF v_oid IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=v_oid
      AND NOT p.prosecdef AND p.prokind='f' AND pg_catalog.pg_get_function_result(p.oid)=v_expected.result_type
      AND p.provolatile=CASE WHEN v_expected.mutator THEN 'v'::"char" ELSE 's'::"char" END
      AND ARRAY(SELECT c FROM pg_catalog.unnest(p.proconfig) c ORDER BY c)=
        CASE WHEN v_expected.mutator THEN ARRAY['lock_timeout=2s','search_path=""'] ELSE ARRAY['search_path=""'] END)
      OR pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('service_role',v_oid,'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE p.oid=v_oid AND a.is_grantable AND (a.grantee=0 OR pg_catalog.pg_has_role('service_role',a.grantee,'USAGE')))
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE p.oid=v_oid AND a.grantee=0) THEN
      RAISE EXCEPTION 'Set 02 function/config/ACL drift: %',v_expected.signature;
    END IF;
  END LOOP;
  FOREACH v_name IN ARRAY ARRAY['account_accounts','account_credentials','account_tokens','account_session_links',
    'account_preferences','account_name_rules','account_rate_limits','account_owner_events'] LOOP
    SELECT c.* INTO v_table FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.'||v_name);
    IF NOT FOUND OR v_table.relkind<>'r' OR NOT v_table.relrowsecurity OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=v_table.oid) THEN
      RAISE EXCEPTION 'Set 01 table/RLS/policy drift: %',v_name;
    END IF;
    IF EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) r(role_name)
      CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(v_table.relacl,pg_catalog.acldefault('r',v_table.relowner))) a
      WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_catalog.pg_has_role(r.role_name,a.grantee,'USAGE') END)
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
        CROSS JOIN (VALUES ('anon'),('authenticated')) r(role_name)
        WHERE a.attrelid=v_table.oid AND CASE WHEN acl.grantee=0 THEN true ELSE pg_catalog.pg_has_role(r.role_name,acl.grantee,'USAGE') END) THEN
      RAISE EXCEPTION 'Set 01 browser table/column grants drift: %',v_name;
    END IF;
    IF NOT COALESCE((SELECT pg_catalog.array_agg(DISTINCT privilege_type ORDER BY privilege_type)=
      CASE WHEN v_name='account_owner_events' THEN ARRAY['DELETE','INSERT','SELECT'] ELSE ARRAY['DELETE','INSERT','SELECT','UPDATE'] END
      AND NOT pg_catalog.bool_or(is_grantable) FROM pg_catalog.aclexplode(COALESCE(v_table.relacl,pg_catalog.acldefault('r',v_table.relowner))) acl
      WHERE CASE WHEN acl.grantee=0 THEN true ELSE pg_catalog.pg_has_role('service_role',acl.grantee,'USAGE') END),false) THEN
      RAISE EXCEPTION 'Set 01 service grants drift: %',v_name;
    END IF;
  END LOOP;
  FOREACH v_name IN ARRAY ARRAY['kv_store_825e19ab','kv_store_825e19ab_pre_alpha_archive_20260429','kv_store_2243ca4c','kv_store_67bdd4b5'] LOOP
    SELECT c.* INTO v_table FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.'||v_name);
    IF NOT FOUND OR EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) r(role_name)
      CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(v_table.relacl,pg_catalog.acldefault('r',v_table.relowner))) acl
      WHERE CASE WHEN acl.grantee=0 THEN true ELSE pg_catalog.pg_has_role(r.role_name,acl.grantee,'USAGE') END)
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
        CROSS JOIN (VALUES ('anon'),('authenticated')) r(role_name)
        WHERE a.attrelid=v_table.oid AND CASE WHEN acl.grantee=0 THEN true ELSE pg_catalog.pg_has_role(r.role_name,acl.grantee,'USAGE') END) THEN
      RAISE EXCEPTION 'Set 01 KV grants drift: %',v_name;
    END IF;
  END LOOP;
  IF pg_catalog.to_regclass('public.screen_names') IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_accounts'::regclass AND conname='account_accounts_name_key_key' AND contype='u')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_credentials'::regclass AND attname='must_change_password' AND attnotnull AND atttypid='boolean'::regtype)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_name_rules'::regclass AND attname='safe_substrings' AND NOT attisdropped)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_name_rules'::regclass AND conname='account_name_rules_safe_substrings_check') THEN
    RAISE EXCEPTION 'Set 01 prerequisites differ or set 03 already exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_name_rules'::regclass AND conname='account_name_rules_match_key_check'
    AND pg_catalog.pg_get_expr(conbin,conrelid)='((char_length(match_key) >= 1) AND (char_length(match_key) <= 64))') THEN
    RAISE EXCEPTION 'Set 01 name key constraint differs';
  END IF;
END;
$preconditions$;

SELECT pg_catalog.pg_advisory_xact_lock(22002,1);
ALTER TABLE public.account_name_rules ADD COLUMN safe_substrings text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.account_name_rules DROP CONSTRAINT account_name_rules_match_key_check;
ALTER TABLE public.account_name_rules ADD CONSTRAINT account_name_rules_match_key_check CHECK (
  char_length(match_key) BETWEEN 1 AND 64 AND CASE kind
    WHEN 'reserved' THEN match_key COLLATE "C" ~ '^[a-z0-9]{3,20}$'
    WHEN 'exception' THEN match_key COLLATE "C" ~ '^[a-z]{3,20}$'
    ELSE match_key COLLATE "C" ~ '^([a-z][*]?)+$' END);
ALTER TABLE public.account_name_rules ADD CONSTRAINT account_name_rules_safe_substrings_check CHECK (
  pg_catalog.array_position(safe_substrings,NULL) IS NULL
  AND (pg_catalog.cardinality(safe_substrings)=0 OR (kind='banned' AND match_kind='contains'
    AND pg_catalog.array_ndims(safe_substrings)=1
    AND pg_catalog.array_to_string(safe_substrings,',') COLLATE "C" ~ '^[a-z]+(,[a-z]+)*$')));
ALTER TABLE public.account_rate_limits DROP CONSTRAINT account_rate_limits_scope_check;
ALTER TABLE public.account_rate_limits ADD CONSTRAINT account_rate_limits_scope_check CHECK (scope IN (
  'name_check_ip','name_check_target','claim_ip','claim_target','signin_ip','signin_failure_ip_target',
  'signin_failure_target','account_token','account_unknown_ip','captcha_replay','name_check_global',
  'claim_global','signin_global','password_global','resume_global','logout_global'));

CREATE OR REPLACE FUNCTION public.account_check_name(p_name_key text,p_moderation_key text,p_check_reserved boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $function$
DECLARE r record; v_masked text; v_safe text; v_at integer; v_next integer; v_excepted boolean;
BEGIN
  IF p_name_key IS NULL OR p_moderation_key IS NULL OR p_check_reserved IS NULL
    OR p_name_key COLLATE "C" !~ '^[a-z0-9]{3,20}$'
    OR p_moderation_key<>pg_catalog.translate(p_name_key,'0123456789','oizeasgtbg') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ACCOUNT_BAD_NAME_KEY';
  END IF;
  v_excepted := EXISTS (SELECT 1 FROM public.account_name_rules WHERE kind='exception' AND match_key=p_moderation_key);
  -- ~ uses only validated letter/repetition patterns; candidate length is <=20.
  -- Approximately 1,100 seed rows; no untrusted regex operators or nested groups.
  FOR r IN SELECT * FROM public.account_name_rules WHERE kind='banned' ORDER BY match_kind,match_key LOOP
    IF r.match_kind='exact' THEN
      IF p_moderation_key ~ ('^('||pg_catalog.replace(r.match_key,'*','+')||')$') THEN
        RAISE EXCEPTION USING ERRCODE='P2209',MESSAGE='ACCOUNT_NAME_BANNED';
      END IF;
    ELSIF NOT v_excepted THEN
      v_masked := p_moderation_key;
      FOREACH v_safe IN ARRAY r.safe_substrings LOOP
        v_next := 1;
        LOOP
          v_at := pg_catalog.strpos(pg_catalog.substr(p_moderation_key,v_next),v_safe);
          EXIT WHEN v_at=0;
          v_at := v_at+v_next-1;
          v_masked := pg_catalog.substr(v_masked,1,v_at-1)||pg_catalog.repeat('#',pg_catalog.char_length(v_safe))||pg_catalog.substr(v_masked,v_at+pg_catalog.char_length(v_safe));
          v_next := v_at+1;
        END LOOP;
      END LOOP;
      IF v_masked ~ pg_catalog.replace(r.match_key,'*','+') THEN
        RAISE EXCEPTION USING ERRCODE='P2209',MESSAGE='ACCOUNT_NAME_BANNED';
      END IF;
    END IF;
  END LOOP;
  IF p_check_reserved AND EXISTS (SELECT 1 FROM public.account_name_rules WHERE kind='reserved' AND match_key=p_name_key) THEN
    RAISE EXCEPTION USING ERRCODE='P2210',MESSAGE='ACCOUNT_NAME_RESERVED';
  END IF;
END;
$function$;

CREATE FUNCTION public.account_name_status(p_display_name text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $function$
DECLARE v_key text; v_decoded text; v_outcome text := 'available'; v_display text := p_display_name;
BEGIN
  IF p_display_name IS NULL OR p_display_name COLLATE "C" !~ '^[A-Za-z0-9]{3,20}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ACCOUNT_BAD_NAME_KEY';
  END IF;
  v_key := pg_catalog.lower(p_display_name COLLATE "C");
  v_decoded := pg_catalog.translate(v_key,'0123456789','oizeasgtbg');
  BEGIN
    PERFORM public.account_check_name(v_key,v_decoded,false);
  EXCEPTION WHEN SQLSTATE 'P2209' THEN v_outcome := 'banned'; END;
  IF v_outcome<>'banned' THEN
    SELECT a.display_name INTO v_display FROM public.account_accounts a WHERE a.name_key=v_key;
    IF FOUND THEN v_outcome := 'claimed';
    ELSE
      v_display := p_display_name;
      BEGIN
        PERFORM public.account_check_name(v_key,v_decoded,true);
      EXCEPTION WHEN SQLSTATE 'P2209' THEN v_outcome := 'banned';
        WHEN SQLSTATE 'P2210' THEN v_outcome := 'reserved'; END;
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('nameKey',v_key,'displayName',v_display,'outcome',v_outcome);
END;
$function$;

CREATE FUNCTION public.account_rate_hit(p_buckets jsonb,p_token_hash bytea DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE b jsonb; v_scope text; v_hash bytea; v_limit integer; v_seconds integer; v_operation text;
  v_now timestamptz := pg_catalog.clock_timestamp(); v_start timestamptz; v_end timestamptz;
  v_count integer; v_allowed boolean := true; v_retry integer := 0; v_counts jsonb := '{}';
  v_recognized boolean; v_seen text[] := '{}'; v_applies text;
BEGIN
  IF p_buckets IS NULL OR pg_catalog.jsonb_typeof(p_buckets)<>'array' THEN RAISE EXCEPTION 'Invalid rate buckets'; END IF;
  IF pg_catalog.jsonb_array_length(p_buckets)>16 OR (p_token_hash IS NOT NULL AND pg_catalog.octet_length(p_token_hash)<>32) THEN RAISE EXCEPTION 'Invalid rate request'; END IF;
  v_recognized := p_token_hash IS NOT NULL AND EXISTS (SELECT 1 FROM public.account_tokens WHERE token_hash=p_token_hash);
  -- Stable row order prevents multi-bucket lock inversion. All increments commit
  -- together, including on a denied attempt; no exception is raised for limits.
  FOR b IN SELECT x.value FROM pg_catalog.jsonb_array_elements(p_buckets) x ORDER BY x.value->>'scope',x.value->>'subjectHash' LOOP
    v_scope := b->>'scope'; v_limit := (b->>'limit')::integer; v_seconds := (b->>'windowSeconds')::integer;
    v_operation := b->>'operation'; v_applies := COALESCE(b->>'applies','always');
    IF v_scope IS NULL OR v_scope NOT IN ('name_check_ip','name_check_target','claim_ip','claim_target','signin_ip',
      'signin_failure_ip_target','signin_failure_target','account_token','account_unknown_ip','name_check_global',
      'claim_global','signin_global','password_global','resume_global','logout_global')
      OR v_limit IS NULL OR v_limit NOT BETWEEN 1 AND 1000000 OR v_seconds IS NULL OR v_seconds NOT BETWEEN 1 AND 3600
      OR v_operation IS NULL OR v_operation NOT IN ('hit','probe') OR v_applies NOT IN ('always','recognized','unknown')
      OR b->>'subjectHash' IS NULL OR (b->>'subjectHash') COLLATE "C" !~ '^[0-9a-f]{64}$'
      OR v_scope=ANY(v_seen) THEN RAISE EXCEPTION 'Invalid rate bucket'; END IF;
    v_seen := pg_catalog.array_append(v_seen,v_scope);
    IF (v_applies='recognized' AND NOT v_recognized) OR (v_applies='unknown' AND v_recognized) THEN CONTINUE; END IF;
    v_hash := pg_catalog.decode(b->>'subjectHash','hex');
    v_start := pg_catalog.to_timestamp(pg_catalog.floor(EXTRACT(epoch FROM v_now)/v_seconds)*v_seconds);
    v_end := v_start+v_seconds*interval '1 second';
    INSERT INTO public.account_rate_limits(scope,subject_hash,window_start,count,expires_at)
      VALUES(v_scope,v_hash,v_start,0,v_end+interval '1 hour') ON CONFLICT DO NOTHING;
    SELECT r.count INTO STRICT v_count FROM public.account_rate_limits r
      WHERE r.scope=v_scope AND r.subject_hash=v_hash AND r.window_start=v_start FOR UPDATE;
    IF v_operation='hit' THEN
      v_count := LEAST(v_count+1,v_limit+1);
      UPDATE public.account_rate_limits SET count=v_count WHERE scope=v_scope AND subject_hash=v_hash AND window_start=v_start;
    END IF;
    v_counts := v_counts || pg_catalog.jsonb_build_object(v_scope,v_count);
    IF (v_operation='hit' AND v_count>v_limit) OR (v_operation='probe' AND v_count>=v_limit) THEN
      v_allowed := false;
      v_retry := GREATEST(v_retry,GREATEST(1,pg_catalog.ceil(EXTRACT(epoch FROM (v_end-v_now)))::integer));
    END IF;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('allowed',v_allowed,'retryAfterSeconds',v_retry,'counts',v_counts);
END;
$function$;

CREATE FUNCTION public.account_captcha_consume(p_proof_hash bytea,p_consume boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_now timestamptz := pg_catalog.clock_timestamp(); v_count integer;
BEGIN
  IF p_proof_hash IS NULL OR pg_catalog.octet_length(p_proof_hash)<>32 OR p_consume IS NULL THEN RAISE EXCEPTION 'Invalid replay request'; END IF;
  IF NOT p_consume THEN RETURN NOT EXISTS (SELECT 1 FROM public.account_rate_limits
    WHERE scope='captcha_replay' AND subject_hash=p_proof_hash AND window_start='epoch'::timestamptz AND expires_at>v_now); END IF;
  INSERT INTO public.account_rate_limits(scope,subject_hash,window_start,count,expires_at)
    VALUES('captcha_replay',p_proof_hash,'epoch'::timestamptz,1,v_now+interval '10 minutes')
    ON CONFLICT (scope,subject_hash,window_start) DO UPDATE SET count=1,expires_at=EXCLUDED.expires_at
      WHERE public.account_rate_limits.expires_at<=v_now;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END;
$function$;

CREATE FUNCTION public.account_cleanup_rate_limits()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_count integer;
BEGIN
  WITH expired AS (SELECT r.scope,r.subject_hash,r.window_start FROM public.account_rate_limits r
    WHERE r.expires_at<=pg_catalog.clock_timestamp() ORDER BY r.expires_at,r.scope,r.subject_hash,r.window_start
    LIMIT 100 FOR UPDATE SKIP LOCKED)
  DELETE FROM public.account_rate_limits r USING expired e
    WHERE r.scope=e.scope AND r.subject_hash=e.subject_hash AND r.window_start=e.window_start;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.account_check_name(text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_name_status(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_rate_hit(jsonb,bytea) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_captcha_consume(bytea,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_cleanup_rate_limits() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_check_name(text,text,boolean),public.account_name_status(text),
  public.account_rate_hit(jsonb,bytea),public.account_captcha_consume(bytea,boolean),public.account_cleanup_rate_limits() TO service_role;
COMMIT;
