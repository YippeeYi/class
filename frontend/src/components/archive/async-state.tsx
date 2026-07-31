import { AlertCircle, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  const placeholders = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
  return (
    <div className="grid gap-4" role="status" aria-label="正在加载" aria-busy="true">
      {placeholders.slice(0, rows).map((key) => (
        <Skeleton className="h-28 w-full" key={key} />
      ))}
    </div>
  )
}

export function ErrorState({
  title = '内容加载失败',
  onRetry,
}: {
  title?: string
  onRetry?: () => void
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>请检查网络连接后重试。</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw data-icon="inline-start" />
            重试
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

export function EmptyState({
  title,
  description = '暂时没有可显示的内容。',
}: {
  title: string
  description?: string
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
