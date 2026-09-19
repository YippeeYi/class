import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CalendarDays,
  ChartNoAxesCombined,
  EyeOff,
  FileText,
  Image,
  Lightbulb,
  Map as MapIcon,
  MessageSquareQuote,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ErrorState } from '@/components/archive/async-state'
import { GitHubStarPanel } from '@/components/archive/github-star-panel'
import { GuidePanel } from '@/components/archive/guide-panel'
import {
  archiveItemSurfaceClassName,
  interactiveSurfaceVariants,
} from '@/components/archive/interaction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useArchive } from '@/features/archive/archive-context'
import { useContentPreferences } from '@/features/preferences/content-preferences'

const tips = [
  '小提示：图片均可点击查看大图。',
  '小提示：人名可点击跳转至个人界面。',
  '小提示：可以在风格页分别调整配色和背景。',
  '小提示：看看注释吧！',
]

const secondary = [
  {
    to: '/timeline',
    label: '统计',
    icon: ChartNoAxesCombined,
  },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/quiz', label: '答题', icon: BrainCircuit },
  { to: '/materials', label: '资料', icon: FileText },
  { to: '/map', label: '地图', icon: MapIcon },
  { to: '/backgrounds', label: '风格', icon: Image },
  { to: '/credits', label: '致谢', icon: Sparkles },
]

export function HomePage() {
  const resource = useArchive()
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))
  const [logoFailed, setLogoFailed] = useState(false)
  const { hideProfanity, setHideProfanity } = useContentPreferences()

  useEffect(() => {
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
          <div className="flex flex-col justify-center px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
            <div className="mb-3 w-fit max-w-full select-none" aria-label="编日史 Logo" role="img">
              {logoFailed ? (
                <span className="pointer-events-none block select-none font-heading text-4xl font-semibold tracking-tight">
                  编日史
                </span>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}logo-guide-preview.png`}
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
          </div>

          <aside className="grid auto-rows-fr content-center gap-3 border-t border-border/65 bg-background/28 p-4 sm:p-5 lg:border-t-0 lg:border-l lg:p-6">
            <GitHubStarPanel />
            <GuidePanel icon={ShieldAlert} title="仅供班级内部查看">
              请尊重个人信息与共同记忆，不要外传。
            </GuidePanel>
            {today.hasMatches && (
              <GuidePanel
                icon={CalendarDays}
                title="历史上的今天"
                to={`/records?month=${today.month}&day=${today.day}`}
              >
                {today.month}.{today.day}
              </GuidePanel>
            )}
            <GuidePanel
              icon={EyeOff}
              title="隐藏脏话"
              toggle={{
                id: 'hide-profanity',
                checked: hideProfanity,
                onCheckedChange: setHideProfanity,
                label: '隐藏所有记录中的脏话',
              }}
            >
              以 *** 替代粗俗用语
            </GuidePanel>
            <GuidePanel icon={Lightbulb} title="小提示">
              <span className="guide-tip block min-h-5" aria-live="polite">
                <span
                  key={tipIndex}
                  className="inline-block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow)"
                >
                  {(tips[tipIndex] || '').replace(/^小提示：/, '')}
                </span>
              </span>
            </GuidePanel>
          </aside>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden bg-card/90 py-0">
        <CardHeader className="border-b border-border/65 px-5 py-4 sm:px-6">
          <CardTitle className="font-heading text-xl">核心档案</CardTitle>
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
                <Skeleton key={key} className="h-28 rounded-xl" />
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
                  icon: BookOpenText,
                },
                {
                  to: '/people',
                  label: '人物',
                  value: archiveData.people.length,
                  icon: Users,
                },
                {
                  to: '/quotes',
                  label: '名言',
                  value: archiveData.quotes.length,
                  icon: MessageSquareQuote,
                },
              ].map(({ to, label, value, icon: Icon }) => (
                <Item
                  key={to}
                  variant="outline"
                  className={`${interactiveSurfaceVariants({ kind: 'item' })} ${archiveItemSurfaceClassName} grid h-full min-h-28 content-between gap-0 p-4 sm:p-5`}
                  render={<Link to={to} />}
                >
                  <div className="flex items-center justify-between gap-3">
                    <ItemMedia
                      variant="icon"
                      className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
                    >
                      <Icon className="size-5" />
                    </ItemMedia>
                    <ItemActions>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </ItemActions>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-heading text-lg font-semibold">{label}</h2>
                      <strong className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
                        {value.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </Item>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden bg-card/90 py-0">
        <CardHeader className="border-b border-border/65 px-5 py-4 sm:px-6">
          <CardTitle className="font-heading text-xl">继续探索</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {secondary.map(({ to, label, icon: Icon }) => (
            <Item
              key={to}
              variant="outline"
              className={`${interactiveSurfaceVariants({ kind: 'item' })} ${archiveItemSurfaceClassName} min-h-16 px-4 py-3`}
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
              </ItemContent>
              <ItemActions>
                <ArrowRight className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
