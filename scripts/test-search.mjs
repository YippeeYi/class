import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const search = await readFrontend('src/pages/search-page.tsx')
assert.match(search, /new Set\(\['record', 'person', 'quote'\]\)/, 'all search scopes must start enabled')
assert.match(search, /stripMarkup\(record\.content\)/, 'record markup must be normalized for search')
assert.match(search, /person\.bio/, 'person biography must be indexed')
assert.match(search, /quote\.quote/, 'quote text must be indexed')
assert.match(search, /slice\(0, 100\)/, 'search result rendering must be bounded')
console.log('React search checks passed.')
