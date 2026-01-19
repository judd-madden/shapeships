/**
 * SHIP POWER → EFFECT TRANSLATOR
 * 
 * DEPLOY-SAFE: Pure deterministic translator module.
 * No Date.now(), Math.random(), or crypto.randomUUID().
 * No state mutation. No game state inspection.
 * No legacy type mapping. No "infer from text" logic.
 * 
 * Translates structured ship powers into canonical Effects.
 * 
 * INPUT:
 * - Structured ship powers
 * - PhaseKey (which phase we're translating for)
 * - Context (ship instance, players)
 * 
 * OUTPUT:
 * - Effect[]
 * 
 * RULES:
 * - Powers must be explicitly structured (no guessing)
 * - Skip powers without required fields
 * - Direct mapping only (no inference)
 * - Deterministic effect IDs (include PhaseKey)
 */

import type { PhaseKey } from '../phase/PhaseTable.ts';
import type { 
  Effect, 
  EffectTiming, 
  EffectKind, 
  EffectSource, 
  SurvivabilityRule,
  DamageEffect,
  HealEffect,
  DestroyEffect,
  CreateShipEffect,
  GainLinesEffect,
  GainEnergyEffect
} from './Effect.ts';
import { 
  EffectTiming as EffectTimingEnum, 
  EffectKind as EffectKindEnum, 
  SurvivabilityRule as SurvivabilityEnum 
} from './Effect.ts';

// ============================================================================
// STRUCTURED SHIP POWER (PhaseKey-Based Schema)
// ============================================================================

/**
 * Base structured power definition
 */
type BaseStructuredPower = {
  /** Which phase this power activates in */
  timing: PhaseKey;
  
  /** Does this power require spending charges? */
  requiresCharge?: boolean;
  
  /** Charge cost (if requiresCharge is true) */
  chargeCost?: number;
  
  /** Is this a once-only effect? */
  onceOnly?: 'on_build_turn' | 'ever';
  
  /** Does this effect resolve even if source ship is destroyed? */
  resolvesIfDestroyed?: boolean;
  
  /** Who is the target? */
  targetPlayer?: 'self' | 'opponent';
};

/**
 * Effect-based power (simple automatic effect)
 */
type EffectPower = BaseStructuredPower & {
  type: 'effect';
  kind: EffectKind;
  
  // Type-specific fields
  amount?: number;                // For Damage, Heal, GainLines, GainEnergy
  shipDefId?: string;             // For CreateShip
  restriction?: 'basic_only' | 'upgraded_only' | 'any'; // For Destroy
  count?: number;                 // For Destroy
  appliesToFutureBuildPhases?: boolean; // For GainLines
};

/**
 * Choice option for choice-based powers
 */
export type StructuredChoiceOption = {
  label: string;
  requiresCharge?: boolean;
  chargeCost?: number;
  effects: EffectPower[];
};

/**
 * Choice-based power (for Interceptor/Carrier/Guardian)
 */
type ChoicePower = BaseStructuredPower & {
  type: 'choice';
  options: StructuredChoiceOption[];
};

/**
 * Structured ship power definition
 * Powers are authored by PhaseKey timing
 */
export type StructuredShipPower = EffectPower | ChoicePower;

// ============================================================================
// TRANSLATE CONTEXT
// ============================================================================

export type TranslateContext = {
  shipInstanceId: string;
  shipDefId: string;
  ownerPlayerId: string;
  opponentPlayerId: string;
};

// ============================================================================
// MAIN TRANSLATOR
// ============================================================================

/**
 * Translate structured powers for a specific phase
 * 
 * @param structuredPowers - Array of structured ship powers
 * @param phaseKey - Which phase we're translating for
 * @param ctx - Translation context (ship, players)
 * @returns Array of Effects for this phase
 */
export function translateShipPowers(
  structuredPowers: StructuredShipPower[],
  phaseKey: PhaseKey,
  ctx: TranslateContext
): Effect[] {
  const effects: Effect[] = [];

  // Filter powers that activate in this phase
  const relevantPowers = structuredPowers.filter(
    power => power.timing === phaseKey
  );

  // Translate each power to effects
  for (let powerIndex = 0; powerIndex < relevantPowers.length; powerIndex++) {
    const power = relevantPowers[powerIndex];
    
    // For now, only handle effect-type powers (not choice)
    if (power.type === 'effect') {
      const effect = translateEffectPower(
        power,
        powerIndex,
        phaseKey,
        ctx
      );
      
      if (effect) {
        effects.push(effect);
      }
    }
    // TODO: Handle choice powers in future pass
  }

  return effects;
}

// ============================================================================
// EFFECT POWER TRANSLATION
// ============================================================================

function translateEffectPower(
  power: EffectPower,
  powerIndex: number,
  phaseKey: PhaseKey,
  ctx: TranslateContext
): Effect | null {
  // Skip if missing required fields
  if (!power.kind) {
    return null;
  }

  // Determine effect timing (activation tag)
  const activationTag = determineEffectTiming(power);

  // Determine survivability rule
  const survivability = determineSurvivability(power);

  // Determine target player
  const targetPlayerId = determineTargetPlayer(
    power,
    ctx.ownerPlayerId,
    ctx.opponentPlayerId
  );

  // Create effect source
  const source: EffectSource = {
    type: 'ship',
    instanceId: ctx.shipInstanceId,
    shipDefId: ctx.shipDefId
  };

  // Base effect fields
  const baseEffect = {
    id: generateDeterministicEffectId(
      ctx.shipDefId,
      ctx.shipInstanceId,
      powerIndex,
      phaseKey
    ),
    ownerPlayerId: ctx.ownerPlayerId,
    source,
    timing: phaseKey,
    activationTag,
    target: {
      playerId: targetPlayerId,
      shipInstanceId: undefined
    },
    survivability,
    kind: power.kind
  };

  // Create typed effect based on kind
  switch (power.kind) {
    case EffectKindEnum.Damage:
      if (power.amount === undefined) return null;
      return {
        ...baseEffect,
        kind: EffectKindEnum.Damage,
        amount: power.amount
      } as DamageEffect;

    case EffectKindEnum.Heal:
      if (power.amount === undefined) return null;
      return {
        ...baseEffect,
        kind: EffectKindEnum.Heal,
        amount: power.amount
      } as HealEffect;

    case EffectKindEnum.Destroy:
      return {
        ...baseEffect,
        kind: EffectKindEnum.Destroy,
        restriction: power.restriction ?? 'any',
        count: power.count ?? 1
      } as DestroyEffect;

    case EffectKindEnum.CreateShip:
      if (!power.shipDefId) return null;
      return {
        ...baseEffect,
        kind: EffectKindEnum.CreateShip,
        shipDefId: power.shipDefId
      } as CreateShipEffect;

    case EffectKindEnum.GainLines:
      if (power.amount === undefined) return null;
      return {
        ...baseEffect,
        kind: EffectKindEnum.GainLines,
        amount: power.amount,
        appliesToFutureBuildPhases: power.appliesToFutureBuildPhases
      } as GainLinesEffect;

    case EffectKindEnum.GainEnergy:
      if (power.amount === undefined) return null;
      return {
        ...baseEffect,
        kind: EffectKindEnum.GainEnergy,
        amount: power.amount
      } as GainEnergyEffect;

    // TODO: Handle other effect kinds (ModifyDamage, ModifyHeal, Shield, Redirect)
    default:
      console.warn(`[translateShipPowers] Unhandled effect kind: ${power.kind}`);
      return null;
  }
}

// ============================================================================
// TIMING DETERMINATION
// ============================================================================

function determineEffectTiming(power: BaseStructuredPower): EffectTiming {
  // Charge powers
  if (power.requiresCharge) {
    return EffectTimingEnum.Charge;
  }

  // Once-only powers
  if (power.onceOnly) {
    return EffectTimingEnum.OnceOnly;
  }

  // Default: automatic
  return EffectTimingEnum.Automatic;
}

// ============================================================================
// SURVIVABILITY DETERMINATION
// ============================================================================

function determineSurvivability(power: BaseStructuredPower): SurvivabilityRule {
  // Explicit flag takes precedence
  if (power.resolvesIfDestroyed) {
    return SurvivabilityEnum.ResolvesIfDestroyed;
  }

  // Default: effect dies with source
  return SurvivabilityEnum.DiesWithSource;
}

// ============================================================================
// TARGET DETERMINATION
// ============================================================================

function determineTargetPlayer(
  power: BaseStructuredPower & { kind?: EffectKind },
  ownerPlayerId: string,
  opponentPlayerId: string
): string {
  // Explicit target takes precedence
  if (power.targetPlayer === 'self') {
    return ownerPlayerId;
  }
  if (power.targetPlayer === 'opponent') {
    return opponentPlayerId;
  }

  // Default heuristic based on effect kind
  // Beneficial effects → owner
  // Harmful effects → opponent
  if (!power.kind) {
    return opponentPlayerId;
  }

  switch (power.kind) {
    case EffectKindEnum.Heal:
    case EffectKindEnum.GainEnergy:
    case EffectKindEnum.GainLines:
    case EffectKindEnum.CreateShip:
      return ownerPlayerId;
    
    case EffectKindEnum.Damage:
    case EffectKindEnum.Destroy:
      return opponentPlayerId;
    
    // Modifiers and special effects default to owner
    case EffectKindEnum.ModifyDamage:
    case EffectKindEnum.ModifyHeal:
    case EffectKindEnum.Shield:
    case EffectKindEnum.Redirect:
      return ownerPlayerId;
    
    default:
      // Fallback to opponent for safety
      return opponentPlayerId;
  }
}

// ============================================================================
// EFFECT ID GENERATION (DETERMINISTIC)
// ============================================================================

/**
 * Generate deterministic effect ID from inputs
 * 
 * Format: eff:{shipDefId}:{shipInstanceId}:p{powerIndex}:{phaseKey}
 * 
 * NO Date.now(), Math.random(), or crypto.randomUUID()
 */
function generateDeterministicEffectId(
  shipDefId: string,
  shipInstanceId: string,
  powerIndex: number,
  phaseKey: PhaseKey
): string {
  return `eff:${shipDefId}:${shipInstanceId}:p${powerIndex}:${phaseKey}`;
}