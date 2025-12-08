// Core game engine - handles all game logic without UI concerns
// This is the brain of Shapeships, managing state transitions and rule enforcement

import { 
  GameState, 
  GameAction, 
  Player, 
  GameRules, 
  GameSettings, 
  BoardState, 
  GameResources 
} from '../types/GameTypes';
import { PlayerShip } from '../types/GameTypes';

export class GameEngine {
  private rules: GameRules;
  
  constructor(rules: GameRules) {
    this.rules = rules;
  }

  // Create a new game state
  createGame(gameId: string, creator: Player, settings: Partial<GameSettings> = {}): GameState {
    return {
      gameId,
      status: 'waiting',
      players: [creator],
      currentTurn: 0,
      currentPlayerId: creator.id,
      gameData: {
        board: this.initializeBoard(),
        ships: this.initializeShips(),
        resources: this.initializeResources()
      },
      actions: [],
      settings: {
        maxPlayers: 2, // default for now
        ...settings
      },
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Add a player to the game
  addPlayer(gameState: GameState, player: Player): GameState {
    if (gameState.status !== 'waiting') {
      throw new Error('Cannot add players to a game in progress');
    }

    if (gameState.players.length >= gameState.settings.maxPlayers) {
      throw new Error('Game is full');
    }

    const updatedState = {
      ...gameState,
      players: [...gameState.players, player],
      lastUpdated: new Date().toISOString()
    };

    // Auto-start if we have enough players
    if (updatedState.players.length === updatedState.settings.maxPlayers) {
      return this.startGame(updatedState);
    }

    return updatedState;
  }

  // Start the game when ready
  startGame(gameState: GameState): GameState {
    if (gameState.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Set first player as active
    const firstPlayer = gameState.players[0];
    
    return {
      ...gameState,
      status: 'active',
      currentPlayerId: firstPlayer.id,
      players: gameState.players.map(p => ({ ...p, isActive: p.id === firstPlayer.id })),
      lastUpdated: new Date().toISOString()
    };
  }

  // Process a game action
  processAction(gameState: GameState, action: GameAction): GameState {
    // Validate the action
    if (!this.rules.validateAction(action, gameState)) {
      throw new Error(`Invalid action: ${action.type}`);
    }

    // Apply the action
    let newState = this.rules.applyAction(action, gameState);
    
    // Add the action to history
    newState = {
      ...newState,
      actions: [...newState.actions, { ...action, validated: true }],
      lastUpdated: new Date().toISOString()
    };

    // Check for win condition
    const winner = this.rules.checkWinCondition(newState);
    if (winner) {
      newState = {
        ...newState,
        status: 'completed'
      };
    } else if (action.type === 'end_turn') {
      // Advance to next turn
      newState = this.advanceTurn(newState);
    }

    return newState;
  }

  // Advance to the next player's turn
  private advanceTurn(gameState: GameState): GameState {
    const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
    const nextIndex = (currentIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextIndex];

    return {
      ...gameState,
      currentTurn: gameState.currentTurn + 1,
      currentPlayerId: nextPlayer.id,
      players: gameState.players.map(p => ({ ...p, isActive: p.id === nextPlayer.id }))
    };
  }

  // Get valid actions for a player
  getValidActions(playerId: string, gameState: GameState): GameAction[] {
    if (gameState.status !== 'active' || gameState.currentPlayerId !== playerId) {
      return [];
    }

    return this.rules.getValidMoves(playerId, gameState);
  }

  // Initialize empty board - will be customized based on your game rules
  private initializeBoard(): BoardState {
    // Placeholder board state - currently minimal
    // Ships are stored in gameData.ships, not on the board
    return {
      zones: [],
      effects: []
    };
  }

  // Initialize ships - organized by player ID
  private initializeShips(): { [playerId: string]: PlayerShip[] } {
    // Placeholder - ships will be added during gameplay
    return {};
  }

  // Initialize resources - will be customized based on your game rules
  private initializeResources(): GameResources {
    // Placeholder - will be replaced with actual resource initialization
    return {};
  }
}