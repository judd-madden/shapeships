import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getAccountWinStreakRuntime, type AccountWinStreakRuntime } from './accountRuntime';
import { requestAccountComputerGame, requestAccountRestart, deriveAccountStreakGameViewModel } from './accountWorkflow';
import { ACCOUNT_STREAK_ACTION_FAILED, ACCOUNT_STREAK_CONFLICT, ACCOUNT_STREAK_UNAVAILABLE } from './types';
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
  accountRuntime?: AccountWinStreakRuntime;
  createAccountBotRematch?: (sourceGameId: string, revision: string) => Promise<Response>;
  resetAccountWinStreak?: (sourceGameId: string, revision: string) => Promise<Response>;
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
  const accountRuntime = args.accountRuntime ?? getAccountWinStreakRuntime();
  const account = useSyncExternalStore(accountRuntime.subscribe, accountRuntime.getSnapshot, accountRuntime.getSnapshot);
  const laterAccountResetRef = useRef<{ source: string; human: string; isCurrent: () => boolean } | null>(null);
  const accountRetryRef = useRef<{ kind: 'rematch' | 'reset'; source: string | null; isCurrent: () => boolean }>({ kind: 'reset', source: null, isCurrent: () => false });
  const accountGameRef = useRef<string | null>(null);
  if (account.mode === 'account') accountGameRef.current = args.effectiveGameId;
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

  async function performAccountAction(kind: 'rematch' | 'reset'): Promise<void> {
    const currentArgs = latestArgsRef.current;
    const source = currentArgs.effectiveGameId, human = currentArgs.humanPlayerId;
    if (!source || !human || submissionRef.current || currentArgs.isResigning()) return;
    const accountCurrent = accountRuntime.capture();
    const isCurrent = () => accountCurrent() && latestArgsRef.current.effectiveGameId === source
      && latestArgsRef.current.humanPlayerId === human;
    submissionRef.current = true;
    accountRetryRef.current = { kind, source, isCurrent: accountCurrent };
    setResetBusy(true); setResetError(null); setResetRetryAvailable(false);
    try {
      await currentArgs.awaitPendingObservation();
      await accountRuntime.ready();
      if (!isCurrent()) return;
      const game = latestArgsRef.current.getLatestAuthoritativeGame();
      if (!game || game.gameId !== source || game.humanPlayerId !== human) throw new Error(ACCOUNT_STREAK_ACTION_FAILED);
      let requireZero = false;
      if (kind === 'reset') {
        const later = laterAccountResetRef.current;
        const continuingLater = later?.source === source && later.human === human && later.isCurrent();
        const dedicated = !continuingLater && (game.serverCanRestart || game.restartLifecycle?.kind === 'source'
          || dedicatedRecoverySourceRef.current === source);
        if (dedicated) {
          dedicatedRecoverySourceRef.current = source;
          const replacement = await requestAccountRestart({ runtime: accountRuntime, sourceGameId: source,
            request: revision => {
              if (!currentArgs.resetAccountWinStreak || !isCurrent()) throw new Error(ACCOUNT_STREAK_ACTION_FAILED);
              return currentArgs.resetAccountWinStreak(source, revision);
            },
          });
          if (isCurrent()) {
            dedicatedRecoverySourceRef.current = null;
            recoveredRestartRef.current = source + ':' + replacement;
            currentArgs.navigateToGame(replacement);
          }
          return;
        }
        if (!continuingLater) {
          if (game.status === 'finished' || game.restartLifecycle) return;
          const resigned = await currentArgs.resignGame(source);
          if (!isCurrent()) return;
          const finished = resigned.ok ? projectAuthoritativeWinStreakGame(resigned.state, human) : null;
          if (!finished || finished.gameId !== source || finished.humanPlayerId !== human
            || finished.outcome !== 'loss' || finished.status !== 'finished' || finished.restartLifecycle) {
            throw new Error(ACCOUNT_STREAK_ACTION_FAILED);
          }
          laterAccountResetRef.current = { source, human, isCurrent: accountCurrent };
        }
        await currentArgs.awaitPendingObservation();
        await accountRuntime.reconcileTerminal(source);
        requireZero = true;
      } else if (game.status === 'finished') await accountRuntime.reconcileTerminal(source);
      if (!isCurrent()) return;
      const replacement = await requestAccountComputerGame({ runtime: accountRuntime,
        getSessionId: () => currentArgs.getCurrentHumanPlayerId(currentArgs.effectivePlayerName),
        request: revision => {
          const snapshot = accountRuntime.getSnapshot().streak;
          if (!currentArgs.createAccountBotRematch || !isCurrent()) throw new Error(ACCOUNT_STREAK_ACTION_FAILED);
          if (requireZero && (snapshot?.currentCount !== 0 || snapshot.trackedGame?.gameId !== source
            || snapshot.trackedGame.status !== 'settled')) throw new Error(ACCOUNT_STREAK_CONFLICT);
          return currentArgs.createAccountBotRematch(source, revision);
        },
      });
      if (isCurrent()) {
        laterAccountResetRef.current = null;
        currentArgs.navigateToGame(replacement);
      }
    } catch (error) {
      if (isCurrent()) {
        setResetError(error instanceof Error && [ACCOUNT_STREAK_CONFLICT, ACCOUNT_STREAK_UNAVAILABLE].includes(error.message)
          ? error.message : ACCOUNT_STREAK_ACTION_FAILED);
        setResetRetryAvailable(true);
      }
    } finally {
      submissionRef.current = false;
      setResetBusy(false);
    }
  }

  const requestBotRematch = useCallback(async (): Promise<void> => {
    const args = latestArgsRef.current;
    if (accountRuntime.getSnapshot().mode === 'account') return performAccountAction('rematch');
    if (accountGameRef.current && accountGameRef.current === args.effectiveGameId) return;
    const guestWork = store.captureGuestWork();
    if (!args.effectiveGameId || submissionRef.current || args.isResigning()) return;
    submissionRef.current = true;
    setResetBusy(true);
    try {
      await args.awaitPendingObservation();
      if (!guestWork()) return;
      const prepared = await prepareBotGameCreation({
        store,
        transport: { getGameState: args.getGameState },
        kind: 'rematch',
        sourceGameId: args.effectiveGameId,
        activeReservationToken: activeCreationTokenRef.current,
      });
      if (!guestWork()) return;
      if (prepared.kind !== 'reserved') {
        console.error('[WinStreak] New game preparation failed:', prepared.error);
        return;
      }
      activeCreationTokenRef.current = prepared.reservation.token;
      const result = await executeReservedBotGameCreation({
        store,
        reservation: prepared.reservation,
        canStart: guestWork,
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
  }, [store, accountRuntime]);

  const resetWinStreak = useCallback(async (): Promise<void> => {
    const args = latestArgsRef.current;
    if (accountRuntime.getSnapshot().mode === 'account') return performAccountAction(
      accountRetryRef.current.source === args.effectiveGameId && accountRetryRef.current.isCurrent()
        ? accountRetryRef.current.kind : 'reset');
    if (accountGameRef.current && accountGameRef.current === args.effectiveGameId) return;
    const guestWork = store.captureGuestWork();
    const sourceGameId = args.effectiveGameId;
    const humanPlayerId = args.humanPlayerId;
    if (!sourceGameId || !humanPlayerId || submissionRef.current || args.isResigning()) return;
    const isCurrent = () => guestWork() && latestArgsRef.current.effectiveGameId === sourceGameId &&
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
  }, [store, accountRuntime]);

  useEffect(() => {
    if (accountRuntime.getSnapshot().mode !== account.mode) return;
    const lifecycle = args.authoritativeGame?.restartLifecycle;
    if (!lifecycle || lifecycle.kind !== 'source' || !args.humanPlayerId ||
      args.effectiveGameId !== lifecycle.sourceGameId ||
      args.authoritativeGame?.humanPlayerId !== args.humanPlayerId) return;
    if (account.mode === 'account') {
      if (lifecycle.status === 'pending') {
        dedicatedRecoverySourceRef.current = lifecycle.sourceGameId;
        setResetRetryAvailable(true); setResetError(ACCOUNT_STREAK_ACTION_FAILED);
        return;
      }
      const key = lifecycle.sourceGameId + ':' + lifecycle.replacementGameId;
      if (recoveredRestartRef.current === key || submissionRef.current || args.isResigning()) return;
      const isCurrent = accountRuntime.capture();
      recoveredRestartRef.current = key;
      submissionRef.current = true; setRecoveryBusy(true);
      void accountRuntime.refresh().then(() => {
        if (isCurrent() && latestArgsRef.current.effectiveGameId === lifecycle.sourceGameId
          && latestArgsRef.current.humanPlayerId === args.humanPlayerId) {
          setResetError(null); setResetRetryAvailable(false);
          navigateToGameRef.current(lifecycle.replacementGameId);
        }
      }).catch((error) => {
        if (isCurrent()) {
          // Keep this observation marked; only the explicit retry may dispatch again.
          dedicatedRecoverySourceRef.current = lifecycle.sourceGameId;
          setResetError(error instanceof Error ? error.message : ACCOUNT_STREAK_ACTION_FAILED); setResetRetryAvailable(true);
        }
      }).finally(() => { submissionRef.current = false; setRecoveryBusy(false); });
      return;
    }
    if (accountGameRef.current && accountGameRef.current === args.effectiveGameId) return;
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
    account.mode,
    account.accountId,
    accountRuntime,
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

  if (account.mode === 'account') return { actions, viewModel: deriveAccountStreakGameViewModel({
    snapshot: account.streak, game: args.authoritativeGame,
    busy: resetBusy || recoveryBusy || args.resignBusy === true || account.busy,
    error: resetError, retryAvailable: resetRetryAvailable,
    blocked: account.entryBusy || account.pending || !account.streak,
  }) };
  return { viewModel, actions };
}
