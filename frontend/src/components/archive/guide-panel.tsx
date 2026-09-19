import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type GuidePanelProps = {
  icon: LucideIcon
  title: string
  children?: ReactNode
} & (
  | { to: string; href?: never; toggle?: never }
  | { href: string; to?: never; toggle?: never }
  | {
      to?: never
      href?: never
      toggle: {
        id: string
        checked: boolean
        onCheckedChange: (checked: boolean) => void
        label: string
      }
    }
)

export function GuidePanel({ icon: Icon, title, children, to, href, toggle }: GuidePanelProps) {
  return (
    <Item
      variant="outline"
      data-guide-panel="interactive"
      className={cn(
        'flex-nowrap gap-3 rounded-xl px-4 py-3 font-normal leading-5',
        children ? 'min-h-20' : 'min-h-14',
        'border-transparent bg-transparent text-card-foreground shadow-none',
        interactiveSurfaceVariants({ kind: 'item' }),
      )}
      render={
        to ? (
          <Link to={to} />
        ) : href ? (
          // biome-ignore lint/a11y/useAnchorContent: Item supplies the shared title and description as anchor children.
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title}（在新标签页打开 GitHub）`}
          />
        ) : toggle ? (
          <Label htmlFor={toggle.id} />
        ) : undefined
      }
    >
      <ItemMedia
        variant="icon"
        className="grid size-9 self-center place-items-center rounded-lg bg-primary/10 text-primary group-has-data-[slot=item-description]/item:translate-y-0 group-has-data-[slot=item-description]/item:self-center"
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="text-sm font-semibold leading-5 text-foreground">{title}</ItemTitle>
        {children && (
          <ItemDescription className="line-clamp-none break-words text-xs font-normal leading-5 text-muted-foreground">
            {children}
          </ItemDescription>
        )}
      </ItemContent>
      {(to || href) && (
        <ItemActions>
          <ArrowRight className="size-4" aria-hidden="true" />
        </ItemActions>
      )}
      {toggle && (
        <ItemActions>
          <Switch
            id={toggle.id}
            checked={toggle.checked}
            onCheckedChange={toggle.onCheckedChange}
            aria-label={toggle.label}
          />
        </ItemActions>
      )}
    </Item>
  )
}

/** Quiet information has no action surface or focus target. */
export function GuideInfo({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <div data-guide-info className="flex min-w-0 items-start gap-3 text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 space-y-1 text-xs leading-5">
        <h2 className="font-medium text-foreground">{title}</h2>
        <div className="break-words">{children}</div>
      </div>
    </div>
  )
}
