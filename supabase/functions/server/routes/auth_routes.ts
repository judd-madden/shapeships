// ============================================================================
// AUTH ROUTES
// ============================================================================
// Authentication and session management endpoints
// Mechanical extraction from index.tsx - NO BEHAVIOR CHANGES

import type { Hono } from "npm:hono";

export function registerAuthRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>
) {
  // Generate cryptographically secure session token
  const generateSessionToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Generate stable session ID (internal identity key)
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // ============================================================================
  // ALPHA v3: Session Management
  // ============================================================================
  // POST /session/start - Create new session token
  // Returns: { sessionToken: string, sessionId: string, displayName?: string }
  // Client must store token and include in all subsequent requests via:
  //   X-Session-Token: <sessionToken>
  // 
  // Accepts optional displayName in body to associate with session
  // Note: Authorization header should contain Supabase anon key for edge function access
  // ============================================================================
  app.post("/make-server-825e19ab/session/start", async (c) => {
    try {
      // Parse request body (optional displayName)
      let displayName: string | undefined;
      try {
        const body = await c.req.json();
        displayName = body?.displayName;
      } catch {
        // No body provided, that's fine - displayName is optional
      }

      const sessionToken = generateSessionToken();
      const sessionId = generateSessionId();
      const createdAt = new Date().toISOString();

      // Store session data in KV store
      const sessionData = {
        sessionId,
        sessionToken,
        createdAt,
        displayName: displayName || null  // Store displayName if provided
      };

      await kvSet(`session_token_${sessionToken}`, sessionData);
      
      // Also store by sessionId for reverse lookup if needed
      await kvSet(`session_id_${sessionId}`, sessionData);

      console.log(`✅ Session created: ${sessionId}${displayName ? ` (${displayName})` : ''}`);

      return c.json({ 
        sessionToken,
        sessionId,
        displayName: displayName || null,
        message: "Session created successfully"
      });

    } catch (error) {
      console.error("Session creation error:", error);
      return c.json({ error: "Failed to create session" }, 500);
    }
  });

  // User signup endpoint (POST-ALPHA)
  // Disabled in Alpha v3 - session-only authentication
  app.post("/make-server-825e19ab/signup", async (c) => {
    // ALPHA v3: Disable auth endpoint
    const ALPHA_DISABLE_AUTH = true;
    if (ALPHA_DISABLE_AUTH) {
      return c.json({
        error: "Authentication disabled",
        message: "Alpha v3 uses session-only authentication. Use /session/start instead."
      }, 400);
    }

    // POST-ALPHA: Full auth implementation will go here
    try {
      const { email, password, displayName } = await c.req.json();
      
      // TODO: Implement Supabase auth signup
      // const { data, error } = await supabase.auth.admin.createUser({
      //   email,
      //   password,
      //   user_metadata: { name: displayName },
      //   email_confirm: true
      // });
      
      return c.json({
        error: "Not implemented",
        message: "Full authentication will be enabled Post-Alpha"
      }, 501);
    } catch (error) {
      console.error("Signup error:", error);
      return c.json({ error: "Signup failed" }, 500);
    }
  });
}