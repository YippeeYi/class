import { useEffect, useState } from 'react'

import {
  type ImageDimensions,
  parseImageDimensions,
  validImageDimensions,
} from '@/lib/image-metadata'
import { extractMarkupMedia } from '@/lib/markup'
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
const manifestFailures = new Map<string, number>()
let generation = 0
const FAILURE_RETRY_MS = 5 * 60 * 1000
const runMetadataRequest = createRequestQueue(4)
const manifestPaths = {
  public: 'data/attachments/record-media-dimensions.txt',
  hidden: 'hidden/data/attachments/record-media-dimensions.txt',
}
const manifestMediaPrefixes = {
  public: ['data/attachments/', 'images/record-pages/'],
  hidden: ['hidden/data/attachments/', 'hidden/images/record-pages/'],
}

function isVideo(path: string) {
  return /\.(?:mp4|webm|ogg)$/i.test(path)
}

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

function loadDimensionsWithVideo(url: string) {
  return new Promise<ImageDimensions | null>((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    let settled = false
    const finish = (value: ImageDimensions | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 6000)
    video.onloadedmetadata = () => {
      const value = { width: video.videoWidth, height: video.videoHeight }
      finish(validImageDimensions(value) ? value : null)
    }
    video.onerror = () => finish(null)
    video.src = url
  })
}

async function loadDimensionsFromNetwork(path: string, previewWidth: number) {
  if (isVideo(path)) {
    const url = await signAssetUrl(path)
    if (!url) throw new Error(`视频地址不可用：${path}`)
    const value = await loadDimensionsWithVideo(url)
    if (!value) throw new Error(`无法读取视频尺寸：${path}`)
    return value
  }
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
    key: `${isVideo(normalized) ? 'video' : 'image'}-dimensions:${normalized}`,
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

export async function preloadMediaManifest(hidden = false) {
  const scope = hidden ? 'hidden' : 'public'
  const failedAt = manifestFailures.get(scope) || 0
  if (failedAt && Date.now() - failedAt < FAILURE_RETRY_MS) return false
  const requestGeneration = generation
  try {
    const entries = await loadCached<Record<string, ImageDimensions>>({
      key: `record-media-manifest:${scope}`,
      persistent: !hidden,
      sessionTtl: hidden ? 0 : 24 * 60 * 60 * 1000,
      loader: async () => {
        const url = await signAssetUrl(manifestPaths[scope])
        if (!url) throw new Error('媒体尺寸索引不可用')
        const response = await fetch(url)
        if (!response.ok) throw new Error('媒体尺寸索引读取失败')
        const result: unknown = await response.json()
        if (
          !result ||
          typeof result !== 'object' ||
          !('version' in result) ||
          result.version !== 1 ||
          !('dimensions' in result)
        )
          throw new Error('媒体尺寸索引格式无效')
        const values = result.dimensions
        if (!values || typeof values !== 'object' || Array.isArray(values))
          throw new Error('媒体尺寸索引内容无效')
        return Object.fromEntries(
          Object.entries(values).flatMap(([path, size]) => {
            if (!manifestMediaPrefixes[scope].some((prefix) => path.startsWith(prefix))) return []
            if (!Array.isArray(size) || !validImageDimensions({ width: size[0], height: size[1] }))
              return []
            return [[path, { width: size[0], height: size[1] }]]
          }),
        )
      },
    })
    if (requestGeneration !== generation) return false
    for (const [path, size] of Object.entries(entries)) rememberImageDimensions(path, size)
    manifestFailures.delete(scope)
    return true
  } catch {
    manifestFailures.set(scope, Date.now())
    return false
  }
}

export async function preloadRecordMediaDimensions(contents: string[], hidden = false) {
  const paths = new Set(
    contents.flatMap((content) => extractMarkupMedia(content).map((node) => node.src)),
  )
  if (!paths.size) return
  const requestGeneration = generation
  await preloadMediaManifest(hidden)
  if (requestGeneration !== generation) return
  await Promise.all(
    [...paths]
      .filter((path) => !getImageDimensions(path))
      .map((path) => preloadImageDimensions(path, 720)),
  )
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
    if (!path) return
    const pathListeners = listeners.get(path) || new Set<() => void>()
    pathListeners.add(update)
    listeners.set(path, pathListeners)
    if (enabled)
      void (async () => {
        if (/^(?:hidden\/)?(?:data\/attachments\/|images\/record-pages\/)/.test(path))
          await preloadMediaManifest(path.startsWith('hidden/'))
        if (!getImageDimensions(path)) await preloadImageDimensions(path, previewWidth)
      })()
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
    manifestFailures.clear()
    listeners.forEach((pathListeners) => {
      pathListeners.forEach((listener) => {
        listener()
      })
    })
  })
}
