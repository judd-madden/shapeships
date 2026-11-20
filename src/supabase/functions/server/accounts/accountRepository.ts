import type { AccountErrorCode } from "./accountResponses.ts";

export class AccountFault extends Error {
  readonly retryAfterSeconds?: number;
  constructor(
    readonly code: AccountErrorCode,
    readonly field?: string,
    retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "AccountFault";
    this.retryAfterSeconds = retryAfterSeconds ??
      (code === "ACCOUNT_SERVICE_UNAVAILABLE" || code === "CAPTCHA_UNAVAILABLE"
        ? 5
        : code === "AUTH_BUSY"
        ? 2
        : undefined);
  }
}

export interface AccountIdentity {
  id: string;
  displayName: string;
  badge: "claimed-name";
}
export interface PreferenceValues {
  soundEnabled: boolean;
  healthFlashEnabled: boolean;
  chatMinimized: boolean;
  battleLogPreferred: boolean;
  musicEnabled: boolean;
}
export interface AccountPreferences {
  values: PreferenceValues;
  revision: string;
  updatedAt: string;
}
export interface AccountLink {
  sessionId: string;
  accountId: string;
  displayName: string;
}
export interface AccountEntry {
  account: AccountIdentity;
  preferences: AccountPreferences;
  expiresAt: string;
  link?: AccountLink;
}
export interface CredentialSnapshot {
  accountId: string;
  displayName: string;
  securityVersion: string;
  passwordHash: string;
  passwordFormat: string;
  mustChangePassword: boolean;
}
export interface ClaimInput {
  displayName: string;
  nameKey: string;
  moderationKey: string;
  passwordHash: string;
  passwordFormat: string;
  tokenHash: Uint8Array;
  sessionId: string;
  preferences: PreferenceValues;
}
export interface AccountRepository {
  claim(input: ClaimInput): Promise<AccountEntry>;
  readCredential(nameKey: string): Promise<CredentialSnapshot | null>;
  finishSignin(
    snapshot: CredentialSnapshot,
    tokenHash: Uint8Array,
    sessionId: string,
  ): Promise<AccountEntry>;
  resume(tokenHash: Uint8Array, sessionId?: string): Promise<AccountEntry>;
  logout(tokenHash: Uint8Array): Promise<void>;
  changePassword(
    snapshot: CredentialSnapshot,
    passwordHash: string,
    passwordFormat: string,
    tokenHash: Uint8Array,
    sessionId: string,
  ): Promise<AccountEntry>;
  rehash(
    snapshot: CredentialSnapshot,
    passwordHash: string,
    passwordFormat: string,
  ): Promise<boolean>;
  identity(
    tokenHash: Uint8Array,
    sessionId: string,
  ): Promise<AccountIdentity | null>;
}

export interface AccountRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

const sqlErrors: Record<string, AccountErrorCode> = {
  P2201: "ACCOUNT_BLOCKED",
  P2202: "INVALID_CREDENTIALS",
  P2203: "INVALID_CREDENTIALS",
  P2204: "SESSION_LINK_CONFLICT",
  P2205: "PASSWORD_CHANGE_REQUIRED",
  P2206: "ACCOUNT_TOKEN_INVALID",
  P2207: "ACCOUNT_TOKEN_EXPIRED",
  P2208: "ACCOUNT_TOKEN_INVALID",
  P2209: "NAME_BANNED",
  P2210: "NAME_RESERVED",
};

// Never retain the raw error as a cause, message or logging field.
export function mapAccountDatabaseError(error: unknown): AccountFault {
  const e = error && typeof error === "object"
    ? error as Record<string, unknown>
    : {};
  if (e.code === "23505" && e.message === "ACCOUNT_NAME_TAKEN") {
    return new AccountFault("NAME_TAKEN");
  }
  return new AccountFault(
    typeof e.code === "string" && sqlErrors[e.code]
      ? sqlErrors[e.code]
      : "ACCOUNT_SERVICE_UNAVAILABLE",
  );
}

function fault(): never {
  throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fault();
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.length) fault();
  return value;
}
function uuid(value: unknown): string {
  const result = string(value);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result)) fault();
  return result;
}
function version(value: unknown): string {
  const result = string(value);
  if (
    !/^[1-9][0-9]{0,18}$/.test(result) || BigInt(result) > 9223372036854775807n
  ) fault();
  return result;
}
function iso(value: unknown): string {
  const result = string(value);
  if (
    !/^\d{4}-\d\d-\d\dT/.test(result) || !Number.isFinite(Date.parse(result))
  ) fault();
  return new Date(result).toISOString();
}
function name(value: unknown): string {
  const result = string(value);
  if (!/^[A-Za-z0-9]{3,20}$/.test(result)) fault();
  return result;
}
function identity(value: unknown): AccountIdentity {
  const row = object(value);
  if (row.badge !== "claimed-name") fault();
  return {
    id: uuid(row.id),
    displayName: name(row.displayName),
    badge: "claimed-name",
  };
}
function entry(value: unknown, sessionId?: string): AccountEntry {
  const row = object(value), p = object(row.preferences), v = object(p.values);
  const values = {} as PreferenceValues;
  for (
    const key of [
      "soundEnabled",
      "healthFlashEnabled",
      "chatMinimized",
      "battleLogPreferred",
      "musicEnabled",
    ] as const
  ) {
    if (typeof v[key] !== "boolean") fault();
    values[key] = v[key];
  }
  const result: AccountEntry = {
    account: identity(row.account),
    preferences: {
      values,
      revision: version(p.revision),
      updatedAt: iso(p.updatedAt),
    },
    expiresAt: iso(row.expiresAt),
  };
  if (sessionId !== undefined) {
    const link = object(row.link);
    result.link = {
      sessionId: string(link.sessionId),
      accountId: uuid(link.accountId),
      displayName: name(link.displayName),
    };
    if (
      result.link.sessionId !== sessionId ||
      result.link.accountId !== result.account.id ||
      result.link.displayName !== result.account.displayName
    ) fault();
  } else if (row.link !== undefined) fault();
  return result;
}
function bytea(bytes: Uint8Array): string {
  if (bytes.length !== 32) fault();
  return "\\x" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function expected(snapshot: CredentialSnapshot): Record<string, unknown> {
  return {
    p_account_id: snapshot.accountId,
    p_expected_security_version: snapshot.securityVersion,
    p_expected_password_hash: snapshot.passwordHash,
    p_expected_password_format: snapshot.passwordFormat,
  };
}

export function createAccountRepository(
  client: AccountRpcClient,
): AccountRepository {
  async function rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    let response;
    try {
      response = await client.rpc(name, args);
    } catch {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
    if (response.error) throw mapAccountDatabaseError(response.error);
    return response.data;
  }
  return {
    async claim(i) {
      return entry(
        await rpc("account_claim", {
          p_display_name: i.displayName,
          p_name_key: i.nameKey,
          p_moderation_key: i.moderationKey,
          p_password_hash: i.passwordHash,
          p_password_format: i.passwordFormat,
          p_token_hash: bytea(i.tokenHash),
          p_session_id: i.sessionId,
          p_sound_enabled: i.preferences.soundEnabled,
          p_health_flash_enabled: i.preferences.healthFlashEnabled,
          p_chat_minimized: i.preferences.chatMinimized,
          p_battle_log_preferred: i.preferences.battleLogPreferred,
          p_music_enabled: i.preferences.musicEnabled,
        }),
        i.sessionId,
      );
    },
    async readCredential(nameKey) {
      const result = await rpc("account_read_credential", {
        p_name_key: nameKey,
      });
      if (result === null) return null;
      const row = object(result);
      if (typeof row.mustChangePassword !== "boolean") fault();
      return {
        accountId: uuid(row.accountId),
        displayName: name(row.displayName),
        securityVersion: version(row.securityVersion),
        passwordHash: string(row.passwordHash),
        passwordFormat: string(row.passwordFormat),
        mustChangePassword: row.mustChangePassword,
      };
    },
    async finishSignin(s, hash, sessionId) {
      return entry(
        await rpc("account_finish_signin", {
          ...expected(s),
          p_token_hash: bytea(hash),
          p_session_id: sessionId,
        }),
        sessionId,
      );
    },
    async resume(hash, sessionId) {
      return entry(
        await rpc("account_resume", {
          p_token_hash: bytea(hash),
          p_session_id: sessionId ?? null,
        }),
        sessionId,
      );
    },
    async logout(hash) {
      await rpc("account_logout", { p_token_hash: bytea(hash) });
    },
    async changePassword(s, hash, format, token, sessionId) {
      return entry(
        await rpc("account_change_password", {
          ...expected(s),
          p_new_password_hash: hash,
          p_new_password_format: format,
          p_token_hash: bytea(token),
          p_session_id: sessionId,
        }),
        sessionId,
      );
    },
    async rehash(s, hash, format) {
      const result = await rpc("account_rehash", {
        ...expected(s),
        p_new_password_hash: hash,
        p_new_password_format: format,
      });
      if (typeof result !== "boolean") fault();
      return result;
    },
    async identity(hash, sessionId) {
      const result = await rpc("account_identity", {
        p_token_hash: bytea(hash),
        p_session_id: sessionId,
      });
      return result === null ? null : identity(result);
    },
  };
}
