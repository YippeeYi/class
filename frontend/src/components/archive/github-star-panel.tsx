import { useEffect, useSyncExternalStore } from 'react'
import { GitHubIcon } from '@/components/archive/github-icon'
import { GuidePanel } from '@/components/archive/guide-panel'
import { githubProject } from '@/lib/github-project'
import { getGitHubStars, refreshGitHubStars, subscribeGitHubStars } from '@/services/github-stars'

export function GitHubStarPanel() {
  const stars = useSyncExternalStore(subscribeGitHubStars, getGitHubStars, () => null)
  useEffect(() => {
    // Public, optional data: allow the page to paint before contacting GitHub.
    const timer = window.setTimeout(() => void refreshGitHubStars(), 1000)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <GuidePanel icon={GitHubIcon} title="为项目点亮 Star" href={githubProject.url}>
      <span className="flex min-h-5 items-center justify-between gap-2">
        <span>GitHub</span>
        <span className="text-right tabular-nums" aria-live="polite">
          {stars === null ? '\u00a0' : `${stars.toLocaleString()} Stars`}
        </span>
      </span>
    </GuidePanel>
  )
}
