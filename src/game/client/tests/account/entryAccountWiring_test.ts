import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEntryAccountActions, entryNoticeForRefusal } from '../../gameSession/accountSessionWiring';
import { entryState } from '../../account/entryForm';
import { cleanup, deferred, error, harness, SESSION_TOKEN, TOKEN } from './fixtures';

afterEach(cleanup);

function setup(savedToken?: string, invite: string | null = null) {
  const h = harness({ savedToken });
  let token: string | null = null;
  let generation = 0;
  const clearSession = vi.fn(() => { token = null; });
  const ensureSession = vi.fn(async () => {
    token ??= SESSION_TOKEN;
    return { sessionToken: token, sessionId: 'session_tab' };
  });
  const destinations: string[] = [];
  const actions = createEntryAccountActions({ store: h.store, ensureSession, clearSession,
    getSessionToken: () => token, getGeneration: () => generation, requestedGameId: () => invite,
    onSignedIn: () => destinations.push(invite ?? 'menu'),
  });
  return { ...h, actions, ensureSession, clearSession, destinations, getToken: () => token,
    invalidate: () => { generation++; token = null; } };
}
const credentials = { name: 'pilot1', password: 'temporary-password' };

describe('Entry account actions used by App', () => {
  it.each([null, 'pending-invite'])('starts unnamed and signs in with S before routing %s', async (invite) => {
    const h = setup(undefined, invite);
    expect(await h.actions.signIn(credentials)).toEqual({ kind: 'ok' });
    expect(h.ensureSession).toHaveBeenCalledExactlyOnceWith();
    const [url, request] = h.fetchMock.mock.calls[0];
    expect(url).toMatch(/\/accounts\/sign-in$/);
    expect(new Headers(request?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(JSON.parse(String(request?.body))).toEqual(credentials);
    expect(h.destinations).toEqual([invite ?? 'menu']);
    h.actions.leaveSignIn();
    expect(h.clearSession).not.toHaveBeenCalled();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', identity: { displayName: 'Pilot1' } });
  });

  it.each([null, 'invite'])('keeps S for forced change and routes %s only after save', async (invite) => {
    const h = setup(undefined, invite);
    h.fetchMock.mockResolvedValueOnce(error('PASSWORD_CHANGE_REQUIRED', 403));
    expect(await h.actions.signIn({ ...credentials, turnstileToken: 'consumed-sign-in-proof' })).toEqual({ kind: 'passwordChangeRequired' });
    expect(h.destinations).toEqual([]);
    expect(h.clearSession).not.toHaveBeenCalled();
    expect(await h.actions.changePassword({ name: credentials.name, currentPassword: credentials.password,
      newPassword: 'replacement-password', turnstileToken: 'fresh-password-proof' })).toEqual({ kind: 'ok' });
    const request = h.fetchMock.mock.calls[1][1];
    expect(new Headers(request?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(JSON.parse(String(request?.body))).toEqual({ name: credentials.name, currentPassword: credentials.password,
      newPassword: 'replacement-password', turnstileToken: 'fresh-password-proof' });
    expect(h.destinations).toEqual([invite ?? 'menu']);
    expect(h.storage!.getItem('shapeships-player-name')).toBeNull();
    expect(JSON.stringify([...h.data.entries()])).not.toContain(credentials.password);
  });

  it.each(['signIn', 'changePassword'] as const)('replaces invalid S once without replaying %s', async (operation) => {
    const h = setup();
    h.fetchMock.mockResolvedValueOnce(error('GAME_SESSION_INVALID', 401));
    const result = operation === 'signIn' ? await h.actions.signIn(credentials)
      : await h.actions.changePassword({ name: credentials.name, currentPassword: credentials.password, newPassword: 'replacement-password' });
    expect(result).toEqual({ kind: 'error', error: { code: 'GAME_SESSION_INVALID' } });
    expect(h.clearSession).toHaveBeenCalledOnce();
    expect(h.ensureSession.mock.calls).toEqual([[], []]);
    expect(h.fetchMock).toHaveBeenCalledOnce();
    expect(h.destinations).toEqual([]);
  });

  it.each(['signIn', 'changePassword'] as const)('defers abandonment cleanup until %s settles', async (operation) => {
    const h = setup(), pending = deferred<Response>();
    if (operation === 'changePassword') {
      h.fetchMock.mockResolvedValueOnce(error('PASSWORD_CHANGE_REQUIRED', 403));
      await h.actions.signIn(credentials);
    }
    h.fetchMock.mockReturnValueOnce(pending.promise);
    const work = operation === 'signIn' ? h.actions.signIn(credentials)
      : h.actions.changePassword({ name: credentials.name, currentPassword: credentials.password, newPassword: 'replacement-password' });
    await Promise.resolve();
    h.actions.leaveSignIn();
    expect(h.clearSession).not.toHaveBeenCalled();
    pending.resolve(error('INVALID_CREDENTIALS', 401));
    expect(await work).toEqual({ kind: 'cancelled' });
    expect(h.clearSession).toHaveBeenCalledOnce();
    expect(h.store.getSnapshot().status).toBe('signedOut');
  });

  it('cancels forced change and publishes ordinary Entry before using another name', async () => {
    const h = setup();
    h.fetchMock.mockResolvedValueOnce(error('PASSWORD_CHANGE_REQUIRED', 403));
    await h.actions.signIn(credentials);
    const subscriber = vi.fn(), stop = h.store.subscribe(subscriber);
    h.actions.leaveSignIn();
    expect(subscriber).toHaveBeenCalledOnce();
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', lastError: null });
    expect(h.getToken()).toBeNull();
    expect(h.fetchMock).toHaveBeenCalledOnce();
    stop();
  });

  it('does not navigate or clear a newer session after an Entry generation changes', async () => {
    const h = setup(), pending = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(pending.promise);
    const work = h.actions.signIn(credentials);
    await Promise.resolve();
    h.invalidate();
    pending.resolve(error('INVALID_CREDENTIALS', 401));
    expect(await work).toEqual({ kind: 'cancelled' });
    h.actions.leaveSignIn();
    expect(h.clearSession).not.toHaveBeenCalled();
    expect(h.destinations).toEqual([]);
  });
});

describe('Entry remembered-account retry', () => {
  it.each([null, 'invite'])('reuses unnamed bootstrap and routes %s on success', async (invite) => {
    const h = setup(TOKEN, invite);
    expect(await h.actions.retryRemembered()).toEqual({ kind: 'ok' });
    expect(h.ensureSession).toHaveBeenCalledExactlyOnceWith();
    expect(h.fetchMock.mock.calls[0][0]).toMatch(/\/accounts\/resume$/);
    expect(h.destinations).toEqual([invite ?? 'menu']);
  });
  it.each(['ACCOUNTS_NOT_ENABLED', 'ACCOUNT_SERVICE_UNAVAILABLE', 'ACCOUNT_TOKEN_EXPIRED'])(
    'retains/clears the remembered credential on %s without an automatic retry', async (code) => {
      const h = setup(TOKEN, 'invite');
      h.fetchMock.mockResolvedValueOnce(error(code, 403));
      expect(await h.actions.retryRemembered()).toEqual({ kind: 'error', error: { code } });
      expect(h.store.hasRememberedToken()).toBe(code !== 'ACCOUNT_TOKEN_EXPIRED');
      expect(h.getToken()).toBeNull();
      expect(h.fetchMock).toHaveBeenCalledOnce();
      expect(h.destinations).toEqual([]);
    },
  );
});

describe('one-shot refusal notice across Entry reset', () => {
  it.each(['INVALID_NAME', 'NAME_BANNED', 'NAME_RESERVED', 'CLAIMED_NAME_REQUIRES_ACCOUNT'])(
    'carries the submitted name and %s into the next Entry instance', (code) => {
      const notice = entryNoticeForRefusal('TypedName', code);
      expect(notice).toEqual({ name: 'TypedName', code });
      const initialName = notice!.name;
      const state = entryState(initialName, null, { code: notice!.code });
      expect(initialName).toBe('TypedName');
      if (code === 'CLAIMED_NAME_REQUIRES_ACCOUNT') expect(state.mode).toBe('claimed');
      else if (code === 'INVALID_NAME') expect(state.formatError).toBe(true);
      else expect(state.mode).toBe(code === 'NAME_BANNED' ? 'banned' : 'reserved');
    },
  );
  it('does not invent a name or parse unknown failures as refusals', () => {
    expect(entryNoticeForRefusal('', 'NAME_BANNED')).toBeNull();
    expect(entryNoticeForRefusal('TypedName', 'INTERNAL_ERROR')).toBeNull();
  });
});
