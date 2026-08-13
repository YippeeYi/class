// biome-ignore-all lint/a11y/noNoninteractiveTabindex: The image canvas is a gesture surface with documented zoom and pan keyboard controls; toolbar buttons remain the simpler alternative.
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'

const MIN_SCALE = 1
const MAX_SCALE = 8
const SCALE_STEP = 1.25
const VIEWPORT_PADDING = 32

type ViewTransform = { scale: number; x: number; y: number }

function ViewerToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

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
  const asset = useSignedAsset(open ? path : '')
  const imageFailure = useBoundedImageRetry(open ? path : '', asset.retry)
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(viewTransform)
  transformRef.current = viewTransform
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [viewportElement, setViewportElement] = useState<HTMLElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{
    id: number
    x: number
    y: number
    transform: ViewTransform
  } | null>(null)
  const pinch = useRef<{
    distance: number
    focalX: number
    focalY: number
    transform: ViewTransform
  } | null>(null)
  const src = asset.src || initialUrl

  useEffect(() => {
    if (open) return
    const reset: ViewTransform = { scale: 1, x: 0, y: 0 }
    transformRef.current = reset
    setViewTransform(reset)
    setNatural({ width: 0, height: 0 })
    pointers.current.clear()
    drag.current = null
    pinch.current = null
  }, [open])

  useEffect(() => {
    if (!open || !viewportElement) return
    const element = viewportElement
    const update = () => {
      const box = element.getBoundingClientRect()
      setViewportSize((current) =>
        current.width === box.width && current.height === box.height
          ? current
          : { width: box.width, height: box.height },
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [open, viewportElement])

  const base = useMemo(() => {
    if (!natural.width || !natural.height || !viewportSize.width || !viewportSize.height)
      return { width: 0, height: 0 }
    const availableWidth = Math.max(1, viewportSize.width - VIEWPORT_PADDING)
    const availableHeight = Math.max(1, viewportSize.height - VIEWPORT_PADDING)
    const ratio = Math.min(1, availableWidth / natural.width, availableHeight / natural.height)
    return { width: natural.width * ratio, height: natural.height * ratio }
  }, [natural, viewportSize])

  const clampTransform = useCallback(
    (candidate: ViewTransform): ViewTransform => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, candidate.scale))
      if (scale <= MIN_SCALE || !base.width || !base.height) return { scale: MIN_SCALE, x: 0, y: 0 }
      const availableWidth = Math.max(1, viewportSize.width - VIEWPORT_PADDING)
      const availableHeight = Math.max(1, viewportSize.height - VIEWPORT_PADDING)
      const boundX = Math.max(0, (base.width * scale - availableWidth) / 2)
      const boundY = Math.max(0, (base.height * scale - availableHeight) / 2)
      return {
        scale,
        x: Math.min(boundX, Math.max(-boundX, candidate.x)),
        y: Math.min(boundY, Math.max(-boundY, candidate.y)),
      }
    },
    [base.height, base.width, viewportSize.height, viewportSize.width],
  )

  useEffect(() => {
    setViewTransform((current) => {
      const next = clampTransform(current)
      transformRef.current = next
      return next.scale === current.scale && next.x === current.x && next.y === current.y
        ? current
        : next
    })
  }, [clampTransform])

  const commitTransform = useCallback(
    (candidate: ViewTransform) => {
      const next = clampTransform(candidate)
      transformRef.current = next
      setViewTransform(next)
    },
    [clampTransform],
  )

  const zoomTo = useCallback(
    (requestedScale: number, focal = { x: 0, y: 0 }) => {
      const current = transformRef.current
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, requestedScale))
      const ratio = scale / current.scale
      commitTransform({
        scale,
        x: focal.x - (focal.x - current.x) * ratio,
        y: focal.y - (focal.y - current.y) * ratio,
      })
    },
    [commitTransform],
  )

  const reset = () => {
    commitTransform({ scale: MIN_SCALE, x: 0, y: 0 })
  }

  return (
    <Dialog modal="trap-focus" open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton={false}
        className="image-viewer-dialog inset-0! top-0! left-0! z-50! flex! h-dvh! min-h-0! w-screen! min-w-0 max-w-none! translate-x-0! translate-y-0! flex-col gap-3 overflow-hidden rounded-none! bg-transparent! p-[max(0.75rem,env(safe-area-inset-top))_max(0.75rem,env(safe-area-inset-right))_max(0.75rem,env(safe-area-inset-bottom))_max(0.75rem,env(safe-area-inset-left))] text-sm text-foreground ring-0! outline-none sm:max-w-none!"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>
            滚轮缩放，按住图片拖动浏览；使用工具栏可缩放或复位。
          </DialogDescription>
        </DialogHeader>
        <div className="image-viewer-toolbar flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2">
          <Maximize2 className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{alt}</span>
          <div className="flex shrink-0 items-center gap-1">
            <ViewerToolButton
              label="缩小"
              disabled={!base.width || viewTransform.scale <= MIN_SCALE}
              onClick={() => zoomTo(transformRef.current.scale / SCALE_STEP)}
            >
              <Minus />
            </ViewerToolButton>
            <span
              className="w-12 text-center text-xs tabular-nums text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {Math.round(viewTransform.scale * 100)}%
            </span>
            <ViewerToolButton
              label="放大"
              disabled={!base.width || viewTransform.scale >= MAX_SCALE}
              onClick={() => zoomTo(transformRef.current.scale * SCALE_STEP)}
            >
              <Plus />
            </ViewerToolButton>
            <ViewerToolButton
              label="适合窗口"
              disabled={!base.width || viewTransform.scale === MIN_SCALE}
              onClick={reset}
            >
              <RotateCcw />
            </ViewerToolButton>
            <DialogClose
              render={
                <Button size="icon-sm" variant="ghost" aria-label="关闭大图" title="关闭大图" />
              }
            >
              <X />
            </DialogClose>
          </div>
        </div>
        <section
          ref={setViewportElement}
          className={`image-viewer-viewport relative min-h-0 flex-1 touch-none overflow-hidden rounded-xl bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewTransform.scale > MIN_SCALE ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
          tabIndex={0}
          role="application"
          aria-label={`${alt} 大图查看区域`}
          aria-describedby="image-viewer-help"
          aria-keyshortcuts="Enter Space + - 0 ArrowUp ArrowDown ArrowLeft ArrowRight"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              zoomTo(transformRef.current.scale > MIN_SCALE ? MIN_SCALE : 2)
              return
            }
            if (event.key === '+' || event.key === '=') {
              event.preventDefault()
              zoomTo(transformRef.current.scale * SCALE_STEP)
              return
            }
            if (event.key === '-' || event.key === '_') {
              event.preventDefault()
              zoomTo(transformRef.current.scale / SCALE_STEP)
              return
            }
            if (event.key === '0') {
              event.preventDefault()
              reset()
              return
            }
            const movement = event.shiftKey ? 64 : 28
            const offsets: Record<string, { x: number; y: number }> = {
              ArrowUp: { x: 0, y: movement },
              ArrowDown: { x: 0, y: -movement },
              ArrowLeft: { x: movement, y: 0 },
              ArrowRight: { x: -movement, y: 0 },
            }
            const offset = offsets[event.key]
            if (!offset || transformRef.current.scale <= MIN_SCALE) return
            event.preventDefault()
            commitTransform({
              ...transformRef.current,
              x: transformRef.current.x + offset.x,
              y: transformRef.current.y + offset.y,
            })
          }}
          onWheel={(event) => {
            event.preventDefault()
            const box = event.currentTarget.getBoundingClientRect()
            const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : 1
            const sensitivity = event.ctrlKey ? 0.01 : 0.0018
            zoomTo(transformRef.current.scale * Math.exp(-event.deltaY * unit * sensitivity), {
              x: event.clientX - box.left - box.width / 2,
              y: event.clientY - box.top - box.height / 2,
            })
          }}
          onDoubleClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect()
            zoomTo(transformRef.current.scale > MIN_SCALE ? MIN_SCALE : 2, {
              x: event.clientX - box.left - box.width / 2,
              y: event.clientY - box.top - box.height / 2,
            })
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (pointers.current.size >= 2) {
              const [first, second] = [...pointers.current.values()]
              if (!first || !second) return
              const box = event.currentTarget.getBoundingClientRect()
              pinch.current = {
                distance: Math.hypot(second.x - first.x, second.y - first.y),
                focalX: (first.x + second.x) / 2 - box.left - box.width / 2,
                focalY: (first.y + second.y) / 2 - box.top - box.height / 2,
                transform: transformRef.current,
              }
              drag.current = null
              return
            }
            if (transformRef.current.scale <= MIN_SCALE) return
            drag.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              transform: transformRef.current,
            }
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (pinch.current && pointers.current.size >= 2) {
              const [first, second] = [...pointers.current.values()]
              if (!first || !second) return
              const gesture = pinch.current
              const box = event.currentTarget.getBoundingClientRect()
              const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
              const focalX = (first.x + second.x) / 2 - box.left - box.width / 2
              const focalY = (first.y + second.y) / 2 - box.top - box.height / 2
              const scale = gesture.transform.scale * (distance / Math.max(1, gesture.distance))
              const ratio = scale / gesture.transform.scale
              commitTransform({
                scale,
                x: focalX - (gesture.focalX - gesture.transform.x) * ratio,
                y: focalY - (gesture.focalY - gesture.transform.y) * ratio,
              })
              return
            }
            const current = drag.current
            if (!current || current.id !== event.pointerId) return
            commitTransform({
              scale: current.transform.scale,
              x: current.transform.x + event.clientX - current.x,
              y: current.transform.y + event.clientY - current.y,
            })
          }}
          onPointerUp={(event) => {
            pointers.current.delete(event.pointerId)
            if (pointers.current.size < 2) pinch.current = null
            drag.current = null
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId)
            if (pointers.current.size < 2) pinch.current = null
            drag.current = null
          }}
          onLostPointerCapture={(event) => {
            pointers.current.delete(event.pointerId)
            if (pointers.current.size < 2) pinch.current = null
            drag.current = null
          }}
        >
          <span id="image-viewer-help" className="sr-only">
            使用加减按钮、滚轮、触控板手势或双击缩放；放大后拖动图片浏览，工具栏可复位。
          </span>
          {(asset.loading || imageFailure.retrying) && !src && (
            <div className="grid size-full place-items-center">
              <Spinner className="size-7" />
            </div>
          )}
          {(imageFailure.failed || asset.error) && !src && (
            <div className="grid size-full place-items-center text-center">
              <div>
                <p className="mb-3 text-sm text-muted-foreground">图片加载失败。</p>
                <Button
                  variant="outline"
                  disabled={imageFailure.retrying}
                  aria-busy={imageFailure.retrying || undefined}
                  onClick={() => void imageFailure.retryManually()}
                >
                  {imageFailure.retrying ? (
                    <>
                      <Spinner />
                      正在重试…
                    </>
                  ) : (
                    '重试'
                  )}
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
              decoding="async"
              onLoad={(event) => {
                imageFailure.markLoaded()
                reset()
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }}
              onError={imageFailure.markFailed}
              className="image-viewer-image absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: base.width ? `${base.width}px` : '100%',
                height: base.height ? `${base.height}px` : '100%',
                objectFit: base.width ? undefined : 'contain',
                transform: `translate3d(calc(-50% + ${viewTransform.x}px), calc(-50% + ${viewTransform.y}px), 0) scale(${viewTransform.scale})`,
                transformOrigin: 'center',
              }}
            />
          )}
          {imageFailure.failed && src && (
            <div className="grid size-full place-items-center text-center">
              <div>
                <p className="mb-3 text-sm text-muted-foreground">图片加载失败。</p>
                <Button
                  variant="outline"
                  disabled={imageFailure.retrying}
                  aria-busy={imageFailure.retrying || undefined}
                  onClick={() => void imageFailure.retryManually()}
                >
                  {imageFailure.retrying ? (
                    <>
                      <Spinner />
                      正在重试…
                    </>
                  ) : (
                    '重试'
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
