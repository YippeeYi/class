import type { ReactNode } from 'react'

import { PageHeaderActions, usePageHeaderTitle } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'

export function PageHeading(props: {
  eyebrow?: string | null
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  compact?: boolean
}) {
  const { title, description, actions, className, compact = false } = props
  usePageHeaderTitle(title)

  return (
    <>
      {description && (
        <p
          className={cn(
            'max-w-3xl text-muted-foreground',
            compact ? 'mb-3 text-[0.9375rem] leading-6' : 'mb-5 text-base leading-7',
            className,
          )}
        >
          {description}
        </p>
      )}
      {actions && (
        <PageHeaderActions
          mobileClassName={cn(
            'flex flex-wrap items-center gap-2',
            compact ? 'mb-3' : 'mb-5',
            !description && className,
          )}
        >
          {actions}
        </PageHeaderActions>
      )}
    </>
  )
}
