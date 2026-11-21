import assert from "node:assert/strict";
import {
  accountFixture,
  preferences,
  prefix,
} from "../accounts/accountTestFixture.ts";
import { tokenDigest } from "../../accounts/tokens.ts";

function request(
  f: ReturnType<typeof accountFixture>,
  method: string,
  token?: string,
  body?: unknown,
  extra = {},
) {
  return f.app.request(prefix + "/accounts/preferences", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...token !== undefined ? { "X-Account-Token": token } : {},
      ...extra,
    },
    ...body !== undefined ? { body: JSON.stringify(body) } : {},
  });
}

Deno.test("preferences: token owns target, exact five values, partial bigint updates, no session/renewal/link", async () => {
  const f = accountFixture(),
    a = await f.claim(),
    b = await f.claim("Pilot2", "s2");
  const tokens = structuredClone([...f.repository.tokens]);
  const links = structuredClone([...f.repository.links]);
  f.repository.now += 2 * 3_600_000;
  const own = f.repository.preferences.get(a.account.id)!;
  own.revision = "9007199254740993";
  const read = await request(f, "GET", a.accountToken, undefined, {
    "X-Session-Token": "invalid",
  });
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await read.json()).preferences.values, preferences);
  const updated = await request(f, "PUT", a.accountToken, {
    patch: { soundEnabled: false },
    expectedRevision: own.revision,
  }, { "X-Session-Token": "s2" });
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).preferences.values, {
    ...preferences,
    soundEnabled: false,
  });
  assert.equal(
    f.repository.preferences.get(a.account.id)!.revision,
    "9007199254740994",
  );
  assert.deepEqual(
    f.repository.preferences.get(b.account.id)!.values,
    preferences,
  );
  assert.deepEqual([...f.repository.tokens], tokens);
  assert.deepEqual([...f.repository.links], links);
});

Deno.test("preferences R2: stale revision returns latest envelope without any write", async () => {
  const f = accountFixture(), a = await f.claim();
  await request(f, "PUT", a.accountToken, {
    patch: { musicEnabled: true },
    expectedRevision: "1",
  });
  const before = structuredClone(f.repository.preferences.get(a.account.id)!);
  f.repository.now += 1000;
  const response = await request(f, "PUT", a.accountToken, {
    patch: { soundEnabled: false },
    expectedRevision: "1",
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, "PREFERENCE_CONFLICT");
  assert.deepEqual(body.preferences, before);
  assert.deepEqual(f.repository.preferences.get(a.account.id), before);
  assert.equal(response.headers.get("Retry-After"), null);
});

Deno.test("preferences: rejects empty/unknown/type/ownership/revision input and preserves state", async () => {
  const f = accountFixture(), a = await f.claim();
  const before = structuredClone([...f.repository.preferences]);
  const invalid = [
    null,
    [],
    {},
    { patch: {}, expectedRevision: "1" },
    ...[null, [], true, { soundEnabled: 1 }, { other: true }, {
      soundEnabled: null,
    }, { soundEnabled: true, other: false }].map((patch) => ({
      patch,
      expectedRevision: "1",
    })),
    ...[undefined, 1, "0", "01", "-1", "1.0", "9223372036854775808"].map(
      (expectedRevision) => ({
        patch: { musicEnabled: true },
        expectedRevision,
      }),
    ),
    {
      patch: { musicEnabled: true },
      expectedRevision: "1",
      accountId: a.account.id,
    },
  ];
  for (const body of invalid) {
    const r = await request(f, "PUT", a.accountToken, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal((await r.json()).error.code, "INVALID_REQUEST");
  }
  assert.deepEqual([...f.repository.preferences], before);
  assert.equal((await request(f, "POST", a.accountToken, {})).status, 405);
  const media = await f.app.request(prefix + "/accounts/preferences", {
    method: "PUT",
    headers: { "X-Account-Token": a.accountToken },
    body: "{}",
  });
  assert.equal(media.status, 415);
  const huge = await request(f, "PUT", a.accountToken, {
    patch: { extra: "x".repeat(8192) },
    expectedRevision: "1",
  });
  assert.equal(huge.status, 413);
});

for (const method of ["GET", "PUT"]) {
  Deno.test(`preferences ${method}: existing authorization outcomes, no unauthorized conflict disclosure`, async () => {
    for (
      const kind of [
        "missing",
        "malformed",
        "unknown",
        "expired",
        "revoked",
        "version",
        "blocked",
        "banned",
      ]
    ) {
      const f = accountFixture(), a = await f.claim();
      const t = [...f.repository.tokens.values()][0];
      if (kind === "expired") t.expires = f.repository.now;
      if (kind === "revoked") t.revoked = f.repository.now;
      if (kind === "version") t.version = "2";
      if (kind === "blocked") {
        f.repository.accounts.get(a.account.id)!.status = "blocked";
      }
      if (kind === "banned") {
        f.repository.rules.push({
          kind: "banned",
          match: "exact",
          key: "piloti",
        });
      }
      const token = kind === "missing"
        ? undefined
        : kind === "malformed"
        ? "bad"
        : kind === "unknown"
        ? "A".repeat(43)
        : a.accountToken;
      const r = await request(
        f,
        method,
        token,
        method === "PUT"
          ? { patch: { musicEnabled: true }, expectedRevision: "999" }
          : undefined,
      );
      const code = kind === "missing"
        ? "ACCOUNT_TOKEN_REQUIRED"
        : kind === "expired"
        ? "ACCOUNT_TOKEN_EXPIRED"
        : kind === "blocked"
        ? "ACCOUNT_BLOCKED"
        : kind === "banned"
        ? "NAME_BANNED"
        : "ACCOUNT_TOKEN_INVALID";
      assert.equal(
        r.status,
        kind === "blocked" || kind === "banned" ? 403 : 401,
        kind,
      );
      const body = await r.json();
      assert.equal(body.error.code, code, kind);
      assert.equal(body.preferences, undefined);
    }
  });
}

for (const mode of ["off", "names-only"] as const) {
  Deno.test(`${mode}: preferences stay dormant before dependencies`, async () => {
    const f = accountFixture({ mode, rejectDependencies: true });
    for (const method of ["GET", "PUT"]) {
      const r = await request(
        f,
        method,
        "bad",
        method === "PUT" ? {} : undefined,
      );
      assert.equal(r.status, 503);
      assert.equal((await r.json()).error.code, "ACCOUNTS_NOT_ENABLED");
      assert.equal(r.headers.get("Retry-After"), null);
    }
    assert.equal(f.dependencyCalls, 0);
  });
}

Deno.test("preferences: logout/reset races serialize in both orders and failed commits roll back", async () => {
  for (const reset of [false, true]) {
    for (const revokeFirst of [false, true]) {
      const f = accountFixture(),
        a = await f.claim(),
        hash = await tokenDigest(a.accountToken);
      const entered = Promise.withResolvers<void>(),
        release = Promise.withResolvers<void>();
      const category = revokeFirst
        ? (reset ? "owner" : "logout")
        : "preferences";
      f.repository.beforeCommit = async (c) => {
        if (c === category) {
          entered.resolve();
          await release.promise;
        }
      };
      const revoke = () =>
        reset
          ? f.repository.ownerTransition(a.account.id, { hash: "reset-hash" })
          : f.repository.logout(hash);
      const write = () =>
        request(f, "PUT", a.accountToken, {
          patch: { soundEnabled: false },
          expectedRevision: "1",
        });
      const first = revokeFirst ? revoke() : write();
      await entered.promise;
      const second = revokeFirst ? write() : revoke();
      release.resolve();
      const results = await Promise.all([first, second]);
      const response = results[revokeFirst ? 1 : 0] as Response;
      assert.equal(response.status, revokeFirst ? 401 : 200);
      assert.equal(
        f.repository.preferences.get(a.account.id)!.revision,
        revokeFirst ? "1" : "2",
      );
      assert.equal((await request(f, "GET", a.accountToken)).status, 401);
    }
  }
  const f = accountFixture(), a = await f.claim();
  f.repository.failAt = "preferences.commit";
  assert.equal(
    (await request(f, "PUT", a.accountToken, {
      patch: { soundEnabled: false },
      expectedRevision: "1",
    })).status,
    503,
  );
  assert.equal(f.repository.preferences.get(a.account.id)!.revision, "1");
});
