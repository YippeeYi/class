import { lazy, type ReactElement, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { BackgroundRoot } from '@/components/layout/background-root'
import { ArchiveProvider } from '@/features/archive/archive-context'
import { AccessGate } from '@/features/auth/access-gate'

const AuthPage = lazy(() =>
  import('@/pages/auth-page').then((module) => ({ default: module.AuthPage })),
)
const BackgroundsPage = lazy(() =>
  import('@/pages/backgrounds-page').then((module) => ({ default: module.BackgroundsPage })),
)
const CreditsPage = lazy(() =>
  import('@/pages/credits-page').then((module) => ({ default: module.CreditsPage })),
)
const HomePage = lazy(() =>
  import('@/pages/home-page').then((module) => ({ default: module.HomePage })),
)
const MaterialsPage = lazy(() =>
  import('@/pages/materials-page').then((module) => ({ default: module.MaterialsPage })),
)
const MealMapPage = lazy(() =>
  import('@/pages/meal-map-page').then((module) => ({ default: module.MealMapPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/not-found-page').then((module) => ({ default: module.NotFoundPage })),
)
const PeoplePage = lazy(() =>
  import('@/pages/people-page').then((module) => ({ default: module.PeoplePage })),
)
const PersonPage = lazy(() =>
  import('@/pages/person-page').then((module) => ({ default: module.PersonPage })),
)
const QuizPage = lazy(() =>
  import('@/pages/quiz-page').then((module) => ({ default: module.QuizPage })),
)
const QuotesPage = lazy(() =>
  import('@/pages/quotes-page').then((module) => ({ default: module.QuotesPage })),
)
const RecordsPage = lazy(() =>
  import('@/pages/records-page').then((module) => ({ default: module.RecordsPage })),
)
const SearchPage = lazy(() =>
  import('@/pages/search-page').then((module) => ({ default: module.SearchPage })),
)
const TimelinePage = lazy(() =>
  import('@/pages/timeline-page').then((module) => ({ default: module.TimelinePage })),
)

export function App() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
          正在打开档案…
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
