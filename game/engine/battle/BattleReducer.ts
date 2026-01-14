/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║                      🔒 LOCKED CORE MODULE 🔒                          ║
 * ║                         BATTLE REDUCER                                 ║
 * ║                      (Battle Law Encoder)                              ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 * 
 * This module encodes the FUNDAMENTAL RULES of battle resolution.
 * It is ship-agnostic and effect-agnostic (processes Effect[], not ship JSON).
 * 
 * ⚠️  MODIFICATION POLICY:
 * - Changes to this file require updates to BattleSimulation.test.ts
 * - All existing simulation tests MUST continue to pass
 * - Phase ordering and resolution logic are CORE INVARIANTS
 * - Do NOT add ship-specific logic here (belongs in ShipPowerTranslator)
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CORE INVARIANTS (DO NOT VIOLATE):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. PURITY:
 *    - resolveBattle() is a PURE FUNCTION
 *    - MUST NOT mutate previousState input
 *    - All state modifications happen on deep-copied state
 * 
 * 2. PHASE ORDER (FIXED):
 *    - FirstStrike → ChargeDeclaration → ChargeResponse → Resolution
 *    - This order is immutable and encoded in battle law
 * 
 * 3. CHARGE QUEUING MODEL:
 *    - ChargeDeclaration: Enqueues charges, NEVER applies damage/heal
 *    - ChargeResponse: Enqueues charges, NEVER applies damage/heal
 *    - Resolution: All queued charges resolve simultaneously
 *    - Queue is per-turn transient (MUST be cleared after Resolution)
 * 
 * 4. SIMULTANEITY:
 *    - All damage and healing in Resolution phase aggregate FIRST
 *    - Health changes applied AFTER aggregation (no cascading deaths)
 * 
 * 5. SURVIVABILITY RULES:
 *    - DiesWithSource: Effect removed if source ship destroyed before resolution
 *    - ResolvesIfDestroyed: Effect persists even if source ship destroyed
 * 
 * 6. QUEUE LIFECYCLE:
 *    - queuedEffects MUST be empty at start of each battle
 *    - queuedEffects MUST be cleared after materialization into Resolution
 *    - Failure to clear = non-deterministic multi-turn behavior (BUG)
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * INPUT:  previousBattleState (immutable), Effect[] (immutable)
 * OUTPUT: BattleResult (new state, healthDeltas, destroyedShips, victory)
 * 
 * VALIDATION: All changes must pass BattleSimulation.test.ts harness
 */

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * PUBLIC INVARIANTS (BattleReducer Contract)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * BattleReducer is "battle law": it executes canonical Effects against BattleState.
 * It does NOT interpret ship rules text, and does NOT generate effects.
 *
 * INPUTS:
 * - previousState: BattleState (must be treated as immutable by callers)
 * - effects: Effect[] (canonical, validated upstream as needed)
 *
 * OUTPUTS:
 * - BattleResult with updated state, destroyedShips, healthDeltas, battleLog, optional victory
 *
 * CORE INVARIANTS:
 * 1) Phase order is fixed:
 *    FirstStrike → ChargeDeclaration → ChargeResponse → Resolution → VictoryCheck
 *
 * 2) Destroy effects resolve before damage/heal in a given phase.
 *
 * 3) Survivability rules:
 *    - Effects with source.type === 'system' always resolve.
 *    - If source ship is destroyed:
 *        - survivability === ResolvesIfDestroyed → may resolve (subject to other rules)
 *        - survivability === DiesWithSource → must NOT resolve
 *
 * 4) Charge legality:
 *    - ChargeDeclaration/ChargeResponse may queue charge effects ONLY if the source ship exists
 *      at the time of that phase (a ship destroyed in FirstStrike cannot declare a charge).
 *
 * 5) Resolution applies damage/heal simultaneously per player:
 *    netChange = heal - damage
 *    clamp to maxHealth, allow negative health (for Narrow Victory)
 *
 * 6) Queued charge effects are cleared after Resolution is executed.
 *
 * DETERMINISM EXPECTATIONS:
 * - For identical (state, effects), output must be deterministic.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { Effect, BattlePhase, SurvivabilityRule } from '../effects/Effect.ts';
import { EffectKind } from '../effects/Effect.ts';

// ============================================================================
// TYPES
// ============================================================================

export type BattleState = {
  players: {
    [playerId: string]: {
      health: number;
      maxHealth: number;
      ships: ShipBattleInstance[];
    };
  };
  destroyedShips: string[]; // instanceIds
  queuedEffects: Effect[]; // Canonical effects queued for Resolution
  turnNumber: number;
};

export type ShipBattleInstance = {
  instanceId: string;
  shipDefId: string;
  ownerPlayerId: string;
  chargesCurrent?: number;
  chargesMax?: number;
};

export type HealthDelta = {
  playerId: string;
  change: number; // negative = damage, positive = heal
  finalHealth: number;
};

export type BattleLogEntry = {
  phase: BattlePhase;
  message: string;
  effectId?: string;
  timestamp: number;
};

export type BattleResult = {
  state: BattleState;
  destroyedShips: string[]; // instanceIds destroyed this resolution
  healthDeltas: HealthDelta[];
  battleLog: BattleLogEntry[];
  victory?: {
    winnerId: string;
    reason: string;
  };
};

// ============================================================================
// DEV ASSERTIONS (NON-THROWING)
// ============================================================================

/**
 * Dev-only assertion helper for invariant validation.
 * Logs warnings instead of throwing to avoid crashing production.
 */
function devAssert(condition: boolean, message: string): void {
  if (!condition) {
    console.warn(`[BattleReducer] INVARIANT VIOLATION: ${message}`);
  }
}

// ============================================================================
// MAIN REDUCER
// ============================================================================

export function resolveBattle(
  previousState: BattleState,
  effects: Effect[],
  nowMs: number
): BattleResult {
  // IMPORTANT: Reducer must never mutate previousState (pure function)
  // All modifications happen on deep-copied state
  let state = { ...previousState };
  const destroyedThisBattle: string[] = [];
  const healthDeltas: HealthDelta[] = [];
  const battleLog: BattleLogEntry[] = [];

  // Deep copy players to avoid mutation
  state.players = Object.fromEntries(
    Object.entries(previousState.players).map(([id, player]) => [
      id,
      {
        ...player,
        ships: [...player.ships]
      }
    ])
  );
  
  // Deep copy all mutable arrays to prevent input mutation
  state.destroyedShips = [...previousState.destroyedShips];
  state.queuedEffects = [...previousState.queuedEffects.map(e => ({
    ...e,
    source: { ...e.source },
    target: { ...e.target }
  }))];
  
  // Clear queue at start to avoid stale state from previous battles
  state.queuedEffects = [];
  
  // Dev assertion: Validate queue structure
  devAssert(Array.isArray(state.queuedEffects), 'queuedEffects must be an array');

  // ============================================================================
  // PHASE 1: FIRST STRIKE
  // ============================================================================

  const firstStrikeEffects = effects.filter(e => e.phase === 'FirstStrike');
  
  battleLog.push({
    phase: 'FirstStrike',
    message: `First Strike Phase: ${firstStrikeEffects.length} effects`,
    timestamp: nowMs
  });

  const firstStrikeResult = resolvePhase(
    state,
    firstStrikeEffects,
    'FirstStrike',
    nowMs
  );

  state = firstStrikeResult.state;
  destroyedThisBattle.push(...firstStrikeResult.destroyedShips);
  healthDeltas.push(...firstStrikeResult.healthDeltas);
  battleLog.push(...firstStrikeResult.battleLog);

  // ============================================================================
  // PHASE 2: CHARGE DECLARATION
  // ============================================================================

  const chargeDeclarationEffects = effects.filter(e => e.phase === 'ChargeDeclaration');
  
  battleLog.push({
    phase: 'ChargeDeclaration',
    message: `Charge Declaration Phase: ${chargeDeclarationEffects.length} effects`,
    timestamp: nowMs
  });

  const chargeDeclarationResult = processChargeDeclaration(
    state,
    chargeDeclarationEffects,
    nowMs
  );

  state = chargeDeclarationResult.state;
  battleLog.push(...chargeDeclarationResult.battleLog);

  // ============================================================================
  // PHASE 3: CHARGE RESPONSE
  // ============================================================================

  const chargeResponseEffects = effects.filter(e => e.phase === 'ChargeResponse');
  
  battleLog.push({
    phase: 'ChargeResponse',
    message: `Charge Response Phase: ${chargeResponseEffects.length} effects`,
    timestamp: nowMs
  });

  const chargeResponseResult = processChargeResponse(
    state,
    chargeResponseEffects,
    nowMs
  );

  state = chargeResponseResult.state;
  battleLog.push(...chargeResponseResult.battleLog);

  // ============================================================================
  // PHASE 4: RESOLUTION (SIMULTANEOUS)
  // ============================================================================

  const resolutionEffects = effects.filter(e => e.phase === 'Resolution');
  
  // Queue is per-turn transient; MUST be cleared after materialization
  // Inject queued charges into Resolution
  const queuedResolutionEffects: Effect[] = state.queuedEffects.map(qc => ({
    ...qc,
    phase: 'Resolution' as BattlePhase  // Override phase to Resolution
  }));
  
  const allResolutionEffects = [...resolutionEffects, ...queuedResolutionEffects];
  
  battleLog.push({
    phase: 'Resolution',
    message: `Resolution Phase: ${resolutionEffects.length} effects + ${queuedResolutionEffects.length} queued charges`,
    timestamp: nowMs
  });

  const resolutionResult = resolvePhase(
    state,
    allResolutionEffects,
    'Resolution',
    nowMs
  );

  state = resolutionResult.state;
  destroyedThisBattle.push(...resolutionResult.destroyedShips);
  healthDeltas.push(...resolutionResult.healthDeltas);
  battleLog.push(...resolutionResult.battleLog);
  
  // Clear queued charges after Resolution (prevent carry-over into next turn)
  state.queuedEffects = [];
  
  // Dev assertion: Validate queue cleared
  devAssert(state.queuedEffects.length === 0, 'queuedEffects must be empty after Resolution');

  // ============================================================================
  // VICTORY CHECK
  // ============================================================================

  const victory = checkVictory(state);

  return {
    state,
    destroyedShips: destroyedThisBattle,
    healthDeltas,
    battleLog,
    victory
  };
}

// ============================================================================
// PHASE RESOLUTION (First Strike & Resolution)
// ============================================================================

type PhaseResult = {
  state: BattleState;
  destroyedShips: string[];
  healthDeltas: HealthDelta[];
  battleLog: BattleLogEntry[];
};

function resolvePhase(
  state: BattleState,
  effects: Effect[],
  phase: BattlePhase,
  nowMs: number
): PhaseResult {
  const destroyedShips: string[] = [];
  const healthDeltas: HealthDelta[] = [];
  const battleLog: BattleLogEntry[] = [];

  // Apply survivability rules: filter out effects from destroyed sources
  const viableEffects = applySurvivabilityRules(state, effects);

  // Step 1: Apply Destroy effects first
  const destroyEffects = viableEffects.filter(e => e.kind === EffectKind.Destroy);
  
  for (const effect of destroyEffects) {
    const destroyed = applyDestroyEffect(state, effect, nowMs);
    if (destroyed) {
      destroyedShips.push(destroyed.instanceId);
      battleLog.push({
        phase,
        message: `Ship ${destroyed.instanceId} destroyed`,
        effectId: effect.id,
        timestamp: nowMs
      });
    }
  }

  // Step 2: Aggregate damage and healing
  const damageEffects = viableEffects.filter(e => e.kind === EffectKind.Damage);
  const healEffects = viableEffects.filter(e => e.kind === EffectKind.Heal);

  const damageTotals = aggregateDamage(damageEffects);
  const healTotals = aggregateHealing(healEffects);

  // Step 3: Apply simultaneous health changes ONLY for affected players
  const affectedPlayers = new Set<string>([
    ...Object.keys(damageTotals),
    ...Object.keys(healTotals)
  ]);

  for (const playerId of affectedPlayers) {
    const player = state.players[playerId];
    if (!player) continue;

    const damage = damageTotals[playerId] || 0;
    const heal = healTotals[playerId] || 0;

    // Defensive: skip if no actual effect
    if (damage === 0 && heal === 0) continue;

    const netChange = heal - damage;

    const oldHealth = player.health;
    // Allow negative health (for Narrow Victory), clamp to maxHealth only
    player.health = Math.min(player.maxHealth, player.health + netChange);

    // Only record delta if health actually changed
    if (netChange !== 0) {
      healthDeltas.push({
        playerId,
        change: player.health - oldHealth,
        finalHealth: player.health
      });
    }

    // Only log if there was damage or healing
    if (damage !== 0 || heal !== 0) {
      battleLog.push({
        phase,
        message: `Player ${playerId}: ${damage} damage, ${heal} healing, net ${netChange}`,
        timestamp: nowMs
      });
    }
  }

  // Step 4: Process other effect kinds
  const otherEffects = viableEffects.filter(
    e => e.kind !== EffectKind.Destroy && e.kind !== EffectKind.Damage && e.kind !== EffectKind.Heal
  );

  for (const effect of otherEffects) {
    processOtherEffect(state, effect, battleLog, phase, nowMs);
  }

  return {
    state,
    destroyedShips,
    healthDeltas,
    battleLog
  };
}

// ============================================================================
// CHARGE DECLARATION PROCESSING
// ============================================================================

type ChargeResult = {
  state: BattleState;
  battleLog: BattleLogEntry[];
};

function processChargeDeclaration(
  state: BattleState,
  effects: Effect[],
  nowMs: number
): ChargeResult {
  const battleLog: BattleLogEntry[] = [];
  state.queuedEffects = state.queuedEffects || [];

  for (const effect of effects) {
    if (effect.timing === 'Charge') {
      // Validate source ship is still alive
      if (!isChargeSourceAlive(state, effect)) {
        battleLog.push({
          phase: 'ChargeDeclaration',
          message: `Charge declaration blocked: source ship ${effect.source.instanceId} destroyed`,
          effectId: effect.id,
          timestamp: nowMs
        });
        continue;
      }

      // Queue the charge effect for Resolution (do not apply damage/heal here)
      state.queuedEffects.push(effect);

      battleLog.push({
        phase: 'ChargeDeclaration',
        message: `Charge declared: ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
    }
  }

  return { state, battleLog };
}

// ============================================================================
// CHARGE RESPONSE PROCESSING
// ============================================================================

function processChargeResponse(
  state: BattleState,
  effects: Effect[],
  nowMs: number
): ChargeResult {
  const battleLog: BattleLogEntry[] = [];
  state.queuedEffects = state.queuedEffects || [];

  for (const effect of effects) {
    if (effect.timing === 'Charge') {
      // Validate source ship is still alive
      if (!isChargeSourceAlive(state, effect)) {
        battleLog.push({
          phase: 'ChargeResponse',
          message: `Charge response blocked: source ship ${effect.source.instanceId} destroyed`,
          effectId: effect.id,
          timestamp: nowMs
        });
        continue;
      }

      // Queue the charge effect for Resolution (do not apply damage/heal here)
      state.queuedEffects.push(effect);

      battleLog.push({
        phase: 'ChargeResponse',
        message: `Charge response declared: ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
    }
  }

  return { state, battleLog };
}

// ============================================================================
// SURVIVABILITY RULES
// ============================================================================

/**
 * Validates that a charge effect's source ship is still alive and present.
 * 
 * CHARGE DECLARATION RULE:
 * A ship can only declare/respond with charges if it is CURRENTLY ALIVE.
 * - If destroyed in FirstStrike, it cannot declare in ChargeDeclaration
 * - If destroyed in ChargeDeclaration, it cannot respond in ChargeResponse
 * 
 * This is separate from SurvivabilityRule.ResolvesIfDestroyed, which applies
 * to effects that were ALREADY VALIDLY DECLARED before the source was destroyed.
 * 
 * @returns true if source is alive (can queue), false if blocked
 */
function isChargeSourceAlive(state: BattleState, effect: Effect): boolean {
  // System sources always allowed
  if (effect.source.type === 'system') {
    return true;
  }
  
  // Ship sources: must be alive and in fleet
  if (effect.source.type === 'ship') {
    const shipId = effect.source.instanceId;
    const ownerPlayerId = effect.ownerPlayerId;
    
    // Check if ship is in destroyedShips list
    if (state.destroyedShips.includes(shipId)) {
      return false;
    }
    
    // Check if ship still exists in owner's fleet (authoritative)
    const player = state.players[ownerPlayerId];
    if (!player) {
      return false;
    }
    
    const shipExists = player.ships.some(s => s.instanceId === shipId);
    return shipExists;
  }
  
  // Unknown source type: allow (defensive)
  return true;
}

function applySurvivabilityRules(
  state: BattleState,
  effects: Effect[]
): Effect[] {
  return effects.filter(effect => {
    // System sources always survive
    if (effect.source.type === 'system') {
      return true;
    }

    // Ship sources: check if destroyed
    const sourceShipId = effect.source.instanceId;
    const isDestroyed = state.destroyedShips.includes(sourceShipId);

    if (!isDestroyed) {
      return true;
    }

    // If destroyed, check survivability rule
    if (effect.survivability === 'ResolvesIfDestroyed') {
      return true;
    }

    // DiesWithSource: filter out
    return false;
  });
}

// ============================================================================
// DESTROY EFFECT
// ============================================================================

function applyDestroyEffect(
  state: BattleState,
  effect: Effect,
  nowMs: number
): ShipBattleInstance | null {
  const targetPlayerId = effect.target.playerId;
  const targetShipId = effect.target.shipInstanceId;

  if (!targetShipId) {
    // Cannot destroy without target ship
    return null;
  }

  const player = state.players[targetPlayerId];
  if (!player) {
    return null;
  }

  const shipIndex = player.ships.findIndex(s => s.instanceId === targetShipId);
  if (shipIndex < 0) {
    return null;
  }

  const ship = player.ships[shipIndex];

  // Remove from player's fleet
  player.ships.splice(shipIndex, 1);

  // Add to destroyed list
  state.destroyedShips.push(targetShipId);

  return ship;
}

// ============================================================================
// DAMAGE AGGREGATION
// ============================================================================

function aggregateDamage(effects: Effect[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const effect of effects) {
    const playerId = effect.target.playerId;
    const magnitude = effect.magnitude ?? 0;

    totals[playerId] = (totals[playerId] || 0) + magnitude;
  }

  return totals;
}

// ============================================================================
// HEALING AGGREGATION
// ============================================================================

function aggregateHealing(effects: Effect[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const effect of effects) {
    const playerId = effect.target.playerId;
    const magnitude = effect.magnitude ?? 0;

    totals[playerId] = (totals[playerId] || 0) + magnitude;
  }

  return totals;
}

// ============================================================================
// OTHER EFFECTS
// ============================================================================

function processOtherEffect(
  state: BattleState,
  effect: Effect,
  battleLog: BattleLogEntry[],
  phase: BattlePhase,
  nowMs: number
): void {
  switch (effect.kind) {
    case EffectKind.CreateShip:
      // TODO: Create ship instance and add to fleet
      battleLog.push({
        phase,
        message: `TODO: Create ship from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    case EffectKind.GainEnergy:
      // TODO: Add energy to player
      battleLog.push({
        phase,
        message: `TODO: Gain energy from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    case EffectKind.GainLines:
      // TODO: Add lines to player
      battleLog.push({
        phase,
        message: `TODO: Gain lines from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    case EffectKind.ModifyDamage:
      // TODO: Apply damage modifier (requires damage calculation context)
      battleLog.push({
        phase,
        message: `TODO: Modify damage from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    case EffectKind.ModifyHeal:
      // TODO: Apply heal modifier (requires healing calculation context)
      battleLog.push({
        phase,
        message: `TODO: Modify heal from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    case EffectKind.Shield:
      // TODO: Apply shield (requires shield state tracking)
      battleLog.push({
        phase,
        message: `TODO: Apply shield from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    case EffectKind.Redirect:
      // TODO: Redirect damage (requires damage routing logic)
      battleLog.push({
        phase,
        message: `TODO: Redirect from effect ${effect.id}`,
        effectId: effect.id,
        timestamp: nowMs
      });
      break;

    default:
      // Exhaustiveness check
      const _exhaustive: never = effect.kind;
      break;
  }
}

// ============================================================================
// VICTORY CHECK
// ============================================================================

function checkVictory(state: BattleState): { winnerId: string; reason: string } | undefined {
  const playerIds = Object.keys(state.players);

  // Decisive Victory: exactly one player has health >= 1
  const alivePlayers = playerIds.filter(id => state.players[id].health >= 1);

  if (alivePlayers.length === 1) {
    return {
      winnerId: alivePlayers[0],
      reason: 'Decisive victory'
    };
  }

  // Narrow Victory: all players have health <= 0, winner is player with highest health (least negative)
  if (alivePlayers.length === 0) {
    const playerHealths = playerIds.map(id => ({
      playerId: id,
      health: state.players[id].health
    }));

    // Sort by health descending (highest first, least negative wins)
    playerHealths.sort((a, b) => b.health - a.health);

    // Check if there's a unique winner (no tie)
    if (playerHealths.length >= 2 && playerHealths[0].health === playerHealths[1].health) {
      // Tie for highest health - draw
      return undefined;
    }

    // Winner is player with highest health (least negative)
    return {
      winnerId: playerHealths[0].playerId,
      reason: 'Narrow victory'
    };
  }

  // No victory yet (multiple players alive)
  return undefined;
}