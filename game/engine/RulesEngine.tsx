// Rules engine - Shapeships action validation and coordination
// 
// ARCHITECTURE:
// - GamePhasesEngine: Owns WHEN things can happen
// - RulesEngine (this file): Owns WHETHER an action is legal, records player intent
// - PowerExecutor: Owns WHAT powers do
// - EndOfTurnResolver: Owns WHAT actually happens
//
// THIS ENGINE:
// ✅ Validates actions are allowed in current step
// ✅ Validates player has required ship/power/charges
// ✅ Stores declarations in turnData.pending*
// ✅ Triggers phase transitions via readiness
//
// THIS ENGINE DOES NOT:
// ❌ Decide winners (EndOfTurnResolver)
// ❌ Apply damage (EndOfTurnResolver)
// ❌ Manage turn order (GamePhasesEngine)

import { GameState, GameAction, Player, GameRules } from '../types/GameTypes';
import { GamePhasesEngine, MajorPhase, BuildPhaseStep, BattlePhaseStep } from './GamePhases';
import { getShipById } from '../data/ShipDefinitions.engine';

export class ShapeshipsRulesEngine implements GameRules {
  
  private phasesEngine: GamePhasesEngine;
  
  constructor() {
    this.phasesEngine = new GamePhasesEngine();
  }
  
  // ============================================================================
  // ACTION VALIDATION
  // ============================================================================
  
  validateAction(action: GameAction, gameState: GameState): boolean {
    // Game must be active
    if (gameState.status !== 'active') {
      return false;
    }

    // Check if action is valid for current step
    if (!this.phasesEngine.isActionValidForStep(action, gameState)) {
      return false;
    }

    // Action-specific validation
    switch (action.type) {
      case 'build_ship':
        return this.validateBuildShip(action, gameState);
      
      case 'upgrade_ship':
        return this.validateUpgradeShip(action, gameState);
      
      case 'save_lines':
        return this.validateSaveLines(action, gameState);
      
      case 'use_ship_building_power':
        return this.validateShipBuildingPower(action, gameState);
      
      case 'use_drawing_phase_power':
        return this.validateDrawingPhasePower(action, gameState);
      
      case 'use_first_strike_power':
        return this.validateFirstStrikePower(action, gameState);
      
      case 'declare_charge':
        return this.validateDeclareCharge(action, gameState);
      
      case 'use_solar_power':
        return this.validateUseSolarPower(action, gameState);
      
      case 'pass':
        return true; // Always allow passing
      
      case 'declare_ready':
        return true; // Always allow declaring ready
      
      case 'surrender':
        return true; // Always allow surrender
      
      default:
        console.warn(`Unknown action type: ${action.type}`);
        return false;
    }
  }

  // ============================================================================
  // ACTION APPLICATION
  // ============================================================================
  
  applyAction(action: GameAction, gameState: GameState): GameState {
    let newGameState = { ...gameState };

    switch (action.type) {
      case 'build_ship':
        newGameState = this.applyBuildShip(action, newGameState);
        break;
      
      case 'upgrade_ship':
        newGameState = this.applyUpgradeShip(action, newGameState);
        break;
      
      case 'save_lines':
        newGameState = this.applySaveLines(action, newGameState);
        break;
      
      case 'use_ship_building_power':
        newGameState = this.applyShipBuildingPower(action, newGameState);
        break;
      
      case 'use_drawing_phase_power':
        newGameState = this.applyDrawingPhasePower(action, newGameState);
        break;
      
      case 'use_first_strike_power':
        newGameState = this.applyFirstStrikePower(action, newGameState);
        break;
      
      case 'declare_charge':
        newGameState = this.applyDeclareCharge(action, newGameState);
        break;
      
      case 'use_solar_power':
        newGameState = this.applyUseSolarPower(action, newGameState);
        break;
      
      case 'pass':
        newGameState = this.applyPass(action, newGameState);
        break;
      
      case 'declare_ready':
        newGameState = this.applyDeclareReady(action, newGameState);
        break;
      
      case 'surrender':
        newGameState = this.applySurrender(action, newGameState);
        break;
    }

    // Check for phase transitions after applying action
    const phaseTransition = this.phasesEngine.shouldTransitionStep(newGameState);
    if (phaseTransition) {
      newGameState = this.phasesEngine.transitionToStep(newGameState, phaseTransition);
    }

    return newGameState;
  }

  // ============================================================================
  // WIN CONDITION (DELEGATED)
  // ============================================================================
  
  checkWinCondition(gameState: GameState): Player | null {
    // ⚠️ ARCHITECTURAL NOTE:
    // Win/loss determination is handled EXCLUSIVELY by EndOfTurnResolver.
    // This method exists to satisfy the GameRules interface but should NOT
    // be used for actual win condition checking.
    // 
    // The correct flow is:
    // 1. EndOfTurnResolver resolves damage/healing
    // 2. EndOfTurnResolver checks health <= 0
    // 3. EndOfTurnResolver sets gameState.winner
    // 4. GameEngine reads gameState.winner (not this method)
    
    // Return already-determined winner (if set by EndOfTurnResolver)
    return gameState.winner || null;
  }

  // ============================================================================
  // VALID MOVES (DECLARATIVE)
  // ============================================================================
  
  getValidMoves(playerId: string, gameState: GameState): GameAction[] {
    // ⚠️ NOTE: This returns action TYPE hints, not concrete actions.
    // UI constructs the full action payload with targets/parameters,
    // then RulesEngine validates it.
    
    const validMoves: GameAction[] = [];
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    const validActionTypes = this.phasesEngine.getValidActionsForStep(currentStep, playerId, gameState);
    
    // Return declarative action types (UI will fill in details)
    for (const actionType of validActionTypes) {
      switch (actionType) {
        case 'declare_ready':
          validMoves.push({
            id: `template_${actionType}`,
            playerId,
            type: actionType,
            data: {},
            timestamp: ''
          });
          break;
        
        case 'build_ship':
        case 'upgrade_ship':
        case 'save_lines':
        case 'use_ship_building_power':
        case 'use_drawing_phase_power':
        case 'use_first_strike_power':
        case 'declare_charge':
        case 'use_solar_power':
        case 'pass':
          validMoves.push({
            id: `template_${actionType}`,
            playerId,
            type: actionType,
            data: {}, // UI will populate with ship IDs, targets, etc.
            timestamp: ''
          });
          break;
      }
    }
    
    return validMoves;
  }

  // ============================================================================
  // BUILD PHASE VALIDATIONS
  // ============================================================================
  
  private validateBuildShip(action: GameAction, gameState: GameState): boolean {
    // Validate during DRAWING step
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BuildPhaseStep.DRAWING) return false;
    
    const { shipId, cost } = action.data || {};
    if (!shipId) return false;
    
    // Check if player has enough lines
    const player = gameState.players.find(p => p.id === action.playerId);
    if (!player) return false;
    
    const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
    if (availableLines < (cost || 0)) return false;
    
    return true;
  }
  
  private validateUpgradeShip(action: GameAction, gameState: GameState): boolean {
    // Validate during DRAWING step
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BuildPhaseStep.DRAWING) return false;
    
    const { shipId, upgradeCost } = action.data || {};
    if (!shipId) return false;
    
    // Check if ship exists and is owned by player
    const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
    const ship = playerShips.find(s => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;
    
    // Check if player has enough lines
    const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
    if (availableLines < (upgradeCost || 0)) return false;
    
    return true;
  }
  
  private validateSaveLines(action: GameAction, gameState: GameState): boolean {
    // Validate during DRAWING step
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BuildPhaseStep.DRAWING) return false;
    
    const { linesToSave } = action.data || {};
    if (typeof linesToSave !== 'number' || linesToSave < 0) return false;
    
    // Check if player has that many lines available
    const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
    if (linesToSave > availableLines) return false;
    
    return true;
  }
  
  private validateShipBuildingPower(action: GameAction, gameState: GameState): boolean {
    // Validate during SHIPS_THAT_BUILD step
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BuildPhaseStep.SHIPS_THAT_BUILD) return false;
    
    const { shipId, powerIndex } = action.data || {};
    if (!shipId) return false;
    
    // Check if ship exists, is owned by player, and has building powers
    const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
    const ship = playerShips.find(s => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;
    
    // Validate ship has building phase powers
    const shipDef = getShipById(ship.shipId);
    if (!shipDef) return false;
    
    // Check if power exists and is a building phase power
    const buildingPowers = shipDef.powers.filter(p => p.phase === 'build_phase');
    if (!buildingPowers[powerIndex || 0]) return false;
    
    return true;
  }
  
  private validateDrawingPhasePower(action: GameAction, gameState: GameState): boolean {
    // Validate during DRAWING step
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BuildPhaseStep.DRAWING) return false;
    
    const { shipId, powerIndex } = action.data || {};
    if (!shipId) return false;
    
    // Check if ship exists and has drawing phase powers
    const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
    const ship = playerShips.find(s => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;
    
    // Validate ship has drawing phase powers
    const shipDef = getShipById(ship.shipId);
    if (!shipDef) return false;
    
    // Check if power exists and is a drawing phase power
    const drawingPowers = shipDef.powers.filter(p => p.phase === 'build_phase');
    if (!drawingPowers[powerIndex || 0]) return false;
    
    return true;
  }

  // ============================================================================
  // BATTLE PHASE VALIDATIONS
  // ============================================================================
  
  private validateFirstStrikePower(action: GameAction, gameState: GameState): boolean {
    // Validate during FIRST_STRIKE step
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BattlePhaseStep.FIRST_STRIKE) return false;
    
    const { shipId, targetShipId } = action.data || {};
    if (!shipId) return false;
    
    // Check if ship has First Strike power and charges
    const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
    const ship = playerShips.find(s => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;
    
    // Validate ship has First Strike capability
    // (e.g. Guardian with charges)
    if (ship.shipId !== 'GUA') return false;
    if ((ship.currentCharges || 0) <= 0) return false;
    
    // If target specified, validate it exists
    if (targetShipId) {
      const targetExists = Object.values(gameState.gameData?.ships || {}).some(ships =>
        ships.some(s => s.id === targetShipId && !s.isDestroyed)
      );
      if (!targetExists) return false;
    }
    
    return true;
  }
  
  private validateDeclareCharge(action: GameAction, gameState: GameState): boolean {
    // Validate during SIMULTANEOUS_DECLARATION or CONDITIONAL_RESPONSE
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BattlePhaseStep.SIMULTANEOUS_DECLARATION && 
        currentStep !== BattlePhaseStep.CONDITIONAL_RESPONSE) {
      return false;
    }
    
    const { shipId, powerIndex, targetPlayerId, targetShipId } = action.data || {};
    if (!shipId || powerIndex === undefined) return false;
    
    // Check if ship exists and has charges
    const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
    const ship = playerShips.find(s => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;
    if ((ship.currentCharges || 0) <= 0) return false;
    
    // Validate power exists at that index
    // (Delegate to ship data or PowerExecutor)
    
    return true;
  }
  
  private validateUseSolarPower(action: GameAction, gameState: GameState): boolean {
    // Validate during SIMULTANEOUS_DECLARATION or CONDITIONAL_RESPONSE
    const currentStep = this.phasesEngine.getCurrentStep(gameState);
    if (currentStep !== BattlePhaseStep.SIMULTANEOUS_DECLARATION && 
        currentStep !== BattlePhaseStep.CONDITIONAL_RESPONSE) {
      return false;
    }
    
    const { powerType, targetPlayerId, targetShipId } = action.data || {};
    if (!powerType) return false;
    
    // Get solar power ship definition
    const solarPowerShip = getShipById(powerType);
    if (!solarPowerShip || !solarPowerShip.energyCost) {
      console.error(`[RulesEngine] Solar power ${powerType} not found or missing energyCost`);
      return false;
    }
    
    // Get player's current energy
    const playerSolarEnergy = gameState.gameData?.solarEnergy?.[action.playerId] || { red: 0, green: 0, blue: 0 };
    
    // Calculate required energy costs
    let requiredRed = solarPowerShip.energyCost.red || 0;
    let requiredGreen = solarPowerShip.energyCost.green || 0;
    let requiredBlue = solarPowerShip.energyCost.blue || 0;
    
    // Handle X blue (variable cost based on target ship line cost)
    if (solarPowerShip.energyCost.variable === 'ship_line_cost') {
      if (!targetShipId) {
        console.error(`[RulesEngine] Solar power ${powerType} requires X blue but no target ship specified`);
        return false;
      }
      
      // Find target ship in game state
      const targetPlayerShips = gameState.gameData?.ships?.[targetPlayerId || ''] || [];
      const targetShip = targetPlayerShips.find(ship => ship.id === targetShipId);
      
      if (!targetShip) {
        console.error(`[RulesEngine] Target ship ${targetShipId} not found`);
        return false;
      }
      
      // Get target ship definition to determine line cost
      const targetShipDef = getShipById(targetShip.definitionId || targetShip.shipId);
      if (!targetShipDef || !targetShipDef.basicCost) {
        console.error(`[RulesEngine] Target ship definition not found or not a basic ship`);
        return false;
      }
      
      // X blue = target ship's total line cost
      requiredBlue = targetShipDef.basicCost.totalLines;
    }
    
    // Validate player has enough energy
    if (requiredRed > playerSolarEnergy.red) {
      console.log(`[RulesEngine] Insufficient red energy: need ${requiredRed}, have ${playerSolarEnergy.red}`);
      return false;
    }
    if (requiredGreen > playerSolarEnergy.green) {
      console.log(`[RulesEngine] Insufficient green energy: need ${requiredGreen}, have ${playerSolarEnergy.green}`);
      return false;
    }
    if (requiredBlue > playerSolarEnergy.blue) {
      console.log(`[RulesEngine] Insufficient blue energy: need ${requiredBlue}, have ${playerSolarEnergy.blue}`);
      return false;
    }
    
    return true;
  }

  // ============================================================================
  // BUILD PHASE APPLICATIONS
  // ============================================================================
  
  private applyBuildShip(action: GameAction, gameState: GameState): GameState {
    const { shipId, cost } = action.data || {};
    
    // Deduct lines
    const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
    const newAvailableLines = availableLines - (cost || 0);
    
    // Add ship to player's ships
    const playerShips = [...(gameState.gameData?.ships?.[action.playerId] || [])];
    playerShips.push({
      id: `${shipId}_${Date.now()}`,
      shipId,
      ownerId: action.playerId,
      isDestroyed: false,
      currentCharges: 0, // Will be set based on ship data
      isUpgraded: false
    });
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        ships: {
          ...gameState.gameData?.ships,
          [action.playerId]: playerShips
        },
        turnData: {
          ...gameState.gameData?.turnData,
          availableLines: {
            ...gameState.gameData?.turnData?.availableLines,
            [action.playerId]: newAvailableLines
          }
        }
      }
    };
  }
  
  private applyUpgradeShip(action: GameAction, gameState: GameState): GameState {
    const { shipId, upgradeCost } = action.data || {};
    
    // Deduct lines
    const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
    const newAvailableLines = availableLines - (upgradeCost || 0);
    
    // Upgrade ship
    const playerShips = gameState.gameData?.ships?.[action.playerId] || [];
    const updatedShips = playerShips.map(ship =>
      ship.id === shipId ? { ...ship, isUpgraded: true } : ship
    );
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        ships: {
          ...gameState.gameData?.ships,
          [action.playerId]: updatedShips
        },
        turnData: {
          ...gameState.gameData?.turnData,
          availableLines: {
            ...gameState.gameData?.turnData?.availableLines,
            [action.playerId]: newAvailableLines
          }
        }
      }
    };
  }
  
  private applySaveLines(action: GameAction, gameState: GameState): GameState {
    const { linesToSave } = action.data || {};
    
    // Move lines from available to saved
    const availableLines = gameState.gameData?.turnData?.availableLines?.[action.playerId] || 0;
    const savedLines = gameState.gameData?.savedLines?.[action.playerId] || 0;
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        savedLines: {
          ...gameState.gameData?.savedLines,
          [action.playerId]: savedLines + (linesToSave || 0)
        },
        turnData: {
          ...gameState.gameData?.turnData,
          availableLines: {
            ...gameState.gameData?.turnData?.availableLines,
            [action.playerId]: availableLines - (linesToSave || 0)
          }
        }
      }
    };
  }
  
  private applyShipBuildingPower(action: GameAction, gameState: GameState): GameState {
    const { shipId, powerIndex } = action.data || {};
    
    // TODO: Integrate with PowerExecutor for actual power execution
    // For now, just store the action in pending powers
    console.log(`Ship building power activated: ship ${shipId}, power ${powerIndex}`);
    
    return gameState;
  }
  
  private applyDrawingPhasePower(action: GameAction, gameState: GameState): GameState {
    const { shipId, powerIndex } = action.data || {};
    
    // TODO: Integrate with PowerExecutor for actual power execution
    // For now, just store the action in pending powers
    console.log(`Drawing phase power activated: ship ${shipId}, power ${powerIndex}`);
    
    return gameState;
  }

  // ============================================================================
  // BATTLE PHASE APPLICATIONS
  // ============================================================================
  
  private applyFirstStrikePower(action: GameAction, gameState: GameState): GameState {
    const { shipId, targetShipId } = action.data || {};
    
    // Store First Strike declaration (will be resolved by system)
    // For now, just mark as ready (actual resolution happens automatically)
    
    return gameState;
  }
  
  private applyDeclareCharge(action: GameAction, gameState: GameState): GameState {
    const { shipId, powerIndex, targetPlayerId, targetShipId } = action.data || {};
    
    // Store charge declaration in pending declarations (hidden until both players ready)
    const turnData = gameState.gameData?.turnData;
    const pendingCharges = turnData?.pendingChargeDeclarations || {};
    const playerPendingCharges = pendingCharges[action.playerId] || [];
    
    playerPendingCharges.push({
      playerId: action.playerId,
      shipId,
      powerIndex,
      targetPlayerId,
      targetShipId,
      timestamp: new Date().toISOString()
    });
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          pendingChargeDeclarations: {
            ...pendingCharges,
            [action.playerId]: playerPendingCharges
          }
        }
      }
    };
  }
  
  private applyUseSolarPower(action: GameAction, gameState: GameState): GameState {
    const { powerType, targetPlayerId, targetShipId } = action.data || {};
    
    // Store solar power declaration in pending declarations (hidden until both players ready)
    const turnData = gameState.gameData?.turnData;
    const pendingSOLAR = turnData?.pendingSOLARPowerDeclarations || {};
    const playerPendingSOLAR = pendingSOLAR[action.playerId] || [];
    
    playerPendingSOLAR.push({
      playerId: action.playerId,
      powerType,
      targetPlayerId,
      targetShipId,
      timestamp: new Date().toISOString()
    });
    
    return {
      ...gameState,
      gameData: {
        ...gameState.gameData,
        turnData: {
          ...turnData,
          pendingSOLARPowerDeclarations: {
            ...pendingSOLAR,
            [action.playerId]: playerPendingSOLAR
          }
        }
      }
    };
  }
  
  private applyPass(action: GameAction, gameState: GameState): GameState {
    // Passing is equivalent to declaring ready without making declarations
    return this.phasesEngine.setPlayerReady(gameState, action.playerId);
  }

  // ============================================================================
  // GENERAL APPLICATIONS
  // ============================================================================
  
  private applyDeclareReady(action: GameAction, gameState: GameState): GameState {
    // Mark player as ready for current step
    return this.phasesEngine.setPlayerReady(gameState, action.playerId);
  }

  private applySurrender(action: GameAction, gameState: GameState): GameState {
    // Mark player as surrendered
    return {
      ...gameState,
      status: 'complete',
      winner: gameState.players.find(p => p.id !== action.playerId) || null,
      players: gameState.players.map(player => 
        player.id === action.playerId 
          ? { ...player, status: 'surrendered' }
          : player
      )
    };
  }
}