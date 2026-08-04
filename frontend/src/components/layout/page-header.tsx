import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export const PAGE_HEADER_ACTIONS_ID = 'page-header-actions'

type PageHeaderContextValue = {
  registerTitle: (title: string) => () => void
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null)

export function PageHeaderProvider({
  children,
  registerTitle,
}: {
  children: ReactNode
  registerTitle: PageHeaderContextValue['registerTitle']
}) {
  const value = useMemo(() => ({ registerTitle }), [registerTitle])
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

export function usePageHeaderTitle(title: string) {
  const context = useContext(PageHeaderContext)
  useLayoutEffect(() => context?.registerTitle(title), [context, title])
}

export function PageHeaderActions({
  children,
  mobileClassName,
}: {
  children: ReactNode
  mobileClassName?: string
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [desktop, setDesktop] = useState(false)

  useLayoutEffect(() => {
    const media = window.matchMedia('(min-width: 640px)')
    const update = () => setDesktop(media.matches)
    setTarget(document.getElementById(PAGE_HEADER_ACTIONS_ID))
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  if (desktop) return target ? createPortal(children, target) : null
  return <div className={mobileClassName}>{children}</div>
}
