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
      try {
        const [records, people] = await Promise.all([loadRecords(), loadPeople()])
        const quotes = await loadQuotes(records)
        setData({ records, people, quotes })
      } catch (reason) {
        setError(reason instanceof Error ? reason : new Error(String(reason)))
      } finally {
        setLoading(false)
        request.current = null
      }
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
  const archive = use(ArchiveContext)
  if (!archive) throw new Error('useArchive must be used inside ArchiveProvider')
  useEffect(() => {
    void archive.ensure()
  }, [archive.ensure])
  return archive
}
