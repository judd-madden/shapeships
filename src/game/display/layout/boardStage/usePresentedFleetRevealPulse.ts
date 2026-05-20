import { useEffect, useRef, useState, type AnimationEvent } from 'react';
import {
  BOARD_TURN_PULSE_LIFECYCLE_ANIMATION_NAME,
  type TurnIncrementPulseState,
} from '../../graphics/animation';

export const INACTIVE_TURN_PULSE_STATE: TurnIncrementPulseState = {
  isActive: false,
  runKey: 0,
  onAnimationEnd: () => {},
};

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) {
      return;
    }

    const update = () => setPrefersReducedMotion(Boolean(mediaQuery.matches));

    update();
    mediaQuery.addEventListener?.('change', update);

    return () => {
      mediaQuery.removeEventListener?.('change', update);
    };
  }, []);

  return prefersReducedMotion;
}

export function usePresentedFleetRevealPulse(sequence: number | null): TurnIncrementPulseState {
  const prefersReducedMotion = usePrefersReducedMotion();
  const previousSequenceRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsActive(false);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const previousSequence = previousSequenceRef.current;
    previousSequenceRef.current = sequence;

    if (sequence === null || prefersReducedMotion) {
      return;
    }

    if (previousSequence === null || sequence <= previousSequence) {
      return;
    }

    setIsActive(true);
  }, [prefersReducedMotion, sequence]);

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
    runKey: sequence ?? 0,
    onAnimationEnd,
  };
}
