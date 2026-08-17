import { useEffect, useRef, useState } from 'react';

export type UntimedPollingMode = 'active' | 'idle' | 'hidden';

const IDLE_THRESHOLD_MS = 90000;
const IDLE_CHECK_INTERVAL_MS = 5000;

function isDocumentHidden(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.visibilityState !== 'visible';
}

function getInitialMode(): UntimedPollingMode {
  return isDocumentHidden() ? 'hidden' : 'active';
}

export function useUntimedPollingThrottle(): {
  mode: UntimedPollingMode;
  foregroundResumeToken: number;
} {
  const [mode, setMode] = useState<UntimedPollingMode>(() => getInitialMode());
  const [foregroundResumeToken, setForegroundResumeToken] = useState(0);
  const modeRef = useRef<UntimedPollingMode>(mode);
  const lastActivityAtRef = useRef(Date.now());
  const wasBackgroundedRef = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const setModeIfChanged = (nextMode: UntimedPollingMode) => {
      if (modeRef.current === nextMode) {
        return;
      }

      modeRef.current = nextMode;
      setMode(nextMode);
    };

    const emitForegroundResumeIfNeeded = () => {
      if (!wasBackgroundedRef.current) {
        return;
      }

      wasBackgroundedRef.current = false;
      setForegroundResumeToken((value) => value + 1);
    };

    const handleVisibleResume = () => {
      lastActivityAtRef.current = Date.now();

      if (isDocumentHidden()) {
        setModeIfChanged('hidden');
        return;
      }

      setModeIfChanged('active');
      emitForegroundResumeIfNeeded();
    };

    const handleActivity = () => {
      lastActivityAtRef.current = Date.now();

      if (isDocumentHidden()) {
        return;
      }

      if (modeRef.current === 'idle') {
        setModeIfChanged('active');
        return;
      }

      if (modeRef.current !== 'active') {
        setModeIfChanged('active');
      }
    };

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        wasBackgroundedRef.current = true;
        setModeIfChanged('hidden');
        return;
      }

      handleVisibleResume();
    };

    const handleBlur = () => {
      wasBackgroundedRef.current = true;
    };

    const idleCheckId = window.setInterval(() => {
      if (isDocumentHidden()) {
        setModeIfChanged('hidden');
        return;
      }

      const isIdle = Date.now() - lastActivityAtRef.current >= IDLE_THRESHOLD_MS;
      setModeIfChanged(isIdle ? 'idle' : 'active');
    }, IDLE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleVisibleResume);
    window.addEventListener('pointerdown', handleActivity, true);
    window.addEventListener('keydown', handleActivity, true);
    window.addEventListener('touchstart', handleActivity, true);

    return () => {
      window.clearInterval(idleCheckId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleVisibleResume);
      window.removeEventListener('pointerdown', handleActivity, true);
      window.removeEventListener('keydown', handleActivity, true);
      window.removeEventListener('touchstart', handleActivity, true);
    };
  }, []);

  return {
    mode,
    foregroundResumeToken,
  };
}
