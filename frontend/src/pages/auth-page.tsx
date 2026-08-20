import { KeyRound } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'

export function AuthPage() {
  const auth = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null)
  const redirectCaptured = useRef(false)
  const displayedError =
    error ||
    (auth.state === 'error'
      ? '无法确认本机已有的访问凭证。你可以检查网络，或输入新的邀请码重试。'
      : '')
  const pending = submitting || auth.state === 'loading'

  useEffect(() => {
    if (auth.state !== 'authenticated' || redirectCaptured.current) return
    redirectCaptured.current = true
    setRedirectTarget(auth.consumeTarget())
  }, [auth])

  if (auth.state === 'authenticated') {
    if (redirectTarget) return <Navigate to={redirectTarget} replace />
    return (
      <div
        className="grid min-h-svh place-items-center text-sm text-muted-foreground"
        role="status"
      >
        <span className="flex items-center gap-3">
          <Spinner className="size-5" />
          正在返回原页面…
        </span>
      </div>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const result = await auth.verifyInvite(code)
    setSubmitting(false)
    if (!result.ok) setError(result.message || '验证失败。')
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="font-heading text-2xl">进入编日史</CardTitle>
          <CardDescription>
            请输入一次性邀请码。验证成功后，本浏览器获得 90 天滑动访问权限。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field data-invalid={Boolean(displayedError)}>
                <FieldLabel htmlFor="invite-code">邀请码</FieldLabel>
                <Input
                  id="invite-code"
                  className="h-11"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="CR-ABCD-EFGH-2345"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  disabled={pending}
                  aria-invalid={Boolean(displayedError)}
                  aria-describedby={displayedError ? 'invite-code-error' : undefined}
                />
                <FieldDescription>
                  邀请码仅在验证时发送到 Supabase，不会写入页面源码。
                </FieldDescription>
                <FieldError id="invite-code-error">{displayedError}</FieldError>
              </Field>
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full"
                disabled={pending}
                aria-busy={pending || undefined}
              >
                {pending ? (
                  <>
                    <Spinner />
                    正在验证…
                  </>
                ) : (
                  '进入档案'
                )}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
