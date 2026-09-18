// Business revisions never contain or write authentication state.
export const DATA_VERSION_KEY = 'classRecord:businessVersion'
const listeners = new Set<() => void>()
function readVersion() {
  try {
    const value = localStorage.getItem(DATA_VERSION_KEY) || ''
    return /^\d+$/.test(value) ? value : ''
  } catch {
    return ''
  }
}
let version = readVersion()
export const getDataVersion = () => version
export function subscribeDataVersion(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function acceptDataVersion(next: string) {
  if (!/^\d+$/.test(next) || (version && BigInt(next) <= BigInt(version))) return false
  version = next
  try {
    localStorage.setItem(DATA_VERSION_KEY, next)
  } catch {
    /* Memory remains usable. */
  }
  for (const listener of listeners) listener()
  return true
}
