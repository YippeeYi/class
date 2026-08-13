import { type FocusEvent, useCallback, useState } from 'react'

/**
 * Keeps the last highlighted item while a pointer crosses spacing inside an
 * interaction region. Pointer and keyboard focus are tracked independently so
 * leaving with the pointer never erases a still-focused keyboard item.
 */
export function usePersistentHighlight() {
  const [pointerId, setPointerId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [lastInteraction, setLastInteraction] = useState<'pointer' | 'focus'>('pointer')

  const activatePointer = useCallback((id: string) => {
    setPointerId(id)
    setLastInteraction('pointer')
  }, [])
  const clearPointer = useCallback(() => {
    setPointerId(null)
    setLastInteraction((current) => (current === 'pointer' ? 'focus' : current))
  }, [])
  const activateFocus = useCallback((id: string) => {
    setFocusId(id)
    setLastInteraction('focus')
  }, [])
  const clearFocusWhenLeaving = useCallback((event: FocusEvent<Element>) => {
    const nextTarget = event.relatedTarget
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setFocusId(null)
      setLastInteraction((current) => (current === 'focus' ? 'pointer' : current))
    }
  }, [])
  return {
    activeId: lastInteraction === 'focus' ? (focusId ?? pointerId) : (pointerId ?? focusId),
    activatePointer,
    clearPointer,
    activateFocus,
    clearFocusWhenLeaving,
  }
}
