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
 * User-only surfaces additionally require recent wheel, touch, keyboard or
 * scrollbar intent, so delayed layout and scripted scrolls cannot dismiss them.
 */
export function useDismissOnVerticalScroll(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  { userOnly = false }: { userOnly?: boolean } = {},
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
    let lastUserScroll = -Infinity
    let touchY: number | null = null
    const markUserScroll = () => {
      lastUserScroll = performance.now()
    }
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > 0) markUserScroll()
    }
    const handleTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null
    }
    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY
      if (touchY !== null && currentY !== undefined && Math.abs(currentY - touchY) > 2)
        markUserScroll()
      touchY = currentY ?? null
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) &&
        !(event.target instanceof HTMLElement && event.target.isContentEditable) &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      )
        markUserScroll()
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (event.clientX >= document.documentElement.clientWidth - 20) markUserScroll()
    }
    const handleScroll = (event: Event) => {
      if (dismissed) return
      const target = event.target || document
      const previous = positions.get(target)
      const current = scrollTopOf(target)
      if (previous === undefined || current === null) return
      positions.set(target, current)
      if (Math.abs(current - previous) < 0.5) return
      if (userOnly && performance.now() - lastUserScroll > 500) return
      dismissed = true
      onDismissRef.current()
    }

    if (userOnly) {
      window.addEventListener('wheel', handleWheel, { capture: true, passive: true })
      window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true })
      window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true })
      window.addEventListener('keydown', handleKeyDown, true)
      window.addEventListener('pointerdown', handlePointerDown, true)
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      if (userOnly) {
        window.removeEventListener('wheel', handleWheel, true)
        window.removeEventListener('touchstart', handleTouchStart, true)
        window.removeEventListener('touchmove', handleTouchMove, true)
        window.removeEventListener('keydown', handleKeyDown, true)
        window.removeEventListener('pointerdown', handlePointerDown, true)
      }
    }
  }, [anchorRef, open, userOnly])
}
