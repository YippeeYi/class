import { FileText } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAsyncData } from '@/hooks/use-async-data'
import { loadMaterials } from '@/services/data'

export function MaterialsPage() {
  const [params, setParams] = useSearchParams()
  const resource = useAsyncData(() => loadMaterials())
  useEffect(() => {
    document.title = '资料 · 编日史'
  }, [])
  const requestedId = params.get('id') || ''
  const invalidRequestedId = Boolean(
    requestedId && resource.data && !resource.data.some((item) => item.id === requestedId),
  )
  const activeId = resource.data?.some((item) => item.id === requestedId)
    ? requestedId
    : resource.data?.[0]?.id || ''
  const active = resource.data?.find((item) => item.id === activeId)
  const select = (id: string) => {
    setParams(id ? { id } : {}, { replace: true })
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeading title="资料" description="班级档案的补充材料与专题内容。" className="shrink-0" />
      {resource.loading && <PageSkeleton rows={4} />}
      {resource.error && <ErrorState title="资料加载失败" onRetry={resource.retry} />}
      {resource.data?.length === 0 && (
        <EmptyState title="暂无资料" description="补充材料与专题内容尚未上传。" />
      )}
      {invalidRequestedId && (
        <Alert className="mb-4 shrink-0">
          <AlertTitle>未找到指定资料</AlertTitle>
          <AlertDescription>已为你显示资料目录中的第一项。</AlertDescription>
        </Alert>
      )}
      {resource.data && resource.data.length > 0 && (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(9rem,.36fr)_minmax(0,1fr)] gap-5 md:grid-cols-[15rem_1fr] md:grid-rows-1">
          <Card className="min-h-0 gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                资料目录
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 pb-4">
              <ScrollArea className="h-full pr-3">
                <div className="grid gap-1 py-1">
                  {resource.data.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeId === item.id ? 'default' : 'ghost'}
                      className="h-auto justify-start whitespace-normal text-left"
                      aria-current={activeId === item.id ? 'true' : undefined}
                      onClick={() => select(item.id)}
                    >
                      {item.title}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <Card className="min-h-0 gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="font-heading text-2xl">
                {active?.title || '请选择资料'}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 pb-4">
              <ScrollArea className="h-full pr-4">
                <div
                  key={activeId}
                  className="py-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
                >
                  {active ? (
                    <MarkupContent content={active.content} />
                  ) : (
                    <EmptyState title="暂无资料" />
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
