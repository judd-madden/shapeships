import assert from "node:assert/strict";
import { enabledGameFixture } from "../accounts/gameIdentityFixture.ts";
import { prefix } from "./game_identity_fixture.ts";

async function fixture(account = true, timed = false) {
  const f = enabledGameFixture();
  const a = account ? await f.claim() : undefined;
  if (a) {
    const run = await f.streaks.reconcile({
      tokenHash: a.hash,
      sessionId: "p1",
    });
    run.currentCount = 4;
    f.streaks.runs.set(a.entry.account.id, run);
  }
  const headers = a?.headers ?? {};
  const r = await f.request("/create-computer-game", {
    playerName: "Pilot1",
    timed,
    minutes: 5,
    incrementSeconds: 3,
    ...(a ? { expectedStreakRevision: "1" } : { winStreakCount: 4 }),
  }, headers);
  assert.equal(r.status, 200);
  const id = (await r.json()).gameId;
  f.streakCalls.length = 0;
  const intent = (intentType: string, payload?: unknown) =>
    f.request("/intent", {
      gameId: id,
      intentType,
      turnNumber: f.state(id).gameData.turnNumber,
      nonce: crypto.randomUUID(),
      payload,
    }, headers);
  return { ...f, a, id, headers, intent };
}
function expire(f: Awaited<ReturnType<typeof fixture>>) {
  const state = f.state(f.id);
  Object.assign(state, {
    turnNumber: 1,
    currentPhase: "build",
    currentSubPhase: "dice_roll",
  });
  Object.assign(state.gameData, {
    turnNumber: 1,
    currentPhase: "build",
    currentSubPhase: "dice_roll",
    phaseReadiness: [],
  });
  Object.assign(state.gameData.turnData, {
    turnNumber: 1,
    currentMajorPhase: "build",
    currentSubPhase: "dice_roll",
  });
  state.players[0].faction = "human";
  state.players[1].faction = "xenite";
  state.gameData.clock.remainingMsByPlayerId = {
    p1: 1,
    [`bot_${f.id}`]: 100_000,
  };
  state.gameData.clock.lastUpdateAtMs = Date.now() - 1_000;
  f.persistence.store.set(`game_${f.id}`, state);
}

Deno.test("account settlement: terminal surrender commits then reconciles once; ordinary turns and reads do not", async () => {
  const f = await fixture();
  const turn = await f.intent("SPECIES_SUBMIT", {
    species: "human",
    botSpecies: "human",
  });
  assert.equal(turn.status, 200);
  assert.deepEqual(f.streakCalls, []);
  for (
    const path of [
      "game-state",
      "game-state-head",
      "game-history",
      "chat-state",
    ]
  ) {
    assert.equal(
      (await f.app.request(`${prefix}/${path}/${f.id}`, {
        headers: { "X-Session-Token": "p1" },
      })).status,
      200,
    );
  }
  assert.deepEqual(f.streakCalls, []);
  f.persistence.conflicts = 1;
  const terminal = await f.intent("SURRENDER");
  assert.equal(terminal.status, 200);
  const body = await terminal.json();
  assert.equal(body.ok, true);
  assert.equal(body.state.status, "finished");
  assert.equal(f.state(f.id).resultReason, "resignation");
  assert.deepEqual(f.streakCalls, ["reconcile"]);
  assert.equal(f.streaks.runs.get(f.a!.entry.account.id)!.currentCount, 0);
});

Deno.test("account settlement: failed repository or logger never changes committed intent success", async () => {
  for (const failure of ["repository", "link", "logger"]) {
    const f = await fixture();
    f.streakRepository.reconcile = async (input) => {
      f.streakCalls.push("reconcile");
      assert.equal(f.state(f.id).status, "finished"); // Settlement follows the CAS.
      if (failure !== "link") throw new Error("PRIVATE-DB-DETAIL");
      f.repository.links.get("p1")!.detached = f.repository.now;
      return await f.streaks.reconcile(input);
    };
    if (failure === "logger") {
      f.streakLogs.push = () => {
        throw new Error("PRIVATE-LOGGER");
      };
    }
    const r = await f.intent("SURRENDER");
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.ok, true);
    assert.equal(body.state.status, "finished");
    assert.deepEqual(f.streakCalls, ["reconcile"]);
    assert.equal(f.streakLogs.length, failure === "logger" ? 0 : 1);
    assert.ok(!JSON.stringify(f.streakLogs).includes("PRIVATE"));
    assert.equal(f.streaks.runs.get(f.a!.entry.account.id)!.currentCount, 4);
    if (failure === "repository") {
      await f.streaks.reconcile({ tokenHash: f.a!.hash, sessionId: "p1" });
      assert.equal(f.streaks.runs.get(f.a!.entry.account.id)!.currentCount, 0);
    }
  }
});

Deno.test("account settlement: request-committed intent timeout settles; polling timeout needs later repair", async () => {
  for (const read of [false, true]) {
    const f = await fixture(true, true);
    expire(f);
    const r = read
      ? await f.app.request(`${prefix}/game-state-head/${f.id}`, {
        headers: { "X-Session-Token": "p1" },
      })
      : await f.intent("ACTION", { actionType: "message", content: "timeout" });
    assert.equal(r.status, 200);
    assert.equal(f.state(f.id).status, "finished");
    assert.equal(f.state(f.id).resultReason, "timeout");
    assert.deepEqual(f.streakCalls, read ? [] : ["reconcile"]);
    assert.equal(
      f.streaks.runs.get(f.a!.entry.account.id)!.currentCount,
      read ? 4 : 0,
    );
  }
});

Deno.test("account settlement: restart maintenance timeout keeps its 409 response and settles once", async () => {
  for (const fails of [false, true]) {
    const f = await fixture(true, true);
    expire(f);
    if (fails) {
      f.streakRepository.reconcile = () => {
        f.streakCalls.push("reconcile");
        return Promise.reject(new Error("PRIVATE"));
      };
    }
    const r = await f.request(`/reset-win-streak/${f.id}`, {
      expectedStreakRevision: "2",
    }, f.headers);
    assert.equal(r.status, 409);
    assert.deepEqual(await r.json(), {
      error: "Win-streak restart is not available",
    });
    assert.equal(f.state(f.id).resultReason, "timeout");
    assert.deepEqual(f.streakCalls, ["reconcile"]);
    assert.equal(f.streaks.rows.has("game_G2"), false);
  }
});

Deno.test("guest streak regression: enabled guest create, intents, reads, rematch and restart make zero streak calls", async () => {
  const f = await fixture(false);
  assert.equal(
    (await f.intent("SPECIES_SUBMIT", {
      species: "human",
      botSpecies: "human",
    })).status,
    200,
  );
  assert.equal((await f.intent("SURRENDER")).status, 200);
  for (
    const path of [
      "game-state",
      "game-state-head",
      "game-history",
      "chat-state",
    ]
  ) {
    assert.equal(
      (await f.app.request(`${prefix}/${path}/${f.id}`, {
        headers: { "X-Session-Token": "p1" },
      })).status,
      200,
    );
  }
  const rematch = await f.request(`/new-game-from/${f.id}`, {
    winStreakCount: 4,
  });
  assert.equal(rematch.status, 200);
  const next = (await rematch.json()).gameId;
  const restart = await f.request(`/reset-win-streak/${next}`);
  assert.equal(restart.status, 200);
  const replay = await f.request(`/reset-win-streak/${next}`);
  assert.equal(replay.status, 200);
  assert.deepEqual(f.streakCalls, []);
  assert.equal(f.streakLoads, 0);
});

Deno.test("streak dormancy: off and names-only account provenance never acquires the repository", async () => {
  for (const mode of ["off", "names-only"] as const) {
    const f = enabledGameFixture(mode), a = await f.claim();
    const r = await f.request("/create-computer-game", {
      playerName: "Guest1",
      timed: false,
      winStreakCount: 4,
    }, a.headers);
    assert.equal(r.status, 200);
    const id = (await r.json()).gameId;
    // Existing provenance remains session-authorised outside on-mode.
    f.state(id).players[0].accountId = a.entry.account.id;
    const restart = await f.request(`/reset-win-streak/${id}`, {}, a.headers);
    assert.equal(restart.status, 200);
    assert.equal(f.streakLoads, 0);
    assert.deepEqual(f.streakCalls, []);
  }
});
