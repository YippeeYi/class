import type { RecordItem } from '@/types/domain'

export type SortDirection = 'ascending' | 'descending'

export function orderRecords(
  records: readonly RecordItem[],
  direction: SortDirection,
  compare: (left: RecordItem, right: RecordItem) => number,
) {
  const multiplier = direction === 'descending' ? -1 : 1
  return [...records].sort((left, right) => compare(left, right) * multiplier)
}
