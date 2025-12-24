// ============================================================================
// CORE GAME TYPES - CANONICAL RUNTIME MODEL
// ============================================================================
//
// This is the SINGLE SOURCE OF TRUTH for the runtime game state.
// All engine files MUST use these types.
//
// ARCHITECTURAL RULES:
// - PlayerShip is the ONLY runtime ship instance structure
// - No `unknown` types for core engine fields
// - Import shared types from other modules (avoid duplication)
// - Phase enums imported from GamePhases.tsx
// - Effect types imported from EffectTypes.ts (canonical)
//
// ============================================================================

// Import phase enums from GamePhases (canonical source)
import type { MajorPhase, BuildPhaseStep, BattlePhaseStep } from '../engine/GamePhases';

// Import effect types from canonical EffectTypes module
import type { TriggeredEffect } from './EffectTypes';

// Import battle types
import type { BattleCommitmentState } from './BattleTypes';

// ============================================================================
// POSITION & BOARD TYPES
// ============================================================================

// Ship position - visual display only, not stored in game state
// Auto-positioning rules will determine visual placement
export interface ShipPosition {
  visualX?: number; // Visual x-coordinate for display
  visualY?: number; // Visual y-coordinate for display
  zone?: 'front' | 'back' | 'center'; // Future: zone-based positioning
}

// Board state - currently minimal, will expand as rules are defined
export interface BoardState {
  // Placeholder for future board features
  // Ships are stored in gameData.ships, not on board
  zones?: BoardZone[];
  effects?: BoardEffect[];
}

export interface BoardZone {
  id: string;
  name: string;
  effects?: string[]; // Effect IDs active in this zone
}

export interface BoardEffect {
  id: string;
  type: string;
  duration: 'permanent' | 'this_turn' | 'next_turn';
  affectedZones?: string[];
}

// ============================================================================
// RESOURCE TYPES
// ============================================================================

export interface GameResources {
  // Global game resources (if any)
  // Currently all resources are player-specific (lines, health, etc.)
  turnCounter?: number;
  globalEffects?: string[];
}

// ============================================================================
// ACTION DATA TYPES
// ============================================================================

// Specific data for each action type
export interface BuildShipActionData {
  shipId: string; // Ship definition ID to build
  lineCost: number; // Lines spent
  upgradedFromShipIds?: string[]; // If upgrading, which ships were consumed
}

export interface UpgradeShipActionData {
  shipId: string; // Upgraded ship definition ID to build
  consumedShipIds: string[]; // Ships consumed in upgrade
  lineCost: number; // Additional lines spent
}

export interface BuildShipViaPowerActionData {
  shipId: string; // Ship to build
  powerSourceShipId: string; // Ship whose power is building
  powerIndex: number; // Which power on the ship
}

export interface SaveLinesActionData {
  amount: number; // Number of lines to save
}

export interface DiceManipulationActionData {
  shipId: string; // Ship using dice manipulation power
  powerIndex: number;
  manipulation: 'reroll' | 'add' | 'subtract' | 'set';
  amount?: number; // For add/subtract/set
}

export interface UsePowerActionData {
  shipId: string; // Ship using power
  powerIndex: number; // Which power
  targetPlayerId?: string; // Target player (if applicable)
  targetShipId?: string; // Target ship (if applicable)
  parameters?: Record<string, string | number | boolean>; // Power-specific parameters
}

export interface DeclareChargeActionData {
  shipId: string; // Ship declaring charge
  powerIndex: number; // Which charge power
  targetPlayerId?: string; // Target (if applicable)
}

export interface ChargeResponseActionData {
  respondingShipId: string; // Ship responding with charge/solar
  powerIndex: number;
  respondingToShipId: string; // Original charge declarer
}

// Union type for all action data
export type GameActionData = 
  | BuildShipActionData
  | UpgradeShipActionData
  | BuildShipViaPowerActionData
  | SaveLinesActionData
  | DiceManipulationActionData
  | UsePowerActionData
  | DeclareChargeActionData
  | ChargeResponseActionData
  | Record<string, never>; // Empty object for actions with no data

// ============================================================================
// COMBAT & PHASE TYPES
// ============================================================================

export interface PhaseReadiness {
  playerId: string;
  isReady: boolean;
  declaredAt?: string;
  currentStep: BuildPhaseStep | BattlePhaseStep | string; // Typed step
}

export interface CombatAction {
  id: string;
  playerId: string;
  shipId: string;
  actionType: 'charge' | 'charge_response' | 'solar_response' | 'first_strike';
  powerIndex: number;
  targetPlayerId?: string;
  targetShipId?: string;
  timestamp: string;
  resolved?: boolean;
}

// ============================================================================
// DISPLAY TYPES
// ============================================================================

export interface SelectedPiece {
  type: 'ship' | 'zone' | 'effect';
  id: string;
  playerId?: string;
}

export interface HighlightedCell {
  position: ShipPosition;
  type: 'valid_target' | 'selected' | 'affected' | 'warning';
}

export interface Animation {
  id: string;
  type: 'damage' | 'heal' | 'build' | 'destroy' | 'effect';
  sourceId?: string;
  targetId?: string;
  startTime: number;
  duration: number; // milliseconds
  completed: boolean;
}

// ============================================================================
// PLAYER & SHIP INSTANCE (CANONICAL RUNTIME MODEL)
// ============================================================================

export interface Player {
  id: string;
  name: string;
  faction: 'human' | 'xenite' | 'centaur' | 'ancient';
  isReady: boolean;
  isActive: boolean; // whose turn it is
  role: 'player' | 'spectator'; // Player role - spectators can watch but not play
  joinedAt: string;
  health?: number; // Current health (25 start, default max 35)
  maxHealth?: number; // Maximum health (default 35, can be increased by Spiral to 50)
  lines?: number; // Current available lines
  savedLines?: number; // Lines saved from previous turns (Orbital, etc.)
  bonusLines?: number; // Bonus lines this turn only (Science Vessel, etc.)
  diceLines?: number; // Lines from dice roll this turn
  joiningLines?: number; // Current joining lines (Centaur species only - can only be used for upgrades)
  
  // Ancient energy system (red/green/blue ONLY - no pink)
  energy?: {
    red: number;
    green: number;
    blue: number;
  };
  
  ships?: PlayerShip[]; // Ships owned by this player
  copiedShips?: string[]; // IDs of ships copied from other species
  stolenShips?: string[]; // IDs of ships stolen from other species
  
  // Ship-specific configurations (Frigate trigger number, etc.)
  shipConfigurations?: {
    [shipInstanceId: string]: {
      frigate_trigger?: number;  // 1-6
      [key: string]: number | string | boolean | undefined;
    };
  };
}

/**
 * PlayerShip - CANONICAL RUNTIME SHIP INSTANCE
 * 
 * This is the ONLY ship instance structure used at runtime.
 * Replaces ShipTypes.ShipInstance in engine code.
 * 
 * ARCHITECTURAL RULE:
 * - All game state uses PlayerShip
 * - ShipInstance (from ShipTypes) is DEPRECATED for runtime use
 * - Engine code MUST import PlayerShip from GameTypes
 * 
 * Field naming:
 * - id: Unique instance ID (e.g., "ship_abc123")
 * - shipId: Definition ID (e.g., "WED" for Wedge)
 */
export interface PlayerShip {
  // ============================================================================
  // IDENTITY
  // ============================================================================
  id: string; // Unique instance ID
  shipId: string; // References Ship.id from SpeciesData (definition ID)
  ownerId: string; // Player who owns this ship instance
  originalSpecies: string; // Original species, even if copied/stolen
  
  // ============================================================================
  // RUNTIME STATE
  // ============================================================================
  isDestroyed?: boolean;
  isConsumedInUpgrade?: boolean; // True if this ship was used to build an upgraded ship
  temporaryEffects?: TemporaryEffect[];
  
  // ============================================================================
  // TURN TRACKING (for Chronoswarm, etc.)
  // ============================================================================
  createdOnTurn?: number; // Turn number when this ship was built
  
  // ============================================================================
  // CHARGE TRACKING
  // ============================================================================
  currentCharges?: number; // Current charges available
  maxCharges?: number; // Maximum charges this ship can hold
  chargesRemaining?: number; // Alias for currentCharges (for backward compat)
  chargesDeclaredThisPhase?: string[]; // Power indices used this phase (for "one per subphase" rule)
  
  // ============================================================================
  // POWER USAGE HISTORY
  // ============================================================================
  powerUsageHistory?: PowerUsageRecord[]; // Track when powers were used
  
  // ============================================================================
  // SHIP-SPECIFIC PERSISTENT STATE
  // ============================================================================
  frigateTargetNumber?: number; // Frigate: chosen trigger number (1-6)
  
  // ============================================================================
  // VISUAL DISPLAY (not part of game state logic)
  // ============================================================================
  position?: ShipPosition; // Visual display only, not stored in state
  
  // ============================================================================
  // UPGRADE TRACKING
  // ============================================================================
  upgradedFromShips?: string[]; // IDs of ships that were consumed to make this upgraded ship
}

// Temporary effects applied to ships during gameplay
export interface TemporaryEffect {
  id: string;
  type: 'damage_bonus' | 'health_bonus' | 'energy_bonus' | 'joining_lines_bonus' | 'cost_reduction' | 'ability_block' | 'custom';
  amount?: number;
  duration: 'this_turn' | 'next_turn' | 'until_destroyed' | 'permanent';
  appliedBy: string; // Ship or effect that applied this
  customData?: Record<string, string | number | boolean>; // Custom effect data
}

// Power usage record for tracking when ship powers were used
export interface PowerUsageRecord {
  turn: number;
  powerIndex: number;
  phase: string; // ShipPowerPhase value
  effect: string; // Description of what happened
  amount?: number; // For damage/healing/etc
}

// ============================================================================
// GAME ACTION
// ============================================================================

export interface GameAction {
  id: string;
  playerId: string;
  type: 'build_ship' | 'upgrade_ship' | 'build_ship_via_power' | 'save_lines' | 'use_dice_manipulation' | 'use_ship_building_power' | 'use_drawing_phase_power' | 'trigger_upon_completion_power' | 'use_end_build_phase_power' | 'use_first_strike_power' | 'declare_charge' | 'use_solar_power' | 'respond_with_charge' | 'respond_with_solar_power' | 'use_end_battle_phase_power' | 'declare_ready' | 'surrender';
  data: GameActionData;
  timestamp: string;
  validated?: boolean;
}

// ============================================================================
// GAME STATE (ROOT)
// ============================================================================

export interface GameState {
  gameId: string;
  status: 'waiting' | 'starting' | 'active' | 'paused' | 'completed';
  players: Player[];
  roundNumber: number; // Tracks complete Build→Battle→Resolution cycles (not sequential turns)
  currentPlayerId: string; // UI hint only - not a control gate
  gameData: {
    board: BoardState;
    ships: { [playerId: string]: PlayerShip[] }; // ✅ CANONICAL: Uses PlayerShip (ONLY runtime ship type)
    resources: GameResources;
    turnData?: TurnData; // From GamePhases - current turn state
    phaseReadiness?: PhaseReadiness[]; // player readiness for current phase
    combatActions?: CombatAction[]; // actions that require combat resolution
    timer?: GameTimer; // timer state for current phase
    victoryType?: string; // Type of victory when game ends
    
    // Species selection and copying/stealing tracking
    speciesSelected?: boolean;
    crossSpeciesShips?: { [playerId: string]: { copied: string[], stolen: string[] } };
    
    // ✅ NEW: Game rules configuration
    rules?: GameRulesConfig;
  };
  actions: GameAction[];
  settings: GameSettings;
  createdAt: string;
  lastUpdated: string;
}

// ============================================================================
// GAME SETTINGS & RULES
// ============================================================================

export interface GameSettings {
  maxPlayers: number;
  turnTimeLimit?: number; // seconds
  maxHealth?: number; // Default maximum health (35 standard, can be overridden per-game)
  boardSize?: string; // will be defined based on your rules
  gameVariant?: string; // different game modes
}

/**
 * Game rules configuration (stored in gameData.rules)
 * 
 * DECISION: Use gameData.rules for runtime configuration
 * - EndOfTurnResolver checks: gameData.rules.maxHealth ?? settings.maxHealth ?? player.maxHealth ?? DEFAULT
 * - Allows per-game rule variations without changing global settings
 */
export interface GameRulesConfig {
  maxHealth?: number; // Per-game maximum health override
  // Add other per-game rules here as needed
}

/**
 * Game rules interface (for RulesEngine implementation)
 */
export interface GameRules {
  validateAction: (action: GameAction, gameState: GameState) => boolean;
  applyAction: (action: GameAction, gameState: GameState) => GameState;
  checkWinCondition: (gameState: GameState) => Player | null;
  getValidMoves: (playerId: string, gameState: GameState) => GameAction[];
}

export interface GameTimer {
  isRunning: boolean;
  startedAt?: string; // timestamp when timer started
  timeRemaining?: number; // seconds remaining
  totalTime?: number; // total time allocated for this phase
  playersOnClock: string[]; // which players are currently on the clock
}

export interface DisplayState {
  selectedPiece?: SelectedPiece;
  highlightedCells?: HighlightedCell[];
  animations?: Animation[];
  uiMode: 'normal' | 'selecting' | 'confirming' | 'waiting';
}

// ============================================================================
// TURN DATA (CANONICAL - uses typed imports)
// ============================================================================

/**
 * TurnData - Current turn state
 * 
 * ARCHITECTURAL ALIGNMENT:
 * - currentMajorPhase: Uses MajorPhase enum from GamePhases
 * - currentStep: Uses BuildPhaseStep | BattlePhaseStep unions
 * - triggeredEffects: Uses QueuedEffect[] from ShipTypes (canonical effect type)
 * - battleCommitments: Uses BattleCommitmentState from BattleTypes
 * - NO UNKNOWN TYPES for core engine fields
 */
export interface TurnData {
  turnNumber: number;
  
  // ✅ TYPED: Phase state using canonical enums
  currentMajorPhase: MajorPhase; // Enum: build_phase | battle_phase | end_of_turn_resolution | end_of_game
  currentStep: BuildPhaseStep | BattlePhaseStep | null; // Typed union of phase steps
  
  // Dice state
  diceRoll?: number;
  diceManipulationFinalized?: boolean;
  
  // ✅ TYPED: End of Turn Resolution effects
  triggeredEffects: TriggeredEffect[]; // Canonical effect queue (from EffectTypes)
  
  // ✅ TYPED: Battle Phase commitment state
  battleCommitments?: BattleCommitmentState; // Hidden actions until reveal (from BattleTypes)
  
  // Turn-scoped modifiers (Science Vessel, etc.)
  modifiers?: {
    [playerId: string]: {
      double_automatic_damage?: boolean;
      double_automatic_healing?: boolean;
      [key: string]: boolean | number | string | undefined;
    };
  };
  
  // Solar powers used this turn (for Cube to repeat)
  solarPowersUsed?: {
    [playerId: string]: string[]; // Solar power IDs
  };
  
  // ============================================================================
  // DEPRECATED FIELDS (for migration compatibility)
  // ============================================================================
  
  /**
   * @deprecated Use triggeredEffects with QueuedEffect type
   */
  accumulatedDamage?: { [playerId: string]: number };
  
  /**
   * @deprecated Use triggeredEffects with QueuedEffect type
   */
  accumulatedHealing?: { [playerId: string]: number };
  
  /**
   * @deprecated Tracked in Player.health
   */
  healthAtTurnStart?: { [playerId: string]: number };
  
  /**
   * @deprecated Use triggeredEffects with QueuedEffect type
   */
  onceOnlyAutomaticEffects?: { shipId: string; effectType: string }[];
  
  /**
   * @deprecated Continuous effects evaluated directly by EndOfTurnResolver
   */
  continuousAutomaticShips?: string[];
  
  /**
   * @deprecated Use battleCommitments.declaration
   */
  chargeDeclarations?: unknown[];
  
  /**
   * @deprecated Use battleCommitments.response
   */
  solarPowerDeclarations?: unknown[];
  
  // Chronoswarm tracking
  chronoswarmExtraPhaseCount?: number; // How many extra build phases triggered this turn
}

// ============================================================================
// RE-EXPORTS (for convenience)
// ============================================================================

// Re-export phase enums so consumers can import from GameTypes
export type { MajorPhase, BuildPhaseStep, BattlePhaseStep };
export type { TriggeredEffect };
export type { BattleCommitmentState };