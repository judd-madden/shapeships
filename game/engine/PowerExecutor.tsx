/**
 * Power Executor - ORCHESTRATOR FOR SHIP POWER EXECUTION
 * 
 * REFACTORED ARCHITECTURE:
 * This file is now an ORCHESTRATOR, not an interpreter.
 * 
 * RESPONSIBILITIES:
 * 1. Manage charge spending
 * 2. Track power usage (once-only)
 * 3. Route to PowerResolver for interpretation
 * 4. Enqueue effects into TurnData
 * 5. Apply immediate state mutations (non-health)
 * 
 * NOT RESPONSIBLE FOR:
 * ❌ Parsing power text
 * ❌ Ship-specific branching
 * ❌ Effect type switching
 * ❌ Interpreting power logic
 * 
 * All power interpretation delegated to PowerResolver.
 */

import type { GameState, PlayerShip } from '../types/GameTypes';
import type { 
  ShipDefId,
  ShipInstanceId,
  EngineShipPower
} from '../types/ShipTypes.engine';
import {
  PowerTiming,
  ShipPowerPhase 
} from '../types/ShipTypes.engine';
import { getShipById } from '../data/ShipDefinitions.engine';
import type { TriggeredEffect } from '../types/EffectTypes'; // LEGACY EFFECTS — migrate to /game/engine/effects/ when touching this file
import { 
  resolveShipPower, 
  type PowerResolutionContext,
  type PowerResolutionResult 
} from './PowerResolver';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface PowerExecutionContext {
  gameState: GameState;
  ship: PlayerShip;
  ownerId: string;
  opponentId: string;
  currentPhase: ShipPowerPhase;
  currentTurn: number;
  diceRoll?: number;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface PowerExecutionResult {
  /** Updated game state */
  gameState: GameState;
  
  /** Whether player choice is required */
  needsPlayerChoice?: {
    powerType: 'DESTROY_SHIP' | 'STEAL_SHIP' | 'COPY_SHIP' | 'BUILD_SHIP' | 'OTHER';
    power: EngineShipPower;
    ship: PlayerShip;
    context: PowerExecutionContext;
  };
  
  /** Effects that were enqueued */
  enqueuedEffects?: TriggeredEffect[];
  
  /** Resolution warnings (dev-only) */
  warnings?: string[];
}

// ============================================================================
// MAIN EXECUTOR CLASS
// ============================================================================

export class PowerExecutor {
  
  /**
   * Execute a ship power
   * ORCHESTRATOR ROLE: Manages charges, tracks usage, routes to resolver
   * 
   * @param power - The power to execute
   * @param context - Execution context
   * @returns Execution result with updated state
   */
  static executePower(
    power: EngineShipPower,
    context: PowerExecutionContext
  ): PowerExecutionResult {
    
    let gameState = context.gameState;
    const warnings: string[] = [];
    
    // Check if power should execute based on timing
    if (!this.shouldExecutePower(power, context)) {
      return { gameState };
    }
    
    // Check charge requirements
    if (power.requiresCharge) {
      const chargesRequired = power.chargesRequired || 1;
      const ship = context.ship;
      
      if ((ship.chargesRemaining || 0) < chargesRequired) {
        warnings.push(
          `Insufficient charges for ${ship.shipId} power ${power.powerIndex}: ` +
          `need ${chargesRequired}, have ${ship.chargesRemaining || 0}`
        );
        return { gameState, warnings };
      }
      
      // Spend charges
      gameState = this.spendCharges(gameState, ship.id, context.ownerId, chargesRequired);
    }
    
    // Create resolution context
    const resolutionContext: PowerResolutionContext = {
      gameState,
      ship: context.ship,
      ownerId: context.ownerId,
      opponentId: context.opponentId,
      currentPhase: context.currentPhase,
      currentTurn: context.currentTurn,
      diceRoll: context.diceRoll
    };
    
    // DELEGATE TO POWER RESOLVER (the actual interpreter)
    const resolution = resolveShipPower(power, resolutionContext);
    
    // Handle resolution result
    let finalState = gameState;
    let enqueuedEffects: TriggeredEffect[] = [];
    
    // Apply immediate state mutations (non-health changes)
    if (resolution.stateMutations) {
      finalState = resolution.stateMutations as GameState;
    }
    
    // Enqueue effects for end-of-turn resolution
    if (resolution.effects.length > 0) {
      finalState = this.enqueueEffects(finalState, resolution.effects);
      enqueuedEffects = resolution.effects;
    }
    
    // Track once-only power usage
    if (power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC) {
      finalState = this.markPowerAsUsed(
        finalState,
        context.ship.id,
        power.powerIndex,
        context.currentTurn
      );
    }
    
    // Collect warnings
    if (resolution.warnings) {
      warnings.push(...resolution.warnings);
    }
    
    // Handle player choice requirements
    if (resolution.requiresChoice) {
      return {
        gameState: finalState,
        needsPlayerChoice: {
          powerType: this.getPowerChoiceType(power),
          power,
          ship: context.ship,
          context: { ...context, gameState: finalState }
        },
        enqueuedEffects,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    }
    
    return {
      gameState: finalState,
      enqueuedEffects,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  /**
   * Execute multiple powers in sequence
   */
  static executePowers(
    powers: EngineShipPower[],
    context: PowerExecutionContext
  ): PowerExecutionResult {
    
    let gameState = context.gameState;
    let needsPlayerChoice;
    const allEnqueuedEffects: TriggeredEffect[] = [];
    const allWarnings: string[] = [];
    
    for (const power of powers) {
      // Update context with latest game state
      const updatedContext = { ...context, gameState };
      const result = this.executePower(power, updatedContext);
      
      gameState = result.gameState;
      
      if (result.enqueuedEffects) {
        allEnqueuedEffects.push(...result.enqueuedEffects);
      }
      
      if (result.warnings) {
        allWarnings.push(...result.warnings);
      }
      
      // If power needs player choice, stop here
      if (result.needsPlayerChoice) {
        needsPlayerChoice = result.needsPlayerChoice;
        break;
      }
    }
    
    return {
      gameState,
      needsPlayerChoice,
      enqueuedEffects: allEnqueuedEffects.length > 0 ? allEnqueuedEffects : undefined,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }
  
  // ============================================================================
  // TIMING CHECKS
  // ============================================================================
  
  /**
   * Check if a power should execute based on timing rules
   */
  private static shouldExecutePower(
    power: EngineShipPower,
    context: PowerExecutionContext
  ): boolean {
    const { ship, currentPhase, gameState } = context;
    
    // Check phase alignment
    if (power.phase !== currentPhase) {
      return false;
    }
    
    // Check if ship is alive
    if (ship.isDestroyed || ship.isConsumedInUpgrade) {
      return false;
    }
    
    // Check timing constraints
    switch (power.timing) {
      case PowerTiming.CONTINUOUS:
        // CONTINUOUS powers in AUTOMATIC phase are handled by EndOfTurnResolver
        // They're evaluated, not executed
        if (power.phase === ShipPowerPhase.AUTOMATIC) {
          return false;
        }
        return true;
        
      case PowerTiming.ONCE_ONLY_AUTOMATIC:
        // Check if already used
        return !this.hasUsedPower(ship, power.powerIndex, gameState);
        
      case PowerTiming.UPON_DESTRUCTION:
        // Only executes when ship is destroyed (handled separately)
        return false;
        
      case PowerTiming.PASSIVE:
        // Passive powers don't execute, they're queried
        return false;
        
      default:
        return true;
    }
  }
  
  /**
   * Check if a ship has already used a specific power
   */
  private static hasUsedPower(
    ship: PlayerShip,
    powerIndex: number,
    gameState: GameState
  ): boolean {
    const onceOnlyEffects = gameState.gameData.turnData?.onceOnlyAutomaticEffects || [];
    return onceOnlyEffects.some(effect =>
      effect.shipId === ship.id &&
      effect.effectType === `power_${powerIndex}`
    );
  }
  
  // ============================================================================
  // CHARGE MANAGEMENT
  // ============================================================================
  
  /**
   * Spend charges from a ship
   */
  private static spendCharges(
    gameState: GameState,
    shipInstanceId: ShipInstanceId,
    ownerId: string,
    amount: number
  ): GameState {
    const ships = gameState.gameData.ships || {};
    const ownerShips = ships[ownerId] || [];
    
    const updatedShips = ownerShips.map(ship => {
      if (ship.id !== shipInstanceId) return ship;
      
      const currentCharges = ship.chargesRemaining || 0;
      return {
        ...ship,
        chargesRemaining: Math.max(0, currentCharges - amount)
      };
    });
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        ships: {
          ...ships,
          [ownerId]: updatedShips
        }
      }
    };
  }
  
  // ============================================================================
  // EFFECT ENQUEUEING
  // ============================================================================
  
  /**
   * Enqueue effects into TurnData for end-of-turn resolution
   */
  private static enqueueEffects(
    gameState: GameState,
    effects: TriggeredEffect[]
  ): GameState {
    const turnData = gameState.gameData.turnData || {
      triggeredEffects: [],
      evaluatedEffects: [],
      onceOnlyAutomaticEffects: []
    };
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          triggeredEffects: [
            ...(turnData.triggeredEffects || []),
            ...effects
          ]
        }
      }
    };
  }
  
  // ============================================================================
  // POWER USAGE TRACKING
  // ============================================================================
  
  /**
   * Mark a once-only power as used
   */
  private static markPowerAsUsed(
    gameState: GameState,
    shipInstanceId: ShipInstanceId,
    powerIndex: number,
    turn: number
  ): GameState {
    const turnData = gameState.gameData.turnData || {
      triggeredEffects: [],
      evaluatedEffects: [],
      onceOnlyAutomaticEffects: []
    };
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          onceOnlyAutomaticEffects: [
            ...(turnData.onceOnlyAutomaticEffects || []),
            {
              shipId: shipInstanceId,
              effectType: `power_${powerIndex}`,
              turn
            }
          ]
        }
      }
    };
  }
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * Determine power choice type for player interaction
   */
  private static getPowerChoiceType(
    power: EngineShipPower
  ): 'DESTROY_SHIP' | 'STEAL_SHIP' | 'COPY_SHIP' | 'BUILD_SHIP' | 'OTHER' {
    
    if (!power.choiceType) return 'OTHER';
    
    switch (power.choiceType) {
      case 'select_ship':
        // Try to infer from kind
        if (power.rawText.toLowerCase().includes('destroy')) return 'DESTROY_SHIP';
        if (power.rawText.toLowerCase().includes('steal')) return 'STEAL_SHIP';
        if (power.rawText.toLowerCase().includes('copy')) return 'COPY_SHIP';
        return 'OTHER';
        
      default:
        return 'OTHER';
    }
  }
}

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

export default PowerExecutor;

/**
 * Execute a single power (convenience function)
 */
export function executePower(
  power: EngineShipPower,
  context: PowerExecutionContext
): PowerExecutionResult {
  return PowerExecutor.executePower(power, context);
}

/**
 * Execute multiple powers (convenience function)
 */
export function executePowers(
  powers: EngineShipPower[],
  context: PowerExecutionContext
): PowerExecutionResult {
  return PowerExecutor.executePowers(powers, context);
}