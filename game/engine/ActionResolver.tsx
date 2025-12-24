// Action Resolution Layer
// Manages player actions within phases using the correct 3-phase model
// Pure functions - no React dependencies

import { MajorPhase, BuildPhaseStep, BattlePhaseStep } from './GamePhases';
import SpeciesIntegration from './SpeciesIntegration';
import { getShipById } from '../data/ShipDefinitions';

/**
 * 🔒 CRITICAL CONSTRAINTS (ENFORCED BY THIS CLASS):
 * 
 * 1. There are exactly THREE turn stages: Build Phase, Battle Phase, End of Turn Resolution
 * 2. AUTOMATIC is NOT a phase - it means "non-interactive"
 * 3. All damage and healing resolve ONLY during End of Turn Resolution
 * 4. Health never changes mid-turn
 * 5. Battle Phase uses simultaneous hidden commitments (not sequential actions)
 * 6. Battle Phase has exactly TWO windows max: Declaration + Response (conditional)
 * 7. Once-only effects trigger earlier but resolve at End of Turn Resolution
 * 8. Continuous effects only apply if ship survives to End of Turn Resolution
 */

/**
 * ActionResolver - Core logic for managing player actions
 * 
 * Responsibilities:
 * 1. Calculate what actions are available for each player in current step
 * 2. Validate and process player action choices
 * 3. Manage Battle Phase commitment state (hidden until both ready)
 * 4. Queue triggered effects for End of Turn Resolution
 * 5. Determine when a step can advance (both players ready)
 */
export class ActionResolver {
  
  /**
   * Calculate action state for current phase step
   * Returns what each player needs to do right now
   */
  calculatePhaseActions(
    gameState: GameState,
    currentMajorPhase: MajorPhase,
    currentStep: BuildPhaseStep | BattlePhaseStep | null
  ): PhaseActionState {
    
    const playerStates: { [playerId: string]: PlayerActionState } = {};
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    
    // Get phase readiness
    const phaseReadiness = (gameState.gameData?.phaseReadiness as any[]) || [];
    
    for (const player of activePlayers) {
      const isReady = phaseReadiness.some(
        pr => pr.playerId === player.id && pr.isReady && pr.currentStep === currentStep
      );
      
      // For now, no pending actions (will be implemented when ship powers defined)
      const pendingActions: PendingAction[] = [];
      
      playerStates[player.id] = {
        playerId: player.id,
        status: isReady ? 'READY' : (pendingActions.length > 0 ? 'AWAITING_OPTIONAL' : 'READY'),
        pendingActions,
        completedActions: [],
        canDeclareReady: !isReady,
        mustResolveFirst: []
      };
    }
    
    // Determine if phase can advance
    const allReady = Object.values(playerStates).every(ps => ps.status === 'READY');
    
    // Check if this is a system-driven step (NOTE: Not related to "Automatic" ship powers)
    const isSystemDriven = this.isSystemDrivenStep(currentMajorPhase, currentStep);
    
    return {
      phase: `${currentMajorPhase}:${currentStep || 'RESOLUTION'}`,
      playerStates,
      canAdvancePhase: allReady,
      blockingReason: allReady ? undefined : 'Waiting for players',
      phaseMetadata: {
        isSystemDrivenStep: isSystemDriven,
        acceptsPlayerInput: !isSystemDriven
      }
    };
  }
  
  /**
   * Check if current step is system-driven (no player input required)
   * 
   * NOTE: This means "system-driven step", NOT "Automatic ship powers"
   * - System-driven: Dice Roll, Line Generation, End of Build, First Strike
   * - Automatic powers: Ship powers with timing="Continuous" (unrelated to step type)
   */
  private isSystemDrivenStep(
    majorPhase: MajorPhase,
    step: BuildPhaseStep | BattlePhaseStep | null
  ): boolean {
    
    if (majorPhase === MajorPhase.BUILD_PHASE) {
      return step === BuildPhaseStep.DICE_ROLL ||
             step === BuildPhaseStep.LINE_GENERATION ||
             step === BuildPhaseStep.END_OF_BUILD;
    }
    
    if (majorPhase === MajorPhase.BATTLE_PHASE) {
      return step === BattlePhaseStep.FIRST_STRIKE;
    }
    
    if (majorPhase === MajorPhase.END_OF_TURN_RESOLUTION) {
      return true; // Entire phase is system-driven
    }
    
    return false;
  }
  
  /**
   * Process Battle Phase commitment
   * 
   * This handles the simultaneous hidden declaration model:
   * 1. Players submit hidden actions (charges, solar powers)
   * 2. When both ready, reveal simultaneously
   * 3. Create triggered effects for End of Turn Resolution
   */
  processBattleCommitment(
    gameState: GameState,
    playerId: string,
    actions: HiddenBattleActions,
    window: 'declaration' | 'response'
  ): {
    success: boolean;
    error?: string;
    triggeredEffects: TriggeredEffect[];
  } {
    
    const triggeredEffects: TriggeredEffect[] = [];
    const timestamp = new Date().toISOString();
    
    // Process charge declarations
    for (const charge of actions.charges) {
      // Find the ship
      const ship = this.findPlayerShip(gameState, playerId, charge.shipId);
      if (!ship) {
        return {
          success: false,
          error: `Ship ${charge.shipId} not found`,
          triggeredEffects: []
        };
      }
      
      // Get ship data
      const shipData = SpeciesIntegration.getShipData(ship);
      if (!shipData) {
        return {
          success: false,
          error: `Ship data not found for ${charge.shipId}`,
          triggeredEffects: []
        };
      }
      
      // Validate power index
      const powers = shipData.powers || [];
      const chargePowers = powers.filter(p => p.cost?.charges && p.cost.charges > 0);
      
      if (charge.powerIndex >= chargePowers.length) {
        return {
          success: false,
          error: `Invalid power index ${charge.powerIndex}`,
          triggeredEffects: []
        };
      }
      
      const power = chargePowers[charge.powerIndex];
      
      // Check charges available
      if ((ship.currentCharges || 0) < (power.cost?.charges || 0)) {
        return {
          success: false,
          error: `Not enough charges on ${charge.shipId}`,
          triggeredEffects: []
        };
      }
      
      // Create triggered effect
      const effect = this.parsePowerEffect(power.description);
      const targetPlayerId = effect.effectType === 'DAMAGE'
        ? this.getOpponentId(gameState, playerId)
        : playerId;
      
      triggeredEffects.push({
        id: `charge-${ship.id}-${timestamp}-${triggeredEffects.length}`,
        sourceShipId: ship.id,
        sourcePlayerId: playerId,
        targetPlayerId,
        effectType: effect.effectType,
        value: effect.value,
        persistsIfSourceDestroyed: true, // Charges always resolve
        description: `${shipData.name}: ${power.description}`,
        triggeredAt: timestamp
      });
    }
    
    // Process Solar Power declarations
    for (const solar of actions.solarPowers) {
      // TODO: Implement Solar Power effect creation
      // For now, just acknowledge
      console.log(`Solar Power declared: ${solar.powerType}`);
    }
    
    return {
      success: true,
      triggeredEffects
    };
  }
  
  /**
   * Initialize Battle Commitment State for a new Battle Phase
   */
  initializeBattleCommitments(): BattleCommitmentState {
    return {
      declaration: undefined,
      response: undefined,
      declarationRevealed: false,
      responseRevealed: false,
      anyDeclarationsMade: false
    };
  }
  
  /**
   * Submit hidden Battle Phase actions for a player
   */
  submitBattleActions(
    commitmentState: BattleCommitmentState,
    playerId: string,
    actions: HiddenBattleActions,
    window: 'declaration' | 'response'
  ): BattleCommitmentState {
    
    const updated = { ...commitmentState };
    
    if (window === 'declaration') {
      updated.declaration = {
        ...updated.declaration,
        [playerId]: actions
      };
      
      // Check if any actions were declared
      if (actions.charges.length > 0 || actions.solarPowers.length > 0) {
        updated.anyDeclarationsMade = true;
      }
    } else {
      updated.response = {
        ...updated.response,
        [playerId]: actions
      };
    }
    
    return updated;
  }
  
  /**
   * Reveal Battle Phase actions
   * Called when both players are ready
   */
  revealBattleActions(
    commitmentState: BattleCommitmentState,
    window: 'declaration' | 'response'
  ): BattleCommitmentState {
    
    const updated = { ...commitmentState };
    
    if (window === 'declaration') {
      updated.declarationRevealed = true;
    } else {
      updated.responseRevealed = true;
    }
    
    return updated;
  }
  
  /**
   * Check if both players have submitted actions for current window
   */
  areBothPlayersReady(
    gameState: GameState,
    commitmentState: BattleCommitmentState,
    window: 'declaration' | 'response'
  ): boolean {
    
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    const actionsMap = window === 'declaration' 
      ? commitmentState.declaration 
      : commitmentState.response;
    
    if (!actionsMap) return false;
    
    return activePlayers.every(p => actionsMap[p.id] !== undefined);
  }
  
  /**
   * Resolve Build Phase action (ship building, etc.)
   * Creates triggered effects for once-only ship completion effects
   */
  resolveBuildAction(
    gameState: GameState,
    playerId: string,
    actionType: 'BUILD_SHIP' | 'TRANSFORM_SHIP',
    shipId: string
  ): {
    success: boolean;
    error?: string;
    triggeredEffects: TriggeredEffect[];
  } {
    
    const triggeredEffects: TriggeredEffect[] = [];
    const timestamp = new Date().toISOString();
    
    if (actionType === 'BUILD_SHIP') {
      // Get ship data
      const shipData = getShipById(shipId);
      if (!shipData) {
        return {
          success: false,
          error: `Ship ${shipId} not found`,
          triggeredEffects: []
        };
      }
    }
    
    return {
      success: true,
      triggeredEffects
    };
  }
  
  /**
   * Helper: Find player's ship
   */
  private findPlayerShip(
    gameState: GameState,
    playerId: string,
    shipId: string
  ): PlayerShip | undefined {
    const ships = gameState.gameData?.ships?.[playerId] || [];
    return ships.find(s => s.shipId === shipId || s.id === shipId);
  }
  
  /**
   * Helper: Get opponent ID
   */
  private getOpponentId(gameState: GameState, playerId: string): string {
    const activePlayers = gameState.players.filter(p => p.role === 'player');
    const opponent = activePlayers.find(p => p.id !== playerId);
    return opponent?.id || playerId;
  }
  
  /**
   * Helper: Parse power description to extract effect
   * TODO: Replace with proper power data structure
   */
  private parsePowerEffect(description: string): {
    effectType: 'DAMAGE' | 'HEAL';
    value: number;
  } {
    // Simple parser - replace with real implementation
    const damageMatch = description.match(/(\d+)\s*damage/i);
    if (damageMatch) {
      return {
        effectType: 'DAMAGE',
        value: parseInt(damageMatch[1])
      };
    }
    
    const healMatch = description.match(/(\d+)\s*heal/i);
    if (healMatch) {
      return {
        effectType: 'HEAL',
        value: parseInt(healMatch[1])
      };
    }
    
    return {
      effectType: 'DAMAGE',
      value: 0
    };
  }
}

// Export singleton instance
export const actionResolver = new ActionResolver();