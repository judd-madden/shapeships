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
  | 'SPECIES_SUBMIT'
  | 'BUILD_COMMIT'
  | 'BUILD_REVEAL'
  | 'BUILD_SUBMIT'
  | 'BATTLE_COMMIT'
  | 'BATTLE_REVEAL'
  | 'DECLARE_READY'
  | 'ACTION'
  | 'SURRENDER'
  | 'DRAW_OFFER'
  | 'DRAW_ACCEPT';

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

export type BuildSubmitPayload = {
  builds: Array<{ shipDefId: string; count: number }>;
};

export type BattleRevealPayload = {
  declarations: any[]; // Placeholder for now
};

export type PowerActionId = string;

export type PowerChoiceId = string;

export type PowerActionPayload = {
  actionType: 'power';

  /**
   * Standard format: "{ShipDefId}#{powerIndex}"
   * Examples: "INT#0", "ANT#1"
   * Treat as opaque identifier everywhere except helper parsing below.
   */
  actionId: PowerActionId;

  /**
   * Ship instance performing the power.
   * Keep optional for now to avoid breaking scaffolding; later routes will always provide it.
   */
  sourceInstanceId?: string;

  /**
   * Semantic option id, never parsed for amounts.
   * Examples: "damage", "heal", "hold"
   */
  choiceId?: PowerChoiceId;

  /**
   * Reserved for later targeting (not used in Slice 2 yet).
   */
  targetInstanceId?: string;
};

export type ActionPayload =
  | { actionType: 'message'; content: string }
  | PowerActionPayload;

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
  PLAYER_NOT_ACTIVE: 'PLAYER_NOT_ACTIVE',
  
  // Turn validation
  BAD_TURN: 'BAD_TURN',
  WRONG_PHASE: 'WRONG_PHASE',
  PHASE_NOT_ALLOWED: 'PHASE_NOT_ALLOWED',
  
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
  CHARGE_ALREADY_USED_THIS_TURN: 'CHARGE_ALREADY_USED_THIS_TURN',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DEPRECATED_INTENT: 'DEPRECATED_INTENT',
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

// ============================================================================
// POWER ACTION ID HELPERS
// ============================================================================

/**
 * Format a power actionId from shipDefId and powerIndex.
 * 
 * @param shipDefId - Ship definition ID (e.g., "INT", "ANT")
 * @param powerIndex - Zero-based power index
 * @returns Formatted actionId (e.g., "INT#0", "ANT#1")
 */
export function formatPowerActionId(shipDefId: string, powerIndex: number): string {
  if (!Number.isInteger(powerIndex) || powerIndex < 0) {
    throw new Error(`Invalid powerIndex for power actionId: ${powerIndex}`);
  }
  if (typeof shipDefId !== 'string' || shipDefId.length === 0) {
    throw new Error(`Invalid shipDefId for power actionId: ${shipDefId}`);
  }
  return `${shipDefId}#${powerIndex}`;
}

/**
 * Parse a power actionId into shipDefId and powerIndex.
 * 
 * @param actionId - Power actionId to parse (e.g., "INT#0")
 * @returns Parsed components
 * @throws Error if actionId format is invalid
 */
export function parsePowerActionId(actionId: string): { shipDefId: string; powerIndex: number } {
  if (typeof actionId !== 'string') {
    throw new Error(`Invalid power actionId: ${String(actionId)}`);
  }

  const parts = actionId.split('#');
  if (parts.length !== 2) {
    throw new Error(`Invalid power actionId: ${actionId}`);
  }

  const shipDefId = parts[0];
  const idxStr = parts[1];

  if (!shipDefId || !idxStr) {
    throw new Error(`Invalid power actionId: ${actionId}`);
  }

  const powerIndex = Number(idxStr);
  if (!Number.isInteger(powerIndex) || powerIndex < 0) {
    throw new Error(`Invalid power actionId: ${actionId}`);
  }

  return { shipDefId, powerIndex };
}

/**
 * Validate a power actionId without throwing.
 * 
 * @param actionId - Power actionId to validate
 * @returns true if valid, false otherwise
 */
export function isValidPowerActionId(actionId: string): boolean {
  try {
    parsePowerActionId(actionId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Light validation for choiceId (non-empty string check only).
 * 
 * @param choiceId - Value to validate
 * @returns true if choiceId is a non-empty string
 */
export function isNonEmptyChoiceId(choiceId: unknown): choiceId is string {
  return typeof choiceId === 'string' && choiceId.length > 0;
}