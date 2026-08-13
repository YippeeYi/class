import { Expand } from 'lucide-react'
import { useEffect } from 'react'

import { ImageViewer } from '@/components/archive/image-viewer'
import {
  Button,
  interactiveSurfaceVariants,
  mediaAffordanceClassName,
} from '@/components/archive/interaction'
import { PageHeading } from '@/components/archive/page-heading'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAsyncData } from '@/hooks/use-async-data'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { loadMealMapMetadata } from '@/services/data'
import { getImageDimensions, rememberImageDimensions } from '@/services/image-metadata'

const MAP_PATH = 'images/private/meal-map.png'

export function MealMapPage() {
  const resource = useAsyncData(() => loadMealMapMetadata())
  const asset = useSignedAsset(MAP_PATH)
  const imageFailure = useBoundedImageRetry(MAP_PATH, asset.retry)
  const src = asset.src
  const knownDimensions = getImageDimensions(MAP_PATH)
  const dimensions = resource.data || knownDimensions || { width: 4838, height: 2721 }
  const loading = asset.loading && !src
  const failed = Boolean(imageFailure.failed || (!asset.loading && asset.error && !src))
  useEffect(() => {
    document.title = '地图 · 编日史'
  }, [])
  useEffect(() => {
    if (resource.data) rememberImageDimensions(MAP_PATH, resource.data)
  }, [resource.data])
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeading
        eyebrow={null}
        title="地图"
        description="点击图片可缩放、拖动并查看原始细节。图片始终在当前视口内完整显示。"
        className="shrink-0"
        compact
      />
      <Card className="content-frame min-h-0 flex-1 gap-0 py-0">
        <figure className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
          {src && !imageFailure.failed ? (
            <ImageViewer
              path={MAP_PATH}
              initialUrl={src}
              alt="地图"
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className={`${interactiveSurfaceVariants({ kind: 'media' })} relative size-full min-h-0 overflow-hidden rounded-none p-0`}
                  aria-label="查看地图大图"
                >
                  <img
                    key={src}
                    src={src}
                    width={dimensions.width}
                    height={dimensions.height}
                    alt="地图"
                    decoding="async"
                    fetchPriority="high"
                    onLoad={(event) => {
                      imageFailure.markLoaded()
                      rememberImageDimensions(MAP_PATH, {
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })
                    }}
                    onError={imageFailure.markFailed}
                    className="absolute inset-0 size-full object-contain p-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:p-3"
                  />
                  <span
                    data-liquid-glass-interactive
                    data-glass-variant="clear"
                    className={`${mediaAffordanceClassName} absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur`}
                  >
                    <Expand className="size-3.5" />
                    查看大图
                  </span>
                </Button>
              }
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-muted/35">
              {(loading || imageFailure.retrying) && !failed && (
                <div
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                  role="status"
                >
                  <Spinner className="size-6" />
                  正在获取地图的短时访问地址…
                </div>
              )}
              {failed && (
                <div className="grid max-w-sm gap-3 px-6 text-center">
                  <p className="text-sm leading-6 text-muted-foreground">
                    地图加载失败。访问地址可能已过期，请检查网络后重试。
                  </p>
                  <Button
                    variant="outline"
                    className="mx-auto"
                    loading={imageFailure.retrying}
                    loadingLabel="正在重试…"
                    onClick={() => {
                      resource.retry()
                      void imageFailure.retryManually()
                    }}
                  >
                    重试
                  </Button>
                </div>
              )}
            </div>
          )}
          <figcaption className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/82 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
            滚轮缩放 · 拖动浏览 · 工具栏复位
          </figcaption>
        </figure>
      </Card>
    </div>
  )
}
