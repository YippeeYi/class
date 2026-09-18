import { getStoredAccessToken } from '@/features/auth/auth-storage'
import { acceptDataVersion, DATA_VERSION_KEY, getDataVersion } from '@/services/data-revision'
import { getSupabase } from '@/services/supabase'

export const DATA_POLL_INTERVAL = 60_000
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
      const { data, error } = await getSupabase(token).rpc('get_class_data_version')
      if (!active || getStoredAccessToken() !== token || error || typeof data !== 'string') return
      if (acceptDataVersion(data)) channel?.postMessage({ version: getDataVersion() })
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
  void check()
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
