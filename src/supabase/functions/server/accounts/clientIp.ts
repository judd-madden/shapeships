import { AccountFault } from "./accountRepository.ts";

export type IpSource = { mode: "development" } | { mode: "la13" } | {
  mode: "header";
  name: string;
};

export function parseIpSource(
  value: string | undefined,
  localTest: boolean,
): IpSource {
  if (value === "development" && localTest) return { mode: "development" };
  if (value === "la13") return { mode: "la13" };
  if (value?.startsWith("header:") && /^[a-zA-Z0-9-]+$/.test(value.slice(7))) {
    const name = value.slice(7).toLowerCase();
    if (
      !["authorization", "apikey", "x-account-token", "x-session-token"]
        .includes(name)
    ) return { mode: "header", name };
  }
  throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
}

function ipv4(value: string): string | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return null;
  const parts = value.split(".").map(Number);
  return parts.every((n) => n <= 255) ? parts.join(".") : null;
}

export function canonicalIp(value: string): string {
  const v4 = ipv4(value);
  if (v4) return "v4:" + v4;
  if (!/^[0-9a-fA-F:.]+$/.test(value) || !value.includes(":")) {
    throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  }
  let text = value.toLowerCase();
  if (text.includes(".")) {
    const last = text.lastIndexOf(":"), tail = ipv4(text.slice(last + 1));
    if (!tail) throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    const p = tail.split(".").map(Number);
    text = text.slice(0, last + 1) + ((p[0] << 8) | p[1]).toString(16) + ":" +
      ((p[2] << 8) | p[3]).toString(16);
  }
  if ((text.match(/::/g) ?? []).length > 1 || /:::/.test(text)) {
    throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  }
  const split = text.split("::");
  const left = split[0] ? split[0].split(":") : [];
  const right = split.length === 2 && split[1] ? split[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (
    (split.length === 1 && left.length !== 8) ||
    (split.length === 2 && missing < 1) ||
    [...left, ...right].some((s) => !/^[0-9a-f]{1,4}$/.test(s))
  ) throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  const words = [
    ...left,
    ...Array(split.length === 2 ? missing : 0).fill("0"),
    ...right,
  ].map((s) => parseInt(s, 16));
  if (words.slice(0, 5).every((n) => n === 0) && words[5] === 65535) {
    return "v4:" +
      [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(".");
  }
  return "v6:" +
    words.slice(0, 4).map((n) => n.toString(16).padStart(4, "0")).join(":") +
    "::/64";
}

export function clientIp(
  source: IpSource,
  headers: Headers,
): string | undefined {
  if (source.mode === "la13") return undefined;
  if (source.mode === "development") return "development";
  const value = headers.get(source.name);
  if (!value || value !== value.trim()) {
    throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  }
  return canonicalIp(value);
}
