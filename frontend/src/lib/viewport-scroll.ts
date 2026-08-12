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

export function clampWindowScrollTop(top: number) {
  return clampScrollTop(top, {
    viewportHeight: viewportHeight(),
    documentHeight: documentHeight(),
  })
}
