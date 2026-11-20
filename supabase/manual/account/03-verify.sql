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
FROM results ORDER BY sort_order, category, check_name;
