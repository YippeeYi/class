import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PageHeading({
  eyebrow = 'CLASS ARCHIVE',
  title,
  description,
  actions,
  className,
  compact = false,
}: {
  eyebrow?: string | null
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <header
      className={cn(
        'flex flex-col border-b border-border/70 md:flex-row md:justify-between',
        compact ? 'mb-3 gap-2 pb-3 md:items-center' : 'mb-6 gap-4 pb-5 md:items-end',
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow && (
          <p
            className={cn(
              'font-bold tracking-[0.18em] text-primary/75',
              compact ? 'mb-1 text-[0.6875rem]' : 'mb-2 text-xs',
            )}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            'font-heading font-semibold tracking-[-0.035em] text-balance',
            compact ? 'text-2xl sm:text-[1.75rem]' : 'text-3xl sm:text-4xl',
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              'max-w-2xl text-muted-foreground',
              compact ? 'mt-1 text-sm leading-6' : 'mt-2 text-base leading-7',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
