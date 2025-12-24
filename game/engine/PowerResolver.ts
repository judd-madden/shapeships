/**
 * Power Resolver - CANONICAL POWER RESOLUTION PIPELINE
 * 
 * PURPOSE:
 * Single entry point for ALL ship power resolution.
 * Implements the 4-path resolution model:
 *   1. AST interpretation (if effectAst exists)
 *   2. Effect kind handler (if kind exists)
 *   3. Manual override (if registered)
 *   4. NO-OP with warning (fallback)
 * 
 * ARCHITECTURE:
 * This is the ONLY place where ship powers are interpreted.
 * All engine code must route through here.
 * 
 * RULES:
 * - Never assumes power.kind is present
 * - Always preserves raw text for display
 * - Degrades gracefully when structure is missing
 * - Returns effects, not mutated state (where possible)
 */

import type { GameState, PlayerShip } from '../types/GameTypes';
import type { EngineShipPower, ShipDefId, ShipInstanceId } from '../types/ShipTypes.engine';
import { PowerTiming, ShipPowerPhase } from '../types/ShipTypes.engine';
import type { TriggeredEffect, EffectSource } from '../types/EffectTypes';
import {
  EffectKind,
  createTriggeredEffect,
  generateEffectId,
  createSelfTarget,
  createOpponentTarget
} from '../types/EffectTypes';
import { getShipById } from '../data/ShipDefinitions.engine';
import {
  getManualOverride,
  hasManualOverride,
  executeManualOverride,
  type PowerExecutionContext,
  type ManualPowerResult
} from './ManualPowerOverrides';

// ============================================================================
// TYPES
// ============================================================================

export interface PowerResolutionContext {
  gameState: GameState;
  ship: PlayerShip;
  ownerId: string;
  opponentId: string;
  currentPhase: ShipPowerPhase;
  currentTurn: number;
  diceRoll?: number;
}

export interface PowerResolutionResult {
  /** Generated effects (to be enqueued) */
  effects: TriggeredEffect[];
  
  /** Immediate state mutations (non-health changes like lines, energy) */
  stateMutations?: Partial<GameState>;
  
  /** Whether player choice is required */
  requiresChoice?: boolean;
  
  /** Resolution path used */
  resolutionPath: 'AST' | 'KIND' | 'MANUAL' | 'NOOP';
  
  /** Human-readable description of what happened */
  description?: string;
  
  /** Warning messages (dev-only) */
  warnings?: string[];
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

/**
 * Resolve a ship power using the canonical 4-path model
 * 
 * RESOLUTION ORDER:
 * 1. If effectAst exists → interpret via AST interpreter
 * 2. Else if kind exists → execute via EffectKind handler
 * 3. Else if manual handler exists → execute ship-specific logic
 * 4. Else → NO-OP (log warning in dev only)
 */
export function resolveShipPower(
  power: EngineShipPower,
  context: PowerResolutionContext
): PowerResolutionResult {
  
  // Check if power should execute based on timing
  if (!shouldExecutePower(power, context)) {
    return {
      effects: [],
      resolutionPath: 'NOOP',
      description: 'Power not active in current phase/timing'
    };
  }
  
  // PATH 1: AST Interpretation
  if (power.effectAst) {
    return resolveViaAST(power, context);
  }
  
  // PATH 2: Effect Kind Handler
  if (power.kind) {
    return resolveViaKind(power, context);
  }
  
  // PATH 3: Manual Override
  if (hasManualOverride(context.ship.shipId, power.powerIndex)) {
    return resolveViaManual(power, context);
  }
  
  // PATH 4: NO-OP (graceful degradation)
  return {
    effects: [],
    resolutionPath: 'NOOP',
    warnings: [
      `No resolution path for ${context.ship.shipId} power ${power.powerIndex}: "${power.rawText}"`
    ],
    description: 'Unimplemented power (CSV text only)'
  };
}

// ============================================================================
// TIMING CHECKS
// ============================================================================

/**
 * Check if a power should execute based on timing rules
 */
function shouldExecutePower(
  power: EngineShipPower,
  context: PowerResolutionContext
): boolean {
  const { ship, currentPhase } = context;
  
  // Check phase alignment
  if (power.phase !== currentPhase) {
    return false;
  }
  
  // Check if ship is alive
  if (ship.isDestroyed || ship.isConsumedInUpgrade) {
    return false;
  }
  
  // Check timing constraints
  switch (power.timing) {
    case PowerTiming.CONTINUOUS:
      // CONTINUOUS powers in AUTOMATIC phase are handled by EndOfTurnResolver
      if (power.phase === ShipPowerPhase.AUTOMATIC) {
        return false;
      }
      return true;
      
    case PowerTiming.ONCE_ONLY_AUTOMATIC:
      // Check if already used
      return !hasUsedPower(ship, power.powerIndex, context.gameState);
      
    case PowerTiming.UPON_DESTRUCTION:
      // Only executes when ship is destroyed (handled separately)
      return false;
      
    case PowerTiming.PASSIVE:
      // Passive powers don't execute, they're queried
      return false;
      
    default:
      return true;
  }
}

/**
 * Check if a ship has already used a specific power
 */
function hasUsedPower(
  ship: PlayerShip,
  powerIndex: number,
  gameState: GameState
): boolean {
  const onceOnlyEffects = gameState.gameData.turnData?.onceOnlyAutomaticEffects || [];
  return onceOnlyEffects.some(effect =>
    effect.shipId === ship.id &&
    effect.effectType === `power_${powerIndex}`
  );
}

// ============================================================================
// PATH 1: AST INTERPRETATION
// ============================================================================

/**
 * Resolve power via AST interpretation
 * TODO: Implement AST interpreter integration
 */
function resolveViaAST(
  power: EngineShipPower,
  context: PowerResolutionContext
): PowerResolutionResult {
  console.warn('[PowerResolver] AST interpretation not yet implemented');
  
  return {
    effects: [],
    resolutionPath: 'AST',
    warnings: ['AST interpretation not yet implemented'],
    description: `AST: ${power.rawText}`
  };
}

// ============================================================================
// PATH 2: KIND-BASED RESOLUTION
// ============================================================================

/**
 * Resolve power via effect kind handler
 */
function resolveViaKind(
  power: EngineShipPower,
  context: PowerResolutionContext
): PowerResolutionResult {
  
  const { ship, ownerId, opponentId, gameState } = context;
  const shipDef = getShipById(ship.shipId);
  
  if (!shipDef) {
    return {
      effects: [],
      resolutionPath: 'KIND',
      warnings: [`Ship definition not found: ${ship.shipId}`]
    };
  }
  
  // Create effect source for all effects
  const source: EffectSource = {
    sourcePlayerId: ownerId,
    sourceShipInstanceId: ship.id,
    sourceShipDefId: ship.shipId,
    sourcePowerIndex: power.powerIndex,
    sourceType: 'ship_power'
  };
  
  const effects: TriggeredEffect[] = [];
  let stateMutations: Partial<GameState> | undefined;
  let requiresChoice = false;
  
  switch (power.kind) {
    // ----------------------------------------------------------------------
    // HEALTH EFFECTS (enqueue for end-of-turn resolution)
    // ----------------------------------------------------------------------
    
    case EffectKind.HEAL: {
      const amount = power.baseAmount || 0;
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.HEAL, gameState.roundNumber, 0),
        kind: EffectKind.HEAL,
        source,
        target: createSelfTarget(ownerId),
        value: amount,
        persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
        description: `${shipDef.name}: Heal ${amount}`
      }));
      break;
    }
    
    case EffectKind.DAMAGE: {
      const amount = power.baseAmount || 0;
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.DAMAGE, gameState.roundNumber, 0),
        kind: EffectKind.DAMAGE,
        source,
        target: createOpponentTarget(ownerId, gameState.players),
        value: amount,
        persistsIfSourceDestroyed: power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC,
        description: `${shipDef.name}: Deal ${amount} damage`
      }));
      break;
    }
    
    case EffectKind.TAKE_DAMAGE_SELF: {
      const amount = power.baseAmount || 0;
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.DAMAGE, gameState.roundNumber, 0),
        kind: EffectKind.DAMAGE,
        source,
        target: createSelfTarget(ownerId),
        value: amount,
        description: `${shipDef.name}: Take ${amount} damage`
      }));
      break;
    }
    
    case EffectKind.SET_HEALTH_MAX: {
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.SET_HEALTH_MAX, gameState.roundNumber, 0),
        kind: EffectKind.SET_HEALTH_MAX,
        source,
        target: createSelfTarget(ownerId),
        value: undefined,
        description: `${shipDef.name}: Set health to maximum`
      }));
      break;
    }
    
    case EffectKind.INCREASE_MAX_HEALTH: {
      const amount = power.baseAmount || 0;
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.INCREASE_MAX_HEALTH, gameState.roundNumber, 0),
        kind: EffectKind.INCREASE_MAX_HEALTH,
        source,
        target: createSelfTarget(ownerId),
        value: amount,
        description: `${shipDef.name}: Increase max health by ${amount}`
      }));
      break;
    }
    
    // ----------------------------------------------------------------------
    // RESOURCE EFFECTS (apply immediately)
    // ----------------------------------------------------------------------
    
    case EffectKind.GAIN_LINES: {
      const amount = power.baseAmount || 0;
      stateMutations = {
        ...gameState,
        players: gameState.players.map(p =>
          p.id === ownerId
            ? { ...p, lines: (p.lines || 0) + amount }
            : p
        )
      };
      break;
    }
    
    case EffectKind.GAIN_JOINING_LINES: {
      const amount = power.baseAmount || 0;
      stateMutations = {
        ...gameState,
        players: gameState.players.map(p =>
          p.id === ownerId
            ? { ...p, joiningLines: (p.joiningLines || 0) + amount }
            : p
        )
      };
      break;
    }
    
    case EffectKind.GAIN_ENERGY: {
      const energyGen = power.specialLogic?.energyGeneration;
      if (energyGen) {
        stateMutations = {
          ...gameState,
          players: gameState.players.map(p => {
            if (p.id !== ownerId) return p;
            const energy = p.energy || { red: 0, green: 0, blue: 0 };
            return {
              ...p,
              energy: {
                red: energy.red + (energyGen.red || 0),
                green: energy.green + (energyGen.green || 0),
                blue: energy.blue + (energyGen.blue || 0)
              }
            };
          })
        };
      }
      break;
    }
    
    // ----------------------------------------------------------------------
    // SHIP MANIPULATION (complex, often requires choice)
    // ----------------------------------------------------------------------
    
    case EffectKind.BUILD_SHIP: {
      // Handled by ship build system
      // For now, mark as requiring implementation
      return {
        effects: [],
        resolutionPath: 'KIND',
        warnings: ['BUILD_SHIP requires ship build system integration'],
        description: `Build ship: ${power.specialLogic?.buildShipId}`
      };
    }
    
    case EffectKind.DESTROY_SHIP:
    case EffectKind.STEAL_SHIP:
    case EffectKind.COPY_SHIP: {
      requiresChoice = true;
      break;
    }
    
    // ----------------------------------------------------------------------
    // COUNTING EFFECTS
    // ----------------------------------------------------------------------
    
    case EffectKind.COUNT_AND_DAMAGE: {
      const count = calculateCount(power, context);
      const damagePerCount = power.baseAmount || 1;
      const totalDamage = count * damagePerCount;
      
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.DAMAGE, gameState.roundNumber, 0),
        kind: EffectKind.DAMAGE,
        source,
        target: createOpponentTarget(ownerId, gameState.players),
        value: totalDamage,
        description: `${shipDef.name}: ${count} × ${damagePerCount} = ${totalDamage} damage`
      }));
      break;
    }
    
    case EffectKind.COUNT_AND_HEAL: {
      const count = calculateCount(power, context);
      const healPerCount = power.baseAmount || 1;
      const totalHeal = count * healPerCount;
      
      // Apply max healing limit if specified
      const maxHealing = power.specialLogic?.maxHealingPerTurn;
      const finalHeal = maxHealing ? Math.min(totalHeal, maxHealing) : totalHeal;
      
      effects.push(createTriggeredEffect({
        id: generateEffectId(source, EffectKind.HEAL, gameState.roundNumber, 0),
        kind: EffectKind.HEAL,
        source,
        target: createSelfTarget(ownerId),
        value: finalHeal,
        description: `${shipDef.name}: ${count} × ${healPerCount} = ${finalHeal} healing`
      }));
      break;
    }
    
    // ----------------------------------------------------------------------
    // DEFAULT
    // ----------------------------------------------------------------------
    
    default: {
      return {
        effects: [],
        resolutionPath: 'KIND',
        warnings: [`Unhandled effect kind: ${power.kind}`],
        description: `Kind: ${power.kind} (not implemented)`
      };
    }
  }
  
  return {
    effects,
    stateMutations,
    requiresChoice,
    resolutionPath: 'KIND',
    description: `${shipDef.name}: ${power.rawText}`
  };
}

// ============================================================================
// PATH 3: MANUAL OVERRIDE
// ============================================================================

/**
 * Resolve power via manual override
 */
function resolveViaManual(
  power: EngineShipPower,
  context: PowerResolutionContext
): PowerResolutionResult {
  
  const manualContext: PowerExecutionContext = {
    gameState: context.gameState,
    ship: context.ship,
    ownerId: context.ownerId,
    opponentId: context.opponentId,
    currentPhase: context.currentPhase,
    currentTurn: context.currentTurn,
    diceRoll: context.diceRoll
  };
  
  const result = executeManualOverride(
    context.ship.shipId,
    power.powerIndex,
    power,
    manualContext
  );
  
  return {
    effects: result.effects || [],
    stateMutations: result.gameState !== context.gameState ? result.gameState : undefined,
    requiresChoice: result.requiresChoice,
    resolutionPath: 'MANUAL',
    description: result.description || `Manual: ${power.rawText}`
  };
}

// ============================================================================
// COUNTING HELPERS
// ============================================================================

/**
 * Calculate count for count-based powers
 */
function calculateCount(
  power: EngineShipPower,
  context: PowerResolutionContext
): number {
  const { gameState, ownerId, opponentId, ship } = context;
  const countType = power.specialLogic?.countType;
  const countTarget = power.specialLogic?.countTarget as ShipDefId;
  const countMultiplier = power.specialLogic?.countMultiplier || 1;
  const excludeSelf = power.specialLogic?.excludeSelf || false;
  
  if (!countType) return 0;
  
  let rawCount = 0;
  
  switch (countType) {
    case 'all_ships':
      rawCount = countPlayerShips(gameState, ownerId, excludeSelf ? ship.id : undefined);
      break;
      
    case 'opponent_ships':
      rawCount = countPlayerShips(gameState, opponentId);
      break;
      
    case 'specific_ship_type':
      if (countTarget) {
        rawCount = countSpecificShipType(gameState, ownerId, countTarget, excludeSelf ? ship.id : undefined);
      }
      break;
      
    case 'ship_types':
      rawCount = countShipTypes(gameState, ownerId);
      break;
      
    case 'opponent_ship_types':
      rawCount = countShipTypes(gameState, opponentId);
      break;
      
    default:
      console.warn(`Unknown count type: ${countType}`);
      return 0;
  }
  
  return Math.floor(rawCount / countMultiplier);
}

function countPlayerShips(
  gameState: GameState,
  playerId: string,
  excludeInstanceId?: ShipInstanceId
): number {
  const ships = gameState.gameData.ships?.[playerId] || [];
  return ships.filter(ship =>
    !ship.isDestroyed &&
    !ship.isConsumedInUpgrade &&
    ship.id !== excludeInstanceId
  ).length;
}

function countSpecificShipType(
  gameState: GameState,
  playerId: string,
  shipDefId: ShipDefId,
  excludeInstanceId?: ShipInstanceId
): number {
  const ships = gameState.gameData.ships?.[playerId] || [];
  return ships.filter(ship =>
    ship.shipId === shipDefId &&
    !ship.isDestroyed &&
    !ship.isConsumedInUpgrade &&
    ship.id !== excludeInstanceId
  ).length;
}

function countShipTypes(gameState: GameState, playerId: string): number {
  const ships = gameState.gameData.ships?.[playerId] || [];
  const activeShips = ships.filter(ship => !ship.isDestroyed && !ship.isConsumedInUpgrade);
  const uniqueTypes = new Set(activeShips.map(ship => ship.shipId));
  return uniqueTypes.size;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export { resolveShipPower as default };

/**
 * Resolve multiple powers in sequence
 */
export function resolveShipPowers(
  powers: EngineShipPower[],
  context: PowerResolutionContext
): PowerResolutionResult {
  const allEffects: TriggeredEffect[] = [];
  const allWarnings: string[] = [];
  let finalStateMutations: Partial<GameState> | undefined;
  let anyRequireChoice = false;
  
  for (const power of powers) {
    const result = resolveShipPower(power, context);
    
    allEffects.push(...result.effects);
    
    if (result.stateMutations) {
      finalStateMutations = result.stateMutations;
      // Update context for next power
      context = { ...context, gameState: result.stateMutations as GameState };
    }
    
    if (result.warnings) {
      allWarnings.push(...result.warnings);
    }
    
    if (result.requiresChoice) {
      anyRequireChoice = true;
      break; // Stop at first choice requirement
    }
  }
  
  return {
    effects: allEffects,
    stateMutations: finalStateMutations,
    requiresChoice: anyRequireChoice,
    resolutionPath: 'KIND', // Mixed if multiple powers
    warnings: allWarnings.length > 0 ? allWarnings : undefined
  };
}
