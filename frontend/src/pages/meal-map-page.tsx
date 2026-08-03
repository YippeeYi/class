import { Expand, LockKeyhole } from 'lucide-react'
import { useEffect } from 'react'

import { ImageViewer } from '@/components/archive/image-viewer'
import { PageHeading } from '@/components/archive/page-heading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    document.title = '蹭饭图 · 编日史'
  }, [])
  useEffect(() => {
    if (resource.data) rememberImageDimensions(MAP_PATH, resource.data)
  }, [resource.data])
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeading
        eyebrow={null}
        title="蹭饭图"
        description="点击图片可缩放、拖动并查看原始细节。图片始终在当前视口内完整显示。"
        className="shrink-0"
        compact
        actions={
          <Badge variant="outline" className="bg-background/65">
            <LockKeyhole data-icon="inline-start" />
            班级私有资源 · 请勿外传
          </Badge>
        }
      />
      <figure className="relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-xl border border-border/75 bg-card/78 shadow-sm backdrop-blur-md">
        {src && !imageFailure.failed ? (
          <ImageViewer
            path={MAP_PATH}
            initialUrl={src}
            alt="蹭饭图"
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="group relative size-full min-h-0 overflow-hidden rounded-none p-0"
                aria-label="查看蹭饭图大图"
              >
                <img
                  key={src}
                  src={src}
                  width={dimensions.width}
                  height={dimensions.height}
                  alt="蹭饭图"
                  onLoad={(event) => {
                    imageFailure.markLoaded()
                    rememberImageDimensions(MAP_PATH, {
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }}
                  onError={imageFailure.markFailed}
                  className="absolute inset-0 size-full object-contain p-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 sm:p-3"
                />
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/90 px-3 py-2 text-xs text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Expand className="size-3.5" />
                  查看大图
                </span>
              </Button>
            }
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-muted/35">
            {(loading || imageFailure.retrying) && !failed && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
                <Spinner className="size-6" />
                正在获取蹭饭图的短时访问地址…
              </div>
            )}
            {failed && (
              <div className="grid max-w-sm gap-3 px-6 text-center">
                <p className="text-sm leading-6 text-muted-foreground">
                  蹭饭图加载失败。访问地址可能已过期，请检查网络后重试。
                </p>
                <Button
                  variant="outline"
                  className="mx-auto"
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
    </div>
  )
}
