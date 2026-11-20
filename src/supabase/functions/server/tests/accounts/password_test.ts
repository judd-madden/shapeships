import assert from "node:assert/strict";
import {
  normalizePassword,
  PASSWORD_FORMAT,
} from "../../accounts/passwordPolicy.ts";
import { createPasswordHasher } from "../../accounts/passwordHashing.ts";
import { AccountFault } from "../../accounts/accountRepository.ts";

Deno.test("password policy counts NFC code points, preserves whitespace and rejects malformed UTF-16", () => {
  for (const n of [9, 129]) {
    assert.throws(() => normalizePassword("a".repeat(n)), {
      code: "INVALID_PASSWORD",
    });
  }
  for (const n of [10, 128]) {
    assert.equal(normalizePassword("a".repeat(n)), "a".repeat(n));
  }
  assert.equal(normalizePassword("😀".repeat(128)), "😀".repeat(128)); // 512 bytes exactly.
  assert.throws(() => normalizePassword("😀".repeat(128) + "a"), {
    code: "INVALID_PASSWORD",
  });
  assert.equal(normalizePassword("e\u0301".repeat(10)), "é".repeat(10));
  assert.throws(() => normalizePassword("e\u0301".repeat(9)), {
    code: "INVALID_PASSWORD",
  });
  assert.equal(normalizePassword("①".repeat(10)), "①".repeat(10)); // NFC, not compatibility folding.
  assert.equal(normalizePassword("  abcdefgh  "), "  abcdefgh  ");
  for (
    const invalid of [
      "abcdefghij\ud800",
      "\udc00abcdefghij",
      "abc\ud800xdefghij",
    ]
  ) {
    assert.throws(() => normalizePassword(invalid), {
      code: "INVALID_PASSWORD",
    });
  }
  assert.throws(() => normalizePassword(42), { code: "INVALID_REQUEST" });
  assert.throws(() => normalizePassword("x".repeat(129), "newPassword"), {
    field: "newPassword",
  });
});

Deno.test("real pinned Argon2 round-trip and replacement use only the locked policy", async () => {
  let salt = 0;
  const hasher = createPasswordHasher((n) => new Uint8Array(n).fill(++salt));
  const started = performance.now();
  const encoded = await hasher.hash("abcdefghij");
  const hashMs = performance.now() - started;
  assert.match(encoded, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.deepEqual(
    await hasher.verify("abcdefghij", encoded, PASSWORD_FORMAT),
    { matches: true, needsRehash: false },
  );
  assert.equal(
    (await hasher.verify("abcdefghik", encoded, PASSWORD_FORMAT)).matches,
    false,
  );
  const replacement = await hasher.hash("abcdefghij");
  assert.notEqual(replacement, encoded);
  assert.equal(
    (await hasher.verify("abcdefghij", replacement, PASSWORD_FORMAT)).matches,
    true,
  );
  for (
    const bad of [
      encoded.replace("m=19456", "m=1048576"),
      encoded.replace("t=2", "t=1"),
      encoded.replace("p=1", "p=2"),
      encoded.replace("v=19", "v=16"),
      encoded.replace("argon2id", "argon2i"),
      encoded + "=",
      "malformed",
      encoded.replace(/\$[^$]+$/, "$AAAA"),
    ]
  ) {
    await assert.rejects(
      () => hasher.verify("abcdefghij", bad, PASSWORD_FORMAT),
      AccountFault,
    );
  }
  await assert.rejects(() => hasher.verify("abcdefghij", encoded, "other"), {
    code: "ACCOUNT_SERVICE_UNAVAILABLE",
  });
  console.log(
    "Local synthetic single-hash wall time (not hosted CPU): " +
      hashMs.toFixed(1) + " ms",
  );
});
