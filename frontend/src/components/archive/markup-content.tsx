import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ImageViewer } from '@/components/archive/image-viewer'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { type MarkupNode, parseMarkup } from '@/lib/markup'
import { prepareRecordJump } from '@/lib/record-navigation'

type ImageDimensions = { width: number; height: number }
const illustrationDimensions = new Map<string, ImageDimensions>()

function previewFrame(dimensions: ImageDimensions | null) {
  const maxWidth = Math.max(1, Math.min(360, window.innerWidth - 40))
  const maxHeight = Math.max(1, Math.min(280, window.innerHeight - 40))
  if (!dimensions) {
    const scale = Math.min(maxWidth / 240, maxHeight / 180)
    return { width: Math.round(240 * scale), height: Math.round(180 * scale) }
  }
  const scale = Math.min(1, maxWidth / dimensions.width, maxHeight / dimensions.height)
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  }
}

function Annotation({ note, children }: { note: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="link"
            size="xs"
            className="record-annotation inline h-auto min-h-0 whitespace-normal rounded-none border-0 px-0 py-0 align-baseline text-[1em] leading-[inherit] font-[inherit] text-inherit no-underline select-text hover:text-inherit hover:no-underline focus-visible:border-transparent focus-visible:ring-0"
          >
            {children}
          </Button>
        }
      />
      <TooltipContent className="max-w-sm text-sm leading-6">
        <MarkupContent content={note} className="annotation-content" />
      </TooltipContent>
    </Tooltip>
  )
}

function IllustrationReference({ path, children }: { path: string; children: ReactNode }) {
  const [requested, setRequested] = useState(false)
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(
    () => illustrationDimensions.get(path) || null,
  )
  const [ready, setReady] = useState(false)
  const [decodeFailed, setDecodeFailed] = useState(false)
  const preview = useSignedAsset(requested ? path : '', { refresh: false })
  const frame = previewFrame(dimensions)

  useEffect(() => {
    if (!preview.src) return
    let active = true
    setReady(false)
    setDecodeFailed(false)
    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'high'
    image.onload = () => {
      if (!active || !image.naturalWidth || !image.naturalHeight) return
      const next = { width: image.naturalWidth, height: image.naturalHeight }
      illustrationDimensions.set(path, next)
      setDimensions(next)
      setReady(true)
    }
    image.onerror = () => {
      if (active) setDecodeFailed(true)
    }
    image.src = preview.src
    return () => {
      active = false
    }
  }, [path, preview.src])

  const requestPreview = () => setRequested(true)
  return (
    <HoverCard onOpenChange={(open) => open && requestPreview()}>
      <HoverCardTrigger
        render={
          <span className="inline">
            <ImageViewer
              path={path}
              alt="记录插图"
              initialUrl={preview.src}
              trigger={
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="markup-link illustration-link inline h-auto min-h-0 whitespace-normal rounded-none border-0 px-0 py-0 align-baseline text-[1em] leading-[inherit] font-[inherit] select-text focus-visible:border-transparent focus-visible:ring-0"
                  onPointerEnter={requestPreview}
                  onFocus={requestPreview}
                  onTouchStart={requestPreview}
                >
                  {children}
                </Button>
              }
            />
          </span>
        }
      />
      <HoverCardContent side="top" align="start" className="w-auto max-w-[calc(100vw-1rem)] p-2">
        <div
          className="grid place-items-center overflow-hidden rounded-md bg-muted/55 transition-[width,height] duration-150"
          style={{ width: frame.width, height: frame.height }}
        >
          {(preview.loading || (preview.src && !ready && !decodeFailed)) && (
            <Spinner className="size-6" />
          )}
          {(preview.error || decodeFailed) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDecodeFailed(false)
                void preview.retry()
              }}
            >
              图片加载失败，重试
            </Button>
          )}
          {preview.src && ready && (
            <img
              src={preview.src}
              alt="记录插图预览"
              width={dimensions?.width}
              height={dimensions?.height}
              className="size-full object-contain"
            />
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function MarkupContent({
  content,
  className = '',
}: {
  content: string
  className?: string
}) {
  const tree = useMemo(() => parseMarkup(content), [content])

  const renderNodes = (nodes: MarkupNode[], path: string): ReactNode =>
    nodes.map((node, position) => {
      const key = `${path}-${node.type}-${position}`
      if (node.type === 'text') return <Fragment key={key}>{node.value}</Fragment>
      if (node.type === 'style') {
        const children = renderNodes(node.children, key)
        if (node.style === 'del')
          return (
            <del key={key} className="record-delete">
              {children}
            </del>
          )
        if (node.style === 'sup') return <sup key={key}>{children}</sup>
        if (node.style === 'sub') return <sub key={key}>{children}</sub>
        return (
          <span
            key={key}
            className={`record-${node.style === 'under' ? 'underline' : node.style === 'hide' ? 'redacted' : node.style}`}
          >
            {children}
          </span>
        )
      }
      if (node.type === 'reference') {
        const target =
          node.kind === 'person' || node.kind === 'author'
            ? `/person?id=${encodeURIComponent(node.id)}`
            : node.kind === 'record'
              ? `/records?view=list#record-${node.id}`
              : node.kind === 'material'
                ? `/materials?id=${encodeURIComponent(node.id)}`
                : node.kind === 'quote'
                  ? `/quotes#quote-${node.id}`
                  : ''
        return (
          <Button
            key={key}
            variant="link"
            size="xs"
            render={<Link to={target} />}
            className={`markup-link inline h-auto min-h-0 whitespace-normal rounded-none border-0 px-0 py-0 align-baseline text-[1em] leading-[inherit] font-[inherit] select-text focus-visible:border-transparent focus-visible:ring-0 ${node.kind}-link`}
            onClick={() => {
              if (node.kind === 'record') prepareRecordJump(`record-${node.id}`)
            }}
          >
            {renderNodes(node.children, key)}
          </Button>
        )
      }
      if (node.type === 'annotation')
        return (
          <Annotation key={key} note={node.note}>
            {renderNodes(node.children, key)}
          </Annotation>
        )
      if (node.type === 'illustration')
        return (
          <IllustrationReference key={key} path={node.path}>
            {renderNodes(node.children, key)}
          </IllustrationReference>
        )
      if (node.type === 'stack')
        return (
          <span key={key} className="record-stack">
            <span>{renderNodes(node.top, `${key}-top`)}</span>
            <span>{renderNodes(node.bottom, `${key}-bottom`)}</span>
          </span>
        )
      return (
        <span key={key} className="record-table-scroll">
          <table>
            <tbody>
              {node.rows.map((row, rowPosition) => {
                const rowKey = `${key}-row-${rowPosition}`
                return (
                  <tr key={rowKey}>
                    {row.map((cell, cellPosition) => {
                      const cellKey = `${rowKey}-cell-${cellPosition}`
                      return <td key={cellKey}>{renderNodes(cell, cellKey)}</td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </span>
      )
    })

  return <div className={`record-markup ${className}`}>{renderNodes(tree, 'root')}</div>
}
