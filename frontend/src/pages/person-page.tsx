import { UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { ImageViewer } from '@/components/archive/image-viewer'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { RecordCard } from '@/components/archive/record-card'
import {
  EMPTY_RECORD_CRITERIA,
  filterRecords,
  type RecordCriteria,
  RecordFilters,
} from '@/components/archive/record-filters'
import { type RecordOrder, RecordOrderToggle } from '@/components/archive/record-order-toggle'
import { SegmentedTabsList } from '@/components/archive/segmented-tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { useAsyncData } from '@/hooks/use-async-data'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { extractAuthorIds, extractParticipantIds, stripMarkup } from '@/lib/markup'
import { recordStableKey } from '@/lib/record-identity'
import { orderRecords } from '@/lib/record-order'
import { loadSupplementalRecords } from '@/services/data'
import type { Person, RecordItem } from '@/types/domain'

const participantCache = new WeakMap<RecordItem, string[]>()
const authorCache = new WeakMap<RecordItem, string[]>()
const personRecordModes = [
  { value: 'participated', label: '参与的事件' },
  { value: 'authored', label: '记录的事件' },
] as const

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
  const signed = useSignedAsset(remote ? '' : person.avatarUrl, {
    variant: 'preview',
    width: 384,
    quality: 76,
  })
  const src = remote ? person.avatarUrl : signed.src
  const label = stripMarkup(person.name || person.id) || person.id
  const avatar = (
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
  if (!src) return avatar
  return (
    <ImageViewer
      path={remote ? '' : person.avatarUrl}
      initialUrl={src}
      alt={`${label}的头像`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          className={`${interactiveSurfaceVariants({ kind: 'media' })} h-auto w-full max-w-48 justify-start rounded-xl p-0`}
          aria-label={`查看${label}的头像大图`}
        >
          {avatar}
        </Button>
      }
    />
  )
}

export function PersonPage() {
  const [params] = useSearchParams()
  const id = params.get('id') || ''
  const [mode, setMode] = useState('participated')
  const [criteria, setCriteria] = useState<RecordCriteria>(EMPTY_RECORD_CRITERIA)
  const [recordOrder, setRecordOrder] = useState<RecordOrder>('descending')
  const resource = useArchive()
  const supplementalResource = useAsyncData(() => loadSupplementalRecords())
  const person = resource.data?.people.find((item) => item.id === id)
  const relatedSources = useMemo(
    () => [...(resource.data?.records || []), ...(supplementalResource.data || [])],
    [resource.data?.records, supplementalResource.data],
  )
  const participatedRecords = useMemo(
    () => relatedSources.filter((record) => participantIds(record).includes(id)),
    [id, relatedSources],
  )
  const authoredRecords = useMemo(
    () => relatedSources.filter((record) => authorIds(record).includes(id)),
    [id, relatedSources],
  )
  const allRelated = mode === 'authored' ? authoredRecords : participatedRecords
  const related = useMemo(
    () =>
      orderRecords(filterRecords(allRelated, criteria), recordOrder, (left, right) =>
        recordStableKey(left).localeCompare(recordStableKey(right)),
      ),
    [allRelated, criteria, recordOrder],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: same-route person links must reset view-local controls when the URL id changes.
  useEffect(() => {
    setMode('participated')
    setCriteria(EMPTY_RECORD_CRITERIA)
    setRecordOrder('descending')
  }, [id])

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
          返回人物
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
          description="请从人物页重新打开。"
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
        <div className="flex flex-wrap items-center gap-2">
          {authoredRecords.length > 0 && (
            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value)
                setCriteria(EMPTY_RECORD_CRITERIA)
              }}
            >
              <SegmentedTabsList
                value={mode as (typeof personRecordModes)[number]['value']}
                items={personRecordModes}
                ariaLabel="人物相关记录模式"
              />
            </Tabs>
          )}
          <RecordOrderToggle
            value={recordOrder}
            onValueChange={setRecordOrder}
            ariaLabel="人物相关记录显示顺序"
          />
        </div>
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
      <div className="grid gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow)">
        {related.length ? (
          related.map((record) => <RecordCard record={record} key={recordStableKey(record)} />)
        ) : (
          <EmptyState title="暂时没有相关记录" />
        )}
      </div>
    </div>
  )
}
