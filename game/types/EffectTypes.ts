// ============================================================================
// EFFECT TYPES - CANONICAL SOURCE OF TRUTH
// ============================================================================
//
// This module defines ALL effect shapes used across the engine.
//
// ARCHITECTURAL RULES:
// 1. EffectKind = Single canonical enum for all effect types
// 2. Resolution models distinguish how effects are processed:
//    - TriggeredEffect: Persisted when created, queued for resolution
//    - EvaluatedEffect: Computed at end-of-turn from continuous powers
// 3. All effects resolve simultaneously in EndOfTurnResolver
// 4. Health changes ONLY in EndOfTurnResolver
//
// INVARIANTS:
// - Triggered effects persist even if source destroyed (if flag set)
// - Evaluated effects require source ship survival at resolution time
// - All effects have stable IDs for tracking/debugging
// - Effect values are resolved before enqueueing (no lazy evaluation)
//
// ============================================================================

// ============================================================================
// TYPE ALIASES
// ============================================================================

export type EffectId = string;
export type PlayerId = string;
export type ShipInstanceId = string;
export type ShipDefId = string;
export type EffectValue = number;

// ============================================================================
// EFFECT KIND - CANONICAL ENUM
// ============================================================================

/**
 * EffectKind - Single source of truth for all effect types
 * 
 * Replaces:
 * - PowerEffectType (ShipTypes)
 * - EffectType (ActionTypes)
 * - Local effect type strings
 */
export enum EffectKind {
  // ============================================================================
  // HEALTH EFFECTS (resolve at end-of-turn)
  // ============================================================================
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  SET_HEALTH_MAX = 'SET_HEALTH_MAX',           // Set max health to specific value
  INCREASE_MAX_HEALTH = 'INCREASE_MAX_HEALTH', // Increase max health by amount
  
  // ============================================================================
  // RESOURCE EFFECTS
  // ============================================================================
  GAIN_LINES = 'GAIN_LINES',                   // Regular lines
  GAIN_JOINING_LINES = 'GAIN_JOINING_LINES',   // Centaur joining lines
  GAIN_ENERGY = 'GAIN_ENERGY',                 // Ancient energy (red/green/blue)
  
  // ============================================================================
  // SHIP MANIPULATION
  // ============================================================================
  BUILD_SHIP = 'BUILD_SHIP',         // Create a ship
  DESTROY_SHIP = 'DESTROY_SHIP',     // Destroy a ship
  STEAL_SHIP = 'STEAL_SHIP',         // Steal opponent's ship
  COPY_SHIP = 'COPY_SHIP',           // Copy ship definition
  
  // ============================================================================
  // DICE MANIPULATION
  // ============================================================================
  DICE_REROLL = 'DICE_REROLL',             // Reroll the dice
  FORCE_DICE_VALUE = 'FORCE_DICE_VALUE',   // Set dice to specific value
  
  // ============================================================================
  // COMPLEX/COMPUTED EFFECTS
  // ============================================================================
  COUNT_AND_DAMAGE = 'COUNT_AND_DAMAGE',   // Count ships, deal damage
  COUNT_AND_HEAL = 'COUNT_AND_HEAL',       // Count ships, heal
  
  // ============================================================================
  // META EFFECTS
  // ============================================================================
  CONDITIONAL = 'CONDITIONAL',   // Conditional effect (requires evaluation)
  PASSIVE = 'PASSIVE',           // Passive modifier (handled by PassiveModifiers)
  CUSTOM = 'CUSTOM'              // Custom effect (requires special handling)
}

// ============================================================================
// ENERGY COLOR (for GAIN_ENERGY effects)
// ============================================================================

export type EnergyColor = 'red' | 'green' | 'blue' | 'all';

// ============================================================================
// SOURCE & TARGET IDENTIFICATION
// ============================================================================

/**
 * EffectSource - Where the effect originates
 * 
 * Identity fields:
 * - sourcePlayerId: Always required
 * - sourceShipInstanceId: PlayerShip.id (unique instance)
 * - sourceShipDefId: PlayerShip.shipId (definition ID like "WED")
 * - sourcePowerIndex: Which power on the ship (0-based)
 * - sourceType: Classification for UI/logging
 */
export interface EffectSource {
  sourcePlayerId: PlayerId;
  sourceShipInstanceId?: ShipInstanceId;  // Ship instance that created effect
  sourceShipDefId?: ShipDefId;            // Ship definition ID (for display)
  sourcePowerIndex?: number;              // Which power (0-based)
  sourceType?: 'ship_power' | 'solar_power' | 'charge_power' | 'system';
}

/**
 * EffectTarget - Where the effect applies
 * 
 * Identity fields:
 * - targetPlayerId: Always required
 * - targetShipInstanceId: Optional (for ship-targeting effects)
 */
export interface EffectTarget {
  targetPlayerId: PlayerId;
  targetShipInstanceId?: ShipInstanceId;  // Specific ship target (optional)
}

// ============================================================================
// BASE EFFECT INTERFACE
// ============================================================================

/**
 * BaseEffect - Common fields for all effects
 * 
 * All effects share:
 * - Unique ID (for tracking/debugging)
 * - Kind (what type of effect)
 * - Value (amount of effect)
 * - Source (who/what created it)
 * - Target (who/what receives it)
 * - Metadata (description, timestamp)
 */
export interface BaseEffect {
  // ============================================================================
  // IDENTITY
  // ============================================================================
  id: EffectId;                    // Unique identifier
  kind: EffectKind;                // What type of effect
  
  // ============================================================================
  // VALUE
  // ============================================================================
  value?: EffectValue;             // Amount (damage, healing, lines, etc.)
  energyColor?: EnergyColor;       // For GAIN_ENERGY effects
  
  // ============================================================================
  // SOURCE & TARGET
  // ============================================================================
  source: EffectSource;            // Where effect comes from
  target: EffectTarget;            // Where effect applies
  
  // ============================================================================
  // METADATA
  // ============================================================================
  description: string;             // Human-readable description (UI/logging)
  createdAt: number;               // Timestamp (Date.now())
}

// ============================================================================
// TRIGGERED EFFECT (Persisted & Queued)
// ============================================================================

/**
 * TriggeredEffect - Effect created during the turn and queued for resolution
 * 
 * CHARACTERISTICS:
 * - Created when power is used (charges, solar powers, once-only effects)
 * - Persisted in gameState.gameData.turnData.triggeredEffects
 * - May resolve even if source ship destroyed (based on persistsIfSourceDestroyed)
 * - Value is computed when effect is created (not at resolution time)
 * 
 * EXAMPLES:
 * - Charge power damage (persists even if ship destroyed)
 * - Solar power healing (persists even if ship destroyed)
 * - Once-only automatic effects (persist if triggered)
 * 
 * RESOLUTION:
 * - EndOfTurnResolver applies all triggered effects simultaneously
 * - Checks persistsIfSourceDestroyed flag before applying
 */
export interface TriggeredEffect extends BaseEffect {
  resolution: 'triggered';
  
  /**
   * Does this effect resolve even if source ship is destroyed?
   * 
   * true = Always resolves (charges, solar powers, once-only)
   * false = Only resolves if source ship survives (should not be triggered; use EvaluatedEffect)
   */
  persistsIfSourceDestroyed: boolean;
}

// ============================================================================
// EVALUATED EFFECT (Computed at Resolution)
// ============================================================================

/**
 * EvaluatedEffect - Effect computed at end-of-turn from continuous powers
 * 
 * CHARACTERISTICS:
 * - NOT persisted in gameState (computed fresh each turn)
 * - Requires source ship to be alive at resolution time
 * - Value computed at resolution time (based on current game state)
 * - May require unchanged ownership (for stolen ships)
 * 
 * EXAMPLES:
 * - Continuous automatic damage (Wedge: 1 damage per turn)
 * - Continuous automatic healing (Science Vessel: 2 healing per turn)
 * - Count-based effects (Counter: damage = own ships × 2)
 * 
 * RESOLUTION:
 * - EndOfTurnResolver evaluates continuous powers from surviving ships
 * - Creates EvaluatedEffect instances at resolution time
 * - Applies alongside TriggeredEffects simultaneously
 */
export interface EvaluatedEffect extends BaseEffect {
  resolution: 'evaluated';
  
  /**
   * Effect only applies if source ship is alive
   * (Always true for evaluated effects)
   */
  requiresShipAlive: true;
  
  /**
   * Effect only applies if ship ownership unchanged
   * (Optional - used for stolen ships that shouldn't help original owner)
   */
  requiresOwnershipUnchanged?: boolean;
}

// ============================================================================
// UNION TYPE
// ============================================================================

/**
 * AnyEffect - Union of all effect types
 */
export type AnyEffect = TriggeredEffect | EvaluatedEffect;

// ============================================================================
// QUEUED EFFECT (Alias for TriggeredEffect)
// ============================================================================

/**
 * QueuedEffect - Effects queued for end-of-turn resolution
 * 
 * This is an alias for TriggeredEffect.
 * Used by PowerExecutor and ActionResolver to enqueue effects.
 * 
 * USAGE:
 * - Create QueuedEffect when power is used
 * - Append to gameState.gameData.turnData.triggeredEffects
 * - EndOfTurnResolver processes queue at end-of-turn
 */
export type QueuedEffect = TriggeredEffect;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique effect ID
 */
export function generateEffectId(
  source: EffectSource,
  kind: EffectKind,
  turnNumber: number,
  index: number = 0
): EffectId {
  const shipPart = source.sourceShipInstanceId || 'system';
  const powerPart = source.sourcePowerIndex !== undefined ? `-p${source.sourcePowerIndex}` : '';
  return `effect-${shipPart}${powerPart}-${kind}-t${turnNumber}-${index}`;
}

/**
 * Create effect targeting opponent
 */
export function createOpponentTarget(
  sourcePlayerId: PlayerId,
  allPlayers: { id: PlayerId; role: string }[]
): EffectTarget {
  const opponent = allPlayers.find(p => p.role === 'player' && p.id !== sourcePlayerId);
  return {
    targetPlayerId: opponent?.id || sourcePlayerId  // Fallback to self if no opponent
  };
}

/**
 * Create effect targeting self
 */
export function createSelfTarget(sourcePlayerId: PlayerId): EffectTarget {
  return {
    targetPlayerId: sourcePlayerId
  };
}

/**
 * Create triggered effect helper
 */
export function createTriggeredEffect(params: {
  id: EffectId;
  kind: EffectKind;
  value?: EffectValue;
  energyColor?: EnergyColor;
  source: EffectSource;
  target: EffectTarget;
  description: string;
  persistsIfSourceDestroyed: boolean;
}): TriggeredEffect {
  return {
    ...params,
    resolution: 'triggered' as const,
    createdAt: Date.now()
  };
}

/**
 * Create evaluated effect helper
 */
export function createEvaluatedEffect(params: {
  id: EffectId;
  kind: EffectKind;
  value?: EffectValue;
  energyColor?: EnergyColor;
  source: EffectSource;
  target: EffectTarget;
  description: string;
  requiresOwnershipUnchanged?: boolean;
}): EvaluatedEffect {
  return {
    ...params,
    resolution: 'evaluated' as const,
    requiresShipAlive: true as const,
    createdAt: Date.now()
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for TriggeredEffect
 */
export function isTriggeredEffect(effect: AnyEffect): effect is TriggeredEffect {
  return effect.resolution === 'triggered';
}

/**
 * Type guard for EvaluatedEffect
 */
export function isEvaluatedEffect(effect: AnyEffect): effect is EvaluatedEffect {
  return effect.resolution === 'evaluated';
}

// ============================================================================
// COMPATIBILITY NOTES
// ============================================================================

/**
 * MIGRATION FROM OLD TYPES:
 * 
 * PowerEffectType (ShipTypes) → EffectKind
 * - DEAL_DAMAGE → DAMAGE
 * - HEAL → HEAL
 * - GAIN_LINES → GAIN_LINES
 * - GAIN_JOINING_LINES → GAIN_JOINING_LINES
 * - GAIN_ENERGY → GAIN_ENERGY
 * - BUILD_SHIP → BUILD_SHIP
 * - DESTROY_SHIP → DESTROY_SHIP
 * - COPY_SHIP → COPY_SHIP
 * - REROLL_DICE → DICE_REROLL
 * - SET_HEALTH_MAX → SET_HEALTH_MAX
 * - INCREASE_MAX_HEALTH → INCREASE_MAX_HEALTH
 * - COUNT_AND_DAMAGE → COUNT_AND_DAMAGE
 * - COUNT_AND_HEAL → COUNT_AND_HEAL
 * - CONDITIONAL → CONDITIONAL
 * - PASSIVE → PASSIVE
 * - CUSTOM → CUSTOM
 * 
 * EffectType (ActionTypes) → EffectKind
 * - Same mapping as above
 * 
 * OLD FIELD NAMES → NEW FIELD NAMES:
 * - sourceShipId → sourceShipDefId (definition ID)
 * - sourceShipInstanceId → sourceShipInstanceId (no change)
 * - persistsIfDestroyed → persistsIfSourceDestroyed (more explicit)
 * - triggeredAt → createdAt (consistent naming)
 */
