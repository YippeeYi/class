import { ArrowDownAZ, ArrowUpAZ, Quote as QuoteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
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

export function QuotesPage() {
  const [sort, setSort] = useState<'id' | 'quote'>('id')
  const [descending, setDescending] = useState(false)
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
              <SelectTrigger aria-label="排序方式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">按 ID</SelectItem>
                <SelectItem value="quote">按内容</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setDescending((value) => !value)}>
              {descending ? <ArrowDownAZ /> : <ArrowUpAZ />}
            </Button>
          </>
        }
      />
      {resource.loading && <PageSkeleton rows={5} />}
      {resource.error && <ErrorState title="名言加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          {quotes.map((quote) => (
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
                    to={`/records?view=list#record-${quote.recordFile.replace(/\.json$/i, '')}`}
                  >
                    查看来源
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
