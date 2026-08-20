import { BookOpenText, MessageSquareQuote, Search, Users } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { FilterToggle } from '@/components/archive/filter-toggle'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { PageHeading } from '@/components/archive/page-heading'
import { type RecordOrder, RecordOrderToggle } from '@/components/archive/record-order-toggle'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useArchive } from '@/features/archive/archive-context'
import { useAsyncData } from '@/hooks/use-async-data'
import { normalizeText } from '@/lib/archive'
import { stripMarkup } from '@/lib/markup'
import { quoteRecordTarget } from '@/lib/quote-navigation'
import {
  recordDisplayNumber,
  recordStableKey,
  recordTypeLabel,
  recordWrittenHref,
} from '@/lib/record-identity'
import { isModifiedRecordClick, prepareRecordJump, recordClientHref } from '@/lib/record-navigation'
import { loadSupplementalRecords } from '@/services/data'
import type { Quote, RecordItem } from '@/types/domain'

type SearchType = 'record' | 'person' | 'quote'
type SearchResult = {
  type: SearchType
  id: string
  title: string
  meta: string
  text: string
  href: string
  sortKey: string
  normalized: string
}

const labels: Record<SearchType, string> = { record: '记录', person: '人物', quote: '名言' }
const icons = { record: BookOpenText, person: Users, quote: MessageSquareQuote }

function quoteHref(quote: Quote, records: RecordItem[]) {
  return quoteRecordTarget(quote, records).href
}

function score(result: SearchResult, query: string) {
  const needle = normalizeText(query)
  if (!needle) return 0
  const title = normalizeText(result.title)
  if (title === needle) return 100
  if (title.startsWith(needle)) return 80
  if (title.includes(needle)) return 62
  return result.normalized.includes(needle) ? 36 : 0
}

function Snippet({ text, query }: { text: string; query: string }) {
  const plain = stripMarkup(text).replace(/\s+/g, ' ').trim()
  const needle = normalizeText(query)
  const index = needle ? plain.toLocaleLowerCase('zh-CN').indexOf(needle) : -1
  const start = index >= 0 ? Math.max(0, index - 34) : 0
  const end =
    index >= 0 ? Math.min(plain.length, index + needle.length + 56) : Math.min(96, plain.length)
  const before = plain.slice(start, index >= 0 ? index : end)
  const match = index >= 0 ? plain.slice(index, index + needle.length) : ''
  const after = index >= 0 ? plain.slice(index + needle.length, end) : ''
  return (
    <>
      {start > 0 && '···'}
      {before}
      {match && <mark>{match}</mark>}
      {after}
      {end < plain.length && '···'}
    </>
  )
}

function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  const Icon = icons[result.type]
  const navigate = useNavigate()
  const content = (
    <Card>
      <CardContent className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <strong className="text-sm">{result.title}</strong>
            <Badge variant="outline">{labels[result.type]}</Badge>
            {result.type !== 'person' && (
              <span className="record-source-action ml-auto inline-flex items-center gap-1.5 text-meta font-medium text-primary">
                <BookOpenText className="size-3.5" />
                跳转到原记录
              </span>
            )}
          </div>
          <p className="mb-1 text-meta text-muted-foreground">{result.meta || result.id}</p>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            <Snippet text={result.text} query={query} />
          </p>
        </div>
      </CardContent>
    </Card>
  )
  if (!result.href) return <div aria-disabled="true">{content}</div>
  const anchor = result.href.split('#')[1]
  return (
    <Link
      to={result.href}
      className={interactiveSurfaceVariants({ kind: 'card' })}
      onClick={(event) => {
        if (!anchor) return
        prepareRecordJump(anchor)
        if (isModifiedRecordClick(event)) return
        event.preventDefault()
        navigate(recordClientHref(result.href))
      }}
    >
      {content}
    </Link>
  )
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') || '')
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [types, setTypes] = useState<Set<SearchType>>(new Set(['record', 'person', 'quote']))
  const [recordOrder, setRecordOrder] = useState<RecordOrder>('descending')
  const resource = useArchive()
  const supplementalResource = useAsyncData(() => loadSupplementalRecords())

  useEffect(() => {
    const next = params.get('q') || ''
    setQuery((current) => (current === next ? current : next))
  }, [params])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (query.trim()) next.set('q', query)
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 120)
    return () => window.clearTimeout(timer)
  }, [query, setParams])

  const index = useMemo<SearchResult[]>(() => {
    if (!resource.data) return []
    const { people, quotes } = resource.data
    const records = [...resource.data.records, ...(supplementalResource.data || [])]
    return [
      ...records.map((record) => {
        const text = [
          record.id,
          record.fileName,
          record.date,
          record.time,
          record.author,
          record.content,
          ...record.attachments.flatMap((attachment) => [attachment.name, attachment.file]),
        ].join(' ')
        return {
          type: 'record' as const,
          id: record.id,
          title: [recordDisplayNumber(record), record.recordType && recordTypeLabel(record)]
            .filter(Boolean)
            .join(' · '),
          meta:
            [record.date, record.time, record.author && `记录人 ${record.author}`]
              .filter(Boolean)
              .join(' · ') || recordTypeLabel(record),
          text,
          href: recordWrittenHref(record),
          sortKey: record.date || recordStableKey(record),
          normalized: normalizeText(stripMarkup(text)),
        }
      }),
      ...people.map((person) => {
        const text = [
          person.id,
          person.name,
          person.alias,
          person.bio,
          person.role,
          person.subject,
        ].join(' ')
        return {
          type: 'person' as const,
          id: person.id,
          title: stripMarkup(person.name || person.alias || person.id),
          meta: person.role ? `身份 ${person.role}` : '人物条目',
          text,
          href: `/person?id=${encodeURIComponent(person.id)}`,
          sortKey: person.id,
          normalized: normalizeText(stripMarkup(text)),
        }
      }),
      ...quotes.map((quote) => {
        const text = [quote.id, quote.quote, quote.content, quote.sourceDate].join(' ')
        return {
          type: 'quote' as const,
          id: quote.id,
          title: stripMarkup(quote.quote || quote.id),
          meta: quote.sourceDate ? `来源 ${quote.sourceDate}` : '名言条目',
          text,
          href: quoteHref(quote, records),
          sortKey: quote.sourceDate || quote.id,
          normalized: normalizeText(stripMarkup(text)),
        }
      }),
    ]
  }, [resource.data, supplementalResource.data])

  const grouped = useMemo(() => {
    const matches = index
      .filter((item) => types.has(item.type))
      .map((item) => ({ ...item, score: score(item, debouncedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.sortKey.localeCompare(a.sortKey))
    return (['record', 'person', 'quote'] as const)
      .map((type) => {
        const items = matches.filter((item) => item.type === type)
        if (type === 'record') {
          const direction = recordOrder === 'descending' ? -1 : 1
          items.sort(
            (left, right) =>
              right.score - left.score || left.sortKey.localeCompare(right.sortKey) * direction,
          )
        }
        return { type, items }
      })
      .filter((group) => group.items.length)
  }, [debouncedQuery, index, recordOrder, types])
  const total = grouped.reduce((sum, group) => sum + group.items.length, 0)

  const toggle = (type: SearchType) =>
    setTypes((current) => {
      const next = new Set(current)
      if (next.has(type) && next.size > 1) next.delete(type)
      else next.add(type)
      return next
    })

  let body: ReactNode = null
  if (resource.loading || supplementalResource.loading) body = <PageSkeleton rows={4} />
  else if (resource.error || supplementalResource.error)
    body = (
      <ErrorState
        title="搜索索引建立失败"
        onRetry={() => {
          resource.retry()
          supplementalResource.retry()
        }}
      />
    )
  else if (!debouncedQuery.trim())
    body = <EmptyState title={`已索引 ${index.length} 个条目，输入关键词开始搜索`} />
  else if (!total) body = <EmptyState title="没有找到匹配条目" />
  else
    body = (
      <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">找到 {total} 个结果</p>
        {grouped.map((group) => (
          <section key={group.type} aria-labelledby={`search-${group.type}`}>
            <h2
              id={`search-${group.type}`}
              className="mb-3 font-heading text-section-title font-semibold"
            >
              {labels[group.type]}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                {group.items.length}
              </span>
            </h2>
            <div className="grid gap-3">
              {group.items.map((result) => (
                <ResultCard
                  key={`${result.type}-${result.id}`}
                  result={result}
                  query={debouncedQuery}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    )

  return (
    <div>
      <PageHeading title="搜索" description="一次搜索记录正文、人物资料与名言内容。" />
      <Card className="mb-6">
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-12 pl-10 text-base"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入人名、日期、原话或记录内容"
              autoFocus
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['record', 'person', 'quote'] as const).map((type) => (
              <FilterToggle
                key={type}
                pressed={types.has(type)}
                onPressedChange={() => toggle(type)}
              >
                {labels[type]}
              </FilterToggle>
            ))}
            {types.has('record') && (
              <RecordOrderToggle
                value={recordOrder}
                onValueChange={setRecordOrder}
                ariaLabel="搜索记录结果显示顺序"
              />
            )}
          </div>
        </CardContent>
      </Card>
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow)">
        {body}
      </div>
    </div>
  )
}
