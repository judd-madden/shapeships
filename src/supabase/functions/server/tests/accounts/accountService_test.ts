import assert from "node:assert/strict";
import { AccountFault } from "../../accounts/accountRepository.ts";
import { HashAdmission } from "../../accounts/hashAdmission.ts";
import { createPasswordHasher } from "../../accounts/passwordHashing.ts";
import { PASSWORD_FORMAT } from "../../accounts/passwordPolicy.ts";
import { tokenDigest } from "../../accounts/tokens.ts";
import { accountFixture, preferences } from "./accountTestFixture.ts";
import { DAY } from "./fakeAccountRepository.ts";

const credentials = { name: "Pilot1", password: "abcdefghij" };
const errorCode = async (response: Response) =>
  (await response.json()).error.code;

Deno.test("simultaneous case-folded claims have one winner, immutable casing and five atomic rows", async () => {
  const f = accountFixture();
  const results = await Promise.all([
    f.post("claim", { ...credentials, name: "PiLoT1", preferences }, "s1"),
    f.post("claim", { ...credentials, name: "pilot1", preferences }, "s2"),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winner = await results.find((r) => r.status === 201)!.json();
  assert.equal(
    await errorCode(results.find((r) => r.status === 409)!),
    "NAME_TAKEN",
  );
  for (
    const table of [
      f.repository.accounts,
      f.repository.credentials,
      f.repository.preferences,
      f.repository.tokens,
      f.repository.links,
    ]
  ) assert.equal(table.size, 1);
  const signed = await f.post("sign-in", credentials, "s3");
  assert.equal(signed.status, 200);
  assert.equal(
    (await signed.json()).account.displayName,
    winner.account.displayName,
  );
  assert.deepEqual(winner.preferences.values, preferences);
  assert.equal(winner.link.sessionId.startsWith("session-s"), true);
  assert.equal(f.sessions.get("s1")!.sessionId, "session-s1");
});

Deno.test("every injected claim failure leaves no partial state, including before commit", async () => {
  for (
    const point of [
      "account",
      "credential",
      "preferences",
      "token",
      "link",
      "commit",
    ]
  ) {
    const f = accountFixture();
    f.repository.failAt = "claim." + point;
    const result = await f.post("claim", { ...credentials, preferences });
    assert.equal(result.status, 503, point);
    for (
      const table of [
        f.repository.accounts,
        f.repository.credentials,
        f.repository.preferences,
        f.repository.tokens,
        f.repository.links,
      ]
    ) assert.equal(table.size, 0, point);
  }
  const f = accountFixture(),
    entered = Promise.withResolvers<void>(),
    proceed = Promise.withResolvers<void>();
  f.repository.beforeCommit = async () => {
    entered.resolve();
    await proceed.promise;
  };
  const pending = f.post("claim", { ...credentials, preferences });
  await entered.promise;
  assert.equal(f.repository.accounts.size, 0);
  proceed.resolve();
  assert.equal((await pending).status, 201);
});

Deno.test("claim protection fails closed and admission hooks surround human/hash work", async () => {
  const f = accountFixture({ useDefaultHuman: true });
  const response = await f.post("claim", { ...credentials, preferences });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal(await errorCode(response), "CAPTCHA_UNAVAILABLE");
  assert.equal(f.fakeHasher.hashCalls, 0);
  assert.equal(f.repository.accounts.size, 0);
  assert.deepEqual(f.events, ["entry:claim", "target"]);
  const allowed = accountFixture();
  await allowed.claim();
  assert.deepEqual(allowed.events, [
    "entry:claim",
    "target",
    "human",
    "before-hash",
  ]);
});

Deno.test("blocked status is revealed only after correct password; unknown and wrong remain identical", async () => {
  const f = accountFixture(), claimed = await f.claim();
  await f.repository.ownerTransition(claimed.account.id, { blocked: true });
  const wrong = await f.post("sign-in", {
    ...credentials,
    password: "wrongxxxxx",
  });
  const unknown = await f.post("sign-in", { ...credentials, name: "Nobody" });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
  const correct = await f.post("sign-in", credentials);
  assert.equal(correct.status, 403);
  assert.equal(await errorCode(correct), "ACCOUNT_BLOCKED");
  assert.equal(f.repository.tokens.size, 1);
  assert.deepEqual(f.events.filter((e) => e.startsWith("verified:")), [
    "verified:false",
    "verified:false",
    "verified:true",
  ]);
});

Deno.test("security-version and credential-only changes invalidate a paused password verification", async () => {
  for (const race of ["reset", "rehash"]) {
    const f = accountFixture(), claimed = await f.claim();
    const snapshot = (await f.repository.readCredential("pilot1"))!;
    const entered = Promise.withResolvers<void>(),
      proceed = Promise.withResolvers<void>();
    const verify = f.fakeHasher.verify.bind(f.fakeHasher);
    f.fakeHasher.verify = async (...args) => {
      const result = await verify(...args);
      entered.resolve();
      await proceed.promise;
      return result;
    };
    const pending = f.post("sign-in", credentials, "s2");
    await entered.promise;
    const replacement = f.fakeHasher.credential("temporary12345");
    if (race === "reset") {
      await f.repository.ownerTransition(claimed.account.id, {
        hash: replacement,
      });
    } else {assert.equal(
        await f.repository.rehash(snapshot, replacement, PASSWORD_FORMAT),
        true,
      );}
    proceed.resolve();
    const response = await pending;
    assert.equal(response.status, 401, race);
    assert.equal(await errorCode(response), "INVALID_CREDENTIALS");
    assert.equal(f.repository.tokens.size, 1);
    assert.equal(f.repository.links.has("session-s2"), false);
  }
});

Deno.test("injected outdated policy rehashes with real hash-wasm without advancing security version", async () => {
  const f = accountFixture(), claimed = await f.claim();
  f.fakeHasher.needsRehash = true;
  const real = createPasswordHasher();
  f.fakeHasher.hash = (password) => real.hash(password);
  const response = await f.post("sign-in", credentials, "s2");
  assert.equal(response.status, 200);
  const snapshot = (await f.repository.readCredential("pilot1"))!;
  assert.match(snapshot.passwordHash, /^\$argon2id\$/);
  assert.equal(
    (await real.verify("abcdefghij", snapshot.passwordHash, PASSWORD_FORMAT))
      .matches,
    true,
  );
  assert.equal(snapshot.securityVersion, "1");
  assert.equal(f.repository.accounts.get(claimed.account.id)!.version, "1");
  assert.equal(
    await f.repository.rehash(
      { ...snapshot, passwordHash: "stale" },
      "replacement",
      PASSWORD_FORMAT,
    ),
    false,
  );
});

Deno.test("password change verifies and hashes sequentially within one admission", async () => {
  class CountingAdmission extends HashAdmission {
    runs = 0;
    override run<T>(work: () => Promise<T>): Promise<T> {
      this.runs++;
      return super.run(work);
    }
  }
  const admission = new CountingAdmission(), f = accountFixture({ admission });
  await f.claim();
  admission.runs = 0;
  const entered = Promise.withResolvers<void>(),
    proceed = Promise.withResolvers<void>();
  const verify = f.fakeHasher.verify.bind(f.fakeHasher),
    hash = f.fakeHasher.hash.bind(f.fakeHasher);
  let verified = false, replacementStarted = false;
  f.fakeHasher.verify = async (...args) => {
    const result = await verify(...args);
    entered.resolve();
    await proceed.promise;
    verified = true;
    return result;
  };
  f.fakeHasher.hash = (password) => {
    assert.equal(verified, true);
    replacementStarted = true;
    return hash(password);
  };
  const pending = f.post("password", {
    name: "Pilot1",
    currentPassword: "abcdefghij",
    newPassword: "replacement123",
  });
  await entered.promise;
  assert.equal(replacementStarted, false);
  proceed.resolve();
  assert.equal((await pending).status, 200);
  assert.equal(replacementStarted, true);
  assert.equal(admission.runs, 1);
});

Deno.test("malformed credential is a service fault without recording a password failure", async () => {
  const f = accountFixture(), claimed = await f.claim();
  f.repository.credentials.get(claimed.account.id)!.hash = "malformed";
  const response = await f.post("sign-in", credentials);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal(await errorCode(response), "ACCOUNT_SERVICE_UNAVAILABLE");
  assert.equal(f.events.includes("verified:false"), false);
});

Deno.test("sign-in survives optional rehash failure without leaking the raw failure", async () => {
  const f = accountFixture();
  await f.claim();
  f.fakeHasher.needsRehash = true;
  f.repository.rehash = () => Promise.reject(new Error("secret-raw-db-error"));
  const response = await f.post("sign-in", credentials);
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).accountToken, "string");
  assert.equal(JSON.stringify(f.logs).includes("secret-raw"), false);
});

Deno.test("four concurrent route hashes reject a fifth without recording a password failure", async () => {
  const f = accountFixture();
  await f.claim();
  const entered = Promise.withResolvers<void>(),
    proceed = Promise.withResolvers<void>();
  const verify = f.fakeHasher.verify.bind(f.fakeHasher);
  let active = 0;
  f.fakeHasher.verify = async (...args) => {
    if (++active === 4) entered.resolve();
    await proceed.promise;
    return await verify(...args);
  };
  const pending = Array.from(
    { length: 4 },
    () => f.post("sign-in", credentials),
  );
  await entered.promise;
  try {
    const fifth = await f.post("sign-in", credentials);
    assert.equal(fifth.status, 503);
    assert.equal(fifth.headers.get("Retry-After"), "2");
    assert.equal(await errorCode(fifth), "AUTH_BUSY");
    assert.equal(f.events.includes("verified:false"), false);
  } finally {
    proceed.resolve();
  }
  assert.deepEqual((await Promise.all(pending)).map((r) => r.status), [
    200,
    200,
    200,
    200,
  ]);
});

Deno.test("resume respects exact expiry/hour boundaries and does not replace the raw token", async () => {
  const f = accountFixture(), claimed = await f.claim();
  const original = [...f.repository.tokens.values()][0];
  f.repository.now += 3600000;
  const hourly = await f.post("resume", {}, null, claimed.accountToken);
  assert.equal(hourly.status, 200);
  assert.equal(
    (await hourly.json()).expiresAt,
    new Date(original.expires).toISOString(),
  );
  assert.equal(
    f.repository.tokens.get(original.id)!.lastUsed,
    original.lastUsed,
  );
  f.repository.now++;
  const renewed = await f.post("resume", {}, "s2", claimed.accountToken);
  const body = await renewed.json();
  assert.equal(body.link.sessionId, "session-s2");
  assert.equal("accountToken" in body, false);
  assert.equal(
    f.repository.tokens.get(original.id)!.lastUsed,
    f.repository.now,
  );
  assert.equal(Date.parse(body.expiresAt), f.repository.now + 90 * DAY);
  f.repository.now = Date.parse(body.expiresAt);
  const expired = await f.post("resume", {}, null, claimed.accountToken);
  assert.equal(await errorCode(expired), "ACCOUNT_TOKEN_EXPIRED");
});

Deno.test("logout revokes one token and sibling links, while reset/block revoke all", async () => {
  const f = accountFixture(), first = await f.claim();
  const second = await (await f.post("sign-in", credentials, "s2")).json();
  await f.post("resume", {}, "s3", first.accountToken);
  assert.equal(
    (await f.post("logout", {}, null, first.accountToken)).status,
    204,
  );
  assert.equal(f.repository.links.get("session-s1")!.detached !== null, true);
  assert.equal(f.repository.links.get("session-s3")!.detached !== null, true);
  assert.equal(
    (await f.post("resume", {}, null, second.accountToken)).status,
    200,
  );
  assert.equal(
    await errorCode(await f.post("resume", {}, null, first.accountToken)),
    "ACCOUNT_TOKEN_INVALID",
  );
  await f.repository.ownerTransition(first.account.id, { blocked: true });
  assert.equal(
    [...f.repository.tokens.values()].every((t) => t.revoked !== null),
    true,
  );
  assert.equal(
    [...f.repository.links.values()].every((l) => l.detached !== null),
    true,
  );
  assert.equal(
    (await f.post("logout", {}, null, second.accountToken)).status,
    204,
  );
  assert.equal(
    (await f.post("logout", {}, null, first.accountToken)).status,
    204,
  );
});

Deno.test("first-link conflicts serialize and roll back losing claims; same-account replacement is allowed", async () => {
  const f = accountFixture();
  const results = await Promise.all([
    f.post("claim", { ...credentials, preferences }),
    f.post("claim", { ...credentials, name: "Pilot2", preferences }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await errorCode(results.find((r) => r.status === 409)!),
    "SESSION_LINK_CONFLICT",
  );
  assert.equal(f.repository.accounts.size, 1);
  const winner = await results.find((r) => r.status === 201)!.json();
  const signed = await f.post("sign-in", {
    ...credentials,
    name: winner.account.displayName,
  });
  assert.equal(signed.status, 200);
  assert.equal(f.repository.tokens.size, 2);
  const g = accountFixture(),
    a = await g.claim("Pilot1", "s1"),
    b = await g.claim("Pilot2", "s2");
  const tokens = [...g.repository.tokens.values()];
  const links = await Promise.allSettled([
    g.repository.linkDirect("shared", a.account.id, tokens[0].id),
    g.repository.linkDirect("shared", b.account.id, tokens[1].id),
  ]);
  assert.equal(links.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (links.find((r) => r.status === "rejected") as PromiseRejectedResult).reason
      .code,
    "SESSION_LINK_CONFLICT",
  );
});

Deno.test("direct link helper independently rejects every invalid ID/token/account state", async () => {
  for (
    const invalid of [
      "account",
      "token",
      "ownership",
      "revoked",
      "expired",
      "version",
      "blocked",
    ]
  ) {
    const f = accountFixture(),
      a = await f.claim("Pilot1"),
      b = await f.claim("Pilot2", "s2");
    const token = [...f.repository.tokens.values()][0];
    let accountId = a.account.id, tokenId = token.id;
    if (invalid === "account") accountId = "missing";
    if (invalid === "token") tokenId = "missing";
    if (invalid === "ownership") accountId = b.account.id;
    if (invalid === "revoked") token.revoked = f.repository.now;
    if (invalid === "expired") token.expires = f.repository.now;
    if (invalid === "version") token.version = "2";
    if (invalid === "blocked") {
      f.repository.accounts.get(accountId)!.status = "blocked";
    }
    await assert.rejects(
      () => f.repository.linkDirect("fresh", accountId, tokenId),
      AccountFault,
    );
    assert.equal(f.repository.links.has("fresh"), false, invalid);
  }
});

Deno.test("expired/revoked bindings can be overwritten and a conflict rolls renewal back", async () => {
  for (const state of ["expired", "revoked"]) {
    const f = accountFixture(),
      first = await f.claim(),
      second = await f.claim("Pilot2", "s2");
    const old = [...f.repository.tokens.values()][0];
    if (state === "expired") old.expires = f.repository.now;
    else old.revoked = f.repository.now;
    const result = await f.post("resume", {}, "s1", second.accountToken);
    assert.equal(result.status, 200);
    assert.notEqual((await result.json()).link.accountId, first.account.id);
  }
  const f = accountFixture(),
    first = await f.claim(),
    second = await f.claim("Pilot2", "s2");
  const before = structuredClone([...f.repository.tokens.values()][0]);
  f.repository.now += 3600001;
  const response = await f.post("resume", {}, "s2", first.accountToken);
  assert.equal(await errorCode(response), "SESSION_LINK_CONFLICT");
  assert.deepEqual([...f.repository.tokens.values()][0], before);
  assert.equal(
    f.repository.links.get("session-s2")!.accountId,
    second.account.id,
  );
});

Deno.test("forced and voluntary password changes revoke old authority, preserve session and clear the flag", async () => {
  const f = accountFixture(), claimed = await f.claim();
  await f.repository.ownerTransition(claimed.account.id, {
    hash: f.fakeHasher.credential("temporary12345"),
  });
  const forced = await f.post("sign-in", {
    ...credentials,
    password: "temporary12345",
  });
  assert.equal(forced.status, 403);
  const required = await forced.json();
  assert.equal(required.error.code, "PASSWORD_CHANGE_REQUIRED");
  assert.equal("accountToken" in required, false);
  assert.equal(f.repository.tokens.size, 1);
  const changed = await f.post("password", {
    name: "Pilot1",
    currentPassword: "temporary12345",
    newPassword: "replacement123",
  });
  assert.equal(changed.status, 200);
  const fresh = await changed.json();
  assert.equal(fresh.link.sessionId, "session-s1");
  assert.equal(
    f.repository.credentials.get(claimed.account.id)!.mustChange,
    false,
  );
  assert.equal(f.repository.accounts.get(claimed.account.id)!.version, "3");
  assert.equal(
    (await f.post("resume", {}, null, fresh.accountToken)).status,
    200,
  );
  assert.equal(
    await errorCode(await f.post("resume", {}, null, claimed.accountToken)),
    "ACCOUNT_TOKEN_INVALID",
  );
  const voluntary = await f.post("password", {
    name: "Pilot1",
    currentPassword: "replacement123",
    newPassword: "anotherpass123",
  }, "s2");
  assert.equal(voluntary.status, 200);
  assert.equal(
    await errorCode(await f.post("resume", {}, null, fresh.accountToken)),
    "ACCOUNT_TOKEN_INVALID",
  );
});

Deno.test("password validation precedes verification, NFC equality follows verification, and conflicts are atomic", async () => {
  const f = accountFixture(),
    claimed = await f.claim("Pilot1", "s1", "é".repeat(10));
  const hashes = f.fakeHasher.hashCalls;
  const invalid = await f.post("password", {
    name: "Pilot1",
    currentPassword: "wrongxxxxx",
    newPassword: "short",
  });
  assert.equal(await errorCode(invalid), "INVALID_PASSWORD");
  assert.equal(f.fakeHasher.verifyCalls, 0);
  const unchanged = await f.post("password", {
    name: "Pilot1",
    currentPassword: "e\u0301".repeat(10),
    newPassword: "é".repeat(10),
  });
  assert.equal(await errorCode(unchanged), "PASSWORD_UNCHANGED");
  assert.equal(f.fakeHasher.hashCalls, hashes);
  await f.claim("Pilot2", "s2");
  const before = (await f.repository.readCredential("pilot1"))!;
  const result = await f.post("password", {
    name: "Pilot1",
    currentPassword: "é".repeat(10),
    newPassword: "replacement123",
  }, "s2");
  assert.equal(await errorCode(result), "SESSION_LINK_CONFLICT");
  assert.deepEqual(await f.repository.readCredential("pilot1"), before);
  assert.equal(
    (await f.post("resume", {}, null, claimed.accountToken)).status,
    200,
  );
});

Deno.test("exact bans override exceptions; contains exceptions never bypass reservation or ownership", async () => {
  const f = accountFixture();
  f.repository.rules = [{ kind: "banned", match: "contains", key: "bad" }];
  const body = { name: "Badger1", password: "abcdefghij", preferences };
  assert.equal(await errorCode(await f.post("claim", body)), "NAME_BANNED");
  f.repository.rules.push({
    kind: "exception",
    match: "exact",
    key: "badgeri",
  });
  const allowed = await f.post("claim", body);
  assert.equal(allowed.status, 201);
  assert.equal(
    await errorCode(await f.post("claim", { ...body, name: "badger1" }, "s2")),
    "NAME_TAKEN",
  );
  f.repository.rules.push({ kind: "banned", match: "exact", key: "badgeri" });
  const signed = await f.post("sign-in", {
    name: "Badger1",
    password: "abcdefghij",
  });
  assert.equal(await errorCode(signed), "NAME_BANNED");
  const reserved = accountFixture();
  reserved.repository.rules = [{
    kind: "reserved",
    match: "exact",
    key: "pilot1",
  }];
  assert.equal(
    await errorCode(
      await reserved.post("claim", { ...credentials, preferences }),
    ),
    "NAME_RESERVED",
  );
  assert.equal(
    await f.repository.identity(
      await tokenDigest((await allowed.json()).accountToken),
      "session-s1",
    ),
    null,
  );
});
