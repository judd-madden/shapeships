import { useEffect, useState } from 'react';

const LAPTOP_CATALOGUE_LAYOUT_QUERY = '(min-width: 768px) and (max-width: 1599px)';
const LONG_CATALOGUE_LAYOUT_QUERY = '(min-width: 1900px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener?.('change', updateMatches);

    return () => {
      mediaQuery.removeEventListener?.('change', updateMatches);
    };
  }, [query]);

  return matches;
}

export function useLaptopCatalogueLayout(): boolean {
  return useMediaQuery(LAPTOP_CATALOGUE_LAYOUT_QUERY);
}

export function useLongCatalogueLayout(): boolean {
  const isLaptopCatalogueLayout = useLaptopCatalogueLayout();
  const isWideCatalogueLayout = useMediaQuery(LONG_CATALOGUE_LAYOUT_QUERY);

  return isLaptopCatalogueLayout || isWideCatalogueLayout;
}
