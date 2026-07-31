import { BookOpenText, MessageSquareQuote, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useArchive } from '@/features/archive/archive-context'
import { normalizeText } from '@/lib/archive'
import { stripMarkup } from '@/lib/markup'

type SearchType = 'record' | 'person' | 'quote'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<Set<SearchType>>(new Set(['record', 'person', 'quote']))
  const resource = useArchive()
  useEffect(() => {
    document.title = '全站搜索 · 编日史'
  }, [])
  const results = useMemo(() => {
    const needle = normalizeText(query)
    if (!needle || !resource.data) return []
    const output: Array<{
      type: SearchType
      id: string
      title: string
      detail: string
      href: string
    }> = []
    if (types.has('record'))
      for (const record of resource.data.records) {
        const body = stripMarkup(record.content)
        if (normalizeText([record.id, record.date, record.author, body].join(' ')).includes(needle))
          output.push({
            type: 'record',
            id: record.id,
            title: `${record.date || '未注明日期'} · ${record.author || '匿名记录'}`,
            detail: body,
            href: `/records?view=list#record-${record.fileName.replace(/\.json$/i, '')}`,
          })
      }
    if (types.has('person'))
      for (const person of resource.data.people) {
        if (
          normalizeText(
            [person.id, person.name, person.alias, person.bio, person.subject].join(' '),
          ).includes(needle)
        )
          output.push({
            type: 'person',
            id: person.id,
            title: stripMarkup(person.name || person.id),
            detail: stripMarkup(person.bio || person.alias),
            href: `/person?id=${encodeURIComponent(person.id)}`,
          })
      }
    if (types.has('quote'))
      for (const quote of resource.data.quotes) {
        if (normalizeText([quote.id, stripMarkup(quote.quote)].join(' ')).includes(needle))
          output.push({
            type: 'quote',
            id: quote.id,
            title: stripMarkup(quote.quote),
            detail: quote.sourceDate,
            href: `/records?view=list#record-${quote.recordFile.replace(/\.json$/i, '')}`,
          })
      }
    return output.slice(0, 100)
  }, [query, resource.data, types])
  const toggle = (type: SearchType) =>
    setTypes((current) => {
      const next = new Set(current)
      if (next.has(type) && next.size > 1) next.delete(type)
      else next.add(type)
      return next
    })
  const icon = { record: BookOpenText, person: Users, quote: MessageSquareQuote }
  const labels = { record: '记录', person: '人物', quote: '名言' }
  return (
    <div>
      <PageHeading title="全站搜索" description="一次搜索记录正文、人物资料与名言内容。" />
      <Card className="mb-6">
        <CardContent className="pt-4">
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
          <div className="mt-3 flex gap-2">
            {(['record', 'person', 'quote'] as const).map((type) => (
              <Button
                key={type}
                variant={types.has(type) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggle(type)}
              >
                {labels[type]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      {resource.loading && <PageSkeleton rows={4} />}
      {resource.error && <ErrorState title="搜索索引建立失败" onRetry={resource.retry} />}
      {resource.data && query && (
        <div className="grid gap-3">
          <p className="mb-1 text-sm text-muted-foreground">找到 {results.length} 项结果</p>
          {results.map((result) => {
            const Icon = icon[result.type]
            return (
              <Link to={result.href} key={`${result.type}-${result.id}`}>
                <Card className="transition hover:ring-primary/25">
                  <CardContent className="flex gap-4 pt-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <strong className="truncate text-sm">{result.title}</strong>
                        <Badge variant="outline">{labels[result.type]}</Badge>
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {result.detail || result.id}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
          {results.length === 0 && <EmptyState title="没有找到匹配内容" />}
        </div>
      )}
    </div>
  )
}
