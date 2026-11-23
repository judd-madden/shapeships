import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccountApi } from '../../account/accountApi';
import type { AccountApi, AccountEntryBody } from '../../account/types';
import {
  ANON_KEY, BASE_URL, SESSION_TOKEN, TOKEN, cleanup, entry, envelope, error, json, resumed,
} from './fixtures';

afterEach(cleanup);

function setup(response: Response | (() => Promise<Response>)) {
  const fetchMock = vi.fn<typeof fetch>(typeof response === 'function' ? response : async () => response);
  const api = createAccountApi({ baseUrl: `${BASE_URL}/`, anonKey: ANON_KEY, fetch: fetchMock, timeoutMs: 50 });
  return { api, fetchMock };
}
const credentials = { name: 'Pilot1', password: 'synthetic-password', turnstileToken: 'captcha-proof' };
const routes: { route: string; status: number; body: unknown; call: (api: AccountApi) => Promise<unknown>; session?: boolean; account?: boolean; method?: string; request?: unknown }[] = [
  { route: 'name-check', status: 200, body: { ok: true, nameKey: 'pilot1', displayName: 'Pilot1', outcome: 'available' }, call: (api) => api.nameCheck('Pilot1'), request: { name: 'Pilot1' } },
  { route: 'claim', status: 201, body: entry(), call: (api) => api.claim({ ...credentials, preferences: envelope().values }, SESSION_TOKEN), session: true, request: { ...credentials, preferences: envelope().values } },
  { route: 'sign-in', status: 200, body: entry(), call: (api) => api.signIn(credentials, SESSION_TOKEN), session: true, request: credentials },
  { route: 'password', status: 200, body: entry(), call: (api) => api.changePassword({ name: 'Pilot1', currentPassword: 'old-password', newPassword: 'new-password' }, SESSION_TOKEN), session: true, request: { name: 'Pilot1', currentPassword: 'old-password', newPassword: 'new-password' } },
  { route: 'resume', status: 200, body: resumed(), call: (api) => api.resume(TOKEN), account: true, request: {} },
  { route: 'resume', status: 200, body: resumed(true), call: (api) => api.resume(TOKEN, SESSION_TOKEN), session: true, account: true, request: {} },
  { route: 'logout', status: 204, body: undefined, call: (api) => api.logout(TOKEN), account: true, request: {} },
  { route: 'logout', status: 204, body: undefined, call: (api) => api.logout(), request: {} },
  { route: 'preferences', status: 200, body: { ok: true, preferences: envelope() }, call: (api) => api.getPreferences(TOKEN), method: 'GET', account: true },
  { route: 'preferences', status: 200, body: { ok: true, preferences: envelope('9007199254740993') }, call: (api) => api.putPreferences(TOKEN, { musicEnabled: false }, '9007199254740992'), method: 'PUT', account: true, request: { patch: { musicEnabled: false }, expectedRevision: '9007199254740992' } },
];

describe('account API contract', () => {
  it.each(routes)('$route $method validates success and sends only the route headers/body', async (test) => {
    const response = test.status === 204 ? new Response(null, { status: 204 }) : json(test.body, test.status);
    const { api, fetchMock } = setup(response);
    expect(await test.call(api)).toEqual({ kind: 'ok', data: test.body });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/accounts/${test.route}`);
    expect(String(url)).not.toContain(TOKEN);
    expect(init?.method).toBe(test.method ?? 'POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${ANON_KEY}`);
    expect(headers.get('apikey')).toBe(ANON_KEY);
    expect(headers.get('X-Account-Token')).toBe(test.account ? TOKEN : null);
    expect(headers.get('X-Session-Token')).toBe(test.session ? SESSION_TOKEN : null);
    expect(headers.get('Content-Type')).toBe(test.request === undefined ? null : 'application/json');
    expect(init?.cache).toBe('no-store');
    expect(init?.body === undefined ? undefined : JSON.parse(String(init.body))).toEqual(test.request);
  });

  it.each(['available', 'claimed', 'banned', 'reserved'])('retains successful lookup outcome %s', async (outcome) => {
    const { api } = setup(json({ ok: true, nameKey: 'pilot1', displayName: 'Pilot1', outcome }));
    expect(await api.nameCheck('pilot1')).toMatchObject({ kind: 'ok', data: { outcome, displayName: 'Pilot1' } });
  });

  it.each([
    ['ACCOUNTS_NOT_ENABLED', 503], ['ACCOUNT_SERVICE_UNAVAILABLE', 503], ['INTERNAL_ERROR', 500],
    ['INVALID_REQUEST', 400], ['REQUEST_TOO_LARGE', 413], ['UNSUPPORTED_MEDIA_TYPE', 415],
    ['INVALID_NAME', 400], ['INVALID_PASSWORD', 400], ['RATE_LIMITED', 429],
    ['CAPTCHA_REQUIRED', 403], ['CAPTCHA_INVALID', 403], ['CAPTCHA_REPLAY', 409], ['CAPTCHA_UNAVAILABLE', 503],
    ['AUTH_BUSY', 503], ['GAME_SESSION_INVALID', 401], ['ACCOUNT_TOKEN_REQUIRED', 401],
    ['ACCOUNT_TOKEN_INVALID', 401], ['ACCOUNT_TOKEN_EXPIRED', 401], ['ACCOUNT_BLOCKED', 403],
    ['NAME_TAKEN', 409], ['NAME_BANNED', 403], ['NAME_RESERVED', 403], ['INVALID_CREDENTIALS', 401],
    ['SESSION_LINK_CONFLICT', 409], ['PASSWORD_CHANGE_REQUIRED', 403], ['PASSWORD_UNCHANGED', 400],
    ['METHOD_NOT_ALLOWED', 405], ['NOT_FOUND', 404],
  ] as const)('preserves application error %s', async (code, status) => {
    const { api, fetchMock } = setup(error(code, status, { field: 'password' }));
    expect(await api.signIn(credentials, SESSION_TOKEN)).toEqual({ kind: 'error', code, field: 'password' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [7, '11', 7], [0, '11', 0], [undefined, '11', 11], [-1, '11', 11], [2.5, '11', 11],
    [undefined, 'tomorrow', undefined], [undefined, '-1', undefined], [undefined, '1.5', undefined],
  ])('uses body delay %s before header %s', async (bodyDelay, header, expected) => {
    const { api } = setup(json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Wait', retryAfterSeconds: bodyDelay } }, 429, { 'Retry-After': String(header) }));
    expect(await api.resume(TOKEN)).toEqual({ kind: 'error', code: 'RATE_LIMITED', ...(expected === undefined ? {} : { retryAfterSeconds: expected }) });
  });

  it('validates the conflict envelope and keeps decimal revisions exact', async () => {
    const latest = envelope('9223372036854775807');
    const { api } = setup(error('PREFERENCE_CONFLICT', 409, {}, latest));
    expect(await api.putPreferences(TOKEN, { soundEnabled: false }, '1')).toEqual({ kind: 'error', code: 'PREFERENCE_CONFLICT', preferences: latest });
  });

  it.each([500, 502, 503, 504])('maps non-JSON %s to unavailable with the header delay', async (status) => {
    const { api, fetchMock } = setup(new Response('<html>gateway</html>', { status, headers: { 'Retry-After': '5' } }));
    expect(await api.signIn(credentials, SESSION_TOKEN)).toEqual({ kind: 'unavailable', retryAfterSeconds: 5 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sanitizes network exceptions and never logs credentials', async () => {
    const spies = ['log', 'error', 'warn', 'debug', 'info'].map((method) => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
    const { api, fetchMock } = setup(async () => { throw new Error(`connection ${TOKEN}`); });
    expect(await api.resume(TOKEN)).toEqual({ kind: 'unavailable' });
    expect(await api.logout(TOKEN)).toEqual({ kind: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it.each(['fetch', 'body'])('times out stalled %s and aborts without retry', async (phase) => {
    vi.useFakeTimers();
    const { api, fetchMock } = setup(phase === 'fetch'
      ? () => new Promise<Response>(() => {})
      : { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => {}) } as Response);
    const pending = api.resume(TOKEN);
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  const malformed: [string, (body: AccountEntryBody) => unknown][] = [
    ['identity UUID', (body) => ({ ...body, account: { ...body.account, id: 'bad' } })],
    ['badge', (body) => ({ ...body, account: { ...body.account, badge: 'owner' } })],
    ['name', (body) => ({ ...body, account: { ...body.account, displayName: 'two words' } })],
    ['preference type', (body) => ({ ...body, preferences: envelope('1', { soundEnabled: 'false' }) })],
    ['extra preference', (body) => ({ ...body, preferences: envelope('1', { surprise: true }) })],
    ['missing preference', (body) => ({ ...body, preferences: { ...body.preferences, values: {} } })],
    ['numeric revision', (body) => ({ ...body, preferences: { ...body.preferences, revision: 1 } })],
    ['zero revision', (body) => ({ ...body, preferences: envelope('0') })],
    ['overflow revision', (body) => ({ ...body, preferences: envelope('9223372036854775808') })],
    ['timestamp', (body) => ({ ...body, preferences: { ...body.preferences, updatedAt: 'yesterday' } })],
    ['expiry', (body) => ({ ...body, expiresAt: null })],
    ['token', (body) => ({ ...body, accountToken: 'malformed' })],
    ['missing link', (body) => ({ ...body, link: undefined })],
    ['mismatched link', (body) => ({ ...body, link: { ...body.link, accountId: 'different' } })],
  ];
  it.each(malformed)('rejects malformed success: %s', async (_label, mutate) => {
    const { api } = setup(json(mutate(entry())));
    expect(await api.signIn(credentials, SESSION_TOKEN)).toEqual({ kind: 'unavailable' });
  });

  it.each(routes.filter((test) => test.status !== 204))('rejects empty success for $route $method', async (test) => {
    const { api } = setup(json({ ok: true }, test.status));
    expect(await test.call(api)).toEqual({ kind: 'unavailable' });
  });

  it('rejects a conflict without usable latest preferences', async () => {
    const { api } = setup(error('PREFERENCE_CONFLICT', 409));
    expect(await api.putPreferences(TOKEN, { musicEnabled: false }, '1')).toEqual({ kind: 'unavailable' });
  });
});
