import {
  decodeName,
  matchingBans,
  type NameRule,
  nameRuleOutcome,
  rulePattern,
} from "../../../../src/supabase/functions/server/accounts/nameRules.ts";

export interface SourceEntry {
  id: string;
  match: string;
  severity: number;
  tags: string[];
  allow_partial?: boolean;
  exceptions?: string[];
  notes?: string;
}
export interface SourceGroup {
  severity: number;
  tags: string[];
  notes?: string;
  dictionary: Array<Partial<SourceEntry> & Pick<SourceEntry, "id" | "match">>;
}
export interface SeedRule extends NameRule {
  source: string;
  note: string;
  safe_substrings: string[];
}
export const SOURCE_FILES = [
  "dsojevic-profanity-en.json",
  "dsojevic-profanity-src-en.json",
  "btrsco-reserved-usernames.json",
] as const;
export const MUST_PASS =
  "Cassandra Glassy Bassist Scunthorpe Essex Dickens Grape Therapist Assassin Classic Matsushita Hancock Cockpit Shuttlecock Penistone Sussex Pushkin Analyst Titanic Butterfly Peacock Skunk Sextant Document Pilot1 StarVoyager Raccoon Twinkling Sparsefox"
    .split(" ");
export const MUST_FAIL = [
  "Fuck",
  "Fuuuuck",
  "MyFuckingShip",
  "N1gg3r",
  "Sh1t",
  "S3x",
  "R4pe",
  "CuM",
  "Blowjob",
  "BallKicking",
];

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const join = (s: string) => s.toLowerCase().replace(/[ -]/g, "");
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const markdown = (s: string) =>
  s.replaceAll("|", "\\|").replace(/[\r\n]/g, " ");
const sorted = (s: Iterable<string>) => [...new Set(s)].sort(compare);

export function supplementEntries(
  built: SourceEntry[],
  groups: SourceGroup[],
): SourceEntry[] {
  const byId = new Map<string, SourceEntry[]>();
  for (const { dictionary, ...defaults } of groups) {
    for (const entry of dictionary) {
      const merged = { ...defaults, ...entry } as SourceEntry;
      byId.set(entry.id, [...byId.get(entry.id) ?? [], merged]);
    }
  }
  return built.map((entry) => {
    let candidates = byId.get(entry.id) ?? [];
    if (candidates.length > 1) {
      candidates = candidates.filter((x) =>
        x.match === entry.match && x.severity === entry.severity &&
        sorted(x.tags).join() === sorted(entry.tags).join()
      );
    }
    if (candidates.length !== 1) {
      throw new Error("Ambiguous or missing source metadata for " + entry.id);
    }
    return { ...candidates[0], ...entry };
  });
}

export function buildRules(
  entries: SourceEntry[],
  reserved: string[],
  hashes: readonly string[],
) {
  const rows = new Map<string, SeedRule>();
  const changes: string[] = [];
  const provenance = "seed03:" + SOURCE_FILES[0] + "@" +
    hashes[0].slice(0, 12) + "+" + SOURCE_FILES[1] + "@" +
    hashes[1].slice(0, 12);
  const reservedSource = "seed03:" + SOURCE_FILES[2] + "@" +
    hashes[2].slice(0, 12);
  const metadata = new Map<string, Set<string>>();
  for (const e of entries) {
    if (
      !Number.isInteger(e.severity) || e.severity < 1 || e.severity > 4 ||
      !Array.isArray(e.tags) || e.tags.some((tag) => typeof tag !== "string") ||
      (e.allow_partial !== undefined && typeof e.allow_partial !== "boolean") ||
      (e.exceptions !== undefined &&
        (!Array.isArray(e.exceptions) ||
          e.exceptions.some((s) => typeof s !== "string")))
    ) throw new Error("Invalid source entry: " + e.id);
    for (const original of e.match.split("|")) {
      const key = decodeName(join(original));
      const policy = e.severity >= 3 && e.allow_partial !== false
        ? "contains"
        : "exact";
      if (
        !/^(?:[a-z]\*?)+$/.test(key) || key.length > 64 ||
        key.replaceAll("*", "").length > 20 ||
        (policy === "exact" && key.length < 3 && !key.includes("*"))
      ) {
        changes.push("DROP " + e.id + ": " + original + " → " + key);
        continue;
      }
      rulePattern(key);
      if (key !== original) {
        changes.push("REWRITE " + e.id + ": " + original + " → " + key);
      }
      const safe: string[] = [];
      if (policy === "contains") {
        for (const exception of e.exceptions ?? []) {
          const value = decodeName(
            join(exception.replaceAll("*", original.replaceAll("*", ""))),
          );
          if (!/^[a-z]+$/.test(value) || value.length > 20) {
            changes.push(
              "DROP exception " + e.id + ": " + exception + " → " + value,
            );
            continue;
          }
          safe.push(value);
          changes.push("EXCEPTION " + e.id + ": " + exception + " → " + value);
        }
      }
      const rowKey = "banned:" + policy + ":" + key;
      const note = JSON.stringify({
        id: e.id,
        severity: e.severity,
        tags: sorted(e.tags),
        ...(e.notes ? { notes: e.notes } : {}),
        ...(e.allow_partial === false ? { allow_partial: false } : {}),
      });
      const notes = metadata.get(rowKey) ?? new Set<string>();
      notes.add(note);
      metadata.set(rowKey, notes);
      const prior = rows.get(rowKey);
      // Identical keys with different exception policies require an explicit review.
      if (
        prior &&
        JSON.stringify(prior.safe_substrings) !== JSON.stringify(sorted(safe))
      ) throw new Error("Conflicting duplicate exceptions: " + rowKey);
      rows.set(rowKey, {
        kind: "banned",
        match_kind: policy,
        match_key: key,
        safe_substrings: sorted(safe),
        source: provenance,
        note: sorted(notes).join("; "),
      });
    }
  }
  const marker = reserved.indexOf("#");
  if (
    marker < 0 || reserved[0] !== "_appspecific" ||
    reserved[marker - 1] !== "virallenses"
  ) throw new Error("Reserved Snapchat block changed; review required");
  const snapchat = reserved.slice(0, marker);
  for (const item of reserved.slice(marker)) {
    const key = item.toLowerCase();
    if (!/^[a-z0-9]{3,20}$/.test(key)) {
      changes.push("DROP reserved: " + item);
      continue;
    }
    if (key !== item) changes.push("REWRITE reserved: " + item + " → " + key);
    rows.set("reserved:" + key, {
      kind: "reserved",
      match_kind: "exact",
      match_key: key,
      safe_substrings: [],
      source: reservedSource,
      note: "Common system word reference: " + item,
    });
  }
  for (
    const key of [
      "system",
      "computer",
      "shapeships",
      "shapeship",
      "moderator",
      "official",
    ]
  ) {
    const rowKey = "reserved:" + key;
    rows.set(rowKey, {
      kind: "reserved",
      match_kind: "exact",
      match_key: key,
      safe_substrings: [],
      source: reservedSource,
      note: "Shapeships owner-approved system reservation",
    });
  }
  const rules = [...rows.values()].sort((a, b) =>
    compare(
      a.kind + ":" + a.match_kind + ":" + a.match_key,
      b.kind + ":" + b.match_kind + ":" + b.match_key,
    )
  );
  for (const r of rules) {
    if (r.note.length > 500 || r.source.length > 256) {
      throw new Error("Rule metadata exceeds schema bounds: " + r.match_key);
    }
  }
  const attribution = [...metadata.values()].map((notes) =>
    [...notes].map((note) =>
      JSON.parse(note) as Pick<SourceEntry, "severity" | "tags">
    )
  );
  return { rules, changes, snapchat, attribution };
}

export function seedSql(rules: SeedRule[]): string {
  return "-- Generated by sources/build-name-rules.ts; do not edit. Apply after 03-forward.sql.\nBEGIN;\nSET LOCAL lock_timeout = '2s';\nSELECT pg_catalog.pg_advisory_xact_lock(22002, 1);\n" +
    "DELETE FROM public.account_name_rules WHERE source LIKE 'seed03:dsojevic-profanity-en.json@%' OR source LIKE 'seed03:btrsco-reserved-usernames.json@%';\n" +
    "INSERT INTO public.account_name_rules(kind, match_kind, match_key, safe_substrings, source, note) VALUES\n" +
    rules.map((r) =>
      "(" +
      [
        quote(r.kind),
        quote(r.match_kind),
        quote(r.match_key),
        "ARRAY[" + r.safe_substrings.map(quote).join(",") + "]::text[]",
        quote(r.source),
        quote(r.note),
      ].join(",") + ")"
    ).join(",\n") +
    "\nON CONFLICT (kind, match_kind, match_key) DO NOTHING;\nCOMMIT;\n";
}

export function report(
  result: ReturnType<typeof buildRules>,
  entries: SourceEntry[],
  hashes: readonly string[],
): string {
  const { rules, changes, snapchat } = result;
  const lines = [
    "# Set 03 name-rule review",
    "",
    "Generated deterministically from local files. SQL remains authoritative. Tables below run the shared TypeScript contract matcher; PostgreSQL execution is deferred to the owner's PostgreSQL 17.6 mock and 03-verify.sql.",
    "",
    "## Inputs and policy",
    "",
  ];
  SOURCE_FILES.forEach((file, i) =>
    lines.push("- `" + file + "`: SHA-256 `" + hashes[i] + "`")
  );
  lines.push(
    "",
    "Built fields win; missing per-entry metadata is supplemented by ID from the grouped src file, with repeated IDs disambiguated by match/severity/tags. Severity 3–4 contains unless allow_partial=false; severity 1–2 exact. Source exceptions mask contains rules only. No owner exception is seeded.",
    "",
    "## Counts",
    "",
    "| Policy | Distinct rows |",
    "| --- | ---: |",
  );
  for (const kind of ["contains", "exact", "reserved"]) {
    lines.push(
      "| " + kind + " | " + rules.filter((r) =>
        kind === "reserved"
          ? r.kind === kind
          : r.kind === "banned" && r.match_kind === kind
      ).length + " |",
    );
  }
  lines.push(
    "",
    "Entry counts are before expansion/deduplication. Rule counts count distinct banned rows carrying that severity/tag; multi-attributed rows can appear in more than one category.",
    "",
    "| Severity | Entries | Seeded rules |",
    "| --- | ---: | ---: |",
  );
  for (let s = 1; s <= 4; s++) {
    lines.push(
      "| " + s + " | " + entries.filter((e) => e.severity === s).length +
        " | " + result.attribution.filter((row) =>
          row.some((a) => a.severity === s)
        ).length + " |",
    );
  }
  lines.push("", "| Tag | Entries | Seeded rules |", "| --- | ---: | ---: |");
  for (const tag of sorted(entries.flatMap((e) => e.tags))) {
    lines.push(
      "| " + tag + " | " + entries.filter((e) => e.tags.includes(tag)).length +
        " | " + result.attribution.filter((row) =>
          row.some((a) =>
            a.tags.includes(tag)
          )
        ).length + " |",
    );
  }
  lines.push(
    "",
    "## Must-pass innocent names",
    "",
    "PASS means available; a reservation is reported separately from moderation. No exceptions have been added to improve these results.",
    "",
    "| Name | Actual outcome | Review | Matching ban |",
    "| --- | --- | --- | --- |",
  );
  for (const name of MUST_PASS) {
    const outcome = nameRuleOutcome(name.toLowerCase(), rules);
    lines.push(
      "| " + name + " | " + outcome + " | " +
        (outcome === "available" ? "PASS" : "FAIL — owner review") + " | " +
        matchingBans(name.toLowerCase(), rules).map((r) =>
          "`" + r.match_key + "`"
        ).join(", ") + " |",
    );
  }
  lines.push(
    "",
    "## Must-fail abuse examples",
    "",
    "| Name | Actual outcome | Result |",
    "| --- | --- | --- |",
  );
  for (const name of MUST_FAIL) {
    const outcome = nameRuleOutcome(name.toLowerCase(), rules);
    lines.push(
      "| " + name + " | " + outcome + " | " +
        (outcome === "banned" ? "PASS" : "FAIL") + " |",
    );
  }
  const synthetic: NameRule = {
    kind: "banned",
    match_kind: "exact",
    match_key: "badword",
  };
  lines.push(
    "| B4dw0rd | " + nameRuleOutcome("b4dw0rd", [synthetic]) +
      " | PASS — synthetic badword rule only; not a production seed |",
    "",
    "## Proposed owner review",
    "",
  );
  for (
    const name of MUST_PASS.filter((n) =>
      nameRuleOutcome(n.toLowerCase(), rules) === "banned"
    )
  ) {
    lines.push(
      "- Proposed exact decoded owner exception `" + decodeName(name) +
        "` for " + name + "; not inserted.",
    );
  }
  for (
    const name of MUST_PASS.filter((n) =>
      nameRuleOutcome(n.toLowerCase(), rules) === "reserved"
    )
  ) {
    lines.push(
      "- " + name +
        " is reserved, not banned. An exception cannot release it; Judd must separately approve releasing reservation `" +
        name.toLowerCase() + "`.",
    );
  }
  lines.push(
    "",
    "## All reserved names",
    "",
    "Compact alphabetical listing for owner review:",
    "",
  );
  const reserved = rules.filter((r) => r.kind === "reserved").map((r) =>
    r.match_key
  ).sort(compare);
  for (const initial of sorted(reserved.map((s) => s[0]))) {
    lines.push(
      "**" + initial.toUpperCase() + ":** " +
        reserved.filter((s) => s[0] === initial).map((s) => "`" + s + "`").join(
          ", ",
        ),
      "",
    );
  }
  lines.push(
    "## Dropped Snapchat-specific block",
    "",
    snapchat.map((s) => "`" + s + "`").join(", "),
    "",
    "## Every rewrite, exception conversion and drop",
    "",
  );
  lines.push(
    ...changes.map((s) => "- " + markdown(s)),
    "",
    "## Cost and application",
    "",
    "About 1,100 rows per check; regexes contain only validated letters and repetition, names are at most 20 characters, and masking never joins fragments. No arbitrary source regex syntax is executed. Apply forward, seed, then verification. Generated-source conflicts preserve owner rows; inspect effective results after any owner customization.",
    "",
  );
  return lines.join("\n");
}

export async function generate() {
  const dir = new URL("./", import.meta.url);
  const bytes = await Promise.all(
    SOURCE_FILES.map((file) => Deno.readFile(new URL(file, dir))),
  );
  const hashes = await Promise.all(
    bytes.map(async (b) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", b)),
        (v) => v.toString(16).padStart(2, "0"),
      ).join("")
    ),
  );
  const parsed = bytes.map((b) => JSON.parse(new TextDecoder().decode(b)));
  const entries = supplementEntries(parsed[0], parsed[1]);
  const result = buildRules(entries, parsed[2], hashes);
  const sql = seedSql(result.rules), review = report(result, entries, hashes);
  await Deno.writeTextFile(new URL("../03-seed-name-rules.sql", dir), sql);
  await Deno.writeTextFile(new URL("name-rules-report.md", dir), review);
  console.info(
    "Generated",
    result.rules.length,
    "rules; SQL bytes",
    new TextEncoder().encode(sql).length,
  );
}
if (import.meta.main) await generate();
