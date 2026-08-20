import { Eye, FileImage, List } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { ImageViewer } from '@/components/archive/image-viewer'
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
import { Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useAsyncData } from '@/hooks/use-async-data'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { normalizeRecordKey } from '@/lib/archive'
import { recordAnchor } from '@/lib/markup'
import { buildSupplementalRecords } from '@/lib/record-identity'
import {
  beginRecordJump,
  completeRecordJump,
  consumeRecordJump,
  decodeRecordHash,
  type PendingRecordJump,
  replaceRecordJumpHash,
} from '@/lib/record-navigation'
import { compareRecordId, compareRecordNumber, orderRecords } from '@/lib/record-order'
import {
  clampWindowScrollTop,
  scrollTargetIntoView,
  waitForWindowScrollEnd,
} from '@/lib/viewport-scroll'
import {
  hasAdminAccess,
  loadPageMessages,
  loadPageSupplements,
  loadRecordPages,
  loadRecords,
} from '@/services/data'

import { rememberImageDimensions, useImageDimensions } from '@/services/image-metadata'
import type { PageMessage, PageSupplement, RecordItem, RecordPage } from '@/types/domain'

const recordViewItems = [
  { value: 'list', label: '按条记录', icon: List },
  { value: 'written', label: '书面记录', icon: FileImage },
] as const

const JUMP_HIGHLIGHT_HOLD_MS = 520
const JUMP_HIGHLIGHT_FADE_MS = 680

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

function recordsSearch(view: 'list' | 'written', criteria: RecordCriteria) {
  const next = new URLSearchParams()
  if (view === 'written') next.set('view', 'written')
  if (criteria.query) next.set('q', criteria.query)
  if (criteria.year) next.set('year', criteria.year)
  if (criteria.month) next.set('month', criteria.month)
  if (criteria.day) next.set('day', criteria.day)
  if (criteria.important) next.set('important', '1')
  if (criteria.excludeDaily) next.set('excludeDaily', '1')
  return next.toString() ? `?${next}` : ''
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
  onRecordReference,
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
  onRecordReference: (recordId: string, source: HTMLElement) => void
}) {
  const visiblePages = pages.filter((page) => {
    if (!activeFilter) return Boolean(page.imagePath)
    return matched.some((record) =>
      record.recordType ? String(record.page) === page.page : withinPage(page, record, records),
    )
  })
  const safeIndex = Math.max(0, Math.min(pageIndex, Math.max(0, visiblePages.length - 1)))
  const page = visiblePages[safeIndex]
  if (!page)
    return <EmptyState title={hidden ? '没有可展示的隐藏书面页' : '当前条件下没有手写页'} />

  const pageRecords = orderRecords(
    matched.filter((record) => !record.recordType && withinPage(page, record, records)),
    'ascending',
    compareRecordNumber,
  )
  const pageMessage = messages.find((item) => item.page === page.page)
  const pageSupplements = supplements
    .filter((item) => item.page === page.page)
    .sort(
      (left, right) =>
        left.supplementIndex - right.supplementIndex ||
        left.id.localeCompare(right.id, 'zh-CN', { numeric: true }),
    )
  const previousPath = visiblePages[safeIndex - 1]?.imagePath || ''
  const nextPath = visiblePages[safeIndex + 1]?.imagePath || ''

  return (
    <Card className="overflow-visible">
      <CardContent>
        <PageImagePreloader previousPath={previousPath} nextPath={nextPath} />
        <div className="mb-5 grid grid-cols-2 items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3">
          <Button
            variant="outline"
            className="order-2 w-full sm:order-1 sm:w-auto"
            disabled={safeIndex <= 0}
            onClick={() => onPageChange(safeIndex - 1)}
          >
            上一页
          </Button>
          <div className="order-1 col-span-2 flex min-w-0 flex-wrap items-center justify-center gap-2 sm:order-2 sm:col-span-1">
            <strong className="text-center text-sm leading-5">
              {hidden ? '隐藏 ' : ''}第 {page.page} 页 · {safeIndex + 1}/{visiblePages.length}
            </strong>
            <Select
              value={page.page}
              onValueChange={(value) => {
                const nextIndex = visiblePages.findIndex((item) => item.page === value)
                if (nextIndex >= 0) onPageChange(nextIndex)
              }}
            >
              <SelectTrigger size="sm" aria-label="跳转书面页" className="w-28 bg-background/85">
                <SelectValue>
                  {(value) => (typeof value === 'string' ? `第 ${value} 页` : '选择页码')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {visiblePages.map((item) => (
                  <SelectItem key={item.page} value={item.page}>
                    第 {item.page} 页
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="order-3 w-full sm:w-auto"
            disabled={safeIndex >= visiblePages.length - 1}
            onClick={() => onPageChange(safeIndex + 1)}
          >
            下一页
          </Button>
        </div>
        <div
          key={page.imagePath}
          className="grid items-start gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow) lg:grid-cols-[minmax(20rem,42%)_minmax(0,1fr)]"
        >
          <div className="min-h-0 self-start lg:sticky lg:top-20">
            <SignedPageImage
              key={page.imagePath}
              path={page.imagePath}
              page={page.page}
              hidden={hidden}
            />
          </div>
          <div className="grid content-start gap-4">
            {pageMessage &&
              (!activeFilter ||
                matched.some((item) => item.recordType === 'message' && item.page === page.page)) &&
              buildSupplementalRecords([pageMessage], []).map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onRecordReference={onRecordReference}
                  showSourceAction={false}
                />
              ))}
            {pageSupplements
              .filter(
                (item) =>
                  !activeFilter ||
                  matched.some(
                    (record) =>
                      record.recordType === 'supplement' &&
                      record.page === item.page &&
                      record.supplementIndex === item.supplementIndex,
                  ),
              )
              .map((item) => {
                const [record] = buildSupplementalRecords([], [item])
                return record ? (
                  <RecordCard
                    key={item.id}
                    record={record}
                    onRecordReference={onRecordReference}
                    showSourceAction={false}
                  />
                ) : null
              })}
            {pageRecords.map((record) => (
              <RecordCard
                key={record.fileName || record.id}
                record={record}
                onRecordReference={onRecordReference}
                showSourceAction={false}
              />
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

function SignedPageImage({ path, page, hidden }: { path: string; page: string; hidden: boolean }) {
  const image = useSignedAsset(path, { variant: 'preview', width: 1200 })
  const imageFailure = useBoundedImageRetry(path, image.retry)
  const dimensions = useImageDimensions(path, true, 1200) || { width: 2856, height: 4282 }
  const [ready, setReady] = useState(false)
  const ratio = dimensions.width / dimensions.height
  const preview = (
    <div
      className="relative mx-auto grid max-w-full place-items-center overflow-hidden rounded-md bg-transparent"
      style={{
        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
        width: `min(100%, calc((100svh - 6rem) * ${ratio}))`,
      }}
      aria-busy={!ready && !image.error && !imageFailure.failed}
    >
      {!ready && !image.error && !imageFailure.failed && <Spinner className="size-7" />}
      {(imageFailure.failed || (image.error && !image.src)) && (
        <div className="grid gap-1 px-4 text-center text-sm text-muted-foreground">
          <p>手写页图片加载失败。</p>
          <span className="text-meta text-primary">打开大图后可重试</span>
        </div>
      )}
      {image.src && (
        <img
          key={image.src}
          src={image.src}
          width={dimensions.width}
          height={dimensions.height}
          alt={`手写记录第 ${page} 页`}
          decoding="async"
          fetchPriority="high"
          onLoad={(event) => {
            rememberImageDimensions(path, {
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
            imageFailure.markLoaded()
            setReady(true)
          }}
          onError={() => {
            setReady(false)
            imageFailure.markFailed()
          }}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-(--interaction-duration-slow) ${ready && !imageFailure.failed ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
  return (
    <ImageViewer
      path={path}
      initialUrl={image.src}
      initialDimensions={dimensions}
      alt={`${hidden ? '隐藏' : '手写'}记录第 ${page} 页`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full overflow-hidden rounded-lg border border-border/70 bg-transparent p-0 shadow-none group app-interactive-surface app-interactive-media"
          aria-label={`查看${hidden ? '隐藏' : '手写'}记录第 ${page} 页大图`}
        >
          {preview}
        </Button>
      }
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
  const previous = useSignedAsset(previousPath, { variant: 'preview', width: 1200 })
  const next = useSignedAsset(nextPath, { variant: 'preview', width: 1200 })
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
  const recordsResource = useAsyncData(() => loadRecords())
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [view, setView] = useState<'list' | 'written'>(
    params.get('view') === 'written' ? 'written' : 'list',
  )
  const [criteria, setCriteria] = useState<RecordCriteria>(() => criteriaFromSearch(params))
  const [recordOrder, setRecordOrder] = useState<RecordOrder>('descending')
  const [hidden, setHidden] = useState(false)
  const [hiddenRecords, setHiddenRecords] = useState<RecordItem[]>([])
  const [hiddenError, setHiddenError] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const replaceRouteState = useCallback(
    (nextView: 'list' | 'written', nextCriteria: RecordCriteria) => {
      setView(nextView)
      setCriteria(nextCriteria)
      navigate(
        {
          pathname: '/records',
          search: recordsSearch(nextView, nextCriteria),
          hash: '',
        },
        { replace: true },
      )
    },
    [navigate],
  )
  const pendingJump = useRef<PendingRecordJump | null>(null)
  const initialJumpCaptured = useRef(false)
  const observedLocationKey = useRef(location.key)
  const observedHash = useRef(location.hash)
  const [jumpRevision, setJumpRevision] = useState(0)
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false)
  const [jumpOriginHref, setJumpOriginHref] = useState('')
  const [jumpOrigin, setJumpOrigin] = useState<PendingRecordJump['origin']>()
  const [jumpError, setJumpError] = useState('')
  const pendingReturn = useRef<{ scrollY: number; anchorId: string } | null>(null)
  const jumpFocusTarget = useRef<HTMLElement | null>(null)
  const jumpHighlightTarget = useRef<HTMLElement | null>(null)
  const jumpHighlightTimer = useRef<number | undefined>(undefined)
  const suppressNextLocationJump = useRef(false)
  const written = useAsyncData(async () => {
    if (view !== 'written') return null
    const [pages, messages, supplements] = await Promise.all([
      loadRecordPages(hidden),
      hidden ? Promise.resolve([]) : loadPageMessages(),
      loadPageSupplements({ hidden }),
    ])
    return { pages, messages, supplements }
  }, [hidden, view])

  useLayoutEffect(() => {
    if (initialJumpCaptured.current) return
    initialJumpCaptured.current = true
    const targetAnchorId = decodeRecordHash(location.hash)
    const next =
      consumeRecordJump() ||
      (targetAnchorId ? { targetAnchorId, originHref: '', createdAt: Date.now() } : null)
    if (!next) return
    pendingJump.current = next
    setJumpRevision((value) => value + 1)
  }, [location.hash])
  useEffect(() => {
    const nextView = params.get('view') === 'written' ? 'written' : 'list'
    const nextCriteria = criteriaFromSearch(params)
    setView((current) => (current === nextView ? current : nextView))
    setCriteria((current) => (sameCriteria(current, nextCriteria) ? current : nextCriteria))
  }, [params])
  useEffect(() => {
    if (observedLocationKey.current === location.key) return
    observedLocationKey.current = location.key
    if (suppressNextLocationJump.current) {
      suppressNextLocationJump.current = false
      observedHash.current = location.hash
      return
    }
    const hashChanged = observedHash.current !== location.hash
    observedHash.current = location.hash
    const targetAnchorId = hashChanged ? decodeRecordHash(location.hash) : ''
    const next =
      consumeRecordJump() ||
      (targetAnchorId ? { targetAnchorId, originHref: '', createdAt: Date.now() } : null)
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
        setHiddenError('')
        if (!(await hasAdminAccess())) return
        setHiddenRecords(await loadRecords({ hidden: true }))
        setHidden(true)
        setHiddenError('')
        replaceRouteState(view, EMPTY_RECORD_CRITERIA)
      } catch {
        setHiddenError('隐藏记录暂时无法加载，请稍后重试。')
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [replaceRouteState, view])

  const records = hidden ? hiddenRecords : recordsResource.data || []
  const extras = useMemo(
    () =>
      written.data ? buildSupplementalRecords(written.data.messages, written.data.supplements) : [],
    [written.data],
  )
  const sources = useMemo(
    () => (view === 'written' ? [...records, ...extras] : records),
    [extras, records, view],
  )
  const matched = useMemo(() => filterRecords(sources, criteria), [criteria, sources])
  const filtered = useMemo(
    () => orderRecords(matched, recordOrder, compareRecordId),
    [matched, recordOrder],
  )
  const activeFilter = Object.values(criteria).some(Boolean)
  const recordNavigation = useRef({
    view,
    pageIndex,
    criteria,
    records,
    pages: written.data?.pages || [],
  })
  recordNavigation.current = {
    view,
    pageIndex,
    criteria,
    records,
    pages: written.data?.pages || [],
  }

  const navigateToRecord = useCallback(
    (recordId: string, source: HTMLElement) => {
      const state = recordNavigation.current
      const normalized = normalizeRecordKey(recordId)
      const target = state.records.find(
        (record) => normalizeRecordKey(record.fileName || record.id) === normalized,
      )
      if (!target) {
        setJumpError('未找到要跳转的记录，请检查正文中的记录标记。')
        return
      }

      let targetView = state.view
      let targetPageIndex = state.pageIndex
      if (state.view === 'written') {
        const visiblePages = state.pages.filter((page) => Boolean(page.imagePath))
        const nextIndex = visiblePages.findIndex((page) => withinPage(page, target, state.records))
        if (nextIndex >= 0) targetPageIndex = nextIndex
        else {
          targetView = 'list'
          targetPageIndex = 0
          setJumpError('目标记录没有对应的手写页，已切换到列表并完成定位。')
        }
      }

      const anchor = recordAnchor(target)
      beginRecordJump()
      const sourceRecord = source.closest<HTMLElement>('[id^="record-"]')
      pendingJump.current = {
        targetAnchorId: anchor,
        originHref: '',
        createdAt: Date.now(),
        origin: {
          view: state.view,
          pageIndex: state.pageIndex,
          criteria: { ...state.criteria },
          anchorId: sourceRecord?.id || '',
          scrollY: window.scrollY,
        },
      }
      setCriteria(EMPTY_RECORD_CRITERIA)
      setView(targetView)
      setPageIndex(targetPageIndex)
      setJumpRevision((value) => value + 1)
      suppressNextLocationJump.current = true
      navigate(
        {
          pathname: '/records',
          search: targetView === 'written' ? '?view=written' : '',
          hash: '',
        },
        { replace: true },
      )
    },
    [navigate],
  )

  const navigateToWrittenSource = useCallback(
    (target: RecordItem, source: HTMLElement) => {
      const state = recordNavigation.current
      const anchor = recordAnchor(target)
      beginRecordJump()
      const sourceRecord = source.closest<HTMLElement>('[id^="record-"]')
      const visiblePages = state.pages.filter((page) => Boolean(page.imagePath))
      const knownPageIndex = visiblePages.findIndex((page) =>
        withinPage(page, target, state.records),
      )
      pendingJump.current = {
        targetAnchorId: anchor,
        originHref: '',
        createdAt: Date.now(),
        origin: {
          view: state.view,
          pageIndex: state.pageIndex,
          criteria: { ...state.criteria },
          anchorId: sourceRecord?.id || '',
          scrollY: window.scrollY,
        },
      }
      setJumpError('')
      setCriteria(EMPTY_RECORD_CRITERIA)
      setView('written')
      setPageIndex(knownPageIndex >= 0 ? knownPageIndex : 0)
      setJumpRevision((value) => value + 1)
      suppressNextLocationJump.current = true
      navigate({ pathname: '/records', search: '?view=written', hash: '' }, { replace: true })
    },
    [navigate],
  )

  const loading = !hidden && recordsResource.loading

  const clearJumpHighlight = useCallback((target?: HTMLElement | null) => {
    const current = target || jumpHighlightTarget.current
    if (!current) return
    if (jumpHighlightTimer.current !== undefined) {
      window.clearTimeout(jumpHighlightTimer.current)
      jumpHighlightTimer.current = undefined
    }
    delete current.dataset.recordJumpHighlight
    delete current.dataset.recordJumpFading
    delete current.dataset.recordJumpPendingFade
    if (jumpHighlightTarget.current === current) jumpHighlightTarget.current = null
  }, [])

  const beginJumpHighlight = useCallback((target: HTMLElement) => {
    if (jumpHighlightTimer.current !== undefined) {
      window.clearTimeout(jumpHighlightTimer.current)
      jumpHighlightTimer.current = undefined
    }
    const previous = jumpHighlightTarget.current
    if (previous && previous !== target) {
      delete previous.dataset.recordJumpHighlight
      delete previous.dataset.recordJumpFading
      delete previous.dataset.recordJumpPendingFade
    }
    delete target.dataset.recordJumpFading
    delete target.dataset.recordJumpPendingFade
    target.dataset.recordJumpHighlight = 'true'
    jumpHighlightTarget.current = target
  }, [])

  const fadeJumpHighlight = useCallback((target?: HTMLElement | null) => {
    const current = target || jumpHighlightTarget.current
    if (current?.dataset.recordJumpHighlight !== 'true') return
    if (jumpHighlightTimer.current !== undefined) window.clearTimeout(jumpHighlightTimer.current)
    delete current.dataset.recordJumpFading
    current.dataset.recordJumpPendingFade = 'true'
    jumpHighlightTimer.current = window.setTimeout(() => {
      if (
        jumpHighlightTarget.current !== current ||
        current.dataset.recordJumpHighlight !== 'true'
      ) {
        delete current.dataset.recordJumpPendingFade
        jumpHighlightTimer.current = undefined
        return
      }
      delete current.dataset.recordJumpPendingFade
      current.dataset.recordJumpFading = 'true'
      jumpHighlightTimer.current = window.setTimeout(() => {
        delete current.dataset.recordJumpHighlight
        delete current.dataset.recordJumpFading
        delete current.dataset.recordJumpPendingFade
        if (jumpHighlightTarget.current === current) jumpHighlightTarget.current = null
        jumpHighlightTimer.current = undefined
      }, JUMP_HIGHLIGHT_FADE_MS)
    }, JUMP_HIGHLIGHT_HOLD_MS)
  }, [])

  useEffect(
    () => () => {
      if (jumpHighlightTimer.current !== undefined) window.clearTimeout(jumpHighlightTimer.current)
      if (jumpHighlightTarget.current) {
        delete jumpHighlightTarget.current.dataset.recordJumpHighlight
        delete jumpHighlightTarget.current.dataset.recordJumpFading
        delete jumpHighlightTarget.current.dataset.recordJumpPendingFade
      }
    },
    [],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: jumpRevision re-runs the locator after a same-page route stores a new pending jump in the ref.
  useLayoutEffect(() => {
    const pending = pendingJump.current
    // A same-route list → written navigation renders once before useAsyncData's
    // dependency effect can mark the new written resource as loading. Waiting
    // for actual data (instead of the loading flag alone) keeps the pending
    // anchor alive across that render and matches the legacy load-then-locate
    // sequence.
    if (loading || (view === 'written' && (written.loading || !written.data)) || !pending) return
    const target = document.getElementById(pending.targetAnchorId)
    if (!target) {
      if (view === 'written' && written.data) {
        const targetRecord = [...records, ...extras].find(
          (record) => recordAnchor(record) === pending.targetAnchorId,
        )
        if (targetRecord) {
          const visiblePages = written.data.pages.filter((page) => Boolean(page.imagePath))
          const targetPage = targetRecord.recordType
            ? String(targetRecord.page)
            : visiblePages.find((page) => withinPage(page, targetRecord, records))?.page
          const targetPageIndex = visiblePages.findIndex((page) => page.page === targetPage)
          if (targetPageIndex >= 0 && targetPageIndex !== pageIndex) {
            setPageIndex(targetPageIndex)
            return
          }
        }
      }
      pendingJump.current = null
      completeRecordJump()
      setJumpError('未找到要跳转的记录，请检查来源是否仍然存在。')
      return
    }
    pendingJump.current = null
    jumpFocusTarget.current = target
    const scrollCompletion = new AbortController()
    // The semantic target state starts before movement, so the border is
    // already present as the record enters the viewport. It must not depend on
    // a browser-specific scrollend event that may be skipped after user input.
    beginJumpHighlight(target)
    const destination = scrollTargetIntoView(target, 'smooth')
    replaceRecordJumpHash(pending.targetAnchorId)
    if (pending.originHref) {
      setJumpOriginHref(pending.originHref)
    }
    setJumpOrigin(pending.origin)
    void waitForWindowScrollEnd(destination, scrollCompletion.signal).then((reachedDestination) => {
      if (!scrollCompletion.signal.aborted) {
        completeRecordJump()
        const willOpenDialog = reachedDestination && Boolean(pending.originHref || pending.origin)
        // Modal scroll locking and focus containment must start only after the
        // browser's one smooth movement has settled; otherwise they can cancel
        // the animation and create the apparent overshoot/rebound sequence.
        if (willOpenDialog) setJumpDialogOpen(true)
      }
    })
    return () => {
      scrollCompletion.abort()
    }
  }, [
    beginJumpHighlight,
    extras,
    filtered,
    jumpRevision,
    loading,
    pageIndex,
    records,
    view,
    written.data,
    written.loading,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: filtered/pageIndex are render-completion signals for restoring an exact pre-jump scroll position.
  useLayoutEffect(() => {
    const pending = pendingReturn.current
    if (!pending || loading || (view === 'written' && written.loading)) return
    pendingReturn.current = null
    window.scrollTo({
      top: clampWindowScrollTop(pending.scrollY),
      left: 0,
      behavior: 'auto',
    })
    const originTarget = pending.anchorId ? document.getElementById(pending.anchorId) : null
    if (originTarget) originTarget.focus({ preventScroll: true })
  }, [filtered, loading, pageIndex, view, written.loading])

  const returnToOrigin = () => {
    clearJumpHighlight(jumpFocusTarget.current)
    if (jumpOrigin) {
      jumpFocusTarget.current = null
      pendingReturn.current = {
        scrollY: jumpOrigin.scrollY,
        anchorId: jumpOrigin.anchorId,
      }
      setCriteria(jumpOrigin.criteria)
      setView(jumpOrigin.view)
      setPageIndex(jumpOrigin.pageIndex)
      setJumpDialogOpen(false)
      setJumpOrigin(undefined)
      setJumpOriginHref('')
      suppressNextLocationJump.current = true
      navigate(
        {
          pathname: '/records',
          search: recordsSearch(jumpOrigin.view, jumpOrigin.criteria),
          hash: '',
        },
        { replace: true },
      )
      return
    }
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
          <>
            <Tabs
              value={view}
              onValueChange={(value) => {
                replaceRouteState(value as 'list' | 'written', criteria)
                setPageIndex(0)
              }}
            >
              <SegmentedTabsList value={view} items={recordViewItems} ariaLabel="记录显示模式" />
            </Tabs>
            {view === 'list' && (
              <RecordOrderToggle value={recordOrder} onValueChange={setRecordOrder} />
            )}
          </>
        }
      />
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
      {jumpError && (
        <Alert variant="destructive" className="mb-5" role="alert">
          <AlertDescription className="flex items-center justify-between gap-3">
            {jumpError}
            <Button size="xs" variant="outline" onClick={() => setJumpError('')}>
              关闭
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <RecordFilters
        records={sources}
        value={criteria}
        onChange={(value) => {
          replaceRouteState(view, value)
          setPageIndex(0)
        }}
      />
      {loading && <PageSkeleton rows={5} />}
      {recordsResource.error && !hidden && (
        <ErrorState title="记录加载失败" onRetry={recordsResource.retry} />
      )}
      {!loading && (!recordsResource.error || hidden) && view === 'list' && (
        <div className="grid gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow)">
          {filtered.length ? (
            filtered.map((record) => (
              <RecordCard
                key={record.fileName || record.id}
                record={record}
                onRecordReference={navigateToRecord}
                onSourceAction={navigateToWrittenSource}
              />
            ))
          ) : (
            <EmptyState title="没有匹配的记录" />
          )}
        </div>
      )}
      {!loading &&
        (!recordsResource.error || hidden) &&
        view === 'written' &&
        (written.loading ? (
          <PageSkeleton rows={2} />
        ) : written.error || !written.data ? (
          <ErrorState title="书面记录加载失败" onRetry={written.retry} />
        ) : (
          <WrittenRecordPages
            pages={written.data.pages}
            records={records}
            matched={matched}
            messages={written.data.messages}
            supplements={written.data.supplements}
            activeFilter={activeFilter}
            pageIndex={pageIndex}
            hidden={hidden}
            onPageChange={setPageIndex}
            onRecordReference={navigateToRecord}
          />
        ))}
      <AlertDialog
        open={jumpDialogOpen}
        onOpenChange={setJumpDialogOpen}
        onOpenChangeComplete={(open) => {
          if (!open && jumpFocusTarget.current?.isConnected)
            jumpFocusTarget.current.focus({ preventScroll: true })
        }}
      >
        <AlertDialogContent finalFocus={false}>
          <AlertDialogHeader>
            <AlertDialogTitle>已定位到来源记录</AlertDialogTitle>
            <AlertDialogDescription>
              {jumpOrigin
                ? '你可以留在目标记录，或恢复跳转前的视图、筛选、书面页和滚动位置。'
                : '你可以留在书面记录中继续浏览，或返回刚才的页面。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => fadeJumpHighlight(jumpFocusTarget.current)}>
              留在此处
            </AlertDialogCancel>
            <AlertDialogAction onClick={returnToOrigin}>
              {jumpOrigin ? '返回原位置' : '返回上一页'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
