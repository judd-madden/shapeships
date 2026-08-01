import type {
  BattleLogScratch,
} from "./battleLogHistory.ts";
import type { SeatController } from "../bot/botTypes.ts";

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
export type ShipPermanentConfiguration = {
  selectedNumber?: number;
};

export type ShipInstance = {
  /** Unique instance identifier (crypto.randomUUID()) */
  instanceId: string;
  
  /** Canonical ship definition ID (e.g., "DEF", "TAC", "CAR") */
  shipDefId: string;
  
  /** Current charge count (for charge-based ships) */
  chargesCurrent?: number;
  
  /** Turn number when ship was created */
  createdTurn?: number;

  /** Permanent per-instance configuration that travels with the ship. */
  permanentConfiguration?: ShipPermanentConfiguration;
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

  /** Authoritative selected faction/species on the live server state */
  faction?: string | null;
  
  /** Compatibility typing for older state readers */
  species?: string | null;
};

export type PendingTurnBreakdownEntry = {
  effectId: string;
  kind: 'Damage' | 'Heal';
  ownerPlayerId: string;
  targetPlayerId: string;
  sourceShipDefId?: string;
  sourceInstanceId?: string;
  sourceLabel?: string;
  baseAmount: number;
  finalAmount: number;
};

export type LastTurnBreakdownRow =
  | {
      rowKind: 'ship';
      label: string;
      count?: number;
      amount: number;
      amountText: string;
    }
  | {
      rowKind: 'solar_power';
      solarPowerId: AncientSolarPowerId;
      label: string;
      count: number;
      amount: number;
      amountText: string;
    }
  | {
      rowKind: 'adjustment';
      label: string;
      amount: number;
      amountText: string;
    };

export type PendingDrawOffer = {
  offererPlayerId: string;
  offereePlayerId: string;
  offeredTurnNumber: number;
};

export type LegacyDrawAgreement = {
  offeredBy: string;
  acceptedBy: string[];
};

export type ShipActivationCueSource = {
  playerId: string;
  sourceInstanceId: string;
};

export type ShipActivationCueBatch = {
  key: string;
  turnNumber: number;
  phaseKey: string;
  seq: number;
  sources: ShipActivationCueSource[];
};

export type DiceManipulationStage = 'kno' | 'cube';
export type CubeDieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type CubeDiceChoiceId = 'main' | `cube:${string}`;
export type LockedCubeDieRoll = {
  sourceInstanceId: string;
  value: CubeDieValue;
};
export type CubeDiceSelection = {
  choiceId: CubeDiceChoiceId;
  value: CubeDieValue;
  sourceInstanceId?: string;
};

export type AncientEnergyPool = {
  green: number;
  red: number;
  blue: number;
};

export type AncientEnergySource = {
  sourceId: string;
  sourceInstanceId?: string;
  sourceShipDefId: string;
  battleTurnNumber: number | null;
  order: number;
  amounts: AncientEnergyPool;
};

export type AncientPlayerEnergyState = {
  battleTurnNumber: number | null;
  pool: AncientEnergyPool;
  sources: AncientEnergySource[];
};

export type AncientDeclarationContext = {
  contextVersion: 1;
  battleTurnNumber: number | null;
  initialEnergy: AncientEnergyPool;
  energySourceIds: string[];
};

export type AncientNormalizedOrdinaryChargeChoice = {
  actionType: 'power';
  actionId: string;
  sourceInstanceId: string;
  choiceId: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
};

export type AncientNormalizedSolarGridChoice = {
  sourceInstanceId: string;
  choiceId: 'use' | 'hold';
};

export const ANCIENT_SOLAR_POWER_IDS = [
  'SLIF', 'SSTA', 'SAST', 'SSUP', 'SCON', 'SSIM', 'SSIP', 'SVOR', 'SBLA',
] as const;

export type AncientSolarPowerId = typeof ANCIENT_SOLAR_POWER_IDS[number];

export type AncientNormalizedSolarCast = {
  solarPowerId: AncientSolarPowerId;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
  lockedAmount?: number;
};

export type AncientAcceptedDeclaration = {
  schemaVersion: 1;
  contractVersion: 1;
  declarationId: string;
  declarationFingerprint: string;
  playerId: string;
  context: AncientDeclarationContext;
  ordinaryChargeActions: AncientNormalizedOrdinaryChargeChoice[];
  solarGridChoices: AncientNormalizedSolarGridChoice[];
  solarCasts: AncientNormalizedSolarCast[];
  autocastEnabled: boolean;
};

export type AncientSolarSourceMode = 'manual' | 'autocast';

export type AncientSolarTargetReference = {
  playerId: string;
  shipInstanceId?: string;
};

export type AncientSimulacrumPresentation = {
  sourceTargetInstanceId: string;
  copiedShipDefId: string;
  /**
   * Exact charge count captured from the authoritative start-of-Battle
   * fleet snapshot. Optional only for older persisted ledger entries.
   */
  capturedStartOfBattleCharges?: number;
  /**
   * Approved permanent configuration captured from the authoritative
   * start-of-Battle fleet snapshot. Optional only for older persisted entries.
   */
  permanentConfiguration?: ShipPermanentConfiguration;
  matchupKey?: string;
};

export type AncientSolarLedgerEntry = {
  entryId: string;
  order: number;
  solarPowerId: AncientSolarPowerId;
  sourceMode: AncientSolarSourceMode;
  paidEnergy: AncientEnergyPool;
  lockedAmount?: number;
  targets?: AncientSolarTargetReference[];
  simulacrum?: AncientSimulacrumPresentation;
};

export type AncientSolarLedgerState = {
  battleTurnNumber: number | null;
  entries: AncientSolarLedgerEntry[];
};

/**
 * Narrow declaration-entry public baseline. Fleets deliberately remain in
 * chargeDeclarationFleetSnapshotByPlayerId so this record does not duplicate
 * the largest turn-scoped structure.
 */
export type ChargeDeclarationVisibilitySnapshot = {
  battleTurnNumber: number;
  voidShipsByPlayerId: Record<string, ShipInstance[]>;
  healthByPlayerId: Record<string, number>;
  ancientEnergyByPlayerId: Record<string, AncientPlayerEnergyState>;
  ancientSolarLedgerByPlayerId: Record<string, AncientSolarLedgerState>;
};

/** Requester-local acknowledgement derived only from accepted SpendCharge effects. */
export type ChargeDeclarationAcknowledgements = {
  battleTurnNumber: number;
  chargeAfterByPlayerId: Record<string, Record<string, number>>;
};

export type AncientSimulacrumProducedShipOutcome = {
  instanceId: string;
  shipDefId: string;
  sourceShipDefId: string;
};

export type AncientSimulacrumMaterializationOutcome = {
  joiningLinesGranted: number;
  producedShips: AncientSimulacrumProducedShipOutcome[];
};

export type AncientPendingSimulacrumCopy = {
  pendingCopyId: string;
  declarationId: string;
  ownerPlayerId: string;
  sourceTargetInstanceId: string;
  copiedShipDefId: string;
  queuedTurnNumber: number;
  materializationTurnNumber: number;
  queueOrder: number;
  capturedStartOfBattleCharges: number;
  permanentConfiguration: ShipPermanentConfiguration;
  sourceMode: 'primary';
  status: 'queued' | 'materialized';
  materializedInstanceId?: string;
  materializationOutcome?: AncientSimulacrumMaterializationOutcome;
};

export type AncientPendingBlackHoleDestruction = {
  pendingDestructionId: string;
  declarationId: string;
  ownerPlayerId: string;
  targetPlayerId: string;
  targetInstanceIds: string[];
  battleTurnNumber: number;
  lockedDamage: number;
  status: 'committed' | 'resolved';
};

export type AncientState = {
  schemaVersion: 1;
  energyByPlayerId: Record<string, AncientPlayerEnergyState>;
  acceptedDeclarationByPlayerId: Record<string, AncientAcceptedDeclaration>;
  solarLedgerByPlayerId: Record<string, AncientSolarLedgerState>;
  pendingSimulacrumCopies: AncientPendingSimulacrumCopy[];
  pendingBlackHoleDestructions: AncientPendingBlackHoleDestruction[];
};

export type QuantumMysticRevealMemory = {
  battleTurnNumber: number;
  controllerPlayerId: string;
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

  /** Durable server-authoritative Ancient state (never turn scratch) */
  ancient?: AncientState;
  
  /** Turn-specific data */
  turnData?: {
    diceRoll?: number;
    linesDistributed?: boolean;
    shipActivationCueBatches?: ShipActivationCueBatch[];
    
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
    /** Internal stage within the authoritative build.dice_roll workflow */
    diceManipulationStage?: DiceManipulationStage;
    /** Complete authoritative Cube rolls, private except through requester actions */
    cubeDiceRollsByPlayerId?: Record<string, LockedCubeDieRoll[]>;
    /** Hidden staged Cube choice by player */
    pendingCubeDiceChoiceByPlayerId?: Record<string, CubeDiceChoiceId>;
    /** Accepted Cube selection retained for the rest of the turn */
    cubeDiceSelectionByPlayerId?: Record<string, CubeDiceSelection>;
    /** Single public Cube value exposed for each eligible controller */
    visibleCubeDiceValueByPlayerId?: Record<string, CubeDieValue>;

    /**
     * Visibility-only snapshot captured on the first authoritative entry into
     * build.drawing for the current turn. Preserves the public drawing-start
     * Saved Lines view through hidden build.drawing without affecting spend.
     */
    buildDrawingPublicSavedResourcesByPlayerId?: Record<string, {
      savedLines: number;
      savedJoiningLines: number;
    }>;

    /** Shared/public Chronoswarm rolls captured at build.dice_roll for this turn */
    chronoswarmRolls?: number[];
    /** Live Chronoswarm counts by player at build.dice_roll timing */
    chronoswarmCountByPlayerId?: Record<string, number>;
    /** Convenience mirror of chronoswarmRolls.length */
    chronoswarmSharedRollCount?: number;
    /** Internal pass index for the shared Ark of Knowledge reroll window */
    knoRerollPassIndex?: 1 | 2 | 3;
    /** Hidden staged Ark of Knowledge reroll choices by player and pass */
    pendingKnoRerollChoiceByPassByPlayerId?: Record<string, Partial<Record<1 | 2 | 3, 'reroll' | 'hold'>>>;
    /** Turn-scoped stop state for Ark of Knowledge rerolls */
    knoRerollStoppedByPlayerId?: Record<string, true>;
    /** Internal pass index for the single build.ships_that_build phase */
    shipsThatBuildPassIndex?: 1 | 2;
    /** Tracks interactive Ships That Build usage by ship instance and pass */
    shipsThatBuildPassUsageByInstanceId?: Record<string, Partial<Record<1 | 2, true>>>;

    /** Exact Drawing-created Spiral that crossed its controller from two to three this turn */
    thirdSpiralFirstStrikeEligibilityByPlayerId?: Record<string, {
      sourceInstanceId: string;
      turnNumber: number;
    }>;
    
    /** Track once-per-turn charge power usage by ship instance */
    chargePowerUsedByInstanceId?: Record<string, number>;

    /**
     * Authoritative count of ships that materially entered each player's fleet
     * during the current turn. Used by turn-scoped powers such as Queen and
     * by end-of-build powers such as Dreadnought in the current phase layout.
     */
    shipsMadeThisTurnByPlayerId?: Record<string, number>;

    /**
     * Turn-scoped snapshot ledger for ships removed from the live fleet during
     * build by non-destroy paths such as upgrade consumption or conversion.
     * Used only to extend once-only resolution source visibility.
     */
    buildPhaseNonDestroyRemovedShipsByPlayerId?: Record<string, Record<string, ShipInstance>>;

    /** Queen-created Xenites this turn, keyed by the player receiving them */
    queenCreatedXenitesThisTurnByPlayerId?: Record<string, number>;

    /**
     * Idempotency flag for server-only build.end_of_build resolution.
     * Stores the turn number whose build.end_of_build phase has already resolved.
     */
    buildEndOfBuildAppliedTurnNumber?: number;

    /**
     * Narrow idempotency flag for authoritative BUILD_SUBMIT resolution in
     * build.drawing. Stores the turn number already resolved for drawing builds.
     */
    buildAppliedTurnNumber?: number;
    
    /** Existing turn flags used elsewhere (present at runtime even if not typed) */
    anyChargesSpentInDeclaration?: boolean;
    anyChargesDeclared?: boolean;
    chargeDeclarationEligibleByPlayerId?: Record<string, boolean>;
    chargeDeclarationEligibleSourceIdsByPlayerId?: Record<string, string[]>;
    /** Internal declaration-start snapshot of charged SOL instances for Ancient controllers. */
    solarGridDeclarationSourceIdsByPlayerId?: Record<string, string[]>;
    chargeDeclarationFleetSnapshotByPlayerId?: Record<string, ShipInstance[]>;
    /** Narrow client-visibility baseline for the simultaneous declaration window. */
    chargeDeclarationVisibilitySnapshot?: ChargeDeclarationVisibilitySnapshot;
    /** Minimal requester-only accepted SpendCharge feedback for this declaration window. */
    chargeDeclarationAcknowledgements?: ChargeDeclarationAcknowledgements;

    /** Staged first-strike selections, scoped by player and source instance */
    pendingFirstStrikeSelectionsByPlayerId?: Record<string, Record<string, {
      actionId: string;
      sourceInstanceId: string;
      choiceId: string;
      targetInstanceId?: string;
      targetInstanceIds?: string[];
    }>>;
    
    /** Allow future turn-scoped flags */
    [key: string]: any;
  };

  /** Authoritative pending draw offer state, if one exists */
  pendingDrawOffer?: PendingDrawOffer | null;

  /** Legacy draw agreement state kept temporarily for compatibility */
  drawAgreement?: LegacyDrawAgreement | null;

  /** Per-player turn stamp for once-per-turn draw offer validation */
  lastDrawOfferTurnByPlayerId?: Record<string, number>;

  /** Destroyed ships kept out of play but preserved for UI/history */
  voidShipsByPlayerId?: Record<string, ShipInstance[]>;
  
  /** Pending turn accumulators (for aggregated end-of-turn resolution) */
  pendingTurn?: {
    damageByPlayerId: Record<string, number>;
    healByPlayerId: Record<string, number>;
    breakdownEntries: PendingTurnBreakdownEntry[];
  };
  
  /** Last turn deltas (for UI/debug) */
  lastTurnDamageByPlayerId?: Record<string, number>;
  lastTurnHealByPlayerId?: Record<string, number>;
  lastTurnNetByPlayerId?: Record<string, number>;
  lastTurnDamageDealtBreakdownByPlayerId?: Record<string, LastTurnBreakdownRow[]>;
  lastTurnHealingReceivedBreakdownByPlayerId?: Record<string, LastTurnBreakdownRow[]>;
  
  /** Persistent power memory (never cleared) */
  powerMemory?: {
    /** Track once-only powers that have fired (key: instanceId::powerId) */
    onceOnlyFired?: Record<string, boolean>;

    /**
     * Frigate (FRI) chosen trigger number per ship instance.
     * Stored when the ship is created during BUILD_SUBMIT.
     */
    frigateTriggerByInstanceId?: Record<string, number>;

    /** Matching Quantum Mystic reveal facts keyed by live ship instance. */
    quantumMysticRevealByInstanceId?: Record<string, QuantumMysticRevealMemory>;
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

  /** Authoritative seat controller metadata */
  controllersByPlayerId?: Record<string, SeatController>;
  
  /** Game data container */
  gameData: GameData;

  /**
   * Server-only authoritative scratch for unfinished battle-log capture.
   * This stays outside gameData and must be stripped from public state reads.
   */
  battleLogScratch?: BattleLogScratch;
  
  /** Action log (optional) */
  actions?: any[];
};

// Runtime anchor: ensures this module exists in the deployed bundle even though it is mostly types.
export const GAME_STATE_TYPES_VERSION = '3';
