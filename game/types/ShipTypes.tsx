// Ship data types for Shapeships
// Comprehensive data model supporting basic ships, upgraded ships, and solar powers
// ALIGNED WITH CURRENT ENGINE: Build Phase → Battle Phase → End of Turn Resolution

// NOTE: React import only needed for graphics (client-only feature)
// Server can import this file as long as it doesn't use ShipGraphic type
import React from 'react';
import type { GameState } from './GameTypes';
import { EffectKind } from './EffectTypes';

// ============================================================================
// IDENTITY TYPE ALIASES
// ============================================================================

/**
 * Player identity (runtime)
 */
export type PlayerId = string;

/**
 * Ship definition identity (static)
 * Example: "DEF", "FIG", "INT"
 */
export type ShipDefId = string;

/**
 * Ship instance identity (runtime, unique per ship instance)
 * Used for targeting, destruction, triggers, etc.
 */
export type ShipInstanceId = string;

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export enum ShipType {
  BASIC = 'basic',
  UPGRADED = 'upgraded',
  SOLAR_POWER = 'solar_power'
}

export enum Species {
  HUMAN = 'human',
  XENITE = 'xenite',
  CENTAUR = 'centaur',
  ANCIENT = 'ancient'
}

// ALIGNED WITH ENGINE: Matches BuildPhaseStep, BattlePhaseStep, and current engine phases
export enum ShipPowerPhase {
  // Build Phase Steps
  DICE_ROLL = 'dice_roll',
  LINE_GENERATION = 'line_generation',
  SHIPS_THAT_BUILD = 'ships_that_build',
  DRAWING = 'drawing',
  END_OF_BUILD = 'end_of_build',
  
  // Battle Phase Steps
  FIRST_STRIKE = 'first_strike',
  SIMULTANEOUS_DECLARATION = 'simultaneous_declaration',
  CONDITIONAL_RESPONSE = 'conditional_response',
  
  // End of Turn
  AUTOMATIC = 'automatic',  // Continuous effects resolved at End of Turn
  
  // Special (not phases, but trigger types)
  DICE_MANIPULATION = 'dice_manipulation',
  
  // ⚠️ EVENT powers are hooks triggered by state changes (destruction, completion, etc.)
  // They are NOT iterated as part of phase execution.
  // Examples: UPON_DESTRUCTION, ON_SHIP_COMPLETED
  EVENT = 'event'
  
  // PASSIVE removed - use PowerTiming.PASSIVE instead (rule modifiers are timing, not phase)
}

// Power timing - distinguishes when/how effects are created
export enum PowerTiming {
  CONTINUOUS = 'continuous',  // Every turn (requires ship alive at End of Turn)
  ONCE_ONLY_AUTOMATIC = 'once_only_automatic',  // On completion (persists if destroyed)
  UPON_DESTRUCTION = 'upon_destruction',  // Event hook when ship destroyed
  PASSIVE = 'passive'  // Rule modifier (queried, not executed)
}

// ============================================================================
// EFFECT TYPE - IMPORTED FROM CANONICAL MODULE
// ============================================================================

/**
 * PowerEffectType - Effect types for ship power definitions
 * 
 * ✅ MIGRATED: Now imports from canonical EffectTypes module
 * 
 * This is an alias to EffectKind for backward compatibility.
 * All new code should use EffectKind directly.
 */
export { EffectKind as PowerEffectType, EffectKind };

// ============================================================================
// QUEUED EFFECT - IMPORTED FROM CANONICAL MODULE
// ============================================================================

/**
 * QueuedEffect and related types are now in EffectTypes.ts
 * 
 * Import from EffectTypes for all effect-related types:
 * - TriggeredEffect (persisted effects)
 * - EvaluatedEffect (computed at end-of-turn)
 * - QueuedEffect (alias for TriggeredEffect)
 * - EffectKind (canonical effect enum)
 */
export type { 
  TriggeredEffect as QueuedEffect,
  TriggeredEffect,
  EvaluatedEffect,
  AnyEffect,
  EffectSource,
  EffectTarget,
  EnergyColor
} from './EffectTypes';

// ============================================================================
// SHIP POWER DEFINITION
// ============================================================================

export interface ShipPower {
  // Power identification
  powerIndex: number;
  
  // When this power executes
  phase: ShipPowerPhase;
  
  // Power timing (distinguishes continuous vs once-only, etc.)
  // CANONICAL SIGNAL FOR PASSIVE: Use timing === PowerTiming.PASSIVE
  timing: PowerTiming;
  
  // What this power does
  effectType: EffectKind;
  
  // Base amount (for flat effects like "heal 3" or "deal 2 damage")
  baseAmount?: number;
  
  // Description for display
  description: string;
  
  // Special logic configuration
  specialLogic?: SpecialLogic;
  
  // Whether this power requires a charge to use
  requiresCharge?: boolean;
  
  // Whether this is an optional power (player chooses to activate)
  isOptional?: boolean;
  
  // Player choice required
  requiresPlayerChoice?: boolean;
  choiceType?: 'trigger_number' | 'or_choice' | 'target_selection' | 'ship_selection' | 'ship_transformation';
}

/**
 * SpecialLogic - Extended configuration for complex ship powers
 * 
 * ALIGNED WITH SHIPDEFINITIONS:
 * This interface matches actual usage in ShipDefinitions.tsx.
 * Fields are added as needed to support existing ship data.
 */
export interface SpecialLogic {
  // ========================================================================
  // COUNTING LOGIC
  // ========================================================================
  
  countType?: 'self_ships' | 'opponent_ships' | 'specific_ship_type' | 'ships_built_this_turn' | 'total_ships' | 'ship_types';
  countTarget?: ShipDefId; // Ship definition ID to count
  countMultiplier?: number; // Amount per counted item (e.g., "every THREE fighters" = 3)
  
  // Exclusions (for complex counting like Queen)
  excludeShipsFrom?: ShipDefId[]; // Ship definition IDs to exclude from counting
  excludeSelf?: boolean; // Exclude self from counting
  
  // ========================================================================
  // SHIP BUILDING
  // ========================================================================
  
  buildShipId?: ShipDefId; // Ship definition ID to build (e.g., Carrier → "DEF", "FIG")
  
  // ========================================================================
  // CHARGE SYSTEM
  // ========================================================================
  
  chargesRequired?: number; // Number of charges required to use this power
  
  // ========================================================================
  // TARGETING
  // ========================================================================
  
  targetType?: 'basic_only' | 'upgraded_only' | 'any' | 'self' | 'opponent';
  
  // ========================================================================
  // SHIP TRANSFORMATION (Evolver)
  // ========================================================================
  
  sourceShipId?: ShipDefId; // Ship definition ID to transform FROM
  targetShipOptions?: ShipDefId[]; // Ship definition IDs to transform TO
  
  // ========================================================================
  // EVENT TRIGGERS
  // ========================================================================
  
  triggerEvent?: 'on_ship_destroyed' | 'on_ship_completed' | 'on_dice_roll' | 'on_energy_spent';
  
  // ========================================================================
  // CONDITIONS
  // ========================================================================
  
  conditionType?: 'dice_value' | 'dice_even' | 'dice_range' | 
                  'health_comparison' | 'ship_quantity' | 'turn_built';
  conditionValue?: number | number[];
  conditionComparison?: 'equals' | 'greater' | 'less' | 'in_range';
  
  // ========================================================================
  // CONDITIONAL EFFECTS (Zenith, Defense Swarm)
  // ========================================================================
  
  conditionalEffects?: Array<{
    diceValue?: number;        // Dice roll value that triggers this effect
    diceRange?: [number, number]; // Dice range that triggers this effect
    buildShipId?: ShipDefId;   // Ship to build if condition met
    quantity?: number;         // Quantity to build/heal/damage
    effectType?: PowerEffectType; // Effect type if condition met
    value?: number;            // Effect value if condition met
  }>;
  
  // ========================================================================
  // DICE MANIPULATION
  // ========================================================================
  
  diceManipulation?: 'reroll' | 'reroll_twice' | 'force_value';
  forcedDiceValue?: number;
  diceRange?: [number, number]; // Dice range constraint
  
  // ========================================================================
  // SCALING (Science Vessel, Ark of Knowledge, Spiral)
  // ========================================================================
  
  scalingType?: 'by_quantity' | 'by_dice' | 'by_health' | 'by_energy_spent';
  
  scalingValues?: Array<{
    quantity?: number;         // Quantity of ships required
    effect: string;            // Effect identifier (e.g., 'double_automatic_damage')
    value?: number;            // Effect value
    buildShipId?: ShipDefId;   // Ship to build (if effect is BUILD_SHIP)
  }>;
  
  // Quantity-based scaling (backward compatibility)
  scalingByQuantity?: {
    [quantity: number]: {
      effectType: PowerEffectType;
      value: number | 'dice_roll' | 'dice_roll_plus_4' | 'dice_roll_plus_5';
    };
  };
  
  // ========================================================================
  // ENERGY COSTS (Ancient)
  // ========================================================================
  
  // Energy costs - Conditional override
  // Takes precedence over ShipDefinition.energyCost if both exist
  // Use this for variable/conditional costs (e.g., Simulacrum: X blue = ship's line cost)
  energyCost?: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';  // Simulacrum: X blue = ship's line cost
  };
  
  energyColor?: 'red' | 'green' | 'blue' | 'all'; // For GAIN_ENERGY effects
  
  // ========================================================================
  // SACRIFICE/FORMULA (Sacrificial Pool)
  // ========================================================================
  
  sacrificeShip?: boolean; // Whether this power sacrifices a ship
  quantityFormula?: string; // Formula for calculating quantity (e.g., "floor(line_cost / 3)")
  
  // ========================================================================
  // LIMITS
  // ========================================================================
  
  maxHealingPerTurn?: number; // Maximum healing this power can generate per turn (Mantis: 10)
  
  // ========================================================================
  // PERSISTENCE
  // ========================================================================
  
  persistsIfSourceDestroyed?: boolean; // Effect persists even if source ship destroyed
  
  // ========================================================================
  // CHOICE-BASED EFFECTS (Defense Swarm)
  // ========================================================================
  
  orChoice?: {
    default: { effectType: PowerEffectType; value: number };
    conditional: {
      condition: 'health_lower' | 'dice_match' | 'custom';
      effectType: PowerEffectType;
      value: number;
    };
  };
  
  // ========================================================================
  // LEGACY (backward compatibility)
  // ========================================================================
  
  usesDiceRoll?: boolean;
  diceMultiplier?: number;
  onceOnly?: boolean;  // DEPRECATED - use timing: ONCE_ONLY_AUTOMATIC instead
  usedThisGame?: boolean;
  condition?: string;
  conditionCheck?: (gameState: GameState) => boolean;
  
  // ========================================================================
  // CUSTOM LOGIC IDENTIFIER
  // ========================================================================
  
  // Custom logic identifier (for truly unique ships)
  customLogicId?: string;
}

// ============================================================================
// GRAPHICS
// ============================================================================

export interface ShipGraphic {
  component: React.ComponentType<{ className?: string }>;
  condition?: 'default' | 'charges_0' | 'charges_1' | 'charges_2' | 'charges_3' | 'charges_4' | 'charges_5' | 'charges_6' | 'charges_depleted';
}

// ============================================================================
// SHIP COST STRUCTURES
// ============================================================================

export interface BasicShipCost {
  lines: number;
}

export interface UpgradedShipCost {
  componentShips: ComponentShipRequirement[];
  joiningLines: number;
  totalLines: number; // For reference/display
}

export interface ComponentShipRequirement {
  shipId: ShipDefId;
  quantity: number;
  mustBeDepleted?: boolean; // Ships with (0) notation in CSV
}

export interface SolarPowerCost {
  energy: number;
}

// ============================================================================
// MAIN SHIP DEFINITION
// ============================================================================

export interface ShipDefinition {
  // Basic identification
  id: ShipDefId; // e.g., "DEF", "BTC", "INT"
  name: string; // e.g., "Defender", "Battlecruiser"
  species: Species;
  type: ShipType;
  
  // Visual properties
  color: string; // e.g., "Pastel Green", "Cyan"
  graphics?: ShipGraphic[]; // Can have multiple graphics based on state (client-only)
  
  // Cost structure (only one will be defined based on type)
  basicCost?: BasicShipCost;
  upgradedCost?: UpgradedShipCost;
  solarCost?: SolarPowerCost;
  
  // Solar power energy cost (Ancient) - Base/static cost
  // If SpecialLogic.energyCost also exists, that takes precedence (conditional override)
  // DO NOT double-charge - check SpecialLogic first, fall back to this
  energyCost?: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';  // Simulacrum only
  };
  
  // Powers
  powers: ShipPower[];
  
  // Charge system (for ships like Interceptor)
  maxCharges?: number;
  chargesPerTurn?: number; // How many charges can be used per turn (default 1)
  
  // Maximum quantity allowed
  maxQuantity?: number;  // e.g., Orbital: 6, Ship of Vigor: 3
  
  // Metadata
  description?: string; // Flavor text or clarification
  rulesNotes?: string; // Special rules or interactions
}

// ============================================================================
// SHIP INSTANCE (in-game state)
// ============================================================================

/**
 * ShipInstance - Runtime instance of a ship
 * 
 * ARCHITECTURAL LAW:
 * - ShipDefinition.id is static definition ID (e.g., "DEF")
 * - ShipInstance.instanceId is runtime identity (unique per instance)
 * - Use instanceId for targeting, destruction, triggers, etc.
 */
export interface ShipInstance {
  // Reference to definition
  definitionId: ShipDefId;
  
  // Instance identification
  instanceId: ShipInstanceId; // Unique ID for this specific instance (MUST be used for targeting)
  ownerId: PlayerId; // Player ID who owns this ship
  
  // State tracking
  chargesRemaining?: number;
  isDepleted: boolean;
  
  // Destruction state (CRITICAL for EVENT hooks and passive filtering)
  isDestroyed: boolean;              // Ship has been destroyed
  destroyedOnTurn?: number;          // Turn ship was destroyed (for event hooks)
  isConsumedInUpgrade?: boolean;     // Ship consumed in upgrade (alternative to destroyed)
  
  // Turn tracking
  createdOnTurn: number;
  usedThisTurn: boolean;
  
  // Power usage tracking
  powerUsageHistory: PowerUsageRecord[];
  
  // For upgraded ships - track what ships were consumed
  consumedShips?: ShipInstanceId[]; // Instance IDs of component ships
  
  // Ship-specific configuration (Frigate trigger number, etc.)
  configuration?: {
    frigate_trigger?: number;  // 1-6 (✅ FIXED TYPO: was "frigat_trigger")
    [key: string]: number | string | boolean | undefined;
  };
}

export interface PowerUsageRecord {
  turn: number;
  powerIndex: number;
  phase: ShipPowerPhase;
  effect: string; // Description of what happened
  amount?: number; // For damage/healing/etc
}

// ============================================================================
// PLAYER SHIP COLLECTION
// ============================================================================

export interface PlayerShipCollection {
  playerId: PlayerId;
  ships: ShipInstance[];
  
  // Tracking for turn-based effects
  shipsBuiltThisTurn: ShipInstanceId[]; // Instance IDs of ships built this turn
  
  // Ancient-specific (DEPRECATED - moved to Player state in GameTypes)
  currentEnergy?: number;
  maxEnergy?: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Helper type for ship building validation
export interface ShipBuildingValidation {
  canBuild: boolean;
  reason?: string;
  missingComponents?: ComponentShipRequirement[];
  insufficientLines?: number;
  insufficientEnergy?: number;
  maxQuantityReached?: boolean;
}

// Helper type for power execution context
export interface PowerExecutionContext {
  ship: ShipInstance;
  shipDefinition: ShipDefinition;
  power: ShipPower;
  ownerId: PlayerId;
  opponentId: PlayerId;
  currentTurn: number;
  currentPhase: ShipPowerPhase;
  gameState: GameState; // Full game state for complex logic
}

// Context provided to power evaluation functions
export interface GameContext {
  ownerId: PlayerId;
  opponentId: PlayerId;
  roundNumber: number; // Tracks complete Build→Battle→Resolution cycles
  currentPhase: ShipPowerPhase;
  gameState: GameState; // Full game state for complex logic
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SHIP_COLORS = {
  PASTEL_GREEN: 'Pastel Green',
  PASTEL_RED: 'Pastel Red',
  PASTEL_ORANGE: 'Pastel Orange',
  PASTEL_PURPLE: 'Pastel Purple',
  PASTEL_BLUE: 'Pastel Blue',
  PASTEL_YELLOW: 'Pastel Yellow',
  PASTEL_PINK: 'Pastel Pink',
  WHITE: 'White',
  CYAN: 'Cyan',
  MAGENTA: 'Magenta',
  ORANGE: 'Orange',
  YELLOW: 'Yellow',
  BLUE: 'Blue',
  GREEN: 'Green',
  RED: 'Red',
  PINK: 'Pink',
  PURPLE: 'Purple'
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export type ShipColor = typeof SHIP_COLORS[keyof typeof SHIP_COLORS];