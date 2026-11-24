import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapRememberedAccount, createEntryAccountActions, entryNoticeForRefusal } from '../../gameSession/accountSessionWiring';
import type { EntryNotice } from '../../account/entryForm';
import { cleanup, harness, SESSION_TOKEN, TOKEN } from './fixtures';

afterEach(cleanup);

// Execute production callbacks with fake App state/session seams; no UI or browser host.
const appSource = readFileSync(new URL('../../../../App.tsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../../../../components/ScreenManager.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../../../../components/panels/AlphaEntryPanel.tsx', import.meta.url), 'utf8');
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
