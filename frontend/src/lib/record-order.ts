import type { RecordItem } from '@/types/domain'

export type SortDirection = 'ascending' | 'descending'

export function compareRecordNumber(left: RecordItem, right: RecordItem) {
  const indexDifference = Number(left.recordIndex || 0) - Number(right.recordIndex || 0)
  if (indexDifference) return indexDifference
  return String(left.id || left.fileName).localeCompare(
    String(right.id || right.fileName),
    'zh-CN',
    {
      numeric: true,
    },
  )
}

export function compareRecordId(left: RecordItem, right: RecordItem) {
  return left.id.localeCompare(right.id)
}

export function orderRecords(
  records: readonly RecordItem[],
  direction: SortDirection,
  compare: (left: RecordItem, right: RecordItem) => number = compareRecordNumber,
) {
  const multiplier = direction === 'descending' ? -1 : 1
  return [...records].sort((left, right) => compare(left, right) * multiplier)
}
