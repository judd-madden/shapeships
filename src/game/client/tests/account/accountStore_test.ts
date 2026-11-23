import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_TOKEN_STORAGE_KEY as tokenKey } from '../../account/accountStore';
import { PLAYER_PREFERENCE_STORAGE_KEYS as keys } from '../../preferences/playerPreferences';
import {
  OTHER_ACCOUNT_ID, OTHER_TOKEN, SESSION_TOKEN, TOKEN, cleanup, deferred, entry, envelope, error,
  harness, json, resumed,
} from './fixtures';

afterEach(cleanup);

describe('account store lifecycle and storage', () => {
  it.each(['available', 'RATE_LIMITED'] as const)('invalidates a pending %s name check before a failed claim', async (outcome) => {
    const h = harness(), pending = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(pending.promise);
    const checking = h.store.nameCheck('Pilot1');
    h.store.invalidateNameChecks();
    h.fetchMock.mockResolvedValueOnce(error('CAPTCHA_REPLAY', 409));
    await h.store.claim({ name: 'Pilot1', password: 'synthetic-password', turnstileToken: 'synthetic-proof', preferences: h.preferences.getSnapshot() }, SESSION_TOKEN);
    expect(h.store.getSnapshot().lastError?.code).toBe('CAPTCHA_REPLAY');
    pending.resolve(outcome === 'available'
      ? json({ ok: true, nameKey: 'pilot1', displayName: 'Pilot1', outcome })
      : error(outcome, 429));
    expect(await checking).toBeNull();
    expect(h.store.getSnapshot().lastError?.code).toBe('CAPTCHA_REPLAY');
  });

  it('claims with current local preferences and links the supplied tab session', async () => {
    const h = harness();
    h.preferences.setPreference('musicEnabled', false);
    h.preferences.setPreference('soundEnabled', false);
    const preferences = h.preferences.getSnapshot();
    h.fetchMock.mockResolvedValueOnce(json(entry(TOKEN, undefined, 'Pilot1', envelope('1', preferences)), 201));
    await h.store.claim({ name: 'Pilot1', password: 'synthetic-password', turnstileToken: 'synthetic-proof', preferences }, SESSION_TOKEN);
    const [, request] = h.fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual({
      name: 'Pilot1', password: 'synthetic-password', turnstileToken: 'synthetic-proof', preferences,
    });
    expect(new Headers(request?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', linkedSessionId: 'session_tab', lastError: null });
    expect(h.store.getAccountTokenForSession('session_tab')).toBe(TOKEN);
    expect(h.fetchMock).toHaveBeenCalledOnce();
  });

  it('checks remembered storage synchronously without network or identity', async () => {
    const h = harness();
    expect(h.store.hasRememberedToken()).toBe(false);
    h.storage!.setItem(tokenKey, TOKEN);
    expect(h.store.hasRememberedToken()).toBe(true);
    expect(h.store.getSnapshot().status).toBe('signedOut');
    expect(h.fetchMock).not.toHaveBeenCalled();
    await h.store.resume();
    vi.mocked(h.storage!.removeItem).mockImplementationOnce(() => { throw new Error('blocked'); });
    await h.store.logout();
    expect(h.store.hasRememberedToken()).toBe(false);
  });

  it('checks memory-only remembered authority without requiring storage', async () => {
    const h = harness({ storage: null });
    expect(h.store.hasRememberedToken()).toBe(false);
    await h.signIn();
    h.fetchMock.mockClear();
    expect(h.store.hasRememberedToken()).toBe(true);
    expect(h.fetchMock).not.toHaveBeenCalled();
    h.store.dispose();
    expect(h.store.hasRememberedToken()).toBe(false);
  });

  it('suspends identity on a game-session bootstrap failure while retaining the remembered sign-in', async () => {
    const h = harness();
    await h.signIn();
    h.store.suspendForSessionFailure('GAME_SESSION_INVALID');
    expect(h.store.getSnapshot()).toMatchObject({ status: 'unavailable', lastError: { code: 'GAME_SESSION_INVALID' } });
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    expect(h.store.getAccountTokenForSession('session_tab')).toBeNull();
    expect(h.store.hasRememberedToken()).toBe(true);
    h.preferences.setPreference('musicEnabled', false);
    expect(h.fetchMock).toHaveBeenCalledOnce();
    await h.store.resume(SESSION_TOKEN);
    expect(h.store.getAccountTokenForSession('session_tab')).toBe(TOKEN);
  });

  it('starts signed out without requests or token writes and has a stable snapshot', () => {
    const h = harness({ savedToken: TOKEN });
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', lastError: null, remoteLogoutPending: false });
    expect(h.store.getSnapshot()).toBe(h.store.getSnapshot());
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.storage?.setItem).not.toHaveBeenCalled();
    expect(h.store.getAccountToken()).toBeNull();
  });

  it('stores only the token, not identity, and guards token access by linked session', async () => {
    const h = harness();
    const listener = vi.fn();
    const unsubscribe = h.store.subscribe(listener);
    await h.signIn();
    expect(h.storage?.getItem(tokenKey)).toBe(TOKEN);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', identity: entry().account, linkedSessionId: 'session_tab', tokenPersistence: 'localStorage' });
    expect(JSON.stringify(h.store.getSnapshot())).not.toContain(TOKEN);
    expect(h.store.getAccountToken()).toBe(TOKEN);
    expect(h.store.getAccountTokenForSession('session_tab')).toBe(TOKEN);
    expect(h.store.getAccountTokenForSession('another_tab')).toBeNull();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await h.store.logout();
    expect(listener).not.toHaveBeenCalled();
    expect(h.storage?.getItem(tokenKey)).toBeNull();
    expect(h.preferences.getSnapshot()).toEqual(envelope().values);
  });

  it('resumes a stored token without rewriting it and has no identity during checking', async () => {
    const h = harness({ savedToken: TOKEN });
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const resume = h.store.resume();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'resuming' });
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    expect(h.store.getAccountToken()).toBeNull();
    response.resolve(json(resumed()));
    await resume;
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', linkedSessionId: null });
    expect(h.store.getAccountTokenForSession('session_tab')).toBeNull();
    expect(h.storage?.setItem).not.toHaveBeenCalledWith(tokenKey, expect.anything());
  });

  it.each([null, 'throwing'] as const)('keeps sign-in and resume in memory with %s storage', async (mode) => {
    const storage = mode === null ? null : {
      getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    } as unknown as Storage;
    const h = harness({ storage });
    await h.signIn();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', tokenPersistence: 'memory' });
    await h.store.resume();
    expect(h.store.getSnapshot().status).toBe('signedIn');
    await h.store.logout();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: 'LOGGED_OUT' });
    expect(h.store.getAccountToken()).toBeNull();
  });

  it('does not request resume without a token', async () => {
    const h = harness();
    await h.store.resume(SESSION_TOKEN);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: 'ACCOUNT_TOKEN_REQUIRED' });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('logout does not adopt or revoke a sibling replacement token before resume', async () => {
    const h = harness();
    await h.signIn();
    h.external(tokenKey, OTHER_TOKEN);
    await h.store.logout();
    expect(h.fetchMock).toHaveBeenCalledOnce();
    expect(h.storage?.getItem(tokenKey)).toBe(OTHER_TOKEN);
    expect(h.store.getSnapshot().status).toBe('signedOut');
  });

  it('blocked storage deletion cannot restore authority in this tab', async () => {
    const h = harness({ savedToken: TOKEN });
    await h.store.resume();
    vi.mocked(h.storage!.removeItem).mockImplementationOnce(() => { throw new Error('blocked deletion'); });
    await h.store.logout();
    expect(h.storage?.getItem(tokenKey)).toBe(TOKEN);
    await h.store.resume();
    expect(h.store.getSnapshot().status).toBe('signedOut');
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    h.external(tokenKey, OTHER_TOKEN);
    await h.store.resume();
    expect(h.store.getSnapshot().status).toBe('signedIn');
    expect(new Headers(h.fetchMock.mock.calls[2][1]?.headers).get('X-Account-Token')).toBe(OTHER_TOKEN);
  });

  it('claims using supplied guest preferences without touching game session or player storage', async () => {
    const h = harness();
    const poison = new Proxy({}, { get() { throw new Error('session/player storage must not be accessed'); } });
    vi.stubGlobal('sessionStorage', poison);
    vi.stubGlobal('localStorage', poison);
    const guest = envelope('1', { soundEnabled: false, battleLogPreferred: true }).values;
    await h.store.claim({ name: 'Pilot1', password: 'synthetic-password', turnstileToken: 'proof', preferences: guest }, SESSION_TOKEN);
    const [, init] = h.fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body)).preferences).toEqual(guest);
    expect(new Headers(init?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect([...h.data.keys()].sort()).toEqual([tokenKey, ...Object.values(keys)].sort());
    expect(h.store.getSnapshot().status).toBe('signedIn');
  });

  it('changes a password and installs its fresh token', async () => {
    const h = harness();
    h.fetchMock.mockResolvedValueOnce(json(entry(OTHER_TOKEN)));
    await h.store.changePassword({ name: 'Pilot1', currentPassword: 'temporary-password', newPassword: 'new-password' }, SESSION_TOKEN);
    expect(h.storage?.getItem(tokenKey)).toBe(OTHER_TOKEN);
    expect(h.store.getSnapshot().status).toBe('signedIn');
  });

  it('keeps only the name for password-change-required', async () => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error('PASSWORD_CHANGE_REQUIRED', 403));
    await h.signIn();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'passwordChangeRequired', name: 'Pilot1', lastError: { code: 'PASSWORD_CHANGE_REQUIRED' } });
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    expect(h.store.getAccountToken()).toBeNull();
    expect(h.storage?.getItem(tokenKey)).toBeNull();
  });

  it.each(['CAPTCHA_REQUIRED', 'RATE_LIMITED', 'AUTH_BUSY', 'INVALID_CREDENTIALS', 'SESSION_LINK_CONFLICT', 'ACCOUNTS_NOT_ENABLED'])('leaves entry state unchanged on %s and exposes inline error', async (code) => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error(code, 403, { field: 'password', retryAfterSeconds: 2 }));
    await h.signIn();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', lastError: { code, field: 'password', retryAfterSeconds: 2 } });
    expect(h.storage?.getItem(tokenKey)).toBe(TOKEN);
  });

  it('returns name checks, exposes errors and clears them on success', async () => {
    const h = harness();
    h.fetchMock.mockResolvedValueOnce(error('INVALID_NAME', 400, { field: 'name' }));
    expect(await h.store.nameCheck('bad name')).toMatchObject({ kind: 'error', code: 'INVALID_NAME' });
    expect(h.store.getSnapshot().lastError).toEqual({ code: 'INVALID_NAME', field: 'name' });
    expect(await h.store.nameCheck('Pilot1')).toMatchObject({ kind: 'ok' });
    expect(h.store.getSnapshot().lastError).toBeNull();
  });

  it('imports the runtime and hook without accessing browser storage or starting requests', async () => {
    vi.resetModules();
    const browser = new EventTarget();
    const storageAccess = vi.fn(() => { throw new Error('not on import'); });
    Object.defineProperty(browser, 'localStorage', { get: storageAccess });
    vi.stubGlobal('window', browser);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await import('../../account/useAccountState');
    const runtime = await import('../../account/accountStore');
    expect(storageAccess).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    const store = runtime.getAccountStore();
    expect(store.getSnapshot().status).toBe('signedOut');
    expect(runtime.getAccountStore()).toBe(store);
    expect(fetchSpy).not.toHaveBeenCalled();
    store.dispose();
  });
});

describe('account generation fencing', () => {
  it('ignores a resume that finishes after logout', async () => {
    const h = harness({ savedToken: TOKEN });
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const resume = h.store.resume();
    await h.store.logout();
    response.resolve(json(resumed()));
    await resume;
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: 'LOGGED_OUT' });
    expect(h.storage?.getItem(tokenKey)).toBeNull();
  });

  it.each(['claim', 'signIn', 'changePassword'] as const)('best-effort revokes a stale %s fresh token', async (operation) => {
    const h = harness();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const request = operation === 'claim'
      ? h.store.claim({ name: 'Pilot1', password: 'synthetic-password', turnstileToken: 'proof', preferences: envelope().values }, SESSION_TOKEN)
      : operation === 'signIn' ? h.signIn()
        : h.store.changePassword({ name: 'Pilot1', currentPassword: 'old-password', newPassword: 'new-password' }, SESSION_TOKEN);
    await h.store.logout();
    response.resolve(json(entry(), operation === 'claim' ? 201 : 200));
    await request;
    expect(h.store.getSnapshot().status).toBe('signedOut');
    expect(h.storage?.getItem(tokenKey)).toBeNull();
    const calls = h.fetchMock.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toMatch(/\/accounts\/logout$/);
    expect(new Headers(calls[1][1]?.headers).get('X-Account-Token')).toBe(TOKEN);
  });

  it('a late old logout cannot erase a new sign-in or its pending saves', async () => {
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const logout = h.store.logout();
    h.fetchMock.mockResolvedValueOnce(json(entry(OTHER_TOKEN, OTHER_ACCOUNT_ID, 'Pilot2')));
    await h.signIn();
    response.resolve(new Response(null, { status: 204 }));
    await logout;
    expect(h.storage?.getItem(tokenKey)).toBe(OTHER_TOKEN);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', identity: { displayName: 'Pilot2' } });
  });

  it('a failed old logout exposes pending revocation without changing a new identity or error', async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const logout = h.store.logout();
    h.fetchMock.mockResolvedValueOnce(json(entry(OTHER_TOKEN, OTHER_ACCOUNT_ID, 'Pilot2')));
    await h.signIn();
    response.resolve(error('ACCOUNT_SERVICE_UNAVAILABLE', 503, { retryAfterSeconds: 5 }));
    await logout;
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', identity: { displayName: 'Pilot2' }, lastError: null, remoteLogoutPending: true });
    expect(h.storage?.getItem(tokenKey)).toBe(OTHER_TOKEN);
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', lastError: null, remoteLogoutPending: false });
  });

  it('the last invoked entry operation wins and superseded fresh tokens are revoked', async () => {
    const h = harness();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const old = h.signIn();
    h.fetchMock.mockResolvedValueOnce(json(entry(OTHER_TOKEN, OTHER_ACCOUNT_ID, 'Pilot2')));
    await h.signIn();
    response.resolve(json(entry()));
    await old;
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', identity: { displayName: 'Pilot2' } });
    expect(h.storage?.getItem(tokenKey)).toBe(OTHER_TOKEN);
    expect(new Headers(h.fetchMock.mock.calls.at(-1)?.[1]?.headers).get('X-Account-Token')).toBe(TOKEN);
  });

  it('dispose cancels timers/listeners and ignores pending resume', async () => {
    vi.useFakeTimers();
    const h = harness({ savedToken: TOKEN });
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const resume = h.store.resume();
    const listener = vi.fn();
    h.store.subscribe(listener);
    h.store.dispose();
    h.store.dispose();
    response.resolve(json(resumed()));
    await resume;
    h.events.dispatchEvent(new Event('online'));
    h.external(tokenKey, OTHER_TOKEN);
    expect(listener).not.toHaveBeenCalled();
    expect(h.fetchMock).toHaveBeenCalledOnce();
    expect(h.store.getAccountToken()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('account resume and cross-tab behavior', () => {
  it('retries GAME_SESSION_INVALID once without S, preserving account identity independently', async () => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockResolvedValueOnce(error('GAME_SESSION_INVALID', 401));
    await h.store.resume(SESSION_TOKEN);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(h.fetchMock.mock.calls[0][1]?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(new Headers(h.fetchMock.mock.calls[1][1]?.headers).has('X-Session-Token')).toBe(false);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', linkedSessionId: null });
  });

  it('does not repeat the session fallback after the second failure', async () => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockResolvedValueOnce(error('GAME_SESSION_INVALID', 401)).mockResolvedValueOnce(error('GAME_SESSION_INVALID', 401));
    await h.store.resume(SESSION_TOKEN);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(h.storage?.getItem(tokenKey)).toBe(TOKEN);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'unavailable', lastError: { code: 'GAME_SESSION_INVALID' } });
  });

  it.each(['ACCOUNT_TOKEN_REQUIRED', 'ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED', 'ACCOUNT_TOKEN_REVOKED', 'ACCOUNT_BLOCKED', 'NAME_BANNED'])('clears remembered authority on %s', async (code) => {
    const h = harness({ savedToken: TOKEN });
    h.fetchMock.mockResolvedValueOnce(error(code, 403));
    await h.store.resume();
    expect(h.storage?.getItem(tokenKey)).toBeNull();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: code, lastError: { code } });
  });

  it.each(['ACCOUNTS_NOT_ENABLED', 'RATE_LIMITED', 'ACCOUNT_SERVICE_UNAVAILABLE', 'offline'])('keeps the token and has no automatic retry loop for %s', async (code) => {
    vi.useFakeTimers();
    const h = harness({ savedToken: TOKEN });
    if (code === 'offline') h.fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    else h.fetchMock.mockResolvedValueOnce(error(code, 503, code === 'ACCOUNTS_NOT_ENABLED' ? {} : { retryAfterSeconds: 5 }));
    await h.store.resume();
    expect(h.store.getSnapshot().status).toBe(code === 'ACCOUNTS_NOT_ENABLED' ? 'dormant' : 'unavailable');
    expect(h.store.getSnapshot()).not.toHaveProperty('identity');
    expect(h.store.getAccountToken()).toBeNull();
    expect(h.storage?.getItem(tokenKey)).toBe(TOKEN);
    h.events.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(h.fetchMock).toHaveBeenCalledOnce();
  });

  it.each([null, OTHER_TOKEN])('removal/replacement %s signs out and cancels saves without adopting another token', async (newValue) => {
    vi.useFakeTimers();
    const h = harness();
    await h.signIn();
    h.preferences.setPreference('soundEnabled', false);
    h.external(tokenKey, newValue);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: 'LOGGED_OUT' });
    expect(h.store.getAccountToken()).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.fetchMock).toHaveBeenCalledOnce();
    if (newValue) {
      await h.store.resume();
      expect(new Headers(h.fetchMock.mock.calls[1][1]?.headers).get('X-Account-Token')).toBe(OTHER_TOKEN);
      expect(h.store.getSnapshot().status).toBe('signedIn');
    }
  });

  it('storage clearing cancels an in-flight resume', async () => {
    const h = harness({ savedToken: TOKEN });
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    const resume = h.store.resume();
    h.external(null, null);
    response.resolve(json(resumed()));
    await resume;
    expect(h.store.getSnapshot().status).toBe('signedOut');
  });

  it('ignores unrelated storage and delayed events after a newer local sign-in', async () => {
    const h = harness();
    await h.signIn();
    h.external('other-key', null);
    h.events.dispatchEvent(Object.assign(new Event('storage'), { key: tokenKey, oldValue: 'older', newValue: null, storageArea: h.storage }));
    h.events.dispatchEvent(Object.assign(new Event('storage'), { key: tokenKey, oldValue: TOKEN, newValue: null, storageArea: null }));
    h.events.dispatchEvent(new Event('storage'));
    expect(h.store.getSnapshot().status).toBe('signedIn');
  });
});

describe('remote logout', () => {
  it('clears storage and publishes signed out before issuing the request', async () => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockImplementationOnce(async () => {
      expect(h.storage?.getItem(tokenKey)).toBeNull();
      expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: 'LOGGED_OUT' });
      expect(h.store.getAccountToken()).toBeNull();
      return new Response(null, { status: 204 });
    });
    await h.store.logout();
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(false);
  });

  it('keeps a failed revocation in memory and retries on online', async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.signIn();
    h.fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await h.store.logout();
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(true);
    expect(h.store.getSnapshot().lastError).toEqual({ code: 'ACCOUNT_SERVICE_UNAVAILABLE' });
    expect(h.storage?.getItem(tokenKey)).toBeNull();
    h.events.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(false);
    expect(new Headers(h.fetchMock.mock.calls[2][1]?.headers).get('X-Account-Token')).toBe(TOKEN);
  });

  it('backs off only three times and leaves revocation pending until a later online event', async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.signIn();
    h.fetchMock.mockRejectedValue(new TypeError('offline'));
    await h.store.logout();
    await vi.advanceTimersByTimeAsync(999);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.fetchMock).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(100000);
    expect(h.fetchMock).toHaveBeenCalledTimes(5);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(true);
  });

  it('respects Retry-After even when an online event arrives', async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error('RATE_LIMITED', 429, { retryAfterSeconds: 5 }));
    await h.store.logout();
    h.events.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(4999);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(false);
  });

  it.each(['ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED', 'ACCOUNT_TOKEN_REVOKED', 'ACCOUNT_TOKEN_REQUIRED', 'ACCOUNT_BLOCKED'])('credential rejection %s completes logout', async (code) => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error(code, 401));
    await h.store.logout();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', remoteLogoutPending: false });
  });

  it('does not retry disabled accounts automatically', async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error('ACCOUNTS_NOT_ENABLED', 503));
    await h.store.logout();
    h.events.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(h.store.getSnapshot().remoteLogoutPending).toBe(true);
  });
});
