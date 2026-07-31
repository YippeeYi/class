import { Fragment, type ReactNode, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ImageViewer } from '@/components/archive/image-viewer'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { type MarkupNode, parseMarkup } from '@/lib/markup'
import { prepareRecordJump } from '@/lib/record-navigation'

function Annotation({ note, children }: { note: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="link"
            size="xs"
            className="record-annotation inline h-auto min-h-0 whitespace-normal px-0 py-0 align-baseline font-inherit"
          >
            {children}
          </Button>
        }
      />
      <TooltipContent className="max-w-sm text-sm leading-6">
        <MarkupContent content={note} />
      </TooltipContent>
    </Tooltip>
  )
}

function IllustrationReference({ path, children }: { path: string; children: ReactNode }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const preview = useSignedAsset(previewOpen ? path : '', { refresh: false })
  return (
    <HoverCard onOpenChange={setPreviewOpen}>
      <HoverCardTrigger
        render={
          <span className="inline-flex">
            <ImageViewer
              path={path}
              alt="记录插图"
              initialUrl={preview.src}
              trigger={
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="markup-link illustration-link inline h-auto min-h-0 whitespace-normal px-1 py-0 align-baseline font-inherit"
                >
                  {children}
                </Button>
              }
            />
          </span>
        }
      />
      <HoverCardContent className="w-auto max-w-[min(86vw,34rem)] p-2">
        <div className="grid min-h-32 min-w-48 place-items-center overflow-hidden rounded-md bg-muted/55">
          {preview.loading && <Spinner className="size-6" />}
          {preview.error && (
            <Button variant="outline" size="sm" onClick={() => void preview.retry()}>
              图片加载失败，重试
            </Button>
          )}
          {preview.src && (
            <img
              src={preview.src}
              alt="记录插图预览"
              className="max-h-[52vh] max-w-[80vw] object-contain"
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
  const navigate = useNavigate()
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
            type="button"
            variant="link"
            size="xs"
            className={`markup-link inline h-auto min-h-0 whitespace-normal px-1 py-0 align-baseline font-inherit ${node.kind}-link`}
            onClick={() => {
              if (node.kind === 'record') prepareRecordJump(`record-${node.id}`)
              if (target) navigate(target)
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
