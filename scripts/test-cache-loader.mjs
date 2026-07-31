import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const data = await readFrontend('src/services/data.ts')
const cache = await readFrontend('src/services/cache.ts')
assert.match(cache, /const inflight = new Map/, 'data requests need a shared promise cache')
assert.match(cache, /inflight\.delete\(scoped\)/, 'completed resources must leave the request dedupe map')
assert.match(cache, /indexedDB\.open/, 'the archive needs a persistent IndexedDB cache')
assert.match(cache, /accessScope\(\).*authorizedAt/s, 'persistent cache entries must be scoped to the current access grant')
assert.match(data, /export function clearDataCache/, 'access removal must be able to clear data cache')
assert.match(data, /loadCached/, 'record reads must use the shared cache')
console.log('React data cache checks passed.')
