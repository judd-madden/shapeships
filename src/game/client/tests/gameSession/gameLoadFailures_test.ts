import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyGameLoadFailure, useAutoJoinEffect, usePollingEffect,
} from '../../gameSession/clienteffects/useNetworkingEffects';
import { json, memoryStorage } from '../account/fixtures';

// Run the production effects and their cleanup without mounting a UI.
const hooks = vi.hoisted(() => {
  const cells: { value?: any; deps?: readonly unknown[]; cleanup?: () => void }[] = [];
  const effects: (() => void)[] = [];
  let index = 0;
  const cell = () => cells[index++] ?? (cells[index - 1] = {});
  return {
    render: (read: () => void) => { index = 0; read(); effects.splice(0).forEach((run) => run()); },
    reset: () => { cells.splice(0).forEach((entry) => entry.cleanup?.()); effects.length = 0; },
    useRef: (initial: any) => { const entry = cell(); return entry.value ?? (entry.value = { current: initial }); },
    useEffect: (setup: () => void | (() => void), deps?: readonly unknown[]) => {
      const entry = cell();
      if (entry.deps && deps && entry.deps.length === deps.length && deps.every((v, i) => Object.is(v, entry.deps![i]))) return;
      entry.deps = deps;
      effects.push(() => { entry.cleanup?.(); entry.cleanup = setup() || undefined; });
    },
  };
});
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(),
  useEffect: hooks.useEffect, useRef: hooks.useRef }));

const { storage } = memoryStorage();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('sessionStorage', storage);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { hooks.reset(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('game load failure classification', () => {
  it.each([
    [404, { error: 'Game not found' }, 'notFound'],
    [401, { message: 'Invalid or expired session token' }, 'sessionExpired'],
    [401, { message: 'Missing X-Session-Token header. Session token required for this endpoint.' }, 'sessionExpired'],
    [401, { message: 'Other authentication error' }, 'loadFailed'],
    [403, { error: 'Forbidden' }, 'loadFailed'],
    [404, { error: 'Other resource not found' }, 'loadFailed'],
    [409, { error: 'Game changed while joining; retry the request' }, 'loadFailed'],
    [429, { error: 'Slow down' }, 'loadFailed'],
    [500, { error: 'Internal server error' }, 'loadFailed'],
    [503, {}, 'loadFailed'],
  ])('classifies HTTP %s %j as %s without consuming the response', async (status, body, expected) => {
    const response = json(body, status as number);
    expect(await classifyGameLoadFailure(response)).toBe(expected);
    expect(await response.json()).toEqual(body);
  });
  it.each(['ACCOUNT_TOKEN_REQUIRED', 'ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED', 'ACCOUNT_TOKEN_REVOKED',
    'ACCOUNT_TOKEN_FUTURE', 'ACCOUNT_BLOCKED', 'GAME_SESSION_INVALID', 'NAME_BANNED', 'CLAIMED_NAME_REQUIRES_ACCOUNT'])(
  'leaves %s to existing Entry/account handling', async (code) => {
    for (const status of [401, 403]) {
      expect(await classifyGameLoadFailure(json({ error: code, message: 'Invalid or expired session token' }, status))).toBeNull();
    }
  });
  it('classifies transport failure as loadFailed and unknown 401 bodies conservatively', async () => {
    expect(await classifyGameLoadFailure()).toBe('loadFailed');
    expect(await classifyGameLoadFailure(new Response('unreadable', { status: 401 }))).toBe('loadFailed');
  });
});

function joinArgs() {
  let allowed = true;
  return {
    effectiveGameId: 'source', effectivePlayerName: 'Guest', loadAttempt: 0,
    attemptedJoinForGameRef: { current: new Set<string>() },
    ensureSession: vi.fn(async () => ({ sessionId: 'same-session' })),
    authenticatedPost: vi.fn(async () => json({ error: 'Internal server error' }, 500)),
    authenticatedGet: vi.fn(async () => json({ gameId: 'source' })),
    setMySessionId: vi.fn(), setHasJoinedCurrentGame: vi.fn(), canAttemptLoad: () => allowed,
    onLoadFailure: vi.fn(() => { allowed = false; }),
    allowRetry: () => { allowed = true; },
  };
}

describe('join attempt boundaries', () => {
  it.each(['server', 'network', 'timeout', 'forbidden', 'missing'] as const)(
  'stops a %s failure until one deliberate same-session retry', async (kind) => {
    const args = joinArgs();
    if (kind === 'network') args.authenticatedPost.mockRejectedValueOnce(new TypeError('offline'));
    if (kind === 'timeout') args.authenticatedPost.mockRejectedValueOnce(new DOMException('timeout', 'AbortError'));
    if (kind === 'forbidden') args.authenticatedPost.mockResolvedValueOnce(json({ error: 'Forbidden' }, 403));
    if (kind === 'missing') args.authenticatedPost.mockResolvedValueOnce(json({ error: 'Game not found' }, 404));
    const read = () => hooks.render(() => useAutoJoinEffect(args));
    read(); await vi.advanceTimersByTimeAsync(0);
    expect(args.onLoadFailure).toHaveBeenCalledExactlyOnceWith(kind === 'missing' ? 'notFound' : 'loadFailed');
    await vi.advanceTimersByTimeAsync(60000); read();
    expect(args.authenticatedPost).toHaveBeenCalledTimes(1);
    args.allowRetry(); args.loadAttempt++; args.attemptedJoinForGameRef.current.delete('source');
    args.authenticatedPost.mockResolvedValueOnce(json({}));
    read(); await vi.advanceTimersByTimeAsync(0);
    expect(args.authenticatedPost).toHaveBeenCalledTimes(2);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(1);
    expect(args.setMySessionId.mock.calls).toEqual([['same-session'], ['same-session']]);
    expect(args.setHasJoinedCurrentGame).toHaveBeenLastCalledWith(true);
  });
  it('exhausts three confirmation reads without replaying join', async () => {
    const args = joinArgs(); args.authenticatedPost.mockResolvedValue(json({}));
    args.authenticatedGet.mockResolvedValue(json({}, 503));
    hooks.render(() => useAutoJoinEffect(args)); await vi.advanceTimersByTimeAsync(1100);
    expect(args.authenticatedPost).toHaveBeenCalledTimes(1);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(3);
    expect(args.onLoadFailure).toHaveBeenCalledExactlyOnceWith('loadFailed');
    await vi.advanceTimersByTimeAsync(60000);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(3);
  });
  it.each([401, 403, 404])('stops terminal confirmation HTTP %s immediately', async (status) => {
    const args = joinArgs(); args.authenticatedPost.mockResolvedValue(json({}));
    args.authenticatedGet.mockResolvedValue(json(status === 401
      ? { message: 'Invalid or expired session token' } : { error: 'Game not found' }, status));
    hooks.render(() => useAutoJoinEffect(args)); await vi.advanceTimersByTimeAsync(2000);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(1);
    expect(args.onLoadFailure).toHaveBeenCalledExactlyOnceWith(status === 401 ? 'sessionExpired' : status === 404 ? 'notFound' : 'loadFailed');
  });
  it('joins a spectator assigned by the server through the same confirmation path', async () => {
    const args = joinArgs(); args.authenticatedPost.mockResolvedValue(json({ role: 'spectator' }));
    hooks.render(() => useAutoJoinEffect(args)); await vi.advanceTimersByTimeAsync(0);
    expect(args.authenticatedPost).toHaveBeenCalledTimes(1);
    expect(args.setHasJoinedCurrentGame).toHaveBeenLastCalledWith(true);
  });
  it('does not reinterpret an unrelated 409 as an already-joined response', async () => {
    const args = joinArgs(); args.authenticatedPost.mockResolvedValue(json({ error: 'Game changed' }, 409));
    hooks.render(() => useAutoJoinEffect(args)); await vi.advanceTimersByTimeAsync(0);
    expect(args.onLoadFailure).toHaveBeenCalledWith('loadFailed');
    expect(args.authenticatedGet).not.toHaveBeenCalled();
  });
  it('preserves explicit already-joined confirmation', async () => {
    const args = joinArgs(); args.authenticatedPost.mockResolvedValue(json({ error: 'Already joined' }, 409));
    hooks.render(() => useAutoJoinEffect(args)); await vi.advanceTimersByTimeAsync(0);
    expect(args.setHasJoinedCurrentGame).toHaveBeenLastCalledWith(true);
    expect(args.onLoadFailure).not.toHaveBeenCalled();
  });
});

function pollArgs(accepted = false): Parameters<typeof usePollingEffect>[0] {
  let allowed = true; let seq = 0;
  return {
    effectiveGameId: 'source', hasJoinedCurrentGame: true,
    authenticatedGet: vi.fn(async () => json({}, 500)), canPoll: () => allowed,
    onLoadFailure: vi.fn(() => { allowed = false; }), onInitialLoadSuccess: vi.fn(),
    beginGameStateRequest: () => ({ requestSeq: ++seq, unlockEligible: false, resumeLockActivationRequestSeq: null }),
    finishGameStateRequest: vi.fn(), maybeUnlockResumeSyncFromGameStateSuccess: vi.fn(),
    applyAuthoritativeRawState: vi.fn(() => true), shouldRetryGameStateRequestImmediately: () => true,
    isResumeSyncLocked: () => false, maybeUnlockResumeSyncFromValidatedUnchangedHead: vi.fn(),
    hasAcceptedFullGameState: () => accepted, getLastAcceptedFullFingerprint: () => null,
    getLastAcceptedFullSyncAtMs: () => 0, isGameStateRequestInFlight: () => false,
    setLoading: vi.fn(), setError: vi.fn(), isFinished: false, isUntimedAuthoritative: false,
    untimedPollingMode: 'active', foregroundResumeToken: 0,
  };
}

describe('initial load and live polling', () => {
  it.each(['http', 'network', 'timeout', 'json', 'payload'] as const)(
  'stops initial %s failure, including foreground recovery', async (kind) => {
    const args = pollArgs();
    if (kind === 'network') vi.mocked(args.authenticatedGet).mockRejectedValue(new TypeError('offline'));
    if (kind === 'timeout') vi.mocked(args.authenticatedGet).mockRejectedValue(new DOMException('timeout', 'AbortError'));
    if (kind === 'json') vi.mocked(args.authenticatedGet).mockResolvedValue(new Response('invalid JSON'));
    if (kind === 'payload') { vi.mocked(args.authenticatedGet).mockResolvedValue(json({})); args.isValidInitialState = () => false; }
    const read = () => hooks.render(() => usePollingEffect(args));
    read(); await vi.advanceTimersByTimeAsync(0);
    expect(args.onLoadFailure).toHaveBeenCalledExactlyOnceWith('loadFailed');
    args.foregroundResumeToken++; read(); await vi.advanceTimersByTimeAsync(60000);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(1);
  });
  it('completes a valid initial full-state load', async () => {
    const args = pollArgs(); vi.mocked(args.authenticatedGet).mockResolvedValue(json({ gameId: 'source' }));
    hooks.render(() => usePollingEffect(args)); await vi.advanceTimersByTimeAsync(0);
    expect(args.onInitialLoadSuccess).toHaveBeenCalledOnce();
    expect(args.applyAuthoritativeRawState).toHaveBeenCalledOnce();
  });
  it.each([false, true])('stops an expired full/head request once (already loaded=%s)', async (accepted) => {
    const args = pollArgs(accepted);
    vi.mocked(args.authenticatedGet).mockImplementation(async () => json({ message: 'Invalid or expired session token' }, 401));
    const read = () => hooks.render(() => usePollingEffect(args));
    read(); await vi.advanceTimersByTimeAsync(0);
    expect(args.onLoadFailure).toHaveBeenCalledExactlyOnceWith('sessionExpired');
    args.foregroundResumeToken++; read(); await vi.advanceTimersByTimeAsync(60000);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(1);
    expect(args.authenticatedGet).toHaveBeenCalledWith(accepted ? '/game-state-head/source' : '/game-state/source', 8000);
  });
  it('retains backoff for other failures after the board has loaded', async () => {
    const args = pollArgs(true);
    hooks.render(() => usePollingEffect(args)); await vi.advanceTimersByTimeAsync(2500);
    expect(args.authenticatedGet).toHaveBeenCalledTimes(2);
    expect(args.onLoadFailure).not.toHaveBeenCalled();
  });
});
