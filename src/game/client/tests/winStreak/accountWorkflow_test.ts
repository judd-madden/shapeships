import { expect, test, vi } from 'vitest';
import { accountStreakRequestBody, requestAccountComputerGame, requestAccountRestart, verifyAccountRejoin, deriveAccountStreakGameViewModel } from '../../winStreak/accountWorkflow';
import { ACCOUNT_STREAK_ACTION_FAILED, ACCOUNT_STREAK_CONFLICT, ACCOUNT_STREAK_UNAVAILABLE } from '../../winStreak/types';
import { projectAuthoritativeWinStreakGame } from '../../winStreak/authoritative';
import { runtimeHarness, streak } from './accountFixtures';
import { deferred, json } from '../account/fixtures';
import { publicGameState } from './fixtures';

const session = async () => 'human';
test('account computer creation/rematch send the exact cached bigint revision without guest fields', async () => {
  const h = runtimeHarness(); h.setLatest(streak({ revision: '9007199254740993' })); await h.signIn();
  const request = vi.fn(async (revision: string) => {
    expect(accountStreakRequestBody(revision)).toEqual({ expectedStreakRevision: '9007199254740993' });
    return json({ gameId: 'NEW' });
  });
  expect(await requestAccountComputerGame({ runtime: h.runtime, getSessionId: session, request })).toBe('NEW');
  expect(request).toHaveBeenCalledExactlyOnceWith('9007199254740993'); expect(h.api.state).toHaveBeenCalledTimes(2);
  h.runtime.dispose();
});

test('creation waits for the first snapshot instead of substituting a guest count', async () => {
  const h = runtimeHarness(), gate = deferred<any>();
  h.api.state.mockImplementationOnce(() => gate.promise);
  const { signedIn } = await import('./accountFixtures'); h.accounts.set(signedIn());
  const request = vi.fn(async (_revision: string) => json({ gameId: 'NEW' }));
  const pending = requestAccountComputerGame({ runtime: h.runtime, getSessionId: session, request });
  await Promise.resolve(); expect(request).not.toHaveBeenCalled();
  gate.resolve({ kind: 'ok', data: { ok: true, streak: streak() } });
  expect(await pending).toBe('NEW'); h.runtime.dispose();
});

test.each(['create', 'restart', 'menu reset'])('%s conflict refreshes, uses the fixed message and never replays the mutation', async action => {
  const h = runtimeHarness(); await h.signIn();
  const request = vi.fn(async (_revision: string) => json({ error: 'STREAK_CONFLICT', message: 'Conflict' }, 409));
  h.api.reset.mockResolvedValue({ kind: 'error', code: 'STREAK_CONFLICT' });
  const pending = action === 'create' ? requestAccountComputerGame({ runtime: h.runtime, getSessionId: session, request })
    : action === 'restart' ? requestAccountRestart({ runtime: h.runtime, sourceGameId: 'SOURCE', request }) : h.runtime.reset();
  await expect(pending).rejects.toThrow(ACCOUNT_STREAK_CONFLICT);
  expect(h.api.state).toHaveBeenCalledTimes(2);
  if (action === 'menu reset') expect(h.api.reset).toHaveBeenCalledExactlyOnceWith('1');
  else expect(request).toHaveBeenCalledOnce(); h.runtime.dispose();
});

test.each(['network', 'http', 'invalid success'])('ambiguous create %s recovers only the new unfinished selection for this session', async failure => {
  const h = runtimeHarness(); await h.signIn();
  h.setLatest(streak({ revision: '2', trackedGame: { gameId: 'NEW', humanPlayerId: 'human', status: 'unfinished' } }));
  const request = vi.fn(async (_revision: string) => {
    if (failure === 'network') throw new Error('response lost');
    return failure === 'http' ? json({}, 503) : json({});
  });
  expect(await requestAccountComputerGame({ runtime: h.runtime, getSessionId: session, request })).toBe('NEW');
  expect(request).toHaveBeenCalledOnce(); h.runtime.dispose();
});
test.each([
  { revision: '1', trackedGame: { gameId: 'OLD', humanPlayerId: 'human', status: 'unfinished' as const } },
  { revision: '2', trackedGame: { gameId: 'NEW', humanPlayerId: 'other', status: 'unfinished' as const } },
  { revision: '2', trackedGame: { gameId: 'NEW', humanPlayerId: 'human', status: 'settled' as const } },
  { revision: '2', trackedGame: null },
])('ambiguous create refuses an unchanged, other-session or finished selection (%#)', async latest => {
  const h = runtimeHarness(); await h.signIn(); h.setLatest(streak(latest));
  const request = vi.fn(async (_revision: string) => { throw new Error('lost'); });
  await expect(requestAccountComputerGame({ runtime: h.runtime, getSessionId: session, request })).rejects.toThrow(ACCOUNT_STREAK_UNAVAILABLE);
  expect(request).toHaveBeenCalledOnce(); h.runtime.dispose();
});

test('outages retain the last count and reset never writes an optimistic zero', async () => {
  const h = runtimeHarness(); await h.signIn(); h.api.reset.mockResolvedValue({ kind: 'unavailable' });
  await expect(h.runtime.reset()).rejects.toThrow(ACCOUNT_STREAK_UNAVAILABLE);
  expect(h.runtime.getSnapshot().streak?.currentCount).toBe(3); expect(h.guest.getSnapshot().currentCount).toBe(0);
  h.api.state.mockResolvedValue({ kind: 'unavailable' });
  await expect(requestAccountComputerGame({ runtime: h.runtime, getSessionId: session,
    request: async () => json({}, 503) })).rejects.toThrow(ACCOUNT_STREAK_UNAVAILABLE);
  expect(h.runtime.getSnapshot().streak?.currentCount).toBe(3); h.runtime.dispose();
});

test('restart validates completion and source identity, then refreshes without guest registration', async () => {
  const h = runtimeHarness(); await h.signIn();
  const request = vi.fn(async (_revision: string) => json({ gameId: 'REPLACEMENT', sourceGameId: 'SOURCE', resetStatus: 'completed' }));
  expect(await requestAccountRestart({ runtime: h.runtime, sourceGameId: 'SOURCE', request })).toBe('REPLACEMENT');
  expect(request).toHaveBeenCalledExactlyOnceWith('1'); expect(h.guest.getSnapshot().trackedGame).toBeNull();
  request.mockResolvedValue(json({ gameId: 'REPLACEMENT', sourceGameId: 'WRONG', resetStatus: 'completed' }));
  await expect(requestAccountRestart({ runtime: h.runtime, sourceGameId: 'SOURCE', request })).rejects.toThrow(ACCOUNT_STREAK_ACTION_FAILED);
  h.runtime.dispose();
});

test('Rejoin requires this session and an active verified game, while allowing fixed bonus mismatch', async () => {
  const snapshot = streak({ trackedGame: { gameId: 'GAME', humanPlayerId: 'human', status: 'unfinished' } });
  const getGameState = vi.fn(async (_id: string) => json(publicGameState({ gameId: 'GAME', appliedCount: 8 })));
  expect(await verifyAccountRejoin({ snapshot, sessionId: 'human', getGameState })).toEqual({ gameId: 'GAME' });
  expect(await verifyAccountRejoin({ snapshot, sessionId: 'other-tab', getGameState })).toBeNull();
  expect(getGameState).toHaveBeenCalledOnce();
  getGameState.mockResolvedValue(json(publicGameState({ gameId: 'GAME', status: 'finished', winner: 'human' })));
  expect(await verifyAccountRejoin({ snapshot, sessionId: 'human', getGameState })).toBeNull();
  getGameState.mockResolvedValue(json(publicGameState({ gameId: 'GAME', requesterPlayerId: 'spectator' })));
  expect(await verifyAccountRejoin({ snapshot, sessionId: 'human', getGameState })).toBeNull();
});

test('account VM scopes the ended state to its game and keeps fixed bonus data from the game', () => {
  const game = projectAuthoritativeWinStreakGame(publicGameState({ gameId: 'GAME', appliedCount: 8 }))!;
  const args = { snapshot: streak({ currentCount: 0, endedStreak: { count: 3, endingGameId: 'GAME' } }), game,
    busy: false, error: null, retryAvailable: false, blocked: false };
  const vm = deriveAccountStreakGameViewModel(args);
  expect(vm).toMatchObject({ currentCount: 0, displayCount: 3, streakState: 'ended',
    appliedBonus: { count: 8, recipientPlayerId: 'bot', recipientSide: 'opponent', turnOneHoverEligible: true } });
  expect(deriveAccountStreakGameViewModel({ ...args, game: { ...game, gameId: 'OTHER' } }).streakState).toBe('hidden');
});

test.each([400, 403, 404, 422, 429])('HTTP %s computer-game refusal is not reported as an outage', async status => {
  const h = runtimeHarness(); await h.signIn();
  await expect(requestAccountComputerGame({ runtime: h.runtime, getSessionId: session,
    request: async () => json({ error: 'REQUEST_REFUSED' }, status) })).rejects.toThrow(ACCOUNT_STREAK_ACTION_FAILED);
  h.runtime.dispose();
});
