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

const ACTIVE_POLL_MS = 1200;
const UNTIMED_IDLE_POLL_MS = 12000;
const SAFETY_FULL_REFRESH_MS = 15000;

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

              console.warn(`âš ï¸ [useGameSession] Auth confirm failed after benign join (attempt ${attempt}/${MAX_ATTEMPTS})`);
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
              console.log(`âš ï¸ [useGameSession] Game full - falling back to spectator join...`);

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

                console.warn(`âš ï¸ [useGameSession] Auth confirm failed after spectator join (attempt ${attempt}/${MAX_ATTEMPTS})`);
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

            console.warn(`âš ï¸ [useGameSession] Auto-join failed for gameId=${effectiveGameId}: ${response.status} ${errorText}`);
            return;
          }

          console.log(`âœ… [useGameSession] Auto-join request ok (confirming via game-state)...`);

          const authorized = await confirmAuthorized();
          if (authorized) {
            console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
            setHasJoinedCurrentGame(true);
            return;
          }

          console.warn(`âš ï¸ [useGameSession] Auth confirm failed after join (attempt ${attempt}/${MAX_ATTEMPTS})`);
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
  applyAuthoritativeRawState: (s: any, meta: AuthoritativeStateApplyMeta) => boolean;
  shouldRetryGameStateRequestImmediately: (requestMeta: GameStateRequestMeta) => boolean;
  isResumeSyncLocked: () => boolean;
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
  untimedResumeToken: number;
  postGamePollMs?: number;
}) {
  const {
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    beginGameStateRequest,
    finishGameStateRequest,
    applyAuthoritativeRawState,
    shouldRetryGameStateRequestImmediately,
    isResumeSyncLocked,
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
    untimedResumeToken,
    postGamePollMs,
  } = args;

  const lastGatedGameIdRef = useRef<string | null>(null);
  const terminalStopGameIdRef = useRef<string | null>(null);
  const terminalStopReasonRef = useRef<'finished' | '403' | '404' | null>(null);
  const lastHandledResumeTokenRef = useRef<number | null>(null);

  useEffect(() => {
    terminalStopGameIdRef.current = effectiveGameId;
    terminalStopReasonRef.current = null;
    lastHandledResumeTokenRef.current = untimedResumeToken;
  }, [effectiveGameId, untimedResumeToken]);

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
      isUntimedAuthoritative &&
      lastHandledResumeTokenRef.current !== untimedResumeToken;

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
    let pendingResumeFullSync = hasResumeEvent;

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

    const scheduleNextPoll = (delayMs: number | null) => {
      clearPollTimer();

      if (!mounted || shouldStopPolling || delayMs == null) {
        return;
      }

      pollTimer = setTimeout(() => {
        void poll();
      }, delayMs);
    };

    const handleStopErrorResponse = async (response: Response): Promise<boolean> => {
      const errorText = await response.text();

      if (response.status === 403) {
        console.error(`âŒ [useGameSession] Poll error gameId=${effectiveGameId}: Not authorized (403) - stopping polling`);
        stopPolling('403');
        if (mounted) {
          setError('Not authorized to view this game');
          setLoading(false);
        }
        return true;
      }

      if (response.status === 404 && errorText.toLowerCase().includes('game not found')) {
        console.error(`âŒ [useGameSession] Poll error gameId=${effectiveGameId}: Game not found (404) - stopping polling`);
        stopPolling('404');
        if (mounted) {
          setError(`Game not found: ${effectiveGameId}`);
          setLoading(false);
        }
        return true;
      }

      throw new Error(`Failed to fetch game state: ${response.status} ${errorText}`);
    };

    const fetchFullGameState = async (options?: {
      unlockEligible?: boolean;
      reason?: string;
    }): Promise<{ nextPollDelayMs: number | null }> => {
      const requestMeta = beginGameStateRequest({
        unlockEligible: options?.unlockEligible === true,
      });
      let nextPollDelayMs = initialDelayMs;

      try {
        const response = await authenticatedGet(`/game-state/${effectiveGameId}`);

        if (!response.ok) {
          const handled = await handleStopErrorResponse(response);
          if (handled) {
            return { nextPollDelayMs: null };
          }
        }

        const data = await response.json();
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
          return { nextPollDelayMs };
        }

        nextPollDelayMs = getRecurringDelayMs(fetchedIsFinished);
        if (mounted) {
          setLoading(false);
          setError(null);
        }
        return { nextPollDelayMs };
      } catch (err: any) {
        console.error(
          `âŒ [useGameSession] Poll full-sync error gameId=${effectiveGameId}${options?.reason ? ` (${options.reason})` : ''}:`,
          err,
        );
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
        if (shouldRetryGameStateRequestImmediately(requestMeta)) {
          nextPollDelayMs = 0;
        }
        return { nextPollDelayMs };
      } finally {
        finishGameStateRequest(requestMeta.requestSeq);
      }
    };

    const fetchHeadState = async (): Promise<
      | { kind: 'ok'; head: GameStateHeadResponse }
      | { kind: 'fallback_full'; reason: string }
      | { kind: 'error'; nextPollDelayMs: number | null }
    > => {
      latestHeadRequestToken += 1;
      const headRequestToken = latestHeadRequestToken;

      try {
        const response = await authenticatedGet(`/game-state-head/${effectiveGameId}`);

        if (!response.ok) {
          const handled = await handleStopErrorResponse(response);
          if (handled) {
            return { kind: 'error', nextPollDelayMs: null };
          }
        }

        let data: unknown;
        try {
          data = await response.json();
        } catch (error) {
          console.warn('[useGameSession] Head poll returned invalid JSON, forcing immediate full sync', error);
          return { kind: 'fallback_full', reason: 'invalid_head_json' };
        }

        if (!mounted || headRequestToken !== latestHeadRequestToken) {
          return { kind: 'error', nextPollDelayMs: initialDelayMs };
        }

        if (!isGameStateHeadResponse(data)) {
          console.warn('[useGameSession] Head poll returned malformed payload, forcing immediate full sync');
          return { kind: 'fallback_full', reason: 'malformed_head_payload' };
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
        return { kind: 'error', nextPollDelayMs: initialDelayMs };
      }
    };

    const shouldFetchImmediately =
      !isUntimedAuthoritative ||
      untimedPollingMode === 'active' ||
      hasResumeEvent;

    if (hasResumeEvent) {
      lastHandledResumeTokenRef.current = untimedResumeToken;
    }

    const poll = async () => {
      if (shouldStopPolling || isPolling) {
        return;
      }

      isPolling = true;
      let nextPollDelayMs = initialDelayMs;

      try {
        const shouldForceFullForResume = pendingResumeFullSync;
        pendingResumeFullSync = false;
        const shouldFetchInitialFull = !hasAcceptedFullGameState();
        const shouldUseHeadPath =
          !shouldFetchInitialFull &&
          !shouldForceFullForResume;

        if (!shouldUseHeadPath) {
          const fullResult = await fetchFullGameState({
            unlockEligible: hasResumeEvent || isResumeSyncLocked(),
            reason: shouldFetchInitialFull ? 'initial_load' : 'resume_sync',
          });
          nextPollDelayMs = fullResult.nextPollDelayMs;
        } else {
          const headResult = await fetchHeadState();

          if (headResult.kind === 'ok') {
            const isActivePollingPosture =
              !isUntimedAuthoritative ||
              untimedPollingMode === 'active';
            const safetyFullRefreshDue =
              isActivePollingPosture &&
              getLastAcceptedFullSyncAtMs() > 0 &&
              Date.now() - getLastAcceptedFullSyncAtMs() >= SAFETY_FULL_REFRESH_MS;
            const shouldTriggerFullFromHead =
              headResult.head.status === 'finished' ||
              headDiffersFromAcceptedFull(
                headResult.head,
                getLastAcceptedFullFingerprint(),
              ) ||
              safetyFullRefreshDue;

            if (shouldTriggerFullFromHead && !isGameStateRequestInFlight()) {
              const fullResult = await fetchFullGameState({
                unlockEligible: false,
                reason:
                  headResult.head.status === 'finished'
                    ? 'head_finished_confirmation'
                    : safetyFullRefreshDue
                      ? 'safety_full_refresh'
                      : 'head_detected_change',
              });
              nextPollDelayMs = fullResult.nextPollDelayMs;
            } else {
              nextPollDelayMs = getRecurringDelayMs(false);
            }
          } else if (headResult.kind === 'fallback_full') {
            if (!isGameStateRequestInFlight()) {
              const fullResult = await fetchFullGameState({
                unlockEligible: false,
                reason: headResult.reason,
              });
              nextPollDelayMs = fullResult.nextPollDelayMs;
            }
          } else {
            nextPollDelayMs = headResult.nextPollDelayMs;
          }
        }
      } catch (err: any) {
        console.error(`âŒ [useGameSession] Poll error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      } finally {
        isPolling = false;
      }

      if (mounted && !shouldStopPolling) {
        scheduleNextPoll(nextPollDelayMs);
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
    untimedResumeToken,
    postGamePollMs,
    finishGameStateRequest,
    hasAcceptedFullGameState,
    getLastAcceptedFullFingerprint,
    getLastAcceptedFullSyncAtMs,
    isGameStateRequestInFlight,
    applyHeadClockSnapshot,
  ]);
}
