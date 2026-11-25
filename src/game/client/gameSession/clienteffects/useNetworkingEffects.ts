import { useEffect, useRef } from 'react';
import { isAccountAuthorityError } from '../../account/preferenceSync';
import { isNameAssignmentRefusal, readGameErrorCode } from '../accountSessionWiring';
import type React from 'react';
import type { UntimedPollingMode } from './useUntimedPollingThrottle';
import type { ShipEffectSyncObservation } from './useShipEffectPresentation';
import type {
  AcceptedFullStateFingerprint,
  AuthoritativeStateApplyMeta,
  GameStateClockSnapshot,
  GameStateHeadResponse,
  GameStateRequestMeta,
} from '../types';

const ACTIVE_POLL_MS = 2000;
export const LIVE_GAME_STATE_REQUEST_TIMEOUT_MS = 8000;
const UNTIMED_IDLE_POLL_MS = 12000;
const SAFETY_FULL_REFRESH_MS = 15000;
const POLL_JITTER_MAX_MS = 250;
const FAILURE_BACKOFF_MS = [2500, 5000, 10000, 20000, 30000] as const;

export type GameLoadFailure = 'notFound' | 'sessionExpired' | 'loadFailed';

export function isGameEntryError(code: unknown): boolean {
  return typeof code === 'string' && (isNameAssignmentRefusal(code) || (
    isAccountAuthorityError(code) || code.startsWith('ACCOUNT_TOKEN_') || code === 'GAME_SESSION_INVALID'
  ));
}

/** Inspect clones so callers can still read the original failure response. */
export async function classifyGameLoadFailure(response?: Response): Promise<GameLoadFailure | null> {
  if (!response) return 'loadFailed';
  if (isGameEntryError(await readGameErrorCode(response))) return null;
  if (response.status === 401) {
    const { isExpiredSessionResponse } = await import('../../../../utils/sessionManager');
    if (await isExpiredSessionResponse(response)) return 'sessionExpired';
    const body = await response.clone().json().catch(() => null);
    if (body?.message === 'Missing X-Session-Token header. Session token required for this endpoint.') {
      return 'sessionExpired';
    }
  }
  if (response.status === 404 && (await response.clone().text()).toLowerCase().includes('game not found')) {
    return 'notFound';
  }
  return 'loadFailed';
}

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
  authenticatedPost: (path: string, body: any, timeoutMs?: number) => Promise<Response>;
  authenticatedGet: (path: string, timeoutMs?: number) => Promise<Response>;
  setMySessionId: (id: string) => void;
  setHasJoinedCurrentGame: (v: boolean) => void;
  loadAttempt?: number;
  canAttemptLoad?: () => boolean;
  onLoadFailure?: (failure: GameLoadFailure) => void;
}) {
  const {
    effectiveGameId, effectivePlayerName, attemptedJoinForGameRef,
    ensureSession, authenticatedPost, authenticatedGet, setMySessionId,
    setHasJoinedCurrentGame, loadAttempt = 0, canAttemptLoad, onLoadFailure,
  } = args;

  useEffect(() => {
    setHasJoinedCurrentGame(false);
  }, [effectiveGameId, loadAttempt, setHasJoinedCurrentGame]);

  useEffect(() => {
    if (!effectiveGameId || !effectivePlayerName || canAttemptLoad?.() === false) return;
    if (attemptedJoinForGameRef.current.has(effectiveGameId)) return;
    attemptedJoinForGameRef.current.add(effectiveGameId);
    let cancelled = false;
    const isCurrent = () => !cancelled && canAttemptLoad?.() !== false;
    const fail = (failure: GameLoadFailure) => { if (isCurrent()) onLoadFailure?.(failure); };

    const attemptJoin = async () => {
      try {
        if (import.meta.env.DEV) console.log(`[useGameSession] Auto-join attempt for gameId=${effectiveGameId}, playerName=${effectivePlayerName}`);
        const sessionData = await ensureSession(effectivePlayerName);
        if (!isCurrent()) return;
        if (import.meta.env.DEV) console.log(`[useGameSession] Session ensured before join (sessionId: ${sessionData.sessionId})`);
        setMySessionId(sessionData.sessionId);

        const response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
          playerName: effectivePlayerName, role: 'player',
        }, LIVE_GAME_STATE_REQUEST_TIMEOUT_MS);
        if (!isCurrent()) return;
        if (!response.ok) {
          if (isGameEntryError(await readGameErrorCode(response))) return;
          const errorText = await response.clone().text();
          if (!isCurrent()) return;
          const alreadyJoined = response.status === 409 && (
            errorText.toLowerCase().includes('already joined') ||
            errorText.toLowerCase().includes('already in game')
          );
          if (!alreadyJoined) {
            console.warn(`[useGameSession] Auto-join failed for gameId=${effectiveGameId}: ${response.status} ${errorText}`);
            const failure = await classifyGameLoadFailure(response);
            if (failure) fail(failure);
            return;
          }
        }
        if (import.meta.env.DEV) console.log('[useGameSession] Auto-join request ok (confirming via game-state)...');

        // Confirmation retries are reads only. Never replay the join mutation here.
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (!isCurrent()) return;
          try {
            const confirm = await authenticatedGet(`/game-state/${effectiveGameId}`, LIVE_GAME_STATE_REQUEST_TIMEOUT_MS);
            if (!isCurrent()) return;
            if (confirm.ok) {
              if (import.meta.env.DEV) console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
              setHasJoinedCurrentGame(true);
              return;
            }
            const failure = await classifyGameLoadFailure(confirm);
            if (!isCurrent() || !failure) return;
            console.warn(`[useGameSession] Auth confirm failed: ${confirm.status} ${await confirm.text()}`);
            if (failure !== 'loadFailed' || confirm.status < 500) {
              fail(failure);
              return;
            }
          } catch (error: any) {
            if (!isCurrent() || error?.code === 'SESSION_CHANGED' || isGameEntryError(error?.code)) return;
            console.warn('[useGameSession] Auth confirm error:', error?.message ?? error);
          }
          if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 500));
        }
        console.error(`[useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
        fail('loadFailed');
      } catch (error: any) {
        if (!isCurrent() || error?.code === 'SESSION_CHANGED' || isGameEntryError(error?.code)) return;
        console.error(`[useGameSession] Auto-join error for gameId=${effectiveGameId}:`, error?.message ?? error);
        fail('loadFailed');
      }
    };
    void attemptJoin();
    return () => {
      cancelled = true;
      attemptedJoinForGameRef.current.delete(effectiveGameId);
    };
  }, [effectiveGameId, effectivePlayerName, loadAttempt]);
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
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;

  isFinished: boolean;
  isUntimedAuthoritative: boolean;
  untimedPollingMode: UntimedPollingMode;
  foregroundResumeToken: number;
  postGamePollMs?: number;
  observeShipEffectSync?: (event: ShipEffectSyncObservation) => void;
  loadAttempt?: number;
  canPoll?: () => boolean;
  onLoadFailure?: (failure: GameLoadFailure) => void;
  onInitialLoadSuccess?: () => void;
  isValidInitialState?: (payload: unknown) => boolean;
}) {
  const shipEffectObserverRef = useRef(args.observeShipEffectSync);
  shipEffectObserverRef.current = args.observeShipEffectSync;
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
    setLoading,
    setError,
    isFinished,
    isUntimedAuthoritative,
    untimedPollingMode,
    foregroundResumeToken,
    postGamePollMs,
    loadAttempt,
    canPoll,
    onLoadFailure,
    onInitialLoadSuccess,
    isValidInitialState,
  } = args;

  const lastGatedGameIdRef = useRef<string | null>(null);
  const terminalStopGameIdRef = useRef<string | null>(null);
  const terminalStopReasonRef = useRef<'finished' | '403' | '404' | 'load_failure' | null>(null);
  const lastHandledForegroundResumeTokenRef = useRef<number | null>(null);

  useEffect(() => {
    terminalStopGameIdRef.current = effectiveGameId;
    terminalStopReasonRef.current = null;
  }, [effectiveGameId, foregroundResumeToken, loadAttempt]);

  useEffect(() => {
    lastHandledForegroundResumeTokenRef.current = foregroundResumeToken;
  }, [effectiveGameId]);

  useEffect(() => {
    if (canPoll?.() === false) return;
    if (!effectiveGameId) {
      setLoading(false);
      setError('No gameId provided');
      return;
    }

    if (!hasJoinedCurrentGame) {
      if (lastGatedGameIdRef.current !== effectiveGameId) {
        if (import.meta.env.DEV) console.log(`[useGameSession] Polling gated for gameId=${effectiveGameId} (waiting for join to succeed)`);
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
    let receivedHttpResponseThisCycle = false;
    const observePresentation = (event: ShipEffectSyncObservation) => {
      if (!mounted) return;
      try { shipEffectObserverRef.current?.(event); } catch { /* Observation cannot affect polling. */ }
    };
    const observeHttpResponse = () => {
      receivedHttpResponseThisCycle = true;
      observePresentation('http_response');
    };

    const clearPollTimer = () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const stopPolling = (reason: 'finished' | '403' | '404' | 'load_failure') => {
      terminalStopGameIdRef.current = effectiveGameId;
      terminalStopReasonRef.current = reason;
      shouldStopPolling = true;
      clearPollTimer();
    };

    const scheduleNextPoll = (delayMs: number | null): number | null => {
      clearPollTimer();

      if (!mounted || shouldStopPolling || canPoll?.() === false || delayMs == null) {
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
      if (!mounted || canPoll?.() === false) return { kind: 'stopped' };
      if (onLoadFailure) {
        const failure = await classifyGameLoadFailure(response);
        if (!mounted || canPoll?.() === false) return { kind: 'stopped' };
        if (!hasAcceptedFullGameState() || failure === 'sessionExpired') {
          stopPolling('load_failure');
          if (failure) onLoadFailure(failure);
          setLoading(false);
          console.warn(`[useGameSession] Game load stopped: ${response.status}`);
          return { kind: 'stopped' };
        }
      }
      const retryAfterMs = response.status === 429
        ? parseRetryAfterMs(response.headers.get('Retry-After'))
        : null;
      const errorText = await response.text();

      if (response.status === 403) {
        console.error(`[useGameSession] Poll error gameId=${effectiveGameId}: Not authorized (403) - stopping polling`);
        stopPolling('403');
        if (mounted) {
          setError('Not authorized to view this game');
          setLoading(false);
        }
        return { kind: 'stopped' };
      }

      if (response.status === 404 && errorText.toLowerCase().includes('game not found')) {
        console.error(`[useGameSession] Poll error gameId=${effectiveGameId}: Game not found (404) - stopping polling`);
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
        const response = await authenticatedGet(
          `/game-state/${effectiveGameId}`,
          LIVE_GAME_STATE_REQUEST_TIMEOUT_MS,
        );
        if (!mounted || canPoll?.() === false) return { kind: 'stopped' };
        observeHttpResponse();

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
        if (!mounted || canPoll?.() === false) return { kind: 'stopped' };
        const initialLoad = !hasAcceptedFullGameState();
        if (initialLoad && isValidInitialState && !isValidInitialState(data)) {
          throw new Error('Invalid initial game state');
        }
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
          if (import.meta.env.DEV) console.log(
            `[useGameSession] Poll ignored stale /game-state response requestSeq=${requestMeta.requestSeq}`
          );
          return { kind: 'success', nextPollDelayMs };
        }

        observePresentation('accepted_full');
        if (initialLoad) onInitialLoadSuccess?.();
        nextPollDelayMs = getRecurringDelayMs(fetchedIsFinished);
        if (mounted) {
          setLoading(false);
          setError(null);
        }
        return { kind: 'success', nextPollDelayMs };
      } catch (err: any) {
        if (!mounted || canPoll?.() === false) return { kind: 'stopped' };
        console.error(
          `[useGameSession] Poll full-sync error gameId=${effectiveGameId}${options?.reason ? ` (${options.reason})` : ''}:`,
          err,
        );
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
        if (!hasAcceptedFullGameState() && onLoadFailure) {
          stopPolling('load_failure');
          if (!isGameEntryError(err?.code) && err?.code !== 'SESSION_CHANGED') onLoadFailure('loadFailed');
          return { kind: 'stopped' };
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
        const response = await authenticatedGet(
          `/game-state-head/${effectiveGameId}`,
          LIVE_GAME_STATE_REQUEST_TIMEOUT_MS,
        );
        if (!mounted || canPoll?.() === false) return { kind: 'stopped' };
        observeHttpResponse();

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
        }

        if (mounted) {
          setLoading(false);
          setError(null);
        }

        return { kind: 'ok', head: data };
      } catch (err: any) {
        console.error(`[useGameSession] Poll head error gameId=${effectiveGameId}:`, err);
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
      if (!mounted || shouldStopPolling || canPoll?.() === false || isPolling) {
        return;
      }

      isPolling = true;
      receivedHttpResponseThisCycle = false;
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
            if (!headFinished && !headDiffers) observePresentation('unchanged_head');

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
        console.error(`[useGameSession] Poll error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
        cycleOutcome = 'failure';
      } finally {
        isPolling = false;
      }

      if (cycleOutcome === 'failure' && !receivedHttpResponseThisCycle) {
        observePresentation('transport_failure');
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
    loadAttempt,
    canPoll,
  ]);
}
