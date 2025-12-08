// Action Panel - Displays pending actions and ready state for players
// Part of the display layer - uses Action Resolution Layer

import React from 'react';
import { PhaseActionState, PendingAction, PlayerActionState } from '../types/ActionTypes';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

interface ActionPanelProps {
  phaseActionState: PhaseActionState | null;
  currentPlayerId: string;
  onResolveAction: (actionId: string, chosenOption: string) => void;
  onDeclareReady: () => void;
  isLoading?: boolean;
}

export function ActionPanel({
  phaseActionState,
  currentPlayerId,
  onResolveAction,
  onDeclareReady,
  isLoading = false
}: ActionPanelProps) {
  
  if (!phaseActionState) {
    return (
      <Card className="p-4">
        <p className="text-shapeships-grey-50">No active phase</p>
      </Card>
    );
  }
  
  const playerState = phaseActionState.playerStates[currentPlayerId];
  
  if (!playerState) {
    return (
      <Card className="p-4">
        <p className="text-shapeships-grey-50">Waiting for game to start...</p>
      </Card>
    );
  }
  
  return (
    <Card className="p-4 bg-shapeships-grey-90 border-shapeships-grey-70">
      {/* Phase Info */}
      <div className="mb-4">
        <h3 className="text-shapeships-white mb-1">
          {phaseActionState.phase}
        </h3>
        {phaseActionState.phaseMetadata?.diceRoll && (
          <p className="text-shapeships-grey-30 text-sm text-[rgb(255,255,255)]">
            Dice Roll: {phaseActionState.phaseMetadata.diceRoll}
          </p>
        )}
      </div>
      
      {/* Player Status */}
      <div className="mb-4">
        <PlayerStatusBadge status={playerState.status} />
      </div>
      
      {/* Pending Actions */}
      {playerState.pendingActions.length > 0 && (
        <div className="space-y-3 mb-4">
          {playerState.pendingActions.map(action => (
            <ActionCard
              key={action.actionId}
              action={action}
              onResolve={(option) => onResolveAction(action.actionId, option)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
      
      {/* Ready Button */}
      {playerState.canDeclareReady && playerState.status !== 'READY' && (
        <Button
          onClick={onDeclareReady}
          disabled={isLoading}
          className="w-full bg-shapeships-green hover:bg-shapeships-green/80 text-shapeships-white"
        >
          {playerState.pendingActions.length > 0 
            ? 'Skip Remaining Actions & Declare Ready'
            : 'Declare Ready'}
        </Button>
      )}
      
      {/* Already Ready */}
      {playerState.status === 'READY' && (
        <div className="text-center p-3 bg-shapeships-green/20 rounded">
          <p className="text-shapeships-green">✓ Ready</p>
          {phaseActionState.blockingReason && (
            <p className="text-shapeships-grey-40 text-sm mt-1">
              {phaseActionState.blockingReason}
            </p>
          )}
        </div>
      )}
      
      {/* Mandatory Actions Warning */}
      {playerState.status === 'AWAITING_MANDATORY' && (
        <div className="mt-3 p-3 bg-shapeships-red/20 rounded border border-shapeships-red/40">
          <p className="text-shapeships-red text-sm">
            You must resolve {playerState.mustResolveFirst.length} mandatory action
            {playerState.mustResolveFirst.length > 1 ? 's' : ''} before declaring ready
          </p>
        </div>
      )}
    </Card>
  );
}

// Player status badge component
function PlayerStatusBadge({ status }: { status: PlayerActionState['status'] }) {
  const styles = {
    AWAITING_MANDATORY: 'bg-shapeships-red/20 text-shapeships-red border-shapeships-red/40',
    AWAITING_OPTIONAL: 'bg-shapeships-yellow/20 text-shapeships-yellow border-shapeships-yellow/40',
    READY: 'bg-shapeships-green/20 text-shapeships-green border-shapeships-green/40'
  };
  
  const labels = {
    AWAITING_MANDATORY: 'Action Required',
    AWAITING_OPTIONAL: 'Actions Available',
    READY: 'Ready'
  };
  
  return (
    <div className={`inline-block px-3 py-1 rounded border ${styles[status]}`}>
      {labels[status]}
    </div>
  );
}

// Individual action card component
function ActionCard({ 
  action, 
  onResolve, 
  isLoading 
}: { 
  action: PendingAction; 
  onResolve: (option: string) => void;
  isLoading: boolean;
}) {
  
  return (
    <div className="p-3 bg-shapeships-grey-80 rounded border border-shapeships-grey-60">
      {/* Action Title */}
      <div className="mb-2">
        <h4 className="text-shapeships-white">
          {action.metadata?.description || action.type}
          {action.mandatory && (
            <span className="ml-2 text-xs text-shapeships-red">*Required</span>
          )}
        </h4>
        {action.metadata?.charges !== undefined && (
          <p className="text-shapeships-grey-30 text-sm">
            Charges: {action.metadata.charges}/{action.metadata.maxCharges}
          </p>
        )}
      </div>
      
      {/* Action Options */}
      <div className="space-y-2">
        {action.options.map(option => (
          <Button
            key={option.id}
            onClick={() => onResolve(option.id)}
            disabled={isLoading}
            variant={option.id === 'skip' ? 'outline' : 'default'}
            className={`w-full justify-start text-shapeships-white ${
              option.id === 'skip' 
                ? 'bg-transparent border-shapeships-grey-50 text-shapeships-grey-40 hover:bg-shapeships-grey-70'
                : 'bg-shapeships-blue hover:bg-shapeships-blue/80'
            }`}
          >
            <span className="flex-1 text-left text-shapeships-white">{option.label}</span>
            {option.cost?.charges && (
              <span className="text-xs opacity-70 text-shapeships-white">
                (-{option.cost.charges} charge{option.cost.charges > 1 ? 's' : ''})
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}