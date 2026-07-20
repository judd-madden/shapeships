import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
}

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!mediaQuery) {
      return;
    }

    const update = () => setPrefersReducedMotion(Boolean(mediaQuery.matches));

    update();
    mediaQuery.addEventListener?.('change', update);

    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return prefersReducedMotion;
}
