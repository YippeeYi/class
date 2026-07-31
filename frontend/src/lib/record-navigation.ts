const JUMP_KEY = 'classrecord:pending-record-jump'

export type PendingRecordJump = {
  targetAnchorId: string
  originHref: string
  createdAt: number
}

export function prepareRecordJump(targetAnchorId: string) {
  if (typeof window === 'undefined') return
  try {
    const pending: PendingRecordJump = {
      targetAnchorId,
      originHref: window.location.href,
      createdAt: Date.now(),
    }
    window.sessionStorage.setItem(JUMP_KEY, JSON.stringify(pending))
  } catch {
    // The hash link remains usable when storage is unavailable.
  }
}

export function consumeRecordJump(maxAge = 10 * 60 * 1000) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(JUMP_KEY)
    window.sessionStorage.removeItem(JUMP_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as PendingRecordJump
    if (!pending.targetAnchorId || !pending.originHref || Date.now() - pending.createdAt > maxAge)
      return null
    return pending
  } catch {
    return null
  }
}
