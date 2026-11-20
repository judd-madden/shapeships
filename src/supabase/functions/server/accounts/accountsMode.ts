export type AccountsMode = "off" | "names-only" | "on";

export function parseAccountsMode(
  value: string | undefined,
  warn: (message: string) => void = console.warn,
): AccountsMode {
  if (value === undefined) return "off";
  if (value === "off" || value === "names-only" || value === "on") {
    return value;
  }
  warn("Invalid ACCOUNTS_MODE; accounts are off.");
  return "off";
}

// Module evaluation happens once per worker. No account secrets are read here.
export const accountsMode = parseAccountsMode(Deno.env.get("ACCOUNTS_MODE"));
