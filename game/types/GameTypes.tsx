// Core game types for Shapeships
// This file defines all TypeScript interfaces and types used throughout the game

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
  subPhase: number;
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
// PLAYER & GAME STATE
// ============================================================================

export interface Player {
  id: string;
  name: string;
  faction: 'human' | 'xenite' | 'centaur' | 'ancient';
  isReady: boolean;
  isActive: boolean; // whose turn it is
  role: 'player' | 'spectator'; // Player role - spectators can watch but not play
  joinedAt: string;
  health?: number; // Current health (25 start, 35 max)
  lines?: number; // Current available lines
  savedLines?: number; // Lines saved from previous turns
  joiningLines?: number; // Current joining lines (Centaur species only - can only be used for upgrades)
  energy?: number; // Current energy (Ancient species only)
  ships?: PlayerShip[]; // Ships owned by this player
  copiedShips?: string[]; // IDs of ships copied from other species
  stolenShips?: string[]; // IDs of ships stolen from other species
}

// Ship instance owned by a player (references SpeciesData ships)
export interface PlayerShip {
  id: string; // Unique instance ID
  shipId: string; // References Ship.id from SpeciesData
  ownerId: string; // Player who owns this ship instance
  originalSpecies: string; // Original species, even if copied/stolen
  // Runtime state
  isDestroyed?: boolean;
  isConsumedInUpgrade?: boolean; // True if this ship was used to build an upgraded ship
  temporaryEffects?: TemporaryEffect[];
  // Charge tracking for ships with charge-based powers
  currentCharges?: number; // Current charges available
  maxCharges?: number; // Maximum charges this ship can hold
  // Ship-specific persistent state
  frigateTargetNumber?: number; // Frigate: chosen trigger number (1-6)
  // Position/zone information (visual display only, not stored in state)
  position?: ShipPosition;
  // Upgrade tracking
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

export interface GameAction {
  id: string;
  playerId: string;
  type: 'build_ship' | 'upgrade_ship' | 'build_ship_via_power' | 'save_lines' | 'use_dice_manipulation' | 'use_ship_building_power' | 'use_drawing_phase_power' | 'trigger_upon_completion_power' | 'use_end_build_phase_power' | 'use_first_strike_power' | 'declare_charge' | 'use_solar_power' | 'respond_with_charge' | 'respond_with_solar_power' | 'use_end_battle_phase_power' | 'declare_ready' | 'surrender';
  data: GameActionData;
  timestamp: string;
  validated?: boolean;
}

export interface GameState {
  gameId: string;
  status: 'waiting' | 'starting' | 'active' | 'paused' | 'completed';
  players: Player[];
  currentTurn: number;
  currentPlayerId: string;
  gameData: {
    board: BoardState;
    ships: { [playerId: string]: PlayerShip[] }; // ships organized by player
    resources: GameResources;
    turnData?: TurnData; // From GamePhases - current turn state
    phaseReadiness?: PhaseReadiness[]; // player readiness for current phase
    combatActions?: CombatAction[]; // actions that require combat resolution
    timer?: GameTimer; // timer state for current phase
    victoryType?: string; // Type of victory when game ends
    // Species selection and copying/stealing tracking
    speciesSelected?: boolean;
    crossSpeciesShips?: { [playerId: string]: { copied: string[], stolen: string[] } };
  };
  actions: GameAction[];
  settings: GameSettings;
  createdAt: string;
  lastUpdated: string;
}

export interface GameSettings {
  maxPlayers: number;
  turnTimeLimit?: number; // seconds
  boardSize?: string; // will be defined based on your rules
  gameVariant?: string; // different game modes
}

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
// RE-EXPORT TurnData from GamePhases (avoid circular dependency)
// ============================================================================

// This will be properly imported from GamePhases, but we define the interface here
// to avoid circular dependencies
export interface TurnData {
  turnNumber: number;
  currentMajorPhase: string; // MajorPhase enum value
  currentSubPhase: number; // SubPhase enum value
  requiredSubPhases: unknown[]; // SubPhaseRequirement[] - avoid circular dep
  diceRoll?: number;
  linesDistributed?: boolean;
  accumulatedDamage: { [playerId: string]: number };
  accumulatedHealing: { [playerId: string]: number };
  healthAtTurnStart: { [playerId: string]: number };
  chargesDeclared: boolean;
}