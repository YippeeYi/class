import { Fragment, type ReactNode, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { type MarkupNode, parseMarkup } from '@/lib/markup'
import { signAssetUrl } from '@/services/data'

export function MarkupContent({
  content,
  className = '',
}: {
  content: string
  className?: string
}) {
  const navigate = useNavigate()
  const [image, setImage] = useState<{
    open: boolean
    src: string
    loading: boolean
    error: boolean
  }>({ open: false, src: '', loading: false, error: false })
  const tree = useMemo(() => parseMarkup(content), [content])
  const openIllustration = useCallback((path: string) => {
    setImage({ open: true, src: '', loading: true, error: false })
    signAssetUrl(path)
      .then((src) => setImage({ open: true, src, loading: false, error: !src }))
      .catch(() => setImage({ open: true, src: '', loading: false, error: true }))
  }, [])

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
          <button
            key={key}
            type="button"
            className={`markup-link ${node.kind}-link`}
            onClick={() => target && navigate(target)}
          >
            {renderNodes(node.children, key)}
          </button>
        )
      }
      if (node.type === 'annotation')
        return (
          <span key={key} className="record-annotation" title={node.note}>
            {renderNodes(node.children, key)}
          </span>
        )
      if (node.type === 'illustration')
        return (
          <button
            key={key}
            type="button"
            className="markup-link illustration-link"
            onClick={() => openIllustration(node.path)}
          >
            {renderNodes(node.children, key)}
          </button>
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

  return (
    <>
      <div className={`record-markup ${className}`}>{renderNodes(tree, 'root')}</div>
      <Dialog
        open={image.open}
        onOpenChange={(open) => setImage((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-[min(94vw,72rem)] bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>记录插图</DialogTitle>
            <DialogDescription className="text-zinc-400">点击关闭按钮返回记录。</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-64 place-items-center overflow-auto rounded-lg bg-black/40 p-3">
            {image.loading && <Spinner className="size-7" />}
            {image.error && <p className="text-zinc-300">图片加载失败，请稍后重试。</p>}
            {image.src && (
              <img
                src={image.src}
                alt="记录插图"
                className="max-h-[76vh] max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
