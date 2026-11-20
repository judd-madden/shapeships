import { AccountFault } from "./accountRepository.ts";

export const PASSWORD_FORMAT = "nfc-argon2id-v1";

export function normalizePassword(value: unknown, field = "password"): string {
  if (typeof value !== "string") {
    throw new AccountFault("INVALID_REQUEST", field);
  }
  // Check UTF-16 before NFC/TextEncoder can replace lone surrogates.
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new AccountFault("INVALID_PASSWORD", field);
      }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new AccountFault("INVALID_PASSWORD", field);
    }
  }
  const normalized = value.normalize("NFC");
  const points = Array.from(normalized).length;
  if (
    points < 10 || points > 128 ||
    new TextEncoder().encode(normalized).length > 512
  ) {
    throw new AccountFault("INVALID_PASSWORD", field);
  }
  return normalized;
}
