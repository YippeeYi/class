import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const search = await readFrontend('src/pages/search-page.tsx')
assert.match(search, /new Set\(\['record', 'person', 'quote'\]\)/, 'all search scopes must start enabled')
assert.match(search, /normalized: normalizeText\(stripMarkup\(text\)\)/, 'record markup must be normalized for search')
assert.match(search, /person\.bio/, 'person biography must be indexed')
assert.match(search, /quote\.quote/, 'quote text must be indexed')
assert.doesNotMatch(search, /slice\(0, 100\)/, 'search results must not be silently truncated')
assert.match(search, /title === needle.*title\.startsWith.*title\.includes/s, 'search relevance levels are missing')
assert.match(search, /<mark>/, 'search snippets must highlight matches')
assert.match(search, /120/, 'search input must be debounced')
console.log('React search checks passed.')
