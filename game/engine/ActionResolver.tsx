// Action Resolution Layer
// Manages player actions within phases and determines when phases can advance
// Pure functions - no React dependencies

import { GameState, PlayerShip } from '../types/GameTypes';
import { 
  PhaseActionState, 
  PlayerActionState, 
  PendingAction, 
  CompletedAction,
  QueuedEffect,
  ActionResolutionResult,
  ActionOption,
  ActionEffect
} from '../types/ActionTypes';
import { Ship } from '../types/ShipTypes';
import SpeciesIntegration from './SpeciesIntegration';

/**
 * ActionResolver - Core logic for managing player actions within game phases
 * 
 * Responsibilities:
 * 1. Calculate what actions are available/required for each player in current phase
 * 2. Validate and process player action choices
 * 3. Determine when a phase can advance (both players ready)
 * 4. Queue effects for Health Resolution phase
 */
export class ActionResolver {
  
  /**
   * PRIMARY METHOD: Calculate what actions are needed right now
   * Called when entering a phase, or after a player completes an action
   */
  calculatePhaseActions(
    gameState: GameState,
    currentPhase: string,
    phaseIndex: number,
    completedActions: CompletedAction[] = []
  ): PhaseActionState {
    
    // Ensure completedActions is an array
    const safeCompletedActions = Array.isArray(completedActions) ? completedActions : [];
    
    const playerStates: { [playerId: string]: PlayerActionState } = {};
    
    // Get active players (role = 'player', not spectators)
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    
    // Calculate pending actions for each player based on current phase
    for (const player of activePlayers) {
      const pendingActions = this.calculatePlayerPendingActions(
        gameState,
        player.id,
        safeCompletedActions.filter(a => a.playerId === player.id)
      );
      
      const playerCompletedActions = safeCompletedActions.filter(a => a.playerId === player.id);
      const mandatoryActions = pendingActions.filter(a => a.mandatory);
      const hasMandatory = mandatoryActions.length > 0;
      
      playerStates[player.id] = {
        playerId: player.id,
        status: hasMandatory ? 'AWAITING_MANDATORY' : 
                (pendingActions.length > 0 ? 'AWAITING_OPTIONAL' : 'READY'),
        pendingActions,
        completedActions: playerCompletedActions,
        canDeclareReady: !hasMandatory,
        mustResolveFirst: mandatoryActions.map(a => a.actionId)
      };
    }
    
    // Determine if phase can advance
    const allPlayersReady = Object.values(playerStates).every(ps => ps.status === 'READY');
    const blockingPlayers = Object.values(playerStates)
      .filter(ps => ps.status !== 'READY')
      .map(ps => {
        const player = activePlayers.find(p => p.id === ps.playerId);
        return player?.name || ps.playerId;
      });
    
    let blockingReason: string | undefined;
    if (!allPlayersReady) {
      if (blockingPlayers.length === 1) {
        blockingReason = `Waiting for ${blockingPlayers[0]}`;
      } else {
        blockingReason = `Waiting for ${blockingPlayers.join(' and ')}`;
      }
    }
    
    // Determine if this is an automatic phase
    const isAutomatic = this.isAutomaticPhase(phaseIndex);
    
    return {
      phase: currentPhase,
      phaseIndex,
      playerStates,
      canAdvancePhase: allPlayersReady,
      blockingReason,
      phaseMetadata: {
        diceRoll: gameState.gameData?.turnData?.diceRoll,
        isAutomatic,
        requiresPlayerInput: !isAutomatic
      }
    };
  }
  
  /**
   * Calculate pending actions for a specific player in the current phase
   */
  private calculatePlayerPendingActions(
    gameState: GameState,
    playerId: string,
    completedActions: CompletedAction[]
  ): PendingAction[] {
    
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    const pendingActions: PendingAction[] = [];
    
    // Get completed action IDs for quick lookup
    const completedActionIds = new Set(completedActions.map(a => a.actionId));
    
    // TODO: Calculate actions based on new phase system - old phase indices removed
    // This will be reimplemented when ship powers are defined
    
    return pendingActions;
  }
  
  /**
   * Check if a phase is automatic (no player input required)
   */
  private isAutomaticPhase(phaseIndex: number): boolean {
    // Automatic phases: Roll Dice, Line Generation, Upon Completion, Automatic
    const automaticPhases = [1, 2, 3, 4]; // Example indices for automatic phases
    
    return automaticPhases.includes(phaseIndex);
  }
  
  /**
   * Validate and apply a player's action
   * Returns updated game state and new action resolution state
   */
  resolvePlayerAction(
    gameState: GameState,
    phaseActionState: PhaseActionState,
    playerId: string,
    actionId: string,
    chosenOption: string
  ): ActionResolutionResult {
    
    // Find the pending action
    const playerState = phaseActionState.playerStates[playerId];
    if (!playerState) {
      return {
        success: false,
        error: 'Player not found',
        effectsQueued: []
      };
    }
    
    const pendingAction = playerState.pendingActions.find(a => a.actionId === actionId);
    if (!pendingAction) {
      return {
        success: false,
        error: 'Action not found',
        effectsQueued: []
      };
    }
    
    // Find the chosen option
    const option = pendingAction.options.find(o => o.id === chosenOption);
    if (!option) {
      return {
        success: false,
        error: 'Invalid option',
        effectsQueued: []
      };
    }
    
    // Create queued effects
    const effectsQueued: QueuedEffect[] = [];
    const timestamp = Date.now();
    
    if (option.effect) {
      effectsQueued.push({
        id: `effect-${actionId}-${timestamp}`,
        type: option.effect.type,
        sourcePlayerId: playerId,
        sourceShipId: pendingAction.shipId,
        targetPlayerId: option.effect.targetPlayerId || playerId,
        value: option.effect.value,
        description: option.label,
        timestamp
      });
    }
    
    // Track state changes
    const stateChanges: ActionResolutionResult['stateChanges'] = {};
    
    // Handle charge consumption
    if (option.cost?.charges && pendingAction.shipId) {
      stateChanges.chargesUsed = {
        [pendingAction.shipId]: option.cost.charges
      };
    }
    
    return {
      success: true,
      effectsQueued,
      stateChanges
    };
  }
  
  /**
   * Mark player as explicitly ready (forfeiting optional actions)
   */
  declarePlayerReady(
    phaseActionState: PhaseActionState,
    playerId: string
  ): PhaseActionState {
    
    const playerState = phaseActionState.playerStates[playerId];
    if (!playerState) return phaseActionState;
    
    // Cannot declare ready if mandatory actions pending
    if (playerState.status === 'AWAITING_MANDATORY') {
      return phaseActionState;
    }
    
    // Create skip actions for all pending optional actions
    const completedActions: CompletedAction[] = [
      ...playerState.completedActions
    ];
    
    for (const pending of playerState.pendingActions) {
      completedActions.push({
        actionId: pending.actionId,
        playerId,
        chosenOption: 'skip',
        timestamp: Date.now()
      });
    }
    
    // Update player state
    const updatedPlayerState: PlayerActionState = {
      ...playerState,
      status: 'READY',
      pendingActions: [],
      completedActions,
      canDeclareReady: false
    };
    
    const updatedPlayerStates = {
      ...phaseActionState.playerStates,
      [playerId]: updatedPlayerState
    };
    
    // Check if all players ready
    const allReady = Object.values(updatedPlayerStates).every(ps => ps.status === 'READY');
    
    return {
      ...phaseActionState,
      playerStates: updatedPlayerStates,
      canAdvancePhase: allReady,
      blockingReason: allReady ? undefined : phaseActionState.blockingReason
    };
  }
  
  /**
   * Check if phase can advance
   */
  canAdvancePhase(phaseActionState: PhaseActionState): {
    canAdvance: boolean;
    reason?: string;
  } {
    return {
      canAdvance: phaseActionState.canAdvancePhase,
      reason: phaseActionState.blockingReason
    };
  }
  
  /**
   * Auto-resolve phases with no player input needed
   */
  autoResolvePhase(
    gameState: GameState,
    phaseIndex: number
  ): {
    effectsQueued: QueuedEffect[];
    autoAdvance: boolean;
  } {
    
    const effectsQueued: QueuedEffect[] = [];
    const timestamp = Date.now();
    
    // Automatic phase - calculate all automatic effects
    if (phaseIndex === 4) { // Example index for automatic phase
      const activePlayers = gameState.players.filter(p => p.role === 'player');
      
      for (const player of activePlayers) {
        const playerShips = gameState.gameData?.ships?.[player.id] || [];
        
        for (const ship of playerShips) {
          if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
          
          const shipData = SpeciesIntegration.getShipData(ship);
          if (!shipData) continue;
          
          // Check for Automatic powers
          const automaticPowers = (shipData.powers || []).filter(p => 
            p.subphase === 'Automatic'
          );
          
          for (const power of automaticPowers) {
            const effect = this.parsePowerEffect(power.description);
            
            // Determine target based on effect type
            const targetPlayerId = effect.type === 'DAMAGE' 
              ? this.getOpponentId(gameState, player.id)
              : player.id;
            
            effectsQueued.push({
              id: `auto-${ship.id}-${timestamp}-${effectsQueued.length}`,
              type: effect.type,
              sourcePlayerId: player.id,
              sourceShipId: ship.id,
              targetPlayerId,
              value: effect.value,
              description: `${shipData.name}: ${power.description}`,
              timestamp
            });
          }
        }
      }
    }
    
    return {
      effectsQueued,
      autoAdvance: this.isAutomaticPhase(phaseIndex)
    };
  }
  
  /**
   * Helper to get opponent player ID
   */
  private getOpponentId(gameState: GameState, playerId: string): string {
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    const opponent = activePlayers.find(p => p.id !== playerId);
    return opponent?.id || playerId;
  }
}

// Export singleton instance
export const actionResolver = new ActionResolver();