import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/archive/async-state'
import { ImageViewer } from '@/components/archive/image-viewer'
import { RecordCard } from '@/components/archive/record-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { recordWithinPage } from '@/features/records/record-page-mapping'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { buildSupplementalRecords } from '@/lib/record-identity'
import { compareRecordNumber, orderRecords } from '@/lib/record-order'
import { rememberImageDimensions, useImageDimensions } from '@/services/image-metadata'
import type { PageMessage, PageSupplement, RecordItem, RecordPage } from '@/types/domain'

export function WrittenRecordPages({
  pages,
  records,
  matched,
  messages,
  supplements,
  activeFilter,
  pageIndex,
  hidden,
  onPageChange,
  onRecordReference,
}: {
  pages: RecordPage[]
  records: RecordItem[]
  matched: RecordItem[]
  messages: PageMessage[]
  supplements: PageSupplement[]
  activeFilter: boolean
  pageIndex: number
  hidden: boolean
  onPageChange: (next: number) => void
  onRecordReference: (recordId: string, source: HTMLElement) => void
}) {
  const visiblePages = pages.filter((page) => {
    if (!activeFilter) return Boolean(page.imagePath)
    return matched.some((record) =>
      record.recordType
        ? String(record.page) === page.page
        : recordWithinPage(page, record, records),
    )
  })
  const safeIndex = Math.max(0, Math.min(pageIndex, Math.max(0, visiblePages.length - 1)))
  const page = visiblePages[safeIndex]
  if (!page)
    return <EmptyState title={hidden ? '没有可展示的隐藏书面页' : '当前条件下没有手写页'} />

  const pageRecords = orderRecords(
    matched.filter((record) => !record.recordType && recordWithinPage(page, record, records)),
    'ascending',
    compareRecordNumber,
  )
  const pageMessage = messages.find((item) => item.page === page.page)
  const pageSupplements = supplements
    .filter((item) => item.page === page.page)
    .sort(
      (left, right) =>
        left.supplementIndex - right.supplementIndex ||
        left.id.localeCompare(right.id, 'zh-CN', { numeric: true }),
    )
  const previousPath = visiblePages[safeIndex - 1]?.imagePath || ''
  const nextPath = visiblePages[safeIndex + 1]?.imagePath || ''

  return (
    <Card className="overflow-visible">
      <CardContent>
        <PageImagePreloader previousPath={previousPath} nextPath={nextPath} />
        <div className="mb-5 grid grid-cols-2 items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3">
          <Button
            variant="outline"
            className="order-2 w-full sm:order-1 sm:w-auto"
            disabled={safeIndex <= 0}
            onClick={() => onPageChange(safeIndex - 1)}
          >
            上一页
          </Button>
          <div className="order-1 col-span-2 flex min-w-0 flex-wrap items-center justify-center gap-2 sm:order-2 sm:col-span-1">
            <strong className="text-center text-sm leading-5">
              {hidden ? '隐藏 ' : ''}第 {page.page} 页 · {safeIndex + 1}/{visiblePages.length}
            </strong>
            <Select
              value={page.page}
              onValueChange={(value) => {
                const nextIndex = visiblePages.findIndex((item) => item.page === value)
                if (nextIndex >= 0) onPageChange(nextIndex)
              }}
            >
              <SelectTrigger size="sm" aria-label="跳转书面页" className="w-28 bg-background/85">
                <SelectValue>
                  {(value) => (typeof value === 'string' ? `第 ${value} 页` : '选择页码')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {visiblePages.map((item) => (
                  <SelectItem key={item.page} value={item.page}>
                    第 {item.page} 页
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="order-3 w-full sm:w-auto"
            disabled={safeIndex >= visiblePages.length - 1}
            onClick={() => onPageChange(safeIndex + 1)}
          >
            下一页
          </Button>
        </div>
        <div
          key={page.imagePath}
          className="grid items-start gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow) lg:grid-cols-[minmax(20rem,42%)_minmax(0,1fr)]"
        >
          <div className="min-h-0 self-start lg:sticky lg:top-20">
            <SignedPageImage
              key={page.imagePath}
              path={page.imagePath}
              page={page.page}
              hidden={hidden}
            />
          </div>
          <div className="grid content-start gap-4">
            {pageMessage &&
              (!activeFilter ||
                matched.some((item) => item.recordType === 'message' && item.page === page.page)) &&
              buildSupplementalRecords([pageMessage], []).map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onRecordReference={onRecordReference}
                  showSourceAction={false}
                />
              ))}
            {pageSupplements
              .filter(
                (item) =>
                  !activeFilter ||
                  matched.some(
                    (record) =>
                      record.recordType === 'supplement' &&
                      record.page === item.page &&
                      record.supplementIndex === item.supplementIndex,
                  ),
              )
              .map((item) => {
                const [record] = buildSupplementalRecords([], [item])
                return record ? (
                  <RecordCard
                    key={item.id}
                    record={record}
                    onRecordReference={onRecordReference}
                    showSourceAction={false}
                  />
                ) : null
              })}
            {pageRecords.map((record) => (
              <RecordCard
                key={record.fileName || record.id}
                record={record}
                onRecordReference={onRecordReference}
                showSourceAction={false}
              />
            ))}
            {!pageMessage && !pageSupplements.length && !pageRecords.length && (
              <EmptyState title="这张书面页没有对应的文字记录" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SignedPageImage({ path, page, hidden }: { path: string; page: string; hidden: boolean }) {
  const image = useSignedAsset(path, { variant: 'preview', width: 1200 })
  const imageFailure = useBoundedImageRetry(path, image.retry)
  const dimensions = useImageDimensions(path, true, 1200) || { width: 2856, height: 4282 }
  const [ready, setReady] = useState(false)
  const ratio = dimensions.width / dimensions.height
  const preview = (
    <div
      className="relative mx-auto grid max-w-full place-items-center overflow-hidden rounded-md bg-transparent"
      style={{
        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
        width: `min(100%, calc((100svh - 6rem) * ${ratio}))`,
      }}
      aria-busy={!ready && !image.error && !imageFailure.failed}
    >
      {!ready && !image.error && !imageFailure.failed && <Spinner className="size-7" />}
      {(imageFailure.failed || (image.error && !image.src)) && (
        <div className="grid gap-1 px-4 text-center text-sm text-muted-foreground">
          <p>手写页图片加载失败。</p>
          <span className="text-meta text-primary">打开大图后可重试</span>
        </div>
      )}
      {image.src && (
        <img
          key={image.src}
          src={image.src}
          width={dimensions.width}
          height={dimensions.height}
          alt={`手写记录第 ${page} 页`}
          decoding="async"
          fetchPriority="high"
          onLoad={(event) => {
            rememberImageDimensions(path, {
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
            imageFailure.markLoaded()
            setReady(true)
          }}
          onError={() => {
            setReady(false)
            imageFailure.markFailed()
          }}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-(--interaction-duration-slow) ${ready && !imageFailure.failed ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
  return (
    <ImageViewer
      path={path}
      initialUrl={image.src}
      initialDimensions={dimensions}
      alt={`${hidden ? '隐藏' : '手写'}记录第 ${page} 页`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full overflow-hidden rounded-lg border border-border/70 bg-transparent p-0 shadow-none group app-interactive-surface app-interactive-media"
          aria-label={`查看${hidden ? '隐藏' : '手写'}记录第 ${page} 页大图`}
        >
          {preview}
        </Button>
      }
    />
  )
}

function PageImagePreloader({
  previousPath,
  nextPath,
}: {
  previousPath: string
  nextPath: string
}) {
  const previous = useSignedAsset(previousPath, { variant: 'preview', width: 1200 })
  const next = useSignedAsset(nextPath, { variant: 'preview', width: 1200 })
  useEffect(() => {
    for (const src of [previous.src, next.src].filter(Boolean)) {
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = 'low'
      image.src = src
    }
  }, [next.src, previous.src])
  return null
}
