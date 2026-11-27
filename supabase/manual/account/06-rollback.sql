-- Set 06 rollback: stop consumers; postgres; backup first. No data-loss bypass.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $preconditions$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Set 06 rollback requires postgres'; END IF;
 IF EXISTS(SELECT 1 FROM (
-- Set 06 / 22F.1: one SELECT; twenty-three service and eight owner routines.
-- One SELECT / one result, postgres after set 06 forward.
-- Supersedes 05-verify; carries forward its schema, security and source guards.
WITH expected(signature, mutator, result_type, owner_only) AS (VALUES
  ('account_check_name(text,text,boolean)', false, 'void', false),
  ('account_link_session(text,uuid,uuid)', true, 'jsonb', false),
  ('account_read_credential(text)', false, 'jsonb', false),
  ('account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean)', true, 'jsonb', false),
  ('account_finish_signin(uuid,bigint,text,text,bytea,text)', true, 'jsonb', false),
  ('account_resume(bytea,text)', true, 'jsonb', false),
  ('account_logout(bytea)', true, 'void', false),
  ('account_change_password(uuid,bigint,text,text,text,text,bytea,text)', true, 'jsonb', false),
  ('account_rehash(uuid,bigint,text,text,text,text)', true, 'boolean', false),
  ('account_identity(bytea,text)', false, 'jsonb', false),
  ('account_name_status(text)', false, 'jsonb', false),
  ('account_rate_hit(jsonb,bytea)', true, 'jsonb', false),
  ('account_captcha_consume(bytea,boolean)', true, 'boolean', false),
  ('account_cleanup_rate_limits()', true, 'integer', false),
  ('account_get_preferences(bytea)', false, 'jsonb', false),
  ('account_update_preferences(bytea,jsonb,bigint)', true, 'jsonb', false),
  ('account_owner_lookup(text)', false, 'jsonb', true),
  ('account_owner_block(uuid,bigint,text)', true, 'jsonb', true),
  ('account_owner_unblock(uuid,bigint,text)', true, 'jsonb', true),
  ('account_owner_sign_out_everywhere(uuid,bigint,text)', true, 'jsonb', true),
  ('account_owner_apply_password_reset(uuid,bigint,text,text,text)', true, 'jsonb', true),
  ('account_owner_cleanup(text)', true, 'jsonb', true),
  ('account_owner_delete_development_accounts(uuid[],text)', true, 'jsonb', true),
 ('account_streak_reconcile(bytea,text)',true,'jsonb',false),
 ('account_streak_reset(bytea,text,bigint)',true,'jsonb',false),
 ('account_streak_commit_game(bytea,text,bigint,text,jsonb,jsonb,jsonb)',true,'jsonb',false),
 ('account_streak_import(bytea,text,bigint,text,jsonb,jsonb)',true,'jsonb',false),
 ('account_owner_streak_lookup(uuid)',false,'jsonb',true),
 ('account_get_mission_progress(bytea)',false,'jsonb',false),
 ('account_add_mission_progress(bytea,text[],text[])',true,'jsonb',false),
 ('account_reset_mission_progress(bytea)',true,'jsonb',false)
), functions AS (
  SELECT e.*, pg_catalog.to_regprocedure('public.' || e.signature)::oid AS oid
  FROM expected e
), account_tables(name) AS (VALUES
  ('account_accounts'),('account_credentials'),('account_tokens'),('account_session_links'),
  ('account_preferences'),('account_name_rules'),('account_rate_limits'),('account_owner_events'),('account_streak_runs'),('account_streak_imports')
), kv_tables(name) AS (VALUES
  ('kv_store_825e19ab'),('kv_store_825e19ab_pre_alpha_archive_20260429'),
  ('kv_store_2243ca4c'),('kv_store_67bdd4b5')
), relations AS (
  SELECT t.name, c.oid, c.relkind, c.relrowsecurity, c.relowner, c.relacl
  FROM (SELECT name FROM account_tables UNION ALL SELECT name FROM kv_tables) t
  LEFT JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass('public.' || t.name)
), checks(category, check_name, passed, detail) AS (
  SELECT 'schema','Exact rate scope constraint',EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.account_rate_limits'::regclass AND conname='account_rate_limits_scope_check' AND convalidated
      AND pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_expr(conbin,conrelid),'[[:space:]]','','g'),E'\r','')=pg_catalog.replace('(scope=ANY(ARRAY[''name_check_ip''::text,''name_check_target''::text,''claim_ip''::text,''claim_target''::text,''signin_ip''::text,''signin_failure_ip_target''::text,''signin_failure_target''::text,''account_token''::text,''account_unknown_ip''::text,''captcha_replay''::text,''name_check_global''::text,''claim_global''::text,''signin_global''::text,''password_global''::text,''resume_global''::text,''logout_global''::text,''preferences_global''::text]))',E'\r','')),
    'Set 03 vocabulary plus preferences_global only'
  UNION ALL
  SELECT 'execution','Verification role',current_user='postgres','Run as postgres'
  UNION ALL
  SELECT 'schema','Five boolean preferences and positive bigint revision',
    (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
      AND attname IN ('sound_enabled','health_flash_enabled','chat_minimized','battle_log_preferred','music_enabled')
      AND atttypid='boolean'::regtype AND attnotnull AND NOT attisdropped)=5
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
      AND attname='revision' AND atttypid='bigint'::regtype AND attnotnull AND NOT attisdropped)
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_preferences'::regclass
      AND conname='account_preferences_revision_check' AND convalidated AND pg_catalog.replace(pg_catalog.pg_get_expr(conbin,conrelid),E'\r','')=pg_catalog.replace('(revision > 0)',E'\r','')),
    'Preference schema retained'
  UNION ALL
  SELECT 'schema','No ordinary account triggers',NOT (EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND c.relname IN ('account_accounts','account_credentials','account_tokens','account_session_links',
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports'))),'Owner deletion cannot trigger unrelated changes'
  UNION ALL
  SELECT 'schema','Exact eight account foreign keys and delete actions',NOT ((SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')])))<>8
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n'),
 ('account_streak_runs','account_accounts','account_streak_runs_account_id_fkey','c'),
 ('account_streak_imports','account_accounts','account_streak_imports_account_id_fkey','n')) e(child,parent,conname,deletion)
      WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||e.child)
        AND c.confrelid=pg_catalog.to_regclass('public.'||e.parent) AND c.conname=e.conname AND c.contype='f'
        AND c.confdeltype::text=e.deletion AND c.convalidated AND NOT c.condeferrable))),'No unexpected cascade dependencies'
  UNION ALL
  SELECT 'functions', 'Exact set of thirty-one account functions',
    (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_') = 31
    AND NOT EXISTS (SELECT 1 FROM functions WHERE oid IS NULL)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_'
      AND NOT EXISTS (SELECT 1 FROM functions e WHERE e.oid = p.oid)),
    'Extra routines or overloads fail; all expected signatures must exist'
  UNION ALL
  SELECT 'functions', f.signature || ': invoker, result and configuration',
    COALESCE(NOT p.prosecdef AND p.prokind = 'f' AND pg_catalog.pg_get_function_result(p.oid) = f.result_type
      AND p.provolatile = CASE WHEN f.mutator THEN 'v'::"char" ELSE 's'::"char" END
      AND ARRAY(SELECT pg_catalog.replace(config,E'\r','') FROM pg_catalog.unnest(p.proconfig) config ORDER BY 1) =
        CASE WHEN f.mutator OR f.signature='account_get_mission_progress(bytea)' THEN ARRAY(SELECT pg_catalog.replace(setting,E'\r','') FROM pg_catalog.unnest(ARRAY['lock_timeout=2s','search_path=""']) setting ORDER BY 1) ELSE ARRAY(SELECT pg_catalog.replace(setting,E'\r','') FROM pg_catalog.unnest(ARRAY['search_path=""']) setting ORDER BY 1) END, false),
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
    COALESCE(pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') = (NOT f.owner_only), false)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE acl.is_grantable AND (acl.grantee = 0 OR pg_catalog.pg_has_role('service_role', acl.grantee, 'USAGE'))),
    'Service routines executable; owner routines denied, including inherited grants'
  FROM functions f LEFT JOIN pg_catalog.pg_proc p ON p.oid = f.oid
  UNION ALL
  SELECT 'tables', a.name || ': set 01 RLS/no-policy posture',
    COALESCE(r.relkind = 'r' AND r.relrowsecurity, false)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid = r.oid),
    'Expected RLS posture and no policies'
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
      CASE WHEN a.name = 'account_streak_runs' THEN ARRAY['INSERT','SELECT','UPDATE'] WHEN a.name = 'account_streak_imports' THEN ARRAY['INSERT','SELECT'] WHEN a.name = 'account_owner_events' THEN ARRAY['DELETE','INSERT','SELECT']
        ELSE ARRAY['DELETE','INSERT','SELECT','UPDATE'] END AND NOT pg_catalog.bool_or(is_grantable)
      FROM pg_catalog.aclexplode(COALESCE(r.relacl, pg_catalog.acldefault('r', r.relowner))) acl
      WHERE CASE WHEN acl.grantee = 0 THEN true ELSE pg_catalog.pg_has_role('service_role', acl.grantee, 'USAGE') END), false),
    'Exact minimum grants per account table'
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
      AND a.attnotnull AND pg_catalog.replace(pg_catalog.pg_get_expr(d.adbin,d.adrelid),E'\r','')=pg_catalog.replace('''{}''::text[]',E'\r',''))
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
      AND pg_catalog.pg_get_expr(conbin,conrelid) LIKE '%logout_global%'
      AND pg_catalog.pg_get_expr(conbin,conrelid) LIKE '%preferences_global%'),
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

UNION ALL
SELECT 'schema','account_streak_runs: exact columns',NOT EXISTS(WITH expected(name,type,not_null) AS(VALUES ('account_id','uuid',true),('run_id','uuid',true),('current_count','bigint',true),('revision','bigint',true),('tracked_game_id','text',false),('human_player_id','text',false),('tracked_status','text',false),('ended_count','bigint',false),('ending_game_id','text',false),('created_at','timestamp with time zone',true),('updated_at','timestamp with time zone',true)),actual AS(SELECT a.attname::text,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_runs') AND a.attnum>0 AND NOT a.attisdropped) (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_runs') AND a.attnum>0 AND NOT a.attisdropped AND (a.attidentity<>'' OR a.attgenerated<>'')),'Exact names, types and nullability; no generated/identity columns'
UNION ALL
SELECT 'schema','account_streak_runs: keys',EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_runs') AND c.contype='p' AND c.conkey=ARRAY[1::smallint]) AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_runs') AND c.contype='f' AND c.conkey=ARRAY[1::smallint] AND c.confkey=ARRAY[1::smallint]),'Account FK and primary key column identities'
UNION ALL
SELECT 'schema','account_streak_runs: exact CHECK constraints',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('account_streak_runs_current_count_check','current_count>=0 AND current_count<=9007199254740991'),('account_streak_runs_revision_check','revision>0'),('account_streak_runs_tracked_check','tracked_game_id IS NULL AND human_player_id IS NULL AND tracked_status IS NULL OR tracked_game_id IS NOT NULL AND tracked_game_id<>'''' AND human_player_id IS NOT NULL AND human_player_id<>'''' AND tracked_status IS NOT NULL AND (tracked_status=ANY(ARRAY[''unfinished'',''settled'',''retired'',''restart_pending'']))'),('account_streak_runs_ended_check','ended_count IS NULL AND ending_game_id IS NULL OR ended_count IS NOT NULL AND ended_count>=1 AND ended_count<=9007199254740991 AND ending_game_id IS NOT NULL AND ending_game_id<>''''')),actual AS(SELECT c.conname::text,pg_catalog.pg_get_expr(c.conbin,c.conrelid,true) AS expr FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_runs') AND c.contype='c' AND c.convalidated AND NOT c.condeferrable) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'Checked expressions, CR-normalised on both sides'
UNION ALL
SELECT 'schema','account_streak_runs: no extra constraints',(SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass('public.account_streak_runs'))=6,'Only primary key, account FK and reviewed CHECKs'
UNION ALL
SELECT 'schema','account_streak_runs: exact defaults',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('run_id','gen_random_uuid()'),('current_count','0'),('revision','1'),('created_at','now()'),('updated_at','now()')),actual AS(SELECT a.attname::text,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS expr FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_runs')) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'No unexpected defaults'
UNION ALL
SELECT 'schema','account_streak_imports: exact columns',NOT EXISTS(WITH expected(name,type,not_null) AS(VALUES ('anchor_game_id','text',true),('account_id','uuid',false),('anchor_human_player_id','text',true),('source_session_id','text',false),('reported_count','bigint',true),('accepted_count','bigint',true),('evidence_kind','text',true),('selection','text',true),('anchor_state_revision','bigint',true),('continuation','text',true),('consumed_at','timestamp with time zone',true)),actual AS(SELECT a.attname::text,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_imports') AND a.attnum>0 AND NOT a.attisdropped) (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_imports') AND a.attnum>0 AND NOT a.attisdropped AND (a.attidentity<>'' OR a.attgenerated<>'')),'Exact names, types and nullability; no generated/identity columns'
UNION ALL
SELECT 'schema','account_streak_imports: keys',EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_imports') AND c.contype='p' AND c.conkey=ARRAY[1::smallint]) AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_imports') AND c.contype='f' AND c.conkey=ARRAY[2::smallint] AND c.confkey=ARRAY[1::smallint]),'Account FK and primary key column identities'
UNION ALL
SELECT 'schema','account_streak_imports: exact CHECK constraints',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('account_streak_imports_anchor_game_id_check','anchor_game_id<>'''''),('account_streak_imports_anchor_human_player_id_check','anchor_human_player_id<>'''''),('account_streak_imports_reported_count_check','reported_count>=0 AND reported_count<=9007199254740991'),('account_streak_imports_accepted_count_check','accepted_count>=0 AND accepted_count<=9007199254740991'),('account_streak_imports_evidence_kind_check','evidence_kind=ANY(ARRAY[''direct_session'',''stored_anchor''])'),('account_streak_imports_selection_check','selection=ANY(ARRAY[''guest'',''account'',''declined''])'),('account_streak_imports_anchor_state_revision_check','anchor_state_revision>0'),('account_streak_imports_continuation_check','continuation=ANY(ARRAY[''none'',''authorised''])'),('account_streak_imports_proof_check','evidence_kind=''direct_session'' AND source_session_id IS NOT NULL AND source_session_id=anchor_human_player_id OR evidence_kind=''stored_anchor'' AND source_session_id IS NULL'),('account_streak_imports_authorised_check','continuation=''none'' OR evidence_kind=''direct_session'' AND selection=''guest''')),actual AS(SELECT c.conname::text,pg_catalog.pg_get_expr(c.conbin,c.conrelid,true) AS expr FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_imports') AND c.contype='c' AND c.convalidated AND NOT c.condeferrable) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'Checked expressions, CR-normalised on both sides'
UNION ALL
SELECT 'schema','account_streak_imports: no extra constraints',(SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass('public.account_streak_imports'))=12,'Only primary key, account FK and reviewed CHECKs'
UNION ALL
SELECT 'schema','account_streak_imports: exact defaults',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('consumed_at','now()')),actual AS(SELECT a.attname::text,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS expr FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_imports')) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'No unexpected defaults'
UNION ALL
SELECT 'schema','Exact streak indexes',NOT EXISTS(WITH expected(name,table_name,columns,is_unique) AS(VALUES ('account_streak_runs_pkey','account_streak_runs',ARRAY[1::smallint],true),('account_streak_imports_pkey','account_streak_imports',ARRAY[1::smallint],true),('account_streak_imports_account_consumed_idx','account_streak_imports',ARRAY[2::smallint,11::smallint],false)),actual AS(SELECT i.relname::text,t.relname::text,ARRAY(SELECT x FROM pg_catalog.unnest(idx.indkey::smallint[]) x),idx.indisunique FROM pg_catalog.pg_index idx JOIN pg_catalog.pg_class i ON i.oid=idx.indexrelid JOIN pg_catalog.pg_class t ON t.oid=idx.indrelid WHERE t.oid IN (pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')) AND idx.indisvalid AND idx.indisready AND idx.indpred IS NULL AND idx.indexprs IS NULL AND idx.indnatts=idx.indnkeyatts) (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)),'Only primary keys and account/consumption index'
UNION ALL
SELECT 'functions','account_check_name: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_name_key','p_moderation_key','p_check_reserved']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_check_name'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_link_session: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_session_id','p_account_id','p_token_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_link_session'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_read_credential: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_name_key']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_read_credential'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_claim: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_display_name','p_name_key','p_moderation_key','p_password_hash','p_password_format','p_token_hash','p_session_id','p_sound_enabled','p_health_flash_enabled','p_chat_minimized','p_battle_log_preferred','p_music_enabled']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_claim'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_finish_signin: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_expected_password_hash','p_expected_password_format','p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_finish_signin'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_resume: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_resume'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_logout: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_logout'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_change_password: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_expected_password_hash','p_expected_password_format','p_new_password_hash','p_new_password_format','p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_change_password'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_rehash: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_expected_password_hash','p_expected_password_format','p_new_password_hash','p_new_password_format']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rehash'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_identity: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_identity'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_name_status: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_display_name']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_name_status'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_rate_hit: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_buckets','p_token_hash']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rate_hit'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_captcha_consume: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_proof_hash','p_consume']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_captcha_consume'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_cleanup_rate_limits: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY[]::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_cleanup_rate_limits'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_get_preferences: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_get_preferences'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_update_preferences: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_patch','p_expected_revision']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_update_preferences'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_lookup: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_display_name']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_lookup'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_block: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_block'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_unblock: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_unblock'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_sign_out_everywhere: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_sign_out_everywhere'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_apply_password_reset: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_password_hash','p_password_format','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_apply_password_reset'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_cleanup: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_cleanup'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_delete_development_accounts: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_ids','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_delete_development_accounts'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_reconcile: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reconcile'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_reset: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id','p_expected_revision']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reset'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_commit_game: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id','p_expected_revision','p_action','p_game','p_history','p_source']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_commit_game'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_import: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id','p_expected_revision','p_decision','p_guest','p_adoption']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_import'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_streak_lookup: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_streak_lookup'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'schema','Streak indexes valid btree and default ordering',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid JOIN pg_catalog.pg_am am ON am.oid=i.relam WHERE x.indrelid IN (pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')) AND (NOT x.indisvalid OR NOT x.indisready OR am.amname<>'btree' OR EXISTS(SELECT 1 FROM pg_catalog.unnest(x.indoption::smallint[]) opt WHERE opt<>0))),'No hidden invalid indexes or changed ordering'
UNION ALL
SELECT 'access','Streak columns have no separate ACLs',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid IN (pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')) AND COALESCE(pg_catalog.cardinality(a.attacl),0)<>0),'Column grants cannot bypass minimum table privileges'
UNION ALL
SELECT 'schema','Exact account relation inventory',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND pg_catalog.left(c.relname,8)='account_' AND c.relkind IN ('r','p','v','m','f','S','c') AND c.relname NOT IN ('account_accounts','account_credentials','account_tokens','account_session_links','account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports')),'No later-set or unrelated account relations'
UNION ALL
SELECT 'source','account_check_name: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_check_name'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_link_session: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_l public.account_session_links%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_session_id IS NULL OR p_session_id = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_SESSION';
  END IF;
  -- Independently authorize direct service_role calls. Account before token before binding.
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID'; END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.id = p_token_id FOR UPDATE;
  IF NOT FOUND OR v_t.account_id <> v_a.id OR v_t.security_version <> v_a.security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID';
  END IF;
  IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P2208', MESSAGE = 'ACCOUNT_TOKEN_REVOKED'; END IF;
  IF v_t.expires_at <= pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE = 'P2207', MESSAGE = 'ACCOUNT_TOKEN_EXPIRED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  INSERT INTO public.account_session_links (session_id, account_id, token_id)
    VALUES (p_session_id, v_a.id, v_t.id) ON CONFLICT (session_id) DO NOTHING;
  SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id = p_session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  -- Recheck expiry after a possible binding wait.
  IF v_t.expires_at <= v_now THEN RAISE EXCEPTION USING ERRCODE = 'P2207', MESSAGE = 'ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_l.detached_at IS NULL AND v_l.account_id <> v_a.id AND EXISTS (
    SELECT 1 FROM public.account_tokens t JOIN public.account_accounts a ON a.id = t.account_id
    WHERE t.id = v_l.token_id AND t.account_id = v_l.account_id AND t.revoked_at IS NULL
      AND t.expires_at > v_now AND t.security_version = a.security_version AND a.status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2204', MESSAGE = 'ACCOUNT_SESSION_LINK_CONFLICT';
  END IF;
  UPDATE public.account_session_links SET account_id = v_a.id, token_id = v_t.id,
    linked_at = v_now, detached_at = NULL WHERE session_id = p_session_id;
  RETURN pg_catalog.jsonb_build_object('sessionId', p_session_id, 'accountId', v_a.id, 'displayName', v_a.display_name);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_link_session'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_read_credential: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_result jsonb;
BEGIN
  -- No status predicate or status-bearing error: verify before revealing a block.
  SELECT pg_catalog.jsonb_build_object(
    'accountId', a.id, 'displayName', a.display_name, 'securityVersion', a.security_version::text,
    'passwordHash', c.password_hash, 'passwordFormat', c.password_format,
    'mustChangePassword', c.must_change_password)
    INTO v_result FROM public.account_accounts a JOIN public.account_credentials c ON c.account_id = a.id
    WHERE a.name_key = p_name_key;
  RETURN v_result;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_read_credential'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_claim: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(22002, 1);
  IF p_name_key IS DISTINCT FROM pg_catalog.lower(p_display_name COLLATE "C")
    OR p_password_format IS DISTINCT FROM 'nfc-argon2id-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_CLAIM';
  END IF;
  PERFORM public.account_check_name(p_name_key, p_moderation_key, true);
  v_now := pg_catalog.clock_timestamp();
  BEGIN
    INSERT INTO public.account_accounts (display_name, created_at, updated_at)
      VALUES (p_display_name, v_now, v_now) RETURNING * INTO v_a;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'account_accounts_name_key_key' THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'ACCOUNT_NAME_TAKEN';
    END IF;
    RAISE;
  END;
  INSERT INTO public.account_credentials (account_id, password_hash, password_format, updated_at)
    VALUES (v_a.id, p_password_hash, p_password_format, v_now);
  INSERT INTO public.account_preferences (account_id, sound_enabled, health_flash_enabled, chat_minimized,
    battle_log_preferred, music_enabled, updated_at)
    VALUES (v_a.id, p_sound_enabled, p_health_flash_enabled, p_chat_minimized,
      p_battle_log_preferred, p_music_enabled, v_now);

  INSERT INTO public.account_tokens (account_id, token_hash, security_version, created_at, last_used_at, expires_at)
    VALUES (v_a.id, p_token_hash, v_a.security_version, v_now, v_now, v_now + interval '90 days') RETURNING * INTO v_t;
  v_link := public.account_link_session(p_session_id, v_a.id, v_t.id);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_claim'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_finish_signin: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN

  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY'; END IF;
  SELECT c.* INTO v_c FROM public.account_credentials c WHERE c.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_c.password_hash IS DISTINCT FROM p_expected_password_hash
    OR v_c.password_format IS DISTINCT FROM p_expected_password_format THEN
    RAISE EXCEPTION USING ERRCODE = 'P2203', MESSAGE = 'ACCOUNT_STALE_CREDENTIAL';
  END IF;
  IF v_a.security_version IS DISTINCT FROM p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY';
  END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  IF v_c.must_change_password THEN
    RAISE EXCEPTION USING ERRCODE = 'P2205', MESSAGE = 'ACCOUNT_PASSWORD_CHANGE_REQUIRED';
  END IF;
  v_now := pg_catalog.clock_timestamp();

  INSERT INTO public.account_tokens (account_id, token_hash, security_version, created_at, last_used_at, expires_at)
    VALUES (v_a.id, p_token_hash, v_a.security_version, v_now, v_now, v_now + interval '90 days') RETURNING * INTO v_t;
  v_link := public.account_link_session(p_session_id, v_a.id, v_t.id);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_finish_signin'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_resume: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN
  SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash = p_token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = v_a.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash = p_token_hash AND t.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_t.security_version <> v_a.security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID';
  END IF;
  IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P2208', MESSAGE = 'ACCOUNT_TOKEN_REVOKED'; END IF;
  v_now := pg_catalog.clock_timestamp();
  IF v_t.expires_at <= v_now THEN RAISE EXCEPTION USING ERRCODE = 'P2207', MESSAGE = 'ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  IF v_t.last_used_at < v_now - interval '1 hour' THEN
    UPDATE public.account_tokens SET last_used_at = v_now, expires_at = v_now + interval '90 days'
      WHERE id = v_t.id RETURNING * INTO v_t;
  END IF;
  IF p_session_id IS NOT NULL THEN v_link := public.account_link_session(p_session_id, v_a.id, v_t.id); END IF;

  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_resume'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_logout: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_account_id uuid; v_token_id uuid; v_now timestamptz;
BEGIN
  SELECT t.account_id INTO v_account_id FROM public.account_tokens t WHERE t.token_hash = p_token_hash;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM a.id FROM public.account_accounts a WHERE a.id = v_account_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT t.id INTO v_token_id FROM public.account_tokens t
    WHERE t.token_hash = p_token_hash AND t.account_id = v_account_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.token_id = v_token_id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_tokens SET revoked_at = COALESCE(revoked_at, v_now) WHERE id = v_token_id;
  UPDATE public.account_session_links SET detached_at = COALESCE(detached_at, v_now) WHERE token_id = v_token_id;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_logout'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_change_password: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN

  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY'; END IF;
  SELECT c.* INTO v_c FROM public.account_credentials c WHERE c.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_c.password_hash IS DISTINCT FROM p_expected_password_hash
    OR v_c.password_format IS DISTINCT FROM p_expected_password_format THEN
    RAISE EXCEPTION USING ERRCODE = 'P2203', MESSAGE = 'ACCOUNT_STALE_CREDENTIAL';
  END IF;
  IF v_a.security_version IS DISTINCT FROM p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY';
  END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  IF p_new_password_format IS DISTINCT FROM 'nfc-argon2id-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_PASSWORD_FORMAT';
  END IF;
  PERFORM t.id FROM public.account_tokens t WHERE t.account_id = v_a.id ORDER BY t.id FOR UPDATE;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.account_id = v_a.id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_credentials SET password_hash = p_new_password_hash, password_format = p_new_password_format,
    must_change_password = false, updated_at = v_now WHERE account_id = v_a.id;
  UPDATE public.account_accounts SET security_version = security_version + 1, updated_at = v_now
    WHERE id = v_a.id RETURNING * INTO v_a;
  UPDATE public.account_tokens SET revoked_at = COALESCE(revoked_at, v_now) WHERE account_id = v_a.id;
  UPDATE public.account_session_links SET detached_at = COALESCE(detached_at, v_now) WHERE account_id = v_a.id;

  INSERT INTO public.account_tokens (account_id, token_hash, security_version, created_at, last_used_at, expires_at)
    VALUES (v_a.id, p_token_hash, v_a.security_version, v_now, v_now, v_now + interval '90 days') RETURNING * INTO v_t;
  v_link := public.account_link_session(p_session_id, v_a.id, v_t.id);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_change_password'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_rehash: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_c public.account_credentials%ROWTYPE;
BEGIN
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'active' OR v_a.security_version IS DISTINCT FROM p_expected_security_version THEN RETURN false; END IF;
  SELECT c.* INTO v_c FROM public.account_credentials c WHERE c.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_c.password_hash IS DISTINCT FROM p_expected_password_hash
    OR v_c.password_format IS DISTINCT FROM p_expected_password_format THEN RETURN false; END IF;
  IF p_new_password_format IS DISTINCT FROM 'nfc-argon2id-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_PASSWORD_FORMAT';
  END IF;
  UPDATE public.account_credentials SET password_hash = p_new_password_hash, password_format = p_new_password_format,
    updated_at = pg_catalog.clock_timestamp() WHERE account_id = v_a.id;
  RETURN true;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rehash'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_identity: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE;
BEGIN
  SELECT a.* INTO v_a FROM public.account_accounts a JOIN public.account_tokens t ON t.account_id = a.id
    JOIN public.account_session_links l ON l.token_id = t.id AND l.account_id = a.id
    WHERE t.token_hash = p_token_hash AND t.revoked_at IS NULL AND t.expires_at > pg_catalog.statement_timestamp()
      AND t.security_version = a.security_version AND a.status = 'active'
      AND l.session_id = p_session_id AND l.detached_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  BEGIN
    PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  EXCEPTION WHEN SQLSTATE 'P2209' THEN RETURN NULL;
  END;
  RETURN pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name');
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_identity'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_name_status: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_name_status'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_rate_hit: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rate_hit'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_captcha_consume: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_captcha_consume'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_cleanup_rate_limits: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_cleanup_rate_limits'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_get_preferences: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_get_preferences'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_update_preferences: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_update_preferences'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_lookup: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_lookup'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_block: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_block'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_unblock: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_unblock'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_sign_out_everywhere: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_sign_out_everywhere'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_apply_password_reset: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_apply_password_reset'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_cleanup: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass])))<>8
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n'),
 ('account_streak_runs','account_accounts','account_streak_runs_account_id_fkey','c'),
 ('account_streak_imports','account_accounts','account_streak_imports_account_id_fkey','n')) e(child,parent,conname,deletion)
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
  RETURN pg_catalog.jsonb_build_object('streakRunsDeleted',0,'streakImportsAnonymized',0,'tokensDeleted',v_tokens,'linksDeleted',v_links,'rateLimitsDeleted',v_rates,'eventId',v_event,
    'tokensRemainingEligible',(SELECT count(*) FROM public.account_tokens WHERE expires_at<v_cutoff OR revoked_at<v_cutoff),
    'linksRemainingEligible',(SELECT count(*) FROM public.account_session_links l WHERE l.detached_at<v_cutoff
      OR EXISTS (SELECT 1 FROM public.account_tokens t WHERE t.id=l.token_id AND (t.expires_at<v_cutoff OR t.revoked_at<v_cutoff))),
    'rateLimitsRemainingEligible',(SELECT count(*) FROM public.account_rate_limits WHERE expires_at<=pg_catalog.clock_timestamp()));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_cleanup'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_delete_development_accounts: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_ids uuid[]; v_missing uuid[]; v_tokens integer; v_links integer; v_events integer;
  v_streak_runs integer; v_streak_imports integer; v_credentials integer; v_preferences integer; v_accounts integer; v_event uuid; v_now timestamptz;
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
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass])))<>8
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n'),
 ('account_streak_runs','account_accounts','account_streak_runs_account_id_fkey','c'),
 ('account_streak_imports','account_accounts','account_streak_imports_account_id_fkey','n')) e(child,parent,conname,deletion)
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
  SELECT count(*) INTO v_streak_runs FROM public.account_streak_runs WHERE account_id=ANY(v_ids);
  SELECT count(*) INTO v_streak_imports FROM public.account_streak_imports WHERE account_id=ANY(v_ids);
  DELETE FROM public.account_accounts WHERE id=ANY(v_ids);
  GET DIAGNOSTICS v_accounts=ROW_COUNT;
  INSERT INTO public.account_owner_events(action,note) VALUES('cleanup',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('deletedAccountIds',v_ids,'missingAccountIds',v_missing,'accountsDeleted',v_accounts,
    'tokensDeleted',v_tokens,'linksDeleted',v_links,'credentialsDeleted',v_credentials,'preferencesDeleted',v_preferences,
    'ownerEventsDeleted',v_events,'streakRunsDeleted',v_streak_runs,'streakImportsAnonymized',v_streak_imports,'eventId',v_event);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_delete_development_accounts'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_reconcile: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
  RETURN pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reconcile'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_reset: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR v_r.revision<>p_expected_revision THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  UPDATE public.account_streak_runs SET current_count=0,run_id=pg_catalog.gen_random_uuid(),
    tracked_status=CASE WHEN tracked_game_id IS NULL THEN NULL ELSE 'retired' END,
    ended_count=NULL,ending_game_id=NULL,revision=revision+1,updated_at=pg_catalog.clock_timestamp()
    WHERE account_id=v_a.id RETURNING * INTO v_r;
  RETURN pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reset'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_commit_game: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
  v_id text; v_source jsonb; v_preview jsonb; v_existing jsonb; v_update jsonb;
  v_head jsonb; v_next bigint; v_replacement text; v_source_h jsonb; v_recover boolean:=false; v_selected_source boolean;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  v_selected_source:=COALESCE(v_r.tracked_game_id=p_source->>'gameId' AND v_r.tracked_status IN ('unfinished','restart_pending'),false);
  v_id:=p_game#>>'{value,gameId}';
  SELECT k.value INTO v_preview FROM public.kv_store_825e19ab k WHERE k.key='game_'||(p_source->>'gameId');
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key=ANY(ARRAY[
    'game_'||v_r.tracked_game_id,'game_'||v_id,'game_'||(p_source->>'gameId'),
    'game_'||(v_preview#>>'{winStreakRestart,replacementGameId}')]) ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
  IF p_action IS NULL OR p_action NOT IN ('create','rematch','restart') THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF p_action='create' AND p_source IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF p_action IN ('rematch','restart') THEN
    SELECT k.value INTO v_source FROM public.kv_store_825e19ab k WHERE k.key='game_'||(p_source->>'gameId');
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2255',MESSAGE='STREAK_GAME_NOT_FOUND'; END IF;
    SELECT h INTO v_source_h FROM pg_catalog.jsonb_array_elements(v_source->'players') h WHERE h->>'id'=p_session_id AND h->>'role'='player';
    IF v_source_h IS NULL OR v_source#>>ARRAY['controllersByPlayerId',p_session_id,'kind'] IS DISTINCT FROM 'human'
      OR (v_source_h->>'accountId' IS NOT NULL AND v_source_h->>'accountId'<>v_a.id::text) THEN
      RAISE EXCEPTION USING ERRCODE='P2253',MESSAGE='STREAK_SEAT_FORBIDDEN'; END IF;
    -- A completed restart is replayable even after a different game becomes selected.
    IF p_action='restart' AND v_source#>>'{winStreakRestart,kind}'='source'
      AND v_source#>>'{winStreakRestart,status}'='completed' THEN
      v_replacement:=v_source#>>'{winStreakRestart,replacementGameId}';
      IF v_replacement IS DISTINCT FROM v_preview#>>'{winStreakRestart,replacementGameId}' THEN
        RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
      SELECT k.value INTO v_existing FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_replacement;
      IF v_existing#>>'{winStreakRestart,kind}' IS DISTINCT FROM 'replacement'
        OR v_existing#>>'{winStreakRestart,sourceGameId}' IS DISTINCT FROM p_source->>'gameId'
        OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_existing->'players') h
          WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text)
        OR v_existing#>>ARRAY['controllersByPlayerId',p_session_id,'kind'] IS DISTINCT FROM 'human' THEN
        RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
      RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_replacement,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
    END IF;
  END IF;
  SELECT k.value INTO v_existing FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_id;
  IF FOUND THEN
    v_recover:=COALESCE(p_action='restart' AND v_source#>>'{winStreakRestart,kind}'='source'
      AND v_source#>>'{winStreakRestart,status}'='pending' AND v_source#>>'{winStreakRestart,replacementGameId}'=v_id
      AND v_existing#>>'{winStreakRestart,kind}'='replacement' AND v_existing#>>'{winStreakRestart,sourceGameId}'=p_source->>'gameId'
      AND v_existing#>>ARRAY['controllersByPlayerId',p_session_id,'kind']='human'
      AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v_existing->'players') h WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text),false);
    IF v_recover AND NOT v_selected_source THEN
      RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_id,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
    END IF;
    IF v_r.tracked_game_id=v_id AND v_r.human_player_id=p_session_id AND EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_existing->'players') h WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text) THEN
      RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_id,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
    END IF;
    IF NOT v_recover THEN RAISE EXCEPTION USING ERRCODE='P2256',MESSAGE='STREAK_GAME_ID_TAKEN'; END IF;
  END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR v_r.revision<>p_expected_revision THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  v_next:=CASE WHEN p_action='restart' OR (v_r.tracked_status IN ('unfinished','restart_pending') AND v_r.human_player_id=p_session_id)
    THEN 0 ELSE v_r.current_count END;
  v_g:=p_game->'value'; v_head:=p_game->'game_head';
  IF p_game->>'key' IS DISTINCT FROM 'game_'||v_id OR v_id IS NULL OR v_id=''
    OR pg_catalog.jsonb_typeof(v_g->'gameId') IS DISTINCT FROM 'string'
    OR v_g->'stateRevision' IS DISTINCT FROM '1'::jsonb OR v_g->>'status' IS DISTINCT FROM 'active'
    OR pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h
    WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text AND h->>'role'='player';
  SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||v_id AND b->>'role'='player';
  IF v_h IS NULL OR v_b IS NULL OR p_session_id='bot_'||v_id
    OR v_g#>>ARRAY['controllersByPlayerId',p_session_id,'kind'] IS DISTINCT FROM 'human'
    OR v_g#>>ARRAY['controllersByPlayerId','bot_'||v_id,'kind'] IS DISTINCT FROM 'bot'
    OR v_g#>'{gameData,winStreakBonus,appliedCount}' IS DISTINCT FROM pg_catalog.to_jsonb(v_next)
    OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM 'bot_'||v_id
    OR v_head->>'gameId' IS DISTINCT FROM v_id OR v_head->'stateRevision' IS DISTINCT FROM v_g->'stateRevision'
    OR v_head->>'status' IS DISTINCT FROM v_g->>'status'
    OR p_history->>'key' IS DISTINCT FROM 'game_history_'||v_id OR p_history#>>'{value,gameId}' IS DISTINCT FROM v_id
    OR p_history#>'{value,revision}' IS DISTINCT FROM '0'::jsonb
    OR p_history#>'{value,completedTurnCount}' IS DISTINCT FROM '0'::jsonb
    OR p_history#>'{value,turns}' IS DISTINCT FROM '[]'::jsonb
    OR p_history#>'{value,currentTurnCapture}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF p_action IN ('rematch','restart') THEN
    IF (p_source->'expectedRevision'='null'::jsonb AND v_source ? 'stateRevision')
      OR (p_source->'expectedRevision' IS DISTINCT FROM 'null'::jsonb AND v_source->'stateRevision' IS DISTINCT FROM p_source->'expectedRevision')
      OR NOT (p_source ? 'expectedRevision') THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    IF p_action='rematch' AND (v_source->>'status' IS DISTINCT FROM 'finished' OR v_source->>'resultReason'='restart'
      OR v_source#>>'{winStreakRestart,kind}'='source') THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    v_update:=NULLIF(p_source->'update','null'::jsonb);
    IF p_action='restart' AND (v_update IS NULL OR v_update#>>'{value,status}' IS DISTINCT FROM 'finished'
      OR v_update#>>'{value,resultReason}' IS DISTINCT FROM 'restart'
      OR v_update#>>'{value,winStreakRestart,kind}' IS DISTINCT FROM 'source'
      OR v_update#>>'{value,winStreakRestart,status}' IS DISTINCT FROM 'completed'
      OR v_update#>>'{value,winStreakRestart,replacementGameId}' IS DISTINCT FROM v_id
      OR v_g#>>'{winStreakRestart,kind}' IS DISTINCT FROM 'replacement'
      OR v_g#>>'{winStreakRestart,sourceGameId}' IS DISTINCT FROM p_source->>'gameId') THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    IF v_update IS NOT NULL THEN
      IF v_update->>'key' IS DISTINCT FROM 'game_'||(p_source->>'gameId')
        OR v_update#>>'{value,gameId}' IS DISTINCT FROM p_source->>'gameId'
        OR v_update#>'{value,players}' IS DISTINCT FROM v_source->'players'
        OR v_update#>'{value,controllersByPlayerId}' IS DISTINCT FROM v_source->'controllersByPlayerId'
        OR v_update#>'{value,stateRevision}' IS DISTINCT FROM pg_catalog.to_jsonb(COALESCE((v_source->>'stateRevision')::bigint,1)+1)
        OR v_update#>>'{game_head,gameId}' IS DISTINCT FROM p_source->>'gameId'
        OR v_update#>'{game_head,stateRevision}' IS DISTINCT FROM v_update#>'{value,stateRevision}'
        OR v_update#>>'{game_head,status}' IS DISTINCT FROM v_update#>>'{value,status}' THEN
        RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
      UPDATE public.kv_store_825e19ab SET value=v_update->'value',game_head=v_update->'game_head'
        WHERE key='game_'||(p_source->>'gameId') AND ((p_source->'expectedRevision'='null'::jsonb AND NOT (value ? 'stateRevision'))
          OR value->'stateRevision'=p_source->'expectedRevision');
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    END IF;
  END IF;
  IF NOT v_recover THEN
    INSERT INTO public.kv_store_825e19ab(key,value,game_head) VALUES(p_game->>'key',v_g,v_head) ON CONFLICT(key) DO NOTHING;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2256',MESSAGE='STREAK_GAME_ID_TAKEN'; END IF;
  END IF;
  INSERT INTO public.kv_store_825e19ab(key,value) VALUES(p_history->>'key',p_history->'value') ON CONFLICT(key) DO NOTHING;
  IF NOT FOUND AND (NOT v_recover OR NOT EXISTS(SELECT 1 FROM public.kv_store_825e19ab k WHERE k.key=p_history->>'key' AND k.value->>'gameId'=v_id)) THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  UPDATE public.account_streak_runs SET current_count=v_next,
    run_id=CASE WHEN p_action='restart' OR (tracked_status IN ('unfinished','restart_pending') AND human_player_id=p_session_id)
      THEN pg_catalog.gen_random_uuid() ELSE run_id END,
    tracked_game_id=v_id,human_player_id=p_session_id,tracked_status='unfinished',ended_count=NULL,ending_game_id=NULL,
    revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
  RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_id,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_commit_game'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_import: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
  v_i public.account_streak_imports%ROWTYPE; v_anchor text; v_human text;
  v_reported bigint; v_local bigint; v_accepted bigint; v_selection text; v_continuation text:='none';
  v_direct boolean; v_update jsonb; v_new_h jsonb; v_new_b jsonb; v_anchor_revision bigint;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  v_anchor:=p_guest->>'anchorGameId'; v_human:=p_guest->>'humanPlayerId';
  IF v_anchor IS NULL OR v_anchor='' OR v_human IS NULL OR v_human=''
    OR p_decision IS NULL OR p_decision NOT IN ('compare','decline')
    OR pg_catalog.jsonb_typeof(p_guest->'currentCount') IS DISTINCT FROM 'number'
    OR (p_guest->>'currentCount') !~ '^[0-9]{1,16}$'
    OR pg_catalog.jsonb_typeof(p_guest->'resultPending') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  v_reported:=(p_guest->>'currentCount')::bigint;
  IF v_reported>9007199254740991 THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key=ANY(ARRAY['game_'||v_r.tracked_game_id,'game_'||v_anchor]) ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
  -- Anchor row lock precedes tombstone lookup and eligibility, including after adoption.
  SELECT i.* INTO v_i FROM public.account_streak_imports i WHERE i.anchor_game_id=v_anchor;
  IF FOUND THEN
 IF v_i.account_id IS DISTINCT FROM v_a.id THEN RAISE EXCEPTION USING ERRCODE='P2252',MESSAGE='STREAK_IMPORT_CONSUMED'; END IF;
 RETURN pg_catalog.jsonb_build_object('streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at),'import',pg_catalog.jsonb_build_object('anchorGameId',v_i.anchor_game_id,'selection',v_i.selection,'acceptedCount',v_i.accepted_count,'continuation',v_i.continuation));
  END IF;
  SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_anchor;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2255',MESSAGE='STREAK_GAME_NOT_FOUND'; END IF;
  v_expected_human:=v_human;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 END IF;
  IF v_outcome='restart' THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  IF v_g->>'gameId' IS DISTINCT FROM v_anchor THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  IF v_h->>'accountId' IS NOT NULL OR EXISTS (SELECT 1 FROM public.account_streak_runs r WHERE r.tracked_game_id=v_anchor) THEN
    RAISE EXCEPTION USING ERRCODE='P2252',MESSAGE='STREAK_IMPORT_CONSUMED'; END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR v_r.revision<>p_expected_revision THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  v_local:=v_reported;
  IF v_outcome='win' AND (p_guest->>'resultPending')::boolean THEN v_local:=LEAST(9007199254740991,v_local+1); END IF;
  v_accepted:=CASE WHEN v_outcome='loss' THEN 0 ELSE LEAST(v_local,v_bonus+CASE WHEN v_outcome='win' THEN 1 ELSE 0 END) END;
  v_accepted:=LEAST(9007199254740991,v_accepted);
  v_selection:=CASE WHEN p_decision='decline' THEN 'declined' WHEN v_accepted>v_r.current_count THEN 'guest' ELSE 'account' END;
  v_direct:=v_human=p_session_id;
  IF v_selection='guest' AND v_outcome IS NULL AND v_direct THEN
    v_continuation:='authorised'; v_update:=NULLIF(p_adoption->'update','null'::jsonb);
    IF p_adoption->>'gameId' IS DISTINCT FROM v_anchor OR v_update IS NULL
      OR NOT (p_adoption ? 'expectedRevision')
      OR (p_adoption->'expectedRevision'='null'::jsonb AND v_g ? 'stateRevision')
      OR (p_adoption->'expectedRevision' IS DISTINCT FROM 'null'::jsonb AND p_adoption->'expectedRevision' IS DISTINCT FROM v_g->'stateRevision')
      OR v_update->>'key' IS DISTINCT FROM 'game_'||v_anchor
      OR v_update#>>'{value,gameId}' IS DISTINCT FROM v_anchor
      OR v_update#>'{value,stateRevision}' IS DISTINCT FROM pg_catalog.to_jsonb(COALESCE((v_g->>'stateRevision')::bigint,1)+1)
      OR (v_update->'value')-'players'-'stateRevision' IS DISTINCT FROM v_g-'players'-'stateRevision'
      OR pg_catalog.jsonb_array_length(v_update#>'{value,players}') IS DISTINCT FROM 2
      OR v_update#>>'{game_head,gameId}' IS DISTINCT FROM v_anchor
      OR v_update#>'{game_head,stateRevision}' IS DISTINCT FROM v_update#>'{value,stateRevision}'
      OR v_update#>>'{game_head,status}' IS DISTINCT FROM v_g->>'status' THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    SELECT h INTO v_new_h FROM pg_catalog.jsonb_array_elements(v_update#>'{value,players}') h WHERE h->>'id'=v_human;
    SELECT b INTO v_new_b FROM pg_catalog.jsonb_array_elements(v_update#>'{value,players}') b WHERE b->>'id'=v_b->>'id';
    IF v_new_h-'accountId' IS DISTINCT FROM v_h-'accountId' OR v_new_h->>'accountId' IS DISTINCT FROM v_a.id::text OR v_new_b IS DISTINCT FROM v_b THEN
      RAISE EXCEPTION USING ERRCODE='P2253',MESSAGE='STREAK_SEAT_FORBIDDEN'; END IF;
  END IF;
  IF NOT v_direct AND p_adoption IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2253',MESSAGE='STREAK_SEAT_FORBIDDEN'; END IF;
  v_anchor_revision:=COALESCE((v_g->>'stateRevision')::bigint,1);
  -- Reserve consumption before any adoption/selection writes. Only this PK conflict is replay.
  INSERT INTO public.account_streak_imports(anchor_game_id,account_id,anchor_human_player_id,source_session_id,
    reported_count,accepted_count,evidence_kind,selection,anchor_state_revision,continuation)
  VALUES(v_anchor,v_a.id,v_human,CASE WHEN v_direct THEN p_session_id END,v_reported,v_accepted,
    CASE WHEN v_direct THEN 'direct_session' ELSE 'stored_anchor' END,v_selection,v_anchor_revision,v_continuation)
  ON CONFLICT(anchor_game_id) DO NOTHING RETURNING * INTO v_i;
  IF NOT FOUND THEN
    SELECT i.* INTO STRICT v_i FROM public.account_streak_imports i WHERE i.anchor_game_id=v_anchor;
 IF v_i.account_id IS DISTINCT FROM v_a.id THEN RAISE EXCEPTION USING ERRCODE='P2252',MESSAGE='STREAK_IMPORT_CONSUMED'; END IF;
 RETURN pg_catalog.jsonb_build_object('streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at),'import',pg_catalog.jsonb_build_object('anchorGameId',v_i.anchor_game_id,'selection',v_i.selection,'acceptedCount',v_i.accepted_count,'continuation',v_i.continuation));
  END IF;
  IF v_continuation='authorised' THEN
    UPDATE public.kv_store_825e19ab SET value=v_update->'value',game_head=v_update->'game_head'
      WHERE key='game_'||v_anchor AND ((p_adoption->'expectedRevision'='null'::jsonb AND NOT (value ? 'stateRevision'))
        OR value->'stateRevision'=p_adoption->'expectedRevision');
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  END IF;
  IF v_selection='guest' THEN
    UPDATE public.account_streak_runs SET current_count=v_accepted,run_id=pg_catalog.gen_random_uuid(),
      tracked_game_id=CASE WHEN v_continuation='authorised' THEN v_anchor END,
      human_player_id=CASE WHEN v_continuation='authorised' THEN v_human END,
      tracked_status=CASE WHEN v_continuation='authorised' THEN 'unfinished' END,
      ended_count=NULL,ending_game_id=NULL,revision=revision+1,updated_at=pg_catalog.clock_timestamp()
      WHERE account_id=v_a.id RETURNING * INTO v_r;
  END IF;
  RETURN pg_catalog.jsonb_build_object('streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at),'import',pg_catalog.jsonb_build_object('anchorGameId',v_i.anchor_game_id,'selection',v_i.selection,'acceptedCount',v_i.accepted_count,'continuation',v_i.continuation));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_import'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_streak_lookup: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  RETURN pg_catalog.jsonb_build_object('run',(SELECT pg_catalog.to_jsonb(r) FROM public.account_streak_runs r WHERE r.account_id=p_account_id),
    'imports',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.consumed_at DESC,i.anchor_game_id)
      FROM (SELECT * FROM public.account_streak_imports WHERE account_id=p_account_id ORDER BY consumed_at DESC,anchor_game_id LIMIT 100) i),'[]'::jsonb));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_streak_lookup'),false),'Source pinned to reviewed scripts'

  UNION ALL
  SELECT 'schema','Mission progress column and exact default',
    EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.account_preferences'::regclass AND a.attname='mission_progress'
        AND a.atttypid='jsonb'::regtype AND a.attnotnull AND NOT a.attisdropped AND a.attidentity='' AND a.attgenerated=''
        AND pg_catalog.replace(pg_catalog.pg_get_expr(d.adbin,d.adrelid),E'\r','')=
          pg_catalog.replace($default$'{"findings": [], "missions": []}'::jsonb$default$,E'\r','')),
    'One NOT NULL jsonb column; existing rows and omitted inserts receive the empty default'
  UNION ALL
  SELECT 'schema','Mission progress named CHECK text',
    EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='public.account_preferences'::regclass
      AND c.conname='account_preferences_mission_progress_check' AND c.contype='c' AND c.convalidated
      AND NOT c.connoinherit
      AND pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.pg_get_expr(c.conbin,c.conrelid),E'\r',''),'pg_catalog.',''),'[[:space:]()]','','g')=
        pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace($check$
jsonb_typeof(mission_progress)='object'::text
    AND mission_progress ?& ARRAY['missions'::text,'findings'::text]
    AND mission_progress - 'missions'::text - 'findings'::text = '{}'::jsonb
    AND jsonb_typeof(mission_progress->'missions'::text)='array'::text
    AND jsonb_typeof(mission_progress->'findings'::text)='array'::text
    AND octet_length(mission_progress::text)<=16384
$check$,E'\r',''),'pg_catalog.',''),'[[:space:]()]','','g')),
    'Pinned deparser-normalized expression: exact object keys, arrays and 16384-byte cap; no subqueries'
  UNION ALL
  SELECT 'functions','account_get_mission_progress(bytea): postgres owner and exact argument names',
    COALESCE((SELECT p.proowner='postgres'::regrole AND p.pronargdefaults=0 AND p.provariadic=0
      AND p.proargmodes IS NULL AND NOT p.proisstrict AND p.proargnames=ARRAY['p_token_hash']::text[]
      FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.account_get_mission_progress(bytea)')),false),
    'Owner and named PostgREST inputs are pinned'
  UNION ALL
  SELECT 'source','account_get_mission_progress(bytea): exact CR-normalised body',
    COALESCE((SELECT pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
  RETURN v_p.mission_progress;
END;
$expected$,E'\r','')
      FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.account_get_mission_progress(bytea)')),false),
    'Source pinned to reviewed set 06'
  UNION ALL
  SELECT 'functions','account_add_mission_progress(bytea,text[],text[]): postgres owner and exact argument names',
    COALESCE((SELECT p.proowner='postgres'::regrole AND p.pronargdefaults=0 AND p.provariadic=0
      AND p.proargmodes IS NULL AND NOT p.proisstrict AND p.proargnames=ARRAY['p_token_hash','p_missions','p_findings']::text[]
      FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.account_add_mission_progress(bytea,text[],text[])')),false),
    'Owner and named PostgREST inputs are pinned'
  UNION ALL
  SELECT 'source','account_add_mission_progress(bytea,text[],text[]): exact CR-normalised body',
    COALESCE((SELECT pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE; v_p public.account_preferences%ROWTYPE;
  v_key text; v_list jsonb; v_result jsonb := '{}';
BEGIN
  IF p_missions IS NULL OR p_findings IS NULL
    OR pg_catalog.cardinality(p_missions)>100 OR pg_catalog.cardinality(p_findings)>100
    OR COALESCE(pg_catalog.array_ndims(p_missions),1)<>1 OR COALESCE(pg_catalog.array_ndims(p_findings),1)<>1 THEN
    RAISE EXCEPTION USING ERRCODE='P2212',MESSAGE='ACCOUNT_INVALID_PREFERENCE_INPUT'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(p_missions || p_findings) e(id)
    WHERE e.id IS NULL OR e.id COLLATE "C" !~ '^[a-z0-9][a-z0-9-]{0,79}$') THEN
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
  FOREACH v_key IN ARRAY ARRAY['missions','findings'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(merged.id ORDER BY merged.first_position),'[]'::jsonb) INTO v_list
    FROM (
      SELECT ids.id,pg_catalog.min(ids.position) AS first_position
      FROM (
        SELECT old.value AS id,old.ordinality AS position
        FROM pg_catalog.jsonb_array_elements_text(v_p.mission_progress->v_key) WITH ORDINALITY old(value,ordinality)
        UNION ALL
        SELECT added.id,pg_catalog.jsonb_array_length(v_p.mission_progress->v_key)+added.ordinality
        FROM pg_catalog.unnest(CASE WHEN v_key='missions' THEN p_missions ELSE p_findings END)
          WITH ORDINALITY added(id,ordinality)
      ) ids GROUP BY ids.id
    ) merged;
    IF pg_catalog.jsonb_array_length(v_list)>100 THEN
      RAISE EXCEPTION USING ERRCODE='P2212',MESSAGE='ACCOUNT_INVALID_PREFERENCE_INPUT'; END IF;
    v_result:=v_result || pg_catalog.jsonb_build_object(v_key,v_list);
  END LOOP;
  IF pg_catalog.octet_length(v_result::text)>16384 THEN
    RAISE EXCEPTION USING ERRCODE='P2212',MESSAGE='ACCOUNT_INVALID_PREFERENCE_INPUT'; END IF;
  IF v_result IS DISTINCT FROM v_p.mission_progress THEN
    UPDATE public.account_preferences SET mission_progress=v_result WHERE account_id=v_a.id;
  END IF;
  RETURN v_result;
END;
$expected$,E'\r','')
      FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.account_add_mission_progress(bytea,text[],text[])')),false),
    'Source pinned to reviewed set 06'
  UNION ALL
  SELECT 'functions','account_reset_mission_progress(bytea): postgres owner and exact argument names',
    COALESCE((SELECT p.proowner='postgres'::regrole AND p.pronargdefaults=0 AND p.provariadic=0
      AND p.proargmodes IS NULL AND NOT p.proisstrict AND p.proargnames=ARRAY['p_token_hash']::text[]
      FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.account_reset_mission_progress(bytea)')),false),
    'Owner and named PostgREST inputs are pinned'
  UNION ALL
  SELECT 'source','account_reset_mission_progress(bytea): exact CR-normalised body',
    COALESCE((SELECT pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE; v_p public.account_preferences%ROWTYPE;
  v_result jsonb;
BEGIN
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
  UPDATE public.account_preferences SET mission_progress='{"missions":[],"findings":[]}'::jsonb
    WHERE account_id=v_a.id RETURNING mission_progress INTO v_result;
  RETURN v_result;
END;
$expected$,E'\r','')
      FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.account_reset_mission_progress(bytea)')),false),
    'Source pinned to reviewed set 06'
), results AS (
  SELECT 0 AS sort_order, 'overall' AS category, 'SET 06' AS check_name,
    bool_and(COALESCE(passed, false)) AS passed,
    count(*) FILTER (WHERE NOT COALESCE(passed, false))::text || ' failing checks' AS detail FROM checks
  UNION ALL SELECT 1, category, check_name, COALESCE(passed, false), detail FROM checks
)
SELECT category, check_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, detail
FROM results ORDER BY sort_order, category, check_name
) checked WHERE result<>'PASS') THEN RAISE EXCEPTION 'Set 06 rollback requires exact set 06'; END IF;
END; $preconditions$;
LOCK TABLE public.account_preferences IN ACCESS EXCLUSIVE MODE;
DO $data_guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.account_preferences
   WHERE mission_progress IS DISTINCT FROM '{"missions":[],"findings":[]}'::jsonb) THEN
   RAISE EXCEPTION 'Mission progress is populated; restore from backup instead'; END IF;
END; $data_guard$;
DROP FUNCTION public.account_get_mission_progress(bytea) RESTRICT;
DROP FUNCTION public.account_add_mission_progress(bytea,text[],text[]) RESTRICT;
DROP FUNCTION public.account_reset_mission_progress(bytea) RESTRICT;
ALTER TABLE public.account_preferences DROP COLUMN mission_progress RESTRICT;
DO $restored$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
   AND attname='mission_progress' AND NOT attisdropped)
   OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_preferences'::regclass
     AND conname='account_preferences_mission_progress_check')
   OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('account_get_mission_progress','account_add_mission_progress','account_reset_mission_progress')) THEN
   RAISE EXCEPTION 'Set 06 mission progress objects must be absent'; END IF;
 IF EXISTS(SELECT 1 FROM (
-- Set 05: one SELECT, twenty service and eight owner routines.
-- One SELECT / one result, postgres after set 05 forward.
-- Supersedes 04-verify; expects twenty service and eight owner routines.
WITH expected(signature, mutator, result_type, owner_only) AS (VALUES
  ('account_check_name(text,text,boolean)', false, 'void', false),
  ('account_link_session(text,uuid,uuid)', true, 'jsonb', false),
  ('account_read_credential(text)', false, 'jsonb', false),
  ('account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean)', true, 'jsonb', false),
  ('account_finish_signin(uuid,bigint,text,text,bytea,text)', true, 'jsonb', false),
  ('account_resume(bytea,text)', true, 'jsonb', false),
  ('account_logout(bytea)', true, 'void', false),
  ('account_change_password(uuid,bigint,text,text,text,text,bytea,text)', true, 'jsonb', false),
  ('account_rehash(uuid,bigint,text,text,text,text)', true, 'boolean', false),
  ('account_identity(bytea,text)', false, 'jsonb', false),
  ('account_name_status(text)', false, 'jsonb', false),
  ('account_rate_hit(jsonb,bytea)', true, 'jsonb', false),
  ('account_captcha_consume(bytea,boolean)', true, 'boolean', false),
  ('account_cleanup_rate_limits()', true, 'integer', false),
  ('account_get_preferences(bytea)', false, 'jsonb', false),
  ('account_update_preferences(bytea,jsonb,bigint)', true, 'jsonb', false),
  ('account_owner_lookup(text)', false, 'jsonb', true),
  ('account_owner_block(uuid,bigint,text)', true, 'jsonb', true),
  ('account_owner_unblock(uuid,bigint,text)', true, 'jsonb', true),
  ('account_owner_sign_out_everywhere(uuid,bigint,text)', true, 'jsonb', true),
  ('account_owner_apply_password_reset(uuid,bigint,text,text,text)', true, 'jsonb', true),
  ('account_owner_cleanup(text)', true, 'jsonb', true),
  ('account_owner_delete_development_accounts(uuid[],text)', true, 'jsonb', true),
 ('account_streak_reconcile(bytea,text)',true,'jsonb',false),
 ('account_streak_reset(bytea,text,bigint)',true,'jsonb',false),
 ('account_streak_commit_game(bytea,text,bigint,text,jsonb,jsonb,jsonb)',true,'jsonb',false),
 ('account_streak_import(bytea,text,bigint,text,jsonb,jsonb)',true,'jsonb',false),
 ('account_owner_streak_lookup(uuid)',false,'jsonb',true)
), functions AS (
  SELECT e.*, pg_catalog.to_regprocedure('public.' || e.signature)::oid AS oid
  FROM expected e
), account_tables(name) AS (VALUES
  ('account_accounts'),('account_credentials'),('account_tokens'),('account_session_links'),
  ('account_preferences'),('account_name_rules'),('account_rate_limits'),('account_owner_events'),('account_streak_runs'),('account_streak_imports')
), kv_tables(name) AS (VALUES
  ('kv_store_825e19ab'),('kv_store_825e19ab_pre_alpha_archive_20260429'),
  ('kv_store_2243ca4c'),('kv_store_67bdd4b5')
), relations AS (
  SELECT t.name, c.oid, c.relkind, c.relrowsecurity, c.relowner, c.relacl
  FROM (SELECT name FROM account_tables UNION ALL SELECT name FROM kv_tables) t
  LEFT JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass('public.' || t.name)
), checks(category, check_name, passed, detail) AS (
  SELECT 'schema','Exact rate scope constraint',EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.account_rate_limits'::regclass AND conname='account_rate_limits_scope_check' AND convalidated
      AND pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_expr(conbin,conrelid),'[[:space:]]','','g'),E'\r','')=pg_catalog.replace('(scope=ANY(ARRAY[''name_check_ip''::text,''name_check_target''::text,''claim_ip''::text,''claim_target''::text,''signin_ip''::text,''signin_failure_ip_target''::text,''signin_failure_target''::text,''account_token''::text,''account_unknown_ip''::text,''captcha_replay''::text,''name_check_global''::text,''claim_global''::text,''signin_global''::text,''password_global''::text,''resume_global''::text,''logout_global''::text,''preferences_global''::text]))',E'\r','')),
    'Set 03 vocabulary plus preferences_global only'
  UNION ALL
  SELECT 'execution','Verification role',current_user='postgres','Run as postgres'
  UNION ALL
  SELECT 'schema','Five boolean preferences and positive bigint revision',
    (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
      AND attname IN ('sound_enabled','health_flash_enabled','chat_minimized','battle_log_preferred','music_enabled')
      AND atttypid='boolean'::regtype AND attnotnull AND NOT attisdropped)=5
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.account_preferences'::regclass
      AND attname='revision' AND atttypid='bigint'::regtype AND attnotnull AND NOT attisdropped)
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.account_preferences'::regclass
      AND conname='account_preferences_revision_check' AND convalidated AND pg_catalog.replace(pg_catalog.pg_get_expr(conbin,conrelid),E'\r','')=pg_catalog.replace('(revision > 0)',E'\r','')),
    'Preference schema retained'
  UNION ALL
  SELECT 'schema','No ordinary account triggers',NOT (EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND c.relname IN ('account_accounts','account_credentials','account_tokens','account_session_links',
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports'))),'Owner deletion cannot trigger unrelated changes'
  UNION ALL
  SELECT 'schema','Exact eight account foreign keys and delete actions',NOT ((SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')])))<>8
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n'),
 ('account_streak_runs','account_accounts','account_streak_runs_account_id_fkey','c'),
 ('account_streak_imports','account_accounts','account_streak_imports_account_id_fkey','n')) e(child,parent,conname,deletion)
      WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||e.child)
        AND c.confrelid=pg_catalog.to_regclass('public.'||e.parent) AND c.conname=e.conname AND c.contype='f'
        AND c.confdeltype::text=e.deletion AND c.convalidated AND NOT c.condeferrable))),'No unexpected cascade dependencies'
  UNION ALL
  SELECT 'functions', 'Exact set of twenty-eight account functions',
    (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_') = 28
    AND NOT EXISTS (SELECT 1 FROM functions WHERE oid IS NULL)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_'
      AND NOT EXISTS (SELECT 1 FROM functions e WHERE e.oid = p.oid)),
    'Extra routines or overloads fail; all expected signatures must exist'
  UNION ALL
  SELECT 'functions', f.signature || ': invoker, result and configuration',
    COALESCE(NOT p.prosecdef AND p.prokind = 'f' AND pg_catalog.pg_get_function_result(p.oid) = f.result_type
      AND p.provolatile = CASE WHEN f.mutator THEN 'v'::"char" ELSE 's'::"char" END
      AND ARRAY(SELECT pg_catalog.replace(config,E'\r','') FROM pg_catalog.unnest(p.proconfig) config ORDER BY 1) =
        CASE WHEN f.mutator THEN ARRAY(SELECT pg_catalog.replace(setting,E'\r','') FROM pg_catalog.unnest(ARRAY['lock_timeout=2s','search_path=""']) setting ORDER BY 1) ELSE ARRAY(SELECT pg_catalog.replace(setting,E'\r','') FROM pg_catalog.unnest(ARRAY['search_path=""']) setting ORDER BY 1) END, false),
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
    COALESCE(pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') = (NOT f.owner_only), false)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE acl.is_grantable AND (acl.grantee = 0 OR pg_catalog.pg_has_role('service_role', acl.grantee, 'USAGE'))),
    'Service routines executable; owner routines denied, including inherited grants'
  FROM functions f LEFT JOIN pg_catalog.pg_proc p ON p.oid = f.oid
  UNION ALL
  SELECT 'tables', a.name || ': set 01 RLS/no-policy posture',
    COALESCE(r.relkind = 'r' AND r.relrowsecurity, false)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid = r.oid),
    'Expected RLS posture and no policies'
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
      CASE WHEN a.name = 'account_streak_runs' THEN ARRAY['INSERT','SELECT','UPDATE'] WHEN a.name = 'account_streak_imports' THEN ARRAY['INSERT','SELECT'] WHEN a.name = 'account_owner_events' THEN ARRAY['DELETE','INSERT','SELECT']
        ELSE ARRAY['DELETE','INSERT','SELECT','UPDATE'] END AND NOT pg_catalog.bool_or(is_grantable)
      FROM pg_catalog.aclexplode(COALESCE(r.relacl, pg_catalog.acldefault('r', r.relowner))) acl
      WHERE CASE WHEN acl.grantee = 0 THEN true ELSE pg_catalog.pg_has_role('service_role', acl.grantee, 'USAGE') END), false),
    'Exact minimum grants per account table'
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
      AND a.attnotnull AND pg_catalog.replace(pg_catalog.pg_get_expr(d.adbin,d.adrelid),E'\r','')=pg_catalog.replace('''{}''::text[]',E'\r',''))
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
      AND pg_catalog.pg_get_expr(conbin,conrelid) LIKE '%logout_global%'
      AND pg_catalog.pg_get_expr(conbin,conrelid) LIKE '%preferences_global%'),
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

UNION ALL
SELECT 'schema','account_streak_runs: exact columns',NOT EXISTS(WITH expected(name,type,not_null) AS(VALUES ('account_id','uuid',true),('run_id','uuid',true),('current_count','bigint',true),('revision','bigint',true),('tracked_game_id','text',false),('human_player_id','text',false),('tracked_status','text',false),('ended_count','bigint',false),('ending_game_id','text',false),('created_at','timestamp with time zone',true),('updated_at','timestamp with time zone',true)),actual AS(SELECT a.attname::text,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_runs') AND a.attnum>0 AND NOT a.attisdropped) (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_runs') AND a.attnum>0 AND NOT a.attisdropped AND (a.attidentity<>'' OR a.attgenerated<>'')),'Exact names, types and nullability; no generated/identity columns'
UNION ALL
SELECT 'schema','account_streak_runs: keys',EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_runs') AND c.contype='p' AND c.conkey=ARRAY[1::smallint]) AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_runs') AND c.contype='f' AND c.conkey=ARRAY[1::smallint] AND c.confkey=ARRAY[1::smallint]),'Account FK and primary key column identities'
UNION ALL
SELECT 'schema','account_streak_runs: exact CHECK constraints',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('account_streak_runs_current_count_check','current_count>=0 AND current_count<=9007199254740991'),('account_streak_runs_revision_check','revision>0'),('account_streak_runs_tracked_check','tracked_game_id IS NULL AND human_player_id IS NULL AND tracked_status IS NULL OR tracked_game_id IS NOT NULL AND tracked_game_id<>'''' AND human_player_id IS NOT NULL AND human_player_id<>'''' AND tracked_status IS NOT NULL AND (tracked_status=ANY(ARRAY[''unfinished'',''settled'',''retired'',''restart_pending'']))'),('account_streak_runs_ended_check','ended_count IS NULL AND ending_game_id IS NULL OR ended_count IS NOT NULL AND ended_count>=1 AND ended_count<=9007199254740991 AND ending_game_id IS NOT NULL AND ending_game_id<>''''')),actual AS(SELECT c.conname::text,pg_catalog.pg_get_expr(c.conbin,c.conrelid,true) AS expr FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_runs') AND c.contype='c' AND c.convalidated AND NOT c.condeferrable) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'Checked expressions, CR-normalised on both sides'
UNION ALL
SELECT 'schema','account_streak_runs: no extra constraints',(SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass('public.account_streak_runs'))=6,'Only primary key, account FK and reviewed CHECKs'
UNION ALL
SELECT 'schema','account_streak_runs: exact defaults',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('run_id','gen_random_uuid()'),('current_count','0'),('revision','1'),('created_at','now()'),('updated_at','now()')),actual AS(SELECT a.attname::text,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS expr FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_runs')) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'No unexpected defaults'
UNION ALL
SELECT 'schema','account_streak_imports: exact columns',NOT EXISTS(WITH expected(name,type,not_null) AS(VALUES ('anchor_game_id','text',true),('account_id','uuid',false),('anchor_human_player_id','text',true),('source_session_id','text',false),('reported_count','bigint',true),('accepted_count','bigint',true),('evidence_kind','text',true),('selection','text',true),('anchor_state_revision','bigint',true),('continuation','text',true),('consumed_at','timestamp with time zone',true)),actual AS(SELECT a.attname::text,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_imports') AND a.attnum>0 AND NOT a.attisdropped) (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_imports') AND a.attnum>0 AND NOT a.attisdropped AND (a.attidentity<>'' OR a.attgenerated<>'')),'Exact names, types and nullability; no generated/identity columns'
UNION ALL
SELECT 'schema','account_streak_imports: keys',EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_imports') AND c.contype='p' AND c.conkey=ARRAY[1::smallint]) AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_imports') AND c.contype='f' AND c.conkey=ARRAY[2::smallint] AND c.confkey=ARRAY[1::smallint]),'Account FK and primary key column identities'
UNION ALL
SELECT 'schema','account_streak_imports: exact CHECK constraints',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('account_streak_imports_anchor_game_id_check','anchor_game_id<>'''''),('account_streak_imports_anchor_human_player_id_check','anchor_human_player_id<>'''''),('account_streak_imports_reported_count_check','reported_count>=0 AND reported_count<=9007199254740991'),('account_streak_imports_accepted_count_check','accepted_count>=0 AND accepted_count<=9007199254740991'),('account_streak_imports_evidence_kind_check','evidence_kind=ANY(ARRAY[''direct_session'',''stored_anchor''])'),('account_streak_imports_selection_check','selection=ANY(ARRAY[''guest'',''account'',''declined''])'),('account_streak_imports_anchor_state_revision_check','anchor_state_revision>0'),('account_streak_imports_continuation_check','continuation=ANY(ARRAY[''none'',''authorised''])'),('account_streak_imports_proof_check','evidence_kind=''direct_session'' AND source_session_id IS NOT NULL AND source_session_id=anchor_human_player_id OR evidence_kind=''stored_anchor'' AND source_session_id IS NULL'),('account_streak_imports_authorised_check','continuation=''none'' OR evidence_kind=''direct_session'' AND selection=''guest''')),actual AS(SELECT c.conname::text,pg_catalog.pg_get_expr(c.conbin,c.conrelid,true) AS expr FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.account_streak_imports') AND c.contype='c' AND c.convalidated AND NOT c.condeferrable) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT conname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'Checked expressions, CR-normalised on both sides'
UNION ALL
SELECT 'schema','account_streak_imports: no extra constraints',(SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass('public.account_streak_imports'))=12,'Only primary key, account FK and reviewed CHECKs'
UNION ALL
SELECT 'schema','account_streak_imports: exact defaults',NOT EXISTS(WITH expected(name,expr) AS(VALUES ('consumed_at','now()')),actual AS(SELECT a.attname::text,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS expr FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=pg_catalog.to_regclass('public.account_streak_imports')) (SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected EXCEPT SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual) UNION ALL (SELECT attname,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM actual EXCEPT SELECT name,pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.replace(expr,E'\r',''),'pg_catalog.',''),'::[a-z_]+','','g'),E' \t\n\r[]''"','') FROM expected)),'No unexpected defaults'
UNION ALL
SELECT 'schema','Exact streak indexes',NOT EXISTS(WITH expected(name,table_name,columns,is_unique) AS(VALUES ('account_streak_runs_pkey','account_streak_runs',ARRAY[1::smallint],true),('account_streak_imports_pkey','account_streak_imports',ARRAY[1::smallint],true),('account_streak_imports_account_consumed_idx','account_streak_imports',ARRAY[2::smallint,11::smallint],false)),actual AS(SELECT i.relname::text,t.relname::text,ARRAY(SELECT x FROM pg_catalog.unnest(idx.indkey::smallint[]) x),idx.indisunique FROM pg_catalog.pg_index idx JOIN pg_catalog.pg_class i ON i.oid=idx.indexrelid JOIN pg_catalog.pg_class t ON t.oid=idx.indrelid WHERE t.oid IN (pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')) AND idx.indisvalid AND idx.indisready AND idx.indpred IS NULL AND idx.indexprs IS NULL AND idx.indnatts=idx.indnkeyatts) (SELECT * FROM expected EXCEPT SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)),'Only primary keys and account/consumption index'
UNION ALL
SELECT 'functions','account_check_name: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_name_key','p_moderation_key','p_check_reserved']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_check_name'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_link_session: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_session_id','p_account_id','p_token_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_link_session'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_read_credential: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_name_key']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_read_credential'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_claim: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_display_name','p_name_key','p_moderation_key','p_password_hash','p_password_format','p_token_hash','p_session_id','p_sound_enabled','p_health_flash_enabled','p_chat_minimized','p_battle_log_preferred','p_music_enabled']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_claim'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_finish_signin: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_expected_password_hash','p_expected_password_format','p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_finish_signin'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_resume: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_resume'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_logout: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_logout'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_change_password: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_expected_password_hash','p_expected_password_format','p_new_password_hash','p_new_password_format','p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_change_password'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_rehash: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_expected_password_hash','p_expected_password_format','p_new_password_hash','p_new_password_format']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rehash'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_identity: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_identity'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_name_status: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_display_name']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_name_status'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_rate_hit: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_buckets','p_token_hash']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rate_hit'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_captcha_consume: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_proof_hash','p_consume']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_captcha_consume'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_cleanup_rate_limits: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY[]::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_cleanup_rate_limits'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_get_preferences: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_get_preferences'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_update_preferences: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_patch','p_expected_revision']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_update_preferences'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_lookup: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_display_name']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_lookup'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_block: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_block'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_unblock: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_unblock'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_sign_out_everywhere: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_sign_out_everywhere'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_apply_password_reset: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id','p_expected_security_version','p_password_hash','p_password_format','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_apply_password_reset'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_cleanup: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_cleanup'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_delete_development_accounts: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_ids','p_note']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_delete_development_accounts'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_reconcile: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reconcile'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_reset: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id','p_expected_revision']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reset'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_commit_game: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id','p_expected_revision','p_action','p_game','p_history','p_source']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_commit_game'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_streak_import: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_token_hash','p_session_id','p_expected_revision','p_decision','p_guest','p_adoption']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_import'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'functions','account_owner_streak_lookup: exact argument names',COALESCE((SELECT pg_catalog.bool_and(ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(p.proargnames) arg)=ARRAY(SELECT pg_catalog.replace(arg,E'\r','') FROM pg_catalog.unnest(ARRAY['p_account_id']::text[]) arg)) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_streak_lookup'),false),'Named PostgREST arguments stay pinned'
UNION ALL
SELECT 'schema','Streak indexes valid btree and default ordering',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid JOIN pg_catalog.pg_am am ON am.oid=i.relam WHERE x.indrelid IN (pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')) AND (NOT x.indisvalid OR NOT x.indisready OR am.amname<>'btree' OR EXISTS(SELECT 1 FROM pg_catalog.unnest(x.indoption::smallint[]) opt WHERE opt<>0))),'No hidden invalid indexes or changed ordering'
UNION ALL
SELECT 'access','Streak columns have no separate ACLs',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid IN (pg_catalog.to_regclass('public.account_streak_runs'),pg_catalog.to_regclass('public.account_streak_imports')) AND COALESCE(pg_catalog.cardinality(a.attacl),0)<>0),'Column grants cannot bypass minimum table privileges'
UNION ALL
SELECT 'schema','Exact account relation inventory',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND pg_catalog.left(c.relname,8)='account_' AND c.relkind IN ('r','p','v','m','f','S','c') AND c.relname NOT IN ('account_accounts','account_credentials','account_tokens','account_session_links','account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports')),'No later-set or unrelated account relations'
UNION ALL
SELECT 'source','account_check_name: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_check_name'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_link_session: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_l public.account_session_links%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_session_id IS NULL OR p_session_id = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_SESSION';
  END IF;
  -- Independently authorize direct service_role calls. Account before token before binding.
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID'; END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.id = p_token_id FOR UPDATE;
  IF NOT FOUND OR v_t.account_id <> v_a.id OR v_t.security_version <> v_a.security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID';
  END IF;
  IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P2208', MESSAGE = 'ACCOUNT_TOKEN_REVOKED'; END IF;
  IF v_t.expires_at <= pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE = 'P2207', MESSAGE = 'ACCOUNT_TOKEN_EXPIRED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  INSERT INTO public.account_session_links (session_id, account_id, token_id)
    VALUES (p_session_id, v_a.id, v_t.id) ON CONFLICT (session_id) DO NOTHING;
  SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id = p_session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  -- Recheck expiry after a possible binding wait.
  IF v_t.expires_at <= v_now THEN RAISE EXCEPTION USING ERRCODE = 'P2207', MESSAGE = 'ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_l.detached_at IS NULL AND v_l.account_id <> v_a.id AND EXISTS (
    SELECT 1 FROM public.account_tokens t JOIN public.account_accounts a ON a.id = t.account_id
    WHERE t.id = v_l.token_id AND t.account_id = v_l.account_id AND t.revoked_at IS NULL
      AND t.expires_at > v_now AND t.security_version = a.security_version AND a.status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2204', MESSAGE = 'ACCOUNT_SESSION_LINK_CONFLICT';
  END IF;
  UPDATE public.account_session_links SET account_id = v_a.id, token_id = v_t.id,
    linked_at = v_now, detached_at = NULL WHERE session_id = p_session_id;
  RETURN pg_catalog.jsonb_build_object('sessionId', p_session_id, 'accountId', v_a.id, 'displayName', v_a.display_name);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_link_session'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_read_credential: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_result jsonb;
BEGIN
  -- No status predicate or status-bearing error: verify before revealing a block.
  SELECT pg_catalog.jsonb_build_object(
    'accountId', a.id, 'displayName', a.display_name, 'securityVersion', a.security_version::text,
    'passwordHash', c.password_hash, 'passwordFormat', c.password_format,
    'mustChangePassword', c.must_change_password)
    INTO v_result FROM public.account_accounts a JOIN public.account_credentials c ON c.account_id = a.id
    WHERE a.name_key = p_name_key;
  RETURN v_result;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_read_credential'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_claim: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(22002, 1);
  IF p_name_key IS DISTINCT FROM pg_catalog.lower(p_display_name COLLATE "C")
    OR p_password_format IS DISTINCT FROM 'nfc-argon2id-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_CLAIM';
  END IF;
  PERFORM public.account_check_name(p_name_key, p_moderation_key, true);
  v_now := pg_catalog.clock_timestamp();
  BEGIN
    INSERT INTO public.account_accounts (display_name, created_at, updated_at)
      VALUES (p_display_name, v_now, v_now) RETURNING * INTO v_a;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'account_accounts_name_key_key' THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'ACCOUNT_NAME_TAKEN';
    END IF;
    RAISE;
  END;
  INSERT INTO public.account_credentials (account_id, password_hash, password_format, updated_at)
    VALUES (v_a.id, p_password_hash, p_password_format, v_now);
  INSERT INTO public.account_preferences (account_id, sound_enabled, health_flash_enabled, chat_minimized,
    battle_log_preferred, music_enabled, updated_at)
    VALUES (v_a.id, p_sound_enabled, p_health_flash_enabled, p_chat_minimized,
      p_battle_log_preferred, p_music_enabled, v_now);

  INSERT INTO public.account_tokens (account_id, token_hash, security_version, created_at, last_used_at, expires_at)
    VALUES (v_a.id, p_token_hash, v_a.security_version, v_now, v_now, v_now + interval '90 days') RETURNING * INTO v_t;
  v_link := public.account_link_session(p_session_id, v_a.id, v_t.id);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_claim'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_finish_signin: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN

  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY'; END IF;
  SELECT c.* INTO v_c FROM public.account_credentials c WHERE c.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_c.password_hash IS DISTINCT FROM p_expected_password_hash
    OR v_c.password_format IS DISTINCT FROM p_expected_password_format THEN
    RAISE EXCEPTION USING ERRCODE = 'P2203', MESSAGE = 'ACCOUNT_STALE_CREDENTIAL';
  END IF;
  IF v_a.security_version IS DISTINCT FROM p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY';
  END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  IF v_c.must_change_password THEN
    RAISE EXCEPTION USING ERRCODE = 'P2205', MESSAGE = 'ACCOUNT_PASSWORD_CHANGE_REQUIRED';
  END IF;
  v_now := pg_catalog.clock_timestamp();

  INSERT INTO public.account_tokens (account_id, token_hash, security_version, created_at, last_used_at, expires_at)
    VALUES (v_a.id, p_token_hash, v_a.security_version, v_now, v_now, v_now + interval '90 days') RETURNING * INTO v_t;
  v_link := public.account_link_session(p_session_id, v_a.id, v_t.id);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_finish_signin'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_resume: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN
  SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash = p_token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = v_a.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID'; END IF;
  SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash = p_token_hash AND t.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_t.security_version <> v_a.security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2206', MESSAGE = 'ACCOUNT_TOKEN_INVALID';
  END IF;
  IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P2208', MESSAGE = 'ACCOUNT_TOKEN_REVOKED'; END IF;
  v_now := pg_catalog.clock_timestamp();
  IF v_t.expires_at <= v_now THEN RAISE EXCEPTION USING ERRCODE = 'P2207', MESSAGE = 'ACCOUNT_TOKEN_EXPIRED'; END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  IF v_t.last_used_at < v_now - interval '1 hour' THEN
    UPDATE public.account_tokens SET last_used_at = v_now, expires_at = v_now + interval '90 days'
      WHERE id = v_t.id RETURNING * INTO v_t;
  END IF;
  IF p_session_id IS NOT NULL THEN v_link := public.account_link_session(p_session_id, v_a.id, v_t.id); END IF;

  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_resume'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_logout: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_account_id uuid; v_token_id uuid; v_now timestamptz;
BEGIN
  SELECT t.account_id INTO v_account_id FROM public.account_tokens t WHERE t.token_hash = p_token_hash;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM a.id FROM public.account_accounts a WHERE a.id = v_account_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT t.id INTO v_token_id FROM public.account_tokens t
    WHERE t.token_hash = p_token_hash AND t.account_id = v_account_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.token_id = v_token_id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_tokens SET revoked_at = COALESCE(revoked_at, v_now) WHERE id = v_token_id;
  UPDATE public.account_session_links SET detached_at = COALESCE(detached_at, v_now) WHERE token_id = v_token_id;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_logout'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_change_password: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE
  v_a public.account_accounts%ROWTYPE;
  v_c public.account_credentials%ROWTYPE;
  v_t public.account_tokens%ROWTYPE;
  v_p public.account_preferences%ROWTYPE;
  v_link jsonb;
  v_now timestamptz;
  v_constraint text;
BEGIN

  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY'; END IF;
  SELECT c.* INTO v_c FROM public.account_credentials c WHERE c.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_c.password_hash IS DISTINCT FROM p_expected_password_hash
    OR v_c.password_format IS DISTINCT FROM p_expected_password_format THEN
    RAISE EXCEPTION USING ERRCODE = 'P2203', MESSAGE = 'ACCOUNT_STALE_CREDENTIAL';
  END IF;
  IF v_a.security_version IS DISTINCT FROM p_expected_security_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P2202', MESSAGE = 'ACCOUNT_STALE_SECURITY';
  END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P2201', MESSAGE = 'ACCOUNT_BLOCKED'; END IF;
  PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  IF p_new_password_format IS DISTINCT FROM 'nfc-argon2id-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_PASSWORD_FORMAT';
  END IF;
  PERFORM t.id FROM public.account_tokens t WHERE t.account_id = v_a.id ORDER BY t.id FOR UPDATE;
  PERFORM l.session_id FROM public.account_session_links l WHERE l.account_id = v_a.id ORDER BY l.session_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  UPDATE public.account_credentials SET password_hash = p_new_password_hash, password_format = p_new_password_format,
    must_change_password = false, updated_at = v_now WHERE account_id = v_a.id;
  UPDATE public.account_accounts SET security_version = security_version + 1, updated_at = v_now
    WHERE id = v_a.id RETURNING * INTO v_a;
  UPDATE public.account_tokens SET revoked_at = COALESCE(revoked_at, v_now) WHERE account_id = v_a.id;
  UPDATE public.account_session_links SET detached_at = COALESCE(detached_at, v_now) WHERE account_id = v_a.id;

  INSERT INTO public.account_tokens (account_id, token_hash, security_version, created_at, last_used_at, expires_at)
    VALUES (v_a.id, p_token_hash, v_a.security_version, v_now, v_now, v_now + interval '90 days') RETURNING * INTO v_t;
  v_link := public.account_link_session(p_session_id, v_a.id, v_t.id);
  SELECT p.* INTO STRICT v_p FROM public.account_preferences p WHERE p.account_id = v_a.id;
  RETURN pg_catalog.jsonb_build_object(
    'account', pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name'),
    'preferences', pg_catalog.jsonb_build_object('values', pg_catalog.jsonb_build_object(
      'soundEnabled', v_p.sound_enabled, 'healthFlashEnabled', v_p.health_flash_enabled,
      'chatMinimized', v_p.chat_minimized, 'battleLogPreferred', v_p.battle_log_preferred, 'musicEnabled', v_p.music_enabled),
      'revision', v_p.revision::text, 'updatedAt', v_p.updated_at),
    'expiresAt', v_t.expires_at) ||
    CASE WHEN p_session_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('link', v_link) END;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_change_password'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_rehash: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_c public.account_credentials%ROWTYPE;
BEGIN
  SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'active' OR v_a.security_version IS DISTINCT FROM p_expected_security_version THEN RETURN false; END IF;
  SELECT c.* INTO v_c FROM public.account_credentials c WHERE c.account_id = v_a.id FOR UPDATE;
  IF NOT FOUND OR v_c.password_hash IS DISTINCT FROM p_expected_password_hash
    OR v_c.password_format IS DISTINCT FROM p_expected_password_format THEN RETURN false; END IF;
  IF p_new_password_format IS DISTINCT FROM 'nfc-argon2id-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_BAD_PASSWORD_FORMAT';
  END IF;
  UPDATE public.account_credentials SET password_hash = p_new_password_hash, password_format = p_new_password_format,
    updated_at = pg_catalog.clock_timestamp() WHERE account_id = v_a.id;
  RETURN true;
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rehash'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_identity: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE;
BEGIN
  SELECT a.* INTO v_a FROM public.account_accounts a JOIN public.account_tokens t ON t.account_id = a.id
    JOIN public.account_session_links l ON l.token_id = t.id AND l.account_id = a.id
    WHERE t.token_hash = p_token_hash AND t.revoked_at IS NULL AND t.expires_at > pg_catalog.statement_timestamp()
      AND t.security_version = a.security_version AND a.status = 'active'
      AND l.session_id = p_session_id AND l.detached_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  BEGIN
    PERFORM public.account_check_name(v_a.name_key, pg_catalog.translate(v_a.name_key, '0123456789', 'oizeasgtbg'), false);
  EXCEPTION WHEN SQLSTATE 'P2209' THEN RETURN NULL;
  END;
  RETURN pg_catalog.jsonb_build_object('id', v_a.id, 'displayName', v_a.display_name, 'badge', 'claimed-name');
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_identity'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_name_status: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_name_status'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_rate_hit: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_rate_hit'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_captcha_consume: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_captcha_consume'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_cleanup_rate_limits: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_cleanup_rate_limits'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_get_preferences: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_get_preferences'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_update_preferences: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_update_preferences'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_lookup: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_lookup'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_block: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_block'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_unblock: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_unblock'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_sign_out_everywhere: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_sign_out_everywhere'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_apply_password_reset: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_apply_password_reset'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_cleanup: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
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
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass])))<>8
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n'),
 ('account_streak_runs','account_accounts','account_streak_runs_account_id_fkey','c'),
 ('account_streak_imports','account_accounts','account_streak_imports_account_id_fkey','n')) e(child,parent,conname,deletion)
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
  RETURN pg_catalog.jsonb_build_object('streakRunsDeleted',0,'streakImportsAnonymized',0,'tokensDeleted',v_tokens,'linksDeleted',v_links,'rateLimitsDeleted',v_rates,'eventId',v_event,
    'tokensRemainingEligible',(SELECT count(*) FROM public.account_tokens WHERE expires_at<v_cutoff OR revoked_at<v_cutoff),
    'linksRemainingEligible',(SELECT count(*) FROM public.account_session_links l WHERE l.detached_at<v_cutoff
      OR EXISTS (SELECT 1 FROM public.account_tokens t WHERE t.id=l.token_id AND (t.expires_at<v_cutoff OR t.revoked_at<v_cutoff))),
    'rateLimitsRemainingEligible',(SELECT count(*) FROM public.account_rate_limits WHERE expires_at<=pg_catalog.clock_timestamp()));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_cleanup'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_delete_development_accounts: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_ids uuid[]; v_missing uuid[]; v_tokens integer; v_links integer; v_events integer;
  v_streak_runs integer; v_streak_imports integer; v_credentials integer; v_preferences integer; v_accounts integer; v_event uuid; v_now timestamptz;
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
      'account_preferences','account_name_rules','account_rate_limits','account_owner_events','account_streak_runs','account_streak_imports')) THEN
    RAISE EXCEPTION 'Unexpected account trigger dependency'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND (
    c.conrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass]) OR
    c.confrelid=ANY(ARRAY['public.account_accounts'::regclass,'public.account_credentials'::regclass,'public.account_tokens'::regclass,
      'public.account_session_links'::regclass,'public.account_preferences'::regclass,'public.account_name_rules'::regclass,
      'public.account_rate_limits'::regclass,'public.account_owner_events'::regclass,'public.account_streak_runs'::regclass,'public.account_streak_imports'::regclass])))<>8
    OR EXISTS (SELECT 1 FROM (VALUES
      ('account_credentials','account_accounts','account_credentials_account_id_fkey','c'),
      ('account_tokens','account_accounts','account_tokens_account_id_fkey','c'),
      ('account_session_links','account_accounts','account_session_links_account_id_fkey','c'),
      ('account_session_links','account_tokens','account_session_links_token_id_fkey','c'),
      ('account_preferences','account_accounts','account_preferences_account_id_fkey','c'),
      ('account_owner_events','account_accounts','account_owner_events_account_id_fkey','n'),
 ('account_streak_runs','account_accounts','account_streak_runs_account_id_fkey','c'),
 ('account_streak_imports','account_accounts','account_streak_imports_account_id_fkey','n')) e(child,parent,conname,deletion)
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
  SELECT count(*) INTO v_streak_runs FROM public.account_streak_runs WHERE account_id=ANY(v_ids);
  SELECT count(*) INTO v_streak_imports FROM public.account_streak_imports WHERE account_id=ANY(v_ids);
  DELETE FROM public.account_accounts WHERE id=ANY(v_ids);
  GET DIAGNOSTICS v_accounts=ROW_COUNT;
  INSERT INTO public.account_owner_events(action,note) VALUES('cleanup',p_note) RETURNING id INTO v_event;
  RETURN pg_catalog.jsonb_build_object('deletedAccountIds',v_ids,'missingAccountIds',v_missing,'accountsDeleted',v_accounts,
    'tokensDeleted',v_tokens,'linksDeleted',v_links,'credentialsDeleted',v_credentials,'preferencesDeleted',v_preferences,
    'ownerEventsDeleted',v_events,'streakRunsDeleted',v_streak_runs,'streakImportsAnonymized',v_streak_imports,'eventId',v_event);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_delete_development_accounts'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_reconcile: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
  RETURN pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reconcile'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_reset: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR v_r.revision<>p_expected_revision THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  UPDATE public.account_streak_runs SET current_count=0,run_id=pg_catalog.gen_random_uuid(),
    tracked_status=CASE WHEN tracked_game_id IS NULL THEN NULL ELSE 'retired' END,
    ended_count=NULL,ending_game_id=NULL,revision=revision+1,updated_at=pg_catalog.clock_timestamp()
    WHERE account_id=v_a.id RETURNING * INTO v_r;
  RETURN pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at);
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_reset'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_commit_game: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
  v_id text; v_source jsonb; v_preview jsonb; v_existing jsonb; v_update jsonb;
  v_head jsonb; v_next bigint; v_replacement text; v_source_h jsonb; v_recover boolean:=false; v_selected_source boolean;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  v_selected_source:=COALESCE(v_r.tracked_game_id=p_source->>'gameId' AND v_r.tracked_status IN ('unfinished','restart_pending'),false);
  v_id:=p_game#>>'{value,gameId}';
  SELECT k.value INTO v_preview FROM public.kv_store_825e19ab k WHERE k.key='game_'||(p_source->>'gameId');
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key=ANY(ARRAY[
    'game_'||v_r.tracked_game_id,'game_'||v_id,'game_'||(p_source->>'gameId'),
    'game_'||(v_preview#>>'{winStreakRestart,replacementGameId}')]) ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
  IF p_action IS NULL OR p_action NOT IN ('create','rematch','restart') THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF p_action='create' AND p_source IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF p_action IN ('rematch','restart') THEN
    SELECT k.value INTO v_source FROM public.kv_store_825e19ab k WHERE k.key='game_'||(p_source->>'gameId');
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2255',MESSAGE='STREAK_GAME_NOT_FOUND'; END IF;
    SELECT h INTO v_source_h FROM pg_catalog.jsonb_array_elements(v_source->'players') h WHERE h->>'id'=p_session_id AND h->>'role'='player';
    IF v_source_h IS NULL OR v_source#>>ARRAY['controllersByPlayerId',p_session_id,'kind'] IS DISTINCT FROM 'human'
      OR (v_source_h->>'accountId' IS NOT NULL AND v_source_h->>'accountId'<>v_a.id::text) THEN
      RAISE EXCEPTION USING ERRCODE='P2253',MESSAGE='STREAK_SEAT_FORBIDDEN'; END IF;
    -- A completed restart is replayable even after a different game becomes selected.
    IF p_action='restart' AND v_source#>>'{winStreakRestart,kind}'='source'
      AND v_source#>>'{winStreakRestart,status}'='completed' THEN
      v_replacement:=v_source#>>'{winStreakRestart,replacementGameId}';
      IF v_replacement IS DISTINCT FROM v_preview#>>'{winStreakRestart,replacementGameId}' THEN
        RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
      SELECT k.value INTO v_existing FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_replacement;
      IF v_existing#>>'{winStreakRestart,kind}' IS DISTINCT FROM 'replacement'
        OR v_existing#>>'{winStreakRestart,sourceGameId}' IS DISTINCT FROM p_source->>'gameId'
        OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_existing->'players') h
          WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text)
        OR v_existing#>>ARRAY['controllersByPlayerId',p_session_id,'kind'] IS DISTINCT FROM 'human' THEN
        RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
      RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_replacement,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
    END IF;
  END IF;
  SELECT k.value INTO v_existing FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_id;
  IF FOUND THEN
    v_recover:=COALESCE(p_action='restart' AND v_source#>>'{winStreakRestart,kind}'='source'
      AND v_source#>>'{winStreakRestart,status}'='pending' AND v_source#>>'{winStreakRestart,replacementGameId}'=v_id
      AND v_existing#>>'{winStreakRestart,kind}'='replacement' AND v_existing#>>'{winStreakRestart,sourceGameId}'=p_source->>'gameId'
      AND v_existing#>>ARRAY['controllersByPlayerId',p_session_id,'kind']='human'
      AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v_existing->'players') h WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text),false);
    IF v_recover AND NOT v_selected_source THEN
      RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_id,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
    END IF;
    IF v_r.tracked_game_id=v_id AND v_r.human_player_id=p_session_id AND EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_existing->'players') h WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text) THEN
      RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_id,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
    END IF;
    IF NOT v_recover THEN RAISE EXCEPTION USING ERRCODE='P2256',MESSAGE='STREAK_GAME_ID_TAKEN'; END IF;
  END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR v_r.revision<>p_expected_revision THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  v_next:=CASE WHEN p_action='restart' OR (v_r.tracked_status IN ('unfinished','restart_pending') AND v_r.human_player_id=p_session_id)
    THEN 0 ELSE v_r.current_count END;
  v_g:=p_game->'value'; v_head:=p_game->'game_head';
  IF p_game->>'key' IS DISTINCT FROM 'game_'||v_id OR v_id IS NULL OR v_id=''
    OR pg_catalog.jsonb_typeof(v_g->'gameId') IS DISTINCT FROM 'string'
    OR v_g->'stateRevision' IS DISTINCT FROM '1'::jsonb OR v_g->>'status' IS DISTINCT FROM 'active'
    OR pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h
    WHERE h->>'id'=p_session_id AND h->>'accountId'=v_a.id::text AND h->>'role'='player';
  SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||v_id AND b->>'role'='player';
  IF v_h IS NULL OR v_b IS NULL OR p_session_id='bot_'||v_id
    OR v_g#>>ARRAY['controllersByPlayerId',p_session_id,'kind'] IS DISTINCT FROM 'human'
    OR v_g#>>ARRAY['controllersByPlayerId','bot_'||v_id,'kind'] IS DISTINCT FROM 'bot'
    OR v_g#>'{gameData,winStreakBonus,appliedCount}' IS DISTINCT FROM pg_catalog.to_jsonb(v_next)
    OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM 'bot_'||v_id
    OR v_head->>'gameId' IS DISTINCT FROM v_id OR v_head->'stateRevision' IS DISTINCT FROM v_g->'stateRevision'
    OR v_head->>'status' IS DISTINCT FROM v_g->>'status'
    OR p_history->>'key' IS DISTINCT FROM 'game_history_'||v_id OR p_history#>>'{value,gameId}' IS DISTINCT FROM v_id
    OR p_history#>'{value,revision}' IS DISTINCT FROM '0'::jsonb
    OR p_history#>'{value,completedTurnCount}' IS DISTINCT FROM '0'::jsonb
    OR p_history#>'{value,turns}' IS DISTINCT FROM '[]'::jsonb
    OR p_history#>'{value,currentTurnCapture}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  IF p_action IN ('rematch','restart') THEN
    IF (p_source->'expectedRevision'='null'::jsonb AND v_source ? 'stateRevision')
      OR (p_source->'expectedRevision' IS DISTINCT FROM 'null'::jsonb AND v_source->'stateRevision' IS DISTINCT FROM p_source->'expectedRevision')
      OR NOT (p_source ? 'expectedRevision') THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    IF p_action='rematch' AND (v_source->>'status' IS DISTINCT FROM 'finished' OR v_source->>'resultReason'='restart'
      OR v_source#>>'{winStreakRestart,kind}'='source') THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    v_update:=NULLIF(p_source->'update','null'::jsonb);
    IF p_action='restart' AND (v_update IS NULL OR v_update#>>'{value,status}' IS DISTINCT FROM 'finished'
      OR v_update#>>'{value,resultReason}' IS DISTINCT FROM 'restart'
      OR v_update#>>'{value,winStreakRestart,kind}' IS DISTINCT FROM 'source'
      OR v_update#>>'{value,winStreakRestart,status}' IS DISTINCT FROM 'completed'
      OR v_update#>>'{value,winStreakRestart,replacementGameId}' IS DISTINCT FROM v_id
      OR v_g#>>'{winStreakRestart,kind}' IS DISTINCT FROM 'replacement'
      OR v_g#>>'{winStreakRestart,sourceGameId}' IS DISTINCT FROM p_source->>'gameId') THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    IF v_update IS NOT NULL THEN
      IF v_update->>'key' IS DISTINCT FROM 'game_'||(p_source->>'gameId')
        OR v_update#>>'{value,gameId}' IS DISTINCT FROM p_source->>'gameId'
        OR v_update#>'{value,players}' IS DISTINCT FROM v_source->'players'
        OR v_update#>'{value,controllersByPlayerId}' IS DISTINCT FROM v_source->'controllersByPlayerId'
        OR v_update#>'{value,stateRevision}' IS DISTINCT FROM pg_catalog.to_jsonb(COALESCE((v_source->>'stateRevision')::bigint,1)+1)
        OR v_update#>>'{game_head,gameId}' IS DISTINCT FROM p_source->>'gameId'
        OR v_update#>'{game_head,stateRevision}' IS DISTINCT FROM v_update#>'{value,stateRevision}'
        OR v_update#>>'{game_head,status}' IS DISTINCT FROM v_update#>>'{value,status}' THEN
        RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
      UPDATE public.kv_store_825e19ab SET value=v_update->'value',game_head=v_update->'game_head'
        WHERE key='game_'||(p_source->>'gameId') AND ((p_source->'expectedRevision'='null'::jsonb AND NOT (value ? 'stateRevision'))
          OR value->'stateRevision'=p_source->'expectedRevision');
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    END IF;
  END IF;
  IF NOT v_recover THEN
    INSERT INTO public.kv_store_825e19ab(key,value,game_head) VALUES(p_game->>'key',v_g,v_head) ON CONFLICT(key) DO NOTHING;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2256',MESSAGE='STREAK_GAME_ID_TAKEN'; END IF;
  END IF;
  INSERT INTO public.kv_store_825e19ab(key,value) VALUES(p_history->>'key',p_history->'value') ON CONFLICT(key) DO NOTHING;
  IF NOT FOUND AND (NOT v_recover OR NOT EXISTS(SELECT 1 FROM public.kv_store_825e19ab k WHERE k.key=p_history->>'key' AND k.value->>'gameId'=v_id)) THEN
    RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  UPDATE public.account_streak_runs SET current_count=v_next,
    run_id=CASE WHEN p_action='restart' OR (tracked_status IN ('unfinished','restart_pending') AND human_player_id=p_session_id)
      THEN pg_catalog.gen_random_uuid() ELSE run_id END,
    tracked_game_id=v_id,human_player_id=p_session_id,tracked_status='unfinished',ended_count=NULL,ending_game_id=NULL,
    revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
  RETURN pg_catalog.jsonb_build_object('status','committed','gameId',v_id,'streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_commit_game'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_streak_import: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
DECLARE v_a public.account_accounts%ROWTYPE; v_t public.account_tokens%ROWTYPE;
 v_l public.account_session_links%ROWTYPE; v_r public.account_streak_runs%ROWTYPE;
 v_g jsonb; v_h jsonb; v_b jsonb; v_bonus bigint; v_outcome text; v_expected_human text;
  v_i public.account_streak_imports%ROWTYPE; v_anchor text; v_human text;
  v_reported bigint; v_local bigint; v_accepted bigint; v_selection text; v_continuation text:='none';
  v_direct boolean; v_update jsonb; v_new_h jsonb; v_new_b jsonb; v_anchor_revision bigint;
BEGIN
 SELECT t.account_id INTO v_a.id FROM public.account_tokens t WHERE t.token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT a.* INTO v_a FROM public.account_accounts a WHERE a.id=v_a.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 SELECT t.* INTO v_t FROM public.account_tokens t WHERE t.token_hash=p_token_hash AND t.account_id=v_a.id FOR UPDATE;
 IF NOT FOUND OR v_t.security_version<>v_a.security_version THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 IF v_t.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2208',MESSAGE='ACCOUNT_TOKEN_REVOKED'; END IF;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_a.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='P2201',MESSAGE='ACCOUNT_BLOCKED'; END IF;
 PERFORM public.account_check_name(v_a.name_key,pg_catalog.translate(v_a.name_key,'0123456789','oizeasgtbg'),false);
 SELECT l.* INTO v_l FROM public.account_session_links l WHERE l.session_id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_l.detached_at IS NOT NULL OR v_l.account_id<>v_a.id OR v_l.token_id<>v_t.id THEN RAISE EXCEPTION USING ERRCODE='P2206',MESSAGE='ACCOUNT_TOKEN_INVALID'; END IF;
 INSERT INTO public.account_streak_runs(account_id) VALUES(v_a.id) ON CONFLICT(account_id) DO NOTHING;
 SELECT r.* INTO STRICT v_r FROM public.account_streak_runs r WHERE r.account_id=v_a.id FOR UPDATE;
  v_anchor:=p_guest->>'anchorGameId'; v_human:=p_guest->>'humanPlayerId';
  IF v_anchor IS NULL OR v_anchor='' OR v_human IS NULL OR v_human=''
    OR p_decision IS NULL OR p_decision NOT IN ('compare','decline')
    OR pg_catalog.jsonb_typeof(p_guest->'currentCount') IS DISTINCT FROM 'number'
    OR (p_guest->>'currentCount') !~ '^[0-9]{1,16}$'
    OR pg_catalog.jsonb_typeof(p_guest->'resultPending') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  v_reported:=(p_guest->>'currentCount')::bigint;
  IF v_reported>9007199254740991 THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  PERFORM k.key FROM public.kv_store_825e19ab k WHERE k.key=ANY(ARRAY['game_'||v_r.tracked_game_id,'game_'||v_anchor]) ORDER BY k.key FOR UPDATE;
 IF v_t.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2207',MESSAGE='ACCOUNT_TOKEN_EXPIRED'; END IF;
 IF v_r.tracked_status='unfinished' THEN
 DECLARE v_usable boolean:=false;
 BEGIN
 <<tracked_game_evidence>>
 BEGIN
 SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_r.tracked_game_id;
 IF NOT FOUND THEN EXIT tracked_game_evidence; END IF;
 IF v_g->>'gameId' IS DISTINCT FROM v_r.tracked_game_id THEN EXIT tracked_game_evidence; END IF;
 v_expected_human:=v_r.human_player_id;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN EXIT tracked_game_evidence; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN EXIT tracked_game_evidence; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 EXIT tracked_game_evidence; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN EXIT tracked_game_evidence; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN EXIT tracked_game_evidence; END IF;
 END IF;
 IF v_h->>'accountId' IS DISTINCT FROM v_a.id::text THEN EXIT tracked_game_evidence; END IF;
 v_usable:=true;
 END tracked_game_evidence;
 IF v_usable THEN
 IF v_outcome IS NOT NULL THEN
 UPDATE public.account_streak_runs SET current_count=CASE WHEN v_outcome='win' THEN LEAST(9007199254740991,current_count+1) WHEN v_outcome='loss' THEN 0 ELSE current_count END,
 ended_count=CASE WHEN v_outcome='loss' THEN NULLIF(current_count,0) ELSE ended_count END,
 ending_game_id=CASE WHEN v_outcome='loss' THEN CASE WHEN current_count>0 THEN tracked_game_id END ELSE ending_game_id END,
 tracked_status=CASE WHEN v_outcome='restart' THEN 'retired' ELSE 'settled' END,
 revision=revision+1,updated_at=pg_catalog.clock_timestamp() WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 ELSE
   -- Unusable tracked evidence retires the association, never the count or ended snapshot.
   UPDATE public.account_streak_runs SET tracked_status='retired',revision=revision+1,updated_at=pg_catalog.clock_timestamp()
     WHERE account_id=v_a.id RETURNING * INTO v_r;
 END IF;
 END;
 END IF;
  -- Anchor row lock precedes tombstone lookup and eligibility, including after adoption.
  SELECT i.* INTO v_i FROM public.account_streak_imports i WHERE i.anchor_game_id=v_anchor;
  IF FOUND THEN
 IF v_i.account_id IS DISTINCT FROM v_a.id THEN RAISE EXCEPTION USING ERRCODE='P2252',MESSAGE='STREAK_IMPORT_CONSUMED'; END IF;
 RETURN pg_catalog.jsonb_build_object('streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at),'import',pg_catalog.jsonb_build_object('anchorGameId',v_i.anchor_game_id,'selection',v_i.selection,'acceptedCount',v_i.accepted_count,'continuation',v_i.continuation));
  END IF;
  SELECT k.value INTO v_g FROM public.kv_store_825e19ab k WHERE k.key='game_'||v_anchor;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2255',MESSAGE='STREAK_GAME_NOT_FOUND'; END IF;
  v_expected_human:=v_human;
 IF pg_catalog.jsonb_typeof(v_g->'players') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 IF pg_catalog.jsonb_array_length(v_g->'players')<>2 THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 SELECT h INTO v_h FROM pg_catalog.jsonb_array_elements(v_g->'players') h WHERE h->>'id'=v_expected_human AND h->>'role'='player';
 SELECT b INTO v_b FROM pg_catalog.jsonb_array_elements(v_g->'players') b WHERE b->>'id'='bot_'||(v_g->>'gameId') AND b->>'role'='player';
 IF v_h IS NULL OR v_b IS NULL OR v_h->>'id'=v_b->>'id'
 OR v_g#>>ARRAY['controllersByPlayerId',v_expected_human,'kind'] IS DISTINCT FROM 'human'
 OR v_g#>>ARRAY['controllersByPlayerId',v_b->>'id','kind'] IS DISTINCT FROM 'bot'
 OR v_g#>>'{gameData,winStreakBonus,recipientPlayerId}' IS DISTINCT FROM v_b->>'id'
 OR pg_catalog.jsonb_typeof(v_g#>'{gameData,winStreakBonus,appliedCount}') IS DISTINCT FROM 'number'
 OR (v_g#>>'{gameData,winStreakBonus,appliedCount}') !~ '^[0-9]{1,16}$'
 OR v_g->>'status' IS NULL OR v_g->>'status' NOT IN ('active','finished')
 OR (v_g ? 'stateRevision' AND (pg_catalog.jsonb_typeof(v_g->'stateRevision') IS DISTINCT FROM 'number' OR (v_g->>'stateRevision') !~ '^[1-9][0-9]{0,15}$')) THEN
 RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 v_bonus:=(v_g#>>'{gameData,winStreakBonus,appliedCount}')::bigint;
 IF v_bonus>9007199254740991 THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 v_outcome:=NULL;
 IF v_g->>'status'='finished' THEN
 v_outcome:=CASE WHEN v_g->>'resultReason'='restart' THEN 'restart' WHEN v_g->>'resultReason' IN ('mutual_destruction','timeout_draw','agreement') THEN 'draw'
 WHEN v_g->>'winnerPlayerId'=v_expected_human THEN 'win' WHEN v_g->>'winnerPlayerId'=v_b->>'id' THEN 'loss' END;
 IF v_outcome IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
 END IF;
  IF v_outcome='restart' THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  IF v_g->>'gameId' IS DISTINCT FROM v_anchor THEN RAISE EXCEPTION USING ERRCODE='P2251',MESSAGE='STREAK_IMPORT_UNVERIFIED'; END IF;
  IF v_h->>'accountId' IS NOT NULL OR EXISTS (SELECT 1 FROM public.account_streak_runs r WHERE r.tracked_game_id=v_anchor) THEN
    RAISE EXCEPTION USING ERRCODE='P2252',MESSAGE='STREAK_IMPORT_CONSUMED'; END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR v_r.revision<>p_expected_revision THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  v_local:=v_reported;
  IF v_outcome='win' AND (p_guest->>'resultPending')::boolean THEN v_local:=LEAST(9007199254740991,v_local+1); END IF;
  v_accepted:=CASE WHEN v_outcome='loss' THEN 0 ELSE LEAST(v_local,v_bonus+CASE WHEN v_outcome='win' THEN 1 ELSE 0 END) END;
  v_accepted:=LEAST(9007199254740991,v_accepted);
  v_selection:=CASE WHEN p_decision='decline' THEN 'declined' WHEN v_accepted>v_r.current_count THEN 'guest' ELSE 'account' END;
  v_direct:=v_human=p_session_id;
  IF v_selection='guest' AND v_outcome IS NULL AND v_direct THEN
    v_continuation:='authorised'; v_update:=NULLIF(p_adoption->'update','null'::jsonb);
    IF p_adoption->>'gameId' IS DISTINCT FROM v_anchor OR v_update IS NULL
      OR NOT (p_adoption ? 'expectedRevision')
      OR (p_adoption->'expectedRevision'='null'::jsonb AND v_g ? 'stateRevision')
      OR (p_adoption->'expectedRevision' IS DISTINCT FROM 'null'::jsonb AND p_adoption->'expectedRevision' IS DISTINCT FROM v_g->'stateRevision')
      OR v_update->>'key' IS DISTINCT FROM 'game_'||v_anchor
      OR v_update#>>'{value,gameId}' IS DISTINCT FROM v_anchor
      OR v_update#>'{value,stateRevision}' IS DISTINCT FROM pg_catalog.to_jsonb(COALESCE((v_g->>'stateRevision')::bigint,1)+1)
      OR (v_update->'value')-'players'-'stateRevision' IS DISTINCT FROM v_g-'players'-'stateRevision'
      OR pg_catalog.jsonb_array_length(v_update#>'{value,players}') IS DISTINCT FROM 2
      OR v_update#>>'{game_head,gameId}' IS DISTINCT FROM v_anchor
      OR v_update#>'{game_head,stateRevision}' IS DISTINCT FROM v_update#>'{value,stateRevision}'
      OR v_update#>>'{game_head,status}' IS DISTINCT FROM v_g->>'status' THEN
      RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
    SELECT h INTO v_new_h FROM pg_catalog.jsonb_array_elements(v_update#>'{value,players}') h WHERE h->>'id'=v_human;
    SELECT b INTO v_new_b FROM pg_catalog.jsonb_array_elements(v_update#>'{value,players}') b WHERE b->>'id'=v_b->>'id';
    IF v_new_h-'accountId' IS DISTINCT FROM v_h-'accountId' OR v_new_h->>'accountId' IS DISTINCT FROM v_a.id::text OR v_new_b IS DISTINCT FROM v_b THEN
      RAISE EXCEPTION USING ERRCODE='P2253',MESSAGE='STREAK_SEAT_FORBIDDEN'; END IF;
  END IF;
  IF NOT v_direct AND p_adoption IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P2253',MESSAGE='STREAK_SEAT_FORBIDDEN'; END IF;
  v_anchor_revision:=COALESCE((v_g->>'stateRevision')::bigint,1);
  -- Reserve consumption before any adoption/selection writes. Only this PK conflict is replay.
  INSERT INTO public.account_streak_imports(anchor_game_id,account_id,anchor_human_player_id,source_session_id,
    reported_count,accepted_count,evidence_kind,selection,anchor_state_revision,continuation)
  VALUES(v_anchor,v_a.id,v_human,CASE WHEN v_direct THEN p_session_id END,v_reported,v_accepted,
    CASE WHEN v_direct THEN 'direct_session' ELSE 'stored_anchor' END,v_selection,v_anchor_revision,v_continuation)
  ON CONFLICT(anchor_game_id) DO NOTHING RETURNING * INTO v_i;
  IF NOT FOUND THEN
    SELECT i.* INTO STRICT v_i FROM public.account_streak_imports i WHERE i.anchor_game_id=v_anchor;
 IF v_i.account_id IS DISTINCT FROM v_a.id THEN RAISE EXCEPTION USING ERRCODE='P2252',MESSAGE='STREAK_IMPORT_CONSUMED'; END IF;
 RETURN pg_catalog.jsonb_build_object('streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at),'import',pg_catalog.jsonb_build_object('anchorGameId',v_i.anchor_game_id,'selection',v_i.selection,'acceptedCount',v_i.accepted_count,'continuation',v_i.continuation));
  END IF;
  IF v_continuation='authorised' THEN
    UPDATE public.kv_store_825e19ab SET value=v_update->'value',game_head=v_update->'game_head'
      WHERE key='game_'||v_anchor AND ((p_adoption->'expectedRevision'='null'::jsonb AND NOT (value ? 'stateRevision'))
        OR value->'stateRevision'=p_adoption->'expectedRevision');
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2250',MESSAGE='STREAK_CONFLICT'; END IF;
  END IF;
  IF v_selection='guest' THEN
    UPDATE public.account_streak_runs SET current_count=v_accepted,run_id=pg_catalog.gen_random_uuid(),
      tracked_game_id=CASE WHEN v_continuation='authorised' THEN v_anchor END,
      human_player_id=CASE WHEN v_continuation='authorised' THEN v_human END,
      tracked_status=CASE WHEN v_continuation='authorised' THEN 'unfinished' END,
      ended_count=NULL,ending_game_id=NULL,revision=revision+1,updated_at=pg_catalog.clock_timestamp()
      WHERE account_id=v_a.id RETURNING * INTO v_r;
  END IF;
  RETURN pg_catalog.jsonb_build_object('streak',pg_catalog.jsonb_build_object('accountId',v_r.account_id,'runId',v_r.run_id,'currentCount',v_r.current_count,'revision',v_r.revision::text,
 'trackedGame',CASE WHEN v_r.tracked_game_id IS NOT NULL THEN pg_catalog.jsonb_build_object('gameId',v_r.tracked_game_id,'humanPlayerId',v_r.human_player_id,'status',v_r.tracked_status) END,
 'endedStreak',CASE WHEN v_r.ended_count IS NOT NULL THEN pg_catalog.jsonb_build_object('count',v_r.ended_count,'endingGameId',v_r.ending_game_id) END,'updatedAt',v_r.updated_at),'import',pg_catalog.jsonb_build_object('anchorGameId',v_i.anchor_game_id,'selection',v_i.selection,'acceptedCount',v_i.accepted_count,'continuation',v_i.continuation));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_streak_import'),false),'Source pinned to reviewed scripts'
UNION ALL
SELECT 'source','account_owner_streak_lookup: exact CR-normalised body',COALESCE((SELECT pg_catalog.bool_and(pg_catalog.replace(p.prosrc,E'\r','')=pg_catalog.replace($expected$
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner routine requires postgres'; END IF;
  RETURN pg_catalog.jsonb_build_object('run',(SELECT pg_catalog.to_jsonb(r) FROM public.account_streak_runs r WHERE r.account_id=p_account_id),
    'imports',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.consumed_at DESC,i.anchor_game_id)
      FROM (SELECT * FROM public.account_streak_imports WHERE account_id=p_account_id ORDER BY consumed_at DESC,anchor_game_id LIMIT 100) i),'[]'::jsonb));
END;
$expected$,E'\r','')) AND count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='account_owner_streak_lookup'),false),'Source pinned to reviewed scripts'
), results AS (
  SELECT 0 AS sort_order, 'overall' AS category, 'SET 05' AS check_name,
    bool_and(COALESCE(passed, false)) AS passed,
    count(*) FILTER (WHERE NOT COALESCE(passed, false))::text || ' failing checks' AS detail FROM checks
  UNION ALL SELECT 1, category, check_name, COALESCE(passed, false), detail FROM checks
)
SELECT category, check_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, detail
FROM results ORDER BY sort_order, category, check_name
) checked WHERE result<>'PASS') THEN RAISE EXCEPTION 'Set 05 restoration check failed'; END IF; END; $restored$;
COMMIT;
