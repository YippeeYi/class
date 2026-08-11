import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { existsFrontend, readFrontend } from './test-react-helpers.mjs'

const vercel = await readFrontend('../vercel.json')

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
const recordFilters = await readFrontend('src/components/archive/record-filters.tsx')
const markupContent = await readFrontend('src/components/archive/markup-content.tsx')
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
assert.match(packageJson.dependencies['react-router'], /^\^8\./)
assert.equal(
  packageJson.dependencies['react-router-dom'],
  undefined,
  'declarative browser APIs must use the maintained react-router package directly',
)
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
assert.match(person, /headerTitle=\{displayName\}/, 'person metadata must still expose its detailed page title')
assert.match(shell, /sectionTitle\?\.label \|\| registeredTitle\?\.title/, 'the shared top bar must prefer the selected navigation label')
assert.match(shell, /pathname === '\/person' \? '\/people'/, 'person details must remain in the People navigation section')
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
assert.match(home, /to: '\/credits'/, 'the baseline credits entry must remain discoverable from the guide')
assert.match(home, /resource\.loading \|\| \(!archiveData && !resource\.error\)/, 'the guide must reserve its core navigation geometry before archive data arrives')
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
assert.match(backgroundsPage, /ratio=\{4 \/ 3\}/, 'background cards must expose a substantial preview area')
assert.match(backgroundsPage, /backdrop-blur-md/, 'background metadata must remain readable on a restrained glass surface')
assert.match(backgrounds, /swatch:/, 'each background must expose a representative palette swatch')
assert.match(backgrounds, /if \(cached\) \{[\s\S]*applyPalette\(cached\)[\s\S]*return/, 'cached background palettes must skip repeated image sampling')
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
assert.match(recordFilters, /normalizeText\(stripMarkup\(record\.content\)\)/, 'record-list search must index only record body text')
assert.doesNotMatch(recordFilters, /record\.author[\s\S]*recordBodySearchTextCache/, 'record-list search must not index author metadata')
assert.match(recordFilters, /placeholder="仅搜索记录正文"/, 'record-list search must explain its body-only scope')
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
assert.match(timeline, /grid-cols-4 gap-1\.5 sm:grid-cols-7 lg:grid-cols-10 2xl:grid-cols-14/, 'the daily calendar must provide a denser responsive layout')
assert.match(
  timeline,
  /aspect-square[\s\S]*grid-rows-\[auto_1fr\]/,
  'daily cells must keep a stable compact square layout',
)
assert.match(timeline, /daily-distribution-pie/, 'daily author pies need a dedicated responsive geometry')
assert.match(timeline, /compactStatistic\(item\.value\)/, 'large daily values must use a compact non-overflowing display')
assert.match(timeline, /重 \{compactStatistic\(item\.important\)\}/, 'daily cells must retain their compact important-record metric')
assert.doesNotMatch(timeline, /daily-distribution-unit/, 'daily cards must not repeat the selected metric unit')
assert.match(timeline, /nativeButton=\{!item\.records\.length\}/, 'daily record links must preserve native link semantics')
assert.doesNotMatch(timeline, /style=\{\{ minWidth:/, 'timeline charts must not force a horizontal scrollbar')
assert.doesNotMatch(timeline, /overflow-x-auto/, 'timeline controls and charts must fit or reflow instead of scrolling sideways')
assert.doesNotMatch(timeline, /key=\{`\$\{metric\}-\$\{year\}-\$\{month\}`\}/, 'timeline selection must not remount every chart')
const authorChartSource = timeline.slice(
  timeline.indexOf('function AuthorDistributionChart'),
  timeline.indexOf('function TimelineBarChart'),
)
const authorTooltipSource = timeline.slice(
  timeline.indexOf('function AuthorPieTooltip'),
  timeline.indexOf('function MiniAuthorPie'),
)
assert.match(authorChartSource, /AuthorPieTooltip/, 'author pie sectors must expose their measured tooltip')
assert.match(authorTooltipSource, /记录条数[\s\S]*记录字数[\s\S]*占比/, 'author pie tooltips must expose the selected category statistics')
assert.doesNotMatch(authorChartSource, />合计</, 'author pie tooltips and center labels must not repeat total wording')
assert.doesNotMatch(authorChartSource, /position=\{\{/, 'author pie tooltips must use the active sector coordinate instead of a fixed position')
assert.match(authorChartSource, /cx="50%"[\s\S]*cy="50%"/, 'the author pie must use its true geometric center')
assert.match(authorChartSource, /absolute inset-0[\s\S]*<strong/, 'the numeric pie total must share the chart geometry')
assert.match(authorChartSource, /sm:grid-cols-\[9\.25rem_minmax\(0,1fr\)\]/, 'the author legend must retain the baseline right-hand layout')
assert.match(timeline, /function choosePieTooltipPosition/, 'author pie tooltips must choose a position from the active sector direction')
assert.match(timeline, /overlapWidth \* overlapHeight/, 'author pie tooltip placement must avoid covering the chart')
assert.match(timeline, /createPortal\([\s\S]*<ChartTooltipContent/, 'pie and bar tooltips must reuse the same shadcn chart tooltip content')
assert.match(timeline, /ResizeObserver[\s\S]*observer\.disconnect\(\)/, 'pie tooltip geometry listeners must be cleaned up')
assert.doesNotMatch(authorChartSource, /max-h-|overflow-y-auto/, 'normal author legends must expand instead of creating an internal scrollbar')
assert.match(timeline, /isAnimationActive=\{false\}/, 'bar tooltips and bars must avoid first-measure position animation')
assert.match(shell, /wideContentPaths = new Set\(\['\/timeline'\]\)/, 'the statistics workspace needs the wide desktop content lane')
for (const [name, source] of [
  ['shell', shell],
  ['home', home],
  ['map', mealMap],
  ['statistics', timeline],
]) {
  assert.doesNotMatch(source, /蹭饭图|觅食地图|档案时间线|时间线/, `${name} still exposes a retired page name`)
}
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
assert.match(quotes, /stripMarkup\(a\.quote\)/, 'quote content sorting must ignore record markup like the baseline')
assert.match(quotes, /grid items-start gap-4/, 'quote cards must size to their own content instead of stretching')
assert.match(quotes, /<Link[\s\S]*focus-visible:ring-2[\s\S]*<Card className="h-fit gap-0 py-0/, 'quote cards must preserve whole-card keyboard navigation without default card padding')
assert.match(quotes, /<CardContent className="p-4 sm:p-5">/, 'quote cards need one explicit, balanced content inset')
assert.doesNotMatch(quotes, /<Card id=|<CardContent className="pt-4">/, 'quote cards must not restore the oversized legacy composition')
assert.match(quiz, /preloadQuizImage/, 'secret quiz image preloading is missing')
assert.match(quiz, /text-foreground\/90/, 'quiz source text needs sufficient contrast')
assert.match(quiz, /<ScrollArea key=\{current\.id\}/, 'quiz questions must scroll inside the card')
assert.match(markupContent, /record-stack--\$\{node\.kind\}/, 'fractions and equation arrows must keep distinct structures')
assert.match(markupContent, /className="record-stack-line"/, 'stack rules must be rendered independently from their labels')
assert.match(markupContent, /align="center"[\s\S]*alignOffset=\{lockedAlignOffset\}/, 'illustration previews must center on one locked pointer anchor')
assert.match(markupContent, /pointerX - \(bounds\.left \+ bounds\.width \/ 2\)/, 'illustration pointer alignment must use the trigger center delta')
assert.match(markupContent, /decoration-dotted/, 'annotation text must remain visibly discoverable')
assert.match(markupContent, /record-annotation-popup/, 'annotation content needs an isolated collision-aware popup surface')
assert.match(markupContent, /function Annotation[\s\S]*alignOffset=\{lockedAlignOffset\}/, 'annotations must lock one pointer-centered horizontal anchor per open lifecycle')
assert.match(markupContent, /interactionMode="references"/, 'annotation content must retain clickable person and record references')
assert.match(markupContent, /interactionMode !== 'full'/, 'nested annotation markup must not recursively create popup triggers')
assert.match(markupContent, /quiz-answer-blank-text[\s\S]*\{answer\}/, 'quiz blanks must keep the real answer glyphs in normal layout')
assert.doesNotMatch(markupContent, /Array\.from\(answer\)|quiz-blank-width/, 'quiz blank width must not be estimated from character count')
assert.match(styles, /\.record-table-scroll table[\s\S]*font-size: 1em/, 'markup tables must inherit a readable body-sized font')
assert.match(styles, /\.record-table-scroll td[\s\S]*word-break: normal;[\s\S]*overflow-wrap: anywhere;/, 'markup tables must wrap naturally and only break unavoidably long tokens')
assert.match(markupContent, /text-\[1em\] leading-\[1\.55\]/, 'shadcn table utility defaults must be overridden at the business call site')
assert.match(markupContent, /whitespace-normal break-words/, 'shadcn table cells must opt into natural multiline content')
assert.match(markupContent, /function tableGeometry[\s\S]*visibleTextUnits/, 'markup table widths must account for their actual visible cell content')
assert.match(markupContent, /<colgroup>[\s\S]*geometry\.columns/, 'markup tables must apply balanced content-aware column widths')
assert.match(styles, /\.record-markup \{[\s\S]*contain: inline-size/, 'long table content must not enlarge an ancestor grid track')
assert.match(styles, /\.record-table-scroll table[\s\S]*table-layout: fixed/, 'markup tables must remain within their available width')
const recordTableStyles = styles.slice(
  styles.indexOf('.record-table-scroll {'),
  styles.indexOf('.material-reading .record-markup'),
)
assert.doesNotMatch(recordTableStyles, /overflow(?:-x)?: hidden|overflow-x: auto/, 'markup tables must fit by layout rather than clipping or horizontal scrolling')
assert.match(recordTableStyles, /\[data-slot="table-container"\][\s\S]*overflow: visible/, 'the shadcn table wrapper must not reintroduce a horizontal scroller')
assert.doesNotMatch(styles, /min-width: min\(100%, 32rem\)/, 'markup tables must not be forced wider than their content')
assert.match(styles, /\.record-stack-line::before[\s\S]*inset: 0 -0\.34em/, 'stack rules must visibly extend past the widest rendered label')
assert.match(styles, /\.record-stack--arrow \.record-stack-line::after/, 'equation arrows must preserve the right arrowhead')
assert.match(styles, /\.quiz-answer-blank-text[\s\S]*color: transparent/, 'hidden quiz answers must retain their exact rendered geometry')
assert.match(people, /isMainTeacher[\s\S]*<Badge[\s\S]*主要/, 'main teachers need an explicit, theme-aware row marker')
assert.match(shell, /function RouteScrollManager/, 'route-level scroll behavior must have one owner')
assert.match(shell, /navigationType !== 'POP'/, 'forward navigation must reset without breaking browser back scroll restoration')
assert.match(shell, /location\.pathname === '\/person'[\s\S]*last\?\.search !== location\.search/, 'every person-to-person navigation must reset to the top')
for (const route of ['records', 'people', 'person', 'quotes', 'timeline', 'search', 'quiz', 'materials', 'map', 'backgrounds', 'credits']) {
  assert.match(app, new RegExp(`path="${route}"`), `${route} route is missing`)
}
assert.match(redirects, /\/\* \/index\.html 200/, 'SPA fallback is missing')
assert.match(
  vercel,
  /\/assets\/\(\.\*\)[\s\S]*max-age=31536000, immutable/,
  'content-hashed Vite assets must keep a long immutable deployment cache',
)
assert.equal(await existsFrontend('public/style.css'), false, 'legacy CSS runtime should be absent')
assert.equal(await existsFrontend('public/record.html'), false, 'legacy HTML runtime should be absent')
console.log(`React static application checks passed: ${ui.length} CLI-generated shadcn Base UI components.`)
