import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
}

export type SelectionMotion<T extends HTMLElement> = {
  ref: RefObject<T | null>
}

function durationInMilliseconds(value: string, fallback: number) {
  const normalized = value.trim()
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return fallback
  if (normalized.endsWith('ms')) return parsed
  if (normalized.endsWith('s')) return parsed * 1000
  return fallback
}

function selectionRect(container: HTMLElement, target: HTMLElement): SelectionRect {
  return {
    x: target.offsetLeft + container.scrollLeft,
    y: target.offsetTop + container.scrollTop,
    width: target.offsetWidth,
    height: target.offsetHeight,
  }
}

function visibleSelectionRect(container: HTMLElement, indicator: HTMLElement): SelectionRect {
  const containerBounds = container.getBoundingClientRect()
  const indicatorBounds = indicator.getBoundingClientRect()
  return {
    x: indicatorBounds.left - containerBounds.left - container.clientLeft + container.scrollLeft,
    y: indicatorBounds.top - containerBounds.top - container.clientTop + container.scrollTop,
    width: indicatorBounds.width,
    height: indicatorBounds.height,
  }
}

function movementTransform(rect: SelectionRect, scaleX = 1, scaleY = 1) {
  return `translate3d(${rect.x}px, ${rect.y}px, 0) scale3d(${scaleX}, ${scaleY}, 1)`
}

function setRestingGeometry(container: HTMLElement, rect: SelectionRect) {
  container.style.setProperty('--selection-x', `${rect.x}px`)
  container.style.setProperty('--selection-y', `${rect.y}px`)
  container.style.setProperty('--selection-width', `${rect.width}px`)
  container.style.setProperty('--selection-height', `${rect.height}px`)
}

/**
 * Restores the project's original shared selection surface for compact mode
 * switches. It measures the real shadcn TabsTrigger bounds and keeps visual
 * progress outside React, so rapid changes continue from the visible position.
 */
export function useSelectionMotion<T extends HTMLElement>(
  activeIndex: number,
  itemCount: number,
): SelectionMotion<T> {
  const ref = useRef<T>(null)
  const previousIndex = useRef<number | null>(null)
  const animation = useRef<Animation | null>(null)
  const settleTimer = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = ref.current
    if (!container) return
    const targets = Array.from(
      container.querySelectorAll<HTMLElement>(':scope > [data-slot="tabs-trigger"]'),
    )
    const safeCount = Math.max(1, Math.min(itemCount, targets.length || itemCount))
    const safeIndex = Math.max(0, Math.min(activeIndex, safeCount - 1))
    const target = targets[safeIndex]
    const indicator = container.querySelector<HTMLElement>(':scope > .app-selection-indicator')
    if (!target || !indicator) return

    const targetRect = selectionRect(container, target)
    const fromIndex = previousIndex.current ?? safeIndex
    const previousRect =
      previousIndex.current === null ? targetRect : visibleSelectionRect(container, indicator)
    const currentTransform = getComputedStyle(indicator).transform

    animation.current?.cancel()
    animation.current = null
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)

    container.style.setProperty('--selection-count', String(safeCount))
    setRestingGeometry(container, targetRect)
    previousIndex.current = safeIndex

    if (fromIndex === safeIndex || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      delete container.dataset.selectionSwitching
      return
    }

    const styles = getComputedStyle(container)
    const duration = durationInMilliseconds(
      styles.getPropertyValue('--interaction-duration-slow'),
      200,
    )
    const easing =
      styles.getPropertyValue('--interaction-ease-standard').trim() || 'cubic-bezier(0.2, 0, 0, 1)'
    const fromScaleX = previousRect.width / Math.max(1, targetRect.width)
    const fromScaleY = previousRect.height / Math.max(1, targetRect.height)
    const stableSize =
      Math.abs(previousRect.width - targetRect.width) < 0.5 &&
      Math.abs(previousRect.height - targetRect.height) < 0.5
    const fromTransform =
      currentTransform !== 'none' && stableSize
        ? currentTransform
        : movementTransform(previousRect, fromScaleX, fromScaleY)

    container.dataset.selectionSwitching = 'true'
    const moving = indicator.animate(
      [{ transform: fromTransform }, { transform: movementTransform(targetRect) }],
      { duration, easing, fill: 'none' },
    )
    moving.id = 'app-selection-move'
    animation.current = moving
    settleTimer.current = window.setTimeout(() => {
      delete container.dataset.selectionSwitching
      animation.current = null
      settleTimer.current = null
    }, duration + 34)
  }, [activeIndex, itemCount])

  useLayoutEffect(() => {
    const container = ref.current
    if (!container || typeof ResizeObserver === 'undefined') return
    let resizeFrame = 0
    const updateGeometry = () => {
      if (container.dataset.selectionSwitching) return
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        const targets = Array.from(
          container.querySelectorAll<HTMLElement>(':scope > [data-slot="tabs-trigger"]'),
        )
        const target = targets[Math.max(0, Math.min(activeIndex, targets.length - 1))]
        if (target) setRestingGeometry(container, selectionRect(container, target))
      })
    }
    const resizeObserver = new ResizeObserver(updateGeometry)
    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      window.cancelAnimationFrame(resizeFrame)
    }
  }, [activeIndex])

  useEffect(
    () => () => {
      animation.current?.cancel()
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    },
    [],
  )

  return { ref }
}

export function SelectionMotionLayer() {
  return <span aria-hidden="true" className="app-selection-indicator" />
}
