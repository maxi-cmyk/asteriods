// The player's reduced-motion preference, shared by everything that animates.
export const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reducedQuery.matches;
