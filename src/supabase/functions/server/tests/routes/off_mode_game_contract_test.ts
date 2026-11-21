import assert from "node:assert/strict";
import { gameIdentityFixture, prefix } from "./game_identity_fixture.ts";

function fixture() {
  let calls = 0;
  const f = gameIdentityFixture({
    mode: "off",
    getResolver: () => {
      calls++;
      throw new Error("Off routes must never acquire the resolver");
    },
  });
  return {
    ...f,
    untouched() {
      assert.equal(calls, 0);
    },
  };
}
async function exact(response: Response, status: number, body: unknown) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), body);
  assert.equal(response.headers.get("Retry-After"), null);
}

Deno.test("off contract: session/start keeps original body, bootstrap and both KV mirrors", async () => {
  const f = fixture();
  const response = await f.request("/session/start", {
    displayName: " Legacy Name ",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.sessionToken, /^[0-9a-f]{64}$/);
  assert.match(body.sessionId, /^session_/);
  assert.deepEqual(body, {
    sessionToken: body.sessionToken,
    sessionId: body.sessionId,
    displayName: " Legacy Name ",
    message: "Session created successfully",
  });
  const saved = f.persistence.store.get(`session_token_${body.sessionToken}`);
  assert.deepEqual(
    saved,
    f.persistence.store.get(`session_id_${body.sessionId}`),
  );
  assert.equal(saved.displayName, " Legacy Name ");
  const bootstrap = await f.app.request(prefix + "/session/start", {
    method: "POST",
    body: "malformed",
  });
  assert.equal((await bootstrap.json()).displayName, null);
  f.untouched();
});

for (const computer of [false, true]) {
  Deno.test(`off contract: ${computer ? "create-computer-game" : "create-game"} trims, preserves names/settings/session precedence`, async () => {
    const f = fixture(),
      path = computer ? "/create-computer-game" : "/create-game";
    await exact(await f.request(path, { timed: "invalid" }), 400, {
      error: "Player name is required",
    });
    await exact(
      await f.request(path, {}, { "X-Session-Token": "invalid" }),
      401,
      { error: "Unauthorized", message: "Invalid or expired session token" },
    );
    const response = await f.request(path, {
      playerName: "  Two Words  ",
      timed: false,
    });
    await exact(
      response,
      200,
      computer
        ? {
          gameId: "G1",
          message: "Computer game created successfully",
          chosenBotPlanId: null,
        }
        : { gameId: "G1", message: "Game created successfully" },
    );
    assert.equal(f.state("G1").players[0].name, "Two Words");
    if (computer) assert.equal(f.state("G1").players[1].name, "Computer");
    f.untouched();
  });
}

Deno.test("off contract: new-game-from preserves finished/source-player checks and stored trimmed label", async () => {
  const f = fixture(), id = await f.create(false, " Legacy Name ");
  await exact(await f.request(`/new-game-from/${id}`), 400, {
    error: "New game can only be created from a finished game",
  });
  f.session("p2");
  await exact(await f.request(`/new-game-from/${id}`), 403, {
    error: "Only players from this finished game can create a new game",
  });
  f.session("p1");
  f.state(id).status = "finished";
  await exact(await f.request(`/new-game-from/${id}`), 200, { gameId: "G2" });
  assert.equal(f.state("G2").players[0].name, "Legacy Name");
  f.untouched();
});

Deno.test("off contract: reset-win-streak preserves eligibility, replacement and duplicate response", async () => {
  const f = fixture();
  const created = await f.request("/create-computer-game", {
    playerName: " Legacy Name ",
    timed: false,
    winStreakCount: 3,
  });
  const id = (await created.json()).gameId;
  f.session("p2");
  await exact(await f.request(`/reset-win-streak/${id}`), 403, {
    error: "Only the human player can restart this game",
  });
  f.session("p1");
  const result = { gameId: "G2", sourceGameId: id, resetStatus: "completed" };
  await exact(await f.request(`/reset-win-streak/${id}`), 200, result);
  await exact(await f.request(`/reset-win-streak/${id}`), 200, result);
  assert.equal(f.state("G2").players[0].name, "Legacy Name");
  f.untouched();
});

Deno.test("off contract: join-game preserves raw labels, validation precedence and rejoin identity", async () => {
  const f = fixture(), id = await f.create();
  await exact(await f.request("/join-game/missing", {}), 400, {
    error: "Player name is required",
  });
  await exact(
    await f.request("/join-game/missing", { playerName: "Guest" }),
    404,
    { error: "Game not found" },
  );
  f.session("p2");
  const joined = await f.request(`/join-game/${id}`, {
    playerName: "  Two Words  ",
  });
  assert.equal(joined.status, 200);
  assert.equal((await joined.json()).message, "Joined game successfully");
  assert.equal(f.state(id).players[1].name, "  Two Words  ");
  await f.request(`/join-game/${id}`, { playerName: "Replacement" });
  assert.equal(f.state(id).players[1].name, "  Two Words  ");
  f.untouched();
});

Deno.test("off contract: switch-role preserves role validation before load and stored name", async () => {
  const f = fixture(), id = await f.create();
  await exact(await f.request("/switch-role/missing", {}), 400, {
    error: "New role is required",
  });
  await exact(
    await f.request("/switch-role/missing", { newRole: "other" }),
    400,
    { error: "Role must be 'player' or 'spectator'" },
  );
  const response = await f.request(`/switch-role/${id}`, {
    newRole: "spectator",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.message, "Role switched successfully");
  assert.equal(body.gameData.players[0].name, "Pilot1");
  assert.equal(f.state(id).players[0].role, "spectator");
  f.untouched();
});

Deno.test("off contract: leave-spectator preserves player rejection and idempotent removal", async () => {
  const f = fixture(), id = await f.create();
  await exact(await f.request(`/leave-spectator/${id}`), 403, {
    error: "Only spectators may leave through this route",
  });
  await f.request(`/switch-role/${id}`, { newRole: "spectator" });
  await exact(await f.request(`/leave-spectator/${id}`), 200, {
    message: "Spectator left successfully",
  });
  await exact(await f.request(`/leave-spectator/${id}`), 200, {
    message: "Spectator already left",
  });
  f.untouched();
});

Deno.test("off contract: intent/chat preserves payload/session errors and stored sender", async () => {
  const f = fixture(), id = await f.create();
  await exact(await f.request("/intent", {}), 400, {
    ok: false,
    state: null,
    events: [],
    rejected: {
      code: "BAD_PAYLOAD",
      message: "Missing required fields: gameId, intentType, turnNumber",
    },
  });
  await exact(
    await f.request("/intent", {}, { "X-Session-Token": "invalid" }),
    401,
    { error: "Unauthorized", message: "Invalid or expired session token" },
  );
  const response = await f.request("/intent", {
    gameId: id,
    intentType: "ACTION",
    turnNumber: 0,
    payload: { actionType: "message", content: "hello", playerName: "spoof" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.events[0].playerName, "Pilot1");
  assert.equal(
    f.persistence.store.get(`game_${id}_chat`).entries[0].playerName,
    "Pilot1",
  );
  f.untouched();
});
