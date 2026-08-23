import { countTextCharacters, extractMarkupReferences, extractParticipantIds } from '@/lib/markup'
import { fixedTimelineChartScale } from '@/lib/timeline'
import type { RecordItem } from '@/types/domain'

export type TimelineMetric = 'count' | 'characters'

const recordDateCache = new WeakMap<RecordItem, ReturnType<typeof parseRecordDate>>()
const recordCharacterCache = new WeakMap<RecordItem, number>()
const recordMentionCache = new WeakMap<RecordItem, { peopleIds: string[]; quoteIds: string[] }>()

function parseRecordDate(record: RecordItem) {
  const match = [record.date, record.fileName, record.id]
    .join(' ')
    .match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  const year = match[1]
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const candidate = new Date(0)
  candidate.setUTCHours(0, 0, 0, 0)
  candidate.setUTCFullYear(Number(year), month - 1, day)
  if (
    candidate.getUTCFullYear() !== Number(year) ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  )
    return null
  return {
    year,
    month: String(month).padStart(2, '0'),
    day: String(day).padStart(2, '0'),
  }
}

export function timelineDateParts(record: RecordItem) {
  if (recordDateCache.has(record)) return recordDateCache.get(record) || null
  const value = parseRecordDate(record)
  recordDateCache.set(record, value)
  return value
}

export function recordCharacterCount(record: RecordItem) {
  const cached = recordCharacterCache.get(record)
  if (cached !== undefined) return cached
  const value = countTextCharacters(record.content)
  recordCharacterCache.set(record, value)
  return value
}

export function recordMentions(record: RecordItem) {
  const cached = recordMentionCache.get(record)
  if (cached) return cached
  const value = {
    peopleIds: extractParticipantIds(record.content),
    quoteIds: extractMarkupReferences(record.content).quoteIds,
  }
  recordMentionCache.set(record, value)
  return value
}

export function timelineMetricValue(records: RecordItem[], metric: TimelineMetric) {
  return metric === 'count'
    ? records.length
    : records.reduce((sum, record) => sum + recordCharacterCount(record), 0)
}

export function topTimelineEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
}

export function timelineScale(values: number[], metric: TimelineMetric, period: 'month' | 'day') {
  if (period === 'month')
    return fixedTimelineChartScale(
      values,
      metric === 'characters' ? 3000 : 100,
      metric === 'characters' ? 750 : 25,
    )
  return fixedTimelineChartScale(
    values,
    metric === 'characters' ? 1000 : 12,
    metric === 'characters' ? 250 : 3,
  )
}

export function countTimelineBy(
  records: RecordItem[],
  keys: (record: RecordItem) => string[],
  metric: TimelineMetric,
) {
  const map = new Map<string, number>()
  for (const record of records) {
    const amount = metric === 'count' ? 1 : recordCharacterCount(record)
    for (const key of new Set(keys(record).filter(Boolean)))
      map.set(key, (map.get(key) || 0) + amount)
  }
  return map
}
