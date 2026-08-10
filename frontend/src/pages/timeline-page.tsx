import { BookOpenText, CalendarDays, MessageSquareQuote, PenLine, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import {
  countTextCharacters,
  extractMarkupReferences,
  extractParticipantIds,
  stripMarkup,
} from '@/lib/markup'
import { quoteRecordTarget } from '@/lib/quote-navigation'
import { prepareRecordJump } from '@/lib/record-navigation'
import { fixedTimelineChartScale } from '@/lib/timeline'
import type { RecordItem } from '@/types/domain'

type Metric = 'count' | 'characters'
const chartConfig = { value: { label: '数量', color: 'var(--chart-1)' } } satisfies ChartConfig
const chartTooltipClassName =
  'w-40 min-w-40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100'
const pieColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
]

const recordDateCache = new WeakMap<RecordItem, ReturnType<typeof parseRecordDate>>()
const recordCharacterCache = new WeakMap<RecordItem, number>()
const recordMentionCache = new WeakMap<RecordItem, { peopleIds: string[]; quoteIds: string[] }>()

function parseRecordDate(record: RecordItem) {
  const match = [record.date, record.fileName, record.id]
    .join(' ')
    .match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  const year = match[1]
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return {
    year,
    month: String(month).padStart(2, '0'),
    day: String(day).padStart(2, '0'),
  }
}

function dateParts(record: RecordItem) {
  if (recordDateCache.has(record)) return recordDateCache.get(record) || null
  const value = parseRecordDate(record)
  recordDateCache.set(record, value)
  return value
}

function recordCharacterCount(record: RecordItem) {
  const cached = recordCharacterCache.get(record)
  if (cached !== undefined) return cached
  const value = countTextCharacters(record.content)
  recordCharacterCache.set(record, value)
  return value
}

function recordMentions(record: RecordItem) {
  const cached = recordMentionCache.get(record)
  if (cached) return cached
  const value = {
    peopleIds: extractParticipantIds(record.content),
    quoteIds: extractMarkupReferences(record.content).quoteIds,
  }
  recordMentionCache.set(record, value)
  return value
}

function metricValue(records: RecordItem[], metric: Metric) {
  return metric === 'count'
    ? records.length
    : records.reduce((sum, record) => sum + recordCharacterCount(record), 0)
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
}

function timelineScale(values: number[], metric: Metric, period: 'month' | 'day') {
  if (period === 'month')
    return fixedTimelineChartScale(
      values,
      metric === 'characters' ? 3000 : 100,
      metric === 'characters' ? 750 : 25,
    )
  return fixedTimelineChartScale(
    values,
    metric === 'characters' ? 1000 : 12,
    metric === 'characters' ? 250 : 3,
  )
}

function countBy(records: RecordItem[], keys: (record: RecordItem) => string[], metric: Metric) {
  const map = new Map<string, number>()
  for (const record of records) {
    const amount = metric === 'count' ? 1 : recordCharacterCount(record)
    for (const key of new Set(keys(record).filter(Boolean)))
      map.set(key, (map.get(key) || 0) + amount)
  }
  return map
}

type AuthorPieDatum = {
  id: string
  name: string
  value: number
  color: string
}

function buildAuthorPie(records: RecordItem[], metric: Metric, knownPeople: Map<string, string>) {
  const sorted = [
    ...countBy(records, (record) => [record.author || 'unknown'], metric).entries(),
  ].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const entries = sorted.slice(0, 5)
  const remaining = sorted.slice(5).reduce((sum, [, value]) => sum + value, 0)
  if (remaining) entries.push(['__other__', remaining])
  const config = Object.fromEntries(
    entries.map(([id], index) => [
      id,
      {
        label: id === '__other__' ? '其他' : knownPeople.get(id) || id,
        color: pieColors[index] || 'var(--muted-foreground)',
      },
    ]),
  ) as ChartConfig
  const data: AuthorPieDatum[] = entries.map(([id, value], index) => ({
    id,
    name: id === '__other__' ? '其他' : knownPeople.get(id) || id,
    value,
    color: pieColors[index] || 'var(--muted-foreground)',
  }))
  return { config, data, totalAuthors: sorted.length }
}

const dailyAuthorPalette = [
  '#3978d4',
  '#e56b36',
  '#2ca46f',
  '#d84f91',
  '#16a6b6',
  '#d94b4b',
  '#7b61d1',
  '#d5a51f',
  '#2369a8',
  '#ef8f2f',
  '#238b57',
  '#b946a8',
]

function dailyAuthorColor(index: number) {
  if (dailyAuthorPalette[index]) return dailyAuthorPalette[index]
  const generated = index - dailyAuthorPalette.length
  const hue = (205 + generated * 137.508) % 360
  return `hsl(${hue.toFixed(1)} ${66 + (generated % 3) * 5}% ${generated % 2 ? 58 : 52}%)`
}

function MiniAuthorPie({
  entries,
  colors,
  activeId,
}: {
  entries: [string, number][]
  colors: Map<string, string>
  activeId: string | null
}) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  let offset = 0
  return (
    <svg viewBox="0 0 40 40" className="size-6 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="10" fill="var(--muted)" />
      {entries.map(([id, value]) => {
        const length = total ? (value / total) * 100 : 0
        const dashOffset = -offset
        offset += length
        return (
          <circle
            key={id}
            cx="20"
            cy="20"
            r="10"
            pathLength="100"
            fill="none"
            stroke={colors.get(id) || 'var(--muted-foreground)'}
            strokeWidth="20"
            strokeDasharray={`${length} ${100 - length}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 20 20)"
            opacity={activeId && activeId !== id ? 0.18 : 1}
            className="transition-opacity duration-150"
          />
        )
      })}
      <circle cx="20" cy="20" r="19" fill="none" stroke="var(--border)" strokeWidth="1" />
    </svg>
  )
}

function AuthorDistributionChart({
  data,
  config,
  unit,
}: {
  data: AuthorPieDatum[]
  config: ChartConfig
  unit: string
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-center">
      <div className="relative mx-auto h-36 w-72 max-w-full">
        <ChartContainer config={config} className="relative z-10 aspect-auto h-36 w-72 max-w-full">
          <PieChart onMouseLeave={() => setActiveId(null)}>
            <ChartTooltip
              cursor={false}
              isAnimationActive={false}
              position={{ x: 128, y: 8 }}
              content={
                <ChartTooltipContent
                  hideLabel
                  className={chartTooltipClassName}
                  formatter={(value, _name, item) => {
                    const datum = item.payload as AuthorPieDatum
                    const amount = Number(value) || 0
                    const percentage = total ? Math.round((amount / total) * 100) : 0
                    return (
                      <div className="grid w-full gap-1.5">
                        <div className="flex min-w-0 items-center gap-2 font-medium">
                          <i
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: datum.color }}
                          />
                          <span className="truncate">{datum.name}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {unit === '条' ? '记录条数' : '记录字数'}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {amount.toLocaleString()} {unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">占比</span>
                          <span className="font-mono font-medium tabular-nums">{percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t pt-1.5">
                          <span className="text-muted-foreground">合计</span>
                          <span className="font-mono font-medium tabular-nums">
                            {total.toLocaleString()} {unit}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={66}
              cx={72}
              cy={72}
              paddingAngle={2}
              strokeWidth={2}
              isAnimationActive
              animationDuration={320}
              animationEasing="ease-out"
            >
              {data.map((item) => {
                const subdued = activeId !== null && activeId !== item.id
                return (
                  <Cell
                    key={item.id}
                    fill={item.color}
                    opacity={subdued ? 0.3 : 1}
                    stroke="var(--background)"
                    strokeWidth={activeId === item.id ? 4 : 2}
                    tabIndex={0}
                    role="img"
                    aria-label={`${item.name}：${item.value.toLocaleString()} ${unit}`}
                    className="cursor-pointer outline-none transition-[opacity,stroke-width] duration-150 focus-visible:opacity-100"
                    onPointerEnter={() => setActiveId(item.id)}
                    onPointerLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(item.id)}
                    onBlur={() => setActiveId(null)}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-0 grid w-36 place-items-center text-center">
          <div>
            <strong className="font-heading text-xl">{total.toLocaleString()}</strong>
            <p className="text-[0.8125rem] text-muted-foreground">合计 {unit}</p>
          </div>
        </div>
      </div>
      <ul className="grid min-w-0 list-none gap-1" aria-label="记录人占比图例">
        {data.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0
          return (
            <li key={item.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-between gap-3 px-2 py-1.5 text-[0.8125rem]"
                aria-pressed={activeId === item.id}
                onPointerEnter={() => setActiveId(item.id)}
                onPointerLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(item.id)}
                onBlur={() => setActiveId(null)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <i
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {item.value.toLocaleString()} {unit} · {percentage}%
                </span>
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TimelineBarChart({
  data,
  xKey,
  scale,
  interval = 'preserveStartEnd',
}: {
  data: Array<{ value: number; [key: string]: unknown }>
  xKey: 'label' | 'day'
  scale: { max: number; ticks: number[] }
  interval?: number | 'preserveStartEnd'
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 min-w-0 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          interval={interval}
          minTickGap={18}
          tickLine={false}
          tickMargin={8}
          axisLine={false}
        />
        <YAxis
          width={44}
          domain={[0, scale.max]}
          ticks={scale.ticks}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.42 }}
          isAnimationActive={false}
          content={<ChartTooltipContent className={chartTooltipClassName} />}
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[4, 4, 1, 1]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}

export function TimelinePage() {
  const resource = useArchive()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [metric, setMetric] = useState<Metric>('count')
  const [navigationError, setNavigationError] = useState('')
  const [activeDailyAuthor, setActiveDailyAuthor] = useState<string | null>(null)
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
    document.title = '统计 · 编日史'
  }, [])
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
    navigate(target.href)
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
            <TabsList>
              <TabsTrigger value="count">记录条数</TabsTrigger>
              <TabsTrigger value="characters">记录字数</TabsTrigger>
            </TabsList>
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
        <div className="min-w-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {summaryStats.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="gap-0 bg-card/78 py-0">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-[1.125rem]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] text-muted-foreground">{label}</p>
                    <strong className="font-heading text-[1.625rem] leading-none tabular-nums">
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
                      <p className="mt-1 text-[0.8125rem] text-muted-foreground">
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
                        <span className="max-w-full truncate text-[0.8125rem] opacity-70">
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
                      <p className="mt-1 text-[0.8125rem] text-muted-foreground">
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
                        <span className="max-w-full truncate text-[0.8125rem] opacity-70">
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
                    <p className="text-[0.8125rem] text-muted-foreground">{label}</p>
                    <strong className="font-heading text-[1.375rem] leading-tight tabular-nums">
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
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 lg:grid-cols-10 2xl:grid-cols-14">
                    {daily.map((item) => (
                      <Button
                        key={item.day}
                        size="sm"
                        variant={item.important > 0 ? 'secondary' : 'outline'}
                        disabled={!item.records.length}
                        nativeButton={!item.records.length}
                        className="h-auto min-h-14 min-w-0 flex-col gap-0.5 px-1 py-1"
                        aria-label={`${year} 年 ${month} 月 ${item.day} 日：${item.value.toLocaleString()} ${unit}${item.important > 0 ? `，重要 ${item.important.toLocaleString()} ${unit}` : ''}`}
                        render={
                          item.records.length ? (
                            <Link to={`/records?year=${year}&month=${month}&day=${item.day}`} />
                          ) : undefined
                        }
                      >
                        <span className="text-[0.8125rem] leading-none">{item.day} 日</span>
                        <span className="flex min-w-0 items-center gap-1">
                          {item.records.length ? (
                            <MiniAuthorPie
                              entries={item.authors}
                              colors={dailyAuthorColors}
                              activeId={activeDailyAuthor}
                            />
                          ) : (
                            <span
                              className="size-6 shrink-0 rounded-full border border-dashed"
                              aria-hidden="true"
                            />
                          )}
                          <span className="grid min-w-0 text-left leading-tight">
                            <strong className="truncate text-[0.8125rem] tabular-nums">
                              {item.value.toLocaleString()}
                              {unit}
                            </strong>
                            <span className="h-4 truncate text-xs opacity-70">
                              {item.important > 0 ? `重要${item.important.toLocaleString()}` : ''}
                            </span>
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                  {dailyAuthorLegend.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">
                        记录人图例
                      </p>
                      <ul className="flex list-none flex-wrap gap-1.5">
                        {dailyAuthorLegend.map(([id]) => (
                          <li key={id}>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-2 px-2 text-[0.8125rem]"
                              aria-pressed={activeDailyAuthor === id}
                              onPointerEnter={() => setActiveDailyAuthor(id)}
                              onPointerLeave={() => setActiveDailyAuthor(null)}
                              onFocus={() => setActiveDailyAuthor(id)}
                              onBlur={() => setActiveDailyAuthor(null)}
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
                    </div>
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
