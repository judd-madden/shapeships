/**
 * CANONICAL EFFECT MODEL
 * 
 * Immutable effect type for battle resolution.
 * Pure types only - no logic, no helpers.
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum BattlePhase {
  FirstStrike = 'FirstStrike',
  ChargeDeclaration = 'ChargeDeclaration',
  ChargeResponse = 'ChargeResponse',
  Resolution = 'Resolution'
}

export enum EffectTiming {
  Automatic = 'Automatic',
  OnceOnly = 'OnceOnly',
  Charge = 'Charge'
}

export enum EffectKind {
  Damage = 'Damage',
  Heal = 'Heal',
  Destroy = 'Destroy',
  CreateShip = 'CreateShip',
  GainEnergy = 'GainEnergy',
  GainLines = 'GainLines',
  ModifyDamage = 'ModifyDamage',
  ModifyHeal = 'ModifyHeal',
  Shield = 'Shield',
  Redirect = 'Redirect'
}

export enum SurvivabilityRule {
  DiesWithSource = 'DiesWithSource',
  ResolvesIfDestroyed = 'ResolvesIfDestroyed'
}

// ============================================================================
// SOURCE
// ============================================================================

export type ShipSource = {
  type: 'ship';
  instanceId: string;
  shipDefId: string;
};

export type SystemSource = {
  type: 'system';
  reason: string;
};

export type EffectSource = ShipSource | SystemSource;

// ============================================================================
// TARGET
// ============================================================================

export type EffectTarget = {
  playerId: string;
  shipInstanceId?: string;
};

// ============================================================================
// EFFECT
// ============================================================================

export type Effect = {
  id: string;
  ownerPlayerId: string;
  source: EffectSource;
  phase: BattlePhase;
  timing: EffectTiming;
  kind: EffectKind;
  magnitude: number | undefined;
  target: EffectTarget;
  survivability: SurvivabilityRule;
};
