/**
 * Ship Types - Engine Layer (Compiled Runtime)
 * 
 * This module defines the ENGINE RUNTIME schema.
 * - Typed enums for species, type, phase, timing
 * - Structured cost types (basic/upgraded/energy)
 * - Compiled powers with preserved raw text
 * - Canonical type used by game engine
 * - Server-safe (no React)
 * 
 * Powers preserve rawSubphase/rawText from CSV even after compilation.
 * Effect kind is optional - only set when confidently known.
 */

import type { EffectKind, EffectAst } from './EffectTypes';

// ============================================================================
// ENUMS - Typed classifications
// ============================================================================

export enum Species {
  HUMAN = 'Human',
  XENITE = 'Xenite',
  CENTAUR = 'Centaur',
  ANCIENT = 'Ancient'
}

export enum ShipType {
  BASIC = 'Basic',
  UPGRADED = 'Upgraded',
  SOLAR_POWER = 'Solar Power'
}

export enum ShipPowerPhase {
  // Build Phase
  LINE_GENERATION = 'Line Generation',
  SHIPS_THAT_BUILD = 'Ships That Build',
  DRAWING = 'Drawing',
  END_OF_BUILD = 'End of Build Phase',
  
  // Battle Phase
  FIRST_STRIKE = 'First Strike',
  SIMULTANEOUS_DECLARATION = 'Simultaneous Declaration',
  CONDITIONAL_RESPONSE = 'Conditional Response',
  
  // Special
  DICE_MANIPULATION = 'Dice Manipulation',
  AUTOMATIC = 'Automatic',
  
  // Event-triggered
  EVENT = 'Event'
}

export enum PowerTiming {
  /** Executes every turn */
  CONTINUOUS = 'Continuous',
  
  /** Only on turn ship is built */
  ONCE_ONLY_AUTOMATIC = 'Once Only Automatic',
  
  /** Triggered by specific event (e.g., destruction) */
  UPON_DESTRUCTION = 'Upon Destruction',
  
  /** Passive rule modifier (always active) */
  PASSIVE = 'Passive'
}

// ============================================================================
// IDENTITY TYPES
// ============================================================================

/** Ship definition ID (e.g., "DEF", "FIG", "SOL") */
export type ShipDefId = string;

/** Runtime ship instance ID (e.g., "ship_abc123") */
export type ShipInstanceId = string;

/** Player ID */
export type PlayerId = string;

// ============================================================================
// COST TYPES
// ============================================================================

/** Cost for basic ships (line cost only) */
export interface BasicShipCost {
  totalLines: number;
}

/** Component ship requirement for upgraded ships */
export interface ComponentShipRequirement {
  /** Ship definition ID (e.g., "DEF", "CAR") */
  shipId: ShipDefId;
  
  /** How many of this ship needed */
  quantity: number;
  
  /** If true, component must have 0 charges remaining (e.g., "CAR(0)") */
  mustBeDepleted?: boolean;
}

/** Cost for upgraded ships (joining lines + components) */
export interface UpgradedShipCost {
  /** Joining lines required */
  joiningLines: number;
  
  /** Component ships required */
  components: ComponentShipRequirement[];
}

/** Energy cost for solar powers */
export interface EnergyCost {
  red?: number;
  green?: number;
  blue?: number;
  
  /** Variable cost based on ship properties (e.g., Simulacrum: X = ship line cost) */
  variable?: 'ship_line_cost';
}

// ============================================================================
// SPECIAL LOGIC TYPES
// ============================================================================

/**
 * Special logic for complex ship powers
 * This is a flexible container for ship-specific behavior
 * that doesn't fit into simple effect patterns
 */
export interface SpecialLogic {
  // Build-related
  buildShipId?: ShipDefId;
  chargesRequired?: number;
  
  // Line generation
  lineGeneration?: {
    amount: number;
    applyToFutureTurns?: boolean;
    conditional?: string; // e.g., "dice_even"
  };
  
  // Energy
  energyGeneration?: {
    red?: number;
    green?: number;
    blue?: number;
  };
  energyCost?: EnergyCost;
  
  // Counting/scaling
  countType?: 'specific_ship_type' | 'all_ships' | 'ship_types' | 'opponent_ship_types';
  countTarget?: ShipDefId;
  countMultiplier?: number; // Divide count by this (e.g., 3 for "every THREE fighters")
  
  // Copy/repeat
  copyTargetType?: 'enemy_basic_ship';
  repeatSolarPower?: {
    targetIndex: 'first' | number;
    perShip: boolean;
  };
  
  // Conditions
  condition?: string; // e.g., "charges_depleted", "health_lower_than_opponent"
  
  // Other
  [key: string]: any; // Extensible for ship-specific logic
}

/**
 * Player choice types for powers that require decisions
 */
export type PowerChoiceType =
  | 'select_ship'
  | 'select_number'
  | 'select_target'
  | 'yes_no'
  | 'activate_or_skip';

// ============================================================================
// ENGINE SHIP POWER
// ============================================================================

/**
 * Compiled ship power (engine runtime format)
 * 
 * Preserves raw CSV text while adding structured metadata.
 * Effect kind is OPTIONAL - only set when confidently known.
 */
export interface EngineShipPower {
  /** Power index within ship's power array */
  powerIndex: number;
  
  /** Compiled phase enum */
  phase: ShipPowerPhase;
  
  /** Compiled timing enum */
  timing: PowerTiming;
  
  /** Original subphase string from CSV (preserved for display/debugging) */
  rawSubphase: string;
  
  /** Original power text from CSV (preserved for display/debugging) */
  rawText: string;
  
  // OPTIONAL STRUCTURED DATA (only set when known/overridden)
  
  /** Pre-parsed effect AST (optional, can come from annotations) */
  effectAst?: EffectAst;
  
  /** Effect kind (optional - only set when confidently inferred or manually overridden) */
  kind?: EffectKind;
  
  /** Base numeric amount (if applicable, e.g., heal 5, deal 3 damage) */
  baseAmount?: number;
  
  /** Special logic for complex effects */
  specialLogic?: SpecialLogic;
  
  /** Whether this power requires spending charges */
  requiresCharge?: boolean;
  
  /** Number of charges required (if requiresCharge is true) */
  chargesRequired?: number;
  
  /** Whether this power requires player choice/decision */
  requiresPlayerChoice?: boolean;
  
  /** Type of choice required */
  choiceType?: PowerChoiceType;
  
  /** Whether this power is optional (player can choose not to activate) */
  isOptional?: boolean;
}

// ============================================================================
// ENGINE SHIP DEFINITION
// ============================================================================

/**
 * Compiled ship definition (engine runtime format)
 * 
 * This is THE CANONICAL type used by the game engine.
 * All gameplay logic references this type.
 */
export interface EngineShipDefinition {
  /** Ship definition ID */
  id: ShipDefId;
  
  /** Ship display name */
  name: string;
  
  /** Species (typed enum) */
  species: Species;
  
  /** Ship type (typed enum) */
  type: ShipType;
  
  /** Display color (optional, from CSV) */
  color?: string;
  
  // COSTS (exactly one set based on type)
  
  /** Basic ship cost (if type === BASIC) */
  basicCost?: BasicShipCost;
  
  /** Upgraded ship cost (if type === UPGRADED) */
  upgradedCost?: UpgradedShipCost;
  
  /** Energy cost (if type === SOLAR_POWER) */
  energyCost?: EnergyCost;
  
  // POWERS
  
  /** Compiled powers */
  powers: EngineShipPower[];
  
  // CHARGES
  
  /** Maximum charges (if ship uses charges) */
  maxCharges?: number;
  
  // CONSTRAINTS
  
  /** Maximum quantity of this ship allowed in fleet (e.g., 6 for Orbitals) */
  maxQuantity?: number;
  
  // METADATA
  
  /** Rules notes from CSV (extraRules field) */
  rulesNotes?: string;
  
  /** Stack caption for UI display */
  stackCaption?: string;
}

// ============================================================================
// SHIP INSTANCE (RUNTIME STATE)
// ============================================================================

/**
 * Runtime ship instance
 * Represents a specific ship in a player's fleet during a game
 */
export interface ShipInstance {
  /** Unique instance ID */
  instanceId: ShipInstanceId;
  
  /** Ship definition ID (reference to EngineShipDefinition) */
  shipDefId: ShipDefId;
  
  /** Owner player ID */
  ownerId: PlayerId;
  
  /** Current charges remaining (if ship has charges) */
  chargesRemaining?: number;
  
  /** Custom state for ships with special mechanics */
  customState?: {
    /** Frigate trigger number (1-6) */
    frigateTargetNumber?: number;
    
    /** Cube: which solar power has been repeated this turn */
    cubeUsedThisTurn?: boolean;
    
    /** Other ship-specific state */
    [key: string]: any;
  };
  
  /** Turn this ship was built (for once-only effects) */
  builtOnTurn?: number;
}
