import { Eye, FileImage, List, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { ImageViewer } from '@/components/archive/image-viewer'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { useAsyncData } from '@/hooks/use-async-data'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { normalizeRecordKey } from '@/lib/archive'
import { consumeRecordJump, type PendingRecordJump } from '@/lib/record-navigation'
import {
  hasAdminAccess,
  loadPageMessages,
  loadPageSupplements,
  loadRecordPages,
  loadRecords,
} from '@/services/data'
import type { PageMessage, PageSupplement, RecordItem, RecordPage } from '@/types/domain'

function criteriaFromSearch(params: URLSearchParams): RecordCriteria {
  return {
    year: params.get('year') || '',
    month: params.get('month') || '',
    day: params.get('day') || '',
    important: ['1', 'true'].includes(params.get('important') || ''),
    excludeDaily: ['1', 'true'].includes(params.get('excludeDaily') || ''),
    query: params.get('q') || '',
  }
}

function sameCriteria(left: RecordCriteria, right: RecordCriteria) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.important === right.important &&
    left.excludeDaily === right.excludeDaily &&
    left.query === right.query
  )
}

function withinPage(page: RecordPage, record: RecordItem, records: RecordItem[]) {
  const ordered = records.map((item) => normalizeRecordKey(item.fileName || item.id))
  const index = ordered.indexOf(normalizeRecordKey(record.fileName || record.id))
  const start = ordered.indexOf(normalizeRecordKey(page.startFile))
  const end = ordered.indexOf(normalizeRecordKey(page.endFile))
  return (
    index >= 0 &&
    start >= 0 &&
    end >= 0 &&
    index >= Math.min(start, end) &&
    index <= Math.max(start, end)
  )
}

function pageDate(page: RecordPage, records: RecordItem[]) {
  return records.find((record) => withinPage(page, record, records))?.date || ''
}

function supplementalRecords(
  pages: RecordPage[],
  records: RecordItem[],
  messages: PageMessage[],
  supplements: PageSupplement[],
) {
  const dates = new Map(pages.map((page) => [page.page, pageDate(page, records)]))
  const messageRecords: RecordItem[] = messages.map((item, index) => ({
    id: `message-${item.page || index + 1}`,
    fileName: `message-${item.page || index + 1}`,
    recordIndex: index,
    date: dates.get(item.page) || '',
    time: '',
    author: item.author,
    recorder: item.author,
    content: item.content,
    text: item.content,
    importance: 'normal',
    attachments: [],
    hidden: false,
    recordType: 'message',
    page: item.page,
  }))
  const supplementRecords: RecordItem[] = supplements.map((item) => ({
    id: item.id,
    fileName: item.fileName || item.id,
    recordIndex: item.supplementIndex,
    date: item.date || dates.get(item.page) || '',
    time: item.time,
    author: item.author,
    recorder: item.author,
    content: item.content,
    text: item.content,
    importance: item.importance || 'normal',
    attachments: [],
    hidden: item.hidden,
    recordType: 'supplement',
    page: item.page,
    supplementIndex: item.supplementIndex,
  }))
  return [...messageRecords, ...supplementRecords]
}

function WrittenRecordPages({
  pages,
  records,
  matched,
  messages,
  supplements,
  activeFilter,
  pageIndex,
  hidden,
  onPageChange,
}: {
  pages: RecordPage[]
  records: RecordItem[]
  matched: RecordItem[]
  messages: PageMessage[]
  supplements: PageSupplement[]
  activeFilter: boolean
  pageIndex: number
  hidden: boolean
  onPageChange: (next: number) => void
}) {
  const visiblePages = pages.filter((page) => {
    if (!activeFilter) return Boolean(page.imagePath)
    return matched.some((record) =>
      record.recordType ? String(record.page) === page.page : withinPage(page, record, records),
    )
  })
  const safeIndex = Math.min(pageIndex, Math.max(0, visiblePages.length - 1))
  const page = visiblePages[safeIndex]
  if (!page)
    return <EmptyState title={hidden ? '没有可展示的隐藏书面页' : '当前条件下没有手写页'} />

  const pageRecords = matched.filter(
    (record) => !record.recordType && withinPage(page, record, records),
  )
  const pageMessage = messages.find((item) => item.page === page.page)
  const pageSupplements = supplements.filter((item) => item.page === page.page)
  const previousPath = visiblePages[safeIndex - 1]?.imagePath || ''
  const nextPath = visiblePages[safeIndex + 1]?.imagePath || ''

  return (
    <Card>
      <CardContent className="pt-4">
        <PageImagePreloader previousPath={previousPath} nextPath={nextPath} />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={safeIndex <= 0}
            onClick={() => onPageChange(safeIndex - 1)}
          >
            上一页
          </Button>
          <div className="flex items-center gap-2">
            <strong className="text-sm">
              {hidden ? '隐藏 ' : ''}第 {page.page} 页 · {safeIndex + 1}/{visiblePages.length}
            </strong>
            <Select
              value={String(safeIndex)}
              onValueChange={(value) => onPageChange(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="跳转书面页" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visiblePages.map((item, index) => (
                  <SelectItem key={item.page} value={String(index)}>
                    第 {item.page} 页
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={safeIndex >= visiblePages.length - 1}
            onClick={() => onPageChange(safeIndex + 1)}
          >
            下一页
          </Button>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,.92fr)]">
          <ImageViewer
            path={page.imagePath}
            alt={`${hidden ? '隐藏' : '手写'}记录第 ${page.page} 页`}
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full overflow-hidden border bg-muted/40 p-2"
              >
                <SignedPageImage path={page.imagePath} page={page.page} />
              </Button>
            }
          />
          <div className="grid content-start gap-4">
            {pageMessage &&
              (!activeFilter ||
                matched.some(
                  (item) => item.recordType === 'message' && item.page === page.page,
                )) && (
                <Card className="bg-muted/45">
                  <CardContent className="pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      箴言{pageMessage.author ? ` · ${pageMessage.author}` : ''}
                    </p>
                    <MarkupContent content={pageMessage.content} />
                  </CardContent>
                </Card>
              )}
            {pageSupplements
              .filter(
                (item) =>
                  !activeFilter ||
                  matched.some(
                    (record) => record.recordType === 'supplement' && record.id === item.id,
                  ),
              )
              .map((item) => {
                const [record] = supplementalRecords([page], records, [], [item])
                return record ? <RecordCard key={item.id} record={record} /> : null
              })}
            {pageRecords.map((record) => (
              <RecordCard key={record.fileName || record.id} record={record} />
            ))}
            {!pageMessage && !pageSupplements.length && !pageRecords.length && (
              <EmptyState title="这张书面页没有对应的文字记录" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SignedPageImage({ path, page }: { path: string; page: string }) {
  const image = useSignedAsset(path)
  if (image.loading) return <PageSkeleton rows={1} />
  if (!image.src) return <ErrorState title="手写页图片加载失败" onRetry={image.retry} />
  return (
    <img
      src={image.src}
      alt={`手写记录第 ${page} 页`}
      onError={() => void image.retry()}
      className="mx-auto max-h-[72vh] w-auto object-contain"
    />
  )
}

function PageImagePreloader({
  previousPath,
  nextPath,
}: {
  previousPath: string
  nextPath: string
}) {
  const previous = useSignedAsset(previousPath, { refresh: false })
  const next = useSignedAsset(nextPath, { refresh: false })
  useEffect(() => {
    for (const src of [previous.src, next.src].filter(Boolean)) {
      const image = new Image()
      image.decoding = 'async'
      image.src = src
    }
  }, [next.src, previous.src])
  return null
}

export function RecordsPage() {
  const archive = useArchive()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'list' | 'written'>(
    params.get('view') === 'written' ? 'written' : 'list',
  )
  const [criteria, setCriteria] = useState<RecordCriteria>(() => criteriaFromSearch(params))
  const [hidden, setHidden] = useState(false)
  const [hiddenRecords, setHiddenRecords] = useState<RecordItem[]>([])
  const [hiddenError, setHiddenError] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const pendingJump = useRef<PendingRecordJump | null>(
    consumeRecordJump() ||
      (window.location.hash
        ? {
            targetAnchorId: decodeURIComponent(window.location.hash.slice(1)),
            originHref: '',
            createdAt: Date.now(),
          }
        : null),
  )
  const observedLocationKey = useRef(location.key)
  const observedHash = useRef(location.hash)
  const [jumpRevision, setJumpRevision] = useState(0)
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false)
  const [jumpOriginHref, setJumpOriginHref] = useState('')
  const written = useAsyncData(async () => {
    const [pages, messages, supplements] = await Promise.all([
      loadRecordPages(hidden),
      hidden ? Promise.resolve([]) : loadPageMessages(),
      loadPageSupplements({ hidden }),
    ])
    return { pages, messages, supplements }
  }, [hidden])

  useEffect(() => {
    document.title = '编日史 · 记录'
  }, [])
  useEffect(() => {
    const nextView = params.get('view') === 'written' ? 'written' : 'list'
    const nextCriteria = criteriaFromSearch(params)
    setView((current) => (current === nextView ? current : nextView))
    setCriteria((current) => (sameCriteria(current, nextCriteria) ? current : nextCriteria))
  }, [params])
  useEffect(() => {
    if (observedLocationKey.current === location.key) return
    observedLocationKey.current = location.key
    const hashChanged = observedHash.current !== location.hash
    observedHash.current = location.hash
    const next =
      consumeRecordJump() ||
      (hashChanged && location.hash
        ? {
            targetAnchorId: decodeURIComponent(location.hash.slice(1)),
            originHref: '',
            createdAt: Date.now(),
          }
        : null)
    if (!next) return
    pendingJump.current = next
    setJumpRevision((value) => value + 1)
  }, [location.hash, location.key])
  useEffect(() => {
    let buffer = ''
    const listener = async (event: KeyboardEvent) => {
      const active = document.activeElement
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      buffer = (buffer + event.key.toLowerCase()).slice(-16)
      if (!buffer.endsWith('qibaishihuaxia')) return
      buffer = ''
      try {
        if (!(await hasAdminAccess())) return
        setHiddenRecords(await loadRecords({ hidden: true }))
        setHidden(true)
        setCriteria(EMPTY_RECORD_CRITERIA)
      } catch {
        setHiddenError('隐藏记录暂时无法加载，请稍后重试。')
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const records = hidden ? hiddenRecords : archive.data?.records || []
  const extras = useMemo(
    () =>
      written.data
        ? supplementalRecords(
            written.data.pages,
            records,
            written.data.messages,
            written.data.supplements,
          )
        : [],
    [records, written.data],
  )
  const sources = view === 'written' ? [...records, ...extras] : records
  const filtered = useMemo(
    () => filterRecords(sources, criteria).sort((a, b) => b.id.localeCompare(a.id)),
    [criteria, sources],
  )
  const activeFilter = Object.values(criteria).some(Boolean)

  useEffect(() => {
    const next = new URLSearchParams()
    if (view === 'written') next.set('view', view)
    if (criteria.query) next.set('q', criteria.query)
    if (criteria.year) next.set('year', criteria.year)
    if (criteria.month) next.set('month', criteria.month)
    if (criteria.day) next.set('day', criteria.day)
    if (criteria.important) next.set('important', '1')
    if (criteria.excludeDaily) next.set('excludeDaily', '1')
    const current = new URLSearchParams(window.location.search)
    if (next.toString() !== current.toString()) setParams(next, { replace: true })
  }, [criteria, setParams, view])

  const loading = !hidden && (!archive.data || archive.loading)

  // biome-ignore lint/correctness/useExhaustiveDependencies: jumpRevision re-runs the locator after a same-page route stores a new pending jump in the ref.
  useEffect(() => {
    const pending = pendingJump.current
    if (loading || view !== 'list' || !pending || !filtered.length) return
    const target = document.getElementById(pending.targetAnchorId)
    if (!target) return
    pendingJump.current = null
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background')
    const timer = window.setTimeout(
      () =>
        target.classList.remove(
          'ring-2',
          'ring-primary',
          'ring-offset-2',
          'ring-offset-background',
        ),
      3200,
    )
    if (pending.originHref) {
      setJumpOriginHref(pending.originHref)
      setJumpDialogOpen(true)
    }
    return () => window.clearTimeout(timer)
  }, [filtered, jumpRevision, loading, view])

  const returnToOrigin = () => {
    if (!jumpOriginHref) return
    try {
      const url = new URL(jumpOriginHref)
      if (url.origin === window.location.origin) window.location.assign(url.href)
    } catch {
      // Ignore malformed session data.
    }
  }
  return (
    <div>
      <PageHeading
        title="记录"
        description="按日期、关键词与重要程度浏览班级共同经历；列表与原始手写页可以随时切换。"
        actions={
          <Tabs
            value={view}
            onValueChange={(value) => {
              setView(value as 'list' | 'written')
              setPageIndex(0)
            }}
          >
            <TabsList>
              <TabsTrigger value="list">
                <List data-icon="inline-start" />
                列表
              </TabsTrigger>
              <TabsTrigger value="written">
                <FileImage data-icon="inline-start" />
                手写页
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <Alert className="mb-5 bg-card/65">
        <ShieldAlert />
        <AlertTitle>仅供班级内部查看</AlertTitle>
        <AlertDescription>请尊重档案中的个人信息与共同记忆，不要外传。</AlertDescription>
      </Alert>
      {hidden && (
        <Alert className="mb-5">
          <Eye />
          <AlertTitle>隐藏记录模式</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            仅本次会话可见，刷新后恢复普通记录。
            <Button size="xs" variant="outline" onClick={() => setHidden(false)}>
              退出
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {hiddenError && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{hiddenError}</AlertDescription>
        </Alert>
      )}
      <RecordFilters
        records={sources}
        value={criteria}
        onChange={(value) => {
          setCriteria(value)
          setPageIndex(0)
        }}
      />
      {loading && <PageSkeleton rows={5} />}
      {archive.error && !hidden && <ErrorState title="记录加载失败" onRetry={archive.retry} />}
      {!loading && (!archive.error || hidden) && view === 'list' && (
        <div className="grid gap-4">
          {filtered.length ? (
            filtered.map((record) => (
              <RecordCard key={record.fileName || record.id} record={record} />
            ))
          ) : (
            <EmptyState title="没有匹配的记录" />
          )}
        </div>
      )}
      {!loading &&
        (!archive.error || hidden) &&
        view === 'written' &&
        (written.loading ? (
          <PageSkeleton rows={2} />
        ) : written.error || !written.data ? (
          <ErrorState title="书面记录加载失败" onRetry={written.retry} />
        ) : (
          <WrittenRecordPages
            pages={written.data.pages}
            records={records}
            matched={filtered}
            messages={written.data.messages}
            supplements={written.data.supplements}
            activeFilter={activeFilter}
            pageIndex={pageIndex}
            hidden={hidden}
            onPageChange={setPageIndex}
          />
        ))}
      <AlertDialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>已定位到来源记录</AlertDialogTitle>
            <AlertDialogDescription>
              你可以留在记录页继续浏览，或返回刚才的页面。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>留在这里</AlertDialogCancel>
            <AlertDialogAction onClick={returnToOrigin}>返回上一页</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
