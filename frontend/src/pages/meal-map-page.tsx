import { Expand, Map as MapIcon } from 'lucide-react'
import { useEffect } from 'react'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { ImageViewer } from '@/components/archive/image-viewer'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsyncData } from '@/hooks/use-async-data'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { loadMealMap } from '@/services/data'

const MAP_PATH = 'images/private/meal-map.png'

export function MealMapPage() {
  const resource = useAsyncData(() => loadMealMap())
  const asset = useSignedAsset(MAP_PATH)
  const src = asset.src || resource.data?.url || ''
  useEffect(() => {
    document.title = '蹭饭图 · 编日史'
  }, [])
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
      {(resource.loading || asset.loading) && !src && <PageSkeleton rows={1} />}
      {(resource.error || asset.error) && !src && (
        <ErrorState
          title="蹭饭图加载失败"
          onRetry={() => {
            resource.retry()
            void asset.retry()
          }}
        />
      )}
      {resource.data && src && (
        <Card>
          <CardContent>
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
                  <img
                    src={src}
                    width={resource.data.width}
                    height={resource.data.height}
                    alt="蹭饭图"
                    onError={() => void asset.retry()}
                    className="h-auto w-full object-contain"
                  />
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="size-3.5" />
                    查看大图
                  </span>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
