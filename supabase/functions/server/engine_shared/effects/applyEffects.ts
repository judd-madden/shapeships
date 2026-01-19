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
 * NO game logic. NO validation. NO filtering.
 * This module assumes effects have already been validated and filtered.
 */

import type { GameState } from '../../engine/state/GameStateTypes.ts';
import type { Effect } from './Effect.ts';
import { EffectKind } from './Effect.ts';

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

  // Clone state to avoid mutation
  const newState: GameState = { ...state };

  // Clone players array (we will replace individual player objects as we mutate them)
  newState.players = [...state.players];

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
      return applyDamage(state, effect as any, nowMs);

    case EffectKind.Heal:
      return applyHeal(state, effect as any, nowMs);

    default:
      console.warn(`[applyEffects] Unhandled effect kind: ${effect.kind}`);
      return {};
  }
}

// ============================================================================
// DAMAGE APPLICATION
// ============================================================================

function applyDamage(
  state: GameState,
  effect: Effect & { kind: EffectKind.Damage; amount: number },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const amount = effect.amount;

  const playerIndex = state.players.findIndex((p) => p.id === targetPlayerId);
  if (playerIndex === -1) {
    console.warn(`[applyEffects] Target player not found: ${targetPlayerId}`);
    return {};
  }

  const player = { ...state.players[playerIndex] };

  const previousHealth = player.health;
  player.health = player.health - amount;

  state.players[playerIndex] = player;

  console.log(
    `[applyEffects] Applied ${amount} damage to ${targetPlayerId}: ${previousHealth} → ${player.health}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'Damage',
      targetPlayerId,
      details: {
        amount,
        previousHealth,
        newHealth: player.health,
      },
      atMs: nowMs,
    },
  };
}

// ============================================================================
// HEAL APPLICATION
// ============================================================================

function applyHeal(
  state: GameState,
  effect: Effect & { kind: EffectKind.Heal; amount: number },
  nowMs: number
): { event?: EffectEvent } {
  const targetPlayerId = (effect as any).target.playerId as string;
  const amount = effect.amount;

  const playerIndex = state.players.findIndex((p) => p.id === targetPlayerId);
  if (playerIndex === -1) {
    console.warn(`[applyEffects] Target player not found: ${targetPlayerId}`);
    return {};
  }

  const player = { ...state.players[playerIndex] };

  const previousHealth = player.health;
  player.health = player.health + amount;

  // TODO: Implement max health cap in future pass if needed

  state.players[playerIndex] = player;

  console.log(
    `[applyEffects] Applied ${amount} healing to ${targetPlayerId}: ${previousHealth} → ${player.health}`
  );

  return {
    event: {
      type: 'EFFECT_APPLIED',
      effectId: (effect as any).id,
      kind: 'Heal',
      targetPlayerId,
      details: {
        amount,
        previousHealth,
        newHealth: player.health,
      },
      atMs: nowMs,
    },
  };
}
