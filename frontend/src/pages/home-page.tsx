import { ArrowRight, CalendarDays, EyeOff, Lightbulb, ShieldAlert, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { ErrorState } from '@/components/archive/async-state'
import { GuideInfo } from '@/components/archive/guide-panel'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { Item } from '@/components/ui/item'
import { useArchive } from '@/features/archive/archive-context'
import { useContentPreferences } from '@/features/preferences/content-preferences'
import { stripMarkup } from '@/lib/markup'
import { filterProfanity } from '@/lib/profanity'
import { recordAnchorId } from '@/lib/record-identity'
import { prepareRecordJump } from '@/lib/record-navigation'
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
      visible,
    }
  }, [archiveData])
  const preview = (value: string) =>
    filterProfanity(stripMarkup(value), hideProfanity).replace(/\s+/g, ' ').trim()

  const actionClassName = `guide-action ${interactiveSurfaceVariants({ kind: 'item' })}`
  const openRandomRecord = () => {
    const record = edition.visible[Math.floor(Math.random() * edition.visible.length)]
    if (!record) return
    prepareRecordJump(recordAnchorId(record))
    navigate('/records')
  }

  return (
    <div className="guide-home text-card-foreground">
      <h1 className="guide-brand" data-guide-logo>
        <img
          src={`${import.meta.env.BASE_URL}logo-guide-preview.png`}
          alt="编日史"
          width={480}
          height={214}
          fetchPriority="high"
          draggable={false}
        />
      </h1>
      <div className="guide-content" data-has-history={edition.matches.length > 0}>
        {edition.matches.length > 0 && (
          <section className="guide-history" aria-labelledby="guide-history-title">
            <Item
              className={actionClassName}
              data-guide-panel="interactive"
              render={<Link to={`/records?month=${edition.month}&day=${edition.day}`} />}
              aria-labelledby="guide-history-title"
            >
              <span className="guide-action-heading" id="guide-history-title">
                <CalendarDays className="size-4" aria-hidden="true" />
                历史上的今天
                <ArrowRight className="guide-action-arrow size-4" aria-hidden="true" />
              </span>
              <span className="guide-calendar font-heading tabular-nums">
                {edition.month}
                <span> / </span>
                {edition.day}
              </span>
              <span className="guide-history-excerpt">
                {preview(edition.matches[0]?.content || '') || '这一天留下了记录。'}
              </span>
            </Item>
            {resource.error && <ErrorState title="记录加载失败" onRetry={resource.retry} />}
          </section>
        )}
        <Item
          className={`${actionClassName} guide-setting`}
          data-guide-panel="interactive"
          render={<button type="button" role="switch" aria-checked={hideProfanity} />}
          aria-label="隐藏所有记录中的脏话"
          onClick={() => setHideProfanity(!hideProfanity)}
        >
          <span className="guide-action-heading">
            <EyeOff className="size-4" aria-hidden="true" />
            隐藏脏话
            <span className="guide-setting-state" data-enabled={hideProfanity}>
              {hideProfanity ? '已开启' : '已关闭'}
            </span>
          </span>
          <span className="guide-action-description">在全部记录中以 *** 替代粗俗用语</span>
        </Item>
        <Item
          className={`${actionClassName} guide-random`}
          data-guide-panel="interactive"
          render={<button type="button" disabled={edition.visible.length === 0} />}
          onClick={openRandomRecord}
        >
          <span className="guide-action-heading">
            <Shuffle className="size-4" aria-hidden="true" />
            随机记录
            <ArrowRight className="guide-action-arrow size-4" aria-hidden="true" />
          </span>
        </Item>
        <aside className="guide-tip">
          <GuideInfo icon={Lightbulb} title="小提示">
            <span className="block min-h-10" aria-live="polite">
              {tips[tipIndex]}
            </span>
          </GuideInfo>
        </aside>
      </div>
      <footer className="guide-privacy" data-guide-info>
        <h2 id="guide-privacy-title">
          <ShieldAlert className="size-4" aria-hidden="true" />
          仅供班级内部查看
        </h2>
        <p>请尊重个人信息与共同记忆，不要外传。</p>
      </footer>
    </div>
  )
}
