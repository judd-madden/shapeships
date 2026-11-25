import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapRememberedAccount, createEntryAccountActions, entryNoticeForRefusal, guestEntryFailure, SessionRequestError } from '../../gameSession/accountSessionWiring';
import type { EntryNotice, EntryResult } from '../../account/entryForm';
import { cleanup, deferred, error, harness, json, memoryStorage, SESSION_TOKEN, TOKEN } from './fixtures';

const { storeProvider } = vi.hoisted(() => ({ storeProvider: vi.fn() }));
vi.mock('../../account/accountStore', async (original) => ({
  ...await original<typeof import('../../account/accountStore')>(), getAccountStore: storeProvider,
}));

afterEach(cleanup);

// Execute production callbacks with fake App state/session seams; no UI or browser host.
const appSource = readFileSync(new URL('../../../../App.tsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../../../../components/ScreenManager.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../../../../components/panels/AlphaEntryPanel.tsx', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('../../../../utils/sessionManager.ts', import.meta.url), 'utf8');
function callback(source: string, matches: (node: ts.Node, file: ts.SourceFile) => ts.Node | undefined, scope: Record<string, unknown>) {
  const file = ts.createSourceFile('callbacks.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: ts.Node[] = [];
  function visit(node: ts.Node) {
    const match = matches(node, file);
    if (match) found.push(match);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (found.length !== 1) throw new Error('Expected exactly one production callback');
  const javascript = ts.transpileModule(`const selected = (${found[0].getText(file)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(scope), `${javascript}\nreturn selected;`)(...Object.values(scope));
}

describe('guest Entry session identity', () => {
  const { storage } = memoryStorage();
  let network: typeof import('../../../../utils/sessionManager');
  let h: ReturnType<typeof harness>;
  let gameFetch: ReturnType<typeof vi.fn<typeof fetch>>;

  function seedSession(name = 'OldGuest', token = SESSION_TOKEN, sessionId = 'session_tab') {
    storage.setItem('ss_sessionToken', token);
    storage.setItem('ss_sessionId', sessionId);
    storage.setItem('ss_displayName', name);
    storage.setItem('shapeships-player-id', 'local-player');
    storage.setItem('shapeships-player-name', name);
    storage.setItem('shapeships-is-spectator', 'false');
  }

  function guestCallbacks() {
    const lifecycleGeneration = { current: 0 }, submittedEntryName = { current: null as string | null };
    const usable = { current: true };
    const clearPlayer = vi.fn(() => {
      for (const key of ['shapeships-player-id', 'shapeships-player-name', 'shapeships-is-spectator']) storage.removeItem(key);
    });
    const updatePlayerName = vi.fn((name: string) => {
      storage.setItem('shapeships-player-id', 'local-player');
      storage.setItem('shapeships-player-name', name);
    });
    const setHasUsablePlayerIdentity = vi.fn((value: boolean) => { usable.current = value; });
    const start = callback(appSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'startPlayerSession'
      ? node.initializer : undefined, {
      renderGeneration: 0, lifecycleGeneration, submittedEntryName, SessionRequestError,
      ensureSession: network.ensureSession, clearSession: network.clearSession,
      getSessionDisplayName: network.getSessionDisplayName, getSessionGeneration: network.getSessionGeneration,
      clearPlayer, updatePlayerName, setHasUsablePlayerIdentity,
    }) as (name: string) => Promise<void>;
    const onPlay = callback(screenSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'handleNameSubmit'
      ? node.initializer : undefined, { onStartSession: start, guestEntryFailure }) as (name: string) => Promise<EntryResult>;
    return { onPlay, lifecycleGeneration, submittedEntryName, usable, clearPlayer, updatePlayerName, setHasUsablePlayerIdentity };
  }

  beforeEach(async () => {
    h = harness();
    storeProvider.mockReturnValue(h.store);
    gameFetch = vi.fn<typeof fetch>(async () => json({}));
    vi.stubGlobal('fetch', gameFetch);
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    network = await import('../../../../utils/sessionManager');
    network.clearSession();
    storage.clear();
    seedSession();
  });

  afterEach(() => network.clearSession());

  it.each(['OldGuest', '  OldGuest  '])('reuses the current S for the same trimmed name %s', async (name) => {
    const ui = guestCallbacks();
    expect(await ui.onPlay(name)).toEqual({ kind: 'ok' });
    expect(gameFetch).not.toHaveBeenCalled();
    expect(network.getSessionToken()).toBe(SESSION_TOKEN);
    expect(ui.clearPlayer).not.toHaveBeenCalled();
    expect(ui.updatePlayerName).toHaveBeenCalledExactlyOnceWith('OldGuest');
    expect(ui.setHasUsablePlayerIdentity).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each([
    ['NextGuest', 'OldGuest'],
    ['oldguest', 'OldGuest'],
    ['NextGuest', null],
    ['NextGuest', ''],
  ])('starts a fresh named S for %s with stored name %s', async (name, storedName) => {
    if (storedName === null) storage.removeItem('ss_displayName');
    else storage.setItem('ss_displayName', storedName);
    gameFetch.mockImplementationOnce(async () => {
      expect(network.getSessionToken()).toBeNull();
      expect(storage.getItem('ss_sessionId')).toBeNull();
      expect(storage.getItem('ss_displayName')).toBeNull();
      expect(storage.getItem('shapeships-player-name')).toBeNull();
      return json({ sessionToken: 'fresh-S', sessionId: 'fresh-id', displayName: name });
    });
    const ui = guestCallbacks();
    expect(await ui.onPlay(` ${name} `)).toEqual({ kind: 'ok' });
    expect(gameFetch).toHaveBeenCalledOnce();
    expect(String(gameFetch.mock.calls[0][0])).toMatch(/\/session\/start$/);
    expect(JSON.parse(String(gameFetch.mock.calls[0][1]?.body))).toEqual({ displayName: name });
    expect(network.getSessionToken()).toBe('fresh-S');
    expect(network.getSessionDisplayName()).toBe(name);
    expect(storage.getItem('shapeships-player-name')).toBe(name);
    expect(ui.setHasUsablePlayerIdentity.mock.calls).toEqual([[false], [true]]);
    expect(ui.submittedEntryName.current).toBeNull();
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('reports the normal Entry error after failed replacement, clears identity and permits retry', async () => {
    gameFetch.mockResolvedValueOnce(json({}, 503));
    const ui = guestCallbacks();
    expect(await ui.onPlay('NextGuest')).toEqual({ kind: 'error', error: { code: 'GUEST_SESSION_FAILED' } });
    for (const key of ['ss_sessionToken', 'ss_sessionId', 'ss_displayName',
      'shapeships-player-id', 'shapeships-player-name', 'shapeships-is-spectator']) expect(storage.getItem(key)).toBeNull();
    expect(ui.usable.current).toBe(false);
    expect(ui.updatePlayerName).not.toHaveBeenCalled();
    expect(ui.submittedEntryName.current).toBeNull();
    gameFetch.mockResolvedValueOnce(json({ sessionToken: 'retry-S', sessionId: 'retry-id', displayName: 'NextGuest' }));
    expect(await ui.onPlay('NextGuest')).toEqual({ kind: 'ok' });
    expect(network.getSessionToken()).toBe('retry-S');
    expect(ui.usable.current).toBe(true);
  });

  it.each(['session', 'lifecycle'])('does not clear a newer identity after a late failure fenced by %s', async (fence) => {
    const pending = deferred<Response>();
    gameFetch.mockReturnValueOnce(pending.promise);
    const ui = guestCallbacks();
    const result = ui.onPlay('NextGuest');
    expect(gameFetch).toHaveBeenCalledOnce();
    if (fence === 'session') network.clearSession();
    else ui.lifecycleGeneration.current++;
    seedSession('Replacement', 'replacement-S', 'replacement-id');
    ui.setHasUsablePlayerIdentity(true);
    pending.resolve(json({}, 503));
    expect(await result).toMatchObject({ kind: 'error' });
    expect(network.getSessionToken()).toBe('replacement-S');
    expect(network.getSessionDisplayName()).toBe('Replacement');
    expect(storage.getItem('shapeships-player-name')).toBe('Replacement');
    expect(ui.clearPlayer).toHaveBeenCalledOnce();
    expect(ui.usable.current).toBe(true);
    expect(ui.updatePlayerName).not.toHaveBeenCalled();
  });

  it.each([false, true])('links the current S during account sign-in with forced change=%s', async (forcedChange) => {
    const onSignedIn = vi.fn();
    const createActions = callback(appSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === '[entryActions]'
      && node.initializer && ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : undefined, {
      createEntryAccountActions, accountStore: h.store, ensureSession: network.ensureSession, clearSession: network.clearSession,
      getSessionToken: network.getSessionToken, lifecycleGeneration: { current: 0 }, pendingInviteRef: { current: null },
      setHasUsablePlayerIdentity: onSignedIn, setRememberedAccountBootstrapFailed: vi.fn(),
    }) as () => ReturnType<typeof createEntryAccountActions>;
    const actions = createActions();
    if (forcedChange) h.fetchMock.mockResolvedValueOnce(error('PASSWORD_CHANGE_REQUIRED', 403));
    expect(await actions.signIn({ name: 'Pilot1', password: 'synthetic-password' }))
      .toEqual({ kind: forcedChange ? 'passwordChangeRequired' : 'ok' });
    if (forcedChange) expect(await actions.changePassword({ name: 'Pilot1', currentPassword: 'synthetic-password', newPassword: 'new-password' }))
      .toEqual({ kind: 'ok' });
    expect(gameFetch).not.toHaveBeenCalled();
    expect(network.getSessionToken()).toBe(SESSION_TOKEN);
    expect(network.getSessionDisplayName()).toBe('OldGuest');
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', linkedSessionId: 'session_tab' });
    for (const [, init] of h.fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-Session-Token')).toBe(SESSION_TOKEN);
    expect(onSignedIn).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('logs the request endpoint and session ID without the token or its prefix', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await network.authenticatedGet('/diagnostic-probe');
    const output = JSON.stringify(debug.mock.calls);
    expect(output).toContain('/diagnostic-probe');
    expect(output).toContain('session_tab');
    expect(output).not.toContain(SESSION_TOKEN);
    expect(output).not.toContain(SESSION_TOKEN.slice(0, 6));
  });
});

describe('session Authorization misuse diagnostics', () => {
  it.each([false, true])('omits credential markers and preserves the DEV=%s throw', (isDev) => {
    const publicAnonKey = 'SYNTHETIC_EXPECTED_KEY_MARKER_1234567890';
    const authHeader = 'Bearer SYNTHETIC_SESSION_HEADER_MARKER';
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const guard = callback(sessionSource, (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'guardAgainstSessionTokenMisuse'
      ? node : undefined, { publicAnonKey, isDev }) as (headers: HeadersInit) => void;
    const misuse = () => guard({ Authorization: authHeader });
    if (isDev) expect(misuse).toThrow('SECURITY ERROR: Authorization header must be exactly Supabase anon key bearer token');
    else expect(misuse).not.toThrow();
    expect(logged).toHaveBeenCalledOnce();
    const output = JSON.stringify(logged.mock.calls);
    expect(output).toContain('SECURITY ERROR');
    expect(output).not.toContain(authHeader);
    expect(output).not.toContain('SYNTHETIC_SESSION_HEADER_MARKER');
    expect(output).not.toContain(publicAnonKey.slice(0, 16));
  });
});

describe('production App Entry callback wiring', () => {
  it('shows the remembered-account note after session-start failure, keeps it on failed retry, then opens Welcome', async () => {
    const h = harness({ savedToken: TOKEN });
    let failed = false;
    let sessionToken: string | null = null;
    const lifecycleGeneration = { current: 0 };
    const setRememberedAccountBootstrapFailed = (value: boolean) => { failed = value; };
    const clearSession = vi.fn(() => { sessionToken = null; });
    const ensureSession = vi.fn(async () => {
      sessionToken = SESSION_TOKEN;
      return { sessionToken, sessionId: 'session_tab' };
    }).mockRejectedValueOnce(new Error('server down')).mockRejectedValueOnce(new Error('still down'));
    const setHasUsablePlayerIdentity = vi.fn();
    const createActions = callback(appSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === '[entryActions]'
      && node.initializer && ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : undefined, {
      createEntryAccountActions, accountStore: h.store, ensureSession, clearSession,
      getSessionToken: () => sessionToken, lifecycleGeneration, pendingInviteRef: { current: null },
      setHasUsablePlayerIdentity, setRememberedAccountBootstrapFailed,
    }) as () => ReturnType<typeof createEntryAccountActions>;
    const actions = createActions();
    const outcome = await bootstrapRememberedAccount({ store: h.store, ensureSession, clearSession, requestedGameId: null });
    const resetPlayerSession = vi.fn(() => { lifecycleGeneration.current++; clearSession(); });
    const completeStartup = callback(appSource, (node) => ts.isCallExpression(node)
      && node.expression.getText() === 'bootstrapPromise.current.then' ? node.arguments[0] : undefined, {
      active: true, bootstrapInProgress: { current: true }, generation: 0, lifecycleGeneration, accountStore: h.store,
      setRememberedAccountBootstrapFailed, setHasUsablePlayerIdentity, resetPlayerSession,
      launchGame: vi.fn(), switchToPlayerMode: vi.fn(), startupGameId: null, setCheckingAccount: vi.fn(),
    }) as (result: typeof outcome) => void;
    completeStartup(outcome);
    expect(h.store.getSnapshot().status).toBe('signedOut');
    expect(h.store.hasRememberedToken()).toBe(true);
    expect(h.fetchMock).not.toHaveBeenCalled();
    const showsNote = () => callback(appSource, (node) => ts.isJsxAttribute(node) && node.name.getText() === 'rememberedAccountUnavailable'
      && node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined, {
      hasRememberedAccountToken: h.store.hasRememberedToken(), rememberedAccountBootstrapFailed: failed, account: h.store.getSnapshot(),
    }) as boolean;
    expect(failed).toBe(true);
    expect(showsNote()).toBe(true);
    expect(await actions.retryRemembered()).toMatchObject({ kind: 'error' });
    expect(failed).toBe(true);
    expect(showsNote()).toBe(true);
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(await actions.retryRemembered()).toEqual({ kind: 'ok' });
    expect(failed).toBe(false);
    expect(showsNote()).toBe(false);
    expect(setHasUsablePlayerIdentity).toHaveBeenCalledExactlyOnceWith(true);
    const setCurrentShell = vi.fn();
    const entered = callback(screenSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'handleEntered'
      ? node.initializer : undefined, { pendingInviteGameId: null, onLaunchGame: vi.fn(), setCurrentShell }) as () => void;
    entered();
    expect(setCurrentShell).toHaveBeenCalledExactlyOnceWith('menu');
    expect(h.fetchMock).toHaveBeenCalledOnce();
    expect(h.fetchMock.mock.calls[0][0]).toMatch(/\/accounts\/resume$/);
  });

  it.each([
    [false, 'signedOut', false],
    [true, 'signedIn', false],
    [true, 'signedOut', true],
  ] as const)('clears bootstrap-failure feedback for remembered=%s, status=%s', (hasRememberedAccountToken, status, expected) => {
    let failed = true;
    const effect = callback(appSource, (node) => ts.isCallExpression(node) && node.expression.getText() === 'useEffect'
      && node.arguments[0]?.getText().includes('hasRememberedAccountToken') ? node.arguments[0] : undefined, {
      hasRememberedAccountToken, account: { status },
      setRememberedAccountBootstrapFailed: (value: boolean) => { failed = value; },
    }) as () => void;
    effect();
    expect(failed).toBe(expected);
  });

  it.each([false, true])('transfers forced-password escalation %s and resets the consumed sign-in proof', async (captchaRequired) => {
    const onPasswordChange = vi.fn(), setToken = vi.fn(), reset = vi.fn();
    const resetVerification = callback(entrySource, (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'resetVerification'
      ? node : undefined, { setToken, widgetRef: { current: { reset } } });
    const signIn = vi.fn(async () => ({ kind: 'passwordChangeRequired' }));
    const submit = callback(entrySource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'submit'
      ? node.initializer : undefined, {
      enabled: true, busy: { current: false }, mounted: { current: true }, setSubmitting: vi.fn(),
      latest: { current: { actions: { signIn }, onBusyChange: vi.fn(), onAttempt: vi.fn(), onPasswordChange } },
      state: { mode: 'claimed', displayName: 'Pilot1' }, schedulerRef: { current: { cancel: vi.fn() } },
      name: 'pilot1', password: 'temporary-password', token: 'consumed-sign-in-proof', captchaRequired,
      setPassword: vi.fn(), resetVerification,
    }) as (event: { preventDefault(): void }) => Promise<void>;
    await submit({ preventDefault: vi.fn() });
    expect(signIn).toHaveBeenCalledExactlyOnceWith({ name: 'pilot1', password: 'temporary-password', turnstileToken: 'consumed-sign-in-proof' });
    expect(setToken).toHaveBeenCalledExactlyOnceWith(null);
    expect(reset).toHaveBeenCalledOnce();
    expect(onPasswordChange).toHaveBeenCalledExactlyOnceWith({ name: 'pilot1', displayName: 'Pilot1',
      temporaryPassword: 'temporary-password', captchaRequired });
  });

  it('captures the refusal before reset and consumes its notice only once', () => {
    let notice: EntryNotice | null = null;
    let revision = 0;
    const generation = { current: 0 };
    const invite = { current: 'invite' };
    const clearSession = vi.fn();
    const reset = callback(appSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'resetPlayerSession'
      && node.initializer && ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : undefined, {
      lifecycleGeneration: generation, setEntryNotice: (value: EntryNotice | null) => { notice = value; },
      clearPlayer: vi.fn(), clearSession, setHasUsablePlayerIdentity: vi.fn(), pendingInviteRef: invite,
      pushUrl: vi.fn(), setGameId: vi.fn(), setPendingInviteGameId: vi.fn(), setPlayerShellStart: vi.fn(), setMode: vi.fn(),
      setEntryRevision: (update: (previous: number) => number) => { revision = update(revision); },
    }) as (inviteGameId?: string, notice?: EntryNotice | null) => void;
    const onRefusal = callback(appSource, (node) => ts.isCallExpression(node) && node.expression.getText() === 'subscribeSessionEntryRequired'
      ? node.arguments[0] : undefined, {
      submittedEntryName: { current: 'TypedName' }, currentPlayerName: { current: 'OldName' },
      entryNoticeForRefusal, resetPlayerSession: reset,
    }) as (event: { code: string; inviteGameId?: string }) => void;
    onRefusal({ code: 'CLAIMED_NAME_REQUIRES_ACCOUNT' });
    expect(notice).toEqual({ name: 'TypedName', code: 'CLAIMED_NAME_REQUIRES_ACCOUNT' });
    expect(invite.current).toBe('invite');
    expect(revision).toBe(1);
    expect(generation.current).toBe(1);
    expect(clearSession).toHaveBeenCalledOnce();
    const currentNotice = notice;
    const consume = callback(appSource, (node) => ts.isJsxAttribute(node) && node.name.getText() === 'onEntryNoticeConsumed'
      && node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined, {
      entryNotice: currentNotice,
      setEntryNotice: (update: (previous: EntryNotice | null) => EntryNotice | null) => { notice = update(notice); },
    }) as () => void;
    consume();
    expect(notice).toBeNull();
    notice = { name: 'NewName', code: 'NAME_BANNED' };
    consume();
    expect(notice).toEqual({ name: 'NewName', code: 'NAME_BANNED' });
  });

  it.each([null, 'invite'])('uses the common Entry success callback for destination %s', (pendingInviteGameId) => {
    const onLaunchGame = vi.fn(), setCurrentShell = vi.fn();
    const entered = callback(screenSource, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'handleEntered'
      ? node.initializer : undefined, { pendingInviteGameId, onLaunchGame, setCurrentShell }) as () => void;
    entered();
    if (pendingInviteGameId) {
      expect(onLaunchGame).toHaveBeenCalledExactlyOnceWith(pendingInviteGameId);
      expect(setCurrentShell).not.toHaveBeenCalled();
    } else {
      expect(setCurrentShell).toHaveBeenCalledExactlyOnceWith('menu');
      expect(onLaunchGame).not.toHaveBeenCalled();
    }
  });
});
