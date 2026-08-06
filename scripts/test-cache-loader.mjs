import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const data = await readFrontend('src/services/data.ts')
const cache = await readFrontend('src/services/cache.ts')
assert.match(cache, /const inflight = new Map/, 'data requests need a shared promise cache')
assert.match(
  cache,
  /const pending = inflight\.get\(scoped\)[\s\S]*if \(pending\) return pending/,
  'normal loads and forced retries must share the same in-flight request',
)
assert.match(
  cache,
  /inflight\.get\(scoped\) === request/,
  'an older request must not remove a newer request from the dedupe map',
)
assert.match(cache, /inflight\.delete\(scoped\)/, 'completed resources must leave the request dedupe map')
assert.match(cache, /indexedDB\.open/, 'the archive needs a persistent IndexedDB cache')
assert.match(cache, /accessScope\(\).*authorizedAt/s, 'persistent cache entries must be scoped to the current access grant')
assert.match(data, /export function clearDataCache/, 'access removal must be able to clear data cache')
assert.match(data, /loadCached/, 'record reads must use the shared cache')
console.log('React data cache checks passed.')
