import { AccountFault, type PreferenceValues } from "./accountRepository.ts";

export async function readAccountJson(
  request: Request,
  allowEmpty = false,
  cap = 8192,
): Promise<Record<string, unknown>> {
  const declared = request.headers.get("Content-Length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > cap) {
    throw new AccountFault("REQUEST_TOO_LARGE");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = request.body?.getReader();
  try {
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > cap) {
          void reader.cancel().catch(() => {});
          throw new AccountFault("REQUEST_TOO_LARGE");
        }
        chunks.push(chunk.value);
      }
    }
  } catch (error) {
    if (error instanceof AccountFault) throw error;
    throw new AccountFault("INVALID_REQUEST");
  } finally {
    reader?.releaseLock();
  }
  if (!length && allowEmpty) return {};
  if (
    !/^application\/json(?:\s*;.*)?$/i.test(
      request.headers.get("Content-Type")?.trim() ?? "",
    )
  ) {
    throw new AccountFault("UNSUPPORTED_MEDIA_TYPE");
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new AccountFault("INVALID_REQUEST");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AccountFault("INVALID_REQUEST");
  }
  return value as Record<string, unknown>;
}

export function requireFields(
  body: Record<string, unknown>,
  allowed: readonly string[],
): void {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new AccountFault("INVALID_REQUEST");
  }
}

export function claimPreferences(value: unknown): PreferenceValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AccountFault("INVALID_REQUEST", "preferences");
  }
  const row = value as Record<string, unknown>;
  const keys = [
    "soundEnabled",
    "healthFlashEnabled",
    "chatMinimized",
    "battleLogPreferred",
    "musicEnabled",
  ] as const;
  if (
    Object.keys(row).length !== keys.length ||
    keys.some((key) => typeof row[key] !== "boolean")
  ) {
    throw new AccountFault("INVALID_REQUEST", "preferences");
  }
  return Object.fromEntries(
    keys.map((key) => [key, row[key]]),
  ) as unknown as PreferenceValues;
}
