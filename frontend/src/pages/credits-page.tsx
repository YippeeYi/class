import { Heart, Paperclip, Users } from 'lucide-react'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { MarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsyncData } from '@/hooks/use-async-data'
import { loadCredits } from '@/services/data'

export function CreditsPage() {
  const resource = useAsyncData(() => loadCredits())
  const hasContent = Boolean(
    resource.data &&
      (resource.data.sections.length ||
        resource.data.thanks.length ||
        resource.data.originalImages.length),
  )
  return (
    <div>
      <PageHeading
        title={resource.data?.title || '制作组与致谢'}
        description="感谢所有记录、整理、校对与守护这份共同记忆的人。"
      />
      {resource.loading && <PageSkeleton rows={4} />}
      {resource.error && <ErrorState title="致谢内容加载失败" onRetry={resource.retry} />}
      {resource.data && !hasContent && (
        <EmptyState title="暂无可展示内容" description="制作组与致谢页面还没有可显示的资料。" />
      )}
      {resource.data && hasContent && (
        <div className="grid gap-4 md:grid-cols-2">
          {resource.data.sections.map((section) => (
            <Card key={section.id} className="bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  {section.title || '制作成员'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {section.members.map((member) => (
                    <li
                      key={`${section.id}-${member}`}
                      className="rounded-xl bg-muted/55 px-4 py-3"
                    >
                      <MarkupContent content={member} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {resource.data.thanks.length > 0 && (
            <Card className="bg-card/80 md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="size-4 text-primary" />
                  致谢
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {resource.data.thanks.map((item) => (
                  <MarkupContent key={item} content={item} />
                ))}
              </CardContent>
            </Card>
          )}
          {resource.data.originalImages.length > 0 && (
            <Card className="bg-card/80 md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="size-4 text-primary" />
                  附件
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {resource.data.originalImages.map((item) => (
                  <section key={item.id} className="rounded-xl border border-border/60 p-4">
                    <h3 className="mb-2 font-medium">{item.title}</h3>
                    <MarkupContent content={item.content} />
                  </section>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
