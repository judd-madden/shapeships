import { AccountFault } from "./accountRepository.ts";

export type RandomBytes = (length: number) => Uint8Array;
export const secureRandomBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));

export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(
    /\//g,
    "_",
  ).replace(/=+$/, "");
}

export async function tokenDigest(token: string): Promise<Uint8Array> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new AccountFault("ACCOUNT_TOKEN_INVALID");
  }
  const decoded = Uint8Array.from(
    atob(token.replace(/-/g, "+").replace(/_/g, "/") + "="),
    (c) => c.charCodeAt(0),
  );
  if (decoded.length !== 32 || base64url(decoded) !== token) {
    throw new AccountFault("ACCOUNT_TOKEN_INVALID");
  }
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  );
}

export async function issueToken(
  random: RandomBytes = secureRandomBytes,
): Promise<{ raw: string; hash: Uint8Array }> {
  const bytes = random(32);
  if (bytes.length !== 32) throw new AccountFault("INTERNAL_ERROR");
  const raw = base64url(bytes);
  return { raw, hash: await tokenDigest(raw) };
}
