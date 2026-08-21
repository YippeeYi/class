import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type AssetVariant,
  DEFAULT_ASSET_PREVIEW_QUALITY,
  DEFAULT_ASSET_PREVIEW_WIDTH,
  getCachedAssetUrl,
  signAssetUrl,
} from '@/services/data'

type AssetState = { key: string; src: string; loading: boolean; error: Error | null }

export function useSignedAsset(
  path: string,
  {
    variant = 'original',
    width = DEFAULT_ASSET_PREVIEW_WIDTH,
    quality = DEFAULT_ASSET_PREVIEW_QUALITY,
  }: { variant?: AssetVariant; width?: number; quality?: number } = {},
) {
  const assetKey = path ? `${path}\u0000${variant}\u0000${width}\u0000${quality}` : ''
  const readCached = useCallback(
    () => getCachedAssetUrl(path, { variant, width, quality }),
    [path, quality, variant, width],
  )
  const [state, setState] = useState<AssetState>(() => {
    const src = readCached()
    return { key: assetKey, src, loading: Boolean(path && !src), error: null }
  })
  const revision = useRef(0)

  const load = useCallback(
    async (forceRefresh = false) => {
      const token = ++revision.current
      if (!path) {
        setState({ key: '', src: '', loading: false, error: null })
        return ''
      }
      setState((current) => {
        const src =
          (current.key === assetKey ? current.src : '') || (!forceRefresh ? readCached() : '')
        return { key: assetKey, src, loading: !src, error: null }
      })
      try {
        const src = await signAssetUrl(path, { forceRefresh, variant, width, quality })
        if (revision.current === token)
          setState({
            key: assetKey,
            src,
            loading: false,
            error: src ? null : new Error('图片不可用'),
          })
        return src
      } catch (reason) {
        const error = reason instanceof Error ? reason : new Error(String(reason))
        if (revision.current === token)
          setState((current) => ({
            key: assetKey,
            src: forceRefresh && current.key === assetKey ? current.src : '',
            loading: false,
            error,
          }))
        return ''
      }
    },
    [assetKey, path, quality, readCached, variant, width],
  )

  useEffect(() => {
    void load()
    if (!path) return () => undefined
    const clear = () => setState({ key: '', src: '', loading: false, error: null })
    window.addEventListener('classrecordcacheclearing', clear)
    return () => {
      window.removeEventListener('classrecordcacheclearing', clear)
      revision.current += 1
    }
  }, [load, path])

  const current = state.key === assetKey
  const cachedSrc = current ? '' : readCached()
  return {
    src: current ? state.src : cachedSrc,
    loading: current ? state.loading : Boolean(path && !cachedSrc),
    error: current ? state.error : null,
    retry: () => load(true),
  }
}
