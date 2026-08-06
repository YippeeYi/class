import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Toggle } from '@/components/ui/toggle'
import { useArchive } from '@/features/archive/archive-context'
import { stripMarkup } from '@/lib/markup'
import { buildPeopleStats } from '@/lib/stats'
import type { Person } from '@/types/domain'

const roleLabels = { student: '同学', teacher: '老师', other: '其他' }
const subjectOrder = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '政治', '地理']
type Role = keyof typeof roleLabels
type SortKey = 'id' | 'participation' | 'record' | 'characters' | 'subject'
type Stats = ReturnType<typeof buildPeopleStats>

function PeopleSection({ role, people, stats }: { role: Role; people: Person[]; stats: Stats }) {
  const [sort, setSort] = useState<SortKey>('id')
  const [descending, setDescending] = useState(false)
  const [mainFirst, setMainFirst] = useState(false)
  const list = useMemo(() => {
    const direction = descending ? -1 : 1
    return [...people].sort((a, b) => {
      if (role === 'teacher' && mainFirst && a.main !== b.main)
        return Number(b.main) - Number(a.main)
      const idOrder = a.id.localeCompare(b.id) * direction
      if (sort === 'participation')
        return (
          ((stats.participation.get(a.id) || 0) - (stats.participation.get(b.id) || 0)) *
            direction || idOrder
        )
      if (sort === 'record')
        return (
          ((stats.authored.get(a.id) || 0) - (stats.authored.get(b.id) || 0)) * direction || idOrder
        )
      if (sort === 'characters')
        return (
          ((stats.characters.get(a.id) || 0) - (stats.characters.get(b.id) || 0)) * direction ||
          idOrder
        )
      if (sort === 'subject') {
        const rank = (person: Person) => {
          const index = subjectOrder.indexOf(stripMarkup(person.subject).trim())
          return index < 0 ? Number.MAX_SAFE_INTEGER : index
        }
        const aRank = rank(a)
        const bRank = rank(b)
        if (aRank === Number.MAX_SAFE_INTEGER || bRank === Number.MAX_SAFE_INTEGER) {
          if (aRank !== bRank) return aRank === Number.MAX_SAFE_INTEGER ? 1 : -1
        }
        return (aRank - bRank) * direction || idOrder
      }
      return idOrder
    })
  }, [descending, mainFirst, people, role, sort, stats])
  if (!list.length) return null

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>
          {roleLabels[role]}{' '}
          <span className="text-sm font-normal text-muted-foreground">{list.length}</span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger
              size="sm"
              aria-label={`${roleLabels[role]}排序方式`}
              className="min-w-32 bg-background/85 transition-colors hover:bg-accent/55"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="id">按 ID</SelectItem>
              <SelectItem value="participation">按参与数</SelectItem>
              {role === 'student' && <SelectItem value="record">按记录数</SelectItem>}
              {role === 'student' && <SelectItem value="characters">按记录字数</SelectItem>}
              {role === 'teacher' && <SelectItem value="subject">按学科</SelectItem>}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={descending ? '切换为升序' : '切换为降序'}
            title={descending ? '切换为升序' : '切换为降序'}
            onClick={() => setDescending((value) => !value)}
          >
            {descending ? <ArrowDownAZ /> : <ArrowUpAZ />}
          </Button>
          {role === 'teacher' && (
            <Toggle size="sm" variant="outline" pressed={mainFirst} onPressedChange={setMainFirst}>
              主要老师优先
            </Toggle>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <Table className="text-[0.9375rem] leading-6">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">序号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>别名</TableHead>
                <TableHead>参与</TableHead>
                {role === 'student' && (
                  <>
                    <TableHead>记录</TableHead>
                    <TableHead>记录字数</TableHead>
                  </>
                )}
                {role === 'teacher' && <TableHead>学科</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((person, index) => (
                <TableRow key={person.id}>
                  <TableCell className="pl-5 text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      className="text-primary underline-offset-4 hover:underline"
                      to={`/person?id=${encodeURIComponent(person.id)}`}
                    >
                      {stripMarkup(person.name || person.id)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {stripMarkup(person.alias || person.aliases.join('、')) || '—'}
                  </TableCell>
                  <TableCell>{stats.participation.get(person.id) || 0}</TableCell>
                  {role === 'student' && (
                    <>
                      <TableCell>{stats.authored.get(person.id) || 0}</TableCell>
                      <TableCell>
                        {(stats.characters.get(person.id) || 0).toLocaleString()}
                      </TableCell>
                    </>
                  )}
                  {role === 'teacher' && (
                    <TableCell>{stripMarkup(person.subject) || '—'}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function PeoplePage() {
  const resource = useArchive()
  useEffect(() => {
    document.title = '人物名单 · 编日史'
  }, [])
  const stats = useMemo(() => buildPeopleStats(resource.data?.records || []), [resource.data])
  const groups = useMemo(() => {
    const output: Record<Role, Person[]> = { student: [], teacher: [], other: [] }
    for (const person of resource.data?.people || []) {
      const role = person.role === 'student' || person.role === 'teacher' ? person.role : 'other'
      output[role].push(person)
    }
    return output
  }, [resource.data])

  return (
    <div>
      <PageHeading
        title="人物名单"
        description="同学、老师与其他人物按组同时呈现；每一组可独立排序。"
      />
      {resource.loading && <PageSkeleton rows={5} />}
      {resource.error && <ErrorState title="人物名单加载失败" onRetry={resource.retry} />}
      {resource.data && resource.data.people.length === 0 && (
        <EmptyState title="人物名单为空" description="人物资料尚未上传，稍后再来查看。" />
      )}
      {resource.data && resource.data.people.length > 0 && (
        <div className="grid gap-6">
          {(['student', 'teacher', 'other'] as const).map((role) => (
            <PeopleSection key={role} role={role} people={groups[role]} stats={stats} />
          ))}
        </div>
      )}
    </div>
  )
}
