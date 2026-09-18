import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { startDataUpdates } from '@/services/data-updates'

export function DataUpdateMonitor() {
  const { token } = useAuth()
  useEffect(() => startDataUpdates(token), [token])
  return null
}
