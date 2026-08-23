import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { countTimelineBy as countBy, type TimelineMetric } from '@/features/timeline/timeline-model'
import { usePersistentHighlight } from '@/hooks/use-persistent-highlight'
import { cn } from '@/lib/utils'
import type { RecordItem } from '@/types/domain'

const chartConfig = { value: { label: '数量', color: 'var(--chart-1)' } } satisfies ChartConfig
const chartTooltipClassName =
  'w-40 min-w-40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-fast)'
const pieColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
]

type AuthorPieDatum = {
  id: string
  name: string
  value: number
  color: string
}

function authorPieMiddleAngles(data: AuthorPieDatum[]) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let cursor = 0
  return new Map(
    data.map((item) => {
      const span = total ? (item.value / total) * 360 : 0
      const middle = cursor - span / 2
      cursor -= span
      return [item.id, middle]
    }),
  )
}

function choosePieTooltipPosition(chart: DOMRect, tooltip: DOMRect, middleAngle: number) {
  const radians = (middleAngle * Math.PI) / 180
  const horizontal = Math.cos(radians)
  const vertical = Math.sin(radians)
  const gap = 10
  const edge = 8
  const centerX = chart.left + chart.width / 2
  const centerY = chart.top + chart.height / 2
  const placements = {
    right: { left: chart.right + gap, top: centerY - tooltip.height / 2 },
    left: { left: chart.left - tooltip.width - gap, top: centerY - tooltip.height / 2 },
    top: { left: centerX - tooltip.width / 2, top: chart.top - tooltip.height - gap },
    bottom: { left: centerX - tooltip.width / 2, top: chart.bottom + gap },
  }
  const preferred =
    Math.abs(horizontal) >= Math.abs(vertical)
      ? horizontal >= 0
        ? 'right'
        : 'left'
      : vertical >= 0
        ? 'bottom'
        : 'top'
  const order = [preferred, 'right', 'left', 'top', 'bottom'] as const
  const candidates = [...new Set(order)].map((side, rank) => {
    const candidate = placements[side]
    const right = candidate.left + tooltip.width
    const bottom = candidate.top + tooltip.height
    const overflow =
      Math.max(0, edge - candidate.left) +
      Math.max(0, right - (window.innerWidth - edge)) +
      Math.max(0, edge - candidate.top) +
      Math.max(0, bottom - (window.innerHeight - edge))
    const overlapWidth = Math.max(
      0,
      Math.min(right, chart.right) - Math.max(candidate.left, chart.left),
    )
    const overlapHeight = Math.max(
      0,
      Math.min(bottom, chart.bottom) - Math.max(candidate.top, chart.top),
    )
    return { ...candidate, score: overflow * 100_000 + overlapWidth * overlapHeight + rank }
  })
  const selected = candidates.sort((left, right) => left.score - right.score)[0] || placements.right
  return {
    left: Math.min(
      Math.max(edge, selected.left),
      Math.max(edge, window.innerWidth - tooltip.width - edge),
    ),
    top: Math.min(
      Math.max(edge, selected.top),
      Math.max(edge, window.innerHeight - tooltip.height - edge),
    ),
  }
}

function AuthorPieTooltip({
  chartRef,
  datum,
  total,
  unit,
  middleAngle,
}: {
  chartRef: RefObject<HTMLDivElement | null>
  datum: AuthorPieDatum
  total: number
  unit: string
  middleAngle: number
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const update = () => {
      if (!chartRef.current || !tooltipRef.current) return
      setPosition(
        choosePieTooltipPosition(
          chartRef.current.getBoundingClientRect(),
          tooltipRef.current.getBoundingClientRect(),
          middleAngle,
        ),
      )
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = new ResizeObserver(update)
    if (chartRef.current) observer.observe(chartRef.current)
    if (tooltipRef.current) observer.observe(tooltipRef.current)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer.disconnect()
    }
  }, [chartRef, middleAngle])

  const percentage = total ? Math.round((datum.value / total) * 100) : 0
  return createPortal(
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed z-50"
      style={{
        left: position?.left || 0,
        top: position?.top || 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <ChartTooltipContent
        active
        hideLabel
        payload={[
          {
            name: 'value',
            value: datum.value,
            dataKey: 'value',
            color: datum.color,
            graphicalItemId: 'author-pie',
            payload: datum,
          },
        ]}
        className={chartTooltipClassName}
        formatter={() => (
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
                {datum.value.toLocaleString()} {unit}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">占比</span>
              <span className="font-mono font-medium tabular-nums">{percentage}%</span>
            </div>
          </div>
        )}
      />
    </div>,
    document.body,
  )
}

export function buildAuthorPie(
  records: RecordItem[],
  metric: TimelineMetric,
  knownPeople: Map<string, string>,
) {
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

export function AuthorDistributionChart({
  data,
  config,
  unit,
}: {
  data: AuthorPieDatum[]
  config: ChartConfig
  unit: string
}) {
  const { activeId, activatePointer, clearPointer, activateFocus, clearFocusWhenLeaving } =
    usePersistentHighlight()
  const [hoveredSectorId, setHoveredSectorId] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const middleAngles = useMemo(() => authorPieMiddleAngles(data), [data])
  const hoveredDatum = data.find((item) => item.id === hoveredSectorId) || null
  const resolvedActiveId = data.some((item) => item.id === activeId) ? activeId : null

  return (
    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[9.25rem_minmax(0,1fr)] sm:gap-[1.125rem]">
      <div ref={chartRef} className="relative mx-auto size-[6.75rem] sm:size-[8.75rem]">
        <ChartContainer
          config={config}
          className="relative z-10 aspect-square size-full"
          onPointerLeave={() => {
            clearPointer()
            setHoveredSectorId(null)
          }}
          onBlur={clearFocusWhenLeaving}
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="59%"
              outerRadius="95%"
              cx="50%"
              cy="50%"
              paddingAngle={2}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((item) => {
                const subdued = resolvedActiveId !== null && resolvedActiveId !== item.id
                return (
                  <Cell
                    key={item.id}
                    fill={item.color}
                    opacity={subdued ? 0.3 : 1}
                    stroke="var(--background)"
                    strokeWidth={resolvedActiveId === item.id ? 4 : 2}
                    tabIndex={0}
                    role="img"
                    aria-label={`${item.name}：${item.value.toLocaleString()} ${unit}`}
                    className="cursor-default outline-none transition-[opacity,stroke-width] duration-(--interaction-duration-standard) focus-visible:opacity-100"
                    onPointerEnter={() => {
                      activatePointer(item.id)
                      setHoveredSectorId(item.id)
                    }}
                    onFocus={() => {
                      activateFocus(item.id)
                      setHoveredSectorId(item.id)
                    }}
                  />
                )
              })}
            </Pie>
          </PieChart>
          {hoveredDatum && (
            <AuthorPieTooltip
              chartRef={chartRef}
              datum={hoveredDatum}
              total={total}
              unit={unit}
              middleAngle={middleAngles.get(hoveredDatum.id) || 0}
            />
          )}
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center text-center">
          <strong className="font-heading text-xl leading-none tabular-nums">
            {total.toLocaleString()}
          </strong>
        </div>
      </div>
      <ul
        className="grid min-w-0 list-none gap-1"
        aria-label="记录人占比图例"
        onPointerLeave={clearPointer}
        onBlur={clearFocusWhenLeaving}
      >
        {data.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0
          return (
            <li key={item.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-auto w-full justify-between gap-3 px-2 py-1.5 text-meta',
                  'aria-pressed:bg-muted aria-pressed:text-foreground dark:aria-pressed:bg-muted/50',
                )}
                aria-pressed={resolvedActiveId === item.id}
                onPointerEnter={() => {
                  activatePointer(item.id)
                  setHoveredSectorId(null)
                }}
                onFocus={() => {
                  activateFocus(item.id)
                  setHoveredSectorId(null)
                }}
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

export function TimelineBarChart({
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
