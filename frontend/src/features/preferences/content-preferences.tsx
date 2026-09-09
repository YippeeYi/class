import { createContext, type ReactNode, use, useCallback, useMemo, useState } from 'react'
import { filterProfanity } from '@/lib/profanity'

export const CONTENT_PREFERENCES_KEY = 'classRecord:contentPreferences:v1'

export type ContentPreferences = {
  hideProfanity: boolean
}

const DEFAULT_PREFERENCES: ContentPreferences = { hideProfanity: true }
let volatilePreferences: ContentPreferences | null = null

function readStoredPreferences(): ContentPreferences {
  if (volatilePreferences) return volatilePreferences
  try {
    const stored = JSON.parse(
      localStorage.getItem(CONTENT_PREFERENCES_KEY) || 'null',
    ) as Partial<ContentPreferences> | null
    return {
      hideProfanity:
        typeof stored?.hideProfanity === 'boolean'
          ? stored.hideProfanity
          : DEFAULT_PREFERENCES.hideProfanity,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

type ContentPreferenceContextValue = ContentPreferences & {
  setHideProfanity: (value: boolean) => void
}

const ContentPreferenceContext = createContext<ContentPreferenceContextValue | null>(null)

export function ContentPreferenceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readStoredPreferences)
  const setHideProfanity = useCallback((hideProfanity: boolean) => {
    const next = { hideProfanity }
    volatilePreferences = next
    setPreferences(next)
    try {
      localStorage.setItem(CONTENT_PREFERENCES_KEY, JSON.stringify(next))
    } catch {
      // The setting still remains active for the current session.
    }
  }, [])
  const value = useMemo(
    () => ({ ...preferences, setHideProfanity }),
    [preferences, setHideProfanity],
  )
  return <ContentPreferenceContext value={value}>{children}</ContentPreferenceContext>
}

export function useContentPreferences() {
  const value = use(ContentPreferenceContext)
  if (!value) throw new Error('useContentPreferences must be used inside ContentPreferenceProvider')
  return value
}

export function useFilteredText(value: string) {
  const { hideProfanity } = useContentPreferences()
  return filterProfanity(value, hideProfanity)
}
