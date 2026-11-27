import assert from "node:assert/strict";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import {
  createAccountProtectionRepository,
  createAccountRepository,
  type CredentialSnapshot,
  mapAccountDatabaseError,
} from "../../accounts/accountRepository.ts";

const id = "00000000-0000-4000-8000-000000000001";
const values = {
  soundEnabled: true,
  healthFlashEnabled: false,
  chatMinimized: true,
  battleLogPreferred: false,
  musicEnabled: true,
};
const account = { id, displayName: "Pilot1", badge: "claimed-name" };
const success = {
  account,
  preferences: {
    values,
    revision: "9007199254740993",
    updatedAt: "2026-11-20T00:00:00Z",
  },
  expiresAt: "2027-02-18T00:00:00Z",
};
const snapshot: CredentialSnapshot = {
  accountId: id,
  displayName: "Pilot1",
  securityVersion: "9007199254740993",
  passwordHash: "encoded-hash",
  passwordFormat: "nfc-argon2id-v1",
  mustChangePassword: false,
};
const hash = new Uint8Array(32).fill(7);
const linked = {
  ...success,
  link: { sessionId: "session-one", accountId: id, displayName: "Pilot1" },
};

function fixture(responses: Array<{ data?: unknown; error?: unknown }>) {
  const requests: Array<{ url: URL; body: Record<string, unknown> }> = [];
  const client = createClient("https://example.supabase.co", "synthetic-key", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        assert.equal(url.origin, "https://example.supabase.co");
        assert.match(url.pathname, /^\/rest\/v1\/rpc\/account_/);
        requests.push({ url, body: await request.json() });
        const result = responses.shift();
        assert.ok(result, "Unexpected RPC");
        return new Response(
          JSON.stringify(result.error ?? result.data ?? null),
          {
            status: result.error ? 400 : 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  });
  return { repository: createAccountRepository(client), client, requests };
}

Deno.test("set 03 adapter preserves name casing, bytea and persisted-admission contracts", async () => {
  const f = fixture([
    { data: { nameKey: "pilot1", displayName: "PiLoT1", outcome: "claimed" } },
    {
      data: { allowed: false, retryAfterSeconds: 42, counts: { claim_ip: 11 } },
    },
    { data: true },
    { data: false },
    { data: 100 },
  ]);
  assert.equal((await f.repository.nameStatus("pilot1")).displayName, "PiLoT1");
  const p = createAccountProtectionRepository(f.client);
  const buckets = [{
    scope: "claim_ip",
    subjectHash: "ab".repeat(32),
    limit: 10,
    windowSeconds: 3600,
    operation: "hit" as const,
  }];
  assert.equal((await p.rateHit(buckets, hash)).retryAfterSeconds, 42);
  assert.equal(f.requests[1].body.p_token_hash, "\\x" + "07".repeat(32));
  assert.deepEqual(f.requests[1].body.p_buckets, buckets);
  assert.equal(await p.captcha(hash, true), true);
  assert.equal(await p.captcha(hash, false), false);
  assert.equal(await p.cleanup(), 100);
  for (
    const data of [{ allowed: true, retryAfterSeconds: 0, counts: {} }, {
      allowed: false,
      retryAfterSeconds: 0,
      counts: { claim_ip: 11 },
    }]
  ) {
    await assert.rejects(
      () =>
        createAccountProtectionRepository(fixture([{ data }]).client).rateHit(
          buckets,
        ),
      { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
    );
  }
  await assert.rejects(
    () =>
      fixture([{
        data: {
          nameKey: "pilot1",
          displayName: "OtherName",
          outcome: "claimed",
        },
      }]).repository.nameStatus("Pilot1"),
    { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
  );
});

Deno.test("pinned service client sends exact RPC arguments and bytea, preserving decimal versions", async () => {
  const { repository: r, requests } = fixture([
    { data: linked },
    { data: snapshot },
    { data: linked },
    { data: success },
    { data: linked },
    { data: null },
    { data: linked },
    { data: true },
    { data: account },
    { data: null },
  ]);
  const claim = await r.claim({
    displayName: "Pilot1",
    nameKey: "pilot1",
    moderationKey: "piloti",
    passwordHash: "encoded-hash",
    passwordFormat: "nfc-argon2id-v1",
    tokenHash: hash,
    sessionId: "session-one",
    preferences: values,
  });
  assert.equal(claim.preferences.revision, "9007199254740993");
  assert.deepEqual(claim.preferences.values, values);
  assert.deepEqual(await r.readCredential("pilot1"), snapshot);
  await r.finishSignin(snapshot, hash, "session-one");
  assert.equal((await r.resume(hash)).link, undefined);
  await r.resume(hash, "session-one");
  await r.logout(hash);
  await r.changePassword(
    snapshot,
    "new-hash",
    "nfc-argon2id-v1",
    hash,
    "session-one",
  );
  assert.equal(await r.rehash(snapshot, "new-hash", "nfc-argon2id-v1"), true);
  assert.deepEqual(await r.identity(hash, "session-one"), account);
  assert.equal(await r.readCredential("unknown"), null);
  assert.deepEqual(requests.map((v) => v.url.pathname.split("/").at(-1)), [
    "account_claim",
    "account_read_credential",
    "account_finish_signin",
    "account_resume",
    "account_resume",
    "account_logout",
    "account_change_password",
    "account_rehash",
    "account_identity",
    "account_read_credential",
  ]);
  assert.equal(requests[0].body.p_token_hash, "\\x" + "07".repeat(32));
  assert.equal(
    requests[2].body.p_expected_security_version,
    "9007199254740993",
  );
  assert.equal(requests[3].body.p_session_id, null);
  assert.equal(requests[6].body.p_new_password_hash, "new-hash");
  assert.equal(requests[0].body.p_music_enabled, true);
  assert.equal("password" in requests[0].body, false);
});

Deno.test("every SQL outcome is mapped safely; unrelated uniqueness never means NAME_TAKEN", async () => {
  const expected: Record<string, string> = {
    P2201: "ACCOUNT_BLOCKED",
    P2202: "INVALID_CREDENTIALS",
    P2203: "INVALID_CREDENTIALS",
    P2204: "SESSION_LINK_CONFLICT",
    P2205: "PASSWORD_CHANGE_REQUIRED",
    P2206: "ACCOUNT_TOKEN_INVALID",
    P2207: "ACCOUNT_TOKEN_EXPIRED",
    P2208: "ACCOUNT_TOKEN_INVALID",
    P2209: "NAME_BANNED",
    P2210: "NAME_RESERVED",
    P2212: "INVALID_REQUEST",
  };
  for (const [code, mapped] of Object.entries(expected)) {
    const { repository } = fixture([{
      error: { code, message: "raw-secret-detail", details: "do-not-echo" },
    }]);
    await assert.rejects(() => repository.resume(hash), (error: unknown) => {
      const e = error as Error & { code: string };
      assert.equal(e.code, mapped);
      assert.equal(e.message, mapped);
      assert.equal(JSON.stringify(e).includes("raw-secret"), false);
      return true;
    });
  }
  assert.equal(
    mapAccountDatabaseError({ code: "23505", message: "ACCOUNT_NAME_TAKEN" })
      .code,
    "NAME_TAKEN",
  );
  for (
    const error of [
      { code: "23505", message: "another constraint" },
      { code: "55P03" },
      { code: "40001" },
      { code: "40P01" },
      { code: "57014" },
      {},
      null,
    ]
  ) {
    assert.equal(
      mapAccountDatabaseError(error).code,
      "ACCOUNT_SERVICE_UNAVAILABLE",
    );
    assert.equal(mapAccountDatabaseError(error).retryAfterSeconds, 5);
  }
});

Deno.test("set 04 adapter: exact preference RPCs, normal conflict results and safe malformed-result failures", async () => {
  const prefs = {
    ...success.preferences,
    updatedAt: new Date(success.preferences.updatedAt).toISOString(),
  };
  const f = fixture([
    { data: { preferences: prefs } },
    { data: { status: "updated", preferences: prefs } },
    { data: { status: "conflict", preferences: prefs } },
  ]);
  assert.deepEqual(await f.repository.getPreferences(hash), prefs);
  assert.equal(
    (await f.repository.updatePreferences(
      hash,
      { soundEnabled: false },
      prefs.revision,
    )).status,
    "updated",
  );
  assert.deepEqual(
    await f.repository.updatePreferences(hash, { musicEnabled: false }, "1"),
    { status: "conflict", preferences: prefs },
  );
  assert.deepEqual(f.requests.map((r) => r.url.pathname.split("/").pop()), [
    "account_get_preferences",
    "account_update_preferences",
    "account_update_preferences",
  ]);
  assert.deepEqual(f.requests[2].body, {
    p_token_hash: "\\x" + "07".repeat(32),
    p_patch: { musicEnabled: false },
    p_expected_revision: "1",
  });
  for (
    const data of [
      null,
      { status: "other", preferences: prefs },
      { status: "conflict" },
      { status: "conflict", preferences: { ...prefs, revision: 1 } },
      {
        status: "conflict",
        preferences: { ...prefs, values: { ...values, musicEnabled: "yes" } },
      },
    ]
  ) {
    const bad = fixture([{ data }]);
    await assert.rejects(
      () =>
        bad.repository.updatePreferences(hash, { soundEnabled: false }, "1"),
      { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
    );
  }
  // Exception DETAIL is never used as a preference transport.
  const bad = fixture([{
    error: {
      code: "P2211",
      message: "private",
      details: JSON.stringify(prefs),
    },
  }]);
  await assert.rejects(
    () => bad.repository.updatePreferences(hash, { soundEnabled: false }, "1"),
    { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
  );
});

Deno.test("malformed RPC results and network failures fail as service faults", async () => {
  for (
    const data of [
      { ...linked, preferences: { ...success.preferences, revision: 1 } },
      { ...linked, link: { ...linked.link, accountId: "wrong" } },
      {},
      null,
    ]
  ) {
    await assert.rejects(
      () =>
        fixture([{ data }]).repository.finishSignin(
          snapshot,
          hash,
          "session-one",
        ),
      { code: "ACCOUNT_SERVICE_UNAVAILABLE" },
    );
  }
  const r = createAccountRepository({
    rpc() {
      throw new Error("raw network secret");
    },
  });
  await assert.rejects(() => r.readCredential("pilot1"), {
    code: "ACCOUNT_SERVICE_UNAVAILABLE",
  });
});

Deno.test("mission progress adapter maps all three RPCs and preserves ordered lists", async () => {
  const progress = { missions: ["second", "first"], findings: ["sol-1"] };
  const f = fixture([{ data: progress }, { data: progress }, { data: { missions: [], findings: [] } }]);
  assert.deepEqual(await f.repository.getMissionProgress(hash), progress);
  assert.deepEqual(await f.repository.addMissionProgress(hash, ["second", "first"], ["sol-1"]), progress);
  assert.deepEqual(await f.repository.resetMissionProgress(hash), { missions: [], findings: [] });
  assert.deepEqual(f.requests.map((r) => r.url.pathname.split("/").pop()), [
    "account_get_mission_progress", "account_add_mission_progress", "account_reset_mission_progress",
  ]);
  assert.deepEqual(f.requests.map((r) => r.body), [
    { p_token_hash: "\\x" + "07".repeat(32) },
    { p_token_hash: "\\x" + "07".repeat(32), p_missions: ["second", "first"], p_findings: ["sol-1"] },
    { p_token_hash: "\\x" + "07".repeat(32) },
  ]);
});

Deno.test("mission RPC errors reuse account authorization and invalid-input mappings", async () => {
  const codes = { P2212: "INVALID_REQUEST", P2201: "ACCOUNT_BLOCKED", P2206: "ACCOUNT_TOKEN_INVALID",
    P2207: "ACCOUNT_TOKEN_EXPIRED", P2208: "ACCOUNT_TOKEN_INVALID", P2209: "NAME_BANNED", P2210: "NAME_RESERVED",
    "23514": "ACCOUNT_SERVICE_UNAVAILABLE" };
  for (const [code, expected] of Object.entries(codes)) {
    for (const method of ["get", "add", "reset"]) {
      const r = fixture([{ error: { code, message: "private database details" } }]).repository;
      await assert.rejects(() => method === "get" ? r.getMissionProgress(hash) : method === "add"
        ? r.addMissionProgress(hash, [], []) : r.resetMissionProgress(hash), { code: expected, message: expected });
    }
  }
});

Deno.test("mission RPC malformed results and transport failures return safe service faults", async () => {
  for (const data of [null, [], {}, { missions: [] }, { missions: [], findings: null },
    { missions: [], findings: [], revision: "1" }, { missions: [1], findings: [] },
    { missions: ["id\n"], findings: [] }, { missions: ["Upper"], findings: [] },
    { missions: [], findings: Array(101).fill("id") }]) {
    for (const method of ["get", "add", "reset"]) {
      const r = fixture([{ data }]).repository;
      await assert.rejects(() => method === "get" ? r.getMissionProgress(hash) : method === "add"
        ? r.addMissionProgress(hash, [], []) : r.resetMissionProgress(hash), { code: "ACCOUNT_SERVICE_UNAVAILABLE" });
    }
  }
  const r = createAccountRepository({ rpc: () => { throw new Error("private transport details"); } });
  for (const call of [() => r.getMissionProgress(hash), () => r.addMissionProgress(hash, [], []), () => r.resetMissionProgress(hash)]) {
    await assert.rejects(call, { code: "ACCOUNT_SERVICE_UNAVAILABLE", message: "ACCOUNT_SERVICE_UNAVAILABLE" });
  }
});
