import { Expand, Map as MapIcon } from 'lucide-react'
import { useEffect } from 'react'

import { ImageViewer } from '@/components/archive/image-viewer'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAsyncData } from '@/hooks/use-async-data'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { loadMealMap } from '@/services/data'
import { rememberImageDimensions, useImageDimensions } from '@/services/image-metadata'

const MAP_PATH = 'images/private/meal-map.png'

export function MealMapPage() {
  const resource = useAsyncData(() => loadMealMap())
  const asset = useSignedAsset(MAP_PATH)
  const imageFailure = useBoundedImageRetry(MAP_PATH, asset.retry)
  const src = asset.src || resource.data?.url || ''
  const knownDimensions = useImageDimensions(MAP_PATH)
  const dimensions = resource.data || knownDimensions || { width: 4838, height: 2721 }
  const loading = (resource.loading || asset.loading) && !src
  const failed = Boolean(
    imageFailure.failed ||
      ((resource.error || asset.error || (!resource.loading && !resource.data)) && !src),
  )
  useEffect(() => {
    document.title = '蹭饭图 · 编日史'
  }, [])
  useEffect(() => {
    if (resource.data) rememberImageDimensions(MAP_PATH, resource.data)
  }, [resource.data])
  return (
    <div>
      <PageHeading
        title="蹭饭图"
        description="班级内部的共同地图。点击图片可缩放、拖动并查看原始细节。"
      />
      <Alert className="mb-5">
        <MapIcon />
        <AlertTitle>仅限已获访问权限的班级成员</AlertTitle>
        <AlertDescription>地图属于私有资源，链接会短时签名，请勿截图或外传。</AlertDescription>
      </Alert>
      <Card>
        <CardContent className="p-3 sm:p-4">
          {src && !imageFailure.failed ? (
            <ImageViewer
              path={MAP_PATH}
              initialUrl={src}
              alt="蹭饭图"
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className="group relative h-auto w-full overflow-hidden p-0"
                  aria-label="查看蹭饭图大图"
                >
                  <AspectRatio ratio={dimensions.width / dimensions.height}>
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
                      className="absolute inset-0 size-full object-contain motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
                    />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Expand className="size-3.5" />
                      查看大图
                    </span>
                  </AspectRatio>
                </Button>
              }
            />
          ) : (
            <AspectRatio
              ratio={dimensions.width / dimensions.height}
              className="grid place-items-center overflow-hidden rounded-md bg-muted/55"
            >
              {(loading || imageFailure.retrying) && !failed && (
                <div
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                  role="status"
                >
                  <Spinner className="size-6" />
                  正在加载蹭饭图…
                </div>
              )}
              {failed && (
                <div className="grid gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    蹭饭图加载失败，请检查网络后重试。
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resource.retry()
                      void imageFailure.retryManually()
                    }}
                  >
                    重试
                  </Button>
                </div>
              )}
            </AspectRatio>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
