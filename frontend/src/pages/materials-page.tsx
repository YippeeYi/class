import { FileText } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAsyncData } from '@/hooks/use-async-data'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { loadMaterials } from '@/services/data'

export function MaterialsPage() {
  const [params, setParams] = useSearchParams()
  const resource = useAsyncData(() => loadMaterials())
  useDocumentTitle('资料')
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
      <PageHeading
        eyebrow={null}
        title="资料"
        description="班级档案的补充材料与专题内容。目录和正文可分别滚动。"
        className="shrink-0"
        compact
      />
      {resource.loading && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <PageSkeleton rows={4} />
        </div>
      )}
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
        <Card
          role="region"
          className="content-frame grid min-h-0 flex-1 grid-rows-[minmax(8rem,.3fr)_minmax(0,1fr)] gap-0 py-0 md:grid-cols-[minmax(14rem,22%)_minmax(0,1fr)] md:grid-rows-1"
          aria-label="资料阅读区"
        >
          <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border/70 md:border-b-0 md:border-r">
            <div className="flex shrink-0 items-center gap-2 px-4 py-3 font-heading text-sm font-semibold">
              <FileText className="size-4" />
              资料目录
            </div>
            <ScrollArea className="min-h-0 flex-1 border-t border-border/60">
              <nav className="grid gap-1 p-2 pr-4" aria-label="资料目录">
                {resource.data.map((item) => (
                  <Button
                    key={item.id}
                    variant={activeId === item.id ? 'secondary' : 'ghost'}
                    className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left leading-6 data-[active=true]:font-semibold data-[active=true]:text-foreground"
                    data-active={activeId === item.id}
                    aria-current={activeId === item.id ? 'true' : undefined}
                    onClick={() => select(item.id)}
                  >
                    {item.title}
                  </Button>
                ))}
              </nav>
            </ScrollArea>
          </aside>
          <article className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <header className="shrink-0 border-b border-border/70 px-5 py-3 sm:px-7">
              <h2 className="font-heading text-section-title font-semibold tracking-tight">
                {active?.title || '请选择资料'}
              </h2>
            </header>
            <ScrollArea className="min-h-0 flex-1">
              <div
                key={activeId}
                className="material-reading mx-auto w-full max-w-[68rem] px-5 py-5 pr-7 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-slow) sm:px-7 sm:py-7 sm:pr-9 lg:px-8 lg:py-8 lg:pr-10"
              >
                {active ? (
                  <MarkupContent content={active.content} />
                ) : (
                  <EmptyState title="暂无资料" />
                )}
              </div>
            </ScrollArea>
          </article>
        </Card>
      )}
    </div>
  )
}
