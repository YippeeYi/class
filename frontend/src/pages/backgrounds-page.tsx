import { Check, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeading } from '@/components/archive/page-heading'
import {
  BACKGROUND_KEY,
  type BackgroundId,
  backgrounds,
  setBackground,
} from '@/components/layout/background-root'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function BackgroundPreview({ src, active }: { src: string; active: boolean }) {
  const [revision, setRevision] = useState(0)
  const [failed, setFailed] = useState(false)
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
              setRevision((value) => value + 1)
            }}
          >
            重试
          </Button>
        </div>
      </div>
    )
  return (
    <img
      key={revision}
      src={src}
      alt=""
      loading={active ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
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
          <Card key={item.id} className="bg-card/85">
            <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(145deg,#fffdf8,#e9dfd2)]">
              {item.image && <BackgroundPreview src={item.image} active={current === item.id} />}
              {current === item.id && (
                <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="size-4" />
                </span>
              )}
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{item.label}</CardTitle>
                <Badge variant="outline">{item.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-muted-foreground">
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
                className="w-full"
                variant={current === item.id ? 'secondary' : 'default'}
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
