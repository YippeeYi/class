import { useEffect, useState } from 'react'

import {
  type ImageDimensions,
  parseImageDimensions,
  validImageDimensions,
} from '@/lib/image-metadata'
import { loadCached } from '@/services/cache'
import { DEFAULT_ASSET_PREVIEW_WIDTH, signAssetUrl } from '@/services/data'
import { createRequestQueue } from '@/services/request-queue'

const METADATA_RANGE_BYTES = 64 * 1024
const FRESH_TTL = 30 * 24 * 60 * 60 * 1000
const STALE_TTL = 90 * 24 * 60 * 60 * 1000
const dimensions = new Map<string, ImageDimensions>()
const inflight = new Map<string, Promise<ImageDimensions | null>>()
const listeners = new Map<string, Set<() => void>>()
const failures = new Map<string, number>()
let generation = 0
const FAILURE_RETRY_MS = 5 * 60 * 1000
const runMetadataRequest = createRequestQueue(4)

function notify(path: string) {
  listeners.get(path)?.forEach((listener) => {
    listener()
  })
}

export function rememberImageDimensions(path: string, value: ImageDimensions) {
  if (!path || !validImageDimensions(value)) return
  const current = dimensions.get(path)
  if (current?.width === value.width && current.height === value.height) return
  dimensions.set(path, value)
  failures.delete(path)
  notify(path)
}

export function getImageDimensions(path: string) {
  return dimensions.get(path) || null
}

function loadDimensionsWithImage(url: string) {
  return new Promise<ImageDimensions | null>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    const timer = setTimeout(() => {
      image.onload = image.onerror = null
      image.src = ''
      resolve(null)
    }, 6000)
    image.onload = () => {
      clearTimeout(timer)
      const value = { width: image.naturalWidth, height: image.naturalHeight }
      resolve(validImageDimensions(value) ? value : null)
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    image.src = url
  })
}

async function loadDimensionsFromNetwork(path: string, previewWidth: number) {
  const url = await signAssetUrl(path, { variant: 'preview', width: previewWidth })
  if (!url) throw new Error(`图片地址不可用：${path}`)
  let value: ImageDimensions | null = null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Range: `bytes=0-${METADATA_RANGE_BYTES - 1}` },
    })
    if (response.ok) {
      value = parseImageDimensions(
        new Uint8Array(await response.arrayBuffer()),
        response.headers.get('content-type') || '',
      )
    }
  } catch {
    // Full image decoding below is the compatibility fallback for servers without Range support.
  } finally {
    clearTimeout(timer)
  }
  value ||= await loadDimensionsWithImage(url)
  if (!value) throw new Error(`无法读取图片尺寸：${path}`)
  return value
}

export function preloadImageDimensions(path: string, previewWidth = DEFAULT_ASSET_PREVIEW_WIDTH) {
  const normalized = path.trim()
  if (!normalized) return Promise.resolve(null)
  const current = dimensions.get(normalized)
  if (current) return Promise.resolve(current)
  const failedAt = failures.get(normalized) || 0
  if (failedAt && Date.now() - failedAt < FAILURE_RETRY_MS) return Promise.resolve(null)
  failures.delete(normalized)
  const pending = inflight.get(normalized)
  if (pending) return pending
  const requestGeneration = generation
  const request = loadCached<ImageDimensions>({
    key: `image-dimensions:${normalized}`,
    business: false,
    persistent:
      !normalized.startsWith('hidden/') &&
      !normalized.startsWith('images/quiz/') &&
      !normalized.startsWith('images/record-pages/'),
    freshTtl: FRESH_TTL,
    staleTtl: STALE_TTL,
    sessionTtl: normalized.startsWith('data/attachments/') ? 24 * 60 * 60 * 1000 : 0,
    loader: () =>
      runMetadataRequest(() => {
        if (requestGeneration !== generation) throw new Error('访问范围已改变，请重新加载。')
        return loadDimensionsFromNetwork(normalized, previewWidth)
      }),
  })
    .then((value) => {
      if (requestGeneration !== generation) return null
      rememberImageDimensions(normalized, value)
      return value
    })
    .catch(() => {
      if (requestGeneration === generation) failures.set(normalized, Date.now())
      return null
    })
    .finally(() => {
      if (inflight.get(normalized) === request) inflight.delete(normalized)
    })
  inflight.set(normalized, request)
  return request
}

export function useImageDimensions(
  path: string,
  enabled = true,
  previewWidth = DEFAULT_ASSET_PREVIEW_WIDTH,
) {
  const [state, setState] = useState<{ path: string; value: ImageDimensions | null }>(() => ({
    path,
    value: getImageDimensions(path),
  }))
  useEffect(() => {
    const update = () => setState({ path, value: getImageDimensions(path) })
    update()
    if (!path || !enabled) return
    const pathListeners = listeners.get(path) || new Set<() => void>()
    pathListeners.add(update)
    listeners.set(path, pathListeners)
    void preloadImageDimensions(path, previewWidth)
    return () => {
      pathListeners.delete(update)
      if (!pathListeners.size) listeners.delete(path)
    }
  }, [enabled, path, previewWidth])
  return state.path === path ? state.value : getImageDimensions(path)
}

if (typeof window !== 'undefined') {
  window.addEventListener('classrecordcacheclearing', () => {
    generation += 1
    dimensions.clear()
    inflight.clear()
    failures.clear()
    listeners.forEach((pathListeners) => {
      pathListeners.forEach((listener) => {
        listener()
      })
    })
  })
}
