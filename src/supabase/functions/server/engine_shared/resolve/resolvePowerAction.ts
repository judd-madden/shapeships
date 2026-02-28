/**
 * GENERIC POWER ACTION RESOLVER
 * 
 * Data-driven resolver for structured type:'choice' powers.
 * 
 * Responsibilities:
 * - Parse { actionId, sourceInstanceId, choiceId }
 * - Validate timing, ownership, charges
 * - Translate chosen option → Effects
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
  type TranslateContext
} from '../effects/translateShipPowers.ts';

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
};

export type ResolvePowerActionOutcome = {
  state: GameState;
  events: EffectEvent[];
  spentCharge: boolean;
};

/**
 * Resolve a power action (choice-based power).
 * 
 * @param input - Power action input
 * @returns Outcome with updated state, events, and charge flag
 * @throws Error if validation fails
 */
export function resolvePowerAction(input: ResolvePowerActionInput): ResolvePowerActionOutcome {
  const { state, playerId, phaseKey, actionId, sourceInstanceId, choiceId } = input;

  // ============================================================================
  // 1. PARSE ACTION ID
  // ============================================================================

  const { shipDefId, powerIndex } = parsePowerActionIdLocal(actionId);

  // ============================================================================
  // 2. FIND SHIP INSTANCE
  // ============================================================================

  const fleet = state?.ships?.[playerId] ?? state?.gameData?.ships?.[playerId] ?? [];
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
  // 11. TRANSLATE OPTION EFFECTS → EFFECT[]
  // ============================================================================

  const ctx: TranslateContext = {
    shipInstanceId: sourceInstanceId,
    shipDefId,
    ownerPlayerId: playerId,
    opponentPlayerId
  };

  const effects: Effect[] = translateChoiceOptionEffects(
    option.effects,
    powerIndex,
    phaseKey,
    ctx,
    choiceId // Use choiceId as salt for deterministic IDs
  );

  // ============================================================================
  // 12. COMPUTE SPENT CHARGE FLAG
  // ============================================================================

  const spentCharge = effects.some(
    (e) => e.kind === EffectKind.SpendCharge && ((e as any).amount ?? 0) > 0
  );

  // Phase 3.1 Slice 2 — Patch B: Once-per-turn charge power lock (charge-spending only)
  if (spentCharge) {
    const gd: any = state.gameData ?? (state.gameData = {} as any);
    const td: any = gd.turnData ?? (gd.turnData = {});

    const turnNumber: number = gd.turnNumber ?? (state as any).turnNumber ?? 1;
    const usedMap: Record<string, number> = td.chargePowerUsedByInstanceId || {};

    if (usedMap[sourceInstanceId] === turnNumber) {
      // Throw sentinel error; IntentReducer maps this to a deterministic rejection code.
      throw new Error('CHARGE_ALREADY_USED_THIS_TURN');
    }
  }

  // ============================================================================
  // 13. APPLY EFFECTS
  // ============================================================================

  const applied = applyEffects(state, effects);

  // Phase 3.1 Slice 2 — Patch B: Mark charge usage on success
  if (spentCharge) {
    const gd: any =
      applied.state.gameData ?? (applied.state.gameData = {} as any);
    const td: any = gd.turnData ?? (gd.turnData = {});

    const turnNumber: number = gd.turnNumber ?? (applied.state as any).turnNumber ?? 1;
    const usedMap: Record<string, number> = td.chargePowerUsedByInstanceId || {};

    td.chargePowerUsedByInstanceId = {
      ...usedMap,
      [sourceInstanceId]: turnNumber
    };
  }

  // ============================================================================
  // 14. RETURN OUTCOME
  // ============================================================================

  return {
    state: applied.state,
    events: applied.events,
    spentCharge
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