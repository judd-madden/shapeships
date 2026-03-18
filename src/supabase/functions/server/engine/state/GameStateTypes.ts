/**
 * GAME STATE TYPES
 * 
 * Core type definitions for game state entities.
 * Ship instances replace placeholder ship objects.
 */

/**
 * Ship Instance - replaces placeholder ship objects
 * 
 * Ships are stored as instances with unique IDs, referencing
 * canonical ship definitions by shipDefId.
 */
export type ShipInstance = {
  /** Unique instance identifier (crypto.randomUUID()) */
  instanceId: string;
  
  /** Canonical ship definition ID (e.g., "DEF", "TAC", "CAR") */
  shipDefId: string;
  
  /** Current charge count (for charge-based ships) */
  chargesCurrent?: number;
  
  /** Turn number when ship was created */
  createdTurn?: number;
};

/**
 * Player state in the game
 */
export type PlayerState = {
  /** Unique player identifier */
  id: string;
  
  /** Player role */
  role: 'player' | 'spectator';
  
  /** Player display name */
  name?: string;
  
  /** Current health */
  health: number;
  
  /** Current lines (build resources) */
  lines: number;

  /** Stored joining lines (Centaur-only saved upgrade resource) */
  joiningLines: number;
  
  /** Species selection */
  species?: string | null;
};

/**
 * Game data container
 */
export type GameData = {
  /** Current turn number */
  turnNumber: number;
  
  /** Dice roll result */
  diceRoll?: number;
  
  /** Ship fleets indexed by player ID */
  ships?: Record<string, ShipInstance[]>;
  
  /** Turn-specific data */
  turnData?: {
    diceRoll?: number;
    linesDistributed?: boolean;
    
    /** Canonical dice roll (1-6, rolled once per turn) */
    baseDiceRoll?: number;
    /** Effective dice roll after modifiers (1-6) */
    effectiveDiceRoll?: number;
    /** Effective dice roll as read by each player (post-modifiers, per-player) */
    effectiveDiceRollByPlayerId?: Record<string, number>;
    /** Optional: source ship that caused a dice override for a player (e.g., 'LEV') */
    diceOverrideSourceByPlayerId?: Record<string, string>;
    /** Flag: dice has been rolled this turn */
    diceRolled?: boolean;
    /** Flag: dice modifiers have been finalized */
    diceFinalized?: boolean;
    
    /** Track once-per-turn charge power usage by ship instance */
    chargePowerUsedByInstanceId?: Record<string, number>;

    /**
     * Authoritative count of ships that materially entered each player's fleet
     * during the current build phase. Used by end-of-build powers such as Dreadnought.
     */
    shipsMadeThisBuildPhaseByPlayerId?: Record<string, number>;

    /**
     * Idempotency flag for server-only build.end_of_build application.
     * Stores the turn number whose Dreadnought spawn step has already resolved.
     */
    dreadnoughtEndOfBuildAppliedTurnNumber?: number;
    
    /** Existing turn flags used elsewhere (present at runtime even if not typed) */
    anyChargesSpentInDeclaration?: boolean;
    anyChargesDeclared?: boolean;
    chargeDeclarationEligibleByPlayerId?: Record<string, boolean>;

    /** Staged first-strike selections, scoped by player and source instance */
    pendingFirstStrikeSelectionsByPlayerId?: Record<string, Record<string, {
      actionId: string;
      sourceInstanceId: string;
      choiceId: string;
      targetInstanceId?: string;
    }>>;
    
    /** Allow future turn-scoped flags */
    [key: string]: any;
  };

  /** Destroyed ships kept out of play but preserved for UI/history */
  voidShipsByPlayerId?: Record<string, ShipInstance[]>;
  
  /** Pending turn accumulators (for aggregated end-of-turn resolution) */
  pendingTurn?: {
    damageByPlayerId: Record<string, number>;
    healByPlayerId: Record<string, number>;
  };
  
  /** Last turn deltas (for UI/debug) */
  lastTurnDamageByPlayerId?: Record<string, number>;
  lastTurnHealByPlayerId?: Record<string, number>;
  lastTurnNetByPlayerId?: Record<string, number>;
  
  /** Persistent power memory (never cleared) */
  powerMemory?: {
    /** Track once-only powers that have fired (key: instanceId::powerId) */
    onceOnlyFired?: Record<string, boolean>;

    /**
     * Frigate (FRI) chosen trigger number per ship instance.
     * Stored when the ship is created during BUILD_SUBMIT.
     */
    frigateTriggerByInstanceId?: Record<string, number>;
  };
};

/**
 * Complete game state
 */
export type GameState = {
  /** Unique game identifier */
  gameId: string;
  
  /** Game status */
  status: 'waiting' | 'active' | 'finished';
  
  /** Winner player ID (if finished) */
  winnerPlayerId?: string | null;
  
  /** Result (if finished) */
  result?: 'win' | 'draw';
  
  /** Canonical terminal reason */
  resultReason?:
    | 'decisive'
    | 'narrow'
    | 'mutual_destruction'
    | 'resignation'
    | 'timeout'
    | 'timeout_draw'
    | 'agreement';
  
  /** Player states */
  players: PlayerState[];
  
  /** Game data container */
  gameData: GameData;
  
  /** Action log (optional) */
  actions?: any[];
};

// Runtime anchor: ensures this module exists in the deployed bundle even though it is mostly types.
export const GAME_STATE_TYPES_VERSION = '3';
