import {
  ArrowRight,
  CalendarDays,
  EyeOff,
  Lightbulb,
  Quote as QuoteIcon,
  ShieldAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { ErrorState } from '@/components/archive/async-state'
import { GitHubStarPanel } from '@/components/archive/github-star-panel'
import { GuideInfo, GuidePanel } from '@/components/archive/guide-panel'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { Skeleton } from '@/components/ui/skeleton'
import { useArchive } from '@/features/archive/archive-context'
import { useContentPreferences } from '@/features/preferences/content-preferences'
import { stripMarkup } from '@/lib/markup'
import { filterProfanity } from '@/lib/profanity'
import { recordAnchorId, recordHref } from '@/lib/record-identity'
import { isModifiedRecordClick, prepareRecordJump, recordClientHref } from '@/lib/record-navigation'
import '@/styles/home.css'

const tips = [
  '图片均可点击查看大图。',
  '人名可点击跳转至个人界面。',
  '可以在风格页分别调整配色和背景。',
  '看看注释吧！',
]

export function HomePage() {
  const resource = useArchive()
  const navigate = useNavigate()
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

  const archiveData = resource.data
  const edition = useMemo(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const visible = (archiveData?.records || []).filter((record) => !record.hidden)
    const dated = visible
      .filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.date))
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.time.localeCompare(a.time) ||
          b.recordIndex - a.recordIndex,
      )
    const matches = dated.filter((record) => record.date.slice(5) === `${month}-${day}`)
    return {
      month,
      day,
      matches,
      latest: dated[0] || visible[0],
      firstDate: dated.at(-1)?.date,
      lastDate: dated[0]?.date,
    }
  }, [archiveData])
  const preview = (value: string) =>
    filterProfanity(stripMarkup(value), hideProfanity).replace(/\s+/g, ' ').trim()
  const latest = edition.latest
  const quote = archiveData?.quotes[0]

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

      {(resource.loading || (!archiveData && !resource.error)) && (
        <div className="guide-loading" role="status" aria-label="正在加载档案概览" aria-busy="true">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      )}
      {resource.error && <ErrorState title="档案概览加载失败" onRetry={resource.retry} />}
      {archiveData && (
        <div data-guide-navigation className="guide-body">
          <div className="guide-main">
            <section className="guide-archive" aria-labelledby="guide-archive-title">
              <div className="guide-section-heading">
                <h2 id="guide-archive-title">最近的记录</h2>
                {edition.firstDate && edition.lastDate && (
                  <span className="guide-date-range">
                    {edition.firstDate.slice(0, 4) === edition.lastDate.slice(0, 4)
                      ? `收录于 ${edition.firstDate.slice(0, 4)} 年`
                      : `${edition.firstDate.slice(0, 4)} — ${edition.lastDate.slice(0, 4)}`}
                  </span>
                )}
              </div>
              {latest ? (
                <>
                  <div className="guide-dateline">
                    <span className="guide-date font-heading">{latest.date || '未标注日期'}</span>
                    {latest.time && (
                      <span className="text-sm text-muted-foreground">{latest.time}</span>
                    )}
                  </div>
                  <p className="guide-record-excerpt">
                    {preview(latest.content) || '这条记录暂无文字内容。'}
                  </p>
                  <Link
                    to={recordHref(latest)}
                    className={`guide-inline-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
                    onClick={(event) => {
                      if (isModifiedRecordClick(event)) return
                      event.preventDefault()
                      prepareRecordJump(recordAnchorId(latest))
                      navigate(recordClientHref(recordHref(latest)))
                    }}
                  >
                    打开这条记录 <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <p className="guide-empty">暂无记录</p>
              )}
              <Link
                to="/records"
                className={`guide-total ${interactiveSurfaceVariants({ kind: 'item' })}`}
              >
                <span>
                  <strong className="font-heading tabular-nums">
                    {archiveData.records.length.toLocaleString()}
                  </strong>{' '}
                  条记录
                </span>
                <span className="guide-action">
                  查看全部 <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </section>
            <section className="guide-quote" aria-labelledby="guide-quote-title">
              <div className="guide-section-heading">
                <h2 id="guide-quote-title">名言摘录</h2>
                <QuoteIcon className="size-6 text-primary/60" aria-hidden="true" />
              </div>
              {quote ? (
                <blockquote className="guide-quote-text">
                  {preview(quote.quote || quote.content) || '这条名言暂无文字内容。'}
                </blockquote>
              ) : (
                <p className="guide-empty">暂无名言</p>
              )}
              {quote?.sourceDate && <p className="guide-source">{quote.sourceDate}</p>}
              <Link
                to="/quotes"
                className={`guide-inline-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
              >
                查看 {archiveData.quotes.length.toLocaleString()} 则名言{' '}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </section>
          </div>
          <div className="guide-margin">
            {edition.matches.length > 0 && (
              <section className="guide-history" aria-labelledby="guide-history-title">
                <h2 id="guide-history-title" className="guide-section-heading">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  历史上的今天
                </h2>
                <p className="guide-calendar font-heading tabular-nums">
                  {edition.month}
                  <span> / </span>
                  {edition.day}
                </p>
                <p className="guide-history-excerpt">
                  {preview(edition.matches[0]?.content || '') || '这一天留下了记录。'}
                </p>
                <Link
                  to={`/records?month=${edition.month}&day=${edition.day}`}
                  aria-labelledby="guide-history-title"
                  className={`guide-inline-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
                >
                  查看这一天的 {edition.matches.length.toLocaleString()} 条记录{' '}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </section>
            )}
            <section className="guide-people" aria-labelledby="guide-people-title">
              <h2 id="guide-people-title" className="guide-section-heading">
                档案中的人物
              </h2>
              <p className="guide-people-count font-heading tabular-nums">
                {archiveData.people.length.toLocaleString()}
                <span> 位</span>
              </p>
              <ul className="guide-names" aria-label="人物预览">
                {archiveData.people.slice(0, 4).map((person) => (
                  <li key={person.id}>
                    <Link
                      to={`/person?id=${encodeURIComponent(person.id)}`}
                      className={`guide-person-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
                    >
                      {preview(person.name || person.alias || person.id)}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/people"
                className={`guide-inline-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
              >
                查看人物档案 <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </section>
          </div>
        </div>
      )}
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
              {tips[tipIndex]}
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
