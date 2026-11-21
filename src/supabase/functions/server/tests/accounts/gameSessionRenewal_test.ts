import assert from "node:assert/strict";
import { gameSessionExpired } from "../../accounts/gameRequestIdentity.ts";
import { HOUR, sessionKvFixture } from "./gameSessionRenewalFixture.ts";

Deno.test("session renewal: legacy expiry boundary, extended validity and unchanged creation", async () => {
  const f = sessionKvFixture();
  assert.equal(gameSessionExpired(f.session, f.start + 24 * HOUR), false);
  assert.equal(gameSessionExpired(f.session, f.start + 24 * HOUR + 1), true);
  await f.renew("p1", f.session);
  const token = f.rows.get("session_token_p1");
  assert.equal(token.createdAt, f.session.createdAt);
  assert.equal(token.lastRenewedAt, new Date(f.clock.now).toISOString());
  assert.deepEqual(f.rows.get("session_id_p1"), token);
  assert.equal(gameSessionExpired(token, f.start + 25 * HOUR), false);
  assert.equal(gameSessionExpired(token, f.start + 26 * HOUR + 1), true);
  assert.deepEqual(f.calls.map((c) => c.operation), [
    "read",
    "cas",
    "read",
    "cas",
  ]);
});

Deno.test("session renewal R1: non-due costs zero; exact hour costs four; stale session costs one", async () => {
  const f = sessionKvFixture();
  f.clock.now = f.start + HOUR - 1;
  for (let i = 0; i < 20; i++) await f.renew("p1", f.session);
  assert.equal(f.calls.length, 0);
  f.clock.now++;
  await f.renew("p1", f.session);
  assert.equal(f.calls.length, 4);
  f.calls.length = 0;
  const validated = structuredClone(f.rows.get("session_token_p1"));
  f.clock.now += HOUR - 1;
  await f.renew("p1", validated);
  assert.equal(f.calls.length, 0);
  await f.renew("p1", f.session);
  assert.equal(f.calls.length, 1);
});

Deno.test("session renewal: concurrent bind survives token conflict and mirror merge/conflict", async () => {
  for (const stage of ["token", "before-mirror", "mirror"]) {
    const f = sessionKvFixture();
    f.beforeWrite((key) => {
      if (
        (stage === "token" && key === "session_token_p1") ||
        (stage === "mirror" && key === "session_id_p1")
      ) {
        f.rows.get(key).displayName = "Bound1";
      }
      if (stage === "before-mirror" && key === "session_token_p1") {
        f.rows.get("session_id_p1").displayName = "Bound1";
      }
    });
    await f.renew("p1", f.session);
    assert.equal(f.calls.length, stage === "token" ? 2 : 4);
    assert.equal(
      f.rows.get(stage === "token" ? "session_token_p1" : "session_id_p1")
        .displayName,
      "Bound1",
    );
  }
});

Deno.test("session renewal: concurrent stale requests have one CAS winner and no retries", async () => {
  const f = sessionKvFixture();
  await Promise.all([f.renew("p1", f.session), f.renew("p1", f.session)]);
  assert.equal(f.calls.length, 6);
  assert.equal(f.calls.filter((c) => c.key === "session_id_p1").length, 2);
});

Deno.test("session renewal: failures stop at the failed operation; invalid records never renew", async () => {
  for (let i = 1; i <= 4; i++) {
    const f = sessionKvFixture();
    f.fail(i);
    await f.renew("p1", f.session);
    assert.equal(f.calls.length, i);
  }
  for (const kind of ["missing", "wrong-session", "expired"]) {
    const f = sessionKvFixture();
    if (kind === "missing") f.rows.delete("session_token_p1");
    if (kind === "wrong-session") {
      f.rows.get("session_token_p1").sessionId = "other";
    }
    if (kind === "expired") f.clock.now = f.start + 25 * HOUR;
    await f.renew("p1", f.session);
    assert.equal(f.calls.length, 1);
  }
});
