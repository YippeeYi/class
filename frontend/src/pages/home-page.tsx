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
import { GuideInfo, GuidePanel } from '@/components/archive/guide-panel'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useArchive } from '@/features/archive/archive-context'
import { useContentPreferences } from '@/features/preferences/content-preferences'
import '@/styles/home.css'

const tips = [
  '小提示：图片均可点击查看大图。',
  '小提示：人名可点击跳转至个人界面。',
  '小提示：可以在风格页分别调整配色和背景。',
  '小提示：看看注释吧！',
]

const tools = [
  {
    to: '/timeline',
    label: '统计',
    icon: ChartNoAxesCombined,
  },
  { to: '/quiz', label: '答题', icon: BrainCircuit },
  { to: '/materials', label: '资料', icon: FileText },
  { to: '/map', label: '地图', icon: MapIcon },
]

const utilities = [
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
    <div className="guide-home bg-card/90 text-card-foreground">
      <header data-guide-header className="guide-masthead">
        <h1 className="m-0 min-w-0" aria-label="编日史">
          {logoFailed ? (
            <span className="font-heading text-4xl font-semibold tracking-tight">编日史</span>
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
              className="pointer-events-none h-auto w-56 max-w-full select-none object-contain object-left brightness-0 sm:w-64 dark:invert"
            />
          )}
        </h1>
        <GuideInfo icon={ShieldAlert} title="仅供班级内部查看">
          请尊重个人信息与共同记忆，不要外传。
        </GuideInfo>
      </header>

      <div data-guide-navigation className="guide-body">
        <section className="guide-archive" aria-labelledby="guide-archive-title">
          <h2 id="guide-archive-title" className="guide-section-title">
            核心档案
          </h2>
          {(resource.loading || (!archiveData && !resource.error)) && (
            <div
              className="guide-stats"
              role="status"
              aria-label="正在加载档案概览"
              aria-busy="true"
            >
              <Skeleton className="guide-record h-56 rounded-xl" />
              <div className="grid gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
          )}
          {resource.error && <ErrorState title="档案概览加载失败" onRetry={resource.retry} />}
          {archiveData && (
            <div className="guide-stats">
              <Link
                to="/records"
                className={`guide-record ${interactiveSurfaceVariants({ kind: 'item' })}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <BookOpenText className="size-5" aria-hidden="true" />
                  记录
                </span>
                <span className="guide-record-count font-heading tabular-nums">
                  {archiveData.records.length.toLocaleString()}
                </span>
                <ArrowRight className="size-5 self-end" aria-hidden="true" />
              </Link>
              <div className="guide-index">
                {[
                  { to: '/people', label: '人物', value: archiveData.people.length, icon: Users },
                  {
                    to: '/quotes',
                    label: '名言',
                    value: archiveData.quotes.length,
                    icon: MessageSquareQuote,
                  },
                ].map(({ to, label, value, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`guide-index-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Icon className="size-4 text-primary" aria-hidden="true" />
                      {label}
                    </span>
                    <span className="flex items-end justify-between gap-1">
                      <span className="font-heading text-[clamp(1.5rem,3cqi,1.875rem)] font-medium tracking-tight tabular-nums">
                        {value.toLocaleString()}
                      </span>
                      <ArrowRight
                        className="mb-1 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {today.hasMatches && (
            <Link
              to={`/records?month=${today.month}&day=${today.day}`}
              className={`guide-today ${interactiveSurfaceVariants({ kind: 'item' })}`}
            >
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              <span className="font-heading text-2xl tracking-tight tabular-nums">
                {today.month}.{today.day}
              </span>
              <span className="text-sm">历史上的今天</span>
              <ArrowRight className="ml-auto size-4 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </section>

        <nav className="guide-explore" aria-labelledby="guide-explore-title">
          <h2 id="guide-explore-title" className="guide-section-title">
            继续探索
          </h2>
          <Link
            to="/search"
            className={`guide-search ${interactiveSurfaceVariants({ kind: 'item' })}`}
          >
            <Search className="size-5 text-primary" aria-hidden="true" />
            <span className="flex-1 text-base font-medium">搜索</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <div className="guide-tools">
            {tools.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`guide-tool ${interactiveSurfaceVariants({ kind: 'item' })}`}
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <span>{label}</span>
                <ArrowRight className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Separator className="my-3 bg-border/60" />
          <div className="guide-utilities">
            {utilities.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`guide-tool ${interactiveSurfaceVariants({ kind: 'item' })}`}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <footer className="guide-footer">
        <div data-guide-preferences className="guide-reading">
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
          <GuideInfo icon={Lightbulb} title="小提示">
            <span className="guide-tip block min-h-10" aria-live="polite">
              {(tips[tipIndex] || '').replace(/^小提示：/, '')}
            </span>
          </GuideInfo>
        </div>
        <aside className="guide-project" aria-label="项目支持">
          <GitHubStarPanel />
        </aside>
      </footer>
    </div>
  )
}
