import assert from "node:assert/strict";
import { enabledGameFixture } from "../accounts/gameIdentityFixture.ts";

Deno.test("on computer lifecycle: setup, human/bot turns, chat, surrender, rematch and streak replacement exempt only server identities", async () => {
  const f = enabledGameFixture();
  // Even an accidental lookup would return banned, rather than merely reserved.
  f.ban("Computer");
  f.ban("System");
  const created = await f.request("/create-computer-game", {
    playerName: "HumanPilot",
    timed: false,
    winStreakCount: 3,
  });
  assert.equal(created.status, 200);
  const id = (await created.json()).gameId;
  let nonce = 0;
  async function intent(gameId: string, intentType: string, payload?: unknown) {
    const r = await f.request("/intent", {
      gameId,
      intentType,
      payload,
      turnNumber: f.state(gameId).gameData.turnNumber,
      nonce: `bot-e2e-${++nonce}`,
    });
    const body = await r.json();
    assert.equal(
      r.status,
      200,
      `${intentType}: ${JSON.stringify(body.rejected)}`,
    );
    assert.equal(body.ok, true);
    return body;
  }
  function serverNames(gameId: string) {
    const state = f.state(gameId);
    assert.equal(state.players[1].name, "Computer");
    assert.equal(state.controllersByPlayerId[state.players[1].id].kind, "bot");
    assert.equal(state.players[1].accountId, undefined);
    assert.ok(
      state.actions.some((a: any) =>
        a.playerId === "system" && a.playerName === "System"
      ),
    );
    assert.ok(
      f.calls.names.every((name) => name !== "Computer" && name !== "System"),
    );
    assert.equal(f.calls.identities, 0);
  }
  serverNames(id);
  await intent(id, "SPECIES_SUBMIT", { species: "human", botSpecies: "human" });
  // Use only legal route requests; the human submits empty builds while the
  // production bot builds and advances. Surrender supplies a real terminal event.
  for (let step = 0; step < 60 && f.state(id).gameData.turnNumber < 3; step++) {
    const s = f.state(id),
      phase = `${s.gameData.currentPhase}.${s.gameData.currentSubPhase}`;
    if (s.missionChallengeAssignment?.introPending) {
      await intent(id, "MISSION_INTRO_ACK");
    } else if (s.gameData.turnData.phaseHold?.phaseKey === phase) {
      const originalNow = Date.now;
      Date.now = () =>
        Math.max(originalNow(), s.gameData.turnData.phaseHold.holdUntilMs);
      try {
        await intent(id, "CONTINUE_PHASE_HOLD");
      } finally {
        Date.now = originalNow;
      }
    } else if (phase === "build.drawing") {
      await intent(id, "BUILD_SUBMIT", { builds: [] });
    } else await intent(id, "DECLARE_READY");
  }
  assert.ok(f.state(id).gameData.turnNumber >= 3);
  const botId = f.state(id).players[1].id;
  assert.ok(f.state(id).gameData.ships[botId].length > 0);
  await intent(id, "ACTION", { actionType: "message", content: "hello bot" });
  const finished = await intent(id, "SURRENDER");
  assert.equal(finished.state.status, "finished");
  assert.equal(f.state(id).resultReason, "resignation");
  serverNames(id);
  const rematch = await f.request(`/new-game-from/${id}`, {
    winStreakCount: 3,
  });
  assert.equal(rematch.status, 200);
  const rematchId = (await rematch.json()).gameId;
  serverNames(rematchId);
  const reset = await f.request(`/reset-win-streak/${rematchId}`);
  assert.equal(reset.status, 200);
  const replacementId = (await reset.json()).gameId;
  serverNames(replacementId);
  assert.equal(f.state(replacementId).gameData.winStreakBonus.appliedCount, 0);
  await intent(replacementId, "SPECIES_SUBMIT", {
    species: "human",
    botSpecies: "human",
  });
  serverNames(replacementId);
  f.session("p2");
  for (const playerName of ["Computer", "System"]) {
    const denied = await f.request("/create-game", {
      playerName,
      timed: false,
    });
    assert.equal(denied.status, 403);
  }
});
