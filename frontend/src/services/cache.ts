import { ACCESS_KEY } from '@/features/auth/auth-storage'

type CacheEntry<T> = { time: number; data: T }

const VERSION = 'v5'
const SESSION_PREFIX = `classRecord:dataCache:${VERSION}:`
const DATABASE_NAME = 'classRecord-data-cache-v2'
const STORE_NAME = 'entries'
const DEFAULT_FRESH = 24 * 60 * 60 * 1000
const DEFAULT_STALE = 7 * 24 * 60 * 60 * 1000
const memory = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
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

function sessionKey(key: string) {
  return `${SESSION_PREFIX}${accessScope()}:${key}`
}

function readSession<T>(key: string, ttl: number): CacheEntry<T> | null {
  if (ttl <= 0) return null
  try {
    const item = JSON.parse(
      sessionStorage.getItem(sessionKey(key)) || 'null',
    ) as CacheEntry<T> | null
    if (!item || !Number.isFinite(item.time) || Date.now() - item.time >= ttl) {
      sessionStorage.removeItem(sessionKey(key))
      return null
    }
    return item
  } catch {
    return null
  }
}

function writeSession<T>(key: string, data: T) {
  try {
    sessionStorage.setItem(sessionKey(key), JSON.stringify({ time: Date.now(), data }))
  } catch {
    // Storage is an optimization; memory and the network remain available.
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window) || accessScope() === 'unauthorized') return Promise.resolve(null)
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DATABASE_NAME, 1)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function readPersistent<T>(
  key: string,
  freshTtl: number,
  staleTtl: number,
): Promise<(CacheEntry<T> & { stale: boolean }) | null> {
  const database = await openDatabase()
  if (!database) return null
  const result = await new Promise<CacheEntry<T> | null>((resolve) => {
    const request = database
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(scopedKey(key))
    request.onsuccess = () => resolve((request.result as CacheEntry<T> | undefined) || null)
    request.onerror = () => resolve(null)
  })
  database.close()
  if (!result || !Number.isFinite(result.time) || Date.now() - result.time >= staleTtl) return null
  return { ...result, stale: Date.now() - result.time >= freshTtl }
}

async function writePersistent<T>(key: string, data: T) {
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const request = database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put({ key: scopedKey(key), time: Date.now(), data })
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
  database.close()
}

export async function loadCached<T>({
  key,
  loader,
  force = false,
  freshTtl = DEFAULT_FRESH,
  staleTtl = DEFAULT_STALE,
  sessionTtl = 15 * 60 * 1000,
  persistent = true,
}: {
  key: string
  loader: () => Promise<T>
  force?: boolean
  freshTtl?: number
  staleTtl?: number
  sessionTtl?: number
  persistent?: boolean
}) {
  const now = Date.now()
  const scoped = scopedKey(key)
  const cached = memory.get(scoped) as CacheEntry<T> | undefined
  if (!force && cached && now - cached.time < freshTtl) return cached.data
  const pending = inflight.get(scoped)
  if (pending) return pending as Promise<T>

  let stale: CacheEntry<T> | null = null
  if (!force) {
    const session = readSession<T>(key, sessionTtl)
    if (session) {
      memory.set(scoped, session)
      return session.data
    }
    if (persistent) {
      const stored = await readPersistent<T>(key, freshTtl, Math.max(staleTtl, freshTtl))
      if (stored && !stored.stale) {
        memory.set(scoped, stored)
        if (sessionTtl > 0) writeSession(key, stored.data)
        return stored.data
      }
      stale = stored
    }
  }

  const requestGeneration = generation
  const request = loader()
    .then((data) => {
      if (requestGeneration !== generation) return data
      const entry = { time: Date.now(), data }
      memory.set(scoped, entry)
      if (sessionTtl > 0) writeSession(key, data)
      if (persistent) void writePersistent(key, data)
      return data
    })
    .catch((error) => {
      if (stale) {
        memory.set(scoped, stale)
        if (sessionTtl > 0) writeSession(key, stale.data)
        return stale.data
      }
      throw error
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
