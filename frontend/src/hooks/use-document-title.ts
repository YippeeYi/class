import { useEffect } from 'react'

export const SITE_TITLE = '编日史'

export function formatDocumentTitle(pageTitle?: string) {
  const page = String(pageTitle || '').trim()
  return page ? `${page} · ${SITE_TITLE}` : SITE_TITLE
}

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = formatDocumentTitle(pageTitle)
  }, [pageTitle])
}
