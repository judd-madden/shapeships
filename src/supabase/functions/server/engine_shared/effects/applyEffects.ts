/**
 * APPLY EFFECTS
 *
 * Pure applier that applies effects to game state.
 *
 * RULES:
 * - Return new state object (avoid in-place mutation where practical)
 * - Only implement effects needed for current pass (Damage, Heal)
 * - Future passes will expand to CreateShip, Destroy, etc.
 *
 * PHASE 3.0A: Health mutation boundary enforced
 * - Damage/Heal effects MUST NOT mutate health directly
 * - They accumulate into state.gameData.pendingTurn instead
 * - Health is only mutated during battle.end_of_turn_resolution aggregation
 *
 * NO game logic. NO validation. NO filtering.
 * This module assumes effects have already been validated and filtered.
 */

import type { GameState } from '../../engine/state/GameStateTypes.ts';
import type { Effect } from './Effect.ts';
import { EffectKind } from './Effect.ts';
import { getShipById } from '../defs/ShipDefinitions.core.ts';
import type { ShipInstance } from '../../engine/state/GameStateTypes.ts';
import {
  getSacSpawnCountForShipDef,
  isOpponentDestroyBlockedBySacProtection,
} from '../resolve/destroyRules.ts';

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EffectEvent = {
  type: 'EFFECT_APPLIED';
  effectId: string;
  kind: string;
  targetPlayerId: string;
  details: any;
  atMs: number;
};

// ============================================================================
// MAIN APPLIER
// ============================================================================

/**
 * Apply effects to game state
 *
 * @param state - Current game state
 * @param effects - Array of effects to apply
 * @returns Updated state and generated events
 */
export function applyEffects(
  state: GameState,
  effects: Effect[]
): { state: GameState; events: EffectEvent[] } {
  const events: EffectEvent[] = [];
  const nowMs = Date.now();

  // Clone state to avoid mutation (HARDENED IMMUTABILITY)
  const newState: GameState = { ...state };

  // Clone players array (we will replace individual player objects as we mutate them)
  newState.players = [...state.players];

  // Clone gameData object (required to avoid mutating input state)
  newState.gameData = { ...state.gameData };

  // Normalize legacy ships container → canonical gameData.ships
  const legacyShips = (state as any).ships as Record<string, any[]> | undefined;

  if (!newState.gameData.ships && legacyShips) {
    newState.gameData.ships = { ...legacyShips };
  }

  // Clone ships container if it exists (required for CreateShip/Destroy/SpendCharge)
  if (newState.gameData.ships) {
    newState.gameData.ships = { ...newState.gameData.ships };
  }

  // Maintain legacy alias for any code paths still reading state.ships
  (newState as any).ships = newState.gameData.ships;

  // Ensure pendingTurn exists AND clone its maps
  if (state.gameData.pendingTurn) {
    // Clone the object and both maps
    newState.gameData.pendingTurn = {
      damageByPlayerId: { ...state.gameData.pendingTurn.damageByPlayerId },
      healByPlayerId: { ...state.gameData.pendingTurn.healByPlayerId },
    };
  } else {
    // Create fresh structure
    newState.gameData.pendingTurn = {
      damageByPlayerId: {},
      healByPlayerId: {},
    };
  }

  for (const effect of effects) {
    const result = applySingleEffect(newState, effect, nowMs);
    if (result.event) events.push(result.event);
  }

  return { state: newState, events };
}

// ============================================================================
// SINGLE EFFECT APPLICATION
// ============================================================================

/**
 * Apply a single effect to state
 *
 * @param state - Game state (will be mutated)
 * @param effect - Effect to apply
 * @param nowMs - Current timestamp
 * @returns Event (if applicable)
 */
function applySingleEffect(
  state: GameState,
  effect: Effect,
  nowMs: number
): { event?: EffectEvent } {
  // SAFETY: Ensure translator produced a target playerId
  // (We do not throw; we skip and warn to preserve server stability.)
  const targetPlayerId = (effect as any)?.target?.playerId as string | undefined;

  if (!targetPlayerId) {
    console.warn(
      `[applyEffects] Skipping effect missing target.playerId: ` +
      `id=${(effect as any)?.id ?? '(missing)'} kind=${(effect as any)?.kind ?? '(missing)'}`
    );
    return {};
  }

  switch (effect.kind) {
    case EffectKind.Damage:
      return accumulateDamage(state, effect as any, nowMs);

    case EffectKind.Heal:
      return accumulateHeal(state, effect as any, nowMs);

    case EffectKind.GainLines:
      return applyGainLines(state, effect as any, nowMs);

    case EffectKind.CreateShip:
      return applyCreateShip(state, effect as any, nowMs);

    case EffectKind.Destroy:
      return applyDestroyShip(state, effect as any, nowMs);

    case EffectKind.SpendCharge:
      return applySpendCharge(state, effect as any, nowMs);

    default:
      console.warn(`[applyEffects] Unhandled effect kind: ${effect.kind}`);
      return {};
  }
}

// ============================================================================
// DAMAGE ACCUMULATION (PHASE 3.0A)
// ============================================================================

function accumulateDamage(
  state: GameState,
  effect: Effect & { kind: EffectKind.Damage; amount: number },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const amount = effect.amount;

  // Accumulate damage into pendingTurn (DO NOT mutate health)
  const currentDamage = state.gameData.pendingTurn!.damageByPlayerId[targetPlayerId] || 0;
  state.gameData.pendingTurn!.damageByPlayerId[targetPlayerId] = currentDamage + amount;

  console.log(
    `[applyEffects] Accumulated ${amount} damage for ${targetPlayerId}: ${currentDamage} → ${currentDamage + amount}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'Damage',
      targetPlayerId,
      details: {
        amount,
        accumulated: currentDamage + amount,
      },
      atMs: nowMs,
    },
  };
}

// ============================================================================
// HEAL ACCUMULATION (PHASE 3.0A)
// ============================================================================

function accumulateHeal(
  state: GameState,
  effect: Effect & { kind: EffectKind.Heal; amount: number },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const amount = effect.amount;

  // Accumulate heal into pendingTurn (DO NOT mutate health)
  const currentHeal = state.gameData.pendingTurn!.healByPlayerId[targetPlayerId] || 0;
  state.gameData.pendingTurn!.healByPlayerId[targetPlayerId] = currentHeal + amount;

  console.log(
    `[applyEffects] Accumulated ${amount} heal for ${targetPlayerId}: ${currentHeal} → ${currentHeal + amount}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'Heal',
      targetPlayerId,
      details: {
        amount,
        accumulated: currentHeal + amount,
      },
      atMs: nowMs,
    },
  };
}

// ============================================================================
// GAIN LINES
// ============================================================================

function applyGainLines(
  state: GameState,
  effect: Effect & { kind: EffectKind.GainLines; amount: number },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const amount = effect.amount;

  // Find the player and update their lines
  const playerIndex = state.players.findIndex((p) => p.id === targetPlayerId);
  if (playerIndex === -1) {
    console.warn(`[applyEffects] Player not found for GainLines effect: ${targetPlayerId}`);
    return {};
  }

  const beforeLines = state.players[playerIndex].lines ?? 0;
  const afterLines = beforeLines + amount;
  
  // Update player lines (mutate in place since we cloned the array)
  state.players[playerIndex] = {
    ...state.players[playerIndex],
    lines: afterLines
  };

  console.log(
    `[applyEffects] Player ${targetPlayerId} gained ${amount} lines: ${beforeLines} → ${afterLines}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'GainLines',
      targetPlayerId,
      details: {
        amount,
        before: beforeLines,
        after: afterLines,
      },
      atMs: nowMs,
    },
  };
}

// ============================================================================
// CREATE SHIP
// ============================================================================

function appendShipToFleet(
  state: GameState,
  targetPlayerId: string,
  shipDefId: string
): ShipInstance {
  if (!state.gameData.ships) {
    state.gameData.ships = {};
  }

  const currentFleet = state.gameData.ships[targetPlayerId] ?? [];
  const newShip: ShipInstance = {
    instanceId: crypto.randomUUID(),
    shipDefId,
    createdTurn: state.gameData.turnNumber
  };

  let shipDef;
  try {
    shipDef = getShipById(shipDefId);
  } catch (err) {
    console.warn(`[applyEffects] Error loading ship definition for CreateShip: ${shipDefId}`, err);
  }

  if (shipDef && typeof shipDef.charges === 'number' && shipDef.charges > 0) {
    newShip.chargesCurrent = shipDef.charges;
  }

  if (!shipDef) {
    console.warn(`[applyEffects] Ship definition not found for CreateShip: ${shipDefId} (creating instance anyway)`);
  }

  state.gameData.ships[targetPlayerId] = [...currentFleet, newShip];
  return newShip;
}

function incrementShipsMadeThisBuildPhaseCounter(
  state: GameState,
  playerId: string,
  amount: number
) {
  if (!Number.isInteger(amount) || amount <= 0) return;

  if (!state.gameData.turnData) {
    state.gameData.turnData = {};
  }

  const currentMap = state.gameData.turnData.shipsMadeThisBuildPhaseByPlayerId || {};
  const currentCount = currentMap[playerId] || 0;
  state.gameData.turnData.shipsMadeThisBuildPhaseByPlayerId = {
    ...currentMap,
    [playerId]: currentCount + amount,
  };
}

function applyCreateShip(
  state: GameState,
  effect: Effect & { kind: EffectKind.CreateShip; shipDefId: string },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const shipDefId = (effect as any).shipDefId as string;
  const newShip = appendShipToFleet(state, targetPlayerId, shipDefId);

  console.log(
    `[applyEffects] Created ship ${shipDefId} (${newShip.instanceId}) for ${targetPlayerId} with ${newShip.chargesCurrent ?? 'no'} charges`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'CreateShip',
      targetPlayerId,
      details: {
        shipDefId,
        instanceId: newShip.instanceId,
        createdTurn: state.gameData.turnNumber,
        chargesCurrent: newShip.chargesCurrent,
      },
      atMs: nowMs,
    },
  };
}

// ============================================================================
// DESTROY SHIP
// ============================================================================

function applyDestroyShip(
  state: GameState,
  effect: Effect & { kind: EffectKind.Destroy },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const shipInstanceId = (effect as any).target.shipInstanceId as string | undefined;
  const sourcePlayerId = (effect as any).ownerPlayerId as string;

  // Must have explicit target
  if (!shipInstanceId) {
    console.warn(`[applyEffects] Skipping Destroy effect without target.shipInstanceId`);
    return {};
  }

  if (isOpponentDestroyBlockedBySacProtection(state, sourcePlayerId, targetPlayerId)) {
    console.log(
      `[applyEffects] Blocked opponent destroy effect against SAC-protected fleet: source=${sourcePlayerId} target=${targetPlayerId}`
    );
    return {};
  }

  // Get current fleet
  const currentFleet = state.gameData.ships?.[targetPlayerId];
  if (!currentFleet) {
    console.warn(`[applyEffects] Fleet not found for Destroy effect: ${targetPlayerId}`);
    return {};
  }

  const beforeCount = currentFleet.length;
  const shipIndex = currentFleet.findIndex((s) => s.instanceId === shipInstanceId);
  
  if (shipIndex === -1) {
    console.warn(`[applyEffects] Ship instance not found for Destroy effect: ${shipInstanceId}`);
    return {};
  }

  const destroyedShip = currentFleet[shipIndex];

  // Create NEW fleet array without the destroyed ship (never mutate existing)
  const newFleet = [
    ...currentFleet.slice(0, shipIndex),
    ...currentFleet.slice(shipIndex + 1)
  ];
  
  state.gameData.ships![targetPlayerId] = newFleet;
  let afterCount = newFleet.length;

  const voidShips = state.gameData.voidShipsByPlayerId ?? (state.gameData.voidShipsByPlayerId = {});
  const currentVoid = voidShips[targetPlayerId] ?? [];
  voidShips[targetPlayerId] = [...currentVoid, destroyedShip];
  let createdShipsFromDestroy = 0;

  if (destroyedShip.shipDefId === 'ZEN') {
    appendShipToFleet(state, targetPlayerId, 'XEN');
    appendShipToFleet(state, targetPlayerId, 'XEN');
    createdShipsFromDestroy += 2;

    if (typeof effect.timing === 'string' && effect.timing.startsWith('build.')) {
      incrementShipsMadeThisBuildPhaseCounter(state, targetPlayerId, 2);
    }
  }

  const destroySourceShipDefId =
    (effect as any).source?.type === 'ship'
      ? (effect as any).source.shipDefId as string | undefined
      : undefined;

  if (destroySourceShipDefId === 'SAC' && sourcePlayerId === targetPlayerId) {
    const sacSpawnCount = getSacSpawnCountForShipDef(destroyedShip.shipDefId);

    for (let i = 0; i < sacSpawnCount; i++) {
      appendShipToFleet(state, targetPlayerId, 'XEN');
    }

    createdShipsFromDestroy += sacSpawnCount;

    if (typeof effect.timing === 'string' && effect.timing.startsWith('build.')) {
      incrementShipsMadeThisBuildPhaseCounter(state, targetPlayerId, sacSpawnCount);
    }
  }

  if (createdShipsFromDestroy > 0) {
    afterCount = state.gameData.ships?.[targetPlayerId]?.length ?? afterCount;
  }

  console.log(
    `[applyEffects] Destroyed ship ${shipInstanceId} for ${targetPlayerId}: ${beforeCount} → ${afterCount}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'DestroyShip',
      targetPlayerId,
      details: {
        shipInstanceId,
        beforeCount,
        afterCount,
        createdShipsFromDestroy,
      },
      atMs: nowMs,
    },
  };
}

// ============================================================================
// SPEND CHARGE
// ============================================================================

function applySpendCharge(
  state: GameState,
  effect: Effect & { kind: EffectKind.SpendCharge; amount: number },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const ownerPlayerId = (effect as any).ownerPlayerId as string;
  const amount = (effect as any).amount as number;

  // Determine ship instance ID
  let shipInstanceId: string | undefined;
  
  if ((effect as any).source?.type === 'ship') {
    shipInstanceId = (effect as any).source.instanceId;
  } else if ((effect as any).target?.shipInstanceId) {
    shipInstanceId = (effect as any).target.shipInstanceId;
  }

  if (!shipInstanceId) {
    console.warn(`[applyEffects] Skipping SpendCharge effect without ship instance ID`);
    return {};
  }

  // Find fleet (try owner first, then target) and track which playerId we're using
  let currentFleet = state.gameData.ships?.[ownerPlayerId];
  let fleetPlayerId = ownerPlayerId;
  
  if (!currentFleet) {
    currentFleet = state.gameData.ships?.[targetPlayerId];
    fleetPlayerId = targetPlayerId;
  }

  if (!currentFleet) {
    console.warn(`[applyEffects] Fleet not found for SpendCharge effect`);
    return {};
  }

  // Find ship instance
  const shipIndex = currentFleet.findIndex((s) => s.instanceId === shipInstanceId);
  if (shipIndex === -1) {
    console.warn(`[applyEffects] Ship instance not found for SpendCharge effect: ${shipInstanceId}`);
    return {};
  }

  const ship = currentFleet[shipIndex];

  // Compute new charge value (treat missing as 0, clamp at 0)
  const beforeCharges = ship.chargesCurrent ?? 0;
  const afterCharges = Math.max(0, beforeCharges - amount);

  // Create updated ship object (never mutate existing)
  const updatedShip: ShipInstance = {
    ...ship,
    chargesCurrent: afterCharges
  };

  // Create NEW fleet array with updated ship
  const newFleet = [...currentFleet];
  newFleet[shipIndex] = updatedShip;

  // Assign new fleet back to ships map
  state.gameData.ships![fleetPlayerId] = newFleet;

  console.log(
    `[applyEffects] Ship ${shipInstanceId} spent ${amount} charge(s): ${beforeCharges} → ${afterCharges}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'SpendCharge',
      targetPlayerId,
      details: {
        shipInstanceId,
        amount,
        before: beforeCharges,
        after: afterCharges,
      },
      atMs: nowMs,
    },
  };
}
