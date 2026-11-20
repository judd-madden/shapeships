import assert from "node:assert/strict";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import {
  type AccountsMode,
  parseAccountsMode,
} from "../../accounts/accountsMode.ts";
import {
  ACCOUNT_ERRORS,
  accountError,
} from "../../accounts/accountResponses.ts";
import { registerAccountRoutes } from "../../routes/account_routes.ts";
import { registerAuthRoutes } from "../../routes/auth_routes.ts";

const prefix = "/make-server-825e19ab";

function fixture(mode: AccountsMode, failIfEnabled = false) {
  const app = new Hono();
  const store = new Map<string, unknown>();
  app.use(
    "/*",
    cors({
      origin: "*",
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "apikey",
        "X-Session-Token",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
    }),
  );
  registerAccountRoutes(app, {
    mode,
    ...(failIfEnabled
      ? {
        handleEnabledRequest: () => {
          throw new Error(
            "Dormant route touched account DB/secret dependencies",
          );
        },
      }
      : {}),
  });
  registerAuthRoutes(
    app,
    (key) => Promise.resolve(store.get(key)),
    (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
  );
  app.get(
    `${prefix}/session/me`,
    (c) => c.json({ sessionId: "existing-session" }),
  );
  return { app, store };
}

Deno.test("account mode parsing is strict and warnings never echo input", () => {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  assert.equal(parseAccountsMode(undefined, warn), "off");
  for (const mode of ["off", "names-only", "on"] as const) {
    assert.equal(parseAccountsMode(mode, warn), mode);
  }
  assert.deepEqual(warnings, []);
  for (const invalid of ["", "ON", " on", "true", "secret\nvalue"]) {
    assert.equal(parseAccountsMode(invalid, warn), "off");
  }
  assert.equal(warnings.length, 5);
  assert.equal(new Set(warnings).size, 1);
  assert.equal(warnings[0], "Invalid ACCOUNTS_MODE; accounts are off.");
});

for (const mode of ["off", "names-only", "on"] as const) {
  Deno.test(`account namespace: ${mode}, all methods and both path forms`, async () => {
    const { app, store } = fixture(mode, mode !== "on");
    const code = mode === "on" ? "NOT_FOUND" : "ACCOUNTS_NOT_ENABLED";
    for (
      const path of [
        "/accounts",
        "/accounts/",
        "/accounts/sign-in",
        "/accounts/unknown/nested",
      ]
    ) {
      for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
        const response = await app.request(`${prefix}${path}`, {
          method,
          headers: { Origin: "https://example.test" },
        });
        assert.equal(response.status, mode === "on" ? 404 : 503);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("retry-after"), null);
        assert.equal(response.headers.get("access-control-allow-origin"), "*");
        assert.match(
          response.headers.get("content-type")!,
          /application\/json/,
        );
        assert.deepEqual(await response.json(), {
          ok: false,
          error: { code, message: ACCOUNT_ERRORS[code][1] },
        });
      }
    }
    const head = await app.request(`${prefix}/accounts`, { method: "HEAD" });
    assert.equal(head.status, mode === "on" ? 404 : 503);
    assert.equal(head.headers.get("cache-control"), "no-store");
    assert.equal(await head.text(), "");
    assert.equal(store.size, 0);
  });

  Deno.test(`account registration preserves preflight and other routes: ${mode}`, async () => {
    const { app, store } = fixture(mode);
    for (const path of ["/accounts", "/accounts/sign-in"]) {
      const preflight = await app.request(`${prefix}${path}`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.test",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type,X-Session-Token",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
      assert.equal(preflight.headers.get("access-control-max-age"), "600");
      assert.equal(preflight.headers.get("retry-after"), null);
      assert.equal(await preflight.text(), "");
    }
    const started = await app.request(`${prefix}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Guest123" }),
    });
    assert.equal(started.status, 200);
    assert.equal((await started.json()).displayName, "Guest123");
    assert.equal(store.size, 2);
    const me = await app.request(`${prefix}/session/me`);
    assert.deepEqual(await me.json(), { sessionId: "existing-session" });
    const neighboring = await app.request(`${prefix}/accounts-other`);
    assert.equal(neighboring.status, 404);
    assert.equal(neighboring.headers.get("cache-control"), null);
  });
}

Deno.test("account errors carry optional fields and matching integer retry headers", async () => {
  const app = new Hono();
  app.get("/", (c) =>
    accountError(c, "RATE_LIMITED", {
      field: "name",
      retryAfterSeconds: 7,
    }));
  const response = await app.request("/");
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "7");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: ACCOUNT_ERRORS.RATE_LIMITED[1],
      field: "name",
      retryAfterSeconds: 7,
    },
  });
  assert.ok("PASSWORD_CHANGE_REQUIRED" in ACCOUNT_ERRORS);
  assert.ok("PASSWORD_UNCHANGED" in ACCOUNT_ERRORS);
  assert.ok(!("LINK_CONFLICT" in ACCOUNT_ERRORS));
  assert.ok(!("LINK_FORBIDDEN" in ACCOUNT_ERRORS));
});
