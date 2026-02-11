/**
 * useFlipLayout
 * -------------
 * FLIP (First-Last-Invert-Play) layout animation hook.
 *
 * Animates existing elements from their previous position to their new position
 * when layout changes, providing smooth repositioning.
 *
 * IMPORTANT:
 * - Measures on every commit and animates whenever any rect delta exists.
 * - Uses useLayoutEffect so the invert happens before paint.
 * - Applies transform ONLY to the element receiving the ref callback.
 * - New elements (no previous rect) do not get FLIP; they rely on entry animation.
 *
 * USAGE:
 * const getFlipRef = useFlipLayout(keys, enabled, { durationMs: 400, easing: 'ease-in-out' });
 * <div ref={getFlipRef(key)}>...</div>
 */

import { useLayoutEffect, useMemo, useRef } from 'react';

export interface FlipLayoutOptions {
  durationMs?: number;
  easing?: string;
}

export function useFlipLayout<T extends string | number>(
  keys: T[],
  enabled: boolean,
  options?: FlipLayoutOptions
): (key: T) => (el: HTMLElement | null) => void {
  const durationMs = options?.durationMs ?? 400;
  const easing = options?.easing ?? 'ease-in-out';

  // Elements by key
  const elementsRef = useRef<Map<T, HTMLElement>>(new Map());

  // Previous rects (from prior commit)
  const prevRectsRef = useRef<Map<T, DOMRect>>(new Map());

  // Stable ref factory
  const getRefCallback = useMemo(() => {
    return (key: T) => (el: HTMLElement | null) => {
      const map = elementsRef.current;
      if (el) map.set(key, el);
      else map.delete(key);
    };
  }, []);

  useLayoutEffect(() => {
    const elements = elementsRef.current;

    // Measure current rects for all current keys
    const nextRects = new Map<T, DOMRect>();
    for (const key of keys) {
      const el = elements.get(key);
      if (el) nextRects.set(key, el.getBoundingClientRect());
    }

    // Always refresh rect memory when disabled so re-enabling doesn't jump
    if (!enabled) {
      prevRectsRef.current = nextRects;
      return;
    }

    const prevRects = prevRectsRef.current;

    // Invert: Apply transforms for elements that existed previously and moved
    for (const key of keys) {
      const el = elements.get(key);
      const prev = prevRects.get(key);
      const next = nextRects.get(key);
      if (!el || !prev || !next) continue;

      const dx = prev.left - next.left;
      const dy = prev.top - next.top;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

      // Invert immediately
      el.style.transition = 'transform 0s';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // Play: double RAF ensures the browser commits inverted transform before transitioning back
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        for (const key of keys) {
          const el = elements.get(key);
          const prev = prevRects.get(key);
          const next = nextRects.get(key);
          if (!el || !prev || !next) continue;

          const dx = prev.left - next.left;
          const dy = prev.top - next.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

          el.style.transition = `transform ${durationMs}ms ${easing}`;
          el.style.transform = '';

          const cleanup = () => {
            el.style.transition = '';
            el.style.transform = '';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
        }
      });

      return () => cancelAnimationFrame(raf2);
    });

    // Store current rects for the next commit
    prevRectsRef.current = nextRects;

    return () => cancelAnimationFrame(raf1);
  }, [enabled, durationMs, easing, keys.join('|')]);

  return getRefCallback;
}
