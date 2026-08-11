import { Check, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeading } from '@/components/archive/page-heading'
import {
  type BackgroundId,
  backgrounds,
  readBackground,
  setBackground,
} from '@/components/layout/background-root'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'

function BackgroundPreview({ src, active }: { src: string; active: boolean }) {
  const [revision, setRevision] = useState(0)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  if (failed)
    return (
      <div className="absolute inset-0 grid place-items-center bg-background/58 text-center text-sm text-muted-foreground backdrop-blur-sm">
        <div>
          <ImageIcon className="mx-auto mb-2 size-5" />
          <p className="mb-2">预览加载失败</p>
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setFailed(false)
              setReady(false)
              setRevision((value) => value + 1)
            }}
          >
            重试
          </Button>
        </div>
      </div>
    )
  return (
    <>
      {!ready && (
        <span className="absolute inset-0 grid place-items-center" role="status">
          <Spinner className="size-5 text-muted-foreground" />
          <span className="sr-only">正在加载背景预览</span>
        </span>
      )}
      <img
        key={revision}
        src={src}
        alt=""
        loading={active ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-300 group-hover/card:scale-[1.012] ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  )
}

export function BackgroundsPage() {
  const [current, setCurrent] = useState<BackgroundId>(readBackground)
  useEffect(() => {
    document.title = '背景 · 编日史'
  }, [])
  const choose = (id: BackgroundId) => {
    setBackground(id)
    setCurrent(id)
  }
  return (
    <div>
      <PageHeading
        title="背景"
        description={`共 ${backgrounds.length} 个背景；当前使用 ${backgrounds.find((item) => item.id === current)?.label || '默认'}。设置保存在当前浏览器中。`}
      />
      <RadioGroup
        aria-label="选择全站背景"
        value={current}
        onValueChange={(value) => choose(value as BackgroundId)}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {backgrounds.map((item) => (
          <Card
            key={item.id}
            data-background-id={item.id}
            data-selected={current === item.id ? 'true' : 'false'}
            className="group/card relative cursor-pointer gap-0 overflow-hidden border-white/30 bg-card/48 py-0 shadow-sm ring-1 ring-border/75 backdrop-blur-lg transition-[background-color,box-shadow,ring-color] duration-200 hover:bg-card/62 hover:ring-primary/35 data-[selected=true]:bg-card/68 data-[selected=true]:shadow-md data-[selected=true]:ring-2 data-[selected=true]:ring-primary dark:border-black/20"
            onClick={() => choose(item.id)}
          >
            <div className="h-1.5 w-full" style={{ background: item.swatch }} aria-hidden="true" />
            <AspectRatio
              ratio={4 / 3}
              className="aspect-[4/3] overflow-hidden bg-muted"
              style={{ background: item.swatch }}
            >
              {item.image ? (
                <BackgroundPreview src={item.image} active={current === item.id} />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,color-mix(in_oklch,var(--primary)_20%,transparent),transparent_34%),repeating-linear-gradient(0deg,transparent_0_31px,color-mix(in_oklch,var(--primary)_7%,transparent)_32px),linear-gradient(145deg,var(--background),color-mix(in_oklch,var(--secondary)_62%,var(--background)))]" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_42%,rgb(18_16_14/.18)_100%)]" />
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/35 bg-background/68 p-3 shadow-md backdrop-blur-md dark:border-black/25 sm:inset-x-4 sm:bottom-4 sm:p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-2">
                      <CardTitle className="truncate text-lg">{item.label}</CardTitle>
                      <Badge
                        variant={current === item.id ? 'default' : 'outline'}
                        className={current === item.id ? 'shrink-0' : 'shrink-0 bg-background/62'}
                      >
                        {current === item.id && <Check data-icon="inline-start" />}
                        {current === item.id ? '使用中' : item.category}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
              <RadioGroupItem
                value={item.id}
                aria-label={`使用${item.label}背景`}
                className="absolute right-3 top-3 z-20 size-5 border-background/80 bg-background/90 shadow-sm after:-inset-2 sm:right-4 sm:top-4"
                onClick={(event) => event.stopPropagation()}
              />
            </AspectRatio>
            <CardContent className="border-t border-white/20 bg-background/38 px-4 py-3 backdrop-blur-md dark:border-black/20">
              <p className="truncate text-xs leading-5 text-muted-foreground sm:text-sm">
                {item.credit.href ? (
                  <a
                    href={item.credit.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-foreground/30 underline-offset-4 hover:text-foreground"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {item.credit.label}
                  </a>
                ) : (
                  item.credit.label
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>
    </div>
  )
}
