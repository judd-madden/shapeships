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
  layoutSignature?: string | number;
  itemLayoutSignatures?: Record<string, string | number>;
  skipSelfChangedItemForNextRun?: boolean;
  ignoredAncestorScaleClassNames?: readonly string[];
}

type Scale2d = {
  scaleX: number;
  scaleY: number;
};

const IDENTITY_SCALE: Scale2d = { scaleX: 1, scaleY: 1 };

function isSafeScale(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function shouldIgnoreAncestorScale(
  ancestor: HTMLElement,
  ignoredAncestorScaleClassNames: readonly string[]
): boolean {
  return ignoredAncestorScaleClassNames.some((className) => ancestor.classList.contains(className));
}

function getAncestorTransformScale(
  element: HTMLElement,
  ignoredAncestorScaleClassNames: readonly string[]
): Scale2d {
  if (typeof window === 'undefined' || typeof window.DOMMatrixReadOnly !== 'function') {
    return IDENTITY_SCALE;
  }

  let scaleX = 1;
  let scaleY = 1;

  // Start at the parent. The animated element may already have a FLIP or entry transform.
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (shouldIgnoreAncestorScale(ancestor, ignoredAncestorScaleClassNames)) {
      continue;
    }

    const transform = window.getComputedStyle(ancestor).transform;
    if (!transform || transform === 'none') {
      continue;
    }

    let matrix: DOMMatrixReadOnly;
    try {
      matrix = new window.DOMMatrixReadOnly(transform);
    } catch {
      return IDENTITY_SCALE;
    }

    const ancestorScaleX = matrix.is2D
      ? Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b)
      : Math.sqrt(matrix.m11 * matrix.m11 + matrix.m12 * matrix.m12 + matrix.m13 * matrix.m13);
    const ancestorScaleY = matrix.is2D
      ? Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d)
      : Math.sqrt(matrix.m21 * matrix.m21 + matrix.m22 * matrix.m22 + matrix.m23 * matrix.m23);

    if (!isSafeScale(ancestorScaleX) || !isSafeScale(ancestorScaleY)) {
      return IDENTITY_SCALE;
    }

    scaleX *= ancestorScaleX;
    scaleY *= ancestorScaleY;

    if (!isSafeScale(scaleX) || !isSafeScale(scaleY)) {
      return IDENTITY_SCALE;
    }
  }

  return { scaleX, scaleY };
}

function getFlipDelta(
  el: HTMLElement,
  prev: DOMRect,
  next: DOMRect,
  ignoredAncestorScaleClassNames: readonly string[]
): { dx: number; dy: number } {
  const rawDx = prev.left - next.left;
  const rawDy = prev.top - next.top;
  const { scaleX, scaleY } = getAncestorTransformScale(el, ignoredAncestorScaleClassNames);

  return {
    dx: rawDx / scaleX,
    dy: rawDy / scaleY,
  };
}

export function useFlipLayout<T extends string | number>(
  keys: T[],
  enabled: boolean,
  options?: FlipLayoutOptions
): (key: T) => (el: HTMLElement | null) => void {
  const durationMs = options?.durationMs ?? 400;
  const easing = options?.easing ?? 'ease-in-out';
  const layoutSignature = options?.layoutSignature ?? '';
  const itemLayoutSignatures = options?.itemLayoutSignatures ?? {};
  const skipSelfChangedItemForNextRun = options?.skipSelfChangedItemForNextRun ?? false;
  const ignoredAncestorScaleClassNames = options?.ignoredAncestorScaleClassNames ?? [];
  const ignoredAncestorScaleClassNamesSignature = ignoredAncestorScaleClassNames.join('|');
  const keySignature = keys.join('|');

  // Elements by key
  const elementsRef = useRef<Map<T, HTMLElement>>(new Map());

  // Previous rects (from prior commit)
  const prevRectsRef = useRef<Map<T, DOMRect>>(new Map());

  // Previous per-item layout signatures, used to skip FLIP for self-footprint changes
  const prevItemLayoutSignaturesRef = useRef<Record<string, string | number>>({});

  // Keys whose self-footprint change should suppress one additional FLIP run
  const selfChangedItemCooldownRef = useRef<Set<string>>(new Set());

  // Invalidates pending RAF/transition work from older layout passes
  const runTokenRef = useRef(0);

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
    const prevItemLayoutSignatures = prevItemLayoutSignaturesRef.current;
    const cooldownSnapshot = new Set(selfChangedItemCooldownRef.current);
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    let raf1: number | null = null;
    let raf2: number | null = null;
    const touchedElements = new Set<HTMLElement>();
    const removeTransitionListeners: Array<() => void> = [];
    const changedItemLayoutKeys = new Set<string>();
    const skippedItemLayoutKeys = new Set<string>();

    const isCurrentRun = () => runTokenRef.current === runToken;
    const invalidateRun = () => {
      if (runTokenRef.current === runToken) {
        runTokenRef.current += 1;
      }
    };

    const cancelPendingFrames = () => {
      if (raf1 !== null) {
        cancelAnimationFrame(raf1);
        raf1 = null;
      }
      if (raf2 !== null) {
        cancelAnimationFrame(raf2);
        raf2 = null;
      }
    };
    const clearTouchedElements = () => {
      for (const el of touchedElements) {
        el.style.transition = '';
        el.style.transform = '';
      }
      touchedElements.clear();
    };
    const itemLayoutChanged = (key: T): boolean => {
      const signatureKey = String(key);
      return (
        Object.prototype.hasOwnProperty.call(prevItemLayoutSignatures, signatureKey) &&
        Object.prototype.hasOwnProperty.call(itemLayoutSignatures, signatureKey) &&
        prevItemLayoutSignatures[signatureKey] !== itemLayoutSignatures[signatureKey]
      );
    };

    for (const key of keys) {
      const signatureKey = String(key);
      const changedThisRun = itemLayoutChanged(key);
      const coolingDownThisRun =
        skipSelfChangedItemForNextRun && cooldownSnapshot.has(signatureKey);

      if (changedThisRun) {
        changedItemLayoutKeys.add(signatureKey);
      }
      if (changedThisRun || coolingDownThisRun) {
        skippedItemLayoutKeys.add(signatureKey);
      }
    }

    // Measure current rects for all current keys
    const nextRects = new Map<T, DOMRect>();
    for (const key of keys) {
      const el = elements.get(key);
      if (el) nextRects.set(key, el.getBoundingClientRect());
    }

    // Always refresh rect memory when disabled so re-enabling doesn't jump
    if (!enabled) {
      prevRectsRef.current = nextRects;
      prevItemLayoutSignaturesRef.current = itemLayoutSignatures;
      selfChangedItemCooldownRef.current = new Set();
      return;
    }

    const prevRects = prevRectsRef.current;

    // Invert: Apply transforms for elements that existed previously and moved
    for (const key of keys) {
      const el = elements.get(key);
      const prev = prevRects.get(key);
      const next = nextRects.get(key);
      if (!el || !prev || !next) continue;
      if (skippedItemLayoutKeys.has(String(key))) continue;

      const { dx, dy } = getFlipDelta(el, prev, next, ignoredAncestorScaleClassNames);

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

      // Invert immediately
      el.style.transition = 'transform 0s';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      touchedElements.add(el);
    }

    // Play: double RAF ensures the browser commits inverted transform before transitioning back
    raf1 = requestAnimationFrame(() => {
      raf1 = null;
      if (!isCurrentRun()) return;

      raf2 = requestAnimationFrame(() => {
        raf2 = null;
        if (!isCurrentRun()) return;

        for (const key of keys) {
          const el = elements.get(key);
          const prev = prevRects.get(key);
          const next = nextRects.get(key);
          if (!el || !prev || !next) continue;
          if (skippedItemLayoutKeys.has(String(key))) continue;

          const { dx, dy } = getFlipDelta(el, prev, next, ignoredAncestorScaleClassNames);
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

          if (!isCurrentRun()) return;
          el.style.transition = `transform ${durationMs}ms ${easing}`;
          el.style.transform = '';
          touchedElements.add(el);

          const cleanup = () => {
            if (!isCurrentRun()) {
              el.removeEventListener('transitionend', cleanup);
              touchedElements.delete(el);
              return;
            }
            el.style.transition = '';
            el.style.transform = '';
            el.removeEventListener('transitionend', cleanup);
            touchedElements.delete(el);
          };
          el.addEventListener('transitionend', cleanup);
          removeTransitionListeners.push(() => el.removeEventListener('transitionend', cleanup));
        }
      });
    });

    // Store current rects for the next commit
    prevRectsRef.current = nextRects;
    prevItemLayoutSignaturesRef.current = itemLayoutSignatures;
    selfChangedItemCooldownRef.current = skipSelfChangedItemForNextRun
      ? changedItemLayoutKeys
      : new Set();

    return () => {
      invalidateRun();
      cancelPendingFrames();
      for (const removeTransitionListener of removeTransitionListeners) {
        removeTransitionListener();
      }
      clearTouchedElements();
    };
  }, [
    enabled,
    durationMs,
    easing,
    keySignature,
    layoutSignature,
    skipSelfChangedItemForNextRun,
    ignoredAncestorScaleClassNamesSignature,
  ]);

  return getRefCallback;
}
