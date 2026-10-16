import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deriveWinStreakGameViewModel,
  type AuthoritativeWinStreakGame,
} from './authoritative';
import {
  getWinStreakProfileStore,
  type WinStreakProfileStore,
} from './profile';
import type {
  WinStreakCreationStatus,
  WinStreakGameViewModel,
  WinStreakUnfinishedStatus,
} from './types';
import { useWinStreakProfile } from './useWinStreakProfile';
import {
  completeWinStreakRestart,
  creationViewModelFromReservation,
  executeReservedBotGameCreation,
  recoverCreatedBotGame,
  reconcileTrackedWinStreakGame,
  releaseCreationReservation,
  reserveAfterConfirmedAbandonment,
  reserveBotGameCreation,
  unfinishedViewModel,
  type WinStreakCreationPreflight,
} from './workflow';

interface UseWinStreakGameArgs {
  effectiveGameId: string | null;
  effectivePlayerName: string;
  humanPlayerId: string | null;
  authoritativeGame: AuthoritativeWinStreakGame | null;
  awaitPendingObservation: () => Promise<void>;
  getGameState: (gameId: string) => Promise<Response>;
  createBotRematch: (sourceGameId: string, winStreakCount: number) => Promise<Response>;
  resetWinStreak: (sourceGameId: string) => Promise<Response>;
  getCurrentHumanPlayerId: (displayName: string) => Promise<string>;
  refreshGameStateOnce: () => Promise<unknown>;
  navigateToGame: (gameId: string) => void;
  store?: WinStreakProfileStore;
}

export interface WinStreakGameActions {
  requestBotRematch: () => Promise<void>;
  resetWinStreak: () => Promise<void>;
  confirmAbandonment: () => Promise<void>;
  cancelAbandonment: () => void;
  retryReconciliation: () => Promise<void>;
  rejoinTrackedGame: () => void;
  releaseAmbiguousCreation: () => Promise<void>;
  recoverCreatedGame: () => Promise<void>;
}

export function useWinStreakGame(args: UseWinStreakGameArgs): {
  viewModel: WinStreakGameViewModel;
  actions: WinStreakGameActions;
} {
  const store = args.store ?? getWinStreakProfileStore();
  const profile = useWinStreakProfile(store);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetRetryAvailable, setResetRetryAvailable] = useState(false);
  const [creationStatus, setCreationStatus] = useState<WinStreakCreationStatus>('idle');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [unfinishedStatus, setUnfinishedStatus] = useState<WinStreakUnfinishedStatus>('none');
  const [unfinishedGameId, setUnfinishedGameId] = useState<string | null>(null);
  const pendingRematchRef = useRef(false);
  const pendingConfirmationRef = useRef<{
    gameId: string;
    preflight: WinStreakCreationPreflight;
  } | null>(null);
  const activeCreationTokenRef = useRef<string | null>(null);
  const resetSubmissionRef = useRef(false);
  const recoveredRestartRef = useRef<string | null>(null);
  const navigateToGameRef = useRef(args.navigateToGame);
  navigateToGameRef.current = args.navigateToGame;

  const executeReservation = useCallback(async (
    reservation: NonNullable<typeof profile.creationReservation>,
  ): Promise<void> => {
    const sourceGameId = reservation.sourceGameId;
    if (!sourceGameId) return;
    activeCreationTokenRef.current = reservation.token;
    setCreationStatus('creating');
    setCreationError(null);
    const result = await executeReservedBotGameCreation({
      store,
      reservation,
      request: (count) => args.createBotRematch(sourceGameId, count),
      getHumanPlayerId: () => args.getCurrentHumanPlayerId(args.effectivePlayerName),
      invalidResponseMessage: 'New game request returned an invalid payload.',
    });
    activeCreationTokenRef.current = null;
    if (result.kind === 'registered') {
      pendingRematchRef.current = false;
      pendingConfirmationRef.current = null;
      setCreationStatus('idle');
      setUnfinishedStatus('none');
      args.navigateToGame(result.gameId);
      return;
    }
    setCreationStatus(
      result.kind === 'ambiguous'
        ? 'ambiguous'
        : result.kind === 'rejected' || result.kind === 'stale_preflight'
          ? 'error'
          : 'stale_success',
    );
    setCreationError(result.error);
  }, [args, profile.creationReservation, store]);

  const reserveAndExecute = useCallback(async (
    preflight: WinStreakCreationPreflight,
  ): Promise<void> => {
    if (!args.effectiveGameId) return;
    const reserved = await reserveBotGameCreation(
      store,
      'rematch',
      args.effectiveGameId,
      preflight,
    );
    if (reserved.kind !== 'reserved') {
      setCreationStatus('error');
      setCreationError(reserved.kind === 'stale'
        ? 'The win-streak profile changed after reconciliation. Please retry.'
        : 'A bot-game creation request is already in progress.');
      return;
    }
    await executeReservation(reserved.reservation);
  }, [args.effectiveGameId, executeReservation, store]);

  const reconcileForRematch = useCallback(async (
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
      const result = await reconcileTrackedWinStreakGame(
        store,
        { getGameState: args.getGameState },
        { expectedTrackedGameId },
      );
      if (result.kind === 'stale') continue;
      if (result.kind === 'clear') {
        pendingConfirmationRef.current = null;
        setUnfinishedStatus('none');
        return { kind: 'clear', preflight: result.preflight };
      }
      if (result.kind === 'unfinished' || result.kind === 'inaccessible') {
        const gameId = result.kind === 'unfinished' ? result.game.gameId : result.gameId;
        pendingConfirmationRef.current = { gameId, preflight: result.preflight };
        setUnfinishedGameId(gameId);
        setUnfinishedStatus(
          result.kind === 'unfinished' ? 'confirmation_required' : 'inaccessible',
        );
        if (result.kind === 'inaccessible') setCreationError(result.error);
        return { kind: 'blocked', preflight: result.preflight, gameId };
      }
      setUnfinishedGameId(result.kind === 'restart' ? result.game.gameId : result.gameId);
      setUnfinishedStatus(result.kind === 'restart' ? 'restart_recovery' : 'error');
      setCreationError(result.kind === 'restart'
        ? 'The tracked game has a restart to recover.'
        : result.error);
      return { kind: 'error' };
    }
    setCreationStatus('error');
    setUnfinishedStatus('error');
    setCreationError('The tracked game changed during reconciliation. Please retry.');
    return { kind: 'error' };
  }, [args.getGameState, store]);

  const requestBotRematch = useCallback(async (): Promise<void> => {
    if (!args.effectiveGameId) return;
    pendingRematchRef.current = true;
    await args.awaitPendingObservation();
    const result = await reconcileForRematch();
    if (result.kind === 'clear') await reserveAndExecute(result.preflight);
  }, [args, reconcileForRematch, reserveAndExecute]);

  const confirmAbandonment = useCallback(async (): Promise<void> => {
    const confirmation = pendingConfirmationRef.current;
    if (!pendingRematchRef.current || !confirmation || !args.effectiveGameId) return;
    const result = await reconcileForRematch(confirmation.gameId);
    if (result.kind === 'clear') {
      await reserveAndExecute(result.preflight);
      return;
    }
    if (result.kind === 'error') return;
    const reserved = await reserveAfterConfirmedAbandonment(
      store,
      'rematch',
      args.effectiveGameId,
      confirmation.gameId,
      result.preflight,
    );
    if (reserved.kind !== 'reserved') {
      setCreationStatus('error');
      setCreationError(reserved.kind === 'stale'
        ? 'The tracked game changed before abandonment was confirmed. Please reconcile again.'
        : 'A bot-game creation request is already in progress.');
      return;
    }
    setUnfinishedStatus('none');
    await executeReservation(reserved.reservation);
  }, [args.effectiveGameId, executeReservation, reconcileForRematch, reserveAndExecute, store]);

  const resetWinStreak = useCallback(async (): Promise<void> => {
    if (!args.effectiveGameId || !args.humanPlayerId || resetSubmissionRef.current) return;
    if (!args.authoritativeGame?.serverCanRestart && !resetRetryAvailable) return;
    resetSubmissionRef.current = true;
    setResetBusy(true);
    setResetError(null);
    try {
      await args.awaitPendingObservation();
      const preflight = await store.inspect((current) => ({
        generation: current.generation,
        trackedGameId: current.trackedGame?.gameId ?? null,
        hasCreationReservation: current.creationReservation != null,
      }));
      if (
        preflight.hasCreationReservation ||
        (preflight.trackedGameId !== null && preflight.trackedGameId !== args.effectiveGameId)
      ) {
        setResetError('The win-streak profile changed before the restart request started.');
        return;
      }
      const response = await args.resetWinStreak(args.effectiveGameId);
      if (!response.ok) {
        const message = await response.text();
        setResetError(message || `Win-streak reset failed (${response.status}).`);
        setResetRetryAvailable(response.status >= 500);
        await args.refreshGameStateOnce();
        return;
      }
      const body = await response.json().catch(() => null);
      const replacementGameId = typeof body?.gameId === 'string' ? body.gameId : null;
      const sourceGameId = typeof body?.sourceGameId === 'string' ? body.sourceGameId : null;
      if (
        !replacementGameId ||
        sourceGameId !== args.effectiveGameId ||
        body?.resetStatus !== 'completed'
      ) {
        setResetError('Win-streak reset returned an invalid response.');
        setResetRetryAvailable(true);
        return;
      }
      const completion = await completeWinStreakRestart(
        store,
        args.effectiveGameId,
        replacementGameId,
        args.humanPlayerId,
        preflight.generation,
      );
      if (completion !== 'registered') {
        setResetError('The win-streak profile changed before the restart completed.');
        setResetRetryAvailable(false);
        return;
      }
      setResetRetryAvailable(false);
      args.navigateToGame(replacementGameId);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Win-streak reset may not have completed.');
      setResetRetryAvailable(true);
    } finally {
      resetSubmissionRef.current = false;
      setResetBusy(false);
    }
  }, [args, resetRetryAvailable, store]);

  useEffect(() => {
    const lifecycle = args.authoritativeGame?.restartLifecycle;
    if (!lifecycle || lifecycle.kind !== 'source' || !args.humanPlayerId) return;
    if (lifecycle.status === 'pending') {
      setResetRetryAvailable(true);
      setResetError('The win-streak restart is pending recovery.');
      return;
    }
    const key = `${lifecycle.sourceGameId}:${lifecycle.replacementGameId}`;
    if (recoveredRestartRef.current === key) return;
    recoveredRestartRef.current = key;
    void completeWinStreakRestart(
      store,
      lifecycle.sourceGameId,
      lifecycle.replacementGameId,
      args.humanPlayerId,
    ).then((completion) => {
      if (completion === 'registered') {
        navigateToGameRef.current(lifecycle.replacementGameId);
        return;
      }
      recoveredRestartRef.current = null;
      setResetError('The completed restart is waiting for the current streak workflow to finish.');
    }).catch((error) => {
      recoveredRestartRef.current = null;
      setResetError(
        error instanceof Error ? error.message : 'Unable to recover the completed win-streak restart.',
      );
    });
  }, [
    args.authoritativeGame?.restartLifecycle,
    args.humanPlayerId,
    profile.creationReservation?.token,
    store,
  ]);

  const actions: WinStreakGameActions = {
    requestBotRematch,
    resetWinStreak,
    confirmAbandonment,
    cancelAbandonment: () => {
      pendingRematchRef.current = false;
      pendingConfirmationRef.current = null;
      setUnfinishedStatus('none');
      setUnfinishedGameId(null);
    },
    retryReconciliation: async () => {
      if (!pendingRematchRef.current) return;
      const result = await reconcileForRematch();
      if (result.kind === 'clear') await reserveAndExecute(result.preflight);
    },
    rejoinTrackedGame: () => {
      const gameId = profile.trackedGame?.gameId;
      if (gameId) args.navigateToGame(gameId);
    },
    releaseAmbiguousCreation: async () => {
      await releaseCreationReservation(store);
      activeCreationTokenRef.current = null;
      setCreationStatus('idle');
      setCreationError(null);
    },
    recoverCreatedGame: async () => {
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
  };

  const noticeGameId = unfinishedGameId ?? (
    profile.trackedGame && profile.trackedGame.status !== 'settled'
      ? profile.trackedGame.gameId
      : null
  );
  const effectiveUnfinishedStatus = unfinishedStatus === 'none' && noticeGameId
    ? 'known_unfinished'
    : unfinishedStatus;
  const viewModel = deriveWinStreakGameViewModel({
    profile,
    game: args.authoritativeGame,
    resetBusy,
    resetError,
    resetRetryAvailable,
    creation: creationViewModelFromReservation(
      profile.creationReservation,
      creationStatus,
      creationError,
      activeCreationTokenRef.current,
    ),
    unfinishedGame: unfinishedViewModel({
      status: effectiveUnfinishedStatus,
      gameId: noticeGameId,
      error: creationError,
      canConfirm:
        effectiveUnfinishedStatus === 'confirmation_required' ||
        effectiveUnfinishedStatus === 'inaccessible',
    }),
  });

  return { viewModel, actions };
}
