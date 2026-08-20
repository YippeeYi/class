import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'

import { formatDocumentTitle } from '@/lib/page-title'

type PersonTitleRegistration = {
  locationKey: string
  name: string
  token: symbol
}

type DocumentTitleContextValue = {
  registerPersonName: (name: string) => () => void
}

const DocumentTitleContext = createContext<DocumentTitleContextValue | null>(null)

export function DocumentTitleProvider({
  pathname,
  locationKey,
  children,
}: {
  pathname: string
  locationKey: string
  children: ReactNode
}) {
  const [registration, setRegistration] = useState<PersonTitleRegistration | null>(null)
  const registerPersonName = useCallback(
    (name: string) => {
      const token = Symbol(name)
      setRegistration({ locationKey, name, token })
      return () => setRegistration((current) => (current?.token === token ? null : current))
    },
    [locationKey],
  )
  const personName = registration?.locationKey === locationKey ? registration.name : ''

  useLayoutEffect(() => {
    document.title = formatDocumentTitle(pathname, personName)
  }, [pathname, personName])

  const value = useMemo(() => ({ registerPersonName }), [registerPersonName])
  return createElement(DocumentTitleContext.Provider, { value }, children)
}

export function usePersonDocumentTitle(name: string) {
  const context = useContext(DocumentTitleContext)
  useLayoutEffect(() => {
    const displayedName = name.trim()
    if (!context || !displayedName) return
    return context.registerPersonName(displayedName)
  }, [context, name])
}
