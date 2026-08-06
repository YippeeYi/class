import { Image as ImageIcon } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'

function BackgroundPreview({ src, active }: { src: string; active: boolean }) {
  const [revision, setRevision] = useState(0)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  if (failed)
    return (
      <div className="grid size-full place-items-center text-center text-sm text-muted-foreground">
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
        className={`size-full object-cover transition-[opacity,transform] duration-300 group-hover/card:scale-[1.015] ${ready ? 'opacity-100' : 'opacity-0'}`}
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
            data-selected={current === item.id ? 'true' : 'false'}
            className="group/card gap-0 overflow-hidden bg-card/82 py-0 shadow-sm ring-1 ring-border/80 backdrop-blur-md transition-[background-color,box-shadow,ring-color] duration-200 hover:bg-card/90 hover:ring-primary/35 data-[selected=true]:bg-card/94 data-[selected=true]:shadow-md data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
          >
            {/* biome-ignore lint/a11y/noLabelWithoutControl: RadioGroupItem renders its hidden native radio input inside this label. */}
            <label className="block cursor-pointer select-none">
              <AspectRatio
                ratio={16 / 9}
                className="overflow-hidden border-b bg-[linear-gradient(145deg,var(--background),var(--secondary))]"
              >
                {item.image ? (
                  <BackgroundPreview src={item.image} active={current === item.id} />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_36%),linear-gradient(145deg,var(--background),color-mix(in_oklch,var(--secondary)_54%,var(--background)))]" />
                )}
                <div className="absolute inset-x-4 bottom-3 grid gap-1.5 rounded-lg border border-white/35 bg-background/72 px-3 py-2 shadow-sm backdrop-blur-md">
                  <span className="h-2 w-16 rounded-full bg-foreground/70" />
                  <span className="h-1.5 w-3/4 rounded-full bg-foreground/25" />
                </div>
                <RadioGroupItem
                  value={item.id}
                  nativeButton={false}
                  aria-label={`使用${item.label}背景`}
                  className="absolute right-3 top-3 z-10 size-5 border-background/80 bg-background/90 shadow-sm after:-inset-2"
                />
              </AspectRatio>
              <CardHeader className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{item.label}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {current === item.id ? '当前正在使用' : '点击预览区域即可切换'}
                    </p>
                  </div>
                  <Badge variant={current === item.id ? 'default' : 'outline'}>
                    {current === item.id ? '已选择' : item.category}
                  </Badge>
                </div>
              </CardHeader>
            </label>
            <CardContent className="border-t border-border/60 py-3">
              <p className="text-sm leading-6 text-muted-foreground">
                {item.credit.href ? (
                  <a
                    href={item.credit.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
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
