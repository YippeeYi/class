export function normalizeAppPathname(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '') || '/'
}

export const protectedPaths = new Set([
  '/',
  '/records',
  '/people',
  '/person',
  '/quotes',
  '/timeline',
  '/search',
  '/quiz',
  '/materials',
  '/map',
  '/qb',
  '/backgrounds',
  '/credits',
])
