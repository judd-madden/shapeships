import assert from "node:assert/strict";
import { FakeStreakRepository } from "./fakeStreakRepository.ts";
import { nameKeys } from "../../accounts/nameKeys.ts";
import {
  prepareFreshAccountComputerGame,
  prepareParticipantAdoption,
  prepareStreakGameRow,
} from "../../accounts/streakPreparation.ts";
import { createFreshComputerGameData } from "../../routes/computer_game_factory.ts";
import type {
  StreakAuth,
  StreakCommitInput,
  StreakImportInput,
  StreakSource,
} from "../../accounts/streakRepository.ts";

type Seat = StreakAuth & { accountId: string };
const prefs = {
  soundEnabled: true,
  healthFlashEnabled: true,
  chatMinimized: false,
  battleLogPreferred: false,
  musicEnabled: true,
};
async function fixture() {
  const f = new FakeStreakRepository();
  let next = 0;
  async function claim(sessionId = "s1"): Promise<Seat> {
    const n = ++next, tokenHash = new Uint8Array(32).fill(n);
    const entry = await f.authority.claim({
      ...nameKeys(`Pilot${n}`),
      passwordHash: "synthetic",
      passwordFormat: "nfc-argon2id-v1",
      tokenHash,
      sessionId,
      preferences: prefs,
    });
    return { tokenHash, sessionId, accountId: entry.account.id };
  }
  const a = await claim();
  return { f, a, claim };
}
async function seed(f: FakeStreakRepository, a: Seat, count = 0) {
  const s = await f.reconcile(a);
  s.currentCount = count;
  f.runs.set(a.accountId, s);
  return s;
}
function request(
  f: FakeStreakRepository,
  a: Seat,
  id: string,
  count: number,
): StreakCommitInput {
  return {
    ...a,
    expectedRevision: f.runs.get(a.accountId)!.revision,
    action: "create",
    source: null,
    ...prepareFreshAccountComputerGame({
      gameId: id,
      sessionId: a.sessionId,
      displayName: "Pilot1",
      accountId: a.accountId,
      currentCount: count,
    }),
  };
}
async function create(
  f: FakeStreakRepository,
  a: Seat,
  id: string,
  count: number,
) {
  const result = await f.commitGame(request(f, a, id, count));
  assert.equal(result.status, "committed");
  return result;
}
function finish(
  f: FakeStreakRepository,
  id: string,
  outcome: "win" | "loss" | "draw" | "restart",
  reason?: string,
) {
  const state = structuredClone(f.rows.get(`game_${id}`)!.value);
  state.status = "finished";
  state.stateRevision++;
  state.resultReason = reason ??
    (outcome === "draw"
      ? "agreement"
      : outcome === "restart"
      ? "restart"
      : "decisive");
  if (outcome === "win") state.winnerPlayerId = state.players[0].id;
  else if (outcome === "loss") state.winnerPlayerId = state.players[1].id;
  else delete state.winnerPlayerId;
  f.rows.set(`game_${id}`, prepareStreakGameRow(state));
}
function guest(
  f: FakeStreakRepository,
  id: string,
  human = "guest",
  bonus = 25,
) {
  const state = createFreshComputerGameData(id, human, "Guest", null, bonus);
  f.rows.set(`game_${id}`, prepareStreakGameRow(state));
  return state;
}
function offer(
  f: FakeStreakRepository,
  a: Seat,
  id: string,
  count = 50,
  pending = false,
): StreakImportInput {
  const game = f.rows.get(`game_${id}`)!.value;
  return {
    ...a,
    expectedRevision: f.runs.get(a.accountId)!.revision,
    decision: "compare",
    guest: {
      anchorGameId: id,
      humanPlayerId: game.players[0].id,
      currentCount: count,
      resultPending: pending,
    },
    adoption: null,
  };
}
const stateOf = (f: FakeStreakRepository) =>
  structuredClone({
    runs: [...f.runs],
    rows: [...f.rows],
    imports: [...f.imports],
  });

Deno.test("streak results: duplicates, reordered games and concurrent reconciliation apply once", async () => {
  const { f, a } = await fixture();
  await seed(f, a, 4);
  await create(f, a, "FIRST1", 4);
  finish(f, "FIRST1", "win");
  const results = await Promise.all([
    f.reconcile(a),
    f.reconcile(a),
    f.reconcile(a),
  ]);
  assert.ok(results.every((s) => s.currentCount === 5));
  assert.equal(new Set(results.map((s) => s.revision)).size, 1);
  await create(f, a, "SECOND", 5);
  finish(f, "FIRST1", "loss");
  assert.equal((await f.reconcile(a)).currentCount, 5);
  finish(f, "SECOND", "draw");
  assert.equal((await f.reconcile(a)).currentCount, 5);
  assert.equal((await f.reconcile(a)).trackedGame!.status, "settled");
});
Deno.test("streak loss records ended count; menu reset retires without changing canonical game", async () => {
  for (const reason of ["decisive", "resignation", "timeout"]) {
    const { f, a } = await fixture();
    await seed(f, a, 8);
    await create(f, a, "LOSS01", 8);
    finish(f, "LOSS01", "loss", reason);
    const lost = await f.reconcile(a);
    assert.equal(lost.currentCount, 0);
    assert.deepEqual(lost.endedStreak, { count: 8, endingGameId: "LOSS01" });
    assert.deepEqual(await f.reconcile(a), lost);
  }
  const { f, a } = await fixture();
  await seed(f, a, 6);
  await create(f, a, "RESET1", 6);
  const before = structuredClone(f.rows.get("game_RESET1"));
  const old = await f.reconcile(a);
  const reset = await f.reset({ ...a, expectedRevision: old.revision });
  assert.equal(reset.currentCount, 0);
  assert.equal(reset.endedStreak, null);
  assert.notEqual(reset.runId, old.runId);
  assert.deepEqual(f.rows.get("game_RESET1"), before);
  finish(f, "RESET1", "win");
  assert.equal((await f.reconcile(a)).currentCount, 0);
});
Deno.test("streak Q6: reachable unfinished resets; another linked session retires and keeps count", async () => {
  for (const reachable of [true, false]) {
    const { f, a } = await fixture();
    await seed(f, a, 7);
    await create(f, a, "OLD001", 7);
    const actor = { ...a, sessionId: reachable ? a.sessionId : "s2" };
    if (!reachable) {
      const token = [...f.authority.tokens.values()][0];
      f.authority.links.set("s2", {
        sessionId: "s2",
        accountId: a.accountId,
        tokenId: token.id,
        detached: null,
      });
    }
    await create(f, actor, "NEW001", reachable ? 0 : 7);
    const snapshot = await f.reconcile(a);
    assert.equal(snapshot.currentCount, reachable ? 0 : 7);
    assert.equal(snapshot.trackedGame!.gameId, "NEW001");
    finish(f, "OLD001", "win");
    assert.equal((await f.reconcile(a)).currentCount, reachable ? 0 : 7);
    assert.equal(f.rows.get("game_OLD001")!.value.status, "finished");
  }
});
Deno.test("streak R1: wrong bonus, account, human and prepared row metadata conflict atomically", async () => {
  const mutations = [(r: StreakCommitInput) => {
    r.game.value.gameData.winStreakBonus.appliedCount = 99;
  }, (r: StreakCommitInput) => {
    r.game.value.players[0].accountId = "other-account";
  }, (r: StreakCommitInput) => {
    r.game.value.players[0].id = "other-human";
  }, (r: StreakCommitInput) => {
    r.game.key = "game_WRONG1";
  }, (r: StreakCommitInput) => {
    r.game.game_head.stateRevision = 2;
  }, (r: StreakCommitInput) => {
    r.history.value.gameId = "WRONG1";
  }];
  for (const mutate of mutations) {
    const { f, a } = await fixture();
    await seed(f, a, 3);
    const r = request(f, a, "NEW001", 3);
    mutate(r);
    const before = stateOf(f);
    await assert.rejects(() => f.commitGame(r), { code: "STREAK_CONFLICT" });
    assert.deepEqual(stateOf(f), before);
  }
});
Deno.test("streak R2: occupied and insert-time game IDs return gameIdTaken without run changes", async () => {
  for (const insertTime of [false, true]) {
    const { f, a } = await fixture();
    await seed(f, a, 9);
    await create(f, a, "OLD001", 9);
    if (!insertTime) finish(f, "OLD001", "win");
    // Pre-existing collision rolls back reconciliation; insert-time collision rolls back the Q6 reset.
    const r = request(f, a, "TAKEN1", insertTime ? 0 : 10),
      before = structuredClone(f.runs.get(a.accountId));
    const occupied = prepareStreakGameRow(
      createFreshComputerGameData("TAKEN1", "stranger", "Other", null, 0),
    );
    if (insertTime) {
      f.beforeGameInsert = async (key) => {
        f.rows.set(key, occupied);
      };
    } else f.rows.set(occupied.key, occupied);
    assert.deepEqual(await f.commitGame(r), { status: "gameIdTaken" });
    assert.deepEqual(f.runs.get(a.accountId), before);
    assert.equal(f.rows.has("game_history_TAKEN1"), false);
    assert.deepEqual(f.rows.get(occupied.key), occupied);
  }
});
Deno.test("streak atomic creation rolls back every staged write on injected failure", async () => {
  for (const point of ["game", "history", "run", "commit"] as const) {
    const { f, a } = await fixture();
    await seed(f, a, 9);
    await create(f, a, "OLD001", 9);
    const r = request(f, a, "NEXT01", 0), before = stateOf(f);
    f.failAt = point;
    await assert.rejects(() => f.commitGame(r), {
      code: "ACCOUNT_SERVICE_UNAVAILABLE",
    });
    assert.deepEqual(stateOf(f), before);
  }
});
Deno.test("streak pending result conflicts roll back until explicit reconcile; replay returns current snapshot", async () => {
  const { f, a } = await fixture();
  await seed(f, a, 6);
  const r = request(f, a, "GAME01", 6);
  await f.commitGame(r);
  finish(f, "GAME01", "win");
  const before = stateOf(f);
  await assert.rejects(
    () =>
      f.reset({ ...a, expectedRevision: f.runs.get(a.accountId)!.revision }),
    { code: "STREAK_CONFLICT" },
  );
  assert.deepEqual(stateOf(f), before);
  const current = await f.reconcile(a);
  assert.equal(current.currentCount, 7);
  const replay = await f.commitGame(r);
  assert.equal(replay.status, "committed");
  if (replay.status === "committed") assert.deepEqual(replay.streak, current);
});
Deno.test("streak imports bound pending/settled wins, draws and losses without a policy ceiling", async () => {
  const cases: [
    "win" | "loss" | "draw" | null,
    number,
    boolean,
    number,
    number,
  ][] = [
    ["win", 0, true, 0, 1],
    ["win", 25, true, 25, 26],
    ["win", 25, false, 26, 26],
    ["win", 25, false, 10, 10],
    ["draw", 25, true, 99, 25],
    ["loss", 25, true, 99, 0],
    [null, 125, false, 500, 125],
    [
      "win",
      Number.MAX_SAFE_INTEGER,
      true,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ],
  ];
  for (const [outcome, bonus, pending, count, accepted] of cases) {
    const { f, a } = await fixture();
    await seed(f, a);
    guest(f, "GUEST1", "guest", bonus);
    if (outcome) finish(f, "GUEST1", outcome);
    const result = await f.importGuest(offer(f, a, "GUEST1", count, pending));
    assert.equal(result.import.acceptedCount, accepted);
    assert.equal(result.streak.currentCount, accepted);
    assert.equal(result.import.continuation, "none");
  }
});
Deno.test("streak import tie/account win/decline consume anchor without merging or adoption", async () => {
  for (
    const [accountCount, decision] of [[25, "compare"], [30, "compare"], [
      1,
      "decline",
    ]] as const
  ) {
    const { f, a } = await fixture();
    await seed(f, a, accountCount);
    guest(f, "GUEST1", a.sessionId, 25);
    const r = offer(f, a, "GUEST1", 25);
    r.decision = decision;
    const result = await f.importGuest(r);
    assert.equal(result.streak.currentCount, accountCount);
    assert.equal(
      result.import.selection,
      decision === "decline" ? "declined" : "account",
    );
    assert.equal(f.imports.size, 1);
    assert.equal(
      f.rows.get("game_GUEST1")!.value.players[0].accountId,
      undefined,
    );
  }
});
Deno.test("streak tombstones replay current state after reset and survive anonymization", async () => {
  const { f, a, claim } = await fixture();
  await seed(f, a);
  guest(f, "GUEST1");
  const offered = offer(f, a, "GUEST1");
  const imported = await f.importGuest(offered);
  const reset = await f.reset({
    ...a,
    expectedRevision: imported.streak.revision,
  });
  const replay = await f.importGuest(offered);
  assert.deepEqual(replay.streak, reset);
  const b = await claim("s2");
  await seed(f, b);
  await assert.rejects(() => f.importGuest({ ...offered, ...b }), {
    code: "STREAK_IMPORT_CONSUMED",
  });
  f.runs.delete(a.accountId);
  f.imports.get("GUEST1")!.accountId = null;
  await assert.rejects(() => f.importGuest({ ...offered, ...b }), {
    code: "STREAK_IMPORT_CONSUMED",
  });
  assert.equal(f.imports.size, 1);
});
Deno.test("streak account-owned/enrolled anchors refuse new import, including the same account", async () => {
  for (const owner of ["same", "other", "enrolled"]) {
    const { f, a } = await fixture();
    await seed(f, a, 4);
    guest(f, "GUEST1");
    if (owner === "enrolled") {
      f.runs.get(a.accountId)!.trackedGame = {
        gameId: "GUEST1",
        humanPlayerId: "guest",
        status: "retired",
      };
    } else {f.rows.get("game_GUEST1")!.value.players[0].accountId =
        owner === "same" ? a.accountId : "other";}
    const before = stateOf(f);
    await assert.rejects(() => f.importGuest(offer(f, a, "GUEST1")), {
      code: "STREAK_IMPORT_CONSUMED",
    });
    assert.deepEqual(stateOf(f), before);
  }
});
Deno.test("streak count-only unfinished import leaves game untouched and retires account selection", async () => {
  const { f, a } = await fixture();
  await seed(f, a, 3);
  await create(f, a, "OLD001", 3);
  guest(f, "GUEST1", "lost-session", 25);
  const oldGuest = structuredClone(f.rows.get("game_GUEST1"));
  const result = await f.importGuest(offer(f, a, "GUEST1", 25));
  assert.equal(result.streak.currentCount, 25);
  assert.equal(result.streak.trackedGame, null);
  assert.equal(result.import.continuation, "none");
  assert.deepEqual(f.rows.get("game_GUEST1"), oldGuest);
  finish(f, "OLD001", "win");
  finish(f, "GUEST1", "win");
  assert.equal((await f.reconcile(a)).currentCount, 25);
});
Deno.test("streak direct-proof adoption preserves payload/history and later settles exactly once", async () => {
  const { f, a } = await fixture();
  await seed(f, a);
  const state = guest(f, "GUEST1", a.sessionId, 30);
  const r = offer(f, a, "GUEST1", 20);
  r.adoption = prepareParticipantAdoption(state, a.sessionId, a.accountId);
  const result = await f.importGuest(r);
  assert.equal(result.import.continuation, "authorised");
  assert.equal(result.streak.currentCount, 20);
  assert.equal(
    f.rows.get("game_GUEST1")!.value.gameData.winStreakBonus.appliedCount,
    30,
  );
  assert.equal(
    f.rows.get("game_GUEST1")!.value.players[0].accountId,
    a.accountId,
  );
  assert.equal((await f.importGuest(r)).streak.currentCount, 20);
  finish(f, "GUEST1", "win");
  assert.equal((await f.reconcile(a)).currentCount, 21);
  assert.equal((await f.reconcile(a)).currentCount, 21);
});
Deno.test("streak import rolls back tombstone, adoption and run together on failure", async () => {
  for (const point of ["import", "adoption", "run", "commit"] as const) {
    const { f, a } = await fixture();
    await seed(f, a);
    const state = guest(f, "GUEST1", a.sessionId, 20);
    const r = offer(f, a, "GUEST1", 20);
    r.adoption = prepareParticipantAdoption(state, a.sessionId, a.accountId);
    const before = stateOf(f);
    f.failAt = point;
    await assert.rejects(() => f.importGuest(r), {
      code: "ACCOUNT_SERVICE_UNAVAILABLE",
    });
    assert.deepEqual(stateOf(f), before);
  }
});
Deno.test("streak R3: concurrent same-anchor imports wait then replay or refuse, in both account orders", async () => {
  for (const sameAccount of [true, false]) {
    for (const reverse of [false, true]) {
      const { f, a, claim } = await fixture(),
        b = sameAccount ? a : await claim("s2");
      await seed(f, a);
      if (!sameAccount) {
        await seed(f, b);
      }
      guest(f, "GUEST1");
      const first = reverse ? b : a, second = reverse ? a : b;
      const started = Promise.withResolvers<void>(),
        release = Promise.withResolvers<void>();
      let paused = false;
      f.beforeCommit = async () => {
        if (!paused) {
          paused = true;
          started.resolve();
          await release.promise;
        }
      };
      const one = f.importGuest(offer(f, first, "GUEST1"));
      await started.promise;
      let finished = false;
      const two = f.importGuest(offer(f, second, "GUEST1")).then((v) => {
        finished = true;
        return { value: v };
      }, (error) => {
        finished = true;
        return { error };
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(finished, false);
      release.resolve();
      await one;
      const result = await two;
      if (sameAccount) {
        assert.ok("value" in result);
        assert.equal(result.value.streak.currentCount, 25);
      } else {
        assert.ok("error" in result);
        assert.equal(result.error.code, "STREAK_IMPORT_CONSUMED");
      }
      assert.equal(f.imports.size, 1);
      assert.equal(
        f.lockLog.indexOf("game:GUEST1") >
          f.lockLog.indexOf(`run:${first.accountId}`),
        true,
      );
    }
  }
});
Deno.test("streak R3: insert uniqueness resolves replay/consumption without partial adoption", async () => {
  for (const same of [true, false]) {
    const { f, a } = await fixture();
    await seed(f, a);
    guest(f, "GUEST1");
    const r = offer(f, a, "GUEST1");
    const saved = structuredClone((await f.importGuest(r)).import);
    f.imports.clear();
    await f.reset({
      ...a,
      expectedRevision: f.runs.get(a.accountId)!.revision,
    });
    r.expectedRevision = f.runs.get(a.accountId)!.revision;
    f.beforeAnchorInsert = async () => {
      f.imports.set("GUEST1", {
        ...saved,
        accountId: same ? a.accountId : "other",
        humanPlayerId: "guest",
        sourceSessionId: null,
        reportedCount: 50,
        evidenceKind: "stored_anchor",
        anchorStateRevision: 1,
      });
    };
    if (same) assert.equal((await f.importGuest(r)).streak.currentCount, 0);
    else {await assert.rejects(() => f.importGuest(r), {
        code: "STREAK_IMPORT_CONSUMED",
      });}
    assert.equal(f.runs.get(a.accountId)!.currentCount, 0);
  }
});
Deno.test("streak restart is neutral, source CAS is atomic and completed replay cannot reset newer run", async () => {
  const { f, a } = await fixture();
  await seed(f, a, 8);
  await create(f, a, "SOURCE", 8);
  const original = structuredClone(f.rows.get("game_SOURCE")!.value);
  const updated = structuredClone(original);
  updated.stateRevision++;
  updated.status = "finished";
  updated.resultReason = "restart";
  updated.winStreakRestart = {
    kind: "source",
    status: "completed",
    replacementGameId: "REPLAC",
  };
  const source: StreakSource = {
    gameId: "SOURCE",
    expectedRevision: original.stateRevision,
    update: prepareStreakGameRow(updated),
  };
  const r: StreakCommitInput = {
    ...a,
    expectedRevision: f.runs.get(a.accountId)!.revision,
    action: "restart",
    source,
    ...prepareFreshAccountComputerGame({
      gameId: "REPLAC",
      sessionId: a.sessionId,
      displayName: "Pilot1",
      accountId: a.accountId,
      currentCount: 0,
      restartSourceGameId: "SOURCE",
    }),
  };
  const first = await f.commitGame(r);
  assert.equal(first.status, "committed");
  assert.equal((await f.reconcile(a)).currentCount, 0);
  finish(f, "REPLAC", "win");
  assert.equal((await f.reconcile(a)).currentCount, 1);
  await create(f, a, "LATEST", 1);
  const before = stateOf(f);
  const replay = await f.commitGame(r);
  assert.equal(replay.status, "committed");
  if (replay.status === "committed") assert.equal(replay.gameId, "REPLAC");
  assert.deepEqual(stateOf(f), before);
});
Deno.test("streak authority rechecks links, tokens and expiry after waits", async () => {
  for (const mutation of ["expire", "revoke", "version", "detach", "block"]) {
    const { f, a } = await fixture();
    await seed(f, a);
    const token = [...f.authority.tokens.values()][0];
    const before = stateOf(f);
    f.afterLocks = async () => {
      if (mutation === "expire") f.authority.now = token.expires;
      if (mutation === "revoke") token.revoked = f.authority.now;
      if (mutation === "version") {
        f.authority.accounts.get(a.accountId)!.version = "9";
      }
      if (mutation === "detach") {
        f.authority.links.get(a.sessionId)!.detached = f.authority.now;
      }
      if (mutation === "block") {
        f.authority.accounts.get(a.accountId)!.status = "blocked";
      }
    };
    await assert.rejects(() => f.commitGame(request(f, a, "NEW001", 0)), {
      code: mutation === "expire"
        ? "ACCOUNT_TOKEN_EXPIRED"
        : mutation === "block"
        ? "ACCOUNT_BLOCKED"
        : "ACCOUNT_TOKEN_INVALID",
    });
    assert.deepEqual(stateOf(f), before);
  }
});

for (const unusable of ["missing", "malformed", "unclassifiable", "unowned"]) {
  Deno.test(`streak ${unusable} tracked game retires without losing progress and permits create/reset`, async () => {
    const variants = unusable === "malformed"
      ? ["players", "participant", "gameId", "bonus", "revision"]
      : unusable === "unowned"
      ? ["absent", "foreign"]
      : [unusable];
    for (const variant of variants) {
      for (const nextAction of ["create", "reset"]) {
        const { f, a } = await fixture();
        await seed(f, a, 7);
        await create(f, a, "BROKEN", 7);
        const stored = f.rows.get("game_BROKEN")!;
        if (unusable === "missing") f.rows.delete(stored.key);
        if (unusable === "malformed") {
          if (variant === "players") stored.value.players = {};
          if (variant === "participant") stored.value.players[0] = null;
          if (variant === "gameId") stored.value.gameId = "OTHER1";
          if (variant === "bonus") {
            stored.value.gameData.winStreakBonus.appliedCount = "invalid";
          }
          if (variant === "revision") stored.value.stateRevision = null;
        }
        if (unusable === "unclassifiable") {
          finish(f, "BROKEN", "win");
          f.rows.get(stored.key)!.value.winnerPlayerId = "unknown";
        }
        if (unusable === "unowned") {
          if (variant === "absent") delete stored.value.players[0].accountId;
          else stored.value.players[0].accountId = "another-account";
        }
        // Retirement must preserve even a previous ended presentation snapshot.
        f.runs.get(a.accountId)!.endedStreak = {
          count: 3,
          endingGameId: "OLDEND",
        };
        const previous = structuredClone(f.runs.get(a.accountId)!);
        const rowsBefore = stateOf(f).rows;
        f.authority.now += 1000;
        const retired = await f.reconcile(a);
        assert.deepEqual(retired, {
          ...previous,
          revision: (BigInt(previous.revision) + 1n).toString(),
          trackedGame: { ...previous.trackedGame!, status: "retired" },
          updatedAt: new Date(f.authority.now).toISOString(),
        });
        assert.deepEqual(stateOf(f).rows, rowsBefore);
        assert.deepEqual(await f.reconcile(a), retired);
        if (nextAction === "reset") {
          const reset = await f.reset({
            ...a,
            expectedRevision: retired.revision,
          });
          assert.equal(reset.currentCount, 0);
          assert.equal(reset.endedStreak, null);
        }
        // Only an explicitly requested Reset clears the preserved count.
        const expectedCount = nextAction === "reset" ? 0 : 7;
        await create(f, a, "RECOV1", expectedCount);
        assert.equal((await f.reconcile(a)).currentCount, expectedCount);
        assert.equal(
          f.rows.get("game_RECOV1")!.value.gameData.winStreakBonus.appliedCount,
          expectedCount,
        );
      }
    }
  });
}

Deno.test("streak rematch validates finished source and rolls back its prepared CAS with creation", async () => {
  const { f, a } = await fixture();
  await seed(f, a, 4);
  await create(f, a, "SOURCE", 4);
  finish(f, "SOURCE", "win");
  await f.reconcile(a);
  const original = structuredClone(f.rows.get("game_SOURCE")!.value),
    updated = structuredClone(original);
  updated.stateRevision++;
  const r = request(f, a, "REMATC", 5);
  r.action = "rematch";
  r.source = {
    gameId: "SOURCE",
    expectedRevision: original.stateRevision,
    update: prepareStreakGameRow(updated),
  };
  const missing = structuredClone(r);
  missing.source!.gameId = "ABSENT";
  await assert.rejects(() => f.commitGame(missing), {
    code: "STREAK_GAME_NOT_FOUND",
  });
  const stale = structuredClone(r);
  stale.source!.expectedRevision = 1;
  await assert.rejects(() => f.commitGame(stale), { code: "STREAK_CONFLICT" });
  const before = stateOf(f);
  f.failAt = "history";
  await assert.rejects(() => f.commitGame(r), {
    code: "ACCOUNT_SERVICE_UNAVAILABLE",
  });
  assert.deepEqual(stateOf(f), before);
  f.failAt = undefined;
  assert.equal((await f.commitGame(r)).status, "committed");
  assert.equal(
    f.rows.get("game_SOURCE")!.value.stateRevision,
    updated.stateRevision,
  );
  assert.equal((await f.reconcile(a)).currentCount, 5);
});
Deno.test("streak pending reciprocal recovery preserves existing replacement/history and completes source atomically", async () => {
  const { f, a } = await fixture();
  await seed(f, a, 8);
  await create(f, a, "SOURCE", 8);
  const pending = structuredClone(f.rows.get("game_SOURCE")!.value);
  pending.stateRevision++;
  pending.status = "finished";
  pending.resultReason = "restart";
  pending.winStreakRestart = {
    kind: "source",
    status: "pending",
    replacementGameId: "REPLAC",
  };
  f.rows.set("game_SOURCE", prepareStreakGameRow(pending));
  f.runs.get(a.accountId)!.trackedGame!.status = "restart_pending";
  const prepared = prepareFreshAccountComputerGame({
    gameId: "REPLAC",
    sessionId: a.sessionId,
    displayName: "Pilot1",
    accountId: a.accountId,
    currentCount: 0,
    restartSourceGameId: "SOURCE",
  });
  f.rows.set(prepared.game.key, structuredClone(prepared.game));
  const history = structuredClone(prepared.history);
  history.value.revision = 3;
  f.rows.set(history.key, history);
  const completed = structuredClone(pending);
  completed.stateRevision++;
  completed.winStreakRestart.status = "completed";
  const r: StreakCommitInput = {
    ...a,
    ...prepared,
    expectedRevision: f.runs.get(a.accountId)!.revision,
    action: "restart",
    source: {
      gameId: "SOURCE",
      expectedRevision: pending.stateRevision,
      update: prepareStreakGameRow(completed),
    },
  };
  const before = stateOf(f);
  f.failAt = "history";
  await assert.rejects(() => f.commitGame(r), {
    code: "ACCOUNT_SERVICE_UNAVAILABLE",
  });
  assert.deepEqual(stateOf(f), before);
  f.failAt = undefined;
  const result = await f.commitGame(r);
  assert.equal(result.status, "committed");
  assert.equal(f.runs.get(a.accountId)!.currentCount, 0);
  assert.equal(f.runs.get(a.accountId)!.trackedGame!.gameId, "REPLAC");
  assert.deepEqual(f.rows.get(prepared.game.key), prepared.game);
  assert.deepEqual(f.rows.get(history.key), history);
  assert.equal(
    f.rows.get("game_SOURCE")!.value.winStreakRestart.status,
    "completed",
  );
});
Deno.test("streak malformed/restart anchors, unproven adoption and stale adoption CAS fail without consumption", async () => {
  for (
    const mode of ["missing", "shape", "winner", "restart", "proof", "cas"]
  ) {
    const { f, a } = await fixture();
    await seed(f, a);
    const game = guest(f, "GUEST1", mode === "cas" ? a.sessionId : "guest", 25);
    const r = offer(f, a, "GUEST1", 25);
    if (mode === "missing") f.rows.delete("game_GUEST1");
    if (mode === "shape") {
      f.rows.get("game_GUEST1")!.value.controllersByPlayerId[game.players[1].id]
        .kind = "human";
    }
    if (mode === "winner") {
      finish(f, "GUEST1", "win");
      f.rows.get("game_GUEST1")!.value.winnerPlayerId = "unknown";
    }
    if (mode === "restart") finish(f, "GUEST1", "restart");
    if (mode === "proof") {
      r.adoption = prepareParticipantAdoption(game, "guest", a.accountId);
    }
    if (mode === "cas") {
      r.adoption = prepareParticipantAdoption(game, a.sessionId, a.accountId);
      f.rows.get("game_GUEST1")!.value.stateRevision++;
    }
    const before = stateOf(f);
    await assert.rejects(() => f.importGuest(r), {
      code: mode === "missing"
        ? "STREAK_GAME_NOT_FOUND"
        : mode === "proof"
        ? "STREAK_SEAT_FORBIDDEN"
        : mode === "cas"
        ? "STREAK_CONFLICT"
        : "STREAK_IMPORT_UNVERIFIED",
    });
    assert.deepEqual(stateOf(f), before);
  }
});
