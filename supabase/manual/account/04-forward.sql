-- Set 04 / 22C.4. Entire file as postgres after backup, sets 01-03 and seed.
-- No tables, name-rule edits, KV writes, hashing, network calls or automatic application.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $preconditions$
DECLARE v_name text;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'Set 04 requires postgres'; END IF;
  -- Carry forward every set 03 verification check, including all fourteen functions.
  IF EXISTS (SELECT 1 FROM (
-- One SELECT / one result, postgres after set 03 forward and seed.
-- Supersedes 02-verify; expects fourteen account routines.
WITH expected(signature, mutator, result_type) AS (VALUES
  ('account_check_name(text,text,boolean)', false, 'void'),
  ('account_link_session(text,uuid,uuid)', true, 'jsonb'),
  ('account_read_credential(text)', false, 'jsonb'),
  ('account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean)', true, 'jsonb'),
  ('account_finish_signin(uuid,bigint,text,text,bytea,text)', true, 'jsonb'),
  ('account_resume(bytea,text)', true, 'jsonb'),
  ('account_logout(bytea)', true, 'void'),
  ('account_change_password(uuid,bigint,text,text,text,text,bytea,text)', true, 'jsonb'),
  ('account_rehash(uuid,bigint,text,text,text,text)', true, 'boolean'),
  ('account_identity(bytea,text)', false, 'jsonb'),
  ('account_name_status(text)', false, 'jsonb'),
  ('account_rate_hit(jsonb,bytea)', true, 'jsonb'),
  ('account_captcha_consume(bytea,boolean)', true, 'boolean'),
  ('account_cleanup_rate_limits()', true, 'integer')
), functions AS (
  SELECT e.*, pg_catalog.to_regprocedure('public.' || e.signature)::oid AS oid
  FROM expected e
), account_tables(name) AS (VALUES
  ('account_accounts'),('account_credentials'),('account_tokens'),('account_session_links'),
  ('account_preferences'),('account_name_rules'),('account_rate_limits'),('account_owner_events')
), kv_tables(name) AS (VALUES
  ('kv_store_825e19ab'),('kv_store_825e19ab_pre_alpha_archive_20260429'),
  ('kv_store_2243ca4c'),('kv_store_67bdd4b5')
), relations AS (
  SELECT t.name, c.oid, c.relkind, c.relrowsecurity, c.relowner, c.relacl
  FROM (SELECT name FROM account_tables UNION ALL SELECT name FROM kv_tables) t
  LEFT JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass('public.' || t.name)
), checks(category, check_name, passed, detail) AS (
  SELECT 'functions', 'Exact set of fourteen account functions',
    (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_') = 14
    AND NOT EXISTS (SELECT 1 FROM functions WHERE oid IS NULL)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_'
      AND NOT EXISTS (SELECT 1 FROM functions e WHERE e.oid = p.oid)),
    'Extra routines or overloads fail; all expected signatures must exist'
  UNION ALL
  SELECT 'functions', f.signature || ': invoker, result and configuration',
    COALESCE(NOT p.prosecdef AND p.prokind = 'f' AND pg_catalog.pg_get_function_result(p.oid) = f.result_type
      AND p.provolatile = CASE WHEN f.mutator THEN 'v'::"char" ELSE 's'::"char" END
      AND ARRAY(SELECT config FROM pg_catalog.unnest(p.proconfig) config ORDER BY config) =
        CASE WHEN f.mutator THEN ARRAY['lock_timeout=2s','search_path=""'] ELSE ARRAY['search_path=""'] END, false),
    'Exact empty search_path; mutators also have lock_timeout=2s, no unexpected settings'
  FROM functions f LEFT JOIN pg_catalog.pg_proc p ON p.oid = f.oid
  UNION ALL
  SELECT 'access', f.signature || ': no browser EXECUTE',
    p.oid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
    ) AND NOT pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'PUBLIC absent; effective anon/authenticated privileges denied'
  FROM functions f LEFT JOIN pg_catalog.pg_proc p ON p.oid = f.oid
  UNION ALL
  SELECT 'access', f.signature || ': service EXECUTE',
    COALESCE(pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE'), false)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE acl.is_grantable AND (acl.grantee = 0 OR pg_catalog.pg_has_role('service_role', acl.grantee, 'USAGE'))),
    'Service role can execute without grant option'
  FROM functions f LEFT JOIN pg_catalog.pg_proc p ON p.oid = f.oid
  UNION ALL
  SELECT 'tables', a.name || ': set 01 RLS/no-policy posture',
    COALESCE(r.relkind = 'r' AND r.relrowsecurity, false)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid = r.oid),
    'No new tables or policies'
  FROM account_tables a JOIN relations r USING (name)
  UNION ALL
  SELECT 'access', r.name || ': ' || role_name || ' no table/column ACL',
    r.oid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.aclexplode(COALESCE(r.relacl, pg_catalog.acldefault('r', r.relowner))) acl
      WHERE CASE WHEN acl.grantee = 0 THEN true ELSE pg_catalog.pg_has_role(role_name, acl.grantee, 'USAGE') END
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
      WHERE a.attrelid = r.oid
        AND CASE WHEN acl.grantee = 0 THEN true ELSE pg_catalog.pg_has_role(role_name, acl.grantee, 'USAGE') END),
    'Includes PUBLIC, inherited roles and column privileges; KV browser grants remain revoked'
  FROM relations r CROSS JOIN (VALUES ('anon'),('authenticated')) roles(role_name)
  UNION ALL
  SELECT 'access', a.name || ': service exact table privileges',
    COALESCE((SELECT pg_catalog.array_agg(DISTINCT privilege_type ORDER BY privilege_type) =
      CASE WHEN a.name = 'account_owner_events' THEN ARRAY['DELETE','INSERT','SELECT']
        ELSE ARRAY['DELETE','INSERT','SELECT','UPDATE'] END AND NOT pg_catalog.bool_or(is_grantable)
      FROM pg_catalog.aclexplode(COALESCE(r.relacl, pg_catalog.acldefault('r', r.relowner))) acl
      WHERE CASE WHEN acl.grantee = 0 THEN true ELSE pg_catalog.pg_has_role('service_role', acl.grantee, 'USAGE') END), false),
    'Unchanged DML-only grants'
  FROM account_tables a JOIN relations r USING (name)
  UNION ALL
  SELECT 'collateral', 'screen_names absent', pg_catalog.to_regclass('public.screen_names') IS NULL, 'Set 01 removal retained'
  UNION ALL
  SELECT 'collateral', 'Active KV still has two indexes',
    pg_catalog.to_regclass('public.kv_store_825e19ab') IS NOT NULL AND
      (SELECT count(*) FROM pg_catalog.pg_index WHERE indrelid = pg_catalog.to_regclass('public.kv_store_825e19ab')) = 2,
    'No KV row/index changes; use the private backup for data recovery'
  UNION ALL
  SELECT 'schema', 'safe_substrings column/default and constraints',
    EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.account_name_rules'::regclass AND a.attname='safe_substrings' AND a.atttypid='text[]'::regtype
      AND a.attnotnull AND pg_catalog.pg_get_expr(d.adbin,d.adrelid)='''{}''::text[]')
    AND (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid='public.account_name_rules'::regclass
      AND conname IN ('account_name_rules_match_key_check','account_name_rules_safe_substrings_check') AND convalidated)=2
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_name_rules'::regclass
      AND conname='account_name_rules_match_key_check' AND pg_catalog.strpos(pg_catalog.pg_get_expr(conbin,conrelid),'^([a-z][*]?)+$')>0
      AND pg_catalog.strpos(pg_catalog.pg_get_expr(conbin,conrelid),'^[a-z0-9]{3,20}$')>0
      AND pg_catalog.strpos(pg_catalog.pg_get_expr(conbin,conrelid),'^[a-z]{3,20}$')>0)
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_name_rules'::regclass
      AND conname='account_name_rules_safe_substrings_check'
      AND pg_catalog.strpos(pg_catalog.pg_get_expr(conbin,conrelid),'array_position')>0
      AND pg_catalog.strpos(pg_catalog.pg_get_expr(conbin,conrelid),'array_ndims')>0
      AND pg_catalog.strpos(pg_catalog.pg_get_expr(conbin,conrelid),'^[a-z]+(,[a-z]+)*$')>0)
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_rate_limits'::regclass
      AND conname='account_rate_limits_scope_check' AND pg_catalog.pg_get_expr(conbin,conrelid) LIKE '%resume_global%'
      AND pg_catalog.pg_get_expr(conbin,conrelid) LIKE '%logout_global%'),
    'Validated strict patterns, contains-only safe substrings, and new token-route global scopes'
  UNION ALL
  SELECT 'seed', 'Reviewed effective rule counts by policy',
    (SELECT count(*) FROM public.account_name_rules WHERE kind='banned' AND match_kind='contains')>=520
    AND (SELECT count(*) FROM public.account_name_rules WHERE kind='banned' AND match_kind='exact')>=107
    AND (SELECT count(*) FROM public.account_name_rules WHERE kind='reserved')>=469,
    (SELECT pg_catalog.string_agg(kind||'/'||match_kind||'='||n,', ' ORDER BY kind,match_kind)
      FROM (SELECT kind,match_kind,count(*)::text n FROM public.account_name_rules GROUP BY kind,match_kind) counts)
  UNION ALL
  SELECT 'seed', 'System and Computer reserved',
    (SELECT count(*) FROM public.account_name_rules WHERE kind='reserved' AND match_kind='exact' AND match_key IN ('system','computer'))=2,
    'Required before activation'
  UNION ALL
  SELECT 'matcher', example.name,
    CASE WHEN example.expect_banned THEN (public.account_name_status(example.name)->>'outcome')='banned'
      ELSE (public.account_name_status(example.name)->>'outcome') IN ('available','claimed') END,
    'Evaluated through account_name_status -> account_check_name; known owner-review cases are in sources/name-rules-report.md'
  FROM (VALUES ('Cassandra',false),('Scunthorpe',false),('Essex',false),('Sussex',false),('Grape',false),('Sextant',false),
    ('Fuck',true),('Fuuuuck',true),('N1gg3r',true),('S3x',true),('R4pe',true),('CuM',true)) example(name,expect_banned)
), results AS (
  SELECT 0 AS sort_order, 'overall' AS category, 'SET 03' AS check_name,
    bool_and(COALESCE(passed, false)) AS passed,
    count(*) FILTER (WHERE NOT COALESCE(passed, false))::text || ' failing checks' AS detail FROM checks
  UNION ALL SELECT 1, category, check_name, COALESCE(passed, false), detail FROM checks
)
SELECT category, check_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, detail
FROM results ORDER BY sort_order, category, check_name
  ) baseline WHERE baseline.result<>'PASS') THEN RAISE EXCEPTION 'Set 04 requires 03-verify PASS; inspect drift'; END IF;
  IF (SELECT pg_catalog.replace(p.prosrc,E'\r\n',E'\n') FROM pg_catalog.pg_proc p WHERE p.oid='public.account_rate_hit(jsonb,bytea)'::regprocedure)
    IS DISTINCT FROM $set03body$
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
$set03body$ THEN
    RAISE EXCEPTION 'Set 03 account_rate_hit body drift'; END IF;

  -- Owner deletion must not cascade or trigger into unrelated data.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND c.relname IN ('account_accounts','account_credentials','account_tokens','account_session_links',
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass])))<>6
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n')) e(child,parent,conname,deletion)
      WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||e.child)
        AND c.confrelid=pg_catalog.to_regclass('public.'||e.parent) AND c.conname=e.conname AND c.contype='f'
        AND c.confdeltype::text=e.deletion AND c.convalidated AND NOT c.condeferrable)) THEN
    RAISE EXCEPTION 'Unexpected account foreign-key dependency or delete-action drift'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_rate_limits'::regclass
    AND conname='account_rate_limits_scope_check' AND convalidated
    AND pg_catalog.regexp_replace(pg_catalog.pg_get_expr(conbin,conrelid),'[[:space:]]','','g')='(scope=ANY(ARRAY[''name_check_ip''::text,''name_check_target''::text,''claim_ip''::text,''claim_target''::text,''signin_ip''::text,''signin_failure_ip_target''::text,''signin_failure_target''::text,''account_token''::text,''account_unknown_ip''::text,''captcha_replay''::text,''name_check_global''::text,''claim_global''::text,''signin_global''::text,''password_global''::text,''resume_global''::text,''logout_global''::text]))') THEN
    RAISE EXCEPTION 'Set 03 rate scope constraint drift'; END IF;
  FOREACH v_name IN ARRAY ARRAY['sound_enabled','health_flash_enabled','chat_minimized','battle_log_preferred','music_enabled'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
      AND attname=v_name AND atttypid='boolean'::regtype AND attnotnull AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Preference column drift: %',v_name; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
    AND attname='revision' AND atttypid='bigint'::regtype AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_preferences'::regclass
      AND conname='account_preferences_revision_check' AND convalidated AND pg_catalog.pg_get_expr(conbin,conrelid)='(revision > 0)') THEN
    RAISE EXCEPTION 'Preference revision drift'; END IF;
END;
$preconditions$;

ALTER TABLE public.account_rate_limits DROP CONSTRAINT account_rate_limits_scope_check;
ALTER TABLE public.account_rate_limits ADD CONSTRAINT account_rate_limits_scope_check CHECK (scope IN (
  'name_check_ip','name_check_target','claim_ip','claim_target','signin_ip','signin_failure_ip_target',
  'signin_failure_target','account_token','account_unknown_ip','captcha_replay','name_check_global',
  'claim_global','signin_global','password_global','resume_global','logout_global','preferences_global'));
CREATE OR REPLACE FUNCTION public.account_rate_hit(p_buckets jsonb,p_token_hash bytea DEFAULT NULL)
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
      'claim_global','signin_global','password_global','resume_global','logout_global','preferences_global')
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

CREATE FUNCTION public.account_get_preferences(p_token_hash bytea)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE; v_p public.account_preferences%ROWTYPE;
BEGIN
  SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id;
  IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN
    RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
  IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
  IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id=v_a.id;
  -- Check again after the final potentially blocking lock.
  IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
  RETURN pg_catalog.jsonb_build_object('preferences',pg_catalog.jsonb_build_object('values',pg_catalog.jsonb_build_object(
    'soundEnabled',v_p.sound_enabled,'healthFlashEnabled',v_p.health_flash_enabled,
    'chatMinimized',v_p.chat_minimized,'battleLogPreferred',v_p.battle_log_preferred,
    'musicEnabled',v_p.music_enabled),'revision',v_p.revision::text,'updatedAt',v_p.updated_at));
END;
$function$;
CREATE FUNCTION public.account_update_preferences(p_token_hash bytea,p_patch jsonb,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE; v_p public.account_preferences%ROWTYPE;
BEGIN
  IF p_patch IS NULL OR pg_catalog.jsonb_typeof(p_patch)<>'object' OR p_expected_revision IS NULL OR p_expected_revision<=0 THEN
    RAISE EXCEPTION USING ERRCODE='P2212',MESSAGE='ACCOUNT_INVALID_PREFERENCE_INPUT'; END IF;
  IF p_patch='{}'::jsonb OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_patch) e
    WHERE e.key NOT IN ('soundEnabled','healthFlashEnabled','chatMinimized','battleLogPreferred','musicEnabled')
      OR pg_catalog.jsonb_typeof(e.value)<>'boolean') THEN
    RAISE EXCEPTION USING ERRCODE='P2212',MESSAGE='ACCOUNT_INVALID_PREFERENCE_INPUT'; END IF;

  SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
  IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN
    RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
  IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
  IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id=v_a.id FOR UPDATE;
  -- Check again after the final potentially blocking lock.
  IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_p.revision<>p_expected_revision THEN
    RETURN pg_catalog.jsonb_build_object('status','conflict','preferences',pg_catalog.jsonb_build_object('values',pg_catalog.jsonb_build_object(
    'soundEnabled',v_p.sound_enabled,'healthFlashEnabled',v_p.health_flash_enabled,
    'chatMinimized',v_p.chat_minimized,'battleLogPreferred',v_p.battle_log_preferred,
    'musicEnabled',v_p.music_enabled),'revision',v_p.revision::text,'updatedAt',v_p.updated_at)); END IF;
  UPDATE public.account_preferences SET
    sound_enabled=COALESCE((p_patch->>'soundEnabled')::boolean,sound_enabled),
    health_flash_enabled=COALESCE((p_patch->>'healthFlashEnabled')::boolean,health_flash_enabled),
    chat_minimized=COALESCE((p_patch->>'chatMinimized')::boolean,chat_minimized),
    battle_log_preferred=COALESCE((p_patch->>'battleLogPreferred')::boolean,battle_log_preferred),
    music_enabled=COALESCE((p_patch->>'musicEnabled')::boolean,music_enabled),
    revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_p;
  RETURN pg_catalog.jsonb_build_object('status','updated','preferences',pg_catalog.jsonb_build_object('values',pg_catalog.jsonb_build_object(
    'soundEnabled',v_p.sound_enabled,'healthFlashEnabled',v_p.health_flash_enabled,
    'chatMinimized',v_p.chat_minimized,'battleLogPreferred',v_p.battle_log_preferred,
    'musicEnabled',v_p.music_enabled),'revision',v_p.revision::text,'updatedAt',v_p.updated_at));
END;
$function$;
CREATE FUNCTION public.account_owner_lookup(p_display_name text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_now timestamptz:=pg_catalog.clock_timestamp();
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_display_name IS NULL OR p_display_name COLLATE "C" !~ '^[A-Za-z0-9]{3,20}$' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NAME'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.name_key=pg_catalog.lower(p_display_name COLLATE "C");
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2240',MESSAGE='ACCOUNT_OWNER_ACCOUNT_NOT_FOUND'; END IF;
  RETURN pg_catalog.jsonb_build_object('accountId',v_a.id,'displayName',v_a.display_name,'status',v_a.status,
    'securityVersion',v_a.security_version::text,'createdAt',v_a.created_at,
    'activeTokens',(SELECT count(*) FROM public.account_tokens t WHERE t.account_id=v_a.id AND t.revoked_at IS NULL
      AND t.expires_at>v_now AND t.security_version=v_a.security_version AND v_a.status='active'),
    'activeLinks',(SELECT count(*) FROM public.account_session_links l JOIN public.account_tokens t ON t.id=l.token_id
      WHERE l.account_id=v_a.id AND t.account_id=v_a.id AND l.detached_at IS NULL AND t.revoked_at IS NULL
      AND t.expires_at>v_now AND t.security_version=v_a.security_version AND v_a.status='active'));
END;
$function$;
CREATE FUNCTION public.account_owner_block(p_account_id uuid,p_expected_security_version bigint,p_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_now timestamptz; v_tokens integer:=0; v_links integer:=0; v_event uuid;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_note IS NULL OR pg_catalog.char_length(p_note)>500 OR pg_catalog.btrim(p_note)='' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NOTE'; END IF;
  IF p_account_id IS NULL OR p_expected_security_version IS NULL OR p_expected_security_version<=0 THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_INPUT'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2240',MESSAGE='ACCOUNT_OWNER_ACCOUNT_NOT_FOUND'; END IF;
  IF v_a.security_version<>p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE='P2241',MESSAGE='ACCOUNT_OWNER_STALE_SECURITY_VERSION'; END IF;
  PERFORM t.id FROM public.account_tokens t WHERE t.account_id=v_a.id ORDER BY t.id FOR UPDATE;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.account_id=v_a.id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_tokens SET revoked_at=v_now WHERE account_id=v_a.id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_tokens=ROW_COUNT;
  UPDATE public.account_session_links SET detached_at=v_now WHERE account_id=v_a.id AND detached_at IS NULL;
  GET DIAGNOSTICS v_links=ROW_COUNT;
  UPDATE public.account_accounts SET status='blocked',security_version=security_version+1,
    updated_at=v_now WHERE id=v_a.id RETURNING * INTO v_a;
  INSERT INTO public.account_owner_events(account_id,action,note) VALUES(v_a.id,'account_block',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('accountId',v_a.id,'status',v_a.status,'securityVersion',v_a.security_version::text,
    'revokedTokens',v_tokens,'detachedLinks',v_links,'eventId',v_event,'updatedAt',v_a.updated_at);
END;
$function$;
CREATE FUNCTION public.account_owner_unblock(p_account_id uuid,p_expected_security_version bigint,p_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_now timestamptz; v_tokens integer:=0; v_links integer:=0; v_event uuid;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_note IS NULL OR pg_catalog.char_length(p_note)>500 OR pg_catalog.btrim(p_note)='' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NOTE'; END IF;
  IF p_account_id IS NULL OR p_expected_security_version IS NULL OR p_expected_security_version<=0 THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_INPUT'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2240',MESSAGE='ACCOUNT_OWNER_ACCOUNT_NOT_FOUND'; END IF;
  IF v_a.security_version<>p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE='P2241',MESSAGE='ACCOUNT_OWNER_STALE_SECURITY_VERSION'; END IF;
  v_now:=pg_catalog.clock_timestamp();
  UPDATE public.account_accounts SET status='active',
    updated_at=v_now WHERE id=v_a.id RETURNING * INTO v_a;
  INSERT INTO public.account_owner_events(account_id,action,note) VALUES(v_a.id,'account_unblock',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('accountId',v_a.id,'status',v_a.status,'securityVersion',v_a.security_version::text,
    'revokedTokens',v_tokens,'detachedLinks',v_links,'eventId',v_event,'updatedAt',v_a.updated_at);
END;
$function$;
CREATE FUNCTION public.account_owner_sign_out_everywhere(p_account_id uuid,p_expected_security_version bigint,p_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_now timestamptz; v_tokens integer:=0; v_links integer:=0; v_event uuid;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_note IS NULL OR pg_catalog.char_length(p_note)>500 OR pg_catalog.btrim(p_note)='' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NOTE'; END IF;
  IF p_account_id IS NULL OR p_expected_security_version IS NULL OR p_expected_security_version<=0 THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_INPUT'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2240',MESSAGE='ACCOUNT_OWNER_ACCOUNT_NOT_FOUND'; END IF;
  IF v_a.security_version<>p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE='P2241',MESSAGE='ACCOUNT_OWNER_STALE_SECURITY_VERSION'; END IF;
  PERFORM t.id FROM public.account_tokens t WHERE t.account_id=v_a.id ORDER BY t.id FOR UPDATE;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.account_id=v_a.id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_tokens SET revoked_at=v_now WHERE account_id=v_a.id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_tokens=ROW_COUNT;
  UPDATE public.account_session_links SET detached_at=v_now WHERE account_id=v_a.id AND detached_at IS NULL;
  GET DIAGNOSTICS v_links=ROW_COUNT;
  UPDATE public.account_accounts SET security_version=security_version+1,
    updated_at=v_now WHERE id=v_a.id RETURNING * INTO v_a;
  INSERT INTO public.account_owner_events(account_id,action,note) VALUES(v_a.id,'tokens_revoke',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('accountId',v_a.id,'status',v_a.status,'securityVersion',v_a.security_version::text,
    'revokedTokens',v_tokens,'detachedLinks',v_links,'eventId',v_event,'updatedAt',v_a.updated_at);
END;
$function$;
CREATE FUNCTION public.account_owner_apply_password_reset(p_account_id uuid,p_expected_security_version bigint,p_password_hash text,p_password_format text,p_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_a public.account_accounts%ROWTYPE; v_now timestamptz; v_tokens integer:=0; v_links integer:=0; v_event uuid; v_parts text[];
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_note IS NULL OR pg_catalog.char_length(p_note)>500 OR pg_catalog.btrim(p_note)='' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NOTE'; END IF;
  IF p_account_id IS NULL OR p_expected_security_version IS NULL OR p_expected_security_version<=0 THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_INPUT'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2240',MESSAGE='ACCOUNT_OWNER_ACCOUNT_NOT_FOUND'; END IF;
  IF v_a.security_version<>p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE='P2241',MESSAGE='ACCOUNT_OWNER_STALE_SECURITY_VERSION'; END IF;
  IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
  IF p_password_format IS DISTINCT FROM 'nfc-argon2id-v1' OR p_password_hash IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_PASSWORD_FORMAT'; END IF;
  v_parts:=pg_catalog.regexp_match(p_password_hash,'^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$');
  IF v_parts IS NULL OR pg_catalog.char_length(p_password_hash)<>97 THEN RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_PASSWORD_HASH'; END IF;
  IF pg_catalog.octet_length(pg_catalog.decode(v_parts[1]||'==','base64'))<>16
    OR pg_catalog.octet_length(pg_catalog.decode(v_parts[2]||'=','base64'))<>32
    OR pg_catalog.rtrim(pg_catalog.encode(pg_catalog.decode(v_parts[1]||'==','base64'),'base64'),'=')<>v_parts[1]
    OR pg_catalog.rtrim(pg_catalog.encode(pg_catalog.decode(v_parts[2]||'=','base64'),'base64'),'=')<>v_parts[2] THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_PASSWORD_HASH'; END IF;
  PERFORM c.account_id FROM public.account_credentials c WHERE c.account_id=v_a.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2240',MESSAGE='ACCOUNT_OWNER_CREDENTIAL_NOT_FOUND'; END IF;
  PERFORM t.id FROM public.account_tokens t WHERE t.account_id=v_a.id ORDER BY t.id FOR UPDATE;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.account_id=v_a.id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_tokens SET revoked_at=v_now WHERE account_id=v_a.id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_tokens=ROW_COUNT;
  UPDATE public.account_session_links SET detached_at=v_now WHERE account_id=v_a.id AND detached_at IS NULL;
  GET DIAGNOSTICS v_links=ROW_COUNT;
  UPDATE public.account_credentials SET password_hash=p_password_hash,password_format=p_password_format,
    must_change_password=true,updated_at=v_now WHERE account_id=v_a.id;
  UPDATE public.account_accounts SET security_version=security_version+1,updated_at=v_now WHERE id=v_a.id RETURNING * INTO v_a;
  INSERT INTO public.account_owner_events(account_id,action,note) VALUES(v_a.id,'password_reset',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('accountId',v_a.id,'status',v_a.status,'securityVersion',v_a.security_version::text,
    'revokedTokens',v_tokens,'detachedLinks',v_links,'eventId',v_event,'updatedAt',v_a.updated_at);
END;
$function$;
CREATE FUNCTION public.account_owner_cleanup(p_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_now timestamptz:=pg_catalog.clock_timestamp(); v_cutoff timestamptz;
  v_tokens integer; v_links integer; v_rates integer; v_event uuid;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_note IS NULL OR pg_catalog.char_length(p_note)>500 OR pg_catalog.btrim(p_note)='' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NOTE'; END IF;
  -- Owner deletion must not cascade or trigger into unrelated data.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND c.relname IN ('account_accounts','account_credentials','account_tokens','account_session_links',
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass])))<>6
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n')) e(child,parent,conname,deletion)
      WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||e.child)
        AND c.confrelid=pg_catalog.to_regclass('public.'||e.parent) AND c.conname=e.conname AND c.contype='f'
        AND c.confdeltype::text=e.deletion AND c.convalidated AND NOT c.condeferrable)) THEN
    RAISE EXCEPTION 'Unexpected account foreign-key dependency or delete-action drift'; END IF;
  v_cutoff:=v_now-interval '7 days';
  WITH dead AS (SELECT l.session_id FROM public.account_session_links l WHERE l.detached_at<v_cutoff
    OR EXISTS (SELECT 1 FROM public.account_tokens t WHERE t.id=l.token_id AND (t.expires_at<v_cutoff OR t.revoked_at<v_cutoff))
    ORDER BY l.session_id LIMIT 100 FOR UPDATE OF l SKIP LOCKED)
  DELETE FROM public.account_session_links l USING dead d WHERE l.session_id=d.session_id;
  GET DIAGNOSTICS v_links=ROW_COUNT;
  WITH dead AS (SELECT t.id FROM public.account_tokens t WHERE (t.expires_at<v_cutoff OR t.revoked_at<v_cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.account_session_links l WHERE l.token_id=t.id)
    ORDER BY t.id LIMIT 100 FOR UPDATE OF t SKIP LOCKED)
  DELETE FROM public.account_tokens t USING dead d WHERE t.id=d.id;
  GET DIAGNOSTICS v_tokens=ROW_COUNT;
  v_rates:=public.account_cleanup_rate_limits();
  INSERT INTO public.account_owner_events(action,note) VALUES('cleanup',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('tokensDeleted',v_tokens,'linksDeleted',v_links,'rateLimitsDeleted',v_rates,'eventId',v_event,
    'tokensRemainingEligible',(SELECT count(*) FROM public.account_tokens WHERE expires_at<v_cutoff OR revoked_at<v_cutoff),
    'linksRemainingEligible',(SELECT count(*) FROM public.account_session_links l WHERE l.detached_at<v_cutoff
      OR EXISTS (SELECT 1 FROM public.account_tokens t WHERE t.id=l.token_id AND (t.expires_at<v_cutoff OR t.revoked_at<v_cutoff))),
    'rateLimitsRemainingEligible',(SELECT count(*) FROM public.account_rate_limits WHERE expires_at<=pg_catalog.clock_timestamp()));
END;
$function$;
CREATE FUNCTION public.account_owner_delete_development_accounts(p_account_ids uuid[],p_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET lock_timeout='2s'
AS $function$
DECLARE v_ids uuid[]; v_missing uuid[]; v_tokens integer; v_links integer; v_events integer;
  v_credentials integer; v_preferences integer; v_accounts integer; v_event uuid; v_now timestamptz;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  IF p_note IS NULL OR pg_catalog.char_length(p_note)>500 OR pg_catalog.btrim(p_note)='' THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_NOTE'; END IF;
  IF p_account_ids IS NULL OR pg_catalog.cardinality(p_account_ids) NOT BETWEEN 1 AND 20
    OR pg_catalog.array_ndims(p_account_ids)<>1 THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_UUID_ARRAY'; END IF;
  IF pg_catalog.array_position(p_account_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2242',MESSAGE='ACCOUNT_OWNER_INVALID_UUID_ARRAY'; END IF;

  -- Owner deletion must not cascade or trigger into unrelated data.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND c.relname IN ('account_accounts','account_credentials','account_tokens','account_session_links',
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass])))<>6
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n')) e(child,parent,conname,deletion)
      WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||e.child)
        AND c.confrelid=pg_catalog.to_regclass('public.'||e.parent) AND c.conname=e.conname AND c.contype='f'
        AND c.confdeltype::text=e.deletion AND c.convalidated AND NOT c.condeferrable)) THEN
    RAISE EXCEPTION 'Unexpected account foreign-key dependency or delete-action drift'; END IF;
  PERFORM a.id FROM public.account_accounts a WHERE a.id=ANY(p_account_ids) ORDER BY a.id FOR UPDATE;
  SELECT COALESCE(pg_catalog.array_agg(id ORDER BY id),'{}'::uuid[]) INTO v_ids FROM public.account_accounts WHERE id=ANY(p_account_ids);
  SELECT COALESCE(pg_catalog.array_agg(id ORDER BY id),'{}'::uuid[]) INTO v_missing
    FROM (SELECT DISTINCT id FROM pg_catalog.unnest(p_account_ids) x(id) WHERE NOT (id=ANY(v_ids))) missing;
  PERFORM t.id FROM public.account_tokens t WHERE t.account_id=ANY(v_ids) ORDER BY t.id FOR UPDATE;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.account_id=ANY(v_ids) ORDER BY l.session_id FOR UPDATE;
  v_now:=pg_catalog.clock_timestamp();
  UPDATE public.account_tokens SET revoked_at=COALESCE(revoked_at,v_now) WHERE account_id=ANY(v_ids);
  GET DIAGNOSTICS v_tokens=ROW_COUNT;
  UPDATE public.account_session_links SET detached_at=COALESCE(detached_at,v_now) WHERE account_id=ANY(v_ids);
  GET DIAGNOSTICS v_links=ROW_COUNT;
  SELECT count(*) INTO v_credentials FROM public.account_credentials WHERE account_id=ANY(v_ids);
  SELECT count(*) INTO v_preferences FROM public.account_preferences WHERE account_id=ANY(v_ids);
  DELETE FROM public.account_owner_events WHERE account_id=ANY(v_ids);
  GET DIAGNOSTICS v_events=ROW_COUNT;
  DELETE FROM public.account_accounts WHERE id=ANY(v_ids);
  GET DIAGNOSTICS v_accounts=ROW_COUNT;
  INSERT INTO public.account_owner_events(action,note) VALUES('cleanup',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('deletedAccountIds',v_ids,'missingAccountIds',v_missing,'accountsDeleted',v_accounts,
    'tokensDeleted',v_tokens,'linksDeleted',v_links,'credentialsDeleted',v_credentials,'preferencesDeleted',v_preferences,
    'ownerEventsDeleted',v_events,'eventId',v_event);
END;
$function$;
REVOKE ALL ON FUNCTION public.account_get_preferences(bytea) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_get_preferences(bytea) TO service_role;
REVOKE ALL ON FUNCTION public.account_update_preferences(bytea,jsonb,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_update_preferences(bytea,jsonb,bigint) TO service_role;
REVOKE ALL ON FUNCTION public.account_owner_lookup(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_owner_block(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_owner_unblock(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_owner_sign_out_everywhere(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_owner_apply_password_reset(uuid,bigint,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_owner_cleanup(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_owner_delete_development_accounts(uuid[],text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
