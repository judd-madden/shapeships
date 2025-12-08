// Full Phase Test - Comprehensive test interface for phase system + action resolution
// Tests the complete integration of GamePhases + ActionResolver + UI

import React, { useState, useEffect } from 'react';
import { GameState, Player, PlayerShip } from '../types/GameTypes';
import { useActionResolver } from '../hooks/useActionResolver';
import { ActionPanel } from '../display/ActionPanel';
import { ActionResolutionResult, QueuedEffect } from '../types/ActionTypes';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { SubPhase, MajorPhase } from '../engine/GamePhases';
import { ArrowLeft } from 'lucide-react';

interface FullPhaseTestProps {
  initialGameState?: GameState;
  onBack?: () => void; // Callback to navigate back
}

/**
 * Full Phase Test Interface
 * 
 * Demonstrates complete integration of:
 * - 14-subphase GamePhases system
 * - ActionResolver for managing player actions
 * - Effect queueing for Health Resolution
 * - Dual-ready synchronization
 */
export function FullPhaseTest({ initialGameState, onBack }: FullPhaseTestProps) {
  
  // Game state
  const [gameState, setGameState] = useState<GameState>(
    initialGameState || createTestGameState()
  );
  
  // Phase state
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(9); // Start at Charge Declaration
  const [currentSubPhase, setCurrentSubPhase] = useState<SubPhase>(SubPhase.CHARGE_DECLARATION);
  const [phaseName, setPhaseName] = useState('Charge Declaration');
  
  // Effect queue (accumulated throughout turn, applied in Health Resolution)
  const [effectQueue, setEffectQueue] = useState<QueuedEffect[]>([]);
  
  // Current player viewing (for demo - switch between players)
  const [viewingPlayerId, setViewingPlayerId] = useState(gameState.players[0].id);
  
  // Action resolver integration
  const {
    phaseActionState,
    isLoading,
    resolveAction,
    declareReady,
    canAdvancePhase
  } = useActionResolver(
    gameState,
    phaseName,
    currentPhaseIndex,
    currentSubPhase,
    (result: ActionResolutionResult) => {
      // Action resolved callback
      console.log('Action resolved:', result);
      
      // Add effects to queue
      if (result.effectsQueued.length > 0) {
        setEffectQueue(prev => [...prev, ...result.effectsQueued]);
      }
      
      // Update game state with state changes
      if (result.stateChanges) {
        updateGameStateFromChanges(result.stateChanges);
      }
    }
    // Removed onPhaseReady callback - we'll check manually instead
  );
  
  // Update game state from action state changes
  const updateGameStateFromChanges = (stateChanges: any) => {
    setGameState(prev => {
      const updated = { ...prev };
      
      // Update charges
      if (stateChanges.chargesUsed) {
        Object.entries(stateChanges.chargesUsed).forEach(([shipId, chargesUsed]) => {
          const typedChargesUsed = chargesUsed as number;
          for (const playerId in updated.gameData.ships) {
            const ship = updated.gameData.ships[playerId].find(s => s.id === shipId);
            if (ship && ship.currentCharges !== undefined) {
              ship.currentCharges -= typedChargesUsed;
            }
          }
        });
      }
      
      // Update ships created
      if (stateChanges.shipsCreated) {
        // Will implement ship creation logic
      }
      
      return updated;
    });
  };
  
  // Advance to next phase
  const advancePhase = () => {
    // In real implementation, this would follow GamePhases logic
    // For now, simple linear progression through subphases
    
    const nextSubPhase = currentSubPhase + 1;
    
    if (nextSubPhase > SubPhase.END_OF_BATTLE_PHASE) {
      // Move to Health Resolution
      alert('Turn complete! Applying effects...');
      applyQueuedEffects();
      resetForNextTurn();
    } else {
      setCurrentSubPhase(nextSubPhase);
      setCurrentPhaseIndex(currentPhaseIndex + 1);
      setPhaseName(getSubPhaseName(nextSubPhase));
    }
  };
  
  // Apply all queued effects (Health Resolution phase)
  const applyQueuedEffects = () => {
    console.log('Applying queued effects:', effectQueue);
    
    setGameState(prev => {
      const updated = { ...prev };
      
      // Apply damage and healing
      effectQueue.forEach(effect => {
        const targetPlayer = updated.players.find(p => p.id === effect.targetPlayerId);
        if (!targetPlayer) return;
        
        if (effect.type === 'DAMAGE' && effect.value) {
          targetPlayer.health = (targetPlayer.health || 100) - effect.value;
        } else if (effect.type === 'HEALING' && effect.value) {
          targetPlayer.health = Math.min(
            (targetPlayer.health || 100) + effect.value,
            100 // Max health
          );
        }
      });
      
      return updated;
    });
    
    // Clear effect queue
    setEffectQueue([]);
  };
  
  // Reset for next turn
  const resetForNextTurn = () => {
    setCurrentPhaseIndex(0);
    setCurrentSubPhase(SubPhase.ROLL_DICE);
    setPhaseName('Roll Dice');
    setGameState(prev => ({
      ...prev,
      currentTurn: prev.currentTurn + 1
    }));
  };
  
  // Get phase name from SubPhase enum
  const getSubPhaseName = (subPhase: SubPhase): string => {
    const names: { [key: number]: string } = {
      [SubPhase.ROLL_DICE]: 'Roll Dice',
      [SubPhase.DICE_MANIPULATION]: 'Dice Manipulation',
      [SubPhase.LINE_GENERATION]: 'Line Generation',
      [SubPhase.SHIPS_THAT_BUILD]: 'Ships That Build',
      [SubPhase.DRAWING]: 'Drawing',
      [SubPhase.UPON_COMPLETION]: 'Upon Completion',
      [SubPhase.END_BUILD_PHASE]: 'End Build Phase',
      [SubPhase.FIRST_STRIKE]: 'First Strike',
      [SubPhase.CHARGE_DECLARATION]: 'Charge Declaration',
      [SubPhase.CHARGE_RESPONSE]: 'Charge Response',
      [SubPhase.CHARGE_RESOLUTION]: 'Charge Resolution',
      [SubPhase.AUTOMATIC]: 'Automatic',
      [SubPhase.END_OF_BATTLE_PHASE]: 'End of Battle Phase'
    };
    return names[subPhase] || 'Unknown Phase';
  };
  
  // Handle manual phase advance (for testing)
  const handleManualAdvance = () => {
    if (canAdvancePhase()) {
      advancePhase();
    } else {
      alert('Cannot advance - players not ready');
    }
  };
  
  // Switch viewing player (for demo)
  const switchPlayer = () => {
    const currentIndex = gameState.players.findIndex(p => p.id === viewingPlayerId);
    const nextIndex = (currentIndex + 1) % gameState.players.length;
    setViewingPlayerId(gameState.players[nextIndex].id);
  };
  
  const viewingPlayer = gameState.players.find(p => p.id === viewingPlayerId);
  
  return (
    <div className="min-h-screen bg-shapeships-grey-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card className="p-6 bg-shapeships-grey-90 border-shapeships-grey-70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="outline"
                  className="bg-shapeships-grey-80 text-shapeships-white border-shapeships-grey-60"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              )}
              <div>
                <h1 className="text-shapeships-white text-2xl mb-2">
                  Full Phase Test
                </h1>
                <p className="text-shapeships-grey-40 text-[rgb(255,255,255)]">
                  Testing GamePhases + ActionResolver integration
                </p>
              </div>
            </div>
            <Button
              onClick={switchPlayer}
              variant="outline"
              className="bg-shapeships-grey-80 text-shapeships-white border-shapeships-grey-60"
            >
              Switch to {gameState.players.find(p => p.id !== viewingPlayerId)?.name}
            </Button>
          </div>
        </Card>
        
        {/* Phase Progress */}
        <Card className="p-6 bg-shapeships-grey-90 border-shapeships-grey-70">
          <h2 className="text-shapeships-white mb-4">Phase Progress</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="text-shapeships-grey-40 text-sm mb-1 text-[rgb(255,255,255)]">Turn {gameState.currentTurn}</div>
              <div className="text-shapeships-white text-xl">
                Phase {currentPhaseIndex + 1}: {phaseName}
              </div>
              <div className="text-shapeships-grey-40 text-sm mt-1 text-[rgb(255,255,255)]">
                SubPhase {currentSubPhase} of 14
              </div>
            </div>
            <Button
              onClick={handleManualAdvance}
              disabled={!canAdvancePhase()}
              className="bg-shapeships-green hover:bg-shapeships-green/80 text-shapeships-white"
            >
              {canAdvancePhase() ? 'Advance Phase →' : 'Waiting for Players...'}
            </Button>
          </div>
          
          {/* Phase progress bar */}
          <div className="w-full bg-shapeships-grey-80 rounded-full h-2 bg-[rgba(125,125,125,0.30000000000000004)]">
            <div
              className="bg-shapeships-blue h-2 rounded-full transition-all"
              style={{ width: `${(currentSubPhase / 14) * 100}%` }}
            />
          </div>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Current Player View */}
          <div className="space-y-6">
            
            {/* Player Info */}
            <Card className="p-4 bg-shapeships-grey-90 border-shapeships-grey-70">
              <h3 className="text-shapeships-white mb-3">
                {viewingPlayer?.name} (You)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-shapeships-grey-40 text-[rgb(255,255,255)]">Health:</span>
                  <span className="text-shapeships-white">{viewingPlayer?.health || 100}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-shapeships-grey-40 text-[rgb(255,255,255)]">Lines:</span>
                  <span className="text-shapeships-white">{viewingPlayer?.lines || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-shapeships-grey-40 text-[rgb(255,255,255)]">Ships:</span>
                  <span className="text-shapeships-white">
                    {gameState.gameData.ships[viewingPlayerId]?.length || 0}
                  </span>
                </div>
              </div>
            </Card>
            
            {/* Ship List */}
            <Card className="p-4 bg-shapeships-grey-90 border-shapeships-grey-70">
              <h3 className="text-shapeships-white mb-3">Your Ships</h3>
              <div className="space-y-2">
                {gameState.gameData.ships[viewingPlayerId]?.map(ship => (
                  <div
                    key={ship.id}
                    className="p-2 bg-shapeships-grey-80 rounded border border-shapeships-grey-60"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-shapeships-white">{ship.shipId}</span>
                      {ship.currentCharges !== undefined && (
                        <span className="text-shapeships-grey-40 text-sm text-[rgb(255,255,255)]">
                          {ship.currentCharges}/{ship.maxCharges} charges
                        </span>
                      )}
                    </div>
                  </div>
                )) || (
                  <p className="text-shapeships-grey-40 text-sm">No ships yet</p>
                )}
              </div>
            </Card>
            
            {/* Action Panel */}
            <ActionPanel
              phaseActionState={phaseActionState}
              currentPlayerId={viewingPlayerId}
              onResolveAction={async (actionId, option) => {
                const result = await resolveAction(viewingPlayerId, actionId, option);
                if (!result.success) {
                  alert(`Action failed: ${result.error}`);
                }
              }}
              onDeclareReady={() => declareReady(viewingPlayerId)}
              isLoading={isLoading}
            />
          </div>
          
          {/* Right Column: Game State View */}
          <div className="space-y-6">
            
            {/* All Players Status */}
            <Card className="p-4 bg-shapeships-grey-90 border-shapeships-grey-70">
              <h3 className="text-shapeships-white mb-3">All Players</h3>
              <div className="space-y-3">
                {gameState.players.filter(p => p.role === 'player').map(player => {
                  const playerActionState = phaseActionState?.playerStates[player.id];
                  return (
                    <div
                      key={player.id}
                      className={`p-3 rounded border ${
                        player.id === viewingPlayerId
                          ? 'bg-shapeships-blue/20 border-shapeships-blue/40'
                          : 'bg-shapeships-grey-80 border-shapeships-grey-60'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-shapeships-white">
                          {player.name}
                          {player.id === viewingPlayerId && ' (You)'}
                        </span>
                        <span className="text-shapeships-grey-40 text-sm text-[rgb(255,255,255)]">
                          HP: {player.health || 100}
                        </span>
                      </div>
                      {playerActionState && (
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-shapeships-grey-40 text-[rgb(255,255,255)]">Status: </span>
                            <span className={
                              playerActionState.status === 'READY'
                                ? 'text-shapeships-green'
                                : 'text-shapeships-yellow'
                            }>
                              {playerActionState.status}
                            </span>
                          </div>
                          {playerActionState.pendingActions.length > 0 && (
                            <div className="text-sm text-shapeships-grey-40">
                              {playerActionState.pendingActions.length} action
                              {playerActionState.pendingActions.length > 1 ? 's' : ''} pending
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            
            {/* Effect Queue */}
            <Card className="p-4 bg-shapeships-grey-90 border-shapeships-grey-70">
              <h3 className="text-shapeships-white mb-3">
                Effect Queue ({effectQueue.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {effectQueue.length === 0 ? (
                  <p className="text-shapeships-grey-40 text-sm text-[rgb(255,255,255)]">
                    No effects queued yet
                  </p>
                ) : (
                  effectQueue.map(effect => (
                    <div
                      key={effect.id}
                      className="p-2 bg-shapeships-grey-80 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className={
                          effect.type === 'DAMAGE'
                            ? 'text-shapeships-red'
                            : 'text-shapeships-green'
                        }>
                          {effect.type === 'DAMAGE' ? '⚔️' : '💚'}
                        </span>
                        <span className="text-shapeships-white flex-1">
                          {effect.description}
                        </span>
                        <span className="text-shapeships-grey-40">
                          {effect.value}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {effectQueue.length > 0 && (
                <Button
                  onClick={applyQueuedEffects}
                  variant="outline"
                  className="w-full mt-3 border-shapeships-red text-shapeships-red hover:bg-shapeships-red/20"
                >
                  Apply Effects Now (Testing)
                </Button>
              )}
            </Card>
            
            {/* Debug Info */}
            <Card className="p-4 bg-shapeships-grey-90 border-shapeships-grey-70">
              <h3 className="text-shapeships-white mb-3">Debug Info</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-shapeships-grey-40 text-[rgb(255,255,255)]">Can Advance:</span>
                  <span className="text-shapeships-white">
                    {canAdvancePhase() ? 'Yes' : 'No'}
                  </span>
                </div>
                {phaseActionState?.blockingReason && (
                  <div className="text-shapeships-yellow text-sm mt-2">
                    {phaseActionState.blockingReason}
                  </div>
                )}
                <div className="flex justify-between mt-2">
                  <span className="text-shapeships-grey-40 text-[rgb(255,255,255)]">Is Automatic:</span>
                  <span className="text-shapeships-white">
                    {phaseActionState?.phaseMetadata?.isAutomatic ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create test game state with ships that have various powers
function createTestGameState(): GameState {
  const player1Id = 'player1';
  const player2Id = 'player2';
  
  const players: Player[] = [
    {
      id: player1Id,
      name: 'Player 1',
      faction: 'human',
      isReady: false,
      isActive: true,
      role: 'player',
      joinedAt: new Date().toISOString(),
      health: 100,
      lines: 10,
      savedLines: 0
    },
    {
      id: player2Id,
      name: 'Player 2',
      faction: 'xenite',
      isReady: false,
      isActive: false,
      role: 'player',
      joinedAt: new Date().toISOString(),
      health: 100,
      lines: 10,
      savedLines: 0
    }
  ];
  
  // Create test ships with charges
  const player1Ships: PlayerShip[] = [
    {
      id: 'ship-int-1',
      shipId: 'INT', // Interceptor
      ownerId: player1Id,
      originalSpecies: 'human',
      currentCharges: 1,
      maxCharges: 1
    },
    {
      id: 'ship-car-1',
      shipId: 'CAR', // Carrier
      ownerId: player1Id,
      originalSpecies: 'human',
      currentCharges: 6,
      maxCharges: 6
    },
    {
      id: 'ship-def-1',
      shipId: 'DEF', // Defender
      ownerId: player1Id,
      originalSpecies: 'human'
    },
    {
      id: 'ship-fig-1',
      shipId: 'FIG', // Fighter
      ownerId: player1Id,
      originalSpecies: 'human'
    }
  ];
  
  const player2Ships: PlayerShip[] = [
    {
      id: 'ship-ant-1',
      shipId: 'ANT', // Antlion
      ownerId: player2Id,
      originalSpecies: 'xenite',
      currentCharges: 1,
      maxCharges: 1
    },
    {
      id: 'ship-xen-1',
      shipId: 'XEN', // Xenite
      ownerId: player2Id,
      originalSpecies: 'xenite'
    },
    {
      id: 'ship-xen-2',
      shipId: 'XEN', // Xenite
      ownerId: player2Id,
      originalSpecies: 'xenite'
    }
  ];
  
  return {
    gameId: 'test-game',
    status: 'active',
    players,
    currentTurn: 1,
    currentPlayerId: player1Id,
    gameData: {
      board: null,
      ships: {
        [player1Id]: player1Ships,
        [player2Id]: player2Ships
      },
      resources: null,
      turnData: {
        diceRoll: 4
      }
    },
    actions: [],
    settings: {
      maxPlayers: 2
    },
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}