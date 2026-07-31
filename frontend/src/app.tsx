import { lazy, type ReactElement, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { BackgroundRoot } from '@/components/layout/background-root'
import { Spinner } from '@/components/ui/spinner'
import { ArchiveProvider } from '@/features/archive/archive-context'
import { ImageMetadataPreloader } from '@/features/archive/image-metadata-preloader'
import { AccessGate } from '@/features/auth/access-gate'
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
  return (
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
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </Suspense>
  )
}

function ProtectedApp(): ReactElement {
  return (
    <AccessGate>
      <ArchiveProvider>
        <ImageMetadataPreloader />
        <BackgroundRoot>
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
              <Route path="404" element={<NotFoundPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BackgroundRoot>
      </ArchiveProvider>
    </AccessGate>
  )
}
