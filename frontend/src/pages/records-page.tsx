import { Eye, FileImage, List } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
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
import { Tabs } from '@/components/ui/tabs'
import { preloadMarkupIllustrationDimensions } from '@/features/illustrations/route-illustration-gate'
import { useContentPreferences } from '@/features/preferences/content-preferences'
import { useRecordJumpHighlight } from '@/features/records/use-record-jump-highlight'
import { loadWrittenRecordData } from '@/features/records/written-record-data'
import { WrittenRecordPages } from '@/features/records/written-record-pages'
import { useAsyncData } from '@/hooks/use-async-data'
import { normalizeRecordKey } from '@/lib/archive'
import { recordAnchor } from '@/lib/markup'
import { recordStableKey } from '@/lib/record-identity'
import {
  beginRecordJump,
  completeRecordJump,
  consumeRecordJump,
  decodeRecordHash,
  type PendingRecordJump,
  replaceRecordJumpHash,
} from '@/lib/record-navigation'
import {
  buildRecordStream,
  orderedRecordStream,
  type RecordPagePosition,
  recordPageKey,
  writtenStreamPages,
} from '@/lib/record-stream'
import {
  clampWindowScrollTop,
  scrollTargetIntoView,
  waitForWindowScrollEnd,
} from '@/lib/viewport-scroll'
import { hasAdminAccess, loadRecordStreamData } from '@/services/data'
import type { RecordItem } from '@/types/domain'

const recordViewItems = [
  { value: 'list', label: '按条记录', icon: List },
  { value: 'written', label: '书面记录', icon: FileImage },
] as const

function RecordViewControls({
  view,
  recordOrder,
  onViewChange,
  onRecordOrderChange,
}: {
  view: 'list' | 'written'
  recordOrder: RecordOrder
  onViewChange: (value: 'list' | 'written') => void
  onRecordOrderChange: (value: RecordOrder) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const orderRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const mode = modeRef.current
    const order = orderRef.current
    if (!root || !mode || !order) return
    const update = () => {
      const modeRight = mode.offsetLeft + mode.offsetWidth
      const orderRight = order.offsetLeft + order.offsetWidth
      root.style.setProperty('--record-view-shift-x', `${orderRight - modeRight}px`)
      root.style.setProperty('--record-view-shift-y', `${order.offsetTop - mode.offsetTop}px`)
      root.style.setProperty(
        '--record-view-controls-height',
        `${Math.max(mode.offsetTop + mode.offsetHeight, order.offsetTop + order.offsetHeight)}px`,
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    observer.observe(mode)
    observer.observe(order)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="record-view-controls" data-view={view}>
      <div ref={modeRef} className="record-view-mode-control">
        <Tabs value={view} onValueChange={(value) => onViewChange(value as 'list' | 'written')}>
          <SegmentedTabsList
            value={view}
            items={recordViewItems}
            ariaLabel="记录显示模式"
            triggerClassName="px-2 sm:px-3"
          />
        </Tabs>
      </div>
      <div
        ref={orderRef}
        className="record-view-order-control"
        aria-hidden={view === 'written' || undefined}
        inert={view === 'written' || undefined}
      >
        <RecordOrderToggle value={recordOrder} onValueChange={onRecordOrderChange} />
      </div>
    </div>
  )
}

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

export function RecordsPage() {
  const { hideProfanity } = useContentPreferences()
  const recordsResource = useAsyncData(() => loadRecordStreamData())
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [view, setView] = useState<'list' | 'written'>('list')
  const [criteria, setCriteria] = useState<RecordCriteria>(() => criteriaFromSearch(params))
  const [recordOrder, setRecordOrder] = useState<RecordOrder>('descending')
  const [hidden, setHidden] = useState(false)
  const [hiddenData, setHiddenData] = useState<{
    records: RecordItem[]
    positions: RecordPagePosition[]
  } | null>(null)
  const [hiddenError, setHiddenError] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const replaceRouteState = useCallback(
    (nextView: 'list' | 'written', nextCriteria: RecordCriteria) => {
      const permittedView = hidden ? nextView : 'list'
      setView(permittedView)
      setCriteria(nextCriteria)
      navigate(
        {
          pathname: '/records',
          search: recordsSearch(permittedView, nextCriteria),
          hash: '',
        },
        { replace: true },
      )
    },
    [hidden, navigate],
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
  const suppressNextLocationJump = useRef(false)
  const {
    focusTarget: jumpFocusTarget,
    clearHighlight: clearJumpHighlight,
    beginHighlight: beginJumpHighlight,
    fadeHighlight: fadeJumpHighlight,
  } = useRecordJumpHighlight()
  const written = useAsyncData(async () => {
    if (!hidden || view !== 'written') return null
    return loadWrittenRecordData()
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
    const nextView = hidden && params.get('view') === 'written' ? 'written' : 'list'
    const nextCriteria = criteriaFromSearch(params)
    setView((current) => (current === nextView ? current : nextView))
    setCriteria((current) => (sameCriteria(current, nextCriteria) ? current : nextCriteria))
    if (!hidden && params.has('view')) {
      const nextParams = new URLSearchParams(params)
      nextParams.delete('view')
      navigate(
        { pathname: '/records', search: nextParams.toString() ? `?${nextParams}` : '', hash: '' },
        { replace: true },
      )
    }
  }, [hidden, navigate, params])
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
    let active = true
    let unlocking = false
    const listener = async (event: KeyboardEvent) => {
      const element = document.activeElement
      if (element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      buffer = (buffer + event.key.toLowerCase()).slice(-16)
      if (!buffer.endsWith('qibaishihuaxia') || unlocking || hidden) return
      unlocking = true
      buffer = ''
      try {
        setHiddenError('')
        if (!(await hasAdminAccess())) return
        const nextData = await loadRecordStreamData(true)
        await preloadMarkupIllustrationDimensions(nextData.records.map((record) => record.content))
        if (!active) return
        setHiddenData(nextData)
        setHidden(true)
        setHiddenError('')
        replaceRouteState('list', EMPTY_RECORD_CRITERIA)
      } catch {
        if (active) setHiddenError('隐藏记录暂时无法加载，请稍后重试。')
      } finally {
        unlocking = false
      }
    }
    window.addEventListener('keydown', listener)
    return () => {
      active = false
      window.removeEventListener('keydown', listener)
    }
  }, [hidden, replaceRouteState])

  const streamData = hidden ? hiddenData : recordsResource.data
  const stream = useMemo(
    () => buildRecordStream(streamData?.records || [], streamData?.positions || [], hidden),
    [hidden, streamData],
  )
  const writtenPages = useMemo(
    () => writtenStreamPages(written.data?.pages || [], stream),
    [written.data, stream],
  )
  const records = useMemo(() => orderedRecordStream(stream), [stream])
  const sources = records
  const matched = useMemo(
    () => filterRecords(sources, criteria, hideProfanity),
    [criteria, hideProfanity, sources],
  )
  const filtered = useMemo(
    () => (recordOrder === 'descending' ? [...matched].reverse() : matched),
    [matched, recordOrder],
  )
  const activeFilter = Object.values(criteria).some(Boolean)
  const recordNavigation = useRef({
    view,
    pageIndex,
    criteria,
    records,
    pages: writtenPages,
    stream,
  })
  recordNavigation.current = {
    view,
    pageIndex,
    criteria,
    records,
    pages: writtenPages,
    stream,
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
        const visiblePages = state.pages
        const nextIndex = visiblePages.findIndex((page) =>
          state.stream
            .find((group) => group.page === recordPageKey(page.page))
            ?.records.includes(target),
        )
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
      const visiblePages = state.pages
      const knownPageIndex = visiblePages.findIndex((page) =>
        state.stream
          .find((group) => group.page === recordPageKey(page.page))
          ?.records.includes(target),
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: jumpRevision re-runs the locator after a same-page route stores a new pending jump in the ref.
  useLayoutEffect(() => {
    const pending = pendingJump.current
    // A same-route list → written navigation renders once before useAsyncData's
    // dependency effect can mark the new written resource as loading. Waiting
    // for actual data (instead of the loading flag alone) keeps the pending
    // anchor alive until its page has mounted.
    if (loading || (view === 'written' && (written.loading || !written.data)) || !pending) return
    const target = document.getElementById(pending.targetAnchorId)
    if (!target) {
      if (view === 'written' && written.data) {
        const targetRecord = records.find(
          (record) => recordAnchor(record) === pending.targetAnchorId,
        )
        if (targetRecord) {
          const visiblePages = writtenPages
          const targetPage = targetRecord.recordType
            ? String(targetRecord.page)
            : visiblePages.find((page) =>
                stream
                  .find((group) => group.page === recordPageKey(page.page))
                  ?.records.includes(targetRecord),
              )?.page
          const targetPageIndex = visiblePages.findIndex(
            (page) => recordPageKey(page.page) === recordPageKey(targetPage || ''),
          )
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
    filtered,
    jumpRevision,
    loading,
    pageIndex,
    records,
    stream,
    view,
    written.data,
    writtenPages,
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
        description="按日期、关键词与重要程度浏览班级共同经历。"
        actions={
          hidden ? (
            <RecordViewControls
              view={view}
              recordOrder={recordOrder}
              onViewChange={(value) => {
                replaceRouteState(value, criteria)
                setPageIndex(0)
              }}
              onRecordOrderChange={setRecordOrder}
            />
          ) : (
            <RecordOrderToggle value={recordOrder} onValueChange={setRecordOrder} />
          )
        }
      />
      {hidden && (
        <Alert className="mb-5">
          <Eye />
          <AlertTitle>隐藏记录模式</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            显示全部记录（含隐藏内容）；退出或刷新后恢复未隐藏记录。
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setHidden(false)
                setHiddenData(null)
                replaceRouteState('list', criteria)
                setPageIndex(0)
              }}
            >
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
                key={recordStableKey(record)}
                record={record}
                onRecordReference={navigateToRecord}
                onSourceAction={hidden ? navigateToWrittenSource : undefined}
                showSourceAction={hidden}
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
            pages={writtenPages}
            stream={stream}
            matched={matched}
            activeFilter={activeFilter}
            pageIndex={pageIndex}
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
            <AlertDialogAction onClick={returnToOrigin}>返回</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
