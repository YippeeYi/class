import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { clearDataCache, loadPeople, loadQuotes, loadRecords } from '@/services/data'
import type { Person, Quote, RecordItem } from '@/types/domain'

type ArchiveData = { records: RecordItem[]; people: Person[]; quotes: Quote[] }
type ArchiveContextValue = {
  data: ArchiveData | null
  loading: boolean
  error: Error | null
  ensure: () => Promise<void>
  retry: () => void
}

const ArchiveContext = createContext<ArchiveContextValue | null>(null)

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ArchiveData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const request = useRef<Promise<void> | null>(null)

  const ensure = useCallback(async () => {
    if (data || request.current) return request.current || Promise.resolve()
    setLoading(true)
    setError(null)
    request.current = (async () => {
      const failures: string[] = []
      const [recordsResult, peopleResult] = await Promise.allSettled([loadRecords(), loadPeople()])
      const records = recordsResult.status === 'fulfilled' ? recordsResult.value : []
      const people = peopleResult.status === 'fulfilled' ? peopleResult.value : []
      if (recordsResult.status === 'rejected') failures.push('记录')
      if (peopleResult.status === 'rejected') failures.push('人物')

      let quotes: Quote[] = []
      if (recordsResult.status === 'fulfilled') {
        try {
          quotes = await loadQuotes(records)
        } catch {
          failures.push('名言')
        }
      }

      setData({ records, people, quotes })
      if (failures.length)
        setError(new Error(`以下档案数据加载失败：${[...new Set(failures)].join('、')}`))
      setLoading(false)
      request.current = null
    })()
    return request.current
  }, [data])

  const retry = useCallback(() => {
    clearDataCache()
    setData(null)
    setError(null)
  }, [])

  const value = useMemo(
    () => ({ data, loading, error, ensure, retry }),
    [data, ensure, error, loading, retry],
  )
  return <ArchiveContext value={value}>{children}</ArchiveContext>
}

export function useArchive() {
  const archive = useArchiveSnapshot()
  useEffect(() => {
    void archive.ensure()
  }, [archive.ensure])
  return archive
}

export function useArchiveSnapshot() {
  const archive = use(ArchiveContext)
  if (!archive) throw new Error('useArchiveSnapshot must be used inside ArchiveProvider')
  return archive
}
