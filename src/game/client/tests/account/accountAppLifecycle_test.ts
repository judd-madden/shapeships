import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapRememberedAccount, observeAccountSession } from '../../gameSession/accountSessionWiring';
import { ACCOUNT_TOKEN_STORAGE_KEY } from '../../account/accountStore';
import { cleanup, deferred, error, harness, json, resumed, SESSION_TOKEN, TOKEN } from './fixtures';

afterEach(cleanup);

const tabSession = { sessionToken: SESSION_TOKEN, sessionId: 'session_tab' };

describe('account app startup decisions', () => {
  it('leaves a guest flow untouched, including an invite, without bootstrapping a session', async () => {
    const h = harness();
    const ensureSession = vi.fn(), clearSession = vi.fn();
    expect(await bootstrapRememberedAccount({ store: h.store, ensureSession, clearSession, requestedGameId: 'invite' }))
      .toEqual({ destination: 'guest' });
    expect(ensureSession).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, 'friend-invite', 'current-match'])('bootstraps unnamed, resumes with S and routes %s', async (requestedGameId) => {
    const h = harness({ savedToken: TOKEN });
    const ensureSession = vi.fn(async () => tabSession);
    const pending = deferred<{ sessionToken: string; sessionId: string }>();
    ensureSession.mockReturnValueOnce(pending.promise);
    const work = bootstrapRememberedAccount({ store: h.store, ensureSession, clearSession: vi.fn(), requestedGameId });
    expect(ensureSession).toHaveBeenCalledExactlyOnceWith();
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    pending.resolve(tabSession);
    expect(await work).toEqual(requestedGameId
      ? { destination: 'game', gameId: requestedGameId }
      : { destination: 'menu' });
    expect(new Headers(h.fetchMock.mock.calls[0][1]?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
  });

  it.each(['unavailable', 'ACCOUNTS_NOT_ENABLED', 'ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED', 'ACCOUNT_BLOCKED', 'NAME_BANNED'])(
  'returns %s to Entry with the invite and correct token retention', async (code) => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockResolvedValueOnce(code === 'unavailable' ? new Response('bad gateway', { status: 503 }) : error(code, 403));
    expect(await bootstrapRememberedAccount({ store: h.store, ensureSession: vi.fn(async () => tabSession), clearSession: vi.fn(), requestedGameId: 'invite' }))
      .toEqual({ destination: 'entry', pendingInviteGameId: 'invite' });
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    expect(h.storage!.getItem(ACCOUNT_TOKEN_STORAGE_KEY)).toBe(['unavailable', 'ACCOUNTS_NOT_ENABLED'].includes(code) ? TOKEN : null);
    expect(h.fetchMock).toHaveBeenCalledOnce();
  });

  it.each([null, 'current-match'])('repairs an expired S once before routing %s', async (requestedGameId) => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockResolvedValueOnce(error('GAME_SESSION_INVALID', 401));
    h.fetchMock.mockResolvedValueOnce(json(resumed()));
    const ensureSession = vi.fn(async () => tabSession);
    const clearSession = vi.fn();
    expect(await bootstrapRememberedAccount({ store: h.store, ensureSession, clearSession, requestedGameId }))
      .toEqual(requestedGameId ? { destination: 'game', gameId: requestedGameId } : { destination: 'menu' });
    expect(ensureSession.mock.calls).toEqual([[], []]);
    expect(clearSession).toHaveBeenCalledOnce();
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(h.fetchMock.mock.calls[1][1]?.headers).has('X-Session-Token')).toBe(false);
    expect(new Headers(h.fetchMock.mock.calls[2][1]?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
  });

  it('bounds repeated invalid-session responses instead of retrying forever', async () => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockImplementation(async (_url, options) => new Headers(options?.headers).has('X-Session-Token')
      ? error('GAME_SESSION_INVALID', 401) : json(resumed()));
    const ensureSession = vi.fn(async () => tabSession);
    expect(await bootstrapRememberedAccount({ store: h.store, ensureSession, clearSession: vi.fn(), requestedGameId: 'invite' }))
      .toEqual({ destination: 'entry', pendingInviteGameId: 'invite' });
    expect(ensureSession).toHaveBeenCalledTimes(2);
    expect(h.fetchMock).toHaveBeenCalledTimes(4);
    expect(h.store.getSnapshot().status).toBe('unavailable');
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    expect(h.store.hasRememberedToken()).toBe(true);
  });

  it('clears visible account authority if repair fails after account-only validation', async () => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockResolvedValueOnce(error('GAME_SESSION_INVALID', 401));
    h.fetchMock.mockResolvedValueOnce(json(resumed()));
    const ensureSession = vi.fn(async () => tabSession).mockResolvedValueOnce(tabSession).mockRejectedValueOnce(new Error('offline'));
    expect(await bootstrapRememberedAccount({ store: h.store, ensureSession, clearSession: vi.fn(), requestedGameId: 'invite' }))
      .toEqual({ destination: 'entry', pendingInviteGameId: 'invite' });
    expect(h.store.getSnapshot().status).toBe('unavailable');
    expect(h.store.getAccountToken()).toBeNull();
    expect(h.store.hasRememberedToken()).toBe(true);
  });

  it('keeps the remembered token on session bootstrap failure and ignores cancelled work', async () => {
    const h = harness({ savedToken: TOKEN });
    expect(await bootstrapRememberedAccount({ store: h.store, ensureSession: vi.fn().mockRejectedValue(new Error('offline')), clearSession: vi.fn(), requestedGameId: 'invite' }))
      .toEqual({ destination: 'entry', pendingInviteGameId: 'invite' });
    expect(h.storage!.getItem(ACCOUNT_TOKEN_STORAGE_KEY)).toBe(TOKEN);
    const pending = deferred<typeof tabSession>();
    let current = true;
    const work = bootstrapRememberedAccount({ store: h.store, ensureSession: () => pending.promise, clearSession: vi.fn(), requestedGameId: 'invite', isCurrent: () => current });
    current = false;
    pending.resolve(tabSession);
    expect(await work).toEqual({ destination: 'entry', pendingInviteGameId: 'invite' });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });
});

describe('signed-in tab lifecycle', () => {
  it('ignores initial signedOut, then resets immediately on deliberate logout', async () => {
    const h = harness(), enter = vi.fn();
    const stop = observeAccountSession(h.store, enter);
    await h.store.resume();
    expect(enter).not.toHaveBeenCalled();
    await h.signIn();
    const revoke = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(revoke.promise);
    const logout = h.store.logout();
    expect(enter).toHaveBeenCalledOnce();
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(true);
    revoke.resolve(new Response(null, { status: 204 }));
    await logout;
    expect(enter).toHaveBeenCalledOnce();
    stop();
  });

  it.each(['ACCOUNT_TOKEN_INVALID', 'ACCOUNT_BLOCKED', 'NAME_BANNED', 'ACCOUNTS_NOT_ENABLED', 'unavailable'])(
  'retains signed-in history through resuming and resets on %s', async (code) => {
    const h = harness();
    await h.signIn();
    const enter = vi.fn(), stop = observeAccountSession(h.store, enter);
    const pending = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(pending.promise);
    const work = h.store.resume(SESSION_TOKEN);
    expect(enter).not.toHaveBeenCalled();
    pending.resolve(code === 'unavailable' ? new Response('offline', { status: 503 }) : error(code, 403));
    await work;
    expect(enter).toHaveBeenCalledOnce();
    stop();
  });

  it('resets on sibling logout and stops observing after cleanup', async () => {
    const h = harness();
    await h.signIn();
    const enter = vi.fn(), stop = observeAccountSession(h.store, enter);
    h.external(ACCOUNT_TOKEN_STORAGE_KEY, null);
    expect(enter).toHaveBeenCalledOnce();
    stop();
    await h.signIn();
    await h.store.logout();
    expect(enter).toHaveBeenCalledOnce();
  });
});
