/**
 * SELECTORS
 * 
 * Pure getter functions for extracting data from raw game state.
 * These are dependency-light, rawState-safe helpers.
 */

/**
 * Extract phaseKey from state with fallback normalization
 */
export function getPhaseKey(state: any): string {
  // Prefer server-provided phaseKey
  if (state?.phaseKey) {
    return state.phaseKey;
  }
  
  // Fallback: extract from gameData
  if (state?.gameData?.phaseKey) {
    return state.gameData.phaseKey;
  }
  
  // Fallback: construct from major/sub fields
  const major =
    state?.gameData?.currentPhase ??
    state?.currentPhase ??
    state?.turnData?.currentMajorPhase;
  
  const sub =
    state?.gameData?.currentSubPhase ??
    state?.currentSubPhase ??
    state?.turnData?.currentSubPhase;
  
  if (major && sub) {
    return `${major}.${sub}`;
  }
  
  return 'unknown';
}

/**
 * Extract turn number from state with fallback
 */
export function getTurnNumber(state: any): number {
  // Authoritative source is gameData.turnData.turnNumber (server truth).
  // Fall back only if missing.
  return (
    state?.gameData?.turnData?.turnNumber ??
    state?.gameData?.turnNumber ??
    state?.turnNumber ??
    1
  );
}

/**
 * Format clock time as MM:SS
 */
export function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds as MM:SS for clock display
 */
export function formatClockMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return formatClock(totalSeconds);
}

/**
 * Extract clock data from server state
 */
export function getClockData(state: any): {
  remainingMsByPlayerId: Record<string, number>;
  clocksAreLive: boolean;
  serverNowMs: number;
} {
  // Try primary location for clock data
  const clock = state?.gameData?.clock;
  
  if (!clock) {
    return {
      remainingMsByPlayerId: {},
      clocksAreLive: false,
      serverNowMs: Date.now(),
    };
  }
  
  const remainingMsByPlayerId = clock.remainingMsByPlayerId ?? {};
  
  // Determine if clocks are live:
  // - If server explicitly provides clocksAreLive boolean, use it
  // - Otherwise, treat as live ONLY if:
  //   - Clock has at least one player time
  //   - Turn number >= 1 (not setup)
  //   - Phase is NOT setup.species_selection
  let clocksAreLive: boolean;
  
  if (clock.clocksAreLive !== undefined) {
    clocksAreLive = clock.clocksAreLive;
  } else {
    // Extract phaseKey and turnNumber using same legacy fallbacks as elsewhere
    const major = state?.gameData?.currentPhase ?? state?.currentPhase ?? 'setup';
    const sub = state?.gameData?.currentSubPhase ?? state?.currentSubPhase ?? 'species_selection';
    const phaseKey = `${major}.${sub}`;
    const turnNumber = state?.gameData?.turnNumber ?? state?.turnNumber ?? 0;
    
    clocksAreLive = 
      Object.keys(remainingMsByPlayerId).length > 0 &&
      turnNumber >= 1 &&
      phaseKey !== 'setup.species_selection';
  }
  
  // Anchor to server's last update timestamp, fallback to serverNowMs or Date.now()
  const serverNowMs = 
    clock.lastUpdateAtMs ?? 
    clock.serverNowMs ?? 
    Date.now();
  
  return {
    remainingMsByPlayerId,
    clocksAreLive,
    serverNowMs,
  };
}