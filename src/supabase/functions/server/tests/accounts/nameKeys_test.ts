import assert from "node:assert/strict";
import { nameKeys } from "../../accounts/nameKeys.ts";

Deno.test("ASCII ownership remains distinct from moderation digit decoding", () => {
  assert.deepEqual(nameKeys("Pilot1"), {
    displayName: "Pilot1",
    nameKey: "pilot1",
    moderationKey: "piloti",
  });
  assert.equal(nameKeys("0123456789").moderationKey, "oizeasgtbg");
  assert.notEqual(nameKeys("Pilot1").nameKey, nameKeys("Piloti").nameKey);
  assert.equal(nameKeys("ABC").nameKey, nameKeys("abc").nameKey);
  for (
    const bad of [
      "ab",
      "a".repeat(21),
      " abc",
      "abc ",
      "a_b",
      "éabc",
      "Ａbc",
      null,
      1,
    ]
  ) {
    assert.throws(() => nameKeys(bad), { code: "INVALID_NAME" });
  }
});
