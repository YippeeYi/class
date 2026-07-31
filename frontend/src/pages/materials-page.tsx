import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAsyncData } from '@/hooks/use-async-data'
import { loadMaterials } from '@/services/data'

export function MaterialsPage() {
  const [params, setParams] = useSearchParams()
  const [activeId, setActiveId] = useState(params.get('id') || '')
  const resource = useAsyncData(() => loadMaterials())
  useEffect(() => {
    document.title = '资料 · 编日史'
  }, [])
  useEffect(() => {
    if (resource.data?.length && !resource.data.some((item) => item.id === activeId))
      setActiveId(resource.data[0]?.id || '')
  }, [activeId, resource.data])
  const active = resource.data?.find((item) => item.id === activeId)
  const select = (id: string) => {
    setActiveId(id)
    setParams(id ? { id } : {}, { replace: true })
  }
  return (
    <div>
      <PageHeading title="资料" description="班级档案的补充材料与专题内容。" />
      {resource.loading && <PageSkeleton rows={4} />}
      {resource.error && <ErrorState title="资料加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <div className="grid gap-5 md:grid-cols-[15rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                资料目录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[65vh]">
                <div className="grid gap-1">
                  {resource.data.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeId === item.id ? 'default' : 'ghost'}
                      className="h-auto justify-start whitespace-normal text-left"
                      onClick={() => select(item.id)}
                    >
                      {item.title}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <Card className="min-h-80">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">
                {active?.title || '请选择资料'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {active ? (
                <MarkupContent content={active.content} />
              ) : (
                <EmptyState title="暂无资料" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
