import { useState } from 'react'

import { EmptyState, ErrorState } from '@/components/archive/async-state'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useBoundedImageRetry } from '@/hooks/use-bounded-image-retry'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import qbAsset from '@/lib/qb-asset.json'

export function QbPage() {
  const path = qbAsset.ready ? qbAsset.path : ''
  const asset = useSignedAsset(path)
  const image = useBoundedImageRetry(path, asset.retry)
  const [loadedSource, setLoadedSource] = useState('')
  const failed = image.failed || (!asset.src && Boolean(asset.error))

  return (
    <Card className="content-frame relative grid h-full min-h-0 place-items-center overflow-hidden p-4">
      {!path ? (
        <EmptyState title="图片尚未提供" />
      ) : failed ? (
        <ErrorState title="图片加载失败" onRetry={() => void image.retryManually()} />
      ) : (
        <>
          {(asset.loading || loadedSource !== asset.src || image.retrying) && (
            <div
              className="absolute flex items-center gap-3 text-sm text-muted-foreground"
              role="status"
            >
              <Spinner />
              正在加载图片…
            </div>
          )}
          {asset.src && (
            <img
              src={asset.src}
              alt="QB"
              decoding="async"
              onLoad={() => {
                image.markLoaded()
                setLoadedSource(asset.src)
              }}
              onError={image.markFailed}
              className={`min-h-0 max-h-full max-w-full object-contain motion-safe:transition-opacity motion-safe:duration-(--interaction-duration-standard) ${loadedSource === asset.src ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
        </>
      )}
    </Card>
  )
}
