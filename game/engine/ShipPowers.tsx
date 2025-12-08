// Ship powers engine - handles faction-specific abilities and ship-specific powers
// This is separate from core game rules and phases

import { GameState, GameAction, PlayerShip } from '../types/GameTypes';

export enum FactionType {
  HUMAN = 'human',
  XENITE = 'xenite', 
  CENTAUR = 'centaur',
  ANCIENT = 'ancient'
}

export enum ShipType {
  // Will be defined based on your ship specifications
  FIGHTER = 'fighter',
  CRUISER = 'cruiser',
  BATTLESHIP = 'battleship',
  CAPITAL = 'capital'
}

export interface ShipPower {
  id: string;
  name: string;
  description: string;
  faction?: FactionType;
  shipType?: ShipType;
  cost?: number;
  cooldown?: number;
  usesPerTurn?: number;
  condition?: (gameState: GameState, shipId: string) => boolean;
}

export interface PowerActivation {
  powerId: string;
  shipId: string;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  parameters?: Record<string, string | number | boolean>;
}

export class ShipPowersEngine {
  
  private readonly shipPowers: Map<string, ShipPower> = new Map();
  
  constructor() {
    this.initializePowers();
  }

  // Register a power (for when you define specific powers)
  registerPower(power: ShipPower): void {
    this.shipPowers.set(power.id, power);
  }

  // Get all powers available to a ship
  getAvailablePowers(shipId: string, gameState: GameState): ShipPower[] {
    const ship = this.getShip(shipId, gameState);
    if (!ship) return [];

    const availablePowers: ShipPower[] = [];
    
    // Note: PlayerShip doesn't have faction/type directly
    // This logic needs to be updated to lookup ship definition by shipId
    // For now, returning empty array as placeholder
    
    // TODO: Implement ship definition lookup
    // const shipDefinition = getShipDefinition(ship.shipId);
    // Then check powers against shipDefinition.species and shipDefinition.type
    
    return availablePowers;
  }

  // Check if a power can be activated
  canActivatePower(activation: PowerActivation, gameState: GameState): boolean {
    const power = this.shipPowers.get(activation.powerId);
    if (!power) return false;

    const ship = this.getShip(activation.shipId, gameState);
    if (!ship) return false;

    // Note: Full validation requires ship definition lookup
    // This is a placeholder that will need proper implementation
    
    // Check power-specific conditions
    if (power.condition && !power.condition(gameState, activation.shipId)) {
      return false;
    }

    return true;
  }

  // Apply a power activation
  activatePower(activation: PowerActivation, gameState: GameState): GameState {
    const power = this.shipPowers.get(activation.powerId);
    if (!power || !this.canActivatePower(activation, gameState)) {
      return gameState;
    }

    // Apply power-specific effects
    let newGameState = { ...gameState };
    
    switch (activation.powerId) {
      // Faction-specific powers will be implemented here based on your specifications
      case 'human_shield_boost':
        newGameState = this.applyHumanShieldBoost(activation, newGameState);
        break;
      case 'xenite_phase_shift':
        newGameState = this.applyXenitePhaseShift(activation, newGameState);
        break;
      case 'centaur_rapid_fire':
        newGameState = this.applyCentaurRapidFire(activation, newGameState);
        break;
      case 'ancient_energy_blast':
        newGameState = this.applyAncientEnergyBlast(activation, newGameState);
        break;
      default:
        // Generic power application
        break;
    }

    // Update power usage tracking
    newGameState = this.updatePowerUsage(activation, newGameState, power);

    return newGameState;
  }

  // Get faction-specific powers
  getFactionPowers(faction: FactionType): ShipPower[] {
    return Array.from(this.shipPowers.values()).filter(power => power.faction === faction);
  }

  // Private helper methods
  private getShip(shipId: string, gameState: GameState): PlayerShip | null {
    // Search through all players' ships to find the ship by ID
    for (const playerId in gameState.gameData.ships) {
      const playerShips = gameState.gameData.ships[playerId];
      const ship = playerShips.find(s => s.id === shipId);
      if (ship) {
        return ship;
      }
    }
    return null;
  }

  private updatePowerUsage(activation: PowerActivation, gameState: GameState, power: ShipPower): GameState {
    // Update cooldowns and usage tracking
    const newGameState = { ...gameState };
    
    // This will be implemented based on how ship data is structured
    // For now, return unchanged state
    return newGameState;
  }

  // Initialize default powers (placeholders for your actual powers)
  private initializePowers(): void {
    // Human faction powers
    this.registerPower({
      id: 'human_shield_boost',
      name: 'Shield Boost',
      description: 'Temporarily increase shield strength',
      faction: FactionType.HUMAN,
      cost: 1,
      cooldown: 3
    });

    // Xenite faction powers
    this.registerPower({
      id: 'xenite_phase_shift',
      name: 'Phase Shift',
      description: 'Become temporarily intangible',
      faction: FactionType.XENITE,
      cost: 2,
      cooldown: 4
    });

    // Centaur faction powers
    this.registerPower({
      id: 'centaur_rapid_fire',
      name: 'Rapid Fire',
      description: 'Attack multiple times in one turn',
      faction: FactionType.CENTAUR,
      cost: 2,
      usesPerTurn: 1
    });

    // Ancient faction powers
    this.registerPower({
      id: 'ancient_energy_blast',
      name: 'Energy Blast',
      description: 'Devastating area effect attack',
      faction: FactionType.ANCIENT,
      cost: 3,
      cooldown: 5
    });
  }

  // Placeholder power effect methods (to be implemented based on your specs)
  private applyHumanShieldBoost(activation: PowerActivation, gameState: GameState): GameState {
    // Implement human shield boost effect
    return gameState;
  }

  private applyXenitePhaseShift(activation: PowerActivation, gameState: GameState): GameState {
    // Implement xenite phase shift effect
    return gameState;
  }

  private applyCentaurRapidFire(activation: PowerActivation, gameState: GameState): GameState {
    // Implement centaur rapid fire effect
    return gameState;
  }

  private applyAncientEnergyBlast(activation: PowerActivation, gameState: GameState): GameState {
    // Implement ancient energy blast effect
    return gameState;
  }
}