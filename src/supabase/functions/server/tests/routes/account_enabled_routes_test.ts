import assert from "node:assert/strict";
import { AccountFault } from "../../accounts/accountRepository.ts";
import {
  accountFixture,
  preferences,
  prefix,
} from "../accounts/accountTestFixture.ts";
import { registerAuthRoutes } from "../../routes/auth_routes.ts";

const credentials = { name: "Pilot1", password: "abcdefghij" };

for (const mode of ["off", "names-only"] as const) {
  Deno.test(
    mode + " never acquires dependencies; all paths/methods remain dormant",
    async () => {
      const f = accountFixture({ mode, rejectDependencies: true });
      for (
        const path of [
          "/accounts",
          "/accounts/",
          "/accounts/claim",
          "/accounts/unknown/deep",
        ]
      ) {
        for (
          const method of ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]
        ) {
          const result = await f.app.request(prefix + path, {
            method,
            headers: { Origin: "https://example.test" },
          });
          assert.equal(result.status, 503);
          assert.equal(result.headers.get("Cache-Control"), "no-store");
          assert.equal(result.headers.get("Retry-After"), null);
          assert.equal(result.headers.get("Access-Control-Allow-Origin"), "*");
          if (method === "HEAD") assert.equal(await result.text(), "");
          else {assert.equal(
              (await result.json()).error.code,
              "ACCOUNTS_NOT_ENABLED",
            );}
        }
      }
      const me = await f.app.request(prefix + "/session/me", {
        headers: { "X-Session-Token": "s1", "X-Account-Token": "A".repeat(43) },
      });
      assert.equal(me.status, 200);
      assert.equal((await me.json()).account, null);
      assert.equal(f.dependencyCalls, 0);
    },
  );
}

Deno.test("enabled account method/path errors are JSON no-store without spurious Retry-After", async () => {
  const f = accountFixture();
  for (const route of ["claim", "sign-in", "password", "resume", "logout"]) {
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD"]) {
      const result = await f.app.request(prefix + "/accounts/" + route, {
        method,
      });
      assert.equal(result.status, 405);
      assert.equal(result.headers.get("Cache-Control"), "no-store");
      assert.equal(result.headers.get("Retry-After"), null);
      if (method !== "HEAD") {
        assert.equal((await result.json()).error.code, "METHOD_NOT_ALLOWED");
      } else assert.equal(await result.text(), "");
    }
  }
  for (
    const route of [
      "/accounts",
      "/accounts/",
      "/accounts/unknown",
      "/accounts/preferences",
      "/accounts/claim/extra",
    ]
  ) {
    const result = await f.app.request(prefix + route);
    assert.equal(result.status, 404);
    assert.equal((await result.json()).error.code, "NOT_FOUND");
  }
  const neighbor = await f.app.request(prefix + "/accounts-other");
  assert.equal(neighbor.status, 404);
  assert.equal(neighbor.headers.get("Cache-Control"), null);
});

Deno.test("shared production CORS options permit account headers and expose Retry-After in every mode", async () => {
  for (const mode of ["on", "off", "names-only"] as const) {
    const f = accountFixture({ mode });
    for (const route of ["claim", "sign-in", "password", "resume", "logout"]) {
      const preflight = await f.app.request(prefix + "/accounts/" + route, {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.test",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "Content-Type,Authorization,apikey,X-Session-Token,X-Account-Token",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("Cache-Control"), "no-store");
      assert.match(
        preflight.headers.get("Access-Control-Allow-Headers")!,
        /X-Account-Token/i,
      );
      assert.match(
        preflight.headers.get("Access-Control-Allow-Headers")!,
        /X-Session-Token/i,
      );
      assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
      const response = await f.post(route, {});
      assert.match(
        response.headers.get("Access-Control-Expose-Headers")!,
        /Retry-After/i,
      );
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    }
  }
});

Deno.test("claim/sign-in/password validate the game session before credential fields", async () => {
  const f = accountFixture();
  for (const route of ["claim", "sign-in", "password"]) {
    for (const session of [null, "expired"]) {
      const response = await f.post(route, {
        name: "bad name",
        password: "short",
      }, session);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "GAME_SESSION_INVALID");
    }
  }
  assert.equal(f.fakeHasher.hashCalls + f.fakeHasher.verifyCalls, 0);
  assert.equal((await f.post("resume", {})).status, 401);
  const logout = await f.post("logout", {}, "expired");
  assert.equal(logout.status, 204); // Logout ignores optional/bad S.
});

Deno.test("body parser bounds real streamed bytes, accepts exactly 8KiB, and requires JSON", async () => {
  const f = accountFixture();
  const request = (
    body: string | Uint8Array<ArrayBuffer> | ReadableStream<Uint8Array>,
    headers: Record<string, string> = { "Content-Type": "application/json" },
  ) =>
    f.app.request(prefix + "/accounts/logout", {
      method: "POST",
      headers,
      body,
    });
  const boundary = await request("{}" + " ".repeat(8190));
  assert.equal(boundary.status, 204);
  const requestHeaders: Array<Record<string, string>> = [{
    "Content-Type": "application/json",
  }, { "Content-Type": "application/json", "Content-Length": "1" }];
  for (const headers of requestHeaders) {
    const oversized = await request("{}" + " ".repeat(8191), headers);
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "REQUEST_TOO_LARGE");
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(4100).fill(32));
      controller.enqueue(new Uint8Array(4100).fill(32));
      controller.close();
    },
  });
  assert.equal((await request(stream)).status, 413);
  const unicode = await request(JSON.stringify({ padding: "😀".repeat(2100) }));
  assert.equal(unicode.status, 413);
  for (
    const type of [
      "text/plain",
      "application/x-www-form-urlencoded",
      "application/jsonp",
    ]
  ) {
    const response = await request("{}", { "Content-Type": type });
    assert.equal(response.status, 415);
    assert.equal((await response.json()).error.code, "UNSUPPORTED_MEDIA_TYPE");
  }
  for (const body of ["", "{", "null", "[]", "42", new Uint8Array([0xff])]) {
    const response = await request(body);
    assert.equal(response.status, body === "" ? 204 : 400);
  }
  assert.equal(
    (await f.app.request(prefix + "/accounts/logout", { method: "POST" }))
      .status,
    204,
  );
  assert.equal(
    (await request("{}", { "Content-Type": "application/json; charset=utf-8" }))
      .status,
    204,
  );
});

Deno.test("request schemas reject account IDs, extra credentials and incomplete preferences before hashing", async () => {
  const f = accountFixture();
  for (
    const body of [
      { ...credentials, preferences, accountId: "spoof" },
      { ...credentials, preferences, passwordHash: "spoof" },
      { ...credentials, preferences: { soundEnabled: true } },
      { ...credentials, preferences: { ...preferences, extra: true } },
      { ...credentials, preferences: { ...preferences, musicEnabled: "true" } },
      { ...credentials, preferences, turnstileToken: 1 },
    ]
  ) {
    const response = await f.post("claim", body);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_REQUEST");
  }
  for (const route of ["resume", "logout"]) {
    const response = await f.post(route, { accountId: "spoof" });
    assert.equal(response.status, 400);
  }
  assert.equal(f.fakeHasher.hashCalls + f.fakeHasher.verifyCalls, 0);
  const invalidName = await f.post("claim", {
    ...credentials,
    name: "a b",
    preferences,
  });
  assert.equal((await invalidName.json()).error.code, "INVALID_NAME");
  const invalidPassword = await f.post("claim", {
    ...credentials,
    password: "\ud800abcdefghij",
    preferences,
  });
  assert.equal((await invalidPassword.json()).error.code, "INVALID_PASSWORD");
});

Deno.test("resume errors distinguish missing, malformed, unknown and expired tokens; logout stays idempotent", async () => {
  const f = accountFixture(), claimed = await f.claim();
  assert.equal(
    (await (await f.post("resume", {}, null)).json()).error.code,
    "ACCOUNT_TOKEN_REQUIRED",
  );
  for (const token of ["malformed", "A".repeat(43)]) {
    assert.equal(
      (await (await f.post("resume", {}, null, token)).json()).error.code,
      "ACCOUNT_TOKEN_INVALID",
    );
    const logout = await f.post("logout", {}, null, token);
    assert.equal(logout.status, 204);
    assert.equal(await logout.text(), "");
  }
  const invalidSession = await f.post(
    "resume",
    {},
    "expired",
    claimed.accountToken,
  );
  assert.equal(
    (await invalidSession.json()).error.code,
    "GAME_SESSION_INVALID",
  );
  assert.equal(
    (await f.post("logout", {}, null, claimed.accountToken)).status,
    204,
  );
  assert.equal(
    (await f.post("logout", {}, null, claimed.accountToken)).status,
    204,
  );
});

Deno.test("session/me keeps exact legacy 401 bodies, returns optional linked identity, and never renews", async () => {
  const f = accountFixture(), claimed = await f.claim();
  const request = (session?: string, token?: string) =>
    f.app.request(prefix + "/session/me", {
      headers: {
        ...session !== undefined ? { "X-Session-Token": session } : {},
        ...token !== undefined ? { "X-Account-Token": token } : {},
      },
    });
  const missing = await request();
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), {
    error: "Unauthorized",
    message: "Missing X-Session-Token header",
  });
  const expired = await request("expired");
  assert.equal(expired.status, 401);
  assert.deepEqual(await expired.json(), {
    error: "Unauthorized",
    message: "Invalid or expired session token",
  });
  f.repository.now += 7200000;
  const before = structuredClone([...f.repository.tokens.values()]);
  const me = await request("s1", claimed.accountToken);
  assert.equal(me.status, 200);
  assert.equal(me.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await me.json(), {
    sessionId: "session-s1",
    createdAt: "2026-11-20T00:00:00Z",
    displayName: "Guest123",
    account: claimed.account,
  });
  assert.deepEqual([...f.repository.tokens.values()], before);
  assert.equal(
    (await (await request("s2", claimed.accountToken)).json()).account,
    null,
  ); // No link.
  for (const token of [undefined, "invalid", "A".repeat(43)]) {
    const response = await request("s1", token);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).account, null);
  }
  f.repository.identity = () => Promise.reject(new Error("raw-db-failure"));
  const unavailable = await request("s1", claimed.accountToken);
  assert.equal(unavailable.status, 200);
  assert.equal((await unavailable.json()).account, null);
});

Deno.test("safe logs exclude URL/query/body/credential data and ordinary logging stays active", async () => {
  const urls: string[] = [];
  const f = accountFixture({
    requestLogger: async (c, next) => {
      urls.push(c.req.url);
      await next();
    },
  });
  const claimed = await f.claim();
  await f.app.request(prefix + "/session/me?token=query-sentinel", {
    headers: {
      "X-Session-Token": "s1",
      "X-Account-Token": claimed.accountToken,
    },
  });
  await f.app.request(prefix + "/accounts/sign-in?password=query-sentinel", {
    method: "GET",
  });
  f.repository.readCredential = () =>
    Promise.reject(new Error("raw-sql-sentinel"));
  const failure = await f.post("sign-in", credentials);
  assert.equal(failure.status, 500);
  assert.equal((await failure.json()).error.code, "INTERNAL_ERROR");
  await f.app.request("/ordinary?visible=yes");
  assert.equal(urls.length, 1);
  assert.match(urls[0], /ordinary\?visible=yes/);
  const logs = JSON.stringify(f.logs);
  for (
    const secret of [
      "query-sentinel",
      "raw-sql-sentinel",
      credentials.password,
      claimed.accountToken,
      "synthetic-proof",
    ]
  ) assert.equal(logs.includes(secret), false);
  for (const entry of f.logs) {
    assert.deepEqual(Object.keys(entry).sort(), ["category", "code"]);
  }
});

Deno.test("rate errors carry the exact retry delay and prevent proof/hash work", async () => {
  const f = accountFixture({
    rate: {
      entry: () =>
        Promise.reject(new AccountFault("RATE_LIMITED", undefined, 7)),
    },
  });
  const response = await f.post("claim", { ...credentials, preferences });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "7");
  assert.equal((await response.json()).error.retryAfterSeconds, 7);
  assert.equal(f.fakeHasher.hashCalls, 0);
  assert.equal(f.events.includes("human"), false);
});

Deno.test("rate seams receive token digests and credential-redacted headers", async () => {
  const observed: Uint8Array[] = [];
  const f = accountFixture({
    rate: {
      entry: (context) => {
        for (
          const header of [
            "Authorization",
            "apikey",
            "X-Session-Token",
            "X-Account-Token",
          ]
        ) assert.equal(context.headers.has(header), false);
        return Promise.resolve();
      },
      token: (_context, hash) => {
        if (hash) observed.push(hash);
        return Promise.resolve();
      },
    },
  });
  const claimed = await f.claim();
  assert.equal(
    (await f.post("resume", {}, null, claimed.accountToken)).status,
    200,
  );
  assert.equal(observed.length, 1);
  assert.equal(observed[0].length, 32);
  assert.notEqual(new TextDecoder().decode(observed[0]), claimed.accountToken);
});

Deno.test("unrelated session/start remains registered with its original response and KV writes", async () => {
  const f = accountFixture({ mode: "off", rejectDependencies: true });
  const store = new Map<string, unknown>();
  registerAuthRoutes(
    f.app,
    (key) => Promise.resolve(store.get(key)),
    (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
  );
  const response = await f.app.request(prefix + "/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Guest123" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.displayName, "Guest123");
  assert.match(body.sessionToken, /^[0-9a-f]{64}$/);
  assert.equal(store.size, 2);
  assert.equal(f.dependencyCalls, 0);
});
