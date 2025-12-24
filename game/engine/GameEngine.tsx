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
      roundNumber: 0, // Tracks complete Build→Battle→Resolution cycles
      currentPlayerId: creator.id, // UI hint only - not a control gate
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

    // Set first player as UI hint
    const firstPlayer = gameState.players[0];
    
    return {
      ...gameState,
      status: 'active',
      currentPlayerId: firstPlayer.id,
      // Both players are active - End of Turn Resolution deactivates when health hits 0
      players: gameState.players.map(p => ({ ...p, isActive: true })),
      lastUpdated: new Date().toISOString()
    };
  }

  // Process a game action
  processAction(gameState: GameState, action: GameAction): GameState {
    // Guard against post-mortem mutations
    if (gameState.status === 'completed') {
      throw new Error('Game has ended - no further actions allowed');
    }
    
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

    // 🔒 CRITICAL: Win condition checked ONLY in EndOfTurnResolver
    // Accept result from resolver if game ended
    if (newState.gameData.endOfTurnResult?.gameEnded) {
      newState = {
        ...newState,
        status: 'completed',
        winner: newState.gameData.endOfTurnResult.winner
      };
    }

    return newState;
  }

  // Get valid actions for a player
  // In Shapeships: Phase system controls legality, NOT turn order
  getValidActions(playerId: string, gameState: GameState): GameAction[] {
    if (gameState.status !== 'active') {
      return [];
    }

    // Let rules engine determine if player can act (based on phase, not turn order)
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