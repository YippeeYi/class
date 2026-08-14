import type { ComponentProps } from 'react'

import { Toggle } from '@/components/ui/toggle'

type FilterToggleProps = Omit<ComponentProps<typeof Toggle>, 'variant'>

/**
 * Shared multi-select filter control. Persistent filters use the shadcn Toggle
 * state contract and one outline geometry across records, search, and quiz.
 */
export function FilterToggle({ size = 'default', ...props }: FilterToggleProps) {
  return <Toggle {...props} variant="outline" size={size} />
}
