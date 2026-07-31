import { type DependencyList, useCallback, useEffect, useState } from 'react'

type AsyncState<T> = { data: T | null; error: Error | null; loading: boolean }

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: DependencyList = []) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true })

  // biome-ignore lint/correctness/useExhaustiveDependencies: callers explicitly define the resource identity; including an inline loader would refetch every render.
  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, error: null, loading: true }))
    loader()
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (active)
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          })
      })
    return () => {
      active = false
    }
  }, [...dependencies, revision])

  const retry = useCallback(() => setRevision((value) => value + 1), [])
  return { ...state, retry }
}
