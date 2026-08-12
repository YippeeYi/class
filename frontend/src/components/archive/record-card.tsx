import { BookOpenText, CalendarDays, Clock, Paperclip, UserRound } from 'lucide-react'
import { memo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { MarkupContent } from '@/components/archive/markup-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { recordAnchor } from '@/lib/markup'
import { recordDisplayNumber, recordWrittenHref } from '@/lib/record-identity'
import { isModifiedRecordClick, prepareRecordJump, recordClientHref } from '@/lib/record-navigation'
import { signAssetUrl } from '@/services/data'
import type { Attachment, RecordItem } from '@/types/domain'

function AttachmentLink({ attachment }: { attachment: Attachment }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const open = async () => {
    setLoading(true)
    setError('')
    try {
      const url = await signAssetUrl(attachment.file)
      if (!url) throw new Error('附件地址不可用')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('附件打开失败，请重试。')
    } finally {
      setLoading(false)
    }
  }
  return (
    <span className="inline-grid gap-1">
      <Button variant="outline" size="sm" disabled={loading} onClick={open}>
        <Paperclip data-icon="inline-start" />
        {loading ? '正在打开…' : attachment.name || attachment.file}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="status">
          {error}
        </span>
      )}
    </span>
  )
}

export const RecordCard = memo(function RecordCard({
  record,
  onRecordReference,
  onSourceAction,
  showSourceAction = true,
}: {
  record: RecordItem
  onRecordReference?: (recordId: string, source: HTMLElement) => void
  onSourceAction?: (record: RecordItem, source: HTMLElement) => void
  showSourceAction?: boolean
}) {
  const navigate = useNavigate()
  const typeLabel =
    record.recordType === 'message' ? '箴言' : record.recordType === 'supplement' ? '补充' : ''
  const anchor = recordAnchor(record)

  return (
    <Collapsible>
      <Card
        id={anchor}
        tabIndex={-1}
        className="record-surface group/record scroll-mt-24 gap-0 py-0 duration-500"
      >
        <CardHeader className="border-b border-border/60 pt-3 !pb-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-meta leading-5 text-muted-foreground">
            <Badge variant={record.importance === 'important' ? 'default' : 'outline'}>
              {recordDisplayNumber(record)}
            </Badge>
            {typeLabel && <Badge variant="secondary">{typeLabel}</Badge>}
            {record.date && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {record.date}
              </span>
            )}
            {record.time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {record.time}
              </span>
            )}
            {record.author && (
              <Link
                to={`/person?id=${encodeURIComponent(record.author)}`}
                className="inline-flex items-center gap-1.5 hover:text-primary"
              >
                <UserRound className="size-3.5" />
                {record.author}
              </Link>
            )}
            {(record.attachments.length > 0 || showSourceAction) && (
              <span className="ml-auto inline-flex items-center gap-1.5">
                {record.attachments.length > 0 && (
                  <CollapsibleTrigger
                    render={
                      <Button variant="ghost" size="xs">
                        <Paperclip data-icon="inline-start" />
                        附件 {record.attachments.length}
                      </Button>
                    }
                  />
                )}
                {showSourceAction && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        onSourceAction ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`在书面记录中查看${recordDisplayNumber(record)}`}
                            className="record-source-action text-muted-foreground hover:text-accent-foreground"
                            onClick={(event) => onSourceAction(record, event.currentTarget)}
                          />
                        ) : (
                          <Button
                            nativeButton={false}
                            render={
                              <Link
                                to={recordWrittenHref(record)}
                                onClick={(event) => {
                                  prepareRecordJump(anchor)
                                  if (isModifiedRecordClick(event)) return
                                  event.preventDefault()
                                  navigate(recordClientHref(recordWrittenHref(record)))
                                }}
                              />
                            }
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`在书面记录中查看${recordDisplayNumber(record)}`}
                            className="record-source-action text-muted-foreground hover:text-accent-foreground"
                          />
                        )
                      }
                    >
                      <BookOpenText className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>跳转到原记录</TooltipContent>
                  </Tooltip>
                )}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-3">
          <MarkupContent content={record.content} onRecordReference={onRecordReference} />
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden opacity-100 transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0">
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
              {record.attachments.map((attachment) => (
                <AttachmentLink key={attachment.file} attachment={attachment} />
              ))}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  )
})
