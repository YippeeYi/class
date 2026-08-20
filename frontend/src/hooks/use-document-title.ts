import { useEffect } from 'react'

import { formatRouteDocumentTitle } from '@/lib/page-title'

export function useRouteDocumentTitle(pathname: string) {
  useEffect(() => {
    document.title = formatRouteDocumentTitle(pathname)
  }, [pathname])
}
