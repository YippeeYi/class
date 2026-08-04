import { Search, X } from 'lucide-react'
import { useMemo } from 'react'

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
import { Toggle } from '@/components/ui/toggle'
import { normalizeText, unique } from '@/lib/archive'
import { stripMarkup } from '@/lib/markup'
import type { RecordItem } from '@/types/domain'

export type RecordCriteria = {
  year: string
  month: string
  day: string
  important: boolean
  excludeDaily: boolean
  query: string
}

export const EMPTY_RECORD_CRITERIA: RecordCriteria = {
  year: '',
  month: '',
  day: '',
  important: false,
  excludeDaily: false,
  query: '',
}

const recordSearchTextCache = new WeakMap<RecordItem, string>()

export function recordSearchText(record: RecordItem) {
  const cached = recordSearchTextCache.get(record)
  if (cached !== undefined) return cached
  const value = normalizeText(
    [
      record.id,
      record.fileName,
      record.date,
      record.time,
      record.author,
      stripMarkup(record.content),
      ...record.attachments.flatMap((item) => [item.name, item.file]),
    ].join(' '),
  )
  recordSearchTextCache.set(record, value)
  return value
}

export function filterRecords(records: RecordItem[], criteria: RecordCriteria) {
  const needle = normalizeText(criteria.query)
  return records.filter((record) => {
    if (criteria.important && record.importance !== 'important') return false
    if (
      criteria.excludeDaily &&
      String(record.fileName || record.id)
        .replace(/\.json$/i, '')
        .endsWith('-00')
    )
      return false
    const [year, month, day] = record.date.split('-')
    if (criteria.year && year !== criteria.year) return false
    if (criteria.month && month !== criteria.month) return false
    if (criteria.day && day !== criteria.day) return false
    return !needle || recordSearchText(record).includes(needle)
  })
}

export function RecordFilters({
  records,
  value,
  onChange,
}: {
  records: RecordItem[]
  value: RecordCriteria
  onChange: (value: RecordCriteria) => void
}) {
  const { years, months, days } = useMemo(() => {
    const dates = records
      .filter((record) => !record.recordType)
      .map((record) => record.date.split('-'))
    return {
      years: unique(
        dates
          .filter(
            ([, month, day]) =>
              (!value.month || month === value.month) && (!value.day || day === value.day),
          )
          .map(([year]) => year)
          .filter((item): item is string => Boolean(item)),
      ).sort(),
      months: unique(
        dates
          .filter(
            ([year, , day]) =>
              (!value.year || year === value.year) && (!value.day || day === value.day),
          )
          .map(([, month]) => month)
          .filter((item): item is string => Boolean(item)),
      ).sort(),
      days: unique(
        dates
          .filter(
            ([year, month]) =>
              (!value.year || year === value.year) && (!value.month || month === value.month),
          )
          .map(([, , day]) => day)
          .filter((item): item is string => Boolean(item)),
      ).sort(),
    }
  }, [records, value.day, value.month, value.year])
  const active = Object.values(value).some(Boolean)
  const update = (patch: Partial<RecordCriteria>) => onChange({ ...value, ...patch })

  return (
    <Card className="mb-6 bg-card/90 shadow-sm">
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={value.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="搜索正文、日期、记录人或附件"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['year', '全部年份', years, '年'],
              ['month', '全部月份', months, '月'],
              ['day', '全部日期', days, '日'],
            ] satisfies Array<['year' | 'month' | 'day', string, string[], string]>
          ).map(([field, allLabel, options, suffix]) => (
            <Select
              key={String(field)}
              value={value[field] || '__all__'}
              onValueChange={(next) => update({ [field]: next === '__all__' ? '' : next || '' })}
            >
              <SelectTrigger
                aria-label={String(allLabel)}
                className="w-36 bg-background/85 transition-[background-color,border-color,box-shadow] hover:bg-accent/55 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="__all__">{String(allLabel)}</SelectItem>
                {options.map((option) => (
                  <SelectItem value={option} key={option}>
                    {option} {String(suffix)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          <Toggle
            pressed={value.important}
            onPressedChange={(pressed) => update({ important: pressed })}
            variant="outline"
          >
            仅重要
          </Toggle>
          <Toggle
            pressed={value.excludeDaily}
            onPressedChange={(pressed) => update({ excludeDaily: pressed })}
            variant="outline"
          >
            排除每日例行
          </Toggle>
          {active && (
            <Button variant="ghost" onClick={() => onChange(EMPTY_RECORD_CRITERIA)}>
              <X data-icon="inline-start" />
              清除
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
