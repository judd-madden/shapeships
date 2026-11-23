import type { AccountStore } from '../account/accountStore';

export class SessionRequestError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
    this.name = 'SessionRequestError';
  }
}

const nameRefusalMessages: Readonly<Record<string, string>> = {
  INVALID_NAME: 'Use 3–20 letters or numbers, no spaces or symbols.',
  NAME_RESERVED: 'This name is reserved. Please choose another.',
  NAME_BANNED: 'This name is on the banned list. Please enter a different name.',
  CLAIMED_NAME_REQUIRES_ACCOUNT: 'This name has been claimed. Please choose another name.',
};

export function isNameAssignmentRefusal(code: string | undefined): boolean {
  return code !== undefined && Object.prototype.hasOwnProperty.call(nameRefusalMessages, code);
}

export function getEntrySessionErrorMessage(error: unknown): string {
  return error instanceof SessionRequestError && isNameAssignmentRefusal(error.code)
    ? nameRefusalMessages[error.code!]
    : 'Failed to start session. Please try again.';
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
