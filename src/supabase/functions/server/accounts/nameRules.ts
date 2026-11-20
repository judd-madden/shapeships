// Contract mirror for seed review and fake-backed tests. PostgreSQL is authoritative.
export interface NameRule {
  kind: "banned" | "reserved" | "exception";
  match_kind: "exact" | "contains";
  match_key: string;
  safe_substrings?: string[];
}

export const decodeName = (key: string): string =>
  key.toLowerCase().replace(/[0-9]/g, (digit) => "oizeasgtbg"[Number(digit)]);

export function rulePattern(key: string): string {
  if (!/^(?:[a-z]\*?)+$/.test(key) || key.length > 64) {
    throw new Error("Invalid moderation pattern");
  }
  return key.replaceAll("*", "+");
}

export function maskSafeSubstrings(
  name: string,
  safe: readonly string[],
): string {
  const masked = name.split("");
  for (const term of safe) {
    if (!/^[a-z]+$/.test(term)) throw new Error("Invalid safe substring");
    for (
      let at = name.indexOf(term);
      at >= 0;
      at = name.indexOf(term, at + 1)
    ) {
      masked.fill("#", at, at + term.length);
    }
  }
  return masked.join("");
}

export function matchingBans(
  nameKey: string,
  rules: readonly NameRule[],
): NameRule[] {
  const decoded = decodeName(nameKey);
  const excepted = rules.some((r) =>
    r.kind === "exception" && r.match_key === decoded
  );
  return rules.filter((r) => {
    if (r.kind !== "banned") return false;
    const pattern = rulePattern(r.match_key);
    if (r.match_kind === "exact") {
      return new RegExp("^(?:" + pattern + ")$").test(decoded);
    }
    return !excepted &&
      new RegExp(pattern).test(
        maskSafeSubstrings(decoded, r.safe_substrings ?? []),
      );
  });
}

export function nameRuleOutcome(
  nameKey: string,
  rules: readonly NameRule[],
): "available" | "banned" | "reserved" {
  if (matchingBans(nameKey, rules).length) return "banned";
  return rules.some((r) => r.kind === "reserved" && r.match_key === nameKey)
    ? "reserved"
    : "available";
}
