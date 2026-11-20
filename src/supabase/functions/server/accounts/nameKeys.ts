import { AccountFault } from "./accountRepository.ts";

export function nameKeys(
  value: unknown,
): { displayName: string; nameKey: string; moderationKey: string } {
  if (typeof value !== "string" || !/^[A-Za-z0-9]{3,20}$/.test(value)) {
    throw new AccountFault("INVALID_NAME", "name");
  }
  const nameKey = value.toLowerCase();
  const digits = "oizeasgtbg";
  return {
    displayName: value,
    nameKey,
    moderationKey: nameKey.replace(/[0-9]/g, (digit) => digits[Number(digit)]),
  };
}
