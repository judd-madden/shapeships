import { useEffect, useRef } from 'react';
import type React from 'react';
import type { UntimedPollingMode } from './useUntimedPollingThrottle';

const ACTIVE_POLL_MS = 1200;
const UNTIMED_IDLE_POLL_MS = 12000;

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

  // Reset join state when gameId changes (allow re-gating for new games)
  useEffect(() => {
    setHasJoinedCurrentGame(false);
  }, [effectiveGameId, setHasJoinedCurrentGame]);

  useEffect(() => {
    // Guard: only attempt once per gameId
    if (effectiveGameId && attemptedJoinForGameRef.current.has(effectiveGameId)) return;

    // Guard: require gameId
    if (!effectiveGameId) return;

    // Mark as attempted immediately to prevent re-runs
    attemptedJoinForGameRef.current.add(effectiveGameId);

    // Fire-and-forget auto-join attempt
    const attemptJoin = async () => {
      try {
        console.log(`[useGameSession] Auto-join attempt for gameId=${effectiveGameId}, playerName=${effectivePlayerName}`);

        // Ensure session BEFORE join (remove race condition)
        const sessionData = await ensureSession(effectivePlayerName);
        console.log(`[useGameSession] Session ensured before join (sessionId: ${sessionData.sessionId})`);

        // Store sessionId for "me" detection in polled state
        setMySessionId(sessionData.sessionId);

        // Helper: Confirm authorization by attempting to fetch game-state
        const confirmAuthorized = async (): Promise<boolean> => {
          try {
            const confirmResponse = await authenticatedGet(`/game-state/${effectiveGameId}`);
            if (confirmResponse.ok) {
              return true;
            } else {
              const errorText = await confirmResponse.text();
              console.warn(`[useGameSession] Auth confirm failed: ${confirmResponse.status} ${errorText}`);
              return false;
            }
          } catch (err: any) {
            console.warn(`[useGameSession] Auth confirm error:`, err.message);
            return false;
          }
        };

        // Attempt join + confirm with retry loop
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          // Step 1: Attempt to join as player first
          console.log(`[useGameSession] Attempting join as player (attempt ${attempt}/${MAX_ATTEMPTS})...`);

          let response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
            playerName: effectivePlayerName,
            role: 'player', // Request player role explicitly
          });

          // Step 2: If game is full, fallback to spectator
          if (!response.ok) {
            const errorText = await response.text();

            // Check for benign "already joined" errors
            const isBenignError =
              errorText.toLowerCase().includes('already joined') ||
              errorText.toLowerCase().includes('already in game') ||
              response.status === 409; // Conflict (already joined)

            if (isBenignError) {
              console.log(`✅ [useGameSession] Already joined gameId=${effectiveGameId} (benign) - confirming via game-state...`);
              
              // Confirm authorization before unlocking poll
              const authorized = await confirmAuthorized();
              if (authorized) {
                console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
                setHasJoinedCurrentGame(true);
                return; // Success - exit
              } else {
                console.warn(`⚠️ [useGameSession] Auth confirm failed after benign join (attempt ${attempt}/${MAX_ATTEMPTS})`);
                if (attempt < MAX_ATTEMPTS) {
                  await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before retry
                  continue; // Retry
                } else {
                  console.error(`❌ [useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
                  return;
                }
              }
            }

            // Check for "game full" / "no slots" errors
            const isGameFull =
              errorText.toLowerCase().includes('game full') ||
              errorText.toLowerCase().includes('no slots') ||
              errorText.toLowerCase().includes('full') ||
              response.status === 403;

            if (isGameFull) {
              console.log(`⚠️ [useGameSession] Game full - falling back to spectator join...`);

              // Retry as spectator
              response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
                playerName: effectivePlayerName,
                role: 'spectator',
              });

              if (response.ok) {
                console.log(`✅ [useGameSession] Auto-join request ok (confirming via game-state)...`);
                
                // Confirm authorization before unlocking poll
                const authorized = await confirmAuthorized();
                if (authorized) {
                  console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
                  setHasJoinedCurrentGame(true);
                  return; // Success - exit
                } else {
                  console.warn(`⚠️ [useGameSession] Auth confirm failed after spectator join (attempt ${attempt}/${MAX_ATTEMPTS})`);
                  if (attempt < MAX_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before retry
                    continue; // Retry
                  } else {
                    console.error(`❌ [useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
                    return;
                  }
                }
              } else {
                const spectatorErrorText = await response.text();
                console.error(`❌ [useGameSession] Spectator join failed: ${response.status} ${spectatorErrorText}`);
                return;
              }
            }

            // Other real failure (e.g., "Player name is required")
            console.warn(`⚠️ [useGameSession] Auto-join failed for gameId=${effectiveGameId}: ${response.status} ${errorText}`);
            return;
          }

          // Join request succeeded - confirm authorization before unlocking poll
          console.log(`✅ [useGameSession] Auto-join request ok (confirming via game-state)...`);
          
          const authorized = await confirmAuthorized();
          if (authorized) {
            console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
            setHasJoinedCurrentGame(true);
            return; // Success - exit
          } else {
            console.warn(`⚠️ [useGameSession] Auth confirm failed after join (attempt ${attempt}/${MAX_ATTEMPTS})`);
            if (attempt < MAX_ATTEMPTS) {
              await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before retry
              continue; // Retry
            } else {
              console.error(`❌ [useGameSession] Auth confirm failed after ${MAX_ATTEMPTS} attempts - giving up`);
              return;
            }
          }
        }

      } catch (err: any) {
        // Network error or other exception
        console.error(`❌ [useGameSession] Auto-join error for gameId=${effectiveGameId}:`, err.message);
      }
    };

    // Execute join attempt (non-blocking)
    attemptJoin();
  }, [effectiveGameId, effectivePlayerName]);
}

export function usePollingEffect(args: {
  effectiveGameId: string | null;
  hasJoinedCurrentGame: boolean;

  authenticatedGet: (path: string, timeoutMs?: number) => Promise<Response>;

  applyAuthoritativeRawState: (s: any) => void;
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
    applyAuthoritativeRawState,
    setLoading,
    setError,
    isFinished,
    isUntimedAuthoritative,
    untimedPollingMode,
    untimedResumeToken,
    postGamePollMs,
  } = args;

  // Track last gameId we logged "Polling gated" for (prevents spam)
  const lastGatedGameIdRef = useRef<string | null>(null);
  const terminalStopGameIdRef = useRef<string | null>(null);
  const terminalStopReasonRef = useRef<'finished' | '403' | '404' | null>(null);
  const lastHandledResumeTokenRef = useRef<number | null>(null);

  useEffect(() => {
    terminalStopGameIdRef.current = effectiveGameId;
    terminalStopReasonRef.current = null;
    lastHandledResumeTokenRef.current = untimedResumeToken;
  }, [effectiveGameId]);

  useEffect(() => {
    // Don't poll without a usable gameId
    if (!effectiveGameId) {
      setLoading(false);
      setError('No gameId provided');
      return;
    }

    // Part C: Gate polling until join succeeds (avoid 403)
    // Use state variable hasJoinedCurrentGame to trigger re-renders
    if (!hasJoinedCurrentGame) {
      // Only log once per gameId while gated
      if (lastGatedGameIdRef.current !== effectiveGameId) {
        console.log(`[useGameSession] Polling gated for gameId=${effectiveGameId} (waiting for join to succeed)`);
        lastGatedGameIdRef.current = effectiveGameId;
      }
      setLoading(true);
      return;
    }

    // Clear gated ref when polling starts (allows re-logging if we gate again)
    lastGatedGameIdRef.current = null;

    const POSTGAME_POLL_MS = postGamePollMs ?? 5000; // default to 5s if not specified

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

    const shouldFetchImmediately =
      !isUntimedAuthoritative ||
      untimedPollingMode === 'active' ||
      hasResumeEvent;

    if (hasResumeEvent) {
      lastHandledResumeTokenRef.current = untimedResumeToken;
    }

    const poll = async () => {
      // Stop if flag is set
      if (shouldStopPolling || isPolling) {
        return;
      }

      isPolling = true;
      let nextPollDelayMs = initialDelayMs;

      try {
        // Fetch game state (authenticatedGet handles session automatically)
        const response = await authenticatedGet(`/game-state/${effectiveGameId}`);

        if (!response.ok) {
          const errorText = await response.text();

          // Stop polling on 403 Not authorized
          if (response.status === 403) {
            console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}: Not authorized (403) - stopping polling`);
            stopPolling('403');
            if (mounted) {
              setError(`Not authorized to view this game`);
              setLoading(false);
            }
            return;
          }

          // Stop polling on 404 Game not found
          if (response.status === 404 && errorText.toLowerCase().includes('game not found')) {
            console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}: Game not found (404) - stopping polling`);
            stopPolling('404');
            if (mounted) {
              setError(`Game not found: ${effectiveGameId}`);
              setLoading(false);
            }
            return;
          }

          throw new Error(`Failed to fetch game state: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const fetchedIsFinished =
          data?.status === 'finished' ||
          data?.gameData?.status === 'finished';
        nextPollDelayMs = getRecurringDelayMs(fetchedIsFinished);

        if (mounted) {
          applyAuthoritativeRawState(data);
          setLoading(false);
          setError(null);
        }

        if (fetchedIsFinished && nextPollDelayMs == null) {
          stopPolling('finished');
          return;
        }
      } catch (err: any) {
        console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      } finally {
        isPolling = false;
      }

      // Schedule next poll (only if not stopped)
      if (mounted && !shouldStopPolling) {
        scheduleNextPoll(nextPollDelayMs);
      }
    };

    // Start polling
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
  ]);
}
