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
  useMemo,
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
import { levelImagePath, levelOutlineBounds, QB_LEVELS, type QbLevel } from './levels'
import {
  type CelebrationEffect,
  createCelebration,
  createImageMap,
  drawCelebrations,
  drawGame,
  makeOutlinedSprite,
  QB_OUTLINE_OFFSETS,
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
const scorePopColors = ['rust', 'ochre', 'teal', 'blue', 'purple'] as const
type ConfirmAction = 'exit' | 'restart' | 'replay'
type ScorePop = {
  id: number
  delta: number
  rise: number
  offsetX: number
  offsetY: number
  duration: number
  color: (typeof scorePopColors)[number]
}

function QbLevelIcon({
  level,
  unlocked,
  src,
}: {
  level: QbLevel
  unlocked: boolean
  src?: string
}) {
  const [loadedUrl, setLoadedUrl] = useState<string>()
  const ready = Boolean(unlocked && src && loadedUrl === src)
  const { left, top, right, bottom } = levelOutlineBounds(level)
  const scale =
    32 / Math.max((right - left) * level.sourceSize.width, (bottom - top) * level.sourceSize.height)
  const width = level.sourceSize.width * scale
  const height = level.sourceSize.height * scale
  return (
    <span className="merge-qb-level-icon" data-ready={ready}>
      <span className="merge-qb-locked" aria-hidden="true">
        ?
      </span>
      {unlocked && src && (
        <img
          className="merge-qb-image"
          draggable={false}
          src={src}
          alt=""
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth > 0) setLoadedUrl(src)
          }}
          onError={() => setLoadedUrl(undefined)}
          style={{
            width,
            height,
            left: (36 - (right - left) * width) / 2 - left * width,
            top: (36 - (bottom - top) * height) / 2 - top * height,
          }}
        />
      )}
    </span>
  )
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
  const resumeAnimationRef = useRef<() => void>(() => {})
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
  const [outlineFilterColor, setOutlineFilterColor] = useState<string>()
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
  const unlockedCount = snapshot?.unlockedCount ?? 1

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
    let previousPopColor: ScorePop['color'] | undefined
    clearCelebrationsRef.current = () => {
      celebrations.length = 0
    }
    const game = new MergeQbGame(setSnapshot, Math.random, (event) => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (event.scoreDelta > 0) {
        const colors = scorePopColors.filter((color) => color !== previousPopColor)
        const pop: ScorePop = {
          id: ++nextScorePopId.current,
          delta: event.scoreDelta,
          rise: 16 + Math.random() * 9,
          offsetX: (Math.random() - 0.5) * 5,
          offsetY: (Math.random() - 0.5) * 4,
          duration: reducedMotion ? 160 : 720 + Math.random() * 180,
          color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? 'rust',
        }
        previousPopColor = pop.color
        setScorePops((active) => [...active, pop])
      }
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
    const readOutlineColor = () =>
      getComputedStyle(stageRef.current as HTMLElement)
        .getPropertyValue('--qb-outline-color')
        .trim()
    let outlineColor = readOutlineColor()
    setOutlineFilterColor(outlineColor)
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
            sprites.set(level.id, makeOutlinedSprite(level, image, scale, pixelRatio, outlineColor))
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

    let canvasScale = 0
    let canvasPixelRatio = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const nextScale = rect.width / GAME_WIDTH
      const nextPixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(rect.width * nextPixelRatio)
      const height = Math.round(rect.height * nextPixelRatio)
      if (
        canvas.width === width &&
        canvas.height === height &&
        canvasScale === nextScale &&
        canvasPixelRatio === nextPixelRatio
      )
        return
      scale = nextScale
      canvasScale = scale
      canvasPixelRatio = nextPixelRatio
      setArenaScale((current) => (Math.abs(current - scale) < 0.001 ? current : scale))
      pixelRatio = nextPixelRatio
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      context.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0)
      for (const level of QB_LEVELS) {
        const image = images.get(level.id)
        if (image?.complete && image.naturalWidth > 0)
          sprites.set(level.id, makeOutlinedSprite(level, image, scale, pixelRatio, outlineColor))
      }
      drawGame(context, game, images, sprites, scale)
      drawCelebrations(context, celebrations, performance.now(), scale)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    let themeFrame = 0
    const updateOutline = () => {
      themeFrame = 0
      const color = readOutlineColor()
      if (color === outlineColor) return
      outlineColor = color
      // Explicitly update cached SVG filters together with the canvas sprite cache.
      setOutlineFilterColor(color)
      for (const level of QB_LEVELS) {
        const image = images.get(level.id)
        if (image?.complete && image.naturalWidth > 0)
          sprites.set(level.id, makeOutlinedSprite(level, image, scale, pixelRatio, outlineColor))
      }
      drawGame(context, game, images, sprites, scale)
      drawCelebrations(context, celebrations, performance.now(), scale)
    }
    const themeObserver = new MutationObserver(() => {
      // Theme tokens can settle after the mutation callback, especially in WebKit.
      cancelAnimationFrame(themeFrame)
      themeFrame = requestAnimationFrame(updateOutline)
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme-preset', 'style'],
    })

    let frame = 0
    let previous = performance.now()
    let accumulated = 0
    const animate = (now: number) => {
      frame = 0
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
      if (game.gameOver && !frozenArenaRef.current) {
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
      // The finished board is static; let remaining celebrations finish before stopping.
      if (!game.gameOver || celebrations.length) frame = requestAnimationFrame(animate)
    }
    const resumeAnimation = () => {
      if (disposed || frame) return
      previous = performance.now()
      accumulated = 0
      frame = requestAnimationFrame(animate)
    }
    resumeAnimationRef.current = resumeAnimation
    resumeAnimation()

    return () => {
      cancelAnimationFrame(frame)
      disposed = true
      window.removeEventListener('classrecordcacheclearing', clearAssets)
      for (const url of objectUrls.values()) URL.revokeObjectURL(url)
      observer.disconnect()
      themeObserver.disconnect()
      cancelAnimationFrame(themeFrame)
      game.dispose()
      gameRef.current = null
      resumeAnimationRef.current = () => {}
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
    if (gameRef.current?.gameOver || assets.loading || assets.error) return
    const bounds = event.currentTarget.getBoundingClientRect()
    gameRef.current?.aim(((event.clientX - bounds.left) / bounds.width) * GAME_WIDTH)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current?.gameOver || assets.loading || assets.error) return
    aimAt(event)
    if (event.pointerType === 'touch') {
      touchPointer.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
    } else {
      gameRef.current?.drop()
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current?.gameOver || assets.loading || assets.error) {
      touchPointer.current = null
      return
    }
    if (touchPointer.current !== event.pointerId) return
    aimAt(event)
    gameRef.current?.drop()
    touchPointer.current = null
  }

  const onBoardKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (gameRef.current?.gameOver || assets.loading || assets.error) return
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
    resumeAnimationRef.current()
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

  const sequence = useMemo(
    () => (
      <section className="merge-qb-sequence" aria-label="QB大小顺序">
        <ol ref={sequenceRef} className="merge-qb-sequence-list">
          {Array.from({ length: Math.ceil(visibleLevels.length / sequenceColumns) }, (_, row) => {
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
                    const unlocked = index < unlockedCount
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
                          <QbLevelIcon
                            level={level}
                            unlocked={unlocked}
                            src={assets.urls[level.id]}
                          />
                        </li>
                      </Fragment>
                    )
                  })}
                  {spareSequenceSlots.slice(0, sequenceColumns - rowLevels.length).map((slot) => (
                    <Fragment key={`empty-${slot}`}>
                      <li className="merge-qb-sequence-arrow" aria-hidden="true" />
                      <li className="merge-qb-level" aria-hidden="true" />
                    </Fragment>
                  ))}
                </ol>
                {(row + 1) * sequenceColumns < visibleLevels.length && (
                  <div className="merge-qb-sequence-turn" data-side={reversed ? 'left' : 'right'}>
                    <ArrowDown aria-hidden="true" />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    ),
    [visibleLevels, sequenceColumns, unlockedCount, assets.urls],
  )

  return (
    <div ref={stageRef} className="merge-qb-stage">
      <svg className="merge-qb-outline-defs" aria-hidden="true">
        <defs>
          <filter
            id="merge-qb-image-outline"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            {QB_OUTLINE_OFFSETS.map((offset, index) => (
              <feOffset
                key={`${offset.x}:${offset.y}`}
                in="SourceAlpha"
                dx={offset.x}
                dy={offset.y}
                result={`edge-${index}`}
              />
            ))}
            <feMerge result="edge-mask">
              {QB_OUTLINE_OFFSETS.map((offset, index) => (
                <feMergeNode key={`${offset.x}:${offset.y}`} in={`edge-${index}`} />
              ))}
            </feMerge>
            <feFlood floodColor={outlineFilterColor} result="edge-color" />
            <feComposite in="edge-color" in2="edge-mask" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
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
                className="merge-qb-mobile-restart h-8 bg-muted/40 px-2.5 text-xs md:hidden"
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
                  className="merge-qb-retry"
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
                    draggable={false}
                    src={assets.urls[snapshot.next.id]}
                    alt={snapshot.next.name}
                    className="merge-qb-image object-contain"
                    style={
                      {
                        '--preview-width': `${snapshot.next.visualSize.width * arenaScale}px`,
                        '--preview-image-height': `${snapshot.next.visualSize.height * arenaScale}px`,
                      } as CSSProperties
                    }
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
                      '--pop-color': `var(--qb-pop-${pop.color})`,
                      '--pop-rise': `${pop.rise}px`,
                      '--pop-offset-x': `${pop.offsetX}px`,
                      '--pop-offset-y': `${pop.offsetY}px`,
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
          {sequence}
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
        <AlertDialogContent className="merge-qb-confirm-dialog">
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
            <img
              draggable={false}
              className="merge-qb-share-preview"
              src={shareResult.url}
              alt="本局游戏结果预览"
            />
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
