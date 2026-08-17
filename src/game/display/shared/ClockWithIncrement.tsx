import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const INCREMENT_FADE_MS = 300;
const INCREMENT_HOLD_MS = 2000;
const INCREMENT_FADE_OUT_AT_MS = INCREMENT_FADE_MS + INCREMENT_HOLD_MS;
const INCREMENT_LIFECYCLE_MS = INCREMENT_FADE_OUT_AT_MS + INCREMENT_FADE_MS;

interface ClockWithIncrementProps {
  clock: string;
  incrementSeconds: number | null;
  scopeKey: string | null;
  turnNumber: number | null;
  variant: 'desktop' | 'mobile';
}

interface IncrementTriggerBaseline {
  scopeKey: string;
  highestTurnNumber: number | null;
}

export function ClockWithIncrement({
  clock,
  incrementSeconds,
  scopeKey,
  turnNumber,
  variant,
}: ClockWithIncrementProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const triggerBaselineRef = useRef<IncrementTriggerBaseline | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const fadeOutTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);
  const [isCueMounted, setIsCueMounted] = useState(false);
  const [isCueVisible, setIsCueVisible] = useState(false);

  function clearCueLifecycle() {
    if (enterFrameRef.current !== null) {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }

    if (fadeOutTimerRef.current !== null) {
      window.clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }

    if (removeTimerRef.current !== null) {
      window.clearTimeout(removeTimerRef.current);
      removeTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearCueLifecycle();
  }, []);

  useEffect(() => {
    if (!scopeKey) {
      triggerBaselineRef.current = null;
      clearCueLifecycle();
      setIsCueMounted(false);
      setIsCueVisible(false);
      return;
    }

    const baseline = triggerBaselineRef.current;
    if (!baseline || baseline.scopeKey !== scopeKey) {
      triggerBaselineRef.current = {
        scopeKey,
        highestTurnNumber:
          turnNumber !== null && Number.isFinite(turnNumber) ? turnNumber : null,
      };
      clearCueLifecycle();
      setIsCueMounted(false);
      setIsCueVisible(false);
      return;
    }

    if (turnNumber === null || !Number.isFinite(turnNumber)) {
      return;
    }

    if (baseline.highestTurnNumber === null) {
      baseline.highestTurnNumber = turnNumber;
      return;
    }

    if (turnNumber <= baseline.highestTurnNumber) {
      return;
    }

    baseline.highestTurnNumber = turnNumber;
    clearCueLifecycle();
    setIsCueMounted(false);
    setIsCueVisible(false);

    if (turnNumber < 2) {
      return;
    }

    if (incrementSeconds === null || incrementSeconds <= 0) {
      return;
    }

    setIsCueMounted(true);

    if (prefersReducedMotion) {
      setIsCueVisible(true);
    } else {
      enterFrameRef.current = window.requestAnimationFrame(() => {
        enterFrameRef.current = null;
        setIsCueVisible(true);
      });

      fadeOutTimerRef.current = window.setTimeout(() => {
        fadeOutTimerRef.current = null;
        setIsCueVisible(false);
      }, INCREMENT_FADE_OUT_AT_MS);
    }

    removeTimerRef.current = window.setTimeout(() => {
      removeTimerRef.current = null;
      setIsCueMounted(false);
      setIsCueVisible(false);
    }, INCREMENT_LIFECYCLE_MS);
  }, [incrementSeconds, prefersReducedMotion, scopeKey, turnNumber]);

  const cueClassName = variant === 'desktop'
    ? 'ml-[8px] text-[17px]'
    : 'ml-[2px] text-[9px]';

  return (
    <span className="relative inline-block">
      {clock}
      {isCueMounted ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap font-medium leading-none text-[var(--shapeships-grey-20)] ${cueClassName}`}
          style={{
            opacity: isCueVisible ? 1 : 0,
            transition: prefersReducedMotion
              ? 'none'
              : `opacity ${INCREMENT_FADE_MS}ms ease-in-out`,
          }}
        >
          +{incrementSeconds}
        </span>
      ) : null}
    </span>
  );
}
