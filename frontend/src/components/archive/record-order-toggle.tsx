import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'

import { FilterToggle } from '@/components/archive/filter-toggle'
import { SegmentedTabsList } from '@/components/archive/segmented-tabs'
import { ButtonGroup } from '@/components/ui/button-group'
import { Tabs } from '@/components/ui/tabs'

export type RecordOrder = 'ascending' | 'descending'

const recordOrderItems = [
  { value: 'ascending', label: '正序', icon: ArrowUpNarrowWide },
  { value: 'descending', label: '逆序', icon: ArrowDownNarrowWide },
] as const

export function RecordOrderToggle({
  value,
  onValueChange,
  ariaLabel = '记录显示顺序',
}: {
  value: RecordOrder
  onValueChange: (value: RecordOrder) => void
  ariaLabel?: string
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as RecordOrder)}>
      <SegmentedTabsList value={value} items={recordOrderItems} ariaLabel={ariaLabel} />
    </Tabs>
  )
}

export function RecordOrderButtons({
  value,
  onValueChange,
  ariaLabel = '记录显示顺序',
}: {
  value: RecordOrder
  onValueChange: (value: RecordOrder) => void
  ariaLabel?: string
}) {
  return (
    <ButtonGroup aria-label={ariaLabel}>
      {recordOrderItems.map(({ value: itemValue, label, icon: Icon }) => (
        <FilterToggle
          key={itemValue}
          pressed={value === itemValue}
          onPressedChange={(pressed) => {
            if (pressed) onValueChange(itemValue)
          }}
        >
          <Icon />
          {label}
        </FilterToggle>
      ))}
    </ButtonGroup>
  )
}
