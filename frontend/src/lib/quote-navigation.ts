import { normalizeRecordKey } from '@/lib/archive'
import { extractQuoteMarkers, recordAnchor } from '@/lib/markup'
import type { Quote, RecordItem } from '@/types/domain'

export function resolveQuoteSources(quote: Quote, records: RecordItem[]) {
  const directKey = normalizeRecordKey(quote.recordFile)
  if (directKey) {
    const direct = records.find(
      (record) => normalizeRecordKey(record.fileName || record.id) === directKey,
    )
    if (direct) return [direct]
  }
  return records.filter((record) =>
    extractQuoteMarkers(record.content).some((marker) => marker.id === quote.id),
  )
}

export function quoteRecordTarget(quote: Quote, records: RecordItem[]) {
  const sources = resolveQuoteSources(quote, records)
  const source = sources.length === 1 ? sources[0] : undefined
  const anchor = source ? recordAnchor(source) : ''
  return {
    anchor,
    href: anchor ? `/records?view=written#${anchor}` : '',
    source,
    sources,
  }
}
