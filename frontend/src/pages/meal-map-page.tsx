import { Expand, Map as MapIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAsyncData } from '@/hooks/use-async-data'
import { loadMealMap } from '@/services/data'

export function MealMapPage() {
  const [open, setOpen] = useState(false)
  const resource = useAsyncData(() => loadMealMap())
  useEffect(() => {
    document.title = '蹭饭图 · 编日史'
  }, [])
  return (
    <div>
      <PageHeading
        title="蹭饭图"
        description="班级内部的共同地图。点击图片可以在大图视图中查看。"
      />
      <Alert className="mb-5">
        <MapIcon />
        <AlertTitle>仅限已获访问权限的班级成员</AlertTitle>
        <AlertDescription>地图属于私有资源，链接会短时签名，请勿截图或外传。</AlertDescription>
      </Alert>
      {resource.loading && <PageSkeleton rows={1} />}
      {resource.error && <ErrorState title="蹭饭图加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <Card className="bg-card/80">
          <CardContent className="pt-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="group relative block w-full overflow-hidden rounded-xl bg-muted"
            >
              <img
                src={resource.data.url}
                width={resource.data.width}
                height={resource.data.height}
                alt="蹭饭图"
                className="h-auto w-full object-contain"
              />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                <Expand className="size-3.5" />
                查看大图
              </span>
            </button>
          </CardContent>
        </Card>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[96vw] bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>蹭饭图</DialogTitle>
            <DialogDescription className="text-zinc-400">
              可使用浏览器缩放与滚动查看细节。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[82vh] overflow-auto rounded-lg bg-black p-2">
            {resource.data && (
              <img
                src={resource.data.url}
                width={resource.data.width}
                height={resource.data.height}
                alt="蹭饭图大图"
                className="h-auto max-w-none"
                style={{ width: 'min(1800px, 180vw)' }}
              />
            )}
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
