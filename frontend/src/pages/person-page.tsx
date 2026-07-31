import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { RecordCard } from '@/components/archive/record-card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { extractAuthorIds, extractParticipantIds, stripMarkup } from '@/lib/markup'

export function PersonPage() {
  const [params] = useSearchParams()
  const id = params.get('id') || ''
  const [mode, setMode] = useState('participated')
  const resource = useArchive()
  const person = resource.data?.people.find((item) => item.id === id)
  const related = useMemo(
    () =>
      (resource.data?.records || [])
        .filter((record) =>
          mode === 'authored'
            ? extractAuthorIds(record).includes(id)
            : extractParticipantIds(record.content).includes(id),
        )
        .sort((a, b) => b.id.localeCompare(a.id)),
    [id, mode, resource.data],
  )

  useEffect(() => {
    document.title = person
      ? `${stripMarkup(person.name || person.id)} · 编日史`
      : '人物资料 · 编日史'
  }, [person])
  if (resource.loading) return <PageSkeleton rows={5} />
  if (resource.error) return <ErrorState title="人物资料加载失败" onRetry={resource.retry} />
  if (!person) return <ErrorState title="没有找到这位人物" />
  return (
    <div>
      <PageHeading
        eyebrow="PERSON ARCHIVE"
        title={stripMarkup(person.name || person.id)}
        description="人物资料与相关记录"
        actions={
          <Link to="/people" className={buttonVariants({ variant: 'outline' })}>
            返回人物名单
          </Link>
        }
      />
      <Card className="mb-7 bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-heading text-xl">基本资料</CardTitle>
            <Badge variant="outline">
              {person.role === 'student' ? '同学' : person.role === 'teacher' ? '老师' : '其他'}
            </Badge>
            {person.subject && <Badge variant="secondary">{stripMarkup(person.subject)}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">别名</p>
            <p>{stripMarkup(person.alias) || '—'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">人物 ID</p>
            <p>{person.id}</p>
          </div>
          {person.bio && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">简介</p>
              <MarkupContent content={person.bio} />
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-2xl font-semibold">
          相关记录{' '}
          <span className="text-sm font-normal text-muted-foreground">{related.length}</span>
        </h2>
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="participated">参与的事件</TabsTrigger>
            <TabsTrigger value="authored">记录的事件</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-4">
        {related.length ? (
          related.map((record) => <RecordCard record={record} key={record.fileName || record.id} />)
        ) : (
          <ErrorState title="暂时没有相关记录" />
        )}
      </div>
    </div>
  )
}
