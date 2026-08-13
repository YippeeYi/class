import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

type SelectionAxis = 'horizontal' | 'vertical' | 'auto'
type ResolvedSelectionAxis = Exclude<SelectionAxis, 'auto'>

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
  const containerBounds = container.getBoundingClientRect()
  const targetBounds = target.getBoundingClientRect()
  return {
    x: targetBounds.left - containerBounds.left - container.clientLeft + container.scrollLeft,
    y: targetBounds.top - containerBounds.top - container.clientTop + container.scrollTop,
    width: targetBounds.width,
    height: targetBounds.height,
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

function resolvedAxis(
  requestedAxis: SelectionAxis,
  from: SelectionRect,
  to: SelectionRect,
): ResolvedSelectionAxis {
  if (requestedAxis !== 'auto') return requestedAxis
  const deltaX = Math.abs(to.x + to.width / 2 - (from.x + from.width / 2))
  const deltaY = Math.abs(to.y + to.height / 2 - (from.y + from.height / 2))
  return deltaY > deltaX ? 'vertical' : 'horizontal'
}

function directionForAxis(axis: ResolvedSelectionAxis, from: SelectionRect, to: SelectionRect) {
  const fromPosition = axis === 'horizontal' ? from.x + from.width / 2 : from.y + from.height / 2
  const toPosition = axis === 'horizontal' ? to.x + to.width / 2 : to.y + to.height / 2
  return toPosition === fromPosition ? 0 : toPosition > fromPosition ? 1 : -1
}

function liquidShapeFrames(
  axis: ResolvedSelectionAxis,
  direction: number,
  normalizedDistance: number,
) {
  const stretch = Math.min(1.24, 1.105 + normalizedDistance * 0.026)
  const drift = direction * Math.min(4.5, 2 + normalizedDistance * 0.42)

  if (axis === 'vertical') {
    return [
      { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', opacity: 1 },
      {
        offset: 0.28,
        transform: `translate3d(0, ${drift}px, 0) scale3d(0.965, ${stretch}, 1)`,
        opacity: 0.96,
      },
      {
        offset: 0.72,
        transform: `translate3d(0, ${-drift * 0.2}px, 0) scale3d(1.012, 0.978, 1)`,
        opacity: 1,
      },
      { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', opacity: 1 },
    ]
  }

  return [
    { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', opacity: 1 },
    {
      offset: 0.28,
      transform: `translate3d(${drift}px, 0, 0) scale3d(${stretch}, 0.96, 1)`,
      opacity: 0.96,
    },
    {
      offset: 0.72,
      transform: `translate3d(${-drift * 0.2}px, 0, 0) scale3d(0.98, 1.012, 1)`,
      opacity: 1,
    },
    { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)', opacity: 1 },
  ]
}

function bridgeFrames(axis: ResolvedSelectionAxis, rect: SelectionRect, direction: number) {
  const translate = `translate3d(${rect.x}px, ${rect.y}px, 0)`
  const originScale = axis === 'horizontal' ? 'scale3d(0.16, 0.58, 1)' : 'scale3d(0.58, 0.16, 1)'
  const connectedScale = axis === 'horizontal' ? 'scale3d(1, 0.86, 1)' : 'scale3d(0.86, 1, 1)'
  const releaseScale = axis === 'horizontal' ? 'scale3d(0.74, 0.7, 1)' : 'scale3d(0.7, 0.74, 1)'
  const origin = direction > 0 ? '0% 50%' : '100% 50%'
  const verticalOrigin = direction > 0 ? '50% 0%' : '50% 100%'

  return [
    {
      transform: `${translate} ${originScale}`,
      transformOrigin: axis === 'horizontal' ? origin : verticalOrigin,
      opacity: 0,
    },
    {
      offset: 0.34,
      transform: `${translate} ${connectedScale}`,
      transformOrigin: axis === 'horizontal' ? origin : verticalOrigin,
      opacity: 0.4,
    },
    {
      offset: 0.72,
      transform: `${translate} ${releaseScale}`,
      transformOrigin: axis === 'horizontal' ? origin : verticalOrigin,
      opacity: 0.14,
    },
    {
      transform: `${translate} ${releaseScale}`,
      transformOrigin: axis === 'horizontal' ? origin : verticalOrigin,
      opacity: 0,
    },
  ]
}

function lensFrames(axis: ResolvedSelectionAxis, direction: number) {
  if (axis === 'vertical') {
    return [
      {
        transform: `translate3d(0, ${direction * -18}%, 0) skewY(${direction * -3}deg)`,
        opacity: 0.22,
      },
      {
        offset: 0.52,
        transform: `translate3d(0, ${direction * 15}%, 0) skewY(${direction * 2.5}deg)`,
        opacity: 0.82,
      },
      { transform: 'translate3d(0, 0, 0) skewY(0deg)', opacity: 0.44 },
    ]
  }

  return [
    {
      transform: `translate3d(${direction * -18}%, 0, 0) skewX(${direction * -3}deg)`,
      opacity: 0.22,
    },
    {
      offset: 0.52,
      transform: `translate3d(${direction * 15}%, 0, 0) skewX(${direction * 2.5}deg)`,
      opacity: 0.82,
    },
    { transform: 'translate3d(0, 0, 0) skewX(0deg)', opacity: 0.44 },
  ]
}

function unionRect(from: SelectionRect, to: SelectionRect): SelectionRect {
  const x = Math.min(from.x, to.x)
  const y = Math.min(from.y, to.y)
  return {
    x,
    y,
    width: Math.max(from.x + from.width, to.x + to.width) - x,
    height: Math.max(from.y + from.height, to.y + to.height) - y,
  }
}

function setRestingGeometry(container: HTMLElement, rect: SelectionRect) {
  container.style.setProperty('--selection-x', `${rect.x}px`)
  container.style.setProperty('--selection-y', `${rect.y}px`)
  container.style.setProperty('--selection-width', `${rect.width}px`)
  container.style.setProperty('--selection-height', `${rect.height}px`)
}

/**
 * Moves one stable selection surface between the real bounds of its controls.
 * Measuring actual targets (instead of multiplying an assumed item size) keeps
 * sidebar gaps, responsive wrapping, and spatial option grids exact. Visual
 * progress stays outside React and rapid changes continue from the composited
 * rectangle currently on screen.
 */
export function useSelectionMotion<T extends HTMLElement>(
  activeIndex: number,
  itemCount: number,
  axis: SelectionAxis = 'horizontal',
  targetSelector = ':scope > [data-slot="tabs-trigger"]',
): SelectionMotion<T> {
  const ref = useRef<T>(null)
  const previousIndex = useRef<number | null>(null)
  const animations = useRef<Animation[]>([])
  const settleTimer = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = ref.current
    if (!container) return
    const targets = Array.from(container.querySelectorAll<HTMLElement>(targetSelector))
    const safeCount = Math.max(1, Math.min(itemCount, targets.length || itemCount))
    const safeIndex = Math.max(0, Math.min(activeIndex, safeCount - 1))
    const target = targets[safeIndex]
    const indicator = container.querySelector<HTMLElement>(':scope > .app-selection-indicator')
    const refraction = indicator?.querySelector<HTMLElement>('.app-selection-refraction')
    const lens = indicator?.querySelector<HTMLElement>('.app-selection-lens')
    const bridge = container.querySelector<HTMLElement>(':scope > .app-selection-bridge')
    if (!target || !indicator) return

    const targetRect = selectionRect(container, target)
    const fromIndex = previousIndex.current ?? safeIndex
    const previousTarget = targets[Math.max(0, Math.min(fromIndex, targets.length - 1))]
    const previousRect =
      previousIndex.current === null || !previousTarget
        ? targetRect
        : visibleSelectionRect(container, indicator)
    const currentTransform = getComputedStyle(indicator).transform

    for (const animation of animations.current) animation.cancel()
    animations.current = []
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)

    const motionAxis = resolvedAxis(axis, previousRect, targetRect)
    const direction = directionForAxis(motionAxis, previousRect, targetRect)
    const itemDistance = Math.abs(safeIndex - fromIndex)
    const pixelDistance =
      motionAxis === 'horizontal'
        ? Math.abs(targetRect.x - previousRect.x)
        : Math.abs(targetRect.y - previousRect.y)
    const normalizedDistance =
      pixelDistance /
      Math.max(1, motionAxis === 'horizontal' ? targetRect.width : targetRect.height)
    const bridgeRect = unionRect(previousRect, targetRect)

    container.style.setProperty('--selection-count', String(safeCount))
    container.style.setProperty('--selection-distance', String(itemDistance))
    container.style.setProperty('--selection-from', String(fromIndex))
    container.style.setProperty('--selection-min', String(Math.min(fromIndex, safeIndex)))
    container.style.setProperty('--selection-to', String(safeIndex))
    container.style.setProperty('--selection-bridge-x', `${bridgeRect.x}px`)
    container.style.setProperty('--selection-bridge-y', `${bridgeRect.y}px`)
    container.style.setProperty('--selection-bridge-width', `${bridgeRect.width}px`)
    container.style.setProperty('--selection-bridge-height', `${bridgeRect.height}px`)
    container.dataset.selectionAxis = motionAxis
    container.dataset.selectionDirection =
      direction > 0 ? 'forward' : direction < 0 ? 'backward' : 'none'
    setRestingGeometry(container, targetRect)
    previousIndex.current = safeIndex

    if (
      fromIndex === safeIndex ||
      !direction ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
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
    const fromScaleX = previousRect.width / Math.max(1, targetRect.width)
    const fromScaleY = previousRect.height / Math.max(1, targetRect.height)
    const measuredFromTransform = movementTransform(previousRect, fromScaleX, fromScaleY)
    const targetTransform = movementTransform(targetRect)
    const stableSize =
      Math.abs(previousRect.width - targetRect.width) < 0.5 &&
      Math.abs(previousRect.height - targetRect.height) < 0.5
    const fromTransform =
      currentTransform !== 'none' && stableSize ? currentTransform : measuredFromTransform

    container.dataset.selectionMaterial = liquid ? 'liquid' : 'standard'
    container.dataset.selectionSwitching = 'true'

    const moving = indicator.animate(
      [{ transform: fromTransform }, { transform: targetTransform }],
      { duration, easing, fill: 'none' },
    )
    moving.id = liquid ? 'app-liquid-selection-move' : 'app-selection-move'
    animations.current.push(moving)

    if (liquid && refraction && lens && bridge) {
      const reshape = refraction.animate(
        liquidShapeFrames(motionAxis, direction, normalizedDistance),
        { duration, easing, fill: 'none' },
      )
      reshape.id = 'app-liquid-selection-reshape'
      const merge = bridge.animate(bridgeFrames(motionAxis, bridgeRect, direction), {
        duration,
        easing,
        fill: 'none',
      })
      merge.id = 'app-liquid-selection-bridge'
      const highlight = lens.animate(lensFrames(motionAxis, direction), {
        duration,
        easing,
        fill: 'none',
      })
      highlight.id = 'app-liquid-selection-lens'
      animations.current.push(reshape, merge, highlight)
    }

    settleTimer.current = window.setTimeout(() => {
      delete container.dataset.selectionSwitching
      animations.current = []
      settleTimer.current = null
    }, duration + 34)
  }, [activeIndex, axis, itemCount, targetSelector])

  useLayoutEffect(() => {
    const container = ref.current
    if (!container || typeof ResizeObserver === 'undefined') return
    let resizeFrame = 0
    const updateGeometry = () => {
      if (container.dataset.selectionSwitching) return
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        const targets = Array.from(container.querySelectorAll<HTMLElement>(targetSelector))
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
  }, [activeIndex, targetSelector])

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
