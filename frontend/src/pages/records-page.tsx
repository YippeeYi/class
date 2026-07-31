import { Eye, FileImage, List, Search, ShieldAlert, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { RecordCard } from '@/components/archive/record-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { normalizeRecordKey, normalizeText, unique } from '@/lib/archive'
import { stripMarkup } from '@/lib/markup'
import { hasAdminAccess, loadRecordPages, loadRecords, signAssetUrl } from '@/services/data'
import type { RecordItem, RecordPage } from '@/types/domain'

function SignedPageImage({ page }: { page: RecordPage }) {
  const image = useAsyncData(() => signAssetUrl(page.imagePath), [page.imagePath])
  if (image.loading) return <PageSkeleton rows={1} />
  if (!image.data) return <ErrorState title="手写页图片加载失败" onRetry={image.retry} />
  return (
    <img
      src={image.data}
      alt={`手写记录第 ${page.page} 页`}
      className="mx-auto max-h-[72vh] w-auto rounded-xl object-contain shadow-lg"
    />
  )
}

function withinPage(page: RecordPage, record: RecordItem, records: RecordItem[]) {
  const key = normalizeRecordKey(record.fileName || record.id)
  const ordered = records.map((item) => normalizeRecordKey(item.fileName || item.id))
  const start = ordered.indexOf(normalizeRecordKey(page.startFile))
  const end = ordered.indexOf(normalizeRecordKey(page.endFile))
  const index = ordered.indexOf(key)
  return (
    index >= 0 &&
    start >= 0 &&
    end >= 0 &&
    index >= Math.min(start, end) &&
    index <= Math.max(start, end)
  )
}

function WrittenRecordPages({
  filtered,
  records,
  pageIndex,
  onPageChange,
}: {
  filtered: RecordItem[]
  records: RecordItem[]
  pageIndex: number
  onPageChange: (next: number) => void
}) {
  const pages = useAsyncData(() => loadRecordPages(false))
  if (pages.loading) return <PageSkeleton rows={1} />
  if (pages.error) return <ErrorState title="手写页加载失败" onRetry={pages.retry} />

  const visiblePages = (pages.data || []).filter((page) =>
    filtered.some((record) => withinPage(page, record, records)),
  )
  const activePage = visiblePages[Math.min(pageIndex, Math.max(0, visiblePages.length - 1))]

  return (
    <Card>
      <CardContent className="pt-4">
        {activePage ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={pageIndex <= 0}
                onClick={() => onPageChange(pageIndex - 1)}
              >
                上一页
              </Button>
              <strong className="text-sm">
                第 {activePage.page} 页 · {pageIndex + 1}/{visiblePages.length}
              </strong>
              <Button
                variant="outline"
                disabled={pageIndex >= visiblePages.length - 1}
                onClick={() => onPageChange(pageIndex + 1)}
              >
                下一页
              </Button>
            </div>
            <SignedPageImage page={activePage} />
          </>
        ) : (
          <EmptyState title="当前条件下没有手写页" />
        )}
      </CardContent>
    </Card>
  )
}

export function RecordsPage() {
  const archive = useArchive()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState(params.get('view') === 'written' ? 'written' : 'list')
  const [query, setQuery] = useState(params.get('q') || '')
  const [year, setYear] = useState(params.get('year') || '')
  const [month, setMonth] = useState(params.get('month') || '')
  const [day, setDay] = useState(params.get('day') || '')
  const [important, setImportant] = useState(params.get('important') === '1')
  const [hidden, setHidden] = useState(false)
  const [hiddenRecords, setHiddenRecords] = useState<RecordItem[]>([])
  const [hiddenError, setHiddenError] = useState('')
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    document.title = '编日史 · 记录'
  }, [])

  useEffect(() => {
    let buffer = ''
    const listener = async (event: KeyboardEvent) => {
      const active = document.activeElement
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      buffer = (buffer + event.key.toLowerCase()).slice(-16)
      if (!buffer.endsWith('qibaishihuaxia')) return
      buffer = ''
      if (!(await hasAdminAccess())) {
        setHiddenError('当前访问凭证没有隐藏记录权限。')
        return
      }
      const records = await loadRecords({ hidden: true })
      setHiddenRecords(records)
      setHidden(true)
      setView('list')
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const records = hidden ? hiddenRecords : archive.data?.records || []
  const loading = !hidden && (!archive.data || archive.loading)
  const years = unique(records.map((record) => record.date.slice(0, 4)).filter(Boolean))
    .sort()
    .reverse()
  const months = unique(
    records
      .filter((record) => !year || record.date.startsWith(year))
      .map((record) => record.date.slice(5, 7))
      .filter(Boolean),
  ).sort()
  const filtered = useMemo(
    () =>
      records
        .filter((record) => {
          if (year && !record.date.startsWith(year)) return false
          if (month && record.date.slice(5, 7) !== month) return false
          if (day && record.date.slice(8, 10) !== day) return false
          if (important && record.importance !== 'important') return false
          return (
            !query ||
            normalizeText(
              [record.id, record.date, record.author, stripMarkup(record.content)].join(' '),
            ).includes(normalizeText(query))
          )
        })
        .sort((a, b) => b.id.localeCompare(a.id)),
    [day, important, month, query, records, year],
  )

  useEffect(() => {
    const next = new URLSearchParams()
    if (view === 'written') next.set('view', view)
    if (query) next.set('q', query)
    if (year) next.set('year', year)
    if (month) next.set('month', month)
    if (day) next.set('day', day)
    if (important) next.set('important', '1')
    setParams(next, { replace: true })
  }, [day, important, month, query, setParams, view, year])

  const clearFilters = () => {
    setQuery('')
    setYear('')
    setMonth('')
    setDay('')
    setImportant(false)
    setPageIndex(0)
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
              <TabsTrigger value="written" disabled={hidden}>
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
            本模式不会写入本地偏好。
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

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 pt-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索记录内容、日期或记录人"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={year || '__all__'}
              onValueChange={(value) => {
                setYear(value === '__all__' ? '' : value || '')
                setMonth('')
                setDay('')
                setPageIndex(0)
              }}
            >
              <SelectTrigger aria-label="年份">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部年份</SelectItem>
                {years.map((item) => (
                  <SelectItem value={item} key={item}>
                    {item} 年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={month || '__all__'}
              onValueChange={(value) => {
                setMonth(value === '__all__' ? '' : value || '')
                setDay('')
                setPageIndex(0)
              }}
            >
              <SelectTrigger aria-label="月份">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部月份</SelectItem>
                {months.map((item) => (
                  <SelectItem value={item} key={item}>
                    {item} 月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={important ? 'default' : 'outline'}
              onClick={() => setImportant((value) => !value)}
            >
              重要记录
            </Button>
            {(query || year || month || important) && (
              <Button variant="ghost" onClick={clearFilters}>
                <X data-icon="inline-start" />
                清除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && <PageSkeleton rows={5} />}
      {archive.error && !hidden && <ErrorState title="记录加载失败" onRetry={archive.retry} />}
      {!loading && !archive.error && view === 'list' && (
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
      {!loading && !archive.error && view === 'written' && (
        <WrittenRecordPages
          filtered={filtered}
          records={records}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
        />
      )}
    </div>
  )
}
