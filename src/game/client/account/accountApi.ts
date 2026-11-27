import { PLAYER_PREFERENCE_DEFAULTS, type PlayerPreferences } from '../preferences/playerPreferences';
import type {
  AccountApi, AccountEntryBody, AccountIdentity, AccountLink, AccountPreferences,
  AccountResult, AccountResumeBody, NameCheckBody, PreferencesBody,
  AccountStreakApi, AccountStreakSnapshot, AccountStreakBody, AccountStreakImportBody,
  AccountMissionApi, AccountMissionBody,
} from './types';

const keys = Object.keys(PLAYER_PREFERENCE_DEFAULTS) as (keyof PlayerPreferences)[];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const name = /^[A-Za-z0-9]{3,20}$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isUtc = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const isDelay = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function missionBody(value: unknown): AccountMissionBody | null {
  if (!isObject(value) || value.ok !== true || !isObject(value.missionProgress)) return null;
  const progress = value.missionProgress;
  if (Object.keys(progress).length !== 2 || !['missions', 'findings'].every(key => {
    const ids = progress[key];
    return Array.isArray(ids) && ids.length <= 100
      && ids.every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id));
  })) return null;
  return { ok: true, missionProgress: Object.freeze({
    missions: Object.freeze([...(progress.missions as string[])]),
    findings: Object.freeze([...(progress.findings as string[])]),
  }) };
}

/** Mission progress needs account authority only; never link or renew a game session. */
export function createAccountMissionApi({ baseUrl, anonKey, fetch: fetchRequest, timeoutMs }: {
  baseUrl: string; anonKey: string; fetch: typeof fetch; timeoutMs: number;
}): AccountMissionApi {
  async function request(path: string, token: string, body?: object): Promise<AccountResult<AccountMissionBody>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const operation = async (): Promise<AccountResult<AccountMissionBody>> => {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${anonKey}`, apikey: anonKey, 'X-Account-Token': token,
        };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const response = await fetchRequest(`${baseUrl.replace(/\/+$/, '')}/accounts/missions/${path}`, {
          method: body === undefined ? 'GET' : 'POST', headers, cache: 'no-store', signal: controller.signal,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return await parseAccountResponse(response, missionBody);
      } catch { return { kind: 'unavailable' }; }
    };
    try {
      if (timeoutMs <= 0) return await operation();
      return await Promise.race([operation(), new Promise<AccountResult<AccountMissionBody>>(resolve => {
        timer = globalThis.setTimeout(() => { resolve({ kind: 'unavailable' }); controller.abort(); }, timeoutMs);
      })]);
    } finally { if (timer !== undefined) globalThis.clearTimeout(timer); }
  }
  return {
    state: token => request('state', token),
    add: (token, progress) => request('add', token, progress),
    reset: token => request('reset', token, {}),
  };
}

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

async function parseAccountResponse<T>(response: Response, parse: (value: unknown) => T | null,
  successStatus = 200): Promise<AccountResult<T>> {
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
  const streak = error.code === 'STREAK_CONFLICT' && value.streak !== undefined
    ? parseAccountStreakSnapshot(value.streak) : undefined;
  if (latest === null || streak === null) return unavailable;
  return {
    kind: 'error', code: error.code,
    ...(error.field === undefined ? {} : { field: error.field as string }),
    ...(delay === undefined ? {} : { retryAfterSeconds: delay }),
    ...(latest ? { preferences: latest } : {}),
    ...(streak ? { streak } : {}),
  };
}

export function parseAccountStreakSnapshot(value: unknown): AccountStreakSnapshot | null {
  if (!isObject(value) || typeof value.accountId !== 'string' || !uuid.test(value.accountId)
    || typeof value.runId !== 'string' || !uuid.test(value.runId)
    || !isDelay(value.currentCount) || typeof value.revision !== 'string'
    || !/^[1-9][0-9]{0,18}$/.test(value.revision) || BigInt(value.revision) > 9223372036854775807n
    || typeof value.updatedAt !== 'string'
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value.updatedAt)
    || !Number.isFinite(Date.parse(value.updatedAt))) return null;
  const tracked = value.trackedGame, ended = value.endedStreak;
  if (tracked !== null && (!isObject(tracked) || typeof tracked.gameId !== 'string' || !tracked.gameId
    || typeof tracked.humanPlayerId !== 'string' || !tracked.humanPlayerId
    || !['unfinished', 'settled', 'retired', 'restart_pending'].includes(tracked.status as string))) return null;
  if (ended !== null && (!isObject(ended) || !isDelay(ended.count) || ended.count === 0
    || typeof ended.endingGameId !== 'string' || !ended.endingGameId)) return null;
  return Object.freeze({ accountId: value.accountId, runId: value.runId, currentCount: value.currentCount,
    revision: value.revision, updatedAt: value.updatedAt,
    trackedGame: tracked === null ? null : Object.freeze({ gameId: tracked.gameId as string,
      humanPlayerId: tracked.humanPlayerId as string, status: tracked.status as NonNullable<AccountStreakSnapshot['trackedGame']>['status'] }),
    endedStreak: ended === null ? null : Object.freeze({ count: ended.count as number, endingGameId: ended.endingGameId as string }) });
}

function streakBody(value: unknown): AccountStreakBody | null {
  if (!isObject(value) || value.ok !== true) return null;
  const streak = parseAccountStreakSnapshot(value.streak);
  return streak ? { ok: true, streak } : null;
}
function streakImportBody(value: unknown): AccountStreakImportBody | null {
  const parsed = streakBody(value);
  if (!parsed || !isObject(value) || !isObject(value.import)) return null;
  const outcome = value.import;
  if (typeof outcome.anchorGameId !== 'string' || !outcome.anchorGameId
    || !['guest', 'account', 'declined'].includes(outcome.selection as string) || !isDelay(outcome.acceptedCount)
    || !['none', 'authorised'].includes(outcome.continuation as string)) return null;
  return { ...parsed, import: { anchorGameId: outcome.anchorGameId,
    selection: outcome.selection as AccountStreakImportBody['import']['selection'], acceptedCount: outcome.acceptedCount,
    continuation: outcome.continuation as AccountStreakImportBody['import']['continuation'] } };
}

/** The session runtime owns A/S headers and linking; these operations never replay mutations. */
export function createAccountStreakApi(authenticatedFetch: (
  endpoint: string, options?: RequestInit, timeoutMs?: number,
) => Promise<Response>): AccountStreakApi {
  async function request<T>(path: string, body: object, parse: (value: unknown) => T | null): Promise<AccountResult<T>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async (): Promise<AccountResult<T>> => {
      try {
        const response = await authenticatedFetch('/accounts/streak/' + path, {
          method: 'POST', body: JSON.stringify(body), cache: 'no-store', signal: controller.signal,
        }, 8000);
        const result = await parseAccountResponse(response, parse);
        if (response.status >= 500) return { kind: 'unavailable',
          ...('retryAfterSeconds' in result ? { retryAfterSeconds: result.retryAfterSeconds } : {}) };
        return result;
      } catch { return { kind: 'unavailable' }; }
    };
    try {
      return await Promise.race([operation(), new Promise<AccountResult<T>>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve({ kind: 'unavailable' }); }, 8000);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  return {
    state: () => request('state', {}, streakBody),
    import: (input) => request('import', input, streakImportBody),
    reset: (expectedRevision) => request('reset', { expectedRevision }, streakBody),
  };
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
        return await parseAccountResponse(response, parse, successStatus);
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
