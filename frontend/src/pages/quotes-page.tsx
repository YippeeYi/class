import { ArrowDownAZ, ArrowUpAZ, Quote as QuoteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useArchive } from '@/features/archive/archive-context'
import { extractQuoteMarkers, recordAnchor } from '@/lib/markup'
import { prepareRecordJump } from '@/lib/record-navigation'
import type { Quote, RecordItem } from '@/types/domain'

function quoteSources(quote: Quote, records: RecordItem[]) {
  const directKey = quote.recordFile.replace(/\.json$/i, '')
  const direct = records.find(
    (record) => (record.fileName || record.id).replace(/\.json$/i, '') === directKey,
  )
  if (direct) return [direct]
  return records.filter((record) =>
    extractQuoteMarkers(record.content).some((marker) => marker.id === quote.id),
  )
}

export function QuotesPage() {
  const [sort, setSort] = useState<'id' | 'quote'>('id')
  const [descending, setDescending] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const resource = useArchive()
  useEffect(() => {
    document.title = '名言 · 编日史'
  }, [])
  const quotes = useMemo(
    () =>
      [...(resource.data?.quotes || [])].sort(
        (a, b) =>
          (sort === 'quote' ? a.quote.localeCompare(b.quote, 'zh-CN') : a.id.localeCompare(b.id)) *
          (descending ? -1 : 1),
      ),
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
              <SelectTrigger
                aria-label="排序方式"
                className="min-w-32 bg-background/85 transition-colors hover:bg-accent/55"
              >
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
        <div
          key={`${sort}-${descending}`}
          className="grid gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:grid-cols-2"
        >
          {quotes.map((quote) => {
            const sources = quoteSources(quote, resource.data?.records || [])
            const source = sources.length === 1 ? sources[0] : null
            const anchor = source ? recordAnchor(source) : ''
            return (
              <Card id={`quote-${quote.id}`} key={quote.id} className="scroll-mt-24">
                <CardContent className="pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <QuoteIcon className="size-4" />
                    </span>
                    <Badge variant="outline">{quote.id}</Badge>
                  </div>
                  <MarkupContent content={quote.quote} className="text-base" />
                  <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                    <span>{quote.sourceDate || '日期未记录'}</span>
                    <Link
                      className={buttonVariants({ variant: 'link', size: 'xs' })}
                      to={anchor ? `/records?view=list#${anchor}` : `/quotes#quote-${quote.id}`}
                      aria-disabled={!anchor}
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
                      }}
                    >
                      查看来源
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
