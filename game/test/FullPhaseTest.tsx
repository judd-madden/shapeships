// Full Phase Test - Comprehensive test interface for 3-phase system
// Tests BUILD PHASE → BATTLE PHASE → END OF TURN RESOLUTION with simultaneous declarations

import React, { useState, useEffect } from 'react';
import { GameState, Player, PlayerShip } from '../types/GameTypes';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { MajorPhase, BuildPhaseStep, BattlePhaseStep } from '../engine/GamePhases';
import { ArrowLeft, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { actionResolver } from '../engine/ActionResolver';
import { endOfTurnResolver } from '../engine/EndOfTurnResolver';
import { BattleCommitmentState, HiddenBattleActions } from '../types/BattleTypes';
import { TriggeredEffect } from '../types/EffectTypes'; // ✅ Use canonical EffectTypes

interface FullPhaseTestProps {
  initialGameState?: GameState;
  onBack?: () => void;
}

/**
 * Full Phase Test Interface
 * 
 * Demonstrates complete integration of:
 * - 3-phase GamePhases system (Build, Battle, End of Turn Resolution)
 * - Hidden declaration system with two reveal timings:
 *   • Build Phase declarations (Ships That Build + Drawing) → revealed at start of Battle Phase
 *   • Battle Phase declarations (Simultaneous Declaration + Conditional Response) → revealed immediately when both ready
 * - Ready state synchronization
 * - Effect queueing for End of Turn Resolution
 * 
 * This is a comprehensive test of the full game engine
 * with the new Battle Phase interaction model.
 */
export function FullPhaseTest({ initialGameState, onBack }: FullPhaseTestProps) {
  
  // Game state
  const [gameState, setGameState] = useState<GameState>(
    initialGameState || createTestGameState()
  );
  
  // Current player viewing (for demo - switch between players)
  const [viewingPlayerId, setViewingPlayerId] = useState(gameState.players[0].id);
  
  // Local pending declarations (hidden until both players ready)
  const [localPendingCharges, setLocalPendingCharges] = useState<any[]>([]);
  const [localPendingSolarPowers, setLocalPendingSolarPowers] = useState<any[]>([]);
  const [isLocalPlayerReady, setIsLocalPlayerReady] = useState(false);
  
  // Get current phase info from game state
  const currentMajorPhase = gameState.gameData?.turnData?.currentMajorPhase || MajorPhase.BUILD_PHASE;
  const currentStep = gameState.gameData?.turnData?.currentStep || (
    currentMajorPhase === MajorPhase.BUILD_PHASE ? BuildPhaseStep.DICE_ROLL : null
  );
  
  // Get player readiness
  const phaseReadiness = (gameState.gameData?.phaseReadiness as any[]) || [];
  const isPlayerReady = phaseReadiness.some(
    pr => pr.playerId === viewingPlayerId && pr.isReady && pr.currentStep === currentStep
  );
  
  // Check if opponent is ready
  const opponentId = gameState.players.find(p => p.id !== viewingPlayerId)?.id;
  const isOpponentReady = phaseReadiness.some(
    pr => pr.playerId === opponentId && pr.isReady && pr.currentStep === currentStep
  );
  
  // Get accumulated effects
  const accumulatedDamage = gameState.gameData?.turnData?.accumulatedDamage || {};
  const accumulatedHealing = gameState.gameData?.turnData?.accumulatedHealing || {};
  
  // Determine if current step is automatic or requires player action
  const isAutomaticStep = () => {
    return currentStep === BuildPhaseStep.DICE_ROLL ||
           currentStep === BuildPhaseStep.LINE_GENERATION ||
           currentStep === BuildPhaseStep.END_OF_BUILD ||
           currentStep === BattlePhaseStep.FIRST_STRIKE ||
           currentMajorPhase === MajorPhase.END_OF_TURN_RESOLUTION; // Auto-advance through resolution
  };
  
  // Determine if this is a hidden declaration step
  // Build Phase: Ships That Build + Drawing (revealed at start of Battle)
  // Battle Phase: Simultaneous Declaration + Conditional Response (revealed immediately)
  const isHiddenDeclarationStep = () => {
    return currentStep === BuildPhaseStep.SHIPS_THAT_BUILD ||
           currentStep === BuildPhaseStep.DRAWING ||
           currentStep === BattlePhaseStep.SIMULTANEOUS_DECLARATION ||
           currentStep === BattlePhaseStep.CONDITIONAL_RESPONSE;
  };
  
  // Check if players act synchronously (all interactive steps are synchronous)
  const isSynchronousStep = () => {
    return !isAutomaticStep() && currentMajorPhase !== MajorPhase.END_OF_GAME;
  };
  
  // Auto-advance when both players are ready for non-hidden-declaration interactive steps
  useEffect(() => {
    if (!isAutomaticStep() && !isHiddenDeclarationStep() && isPlayerReady && isOpponentReady) {
      // Both players ready - advance phase after short delay
      const timer = setTimeout(() => {
        advancePhase();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerReady, isOpponentReady, currentStep]);
  
  // Auto-advance when both players are ready for hidden declaration steps
  useEffect(() => {
    if (isHiddenDeclarationStep() && isPlayerReady && isOpponentReady) {
      // Both players locked in - reveal and advance after short delay
      const timer = setTimeout(() => {
        // Reveal declarations
        const allCharges = gameState.gameData?.turnData?.chargeDeclarations || [];
        const allSolar = gameState.gameData?.turnData?.solarPowerDeclarations || [];
        
        setGameState(prev => ({
          ...prev,
          gameData: {
            ...prev.gameData,
            turnData: {
              ...prev.gameData.turnData,
              chargeDeclarations: [...allCharges, ...localPendingCharges],
              solarPowerDeclarations: [...allSolar, ...localPendingSolarPowers],
              anyDeclarationsMade: localPendingCharges.length > 0 || localPendingSolarPowers.length > 0
            }
          }
        }));
        
        // Clear pending
        setLocalPendingCharges([]);
        setLocalPendingSolarPowers([]);
        setIsLocalPlayerReady(false);
        
        // Advance to next step
        setTimeout(() => {
          advancePhase();
        }, 1000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerReady, isOpponentReady, currentStep, isHiddenDeclarationStep]);
  
  // Handle declaring a charge (hidden)
  const handleDeclareCharge = (shipId: string, powerIndex: number) => {
    if (isPlayerReady) {
      alert('You have already locked in your declarations!');
      return;
    }
    
    const newDeclaration = {
      playerId: viewingPlayerId,
      shipId,
      powerIndex,
      timestamp: new Date().toISOString()
    };
    
    setLocalPendingCharges(prev => [...prev, newDeclaration]);
  };
  
  // Handle declaring a solar power (hidden)
  const handleDeclareSolarPower = (powerType: string, energyCost: any) => {
    if (isPlayerReady) {
      alert('You have already locked in your declarations!');
      return;
    }
    
    const newDeclaration = {
      playerId: viewingPlayerId,
      powerType,
      energyCost,
      timestamp: new Date().toISOString()
    };
    
    setLocalPendingSolarPowers(prev => [...prev, newDeclaration]);
  };
  
  // Lock in declarations (mark ready)
  const handleLockInDeclarations = () => {
    if (isPlayerReady) {
      alert('You have already locked in your declarations!');
      return;
    }
    
    // In real implementation, this would send to server
    // For now, just mark locally as ready
    setIsLocalPlayerReady(true);
    
    // Add to phase readiness
    const updatedReadiness = phaseReadiness.filter(pr => pr.playerId !== viewingPlayerId);
    updatedReadiness.push({
      playerId: viewingPlayerId,
      isReady: true,
      currentStep: currentStep,
      declaredAt: new Date().toISOString()
    });
    
    setGameState(prev => ({
      ...prev,
      gameData: {
        ...prev.gameData,
        phaseReadiness: updatedReadiness
      }
    }));
    
    // Simulate checking if both ready → reveal
    setTimeout(() => {
      checkAndRevealDeclarations();
    }, 500);
  };
  
  // Check if both players ready, then reveal
  const checkAndRevealDeclarations = () => {
    const updatedReadiness = gameState.gameData?.phaseReadiness as any[] || [];
    const allReady = gameState.players.every(player => {
      return updatedReadiness.some(pr => 
        pr.playerId === player.id && pr.isReady && pr.currentStep === currentStep
      );
    });
    
    if (allReady && isHiddenDeclarationStep()) {
      // Both ready → Reveal declarations
      alert('Both players ready! Revealing declarations...');
      
      // Merge pending into main declarations
      const allCharges = gameState.gameData?.turnData?.chargeDeclarations || [];
      const allSolar = gameState.gameData?.turnData?.solarPowerDeclarations || [];
      
      setGameState(prev => ({
        ...prev,
        gameData: {
          ...prev.gameData,
          turnData: {
            ...prev.gameData.turnData,
            chargeDeclarations: [...allCharges, ...localPendingCharges],
            solarPowerDeclarations: [...allSolar, ...localPendingSolarPowers],
            anyDeclarationsMade: localPendingCharges.length > 0 || localPendingSolarPowers.length > 0
          }
        }
      }));
      
      // Clear pending
      setLocalPendingCharges([]);
      setLocalPendingSolarPowers([]);
      setIsLocalPlayerReady(false);
      
      // Advance to next step
      setTimeout(() => {
        advancePhase();
      }, 1000);
    }
  };
  
  // Handle ready for non-simultaneous steps
  const handleDeclareReady = () => {
    const updatedReadiness = phaseReadiness.filter(pr => pr.playerId !== viewingPlayerId);
    updatedReadiness.push({
      playerId: viewingPlayerId,
      isReady: true,
      currentStep: currentStep,
      declaredAt: new Date().toISOString()
    });
    
    setGameState(prev => ({
      ...prev,
      gameData: {
        ...prev.gameData,
        phaseReadiness: updatedReadiness
      }
    }));
  };
  
  // Advance to next phase/step
  const advancePhase = () => {
    // Clear readiness for next step
    const clearedState = {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: []
      }
    };
    
    // Determine next step based on current phase
    if (currentMajorPhase === MajorPhase.BUILD_PHASE) {
      switch (currentStep) {
        case BuildPhaseStep.DICE_ROLL:
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentStep: BuildPhaseStep.LINE_GENERATION,
                diceRoll: Math.floor(Math.random() * 6) + 1
              }
            }
          });
          break;
        case BuildPhaseStep.LINE_GENERATION:
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentStep: BuildPhaseStep.SHIPS_THAT_BUILD
              }
            }
          });
          break;
        case BuildPhaseStep.SHIPS_THAT_BUILD:
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentStep: BuildPhaseStep.DRAWING
              }
            }
          });
          break;
        case BuildPhaseStep.DRAWING:
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentStep: BuildPhaseStep.END_OF_BUILD
              }
            }
          });
          break;
        case BuildPhaseStep.END_OF_BUILD:
          // Move to Battle Phase
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentMajorPhase: MajorPhase.BATTLE_PHASE,
                currentStep: BattlePhaseStep.FIRST_STRIKE
              }
            }
          });
          break;
      }
    } else if (currentMajorPhase === MajorPhase.BATTLE_PHASE) {
      switch (currentStep) {
        case BattlePhaseStep.FIRST_STRIKE:
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentStep: BattlePhaseStep.SIMULTANEOUS_DECLARATION
              }
            }
          });
          break;
        case BattlePhaseStep.SIMULTANEOUS_DECLARATION:
          // Check if any declarations were made
          const anyDeclarations = gameState.gameData?.turnData?.anyDeclarationsMade;
          
          // 🔒 EXPLICIT GATE: Response window only happens if declarations made
          if (!anyDeclarations) {
            console.log('⏭️ No declarations made - skipping Response window');
          }
          
          if (anyDeclarations) {
            // Move to response
            setGameState({
              ...clearedState,
              gameData: {
                ...clearedState.gameData,
                turnData: {
                  ...clearedState.gameData.turnData,
                  currentStep: BattlePhaseStep.CONDITIONAL_RESPONSE,
                  anyDeclarationsMade: false // Reset for response step
                }
              }
            });
          } else {
            // Skip response, go to End of Turn Resolution
            console.log('🎯 No declarations - advancing directly to End of Turn Resolution');
            setGameState({
              ...clearedState,
              gameData: {
                ...clearedState.gameData,
                turnData: {
                  ...clearedState.gameData.turnData,
                  currentMajorPhase: MajorPhase.END_OF_TURN_RESOLUTION,
                  currentStep: null
                }
              }
            });
          }
          break;
        case BattlePhaseStep.CONDITIONAL_RESPONSE:
          // Move to End of Turn Resolution
          setGameState({
            ...clearedState,
            gameData: {
              ...clearedState.gameData,
              turnData: {
                ...clearedState.gameData.turnData,
                currentMajorPhase: MajorPhase.END_OF_TURN_RESOLUTION,
                currentStep: null
              }
            }
          });
          break;
      }
    } else if (currentMajorPhase === MajorPhase.END_OF_TURN_RESOLUTION) {
      // Apply effects and start new turn
      applyQueuedEffects();
      resetForNextTurn();
    }
  };
  
  // Apply all queued effects (End of Turn Resolution)
  const applyQueuedEffects = () => {
    console.log('🔄 Running End of Turn Resolution...');
    
    // Get triggered effects from game state
    const triggeredEffects = (gameState.gameData?.turnData?.triggeredEffects || []) as TriggeredEffect[];
    
    // Call EndOfTurnResolver
    const result = endOfTurnResolver.resolveEndOfTurn(gameState, triggeredEffects);
    
    console.log('✅ End of Turn Resolution complete:', result);
    
    // Update game state with results
    setGameState(prev => {
      const updated = { ...prev };
      
      // Health changes already applied by resolver
      // Just need to check for game end
      if (result.gameEnded) {
        updated.status = 'completed';
        if (result.winner) {
          alert(`Game Over! ${gameState.players.find(p => p.id === result.winner)?.name} wins!`);
        } else {
          alert('Game Over! Draw!');
        }
      }
      
      return updated;
    });
  };
  
  // Reset for next turn
  const resetForNextTurn = () => {
    setGameState(prev => ({
      ...prev,
      roundNumber: prev.roundNumber + 1,
      gameData: {
        ...prev.gameData,
        turnData: {
          turnNumber: (prev.gameData?.turnData?.turnNumber || 0) + 1,
          currentMajorPhase: MajorPhase.BUILD_PHASE,
          currentStep: BuildPhaseStep.DICE_ROLL,
          triggeredEffects: [], // NEW: Reset triggered effects
          accumulatedDamage: {},
          accumulatedHealing: {},
          healthAtTurnStart: {},
          onceOnlyAutomaticEffects: [],
          continuousAutomaticShips: [],
          chargeDeclarations: [],
          solarPowerDeclarations: [],
          pendingChargeDeclarations: {},
          pendingSOLARPowerDeclarations: {}
        },
        phaseReadiness: []
      }
    }));
  };
  
  // Switch viewing player (for demo)
  const switchPlayer = () => {
    const currentIndex = gameState.players.findIndex(p => p.id === viewingPlayerId);
    const nextIndex = (currentIndex + 1) % gameState.players.length;
    setViewingPlayerId(gameState.players[nextIndex].id);
    
    // Reset local state when switching
    setLocalPendingCharges([]);
    setLocalPendingSolarPowers([]);
    setIsLocalPlayerReady(false);
  };
  
  const viewingPlayer = gameState.players.find(p => p.id === viewingPlayerId);
  const opponentPlayer = gameState.players.find(p => p.id !== viewingPlayerId);
  
  // Get phase display name
  const getPhaseDisplayName = () => {
    if (currentMajorPhase === MajorPhase.BUILD_PHASE) {
      switch (currentStep) {
        case BuildPhaseStep.DICE_ROLL: return 'Roll Dice';
        case BuildPhaseStep.LINE_GENERATION: return 'Line Generation';
        case BuildPhaseStep.SHIPS_THAT_BUILD: return 'Ships That Build';
        case BuildPhaseStep.DRAWING: return 'Drawing';
        case BuildPhaseStep.END_OF_BUILD: return 'End of Build';
        default: return 'Build Phase';
      }
    } else if (currentMajorPhase === MajorPhase.BATTLE_PHASE) {
      switch (currentStep) {
        case BattlePhaseStep.FIRST_STRIKE: return 'First Strike';
        case BattlePhaseStep.SIMULTANEOUS_DECLARATION: return 'Simultaneous Declaration';
        case BattlePhaseStep.CONDITIONAL_RESPONSE: return 'Conditional Response';
        default: return 'Battle Phase';
      }
    } else if (currentMajorPhase === MajorPhase.END_OF_TURN_RESOLUTION) {
      return 'End of Turn Resolution';
    }
    return 'Unknown Phase';
  };
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="outline"
                  className="mb-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              )}
              <div>
                <h1>Full Phase Test - 3-Phase System</h1>
                <p className="text-gray-600">
                  Testing Build → Battle → End of Turn Resolution with simultaneous declarations
                </p>
              </div>
            </div>
            <Button
              onClick={switchPlayer}
              variant="outline"
            >
              Switch to {opponentPlayer?.name}
            </Button>
          </div>
        </div>
        
        {/* Phase Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Phase Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-gray-600 text-sm mb-1">Round {gameState.roundNumber}</div>
                <div className="text-lg">
                  {currentMajorPhase.toUpperCase().replace(/_/g, ' ')}
                </div>
                <div className="text-gray-600 text-sm mt-1">
                  {getPhaseDisplayName()}
                </div>
              </div>
              {!isAutomaticStep() && !isHiddenDeclarationStep() && (
                <Button
                  onClick={handleDeclareReady}
                  disabled={isPlayerReady}
                >
                  {isPlayerReady ? 'Ready ✓' : 'Declare Ready'}
                </Button>
              )}
              {isAutomaticStep() && (
                <Button
                  onClick={advancePhase}
                >
                  Auto-Advance →
                </Button>
              )}
            </div>
            
            {/* Readiness Status */}
            <div className="flex gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isPlayerReady ? 'bg-green-600' : 'bg-gray-300'}`} />
                <span className="text-sm">
                  {viewingPlayer?.name}: {isPlayerReady ? 'Ready' : 'Not Ready'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isOpponentReady ? 'bg-green-600' : 'bg-gray-300'}`} />
                <span className="text-sm">
                  {opponentPlayer?.name}: {isOpponentReady ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Current Player View */}
          <div className="space-y-6">
            
            {/* Player Info */}
            <Card>
              <CardHeader>
                <CardTitle>{viewingPlayer?.name} (You)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Health:</span>
                  <span>
                    {viewingPlayer?.health || 25}
                    {accumulatedDamage[viewingPlayerId] ? (
                      <span className="text-red-600 ml-2">
                        -{accumulatedDamage[viewingPlayerId]}
                      </span>
                    ) : null}
                    {accumulatedHealing[viewingPlayerId] ? (
                      <span className="text-green-600 ml-2">
                        +{accumulatedHealing[viewingPlayerId]}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Lines:</span>
                  <span>{viewingPlayer?.lines || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Dice Roll:</span>
                  <span>
                    {gameState.gameData?.turnData?.diceRoll || '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            {/* Ship List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Ships</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {gameState.gameData.ships[viewingPlayerId]?.length > 0 ? (
                  gameState.gameData.ships[viewingPlayerId].map(ship => (
                    <div
                      key={ship.id}
                      className="p-2 bg-gray-50 rounded border"
                    >
                      <div className="flex justify-between items-center text-sm">
                        <span>{ship.shipId}</span>
                        {ship.currentCharges !== undefined && (
                          <span className="text-gray-600">
                            {ship.currentCharges}/{ship.maxCharges} charges
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No ships yet</p>
                )}
              </CardContent>
            </Card>
            
            {/* Simultaneous Declaration Panel */}
            {isHiddenDeclarationStep() && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {currentStep === BattlePhaseStep.SIMULTANEOUS_DECLARATION 
                        ? 'Declare Charges/Solar Powers' 
                        : 'Declare Responses'}
                    </CardTitle>
                    {isPlayerReady ? (
                      <Lock className="w-4 h-4 text-orange-600" />
                    ) : (
                      <Unlock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Your pending declarations (visible to you) */}
                  <div className="space-y-2">
                    <div className="text-sm text-gray-700">Your Pending Declarations:</div>
                    {localPendingCharges.map((charge, i) => (
                      <div key={i} className="p-2 bg-blue-100 rounded text-sm border border-blue-200">
                        <span>
                          Charge: {charge.shipId} (Power {charge.powerIndex})
                        </span>
                      </div>
                    ))}
                    {localPendingSolarPowers.map((power, i) => (
                      <div key={i} className="p-2 bg-blue-100 rounded text-sm border border-blue-200">
                        <span>
                          Solar Power: {power.powerType}
                        </span>
                      </div>
                    ))}
                    {localPendingCharges.length === 0 && localPendingSolarPowers.length === 0 && (
                      <div className="text-sm text-gray-500">None yet</div>
                    )}
                  </div>
                  
                  {/* Opponent's status (hidden) */}
                  <div className="p-3 bg-white rounded border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 text-sm">
                          {opponentPlayer?.name}'s declarations: Hidden
                        </span>
                      </div>
                      <span className={`text-sm ${isOpponentReady ? 'text-green-600' : 'text-gray-500'}`}>
                        {isOpponentReady ? 'Ready ✓' : 'Not Ready'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Test actions */}
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleDeclareCharge('INT', 0)}
                      disabled={isPlayerReady}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Test: Declare Interceptor Charge
                    </Button>
                    <Button
                      onClick={() => handleDeclareSolarPower('NOVA', { red: 3 })}
                      disabled={isPlayerReady}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Test: Declare Nova Solar Power
                    </Button>
                  </div>
                  
                  {/* Lock in button */}
                  <Button
                    onClick={handleLockInDeclarations}
                    disabled={isPlayerReady}
                    className="w-full"
                  >
                    {isPlayerReady ? 'Locked In ✓' : 'Lock In Declarations'}
                  </Button>
                  
                  {isPlayerReady && (
                    <div className="text-center text-sm text-orange-700 mt-2">
                      Waiting for {opponentPlayer?.name}...
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Right Column: Game State View */}
          <div className="space-y-6">
            
            {/* Revealed Declarations */}
            <Card>
              <CardHeader>
                <CardTitle>Revealed Declarations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-gray-700">Charges:</div>
                {gameState.gameData?.turnData?.chargeDeclarations?.map((charge, i) => (
                  <div key={i} className="p-2 bg-gray-50 rounded text-sm border">
                    <span>
                      {gameState.players.find(p => p.id === charge.playerId)?.name}: {charge.shipId} (Power {charge.powerIndex})
                    </span>
                  </div>
                ))}
                
                <div className="text-sm text-gray-700 mt-3">Solar Powers:</div>
                {gameState.gameData?.turnData?.solarPowerDeclarations?.map((power, i) => (
                  <div key={i} className="p-2 bg-gray-50 rounded text-sm border">
                    <span>
                      {gameState.players.find(p => p.id === power.playerId)?.name}: {power.powerType}
                    </span>
                  </div>
                ))}
                
                {(!gameState.gameData?.turnData?.chargeDeclarations || 
                  gameState.gameData.turnData.chargeDeclarations.length === 0) &&
                 (!gameState.gameData?.turnData?.solarPowerDeclarations || 
                  gameState.gameData.turnData.solarPowerDeclarations.length === 0) && (
                  <div className="text-sm text-gray-500">None yet</div>
                )}
              </CardContent>
            </Card>
            
            {/* Effect Queue */}
            <Card>
              <CardHeader>
                <CardTitle>Accumulated Effects (Will Apply at End of Turn)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(accumulatedDamage).map(([playerId, damage]) => {
                  if (!damage) return null;
                  const player = gameState.players.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="p-2 bg-red-50 rounded text-sm border border-red-200">
                      <span className="text-red-700">
                        ⚔️ {player?.name} will take {damage} damage
                      </span>
                    </div>
                  );
                })}
                {Object.entries(accumulatedHealing).map(([playerId, healing]) => {
                  if (!healing) return null;
                  const player = gameState.players.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="p-2 bg-green-50 rounded text-sm border border-green-200">
                      <span className="text-green-700">
                        💚 {player?.name} will heal {healing}
                      </span>
                    </div>
                  );
                })}
                {Object.keys(accumulatedDamage).length === 0 && 
                 Object.keys(accumulatedHealing).length === 0 && (
                  <div className="text-sm text-gray-500">No effects queued yet</div>
                )}
              </CardContent>
            </Card>
            
            {/* Debug Info */}
            <Card>
              <CardHeader>
                <CardTitle>Debug Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Major Phase:</span>
                  <span>{currentMajorPhase}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Step:</span>
                  <span>{currentStep || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Is Automatic:</span>
                  <span>
                    {isAutomaticStep() ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Is Synchronous:</span>
                  <span>
                    {isSynchronousStep() ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hidden Declaration:</span>
                  <span>
                    {isHiddenDeclarationStep() ? 'Yes' : 'No'}
                  </span>
                </div>
              </CardContent>
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
      health: 25,
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
      health: 25,
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
    }
  ];
  
  return {
    gameId: 'test-game',
    status: 'active',
    players,
    roundNumber: 1, // Tracks complete Build→Battle→Resolution cycles
    currentPlayerId: player1Id,
    gameData: {
      board: null,
      ships: {
        [player1Id]: player1Ships,
        [player2Id]: player2Ships
      },
      resources: null,
      turnData: {
        turnNumber: 1,
        currentMajorPhase: MajorPhase.BUILD_PHASE,
        currentStep: BuildPhaseStep.DICE_ROLL,
        triggeredEffects: [], // NEW: Triggered effects queue
        accumulatedDamage: {},
        accumulatedHealing: {},
        healthAtTurnStart: {
          [player1Id]: 25,
          [player2Id]: 25
        },
        onceOnlyAutomaticEffects: [],
        continuousAutomaticShips: [],
        chargeDeclarations: [],
        solarPowerDeclarations: [],
        pendingChargeDeclarations: {},
        pendingSOLARPowerDeclarations: {}
      },
      phaseReadiness: []
    },
    actions: [],
    settings: {
      maxPlayers: 2
    },
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}