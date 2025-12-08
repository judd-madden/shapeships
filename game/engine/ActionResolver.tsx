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
import { SubPhase } from './GamePhases';
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
    subPhase?: number,
    completedActions: CompletedAction[] = []
  ): PhaseActionState {
    
    const playerStates: { [playerId: string]: PlayerActionState } = {};
    
    // Get active players (role = 'player', not spectators)
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    
    // Calculate pending actions for each player based on current phase
    for (const player of activePlayers) {
      const pendingActions = this.calculatePlayerPendingActions(
        gameState,
        player.id,
        subPhase,
        completedActions.filter(a => a.playerId === player.id)
      );
      
      const playerCompletedActions = completedActions.filter(a => a.playerId === player.id);
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
    const isAutomatic = this.isAutomaticPhase(subPhase);
    
    return {
      phase: currentPhase,
      phaseIndex,
      subPhase,
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
    subPhase: number | undefined,
    completedActions: CompletedAction[]
  ): PendingAction[] {
    
    if (!subPhase) return [];
    
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    const pendingActions: PendingAction[] = [];
    
    // Get completed action IDs for quick lookup
    const completedActionIds = new Set(completedActions.map(a => a.actionId));
    
    switch (subPhase) {
      case SubPhase.CHARGE_DECLARATION:
        pendingActions.push(
          ...this.calculateChargeActions(playerId, playerShips, completedActionIds)
        );
        break;
        
      case SubPhase.DRAWING:
        pendingActions.push(
          ...this.calculateDrawingPhaseActions(gameState, playerId, playerShips, completedActionIds)
        );
        break;
        
      case SubPhase.SHIPS_THAT_BUILD:
        pendingActions.push(
          ...this.calculateShipBuildActions(gameState, playerId, playerShips, completedActionIds)
        );
        break;
        
      case SubPhase.DICE_MANIPULATION:
        pendingActions.push(
          ...this.calculateDiceManipulationActions(playerId, playerShips, completedActionIds)
        );
        break;
        
      // Other phases will be implemented as needed
      default:
        break;
    }
    
    return pendingActions;
  }
  
  /**
   * Calculate charge-based actions (Charge Declaration phase)
   */
  private calculateChargeActions(
    playerId: string,
    playerShips: PlayerShip[],
    completedActionIds: Set<string>
  ): PendingAction[] {
    
    const actions: PendingAction[] = [];
    
    for (const ship of playerShips) {
      if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
      
      const shipData = SpeciesIntegration.getShipData(ship);
      if (!shipData) continue;
      
      // Check if ship has charge-based powers in Charge Declaration phase
      const chargeActions = this.getShipChargeActions(ship, shipData, playerId);
      
      for (const action of chargeActions) {
        if (!completedActionIds.has(action.actionId)) {
          actions.push(action);
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Get charge actions for a specific ship
   */
  private getShipChargeActions(
    ship: PlayerShip,
    shipData: Ship,
    playerId: string
  ): PendingAction[] {
    
    const actions: PendingAction[] = [];
    
    // Check if ship has charges
    if (!shipData.charges || shipData.charges === 0) return actions;
    
    // Get current charge count from ship state (TODO: add charge tracking to PlayerShip)
    const currentCharges = shipData.charges; // Will be dynamic later
    
    if (currentCharges === 0) return actions; // No charges left
    
    // Check each power for Charge Declaration subphase
    const powers = shipData.powers || [];
    const chargePowers = powers.filter(p => 
      p.subphase === 'Charge Declaration' && 
      p.description.includes('use 1 charge')
    );
    
    if (chargePowers.length === 0) return actions;
    
    // Build options for this charge action
    const options: ActionOption[] = [];
    
    for (const power of chargePowers) {
      // Parse power description to determine effect
      const effect = this.parsePowerEffect(power.description);
      
      options.push({
        id: effect.type.toLowerCase() + '_' + (effect.value || 0),
        label: this.formatPowerLabel(power.description),
        effect,
        cost: { charges: 1 }
      });
    }
    
    // Always add skip option for optional charges
    options.push({
      id: 'skip',
      label: "Don't use charge",
      effect: undefined
    });
    
    actions.push({
      actionId: `charge-${ship.id}`,
      playerId,
      type: 'CHARGE_USE',
      shipId: ship.id,
      mandatory: false, // Charges are optional
      options,
      metadata: {
        charges: currentCharges,
        maxCharges: shipData.charges,
        description: shipData.name,
        canUseMultiple: currentCharges > 1 && chargePowers.length > 1
      }
    });
    
    return actions;
  }
  
  /**
   * Calculate actions for Drawing phase (Frigate trigger selection)
   */
  private calculateDrawingPhaseActions(
    gameState: GameState,
    playerId: string,
    playerShips: PlayerShip[],
    completedActionIds: Set<string>
  ): PendingAction[] {
    
    const actions: PendingAction[] = [];
    
    for (const ship of playerShips) {
      if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
      
      const shipData = SpeciesIntegration.getShipData(ship);
      if (!shipData) continue;
      
      // Check for Frigate - needs trigger number selection on first build
      if (shipData.id === 'FRI') {
        // TODO: Check if trigger number already set (need to add to ship state)
        const hasTriggerNumber = false; // Will check ship metadata later
        
        if (!hasTriggerNumber) {
          const actionId = `frigate-trigger-${ship.id}`;
          if (!completedActionIds.has(actionId)) {
            actions.push({
              actionId,
              playerId,
              type: 'TRIGGER_SELECTION',
              shipId: ship.id,
              mandatory: true, // Must choose trigger number
              options: [
                { id: 'trigger_1', label: '1' },
                { id: 'trigger_2', label: '2' },
                { id: 'trigger_3', label: '3' },
                { id: 'trigger_4', label: '4' },
                { id: 'trigger_5', label: '5' },
                { id: 'trigger_6', label: '6' }
              ],
              metadata: {
                description: 'Choose trigger number for Frigate'
              }
            });
          }
        }
      }
      
      // Check for Evolver - can transform Xenite to Oxite/Asterite
      if (shipData.id === 'EVO') {
        // Check if player has any Xenites available
        const hasXenites = playerShips.some(s => {
          const sd = SpeciesIntegration.getShipData(s);
          return sd?.id === 'XEN' && !s.isDestroyed && !s.isConsumedInUpgrade;
        });
        
        if (hasXenites) {
          const actionId = `evolver-transform-${ship.id}`;
          if (!completedActionIds.has(actionId)) {
            actions.push({
              actionId,
              playerId,
              type: 'SHIP_TRANSFORM',
              shipId: ship.id,
              mandatory: false, // Optional transformation
              options: [
                { 
                  id: 'transform_oxite', 
                  label: 'Transform Xenite to Oxite',
                  effect: { type: 'TRANSFORM_SHIP', targetShipType: 'OXI' }
                },
                { 
                  id: 'transform_asterite', 
                  label: 'Transform Xenite to Asterite',
                  effect: { type: 'TRANSFORM_SHIP', targetShipType: 'AST' }
                },
                { id: 'skip', label: 'Don\'t transform' }
              ],
              metadata: {
                description: 'Transform a Xenite (optional)'
              }
            });
          }
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Calculate ship building actions (Ships That Build phase)
   */
  private calculateShipBuildActions(
    gameState: GameState,
    playerId: string,
    playerShips: PlayerShip[],
    completedActionIds: Set<string>
  ): PendingAction[] {
    
    const actions: PendingAction[] = [];
    
    // Ships that can build other ships (Carrier, Bug Breeder, etc.)
    for (const ship of playerShips) {
      if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
      
      const shipData = SpeciesIntegration.getShipData(ship);
      if (!shipData) continue;
      
      // Check for "Ships That Build" powers
      const buildPowers = (shipData.powers || []).filter(p => 
        p.subphase === 'Ships That Build'
      );
      
      if (buildPowers.length === 0) continue;
      
      // Carrier - can make Defender (1 charge) or Fighter (2 charges)
      if (shipData.id === 'CAR') {
        const currentCharges = shipData.charges || 0; // TODO: get from ship state
        
        if (currentCharges > 0) {
          const actionId = `carrier-build-${ship.id}`;
          if (!completedActionIds.has(actionId)) {
            const options: ActionOption[] = [];
            
            if (currentCharges >= 1) {
              options.push({
                id: 'build_defender',
                label: 'Make a Defender (use 1 charge)',
                effect: { type: 'BUILD_SHIP', targetShipType: 'DEF' },
                cost: { charges: 1 }
              });
            }
            
            if (currentCharges >= 2) {
              options.push({
                id: 'build_fighter',
                label: 'Make a Fighter (use 2 charges)',
                effect: { type: 'BUILD_SHIP', targetShipType: 'FIG' },
                cost: { charges: 2 }
              });
            }
            
            options.push({ id: 'skip', label: 'Don\'t build' });
            
            actions.push({
              actionId,
              playerId,
              type: 'SHIP_BUILD',
              shipId: ship.id,
              mandatory: false,
              options,
              metadata: {
                charges: currentCharges,
                maxCharges: shipData.charges,
                description: 'Carrier ship building',
                canUseMultiple: true // Can use multiple times until charges depleted
              }
            });
          }
        }
      }
      
      // Bug Breeder - can make Xenite (1 charge each)
      if (shipData.id === 'BUG') {
        const currentCharges = shipData.charges || 0;
        
        if (currentCharges > 0) {
          const actionId = `bug-breeder-build-${ship.id}`;
          if (!completedActionIds.has(actionId)) {
            actions.push({
              actionId,
              playerId,
              type: 'SHIP_BUILD',
              shipId: ship.id,
              mandatory: false,
              options: [
                {
                  id: 'build_xenite',
                  label: 'Make a Xenite (use 1 charge)',
                  effect: { type: 'BUILD_SHIP', targetShipType: 'XEN' },
                  cost: { charges: 1 }
                },
                { id: 'skip', label: 'Don\'t build' }
              ],
              metadata: {
                charges: currentCharges,
                maxCharges: shipData.charges,
                description: 'Bug Breeder ship building',
                canUseMultiple: true
              }
            });
          }
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Calculate dice manipulation actions (Leviathan, Ark of Knowledge)
   */
  private calculateDiceManipulationActions(
    playerId: string,
    playerShips: PlayerShip[],
    completedActionIds: Set<string>
  ): PendingAction[] {
    
    const actions: PendingAction[] = [];
    
    // Check for Ark of Knowledge - can reroll dice
    const arksOfKnowledge = playerShips.filter(s => {
      const shipData = SpeciesIntegration.getShipData(s);
      return shipData?.id === 'KNO' && !s.isDestroyed && !s.isConsumedInUpgrade;
    });
    
    if (arksOfKnowledge.length > 0) {
      const actionId = `dice-reroll-${playerId}`;
      if (!completedActionIds.has(actionId)) {
        const maxRerolls = Math.min(arksOfKnowledge.length, 2); // Max 2 rerolls
        
        actions.push({
          actionId,
          playerId,
          type: 'DICE_REROLL',
          mandatory: false,
          options: [
            {
              id: 'reroll',
              label: `Reroll dice (${maxRerolls} reroll${maxRerolls > 1 ? 's' : ''} available)`,
              effect: { type: 'DICE_REROLL' }
            },
            { id: 'skip', label: 'Don\'t reroll' }
          ],
          metadata: {
            description: 'Ark of Knowledge dice reroll',
            maxUses: maxRerolls
          }
        });
      }
    }
    
    return actions;
  }
  
  /**
   * Parse power description to determine effect type and value
   */
  private parsePowerEffect(description: string): ActionEffect {
    // Simple parsing - will be enhanced later
    if (description.toLowerCase().includes('heal')) {
      const match = description.match(/heal\s+(\d+)/i);
      return {
        type: 'HEALING',
        value: match ? parseInt(match[1]) : 0,
        description
      };
    }
    
    if (description.toLowerCase().includes('deal') && description.toLowerCase().includes('damage')) {
      const match = description.match(/deal\s+(\d+)\s+damage/i);
      return {
        type: 'DAMAGE',
        value: match ? parseInt(match[1]) : 0,
        description
      };
    }
    
    return {
      type: 'DAMAGE',
      value: 0,
      description
    };
  }
  
  /**
   * Format power description for display
   */
  private formatPowerLabel(description: string): string {
    // Remove "(use 1 charge)" text for cleaner labels
    return description.replace(/\s*\(use \d+ charges?\)/i, '').trim();
  }
  
  /**
   * Check if a phase is automatic (no player input required)
   */
  private isAutomaticPhase(subPhase: number | undefined): boolean {
    if (!subPhase) return false;
    
    // Automatic phases: Roll Dice, Line Generation, Upon Completion, Automatic
    const automaticPhases = [
      SubPhase.ROLL_DICE,
      SubPhase.LINE_GENERATION,
      SubPhase.UPON_COMPLETION,
      SubPhase.AUTOMATIC
    ];
    
    return automaticPhases.includes(subPhase);
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
    subPhase: number
  ): {
    effectsQueued: QueuedEffect[];
    autoAdvance: boolean;
  } {
    
    const effectsQueued: QueuedEffect[] = [];
    const timestamp = Date.now();
    
    // Automatic phase - calculate all automatic effects
    if (subPhase === SubPhase.AUTOMATIC) {
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
      autoAdvance: this.isAutomaticPhase(subPhase)
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