import { PLAYER_PREFERENCE_DEFAULTS, type PlayerPreferences } from '../preferences/playerPreferences';
import type {
  AccountApi, AccountEntryBody, AccountIdentity, AccountLink, AccountPreferences,
  AccountResult, AccountResumeBody, NameCheckBody, PreferencesBody,
} from './types';

const keys = Object.keys(PLAYER_PREFERENCE_DEFAULTS) as (keyof PlayerPreferences)[];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const name = /^[A-Za-z0-9]{3,20}$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isUtc = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const isDelay = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function preferences(value: unknown): AccountPreferences | null {
  if (!isObject(value) || !isObject(value.values) || Object.keys(value.values).length !== keys.length
    || keys.some((key) => typeof (value.values as Record<string, unknown>)[key] !== 'boolean')
    || typeof value.revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value.revision)
    || BigInt(value.revision) > 9223372036854775807n || !isUtc(value.updatedAt)) return null;
  return Object.freeze({
    values: Object.freeze(Object.fromEntries(keys.map((key) => [key, (value.values as PlayerPreferences)[key]])) as unknown as PlayerPreferences),
    revision: value.revision,
    updatedAt: value.updatedAt,
  });
}

function identity(value: unknown): AccountIdentity | null {
  if (!isObject(value) || typeof value.id !== 'string' || !uuid.test(value.id)
    || typeof value.displayName !== 'string' || !name.test(value.displayName) || value.badge !== 'claimed-name') return null;
  return Object.freeze({ id: value.id, displayName: value.displayName, badge: 'claimed-name' });
}

function link(value: unknown, account: AccountIdentity): AccountLink | null {
  if (!isObject(value) || typeof value.sessionId !== 'string' || !value.sessionId
    || typeof value.accountId !== 'string' || value.accountId.toLowerCase() !== account.id.toLowerCase()
    || value.displayName !== account.displayName) return null;
  return Object.freeze({ sessionId: value.sessionId, accountId: value.accountId, displayName: value.displayName });
}

function resumeBody(value: unknown, needsLink: boolean): AccountResumeBody | null {
  if (!isObject(value) || value.ok !== true || !isUtc(value.expiresAt)) return null;
  const account = identity(value.account), prefs = preferences(value.preferences);
  if (!account || !prefs) return null;
  const parsedLink = value.link === undefined ? undefined : link(value.link, account);
  if (parsedLink === null || (needsLink && !parsedLink)) return null;
  return { ok: true, account, preferences: prefs, expiresAt: value.expiresAt, ...(parsedLink ? { link: parsedLink } : {}) };
}

function entryBody(value: unknown): AccountEntryBody | null {
  const parsed = resumeBody(value, true);
  if (!parsed?.link || !isObject(value) || typeof value.accountToken !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(value.accountToken)) return null;
  return { ...parsed, link: parsed.link, accountToken: value.accountToken };
}

function preferencesBody(value: unknown): PreferencesBody | null {
  if (!isObject(value) || value.ok !== true) return null;
  const parsed = preferences(value.preferences);
  return parsed ? { ok: true, preferences: parsed } : null;
}

function nameBody(value: unknown): NameCheckBody | null {
  if (!isObject(value) || value.ok !== true || typeof value.displayName !== 'string' || !name.test(value.displayName)
    || value.nameKey !== value.displayName.toLowerCase()
    || !['available', 'claimed', 'banned', 'reserved'].includes(value.outcome as string)) return null;
  return { ok: true, nameKey: value.nameKey as string, displayName: value.displayName, outcome: value.outcome as NameCheckBody['outcome'] };
}

export function createAccountApi({ baseUrl, anonKey, fetch: fetchRequest, timeoutMs }: {
  baseUrl: string;
  anonKey: string;
  fetch: typeof fetch;
  timeoutMs: number;
}): AccountApi {
  async function request<T>(path: string, method: string, body: object | undefined,
    parse: (value: unknown) => T | null, successStatus = 200, accountToken?: string, sessionToken?: string,
  ): Promise<AccountResult<T>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const operation = async (): Promise<AccountResult<T>> => {
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${anonKey}`, apikey: anonKey };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (accountToken !== undefined) headers['X-Account-Token'] = accountToken;
        if (sessionToken !== undefined) headers['X-Session-Token'] = sessionToken;
        const response = await fetchRequest(`${baseUrl.replace(/\/+$/, '')}/accounts/${path}`, {
          method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal, cache: 'no-store',
        });
        const header = response.headers.get('Retry-After');
        const headerDelay = header !== null && /^\d+$/.test(header) && isDelay(Number(header)) ? Number(header) : undefined;
        const unavailable = { kind: 'unavailable' as const, ...(headerDelay === undefined ? {} : { retryAfterSeconds: headerDelay }) };
        if (response.status === 204 && successStatus === 204) return { kind: 'ok', data: undefined as T };
        let value: unknown;
        try { value = await response.json(); } catch { return unavailable; }
        if (response.ok) {
          const data = response.status === successStatus ? parse(value) : null;
          return data === null ? unavailable : { kind: 'ok', data };
        }
        if (!isObject(value) || value.ok !== false || !isObject(value.error)) return unavailable;
        const error = value.error;
        if (typeof error.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
          || typeof error.message !== 'string'
          || (error.field !== undefined && (typeof error.field !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.field)))) return unavailable;
        const delay = isDelay(error.retryAfterSeconds) ? error.retryAfterSeconds : headerDelay;
        const latest = error.code === 'PREFERENCE_CONFLICT' ? preferences(value.preferences) : undefined;
        if (latest === null) return unavailable;
        return {
          kind: 'error', code: error.code,
          ...(error.field === undefined ? {} : { field: error.field as string }),
          ...(delay === undefined ? {} : { retryAfterSeconds: delay }),
          ...(latest ? { preferences: latest } : {}),
        };
      } catch {
        // Never expose request credentials, response text or transport exceptions.
        return { kind: 'unavailable' };
      }
    };
    try {
      if (timeoutMs <= 0) return await operation();
      const timeout = new Promise<AccountResult<T>>((resolve) => {
        timer = globalThis.setTimeout(() => {
          resolve({ kind: 'unavailable' });
          controller.abort();
        }, timeoutMs);
      });
      return await Promise.race([operation(), timeout]);
    } finally {
      if (timer !== undefined) globalThis.clearTimeout(timer);
    }
  }

  return {
    nameCheck: (name) => request('name-check', 'POST', { name }, nameBody),
    claim: (input, sessionToken) => request('claim', 'POST', {
      name: input.name, password: input.password, turnstileToken: input.turnstileToken, preferences: input.preferences,
    }, entryBody, 201, undefined, sessionToken),
    signIn: (input, sessionToken) => request('sign-in', 'POST', {
      name: input.name, password: input.password, ...(input.turnstileToken === undefined ? {} : { turnstileToken: input.turnstileToken }),
    }, entryBody, 200, undefined, sessionToken),
    changePassword: (input, sessionToken) => request('password', 'POST', {
      name: input.name, currentPassword: input.currentPassword, newPassword: input.newPassword,
      ...(input.turnstileToken === undefined ? {} : { turnstileToken: input.turnstileToken }),
    }, entryBody, 200, undefined, sessionToken),
    resume: (accountToken, sessionToken) => request('resume', 'POST', {},
      (value) => resumeBody(value, sessionToken !== undefined), 200, accountToken, sessionToken),
    logout: (accountToken) => request<void>('logout', 'POST', {}, () => null, 204, accountToken),
    getPreferences: (accountToken) => request('preferences', 'GET', undefined, preferencesBody, 200, accountToken),
    putPreferences: (accountToken, patch, expectedRevision) => request('preferences', 'PUT', { patch, expectedRevision }, preferencesBody, 200, accountToken),
  };
}
