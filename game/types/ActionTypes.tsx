// Action Resolution Layer types
// Defines the structure for managing player actions within phases
//
// ARCHITECTURAL ALIGNMENT:
// - Uses canonical EffectKind from EffectTypes (single source of truth)
// - Uses canonical TriggeredEffect from EffectTypes (matches TurnData.triggeredEffects)
// - Uses explicit ship identity types (PlayerId, ShipDefId, ShipInstanceId)
// - Uses typed phase enums (MajorPhase, BuildPhaseStep, BattlePhaseStep)
// - Outputs effects that queue to TurnData.triggeredEffects for EndOfTurnResolver

import type { 
  EffectKind,
  TriggeredEffect,
  PlayerId,
  ShipDefId,
  ShipInstanceId,
  EnergyColor
} from './EffectTypes';

// Re-export for backward compatibility
export type { TriggeredEffect as QueuedEffect } from './EffectTypes';

import { MajorPhase, BuildPhaseStep, BattlePhaseStep } from '../engine/GamePhases';

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * Player action types for different phases
 */
export type ActionType = 
  | 'CHARGE_USE'           // Use a charge power (Simultaneous Declaration)
  | 'CHARGE_RESPONSE'      // Response to opponent's charge use (Conditional Response)
  | 'SOLAR_USE'            // Use a solar power (Ancient species)
  | 'SHIP_BUILD'           // Build a ship during Ships That Build or Drawing
  | 'SHIP_TRANSFORM'       // Evolver: Xenite → Oxite/Asterite
  | 'TRIGGER_SELECTION'    // Frigate: Choose dice number 1-6
  | 'DICE_REROLL'          // Ark of Knowledge: Reroll dice
  | 'SHIP_DESTROY'         // Sacrificial Pool: Destroy own ship
  | 'DECLARE_READY';       // Player has no more actions this phase

// ============================================================================
// ACTION EFFECTS
// ============================================================================

/**
 * ActionEffect - Effect that results from a player action
 * 
 * ✅ Uses canonical EffectKind (single source of truth)
 * ✅ Uses explicit ship identity types
 */
export interface ActionEffect {
  kind: EffectKind;  // ✅ Canonical type from EffectTypes
  value?: number;
  
  // ✅ Explicit ship identity fields
  targetShipInstanceId?: ShipInstanceId;  // For targeting specific ship instance
  targetShipDefId?: ShipDefId;            // For display/filtering by ship type
  targetPlayerId?: PlayerId;
  
  description?: string;
  
  // Energy color for GAIN_ENERGY effects (Ancient species)
  energyColor?: EnergyColor;
}

// ============================================================================
// ACTION OPTIONS
// ============================================================================

/**
 * ActionOption - One choice available to the player
 */
export interface ActionOption {
  id: string;                 // 'heal_5', 'damage_5', 'skip'
  label: string;              // "Heal 5"
  effect?: ActionEffect;      // What happens if chosen
  
  /**
   * Cost to use this option
   * 
   * ✅ charges = CHARGE COST (how many charges consumed)
   *    NOT current charges available
   */
  cost?: {
    charges?: number;         // Charge cost (e.g., Carrier power 2 costs 2 charges)
    lines?: number;           // Line cost for building ships
    joiningLines?: number;    // Joining lines cost for upgraded ships
    energy?: {                // Energy cost (Ancient species)
      red?: number;
      green?: number;
      blue?: number;
    };
  };
}

// ============================================================================
// PENDING ACTIONS
// ============================================================================

/**
 * PendingAction - An action awaiting player resolution
 * 
 * ✅ Uses explicit ship identity types
 * ✅ Includes engine-required metadata for validation
 */
export interface PendingAction {
  actionId: string;           // Unique ID for this specific action
  playerId: PlayerId;         // ✅ Typed player ID
  type: ActionType;
  
  /**
   * Ship that enables this action
   * ✅ Uses ShipInstanceId (unique instance, not definition)
   */
  shipInstanceId?: ShipInstanceId;
  
  /**
   * Ship definition ID (for display/context)
   */
  shipDefId?: ShipDefId;
  
  /**
   * Mandatory = player must resolve one of the options before phase can advance
   * 
   * Note: mandatory ≠ forced use (player can choose "skip" option if available)
   * Note: mandatory ≠ automatic (player still makes the choice)
   */
  mandatory: boolean;
  
  /**
   * Available choices for the player
   */
  options: ActionOption[];
  
  /**
   * Context-specific metadata
   * ✅ Strongly typed (no any)
   */
  metadata?: {
    // Charge state
    currentCharges?: number;     // Current charges available
    maxCharges?: number;         // Maximum charges ship can hold
    maxUses?: number;            // Max uses per phase (e.g., Carrier: 1)
    
    // Targeting constraints (for DESTROY_SHIP, STEAL_SHIP, etc.)
    requiredTargets?: number;    // How many targets must be selected
    allowedTargetScope?: 'self' | 'opponent' | 'any';
    targetConstraints?: {
      basicOnly?: boolean;       // Guardian: Only target basic ships
      upgradedOnly?: boolean;    // Only target upgraded ships
      mustMatchCost?: boolean;   // Simulacrum: Must match original cost
      maxTargets?: number;       // Maximum number of targets
      excludeSelf?: boolean;     // Exclude the source ship from targeting
    };
    
    // Multiple use
    canUseMultiple?: boolean;    // Can use multiple times in one phase
    
    // Display
    description?: string;
  };
}

// ============================================================================
// COMPLETED ACTIONS
// ============================================================================

/**
 * CompletedAction - Record of a resolved action
 * 
 * ✅ Uses canonical TriggeredEffect (no duplicate type)
 */
export interface CompletedAction {
  actionId: string;
  playerId: PlayerId;
  chosenOption: string;        // ID of chosen ActionOption
  timestamp: number;
  
  /**
   * Resolved effects queued to TurnData.triggeredEffects
   * 
   * ✅ Uses canonical TriggeredEffect from EffectTypes
   * One action option can queue multiple effects:
   * - CONDITIONAL powers may resolve to multiple simultaneous effects
   * - CUSTOM powers may have complex multi-effect resolution
   */
  queuedEffects?: TriggeredEffect[];
}

// ============================================================================
// PLAYER STATUS
// ============================================================================

/**
 * Player status in the action resolution system
 */
export type PlayerStatus = 
  | 'AWAITING_MANDATORY'   // Has mandatory actions that must be resolved
  | 'AWAITING_OPTIONAL'    // Has optional actions, can declare ready
  | 'READY';               // No pending actions, ready to advance

/**
 * PlayerActionState - Per-player action state
 */
export interface PlayerActionState {
  playerId: PlayerId;
  status: PlayerStatus;
  pendingActions: PendingAction[];
  completedActions: CompletedAction[];
  canDeclareReady: boolean;        // Can they click "Ready" button?
  mustResolveFirst: string[];      // IDs of mandatory actions blocking ready
}

// ============================================================================
// PHASE ACTION STATE
// ============================================================================

/**
 * PhaseActionState - Action state for the current phase
 * 
 * ✅ Uses typed phase enums (not string)
 */
export interface PhaseActionState {
  /**
   * Current major phase
   * ✅ Typed enum instead of string
   */
  majorPhase: MajorPhase;
  
  /**
   * Current step within the major phase
   * ✅ Typed union instead of string
   */
  step: BuildPhaseStep | BattlePhaseStep | null;
  
  /**
   * Per-player action states
   */
  playerStates: { [playerId: string]: PlayerActionState };
  
  /**
   * Can the phase advance?
   */
  canAdvancePhase: boolean;
  
  /**
   * Why can't we advance? (for UI)
   */
  blockingReason?: string;
  
  /**
   * Phase-specific metadata
   */
  phaseMetadata?: {
    diceRoll?: number;
    
    /**
     * Does this step auto-resolve without player input?
     * Examples: DICE_ROLL, LINE_GENERATION, END_OF_BUILD
     */
    isSystemDrivenStep?: boolean;
    
    /**
     * Can players take actions in this step?
     * Examples: SHIPS_THAT_BUILD, DRAWING, SIMULTANEOUS_DECLARATION
     */
    acceptsPlayerInput?: boolean;
    
    /**
     * Is this a response window?
     * Allows conditional responses to previous actions.
     * 
     * Examples: 
     * - CONDITIONAL_RESPONSE phase (after charge declarations)
     * - Future: Combat response windows, interrupt mechanics
     */
    isResponseWindow?: boolean;
  };
}

// ============================================================================
// ACTION RESOLUTION RESULT
// ============================================================================

/**
 * Result of resolving a player action
 * 
 * ✅ Uses canonical TriggeredEffect
 * ✅ Explicit ship identity types
 */
export interface ActionResolutionResult {
  success: boolean;
  error?: string;
  
  /**
   * Effects queued to TurnData.triggeredEffects
   * ✅ Uses canonical TriggeredEffect from EffectTypes
   */
  effectsQueued: TriggeredEffect[];
  
  /**
   * State changes for tracking/display
   * ✅ Uses explicit ship identity types
   */
  stateChanges?: {
    shipsCreated?: ShipInstanceId[];        // ✅ Instance IDs
    shipsDestroyed?: ShipInstanceId[];      // ✅ Instance IDs
    chargesUsed?: {                         // ✅ Instance ID → count
      [shipInstanceId: string]: number;
    };
    resourcesChanged?: {
      lines?: number;
      joiningLines?: number;
      energy?: {
        red?: number;
        green?: number;
        blue?: number;
      };
    };
  };
}

// ============================================================================
// RE-EXPORTS (for convenience)
// ============================================================================

/**
 * Re-export canonical types for convenience
 * Consumers can import from ActionTypes without needing to import from EffectTypes
 */
export type { 
  TriggeredEffect as QueuedEffect,
  EffectKind,
  PlayerId,
  ShipDefId,
  ShipInstanceId
};

export { MajorPhase, BuildPhaseStep, BattlePhaseStep };