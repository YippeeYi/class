import { BookOpenText, CalendarDays, MessageSquareQuote, PenLine, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { countTextCharacters, extractMarkupReferences, extractParticipantIds } from '@/lib/markup'
import type { RecordItem } from '@/types/domain'

type Metric = 'count' | 'characters'
const chartConfig = { value: { label: '数量', color: 'var(--chart-1)' } } satisfies ChartConfig
const pieColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
]

function dateParts(record: RecordItem) {
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

function metricValue(records: RecordItem[], metric: Metric) {
  return metric === 'count'
    ? records.length
    : records.reduce((sum, record) => sum + countTextCharacters(record.content), 0)
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
}

function countBy(records: RecordItem[], keys: (record: RecordItem) => string[], metric: Metric) {
  const map = new Map<string, number>()
  for (const record of records) {
    const amount = metric === 'count' ? 1 : countTextCharacters(record.content)
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
    <div className="grid gap-4">
      <div className="relative mx-auto w-full max-w-56">
        <ChartContainer config={config} className="aspect-square w-full">
          <PieChart onMouseLeave={() => setActiveId(null)}>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={2}
              isAnimationActive
              animationDuration={550}
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
                    className="cursor-pointer outline-none transition-opacity duration-200"
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
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <strong className="font-heading text-xl">{total.toLocaleString()}</strong>
            <p className="text-xs text-muted-foreground">本月{unit}</p>
          </div>
        </div>
      </div>
      <ul className="grid list-none gap-1" aria-label="记录人占比图例">
        {data.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0
          return (
            <li key={item.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-between gap-3 px-2 py-1.5 text-xs"
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

export function TimelinePage() {
  const resource = useArchive()
  const [params, setParams] = useSearchParams()
  const [metric, setMetric] = useState<Metric>('count')
  const records = resource.data?.records || []
  const years = useMemo(
    () =>
      [
        ...new Set(
          records
            .map((record) => dateParts(record)?.year)
            .filter((value): value is string => Boolean(value)),
        ),
      ]
        .sort()
        .reverse(),
    [records],
  )
  const [year, setYear] = useState(() => params.get('year') || '')
  const [month, setMonth] = useState(() => params.get('month') || '')

  useEffect(() => {
    document.title = '档案时间线 · 编日史'
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
        const items = records.filter((record) => {
          const date = dateParts(record)
          return date?.year === year && date.month === key
        })
        return { key, label: `${index + 1}月`, records: items, value: metricValue(items, metric) }
      }),
    [metric, records, year],
  )

  useEffect(() => {
    if (!year) return
    if (!monthly.some((item) => item.key === month && item.records.length)) {
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
  const unit = metric === 'count' ? '条' : '字'
  const knownPeople = new Map(
    (resource.data?.people || []).map((person) => [
      person.id,
      person.name || person.alias || person.id,
    ]),
  )
  const knownQuotes = new Map((resource.data?.quotes || []).map((quote) => [quote.id, quote.quote]))
  const people = countBy(selectedRecords, (record) => extractParticipantIds(record.content), metric)
  const authors = countBy(selectedRecords, (record) => [record.author], metric)
  const quotes = countBy(
    selectedRecords,
    (record) => extractMarkupReferences(record.content).quoteIds,
    metric,
  )
  const activeDays = new Set(
    selectedRecords.map((record) => dateParts(record)?.day).filter(Boolean),
  ).size
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31
  const daily = Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    const items = selectedRecords.filter((record) => dateParts(record)?.day === day)
    return {
      day,
      records: items,
      value: metricValue(items, metric),
      important: items.some((record) => record.importance === 'important'),
    }
  })
  const sortedAuthors = [...authors.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  const authorPie = sortedAuthors.slice(0, 5)
  const remainingAuthors = sortedAuthors.slice(5).reduce((sum, [, value]) => sum + value, 0)
  if (remainingAuthors) authorPie.push(['__other__', remainingAuthors])
  const pieConfig = Object.fromEntries(
    authorPie.map(([id], index) => [
      id,
      { label: id === '__other__' ? '其他' : knownPeople.get(id) || id, color: pieColors[index] },
    ]),
  ) as ChartConfig
  const authorPieData: AuthorPieDatum[] = authorPie.map(([id, value], index) => ({
    id,
    name: id === '__other__' ? '其他' : knownPeople.get(id) || id,
    value,
    color: pieColors[index] || 'var(--muted-foreground)',
  }))
  const summaryStats = [
    {
      label: metric === 'count' ? '全部记录' : '档案总字数',
      value: metricValue(records, metric),
      icon: BookOpenText,
    },
    {
      label: '有记录月份',
      value: new Set(
        records
          .map((record) => {
            const date = dateParts(record)
            return date ? `${date.year}-${date.month}` : ''
          })
          .filter(Boolean),
      ).size,
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
      value: new Set(records.flatMap((record) => extractParticipantIds(record.content))).size,
      icon: Users,
    },
    { label: '名言', value: resource.data?.quotes.length || 0, icon: MessageSquareQuote },
  ]

  return (
    <div>
      <PageHeading
        title="档案时间线"
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
      {resource.error && <ErrorState title="时间线加载失败" onRetry={resource.retry} />}
      {resource.data && !records.length && <EmptyState title="暂无可统计的记录" />}
      {resource.data && records.length > 0 && (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summaryStats.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3">
                  <Icon className="size-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <strong className="font-heading text-2xl">{value.toLocaleString()}</strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
          <Tabs
            value={year}
            onValueChange={(value) => {
              setYear(value)
              setMonth('')
            }}
            className="mb-6 overflow-x-auto"
          >
            <TabsList>
              {years.map((item) => (
                <TabsTrigger key={item} value={item}>
                  {item} 年
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.6fr)]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {year} 年月度{metric === 'count' ? '记录' : '字数'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="min-h-64 w-full">
                  <BarChart data={monthly}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis width={42} domain={[0, metric === 'count' ? 300 : 3000]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {year} 年 {month} 月记录人占比
                </CardTitle>
              </CardHeader>
              <CardContent>
                {authorPie.length ? (
                  <AuthorDistributionChart data={authorPieData} config={pieConfig} unit={unit} />
                ) : (
                  <EmptyState title="本月没有记录人数据" />
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>选择月份</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {monthly.map((item) => (
                <Button
                  key={item.key}
                  variant={month === item.key ? 'default' : 'outline'}
                  disabled={!item.records.length}
                  className="h-auto flex-col py-2"
                  onClick={() => setMonth(item.key)}
                >
                  <span>{item.label}</span>
                  <span className="text-xs opacity-70">
                    {item.value.toLocaleString()} {unit}
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <Card key={String(label)}>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <strong className="font-heading text-xl">{Number(value).toLocaleString()}</strong>
                </CardContent>
              </Card>
            ))}
          </section>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                {year} 年 {month} 月每日分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="min-h-64 w-full">
                <BarChart data={daily}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" interval={2} tickLine={false} axisLine={false} />
                  <YAxis width={42} domain={[0, metric === 'count' ? 50 : 1000]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={3} />
                </BarChart>
              </ChartContainer>
              <div className="mt-4 grid grid-cols-7 gap-1 sm:grid-cols-10 lg:grid-cols-16">
                {daily.map((item) => (
                  <Button
                    key={item.day}
                    size="sm"
                    variant={item.important ? 'secondary' : 'ghost'}
                    disabled={!item.records.length}
                    render={
                      item.records.length ? (
                        <Link to={`/records?year=${year}&month=${month}&day=${item.day}`} />
                      ) : undefined
                    }
                  >
                    {item.day}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {[
              {
                title: '活跃人物',
                values: topEntries(people, 10),
                label: (id: string) => knownPeople.get(id) || id,
                href: (id: string) => `/person?id=${encodeURIComponent(id)}`,
              },
              {
                title: '记录人',
                values: topEntries(authors, 8),
                label: (id: string) => knownPeople.get(id) || id,
                href: (id: string) => `/person?id=${encodeURIComponent(id)}`,
              },
              {
                title: '高频名言',
                values: topEntries(quotes, 8),
                label: (id: string) => knownQuotes.get(id) || id,
                href: (id: string) => `/quotes#quote-${id}`,
              },
            ].map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle>{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {group.values.length ? (
                    group.values.map(([id, value]) => (
                      <Button
                        key={id}
                        variant="outline"
                        size="sm"
                        render={<Link to={group.href(id)} />}
                      >
                        {group.label(id)}{' '}
                        <Badge variant="secondary">
                          {value.toLocaleString()} {unit}
                        </Badge>
                      </Button>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">暂无数据</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                本月共 {selectedRecords.length} 条记录。
              </span>
              <Link
                to={`/records?year=${year}&month=${month}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                查看本月记录
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
