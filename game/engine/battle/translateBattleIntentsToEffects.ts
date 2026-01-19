/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BATTLE INTENT → EFFECTS TRANSLATOR (v1)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Pure translation layer: converts stored battle intents into canonical Effects.
 * 
 * V1 SCOPE (Interceptor damage/heal only):
 * - Only processes USE_CHARGE intents
 * - Only accepts shipDefId === 'INT' (Interceptor)
 * - Only accepts mode 'DAMAGE' or 'HEAL'
 * - Only accepts target shape { playerId: string }
 * - Charge effects created in their declared battle phase (Path B):
 *   - ChargeDeclaration intents → Effect.phase = 'ChargeDeclaration'
 *   - ChargeResponse intents → Effect.phase = 'ChargeResponse'
 * - BattleReducer queues these charge effects and applies them in Resolution
 * - Survivability is ALWAYS "ResolvesIfDestroyed" for v1
 * - Deterministic effect IDs (no random UUIDs)
 * 
 * EXPANSION PATH:
 * - Future: Ship power registry lookup for magnitudes and additional modes
 * - Future: Additional intent kinds (USE_ABILITY, DEPLOY_SHIP, etc.)
 * - Future: Complex targeting (shipInstanceId, multi-target, etc.)
 * 
 * ARCHITECTURE:
 * - This is a PURE MODULE (no state mutation, no external dependencies)
 * - Does NOT decrement charges (IntentReducer's job)
 * - Does NOT check ship destruction (BattleReducer's job)
 * - Does NOT interact with queuedCharges (BattleReducer's job)
 * - ONLY translates validated intents into Effect objects
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  type Effect,
  BattlePhase,
  EffectTiming,
  EffectKind,
  SurvivabilityRule,
  type DamageEffect,
  type HealEffect,
} from '../effects/Effect.ts';
import type { PhaseKey } from '../../../supabase/functions/server/engine_shared/phase/PhaseTable.ts';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Battle Intent (v1)
 * 
 * Represents a player's battle action intent.
 * Currently supports USE_CHARGE (Interceptor damage/heal) and PASS.
 */
export type BattleIntent = {
  kind: 'USE_CHARGE' | 'PASS';
  declaredPhase: 'ChargeDeclaration' | 'ChargeResponse';
  ownerPlayerId: string;
  shipInstanceId?: string;
  mode?: 'DAMAGE' | 'HEAL';
  target?: { playerId: string };
};

/**
 * Ship instance reference (minimal data needed for translation)
 */
export type ShipReference = {
  instanceId: string;
  shipDefId: string;
};

/**
 * Translation input
 */
export type TranslationInput = {
  turnNumber: number;
  intents: BattleIntent[];
  shipsByPlayer: Record<string, ShipReference[]>;
};

/**
 * Rejection record (for debugging/validation)
 */
export type IntentRejection = {
  intentIndex: number;
  reason: string;
};

/**
 * Translation output
 */
export type TranslationOutput = {
  effects: Effect[];
  rejected: IntentRejection[];
  debugLog: string[];
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * v1: Hardcoded Interceptor charge magnitude
 * Future: Look up from ship power registry
 */
const INTERCEPTOR_CHARGE_MAGNITUDE = 5;

/**
 * v1: Only support Interceptor ship
 */
const SUPPORTED_SHIP_DEF_IDS = ['INT'];

// ============================================================================
// MAIN TRANSLATION FUNCTION
// ============================================================================

/**
 * Translate battle intents into canonical Effects for BattleReducer.
 * 
 * PURE FUNCTION:
 * - Does not mutate input
 * - Deterministic output (same input = same output)
 * - No side effects
 * 
 * VALIDATION:
 * - Rejects unsupported intent kinds
 * - Rejects unsupported ship types (v1: only INT)
 * - Rejects invalid modes (v1: only DAMAGE/HEAL)
 * - Rejects invalid targets (v1: only { playerId })
 * - Rejects references to non-existent ships
 * 
 * DETERMINISM:
 * - Effect IDs are deterministic: charge-{turn}-{player}-{ship}-{mode}
 * - Intents are sorted before translation to ensure consistent ordering
 * 
 * @param input - Translation input with intents and ship references
 * @returns Translation output with effects, rejections, and debug log
 */
export function translateBattleIntentsToEffects(
  input: TranslationInput
): TranslationOutput {
  const effects: Effect[] = [];
  const rejected: IntentRejection[] = [];
  const debugLog: string[] = [];

  debugLog.push(`[Translator] Processing ${input.intents.length} intents for turn ${input.turnNumber}`);

  // ============================================================================
  // DETERMINISTIC SORTING
  // ============================================================================

  // Create indexed intents for tracking rejections
  const indexedIntents = input.intents.map((intent, index) => ({ intent, index }));

  // Sort for deterministic ordering:
  // 1. declaredPhase (ChargeDeclaration before ChargeResponse)
  // 2. ownerPlayerId (lexicographically)
  // 3. shipInstanceId (lexicographically)
  // 4. mode (lexicographically)
  indexedIntents.sort((a, b) => {
    const intentA = a.intent;
    const intentB = b.intent;

    // Phase order
    const phaseOrder = { ChargeDeclaration: 0, ChargeResponse: 1 };
    const phaseCompare = phaseOrder[intentA.declaredPhase] - phaseOrder[intentB.declaredPhase];
    if (phaseCompare !== 0) return phaseCompare;

    // Owner player ID
    const ownerCompare = intentA.ownerPlayerId.localeCompare(intentB.ownerPlayerId);
    if (ownerCompare !== 0) return ownerCompare;

    // Ship instance ID
    const shipA = intentA.shipInstanceId ?? '';
    const shipB = intentB.shipInstanceId ?? '';
    const shipCompare = shipA.localeCompare(shipB);
    if (shipCompare !== 0) return shipCompare;

    // Mode
    const modeA = intentA.mode ?? '';
    const modeB = intentB.mode ?? '';
    return modeA.localeCompare(modeB);
  });

  debugLog.push(`[Translator] Sorted intents deterministically`);

  // ============================================================================
  // TRANSLATE EACH INTENT
  // ============================================================================

  for (const { intent, index } of indexedIntents) {
    // Skip PASS intents (no effect generated)
    if (intent.kind === 'PASS') {
      debugLog.push(`[Translator] Intent ${index}: PASS (no effect)`);
      continue;
    }

    // Only process USE_CHARGE in v1
    if (intent.kind !== 'USE_CHARGE') {
      rejected.push({
        intentIndex: index,
        reason: `Unsupported intent kind: ${intent.kind}`,
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (unsupported kind: ${intent.kind})`);
      continue;
    }

    // Validate required fields for USE_CHARGE
    if (!intent.shipInstanceId) {
      rejected.push({
        intentIndex: index,
        reason: 'USE_CHARGE intent missing shipInstanceId',
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (missing shipInstanceId)`);
      continue;
    }

    if (!intent.mode) {
      rejected.push({
        intentIndex: index,
        reason: 'USE_CHARGE intent missing mode',
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (missing mode)`);
      continue;
    }

    if (!intent.target) {
      rejected.push({
        intentIndex: index,
        reason: 'USE_CHARGE intent missing target',
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (missing target)`);
      continue;
    }

    // Validate mode (v1: only DAMAGE or HEAL)
    if (intent.mode !== 'DAMAGE' && intent.mode !== 'HEAL') {
      rejected.push({
        intentIndex: index,
        reason: `Unsupported mode: ${intent.mode} (v1 only supports DAMAGE/HEAL)`,
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (unsupported mode: ${intent.mode})`);
      continue;
    }

    // Validate target shape (v1: only { playerId })
    if (!intent.target.playerId) {
      rejected.push({
        intentIndex: index,
        reason: 'Target missing playerId',
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (target missing playerId)`);
      continue;
    }

    // Look up ship to validate ownership and get shipDefId
    const ownerShips = input.shipsByPlayer[intent.ownerPlayerId] ?? [];
    const ship = ownerShips.find(s => s.instanceId === intent.shipInstanceId);

    if (!ship) {
      rejected.push({
        intentIndex: index,
        reason: `Ship ${intent.shipInstanceId} not found in player ${intent.ownerPlayerId}'s fleet`,
      });
      debugLog.push(
        `[Translator] Intent ${index}: REJECTED (ship ${intent.shipInstanceId} not owned by ${intent.ownerPlayerId})`
      );
      continue;
    }

    // Validate ship type (v1: only Interceptor)
    if (!SUPPORTED_SHIP_DEF_IDS.includes(ship.shipDefId)) {
      rejected.push({
        intentIndex: index,
        reason: `Ship type ${ship.shipDefId} not supported in v1 (only INT supported)`,
      });
      debugLog.push(`[Translator] Intent ${index}: REJECTED (unsupported ship type: ${ship.shipDefId})`);
      continue;
    }

    // ============================================================================
    // CREATE EFFECT
    // ============================================================================

    const effectKind = intent.mode === 'DAMAGE' ? EffectKind.Damage : EffectKind.Heal;

    // Deterministic effect ID
    const effectId = `charge-${input.turnNumber}-${intent.ownerPlayerId}-${intent.shipInstanceId}-${intent.mode.toLowerCase()}`;

    // Map declared phase to PhaseKey timing
    const timing: PhaseKey = intent.declaredPhase === 'ChargeDeclaration' 
      ? 'battle.charge_declaration'
      : 'battle.charge_response';

    // Map to legacy BattlePhase for BattleReducer compatibility
    const phase: BattlePhase = intent.declaredPhase === 'ChargeDeclaration'
      ? BattlePhase.ChargeDeclaration
      : BattlePhase.ChargeResponse;

    // Base effect fields
    const baseEffect = {
      id: effectId,
      ownerPlayerId: intent.ownerPlayerId,
      source: {
        type: 'ship' as const,
        instanceId: intent.shipInstanceId,
        shipDefId: ship.shipDefId,
      },
      timing,
      phase, // Legacy field for BattleReducer
      activationTag: EffectTiming.Charge,
      target: {
        playerId: intent.target.playerId,
      },
      survivability: SurvivabilityRule.ResolvesIfDestroyed,
    };

    // Create typed effect based on kind
    const effect: Effect = intent.mode === 'DAMAGE'
      ? {
          ...baseEffect,
          kind: EffectKind.Damage,
          amount: INTERCEPTOR_CHARGE_MAGNITUDE,
        } as DamageEffect
      : {
          ...baseEffect,
          kind: EffectKind.Heal,
          amount: INTERCEPTOR_CHARGE_MAGNITUDE,
        } as HealEffect;

    effects.push(effect);
    debugLog.push(
      `[Translator] Intent ${index}: TRANSLATED to ${effectKind} effect in ${timing} phase (amount ${INTERCEPTOR_CHARGE_MAGNITUDE})`
    );
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  debugLog.push(`[Translator] Translation complete: ${effects.length} effects, ${rejected.length} rejected`);

  return {
    effects,
    rejected,
    debugLog,
  };
}