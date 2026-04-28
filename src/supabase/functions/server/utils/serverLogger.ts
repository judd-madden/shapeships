export const SERVER_DEBUG_LOGS_ENABLED =
  Deno.env.get("ENABLE_SERVER_DEBUG_LOGS") === "true";

export function debugLog(...args: unknown[]): void {
  if (!SERVER_DEBUG_LOGS_ENABLED) return;
  console.log(...args);
}
