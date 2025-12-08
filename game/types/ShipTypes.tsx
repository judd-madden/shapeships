// Ship data types for Shapeships
// Comprehensive data model supporting basic ships, upgraded ships, and solar powers

import type { GameState } from './GameTypes';

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

// Extended phase system - includes subphases from the 14-subphase system
export enum ShipPowerPhase {
  // Simple 4-phase cycle
  DICE_ROLL = 'dice_roll',
  SHIP_BUILDING = 'ship_building',
  AUTOMATIC = 'automatic',
  HEALTH_RESOLUTION = 'health_resolution',
  
  // Extended subphases (for complex ships)
  LINE_GENERATION = 'line_generation',
  SHIPS_THAT_BUILD = 'ships_that_build',
  CHARGE_DECLARATION = 'charge_declaration',
  CHARGE_RESPONSE = 'charge_response',
  BEFORE_AUTOMATIC = 'before_automatic',
  AFTER_AUTOMATIC = 'after_automatic',
  DAMAGE_MITIGATION = 'damage_mitigation'
}

export enum PowerEffectType {
  // Direct effects
  HEAL = 'heal',
  DEAL_DAMAGE = 'deal_damage',
  GAIN_LINES = 'gain_lines',
  BUILD_SHIP = 'build_ship',
  
  // Resource effects
  GAIN_ENERGY = 'gain_energy',
  USE_ENERGY = 'use_energy',
  
  // Special effects
  USE_CHARGE = 'use_charge',
  COUNT_AND_DAMAGE = 'count_and_damage',
  COUNT_AND_HEAL = 'count_and_heal',
  DICE_BASED = 'dice_based',
  CONDITIONAL = 'conditional',
  CUSTOM = 'custom'
}

// ============================================================================
// SHIP POWER DEFINITION
// ============================================================================

export interface ShipPower {
  // Power identification
  powerIndex: number;
  
  // When this power executes
  phase: ShipPowerPhase;
  
  // What this power does
  effectType: PowerEffectType;
  
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
}

export interface SpecialLogic {
  // Counting logic
  countType?: 'self_ships' | 'opponent_ships' | 'specific_ship_type' | 'ships_built_this_turn' | 'total_ships';
  countTarget?: string; // Ship ID to count, if counting specific type
  countMultiplier?: number; // Amount per counted item
  
  // Dice-based logic
  usesDiceRoll?: boolean;
  diceMultiplier?: number;
  
  // Exclusions (for complex counting like Queen)
  excludeShipsFrom?: string[]; // Ship IDs to exclude from counting
  
  // One-time effects
  onceOnly?: boolean;
  usedThisGame?: boolean;
  
  // Conditional logic
  condition?: string; // Description of condition
  conditionCheck?: (gameState: GameState) => boolean; // Function to check condition
  
  // Custom logic identifier (for truly unique ships)
  customLogicId?: string;
}

// ============================================================================
// SHIP GRAPHICS
// ============================================================================

export interface ShipGraphic {
  filename: string;
  condition?: 'default' | 'charges_remaining' | 'depleted' | 'active' | 'inactive';
  chargesRequired?: number; // For graphics that change based on charge count
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
  shipId: string;
  quantity: number;
  mustBeDepleted?: boolean; // Default true for ships with charges
}

export interface SolarPowerCost {
  energy: number;
}

// ============================================================================
// MAIN SHIP DEFINITION
// ============================================================================

export interface ShipDefinition {
  // Basic identification
  id: string; // e.g., "DEF", "BTC", "INT"
  name: string; // e.g., "Defender", "Battlecruiser"
  species: Species;
  type: ShipType;
  
  // Visual properties
  color: string; // e.g., "Pastel Green", "Cyan"
  graphics: ShipGraphic[]; // Can have multiple graphics based on state
  
  // Cost structure (only one will be defined based on type)
  basicCost?: BasicShipCost;
  upgradedCost?: UpgradedShipCost;
  solarCost?: SolarPowerCost;
  
  // Powers
  powers: ShipPower[];
  
  // Charge system (for ships like Interceptor)
  maxCharges?: number;
  chargesPerTurn?: number; // How many charges can be used per turn (default 1)
  
  // Metadata
  description?: string; // Flavor text or clarification
  rulesNotes?: string; // Special rules or interactions
}

// ============================================================================
// SHIP INSTANCE (in-game state)
// ============================================================================

export interface ShipInstance {
  // Reference to definition
  definitionId: string;
  
  // Instance identification
  instanceId: string; // Unique ID for this specific instance
  ownerId: string; // Player ID who owns this ship
  
  // State tracking
  chargesRemaining?: number;
  isDepleted: boolean;
  
  // Turn tracking
  createdOnTurn: number;
  usedThisTurn: boolean;
  
  // Power usage tracking
  powerUsageHistory: PowerUsageRecord[];
  
  // For upgraded ships - track what ships were consumed
  consumedShips?: string[]; // Instance IDs of component ships
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
  playerId: string;
  ships: ShipInstance[];
  
  // Tracking for turn-based effects
  shipsBuiltThisTurn: string[]; // Instance IDs of ships built this turn
  
  // Ancient-specific
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
}

// Helper type for power execution context
export interface PowerExecutionContext {
  ship: ShipInstance;
  shipDefinition: ShipDefinition;
  power: ShipPower;
  ownerId: string;
  opponentId: string;
  currentTurn: number;
  currentPhase: ShipPowerPhase;
  gameState: GameState; // Full game state for complex logic
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SHIP_COLORS = {
  PASTEL_GREEN: 'Pastel Green',
  PASTEL_PURPLE: 'Pastel Purple',
  PASTEL_BLUE: 'Pastel Blue',
  PASTEL_YELLOW: 'Pastel Yellow',
  CYAN: 'Cyan',
  MAGENTA: 'Magenta',
  ORANGE: 'Orange',
  RED: 'Red'
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export type ShipColor = typeof SHIP_COLORS[keyof typeof SHIP_COLORS];