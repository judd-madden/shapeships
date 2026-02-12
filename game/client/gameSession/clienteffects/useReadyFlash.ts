import { useEffect, useRef, useState } from 'react';

export function useReadyFlash(phaseKey: string) {
  const pendingReadyFlashRef = useRef(false);
  const prevPhaseKeyRef = useRef<string | null>(null);
  const [readyFlashUntilMs, setReadyFlashUntilMs] = useState(0);
  const [, forceRerender] = useState(0);
  const flashTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevPhaseKeyRef.current === null) {
      prevPhaseKeyRef.current = phaseKey;
      return;
    }

    if (phaseKey !== prevPhaseKeyRef.current) {
      if (pendingReadyFlashRef.current) {
        setReadyFlashUntilMs(Date.now() + 500);
        pendingReadyFlashRef.current = false;

        if (flashTimeoutRef.current !== null) {
          window.clearTimeout(flashTimeoutRef.current);
        }

        flashTimeoutRef.current = window.setTimeout(() => {
          flashTimeoutRef.current = null;
          forceRerender((n) => n + 1);
        }, 520);
      }

      prevPhaseKeyRef.current = phaseKey;
    }

    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [phaseKey]);

  const readyFlashSelected = Date.now() < readyFlashUntilMs;

  return { readyFlashSelected, pendingReadyFlashRef };
}
