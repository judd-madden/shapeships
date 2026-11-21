import assert from "node:assert/strict";
import { AccountFault } from "../../accounts/accountRepository.ts";
import {
  createHumanCheck,
  DUMMY_SECRETS,
  DUMMY_TOKEN,
  TURNSTILE_URL,
} from "../../accounts/humanCheck.ts";
import { FakeAccountProtection } from "./fakeAccountProtection.ts";
import { accountFixture, preferences } from "./accountTestFixture.ts";
import { createAccountRateLimit } from "../../accounts/rateLimit.ts";

const fault = (code: string) => (e: unknown) =>
  e instanceof AccountFault && e.code === code;
function fixture(
  overrides: Record<string, unknown> = {},
  config: { secret?: string; hostnames?: string; localTest: boolean } = {
    secret: "real-secret",
    hostnames: "shapeships.test",
    localTest: false,
  },
) {
  const db = new FakeAccountProtection();
  let calls = 0;
  const checker = createHumanCheck(config, db, {
    now: () => db.now,
    fetch: async (url, init) => {
      calls++;
      assert.equal(url, TURNSTILE_URL);
      assert.equal(init?.method, "POST");
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("secret"), config.secret);
      assert.ok(body.get("response"));
      assert.equal(body.has("remoteip"), false);
      return Response.json({
        success: true,
        hostname: "shapeships.test",
        action: "claim",
        challenge_ts: new Date(db.now).toISOString(),
        ...overrides,
      });
    },
  });
  return {
    checker,
    db,
    get calls() {
      return calls;
    },
  };
}

Deno.test("Turnstile claim validation, replay consumption and concurrent sign-in replay", async () => {
  const f = fixture();
  await f.checker.verifyClaim("proof");
  assert.equal(f.db.replays.size, 0);
  await f.checker.consumeClaim!("proof");
  await assert.rejects(
    () => f.checker.verifyClaim("proof"),
    fault("CAPTCHA_REPLAY"),
  );
  assert.equal(f.calls, 1);
  const s = fixture({ action: "sign-in" });
  const results = await Promise.allSettled([
    s.checker.verifySignin!("same"),
    s.checker.verifySignin!("same"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
      .reason.code,
    "CAPTCHA_REPLAY",
  );
});

Deno.test("Turnstile rejects failed, wrong-host, wrong-action, expired, future and missing proofs", async () => {
  const now = new FakeAccountProtection().now;
  for (
    const value of [
      { success: false },
      { hostname: "evil.test" },
      { action: "sign-in" },
      { challenge_ts: new Date(now - 300001).toISOString() },
      { challenge_ts: new Date(now + 60001).toISOString() },
      { challenge_ts: "bad" },
    ]
  ) {
    const f = fixture(value);
    await assert.rejects(
      () => f.checker.verifyClaim("proof"),
      fault("CAPTCHA_INVALID"),
    );
    assert.equal(f.db.replays.size, 0);
  }
  await assert.rejects(
    () => fixture().checker.verifyClaim(undefined),
    fault("CAPTCHA_REQUIRED"),
  );
  await assert.rejects(
    () => fixture().checker.verifyClaim("x".repeat(2049)),
    fault("CAPTCHA_INVALID"),
  );
  await fixture({ challenge_ts: new Date(now - 300000).toISOString() }).checker
    .verifyClaim("boundary");
});

Deno.test("Turnstile tolerates 60 seconds of clock skew and keeps the five-minute maximum in all modes", async () => {
  const now = new FakeAccountProtection().now;
  for (
    const config of [
      { secret: DUMMY_SECRETS[0], hostnames: "example.com", localTest: true },
      { secret: "real-secret", hostnames: "shapeships.test", localTest: false },
      { secret: "real-secret", hostnames: "shapeships.test", localTest: true },
    ]
  ) {
    const dummy = config.secret === DUMMY_SECRETS[0];
    for (
      const [offset, accepted] of [
        [2000, true],
        [59000, true],
        [60000, true],
        [60001, false],
        [61000, false],
        [-300000, true],
        [-300001, false],
        [-301000, false],
      ] as const
    ) {
      const f = fixture({
        hostname: config.hostnames,
        action: dummy ? undefined : "claim",
        challenge_ts: new Date(now + offset).toISOString(),
      }, config);
      const verify = () => f.checker.verifyClaim(dummy ? DUMMY_TOKEN : "proof");
      if (accepted) {
        await verify();
      } else {
        await assert.rejects(verify, fault("CAPTCHA_INVALID"));
      }
    }
  }
});

Deno.test("recorded dummy Siteverify response with metadata requires a dummy secret and local test mode", async () => {
  const response = {
    challenge_ts: "2026-11-21T01:58:49.200Z",
    "error-codes": [],
    hostname: "example.com",
    metadata: { result_with_testing_key: true },
    success: true,
  };
  for (
    const { secret, localTest, code } of [
      { secret: DUMMY_SECRETS[0], localTest: true, code: undefined },
      {
        secret: DUMMY_SECRETS[0],
        localTest: false,
        code: "CAPTCHA_UNAVAILABLE",
      },
      { secret: "real-secret", localTest: true, code: "CAPTCHA_INVALID" },
      { secret: "real-secret", localTest: false, code: "CAPTCHA_INVALID" },
    ]
  ) {
    const f = fixture({ ...response, action: undefined }, {
      secret,
      hostnames: "example.com",
      localTest,
    });
    f.db.now = Date.parse(response.challenge_ts) - 2000;
    if (code) {
      await assert.rejects(
        () => f.checker.verifyClaim(DUMMY_TOKEN),
        fault(code),
      );
    } else {
      await f.checker.verifyClaim(DUMMY_TOKEN);
    }
    assert.equal(f.calls, code === "CAPTCHA_UNAVAILABLE" ? 0 : 1);
  }
});

Deno.test("Turnstile timeout, unreachable and malformed upstream responses fail closed", async () => {
  const db = new FakeAccountProtection();
  for (
    const fetcher of [
      async () => {
        throw new Error("sensitive upstream exception");
      },
      async () => new Response("not-json"),
      async () => new Response("error", { status: 503 }),
      () => new Promise<Response>(() => {}),
    ]
  ) {
    const check = createHumanCheck(
      { secret: "real", hostnames: "shapeships.test", localTest: false },
      db,
      { fetch: fetcher, timeoutMs: 2 },
    );
    await assert.rejects(
      () => check.verifyClaim("proof"),
      fault("CAPTCHA_UNAVAILABLE"),
    );
  }
});

Deno.test("dummy secrets/responses require explicit local mode and only fixed token skips replay", async () => {
  for (const secret of DUMMY_SECRETS) {
    const prod = fixture({}, {
      secret,
      hostnames: "example.com",
      localTest: false,
    });
    await assert.rejects(
      () => prod.checker.verifyClaim(DUMMY_TOKEN),
      fault("CAPTCHA_UNAVAILABLE"),
    );
    assert.equal(prod.calls, 0);
  }
  const local = fixture({ hostname: "example.com", action: undefined }, {
    secret: DUMMY_SECRETS[0],
    hostnames: "example.com",
    localTest: true,
  });
  for (let i = 0; i < 2; i++) {
    await local.checker.verifyClaim(DUMMY_TOKEN);
    await local.checker.consumeClaim!(DUMMY_TOKEN);
  }
  await local.checker.verifySignin!(DUMMY_TOKEN);
  assert.equal(local.db.captchaCalls.length, 0);
  await local.checker.verifySignin!("other-proof");
  await assert.rejects(
    () => local.checker.verifySignin!("other-proof"),
    fault("CAPTCHA_REPLAY"),
  );
  const productionDummy = fixture({
    hostname: "example.com",
    action: undefined,
  });
  await assert.rejects(
    () => productionDummy.checker.verifyClaim(DUMMY_TOKEN),
    fault("CAPTCHA_INVALID"),
  );
  const missing = fixture({}, {
    hostnames: "shapeships.test",
    localTest: false,
  });
  await assert.rejects(
    () => missing.checker.verifyClaim("proof"),
    fault("CAPTCHA_UNAVAILABLE"),
  );
});

Deno.test("real protection wiring consumes failed sign-in proof before hashing and concurrent claims create one account", async () => {
  const db = new FakeAccountProtection();
  const checker = createHumanCheck(
    { secret: "real", hostnames: "shapeships.test", localTest: false },
    db,
    {
      now: () => db.now,
      fetch: async (_url, init) => {
        const token = (init?.body as URLSearchParams).get("response")!;
        return Response.json({
          success: true,
          hostname: "shapeships.test",
          action: token.startsWith("claim") ? "claim" : "sign-in",
          challenge_ts: new Date(db.now).toISOString(),
        });
      },
    },
  );
  const rate = createAccountRateLimit(
    { secret: "ab".repeat(32), ipSource: "la13", localTest: false },
    db,
    checker,
  );
  const f = accountFixture({ rate, human: checker });
  const claimBody = {
    name: "Pilot1",
    password: "abcdefghij",
    preferences,
    turnstileToken: "claim-proof",
  };
  const claims = await Promise.all([
    f.post("claim", claimBody),
    f.post("claim", claimBody, "s2"),
  ]);
  assert.deepEqual(claims.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await claims.find((r) => r.status === 409)!.json()).error.code,
    "CAPTCHA_REPLAY",
  );
  assert.equal(f.repository.accounts.size, 1);
  const signin = {
    name: "Pilot1",
    password: "wrong-password",
    turnstileToken: "sign-proof",
  };
  assert.equal((await f.post("sign-in", signin)).status, 401);
  assert.equal(
    (await (await f.post("sign-in", signin)).json()).error.code,
    "CAPTCHA_REPLAY",
  );
  assert.equal(f.fakeHasher.verifyCalls, 1);
});
