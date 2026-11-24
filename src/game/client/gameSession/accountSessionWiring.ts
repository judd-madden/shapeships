import type { AccountStore } from '../account/accountStore';
import type { EntryAccountActions, EntryNotice, EntryResult } from '../account/entryForm';

export class SessionRequestError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
    this.name = 'SessionRequestError';
  }
}

const nameRefusalCodes = new Set(['INVALID_NAME', 'NAME_RESERVED', 'NAME_BANNED', 'CLAIMED_NAME_REQUIRES_ACCOUNT']);

export function isNameAssignmentRefusal(code: string | undefined): boolean {
  return code !== undefined && nameRefusalCodes.has(code);
}

export function entryNoticeForRefusal(name: string, code: string | undefined): EntryNotice | null {
  return name && isNameAssignmentRefusal(code) ? { name, code: code! } : null;
}

export function guestEntryFailure(error: unknown): EntryResult {
  return { kind: 'error', error: { code: error instanceof SessionRequestError && isNameAssignmentRefusal(error.code)
    ? error.code! : 'GUEST_SESSION_FAILED' } };
}

export function getGameErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  if ('rejected' in body && body.rejected && typeof body.rejected === 'object'
    && 'code' in body.rejected && typeof body.rejected.code === 'string') return body.rejected.code;
  return 'error' in body && typeof body.error === 'string' ? body.error : undefined;
}

export async function readGameErrorCode(response: Response): Promise<string | undefined> {
  try { return getGameErrorCode(await response.clone().json()); } catch { return undefined; }
}

export function isNameAssignmentRoute(endpoint: string): boolean {
  return /^\/(?:session\/start|create-game|create-computer-game|join-game\/[^/?]+|new-game-from\/[^/?]+|reset-win-streak\/[^/?]+|switch-role\/[^/?]+)$/.test(endpoint);
}

export function inviteGameIdForRequest(endpoint: string): string | undefined {
  return /^\/join-game\/([^/?]+)$/.exec(endpoint)?.[1];
}

export type AccountStartupOutcome =
  | { destination: 'guest' }
  | { destination: 'entry'; pendingInviteGameId: string | null }
  | { destination: 'menu' }
  | { destination: 'game'; gameId: string };

/** No guest request; the store owns token retention and resume's one retry without S. */
export async function bootstrapRememberedAccount({ store, ensureSession, clearSession, requestedGameId, isCurrent = () => true }: {
  store: Pick<AccountStore, 'hasRememberedToken' | 'resume' | 'getSnapshot' | 'suspendForSessionFailure'>;
  ensureSession: () => Promise<{ sessionToken: string; sessionId: string }>;
  clearSession: () => void;
  requestedGameId: string | null;
  isCurrent?: () => boolean;
}): Promise<AccountStartupOutcome> {
  if (!store.hasRememberedToken()) return { destination: 'guest' };
  const entry: AccountStartupOutcome = { destination: 'entry', pendingInviteGameId: requestedGameId || null };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!isCurrent()) return entry;
      const session = await ensureSession();
      if (!isCurrent()) return entry;
      await store.resume(session.sessionToken);
      if (!isCurrent()) return entry;
      const account = store.getSnapshot();
      if (account.status !== 'signedIn') return entry;
      if (account.linkedSessionId === session.sessionId) {
        return requestedGameId
          ? { destination: 'game', gameId: requestedGameId }
          : { destination: 'menu' };
      }
      // A valid account with no link means resume recovered independently of an expired S.
      clearSession();
    }
    if (isCurrent()) store.suspendForSessionFailure('GAME_SESSION_INVALID');
  } catch (error) {
    // Entry remains usable; no automatic account retry and no remembered-name presentation.
    if (isCurrent()) store.suspendForSessionFailure(error instanceof SessionRequestError ? error.code : undefined);
  }
  return entry;
}

/** Keep the signed-in history across resuming; initial signedOut never resets a guest. */
export function observeAccountSession(store: Pick<AccountStore, 'getSnapshot' | 'subscribe'>, onEntry: () => void): () => void {
  let wasSignedIn = store.getSnapshot().status === 'signedIn';
  return store.subscribe(() => {
    const { status } = store.getSnapshot();
    if (status === 'signedIn') wasSignedIn = true;
    else if (wasSignedIn && (status === 'signedOut' || status === 'unavailable' || status === 'dormant')) {
      wasSignedIn = false;
      onEntry();
    }
  });
}

/** Thin Entry form actions. Store authority and session creation stay in their existing owners. */
export function createEntryAccountActions({ store, ensureSession, clearSession, getSessionToken, getGeneration,
  requestedGameId, onSignedIn, onRememberedEntry = () => {} }: {
  store: Pick<AccountStore, 'getSnapshot' | 'nameCheck' | 'invalidateNameChecks' | 'signIn' | 'changePassword'
    | 'cancelPasswordChange' | 'hasRememberedToken' | 'resume' | 'suspendForSessionFailure'>;
  ensureSession(): Promise<{ sessionToken: string; sessionId: string }>;
  clearSession(): void;
  getSessionToken(): string | null;
  getGeneration(): number;
  requestedGameId(): string | null;
  onSignedIn(): void;
  onRememberedEntry?(): void;
}): EntryAccountActions {
  let ownedSession: string | null = null;
  let busy = false;
  let leaving = false;

  function clearOwnedSession(): void {
    if (ownedSession && ownedSession === getSessionToken()) clearSession();
    ownedSession = null;
  }
  function leaveSignIn(): void {
    if (busy) { leaving = true; return; }
    clearOwnedSession();
    store.cancelPasswordChange();
  }

  async function submit(operation: (sessionToken: string) => Promise<void>): Promise<EntryResult> {
    if (busy) return { kind: 'cancelled' };
    busy = true;
    leaving = false;
    const generation = getGeneration();
    const current = () => generation === getGeneration();
    store.invalidateNameChecks();
    try {
      const session = await ensureSession();
      if (!current()) return { kind: 'cancelled' };
      ownedSession = session.sessionToken;
      if (leaving) return { kind: 'cancelled' };
      await operation(session.sessionToken);
      // No intervening await: a lookup can otherwise overwrite the operation error.
      const result = store.getSnapshot();
      if (!current() || getSessionToken() !== session.sessionToken) return { kind: 'cancelled' };
      if (result.status === 'signedIn') {
        ownedSession = null;
        if (leaving) return { kind: 'cancelled' };
        onSignedIn();
        return { kind: 'ok' };
      }
      if (leaving) return { kind: 'cancelled' };
      if (result.status === 'passwordChangeRequired' && result.lastError?.code === 'PASSWORD_CHANGE_REQUIRED') {
        return { kind: 'passwordChangeRequired' };
      }
      const error = result.lastError ?? { code: 'UNKNOWN' };
      if (error.code === 'GAME_SESSION_INVALID') {
        // The failed account request has settled. Replace S once, without replaying its proof.
        clearOwnedSession();
        try {
          const replacement = await ensureSession();
          if (!current()) return { kind: 'cancelled' };
          ownedSession = replacement.sessionToken;
        } catch { /* Keep the original safe error, and let the player explicitly retry. */ }
      }
      return current() && !leaving ? { kind: 'error', error } : { kind: 'cancelled' };
    } catch {
      return current() && !leaving ? { kind: 'error', error: { code: 'ACCOUNT_SERVICE_UNAVAILABLE' } } : { kind: 'cancelled' };
    } finally {
      busy = false;
      if (leaving) leaveSignIn();
    }
  }

  return {
    checkName: (name) => store.nameCheck(name),
    invalidateNameChecks: () => store.invalidateNameChecks(),
    signIn: (input) => submit((sessionToken) => store.signIn(input, sessionToken)),
    changePassword: (input) => submit((sessionToken) => store.changePassword(input, sessionToken)),
    leaveSignIn,
    async retryRemembered(): Promise<EntryResult> {
      if (busy) return { kind: 'cancelled' };
      busy = true;
      leaving = false;
      const generation = getGeneration();
      const current = () => generation === getGeneration() && !leaving;
      store.invalidateNameChecks();
      try {
        const outcome = await bootstrapRememberedAccount({ store, clearSession, requestedGameId: requestedGameId(),
          isCurrent: current,
          ensureSession: async () => {
            const session = await ensureSession();
            if (current()) ownedSession = session.sessionToken;
            return session;
          },
        });
        const result = store.getSnapshot();
        if (!current()) return { kind: 'cancelled' };
        if (outcome.destination === 'menu' || outcome.destination === 'game') {
          ownedSession = null;
          onSignedIn();
          return { kind: 'ok' };
        }
        clearOwnedSession();
        onRememberedEntry();
        return { kind: 'error', error: result.lastError ?? { code: 'ACCOUNT_SERVICE_UNAVAILABLE' } };
      } finally {
        busy = false;
        if (leaving) leaveSignIn();
      }
    },
  };
}
