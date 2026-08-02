import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'

export function ImageViewer({
  path,
  alt,
  trigger,
  initialUrl = '',
}: {
  path: string
  alt: string
  trigger: ReactElement
  initialUrl?: string
}) {
  const [open, setOpen] = useState(false)
  const asset = useSignedAsset(open ? path : '', { refresh: open })
  const imageFailure = useBoundedImageRetry(open ? path : '', asset.retry)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null)
  const src = asset.src || initialUrl

  useEffect(() => {
    if (!open) {
      setScale(1)
      setPan({ x: 0, y: 0 })
    }
  }, [open])

  useEffect(() => {
    if (!open || !viewport.current) return
    const element = viewport.current
    const update = () => {
      const box = element.getBoundingClientRect()
      setViewportSize({ width: box.width, height: box.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [open])

  const base = useMemo(() => {
    if (!natural.width || !natural.height) return { width: 0, height: 0 }
    const availableWidth = Math.max(1, (viewportSize.width || window.innerWidth) - 32)
    const availableHeight = Math.max(1, (viewportSize.height || window.innerHeight) - 32)
    const ratio = Math.min(1, availableWidth / natural.width, availableHeight / natural.height)
    return { width: natural.width * ratio, height: natural.height * ratio }
  }, [natural, viewportSize])

  const clampPan = useCallback(
    (candidate: { x: number; y: number }, nextScale = scale) => {
      if (nextScale <= 1) return { x: 0, y: 0 }
      const boundX = Math.max(0, (base.width * nextScale - viewportSize.width) / 2)
      const boundY = Math.max(0, (base.height * nextScale - viewportSize.height) / 2)
      return {
        x: Math.min(boundX, Math.max(-boundX, candidate.x)),
        y: Math.min(boundY, Math.max(-boundY, candidate.y)),
      }
    },
    [base.height, base.width, scale, viewportSize.height, viewportSize.width],
  )

  useEffect(() => {
    setPan((current) => {
      const next = clampPan(current)
      return next.x === current.x && next.y === current.y ? current : next
    })
  }, [clampPan])

  const reset = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="flex h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-3 p-3 sm:max-w-none sm:p-4">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>
            滚轮缩放，按住图片拖动浏览；使用工具栏可缩放或复位。
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pr-10">
          <Maximize2 className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{alt}</span>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="缩小"
            title="缩小"
            onClick={() => setScale((value) => Math.max(0.25, value / 1.25))}
          >
            <Minus />
          </Button>
          <span className="w-14 text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="放大"
            title="放大"
            onClick={() => setScale((value) => Math.min(8, value * 1.25))}
          >
            <Plus />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="复位" title="复位" onClick={reset}>
            <RotateCcw />
          </Button>
        </div>
        <div
          ref={viewport}
          className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-lg border bg-muted/55"
          onWheel={(event) => {
            event.preventDefault()
            const next = Math.min(8, Math.max(0.25, scale * Math.exp(-event.deltaY * 0.0015)))
            const box = event.currentTarget.getBoundingClientRect()
            const pointerX = event.clientX - box.left - box.width / 2
            const pointerY = event.clientY - box.top - box.height / 2
            const ratio = next / scale
            setPan(
              clampPan(
                {
                  x: pan.x - (pointerX - pan.x) * (ratio - 1),
                  y: pan.y - (pointerY - pan.y) * (ratio - 1),
                },
                next,
              ),
            )
            setScale(next)
          }}
          onPointerDown={(event) => {
            if (scale <= 1) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              panX: pan.x,
              panY: pan.y,
            }
          }}
          onPointerMove={(event) => {
            const current = drag.current
            if (!current || current.id !== event.pointerId) return
            setPan(
              clampPan({
                x: current.panX + event.clientX - current.x,
                y: current.panY + event.clientY - current.y,
              }),
            )
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onLostPointerCapture={() => {
            drag.current = null
          }}
        >
          {(asset.loading || imageFailure.retrying) && !src && (
            <div className="grid size-full place-items-center">
              <Spinner className="size-7" />
            </div>
          )}
          {(imageFailure.failed || asset.error) && !src && (
            <div className="grid size-full place-items-center text-center">
              <div>
                <p className="mb-3 text-sm text-muted-foreground">图片加载失败。</p>
                <Button variant="outline" onClick={() => void imageFailure.retryManually()}>
                  重试
                </Button>
              </div>
            </div>
          )}
          {src && !imageFailure.failed && (
            <img
              key={src}
              src={src}
              alt={alt}
              draggable={false}
              onLoad={(event) => {
                imageFailure.markLoaded()
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }}
              onError={imageFailure.markFailed}
              className="absolute left-1/2 top-1/2 max-w-none select-none will-change-transform"
              style={{
                width: base.width ? `${base.width * scale}px` : 'auto',
                height: base.height ? `${base.height * scale}px` : 'auto',
                transform: `translate3d(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px), 0)`,
              }}
            />
          )}
          {imageFailure.failed && src && (
            <div className="grid size-full place-items-center text-center">
              <div>
                <p className="mb-3 text-sm text-muted-foreground">图片加载失败。</p>
                <Button variant="outline" onClick={() => void imageFailure.retryManually()}>
                  重试
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
