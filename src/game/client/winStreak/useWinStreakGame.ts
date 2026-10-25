import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deriveWinStreakGameViewModel,
  projectAuthoritativeWinStreakGame,
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
  failBotGameCreation,
  prepareBotGameCreation,
} from './workflow';

export type WinStreakResignationResult =
  | { ok: true; state: unknown }
  | { ok: false; error: string };

interface UseWinStreakGameArgs {
  effectiveGameId: string | null;
  effectivePlayerName: string;
  humanPlayerId: string | null;
  authoritativeGame: AuthoritativeWinStreakGame | null;
  getLatestAuthoritativeGame: () => AuthoritativeWinStreakGame | null;
  resignGame: (sourceGameId: string) => Promise<WinStreakResignationResult>;
  isResigning: () => boolean;
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
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetRetryAvailable, setResetRetryAvailable] = useState(false);
  // Creation, Reset and automatic restart recovery share one synchronous guard.
  const submissionRef = useRef(false);
  const activeCreationTokenRef = useRef<string | null>(null);
  const dedicatedRecoverySourceRef = useRef<string | null>(null);
  const recoveredRestartRef = useRef<string | null>(null);
  const latestArgsRef = useRef(args);
  latestArgsRef.current = args;
  const navigateToGameRef = useRef(args.navigateToGame);
  navigateToGameRef.current = args.navigateToGame;

  const requestBotRematch = useCallback(async (): Promise<void> => {
    const args = latestArgsRef.current;
    if (!args.effectiveGameId || submissionRef.current || args.isResigning()) return;
    submissionRef.current = true;
    setResetBusy(true);
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
      submissionRef.current = false;
      setResetBusy(false);
    }
  }, [store]);

  const resetWinStreak = useCallback(async (): Promise<void> => {
    const args = latestArgsRef.current;
    const sourceGameId = args.effectiveGameId;
    const humanPlayerId = args.humanPlayerId;
    if (!sourceGameId || !humanPlayerId || submissionRef.current || args.isResigning()) return;
    const isCurrent = () => latestArgsRef.current.effectiveGameId === sourceGameId &&
      latestArgsRef.current.humanPlayerId === humanPlayerId;
    submissionRef.current = true;
    setResetBusy(true);
    setResetError(null);
    setResetRetryAvailable(false);
    let dedicatedAttempt = dedicatedRecoverySourceRef.current === sourceGameId;
    try {
      await args.awaitPendingObservation();
      if (!isCurrent()) return;
      const game = latestArgsRef.current.getLatestAuthoritativeGame();
      if (!game || game.gameId !== sourceGameId || game.humanPlayerId !== humanPlayerId) {
        setResetError('The current bot game could not be verified.');
        return;
      }
      dedicatedAttempt = dedicatedAttempt || game.serverCanRestart || game.restartLifecycle?.kind === 'source';
      if (!dedicatedAttempt && (game.status === 'finished' || game.restartLifecycle != null)) return;
      const preflight = await store.inspect((current) => ({
        generation: current.generation,
        trackedGameId: current.trackedGame?.gameId ?? null,
        trackedHumanPlayerId: current.trackedGame?.humanPlayerId,
        trackedStatus: current.trackedGame?.status,
        resultEligible: current.trackedGame?.resultEligible,
        hasCreationReservation: current.creationReservation != null,
      }));
      if (!isCurrent()) return;
      if (
        preflight.hasCreationReservation ||
        (preflight.trackedGameId !== null && (preflight.trackedGameId !== sourceGameId ||
          preflight.trackedHumanPlayerId !== humanPlayerId))
      ) {
        setResetError('The win-streak profile changed before the restart request started.');
        return;
      }
      if (!dedicatedAttempt) {
        if (preflight.trackedGameId !== sourceGameId ||
          preflight.trackedHumanPlayerId !== humanPlayerId ||
          preflight.trackedStatus !== 'unfinished' || !preflight.resultEligible) {
          setResetError('The current game is no longer tracked for this win streak.');
          return;
        }
        const resigned = await args.resignGame(sourceGameId);
        if (!isCurrent()) return;
        if (!resigned.ok) {
          setResetError(resigned.error);
          return;
        }
        const finished = projectAuthoritativeWinStreakGame(resigned.state, humanPlayerId);
        if (!finished || finished.gameId !== sourceGameId || finished.humanPlayerId !== humanPlayerId ||
          finished.status !== 'finished' || finished.outcome !== 'loss' || finished.restartLifecycle != null) {
          setResetError('Resignation did not confirm a finished loss for the current player.');
          return;
        }
        await args.awaitPendingObservation();
        if (!isCurrent()) return;
        const prepared = await prepareBotGameCreation({
          store,
          transport: { getGameState: args.getGameState },
          kind: 'rematch',
          sourceGameId,
          requiredSettledSource: { gameId: sourceGameId, humanPlayerId },
        });
        if (prepared.kind !== 'reserved') {
          setResetError(prepared.error);
          return;
        }
        activeCreationTokenRef.current = prepared.reservation.token;
        if (!isCurrent()) {
          await failBotGameCreation(store, prepared.reservation, {
            ambiguous: false, error: 'The current game changed before creation.',
          });
          return;
        }
        const result = await executeReservedBotGameCreation({
          store,
          reservation: prepared.reservation,
          canStart: isCurrent,
          request: (count) => args.createBotRematch(sourceGameId, count),
          getHumanPlayerId: async () => {
            const currentId = await args.getCurrentHumanPlayerId(args.effectivePlayerName);
            if (currentId !== humanPlayerId) throw new Error('The player identity changed during reset.');
            return currentId;
          },
          invalidResponseMessage: 'New game request returned an invalid payload.',
        });
        if (result.kind === 'registered') {
          if (isCurrent()) args.navigateToGame(result.gameId);
        } else {
          setResetError(result.error ?? 'New game creation needs recovery.');
          console.error('[WinStreak] Reset game creation failed:', result.error);
        }
        return;
      }
      dedicatedRecoverySourceRef.current = sourceGameId;
      const response = await args.resetWinStreak(sourceGameId);
      if (!isCurrent()) return;
      if (!response.ok) {
        const message = await response.text();
        setResetError(message || `Win-streak reset failed (${response.status}).`);
        setResetRetryAvailable(response.status >= 500);
        if (response.status < 500) dedicatedRecoverySourceRef.current = null;
        await args.refreshGameStateOnce();
        return;
      }
      const body = await response.json().catch(() => null);
      if (!isCurrent()) return;
      const replacementGameId = typeof body?.gameId === 'string' ? body.gameId : null;
      const returnedSourceGameId = typeof body?.sourceGameId === 'string' ? body.sourceGameId : null;
      if (
        !replacementGameId ||
        returnedSourceGameId !== sourceGameId ||
        body?.resetStatus !== 'completed'
      ) {
        setResetError('Win-streak reset returned an invalid response.');
        setResetRetryAvailable(true);
        return;
      }
      const completion = await completeWinStreakRestart(
        store,
        sourceGameId,
        replacementGameId,
        humanPlayerId,
        preflight.generation,
      );
      if (completion !== 'registered') {
        setResetError('The win-streak profile changed before the restart completed.');
        setResetRetryAvailable(false);
        return;
      }
      setResetRetryAvailable(false);
      dedicatedRecoverySourceRef.current = null;
      recoveredRestartRef.current = `${sourceGameId}:${replacementGameId}`;
      if (isCurrent()) args.navigateToGame(replacementGameId);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Win-streak reset may not have completed.');
      setResetRetryAvailable(dedicatedAttempt);
    } finally {
      activeCreationTokenRef.current = null;
      submissionRef.current = false;
      setResetBusy(false);
    }
  }, [store]);

  useEffect(() => {
    const lifecycle = args.authoritativeGame?.restartLifecycle;
    if (!lifecycle || lifecycle.kind !== 'source' || !args.humanPlayerId ||
      args.effectiveGameId !== lifecycle.sourceGameId ||
      args.authoritativeGame?.humanPlayerId !== args.humanPlayerId) return;
    if (lifecycle.status === 'pending') {
      dedicatedRecoverySourceRef.current = lifecycle.sourceGameId;
      setResetRetryAvailable(true);
      setResetError('The win-streak restart is pending recovery.');
      return;
    }
    const key = `${lifecycle.sourceGameId}:${lifecycle.replacementGameId}`;
    if (recoveredRestartRef.current === key) return;
    if (submissionRef.current || args.isResigning()) return;
    submissionRef.current = true;
    setRecoveryBusy(true);
    recoveredRestartRef.current = key;
    const humanPlayerId = args.humanPlayerId;
    void completeWinStreakRestart(
      store,
      lifecycle.sourceGameId,
      lifecycle.replacementGameId,
      args.humanPlayerId,
    ).then((completion) => {
      if (completion === 'registered') {
        dedicatedRecoverySourceRef.current = null;
        setResetRetryAvailable(false);
        setResetError(null);
        if (latestArgsRef.current.effectiveGameId === lifecycle.sourceGameId &&
          latestArgsRef.current.humanPlayerId === humanPlayerId) {
          navigateToGameRef.current(lifecycle.replacementGameId);
        }
        return;
      }
      recoveredRestartRef.current = null;
      setResetError('The completed restart is waiting for the current streak workflow to finish.');
    }).catch((error) => {
      recoveredRestartRef.current = null;
      setResetError(
        error instanceof Error ? error.message : 'Unable to recover the completed win-streak restart.',
      );
    }).finally(() => {
      submissionRef.current = false;
      setRecoveryBusy(false);
    });
  }, [
    args.authoritativeGame?.restartLifecycle,
    args.humanPlayerId,
    profile.creationReservation?.token,
    resetBusy,
    args.resignBusy,
    store,
  ]);

  const actions: WinStreakGameActions = {
    requestBotRematch,
    resetWinStreak,
  };

  const viewModel = deriveWinStreakGameViewModel({
    profile,
    game: args.authoritativeGame,
    resetBusy: resetBusy || recoveryBusy || args.resignBusy === true,
    resetError,
    resetRetryAvailable,
  });

  return { viewModel, actions };
}
