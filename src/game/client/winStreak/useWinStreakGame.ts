import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deriveWinStreakGameViewModel,
  type AuthoritativeWinStreakGame,
} from './authoritative';
import {
  getWinStreakProfileStore,
  type WinStreakProfileStore,
} from './profile';
import type { WinStreakGameViewModel } from './types';
import { useWinStreakProfile } from './useWinStreakProfile';
import {
  completeWinStreakRestart,
  executeReservedBotGameCreation,
  prepareBotGameCreation,
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
  resignBusy?: boolean;
  store?: WinStreakProfileStore;
}

export interface WinStreakGameActions {
  requestBotRematch: () => Promise<void>;
  resetWinStreak: () => Promise<void>;
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
  const creationSubmissionRef = useRef(false);
  const activeCreationTokenRef = useRef<string | null>(null);
  const resetSubmissionRef = useRef(false);
  const recoveredRestartRef = useRef<string | null>(null);
  const navigateToGameRef = useRef(args.navigateToGame);
  navigateToGameRef.current = args.navigateToGame;

  const requestBotRematch = useCallback(async (): Promise<void> => {
    if (!args.effectiveGameId || creationSubmissionRef.current) return;
    creationSubmissionRef.current = true;
    try {
      await args.awaitPendingObservation();
      const prepared = await prepareBotGameCreation({
        store,
        transport: { getGameState: args.getGameState },
        kind: 'rematch',
        sourceGameId: args.effectiveGameId,
        activeReservationToken: activeCreationTokenRef.current,
      });
      if (prepared.kind !== 'reserved') {
        console.error('[WinStreak] New game preparation failed:', prepared.error);
        return;
      }
      activeCreationTokenRef.current = prepared.reservation.token;
      const result = await executeReservedBotGameCreation({
        store,
        reservation: prepared.reservation,
        request: (count) => args.createBotRematch(args.effectiveGameId as string, count),
        getHumanPlayerId: () => args.getCurrentHumanPlayerId(args.effectivePlayerName),
        invalidResponseMessage: 'New game request returned an invalid payload.',
      });
      if (result.kind === 'registered') {
        args.navigateToGame(result.gameId);
      } else {
        console.error('[WinStreak] New game creation failed:', result.error);
      }
    } catch (error) {
      console.error('[WinStreak] New game creation failed:', error);
    } finally {
      activeCreationTokenRef.current = null;
      creationSubmissionRef.current = false;
    }
  }, [args, store]);

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
  };

  const viewModel = deriveWinStreakGameViewModel({
    profile,
    game: args.authoritativeGame,
    resetBusy: resetBusy || args.resignBusy === true,
    resetError,
    resetRetryAvailable,
  });

  return { viewModel, actions };
}
