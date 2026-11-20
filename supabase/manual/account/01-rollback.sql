-- Run the WHOLE file as postgres, after reversing later sets. Export first.
BEGIN;
SET LOCAL lock_timeout = '3s';

DO $preconditions$
DECLARE
  allow_account_data_loss boolean := false;
  table_name text;
  has_rows boolean;
BEGIN
  -- DANGER: uncomment only after exporting and explicitly accepting account-data loss:
  -- allow_account_data_loss := true;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Set 01 rollback requires the SQL editor postgres role';
  END IF;
  IF to_regclass('public.screen_names') IS NOT NULL THEN
    RAISE EXCEPTION 'screen_names already exists; rollback refuses to overwrite it';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND left(p.proname, 8) = 'account_'
  ) THEN
    RAISE EXCEPTION 'Reverse later account SQL sets before set 01';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND left(c.relname, 8) = 'account_'
      AND c.relname NOT IN ('account_accounts', 'account_credentials', 'account_tokens',
        'account_session_links', 'account_preferences', 'account_name_rules',
        'account_rate_limits', 'account_owner_events')
  ) THEN
    RAISE EXCEPTION 'Unexpected additional account tables';
  END IF;
  FOREACH table_name IN ARRAY ARRAY[
    'account_accounts', 'account_credentials', 'account_tokens', 'account_session_links',
    'account_preferences', 'account_name_rules', 'account_rate_limits', 'account_owner_events'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = to_regclass('public.' || table_name) AND relkind = 'r'
    ) THEN
      RAISE EXCEPTION 'Missing account table: %', table_name;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', table_name);
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', table_name) INTO has_rows;
    IF has_rows AND NOT allow_account_data_loss THEN
      RAISE EXCEPTION 'Account table % has rows; rollback would destroy account data', table_name;
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY[
    'kv_store_825e19ab', 'kv_store_825e19ab_pre_alpha_archive_20260429',
    'kv_store_2243ca4c', 'kv_store_67bdd4b5'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = to_regclass('public.' || table_name) AND relkind = 'r'
    ) THEN
      RAISE EXCEPTION 'Missing inventoried KV table: %', table_name;
    END IF;
  END LOOP;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users is missing';
  END IF;
END;
$preconditions$;

-- All preconditions passed. RESTRICT also fails safely on unexpected dependencies.
DROP TABLE public.account_session_links RESTRICT;
DROP TABLE public.account_credentials RESTRICT;
DROP TABLE public.account_preferences RESTRICT;
DROP TABLE public.account_tokens RESTRICT;
DROP TABLE public.account_rate_limits RESTRICT;
DROP TABLE public.account_name_rules RESTRICT;
DROP TABLE public.account_owner_events RESTRICT;
DROP TABLE public.account_accounts RESTRICT;

CREATE TABLE public.screen_names (
  user_id uuid NOT NULL,
  screen_name text NOT NULL,
  screen_name_lower text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT screen_names_lower_unique UNIQUE (screen_name_lower),
  CONSTRAINT screen_names_user_id_unique UNIQUE (user_id),
  CONSTRAINT screen_names_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_screen_names_created_at ON public.screen_names USING btree (created_at);
ALTER TABLE public.screen_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.screen_names AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "no direct inserts" ON public.screen_names AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (false);
-- Explicitly reproduce the inventoried public-schema default grants (arwdDxt).
REVOKE ALL ON TABLE public.screen_names FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.screen_names TO anon, authenticated, service_role;
-- Original exact KV ACL letters were not inventoried. ALL is the approved superset.
GRANT ALL ON TABLE public.kv_store_825e19ab,
  public.kv_store_825e19ab_pre_alpha_archive_20260429,
  public.kv_store_2243ca4c, public.kv_store_67bdd4b5 TO anon, authenticated;
COMMIT;
