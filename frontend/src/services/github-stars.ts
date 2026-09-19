import { githubProject } from '@/lib/github-project'

const KEY = `classRecord:githubStars:${githubProject.repository}`
const FRESH_MS = 30 * 60 * 1000
const RETRY_MS = 5 * 60 * 1000
const listeners = new Set<() => void>()
let count: number | null = null
let checkedAt = 0
let lastAttempt = 0
let pending: Promise<void> | undefined
try {
  const stored = JSON.parse(localStorage.getItem(KEY) || 'null')
  if (
    Number.isSafeInteger(stored?.count) &&
    stored.count >= 0 &&
    Number.isFinite(stored.checkedAt)
  ) {
    count = stored.count
    checkedAt = stored.checkedAt
  }
} catch {
  // Optional statistics work without browser storage.
}
export const getGitHubStars = () => count
export function subscribeGitHubStars(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function refreshGitHubStars() {
  if (pending) return pending
  const now = Date.now()
  if (now - checkedAt < FRESH_MS || now - lastAttempt < RETRY_MS) return Promise.resolve()
  lastAttempt = now
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  pending = (async () => {
    try {
      const response = await fetch(githubProject.apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!response.ok) return
      const data = await response.json()
      if (!Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0) return
      count = data.stargazers_count
      checkedAt = Date.now()
      try {
        localStorage.setItem(KEY, JSON.stringify({ count, checkedAt }))
      } catch {
        // Keep the in-memory result if storage is full or disabled.
      }
      for (const listener of listeners) listener()
    } catch {
      // Keep the link and last known count usable offline or when rate limited.
    } finally {
      clearTimeout(timer)
    }
  })().finally(() => {
    pending = undefined
  })
  return pending
}
