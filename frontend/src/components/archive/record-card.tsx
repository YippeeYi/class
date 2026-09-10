import { BookOpenText, CalendarDays, Clock, Paperclip, UserRound } from 'lucide-react'
import { memo, useState } from 'react'
import { Link } from 'react-router'
import { textLinkClassName } from '@/components/archive/interaction'
import { MarkupContent } from '@/components/archive/markup-content'
import { RecordAnnotation } from '@/components/archive/record-annotation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { recordAnchor } from '@/lib/markup'
import { recordDisplayNumber, recordTypeLabel } from '@/lib/record-identity'
import { recordAnnotation } from '@/lib/record-stream'
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
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        aria-busy={loading || undefined}
        onClick={open}
      >
        {loading ? <Spinner /> : <Paperclip data-icon="inline-start" />}
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
  showSourceAction = false,
}: {
  record: RecordItem
  onRecordReference?: (recordId: string, source: HTMLElement) => void
  onSourceAction?: (record: RecordItem, source: HTMLElement) => void
  showSourceAction?: boolean
}) {
  const typeLabel = record.recordType ? recordTypeLabel(record) : ''
  const anchor = recordAnchor(record)
  const annotation = recordAnnotation(record.annotation)

  return (
    <Collapsible>
      <Card
        id={anchor}
        tabIndex={-1}
        className="record-surface group/record scroll-mt-24 gap-0 py-0"
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
                className={`${textLinkClassName} inline-flex items-center gap-1.5`}
              >
                <UserRound className="size-3.5" />
                {record.author}
              </Link>
            )}
            {(annotation || record.attachments.length > 0 || showSourceAction) && (
              <span className="ml-auto inline-flex items-center gap-1.5">
                {annotation && (
                  <RecordAnnotation
                    annotation={annotation}
                    label={recordDisplayNumber(record)}
                    onRecordReference={onRecordReference}
                  />
                )}
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
                {showSourceAction && onSourceAction && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`在书面记录中查看${recordDisplayNumber(record)}`}
                          className="record-source-action text-muted-foreground"
                          onClick={(event) => onSourceAction(record, event.currentTarget)}
                        />
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
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden opacity-100 transition-[height,opacity] duration-(--interaction-duration-slow) ease-(--interaction-ease-standard) data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0">
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
