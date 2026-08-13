import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

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

type SegmentedStyle = CSSProperties & {
  '--segment-count': number
  '--segment-index': number
}

/**
 * Project-owned segmented-control treatment built from the read-only shadcn
 * Tabs primitives. The selected surface is one shared layer that moves between
 * options, so changing mode reads as a transfer instead of two unrelated color
 * flashes. State still updates immediately through the parent Tabs root.
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
  const style: SegmentedStyle = {
    '--segment-count': Math.max(1, items.length),
    '--segment-index': activeIndex,
  }

  return (
    <TabsList
      aria-label={ariaLabel}
      data-segmented-control="true"
      className={cn('app-segmented-control', className)}
      style={style}
    >
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
