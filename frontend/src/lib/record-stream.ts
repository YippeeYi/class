import type { RecordItem, RecordPage } from '@/types/domain'
import { normalizeRecordKey } from './archive.ts'
import { recordStableKey } from './record-identity.ts'

export type RecordPagePosition = { fileName: string; page: string }

export function recordAnnotation(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

export function visibleRecords(records: readonly RecordItem[], includeHidden = false) {
  return records.filter((record) => includeHidden || !record.hidden)
}

export function recordPageKey(page: string) {
  return /^H?\d+$/.test(page) ? String(Number(page.replace(/^H/, ''))) : page
}

export type RecordStreamPage = { page: string; records: RecordItem[] }

/** Page order, then proverb → supplement → ordinary; each record belongs to one page only. */
export function buildRecordStream(
  records: readonly RecordItem[],
  positions: readonly RecordPagePosition[],
  includeHidden = false,
): RecordStreamPage[] {
  const pagesByFile = new Map(
    positions.map((item) => [normalizeRecordKey(item.fileName), recordPageKey(item.page)]),
  )
  const groups = new Map<string, RecordItem[]>()
  const seen = new Set<string>()
  for (const record of visibleRecords(records, includeHidden)) {
    const key = recordStableKey(record)
    if (seen.has(key)) continue
    seen.add(key)
    const page =
      record.recordType === 'message' || record.recordType === 'supplement'
        ? recordPageKey(record.page || '')
        : pagesByFile.get(normalizeRecordKey(record.fileName)) || ''
    const group = groups.get(page) || []
    group.push(record)
    groups.set(page, group)
  }
  const kindOrder = { message: 0, supplement: 1, record: 2 }
  return [...groups]
    .sort(([left], [right]) =>
      !left ? 1 : !right ? -1 : left.localeCompare(right, 'en', { numeric: true }),
    )
    .map(([page, items]) => ({
      page,
      records: items.sort(
        (left, right) =>
          kindOrder[left.recordType || 'record'] - kindOrder[right.recordType || 'record'] ||
          (left.supplementIndex || 0) - (right.supplementIndex || 0) ||
          left.fileName.localeCompare(right.fileName, 'en', { numeric: true }) ||
          left.date.localeCompare(right.date) ||
          left.time.localeCompare(right.time) ||
          left.recordIndex - right.recordIndex ||
          recordStableKey(left).localeCompare(recordStableKey(right)),
      ),
    }))
}

export function orderedRecordStream(pages: readonly RecordStreamPage[], descending = false) {
  const records = pages.flatMap((page) => page.records)
  return descending ? records.reverse() : records
}

export function writtenStreamPages(
  pages: readonly RecordPage[],
  stream: readonly RecordStreamPage[],
) {
  const byPage = new Map(
    pages.filter((page) => !page.hidden).map((page) => [recordPageKey(page.page), page]),
  )
  for (const group of stream) {
    if (!byPage.has(group.page))
      byPage.set(group.page, {
        page: group.page,
        startFile: '',
        endFile: '',
        imagePath: '',
        hidden: false,
      })
  }
  return [...byPage.values()].sort((left, right) =>
    !left.page
      ? 1
      : !right.page
        ? -1
        : left.page.localeCompare(right.page, 'en', { numeric: true }),
  )
}
