import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const page = await readFrontend('src/pages/records-page.tsx')
const card = await readFrontend('src/components/archive/record-card.tsx')
const filters = await readFrontend('src/components/archive/record-filters.tsx')
assert.match(page, /value="list"/, 'list view is missing')
assert.match(page, /value="written"/, 'written view is missing')
assert.match(filters, /year.*month.*day.*important.*excludeDaily.*query/s, 'record filters are incomplete')
assert.match(page, /loadPageMessages/, 'written messages must be restored')
assert.match(page, /loadPageSupplements/, 'written supplements must be restored')
assert.match(
  page,
  /if \(view !== 'written'\) return null[\s\S]*Promise\.all\(\[/,
  'written-only data must not block the list-view first screen',
)
assert.match(page, /recordsResource = useAsyncData\(\(\) => loadRecords\(\)\)/, 'the list view must own its minimal record request')
assert.doesNotMatch(page, /useArchive/, 'the record list must not wait for unrelated people and quote data')
assert.match(page, /qibaishihuaxia/, 'admin hidden-record sequence was not preserved')
assert.match(page, /hasAdminAccess/, 'hidden records must check admin access')
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
  page,
  /buildSupplementalRecords\(\[pageMessage\], \[\]\)\.map[\s\S]*<RecordCard/,
  'written-page proverbs must reuse the shared record card',
)
assert.match(card, /record\.recordType === 'message' \? '箴言'/, 'proverbs need a lightweight type badge')
assert.match(card, /recordDisplayNumber\(record\)/, 'all record cards must use the shared number formatter')
assert.doesNotMatch(card, /日期未记录/, 'record cards must omit absent dates instead of rendering a placeholder')
assert.match(card, /recordWrittenHref\(record\)/, 'record cards must expose the written-source jump')
assert.match(card, /record-source-action/, 'record source actions must remain quiet until hover or focus')
assert.match(page, /showSourceAction=\{false\}/, 'written-mode cards must not show a redundant source action')
assert.match(
  page,
  /targetRecord = \[\.\.\.records, \.\.\.extras\][\s\S]*targetPageIndex[\s\S]*setPageIndex/,
  'asynchronous written jumps must select the page containing the target before scrolling',
)
assert.doesNotMatch(page, /<Card className="bg-muted\/45">/, 'proverbs must not keep a separate heavy card treatment')
assert.match(
  page,
  /className="h-auto w-full overflow-hidden rounded-lg border border-border\/70 bg-transparent p-0/,
  'written images must not retain a padded gray trigger frame',
)
assert.doesNotMatch(page, /bg-muted\/40 p-2|bg-muted\/55/, 'written images must not keep nested gray backgrounds')
assert.doesNotMatch(
  page,
  /key=\{`\$\{criteria\.year\}/,
  'changing one filter must not remount the entire record list',
)
console.log('React record view checks passed.')
