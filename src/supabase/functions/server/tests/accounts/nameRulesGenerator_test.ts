import assert from "node:assert/strict";
import {
  buildRules,
  MUST_FAIL,
  MUST_PASS,
  report,
  seedSql,
  SOURCE_FILES,
  supplementEntries,
} from "../../../../../../supabase/manual/account/sources/build-name-rules.ts";
import { nameRuleOutcome } from "../../accounts/nameRules.ts";

Deno.test("generator supplements missing flags, preserves built fields and disambiguates repeated IDs", () => {
  const group = {
    severity: 3,
    tags: ["sexual"],
    dictionary: [{ id: "sex", match: "sex", allow_partial: false }],
  };
  const [entry] = supplementEntries([{
    id: "sex",
    match: "sex",
    severity: 3,
    tags: ["sexual"],
  }], [group]);
  assert.equal(entry.allow_partial, false);
  assert.equal(
    supplementEntries([{ ...entry, allow_partial: true }], [group])[0]
      .allow_partial,
    true,
  );
  assert.throws(() => supplementEntries([entry], [group, group]), /Ambiguous/);
  const entries = [entry, {
    id: "test",
    match: "ball kicking|ball-kicking|boo*b|bad.word",
    severity: 1,
    tags: ["test"],
  }, {
    id: "arse",
    match: "arse",
    severity: 4,
    tags: ["test"],
    exceptions: ["sp*"],
  }];
  const result = buildRules(entries, [
    "_appspecific",
    "virallenses",
    "#",
    "Document",
  ], ["a".repeat(64), "b".repeat(64), "c".repeat(64)]);
  assert.equal(
    result.rules.find((r) => r.match_key === "sex")?.match_kind,
    "exact",
  );
  assert.equal(
    result.rules.filter((r) => r.match_key === "ballkicking").length,
    1,
  );
  assert.equal(nameRuleOutcome("booooob", result.rules), "banned");
  assert.equal(nameRuleOutcome("sparsefox", result.rules), "available");
  assert.equal(nameRuleOutcome("sparsearse", result.rules), "banned");
  assert.ok(result.changes.some((s) => s.includes("DROP test: bad.word")));
});

Deno.test("local source generation matches committed outputs and all review tables", async () => {
  const root = new URL(
    "../../../../../../supabase/manual/account/",
    import.meta.url,
  );
  const bytes = await Promise.all(
    SOURCE_FILES.map((f) => Deno.readFile(new URL("sources/" + f, root))),
  );
  const hashes = await Promise.all(
    bytes.map(async (b) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", b)),
        (v) => v.toString(16).padStart(2, "0"),
      ).join("")
    ),
  );
  const data = bytes.map((b) => JSON.parse(new TextDecoder().decode(b)));
  const entries = supplementEntries(data[0], data[1]);
  assert.equal(entries.length, 434);
  const result = buildRules(entries, data[2], hashes);
  assert.equal(result.rules.length, 1096);
  assert.equal(
    result.rules.filter((r) =>
      r.kind === "banned" && r.match_kind === "contains"
    ).length,
    520,
  );
  assert.equal(
    result.rules.filter((r) => r.kind === "banned" && r.match_kind === "exact")
      .length,
    107,
  );
  assert.equal(result.rules.filter((r) => r.kind === "reserved").length, 469);
  for (const name of MUST_PASS) {
    assert.equal(
      nameRuleOutcome(name.toLowerCase(), result.rules),
      name === "Therapist"
        ? "banned"
        : name === "Document"
        ? "reserved"
        : "available",
      name,
    );
  }
  for (const name of MUST_FAIL) {
    assert.equal(
      nameRuleOutcome(name.toLowerCase(), result.rules),
      "banned",
      name,
    );
  }
  assert.equal(nameRuleOutcome("b4dw0rd", result.rules), "available");
  const review = report(result, entries, hashes);
  assert.equal(
    seedSql(result.rules),
    await Deno.readTextFile(new URL("03-seed-name-rules.sql", root)),
  );
  assert.equal(
    review,
    await Deno.readTextFile(new URL("sources/name-rules-report.md", root)),
  );
  for (const r of result.rules.filter((r) => r.kind === "reserved")) {
    assert.ok(review.includes("`" + r.match_key + "`"));
  }
  for (const s of result.snapchat) assert.ok(review.includes("`" + s + "`"));
});
