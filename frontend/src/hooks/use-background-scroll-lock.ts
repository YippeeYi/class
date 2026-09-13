import { useLayoutEffect } from 'react'

type LockedElement = {
  element: HTMLElement
  scrollLeft: number
  scrollTop: number
  overflow: string
  overflowAnchor: string
  overscrollBehavior: string
  touchAction: string
}

type LockedDocument = {
  scrollX: number
  scrollY: number
  htmlOverflow: string
  htmlOverflowAnchor: string
  htmlOverscrollBehavior: string
  htmlTouchAction: string
  bodyOverflow: string
  bodyOverflowAnchor: string
  bodyOverscrollBehavior: string
  bodyTouchAction: string
}

let lockCount = 0
let lockedElements: LockedElement[] = []
let lockedDocument: LockedDocument | null = null

function isScrollable(element: HTMLElement) {
  const style = getComputedStyle(element)
  return (
    /(auto|scroll)/u.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`) &&
    (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)
  )
}

function viewerEvent(event: Event) {
  return (
    event.target instanceof Element && Boolean(event.target.closest('[data-image-viewer-dialog]'))
  )
}

function stopBackgroundGesture(event: Event) {
  const insideViewport =
    event.target instanceof Element && Boolean(event.target.closest('.image-viewer-viewport'))
  if (!insideViewport) event.preventDefault()
}

function stopBackgroundKey(event: KeyboardEvent) {
  if (viewerEvent(event)) return
  if (
    [
      ' ',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'PageUp',
      'PageDown',
      'Home',
      'End',
    ].includes(event.key)
  ) {
    event.preventDefault()
  }
}

function lockBackgroundScrolling() {
  lockCount += 1
  if (lockCount > 1) return
  const html = document.documentElement
  const body = document.body
  lockedDocument = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    htmlOverflow: html.style.overflow,
    htmlOverflowAnchor: html.style.overflowAnchor,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
    htmlTouchAction: html.style.touchAction,
    bodyOverflow: body.style.overflow,
    bodyOverflowAnchor: body.style.overflowAnchor,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    bodyTouchAction: body.style.touchAction,
  }
  // Async content can replace a skeleton behind the viewer. Overflow alone
  // blocks gestures, but does not prevent the browser from moving its scroll
  // anchor when that content changes height.
  html.style.overflowAnchor = 'none'
  body.style.overflowAnchor = 'none'
  html.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'
  html.style.touchAction = 'none'
  body.style.overflow = 'hidden'
  body.style.overscrollBehavior = 'none'
  body.style.touchAction = 'none'
  const elements = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
    (element) => !element.closest('[data-image-viewer-dialog]') && isScrollable(element),
  )
  lockedElements = elements.map((element) => ({
    element,
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    overflow: element.style.overflow,
    overflowAnchor: element.style.overflowAnchor,
    overscrollBehavior: element.style.overscrollBehavior,
    touchAction: element.style.touchAction,
  }))
  for (const item of lockedElements) {
    item.element.style.overflowAnchor = 'none'
    item.element.style.overflow = 'hidden'
    item.element.style.overscrollBehavior = 'none'
    item.element.style.touchAction = 'none'
  }
  document.addEventListener('wheel', stopBackgroundGesture, { capture: true, passive: false })
  document.addEventListener('touchmove', stopBackgroundGesture, { capture: true, passive: false })
  document.addEventListener('keydown', stopBackgroundKey, true)
}

function unlockBackgroundScrolling() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount) return
  document.removeEventListener('wheel', stopBackgroundGesture, true)
  document.removeEventListener('touchmove', stopBackgroundGesture, true)
  document.removeEventListener('keydown', stopBackgroundKey, true)
  for (const item of lockedElements) {
    item.element.style.overflow = item.overflow
    item.element.style.overflowAnchor = item.overflowAnchor
    item.element.style.overscrollBehavior = item.overscrollBehavior
    item.element.style.touchAction = item.touchAction
    item.element.scrollTo({ left: item.scrollLeft, top: item.scrollTop, behavior: 'auto' })
  }
  lockedElements = []
  if (lockedDocument) {
    const html = document.documentElement
    const body = document.body
    const snapshot = lockedDocument
    html.style.overflow = snapshot.htmlOverflow
    html.style.overflowAnchor = snapshot.htmlOverflowAnchor
    html.style.overscrollBehavior = snapshot.htmlOverscrollBehavior
    html.style.touchAction = snapshot.htmlTouchAction
    body.style.overflow = snapshot.bodyOverflow
    body.style.overflowAnchor = snapshot.bodyOverflowAnchor
    body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior
    body.style.touchAction = snapshot.bodyTouchAction
    window.scrollTo({ left: snapshot.scrollX, top: snapshot.scrollY, behavior: 'auto' })
    lockedDocument = null
  }
}

export function useBackgroundScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return
    lockBackgroundScrolling()
    return unlockBackgroundScrolling
  }, [active])
}
