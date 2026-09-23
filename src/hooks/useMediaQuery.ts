import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** ≥ 1024 px : ordinateur / grande tablette paysage. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
/** ≥ 768 px : tablette. */
export const useIsTablet = () => useMediaQuery('(min-width: 768px)');
