import { afterEach, expect, test, vi } from 'vitest';
import { createAccountMissionApi } from '../../account/accountApi';
import { ANON_KEY, BASE_URL, TOKEN, cleanup, error, json } from './fixtures';

afterEach(cleanup);
const progress = { missions: ['mission-a'], findings: ['groombridge'] };
const body = { ok: true, missionProgress: progress };
function setup(response: Response | (() => Promise<Response>)) {
  const fetchMock = vi.fn<typeof fetch>(typeof response === 'function' ? response : async () => response);
  return { fetchMock, api: createAccountMissionApi({ baseUrl: BASE_URL + '/', anonKey: ANON_KEY, fetch: fetchMock, timeoutMs: 50 }) };
}

test.each(['state', 'add', 'reset'] as const)('mission %s uses only account authority and exact request shape', async route => {
  const { api, fetchMock } = setup(json(body));
  const result = route === 'add' ? await api.add(TOKEN, progress) : await api[route](TOKEN);
  expect(result).toEqual({ kind: 'ok', data: body });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${BASE_URL}/accounts/missions/${route}`);
  expect(String(url)).not.toContain(TOKEN);
  expect(init?.method).toBe(route === 'state' ? 'GET' : 'POST');
  expect(init?.cache).toBe('no-store');
  const headers = new Headers(init?.headers);
  expect(headers.get('Authorization')).toBe(`Bearer ${ANON_KEY}`);
  expect(headers.get('apikey')).toBe(ANON_KEY);
  expect(headers.get('X-Account-Token')).toBe(TOKEN);
  expect(headers.get('X-Session-Token')).toBeNull();
  expect(headers.get('Content-Type')).toBe(route === 'state' ? null : 'application/json');
  expect(init?.body === undefined ? undefined : JSON.parse(String(init.body))).toEqual(route === 'state' ? undefined : route === 'add' ? progress : {});
  expect(fetchMock).toHaveBeenCalledOnce();
});

test.each([
  null, {}, { ok: false, missionProgress: progress }, { ok: true },
  { ok: true, missionProgress: [] },
  ...[{}, { missions: [] }, { ...progress, extra: [] }, { ...progress, findings: null },
    { ...progress, missions: ['bad_id'] }, { ...progress, findings: ['Upper'] },
    { ...progress, missions: [1] }, { ...progress, findings: ['a'.repeat(81)] },
    { ...progress, missions: Array(101).fill('a') }, { ...progress, findings: Array(101).fill('a') },
  ].map(missionProgress => ({ ok: true, missionProgress })),
])('rejects malformed mission success %j', async value => {
  const { api } = setup(json(value));
  expect(await api.state(TOKEN)).toEqual({ kind: 'unavailable' });
});

test('accepts empty lists and the 100-entry, 80-character boundaries', async () => {
  for (const progress of [{ missions: [], findings: [] }, { missions: Array(100).fill('a'.repeat(80)), findings: Array(100).fill('z') }]) {
    const { api } = setup(json({ ok: true, missionProgress: progress }));
    expect(await api.state(TOKEN)).toEqual({ kind: 'ok', data: { ok: true, missionProgress: progress } });
  }
});

test.each([['ACCOUNT_TOKEN_EXPIRED', 401], ['RATE_LIMITED', 429], ['ACCOUNT_SERVICE_UNAVAILABLE', 503]] as const)(
  'preserves mission error %s', async (code, status) => {
    const { api } = setup(error(code, status, { field: 'missions', retryAfterSeconds: 3 }));
    expect(await api.add(TOKEN, progress)).toEqual({ kind: 'error', code, field: 'missions', retryAfterSeconds: 3 });
  },
);

test('invalid JSON, invalid success status and transport exceptions are unavailable without logging or retry', async () => {
  const logs = ['log', 'warn', 'error', 'info', 'debug'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
  for (const response of [new Response('bad', { status: 503 }), json(body, 201), async () => { throw new Error(TOKEN); }]) {
    const { api, fetchMock } = setup(response);
    expect(await api.reset(TOKEN)).toEqual({ kind: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledOnce();
  }
  logs.forEach(log => expect(log).not.toHaveBeenCalled());
});

test.each(['fetch', 'body'])('mission timeout bounds stalled %s without replay', async phase => {
  vi.useFakeTimers();
  const { api, fetchMock } = setup(phase === 'fetch' ? () => new Promise<Response>(() => {})
    : { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => {}) } as Response);
  const pending = api.state(TOKEN);
  await vi.advanceTimersByTimeAsync(50);
  expect(await pending).toEqual({ kind: 'unavailable' });
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledOnce();
});
