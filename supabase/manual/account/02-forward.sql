-- Phase 22C.2a / set 02. Entire file, postgres SQL editor; export first.
-- No tables, seeds, KV changes, hashing, network work or automatic application.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $preconditions$
DECLARE v_name text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Set 02 requires postgres'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND pg_catalog.left(p.proname, 8) = 'account_') THEN
    RAISE EXCEPTION 'Set 02 requires no existing account functions';
  END IF;
  FOREACH v_name IN ARRAY ARRAY['account_accounts','account_credentials','account_tokens','account_session_links',
    'account_preferences','account_name_rules','account_rate_limits','account_owner_events'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid = pg_catalog.to_regclass('public.' || v_name)
      AND c.relkind = 'r' AND c.relrowsecurity) OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid = pg_catalog.to_regclass('public.' || v_name)) THEN
      RAISE EXCEPTION 'Set 01 table/RLS/policy prerequisite differs: %', v_name;
    END IF;
    IF EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) r(role_name)
      CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) x(privilege)
      WHERE pg_catalog.has_table_privilege(r.role_name, 'public.' || v_name, x.privilege)) THEN
      RAISE EXCEPTION 'Set 01 browser grants differ: %', v_name;
    END IF;
    IF EXISTS (SELECT 1 FROM (VALUES ('SELECT'),('INSERT'),('DELETE')) x(privilege)
      WHERE NOT pg_catalog.has_table_privilege('service_role', 'public.' || v_name, x.privilege)) OR
      (v_name <> 'account_owner_events' AND NOT pg_catalog.has_table_privilege('service_role', 'public.' || v_name, 'UPDATE')) THEN
      RAISE EXCEPTION 'Set 01 service grants missing: %', v_name;
    END IF;
  END LOOP;
  IF pg_catalog.to_regclass('public.screen_names') IS NOT NULL THEN RAISE EXCEPTION 'Set 01 stub removal missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.account_accounts'::regclass AND conname = 'account_accounts_name_key_key' AND contype = 'u')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.account_credentials'::regclass
      AND attname = 'must_change_password' AND atttypid = 'boolean'::regtype AND attnotnull) THEN
    RAISE EXCEPTION 'Set 01 constraints/credential prerequisite differs';
  END IF;
END;
$preconditions$;

CREATE FUNCTION public.account_check_name(p_name_key text, p_moderation_key text, p_check_reserved boolean)
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

CREATE FUNCTION public.account_link_session(p_session_id text, p_account_id uuid, p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_read_credential(p_name_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
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
$function$;

CREATE FUNCTION public.account_claim(p_display_name text, p_name_key text, p_moderation_key text,
  p_password_hash text, p_password_format text, p_token_hash bytea, p_session_id text,
  p_sound_enabled boolean, p_health_flash_enabled boolean, p_chat_minimized boolean,
  p_battle_log_preferred boolean, p_music_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_finish_signin(p_account_id uuid, p_expected_security_version bigint, p_expected_password_hash text, p_expected_password_format text,
  p_token_hash bytea, p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_resume(p_token_hash bytea, p_session_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_logout(p_token_hash bytea)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_change_password(p_account_id uuid, p_expected_security_version bigint, p_expected_password_hash text, p_expected_password_format text,
  p_new_password_hash text, p_new_password_format text, p_token_hash bytea, p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_rehash(p_account_id uuid, p_expected_security_version bigint, p_expected_password_hash text, p_expected_password_format text,
  p_new_password_hash text, p_new_password_format text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
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
$function$;

CREATE FUNCTION public.account_identity(p_token_hash bytea, p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
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
$function$;

-- Counter inherited browser EXECUTE before commit, for every exact signature.
REVOKE ALL ON FUNCTION public.account_check_name(text,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_check_name(text,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.account_link_session(text,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_link_session(text,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.account_read_credential(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_read_credential(text) TO service_role;
REVOKE ALL ON FUNCTION public.account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_claim(text,text,text,text,text,bytea,text,boolean,boolean,boolean,boolean,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.account_finish_signin(uuid,bigint,text,text,bytea,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_finish_signin(uuid,bigint,text,text,bytea,text) TO service_role;
REVOKE ALL ON FUNCTION public.account_resume(bytea,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_resume(bytea,text) TO service_role;
REVOKE ALL ON FUNCTION public.account_logout(bytea) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_logout(bytea) TO service_role;
REVOKE ALL ON FUNCTION public.account_change_password(uuid,bigint,text,text,text,text,bytea,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_change_password(uuid,bigint,text,text,text,text,bytea,text) TO service_role;
REVOKE ALL ON FUNCTION public.account_rehash(uuid,bigint,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_rehash(uuid,bigint,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.account_identity(bytea,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_identity(bytea,text) TO service_role;
COMMIT;
