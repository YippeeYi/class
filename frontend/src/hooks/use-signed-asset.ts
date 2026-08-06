import { useCallback, useEffect, useRef, useState } from 'react'

import { signAssetUrl } from '@/services/data'

type AssetState = { path: string; src: string; loading: boolean; error: Error | null }

export function useSignedAsset(path: string) {
  const [state, setState] = useState<AssetState>({
    path,
    src: '',
    loading: Boolean(path),
    error: null,
  })
  const revision = useRef(0)

  const load = useCallback(
    async (forceRefresh = false) => {
      const token = ++revision.current
      if (!path) {
        setState({ path: '', src: '', loading: false, error: null })
        return ''
      }
      setState((current) => {
        const src = current.path === path ? current.src : ''
        return { path, src, loading: !src, error: null }
      })
      try {
        const src = await signAssetUrl(path, { forceRefresh })
        if (revision.current === token)
          setState({ path, src, loading: false, error: src ? null : new Error('图片不可用') })
        return src
      } catch (reason) {
        const error = reason instanceof Error ? reason : new Error(String(reason))
        if (revision.current === token)
          setState((current) => ({
            path,
            src: forceRefresh && current.path === path ? current.src : '',
            loading: false,
            error,
          }))
        return ''
      }
    },
    [path],
  )

  useEffect(() => {
    void load()
    if (!path) return () => undefined
    const clear = () => setState({ path: '', src: '', loading: false, error: null })
    window.addEventListener('classrecordcacheclearing', clear)
    return () => {
      window.removeEventListener('classrecordcacheclearing', clear)
      revision.current += 1
    }
  }, [load, path])

  const current = state.path === path
  return {
    src: current ? state.src : '',
    loading: current ? state.loading : Boolean(path),
    error: current ? state.error : null,
    retry: () => load(true),
  }
}
