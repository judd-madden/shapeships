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

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Import legacy rules and engine
import { 
  SHIP_DEFINITIONS_MAP,
  getShipDef, 
  getShipCost,
  getShipName,
  getShipHealth,
  getShipDamage,
  ServerPhaseEngine 
} from "./legacy/legacy_rules.ts";

// Import route registration functions
import { registerAuthRoutes } from "./routes/auth_routes.ts";
import { registerTestRoutes } from "./routes/test_routes.ts";
import { registerGameRoutes } from "./routes/game_routes.ts";
import { registerIntentRoutes } from "./routes/intent_routes.ts";

const app = new Hono();

// Create Supabase client using environment variables
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// ============================================================================
// KV STORE UTILITIES - ALL INLINE, NO IMPORTS (FIXED)
// ============================================================================
const kvGet = async (key) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) return null;
  return data?.value;
};

const kvSet = async (key, value) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert({ key, value });
  
  if (error) throw error;
};

const kvDel = async (key) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .eq('key', key);
  
  if (error) throw error;
};

const kvMget = async (keys) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .in('key', keys);
  
  if (error) return [];
  return data?.map(d => d.value) ?? [];
};

const kvMset = async (keys, values) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
  
  if (error) throw error;
};

const kvMdel = async (keys) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .in('key', keys);
  
  if (error) throw error;
};

const kvGetByPrefix = async (prefix) => {
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

    // Alpha v3: Use long TTL (24 hours)
    // Post-Alpha: Implement shorter TTLs and refresh tokens
    const createdAt = new Date(sessionData.createdAt);
    const now = new Date();
    const ageInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (ageInHours > 24) {
      console.error('Session validation failed: Token expired');
      return null;
    }

    return {
      sessionId: sessionData.sessionId,
      createdAt: sessionData.createdAt,
      displayName: sessionData.displayName || null
    };
  } catch (error) {
    console.error('Session validation error:', error);
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
// HELPER UTILITIES
// ============================================================================

// Helper function to generate game ID
const generateGameId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "X-Session-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ============================================================================
// REGISTER ALL ROUTES
// ============================================================================

registerAuthRoutes(app, kvGet, kvSet);
registerTestRoutes(app, kvGet, kvSet, kvDel);
registerGameRoutes(app, kvGet, kvSet, requireSession, generateGameId, ServerPhaseEngine, getShipDef, getShipCost, getShipName, getShipHealth, getShipDamage);
registerIntentRoutes(app, kvGet, kvSet, requireSession, supabase);

// ============================================================================
// SESSION METADATA ENDPOINT (ADDITIONAL)
// ============================================================================
// GET /session/me - Resolve session metadata for existing token
// Client calls this to get truthful sessionId/displayName when token exists
// Uses validateSessionToken() from above (no duplication of validation logic)
// ============================================================================
app.get("/make-server-825e19ab/session/me", async (c) => {
  try {
    const sessionToken = c.req.header('X-Session-Token');
    
    if (!sessionToken) {
      console.error('Session metadata error: Missing X-Session-Token header');
      return c.json({ 
        error: 'Unauthorized',
        message: 'Missing X-Session-Token header'
      }, 401);
    }

    const session = await validateSessionToken(sessionToken);
    
    if (!session) {
      console.error('Session metadata error: Invalid or expired token');
      return c.json({ 
        error: 'Unauthorized',
        message: 'Invalid or expired session token'
      }, 401);
    }

    // Return session metadata
    return c.json({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      displayName: session.displayName || null
    });

  } catch (error) {
    console.error('Session metadata error:', error);
    return c.json({ error: 'Failed to retrieve session metadata' }, 500);
  }
});

// ============================================================================
// START SERVER - MUST NOT CHANGE
// ============================================================================
Deno.serve(app.fetch);