/**
 * Special Logic - DEPRECATED
 * 
 * STATUS: This file is being phased out.
 * 
 * MIGRATION PATH:
 * - Simple logic → Set power.kind in ShipDefinitions.engine.ts
 * - Complex logic → Move to ManualPowerOverrides.ts
 * - Passive logic → Already handled by PassiveModifiers.tsx
 * 
 * NEW ARCHITECTURE:
 * All power interpretation now routes through PowerResolver.ts which:
 * 1. Checks for effectAst (structured interpretation)
 * 2. Checks for kind (effect type classification)
 * 3. Checks for manual override (ManualPowerOverrides.ts)
 * 4. Falls back to NO-OP (graceful degradation)
 * 
 * DO NOT ADD NEW FUNCTIONS HERE.
 * This file will be deleted once all references are migrated.
 */

import type { GameState } from '../types/GameTypes';
import type { EngineShipPower } from '../types/ShipTypes.engine';
import type { PowerExecutionContext } from './PowerExecutor';

// ============================================================================
// DEPRECATED - DO NOT USE
// ============================================================================

/**
 * @deprecated Use PowerResolver instead
 * 
 * This class is maintained only for backward compatibility during migration.
 * All new ship powers should use PowerResolver's 4-path resolution model.
 */
export class SpecialLogic {
  
  /**
   * @deprecated Route to PowerResolver instead
   * 
   * Legacy routing function - kept for compatibility during migration.
   * Returns game state unchanged - actual logic should be in:
   * - ManualPowerOverrides.ts for complex ship-specific powers
   * - ShipDefinitions.engine.ts for simple powers (via kind)
   * - PassiveModifiers.tsx for passive effects
   */
  static executeCustomLogic(
    customLogicId: string,
    power: EngineShipPower,
    context: PowerExecutionContext
  ): GameState {
    
    console.warn(
      `[SpecialLogic] DEPRECATED: customLogicId "${customLogicId}" called. ` +
      `Migrate to PowerResolver/ManualPowerOverrides.`
    );
    
    // Return game state unchanged
    // The calling code should be updated to use PowerResolver instead
    return context.gameState;
  }
}

export default SpecialLogic;

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

/**
 * HOW TO MIGRATE SHIP-SPECIFIC LOGIC:
 * 
 * BEFORE (old SpecialLogic):
 * ```typescript
 * case 'frigate_conditional_damage':
 *   return this.handleFrigateConditionalDamage(power, context);
 * ```
 * 
 * AFTER (ManualPowerOverrides):
 * ```typescript
 * // In ManualPowerOverrides.ts
 * 'FRI_1': (power, context) => {
 *   const { ship, diceRoll } = context;
 *   if (diceRoll === ship.customState?.frigateTargetNumber) {
 *     return {
 *       effects: [createDamageEffect(6)],
 *       description: 'Frigate trigger hit!'
 *     };
 *   }
 *   return { effects: [] };
 * }
 * ```
 * 
 * BENEFITS:
 * - Single location for ship-specific logic
 * - Type-safe registration
 * - Clear separation from engine code
 * - Better testability
 * 
 * See /game/engine/documentation/PowerResolutionArchitecture.md for details.
 */
