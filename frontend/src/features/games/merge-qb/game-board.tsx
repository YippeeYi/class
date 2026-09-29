import { RotateCcw } from 'lucide-react'
import { type PointerEvent, useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { GAME_HEIGHT, GAME_WIDTH, type GameSnapshot, MergeQbGame } from './game'
import { levelImageUrl, QB_LEVELS } from './levels'
import { createImageMap, drawGame } from './render'

export function MergeQbBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<MergeQbGame | null>(null)
  const touchPointer = useRef<number | null>(null)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)

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

  return (
    <div className="mx-auto w-full max-w-[440px] space-y-4">
      <Card className="gap-0 bg-card/80 py-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">得分</p>
            <p className="font-heading text-2xl font-semibold tabular-nums" aria-live="polite">
              {snapshot?.score ?? 0}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">下一个</span>
              {snapshot && (
                <img
                  src={levelImageUrl(snapshot.next)}
                  alt={snapshot.next.name}
                  className="size-8 object-contain"
                />
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="重新开始"
              title="重新开始"
              onClick={() => gameRef.current?.reset()}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden bg-card/80 p-2 sm:p-3">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="aspect-[9/14] w-full rounded-lg border border-border/70 bg-background/65 [touch-action:none]"
          role="img"
          aria-label="合成大QB游戏区域。移动鼠标或触摸选择位置，点击或松开手指使QB落下。"
          onPointerMove={aimAt}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            touchPointer.current = null
          }}
        />
      </Card>

      {snapshot?.gameOver ? (
        <Alert>
          <AlertTitle>游戏结束</AlertTitle>
          <AlertDescription>得分 {snapshot.score}。点击重新开始，再试一次。</AlertDescription>
        </Alert>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          移动鼠标后点击落下；触摸拖动并松手落下。相同等级碰撞后会合成。
        </p>
      )}
      <Button
        className="w-full"
        disabled={!snapshot?.canDrop}
        onClick={() => gameRef.current?.drop()}
      >
        放下当前 QB
      </Button>
    </div>
  )
}
