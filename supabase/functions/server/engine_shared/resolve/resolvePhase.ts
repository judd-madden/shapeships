/**
 * RESOLVE PHASE
 *
 * Single entry point for shared phase resolution.
 * Orchestrates: Ship Powers → Effects → Application
 *
 * WORKFLOW:
 * 1. Collect structured powers from active ships
 * 2. Translate powers to effects for current phase
 * 3. Apply effects to game state
 * 4. Return updated state + events
 *
 * This pass implements only battle.end_of_turn_resolution.
 * Future passes will expand to other phases.
 */

import type { GameState, ShipInstance } from '../../engine/state/GameStateTypes.ts';
import { GAME_STATE_TYPES_VERSION } from '../../engine/state/GameStateTypes.ts';
import type { PhaseKey } from '../phase/PhaseTable.ts';
import type { Effect } from '../effects/Effect.ts';
import { EffectTiming, EffectKind, SurvivabilityRule } from '../effects/Effect.ts';
import { translateShipPowers, type TranslateContext } from '../effects/translateShipPowers.ts';
import { applyEffects, type EffectEvent } from '../effects/applyEffects.ts';
import { getShipDefinition } from '../defs/ShipDefinitions.withStructuredPowers.ts';
import { computePhaseComputedEffects } from './phaseComputedEffects.ts';

// ============================================================================
// RESOLVE PHASE
// ============================================================================

/**
 * Resolve a phase by processing all ship powers and applying effects
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to resolve
 * @returns Updated state and events
 */
export function resolvePhase(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolvePhase] Resolving phase: ${phaseKey}`);
  console.log(`[resolvePhase] GameStateTypes version: ${GAME_STATE_TYPES_VERSION}`);

  // Handle ships_that_build phase (create ships from ship-building powers)
  if (phaseKey === 'build.ships_that_build') {
    return resolveShipsThatBuild(state, phaseKey);
  }

  // Handle battle end-of-turn resolution (damage/heal effects)
  if (phaseKey === 'battle.end_of_turn_resolution') {
    return resolveBattleEndOfTurn(state, phaseKey);
  }

  // No resolution logic for other phases
  console.log(`[resolvePhase] No resolution logic for phase: ${phaseKey}`);
  return { state, events: [] };
}

// ============================================================================
// SHIPS THAT BUILD RESOLUTION
// ============================================================================

/**
 * Resolve the ships_that_build phase by creating ships from ship-building powers
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to resolve
 * @returns Updated state and events
 */
function resolveShipsThatBuild(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolveShipsThatBuild] Resolving phase: ${phaseKey}`);

  // Collect all effects from all ships
  const effects = collectEffectsForPhase(state, phaseKey);

  console.log(`[resolveShipsThatBuild] Collected ${effects.length} effects for ${phaseKey}`);

  // Apply effects to state
  const result = applyEffects(state, effects);

  console.log(`[resolveShipsThatBuild] Applied effects, generated ${result.events.length} events`);

  return result;
}

// ============================================================================
// BATTLE END-OF-TURN RESOLUTION
// ============================================================================

/**
 * Resolve the battle.end_of_turn_resolution phase by applying damage/heal effects
 *
 * PHASE 3.0A: Deterministic aggregation via single pipeline
 * - applyEffects() accumulates Damage/Heal into state.gameData.pendingTurn
 * - Read totals from pendingTurn (no manual aggregation)
 * - Apply health mutations simultaneously (no order dependence)
 * - Store last turn deltas for UI/debug
 * - Clear pendingTurn for next turn
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to resolve
 * @returns Updated state and events
 */
function resolveBattleEndOfTurn(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolveBattleEndOfTurn] Resolving phase: ${phaseKey}`);

  // Initialize pendingTurn if not present
  if (!state.gameData.pendingTurn) {
    state = {
      ...state,
      gameData: {
        ...state.gameData,
        pendingTurn: {
          damageByPlayerId: {},
          healByPlayerId: {},
        },
      },
    };
  }

  // Initialize powerMemory if not present
  if (!state.gameData.powerMemory) {
    state = {
      ...state,
      gameData: {
        ...state.gameData,
        powerMemory: {
          onceOnlyFired: {},
        },
      },
    };
  }

  if (!state.gameData.powerMemory.onceOnlyFired) {
    state = {
      ...state,
      gameData: {
        ...state.gameData,
        powerMemory: {
          ...state.gameData.powerMemory,
          onceOnlyFired: {},
        },
      },
    };
  }

  // Step 1: Compute all computed effects for this phase (once-only, tiered, triggers, etc.)
  const computed = computePhaseComputedEffects(state, phaseKey);
  state = computed.state;
  const computedEffects = computed.effects;

  // Step 2: Collect all effects from ship powers
  const shipEffects = collectEffectsForPhase(state, phaseKey);

  console.log(`[resolveBattleEndOfTurn] Collected ${shipEffects.length} ship effects + ${computedEffects.length} computed effects for ${phaseKey}`);

  // Step 3: Merge computed effects with ship effects
  const effects = [...computedEffects, ...shipEffects];

  // Step 4: Apply effects (accumulates Damage/Heal into pendingTurn)
  const applied = applyEffects(state, effects);

  console.log(`[resolveBattleEndOfTurn] Applied effects, generated ${applied.events.length} events`);

  // Step 5: Extract totals from pendingTurn (canonical accumulation source)
  const totals = {
    damageByPlayerId: { ...(applied.state.gameData.pendingTurn?.damageByPlayerId || {}) },
    healByPlayerId: { ...(applied.state.gameData.pendingTurn?.healByPlayerId || {}) },
  };

  console.log(`[resolveBattleEndOfTurn] Pending turn totals:`, totals);

  // Step 6: Apply aggregated health changes simultaneously
  const healthResult = applyAggregatedHealth(applied.state, totals);

  console.log(`[resolveBattleEndOfTurn] Applied aggregated health, generated ${healthResult.events.length} events`);

  // Step 7: Health clamping, victory evaluation, and terminal state
  const victoryResult = evaluateVictoryConditions(healthResult.state, [], phaseKey);

  // Step 8: Clear pendingTurn for next turn
  const clearedState = {
    ...victoryResult.state,
    gameData: {
      ...victoryResult.state.gameData,
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
      },
    },
  };

  // Combine events: accumulation events + health change events + game over event (if any)
  const allEvents = [
    ...applied.events,
    ...healthResult.events,
    ...victoryResult.events,
  ];

  return { state: clearedState, events: allEvents };
}

// ============================================================================
// AGGREGATION STAGE
// ============================================================================

/**
 * Apply aggregated health changes simultaneously to all players
 *
 * @param state - Current game state
 * @param totals - Aggregated damage/heal totals
 * @returns Updated state with health applied and events generated
 */
function applyAggregatedHealth(
  state: GameState,
  totals: { damageByPlayerId: Record<string, number>; healByPlayerId: Record<string, number> }
): { state: GameState; events: EffectEvent[] } {
  const MAX_HEALTH = 35;
  const events: EffectEvent[] = [];
  const nowMs = Date.now();

  // Clone state
  const newState: GameState = { ...state };
  newState.players = [...state.players];
  newState.gameData = { ...state.gameData };

  // Track last turn deltas
  const lastTurnDamage: Record<string, number> = {};
  const lastTurnHeal: Record<string, number> = {};
  const lastTurnNet: Record<string, number> = {};

  // Apply aggregated health changes simultaneously
  for (let i = 0; i < newState.players.length; i++) {
    const player = { ...newState.players[i] };
    const playerId = player.id;

    const damage = totals.damageByPlayerId[playerId] || 0;
    const heal = totals.healByPlayerId[playerId] || 0;

    const previousHealth = player.health;
    const rawNewHealth = previousHealth - damage + heal;
    const newHealth = Math.min(rawNewHealth, MAX_HEALTH); // Clamp to max

    player.health = newHealth;
    newState.players[i] = player;

    // Store deltas
    lastTurnDamage[playerId] = damage;
    lastTurnHeal[playerId] = heal;
    lastTurnNet[playerId] = newHealth - previousHealth;

    console.log(
      `[applyAggregatedHealth] Player ${playerId}: ${previousHealth} - ${damage} + ${heal} = ${rawNewHealth} (clamped to ${newHealth})`
    );

    // Generate event if there was a change
    if (damage > 0 || heal > 0) {
      events.push({
        type: 'EFFECT_APPLIED',
        effectId: `aggregated_${playerId}`,
        kind: 'AggregatedHealthChange',
        targetPlayerId: playerId,
        details: {
          damage,
          heal,
          previousHealth,
          newHealth,
          net: newHealth - previousHealth,
        },
        atMs: nowMs,
      });
    }
  }

  // Store last turn deltas on state
  newState.gameData = {
    ...newState.gameData,
    lastTurnDamageByPlayerId: lastTurnDamage,
    lastTurnHealByPlayerId: lastTurnHeal,
    lastTurnNetByPlayerId: lastTurnNet,
  };

  return { state: newState, events };
}

// ============================================================================
// EFFECT COLLECTION
// ============================================================================

/**
 * Collect all effects from all ships for a specific phase
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to collect effects for
 * @returns Array of effects
 */
function collectEffectsForPhase(
  state: GameState,
  phaseKey: PhaseKey
): Effect[] {
  const effects: Effect[] = [];

  // Get active players (role === 'player')
  const activePlayers = state.players.filter(p => p.role === 'player');

  if (activePlayers.length !== 2) {
    console.warn(`[collectEffectsForPhase] Expected 2 active players, found ${activePlayers.length}`);
  }

  // Determine opponent for each player
  const playerIds = activePlayers.map(p => p.id);
  const opponentMap = new Map<string, string>();

  if (playerIds.length === 2) {
    opponentMap.set(playerIds[0], playerIds[1]);
    opponentMap.set(playerIds[1], playerIds[0]);
  }

  // Process each player's fleet
  for (const player of activePlayers) {
    const playerId = player.id;
    const opponentId = opponentMap.get(playerId);

    if (!opponentId) {
      console.warn(`[collectEffectsForPhase] No opponent found for player ${playerId}`);
      continue;
    }

    // Get player's ships
    const ships = state.gameData.ships?.[playerId] || [];

    console.log(`[collectEffectsForPhase] Processing ${ships.length} ships for player ${playerId}`);

    // Process each ship
    for (const ship of ships) {
      const shipEffects = collectEffectsFromShip(
        ship,
        playerId,
        opponentId,
        phaseKey
      );

      effects.push(...shipEffects);
    }
  }

  return effects;
}

// ============================================================================
// SHIP EFFECT COLLECTION
// ============================================================================

/**
 * Collect effects from a single ship for a specific phase
 *
 * @param ship - Ship instance
 * @param ownerPlayerId - Owner player ID
 * @param opponentPlayerId - Opponent player ID
 * @param phaseKey - Phase key
 * @returns Array of effects
 */
function collectEffectsFromShip(
  ship: ShipInstance,
  ownerPlayerId: string,
  opponentPlayerId: string,
  phaseKey: PhaseKey
): Effect[] {
  // Get ship definition (joined view with structured powers)
  const shipDef = getShipDefinition(ship.shipDefId);

  if (!shipDef) {
    console.warn(`[collectEffectsFromShip] Ship definition not found: ${ship.shipDefId}`);
    return [];
  }

  // Use ship-level flattened structured powers (deterministic join output)
  const allStructuredPowers = shipDef.structuredPowers;

  if (!allStructuredPowers || allStructuredPowers.length === 0) {
    // No structured powers for this ship (expected for ships not yet implemented)
    return [];
  }

  // Create translation context
  const ctx: TranslateContext = {
    shipInstanceId: ship.instanceId,
    shipDefId: ship.shipDefId,
    ownerPlayerId,
    opponentPlayerId
  };

  // Translate structured powers to effects
  const effects = translateShipPowers(allStructuredPowers, phaseKey, ctx);

  if (effects.length > 0) {
    console.log(
      `[collectEffectsFromShip] Ship ${ship.shipDefId} (${ship.instanceId}) ` +
      `produced ${effects.length} effects for ${phaseKey}`
    );
  }

  return effects;
}

// ============================================================================
// VICTORY EVALUATION
// ============================================================================

/**
 * Evaluate victory conditions after end-of-turn resolution
 *
 * Order:
 * 1. Clamp health to [no minimum, max 35]
 * 2. Evaluate victory conditions (player health, not ship health)
 * 3. Emit GAME_OVER if terminal
 *
 * @param state - Current game state after effects
 * @param events - Events generated during effect application
 * @param phaseKey - Phase key
 * @returns Updated state and events
 */
function evaluateVictoryConditions(
  state: GameState,
  events: EffectEvent[],
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  // Only apply victory evaluation for end-of-turn resolution
  if (phaseKey !== 'battle.end_of_turn_resolution') {
    return { state, events };
  }

  // Skip if game is already finished (idempotent)
  if (state.status === 'finished') {
    return { state, events };
  }

  // Step 1: Clamp health to maximum 35 (no minimum clamp)
  let updatedState = clampPlayerHealth(state);

  // Step 2: Evaluate victory conditions
  const victoryResult = checkVictoryConditions(updatedState);

  // Step 3: If terminal, apply terminal state and emit GAME_OVER
  if (victoryResult.isTerminal) {
    updatedState = {
      ...updatedState,
      status: 'finished',
      winnerPlayerId: victoryResult.winnerPlayerId,
      result: victoryResult.result,
      resultReason: victoryResult.reason,
    };

    const gameOverEvent: any = {
      type: 'GAME_OVER',
      phaseKey,
      winnerPlayerId: victoryResult.winnerPlayerId,
      result: victoryResult.result,
      finalHealth: victoryResult.finalHealth,
    };

    console.log(
      `[Victory] Game over: ${victoryResult.result}, winner=${victoryResult.winnerPlayerId || 'null'}, ` +
      `health=${JSON.stringify(victoryResult.finalHealth)}`
    );

    return {
      state: updatedState,
      events: [...events, gameOverEvent],
    };
  }

  return { state: updatedState, events };
}

/**
 * Clamp player health to maximum of 35
 * Minimum is not clamped (negative values allowed for victory comparison)
 *
 * @param state - Current game state
 * @returns Updated state with clamped health
 */
function clampPlayerHealth(state: GameState): GameState {
  const MAX_HEALTH = 35;

  const updatedPlayers = state.players.map(player => {
    if (player.health > MAX_HEALTH) {
      return { ...player, health: MAX_HEALTH };
    }
    return player;
  });

  return {
    ...state,
    players: updatedPlayers,
  };
}

/**
 * Check victory conditions based on player health
 *
 * Rules:
 * - Decisive victory: One player health <= 0, other >= 1 (winner = survivor)
 * - Narrow victory: Both health <= 0, winner has higher health
 * - Draw: Both health <= 0 and equal
 * - No result: Game continues
 *
 * @param state - Current game state (after health clamp)
 * @returns Victory result
 */
function checkVictoryConditions(state: GameState): {
  isTerminal: boolean;
  winnerPlayerId: string | null;
  result: 'win' | 'draw';
  reason?: 'decisive' | 'narrow' | 'mutual_destruction';
  finalHealth: Record<string, number>;
} {
  // Get active players (role === 'player')
  const activePlayers = state.players.filter(p => p.role === 'player');

  if (activePlayers.length !== 2) {
    console.warn(`[checkVictoryConditions] Expected 2 active players, found ${activePlayers.length}`);
    return {
      isTerminal: false,
      winnerPlayerId: null,
      result: 'draw',
      finalHealth: {},
    };
  }

  const p1 = activePlayers[0];
  const p2 = activePlayers[1];
  const h1 = p1.health;
  const h2 = p2.health;

  const finalHealth: Record<string, number> = {
    [p1.id]: h1,
    [p2.id]: h2,
  };

  // Case 1: Decisive victory (one survivor)
  if (h1 <= 0 && h2 >= 1) {
    return {
      isTerminal: true,
      winnerPlayerId: p2.id,
      result: 'win',
      reason: 'decisive',
      finalHealth,
    };
  }

  if (h2 <= 0 && h1 >= 1) {
    return {
      isTerminal: true,
      winnerPlayerId: p1.id,
      result: 'win',
      reason: 'decisive',
      finalHealth,
    };
  }

  // Case 2: Both dead - check for narrow victory or draw
  if (h1 <= 0 && h2 <= 0) {
    if (h1 > h2) {
      // P1 has higher (less negative) health
      return {
        isTerminal: true,
        winnerPlayerId: p1.id,
        result: 'win',
        reason: 'narrow',
        finalHealth,
      };
    }

    if (h2 > h1) {
      // P2 has higher (less negative) health
      return {
        isTerminal: true,
        winnerPlayerId: p2.id,
        result: 'win',
        reason: 'narrow',
        finalHealth,
      };
    }

    // Equal health - draw
    return {
      isTerminal: true,
      winnerPlayerId: null,
      result: 'draw',
      reason: 'mutual_destruction',
      finalHealth,
    };
  }

  // Case 3: No terminal condition met - game continues
  return {
    isTerminal: false,
    winnerPlayerId: null,
    result: 'draw',
    finalHealth,
  };
}