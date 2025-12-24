// Effect Calculator - Calculates effect outcomes (NOT rule legality)
// This is separate from PassiveModifiers which only queries rule state

import type { GameState } from '../types/GameTypes';
import { getShipById } from '../data/ShipDefinitions.core';

/**
 * ARCHITECTURAL BOUNDARY
 * 
 * PassiveModifiers: "Can I do this?" (legality)
 * EffectCalculator: "What happens if I do?" (outcome)
 * 
 * This class calculates effect amounts and outcomes.
 * It does NOT determine rule legality.
 */
export class EffectCalculator {
  
  /**
   * Calculate heal/damage from Spiral based on energy spent
   * 
   * Spiral passive: 1+ heals for red/green spent, 3+ damages for red/green spent
   */
  static calculateSpiralEffect(
    playerId: string,
    gameState: GameState,
    effectType: 'heal' | 'damage'
  ): number {
    const playerShips = gameState.gameData.ships?.[playerId] || [];
    const spiralCount = playerShips.filter(ship => {
      if (ship.isDepleted || ship.isDestroyed || ship.isConsumedInUpgrade) return false;
      return ship.definitionId === 'SPI';
    }).length;
    
    // Check quantity requirement
    if (effectType === 'heal' && spiralCount < 1) return 0;
    if (effectType === 'damage' && spiralCount < 3) return 0;
    
    // Get energy spent this turn
    const energySpent = gameState.gameData.turnData?.energySpent?.[playerId];
    if (!energySpent) return 0;
    
    const redGreenSpent = (energySpent.red || 0) + (energySpent.green || 0);
    return redGreenSpent;
  }
  
  /**
   * Calculate Xenites generated from sacrificing a ship
   * 
   * Sacrificial Pool: Sacrifice basic ship → gain xenites equal to floor(line_cost / 3)
   */
  static calculateSacrificialPoolXenites(shipId: string): number {
    const shipDef = getShipById(shipId);
    if (!shipDef || !shipDef.basicCost) return 0;
    
    const lines = shipDef.basicCost.lines;
    return Math.floor(lines / 3);
  }
  
  /**
   * Get energy tracking for Spiral (heal/damage per energy spent)
   */
  static getSpiralEnergyTracking(
    playerId: string,
    gameState: GameState
  ): { red: number; green: number; blue: number } {
    const energySpent = gameState.gameData.turnData?.energySpent?.[playerId];
    return energySpent || { red: 0, green: 0, blue: 0 };
  }
}

export default EffectCalculator;