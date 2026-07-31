import { useCallback, useEffect, useRef, useState } from 'react'

import { signAssetUrl } from '@/services/data'

type AssetState = { src: string; loading: boolean; error: Error | null }

function sensitive(path: string) {
  return (
    path === 'images/private/meal-map.png' ||
    path.startsWith('hidden/') ||
    path.startsWith('images/quiz/')
  )
}

export function useSignedAsset(path: string, { refresh = true } = {}) {
  const [state, setState] = useState<AssetState>({ src: '', loading: Boolean(path), error: null })
  const revision = useRef(0)

  const load = useCallback(
    async (forceRefresh = false) => {
      const token = ++revision.current
      if (!path) {
        setState({ src: '', loading: false, error: null })
        return ''
      }
      setState((current) => ({ ...current, loading: !current.src, error: null }))
      try {
        const src = await signAssetUrl(path, { forceRefresh })
        if (revision.current === token)
          setState({ src, loading: false, error: src ? null : new Error('图片不可用') })
        return src
      } catch (reason) {
        const error = reason instanceof Error ? reason : new Error(String(reason))
        if (revision.current === token) setState({ src: '', loading: false, error })
        return ''
      }
    },
    [path],
  )

  useEffect(() => {
    void load()
    if (!path || !refresh) return () => undefined
    const interval = window.setInterval(() => void load(true), (sensitive(path) ? 180 : 600) * 800)
    const clear = () => setState({ src: '', loading: false, error: null })
    window.addEventListener('classrecordcacheclearing', clear)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('classrecordcacheclearing', clear)
      revision.current += 1
    }
  }, [load, path, refresh])

  return { ...state, retry: () => load(true) }
}
