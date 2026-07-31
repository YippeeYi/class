type RouteModuleLoader = () => Promise<unknown>

export const routeModuleLoaders = {
  auth: () => import('@/pages/auth-page'),
  backgrounds: () => import('@/pages/backgrounds-page'),
  credits: () => import('@/pages/credits-page'),
  home: () => import('@/pages/home-page'),
  materials: () => import('@/pages/materials-page'),
  map: () => import('@/pages/meal-map-page'),
  notFound: () => import('@/pages/not-found-page'),
  people: () => import('@/pages/people-page'),
  person: () => import('@/pages/person-page'),
  quiz: () => import('@/pages/quiz-page'),
  quotes: () => import('@/pages/quotes-page'),
  records: () => import('@/pages/records-page'),
  search: () => import('@/pages/search-page'),
  timeline: () => import('@/pages/timeline-page'),
} satisfies Record<string, RouteModuleLoader>

const loadersByPath = new Map<string, RouteModuleLoader>([
  ['/', routeModuleLoaders.home],
  ['/auth', routeModuleLoaders.auth],
  ['/backgrounds', routeModuleLoaders.backgrounds],
  ['/credits', routeModuleLoaders.credits],
  ['/materials', routeModuleLoaders.materials],
  ['/map', routeModuleLoaders.map],
  ['/people', routeModuleLoaders.people],
  ['/person', routeModuleLoaders.person],
  ['/quiz', routeModuleLoaders.quiz],
  ['/quotes', routeModuleLoaders.quotes],
  ['/records', routeModuleLoaders.records],
  ['/search', routeModuleLoaders.search],
  ['/timeline', routeModuleLoaders.timeline],
])

export function preloadRoute(pathname: string) {
  const normalized =
    pathname === '/' ? pathname : `/${pathname.split('/').filter(Boolean)[0] || ''}`
  return loadersByPath
    .get(normalized)?.()
    .catch(() => undefined)
}
