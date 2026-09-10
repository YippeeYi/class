import { loadRecordPages } from '@/services/data'
import type { RecordPage } from '@/types/domain'

export type WrittenRecordData = {
  pages: RecordPage[]
}

export async function loadWrittenRecordData(): Promise<WrittenRecordData> {
  return { pages: (await loadRecordPages()).filter((page) => !page.hidden) }
}
