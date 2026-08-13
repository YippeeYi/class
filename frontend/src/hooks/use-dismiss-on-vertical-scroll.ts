import { type RefObject, useEffect, useRef } from 'react'

function scrollTopOf(target: EventTarget) {
  if (target === window || target === document || target === document.scrollingElement) {
    return window.scrollY
  }
  return target instanceof Element ? target.scrollTop : null
}

/**
 * Dismisses an anchored surface as soon as an ancestor begins moving on the
 * vertical axis. Capturing `scroll` covers wheel, trackpad, scrollbar drag and
 * programmatic scrolling without a high-frequency wheel/pointer listener.
 */
export function useDismissOnVerticalScroll(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return

    const positions = new Map<EventTarget, number>()
    positions.set(window, window.scrollY)
    positions.set(document, window.scrollY)
    if (document.scrollingElement) positions.set(document.scrollingElement, window.scrollY)

    let ancestor = anchorRef.current?.parentElement || null
    while (ancestor) {
      if (ancestor.scrollHeight > ancestor.clientHeight) positions.set(ancestor, ancestor.scrollTop)
      ancestor = ancestor.parentElement
    }

    let dismissed = false
    const handleScroll = (event: Event) => {
      if (dismissed) return
      const target = event.target || document
      const previous = positions.get(target)
      const current = scrollTopOf(target)
      if (previous === undefined || current === null) return
      positions.set(target, current)
      if (Math.abs(current - previous) < 0.5) return
      dismissed = true
      onDismissRef.current()
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [anchorRef, open])
}
