import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyGameLoadFailure, type GameLoadFailure } from '../../gameSession/clienteffects/useNetworkingEffects';
import { bootstrapRememberedAccount, SessionRequestError } from '../../gameSession/accountSessionWiring';
import { cleanup, deferred, harness, json, memoryStorage, SESSION_TOKEN, TOKEN } from '../account/fixtures';

const { storeProvider } = vi.hoisted(() => ({ storeProvider: vi.fn() }));
vi.mock('../../account/accountStore', async (original) => ({
  ...await original<typeof import('../../account/accountStore')>(), getAccountStore: storeProvider,
}));

// Execute production runtime/App callbacks with controlled state and transport;
// this follows the existing Entry callback tests and needs no UI or browser host.
const gameSource = readFileSync(new URL('../../useGameSession.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../../../App.tsx', import.meta.url), 'utf8');
const parsedFiles = new Map<string, ts.SourceFile>();
const compiledCallbacks = new Map<ts.Node, string>();
function production<T = any>(source: string, find: (node: ts.Node) => ts.Node | undefined, scope: Record<string, unknown>): T {
  let file = parsedFiles.get(source);
  if (!file) {
    file = ts.createSourceFile('production.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    parsedFiles.set(source, file);
  }
  const matches: ts.Node[] = [];
  const visit = (node: ts.Node) => { const match = find(node); if (match) matches.push(match); ts.forEachChild(node, visit); };
  visit(file);
  if (matches.length !== 1) throw new Error(`Expected one production callback, found ${matches.length}`);
  const selected = matches[0];
  let javascript = compiledCallbacks.get(selected);
  if (!javascript) {
    const expression = ts.isExpression(selected) || ts.isFunctionDeclaration(selected);
    javascript = ts.transpileModule(expression ? `const selected = (${selected.getText(file)});`
      : `const selected = () => { ${selected.getText(file)} };`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    compiledCallbacks.set(selected, javascript);
  }
  return new Function(...Object.keys(scope), `${javascript}\nreturn selected;`)(...Object.values(scope));
}
function callback(name: string, scope: Record<string, unknown>, source = gameSource): any {
  return production(source, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node;
    if (!ts.isVariableDeclaration(node) || node.name.getText() !== name || !node.initializer) return;
    return ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === 'useCallback'
      ? node.initializer.arguments[0] : node.initializer;
  }, scope);
}

const { storage } = memoryStorage();
let network: typeof import('../../../../utils/sessionManager');
let gameFetch: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(async () => {
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  storeProvider.mockReturnValue(harness().store);
  gameFetch = vi.fn<typeof fetch>(async () => json({})); vi.stubGlobal('fetch', gameFetch);
  network = await import('../../../../utils/sessionManager');
  network.clearSession(); storage.clear();
  storage.setItem('ss_sessionToken', SESSION_TOKEN); storage.setItem('ss_sessionId', 'same-session');
  for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { network.clearSession(); cleanup(); });

function runtime() {
  const loadScope = { gameId: 'source', active: true, attempt: 0, failure: null as GameLoadFailure | null,
    retrying: false, retryPromise: null as Promise<void> | null, finishRetry: null as (() => void) | null };
  const scope: Record<string, any> = {
    loadScope, loadScopeRef: { current: loadScope }, effectiveGameId: 'source',
    sessionGeneration: { current: network.getSessionGeneration() },
    getSessionGeneration: network.getSessionGeneration, getSessionToken: network.getSessionToken,
    SessionRequestError, classifyGameLoadFailure,
    sessionGet: network.authenticatedGet, sessionPost: network.authenticatedPost, sessionEnsure: network.ensureSession,
    setLoadFailureState: vi.fn(), setLoading: vi.fn(), setError: vi.fn(), setLoadAttempt: vi.fn(),
    attemptedJoinForGameRef: { current: new Set(['source']) }, setHasJoinedCurrentGame: vi.fn(),
    isComputerGame: false, winStreakGame: { actions: { requestBotRematch: vi.fn() } },
    attemptMobileGameFullscreen: vi.fn(), navigateToGameId: vi.fn(), setMultiplayerRematchError: vi.fn(),
  };
  for (const name of ['isCurrentLoadScope', 'reportLoadFailure', 'canAttemptLoad', 'completeInitialLoad',
    'assertGameSession', 'inspectGameResponse', 'authenticatedGet', 'authenticatedPost', 'ensureSession',
    'retryInitialLoad', 'handleRematch']) scope[name] = callback(name, scope);
  return scope;
}

describe('current-game request expiry fencing', () => {
  it.each(['/game-state/source', '/game-state-head/source', '/chat-state/source', '/intent', '/new-game-from/source'])(
  'latches expiry from %s once and sends no recovery or subsequent request', async (endpoint) => {
    const ctx = runtime();
    gameFetch.mockImplementation(async () => json({ message: 'Invalid or expired session token' }, 401));
    const send = () => endpoint === '/intent' || endpoint.startsWith('/new-game')
      ? ctx.authenticatedPost(endpoint, { gameId: 'source' }) : ctx.authenticatedGet(endpoint);
    expect((await send()).status).toBe(401);
    expect(ctx.loadScope.failure).toBe('sessionExpired');
    expect(ctx.setLoadFailureState).toHaveBeenCalledExactlyOnceWith({ gameId: 'source', failure: 'sessionExpired' });
    expect(ctx.canAttemptLoad()).toBe(false);
    await expect(send()).rejects.toMatchObject({ code: 'GAME_LOAD_SESSION_EXPIRED' });
    await expect(ctx.ensureSession('Guest')).rejects.toMatchObject({ code: 'GAME_LOAD_SESSION_EXPIRED' });
    expect(gameFetch).toHaveBeenCalledTimes(1);
    expect(new Headers(gameFetch.mock.calls[0][1]?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(network.getSessionToken()).toBe(SESSION_TOKEN);
    expect(ctx.setLoadFailureState).toHaveBeenCalledOnce();
  });
  it('latches simultaneous expiry responses only once', async () => {
    const ctx = runtime(), a = deferred<Response>(), b = deferred<Response>();
    gameFetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const requests = [ctx.authenticatedGet('/game-state-head/source'), ctx.authenticatedGet('/chat-state/source')];
    a.resolve(json({ message: 'Invalid or expired session token' }, 401));
    b.resolve(json({ message: 'Invalid or expired session token' }, 401));
    await Promise.allSettled(requests);
    expect(ctx.setLoadFailureState).toHaveBeenCalledExactlyOnceWith({ gameId: 'source', failure: 'sessionExpired' });
    expect(gameFetch).toHaveBeenCalledTimes(2);
  });
  it.each(['leave', 'game change', 'session change', 'new attempt'])('ignores late expiry after %s', async (change) => {
    const ctx = runtime(), response = deferred<Response>(); gameFetch.mockReturnValueOnce(response.promise);
    const request = ctx.authenticatedGet('/chat-state/source');
    // Let transport capture S before changing the runtime identity.
    await vi.waitFor(() => expect(gameFetch).toHaveBeenCalledOnce());
    if (change === 'leave') ctx.loadScope.active = false;
    if (change === 'game change') ctx.loadScopeRef.current = { ...ctx.loadScope, gameId: 'other' };
    if (change === 'session change') network.clearSession();
    if (change === 'new attempt') ctx.loadScope.attempt++;
    response.resolve(json({ message: 'Invalid or expired session token' }, 401));
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(ctx.setLoadFailureState).not.toHaveBeenCalled();
    expect(gameFetch).toHaveBeenCalledTimes(1);
  });
  it.each(['ss_sessionToken', 'ss_sessionId'])('blocks missing %s before transport can replace S', async (key) => {
    const ctx = runtime(); storage.removeItem(key);
    await expect(ctx.authenticatedGet('/game-state/source')).rejects.toMatchObject({ code: 'GAME_LOAD_SESSION_EXPIRED' });
    expect(ctx.loadScope.failure).toBe('sessionExpired'); expect(gameFetch).not.toHaveBeenCalled();
  });
});

describe('deliberate load retry lifecycle', () => {
  it('keeps the failure mounted, shares one pending attempt, and settles after valid load', async () => {
    const ctx = runtime(); ctx.reportLoadFailure('loadFailed');
    const pending = ctx.retryInitialLoad();
    expect(ctx.retryInitialLoad()).toBe(pending);
    expect(ctx.loadScope.failure).toBe('loadFailed'); expect(ctx.canAttemptLoad()).toBe(true);
    expect(ctx.loadScope.attempt).toBe(1); expect(ctx.setLoadAttempt).toHaveBeenCalledOnce();
    expect(ctx.attemptedJoinForGameRef.current.has('source')).toBe(false);
    expect(ctx.setHasJoinedCurrentGame).toHaveBeenCalledWith(false);
    expect((await ctx.ensureSession('Guest')).sessionId).toBe('same-session');
    expect(gameFetch).not.toHaveBeenCalled();
    ctx.completeInitialLoad(); await pending;
    expect(ctx.loadScope.failure).toBeNull(); expect(ctx.loadScope.retrying).toBe(false);
  });
  it('settles a failed retry and permits a later deliberate attempt', async () => {
    const ctx = runtime(); ctx.reportLoadFailure('loadFailed'); const first = ctx.retryInitialLoad();
    ctx.reportLoadFailure('loadFailed'); await first;
    expect(ctx.canAttemptLoad()).toBe(false);
    const next = ctx.retryInitialLoad(); expect(next).not.toBe(first);
    ctx.reportLoadFailure('sessionExpired'); await next;
    await ctx.retryInitialLoad(); expect(ctx.loadScope.attempt).toBe(2);
    ctx.completeInitialLoad(); expect(ctx.loadScope.failure).toBe('sessionExpired');
  });
  it('resets failure and fences the old scope when the game ID changes', async () => {
    const ctx = runtime(); ctx.reportLoadFailure('loadFailed'); const pending = ctx.retryInitialLoad();
    ctx.effectiveGameId = 'other';
    production<() => void>(gameSource, (node) => ts.isIfStatement(node)
      && node.expression.getText() === 'loadScopeRef.current.gameId !== effectiveGameId' ? node : undefined, ctx)();
    await pending;
    expect(ctx.loadScopeRef.current).toMatchObject({ gameId: 'other', failure: null, retrying: false });
    expect(ctx.isCurrentLoadScope()).toBe(false);
    const projected = callback('loadFailure', { effectiveGameId: 'other',
      loadFailureState: { gameId: 'source', failure: 'loadFailed' } });
    expect(projected).toBeNull();
  });
});

describe('multiplayer New Game feedback', () => {
  it.each(['http', 'exception', 'json', 'missing id', 'blank id'])('publishes %s failure through the existing helper override', async (kind) => {
    const ctx = runtime();
    if (kind === 'http') gameFetch.mockResolvedValue(json({}, 500));
    if (kind === 'exception') gameFetch.mockRejectedValue(new TypeError('offline'));
    if (kind === 'json') gameFetch.mockResolvedValue(new Response('invalid JSON'));
    if (kind === 'missing id') gameFetch.mockResolvedValue(json({}));
    if (kind === 'blank id') gameFetch.mockResolvedValue(json({ gameId: '  ' }));
    await ctx.handleRematch();
    const message = "Couldn't create a new game. Please try again.";
    expect(ctx.setMultiplayerRematchError.mock.calls).toEqual([[null], [message]]);
    const vm = { actionPanel: { endOfGame: { rematchHelperText: 'Link will be posted in chat' } } };
    production<() => void>(gameSource, (node) => ts.isIfStatement(node)
      && node.expression.getText() === '!isComputerGame && multiplayerRematchError && vm.actionPanel.endOfGame'
      ? node : undefined, { isComputerGame: false, multiplayerRematchError: message, vm })();
    expect(vm.actionPanel.endOfGame.rematchHelperText).toBe(message);
    expect(ctx.navigateToGameId).not.toHaveBeenCalled(); expect(gameFetch).toHaveBeenCalledOnce();
    gameFetch.mockResolvedValue(json({ gameId: 'server-destination' }));
    await ctx.handleRematch();
    expect(ctx.setMultiplayerRematchError).toHaveBeenLastCalledWith(null);
    expect(ctx.navigateToGameId).toHaveBeenCalledExactlyOnceWith('server-destination');
  });
  it.each(['leave', 'game change', 'session change', 'expiry'])('does not navigate after %s while the request is pending', async (change) => {
    const ctx = runtime(), response = deferred<Response>(); gameFetch.mockReturnValueOnce(response.promise);
    const request = ctx.handleRematch(); await vi.waitFor(() => expect(gameFetch).toHaveBeenCalledOnce());
    if (change === 'leave') ctx.loadScope.active = false;
    if (change === 'game change') ctx.loadScopeRef.current = { ...ctx.loadScope, gameId: 'other' };
    if (change === 'session change') network.clearSession();
    if (change === 'expiry') ctx.reportLoadFailure('sessionExpired');
    response.resolve(json({ gameId: 'late-destination' })); await request;
    expect(ctx.navigateToGameId).not.toHaveBeenCalled();
    expect(ctx.setMultiplayerRematchError).toHaveBeenCalledExactlyOnceWith(null);
  });
  it('also fences leaving while the successful response body is pending', async () => {
    const ctx = runtime(), body = deferred<unknown>(); const response = json({});
    vi.spyOn(response, 'json').mockReturnValue(body.promise);
    gameFetch.mockResolvedValue(response);
    const request = ctx.handleRematch(); await vi.waitFor(() => expect(response.json).toHaveBeenCalled());
    ctx.loadScope.active = false; body.resolve({ gameId: 'late-destination' }); await request;
    expect(ctx.navigateToGameId).not.toHaveBeenCalled();
  });
  it('shows expiry instead of a rematch helper error', async () => {
    const ctx = runtime(); gameFetch.mockResolvedValue(json({ message: 'Invalid or expired session token' }, 401));
    await ctx.handleRematch(); expect(ctx.loadScope.failure).toBe('sessionExpired');
    expect(ctx.setMultiplayerRematchError).toHaveBeenCalledExactlyOnceWith(null);
    expect(ctx.navigateToGameId).not.toHaveBeenCalled(); expect(gameFetch).toHaveBeenCalledOnce();
  });
  it('preserves the computer-rematch delegation', async () => {
    const ctx = runtime();
    const rematch = callback('handleRematch', { ...ctx, isComputerGame: true });
    await rematch(); expect(ctx.winStreakGame.actions.requestBotRematch).toHaveBeenCalledOnce();
    expect(gameFetch).not.toHaveBeenCalled(); expect(ctx.setMultiplayerRematchError).not.toHaveBeenCalled();
  });
});

describe('expired-session Return to Main Menu', () => {
  it.each([false, true])('clears S/player/invite and restarts normal startup (remembered account=%s)', async (remembered) => {
    const account = harness({ savedToken: remembered ? TOKEN : undefined });
    const lifecycleGeneration = { current: 0 }, pendingInviteRef = { current: 'expired-game' as string | null };
    for (const key of ['shapeships-player-id', 'shapeships-player-name', 'shapeships-is-spectator']) storage.setItem(key, 'old');
    storage.setItem('shapeships.winStreakProfile.v1', 'guest-profile');
    let url = '/?game=expired-game&view=gameScreenFull';
    const replace = vi.fn((target: string) => { url = target; });
    const clearPlayer = vi.fn(() => {
      for (const key of ['shapeships-player-id', 'shapeships-player-name', 'shapeships-is-spectator']) storage.removeItem(key);
    });
    const action = callback('returnAfterSessionExpired', { lifecycleGeneration, pendingInviteRef,
      clearSession: network.clearSession, clearPlayer, window: { location: { replace } } }, appSource);
    action();
    expect(network.getSessionToken()).toBeNull(); expect(storage.getItem('ss_sessionId')).toBeNull();
    expect(storage.getItem('shapeships-player-name')).toBeNull(); expect(clearPlayer).toHaveBeenCalledOnce();
    expect(url).toBe('/'); expect(pendingInviteRef.current).toBeNull(); expect(lifecycleGeneration.current).toBe(1);
    expect(storage.getItem('shapeships.winStreakProfile.v1')).toBe('guest-profile');
    expect(account.store.hasRememberedToken()).toBe(remembered);
    const outcome = await bootstrapRememberedAccount({ store: account.store, clearSession: network.clearSession,
      ensureSession: async () => ({ sessionToken: SESSION_TOKEN, sessionId: 'session_tab' }), requestedGameId: null });
    expect(outcome.destination).toBe(remembered ? 'menu' : 'guest');
  });
});
