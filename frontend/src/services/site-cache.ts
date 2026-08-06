import { deletePersistentCaches } from '@/services/cache'
import { clearDataCache } from '@/services/data'
import { clearSupabaseClients } from '@/services/supabase'

let clearing: Promise<void> | null = null

export function clearAllSiteState({ preserveRedirectTarget = '' } = {}) {
  if (clearing) return clearing
  clearing = (async () => {
    window.dispatchEvent(new Event('classrecordcacheclearing'))
    clearDataCache()
    clearSupabaseClients()
    try {
      localStorage.clear()
    } catch {
      // In-memory resources are still cleared when persistent storage is unavailable.
    }
    try {
      sessionStorage.clear()
      if (preserveRedirectTarget) {
        sessionStorage.setItem('classRecordRedirectTarget', preserveRedirectTarget)
      }
    } catch {
      // The caller can still continue at the guide when session storage is unavailable.
    }
    await Promise.allSettled([
      deletePersistentCaches(),
      'caches' in window
        ? caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
        : Promise.resolve(),
      'serviceWorker' in navigator
        ? navigator.serviceWorker
            .getRegistrations()
            .then((items) => Promise.all(items.map((item) => item.unregister())))
        : Promise.resolve(),
    ])
    window.dispatchEvent(new Event('classrecordcachecleared'))
  })().finally(() => {
    clearing = null
  })
  return clearing
}
