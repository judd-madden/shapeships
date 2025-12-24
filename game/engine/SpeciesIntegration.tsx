// Integration layer between ShipDefinitions and GamePhases engine
// Handles ship power calculations and damage/healing resolution

import type {
  ShipDefinition,
  Species,
  getShipById
} from '../data/ShipDefinitions.core';
import { GameState, PlayerShip } from '../types/GameTypes';

export class SpeciesIntegration {

  // Get all ships currently in play across all players
  static getAllShipsInPlay(gameState: GameState): PlayerShip[] {
    const allShips: PlayerShip[] = [];
    
    if (gameState.gameData?.ships) {
      Object.values(gameState.gameData.ships).forEach(playerShips => {
        if (Array.isArray(playerShips)) {
          // Only include non-destroyed ships
          allShips.push(...playerShips.filter(ship => !ship.isDestroyed));
        }
      });
    }
    
    return allShips;
  }

  // Get ship data from ShipDefinitions for a player ship instance
  static getShipData(playerShip: PlayerShip): ShipDefinition | null {
    return getShipById(playerShip.shipId);
  }

  // Get all ship data for ships currently in play
  static getShipDataInPlay(gameState: GameState): ShipDefinition[] {
    const playerShips = this.getAllShipsInPlay(gameState);
    const shipData: ShipDefinition[] = [];
    
    playerShips.forEach(playerShip => {
      const data = this.getShipData(playerShip);
      if (data) {
        shipData.push(data);
      }
    });
    
    return shipData;
  }

  // Check if a player can copy a ship from another species
  static canPlayerCopyShip(gameState: GameState, playerId: string, shipId: string): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return false;
    
    const shipData = getShipById(shipId);
    if (!shipData) return false;
    
    // Can't copy ships from own species
    if (shipData.speciesId === player.faction) return false;
    
    // Check if ship allows copying
    if (!shipData.canBeCopied) return false;
    
    // Check copy restrictions
    if (shipData.copyRestrictions?.includes(player.faction)) return false;
    
    return true;
  }

  // Check if a player can steal a ship from another player
  static canPlayerStealShip(gameState: GameState, stealingPlayerId: string, targetPlayerShip: PlayerShip): boolean {
    const stealingPlayer = gameState.players.find(p => p.id === stealingPlayerId);
    if (!stealingPlayer) return false;
    
    const shipData = this.getShipData(targetPlayerShip);
    if (!shipData) return false;
    
    // Check if ship allows stealing
    if (!shipData.canBeStolen) return false;
    
    // Check steal restrictions
    if (shipData.stealRestrictions?.includes(stealingPlayer.faction)) return false;
    
    return true;
  }

  // Get ships available for a player to build (including copied/stolen ships)
  static getAvailableShipsForPlayer(gameState: GameState, playerId: string): ShipDefinition[] {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return [];
    
    // Start with species' native ships
    // This will be implemented when you provide specific species ship lists
    const availableShips: ShipDefinition[] = [];
    
    // Add copied ships
    if (player.copiedShips) {
      player.copiedShips.forEach(shipId => {
        const shipData = getShipById(shipId);
        if (shipData) {
          availableShips.push(shipData);
        }
      });
    }
    
    // Add stolen ships  
    if (player.stolenShips) {
      player.stolenShips.forEach(shipId => {
        const shipData = getShipById(shipId);
        if (shipData) {
          availableShips.push(shipData);
        }
      });
    }
    
    return availableShips;
  }

  // Calculate total damage output for a player in current turn
  static calculatePlayerDamageOutput(gameState: GameState, playerId: string): number {
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    let totalDamage = 0;
    
    playerShips.forEach(playerShip => {
      if (playerShip.isDestroyed) return;
      
      const shipData = this.getShipData(playerShip);
      if (shipData) {
        totalDamage += shipData.damageValue;
        
        // Add damage bonuses from temporary effects
        playerShip.temporaryEffects?.forEach(effect => {
          if (effect.type === 'damage_bonus') {
            totalDamage += effect.amount || 0;
          }
        });
      }
    });
    
    return totalDamage;
  }

  // Calculate total healing output for a player in current turn
  static calculatePlayerHealingOutput(gameState: GameState, playerId: string): number {
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    let totalHealing = 0;
    
    playerShips.forEach(playerShip => {
      if (playerShip.isDestroyed) return;
      
      const shipData = this.getShipData(playerShip);
      if (shipData) {
        // Check for healing powers in ship
        shipData.powers.forEach(power => {
          power.effects.forEach(effect => {
            if (effect.type === 'healing') {
              totalHealing += effect.amount || 0;
            }
          });
        });
        
        // Add healing bonuses from temporary effects
        playerShip.temporaryEffects?.forEach(effect => {
          if (effect.type === 'health_bonus') {
            totalHealing += effect.amount || 0;
          }
        });
      }
    });
    
    return totalHealing;
  }

  // Calculate total energy generation for a player per turn (Ancient species only)
  static calculatePlayerEnergyGeneration(gameState: GameState, playerId: string): number {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.faction !== 'ancient') return 0;
    
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    let totalEnergyGeneration = 0;
    
    playerShips.forEach(playerShip => {
      if (playerShip.isDestroyed || playerShip.isConsumedInUpgrade) return;
      
      const shipData = this.getShipData(playerShip);
      if (shipData) {
        totalEnergyGeneration += shipData.energyGeneration || 0;
        
        // Add energy bonuses from temporary effects
        playerShip.temporaryEffects?.forEach(effect => {
          if (effect.type === 'energy_bonus') {
            totalEnergyGeneration += effect.amount || 0;
          }
        });
      }
    });
    
    return totalEnergyGeneration;
  }

  // Get available Solar Powers for Ancient player
  static getAvailableSolarPowersForPlayer(gameState: GameState, playerId: string) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.faction !== 'ancient') return [];
    
    // Import here to avoid circular dependencies
    const { getAvailableSolarPowers } = require('../data/SpeciesData');
    
    return getAvailableSolarPowers('ancient');
  }

  // Check if Ancient player can afford a Solar Power
  static canPlayerAffordSolarPower(gameState: GameState, playerId: string, solarPowerEnergyCost: number): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.faction !== 'ancient') return false;
    
    const currentEnergy = player.energy || 0;
    return currentEnergy >= solarPowerEnergyCost;
  }

  // Calculate total joining lines generation for a player per turn (Centaur species only)
  static calculatePlayerJoiningLinesGeneration(gameState: GameState, playerId: string): number {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.faction !== 'centaur') return 0;
    
    const playerShips = gameState.gameData?.ships?.[playerId] || [];
    let totalJoiningLinesGeneration = 0;
    
    playerShips.forEach(playerShip => {
      if (playerShip.isDestroyed || playerShip.isConsumedInUpgrade) return;
      
      const shipData = this.getShipData(playerShip);
      if (shipData) {
        totalJoiningLinesGeneration += shipData.joiningLinesGeneration || 0;
        
        // Add joining lines bonuses from temporary effects
        playerShip.temporaryEffects?.forEach(effect => {
          if (effect.type === 'joining_lines_bonus') {
            totalJoiningLinesGeneration += effect.amount || 0;
          }
        });
      }
    });
    
    return totalJoiningLinesGeneration;
  }

  // Check if Centaur player can afford an upgrade (considers both line types)
  static canPlayerAffordUpgrade(gameState: GameState, playerId: string, upgradeCost: number): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Import here to avoid circular dependencies
    const { canAffordUpgrade } = require('../data/SpeciesData');
    
    const playerLines = player.lines || 0;
    const playerJoiningLines = player.joiningLines || 0;
    
    return canAffordUpgrade({ joiningLinesCost: upgradeCost } as any, playerLines, playerJoiningLines);
  }

  // Calculate optimal payment for Centaur upgrade
  static calculatePlayerUpgradePayment(gameState: GameState, playerId: string, upgradeCost: number) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { useJoiningLines: 0, useNormalLines: 0, canAfford: false };
    
    // Import here to avoid circular dependencies
    const { calculateOptimalUpgradePayment } = require('../data/SpeciesData');
    
    const playerLines = player.lines || 0;
    const playerJoiningLines = player.joiningLines || 0;
    
    return calculateOptimalUpgradePayment(upgradeCost, playerLines, playerJoiningLines);
  }
}

export default SpeciesIntegration;