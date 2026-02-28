// Battle Phase Commitment Types
// Implements simultaneous hidden declarations with exactly two windows max
//
// ARCHITECTURAL ALIGNMENT:
// - Uses canonical EffectKind and TriggeredEffect from EffectTypes
// - Uses explicit ship identity types (PlayerId, ShipDefId, ShipInstanceId)
// - Consistent powerIndex convention (1-based, matching ShipDefinitions)
// - Standardized timestamps (number = ms since epoch)
// - Clean commitment lifecycle with derived state
// - Uses canonical EnergyCost from SolarPowerTypes

import type { 
  EffectKind,
  TriggeredEffect,
  EvaluatedEffect,
  AnyEffect,
  PlayerId,
  ShipDefId,
  ShipInstanceId
} from './EffectTypes';

import type { EnergyCost } from './SolarPowerTypes';

// Re-export for backward compatibility
export type { TriggeredEffect as QueuedEffect } from './EffectTypes';

// ============================================================================
// HIDDEN BATTLE ACTIONS
// ============================================================================

/**
 * Hidden battle actions for a single player
 * Submitted secretly, revealed simultaneously
 */
export interface HiddenBattleActions {
  charges: ChargeDeclaration[];
  solarPowers: SolarDeclaration[];
}

// ============================================================================
// CHARGE DECLARATIONS
// ============================================================================

/**
 * Single charge declaration
 * 
 * POWER INDEX CONVENTION (CRITICAL):
 * - powerIndex is 1-BASED (matches ShipDefinitions data)
 * - First power = powerIndex 1, second power = powerIndex 2, etc.
 * - This convention is consistent across:
 *   - ShipDefinitions.powers[].powerIndex
 *   - ChargeDeclaration.powerIndex
 *   - PowerExecutor usage tracking
 * 
 * SHIP IDENTITY (CRITICAL):
 * - shipInstanceId: Unique instance (prevents "steal ship then wrong ship fires" bugs)
 * - shipDefId: Definition for logging/display
 */
export interface ChargeDeclaration {
  /**
   * Which ship instance's charge is being used
   * ✅ Instance ID (unique per ship instance)
   */
  shipInstanceId: ShipInstanceId;
  
  /**
   * Ship definition ID (for logging/display)
   * Optional but recommended for debugging
   */
  shipDefId?: ShipDefId;
  
  /**
   * Which power on that ship (1-BASED, matches ShipDefinitions)
   * 
   * ✅ CONVENTION: 1-based indexing
   * - First power = 1
   * - Second power = 2
   * - etc.
   */
  powerIndex: number;
  
  /**
   * When declared (for ordering/UI feedback)
   * ✅ Timestamp in milliseconds since epoch (performance + ordering)
   */
  timestamp: number;
}

// ============================================================================
// SOLAR POWER DECLARATIONS
// ============================================================================

/**
 * Single Solar Power declaration (Ancient species)
 * 
 * POWER INDEX CONVENTION:
 * - powerIndex is 1-BASED (matches ShipDefinitions)
 * - Solar powers stored in ShipDefinitions with same convention
 */
export interface SolarDeclaration {
  /**
   * Which solar power is being used
   * ✅ Instance ID (unique per solar power instance)
   */
  solarInstanceId: ShipInstanceId;
  
  /**
   * Solar power definition ID (for logging/display)
   * Examples: 'NOVA', 'FLARE', 'SIMULACRUM'
   */
  solarDefId?: ShipDefId;
  
  /**
   * Which power index (1-BASED)
   * Most solar powers have only one power (powerIndex: 1)
   */
  powerIndex: number;
  
  /**
   * Energy paid to activate this power
   * Note: Uses 'green' not 'pink' (pink dice is Chronoswarm, not energy)
   */
  energyCost: EnergyCost;
  
  /**
   * When declared (for ordering/UI feedback)
   * ✅ Timestamp in milliseconds since epoch
   */
  timestamp: number;
}

// ============================================================================
// BATTLE COMMITMENT STATE
// ============================================================================

/**
 * Complete Battle Phase commitment state
 * Owns all Battle Phase player intent
 * 
 * LIFECYCLE:
 * 1. Players submit declarations (hidden)
 * 2. Both ready → declarationRevealed = true
 * 3. If anyDeclarationsMade → Conditional Response window opens
 * 4. Players submit responses (hidden)
 * 5. Both ready → responseRevealed = true
 * 6. Proceed to End of Turn Resolution
 * 
 * DERIVED STATE:
 * - anyDeclarationsMade can be computed from declaration content
 *   (but stored for performance - avoids recomputation)
 */
export interface BattleCommitmentState {
  /**
   * First window: Simultaneous Declaration
   * Record<PlayerId, HiddenBattleActions>
   * 
   * Initially undefined, populated as players declare
   */
  declaration?: Record<PlayerId, HiddenBattleActions>;
  
  /**
   * Second window: Conditional Response
   * Record<PlayerId, HiddenBattleActions>
   * 
   * Only exists if anyDeclarationsMade = true
   * undefined if no declarations made (skip Response window)
   */
  response?: Record<PlayerId, HiddenBattleActions>;
  
  /**
   * Has declaration window been revealed?
   * false = still hidden, true = revealed to both players
   */
  declarationRevealed: boolean;
  
  /**
   * Has response window been revealed?
   * false = still hidden, true = revealed to both players
   * N/A if no response window (anyDeclarationsMade = false)
   */
  responseRevealed: boolean;
  
  /**
   * Were any declarations made?
   * Determines if Response window opens.
   * 
   * ✅ STORED (not derived) for performance
   * Could be computed as:
   *   Object.values(declaration || {}).some(actions => 
   *     actions.charges.length > 0 || actions.solarPowers.length > 0
   *   )
   * But stored to avoid recomputation on every render.
   */
  anyDeclarationsMade: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute if any declarations were made
 * Helper for deriving anyDeclarationsMade from declaration state
 */
export function hasAnyDeclarations(
  declaration?: Record<PlayerId, HiddenBattleActions>
): boolean {
  if (!declaration) return false;
  
  return Object.values(declaration).some(actions => 
    actions.charges.length > 0 || actions.solarPowers.length > 0
  );
}

/**
 * Create empty battle commitment state
 */
export function createEmptyBattleCommitmentState(): BattleCommitmentState {
  return {
    declaration: undefined,
    response: undefined,
    declarationRevealed: false,
    responseRevealed: false,
    anyDeclarationsMade: false
  };
}

// ============================================================================
// RE-EXPORTS (for convenience)
// ============================================================================

/**
 * Re-export canonical types for convenience
 * Consumers can import from BattleTypes without needing to import from EffectTypes
 */
export type { 
  TriggeredEffect,
  EvaluatedEffect,
  AnyEffect,
  EffectKind,
  PlayerId,
  ShipDefId,
  ShipInstanceId
} from './EffectTypes';