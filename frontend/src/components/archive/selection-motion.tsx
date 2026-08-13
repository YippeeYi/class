import { type CSSProperties, useEffect, useLayoutEffect, useState } from 'react'

const SELECTION_SETTLE_MS = 420

export type SelectionMotionStyle = CSSProperties & {
  '--selection-count': number
  '--selection-distance': number
  '--selection-from': number
  '--selection-min': number
  '--selection-to': number
}

export type SelectionMotion = {
  direction: 'backward' | 'forward' | 'none'
  revision: number
  style: SelectionMotionStyle
  switching: boolean
}

/**
 * Keeps the previous committed option available to paint-only selection
 * indicators. Business state still changes immediately; this state only
 * describes the visual path between the previous and current options.
 */
export function useSelectionMotion(activeIndex: number, itemCount: number): SelectionMotion {
  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, itemCount - 1)))
  const [motion, setMotion] = useState({ from: safeIndex, to: safeIndex, revision: 0 })

  useLayoutEffect(() => {
    setMotion((current) =>
      current.to === safeIndex
        ? current
        : { from: current.to, to: safeIndex, revision: current.revision + 1 },
    )
  }, [safeIndex])

  useEffect(() => {
    if (motion.from === motion.to) return
    const revision = motion.revision
    const timeout = window.setTimeout(() => {
      setMotion((current) =>
        current.revision === revision ? { ...current, from: current.to } : current,
      )
    }, SELECTION_SETTLE_MS)
    return () => window.clearTimeout(timeout)
  }, [motion.from, motion.revision, motion.to])

  const direction = motion.to === motion.from ? 0 : motion.to > motion.from ? 1 : -1
  return {
    direction: direction > 0 ? 'forward' : direction < 0 ? 'backward' : 'none',
    revision: motion.revision,
    switching: motion.from !== motion.to,
    style: {
      '--selection-count': Math.max(1, itemCount),
      '--selection-distance': Math.abs(motion.to - motion.from),
      '--selection-from': motion.from,
      '--selection-min': Math.min(motion.from, motion.to),
      '--selection-to': motion.to,
    },
  }
}

export function SelectionMotionLayers({
  motion,
  listItems = false,
}: {
  motion: SelectionMotion
  listItems?: boolean
}) {
  if (listItems) {
    return (
      <>
        <li
          key={`selection-${motion.revision}`}
          aria-hidden="true"
          className="app-selection-indicator"
        >
          <span className="app-selection-lens" />
        </li>
        <li key={`bridge-${motion.revision}`} aria-hidden="true" className="app-selection-bridge" />
      </>
    )
  }

  return (
    <>
      <span
        key={`selection-${motion.revision}`}
        aria-hidden="true"
        className="app-selection-indicator"
      >
        <span className="app-selection-lens" />
      </span>
      <span key={`bridge-${motion.revision}`} aria-hidden="true" className="app-selection-bridge" />
    </>
  )
}
