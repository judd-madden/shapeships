import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeAccountSession } from '../../gameSession/accountSessionWiring';
import {
  cleanup, deferred, entry, error, harness, json, memoryStorage, resumed, SESSION_TOKEN, TOKEN,
} from './fixtures';

const { storeProvider } = vi.hoisted(() => ({ storeProvider: vi.fn() }));
vi.mock('../../account/accountStore', async (original) => ({
  ...await original<typeof import('../../account/accountStore')>(), getAccountStore: storeProvider,
}));

const { storage } = memoryStorage();
let network: typeof import('../../../../utils/sessionManager');
let h: ReturnType<typeof harness>;
let gameFetch: ReturnType<typeof vi.fn<typeof fetch>>;
const unsubscribers: (() => void)[] = [];

function seedSession(sessionId = 'session_tab', token = SESSION_TOKEN) {
  storage.setItem('ss_sessionToken', token);
  storage.setItem('ss_sessionId', sessionId);
}

function linked(sessionId: string) {
  return { ...resumed(true), link: { ...entry().link, sessionId } };
}

beforeEach(async () => {
  h = harness();
  storeProvider.mockReturnValue(h.store);
  gameFetch = vi.fn<typeof fetch>(async () => json({ gameId: 'created' }));
  vi.stubGlobal('fetch', gameFetch);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  network = await import('../../../../utils/sessionManager');
  network.clearSession();
  storage.clear();
  seedSession();
});

afterEach(() => {
  unsubscribers.splice(0).forEach((stop) => stop());
  network.clearSession();
  cleanup();
});

describe('game account transport', () => {
  it('never sends A for a guest, including a caller-supplied forged header', async () => {
    await network.authenticatedFetch('/create-game', { method: 'POST', headers: new Headers({ 'X-Account-Token': 'forged' }) });
    const headers = new Headers(gameFetch.mock.calls[0][1]?.headers);
    expect(headers.has('X-Account-Token')).toBe(false);
    expect(headers.get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(headers.get('Authorization')).not.toContain(SESSION_TOKEN);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('attaches the linked token and preserves successful reads without resume or body parsing', async () => {
    await h.signIn();
    const response = json({ arbitrary: 'read' });
    const clone = vi.spyOn(response, 'clone');
    gameFetch.mockResolvedValueOnce(response);
    const result = await network.authenticatedGet('/game-state/game1');
    expect(result).toBe(response);
    expect(clone).not.toHaveBeenCalled();
    expect(new Headers(gameFetch.mock.calls[0][1]?.headers).get('X-Account-Token')).toBe(TOKEN);
    expect(h.fetchMock).toHaveBeenCalledOnce();
  });

  it('links an unbound signed-in session before any game request', async () => {
    await h.signIn();
    await h.store.resume();
    expect(h.store.getAccountTokenForSession('session_tab')).toBeNull();
    gameFetch.mockImplementationOnce(async () => {
      expect(h.store.getAccountTokenForSession('session_tab')).toBe(TOKEN);
      return json({ gameId: 'created' });
    });
    await network.authenticatedPost('/create-game', { playerName: 'Pilot1' });
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(h.fetchMock.mock.calls[2][1]?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(new Headers(gameFetch.mock.calls[0][1]?.headers).get('X-Account-Token')).toBe(TOKEN);
  });

  it('creates a new signed-in session without name or A, then links it before the request', async () => {
    await h.signIn();
    network.clearSession();
    gameFetch.mockResolvedValueOnce(json({ sessionToken: 'fresh-S', sessionId: 'fresh-id', displayName: null }));
    h.fetchMock.mockResolvedValueOnce(json(linked('fresh-id')));
    await network.ensureSession('Pilot1');
    const start = gameFetch.mock.calls[0][1];
    expect(start?.body).toBeUndefined();
    expect(new Headers(start?.headers).has('X-Account-Token')).toBe(false);
    await network.authenticatedPost('/create-game', { playerName: 'Pilot1' });
    expect(new Headers(h.fetchMock.mock.calls[1][1]?.headers).get('X-Session-Token')).toBe('fresh-S');
    expect(new Headers(gameFetch.mock.calls[1][1]?.headers).get('X-Account-Token')).toBe(TOKEN);
  });

  it('does not send a game request when linking fails, and retains remembered authority on outage', async () => {
    await h.signIn();
    await h.store.resume();
    h.fetchMock.mockResolvedValueOnce(new Response('offline', { status: 503 }));
    const enter = vi.fn();
    unsubscribers.push(network.subscribeSessionEntryRequired(enter));
    await expect(network.authenticatedPost('/create-game', {})).rejects.toMatchObject({ code: 'GAME_SESSION_INVALID' });
    expect(gameFetch).not.toHaveBeenCalled();
    expect(enter).toHaveBeenCalledOnce();
    expect(network.getSessionToken()).toBeNull();
    expect(h.store.hasRememberedToken()).toBe(true);
  });

  it.each(['ACCOUNT_TOKEN_REQUIRED', 'ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED', 'ACCOUNT_BLOCKED', 'NAME_BANNED'])(
  'revalidates %s once without replaying the game request', async (code) => {
    await h.signIn();
    const response = json({ error: code, message: 'safe' }, 403);
    gameFetch.mockResolvedValueOnce(response);
    expect(await network.authenticatedPost('/create-game', {})).toBe(response);
    expect(await response.json()).toEqual({ error: code, message: 'safe' });
    expect(gameFetch).toHaveBeenCalledOnce();
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(h.fetchMock.mock.calls[1][1]?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
  });

  it.each([200, 401])('recognizes the intent rejected envelope at HTTP %s', async (status) => {
    await h.signIn();
    const body = { ok: false, state: null, events: [], rejected: { code: 'ACCOUNT_TOKEN_INVALID', message: 'safe' } };
    gameFetch.mockResolvedValueOnce(json(body, status));
    expect(await (await network.authenticatedPost('/intent', {})).json()).toEqual(body);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(gameFetch).toHaveBeenCalledOnce();
  });

  it('coalesces overlapping account revalidations', async () => {
    await h.signIn();
    const pending = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(pending.promise);
    gameFetch.mockImplementation(async () => json({ error: 'ACCOUNT_TOKEN_INVALID' }, 401));
    const requests = [network.authenticatedPost('/intent', {}), network.authenticatedPost('/intent', {})];
    await vi.waitFor(() => expect(h.fetchMock).toHaveBeenCalledTimes(2));
    // Both error handlers must join the same outstanding resume.
    await vi.waitFor(() => expect(gameFetch).toHaveBeenCalledTimes(2));
    pending.resolve(json(resumed(true)));
    await Promise.all(requests);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['ACCOUNT_TOKEN_EXPIRED', 'ACCOUNTS_NOT_ENABLED', 'unavailable'])(
  'resets a signed-in tab after revalidation returns %s', async (code) => {
    await h.signIn();
    const enter = vi.fn(() => network.clearSession());
    unsubscribers.push(observeAccountSession(h.store, enter));
    h.fetchMock.mockResolvedValueOnce(code === 'unavailable' ? new Response('offline', { status: 503 }) : error(code, 403));
    gameFetch.mockResolvedValueOnce(json({ error: 'ACCOUNT_TOKEN_INVALID' }, 401));
    await network.authenticatedPost('/intent', {});
    expect(enter).toHaveBeenCalledOnce();
    expect(network.getSessionToken()).toBeNull();
    expect(h.store.hasRememberedToken()).toBe(code !== 'ACCOUNT_TOKEN_EXPIRED');
    expect(gameFetch).toHaveBeenCalledOnce();
  });

  it.each(['logout', 'outage'])('starts a fresh named guest session at Entry after %s', async (reason) => {
    await h.signIn();
    unsubscribers.push(observeAccountSession(h.store, () => network.clearSession()));
    if (reason === 'logout') await h.store.logout();
    else {
      h.fetchMock.mockResolvedValueOnce(error('ACCOUNTS_NOT_ENABLED', 503));
      await h.store.resume(SESSION_TOKEN);
    }
    expect(network.getSessionToken()).toBeNull();
    gameFetch.mockResolvedValueOnce(json({ sessionToken: 'guest-S', sessionId: 'guest-id', displayName: 'EntryGuest' }));
    await network.ensureSession('EntryGuest');
    await network.authenticatedPost('/create-game', { playerName: 'EntryGuest' });
    expect(JSON.parse(String(gameFetch.mock.calls[0][1]?.body))).toEqual({ displayName: 'EntryGuest' });
    expect(new Headers(gameFetch.mock.calls[1][1]?.headers).has('X-Account-Token')).toBe(false);
    expect(network.getSessionToken()).toBe('guest-S');
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(h.store.hasRememberedToken()).toBe(reason === 'outage');
  });
});

describe('guest assignment refusals and session recovery', () => {
  const routes = ['/create-game', '/create-computer-game', '/join-game/invite', '/new-game-from/source', '/reset-win-streak/source', '/switch-role/source'];
  const codes = ['INVALID_NAME', 'NAME_RESERVED', 'NAME_BANNED', 'CLAIMED_NAME_REQUIRES_ACCOUNT'];
  it.each(routes.flatMap((route) => codes.map((code) => [route, code])))('%s refuses %s and preserves invite context', async (route, code) => {
    const enter = vi.fn();
    unsubscribers.push(network.subscribeSessionEntryRequired(enter));
    const body = { error: code, message: 'safe' };
    gameFetch.mockResolvedValueOnce(json(body, code === 'INVALID_NAME' ? 400 : 403));
    expect(await (await network.authenticatedPost(route, {})).json()).toEqual(body);
    expect(enter).toHaveBeenCalledExactlyOnceWith({ code, inviteGameId: route === '/join-game/invite' ? 'invite' : undefined });
    expect(network.getSessionToken()).toBeNull();
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it.each(codes)('preserves typed session-start refusal %s', async (code) => {
    network.clearSession();
    const enter = vi.fn();
    unsubscribers.push(network.subscribeSessionEntryRequired(enter));
    gameFetch.mockResolvedValueOnce(json({ error: code }, 403));
    await expect(network.ensureSession('EntryName')).rejects.toMatchObject({ name: 'SessionRequestError', code, status: 403 });
    expect(enter).toHaveBeenCalledExactlyOnceWith({ code });
    expect(network.getSessionToken()).toBeNull();
  });

  it('leaves other failures and guest reads unchanged', async () => {
    const enter = vi.fn();
    unsubscribers.push(network.subscribeSessionEntryRequired(enter));
    gameFetch.mockResolvedValueOnce(json({ error: 'INTERNAL_ERROR' }, 500));
    expect((await network.authenticatedPost('/create-game', {})).status).toBe(500);
    expect(enter).not.toHaveBeenCalled();
    expect(network.getSessionToken()).toBe(SESSION_TOKEN);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('preserves a refusal code when opt-in expired-session recovery creates a session', async () => {
    gameFetch.mockResolvedValueOnce(json({ message: 'Invalid or expired session token' }, 401));
    gameFetch.mockResolvedValueOnce(json({ error: 'NAME_RESERVED' }, 403));
    await expect(network.authenticatedPostWithSessionRecovery('/create-game', {}, 'EntryName'))
      .rejects.toMatchObject({ code: 'NAME_RESERVED' });
    expect(gameFetch).toHaveBeenCalledTimes(2);
  });

  it('links a recovered signed-in session before its existing single retry', async () => {
    await h.signIn();
    gameFetch.mockResolvedValueOnce(json({ message: 'Invalid or expired session token' }, 401));
    gameFetch.mockResolvedValueOnce(json({ sessionToken: 'fresh-S', sessionId: 'fresh-id', displayName: null }));
    h.fetchMock.mockResolvedValueOnce(json(linked('fresh-id')));
    await network.authenticatedPostWithSessionRecovery('/create-game', { playerName: 'Pilot1' }, 'Pilot1');
    expect(gameFetch.mock.calls[1][1]?.body).toBeUndefined();
    expect(new Headers(gameFetch.mock.calls[2][1]?.headers).get('X-Account-Token')).toBe(TOKEN);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never treats an account rejection as permission to replace a game session', async () => {
    await h.signIn();
    gameFetch.mockResolvedValueOnce(json({ error: 'ACCOUNT_TOKEN_INVALID', message: 'Invalid or expired session token' }, 401));
    await network.authenticatedPostWithSessionRecovery('/create-game', {}, 'Pilot1');
    expect(gameFetch).toHaveBeenCalledOnce();
    expect(network.getSessionToken()).toBe(SESSION_TOKEN);
  });

  it('coalesces concurrent session creation without changing the chosen Entry name', async () => {
    network.clearSession();
    gameFetch.mockResolvedValueOnce(json({ sessionToken: 'fresh-S', sessionId: 'fresh-id', displayName: 'EntryName' }));
    const requests = [network.ensureSession('EntryName'), network.ensureSession('EntryName')];
    expect(requests[0]).toBe(requests[1]);
    await Promise.all(requests);
    expect(gameFetch).toHaveBeenCalledOnce();
    expect(JSON.parse(String(gameFetch.mock.calls[0][1]?.body))).toEqual({ displayName: 'EntryName' });
  });

  it('fences cached-session work cleared before its first continuation', async () => {
    const request = network.authenticatedPost('/create-game', {});
    network.clearSession();
    seedSession('new-id', 'new-token');
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(gameFetch).not.toHaveBeenCalled();
    expect(network.getSessionToken()).toBe('new-token');
  });

  it('fences an old creation response after the tab session is cleared', async () => {
    network.clearSession();
    const pending = deferred<Response>();
    gameFetch.mockReturnValueOnce(pending.promise);
    const old = network.ensureSession('OldName');
    const assertion = expect(old).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    network.clearSession();
    seedSession('new-id', 'new-token');
    pending.resolve(json({ sessionToken: 'old-token', sessionId: 'old-id', displayName: 'OldName' }));
    await assertion;
    expect(network.getSessionToken()).toBe('new-token');
  });

  it('does not let a late refusal clear the replacement session', async () => {
    const pending = deferred<Response>(), enter = vi.fn();
    unsubscribers.push(network.subscribeSessionEntryRequired(enter));
    gameFetch.mockReturnValueOnce(pending.promise);
    const request = network.authenticatedPost('/join-game/old-invite', {});
    const assertion = expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await vi.waitFor(() => expect(gameFetch).toHaveBeenCalledOnce());
    network.clearSession();
    seedSession('new-id', 'new-token');
    pending.resolve(json({ error: 'NAME_BANNED' }, 403));
    await assertion;
    expect(network.getSessionToken()).toBe('new-token');
    expect(enter).not.toHaveBeenCalled();
  });

  it('ignores a guest refusal arriving after sign-in linked the same session', async () => {
    const pending = deferred<Response>(), enter = vi.fn();
    unsubscribers.push(network.subscribeSessionEntryRequired(enter));
    gameFetch.mockReturnValueOnce(pending.promise);
    const request = network.authenticatedPost('/join-game/invite', {});
    const assertion = expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await vi.waitFor(() => expect(gameFetch).toHaveBeenCalledOnce());
    await h.signIn();
    pending.resolve(json({ error: 'NAME_BANNED' }, 403));
    await assertion;
    expect(network.getSessionToken()).toBe(SESSION_TOKEN);
    expect(h.store.getAccountTokenForSession('session_tab')).toBe(TOKEN);
    expect(enter).not.toHaveBeenCalled();
  });
});
