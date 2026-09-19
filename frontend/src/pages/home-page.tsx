import {
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

import { ErrorState } from '@/components/archive/async-state'
import { GitHubStarPanel } from '@/components/archive/github-star-panel'
import { GuideInfo, GuidePanel } from '@/components/archive/guide-panel'
import { CardContent } from '@/components/ui/card'
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
    <div className="grid gap-8 rounded-xl bg-card/90 p-4 text-card-foreground sm:gap-10 sm:p-6 lg:p-8">
      <section className="guide-hero">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,.72fr)] lg:gap-10">
          <div className="flex min-w-0 flex-col justify-center gap-6 py-2 sm:py-4">
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
            <div className="grid max-w-xl gap-5 sm:grid-cols-2">
              <GuideInfo icon={ShieldAlert} title="仅供班级内部查看">
                请尊重个人信息与共同记忆，不要外传。
              </GuideInfo>
              <GuideInfo icon={Lightbulb} title="小提示">
                <span className="guide-tip block min-h-10" aria-live="polite">
                  <span
                    key={tipIndex}
                    className="inline-block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow)"
                  >
                    {(tips[tipIndex] || '').replace(/^小提示：/, '')}
                  </span>
                </span>
              </GuideInfo>
            </div>
          </div>

          <aside className="grid content-center gap-3">
            <GitHubStarPanel />
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
          </aside>
        </CardContent>
      </section>

      <section className="grid gap-3" aria-label="核心档案">
        <h2 className="font-heading text-lg font-semibold">核心档案</h2>
        <div>
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
                <GuidePanel key={to} to={to} title={label} icon={Icon}>
                  <span className="font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                    {value.toLocaleString()}
                  </span>
                </GuidePanel>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3" aria-label="继续探索">
        <h2 className="font-heading text-lg font-semibold">继续探索</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {secondary.map(({ to, label, icon: Icon }) => (
            <GuidePanel key={to} to={to} title={label} icon={Icon} />
          ))}
        </div>
      </section>
    </div>
  )
}
