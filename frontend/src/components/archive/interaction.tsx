import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import {
  Button as ShadcnButton,
  buttonVariants as shadcnButtonVariants,
} from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type ShadcnButtonProps = ComponentProps<typeof ShadcnButton>

export type ButtonProps = ShadcnButtonProps & {
  /** Keeps async actions visually and functionally unavailable until completion. */
  loading?: boolean
  /** Keeps a text button's geometry and purpose stable while its action is pending. */
  loadingLabel?: ReactNode
}

/**
 * Project-level Button contract layered on top of shadcn/ui.
 *
 * The data attributes and stable classes let the application stylesheet own
 * hover, pressed, selected, focus, disabled, and loading feedback in one place
 * without changing the read-only shadcn component source.
 */
export function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  loadingLabel,
  disabled,
  'aria-busy': ariaBusy,
  children,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      data-app-button="true"
      data-app-variant={variant}
      data-app-size={size}
      className={cn('app-button', `app-button--${variant}`, className)}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      aria-busy={ariaBusy ?? (loading || undefined)}
      {...props}
    >
      {loading ? (
        <>
          <Spinner aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </ShadcnButton>
  )
}

type ButtonVariantOptions = Parameters<typeof shadcnButtonVariants>[0]

/** Use only when an element cannot be rendered through the Button wrapper. */
export function buttonVariants(options: ButtonVariantOptions = {}) {
  const variant = options?.variant || 'default'
  return cn(shadcnButtonVariants(options), 'app-button', `app-button--${variant}`)
}

export const interactiveSurfaceVariants = cva('group app-interactive-surface', {
  variants: {
    kind: {
      card: 'app-interactive-card',
      item: 'app-interactive-item',
      media: 'app-interactive-media',
    },
    selected: {
      true: 'is-selected',
      false: '',
    },
    disabled: {
      true: 'is-disabled',
      false: '',
    },
  },
  defaultVariants: {
    kind: 'item',
    selected: false,
    disabled: false,
  },
})

export type InteractiveSurfaceVariants = VariantProps<typeof interactiveSurfaceVariants>

export const textLinkClassName = 'app-text-link'
export const mediaAffordanceClassName = 'app-media-affordance'
