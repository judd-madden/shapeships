-- One SELECT / one result. Run as postgres after set 01 and before later sets.
WITH
account_tables(name) AS (VALUES
  ('account_accounts'), ('account_credentials'), ('account_tokens'),
  ('account_session_links'), ('account_preferences'), ('account_name_rules'),
  ('account_rate_limits'), ('account_owner_events')
), kv_tables(name, require_rows) AS (VALUES
  ('kv_store_825e19ab', true),
  ('kv_store_825e19ab_pre_alpha_archive_20260429', true),
  ('kv_store_2243ca4c', true), ('kv_store_67bdd4b5', false)
), all_tables AS (
  SELECT name FROM account_tables UNION ALL SELECT name FROM kv_tables
), relations AS (
  SELECT t.name, c.oid, c.relkind, c.relrowsecurity, c.relowner, c.relacl
  FROM all_tables t LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || t.name)
), expected_constraints(table_name, name, kind) AS (VALUES
  ('account_accounts', 'account_accounts_pkey', 'p'),
  ('account_accounts', 'account_accounts_name_key_key', 'u'),
  ('account_accounts', 'account_accounts_display_name_check', 'c'),
  ('account_accounts', 'account_accounts_status_check', 'c'),
  ('account_accounts', 'account_accounts_security_version_check', 'c'),
  ('account_credentials', 'account_credentials_pkey', 'p'),
  ('account_credentials', 'account_credentials_account_id_fkey', 'f'),
  ('account_credentials', 'account_credentials_password_hash_check', 'c'),
  ('account_credentials', 'account_credentials_password_format_check', 'c'),
  ('account_tokens', 'account_tokens_pkey', 'p'),
  ('account_tokens', 'account_tokens_account_id_fkey', 'f'),
  ('account_tokens', 'account_tokens_token_hash_key', 'u'),
  ('account_tokens', 'account_tokens_token_hash_check', 'c'),
  ('account_tokens', 'account_tokens_security_version_check', 'c'),
  ('account_session_links', 'account_session_links_pkey', 'p'),
  ('account_session_links', 'account_session_links_account_id_fkey', 'f'),
  ('account_session_links', 'account_session_links_token_id_fkey', 'f'),
  ('account_preferences', 'account_preferences_pkey', 'p'),
  ('account_preferences', 'account_preferences_account_id_fkey', 'f'),
  ('account_preferences', 'account_preferences_revision_check', 'c'),
  ('account_name_rules', 'account_name_rules_pkey', 'p'),
  ('account_name_rules', 'account_name_rules_kind_check', 'c'),
  ('account_name_rules', 'account_name_rules_match_kind_check', 'c'),
  ('account_name_rules', 'account_name_rules_match_key_check', 'c'),
  ('account_name_rules', 'account_name_rules_source_check', 'c'),
  ('account_name_rules', 'account_name_rules_note_check', 'c'),
  ('account_name_rules', 'account_name_rules_exact_check', 'c'),
  ('account_name_rules', 'account_name_rules_kind_match_kind_match_key_key', 'u'),
  ('account_rate_limits', 'account_rate_limits_pkey', 'p'),
  ('account_rate_limits', 'account_rate_limits_scope_check', 'c'),
  ('account_rate_limits', 'account_rate_limits_subject_hash_check', 'c'),
  ('account_rate_limits', 'account_rate_limits_count_check', 'c'),
  ('account_owner_events', 'account_owner_events_pkey', 'p'),
  ('account_owner_events', 'account_owner_events_account_id_fkey', 'f'),
  ('account_owner_events', 'account_owner_events_action_check', 'c'),
  ('account_owner_events', 'account_owner_events_note_check', 'c')
), expected_indexes(table_name, name, keys, is_unique) AS (VALUES
  ('account_accounts', 'account_accounts_pkey', ARRAY['id'], true),
  ('account_accounts', 'account_accounts_name_key_key', ARRAY['name_key'], true),
  ('account_credentials', 'account_credentials_pkey', ARRAY['account_id'], true),
  ('account_tokens', 'account_tokens_pkey', ARRAY['id'], true),
  ('account_tokens', 'account_tokens_token_hash_key', ARRAY['token_hash'], true),
  ('account_tokens', 'account_tokens_account_id_idx', ARRAY['account_id'], false),
  ('account_tokens', 'account_tokens_expires_at_idx', ARRAY['expires_at'], false),
  ('account_session_links', 'account_session_links_pkey', ARRAY['session_id'], true),
  ('account_session_links', 'account_session_links_account_id_idx', ARRAY['account_id'], false),
  ('account_session_links', 'account_session_links_token_id_idx', ARRAY['token_id'], false),
  ('account_preferences', 'account_preferences_pkey', ARRAY['account_id'], true),
  ('account_name_rules', 'account_name_rules_pkey', ARRAY['id'], true),
  ('account_name_rules', 'account_name_rules_kind_match_kind_match_key_key', ARRAY['kind','match_kind','match_key'], true),
  ('account_rate_limits', 'account_rate_limits_pkey', ARRAY['scope','subject_hash','window_start'], true),
  ('account_rate_limits', 'account_rate_limits_expires_at_idx', ARRAY['expires_at'], false),
  ('account_owner_events', 'account_owner_events_pkey', ARRAY['id'], true),
  ('account_owner_events', 'account_owner_events_account_id_created_at_idx', ARRAY['account_id','created_at'], false)
), counts AS (
  -- Guard dynamic read-only counts so a missing relation yields FAIL, not a parse error.
  SELECT name, require_rows, CASE WHEN to_regclass('public.' || name) IS NOT NULL THEN
    ((xpath('/table/row/n/text()', query_to_xml(
      format('SELECT count(*) AS n FROM public.%I', name), false, false, ''
    )))[1])::text::bigint ELSE NULL END AS row_count
  FROM kv_tables
  UNION ALL
  SELECT 'auth.users', true, CASE WHEN to_regclass('auth.users') IS NOT NULL THEN
    ((xpath('/table/row/n/text()', query_to_xml('SELECT count(*) AS n FROM auth.users', false, false, '')))[1])::text::bigint
    ELSE NULL END
), checks(category, check_name, passed, detail) AS (
  SELECT 'tables', a.name || ': exists, RLS, zero policies',
    COALESCE(r.relkind = 'r' AND r.relrowsecurity AND NOT EXISTS (
      SELECT 1 FROM pg_policy WHERE polrelid = r.oid
    ), false), 'Required: ordinary table, RLS enabled, no policies'
  FROM account_tables a JOIN relations r USING (name)
  UNION ALL
  SELECT 'collateral', k.name || ': table exists', COALESCE(r.relkind = 'r', false),
    'Retained inventoried KV table'
  FROM kv_tables k JOIN relations r USING (name)
  UNION ALL
  SELECT 'access', r.name || ': ' || role_name || ' has no table/column privileges',
    r.oid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM aclexplode(COALESCE(r.relacl, acldefault('r', r.relowner))) acl
      WHERE CASE WHEN acl.grantee = 0 THEN true ELSE pg_has_role(role_name, acl.grantee, 'USAGE') END
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE a.attrelid = r.oid AND CASE WHEN acl.grantee = 0 THEN true ELSE pg_has_role(role_name, acl.grantee, 'USAGE') END
    ), 'Includes PUBLIC and inherited grants, column ACLs and all privilege types'
  FROM relations r CROSS JOIN (VALUES ('anon'), ('authenticated')) roles(role_name)
  UNION ALL
  SELECT 'access', a.name || ': PUBLIC has no privileges',
    r.oid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM aclexplode(COALESCE(r.relacl, acldefault('r', r.relowner))) acl WHERE acl.grantee = 0
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_attribute col CROSS JOIN LATERAL aclexplode(col.attacl) acl
      WHERE col.attrelid = r.oid AND acl.grantee = 0
    ), 'No PUBLIC table or column ACL'
  FROM account_tables a JOIN relations r USING (name)
  UNION ALL
  SELECT 'access', a.name || ': service_role exact privileges',
    COALESCE((
      SELECT array_agg(DISTINCT privilege_type ORDER BY privilege_type) = CASE
        WHEN a.name = 'account_owner_events' THEN ARRAY['DELETE','INSERT','SELECT']
        ELSE ARRAY['DELETE','INSERT','SELECT','UPDATE'] END
        AND NOT bool_or(is_grantable)
      FROM aclexplode(COALESCE(r.relacl, acldefault('r', r.relowner))) acl
      WHERE CASE WHEN acl.grantee = 0 THEN true ELSE pg_has_role('service_role', acl.grantee, 'USAGE') END
    ), false), 'DML only; owner events omit UPDATE; no grant option'
  FROM account_tables a JOIN relations r USING (name)
  UNION ALL
  SELECT 'schema', e.table_name || ': constraint ' || e.name,
    COALESCE(c.contype::text = e.kind AND c.convalidated AND NOT c.condeferrable, false),
    COALESCE(pg_get_constraintdef(c.oid), 'Missing')
  FROM expected_constraints e LEFT JOIN pg_constraint c
    ON c.conrelid = to_regclass('public.' || e.table_name) AND c.conname = e.name
  UNION ALL
  SELECT 'schema', e.table_name || ': index ' || e.name,
    COALESCE(x.indrelid = to_regclass('public.' || e.table_name)
      AND x.indisvalid AND x.indisready AND x.indisunique = e.is_unique
      AND x.indpred IS NULL AND x.indexprs IS NULL AND am.amname = 'btree'
      AND x.indnatts = cardinality(e.keys) AND ARRAY(
        SELECT att.attname::text FROM unnest(x.indkey) WITH ORDINALITY k(num, position)
        JOIN pg_attribute att ON att.attrelid = x.indrelid AND att.attnum = k.num
        ORDER BY k.position
      ) = e.keys, false), COALESCE(pg_get_indexdef(i.oid), 'Missing')
  FROM expected_indexes e LEFT JOIN pg_class i ON i.oid = to_regclass('public.' || e.name)
  LEFT JOIN pg_index x ON x.indexrelid = i.oid LEFT JOIN pg_am am ON am.oid = i.relam
  UNION ALL
  SELECT 'schema', 'No account sequences or sequence defaults',
    NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S' AND left(c.relname, 8) = 'account_'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_attribute a JOIN account_tables t ON a.attrelid = to_regclass('public.' || t.name)
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attidentity <> '' OR pg_get_expr(d.adbin, d.adrelid) LIKE '%nextval(%'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_depend d JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
      JOIN account_tables t ON d.refobjid = to_regclass('public.' || t.name)
      WHERE d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
    ), 'UUID defaults and natural/composite keys; no sequences'
  UNION ALL
  SELECT 'schema', 'ASCII display-name check and generated C-lowercase key',
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.account_accounts')
      AND conname = 'account_accounts_display_name_check' AND pg_get_constraintdef(oid) LIKE '%^[A-Za-z0-9]{3,20}$%')
    AND EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      JOIN pg_collation col ON col.oid = a.attcollation
      WHERE a.attrelid = to_regclass('public.account_accounts') AND a.attname = 'name_key'
        AND a.attgenerated = 's' AND a.attnotnull AND col.collname = 'C'
        AND regexp_replace(pg_get_expr(d.adbin, d.adrelid), '[[:space:]()]', '', 'g') = 'lowerdisplay_nameCOLLATE"C"'
    ), 'Explicit ASCII regex; lower(display_name COLLATE "C")'
  UNION ALL
  SELECT 'schema', 'must_change_password is NOT NULL boolean default false',
    EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = to_regclass('public.account_credentials') AND a.attname = 'must_change_password'
        AND a.atttypid = 'boolean'::regtype AND a.attnotnull AND pg_get_expr(d.adbin, d.adrelid) = 'false'),
    'Forced-change flag exists before password implementation'
  UNION ALL
  SELECT 'schema', 'Session link columns match LA11',
    ARRAY(SELECT a.attname::text FROM pg_attribute a
      WHERE a.attrelid = to_regclass('public.account_session_links') AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attname) = ARRAY['account_id','detached_at','linked_at','session_id','token_id'], 'No link revision or updated_at'
  UNION ALL
  SELECT 'collateral', 'screen_names is gone', to_regclass('public.screen_names') IS NULL, 'Auth user is retained'
  UNION ALL
  SELECT 'collateral', name || ': retained rows', COALESCE(CASE WHEN name = 'auth.users'
    THEN row_count = 1 ELSE row_count >= CASE WHEN require_rows THEN 1 ELSE 0 END END, false),
    'Current row count: ' || COALESCE(row_count::text, 'MISSING') || '; historical KV counts are not exact baselines'
  FROM counts
  UNION ALL
  SELECT 'collateral', 'Active KV still has exactly 2 indexes',
    to_regclass('public.kv_store_825e19ab') IS NOT NULL AND
    (SELECT count(*) FROM pg_index WHERE indrelid = to_regclass('public.kv_store_825e19ab')) = 2,
    'No KV index changes in this set'
  UNION ALL
  SELECT 'schema', 'No account functions yet', NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND left(p.proname, 8) = 'account_'
  ), 'RPCs belong to set 02 and later'
), results AS (
  SELECT 0 AS sort_order, 'overall' AS category, 'SET 01' AS check_name,
    bool_and(COALESCE(passed, false)) AS passed,
    count(*) FILTER (WHERE NOT COALESCE(passed, false))::text || ' failing checks' AS detail FROM checks
  UNION ALL
  SELECT 1, category, check_name, COALESCE(passed, false), detail FROM checks
)
SELECT category, check_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, detail
FROM results ORDER BY sort_order, category, check_name;
