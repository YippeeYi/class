import { MessageSquareText, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { MarkupContent } from '@/components/archive/markup-content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (nextOpen || !pendingReference.current) return
        const id = pendingReference.current
        pendingReference.current = ''
        if (trigger.current) onRecordReference?.(id, trigger.current)
      }}
    >
      <DialogTrigger
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
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col sm:max-w-2xl"
        showCloseButton={false}
        finalFocus={pendingReference.current ? false : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{label} · 注解</DialogTitle>
          <DialogDescription className="sr-only">记录的补充注解，可滚动阅读。</DialogDescription>
        </DialogHeader>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              aria-label="关闭注解"
            />
          }
        >
          <X />
        </DialogClose>
        <ScrollArea className="min-h-0 max-h-[calc(100dvh-8rem)] [&>[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-8rem)]">
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
      </DialogContent>
    </Dialog>
  )
}
