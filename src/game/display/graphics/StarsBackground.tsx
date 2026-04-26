/**
 * Stars Background Component
 * ==========================
 * 
 * Renders a one-shot drifting stars layer:
 * - 2-5 white circles at random positions
 * - Each drifts in a straight line until off-screen (no looping)
 * - Rarely includes Black Hole (radial gradient) or Saturn (planet + ring)
 * - Uses transform animations only (no layout thrash)
 * - Respects prefers-reduced-motion
 * - pointer-events: none (no interaction blocking)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  generateShootingStar,
  generateStars,
  STARS_CONFIG,
  type StarSpec,
} from './animation-stars';

const SHOOTING_STAR_MIN_DELAY_MS = 0.5 * 60 * 1000;
const SHOOTING_STAR_MAX_DELAY_MS = 3 * 60 * 1000;
const ENDGAME_BURST_STAR_COUNT = 50;
const ENDGAME_BURST_WINDOW_MS = 1200;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const update = () => setReduced(!!mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

interface StarsBackgroundProps {
  celebrateOnFinish?: boolean;
}

export function StarsBackground({ celebrateOnFinish = false }: StarsBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const [shootingStar, setShootingStar] = useState<StarSpec | null>(null);
  const [celebrationStars, setCelebrationStars] = useState<StarSpec[]>([]);
  const previousCelebrateOnFinishRef = useRef(celebrateOnFinish);
  const shootingStarSpawnTimeoutRef = useRef<number | null>(null);
  const shootingStarCleanupTimeoutRef = useRef<number | null>(null);
  const celebrationCleanupTimeoutRef = useRef<number | null>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewport({ width: Math.max(0, r.width), height: Math.max(0, r.height) });
    };

    measure();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);

    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Generate once when viewport becomes known (no reroll during session)
  const starsRef = useRef<StarSpec[] | null>(null);
  if (viewport && !starsRef.current) {
    starsRef.current = generateStars(viewport, STARS_CONFIG);
  }

  const stars = starsRef.current ?? [];
  const animatedStars = prefersReducedMotion
    ? stars
    : [
        ...stars,
        ...(shootingStar ? [shootingStar] : []),
        ...celebrationStars,
      ];

  const localStylesCss = useMemo(() => {
    return animatedStars
      .map(
        (s) => `
@keyframes ss_star_drift_${s.id} {
  from { transform: translate3d(0px, 0px, 0px); }
  to   { transform: translate3d(${s.dx.toFixed(2)}px, ${s.dy.toFixed(2)}px, 0px); }
}`
      )
      .join('\n');
  }, [animatedStars]);

  useEffect(() => {
    if (!prefersReducedMotion) return;
    setShootingStar((current) => (current ? null : current));
    setCelebrationStars((current) => (current.length > 0 ? [] : current));
  }, [prefersReducedMotion]);

  useEffect(() => {
    const wasFinished = previousCelebrateOnFinishRef.current;
    const didJustFinish = !wasFinished && celebrateOnFinish;

    if (!didJustFinish) {
      previousCelebrateOnFinishRef.current = celebrateOnFinish;
      return;
    }

    if (prefersReducedMotion) {
      previousCelebrateOnFinishRef.current = celebrateOnFinish;
      return;
    }

    if (!viewport) {
      return;
    }

    const burstStars = Array.from({ length: ENDGAME_BURST_STAR_COUNT }, () => {
      const shootingStar = generateShootingStar(viewport, STARS_CONFIG);
      return {
        ...shootingStar,
        delayMs: Math.round(Math.random() * ENDGAME_BURST_WINDOW_MS),
      };
    });

    setCelebrationStars(burstStars);
    previousCelebrateOnFinishRef.current = celebrateOnFinish;
  }, [celebrateOnFinish, prefersReducedMotion, viewport]);

  useEffect(() => {
    if (!viewport || prefersReducedMotion || shootingStar) return;

    const delayRangeMs = SHOOTING_STAR_MAX_DELAY_MS - SHOOTING_STAR_MIN_DELAY_MS;
    const delayMs =
      SHOOTING_STAR_MIN_DELAY_MS +
      (delayRangeMs <= 0 ? 0 : Math.random() * delayRangeMs);

    shootingStarSpawnTimeoutRef.current = window.setTimeout(() => {
      shootingStarSpawnTimeoutRef.current = null;
      setShootingStar(generateShootingStar(viewport, STARS_CONFIG));
    }, Math.round(delayMs));

    return () => {
      if (shootingStarSpawnTimeoutRef.current !== null) {
        window.clearTimeout(shootingStarSpawnTimeoutRef.current);
        shootingStarSpawnTimeoutRef.current = null;
      }
    };
  }, [
    SHOOTING_STAR_MAX_DELAY_MS,
    SHOOTING_STAR_MIN_DELAY_MS,
    prefersReducedMotion,
    shootingStar,
    viewport,
  ]);

  useEffect(() => {
    if (!shootingStar || prefersReducedMotion) return;

    shootingStarCleanupTimeoutRef.current = window.setTimeout(() => {
      shootingStarCleanupTimeoutRef.current = null;
      setShootingStar((current) => (current?.id === shootingStar.id ? null : current));
    }, Math.round(shootingStar.durationMs) + 120);

    return () => {
      if (shootingStarCleanupTimeoutRef.current !== null) {
        window.clearTimeout(shootingStarCleanupTimeoutRef.current);
        shootingStarCleanupTimeoutRef.current = null;
      }
    };
  }, [prefersReducedMotion, shootingStar]);

  useEffect(() => {
    if (celebrationCleanupTimeoutRef.current !== null) {
      window.clearTimeout(celebrationCleanupTimeoutRef.current);
      celebrationCleanupTimeoutRef.current = null;
    }

    if (celebrationStars.length === 0 || prefersReducedMotion) {
      return;
    }

    const cleanupDelayMs =
      Math.max(...celebrationStars.map((star) => star.delayMs + star.durationMs)) + 120;

    celebrationCleanupTimeoutRef.current = window.setTimeout(() => {
      celebrationCleanupTimeoutRef.current = null;
      setCelebrationStars((current) => (current === celebrationStars ? [] : current));
    }, Math.round(cleanupDelayMs));

    return () => {
      if (celebrationCleanupTimeoutRef.current !== null) {
        window.clearTimeout(celebrationCleanupTimeoutRef.current);
        celebrationCleanupTimeoutRef.current = null;
      }
    };
  }, [celebrationStars, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {localStylesCss ? <style>{localStylesCss}</style> : null}

      {animatedStars.map((s) => {
        const animStyle: React.CSSProperties = prefersReducedMotion
          ? {}
          : {
              willChange: 'transform',
              animationName: `ss_star_drift_${s.id}`,
              animationDuration: `${Math.round(s.durationMs)}ms`,
              animationDelay: `${Math.round(s.delayMs)}ms`,
              animationTimingFunction: 'linear',
              animationIterationCount: 1,
              animationFillMode: 'forwards',
            };

        const common: React.CSSProperties = {
          position: 'absolute',
          left: `${s.x}px`,
          top: `${s.y}px`,
          ...animStyle,
        };

        if (s.kind === 'star' || s.kind === 'shootingStar') {
          return (
            <div
              key={s.id}
              style={{
                ...common,
                width: `${s.sizePx}px`,
                height: `${s.sizePx}px`,
                borderRadius: 9999,
                background: '#FFF',
              }}
            />
          );
        }

        if (s.kind === 'blackHole') {
          return (
            <div
              key={s.id}
              style={{
                ...common,
                width: `${s.sizePx}px`,
                height: `${s.sizePx}px`,
                borderRadius: 9999,
                background: 'radial-gradient(circle at 50% 50%, #000 0 55%, rgba(140, 190, 255, 0.25) 60%, rgba(0,0,0,0) 75%)',
              }}
            />
          );
        }

        // saturn: base 6px circle with a ring div on top
        return (
          <div
            key={s.id}
            style={{
              ...common,
              width: `${STARS_CONFIG.saturnPlanetSizePx}px`,
              height: `${STARS_CONFIG.saturnPlanetSizePx}px`,
              borderRadius: 9999,
              background: '#FFF',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: `${STARS_CONFIG.saturnRingWidthPx}px`,
                height: `${STARS_CONFIG.saturnRingHeightPx}px`,
                borderRadius: 9999,
                background: '#FFF',
                transform: `translate(-50%, -50%) rotate(${STARS_CONFIG.saturnRingRotationDeg}deg)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
