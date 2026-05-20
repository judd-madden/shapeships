import { useEffect, useState } from 'react';

const MOBILE_GAME_LAYOUT_QUERY = '(max-width: 767px)';

export function useMobileGameLayout(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_GAME_LAYOUT_QUERY);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener?.('change', updateMatches);

    return () => {
      mediaQuery.removeEventListener?.('change', updateMatches);
    };
  }, []);

  return matches;
}
