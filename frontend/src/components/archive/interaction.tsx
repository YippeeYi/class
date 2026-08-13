import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import {
  Button as ShadcnButton,
  buttonVariants as shadcnButtonVariants,
} from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type ShadcnButtonProps = ComponentProps<typeof ShadcnButton>
type ButtonPointerEvent = Parameters<NonNullable<ShadcnButtonProps['onPointerDown']>>[0]
type ButtonKeyboardEvent = Parameters<NonNullable<ShadcnButtonProps['onKeyDown']>>[0]

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
  onPointerDown,
  onKeyDown,
  ...props
}: ButtonProps) {
  const rememberPointerOrigin = (event: ButtonPointerEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100
    const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100
    event.currentTarget.style.setProperty('--app-press-x', `${Math.max(0, Math.min(100, x))}%`)
    event.currentTarget.style.setProperty('--app-press-y', `${Math.max(0, Math.min(100, y))}%`)
    onPointerDown?.(event)
  }

  const rememberKeyboardOrigin = (event: ButtonKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.currentTarget.style.setProperty('--app-press-x', '50%')
      event.currentTarget.style.setProperty('--app-press-y', '50%')
    }
    onKeyDown?.(event)
  }

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
      onPointerDown={rememberPointerOrigin}
      onKeyDown={rememberKeyboardOrigin}
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
