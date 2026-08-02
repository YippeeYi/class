import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { RecordCard } from '@/components/archive/record-card'
import {
  EMPTY_RECORD_CRITERIA,
  filterRecords,
  type RecordCriteria,
  RecordFilters,
} from '@/components/archive/record-filters'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { extractAuthorIds, extractParticipantIds, stripMarkup } from '@/lib/markup'
import type { Person } from '@/types/domain'

function PersonAvatar({ person }: { person: Person }) {
  const [failed, setFailed] = useState(false)
  const remote = /^https?:\/\//i.test(person.avatarUrl)
  const signed = useSignedAsset(remote ? '' : person.avatarUrl)
  const src = remote ? person.avatarUrl : signed.src
  if (!src || failed) return null
  return (
    <img
      src={src}
      alt={stripMarkup(person.name || person.id)}
      width={192}
      height={192}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      onError={() => setFailed(true)}
      className="aspect-square w-full max-w-48 rounded-xl border object-cover"
    />
  )
}

export function PersonPage() {
  const [params] = useSearchParams()
  const id = params.get('id') || ''
  const [mode, setMode] = useState('participated')
  const [criteria, setCriteria] = useState<RecordCriteria>(EMPTY_RECORD_CRITERIA)
  const resource = useArchive()
  const person = resource.data?.people.find((item) => item.id === id)
  const participatedRecords = useMemo(
    () =>
      (resource.data?.records || [])
        .filter((record) => extractParticipantIds(record.content).includes(id))
        .sort((a, b) => b.id.localeCompare(a.id)),
    [id, resource.data],
  )
  const authoredRecords = useMemo(
    () =>
      (resource.data?.records || [])
        .filter((record) => extractAuthorIds(record).includes(id))
        .sort((a, b) => b.id.localeCompare(a.id)),
    [id, resource.data],
  )
  const allRelated = mode === 'authored' ? authoredRecords : participatedRecords
  const related = useMemo(() => filterRecords(allRelated, criteria), [allRelated, criteria])

  // biome-ignore lint/correctness/useExhaustiveDependencies: same-route person links must reset view-local controls when the URL id changes.
  useEffect(() => {
    setMode('participated')
    setCriteria(EMPTY_RECORD_CRITERIA)
  }, [id])

  useEffect(() => {
    document.title = person
      ? `${stripMarkup(person.name || person.id)} · 编日史`
      : '人物资料 · 编日史'
  }, [person])
  if (resource.loading) return <PageSkeleton rows={5} />
  if (resource.error) return <ErrorState title="人物资料加载失败" onRetry={resource.retry} />
  if (!person)
    return (
      <EmptyState
        title={id ? '没有找到这位人物' : '人物参数缺失'}
        description="请从人物名单页重新打开。"
      />
    )
  const aliasText = stripMarkup(person.alias || person.aliases.join('、')) || '—'
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
      <Card className="mb-7">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-heading text-xl">基本资料</CardTitle>
            <Badge variant="outline">
              {person.role === 'student' ? '同学' : person.role === 'teacher' ? '老师' : '其他'}
            </Badge>
            {person.subject && <Badge variant="secondary">{stripMarkup(person.subject)}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
          {person.avatarUrl && <PersonAvatar key={person.avatarUrl} person={person} />}
          <div className={`grid gap-5 sm:grid-cols-2 ${person.avatarUrl ? '' : 'sm:col-span-2'}`}>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">别名</p>
              <p>{aliasText}</p>
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
          </div>
        </CardContent>
      </Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-2xl font-semibold">
          相关记录{' '}
          <span className="text-sm font-normal text-muted-foreground">{related.length}</span>
        </h2>
        {authoredRecords.length > 0 && (
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value)
              setCriteria(EMPTY_RECORD_CRITERIA)
            }}
          >
            <TabsList>
              <TabsTrigger value="participated">参与的事件</TabsTrigger>
              <TabsTrigger value="authored">记录的事件</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      <RecordFilters records={allRelated} value={criteria} onChange={setCriteria} />
      <div
        key={`${mode}-${criteria.year}-${criteria.month}-${criteria.day}-${criteria.important}-${criteria.excludeDaily}-${criteria.query}`}
        className="grid gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      >
        {related.length ? (
          related.map((record) => <RecordCard record={record} key={record.fileName || record.id} />)
        ) : (
          <EmptyState title="暂时没有相关记录" />
        )}
      </div>
    </div>
  )
}
