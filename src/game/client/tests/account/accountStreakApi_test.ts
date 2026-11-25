import { expect, test, vi } from 'vitest';
import { createAccountStreakApi, parseAccountStreakSnapshot } from '../../account/accountApi';
import { streak } from '../winStreak/accountFixtures';
import { json } from './fixtures';

test('streak API uses authenticated POST with exact state/import/reset bodies and bigint revisions', async () => {
  const snapshot = streak({ revision: '9223372036854775807' });
  const guest = { currentCount: 4, anchorGameId: 'GUEST', humanPlayerId: 'human', resultPending: true };
  const fetch = vi.fn(async (path: string) => json({ ok: true, streak: snapshot,
    ...(path.endsWith('/import') ? { import: { anchorGameId: 'GUEST', selection: 'guest', acceptedCount: 4, continuation: 'authorised' } } : {}) }));
  const api = createAccountStreakApi(fetch);
  expect(await api.state()).toEqual({ kind: 'ok', data: { ok: true, streak: snapshot } });
  expect(await api.import({ expectedRevision: snapshot.revision, decision: 'compare', guest })).toMatchObject({ kind: 'ok' });
  await api.reset(snapshot.revision);
  const calls = fetch.mock.calls as unknown as [string, RequestInit, number][];
  expect(calls.map(([path, init, timeout]) => [path, init.method, JSON.parse(String(init.body)), init.cache, timeout])).toEqual([
    ['/accounts/streak/state', 'POST', {}, 'no-store', 8000],
    ['/accounts/streak/import', 'POST', { expectedRevision: snapshot.revision, decision: 'compare', guest }, 'no-store', 8000],
    ['/accounts/streak/reset', 'POST', { expectedRevision: snapshot.revision }, 'no-store', 8000],
  ]);
});

test.each([0, 1, '0', '01', '-1', '1.0', '1e3', '9223372036854775808'])('rejects invalid revision %s', revision => {
  expect(parseAccountStreakSnapshot({ ...streak(), revision })).toBeNull();
});
test.each([
  { accountId: 'bad' }, { runId: 'bad' }, { currentCount: -1 }, { currentCount: Number.MAX_SAFE_INTEGER + 1 },
  { trackedGame: undefined }, { trackedGame: {} }, { trackedGame: { gameId: 'G', humanPlayerId: 'human', status: 'invented' } },
  { endedStreak: undefined }, { endedStreak: { count: 0, endingGameId: 'G' } }, { updatedAt: 'tomorrow' },
])('rejects malformed snapshot %j', patch => expect(parseAccountStreakSnapshot({ ...streak(), ...patch })).toBeNull());

test('parses optional conflict snapshot, fixed error codes and retry delay without requiring a snapshot', async () => {
  const fetch = vi.fn(async () => json({ ok: false, error: { code: 'STREAK_CONFLICT', message: 'Conflict' }, streak: streak() }, 409));
  const api = createAccountStreakApi(fetch);
  expect(await api.reset('1')).toEqual({ kind: 'error', code: 'STREAK_CONFLICT', streak: streak() });
  fetch.mockImplementation(async () => json({ ok: false, error: { code: 'STREAK_CONFLICT', message: 'Conflict' } }, 409));
  expect(await api.reset('1')).toEqual({ kind: 'error', code: 'STREAK_CONFLICT' });
  fetch.mockImplementation(async () => json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Wait' } }, 429, { 'Retry-After': '5' }));
  expect(await api.state()).toEqual({ kind: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 5 });
});
test('malformed success, non-JSON outage and transport exceptions are unavailable and never retried', async () => {
  const fetch = vi.fn(async () => json({ ok: true }));
  const api = createAccountStreakApi(fetch);
  expect(await api.state()).toEqual({ kind: 'unavailable' });
  fetch.mockResolvedValue(new Response('outage', { status: 503 }));
  expect(await api.state()).toEqual({ kind: 'unavailable' });
  fetch.mockRejectedValue(new Error('private credentials'));
  expect(await api.reset('1')).toEqual({ kind: 'unavailable' });
  expect(fetch).toHaveBeenCalledTimes(3);
});

test.each(['transport', 'body'])('streak API bounds stalled %s work without retry', async phase => {
  vi.useFakeTimers();
  try {
    const fetch = vi.fn(async (_path: string, _options?: RequestInit) => phase === 'transport'
      ? new Promise<Response>(() => {})
      : { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => {}) } as Response);
    const pending = createAccountStreakApi(fetch).state();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  } finally { vi.useRealTimers(); }
});

test.each([500, 502, 503, 504])('HTTP %s is an outage even with a parsed application error body', async status => {
  const fetch = vi.fn(async () => json({ ok: false, error: { code: 'STREAK_IMPORT_UNVERIFIED', message: 'Unavailable' } },
    status, { 'Retry-After': '5' }));
  const guest = { currentCount: 4, anchorGameId: 'GUEST', humanPlayerId: 'human', resultPending: true };
  expect(await createAccountStreakApi(fetch).import({ decision: 'decline', expectedRevision: '1', guest }))
    .toEqual({ kind: 'unavailable', retryAfterSeconds: 5 });
  expect(fetch).toHaveBeenCalledOnce();
});
