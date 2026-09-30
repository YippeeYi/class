import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { ArrowLeft, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
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

import { FAIL_LINE, GAME_HEIGHT, GAME_WIDTH, type GameSnapshot, MergeQbGame } from './game'
import { levelImageUrl, QB_LEVELS } from './levels'
import { createImageMap, drawGame } from './render'
import './game.css'

const largestLevelSize = Math.max(
  ...QB_LEVELS.map((level) => Math.max(level.visualSize.width, level.visualSize.height)),
)
const confettiPieces = Array.from({ length: 8 }, (_, index) => index)

export function MergeQbBoard() {
  const navigate = useNavigate()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<MergeQbGame | null>(null)
  const touchPointer = useRef<number | null>(null)
  const observedMaxMergeCount = useRef(0)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [activeCelebrations, setActiveCelebrations] = useState<number[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)

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
              <h1 className="hidden truncate font-heading text-sm font-semibold sm:block merge-qb-title">
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
                      aria-label="重新开始"
                      onClick={() => gameRef.current?.reset()}
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
          <div className="merge-qb-status">
            <div className="merge-qb-score">
              <span className="text-xs text-muted-foreground">得分</span>
              <strong
                className="font-heading text-3xl font-semibold tabular-nums"
                aria-live="polite"
              >
                {snapshot?.score ?? 0}
              </strong>
            </div>
            {snapshot && (
              <div className="merge-qb-next">
                <span className="text-xs text-muted-foreground">下一个</span>
                <img
                  src={levelImageUrl(snapshot.next)}
                  alt={snapshot.next.name}
                  className="size-12 object-contain"
                />
              </div>
            )}
          </div>
          <section className="merge-qb-sequence" aria-label="QB大小顺序">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">QB大小顺序</div>
            <ol>
              {QB_LEVELS.map((level, index) => {
                const maxDimension = Math.max(level.visualSize.width, level.visualSize.height)
                const size = 22 + (27 * maxDimension) / largestLevelSize
                const unlocked = index < (snapshot?.unlockedCount ?? 1)
                return (
                  <li
                    key={level.id}
                    data-level-id={level.id}
                    aria-label={unlocked ? `${index + 1}：${level.name}` : `${index + 1}：未解锁`}
                  >
                    <span className="merge-qb-level-icon" style={{ width: `${size}px` }}>
                      {unlocked ? (
                        <img
                          src={levelImageUrl(level)}
                          alt=""
                          style={{
                            width: `${(size * level.visualSize.width) / maxDimension}px`,
                            height: `${(size * level.visualSize.height) / maxDimension}px`,
                          }}
                        />
                      ) : (
                        <span className="merge-qb-locked size-full" aria-hidden="true">
                          ?
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[10px] leading-none text-muted-foreground/70"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
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
