import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  getTargetingGlowClassName,
  getTargetingGlowStyle,
  getTargetingPreviewStyle,
} from './animation';
import { usePrefersReducedMotion } from '../shared/usePrefersReducedMotion';

export type ShipEffectKind = 'destroy' | 'copy' | 'steal';

// Shared by every instance; keep the provisional timeline easy to tune.
export const SHIP_EFFECT_TIMING = {
  durationMs: 2000,
  impactMs: 200,
  blackenStartMs: 350,
  blackenEndMs: 850,
  destructionStartMs: 650,
  glowFadeStartMs: 650,
  sourceFadeStartMs: 450,
  sourceFadeEndMs: 1300,
} as const;

export interface ShipEffectAnimationProps {
  effect: ShipEffectKind;
  activationKey: string | number | null;
  children: ReactNode;
  sourceIcon: ReactNode;
  sourcePreviewScaleMultiplier?: number;
  onImpact?: () => void;
}

/** Presentation only. The caller supplies the target and activation, never rules. */
export function ShipEffectAnimation({
  effect,
  activationKey,
  children,
  sourceIcon,
  sourcePreviewScaleMultiplier = 1,
  onImpact,
}: ShipEffectAnimationProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<{ key: string | number; angle: number } | null>(null);
  const onImpactRef = useRef(onImpact);
  const lastImpactKeyRef = useRef<string | number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasSourceIcon = sourceIcon != null && sourceIcon !== false;
  const tone = effect === 'copy' ? 'cyan' : effect === 'steal' ? 'purple' : 'red';

  useLayoutEffect(() => {
    onImpactRef.current = onImpact;
  });

  useLayoutEffect(() => {
    if (activationKey === null) {
      rotationRef.current = null;
      lastImpactKeyRef.current = null;
      return;
    }

    const target = targetRef.current;
    const glow = glowRef.current;
    if (!target || !glow) return;

    const timing = SHIP_EFFECT_TIMING;
    const animations: Animation[] = [];
    const startTime = document.timeline.currentTime;
    const animate = (
      element: Element,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions
    ) => {
      const animation = element.animate(keyframes, options);
      // All tracks for this target use one clock, including delayed tracks.
      if (startTime !== null) animation.startTime = startTime;
      animations.push(animation);
    };

    const glowDuration = timing.durationMs - timing.impactMs;
    animate(glow, [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: (timing.glowFadeStartMs - timing.impactMs) / glowDuration },
      { opacity: 0, offset: 1 },
    ], { delay: timing.impactMs, duration: glowDuration, fill: 'forwards' });

    if (sourceRef.current) {
      animate(sourceRef.current, [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: timing.sourceFadeStartMs / timing.sourceFadeEndMs },
        { opacity: 0, offset: 1 },
      ], { duration: timing.sourceFadeEndMs, fill: 'both' });
    }

    let impactTimeout: number | undefined;
    if (effect === 'destroy') {
      if (rotationRef.current?.key !== activationKey) {
        rotationRef.current = { key: activationKey, angle: Math.random() * 80 - 40 };
      }
      const angle = rotationRef.current.angle;

      // Inspect only rendered geometry. Do not paint fills or add missing strokes.
      const geometry = target.querySelectorAll<SVGElement>(
        'path, rect, circle, ellipse, line, polyline, polygon, text, use'
      );
      for (const element of geometry) {
        if (element.closest('defs, clipPath, mask, marker, pattern, symbol')) continue;
        const style = window.getComputedStyle(element);
        if (
          style.stroke === 'none' ||
          Number.parseFloat(style.strokeWidth) === 0 ||
          Number.parseFloat(style.strokeOpacity) === 0 ||
          Number.parseFloat(style.opacity) === 0 ||
          style.visibility === 'hidden' || style.display === 'none'
        ) continue;
        animate(element, [{ stroke: style.stroke }, { stroke: '#000000' }], {
          delay: timing.blackenStartMs,
          duration: timing.blackenEndMs - timing.blackenStartMs,
          fill: 'forwards',
        });
      }

      animate(target, [
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
        { opacity: 0, transform: prefersReducedMotion ? 'none' : `scale(1.35) rotate(${angle}deg)` },
      ], {
        delay: timing.destructionStartMs,
        duration: timing.durationMs - timing.destructionStartMs,
        easing: 'ease-out',
        fill: 'forwards',
      });

      if (onImpactRef.current && lastImpactKeyRef.current !== activationKey) {
        impactTimeout = window.setTimeout(() => {
          lastImpactKeyRef.current = activationKey;
          onImpactRef.current?.();
        }, timing.impactMs);
      }
    }

    return () => {
      if (impactTimeout !== undefined) window.clearTimeout(impactTimeout);
      for (const animation of animations) animation.cancel();
    };
  }, [activationKey, effect, hasSourceIcon, prefersReducedMotion]);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center overflow-visible align-top">
      <div
        ref={glowRef}
        aria-hidden="true"
        className={getTargetingGlowClassName('selected')}
        style={{ ...getTargetingGlowStyle('selected', 1, tone), opacity: 0 }}
      />
      <div ref={targetRef} className="relative z-10 inline-flex origin-center items-center justify-center">
        {children}
      </div>
      {hasSourceIcon ? (
        <div
          ref={sourceRef}
          aria-hidden="true"
          className="ss-targeting-preview z-20"
          style={{ ...getTargetingPreviewStyle('selected', sourcePreviewScaleMultiplier), opacity: 0 }}
        >
          {sourceIcon}
        </div>
      ) : null}
    </div>
  );
}
