import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react'
import { useDataVersion } from '@/hooks/use-data-version'

type AsyncState<T> = { data: T | null; error: Error | null; loading: boolean; refreshing: boolean }

export function useAsyncData<T>(
  loader: () => Promise<T>,
  dependencies: DependencyList = [],
  { business = true }: { business?: boolean } = {},
) {
  const version = useDataVersion(business)
  const [revision, setRevision] = useState(0)
  const identity = useRef<DependencyList>(dependencies)
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: callers explicitly define resource identity; an inline loader must not trigger requests on every render.
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const changed =
      identity.current.length !== dependencies.length ||
      dependencies.some((value, index) => !Object.is(value, identity.current[index]))
    identity.current = dependencies
    setState((current) => ({
      data: changed ? null : current.data,
      error: null,
      loading: changed || current.data === null,
      refreshing: true,
    }))
    const refresh = () => {
      Promise.resolve()
        .then(loader)
        .then((data) => {
          if (active) setState({ data, error: null, loading: false, refreshing: false })
        })
        .catch((error: unknown) => {
          if (!active) return
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
            refreshing: false,
          }))
          // A failed refresh must not leave an open client permanently on old data.
          if (business) timer = setTimeout(refresh, 30_000)
        })
    }
    refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [...dependencies, revision, version])

  const retry = useCallback(() => setRevision((value) => value + 1), [])
  return { ...state, retry }
}
