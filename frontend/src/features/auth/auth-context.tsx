import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ACCESS_KEY, LAST_VISIT_KEY, REDIRECT_KEY } from '@/features/auth/auth-storage'
import { clearDataCache } from '@/services/data'
import { clearSupabaseClients, getSupabase } from '@/services/supabase'

const IDLE_TTL = 90 * 24 * 60 * 60 * 1000
const ABSOLUTE_TTL = 365 * 24 * 60 * 60 * 1000

type AccessRecord = {
  type: 'invite'
  token: string
  authorizedAt: string
  lastServerValidatedAt: string
}

type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'error'

type AuthContextValue = {
  state: AuthState
  token: string
  verifyInvite: (code: string) => Promise<{ ok: boolean; message?: string }>
  clearAccess: () => void
  rememberTarget: (target: string) => void
  consumeTarget: () => string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readCandidate(): AccessRecord | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY)
    const lastVisitAt = Date.parse(localStorage.getItem(LAST_VISIT_KEY) || '')
    if (!raw || !Number.isFinite(lastVisitAt) || Date.now() - lastVisitAt > IDLE_TTL) return null
    const item = JSON.parse(raw) as AccessRecord
    const authorizedAt = Date.parse(item.authorizedAt || '')
    if (item.type !== 'invite' || !item.token || !Number.isFinite(authorizedAt)) return null
    if (Date.now() - authorizedAt > ABSOLUTE_TTL) return null
    return item
  } catch {
    return null
  }
}

function persistAccess(token: string, existing?: AccessRecord | null) {
  const now = new Date().toISOString()
  const item: AccessRecord = {
    type: 'invite',
    token,
    authorizedAt: existing?.token === token ? existing.authorizedAt : now,
    lastServerValidatedAt: now,
  }
  localStorage.setItem(ACCESS_KEY, JSON.stringify(item))
  localStorage.setItem(LAST_VISIT_KEY, now)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading')
  const [token, setToken] = useState('')

  const clearAccess = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(LAST_VISIT_KEY)
    sessionStorage.clear()
    clearSupabaseClients()
    clearDataCache()
    setToken('')
    setState('anonymous')
  }, [])

  useEffect(() => {
    let active = true
    const candidate = readCandidate()
    if (!candidate) {
      clearAccess()
      return
    }
    const validate = async () => {
      try {
        const { data, error } = await getSupabase(candidate.token).rpc('refresh_invite_access', {
          input_token: candidate.token,
        })
        if (!active) return
        if (error || data !== true) {
          clearAccess()
          return
        }
        persistAccess(candidate.token, candidate)
        setToken(candidate.token)
        setState('authenticated')
      } catch {
        if (active) setState('error')
      }
    }
    void validate()
    return () => {
      active = false
    }
  }, [clearAccess])

  const verifyInvite = useCallback(async (code: string) => {
    const value = code.trim()
    if (!value) return { ok: false, message: '请输入邀请码。' }
    try {
      const { data, error } = await getSupabase().rpc('verify_invite_code', { input_code: value })
      if (error) throw error
      const result = data as { ok?: boolean; accessToken?: string } | boolean | null
      if (result === true) return { ok: false, message: '服务器未返回访问凭证，请联系管理员。' }
      if (!result || typeof result !== 'object' || !result.ok || !result.accessToken) {
        return { ok: false, message: '邀请码无效或已不可使用，请检查后重试。' }
      }
      persistAccess(result.accessToken)
      clearSupabaseClients()
      setToken(result.accessToken)
      setState('authenticated')
      return { ok: true }
    } catch {
      return { ok: false, message: '邀请码验证请求失败，请稍后重试。' }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      token,
      verifyInvite,
      clearAccess,
      rememberTarget: (target) => sessionStorage.setItem(REDIRECT_KEY, target),
      consumeTarget: () => {
        const target = sessionStorage.getItem(REDIRECT_KEY) || '/'
        sessionStorage.removeItem(REDIRECT_KEY)
        return target
      },
    }),
    [clearAccess, state, token, verifyInvite],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
