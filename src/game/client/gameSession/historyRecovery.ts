import type { BattleLogHistoryResponse } from './types';

export const HISTORY_RECOVERY_DELAYS_MS = [250, 750, 1500] as const;

export interface HistoryRecoveryExpectation {
  gameId: string;
  missingTurnNumber: number;
}

export interface HistoryRecoveryState {
  key: string;
  expectation: HistoryRecoveryExpectation;
  attempt: number;
  status: 'pending' | 'deferred';
}

export type HistoryFetchOutcome =
  | { kind: 'accepted'; history: BattleLogHistoryResponse }
  | { kind: 'failed' };

export interface HistoryRecoveryClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface HistoryRecoveryObservation {
  gameId: string | null;
  turnNumber: number | null;
  isFinished: boolean;
  expectation: HistoryRecoveryExpectation | null;
  history: BattleLogHistoryResponse | null;
}

export interface HistoryRecoveryCoordinator {
  observe(observation: HistoryRecoveryObservation): void;
  dispose(): void;
}

export function getHistoryRecoveryKey(expectation: HistoryRecoveryExpectation): string {
  return `${expectation.gameId}::archive::${expectation.missingTurnNumber}`;
}

export function historyContainsTurn(
  history: { turns?: Array<{ turnNumber?: number }> } | null | undefined,
  turnNumber: number,
): boolean {
  return Array.isArray(history?.turns) &&
    history.turns.some((turn) => turn?.turnNumber === turnNumber);
}

const RESOLVED_TERMINAL_REASONS = new Set([
  'decisive',
  'narrow',
  'mutual_destruction',
]);

export function deriveHistoryRecoveryExpectation(args: {
  gameId: string;
  currentTurnNumber: number;
  status: string | null | undefined;
  resultReason: string | null | undefined;
  history?: { turns?: Array<{ turnNumber?: number }> } | null;
}): HistoryRecoveryExpectation | null {
  const expectedTurnNumber = args.status === 'finished'
    ? RESOLVED_TERMINAL_REASONS.has(args.resultReason ?? '')
      ? args.currentTurnNumber
      : null
    : args.status === 'active' && args.currentTurnNumber > 1
      ? args.currentTurnNumber - 1
      : null;

  if (
    expectedTurnNumber == null ||
    expectedTurnNumber < 1 ||
    historyContainsTurn(args.history, expectedTurnNumber)
  ) {
    return null;
  }
  return {
    gameId: args.gameId,
    missingTurnNumber: expectedTurnNumber,
  };
}

export function createHistoryRecoveryCoordinator(args: {
  request: (gameId: string) => Promise<HistoryFetchOutcome>;
  onHistoryAccepted: (history: BattleLogHistoryResponse) => void;
  onRecoveryStateChange: (state: HistoryRecoveryState | null) => void;
  onExpectationSatisfied: (expectation: HistoryRecoveryExpectation) => void;
  clock?: HistoryRecoveryClock;
}): HistoryRecoveryCoordinator {
  const clock: HistoryRecoveryClock = args.clock ?? {
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  };
  let disposed = false;
  let epoch = 0;
  let gameId: string | null = null;
  let latestObservationKey: string | null = null;
  let lastStartedObservationKey: string | null = null;
  let expectation: HistoryRecoveryExpectation | null = null;
  let expectationKey: string | null = null;
  let acceptedHistory: BattleLogHistoryResponse | null = null;
  let completedRetryCount = 0;
  let hasCompletedCurrentGameRequest = false;
  let timer: unknown = null;
  let publishedRecoveryState: HistoryRecoveryState | null = null;
  let inFlight: {
    epoch: number;
    gameId: string;
    observationKey: string | null;
    expectationKey: string | null;
    kind: 'normal' | 'retry';
    retryNumber: number;
    acceptanceValid: boolean;
  } | null = null;

  const clearTimer = (): void => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };
  const publishRecoveryState = (next: HistoryRecoveryState | null): void => {
    const unchanged = next === null
      ? publishedRecoveryState === null
      : publishedRecoveryState?.key === next.key &&
        publishedRecoveryState.attempt === next.attempt &&
        publishedRecoveryState.status === next.status;
    if (unchanged) return;
    publishedRecoveryState = next;
    args.onRecoveryStateChange(next);
  };
  const pendingState = (): HistoryRecoveryState | null => expectation
    ? {
        key: getHistoryRecoveryKey(expectation),
        expectation,
        attempt: completedRetryCount,
        status: 'pending',
      }
    : null;
  const resetForGame = (nextGameId: string | null): void => {
    epoch += 1;
    clearTimer();
    inFlight = null;
    gameId = nextGameId;
    latestObservationKey = null;
    lastStartedObservationKey = null;
    expectation = null;
    expectationKey = null;
    acceptedHistory = null;
    completedRetryCount = 0;
    hasCompletedCurrentGameRequest = false;
    publishRecoveryState(null);
  };
  const satisfyExpectation = (): void => {
    if (!expectation) return;
    const satisfied = expectation;
    clearTimer();
    expectation = null;
    expectationKey = null;
    completedRetryCount = 0;
    lastStartedObservationKey = latestObservationKey;
    publishRecoveryState(null);
    args.onExpectationSatisfied(satisfied);
  };
  const archiveHasArrived = (): boolean =>
    expectation !== null &&
    acceptedHistory?.gameId === expectation.gameId &&
    historyContainsTurn(acceptedHistory, expectation.missingTurnNumber);

  const scheduleNextRetry = (): void => {
    if (disposed || !gameId || !expectation || timer !== null || inFlight !== null) return;
    if (completedRetryCount >= HISTORY_RECOVERY_DELAYS_MS.length) {
      publishRecoveryState({
        key: getHistoryRecoveryKey(expectation),
        expectation,
        attempt: completedRetryCount,
        status: 'deferred',
      });
      return;
    }
    const delayMs = HISTORY_RECOVERY_DELAYS_MS[completedRetryCount];
    const scheduledEpoch = epoch;
    const scheduledExpectationKey = expectationKey;
    publishRecoveryState(pendingState());
    timer = clock.setTimeout(() => {
      timer = null;
      if (
        disposed ||
        epoch !== scheduledEpoch ||
        expectationKey !== scheduledExpectationKey ||
        !gameId ||
        !expectation
      ) {
        return;
      }
      startRequest('retry', completedRetryCount + 1);
    }, delayMs);
  };

  const handleCompletion = (
    token: NonNullable<typeof inFlight>,
    outcome: HistoryFetchOutcome,
  ): void => {
    if (
      disposed ||
      inFlight !== token ||
      token.epoch !== epoch ||
      token.gameId !== gameId
    ) {
      return;
    }
    inFlight = null;
    hasCompletedCurrentGameRequest = true;
    lastStartedObservationKey = latestObservationKey;
    if (!token.acceptanceValid) {
      if (
        latestObservationKey &&
        latestObservationKey !== token.observationKey
      ) {
        startRequest('normal', 0);
      }
      return;
    }
    if (
      outcome.kind === 'accepted' &&
      outcome.history.gameId === token.gameId
    ) {
      acceptedHistory = outcome.history;
      args.onHistoryAccepted(outcome.history);
    }
    if (archiveHasArrived()) {
      satisfyExpectation();
      return;
    }
    if (expectation) {
      if (
        token.kind === 'retry' &&
        token.expectationKey === expectationKey
      ) {
        completedRetryCount = token.retryNumber;
      } else if (token.expectationKey !== expectationKey) {
        completedRetryCount = 0;
      }
      scheduleNextRetry();
      return;
    }
    if (
      latestObservationKey &&
      latestObservationKey !== token.observationKey
    ) {
      startRequest('normal', 0);
    }
  };

  function startRequest(kind: 'normal' | 'retry', retryNumber: number): void {
    if (disposed || !gameId || inFlight !== null) return;
    clearTimer();
    const token = {
      epoch,
      gameId,
      observationKey: latestObservationKey,
      expectationKey,
      kind,
      retryNumber,
      acceptanceValid: true,
    } as const;
    inFlight = token;
    if (kind === 'normal') lastStartedObservationKey = latestObservationKey;
    if (expectation) publishRecoveryState(pendingState());
    void args.request(token.gameId).then(
      (outcome) => handleCompletion(token, outcome),
      () => handleCompletion(token, { kind: 'failed' }),
    );
  }

  return {
    observe(observation) {
      if (disposed) return;
      if (observation.gameId !== gameId) resetForGame(observation.gameId);
      if (!gameId) return;

      const nextObservationKey = Number.isInteger(observation.turnNumber)
        ? `${gameId}::history::${observation.turnNumber}::${observation.isFinished ? 'finished' : 'active'}`
        : null;
      latestObservationKey = nextObservationKey;
      acceptedHistory = observation.history?.gameId === gameId
        ? observation.history
        : acceptedHistory;

      const nextExpectation = observation.expectation?.gameId === gameId
        ? observation.expectation
        : null;
      const nextExpectationKey = nextExpectation
        ? getHistoryRecoveryKey(nextExpectation)
        : null;
      if (nextExpectationKey !== expectationKey) {
        clearTimer();
        expectation = nextExpectation;
        expectationKey = nextExpectationKey;
        completedRetryCount = 0;
        publishRecoveryState(expectation ? pendingState() : null);
      } else {
        expectation = nextExpectation;
      }

      if (archiveHasArrived()) {
        if (inFlight) {
          inFlight.acceptanceValid = false;
        }
        satisfyExpectation();
        return;
      }
      if (
        inFlight === null &&
        timer === null &&
        nextObservationKey &&
        nextObservationKey !== lastStartedObservationKey
      ) {
        startRequest('normal', 0);
        return;
      }
      if (
        expectation &&
        inFlight === null &&
        timer === null &&
        hasCompletedCurrentGameRequest
      ) {
        scheduleNextRetry();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      epoch += 1;
      clearTimer();
      inFlight = null;
    },
  };
}
