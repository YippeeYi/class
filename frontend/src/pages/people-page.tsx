import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useArchive } from '@/features/archive/archive-context'
import { stripMarkup } from '@/lib/markup'
import { buildPeopleStats } from '@/lib/stats'

const roleLabels = { student: '同学', teacher: '老师', other: '其他' }
type Role = keyof typeof roleLabels
type SortKey = 'id' | 'participation' | 'record' | 'characters' | 'subject'

export function PeoplePage() {
  const [role, setRole] = useState<Role>('student')
  const [sort, setSort] = useState<SortKey>('id')
  const [descending, setDescending] = useState(false)
  const resource = useArchive()

  useEffect(() => {
    document.title = '人物名单 · 编日史'
  }, [])
  const stats = useMemo(() => buildPeopleStats(resource.data?.records || []), [resource.data])
  const people = useMemo(
    () =>
      (resource.data?.people || [])
        .filter(
          (person) =>
            (['student', 'teacher'].includes(person.role) ? person.role : 'other') === role,
        )
        .sort((a, b) => {
          const direction = descending ? -1 : 1
          if (sort === 'participation')
            return (
              ((stats.participation.get(a.id) || 0) - (stats.participation.get(b.id) || 0)) *
                direction || a.id.localeCompare(b.id)
            )
          if (sort === 'record')
            return (
              ((stats.authored.get(a.id) || 0) - (stats.authored.get(b.id) || 0)) * direction ||
              a.id.localeCompare(b.id)
            )
          if (sort === 'characters')
            return (
              ((stats.characters.get(a.id) || 0) - (stats.characters.get(b.id) || 0)) * direction ||
              a.id.localeCompare(b.id)
            )
          if (sort === 'subject')
            return (
              a.subject.localeCompare(b.subject, 'zh-CN') * direction || a.id.localeCompare(b.id)
            )
          return a.id.localeCompare(b.id) * direction
        }),
    [descending, resource.data, role, sort, stats],
  )

  return (
    <div>
      <PageHeading
        title="人物名单"
        description="查看档案中的同学、老师与其他人物，以及他们参与和记录事件的数量。"
        actions={
          <div className="flex gap-2">
            <NativeSelect value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <NativeSelectOption value="id">按 ID</NativeSelectOption>
              <NativeSelectOption value="participation">按参与数</NativeSelectOption>
              {role === 'student' && (
                <NativeSelectOption value="record">按记录数</NativeSelectOption>
              )}
              {role === 'student' && (
                <NativeSelectOption value="characters">按记录字数</NativeSelectOption>
              )}
              {role === 'teacher' && (
                <NativeSelectOption value="subject">按学科</NativeSelectOption>
              )}
            </NativeSelect>
            <Button
              variant="outline"
              size="icon"
              aria-label={descending ? '切换升序' : '切换降序'}
              onClick={() => setDescending((value) => !value)}
            >
              {descending ? <ArrowDownAZ /> : <ArrowUpAZ />}
            </Button>
          </div>
        }
      />
      <Tabs
        value={role}
        onValueChange={(value) => {
          setRole(value as Role)
          setSort('id')
        }}
        className="mb-5"
      >
        <TabsList>
          {Object.entries(roleLabels).map(([value, label]) => (
            <TabsTrigger value={value} key={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {resource.loading && <PageSkeleton rows={5} />}
      {resource.error && <ErrorState title="人物名单加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">姓名</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead>参与</TableHead>
                  {role === 'student' && (
                    <>
                      <TableHead>记录</TableHead>
                      <TableHead>字数</TableHead>
                    </>
                  )}
                  {role === 'teacher' && <TableHead>学科</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow
                    key={person.id}
                  >
                    <TableCell className="pl-5 font-medium">
                      <Link
                        className="text-primary underline-offset-4 hover:underline"
                        to={`/person?id=${encodeURIComponent(person.id)}`}
                      >
                        {stripMarkup(person.name || person.id)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {stripMarkup(person.alias) || '—'}
                    </TableCell>
                    <TableCell>{stats.participation.get(person.id) || 0}</TableCell>
                    {role === 'student' && (
                      <>
                        <TableCell>{stats.authored.get(person.id) || 0}</TableCell>
                        <TableCell>{stats.characters.get(person.id) || 0}</TableCell>
                      </>
                    )}
                    {role === 'teacher' && (
                      <TableCell>{stripMarkup(person.subject) || '—'}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
