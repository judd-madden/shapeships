// Special Logic - Handles complex ship powers with customLogicId
// Each complex ship gets its own handler function

import type { GameState } from '../types/GameTypes';
import type {
  ShipPower,
  ShipInstance,
  PowerExecutionContext
} from '../types/ShipTypes';
import { getShipById } from '../data/ShipDefinitions';

// ============================================================================
// ROUTER
// ============================================================================

export class SpecialLogic {
  
  /**
   * Route to appropriate special logic handler
   */
  static executeCustomLogic(
    customLogicId: string,
    power: ShipPower,
    context: PowerExecutionContext
  ): GameState {
    
    switch (customLogicId) {
      // Once-only powers
      case 'once_only_on_build':
        return this.handleOnceOnlyOnBuild(power, context);
        
      // Frigate
      case 'frigate_choose_trigger':
        return this.handleFrigateChooseTrigger(power, context);
      case 'frigate_conditional_damage':
        return this.handleFrigateConditionalDamage(power, context);
        
      // Science Vessel
      case 'science_vessel_scaling':
        return this.handleScienceVesselScaling(power, context);
        
      // Dreadnought
      case 'dreadnought_trigger':
        return this.handleDreadnoughtTrigger(power, context);
        
      // Leviathan
      case 'leviathan_force_dice':
        return this.handleLeviathanForceDice(power, context);
        
      // Evolver
      case 'evolver_transform':
        return this.handleEvolverTransform(power, context);
        
      // Zenith
      case 'zenith_build_antlion':
        return this.handleZenithBuildAntlion(power, context);
      case 'zenith_dice_conditional':
        return this.handleZenithDiceConditional(power, context);
      case 'zenith_upon_destruction':
        return this.handleZenithUponDestruction(power, context);
        
      // Defense Swarm
      case 'defense_swarm_conditional_heal':
        return this.handleDefenseSwarmConditionalHeal(power, context);
        
      // Antlion Array
      case 'antlion_array_conditional_damage':
        return this.handleAntlionArrayConditionalDamage(power, context);
        
      // Sacrificial Pool
      case 'sacrificial_pool_sacrifice':
        return this.handleSacrificialPoolSacrifice(power, context);
      case 'sacrificial_pool_protection':
        // Passive - handled by PassiveModifiers
        return context.gameState;
        
      // Queen
      case 'queen_build_xenite':
        return this.handleQueenBuildXenite(power, context);
      case 'queen_count_ships_made':
        return this.handleQueenCountShipsMade(power, context);
        
      // Chronoswarm
      case 'chronoswarm_extra_phase':
        return this.handleChronoswarmExtraPhase(power, context);
      case 'chronoswarm_scaling':
        return this.handleChronoswarmScaling(power, context);
        
      // Hive
      case 'hive_passive':
        // Passive - handled by PassiveModifiers
        return context.gameState;
        
      // Ark of Terror
      case 'terror_heal_dice':
        return this.handleTerrorHealDice(power, context);
        
      // Ark of Fury
      case 'fury_damage_dice':
        return this.handleFuryDamageDice(power, context);
        
      // Ark of Knowledge
      case 'ark_knowledge_scaling':
        return this.handleArkKnowledgeScaling(power, context);
        
      // Ark of Entropy
      case 'entropy_self_damage':
        return this.handleEntropySelfDamage(power, context);
        
      // Ark of Redemption
      case 'redemption_set_health_max':
        return this.handleRedemptionSetHealthMax(power, context);
        
      // Quantum Mystic
      case 'quantum_conditional_energy':
        return this.handleQuantumConditionalEnergy(power, context);
      case 'quantum_conditional_heal':
        return this.handleQuantumConditionalHeal(power, context);
        
      // Spiral
      case 'spiral_scaling':
        return this.handleSpiralScaling(power, context);
        
      // Cube
      case 'cube_repeat_solar':
        return this.handleCubeRepeatSolar(power, context);
        
      // Ship of Vigor
      case 'vigor_even_dice':
        return this.handleVigorEvenDice(power, context);
        
      // Ark of Power
      case 'power_even_dice':
        return this.handlePowerEvenDice(power, context);
        
      // Ark of Domination
      case 'domination_steal_ships':
        return this.handleDominationStealShips(power, context);
        
      // Ship of Equality
      case 'equality_destroy_equal_cost':
        return this.handleEqualityDestroyEqualCost(power, context);
        
      default:
        console.warn(`Unknown custom logic ID: ${customLogicId}`);
        return context.gameState;
    }
  }
  
  // ============================================================================
  // ONCE-ONLY POWERS
  // ============================================================================
  
  /**
   * Once-only effect on turn built
   */
  private static handleOnceOnlyOnBuild(power: ShipPower, context: PowerExecutionContext): GameState {
    const { ship, currentTurn } = context;
    
    // Only execute on the turn the ship was built
    if (ship.createdOnTurn !== currentTurn) {
      return context.gameState;
    }
    
    // Check if already used
    const alreadyUsed = ship.powerUsageHistory.some(
      usage => usage.powerIndex === power.powerIndex
    );
    
    if (alreadyUsed) {
      return context.gameState;
    }
    
    // Execute the base effect (damage or healing)
    const amount = power.baseAmount || 0;
    let gameState = context.gameState;
    
    if (power.description.toLowerCase().includes('heal')) {
      gameState = this.addPendingHealing(gameState, context.ownerId, amount);
    } else if (power.description.toLowerCase().includes('damage')) {
      gameState = this.addPendingDamage(gameState, context.opponentId, amount);
    }
    
    // Record usage
    return this.recordPowerUsage(gameState, ship, power, `Once-only: ${amount}`);
  }
  
  // ============================================================================
  // FRIGATE
  // ============================================================================
  
  /**
   * Frigate: Choose trigger number (1-6)
   */
  private static handleFrigateChooseTrigger(power: ShipPower, context: PowerExecutionContext): GameState {
    // This requires player choice - should be handled during Drawing phase
    // The chosen number is stored in ship.configuration.frigate_trigger
    // For now, just return unchanged state
    console.log('Frigate trigger selection requires player choice');
    return context.gameState;
  }
  
  /**
   * Frigate: Conditional damage if dice matches trigger
   */
  private static handleFrigateConditionalDamage(power: ShipPower, context: PowerExecutionContext): GameState {
    const { ship, gameState, opponentId } = context;
    
    // Get trigger number from configuration
    const triggerNumber = ship.configuration?.frigate_trigger;
    if (!triggerNumber) {
      console.warn('Frigate missing trigger number configuration');
      return gameState;
    }
    
    // Get current dice roll
    const diceRoll = gameState.gameData.turnData?.diceRoll;
    if (diceRoll === undefined) {
      return gameState;
    }
    
    // Check if dice matches trigger
    if (diceRoll === triggerNumber) {
      const damage = power.baseAmount || 6;
      return this.addPendingDamage(gameState, opponentId, damage);
    }
    
    return gameState;
  }
  
  // ============================================================================
  // SCIENCE VESSEL
  // ============================================================================
  
  /**
   * Science Vessel: Quantity-based scaling effects
   */
  private static handleScienceVesselScaling(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    
    // Count Science Vessels
    const scienceVesselCount = this.countSpecificShipType(gameState, ownerId, 'SCI');
    
    // Check power description to determine which scaling level
    if (power.description.includes('1 Science Vessel') && scienceVesselCount >= 1) {
      // Double automatic healing - this is a modifier, tracked in turnData
      return this.setTurnModifier(gameState, ownerId, 'double_automatic_healing', true);
    }
    
    if (power.description.includes('2 Science Vessels') && scienceVesselCount >= 2) {
      // Double automatic damage
      return this.setTurnModifier(gameState, ownerId, 'double_automatic_damage', true);
    }
    
    if (power.description.includes('3 Science Vessels') && scienceVesselCount >= 3) {
      // Generate lines equal to dice roll
      const diceRoll = gameState.gameData.turnData?.diceRoll || 0;
      return this.addLines(gameState, ownerId, diceRoll);
    }
    
    return gameState;
  }
  
  // ============================================================================
  // DREADNOUGHT
  // ============================================================================
  
  /**
   * Dreadnought: Trigger on ship completion
   */
  private static handleDreadnoughtTrigger(power: ShipPower, context: PowerExecutionContext): GameState {
    // This is an event-driven power that triggers when other ships are built
    // Handled separately by the ship building system
    console.log('Dreadnought trigger handled by ship building system');
    return context.gameState;
  }
  
  // ============================================================================
  // LEVIATHAN
  // ============================================================================
  
  /**
   * Leviathan: Force all dice rolls to 6
   */
  private static handleLeviathanForceDice(power: ShipPower, context: PowerExecutionContext): GameState {
    // This is handled during dice roll phase by PassiveModifiers
    return context.gameState;
  }
  
  // ============================================================================
  // EVOLVER
  // ============================================================================
  
  /**
   * Evolver: Transform Xenite → Oxite/Asterite
   */
  private static handleEvolverTransform(power: ShipPower, context: PowerExecutionContext): GameState {
    // This requires player choice - should be handled during Drawing phase
    console.log('Evolver transformation requires player choice');
    return context.gameState;
  }
  
  // ============================================================================
  // ZENITH
  // ============================================================================
  
  /**
   * Zenith: Build Antlion when built
   */
  private static handleZenithBuildAntlion(power: ShipPower, context: PowerExecutionContext): GameState {
    const { ship, currentTurn } = context;
    
    // Only on turn built
    if (ship.createdOnTurn !== currentTurn) {
      return context.gameState;
    }
    
    // Build Antlion
    return this.buildShip(context.gameState, context.ownerId, 'ANT', currentTurn);
  }
  
  /**
   * Zenith: Dice conditional ship building
   */
  private static handleZenithDiceConditional(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, currentTurn } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll;
    
    if (diceRoll === undefined) return gameState;
    
    let updatedState = gameState;
    
    // Dice 2: Make Xenite
    if (diceRoll === 2) {
      updatedState = this.buildShip(updatedState, ownerId, 'XEN', currentTurn);
    }
    // Dice 3: Make Antlion
    else if (diceRoll === 3) {
      updatedState = this.buildShip(updatedState, ownerId, 'ANT', currentTurn);
    }
    // Dice 4: Make two Xenites
    else if (diceRoll === 4) {
      updatedState = this.buildShip(updatedState, ownerId, 'XEN', currentTurn);
      updatedState = this.buildShip(updatedState, ownerId, 'XEN', currentTurn);
    }
    
    return updatedState;
  }
  
  /**
   * Zenith: Upon destruction, make two Xenites
   */
  private static handleZenithUponDestruction(power: ShipPower, context: PowerExecutionContext): GameState {
    // This is triggered when ship is destroyed - handled separately
    // Effect persists even if source is destroyed
    console.log('Zenith upon destruction handled separately');
    return context.gameState;
  }
  
  // ============================================================================
  // DEFENSE SWARM & ANTLION ARRAY
  // ============================================================================
  
  /**
   * Defense Swarm: Heal 3 OR heal 7 if health lower
   */
  private static handleDefenseSwarmConditionalHeal(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, opponentId } = context;
    
    const owner = gameState.players.find(p => p.id === ownerId);
    const opponent = gameState.players.find(p => p.id === opponentId);
    
    if (!owner || !opponent) return gameState;
    
    // Check if health is lower at start of turn
    const ownerHealth = owner.health || 0;
    const opponentHealth = opponent.health || 0;
    
    const healAmount = ownerHealth < opponentHealth ? 7 : 3;
    
    return this.addPendingHealing(gameState, ownerId, healAmount);
  }
  
  /**
   * Antlion Array: Deal 3 damage OR deal 7 if health lower
   */
  private static handleAntlionArrayConditionalDamage(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, opponentId } = context;
    
    const owner = gameState.players.find(p => p.id === ownerId);
    const opponent = gameState.players.find(p => p.id === opponentId);
    
    if (!owner || !opponent) return gameState;
    
    // Check if health is lower at start of turn
    const ownerHealth = owner.health || 0;
    const opponentHealth = opponent.health || 0;
    
    const damageAmount = ownerHealth < opponentHealth ? 7 : 3;
    
    return this.addPendingDamage(gameState, opponentId, damageAmount);
  }
  
  // ============================================================================
  // SACRIFICIAL POOL
  // ============================================================================
  
  /**
   * Sacrificial Pool: Sacrifice ship for Xenites
   */
  private static handleSacrificialPoolSacrifice(power: ShipPower, context: PowerExecutionContext): GameState {
    // This requires player choice - should be handled during Ships That Build
    console.log('Sacrificial Pool sacrifice requires player choice');
    return context.gameState;
  }
  
  // ============================================================================
  // QUEEN
  // ============================================================================
  
  /**
   * Queen: Build Xenite each build phase
   */
  private static handleQueenBuildXenite(power: ShipPower, context: PowerExecutionContext): GameState {
    return this.buildShip(context.gameState, context.ownerId, 'XEN', context.currentTurn);
  }
  
  /**
   * Queen: Count ships made this turn (excluding Queen's Xenite)
   */
  private static handleQueenCountShipsMade(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId, opponentId, currentTurn } = context;
    
    // Get ships built this turn
    const playerShips = gameState.gameData.ships?.[ownerId] || [];
    const shipsBuiltThisTurn = playerShips.filter(ship => ship.createdOnTurn === currentTurn);
    
    // Exclude the Xenite from this Queen (would need more context to identify)
    // For simplicity, count all ships built this turn
    const count = shipsBuiltThisTurn.length;
    
    const damagePerShip = 3;
    const totalDamage = count * damagePerShip;
    
    return this.addPendingDamage(gameState, opponentId, totalDamage);
  }
  
  // ============================================================================
  // CHRONOSWARM
  // ============================================================================
  
  /**
   * Chronoswarm: Extra build phase
   */
  private static handleChronoswarmExtraPhase(power: ShipPower, context: PowerExecutionContext): GameState {
    // This triggers an extra phase - handled by GamePhases engine
    console.log('Chronoswarm extra phase handled by GamePhases engine');
    return context.gameState;
  }
  
  /**
   * Chronoswarm: Quantity scaling (2 = roll 2 dice, 3 = roll 3 dice)
   */
  private static handleChronoswarmScaling(power: ShipPower, context: PowerExecutionContext): GameState {
    // This affects dice rolling - handled by dice roll phase
    return context.gameState;
  }
  
  // ============================================================================
  // ARK OF TERROR & ARK OF FURY
  // ============================================================================
  
  /**
   * Ark of Terror: Heal equal to dice roll
   */
  private static handleTerrorHealDice(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll || 0;
    
    return this.addPendingHealing(gameState, ownerId, diceRoll);
  }
  
  /**
   * Ark of Fury: Damage equal to dice roll
   */
  private static handleFuryDamageDice(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, opponentId } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll || 0;
    
    return this.addPendingDamage(gameState, opponentId, diceRoll);
  }
  
  // ============================================================================
  // ARK OF KNOWLEDGE
  // ============================================================================
  
  /**
   * Ark of Knowledge: Reroll dice and scaling effects
   */
  private static handleArkKnowledgeScaling(power: ShipPower, context: PowerExecutionContext): GameState {
    // Reroll handled by dice phase
    // Equalization handled by EndOfTurnResolver
    return context.gameState;
  }
  
  // ============================================================================
  // ARK OF ENTROPY
  // ============================================================================
  
  /**
   * Ark of Entropy: Take self-damage
   */
  private static handleEntropySelfDamage(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const amount = power.baseAmount || 4;
    
    return this.addPendingDamage(gameState, ownerId, amount);
  }
  
  // ============================================================================
  // ARK OF REDEMPTION
  // ============================================================================
  
  /**
   * Ark of Redemption: Set health to maximum
   */
  private static handleRedemptionSetHealthMax(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    
    const player = gameState.players.find(p => p.id === ownerId);
    if (!player) return gameState;
    
    const maxHealth = player.maxHealth || 100;
    
    return {
      ...gameState,
      players: gameState.players.map(p =>
        p.id === ownerId
          ? { ...p, health: maxHealth }
          : p
      )
    };
  }
  
  // ============================================================================
  // QUANTUM MYSTIC
  // ============================================================================
  
  /**
   * Quantum Mystic: Conditional energy on dice 1-2
   */
  private static handleQuantumConditionalEnergy(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll;
    
    if (diceRoll === 1 || diceRoll === 2) {
      return this.addEnergy(gameState, ownerId, 'blue', 1);
    }
    
    return gameState;
  }
  
  /**
   * Quantum Mystic: Conditional heal on dice 1-2
   */
  private static handleQuantumConditionalHeal(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll;
    
    if (diceRoll === 1 || diceRoll === 2) {
      return this.addPendingHealing(gameState, ownerId, 5);
    }
    
    return gameState;
  }
  
  // ============================================================================
  // SPIRAL
  // ============================================================================
  
  /**
   * Spiral: Quantity scaling effects
   */
  private static handleSpiralScaling(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    
    // Count Spirals
    const spiralCount = this.countSpecificShipType(gameState, ownerId, 'SPI');
    
    // Different effects based on quantity
    if (power.description.includes('one') && spiralCount >= 1) {
      // Heal 1 per energy spent - tracked during energy spending
      return gameState;
    }
    
    if (power.description.includes('two') && spiralCount >= 2) {
      // Increase max health by 15 - passive modifier
      return gameState;
    }
    
    if (power.description.includes('three') && spiralCount >= 3) {
      // Deal 1 damage per energy spent - tracked during energy spending
      return gameState;
    }
    
    return gameState;
  }
  
  // ============================================================================
  // CUBE
  // ============================================================================
  
  /**
   * Cube: Repeat a solar power
   */
  private static handleCubeRepeatSolar(power: ShipPower, context: PowerExecutionContext): GameState {
    // This requires player choice of which solar power to repeat
    console.log('Cube repeat solar requires player choice');
    return context.gameState;
  }
  
  // ============================================================================
  // SHIP OF VIGOR & ARK OF POWER
  // ============================================================================
  
  /**
   * Ship of Vigor: Generate lines on even dice
   */
  private static handleVigorEvenDice(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll;
    
    if (diceRoll && diceRoll % 2 === 0) {
      return this.addLines(gameState, ownerId, 2);
    }
    
    return gameState;
  }
  
  /**
   * Ark of Power: Generate 4 lines on even dice
   */
  private static handlePowerEvenDice(power: ShipPower, context: PowerExecutionContext): GameState {
    const { gameState, ownerId } = context;
    const diceRoll = gameState.gameData.turnData?.diceRoll;
    
    if (diceRoll && diceRoll % 2 === 0) {
      return this.addLines(gameState, ownerId, 4);
    }
    
    return gameState;
  }
  
  // ============================================================================
  // ARK OF DOMINATION
  // ============================================================================
  
  /**
   * Ark of Domination: Steal two ships
   */
  private static handleDominationStealShips(power: ShipPower, context: PowerExecutionContext): GameState {
    // This requires player choice - should be handled during First Strike
    console.log('Domination steal requires player choice');
    return context.gameState;
  }
  
  // ============================================================================
  // SHIP OF EQUALITY
  // ============================================================================
  
  /**
   * Ship of Equality: Destroy equal cost ships
   */
  private static handleEqualityDestroyEqualCost(power: ShipPower, context: PowerExecutionContext): GameState {
    // This requires player choice - should be handled during Simultaneous Declaration
    console.log('Equality destroy requires player choice');
    return context.gameState;
  }
  
  // ============================================================================
  // UTILITY HELPERS
  // ============================================================================
  
  private static buildShip(gameState: GameState, ownerId: string, shipId: string, currentTurn: number): GameState {
    const newShip: ShipInstance = {
      definitionId: shipId,
      instanceId: `${shipId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ownerId,
      chargesRemaining: undefined,
      isDepleted: false,
      createdOnTurn: currentTurn,
      usedThisTurn: false,
      powerUsageHistory: []
    };
    
    const shipDef = getShipById(shipId);
    if (shipDef?.maxCharges) {
      newShip.chargesRemaining = shipDef.maxCharges;
    }
    
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
  
  private static addPendingDamage(gameState: GameState, targetPlayerId: string, amount: number): GameState {
    const pendingDamage = gameState.gameData.turnData?.pendingDamage || {};
    const currentDamage = pendingDamage[targetPlayerId] || 0;
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData.turnData,
          pendingDamage: {
            ...pendingDamage,
            [targetPlayerId]: currentDamage + amount
          }
        }
      }
    };
  }
  
  private static addPendingHealing(gameState: GameState, targetPlayerId: string, amount: number): GameState {
    const pendingHealing = gameState.gameData.turnData?.pendingHealing || {};
    const currentHealing = pendingHealing[targetPlayerId] || 0;
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData.turnData,
          pendingHealing: {
            ...pendingHealing,
            [targetPlayerId]: currentHealing + amount
          }
        }
      }
    };
  }
  
  private static addLines(gameState: GameState, playerId: string, amount: number): GameState {
    return {
      ...gameState,
      players: gameState.players.map(p =>
        p.id === playerId
          ? { ...p, lines: (p.lines || 0) + amount }
          : p
      )
    };
  }
  
  private static addEnergy(gameState: GameState, playerId: string, color: 'red' | 'green' | 'blue', amount: number): GameState {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.faction !== 'ancient') return gameState;
    
    const energy = { ...(player.energy || { red: 0, green: 0, blue: 0 }) };
    energy[color] = (energy[color] || 0) + amount;
    
    return {
      ...gameState,
      players: gameState.players.map(p =>
        p.id === playerId
          ? { ...p, energy }
          : p
      )
    };
  }
  
  private static setTurnModifier(gameState: GameState, playerId: string, modifier: string, value: any): GameState {
    const turnModifiers = gameState.gameData.turnData?.modifiers || {};
    const playerModifiers = turnModifiers[playerId] || {};
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData.turnData,
          modifiers: {
            ...turnModifiers,
            [playerId]: {
              ...playerModifiers,
              [modifier]: value
            }
          }
        }
      }
    };
  }
  
  private static countSpecificShipType(gameState: GameState, playerId: string, shipId: string): number {
    const ships = gameState.gameData.ships?.[playerId] || [];
    return ships.filter(ship =>
      ship.definitionId === shipId && !ship.isDepleted && !ship.isDestroyed
    ).length;
  }
  
  private static recordPowerUsage(gameState: GameState, ship: ShipInstance, power: ShipPower, effect: string): GameState {
    const { ownerId, instanceId } = ship;
    const ownerShips = gameState.gameData.ships?.[ownerId] || [];
    
    const updatedShips = ownerShips.map(s => {
      if (s.instanceId === instanceId) {
        return {
          ...s,
          powerUsageHistory: [
            ...s.powerUsageHistory,
            {
              turn: gameState.roundNumber,
              powerIndex: power.powerIndex,
              phase: power.phase,
              effect
            }
          ]
        };
      }
      return s;
    });
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        ships: {
          ...gameState.gameData.ships,
          [ownerId]: updatedShips
        }
      }
    };
  }
}

export default SpecialLogic;
