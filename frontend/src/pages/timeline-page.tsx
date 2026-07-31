import { BookOpenText, CalendarDays, PenLine, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { countTextCharacters, extractParticipantIds } from '@/lib/markup'

export function TimelinePage() {
  const [metric, setMetric] = useState<'count' | 'characters'>('count')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const resource = useArchive()
  useEffect(() => {
    document.title = '档案时间线 · 编日史'
  }, [])
  const years = useMemo(
    () =>
      [
        ...new Set(
          (resource.data?.records || []).map((record) => record.date.slice(0, 4)).filter(Boolean),
        ),
      ]
        .sort()
        .reverse(),
    [resource.data],
  )
  useEffect(() => {
    if (!year && years[0]) setYear(years[0])
  }, [year, years])
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((key) => {
        const records = (resource.data?.records || []).filter((record) =>
          record.date.startsWith(`${year}-${key}`),
        )
        return {
          key,
          records,
          value:
            metric === 'count'
              ? records.length
              : records.reduce((sum, record) => sum + countTextCharacters(record.content), 0),
        }
      }),
    [metric, resource.data, year],
  )
  const max = Math.max(1, ...months.map((item) => item.value))
  const selected =
    months.find((item) => item.key === month) ||
    months.find((item) => item.records.length) ||
    months[0]
  const activePeople = new Set(
    (resource.data?.records || []).flatMap((record) => extractParticipantIds(record.content)),
  ).size
  return (
    <div>
      <PageHeading
        title="档案时间线"
        description="按年份与月份查看记录密度、重要事件、活跃人物和档案字数。"
        actions={
          <>
            <NativeSelect
              value={year}
              onChange={(event) => {
                setYear(event.target.value)
                setMonth('')
              }}
            >
              {years.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item} 年
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Tabs
              value={metric}
              onValueChange={(value) => setMetric(value as 'count' | 'characters')}
            >
              <TabsList>
                <TabsTrigger value="count">记录条数</TabsTrigger>
                <TabsTrigger value="characters">记录字数</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />
      {resource.loading && <PageSkeleton rows={5} />}
      {resource.error && <ErrorState title="时间线加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: '全部记录', value: resource.data.records.length, icon: BookOpenText },
              {
                label: '重要事件',
                value: resource.data.records.filter((record) => record.importance === 'important')
                  .length,
                icon: CalendarDays,
              },
              { label: '活跃人物', value: activePeople, icon: Users },
              {
                label: '档案总字数',
                value: resource.data.records.reduce(
                  (sum, record) => sum + countTextCharacters(record.content),
                  0,
                ),
                icon: PenLine,
              },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="bg-card/78">
                <CardContent className="flex items-center gap-4 pt-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <strong className="font-heading text-2xl">{value.toLocaleString()}</strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
          <Card className="mb-6 bg-card/80">
            <CardHeader>
              <CardTitle>{year} 年月度分布</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {months.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setMonth(item.key)}
                  className={`group flex min-w-0 flex-col items-center gap-2 rounded-xl p-2 transition ${selected?.key === item.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <div className="flex h-28 w-full items-end rounded-md bg-muted/55 p-1 group-hover:bg-muted">
                    <span
                      className={`w-full rounded-sm ${selected?.key === item.key ? 'bg-primary-foreground/75' : 'bg-primary/70'}`}
                      style={{
                        height: `${Math.max(item.value ? 8 : 2, (item.value / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[0.68rem]">{item.key}月</span>
                  <span className="text-[0.65rem] opacity-70">{item.value}</span>
                </button>
              ))}
            </CardContent>
          </Card>
          {selected && (
            <Card className="bg-card/80">
              <CardHeader>
                <CardTitle>
                  {year} 年 {selected.key} 月
                </CardTitle>
                <Progress value={max ? (selected.value / max) * 100 : 0} />
              </CardHeader>
              <CardContent>
                {selected.records.length ? (
                  <div className="grid gap-2">
                    {selected.records
                      .sort((a, b) => b.id.localeCompare(a.id))
                      .map((record) => (
                        <Link
                          key={record.fileName}
                          to={`/records?view=list#record-${record.fileName.replace(/\.json$/i, '')}`}
                          className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition hover:bg-muted"
                        >
                          <Badge
                            variant={record.importance === 'important' ? 'default' : 'outline'}
                          >
                            {record.date.slice(8, 10) || '--'} 日
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {record.author || '匿名记录'} · #{record.id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {countTextCharacters(record.content)} 字
                          </span>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">这个月没有记录。</p>
                )}
                <div className="mt-5 flex justify-end">
                  <Link
                    to={`/records?year=${year}&month=${selected.key}`}
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    查看本月记录
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
