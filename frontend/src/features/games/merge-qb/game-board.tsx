import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Download,
  Maximize2,
  Minimize2,
  RotateCcw,
  Share2,
} from 'lucide-react'
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { signAssetUrl } from '@/services/data'

import {
  FAIL_LINE,
  GAME_HEIGHT,
  GAME_WIDTH,
  type GameSnapshot,
  MAX_DROP_LEVEL_COUNT,
  MergeQbGame,
} from './game'
import { levelImagePath, levelOutlineBounds, QB_LEVELS } from './levels'
import {
  type CelebrationEffect,
  createCelebration,
  createImageMap,
  drawCelebrations,
  drawGame,
  makeOutlinedSprite,
  type QbImages,
  type QbSprites,
} from './render'
import { createShareImage } from './share'
import './game.css'

const largestDroppableSize = Math.max(
  ...QB_LEVELS.slice(0, MAX_DROP_LEVEL_COUNT).map((level) => level.visualSize.height),
)
const regularLevels = QB_LEVELS.slice(0, -1)
const spareSequenceSlots = ['a', 'b', 'c', 'd', 'e']
type ConfirmAction = 'exit' | 'restart' | 'replay'
type ScorePop = {
  id: number
  delta: number
  slot: number
  rise: number
  offset: number
  duration: number
}

const confirmCopy: Record<ConfirmAction, { title: string; description: string; action: string }> = {
  exit: {
    title: '退出游戏？',
    description: '当前局将结束并离开游戏页面。',
    action: '退出游戏',
  },
  restart: {
    title: '重新开始？',
    description: '当前进度和分数将清空，并开始新的一局。',
    action: '重新开始',
  },
  replay: {
    title: '再来一局？',
    description: '当前结束结果将关闭，并开始新的一局。',
    action: '再来一局',
  },
}

export function MergeQbBoard() {
  const navigate = useNavigate()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sequenceRef = useRef<HTMLOListElement>(null)
  const gameRef = useRef<MergeQbGame | null>(null)
  const loadAssetsRef = useRef<(force?: boolean) => Promise<void>>(async () => {})
  const touchPointer = useRef<number | null>(null)
  const clearCelebrationsRef = useRef<() => void>(() => {})
  const frozenArenaRef = useRef<HTMLCanvasElement | null>(null)
  const finalSnapshotRef = useRef<GameSnapshot | null>(null)
  const nextScorePopId = useRef(0)
  const shareRevision = useRef(0)
  const shareGeneratingRef = useRef(false)
  const shareUrlRef = useRef<string | null>(null)
  const restoreFullscreenRef = useRef(false)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [scorePops, setScorePops] = useState<ScorePop[]>([])
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareResult, setShareResult] = useState<{ url: string; blob: Blob } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [arenaScale, setArenaScale] = useState(1)
  const [assets, setAssets] = useState<{
    urls: Record<string, string>
    loading: boolean
    error: boolean
  }>({ urls: {}, loading: true, error: false })
  const [sequenceColumns, setSequenceColumns] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 6 : 3,
  )
  const modalOpenRef = useRef(false)
  modalOpenRef.current = confirmAction !== null || shareOpen
  const visibleLevels = snapshot?.highestMergedLevel?.id === '12' ? QB_LEVELS : regularLevels

  useLayoutEffect(() => {
    const sequence = sequenceRef.current
    if (!sequence) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const nodeSize =
        sequence.querySelector('.merge-qb-level')?.getBoundingClientRect().width ?? 36
      const capacity = Math.min(
        6,
        Math.max(2, Math.floor((entry.contentRect.width + 20) / (nodeSize + 20))),
      )
      const columns =
        capacity > 3 && regularLevels.length % capacity === 1 ? capacity - 1 : capacity
      setSequenceColumns((current) => (current === columns ? current : columns))
    })
    observer.observe(sequence)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    setFullscreenSupported(Boolean(document.fullscreenEnabled && stage.requestFullscreen))
    const update = () => setIsFullscreen(document.fullscreenElement === stage)
    const exitOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === stage && !modalOpenRef.current)
        void document.exitFullscreen().catch(() => undefined)
    }
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('keydown', exitOnEscape, true)
    update()
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('keydown', exitOnEscape, true)
      if (document.fullscreenElement === stage)
        void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const celebrations: CelebrationEffect[] = []
    clearCelebrationsRef.current = () => {
      celebrations.length = 0
    }
    const game = new MergeQbGame(setSnapshot, Math.random, (event) => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (event.scoreDelta > 0)
        setScorePops((active) => {
          const occupied = new Set(active.map((pop) => pop.slot))
          let slot = 0
          while (occupied.has(slot)) slot++
          return [
            ...active,
            {
              id: ++nextScorePopId.current,
              delta: event.scoreDelta,
              slot,
              rise: 16 + Math.random() * 9,
              offset: (Math.random() - 0.5) * 5,
              duration: reducedMotion ? 160 : 720 + Math.random() * 180,
            },
          ]
        })
      if (event.firstEleven)
        celebrations.push(createCelebration(event, 'confetti', performance.now(), reducedMotion))
      if (event.firstTwelve)
        celebrations.push(createCelebration(event, 'sparkle', performance.now(), reducedMotion))
    })
    gameRef.current = game
    const images: QbImages = createImageMap()
    const sprites: QbSprites = new Map()
    const objectUrls = new Map<string, string>()
    let disposed = false
    let loadRevision = 0
    let scale = 1
    let pixelRatio = 1
    const loadAssets = async (force = false) => {
      const revision = ++loadRevision
      setAssets((current) => ({ ...current, loading: true, error: false }))
      const results = await Promise.allSettled(
        QB_LEVELS.map(async (level) => {
          const signedUrl = await signAssetUrl(levelImagePath(level), { forceRefresh: force })
          if (disposed || revision !== loadRevision) return [level.id, ''] as const
          const response = await fetch(signedUrl)
          if (!response.ok) throw new Error(`QB image ${level.id} failed to load`)
          const url = URL.createObjectURL(await response.blob())
          if (disposed || revision !== loadRevision) {
            URL.revokeObjectURL(url)
            return [level.id, ''] as const
          }
          const image = images.get(level.id)
          if (!image) throw new Error(`Missing QB image slot ${level.id}`)
          try {
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve()
              image.onerror = () => reject(new Error(`QB image ${level.id} failed to load`))
              image.src = url
              if (image.complete && image.naturalWidth > 0) resolve()
            })
          } catch (error) {
            URL.revokeObjectURL(url)
            throw error
          }
          if (disposed || revision !== loadRevision) {
            URL.revokeObjectURL(url)
            return [level.id, ''] as const
          }
          if (!disposed && revision === loadRevision)
            sprites.set(level.id, makeOutlinedSprite(level, image, scale, pixelRatio))
          const previousUrl = objectUrls.get(level.id)
          if (previousUrl) URL.revokeObjectURL(previousUrl)
          objectUrls.set(level.id, url)
          return [level.id, url] as const
        }),
      )
      if (disposed || revision !== loadRevision) return
      const urls: Record<string, string> = {}
      for (const result of results)
        if (result.status === 'fulfilled') urls[result.value[0]] = result.value[1]
      setAssets({
        urls,
        loading: false,
        error: results.some((result) => result.status === 'rejected'),
      })
    }
    loadAssetsRef.current = loadAssets
    void loadAssets()
    const clearAssets = () => {
      loadRevision++
      sprites.clear()
      for (const image of images.values()) image.removeAttribute('src')
      for (const url of objectUrls.values()) URL.revokeObjectURL(url)
      objectUrls.clear()
      setAssets({ urls: {}, loading: false, error: true })
    }
    window.addEventListener('classrecordcacheclearing', clearAssets)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      scale = rect.width / GAME_WIDTH
      setArenaScale((current) => (Math.abs(current - scale) < 0.001 ? current : scale))
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * pixelRatio)
      canvas.height = Math.round(rect.height * pixelRatio)
      context.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0)
      for (const level of QB_LEVELS) {
        const image = images.get(level.id)
        if (image?.complete && image.naturalWidth > 0)
          sprites.set(level.id, makeOutlinedSprite(level, image, scale, pixelRatio))
      }
      drawGame(context, game, images, sprites, scale)
      drawCelebrations(context, celebrations, performance.now(), scale)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    let frame = 0
    let previous = performance.now()
    let accumulated = 0
    const animate = (now: number) => {
      accumulated += Math.min(now - previous, 50)
      previous = now
      let steps = 0
      while (accumulated >= 1000 / 60 && steps < 3) {
        game.step()
        accumulated -= 1000 / 60
        steps += 1
      }
      drawGame(context, game, images, sprites, scale)
      drawCelebrations(context, celebrations, now, scale)
      if (game.snapshot.gameOver && !frozenArenaRef.current) {
        const frozen = document.createElement('canvas')
        frozen.width = canvas.width
        frozen.height = canvas.height
        const frozenContext = frozen.getContext('2d')
        if (frozenContext) {
          frozenContext.fillStyle = getComputedStyle(
            canvas.parentElement as HTMLElement,
          ).backgroundColor
          frozenContext.fillRect(0, 0, frozen.width, frozen.height)
          frozenContext.drawImage(canvas, 0, 0)
          frozenContext.strokeStyle = getComputedStyle(
            canvas.parentElement?.querySelector('.merge-qb-warning-line') as HTMLElement,
          ).borderTopColor
          frozenContext.lineWidth = Math.max(1, (canvas.width / GAME_WIDTH) * 1.5)
          frozenContext.setLineDash([6, 5])
          frozenContext.beginPath()
          frozenContext.moveTo(0, (FAIL_LINE / GAME_HEIGHT) * frozen.height)
          frozenContext.lineTo(frozen.width, (FAIL_LINE / GAME_HEIGHT) * frozen.height)
          frozenContext.stroke()
          frozenArenaRef.current = frozen
          finalSnapshotRef.current = game.snapshot
        }
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      disposed = true
      window.removeEventListener('classrecordcacheclearing', clearAssets)
      for (const url of objectUrls.values()) URL.revokeObjectURL(url)
      observer.disconnect()
      game.dispose()
      gameRef.current = null
      clearCelebrationsRef.current = () => {}
      frozenArenaRef.current = null
      finalSnapshotRef.current = null
      shareRevision.current++
      if (shareUrlRef.current) URL.revokeObjectURL(shareUrlRef.current)
      shareUrlRef.current = null
    }
  }, [])

  const toggleFullscreen = async () => {
    const stage = stageRef.current
    if (!stage || fullscreenPending) return
    setFullscreenPending(true)
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen()
      else await stage.requestFullscreen()
    } catch {
      // Browsers may reject fullscreen without user activation; the game remains playable.
    } finally {
      setFullscreenPending(false)
    }
  }

  const exitGame = async () => {
    if (document.fullscreenElement === stageRef.current) {
      try {
        await document.exitFullscreen()
      } catch {
        // Unmounting the fullscreen element also exits fullscreen.
      }
    }
    navigate('/games')
  }

  const restoreFullscreen = () => {
    if (!restoreFullscreenRef.current) return
    restoreFullscreenRef.current = false
    void stageRef.current?.requestFullscreen().catch(() => undefined)
  }

  const openConfirm = (action: ConfirmAction) => {
    if (document.fullscreenElement === stageRef.current) {
      restoreFullscreenRef.current = true
      void document
        .exitFullscreen()
        .then(() => setConfirmAction(action))
        .catch(() => {
          restoreFullscreenRef.current = false
          setConfirmAction(action)
        })
    } else {
      setConfirmAction(action)
    }
  }

  const aimAt = (event: PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current?.snapshot.gameOver || assets.loading || assets.error) return
    const bounds = event.currentTarget.getBoundingClientRect()
    gameRef.current?.aim(((event.clientX - bounds.left) / bounds.width) * GAME_WIDTH)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current?.snapshot.gameOver || assets.loading || assets.error) return
    aimAt(event)
    if (event.pointerType === 'touch') {
      touchPointer.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
    } else {
      gameRef.current?.drop()
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current?.snapshot.gameOver || assets.loading || assets.error) {
      touchPointer.current = null
      return
    }
    if (touchPointer.current !== event.pointerId) return
    aimAt(event)
    gameRef.current?.drop()
    touchPointer.current = null
  }

  const onBoardKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (gameRef.current?.snapshot.gameOver || assets.loading || assets.error) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      gameRef.current?.aim(gameRef.current.targetX + (event.key === 'ArrowLeft' ? -20 : 20))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      gameRef.current?.drop()
    }
  }

  const closeShare = () => {
    shareRevision.current++
    shareGeneratingRef.current = false
    setShareOpen(false)
    setShareLoading(false)
    setShareError(null)
    if (shareUrlRef.current) URL.revokeObjectURL(shareUrlRef.current)
    shareUrlRef.current = null
    setShareResult(null)
    restoreFullscreen()
  }

  const restartGame = () => {
    closeShare()
    frozenArenaRef.current = null
    finalSnapshotRef.current = null
    clearCelebrationsRef.current()
    setScorePops([])
    touchPointer.current = null
    gameRef.current?.reset()
  }

  const generateShare = async () => {
    const frozen = frozenArenaRef.current
    const result = finalSnapshotRef.current
    if (!frozen || !result || shareGeneratingRef.current) {
      if (!frozen || !result) setShareError('结束画面尚未准备好，请重试。')
      return
    }
    const revision = ++shareRevision.current
    shareGeneratingRef.current = true
    setShareLoading(true)
    setShareError(null)
    try {
      const blob = await createShareImage(frozen, result)
      if (revision !== shareRevision.current) return
      const url = URL.createObjectURL(blob)
      if (shareUrlRef.current) URL.revokeObjectURL(shareUrlRef.current)
      shareUrlRef.current = url
      setShareResult({ url, blob })
    } catch {
      if (revision === shareRevision.current) setShareError('分享图片生成失败，请重试。')
    } finally {
      if (revision === shareRevision.current) {
        shareGeneratingRef.current = false
        setShareLoading(false)
      }
    }
  }

  const openShare = () => {
    if (shareOpen || shareGeneratingRef.current) return
    const showShare = () => {
      setShareOpen(true)
      void generateShare()
    }
    if (document.fullscreenElement === stageRef.current) {
      restoreFullscreenRef.current = true
      void document
        .exitFullscreen()
        .then(showShare)
        .catch(() => {
          restoreFullscreenRef.current = false
          showShare()
        })
    } else {
      showShare()
    }
  }

  const shareFileName = `merge-qb-${finalSnapshotRef.current?.score ?? 0}.png`
  const shareFile = shareResult
    ? new File([shareResult.blob], shareFileName, { type: 'image/png' })
    : null
  const canSystemShare = (() => {
    if (!shareFile || typeof navigator.share !== 'function' || !navigator.canShare) return false
    try {
      return navigator.canShare({ files: [shareFile] })
    } catch {
      return false
    }
  })()

  const confirm = () => {
    const action = confirmAction
    setConfirmAction(null)
    if (action === 'exit') {
      restoreFullscreenRef.current = false
      void exitGame()
    }
    if (action === 'restart' || action === 'replay') {
      restartGame()
      restoreFullscreen()
    }
  }

  return (
    <div ref={stageRef} className="merge-qb-stage">
      <div className="merge-qb-content">
        <button
          type="button"
          className="merge-qb-arena"
          disabled={snapshot?.gameOver || assets.loading || assets.error}
          data-danger={snapshot?.danger ?? 'normal'}
          aria-label="合成大QB游戏区域，左右方向键移动，回车或空格放下QB"
          onKeyDown={onBoardKeyDown}
        >
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerMove={aimAt}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              touchPointer.current = null
            }}
          />
          {(assets.loading || assets.error) && (
            <span className="merge-qb-asset-status" role="status">
              {assets.loading ? (
                <>
                  <Spinner />
                  正在加载 QB 图片…
                </>
              ) : (
                'QB 图片加载失败，请重试'
              )}
            </span>
          )}
          <span
            className="merge-qb-warning-line"
            style={{ top: `${(FAIL_LINE / GAME_HEIGHT) * 100}%` }}
            aria-hidden="true"
          />
          {snapshot?.countdown && (
            <span
              className="merge-qb-countdown"
              role="status"
              aria-label={`危险倒计时 ${snapshot.countdown}`}
            >
              {snapshot.countdown}
            </span>
          )}
        </button>

        <aside className="merge-qb-toolbar" aria-label="游戏状态与操作">
          <div className="merge-qb-actions">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                nativeButton={false}
                render={<Link to="/games" />}
                aria-label="返回游戏库"
                title="返回游戏库"
                onClick={(event) => {
                  event.preventDefault()
                  openConfirm('exit')
                }}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <h1 className="merge-qb-title whitespace-nowrap font-heading text-sm font-semibold">
                合成大QB
              </h1>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="merge-qb-mobile-restart h-8 bg-muted/40 px-1 text-[0.6875rem] md:hidden"
                aria-label="重新开始"
                onClick={() => openConfirm('restart')}
              >
                重新开始
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {assets.error && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadAssetsRef.current(true)}
                >
                  重试
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="max-md:hidden"
                      aria-label="重新开始"
                      onClick={() => openConfirm('restart')}
                    />
                  }
                >
                  <RotateCcw aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>重新开始</TooltipContent>
              </Tooltip>
              {fullscreenSupported && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        data-fullscreen-toggle
                        variant="ghost"
                        size="icon"
                        className="max-md:hidden"
                        disabled={fullscreenPending}
                        aria-pressed={isFullscreen}
                        aria-label={isFullscreen ? '退出全屏' : '全屏游玩'}
                        onClick={() => void toggleFullscreen()}
                      />
                    }
                  >
                    {isFullscreen ? (
                      <Minimize2 aria-hidden="true" />
                    ) : (
                      <Maximize2 aria-hidden="true" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? '退出全屏' : '全屏游玩'}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="merge-qb-next">
            {snapshot?.gameOver ? (
              <div className="merge-qb-game-over-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="merge-qb-game-over-label h-auto min-h-8 px-1 text-lg leading-6 md:text-xl md:leading-7"
                  onClick={() => openConfirm('replay')}
                  aria-label="再来一局"
                  title="再来一局"
                >
                  游戏结束
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="merge-qb-share-mobile md:hidden"
                  aria-label="分享游戏结果"
                  onClick={openShare}
                >
                  <Share2 aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="merge-qb-share-desktop max-md:hidden"
                  onClick={openShare}
                >
                  <Share2 aria-hidden="true" />
                  分享
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">下一个</span>
            )}
            {!snapshot?.gameOver && (
              <div
                className="merge-qb-next-preview"
                style={
                  {
                    '--preview-height': `${largestDroppableSize * arenaScale}px`,
                  } as CSSProperties
                }
              >
                {snapshot && assets.urls[snapshot.next.id] && (
                  <img
                    src={assets.urls[snapshot.next.id]}
                    alt={snapshot.next.name}
                    className="object-contain"
                    style={{
                      width: snapshot.next.visualSize.width * arenaScale,
                      height: snapshot.next.visualSize.height * arenaScale,
                    }}
                  />
                )}
              </div>
            )}
          </div>
          <div className="merge-qb-score">
            <span className="text-xs text-muted-foreground">分数</span>
            <span className="merge-qb-score-value">
              <strong
                className="font-heading text-4xl font-semibold tabular-nums"
                aria-live="polite"
              >
                {snapshot?.score ?? 0}
              </strong>
              {scorePops.map((pop) => (
                <span
                  key={pop.id}
                  className="merge-qb-score-pop"
                  style={
                    {
                      '--pop-rise': `${pop.rise}px`,
                      '--pop-offset': `${pop.offset}px`,
                      '--pop-stack': `${pop.slot * 1.5}rem`,
                      animationDuration: `${pop.duration}ms`,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                  onAnimationEnd={() =>
                    setScorePops((active) => active.filter((item) => item.id !== pop.id))
                  }
                >
                  +{pop.delta}
                </span>
              ))}
            </span>
          </div>
          <section className="merge-qb-sequence" aria-label="QB大小顺序">
            <ol ref={sequenceRef} className="merge-qb-sequence-list">
              {Array.from(
                { length: Math.ceil(visibleLevels.length / sequenceColumns) },
                (_, row) => {
                  const rowLevels = visibleLevels.slice(
                    row * sequenceColumns,
                    (row + 1) * sequenceColumns,
                  )
                  const reversed = row % 2 === 1
                  return (
                    <li key={rowLevels[0]?.id}>
                      <ol className="merge-qb-sequence-row" data-reversed={reversed}>
                        {rowLevels.map((level, position) => {
                          const index = row * sequenceColumns + position
                          const unlocked = index < (snapshot?.unlockedCount ?? 1)
                          return (
                            <Fragment key={level.id}>
                              {position > 0 && (
                                <li className="merge-qb-sequence-arrow" aria-hidden="true">
                                  {reversed ? <ArrowLeft /> : <ArrowRight />}
                                </li>
                              )}
                              <li
                                className="merge-qb-level"
                                data-level-id={level.id}
                                data-egg-unlock={level.id === '12' || undefined}
                                aria-label={
                                  unlocked ? `${index + 1}：${level.name}` : `${index + 1}：未解锁`
                                }
                              >
                                <span className="merge-qb-level-icon">
                                  {unlocked ? (
                                    <img
                                      src={assets.urls[level.id]}
                                      alt=""
                                      style={(() => {
                                        const { left, top, right, bottom } =
                                          levelOutlineBounds(level)
                                        const scale =
                                          32 /
                                          Math.max(
                                            (right - left) * level.sourceSize.width,
                                            (bottom - top) * level.sourceSize.height,
                                          )
                                        const width = level.sourceSize.width * scale
                                        const height = level.sourceSize.height * scale
                                        return {
                                          width,
                                          height,
                                          left: (36 - (right - left) * width) / 2 - left * width,
                                          top: (36 - (bottom - top) * height) / 2 - top * height,
                                        }
                                      })()}
                                    />
                                  ) : (
                                    <span className="merge-qb-locked" aria-hidden="true">
                                      ?
                                    </span>
                                  )}
                                </span>
                              </li>
                            </Fragment>
                          )
                        })}
                        {spareSequenceSlots
                          .slice(0, sequenceColumns - rowLevels.length)
                          .map((slot) => (
                            <Fragment key={`empty-${slot}`}>
                              <li className="merge-qb-sequence-arrow" aria-hidden="true" />
                              <li className="merge-qb-level" aria-hidden="true" />
                            </Fragment>
                          ))}
                      </ol>
                      {(row + 1) * sequenceColumns < visibleLevels.length && (
                        <div
                          className="merge-qb-sequence-turn"
                          data-side={reversed ? 'left' : 'right'}
                        >
                          <ArrowDown aria-hidden="true" />
                        </div>
                      )}
                    </li>
                  )
                },
              )}
            </ol>
          </section>
        </aside>
      </div>
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            restoreFullscreen()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction && confirmCopy[confirmAction].title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && confirmCopy[confirmAction].description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmAction(null)
                restoreFullscreen()
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>
              {confirmAction && confirmCopy[confirmAction].action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={shareOpen}
        onOpenChange={(open) => {
          if (!open) closeShare()
        }}
      >
        <DialogContent className="merge-qb-share-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分享本局结果</DialogTitle>
            <DialogDescription>预览结束时的游戏画面，选择保存或分享图片。</DialogDescription>
          </DialogHeader>
          {shareLoading && (
            <div className="flex items-center justify-center gap-2 py-8" role="status">
              <Spinner /> 正在生成图片…
            </div>
          )}
          {shareError && (
            <div className="space-y-2 text-sm" role="alert">
              <p>{shareError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void generateShare()}
              >
                重试
              </Button>
            </div>
          )}
          {shareResult && (
            <img className="merge-qb-share-preview" src={shareResult.url} alt="本局游戏结果预览" />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeShare}>
              取消
            </Button>
            {shareResult && (
              <>
                <Button
                  type="button"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = shareResult.url
                    link.download = shareFileName
                    link.click()
                  }}
                >
                  <Download aria-hidden="true" />
                  保存图片
                </Button>
                {canSystemShare && shareFile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.share({ files: [shareFile], title: '合成大QB' })
                      } catch (error) {
                        if (!(error instanceof DOMException && error.name === 'AbortError'))
                          setShareError('系统分享失败，你仍可以保存图片。')
                      }
                    }}
                  >
                    <Share2 aria-hidden="true" />
                    系统分享
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
