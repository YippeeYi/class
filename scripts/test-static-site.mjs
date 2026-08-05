import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { existsFrontend, readFrontend } from './test-react-helpers.mjs'

const packageJson = JSON.parse(await readFrontend('package.json'))
const components = JSON.parse(await readFrontend('components.json'))
const index = await readFrontend('index.html')
const app = await readFrontend('src/app.tsx')
const main = await readFrontend('src/main.tsx')
const home = await readFrontend('src/pages/home-page.tsx')
const auth = await readFrontend('src/pages/auth-page.tsx')
const materials = await readFrontend('src/pages/materials-page.tsx')
const credits = await readFrontend('src/pages/credits-page.tsx')
const backgroundsPage = await readFrontend('src/pages/backgrounds-page.tsx')
const records = await readFrontend('src/pages/records-page.tsx')
const person = await readFrontend('src/pages/person-page.tsx')
const mealMap = await readFrontend('src/pages/meal-map-page.tsx')
const people = await readFrontend('src/pages/people-page.tsx')
const quotes = await readFrontend('src/pages/quotes-page.tsx')
const quiz = await readFrontend('src/pages/quiz-page.tsx')
const search = await readFrontend('src/pages/search-page.tsx')
const timeline = await readFrontend('src/pages/timeline-page.tsx')
const quoteNavigation = await readFrontend('src/lib/quote-navigation.ts')
const routePreload = await readFrontend('src/lib/route-preload.ts')
const themeBootstrap = await readFrontend('public/theme-bootstrap.js')
const backgrounds = await readFrontend('src/components/layout/background-root.tsx')
const styles = await readFrontend('src/styles/tailwind.css')
const imageViewer = await readFrontend('src/components/archive/image-viewer.tsx')
const recordCard = await readFrontend('src/components/archive/record-card.tsx')
const pageHeading = await readFrontend('src/components/archive/page-heading.tsx')
const pageHeader = await readFrontend('src/components/layout/page-header.tsx')
const shell = await readFrontend('src/components/layout/app-shell.tsx')
const archiveContext = await readFrontend('src/features/archive/archive-context.tsx')
const markup = await readFrontend('src/lib/markup.ts')
const redirects = await readFrontend('public/_redirects')
const ui = (await readdir(new URL('../frontend/src/components/ui/', import.meta.url))).filter((file) => file.endsWith('.tsx'))

assert.match(packageJson.dependencies.react, /^\^19\./)
assert.match(packageJson.devDependencies.tailwindcss, /^\^4\./)
assert.match(packageJson.devDependencies.typescript, /^\^7\./)
assert.ok(packageJson.dependencies['@base-ui/react'])
assert.equal(components.style, 'base-nova')
assert.ok(ui.length >= 55, `expected all shadcn components, found ${ui.length}`)
assert.match(index, /src\/main\.tsx/)
assert.match(index, /theme-bootstrap\.js/, 'the selected background must be restored before React starts')
assert.match(index, /<script vite-ignore src="%BASE_URL%theme-bootstrap\.js"/, 'the synchronous theme bootstrap must bypass module bundling without a build warning')
assert.match(themeBootstrap, /backgroundPalette:v1/, 'the first paint must reuse the cached background palette')
assert.match(main, /BrowserRouter basename/, 'router basename must follow the Pages project path')
assert.match(home, /BASE_URL.*logo-guide\.png/, 'logo must use the Vite base URL')
assert.match(backgrounds, /BASE_URL/, 'background assets must use the Vite base URL')
assert.match(backgrounds, /extractPalette/, 'image backgrounds must update the theme palette')
assert.match(backgrounds, /PALETTE_KEY/, 'derived background palettes must be cached')
assert.equal(
  (backgrounds.match(/fixed inset-0/g) || []).length,
  2,
  'the steady background and temporary crossfade layer must be the only full-screen fixed layers',
)
assert.match(styles, /\.background-layer[\s\S]*contain: strict/, 'background paint must stay in a stable compositing layer')
assert.doesNotMatch(shell, /backdrop-blur-xl/, 'the sticky app bar must not re-blur the full page during fast scrolling')
assert.match(shell, /requestFullscreen/, 'the fullscreen control is missing')
assert.match(shell, /classRecord:keepFullscreen/, 'fullscreen preference must survive document navigation')
assert.match(shell, /href="#page-content"/, 'the skip-to-content link is missing')
assert.match(shell, /setOpenMobile\(false\)/, 'mobile sidebar must close after navigation')
assert.match(shell, /data-active:bg-sidebar-primary/, 'active sidebar items need a clear inverse state')
assert.match(shell, /app-main-surface/, 'the selected background must remain visible through one shared surface')
assert.match(shell, /<Breadcrumb/, 'brand and current-page title must share the application top bar')
assert.match(shell, /PAGE_HEADER_ACTIONS_ID/, 'page-level actions need a stable top-bar slot')
assert.match(pageHeader, /createPortal/, 'page actions must be composed into the shared top bar')
assert.match(pageHeader, /matchMedia\('\(min-width: 640px\)'\)/, 'page actions must choose one responsive mount point')
assert.match(pageHeading, /usePageHeaderTitle\(headerTitle\)/, 'every page heading must register its title with the top bar')
assert.equal(
  pageHeading.match(/<PageHeaderActions/g)?.length,
  1,
  'page actions must not mount duplicate desktop and mobile control trees',
)
assert.match(pageHeading, /showTitleInContent &&[\s\S]*<h1/, 'exception pages must be able to retain a meaningful content title')
assert.match(person, /headerTitle=\{displayName\}/, 'the current person name must appear in the shared top bar')
assert.match(person, /showTitleInContent/, 'the person name must remain visible in the content hierarchy')
assert.match(person, /<Avatar[\s\S]*<AvatarFallback/, 'person avatars must keep a stable shadcn placeholder')
assert.ok(
  person.indexOf('const heading') < person.indexOf('if (resource.loading)'),
  'the person heading must register a stable placeholder before the data loader returns',
)
assert.match(person, /WeakMap<RecordItem, string\[\]>/, 'person relationship parsing must be cached per record')
assert.doesNotMatch(home, /fixed top-3 left-3/, 'today history must not cover the top-left navigation')
assert.equal(home.match(/历史上的今天/g)?.length, 1, 'today history must mount only one responsive control')
assert.match(shell, /viewportLockedPaths/, 'workspace routes must share one viewport-lock contract')
for (const route of ['/materials', '/quiz', '/map']) {
  assert.match(shell, new RegExp(`'${route}'`), `${route} must lock the outer viewport`)
}
assert.doesNotMatch(shell, /footer className="fixed/, 'credits must not cover content with a fixed footer')
assert.match(shell, /to: '\/credits'/, 'credits must remain available from the global sidebar')
assert.doesNotMatch(home, /记录每一位贡献者/, 'credits must not be duplicated as a standalone guide tile')
assert.match(app, /lazy\(\(\) =>\s*routeModuleLoaders/, 'route-level code splitting is missing')
assert.match(routePreload, /import\('@\/pages\//, 'route modules must remain dynamic imports')
assert.match(routePreload, /preloadRoute/, 'route chunks need an intent-preload entry point')
assert.match(shell, /onPointerEnter=\{\(\) => void preloadRoute\(to\)\}/, 'sidebar route intent must preload its chunk')
assert.match(app, /<Spinner/, 'route-level loading must use the shadcn spinner')
assert.doesNotMatch(app, /LegacyRedirect|\.html/, 'legacy HTML route compatibility must be absent')
assert.match(archiveContext, /ArchiveProvider/, 'shared archive provider is missing')
assert.match(markup, /export type MarkupNode/, 'record markup must parse to a typed AST')
assert.doesNotMatch(markup, /innerHTML|DOMParser/, 'domain markup parser must not use HTML-string rendering')
assert.match(auth, /<FieldError/, 'invite errors must use the shadcn field error composition')
assert.doesNotMatch(auth, /useNavigate/, 'invite success must have a single redirect owner')
assert.match(materials, /params\.get\('id'\)/, 'material selection must follow the current URL')
assert.equal(
  (materials.match(/<ScrollArea/g) || []).length,
  2,
  'material navigation and content must scroll independently',
)
assert.match(materials, /flex h-full min-h-0 flex-col overflow-hidden/, 'materials must lock its outer viewport')
assert.match(credits, /!hasContent/, 'credits must expose an explicit empty state')
assert.match(backgroundsPage, /noopener noreferrer/, 'external background credits must open safely')
assert.match(backgroundsPage, /<RadioGroup/, 'background choices must use a radio-group contract')
assert.doesNotMatch(backgroundsPage, /hover:-translate-y/, 'background choices must not jump on hover')
assert.match(backgrounds, /mountain\.webp/, 'the mountain background must use the optimized WebP asset')
assert.match(backgrounds, /cloud\.webp/, 'the cloud background must use the optimized WebP asset')
assert.match(themeBootstrap, /mountain\.webp/, 'the first-paint background path must match React')
assert.match(styles, /url\("\/fonts\/GoogleSansFlex\//, 'the font must reuse the public deployment asset')
assert.doesNotMatch(styles, /src\/assets\/fonts/, 'the production font must not be bundled a second time')
assert.equal(await existsFrontend('public/images/backgrounds/mountain.webp'), true)
assert.equal(await existsFrontend('public/images/backgrounds/cloud.webp'), true)
assert.equal(await existsFrontend('public/images/backgrounds/mountain.jpg'), false)
assert.equal(await existsFrontend('public/images/backgrounds/cloud.jpg'), false)
assert.match(records, /criteriaFromSearch\(params\)/, 'record filters must restore from URL changes')
assert.match(records, /observedLocationKey/, 'same-page record links must refresh the pending jump')
assert.match(records, /lg:sticky lg:top-20/, 'written record images must keep the baseline sticky behavior')
assert.match(recordCard, /gap-0 py-0/, 'record cards must use the compact reading density')
assert.match(imageViewer, /sm:max-w-none/, 'the image viewer must override the dialog desktop width cap')
assert.match(search, /setQuery\(\(current\)/, 'search input must restore from URL changes')
assert.match(timeline, /params\.get\('year'\)/, 'timeline selection must restore from URL changes')
assert.match(timeline, /AuthorDistributionChart/, 'the author distribution chart is missing')
assert.match(timeline, /animationDuration=\{320\}/, 'the author pie highlight animation must remain brief')
assert.match(timeline, /整体记录人/, 'the global author distribution was lost during the React migration')
assert.match(timeline, /全档案月度/, 'the chronological all-month trend is missing')
assert.match(timeline, /yearAuthorPie/, 'the selected-year author distribution is missing')
assert.match(timeline, /MiniAuthorPie/, 'daily author composition markers are missing')
assert.match(timeline, /fixedTimelineChartScale/, 'timeline charts must preserve the baseline fixed-step scale')
assert.match(timeline, /openQuoteSource/, 'timeline quote chips must resolve the original record directly')
assert.match(timeline, /recordDateCache/, 'timeline date parsing must be cached per immutable record')
assert.match(timeline, /recordCharacterCache/, 'timeline character totals must be cached per immutable record')
assert.match(timeline, /aria-label="年度统计与年份选择"/, 'the baseline year pie and year controls must share one period layout')
assert.match(timeline, /aria-label="月度统计与月份选择"/, 'the baseline month pie and month controls must share one period layout')
assert.match(timeline, /grid-cols-4 gap-2 sm:grid-cols-7/, 'the daily calendar must restore the baseline seven-column desktop rhythm')
assert.doesNotMatch(timeline, /style=\{\{ minWidth:/, 'timeline charts must not force a horizontal scrollbar')
assert.doesNotMatch(timeline, /overflow-x-auto/, 'timeline controls and charts must fit or reflow instead of scrolling sideways')
assert.doesNotMatch(timeline, /key=\{`\$\{metric\}-\$\{year\}-\$\{month\}`\}/, 'timeline selection must not remount every chart')
const authorChartSource = timeline.slice(
  timeline.indexOf('function AuthorDistributionChart'),
  timeline.indexOf('function TimelineBarChart'),
)
assert.doesNotMatch(authorChartSource, /ChartTooltip/, 'author pies must use the baseline stable legend instead of a first-hover floating box')
assert.doesNotMatch(authorChartSource, /max-h-|overflow-y-auto/, 'normal author legends must expand instead of creating an internal scrollbar')
assert.match(timeline, /isAnimationActive=\{false\}/, 'bar tooltips and bars must avoid first-measure position animation')
assert.match(shell, /wideContentPaths = new Set\(\['\/timeline'\]\)/, 'the statistics workspace needs the wide desktop content lane')
assert.match(home, /不要外传/, 'the privacy reminder must remain visible on the guide page')
assert.doesNotMatch(records, /不要外传|请勿外传/, 'the privacy reminder must not repeat on the records page')
assert.doesNotMatch(mealMap, /不要外传|请勿外传/, 'the privacy reminder must not repeat on the map page')
for (const [name, source] of [
  ['people', people],
  ['quotes', quotes],
  ['person', person],
  ['search', search],
]) {
  assert.doesNotMatch(
    source,
    /key=\{`\$\{(?:sort|mode|debouncedQuery)/,
    `${name} result controls must not remount the complete result tree`,
  )
}
assert.match(quoteNavigation, /resolveQuoteSources/, 'quote source resolution must be shared by all entry points')
assert.match(quiz, /preloadQuizImage/, 'secret quiz image preloading is missing')
assert.match(quiz, /text-foreground\/90/, 'quiz source text needs sufficient contrast')
assert.match(quiz, /<ScrollArea key=\{current\.id\}/, 'quiz questions must scroll inside the card')
for (const route of ['records', 'people', 'person', 'quotes', 'timeline', 'search', 'quiz', 'materials', 'map', 'backgrounds', 'credits']) {
  assert.match(app, new RegExp(`path="${route}"`), `${route} route is missing`)
}
assert.match(redirects, /\/\* \/index\.html 200/, 'SPA fallback is missing')
assert.equal(await existsFrontend('public/style.css'), false, 'legacy CSS runtime should be absent')
assert.equal(await existsFrontend('public/record.html'), false, 'legacy HTML runtime should be absent')
console.log(`React static application checks passed: ${ui.length} CLI-generated shadcn Base UI components.`)
