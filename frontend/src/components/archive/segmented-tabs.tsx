import type { LucideIcon } from 'lucide-react'
import { SelectionMotionLayer, useSelectionMotion } from '@/components/archive/selection-motion'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type SegmentedTabItem<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: LucideIcon
}

type SegmentedTabsListProps<T extends string> = {
  value: T
  items: readonly SegmentedTabItem<T>[]
  ariaLabel: string
  className?: string
  triggerClassName?: string
}

/**
 * Project motion treatment composed directly from the shadcn Tabs primitives.
 * The parent Tabs root remains the only owner of selection and keyboard state.
 */
export function SegmentedTabsList<T extends string>({
  value,
  items,
  ariaLabel,
  className,
  triggerClassName,
}: SegmentedTabsListProps<T>) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  )
  const motion = useSelectionMotion<HTMLDivElement>(activeIndex, items.length)

  return (
    <TabsList
      ref={motion.ref}
      aria-label={ariaLabel}
      data-segmented-control="true"
      className={cn('app-segmented-control', className)}
    >
      <SelectionMotionLayer />
      {items.map((item) => {
        const Icon = item.icon
        return (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className={cn('app-segmented-trigger', triggerClassName)}
          >
            {Icon && <Icon className="size-4 shrink-0" />}
            <span>{item.label}</span>
            {item.description && <span className="sr-only">{item.description}</span>}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
