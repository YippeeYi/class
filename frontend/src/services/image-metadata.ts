import { useEffect, useState } from 'react'

import {
  type ImageDimensions,
  parseImageDimensions,
  validImageDimensions,
} from '@/lib/image-metadata'
import { loadCached } from '@/services/cache'
import { signAssetUrl } from '@/services/data'

const METADATA_RANGE_BYTES = 64 * 1024
const FRESH_TTL = 30 * 24 * 60 * 60 * 1000
const STALE_TTL = 90 * 24 * 60 * 60 * 1000
const dimensions = new Map<string, ImageDimensions>()
const inflight = new Map<string, Promise<ImageDimensions | null>>()
const listeners = new Map<string, Set<() => void>>()
let generation = 0

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
  notify(path)
}

export function getImageDimensions(path: string) {
  return dimensions.get(path) || null
}

function loadDimensionsWithImage(url: string) {
  return new Promise<ImageDimensions | null>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      const value = { width: image.naturalWidth, height: image.naturalHeight }
      resolve(validImageDimensions(value) ? value : null)
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

async function loadDimensionsFromNetwork(path: string) {
  const url = await signAssetUrl(path)
  if (!url) throw new Error(`图片地址不可用：${path}`)
  let value: ImageDimensions | null = null
  try {
    const response = await fetch(url, {
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
  }
  value ||= await loadDimensionsWithImage(url)
  if (!value) throw new Error(`无法读取图片尺寸：${path}`)
  return value
}

export function preloadImageDimensions(path: string) {
  const normalized = path.trim()
  if (!normalized) return Promise.resolve(null)
  const current = dimensions.get(normalized)
  if (current) return Promise.resolve(current)
  const pending = inflight.get(normalized)
  if (pending) return pending
  const requestGeneration = generation
  const request = loadCached<ImageDimensions>({
    key: `image-dimensions:${normalized}`,
    freshTtl: FRESH_TTL,
    staleTtl: STALE_TTL,
    sessionTtl: 24 * 60 * 60 * 1000,
    loader: () => loadDimensionsFromNetwork(normalized),
  })
    .then((value) => {
      if (requestGeneration !== generation) return null
      rememberImageDimensions(normalized, value)
      return value
    })
    .catch(() => null)
    .finally(() => inflight.delete(normalized))
  inflight.set(normalized, request)
  return request
}

export async function preloadImageDimensionList(paths: Iterable<string>, concurrency = 4) {
  const queue = [...new Set(paths)].filter(Boolean)
  let cursor = 0
  const worker = async () => {
    while (cursor < queue.length) {
      const path = queue[cursor]
      cursor += 1
      if (path) await preloadImageDimensions(path)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
}

export function useImageDimensions(path: string) {
  const [value, setValue] = useState<ImageDimensions | null>(() => getImageDimensions(path))
  useEffect(() => {
    setValue(getImageDimensions(path))
    if (!path) return
    const pathListeners = listeners.get(path) || new Set<() => void>()
    const update = () => setValue(getImageDimensions(path))
    pathListeners.add(update)
    listeners.set(path, pathListeners)
    void preloadImageDimensions(path)
    return () => {
      pathListeners.delete(update)
      if (!pathListeners.size) listeners.delete(path)
    }
  }, [path])
  return value
}

if (typeof window !== 'undefined') {
  window.addEventListener('classrecordcacheclearing', () => {
    generation += 1
    dimensions.clear()
    inflight.clear()
    listeners.forEach((pathListeners) => {
      pathListeners.forEach((listener) => {
        listener()
      })
    })
  })
}
