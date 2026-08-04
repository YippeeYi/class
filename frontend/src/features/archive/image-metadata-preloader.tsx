import { useEffect } from 'react'

import { useArchiveSnapshot } from '@/features/archive/archive-context'
import { extractMarkupReferences } from '@/lib/markup'
import {
  loadCredits,
  loadMaterials,
  loadMealMapMetadata,
  loadPageMessages,
  loadPageSupplements,
  loadRecordPages,
} from '@/services/data'
import { preloadImageDimensionList, rememberImageDimensions } from '@/services/image-metadata'

const MAP_PATH = 'images/private/meal-map.png'

function collectIllustrations(value: unknown, paths: Set<string>, seen = new WeakSet<object>()) {
  if (typeof value === 'string') {
    extractMarkupReferences(value).illustrationPaths.forEach((path) => {
      paths.add(path)
    })
    return
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectIllustrations(item, paths, seen)
    })
    return
  }
  Object.values(value).forEach((item) => {
    collectIllustrations(item, paths, seen)
  })
}

export function ImageMetadataPreloader() {
  const archive = useArchiveSnapshot()

  useEffect(() => {
    if (!archive.data) return
    let active = true
    const run = async () => {
      const paths = new Set<string>()
      collectIllustrations(archive.data, paths)
      const [sources, mapMetadata] = await Promise.all([
        Promise.allSettled([
          loadMaterials(),
          loadPageMessages(),
          loadPageSupplements({ hidden: false }),
          loadCredits(),
          loadRecordPages(false),
        ]),
        loadMealMapMetadata().catch(() => null),
      ])
      if (!active) return
      for (const source of sources) {
        if (source.status !== 'fulfilled') continue
        collectIllustrations(source.value, paths)
        if (Array.isArray(source.value)) {
          source.value.forEach((item) => {
            if (
              item &&
              typeof item === 'object' &&
              'imagePath' in item &&
              typeof item.imagePath === 'string'
            ) {
              paths.add(item.imagePath)
            }
          })
        }
      }
      if (mapMetadata) rememberImageDimensions(MAP_PATH, mapMetadata)
      await preloadImageDimensionList(paths)
    }
    let timeoutId: number | undefined
    let idleId: number | undefined
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => void run(), { timeout: 2500 })
    } else {
      timeoutId = setTimeout(() => void run(), 900)
    }
    return () => {
      active = false
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      if (idleId !== undefined) window.cancelIdleCallback(idleId)
    }
  }, [archive.data])

  return null
}
