import type { Context } from "npm:hono";
import type { AccountPreferences } from "./accountRepository.ts";

// Locked contract: Phase 22 Account Design §2.5 and §2.13.
export const ACCOUNT_ERRORS = {
  ACCOUNTS_NOT_ENABLED: [503, "Accounts are not enabled."],
  ACCOUNT_SERVICE_UNAVAILABLE: [503, "Account service is unavailable."],
  INTERNAL_ERROR: [500, "Account request failed."],
  INVALID_REQUEST: [400, "Invalid account request."],
  REQUEST_TOO_LARGE: [413, "Account request is too large."],
  UNSUPPORTED_MEDIA_TYPE: [415, "JSON content is required."],
  INVALID_NAME: [400, "Use 3–20 ASCII letters or numbers."],
  INVALID_PASSWORD: [400, "Password does not meet the required format."],
  RATE_LIMITED: [429, "Too many requests. Try again later."],
  CAPTCHA_REQUIRED: [403, "Complete the verification challenge."],
  CAPTCHA_INVALID: [403, "Verification failed. Complete a fresh challenge."],
  CAPTCHA_REPLAY: [409, "Complete a fresh verification challenge."],
  CAPTCHA_UNAVAILABLE: [503, "Verification service is unavailable."],
  AUTH_BUSY: [503, "Sign-in service is busy. Try again later."],
  GAME_SESSION_INVALID: [401, "A valid game session is required."],
  ACCOUNT_TOKEN_REQUIRED: [401, "Account sign-in is required."],
  ACCOUNT_TOKEN_INVALID: [401, "Account sign-in is invalid."],
  ACCOUNT_TOKEN_EXPIRED: [401, "Account sign-in has expired."],
  ACCOUNT_BLOCKED: [403, "This account is blocked."],
  NAME_TAKEN: [409, "This name is already claimed."],
  NAME_BANNED: [403, "This name is not permitted."],
  NAME_RESERVED: [403, "This name is reserved."],
  CLAIMED_NAME_REQUIRES_ACCOUNT: [403, "Sign in to use this claimed name."],
  INVALID_CREDENTIALS: [401, "Name or password is incorrect."],
  PASSWORD_CHANGE_REQUIRED: [
    403,
    "Change your temporary password to continue.",
  ],
  PASSWORD_UNCHANGED: [400, "Choose a different new password."],
  SESSION_LINK_CONFLICT: [409, "This session is linked to another account."],
  PREFERENCE_CONFLICT: [409, "Account preferences have changed."],
  METHOD_NOT_ALLOWED: [405, "Account request method is not supported."],
  NOT_FOUND: [404, "Account route not found."],
} as const;

export type AccountErrorCode = keyof typeof ACCOUNT_ERRORS;

export interface AccountErrorOptions {
  field?: string;
  retryAfterSeconds?: number;
}

export interface AccountErrorEnvelope {
  ok: false;
  error: { code: AccountErrorCode; message: string } & AccountErrorOptions;
  preferences?: AccountPreferences;
}

export function setAccountResponseHeaders(
  c: Context,
  retryAfterSeconds?: number,
): void {
  if (
    retryAfterSeconds !== undefined &&
    (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 0)
  ) {
    throw new RangeError("Retry delay must be a nonnegative integer.");
  }
  c.header("Cache-Control", "no-store");
  c.header("Retry-After", retryAfterSeconds?.toString());
}

export function accountError(
  c: Context,
  code: AccountErrorCode,
  options: AccountErrorOptions = {},
  preferences?: AccountPreferences,
): Response {
  const [status, message] = ACCOUNT_ERRORS[code];
  setAccountResponseHeaders(c, options.retryAfterSeconds);
  const body: AccountErrorEnvelope = {
    ok: false,
    error: { code, message, ...options },
    ...(preferences ? { preferences } : {}),
  };
  return c.json(body, status);
}

export function accountSuccess(
  c: Context,
  value: object,
  status: 200 | 201 = 200,
): Response {
  setAccountResponseHeaders(c);
  return c.json({ ok: true, ...value }, status);
}

export function accountNoContent(c: Context): Response {
  setAccountResponseHeaders(c);
  return c.body(null, 204);
}
