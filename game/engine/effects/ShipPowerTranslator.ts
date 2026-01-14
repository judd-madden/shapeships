/**
 * SHIP POWER → EFFECT TRANSLATOR
 * 
 * Translates ship JSON powers into canonical Effects.
 * Deterministic and side-effect free.
 * 
 * INPUT:
 * - Ship definition (JSON)
 * - Ship instance (runtime)
 * - Owning player
 * - Current phase
 * 
 * OUTPUT:
 * - Effect[]
 * 
 * RULES:
 * - JSON declares WHAT a ship does
 * - Translator decides HOW (phase, timing, survivability)
 * - JSON must NOT control ordering or simultaneity
 * - No resolution logic
 * - No inspection of other ships
 * - No conditional logic based on game outcome
 */

import type { EngineShipDefinition, EngineShipPower, ShipPowerPhase, PowerTiming } from '../../types/ShipTypes.engine.ts';
import type { Effect, BattlePhase, EffectTiming, EffectKind, EffectSource, SurvivabilityRule } from './Effect.ts';
import { BattlePhase as BattlePhaseEnum, EffectTiming as EffectTimingEnum, EffectKind as EffectKindEnum, SurvivabilityRule as SurvivabilityEnum } from './Effect.ts';
import { EffectKind as LegacyEffectKind } from '../../types/EffectTypes.ts';

// ============================================================================
// SHIP INSTANCE TYPE (Minimal)
// ============================================================================

export type ShipInstance = {
  instanceId: string;
  shipDefId: string;
  ownerPlayerId: string;
  chargesCurrent?: number;
  chargesMax?: number;
};

// ============================================================================
// TRANSLATION CONTEXT
// ============================================================================

type TranslationContext = {
  shipDef: EngineShipDefinition;
  shipInstance: ShipInstance;
  ownerPlayerId: string;
  opponentPlayerId: string;
  battlePhase: BattlePhase;
};

// ============================================================================
// MAIN TRANSLATOR
// ============================================================================

export function translateShipPowers(
  shipDef: EngineShipDefinition,
  shipInstance: ShipInstance,
  ownerPlayerId: string,
  opponentPlayerId: string,
  battlePhase: BattlePhase
): Effect[] {
  const context: TranslationContext = {
    shipDef,
    shipInstance,
    ownerPlayerId,
    opponentPlayerId,
    battlePhase
  };

  const effects: Effect[] = [];

  // Only translate powers that are active in the current battle phase
  const relevantPowers = shipDef.powers.filter(power =>
    isPowerActiveInPhase(power, battlePhase)
  );

  for (const power of relevantPowers) {
    const powerEffects = translatePower(power, context);
    effects.push(...powerEffects);
  }

  return effects;
}

// ============================================================================
// PHASE FILTERING
// ============================================================================

function isPowerActiveInPhase(power: EngineShipPower, battlePhase: BattlePhase): boolean {
  // Map ship power phase to battle phase
  const mappedPhase = mapShipPhaseToBattlePhase(power.phase);
  
  if (!mappedPhase) {
    // Power doesn't apply to battle (e.g., build-phase powers)
    return false;
  }

  return mappedPhase === battlePhase;
}

function mapShipPhaseToBattlePhase(shipPhase: ShipPowerPhase): BattlePhase | null {
  switch (shipPhase) {
    case 'First Strike':
      return BattlePhaseEnum.FirstStrike;
    
    case 'Simultaneous Declaration':
      return BattlePhaseEnum.ChargeDeclaration;
    
    case 'Conditional Response':
      return BattlePhaseEnum.ChargeResponse;
    
    case 'Automatic':
      // Automatic powers resolve in Resolution phase
      return BattlePhaseEnum.Resolution;
    
    // Build-phase powers don't apply to battle
    case 'Line Generation':
    case 'Ships That Build':
    case 'Drawing':
    case 'End of Build Phase':
    case 'Dice Manipulation':
    case 'Event':
      return null;
    
    default:
      // Exhaustiveness check
      const _exhaustive: never = shipPhase;
      return null;
  }
}

// ============================================================================
// POWER TRANSLATION
// ============================================================================

function translatePower(power: EngineShipPower, context: TranslationContext): Effect[] {
  const effects: Effect[] = [];

  // Determine effect timing
  const timing = mapPowerTimingToEffectTiming(power.timing, power.requiresCharge);

  // Determine survivability rule
  const survivability = determineSurvivability(power);

  // Create effect source
  const source: EffectSource = {
    type: 'ship',
    instanceId: context.shipInstance.instanceId,
    shipDefId: context.shipInstance.shipDefId
  };

  // Determine effect kind from legacy EffectKind if available
  const kind = mapLegacyEffectKind(power.kind);

  if (!kind) {
    // Cannot translate power without effect kind
    // This is expected for powers that need manual mapping
    return effects;
  }

  // Create base effect
  const effect: Effect = {
    id: generateEffectId(context.shipInstance.instanceId, power.powerIndex),
    ownerPlayerId: context.ownerPlayerId,
    source,
    phase: context.battlePhase,
    timing,
    kind,
    magnitude: power.baseAmount,
    target: {
      playerId: context.opponentPlayerId, // Default to opponent
      shipInstanceId: undefined
    },
    survivability
  };

  // Apply power-specific adjustments
  applyPowerSpecificLogic(effect, power, context);

  effects.push(effect);

  return effects;
}

// ============================================================================
// TIMING MAPPING
// ============================================================================

function mapPowerTimingToEffectTiming(
  powerTiming: PowerTiming,
  requiresCharge?: boolean
): EffectTiming {
  // Charge powers override timing
  if (requiresCharge) {
    return EffectTimingEnum.Charge;
  }

  switch (powerTiming) {
    case 'Continuous':
      return EffectTimingEnum.Automatic;
    
    case 'Once Only Automatic':
      return EffectTimingEnum.OnceOnly;
    
    case 'Upon Destruction':
    case 'Passive':
      // Passive and upon-destruction are automatic triggers
      return EffectTimingEnum.Automatic;
    
    default:
      const _exhaustive: never = powerTiming;
      return EffectTimingEnum.Automatic;
  }
}

// ============================================================================
// SURVIVABILITY DETERMINATION
// ============================================================================

function determineSurvivability(power: EngineShipPower): SurvivabilityRule {
  // Upon Destruction powers resolve even if source is destroyed
  if (power.timing === 'Upon Destruction') {
    return SurvivabilityEnum.ResolvesIfDestroyed;
  }

  // First Strike powers resolve even if source is destroyed
  // (because they happen before destruction resolution)
  if (power.phase === 'First Strike') {
    return SurvivabilityEnum.ResolvesIfDestroyed;
  }

  // Default: effect dies with source
  return SurvivabilityEnum.DiesWithSource;
}

// ============================================================================
// EFFECT KIND MAPPING
// ============================================================================

function mapLegacyEffectKind(legacyKind?: LegacyEffectKind): EffectKind | undefined {
  if (!legacyKind) {
    return undefined;
  }

  switch (legacyKind) {
    case LegacyEffectKind.DAMAGE:
      return EffectKindEnum.Damage;
    
    case LegacyEffectKind.HEAL:
      return EffectKindEnum.Heal;
    
    case LegacyEffectKind.DESTROY:
      return EffectKindEnum.Destroy;
    
    case LegacyEffectKind.BUILD_SHIP:
      return EffectKindEnum.CreateShip;
    
    case LegacyEffectKind.GENERATE_LINES:
      return EffectKindEnum.GainLines;
    
    case LegacyEffectKind.GENERATE_ENERGY:
      return EffectKindEnum.GainEnergy;
    
    // Unsupported legacy kinds (no direct mapping)
    case LegacyEffectKind.CUSTOM:
    case LegacyEffectKind.DRAW_SHIP:
    case LegacyEffectKind.ADD_TO_HAND:
    case LegacyEffectKind.DICE_MANIPULATION:
    case LegacyEffectKind.MOVE_SHIP:
    case LegacyEffectKind.COPY_POWER:
    case LegacyEffectKind.COUNTER:
    case LegacyEffectKind.PREVENT:
    case LegacyEffectKind.MODIFY_STAT:
      return undefined;
    
    default:
      const _exhaustive: never = legacyKind;
      return undefined;
  }
}

// ============================================================================
// POWER-SPECIFIC LOGIC
// ============================================================================

function applyPowerSpecificLogic(
  effect: Effect,
  power: EngineShipPower,
  context: TranslationContext
): void {
  // Apply special logic based on power configuration
  const special = power.specialLogic;
  
  if (!special) {
    return;
  }

  // Healing powers target owner, not opponent
  if (effect.kind === EffectKindEnum.Heal) {
    effect.target = {
      playerId: context.ownerPlayerId,
      shipInstanceId: undefined
    };
  }

  // Line generation targets owner
  if (effect.kind === EffectKindEnum.GainLines) {
    effect.target = {
      playerId: context.ownerPlayerId,
      shipInstanceId: undefined
    };
    
    // Use line generation amount if specified
    if (special.lineGeneration?.amount !== undefined) {
      effect.magnitude = special.lineGeneration.amount;
    }
  }

  // Energy generation targets owner
  if (effect.kind === EffectKindEnum.GainEnergy) {
    effect.target = {
      playerId: context.ownerPlayerId,
      shipInstanceId: undefined
    };
  }

  // Ship creation targets owner
  if (effect.kind === EffectKindEnum.CreateShip) {
    effect.target = {
      playerId: context.ownerPlayerId,
      shipInstanceId: undefined
    };
  }

  // TODO: Handle scaling effects (count-based multipliers)
  // TODO: Handle conditional effects (requires game state inspection)
  // TODO: Handle target selection (requires player choice)
}

// ============================================================================
// EFFECT ID GENERATION
// ============================================================================

function generateEffectId(shipInstanceId: string, powerIndex: number): string {
  return `effect_${shipInstanceId}_p${powerIndex}_${Date.now()}`;
}
