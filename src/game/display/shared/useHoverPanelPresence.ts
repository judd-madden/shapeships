import { useEffect, useRef, useState } from 'react';

export const HOVER_PANEL_MOTION_DURATION_MS = 80;

export type HoverPanelMotionState = 'entering' | 'active' | 'exiting';

interface HoverPanelPresenceResult<T> {
  presentValue: T | null;
  motionState: HoverPanelMotionState | null;
}

export function useHoverPanelPresence<T>(
  activeValue: T | null,
  durationMs = HOVER_PANEL_MOTION_DURATION_MS
): HoverPanelPresenceResult<T> {
  const [presentValue, setPresentValue] = useState<T | null>(activeValue);
  const [motionState, setMotionState] = useState<HoverPanelMotionState | null>(
    activeValue !== null ? 'entering' : null
  );
  const presentValueRef = useRef<T | null>(activeValue);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearPendingMotion() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    clearPendingMotion();

    if (activeValue !== null) {
      presentValueRef.current = activeValue;
      setPresentValue(activeValue);
      setMotionState('entering');
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setMotionState('active');
      });
      return;
    }

    if (presentValueRef.current === null) {
      setPresentValue(null);
      setMotionState(null);
      return;
    }

    setMotionState('exiting');
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      presentValueRef.current = null;
      setPresentValue(null);
      setMotionState(null);
    }, durationMs);
  }, [activeValue, durationMs]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { presentValue, motionState };
}
