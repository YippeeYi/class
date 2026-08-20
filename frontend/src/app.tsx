import { lazy, type ReactElement, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { BackgroundRoot } from '@/components/layout/background-root'
import { Spinner } from '@/components/ui/spinner'
import { ArchiveProvider } from '@/features/archive/archive-context'
import { AccessGate } from '@/features/auth/access-gate'
import { DocumentTitleProvider } from '@/hooks/use-document-title'
import { normalizeAppPathname } from '@/lib/app-route'
import { routeModuleLoaders } from '@/lib/route-preload'

const AuthPage = lazy(() =>
  routeModuleLoaders.auth().then((module) => ({ default: module.AuthPage })),
)
const BackgroundsPage = lazy(() =>
  routeModuleLoaders.backgrounds().then((module) => ({ default: module.BackgroundsPage })),
)
const CreditsPage = lazy(() =>
  routeModuleLoaders.credits().then((module) => ({ default: module.CreditsPage })),
)
const HomePage = lazy(() =>
  routeModuleLoaders.home().then((module) => ({ default: module.HomePage })),
)
const MaterialsPage = lazy(() =>
  routeModuleLoaders.materials().then((module) => ({ default: module.MaterialsPage })),
)
const MealMapPage = lazy(() =>
  routeModuleLoaders.map().then((module) => ({ default: module.MealMapPage })),
)
const NotFoundPage = lazy(() =>
  routeModuleLoaders.notFound().then((module) => ({ default: module.NotFoundPage })),
)
const PeoplePage = lazy(() =>
  routeModuleLoaders.people().then((module) => ({ default: module.PeoplePage })),
)
const PersonPage = lazy(() =>
  routeModuleLoaders.person().then((module) => ({ default: module.PersonPage })),
)
const QuizPage = lazy(() =>
  routeModuleLoaders.quiz().then((module) => ({ default: module.QuizPage })),
)
const QuotesPage = lazy(() =>
  routeModuleLoaders.quotes().then((module) => ({ default: module.QuotesPage })),
)
const RecordsPage = lazy(() =>
  routeModuleLoaders.records().then((module) => ({ default: module.RecordsPage })),
)
const SearchPage = lazy(() =>
  routeModuleLoaders.search().then((module) => ({ default: module.SearchPage })),
)
const TimelinePage = lazy(() =>
  routeModuleLoaders.timeline().then((module) => ({ default: module.TimelinePage })),
)

export function App() {
  const location = useLocation()

  return (
    <DocumentTitleProvider
      pathname={location.pathname}
      locationKey={`${location.pathname}${location.search}`}
    >
      <BackgroundRoot>
        <Suspense
          fallback={
            <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
              <div className="flex items-center gap-3" role="status">
                <Spinner className="size-5" />
                正在打开档案…
              </div>
            </div>
          }
        >
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<AppEntry />} />
          </Routes>
        </Suspense>
      </BackgroundRoot>
    </DocumentTitleProvider>
  )
}

const protectedPaths = new Set([
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
  '/backgrounds',
  '/credits',
])

function AppEntry(): ReactElement {
  const location = useLocation()
  const pathname = normalizeAppPathname(location.pathname)
  return protectedPaths.has(pathname) ? <ProtectedApp /> : <NotFoundPage />
}

function ProtectedApp(): ReactElement {
  return (
    <AccessGate>
      <ArchiveProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="person" element={<PersonPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="map" element={<MealMapPage />} />
            <Route path="backgrounds" element={<BackgroundsPage />} />
            <Route path="credits" element={<CreditsPage />} />
          </Route>
        </Routes>
      </ArchiveProvider>
    </AccessGate>
  )
}
