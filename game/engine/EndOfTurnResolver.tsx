/**
 * DEPRECATED — LEGACY CLIENT ENGINE
 *
 * This file is part of an old client-authoritative engine.
 * It must not be used for authoritative gameplay.
 *
 * Canonical shared engine code lives in /engine.
 * This file is retained for reference only.
 */

import type { GameState } from '../types/GameTypes';
import type { 
  TriggeredEffect, 
  EvaluatedEffect, 
  AnyEffect,
  EffectSource,
  EffectTarget
} from '../types/EffectTypes'; // LEGACY EFFECTS — migrate to /game/engine/effects/ when touching this file
import { 
  EffectKind,
  createEvaluatedEffect, 
  generateEffectId,
  createOpponentTarget,
  createSelfTarget
} from '../types/EffectTypes'; // LEGACY EFFECTS — migrate to /game/engine/effects/ when touching this file
import { PowerTiming, ShipPowerPhase } from '../types/ShipTypes.engine';
import { getShipById } from '../data/ShipDefinitions.engine';
import { 
  resolveShipPower,
  type PowerResolutionContext 
} from './PowerResolver';
import type PassiveModifiers from './PassiveModifiers';

// ============================================================================
// RESULT TYPES
// ============================================================================

interface HealthDeltas {
  [playerId: string]: {
    damage: number;
    healing: number;
    netChange: number;
  };
}

export interface EndOfTurnResult {
  healthChanges: HealthDeltas;
  maxHealthChanges: { [playerId: string]: { oldMax: number; newMax: number } };
  linesGained: { [playerId: string]: { regular: number; joining: number } };
  energyGained: { [playerId: string]: { red: number; green: number; blue: number } };
  shipsDestroyed: string[];  // Instance IDs of ships destroyed this turn
  gameEnded: boolean;
  winner?: string;
  effectsApplied: Array<{
    effectId: string;
    description: string;
    applied: boolean;
    reason?: string;
  }>;
}

// ============================================================================
// END OF TURN RESOLVER
// ============================================================================

export class EndOfTurnResolver {
  
  /**
   * PRIMARY METHOD: Resolve End of Turn
   * 
   * Algorithm:
   * 1. Collect all triggered effects (already queued from Build/Battle)
   * 2. Evaluate continuous Automatic effects (using PowerResolver)
   * 3. Apply all effects simultaneously
   * 4. Cap health (accounting for max health modifiers), check win/loss
   */
  resolveEndOfTurn(
    gameState: GameState,
    queuedEffects: TriggeredEffect[],
    passiveModifiers: PassiveModifiers
  ): EndOfTurnResult {
    
    const result: EndOfTurnResult = {
      healthChanges: {},
      maxHealthChanges: {},
      linesGained: {},
      energyGained: {},
      shipsDestroyed: [],
      gameEnded: false,
      effectsApplied: []
    };
    
    const allEffects: AnyEffect[] = [];
    
    // ========================================================================
    // STEP 1: Collect triggered effects (already queued)
    // ========================================================================
    
    for (const effect of queuedEffects) {
      // Check if effect should apply
      if (effect.persistsIfSourceDestroyed) {
        // Always apply (once-only, charges, solar powers)
        allEffects.push(effect);
        result.effectsApplied.push({
          effectId: effect.id,
          description: effect.description || 'Unknown effect',
          applied: true
        });
      } else {
        // Check if source ship still exists
        if (!effect.source.sourceShipInstanceId) {
          // No source ship (global effect?) - apply
          allEffects.push(effect);
          result.effectsApplied.push({
            effectId: effect.id,
            description: effect.description || 'Unknown effect',
            applied: true
          });
        } else {
          const sourceShip = this.findShipByInstanceId(gameState, effect.source.sourceShipInstanceId);
          if (sourceShip && !sourceShip.isDestroyed && !sourceShip.isConsumedInUpgrade) {
            allEffects.push(effect);
            result.effectsApplied.push({
              effectId: effect.id,
              description: effect.description || 'Unknown effect',
              applied: true
            });
          } else {
            result.effectsApplied.push({
              effectId: effect.id,
              description: effect.description || 'Unknown effect',
              applied: false,
              reason: 'Source ship destroyed or consumed'
            });
          }
        }
      }
    }
    
    // ========================================================================
    // STEP 2: Evaluate continuous Automatic effects (using PowerResolver)
    // ========================================================================
    
    const continuousEffects = this.evaluateContinuousEffects(gameState);
    allEffects.push(...continuousEffects);
    
    // Log continuous effects
    for (const effect of continuousEffects) {
      result.effectsApplied.push({
        effectId: effect.id,
        description: effect.description || 'Unknown continuous effect',
        applied: true
      });
    }
    
    // ========================================================================
    // STEP 3: Apply all effects simultaneously
    // ========================================================================
    
    this.applyAllEffects(gameState, allEffects, result, passiveModifiers);
    
    // ========================================================================
    // STEP 4: Cap health (with passive modifiers), check win/loss
    // ========================================================================
    
    this.finalizeHealth(gameState, passiveModifiers, result);
    const gameEndCheck = this.checkGameEnd(gameState);
    result.gameEnded = gameEndCheck.ended;
    result.winner = gameEndCheck.winner;
    
    return result;
  }
  
  // ==========================================================================
  // CONTINUOUS EFFECT EVALUATION (REFACTORED)
  // ==========================================================================
  
  /**
   * Evaluate continuous Automatic effects from surviving ships
   * NOW USES PowerResolver - no more ship-specific logic here
   */
  private evaluateContinuousEffects(gameState: GameState): EvaluatedEffect[] {
    const effects: EvaluatedEffect[] = [];
    
    // Scan all players
    for (const playerId in gameState.gameData.ships || {}) {
      const playerShips = gameState.gameData.ships[playerId] || [];
      const opponentId = this.getOpponentId(gameState, playerId);
      
      for (const ship of playerShips) {
        // Skip destroyed/consumed ships
        if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
        
        // Get ship definition
        const shipDef = getShipById(ship.shipId);
        if (!shipDef) continue;
        
        // Filter for continuous Automatic powers
        const continuousPowers = shipDef.powers.filter(p => 
          p.phase === ShipPowerPhase.AUTOMATIC && 
          p.timing === PowerTiming.CONTINUOUS
        );
        
        for (const power of continuousPowers) {
          // DELEGATE TO POWER RESOLVER (the interpreter)
          const context: PowerResolutionContext = {
            gameState,
            ship,
            ownerId: playerId,
            opponentId,
            currentPhase: ShipPowerPhase.AUTOMATIC,
            currentTurn: gameState.roundNumber,
            diceRoll: gameState.gameData.turnData?.diceRoll
          };
          
          const resolution = resolveShipPower(power, context);
          
          // Convert resolved effects to EvaluatedEffects
          for (const triggeredEffect of resolution.effects) {
            const evaluatedEffect: EvaluatedEffect = {
              ...triggeredEffect,
              // Mark as evaluated (not triggered)
              isEvaluated: true
            };
            effects.push(evaluatedEffect);
          }
          
          // Log warnings if any
          if (resolution.warnings && resolution.warnings.length > 0) {
            console.warn(
              `[EndOfTurnResolver] Warnings evaluating ${ship.shipId} power ${power.powerIndex}:`,
              resolution.warnings
            );
          }
        }
      }
    }
    
    return effects;
  }
  
  // ==========================================================================
  // EFFECT APPLICATION
  // ==========================================================================
  
  /**
   * Apply all effects to game state
   * Handles health, max health, resources, etc.
   * NOW APPLIES SCIENCE VESSEL MULTIPLIERS
   */
  private applyAllEffects(
    gameState: GameState,
    effects: AnyEffect[],
    result: EndOfTurnResult,
    passiveModifiers: PassiveModifiers
  ): void {
    
    // Initialize player deltas
    for (const player of gameState.players) {
      result.healthChanges[player.id] = {
        damage: 0,
        healing: 0,
        netChange: 0
      };
      result.linesGained[player.id] = {
        regular: 0,
        joining: 0
      };
      result.energyGained[player.id] = {
        red: 0,
        green: 0,
        blue: 0
      };
    }
    
    // Apply each effect
    for (const effect of effects) {
      const targetId = effect.target.targetPlayerId;
      
      if (!targetId) {
        console.warn('[EndOfTurnResolver] Effect has no target player ID:', effect);
        continue;
      }
      
      // Get source player for Science Vessel multiplier checking
      const sourceId = effect.source.sourcePlayerId;
      let effectValue = effect.value || 0;
      
      switch (effect.kind) {
        case EffectKind.DAMAGE:
          // Apply Science Vessel doubling (2+ SCI)
          if (sourceId && passiveModifiers.shouldDoubleDamage(sourceId, gameState)) {
            effectValue *= 2;
          }
          result.healthChanges[targetId].damage += effectValue;
          break;
          
        case EffectKind.HEAL:
          // Apply Science Vessel doubling (1+ SCI)
          if (sourceId && passiveModifiers.shouldDoubleHealing(sourceId, gameState)) {
            effectValue *= 2;
          }
          result.healthChanges[targetId].healing += effectValue;
          break;
          
        case EffectKind.GAIN_LINES:
          result.linesGained[targetId].regular += effect.value || 0;
          break;
          
        case EffectKind.GAIN_JOINING_LINES:
          result.linesGained[targetId].joining += effect.value || 0;
          break;
          
        case EffectKind.GAIN_ENERGY:
          if (effect.energyColor === 'red' || effect.energyColor === 'all') {
            result.energyGained[targetId].red += effect.value || 0;
          }
          if (effect.energyColor === 'green' || effect.energyColor === 'all') {
            result.energyGained[targetId].green += effect.value || 0;
          }
          if (effect.energyColor === 'blue' || effect.energyColor === 'all') {
            result.energyGained[targetId].blue += effect.value || 0;
          }
          break;
          
        case EffectKind.SET_HEALTH_MAX:
          // Set health to maximum
          const player = gameState.players.find(p => p.id === targetId);
          if (player) {
            result.healthChanges[targetId].healing += (player.maxHealth - player.health);
          }
          break;
          
        case EffectKind.INCREASE_MAX_HEALTH:
          // Track max health increase
          const targetPlayer = gameState.players.find(p => p.id === targetId);
          if (targetPlayer) {
            const oldMax = result.maxHealthChanges[targetId]?.newMax || targetPlayer.maxHealth;
            const newMax = oldMax + (effect.value || 0);
            result.maxHealthChanges[targetId] = { oldMax: targetPlayer.maxHealth, newMax };
          }
          break;
          
        default:
          console.warn(`[EndOfTurnResolver] Unhandled effect kind: ${effect.kind}`);
      }
    }
    
    // Calculate net health changes
    for (const playerId in result.healthChanges) {
      const delta = result.healthChanges[playerId];
      delta.netChange = delta.healing - delta.damage;
    }
  }
  
  /**
   * Finalize health changes and apply to game state
   * Caps health at max, applies passive modifiers
   */
  private finalizeHealth(
    gameState: GameState,
    passiveModifiers: PassiveModifiers,
    result: EndOfTurnResult
  ): void {
    
    for (const player of gameState.players) {
      const playerId = player.id;
      
      // Apply max health changes
      if (result.maxHealthChanges[playerId]) {
        const newMax = result.maxHealthChanges[playerId].newMax;
        player.maxHealth = newMax;
      }
      
      // Apply health changes
      const delta = result.healthChanges[playerId];
      if (delta) {
        player.health += delta.netChange;
        
        // Cap health at max
        player.health = Math.max(0, Math.min(player.health, player.maxHealth));
      }
      
      // Apply resource changes
      if (result.linesGained[playerId]) {
        player.lines = (player.lines || 0) + result.linesGained[playerId].regular;
        player.joiningLines = (player.joiningLines || 0) + result.linesGained[playerId].joining;
      }
      
      if (result.energyGained[playerId]) {
        const energy = player.energy || { red: 0, green: 0, blue: 0 };
        player.energy = {
          red: energy.red + result.energyGained[playerId].red,
          green: energy.green + result.energyGained[playerId].green,
          blue: energy.blue + result.energyGained[playerId].blue
        };
      }
    }
  }
  
  /**
   * Check if game has ended (player at 0 health)
   */
  private checkGameEnd(gameState: GameState): { ended: boolean; winner?: string } {
    const players = gameState.players;
    
    const deadPlayers = players.filter(p => p.health <= 0);
    
    if (deadPlayers.length === 0) {
      return { ended: false };
    }
    
    if (deadPlayers.length === 1) {
      const winner = players.find(p => p.health > 0);
      return { ended: true, winner: winner?.id };
    }
    
    // Both dead - draw (shouldn't happen with simultaneous resolution)
    return { ended: true, winner: undefined };
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  /**
   * Find ship by instance ID
   */
  private findShipByInstanceId(
    gameState: GameState,
    instanceId: string
  ): PlayerShip | undefined {
    
    for (const playerId in gameState.gameData.ships || {}) {
      const ships = gameState.gameData.ships[playerId] || [];
      const ship = ships.find(s => s.id === instanceId);
      if (ship) return ship;
    }
    
    return undefined;
  }
  
  /**
   * Get opponent ID
   */
  private getOpponentId(gameState: GameState, playerId: string): string {
    const opponent = gameState.players.find(p => p.id !== playerId);
    return opponent?.id || '';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EndOfTurnResolver;

/**
 * Singleton instance for convenience
 * @deprecated Consider using class methods directly for better testability
 */
export const endOfTurnResolver = new EndOfTurnResolver();