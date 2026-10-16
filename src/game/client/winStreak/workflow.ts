import { buildShareGameUrl } from '../config';
import {
  observeAuthoritativeWinStreakGame,
  projectAuthoritativeWinStreakGame,
  registerTrackedGameDraft,
  retireTrackedGameDraft,
  settleTrackedGameDraft,
  type AuthoritativeWinStreakGame,
} from './authoritative';
import type { WinStreakProfileStore } from './profile';
import type {
  WinStreakCreationReservation,
  WinStreakCreationViewModel,
  WinStreakProfile,
  WinStreakTrackedGame,
  WinStreakUnfinishedGameViewModel,
} from './types';

export interface ReconcileTransport {
  getGameState(gameId: string): Promise<Response>;
}

export interface WinStreakCreationPreflight {
  generation: number;
  trackedGameId: string | null;
  trackedGameStatus: WinStreakTrackedGame['status'] | null;
}

export type ReconcileResult =
  | { kind: 'clear'; preflight: WinStreakCreationPreflight }
  | { kind: 'unfinished'; game: AuthoritativeWinStreakGame; preflight: WinStreakCreationPreflight }
  | { kind: 'inaccessible'; gameId: string; error: string; preflight: WinStreakCreationPreflight }
  | { kind: 'restart'; game: AuthoritativeWinStreakGame }
  | { kind: 'error'; gameId: string; error: string }
  | { kind: 'stale' };

function creationPreflight(profile: WinStreakProfile): WinStreakCreationPreflight {
  return {
    generation: profile.generation,
    trackedGameId: profile.trackedGame?.gameId ?? null,
    trackedGameStatus: profile.trackedGame?.status ?? null,
  };
}

function matchesPreflight(
  profile: WinStreakProfile,
  preflight: WinStreakCreationPreflight,
): boolean {
  return profile.generation === preflight.generation &&
    (profile.trackedGame?.gameId ?? null) === preflight.trackedGameId &&
    (profile.trackedGame?.status ?? null) === preflight.trackedGameStatus;
}

function matchesReservationBase(
  profile: WinStreakProfile,
  reservation: WinStreakCreationReservation,
): boolean {
  return profile.generation === reservation.baseGeneration &&
    (profile.trackedGame?.gameId ?? null) === reservation.baseTrackedGameId &&
    (profile.trackedGame?.status ?? null) === reservation.baseTrackedGameStatus;
}

function responseMessage(status: number): string {
  if (status === 404) return 'The tracked game no longer exists.';
  if (status === 401 || status === 403) return 'The tracked game is not accessible from this tab session.';
  return `Unable to reconcile the tracked game (HTTP ${status}).`;
}

export async function reconcileTrackedWinStreakGame(
  store: WinStreakProfileStore,
  transport: ReconcileTransport,
  options: { expectedTrackedGameId?: string } = {},
): Promise<ReconcileResult> {
  const captured = await store.inspect((profile) => ({
    preflight: creationPreflight(profile),
    trackedGame: profile.trackedGame ? { ...profile.trackedGame } : null,
    reservation: profile.creationReservation,
  }));
  if (captured.reservation) {
    return { kind: 'error', gameId: captured.trackedGame?.gameId ?? '', error: 'A bot-game creation request is already reserved.' };
  }
  const tracked = captured.trackedGame;
  if (
    options.expectedTrackedGameId !== undefined &&
    tracked?.gameId !== options.expectedTrackedGameId
  ) {
    return { kind: 'stale' };
  }
  if (!tracked || tracked.status === 'settled') {
    return { kind: 'clear', preflight: captured.preflight };
  }

  let response: Response;
  try {
    response = await transport.getGameState(tracked.gameId);
  } catch (error) {
    return {
      kind: 'error',
      gameId: tracked.gameId,
      error: error instanceof Error ? error.message : 'Unable to reconcile the tracked game.',
    };
  }

  const stillCurrent = await store.inspect((profile) =>
    matchesPreflight(profile, captured.preflight) &&
    (profile.creationReservation?.token ?? null) === (captured.reservation?.token ?? null)
  );
  if (!stillCurrent) return { kind: 'stale' };

  if (!response.ok) {
    const error = responseMessage(response.status);
    return response.status === 401 || response.status === 403 || response.status === 404
      ? { kind: 'inaccessible', gameId: tracked.gameId, error, preflight: captured.preflight }
      : { kind: 'error', gameId: tracked.gameId, error };
  }

  let state: unknown;
  try {
    state = await response.json();
  } catch {
    return { kind: 'error', gameId: tracked.gameId, error: 'The tracked game returned malformed state.' };
  }
  const game = projectAuthoritativeWinStreakGame(state, tracked.humanPlayerId);
  if (!game || game.gameId !== tracked.gameId || game.humanPlayerId !== tracked.humanPlayerId) {
    return { kind: 'error', gameId: tracked.gameId, error: 'The tracked game identity could not be validated.' };
  }
  const associationStillCurrent = await store.inspect((profile) =>
    matchesPreflight(profile, captured.preflight) &&
    (profile.creationReservation?.token ?? null) === (captured.reservation?.token ?? null)
  );
  if (!associationStillCurrent) return { kind: 'stale' };
  if (game.resultReason === 'restart' || game.restartLifecycle?.kind === 'source') {
    return { kind: 'restart', game };
  }
  if (game.status === 'finished') {
    const observed = await observeAuthoritativeWinStreakGame(store, game, {
      allowDiscovery: false,
      expectedGeneration: captured.preflight.generation,
    });
    if (observed === 'stale') return { kind: 'stale' };
    const settledPreflight = await store.inspect((profile) => creationPreflight(profile));
    return settledPreflight.trackedGameId === tracked.gameId
      ? { kind: 'clear', preflight: settledPreflight }
      : { kind: 'stale' };
  }
  return { kind: 'unfinished', game, preflight: captured.preflight };
}

function makeToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeCreationReservation(
  profile: WinStreakProfile,
  kind: 'create' | 'rematch',
  sourceGameId: string | null,
): WinStreakCreationReservation {
  return {
    token: makeToken(),
    kind,
    sourceGameId,
    requestedCount: profile.currentCount,
    baseGeneration: profile.generation,
    baseTrackedGameId: profile.trackedGame?.gameId ?? null,
    baseTrackedGameStatus: profile.trackedGame?.status ?? null,
    status: 'reserved',
    createdAtMs: Date.now(),
    error: null,
    recoveryGameId: null,
  };
}

export type CreationReservationResult =
  | { kind: 'reserved'; reservation: WinStreakCreationReservation }
  | { kind: 'stale' }
  | { kind: 'blocked' };

export async function reserveBotGameCreation(
  store: WinStreakProfileStore,
  kind: 'create' | 'rematch',
  sourceGameId: string | null,
  preflight: WinStreakCreationPreflight,
): Promise<CreationReservationResult> {
  return store.mutate((profile) => {
    if (!matchesPreflight(profile, preflight)) return { kind: 'stale' };
    if (profile.creationReservation) return { kind: 'blocked' };
    const reservation = makeCreationReservation(profile, kind, sourceGameId);
    profile.creationReservation = reservation;
    return { kind: 'reserved', reservation };
  });
}

export async function reserveAfterConfirmedAbandonment(
  store: WinStreakProfileStore,
  kind: 'create' | 'rematch',
  sourceGameId: string | null,
  confirmedGameId: string,
  preflight: WinStreakCreationPreflight,
): Promise<CreationReservationResult> {
  return store.mutate((profile) => {
    if (
      !matchesPreflight(profile, preflight) ||
      profile.trackedGame?.gameId !== confirmedGameId
    ) {
      return { kind: 'stale' };
    }
    if (profile.creationReservation) return { kind: 'blocked' };
    retireTrackedGameDraft(profile);
    profile.currentCount = 0;
    const reservation = makeCreationReservation(profile, kind, sourceGameId);
    profile.creationReservation = reservation;
    return { kind: 'reserved', reservation };
  });
}

export async function markBotGameCreationStarted(
  store: WinStreakProfileStore,
  reservation: WinStreakCreationReservation,
): Promise<boolean> {
  return store.mutate((profile) => {
    const current = profile.creationReservation;
    if (
      !current ||
      current.token !== reservation.token ||
      !matchesReservationBase(profile, reservation)
    ) {
      return false;
    }
    current.status = 'creating';
    return true;
  });
}

export async function completeBotGameCreation(
  store: WinStreakProfileStore,
  reservation: WinStreakCreationReservation,
  gameId: string,
  humanPlayerId: string,
): Promise<'registered' | 'stale'> {
  return store.mutate((profile) => {
    const current = profile.creationReservation;
    if (!current) {
      profile.creationReservation = {
        ...reservation,
        status: 'stale_success',
        recoveryGameId: gameId,
        error: 'The creation reservation was released before its successful response arrived.',
      };
      return 'stale';
    }
    if (current.token !== reservation.token) return 'stale';
    if (!matchesReservationBase(profile, reservation)) {
      current.status = 'stale_success';
      current.recoveryGameId = gameId;
      current.error = 'The profile changed while the game was being created.';
      return 'stale';
    }
    registerTrackedGameDraft(profile, gameId, humanPlayerId);
    return 'registered';
  });
}

export type CreationExecutionResult =
  | { kind: 'registered'; gameId: string }
  | { kind: 'rejected'; error: string }
  | { kind: 'ambiguous'; error: string }
  | { kind: 'stale_preflight'; error: string }
  | { kind: 'stale_success'; error: string | null };

export async function executeReservedBotGameCreation(args: {
  store: WinStreakProfileStore;
  reservation: WinStreakCreationReservation;
  request: (winStreakCount: number) => Promise<Response>;
  getHumanPlayerId: () => Promise<string>;
  invalidResponseMessage: string;
}): Promise<CreationExecutionResult> {
  if (!(await markBotGameCreationStarted(args.store, args.reservation))) {
    await failBotGameCreation(args.store, args.reservation, {
      ambiguous: false,
      error: 'The win-streak profile changed before game creation started.',
    });
    return {
      kind: 'stale_preflight',
      error: 'The win-streak profile changed before game creation started. Please reconcile again.',
    };
  }

  let response: Response;
  try {
    response = await args.request(args.reservation.requestedCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Game creation may not have completed.';
    await failBotGameCreation(args.store, args.reservation, { ambiguous: true, error: message });
    return { kind: 'ambiguous', error: message };
  }

  if (!response.ok) {
    const message = await response.text().catch(() => 'Game creation failed.');
    const ambiguous = response.status < 400 || response.status >= 500;
    await failBotGameCreation(args.store, args.reservation, { ambiguous, error: message });
    return ambiguous
      ? { kind: 'ambiguous', error: message }
      : { kind: 'rejected', error: message };
  }

  const body = await response.json().catch(() => null);
  const gameId = typeof body?.gameId === 'string' ? body.gameId : null;
  if (!gameId) {
    await failBotGameCreation(args.store, args.reservation, {
      ambiguous: true,
      error: args.invalidResponseMessage,
    });
    return { kind: 'ambiguous', error: args.invalidResponseMessage };
  }

  let humanPlayerId: string;
  try {
    humanPlayerId = await args.getHumanPlayerId();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'The created game identity could not be recovered.';
    await recordCreatedGameForRecovery(args.store, args.reservation, gameId, message);
    return { kind: 'stale_success', error: message };
  }

  const completed = await completeBotGameCreation(
    args.store,
    args.reservation,
    gameId,
    humanPlayerId,
  );
  return completed === 'registered'
    ? { kind: 'registered', gameId }
    : { kind: 'stale_success', error: 'The profile changed while the game was being created.' };
}

export type CreationRecoveryResult =
  | { kind: 'recovered'; gameId: string; settled: boolean }
  | { kind: 'conflict'; error: string }
  | { kind: 'error'; error: string };

export async function recoverCreatedBotGame(
  store: WinStreakProfileStore,
  transport: ReconcileTransport,
): Promise<CreationRecoveryResult> {
  const captured = await store.inspect((profile) => {
    const reservation = profile.creationReservation;
    if (
      reservation?.status !== 'stale_success' ||
      typeof reservation.recoveryGameId !== 'string'
    ) {
      return null;
    }
    return {
      generation: profile.generation,
      reservation: { ...reservation },
      recoveryGameId: reservation.recoveryGameId,
    };
  });
  if (!captured) return { kind: 'error', error: 'No recoverable created game is available.' };

  let response: Response;
  try {
    response = await transport.getGameState(captured.recoveryGameId);
  } catch (error) {
    return {
      kind: 'error',
      error: error instanceof Error ? error.message : 'Unable to recover the created game.',
    };
  }
  if (!response.ok) {
    return {
      kind: 'error',
      error: responseMessage(response.status),
    };
  }

  const state = await response.json().catch(() => null);
  const game = projectAuthoritativeWinStreakGame(state);
  if (
    !game ||
    game.gameId !== captured.recoveryGameId ||
    game.appliedBonusCount !== captured.reservation.requestedCount ||
    game.appliedBonusRecipientPlayerId !== game.botPlayerId ||
    (game.status === 'finished' && game.outcome == null)
  ) {
    return { kind: 'error', error: 'The recovered game could not be validated.' };
  }

  return store.mutate((profile) => {
    const current = profile.creationReservation;
    if (!current) {
      const tracked = profile.trackedGame;
      const alreadyRecovered =
        tracked?.gameId === game.gameId &&
        tracked.humanPlayerId === game.humanPlayerId &&
        (tracked.status === 'unfinished' || tracked.status === 'settled');
      return alreadyRecovered
        ? { kind: 'recovered', gameId: game.gameId, settled: tracked.status === 'settled' }
        : { kind: 'conflict', error: 'The streak profile changed during game recovery.' };
    }
    if (
      current.token !== captured.reservation.token ||
      current.recoveryGameId !== captured.recoveryGameId ||
      profile.generation !== captured.generation
    ) {
      return { kind: 'conflict', error: 'The streak profile changed during game recovery.' };
    }

    const alreadyTracked = profile.trackedGame?.gameId === game.gameId;
    if (alreadyTracked) {
      if (profile.trackedGame?.humanPlayerId !== game.humanPlayerId) {
        return { kind: 'conflict', error: 'The recovered game belongs to a different participant.' };
      }
      if (profile.trackedGame?.status === 'settled' && game.status === 'finished') {
        profile.creationReservation = null;
        return { kind: 'recovered', gameId: game.gameId, settled: true };
      }
      if (profile.trackedGame?.status !== 'unfinished') {
        return { kind: 'conflict', error: 'The recovered game is no longer result-eligible.' };
      }
    } else if (!matchesReservationBase(profile, captured.reservation)) {
      return {
        kind: 'conflict',
        error: 'Newer streak progression must be resolved before recovering this game.',
      };
    } else {
      registerTrackedGameDraft(profile, game.gameId, game.humanPlayerId);
    }

    const settlement = game.status === 'finished'
      ? settleTrackedGameDraft(profile, game)
      : 'ignored';
    if (game.status === 'finished' && settlement !== 'settled') {
      return { kind: 'conflict', error: 'The recovered result could not be settled safely.' };
    }
    profile.creationReservation = null;
    return {
      kind: 'recovered',
      gameId: game.gameId,
      settled: settlement === 'settled',
    };
  });
}

export async function failBotGameCreation(
  store: WinStreakProfileStore,
  reservation: WinStreakCreationReservation,
  args: { ambiguous: boolean; error: string },
): Promise<void> {
  await store.mutate((profile) => {
    const current = profile.creationReservation;
    if (!current || current.token !== reservation.token) return;
    if (args.ambiguous) {
      current.status = 'ambiguous';
      current.error = args.error;
    } else {
      profile.creationReservation = null;
    }
  });
}

export async function recordCreatedGameForRecovery(
  store: WinStreakProfileStore,
  reservation: WinStreakCreationReservation,
  gameId: string,
  error: string,
): Promise<void> {
  await store.mutate((profile) => {
    const current = profile.creationReservation;
    if (!current) {
      profile.creationReservation = {
        ...reservation,
        status: 'stale_success',
        recoveryGameId: gameId,
        error,
      };
      return;
    }
    if (current.token !== reservation.token) return;
    current.status = 'stale_success';
    current.recoveryGameId = gameId;
    current.error = error;
  });
}

export async function releaseCreationReservation(store: WinStreakProfileStore): Promise<void> {
  await store.mutate((profile) => {
    profile.creationReservation = null;
  });
}

export async function resetWinStreakFromMenu(store: WinStreakProfileStore): Promise<void> {
  await store.mutate((profile) => {
    profile.currentCount = 0;
    profile.endedStreak = null;
    if (profile.trackedGame?.status === 'unfinished' || profile.trackedGame?.status === 'restart_pending') {
      retireTrackedGameDraft(profile);
    } else {
      profile.generation += 1;
    }
  });
}

export async function completeWinStreakRestart(
  store: WinStreakProfileStore,
  sourceGameId: string,
  replacementGameId: string,
  humanPlayerId: string,
  expectedGeneration?: number,
): Promise<'registered' | 'stale'> {
  return store.mutate((profile) => {
    if (profile.trackedGame?.gameId === replacementGameId) {
      return profile.trackedGame.humanPlayerId === humanPlayerId ? 'registered' : 'stale';
    }
    if (
      (expectedGeneration !== undefined && profile.generation !== expectedGeneration) ||
      profile.creationReservation != null
    ) {
      return 'stale';
    }
    if (profile.trackedGame && profile.trackedGame.gameId !== sourceGameId) {
      return 'stale';
    }
    if (profile.trackedGame?.gameId === sourceGameId) {
      retireTrackedGameDraft(profile);
    }
    profile.currentCount = 0;
    profile.endedStreak = null;
    registerTrackedGameDraft(profile, replacementGameId, humanPlayerId);
    return 'registered';
  });
}

export function creationViewModelFromReservation(
  reservation: WinStreakCreationReservation | null,
  localStatus: WinStreakCreationViewModel['status'] = 'idle',
  localError: string | null = null,
  activeReservationToken: string | null = null,
): WinStreakCreationViewModel {
  const isLocallyActive = reservation?.token === activeReservationToken;
  const status = reservation?.status === 'reserved'
    ? isLocallyActive ? 'reserved' : 'ambiguous'
    : reservation?.status === 'creating'
      ? isLocallyActive ? 'creating' : 'ambiguous'
    : reservation?.status === 'ambiguous'
      ? 'ambiguous'
      : reservation?.status === 'stale_success'
        ? 'stale_success'
        : localStatus;
  return {
    status,
    busy: status === 'reconciling' || status === 'reserved' || status === 'creating',
    error: localError ?? reservation?.error ?? null,
    recoveryGameId: reservation?.recoveryGameId ?? null,
    requiresExplicitRelease:
      status === 'creating' || status === 'ambiguous' || status === 'stale_success',
  };
}

export function unfinishedViewModel(args: {
  status: WinStreakUnfinishedGameViewModel['status'];
  gameId: string | null;
  error?: string | null;
  canConfirm?: boolean;
}): WinStreakUnfinishedGameViewModel {
  return {
    status: args.status,
    gameId: args.gameId,
    rejoinUrl: args.gameId ? buildShareGameUrl(args.gameId) : null,
    canRejoin: Boolean(args.gameId),
    canConfirmAbandonment: args.canConfirm === true,
    error: args.error ?? null,
  };
}
