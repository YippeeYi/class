import { useLayoutEffect } from 'react'

import { formatRouteDocumentTitle } from '@/lib/page-title'

export function useRouteDocumentTitle(pathname: string) {
  useLayoutEffect(() => {
    document.title = formatRouteDocumentTitle(pathname)
  }, [pathname])
}
