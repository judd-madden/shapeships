import { useEffect, useRef } from 'react';
import type React from 'react';
import type { UntimedPollingMode } from './useUntimedPollingThrottle';
import type {
  AcceptedFullStateFingerprint,
  AuthoritativeStateApplyMeta,
  GameStateClockSnapshot,
  GameStateHeadResponse,
  GameStateRequestMeta,
} from '../types';

const ACTIVE_POLL_MS = 2000;
const UNTIMED_IDLE_POLL_MS = 12000;
const SAFETY_FULL_REFRESH_MS = 15000;
const POLL_JITTER_MAX_MS = 250;
const FAILURE_BACKOFF_MS = [2500, 5000, 10000, 20000, 30000] as const;

function addPollJitter(delayMs: number | null): number | null {
  if (delayMs == null || delayMs === 0) {
    return delayMs;
  }

  return delayMs + Math.floor(Math.random() * (POLL_JITTER_MAX_MS + 1));
}

function getFailureBackoffMs(consecutiveFailures: number): number {
  const index = Math.min(
    Math.max(consecutiveFailures - 1, 0),
    FAILURE_BACKOFF_MS.length - 1,
  );
  return FAILURE_BACKOFF_MS[index];
}

function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number | null {
  if (value == null) {
    return null;
  }

  const trimmedValue = value.trim();
  if (/^\d+$/.test(trimmedValue)) {
    const seconds = Number(trimmedValue);
    const delayMs = seconds * 1000;
    if (!Number.isSafeInteger(seconds) || !Number.isSafeInteger(delayMs)) {
      return null;
    }

    return delayMs;
  }

  const retryAtMs = Date.parse(trimmedValue);
  if (!Number.isFinite(retryAtMs)) {
    return null;
  }

  return Math.max(0, retryAtMs - nowMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function isClockSnapshot(value: unknown): value is GameStateClockSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isRecord(value.remainingMsByPlayerId) ||
    typeof value.clocksAreLive !== 'boolean' ||
    typeof value.serverNowMs !== 'number'
  ) {
    return false;
  }

  return Object.values(value.remainingMsByPlayerId).every(
    (remainingMs) => typeof remainingMs === 'number',
  );
}

function isGameStateHeadResponse(value: unknown): value is GameStateHeadResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.gameId === 'string' &&
    typeof value.stateRevision === 'number' &&
    value.stateRevision > 0 &&
    typeof value.status === 'string' &&
    typeof value.turnNumber === 'number' &&
    typeof value.phaseKey === 'string' &&
    (value.clock === null || isClockSnapshot(value.clock))
  );
}

function headDiffersFromAcceptedFull(
  head: GameStateHeadResponse,
  fingerprint: AcceptedFullStateFingerprint | null,
): boolean {
  if (!fingerprint) {
    return true;
  }

  return (
    head.stateRevision !== fingerprint.stateRevision ||
    head.status !== fingerprint.status ||
    head.turnNumber !== fingerprint.turnNumber ||
    head.phaseKey !== fingerprint.phaseKey
  );
}

export function useAutoJoinEffect(args: {
  effectiveGameId: string | null;
  effectivePlayerName: string;

  attemptedJoinForGameRef: React.MutableRefObject<Set<string>>;

  ensureSession: (playerName: string) => Promise<{ sessionId: string }>;
  authenticatedPost: (path: string, body: any) => Promise<Response>;
  authenticatedGet: (path: string) => Promise<Response>;

  setMySessionId: (id: string) => void;
  setHasJoinedCurrentGame: (v: boolean) => void;
}) {
  const {
    effectiveGameId,
    effectivePlayerName,
    attemptedJoinForGameRef,
    ensureSession,
    authenticatedPost,
    authenticatedGet,
    setMySessionId,
    setHasJoinedCurrentGame,
  } = args;

  useEffect(() => {
    setHasJoinedCurrentGame(false);
  }, [effectiveGameId, setHasJoinedCurrentGame]);

  useEffect(() => {
    if (effectiveGameId && attemptedJoinForGameRef.current.has(effectiveGameId)) return;
    if (!effectiveGameId) return;

    attemptedJoinForGameRef.current.add(effectiveGameId);

    const attemptJoin = async () => {
      try {
        console.log(`[useGameSession] Auto-join attempt for gameId=${effectiveGameId}, playerName=${effectivePlayerName}`);

        const sessionData = await ensureSession(effectivePlayerName);
        console.log(`[useGameSession] Session ensured before join (sessionId: ${sessionData.sessionId})`);
        setMySessionId(sessionData.sessionId);

        const confirmAuthorized = async (): Promise<boolean> => {
          try {
            const confirmResponse = await authenticatedGet(`/game-state/${effectiveGameId}`);
            if (confirmResponse.ok) {
              return true;
            }

            const errorText = await confirmResponse.text();
            console.warn(`[useGameSession] Auth confirm failed: ${confirmResponse.status} ${errorText}`);
            return false;
          } catch (err: any) {
            console.warn(`[useGameSession] Auth confirm error:`, err.message);
            return false;
          }
        };

        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          console.log(`[useGameSession] Attempting join as player (attempt ${attempt}/${MAX_ATTEMPTS})...`);

          let response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
            playerName: effectivePlayerName,
            role: 'player',
          });

          if (!response.ok) {
            const errorText = await response.text();
            const isBenignError =
              errorText.toLowerCase().includes('already joined') ||
              errorText.toLowerCase().includes('already in game') ||
              response.status === 409;

            if (isBenignError) {
              console.log(`âœ… [useGameSession] Already joined gameId=${effectiveGameId} (benign) - confirming via game-state...`);

              const authorized = await confirmAuthorized();
              if (authorized) {
                console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
                setHasJoinedCurrentGame(true);
                return;
              }

              console.warn(`⚠️ [useGameSession] Auth confirm failed after benign join (attempt ${attempt}/${MAX_ATTEMPTS})`);
              if (attempt < MAX_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                continue;
              }

              console.error(`âŒ [useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
              return;
            }

            const isGameFull =
              errorText.toLowerCase().includes('game full') ||
              errorText.toLowerCase().includes('no slots') ||
              errorText.toLowerCase().includes('full') ||
              response.status === 403;

            if (isGameFull) {
              console.log(`⚠️ [useGameSession] Game full - falling back to spectator join...`);

              response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
                playerName: effectivePlayerName,
                role: 'spectator',
              });

              if (response.ok) {
                console.log(`âœ… [useGameSession] Auto-join request ok (confirming via game-state)...`);

                const authorized = await confirmAuthorized();
                if (authorized) {
                  console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
                  setHasJoinedCurrentGame(true);
                  return;
                }

                console.warn(`⚠️ [useGameSession] Auth confirm failed after spectator join (attempt ${attempt}/${MAX_ATTEMPTS})`);
                if (attempt < MAX_ATTEMPTS) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  continue;
                }

                console.error(`âŒ [useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
                return;
              }

              const spectatorErrorText = await response.text();
              console.error(`âŒ [useGameSession] Spectator join failed: ${response.status} ${spectatorErrorText}`);
              return;
            }

            console.warn(`⚠️ [useGameSession] Auto-join failed for gameId=${effectiveGameId}: ${response.status} ${errorText}`);
            return;
          }

          console.log(`âœ… [useGameSession] Auto-join request ok (confirming via game-state)...`);

          const authorized = await confirmAuthorized();
          if (authorized) {
            console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
            setHasJoinedCurrentGame(true);
            return;
          }

          console.warn(`⚠️ [useGameSession] Auth confirm failed after join (attempt ${attempt}/${MAX_ATTEMPTS})`);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          console.error(`âŒ [useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
          return;
        }
      } catch (err: any) {
        console.error(`âŒ [useGameSession] Auto-join error for gameId=${effectiveGameId}:`, err.message);
      }
    };

    attemptJoin();
  }, [effectiveGameId, effectivePlayerName]);
}

export function usePollingEffect(args: {
  effectiveGameId: string | null;
  hasJoinedCurrentGame: boolean;

  authenticatedGet: (path: string, timeoutMs?: number) => Promise<Response>;

  beginGameStateRequest: (options?: { unlockEligible?: boolean }) => GameStateRequestMeta;
  finishGameStateRequest: (requestSeq: number) => void;
  maybeUnlockResumeSyncFromGameStateSuccess: (payload: unknown, requestMeta: GameStateRequestMeta) => void;
  applyAuthoritativeRawState: (s: any, meta: AuthoritativeStateApplyMeta) => boolean;
  shouldRetryGameStateRequestImmediately: (requestMeta: GameStateRequestMeta) => boolean;
  isResumeSyncLocked: () => boolean;
  maybeUnlockResumeSyncFromValidatedUnchangedHead: () => void;
  hasAcceptedFullGameState: () => boolean;
  getLastAcceptedFullFingerprint: () => AcceptedFullStateFingerprint | null;
  getLastAcceptedFullSyncAtMs: () => number;
  isGameStateRequestInFlight: () => boolean;
  applyHeadClockSnapshot: (clockSnapshot: GameStateClockSnapshot | null) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;

  isFinished: boolean;
  isUntimedAuthoritative: boolean;
  untimedPollingMode: UntimedPollingMode;
  foregroundResumeToken: number;
  postGamePollMs?: number;
}) {
  const {
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    beginGameStateRequest,
    finishGameStateRequest,
    maybeUnlockResumeSyncFromGameStateSuccess,
    applyAuthoritativeRawState,
    shouldRetryGameStateRequestImmediately,
    isResumeSyncLocked,
    maybeUnlockResumeSyncFromValidatedUnchangedHead,
    hasAcceptedFullGameState,
    getLastAcceptedFullFingerprint,
    getLastAcceptedFullSyncAtMs,
    isGameStateRequestInFlight,
    applyHeadClockSnapshot,
    setLoading,
    setError,
    isFinished,
    isUntimedAuthoritative,
    untimedPollingMode,
    foregroundResumeToken,
    postGamePollMs,
  } = args;

  const lastGatedGameIdRef = useRef<string | null>(null);
  const terminalStopGameIdRef = useRef<string | null>(null);
  const terminalStopReasonRef = useRef<'finished' | '403' | '404' | null>(null);
  const lastHandledForegroundResumeTokenRef = useRef<number | null>(null);

  useEffect(() => {
    terminalStopGameIdRef.current = effectiveGameId;
    terminalStopReasonRef.current = null;
  }, [effectiveGameId, foregroundResumeToken]);

  useEffect(() => {
    lastHandledForegroundResumeTokenRef.current = foregroundResumeToken;
  }, [effectiveGameId]);

  useEffect(() => {
    if (!effectiveGameId) {
      setLoading(false);
      setError('No gameId provided');
      return;
    }

    if (!hasJoinedCurrentGame) {
      if (lastGatedGameIdRef.current !== effectiveGameId) {
        console.log(`[useGameSession] Polling gated for gameId=${effectiveGameId} (waiting for join to succeed)`);
        lastGatedGameIdRef.current = effectiveGameId;
      }
      setLoading(true);
      return;
    }

    lastGatedGameIdRef.current = null;

    const POSTGAME_POLL_MS = postGamePollMs ?? 5000;
    if (terminalStopGameIdRef.current === effectiveGameId && terminalStopReasonRef.current) {
      return;
    }

    const getRecurringDelayMs = (nextIsFinished: boolean): number | null => {
      if (nextIsFinished) {
        return POSTGAME_POLL_MS > 0 ? POSTGAME_POLL_MS : null;
      }

      if (!isUntimedAuthoritative) {
        return ACTIVE_POLL_MS;
      }

      if (untimedPollingMode === 'hidden') {
        return null;
      }

      return untimedPollingMode === 'idle'
        ? UNTIMED_IDLE_POLL_MS
        : ACTIVE_POLL_MS;
    };

    const initialDelayMs = getRecurringDelayMs(isFinished);
    const hasResumeEvent =
      lastHandledForegroundResumeTokenRef.current !== foregroundResumeToken;

    if (isFinished && initialDelayMs == null) {
      terminalStopReasonRef.current = 'finished';
      return;
    }

    if (isUntimedAuthoritative && untimedPollingMode === 'hidden') {
      return;
    }

    let mounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldStopPolling = false;
    let isPolling = false;
    let latestHeadRequestToken = 0;
    let foregroundResumeValidationPending = hasResumeEvent;

    const clearPollTimer = () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const stopPolling = (reason: 'finished' | '403' | '404') => {
      terminalStopGameIdRef.current = effectiveGameId;
      terminalStopReasonRef.current = reason;
      shouldStopPolling = true;
      clearPollTimer();
    };

    const scheduleNextPoll = (delayMs: number | null): number | null => {
      clearPollTimer();

      if (!mounted || shouldStopPolling || delayMs == null) {
        return null;
      }

      const scheduledDelayMs = addPollJitter(delayMs) ?? delayMs;
      pollTimer = setTimeout(() => {
        void poll();
      }, scheduledDelayMs);
      return scheduledDelayMs;
    };

    type PollRequestFailure = {
      kind: 'failure';
      error: Error;
      status?: number;
      retryAfterMs: number | null;
    };

    const handleErrorResponse = async (
      response: Response,
    ): Promise<PollRequestFailure | { kind: 'stopped' }> => {
      const retryAfterMs = response.status === 429
        ? parseRetryAfterMs(response.headers.get('Retry-After'))
        : null;
      const errorText = await response.text();

      if (response.status === 403) {
        console.error(`âŒ [useGameSession] Poll error gameId=${effectiveGameId}: Not authorized (403) - stopping polling`);
        stopPolling('403');
        if (mounted) {
          setError('Not authorized to view this game');
          setLoading(false);
        }
        return { kind: 'stopped' };
      }

      if (response.status === 404 && errorText.toLowerCase().includes('game not found')) {
        console.error(`âŒ [useGameSession] Poll error gameId=${effectiveGameId}: Game not found (404) - stopping polling`);
        stopPolling('404');
        if (mounted) {
          setError(`Game not found: ${effectiveGameId}`);
          setLoading(false);
        }
        return { kind: 'stopped' };
      }

      return {
        kind: 'failure',
        error: new Error(`Failed to fetch game state: ${response.status} ${errorText}`),
        status: response.status,
        retryAfterMs,
      };
    };

    const fetchFullGameState = async (options?: {
      unlockEligible?: boolean;
      reason?: string;
    }): Promise<
      | { kind: 'success'; nextPollDelayMs: number | null }
      | (PollRequestFailure & { retryImmediately: boolean })
      | { kind: 'stopped' }
    > => {
      const requestMeta = beginGameStateRequest({
        unlockEligible: options?.unlockEligible === true || isResumeSyncLocked(),
      });
      let nextPollDelayMs = initialDelayMs;

      try {
        const response = await authenticatedGet(`/game-state/${effectiveGameId}`);

        if (!response.ok) {
          const errorResult = await handleErrorResponse(response);
          if (errorResult.kind === 'stopped') {
            return errorResult;
          }

          if (mounted) {
            setError(errorResult.error.message);
            setLoading(false);
          }
          return {
            ...errorResult,
            retryImmediately: shouldRetryGameStateRequestImmediately(requestMeta),
          };
        }

        const data = await response.json();
        maybeUnlockResumeSyncFromGameStateSuccess(data, requestMeta);
        const fetchedIsFinished =
          data?.status === 'finished' ||
          data?.gameData?.status === 'finished';
        const accepted = applyAuthoritativeRawState(data, {
          source: 'game_state',
          requestSeq: requestMeta.requestSeq,
          unlockEligible: requestMeta.unlockEligible,
        });

        if (!accepted) {
          console.log(
            `[useGameSession] Poll ignored stale /game-state response requestSeq=${requestMeta.requestSeq}`
          );
          return { kind: 'success', nextPollDelayMs };
        }

        nextPollDelayMs = getRecurringDelayMs(fetchedIsFinished);
        if (mounted) {
          setLoading(false);
          setError(null);
        }
        return { kind: 'success', nextPollDelayMs };
      } catch (err: any) {
        console.error(
          `âŒ [useGameSession] Poll full-sync error gameId=${effectiveGameId}${options?.reason ? ` (${options.reason})` : ''}:`,
          err,
        );
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
        return {
          kind: 'failure',
          error: err instanceof Error ? err : new Error(String(err)),
          retryAfterMs: null,
          retryImmediately: shouldRetryGameStateRequestImmediately(requestMeta),
        };
      } finally {
        finishGameStateRequest(requestMeta.requestSeq);
      }
    };

    const fetchHeadState = async (): Promise<
      | { kind: 'ok'; head: GameStateHeadResponse }
      | { kind: 'fallback_full'; reason: string }
      | PollRequestFailure
      | { kind: 'skipped' }
      | { kind: 'stopped' }
    > => {
      latestHeadRequestToken += 1;
      const headRequestToken = latestHeadRequestToken;

      try {
        const response = await authenticatedGet(`/game-state-head/${effectiveGameId}`);

        if (!response.ok) {
          const errorResult = await handleErrorResponse(response);
          if (errorResult.kind === 'stopped') {
            return errorResult;
          }

          if (mounted) {
            setError(errorResult.error.message);
            setLoading(false);
          }
          return errorResult;
        }

        let data: unknown;
        try {
          data = await response.json();
        } catch (error) {
          console.warn('[useGameSession] Head poll returned invalid JSON, forcing immediate full sync', error);
          return { kind: 'fallback_full', reason: 'invalid_head_json' };
        }

        if (!mounted || headRequestToken !== latestHeadRequestToken) {
          return { kind: 'skipped' };
        }

        if (!isGameStateHeadResponse(data)) {
          console.warn('[useGameSession] Head poll returned malformed payload, forcing immediate full sync');
          return { kind: 'fallback_full', reason: 'malformed_head_payload' };
        }

        if (data.gameId !== effectiveGameId) {
          console.warn('[useGameSession] Head poll returned a mismatched gameId, forcing immediate full sync');
          return { kind: 'fallback_full', reason: 'mismatched_head_game_id' };
        }

        if (!isUntimedAuthoritative) {
          if (!isClockSnapshot(data.clock)) {
            console.warn('[useGameSession] Timed head poll missing usable clock snapshot, forcing immediate full sync');
            return { kind: 'fallback_full', reason: 'missing_timed_clock_snapshot' };
          }

          applyHeadClockSnapshot(data.clock);
        }

        if (mounted) {
          setLoading(false);
          setError(null);
        }

        return { kind: 'ok', head: data };
      } catch (err: any) {
        console.error(`âŒ [useGameSession] Poll head error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
        return {
          kind: 'failure',
          error: err instanceof Error ? err : new Error(String(err)),
          retryAfterMs: null,
        };
      }
    };

    const shouldFetchImmediately =
      !isUntimedAuthoritative ||
      untimedPollingMode === 'active' ||
      hasResumeEvent;

    if (hasResumeEvent) {
      lastHandledForegroundResumeTokenRef.current = foregroundResumeToken;
    }

    let consecutivePollFailures = 0;

    const poll = async () => {
      if (shouldStopPolling || isPolling) {
        return;
      }

      isPolling = true;
      let nextPollDelayMs = initialDelayMs;
      let cycleOutcome: 'success' | 'failure' | 'skipped' | 'stopped' = 'skipped';
      let failureStatus: number | undefined;
      let failureRetryAfterMs: number | null = null;
      let retryImmediately = false;

      const applyFullResult = (
        fullResult: Awaited<ReturnType<typeof fetchFullGameState>>,
      ) => {
        if (fullResult.kind === 'success') {
          cycleOutcome = 'success';
          nextPollDelayMs = fullResult.nextPollDelayMs;
        } else if (fullResult.kind === 'failure') {
          cycleOutcome = 'failure';
          failureStatus = fullResult.status;
          failureRetryAfterMs = fullResult.retryAfterMs;
          retryImmediately = fullResult.retryImmediately;
        } else {
          cycleOutcome = 'stopped';
        }
      };

      try {
        const shouldFetchInitialFull = !hasAcceptedFullGameState();
        const shouldUseHeadPath = !shouldFetchInitialFull;

        if (!shouldUseHeadPath) {
          const fullResult = await fetchFullGameState({
            unlockEligible: isResumeSyncLocked(),
            reason: 'initial_load',
          });
          applyFullResult(fullResult);
        } else {
          const headResult = await fetchHeadState();

          if (headResult.kind === 'ok') {
            const headFinished = headResult.head.status === 'finished';
            const headDiffers = headDiffersFromAcceptedFull(
              headResult.head,
              getLastAcceptedFullFingerprint(),
            );

            if (
              foregroundResumeValidationPending &&
              !headFinished &&
              !headDiffers
            ) {
              foregroundResumeValidationPending = false;
              maybeUnlockResumeSyncFromValidatedUnchangedHead();
            }

            const isActivePollingPosture =
              !isUntimedAuthoritative ||
              untimedPollingMode === 'active';
            const safetyFullRefreshDue =
              isActivePollingPosture &&
              getLastAcceptedFullSyncAtMs() > 0 &&
              Date.now() - getLastAcceptedFullSyncAtMs() >= SAFETY_FULL_REFRESH_MS;
            const shouldTriggerFullFromHead =
              headFinished ||
              headDiffers ||
              safetyFullRefreshDue;

            if (shouldTriggerFullFromHead && !isGameStateRequestInFlight()) {
              const fullResult = await fetchFullGameState({
                unlockEligible: false,
                reason:
                  headFinished
                    ? 'head_finished_confirmation'
                    : safetyFullRefreshDue
                      ? 'safety_full_refresh'
                      : 'head_detected_change',
              });
              applyFullResult(fullResult);
            } else {
              cycleOutcome = shouldTriggerFullFromHead ? 'skipped' : 'success';
              nextPollDelayMs = getRecurringDelayMs(false);
            }
          } else if (headResult.kind === 'fallback_full') {
            if (!isGameStateRequestInFlight()) {
              const fullResult = await fetchFullGameState({
                unlockEligible: false,
                reason: headResult.reason,
              });
              applyFullResult(fullResult);
            }
          } else if (headResult.kind === 'failure') {
            cycleOutcome = 'failure';
            failureStatus = headResult.status;
            failureRetryAfterMs = headResult.retryAfterMs;
          } else if (headResult.kind === 'stopped') {
            cycleOutcome = 'stopped';
          }
        }
      } catch (err: any) {
        console.error(`âŒ [useGameSession] Poll error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
        cycleOutcome = 'failure';
      } finally {
        isPolling = false;
      }

      if (cycleOutcome === 'success') {
        consecutivePollFailures = 0;
      } else if (cycleOutcome === 'failure') {
        consecutivePollFailures += 1;
        if (retryImmediately) {
          nextPollDelayMs = 0;
        } else {
          nextPollDelayMs = Math.max(
            getFailureBackoffMs(consecutivePollFailures),
            failureRetryAfterMs ?? 0,
          );
        }
      }

      if (mounted && !shouldStopPolling && cycleOutcome !== 'stopped') {
        const scheduledDelayMs = scheduleNextPoll(nextPollDelayMs);
        if (
          cycleOutcome === 'failure' &&
          !retryImmediately &&
          scheduledDelayMs != null
        ) {
          const statusSuffix = failureStatus == null ? '' : `, status=${failureStatus}`;
          console.warn(
            `[useGameSession] Poll backing off gameId=${effectiveGameId}: consecutiveFailures=${consecutivePollFailures}, nextDelayMs=${scheduledDelayMs}${statusSuffix}`,
          );
        }
      }
    };

    if (shouldFetchImmediately) {
      void poll();
    } else {
      scheduleNextPoll(initialDelayMs);
    }

    return () => {
      mounted = false;
      shouldStopPolling = true;
      clearPollTimer();
    };
  }, [
    effectiveGameId,
    hasJoinedCurrentGame,
    isFinished,
    isUntimedAuthoritative,
    untimedPollingMode,
    foregroundResumeToken,
    postGamePollMs,
    finishGameStateRequest,
    hasAcceptedFullGameState,
    getLastAcceptedFullFingerprint,
    getLastAcceptedFullSyncAtMs,
    isGameStateRequestInFlight,
    applyHeadClockSnapshot,
  ]);
}
