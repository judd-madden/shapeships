import {
  getGameStatus,
  getResultReason,
  getTurnNumber,
  getWinnerPlayerId,
} from '../gameSession/selectors';
import { retireGameId, type WinStreakProfileStore } from './profile';
import type {
  WinStreakGameViewModel,
  WinStreakProfile,
  WinStreakTrackedGame,
} from './types';

export type WinStreakOutcome = 'win' | 'loss' | 'draw' | 'restart' | null;

export interface AuthoritativeWinStreakGame {
  gameId: string;
  humanPlayerId: string;
  botPlayerId: string;
  status: string;
  turnNumber: number;
  outcome: WinStreakOutcome;
  resultReason: string | null;
  appliedBonusCount: number;
  appliedBonusRecipientPlayerId: string | null;
  serverCanRestart: boolean;
  restartLifecycle: null | {
    kind: 'source' | 'replacement';
    status: 'pending' | 'completed';
    sourceGameId: string;
    replacementGameId: string;
  };
}

function isControllerMap(value: unknown): value is Record<string, { kind?: string }> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function getControllerProjection(state: any): {
  controllers: Record<string, { kind?: string }>;
  publicContract: boolean;
} {
  const projected = state?.publicState?.controllersByPlayerId;
  if (isControllerMap(projected)) {
    return { controllers: projected, publicContract: true };
  }

  const root = state?.controllersByPlayerId;
  if (isControllerMap(root)) {
    return { controllers: root, publicContract: false };
  }

  const nested = state?.gameData?.controllersByPlayerId;
  return {
    controllers: isControllerMap(nested) ? nested : {},
    publicContract: false,
  };
}

function getPlayers(state: any): any[] {
  if (Array.isArray(state?.publicState?.players)) return state.publicState.players;
  if (Array.isArray(state?.players)) return state.players;
  return Array.isArray(state?.gameData?.players) ? state.gameData.players : [];
}

export interface AuthoritativeWinStreakParticipants {
  humanPlayerId: string;
  botPlayerId: string;
}

export function projectAuthoritativeWinStreakParticipants(
  state: any,
  expectedHumanPlayerId?: string | null,
): AuthoritativeWinStreakParticipants | null {
  const { controllers, publicContract } = getControllerProjection(state);
  const requesterId = typeof state?.requester?.playerId === 'string'
    ? state.requester.playerId
    : expectedHumanPlayerId ?? null;
  if (!requesterId) return null;

  const participatingPlayerIds = Array.from(new Set(
    getPlayers(state)
      .filter((player) => player?.role === 'player' && typeof player?.id === 'string')
      .map((player) => player.id as string),
  ));
  if (participatingPlayerIds.length !== 2 || !participatingPlayerIds.includes(requesterId)) {
    return null;
  }

  const requesterKind = controllers[requesterId]?.kind;
  const requesterIsHuman = publicContract
    ? requesterKind === 'player'
    : requesterKind === 'player' || requesterKind === 'human';
  if (!requesterIsHuman) return null;

  const opponentId = participatingPlayerIds.find((id) => id !== requesterId) ?? null;
  if (!opponentId || controllers[opponentId]?.kind !== 'bot') return null;

  return {
    humanPlayerId: requesterId,
    botPlayerId: opponentId,
  };
}

function getRestartLifecycle(state: any): AuthoritativeWinStreakGame['restartLifecycle'] {
  const projected = state?.requester?.winStreakReset?.lifecycle;
  if (
    projected &&
    (projected.kind === 'source' || projected.kind === 'replacement') &&
    (projected.status === 'pending' || projected.status === 'completed') &&
    typeof projected.sourceGameId === 'string' &&
    typeof projected.replacementGameId === 'string'
  ) {
    return projected;
  }

  const raw = state?.winStreakRestart;
  const gameId = typeof state?.gameId === 'string' ? state.gameId : null;
  if (
    gameId &&
    raw?.kind === 'source' &&
    (raw.status === 'pending' || raw.status === 'completed') &&
    typeof raw.replacementGameId === 'string'
  ) {
    return {
      kind: 'source',
      status: raw.status,
      sourceGameId: gameId,
      replacementGameId: raw.replacementGameId,
    };
  }
  if (gameId && raw?.kind === 'replacement' && typeof raw.sourceGameId === 'string') {
    return {
      kind: 'replacement',
      status: 'completed',
      sourceGameId: raw.sourceGameId,
      replacementGameId: gameId,
    };
  }
  return null;
}

function classifyOutcome(state: any): WinStreakOutcome {
  if (getGameStatus(state) !== 'finished') return null;
  const reason = getResultReason(state);
  if (reason === 'restart') return 'restart';
  if (reason === 'mutual_destruction' || reason === 'timeout_draw' || reason === 'agreement') {
    return 'draw';
  }
  const winner = getWinnerPlayerId(state);
  return typeof winner === 'string' ? 'win' : null;
}

export function projectAuthoritativeWinStreakGame(
  state: any,
  expectedHumanPlayerId?: string | null,
): AuthoritativeWinStreakGame | null {
  const gameId = typeof state?.gameId === 'string' ? state.gameId : null;
  if (!gameId) return null;

  const participants = projectAuthoritativeWinStreakParticipants(
    state,
    expectedHumanPlayerId,
  );
  if (!participants) return null;
  const { humanPlayerId, botPlayerId } = participants;

  const bonus = state?.publicState?.winStreakBonus ?? state?.gameData?.winStreakBonus;
  const appliedBonusCount = Number.isSafeInteger(bonus?.appliedCount) && bonus.appliedCount >= 0
    ? bonus.appliedCount
    : 0;
  const appliedBonusRecipientPlayerId = typeof bonus?.recipientPlayerId === 'string'
    ? bonus.recipientPlayerId
    : null;
  const rawOutcome = classifyOutcome(state);
  const winnerPlayerId = getWinnerPlayerId(state);
  const outcome = rawOutcome === 'win'
    ? winnerPlayerId === humanPlayerId ? 'win' : 'loss'
    : rawOutcome;

  return {
    gameId,
    humanPlayerId,
    botPlayerId,
    status: getGameStatus(state),
    turnNumber: getTurnNumber(state),
    outcome,
    resultReason: getResultReason(state),
    appliedBonusCount,
    appliedBonusRecipientPlayerId,
    serverCanRestart: state?.requester?.winStreakReset?.canRestart === true,
    restartLifecycle: getRestartLifecycle(state),
  };
}

function canDiscover(profile: WinStreakProfile, game: AuthoritativeWinStreakGame): boolean {
  if (
    game.status === 'finished' ||
    profile.automaticEnrollmentSealed ||
    profile.retiredGameIds.includes(game.gameId) ||
    profile.creationReservation != null ||
    game.appliedBonusCount !== profile.currentCount ||
    game.appliedBonusRecipientPlayerId !== game.botPlayerId
  ) {
    return false;
  }
  const tracked = profile.trackedGame;
  return tracked == null ||
    tracked.gameId === game.gameId ||
    tracked.status === 'settled';
}

export interface ObserveAuthoritativeOptions {
  allowDiscovery: boolean;
  expectedGeneration?: number;
  requireNoCreationReservation?: boolean;
}

export function settleTrackedGameDraft(
  profile: WinStreakProfile,
  game: AuthoritativeWinStreakGame,
): 'settled' | 'ignored' {
  const tracked = profile.trackedGame;
  if (
    !tracked ||
    tracked.gameId !== game.gameId ||
    tracked.humanPlayerId !== game.humanPlayerId ||
    tracked.status !== 'unfinished' ||
    !tracked.resultEligible ||
    game.status !== 'finished' ||
    game.outcome == null
  ) {
    return 'ignored';
  }

  if (game.outcome === 'win') {
    profile.currentCount = Math.min(Number.MAX_SAFE_INTEGER, profile.currentCount + 1);
  } else if (game.outcome === 'loss') {
    const previousCount = profile.currentCount;
    profile.currentCount = 0;
    if (previousCount > 0) {
      profile.endedStreak = { count: previousCount, endingGameId: game.gameId };
    }
  }

  tracked.status = game.outcome === 'restart' ? 'retired' : 'settled';
  tracked.resultEligible = false;
  retireGameId(profile, game.gameId);
  profile.generation += 1;
  return 'settled';
}

export async function observeAuthoritativeWinStreakGame(
  store: WinStreakProfileStore,
  game: AuthoritativeWinStreakGame,
  options: ObserveAuthoritativeOptions,
): Promise<'enrolled' | 'settled' | 'ignored' | 'stale'> {
  return store.mutate((profile) => {
    if (
      (options.expectedGeneration !== undefined &&
        profile.generation !== options.expectedGeneration) ||
      (options.requireNoCreationReservation === true && profile.creationReservation != null)
    ) {
      return 'stale';
    }

    let tracked = profile.trackedGame;
    if (!tracked || tracked.gameId !== game.gameId) {
      if (!options.allowDiscovery || !canDiscover(profile, game)) return 'ignored';
      if (tracked && tracked.gameId !== game.gameId) retireGameId(profile, tracked.gameId);
      profile.trackedGame = {
        gameId: game.gameId,
        humanPlayerId: game.humanPlayerId,
        status: 'unfinished',
        resultEligible: true,
      };
      profile.endedStreak = null;
      profile.generation += 1;
      tracked = profile.trackedGame;
      if (game.status !== 'finished') return 'enrolled';
    }

    return settleTrackedGameDraft(profile, game);
  });
}

export function deriveWinStreakGameViewModel(args: {
  profile: WinStreakProfile;
  game: AuthoritativeWinStreakGame | null;
  resetBusy: boolean;
  resetError: string | null;
  resetRetryAvailable: boolean;
}): WinStreakGameViewModel {
  const { profile, game } = args;
  const trackedMatches = Boolean(game && profile.trackedGame?.gameId === game.gameId);
  const endedMatches = Boolean(game && profile.endedStreak?.endingGameId === game.gameId);
  const streakState = endedMatches
    ? 'ended' as const
    : trackedMatches && profile.currentCount > 0
      ? 'active' as const
      : 'hidden' as const;
  const displayCount = streakState === 'ended'
    ? profile.endedStreak?.count ?? 0
    : streakState === 'active'
      ? profile.currentCount
      : 0;
  const recipientSide = !game?.appliedBonusRecipientPlayerId
    ? null
    : game.appliedBonusRecipientPlayerId === game.humanPlayerId
      ? 'viewer' as const
      : game.appliedBonusRecipientPlayerId === game.botPlayerId
        ? 'opponent' as const
        : null;

  return {
    currentCount: profile.currentCount,
    displayCount,
    streakState,
    shouldShowContent: streakState !== 'hidden',
    appliedBonus: {
      count: game?.appliedBonusCount ?? 0,
      recipientPlayerId: game?.appliedBonusRecipientPlayerId ?? null,
      recipientSide,
      turnOneHoverEligible:
        (game?.appliedBonusCount ?? 0) > 0 && game?.turnNumber === 1,
    },
    reset: {
      serverCanRestart: game?.serverCanRestart === true,
      canSubmit:
        game != null &&
        game.status !== 'finished' &&
        game.restartLifecycle == null &&
        !args.resetBusy,
      busy: args.resetBusy,
      retryAvailable: args.resetRetryAvailable,
      error: args.resetError,
    },
  };
}

export function registerTrackedGameDraft(
  profile: WinStreakProfile,
  gameId: string,
  humanPlayerId: string,
): void {
  const previous = profile.trackedGame;
  if (previous && previous.gameId !== gameId) retireGameId(profile, previous.gameId);
  profile.trackedGame = {
    gameId,
    humanPlayerId,
    status: 'unfinished',
    resultEligible: true,
  };
  profile.endedStreak = null;
  profile.creationReservation = null;
  profile.generation += 1;
}

export function retireTrackedGameDraft(profile: WinStreakProfile): WinStreakTrackedGame | null {
  const tracked = profile.trackedGame;
  if (!tracked) return null;
  retireGameId(profile, tracked.gameId);
  tracked.status = 'retired';
  tracked.resultEligible = false;
  profile.generation += 1;
  return tracked;
}
