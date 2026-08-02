import { Home } from 'lucide-react'
import { useEffect } from 'react'
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
import { useAuth } from '@/features/auth/auth-context'

export function NotFoundPage() {
  const auth = useAuth()
  const authenticated = auth.state === 'authenticated'
  useEffect(() => {
    document.title = '404 · 编日史'
  }, [])
  return (
    <main className="grid min-h-svh place-items-center px-4 py-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">404</EmptyMedia>
          <EmptyTitle className="font-heading text-2xl">这一页不在档案里</EmptyTitle>
          <EmptyDescription>页面不存在，或者该资源不允许直接访问。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to={authenticated ? '/' : '/auth'} className={buttonVariants()}>
            <Home data-icon="inline-start" />
            {authenticated ? '返回导览' : '返回邀请码验证'}
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  )
}
