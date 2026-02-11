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
import { generateStars, STARS_CONFIG, type StarSpec } from './animation-stars';

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

export function StarsBackground() {
  const prefersReducedMotion = usePrefersReducedMotion();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

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

  const keyframesCss = useMemo(() => {
    if (!stars.length) return '';
    return stars
      .map(
        (s) => `
@keyframes ss_star_drift_${s.id} {
  from { transform: translate3d(0px, 0px, 0px); }
  to   { transform: translate3d(${s.dx.toFixed(2)}px, ${s.dy.toFixed(2)}px, 0px); }
}`
      )
      .join('\n');
  }, [stars]);

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
      {keyframesCss ? <style>{keyframesCss}</style> : null}

      {stars.map((s) => {
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

        if (s.kind === 'star') {
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
                width: `${STARS_CONFIG.blackHoleSizePx}px`,
                height: `${STARS_CONFIG.blackHoleSizePx}px`,
                borderRadius: 9999,
                background:
                  'radial-gradient(50% 50% at 50% 50%, #000 60%, rgba(0, 0, 0, 0.00) 100%)',
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
