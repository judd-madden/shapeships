import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getAccountWinStreakRuntime, type AccountWinStreakRuntime } from './accountRuntime';
import { requestAccountComputerGame, verifyAccountRejoin } from './accountWorkflow';
import { ACCOUNT_STREAK_ACTION_FAILED } from './types';
import {
  getWinStreakProfileStore,
  type WinStreakProfileStore,
} from './profile';
import type {
  ComputerGameCreateSettings,
  WinStreakMenuActions,
  WinStreakMenuViewModel,
  WinStreakProfile,
} from './types';
import {
  executeReservedBotGameCreation,
  prepareBotGameCreation,
  resetWinStreakFromMenu,
  visibleRejoinCandidate,
  verifyTrackedGameForRejoin,
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
  accountRuntime?: AccountWinStreakRuntime;
  createAccountComputerGameRequest?: (settings: ComputerGameCreateSettings, revision: string) => Promise<Response>;
}

export function useWinStreakMenu(args: UseWinStreakMenuArgs): {
  viewModel: WinStreakMenuViewModel;
  actions: WinStreakMenuActions;
  requestComputerGame: (settings: ComputerGameCreateSettings) => Promise<string>;
} {
  const store = args.store ?? getWinStreakProfileStore();
  const profile = useWinStreakProfile(store);
  const accountRuntime = args.accountRuntime ?? getAccountWinStreakRuntime();
  const account = useSyncExternalStore(accountRuntime.subscribe, accountRuntime.getSnapshot, accountRuntime.getSnapshot);
  const rejoinOwnerRef = useRef<string | null>(null);
  const rejoinValidRef = useRef<() => boolean>(() => true);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [rejoinCandidate, setRejoinCandidate] = useState<{ gameId: string } | null>(null);
  const creationSubmissionRef = useRef(false);
  const activeCreationTokenRef = useRef<string | null>(null);
  const creationHandoffRef = useRef(false);
  const verificationGenerationRef = useRef(0);
  const rejoinCandidateRef = useRef<{ gameId: string } | null>(null);
  rejoinCandidateRef.current = rejoinCandidate;

  const requestComputerGame = useCallback(async (
    settings: ComputerGameCreateSettings,
  ): Promise<string> => {
    if (creationSubmissionRef.current) {
      throw new Error('A computer game creation request is already in progress.');
    }
    creationSubmissionRef.current = true;
    creationHandoffRef.current = true;
    verificationGenerationRef.current += 1;
    setRejoinCandidate(null);
    let registered = false;
    const guestWork = store.captureGuestWork();
    try {
      if (accountRuntime.getSnapshot().mode === 'account') {
        setResetError(null);
        const gameId = await requestAccountComputerGame({ runtime: accountRuntime,
          getSessionId: async () => (await args.getCurrentSession()).sessionId,
          request: revision => {
            if (!args.createAccountComputerGameRequest) throw new Error('Account creation transport is unavailable.');
            return args.createAccountComputerGameRequest(settings, revision);
          },
        });
        registered = true;
        return gameId;
      }
      const prepared = await prepareBotGameCreation({
        store,
        transport: { getGameState: args.getGameState },
        kind: 'create',
        sourceGameId: null,
        activeReservationToken: activeCreationTokenRef.current,
      });
      if (prepared.kind !== 'reserved') throw new Error(prepared.error);
      if (!guestWork()) throw new Error('Session changed.');

      activeCreationTokenRef.current = prepared.reservation.token;
      const result = await executeReservedBotGameCreation({
        store,
        reservation: prepared.reservation,
        canStart: guestWork,
        request: (count) => args.createComputerGameRequest(settings, count),
        getHumanPlayerId: async () => (await args.getCurrentSession()).sessionId,
        invalidResponseMessage: 'Computer game creation returned an invalid response.',
      });
      activeCreationTokenRef.current = null;
      if (result.kind !== 'registered') {
        throw new Error(result.error ?? 'Computer game creation failed.');
      }
      // The next genuine Play Computer visit clears this after the current menu unmounts.
      registered = true;
      return result.gameId;
    } catch (error) {
      if (accountRuntime.getSnapshot().mode === 'account') {
        setResetError(error instanceof Error ? error.message : ACCOUNT_STREAK_ACTION_FAILED);
      }
      throw error;
    } finally {
      if (!registered) creationHandoffRef.current = false;
      activeCreationTokenRef.current = null;
      creationSubmissionRef.current = false;
    }
  }, [args.createComputerGameRequest, args.getCurrentSession, args.getGameState, args.createAccountComputerGameRequest, accountRuntime, store]);

  const onEnterPlayComputer = useCallback((): void => {
    creationHandoffRef.current = false;
    setRejoinCandidate(null);
    const verificationGeneration = ++verificationGenerationRef.current;
    rejoinOwnerRef.current = accountRuntime.getSnapshot().accountId;
    if (accountRuntime.getSnapshot().mode === 'account') {
      const isCurrent = accountRuntime.capture();
      rejoinValidRef.current = isCurrent;
      void (async () => {
        try {
          const snapshot = await accountRuntime.menuEntry();
          const sessionId = (await args.getCurrentSession()).sessionId;
          const candidate = await verifyAccountRejoin({ snapshot, sessionId, getGameState: args.getGameState });
          if (isCurrent() && verificationGenerationRef.current === verificationGeneration
            && !creationHandoffRef.current && accountRuntime.getSnapshot().streak?.revision === snapshot.revision) {
            setRejoinCandidate(candidate);
          }
        } catch { /* The existing error slot displays account unavailability. */ }
      })();
      return;
    }
    const guestWork = store.captureGuestWork();
    rejoinValidRef.current = guestWork;
    void verifyTrackedGameForRejoin(store, { getGameState: args.getGameState })
      .then((candidate) => {
        if (
          guestWork() && verificationGenerationRef.current === verificationGeneration &&
          !creationHandoffRef.current
        ) {
          setRejoinCandidate(candidate);
        }
      })
      .catch(() => {
        if (verificationGenerationRef.current === verificationGeneration) {
          setRejoinCandidate(null);
        }
      });
  }, [args.getGameState, args.getCurrentSession, accountRuntime, store]);

  const onResetWinStreak = useCallback(async (): Promise<void> => {
    setResetBusy(true);
    setResetError(null);
    try {
      if (accountRuntime.getSnapshot().mode === 'account') await accountRuntime.reset();
      else await resetWinStreakFromMenu(store);
      setRejoinCandidate(null);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset the win streak.');
    } finally {
      setResetBusy(false);
    }
  }, [accountRuntime, store]);

  const actions = useMemo<WinStreakMenuActions>(() => ({
    onResetWinStreak,
    onEnterPlayComputer,
    onRetryCarryOver: async () => { setResetError(null); await accountRuntime.retryImport('compare'); },
    onKeepAccountStreak: async () => { setResetError(null); await accountRuntime.retryImport('decline'); },
    onRejoinTrackedGame: () => {
      const gameId = rejoinCandidateRef.current?.gameId;
      if (gameId && rejoinValidRef.current() && !accountRuntime.getSnapshot().pending && rejoinOwnerRef.current === accountRuntime.getSnapshot().accountId && !creationHandoffRef.current) args.navigateToGame(gameId);
    },
  }), [args.navigateToGame, onEnterPlayComputer, onResetWinStreak, accountRuntime]);

  const streakState = profile.currentCount > 0
    ? 'active' as const
    : profile.endedStreak
      ? 'ended' as const
      : 'hidden' as const;
  const viewModel: WinStreakMenuViewModel = {
    currentCount: profile.currentCount,
    displayCount: streakState === 'ended' ? profile.endedStreak?.count ?? 0 : profile.currentCount,
    streakState,
    shouldShowContent: streakState !== 'hidden',
    reset: { busy: resetBusy, error: resetError },
    rejoinCandidate: visibleRejoinCandidate(
      profile.currentCount,
      rejoinCandidate,
      creationHandoffRef.current,
    ),
  };

  if (account.mode === 'account') {
    const streak = account.streak;
    const state = streak && streak.currentCount > 0 ? 'active' : streak?.endedStreak ? 'ended' : 'hidden';
    return { actions, requestComputerGame, viewModel: {
      accountMode: true,
      currentCount: streak?.currentCount ?? 0,
      displayCount: state === 'ended' ? streak?.endedStreak?.count ?? 0 : streak?.currentCount ?? 0,
      streakState: state, shouldShowContent: state !== 'hidden',
      reset: { busy: resetBusy || account.busy, error: account.pending ? account.error : resetError ?? account.error },
      createDisabled: account.pending || (account.candidate !== null && account.entryBusy) || account.busy || resetBusy,
      carryOver: account.pending && account.candidate ? { guestCount: account.candidate.currentCount,
        accountCount: streak?.currentCount ?? null, busy: account.busy } : undefined,
      rejoinCandidate: !account.pending && rejoinValidRef.current() && rejoinOwnerRef.current === account.accountId
        && !creationHandoffRef.current && streak?.trackedGame?.gameId === rejoinCandidate?.gameId
        ? rejoinCandidate : null,
    } };
  }
  if (rejoinOwnerRef.current !== null) viewModel.rejoinCandidate = null;
  return { viewModel, actions, requestComputerGame };
}
