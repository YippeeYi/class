import { useCallback, useEffect, useRef } from 'react'

const JUMP_HIGHLIGHT_HOLD_MS = 520
const JUMP_HIGHLIGHT_FADE_MS = 680

function clearHighlightState(target: HTMLElement) {
  delete target.dataset.recordJumpHighlight
  delete target.dataset.recordJumpFading
  delete target.dataset.recordJumpPendingFade
}

export function useRecordJumpHighlight() {
  const focusTarget = useRef<HTMLElement | null>(null)
  const highlightTarget = useRef<HTMLElement | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const clearTimer = useCallback(() => {
    if (timer.current === undefined) return
    window.clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const clearHighlight = useCallback(
    (target?: HTMLElement | null) => {
      const current = target || highlightTarget.current
      if (!current) return
      clearTimer()
      clearHighlightState(current)
      if (highlightTarget.current === current) highlightTarget.current = null
    },
    [clearTimer],
  )

  const beginHighlight = useCallback(
    (target: HTMLElement) => {
      clearTimer()
      const previous = highlightTarget.current
      if (previous && previous !== target) clearHighlightState(previous)
      delete target.dataset.recordJumpFading
      delete target.dataset.recordJumpPendingFade
      target.dataset.recordJumpHighlight = 'true'
      highlightTarget.current = target
    },
    [clearTimer],
  )

  const fadeHighlight = useCallback(
    (target?: HTMLElement | null) => {
      const current = target || highlightTarget.current
      if (current?.dataset.recordJumpHighlight !== 'true') return
      clearTimer()
      delete current.dataset.recordJumpFading
      current.dataset.recordJumpPendingFade = 'true'
      timer.current = window.setTimeout(() => {
        if (highlightTarget.current !== current || current.dataset.recordJumpHighlight !== 'true') {
          delete current.dataset.recordJumpPendingFade
          timer.current = undefined
          return
        }
        delete current.dataset.recordJumpPendingFade
        current.dataset.recordJumpFading = 'true'
        timer.current = window.setTimeout(() => {
          clearHighlightState(current)
          if (highlightTarget.current === current) highlightTarget.current = null
          timer.current = undefined
        }, JUMP_HIGHLIGHT_FADE_MS)
      }, JUMP_HIGHLIGHT_HOLD_MS)
    },
    [clearTimer],
  )

  useEffect(
    () => () => {
      clearTimer()
      if (highlightTarget.current) clearHighlightState(highlightTarget.current)
    },
    [clearTimer],
  )

  return { focusTarget, clearHighlight, beginHighlight, fadeHighlight }
}
