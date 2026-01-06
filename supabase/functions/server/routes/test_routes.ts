// ============================================================================
// TEST ROUTES
// ============================================================================
// Health checks, diagnostics, and development endpoints
// Mechanical extraction from index.tsx - NO BEHAVIOR CHANGES

import type { Hono } from "npm:hono";

export function registerTestRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  kvDel: (key: string) => Promise<void>
) {
  // Health check endpoint
  app.get("/make-server-825e19ab/health", (c) => {
    console.log("Health check called");
    return c.json({ status: "ok", supabase: "connected" });
  });

  // Test endpoint to verify connection works
  app.get("/make-server-825e19ab/test-connection", async (c) => {
    try {
      console.log("Testing connection...");
      console.log("SUPABASE_URL configured:", !!Deno.env.get("SUPABASE_URL"));
      console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      
      // Simple test using kv store
      const testKey = "connection_test";
      const testValue = { timestamp: new Date().toISOString(), test: true };
      
      await kvSet(testKey, testValue);
      const retrieved = await kvGet(testKey);
      await kvDel(testKey);
      
      console.log("KV store test successful");
      return c.json({ 
        status: "success", 
        message: "Supabase connection working correctly",
        test: "KV store operations successful",
        timestamp: new Date().toISOString(),
        environment: {
          url_configured: !!Deno.env.get("SUPABASE_URL"),
          service_key_configured: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        }
      });
    } catch (error) {
      console.error("Connection test error:", error);
      return c.json({ 
        status: "error", 
        message: error.message,
        details: error.toString(),
        timestamp: new Date().toISOString()
      }, 500);
    }
  });

  // Simple echo endpoint for testing
  app.post("/make-server-825e19ab/echo", async (c) => {
    try {
      const body = await c.req.json();
      console.log("Echo endpoint called with:", body);
      
      return c.json({
        echo: body,
        timestamp: new Date().toISOString(),
        message: "Echo successful"
      });
    } catch (error) {
      return c.json({ error: "Failed to parse request body" }, 400);
    }
  });

  // List all available endpoints
  app.get("/make-server-825e19ab/endpoints", (c) => {
    return c.json({
      endpoints: [
        { method: "GET", path: "/make-server-825e19ab/health", description: "Health check" },
        { method: "GET", path: "/make-server-825e19ab/test-connection", description: "Test Supabase connection" },
        { method: "POST", path: "/make-server-825e19ab/session/start", description: "Create new session token" },
        { method: "POST", path: "/make-server-825e19ab/create-game", description: "Create new private game" },
        { method: "POST", path: "/make-server-825e19ab/join-game/:gameId", description: "Join existing game" },
        { method: "POST", path: "/make-server-825e19ab/switch-role/:gameId", description: "Switch between player/spectator" },
        { method: "GET", path: "/make-server-825e19ab/game-state/:gameId", description: "Get current game state" },
        { method: "POST", path: "/make-server-825e19ab/send-action/:gameId", description: "Submit game action" },
        { method: "POST", path: "/make-server-825e19ab/intent", description: "Submit game intent (Alpha v6)" },
        { method: "POST", path: "/make-server-825e19ab/echo", description: "Echo test endpoint" },
        { method: "GET", path: "/make-server-825e19ab/endpoints", description: "List all endpoints" },
        { method: "GET", path: "/make-server-825e19ab/system-test", description: "Comprehensive system test" }
      ],
      timestamp: new Date().toISOString()
    });
  });

  // Comprehensive system test endpoint
  app.get("/make-server-825e19ab/system-test", async (c) => {
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
      overall: "pending"
    };

    // Test 1: Environment variables
    try {
      const envTest = {
        name: "Environment Variables",
        status: "pass",
        details: {
          SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
          SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        }
      };
      
      if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        envTest.status = "fail";
      }
      
      results.tests.push(envTest);
    } catch (error) {
      results.tests.push({
        name: "Environment Variables",
        status: "error",
        error: error.message
      });
    }

    // Test 2: KV Store
    try {
      const testKey = `system_test_${Date.now()}`;
      const testValue = { test: true, timestamp: new Date().toISOString() };
      
      await kvSet(testKey, testValue);
      const retrieved = await kvGet(testKey);
      await kvDel(testKey);
      
      results.tests.push({
        name: "KV Store Operations",
        status: retrieved ? "pass" : "fail",
        details: { write: true, read: !!retrieved, delete: true }
      });
    } catch (error) {
      results.tests.push({
        name: "KV Store Operations",
        status: "error",
        error: error.message
      });
    }

    // Test 3: Session Creation
    try {
      const sessionToken = crypto.randomUUID();
      const sessionData = {
        sessionId: `test_session_${Date.now()}`,
        sessionToken,
        createdAt: new Date().toISOString()
      };
      
      await kvSet(`session_token_${sessionToken}`, sessionData);
      const retrieved = await kvGet(`session_token_${sessionToken}`);
      await kvDel(`session_token_${sessionToken}`);
      
      results.tests.push({
        name: "Session Management",
        status: retrieved ? "pass" : "fail",
        details: { sessionCreated: !!retrieved }
      });
    } catch (error) {
      results.tests.push({
        name: "Session Management",
        status: "error",
        error: error.message
      });
    }

    // Determine overall status
    const failedTests = results.tests.filter(t => t.status === "fail" || t.status === "error");
    results.overall = failedTests.length === 0 ? "pass" : "fail";

    return c.json(results);
  });
}