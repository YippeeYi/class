import { getStoredAccessToken } from '@/features/auth/auth-storage'
import { acceptDataVersion, DATA_VERSION_KEY, getDataVersion } from '@/services/data-revision'
import { getSupabase } from '@/services/supabase'

export const DATA_POLL_INTERVAL = 60_000
// Shared by the cache loader and the mounted monitor: the first business read
// waits for one bounded check, even when child effects run before the monitor.
let verifiedVersion = ''
export const isDataVersionVerified = () =>
  Boolean(verifiedVersion && verifiedVersion === getDataVersion())
let initial: { token: string; promise: Promise<void> } | undefined
let pendingCheck: { token: string; promise: Promise<void> } | undefined
export function checkDataVersion(token: string) {
  if (pendingCheck?.token === token) return pendingCheck.promise
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  const promise = (async () => {
    try {
      const { data, error } = await getSupabase(token)
        .rpc('get_class_data_version')
        .abortSignal(controller.signal)
      if (getStoredAccessToken() === token && !error && typeof data === 'string') {
        acceptDataVersion(data)
        if (data === getDataVersion()) verifiedVersion = data
      }
    } catch {
      // Cached data remains usable when the version service is temporarily offline.
    } finally {
      clearTimeout(timeout)
    }
  })().finally(() => {
    if (pendingCheck?.promise === promise) pendingCheck = undefined
  })
  pendingCheck = { token, promise }
  return promise
}

export function ensureInitialDataVersion() {
  const token = getStoredAccessToken()
  if (!token) return Promise.resolve()
  if (initial?.token !== token) initial = { token, promise: checkDataVersion(token) }
  return initial.promise
}

// One monitor for the authenticated app, not one per page or resource.
export function startDataUpdates(token: string) {
  let active = true
  let pending = false
  let lastCheck = 0
  let channel: BroadcastChannel | undefined
  try {
    channel = new BroadcastChannel('classRecord:business-updates')
  } catch {
    /* Polling/storage work without it. */
  }
  const check = async () => {
    if (
      !active ||
      pending ||
      document.visibilityState === 'hidden' ||
      navigator.onLine === false ||
      Date.now() - lastCheck < 5000
    )
      return
    pending = true
    lastCheck = Date.now()
    try {
      const before = getDataVersion()
      await checkDataVersion(token)
      if (active && getStoredAccessToken() === token && before !== getDataVersion())
        channel?.postMessage({ version: getDataVersion() })
    } catch {
      /* Offline/temporary errors retain visible data and retry on the next tick. */
    } finally {
      pending = false
    }
  }
  const receive = (event: MessageEvent) => {
    if (active && typeof event.data?.version === 'string') acceptDataVersion(event.data.version)
  }
  const storage = (event: StorageEvent) => {
    if (event.key === DATA_VERSION_KEY && event.newValue) acceptDataVersion(event.newValue)
  }
  if (channel) channel.onmessage = receive
  const timer = window.setInterval(() => void check(), DATA_POLL_INTERVAL)
  const resume = () => {
    void check()
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  window.addEventListener('pageshow', resume)
  window.addEventListener('storage', storage)
  lastCheck = Date.now()
  const initialVersion = getDataVersion()
  void ensureInitialDataVersion().then(() => {
    if (active && initialVersion !== getDataVersion())
      channel?.postMessage({ version: getDataVersion() })
  })
  return () => {
    active = false
    window.clearInterval(timer)
    channel?.close()
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('pageshow', resume)
    window.removeEventListener('storage', storage)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('classrecordcacheclearing', () => {
    initial = undefined
    verifiedVersion = ''
  })
}
