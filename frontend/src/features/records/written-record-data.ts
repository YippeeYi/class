import { loadPageMessages, loadPageSupplements, loadRecordPages } from '@/services/data'
import type { PageMessage, PageSupplement, RecordPage } from '@/types/domain'

export type WrittenAuxiliarySection = 'messages' | 'supplements'

export type WrittenRecordData = {
  pages: RecordPage[]
  messages: PageMessage[]
  supplements: PageSupplement[]
  failures: WrittenAuxiliarySection[]
}

export async function loadWrittenRecordData(hidden: boolean): Promise<WrittenRecordData> {
  const [pagesResult, messagesResult, supplementsResult] = await Promise.allSettled([
    loadRecordPages(hidden),
    hidden ? Promise.resolve<PageMessage[]>([]) : loadPageMessages(),
    loadPageSupplements({ hidden }),
  ])

  if (pagesResult.status === 'rejected') throw pagesResult.reason

  const failures: WrittenAuxiliarySection[] = []
  if (messagesResult.status === 'rejected') failures.push('messages')
  if (supplementsResult.status === 'rejected') failures.push('supplements')

  return {
    pages: pagesResult.value,
    messages: messagesResult.status === 'fulfilled' ? messagesResult.value : [],
    supplements: supplementsResult.status === 'fulfilled' ? supplementsResult.value : [],
    failures,
  }
}

export function writtenFailureLabel(section: WrittenAuxiliarySection) {
  return section === 'messages' ? '页箴言' : '页补录'
}
