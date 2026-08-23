import { BookOpenText, CalendarDays, MessageSquareQuote, PenLine, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { SegmentedTabsList } from '@/components/archive/segmented-tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { DailyDistributionCell, dailyAuthorColor } from '@/features/timeline/daily-distribution'
import {
  AuthorDistributionChart,
  buildAuthorPie,
  TimelineBarChart,
} from '@/features/timeline/timeline-charts'
import {
  countTimelineBy as countBy,
  timelineDateParts as dateParts,
  type TimelineMetric as Metric,
  timelineMetricValue as metricValue,
  recordMentions,
  timelineScale,
  topTimelineEntries as topEntries,
} from '@/features/timeline/timeline-model'
import { usePersistentHighlight } from '@/hooks/use-persistent-highlight'
import { stripMarkup } from '@/lib/markup'
import { quoteRecordTarget } from '@/lib/quote-navigation'
import { prepareRecordJump, recordClientHref } from '@/lib/record-navigation'
import type { RecordItem } from '@/types/domain'

const metricItems = [
  { value: 'count', label: '记录条数' },
  { value: 'characters', label: '记录字数' },
] as const
export function TimelinePage() {
  const resource = useArchive()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [metric, setMetric] = useState<Metric>('count')
  const [navigationError, setNavigationError] = useState('')
  const {
    activeId: activeDailyAuthor,
    activatePointer: activateDailyAuthorPointer,
    clearPointer: clearDailyAuthorPointer,
    activateFocus: activateDailyAuthorFocus,
    clearFocusWhenLeaving: clearDailyAuthorFocusWhenLeaving,
  } = usePersistentHighlight()
  const records = resource.data?.records || []
  const archivePeriods = useMemo(() => {
    const byYear = new Map<string, RecordItem[]>()
    const byMonth = new Map<string, RecordItem[]>()
    for (const record of records) {
      const date = dateParts(record)
      if (!date) continue
      const monthKey = `${date.year}-${date.month}`
      const yearItems = byYear.get(date.year)
      if (yearItems) yearItems.push(record)
      else byYear.set(date.year, [record])
      const monthItems = byMonth.get(monthKey)
      if (monthItems) monthItems.push(record)
      else byMonth.set(monthKey, [record])
    }
    return { byYear, byMonth }
  }, [records])
  const years = useMemo(() => [...archivePeriods.byYear.keys()].sort().reverse(), [archivePeriods])
  const yearTotals = useMemo(
    () =>
      new Map(
        years.map((item) => [item, metricValue(archivePeriods.byYear.get(item) || [], metric)]),
      ),
    [archivePeriods, metric, years],
  )
  const [year, setYear] = useState(() => params.get('year') || '')
  const [month, setMonth] = useState(() => params.get('month') || '')

  useEffect(() => {
    const nextYear = params.get('year') || ''
    const nextMonth = params.get('month') || ''
    setYear((current) => (current === nextYear ? current : nextYear))
    setMonth((current) => (current === nextMonth ? current : nextMonth))
  }, [params])
  useEffect(() => {
    const [firstYear] = years
    if (firstYear && !years.includes(year)) setYear(firstYear)
  }, [year, years])

  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const key = String(index + 1).padStart(2, '0')
        const items = archivePeriods.byMonth.get(`${year}-${key}`) || []
        return { key, label: `${index + 1}月`, records: items, value: metricValue(items, metric) }
      }),
    [archivePeriods, metric, year],
  )

  useEffect(() => {
    if (!year) return
    if (!monthly.some((item) => item.key === month)) {
      setMonth([...monthly].reverse().find((item) => item.records.length)?.key || '01')
    }
  }, [month, monthly, year])
  useEffect(() => {
    const next = new URLSearchParams()
    if (year) next.set('year', year)
    if (month) next.set('month', month)
    const current = new URLSearchParams(window.location.search)
    if (next.toString() !== current.toString()) setParams(next, { replace: true })
  }, [month, setParams, year])

  const selected = monthly.find((item) => item.key === month) || monthly[0]
  const selectedRecords = selected?.records || []
  const yearRecords = archivePeriods.byYear.get(year) || []
  const unit = metric === 'count' ? '条' : '字'
  const knownPeople = useMemo(
    () =>
      new Map(
        (resource.data?.people || []).map((person) => [
          person.id,
          person.name || person.alias || person.id,
        ]),
      ),
    [resource.data?.people],
  )
  const knownQuotes = useMemo(
    () =>
      new Map((resource.data?.quotes || []).map((quote) => [quote.id, stripMarkup(quote.quote)])),
    [resource.data?.quotes],
  )
  const quoteById = useMemo(
    () => new Map((resource.data?.quotes || []).map((quote) => [quote.id, quote])),
    [resource.data?.quotes],
  )
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31
  const { people, authors, quotes, activeDays, daily } = useMemo(() => {
    const people = countBy(selectedRecords, (record) => recordMentions(record).peopleIds, metric)
    const authors = countBy(selectedRecords, (record) => [record.author], metric)
    const quotes = countBy(selectedRecords, (record) => recordMentions(record).quoteIds, metric)
    const activeDays = new Set(
      selectedRecords.map((record) => dateParts(record)?.day).filter(Boolean),
    ).size
    const recordsByDay = new Map<string, RecordItem[]>()
    for (const record of selectedRecords) {
      const day = dateParts(record)?.day
      if (!day) continue
      const dayItems = recordsByDay.get(day)
      if (dayItems) dayItems.push(record)
      else recordsByDay.set(day, [record])
    }
    const daily = Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      const items = recordsByDay.get(day) || []
      return {
        day,
        records: items,
        value: metricValue(items, metric),
        important: metricValue(
          items.filter((record) => record.importance === 'important'),
          metric,
        ),
        authors: [...countBy(items, (record) => [record.author || 'unknown'], metric).entries()],
      }
    })
    return { people, authors, quotes, activeDays, daily }
  }, [daysInMonth, metric, selectedRecords])
  const overallAuthorPie = useMemo(
    () => buildAuthorPie(records, metric, knownPeople),
    [knownPeople, metric, records],
  )
  const yearAuthorPie = useMemo(
    () => buildAuthorPie(yearRecords, metric, knownPeople),
    [knownPeople, metric, yearRecords],
  )
  const monthAuthorPie = useMemo(
    () => buildAuthorPie(selectedRecords, metric, knownPeople),
    [knownPeople, metric, selectedRecords],
  )
  const allMonths = useMemo(() => {
    return [...archivePeriods.byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, label: key, value: metricValue(items, metric) }))
  }, [archivePeriods, metric])
  const overallMonthScale = timelineScale(
    allMonths.map((item) => item.value),
    metric,
    'month',
  )
  const dailyScale = timelineScale(
    daily.map((item) => item.value),
    metric,
    'day',
  )
  const dailyAuthorColors = useMemo(
    () =>
      new Map(
        [...new Set(records.map((record) => record.author || 'unknown'))]
          .sort((a, b) => a.localeCompare(b))
          .map((id, index) => [id, dailyAuthorColor(index)]),
      ),
    [records],
  )
  const dailyAuthorLegend = useMemo(
    () => [...authors.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [authors],
  )
  const resolvedActiveDailyAuthor = dailyAuthorLegend.some(([id]) => id === activeDailyAuthor)
    ? activeDailyAuthor
    : null

  const openQuoteSource = (id: string) => {
    const quote = quoteById.get(id)
    if (!quote) {
      setNavigationError('没有找到这条名言。')
      return
    }
    const target = quoteRecordTarget(quote, records)
    if (!target.href || !target.anchor) {
      setNavigationError(
        target.sources.length > 1
          ? '这条名言匹配到多条记录，请检查记录标记。'
          : '没有找到这条名言对应的记录。',
      )
      return
    }
    setNavigationError('')
    prepareRecordJump(target.anchor)
    navigate(recordClientHref(target.href))
  }
  const summaryStats = useMemo(
    () => [
      {
        label: metric === 'count' ? '全部记录' : '档案总字数',
        value: metricValue(records, metric),
        icon: BookOpenText,
      },
      {
        label: '有记录月份',
        value: archivePeriods.byMonth.size,
        icon: CalendarDays,
      },
      {
        label: `重要${unit}`,
        value: metricValue(
          records.filter((record) => record.importance === 'important'),
          metric,
        ),
        icon: PenLine,
      },
      {
        label: '活跃人物',
        value: new Set(records.flatMap((record) => recordMentions(record).peopleIds)).size,
        icon: Users,
      },
      { label: '名言', value: resource.data?.quotes.length || 0, icon: MessageSquareQuote },
    ],
    [archivePeriods, metric, records, resource.data?.quotes.length, unit],
  )

  return (
    <div>
      <PageHeading
        title="统计"
        description="从全局、年度、月度和每日四个层级查看记录密度、作者与关联人物。"
        actions={
          <Tabs value={metric} onValueChange={(value) => setMetric(value as Metric)}>
            <SegmentedTabsList value={metric} items={metricItems} ariaLabel="统计指标" />
          </Tabs>
        }
      />
      {resource.loading && <PageSkeleton rows={5} />}
      {resource.error && <ErrorState title="统计加载失败" onRetry={resource.retry} />}
      {navigationError && (
        <Alert variant="destructive" className="mb-5" role="alert">
          <AlertTitle>无法打开名言来源</AlertTitle>
          <AlertDescription>{navigationError}</AlertDescription>
        </Alert>
      )}
      {resource.data && !records.length && <EmptyState title="暂无可统计的记录" />}
      {resource.data && records.length > 0 && (
        <div className="min-w-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow)">
          <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {summaryStats.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="gap-0 bg-card/78 py-0">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-[1.125rem]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-meta text-muted-foreground">{label}</p>
                    <strong className="font-heading text-2xl leading-none tabular-nums">
                      {value.toLocaleString()}
                    </strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
          <div className="mb-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(20rem,.82fr)_minmax(0,1.38fr)]">
            <Card className="min-w-0 gap-0 bg-card/80 py-0">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle>整体记录人{metric === 'count' ? '记录条数' : '记录字数'}占比</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 p-4">
                {overallAuthorPie.data.length ? (
                  <AuthorDistributionChart
                    data={overallAuthorPie.data}
                    config={overallAuthorPie.config}
                    unit={unit}
                  />
                ) : (
                  <EmptyState title="暂无整体记录人数据" />
                )}
              </CardContent>
            </Card>
            <Card className="min-w-0 gap-0 bg-card/80 py-0">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle>全档案月度{metric === 'count' ? '记录' : '字数'}趋势</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 p-4">
                {allMonths.length ? (
                  <TimelineBarChart data={allMonths} xKey="label" scale={overallMonthScale} />
                ) : (
                  <EmptyState
                    title="没有可绘制的月份"
                    description="记录中缺少符合 YYYY-MM-DD 的有效日期。"
                  />
                )}
              </CardContent>
            </Card>
          </div>
          {years.length ? (
            <>
              <section
                className="mb-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(20rem,.82fr)_minmax(0,1.38fr)]"
                aria-label="年度统计与年份选择"
              >
                <Card className="min-w-0 gap-0 bg-card/80 py-0">
                  <CardHeader className="border-b px-4 py-3">
                    <CardTitle>
                      {year} 年记录人{metric === 'count' ? '记录条数' : '记录字数'}占比
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 p-4">
                    {yearAuthorPie.data.length ? (
                      <AuthorDistributionChart
                        data={yearAuthorPie.data}
                        config={yearAuthorPie.config}
                        unit={unit}
                      />
                    ) : (
                      <EmptyState title="本年没有记录人数据" />
                    )}
                  </CardContent>
                </Card>
                <Card className="min-w-0 gap-0 bg-card/80 py-0">
                  <CardHeader className="flex-col items-start gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>选择年份</CardTitle>
                      <p className="mt-1 text-meta text-muted-foreground">
                        切换后同步显示该年的月份和每日统计。
                      </p>
                    </div>
                    <Button
                      className="shrink-0"
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link to={`/records?year=${encodeURIComponent(year)}`} />}
                    >
                      查看本年记录
                    </Button>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                    {years.map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant={year === item ? 'default' : 'outline'}
                        className="h-[4.5rem] min-w-0 flex-col gap-1 px-2"
                        aria-pressed={year === item}
                        onClick={() => {
                          setYear(item)
                          setMonth('')
                        }}
                      >
                        <span>{item} 年</span>
                        <span className="max-w-full truncate text-meta opacity-70">
                          {yearTotals.get(item)?.toLocaleString()} {unit}
                        </span>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </section>
              <section
                className="mb-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(20rem,.82fr)_minmax(0,1.38fr)]"
                aria-label="月度统计与月份选择"
              >
                <Card className="min-w-0 gap-0 bg-card/80 py-0">
                  <CardHeader className="border-b px-4 py-3">
                    <CardTitle>
                      {year} 年 {month} 月记录人{metric === 'count' ? '记录条数' : '记录字数'}占比
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 p-4">
                    {monthAuthorPie.data.length ? (
                      <AuthorDistributionChart
                        data={monthAuthorPie.data}
                        config={monthAuthorPie.config}
                        unit={unit}
                      />
                    ) : (
                      <EmptyState title="本月没有记录人数据" />
                    )}
                  </CardContent>
                </Card>
                <Card className="min-w-0 gap-0 bg-card/80 py-0">
                  <CardHeader className="flex-col items-start gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>选择月份</CardTitle>
                      <p className="mt-1 text-meta text-muted-foreground">
                        无记录月份保留位置并明确禁用。
                      </p>
                    </div>
                    <Button
                      className="shrink-0"
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link to={`/records?year=${year}&month=${month}`} />}
                    >
                      查看本月记录
                    </Button>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4">
                    {monthly.map((item) => (
                      <Button
                        key={item.key}
                        type="button"
                        variant={month === item.key ? 'default' : 'outline'}
                        disabled={!item.records.length}
                        className="h-[4.5rem] min-w-0 flex-col gap-1 px-1.5"
                        aria-pressed={month === item.key}
                        onClick={() => setMonth(item.key)}
                      >
                        <span>{item.label}</span>
                        <span className="max-w-full truncate text-meta opacity-70">
                          {item.value.toLocaleString()} {unit}
                        </span>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </section>
              <section
                className="mb-5 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4"
                aria-label={`${year} 年 ${month} 月统计摘要`}
              >
                {[
                  ['本月统计', metricValue(selectedRecords, metric)],
                  [
                    '重要记录',
                    metricValue(
                      selectedRecords.filter((record) => record.importance === 'important'),
                      metric,
                    ),
                  ],
                  ['有记录天数', activeDays],
                  ['全月天数', daysInMonth],
                  ['活跃人物', people.size],
                  ['记录人', authors.size],
                  ['高频名言', quotes.size],
                  [
                    '平均每条',
                    selectedRecords.length
                      ? Math.round(metricValue(selectedRecords, metric) / selectedRecords.length)
                      : 0,
                  ],
                ].map(([label, value]) => (
                  <article key={String(label)} className="bg-card/88 px-4 py-3">
                    <p className="text-meta text-muted-foreground">{label}</p>
                    <strong className="font-heading text-xl leading-tight tabular-nums">
                      {Number(value).toLocaleString()}
                    </strong>
                  </article>
                ))}
              </section>
              <Card className="mb-5 min-w-0 gap-0 bg-card/80 py-0">
                <CardHeader className="border-b px-4 py-3">
                  <CardTitle>
                    {year} 年 {month} 月每日{metric === 'count' ? '记录' : '字数'}柱形图
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 p-4">
                  <TimelineBarChart data={daily} xKey="day" scale={dailyScale} interval={2} />
                </CardContent>
              </Card>
              <Card className="mb-5 min-w-0 gap-0 bg-card/80 py-0">
                <CardHeader className="border-b px-4 py-3">
                  <CardTitle>每日记录分布</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 p-4">
                  <div className="grid grid-cols-4 gap-1 sm:grid-cols-7 lg:grid-cols-10 2xl:grid-cols-14">
                    {daily.map((item) => (
                      <DailyDistributionCell
                        key={item.day}
                        item={item}
                        year={year}
                        month={month}
                        unit={unit}
                        colors={dailyAuthorColors}
                        activeAuthor={resolvedActiveDailyAuthor}
                      />
                    ))}
                  </div>
                  {dailyAuthorLegend.length > 0 && (
                    <ul
                      className="mt-3 flex list-none flex-wrap gap-1.5 border-t pt-3"
                      aria-label="记录人占比图例"
                      onPointerLeave={clearDailyAuthorPointer}
                      onBlur={clearDailyAuthorFocusWhenLeaving}
                    >
                      {dailyAuthorLegend.map(([id]) => (
                        <li key={id}>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-2 px-2 text-meta aria-pressed:bg-muted aria-pressed:text-foreground dark:aria-pressed:bg-muted/50"
                            aria-pressed={resolvedActiveDailyAuthor === id}
                            onPointerEnter={() => activateDailyAuthorPointer(id)}
                            onFocus={() => activateDailyAuthorFocus(id)}
                          >
                            <i
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: dailyAuthorColors.get(id) }}
                              aria-hidden="true"
                            />
                            {knownPeople.get(id) || id}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  {
                    title: '活跃人物',
                    values: topEntries(people, 10),
                    label: (id: string) => knownPeople.get(id) || id,
                    href: (id: string) => `/person?id=${encodeURIComponent(id)}`,
                    onSelect: undefined,
                  },
                  {
                    title: '记录人',
                    values: topEntries(authors, 8),
                    label: (id: string) => knownPeople.get(id) || id,
                    href: (id: string) => `/person?id=${encodeURIComponent(id)}`,
                    onSelect: undefined,
                  },
                  {
                    title: '高频名言',
                    values: topEntries(quotes, 8),
                    label: (id: string) => knownQuotes.get(id) || id,
                    href: undefined,
                    onSelect: openQuoteSource,
                  },
                ].map((group) => (
                  <Card key={group.title} className="gap-0 bg-card/80 py-0">
                    <CardHeader className="border-b px-4 py-3">
                      <CardTitle>{group.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 p-4">
                      {group.values.length ? (
                        group.values.map(([id, value]) => {
                          const content = (
                            <>
                              {group.label(id)}{' '}
                              <Badge variant="secondary">
                                {value.toLocaleString()} {unit}
                              </Badge>
                            </>
                          )
                          return group.onSelect ? (
                            <Button
                              key={id}
                              variant="outline"
                              size="sm"
                              onClick={() => group.onSelect?.(id)}
                            >
                              {content}
                            </Button>
                          ) : (
                            <Button
                              key={id}
                              variant="outline"
                              size="sm"
                              nativeButton={false}
                              render={<Link to={group.href?.(id) || '/'} />}
                            >
                              {content}
                            </Button>
                          )
                        })
                      ) : (
                        <span className="text-sm text-muted-foreground">暂无数据</span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="没有可统计的日期"
              description="现有记录缺少符合 YYYY-MM-DD 的日期，无法建立年度、月度和每日层级。"
            />
          )}
        </div>
      )}
    </div>
  )
}
