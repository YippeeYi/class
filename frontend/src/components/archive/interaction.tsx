import { cva, type VariantProps } from 'class-variance-authority'

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
