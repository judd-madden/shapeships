import type { AccountStreakSnapshot } from '../account/types';
import { projectAuthoritativeWinStreakGame, deriveWinStreakGameViewModel } from './authoritative';
import type { AccountWinStreakRuntime } from './accountRuntime';
import { ACCOUNT_STREAK_ACTION_FAILED, ACCOUNT_STREAK_CONFLICT, ACCOUNT_STREAK_UNAVAILABLE } from './types';

export function isStreakOutage(code?: string, status?: number): boolean {
  return status === undefined
    ? code === undefined || ['ACCOUNT_SERVICE_UNAVAILABLE', 'INTERNAL_ERROR', 'ACCOUNTS_NOT_ENABLED'].includes(code)
    : status >= 500;
}

export function streakErrorMessage(code?: string, status?: number): string {
  if (code === 'STREAK_CONFLICT') return ACCOUNT_STREAK_CONFLICT;
  return isStreakOutage(code, status) ? ACCOUNT_STREAK_UNAVAILABLE : ACCOUNT_STREAK_ACTION_FAILED;
}

export function accountStreakRequestBody(revision: string): { expectedStreakRevision: string } {
  return { expectedStreakRevision: revision };
}

async function gameResponse(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

export async function requestAccountComputerGame(args: {
  runtime: AccountWinStreakRuntime;
  getSessionId(): Promise<string>;
  request(revision: string): Promise<Response>;
}): Promise<string> {
  return args.runtime.runAction(async (isCurrent) => {
    const before = await args.runtime.ready();
    const sessionId = await args.getSessionId();
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    let response: Response | null = null;
    try { response = await args.request(before.revision); } catch (error) {
      if (error instanceof Error && error.message === ACCOUNT_STREAK_CONFLICT) throw error;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'SESSION_CHANGED') throw error;
      // Reconcile ambiguous dispatch below.
    }
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    const body = response ? await gameResponse(response) : null;
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    if (response?.ok && typeof body?.gameId === 'string' && body.gameId.length > 0) {
      await args.runtime.refresh().catch(() => undefined);
      if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
      return body.gameId;
    }
    if (body?.error === 'STREAK_CONFLICT') {
      await args.runtime.refresh().catch(() => undefined);
      throw new Error(ACCOUNT_STREAK_CONFLICT);
    }
    const ambiguous = !response || response.status >= 500 || (response.ok && !body?.gameId);
    if (ambiguous) {
      const latest = await args.runtime.refresh().catch(() => null);
      const tracked = latest?.trackedGame;
      if (isCurrent() && latest && BigInt(latest.revision) > BigInt(before.revision)
        && tracked?.status === 'unfinished' && tracked.humanPlayerId === sessionId
        && tracked.gameId !== before.trackedGame?.gameId) return tracked.gameId;
    }
    throw new Error(streakErrorMessage(body?.error, response?.status));
  });
}

export async function requestAccountRestart(args: {
  runtime: AccountWinStreakRuntime;
  sourceGameId: string;
  request(revision: string): Promise<Response>;
}): Promise<string> {
  return args.runtime.runAction(async (isCurrent) => {
    const snapshot = await args.runtime.ready();
    let response: Response | null = null;
    try { response = await args.request(snapshot.revision); } catch { /* Explicit retry uses the server lifecycle. */ }
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    const body = response ? await gameResponse(response) : null;
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    if (!response?.ok || typeof body?.gameId !== 'string' || !body.gameId
      || body.sourceGameId !== args.sourceGameId || body.resetStatus !== 'completed') {
      await args.runtime.refresh().catch(() => undefined);
      throw new Error(streakErrorMessage(body?.error, response?.status));
    }
    await args.runtime.refresh().catch(() => undefined);
    if (!isCurrent()) throw new Error(ACCOUNT_STREAK_UNAVAILABLE);
    return body.gameId;
  });
}

export async function verifyAccountRejoin(args: {
  snapshot: AccountStreakSnapshot;
  sessionId: string;
  getGameState(gameId: string): Promise<Response>;
}): Promise<{ gameId: string } | null> {
  const tracked = args.snapshot.trackedGame;
  if (args.snapshot.currentCount <= 0 || tracked?.status !== 'unfinished'
    || tracked.humanPlayerId !== args.sessionId) return null;
  try {
    const response = await args.getGameState(tracked.gameId);
    if (!response.ok) return null;
    const state = await response.json();
    if (state?.gameId !== tracked.gameId || state?.requester?.playerId !== args.sessionId) return null;
    const game = projectAuthoritativeWinStreakGame(state, args.sessionId);
    return game?.humanPlayerId === args.sessionId && game.status === 'active' && !game.restartLifecycle
      ? { gameId: game.gameId } : null;
  } catch { return null; }
}

export function deriveAccountStreakGameViewModel(args: {
  snapshot: AccountStreakSnapshot | null;
  game: Parameters<typeof deriveWinStreakGameViewModel>[0]['game'];
  busy: boolean;
  error: string | null;
  retryAvailable: boolean;
  blocked: boolean;
}) {
  const vm = deriveWinStreakGameViewModel({
    profile: { currentCount: args.snapshot?.currentCount ?? 0,
      trackedGame: args.snapshot?.trackedGame ?? null, endedStreak: args.snapshot?.endedStreak ?? null },
    game: args.game, resetBusy: args.busy, resetError: args.error, resetRetryAvailable: args.retryAvailable,
  });
  vm.reset.canSubmit = vm.reset.canSubmit && !args.blocked;
  return vm;
}
