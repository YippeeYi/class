import { Check, Image as ImageIcon, Moon, Palette, Sparkles, Square, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { textLinkClassName } from '@/components/archive/interaction'
import { PageHeading } from '@/components/archive/page-heading'
import { SegmentedTabsList } from '@/components/archive/segmented-tabs'
import {
  type AppearancePreference,
  type BackgroundId,
  type BoxStyleId,
  backgrounds,
  boxStyles,
  readAppearance,
  setBackground,
  setBoxStyle,
  setThemePreset,
  type ThemePresetId,
  themePresets,
} from '@/components/layout/background-root'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'

type ThemePreset = (typeof themePresets)[number]

const themeModeGroups = [
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

const appearanceSections = [
  { value: 'palette', label: '配色', icon: Palette, description: '界面色彩' },
  { value: 'background', label: '背景', icon: ImageIcon, description: '底层画面' },
  { value: 'box', label: '方框', icon: Square, description: '容器质感' },
] as const

function ThemePresetOption({ preset, selected }: { preset: ThemePreset; selected: boolean }) {
  return (
    <Label
      htmlFor={`theme-preset-${preset.id}`}
      data-theme-preset-option={preset.id}
      data-theme-mode={preset.mode}
      data-selected={selected ? 'true' : 'false'}
      className="appearance-choice group/preset grid min-w-0 gap-2 p-2 font-normal leading-normal"
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
        <RadioGroupItem id={`theme-preset-${preset.id}`} value={preset.id} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{preset.label}</span>
        <span className="shrink-0 text-meta text-muted-foreground">{preset.category}</span>
      </span>
      <span className="line-clamp-2 px-0.5 text-meta leading-5 text-muted-foreground">
        {preset.description}
      </span>
    </Label>
  )
}

function AutomaticThemeOption({ selected }: { selected: boolean }) {
  return (
    <Label
      htmlFor="theme-preset-auto"
      data-theme-preset-option="auto"
      data-theme-mode="auto"
      data-selected={selected ? 'true' : 'false'}
      className="appearance-choice inline-flex min-h-11 min-w-44 items-center gap-2.5 px-3 py-2 font-normal leading-normal"
    >
      <RadioGroupItem id="theme-preset-auto" value="auto" />
      <Sparkles className="size-4 text-primary" />
      <span className="font-semibold">随背景</span>
      {selected && <Check className="ml-auto size-4 text-primary" aria-hidden="true" />}
    </Label>
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
        className={`background-choice-preview absolute inset-0 size-full object-cover ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  )
}

function BoxStyleOption({ id, selected }: { id: BoxStyleId; selected: boolean }) {
  const option = boxStyles.find((item) => item.id === id)
  if (!option) return null
  return (
    <Label
      htmlFor={`box-style-${id}`}
      data-box-style-id={id}
      data-selected={selected ? 'true' : 'false'}
      className="appearance-choice group/box flex-col items-stretch gap-0 overflow-hidden font-normal leading-normal"
    >
      <span
        className="box-style-preview relative grid min-h-36 place-items-center overflow-hidden border-b border-border/60 sm:min-h-40"
        aria-hidden="true"
      >
        <Card
          className={`box-style-preview-surface box-style-preview-surface--${id} absolute z-10 gap-0 border border-border bg-card py-0 ring-0`}
        >
          <CardContent className="grid h-full content-between p-3">
            {id === 'compact' && (
              <span className="grid gap-1.5">
                {[72, 88, 64].map((width, index) => (
                  <span
                    key={width}
                    className="box-style-preview-inset flex h-5 items-center gap-2 border border-border/72 bg-muted/48 px-1.5"
                  >
                    <span className="block size-2 shrink-0 bg-primary/45" />
                    <span
                      className="block h-1 rounded-full bg-muted-foreground/38"
                      style={{ width: `${width}%` }}
                    />
                    <span className="ml-auto text-[0.42rem] font-semibold text-muted-foreground/68">
                      {index + 1}
                    </span>
                  </span>
                ))}
              </span>
            )}
            {id === 'default' && (
              <>
                <span className="grid gap-2">
                  <span className="block h-2 w-2/3 rounded-full bg-foreground/72" />
                  <span className="block h-1.5 w-full rounded-full bg-muted-foreground/35" />
                  <span className="block h-1.5 w-4/5 rounded-full bg-muted-foreground/24" />
                </span>
                <span className="flex items-center gap-2">
                  <span className="box-style-preview-inset block h-5 w-14 border border-primary/35 bg-primary/12" />
                  <span className="box-style-preview-inset block h-5 w-9 border border-border bg-muted/72" />
                </span>
              </>
            )}
            {id === 'rounded' && (
              <>
                <span className="box-style-preview-inset block h-10 border border-primary/18 bg-primary/10" />
                <span className="grid gap-1.5">
                  <span className="block h-2 w-3/5 rounded-full bg-foreground/68" />
                  <span className="block h-1.5 w-5/6 rounded-full bg-muted-foreground/30" />
                </span>
              </>
            )}
          </CardContent>
        </Card>
        <Card
          className={`box-style-preview-control box-style-preview-control--${id} absolute z-20 gap-0 border border-border bg-card py-0 ring-0`}
        >
          <CardContent className="grid size-full place-items-center p-2.5">
            {id === 'compact' ? (
              <span className="grid grid-cols-2 gap-1">
                {['top-start', 'top-end', 'bottom-start', 'bottom-end'].map((position) => (
                  <span
                    key={position}
                    className="box-style-preview-inset block size-3 border border-primary/30 bg-primary/10"
                  />
                ))}
              </span>
            ) : id === 'default' ? (
              <span className="box-style-preview-inset grid size-9 place-items-center border border-primary/25 bg-primary/10">
                <Square className="size-4 text-primary" strokeWidth={1.75} />
              </span>
            ) : (
              <span className="box-style-preview-inset grid size-11 place-items-center border border-primary/22 bg-primary/10">
                <span className="block size-4 rounded-full bg-primary/48 ring-4 ring-primary/10" />
              </span>
            )}
          </CardContent>
        </Card>
      </span>
      <span className="flex items-start gap-3 p-4">
        <RadioGroupItem id={`box-style-${id}`} value={id} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2 font-semibold">
            {option.label}
            {selected && <Check className="size-4 text-primary" />}
          </span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">
            {option.description}
          </span>
        </span>
      </span>
    </Label>
  )
}

export function BackgroundsPage() {
  const [appearance, setAppearance] = useState<AppearancePreference>(readAppearance)
  const [section, setSection] = useState('palette')
  const current = appearance.background
  useDocumentTitle('风格')
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
  const chooseBox = (id: BoxStyleId) => setBoxStyle(id)
  return (
    <div>
      <PageHeading
        title="风格"
        description="配色、背景与方框彼此独立，共同组成全站视觉风格；所有选择都会保存在当前浏览器中。"
      />
      <Tabs value={section} onValueChange={setSection} className="gap-4">
        <SegmentedTabsList
          value={section as (typeof appearanceSections)[number]['value']}
          items={appearanceSections}
          ariaLabel="风格设置分区"
          className="w-full"
          triggerClassName="min-h-10 min-w-0 px-3 py-2"
        />

        <TabsContent value="palette" className="app-tabs-content">
          <Card className="appearance-preset-panel gap-0 overflow-hidden border-border/70 bg-card/88 py-0">
            <div className="flex items-start gap-3 border-b border-border/55 px-4 py-4 sm:px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Palette className="size-4" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base">配色</CardTitle>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  选择完整的明暗与强调色关系，或让界面自动跟随当前背景。
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
                <section
                  data-theme-mode-group="auto"
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-3"
                >
                  <AutomaticThemeOption selected={appearance.theme === 'auto'} />
                  <p className="min-w-48 flex-1 text-meta leading-5 text-muted-foreground">
                    从当前背景提取强调色；已缓存的配色会直接复用。
                  </p>
                </section>
                {themeModeGroups.map((group) => {
                  const Icon = group.icon
                  const items = themePresets.filter((preset) => preset.mode === group.mode)
                  return (
                    <section
                      key={group.mode}
                      data-theme-mode-group={group.mode}
                      className="grid gap-2.5 border-border/60 [&+section]:border-t [&+section]:pt-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5 px-0.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/72 text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold">{group.label}</h3>
                          <p className="text-meta leading-5 text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
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
        </TabsContent>

        <TabsContent value="background" className="app-tabs-content">
          <Card className="gap-0 overflow-hidden border-border/70 bg-card/88 py-0">
            <div className="flex items-start gap-3 border-b border-border/55 px-4 py-4 sm:px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base">背景</CardTitle>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  选择页面底层画面；它会与配色及方框风格独立组合。
                </p>
              </div>
            </div>
            <CardContent className="p-3 sm:p-4">
              <RadioGroup
                aria-label="选择全站背景"
                value={current}
                onValueChange={(value) => choose(value as BackgroundId)}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {backgrounds.map((item) => (
                  <div key={item.id} className="grid min-w-0 content-start gap-2">
                    <Label
                      htmlFor={`background-${item.id}`}
                      data-background-id={item.id}
                      data-selected={current === item.id ? 'true' : 'false'}
                      className="appearance-choice group/background-choice relative block min-w-0 overflow-hidden font-normal leading-normal"
                    >
                      <AspectRatio
                        ratio={4 / 3}
                        className="aspect-[4/3] overflow-hidden bg-muted"
                        style={{ background: item.swatch }}
                      >
                        {item.preview ? (
                          <BackgroundPreview src={item.preview} active={current === item.id} />
                        ) : (
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,color-mix(in_oklch,var(--primary)_20%,transparent),transparent_34%),repeating-linear-gradient(0deg,transparent_0_31px,color-mix(in_oklch,var(--primary)_7%,transparent)_32px),linear-gradient(145deg,var(--background),color-mix(in_oklch,var(--secondary)_62%,var(--background)))]" />
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_42%,rgb(18_16_14/.18)_100%)]" />
                        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-border/75 bg-background/70 p-3 shadow-md backdrop-blur-md sm:inset-x-4 sm:bottom-4">
                          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <strong className="truncate font-heading text-base sm:text-lg">
                                {item.label}
                              </strong>
                              <span
                                data-background-swatch
                                className="block h-2 w-8 shrink-0 rounded-full ring-1 ring-background/65"
                                style={{ background: item.swatch }}
                                aria-hidden="true"
                              />
                            </div>
                            <Badge
                              variant={current === item.id ? 'default' : 'outline'}
                              className={
                                current === item.id ? 'shrink-0' : 'shrink-0 bg-background/64'
                              }
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
                          id={`background-${item.id}`}
                          value={item.id}
                          aria-label={`使用${item.label}背景`}
                          className="absolute right-3 top-3 z-20 size-5 border-background/80 bg-background/90 shadow-sm after:-inset-2 sm:right-4 sm:top-4"
                        />
                      </AspectRatio>
                    </Label>
                    <div className="min-w-0 px-1">
                      <p className="truncate text-meta leading-5 text-muted-foreground">
                        {item.credit.href ? (
                          <a
                            href={item.credit.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={textLinkClassName}
                          >
                            {item.credit.label}
                          </a>
                        ) : (
                          item.credit.label
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="box" className="app-tabs-content">
          <Card className="gap-0 overflow-hidden border-border/70 bg-card/88 py-0">
            <div className="flex items-start gap-3 border-b border-border/55 px-4 py-4 sm:px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Square className="size-4" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base">方框</CardTitle>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  统一控制记录卡片、统计卡片、筛选区与弹窗等视觉容器。
                </p>
              </div>
            </div>
            <CardContent className="p-3 sm:p-4">
              <RadioGroup
                aria-label="选择全站方框风格"
                value={appearance.box}
                onValueChange={(value) => chooseBox(value as BoxStyleId)}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {boxStyles.map((style) => (
                  <BoxStyleOption
                    key={style.id}
                    id={style.id}
                    selected={appearance.box === style.id}
                  />
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
