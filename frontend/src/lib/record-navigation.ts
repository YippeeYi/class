const JUMP_KEY = 'classrecord:pending-record-jump'

export type PendingRecordJump = {
  targetAnchorId: string
  originHref: string
  createdAt: number
  origin?: {
    view: 'list' | 'written'
    pageIndex: number
    criteria: {
      year: string
      month: string
      day: string
      important: boolean
      excludeDaily: boolean
      query: string
    }
    anchorId: string
    scrollY: number
  }
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

function pendingRecordJump() {
  try {
    const raw = window.sessionStorage.getItem(JUMP_KEY)
    return raw ? (JSON.parse(raw) as PendingRecordJump) : null
  } catch {
    return null
  }
}

function recordHashTarget() {
  const leaf = window.location.pathname.split('/').filter(Boolean).at(-1)
  if (leaf !== 'records' || !window.location.hash) return ''
  try {
    const target = decodeURIComponent(window.location.hash.slice(1))
    return target.startsWith('record-') ? target : ''
  } catch {
    return ''
  }
}

function captureRecordHash() {
  const targetAnchorId = recordHashTarget()
  if (!targetAnchorId) return

  const existing = pendingRecordJump()
  if (existing?.targetAnchorId !== targetAnchorId) {
    try {
      const pending: PendingRecordJump = {
        targetAnchorId,
        originHref: '',
        createdAt: Date.now(),
      }
      window.sessionStorage.setItem(JUMP_KEY, JSON.stringify(pending))
    } catch {
      // In-memory hash removal still prevents the browser from racing the app.
    }
  }

  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(window.history.state, '', url)
}

/**
 * Capture record fragments before BrowserRouter mounts. A real fragment makes
 * the browser perform its own anchor scroll as soon as the async target enters
 * the DOM; the records page owns that positioning so it can measure and clamp
 * exactly once instead.
 */
export function installRecordJumpGuard() {
  if (typeof window === 'undefined') return
  captureRecordHash()
  window.addEventListener('popstate', captureRecordHash, { capture: true })
}

export function recordClientHref(href: string) {
  const hashIndex = href.indexOf('#')
  return hashIndex >= 0 ? href.slice(0, hashIndex) : href
}

export function isModifiedRecordClick(event: {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
}

export function replaceRecordJumpHash(targetAnchorId: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.hash = targetAnchorId
  window.history.replaceState(window.history.state, '', url)
}

export function consumeRecordJump(maxAge = 10 * 60 * 1000) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(JUMP_KEY)
    window.sessionStorage.removeItem(JUMP_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as PendingRecordJump
    if (
      !pending.targetAnchorId ||
      typeof pending.originHref !== 'string' ||
      !Number.isFinite(pending.createdAt) ||
      Date.now() - pending.createdAt > maxAge
    )
      return null
    return pending
  } catch {
    return null
  }
}
