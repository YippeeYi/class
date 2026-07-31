import { Check, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeading } from '@/components/archive/page-heading'
import {
  BACKGROUND_KEY,
  type BackgroundId,
  backgrounds,
  setBackground,
} from '@/components/layout/background-root'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
            onClick={() => {
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
  const [current, setCurrent] = useState<BackgroundId>(() => {
    const stored = localStorage.getItem(BACKGROUND_KEY) as BackgroundId | null
    return stored && backgrounds.some((item) => item.id === stored) ? stored : 'default'
  })
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
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {backgrounds.map((item) => (
          <Card
            key={item.id}
            className={`group/card overflow-hidden bg-card/90 py-0 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md ${current === item.id ? 'ring-2 ring-primary' : ''}`}
          >
            <AspectRatio
              ratio={16 / 9}
              className="overflow-hidden border-b bg-[linear-gradient(145deg,var(--background),var(--secondary))]"
            >
              {item.image && <BackgroundPreview src={item.image} active={current === item.id} />}
              {current === item.id && (
                <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="size-4" />
                </span>
              )}
            </AspectRatio>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{item.label}</CardTitle>
                <Badge variant="outline">{item.category}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <p className="mb-4 text-sm leading-6 text-muted-foreground">
                {item.credit.href ? (
                  <a
                    href={item.credit.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    {item.credit.label}
                  </a>
                ) : (
                  item.credit.label
                )}
              </p>
              <Button
                className="mt-auto w-full"
                variant={current === item.id ? 'secondary' : 'default'}
                aria-pressed={current === item.id}
                onClick={() => choose(item.id)}
              >
                <ImageIcon data-icon="inline-start" />
                {current === item.id ? '正在使用' : '设为背景'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
