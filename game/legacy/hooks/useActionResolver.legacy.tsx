/**
 * CLIENT HOOK (LEGACY / NON-AUTHORITATIVE)
 *
 * ⚠️ QUARANTINED - DO NOT IMPORT ⚠️
 *
 * WARNING:
 * This hook depends on client-side ActionResolver which is quarantined.
 * The server is authoritative for action validation and resolution.
 *
 * This file must NOT be used by active UI runtime.
 *
 * Allowed usage:
 * - legacy tests
 * - historical reference
 *
 * If you need valid actions, read them from server state.
 */

// React hook for Action Resolution Layer
// Provides UI components with action state and resolution methods

import { useState, useEffect, useMemo, useRef } from 'react';
import { GameState } from '../../types/GameTypes';
import { PhaseActionState, CompletedAction, ActionResolutionResult } from '../../types/ActionTypes';
import { actionResolver } from '../../engine/ActionResolver.clientLegacy';

export interface UseActionResolverResult {
  phaseActionState: PhaseActionState | null;
  isLoading: boolean;
  
  // Player action methods
  resolveAction: (playerId: string, actionId: string, chosenOption: string) => Promise<ActionResolutionResult>;
  declareReady: (playerId: string) => void;
  
  // Query methods
  canPlayerDeclareReady: (playerId: string) => boolean;
  getPlayerPendingActions: (playerId: string) => any[];
  getPlayerStatus: (playerId: string) => string;
  canAdvancePhase: () => boolean;
}

/**
 * Hook for managing action resolution in game phases
 * 
 * @param gameState - Current game state
 * @param currentPhase - Current phase name
 * @param phaseIndex - Current phase index
 * @param onActionResolved - Callback when action is resolved
 * @param onPhaseReady - Callback when phase is ready to advance
 */
export function useActionResolver(
  gameState: GameState | null,
  currentPhase: string,
  phaseIndex: number,
  onActionResolved?: (result: ActionResolutionResult) => void,
  onPhaseReady?: () => void
): UseActionResolverResult {
  
  const [phaseActionState, setPhaseActionState] = useState<PhaseActionState | null>(null);
  const [completedActions, setCompletedActions] = useState<CompletedAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use refs to store callbacks to avoid dependency issues
  const onActionResolvedRef = useRef(onActionResolved);
  const onPhaseReadyRef = useRef(onPhaseReady);
  
  // Update refs when callbacks change
  useEffect(() => {
    onActionResolvedRef.current = onActionResolved;
    onPhaseReadyRef.current = onPhaseReady;
  }, [onActionResolved, onPhaseReady]);
  
  // Calculate phase actions when game state or phase changes
  useEffect(() => {
    if (!gameState || !currentPhase) {
      setPhaseActionState(null);
      return;
    }
    
    const actionState = actionResolver.calculatePhaseActions(
      gameState,
      currentPhase,
      phaseIndex,
      completedActions
    );
    
    setPhaseActionState(actionState);
    
    // Check if phase is ready to advance (use ref to avoid dependency)
    if (actionState.canAdvancePhase && onPhaseReadyRef.current) {
      onPhaseReadyRef.current();
    }
  }, [gameState, currentPhase, phaseIndex, completedActions]);
  
  /**
   * Resolve a player action
   */
  const resolveAction = async (
    playerId: string,
    actionId: string,
    chosenOption: string
  ): Promise<ActionResolutionResult> => {
    
    if (!phaseActionState || !gameState) {
      return {
        success: false,
        error: 'No active phase or game state',
        effectsQueued: []
      };
    }
    
    setIsLoading(true);
    
    try {
      const result = actionResolver.resolvePlayerAction(
        gameState,
        phaseActionState,
        playerId,
        actionId,
        chosenOption
      );
      
      if (result.success) {
        // Add to completed actions
        setCompletedActions(prev => [
          ...prev,
          {
            actionId,
            playerId,
            chosenOption,
            timestamp: Date.now(),
            resolvedEffects: result.effectsQueued.map(e => ({
              type: e.type,
              value: e.value,
              description: e.description
            }))
          }
        ]);
        
        // Notify callback
        if (onActionResolvedRef.current) {
          onActionResolvedRef.current(result);
        }
      }
      
      return result;
      
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Declare player ready (forfeit optional actions)
   */
  const declareReady = (playerId: string) => {
    if (!phaseActionState) return;
    
    const updatedState = actionResolver.declarePlayerReady(phaseActionState, playerId);
    setPhaseActionState(updatedState);
    
    // Check if phase ready to advance
    if (updatedState.canAdvancePhase && onPhaseReadyRef.current) {
      onPhaseReadyRef.current();
    }
  };
  
  /**
   * Check if player can declare ready
   */
  const canPlayerDeclareReady = (playerId: string): boolean => {
    if (!phaseActionState) return false;
    return phaseActionState.playerStates[playerId]?.canDeclareReady || false;
  };
  
  /**
   * Get player's pending actions
   */
  const getPlayerPendingActions = (playerId: string) => {
    if (!phaseActionState) return [];
    return phaseActionState.playerStates[playerId]?.pendingActions || [];
  };
  
  /**
   * Get player's status
   */
  const getPlayerStatus = (playerId: string): string => {
    if (!phaseActionState) return 'UNKNOWN';
    return phaseActionState.playerStates[playerId]?.status || 'UNKNOWN';
  };
  
  /**
   * Check if phase can advance
   */
  const canAdvancePhase = (): boolean => {
    if (!phaseActionState) return false;
    return phaseActionState.canAdvancePhase;
  };
  
  return {
    phaseActionState,
    isLoading,
    resolveAction,
    declareReady,
    canPlayerDeclareReady,
    getPlayerPendingActions,
    getPlayerStatus,
    canAdvancePhase
  };
}
