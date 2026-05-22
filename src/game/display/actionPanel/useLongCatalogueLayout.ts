import { useEffect, useState } from 'react';

const LONG_CATALOGUE_LAYOUT_QUERY = '(min-width: 1900px)';

export function useLongCatalogueLayout(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    const mediaQuery = window.matchMedia(LONG_CATALOGUE_LAYOUT_QUERY);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener?.('change', updateMatches);

    return () => {
      mediaQuery.removeEventListener?.('change', updateMatches);
    };
  }, []);

  return matches;
}
