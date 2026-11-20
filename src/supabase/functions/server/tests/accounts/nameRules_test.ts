import assert from "node:assert/strict";
import {
  maskSafeSubstrings,
  matchingBans,
  type NameRule,
  nameRuleOutcome,
  rulePattern,
} from "../../accounts/nameRules.ts";
import { FakeAccountRepository } from "./fakeAccountRepository.ts";

Deno.test("name matcher handles repetitions, masking all occurrences and exact owner exceptions", () => {
  const rules: NameRule[] = [{
    kind: "banned",
    match_kind: "contains",
    match_key: "arse",
    safe_substrings: ["sparse"],
  }];
  assert.equal(nameRuleOutcome("sparsefox", rules), "available");
  assert.equal(nameRuleOutcome("sparsearse", rules), "banned");
  assert.equal(maskSafeSubstrings("aaaa", ["aaa"]), "####");
  assert.equal(
    maskSafeSubstrings("scunthorpecunt", ["scunthorpe"]),
    "##########cunt",
  );
  assert.equal(
    nameRuleOutcome("booooob", [{
      kind: "banned",
      match_kind: "exact",
      match_key: "boo*b",
    }]),
    "banned",
  );
  rules.push({
    kind: "exception",
    match_kind: "exact",
    match_key: "sparsearse",
  });
  assert.equal(nameRuleOutcome("sparsearse", rules), "available");
  rules.push({ kind: "banned", match_kind: "exact", match_key: "sparsearse" });
  assert.equal(nameRuleOutcome("sparsearse", rules), "banned");
  rules.pop();
  rules.push({
    kind: "reserved",
    match_kind: "exact",
    match_key: "sparsearse",
  });
  assert.equal(nameRuleOutcome("sparsearse", rules), "reserved");
  assert.throws(() => rulePattern("a**"));
  assert.throws(() => rulePattern("a|b"));
});

Deno.test("transactional Edge fake uses the set 03 matcher contract", async () => {
  const r = new FakeAccountRepository();
  r.rules.push({
    kind: "banned",
    match: "contains",
    key: "cu*n*t",
    safe_substrings: ["scunthorpe"],
  });
  assert.equal((await r.nameStatus("Scunthorpe")).outcome, "available");
  assert.equal((await r.nameStatus("ScunthorpeCunt")).outcome, "banned");
  assert.equal(
    matchingBans("cuuunt", [{
      kind: "banned",
      match_kind: "exact",
      match_key: "cu*n*t",
    }]).length,
    1,
  );
});
