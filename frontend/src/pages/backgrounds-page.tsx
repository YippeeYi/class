import { Check, Image as ImageIcon, Moon, Palette, Sparkles, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeading } from '@/components/archive/page-heading'
import {
  type AppearancePreference,
  type BackgroundId,
  backgrounds,
  readAppearance,
  setBackground,
  setThemePreset,
  type ThemePresetId,
  themePresets,
} from '@/components/layout/background-root'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'

type ThemePreset = (typeof themePresets)[number]

function ThemePresetOption({ preset, selected }: { preset: ThemePreset; selected: boolean }) {
  return (
    <label
      htmlFor={`theme-preset-${preset.id}`}
      data-theme-preset-option={preset.id}
      data-theme-mode={preset.mode}
      data-selected={selected ? 'true' : 'false'}
      className="group/preset grid min-w-0 cursor-pointer gap-2 rounded-xl border border-border/70 bg-background/34 p-2 shadow-xs backdrop-blur-sm transition-[background-color,border-color,box-shadow] hover:border-primary/35 hover:bg-background/52 has-[[data-slot=radio-group-item]:focus-visible]:ring-2 has-[[data-slot=radio-group-item]:focus-visible]:ring-ring/45 data-[selected=true]:border-primary/65 data-[selected=true]:bg-background/62 data-[selected=true]:shadow-sm"
    >
      <span
        data-theme-preview={preset.id}
        className="appearance-preset-preview relative h-14 overflow-hidden rounded-lg border"
        aria-hidden="true"
      >
        <span className="appearance-preset-preview-card absolute inset-x-2 bottom-2 top-3 rounded-md border p-1.5 shadow-sm">
          <span className="appearance-preset-preview-heading mb-1 block h-1.5 w-2/3 rounded-full" />
          <span className="appearance-preset-preview-copy block h-1 w-4/5 rounded-full" />
          <span className="appearance-preset-preview-copy mt-1 block h-1 w-1/2 rounded-full" />
        </span>
        <span className="appearance-preset-preview-accent absolute right-1.5 top-1.5 size-3 rounded-full border" />
      </span>
      <span className="flex min-w-0 items-center gap-2 px-0.5">
        <RadioGroupItem id={`theme-preset-${preset.id}`} value={preset.id} className="size-3.5" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{preset.label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{preset.category}</span>
      </span>
      <span className="line-clamp-2 px-0.5 text-xs leading-4 text-muted-foreground">
        {preset.description}
      </span>
    </label>
  )
}

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
  const [appearance, setAppearance] = useState<AppearancePreference>(readAppearance)
  const current = appearance.background
  useEffect(() => {
    document.title = '背景 · 编日史'
  }, [])
  useEffect(() => {
    const update = (event: Event) =>
      setAppearance((event as CustomEvent<AppearancePreference>).detail || readAppearance())
    window.addEventListener('classrecord:appearance', update)
    return () => window.removeEventListener('classrecord:appearance', update)
  }, [])
  const choose = (id: BackgroundId) => {
    setBackground(id)
  }
  const chooseTheme = (id: ThemePresetId) => setThemePreset(id)
  const themeGroups = [
    {
      mode: 'auto' as const,
      label: '随背景',
      description: '保留从背景图片提取配色的自适应能力。',
      icon: Sparkles,
    },
    {
      mode: 'light' as const,
      label: '浅色模式',
      description: '适合明亮环境，正文和控件保持清晰深色层级。',
      icon: Sun,
    },
    {
      mode: 'dark' as const,
      label: '深色模式',
      description: '适合低光环境，卡片、边框和强调色均同步降亮。',
      icon: Moon,
    },
  ]
  return (
    <div>
      <PageHeading
        title="背景"
        description={`共 ${backgrounds.length} 个背景；当前使用 ${backgrounds.find((item) => item.id === current)?.label || '默认'}。设置保存在当前浏览器中。`}
      />
      <Card className="appearance-preset-panel mb-5 gap-0 overflow-hidden border-white/30 bg-card/42 py-0 shadow-sm backdrop-blur-md dark:border-black/25">
        <div className="flex items-start gap-3 border-b border-white/20 px-4 py-3 dark:border-black/20 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Palette className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">配色方案</CardTitle>
            <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
              预设会与当前背景共同保存；选择后仍可随时改用其他背景或配色。
            </p>
          </div>
        </div>
        <CardContent className="p-3 sm:p-4">
          <RadioGroup
            aria-label="选择全站配色方案"
            value={appearance.theme}
            onValueChange={(value) => chooseTheme(value as ThemePresetId)}
            className="grid gap-4"
          >
            {themeGroups.map((group) => {
              const Icon = group.icon
              const items = themePresets.filter((preset) => preset.mode === group.mode)
              return (
                <section
                  key={group.mode}
                  data-theme-mode-group={group.mode}
                  className="grid gap-2.5 border-border/60 [&+section]:border-t [&+section]:pt-4"
                >
                  <div className="flex min-w-0 items-center gap-2.5 px-0.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/72 text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <p className="text-xs leading-4 text-muted-foreground">{group.description}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 bg-background/38">
                      {items.length}
                    </Badge>
                  </div>
                  <div
                    className={
                      group.mode === 'auto'
                        ? 'grid max-w-sm grid-cols-1'
                        : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'
                    }
                  >
                    {items.map((preset) => (
                      <ThemePresetOption
                        key={preset.id}
                        preset={preset}
                        selected={appearance.theme === preset.id}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </RadioGroup>
        </CardContent>
      </Card>
      <RadioGroup
        aria-label="选择全站背景"
        value={current}
        onValueChange={(value) => choose(value as BackgroundId)}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {backgrounds.map((item) => (
          <Card
            key={item.id}
            data-background-id={item.id}
            data-selected={current === item.id ? 'true' : 'false'}
            className="group/card relative cursor-pointer gap-0 overflow-hidden border-white/30 bg-card/38 py-0 shadow-sm ring-1 ring-border/75 backdrop-blur-md transition-[background-color,box-shadow,ring-color] duration-200 hover:bg-card/54 hover:ring-primary/35 data-[selected=true]:bg-card/62 data-[selected=true]:shadow-md data-[selected=true]:ring-2 data-[selected=true]:ring-primary dark:border-black/20"
            onClick={() => choose(item.id)}
          >
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
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/35 bg-background/62 p-3 shadow-md backdrop-blur-md dark:border-black/25 sm:inset-x-4 sm:bottom-4">
                <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <CardTitle className="truncate text-base sm:text-lg">{item.label}</CardTitle>
                    <span
                      data-background-swatch
                      className="block h-2 w-8 shrink-0 rounded-full ring-1 ring-white/45"
                      style={{ background: item.swatch }}
                      aria-hidden="true"
                    />
                  </div>
                  <Badge
                    variant={current === item.id ? 'default' : 'outline'}
                    className={current === item.id ? 'shrink-0' : 'shrink-0 bg-background/52'}
                  >
                    {current === item.id && <Check data-icon="inline-start" />}
                    {current === item.id ? '使用中' : item.category}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <RadioGroupItem
                value={item.id}
                aria-label={`使用${item.label}背景`}
                className="absolute right-3 top-3 z-20 size-5 border-background/80 bg-background/90 shadow-sm after:-inset-2 sm:right-4 sm:top-4"
                onClick={(event) => event.stopPropagation()}
              />
            </AspectRatio>
            <CardContent className="border-t border-white/20 bg-background/32 px-4 py-2.5 backdrop-blur-sm dark:border-black/20">
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
