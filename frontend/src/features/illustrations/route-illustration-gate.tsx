import { type ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { Spinner } from '@/components/ui/spinner'
import { extractMarkupReferences } from '@/lib/markup'
import {
  loadCredits,
  loadMaterials,
  loadPeople,
  loadRecords,
  loadSupplementalRecords,
} from '@/services/data'
import { preloadImageDimensionList } from '@/services/image-metadata'

type MarkupSource = string | null | undefined

function illustrationPaths(sources: Iterable<MarkupSource>) {
  const paths = new Set<string>()
  for (const source of sources) {
    if (!source) continue
    for (const path of extractMarkupReferences(source).illustrationPaths) paths.add(path)
  }
  return paths
}

async function recordSources(includeSupplements = false) {
  const [records, supplements] = await Promise.all([
    loadRecords(),
    includeSupplements ? loadSupplementalRecords() : Promise.resolve([]),
  ])
  return [...records, ...supplements].map((record) => record.content)
}

export async function routeIllustrationSources(pathname: string) {
  if (pathname === '/' || pathname === '/quotes' || pathname === '/timeline') {
    return recordSources()
  }
  if (pathname === '/records' || pathname === '/quiz') {
    return recordSources(true)
  }
  if (pathname === '/people' || pathname === '/person') {
    const [records, people] = await Promise.all([
      recordSources(pathname === '/person'),
      loadPeople(),
    ])
    return [
      ...records,
      ...people.flatMap((person) => [person.name, person.alias, ...person.aliases, person.bio]),
    ]
  }
  if (pathname === '/materials') {
    const materials = await loadMaterials()
    return materials.flatMap((material) => [material.title, material.content])
  }
  if (pathname === '/search') {
    const [records, people, materials] = await Promise.all([
      recordSources(true),
      loadPeople(),
      loadMaterials(),
    ])
    return [
      ...records,
      ...people.flatMap((person) => [person.name, person.alias, ...person.aliases, person.bio]),
      ...materials.flatMap((material) => [material.title, material.content]),
    ]
  }
  if (pathname === '/credits') {
    const credits = await loadCredits()
    if (!credits) return []
    return [
      credits.title,
      ...credits.sections.flatMap((section) => [section.title, ...section.members]),
      ...credits.thanks,
      ...credits.originalImages.flatMap((image) => [image.title, image.content]),
    ]
  }
  return []
}

export function preloadMarkupIllustrationDimensions(sources: Iterable<MarkupSource>) {
  return preloadImageDimensionList(illustrationPaths(sources), 4)
}

export async function preloadRouteIllustrationDimensions(pathname: string) {
  const sources = await routeIllustrationSources(pathname)
  return preloadMarkupIllustrationDimensions(sources)
}

export function RouteIllustrationGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const routeKey = location.pathname
  const [settledKey, setSettledKey] = useState('')

  useEffect(() => {
    let active = true
    setSettledKey('')
    void preloadRouteIllustrationDimensions(location.pathname)
      .catch(() => ({ total: 0, loaded: 0, failed: 0 }))
      .then(() => {
        if (active) setSettledKey(routeKey)
      })
    return () => {
      active = false
    }
  }, [location.pathname, routeKey])

  if (settledKey !== routeKey) {
    return (
      <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <Spinner className="size-5" />
          正在准备页面插图…
        </div>
      </div>
    )
  }
  return children
}
