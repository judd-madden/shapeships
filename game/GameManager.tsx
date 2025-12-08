// Game Manager - high-level interface for game operations
// Bridges the game engine with the multiplayer backend

import { GameEngine } from './engine/GameEngine';
import { ShapeshipsRulesEngine } from './engine/RulesEngine';
import { GameState, Player, GameAction } from './types/GameTypes';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export class GameManager {
  private engine: GameEngine;

  constructor() {
    const rules = new ShapeshipsRulesEngine();
    this.engine = new GameEngine(rules);
  }

  // Create a new game and sync with backend
  async createGame(creator: Player, settings: any = {}): Promise<string> {
    try {
      // Create initial game state
      const gameId = this.generateGameId();
      const gameState = this.engine.createGame(gameId, creator, settings);

      // Send to backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/create-game`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            playerName: creator.name,
            playerId: creator.id,
            gameData: gameState
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create game on server');
      }

      const result = await response.json();
      return result.gameId;
    } catch (error) {
      console.error('Failed to create game:', error);
      throw error;
    }
  }

  // Join an existing game
  async joinGame(gameId: string, player: Player): Promise<boolean> {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/join-game/${gameId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            playerName: player.name,
            playerId: player.id,
            faction: player.faction
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to join game:', error);
      return false;
    }
  }

  // Process and validate a game action
  processAction(gameState: GameState, action: GameAction): GameState {
    return this.engine.processAction(gameState, action);
  }

  // Get valid actions for a player
  getValidActions(playerId: string, gameState: GameState): GameAction[] {
    return this.engine.getValidActions(playerId, gameState);
  }

  private generateGameId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Export singleton instance
export const gameManager = new GameManager();