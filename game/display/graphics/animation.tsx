/**
 * ShipAnimationWrapper
 * --------------------
 * IMPORTANT:
 * This wrapper is intended ONLY for ships rendered in the live fleet areas
 * on the BoardStage (mode === 'board').
 *
 * It must NOT be used in:
 * - Action / build catalogues
 * - Rules or species views
 * - Hover cards or static previews
 *
 * Animations here are driven by fleet state + UX tokens, NOT rules logic.
 */

import type { ShipDefId } from '../../types/ShipTypes.engine';

// ============================================================================
// TYPES
// ============================================================================

export type ShipAnimToken = {
  entryNonce: number;
  activationNonce: number;
  stackAddNonce: number; // NEW: triggers when count increases on existing stack
  stackCount: number;
};

export type FleetAnimVM = {
  my: Partial<Record<ShipDefId, ShipAnimToken>>;
  opponent: Partial<Record<ShipDefId, ShipAnimToken>>;
};

// ============================================================================
// ANIMATION PRESETS (SPLIT: ENTRY + ACTIVATION)
// ============================================================================
// These classes are in globals.css

type EntryPresetId = 'default' | 'defender' | 'commander' | 'carrier' | 'starship' | 'xenite' | 'to-right';
type ActivationPresetId = 'default' | 'carrier' | 'xenite';

const ENTRY_PRESETS: Record<EntryPresetId, { entryClass: string }> = {
  default: { entryClass: 'ss-entry-default' },
  defender: { entryClass: 'ss-entry-defender' },
  commander: { entryClass: 'ss-entry-commander' },
  carrier: { entryClass: 'ss-entry-carrier' },
  starship: { entryClass: 'ss-entry-starship' },
  xenite: { entryClass: 'ss-entry-xenite' },
  'to-right': { entryClass: 'ss-entry-to-right' },
};

const ACTIVATION_PRESETS: Record<ActivationPresetId, { 
  activationClass: string; 
  scaleMode: 'stackLinear' | 'none';
}> = {
  default: { 
    activationClass: 'ss-activate-default', 
    scaleMode: 'stackLinear',
  },
  carrier: { 
    activationClass: 'ss-activate-carrier', 
    scaleMode: 'none', // rotate only, no scale intensity
  },
  xenite: {
    activationClass: 'ss-activate-xenite',
    scaleMode: 'none', // jiggle only, no scale intensity
  },
};

const SHIP_ANIM: Partial<Record<ShipDefId, { 
  entry: EntryPresetId; 
  activation: ActivationPresetId;
}>> = {
  // Existing ships (renamed fighter → default)
  DEF: { entry: 'defender', activation: 'default' },
  FIG: { entry: 'default', activation: 'default' },
  INT: { entry: 'default', activation: 'default' },

  // Human Basic ships
  COM: { entry: 'commander', activation: 'default' },
  ORB: { entry: 'defender', activation: 'default' }, // "same as Defender"
  CAR: { entry: 'carrier', activation: 'carrier' },  // override activation
  STA: { entry: 'starship', activation: 'default' },

  // Human Upgraded ships
  FRI: { entry: 'default', activation: 'default' },
  TAC: { entry: 'default', activation: 'default' },
  GUA: { entry: 'defender', activation: 'default' }, // like Defender
  SCI: { entry: 'default', activation: 'default' }, 
  BAT: { entry: 'default', activation: 'default' },
  EAR: { entry: 'default', activation: 'default' },
  DRE: { entry: 'default', activation: 'default' },
  LEV: { entry: 'default', activation: 'default' },

  // Xenite ships
  XEN: { entry: 'xenite', activation: 'xenite' },
  ANT: { entry: 'default', activation: 'default' },
  MAN: { entry: 'xenite', activation: 'xenite' },
  EVO: { entry: 'defender', activation: 'default' },
  HEL: { entry: 'xenite', activation: 'xenite' },
  BUG: { entry: 'xenite', activation: 'xenite' },
  ZEN: { entry: 'xenite', activation: 'xenite' },
  DSW: { entry: 'default', activation: 'default' },
  AAR: { entry: 'default', activation: 'default' },
  OXF: { entry: 'defender', activation: 'default' },
  ASF: { entry: 'defender', activation: 'default' },
  SAC: { entry: 'xenite', activation: 'xenite' },
  QUE: { entry: 'xenite', activation: 'xenite' },
  CHR: { entry: 'default', activation: 'default' },
  HVE: { entry: 'default', activation: 'default' },

  // Centaur ships
  FEA: { entry: 'to-right', activation: 'default' },
  ANG: { entry: 'to-right', activation: 'default' },
  EQU: { entry: 'to-right', activation: 'default' },
  WIS: { entry: 'defender', activation: 'default' },
  VIG: { entry: 'default', activation: 'default' },
  FAM: { entry: 'starship', activation: 'default' },
  LEG: { entry: 'to-right', activation: 'default' },
  TER: { entry: 'to-right', activation: 'default' },
  FUR: { entry: 'to-right', activation: 'default' },
  KNO: { entry: 'default', activation: 'default' },
  ENT: { entry: 'to-right', activation: 'default' },
  RED: { entry: 'default', activation: 'default' },
  POW: { entry: 'default', activation: 'default' },
  DES: { entry: 'default', activation: 'default' },
  DOM: { entry: 'default', activation: 'default' },
};

// ============================================================================
// ACTIVATION SCALE HELPER
// ============================================================================

/**
 * Compute activation scale based on stack count
 * Base 1.1 + 0.05 × stackCount, clamped to max 1.6
 */
export function computeActivationScale(stackCount: number): number {
  const base = 1.1;
  const scale = base + 0.05 * stackCount;
  return Math.min(scale, 1.8);
}

// ============================================================================
// SHIP ANIMATION WRAPPER
// ============================================================================

interface ShipAnimationWrapperProps {
  shipDefId: ShipDefId;
  token?: ShipAnimToken;
  enableHoverActivation?: boolean;
  entryDelayMs?: number; // Opponent entry stagger delay
  activationDelayMs?: number; // Paired activation stagger delay
  children: React.ReactNode;
}

export function ShipAnimationWrapper({
  shipDefId,
  token,
  enableHoverActivation = false,
  entryDelayMs = 0,
  activationDelayMs = 0,
  children,
}: ShipAnimationWrapperProps) {
  // Lookup animation config for this ship
  const cfg = SHIP_ANIM[shipDefId];
  
  // If no config OR no token, render children directly (no animation)
  if (!cfg || !token) {
    return <>{children}</>;
  }

  const entryPreset = ENTRY_PRESETS[cfg.entry];
  const activationPreset = ACTIVATION_PRESETS[cfg.activation];

  // Compute activation scale from stack count (only for stackLinear mode)
  const actScale = activationPreset.scaleMode === 'stackLinear' 
    ? computeActivationScale(token.stackCount) 
    : 1;

  // Data attribute for hover: map activation preset to CSS selector
  const dataAnimValue = cfg.activation; // 'default' | 'carrier' | 'xenite'

  return (
    <div
      className="ss-shipAnimRoot"
      data-anim={dataAnimValue}
      data-anim-hover={enableHoverActivation ? '1' : '0'}
      style={{ '--ss-act-scale': actScale } as React.CSSProperties}
    >
      {/* Entry animation layer (keyed by entryNonce) */}
      <div 
        key={`entry-${token.entryNonce}`} 
        className={`ss-shipEntryLayer ${entryPreset.entryClass}`}
        style={{
          animationDelay: entryDelayMs > 0 ? `${entryDelayMs}ms` : undefined,
          animationFillMode: entryDelayMs > 0 ? 'both' : undefined,
        }}
      >
        {/* Stack-add pulse layer (keyed by stackAddNonce) */}
        <div
          key={`stackadd-${token.stackAddNonce}`}
          className={token.stackAddNonce > 0 ? 'ss-stack-add' : ''}
        >
          {/* Activation animation layer (keyed by activationNonce) */}
          <div
            key={`activate-${token.activationNonce}`}
            className={`ss-shipActivateLayer ${token.activationNonce > 0 ? activationPreset.activationClass : ''}`}
            style={{
              animationDelay: token.activationNonce > 0 && activationDelayMs > 0 ? `${activationDelayMs}ms` : undefined,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}