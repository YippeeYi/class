import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend, readFrontend } from './test-react-helpers.mjs'

const search = await readFrontend('src/pages/search-page.tsx')
const recordFilters = await readFrontend('src/components/archive/record-filters.tsx')
const filterToggle = await readFrontend('src/components/archive/filter-toggle.tsx')
const searchIndex = await readFrontend('src/lib/search-index.ts')
assert.match(search, /new Set\(\['record', 'person', 'quote', 'material'\]\)/, 'all search scopes must start enabled')
assert.match(search, /loadMaterials/, 'material data must participate in the search resource lifecycle')
assert.match(searchIndex, /visiblePlainText/, 'record markup must be reduced to visible text for search')
assert.match(searchIndex, /person\.bio/, 'person biography must be indexed')
assert.match(searchIndex, /quote\.quote/, 'quote text must be indexed')
assert.match(searchIndex, /record\.author/, 'independent full search must retain visible record metadata')
assert.match(searchIndex, /relatedRecords/, 'material results must include related visible record content')
assert.doesNotMatch(searchIndex, /attachment\.file/, 'storage paths must never become searchable')
assert.match(recordFilters, /recordBodySearchText/, 'record-list search must use an independent body-only index')
const recordBodyIndexer = recordFilters.slice(
  recordFilters.indexOf('export function recordBodySearchText'),
  recordFilters.indexOf('export function filterRecords'),
)
assert.match(recordBodyIndexer, /stripMarkup\(record\.content\)/, 'record-list search must normalize rendered record body text')
assert.doesNotMatch(recordBodyIndexer, /record\.date|record\.time|record\.author|record\.attachments/, 'record-list search must ignore metadata and attachments')
assert.doesNotMatch(search, /slice\(0, 100\)/, 'search results must not be silently truncated')
assert.match(searchIndex, /title === needle.*title\.startsWith.*title\.includes/s, 'search relevance levels are missing')
assert.match(search, /<mark>/, 'search snippets must highlight matches')
assert.match(search, /120/, 'search input must be debounced')
assert.match(search, /<FilterToggle/, 'search scopes must use the shared persistent filter control')
assert.match(recordFilters, /<FilterToggle/, 'record flags must use the shared persistent filter control')
assert.match(filterToggle, /components\/ui\/toggle/, 'the shared filter control must compose shadcn Toggle')

const vite = await createServer({
  configFile: false,
  root: frontend,
  resolve: { alias: { '@': path.join(frontend, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})
try {
  const { buildSearchIndex, scoreSearchResult } = await vite.ssrLoadModule('/src/lib/search-index.ts')
  const records = [
    {
      id: 'R001',
      fileName: '2026-01-01-01.json',
      recordIndex: 1,
      date: '2026-01-01',
      time: '',
      author: '记录人',
      recorder: '记录人',
      content: '他妈的，阅读 [[material:m1|校史专题]] 与 [[person:sb|正常姓名]]。',
      text: '',
      importance: 'normal',
      attachments: [{ file: 'data/attachments/internal-private-name.png', name: '课堂照片' }],
      hidden: false,
    },
  ]
  const index = buildSearchIndex({
    records,
    people: [],
    quotes: [],
    materials: [{ id: 'm1', title: '校史专题', content: '校园历史正文' }],
    hideProfanity: true,
  })
  const record = index.find((item) => item.type === 'record')
  const material = index.find((item) => item.type === 'material')
  assert.ok(record.text.includes('***'))
  assert.ok(!record.text.includes('他妈的'))
  assert.ok(record.text.includes('正常姓名'), 'markup labels must stay searchable')
  assert.equal(scoreSearchResult(record, 'internal-private-name'), 0, 'asset paths must not leak into the index')
  assert.ok(scoreSearchResult(material, '校园历史正文') > 0, 'material body must be searchable')
  assert.ok(scoreSearchResult(material, '正常姓名') > 0, 'related record body must lead to its material')
  assert.equal(material.href, '/materials?id=m1')
} finally {
  await vite.close()
}
console.log('React search checks passed.')
