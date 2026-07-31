export const ACCESS_KEY = 'classRecord:inviteAccess'
export const LAST_VISIT_KEY = 'classRecord:lastVisitAt'
export const REDIRECT_KEY = 'classRecordRedirectTarget'

export function getStoredAccessToken() {
  try {
    const value = JSON.parse(localStorage.getItem(ACCESS_KEY) || '{}') as { token?: unknown }
    return typeof value.token === 'string' ? value.token : ''
  } catch {
    return ''
  }
}
