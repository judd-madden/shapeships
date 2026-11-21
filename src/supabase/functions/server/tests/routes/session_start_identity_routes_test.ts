import assert from "node:assert/strict";
import { enabledGameFixture } from "../accounts/gameIdentityFixture.ts";
import { prefix } from "./game_identity_fixture.ts";

Deno.test("session/start: bootstrap stays account-independent; on links once and binds account casing without raw account tokens in KV", async () => {
  for (const mode of ["names-only", "on"] as const) {
    const f = enabledGameFixture(mode);
    f.repository.failAt = "nameStatus";
    const bootstrap = await f.request("/session/start");
    assert.equal(bootstrap.status, 200);
    assert.equal((await bootstrap.json()).displayName, null);
    assert.equal(f.calls.acquisitions, 0);
  }
  const f = enabledGameFixture(), a = await f.claim("PiLoT1");
  f.resetCalls();
  const response = await f.request(
    "/session/start",
    { displayName: "pilot1" },
    a.headers,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.displayName, "PiLoT1");
  assert.equal(
    f.repository.links.get(body.sessionId)?.accountId,
    a.entry.account.id,
  );
  assert.equal(f.calls.identities, 1);
  assert.equal(f.calls.resumes, 1);
  assert.equal(f.calls.names.length, 0);
  for (const [key, value] of f.persistence.store) {
    assert.ok(!key.includes(a.raw));
    assert.ok(!JSON.stringify(value).includes(a.raw));
  }
  assert.deepEqual(
    f.persistence.store.get(`session_token_${body.sessionToken}`),
    f.persistence.store.get(`session_id_${body.sessionId}`),
  );
  const noHint = await f.request("/session/start", {}, a.headers);
  assert.equal((await noHint.json()).displayName, "PiLoT1");
  const before = f.persistence.store.size;
  const mismatch = await f.request("/session/start", {
    displayName: "Different",
  }, a.headers);
  assert.equal(mismatch.status, 400);
  assert.equal((await mismatch.json()).error, "INVALID_REQUEST");
  assert.equal(f.persistence.store.size, before);
  const created = await f.request("/create-game", {
    playerName: "pilot1",
    timed: false,
  }, {
    ...a.headers,
    "X-Session-Token": body.sessionToken,
  });
  assert.equal(created.status, 200);
  assert.equal(
    f.state((await created.json()).gameId).players[0].id,
    body.sessionId,
  );
});

Deno.test("session/start: account token failures and malformed JSON fail closed without session writes", async () => {
  for (
    const kind of [
      "malformed",
      "unknown",
      "expired",
      "blocked",
      "banned",
      "unavailable",
    ]
  ) {
    const f = enabledGameFixture(), a = await f.claim();
    let raw = a.raw;
    const t = [...f.repository.tokens.values()][0];
    if (kind === "malformed") raw = "bad";
    if (kind === "unknown") raw = "A".repeat(43);
    if (kind === "expired") t.expires = f.repository.now;
    if (kind === "blocked") {
      f.repository.accounts.get(a.entry.account.id)!.status = "blocked";
    }
    if (kind === "banned") f.ban("Pilot1");
    if (kind === "unavailable") f.repository.failAt = "tokenSnapshot";
    const response = await f.request("/session/start", {}, {
      "X-Account-Token": raw,
    });
    const code = (await response.json()).error;
    assert.equal(
      code,
      ({
        malformed: "ACCOUNT_TOKEN_INVALID",
        unknown: "ACCOUNT_TOKEN_INVALID",
        expired: "ACCOUNT_TOKEN_EXPIRED",
        blocked: "ACCOUNT_BLOCKED",
        banned: "NAME_BANNED",
        unavailable: "ACCOUNT_SERVICE_UNAVAILABLE",
      } as Record<string, string>)[kind],
    );
    assert.equal(f.persistence.store.size, 0);
    assert.ok(f.calls.identities <= 1);
  }
  const f = enabledGameFixture();
  const malformed = await f.app.request(prefix + "/session/start", {
    method: "POST",
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, "INVALID_REQUEST");
  const empty = await f.app.request(prefix + "/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(empty.status, 200);
  for (const displayName of [null, "", "\t ", "Two Words"]) {
    const response = await f.request("/session/start", { displayName });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "INVALID_NAME");
  }
});
