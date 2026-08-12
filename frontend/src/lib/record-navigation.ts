const JUMP_KEY = 'classrecord:pending-record-jump'
const JUMP_ACTIVITY_WINDOW = 10 * 60 * 1000
let recordJumpActiveUntil = 0
let previousRootOverflowAnchor: string | undefined
let previousBodyOverflowAnchor: string | undefined

function markRecordJumpActive(createdAt = Date.now()) {
  recordJumpActiveUntil = Math.max(recordJumpActiveUntil, createdAt + JUMP_ACTIVITY_WINDOW)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.recordJumpActive = 'true'
    // Apply directly to the real scrolling element before React changes the
    // record view. Waiting for a stylesheet/data-attribute recalc is late
    // enough for Chromium to choose the removed source button as an anchor.
    if (previousRootOverflowAnchor === undefined)
      previousRootOverflowAnchor = document.documentElement.style.overflowAnchor
    document.documentElement.style.overflowAnchor = 'none'
    if (document.body) {
      if (previousBodyOverflowAnchor === undefined)
        previousBodyOverflowAnchor = document.body.style.overflowAnchor
      document.body.style.overflowAnchor = 'none'
    }
  }
}

export function beginRecordJump() {
  markRecordJumpActive()
}

export function isRecordJumpActive() {
  return Date.now() <= recordJumpActiveUntil
}

export function completeRecordJump() {
  recordJumpActiveUntil = 0
  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.recordJumpActive
    if (previousRootOverflowAnchor)
      document.documentElement.style.overflowAnchor = previousRootOverflowAnchor
    else document.documentElement.style.removeProperty('overflow-anchor')
    if (document.body) {
      if (previousBodyOverflowAnchor)
        document.body.style.overflowAnchor = previousBodyOverflowAnchor
      else document.body.style.removeProperty('overflow-anchor')
    }
    previousRootOverflowAnchor = undefined
    previousBodyOverflowAnchor = undefined
  }
}

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

let volatilePendingRecordJump: PendingRecordJump | null = null

export function prepareRecordJump(targetAnchorId: string) {
  if (typeof window === 'undefined') return
  markRecordJumpActive()
  try {
    const pending: PendingRecordJump = {
      targetAnchorId,
      originHref: window.location.href,
      createdAt: Date.now(),
    }
    volatilePendingRecordJump = pending
    window.sessionStorage.setItem(JUMP_KEY, JSON.stringify(pending))
  } catch {
    // The hash link remains usable when storage is unavailable.
  }
}

function pendingRecordJump() {
  try {
    const raw = window.sessionStorage.getItem(JUMP_KEY)
    return raw ? (JSON.parse(raw) as PendingRecordJump) : volatilePendingRecordJump
  } catch {
    return volatilePendingRecordJump
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
  markRecordJumpActive()

  const existing = pendingRecordJump()
  if (existing?.targetAnchorId !== targetAnchorId) {
    try {
      const pending: PendingRecordJump = {
        targetAnchorId,
        originHref: '',
        createdAt: Date.now(),
      }
      volatilePendingRecordJump = pending
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

export function consumeRecordJump(maxAge = JUMP_ACTIVITY_WINDOW) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(JUMP_KEY)
    window.sessionStorage.removeItem(JUMP_KEY)
    const pending = raw ? (JSON.parse(raw) as PendingRecordJump) : volatilePendingRecordJump
    volatilePendingRecordJump = null
    if (!pending) return null
    if (
      !pending.targetAnchorId ||
      typeof pending.originHref !== 'string' ||
      !Number.isFinite(pending.createdAt) ||
      Date.now() - pending.createdAt > maxAge
    )
      return null
    markRecordJumpActive(pending.createdAt)
    return pending
  } catch {
    const pending = volatilePendingRecordJump
    volatilePendingRecordJump = null
    return pending
  }
}
