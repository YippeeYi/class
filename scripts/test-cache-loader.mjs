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
globalThis.window = { addEventListener() {} }
let versionRequests = 0
let finishVersion
const versionReady = new Promise((resolve) => { finishVersion = resolve })
globalThis.fetch = async () => {
  versionRequests++
  await versionReady
  return new Response('\"1\"', { headers: { 'content-type': 'application/json' } })
}
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
  const initialReads = Promise.all(Array.from({ length: 10 }, () => loadCached({ key: 'shared', loader })))
  await new Promise(setImmediate)
  assert.equal(requests, 0, 'business reads wait for the single initial revision result')
  assert.equal(versionRequests, 1, 'simultaneous readers share one version request')
  finishVersion()
  const values = await initialReads
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
  stored.set('v6:access-second:stale', { time: timestamp, version: '1', data: ['offline'] })
  assert.deepEqual(await loadCached({ key: 'stale', freshTtl: 1000, staleTtl: 5000, loader: () => Promise.reject(new Error('offline')) }), ['offline'])
  assert.equal(stored.get('v6:access-second:stale').time, timestamp, 'stale fallback cannot renew data freshness')
  stored.set('v6:access-second:verified-stale', { time: Date.now() - 2 * 24 * 60 * 60 * 1000, version: '1', data: ['still current'] })
  assert.deepEqual(await loadCached({ key: 'verified-stale', loader: () => assert.fail('verified revision must reuse retained data beyond the soft TTL') }), ['still current'])
  const { acceptDataVersion, getDataVersion } = await vite.ssrLoadModule('/src/services/data-revision.ts')
  const imageLoader = () => loadCached({ key: 'image-dimensions:retained', business: false, loader: async () => { requests++; return { width: 136, height: 127 } } })
  const dimensions = await imageLoader()
  await new Promise(setImmediate)
  const credentials = localStorage.getItem('classRecord:inviteAccess')
  const loadVersioned = (value) => loadCached({ key: 'versioned', loader: async () => { requests++; return value } })
  assert.equal(await loadVersioned('old'), 'old')
  await new Promise(setImmediate)
  const oldRequests = requests
  assert.equal(acceptDataVersion('2'), true)
  assert.equal(await loadVersioned('new'), 'new', 'version update bypasses old memory/session/IndexedDB entries')
  assert.equal(requests, oldRequests + 1)
  clearRuntimeCache()
  assert.equal(await loadVersioned('unexpected'), 'new', 'new version persists through runtime reset')
  assert.equal(acceptDataVersion('2'), false, 'duplicate notification must not invalidate')
  assert.equal(acceptDataVersion('1'), false, 'late response must not restore an old version')
  assert.equal(acceptDataVersion('invalid'), false)
  assert.equal(getDataVersion(), '2')
  const readsBeforeImage = requests
  assert.deepEqual(await imageLoader(), dimensions, 'image metadata survives business invalidation and memory reset')
  assert.equal(requests, readsBeforeImage, 'persisted image metadata must not be re-requested')
  assert.equal(localStorage.getItem('classRecord:inviteAccess'), credentials, 'revision never mutates credentials')
  let finishOld
  const oldRequest = loadCached({ key: 'changing-version', persistent: false, loader: () => new Promise((resolve) => { finishOld = resolve }) })
  const superseded = assert.rejects(oldRequest, /访问范围已改变/)
  await new Promise(setImmediate)
  acceptDataVersion('3')
  const newest = loadCached({ key: 'changing-version', persistent: false, loader: async () => 'latest' })
  finishOld('outdated')
  await superseded
  assert.equal(await newest, 'latest', 'in-flight old reads cannot overwrite a new revision')
  assert.equal([...sessionStorage.entries.values()].some((value) => value.includes('outdated')), false)
  console.log('Business revision cache invalidation, persistence, dedupe, stale response and credential preservation passed.')
  console.log('Runtime cache concurrency, access teardown, storage failure and stale-age checks passed.')
} finally { await vite.close() }
