import assert from "node:assert/strict";
import {
  AccountFault,
  type RateBucket,
} from "../../accounts/accountRepository.ts";
import {
  type AccountAdmissionContext,
  createAccountRateLimit,
  LA13_GLOBAL_LIMITS,
} from "../../accounts/rateLimit.ts";
import type { HumanCheck } from "../../accounts/humanCheck.ts";
import { accountFixture, preferences } from "./accountTestFixture.ts";
import { FakeAccountProtection, hex } from "./fakeAccountProtection.ts";

const fault = (code: string) => (e: unknown) =>
  e instanceof AccountFault && e.code === code;
const context = (
  category: AccountAdmissionContext["category"],
  ip = "192.0.2.1",
): AccountAdmissionContext => ({
  category,
  headers: new Headers({ "cf-connecting-ip": ip }),
});
const human: HumanCheck = {
  verifyClaim: () => Promise.resolve(),
  verifySignin: (proof) =>
    proof
      ? Promise.resolve()
      : Promise.reject(new AccountFault("CAPTCHA_REQUIRED")),
};
const config = {
  secret: "ab".repeat(32),
  ipSource: "header:cf-connecting-ip",
  localTest: false,
};

Deno.test("atomic fixed windows return the largest delay and retain counters for one hour", async () => {
  const db = new FakeAccountProtection();
  const buckets: RateBucket[] = [60, 900].map((seconds, i) => ({
    scope: i ? "claim_target" : "claim_ip",
    subjectHash: "ab".repeat(32),
    limit: 1,
    windowSeconds: seconds,
    operation: "hit",
  }));
  assert.equal((await db.rateHit(buckets)).allowed, true);
  db.now += 1001;
  const denied = await db.rateHit(buckets);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 899);
  assert.deepEqual(Object.values(denied.counts), [2, 2]);
  db.now += 899000;
  assert.equal((await db.rateHit(buckets)).allowed, true);
  assert.ok([...db.counters.values()].some((r) => r.expires > db.now));
});

Deno.test("claim hard limits prevent proof/hash work and preserve matching retry headers", async () => {
  const db = new FakeAccountProtection();
  let proofs = 0;
  const h: HumanCheck = {
    verifyClaim: () => {
      proofs++;
      return Promise.resolve();
    },
  };
  const rate = createAccountRateLimit(
    { ...config, ipSource: "development", localTest: true },
    db,
    h,
    { now: () => db.now },
  );
  const f = accountFixture({ rate, human: h });
  for (let i = 0; i < 3; i++) {
    await f.post("claim", {
      name: "Pilot1",
      password: "abcdefghij",
      preferences,
      turnstileToken: "proof",
    });
  }
  const response = await f.post("claim", {
    name: "Pilot1",
    password: "abcdefghij",
    preferences,
    turnstileToken: "proof",
  });
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(
    response.headers.get("Retry-After"),
    String(body.error.retryAfterSeconds),
  );
  assert.equal(proofs, 3);
  assert.equal(f.fakeHasher.hashCalls, 3);
  assert.equal(JSON.stringify(db.calls).includes("192.0.2.1"), false);
  assert.equal(JSON.stringify(db.calls).includes("pilot1"), false);
});

Deno.test("sign-in/password share escalation after 3 IP+name failures, then hard-stop at 10", async () => {
  const db = new FakeAccountProtection();
  let checks = 0;
  const h: HumanCheck = {
    ...human,
    verifySignin: (proof) => {
      checks++;
      return human.verifySignin!(proof);
    },
  };
  const rate = createAccountRateLimit(
    { ...config, ipSource: "development", localTest: true },
    db,
    h,
    { now: () => db.now },
  );
  const f = accountFixture({ rate, human: h });
  await f.claim();
  for (let i = 0; i < 3; i++) {
    assert.equal(
      (await f.post("sign-in", { name: "Pilot1", password: "wrong-password" }))
        .status,
      401,
    );
  }
  const challenge = await f.post("password", {
    name: "Pilot1",
    currentPassword: "wrong-password",
    newPassword: "new-password",
  });
  assert.equal((await challenge.json()).error.code, "CAPTCHA_REQUIRED");
  assert.equal(f.fakeHasher.verifyCalls, 3);
  for (let i = 3; i < 10; i++) {
    await f.post("sign-in", {
      name: "Pilot1",
      password: "wrong-password",
      turnstileToken: "new-proof",
    });
  }
  const before = checks;
  assert.equal(
    (await f.post("sign-in", {
      name: "Pilot1",
      password: "abcdefghij",
      turnstileToken: "proof",
    })).status,
    429,
  );
  assert.equal(f.fakeHasher.verifyCalls, 10);
  assert.equal(checks, before);
});

Deno.test("distributed name failures escalate at ten, successful verification does not erase them", async () => {
  const db = new FakeAccountProtection();
  const rate = createAccountRateLimit(config, db, human, { now: () => db.now });
  for (let i = 1; i <= 10; i++) {
    await rate.verification(
      context("sign-in", "192.0.2." + i),
      "pilot1",
      false,
    );
  }
  await rate.verification(context("password"), "pilot1", true);
  await assert.rejects(
    () => rate.beforeHash(context("sign-in", "192.0.2.99"), "pilot1"),
    fault("CAPTCHA_REQUIRED"),
  );
  db.now += 900000;
  await rate.beforeHash(context("sign-in"), "pilot1");
});

Deno.test("LA13 uses reviewed constants and requires proof on every sign-in/password", async () => {
  assert.equal(LA13_GLOBAL_LIMITS.claim.limit, 300);
  assert.equal(LA13_GLOBAL_LIMITS["sign-in"].limit, 600);
  const db = new FakeAccountProtection();
  const rate = createAccountRateLimit(
    { ...config, ipSource: "la13" },
    db,
    human,
  );
  for (const category of ["sign-in", "password"] as const) {
    const c = context(category);
    await rate.entry(c);
    await rate.target(c, "pilot1");
    await assert.rejects(
      () => rate.beforeHash(c, "pilot1"),
      fault("CAPTCHA_REQUIRED"),
    );
    c.turnstileToken = "proof";
    await rate.beforeHash(c, "pilot1");
  }
  assert.equal(db.calls.flat().some((b) => /_ip/.test(b.scope)), false);
  assert.ok(
    db.calls.flat().some((b) => b.scope === "signin_global" && b.limit === 600),
  );
});

Deno.test("missing/invalid rate secret or IP configuration fails closed", async () => {
  for (
    const bad of [
      { ...config, secret: undefined },
      { ...config, secret: "abc" },
      { ...config, ipSource: undefined },
      { ...config, ipSource: "development" },
    ]
  ) {
    const db = new FakeAccountProtection(),
      rate = createAccountRateLimit(bad, db, human);
    await assert.rejects(
      () => rate.entry(context("name-check")),
      fault("ACCOUNT_SERVICE_UNAVAILABLE"),
    );
    assert.equal(db.calls.length, 0);
  }
});

Deno.test("random token digests share unknown-IP limits; recognized tokens get their own bucket", async () => {
  const db = new FakeAccountProtection(),
    rate = createAccountRateLimit(config, db, human);
  for (let i = 0; i < 120; i++) {
    await rate.token(context("resume"), new Uint8Array(32).fill(i));
  }
  await assert.rejects(
    () => rate.token(context("resume"), new Uint8Array(32).fill(121)),
    fault("RATE_LIMITED"),
  );
  const known = new Uint8Array(32).fill(255);
  db.recognized.add(hex(known));
  await rate.token(context("resume"), known);
  assert.equal(
    [...db.counters.keys()].filter((k) => k.startsWith("account_token:"))
      .length,
    1,
  );
});

Deno.test("cleanup is bounded and attempted once per worker minute", async () => {
  const db = new FakeAccountProtection(),
    rate = createAccountRateLimit(config, db, human, { now: () => db.now });
  for (let i = 0; i < 101; i++) {
    db.counters.set("expired" + i, { count: 1, expires: db.now - 1 });
  }
  await rate.entry(context("name-check"));
  await rate.entry(context("name-check"));
  assert.equal(db.cleanupCalls, 1);
  assert.equal(
    [...db.counters.keys()].filter((k) => k.startsWith("expired")).length,
    1,
  );
  db.now += 60000;
  await rate.entry(context("name-check"));
  assert.equal(db.cleanupCalls, 2);
});

Deno.test("preferences share existing token/unknown scopes and one LA13 global ceiling", async () => {
  const known = new Uint8Array(32).fill(9);
  const db = new FakeAccountProtection();
  db.recognized.add(hex(known));
  const rate = createAccountRateLimit(config, db, human, { now: () => db.now });
  for (let i = 0; i < 120; i++) await rate.token(context("preferences"), known);
  await assert.rejects(
    () => rate.token(context("preferences"), known),
    fault("RATE_LIMITED"),
  );
  assert.ok(
    db.calls.flat().some((b) =>
      b.scope === "account_token" && b.applies === "recognized"
    ),
  );
  for (let i = 0; i < 120; i++) {
    await rate.token(context("preferences"), new Uint8Array(32).fill(i + 20));
  }
  await assert.rejects(
    () => rate.token(context("preferences")),
    fault("RATE_LIMITED"),
  );
  assert.ok(
    db.calls.flat().some((b) =>
      b.scope === "account_unknown_ip" && b.applies === "unknown"
    ),
  );
  const globalDb = new FakeAccountProtection();
  const globalRate = createAccountRateLimit(
    { ...config, ipSource: "la13" },
    globalDb,
    human,
    { now: () => globalDb.now },
  );
  for (let i = 0; i < 1200; i++) await globalRate.entry(context("preferences"));
  await assert.rejects(
    () => globalRate.entry(context("preferences")),
    fault("RATE_LIMITED"),
  );
  assert.ok(
    globalDb.calls.flat().some((b) =>
      b.scope === "preferences_global" && b.limit === 1200 &&
      b.windowSeconds === 60
    ),
  );
  const f = accountFixture({
    rate: {
      entry: () =>
        Promise.reject(new AccountFault("RATE_LIMITED", undefined, 12)),
    },
  });
  const response = await f.app.request(
    "/make-server-825e19ab/accounts/preferences",
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "12");
});
