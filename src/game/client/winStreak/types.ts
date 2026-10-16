export type WinStreakState = 'hidden' | 'active' | 'ended';

export interface WinStreakMenuViewModel {
  currentCount: number;
  displayCount: number;
  streakState: WinStreakState;
  shouldShowContent: boolean;
  reset: {
    busy: boolean;
    error: string | null;
  };
  rejoinCandidate: { gameId: string } | null;
}

export interface WinStreakGameViewModel {
  currentCount: number;
  displayCount: number;
  streakState: WinStreakState;
  shouldShowContent: boolean;
  appliedBonus: {
    count: number;
    recipientPlayerId: string | null;
    recipientSide: 'viewer' | 'opponent' | null;
    turnOneHoverEligible: boolean;
  };
  reset: {
    serverCanRestart: boolean;
    canSubmit: boolean;
    busy: boolean;
    retryAvailable: boolean;
    error: string | null;
  };
}

export interface WinStreakMenuActions {
  onResetWinStreak: () => Promise<void>;
  onEnterPlayComputer: () => void;
  onRejoinTrackedGame: () => void;
}

export interface WinStreakTrackedGame {
  gameId: string;
  humanPlayerId: string;
  status: 'unfinished' | 'settled' | 'retired' | 'restart_pending';
  resultEligible: boolean;
}

export interface WinStreakEndedSnapshot {
  count: number;
  endingGameId: string;
}

export interface WinStreakCreationReservation {
  token: string;
  kind: 'create' | 'rematch';
  sourceGameId: string | null;
  requestedCount: number;
  baseGeneration: number;
  baseTrackedGameId: string | null;
  baseTrackedGameStatus: WinStreakTrackedGame['status'] | null;
  status: 'reserved' | 'creating' | 'ambiguous' | 'stale_success';
  createdAtMs: number;
  error: string | null;
  recoveryGameId: string | null;
}

export interface WinStreakProfile {
  version: 1;
  revision: number;
  generation: number;
  currentCount: number;
  trackedGame: WinStreakTrackedGame | null;
  endedStreak: WinStreakEndedSnapshot | null;
  creationReservation: WinStreakCreationReservation | null;
  retiredGameIds: string[];
  automaticEnrollmentSealed: boolean;
}

export interface ComputerGameCreateSettings {
  timed: boolean;
  minutes?: number;
  incrementSeconds?: number;
  variantKey?: string;
}
