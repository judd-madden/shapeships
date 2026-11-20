import type { Context, Hono, MiddlewareHandler } from "npm:hono";
import { type AccountsMode, accountsMode } from "../accounts/accountsMode.ts";
import { accountError } from "../accounts/accountResponses.ts";
import type { AccountIdentity } from "../accounts/accountRepository.ts";
import type {
  AccountLog,
  SessionValidator,
} from "../accounts/accountService.ts";

export const accountCorsOptions = {
  origin: "*",
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "apikey",
    "X-Session-Token",
    "X-Account-Token",
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length", "Retry-After"],
  maxAge: 600,
};

export function isAccountTraffic(path: string): boolean {
  return path === "/make-server-825e19ab/accounts" ||
    path.startsWith("/make-server-825e19ab/accounts/") ||
    path === "/make-server-825e19ab/session/me";
}

// Runs before CORS, including preflights. Generic URL logs may contain query secrets.
export function accountPrivacyMiddleware(
  requestLogger?: MiddlewareHandler,
): MiddlewareHandler {
  return async (c, next) => {
    if (isAccountTraffic(c.req.path)) {
      c.header("Cache-Control", "no-store");
      await next();
    } else if (requestLogger) await requestLogger(c, next);
    else await next();
  };
}

interface AccountRouteOptions {
  mode?: AccountsMode;
  // A lazy seam: dormant requests must never acquire service dependencies.
  handleEnabledRequest?: (c: Context) => Response | Promise<Response>;
  log?: AccountLog;
}

export function registerAccountRoutes(
  app: Hono,
  {
    mode = accountsMode,
    handleEnabledRequest = (c) => accountError(c, "NOT_FOUND"),
    log,
  }: AccountRouteOptions = {},
): void {
  const guard = (c: Context) => {
    if (mode !== "on") {
      try {
        log?.("accounts", "ACCOUNTS_NOT_ENABLED");
      } catch { /* Safe logging only. */ }
      return accountError(c, "ACCOUNTS_NOT_ENABLED");
    }
    return handleEnabledRequest(c);
  };
  app.all("/make-server-825e19ab/accounts", guard);
  app.all("/make-server-825e19ab/accounts/*", guard);
}

export function registerSessionMeRoute(
  app: Hono,
  { mode = accountsMode, validateSession, resolveAccount, log }: {
    mode?: AccountsMode;
    validateSession: SessionValidator;
    resolveAccount: (
      raw: string,
      sessionId: string,
    ) => Promise<AccountIdentity | null>;
    log?: AccountLog;
  },
): void {
  app.get("/make-server-825e19ab/session/me", async (c) => {
    c.header("Cache-Control", "no-store");
    const report = (code: string) => {
      try {
        log?.("session-me", code);
      } catch { /* Safe logging only. */ }
    };
    try {
      const sessionToken = c.req.header("X-Session-Token");
      if (!sessionToken) {
        report("GAME_SESSION_INVALID");
        return c.json({
          error: "Unauthorized",
          message: "Missing X-Session-Token header",
        }, 401);
      }
      const session = await validateSession(sessionToken);
      if (!session) {
        report("GAME_SESSION_INVALID");
        return c.json({
          error: "Unauthorized",
          message: "Invalid or expired session token",
        }, 401);
      }
      let account: AccountIdentity | null = null;
      const raw = c.req.header("X-Account-Token");
      if (mode === "on" && raw) {
        try {
          account = await resolveAccount(raw, session.sessionId);
        } catch {
          /* Optional identity failure cannot gate the existing read. */
        }
      }
      report("OK");
      return c.json({
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        displayName: session.displayName || null,
        account,
      });
    } catch {
      report("INTERNAL_ERROR");
      return c.json({ error: "Failed to retrieve session metadata" }, 500);
    }
  });
}
