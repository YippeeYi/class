import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const search = await readFrontend('src/pages/search-page.tsx')
const recordFilters = await readFrontend('src/components/archive/record-filters.tsx')
const filterToggle = await readFrontend('src/components/archive/filter-toggle.tsx')
assert.match(search, /new Set\(\['record', 'person', 'quote'\]\)/, 'all search scopes must start enabled')
assert.match(search, /normalized: normalizeText\(stripMarkup\(text\)\)/, 'record markup must be normalized for search')
assert.match(search, /person\.bio/, 'person biography must be indexed')
assert.match(search, /quote\.quote/, 'quote text must be indexed')
assert.match(search, /record\.author/, 'independent full search must retain record metadata')
assert.match(recordFilters, /recordBodySearchText/, 'record-list search must use an independent body-only index')
const recordBodyIndexer = recordFilters.slice(
  recordFilters.indexOf('export function recordBodySearchText'),
  recordFilters.indexOf('export function filterRecords'),
)
assert.match(recordBodyIndexer, /stripMarkup\(record\.content\)/, 'record-list search must normalize rendered record body text')
assert.doesNotMatch(recordBodyIndexer, /record\.date|record\.time|record\.author|record\.attachments/, 'record-list search must ignore metadata and attachments')
assert.doesNotMatch(search, /slice\(0, 100\)/, 'search results must not be silently truncated')
assert.match(search, /title === needle.*title\.startsWith.*title\.includes/s, 'search relevance levels are missing')
assert.match(search, /<mark>/, 'search snippets must highlight matches')
assert.match(search, /120/, 'search input must be debounced')
assert.match(search, /<FilterToggle/, 'search scopes must use the shared persistent filter control')
assert.match(recordFilters, /<FilterToggle/, 'record flags must use the shared persistent filter control')
assert.match(filterToggle, /components\/ui\/toggle/, 'the shared filter control must compose shadcn Toggle')
console.log('React search checks passed.')
