const TARGET_FREE_SPACE_RATIO = 0.32
const DEFAULT_EDGE_GAP = 16
const DEFAULT_BOTTOM_INSET = 24

export type DocumentScrollMetrics = {
  documentHeight: number
  viewportHeight: number
}

export type TargetScrollMetrics = DocumentScrollMetrics & {
  scrollY: number
  targetTop: number
  targetHeight: number
  topInset: number
  bottomInset?: number
}

export function clampScrollTop(top: number, metrics: DocumentScrollMetrics) {
  const maximum = Math.max(0, metrics.documentHeight - metrics.viewportHeight)
  return Math.min(maximum, Math.max(0, Number.isFinite(top) ? top : 0))
}

export function targetScrollTop(metrics: TargetScrollMetrics) {
  const bottomInset = Math.max(0, metrics.bottomInset ?? DEFAULT_BOTTOM_INSET)
  const topInset = Math.max(0, metrics.topInset)
  const usableHeight = Math.max(0, metrics.viewportHeight - topInset - bottomInset)
  const targetDocumentTop = Math.max(0, metrics.scrollY + metrics.targetTop)

  // Large records should begin below the sticky header. Smaller records sit in
  // the upper third of the remaining viewport, which leaves useful context
  // without asking the browser to force an impossible centre near the end.
  const visualOffset =
    metrics.targetHeight >= usableHeight
      ? topInset
      : topInset +
        Math.max(0, usableHeight - Math.max(0, metrics.targetHeight)) * TARGET_FREE_SPACE_RATIO

  return clampScrollTop(targetDocumentTop - visualOffset, metrics)
}

function viewportHeight() {
  return window.visualViewport?.height || window.innerHeight
}

function documentHeight() {
  return Math.max(
    document.scrollingElement?.scrollHeight || 0,
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  )
}

function stickyTopInset() {
  const topbar = document.querySelector<HTMLElement>('.app-topbar')
  if (!topbar) return DEFAULT_EDGE_GAP
  const position = window.getComputedStyle(topbar).position
  const bounds = topbar.getBoundingClientRect()
  if (
    (position !== 'sticky' && position !== 'fixed') ||
    bounds.bottom <= 0 ||
    bounds.top >= viewportHeight()
  )
    return DEFAULT_EDGE_GAP
  return Math.max(0, bounds.bottom) + DEFAULT_EDGE_GAP
}

export function scrollTargetIntoView(target: HTMLElement, behavior: ScrollBehavior = 'smooth') {
  const bounds = target.getBoundingClientRect()
  const height = viewportHeight()
  const top = targetScrollTop({
    scrollY: window.scrollY,
    viewportHeight: height,
    documentHeight: documentHeight(),
    targetTop: bounds.top,
    targetHeight: bounds.height,
    topInset: stickyTopInset(),
  })
  window.scrollTo({ top, left: 0, behavior })
  return top
}

/**
 * Observe the single browser-owned scroll operation without issuing any
 * corrective movement. Both native `scrollend` and the RAF sampler are gated
 * by the exact precomputed destination, so a late event from a prior scroll
 * cannot open a modal and interrupt the current animation.
 */
export function waitForWindowScrollEnd(expectedTop: number, signal?: AbortSignal) {
  const destination = clampWindowScrollTop(expectedTop)
  const initialTop = window.scrollY
  if (signal?.aborted) return Promise.resolve(false)
  if (Math.abs(initialTop - destination) <= 1) return Promise.resolve(true)

  return new Promise<boolean>((resolve) => {
    let animationFrame = 0
    let lastTop = initialTop
    let stableFrames = 0
    let observedMovement = false
    let nativeEndObserved = false
    let settled = false

    const finish = (reachedDestination: boolean) => {
      if (settled) return
      settled = true
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scrollend', finishIfAtDestination)
      signal?.removeEventListener('abort', abort)
      resolve(reachedDestination)
    }

    const sample = () => {
      animationFrame = 0
      if (settled || signal?.aborted) {
        finish(false)
        return
      }
      const currentTop = window.scrollY
      if (Math.abs(currentTop - initialTop) > 0.5) observedMovement = true
      stableFrames = Math.abs(currentTop - lastTop) <= 0.5 ? stableFrames + 1 : 0
      lastTop = currentTop
      if (Math.abs(currentTop - destination) <= 1) {
        finish(true)
        return
      }
      // A real user wheel/touch interruption may end away from the requested
      // position. Stop observing without a corrective scroll or modal instead
      // of keeping a perpetual animation-frame loop alive.
      if (nativeEndObserved && observedMovement && stableFrames >= 2) {
        finish(false)
        return
      }
      animationFrame = window.requestAnimationFrame(sample)
    }

    const finishIfAtDestination = () => {
      nativeEndObserved = true
      if (Math.abs(window.scrollY - destination) <= 1) finish(true)
    }
    const abort = () => finish(false)

    window.addEventListener('scrollend', finishIfAtDestination, { passive: true })
    signal?.addEventListener('abort', abort, { once: true })
    animationFrame = window.requestAnimationFrame(sample)
  })
}

export function clampWindowScrollTop(top: number) {
  return clampScrollTop(top, {
    viewportHeight: viewportHeight(),
    documentHeight: documentHeight(),
  })
}
