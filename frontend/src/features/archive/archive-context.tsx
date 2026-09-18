import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useDataVersion } from '@/hooks/use-data-version'
import { loadPeople, loadQuotes, loadRecords } from '@/services/data'
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
  const version = useDataVersion()
  const [requested, setRequested] = useState(false)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<ArchiveData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const ensure = useCallback(async () => {
    setRequested(true)
  }, [])
  const retry = useCallback(() => setRevision((value) => value + 1), [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: version invalidates business data; data itself must not restart its loader.
  useEffect(() => {
    if (!requested) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setLoading(!data)
    setError(null)
    const refresh = async () => {
      const failures: string[] = []
      const [recordsResult, peopleResult] = await Promise.allSettled([
        loadRecords({ force: revision > 0 }),
        loadPeople(revision > 0),
      ])
      const records = recordsResult.status === 'fulfilled' ? recordsResult.value : []
      const people = peopleResult.status === 'fulfilled' ? peopleResult.value : []
      if (recordsResult.status === 'rejected') failures.push('记录')
      if (peopleResult.status === 'rejected') failures.push('人物')
      if (!active) return
      let quotes: Quote[] = []
      if (recordsResult.status === 'fulfilled') {
        try {
          quotes = await loadQuotes(records)
        } catch {
          failures.push('名言')
        }
      }
      if (!active) return
      setData((current) => (failures.length && current ? current : { records, people, quotes }))
      setError(failures.length ? new Error(`以下档案数据加载失败：${failures.join('、')}`) : null)
      setLoading(false)
      if (failures.length) timer = setTimeout(() => void refresh(), 30_000)
    }
    void refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [requested, revision, version])

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
