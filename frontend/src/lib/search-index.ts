import { normalizeText } from '@/lib/archive'
import { extractMarkupReferences, stripMarkup } from '@/lib/markup'
import { filterProfanity } from '@/lib/profanity'
import { quoteRecordTarget } from '@/lib/quote-navigation'
import {
  recordDisplayNumber,
  recordStableKey,
  recordTypeLabel,
  recordWrittenHref,
} from '@/lib/record-identity'
import type { Material, Person, Quote, RecordItem } from '@/types/domain'

export type SearchType = 'record' | 'person' | 'quote' | 'material'
export type SearchResult = {
  type: SearchType
  id: string
  title: string
  meta: string
  text: string
  href: string
  sortKey: string
  normalized: string
}

function visiblePlainText(value: string, hideProfanity: boolean) {
  return filterProfanity(stripMarkup(value), hideProfanity).replace(/\s+/g, ' ').trim()
}

function searchableResult(
  result: Omit<SearchResult, 'normalized'>,
  searchable: string[],
): SearchResult {
  return { ...result, normalized: normalizeText(searchable.filter(Boolean).join(' ')) }
}

export function buildSearchIndex({
  records,
  people,
  quotes,
  materials,
  hideProfanity,
}: {
  records: RecordItem[]
  people: Person[]
  quotes: Quote[]
  materials: Material[]
  hideProfanity: boolean
}) {
  const relatedRecords = new Map<string, RecordItem[]>()
  for (const record of records) {
    for (const materialId of extractMarkupReferences(record.content).materialIds) {
      const matches = relatedRecords.get(materialId)
      if (matches) matches.push(record)
      else relatedRecords.set(materialId, [record])
    }
  }

  return [
    ...records.map((record) => {
      const content = visiblePlainText(record.content, hideProfanity)
      const attachmentNames = record.attachments.map((attachment) => attachment.name || '')
      const meta =
        [record.date, record.time, record.author && `记录人 ${record.author}`]
          .filter(Boolean)
          .join(' · ') || recordTypeLabel(record)
      return searchableResult(
        {
          type: 'record' as const,
          id: recordStableKey(record),
          title: [recordDisplayNumber(record), record.recordType && recordTypeLabel(record)]
            .filter(Boolean)
            .join(' · '),
          meta,
          text: content,
          href: recordWrittenHref(record),
          sortKey: record.date || recordStableKey(record),
        },
        [
          record.date,
          record.time,
          record.author,
          recordTypeLabel(record),
          content,
          ...attachmentNames,
        ],
      )
    }),
    ...people.map((person) => {
      const title = visiblePlainText(person.name || person.alias || person.id, hideProfanity)
      const bio = visiblePlainText(person.bio, hideProfanity)
      const aliases = [person.alias, ...person.aliases]
        .map((value) => visiblePlainText(value, hideProfanity))
        .filter(Boolean)
      return searchableResult(
        {
          type: 'person' as const,
          id: person.id,
          title,
          meta: person.role ? `身份 ${person.role}` : '人物条目',
          text: [aliases.join('、'), bio].filter(Boolean).join(' · '),
          href: `/person?id=${encodeURIComponent(person.id)}`,
          sortKey: title,
        },
        [title, ...aliases, person.role, person.subject, bio],
      )
    }),
    ...quotes.map((quote) => {
      const content = visiblePlainText(quote.quote || quote.content, hideProfanity)
      return searchableResult(
        {
          type: 'quote' as const,
          id: quote.id,
          title: content,
          meta: quote.sourceDate ? `来源 ${quote.sourceDate}` : '名言条目',
          text: content,
          href: quoteRecordTarget(quote, records).href,
          sortKey: quote.sourceDate || content,
        },
        [content, quote.sourceDate],
      )
    }),
    ...materials.map((material) => {
      const title = visiblePlainText(material.title, hideProfanity)
      const content = visiblePlainText(material.content, hideProfanity)
      const related = relatedRecords.get(material.id) || []
      const relatedText = related
        .map((record) => visiblePlainText(record.content, hideProfanity))
        .filter(Boolean)
        .join(' ')
      return searchableResult(
        {
          type: 'material' as const,
          id: material.id,
          title,
          meta: related.length ? `资料 · 关联 ${related.length} 条记录` : '资料',
          text: [content, relatedText && `关联记录：${relatedText}`].filter(Boolean).join(' · '),
          href: `/materials?id=${encodeURIComponent(material.id)}`,
          sortKey: title,
        },
        [title, content, relatedText],
      )
    }),
  ] satisfies SearchResult[]
}

export function scoreSearchResult(result: SearchResult, query: string) {
  const needle = normalizeText(query)
  if (!needle) return 0
  const title = normalizeText(result.title)
  if (title === needle) return 100
  if (title.startsWith(needle)) return 80
  if (title.includes(needle)) return 62
  return result.normalized.includes(needle) ? 36 : 0
}
