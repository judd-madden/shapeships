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

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type AnimationEventHandler,
  type CSSProperties,
} from 'react';
import type {
  BoardTargetSelectedTone,
  LiveRowAncientSolarPowerId,
} from '../../client/gameSession/types';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { usePrefersReducedMotion } from '../shared/usePrefersReducedMotion';
import { computeSequentialEntryDelayById } from './animation-stagger';

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
  my: Partial<Record<string, ShipAnimToken>>;       // renderKey -> token
  opponent: Partial<Record<string, ShipAnimToken>>; // renderKey -> token
};

export type SolarPowerEntryAnimToken = {
  entryNonce: number;
  staggerDelayMs: number;
};

export type SolarPowerEntryVisualState = 'active' | 'settled' | 'clearing';

const SOLAR_ENTRY_STAGGER_INTERVAL_MS = 250;

export function useSolarPowerEntryAnimTokens(
  displayKeys: readonly string[],
  enabled = true
): Partial<Record<string, SolarPowerEntryAnimToken>> {
  const previousDisplayKeysRef = useRef<readonly string[] | null>(null);
  const wasEnabledRef = useRef(enabled);
  const nextEntryNonceRef = useRef(1);
  const [tokens, setTokens] = useState<Partial<Record<string, SolarPowerEntryAnimToken>>>({});
  const displayKeysSignature = JSON.stringify(displayKeys);

  useLayoutEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }

    const resumedAfterFreeze = !wasEnabledRef.current;
    wasEnabledRef.current = true;
    const previousDisplayKeys = previousDisplayKeysRef.current;
    previousDisplayKeysRef.current = [...displayKeys];

    if (previousDisplayKeys === null) {
      return;
    }

    const previousKeySet = new Set(previousDisplayKeys);
    const currentKeySet = new Set(displayKeys);
    const newDisplayKeys = displayKeys.filter((key) => !previousKeySet.has(key));
    const delayById = computeSequentialEntryDelayById(
      newDisplayKeys,
      SOLAR_ENTRY_STAGGER_INTERVAL_MS
    );

    setTokens((currentTokens) => {
      const nextTokens: Partial<Record<string, SolarPowerEntryAnimToken>> = {};
      let changed = false;

      for (const displayKey of displayKeys) {
        const currentToken = resumedAfterFreeze ? undefined : currentTokens[displayKey];
        if (currentToken) {
          nextTokens[displayKey] = currentToken;
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(delayById, displayKey)) {
          nextTokens[displayKey] = {
            entryNonce: nextEntryNonceRef.current++,
            staggerDelayMs: delayById[displayKey],
          };
          changed = true;
        }
      }

      if (resumedAfterFreeze && Object.keys(currentTokens).length > 0) {
        changed = true;
      }

      for (const displayKey of Object.keys(currentTokens)) {
        if (!currentKeySet.has(displayKey)) {
          changed = true;
          break;
        }
      }

      return changed ? nextTokens : currentTokens;
    });
  }, [displayKeysSignature, enabled]);

  return tokens;
}

// ============================================================================
// TARGETING
// ============================================================================

export type TargetingVisualState = 'available' | 'hovered' | 'selected';

export const TARGETING_GLOW_SIZE_PX = 200;
export const TARGETING_PREVIEW_SCALE = 0.5;
export const TARGETING_PREVIEW_OFFSET_PX = 10;

const TARGETING_WHITE_GLOW =
  'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 60%)';
const TARGETING_RED_GLOW =
  'radial-gradient(circle, rgba(221,0,0,1) 0%, rgba(221,0,0,0) 60%)';
const TARGETING_CYAN_GLOW =
  'radial-gradient(circle, rgba(0,182,239,1) 0%, rgba(0,182,239,0) 60%)';
const TARGETING_PURPLE_GLOW =
  'radial-gradient(circle, var(--shapeships-purple) 0%, transparent 60%)';

export function getTargetingVisualState(targetState?: {
  isTargetable: boolean;
  isHovered: boolean;
  isSelected: boolean;
} | null): TargetingVisualState | null {
  if (!targetState) {
    return null;
  }

  if (targetState.isSelected) {
    return 'selected';
  }

  if (targetState.isHovered && targetState.isTargetable) {
    return 'hovered';
  }

  if (targetState.isTargetable) {
    return 'available';
  }

  return null;
}

export function getTargetingGlowClassName(visualState: TargetingVisualState): string {
  return visualState === 'available'
    ? 'ss-targeting-glow ss-targeting-glow-pulse'
    : 'ss-targeting-glow';
}

export function getTargetingGlowStyle(
  visualState: TargetingVisualState,
  scale = 1,
  selectedTone: BoardTargetSelectedTone = 'red'
): CSSProperties {
  const sizePx = TARGETING_GLOW_SIZE_PX * scale;
  const selectedGlow = selectedTone === 'cyan'
    ? TARGETING_CYAN_GLOW
    : selectedTone === 'purple'
      ? TARGETING_PURPLE_GLOW
      : TARGETING_RED_GLOW;

  return {
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    backgroundImage: visualState === 'selected' ? selectedGlow : TARGETING_WHITE_GLOW,
    opacity: visualState === 'available' ? 0.55 : 1,
    pointerEvents: 'none',
  };
}

export function getTargetingPreviewStyle(
  visualState: Extract<TargetingVisualState, 'hovered' | 'selected'>,
  previewScaleMultiplier = 1
): React.CSSProperties {
  const previewScale = TARGETING_PREVIEW_SCALE * previewScaleMultiplier;

  return {
    top: '100%',
    opacity: visualState === 'selected' ? 1 : 0.5,
    pointerEvents: 'none',
    transform: `translate(-50%, ${TARGETING_PREVIEW_OFFSET_PX}px) scale(${previewScale})`,
    transformOrigin: 'top center',
  };
}

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
  OXI: { entry: 'xenite', activation: 'xenite' },
  AST: { entry: 'xenite', activation: 'xenite' },
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
  FAM: { entry: 'starship', activation: 'carrier' },
  LEG: { entry: 'to-right', activation: 'default' },
  TER: { entry: 'to-right', activation: 'default' },
  FUR: { entry: 'to-right', activation: 'default' },
  KNO: { entry: 'default', activation: 'default' },
  ENT: { entry: 'to-right', activation: 'default' },
  RED: { entry: 'default', activation: 'default' },
  POW: { entry: 'default', activation: 'default' },
  DES: { entry: 'default', activation: 'default' },
  DOM: { entry: 'default', activation: 'default' },

  // Ancient ships
  PLU: { entry: 'default', activation: 'default' },
  MER: { entry: 'default', activation: 'default' },
  QUA: { entry: 'defender', activation: 'default' },
  SPI: { entry: 'commander', activation: 'default' },
  NEP: { entry: 'default', activation: 'default' },
  SOL: { entry: 'to-right', activation: 'default' },
  CUB: { entry: 'default', activation: 'default' },
};

// ============================================================================
// ACTIVATION SCALE HELPER
// ============================================================================

/**
 * Compute activation scale based on stack count
 */
export function computeActivationScale(stackCount: number): number {
  const base = 0.944;
  const k = 0.206;
  const max = 2.4;

  const scale = base + k * Math.sqrt(Math.max(0, stackCount));
  return Math.min(scale, max);
}

// ============================================================================
// SHIP ANIMATION WRAPPER
// ============================================================================

interface ShipAnimationWrapperProps {
  shipDefId: ShipDefId;
  token?: ShipAnimToken;
  enableHoverActivation?: boolean;
  activationDelayMs?: number; // Paired activation stagger delay
  children: React.ReactNode;
}

export function ShipAnimationWrapper({
  shipDefId,
  token,
  enableHoverActivation = false,
  activationDelayMs = 0,
  children,
}: ShipAnimationWrapperProps) {
  const activationNonce = token?.activationNonce ?? 0;
  const previousActivationNonceRef = useRef(activationNonce);
  const [activeActivationNonce, setActiveActivationNonce] = useState<number | null>(null);

  useEffect(() => {
    const previousActivationNonce = previousActivationNonceRef.current;
    previousActivationNonceRef.current = activationNonce;

    if (activationNonce === 0) {
      setActiveActivationNonce(null);
      return;
    }

    if (activationNonce !== previousActivationNonce) {
      setActiveActivationNonce(activationNonce);
    }
  }, [activationNonce]);

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
  const isExplicitActivationActive =
    activationNonce > 0 && activeActivationNonce === activationNonce;

  const handleActivationAnimationEnd = (
    event: AnimationEvent<HTMLDivElement>,
    completedActivationNonce: number
  ) => {
    if (event.currentTarget !== event.target) {
      return;
    }

    setActiveActivationNonce((current) =>
      current === completedActivationNonce ? null : current
    );
  };

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
      >
        {/* Stack-add pulse layer (keyed by stackAddNonce) */}
        <div
          key={`stackadd-${token.stackAddNonce}`}
          className={token.stackAddNonce > 0 ? 'ss-stack-add' : ''}
        >
          {/* Activation animation layer (keyed by activationNonce) */}
          <div
            key={`activate-${activationNonce}`}
            className={`ss-shipActivateLayer ${isExplicitActivationActive ? activationPreset.activationClass : ''}`}
            style={{
              animationDelay: isExplicitActivationActive && activationDelayMs > 0 ? `${activationDelayMs}ms` : undefined,
            }}
            onAnimationEnd={(event) =>
              handleActivationAnimationEnd(event, activationNonce)
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SOLAR LEDGER ANIMATION SYSTEM
// ============================================================================

type SolarEntryMotionPresetId = 'none' | 'default' | 'commander' | 'asteroid';

const SOLAR_ENTRY_MOTION_BY_POWER_ID: Record<
  LiveRowAncientSolarPowerId,
  SolarEntryMotionPresetId
> = {
  SLIF: 'default',
  SSTA: 'none',
  SAST: 'asteroid',
  SSUP: 'none',
  SCON: 'commander',
  SSIP: 'none',
  SVOR: 'none',
  SBLA: 'none',
  SSIM: 'none',
};

const SOLAR_ENTRY_MOTION_CLASS_BY_PRESET: Record<SolarEntryMotionPresetId, string> = {
  none: '',
  default: 'ss-solarEntryMotion-default',
  commander: 'ss-solarEntryMotion-commander',
  asteroid: 'ss-solarEntryMotion-asteroid',
};

export function SolarPowerAnimationWrapper({
  solarPowerId,
  token,
  clearing = false,
  children,
}: {
  solarPowerId: LiveRowAncientSolarPowerId;
  token?: SolarPowerEntryAnimToken;
  clearing?: boolean;
  children: React.ReactNode;
}) {
  const state: SolarPowerEntryVisualState = clearing
    ? 'clearing'
    : token
      ? 'active'
      : 'settled';
  const motionClass = SOLAR_ENTRY_MOTION_CLASS_BY_PRESET[
    SOLAR_ENTRY_MOTION_BY_POWER_ID[solarPowerId]
  ];
  const entryKey = token?.entryNonce ?? 'settled';

  return (
    <div
      className="ss-solarPowerAnimRoot"
      data-solar-entry-state={state}
      style={{
        '--ss-solar-entry-delay': `${token?.staggerDelayMs ?? 0}ms`,
      } as CSSProperties}
    >
      <div
        key={`solar-entry-${entryKey}`}
        className={state === 'active' ? 'ss-solarEntryFade' : undefined}
      >
        <div className={state === 'active' ? motionClass : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

export const SOLAR_LEDGER_REVEAL_CLEAR_ANIMATION_NAME = 'ssSolarLedgerRevealClear';
export const SOLAR_LEDGER_REVEAL_CLEAR_REDUCED_ANIMATION_NAME =
  'ssSolarLedgerRevealClearReduced';

export function SolarLedgerClearAnimationWrapper({
  active,
  children,
  onAnimationEnd,
}: {
  active: boolean;
  children: React.ReactNode;
  onAnimationEnd?: AnimationEventHandler<HTMLDivElement>;
}) {
  const handleAnimationEnd: AnimationEventHandler<HTMLDivElement> = (event) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (
      event.animationName !== SOLAR_LEDGER_REVEAL_CLEAR_ANIMATION_NAME &&
      event.animationName !== SOLAR_LEDGER_REVEAL_CLEAR_REDUCED_ANIMATION_NAME
    ) {
      return;
    }

    onAnimationEnd?.(event);
  };

  return (
    <div
      className="ss-solarLedgerClear"
      data-clearing={active ? 'true' : 'false'}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}

// ============================================================================
// TURN INCREMENT PULSE
// ============================================================================

export interface TurnIncrementPulseOptions {
  enabled: boolean;
  turn: number | null;
}

export interface TurnIncrementPulseState {
  isActive: boolean;
  runKey: number;
  onAnimationEnd: (event: AnimationEvent<HTMLDivElement>) => void;
}

export const BOARD_TURN_PULSE_LIFECYCLE_ANIMATION_NAME = 'ssBoardTurnPulseLifecycle';

export function useTurnIncrementPulse({
  enabled,
  turn,
}: TurnIncrementPulseOptions): TurnIncrementPulseState {
  const previousTurnRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!enabled || turn === null) {
      previousTurnRef.current = null;
      setIsActive(false);
      return;
    }

    const previousTurn = previousTurnRef.current;

    if (previousTurn === null) {
      previousTurnRef.current = turn;
      return;
    }

    previousTurnRef.current = turn;

    if (turn <= previousTurn) {
      return;
    }

    setIsActive(true);
    setRunKey((current) => current + 1);
  }, [enabled, turn]);

  function onAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.animationName !== BOARD_TURN_PULSE_LIFECYCLE_ANIMATION_NAME) {
      return;
    }

    setIsActive(false);
  }

  return {
    isActive,
    runKey,
    onAnimationEnd,
  };
}

export interface PhaseEntryPulseOptions {
  enabled: boolean;
  phaseKey: string | null;
  targetPhaseKey: string;
}

export function usePhaseEntryPulse({
  enabled,
  phaseKey,
  targetPhaseKey,
}: PhaseEntryPulseOptions): TurnIncrementPulseState {
  const prefersReducedMotion = usePrefersReducedMotion();
  const previousPhaseRef = useRef<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!enabled || prefersReducedMotion) {
      setIsActive(false);
    }
  }, [enabled, prefersReducedMotion]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phaseKey;

    if (!enabled || prefersReducedMotion || phaseKey === null) {
      return;
    }

    if (previousPhase === null) {
      return;
    }

    if (phaseKey !== targetPhaseKey || previousPhase === targetPhaseKey) {
      return;
    }

    setIsActive(true);
    setRunKey((current) => current + 1);
  }, [enabled, phaseKey, prefersReducedMotion, targetPhaseKey]);

  function onAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.animationName !== BOARD_TURN_PULSE_LIFECYCLE_ANIMATION_NAME) {
      return;
    }

    setIsActive(false);
  }

  return {
    isActive,
    runKey,
    onAnimationEnd,
  };
}

// ============================================================================
// LEFT RAIL TURN TAKEOVER
// ============================================================================

export interface TurnTakeoverState {
  turn: number | null;
  runKey: number;
  timingStyle: CSSProperties;
  onOverlayAnimationEnd: (event: AnimationEvent<HTMLDivElement>) => void;
}

export const TURN_TAKEOVER_LIFECYCLE_ANIMATION_NAME = 'ssLeftRailTurnTakeoverLifecycle';
export const TURN_TAKEOVER_WIPE_IN_MS = 280;
export const TURN_TAKEOVER_TEXT_IN_DELAY_MS = 48;
export const TURN_TAKEOVER_TEXT_IN_MS = 320;
export const TURN_TAKEOVER_HOLD_MS = 1300;
export const TURN_TAKEOVER_TEXT_OUT_MS = 360;
export const TURN_TAKEOVER_WIPE_OUT_DELAY_MS = 30;
export const TURN_TAKEOVER_WIPE_OUT_MS = 180;
export const TURN_TAKEOVER_ENTER_SETTLE_MS = Math.max(
  TURN_TAKEOVER_WIPE_IN_MS,
  TURN_TAKEOVER_TEXT_IN_DELAY_MS + TURN_TAKEOVER_TEXT_IN_MS,
);
export const TURN_TAKEOVER_EXIT_SETTLE_MS = Math.max(
  TURN_TAKEOVER_TEXT_OUT_MS,
  TURN_TAKEOVER_WIPE_OUT_DELAY_MS + TURN_TAKEOVER_WIPE_OUT_MS,
);
export const TURN_TAKEOVER_TOTAL_MS =
  TURN_TAKEOVER_ENTER_SETTLE_MS + TURN_TAKEOVER_HOLD_MS + TURN_TAKEOVER_EXIT_SETTLE_MS;

export const TURN_TAKEOVER_TIMING_STYLE = {
  '--ss-turn-takeover-total': `${TURN_TAKEOVER_TOTAL_MS}ms`,
  '--ss-turn-takeover-wipe-in': `${TURN_TAKEOVER_WIPE_IN_MS}ms`,
  '--ss-turn-takeover-text-in-delay': `${TURN_TAKEOVER_TEXT_IN_DELAY_MS}ms`,
  '--ss-turn-takeover-text-in': `${TURN_TAKEOVER_TEXT_IN_MS}ms`,
  '--ss-turn-takeover-text-out': `${TURN_TAKEOVER_TEXT_OUT_MS}ms`,
  '--ss-turn-takeover-wipe-out-delay': `${TURN_TAKEOVER_WIPE_OUT_DELAY_MS}ms`,
  '--ss-turn-takeover-wipe-out': `${TURN_TAKEOVER_WIPE_OUT_MS}ms`,
} as CSSProperties;

export function useLeftRailTurnTakeover(args: {
  turn: number | null;
  animateKey: number;
}): TurnTakeoverState {
  const { turn, animateKey } = args;
  const previousAnimateKeyRef = useRef<number>(animateKey);
  const [displayedTurn, setDisplayedTurn] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (animateKey <= previousAnimateKeyRef.current) {
      previousAnimateKeyRef.current = animateKey;
      return;
    }

    previousAnimateKeyRef.current = animateKey;

    if (turn === null) {
      return;
    }

    setDisplayedTurn(turn);
    setRunKey((current) => current + 1);
  }, [animateKey, turn]);

  function onOverlayAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.animationName !== TURN_TAKEOVER_LIFECYCLE_ANIMATION_NAME) {
      return;
    }

    setDisplayedTurn(null);
  }

  return {
    turn: displayedTurn,
    runKey,
    timingStyle: TURN_TAKEOVER_TIMING_STYLE,
    onOverlayAnimationEnd,
  };
}
