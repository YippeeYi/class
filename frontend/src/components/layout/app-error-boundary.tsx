import { AlertTriangle, House, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

const LAST_ERROR_KEY = 'classRecord:lastError:v1'
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i

type AppDiagnostic = {
  id: string
  kind: 'chunk-load' | 'render'
  mode: string
  path: string
  timestamp: string
}

type AppErrorBoundaryState = {
  diagnostic: AppDiagnostic | null
}

function createDiagnostic(error: unknown): AppDiagnostic {
  const message = error instanceof Error ? error.message : String(error)
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now().toString(36)
  return {
    id: `CR-${suffix}`,
    kind: CHUNK_ERROR_PATTERN.test(message) ? 'chunk-load' : 'render',
    mode: import.meta.env.MODE,
    path: window.location.pathname,
    timestamp: new Date().toISOString(),
  }
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { diagnostic: null }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { diagnostic: createDiagnostic(error) }
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    const diagnostic = this.state.diagnostic
    if (!diagnostic) return
    try {
      window.sessionStorage.setItem(LAST_ERROR_KEY, JSON.stringify(diagnostic))
    } catch {
      // Diagnostics must never prevent the recovery screen from rendering.
    }
    console.error('[class-record] application error', diagnostic, {
      componentStack: info.componentStack,
    })
  }

  render() {
    const { diagnostic } = this.state
    if (!diagnostic) return this.props.children

    const chunkFailure = diagnostic.kind === 'chunk-load'
    return (
      <main className="grid min-h-svh place-items-center px-4 py-12">
        <section
          className="w-full max-w-lg rounded-(--radius-panel) border bg-card/92 p-6 text-card-foreground shadow-sm sm:p-8"
          aria-labelledby="app-error-title"
        >
          <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden="true" />
          </div>
          <h1 id="app-error-title" className="text-2xl font-semibold tracking-tight">
            {chunkFailure ? '页面资源未能加载' : '页面发生意外错误'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {chunkFailure
              ? '网络波动或刚完成的版本更新可能使旧资源失效，重新加载通常可以恢复。'
              : '当前页面已安全停止，档案内容和访问凭证不会被修改。请重新加载后再试。'}
          </p>
          <p className="mt-4 font-mono text-xs text-muted-foreground">诊断编号：{diagnostic.id}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()}>
              <RotateCcw data-icon="inline-start" />
              重新加载
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign(import.meta.env.BASE_URL)}
            >
              <House data-icon="inline-start" />
              返回导览
            </Button>
          </div>
        </section>
      </main>
    )
  }
}
