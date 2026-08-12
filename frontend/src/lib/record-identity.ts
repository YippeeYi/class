import type { PageMessage, PageSupplement, RecordItem } from '@/types/domain'

import { normalizeRecordKey } from './archive.ts'

function stableHash(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function numberSegment(value: unknown, minimumLength = 3) {
  const normalized = String(value ?? '').trim()
  const numeric = /^\d+$/.test(normalized) ? String(Number(normalized)) : ''
  if (numeric) return numeric.padStart(minimumLength, '0')
  return stableHash(normalized || 'unknown')
    .slice(0, Math.max(minimumLength, 4))
    .toUpperCase()
}

export function recordStableKey(record: Partial<RecordItem>) {
  const type = record.recordType || 'record'
  if (type === 'message') return `message:${String(record.page ?? '').trim()}`
  if (type === 'supplement') {
    return `supplement:${String(record.page ?? '').trim()}:${String(record.supplementIndex ?? record.recordIndex ?? '').trim()}`
  }
  return `record:${normalizeRecordKey(record.fileName || record.id)}`
}

export function recordDisplayNumber(record: Partial<RecordItem>) {
  const type = record.recordType || 'record'
  if (type === 'message') return `#箴-${numberSegment(record.page)}`
  if (type === 'supplement') {
    return `#补-${numberSegment(record.page)}-${numberSegment(record.supplementIndex ?? record.recordIndex, 2)}`
  }
  return `#${String(record.id || normalizeRecordKey(record.fileName) || '').replace(/\.json$/i, '')}`
}

export function recordTypeLabel(record: Partial<RecordItem>) {
  if (record.recordType === 'message') return '箴言'
  if (record.recordType === 'supplement') return '补充'
  return '记录'
}

export function recordAnchorId(record: Partial<RecordItem>) {
  const identity =
    record.recordType === 'message' || record.recordType === 'supplement'
      ? recordStableKey(record)
      : String(record.fileName || record.id || '').replace(/\.json$/i, '')
  return `record-${identity.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function recordWrittenHref(record: Partial<RecordItem>) {
  return `/records?view=written#${recordAnchorId(record)}`
}

export function buildSupplementalRecords(messages: PageMessage[], supplements: PageSupplement[]) {
  const messageRecords: RecordItem[] = messages.map((item, index) => ({
    id: `message-${item.page || index + 1}`,
    fileName: '',
    recordIndex: index + 1,
    date: '',
    time: '',
    author: item.author,
    recorder: item.author,
    content: item.content,
    text: item.content,
    importance: 'normal',
    attachments: [],
    hidden: false,
    recordType: 'message',
    page: item.page,
  }))
  const supplementRecords: RecordItem[] = supplements.map((item) => ({
    id: `supplement-${item.page}-${item.supplementIndex}`,
    fileName: '',
    recordIndex: item.supplementIndex,
    date: item.date,
    time: item.time,
    author: item.author,
    recorder: item.author,
    content: item.content,
    text: item.content,
    importance: item.importance || 'normal',
    attachments: [],
    hidden: item.hidden,
    recordType: 'supplement',
    page: item.page,
    supplementIndex: item.supplementIndex,
  }))
  return [...messageRecords, ...supplementRecords]
}
