import assert from "node:assert/strict";
import { AccountFault } from "../../accounts/accountRepository.ts";
import { tokenDigest } from "../../accounts/tokens.ts";
import { MISSION_STORIES } from "../../engine/mission/MissionStories.ts";
import { accountFixture, prefix } from "./accountTestFixture.ts";

const [first, second] = MISSION_STORIES;
const empty = { missions: [], findings: [] };
type Fixture = ReturnType<typeof accountFixture>;

function state(f: Fixture, token?: string) {
  return f.app.request(prefix + "/accounts/missions/state", {
    headers: token === undefined ? {} : { "X-Account-Token": token },
  });
}
async function success(response: Response) {
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(Object.keys(body).sort(), ["missionProgress", "ok"]);
  return body.missionProgress;
}
async function error(response: Response, code: string, status = 400) {
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, code);
  assert.equal(body.missionProgress, undefined);
}

Deno.test("mission routes default, union in order, dedupe and filter both catalogues", async () => {
  const f = accountFixture(), a = await f.claim();
  assert.deepEqual(await success(await state(f, a.accountToken)), empty);
  const added = await f.post(
    "missions/add",
    {
      missions: [second.id, "unknown-mission", second.id, first.id],
      findings: [
        first.findingIds[1],
        "unknown-finding",
        first.findingIds[0],
        first.findingIds[1],
      ],
    },
    null,
    a.accountToken,
  );
  const expected = {
    missions: [second.id, first.id],
    findings: [first.findingIds[1], first.findingIds[0]],
  };
  assert.deepEqual(await success(added), expected);
  assert.deepEqual(
    await success(
      await f.post(
        "missions/add",
        {
          missions: [first.id, MISSION_STORIES[2].id, second.id],
          findings: [second.findingIds[0], first.findingIds[0]],
        },
        null,
        a.accountToken,
      ),
    ),
    {
      missions: [...expected.missions, MISSION_STORIES[2].id],
      findings: [...expected.findings, second.findingIds[0]],
    },
  );
});

Deno.test("omitted and empty adds retain progress, do not infer findings or write on no-op", async () => {
  const f = accountFixture(), a = await f.claim();
  const expected = { missions: [first.id], findings: [] };
  assert.deepEqual(
    await success(
      await f.post(
        "missions/add",
        {
          missions: [first.id],
        },
        null,
        a.accountToken,
      ),
    ),
    expected,
  );
  const stored = f.repository.missionProgress.get(a.account.id);
  for (
    const body of [
      {},
      { missions: [], findings: [] },
      { missions: [first.id] },
      {
        missions: ["unknown-mission"],
        findings: ["unknown-finding"],
      },
    ]
  ) {
    assert.deepEqual(
      await success(await f.post("missions/add", body, null, a.accountToken)),
      expected,
    );
    assert.equal(f.repository.missionProgress.get(a.account.id), stored);
  }
  assert.deepEqual(
    await success(
      await f.post(
        "missions/add",
        {
          findings: [first.findingIds[0]],
        },
        null,
        a.accountToken,
      ),
    ),
    { ...expected, findings: [first.findingIds[0]] },
  );
});

Deno.test("raw 100-entry boundary applies before dedupe and unknown-ID filtering", async () => {
  const f = accountFixture(), a = await f.claim();
  assert.deepEqual(
    await success(
      await f.post(
        "missions/add",
        {
          missions: Array(100).fill(first.id),
          findings: Array(100).fill(first.findingIds[0]),
        },
        null,
        a.accountToken,
      ),
    ),
    { missions: [first.id], findings: [first.findingIds[0]] },
  );
  for (const key of ["missions", "findings"]) {
    for (
      const id of [
        "unknown-id",
        key === "missions" ? first.id : first.findingIds[0],
      ]
    ) {
      await error(
        await f.post(
          "missions/add",
          { [key]: Array(101).fill(id) },
          null,
          a.accountToken,
        ),
        "INVALID_REQUEST",
      );
    }
  }
});

Deno.test("add rejects bad list types and malformed IDs instead of dropping them", async () => {
  const f = accountFixture(), a = await f.claim();
  for (const key of ["missions", "findings"]) {
    for (
      const value of [
        null,
        "id",
        1,
        false,
        {},
        [null],
        [1],
        [[]],
        [""],
        ["-id"],
        ["Upper"],
        ["a_b"],
        ["a b"],
        ["é"],
        ["a\n"],
        ["a\r"],
        ["x".repeat(81)],
      ]
    ) {
      await error(
        await f.post("missions/add", { [key]: value }, null, a.accountToken),
        "INVALID_REQUEST",
      );
    }
  }
  for (
    const body of [[], null, { revision: "1" }, {
      missions: [first.id],
      extra: [],
    }]
  ) {
    await error(
      await f.post("missions/add", body, null, a.accountToken),
      "INVALID_REQUEST",
    );
  }
  assert.deepEqual(await success(await state(f, a.accountToken)), empty);
});

Deno.test("reset accepts empty body or object, clears both lists, and rejects fields", async () => {
  const f = accountFixture(), a = await f.claim();
  await success(
    await f.post(
      "missions/add",
      { missions: [first.id], findings: first.findingIds },
      null,
      a.accountToken,
    ),
  );
  await error(
    await f.post("missions/reset", { missions: [] }, null, a.accountToken),
    "INVALID_REQUEST",
  );
  assert.deepEqual(
    await success(await f.post("missions/reset", {}, null, a.accountToken)),
    empty,
  );
  await success(
    await f.post(
      "missions/add",
      { missions: [first.id] },
      null,
      a.accountToken,
    ),
  );
  const reset = await f.app.request(prefix + "/accounts/missions/reset", {
    method: "POST",
    headers: { "X-Account-Token": a.accountToken },
  });
  assert.deepEqual(await success(reset), empty);
  assert.deepEqual(await success(await state(f, a.accountToken)), empty);
});

Deno.test("progress is shared across account tokens and isolated from other accounts and preferences", async () => {
  const f = accountFixture(), a = await f.claim();
  const signin = await f.post("sign-in", {
    name: "Pilot1",
    password: "abcdefghij",
  }, "s2");
  const b = await signin.json();
  const other = await f.claim("Pilot2", "s3");
  const prefs = f.repository.preferences.get(a.account.id)!;
  prefs.revision = "9007199254740993";
  const before = structuredClone({
    preferences: prefs,
    tokens: [...f.repository.tokens],
    links: [...f.repository.links],
  });
  f.repository.now += 7200000;
  await success(
    await f.post(
      "missions/add",
      { missions: [first.id], findings: first.findingIds },
      null,
      a.accountToken,
    ),
  );
  assert.deepEqual(await success(await state(f, b.accountToken)), {
    missions: [first.id],
    findings: first.findingIds,
  });
  assert.deepEqual(await success(await state(f, other.accountToken)), empty);
  await success(await f.post("missions/reset", {}, null, b.accountToken));
  assert.deepEqual(await success(await state(f, a.accountToken)), empty);
  assert.deepEqual({
    preferences: f.repository.preferences.get(a.account.id),
    tokens: [...f.repository.tokens],
    links: [...f.repository.links],
  }, before);
});

Deno.test("all mission routes require an account token and use preferences admission without S", async () => {
  const f = accountFixture(), a = await f.claim();
  const calls = [
    (token?: string) => state(f, token),
    (token?: string) => f.post("missions/add", {}, null, token),
    (token?: string) => f.post("missions/reset", {}, null, token),
  ];
  for (const call of calls) {
    await error(await call(), "ACCOUNT_TOKEN_REQUIRED", 401);
    for (const token of ["bad", "A".repeat(43)]) {
      await error(await call(token), "ACCOUNT_TOKEN_INVALID", 401);
    }
    f.events.length = 0;
    await success(await call(a.accountToken));
    assert.deepEqual(f.events, ["entry:preferences", "token"]);
  }
});

Deno.test("progress never bypasses expired, revoked, stale, blocked or banned authority", async () => {
  for (const kind of ["expired", "revoked", "stale", "blocked", "banned"]) {
    const f = accountFixture(), a = await f.claim();
    const token = [...f.repository.tokens.values()][0];
    const account = f.repository.accounts.get(a.account.id)!;
    if (kind === "expired") token.expires = f.repository.now;
    if (kind === "revoked") token.revoked = f.repository.now;
    if (kind === "stale") account.version = "2";
    if (kind === "blocked") account.status = "blocked";
    if (kind === "banned") {
      f.repository.rules = [{ kind: "banned", match: "exact", key: "piloti" }];
    }
    const code = kind === "expired"
      ? "ACCOUNT_TOKEN_EXPIRED"
      : kind === "blocked"
      ? "ACCOUNT_BLOCKED"
      : kind === "banned"
      ? "NAME_BANNED"
      : "ACCOUNT_TOKEN_INVALID";
    for (
      const response of [
        await state(f, a.accountToken),
        await f.post("missions/add", {}, null, a.accountToken),
        await f.post("missions/reset", {}, null, a.accountToken),
      ]
    ) {
      await error(
        response,
        code,
        kind === "blocked" || kind === "banned" ? 403 : 401,
      );
    }
    assert.deepEqual(f.repository.missionProgress.get(a.account.id), empty);
  }
});

Deno.test("off and names-only mission requests keep all account dependencies dormant", async () => {
  for (const mode of ["off", "names-only"] as const) {
    const f = accountFixture({ mode, rejectDependencies: true });
    await error(await state(f), "ACCOUNTS_NOT_ENABLED", 503);
    await error(await f.post("missions/add"), "ACCOUNTS_NOT_ENABLED", 503);
    await error(await f.post("missions/reset"), "ACCOUNTS_NOT_ENABLED", 503);
    assert.equal(f.dependencyCalls, 0);
    assert.equal((await f.app.request("/ordinary")).status, 200);
    assert.equal(f.dependencyCalls, 0);
  }
});

Deno.test("mission methods, content type and 16 KiB body cap retain account error contracts", async () => {
  const f = accountFixture(), a = await f.claim();
  await error(
    await f.app.request(prefix + "/accounts/missions/state", {
      headers: {
        "X-Account-Token": a.accountToken,
        "Content-Length": "16385",
      },
    }),
    "REQUEST_TOO_LARGE",
    413,
  );
  await error(
    await f.post("missions/state", {}, null, a.accountToken),
    "METHOD_NOT_ALLOWED",
    405,
  );
  for (const route of ["add", "reset"]) {
    const url = prefix + "/accounts/missions/" + route;
    await error(await f.app.request(url), "METHOD_NOT_ALLOWED", 405);
    const request = (body: string, extra: Record<string, string> = {}) =>
      f.app.request(url, {
        method: "POST",
        body,
        headers: {
          "X-Account-Token": a.accountToken,
          "Content-Type": "application/json",
          ...extra,
        },
      });
    assert.deepEqual(
      await success(await request("{}" + " ".repeat(16382))),
      empty,
    );
    await error(
      await request("{}" + " ".repeat(16383)),
      "REQUEST_TOO_LARGE",
      413,
    );
    await error(
      await request("{}", { "Content-Length": "16385" }),
      "REQUEST_TOO_LARGE",
      413,
    );
    await error(
      await request("{}", { "Content-Type": "text/plain" }),
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
    await error(await request("{"), "INVALID_REQUEST");
  }
  // The backwards-compatible reader default still applies to existing routes.
  await error(
    await f.app.request(prefix + "/accounts/logout", {
      method: "POST",
      body: "{}" + " ".repeat(8191),
      headers: { "Content-Type": "application/json" },
    }),
    "REQUEST_TOO_LARGE",
    413,
  );
});

Deno.test("mission rate denial returns the existing envelope without touching progress", async () => {
  let deny = false;
  const f = accountFixture({
    rate: {
      token: () => {
        if (deny) throw new AccountFault("RATE_LIMITED", undefined, 12);
        return Promise.resolve();
      },
    },
  });
  const a = await f.claim();
  deny = true;
  for (
    const response of [
      await state(f, a.accountToken),
      await f.post(
        "missions/add",
        { missions: [first.id] },
        null,
        a.accountToken,
      ),
      await f.post("missions/reset", {}, null, a.accountToken),
    ]
  ) {
    assert.equal(response.headers.get("Retry-After"), "12");
    await error(response, "RATE_LIMITED", 429);
  }
  assert.deepEqual(f.repository.missionProgress.get(a.account.id), empty);
});

Deno.test("fake repository enforces cumulative limits atomically for each list", async () => {
  for (const key of ["missions", "findings"] as const) {
    const f = accountFixture(),
      a = await f.claim(),
      hash = await tokenDigest(a.accountToken);
    const ids = Array.from({ length: 100 }, (_, i) => "synthetic-" + i);
    const before = {
      missions: key === "missions" ? ids : [],
      findings: key === "findings" ? ids : [],
    };
    assert.deepEqual(
      await f.repository.addMissionProgress(
        hash,
        before.missions,
        before.findings,
      ),
      before,
    );
    await assert.rejects(
      () => f.repository.addMissionProgress(hash, ["extra"], ["extra"]),
      { code: "INVALID_REQUEST" },
    );
    assert.deepEqual(await f.repository.getMissionProgress(hash), before);
    await assert.rejects(
      () => f.repository.addMissionProgress(hash, Array(101).fill("id"), []),
      { code: "INVALID_REQUEST" },
    );
    for (
      const bad of [null, [null], ["Upper"], ["x".repeat(81)], ["id\n"], [[
        "id",
      ]]]
    ) {
      await assert.rejects(
        () => f.repository.addMissionProgress(hash, bad as string[], []),
        { code: "INVALID_REQUEST" },
      );
      await assert.rejects(
        () => f.repository.addMissionProgress(hash, [], bad as string[]),
        { code: "INVALID_REQUEST" },
      );
    }
  }
});

Deno.test("fake repository accepts exactly 16384 jsonb text bytes and rejects 16385 atomically", async () => {
  const f = accountFixture(),
    a = await f.claim(),
    hash = await tokenDigest(a.accountToken);
  const id = (prefix: string, i: number, length: number) =>
    prefix + String(i).padStart(2, "0") + "x".repeat(length - 3);
  const missions = Array.from({ length: 100 }, (_, i) => id("m", i, 80));
  const findings = Array.from(
    { length: 100 },
    (_, i) => id("f", i, i < 56 ? 76 : 75),
  );
  assert.deepEqual(
    await f.repository.addMissionProgress(hash, missions, findings),
    { missions, findings },
  );
  await f.repository.resetMissionProgress(hash);
  findings[0] += "x";
  await assert.rejects(
    () => f.repository.addMissionProgress(hash, missions, findings),
    { code: "INVALID_REQUEST" },
  );
  assert.deepEqual(await f.repository.getMissionProgress(hash), empty);
});

Deno.test("fake transactions serialize concurrent account merges and roll back failed adds", async () => {
  const f = accountFixture(),
    a = await f.claim(),
    hash = await tokenDigest(a.accountToken);
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let firstAdd = true;
  f.repository.beforeCommit = async (category) => {
    if (category === "missions.add" && firstAdd) {
      firstAdd = false;
      entered.resolve();
      await release.promise;
    }
  };
  const one = f.repository.addMissionProgress(hash, ["one"], ["finding-one"]);
  await entered.promise;
  const two = f.repository.addMissionProgress(hash, ["two", "one"], [
    "finding-two",
  ]);
  release.resolve();
  await Promise.all([one, two]);
  const expected = {
    missions: ["one", "two"],
    findings: ["finding-one", "finding-two"],
  };
  assert.deepEqual(await f.repository.getMissionProgress(hash), expected);
  f.repository.failAt = "missions.add.commit";
  await assert.rejects(
    () => f.repository.addMissionProgress(hash, ["three"], []),
    { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
  );
  assert.deepEqual(await f.repository.getMissionProgress(hash), expected);
  const returned = await f.repository.getMissionProgress(hash);
  returned.missions.push("mutated");
  assert.deepEqual(await f.repository.getMissionProgress(hash), expected);
});

Deno.test("fake reset and add follow their serialized order", async () => {
  for (const resetFirst of [false, true]) {
    const f = accountFixture(),
      a = await f.claim(),
      hash = await tokenDigest(a.accountToken);
    await f.repository.addMissionProgress(hash, ["old"], ["old-finding"]);
    const entered = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>();
    let firstWrite = true;
    f.repository.beforeCommit = async () => {
      if (firstWrite) {
        firstWrite = false;
        entered.resolve();
        await release.promise;
      }
    };
    const one = resetFirst
      ? f.repository.resetMissionProgress(hash)
      : f.repository.addMissionProgress(hash, ["new"], []);
    await entered.promise;
    const two = resetFirst
      ? f.repository.addMissionProgress(hash, ["new"], [])
      : f.repository.resetMissionProgress(hash);
    release.resolve();
    await Promise.all([one, two]);
    assert.deepEqual(
      await f.repository.getMissionProgress(hash),
      resetFirst ? { missions: ["new"], findings: [] } : empty,
    );
  }
});
