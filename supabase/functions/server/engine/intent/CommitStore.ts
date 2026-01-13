/**
 * COMMIT STORE
 * 
 * Helpers for reading and writing commit/reveal records in game state.
 * 
 * Storage location: state.gameData.turnData.commitments
 * 
 * Structure:
 * {
 *   [commitKey]: {
 *     [playerId]: {
 *       commitHash?: string;
 *       committedAt?: number;
 *       revealPayload?: any;
 *       nonce?: string;
 *       revealedAt?: number;
 *     }
 *   }
 * }
 */

export interface CommitRecord {
  commitHash?: string;
  committedAt?: number;
  revealPayload?: any;
  nonce?: string;
  revealedAt?: number;
}

/**
 * Ensure commitments storage exists in state
 */
export function ensureCommitments(state: any): void {
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.turnData) {
    state.gameData.turnData = {};
  }
  if (!state.gameData.turnData.commitments) {
    state.gameData.turnData.commitments = {};
  }
}

/**
 * Get commit record for a player and key
 */
export function getCommitRecord(
  state: any,
  commitKey: string,
  playerId: string
): CommitRecord | null {
  ensureCommitments(state);
  const keyRecords = state.gameData.turnData.commitments[commitKey];
  if (!keyRecords) return null;
  return keyRecords[playerId] || null;
}

/**
 * Store a commit hash for a player
 */
export function storeCommit(
  state: any,
  commitKey: string,
  playerId: string,
  commitHash: string,
  nowMs: number
): void {
  ensureCommitments(state);
  
  if (!state.gameData.turnData.commitments[commitKey]) {
    state.gameData.turnData.commitments[commitKey] = {};
  }
  
  if (!state.gameData.turnData.commitments[commitKey][playerId]) {
    state.gameData.turnData.commitments[commitKey][playerId] = {};
  }
  
  state.gameData.turnData.commitments[commitKey][playerId].commitHash = commitHash;
  state.gameData.turnData.commitments[commitKey][playerId].committedAt = nowMs;
}

/**
 * Store a reveal payload for a player
 */
export function storeReveal(
  state: any,
  commitKey: string,
  playerId: string,
  payload: any,
  nonce: string,
  nowMs: number
): void {
  ensureCommitments(state);
  
  if (!state.gameData.turnData.commitments[commitKey]) {
    state.gameData.turnData.commitments[commitKey] = {};
  }
  
  if (!state.gameData.turnData.commitments[commitKey][playerId]) {
    state.gameData.turnData.commitments[commitKey][playerId] = {};
  }
  
  state.gameData.turnData.commitments[commitKey][playerId].revealPayload = payload;
  state.gameData.turnData.commitments[commitKey][playerId].nonce = nonce;
  state.gameData.turnData.commitments[commitKey][playerId].revealedAt = nowMs;
}

/**
 * Check if player has committed for a key
 */
export function hasCommitted(
  state: any,
  commitKey: string,
  playerId: string
): boolean {
  const record = getCommitRecord(state, commitKey, playerId);
  return record !== null && record.commitHash !== undefined;
}

/**
 * Check if player has revealed for a key
 */
export function hasRevealed(
  state: any,
  commitKey: string,
  playerId: string
): boolean {
  const record = getCommitRecord(state, commitKey, playerId);
  return record !== null && record.revealPayload !== undefined;
}

/**
 * Get all players who have revealed for a key
 */
export function getRevealedPlayers(
  state: any,
  commitKey: string
): string[] {
  ensureCommitments(state);
  const keyRecords = state.gameData.turnData.commitments[commitKey];
  if (!keyRecords) return [];
  
  return Object.keys(keyRecords).filter(playerId => {
    const record = keyRecords[playerId];
    return record && record.revealPayload !== undefined;
  });
}

/**
 * Check if all active players have revealed for a key
 */
export function allPlayersRevealed(
  state: any,
  commitKey: string
): boolean {
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  if (activePlayers.length === 0) return false;
  
  const revealedPlayers = getRevealedPlayers(state, commitKey);
  
  return activePlayers.every((p: any) => revealedPlayers.includes(p.id));
}
