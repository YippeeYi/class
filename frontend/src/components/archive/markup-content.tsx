import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
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
  const [open, setOpen] = useState(false)
  const [lockedAlignOffset, setLockedAlignOffset] = useState(0)
  const pointerType = useRef('')
  const popupRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const pointerClientX = useRef<number | null>(null)
  const openRef = useRef(false)

  const focusFirstReference = () => {
    requestAnimationFrame(() => {
      popupRef.current?.querySelector<HTMLElement>('.markup-link')?.focus()
    })
  }

  const rememberPointerPosition = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch' || openRef.current) return
    pointerClientX.current = event.clientX
  }

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      if (!openRef.current) {
        const bounds = triggerRef.current?.getBoundingClientRect()
        const pointerX = pointerClientX.current
        setLockedAlignOffset(
          bounds && pointerX !== null ? pointerX - (bounds.left + bounds.width / 2) : 0,
        )
      }
      openRef.current = true
      setOpen(true)
      return
    }
    openRef.current = false
    setOpen(false)
    setLockedAlignOffset(0)
  }

  return (
    <HoverCard open={open} onOpenChange={changeOpen}>
      <HoverCardTrigger
        render={
          <Button
            ref={triggerRef}
            type="button"
            variant="link"
            size="xs"
            className="record-annotation inline h-auto min-h-0 whitespace-normal rounded-[0.15em] border-0 px-0 py-0 align-baseline text-[1em] leading-[inherit] font-[inherit] text-foreground/90 underline decoration-primary/55 decoration-dotted decoration-[1.5px] underline-offset-[0.18em] select-text hover:text-foreground hover:decoration-primary focus-visible:border-transparent focus-visible:ring-0"
            onPointerDown={(event) => {
              pointerType.current = event.pointerType
              if (event.pointerType === 'touch') pointerClientX.current = null
            }}
            onPointerEnter={rememberPointerPosition}
            onPointerMove={rememberPointerPosition}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) pointerClientX.current = null
            }}
            onClick={(event) => {
              if (event.detail === 0) {
                changeOpen(true)
                focusFirstReference()
              } else if (pointerType.current === 'touch') changeOpen(true)
            }}
          >
            {children}
          </Button>
        }
      />
      <HoverCardContent
        ref={popupRef}
        side="top"
        align="center"
        alignOffset={lockedAlignOffset}
        sideOffset={6}
        className="record-annotation-popup block w-max max-w-[min(22rem,calc(100vw-1rem))] px-3 py-2 text-left text-sm leading-6"
      >
        <MarkupContent content={note} className="annotation-content" interactionMode="references" />
      </HoverCardContent>
    </HoverCard>
  )
}

function IllustrationReference({ path, children }: { path: string; children: ReactNode }) {
  const [requested, setRequested] = useState(false)
  const dimensions = useImageDimensions(path)
  const [lockedDimensions, setLockedDimensions] = useState<ImageDimensions | null>(null)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [decodeFailed, setDecodeFailed] = useState(false)
  const [lockedAlignOffset, setLockedAlignOffset] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const pointerClientX = useRef<number | null>(null)
  const openRef = useRef(false)
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
  const rememberPointerPosition = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch' || openRef.current) return
    pointerClientX.current = event.clientX
  }
  const showAtLockedPointer = (nextDimensions: ImageDimensions) => {
    const bounds = triggerRef.current?.getBoundingClientRect()
    const pointerX = pointerClientX.current
    setLockedAlignOffset(
      bounds && pointerX !== null ? pointerX - (bounds.left + bounds.width / 2) : 0,
    )
    setLockedDimensions(nextDimensions)
    openRef.current = true
    setOpen(true)
  }
  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      openRequest.current += 1
      openRef.current = false
      setOpen(false)
      setLockedDimensions(null)
      setLockedAlignOffset(0)
      return
    }
    requestPreview()
    const request = ++openRequest.current
    const known = getImageDimensions(path)
    if (known) {
      showAtLockedPointer(known)
      return
    }
    void preloadImageDimensions(path).then((loaded) => {
      if (request !== openRequest.current) return
      showAtLockedPointer(loaded || { width: 240, height: 180 })
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
                  ref={triggerRef}
                  type="button"
                  variant="link"
                  size="xs"
                  className="markup-link illustration-link inline h-auto min-h-0 whitespace-normal rounded-none border-0 px-0 py-0 align-baseline text-[1em] leading-[inherit] font-[inherit] select-text focus-visible:border-transparent focus-visible:ring-0"
                  onPointerEnter={(event) => {
                    requestPreview()
                    rememberPointerPosition(event)
                  }}
                  onPointerMove={rememberPointerPosition}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(':focus-visible')) pointerClientX.current = null
                    requestPreview()
                  }}
                  onTouchStart={requestPreview}
                >
                  {children}
                </Button>
              }
            />
          </span>
        }
      />
      <HoverCardContent
        side="top"
        align="center"
        alignOffset={lockedAlignOffset}
        className="record-illustration-popup w-auto max-w-[calc(100vw-1rem)] p-2"
      >
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

function markupNodesText(nodes: MarkupNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.value
      if (
        node.type === 'style' ||
        node.type === 'reference' ||
        node.type === 'annotation' ||
        node.type === 'illustration'
      )
        return markupNodesText(node.children)
      if (node.type === 'stack')
        return `${markupNodesText(node.top)} ${markupNodesText(node.bottom)}`
      return node.rows.flat().map(markupNodesText).join(' ')
    })
    .join('')
}

function visibleTextUnits(nodes: MarkupNode[]) {
  return Array.from(markupNodesText(nodes).trim()).reduce((sum, character) => {
    if (/\s/u.test(character)) return sum + 0.35
    if ((character.codePointAt(0) || 0) <= 0x7f) return sum + 0.58
    return sum + 1
  }, 0)
}

function visibleHanCount(nodes: MarkupNode[]) {
  return (markupNodesText(nodes).match(/[\u4e00-\u9fff]/gu) || []).length
}

type TableGeometry = {
  columnCount: number
  columns: Array<{ id: string; width: string }>
  preferredWidth: string
}

const tableGeometryCache = new WeakMap<MarkupNode[][][], TableGeometry>()

function tableCellClassName(columnCount: number) {
  const density =
    columnCount >= 10
      ? 'px-[0.06em] py-[0.34em] text-[0.88em] leading-[1.45]'
      : columnCount >= 7
        ? 'px-[0.3em] py-[0.34em]'
        : 'px-[0.62em] py-[0.34em]'
  return `${density} align-top whitespace-normal break-words [overflow-wrap:anywhere]`
}

function tableGeometry(rows: MarkupNode[][][]): TableGeometry {
  const cached = tableGeometryCache.get(rows)
  if (cached) return cached
  const columnCount = Math.max(1, ...rows.map((row) => row.length))
  const stats = Array.from({ length: columnCount }, () => ({
    max: 0,
    shortMax: 0,
    mediumMax: 0,
    longMax: 0,
    longTotal: 0,
    longCount: 0,
    total: 0,
    count: 0,
  }))
  const cellMetrics: Array<{ column: number; units: number }> = []

  rows.forEach((row) => {
    for (let column = 0; column < columnCount; column += 1) {
      const cell = row[column] || []
      const units = visibleTextUnits(cell)
      const han = visibleHanCount(cell)
      const stat = stats[column]
      if (!stat) continue
      cellMetrics.push({ column, units })
      stat.max = Math.max(stat.max, units)
      stat.total += units
      stat.count += 1
      if (han > 0 && han <= 10) stat.shortMax = Math.max(stat.shortMax, units, han)
      if (han > 0 && han < 15) stat.mediumMax = Math.max(stat.mediumMax, units, han)
      if (units >= 15) {
        stat.longMax = Math.max(stat.longMax, units)
        stat.longTotal += units
        stat.longCount += 1
      }
    }
  })

  const widthBudget = Math.max(34, Math.min(78, 84 - columnCount * 2.2))
  const maxColumnWidth = Math.max(
    13,
    Math.min(44, widthBudget / Math.max(1, Math.sqrt(columnCount))),
  )
  const columns = stats.map((stat) => {
    const average = stat.count ? stat.total / stat.count : 0
    const longAverage = stat.longCount ? stat.longTotal / stat.longCount : 0
    const shortFloor = stat.shortMax ? stat.shortMax + 3.2 : 0
    const mediumFloor = stat.mediumMax ? Math.ceil(stat.mediumMax / 2) + 2.6 : 0
    const longFloor = stat.longMax
      ? Math.min(Math.max(11, Math.sqrt(stat.longMax) * 3.7), maxColumnWidth * 0.72)
      : 0
    const floor = Math.min(Math.max(4.4, shortFloor, mediumFloor, longFloor), maxColumnWidth)
    const longTarget = stat.longMax
      ? Math.min(
          Math.max(longAverage * 0.62, stat.longMax * 0.52, Math.sqrt(stat.longMax) * 5.7),
          maxColumnWidth,
        )
      : 0
    const contentTarget =
      stat.max <= 5 ? stat.max + 2.2 : stat.max < 15 ? stat.max + 2.2 : longTarget
    return {
      floor,
      ideal: Math.min(
        Math.max(floor, contentTarget, Math.min(average + 3.2, maxColumnWidth * 0.76)),
        maxColumnWidth,
      ),
      max: stat.max,
      longMax: stat.longMax,
      weight: Math.max(1, stat.longMax || stat.max || average || 1),
    }
  })

  const idealTotal = columns.reduce((sum, column) => sum + column.ideal, 0)
  const floorTotal = columns.reduce((sum, column) => sum + column.floor, 0)
  let extraToRemove = Math.max(
    0,
    idealTotal - Math.max(floorTotal, Math.min(idealTotal, widthBudget)),
  )
  let widths = columns.map((column) => column.ideal)

  while (extraToRemove > 0.01) {
    const candidates = columns
      .map((column, index) => ({ column, index, room: (widths[index] || 0) - column.floor }))
      .filter((item) => item.room > 0.01)
      .sort((left, right) => left.column.weight - right.column.weight)
    if (!candidates.length) break
    const inverseWeightTotal = candidates.reduce((sum, item) => sum + 1 / item.column.weight, 0)
    let removed = 0
    candidates.forEach((item) => {
      const take = Math.min(
        item.room,
        extraToRemove * (1 / item.column.weight / inverseWeightTotal),
      )
      widths[item.index] = (widths[item.index] || 0) - take
      removed += take
    })
    if (removed <= 0.01) break
    extraToRemove -= removed
  }

  const shouldExpand =
    floorTotal > widthBudget ||
    cellMetrics.some((metric) => metric.units > (widths[metric.column] || 0) + 0.35)
  if (shouldExpand) {
    let extraSpace = Math.max(0, widthBudget - widths.reduce((sum, width) => sum + width, 0))
    while (extraSpace > 0.01) {
      const candidates = columns
        .map((column, index) => ({
          column,
          index,
          room: Math.max(0, maxColumnWidth - (widths[index] || 0)),
          need: Math.max(0, column.max - (widths[index] || 0)),
        }))
        .filter((item) => item.room > 0.01 && (item.need > 0.01 || item.column.longMax > 0))
        .sort((left, right) => right.column.weight - left.column.weight)
      if (!candidates.length) break
      const weightTotal = candidates.reduce(
        (sum, item) => sum + item.column.weight * (item.need > 0 ? 1.4 : 1),
        0,
      )
      let added = 0
      candidates.forEach((item) => {
        const weighted = item.column.weight * (item.need > 0 ? 1.4 : 1)
        const room = item.column.longMax > 0 ? item.room : Math.min(item.room, item.need)
        const amount = Math.min(room, extraSpace * (weighted / weightTotal))
        widths[item.index] = (widths[item.index] || 0) + amount
        added += amount
      })
      if (added <= 0.01) break
      extraSpace -= added
    }
  }

  widths = widths.map((width) => Number(width.toFixed(2)))
  const totalWidth = Number(widths.reduce((sum, width) => sum + width, 0).toFixed(2))
  const reservedFraction =
    columnCount >= 10 ? 0.86 : columnCount >= 8 ? 0.8 : columnCount >= 5 ? 0.72 : 0.32
  const minimumShare = Math.min(0.18, reservedFraction / columnCount)
  const flexibleShare = Math.max(0, 1 - minimumShare * columnCount)
  const geometry = {
    columnCount,
    columns: widths.map((width, column) => ({
      id: `column-${column}`,
      width: shouldExpand
        ? `${(minimumShare + flexibleShare * (width / totalWidth)) * 100}%`
        : `${width}em`,
    })),
    preferredWidth: `${totalWidth}em`,
  }
  tableGeometryCache.set(rows, geometry)
  return geometry
}

export function MarkupContent({
  content,
  className = '',
  onRecordReference,
  interactionMode = 'full',
}: {
  content: string
  className?: string
  onRecordReference?: (recordId: string, source: HTMLElement) => void
  interactionMode?: 'full' | 'references' | 'plain'
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
        if (interactionMode === 'plain')
          return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>
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
        if (interactionMode !== 'full') {
          return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>
        } else {
          return (
            <Annotation key={key} note={node.note}>
              {renderNodes(node.children, key)}
            </Annotation>
          )
        }
      if (node.type === 'illustration')
        if (interactionMode !== 'full') {
          return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>
        } else {
          return (
            <IllustrationReference key={key} path={node.path}>
              {renderNodes(node.children, key)}
            </IllustrationReference>
          )
        }
      if (node.type === 'stack')
        return (
          <span key={key} className={`record-stack record-stack--${node.kind}`}>
            <span className="record-stack-text record-stack-top">
              {renderNodes(node.top, `${key}-top`)}
            </span>
            <span className="record-stack-line" aria-hidden="true" />
            <span className="record-stack-text record-stack-bottom">
              {renderNodes(node.bottom, `${key}-bottom`)}
            </span>
          </span>
        )
      const geometry = tableGeometry(node.rows)
      return (
        <div
          key={key}
          className="record-table-scroll"
          data-columns={geometry.columnCount}
          style={{ '--record-table-preferred-width': geometry.preferredWidth } as CSSProperties}
        >
          <Table
            aria-label="记录表格"
            className="!w-[min(100%,var(--record-table-preferred-width))] !min-w-0 !max-w-full table-fixed text-[1em] leading-[1.55]"
          >
            <colgroup>
              {geometry.columns.map((column) => (
                <col
                  key={`${key}-${column.id}`}
                  style={{ '--record-table-column-width': column.width } as CSSProperties}
                />
              ))}
            </colgroup>
            <TableBody>
              {node.rows.map((row, rowPosition) => {
                const rowKey = `${key}-row-${rowPosition}`
                return (
                  <TableRow key={rowKey}>
                    {row.map((cell, cellPosition) => {
                      const cellKey = `${rowKey}-cell-${cellPosition}`
                      return (
                        <TableCell
                          key={cellKey}
                          className={tableCellClassName(geometry.columnCount)}
                        >
                          {renderNodes(cell, cellKey)}
                        </TableCell>
                      )
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
  return (
    <span className={`quiz-answer-blank${revealed ? ' is-revealed' : ''}`}>
      <span className="quiz-answer-blank-text" aria-hidden={!revealed}>
        {answer}
      </span>
      {!revealed && <span className="sr-only">此处挖空</span>}
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
          <span key={key} className={`record-stack record-stack--${node.kind}`}>
            <span className="record-stack-text record-stack-top">
              {renderNodes(node.top, `${key}-top`)}
            </span>
            <span className="record-stack-line" aria-hidden="true" />
            <span className="record-stack-text record-stack-bottom">
              {renderNodes(node.bottom, `${key}-bottom`)}
            </span>
          </span>
        )
      const geometry = tableGeometry(node.rows)
      return (
        <div
          key={key}
          className="record-table-scroll quiz-markup-table"
          data-columns={geometry.columnCount}
          style={{ '--record-table-preferred-width': geometry.preferredWidth } as CSSProperties}
        >
          <Table
            aria-label="题目表格"
            className="!w-[min(100%,var(--record-table-preferred-width))] !min-w-0 !max-w-full table-fixed text-[1em] leading-[1.55]"
          >
            <colgroup>
              {geometry.columns.map((column) => (
                <col
                  key={`${key}-${column.id}`}
                  style={{ '--record-table-column-width': column.width } as CSSProperties}
                />
              ))}
            </colgroup>
            <TableBody>
              {node.rows.map((row, rowPosition) => {
                const rowKey = `${key}-row-${rowPosition}`
                return (
                  <TableRow key={rowKey}>
                    {row.map((cell, cellPosition) => {
                      const cellKey = `${rowKey}-cell-${cellPosition}`
                      return (
                        <TableCell
                          key={cellKey}
                          className={tableCellClassName(geometry.columnCount)}
                        >
                          {renderNodes(cell, cellKey)}
                        </TableCell>
                      )
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
