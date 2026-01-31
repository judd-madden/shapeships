import { useEffect, useRef } from 'react';
import type React from 'react';

export function useAutoJoinEffect(args: {
  effectiveGameId: string;
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
  effectiveGameId: string;
  hasJoinedCurrentGame: boolean;

  authenticatedGet: (path: string, timeoutMs?: number) => Promise<Response>;

  setRawState: (s: any) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  
  isFinished: boolean;
  postGamePollMs?: number;
}) {
  const {
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    setRawState,
    setLoading,
    setError,
    isFinished,
    postGamePollMs,
  } = args;

  // Track last gameId we logged "Polling gated" for (prevents spam)
  const lastGatedGameIdRef = useRef<string | null>(null);

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

    const ACTIVE_POLL_MS = 1200; // ~1.2s interval during active game
    const POSTGAME_POLL_MS = postGamePollMs ?? 5000; // default to 5s if not specified
    
    // Determine polling interval based on game state
    const intervalMs = isFinished ? POSTGAME_POLL_MS : ACTIVE_POLL_MS;
    
    // If game finished and polling disabled (postGamePollMs <= 0), stop polling
    if (isFinished && intervalMs <= 0) {
      return;
    }

    let mounted = true;
    let pollTimer: NodeJS.Timeout | null = null;
    let shouldStopPolling = false;

    const poll = async () => {
      // Stop if flag is set
      if (shouldStopPolling) {
        return;
      }

      try {
        // Fetch game state (authenticatedGet handles session automatically)
        const response = await authenticatedGet(`/game-state/${effectiveGameId}`);

        if (!response.ok) {
          const errorText = await response.text();

          // Stop polling on 403 Not authorized
          if (response.status === 403) {
            console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}: Not authorized (403) - stopping polling`);
            shouldStopPolling = true;
            if (mounted) {
              setError(`Not authorized to view this game`);
              setLoading(false);
            }
            return;
          }

          // Stop polling on 404 Game not found
          if (response.status === 404 && errorText.toLowerCase().includes('game not found')) {
            console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}: Game not found (404) - stopping polling`);
            shouldStopPolling = true;
            if (mounted) {
              setError(`Game not found: ${effectiveGameId}`);
              setLoading(false);
            }
            return;
          }

          throw new Error(`Failed to fetch game state: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (mounted) {
          setRawState(data);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }

      // Schedule next poll (only if not stopped)
      if (mounted && !shouldStopPolling) {
        pollTimer = setTimeout(poll, intervalMs);
      }
    };

    // Start polling
    poll();

    return () => {
      mounted = false;
      shouldStopPolling = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [effectiveGameId, hasJoinedCurrentGame, isFinished, postGamePollMs]);
}