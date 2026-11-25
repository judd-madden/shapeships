// ⚠️ SERVER KERNEL RULE
// This file must NOT contain game rules.
// All rule decisions must be delegated to the shared game engine.
// This file only:
// - validates intents (structure/format)
// - updates clocks (server time authority)
// - calls engine (delegation)
// - emits events (sequencing)
// - persists state (KV storage)
// - filters hidden info (commit/reveal protocol)

// ============================================================================
// ALPHA v3 FEATURE FLAGS
// ============================================================================
// Set to false Post-Alpha to re-enable authentication endpoints
const ALPHA_DISABLE_AUTH = true;
const ENABLE_TEST_ROUTES = Deno.env.get("ENABLE_TEST_ROUTES") === "true";

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { SERVER_DEBUG_LOGS_ENABLED } from "./utils/serverLogger.ts";

// Import route registration functions
import { registerAuthRoutes } from "./routes/auth_routes.ts";
import {
  accountCorsOptions,
  accountPrivacyMiddleware,
  registerAccountRoutes,
  registerSessionMeRoute,
} from "./routes/account_routes.ts";
import type { AccountLog } from "./accounts/accountService.ts";
import { accountServiceLoader } from "./accounts/accountServiceLoader.ts";
import { accountsMode } from "./accounts/accountsMode.ts";
import { createGameIdentityRepository } from "./accounts/accountRepository.ts";
import {
  createGameRequestIdentity,
  createGameSessionNameBinder,
  createGameSessionRenewer,
  gameSessionExpired,
  type GameIdentityRouteOptions,
  type GameRequestIdentity,
} from "./accounts/gameRequestIdentity.ts";
import { accountError } from "./accounts/accountResponses.ts";
import { registerTestRoutes } from "./routes/test_routes.ts";
import { registerGameRoutes } from "./routes/game_routes.ts";
import { registerIntentRoutes } from "./routes/intent_routes.ts";
import { createIntentPersistence } from "./routes/intent_persistence.ts";
import { generateSecureGameId } from "./routes/game_id_allocation.ts";

const app = new Hono();

const getSupabaseUrl = () =>
  Deno.env.get("SHAPESHIPS_SUPABASE_URL") ||
  Deno.env.get("SUPABASE_URL") ||
  "";

const getSupabaseBackendKey = () =>
  Deno.env.get("SHAPESHIPS_SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SHAPESHIPS_SUPABASE_SECRET_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

// Create Supabase client using server-only environment variables.
const supabase = createClient(
  getSupabaseUrl(),
  getSupabaseBackendKey()
);

// ============================================================================
// KV STORE UTILITIES - ALL INLINE, NO IMPORTS (FIXED)
// ============================================================================
const kvGet = async (key: string) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) return null;
  return data?.value;
};

const kvSet = async (key: string, value: unknown) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert({ key, value });
  
  if (error) throw error;
};

const kvDel = async (key: string) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .eq('key', key);
  
  if (error) throw error;
};

const kvMget = async (keys: string[]) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .in('key', keys);
  
  if (error) return [];
  return data?.map(d => d.value) ?? [];
};

const kvMset = async (keys: string[], values: unknown[]) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert(keys.map((k: string, i: number) => ({ key: k, value: values[i] })));
  
  if (error) throw error;
};

const kvMdel = async (keys: string[]) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .in('key', keys);
  
  if (error) throw error;
};

const kvGetByPrefix = async (prefix: string) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('key, value')
    .like('key', prefix + '%');
  
  if (error) return [];
  return data?.map(d => d.value) ?? [];
};

// ============================================================================
// ALPHA v3 SESSION IDENTITY SYSTEM
// ============================================================================
// Server-minted session tokens for Alpha v3
// Client cannot send authoritative playerId - server derives identity from token
// Session minting functions (generateSessionToken, generateSessionId) are 
// defined in routes/auth_routes.ts where /session/start lives.
// ============================================================================

// Validate session token and return session identity
// Alpha v3: Check token exists and isn't expired
// Returns { sessionId, createdAt, displayName } on success, null on failure
const validateSessionToken = async (token: string) => {
  if (!token) {
    console.error('Session validation failed: No token provided');
    return null;
  }

  try {
    const sessionData = await kvGet(`session_token_${token}`);
    
    if (!sessionData) {
      console.error('Session validation failed: Token not found');
      return null;
    }

    // Accepted intents extend the TTL; legacy records use creation time.
    if (gameSessionExpired(sessionData, Date.now())) {
      console.error('Session validation failed: Token expired');
      return null;
    }

    return {
      sessionId: sessionData.sessionId,
      createdAt: sessionData.createdAt,
      displayName: sessionData.displayName || null,
      ...(sessionData.lastRenewedAt ? { lastRenewedAt: sessionData.lastRenewedAt } : {}),
    };
  } catch {
    console.error({ category: 'session-validation', code: 'INTERNAL_ERROR' });
    return null;
  }
};

// Middleware helper: Extract and validate session token from custom header
// Returns session identity or sends 401 response
// ⚠️ IMPORTANT: Uses X-Session-Token header, NOT Authorization
// Authorization header must contain Supabase anon key for edge function access
const requireSession = async (c: any) => {
  // Check custom session token header
  const sessionToken = c.req.header('X-Session-Token');
  
  if (!sessionToken) {
    console.error('Authorization error: Missing X-Session-Token header');
    return c.json({ 
      error: 'Unauthorized',
      message: 'Missing X-Session-Token header. Session token required for this endpoint.'
    }, 401);
  }

  const session = await validateSessionToken(sessionToken);
  
  if (!session) {
    console.error('Authorization error: Invalid or expired session token');
    return c.json({ 
      error: 'Unauthorized',
      message: 'Invalid or expired session token'
    }, 401);
  }

  return session; // Return session identity for use in endpoint
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Account/session metadata requests use safe outcome logs, never URL logs.
app.use('*', accountPrivacyMiddleware(
  SERVER_DEBUG_LOGS_ENABLED ? logger(console.log) : undefined,
));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors(accountCorsOptions),
);

// ============================================================================
// REGISTER ALL ROUTES
// ============================================================================

const logAccountOutcome: AccountLog = (category, code, details) =>
  console.info({ category, code, ...details });
const streakOptions = {
  getRepository: accountServiceLoader(() =>
    import("./accounts/streakRepository.ts").then(({ createStreakRepository }) =>
      createStreakRepository(supabase)
    )),
  log: logAccountOutcome,
};
const getAccountService = accountServiceLoader(() =>
  import("./accounts/accountService.ts").then(
    ({ createProductionAccountService }) =>
      createProductionAccountService(
        supabase, validateSessionToken, logAccountOutcome,
        { ...streakOptions, loadGame: (gameId) => kvGet(`game_${gameId}`) },
      ),
  ));
registerAccountRoutes(app, {
  log: logAccountOutcome,
  handleEnabledRequest: async (c) => {
    try {
      return await (await getAccountService()).handle(c);
    }
    catch {
      logAccountOutcome("accounts", "ACCOUNT_SERVICE_UNAVAILABLE");
      return accountError(c, "ACCOUNT_SERVICE_UNAVAILABLE", { retryAfterSeconds: 5 });
    }
  },
});
let gameIdentity: GameRequestIdentity | undefined;
const gameIdentityOptions: GameIdentityRouteOptions = {
  mode: accountsMode,
  getResolver: () => {
    if (accountsMode === "off") throw new Error("Dormant game identity resolver");
    return gameIdentity ??= createGameRequestIdentity({
      mode: accountsMode,
      getRepository: () => createGameIdentityRepository(supabase),
      bindName: createGameSessionNameBinder(supabase, kvSet),
    });
  },
};
registerAuthRoutes(app, kvGet, kvSet, gameIdentityOptions);
if (ENABLE_TEST_ROUTES) {
  registerTestRoutes(app, kvGet, kvSet, kvDel);
}
const intentPersistence = createIntentPersistence(supabase);
registerGameRoutes(
  app,
  kvGet,
  kvSet,
  requireSession,
  generateSecureGameId,
  intentPersistence,
  undefined,
  gameIdentityOptions,
  streakOptions,
);
registerIntentRoutes(
  app,
  kvGet,
  kvSet,
  requireSession,
  intentPersistence,
  gameIdentityOptions,
  createGameSessionRenewer(supabase),
  streakOptions,
);

// ============================================================================
// SESSION METADATA ENDPOINT (ADDITIONAL)
// ============================================================================
// GET /session/me - Resolve session metadata for existing token
// Client calls this to get truthful sessionId/displayName when token exists
// Uses validateSessionToken() from above (no duplication of validation logic)
// ============================================================================
registerSessionMeRoute(app, {
  validateSession: validateSessionToken,
  resolveAccount: async (raw, sessionId) => (await getAccountService()).optionalIdentity(raw, sessionId),
  log: logAccountOutcome,
});

// ============================================================================
// START SERVER - MUST NOT CHANGE
// ============================================================================
Deno.serve(app.fetch);
