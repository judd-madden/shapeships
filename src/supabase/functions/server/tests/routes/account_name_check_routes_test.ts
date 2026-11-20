import assert from "node:assert/strict";
import { accountFixture, prefix } from "../accounts/accountTestFixture.ts";
import { FakeAccountProtection } from "../accounts/fakeAccountProtection.ts";
import { createAccountRateLimit } from "../../accounts/rateLimit.ts";

Deno.test("name-check exposes four outcomes, stored casing, strict input and no session requirement", async () => {
  const f = accountFixture();
  await f.claim("PiLoT1");
  f.repository.rules.push({ kind: "reserved", match: "exact", key: "system" }, {
    kind: "banned",
    match: "contains",
    key: "badword",
  });
  for (
    const [name, outcome, casing] of [
      ["FreshName", "available", "FreshName"],
      ["pilot1", "claimed", "PiLoT1"],
      ["System", "reserved", "System"],
      ["B4dw0rd", "banned", "B4dw0rd"],
    ]
  ) {
    const response = await f.post("name-check", { name }, null);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      ok: true,
      nameKey: name.toLowerCase(),
      displayName: casing,
      outcome,
    });
  }
  assert.equal(
    (await (await f.post("name-check", { name: "two words" }, null)).json())
      .error.code,
    "INVALID_NAME",
  );
  assert.equal(
    (await (await f.post(
      "name-check",
      { name: "Pilot1", password: "secret" },
      null,
    )).json()).error.code,
    "INVALID_REQUEST",
  );
  f.repository.rules.push({ kind: "reserved", match: "exact", key: "pilot1" });
  assert.equal(
    (await (await f.post("name-check", { name: "Pilot1" }, null)).json())
      .outcome,
    "claimed",
  );
  f.repository.rules.push({ kind: "banned", match: "exact", key: "piloti" });
  assert.equal(
    (await (await f.post("name-check", { name: "Pilot1" }, null)).json())
      .outcome,
    "banned",
  );
});

Deno.test("name-check mode guard, public configuration and target rate admission fail closed", async () => {
  for (const mode of ["off", "names-only"] as const) {
    const f = accountFixture({ mode, rejectDependencies: true });
    assert.equal(
      (await f.post("name-check", { name: "Pilot1" }, null)).status,
      503,
    );
    assert.equal(f.dependencyCalls, 0);
  }
  const db = new FakeAccountProtection();
  const human = { verifyClaim: () => Promise.resolve() };
  const rate = createAccountRateLimit(
    { secret: "ab".repeat(32), ipSource: "development", localTest: true },
    db,
    human,
  );
  const f = accountFixture({ rate });
  for (let i = 0; i < 30; i++) {
    assert.equal(
      (await f.post("name-check", { name: "Pilot1" }, null)).status,
      200,
    );
  }
  assert.equal(
    (await f.post("name-check", { name: "Pilot1" }, null)).status,
    429,
  );
  const malformed = await f.app.request(prefix + "/accounts/name-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  const missing = accountFixture({
    rate: createAccountRateLimit({ localTest: false }, db, human),
  });
  for (const route of ["name-check", "claim", "sign-in"]) {
    assert.equal(
      (await (await missing.post(route, { name: "Pilot1" }, null)).json()).error
        .code,
      "ACCOUNT_SERVICE_UNAVAILABLE",
    );
  }
});
