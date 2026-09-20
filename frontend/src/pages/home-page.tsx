import { ArrowRight, CalendarDays, EyeOff, Lightbulb, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ErrorState } from '@/components/archive/async-state'
import { ChronicleLogo } from '@/components/archive/chronicle-logo'
import { GuideInfo } from '@/components/archive/guide-panel'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useArchive } from '@/features/archive/archive-context'
import { useContentPreferences } from '@/features/preferences/content-preferences'
import { stripMarkup } from '@/lib/markup'
import { filterProfanity } from '@/lib/profanity'
import '@/styles/home.css'

const tips = [
  '图片均可点击查看大图。',
  '人名可点击跳转至个人界面。',
  '可以在风格页分别调整配色和背景。',
  '看看注释吧！',
]

export function HomePage() {
  const resource = useArchive()
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))
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
    }
  }, [archiveData])
  const preview = (value: string) =>
    filterProfanity(stripMarkup(value), hideProfanity).replace(/\s+/g, ' ').trim()

  return (
    <div className="guide-home text-card-foreground">
      <div className="guide-foundation">
        <section className="guide-privacy" aria-labelledby="guide-privacy-title" data-guide-info>
          <ChronicleLogo className="guide-brand" />
          <ShieldAlert className="guide-privacy-icon size-4 text-primary" aria-hidden="true" />
          <h1 id="guide-privacy-title" className="font-heading">
            仅供班级内部查看
          </h1>
          <p>请尊重个人信息与共同记忆，不要外传。</p>
        </section>
        <section className="guide-setting" aria-labelledby="guide-setting-title">
          <Label
            htmlFor="hide-profanity"
            data-guide-panel="interactive"
            className={`guide-setting-control ${interactiveSurfaceVariants({ kind: 'item' })}`}
          >
            <span className="guide-setting-icon" aria-hidden="true">
              <EyeOff className="size-4" strokeWidth={2} />
            </span>
            <span className="guide-setting-copy">
              <span className="guide-setting-heading">
                <span id="guide-setting-title">脏话隐藏</span>
                <span
                  id="guide-setting-state"
                  className="guide-setting-state"
                  data-enabled={hideProfanity}
                  aria-live="polite"
                >
                  {hideProfanity ? '已开启' : '已关闭'}
                </span>
              </span>
              <span className="guide-setting-description">在全部记录中以 *** 替代粗俗用语</span>
            </span>
            <Switch
              id="hide-profanity"
              checked={hideProfanity}
              onCheckedChange={setHideProfanity}
              aria-label="隐藏所有记录中的脏话"
            />
          </Label>
        </section>
        <aside className="guide-tip">
          <GuideInfo icon={Lightbulb} title="小提示">
            <span className="block min-h-10" aria-live="polite">
              {tips[tipIndex]}
            </span>
          </GuideInfo>
        </aside>
      </div>
      {edition.matches.length > 0 && (
        <section className="guide-history" aria-labelledby="guide-history-title">
          <div className="guide-history-date">
            <h2 id="guide-history-title">
              <CalendarDays className="size-4" aria-hidden="true" />
              历史上的今天
            </h2>
            <p className="guide-calendar font-heading tabular-nums">
              {edition.month}
              <span> / </span>
              {edition.day}
            </p>
          </div>
          <div className="guide-history-reading">
            <p className="guide-history-excerpt">
              {preview(edition.matches[0]?.content || '') || '这一天留下了记录。'}
            </p>
            <Link
              to={`/records?month=${edition.month}&day=${edition.day}`}
              aria-labelledby="guide-history-title"
              className={`guide-inline-link ${interactiveSurfaceVariants({ kind: 'item' })}`}
            >
              查看这一天的记录 <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            {resource.error && <ErrorState title="记录加载失败" onRetry={resource.retry} />}
          </div>
        </section>
      )}
    </div>
  )
}
