/**
 * INTENT TYPES AND REJECTION CODES
 * 
 * Defines all intent types, payload shapes, and standard rejection codes
 * for the commit/reveal protocol.
 */

// ============================================================================
// INTENT TYPES
// ============================================================================

export type IntentType =
  | 'SPECIES_COMMIT'
  | 'SPECIES_REVEAL'
  | 'BUILD_COMMIT'
  | 'BUILD_REVEAL'
  | 'BATTLE_COMMIT'
  | 'BATTLE_REVEAL'
  | 'DECLARE_READY'
  | 'ACTION'
  | 'SURRENDER';

// ============================================================================
// BATTLE WINDOWS
// ============================================================================

export type BattleWindow = 'DECLARATION' | 'RESPONSE';

// ============================================================================
// PAYLOAD SHAPES
// ============================================================================

export type SpeciesRevealPayload = {
  species: 'human' | 'xenite' | 'centaur' | 'ancient';
};

export type BuildRevealPayload = {
  builds: Array<{ shipDefId: string; count?: number }>;
};

export type BattleRevealPayload = {
  declarations: any[]; // Placeholder for now
};

export type ActionPayload = {
  actionType: 'message';
  content: string;
};

// ============================================================================
// REJECTION CODES
// ============================================================================

export const RejectionCode = {
  // Game state errors
  NOT_IN_GAME: 'NOT_IN_GAME',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_FINISHED: 'GAME_FINISHED',
  
  // Player validation
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  SPECTATOR_RESTRICTED: 'SPECTATOR_RESTRICTED',
  
  // Turn validation
  BAD_TURN: 'BAD_TURN',
  WRONG_PHASE: 'WRONG_PHASE',
  
  // Commit/Reveal protocol
  DUPLICATE_COMMIT: 'DUPLICATE_COMMIT',
  MISSING_COMMIT: 'MISSING_COMMIT',
  HASH_MISMATCH: 'HASH_MISMATCH',
  ALREADY_REVEALED: 'ALREADY_REVEALED',
  
  // Payload validation
  BAD_PAYLOAD: 'BAD_PAYLOAD',
  INVALID_SPECIES: 'INVALID_SPECIES',
  INVALID_SHIP: 'INVALID_SHIP',
  INVALID_BUILD: 'INVALID_BUILD',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type RejectionCodeType = typeof RejectionCode[keyof typeof RejectionCode];

// ============================================================================
// COMMITMENT KEYS
// ============================================================================

/**
 * Commit keys are NOT globally unique by themselves.
 * CommitStore namespaces by (commitKey, playerId) within a game.
 * These keys represent logical "channels" per turn, not storage IDs.
 */

/**
 * Generate commitment key for species selection
 */
export function getSpeciesCommitKey(turnNumber: number): string {
  return `SPECIES_${turnNumber}`;
}

/**
 * Generate commitment key for build phase
 */
export function getBuildCommitKey(turnNumber: number): string {
  return `BUILD_${turnNumber}`;
}

/**
 * Generate commitment key for battle phase
 */
export function getBattleCommitKey(window: BattleWindow, turnNumber: number): string {
  return `BATTLE_${window}_${turnNumber}`;
}