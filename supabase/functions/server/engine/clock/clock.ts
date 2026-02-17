/**
 * SERVER AUTHORITATIVE CHESS CLOCK
 * 
 * Rules:
 * - Base time: 10 minutes (600,000 ms)
 * - Increment: 15 seconds per turn (15,000 ms)
 * - Clocks do NOT run until both players have confirmed species AND turnNumber >= 1
 * - Time decrements only when player is NOT ready
 * - Increment is applied ONCE per player per turn (not per ready press)
 * - Server is the sole source of truth for time
 */

// ============================================================================
// CLOCK STATE INTERFACE
// ============================================================================

export interface ClockState {
  timeControl: {
    baseMs: number;       // default 600_000 (10 minutes)
    incrementMs: number;  // default 15_000 (15 seconds)
  };
  remainingMsByPlayerId: Record<string, number>;
  lastUpdateAtMs: number;
  incrementAppliedTurnByPlayerId: Record<string, number>;
}

// ============================================================================
// CLOCK INITIALIZATION
// ============================================================================

/**
 * Initialize clock state for a new game
 * Clocks are created but do not start accruing until conditions are met
 * 
 * @param gameData - The game state to initialize clocks for
 * @returns Updated game state with initialized clocks
 */
export function initializeClocks(gameData: any): any {
  // If clock already exists, don't overwrite
  if (gameData?.gameData?.clock) {
    return gameData;
  }
  
  const clock: ClockState = {
    timeControl: {
      baseMs: 600_000,      // 10 minutes
      incrementMs: 15_000,  // 15 seconds
    },
    remainingMsByPlayerId: {},
    lastUpdateAtMs: Date.now(),
    incrementAppliedTurnByPlayerId: {},
  };
  
  // Initialize clock for the creating player
  const players = gameData?.players ?? [];
  for (const player of players) {
    if (player.role === 'player') {
      clock.remainingMsByPlayerId[player.id] = clock.timeControl.baseMs;
    }
  }
  
  return {
    ...gameData,
    gameData: {
      ...gameData.gameData,
      clock,
    },
  };
}

/**
 * Ensure player has a clock entry when joining
 * Does NOT overwrite existing entries
 */
export function ensurePlayerClock(
  clock: ClockState,
  playerId: string
): ClockState {
  // If player already has a clock entry, don't overwrite
  if (clock.remainingMsByPlayerId[playerId] !== undefined) {
    return clock;
  }
  
  // Initialize new player with base time
  return {
    ...clock,
    remainingMsByPlayerId: {
      ...clock.remainingMsByPlayerId,
      [playerId]: clock.timeControl.baseMs,
    },
  };
}

// ============================================================================
// CLOCK LIVE CONDITION
// ============================================================================

/**
 * Determine if clocks should be actively accruing
 * 
 * Returns true ONLY if:
 * - Both players have confirmed/revealed species
 * - turnNumber >= 1
 * 
 * If false, clocks pause (but lastUpdateAtMs is updated to prevent back-charging)
 */
export function clocksAreLive(state: any): boolean {
  // Extract players
  const players = state?.players ?? [];
  const playerUsers = players.filter((p: any) => p.role === 'player');
  
  // Need exactly 2 players
  if (playerUsers.length !== 2) {
    return false;
  }
  
  // Check turn number
  const turnNumber = state?.turnNumber ?? state?.gameData?.turnNumber ?? 0;
  if (turnNumber < 1) {
    return false;
  }
  
  // Check if both players have confirmed species
  // Species is revealed when faction/species field is set (not null)
  const bothSpeciesConfirmed = playerUsers.every((p: any) => {
    const species = p.faction ?? p.species;
    return species !== null && species !== undefined;
  });
  
  if (!bothSpeciesConfirmed) {
    return false;
  }
  
  return true;
}

// ============================================================================
// CLOCK ACCRUAL
// ============================================================================

/**
 * Accrue clocks based on elapsed time
 * 
 * Rules:
 * - If clocksAreLive is false, update lastUpdateAtMs but don't decrement time
 * - Time decrements only for players who are NOT ready
 * - Clamp remaining time at >= 0
 * - Pure function (does not mutate state)
 */
export function accrueClocks(state: any, nowMs: number): any {
  // If game is already finished, do not accrue or modify clocks
  if (state?.status === 'finished') {
    return state;
  }
  
  // If no clock exists, return state unchanged
  if (!state?.gameData?.clock) {
    return state;
  }
  
  const clock = state.gameData.clock;
  
  // Initialize lastUpdateAtMs lazily to prevent phantom elapsed time
  const lastUpdateAtMs =
    typeof clock.lastUpdateAtMs === 'number'
      ? clock.lastUpdateAtMs
      : nowMs;
  
  // Compute elapsed time since last update
  const elapsedMs = Math.max(0, nowMs - lastUpdateAtMs);
  
  // Check if clocks are live
  const live = clocksAreLive(state);
  
  // If not live, just update timestamp and return
  if (!live) {
    return {
      ...state,
      gameData: {
        ...state.gameData,
        clock: {
          ...clock,
          lastUpdateAtMs: nowMs,
        },
      },
    };
  }
  
  // Get phase readiness data
  const phaseReadiness = state?.gameData?.phaseReadiness ?? [];
  
  // Build map of who is ready
  const isReadyMap: Record<string, boolean> = {};
  for (const r of phaseReadiness) {
    if (r?.playerId && r?.isReady === true) {
      isReadyMap[r.playerId] = true;
    }
  }
  
  // Decrement time for players who exist and are NOT ready
  const players = state?.players ?? [];
  const updatedRemainingMs: Record<string, number> = { ...clock.remainingMsByPlayerId };
  
  for (const player of players) {
    const playerId = player.id;
    
    // Skip if player doesn't have a clock entry
    if (updatedRemainingMs[playerId] === undefined) {
      continue;
    }
    
    // If player is ready, don't decrement
    if (isReadyMap[playerId]) {
      continue;
    }
    
    // Decrement time, clamped at 0
    const currentTime = updatedRemainingMs[playerId];
    const newTime = Math.max(0, currentTime - elapsedMs);
    updatedRemainingMs[playerId] = newTime;
  }
  
  // ============================================================================
  // TIMEOUT LOSS: If any player's remaining time reaches 0, they lose immediately
  // ============================================================================
  const activePlayers = (state?.players ?? []).filter((p: any) => p?.role === 'player');
  const timedOut = activePlayers.filter((p: any) => {
    const ms = updatedRemainingMs[p.id];
    return typeof ms === 'number' && ms <= 0;
  });

  // If any timeout occurred, end the game immediately (no further accrual)
  if (timedOut.length > 0) {
    const atMs = nowMs;

    // Case A: Single timeout -> that player loses
    if (timedOut.length === 1) {
      const loserId = timedOut[0].id;
      const winner = activePlayers.find((p: any) => p.id !== loserId);
      const winnerId = winner?.id ?? null;

      const nextClock = {
        ...clock,
        remainingMsByPlayerId: updatedRemainingMs,
        lastUpdateAtMs: nowMs,
      };

      return {
        ...state,
        status: 'finished',
        winnerPlayerId: winnerId,
        result: 'win',
        resultReason: 'timeout',
        endReason: 'timeout',
        timeoutLoserId: loserId,
        gameData: {
          ...state.gameData,
          clock: nextClock,
        },
        actions: [
          ...(state.actions ?? []),
          {
            type: 'system',
            actionType: 'system',
            playerId: 'system',
            playerName: 'System',
            content: `Game ended by timeout. Loser: ${loserId}${winnerId ? `, Winner: ${winnerId}` : ''}`,
            timestamp: new Date(atMs).toISOString(),
          },
        ],
      };
    }

    // Case B: Both players timeout simultaneously -> draw
    const nextClock = {
      ...clock,
      remainingMsByPlayerId: updatedRemainingMs,
      lastUpdateAtMs: nowMs,
    };

    return {
      ...state,
      status: 'finished',
      winnerPlayerId: null,
      result: 'draw',
      resultReason: 'timeout_draw',
      endReason: 'timeout_draw',
      timeoutLoserId: null,
      gameData: {
        ...state.gameData,
        clock: nextClock,
      },
      actions: [
        ...(state.actions ?? []),
        {
          type: 'system',
          actionType: 'system',
          playerId: 'system',
          playerName: 'System',
          content: `Game ended by simultaneous timeout (draw).`,
          timestamp: new Date(atMs).toISOString(),
        },
      ],
    };
  }
  
  // Return updated state
  return {
    ...state,
    gameData: {
      ...state.gameData,
      clock: {
        ...clock,
        remainingMsByPlayerId: updatedRemainingMs,
        lastUpdateAtMs: nowMs,
      },
    },
  };
}

// ============================================================================
// INCREMENT APPLICATION
// ============================================================================

/**
 * Apply increment when turn advances
 * 
 * Rules:
 * - Called when turn advances from N to N+1
 * - Increment is applied ONCE per player per turn
 * - Tracked by incrementAppliedTurnByPlayerId
 */
export function applyIncrementForTurn(state: any, newTurnNumber: number): any {
  // If no clock exists, return state unchanged
  if (!state?.gameData?.clock) {
    return state;
  }
  
  const clock = state.gameData.clock;
  const players = state?.players ?? [];
  
  const updatedRemainingMs = { ...clock.remainingMsByPlayerId };
  const updatedIncrementApplied = { ...clock.incrementAppliedTurnByPlayerId };
  
  for (const player of players) {
    const playerId = player.id;
    
    // Skip if player doesn't have a clock entry
    if (updatedRemainingMs[playerId] === undefined) {
      continue;
    }
    
    // Check if increment already applied for this turn
    if (updatedIncrementApplied[playerId] === newTurnNumber) {
      continue;
    }
    
    // Apply increment
    updatedRemainingMs[playerId] += clock.timeControl.incrementMs;
    updatedIncrementApplied[playerId] = newTurnNumber;
  }
  
  return {
    ...state,
    gameData: {
      ...state.gameData,
      clock: {
        ...clock,
        remainingMsByPlayerId: updatedRemainingMs,
        incrementAppliedTurnByPlayerId: updatedIncrementApplied,
      },
    },
  };
}