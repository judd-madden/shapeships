/**
 * GENERIC POWER ACTION RESOLVER
 *
 * Data-driven resolver for structured type:'choice' powers.
 *
 * Responsibilities:
 * - Parse { actionId, sourceInstanceId, choiceId }
 * - Validate timing, ownership, charges
 * - Translate chosen option -> Effects
 * - Apply via applyEffects
 * - Return outcome { state, events, spentCharge }
 *
 * NO ship-specific logic - all specificity in structured power data.
 */

import type { GameState, ShipInstance } from '../../engine/state/GameStateTypes.ts';
import type { PhaseKey } from '../phase/PhaseTable.ts';
import { applyEffects, type EffectEvent } from '../effects/applyEffects.ts';
import { Effect, EffectKind } from '../effects/Effect.ts';
import { getShipDefinition } from '../defs/ShipDefinitions.withStructuredPowers.ts';
import {
  translateChoiceOptionEffects,
  type StructuredShipPower,
  type StructuredChoiceOption,
  type TranslateContext,
} from '../effects/translateShipPowers.ts';
import { getValidDestroyTargets } from './destroyRules.ts';
import { countDistinctTypes } from './phaseComputedEffects.ts';

function shouldApplyOpponentSacProtectionForTargetedEffect(effect: StructuredChoiceOption['effects'][number]): boolean {
  return effect.kind !== EffectKind.TransferShip;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export type ResolvePowerActionInput = {
  state: GameState;
  playerId: string;
  phaseKey: PhaseKey;
  actionId: string;
  sourceInstanceId: string;
  choiceId: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
  apply?: boolean;
};

export type ResolvePowerActionOutcome = {
  state: GameState;
  events: EffectEvent[];
  spentCharge: boolean;
  effects: Effect[];
  onceOnlyFiredKeys: string[];
};

/**
 * Resolve a power action (choice-based power).
 *
 * @param input - Power action input
 * @returns Outcome with updated state, events, and charge flag
 * @throws Error if validation fails
 */
export function resolvePowerAction(input: ResolvePowerActionInput): ResolvePowerActionOutcome {
  const {
    state,
    playerId,
    phaseKey,
    actionId,
    sourceInstanceId,
    choiceId,
    targetInstanceId,
    targetInstanceIds,
    apply = true,
  } = input;

  // ============================================================================
  // 1. PARSE ACTION ID
  // ============================================================================

  const { shipDefId, powerIndex } = parsePowerActionIdLocal(actionId);

  // ============================================================================
  // 2. FIND SHIP INSTANCE
  // ============================================================================

  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  const shipInstance = fleet.find((s: ShipInstance) => s.instanceId === sourceInstanceId);

  if (!shipInstance) {
    throw new Error(`Ship instance not found: ${sourceInstanceId}`);
  }

  // ============================================================================
  // 3. VALIDATE SHIP DEF ID MATCH
  // ============================================================================

  if (shipInstance.shipDefId !== shipDefId) {
    throw new Error(
      `Ship def mismatch: actionId=${actionId} but instance has shipDefId=${shipInstance.shipDefId}`
    );
  }

  // ============================================================================
  // 4. LOAD SHIP DEFINITION WITH STRUCTURED POWERS
  // ============================================================================

  const shipDef = getShipDefinition(shipDefId);

  if (!shipDef || !shipDef.structuredPowers) {
    throw new Error(`Ship definition not found or missing structured powers: ${shipDefId}`);
  }

  // ============================================================================
  // 5. VALIDATE POWER EXISTS AT INDEX
  // ============================================================================

  const power: StructuredShipPower | undefined = shipDef.structuredPowers[powerIndex];

  if (!power) {
    throw new Error(`Power not found at index ${powerIndex} for ship ${shipDefId}`);
  }

  // ============================================================================
  // 6. VALIDATE POWER TYPE = 'choice'
  // ============================================================================

  if (power.type !== 'choice') {
    throw new Error(`Power at index ${powerIndex} is not type:'choice' (found: ${power.type})`);
  }

  // ============================================================================
  // 7. VALIDATE TIMING MATCH
  // ============================================================================

  if (!power.timings.includes(phaseKey)) {
    throw new Error(
      `Power timing mismatch: power.timings=${JSON.stringify(power.timings)}, phaseKey=${phaseKey}`
    );
  }

  // ============================================================================
  // 8. FIND CHOSEN OPTION BY CHOICE ID
  // ============================================================================

  const option: StructuredChoiceOption | undefined = power.options.find(
    (opt) => opt.choiceId === choiceId
  );

  if (!option) {
    throw new Error(`Choice option not found: choiceId=${choiceId} for power ${actionId}`);
  }

  // ============================================================================
  // 8.5. VALIDATE ONCE-ONLY MEMORY / BUILD-TURN GATES
  // ============================================================================

  const onceOnlyFiredKeys: string[] = [];
  const powerMemoryKey = power.onceOnly ? `${sourceInstanceId}::${actionId}` : null;

  if (power.onceOnly === 'on_build_turn') {
    const currentTurnNumber = state?.gameData?.turnNumber ?? (state as any)?.turnNumber ?? 1;
    if (shipInstance.createdTurn !== currentTurnNumber) {
      throw new Error('This power is only available on the turn the ship was built.');
    }
  }

  if (powerMemoryKey) {
    if (state.gameData?.powerMemory?.onceOnlyFired?.[powerMemoryKey] === true) {
      throw new Error('This power has already been used.');
    }

    onceOnlyFiredKeys.push(powerMemoryKey);
  }

  // ============================================================================
  // 9. VALIDATE CHARGES (if required)
  // ============================================================================

  const effectiveRequiresCharge = option.requiresCharge ?? power.requiresCharge ?? false;
  const effectiveChargeCost = option.chargeCost ?? power.chargeCost ?? 1;

  if (effectiveRequiresCharge) {
    const chargesCurrent = shipInstance.chargesCurrent ?? 0;

    if (chargesCurrent < effectiveChargeCost) {
      throw new Error('Not enough charges');
    }
  }

  // ============================================================================
  // 10. FIND OPPONENT PLAYER ID
  // ============================================================================

  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  const opponentPlayerId = activePlayers.find((p: any) => p.id !== playerId)?.id || playerId;

  // ============================================================================
  // 11. VALIDATE EXPLICIT TARGET(S) (for targeted actions)
  // ============================================================================

  const targetedEffect = option.effects.find(
    (effect) =>
      effect.kind === EffectKind.Destroy ||
      effect.kind === EffectKind.TransferShip
  );

  let resolvedTargetInstanceId = targetInstanceId;
  let resolvedTargetInstanceIds = Array.isArray(targetInstanceIds)
    ? targetInstanceIds.filter(
        (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0
      )
    : undefined;

  if (targetedEffect) {
    const validTargets = getValidDestroyTargets(state, {
      sourcePlayerId: playerId,
      targetScope: targetedEffect.targetPlayer === 'self' ? 'self' : 'opponent',
      restriction: targetedEffect.restriction ?? 'any',
      minimumFullLineCost: shipDefId === 'SAC' ? 3 : undefined,
      applyOpponentSacProtection: shouldApplyOpponentSacProtectionForTargetedEffect(targetedEffect),
    });
    const requiredTargetCount = getRequiredTargetCount(targetedEffect, validTargets.length);

    if (requiredTargetCount <= 0) {
      throw new Error('No valid targets available.');
    }

    const requestedTargetIds = resolvedTargetInstanceIds?.length
      ? resolvedTargetInstanceIds
      : typeof resolvedTargetInstanceId === 'string'
        ? [resolvedTargetInstanceId]
        : [];

    if (requestedTargetIds.length !== requiredTargetCount) {
      throw new Error(`Expected exactly ${requiredTargetCount} target ship(s).`);
    }

    const distinctRequestedTargetIds = Array.from(new Set(requestedTargetIds));
    if (distinctRequestedTargetIds.length !== requestedTargetIds.length) {
      throw new Error('Target ship ids must be distinct.');
    }

    for (const requestedTargetId of distinctRequestedTargetIds) {
      const targetShip = validTargets.find((target) => target.instanceId === requestedTargetId);
      if (!targetShip) {
        throw new Error(`Target ship not valid: ${requestedTargetId}`);
      }
    }

    resolvedTargetInstanceIds = distinctRequestedTargetIds;
    resolvedTargetInstanceId = distinctRequestedTargetIds[0];
  }

  // ============================================================================
  // 12. TRANSLATE OPTION EFFECTS -> EFFECT[]
  // ============================================================================

  const ctx: TranslateContext = {
    shipInstanceId: sourceInstanceId,
    shipDefId,
    ownerPlayerId: playerId,
    opponentPlayerId,
    targetInstanceId: resolvedTargetInstanceId,
    targetInstanceIds: resolvedTargetInstanceIds,
  };

  const effects: Effect[] = translateChoiceOptionEffects(
    option.effects,
    powerIndex,
    phaseKey,
    ctx,
    choiceId
  );

  if (shipDefId === 'FAM' && (choiceId === 'damage' || choiceId === 'heal')) {
    const lockedAmount = countDistinctTypes(fleet);

    for (const effect of effects) {
      if (choiceId === 'damage' && effect.kind === EffectKind.Damage) {
        (effect as any).amount = lockedAmount;
      }

      if (choiceId === 'heal' && effect.kind === EffectKind.Heal) {
        (effect as any).amount = lockedAmount;
      }
    }
  }

  // ============================================================================
  // 13. COMPUTE SPENT CHARGE FLAG
  // ============================================================================

  const spentCharge = effects.some(
    (effect) => effect.kind === EffectKind.SpendCharge && ((effect as any).amount ?? 0) > 0
  );

  if (spentCharge) {
    const gd: any = state.gameData ?? (state.gameData = {} as any);
    const td: any = gd.turnData ?? (gd.turnData = {});

    const turnNumber: number = gd.turnNumber ?? (state as any).turnNumber ?? 1;
    const usedMap: Record<string, number> = td.chargePowerUsedByInstanceId || {};

    if (usedMap[sourceInstanceId] === turnNumber) {
      throw new Error('CHARGE_ALREADY_USED_THIS_TURN');
    }
  }

  // ============================================================================
  // 14. APPLY EFFECTS
  // ============================================================================

  if (!apply) {
    return {
      state,
      events: [],
      spentCharge,
      effects,
      onceOnlyFiredKeys,
    };
  }

  const applied = applyEffects(state, effects);
  let resolvedState = applied.state;

  if (onceOnlyFiredKeys.length > 0) {
    const powerMemory = resolvedState.gameData.powerMemory ?? {};
    const nextOnceOnlyFired = { ...(powerMemory.onceOnlyFired ?? {}) };

    for (const key of onceOnlyFiredKeys) {
      nextOnceOnlyFired[key] = true;
    }

    resolvedState = {
      ...resolvedState,
      gameData: {
        ...resolvedState.gameData,
        powerMemory: {
          ...powerMemory,
          onceOnlyFired: nextOnceOnlyFired,
        },
      },
    };
  }

  if (spentCharge) {
    const gd: any = resolvedState.gameData ?? (resolvedState.gameData = {} as any);
    const td: any = gd.turnData ?? (gd.turnData = {});

    const turnNumber: number = gd.turnNumber ?? (resolvedState as any).turnNumber ?? 1;
    const usedMap: Record<string, number> = td.chargePowerUsedByInstanceId || {};

    td.chargePowerUsedByInstanceId = {
      ...usedMap,
      [sourceInstanceId]: turnNumber,
    };
  }

  // ============================================================================
  // 15. RETURN OUTCOME
  // ============================================================================

  return {
    state: resolvedState,
    events: applied.events,
    spentCharge,
    effects,
    onceOnlyFiredKeys,
  };
}

// ============================================================================
// LOCAL PARSE HELPER (no imports from server IntentTypes)
// ============================================================================

/**
 * Parse power actionId locally.
 * Format: "{ShipDefId}#{powerIndex}"
 *
 * @param actionId - Action ID to parse
 * @returns Parsed components
 * @throws Error if format is invalid
 */
function parsePowerActionIdLocal(actionId: string): { shipDefId: string; powerIndex: number } {
  const parts = actionId.split('#');
  if (parts.length !== 2) {
    throw new Error(`Invalid power actionId: ${actionId}`);
  }

  const shipDefId = parts[0];
  const idxStr = parts[1];

  if (!shipDefId || !idxStr) {
    throw new Error(`Invalid power actionId: ${actionId}`);
  }

  const powerIndex = Number(idxStr);
  if (!Number.isInteger(powerIndex) || powerIndex < 0) {
    throw new Error(`Invalid power actionId: ${actionId}`);
  }

  return { shipDefId, powerIndex };
}

function getRequiredTargetCount(
  effect: StructuredChoiceOption['effects'][number],
  validTargetCount: number
): number {
  const rawRequiredTargetCount: number | undefined =
    typeof effect.requiredTargetCount === 'number'
      ? effect.requiredTargetCount
      : effect.count;
  const baseRequiredTargetCount =
    rawRequiredTargetCount !== undefined &&
    Number.isInteger(rawRequiredTargetCount) &&
    rawRequiredTargetCount > 0
      ? rawRequiredTargetCount
      : 1;

  if (validTargetCount <= 0) {
    return 0;
  }

  return Math.min(baseRequiredTargetCount, validTargetCount);
}
