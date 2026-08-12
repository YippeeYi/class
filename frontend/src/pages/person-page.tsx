import { UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { useAsyncData } from '@/hooks/use-async-data'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { extractAuthorIds, extractParticipantIds, stripMarkup } from '@/lib/markup'
import { recordStableKey } from '@/lib/record-identity'
import { loadSupplementalRecords } from '@/services/data'
import type { Person, RecordItem } from '@/types/domain'

const participantCache = new WeakMap<RecordItem, string[]>()
const authorCache = new WeakMap<RecordItem, string[]>()

function participantIds(record: RecordItem) {
  const cached = participantCache.get(record)
  if (cached) return cached
  const value = extractParticipantIds(record.content)
  participantCache.set(record, value)
  return value
}

function authorIds(record: RecordItem) {
  const cached = authorCache.get(record)
  if (cached) return cached
  const value = extractAuthorIds(record)
  authorCache.set(record, value)
  return value
}

function PersonAvatar({ person }: { person: Person }) {
  const remote = /^https?:\/\//i.test(person.avatarUrl)
  const signed = useSignedAsset(remote ? '' : person.avatarUrl)
  const src = remote ? person.avatarUrl : signed.src
  const label = stripMarkup(person.name || person.id) || person.id
  return (
    <Avatar
      className="aspect-square h-auto w-full max-w-48 rounded-xl after:rounded-xl"
      aria-label={label}
    >
      {src && (
        <AvatarImage
          src={src}
          alt={label}
          width={192}
          height={192}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="rounded-xl"
        />
      )}
      <AvatarFallback className="rounded-xl text-3xl font-semibold">
        {label ? [...label][0] : <UserRound className="size-8" />}
      </AvatarFallback>
    </Avatar>
  )
}

export function PersonPage() {
  const [params] = useSearchParams()
  const id = params.get('id') || ''
  const [mode, setMode] = useState('participated')
  const [criteria, setCriteria] = useState<RecordCriteria>(EMPTY_RECORD_CRITERIA)
  const resource = useArchive()
  const supplementalResource = useAsyncData(() => loadSupplementalRecords())
  const person = resource.data?.people.find((item) => item.id === id)
  const relatedSources = useMemo(
    () => [...(resource.data?.records || []), ...(supplementalResource.data || [])],
    [resource.data?.records, supplementalResource.data],
  )
  const participatedRecords = useMemo(
    () =>
      relatedSources
        .filter((record) => participantIds(record).includes(id))
        .sort((a, b) => recordStableKey(b).localeCompare(recordStableKey(a))),
    [id, relatedSources],
  )
  const authoredRecords = useMemo(
    () =>
      relatedSources
        .filter((record) => authorIds(record).includes(id))
        .sort((a, b) => recordStableKey(b).localeCompare(recordStableKey(a))),
    [id, relatedSources],
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
  const displayName = person ? stripMarkup(person.name || person.id) || person.id : '人物资料'
  const heading = (
    <PageHeading
      eyebrow="PERSON ARCHIVE"
      title={displayName}
      headerTitle={displayName}
      showTitleInContent
      description="人物资料与相关记录"
      actions={
        <Link to="/people" className={buttonVariants({ variant: 'outline' })}>
          返回人物名单
        </Link>
      }
    />
  )
  if (resource.loading)
    return (
      <div>
        {heading}
        <PageSkeleton rows={5} />
      </div>
    )
  if (resource.error)
    return (
      <div>
        {heading}
        <ErrorState title="人物资料加载失败" onRetry={resource.retry} />
      </div>
    )
  if (!person)
    return (
      <div>
        {heading}
        <EmptyState
          title={id ? '没有找到这位人物' : '人物参数缺失'}
          description="请从人物名单页重新打开。"
        />
      </div>
    )
  const aliasText = stripMarkup(person.alias || person.aliases.join('、')) || '—'
  return (
    <div>
      {heading}
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
              <p className="mb-1 text-meta font-medium text-muted-foreground">别名</p>
              <p>{aliasText}</p>
            </div>
            <div>
              <p className="mb-1 text-meta font-medium text-muted-foreground">人物 ID</p>
              <p>{person.id}</p>
            </div>
            {person.bio && (
              <div className="sm:col-span-2">
                <p className="mb-2 text-meta font-medium text-muted-foreground">简介</p>
                <MarkupContent content={person.bio} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-section-title font-semibold">
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
      {supplementalResource.loading && (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          正在补全书面记录…
        </p>
      )}
      {supplementalResource.error && (
        <Alert variant="destructive" className="mb-4" role="alert">
          <AlertTitle>补充记录暂未载入</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>人物资料和普通记录仍可使用；重试后会补全箴言与补充记录。</span>
            <Button size="sm" variant="outline" onClick={supplementalResource.retry}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
        {related.length ? (
          related.map((record) => <RecordCard record={record} key={recordStableKey(record)} />)
        ) : (
          <EmptyState title="暂时没有相关记录" />
        )}
      </div>
    </div>
  )
}
