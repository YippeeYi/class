import { ArrowDownAZ, ArrowUpAZ, BookOpenText, Quote as QuoteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { Button, interactiveSurfaceVariants } from '@/components/archive/interaction'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useArchive } from '@/features/archive/archive-context'
import { stripMarkup } from '@/lib/markup'
import { quoteRecordTarget } from '@/lib/quote-navigation'
import { isModifiedRecordClick, prepareRecordJump, recordClientHref } from '@/lib/record-navigation'

export function QuotesPage() {
  const [sort, setSort] = useState<'id' | 'quote'>('id')
  const [descending, setDescending] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const resource = useArchive()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = '名言 · 编日史'
  }, [])
  const quotes = useMemo(
    () =>
      [...(resource.data?.quotes || [])].sort((a, b) => {
        const left = sort === 'quote' ? stripMarkup(a.quote) : a.id
        const right = sort === 'quote' ? stripMarkup(b.quote) : b.id
        return left.localeCompare(right, 'zh-CN') * (descending ? -1 : 1)
      }),
    [descending, resource.data, sort],
  )
  return (
    <div>
      <PageHeading
        title="名言"
        description="这些原话直接从记录标记中派生，并保留与原始事件之间的关联。"
        actions={
          <>
            <Select value={sort} onValueChange={(value) => setSort(value as 'id' | 'quote')}>
              <SelectTrigger aria-label="排序方式" className="min-w-32 bg-background/85">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="id">按 ID</SelectItem>
                <SelectItem value="quote">按内容</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setDescending((value) => !value)}>
              {descending ? <ArrowDownAZ /> : <ArrowUpAZ />}
              {descending ? '降序' : '升序'}
            </Button>
          </>
        }
      />
      {resource.loading && <PageSkeleton rows={5} />}
      {resource.error && <ErrorState title="名言加载失败" onRetry={resource.retry} />}
      {sourceError && (
        <Alert variant="destructive" className="mb-5" role="alert">
          <AlertTitle>无法打开名言来源</AlertTitle>
          <AlertDescription>{sourceError}</AlertDescription>
        </Alert>
      )}
      {resource.data && quotes.length === 0 && (
        <EmptyState title="暂无名言" description="记录中还没有可展示的名言标记。" />
      )}
      {resource.data && (
        <div className="grid items-start gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:grid-cols-2">
          {quotes.map((quote) => {
            const { anchor, source, sources } = quoteRecordTarget(
              quote,
              resource.data?.records || [],
            )
            const target = anchor ? `/records?view=written#${anchor}` : `/quotes#quote-${quote.id}`
            return (
              <Link
                id={`quote-${quote.id}`}
                key={quote.id}
                className={`${interactiveSurfaceVariants({ kind: 'card' })} quote-record-link block h-fit scroll-mt-24 focus-visible:ring-2`}
                to={target}
                onClick={(event) => {
                  if (!source || !anchor) {
                    event.preventDefault()
                    setSourceError(
                      sources.length === 0
                        ? '没有找到这条名言对应的记录。'
                        : '这条名言匹配到多条记录，请检查记录标记。',
                    )
                    return
                  }
                  setSourceError('')
                  prepareRecordJump(anchor)
                  if (isModifiedRecordClick(event)) return
                  event.preventDefault()
                  navigate(recordClientHref(target))
                }}
              >
                <Card className="h-fit gap-0 py-0">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                        <QuoteIcon className="size-4" />
                      </span>
                      <Badge variant="outline">{quote.id}</Badge>
                    </div>
                    <blockquote className="border-l-2 border-primary/30 pl-4">
                      <MarkupContent content={quote.quote} className="text-reading" />
                    </blockquote>
                    <div className="quote-card-footer mt-4 flex min-h-8 items-center justify-between gap-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
                      <span>{quote.sourceDate || '来源记录'}</span>
                      <span className="record-source-action quote-source-action app-inline-action inline-flex items-center gap-1.5">
                        <BookOpenText data-icon="inline-start" />
                        跳转到原记录
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
