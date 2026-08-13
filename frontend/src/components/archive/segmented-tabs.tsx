import type { LucideIcon } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export type SegmentedTabItem<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: LucideIcon
}

type SegmentedTabsListProps<T extends string> = {
  items: readonly SegmentedTabItem<T>[]
  ariaLabel: string
  className?: string
}

/** Project-owned composition that keeps shadcn Tabs semantics and styling. */
export function SegmentedTabsList<T extends string>({
  items,
  ariaLabel,
  className,
}: SegmentedTabsListProps<T>) {
  return (
    <TabsList aria-label={ariaLabel} className={className}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <TabsTrigger key={item.value} value={item.value}>
            {Icon && <Icon className="size-4 shrink-0" />}
            <span>{item.label}</span>
            {item.description && <span className="sr-only">{item.description}</span>}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
