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
const recordIdentity = await readFrontend('src/lib/record-identity.ts')
const routePreload = await readFrontend('src/lib/route-preload.ts')
const themeBootstrap = await readFrontend('public/theme-bootstrap.js')
const backgrounds = await readFrontend('src/components/layout/background-root.tsx')
const styles = await readFrontend('src/styles/tailwind.css')
const imageViewer = await readFrontend('src/components/archive/image-viewer.tsx')
const recordCard = await readFrontend('src/components/archive/record-card.tsx')
const pageHeading = await readFrontend('src/components/archive/page-heading.tsx')
const pageHeader = await readFrontend('src/components/layout/page-header.tsx')
const shell = await readFrontend('src/components/layout/app-shell.tsx')
const interaction = await readFrontend('src/components/archive/interaction.tsx')
const segmentedTabs = await readFrontend('src/components/archive/segmented-tabs.tsx')
const dismissOnScroll = await readFrontend('src/hooks/use-dismiss-on-vertical-scroll.ts')
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
assert.doesNotMatch(index, /preload[^>]+logo-guide\.png/, 'non-guide routes must not preload the guide illustration')
assert.match(index, /<script vite-ignore src="%BASE_URL%theme-bootstrap\.js"/, 'the synchronous theme bootstrap must bypass module bundling without a build warning')
assert.match(themeBootstrap, /backgroundPalette:v1/, 'the first paint must reuse the cached background palette')
assert.match(themeBootstrap, /classRecord:appearance:v1/, 'the first paint must restore the unified appearance preference')
assert.match(themeBootstrap, /dataset\.themePreset/, 'the selected theme preset must be applied before React starts')
assert.match(main, /BrowserRouter basename/, 'router basename must follow the Pages project path')
assert.match(home, /BASE_URL.*logo-guide\.png/, 'logo must use the Vite base URL')
assert.doesNotMatch(home, /tapLogo|logoAnimation|logoTapCount|logoTapTimer/, 'the guide logo must not retain click or animation state')
assert.doesNotMatch(home, /<Button[\s\S]{0,500}logo-guide\.png/, 'the guide logo must not be wrapped in a button')
assert.match(home, /role="img"[\s\S]*draggable=\{false\}[\s\S]*pointer-events-none[\s\S]*select-none/, 'the guide logo must be a non-draggable, non-selectable display image')
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
assert.match(shell, /<SidebarMenu>[\s\S]*<SidebarMenuButton[\s\S]*isActive=\{isActive\}/, 'active navigation must use the shadcn SidebarMenuButton contract')
assert.match(shell, /app-main-surface/, 'the selected background must remain visible through one shared surface')
assert.match(shell, /recordJumpOwnsScroll[\s\S]*isRecordJumpActive\(\)/, 'route resets must yield scroll ownership to measured record jumps')
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
assert.doesNotMatch(
  person,
  /if \(resource\.loading \|\| supplementalResource\.loading\)/,
  'supplemental records must not block the person profile first render',
)
assert.match(person, /正在补全书面记录/, 'non-blocking supplemental loading needs visible status')
assert.match(person, /WeakMap<RecordItem, string\[\]>/, 'person relationship parsing must be cached per record')
assert.doesNotMatch(home, /fixed top-3 left-3/, 'today history must not cover the top-left navigation')
assert.equal(home.match(/历史上的今天/g)?.length, 1, 'today history must mount only one responsive control')
assert.match(
  home,
  /<Button nativeButton=\{false\} render=\{<Link to="\/records" \/>\}>/,
  'guide record navigation must declare link semantics to the shared shadcn Button',
)
assert.match(
  home,
  /<Button variant="outline" nativeButton=\{false\} render=\{<Link to="\/search" \/>\}>/,
  'guide search navigation must declare link semantics to the shared shadcn Button',
)
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
assert.match(
  shell,
  /location\.pathname === to[\s\S]*search: location\.search,[\s\S]*hash: location\.hash,[\s\S]*render=\{<NavLink to=\{destination\} \/>\}/,
  'clicking the active record navigation item must preserve its written-view URL state',
)
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
assert.doesNotMatch(styles, /\.appearance-choice:hover\s*\{[^}]*transform:/, 'appearance choice hover must preserve its exact control bounds')
assert.match(styles, /\.appearance-choice:has\(\[data-slot="radio-group-item"\]:focus\)[\s\S]*outline: 2px solid/, 'appearance choices must expose focus with a non-shadow boundary')
assert.match(backgroundsPage, /ratio=\{4 \/ 3\}/, 'background cards must expose a substantial preview area')
assert.match(backgroundsPage, /bg-background\/90/, 'background metadata must remain readable on one stable surface')
assert.match(backgroundsPage, /data-background-swatch/, 'background palette swatches must be integrated with their metadata')
assert.match(backgroundsPage, /data-theme-preset-option/, 'designed theme presets must expose compact visual previews')
assert.match(backgroundsPage, /data-theme-mode-group/, 'light and dark presets must be visibly grouped')
assert.match(backgroundsPage, /setThemePreset/, 'theme presets must use the shared appearance controller')
assert.match(backgroundsPage, /title="风格"/, 'the appearance page must use its new user-facing name')
assert.match(shell, /label: '风格'/, 'global navigation must expose the style page under its new name')
assert.match(home, /label: '风格'/, 'the guide must expose the style page under its new name')
assert.match(backgroundsPage, /value: 'palette'[\s\S]*value: 'background'/, 'palette and background must remain the only style sections')
assert.match(backgroundsPage, /<SegmentedTabsList[\s\S]{0,180}ariaLabel="风格设置分区"/, 'style section navigation must use the shared shadcn-based segmented control')
assert.doesNotMatch(backgroundsPage, /\{items\.length\}/, 'the style page must not display palette counts')
assert.match(recordIdentity, /#箴-[\s\S]*#补-/, 'proverbs and supplements must use distinct shared number systems')
assert.match(recordIdentity, /fileName: ''/, 'supplemental display records must not carry visible JSON file names')
assert.match(backgroundsPage, /data-theme-preset-option="auto"[\s\S]*<Sparkles/, 'automatic palette must use one compact business control')
assert.match(backgroundsPage, /id="theme-preset-auto" value="auto"/, 'automatic palette must participate in the shared accessible radio group')
assert.doesNotMatch(backgroundsPage, /<ThemePresetOption[\s\S]*preset=\{themePresets\.find/, 'automatic palette must not return to a full preset card')
assert.match(backgroundsPage, /group\/background-choice/, 'each background preview needs an isolated hover group')
assert.doesNotMatch(backgroundsPage, /group-hover\/card:scale/, 'background image hover must not inherit the outer shadcn Card group')
assert.match(backgroundsPage, /<label[\s\S]*data-background-id=[\s\S]*appearance-choice group\/background-choice/, 'the visual background boundary must be the real label hit target')
assert.match(backgrounds, /swatch:/, 'each background must expose a representative palette swatch')
assert.match(backgrounds, /APPEARANCE_KEY/, 'background and theme choices must persist as one appearance preference')
assert.match(backgrounds, /paper[\s\S]*mist[\s\S]*apricot[\s\S]*sage[\s\S]*ink[\s\S]*midnight[\s\S]*pine/, 'appearance presets must cover distinct light and dark directions')
assert.match(backgrounds, /mode: 'light'[\s\S]*mode: 'dark'/, 'each designed theme must declare its display mode')
assert.match(themeBootstrap, /darkThemes/, 'all dark presets must restore dark component variants before React starts')
assert.match(backgrounds, /if \(cached\) \{[\s\S]*applyPalette\(cached\)[\s\S]*return/, 'cached background palettes must skip repeated image sampling')
assert.match(backgrounds, /mountain\.webp/, 'the mountain background must use the optimized WebP asset')
assert.match(backgrounds, /cloud\.webp/, 'the cloud background must use the optimized WebP asset')
assert.match(themeBootstrap, /mountain\.webp/, 'the first-paint background path must match React')
assert.match(styles, /@import "@fontsource-variable\/geist"/, 'the interface must use the installed compressed variable-font package')
assert.doesNotMatch(styles, /Google Sans Flex|GoogleSansFlex/, 'the obsolete multi-megabyte public font must not be requested')
assert.equal(
  await existsFrontend(
    'public/fonts/GoogleSansFlex/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf',
  ),
  false,
  'the obsolete uncompressed font must not inflate the release artifact',
)
assert.equal(await existsFrontend('public/images/backgrounds/mountain.webp'), true)
assert.equal(await existsFrontend('public/images/backgrounds/cloud.webp'), true)
assert.equal(await existsFrontend('public/images/backgrounds/mountain.jpg'), false)
assert.equal(await existsFrontend('public/images/backgrounds/cloud.jpg'), false)
assert.match(records, /criteriaFromSearch\(params\)/, 'record filters must restore from URL changes')
assert.match(records, /function recordsSearch[\s\S]*replaceRouteState/, 'record view and filters must commit through one URL-state boundary')
assert.doesNotMatch(records, /value=\{String\(safeIndex\)\}/, 'the written page selector must not expose a zero-based index')
assert.match(records, /value=\{page\.page\}[\s\S]*item\.page === value[\s\S]*value=\{item\.page\}/, 'the written page selector must use the real page identity end to end')
assert.match(recordFilters, /normalizeText\(stripMarkup\(record\.content\)\)/, 'record-list search must index only record body text')
assert.doesNotMatch(recordFilters, /record\.author[\s\S]*recordBodySearchTextCache/, 'record-list search must not index author metadata')
assert.match(recordFilters, /placeholder="仅搜索记录正文"/, 'record-list search must explain its body-only scope')
assert.match(records, /observedLocationKey/, 'same-page record links must refresh the pending jump')
assert.match(
  records,
  /scrollTargetIntoView\(target, 'smooth'\)/,
  'record jumps must use one natural shared clamped viewport locator',
)
assert.match(records, /waitForWindowScrollEnd\(destination, scrollCompletion\.signal\)/, 'record dialogs must wait for the one browser-owned scroll to settle')
assert.equal((records.match(/scrollTargetIntoView\(target/g) || []).length, 1, 'record location must issue exactly one target scroll')
assert.match(
  records,
  /replaceRecordJumpHash\(pending\.targetAnchorId\)/,
  'record fragments must be published without invoking native anchor scrolling',
)
assert.match(records, /clampWindowScrollTop\(pending\.scrollY\)/, 'record return restoration must respect the current document height')
assert.doesNotMatch(records, /target\.scrollIntoView/, 'record location must not delegate near-bottom positioning to browser centering')
assert.match(records, /lg:sticky lg:top-20/, 'written record images must keep the baseline sticky behavior')
assert.match(recordCard, /gap-0 py-0/, 'record cards must use the compact reading density')
assert.match(recordCard, /record-surface/, 'record cards must expose one business-level material boundary contract')
assert.match(records, /target\.dataset\.recordJumpHighlight = 'true'[\s\S]*scrollTargetIntoView/, 'record location must publish its semantic highlight before the target starts moving')
assert.doesNotMatch(records, /target\.classList\.add\('ring-2'/, 'record highlights must use the shared semantic surface state')
assert.match(styles, /\.record-surface \{[\s\S]*--record-rest-border: var\(--border\)[\s\S]*border: 1px solid var\(--record-rest-border\)/, 'written records need one stable box-model boundary in every palette')
assert.match(styles, /data-record-jump-highlight="true"[\s\S]*border-color:[\s\S]*background-color:[\s\S]*box-shadow: none;/, 'record jump feedback must use an in-box border and surface tint that cannot be clipped by a scrolling ancestor')
assert.match(records, /<AlertDialogCancel onClick=\{\(\) => fadeJumpHighlight\(jumpFocusTarget\.current\)\}>[\s\S]*留在此处/, 'record highlight fade must begin only when the user chooses to stay')
assert.match(records, /JUMP_HIGHLIGHT_HOLD_MS = 520[\s\S]*recordJumpPendingFade[\s\S]*JUMP_HIGHLIGHT_FADE_MS/, 'staying at a record must preserve the highlight briefly before its paint-only fade')
assert.match(styles, /data-record-jump-fading="true"[\s\S]*record-jump-highlight-fade/, 'record highlight dismissal needs a paint-only fade state')
assert.match(imageViewer, /image-viewer-dialog/, 'the image viewer must use the business-level full-viewport dialog contract')
assert.match(imageViewer, /<DialogPortal>[\s\S]*<DialogOverlay[\s\S]*<DialogPrimitive\.Popup[\s\S]*data-slot="image-viewer-content"[\s\S]*fixed inset-0[\s\S]*aria-label="关闭大图"/, 'the image viewer must compose a viewport popup and localized close action outside shadcn source')
assert.doesNotMatch(imageViewer, /DialogPrimitive\.Popup[\s\S]{0,600}(?:top-1\/2|left-1\/2|-translate-[xy]-1\/2|zoom-in-95)/, 'the viewport popup must never inherit the shared centred-dialog geometry or animation')
assert.match(styles, /\.image-viewer-dialog\[data-slot="image-viewer-content"\][\s\S]*animation: none;/, 'the image viewer CSS must own paint only, without rebuilding viewport geometry')
assert.match(styles, /\.image-viewer-overlay\s*\{[\s\S]*background: rgb\(8 10 13 \/ 72%\)/, 'the image viewer must dim the current page through one stable overlay')
assert.doesNotMatch(imageViewer, /image-viewer-ambient/, 'the image viewer must not synthesize a replacement background from the opened image')
assert.doesNotMatch(imageViewer, /image-viewer-(?:dialog|viewport)[^"\n]*bg-black/, 'the image viewer content and viewport must not create a black rectangle around media')
assert.match(imageViewer, /<Dialog modal="trap-focus"/, 'the full-screen image viewer must use the modal focus and scroll-lock contract')
assert.match(imageViewer, /MIN_SCALE = 1[\s\S]*MAX_SCALE = 8[\s\S]*zoomTo/, 'image zoom must use one bounded transform model')
assert.match(imageViewer, /viewportElement[\s\S]*ResizeObserver[\s\S]*ref=\{setViewportElement\}/, 'portal-mounted viewers must begin measurement when the real viewport node appears')
assert.match(imageViewer, /onWheel=[\s\S]*onDoubleClick=[\s\S]*onPointerDown=[\s\S]*pinch\.current/, 'image zoom must support wheel, double-click, drag, and pinch without parallel state systems')
assert.match(imageViewer, /translate3d\([\s\S]*scale\(\$\{viewTransform\.scale\}\)/, 'image zoom must scale the image itself rather than only resizing its frame')
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
assert.match(timeline, /grid-cols-4 gap-1 sm:grid-cols-7 lg:grid-cols-10 2xl:grid-cols-14/, 'the daily calendar must provide a denser responsive layout')
assert.match(
  timeline,
  /aspect-square h-auto min-h-0[\s\S]*grid-rows-\[auto_1fr\]/,
  'daily cells must restore a stable square frame without a fixed stretched height',
)
assert.match(timeline, /flex-col items-center justify-center gap-0\.5/, 'daily pie and value must use one dense, stable visual stack')
assert.match(timeline, /w-\[58%\][\s\S]*max-w-12/, 'daily pies must occupy a larger responsive share of their square')
assert.match(timeline, /daily-distribution-pie/, 'daily author pies need a dedicated responsive geometry')
assert.match(timeline, /compactStatistic\(item\.value\)/, 'large daily values must use a compact non-overflowing display')
assert.match(timeline, /daily-distribution-important-marker/, 'important days need a compact non-text visual marker')
assert.doesNotMatch(timeline, />\s*(?:重|重要) \{compactStatistic\(item\.important\)\}/, 'daily cells must not print a redundant important label')
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
assert.match(markup, /type: 'blank'; answer: string/, 'quiz blanks must be represented as entity-aware safe AST nodes')
assert.match(markup, /node\.id === redaction\.id[\s\S]*visibleLabel === redaction\.normalizedLabel/, 'quiz redaction must match both entity identity and exact visible label')
assert.doesNotMatch(markupContent, /\.split\(/, 'quiz prompts must not globally replace matching display text')
assert.match(quiz, /quiz-result-correct[\s\S]*quiz-result-wrong/, 'quiz feedback must use theme-aware semantic state colors')
assert.match(
  quiz,
  /current\.content === 'secret' && secretHint[\s\S]*<strong>继续作答<\/strong>[\s\S]*选择答案或填写完整内容后提交。/,
  'secret-question retries must reuse the persistent footer status region',
)
assert.doesNotMatch(
  quiz,
  /secretHint && \([\s\S]{0,240}<Alert/,
  'secret-question retries must not create a standalone feedback box',
)
assert.doesNotMatch(quiz, /result === 'correct' && 'text-\[oklch/, 'quiz feedback must not hard-code a light-theme success color')
assert.match(styles, /\.dark \.quiz-question-card[\s\S]*--quiz-type-ink:[\s\S]*--quiz-success-foreground:[\s\S]*--quiz-error-foreground:/, 'dark quiz surfaces and state text need dedicated semantic contrast tokens')
assert.match(styles, /--quiz-option-surface:[\s\S]*--quiz-option-disabled-foreground:/, 'quiz options need shared readable surface and foreground tokens')
assert.match(styles, /\.quiz-option:not\(:disabled\):hover[\s\S]*\.quiz-option:not\(:disabled\):active[\s\S]*aria-pressed="true"/, 'quiz default, hover, pressed and selected states must use the shared semantic option system')
assert.doesNotMatch(styles, /\.quiz-option:not\(:disabled\):hover\s*\{[^}]*transform:/, 'quiz option hover must not lift or move the control')
assert.match(styles, /\.quiz-question-card > \.quiz-question-header[\s\S]*border-start-start-radius:[\s\S]*\.quiz-question-card > \[data-slot="card-footer"\][\s\S]*border-end-start-radius:/, 'quiz header and footer surfaces must follow the card inner corner geometry')
assert.match(quiz, /<Card[\s\S]*aria-label="答题筛选"[\s\S]*quiz-filter-bar/, 'the quiz filter boundary must reuse the shared shadcn Card contract')
assert.match(quiz, /content-frame quiz-filter-bar[\s\S]*content-frame quiz-question-card/, 'quiz filter and question surfaces must share the stable in-box frame contract')
assert.match(quiz, /quiz-filter-bar[\s\S]*<CardContent className="flex flex-wrap items-center[\s\S]*<Card[\s\S]*quiz-question-card/, 'quiz surfaces must compose content inside shadcn cards without a connecting page fill')
assert.match(styles, /\.quiz-question-card > \[data-slot="card-footer"\][\s\S]*background: transparent;/, 'the quiz footer must not paint a second bottom surface')
assert.match(materials, /<Card[\s\S]*role="region"[\s\S]*aria-label="资料阅读区"/, 'materials must use the shared shadcn Card boundary')
assert.match(materials, /className="content-frame grid min-h-0 flex-1/, 'materials must use the shared stable in-box frame contract')
assert.doesNotMatch(materials, /<section[\s\S]{0,240}border-border/, 'materials must not restore a bespoke page border')
assert.match(mealMap, /<Card className="content-frame min-h-0 flex-1 gap-0 py-0">[\s\S]*<figure/, 'the map must use the shared in-box Card boundary')
assert.doesNotMatch(mealMap, /<figure[^>]+(?:border-border|bg-card|shadow-sm)/, 'the map figure must not paint a second border or background inside its card')
assert.match(styles, /\.content-frame\[data-slot="card"\][\s\S]*max-width: 100%;[\s\S]*border: 1px solid var\(--border\)/, 'locked viewport frames must keep a real four-sided border within their own box')
assert.match(styles, /\.content-frame\[data-slot="card"\][\s\S]*box-shadow: none;/, 'locked viewport frames must not rely on an outer shadow that a parent can clip')
assert.doesNotMatch(styles, /\.quiz-question-header\s*\{[^}]*border-left:/, 'quiz cards must not restore the removed colored side strip')
assert.doesNotMatch(styles, /\.quiz-question-prompt::before/, 'quiz prompts must not replace the removed side strip with another colored bar')
assert.match(quiz, /quiz-question-side-value quiz-judge-correction/, 'revealed judge corrections must preserve the unrevealed author typography contract')
assert.match(styles, /\.quiz-judge-correction[\s\S]*font-size: 1\.1rem;[\s\S]*font-weight: 700;[\s\S]*line-height: 1\.45;/, 'judge corrections must not shrink or reflow the author name typography')
assert.doesNotMatch(styles, /@keyframes guide-logo-|\.guide-logo-(?:tap|secret)/, 'removed logo interactions must not leave dead animation CSS')
assert.equal((quiz.match(/<ButtonGroup>/g) || []).length, 2, 'nearby quiz controls must use the standard shadcn ButtonGroup contract')
assert.match(styles, /--elevation-subtle:[\s\S]*--elevation-raised:[\s\S]*--elevation-overlay:/, 'all remaining elevation must come from one bounded shadow scale')
assert.match(styles, /--shadow-2xs: var\(--elevation-subtle\)[\s\S]*--shadow-2xl: var\(--elevation-overlay\)/, 'Tailwind and shadcn shadow utilities must resolve to the shared restrained scale')
assert.doesNotMatch(styles, /box-shadow:\s*0\s+(?:0\.[4-9]|1)rem/, 'materials must not retain independent or broad direct shadows')
assert.doesNotMatch(styles, /background: oklch\(0\.96 0\.025 155\);/, 'correct quiz options must not retain a light-only surface')
assert.match(markupContent, /record-stack--\$\{node\.kind\}/, 'fractions and equation arrows must keep distinct structures')
assert.match(markupContent, /className="record-stack-line"/, 'stack rules must be rendered independently from their labels')
assert.match(markupContent, /align="center"[\s\S]*alignOffset=\{lockedAlignOffset\}/, 'illustration previews must center on one locked pointer anchor')
assert.match(markupContent, /pointerX - \(bounds\.left \+ bounds\.width \/ 2\)/, 'illustration pointer alignment must use the trigger center delta')
assert.match(markupContent, /decoration-dotted/, 'annotation text must remain visibly discoverable')
assert.match(markupContent, /record-annotation-popup/, 'annotation content needs an isolated collision-aware popup surface')
assert.match(markupContent, /function Annotation[\s\S]*alignOffset=\{lockedAlignOffset\}/, 'annotations must lock one pointer-centered horizontal anchor per open lifecycle')
assert.doesNotMatch(markupContent, /setLockedAlignOffset\(0\)/, 'closing a hover card must not reset its position before the exit animation finishes')
assert.doesNotMatch(markupContent, /setLockedDimensions\(null\)/, 'illustration exit animation must retain its measured frame')
assert.equal(
  (markupContent.match(/useDismissOnVerticalScroll\(open, triggerRef/g) || []).length,
  2,
  'annotation and illustration surfaces must share the vertical-scroll dismissal contract',
)
assert.match(
  dismissOnScroll,
  /window\.addEventListener\('scroll',[\s\S]*capture: true[\s\S]*passive: true/,
  'scroll dismissal must capture element and document scrolling without blocking it',
)
assert.match(
  dismissOnScroll,
  /let dismissed = false[\s\S]*dismissed = true[\s\S]*onDismissRef\.current\(\)/,
  'one open surface must start its exit path only once per scroll lifecycle',
)
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
assert.match(styles, /\.app-main-surface \{[\s\S]*color-mix\(in oklch, var\(--background\) 68%, transparent\)/, 'the application surface must reveal the selected fixed background')
assert.match(shell, /<Sidebar collapsible="icon" className="app-sidebar">/, 'the business shell must opt the shadcn sidebar into background-aware styling')
assert.match(shell, /<SidebarRail \/>/, 'the sidebar edge must use the unmodified shadcn rail composition')
assert.doesNotMatch(shell, /useSelectionMotion|SelectionMotionLayers|app-sidebar-navigation|app-sidebar-rail-affordance/, 'Sidebar must not retain a custom visual state machine')
assert.match(segmentedTabs, /<TabsList[\s\S]*<TabsTrigger/, 'segmented controls must remain a thin shadcn Tabs composition')
assert.doesNotMatch(segmentedTabs, /useSelectionMotion|SelectionMotionLayers|position: absolute|animate\(/, 'segmented controls must update their selected state directly')
assert.doesNotMatch(interaction, /pointermove|pointerdown|getBoundingClientRect|useState/, 'buttons must not run pointer sampling or component paint state')
assert.match(styles, /--scrollbar-edge-inset[\s\S]*\[data-slot="scroll-area-thumb"\]/, 'scroll areas must derive edge insets and thumb geometry from shared tokens')
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
assert.match(people, /mainFirst[\s\S]*Number\(b\.main\) - Number\(a\.main\)/, 'main-teacher priority sorting must remain intact')
assert.match(people, /isMainTeacher[\s\S]*border-l-primary/, 'main teachers must retain their non-text row emphasis')
assert.doesNotMatch(people, /<Badge[\s\S]*主要/, 'main-teacher names must not carry a visible badge')
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
