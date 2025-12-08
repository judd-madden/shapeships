// Game phases engine - handles Shapeships turn structure with 3 major phases and 13 subphases
// Dynamic subphase checking based on ships in play, synchronous player progression
// 
// IMPORTANT: Phase requirements are recalculated when ships are built during:
// - SubPhase 4 (Ships that Build): When ships build other ships via powers
// - SubPhase 5 (Drawing): When players spend lines to build ships
// This ensures newly built ships can add their required subphases to the current turn

import { GameState, GameAction, Player } from '../types/GameTypes';
import SpeciesIntegration from './SpeciesIntegration';

// Major phases containing numbered subphases
export enum MajorPhase {
  BUILD_PHASE = 'build_phase',
  BATTLE_PHASE = 'battle_phase', 
  HEALTH_RESOLUTION = 'health_resolution',
  END_OF_GAME = 'end_of_game'
}

// All possible subphases (numbered 1-13)
export enum SubPhase {
  ROLL_DICE = 1,              // [always run] 
  DICE_MANIPULATION = 2,      // conditional
  LINE_GENERATION = 3,        // [always run]
  SHIPS_THAT_BUILD = 4,       // conditional
  DRAWING = 5,                // [always run]
  UPON_COMPLETION = 6,        // conditional
  END_BUILD_PHASE = 7,        // conditional
  FIRST_STRIKE = 8,           // conditional
  CHARGE_DECLARATION = 9,     // conditional
  CHARGE_RESPONSE = 10,       // conditional (if charges declared)
  CHARGE_RESOLUTION = 11,     // conditional (if charges declared)
  AUTOMATIC = 12,             // [always run]
  END_OF_BATTLE_PHASE = 13    // conditional
}

// Subphases that always run regardless of ships
export const ALWAYS_RUN_SUBPHASES = [
  SubPhase.ROLL_DICE,
  SubPhase.LINE_GENERATION,
  SubPhase.DRAWING,
  SubPhase.AUTOMATIC
];

export interface SubPhaseRequirement {
  subPhase: SubPhase;
  majorPhase: MajorPhase;
  alwaysRun: boolean;
  requiredBy: string[]; // Ship types or powers that require this subphase
  playersWithRequiredShips: string[]; // Player IDs who have ships requiring this subphase
  description: string;
}

export interface PlayerReadiness {
  playerId: string;
  isReady: boolean;
  declaredAt?: string;
  currentSubPhase: number;
}

export interface TurnData {
  turnNumber: number;
  currentMajorPhase: MajorPhase;
  currentSubPhase: SubPhase;
  requiredSubPhases: SubPhaseRequirement[];
  diceRoll?: number;
  linesDistributed?: boolean;
  accumulatedDamage: { [playerId: string]: number };
  accumulatedHealing: { [playerId: string]: number };
  healthAtTurnStart: { [playerId: string]: number };
  chargesDeclared: boolean;
}

export interface SubPhaseTransition {
  fromMajorPhase: MajorPhase;
  fromSubPhase: SubPhase | null;
  toMajorPhase: MajorPhase;
  toSubPhase: SubPhase | null;
  condition: (gameState: GameState) => boolean;
  onTransition?: (gameState: GameState) => GameState;
}

export class GamePhasesEngine {

  // Get current major phase and subphase
  getCurrentMajorPhase(gameState: GameState): MajorPhase {
    return (gameState.gameData?.turnData?.currentMajorPhase as MajorPhase) || MajorPhase.BUILD_PHASE;
  }

  getCurrentSubPhase(gameState: GameState): SubPhase {
    return (gameState.gameData?.turnData?.currentSubPhase as SubPhase) || SubPhase.ROLL_DICE;
  }

  // Get all required subphases for current turn based on ships in play
  getRequiredSubPhasesForTurn(gameState: GameState): SubPhaseRequirement[] {
    const requirements: SubPhaseRequirement[] = [];

    // BUILD PHASE subphases (1-7)
    requirements.push(...this.getBuildPhaseRequirements(gameState));
    
    // BATTLE PHASE subphases (8-13) 
    requirements.push(...this.getBattlePhaseRequirements(gameState));

    return requirements;
  }

  private getBuildPhaseRequirements(gameState: GameState): SubPhaseRequirement[] {
    const requirements: SubPhaseRequirement[] = [];

    // 1. Roll Dice [always run]
    requirements.push({
      subPhase: SubPhase.ROLL_DICE,
      majorPhase: MajorPhase.BUILD_PHASE,
      alwaysRun: true,
      requiredBy: ['system'],
      playersWithRequiredShips: [], // Automatic, no player action needed
      description: 'Roll d6 automatically for all players'
    });

    // 2. Dice Manipulation (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.DICE_MANIPULATION)) {
      requirements.push({
        subPhase: SubPhase.DICE_MANIPULATION,
        majorPhase: MajorPhase.BUILD_PHASE,
        alwaysRun: false,
        requiredBy: ['dice_manipulation_powers'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.DICE_MANIPULATION),
        description: 'Some ships can interact with dice roll before lines are given'
      });
    }

    // 3. Line Generation [always run]
    requirements.push({
      subPhase: SubPhase.LINE_GENERATION,
      majorPhase: MajorPhase.BUILD_PHASE,
      alwaysRun: true,
      requiredBy: ['system'],
      playersWithRequiredShips: [], // Automatic calculation
      description: 'Add dice roll + bonus lines + saved lines'
    });

    // 4. Ships That Build (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.SHIPS_THAT_BUILD)) {
      requirements.push({
        subPhase: SubPhase.SHIPS_THAT_BUILD,
        majorPhase: MajorPhase.BUILD_PHASE,
        alwaysRun: false,
        requiredBy: ['ship_building_powers'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.SHIPS_THAT_BUILD),
        description: 'Some ships can build other ships before Drawing phase - triggers phase recalculation'
      });
    }

    // 5. Drawing [always run]
    requirements.push({
      subPhase: SubPhase.DRAWING,
      majorPhase: MajorPhase.BUILD_PHASE,
      alwaysRun: true,
      requiredBy: ['system'],
      playersWithRequiredShips: gameState.players.map(p => p.id),
      description: 'Players spend lines to build ships - triggers phase recalculation when ships are built'
    });

    // 6. Upon Completion (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.UPON_COMPLETION)) {
      requirements.push({
        subPhase: SubPhase.UPON_COMPLETION,
        majorPhase: MajorPhase.BUILD_PHASE,
        alwaysRun: false,
        requiredBy: ['upon_completion_powers'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.UPON_COMPLETION),
        description: 'Powers that trigger once when ship is built'
      });
    }

    // 7. End Build Phase (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.END_BUILD_PHASE)) {
      requirements.push({
        subPhase: SubPhase.END_BUILD_PHASE,
        majorPhase: MajorPhase.BUILD_PHASE,
        alwaysRun: false,
        requiredBy: ['end_build_phase_powers'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.END_BUILD_PHASE),
        description: 'Powers that trigger at end of build phase'
      });
    }

    return requirements;
  }

  private getBattlePhaseRequirements(gameState: GameState): SubPhaseRequirement[] {
    const requirements: SubPhaseRequirement[] = [];

    // 8. First Strike (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.FIRST_STRIKE)) {
      requirements.push({
        subPhase: SubPhase.FIRST_STRIKE,
        majorPhase: MajorPhase.BATTLE_PHASE,
        alwaysRun: false,
        requiredBy: ['first_strike_powers', 'guardian'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.FIRST_STRIKE),
        description: 'Ships get opportunity to act first in Battle Phase'
      });
    }

    // 9. Charge Declaration (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.CHARGE_DECLARATION)) {
      requirements.push({
        subPhase: SubPhase.CHARGE_DECLARATION,
        majorPhase: MajorPhase.BATTLE_PHASE,
        alwaysRun: false,
        requiredBy: ['charge_powers', 'solar_powers'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.CHARGE_DECLARATION),
        description: 'Players may use ships with charges, Ancients may use Solar Powers'
      });
    }

    // 10. Charge Response (conditional - only if charges declared)
    const chargesDeclared = gameState.gameData?.turnData?.chargesDeclared || false;
    if (chargesDeclared) {
      requirements.push({
        subPhase: SubPhase.CHARGE_RESPONSE,
        majorPhase: MajorPhase.BATTLE_PHASE,
        alwaysRun: false,
        requiredBy: ['charge_response'],
        playersWithRequiredShips: gameState.players.map(p => p.id),
        description: 'Each player may use charges or Solar Powers in response'
      });
    }

    // 11. Charge Resolution (conditional - only if charges declared)
    if (chargesDeclared) {
      requirements.push({
        subPhase: SubPhase.CHARGE_RESOLUTION,
        majorPhase: MajorPhase.BATTLE_PHASE,
        alwaysRun: false,
        requiredBy: ['charge_resolution'],
        playersWithRequiredShips: [], // Automatic resolution
        description: 'Any declared charge powers resolve now'
      });
    }

    // 12. Automatic [always run]
    requirements.push({
      subPhase: SubPhase.AUTOMATIC,
      majorPhase: MajorPhase.BATTLE_PHASE,
      alwaysRun: true,
      requiredBy: ['system'],
      playersWithRequiredShips: [], // Automatic calculation
      description: 'Count all ships damage and healing that occurs in battle phase'
    });

    // 13. End of Battle Phase (conditional)
    if (SpeciesIntegration.hasShipsRequiringSubPhase(gameState, SubPhase.END_OF_BATTLE_PHASE)) {
      requirements.push({
        subPhase: SubPhase.END_OF_BATTLE_PHASE,
        majorPhase: MajorPhase.BATTLE_PHASE,
        alwaysRun: false,
        requiredBy: ['end_battle_phase_powers'],
        playersWithRequiredShips: SpeciesIntegration.getPlayersWithShipsRequiringSubPhase(gameState, SubPhase.END_OF_BATTLE_PHASE),
        description: 'Powers that trigger at end of battle phase'
      });
    }

    return requirements;
  }

  // Check if all players are ready for the current subphase
  areAllPlayersReady(gameState: GameState): boolean {
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    const playerReadiness = gameState.gameData?.phaseReadiness as PlayerReadiness[] || [];
    
    // Get players who need to act in this subphase
    const requiredSubPhases = this.getRequiredSubPhasesForTurn(gameState);
    const currentSubPhaseReq = requiredSubPhases.find(req => req.subPhase === currentSubPhase);
    
    if (!currentSubPhaseReq) {
      // Subphase not required, can advance
      return true;
    }

    // If no players need to act (automatic subphase), advance immediately
    if (currentSubPhaseReq.playersWithRequiredShips.length === 0) {
      return true;
    }

    // Check if all players who need to act are ready for current subphase
    const playersWhoNeedToAct = currentSubPhaseReq.playersWithRequiredShips;
    return playersWhoNeedToAct.every(playerId => {
      const playerReadiness = playerReadiness.find(pr => pr.playerId === playerId);
      return playerReadiness?.isReady && playerReadiness?.currentSubPhase === currentSubPhase;
    });
  }

  // Mark a player as ready for the current subphase
  setPlayerReady(gameState: GameState, playerId: string): GameState {
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    const currentReadiness = gameState.gameData?.phaseReadiness as PlayerReadiness[] || [];
    
    // Remove any existing readiness for this player
    const updatedReadiness = currentReadiness.filter(pr => pr.playerId !== playerId);
    
    // Add new readiness for current subphase
    updatedReadiness.push({
      playerId,
      isReady: true,
      currentSubPhase,
      declaredAt: new Date().toISOString()
    });

    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: updatedReadiness
      }
    };
  }

  // Clear all player readiness (when advancing to next subphase)
  clearPlayerReadiness(gameState: GameState): GameState {
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: []
      }
    };
  }

  // Recalculate required subphases when ships are built during Ships that Build or Drawing phases
  recalculateRequiredSubPhases(gameState: GameState): GameState {
    const requiredSubPhases = this.getRequiredSubPhasesForTurn(gameState);
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData?.turnData,
          requiredSubPhases
        }
      }
    };
  }

  // Check if a ship building action should trigger phase recalculation
  shouldRecalculateAfterShipBuilding(currentSubPhase: SubPhase): boolean {
    return currentSubPhase === SubPhase.SHIPS_THAT_BUILD || currentSubPhase === SubPhase.DRAWING;
  }

  // Process ship building action and recalculate phases if needed
  processShipBuildingAction(gameState: GameState, action: GameAction): GameState {
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    
    // Apply the ship building action to game state first
    let updatedGameState = gameState; // This would be processed by RulesEngine
    
    // Check if we need to recalculate required subphases
    if (this.shouldRecalculateAfterShipBuilding(currentSubPhase)) {
      updatedGameState = this.recalculateRequiredSubPhases(updatedGameState);
      
      console.log(`Recalculated required subphases after ship building in subphase ${currentSubPhase}`);
    }
    
    return updatedGameState;
  }

  // Check if a subphase transition should occur
  shouldTransitionSubPhase(gameState: GameState): SubPhaseTransition | null {
    const currentMajorPhase = this.getCurrentMajorPhase(gameState);
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    
    // Check if all players are ready first
    if (!this.areAllPlayersReady(gameState)) {
      return null;
    }

    // Get next subphase in sequence
    const nextSubPhase = this.getNextRequiredSubPhase(gameState, currentSubPhase);
    
    if (nextSubPhase) {
      // Check if we're transitioning to a new major phase
      const nextMajorPhase = this.getMajorPhaseForSubPhase(nextSubPhase);
      
      return {
        fromMajorPhase: currentMajorPhase,
        fromSubPhase: currentSubPhase,
        toMajorPhase: nextMajorPhase,
        toSubPhase: nextSubPhase,
        condition: () => true, // Already checked readiness above
        onTransition: (state) => this.clearPlayerReadiness(state)
      };
    }

    // Check if we should move to Health Resolution
    if (currentMajorPhase === MajorPhase.BATTLE_PHASE) {
      return {
        fromMajorPhase: currentMajorPhase,
        fromSubPhase: currentSubPhase,
        toMajorPhase: MajorPhase.HEALTH_RESOLUTION, 
        toSubPhase: null, // Health Resolution is not a numbered subphase
        condition: () => true,
        onTransition: (state) => this.resolveHealthAndCheckGameEnd(state)
      };
    }

    // Check for game over conditions during Health Resolution
    if (currentMajorPhase === MajorPhase.HEALTH_RESOLUTION) {
      if (this.shouldEndGame(gameState)) {
        return {
          fromMajorPhase: currentMajorPhase,
          fromSubPhase: null,
          toMajorPhase: MajorPhase.END_OF_GAME,
          toSubPhase: null,
          condition: () => true,
          onTransition: (state) => this.determineVictoryType(state)
        };
      } else {
        // Start new turn
        return {
          fromMajorPhase: currentMajorPhase,
          fromSubPhase: null,
          toMajorPhase: MajorPhase.BUILD_PHASE,
          toSubPhase: SubPhase.ROLL_DICE,
          condition: () => true,
          onTransition: (state) => this.startNewTurn(state)
        };
      }
    }

    return null;
  }

  // Get the next required subphase in sequence
  private getNextRequiredSubPhase(gameState: GameState, currentSubPhase: SubPhase): SubPhase | null {
    const requiredSubPhases = this.getRequiredSubPhasesForTurn(gameState);
    const currentSubPhaseNum = currentSubPhase as number;
    
    // Find the next required subphase after current one
    for (let i = currentSubPhaseNum + 1; i <= 13; i++) {
      const subPhase = i as SubPhase;
      if (requiredSubPhases.some(req => req.subPhase === subPhase)) {
        return subPhase;
      }
    }
    
    return null; // No more subphases, ready to transition to Health Resolution
  }

  // Get the major phase that contains a given subphase
  private getMajorPhaseForSubPhase(subPhase: SubPhase): MajorPhase {
    if (subPhase >= 1 && subPhase <= 7) {
      return MajorPhase.BUILD_PHASE;
    } else if (subPhase >= 8 && subPhase <= 13) {
      return MajorPhase.BATTLE_PHASE;
    }
    
    return MajorPhase.BUILD_PHASE; // Fallback
  }

  // Get valid actions for the current subphase
  getValidActionsForSubPhase(subPhase: SubPhase, playerId: string, gameState: GameState): string[] {
    // Check if this player needs to act in this subphase
    const requiredSubPhases = this.getRequiredSubPhasesForTurn(gameState);
    const currentSubPhaseReq = requiredSubPhases.find(req => req.subPhase === subPhase);
    
    if (!currentSubPhaseReq || !currentSubPhaseReq.playersWithRequiredShips.includes(playerId)) {
      // Player doesn't need to act in this subphase, only allow ready declaration if needed
      return currentSubPhaseReq?.playersWithRequiredShips.length === 0 ? [] : ['declare_ready'];
    }

    switch (subPhase) {
      case SubPhase.ROLL_DICE:
        return []; // Automatic
        
      case SubPhase.DICE_MANIPULATION:
        return ['use_dice_manipulation', 'declare_ready'];
        
      case SubPhase.LINE_GENERATION:
        return []; // Automatic
        
      case SubPhase.SHIPS_THAT_BUILD:
        // Ships that can build other ships act here - triggers phase recalculation
        return ['use_ship_building_power', 'build_ship_via_power', 'declare_ready'];
        
      case SubPhase.DRAWING:
        // Regular ship building - also triggers phase recalculation
        return ['build_ship', 'save_lines', 'use_drawing_phase_power', 'declare_ready'];
        
      case SubPhase.UPON_COMPLETION:
        return ['trigger_upon_completion_power', 'declare_ready'];
        
      case SubPhase.END_BUILD_PHASE:
        return ['use_end_build_phase_power', 'declare_ready'];
        
      case SubPhase.FIRST_STRIKE:
        return ['use_first_strike_power', 'declare_ready'];
        
      case SubPhase.CHARGE_DECLARATION:
        return ['declare_charge', 'use_solar_power', 'declare_ready'];
        
      case SubPhase.CHARGE_RESPONSE:
        return ['respond_with_charge', 'respond_with_solar_power', 'declare_ready'];
        
      case SubPhase.CHARGE_RESOLUTION:
        return []; // Automatic
        
      case SubPhase.AUTOMATIC:
        return []; // Automatic
        
      case SubPhase.END_OF_BATTLE_PHASE:
        return ['use_end_battle_phase_power', 'declare_ready'];
        
      default:
        return ['declare_ready'];
    }
  }

  // Check if an action is valid for the current subphase
  isActionValidForSubPhase(action: GameAction, gameState: GameState): boolean {
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    const validActions = this.getValidActionsForSubPhase(currentSubPhase, action.playerId, gameState);
    return validActions.includes(action.type);
  }

  // Check if player can act in current subphase (for timer management)
  canPlayerActInSubPhase(playerId: string, gameState: GameState): boolean {
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    const validActions = this.getValidActionsForSubPhase(currentSubPhase, playerId, gameState);
    
    // Player can act if they have any actions available
    return validActions.length > 0;
  }

  // Get players who need to act in current subphase (for timer and UI)
  getPlayersWhoNeedToActInSubPhase(gameState: GameState): string[] {
    const currentSubPhase = this.getCurrentSubPhase(gameState);
    const requiredSubPhases = this.getRequiredSubPhasesForTurn(gameState);
    const currentSubPhaseReq = requiredSubPhases.find(req => req.subPhase === currentSubPhase);
    
    return currentSubPhaseReq?.playersWithRequiredShips || [];
  }

  // Apply a subphase transition
  transitionToSubPhase(gameState: GameState, transition: SubPhaseTransition): GameState {
    let newGameState = {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData?.turnData,
          currentMajorPhase: transition.toMajorPhase,
          currentSubPhase: transition.toSubPhase
        },
        phaseStartTime: new Date().toISOString()
      }
    };

    // Apply transition-specific changes
    if (transition.onTransition) {
      newGameState = transition.onTransition(newGameState);
    }

    return newGameState;
  }

  // Helper methods for health resolution and game end logic
  private resolveHealthAndCheckGameEnd(gameState: GameState): GameState {
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return gameState;

    const players = gameState.players;
    const updatedPlayers = players.map(player => {
      // Get damage/healing from accumulated values AND ship calculations
      const accumulatedDamage = turnData.accumulatedDamage[player.id] || 0;
      const accumulatedHealing = turnData.accumulatedHealing[player.id] || 0;
      
      // Calculate total damage from all other players' ships
      const totalDamageReceived = players
        .filter(p => p.id !== player.id)
        .reduce((total, otherPlayer) => {
          return total + SpeciesIntegration.calculatePlayerDamageOutput(gameState, otherPlayer.id);
        }, 0);
      
      // Calculate healing from own ships
      const totalHealingReceived = SpeciesIntegration.calculatePlayerHealingOutput(gameState, player.id);
      
      const currentHealth = player.health || 25; // Default starting health
      
      // Apply all damage and healing sources
      let newHealth = currentHealth - (accumulatedDamage + totalDamageReceived) + (accumulatedHealing + totalHealingReceived);
      
      // Cap at maximum health (35 for Standard Game)
      newHealth = Math.min(newHealth, 35);
      
      return {
        ...player,
        health: newHealth
      };
    });

    return {
      ...gameState,
      players: updatedPlayers,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          // Clear accumulated damage/healing after resolution
          accumulatedDamage: {},
          accumulatedHealing: {}
        }
      }
    };
  }

  private shouldEndGame(gameState: GameState): boolean {
    const players = gameState.players;
    
    // Check if any player has 0 or below health
    return players.some(player => (player.health || 25) <= 0);
  }

  private determineVictoryType(gameState: GameState): GameState {
    const players = gameState.players;
    const playersAtZeroOrBelow = players.filter(p => (p.health || 25) <= 0);
    
    let victoryType = '';
    let winner = null;
    
    if (playersAtZeroOrBelow.length === 0) {
      // No one at 0, shouldn't happen but handle gracefully
      return gameState;
    } else if (playersAtZeroOrBelow.length === 1) {
      // One player at 0 or below, other player wins decisively
      winner = players.find(p => (p.health || 25) > 0);
      victoryType = 'Decisive Victory';
    } else if (playersAtZeroOrBelow.length === players.length) {
      // All players at 0 or below
      const healthValues = playersAtZeroOrBelow.map(p => p.health || 25);
      const minHealth = Math.min(...healthValues);
      const playersAtMinHealth = playersAtZeroOrBelow.filter(p => (p.health || 25) === minHealth);
      
      if (playersAtMinHealth.length === playersAtZeroOrBelow.length) {
        // All at same health - draw
        victoryType = 'Draw';
      } else {
        // One player lower than others - narrow victory for higher health player
        winner = playersAtZeroOrBelow.find(p => (p.health || 25) > minHealth);
        victoryType = 'Narrow Victory';
      }
    }

    return {
      ...gameState,
      winner,
      gameData: {
        ...gameState.gameData,
        victoryType
      }
    };
  }

  // Legacy helper methods - kept for compatibility
  // Note: These are now replaced by SpeciesIntegration methods but kept for any existing references
  
  private getShipsRequiringSubPhase(gameState: GameState, subPhase: SubPhase): any[] {
    // Redirect to SpeciesIntegration
    return SpeciesIntegration.hasShipsRequiringSubPhase(gameState, subPhase) ? ['placeholder'] : [];
  }

  private getPlayersWithShips(ships: any[]): string[] {
    // This method is deprecated - use SpeciesIntegration.getPlayersWithShipsRequiringSubPhase instead
    return [];
  }

  private isCombatRequired(gameState: GameState): boolean {
    // Check if any combat actions were taken this turn
    // Placeholder - will implement based on your attack/combat rules
    return gameState.gameData?.combatActions?.length > 0 || false;
  }

  private hasWinner(gameState: GameState): boolean {
    // Check if there's a winner (will be implemented based on win conditions)
    return gameState.winner !== null;
  }

  private startNewTurn(gameState: GameState): GameState {
    const turnNumber = (gameState.gameData?.turnData?.turnNumber || 0) + 1;
    
    // Store health at start of turn for ships that check this
    const healthAtTurnStart: { [playerId: string]: number } = {};
    gameState.players.forEach(player => {
      healthAtTurnStart[player.id] = player.health || 25;
    });

    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: [], // Clear readiness for new turn
        turnData: {
          turnNumber,
          currentMajorPhase: MajorPhase.BUILD_PHASE,
          currentSubPhase: SubPhase.ROLL_DICE,
          requiredSubPhases: [], // Will be calculated by getRequiredSubPhasesForTurn
          accumulatedDamage: {},
          accumulatedHealing: {},
          healthAtTurnStart,
          chargesDeclared: false
        }
      }
    };
  }
}