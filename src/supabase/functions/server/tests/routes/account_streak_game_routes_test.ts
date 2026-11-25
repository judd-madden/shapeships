import assert from "node:assert/strict";
import { enabledGameFixture } from "../accounts/gameIdentityFixture.ts";
import { prepareFreshAccountComputerGame } from "../../accounts/streakPreparation.ts";
import { AccountFault } from "../../accounts/accountRepository.ts";
import { StreakFault } from "../../accounts/streakRepository.ts";
import { projectGameStateHead } from "../../routes/game_state_head.ts";

async function fixture(count = 6) {
  const f = enabledGameFixture(), a = await f.claim();
  const auth = { tokenHash: a.hash, sessionId: "p1" };
  const run = await f.streaks.reconcile(auth);
  run.currentCount = count;
  f.streaks.runs.set(a.entry.account.id, run);
  const revision = () => f.streaks.runs.get(a.entry.account.id)!.revision;
  const create = (extra = {}) =>
    f.request("/create-computer-game", {
      playerName: "Pilot1",
      timed: false,
      expectedStreakRevision: revision(),
      ...extra,
    }, a.headers);
  const restart = (id: string, extra = {}) =>
    f.request(`/reset-win-streak/${id}`, {
      expectedStreakRevision: revision(),
      ...extra,
    }, a.headers);
  return { ...f, a, auth, revision, createAccount: create, restart };
}
async function created(f: Awaited<ReturnType<typeof fixture>>) {
  const r = await f.createAccount();
  assert.equal(r.status, 200);
  return (await r.json()).gameId as string;
}
function finish(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  const state = f.state(id);
  state.status = "finished";
  state.resultReason = "decisive";
  state.winnerPlayerId = "p1";
  state.stateRevision++;
  f.persistence.store.set(`game_${id}`, state);
}

Deno.test("account computer create: authoritative bonus, ignored malformed counts and exact envelope", async () => {
  for (const winStreakCount of [undefined, "invalid", -1, {}, null]) {
    const f = await fixture();
    const r = await f.createAccount({ winStreakCount });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.deepEqual(body, {
      gameId: "G1",
      message: "Computer game created successfully",
      chosenBotPlanId: null,
    });
    const state = f.state(body.gameId);
    assert.equal(state.players[0].accountId, f.a.entry.account.id);
    assert.equal(state.gameData.winStreakBonus.appliedCount, 6);
    assert.deepEqual(f.streakCalls, ["reconcile", "commitGame"]);
    assert.equal(
      f.streaks.rows.get("game_history_G1")!.value.completedTurnCount,
      0,
    );
    const head = projectGameStateHead(state);
    assert.ok(head.ok);
    assert.deepEqual(f.streaks.rows.get("game_G1")!.game_head, head.head);
    assert.deepEqual(f.persistence.writes, []); // All three rows are owned by the RPC transaction.
  }
});

Deno.test("account computer create/rematch: Q6 reachable resets; other original session preserves count", async () => {
  for (const action of ["create", "rematch"]) {
    for (const reachable of [true, false]) {
      const f = await fixture(), first = await created(f);
      // Rematching an old finished source must use the currently selected game's reachability.
      let source = first;
      if (action === "rematch") {
        finish(f, first);
        await f.streaks.reconcile(f.auth);
        const next = await f.createAccount();
        source = first;
        assert.equal(next.status, 200);
      }
      if (!reachable) {
        await f.repository.resume(f.a.hash, "p2");
        f.session("p2");
        if (action === "rematch") {
          // The source must belong to the requesting original human session.
          const prepared = prepareFreshAccountComputerGame({
            gameId: "OLDER",
            sessionId: "p2",
            displayName: "Pilot1",
            accountId: f.a.entry.account.id,
            currentCount: 6,
            timeControl: null,
          });
          const old = prepared.game.value;
          old.status = "finished";
          old.resultReason = "decisive";
          old.winnerPlayerId = "p2";
          f.persistence.store.set("game_OLDER", old);
          source = "OLDER";
        }
      }
      const expectedCount = reachable
        ? 0
        : f.streaks.runs.get(f.a.entry.account.id)!.currentCount;
      const r = action === "create"
        ? await f.createAccount()
        : await f.request(`/new-game-from/${source}`, {
          expectedStreakRevision: f.revision(),
          winStreakCount: "bad",
        }, f.a.headers);
      assert.equal(r.status, 200, `${action}/${reachable}`);
      const id = (await r.json()).gameId;
      assert.equal(
        f.state(id).gameData.winStreakBonus.appliedCount,
        expectedCount,
      );
    }
  }
});

Deno.test("account computer routes: missing/malformed revision fails before any streak call", async () => {
  for (const action of ["create", "rematch", "restart"]) {
    for (const revision of [undefined, 1, "0", "01", "9223372036854775808"]) {
      const f = await fixture(),
        id = action === "create" ? undefined : await created(f);
      if (action === "rematch") {
        finish(f, id!);
      }
      f.streakCalls.length = 0;
      const path = action === "create"
        ? "/create-computer-game"
        : `/${
          action === "rematch" ? "new-game-from" : "reset-win-streak"
        }/${id}`;
      const r = await f.request(path, {
        playerName: "Pilot1",
        timed: false,
        expectedStreakRevision: revision,
      }, f.a.headers);
      assert.equal(r.status, 400, action + String(revision));
      assert.equal((await r.json()).error, "INVALID_REQUEST");
      assert.deepEqual(f.streakCalls, []);
    }
  }
});

Deno.test("account computer rematch: reconciles win, inherits timing and preserves source", async () => {
  const f = await fixture();
  const response = await f.createAccount({
    timed: true,
    minutes: 5,
    incrementSeconds: 3,
  });
  const id = (await response.json()).gameId;
  finish(f, id);
  await f.streaks.reconcile(f.auth);
  const before = structuredClone(f.state(id));
  const r = await f.request(`/new-game-from/${id}`, {
    expectedStreakRevision: f.revision(),
    winStreakCount: [],
  }, f.a.headers);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { gameId: "G2" });
  assert.equal(f.state("G2").gameData.winStreakBonus.appliedCount, 7);
  assert.deepEqual(
    f.state("G2").gameData.clock.timeControl,
    before.gameData.clock.timeControl,
  );
  assert.deepEqual(f.state(id), before);
  const stale = await f.createAccount({ expectedStreakRevision: "1" });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, "STREAK_CONFLICT");
  assert.deepEqual(
    [...f.streaks.rows.keys()].filter((key) => key.startsWith("game_history_")),
    ["game_history_G1", "game_history_G2"],
  );
});

Deno.test("account fresh allocation: ID collisions retry five times with no partial metadata", async () => {
  for (const action of ["create", "rematch", "restart"]) {
    for (const exhausted of [false, true]) {
      const f = await fixture();
      let id: string | undefined;
      if (action !== "create") {
        id = await created(f);
      }
      if (action === "rematch") {
        finish(f, id!);
        await f.streaks.reconcile(f.auth);
      }
      const start = action === "create" ? 1 : 2;
      const count = exhausted ? 5 : 1;
      for (let n = start; n < start + count; n++) {
        f.persistence.store.set(`game_G${n}`, { gameId: `collision-${n}` });
      }
      const beforeRun = structuredClone(
        f.streaks.runs.get(f.a.entry.account.id),
      );
      const beforeSource = id ? structuredClone(f.state(id)) : undefined;
      f.streakCalls.length = 0;
      const r = action === "create"
        ? await f.createAccount()
        : action === "restart"
        ? await f.restart(id!)
        : await f.request(`/new-game-from/${id}`, {
          expectedStreakRevision: f.revision(),
        }, f.a.headers);
      assert.equal(
        r.status,
        exhausted ? action === "restart" ? 503 : 500 : 200,
        action,
      );
      assert.equal(
        f.streakCalls.filter((c) => c === "commitGame").length,
        exhausted ? 5 : 2,
      );
      if (exhausted) {
        assert.deepEqual(f.streaks.runs.get(f.a.entry.account.id), beforeRun);
        if (id) {
          assert.deepEqual(f.state(id), beforeSource);
        }
        assert.equal(f.streaks.rows.has(`game_history_G${start}`), false);
      } else {
        const body = await r.json();
        assert.equal(body.gameId, `G${start + 1}`);
        assert.equal(f.state(body.gameId).players[1].id, `bot_${body.gameId}`);
      }
    }
  }
});

Deno.test("account restart: atomic neutral source/replacement, completed RPC replay preserves a newer run", async () => {
  const f = await fixture(), id = await created(f);
  const source = structuredClone(f.state(id)), r = await f.restart(id);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    gameId: "G2",
    sourceGameId: id,
    resetStatus: "completed",
  });
  const updated = f.state(id), replacement = f.state("G2");
  assert.equal(updated.stateRevision, source.stateRevision + 1);
  assert.equal(updated.status, "finished");
  assert.equal(updated.resultReason, "restart");
  assert.equal(updated.winnerPlayerId, undefined);
  assert.equal(updated.result, undefined);
  assert.deepEqual(updated.winStreakRestart, {
    kind: "source",
    status: "completed",
    replacementGameId: "G2",
  });
  assert.deepEqual(replacement.winStreakRestart, {
    kind: "replacement",
    sourceGameId: id,
  });
  assert.equal(replacement.gameData.winStreakBonus.appliedCount, 0);
  assert.equal((await f.createAccount()).status, 200);
  const newer = structuredClone(f.streaks.runs.get(f.a.entry.account.id));
  f.streakCalls.length = 0;
  const replay = await f.restart(id, { expectedStreakRevision: "1" });
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), {
    gameId: "G2",
    sourceGameId: id,
    resetStatus: "completed",
  });
  assert.deepEqual(f.streaks.runs.get(f.a.entry.account.id), newer);
  assert.deepEqual(f.streakCalls, ["reconcile", "commitGame"]);
});

Deno.test("account restart: pending recovery uses recorded ID with absent or reciprocal present replacement", async () => {
  for (const present of [false, true]) {
    const f = await fixture(), id = await created(f);
    const source = f.state(id);
    source.status = "finished";
    source.resultReason = "restart";
    source.stateRevision++;
    source.winStreakRestart = {
      kind: "source",
      status: "pending",
      replacementGameId: "SAVED1",
    };
    f.persistence.store.set(`game_${id}`, source);
    f.streaks.runs.get(f.a.entry.account.id)!.trackedGame!.status =
      "restart_pending";
    if (present) {
      const prepared = prepareFreshAccountComputerGame({
        gameId: "SAVED1",
        sessionId: "p1",
        displayName: "Pilot1",
        accountId: f.a.entry.account.id,
        currentCount: 0,
        timeControl: null,
        restartSourceGameId: id,
      });
      f.streaks.rows.set(prepared.game.key, prepared.game);
    }
    f.streakCalls.length = 0;
    const r = await f.restart(id);
    assert.equal(r.status, 200, String(present));
    assert.deepEqual(await r.json(), {
      gameId: "SAVED1",
      sourceGameId: id,
      resetStatus: "completed",
    });
    assert.equal(f.state(id).winStreakRestart.status, "completed");
    assert.equal(f.state("SAVED1").gameData.winStreakBonus.appliedCount, 0);
    assert.equal(f.streaks.rows.has("game_history_SAVED1"), true);
    assert.equal(f.streaks.rows.has("game_G2"), false);
    assert.deepEqual(f.streakCalls, ["reconcile", "commitGame"]);
  }
});

Deno.test("account restart: pending collision conflicts without retry; replacement-kind is the existing 409", async () => {
  for (const kind of ["pending", "replacement"]) {
    const f = await fixture(), id = await created(f), source = f.state(id);
    source.winStreakRestart = kind === "pending"
      ? { kind: "source", status: "pending", replacementGameId: "TAKEN1" }
      : { kind: "replacement", sourceGameId: "OLDER1" };
    if (kind === "pending") {
      source.status = "finished";
      source.resultReason = "restart";
      f.streaks.runs.get(f.a.entry.account.id)!.trackedGame!.status =
        "restart_pending";
      f.persistence.store.set("game_TAKEN1", { unrelated: true });
    }
    const before = structuredClone(source);
    f.streakCalls.length = 0;
    const r = await f.restart(id);
    assert.equal(r.status, 409);
    assert.equal(
      (await r.json()).error,
      kind === "pending"
        ? "STREAK_CONFLICT"
        : "Replacement games cannot be restarted as sources",
    );
    assert.deepEqual(f.state(id), before);
    assert.equal(
      f.streakCalls.filter((c) => c === "commitGame").length,
      kind === "pending" ? 1 : 0,
    );
    assert.equal(f.streaks.rows.has("game_G2"), false);
  }
});

Deno.test("account restart: fresh eligibility is retained and failed commits leave no partial game", async () => {
  const ineligible = await fixture(), source = await created(ineligible);
  ineligible.state(source).gameData.turnNumber = 2;
  assert.equal((await ineligible.restart(source)).status, 409);
  assert.equal(ineligible.streaks.rows.has("game_G2"), false);
  for (const action of ["create", "rematch", "restart"]) {
    for (const failAt of ["game", "history", "run", "commit"] as const) {
      const f = await fixture();
      const id = action === "create" ? undefined : await created(f);
      if (action === "rematch") {
        finish(f, id!);
        await f.streaks.reconcile(f.auth);
      }
      const rows = structuredClone([...f.streaks.rows]),
        run = structuredClone([...f.streaks.runs]);
      // Reconcile precedes commit, so inject only within commitGame's transaction.
      const original = f.streakRepository.commitGame;
      f.streakRepository.commitGame = async (input) => {
        f.streaks.failAt = failAt;
        try {
          return await original(input);
        } finally {
          f.streaks.failAt = undefined;
        }
      };
      const r = action === "create"
        ? await f.createAccount()
        : action === "restart"
        ? await f.restart(id!)
        : await f.request(`/new-game-from/${id}`, {
          expectedStreakRevision: f.revision(),
        }, f.a.headers);
      assert.equal(r.status, 503, action + failAt);
      assert.equal(r.headers.get("Retry-After"), "5");
      assert.deepEqual([...f.streaks.rows], rows);
      assert.deepEqual([...f.streaks.runs], run);
    }
  }
});

Deno.test("account computer errors: fixed mappings, no conflict retry or raw database detail", async () => {
  for (
    const [code, status] of [
      ["STREAK_CONFLICT", 409],
      ["STREAK_IMPORT_UNVERIFIED", 422],
      ["STREAK_IMPORT_CONSUMED", 409],
      ["STREAK_SEAT_FORBIDDEN", 403],
      ["STREAK_GAME_NOT_FOUND", 404],
    ] as const
  ) {
    const f = await fixture();
    f.streakRepository.commitGame = () => {
      f.streakCalls.push("commitGame");
      throw new StreakFault(code);
    };
    const r = await f.createAccount();
    assert.equal(r.status, status);
    assert.equal((await r.json()).error, code);
    assert.equal(f.streakCalls.filter((c) => c === "commitGame").length, 1);
  }
  const f = await fixture();
  f.streakRepository.commitGame = () =>
    Promise.reject(new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE"));
  assert.equal((await f.createAccount()).status, 503);
});
