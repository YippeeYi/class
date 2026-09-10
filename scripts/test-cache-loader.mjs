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

// Exercise the actual loader with asynchronous IndexedDB, including teardown races.
const { createServer } = await import('vite')
const { frontend } = await import('./test-react-helpers.mjs')
const { default: path } = await import('node:path')
const memoryStorage = () => {
  const entries = new Map()
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key), clear: () => entries.clear(), entries }
}
globalThis.window = {}
globalThis.localStorage = memoryStorage()
globalThis.sessionStorage = memoryStorage()
const setScope = (authorizedAt) => localStorage.setItem('classRecord:inviteAccess', JSON.stringify({ type: 'invite', token: 'fixture', authorizedAt }))
setScope('first')
const stored = new Map()
let deferOpen = null
let failTransaction = false
const database = {
  close() {},
  objectStoreNames: { contains: () => true },
  transaction() {
    if (failTransaction) throw new Error('storage unavailable')
    const tx = { objectStore: () => ({
      get(key) { const request = {}; setImmediate(() => { request.result = stored.get(key); request.onsuccess?.() }); return request },
      put(entry) { stored.set(entry.key, entry); setImmediate(() => tx.oncomplete?.()); return {} },
    }) }
    return tx
  },
}
window.indexedDB = globalThis.indexedDB = {
  open() { const request = { result: database }; setImmediate(() => { if (deferOpen) deferOpen(() => request.onsuccess()); else request.onsuccess() }); return request },
}
const vite = await createServer({ configFile: false, root: frontend, resolve: { alias: { '@': path.join(frontend, 'src') } }, server: { middlewareMode: true }, logLevel: 'silent' })
try {
  const { loadCached, clearRuntimeCache } = await vite.ssrLoadModule('/src/services/cache.ts')
  let requests = 0
  const loader = async () => { requests += 1; return ['loaded'] }
  const values = await Promise.all(Array.from({ length: 10 }, () => loadCached({ key: 'shared', loader })))
  assert.equal(requests, 1, 'concurrent IndexedDB misses must make one request')
  assert.equal(values.length, 10)
  clearRuntimeCache()
  let resolveNetwork
  const pending = loadCached({ key: 'teardown', persistent: false, loader: () => new Promise((resolve) => { resolveNetwork = resolve }) })
  const pendingRejected = assert.rejects(pending, /访问范围已改变/)
  await new Promise(setImmediate)
  clearRuntimeCache()
  setScope('second')
  resolveNetwork(['private old result'])
  await pendingRejected
  assert.equal([...sessionStorage.entries.values()].some((value) => value.includes('private old result')), false)
  let finishOpen
  const opened = new Promise((resolve) => { deferOpen = (finish) => { finishOpen = finish; resolve() } })
  const opening = loadCached({ key: 'opening', loader: () => { assert.fail('cleared request must not start its network loader') } })
  const openingRejected = assert.rejects(opening, /访问范围已改变/)
  await opened
  clearRuntimeCache()
  deferOpen = null
  finishOpen()
  await openingRejected
  failTransaction = true
  assert.deepEqual(await loadCached({ key: 'broken-storage', loader }), ['loaded'])
  await new Promise(setImmediate)
  failTransaction = false
  clearRuntimeCache()
  const timestamp = Date.now() - 2000
  stored.set('v6:access-second:stale', { time: timestamp, data: ['offline'] })
  assert.deepEqual(await loadCached({ key: 'stale', freshTtl: 1000, staleTtl: 5000, loader: () => Promise.reject(new Error('offline')) }), ['offline'])
  assert.equal(stored.get('v6:access-second:stale').time, timestamp, 'stale fallback cannot renew data freshness')
  console.log('Runtime cache concurrency, access teardown, storage failure and stale-age checks passed.')
} finally { await vite.close() }
