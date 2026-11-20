import type { Context, Hono } from "npm:hono";
import { type AccountsMode, accountsMode } from "../accounts/accountsMode.ts";
import { accountError } from "../accounts/accountResponses.ts";

interface AccountRouteOptions {
  mode?: AccountsMode;
  // A lazy seam: dormant requests must never acquire service dependencies.
  handleEnabledRequest?: (c: Context) => Response | Promise<Response>;
}

export function registerAccountRoutes(
  app: Hono,
  {
    mode = accountsMode,
    handleEnabledRequest = (c) => accountError(c, "NOT_FOUND"),
  }: AccountRouteOptions = {},
): void {
  const guard = (c: Context) => {
    if (mode !== "on") return accountError(c, "ACCOUNTS_NOT_ENABLED");
    return handleEnabledRequest(c);
  };
  app.all("/make-server-825e19ab/accounts", guard);
  app.all("/make-server-825e19ab/accounts/*", guard);
}
