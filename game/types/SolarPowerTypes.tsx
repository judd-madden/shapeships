// Solar Power Types
// Solar powers are Ancient species abilities cast during Battle Phase
// They enqueue effects for EndOfTurnResolution
//
// ARCHITECTURAL ALIGNMENT:
// - Uses canonical ResolvedEffectType and QueuedEffect from EffectTypes
// - Uses explicit ship identity types (PlayerId, ShipDefId, ShipInstanceId)
// - Standardized energy system (red/green/blue, matching GameTypes)
// - Clear targeting model
// - Integrates with QueuedEffect resolution
//
// SURVIVAL INDEPENDENCE (CRITICAL):
// Once a Solar Power is declared:
// ✅ Effect resolves even if caster loses all ships
// ✅ Must not be invalidated by destruction, surrender, or board state changes
// ✅ Enqueued TriggeredEffect persists to End of Turn Resolution

import type { 
  PlayerId,
  ShipDefId,
  ShipInstanceId,
  PowerEffectType,
  SpecialLogic
} from './ShipTypes.core';
import type {
  QueuedEffect
} from './EffectTypes';

// Backward compatibility
export type ResolvedEffectType = PowerEffectType;

// ============================================================================
// SOLAR POWER IDS (Finite Set)
// ============================================================================

/**
 * Solar Power IDs - Known Ancient solar powers
 * 
 * ✅ Type-safe solar power references
 */
export type SolarPowerId = 
  | 'SAST'          // Asteroid: Red energy, deal damage (dice-based)
  | 'SLIF'          // Life: Green energy, healing
  | 'SSIM'          // Simulacrum: Blue energy, copy opponent ship
  | 'SBLA'          // Black Hole: Red energy, destroy ship
  | 'SZEN';         // Zenith: Green energy, triggered on destruction

// Helper type brands for additional type safety
export type BrandedSolarPowerId = SolarPowerId & { readonly __brand: 'SolarPower' };

// ============================================================================
// ENERGY SYSTEM (Canonical)
// ============================================================================

/**
 * Energy cost/payment structure
 * ✅ CANONICAL: Matches GameTypes Player.energy (red/green/blue)
 * ❌ DO NOT use 'pink' - that's Chronoswarm dice color, not energy
 */
export interface EnergyCost {
  red?: number;
  green?: number;
  blue?: number;
}

/**
 * Energy color type
 */
export type EnergyColor = 'red' | 'green' | 'blue';

/**
 * Energy state (current available energy)
 */
export interface EnergyState {
  red: number;
  green: number;
  blue: number;
}

// ============================================================================
// TARGETING MODEL
// ============================================================================

/**
 * Targeting specification for solar powers
 * ✅ EXPLICIT: No ambiguous optional fields
 */
export type SolarTargeting = 
  | { kind: 'none' }                                          // No target needed (e.g., dice-based damage)
  | { kind: 'self', scope: 'player' }                         // Self player (e.g., Life healing)
  | { kind: 'self', scope: 'ship' }                           // Own ship (e.g., sacrifice effects)
  | { kind: 'opponent', scope: 'player' }                     // Opponent player (e.g., Asteroid damage)
  | { kind: 'opponent', scope: 'ship' }                       // Opponent ship (e.g., Simulacrum copy)
  | { kind: 'any', scope: 'ship' };                           // Any ship (self or opponent)

/**
 * Target selection requirement
 */
export interface TargetRequirement {
  /**
   * Does this power require the player to select a target?
   */
  requiresTargetSelection: boolean;
  
  /**
   * What can be targeted?
   */
  targeting: SolarTargeting;
  
  /**
   * Additional constraints on target selection
   */
  constraints?: {
    basicOnly?: boolean;        // Can only target basic ships
    upgradedOnly?: boolean;     // Can only target upgraded ships
    mustMatchCost?: boolean;    // Must match specific cost (Simulacrum)
    maxTargets?: number;        // Max number of targets (default 1)
    excludeSelf?: boolean;      // Exclude the caster from targeting
  };
}

// ============================================================================
// SOLAR EFFECT TYPES (TYPE CONSTRAINT)
// ============================================================================

/**
 * Valid effect types for Solar Powers
 * Restrict to TriggeredEffect-producing types only
 */
export type SolarPowerEffectType = 
  | PowerEffectType.DEAL_DAMAGE      // Asteroid
  | PowerEffectType.HEAL             // Life
  | PowerEffectType.BUILD_SHIP       // Hypothetical
  | PowerEffectType.DESTROY_SHIP     // Black Hole
  | PowerEffectType.COPY_SHIP        // Simulacrum
  | PowerEffectType.CUSTOM;          // Complex logic

// ============================================================================
// SOLAR POWER EFFECT
// ============================================================================

/**
 * Solar power effect definition
 * Maps to QueuedEffect for resolution
 */
export interface SolarPowerEffect {
  /**
   * Effect type (constrained to solar-compatible types)
   */
  type: SolarPowerEffectType;
  
  /**
   * Effect value
   * Can be:
   * - Static number: 10 damage
   * - 'dice_roll': Use current dice roll
   * - 'dice_roll_plus_4': Dice + 4 (e.g., Asteroid)
   * - 'dice_roll_plus_5': Dice + 5
   */
  value: number | 'dice_roll' | 'dice_roll_plus_4' | 'dice_roll_plus_5';
  
  /**
   * Description template (for logging/UI)
   */
  description: string;
}

// ============================================================================
// SOLAR POWER DEFINITION
// ============================================================================

/**
 * Complete solar power definition
 * Defines Ancient species solar powers
 */
export interface SolarPowerDefinition {
  /**
   * Unique solar power ID
   */
  id: SolarPowerId;
  
  /**
   * Display name
   */
  name: string;
  
  /**
   * Energy cost to cast (AUTHORITATIVE)
   * ✅ CANONICAL: red/green/blue (matches GameTypes)
   * 
   * Energy is deducted at declaration time
   * DO NOT double-charge or infer cost elsewhere
   */
  energyCost: {
    red?: number;
    green?: number;
    blue?: number;
    /**
     * Variable cost (Simulacrum only)
     * X blue energy = target ship's line cost
     */
    variable?: 'ship_line_cost';
  };
  
  /**
   * Effect(s) that will be queued
   */
  effect: SolarPowerEffect;
  
  /**
   * Targeting requirements (NEW)
   * ✅ Explicit targeting model
   */
  targetRequirement?: TargetRequirement;
  
  /**
   * Special logic (for complex behaviors)
   */
  specialLogic?: SpecialLogic;
  
  /**
   * Full description (for tooltips/help)
   */
  description?: string;
  
  /**
   * Rules clarifications
   */
  rulesNotes?: string;
}

// ============================================================================
// SOLAR POWER EXECUTION
// ============================================================================

/**
 * Context for executing a solar power (AUTHORITATIVE)
 * Provides all data needed to queue effects
 * 
 * Use SolarPowerExecutionContext for:
 * ✅ Validation (can this Solar be cast?)
 * ✅ Targeting (who/what is affected?)
 * ✅ Dice-based effects (Asteroid damage)
 * ✅ Effect creation (build TriggeredEffect/QueuedEffect)
 * 
 * DO NOT reach into global state beyond this context.
 */
export interface SolarPowerExecutionContext {
  /**
   * Solar power being executed
   */
  solarPower: SolarPowerDefinition;
  
  /**
   * Player casting the solar power
   */
  casterId: PlayerId;
  
  /**
   * Opponent player
   */
  opponentId?: PlayerId;
  
  /**
   * Current turn number (NEW)
   */
  currentTurn?: number;
  
  /**
   * Energy being spent
   */
  energySpent: EnergyState;
  
  /**
   * Selected target (if requiresTargetSelection = true)
   */
  target?: {
    playerId: PlayerId;
    shipInstanceId?: ShipInstanceId;
    shipDefId?: ShipDefId;
  };
  
  /**
   * Legacy target fields (for backward compatibility)
   * @deprecated Use target.playerId instead
   */
  targetPlayerId?: string;
  
  /**
   * @deprecated Use target.shipInstanceId instead
   */
  targetShipId?: string;
  
  /**
   * Current dice roll (for dice-based solars like Asteroid)
   */
  currentDiceRoll: number;
  
  /**
   * Timestamp for effect ordering (NEW)
   * Used as seed for queuedEffectId generation
   */
  timestamp?: number;
  
  /**
   * Ship line cost (for variable energy costs - Simulacrum)
   * Simulacrum: Copy ship costs same as original ship line cost
   */
  shipLineCost?: number;
}

// ============================================================================
// SOLAR POWER EXECUTION RESULT
// ============================================================================

/**
 * Result of executing a solar power
 * Returns QueuedEffect[] for TurnData.triggeredEffects
 * 
 * ✅ Uses canonical QueuedEffect
 */
export interface SolarPowerExecutionResult {
  success: boolean;
  error?: string;
  
  /**
   * Effects queued to TurnData.triggeredEffects
   * ✅ Canonical QueuedEffect from ShipTypes
   */
  queuedEffects: QueuedEffect[];
  
  /**
   * Energy consumed (for validation)
   */
  energyConsumed: EnergyCost;
  
  /**
   * Description of what happened (for battle log)
   */
  description?: string;
}

// ============================================================================
// SOLAR POWER VALIDATION
// ============================================================================

/**
 * Validation result for solar power casting
 */
export interface SolarPowerValidation {
  canCast: boolean;
  reason?: string;
  insufficientEnergy?: {
    red?: number;
    green?: number;
    blue?: number;
  };
  invalidTarget?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if player has sufficient energy
 */
export function hasEnoughEnergy(
  available: EnergyState,
  cost: EnergyCost
): boolean {
  return (
    available.red >= (cost.red || 0) &&
    available.green >= (cost.green || 0) &&
    available.blue >= (cost.blue || 0)
  );
}

/**
 * Subtract energy cost from available energy
 */
export function subtractEnergy(
  available: EnergyState,
  cost: EnergyCost
): EnergyState {
  return {
    red: available.red - (cost.red || 0),
    green: available.green - (cost.green || 0),
    blue: available.blue - (cost.blue || 0)
  };
}

/**
 * Add energy to available energy
 */
export function addEnergy(
  available: EnergyState,
  gain: EnergyCost
): EnergyState {
  return {
    red: available.red + (gain.red || 0),
    green: available.green + (gain.green || 0),
    blue: available.blue + (gain.blue || 0)
  };
}

/**
 * Get total energy across all colors
 */
export function getTotalEnergy(energy: EnergyState): number {
  return energy.red + energy.green + energy.blue;
}

/**
 * Format energy cost for display
 */
export function formatEnergyCost(cost: EnergyCost): string {
  const parts: string[] = [];
  if (cost.red) parts.push(`${cost.red} red`);
  if (cost.green) parts.push(`${cost.green} green`);
  if (cost.blue) parts.push(`${cost.blue} blue`);
  return parts.join(', ');
}

// ============================================================================
// RE-EXPORTS (for convenience)
// ============================================================================

/**
 * Re-export canonical types for convenience
 */
export type { 
  QueuedEffect,
  ResolvedEffectType,
  PlayerId,
  ShipDefId,
  ShipInstanceId,
  PowerEffectType,
  SpecialLogic
};