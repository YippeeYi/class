import { KeyRound } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

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

  useEffect(() => {
    document.title = '邀请码 · 编日史'
  }, [])

  if (auth.state === 'authenticated') return <Navigate to={auth.consumeTarget()} replace />

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
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="invite-code">邀请码</FieldLabel>
                <Input
                  id="invite-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="CR-ABCD-EFGH-2345"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'invite-code-error' : undefined}
                />
                <FieldDescription>
                  邀请码仅在验证时发送到 Supabase，不会写入页面源码。
                </FieldDescription>
                <FieldError id="invite-code-error">{error}</FieldError>
              </Field>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || auth.state === 'loading'}
              >
                {submitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    正在验证
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
