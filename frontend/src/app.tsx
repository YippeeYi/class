import { lazy, type ReactElement, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { BackgroundRoot } from '@/components/layout/background-root'
import { Spinner } from '@/components/ui/spinner'
import { ArchiveProvider, useArchiveSnapshot } from '@/features/archive/archive-context'
import { AccessChecking, AccessGate } from '@/features/auth/access-gate'
import { DataUpdateMonitor } from '@/features/data/data-update-monitor'
import { ContentPreferenceProvider } from '@/features/preferences/content-preferences'
import { DocumentTitleProvider } from '@/hooks/use-document-title'
import { normalizeAppPathname, protectedPaths } from '@/lib/app-route'
import { routeModuleLoaders } from '@/lib/route-preload'
import { HomePage } from '@/pages/home-page'

const AuthPage = lazy(() =>
  routeModuleLoaders.auth().then((module) => ({ default: module.AuthPage })),
)
const BackgroundsPage = lazy(() =>
  routeModuleLoaders.backgrounds().then((module) => ({ default: module.BackgroundsPage })),
)
const CreditsPage = lazy(() =>
  routeModuleLoaders.credits().then((module) => ({ default: module.CreditsPage })),
)
const MaterialsPage = lazy(() =>
  routeModuleLoaders.materials().then((module) => ({ default: module.MaterialsPage })),
)
const MealMapPage = lazy(() =>
  routeModuleLoaders.map().then((module) => ({ default: module.MealMapPage })),
)
const QbPage = lazy(() => routeModuleLoaders.qb().then((module) => ({ default: module.QbPage })))
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
      <ContentPreferenceProvider>
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
      </ContentPreferenceProvider>
    </DocumentTitleProvider>
  )
}

function AppEntry(): ReactElement {
  const location = useLocation()
  const pathname = normalizeAppPathname(location.pathname)
  return protectedPaths.has(pathname) ? <ProtectedApp /> : <NotFoundPage />
}

function ProtectedApp(): ReactElement {
  return (
    <AccessGate>
      <DataUpdateMonitor />
      <ArchiveProvider>
        <HomeInitializationGate>
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
              <Route path="qb" element={<QbPage />} />
              <Route path="backgrounds" element={<BackgroundsPage />} />
              <Route path="credits" element={<CreditsPage />} />
            </Route>
          </Routes>
        </HomeInitializationGate>
      </ArchiveProvider>
    </AccessGate>
  )
}

function HomeInitializationGate({ children }: { children: ReactElement }): ReactElement {
  const location = useLocation()
  const archive = useArchiveSnapshot()
  const isHome = normalizeAppPathname(location.pathname) === '/'

  useEffect(() => {
    if (isHome) void archive.ensure()
  }, [archive.ensure, isHome])

  if (isHome && !archive.data && !archive.error) return <AccessChecking />
  return children
}
