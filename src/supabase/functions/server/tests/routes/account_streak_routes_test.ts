import assert from "node:assert/strict";
import { accountFixture, prefix } from "../accounts/accountTestFixture.ts";
import { FakeStreakRepository } from "../accounts/fakeStreakRepository.ts";
import { createFreshComputerGameData } from "../../routes/computer_game_factory.ts";
import { prepareStreakGameRow } from "../../accounts/streakPreparation.ts";
import {
  createStreakRepository,
  type StreakRepository,
} from "../../accounts/streakRepository.ts";
import { AccountFault } from "../../accounts/accountRepository.ts";
import type { AccountRateLimit } from "../../accounts/rateLimit.ts";

function fixture(rate?: Partial<AccountRateLimit>) {
  let fake: FakeStreakRepository, loads = 0;
  const imports: Parameters<StreakRepository["importGuest"]>[0][] = [];
  const calls: string[] = [], reads: string[] = [];
  const repository: StreakRepository = {
    reconcile: (input) => {
      calls.push("reconcile");
      return fake.reconcile(input);
    },
    reset: (input) => {
      calls.push("reset");
      return fake.reset(input);
    },
    commitGame: (input) => fake.commitGame(input),
    importGuest: (input) => {
      calls.push("import");
      imports.push(structuredClone(input));
      return fake.importGuest(input);
    },
  };
  const f = accountFixture({
    rate,
    streak: {
      getRepository: () => {
        loads++;
        return Promise.resolve(repository);
      },
      loadGame: (id) => {
        reads.push(id);
        return Promise.resolve(fake.rows.get(`game_${id}`)?.value);
      },
    },
  });
  fake = new FakeStreakRepository(f.repository);
  return {
    ...f,
    fake,
    repository,
    imports,
    calls,
    reads,
    get loads() {
      return loads;
    },
  };
}
function offer(anchorGameId = "GUEST1", humanPlayerId = "old-session") {
  return {
    expectedRevision: "1",
    decision: "compare",
    guest: {
      currentCount: 5,
      anchorGameId,
      humanPlayerId,
      resultPending: false,
    },
  };
}
function anchor(
  f: ReturnType<typeof fixture>,
  id = "GUEST1",
  human = "old-session",
) {
  const game = createFreshComputerGameData(id, human, "Guest1", null, 5);
  f.fake.rows.set(`game_${id}`, prepareStreakGameRow(game));
  return f.fake.rows.get(`game_${id}`)!.value;
}

Deno.test("account streak routes: state, import and bigint reset preserve exact envelopes", async () => {
  const f = fixture(), a = await f.claim();
  const state = await f.post("streak/state", {}, "s1", a.accountToken);
  assert.equal(state.status, 200);
  const first = await state.json();
  assert.deepEqual(Object.keys(first).sort(), ["ok", "streak"]);
  assert.equal(first.streak.currentCount, 0);
  anchor(f);
  const imported = await f.post("streak/import", offer(), "s1", a.accountToken);
  assert.equal(imported.status, 200);
  const result = await imported.json();
  assert.deepEqual(result.import, {
    anchorGameId: "GUEST1",
    selection: "guest",
    acceptedCount: 5,
    continuation: "none",
  });
  assert.equal(result.streak.currentCount, 5);
  assert.deepEqual(f.reads, []);
  f.fake.runs.get(a.account.id)!.revision = "9007199254740993";
  const reset = await f.post(
    "streak/reset",
    { expectedRevision: "9007199254740993" },
    "s1",
    a.accountToken,
  );
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).streak.revision, "9007199254740994");
  for (const response of [state, imported, reset]) {
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const replay = await f.post("streak/import", offer(), "s1", a.accountToken);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).streak.currentCount, 0);
});

Deno.test("account streak routes: schema and positive-bigint revision validation", async () => {
  const f = fixture(), a = await f.claim();
  const invalid = [
    undefined,
    null,
    1,
    "",
    "0",
    "01",
    "-1",
    "+1",
    "1.0",
    "1e2",
    " 1",
    "9223372036854775808",
  ];
  for (const route of ["streak/reset", "streak/import"]) {
    for (const revision of invalid) {
      const r = await f.post(
        route,
        {
          ...offer(),
          expectedRevision: revision,
          ...(route === "streak/reset"
            ? { decision: undefined, guest: undefined }
            : {}),
        },
        "s1",
        a.accountToken,
      );
      assert.equal(r.status, 400, `${route}: ${revision}`);
      assert.equal((await r.json()).error.code, "INVALID_REQUEST");
    }
  }
  for (const body of [{ accountId: a.account.id }, { winner: "human" }]) {
    assert.equal(
      (await f.post("streak/state", body, "s1", a.accountToken)).status,
      400,
    );
  }
  for (
    const body of [
      { ...offer(), decision: "merge" },
      { ...offer(), guest: null },
      ...[
        { currentCount: -1 },
        { currentCount: "5" },
        { currentCount: 1.1 },
        { currentCount: Number.MAX_SAFE_INTEGER + 1 },
        { anchorGameId: "" },
        { humanPlayerId: "" },
        { resultPending: 1 },
        { accountId: a.account.id },
      ]
        .map((patch) => ({
          ...offer(),
          guest: { ...offer().guest, ...patch },
        })),
    ]
  ) {
    assert.equal(
      (await f.post("streak/import", body, "s1", a.accountToken)).status,
      400,
    );
  }
  assert.equal(f.loads, 0);
  // The largest bigint is valid wire input; do not attempt to increment it here.
  let accepted = "";
  f.repository.reset = async (input) => {
    accepted = input.expectedRevision;
    return await f.fake.reconcile(input);
  };
  assert.equal(
    (await f.post(
      "streak/reset",
      { expectedRevision: "9223372036854775807" },
      "s1",
      a.accountToken,
    )).status,
    200,
  );
  assert.equal(accepted, "9223372036854775807");
});

Deno.test("account streak routes: methods, JSON media and real 8 KiB byte cap", async () => {
  const f = fixture(), a = await f.claim();
  for (const route of ["state", "import", "reset"]) {
    const url = `${prefix}/accounts/streak/${route}`;
    const headers = {
      "X-Session-Token": "s1",
      "X-Account-Token": a.accountToken,
      "Content-Type": "application/json",
    };
    for (const method of ["GET", "PUT", "DELETE"]) {
      const r = await f.app.request(url, { method, headers });
      assert.equal(r.status, 405);
      assert.equal(r.headers.get("Cache-Control"), "no-store");
    }
    const huge = await f.app.request(url, {
      method: "POST",
      headers,
      body: " ".repeat(8193),
    });
    assert.equal(huge.status, 413);
    const media = await f.app.request(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.equal(media.status, 415);
    const broken = await f.app.request(url, {
      method: "POST",
      headers,
      body: "{",
    });
    assert.equal(broken.status, 400);
  }
  const exact = await f.app.request(`${prefix}/accounts/streak/state`, {
    method: "POST",
    headers: {
      "X-Session-Token": "s1",
      "X-Account-Token": a.accountToken,
      "Content-Type": "application/json",
    },
    body: "{}" + " ".repeat(8190),
  });
  assert.equal(exact.status, 200);
});

Deno.test("account streak routes: required session/token and transaction-time link authority", async () => {
  for (const route of ["streak/state", "streak/reset", "streak/import"]) {
    for (
      const kind of [
        "missingS",
        "invalidS",
        "missingA",
        "malformedA",
        "unknownA",
        "unlinked",
        "expired",
        "revoked",
        "blocked",
      ]
    ) {
      const f = fixture(), a = await f.claim();
      const token = [...f.fake.authority.tokens.values()][0];
      if (kind === "expired") token.expires = f.fake.authority.now;
      if (kind === "revoked") token.revoked = f.fake.authority.now;
      if (kind === "blocked") {
        f.fake.authority.accounts.get(a.account.id)!.status = "blocked";
      }
      const session = kind === "missingS"
        ? null
        : kind === "invalidS"
        ? "bad"
        : kind === "unlinked"
        ? "s2"
        : "s1";
      const raw = kind === "missingA"
        ? undefined
        : kind === "malformedA"
        ? "bad"
        : kind === "unknownA"
        ? "B".repeat(43)
        : a.accountToken;
      const body = route === "streak/state"
        ? {}
        : route === "streak/reset"
        ? { expectedRevision: "1" }
        : offer();
      const r = await f.post(route, body, session, raw);
      assert.equal(r.status, kind === "blocked" ? 403 : 401, route + kind);
      const code = (await r.json()).error.code;
      assert.equal(
        code,
        kind.endsWith("S")
          ? "GAME_SESSION_INVALID"
          : kind === "missingA"
          ? "ACCOUNT_TOKEN_REQUIRED"
          : kind === "expired"
          ? "ACCOUNT_TOKEN_EXPIRED"
          : kind === "blocked"
          ? "ACCOUNT_BLOCKED"
          : "ACCOUNT_TOKEN_INVALID",
      );
      assert.equal(r.headers.get("Cache-Control"), "no-store");
    }
  }
});

Deno.test("account streak routes: every P225x mapping is private and unavailable retries after five", async () => {
  for (
    const [sql, code, status] of [
      ["P2250", "STREAK_CONFLICT", 409],
      ["P2251", "STREAK_IMPORT_UNVERIFIED", 422],
      ["P2252", "STREAK_IMPORT_CONSUMED", 409],
      ["P2253", "STREAK_SEAT_FORBIDDEN", 403],
      ["P2255", "STREAK_GAME_NOT_FOUND", 404],
      ["P2256", "ACCOUNT_SERVICE_UNAVAILABLE", 503],
      ["57014", "ACCOUNT_SERVICE_UNAVAILABLE", 503],
    ] as const
  ) {
    const repo = createStreakRepository({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: sql, message: "PRIVATE-DB-DETAIL" },
        }),
    });
    const f = accountFixture({
      streak: {
        getRepository: () => Promise.resolve(repo),
        loadGame: () => Promise.resolve(null),
      },
    });
    const a = await f.claim();
    const r = await f.post("streak/import", offer(), "s1", a.accountToken);
    assert.equal(r.status, status);
    assert.equal((await r.json()).error.code, code);
    assert.equal(r.headers.get("Retry-After"), status === 503 ? "5" : null);
    assert.ok(!JSON.stringify(f.logs).includes("PRIVATE"));
    assert.ok(!JSON.stringify(f.logs).includes(sql));
  }
});

Deno.test("account streak routes: conflict refresh carries current snapshot and may fail safely", async () => {
  const f = fixture(), a = await f.claim();
  await f.post("streak/state", {}, "s1", a.accountToken);
  f.fake.runs.get(a.account.id)!.currentCount = 7;
  const r = await f.post(
    "streak/reset",
    { expectedRevision: "2" },
    "s1",
    a.accountToken,
  );
  assert.equal(r.status, 409);
  assert.equal((await r.json()).streak.currentCount, 7);
  f.repository.reconcile = () => Promise.reject(new Error("SECRET"));
  const failedRefresh = await f.post(
    "streak/reset",
    { expectedRevision: "2" },
    "s1",
    a.accountToken,
  );
  assert.equal(failedRefresh.status, 409);
  assert.equal((await failedRefresh.json()).streak, undefined);
});

Deno.test("account streak routes: preferences admission, credential redaction and dormant loaders", async () => {
  let entries = 0, tokens = 0;
  const f = fixture({
    entry: async (c) => {
      if (c.category !== "preferences") return;
      entries++;
      for (
        const header of [
          "Authorization",
          "apikey",
          "X-Session-Token",
          "X-Account-Token",
        ]
      ) assert.equal(c.headers.get(header), null);
    },
    token: async (c, hash) => {
      assert.equal(c.category, "preferences");
      assert.equal(hash?.length, 32);
      tokens++;
      if (tokens === 3) throw new AccountFault("RATE_LIMITED", undefined, 9);
    },
  });
  const a = await f.claim();
  for (const route of ["streak/state", "streak/reset", "streak/import"]) {
    const r = await f.post(
      route,
      route.endsWith("state")
        ? {}
        : route.endsWith("reset")
        ? { expectedRevision: "1" }
        : offer(),
      "s1",
      a.accountToken,
    );
    if (route.endsWith("import")) {
      assert.equal(r.status, 429);
      assert.equal(r.headers.get("Retry-After"), "9");
    } else assert.equal(r.status, 200);
  }
  assert.equal(entries, 3);
  assert.equal(tokens, 3);
  assert.equal(f.loads, 2);
  for (const mode of ["off", "names-only"] as const) {
    const dormant = accountFixture({ mode, rejectDependencies: true });
    for (const route of ["state", "import", "reset"]) {
      assert.equal((await dormant.post(`streak/${route}`)).status, 503);
    }
    assert.equal(dormant.dependencyCalls, 0);
  }
});

Deno.test("account streak import: adoption prepared only for a directly proven active guest human", async () => {
  for (
    const kind of ["direct", "other", "finished", "owned", "bot", "missing"]
  ) {
    const f = fixture(), a = await f.claim();
    const human = kind === "other" ? "old-session" : "session-s1";
    const game = anchor(f, "GUEST1", human);
    if (kind === "finished") {
      game.status = "finished";
      game.resultReason = "agreement";
    }
    if (kind === "owned") game.players[0].accountId = a.account.id;
    if (kind === "bot") game.controllersByPlayerId[human].kind = "bot";
    if (kind === "missing") f.fake.rows.delete("game_GUEST1");
    let received: any;
    f.repository.importGuest = async (input) => {
      received = input;
      return {
        streak: await f.fake.reconcile(input),
        import: {
          anchorGameId: "GUEST1",
          selection: "account",
          acceptedCount: 0,
          continuation: "none",
        },
      };
    };
    const r = await f.post(
      "streak/import",
      offer("GUEST1", human),
      "s1",
      a.accountToken,
    );
    assert.equal(r.status, 200, kind);
    assert.equal(received.adoption !== null, kind === "direct", kind);
    if (kind === "direct") {
      assert.equal(
        received.adoption.update.value.players[0].accountId,
        a.account.id,
      );
      assert.equal(game.players[0].accountId, undefined);
    }
    assert.equal(f.reads.length, kind === "other" ? 0 : 1);
  }
});

Deno.test("account streak import: direct adoption and decline are committed through the route", async () => {
  for (const decision of ["compare", "decline"]) {
    const f = fixture(), a = await f.claim();
    const game = anchor(f, "GUEST1", "session-s1");
    const before = structuredClone(game);
    const r = await f.post(
      "streak/import",
      {
        ...offer("GUEST1", "session-s1"),
        decision,
      },
      "s1",
      a.accountToken,
    );
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(
      result.import.selection,
      decision === "compare" ? "guest" : "declined",
    );
    assert.equal(
      result.import.continuation,
      decision === "compare" ? "authorised" : "none",
    );
    assert.equal(result.streak.currentCount, decision === "compare" ? 5 : 0);
    const stored = f.fake.rows.get("game_GUEST1")!.value;
    if (decision === "compare") {
      assert.equal(stored.players[0].accountId, a.account.id);
      assert.equal(stored.stateRevision, before.stateRevision + 1);
      assert.equal(result.streak.trackedGame.humanPlayerId, "session-s1");
    } else assert.deepEqual(stored, before);
    assert.equal(f.fake.imports.size, 1);
  }
});
