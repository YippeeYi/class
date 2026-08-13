import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

export const BACKGROUND_KEY = 'classRecord:background'
export const APPEARANCE_KEY = 'classRecord:appearance:v1'
const PALETTE_KEY = 'classRecord:backgroundPalette:v1'
let volatileAppearance: AppearancePreference | null = null
let decodedBackground: { src: string; promise: Promise<HTMLImageElement> } | undefined
const THEME_PROPERTIES = [
  '--primary',
  '--ring',
  '--secondary',
  '--accent',
  '--border',
  '--input',
  '--sidebar-primary',
  '--sidebar-ring',
  '--chart-1',
  '--chart-2',
  '--chart-3',
] as const

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

function decodeBackground(src: string) {
  if (decodedBackground?.src === src) return decodedBackground.promise
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  const promise = image.decode().then(() => image)
  decodedBackground = { src, promise }
  promise.catch(() => {
    if (decodedBackground?.promise === promise) decodedBackground = undefined
  })
  return promise
}

export type BackgroundId = 'default' | 'mountain' | 'cloud'
export type BoxStyleId = 'compact' | 'default' | 'rounded'
export type ThemePresetId =
  | 'auto'
  | 'paper'
  | 'mist'
  | 'apricot'
  | 'sage'
  | 'rose'
  | 'ink'
  | 'midnight'
  | 'pine'
  | 'aurora'

export type AppearancePreference = {
  background: BackgroundId
  theme: ThemePresetId
  box: BoxStyleId
}

export const themePresets: Array<{
  id: ThemePresetId
  label: string
  category: string
  description: string
  mode: 'auto' | 'light' | 'dark'
  themeColor: string
}> = [
  {
    id: 'auto',
    label: '随景',
    category: '自动',
    description: '从当前背景提取强调色，保持图片与界面自然呼应。',
    mode: 'auto',
    themeColor: '#f5f0e8',
  },
  {
    id: 'paper',
    label: '纸白',
    category: '明亮',
    description: '中性纸色、清晰深字与低对比暖灰边界。',
    mode: 'light',
    themeColor: '#f8f5ef',
  },
  {
    id: 'mist',
    label: '雾蓝',
    category: '冷色',
    description: '克制的雾蓝强调与安静的冷灰阅读表面。',
    mode: 'light',
    themeColor: '#eef5f7',
  },
  {
    id: 'apricot',
    label: '暖杏',
    category: '暖色',
    description: '柔和杏橙强调与温暖、通透的浅色表面。',
    mode: 'light',
    themeColor: '#faf1e7',
  },
  {
    id: 'sage',
    label: '柔苔',
    category: '柔和',
    description: '低饱和灰绿强调，长时间查看也保持平静。',
    mode: 'light',
    themeColor: '#f0f5ed',
  },
  {
    id: 'rose',
    label: '莓霜',
    category: '柔和',
    description: '带灰度的莓红强调与微暖浅灰表面，清晰但不甜腻。',
    mode: 'light',
    themeColor: '#f8f0f2',
  },
  {
    id: 'ink',
    label: '夜墨',
    category: '中性',
    description: '低亮墨蓝表面与柔亮文字，适合暗处浏览。',
    mode: 'dark',
    themeColor: '#1d232d',
  },
  {
    id: 'midnight',
    label: '深海',
    category: '冷色',
    description: '深靛蓝表面配清亮蓝紫强调，层级清晰但不过亮。',
    mode: 'dark',
    themeColor: '#171e31',
  },
  {
    id: 'pine',
    label: '松夜',
    category: '柔和',
    description: '深松绿色表面与低饱和薄荷强调，夜间更平静。',
    mode: 'dark',
    themeColor: '#19271f',
  },
  {
    id: 'aurora',
    label: '极光',
    category: '彩色',
    description: '深紫蓝底色配克制青绿强调，适合图片背景与夜间阅读。',
    mode: 'dark',
    themeColor: '#1d1b2e',
  },
]

export const boxStyles: Array<{
  id: BoxStyleId
  label: string
  description: string
}> = [
  {
    id: 'compact',
    label: '利落小角',
    description: '接近直角的克制倒角，信息密度高、边界最清晰。',
  },
  {
    id: 'default',
    label: '标准圆角',
    description: '沿用清晰、稳重的 shadcn 比例，适合大多数界面。',
  },
  {
    id: 'rounded',
    label: '圆角方框',
    description: '采用更舒展的普通圆角，保持清晰边界与稳定的交互反馈。',
  },
]

export const backgrounds: Array<{
  id: BackgroundId
  label: string
  category: string
  description: string
  swatch: string
  image?: string
  credit: { label: string; href?: string }
}> = [
  {
    id: 'default',
    label: '纸本',
    category: '基础',
    description: '温暖纸色与细线纹理，适合长时间阅读。',
    swatch: 'linear-gradient(90deg, #8b6f5c, #d1b58a)',
    credit: { label: '编日史内置渐变' },
  },
  {
    id: 'mountain',
    label: '山',
    category: '风景',
    description: '取自远山与薄雾的低饱和青蓝色调。',
    swatch: 'linear-gradient(90deg, #477f98, #b9d3da)',
    image: assetUrl('images/backgrounds/mountain.webp'),
    credit: {
      label: 'Alessio Soggetti · Unsplash',
      href: 'https://unsplash.com/photos/mountains-covered-with-fogs-gdE-5Oui1Y0',
    },
  },
  {
    id: 'cloud',
    label: '云',
    category: '风景',
    description: '取自晚霞云层的珊瑚橙与灰紫色调。',
    swatch: 'linear-gradient(90deg, #e18b6d, #887281)',
    image: assetUrl('images/backgrounds/cloud.webp'),
    credit: {
      label: 'Agnese Rudzīte · Unsplash',
      href: 'https://unsplash.com/photos/pink-and-orange-clouds-against-a-pale-sky-at-sunset-bziUIonXyI4',
    },
  },
]

function isBackgroundId(value: unknown): value is BackgroundId {
  return backgrounds.some((item) => item.id === value)
}

function isThemePresetId(value: unknown): value is ThemePresetId {
  return themePresets.some((item) => item.id === value)
}

function isBoxStyleId(value: unknown): value is BoxStyleId {
  return boxStyles.some((item) => item.id === value)
}

export function readAppearance(): AppearancePreference {
  if (volatileAppearance) return volatileAppearance
  try {
    const stored = JSON.parse(
      localStorage.getItem(APPEARANCE_KEY) || 'null',
    ) as Partial<AppearancePreference> | null
    const legacyBackground = localStorage.getItem(BACKGROUND_KEY)
    return {
      background: isBackgroundId(stored?.background)
        ? stored.background
        : isBackgroundId(legacyBackground)
          ? legacyBackground
          : 'default',
      theme: isThemePresetId(stored?.theme) ? stored.theme : 'auto',
      box: isBoxStyleId(stored?.box) ? stored.box : 'default',
    }
  } catch {
    return { background: 'default', theme: 'auto', box: 'default' }
  }
}

function updateAppearance(next: Partial<AppearancePreference>) {
  const previous = readAppearance()
  const appearance: AppearancePreference = {
    background: isBackgroundId(next.background) ? next.background : previous.background,
    theme: isThemePresetId(next.theme) ? next.theme : previous.theme,
    box: isBoxStyleId(next.box) ? next.box : previous.box,
  }
  volatileAppearance = appearance
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance))
    // Keep the former key in sync so existing installs and older deployments can roll back safely.
    localStorage.setItem(BACKGROUND_KEY, appearance.background)
  } catch {
    // The selected appearance remains active for the current page session.
  }
  window.dispatchEvent(new CustomEvent('classrecord:appearance', { detail: appearance }))
  if (previous.background !== appearance.background)
    window.dispatchEvent(
      new CustomEvent('classrecord:background', { detail: appearance.background }),
    )
}

export function setBackground(id: BackgroundId) {
  updateAppearance({ background: id })
}

export function setThemePreset(id: ThemePresetId) {
  updateAppearance({ theme: id })
}

export function setBoxStyle(id: BoxStyleId) {
  updateAppearance({ box: id })
}

type Palette = Record<(typeof THEME_PROPERTIES)[number], string>

function readPalette(id: BackgroundId) {
  try {
    const cache = JSON.parse(localStorage.getItem(PALETTE_KEY) || '{}') as Record<string, Palette>
    return cache[id] || null
  } catch {
    return null
  }
}

function storePalette(id: BackgroundId, palette: Palette) {
  try {
    const cache = JSON.parse(localStorage.getItem(PALETTE_KEY) || '{}') as Record<string, Palette>
    cache[id] = palette
    localStorage.setItem(PALETTE_KEY, JSON.stringify(cache))
  } catch {
    // The palette remains active when browser storage is unavailable.
  }
}

function applyPalette(palette: Palette | null) {
  const root = document.documentElement
  for (const property of THEME_PROPERTIES) {
    if (palette?.[property]) root.style.setProperty(property, palette[property])
    else root.style.removeProperty(property)
  }
}

function buildPalette(red: number, green: number, blue: number): Palette {
  const max = Math.max(red, green, blue) / 255
  const min = Math.min(red, green, blue) / 255
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === red / 255) hue = ((green - blue) / 255 / delta) % 6
    else if (max === green / 255) hue = (blue - red) / 255 / delta + 2
    else hue = (red - green) / 255 / delta + 4
  }
  hue = Math.round((hue * 60 + 360) % 360)
  const lightness = (max + min) / 2
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  const chroma = Math.round(Math.min(68, Math.max(28, saturation * 100)))
  return {
    '--primary': `hsl(${hue} ${chroma}% 36%)`,
    '--ring': `hsl(${hue} ${Math.max(24, chroma - 8)}% 52%)`,
    '--secondary': `hsl(${hue} ${Math.max(12, chroma * 0.38)}% 91%)`,
    '--accent': `hsl(${hue} ${Math.max(14, chroma * 0.42)}% 92%)`,
    '--border': `hsl(${hue} ${Math.max(10, chroma * 0.28)}% 84%)`,
    '--input': `hsl(${hue} ${Math.max(10, chroma * 0.3)}% 82%)`,
    '--sidebar-primary': `hsl(${hue} ${chroma}% 32%)`,
    '--sidebar-ring': `hsl(${hue} ${Math.max(24, chroma - 8)}% 56%)`,
    '--chart-1': `hsl(${hue} ${chroma}% 42%)`,
    '--chart-2': `hsl(${(hue + 34) % 360} ${Math.max(26, chroma - 8)}% 52%)`,
    '--chart-3': `hsl(${(hue + 326) % 360} ${Math.max(24, chroma - 12)}% 60%)`,
  }
}

async function extractPalette(src: string) {
  const image = await decodeBackground(src)
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let red = 0
  let green = 0
  let blue = 0
  let weight = 0
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = (pixels[index + 3] || 0) / 255
    if (alpha < 0.5) continue
    const nextRed = pixels[index] || 0
    const nextGreen = pixels[index + 1] || 0
    const nextBlue = pixels[index + 2] || 0
    const spread = Math.max(nextRed, nextGreen, nextBlue) - Math.min(nextRed, nextGreen, nextBlue)
    const nextWeight = alpha * (1 + spread / 255)
    red += nextRed * nextWeight
    green += nextGreen * nextWeight
    blue += nextBlue * nextWeight
    weight += nextWeight
  }
  return weight ? buildPalette(red / weight, green / weight, blue / weight) : null
}

export function readBackground(): BackgroundId {
  return readAppearance().background
}

function applyThemePreset(id: ThemePresetId) {
  const root = document.documentElement
  const preset = themePresets.find((item) => item.id === id) || themePresets[0]
  root.dataset.themePreset = id
  root.classList.toggle('dark', preset?.mode === 'dark')
  if (preset?.themeColor)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preset.themeColor)
}

function applyBoxStyle(id: BoxStyleId) {
  document.documentElement.dataset.boxStyle = id
}

function backgroundLayerStyle(id: BackgroundId): CSSProperties {
  const background = backgrounds.find((item) => item.id === id)
  return background?.image
    ? {
        backgroundImage: `radial-gradient(circle at 50% 20%, transparent 0, transparent 32%, color-mix(in oklch, var(--background) 24%, transparent) 100%), linear-gradient(to bottom, rgb(24 20 16 / .16), rgb(24 20 16 / .34)), url(${background.image})`,
      }
    : {
        backgroundImage:
          'radial-gradient(circle at 50% 20%, transparent 0, transparent 32%, color-mix(in oklch, var(--background) 24%, transparent) 100%), repeating-linear-gradient(0deg, transparent 0 31px, color-mix(in oklch, var(--primary) 4%, transparent) 32px), radial-gradient(circle at 85% 10%, color-mix(in oklch, var(--primary) 17%, transparent), transparent 34%), radial-gradient(circle at 8% 88%, color-mix(in oklch, var(--secondary) 58%, transparent), transparent 38%), linear-gradient(145deg, var(--background), color-mix(in oklch, var(--secondary) 54%, var(--background)))',
      }
}

export function BackgroundRoot({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(readAppearance)
  const current = appearance.background
  const [visible, setVisible] = useState(readBackground)
  const [previous, setPrevious] = useState<BackgroundId | null>(null)
  const transitionTimer = useRef<number | null>(null)
  useEffect(() => {
    const update = (event: Event) =>
      setAppearance((event as CustomEvent<AppearancePreference>).detail || readAppearance())
    window.addEventListener('classrecord:appearance', update)
    return () => window.removeEventListener('classrecord:appearance', update)
  }, [])
  const selected = backgrounds.find((item) => item.id === current)
  const visibleBackground = backgrounds.find((item) => item.id === visible)

  useEffect(() => {
    if (current === visible) return
    let active = true
    const commit = () => {
      if (!active) return
      setPrevious(visible)
      setVisible(current)
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
      transitionTimer.current = window.setTimeout(() => {
        setPrevious(null)
        transitionTimer.current = null
      }, 560)
    }
    if (!selected?.image) {
      commit()
      return () => {
        active = false
      }
    }
    void decodeBackground(selected.image).then(commit, commit)
    return () => {
      active = false
    }
  }, [current, selected, visible])

  useEffect(
    () => () => {
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    },
    [],
  )

  useEffect(() => {
    applyThemePreset(appearance.theme)
  }, [appearance.theme])

  useEffect(() => {
    applyBoxStyle(appearance.box)
  }, [appearance.box])

  useEffect(() => {
    const root = document.documentElement
    const layer = backgroundLayerStyle(visible)
    // The fixed React layer paints the normal viewport, while the document
    // canvas is what Safari and other elastic scrollers reveal beyond its
    // edges. Keep both on the same source instead of disabling overscroll.
    root.style.backgroundColor = 'var(--background)'
    root.style.backgroundImage = String(layer.backgroundImage || 'none')
    root.style.backgroundPosition = 'center'
    root.style.backgroundRepeat = 'no-repeat'
    root.style.backgroundSize = 'cover'
    root.style.backgroundAttachment = 'fixed'
    root.dataset.background = visible
    delete root.dataset.backgroundBootstrap
  }, [visible])

  useEffect(() => {
    let active = true
    if (appearance.theme !== 'auto') {
      applyPalette(null)
      return () => {
        active = false
      }
    }
    if (!visibleBackground?.image) {
      applyPalette(null)
      return () => {
        active = false
      }
    }
    const cached = readPalette(visibleBackground.id)
    if (cached) {
      applyPalette(cached)
      return () => {
        active = false
      }
    }
    void extractPalette(visibleBackground.image)
      .then((palette) => {
        if (!active || !palette) return
        applyPalette(palette)
        storePalette(visibleBackground.id, palette)
      })
      .catch(() => {
        if (active && !cached) applyPalette(null)
      })
    return () => {
      active = false
    }
  }, [appearance.theme, visibleBackground])
  return (
    <div
      className="relative isolate min-h-svh overflow-x-clip bg-background"
      data-background={current}
      data-background-visible={visible}
      data-theme-preset={appearance.theme}
      data-box-style={appearance.box}
    >
      {previous && (
        <div
          aria-hidden="true"
          className="background-layer pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
          style={backgroundLayerStyle(previous)}
        />
      )}
      <div
        key={visible}
        aria-hidden="true"
        className="background-layer pointer-events-none fixed inset-0 z-0 bg-cover bg-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--interaction-duration-scene)"
        style={backgroundLayerStyle(visible)}
      />
      <div className="relative z-10 min-h-svh">{children}</div>
    </div>
  )
}
