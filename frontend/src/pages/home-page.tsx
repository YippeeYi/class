import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  ChartNoAxesCombined,
  FileText,
  Image,
  Map as MapIcon,
  MessageSquareQuote,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeaderActions } from '@/components/layout/page-header'
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
import { useArchive } from '@/features/archive/archive-context'

const tips = [
  '小提示：点击 logo 没有彩蛋。',
  '小提示：图片均可点击查看大图。',
  '小提示：人名可点击跳转至个人界面。',
  '小提示：可以在背景页切换全站背景。',
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
  { to: '/backgrounds', label: '背景', description: '选择全站视觉背景', icon: Image },
]

export function HomePage() {
  const resource = useArchive()
  const navigate = useNavigate()
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))
  const [logoAnimation, setLogoAnimation] = useState<'tap' | 'secret' | ''>('')
  const [logoFailed, setLogoFailed] = useState(false)
  const logoTapCount = useRef(0)
  const logoTapTimer = useRef<number | undefined>(undefined)

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

  useEffect(
    () => () => {
      if (logoTapTimer.current) window.clearTimeout(logoTapTimer.current)
    },
    [],
  )

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

  const tapLogo = () => {
    logoTapCount.current += 1
    if (logoTapTimer.current) window.clearTimeout(logoTapTimer.current)
    logoTapTimer.current = window.setTimeout(() => {
      logoTapCount.current = 0
    }, 1200)
    const animation = logoTapCount.current >= 5 ? 'secret' : 'tap'
    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0
    }
    setLogoAnimation('')
    window.requestAnimationFrame(() => setLogoAnimation(animation))
  }

  return (
    <div>
      <section className="relative mb-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 px-6 py-10 shadow-sm sm:px-10 sm:py-14">
        <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,oklch(0.75_0.08_70/.22),transparent_66%)]" />
        <div className="relative max-w-3xl">
          <Badge variant="outline" className="mb-5 bg-background/55">
            CLASS ARCHIVE · 共同记忆
          </Badge>
          <Button
            type="button"
            variant="ghost"
            aria-label="编日史 Logo"
            className="h-auto w-auto max-w-full justify-start p-0 hover:bg-transparent"
            onClick={tapLogo}
          >
            {logoFailed ? (
              <span className="mb-5 block font-heading text-5xl font-semibold tracking-tight">
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
                className={`guide-logo mb-5 h-auto w-72 max-w-full object-contain object-left brightness-0 sm:w-96 dark:invert ${logoAnimation ? `guide-logo-${logoAnimation}` : ''}`}
              />
            )}
          </Button>
          <p className="max-w-xl text-base leading-8 text-muted-foreground">
            把散落在日常里的事件、人物、话语和资料，整理成一部可以搜索、回看，也可以继续生长的班级档案。
          </p>
          <p className="guide-tip mt-4 text-sm text-muted-foreground" aria-live="polite">
            <span
              key={tipIndex}
              className="inline-block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
            >
              {tips[tipIndex]}
            </span>
          </p>
        </div>
      </section>

      <Alert className="mb-6 border-primary/25 bg-card/72 backdrop-blur-sm">
        <ShieldAlert />
        <AlertTitle>仅供班级内部查看</AlertTitle>
        <AlertDescription>请尊重档案中的个人信息与共同记忆，不要外传。</AlertDescription>
      </Alert>

      {today.hasMatches && (
        <PageHeaderActions mobileClassName="mb-6 flex">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate(
                `/records?month=${encodeURIComponent(today.month)}&day=${encodeURIComponent(today.day)}`,
              )
            }
          >
            历史上的今天
          </Button>
        </PageHeaderActions>
      )}

      {resource.loading && <PageSkeleton rows={3} />}
      {resource.error && <ErrorState title="档案概览加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <>
          <section className="mb-10 grid gap-4 md:grid-cols-3">
            {[
              {
                to: '/records',
                label: '记录',
                value: resource.data.records.length,
                description: '按日期整理的共同经历',
                icon: BookOpenText,
              },
              {
                to: '/people',
                label: '人物',
                value: resource.data.people.length,
                description: '档案里的同学、老师与朋友',
                icon: Users,
              },
              {
                to: '/quotes',
                label: '名言',
                value: resource.data.quotes.length,
                description: '从原始记录中派生的原话',
                icon: MessageSquareQuote,
              },
            ].map(({ to, label, value, description, icon: Icon }) => (
              <Link to={to} key={to} className="group">
                <Card className="h-full transition duration-200 group-hover:-translate-y-1 group-hover:ring-primary/25">
                  <CardHeader>
                    <div className="mb-5 flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <CardTitle className="font-heading text-lg">{label}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <strong className="font-heading text-4xl font-semibold tracking-tight">
                      {value}
                    </strong>
                    <span className="ml-2 text-xs text-muted-foreground">项</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-primary/65">EXPLORE</p>
                <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
                  继续探索
                </h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {secondary.map(({ to, label, description, icon: Icon }) => (
                <Item key={to} variant="outline" render={<Link to={to} />}>
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{label}</ItemTitle>
                    <ItemDescription>{description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Item>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
