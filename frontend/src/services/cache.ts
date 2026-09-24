import { ACCESS_KEY } from '@/features/auth/auth-storage'
import { getDataVersion, subscribeDataVersion } from '@/services/data-revision'
import { ensureInitialDataVersion, isDataVersionVerified } from '@/services/data-updates'

type CacheEntry<T> = { time: number; data: T; version?: string }

const VERSION = 'v6'
const SESSION_PREFIX = `classRecord:dataCache:${VERSION}:`
const DATABASE_NAME = 'classRecord-data-cache-v2'
const STORE_NAME = 'entries'
const DEFAULT_FRESH = 24 * 60 * 60 * 1000
const DEFAULT_STALE = 7 * 24 * 60 * 60 * 1000
const memory = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const businessKeys = new Set<string>()
let generation = 0

function accessScope() {
  try {
    const item = JSON.parse(localStorage.getItem(ACCESS_KEY) || '{}') as {
      type?: string
      token?: string
      authorizedAt?: string
    }
    return item.type === 'invite' && item.token && item.authorizedAt
      ? `access-${item.authorizedAt}`
      : 'unauthorized'
  } catch {
    return 'unauthorized'
  }
}

function scopedKey(key: string) {
  return `${VERSION}:${accessScope()}:${key}`
}

function sessionKey(scoped: string) {
  return `${SESSION_PREFIX}${scoped}`
}

function readSession<T>(key: string, ttl: number, version: string): CacheEntry<T> | null {
  if (ttl <= 0) return null
  try {
    const item = JSON.parse(
      sessionStorage.getItem(sessionKey(key)) || 'null',
    ) as CacheEntry<T> | null
    if (
      !item ||
      (item.version || '') !== version ||
      !Number.isFinite(item.time) ||
      Date.now() - item.time >= ttl
    ) {
      sessionStorage.removeItem(sessionKey(key))
      return null
    }
    return item
  } catch {
    return null
  }
}

function writeSession<T>(key: string, entry: CacheEntry<T>) {
  try {
    sessionStorage.setItem(sessionKey(key), JSON.stringify(entry))
  } catch {
    // Storage is an optimization; memory and the network remain available.
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window) || accessScope() === 'unauthorized') return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close()
        return
      }
      settled = true
      clearTimeout(timeout)
      if (database) database.onversionchange = () => database.close()
      resolve(database)
    }
    const timeout = setTimeout(() => finish(null), 5000)
    try {
      const request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME))
          request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

async function readPersistent<T>(
  scoped: string,
  freshTtl: number,
  staleTtl: number,
  version: string,
) {
  const database = await openDatabase()
  if (!database) return null
  try {
    const result = await new Promise<CacheEntry<T> | null>((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(scoped)
      request.onsuccess = () => resolve((request.result as CacheEntry<T> | undefined) || null)
      request.onerror = transaction.onabort = () => resolve(null)
    })
    if (
      !result ||
      (result.version || '') !== version ||
      !Number.isFinite(result.time) ||
      Date.now() - result.time >= staleTtl
    )
      return null
    return { ...result, stale: Date.now() - result.time >= freshTtl }
  } catch {
    return null
  } finally {
    database.close()
  }
}

async function writePersistent<T>(
  scoped: string,
  entry: CacheEntry<T>,
  requestGeneration: number,
  business: boolean,
) {
  const database = await openDatabase()
  if (!database) return
  try {
    if (requestGeneration !== generation || (business && entry.version !== getDataVersion())) return
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => resolve()
      transaction.objectStore(STORE_NAME).put({ key: scoped, ...entry })
    })
  } catch {
    /* Storage failures never block reading the archive. */
  } finally {
    database.close()
  }
}

export async function loadCached<T>({
  key,
  loader,
  force = false,
  freshTtl = DEFAULT_FRESH,
  staleTtl = DEFAULT_STALE,
  sessionTtl = 15 * 60 * 1000,
  persistent = true,
  business = true,
}: {
  key: string
  loader: () => Promise<T>
  force?: boolean
  freshTtl?: number
  staleTtl?: number
  sessionTtl?: number
  persistent?: boolean
  business?: boolean
}) {
  const initialScope = accessScope()
  const initialGeneration = generation
  if (business) await ensureInitialDataVersion()
  if (initialScope !== accessScope() || initialGeneration !== generation)
    throw new Error('访问范围已改变，请重新加载。')
  // A matching server revision extends freshness only within the existing retention window.
  const effectiveFreshTtl =
    business && isDataVersionVerified() ? Math.max(freshTtl, staleTtl) : freshTtl
  const now = Date.now()
  const scoped = scopedKey(key)
  const version = business ? getDataVersion() : ''
  if (business) businessKeys.add(scoped)
  const cached = memory.get(scoped) as CacheEntry<T> | undefined
  if (
    !force &&
    cached &&
    (cached.version || '') === version &&
    now - cached.time < effectiveFreshTtl
  )
    return cached.data
  const pending = inflight.get(scoped)
  if (pending) return pending as Promise<T>

  const requestGeneration = generation
  const scope = accessScope()
  const assertCurrent = () => {
    if (
      requestGeneration !== generation ||
      scope !== accessScope() ||
      (business && version !== getDataVersion())
    )
      throw new Error('访问范围已改变，请重新加载。')
  }
  // Register before IndexedDB or the network can yield, including forced retries.
  const request = Promise.resolve()
    .then(async () => {
      let stale: CacheEntry<T> | null = null
      assertCurrent()
      if (!force) {
        const session = readSession<T>(scoped, sessionTtl, version)
        if (session) {
          memory.set(scoped, session)
          return session.data
        }
        if (persistent) {
          const stored = await readPersistent<T>(
            scoped,
            effectiveFreshTtl,
            Math.max(staleTtl, effectiveFreshTtl),
            version,
          )
          assertCurrent()
          if (stored && !stored.stale) {
            memory.set(scoped, stored)
            if (sessionTtl > 0) writeSession(scoped, stored)
            return stored.data
          }
          stale = stored
        }
      }
      try {
        const data = await loader()
        assertCurrent()
        const entry = { time: Date.now(), data, version }
        memory.set(scoped, entry)
        if (sessionTtl > 0) writeSession(scoped, entry)
        if (persistent) void writePersistent(scoped, entry, requestGeneration, business)
        return data
      } catch (error) {
        assertCurrent()
        if (stale) {
          memory.set(scoped, stale)
          // Preserve the source timestamp: offline reads cannot extend its lifetime.
          return stale.data
        }
        throw error
      }
    })
    .finally(() => {
      if (inflight.get(scoped) === request) inflight.delete(scoped)
    })
  inflight.set(scoped, request)
  return request
}

export function clearRuntimeCache() {
  generation += 1
  memory.clear()
  inflight.clear()
  businessKeys.clear()
}

export async function deletePersistentCaches() {
  clearRuntimeCache()
  if (!('indexedDB' in window)) return
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

// Keep downloaded images and signed URLs intact; only database reads use this cache.
subscribeDataVersion(() => {
  for (const key of businessKeys) {
    memory.delete(key)
    inflight.delete(key)
  }
  businessKeys.clear()
})
