-- Phase 22C.1 / set 01. Run the entire file once as postgres in the SQL editor.
-- Take a private manual export first. No CLI migrations or local-live.
BEGIN;
SET LOCAL lock_timeout = '3s';

DO $preconditions$
DECLARE
  kv_name text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Set 01 requires the SQL editor postgres role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND left(c.relname, 8) = 'account_'
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND left(p.proname, 8) = 'account_'
  ) THEN
    RAISE EXCEPTION 'Unexpected account objects already exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = to_regclass('public.screen_names')
      AND relkind = 'r' AND relrowsecurity AND NOT relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'screen_names missing or table/RLS posture differs';
  END IF;
  -- Hold the empty-stub check stable through its removal. Locks change no data.
  LOCK TABLE public.screen_names IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.screen_names) THEN
    RAISE EXCEPTION 'screen_names is not empty';
  END IF;
  IF EXISTS (
    WITH expected(name, type_name, not_null, default_expr) AS (VALUES
      ('user_id', 'uuid', true, NULL::text),
      ('screen_name', 'text', true, NULL::text),
      ('screen_name_lower', 'text', true, NULL::text),
      ('created_at', 'timestamp with time zone', true, 'now()')
    ), actual AS (
      SELECT a.attname::text, format_type(a.atttypid, a.atttypmod), a.attnotnull,
        pg_get_expr(d.adbin, d.adrelid)
      FROM pg_attribute a LEFT JOIN pg_attrdef d
        ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'public.screen_names'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
    )
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  ) OR EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = 'public.screen_names'::regclass
      AND attnum > 0 AND NOT attisdropped AND (attidentity <> '' OR attgenerated <> '')
  ) THEN
    RAISE EXCEPTION 'screen_names columns differ from inventory';
  END IF;
  IF EXISTS (
    WITH expected(name, definition) AS (VALUES
      ('screen_names_lower_unique', 'UNIQUE (screen_name_lower)'),
      ('screen_names_user_id_unique', 'UNIQUE (user_id)'),
      ('screen_names_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE')
    ), actual AS (
      SELECT conname::text, pg_get_constraintdef(oid)
      FROM pg_constraint WHERE conrelid = 'public.screen_names'::regclass
    )
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  ) THEN
    RAISE EXCEPTION 'screen_names constraints differ from inventory';
  END IF;
  IF EXISTS (
    WITH expected(name, definition) AS (VALUES
      ('idx_screen_names_created_at', 'CREATE INDEX idx_screen_names_created_at ON public.screen_names USING btree (created_at)'),
      ('screen_names_lower_unique', 'CREATE UNIQUE INDEX screen_names_lower_unique ON public.screen_names USING btree (screen_name_lower)'),
      ('screen_names_user_id_unique', 'CREATE UNIQUE INDEX screen_names_user_id_unique ON public.screen_names USING btree (user_id)')
    ), actual AS (
      SELECT i.relname::text, pg_get_indexdef(i.oid)
      FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
      WHERE x.indrelid = 'public.screen_names'::regclass
    )
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  ) OR EXISTS (
    SELECT 1 FROM pg_index WHERE indrelid = 'public.screen_names'::regclass
      AND (NOT indisvalid OR NOT indisready)
  ) THEN
    RAISE EXCEPTION 'screen_names indexes differ from inventory';
  END IF;
  IF EXISTS (
    WITH expected(name, command, permissive, roles, using_expr, check_expr) AS (VALUES
      ('public read', 'r', true, ARRAY[0::oid], 'true', NULL::text),
      ('no direct inserts', 'a', true, ARRAY[0::oid], NULL::text, 'false')
    ), actual AS (
      SELECT polname::text, polcmd::text, polpermissive, polroles,
        pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
      FROM pg_policy WHERE polrelid = 'public.screen_names'::regclass
    )
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  ) THEN
    RAISE EXCEPTION 'screen_names policies differ from inventory';
  END IF;
  FOREACH kv_name IN ARRAY ARRAY[
    'kv_store_825e19ab', 'kv_store_825e19ab_pre_alpha_archive_20260429',
    'kv_store_2243ca4c', 'kv_store_67bdd4b5'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = to_regclass('public.' || kv_name) AND relkind = 'r'
    ) THEN
      RAISE EXCEPTION 'Missing inventoried KV table: %', kv_name;
    END IF;
    IF EXISTS (
      SELECT 1 FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(privilege)
      WHERE NOT has_table_privilege(r.role_name, 'public.' || kv_name, p.privilege)
    ) THEN
      RAISE EXCEPTION 'KV browser privileges differ from inventory: %', kv_name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM auth.users) <> 1 THEN
    RAISE EXCEPTION 'auth.users row count differs from inventory';
  END IF;
END;
$preconditions$;

-- All preconditions have passed. No CASCADE drops and no Auth-user mutation.
DROP POLICY "public read" ON public.screen_names;
DROP POLICY "no direct inserts" ON public.screen_names;
ALTER TABLE public.screen_names DROP CONSTRAINT screen_names_user_id_fkey;
ALTER TABLE public.screen_names DROP CONSTRAINT screen_names_lower_unique;
ALTER TABLE public.screen_names DROP CONSTRAINT screen_names_user_id_unique;
DROP INDEX public.idx_screen_names_created_at RESTRICT;
DROP TABLE public.screen_names RESTRICT;

CREATE TABLE public.account_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name text NOT NULL CONSTRAINT account_accounts_display_name_check
    CHECK (display_name COLLATE "C" ~ '^[A-Za-z0-9]{3,20}$'),
  name_key text COLLATE "C" GENERATED ALWAYS AS (lower(display_name COLLATE "C")) STORED NOT NULL,
  CONSTRAINT account_accounts_name_key_key UNIQUE (name_key),
  status text NOT NULL DEFAULT 'active' CONSTRAINT account_accounts_status_check CHECK (status IN ('active', 'blocked')),
  security_version bigint NOT NULL DEFAULT 1 CONSTRAINT account_accounts_security_version_check CHECK (security_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.account_credentials (
  account_id uuid PRIMARY KEY REFERENCES public.account_accounts(id) ON DELETE CASCADE,
  password_hash text NOT NULL CONSTRAINT account_credentials_password_hash_check CHECK (char_length(password_hash) BETWEEN 1 AND 512),
  password_format text NOT NULL CONSTRAINT account_credentials_password_format_check CHECK (char_length(password_format) BETWEEN 1 AND 64),
  must_change_password boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.account_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.account_accounts(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE CONSTRAINT account_tokens_token_hash_check CHECK (octet_length(token_hash) = 32),
  security_version bigint NOT NULL CONSTRAINT account_tokens_security_version_check CHECK (security_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX account_tokens_account_id_idx ON public.account_tokens (account_id);
CREATE INDEX account_tokens_expires_at_idx ON public.account_tokens (expires_at);
CREATE TABLE public.account_session_links (
  session_id text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.account_accounts(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.account_tokens(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  detached_at timestamptz
);
CREATE INDEX account_session_links_account_id_idx ON public.account_session_links (account_id);
CREATE INDEX account_session_links_token_id_idx ON public.account_session_links (token_id);
CREATE TABLE public.account_preferences (
  account_id uuid PRIMARY KEY REFERENCES public.account_accounts(id) ON DELETE CASCADE,
  sound_enabled boolean NOT NULL,
  health_flash_enabled boolean NOT NULL,
  chat_minimized boolean NOT NULL,
  battle_log_preferred boolean NOT NULL,
  music_enabled boolean NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CONSTRAINT account_preferences_revision_check CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.account_name_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CONSTRAINT account_name_rules_kind_check CHECK (kind IN ('banned', 'reserved', 'exception')),
  match_kind text NOT NULL CONSTRAINT account_name_rules_match_kind_check CHECK (match_kind IN ('exact', 'contains')),
  match_key text NOT NULL CONSTRAINT account_name_rules_match_key_check CHECK (char_length(match_key) BETWEEN 1 AND 64),
  source text NOT NULL CONSTRAINT account_name_rules_source_check CHECK (char_length(source) BETWEEN 1 AND 256),
  note text NOT NULL CONSTRAINT account_name_rules_note_check CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_name_rules_exact_check CHECK (kind = 'banned' OR match_kind = 'exact'),
  CONSTRAINT account_name_rules_kind_match_kind_match_key_key UNIQUE (kind, match_kind, match_key)
);
CREATE TABLE public.account_rate_limits (
  scope text NOT NULL CONSTRAINT account_rate_limits_scope_check CHECK (scope IN (
    'name_check_ip', 'name_check_target', 'claim_ip', 'claim_target', 'signin_ip',
    'signin_failure_ip_target', 'signin_failure_target', 'account_token',
    'account_unknown_ip', 'captcha_replay', 'name_check_global', 'claim_global',
    'signin_global', 'password_global'
  )),
  subject_hash bytea NOT NULL CONSTRAINT account_rate_limits_subject_hash_check CHECK (octet_length(subject_hash) = 32),
  window_start timestamptz NOT NULL,
  count integer NOT NULL CONSTRAINT account_rate_limits_count_check CHECK (count >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, subject_hash, window_start)
);
CREATE INDEX account_rate_limits_expires_at_idx ON public.account_rate_limits (expires_at);
CREATE TABLE public.account_owner_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES public.account_accounts(id) ON DELETE SET NULL,
  rule_key text,
  action text NOT NULL CONSTRAINT account_owner_events_action_check CHECK (action IN (
    'password_reset', 'account_block', 'account_unblock', 'name_rule_add',
    'name_rule_remove', 'tokens_revoke', 'cleanup'
  )),
  note text NOT NULL CONSTRAINT account_owner_events_note_check CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_owner_events_account_id_created_at_idx ON public.account_owner_events (account_id, created_at);

DO $access$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'account_accounts', 'account_credentials', 'account_tokens', 'account_session_links',
    'account_preferences', 'account_name_rules', 'account_rate_limits', 'account_owner_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    -- Reset service_role too: inherited ALL would retain unnecessary privileges.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', table_name);
    IF table_name = 'account_owner_events' THEN
      EXECUTE format('GRANT SELECT, INSERT, DELETE ON TABLE public.%I TO service_role', table_name);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END;
$access$;

REVOKE ALL ON TABLE public.kv_store_825e19ab,
  public.kv_store_825e19ab_pre_alpha_archive_20260429,
  public.kv_store_2243ca4c, public.kv_store_67bdd4b5 FROM anon, authenticated;
COMMIT;
