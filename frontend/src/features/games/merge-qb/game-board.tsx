import { ArrowLeft, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { GAME_HEIGHT, GAME_WIDTH, type GameSnapshot, MergeQbGame } from './game'
import { levelImageUrl, QB_LEVELS } from './levels'
import { createImageMap, drawGame } from './render'
import './game.css'

const largestLevelSize = Math.max(
  ...QB_LEVELS.map((level) => Math.max(level.visualSize.width, level.visualSize.height)),
)

export function MergeQbBoard() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<MergeQbGame | null>(null)
  const touchPointer = useRef<number | null>(null)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)

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
        <div className="merge-qb-toolbar">
          <div className="flex min-w-0 items-center gap-2">
            {!isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                nativeButton={false}
                render={<Link to="/games" />}
                aria-label="返回游戏库"
                title="返回游戏库"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            )}
            <h1
              className={
                isFullscreen
                  ? 'sr-only'
                  : 'sr-only sm:not-sr-only sm:truncate sm:font-heading sm:text-base sm:font-semibold'
              }
            >
              合成大QB
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-muted-foreground">得分</span>
              <strong
                className="font-heading text-xl font-semibold tabular-nums"
                aria-live="polite"
              >
                {snapshot?.score ?? 0}
              </strong>
            </div>
            {snapshot && (
              <div className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1">
                <span className="text-xs text-muted-foreground">下一个</span>
                <img
                  src={levelImageUrl(snapshot.next)}
                  alt={snapshot.next.name}
                  className="size-7 object-contain"
                />
              </div>
            )}
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

        <div className="merge-qb-play">
          <button
            type="button"
            className="merge-qb-arena"
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
          </button>

          <section className="merge-qb-sequence" aria-label="QB大小顺序">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>QB大小顺序</span>
              {snapshot?.gameOver && (
                <span role="status" className="text-destructive">
                  游戏结束
                </span>
              )}
            </div>
            <ol>
              {QB_LEVELS.map((level, index) => {
                const maxDimension = Math.max(level.visualSize.width, level.visualSize.height)
                const size = 16 + (20 * maxDimension) / largestLevelSize
                return (
                  <li
                    key={level.id}
                    data-level-id={level.id}
                    aria-label={`${index + 1}：${level.name}`}
                  >
                    <img
                      src={levelImageUrl(level)}
                      alt=""
                      style={{
                        width: `${(size * level.visualSize.width) / maxDimension}px`,
                        height: `${(size * level.visualSize.height) / maxDimension}px`,
                      }}
                    />
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
        </div>
      </div>
    </div>
  )
}
