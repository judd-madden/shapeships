// ============================================================================
// END OF TURN RESOLVER
// ============================================================================
//
// The ONLY place where health changes are applied.
//
// 🔒 CORE INVARIANTS:
// 1. Health only changes during End of Turn Resolution
// 2. All effects resolve simultaneously (order-independent)
// 3. Once-only/triggered effects resolve even if source ship destroyed
// 4. Continuous effects only resolve if source ship survives
// 5. Win/loss checked ONLY after resolution
//
// ARCHITECTURAL INTENT:
// - PowerExecutor: Enqueues triggered effects only, NEVER applies health
// - PassiveModifiers: Queried during evaluation, never execute/enqueue
// - EndOfTurnResolver: Only place health/max health/death/victory change
//
// ============================================================================

import type { GameState, PlayerShip } from '../types/GameTypes';
import type { 
  TriggeredEffect, 
  EvaluatedEffect, 
  AnyEffect,
  EffectSource,
  EffectTarget
} from '../types/EffectTypes';
import { 
  EffectKind, // ✅ Import as value (not type) for runtime usage
  createEvaluatedEffect, 
  generateEffectId,
  createOpponentTarget,
  createSelfTarget
} from '../types/EffectTypes';
import { PowerTiming, ShipPowerPhase, type ShipPower, EffectKind as PowerEffectKind } from '../types/ShipTypes';
import { getShipById } from '../data/ShipDefinitions';
import type PassiveModifiers from './PassiveModifiers';

// ============================================================================
// RESULT TYPE
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
   * 2. Evaluate continuous Automatic effects (check ship still alive)
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
    // STEP 2: Evaluate continuous Automatic effects (NOT queued earlier)
    // ========================================================================
    
    const continuousEffects = this.evaluateContinuousEffects(gameState);
    allEffects.push(...continuousEffects);
    
    // Log continuous effects
    for (const effect of continuousEffects) {
      result.effectsApplied.push({
        effectId: effect.id,
        description: effect.description || 'Unknown effect',
        applied: true
      });
    }
    
    // ========================================================================
    // STEP 3: Apply all effects simultaneously
    // ========================================================================
    
    this.applyAllEffects(gameState, allEffects, result);
    
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
  // CONTINUOUS EFFECT EVALUATION
  // ==========================================================================
  
  /**
   * Evaluate continuous Automatic effects from surviving ships
   * 
   * ✅ CORRECT: Uses structured power data (NO TEXT PARSING)
   * ✅ CORRECT: Scans only surviving ships
   * ✅ CORRECT: Uses PlayerShip (canonical runtime type)
   * ✅ CORRECT: Uses PowerTiming enum values
   */
  private evaluateContinuousEffects(gameState: GameState): EvaluatedEffect[] {
    const effects: EvaluatedEffect[] = [];
    
    // Scan all players
    for (const playerId in gameState.gameData.ships || {}) {
      const playerShips = gameState.gameData.ships[playerId] || [];
      
      for (const ship of playerShips) {
        // 🔒 CRITICAL: Skip destroyed/consumed ships
        if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
        
        // Get ship definition (use PlayerShip.shipId = definition ID)
        const shipDef = getShipById(ship.shipId);
        if (!shipDef) continue;
        
        // ✅ CORRECT: Filter for continuous Automatic powers using enums
        // PowerTiming.CONTINUOUS = 'continuous' (lowercase)
        const continuousPowers = shipDef.powers.filter(p => 
          p.phase === ShipPowerPhase.AUTOMATIC && 
          p.timing === PowerTiming.CONTINUOUS
        );
        
        for (const power of continuousPowers) {
          // Evaluate power and create effect(s)
          const powerEffects = this.evaluatePowerToEffects(power, ship, playerId, gameState);
          effects.push(...powerEffects);
        }
      }
    }
    
    return effects;
  }
  
  /**
   * Evaluate a ship power to create QueuedEffect(s)
   * 
   * Uses structured power fields (NO REGEX PARSING):
   * - power.effectType
   * - power.baseAmount
   * - power.specialLogic
   * 
   * Returns array of effects (some powers create multiple effects)
   */
  private evaluatePowerToEffects(
    power: ShipPower,
    ship: PlayerShip,
    playerId: string,
    gameState: GameState
  ): EvaluatedEffect[] {
    const effects: EvaluatedEffect[] = [];
    
    // Map power effect type to queued effect type
    const effectKind = this.mapPowerEffectToEffectKind(power.effectType);
    if (!effectKind) return effects; // Skip if not mappable
    
    // Calculate value using structured power data
    let value = power.baseAmount || 0;
    
    // Handle special logic (scaling, counting, etc.)
    if (power.specialLogic) {
      value = this.evaluateSpecialLogic(power, ship, gameState, playerId);
    }
    
    // Skip zero-value effects
    if (value <= 0 && (effectKind === EffectKind.DAMAGE || effectKind === EffectKind.HEAL)) {
      return effects;
    }
    
    // Determine target player
    const targetPlayerId = this.determineTarget(power.effectType, playerId, gameState);
    
    // Determine energy color (if applicable)
    let energyColor: 'red' | 'green' | 'blue' | 'all' | undefined;
    if (effectKind === EffectKind.GAIN_ENERGY && power.specialLogic?.energyColor) {
      energyColor = power.specialLogic.energyColor as 'red' | 'green' | 'blue' | 'all';
    }
    
    // Create effect source
    const source: EffectSource = {
      sourcePlayerId: playerId,
      sourceShipInstanceId: ship.id,
      sourceShipDefId: ship.shipId,
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    // Create effect target
    const target: EffectTarget = {
      targetPlayerId
    };
    
    // Create evaluated effect using helper
    const effect = createEvaluatedEffect({
      id: generateEffectId(source, effectKind, gameState.roundNumber, effects.length),
      kind: effectKind,
      value,
      energyColor,
      source,
      target,
      description: power.description || `${ship.shipId} continuous power`
    });
    
    effects.push(effect);
    
    return effects;
  }
  
  /**
   * Map PowerEffectType to EffectKind
   */
  private mapPowerEffectToEffectKind(powerEffect: PowerEffectKind): EffectKind | null {
    switch (powerEffect) {
      case PowerEffectKind.DEAL_DAMAGE: return EffectKind.DAMAGE;
      case PowerEffectKind.HEAL: return EffectKind.HEAL;
      case PowerEffectKind.GAIN_LINES: return EffectKind.GAIN_LINES;
      case PowerEffectKind.GAIN_JOINING_LINES: return EffectKind.GAIN_JOINING_LINES;
      case PowerEffectKind.GAIN_ENERGY: return EffectKind.GAIN_ENERGY;
      case PowerEffectKind.SET_HEALTH_MAX: return EffectKind.SET_HEALTH_MAX;
      case PowerEffectKind.INCREASE_MAX_HEALTH: return EffectKind.INCREASE_MAX_HEALTH;
      
      // Not applicable to continuous effects
      case PowerEffectKind.BUILD_SHIP:
      case PowerEffectKind.DESTROY_SHIP:
      case PowerEffectKind.COPY_SHIP:
      case PowerEffectKind.REROLL_DICE:
      case PowerEffectKind.CONDITIONAL:
      case PowerEffectKind.CUSTOM:
      case PowerEffectKind.PASSIVE:
      case PowerEffectKind.COUNT_AND_DAMAGE:
      case PowerEffectKind.COUNT_AND_HEAL:
        return null;
    }
  }
  
  /**
   * Evaluate special logic for complex powers
   * 
   * Uses structured specialLogic fields:
   * - countType: What to count (e.g., 'own_ships', 'opponent_ships')
   * - countFilter: Filter criteria (e.g., ship type, faction)
   * - multiplier: Value per counted item
   * 
   * TODO: Extract to separate SpecialLogic evaluator module for reuse
   */
  private evaluateSpecialLogic(
    power: ShipPower,
    ship: PlayerShip,
    gameState: GameState,
    playerId: string
  ): number {
    const specialLogic = power.specialLogic;
    if (!specialLogic) return power.baseAmount || 0;
    
    // Handle counting logic
    if (specialLogic.countType) {
      let count = 0;
      
      switch (specialLogic.countType) {
        case 'own_ships':
          count = this.countOwnShips(gameState, playerId, specialLogic.countFilter);
          break;
        case 'opponent_ships':
          const opponentId = this.getOpponentId(gameState, playerId);
          count = this.countOwnShips(gameState, opponentId, specialLogic.countFilter);
          break;
        case 'all_ships':
          count = this.countAllShips(gameState, specialLogic.countFilter);
          break;
        default:
          count = 0;
      }
      
      // Apply multiplier
      const multiplier = specialLogic.multiplier || 1;
      return (power.baseAmount || 0) + (count * multiplier);
    }
    
    // Handle other special logic types
    if (specialLogic.customLogicId) {
      // Delegate to custom logic handlers
      // TODO: Implement custom logic registry
      return power.baseAmount || 0;
    }
    
    // Default: base amount
    return power.baseAmount || 0;
  }
  
  /**
   * Count ships matching filter criteria
   */
  private countOwnShips(
    gameState: GameState,
    playerId: string,
    filter?: { shipType?: string; faction?: string; excludeSelf?: boolean }
  ): number {
    const ships = gameState.gameData.ships?.[playerId] || [];
    
    return ships.filter(ship => {
      // Skip destroyed/consumed
      if (ship.isDestroyed || ship.isConsumedInUpgrade) return false;
      
      // Apply filter if provided
      if (filter) {
        const shipDef = getShipById(ship.shipId);
        if (!shipDef) return false;
        
        if (filter.shipType && shipDef.type !== filter.shipType) return false;
        if (filter.faction && ship.originalSpecies !== filter.faction) return false;
      }
      
      return true;
    }).length;
  }
  
  /**
   * Count all ships across all players
   */
  private countAllShips(
    gameState: GameState,
    filter?: { shipType?: string; faction?: string }
  ): number {
    let total = 0;
    
    for (const playerId in gameState.gameData.ships || {}) {
      total += this.countOwnShips(gameState, playerId, filter);
    }
    
    return total;
  }
  
  /**
   * Determine target player for effect
   */
  private determineTarget(
    effectType: PowerEffectKind,
    sourcePlayerId: string,
    gameState: GameState
  ): string {
    // Damage targets opponent
    if (effectType === PowerEffectKind.DEAL_DAMAGE) {
      return this.getOpponentId(gameState, sourcePlayerId);
    }
    
    // Everything else targets self
    return sourcePlayerId;
  }
  
  // ==========================================================================
  // EFFECT APPLICATION
  // ==========================================================================
  
  /**
   * Apply all effects simultaneously
   * 
   * ✅ CORRECT: Tally BEFORE applying (true simultaneous resolution)
   * ✅ CORRECT: Ignores zero-value effects
   * ✅ CORRECT: Ensures all values >= 0
   */
  private applyAllEffects(
    gameState: GameState,
    effects: AnyEffect[],
    result: EndOfTurnResult
  ): void {
    
    // Initialize tracking
    const healthDeltas: HealthDeltas = {};
    const maxHealthChanges: { [playerId: string]: number } = {};
    const linesGained: { [playerId: string]: { regular: number; joining: number } } = {};
    const energyGained: { [playerId: string]: { red: number; green: number; blue: number } } = {};
    
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    for (const player of activePlayers) {
      healthDeltas[player.id] = { damage: 0, healing: 0, netChange: 0 };
      maxHealthChanges[player.id] = 0;
      linesGained[player.id] = { regular: 0, joining: 0 };
      energyGained[player.id] = { red: 0, green: 0, blue: 0 };
    }
    
    // Tally all effects
    for (const effect of effects) {
      const value = Math.max(0, effect.value || 0); // Ensure >= 0
      
      // Skip zero-value effects
      if (value === 0 && (effect.kind === EffectKind.DAMAGE || effect.kind === EffectKind.HEAL)) {
        continue;
      }
      
      switch (effect.kind) {
        case EffectKind.DAMAGE:
          if (healthDeltas[effect.target.targetPlayerId]) {
            healthDeltas[effect.target.targetPlayerId].damage += value;
          }
          break;
        
        case EffectKind.HEAL:
          if (healthDeltas[effect.target.targetPlayerId]) {
            healthDeltas[effect.target.targetPlayerId].healing += value;
          }
          break;
        
        case EffectKind.INCREASE_MAX_HEALTH:
          if (maxHealthChanges[effect.target.targetPlayerId] !== undefined) {
            maxHealthChanges[effect.target.targetPlayerId] += value;
          }
          break;
        
        case EffectKind.SET_HEALTH_MAX:
          // SET overrides INCREASE (last one wins)
          if (maxHealthChanges[effect.target.targetPlayerId] !== undefined) {
            maxHealthChanges[effect.target.targetPlayerId] = value;
          }
          break;
        
        case EffectKind.GAIN_LINES:
          if (linesGained[effect.target.targetPlayerId]) {
            linesGained[effect.target.targetPlayerId].regular += value;
          }
          break;
        
        case EffectKind.GAIN_JOINING_LINES:
          if (linesGained[effect.target.targetPlayerId]) {
            linesGained[effect.target.targetPlayerId].joining += value;
          }
          break;
        
        case EffectKind.GAIN_ENERGY:
          if (energyGained[effect.target.targetPlayerId] && effect.energyColor) {
            if (effect.energyColor === 'all') {
              energyGained[effect.target.targetPlayerId].red += value;
              energyGained[effect.target.targetPlayerId].green += value;
              energyGained[effect.target.targetPlayerId].blue += value;
            } else {
              energyGained[effect.target.targetPlayerId][effect.energyColor] += value;
            }
          }
          break;
      }
    }
    
    // Calculate net health changes
    for (const playerId in healthDeltas) {
      const delta = healthDeltas[playerId];
      delta.netChange = delta.healing - delta.damage;
    }
    
    // Apply health changes
    for (const player of gameState.players) {
      if (player.role !== 'player') continue;
      
      const delta = healthDeltas[player.id];
      if (delta) {
        const currentHealth = player.health ?? 25;
        player.health = currentHealth + delta.netChange;
      }
    }
    
    // Apply max health changes (to player object if supported)
    for (const player of gameState.players) {
      if (player.role !== 'player') continue;
      
      const change = maxHealthChanges[player.id];
      if (change > 0) {
        const oldMax = player.maxHealth || 30;
        const newMax = oldMax + change;
        player.maxHealth = newMax;
        result.maxHealthChanges[player.id] = { oldMax, newMax };
      }
    }
    
    // Apply lines to player objects
    for (const player of gameState.players) {
      if (player.role !== 'player') continue;
      
      const gained = linesGained[player.id];
      if (gained) {
        if (gained.regular > 0) {
          player.lines = (player.lines || 0) + gained.regular;
        }
        if (gained.joining > 0) {
          player.joiningLines = (player.joiningLines || 0) + gained.joining;
        }
      }
    }
    
    // Apply energy to player objects
    for (const player of gameState.players) {
      if (player.role !== 'player') continue;
      
      const gained = energyGained[player.id];
      if (gained && player.energy) {
        player.energy.red = (player.energy.red || 0) + gained.red;
        player.energy.green = (player.energy.green || 0) + gained.green;
        player.energy.blue = (player.energy.blue || 0) + gained.blue;
      }
    }
    
    // Store results
    result.healthChanges = healthDeltas;
    result.linesGained = linesGained;
    result.energyGained = energyGained;
  }
  
  // ==========================================================================
  // HEALTH FINALIZATION
  // ==========================================================================
  
  /**
   * Cap health to [0, maxHealth] and mark dead players
   * 
   * ✅ CORRECT: Uses gameData.rules.maxHealth ?? settings.maxHealth ?? player.maxHealth ?? DEFAULT
   * ✅ CORRECT: Accounts for passive modifiers (Spiral)
   * ✅ CORRECT: Defeated players set to health = 0, isActive = false
   */
  private finalizeHealth(
    gameState: GameState,
    passiveModifiers: PassiveModifiers,
    result: EndOfTurnResult
  ): void {
    const DEFAULT_MAX_HEALTH = 30;
    
    for (const player of gameState.players) {
      if (player.role !== 'player') continue;
      
      // ✅ CORRECT: Health cap hierarchy (aligned with GameTypes refactoring)
      const baseMax = player.maxHealth 
        ?? gameState.gameData.rules?.maxHealth 
        ?? gameState.settings?.maxHealth 
        ?? DEFAULT_MAX_HEALTH;
      
      // ✅ CORRECT: Account for passive modifiers (Spiral: 2+ → +15)
      const passiveIncrease = passiveModifiers.getMaxHealthIncrease(player.id);
      const maxHealth = baseMax + passiveIncrease;
      
      // Track max health change if passive modifier active
      if (passiveIncrease > 0 && !result.maxHealthChanges[player.id]) {
        result.maxHealthChanges[player.id] = { 
          oldMax: baseMax, 
          newMax: maxHealth 
        };
      }
      
      const currentHealth = player.health ?? 25;
      
      // Cap health to [0, maxHealth]
      if (currentHealth > maxHealth) {
        player.health = maxHealth;
      } else if (currentHealth <= 0) {
        player.health = 0;
        player.isActive = false;  // Mark player as defeated
      }
    }
  }
  
  /**
   * Check if game has ended
   * Win condition: Opponent health <= 0
   */
  private checkGameEnd(gameState: GameState): {
    ended: boolean;
    winner?: string;
  } {
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    const alivePlayers = activePlayers.filter(p => (p.health ?? 25) > 0);
    
    if (alivePlayers.length === 1) {
      return {
        ended: true,
        winner: alivePlayers[0].id
      };
    }
    
    if (alivePlayers.length === 0) {
      // Draw (simultaneous defeat)
      return {
        ended: true,
        winner: undefined
      };
    }
    
    return {
      ended: false
    };
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /**
   * Find a ship by INSTANCE ID across all players
   * 
   * ✅ CORRECT: Uses PlayerShip (canonical runtime type)
   * ✅ CORRECT: Uses instance ID (PlayerShip.id), not definition ID
   */
  private findShipByInstanceId(gameState: GameState, instanceId: string): PlayerShip | undefined {
    for (const playerId in gameState.gameData?.ships || {}) {
      const ships = gameState.gameData.ships[playerId] || [];
      const ship = ships.find(s => s.id === instanceId);
      if (ship) return ship;
    }
    return undefined;
  }
  
  /**
   * Get opponent player ID
   */
  private getOpponentId(gameState: GameState, playerId: string): string {
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    const opponent = activePlayers.find(p => p.id !== playerId);
    return opponent?.id || playerId;
  }
}

// Export singleton instance
export const endOfTurnResolver = new EndOfTurnResolver();