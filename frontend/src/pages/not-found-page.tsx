import { Home } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[65vh] place-items-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">404</EmptyMedia>
          <EmptyTitle className="font-heading text-2xl">这一页不在档案里</EmptyTitle>
          <EmptyDescription>地址可能已经改变，或者从来没有被记录。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/" className={buttonVariants()}>
            <Home data-icon="inline-start" />
            返回导览
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}
