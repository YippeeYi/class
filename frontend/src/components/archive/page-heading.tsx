import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PageHeading({
  eyebrow = 'CLASS ARCHIVE',
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'mb-8 flex flex-col gap-5 border-b border-border/70 pb-7 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="max-w-3xl">
        <p className="mb-2 text-[0.68rem] font-bold tracking-[0.22em] text-primary/70">{eyebrow}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
