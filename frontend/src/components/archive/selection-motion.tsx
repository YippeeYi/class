import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

type SelectionAxis = 'horizontal' | 'vertical'

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

function movementTransform(axis: SelectionAxis, pixels: number) {
  return axis === 'horizontal' ? `translate3d(${pixels}px, 0, 0)` : `translate3d(0, ${pixels}px, 0)`
}

function liquidShapeFrames(axis: SelectionAxis, direction: number, distance: number) {
  const stretch = Math.min(1.34, 1.14 + Math.max(0, distance - 1) * 0.035)
  const offset = direction * Math.min(5, 2.5 + distance * 0.55)
  const leadingRadius = direction > 0 ? '38% 62% 58% 42%' : '62% 38% 42% 58%'

  if (axis === 'vertical') {
    return [
      { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', borderRadius: 'inherit' },
      {
        offset: 0.3,
        transform: `translate3d(0, ${offset}px, 0) scale3d(0.965, ${stretch}, 1)`,
        borderRadius: `${leadingRadius} / 44% 44% 56% 56%`,
      },
      {
        offset: 0.7,
        transform: `translate3d(0, ${-offset * 0.22}px, 0) scale3d(1.015, 0.975, 1)`,
        borderRadius: '48% 52% 54% 46% / 52% 48% 52% 48%',
      },
      { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', borderRadius: 'inherit' },
    ]
  }

  return [
    { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', borderRadius: 'inherit' },
    {
      offset: 0.3,
      transform: `translate3d(${offset}px, 0, 0) scale3d(${stretch}, 0.955, 1)`,
      borderRadius: `${leadingRadius} / 46% 54% 46% 54%`,
    },
    {
      offset: 0.7,
      transform: `translate3d(${-offset * 0.22}px, 0, 0) scale3d(0.98, 1.018, 1)`,
      borderRadius: '52% 48% 46% 54% / 48% 52% 48% 52%',
    },
    { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', borderRadius: 'inherit' },
  ]
}

/**
 * Moves a single, stable selected surface without mirroring business state in
 * React. The Web Animations API reads the current composited transform before
 * interruption, so rapid changes continue from the visible position instead
 * of restarting or remounting decorative nodes.
 */
export function useSelectionMotion<T extends HTMLElement>(
  activeIndex: number,
  itemCount: number,
  axis: SelectionAxis = 'horizontal',
): SelectionMotion<T> {
  const ref = useRef<T>(null)
  const previousIndex = useRef<number | null>(null)
  const animations = useRef<Animation[]>([])
  const settleTimer = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = ref.current
    if (!container) return

    const safeCount = Math.max(1, itemCount)
    const safeIndex = Math.max(0, Math.min(activeIndex, safeCount - 1))
    const fromIndex = previousIndex.current ?? safeIndex
    const indicator = container.querySelector<HTMLElement>(':scope > .app-selection-indicator')
    const refraction = indicator?.querySelector<HTMLElement>('.app-selection-refraction')
    const lens = indicator?.querySelector<HTMLElement>('.app-selection-lens')
    const bridge = container.querySelector<HTMLElement>(':scope > .app-selection-bridge')
    const currentTransform = indicator ? getComputedStyle(indicator).transform : 'none'

    for (const animation of animations.current) animation.cancel()
    animations.current = []
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)

    const distance = Math.abs(safeIndex - fromIndex)
    const direction = safeIndex === fromIndex ? 0 : safeIndex > fromIndex ? 1 : -1
    container.style.setProperty('--selection-count', String(safeCount))
    container.style.setProperty('--selection-distance', String(distance))
    container.style.setProperty('--selection-from', String(fromIndex))
    container.style.setProperty('--selection-min', String(Math.min(fromIndex, safeIndex)))
    container.style.setProperty('--selection-to', String(safeIndex))
    container.dataset.selectionDirection =
      direction > 0 ? 'forward' : direction < 0 ? 'backward' : 'none'
    previousIndex.current = safeIndex

    if (!indicator || !direction || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      delete container.dataset.selectionSwitching
      return
    }

    const styles = getComputedStyle(container)
    const liquid = document.documentElement.dataset.boxStyle === 'glass'
    const duration = durationInMilliseconds(
      styles.getPropertyValue(
        liquid ? '--interaction-duration-liquid' : '--interaction-duration-slow',
      ),
      liquid ? 360 : 200,
    )
    const easing =
      styles
        .getPropertyValue(liquid ? '--interaction-ease-liquid' : '--interaction-ease-standard')
        .trim() || (liquid ? 'cubic-bezier(0.22, 0.72, 0.18, 1)' : 'cubic-bezier(0.2, 0, 0, 1)')
    const indicatorBounds = indicator.getBoundingClientRect()
    const step = axis === 'horizontal' ? indicatorBounds.width : indicatorBounds.height
    const targetTransform = movementTransform(axis, safeIndex * step)
    container.dataset.selectionMaterial = liquid ? 'liquid' : 'standard'
    container.dataset.selectionSwitching = 'true'

    const moving = indicator.animate(
      [
        {
          transform:
            currentTransform === 'none'
              ? movementTransform(axis, fromIndex * step)
              : currentTransform,
        },
        { transform: targetTransform },
      ],
      { duration, easing, fill: 'none' },
    )
    moving.id = liquid ? 'app-liquid-selection-move' : 'app-selection-move'
    animations.current.push(moving)

    if (liquid && refraction && lens && bridge) {
      const reshape = refraction.animate(liquidShapeFrames(axis, direction, distance), {
        duration,
        easing,
        fill: 'none',
      })
      reshape.id = 'app-liquid-selection-reshape'
      const merge = bridge.animate(
        [
          { opacity: 0, clipPath: 'inset(42% 48% 42% 48% round 999px)' },
          { offset: 0.34, opacity: 0.42, clipPath: 'inset(12% 5% 12% 5% round 999px)' },
          { offset: 0.7, opacity: 0.16, clipPath: 'inset(24% 2% 24% 2% round 999px)' },
          { opacity: 0, clipPath: 'inset(46% 48% 46% 48% round 999px)' },
        ],
        { duration, easing, fill: 'none' },
      )
      merge.id = 'app-liquid-selection-bridge'
      const highlight = lens.animate(
        [
          {
            transform: `translate3d(${direction * -18}%, 0, 0) skewX(${direction * -4}deg)`,
            opacity: 0.24,
          },
          {
            offset: 0.52,
            transform: `translate3d(${direction * 14}%, 0, 0) skewX(${direction * 3}deg)`,
            opacity: 0.86,
          },
          { transform: 'translate3d(0, 0, 0) skewX(0deg)', opacity: 0.46 },
        ],
        { duration, easing, fill: 'none' },
      )
      highlight.id = 'app-liquid-selection-lens'
      animations.current.push(reshape, merge, highlight)
    }

    settleTimer.current = window.setTimeout(() => {
      delete container.dataset.selectionSwitching
      animations.current = []
      settleTimer.current = null
    }, duration + 34)
  }, [activeIndex, axis, itemCount])

  useEffect(
    () => () => {
      for (const animation of animations.current) animation.cancel()
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    },
    [],
  )

  return { ref }
}

export function SelectionMotionLayers({ listItems = false }: { listItems?: boolean }) {
  const indicatorContents = (
    <>
      <span className="app-selection-refraction" />
      <span className="app-selection-lens" />
    </>
  )

  if (listItems) {
    return (
      <>
        <li aria-hidden="true" className="app-selection-indicator">
          {indicatorContents}
        </li>
        <li aria-hidden="true" className="app-selection-bridge" />
      </>
    )
  }

  return (
    <>
      <span aria-hidden="true" className="app-selection-indicator">
        {indicatorContents}
      </span>
      <span aria-hidden="true" className="app-selection-bridge" />
    </>
  )
}
