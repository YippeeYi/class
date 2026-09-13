import { MessageSquareText, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { MarkupContent } from '@/components/archive/markup-content'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDismissOnVerticalScroll } from '@/hooks/use-dismiss-on-vertical-scroll'
import { useIsMobile } from '@/hooks/use-mobile'

export function RecordAnnotation({
  annotation,
  label,
  onRecordReference,
}: {
  annotation: string
  label: string
  onRecordReference?: (recordId: string, source: HTMLElement) => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const pendingReference = useRef('')
  const mobile = useIsMobile()
  useDismissOnVerticalScroll(open, trigger, () => setOpen(false))
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (nextOpen || !pendingReference.current) return
        const id = pendingReference.current
        pendingReference.current = ''
        if (trigger.current) onRecordReference?.(id, trigger.current)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            ref={trigger}
            variant="ghost"
            size="xs"
            className="record-annotation-action transition-opacity duration-(--interaction-duration-standard)"
            onClick={(event) => event.stopPropagation()}
          >
            <MessageSquareText data-icon="inline-start" />
            查看注解
          </Button>
        }
      />
      <PopoverContent
        side={mobile ? 'bottom' : 'right'}
        align="start"
        sideOffset={8}
        className="record-annotation-popup w-[min(28rem,calc(100vw-2rem))] max-h-[min(70dvh,var(--available-height))] min-h-0 p-3"
        finalFocus={pendingReference.current ? false : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader className="shrink-0 pr-8">
          <PopoverTitle>{label} · 注解</PopoverTitle>
          <PopoverDescription className="sr-only">记录的补充注解，可滚动阅读。</PopoverDescription>
        </PopoverHeader>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2"
          aria-label="关闭注解"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
        <ScrollArea className="min-h-0 max-h-[min(55dvh,calc(var(--available-height)-5rem))] [&>[data-slot=scroll-area-viewport]]:max-h-[min(55dvh,calc(var(--available-height)-5rem))]">
          <div className="pr-3 [overflow-wrap:anywhere]">
            <MarkupContent
              content={annotation}
              onRecordReference={
                onRecordReference
                  ? (id) => {
                      pendingReference.current = id
                      setOpen(false)
                    }
                  : undefined
              }
            />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
