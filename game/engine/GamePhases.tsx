// Game phases engine - Updated turn system (authoritative)
// Two interactive phases (Build, Battle) + one non-interactive resolution step
// All damage/healing resolves together at End of Turn Resolution
// Health only changes at end of turn

import { GameState, GameAction, Player } from '../types/GameTypes';
import SpeciesIntegration from './SpeciesIntegration';

// ============================================================================
// TURN STRUCTURE - Authoritative States
// ============================================================================

export enum MajorPhase {
  BUILD_PHASE = 'build_phase',
  BATTLE_PHASE = 'battle_phase',
  END_OF_TURN_RESOLUTION = 'end_of_turn_resolution',
  END_OF_GAME = 'end_of_game'
}

// Build Phase steps (ordered, simultaneous player actions)
export enum BuildPhaseStep {
  DICE_ROLL = 'dice_roll',                    // Roll shared d6 (includes dice manipulation if available)
  LINE_GENERATION = 'line_generation',        // System: Calculate available lines
  SHIPS_THAT_BUILD = 'ships_that_build',      // Player actions: Use ship building powers
  DRAWING = 'drawing',                        // Player actions: Draw ships and/or save lines
  END_OF_BUILD = 'end_of_build'               // System: Resolve non-interactive effects, check Chronoswarm
}

// Battle Phase steps (interactive, back-and-forth)
export enum BattlePhaseStep {
  FIRST_STRIKE = 'first_strike',              // System: First Strike powers resolve
  SIMULTANEOUS_DECLARATION = 'simultaneous_declaration',  // Both players simultaneously declare Charges/Solar Powers (hidden)
  CONDITIONAL_RESPONSE = 'conditional_response' // Both players simultaneously respond (hidden, only if declarations were made)
}

// ============================================================================
// READINESS & INPUT MODEL
// ============================================================================

export interface PlayerReadiness {
  playerId: string;
  isReady: boolean;
  declaredAt?: string;
  currentStep: string; // BuildPhaseStep | BattlePhaseStep
}

export interface TurnData {
  turnNumber: number;
  currentMajorPhase: MajorPhase;
  currentStep: BuildPhaseStep | BattlePhaseStep | null;
  diceRoll?: number;
  diceManipulationFinalized?: boolean;
  accumulatedDamage: { [playerId: string]: number };
  accumulatedHealing: { [playerId: string]: number };
  healthAtTurnStart: { [playerId: string]: number };
  onceOnlyAutomaticEffects: { shipId: string; effectType: string }[]; // Track once-only effects that will resolve at end of turn
  continuousAutomaticShips: string[]; // Ships that have continuous automatic effects
  chargeDeclarations: ChargeDeclaration[];
  solarPowerDeclarations: SolarPowerDeclaration[];
  // Pending declarations (hidden from opponent until both players ready)
  pendingChargeDeclarations: { [playerId: string]: ChargeDeclaration[] };
  pendingSOLARPowerDeclarations: { [playerId: string]: SolarPowerDeclaration[] };
  // Track if any declarations were made in SIMULTANEOUS_DECLARATION step
  anyDeclarationsMade?: boolean;
  chronoswarmExtraPhaseCount?: number; // How many extra build phases triggered this turn
}

export interface ChargeDeclaration {
  playerId: string;
  shipId: string;
  powerIndex: number;
  targetPlayerId?: string;
  targetShipId?: string;
  timestamp: string;
}

export interface SolarPowerDeclaration {
  playerId: string;
  powerType: string;
  energyCost: { red?: number; green?: number; blue?: number };
  targetPlayerId?: string;
  targetShipId?: string;
  cubeRepeated?: boolean; // If true, this was repeated by Cube
  timestamp: string;
}

// ============================================================================
// PHASE TRANSITION SYSTEM
// ============================================================================

export interface PhaseTransition {
  fromMajorPhase: MajorPhase;
  fromStep: BuildPhaseStep | BattlePhaseStep | null;
  toMajorPhase: MajorPhase;
  toStep: BuildPhaseStep | BattlePhaseStep | null;
  condition: (gameState: GameState) => boolean;
  onTransition?: (gameState: GameState) => GameState;
}

// ============================================================================
// GAME PHASES ENGINE
// ============================================================================

export class GamePhasesEngine {

  // ============================================================================
  // CURRENT PHASE/STEP GETTERS
  // ============================================================================

  getCurrentMajorPhase(gameState: GameState): MajorPhase {
    return (gameState.gameData?.turnData?.currentMajorPhase as MajorPhase) || MajorPhase.BUILD_PHASE;
  }

  getCurrentStep(gameState: GameState): BuildPhaseStep | BattlePhaseStep | null {
    return (gameState.gameData?.turnData?.currentStep as BuildPhaseStep | BattlePhaseStep) || BuildPhaseStep.DICE_ROLL;
  }

  // ============================================================================
  // READINESS MANAGEMENT
  // ============================================================================

  areAllPlayersReady(gameState: GameState): boolean {
    const currentStep = this.getCurrentStep(gameState);
    const playerReadiness = gameState.gameData?.phaseReadiness as PlayerReadiness[] || [];
    
    // Get players who need to confirm readiness for this step
    const playersWhoNeedToConfirm = this.getPlayersWhoNeedToConfirm(gameState, currentStep);
    
    // If no players need to confirm (automatic step), advance immediately
    if (playersWhoNeedToConfirm.length === 0) {
      return true;
    }

    // Check if all required players are ready for current step
    return playersWhoNeedToConfirm.every(playerId => {
      const playerReady = playerReadiness.find(pr => pr.playerId === playerId);
      return playerReady?.isReady && playerReady?.currentStep === currentStep;
    });
  }

  setPlayerReady(gameState: GameState, playerId: string): GameState {
    const currentStep = this.getCurrentStep(gameState);
    const currentReadiness = gameState.gameData?.phaseReadiness as PlayerReadiness[] || [];
    
    // Remove any existing readiness for this player
    const updatedReadiness = currentReadiness.filter(pr => pr.playerId !== playerId);
    
    // Add new readiness for current step
    updatedReadiness.push({
      playerId,
      isReady: true,
      currentStep: currentStep || '',
      declaredAt: new Date().toISOString()
    });

    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: updatedReadiness
      }
    };
  }

  clearPlayerReadiness(gameState: GameState): GameState {
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: []
      }
    };
  }

  // Get players who need to confirm readiness for a given step
  private getPlayersWhoNeedToConfirm(gameState: GameState, step: BuildPhaseStep | BattlePhaseStep | null): string[] {
    if (!step) return [];

    const allPlayerIds = gameState.players.map(p => p.id);

    switch (step) {
      // Build Phase steps
      case BuildPhaseStep.DICE_ROLL:
        // Automatic - no confirmation needed
        return [];

      case BuildPhaseStep.LINE_GENERATION:
        // Automatic - no confirmation needed
        return [];

      case BuildPhaseStep.SHIPS_THAT_BUILD:
        // Both players must confirm (even if they have no ships, they can pass)
        return allPlayerIds;

      case BuildPhaseStep.DRAWING:
        // Both players must confirm
        return allPlayerIds;

      case BuildPhaseStep.END_OF_BUILD:
        // Automatic - no confirmation needed
        return [];

      // Battle Phase steps
      case BattlePhaseStep.FIRST_STRIKE:
        // Automatic resolution, but may require target selection
        return this.getPlayersWithFirstStrikeChoices(gameState);

      case BattlePhaseStep.SIMULTANEOUS_DECLARATION:
        // Interactive loop - currently acting player(s)
        return this.getPlayersActiveInChargeSolarLoop(gameState);

      case BattlePhaseStep.CONDITIONAL_RESPONSE:
        // Interactive loop - currently acting player(s)
        return this.getPlayersActiveInChargeSolarLoop(gameState);

      default:
        return [];
    }
  }

  // ============================================================================
  // STEP-SPECIFIC HELPERS
  // ============================================================================

  private getPlayersWithFirstStrikeChoices(gameState: GameState): string[] {
    // If first strike requires target choices, return those players
    // Otherwise return empty array (automatic resolution)
    const playersWithChoices: string[] = [];
    
    gameState.players.forEach(player => {
      const playerShips = gameState.gameData?.ships?.[player.id] || [];
      const hasFirstStrikeChoice = playerShips.some(ship => {
        // Guardian requires choosing which enemy ship to destroy
        return ship.shipId === 'GUA' && (ship.currentCharges || 0) > 0;
      });
      
      if (hasFirstStrikeChoice) {
        playersWithChoices.push(player.id);
      }
    });

    return playersWithChoices;
  }

  private getPlayersActiveInChargeSolarLoop(gameState: GameState): string[] {
    // In charge/solar loop, return players who haven't passed yet
    // For now, return all players (they can pass)
    return gameState.players.map(p => p.id);
  }

  // ============================================================================
  // PHASE TRANSITION LOGIC
  // ============================================================================

  shouldTransitionStep(gameState: GameState): PhaseTransition | null {
    const currentMajorPhase = this.getCurrentMajorPhase(gameState);
    const currentStep = this.getCurrentStep(gameState);
    
    // Check if all players are ready first
    if (!this.areAllPlayersReady(gameState)) {
      return null;
    }

    // Build Phase transitions
    if (currentMajorPhase === MajorPhase.BUILD_PHASE) {
      return this.getNextBuildPhaseTransition(gameState, currentStep as BuildPhaseStep);
    }

    // Battle Phase transitions
    if (currentMajorPhase === MajorPhase.BATTLE_PHASE) {
      return this.getNextBattlePhaseTransition(gameState, currentStep as BattlePhaseStep);
    }

    // End of Turn Resolution transitions
    if (currentMajorPhase === MajorPhase.END_OF_TURN_RESOLUTION) {
      return this.getEndOfTurnTransition(gameState);
    }

    return null;
  }

  private getNextBuildPhaseTransition(gameState: GameState, currentStep: BuildPhaseStep): PhaseTransition | null {
    switch (currentStep) {
      case BuildPhaseStep.DICE_ROLL:
        return {
          fromMajorPhase: MajorPhase.BUILD_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.BUILD_PHASE,
          toStep: BuildPhaseStep.LINE_GENERATION,
          condition: () => true,
          onTransition: (state) => this.clearPlayerReadiness(state)
        };

      case BuildPhaseStep.LINE_GENERATION:
        return {
          fromMajorPhase: MajorPhase.BUILD_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.BUILD_PHASE,
          toStep: BuildPhaseStep.SHIPS_THAT_BUILD,
          condition: () => true,
          onTransition: (state) => this.clearPlayerReadiness(state)
        };

      case BuildPhaseStep.SHIPS_THAT_BUILD:
        return {
          fromMajorPhase: MajorPhase.BUILD_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.BUILD_PHASE,
          toStep: BuildPhaseStep.DRAWING,
          condition: () => true,
          onTransition: (state) => this.clearPlayerReadiness(state)
        };

      case BuildPhaseStep.DRAWING:
        return {
          fromMajorPhase: MajorPhase.BUILD_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.BUILD_PHASE,
          toStep: BuildPhaseStep.END_OF_BUILD,
          condition: () => true,
          onTransition: (state) => this.clearPlayerReadiness(state)
        };

      case BuildPhaseStep.END_OF_BUILD:
        // Check if Chronoswarm triggers extra build phase
        if (this.shouldTriggerChronoswarmExtraPhase(gameState)) {
          return {
            fromMajorPhase: MajorPhase.BUILD_PHASE,
            fromStep: currentStep,
            toMajorPhase: MajorPhase.BUILD_PHASE,
            toStep: BuildPhaseStep.DICE_ROLL,
            condition: () => true,
            onTransition: (state) => this.setupChronoswarmExtraPhase(state)
          };
        }
        // Transition to Battle Phase
        return {
          fromMajorPhase: MajorPhase.BUILD_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.BATTLE_PHASE,
          toStep: BattlePhaseStep.FIRST_STRIKE,
          condition: () => true,
          onTransition: (state) => this.clearPlayerReadiness(state)
        };

      default:
        return null;
    }
  }

  private getNextBattlePhaseTransition(gameState: GameState, currentStep: BattlePhaseStep): PhaseTransition | null {
    switch (currentStep) {
      case BattlePhaseStep.FIRST_STRIKE:
        return {
          fromMajorPhase: MajorPhase.BATTLE_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.BATTLE_PHASE,
          toStep: BattlePhaseStep.SIMULTANEOUS_DECLARATION,
          condition: () => true,
          onTransition: (state) => this.clearPlayerReadiness(state)
        };

      case BattlePhaseStep.SIMULTANEOUS_DECLARATION:
        // Both players ready → Reveal declarations → Check if any were made
        const turnData = gameState.gameData?.turnData;
        const anyDeclarationsMade = this.checkIfAnyDeclarationsMade(gameState);
        
        if (!anyDeclarationsMade) {
          // No declarations made → Skip directly to End of Turn Resolution
          return {
            fromMajorPhase: MajorPhase.BATTLE_PHASE,
            fromStep: currentStep,
            toMajorPhase: MajorPhase.END_OF_TURN_RESOLUTION,
            toStep: null,
            condition: () => true,
            onTransition: (state) => this.revealDeclarationsAndResolve(state)
          };
        } else {
          // Declarations were made → Move to Conditional Response
          return {
            fromMajorPhase: MajorPhase.BATTLE_PHASE,
            fromStep: currentStep,
            toMajorPhase: MajorPhase.BATTLE_PHASE,
            toStep: BattlePhaseStep.CONDITIONAL_RESPONSE,
            condition: () => true,
            onTransition: (state) => this.revealDeclarationsAndPrepareResponse(state)
          };
        }

      case BattlePhaseStep.CONDITIONAL_RESPONSE:
        // Both players ready → Reveal responses → Move to End of Turn Resolution
        return {
          fromMajorPhase: MajorPhase.BATTLE_PHASE,
          fromStep: currentStep,
          toMajorPhase: MajorPhase.END_OF_TURN_RESOLUTION,
          toStep: null,
          condition: () => true,
          onTransition: (state) => this.revealDeclarationsAndResolve(state)
        };

      default:
        return null;
    }
  }

  private getEndOfTurnTransition(gameState: GameState): PhaseTransition | null {
    // Check if game should end
    if (this.shouldEndGame(gameState)) {
      return {
        fromMajorPhase: MajorPhase.END_OF_TURN_RESOLUTION,
        fromStep: null,
        toMajorPhase: MajorPhase.END_OF_GAME,
        toStep: null,
        condition: () => true,
        onTransition: (state) => this.determineVictoryType(state)
      };
    }

    // Start new turn
    return {
      fromMajorPhase: MajorPhase.END_OF_TURN_RESOLUTION,
      fromStep: null,
      toMajorPhase: MajorPhase.BUILD_PHASE,
      toStep: BuildPhaseStep.DICE_ROLL,
      condition: () => true,
      onTransition: (state) => this.startNewTurn(state)
    };
  }

  transitionToStep(gameState: GameState, transition: PhaseTransition): GameState {
    let newGameState = {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...gameState.gameData?.turnData,
          currentMajorPhase: transition.toMajorPhase,
          currentStep: transition.toStep
        },
        phaseStartTime: new Date().toISOString()
      }
    };

    // Apply transition-specific changes
    if (transition.onTransition) {
      newGameState = transition.onTransition(newGameState);
    }

    return newGameState;
  }

  // ============================================================================
  // CHRONOSWARM EXTRA PHASE LOGIC
  // ============================================================================

  private shouldTriggerChronoswarmExtraPhase(gameState: GameState): boolean {
    // Check if any player has Chronoswarm and hasn't used it this turn yet
    const turnData = gameState.gameData?.turnData;
    const extraPhaseCount = turnData?.chronoswarmExtraPhaseCount || 0;

    // Chronoswarm can only trigger once per turn (or more based on count)
    // Check if any player has Chronoswarm ships
    const hasChronoswarm = gameState.players.some(player => {
      const playerShips = gameState.gameData?.ships?.[player.id] || [];
      return playerShips.some(ship => ship.shipId === 'CHR' && !ship.isDestroyed);
    });

    // Only trigger if Chronoswarm exists and hasn't been used yet this turn
    return hasChronoswarm && extraPhaseCount === 0;
  }

  private setupChronoswarmExtraPhase(gameState: GameState): GameState {
    const turnData = gameState.gameData?.turnData;
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          chronoswarmExtraPhaseCount: (turnData?.chronoswarmExtraPhaseCount || 0) + 1
        }
      }
    };
  }

  // ============================================================================
  // CHARGE/SOLAR LOOP LOGIC
  // ============================================================================

  private haveBothPlayersPassedChargeSolarLoop(gameState: GameState): boolean {
    // Check if both players have explicitly passed
    // For now, this will be based on player readiness
    const playerReadiness = gameState.gameData?.phaseReadiness as PlayerReadiness[] || [];
    const allPlayerIds = gameState.players.map(p => p.id);

    return allPlayerIds.every(playerId => {
      const playerReady = playerReadiness.find(pr => pr.playerId === playerId);
      return playerReady?.isReady && playerReady?.currentStep === BattlePhaseStep.INTERACTION_LOOP;
    });
  }

  private checkIfAnyDeclarationsMade(gameState: GameState): boolean {
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return false;

    // Check if any charge or solar power declarations were made
    return turnData.anyDeclarationsMade || false;
  }

  private revealDeclarationsAndPrepareResponse(gameState: GameState): GameState {
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return gameState;

    // Reveal declarations to both players
    const chargeDeclarations = turnData.pendingChargeDeclarations;
    const solarPowerDeclarations = turnData.pendingSOLARPowerDeclarations;

    // Merge pending declarations into main declarations
    const updatedChargeDeclarations: ChargeDeclaration[] = [];
    const updatedSolarPowerDeclarations: SolarPowerDeclaration[] = [];

    for (const playerId in chargeDeclarations) {
      updatedChargeDeclarations.push(...chargeDeclarations[playerId]);
    }

    for (const playerId in solarPowerDeclarations) {
      updatedSolarPowerDeclarations.push(...solarPowerDeclarations[playerId]);
    }

    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          chargeDeclarations: updatedChargeDeclarations,
          solarPowerDeclarations: updatedSolarPowerDeclarations,
          anyDeclarationsMade: true
        }
      }
    };
  }

  private revealDeclarationsAndResolve(gameState: GameState): GameState {
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return gameState;

    // Reveal declarations to both players
    const chargeDeclarations = turnData.pendingChargeDeclarations;
    const solarPowerDeclarations = turnData.pendingSOLARPowerDeclarations;

    // Merge pending declarations into main declarations
    const updatedChargeDeclarations: ChargeDeclaration[] = [];
    const updatedSolarPowerDeclarations: SolarPowerDeclaration[] = [];

    for (const playerId in chargeDeclarations) {
      updatedChargeDeclarations.push(...chargeDeclarations[playerId]);
    }

    for (const playerId in solarPowerDeclarations) {
      updatedSolarPowerDeclarations.push(...solarPowerDeclarations[playerId]);
    }

    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          chargeDeclarations: updatedChargeDeclarations,
          solarPowerDeclarations: updatedSolarPowerDeclarations,
          anyDeclarationsMade: true
        }
      }
    };
  }

  // ============================================================================
  // END OF TURN RESOLUTION
  // ============================================================================

  private resolveEndOfTurn(gameState: GameState): GameState {
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return gameState;

    const players = gameState.players;
    
    // Calculate all damage and healing (from all sources)
    const updatedPlayers = players.map(player => {
      // Accumulated damage from charge/solar powers
      const accumulatedDamage = turnData.accumulatedDamage[player.id] || 0;
      const accumulatedHealing = turnData.accumulatedHealing[player.id] || 0;
      
      // Damage from automatic ship powers (continuous)
      const continuousAutomaticDamage = this.calculateContinuousAutomaticDamage(gameState, player.id);
      
      // Healing from automatic ship powers (continuous)
      const continuousAutomaticHealing = this.calculateContinuousAutomaticHealing(gameState, player.id);
      
      // Once-only automatic damage (from ships built this turn)
      const onceOnlyDamage = this.calculateOnceOnlyAutomaticDamage(gameState, player.id);
      
      // Once-only automatic healing (from ships built this turn)
      const onceOnlyHealing = this.calculateOnceOnlyAutomaticHealing(gameState, player.id);
      
      const currentHealth = player.health || 100; // Default starting health
      
      // Apply all damage and healing sources simultaneously
      const totalDamage = accumulatedDamage + continuousAutomaticDamage + onceOnlyDamage;
      const totalHealing = accumulatedHealing + continuousAutomaticHealing + onceOnlyHealing;
      
      let newHealth = currentHealth - totalDamage + totalHealing;
      
      // Cap at maximum health (100 for Standard Game, or customizable)
      const maxHealth = gameState.settings.maxHealth || 100;
      newHealth = Math.min(newHealth, maxHealth);
      
      return {
        ...player,
        health: newHealth
      };
    });

    return {
      ...gameState,
      players: updatedPlayers,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          // Clear accumulated damage/healing after resolution
          accumulatedDamage: {},
          accumulatedHealing: {},
          // Clear once-only effects after resolution
          onceOnlyAutomaticEffects: []
        }
      }
    };
  }

  private calculateContinuousAutomaticDamage(gameState: GameState, targetPlayerId: string): number {
    // Calculate damage from all opponent's continuous automatic ship powers
    let totalDamage = 0;
    
    gameState.players.forEach(player => {
      if (player.id === targetPlayerId) return; // Don't damage yourself
      
      const playerShips = gameState.gameData?.ships?.[player.id] || [];
      playerShips.forEach(ship => {
        if (ship.isDestroyed) return; // Destroyed ships don't contribute
        
        // Calculate damage from this ship's automatic powers
        const shipDamage = SpeciesIntegration.calculateShipAutomaticDamage(gameState, ship);
        totalDamage += shipDamage;
      });
    });
    
    return totalDamage;
  }

  private calculateContinuousAutomaticHealing(gameState: GameState, playerId: string): number {
    // Calculate healing from player's own continuous automatic ship powers
    let totalHealing = 0;
    
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    playerShips.forEach(ship => {
      if (ship.isDestroyed) return; // Destroyed ships don't contribute
      
      // Calculate healing from this ship's automatic powers
      const shipHealing = SpeciesIntegration.calculateShipAutomaticHealing(gameState, ship);
      totalHealing += shipHealing;
    });
    
    return totalHealing;
  }

  private calculateOnceOnlyAutomaticDamage(gameState: GameState, targetPlayerId: string): number {
    // Calculate damage from once-only automatic effects (ships built this turn)
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return 0;
    
    let totalDamage = 0;
    
    turnData.onceOnlyAutomaticEffects.forEach(effect => {
      if (effect.effectType !== 'damage') return;
      
      // Find the ship and calculate damage
      const ship = this.findShipById(gameState, effect.shipId);
      if (!ship || ship.ownerId === targetPlayerId) return; // Don't damage yourself
      
      const shipDamage = SpeciesIntegration.calculateShipOnceOnlyDamage(gameState, ship);
      totalDamage += shipDamage;
    });
    
    return totalDamage;
  }

  private calculateOnceOnlyAutomaticHealing(gameState: GameState, playerId: string): number {
    // Calculate healing from once-only automatic effects (ships built this turn)
    const turnData = gameState.gameData?.turnData;
    if (!turnData) return 0;
    
    let totalHealing = 0;
    
    turnData.onceOnlyAutomaticEffects.forEach(effect => {
      if (effect.effectType !== 'healing') return;
      
      // Find the ship and calculate healing
      const ship = this.findShipById(gameState, effect.shipId);
      if (!ship || ship.ownerId !== playerId) return; // Only heal yourself
      
      const shipHealing = SpeciesIntegration.calculateShipOnceOnlyHealing(gameState, ship);
      totalHealing += shipHealing;
    });
    
    return totalHealing;
  }

  private findShipById(gameState: GameState, shipId: string): any {
    for (const playerId in gameState.gameData?.ships) {
      const ship = gameState.gameData.ships[playerId].find(s => s.id === shipId);
      if (ship) return ship;
    }
    return null;
  }

  // ============================================================================
  // GAME END LOGIC
  // ============================================================================

  private shouldEndGame(gameState: GameState): boolean {
    const players = gameState.players;
    
    // Check if any player has 0 or below health
    return players.some(player => (player.health || 100) <= 0);
  }

  private determineVictoryType(gameState: GameState): GameState {
    const players = gameState.players;
    const playersAtZeroOrBelow = players.filter(p => (p.health || 100) <= 0);
    
    let victoryType = '';
    let winner = null;
    
    if (playersAtZeroOrBelow.length === 0) {
      // No one at 0, shouldn't happen but handle gracefully
      return gameState;
    } else if (playersAtZeroOrBelow.length === 1) {
      // One player at 0 or below, other player wins decisively
      winner = players.find(p => (p.health || 100) > 0);
      victoryType = 'Decisive Victory';
    } else if (playersAtZeroOrBelow.length === players.length) {
      // All players at 0 or below
      const healthValues = playersAtZeroOrBelow.map(p => p.health || 100);
      const minHealth = Math.min(...healthValues);
      const playersAtMinHealth = playersAtZeroOrBelow.filter(p => (p.health || 100) === minHealth);
      
      if (playersAtMinHealth.length === playersAtZeroOrBelow.length) {
        // All at same health - draw
        victoryType = 'Draw';
      } else {
        // One player lower than others - narrow victory for higher health player
        winner = playersAtZeroOrBelow.find(p => (p.health || 100) > minHealth);
        victoryType = 'Narrow Victory';
      }
    }

    return {
      ...gameState,
      winner,
      gameData: {
        ...gameState.gameData,
        victoryType
      }
    };
  }

  // ============================================================================
  // TURN INITIALIZATION
  // ============================================================================

  private startNewTurn(gameState: GameState): GameState {
    const turnNumber = (gameState.gameData?.turnData?.turnNumber || 0) + 1;
    
    // Store health at start of turn for ships that check this
    const healthAtTurnStart: { [playerId: string]: number } = {};
    gameState.players.forEach(player => {
      healthAtTurnStart[player.id] = player.health || 100;
    });

    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        phaseReadiness: [], // Clear readiness for new turn
        turnData: {
          turnNumber,
          currentMajorPhase: MajorPhase.BUILD_PHASE,
          currentStep: BuildPhaseStep.DICE_ROLL,
          accumulatedDamage: {},
          accumulatedHealing: {},
          healthAtTurnStart,
          onceOnlyAutomaticEffects: [],
          continuousAutomaticShips: [],
          chargeDeclarations: [],
          solarPowerDeclarations: [],
          // Initialize pending declarations
          pendingChargeDeclarations: {},
          pendingSOLARPowerDeclarations: {},
          anyDeclarationsMade: false
        }
      }
    };
  }

  // ============================================================================
  // VALID ACTIONS
  // ============================================================================

  getValidActionsForStep(step: BuildPhaseStep | BattlePhaseStep | null, playerId: string, gameState: GameState): string[] {
    if (!step) return [];

    switch (step) {
      // Build Phase steps
      case BuildPhaseStep.DICE_ROLL:
        return []; // Automatic

      case BuildPhaseStep.LINE_GENERATION:
        return []; // Automatic

      case BuildPhaseStep.SHIPS_THAT_BUILD:
        return ['use_ship_building_power', 'declare_ready'];

      case BuildPhaseStep.DRAWING:
        return ['build_ship', 'upgrade_ship', 'save_lines', 'use_drawing_phase_power', 'declare_ready'];

      case BuildPhaseStep.END_OF_BUILD:
        return []; // Automatic

      // Battle Phase steps
      case BattlePhaseStep.FIRST_STRIKE:
        return ['use_first_strike_power', 'select_target']; // May need target selection

      case BattlePhaseStep.SIMULTANEOUS_DECLARATION:
        return ['declare_charge', 'use_solar_power', 'pass'];

      case BattlePhaseStep.CONDITIONAL_RESPONSE:
        return ['declare_charge', 'use_solar_power', 'pass'];

      default:
        return [];
    }
  }

  isActionValidForStep(action: GameAction, gameState: GameState): boolean {
    const currentStep = this.getCurrentStep(gameState);
    const validActions = this.getValidActionsForStep(currentStep, action.playerId, gameState);
    return validActions.includes(action.type);
  }
}