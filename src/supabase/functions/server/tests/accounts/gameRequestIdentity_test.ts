import assert from "node:assert/strict";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createGameIdentityRepository } from "../../accounts/accountRepository.ts";
import { createGameSessionNameBinder } from "../../accounts/gameRequestIdentity.ts";
import { enabledGameFixture } from "./gameIdentityFixture.ts";

const aid = "00000000-0000-4000-8000-000000000001";
const tid = "00000000-0000-4000-8000-000000000002";
function clientFixture(responses: unknown[]) {
  const requests: Array<{ url: URL; method: string; body: any }> = [];
  const client = createClient("https://example.supabase.co", "synthetic", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push({
          url: new URL(request.url),
          method: request.method,
          body: request.method === "GET" ? null : await request.json(),
        });
        assert.ok(responses.length, "Unexpected database operation");
        const response = responses.shift();
        if (response instanceof Error) throw response;
        if (response instanceof Response) return response;
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  return { client, requests };
}
function row() {
  return {
    id: tid,
    version: "9007199254740993",
    revoked_at: null,
    expires_at: "2027-01-01T00:00:00Z",
    last_used_at: "2026-11-21T00:00:00Z",
    account: {
      id: aid,
      display_name: "Pilot1",
      status: "active",
      version: "9007199254740993",
    },
    links: [{
      session_id: "p1",
      account_id: aid,
      token_id: tid,
      detached_at: null,
    }],
  };
}

Deno.test("game identity adapter: one joined GET preserves decimal versions and requires exact session/token linkage", async () => {
  const f = clientFixture([row(), null]);
  const repository = createGameIdentityRepository(f.client);
  const snapshot =
    (await repository.tokenSnapshot(new Uint8Array(32).fill(7), "p1"))!;
  assert.equal(snapshot.accountVersion, "9007199254740993");
  assert.equal(snapshot.tokenVersion, snapshot.accountVersion);
  assert.equal(snapshot.link?.sessionId, "p1");
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url.pathname, "/rest/v1/account_tokens");
  assert.equal(f.requests[0].url.searchParams.get("links.session_id"), "eq.p1");
  assert.equal(
    f.requests[0].url.searchParams.get("token_hash"),
    "eq.\\x" + "07".repeat(32),
  );
  assert.match(
    f.requests[0].url.searchParams.get("select")!,
    /security_version::text/,
  );
  assert.equal(await repository.tokenSnapshot(new Uint8Array(32), "p1"), null);
  for (
    const bad of [{ ...row(), version: 9007199254740992 }, {
      ...row(),
      links: [{}],
    }, { ...row(), account: null }]
  ) {
    const invalid = clientFixture([bad]);
    await assert.rejects(
      () =>
        createGameIdentityRepository(invalid.client).tokenSnapshot(
          new Uint8Array(32),
          "p1",
        ),
      { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
    );
    assert.equal(invalid.requests.length, 1);
  }
});

Deno.test("session binding adapter: exact JSON CAS, mirror synchronization, and concurrent bind-once winner", async () => {
  const session = {
    sessionId: "p1",
    createdAt: "2026-11-21T00:00:00Z",
    displayName: null,
  };
  const stored = { ...session, sessionToken: "synthetic-session" };
  const f = clientFixture([
      [{ value: stored }],
      [{ key: "session_token_synthetic-session" }],
    ]),
    mirrors = new Map();
  const bind = createGameSessionNameBinder(
    f.client,
    async () => {
      throw new Error("Binder must not use kvGet");
    },
    async (k, v) => {
      mirrors.set(k, v);
    },
  );
  assert.equal(await bind("synthetic-session", session, "Pilot1"), "Pilot1");
  assert.equal(f.requests[0].method, "GET");
  assert.equal(f.requests[0].url.searchParams.get("select"), "value");
  assert.equal(
    f.requests[0].url.searchParams.get("key"),
    "eq.session_token_synthetic-session",
  );
  assert.equal(
    f.requests[1].url.searchParams.get("value"),
    "eq." + JSON.stringify(stored),
  );
  assert.equal(f.requests[1].body.value.displayName, "Pilot1");
  assert.equal(mirrors.get("session_id_p1").displayName, "Pilot1");
  const race = clientFixture([
    [{ value: stored }],
    [],
    [{ value: { ...stored, displayName: "Winner1" } }],
  ]);
  const raced = createGameSessionNameBinder(
    race.client,
    async () => {
      throw new Error("Binder must not use kvGet");
    },
    async () => {},
  );
  assert.equal(await raced("synthetic-session", session, "Other1"), "Winner1");
  assert.equal(race.requests.length, 3);
});

for (const mode of ["on", "names-only"] as const) {
  Deno.test(`${mode}: binder distinguishes missing/mismatched sessions from database/transport errors`, async () => {
    for (
      const kind of ["missing", "mismatch", "database", "transport"] as const
    ) {
      const unavailable = kind === "database" || kind === "transport";
      // The pinned client's maybeSingle() must treat a successful empty array as no row.
      const database = clientFixture([
        kind === "missing"
          ? []
          : kind === "mismatch"
          ? [{ value: { sessionId: "other" } }]
          : kind === "database"
          ? new Response(
            JSON.stringify({
              code: "XX000",
              message: "synthetic database failure",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          )
          : new Error("synthetic transport failure"),
      ]);
      const bind = createGameSessionNameBinder(database.client, async () => {
        throw new Error("Binder must not use kvGet");
      }, async () => {
        throw new Error("Failed reads must not write the mirror");
      });
      const f = enabledGameFixture(mode, bind);
      const response = await f.request("/create-game", {
        playerName: "Pilot1",
        timed: false,
      });
      assert.equal(response.status, unavailable ? 503 : 401, kind);
      assert.deepEqual(await response.json(), {
        error: unavailable
          ? "ACCOUNT_SERVICE_UNAVAILABLE"
          : "GAME_SESSION_INVALID",
        message: unavailable
          ? "Account service is unavailable."
          : "A valid game session is required.",
      });
      assert.equal(
        response.headers.get("Retry-After"),
        unavailable ? "5" : null,
      );
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(database.requests.length, 1);
      assert.equal(database.requests[0].method, "GET");
      assert.equal(f.persistence.writes.length, 0);
    }
  });
}

Deno.test("resolver: bind once, bound hint immunity and a 20-character normalized guest name", async () => {
  const f = enabledGameFixture();
  const one = await f.request("/create-game", {
    playerName: " \t" + "a".repeat(20) + " ",
    timed: false,
  });
  assert.equal(one.status, 200);
  assert.equal(f.sessions.get("p1").displayName, "a".repeat(20));
  const two = await f.request("/create-game", {
    playerName: "System",
    timed: false,
  });
  assert.equal(two.status, 200);
  assert.equal(
    f.state((await two.json()).gameId).players[0].name,
    "a".repeat(20),
  );
  assert.equal(f.calls.binds, 1);
  f.sessions.get("p1").displayName = " \tPilot2 ";
  const trimmed = await f.request("/create-game", {
    playerName: "Ignored",
    timed: false,
  });
  assert.equal(trimmed.status, 200);
  assert.equal(
    f.state((await trimmed.json()).gameId).players[0].name,
    "Pilot2",
  );
});

Deno.test("resolver: identity expiry cap, invalid/detached/mismatched/blocked identity, and password/reset revocation", async () => {
  for (
    const kind of [
      "expiry",
      "detached",
      "wrong",
      "blocked",
      "version",
      "password",
      "reset",
    ]
  ) {
    const f = enabledGameFixture(), a = await f.claim();
    const t = [...f.repository.tokens.values()][0];
    if (kind === "expiry") t.expires = f.repository.now + 2_000;
    const r = await f.request("/create-game", {
      playerName: "Pilot1",
      timed: false,
    }, a.headers);
    assert.equal(r.status, 200);
    const id = (await r.json()).gameId;
    if (kind === "expiry") f.repository.now += 2_000;
    else {
      if (kind === "detached") {
        f.repository.links.get("p1")!.detached = f.repository.now;
      }
      if (kind === "wrong") f.state(id).players[0].accountId = tid;
      if (kind === "blocked") {
        f.repository.accounts.get(a.entry.account.id)!.status = "blocked";
      }
      if (kind === "version") {
        f.repository.accounts.get(a.entry.account.id)!.version = "2";
      }
      if (kind === "reset") {
        await f.repository.ownerTransition(a.entry.account.id, {
          hash: "reset-hash",
        });
      }
      if (kind === "password") {
        const s = (await f.repository.readCredential("pilot1"))!;
        await f.repository.changePassword(
          s,
          "new-hash",
          "nfc-argon2id-v1",
          new Uint8Array(32).fill(33),
          "p1",
        );
      }
      f.repository.now += 15_000;
    }
    f.resetCalls();
    const response = await f.request(`/join-game/${id}`, {}, a.headers);
    assert.equal(response.status, kind === "blocked" ? 403 : 401, kind);
    assert.equal(
      (await response.json()).error,
      kind === "expiry"
        ? "ACCOUNT_TOKEN_EXPIRED"
        : kind === "blocked"
        ? "ACCOUNT_BLOCKED"
        : "ACCOUNT_TOKEN_INVALID",
    );
    assert.equal(f.calls.identities, 1);
  }
});

Deno.test("resolver: renewal occurs only beyond the database's exact one-hour threshold", async () => {
  const f = enabledGameFixture(), a = await f.claim();
  const created = await f.request("/create-game", { timed: false }, a.headers);
  assert.equal(created.status, 200);
  const id = (await created.json()).gameId;
  f.repository.now += 3_600_000;
  f.resetCalls();
  assert.equal(
    (await f.request(`/join-game/${id}`, {}, a.headers)).status,
    200,
  );
  assert.equal(f.calls.resumes, 0);
  f.repository.now++;
  f.resetCalls();
  assert.equal(
    (await f.request(`/join-game/${id}`, {}, a.headers)).status,
    200,
  );
  assert.equal(f.calls.identities, 0);
  assert.equal(f.calls.resumes, 1);
  f.resetCalls();
  assert.equal(
    (await f.request(`/join-game/${id}`, {}, a.headers)).status,
    200,
  );
  assert.equal(f.calls.resumes, 0);
});

Deno.test("resolver: slow identity lookups do not start a fresh cache window after returning", async () => {
  const f = enabledGameFixture(), a = await f.claim();
  const original = f.repository.tokenSnapshot.bind(f.repository);
  f.repository.tokenSnapshot = async (...args) => {
    const value = await original(...args);
    f.repository.now += 20_000;
    return value;
  };
  const created = await f.request("/create-game", { timed: false }, a.headers);
  assert.equal(created.status, 200);
  const id = (await created.json()).gameId;
  f.resetCalls();
  assert.equal(
    (await f.request(`/join-game/${id}`, {}, a.headers)).status,
    200,
  );
  assert.equal(f.calls.identities, 1);
});
