// Rules engine - implements the specific game rules for Shapeships
// This coordinates between GamePhases and ShipPowers engines
// This will be customized based on the detailed rules you provide

import { GameState, GameAction, Player, GameRules } from '../types/GameTypes';
import { GamePhasesEngine } from './GamePhases';
import { ShipPowersEngine, PowerActivation } from './ShipPowers';

export class ShapeshipsRulesEngine implements GameRules {
  
  private phasesEngine: GamePhasesEngine;
  private powersEngine: ShipPowersEngine;
  
  constructor() {
    this.phasesEngine = new GamePhasesEngine();
    this.powersEngine = new ShipPowersEngine();
  }
  
  // Validate if an action is legal in the current game state
  validateAction(action: GameAction, gameState: GameState): boolean {
    // Game must be active
    if (gameState.status !== 'active') {
      return false;
    }

    // Check if action is valid for current phase
    if (!this.phasesEngine.isActionValidForPhase(action, gameState)) {
      return false;
    }

    // In synchronous turns, players don't need to wait for their specific turn
    // They can act during phases where they have ships/powers that require action

    // Action-specific validation
    switch (action.type) {
      case 'move':
        return this.validateMove(action, gameState);
      case 'attack':
        return this.validateAttack(action, gameState);
      case 'special':
        return this.validateSpecial(action, gameState);
      case 'power_activation':
        return this.validatePowerActivation(action, gameState);
      case 'use_first_strike_power':
        return this.validateFirstStrikePower(action, gameState);
      case 'combat_response':
        return this.validateCombatResponse(action, gameState);
      case 'declare_ready':
        return true; // Always allow declaring ready
      case 'end_turn':
        return true; // Always allow ending turn during main turn
      case 'surrender':
        return true; // Always allow surrender
      default:
        return false;
    }
  }

  // Apply an action to the game state and return new state
  applyAction(action: GameAction, gameState: GameState): GameState {
    let newGameState = { ...gameState };

    switch (action.type) {
      case 'move':
        newGameState = this.applyMove(action, newGameState);
        break;
      case 'attack':
        newGameState = this.applyAttack(action, newGameState);
        break;
      case 'special':
        newGameState = this.applySpecial(action, newGameState);
        break;
      case 'power_activation':
        newGameState = this.applyPowerActivation(action, newGameState);
        break;
      case 'use_first_strike_power':
        newGameState = this.applyFirstStrikePower(action, newGameState);
        break;
      case 'combat_response':
        newGameState = this.applyCombatResponse(action, newGameState);
        break;
      case 'declare_ready':
        newGameState = this.applyDeclareReady(action, newGameState);
        break;
      case 'surrender':
        newGameState = this.applySurrender(action, newGameState);
        break;
      case 'end_turn':
        newGameState = this.applyEndTurn(action, newGameState);
        break;
    }

    // Check for phase transitions after applying action
    const phaseTransition = this.phasesEngine.shouldTransitionPhase(newGameState);
    if (phaseTransition) {
      newGameState = this.phasesEngine.transitionToPhase(newGameState, phaseTransition);
    }

    return newGameState;
  }

  // Check if there's a winner
  checkWinCondition(gameState: GameState): Player | null {
    // Placeholder win condition logic
    // This will be implemented based on your specific win conditions
    
    // Example: Check if only one player has ships remaining
    const activePlayers = gameState.players.filter(player => {
      // Check if player has any ships left (placeholder logic)
      return true; // Will be replaced with actual ship counting
    });

    if (activePlayers.length === 1) {
      return activePlayers[0];
    }

    return null;
  }

  // Get all valid moves for a player
  getValidMoves(playerId: string, gameState: GameState): GameAction[] {
    const validMoves: GameAction[] = [];
    const currentPhase = this.phasesEngine.getCurrentPhase(gameState);
    const validActionTypes = this.phasesEngine.getValidActionsForPhase(currentPhase, playerId, gameState);
    
    // Add phase-appropriate actions
    for (const actionType of validActionTypes) {
      switch (actionType) {
        case 'end_turn':
          validMoves.push({
            id: `end_turn_${Date.now()}`,
            playerId,
            type: 'end_turn',
            data: {},
            timestamp: new Date().toISOString()
          });
          break;
        case 'move':
          // Add specific move actions based on game state
          validMoves.push(...this.getValidMoveActions(playerId, gameState));
          break;
        case 'attack':
          // Add specific attack actions based on game state
          validMoves.push(...this.getValidAttackActions(playerId, gameState));
          break;
        case 'special':
          // Add ship power activations
          validMoves.push(...this.getValidPowerActions(playerId, gameState));
          break;
      }
    }
    
    return validMoves;
  }

  // Private validation methods - to be implemented based on your rules
  private validateMove(action: GameAction, gameState: GameState): boolean {
    // Placeholder - will implement based on your movement rules
    return true;
  }

  private validateAttack(action: GameAction, gameState: GameState): boolean {
    // Placeholder - will implement based on your attack rules
    return true;
  }

  private validateSpecial(action: GameAction, gameState: GameState): boolean {
    // Placeholder - will implement based on your special action rules
    return true;
  }

  private validatePowerActivation(action: GameAction, gameState: GameState): boolean {
    if (!action.data?.powerActivation) return false;
    const activation = action.data.powerActivation as PowerActivation;
    return this.powersEngine.canActivatePower(activation, gameState);
  }

  private validateFirstStrikePower(action: GameAction, gameState: GameState): boolean {
    // Validate that player has ships with first strike powers
    // Placeholder - will implement based on your ship/power data
    return true;
  }

  private validateCombatResponse(action: GameAction, gameState: GameState): boolean {
    // Validate combat response actions during combat phase
    // Placeholder - will implement based on your combat rules
    return true;
  }

  // Private application methods - to be implemented based on your rules
  private applyMove(action: GameAction, gameState: GameState): GameState {
    // Placeholder - will implement based on your movement rules
    return gameState;
  }

  private applyAttack(action: GameAction, gameState: GameState): GameState {
    // Placeholder - will implement based on your attack rules
    return gameState;
  }

  private applySpecial(action: GameAction, gameState: GameState): GameState {
    // Placeholder - will implement based on your special action rules
    return gameState;
  }

  private applyPowerActivation(action: GameAction, gameState: GameState): GameState {
    if (!action.data?.powerActivation) return gameState;
    const activation = action.data.powerActivation as PowerActivation;
    return this.powersEngine.activatePower(activation, gameState);
  }

  private applySurrender(action: GameAction, gameState: GameState): GameState {
    // Remove player from active play
    return {
      ...gameState,
      players: gameState.players.map(player => 
        player.id === action.playerId 
          ? { ...player, status: 'surrendered' }
          : player
      )
    };
  }

  private applyFirstStrikePower(action: GameAction, gameState: GameState): GameState {
    // Apply first strike power effects
    // Placeholder - will implement based on your first strike rules
    return gameState;
  }

  private applyCombatResponse(action: GameAction, gameState: GameState): GameState {
    // Apply combat response effects
    // Placeholder - will implement based on your combat rules
    return gameState;
  }

  private applyDeclareReady(action: GameAction, gameState: GameState): GameState {
    // Mark player as ready for current phase
    return this.phasesEngine.setPlayerReady(gameState, action.playerId);
  }

  private applyEndTurn(action: GameAction, gameState: GameState): GameState {
    // In synchronous system, end turn means declare ready for current phase
    return this.applyDeclareReady(action, gameState);
  }

  // Helper methods for getting valid actions
  private getValidMoveActions(playerId: string, gameState: GameState): GameAction[] {
    // Placeholder - will implement based on board state and ship positions
    return [];
  }

  private getValidAttackActions(playerId: string, gameState: GameState): GameAction[] {
    // Placeholder - will implement based on ship positions and attack ranges
    return [];
  }

  private getValidPowerActions(playerId: string, gameState: GameState): GameAction[] {
    const powerActions: GameAction[] = [];
    
    // Get all ships belonging to this player
    const playerShips = this.getPlayerShips(playerId, gameState);
    
    for (const ship of playerShips) {
      const availablePowers = this.powersEngine.getAvailablePowers(ship.id, gameState);
      
      for (const power of availablePowers) {
        powerActions.push({
          id: `power_${power.id}_${ship.id}_${Date.now()}`,
          playerId,
          type: 'power_activation',
          data: {
            powerActivation: {
              powerId: power.id,
              shipId: ship.id
            }
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return powerActions;
  }

  private getPlayerShips(playerId: string, gameState: GameState): any[] {
    // Placeholder - will implement based on how ships are stored in game state
    return [];
  }
}