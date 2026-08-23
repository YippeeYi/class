import assert from 'node:assert/strict'
import { loadTypescriptModule, readFrontend } from './test-react-helpers.mjs'

const page = await readFrontend('src/pages/records-page.tsx')
const writtenData = await readFrontend('src/features/records/written-record-data.ts')
const writtenPages = await readFrontend('src/features/records/written-record-pages.tsx')
const card = await readFrontend('src/components/archive/record-card.tsx')
const filters = await readFrontend('src/components/archive/record-filters.tsx')
const navigation = await readFrontend('src/lib/record-navigation.ts')
const person = await readFrontend('src/pages/person-page.tsx')
const people = await readFrontend('src/pages/people-page.tsx')
const search = await readFrontend('src/pages/search-page.tsx')
const recordOrderControls = await readFrontend('src/components/archive/record-order-toggle.tsx')
const recordOrder = await loadTypescriptModule('src/lib/record-order.ts')
assert.match(page, /value: 'list'/, 'list view is missing')
assert.match(page, /value: 'written'/, 'written view is missing')
assert.deepEqual(
  recordOrder
    .orderRecords(
      [
        { id: '10', fileName: '10.json', recordIndex: 10 },
        { id: '2', fileName: '2.json', recordIndex: 2 },
      ],
      'ascending',
    )
    .map((record) => record.id),
  ['2', '10'],
)
assert.match(
  page,
  /view === 'list' && \([\s\S]*<RecordOrderToggle/,
  'list mode must expose the shared order control',
)
assert.doesNotMatch(
  writtenPages,
  /RecordOrderToggle/,
  'written mode must never expose a reversible order control',
)
assert.match(
  writtenPages,
  /pageMessage[\s\S]*pageSupplements[\s\S]*pageRecords\.map/,
  'written mode must render proverbs, supplements, then ordinary records as continuous sections',
)
assert.match(
  writtenPages,
  /pageSupplements = supplements[\s\S]*supplementIndex - right\.supplementIndex/,
  'written supplements must be ordered by their record number',
)
assert.match(
  writtenPages,
  /orderRecords\([\s\S]*'ascending',[\s\S]*compareRecordNumber/,
  'written ordinary records must be fixed to ascending record number',
)
assert.match(
  person,
  /<RecordOrderToggle[\s\S]*人物相关记录显示顺序/,
  'person records must reuse the moving shared order control',
)
assert.match(
  people,
  /<RecordOrderToggle[\s\S]*value=\{descending \? 'descending' : 'ascending'\}[\s\S]*setDescending\(value === 'descending'\)/,
  'every people-list section must adapt its existing direction state to the shared order control',
)
assert.match(
  recordOrderControls,
  /function RecordOrderToggle[\s\S]*<Tabs[\s\S]*<SegmentedTabsList/,
  'all order controls must reuse the existing shadcn Tabs moving-selection composition',
)
assert.match(search, /<RecordOrderToggle[\s\S]*搜索记录结果显示顺序/, 'record search results must reuse the order control')
assert.match(page, /<SegmentedTabsList[\s\S]*items=\{recordViewItems\}/, 'record modes must restore the shared shadcn Tabs selection motion')
assert.match(page, /function recordsSearch/, 'record navigation state needs one URL serializer')
assert.match(page, /replaceRouteState\(value as 'list' \| 'written', criteria\)/, 'view tabs must update state and URL exactly once')
assert.match(writtenPages, /value=\{page\.page\}/, 'the written page selector must use the visible page identity')
assert.match(writtenPages, /value=\{item\.page\}/, 'written page options must use one-based domain page identities')
assert.doesNotMatch(writtenPages, /value=\{String\(safeIndex\)\}/, 'zero-based page indexes must stay internal')
assert.match(filters, /year.*month.*day.*important.*excludeDaily.*query/s, 'record filters are incomplete')
assert.match(writtenData, /loadPageMessages/, 'written messages must be restored')
assert.match(writtenData, /loadPageSupplements/, 'written supplements must be restored')
assert.match(
  page,
  /if \(view !== 'written'\) return null[\s\S]*loadWrittenRecordData\(hidden\)/,
  'written-only data must not block the list-view first screen',
)
assert.match(
  writtenData,
  /Promise\.allSettled\([\s\S]*if \(pagesResult\.status === 'rejected'\) throw pagesResult\.reason/,
  'written pages must remain required while auxiliary requests settle independently',
)
assert.match(
  writtenData,
  /messagesResult\.status === 'fulfilled' \? messagesResult\.value : \[\][\s\S]*supplementsResult\.status === 'fulfilled' \? supplementsResult\.value : \[\]/,
  'failed written auxiliaries must degrade to empty collections',
)
assert.match(
  page,
  /written\.data\.failures\.length > 0[\s\S]*部分辅助内容暂未加载[\s\S]*onClick=\{written\.retry\}/,
  'partial written failures must stay visible and retryable without replacing the page',
)
assert.match(page, /recordsResource = useAsyncData\(\(\) => loadRecords\(\)\)/, 'the list view must own its minimal record request')
assert.doesNotMatch(page, /useArchive/, 'the record list must not wait for unrelated people and quote data')
assert.match(page, /qibaishihuaxia/, 'admin hidden-record sequence was not preserved')
assert.match(page, /hasAdminAccess/, 'hidden records must check admin access')
assert.doesNotMatch(page, /decodeURIComponent/, 'record pages must not decode malformed hashes during render')
assert.match(navigation, /function decodeRecordHash[\s\S]*catch[\s\S]*return ''/, 'record hashes need a non-throwing decoder')
assert.doesNotMatch(
  page.slice(page.indexOf('export function RecordsPage'), page.indexOf('useLayoutEffect(() => {', page.indexOf('export function RecordsPage'))),
  /consumeRecordJump\(\)/,
  'pending record jumps must not be consumed during render',
)
assert.match(
  page,
  /recordNavigation = useRef\([\s\S]*origin:\s*\{[\s\S]*view: state\.view,[\s\S]*pageIndex: state\.pageIndex,[\s\S]*criteria: \{ \.\.\.state\.criteria \}[\s\S]*scrollY:/,
  'internal record jumps must capture the complete origin state without destabilizing card callbacks',
)
assert.match(page, /pendingReturn/, 'returning from an internal jump must restore the previous scroll position')
assert.match(page, /onRecordReference=\{navigateToRecord\}/, 'record cards must use the in-page navigation coordinator')
assert.match(card, /RecordCard/, 'record card component is missing')
assert.match(card, /memo\(function RecordCard/, 'record cards must skip unchanged rerenders')
assert.match(page, /const navigateToRecord = useCallback\(/, 'record-reference callbacks must remain stable across list renders')
assert.match(card, /onRecordReference/, 'record cards must forward internal record references')
assert.match(card, /signAssetUrl\(attachment\.file\)/, 'attachments must be signed on demand')
assert.match(filters, /WeakMap<RecordItem, string>/, 'record search text must be parsed once per record object')
assert.match(filters, /const \{ years, months, days \} = useMemo/, 'date selector options must be memoized')
assert.match(
  filters,
  /<Card className="mb-6 gap-0[^"]*py-0[^"]*">[\s\S]*<CardContent className="flex flex-col gap-3 p-4">/,
  'record filters must not stack the card and content top padding above the search field',
)
assert.match(
  writtenPages,
  /buildSupplementalRecords\(\[pageMessage\], \[\]\)\.map[\s\S]*<RecordCard/,
  'written-page proverbs must reuse the shared record card',
)
assert.match(card, /record\.recordType === 'message' \? '箴言'/, 'proverbs need a lightweight type badge')
assert.match(card, /recordDisplayNumber\(record\)/, 'all record cards must use the shared number formatter')
assert.doesNotMatch(card, /日期未记录/, 'record cards must omit absent dates instead of rendering a placeholder')
assert.match(card, /recordWrittenHref\(record\)/, 'record cards must expose the written-source jump')
assert.match(card, /onSourceAction\(record, event\.currentTarget\)/, 'record cards must let the records page coordinate same-route source jumps')
assert.match(card, /record-source-action/, 'record source actions must remain quiet until hover or focus')
assert.match(writtenPages, /showSourceAction=\{false\}/, 'written-mode cards must not show a redundant source action')
assert.match(
  page,
  /navigateToWrittenSource = useCallback[\s\S]*origin:[\s\S]*view: state\.view,[\s\S]*criteria: \{ \.\.\.state\.criteria \}[\s\S]*setView\('written'\)/,
  'list source actions must preserve their in-page origin before switching to written mode',
)
assert.match(
  page,
  /targetRecord = \[\.\.\.records, \.\.\.extras\][\s\S]*targetPageIndex[\s\S]*setPageIndex/,
  'asynchronous written jumps must select the page containing the target before scrolling',
)
assert.match(
  page,
  /view === 'written' && \(written\.loading \|\| !written\.data\)/,
  'same-route list-to-written jumps must wait for written data, not only its next loading flag',
)
assert.match(
  page,
  /useLayoutEffect\(\(\) => \{[\s\S]*scrollTargetIntoView\(target, 'smooth'\)[\s\S]*replaceRecordJumpHash[\s\S]*waitForWindowScrollEnd/,
  'record targets must perform one clamped smooth scroll and wait for its real completion',
)
assert.doesNotMatch(
  page.slice(page.indexOf('const loading ='), page.indexOf('const returnToOrigin')),
  /scrollIntoView|scrollTargetIntoView\(target[^)]*\)[\s\S]*scrollTargetIntoView\(target/,
  'record locating must not stack native alignment or a second target correction',
)
assert.match(page, /waitForWindowScrollEnd[\s\S]*setJumpDialogOpen\(true\)/, 'the jump dialog must not lock scrolling until movement settles')
assert.equal((page.match(/scrollTargetIntoView\(target/g) || []).length, 1, 'the locator must contain exactly one target scroll call')
assert.doesNotMatch(page, /target\.scrollIntoView/, 'near-bottom records must not rely on browser centre alignment')
assert.match(
  page,
  /onOpenChangeComplete=\{\(open\) =>[\s\S]*focus\(\{ preventScroll: true \}\)[\s\S]*finalFocus=\{false\}/,
  'closing the jump dialog must focus the visible target instead of the offscreen source control',
)
assert.doesNotMatch(page, /<Card className="bg-muted\/45">/, 'proverbs must not keep a separate heavy card treatment')
assert.match(
  writtenPages,
  /className="h-auto w-full overflow-hidden rounded-lg border border-border\/70 bg-transparent p-0/,
  'written images must not retain a padded gray trigger frame',
)
assert.doesNotMatch(writtenPages, /bg-muted\/40 p-2|bg-muted\/55/, 'written images must not keep nested gray backgrounds')
assert.doesNotMatch(
  page,
  /key=\{`\$\{criteria\.year\}/,
  'changing one filter must not remount the entire record list',
)
console.log('React record view checks passed.')
