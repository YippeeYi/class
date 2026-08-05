import type { ReactNode } from 'react'

import { PageHeaderActions, usePageHeaderTitle } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'

export function PageHeading(props: {
  eyebrow?: string | null
  title: string
  headerTitle?: string
  showTitleInContent?: boolean
  description?: string
  actions?: ReactNode
  className?: string
  compact?: boolean
}) {
  const {
    eyebrow,
    title,
    headerTitle = title,
    showTitleInContent = false,
    description,
    actions,
    className,
    compact = false,
  } = props
  usePageHeaderTitle(headerTitle)

  return (
    <>
      {(showTitleInContent || description) && (
        <header className={cn('max-w-3xl', compact ? 'mb-3' : 'mb-5', className)}>
          {showTitleInContent && eyebrow && (
            <p className="mb-1.5 text-xs font-semibold tracking-[0.16em] text-primary/70">
              {eyebrow}
            </p>
          )}
          {showTitleInContent && (
            <h1
              className={cn(
                'font-heading font-semibold tracking-[-0.035em] text-balance',
                compact ? 'text-section-title' : 'text-page-title',
              )}
            >
              {title}
            </h1>
          )}
          {description && (
            <p
              className={cn(
                'text-muted-foreground',
                compact ? 'text-control leading-6' : 'text-reading leading-7',
                showTitleInContent && (compact ? 'mt-1' : 'mt-2'),
              )}
            >
              {description}
            </p>
          )}
        </header>
      )}
      {actions && (
        <PageHeaderActions
          mobileClassName={cn(
            'flex flex-wrap items-center gap-2',
            compact ? 'mb-3' : 'mb-5',
            !description && !showTitleInContent && className,
          )}
        >
          {actions}
        </PageHeaderActions>
      )}
    </>
  )
}
