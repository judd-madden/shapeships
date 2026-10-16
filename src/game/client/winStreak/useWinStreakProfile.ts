import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getWinStreakProfileStore,
  type WinStreakProfileStore,
} from './profile';
import type {
  WinStreakCreationStatus,
  ComputerGameCreateSettings,
  WinStreakMenuActions,
  WinStreakMenuViewModel,
  WinStreakProfile,
  WinStreakUnfinishedStatus,
} from './types';
import {
  creationViewModelFromReservation,
  executeReservedBotGameCreation,
  recoverCreatedBotGame,
  reconcileTrackedWinStreakGame,
  releaseCreationReservation,
  reserveAfterConfirmedAbandonment,
  reserveBotGameCreation,
  resetWinStreakFromMenu,
  unfinishedViewModel,
  type WinStreakCreationPreflight,
} from './workflow';

export function useWinStreakProfile(
  store: WinStreakProfileStore = getWinStreakProfileStore(),
): WinStreakProfile {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

interface UseWinStreakMenuArgs {
  createComputerGameRequest: (
    settings: ComputerGameCreateSettings,
    winStreakCount: number,
  ) => Promise<Response>;
  getGameState: (gameId: string) => Promise<Response>;
  getCurrentSession: () => Promise<{ sessionId: string }>;
  navigateToGame: (gameId: string) => void;
  store?: WinStreakProfileStore;
}

export function useWinStreakMenu(args: UseWinStreakMenuArgs): {
  viewModel: WinStreakMenuViewModel;
  actions: WinStreakMenuActions;
  requestComputerGame: (settings: ComputerGameCreateSettings) => Promise<string | null>;
} {
  const store = args.store ?? getWinStreakProfileStore();
  const profile = useWinStreakProfile(store);
  const pendingSettingsRef = useRef<ComputerGameCreateSettings | null>(null);
  const pendingConfirmationRef = useRef<{
    gameId: string;
    preflight: WinStreakCreationPreflight;
  } | null>(null);
  const activeCreationTokenRef = useRef<string | null>(null);
  const [creationStatus, setCreationStatus] = useState<WinStreakCreationStatus>('idle');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [unfinishedStatus, setUnfinishedStatus] = useState<WinStreakUnfinishedStatus>('none');
  const [unfinishedError, setUnfinishedError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const executeCreationReservation = useCallback(async (
    settings: ComputerGameCreateSettings,
    reservation: NonNullable<WinStreakProfile['creationReservation']>,
  ): Promise<string | null> => {
    activeCreationTokenRef.current = reservation.token;
    setCreationStatus('creating');
    setCreationError(null);
    const result = await executeReservedBotGameCreation({
      store,
      reservation,
      request: (count) => args.createComputerGameRequest(settings, count),
      getHumanPlayerId: async () => (await args.getCurrentSession()).sessionId,
      invalidResponseMessage: 'Computer game creation returned an invalid response.',
    });
    activeCreationTokenRef.current = null;
    if (result.kind === 'registered') {
      pendingSettingsRef.current = null;
      pendingConfirmationRef.current = null;
      setCreationStatus('idle');
      setUnfinishedStatus('none');
      return result.gameId;
    }
    setCreationStatus(
      result.kind === 'ambiguous'
        ? 'ambiguous'
        : result.kind === 'rejected' || result.kind === 'stale_preflight'
          ? 'error'
          : 'stale_success',
    );
    setCreationError(result.error);
    return null;
  }, [args, store]);

  const executeCreation = useCallback(async (
    settings: ComputerGameCreateSettings,
    preflight: WinStreakCreationPreflight,
  ): Promise<string | null> => {
    const reserved = await reserveBotGameCreation(store, 'create', null, preflight);
    if (reserved.kind !== 'reserved') {
      setCreationStatus('error');
      setCreationError(reserved.kind === 'stale'
        ? 'The win-streak profile changed after reconciliation. Please retry.'
        : 'A bot-game creation request is already in progress.');
      return null;
    }
    return executeCreationReservation(settings, reserved.reservation);
  }, [executeCreationReservation, store]);

  const reconcileForCreation = useCallback(async (
    expectedTrackedGameId?: string,
  ): Promise<
    | { kind: 'clear'; preflight: WinStreakCreationPreflight }
    | { kind: 'blocked'; preflight: WinStreakCreationPreflight; gameId: string }
    | { kind: 'error' }
  > => {
    setCreationStatus('reconciling');
    setUnfinishedStatus('reconciling');
    setCreationError(null);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await reconcileTrackedWinStreakGame(store, {
        getGameState: args.getGameState,
      }, { expectedTrackedGameId });
      if (result.kind === 'stale') continue;
      if (result.kind === 'clear') {
        setUnfinishedStatus('none');
        pendingConfirmationRef.current = null;
        return { kind: 'clear', preflight: result.preflight };
      }
      if (result.kind === 'unfinished') {
        pendingConfirmationRef.current = {
          gameId: result.game.gameId,
          preflight: result.preflight,
        };
        setUnfinishedStatus('confirmation_required');
        setUnfinishedError(null);
        return { kind: 'blocked', preflight: result.preflight, gameId: result.game.gameId };
      }
      if (result.kind === 'inaccessible') {
        pendingConfirmationRef.current = {
          gameId: result.gameId,
          preflight: result.preflight,
        };
        setUnfinishedStatus('inaccessible');
        setUnfinishedError(result.error);
        return { kind: 'blocked', preflight: result.preflight, gameId: result.gameId };
      }
      if (result.kind === 'restart') {
        setUnfinishedStatus('restart_recovery');
        setUnfinishedError('The tracked game has a win-streak restart to recover.');
        return { kind: 'error' };
      }
      setUnfinishedStatus('error');
      setUnfinishedError(result.error);
      setCreationError(result.error);
      return { kind: 'error' };
    }
    setCreationStatus('error');
    setUnfinishedStatus('error');
    setCreationError('The tracked game changed during reconciliation. Please retry.');
    return { kind: 'error' };
  }, [args.getGameState, store]);

  const requestComputerGame = useCallback(async (
    settings: ComputerGameCreateSettings,
  ): Promise<string | null> => {
    pendingSettingsRef.current = settings;
    const result = await reconcileForCreation();
    if (result.kind !== 'clear') return null;
    return executeCreation(settings, result.preflight);
  }, [executeCreation, reconcileForCreation]);

  const onConfirmWinStreakAbandonment = useCallback(async (): Promise<string | null> => {
    const settings = pendingSettingsRef.current;
    const confirmation = pendingConfirmationRef.current;
    if (!settings || !confirmation) return null;
    const result = await reconcileForCreation(confirmation.gameId);
    if (result.kind === 'clear') return executeCreation(settings, result.preflight);
    if (result.kind === 'error') return null;
    const reserved = await reserveAfterConfirmedAbandonment(
      store,
      'create',
      null,
      confirmation.gameId,
      result.preflight,
    );
    if (reserved.kind !== 'reserved') {
      setCreationStatus('error');
      setCreationError(reserved.kind === 'stale'
        ? 'The tracked game changed before abandonment was confirmed. Please reconcile again.'
        : 'A bot-game creation request is already in progress.');
      return null;
    }
    setUnfinishedStatus('none');
    return executeCreationReservation(settings, reserved.reservation);
  }, [executeCreation, executeCreationReservation, reconcileForCreation, store]);

  const onResetWinStreak = useCallback(async (): Promise<void> => {
    setResetBusy(true);
    setResetError(null);
    try {
      await resetWinStreakFromMenu(store);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset the win streak.');
    } finally {
      setResetBusy(false);
    }
  }, [store]);

  const actions = useMemo<WinStreakMenuActions>(() => ({
    onResetWinStreak,
    onConfirmWinStreakAbandonment: async () => {
      const gameId = await onConfirmWinStreakAbandonment();
      if (gameId) args.navigateToGame(gameId);
      return gameId;
    },
    onCancelWinStreakAbandonment: () => {
      pendingSettingsRef.current = null;
      pendingConfirmationRef.current = null;
      setCreationStatus('idle');
      setCreationError(null);
      setUnfinishedStatus(profile.trackedGame && profile.trackedGame.status !== 'settled'
        ? 'known_unfinished'
        : 'none');
    },
    onRetryWinStreakReconciliation: async () => {
      const settings = pendingSettingsRef.current;
      if (!settings) return null;
      const result = await reconcileForCreation();
      const gameId = result.kind === 'clear'
        ? await executeCreation(settings, result.preflight)
        : null;
      if (gameId) args.navigateToGame(gameId);
      return gameId;
    },
    onRejoinTrackedGame: () => {
      const gameId = profile.trackedGame?.gameId;
      if (gameId) args.navigateToGame(gameId);
    },
    onReleaseAmbiguousWinStreakCreation: async () => {
      await releaseCreationReservation(store);
      activeCreationTokenRef.current = null;
      setCreationStatus('idle');
      setCreationError(null);
    },
    onRejoinRecoveredCreatedGame: async () => {
      setCreationStatus('reconciling');
      setCreationError(null);
      const result = await recoverCreatedBotGame(store, { getGameState: args.getGameState });
      if (result.kind === 'recovered') {
        setCreationStatus('idle');
        args.navigateToGame(result.gameId);
        return;
      }
      setCreationStatus(result.kind === 'conflict' ? 'stale_success' : 'error');
      setCreationError(result.error);
    },
  }), [
    args,
    executeCreation,
    onConfirmWinStreakAbandonment,
    onResetWinStreak,
    profile.creationReservation?.recoveryGameId,
    profile.trackedGame,
    reconcileForCreation,
    store,
  ]);

  const streakState = profile.currentCount > 0
    ? 'active' as const
    : profile.endedStreak
      ? 'ended' as const
      : 'hidden' as const;
  const trackedForNotice = profile.trackedGame && profile.trackedGame.status !== 'settled'
    ? profile.trackedGame
    : null;
  const effectiveUnfinishedStatus = unfinishedStatus === 'none' && trackedForNotice
    ? 'known_unfinished'
    : unfinishedStatus;
  const creation = creationViewModelFromReservation(
    profile.creationReservation,
    creationStatus,
    creationError,
    activeCreationTokenRef.current,
  );
  const viewModel: WinStreakMenuViewModel = {
    currentCount: profile.currentCount,
    displayCount: streakState === 'ended' ? profile.endedStreak?.count ?? 0 : profile.currentCount,
    streakState,
    shouldShowContent: streakState !== 'hidden',
    creation,
    reset: { busy: resetBusy, error: resetError },
    unfinishedGame: unfinishedViewModel({
      status: effectiveUnfinishedStatus,
      gameId: trackedForNotice?.gameId ?? null,
      error: unfinishedError,
      canConfirm: effectiveUnfinishedStatus === 'confirmation_required' || effectiveUnfinishedStatus === 'inaccessible',
    }),
  };

  return { viewModel, actions, requestComputerGame };
}
