// ============================================================================
// PASSIVE MODIFIERS SYSTEM
// ============================================================================
//
// ARCHITECTURAL LAW:
// "Passive powers change what is legal.
//  Active powers change what happens.
//  This boundary must never be blurred."
//
// PassiveModifiers is the SINGLE AUTHORITATIVE SYSTEM for:
// - Scanning all currently alive ships
// - Extracting PASSIVE powers
// - Registering rule modifiers
// - Answering rule queries
//
// This system:
// ✅ Queries rule state (legality checks)
// ❌ Does NOT execute effects
// ❌ Does NOT modify health
// ❌ Does NOT run during End of Turn Resolution
// ❌ Does NOT persist after source ship stops existing
//
// ============================================================================

import type { GameState, PlayerShip } from '../types/GameTypes';
import { PowerTiming } from '../types/ShipTypes';
import { getShipById } from '../data/ShipDefinitions';
import { PASSIVE_MODIFIER_IDS, PASSIVE_MODIFIER_IDS_SET, type PassiveModifierId } from './PassiveModifierIds';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Base modifier data - count and ship instance IDs
 */
interface BaseModifierData {
  count: number;
  shipIds: string[];  // Ship instance IDs that provide this modifier
}

/**
 * Chronoswarm-specific data (tracks turn built for exclusion rule)
 */
interface ChronoswarmModifierData extends BaseModifierData {
  kind: 'chronoswarm';
  // No additional data needed - exclusion logic is in registration
}

/**
 * Generic modifier data (most modifiers)
 */
interface GenericModifierData extends BaseModifierData {
  kind: 'generic';
}

/**
 * Discriminated union of modifier data types
 * Add new variants as needed for modifiers with specific data requirements
 */
type ModifierData = GenericModifierData | ChronoswarmModifierData;

/**
 * Helper to create generic modifier data
 */
function createGenericModifierData(): GenericModifierData {
  return { kind: 'generic', count: 0, shipIds: [] };
}

/**
 * Helper to create Chronoswarm modifier data
 */
function createChronoswarmModifierData(): ChronoswarmModifierData {
  return { kind: 'chronoswarm', count: 0, shipIds: [] };
}

// Type aliases for clarity
type PlayerId = string;

// ============================================================================
// PASSIVE MODIFIERS CLASS
// ============================================================================

export class PassiveModifiers {
  // Central registry: playerId -> modifierId -> ModifierData
  private modifiers: Map<PlayerId, Map<PassiveModifierId, ModifierData>> = new Map();
  
  // ============================================================================
  // CENTRAL UPDATE MECHANISM (CRITICAL)
  // ============================================================================
  
  /**
   * updateModifiers() - MUST be called:
   * - At the start of every phase
   * - After any ship is built/destroyed/consumed/stolen
   * 
   * Fully recomputes modifier state. No persistence across turns.
   */
  updateModifiers(gameState: GameState): void {
    // Clear existing modifiers
    this.modifiers.clear();
    
    // Scan all players
    for (const [playerId, ships] of Object.entries(gameState.gameData.ships || {})) {
      this.scanPlayerShips(playerId, ships, gameState);
    }
  }
  
  /**
   * Scan a player's ships and register their passive modifiers
   * Uses PlayerShip (runtime ship type from GameTypes)
   */
  private scanPlayerShips(playerId: PlayerId, ships: PlayerShip[], gameState: GameState): void {
    for (const ship of ships) {
      // ✅ CORRECT FILTER: Skip destroyed/consumed ships
      // Use PlayerShip fields: isDestroyed, isConsumedInUpgrade
      if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
      
      // Get ship definition using PlayerShip.shipId (definition ID)
      const shipDef = getShipById(ship.shipId);
      if (!shipDef) continue;
      
      // ✅ CORRECT IDENTIFICATION: Scan powers with timing === PowerTiming.PASSIVE
      for (const power of shipDef.powers) {
        if (power.timing === PowerTiming.PASSIVE) {
          const modifierId = power.specialLogic?.customLogicId as PassiveModifierId;
          
          if (modifierId) {
            this.registerModifier(playerId, modifierId, ship, gameState);
          }
        }
      }
    }
  }
  
  /**
   * Register a modifier with validation
   * Uses PlayerShip (runtime ship type)
   */
  private registerModifier(
    playerId: PlayerId,
    modifierId: PassiveModifierId,
    ship: PlayerShip,
    gameState: GameState
  ): void {
    // Validate modifier ID
    if (!PASSIVE_MODIFIER_IDS_SET.has(modifierId)) {
      console.warn(`[PassiveModifiers] Unknown modifier ID: ${modifierId} from ship ${ship.shipId}`);
      return;
    }
    
    // Special case: Chronoswarm does not occur the turn it is built
    if (modifierId === PASSIVE_MODIFIER_IDS.CHRONOSWARM_BUILD_PHASE || 
        modifierId === PASSIVE_MODIFIER_IDS.CHRONOSWARM_DICE_SCALING) {
      // Check if ship was built this turn
      // Note: PlayerShip doesn't have createdOnTurn, so we need to track this differently
      // For now, we'll check if the ship appears in this turn's actions
      const currentTurn = gameState.roundNumber;
      const shipBuildActions = gameState.actions.filter(
        action => action.type === 'build_ship' && 
                 action.data && 
                 'shipId' in action.data &&
                 action.playerId === playerId
      );
      
      // Find the most recent build of this ship
      const thisShipBuild = shipBuildActions
        .reverse()
        .find(action => {
          // Match by looking at recently created ships
          // This is an approximation - ideal solution would track createdOnTurn in PlayerShip
          return true; // TODO: Implement proper turn tracking
        });
      
      // For now, skip Chronoswarm check - will implement when turn tracking is added
      // The proper fix is to add createdOnTurn?: number to PlayerShip interface
    }
    
    // Initialize player entry
    if (!this.modifiers.has(playerId)) {
      this.modifiers.set(playerId, new Map());
    }
    
    const playerMods = this.modifiers.get(playerId)!;
    
    // Get or create modifier entry (typed)
    let existing = playerMods.get(modifierId);
    if (!existing) {
      // Create appropriate data structure based on modifier type
      if (modifierId === PASSIVE_MODIFIER_IDS.CHRONOSWARM_BUILD_PHASE ||
          modifierId === PASSIVE_MODIFIER_IDS.CHRONOSWARM_DICE_SCALING) {
        existing = createChronoswarmModifierData();
      } else {
        existing = createGenericModifierData();
      }
    }
    
    // Increment count and track ship instance ID
    existing.count += 1;
    existing.shipIds.push(ship.id); // Use PlayerShip.id (instance ID)
    playerMods.set(modifierId, existing);
  }
  
  // ============================================================================
  // GENERIC QUERY METHODS (FOUNDATION)
  // ============================================================================
  
  /**
   * Check if a player has a specific modifier
   */
  hasModifier(playerId: PlayerId, modifierId: PassiveModifierId): boolean {
    return this.modifiers.get(playerId)?.has(modifierId) || false;
  }
  
  /**
   * Count how many ships grant a specific modifier
   */
  countModifier(playerId: PlayerId, modifierId: PassiveModifierId): number {
    return this.modifiers.get(playerId)?.get(modifierId)?.count || 0;
  }
  
  /**
   * Get all ship instance IDs that provide a specific modifier
   */
  getModifierShipIds(playerId: PlayerId, modifierId: PassiveModifierId): string[] {
    return this.modifiers.get(playerId)?.get(modifierId)?.shipIds || [];
  }
  
  /**
   * Get typed modifier data for advanced queries
   */
  getModifierData(playerId: PlayerId, modifierId: PassiveModifierId): ModifierData | undefined {
    return this.modifiers.get(playerId)?.get(modifierId);
  }
  
  // ============================================================================
  // DESTRUCTION LEGALITY (CRITICAL)
  // ============================================================================
  
  /**
   * Check if opponent can destroy target player's ships
   * Returns TRUE if target has protection (destruction is PREVENTED)
   * Returns FALSE if target has no protection (destruction is ALLOWED)
   * 
   * Rules:
   * - Players may always destroy their own ships (not checked here)
   * - Opponent destruction is blocked if target has protection modifier
   * 
   * Required for: Sacrificial Pool, Guardian, Ship of Equality
   */
  preventsOpponentShipDestruction(targetPlayerId: PlayerId): boolean {
    // Check if target has any protection modifier
    const hasSacrificialPool = this.hasModifier(targetPlayerId, PASSIVE_MODIFIER_IDS.SACRIFICIAL_POOL);
    const hasGuardian = this.hasModifier(targetPlayerId, PASSIVE_MODIFIER_IDS.GUARDIAN);
    const hasEquality = this.hasModifier(targetPlayerId, PASSIVE_MODIFIER_IDS.SHIP_OF_EQUALITY);
    
    return hasSacrificialPool || hasGuardian || hasEquality;
  }
  
  /**
   * Check if a ship can be destroyed by an opponent power
   * (Convenience wrapper for validators)
   */
  canOpponentDestroyShip(targetPlayerId: PlayerId, sourcePlayerId: PlayerId): boolean {
    // Players may destroy their own ships
    if (targetPlayerId === sourcePlayerId) return true;
    
    // Check if target has protection
    return !this.preventsOpponentShipDestruction(targetPlayerId);
  }
  
  // ============================================================================
  // COUNTING RULES
  // ============================================================================
  
  /**
   * Check if ships within upgrades should count for powers (Hive passive)
   */
  doShipsInUpgradesCount(playerId: PlayerId): boolean {
    return this.hasModifier(playerId, PASSIVE_MODIFIER_IDS.HIVE);
  }
  
  // ============================================================================
  // DICE MODIFICATIONS
  // ============================================================================
  
  /**
   * Get dice roll override (Leviathan forces 6)
   * Returns null if no override, or the forced value (6)
   */
  getDiceRollOverride(playerId: PlayerId): number | null {
    if (this.hasModifier(playerId, PASSIVE_MODIFIER_IDS.LEVIATHAN)) {
      return 6; // All dice rolls read as 6
    }
    return null; // No override
  }
  
  /**
   * Get reroll count (Ark of Knowledge: 1 = reroll once, 2+ = reroll twice)
   */
  getDiceRerollCount(playerId: PlayerId): number {
    const count = this.countModifier(playerId, PASSIVE_MODIFIER_IDS.ARK_KNOWLEDGE_REROLL);
    
    if (count >= 2) return 2; // Reroll twice
    if (count >= 1) return 1; // Reroll once
    return 0; // No rerolls
  }
  
  // ============================================================================
  // HEALTH MODIFICATIONS
  // ============================================================================
  
  /**
   * Get max health increase (Spiral with 2+ increases by 15)
   */
  getMaxHealthIncrease(playerId: PlayerId): number {
    const count = this.countModifier(playerId, PASSIVE_MODIFIER_IDS.SPIRAL_MAX_HEALTH);
    return count >= 2 ? 15 : 0;
  }
  
  // ============================================================================
  // DAMAGE/HEALING MODIFICATIONS
  // ============================================================================
  
  /**
   * Check if damage and healing should be equalized (Ark of Knowledge with 3+)
   */
  shouldEqualizeDamageHealing(playerId: PlayerId): boolean {
    const count = this.countModifier(playerId, PASSIVE_MODIFIER_IDS.ARK_KNOWLEDGE_EQUALIZE);
    return count >= 3;
  }
  
  /**
   * Get damage multiplier from Science Vessel (2+ doubles damage)
   * Note: Science Vessel effect is applied via turn modifiers
   */
  getAutomaticDamageMultiplier(playerId: PlayerId, gameState: GameState): number {
    // Check turn modifiers first (Science Vessel effect is applied via turn modifier)
    const turnModifiers = gameState.gameData.turnData?.modifiers?.[playerId];
    if (turnModifiers?.double_automatic_damage) {
      return 2;
    }
    return 1; // No multiplier
  }
  
  /**
   * Get healing multiplier from Science Vessel (1+ doubles healing)
   * Note: Science Vessel effect is applied via turn modifiers
   */
  getAutomaticHealingMultiplier(playerId: PlayerId, gameState: GameState): number {
    // Check turn modifiers first (Science Vessel effect is applied via turn modifier)
    const turnModifiers = gameState.gameData.turnData?.modifiers?.[playerId];
    if (turnModifiers?.double_automatic_healing) {
      return 2;
    }
    return 1; // No multiplier
  }
  
  // ============================================================================
  // PHASE STRUCTURE (CHRONOSWARM)
  // ============================================================================
  
  /**
   * Check if extra build phase should occur (Chronoswarm)
   */
  hasExtraBuildPhase(playerId: PlayerId): boolean {
    return this.hasModifier(playerId, PASSIVE_MODIFIER_IDS.CHRONOSWARM_BUILD_PHASE);
  }
  
  /**
   * Get number of dice to roll in extra build phase (Chronoswarm scaling)
   * 
   * RULES VERIFICATION:
   * - 1 Chronoswarm => 1 die in extra phase
   * - 2 Chronoswarm => 2 dice in extra phase
   * - 3+ Chronoswarm => 3 dice in extra phase (capped at 3)
   * 
   * Implementation uses CHRONOSWARM_DICE_SCALING count, capped at 3.
   */
  getChronoswarmDiceCount(playerId: PlayerId): number {
    const count = this.countModifier(playerId, PASSIVE_MODIFIER_IDS.CHRONOSWARM_DICE_SCALING);
    return Math.min(count, 3); // Capped at 3 dice maximum
  }
  
  // ============================================================================
  // UTILITY QUERIES (For UI and validators)
  // ============================================================================
  
  /**
   * Get ships available for Evolver transformation
   */
  getEvolverTransformableShips(playerId: PlayerId, gameState: GameState): PlayerShip[] {
    const playerShips = gameState.gameData.ships?.[playerId] || [];
    
    // Find all Xenites that can be transformed
    return playerShips.filter(ship => {
      if (ship.isDestroyed || ship.isConsumedInUpgrade) return false;
      return ship.shipId === 'XEN'; // PlayerShip.shipId is definition ID
    });
  }
  
  /**
   * Get ships available for Sacrificial Pool sacrifice
   */
  getSacrificialPoolTargets(playerId: PlayerId, gameState: GameState): PlayerShip[] {
    const playerShips = gameState.gameData.ships?.[playerId] || [];
    
    // Find all basic ships that can be sacrificed
    return playerShips.filter(ship => {
      if (ship.isDestroyed || ship.isConsumedInUpgrade) return false;
      
      const shipDef = getShipById(ship.shipId); // Use PlayerShip.shipId
      if (!shipDef) return false;
      
      // Only basic ships can be sacrificed
      return shipDef.type === 'basic';
    });
  }
  
  /**
   * Get available solar powers for Cube to repeat
   */
  getCubeRepeatableSolarPowers(playerId: PlayerId, gameState: GameState): string[] {
    // Returns solar power IDs that were cast this turn
    const turnData = gameState.gameData.turnData;
    const solarPowersUsed = turnData?.solarPowersUsed?.[playerId] || [];
    return solarPowersUsed;
  }
  
  /**
   * Check if Dreadnought should trigger for a ship build
   */
  shouldTriggerDreadnought(shipBuiltId: string): boolean {
    const shipDef = getShipById(shipBuiltId);
    if (!shipDef) return false;
    
    // Dreadnought triggers for basic ships and upgraded ships (not itself)
    if (shipBuiltId === 'DRE') return false; // Don't trigger on itself
    
    // Triggers on basic ships and upgraded ships
    return shipDef.type === 'basic' || shipDef.type === 'upgraded';
  }
  
  /**
   * Get joining lines generation per turn (Centaur species)
   */
  getJoiningLinesGeneration(playerId: PlayerId, gameState: GameState): number {
    const playerShips = gameState.gameData.ships?.[playerId] || [];
    let totalJoiningLines = 0;
    
    playerShips.forEach(ship => {
      if (ship.isDestroyed || ship.isConsumedInUpgrade) return;
      
      const shipDef = getShipById(ship.shipId); // Use PlayerShip.shipId
      if (!shipDef) return;
      
      // Check for joining lines powers
      // Note: This is using old timing enum values - need to verify against PowerTiming
      shipDef.powers.forEach(power => {
        // TODO: Verify correct timing enum for continuous effects
        if (power.effectType === 'gain_joining_lines' && 
            power.timing === PowerTiming.CONTINUOUS) {
          totalJoiningLines += power.baseAmount || 0;
        }
      });
    });
    
    return totalJoiningLines;
  }
  
  /**
   * Check if player can use ship building powers this phase
   */
  canUseShipBuildingPowers(playerId: PlayerId, gameState: GameState): boolean {
    // Check phase
    const currentStep = gameState.gameData.turnData?.currentStep;
    return currentStep === 'ships_that_build';
  }
}

export default PassiveModifiers;
