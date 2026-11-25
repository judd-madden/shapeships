import assert from "node:assert/strict";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { AccountFault } from "../../accounts/accountRepository.ts";
import { accountServiceLoader } from "../../accounts/accountServiceLoader.ts";
import {
  createStreakRepository,
  mapStreakDatabaseError,
  parseAccountStreakSnapshot,
  type StreakCommitInput,
  StreakFault,
} from "../../accounts/streakRepository.ts";
import { prepareFreshAccountComputerGame } from "../../accounts/streakPreparation.ts";

const id = "00000000-0000-4000-8000-000000000001";
const hash = new Uint8Array(32).fill(7);
const snapshot = {
  accountId: id,
  runId: id,
  currentCount: 12,
  revision: "9007199254740993",
  trackedGame: { gameId: "GAME01", humanPlayerId: "p1", status: "unfinished" },
  endedStreak: null,
  updatedAt: "2026-11-24T00:00:00Z",
};
function fixture(responses: Array<{ data?: unknown; error?: unknown }>) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const client = createClient("https://example.supabase.co", "synthetic-key", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init), url = new URL(request.url);
        assert.equal(url.origin, "https://example.supabase.co");
        assert.match(url.pathname, /^\/rest\/v1\/rpc\/account_streak_/);
        requests.push({
          path: url.pathname.split("/").at(-1)!,
          body: await request.json(),
        });
        const response = responses.shift();
        assert.ok(response, "Unexpected RPC");
        return new Response(
          JSON.stringify(response.error ?? response.data ?? null),
          {
            status: response.error ? 400 : 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  });
  return { repository: createStreakRepository(client), requests };
}
const auth = { tokenHash: hash, sessionId: "p1" };
function commit(): StreakCommitInput {
  return {
    ...auth,
    expectedRevision: snapshot.revision,
    action: "create",
    source: null,
    ...prepareFreshAccountComputerGame({
      gameId: "GAME01",
      sessionId: "p1",
      displayName: "Pilot1",
      accountId: id,
      currentCount: 12,
    }),
  };
}
Deno.test("streak adapter sends four exact RPC contracts and preserves bigint revisions", async () => {
  const imported = {
    anchorGameId: "GUEST1",
    selection: "account",
    acceptedCount: 8,
    continuation: "none",
  };
  const f = fixture([{ data: snapshot }, { data: snapshot }, {
    data: { status: "committed", gameId: "GAME01", streak: snapshot },
  }, { data: { streak: snapshot, import: imported } }]);
  assert.equal(
    (await f.repository.reconcile(auth)).revision,
    snapshot.revision,
  );
  await f.repository.reset({ ...auth, expectedRevision: snapshot.revision });
  const prepared = commit();
  assert.equal((await f.repository.commitGame(prepared)).status, "committed");
  const guest = {
    anchorGameId: "GUEST1",
    humanPlayerId: "guest",
    currentCount: 8,
    resultPending: false,
  };
  assert.deepEqual(
    (await f.repository.importGuest({
      ...auth,
      expectedRevision: snapshot.revision,
      decision: "compare",
      guest,
      adoption: null,
    })).import,
    imported,
  );
  assert.deepEqual(f.requests.map((r) => r.path), [
    "account_streak_reconcile",
    "account_streak_reset",
    "account_streak_commit_game",
    "account_streak_import",
  ]);
  const base = { p_token_hash: "\\x" + "07".repeat(32), p_session_id: "p1" };
  assert.deepEqual(f.requests[0].body, base);
  assert.deepEqual(f.requests[1].body, {
    ...base,
    p_expected_revision: snapshot.revision,
  });
  assert.deepEqual(f.requests[2].body, {
    ...base,
    p_expected_revision: snapshot.revision,
    p_action: "create",
    p_game: prepared.game,
    p_history: prepared.history,
    p_source: null,
  });
  assert.deepEqual(f.requests[3].body, {
    ...base,
    p_expected_revision: snapshot.revision,
    p_decision: "compare",
    p_guest: guest,
    p_adoption: null,
  });
});
Deno.test("streak snapshots reject malformed counts, identities, tuples and numeric revisions", () => {
  assert.deepEqual(parseAccountStreakSnapshot(snapshot), snapshot);
  for (
    const data of [
      null,
      {},
      { ...snapshot, accountId: "wrong" },
      { ...snapshot, runId: "wrong" },
      { ...snapshot, currentCount: -1 },
      { ...snapshot, currentCount: Number.MAX_SAFE_INTEGER + 1 },
      { ...snapshot, revision: 1 },
      { ...snapshot, revision: "0" },
      { ...snapshot, revision: "9223372036854775808" },
      { ...snapshot, trackedGame: undefined },
      {
        ...snapshot,
        trackedGame: { ...snapshot.trackedGame, status: "rejoin" },
      },
      { ...snapshot, endedStreak: { count: 0, endingGameId: "x" } },
      { ...snapshot, updatedAt: "bad" },
    ]
  ) {
    assert.throws(() => parseAccountStreakSnapshot(data), {
      code: "ACCOUNT_SERVICE_UNAVAILABLE",
    });
  }
  assert.equal(
    parseAccountStreakSnapshot({
      ...snapshot,
      currentCount: Number.MAX_SAFE_INTEGER,
      trackedGame: null,
      endedStreak: { count: 5, endingGameId: "END001" },
    }).currentCount,
    Number.MAX_SAFE_INTEGER,
  );
});
Deno.test("streak faults redact SQL details and reuse existing account authority mapping", async () => {
  for (
    const [code, name] of Object.entries({
      P2250: "STREAK_CONFLICT",
      P2251: "STREAK_IMPORT_UNVERIFIED",
      P2252: "STREAK_IMPORT_CONSUMED",
      P2253: "STREAK_SEAT_FORBIDDEN",
      P2255: "STREAK_GAME_NOT_FOUND",
      P2201: "ACCOUNT_BLOCKED",
      P2204: "SESSION_LINK_CONFLICT",
      P2207: "ACCOUNT_TOKEN_EXPIRED",
      P2212: "INVALID_REQUEST",
    })
  ) {
    const f = fixture([{
      error: { code, message: "raw-secret", details: "private-body" },
    }]);
    await assert.rejects(() => f.repository.reconcile(auth), (e: any) => {
      assert.equal(e.code, name);
      assert.equal(e.message, name);
      assert.equal(JSON.stringify(e).includes("raw-secret"), false);
      return true;
    });
  }
  assert.ok(mapStreakDatabaseError({ code: "P2250" }) instanceof StreakFault);
  for (
    const code of [
      "P2254",
      "P2256",
      "23505",
      "55P03",
      "40001",
      "40P01",
      "57014",
    ]
  ) {
    const e = mapStreakDatabaseError({ code });
    assert.ok(e instanceof AccountFault);
    assert.equal(e.code, "ACCOUNT_SERVICE_UNAVAILABLE");
  }
  assert.deepEqual(
    await fixture([{ error: { code: "P2256", message: "internal-only" } }])
      .repository.commitGame(commit()),
    { status: "gameIdTaken" },
  );
});
Deno.test("streak adapter contains transport and malformed-result failures without eager loads", async () => {
  for (
    const data of [null, {}, {
      status: "wrong",
      streak: snapshot,
      gameId: "GAME01",
    }, { status: "committed", streak: snapshot, gameId: null }]
  ) {
    await assert.rejects(
      () => fixture([{ data }]).repository.commitGame(commit()),
      { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
    );
  }
  await assert.rejects(
    () =>
      fixture([{
        data: {
          streak: snapshot,
          import: {
            anchorGameId: "x",
            selection: "guest",
            acceptedCount: 5,
            continuation: "proof_required",
          },
        },
      }]).repository.importGuest({
        ...auth,
        expectedRevision: "1",
        decision: "compare",
        guest: {
          currentCount: 5,
          anchorGameId: "x",
          humanPlayerId: "p1",
          resultPending: false,
        },
        adoption: null,
      }),
    { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
  );
  const repository = createStreakRepository({
    rpc() {
      throw new Error("private token/body");
    },
  });
  await assert.rejects(() => repository.reconcile(auth), {
    code: "ACCOUNT_SERVICE_UNAVAILABLE",
  });
  let calls = 0;
  const load = accountServiceLoader(() => {
    calls++;
    return calls === 1
      ? Promise.reject(new Error("load"))
      : Promise.resolve(repository);
  });
  assert.equal(calls, 0);
  const first = load();
  assert.equal(first, load());
  await assert.rejects(first);
  assert.equal(await load(), repository);
  assert.equal(await load(), repository);
  assert.equal(calls, 2);
});
