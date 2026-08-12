import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  Image,
  Map as MapIcon,
  MessageSquareQuote,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { ErrorState } from '@/components/archive/async-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useArchive } from '@/features/archive/archive-context'

const tips = [
  '小提示：Logo 仅作为导览标识。',
  '小提示：图片均可点击查看大图。',
  '小提示：人名可点击跳转至个人界面。',
  '小提示：可以在风格页分别调整配色、背景和方框。',
  '小提示：看看注释吧！',
  '小提示：挑战一下答题吗？',
  '小提示：每天看看左上角吧。',
]

const secondary = [
  {
    to: '/timeline',
    label: '统计',
    description: '按年月查看档案数据',
    icon: ChartNoAxesCombined,
  },
  { to: '/search', label: '全站搜索', description: '搜索记录、人物与名言', icon: Search },
  { to: '/quiz', label: '档案答题', description: '从共同记忆里抽一道题', icon: BrainCircuit },
  { to: '/materials', label: '资料', description: '阅读补充资料与专题', icon: FileText },
  { to: '/map', label: '地图', description: '查看班级成员内部地图', icon: MapIcon },
  { to: '/backgrounds', label: '风格', description: '调整配色、背景与方框', icon: Image },
  { to: '/credits', label: '致谢', description: '查看档案的制作与贡献者', icon: Sparkles },
]

export function HomePage() {
  const resource = useArchive()
  const navigate = useNavigate()
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    document.title = '编日史 · 导览'
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    resetScroll()
    window.addEventListener('pageshow', resetScroll)
    return () => window.removeEventListener('pageshow', resetScroll)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex((current) => {
        let next = current
        while (next === current) next = Math.floor(Math.random() * tips.length)
        return next
      })
    }, 3600)
    return () => window.clearInterval(timer)
  }, [])

  const today = useMemo(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const records = resource.data?.records || []
    const matches = records
      .filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.date))
      .filter((record) => record.date.slice(5, 7) === month && record.date.slice(8, 10) === day)
    return { month, day, hasMatches: matches.length > 0 }
  }, [resource.data])

  const archiveData = resource.data

  return (
    <div className="grid gap-5 sm:gap-6">
      <Card className="guide-hero relative gap-0 overflow-hidden border-border/70 bg-card/88 py-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_34%),linear-gradient(135deg,transparent_48%,color-mix(in_oklch,var(--secondary)_32%,transparent))]" />
        <CardContent className="relative grid p-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,.72fr)]">
          <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
            <Badge variant="outline" className="mb-3 bg-background/55">
              CLASS ARCHIVE · 共同记忆
            </Badge>
            <div className="mb-3 w-fit max-w-full select-none" aria-label="编日史 Logo" role="img">
              {logoFailed ? (
                <span className="pointer-events-none block select-none font-heading text-4xl font-semibold tracking-tight">
                  编日史
                </span>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}logo-guide.png`}
                  alt="编日史"
                  width="1035"
                  height="462"
                  draggable={false}
                  decoding="async"
                  fetchPriority="high"
                  onError={() => setLogoFailed(true)}
                  className="pointer-events-none h-auto w-64 max-w-full select-none object-contain object-left brightness-0 sm:w-80 dark:invert"
                />
              )}
            </div>
            <p className="max-w-2xl text-data leading-7 text-muted-foreground sm:text-base">
              把散落在日常里的事件、人物、话语和资料，整理成一部可以搜索、回看，也可以继续生长的班级档案。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button nativeButton={false} render={<Link to="/records" />}>
                浏览记录
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link to="/search" />}>
                <Search data-icon="inline-start" />
                搜索档案
              </Button>
            </div>
          </div>

          <aside className="grid content-center gap-3 border-t border-border/65 bg-background/28 p-4 sm:p-5 lg:border-t-0 lg:border-l lg:p-6">
            {today.hasMatches && (
              <Button
                variant="outline"
                className="h-auto justify-between gap-4 bg-background/52 px-4 py-3 text-left"
                onClick={() =>
                  navigate(
                    `/records?month=${encodeURIComponent(today.month)}&day=${encodeURIComponent(today.day)}`,
                  )
                }
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-xs font-normal text-muted-foreground">
                      {today.month}.{today.day}
                    </span>
                    <span>历史上的今天</span>
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Button>
            )}
            <Alert className="border-primary/20 bg-background/48">
              <ShieldAlert />
              <AlertTitle>仅供班级内部查看</AlertTitle>
              <AlertDescription>请尊重档案中的个人信息与共同记忆，不要外传。</AlertDescription>
            </Alert>
            <div className="rounded-xl border border-border/65 bg-background/38 px-4 py-3">
              <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-primary/70">小提示</p>
              <p
                className="guide-tip min-h-6 text-sm leading-6 text-muted-foreground"
                aria-live="polite"
              >
                <span
                  key={tipIndex}
                  className="inline-block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
                >
                  {(tips[tipIndex] || '').replace(/^小提示：/, '')}
                </span>
              </p>
            </div>
          </aside>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden bg-card/90 py-0">
        <CardHeader className="border-b border-border/65 px-5 py-4 sm:px-6">
          <CardTitle className="font-heading text-xl">核心档案</CardTitle>
          <CardDescription>从最常用的三个入口开始浏览。</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {(resource.loading || (!archiveData && !resource.error)) && (
            <div
              className="grid gap-3 md:grid-cols-3"
              role="status"
              aria-label="正在加载档案概览"
              aria-busy="true"
            >
              {['records', 'people', 'quotes'].map((key) => (
                <Skeleton key={key} className="h-40 rounded-xl" />
              ))}
            </div>
          )}
          {resource.error && (
            <div className="mb-3">
              <ErrorState title="档案概览加载失败" onRetry={resource.retry} />
            </div>
          )}
          {archiveData && (
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  to: '/records',
                  label: '记录',
                  value: archiveData.records.length,
                  description: '按日期整理的共同经历',
                  icon: BookOpenText,
                },
                {
                  to: '/people',
                  label: '人物',
                  value: archiveData.people.length,
                  description: '档案里的同学、老师与朋友',
                  icon: Users,
                },
                {
                  to: '/quotes',
                  label: '名言',
                  value: archiveData.quotes.length,
                  description: '从原始记录中派生的原话',
                  icon: MessageSquareQuote,
                },
              ].map(({ to, label, value, description, icon: Icon }) => (
                <Link
                  to={to}
                  key={to}
                  className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <article className="grid h-full min-h-40 content-between rounded-xl border border-border/70 bg-background/38 p-4 transition-[background-color,border-color] duration-150 group-hover:border-primary/35 group-hover:bg-background/62 group-focus-visible:border-ring sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <div className="mt-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="font-heading text-lg font-semibold">{label}</h2>
                        <strong className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
                          {value.toLocaleString()}
                        </strong>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden bg-card/90 py-0">
        <CardHeader className="border-b border-border/65 px-5 py-4 sm:px-6">
          <CardTitle className="font-heading text-xl">继续探索</CardTitle>
          <CardDescription>统计、工具与档案补充入口集中在这里。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {secondary.map(({ to, label, description, icon: Icon }) => (
            <Item
              key={to}
              variant="outline"
              className="min-h-20 bg-background/32 px-4 py-3 hover:border-primary/30 hover:bg-background/58"
              render={<Link to={to} />}
            >
              <ItemMedia
                variant="icon"
                className="grid size-9 place-items-center rounded-lg bg-primary/9 text-primary"
              >
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{label}</ItemTitle>
                <ItemDescription>{description}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
              </ItemActions>
            </Item>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
