import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
}

export function useWinStreakMenu(args: UseWinStreakMenuArgs): {
  viewModel: WinStreakMenuViewModel;
  actions: WinStreakMenuActions;
  requestComputerGame: (settings: ComputerGameCreateSettings) => Promise<string>;
} {
  const store = args.store ?? getWinStreakProfileStore();
  const profile = useWinStreakProfile(store);
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
    try {
      const prepared = await prepareBotGameCreation({
        store,
        transport: { getGameState: args.getGameState },
        kind: 'create',
        sourceGameId: null,
        activeReservationToken: activeCreationTokenRef.current,
      });
      if (prepared.kind !== 'reserved') throw new Error(prepared.error);

      activeCreationTokenRef.current = prepared.reservation.token;
      const result = await executeReservedBotGameCreation({
        store,
        reservation: prepared.reservation,
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
    } finally {
      if (!registered) creationHandoffRef.current = false;
      activeCreationTokenRef.current = null;
      creationSubmissionRef.current = false;
    }
  }, [args.createComputerGameRequest, args.getCurrentSession, args.getGameState, store]);

  const onEnterPlayComputer = useCallback((): void => {
    creationHandoffRef.current = false;
    setRejoinCandidate(null);
    const verificationGeneration = ++verificationGenerationRef.current;
    void verifyTrackedGameForRejoin(store, { getGameState: args.getGameState })
      .then((candidate) => {
        if (
          verificationGenerationRef.current === verificationGeneration &&
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
  }, [args.getGameState, store]);

  const onResetWinStreak = useCallback(async (): Promise<void> => {
    setResetBusy(true);
    setResetError(null);
    try {
      await resetWinStreakFromMenu(store);
      setRejoinCandidate(null);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset the win streak.');
    } finally {
      setResetBusy(false);
    }
  }, [store]);

  const actions = useMemo<WinStreakMenuActions>(() => ({
    onResetWinStreak,
    onEnterPlayComputer,
    onRejoinTrackedGame: () => {
      const gameId = rejoinCandidateRef.current?.gameId;
      if (gameId && !creationHandoffRef.current) args.navigateToGame(gameId);
    },
  }), [args.navigateToGame, onEnterPlayComputer, onResetWinStreak]);

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

  return { viewModel, actions, requestComputerGame };
}
