// React hooks for managing game state
// Connects the game engine to React components

import { useState, useEffect, useCallback } from 'react';
import { GameState, GameAction, Player } from '../types/GameTypes';
import { GameEngine } from '../engine/GameEngine';
import { ShapeshipsRulesEngine } from '../engine/RulesEngine';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// Initialize game engine with rules
const rulesEngine = new ShapeshipsRulesEngine();
const gameEngine = new GameEngine(rulesEngine);

export function useGameState(gameId: string, playerId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch game state from server
  const fetchGameState = useCallback(async () => {
    if (!gameId) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching game state for:', gameId);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/game-state/${gameId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      console.log('Game state response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Game state data received:', data);
        
        // Only update state if it has actually changed
        setGameState(prevState => {
          if (JSON.stringify(prevState) !== JSON.stringify(data)) {
            return data;
          }
          return prevState;
        });
        setError(null);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch game state:', response.status, errorText);
        setError(`Failed to fetch game state (${response.status}): ${errorText}`);
      }
    } catch (err) {
      console.error('Network error fetching game state:', err);
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Send action to server (simplified for testing)
  const sendAction = useCallback(async (actionType: string, content?: any) => {
    if (!gameId) return false;

    try {
      setLoading(true);
      
      const requestBody = {
        playerId,
        actionType,
        content: content || actionType,
        timestamp: new Date().toISOString()
      };
      
      console.log('Sending action:', { actionType, content, requestBody });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/send-action/${gameId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log('Action response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Action result:', result);
        
        // For phase-critical actions, refresh immediately
        // For regular actions, use a delay to batch updates
        const isPhaseAction = actionType === 'set_ready' || actionType === 'advance_phase' || actionType === 'select_species';
        const delay = isPhaseAction ? 500 : 200;
        
        setTimeout(() => {
          fetchGameState();
        }, delay);
        setError(null);
        return true;
      } else {
        const errorText = await response.text();
        console.error('Action failed:', { status: response.status, error: errorText });
        setError(`Failed to send action: ${errorText}`);
        return false;
      }
    } catch (err) {
      console.error('Network error sending action:', { actionType, error: err.message, stack: err.stack });
      setError(`Network error: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [gameId, playerId, fetchGameState]);

  // Get valid actions for current player
  const getValidActions = useCallback(() => {
    if (!gameState) return [];
    return gameEngine.getValidActions(playerId, gameState);
  }, [gameState, playerId]);

  // Check if it's current player's turn
  const isMyTurn = useCallback(() => {
    return gameState?.currentPlayerId === playerId;
  }, [gameState, playerId]);

  // Get current player
  const getCurrentPlayer = useCallback(() => {
    return gameState?.players.find(p => p.id === playerId) || null;
  }, [gameState, playerId]);

  // Auto-refresh game state periodically - optimized for turn-based gameplay
  useEffect(() => {
    if (!gameId) return;

    // Initial fetch
    fetchGameState();
    
    // Set up intelligent polling based on game state
    const interval = setInterval(() => {
      // Get the current phase for checking
      const currentPhase = gameState?.gameData?.currentPhase || gameState?.currentPhase;
      
      // Only poll frequently if:
      // 1. Game is active and it's our turn, OR
      // 2. We're waiting for phase transitions, OR 
      // 3. Game is in setup phase with < 2 players, OR
      // 4. Game is in ship_building phase (to see other player's ready status)
      const shouldPollFrequently = 
        gameState?.status === 'active' && gameState?.currentPlayerId === playerId ||
        gameState?.waitingForPhaseAdvance ||
        gameState?.status === 'waiting' ||
        currentPhase === 'ship_building' ||
        !gameState?.players || gameState.players.length < 2;
      
      if (shouldPollFrequently) {
        fetchGameState();
      }
      // Otherwise, only poll occasionally for basic sync (every 4th cycle = ~20 seconds)
      else if (Math.random() < 0.25) {
        fetchGameState();
      }
    }, 5000); // Check every 5 seconds, but only fetch when needed

    return () => clearInterval(interval);
  }, [gameId, fetchGameState, gameState?.status, gameState?.currentPlayerId, gameState?.players?.length, gameState?.gameData?.currentPhase, gameState?.currentPhase, playerId]);

  return {
    gameState,
    loading,
    error,
    sendAction,
    getValidActions,
    isMyTurn,
    getCurrentPlayer,
    refreshGameState: fetchGameState
  };
}