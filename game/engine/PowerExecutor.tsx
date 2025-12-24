// Power Executor - Executes ship powers based on ShipDefinition data
// 
// ARCHITECTURAL INVARIANTS:
// 1. NO health changes mid-turn - enqueue effects instead
// 2. Uses PlayerShip from GameTypes (runtime ship structure)
// 3. Continuous powers are NOT executed here (evaluated at EndOfTurnResolver)
// 4. All health/max health effects enqueued into TurnData.triggeredEffects
//
// Pure function approach: Takes GameState, returns new GameState
// NO UI logic - only state transformations

import type { GameState, PlayerShip } from '../types/GameTypes';
import type { 
  ShipPower, 
  PowerExecutionContext,
  GameContext,
  PlayerId,
  ShipDefId,
  ShipInstanceId
} from '../types/ShipTypes';
import type {
  TriggeredEffect,
  EffectSource,
  EffectTarget,
  EnergyColor
} from '../types/EffectTypes';
import {
  EffectKind,
  createTriggeredEffect,
  generateEffectId,
  createOpponentTarget,
  createSelfTarget
} from '../types/EffectTypes';
import { 
  PowerEffectType, 
  PowerTiming,
  ShipPowerPhase 
} from '../types/ShipTypes';
import { getShipById } from '../data/ShipDefinitions';
import { SpecialLogic } from './SpecialLogic';

// ============================================================================
// EXECUTION RESULT TYPES
// ============================================================================

/**
 * Result of power execution
 * Indicates if player choice is required for interactive powers
 */
export interface PowerExecutionResult {
  gameState: GameState;
  needsPlayerChoice?: {
    powerType: 'DESTROY_SHIP' | 'STEAL_SHIP' | 'COPY_SHIP';
    power: ShipPower;
    ship: PlayerShip;
    context: PowerExecutionContext;
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export class PowerExecutor {
  
  /**
   * Execute a ship power and return updated game state
   * @param power - The power to execute
   * @param context - Execution context (ship, owner, opponent, game state)
   * @returns Execution result with updated state and optional player choice requirement
   */
  static executePower(power: ShipPower, context: PowerExecutionContext): PowerExecutionResult {
    let gameState = context.gameState;
    
    // Check if power should execute based on timing
    if (!this.shouldExecutePower(power, context)) {
      return { gameState };
    }
    
    // Handle special/custom logic first
    if (power.effectType === PowerEffectType.CUSTOM && power.specialLogic?.customLogicId) {
      const customResult = SpecialLogic.executeCustomLogic(
        power.specialLogic.customLogicId,
        power,
        context
      );
      return { gameState: customResult };
    }
    
    // Handle standard power types
    switch (power.effectType) {
      case PowerEffectType.HEAL:
        return { gameState: this.executeHealing(power, context) };
        
      case PowerEffectType.DEAL_DAMAGE:
        return { gameState: this.executeDamage(power, context) };
        
      case PowerEffectType.GAIN_LINES:
        return { gameState: this.executeGainLines(power, context) };
        
      case PowerEffectType.BUILD_SHIP:
        return { gameState: this.executeBuildShip(power, context) };
        
      case PowerEffectType.GAIN_ENERGY:
        return { gameState: this.executeGainEnergy(power, context) };
        
      case PowerEffectType.DESTROY_SHIP:
        return this.executeDestroyShip(power, context);
        
      case PowerEffectType.STEAL_SHIP:
        return this.executeStealShip(power, context);
        
      case PowerEffectType.COPY_SHIP:
        return this.executeCopyShip(power, context);
        
      case PowerEffectType.SET_HEALTH_MAX:
        return { gameState: this.executeSetHealthMax(power, context) };
        
      case PowerEffectType.INCREASE_MAX_HEALTH:
        return { gameState: this.executeIncreaseMaxHealth(power, context) };
        
      case PowerEffectType.TAKE_DAMAGE_SELF:
        return { gameState: this.executeSelfDamage(power, context) };
        
      case PowerEffectType.GAIN_JOINING_LINES:
        return { gameState: this.executeGainJoiningLines(power, context) };
        
      case PowerEffectType.REROLL_DICE:
        return { gameState: this.executeRerollDice(power, context) };
        
      case PowerEffectType.FORCE_DICE_VALUE:
        return { gameState: this.executeForceDiceValue(power, context) };
        
      // Legacy/complex types (delegate to special logic)
      case PowerEffectType.COUNT_AND_DAMAGE:
        return { gameState: this.executeCountAndDamage(power, context) };
        
      case PowerEffectType.COUNT_AND_HEAL:
        return { gameState: this.executeCountAndHeal(power, context) };
        
      case PowerEffectType.CONDITIONAL:
        return { gameState: this.executeConditional(power, context) };
        
      default:
        console.warn(`Unknown power effect type: ${power.effectType}`);
        return { gameState };
    }
  }
  
  /**
   * Execute multiple powers in sequence
   * @param powers - Array of powers to execute
   * @param context - Execution context
   * @returns Execution result with updated state
   */
  static executePowers(powers: ShipPower[], context: PowerExecutionContext): PowerExecutionResult {
    let gameState = context.gameState;
    let needsPlayerChoice;
    
    for (const power of powers) {
      // Update context with latest game state
      const updatedContext = { ...context, gameState };
      const result = this.executePower(power, updatedContext);
      gameState = result.gameState;
      
      // If power needs player choice, return immediately
      if (result.needsPlayerChoice) {
        needsPlayerChoice = result.needsPlayerChoice;
        break;
      }
    }
    
    return { gameState, needsPlayerChoice };
  }
  
  // ============================================================================
  // POWER TIMING CHECKS
  // ============================================================================
  
  /**
   * Check if a power should execute based on timing rules
   * 
   * ✅ CORRECT: Checks isDestroyed and isConsumedInUpgrade (not isDepleted)
   * ✅ CORRECT: CONTINUOUS powers generally skip execution (EndOfTurnResolver handles them)
   * ✅ CORRECT: ONCE_ONLY_AUTOMATIC tracked per instance + power index
   */
  private static shouldExecutePower(power: ShipPower, context: PowerExecutionContext): boolean {
    const { ship, currentPhase } = context;
    
    // Check phase alignment
    if (power.phase !== currentPhase) {
      return false;
    }
    
    // Check timing constraints
    switch (power.timing) {
      case PowerTiming.CONTINUOUS:
        // ✅ CORRECT: Ship must be alive (check destruction flags, NOT isDepleted)
        if (ship.isDestroyed || ship.isConsumedInUpgrade) return false;
        
        // ⚠️ IMPORTANT: Most CONTINUOUS powers should NOT execute here
        // They are evaluated at EndOfTurnResolver for health effects.
        // ONLY execute CONTINUOUS powers if they generate mid-turn non-health resources
        // (e.g., lines, energy during BUILD phase).
        //
        // For AUTOMATIC phase continuous powers → SKIP (EndOfTurnResolver handles)
        if (power.phase === ShipPowerPhase.AUTOMATIC) {
          return false; // EndOfTurnResolver evaluates these
        }
        
        // For non-AUTOMATIC continuous powers (e.g., SHIPS_THAT_BUILD) → OK to execute
        return true;
        
      case PowerTiming.ONCE_ONLY_AUTOMATIC:
        // ✅ CORRECT: Check if already used (per instance + power index)
        const alreadyUsed = this.hasUsedPower(ship, power.powerIndex, context.gameState);
        return !alreadyUsed;
        
      case PowerTiming.UPON_DESTRUCTION:
        // Only executes when ship is destroyed (handled separately by destruction event)
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
  private static hasUsedPower(ship: PlayerShip, powerIndex: number, gameState: GameState): boolean {
    // Check ship-level usage tracking (if implemented)
    // For now, use game state tracking
    const onceOnlyEffects = gameState.gameData.turnData?.onceOnlyAutomaticEffects || [];
    return onceOnlyEffects.some(effect => 
      effect.shipId === ship.id && // ✅ Uses instance ID
      effect.effectType === `power_${powerIndex}`
    );
  }
  
  // ============================================================================
  // EFFECT QUEUEING
  // ============================================================================
  
  /**
   * Enqueue a triggered effect into TurnData.triggeredEffects
   * 
   * ✅ MIGRATED: Uses canonical TriggeredEffect structure
   */
  private static enqueueEffect(
    gameState: GameState,
    effect: TriggeredEffect
  ): GameState {
    const triggeredEffects = (gameState.gameData.turnData?.triggeredEffects as TriggeredEffect[]) || [];
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData.turnData,
          triggeredEffects: [...triggeredEffects, effect]
        }
      }
    };
  }
  
  // ============================================================================
  // BASIC EFFECT EXECUTORS
  // ============================================================================
  
  /**
   * Execute healing effect
   * ✅ CORRECT: Enqueues effect instead of applying health directly
   */
  private static executeHealing(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, ship, shipDefinition } = context;
    const amount = power.baseAmount || 0;
    
    const source: EffectSource = {
      sourcePlayerId: ownerId,
      sourceShipInstanceId: ship.id,  // ✅ Instance ID
      sourceShipDefId: ship.shipId,   // ✅ Definition ID
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.HEAL, gameState.roundNumber, 0),
      kind: EffectKind.HEAL,
      source,
      target: createSelfTarget(ownerId),
      value: amount,
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: ${power.description}`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute damage effect
   * ✅ CORRECT: Enqueues effect instead of applying damage directly
   */
  private static executeDamage(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, opponentId, ship, shipDefinition } = context;
    const amount = power.baseAmount || 0;
    
    const source: EffectSource = {
      sourcePlayerId: context.ownerId,
      sourceShipInstanceId: ship.id,  // ✅ Instance ID
      sourceShipDefId: ship.shipId,   // ✅ Definition ID
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.DAMAGE, gameState.roundNumber, 0),
      kind: EffectKind.DAMAGE,
      source,
      target: createOpponentTarget(context.ownerId, gameState.players),
      value: amount,
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: ${power.description}`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute gain lines effect
   * Note: Lines are not health - safe to apply immediately
   */
  private static executeGainLines(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const amount = power.baseAmount || 0;
    
    // Lines can be applied immediately (not health)
    const player = gameState.players.find(p => p.id === ownerId);
    if (!player) return gameState;
    
    return {
      ...gameState,
      players: gameState.players.map(p => 
        p.id === ownerId 
          ? { ...p, lines: (p.lines || 0) + amount }
          : p
      )
    };
  }
  
  /**
   * Execute build ship effect
   * ✅ CORRECT: Creates PlayerShip (GameTypes shape), not ShipInstance
   */
  private static executeBuildShip(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, currentTurn } = context;
    const shipDefId = power.specialLogic?.buildShipId as ShipDefId;
    
    if (!shipDefId) {
      console.warn('BUILD_SHIP power missing buildShipId in specialLogic');
      return gameState;
    }
    
    // Get ship definition
    const shipDef = getShipById(shipDefId);
    if (!shipDef) {
      console.warn(`Ship definition not found: ${shipDefId}`);
      return gameState;
    }
    
    // ✅ CORRECT: Create PlayerShip (GameTypes shape)
    const newShip: PlayerShip = {
      id: `${shipDefId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ✅ Instance ID
      shipId: shipDefId,  // ✅ Definition ID
      ownerId,
      originalSpecies: shipDef.species,
      isDestroyed: false,
      isConsumedInUpgrade: false,
      currentCharges: shipDef.maxCharges,
      maxCharges: shipDef.maxCharges
    };
    
    // Add ship to owner's fleet
    const ownerShips = gameState.gameData.ships?.[ownerId] || [];
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        ships: {
          ...gameState.gameData.ships,
          [ownerId]: [...ownerShips, newShip]
        }
      }
    };
  }
  
  /**
   * Execute gain energy effect (Ancient species)
   * Note: Energy is not health - safe to apply immediately
   */
  private static executeGainEnergy(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const energyColor = power.specialLogic?.energyColor;
    const amount = power.baseAmount || 1;
    
    if (!energyColor) {
      console.warn('GAIN_ENERGY power missing energyColor in specialLogic');
      return gameState;
    }
    
    const player = gameState.players.find(p => p.id === ownerId);
    if (!player || player.faction !== 'ancient') return gameState;
    
    // Update energy based on color
    let updatedEnergy = { ...(player.energy || { red: 0, green: 0, blue: 0 }) };
    
    if (energyColor === 'all') {
      updatedEnergy.red += amount;
      updatedEnergy.green += amount;
      updatedEnergy.blue += amount;
    } else {
      updatedEnergy[energyColor] = (updatedEnergy[energyColor] || 0) + amount;
    }
    
    return {
      ...gameState,
      players: gameState.players.map(p =>
        p.id === ownerId
          ? { ...p, energy: updatedEnergy }
          : p
      )
    };
  }
  
  /**
   * Execute destroy ship effect
   * ✅ CORRECT: Returns structured needsPlayerChoice instead of console.warn
   */
  private static executeDestroyShip(power: ShipPower, context: PowerExecutionContext): PowerExecutionResult {
    // This requires player choice - return structured response
    return {
      gameState: context.gameState,
      needsPlayerChoice: {
        powerType: 'DESTROY_SHIP',
        power,
        ship: context.ship,
        context
      }
    };
  }
  
  /**
   * Execute steal ship effect
   * ✅ CORRECT: Returns structured needsPlayerChoice instead of console.warn
   */
  private static executeStealShip(power: ShipPower, context: PowerExecutionContext): PowerExecutionResult {
    // This requires player choice - return structured response
    return {
      gameState: context.gameState,
      needsPlayerChoice: {
        powerType: 'STEAL_SHIP',
        power,
        ship: context.ship,
        context
      }
    };
  }
  
  /**
   * Execute copy ship effect
   * ✅ CORRECT: Returns structured needsPlayerChoice instead of console.warn
   */
  private static executeCopyShip(power: ShipPower, context: PowerExecutionContext): PowerExecutionResult {
    // This requires player choice - return structured response
    return {
      gameState: context.gameState,
      needsPlayerChoice: {
        powerType: 'COPY_SHIP',
        power,
        ship: context.ship,
        context
      }
    };
  }
  
  /**
   * Execute set health to max effect
   * ✅ CORRECT: Enqueues effect instead of applying health directly
   */
  private static executeSetHealthMax(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, ship, shipDefinition } = context;
    
    const source: EffectSource = {
      sourcePlayerId: ownerId,
      sourceShipInstanceId: ship.id,
      sourceShipDefId: ship.shipId,
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.SET_HEALTH_MAX, gameState.roundNumber, 0),
      kind: EffectKind.SET_HEALTH_MAX,
      source,
      target: createSelfTarget(ownerId),
      value: undefined, // SET_HEALTH_MAX doesn't need a value (sets to current max)
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: Set health to maximum`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute increase max health effect
   * ✅ CORRECT: Enqueues effect instead of applying directly
   */
  private static executeIncreaseMaxHealth(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, ship, shipDefinition } = context;
    const amount = power.baseAmount || 0;
    
    const source: EffectSource = {
      sourcePlayerId: ownerId,
      sourceShipInstanceId: ship.id,
      sourceShipDefId: ship.shipId,
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.INCREASE_MAX_HEALTH, gameState.roundNumber, 0),
      kind: EffectKind.INCREASE_MAX_HEALTH,
      source,
      target: createSelfTarget(ownerId),
      value: amount,
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: Increase max health by ${amount}`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute self-damage effect
   * ✅ CORRECT: Enqueues effect instead of applying damage directly
   */
  private static executeSelfDamage(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, ship, shipDefinition } = context;
    const amount = power.baseAmount || 0;
    
    const source: EffectSource = {
      sourcePlayerId: ownerId,
      sourceShipInstanceId: ship.id,
      sourceShipDefId: ship.shipId,
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.DAMAGE, gameState.roundNumber, 0),
      kind: EffectKind.DAMAGE,
      source,
      target: createSelfTarget(ownerId),
      value: amount,
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: ${power.description} (self-damage)`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute gain joining lines effect
   * Note: Joining lines are not health - safe to apply immediately
   */
  private static executeGainJoiningLines(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const amount = power.baseAmount || 0;
    
    const player = gameState.players.find(p => p.id === ownerId);
    if (!player) return gameState;
    
    return {
      ...gameState,
      players: gameState.players.map(p =>
        p.id === ownerId
          ? { ...p, joiningLines: (p.joiningLines || 0) + amount }
          : p
      )
    };
  }
  
  /**
   * Execute reroll dice effect
   */
  private static executeRerollDice(power: ShipPower, context: PowerExecutionContext): GameState {
    // Dice manipulation should be handled during dice roll phase
    // Mark as pending dice manipulation
    console.warn('REROLL_DICE should be handled during dice roll phase');
    return context.gameState;
  }
  
  /**
   * Execute force dice value effect
   */
  private static executeForceDiceValue(power: ShipPower, context: PowerExecutionContext): GameState {
    // Dice manipulation should be handled during dice roll phase
    console.warn('FORCE_DICE_VALUE should be handled during dice roll phase');
    return context.gameState;
  }
  
  // ============================================================================
  // COMPLEX EFFECT EXECUTORS
  // ============================================================================
  
  /**
   * Execute count-and-damage effect
   * ✅ CORRECT: Enqueues effect with calculated count value
   */
  private static executeCountAndDamage(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, opponentId, ship, shipDefinition } = context;
    const count = this.calculateCount(power, context);
    const damagePerCount = power.baseAmount || 1;
    const totalDamage = count * damagePerCount;
    
    const source: EffectSource = {
      sourcePlayerId: ownerId,
      sourceShipInstanceId: ship.id,
      sourceShipDefId: ship.shipId,
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.DAMAGE, gameState.roundNumber, 0),
      kind: EffectKind.DAMAGE,
      source,
      target: createOpponentTarget(opponentId, gameState.players),
      value: totalDamage,
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: ${power.description} (count: ${count}, total: ${totalDamage})`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute count-and-heal effect
   * ✅ CORRECT: Enqueues effect with calculated count value
   */
  private static executeCountAndHeal(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, ship, shipDefinition } = context;
    const count = this.calculateCount(power, context);
    const healingPerCount = power.baseAmount || 1;
    const totalHealing = count * healingPerCount;
    
    // Apply max healing limit if specified (Mantis: max 10)
    const maxHealing = power.specialLogic?.maxHealingPerTurn;
    const finalHealing = maxHealing ? Math.min(totalHealing, maxHealing) : totalHealing;
    
    const source: EffectSource = {
      sourcePlayerId: ownerId,
      sourceShipInstanceId: ship.id,
      sourceShipDefId: ship.shipId,
      sourcePowerIndex: power.powerIndex,
      sourceType: 'ship_power'
    };
    
    const effect: TriggeredEffect = createTriggeredEffect({
      id: generateEffectId(source, EffectKind.HEAL, gameState.roundNumber, 0),
      kind: EffectKind.HEAL,
      source,
      target: createSelfTarget(ownerId),
      value: finalHealing,
      persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
      description: `${shipDefinition.name}: ${power.description} (count: ${count}, total: ${finalHealing})`
    });
    
    return this.enqueueEffect(gameState, effect);
  }
  
  /**
   * Execute conditional effect
   */
  private static executeConditional(power: ShipPower, context: PowerExecutionContext): GameState {
    // Delegate to SpecialLogic for conditional handling
    if (power.specialLogic?.customLogicId) {
      return SpecialLogic.executeCustomLogic(
        power.specialLogic.customLogicId,
        power,
        context
      );
    }
    
    console.warn('CONDITIONAL power missing customLogicId');
    return context.gameState;
  }
  
  // ============================================================================
  // COUNTING HELPERS
  // ============================================================================
  
  /**
   * Calculate count for count-based powers
   * ✅ CORRECT: Uses PlayerShip fields and ignores destroyed/consumed ships
   */
  private static calculateCount(power: ShipPower, context: PowerExecutionContext): number {
    const { gameState, ownerId, opponentId, ship } = context;
    const countType = power.specialLogic?.countType;
    const countTarget = power.specialLogic?.countTarget as ShipDefId;
    const countMultiplier = power.specialLogic?.countMultiplier || 1;
    const excludeSelf = power.specialLogic?.excludeSelf || false;
    
    if (!countType) return 0;
    
    let rawCount = 0;
    
    switch (countType) {
      case 'self_ships':
        rawCount = this.countPlayerShips(gameState, ownerId, excludeSelf ? ship.id : undefined);
        break;
        
      case 'opponent_ships':
        rawCount = this.countPlayerShips(gameState, opponentId);
        break;
        
      case 'specific_ship_type':
        if (countTarget) {
          rawCount = this.countSpecificShipType(gameState, ownerId, countTarget, excludeSelf ? ship.id : undefined);
        }
        break;
        
      case 'ship_types':
        rawCount = this.countShipTypes(gameState, ownerId);
        break;
        
      case 'opponent_ship_types':
        rawCount = this.countShipTypes(gameState, opponentId);
        break;
        
      case 'ships_built_this_turn':
        rawCount = this.countShipsBuiltThisTurn(gameState, ownerId);
        break;
        
      default:
        console.warn(`Unknown count type: ${countType}`);
        return 0;
    }
    
    // Apply multiplier (e.g., "every THREE fighters" = divide by 3)
    return Math.floor(rawCount / countMultiplier);
  }
  
  /**
   * Count total ships for a player
   * ✅ CORRECT: Uses isDestroyed and isConsumedInUpgrade (not isDepleted)
   */
  private static countPlayerShips(
    gameState: GameState, 
    playerId: PlayerId, 
    excludeInstanceId?: ShipInstanceId
  ): number {
    const ships = gameState.gameData.ships?.[playerId] || [];
    return ships.filter(ship => 
      !ship.isDestroyed && 
      !ship.isConsumedInUpgrade &&
      ship.id !== excludeInstanceId
    ).length;
  }
  
  /**
   * Count specific ship type for a player
   * ✅ CORRECT: Uses shipId (definition ID) and excludes destroyed/consumed
   */
  private static countSpecificShipType(
    gameState: GameState, 
    playerId: PlayerId, 
    shipDefId: ShipDefId,
    excludeInstanceId?: ShipInstanceId
  ): number {
    const ships = gameState.gameData.ships?.[playerId] || [];
    return ships.filter(ship => 
      ship.shipId === shipDefId && 
      !ship.isDestroyed && 
      !ship.isConsumedInUpgrade &&
      ship.id !== excludeInstanceId
    ).length;
  }
  
  /**
   * Count unique ship types for a player
   * ✅ CORRECT: Uses shipId and excludes destroyed/consumed
   */
  private static countShipTypes(gameState: GameState, playerId: PlayerId): number {
    const ships = gameState.gameData.ships?.[playerId] || [];
    const activeShips = ships.filter(ship => !ship.isDestroyed && !ship.isConsumedInUpgrade);
    const uniqueTypes = new Set(activeShips.map(ship => ship.shipId));
    return uniqueTypes.size;
  }
  
  /**
   * Count ships built this turn
   * Note: PlayerShip doesn't have createdOnTurn - need to track separately
   * For now, this returns 0 until ship creation tracking is added
   */
  private static countShipsBuiltThisTurn(gameState: GameState, playerId: PlayerId): number {
    // TODO: Add createdOnTurn to PlayerShip or track separately in TurnData
    console.warn('countShipsBuiltThisTurn not yet implemented - requires createdOnTurn tracking');
    return 0;
  }
  
  // ============================================================================
  // POWER USAGE TRACKING
  // ============================================================================
  
  /**
   * Record power usage in game state
   * Used for ONCE_ONLY_AUTOMATIC powers to prevent re-execution
   */
  static recordPowerUsage(
    gameState: GameState,
    ship: PlayerShip,
    power: ShipPower,
    effect: string
  ): GameState {
    const onceOnlyEffects = gameState.gameData.turnData?.onceOnlyAutomaticEffects || [];
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData.turnData,
          onceOnlyAutomaticEffects: [
            ...onceOnlyEffects,
            {
              shipId: ship.id,  // ✅ Instance ID
              effectType: `power_${power.powerIndex}`
            }
          ]
        }
      }
    };
  }
}

export default PowerExecutor;