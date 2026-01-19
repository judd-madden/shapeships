/**
 * CANONICAL EFFECT MODEL (SHARED)
 * Bundled for Supabase Edge.
 * Pure deterministic TypeScript.
 * 
 * Immutable effect type for all phase resolution.
 * Pure types only - no logic, no helpers.
 * 
 * TIMING: All effects schedule by PhaseKey (not BattlePhase).
 * PhaseKey is the canonical phase contract from PhaseTable.ts.
 */

import type { PhaseKey } from '../phase/PhaseTable.ts';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * @deprecated BattlePhase is legacy - use PhaseKey for scheduling instead.
 * Kept for backward compatibility with BattleReducer.ts (locked module).
 */
export enum BattlePhase {
  FirstStrike = 'FirstStrike',
  ChargeDeclaration = 'ChargeDeclaration',
  ChargeResponse = 'ChargeResponse',
  Resolution = 'Resolution'
}

/**
 * Effect activation metadata (not for scheduling)
 * Indicates whether an effect is automatic, requires a charge, or is once-only
 */
export enum EffectTiming {
  Automatic = 'Automatic',
  OnceOnly = 'OnceOnly',
  Charge = 'Charge'
}

/**
 * Generic verbs for all effect types
 * Do not add near-duplicates - keep this list minimal
 */
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
// BASE EFFECT
// ============================================================================

/**
 * Common fields for all effect types
 */
type BaseEffect = {
  /** Deterministic effect identifier */
  id: string;
  
  /** Owner of the effect source (player who owns the ship/system) */
  ownerPlayerId: string;
  
  /** Source of the effect (ship or system) */
  source: EffectSource;
  
  /** When this effect resolves (PhaseKey from PhaseTable) */
  timing: PhaseKey;
  
  /** 
   * @deprecated Legacy phase field for BattleReducer compatibility
   * Use `timing` for new code. This field exists only for backward compatibility
   * with BattleReducer which still uses BattlePhase enum.
   */
  phase?: BattlePhase;
  
  /** Activation metadata (automatic/charge/once-only) */
  activationTag: EffectTiming;
  
  /** Who/what receives this effect */
  target: EffectTarget;
  
  /** What happens to this effect if the source is destroyed */
  survivability: SurvivabilityRule;
  
  /** Type discriminator */
  kind: EffectKind;
};

// ============================================================================
// SPECIFIC EFFECT TYPES (Discriminated Union)
// ============================================================================

export type DamageEffect = BaseEffect & {
  kind: EffectKind.Damage;
  amount: number;
};

export type HealEffect = BaseEffect & {
  kind: EffectKind.Heal;
  amount: number;
};

export type DestroyEffect = BaseEffect & {
  kind: EffectKind.Destroy;
  restriction: 'basic_only' | 'upgraded_only' | 'any';
  count: number; // usually 1
};

export type CreateShipEffect = BaseEffect & {
  kind: EffectKind.CreateShip;
  shipDefId: string; // e.g. 'DEF'
  free?: boolean;    // for Dreadnought later
  createdBy?: 'carrier' | 'dreadnought' | 'manual';
};

export type GainLinesEffect = BaseEffect & {
  kind: EffectKind.GainLines;
  amount: number;
  appliesToFutureBuildPhases?: boolean;
};

export type GainEnergyEffect = BaseEffect & {
  kind: EffectKind.GainEnergy;
  amount: number;
};

export type ModifyDamageEffect = BaseEffect & {
  kind: EffectKind.ModifyDamage;
  multiplier?: number;
  additive?: number;
};

export type ModifyHealEffect = BaseEffect & {
  kind: EffectKind.ModifyHeal;
  multiplier?: number;
  additive?: number;
};

export type ShieldEffect = BaseEffect & {
  kind: EffectKind.Shield;
  amount: number;
};

export type RedirectEffect = BaseEffect & {
  kind: EffectKind.Redirect;
  newTargetPlayerId: string;
  newTargetShipInstanceId?: string;
};

// ============================================================================
// EFFECT (UNION)
// ============================================================================

/**
 * All possible effect types
 * Use discriminated union pattern for type safety
 */
export type Effect = 
  | DamageEffect
  | HealEffect
  | DestroyEffect
  | CreateShipEffect
  | GainLinesEffect
  | GainEnergyEffect
  | ModifyDamageEffect
  | ModifyHealEffect
  | ShieldEffect
  | RedirectEffect;