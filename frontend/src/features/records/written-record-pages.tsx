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
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { recordStableKey } from '@/lib/record-identity'
import { type RecordStreamPage, recordPageKey } from '@/lib/record-stream'
import { rememberImageDimensions, useImageDimensions } from '@/services/image-metadata'
import type { RecordItem, RecordPage } from '@/types/domain'

export function WrittenRecordPages({
  pages,
  stream,
  matched,
  activeFilter,
  pageIndex,
  onPageChange,
  onRecordReference,
}: {
  pages: RecordPage[]
  stream: RecordStreamPage[]
  matched: RecordItem[]
  activeFilter: boolean
  pageIndex: number
  onPageChange: (next: number) => void
  onRecordReference: (recordId: string, source: HTMLElement) => void
}) {
  const visiblePages = pages.filter((page) => {
    if (!activeFilter) return true
    return stream
      .find((group) => group.page === recordPageKey(page.page))
      ?.records.some((record) => matched.includes(record))
  })
  const safeIndex = Math.max(0, Math.min(pageIndex, Math.max(0, visiblePages.length - 1)))
  const page = visiblePages[safeIndex]
  if (!page) return <EmptyState title="当前条件下没有手写页" />

  const pageRecords = (
    stream.find((group) => group.page === recordPageKey(page.page))?.records || []
  ).filter((record) => matched.includes(record))
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
              {page.page ? `第 ${page.page} 页` : '未编页记录'} · {safeIndex + 1}/
              {visiblePages.length}
            </strong>
            <Select
              value={page.page}
              onValueChange={(value) => {
                const nextIndex = visiblePages.findIndex((item) => item.page === value)
                if (nextIndex >= 0) onPageChange(nextIndex)
              }}
            >
              <SelectTrigger size="sm" aria-label="跳转书面页" className="w-28 bg-background/85">
                <SelectValue>{(value) => (value ? `第 ${value} 页` : '未编页记录')}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {visiblePages.map((item) => (
                  <SelectItem key={item.page} value={item.page}>
                    {item.page ? `第 ${item.page} 页` : '未编页记录'}
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
            {page.imagePath ? (
              <SignedPageImage key={page.imagePath} path={page.imagePath} page={page.page} />
            ) : (
              <EmptyState title="暂无对应扫描页" />
            )}
          </div>
          <div className="grid content-start gap-4">
            {pageRecords.map((record) => (
              <RecordCard
                key={recordStableKey(record)}
                record={record}
                onRecordReference={onRecordReference}
                showSourceAction={false}
              />
            ))}
            {!pageRecords.length && <EmptyState title="这张书面页没有对应的文字记录" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SignedPageImage({ path, page }: { path: string; page: string }) {
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
          <Button
            type="button"
            size="sm"
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
              '重试图片'
            )}
          </Button>
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
  if (!ready || imageFailure.failed || !image.src) return preview
  return (
    <ImageViewer
      path={path}
      initialUrl={image.src}
      initialDimensions={dimensions}
      alt={`手写记录第 ${page} 页`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full overflow-hidden rounded-lg border border-border/70 bg-transparent p-0 shadow-none group app-interactive-surface app-interactive-media"
          aria-label={`查看手写记录第 ${page} 页大图`}
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
