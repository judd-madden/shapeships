import assert from "node:assert/strict";
import { base64url, issueToken, tokenDigest } from "../../accounts/tokens.ts";

Deno.test("opaque tokens are 32 bytes with canonical base64url and SHA-256 of encoded token", async () => {
  const token = await issueToken((n) =>
    Uint8Array.from({ length: n }, (_, i) => i)
  );
  assert.equal(token.raw.length, 43);
  assert.match(token.raw, /^[A-Za-z0-9_-]+$/);
  assert.equal(token.hash.length, 32);
  assert.deepEqual(
    token.hash,
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(token.raw),
      ),
    ),
  );
  assert.deepEqual(await tokenDigest(token.raw), token.hash);
  assert.notDeepEqual(
    token.hash,
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        Uint8Array.from({ length: 32 }, (_, i) => i),
      ),
    ),
  );
  for (
    const bad of [
      "",
      "x",
      token.raw + "=",
      token.raw.slice(0, -1) + "B",
      "A".repeat(42) + "+",
    ]
  ) {
    await assert.rejects(() => tokenDigest(bad), {
      code: "ACCOUNT_TOKEN_INVALID",
    });
  }
  assert.equal(base64url(new Uint8Array(32)).length, 43);
  await assert.rejects(() => issueToken(() => new Uint8Array(31)), {
    code: "INTERNAL_ERROR",
  });
});
