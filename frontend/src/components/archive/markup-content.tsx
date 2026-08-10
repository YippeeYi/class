import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'

import { ImageViewer } from '@/components/archive/image-viewer'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import type { ImageDimensions } from '@/lib/image-metadata'
import { type MarkupNode, parseMarkup, parseQuizMarkup, recordAnchor } from '@/lib/markup'
import { prepareRecordJump } from '@/lib/record-navigation'
import {
  getImageDimensions,
  preloadImageDimensions,
  rememberImageDimensions,
  useImageDimensions,
} from '@/services/image-metadata'

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
  const dimensions = useImageDimensions(path)
  const [lockedDimensions, setLockedDimensions] = useState<ImageDimensions | null>(null)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [decodeFailed, setDecodeFailed] = useState(false)
  const openRequest = useRef(0)
  const preview = useSignedAsset(requested ? path : '')
  const frame = previewFrame(lockedDimensions || dimensions)

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
      rememberImageDimensions(path, next)
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

  const requestPreview = () => {
    setRequested(true)
    void preloadImageDimensions(path)
  }
  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      openRequest.current += 1
      setOpen(false)
      setLockedDimensions(null)
      return
    }
    requestPreview()
    const request = ++openRequest.current
    const known = getImageDimensions(path)
    if (known) {
      setLockedDimensions(known)
      setOpen(true)
      return
    }
    void preloadImageDimensions(path).then((loaded) => {
      if (request !== openRequest.current) return
      setLockedDimensions(loaded || { width: 240, height: 180 })
      setOpen(true)
    })
  }
  return (
    <HoverCard open={open} onOpenChange={changeOpen}>
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
          className="grid place-items-center overflow-hidden rounded-md bg-muted/55"
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
              width={lockedDimensions?.width || dimensions?.width}
              height={lockedDimensions?.height || dimensions?.height}
              className="size-full object-contain motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
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
  onRecordReference,
}: {
  content: string
  className?: string
  onRecordReference?: (recordId: string, source: HTMLElement) => void
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
        const recordTarget = node.kind === 'record' ? recordAnchor({ fileName: node.id }) : ''
        const target =
          node.kind === 'person' || node.kind === 'author'
            ? `/person?id=${encodeURIComponent(node.id)}`
            : node.kind === 'record'
              ? `/records?view=list#${recordTarget}`
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
            nativeButton={false}
            render={<Link to={target} />}
            className={`markup-link inline h-auto min-h-0 whitespace-normal rounded-none border-0 px-0 py-0 align-baseline text-[1em] leading-[inherit] font-[inherit] select-text focus-visible:border-transparent focus-visible:ring-0 ${node.kind}-link`}
            onClick={(event) => {
              if (node.kind !== 'record') return
              if (onRecordReference) {
                event.preventDefault()
                onRecordReference(node.id, event.currentTarget)
                return
              }
              prepareRecordJump(recordTarget)
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
        <div key={key} className="record-table-scroll">
          <Table>
            <TableBody>
              {node.rows.map((row, rowPosition) => {
                const rowKey = `${key}-row-${rowPosition}`
                return (
                  <TableRow key={rowKey}>
                    {row.map((cell, cellPosition) => {
                      const cellKey = `${rowKey}-cell-${cellPosition}`
                      return <TableCell key={cellKey}>{renderNodes(cell, cellKey)}</TableCell>
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )
    })

  return <div className={`record-markup ${className}`}>{renderNodes(tree, 'root')}</div>
}

type QuizCorrection = { wrongText: string; correctText: string }

function QuizAnswerBlank({ answer, revealed }: { answer: string; revealed: boolean }) {
  const width = Math.max(2, Array.from(answer).length)
  return (
    <span
      className={`quiz-answer-blank${revealed ? ' is-revealed' : ''}`}
      style={{ '--quiz-blank-width': `${width}em` } as CSSProperties}
    >
      {revealed ? answer : <span className="sr-only">此处挖空</span>}
    </span>
  )
}

function decorateQuizText({
  value,
  keyPrefix,
  blankAnswer,
  corrections,
  revealed,
}: {
  value: string
  keyPrefix: string
  blankAnswer: string
  corrections: QuizCorrection[]
  revealed: boolean
}) {
  if (blankAnswer && value.includes(blankAnswer)) {
    const parts = value.split(blankAnswer)
    return parts.flatMap((part, index) => {
      const textKey = `${keyPrefix}-text-${index}`
      const blankKey = `${keyPrefix}-blank-${index}`
      const output: ReactNode[] = [<Fragment key={textKey}>{part}</Fragment>]
      if (index < parts.length - 1)
        output.push(<QuizAnswerBlank key={blankKey} answer={blankAnswer} revealed={revealed} />)
      return output
    })
  }
  if (!revealed || !corrections.length) return value
  const output: ReactNode[] = []
  let cursor = 0
  let segment = 0
  while (cursor < value.length) {
    const candidates = corrections
      .filter((item) => item.wrongText)
      .map((item) => ({ item, index: value.indexOf(item.wrongText, cursor) }))
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index)
    const next = candidates[0]
    if (!next) break
    if (next.index > cursor)
      output.push(
        <Fragment key={`${keyPrefix}-before-${segment}`}>
          {value.slice(cursor, next.index)}
        </Fragment>,
      )
    output.push(
      <span className="quiz-judge-correction" key={`${keyPrefix}-correction-${segment}`}>
        <span className="quiz-judge-wrong">{next.item.wrongText}</span>
        <span className="quiz-judge-answer">{next.item.correctText}</span>
      </span>,
    )
    cursor = next.index + next.item.wrongText.length
    segment += 1
  }
  if (!output.length) return value
  if (cursor < value.length)
    output.push(<Fragment key={`${keyPrefix}-after`}>{value.slice(cursor)}</Fragment>)
  return output
}

export function QuizMarkupContent({
  content,
  blankAnswer = '',
  blankReference,
  corrections = [],
  revealed = false,
}: {
  content: string
  blankAnswer?: string
  blankReference?: { kind: 'person' | 'quote'; id: string }
  corrections?: QuizCorrection[]
  revealed?: boolean
}) {
  const tree = useMemo(
    () =>
      parseQuizMarkup(
        content,
        blankReference && blankAnswer ? { ...blankReference, replacement: blankAnswer } : undefined,
      ),
    [blankAnswer, blankReference, content],
  )
  const renderNodes = (nodes: MarkupNode[], path: string): ReactNode =>
    nodes.map((node, position) => {
      const key = `${path}-${node.type}-${position}`
      if (node.type === 'text')
        return (
          <Fragment key={key}>
            {decorateQuizText({
              value: node.value,
              keyPrefix: key,
              blankAnswer,
              corrections,
              revealed,
            })}
          </Fragment>
        )
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
          <span key={key} className={`record-${node.style === 'under' ? 'underline' : node.style}`}>
            {children}
          </span>
        )
      }
      if (node.type === 'reference' || node.type === 'annotation' || node.type === 'illustration')
        return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>
      if (node.type === 'stack')
        return (
          <span key={key} className="record-stack">
            <span>{renderNodes(node.top, `${key}-top`)}</span>
            <span>{renderNodes(node.bottom, `${key}-bottom`)}</span>
          </span>
        )
      return (
        <div key={key} className="record-table-scroll quiz-markup-table">
          <Table>
            <TableBody>
              {node.rows.map((row, rowPosition) => {
                const rowKey = `${key}-row-${rowPosition}`
                return (
                  <TableRow key={rowKey}>
                    {row.map((cell, cellPosition) => {
                      const cellKey = `${rowKey}-cell-${cellPosition}`
                      return <TableCell key={cellKey}>{renderNodes(cell, cellKey)}</TableCell>
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )
    })

  return <div className="record-markup quiz-safe-markup">{renderNodes(tree, 'quiz-root')}</div>
}
