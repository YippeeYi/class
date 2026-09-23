import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  EyeOff,
  Lightbulb,
  ShieldAlert,
  Shuffle,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'

import { ErrorState } from '@/components/archive/async-state'
import { GuideInfo } from '@/components/archive/guide-panel'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { Button } from '@/components/ui/button'
import { Item } from '@/components/ui/item'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  const [coverOpen, setCoverOpen] = useState(true)
  const coverRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const enterCoverRef = useRef(() => {})
  const { hideProfanity, setHideProfanity } = useContentPreferences()

  useEffect(() => {
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    resetScroll()
    window.addEventListener('pageshow', resetScroll)
    return () => window.removeEventListener('pageshow', resetScroll)
  }, [])

  useLayoutEffect(() => {
    if (!coverOpen) {
      contentRef.current?.focus({ preventScroll: true })
      return
    }
    const cover = coverRef.current
    if (!cover) return
    const root = document.getElementById('root')
    const html = document.documentElement
    const body = document.body
    const previous = {
      inert: root?.inert ?? false,
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      overscroll: body.style.overscrollBehavior,
    }
    if (root) root.inert = true
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    cover.focus({ preventScroll: true })

    let leaving = false
    let animation: Animation | undefined
    let mastheadAnimation: Animation | undefined
    let distance = 0
    let lastWheelAt = 0
    let touchStart: { x: number; y: number } | undefined
    const enter = () => {
      if (leaving) return
      leaving = true
      cover.dataset.state = 'leaving'
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const duration = reducedMotion ? 240 : 1100
      mastheadAnimation = cover.querySelector('.guide-masthead')?.animate(
        [
          { translate: '0 0', filter: 'brightness(1)', opacity: 1 },
          {
            translate: reducedMotion ? '0 0' : '0 -2vh',
            filter: 'brightness(0.9)',
            opacity: 0.85,
            offset: 0.3,
          },
          {
            translate: reducedMotion ? '0 0' : '0 -8vh',
            filter: 'brightness(0.55)',
            opacity: 0.35,
            offset: 0.7,
          },
          { translate: reducedMotion ? '0 0' : '0 -12vh', filter: 'brightness(0.3)', opacity: 0 },
        ],
        { id: 'guide-masthead-exit', duration, easing: 'ease-in-out', fill: 'forwards' },
      )
      animation = cover.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], {
        id: 'guide-cover-exit',
        duration,
        easing: 'ease-in-out',
        fill: 'forwards',
      })
      animation.onfinish = () => setCoverOpen(false)
    }
    enterCoverRef.current = enter
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      if (leaving) return
      const now = performance.now()
      if (now - lastWheelAt > 200) distance = 0
      lastWheelAt = now
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? cover.clientHeight : 1
      distance = Math.max(0, distance + event.deltaY * unit)
      if (distance >= 64) enter()
    }
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches.length === 1 ? event.touches[0] : undefined
      touchStart = touch ? { x: touch.clientX, y: touch.clientY } : undefined
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!touchStart || event.touches.length !== 1) return
      event.preventDefault()
      if (leaving) return
      const touch = event.touches[0]
      if (!touch) return
      const vertical = touchStart.y - touch.clientY
      if (vertical >= 64 && vertical > Math.abs(touchStart.x - touch.clientX)) enter()
    }
    const onTouchEnd = () => {
      touchStart = undefined
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (['ArrowDown', 'PageDown', ' ', 'Enter', 'End'].includes(event.key)) {
        event.preventDefault()
        if (event.key === 'ArrowDown') {
          distance += 32
          if (distance >= 64) enter()
        } else enter()
      } else if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
        event.preventDefault()
        distance = 0
      } else if (event.key === 'Tab') {
        // The cover's accessible entry is the only focus target until it is removed.
        event.preventDefault()
        cover.querySelector<HTMLButtonElement>('button')?.focus()
      }
    }
    cover.addEventListener('wheel', onWheel, { passive: false })
    cover.addEventListener('touchstart', onTouchStart, { passive: true })
    cover.addEventListener('touchmove', onTouchMove, { passive: false })
    cover.addEventListener('touchend', onTouchEnd)
    cover.addEventListener('touchcancel', onTouchEnd)
    cover.addEventListener('keydown', onKeyDown)
    return () => {
      animation?.cancel()
      mastheadAnimation?.cancel()
      enterCoverRef.current = () => {}
      cover.removeEventListener('wheel', onWheel)
      cover.removeEventListener('touchstart', onTouchStart)
      cover.removeEventListener('touchmove', onTouchMove)
      cover.removeEventListener('touchend', onTouchEnd)
      cover.removeEventListener('touchcancel', onTouchEnd)
      cover.removeEventListener('keydown', onKeyDown)
      if (root) root.inert = previous.inert
      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      body.style.overscrollBehavior = previous.overscroll
    }
  }, [coverOpen])

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
      {coverOpen &&
        createPortal(
          <section
            ref={coverRef}
            className="guide-cover"
            tabIndex={-1}
            aria-label="编日史封面，向下滚动或按回车键进入正文"
          >
            <div className="guide-cover-page">
              <div className="guide-masthead">
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
              </div>
              <div className="guide-scroll-hint">
                <p>
                  <span>向下滚动查看内容</span>
                  <ChevronDown className="size-4" aria-hidden="true" />
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="guide-cover-access"
                onClick={() => enterCoverRef.current()}
              >
                进入导览内容
              </Button>
            </div>
          </section>,
          document.body,
        )}
      <div className="guide-body" ref={contentRef} tabIndex={-1}>
        <div className="guide-content">
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
          {archiveData && !resource.error && edition.matches.length === 0 && (
            <section className="guide-history" aria-labelledby="guide-history-empty-title">
              <Item className="guide-action guide-history-note" data-guide-panel="static">
                <span className="guide-action-heading" id="guide-history-empty-title">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  今日留白
                </span>
                <span className="guide-calendar font-heading tabular-nums">
                  {edition.month}
                  <span> / </span>
                  {edition.day}
                </span>
                <span className="guide-history-excerpt">今天的篇章，留给正在发生的故事。</span>
              </Item>
            </section>
          )}
          <Item
            className={`${actionClassName} guide-setting`}
            data-guide-panel="interactive"
            render={<Label htmlFor="guide-hide-profanity" />}
          >
            <span className="guide-action-heading">
              <EyeOff className="size-4" aria-hidden="true" />
              隐藏脏话
              <span className="guide-setting-status">
                <span className="guide-setting-state" data-enabled={hideProfanity}>
                  {hideProfanity ? '已开启' : '已关闭'}
                </span>
                <Switch
                  id="guide-hide-profanity"
                  checked={hideProfanity}
                  onCheckedChange={setHideProfanity}
                  aria-label="隐藏所有记录中的脏话"
                  className="focus-visible:ring-0"
                />
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
    </div>
  )
}
