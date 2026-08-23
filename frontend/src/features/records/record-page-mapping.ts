import { normalizeRecordKey } from '@/lib/archive'
import type { RecordItem, RecordPage } from '@/types/domain'

export function recordWithinPage(page: RecordPage, record: RecordItem, records: RecordItem[]) {
  const ordered = records.map((item) => normalizeRecordKey(item.fileName || item.id))
  const index = ordered.indexOf(normalizeRecordKey(record.fileName || record.id))
  const start = ordered.indexOf(normalizeRecordKey(page.startFile))
  const end = ordered.indexOf(normalizeRecordKey(page.endFile))
  return (
    index >= 0 &&
    start >= 0 &&
    end >= 0 &&
    index >= Math.min(start, end) &&
    index <= Math.max(start, end)
  )
}
