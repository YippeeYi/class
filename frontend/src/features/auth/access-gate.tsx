import { type ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'

export function AccessGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const target = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    if (auth.state === 'anonymous' || auth.state === 'error') auth.rememberTarget(target)
  }, [auth, target])

  if (auth.state === 'loading')
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner className="size-5" />
          正在验证访问权限…
        </div>
      </div>
    )
  if (auth.state !== 'authenticated') return <Navigate to="/auth" replace />
  return children
}
