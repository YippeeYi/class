import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { ArrowDown, ArrowLeft, ArrowRight, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import {
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import {
  FAIL_LINE,
  GAME_HEIGHT,
  GAME_WIDTH,
  type GameSnapshot,
  MAX_DROP_LEVEL_COUNT,
  MergeQbGame,
} from './game'
import { levelImageUrl, QB_LEVELS } from './levels'
import { createImageMap, drawGame } from './render'
import './game.css'

const largestDroppableSize = Math.max(
  ...QB_LEVELS.slice(0, MAX_DROP_LEVEL_COUNT).map((level) => level.visualSize.height),
)
const confettiPieces = Array.from({ length: 8 }, (_, index) => index)
const spareSequenceSlots = ['a', 'b', 'c', 'd', 'e']

export function MergeQbBoard() {
  const navigate = useNavigate()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sequenceRef = useRef<HTMLOListElement>(null)
  const gameRef = useRef<MergeQbGame | null>(null)
  const touchPointer = useRef<number | null>(null)
  const observedMaxMergeCount = useRef(0)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [activeCelebrations, setActiveCelebrations] = useState<number[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [arenaScale, setArenaScale] = useState(1)
  const [sequenceColumns, setSequenceColumns] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 6 : 3,
  )

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
      const columns = capacity > 3 && QB_LEVELS.length % capacity === 1 ? capacity - 1 : capacity
      setSequenceColumns((current) => (current === columns ? current : columns))
    })
    observer.observe(sequence)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const count = snapshot?.maxMergeCount ?? 0
    const previous = observedMaxMergeCount.current
    if (count < previous) setActiveCelebrations([])
    else if (count > previous)
      setActiveCelebrations((active) => [
        ...active,
        ...Array.from({ length: count - previous }, (_, index) => previous + index + 1),
      ])
    observedMaxMergeCount.current = count
  }, [snapshot?.maxMergeCount])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    setFullscreenSupported(Boolean(document.fullscreenEnabled && stage.requestFullscreen))
    const update = () => setIsFullscreen(document.fullscreenElement === stage)
    const exitOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === stage)
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
    const game = new MergeQbGame(setSnapshot)
    gameRef.current = game
    const images = createImageMap()
    for (const level of QB_LEVELS) {
      const image = images.get(level.id)
      if (image) image.src = levelImageUrl(level)
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const scale = rect.width / GAME_WIDTH
      setArenaScale((current) => (Math.abs(current - scale) < 0.001 ? current : scale))
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * pixelRatio)
      canvas.height = Math.round(rect.height * pixelRatio)
      context.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0)
      drawGame(context, game, images)
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
      drawGame(context, game, images)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      game.dispose()
      gameRef.current = null
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

  const aimAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    gameRef.current?.aim(((event.clientX - bounds.left) / bounds.width) * GAME_WIDTH)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    aimAt(event)
    if (event.pointerType === 'touch') {
      touchPointer.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
    } else {
      gameRef.current?.drop()
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (touchPointer.current !== event.pointerId) return
    aimAt(event)
    gameRef.current?.drop()
    touchPointer.current = null
  }

  const onBoardKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      gameRef.current?.aim(gameRef.current.targetX + (event.key === 'ArrowLeft' ? -20 : 20))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      gameRef.current?.drop()
    }
  }

  return (
    <div ref={stageRef} className="merge-qb-stage">
      <div className="merge-qb-content">
        <button
          type="button"
          className="merge-qb-arena"
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
          {activeCelebrations.map((id) => (
            <span
              key={id}
              className="merge-qb-celebration"
              aria-hidden="true"
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget)
                  setActiveCelebrations((active) => active.filter((item) => item !== id))
              }}
            >
              {['left', 'right'].map((side) => (
                <span key={side} className={`merge-qb-confetti merge-qb-confetti-${side}`}>
                  {confettiPieces.map((index) => (
                    <i key={index} />
                  ))}
                </span>
              ))}
            </span>
          ))}
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
                  if (document.fullscreenElement !== stageRef.current) return
                  event.preventDefault()
                  void exitGame()
                }}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <h1 className="merge-qb-title whitespace-nowrap font-heading text-sm font-semibold">
                合成大QB
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="max-md:w-auto max-md:gap-1.5 max-md:px-2"
                      aria-label="重新开始"
                      onClick={() => gameRef.current?.reset()}
                    />
                  }
                >
                  <RotateCcw aria-hidden="true" />
                  <span className="hidden max-md:inline">再来一局</span>
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
            <span className="text-xs text-muted-foreground">下一个</span>
            <div
              className="merge-qb-next-preview"
              style={{ height: largestDroppableSize * arenaScale }}
            >
              {snapshot && (
                <img
                  src={levelImageUrl(snapshot.next)}
                  alt={snapshot.next.name}
                  className="object-contain"
                  style={{
                    width: snapshot.next.visualSize.width * arenaScale,
                    height: snapshot.next.visualSize.height * arenaScale,
                  }}
                />
              )}
            </div>
          </div>
          <div className="merge-qb-score">
            <span className="text-xs text-muted-foreground">分数</span>
            <strong className="font-heading text-4xl font-semibold tabular-nums" aria-live="polite">
              {snapshot?.score ?? 0}
            </strong>
          </div>
          <section className="merge-qb-sequence" aria-label="QB大小顺序">
            <ol ref={sequenceRef} className="merge-qb-sequence-list">
              {Array.from({ length: Math.ceil(QB_LEVELS.length / sequenceColumns) }, (_, row) => {
                const rowLevels = QB_LEVELS.slice(
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
                              aria-label={
                                unlocked ? `${index + 1}：${level.name}` : `${index + 1}：未解锁`
                              }
                            >
                              <span className="merge-qb-level-icon">
                                {unlocked ? (
                                  <img src={levelImageUrl(level)} alt="" />
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
                    {(row + 1) * sequenceColumns < QB_LEVELS.length && (
                      <div
                        className="merge-qb-sequence-turn"
                        data-side={reversed ? 'left' : 'right'}
                      >
                        <ArrowDown aria-hidden="true" />
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        </aside>
      </div>
      <AlertDialog open={snapshot?.gameOver ?? false}>
        <AlertDialogPortal container={stageRef.current}>
          <AlertDialogOverlay className="duration-200" />
          <AlertDialogPrimitive.Popup
            data-slot="alert-dialog-content"
            className="merge-qb-game-over-dialog duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl sm:text-2xl">游戏结束</AlertDialogTitle>
              <AlertDialogDescription>得分 {snapshot?.score ?? 0}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => void exitGame()}>
                退出
              </Button>
              <AlertDialogAction type="button" onClick={() => gameRef.current?.reset()}>
                再来一局
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogPrimitive.Popup>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  )
}
