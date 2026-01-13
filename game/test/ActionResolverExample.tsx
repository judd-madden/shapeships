// LEGACY TEST — Uses Quarantined Client Hook
//
// WARNING: This test uses quarantined useActionResolver hook.
// The server is now authoritative for action validation.
//
// This file remains for historical reference only.

import React from 'react';
import { GameState } from '../types/GameTypes';
import { useActionResolver } from '../legacy/hooks/useActionResolver.legacy';
import { ActionPanel } from '../display/ActionPanel';
import { ActionResolutionResult } from '../types/ActionTypes';

interface ActionResolverExampleProps {
  gameState: GameState;
  currentPlayerId: string;
  currentPhase: string;
  phaseIndex: number;
  subPhase?: number;
  onEffectsQueued?: (effects: any[]) => void;
  onPhaseAdvance?: () => void;
}

/**
 * Example component showing how to integrate Action Resolution Layer
 * 
 * This would typically be part of your main game UI, integrated with:
 * - GamePhases for phase management
 * - Multiplayer hooks for syncing actions
 * - Health Resolution for applying effects
 */
export function ActionResolverExample({
  gameState,
  currentPlayerId,
  currentPhase,
  phaseIndex,
  subPhase,
  onEffectsQueued,
  onPhaseAdvance
}: ActionResolverExampleProps) {
  
  // Use the action resolver hook
  const {
    phaseActionState,
    isLoading,
    resolveAction,
    declareReady,
    canPlayerDeclareReady,
    getPlayerPendingActions,
    getPlayerStatus,
    canAdvancePhase
  } = useActionResolver(
    gameState,
    currentPhase,
    phaseIndex,
    subPhase,
    (result: ActionResolutionResult) => {
      // Handle action resolution
      console.log('Action resolved:', result);
      
      // Send effects to be queued for Health Resolution
      if (result.effectsQueued && onEffectsQueued) {
        onEffectsQueued(result.effectsQueued);
      }
      
      // TODO: In multiplayer, send action to server here
      // await sendActionToServer(result);
    },
    () => {
      // Phase ready to advance
      console.log('Phase ready to advance');
      
      if (onPhaseAdvance) {
        onPhaseAdvance();
      }
    }
  );
  
  // Handle player action
  const handleResolveAction = async (actionId: string, chosenOption: string) => {
    const result = await resolveAction(currentPlayerId, actionId, chosenOption);
    
    if (!result.success) {
      console.error('Action failed:', result.error);
      // Show error to user
    }
  };
  
  // Handle declare ready
  const handleDeclareReady = () => {
    declareReady(currentPlayerId);
  };
  
  // Get info for debugging/display
  const playerStatus = getPlayerStatus(currentPlayerId);
  const pendingActions = getPlayerPendingActions(currentPlayerId);
  const canReady = canPlayerDeclareReady(currentPlayerId);
  const phaseReady = canAdvancePhase();
  
  return (
    <div className="space-y-4">
      {/* Main Action Panel */}
      <ActionPanel
        phaseActionState={phaseActionState}
        currentPlayerId={currentPlayerId}
        onResolveAction={handleResolveAction}
        onDeclareReady={handleDeclareReady}
        isLoading={isLoading}
      />
      
      {/* Debug Info (can be removed in production) */}
      <div className="p-4 bg-shapeships-grey-90 border border-shapeships-grey-70 rounded text-sm">
        <h4 className="text-shapeships-white mb-2">Debug Info</h4>
        <div className="space-y-1 text-shapeships-grey-30">
          <p>Player Status: {playerStatus}</p>
          <p>Pending Actions: {pendingActions.length}</p>
          <p>Can Declare Ready: {canReady ? 'Yes' : 'No'}</p>
          <p>Phase Ready to Advance: {phaseReady ? 'Yes' : 'No'}</p>
          {phaseActionState?.blockingReason && (
            <p>Blocking Reason: {phaseActionState.blockingReason}</p>
          )}
        </div>
      </div>
      
      {/* Other Players Status */}
      {phaseActionState && (
        <div className="p-4 bg-shapeships-grey-90 border border-shapeships-grey-70 rounded">
          <h4 className="text-shapeships-white mb-2">Other Players</h4>
          <div className="space-y-2">
            {Object.entries(phaseActionState.playerStates)
              .filter(([playerId]) => playerId !== currentPlayerId)
              .map(([playerId, playerState]) => {
                const player = gameState.players.find(p => p.id === playerId);
                return (
                  <div key={playerId} className="text-sm">
                    <span className="text-shapeships-grey-40">{player?.name || playerId}:</span>{' '}
                    <span className={
                      playerState.status === 'READY' 
                        ? 'text-shapeships-green' 
                        : 'text-shapeships-yellow'
                    }>
                      {playerState.status === 'READY' ? '✓ Ready' : 'Taking actions...'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}