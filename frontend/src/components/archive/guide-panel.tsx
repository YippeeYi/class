import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  archiveItemSurfaceClassName,
  interactiveSurfaceVariants,
} from '@/components/archive/interaction'
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
  children: ReactNode
  to?: string
  toggle?: {
    id: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    label: string
  }
}

export function GuidePanel({ icon: Icon, title, children, to, toggle }: GuidePanelProps) {
  return (
    <Item
      variant="outline"
      data-guide-panel="true"
      className={cn(
        'min-h-20 flex-nowrap gap-3 rounded-xl px-4 py-3 font-normal leading-5',
        archiveItemSurfaceClassName,
        to || toggle ? interactiveSurfaceVariants({ kind: 'item' }) : 'app-interactive-item',
      )}
      render={to ? <Link to={to} /> : toggle ? <Label htmlFor={toggle.id} /> : undefined}
    >
      <ItemMedia
        variant="icon"
        className="grid size-9 self-center place-items-center rounded-lg bg-primary/10 text-primary group-has-data-[slot=item-description]/item:translate-y-0 group-has-data-[slot=item-description]/item:self-center"
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="text-sm font-semibold leading-5 text-foreground">{title}</ItemTitle>
        <ItemDescription className="line-clamp-none break-words text-xs font-normal leading-5 text-muted-foreground">
          {children}
        </ItemDescription>
      </ItemContent>
      {to && (
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
