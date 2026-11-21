import assert from "node:assert/strict";
import { gameIdentityFixture, prefix } from "./game_identity_fixture.ts";
import {
  HOUR,
  sessionKvFixture,
} from "../accounts/gameSessionRenewalFixture.ts";

for (const mode of ["off", "names-only", "on"]) {
  Deno.test(`${mode}: accepted intents renew, polling/rejected spectator chat does not, R1 call budget`, async () => {
    const kv = sessionKvFixture();
    const calls = { resolver: 0, renew: 0 };
    const f = gameIdentityFixture({
      mode,
      getResolver: () => {
        calls.resolver++;
        return {
          request: () => ({
            seat: async () => {},
            resolve: async ({ hint }: any) => ({
              displayName: hint ?? "Pilot1",
            }),
          }),
        };
      },
    }, async (token, session) => {
      calls.renew++;
      await kv.renew(token, session);
    });
    f.sessions.set("p1", kv.session);
    const id = await f.create();
    const chat = {
      gameId: id,
      intentType: "ACTION",
      turnNumber: 0,
      payload: { actionType: "message", content: "hello", playerName: "spoof" },
    };
    kv.clock.now = kv.start + HOUR - 1;
    const first = await f.request("/intent", chat);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).ok, true);
    assert.equal(kv.calls.length, 0);
    kv.clock.now++;
    assert.equal((await f.request("/intent", chat)).status, 200);
    assert.equal(kv.calls.length, 4);
    f.sessions.set("p1", structuredClone(kv.rows.get("session_token_p1")));
    kv.calls.length = 0;
    assert.equal((await f.request("/intent", chat)).status, 200);
    assert.equal(kv.calls.length, 0);
    const before = calls.renew;
    await f.request("/intent", {});
    await f.request("/intent", chat, { "X-Session-Token": "invalid" });
    await f.app.request(prefix + `/chat-state/${id}`, {
      headers: { "X-Session-Token": "p1" },
    });
    await f.app.request(prefix + `/game-state-head/${id}`, {
      headers: { "X-Session-Token": "p1" },
    });
    assert.equal(calls.renew, before);
    assert.equal(kv.calls.length, 0);
    const move = await f.request("/intent", {
      gameId: id,
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: { species: "human" },
      nonce: "renewal-move",
    });
    assert.equal(move.status, 200);
    assert.equal(kv.calls.length, 0);
    if (mode === "off") assert.equal(calls.resolver, 0);
    // Owner decision: preserve the existing rule rejecting spectator ACTION/chat.
    const spectator = { ...kv.session, sessionId: "p3" };
    kv.rows.set("session_token_p3", spectator);
    kv.rows.set("session_id_p3", spectator);
    f.sessions.set("p3", spectator);
    await f.request(`/join-game/${id}`, {
      role: "spectator",
      playerName: "Viewer3",
    }, { "X-Session-Token": "p3" });
    assert.equal(
      (await f.request(`/switch-role/${id}`, { newRole: "spectator" }, {
        "X-Session-Token": "p3",
      })).status,
      200,
    );
    assert.equal(
      f.state(id).players.find((p: any) => p.id === "p3").role,
      "spectator",
    );
    const renewalsBeforeSpectatorChat = calls.renew;
    const rejected = await f.request("/intent", chat, {
      "X-Session-Token": "p3",
    });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).rejected.code, "PLAYER_NOT_ACTIVE");
    assert.equal(calls.renew, renewalsBeforeSpectatorChat);
    assert.equal(kv.calls.length, 0);
  });
}

Deno.test("renewal callback failure preserves the accepted off-mode response", async () => {
  const f = gameIdentityFixture({ mode: "off" }, async () => {
    throw new Error("synthetic renewal error");
  });
  const id = await f.create();
  const response = await f.request("/intent", {
    gameId: id,
    intentType: "ACTION",
    turnNumber: 0,
    payload: { actionType: "message", content: "ok" },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});
