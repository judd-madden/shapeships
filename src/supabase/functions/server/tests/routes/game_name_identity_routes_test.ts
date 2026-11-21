import assert from "node:assert/strict";
import { enabledGameFixture } from "../accounts/gameIdentityFixture.ts";
import { prefix } from "./game_identity_fixture.ts";
import {
  projectPublicPlayersForClient,
  sanitizeAncientStateForClient,
} from "../../engine/state/ancientState.ts";

async function failure(response: Response, code: string, status: number) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(
    typeof body.error === "string" ? body.error : body.rejected?.code,
    code,
  );
  return body;
}
const chat = (gameId: string) => ({
  gameId,
  intentType: "ACTION",
  turnNumber: 0,
  payload: { actionType: "message", content: "hello" },
});

for (const mode of ["names-only", "on"] as const) {
  Deno.test(`${mode}: all new assignment routes enforce claimed/reserved/banned/invalid names and guest whitespace`, async () => {
    for (
      const path of [
        "/session/start",
        "/create-game",
        "/create-computer-game",
        "/join-game/G1",
      ]
    ) {
      for (
        const [name, code, status] of [
          ["Pilot1", "CLAIMED_NAME_REQUIRES_ACCOUNT", 403],
          ["System", "NAME_RESERVED", 403],
          ["Computer", "NAME_RESERVED", 403],
          ["Forbidden", "NAME_BANNED", 403],
          ["Two Words", "INVALID_NAME", 400],
          ["  ", "INVALID_NAME", 400],
          ["ab", "INVALID_NAME", 400],
          ["a".repeat(21), "INVALID_NAME", 400],
          [42, "INVALID_NAME", 400],
        ] as const
      ) {
        const f = enabledGameFixture(mode);
        if (path.includes("join")) {
          await f.create(false, "Host1");
          f.session("p2");
        }
        await f.claim();
        f.ban("Forbidden");
        f.resetCalls();
        await failure(
          await f.request(
            path,
            path.includes("session")
              ? { displayName: name }
              : { playerName: name, timed: false },
          ),
          code,
          status,
        );
        assert.ok(f.calls.names.length <= 1);
      }
      const f = enabledGameFixture(mode);
      if (path.includes("join")) {
        await f.create(false, "Host1");
        f.session("p2");
      }
      const response = await f.request(
        path,
        path.includes("session")
          ? { displayName: " \tPilot9\r\n " }
          : { playerName: " \tPilot9\r\n ", timed: false },
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(
        path.includes("session")
          ? body.displayName
          : f.state(body.gameId ?? "G1").players.find((p: any) =>
            p.name === "Pilot9"
          )?.name,
        "Pilot9",
      );
    }
  });

  Deno.test(`${mode}: grandfathered seats rejoin/chat unchanged; new rematch, replacement and promotion revalidate`, async () => {
    for (const label of ["Two Words", "Pilot1", "System"]) {
      const f = enabledGameFixture(mode), id = await f.create(false, "Host1");
      f.state(id).players[0].name = label;
      f.sessions.get("p1").displayName = label;
      await f.claim();
      const response = await f.request(`/join-game/${id}`, {
        playerName: "Spoof",
      });
      assert.equal(response.status, 200);
      assert.equal(f.state(id).players[0].name, label);
      assert.equal((await f.request("/intent", chat(id))).status, 200);
      assert.equal(
        f.persistence.store.get(`game_${id}_chat`).entries.at(-1).playerName,
        label,
      );
      assert.equal(f.state(id).players[0].accountId, undefined);
      f.state(id).status = "finished";
      await failure(
        await f.request(`/new-game-from/${id}`),
        label === "Two Words"
          ? "INVALID_NAME"
          : label === "System"
          ? "NAME_RESERVED"
          : "CLAIMED_NAME_REQUIRES_ACCOUNT",
        label === "Two Words" ? 400 : 403,
      );
    }
    for (const kind of ["promotion", "replacement"]) {
      const f = enabledGameFixture(mode);
      const created = await f.request("/create-computer-game", {
        playerName: "Pilot1",
        timed: false,
        winStreakCount: 3,
      });
      const id = (await created.json()).gameId;
      if (kind === "promotion") f.state(id).players[0].role = "spectator";
      await f.claim();
      f.resetCalls();
      await failure(
        await f.request(
          kind === "promotion"
            ? `/switch-role/${id}`
            : `/reset-win-streak/${id}`,
          kind === "promotion" ? { newRole: "player" } : {},
        ),
        "CLAIMED_NAME_REQUIRES_ACCOUNT",
        403,
      );
      assert.equal(f.calls.names.length, 1);
    }
  });

  Deno.test(`${mode}: ban outage fails open for guest seat actions, fails closed for assignments; known bans reject`, async () => {
    for (const action of ["chat", "rejoin", "switch", "leave"]) {
      const f = enabledGameFixture(mode), id = await f.create();
      if (action === "leave") f.state(id).players[0].role = "spectator";
      f.repository.failAt = "nameStatus";
      f.resetCalls();
      const response = await f.request(
        action === "chat"
          ? "/intent"
          : action === "rejoin"
          ? `/join-game/${id}`
          : action === "switch"
          ? `/switch-role/${id}`
          : `/leave-spectator/${id}`,
        action === "chat"
          ? chat(id)
          : action === "rejoin"
          ? { playerName: "Ignored" }
          : action === "switch"
          ? { newRole: "spectator" }
          : {},
      );
      assert.equal(response.status, 200, action);
      assert.deepEqual(f.logs, ["BAN_LOOKUP_UNAVAILABLE_FAIL_OPEN"]);
      assert.equal(f.calls.names.length, 1);
    }
    for (
      const path of [
        "/session/start",
        "/create-game",
        "/create-computer-game",
        "/join-game/G1",
        "/new-game-from/G1",
        "/reset-win-streak/G1",
        "/switch-role/G1",
      ]
    ) {
      const f = enabledGameFixture(mode);
      if (path.endsWith("G1")) {
        const created = await f.request("/create-computer-game", {
          playerName: "Pilot1",
          timed: false,
          winStreakCount: 3,
        });
        assert.equal(created.status, 200);
        if (path.includes("join")) f.session("p3");
        if (path.includes("new-game")) f.state("G1").status = "finished";
        if (path.includes("switch")) {
          f.state("G1").players[0].role = "spectator";
        }
      }
      f.repository.failAt = "nameStatus";
      const r = await f.request(path, {
        displayName: "Pilot1",
        playerName: "Pilot1",
        newRole: "player",
        timed: false,
      });
      assert.equal(r.headers.get("Retry-After"), "5", path);
      await failure(r, "ACCOUNT_SERVICE_UNAVAILABLE", 503);
    }
    const f = enabledGameFixture(mode), id = await f.create();
    f.ban("Pilot1");
    await failure(await f.request("/intent", chat(id)), "NAME_BANNED", 403);
    await failure(await f.request(`/join-game/${id}`, {}), "NAME_BANNED", 403);
  });
}

Deno.test("on: account casing/provenance binds; every gameplay projection strips only accountId", async () => {
  const f = enabledGameFixture(), a = await f.claim("PiLoT1");
  const created = await f.request("/create-game", {
    playerName: "pilot1",
    timed: false,
    accountId: "spoof",
  }, a.headers);
  assert.equal(created.status, 200);
  const id = (await created.json()).gameId;
  assert.equal(f.state(id).players[0].name, "PiLoT1");
  assert.equal(f.state(id).players[0].accountId, a.entry.account.id);
  const clean = structuredClone(f.state(id));
  delete clean.players[0].accountId;
  assert.deepEqual(
    sanitizeAncientStateForClient(f.state(id), "p1"),
    sanitizeAncientStateForClient(clean, "p1"),
  );
  assert.deepEqual(
    projectPublicPlayersForClient(f.state(id), "p1"),
    projectPublicPlayersForClient(clean, "p1"),
  );
  await failure(
    await f.request("/create-game", { playerName: "Different" }, a.headers),
    "INVALID_REQUEST",
    400,
  );
  for (const path of [`/join-game/${id}`, `/switch-role/${id}`, "/intent"]) {
    const response = await f.request(
      path,
      path.includes("join")
        ? { playerName: "Ignored" }
        : path.includes("switch")
        ? { newRole: "player" }
        : chat(id),
      a.headers,
    );
    assert.equal(response.status, 200);
    assert.ok(!JSON.stringify(await response.json()).includes("accountId"));
  }
  const rejected = await f.request("/intent", {
    ...chat(id),
    intentType: "SURRENDER",
  }, a.headers);
  assert.ok(!JSON.stringify(await rejected.json()).includes("accountId"));
  f.repository.failAt = "tokenSnapshot";
  f.resetCalls();
  for (
    const route of [
      "game-state",
      "game-state-head",
      "game-history",
      "chat-state",
    ]
  ) {
    const response = await f.app.request(`${prefix}/${route}/${id}`, {
      headers: { "X-Session-Token": "p1" },
    });
    assert.equal(response.status, 200, route);
    assert.ok(!JSON.stringify(await response.json()).includes("accountId"));
  }
  assert.equal(f.calls.acquisitions, 0);
});

Deno.test("on: account-owned operations never fall back to guest and outages fail closed", async () => {
  for (
    const action of ["chat", "rejoin", "switch", "leave", "rematch", "reset"]
  ) {
    const f = enabledGameFixture(), a = await f.claim();
    const created = await f.request("/create-computer-game", {
      playerName: "Pilot1",
      timed: false,
      winStreakCount: 3,
    }, a.headers);
    const id = (await created.json()).gameId;
    if (action === "leave") f.state(id).players[0].role = "spectator";
    if (action === "rematch") f.state(id).status = "finished";
    const path = action === "chat" ? "/intent" : `/${
      ({
        rejoin: "join-game",
        switch: "switch-role",
        leave: "leave-spectator",
        rematch: "new-game-from",
        reset: "reset-win-streak",
      } as Record<string, string>)[action]
    }/${id}`;
    const body = action === "chat"
      ? chat(id)
      : { playerName: "Pilot1", newRole: "spectator" };
    await failure(await f.request(path, body), "ACCOUNT_TOKEN_REQUIRED", 401);
    f.repository.now += 15_000;
    f.repository.failAt = "tokenSnapshot";
    f.resetCalls();
    await failure(
      await f.request(path, body, a.headers),
      "ACCOUNT_SERVICE_UNAVAILABLE",
      503,
    );
    assert.equal(f.calls.identities, 1);
  }
});

Deno.test("on: logout suspends within 15 seconds and same-account sign-in restores the unchanged seat", async () => {
  const f = enabledGameFixture(), a = await f.claim();
  const created = await f.request("/create-game", {
    playerName: "Pilot1",
    timed: false,
  }, a.headers);
  const id = (await created.json()).gameId;
  await f.repository.logout(a.hash);
  f.repository.now += 14_999;
  assert.equal((await f.request("/intent", chat(id), a.headers)).status, 200);
  f.repository.now++;
  await failure(
    await f.request("/intent", chat(id), a.headers),
    "ACCOUNT_TOKEN_INVALID",
    401,
  );
  const { issueToken } = await import("../../accounts/tokens.ts");
  const fresh = await issueToken((n) => new Uint8Array(n).fill(99));
  await f.repository.finishSignin(
    (await f.repository.readCredential("pilot1"))!,
    fresh.hash,
    "p1",
  );
  assert.equal(
    (await f.request("/intent", chat(id), { "X-Account-Token": fresh.raw }))
      .status,
    200,
  );
  assert.equal(f.state(id).players[0].accountId, a.entry.account.id);
  assert.equal(f.state(id).players[0].id, "p1");
});

Deno.test("names-only: provenanced rematches/replacements/promotions use session authority; fresh impersonation does not", async () => {
  for (const action of ["rematch", "reset", "promotion"]) {
    const f = enabledGameFixture("names-only"), a = await f.claim();
    const id = await f.create(true, "Guest1");
    const p = f.state(id).players[0];
    p.accountId = a.entry.account.id;
    p.name = "Pilot1";
    f.state(id).gameData.winStreakBonus.appliedCount = 3;
    if (action === "rematch") f.state(id).status = "finished";
    if (action === "promotion") p.role = "spectator";
    await f.repository.logout(a.hash);
    f.resetCalls();
    const response = await f.request(
      `/${
        action === "rematch"
          ? "new-game-from"
          : action === "reset"
          ? "reset-win-streak"
          : "switch-role"
      }/${id}`,
      { newRole: "player" },
    );
    assert.equal(response.status, 200, action);
    const body = await response.json(),
      result = f.state(body.gameId ?? id).players[0];
    assert.equal(result.name, "Pilot1");
    assert.equal(result.accountId, a.entry.account.id);
    assert.equal(f.calls.identities, 0);
    assert.equal(f.calls.resumes, 0);
    assert.equal(f.calls.names.length, 1);
    f.session("p4");
    await failure(
      await f.request("/create-game", { playerName: "Pilot1" }),
      "CLAIMED_NAME_REQUIRES_ACCOUNT",
      403,
    );
  }
});

Deno.test("on: fresh assignment and CAS retries each spend at most one name RPC and one identity read", async () => {
  const f = enabledGameFixture(), a = await f.claim();
  const id = await f.create(false, "Host1");
  f.session("p2");
  await f.repository.resume(a.hash, "p2");
  f.persistence.conflicts = 2;
  f.resetCalls();
  assert.equal(
    (await f.request(`/join-game/${id}`, { playerName: "pilot1" }, a.headers))
      .status,
    200,
  );
  assert.equal(f.calls.names.length, 1);
  assert.equal(f.calls.identities, 1);
  f.repository.now += 3_600_001;
  f.resetCalls();
  f.persistence.conflicts = 2;
  assert.equal((await f.request("/intent", chat(id), a.headers)).status, 200);
  assert.equal(f.calls.identities, 1);
  assert.equal(f.calls.names.length, 1);
  assert.equal(f.calls.resumes, 1);
  f.resetCalls();
  assert.equal((await f.request("/intent", chat(id), a.headers)).status, 200);
  assert.equal(f.calls.identities, 0);
  assert.equal(f.calls.names.length, 0);
  assert.equal(f.calls.resumes, 0);
});

Deno.test("on: legacy ban failures are open and not cached; successful verdict expires at 60 seconds", async () => {
  const f = enabledGameFixture(), id = await f.create();
  f.state(id).players[0].name = "Old Pirate";
  f.repository.failAt = "liveNameRules";
  assert.equal((await f.request("/intent", chat(id))).status, 200);
  f.repository.failAt = undefined;
  f.repository.rules.push({ kind: "banned", match: "contains", key: "pirate" });
  await failure(await f.request("/intent", chat(id)), "NAME_BANNED", 403);
  const g = enabledGameFixture(), gid = await g.create();
  assert.equal((await g.request("/intent", chat(gid))).status, 200);
  g.ban("Pilot1");
  g.repository.now += 59_999;
  assert.equal((await g.request("/intent", chat(gid))).status, 200);
  g.repository.now++;
  await failure(await g.request("/intent", chat(gid)), "NAME_BANNED", 403);
});

Deno.test("on: account spectator entry stores casing/provenance, protects departure and emits the resolved label", async () => {
  const f = enabledGameFixture(), id = await f.create(false, "Host1");
  f.session("p2");
  assert.equal(
    (await f.request(`/join-game/${id}`, { playerName: "Guest2" })).status,
    200,
  );
  f.session("p3");
  const a = await f.claim("WaTcHeR3", "p3");
  f.resetCalls();
  const joined = await f.request(
    `/join-game/${id}`,
    { playerName: "watcher3" },
    a.headers,
  );
  assert.equal(joined.status, 200);
  const spectator = f.state(id).players[2];
  assert.equal(spectator.role, "spectator");
  assert.equal(spectator.accountId, a.entry.account.id);
  assert.equal(spectator.name, "WaTcHeR3");
  assert.equal(
    f.state(id).actions.at(-1).content,
    "WaTcHeR3 joined as a spectator",
  );
  assert.equal(
    f.persistence.store.get(`game_${id}_chat`).entries.at(-1).playerName,
    "WaTcHeR3",
  );
  assert.ok(!JSON.stringify(await joined.json()).includes("accountId"));
  assert.equal(f.calls.names.length, 1);
  assert.equal(f.calls.identities, 1);
  await failure(
    await f.request(`/leave-spectator/${id}`),
    "ACCOUNT_TOKEN_REQUIRED",
    401,
  );
  assert.equal(
    (await f.request(`/leave-spectator/${id}`, {}, a.headers)).status,
    200,
  );
});

Deno.test("on: claiming another name preserves the guest match; new seats use account casing and check both labels within budget", async () => {
  const f = enabledGameFixture(), id = await f.create(false, "OldGuest");
  const a = await f.claim("NewAccount");
  assert.equal((await f.request("/intent", chat(id), a.headers)).status, 200);
  assert.equal(f.state(id).players[0].name, "OldGuest");
  assert.equal(f.state(id).players[0].accountId, undefined);
  f.state(id).status = "finished";
  f.resetCalls();
  const next = await f.request(`/new-game-from/${id}`, {}, a.headers);
  assert.equal(next.status, 200);
  const participant = f.state((await next.json()).gameId).players[0];
  assert.equal(participant.name, "NewAccount");
  assert.equal(participant.accountId, a.entry.account.id);
  assert.equal(f.state(id).players[0].name, "OldGuest");
  assert.deepEqual(f.calls.names, ["NewAccount"]);
  assert.equal(f.calls.identities, 1);
  // Expire the stored-label verdict/rule snapshot, then prove a source ban is
  // still enforced even when the different new account label is permitted.
  f.ban("OldGuest");
  f.repository.now += 60_000;
  f.resetCalls();
  await failure(
    await f.request(`/new-game-from/${id}`, {}, a.headers),
    "NAME_BANNED",
    403,
  );
  assert.deepEqual(f.calls.names, ["NewAccount"]);
  assert.equal(f.calls.rules, 1);
});

Deno.test("on: CAS identity/name changes return conflict without a second lookup or stale mutation", async () => {
  const f = enabledGameFixture(), id = await f.create();
  f.persistence.conflicts = 1;
  f.persistence.beforeConflict = () => {
    f.state(id).players[0].name = "OtherName";
  };
  f.resetCalls();
  const response = await f.request("/intent", chat(id));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.rejected.code, "STATE_CONFLICT");
  assert.equal(body.state, null);
  assert.equal(f.calls.names.length, 1);
  assert.equal(f.calls.identities, 0);
  assert.equal(f.persistence.store.get(`game_${id}_chat`), undefined);
});

Deno.test("names-only: revoked/blocked account seats continue by session, including when ban lookup is unavailable", async () => {
  const f = enabledGameFixture("names-only"), a = await f.claim();
  const id = await f.create(false, "Guest1");
  f.state(id).players[0].accountId = a.entry.account.id;
  await f.repository.ownerTransition(a.entry.account.id, { blocked: true });
  f.repository.failAt = "nameStatus";
  f.resetCalls();
  assert.equal(
    (await f.request("/intent", chat(id), { "X-Account-Token": "malformed" }))
      .status,
    200,
  );
  assert.equal(f.calls.identities, 0);
  assert.deepEqual(f.logs, ["BAN_LOOKUP_UNAVAILABLE_FAIL_OPEN"]);
});

Deno.test("on: an in-flight CAS retry cannot extend its old verdict into the next request's cache window", async () => {
  const f = enabledGameFixture(), id = await f.create();
  f.persistence.conflicts = 1;
  f.persistence.beforeConflict = () => {
    f.repository.now += 60_001;
    f.ban("Pilot1");
  };
  f.resetCalls();
  assert.equal((await f.request("/intent", chat(id))).status, 200);
  assert.equal(f.calls.names.length, 1);
  f.resetCalls();
  await failure(await f.request("/intent", chat(id)), "NAME_BANNED", 403);
  assert.equal(f.calls.names.length, 1);
});
