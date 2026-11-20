import { argon2id } from "npm:hash-wasm@4.12.0";
import { timingSafeEqual } from "node:crypto";
import { AccountFault } from "./accountRepository.ts";
import { normalizePassword, PASSWORD_FORMAT } from "./passwordPolicy.ts";
import { type RandomBytes, secureRandomBytes } from "./tokens.ts";

const costs = {
  memorySize: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
} as const;
const phc =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;

export interface PasswordHasher {
  hash(normalized: string): Promise<string>;
  verify(
    normalized: string,
    encoded: string,
    format: string,
  ): Promise<{ matches: boolean; needsRehash: boolean }>;
}

function decode(value: string, length: number): Uint8Array {
  const decoded = Uint8Array.from(
    atob(value + "=".repeat((4 - value.length % 4) % 4)),
    (c) => c.charCodeAt(0),
  );
  if (
    decoded.length !== length ||
    btoa(String.fromCharCode(...decoded)).replace(/=+$/, "") !== value
  ) {
    throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  }
  return decoded;
}

export function createPasswordHasher(
  random: RandomBytes = secureRandomBytes,
): PasswordHasher {
  return {
    async hash(normalized) {
      const password = normalizePassword(normalized);
      const salt = random(16);
      if (salt.length !== 16) throw new AccountFault("INTERNAL_ERROR");
      return await argon2id({
        ...costs,
        password,
        salt,
        outputType: "encoded",
      });
    },
    async verify(normalized, encoded, format) {
      const match = typeof encoded === "string" ? phc.exec(encoded) : null;
      if (format !== PASSWORD_FORMAT || !match) {
        throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
      }
      const salt = decode(match[1], 16), expected = decode(match[2], 32);
      // Never use argon2Verify: it accepts cost parameters from the PHC string.
      const actual = await argon2id({
        ...costs,
        password: normalizePassword(normalized),
        salt,
        outputType: "binary",
      });
      return { matches: timingSafeEqual(actual, expected), needsRehash: false };
    },
  };
}
