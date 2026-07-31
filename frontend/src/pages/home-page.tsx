import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  Clock3,
  FileText,
  Image,
  Map as MapIcon,
  MessageSquareQuote,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useArchive } from '@/features/archive/archive-context'

const secondary = [
  { to: '/timeline', label: '时间线', description: '按年月回看档案密度', icon: Clock3 },
  { to: '/search', label: '全站搜索', description: '搜索记录、人物与名言', icon: Search },
  { to: '/quiz', label: '档案答题', description: '从共同记忆里抽一道题', icon: BrainCircuit },
  { to: '/materials', label: '资料', description: '阅读补充资料与专题', icon: FileText },
  { to: '/map', label: '蹭饭图', description: '班级成员内部地图', icon: MapIcon },
  { to: '/backgrounds', label: '背景', description: '选择全站视觉背景', icon: Image },
  { to: '/credits', label: '制作与致谢', description: '记录每一位贡献者', icon: Sparkles },
]

export function HomePage() {
  const resource = useArchive()

  useEffect(() => {
    document.title = '编日史 · 导览'
  }, [])

  return (
    <div>
      <section className="relative mb-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 px-6 py-10 shadow-sm sm:px-10 sm:py-14">
        <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,oklch(0.75_0.08_70/.22),transparent_66%)]" />
        <div className="relative max-w-3xl">
          <Badge variant="outline" className="mb-5 bg-background/55">
            CLASS ARCHIVE · 共同记忆
          </Badge>
          <img
            src="/logo-guide.png"
            alt="编日史"
            width="1035"
            height="462"
            className="mb-5 h-auto w-72 max-w-full object-contain object-left sm:w-96"
          />
          <p className="max-w-xl text-base leading-8 text-muted-foreground">
            把散落在日常里的事件、人物、话语和资料，整理成一部可以搜索、回看，也可以继续生长的班级档案。
          </p>
        </div>
      </section>

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
                <Link
                  to={to}
                  key={to}
                  className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/65 p-4 transition hover:border-primary/25 hover:bg-card"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm">{label}</strong>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
