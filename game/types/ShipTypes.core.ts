// Ship Types - CORE (Server-Safe, No React)
// This file can be imported by both client AND server (Deno edge function)
// NO React imports, NO JSX, pure TypeScript only
//
// ⚠️ ENGINE RUNTIME TYPES ONLY
// CSV raw types are in ShipTypes.csv.ts
// DO NOT duplicate ShipDefinition interfaces here

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
    effectType?: EffectKind;   // Effect type if condition met
    value?: number;            // Effect value if condition met
  }>;
  
  // ========================================================================
  // ENERGY SYSTEM (Ancient)
  // ========================================================================
  
  energyGeneration?: {
    red?: number;
    green?: number;
    blue?: number;
    conditional?: 'dice_1_or_2'; // QUA conditional energy
  };
  
  // Energy cost (conditional override - takes precedence over ShipDefinition.energyCost)
  energyCost?: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';  // Simulacrum only
  };
  
  // ========================================================================
  // DICE MANIPULATION
  // ========================================================================
  
  diceManipulation?: {
    type: 'force_value' | 'reroll' | 'reroll_twice';
    forceValue?: number;  // For Leviathan (force all dice to 6)
  };
  
  // ========================================================================
  // LINE GENERATION
  // ========================================================================
  
  lineGeneration?: {
    amount: number;  // Base amount (before conditional modifiers)
    joiningOnly?: boolean;  // Ship of Legacy joining lines
    conditional?: 'dice_even';  // Ship of Vigor, Ark of Power
    multiplier?: number;  // Science Vessel dice multiplier
    applyToFutureTurns?: boolean;  // Persistent line generation
  };
  
  // ========================================================================
  // SPECIAL MECHANICS
  // ========================================================================
  
  // Cube: Repeat solar power
  repeatSolarPower?: {
    targetIndex: 'first';  // Always first solar power cast
    perShip: boolean;      // Once per Cube (true) or once total (false)
  };
  
  // Defense Swarm / Antlion Array: conditional scaling
  healthComparison?: {
    whenLower: { effectType: EffectKind; value: number };
    default: { effectType: EffectKind; value: number };
  };
  
  // Science Vessel: scaling based on ship count
  scalingByShipCount?: {
    1?: { effectType: EffectKind; multiplier: number };
    2?: { effectType: EffectKind; multiplier: number };
    3?: { effectType: EffectKind; value: number };
  };
  
  // Ark of Knowledge: damage/healing equality
  equalizeHighest?: boolean;
  
  // Hive: component counting override
  countComponentShips?: boolean;
  
  // ========================================================================
  // SHIP CONTROL (Ark of Domination)
  // ========================================================================
  
  takeControl?: {
    quantity: number;
    targetType: 'basic_only' | 'upgraded_only';
  };
  
  // ========================================================================
  // DESTRUCTION / SACRIFICE
  // ========================================================================
  
  destruction?: {
    targetOwner: 'self' | 'opponent';
    targetType: 'basic_only' | 'upgraded_only' | 'any';
    quantity: number;
    convertToShips?: {
      shipId: ShipDefId;
      ratio: number; // Ships created per 'ratio' lines in destroyed ship
    };
  };
  
  // ========================================================================
  // HEALTH MANIPULATION
  // ========================================================================
  
  setHealthToMax?: boolean; // Ark of Redemption
  
  // ========================================================================
  // EXTRA BUILD PHASE (Chronoswarm)
  // ========================================================================
  
  extraBuildPhase?: {
    1?: { diceCount: number };
    2?: { diceCount: number };
    3?: { diceCount: number };
  };
  
  // ========================================================================
  // MAXIMUM CAPS (Per-turn limits)
  // ========================================================================
  
  maxPerTurn?: number; // Mantis healing cap (10)
}

// ============================================================================
// COST STRUCTURES
// ============================================================================

export interface BasicShipCost {
  totalLines: number;
}

export interface UpgradedShipCost {
  joiningLines: number;
  components: ComponentShipRequirement[];
}

export interface ComponentShipRequirement {
  shipId: ShipDefId;
  quantity: number;
  mustBeDepleted?: boolean;  // For ships like CAR(0), ANT(0)
}

export interface SolarPowerCost {
  red?: number;
  green?: number;
  blue?: number;
  variable?: 'ship_line_cost';  // For Simulacrum
}

// ============================================================================
// SHIP DEFINITION (ENGINE CANONICAL)
// ============================================================================

/**
 * ShipDefinition - Engine-canonical ship definition
 * 
 * This is the RUNTIME type used by game engine.
 * Uses enums, parsed components, structured costs.
 * 
 * For CSV raw data, see ShipDefinitionCsv in ShipTypes.csv.ts
 */
export interface ShipDefinition {
  // Basic identification
  id: ShipDefId; // e.g., "DEF", "BTC", "INT"
  name: string; // e.g., "Defender", "Battlecruiser"
  species: Species;
  type: ShipType;
  
  // Visual properties (color only - no graphics components)
  color: string; // e.g., "Pastel Green", "Cyan"
  
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

/**
 * Backward compatibility alias
 * @deprecated Use ShipDefinition instead
 */
export type ShipDefinitionCore = ShipDefinition;

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
    frigate_trigger?: number;  // 1-6
    [key: string]: number | string | boolean | undefined;
  };
  
  // Solar power tracking (Ancient)
  solarPowerState?: {
    isActive: boolean;
    activatedOnTurn?: number;
  };
}

export interface PowerUsageRecord {
  powerIndex: number;
  turn: number;
  chargesUsed?: number;
}

// ============================================================================
// FLEET COMPOSITION (Categorized ships)
// ============================================================================

/**
 * FleetComposition - Categorizes ships by type/status
 */
export interface FleetComposition {
  // All ships
  allShips: ShipInstance[];
  
  // By ship type
  basicShips: ShipInstance[];
  upgradedShips: ShipInstance[];
  solarPowers: ShipInstance[];
  
  // By status
  activeShips: ShipInstance[];      // Not destroyed, not consumed
  destroyedShips: ShipInstance[];
  consumedShips: ShipInstance[];    // Consumed in upgrades
  
  // By turn
  newShipsThisTurn: ShipInstance[];
  
  // By charges
  chargeableShips: ShipInstance[];  // Ships with charges
}

// ============================================================================
// SHIP DEFINITION REGISTRY
// ============================================================================

/**
 * Function type for getting ship definitions
 * Used by engine to look up ship data
 */
export type GetShipDefinition = (shipDefId: ShipDefId) => ShipDefinition | undefined;

/**
 * Ship definition registry
 * Maps ship IDs to their definitions
 */
export type ShipDefinitionRegistry = Record<ShipDefId, ShipDefinition>;