import { useMemo } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { buildPieSectorPaths } from '@/lib/stats'
import type { RecordItem } from '@/types/domain'

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

const compactStatisticFormatter = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 0,
})

function compactStatistic(value: number) {
  return Math.abs(value) >= 10_000
    ? compactStatisticFormatter.format(value)
    : value.toLocaleString('zh-CN')
}

export function dailyAuthorColor(index: number) {
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
  const sectors = useMemo(
    () => buildPieSectorPaths(entries.map(([id, value]) => ({ id, value }))),
    [entries],
  )
  return (
    <span
      className="daily-distribution-pie block aspect-square w-[58%] min-w-8 max-w-12 shrink-0"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="block size-full"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="20" cy="20" r="19" fill="var(--muted)" />
        {sectors.map((sector) => (
          <path
            key={sector.id}
            d={sector.path}
            data-author-sector={sector.id}
            fill={colors.get(sector.id) || 'var(--muted-foreground)'}
            opacity={activeId && activeId !== sector.id ? 0.18 : 1}
            className="transition-opacity duration-(--interaction-duration-standard)"
          />
        ))}
        <circle cx="20" cy="20" r="19" fill="none" stroke="var(--border)" strokeWidth="1" />
      </svg>
    </span>
  )
}

type DailyDistributionItem = {
  day: string
  records: RecordItem[]
  value: number
  important: number
  authors: [string, number][]
}

export function DailyDistributionCell({
  item,
  year,
  month,
  unit,
  colors,
  activeAuthor,
}: {
  item: DailyDistributionItem
  year: string
  month: string
  unit: string
  colors: Map<string, string>
  activeAuthor: string | null
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!item.records.length}
      nativeButton={!item.records.length}
      data-records={item.records.length > 0 ? 'present' : 'empty'}
      data-important={item.important > 0 ? 'true' : 'false'}
      className="daily-distribution-cell relative grid aspect-square h-auto min-h-0 min-w-0 justify-normal grid-rows-[auto_1fr] items-stretch gap-0.5 whitespace-normal border-border/75 bg-background/74 p-0.5 text-left shadow-none data-[important=true]:border-amber-500/45 data-[important=true]:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-amber-500)_18%,transparent)] focus-visible:z-10"
      aria-label={`${year} 年 ${month} 月 ${item.day} 日：${item.value.toLocaleString()} ${unit}${item.important > 0 ? `，重要 ${item.important.toLocaleString()} ${unit}` : ''}`}
      render={
        item.records.length ? (
          <Link to={`/records?year=${year}&month=${month}&day=${item.day}`} />
        ) : undefined
      }
    >
      <span className="flex min-h-2.5 w-full min-w-0 items-start justify-between gap-1 text-xs leading-none">
        <span className="daily-distribution-date font-semibold leading-none tabular-nums text-muted-foreground">
          {Number(item.day)}
        </span>
        {item.important > 0 && (
          <span
            className="daily-distribution-important-marker mt-px size-1.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_2px_color-mix(in_oklch,var(--background)_78%,transparent)]"
            aria-hidden="true"
          />
        )}
      </span>
      <span className="flex min-h-0 w-full min-w-0 flex-col items-center justify-center gap-0.5 self-stretch">
        {item.records.length ? (
          <MiniAuthorPie entries={item.authors} colors={colors} activeId={activeAuthor} />
        ) : (
          <span
            className="daily-distribution-pie block aspect-square w-[58%] min-w-8 max-w-12 shrink-0 rounded-full border border-dashed"
            aria-hidden="true"
          />
        )}
        <strong
          className="daily-distribution-value min-w-0 max-w-full whitespace-nowrap text-center text-xs leading-none font-bold tracking-tight tabular-nums"
          title={`${item.value.toLocaleString()} ${unit}`}
        >
          {compactStatistic(item.value)}
        </strong>
      </span>
    </Button>
  )
}
