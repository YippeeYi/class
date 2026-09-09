import { Archive, ArrowLeft, Home } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  return (
    <main className="grid min-h-svh place-items-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-xl overflow-hidden border-border/70 bg-card/92 py-0 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <Empty className="gap-5 border-0 p-0 md:p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-xl bg-primary/10 text-primary">
                <Archive className="size-5" />
              </EmptyMedia>
              <Badge variant="outline" className="mx-auto bg-background/55">
                404 · 档案未收录
              </Badge>
              <EmptyTitle className="font-heading text-xl sm:text-2xl">这一页不存在</EmptyTitle>
              <EmptyDescription className="max-w-md leading-6">
                你访问的地址可能已失效，或从未被收录进编日史。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="w-full sm:w-auto">
              <Link
                to={authenticated ? '/' : '/auth'}
                className={buttonVariants({ className: 'min-h-11 w-full sm:w-auto' })}
              >
                {authenticated ? (
                  <Home data-icon="inline-start" />
                ) : (
                  <ArrowLeft data-icon="inline-start" />
                )}
                {authenticated ? '返回主页' : '返回邀请码验证'}
              </Link>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </main>
  )
}
