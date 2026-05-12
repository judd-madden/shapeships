/**
 * SELECTORS
 * 
 * Pure getter functions for extracting data from raw game state.
 * These are dependency-light, rawState-safe helpers.
 */

function hasOwn(value: unknown, key: string): boolean {
  return value != null && Object.prototype.hasOwnProperty.call(Object(value), key);
}

/**
 * Extract phaseKey from state with fallback normalization
 */
export function getPhaseKey(state: any): string {
  if (state?.meta?.phaseKey) {
    return state.meta.phaseKey;
  }

  if (state?.phaseKey) {
    return state.phaseKey;
  }
  
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
  return (
    state?.meta?.turnNumber ??
    state?.gameData?.turnData?.turnNumber ??
    state?.gameData?.turnNumber ??
    state?.turnNumber ??
    1
  );
}

export function getGameStatus(state: any): string {
  return (
    (typeof state?.status === 'string' ? state.status : undefined) ??
    (typeof state?.gameData?.status === 'string' ? state.gameData.status : undefined) ??
    'unknown'
  );
}

export function isGameFinished(state: any): boolean {
  return (
    state?.status === 'finished' ||
    state?.gameData?.status === 'finished'
  );
}

export function getWinnerPlayerId(state: any): any {
  if (hasOwn(state?.result, 'winnerPlayerId')) {
    return state.result.winnerPlayerId ?? null;
  }

  if (hasOwn(state, 'winnerPlayerId')) {
    return state.winnerPlayerId ?? null;
  }

  return null;
}

export function getResultReason(state: any): any {
  if (hasOwn(state?.result, 'resultReason')) {
    return state.result.resultReason ?? null;
  }

  if (hasOwn(state, 'resultReason')) {
    return state.resultReason ?? null;
  }

  return null;
}

export function getPlayers(state: any): any[] {
  if (Array.isArray(state?.publicState?.players)) {
    return state.publicState.players;
  }

  return Array.isArray(state?.players) ? state.players : [];
}

export function getPlayerUsers(state: any): any[] {
  return getPlayers(state).filter((player: any) => player?.role === 'player');
}

export function getPlayerIdentityKey(player: any): string | null {
  return player?.id ?? player?.playerId ?? player?.sessionId ?? null;
}

export function findPlayerByIdentity(state: any, playerId: string | null): any | null {
  if (!playerId) {
    return null;
  }

  return getPlayers(state).find((player: any) =>
    player?.id === playerId ||
    player?.playerId === playerId ||
    player?.sessionId === playerId
  ) ?? null;
}

export function getPhaseReadiness(state: any): any[] {
  if (Array.isArray(state?.publicState?.phaseReadiness)) {
    return state.publicState.phaseReadiness;
  }

  if (Array.isArray(state?.phaseReadiness)) {
    return state.phaseReadiness;
  }

  if (Array.isArray(state?.gameData?.phaseReadiness)) {
    return state.gameData.phaseReadiness;
  }

  return [];
}

export function isPlayerReadyForPhase(state: any, playerId: string | null | undefined): boolean {
  if (!playerId) {
    return false;
  }

  return getPhaseReadiness(state).some((readiness: any) =>
    readiness?.playerId === playerId && readiness?.isReady === true
  );
}

export function getAvailableActions(state: any): any[] | null | undefined {
  if (hasOwn(state?.requester, 'availableActions')) {
    return state.requester.availableActions;
  }

  if (hasOwn(state, 'availableActions')) {
    return state.availableActions;
  }

  return undefined;
}

export function getBuildEconomyByPlayerId(state: any): Record<string, any> | undefined {
  if (hasOwn(state?.requester, 'buildEconomyByPlayerId')) {
    return state.requester.buildEconomyByPlayerId;
  }

  if (hasOwn(state, 'buildEconomyByPlayerId')) {
    return state.buildEconomyByPlayerId;
  }

  return undefined;
}

export function getBuildEconomyForPlayer(state: any, playerId: string | null | undefined): any | null {
  if (!playerId) {
    return null;
  }

  if (hasOwn(state?.requester, 'buildEconomy') && state?.requester?.playerId === playerId) {
    return state.requester.buildEconomy;
  }

  const buildEconomyByPlayerId = getBuildEconomyByPlayerId(state);
  return buildEconomyByPlayerId?.[playerId] ?? null;
}

export function getBonusLinesByPlayerId(state: any): Record<string, number> | undefined {
  if (hasOwn(state?.publicState, 'bonusLinesByPlayerId')) {
    return state.publicState.bonusLinesByPlayerId;
  }

  if (hasOwn(state, 'bonusLinesByPlayerId')) {
    return state.bonusLinesByPlayerId ?? undefined;
  }

  return undefined;
}

export function getBonusLinesOnEvenByPlayerId(state: any): Record<string, number> | undefined {
  if (hasOwn(state?.publicState, 'bonusLinesOnEvenByPlayerId')) {
    return state.publicState.bonusLinesOnEvenByPlayerId;
  }

  if (hasOwn(state, 'bonusLinesOnEvenByPlayerId')) {
    return state.bonusLinesOnEvenByPlayerId ?? undefined;
  }

  return undefined;
}

export function getSavedLinesByPlayerId(state: any): Record<string, number> | undefined {
  if (hasOwn(state?.publicState, 'savedLinesByPlayerId')) {
    return state.publicState.savedLinesByPlayerId;
  }

  if (hasOwn(state, 'savedLinesByPlayerId')) {
    return state.savedLinesByPlayerId ?? undefined;
  }

  return undefined;
}

export function getJoiningLinesByPlayerId(state: any): Record<string, number> | undefined {
  if (hasOwn(state?.publicState, 'joiningLinesByPlayerId')) {
    return state.publicState.joiningLinesByPlayerId;
  }

  if (hasOwn(state, 'joiningLinesByPlayerId')) {
    return state.joiningLinesByPlayerId ?? undefined;
  }

  return undefined;
}

export function getJoiningBonusLinesByPlayerId(state: any): Record<string, number> | undefined {
  if (hasOwn(state?.publicState, 'joiningBonusLinesByPlayerId')) {
    return state.publicState.joiningBonusLinesByPlayerId;
  }

  if (hasOwn(state, 'joiningBonusLinesByPlayerId')) {
    return state.joiningBonusLinesByPlayerId ?? undefined;
  }

  return undefined;
}

export function getBonusBreakdownByPlayerId(state: any): Record<string, unknown> | undefined {
  if (hasOwn(state?.publicState, 'bonusBreakdownByPlayerId')) {
    return state.publicState.bonusBreakdownByPlayerId;
  }

  if (hasOwn(state, 'bonusBreakdownByPlayerId')) {
    return state.bonusBreakdownByPlayerId ?? undefined;
  }

  return undefined;
}

export function getLastTurnNetByPlayerId(state: any): Record<string, unknown> | undefined {
  if (hasOwn(state?.publicState?.lastTurnStats, 'netByPlayerId')) {
    return state.publicState.lastTurnStats.netByPlayerId;
  }

  if (hasOwn(state?.gameData, 'lastTurnNetByPlayerId')) {
    return state.gameData.lastTurnNetByPlayerId ?? undefined;
  }

  return state?.lastTurnNetByPlayerId;
}

export function getLastTurnHealByPlayerId(state: any): Record<string, unknown> | undefined {
  if (hasOwn(state?.publicState?.lastTurnStats, 'healByPlayerId')) {
    return state.publicState.lastTurnStats.healByPlayerId;
  }

  if (hasOwn(state?.gameData, 'lastTurnHealByPlayerId')) {
    return state.gameData.lastTurnHealByPlayerId ?? undefined;
  }

  return state?.lastTurnHealByPlayerId;
}

export function getLastTurnDamageByPlayerId(state: any): Record<string, unknown> | undefined {
  if (hasOwn(state?.publicState?.lastTurnStats, 'damageByPlayerId')) {
    return state.publicState.lastTurnStats.damageByPlayerId;
  }

  if (hasOwn(state?.gameData, 'lastTurnDamageByPlayerId')) {
    return state.gameData.lastTurnDamageByPlayerId ?? undefined;
  }

  return state?.lastTurnDamageByPlayerId;
}

export function getLastTurnDamageDealtBreakdownByPlayerId(state: any): Record<string, unknown> | undefined {
  if (hasOwn(state?.requester, 'lastTurnDamageDealtBreakdownByPlayerId')) {
    return state.requester.lastTurnDamageDealtBreakdownByPlayerId;
  }

  if (hasOwn(state, 'lastTurnDamageDealtBreakdownByPlayerId')) {
    return state.lastTurnDamageDealtBreakdownByPlayerId ?? undefined;
  }

  return state?.publicState?.lastTurnDamageDealtBreakdownByPlayerId;
}

export function getLastTurnHealingReceivedBreakdownByPlayerId(state: any): Record<string, unknown> | undefined {
  if (hasOwn(state?.requester, 'lastTurnHealingReceivedBreakdownByPlayerId')) {
    return state.requester.lastTurnHealingReceivedBreakdownByPlayerId;
  }

  if (hasOwn(state, 'lastTurnHealingReceivedBreakdownByPlayerId')) {
    return state.lastTurnHealingReceivedBreakdownByPlayerId ?? undefined;
  }

  return state?.publicState?.lastTurnHealingReceivedBreakdownByPlayerId;
}

export function getKnoRerollPassIndex(state: any): any {
  if (hasOwn(state?.gameData?.turnData, 'knoRerollPassIndex')) {
    return state.gameData.turnData.knoRerollPassIndex;
  }

  return state?.turnData?.knoRerollPassIndex;
}

export function getPhaseHold(state: any): any {
  if (hasOwn(state?.gameData?.turnData, 'phaseHold')) {
    return state.gameData.turnData.phaseHold;
  }

  return state?.turnData?.phaseHold;
}

export function getChronoswarmRolls(state: any): unknown[] | undefined {
  const rolls = hasOwn(state?.publicState?.visibleDice, 'chronoswarmRolls')
    ? state.publicState.visibleDice.chronoswarmRolls
    : hasOwn(state?.gameData?.turnData, 'chronoswarmRolls')
    ? state.gameData.turnData.chronoswarmRolls
    : state?.turnData?.chronoswarmRolls;
  return Array.isArray(rolls) ? rolls : undefined;
}

export function getShipsByPlayerId(state: any): Record<string, any[]> {
  if (hasOwn(state?.publicState, 'ships') && state.publicState.ships != null) {
    return state.publicState.ships;
  }

  if (hasOwn(state?.publicState, 'fleets') && state.publicState.fleets != null) {
    return state.publicState.fleets;
  }

  if (hasOwn(state?.gameData, 'ships') && state.gameData.ships != null) {
    return state.gameData.ships;
  }

  if (hasOwn(state, 'ships') && state.ships != null) {
    return state.ships;
  }

  return {};
}

export function getShipsForPlayer(state: any, playerId: string | null | undefined): any[] {
  if (!playerId) {
    return [];
  }

  const shipsByPlayerId = getShipsByPlayerId(state);
  return Array.isArray(shipsByPlayerId[playerId]) ? shipsByPlayerId[playerId] : [];
}

export function getVoidShipsByPlayerId(state: any): Record<string, any[]> {
  if (hasOwn(state?.publicState, 'voidShipsByPlayerId')) {
    return state.publicState.voidShipsByPlayerId ?? {};
  }

  if (hasOwn(state?.gameData, 'voidShipsByPlayerId')) {
    return state.gameData.voidShipsByPlayerId ?? {};
  }

  return state?.voidShipsByPlayerId ?? {};
}

export function getFrigateTriggerByInstanceId(state: any): Record<string, unknown> {
  if (hasOwn(state?.gameData?.powerMemory, 'frigateTriggerByInstanceId')) {
    return state.gameData.powerMemory.frigateTriggerByInstanceId ?? {};
  }

  return state?.powerMemory?.frigateTriggerByInstanceId ?? {};
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
  const gameDataHasClock = hasOwn(state?.gameData, 'clock');
  const clock = gameDataHasClock ? state?.gameData?.clock : state?.clock;
  
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
