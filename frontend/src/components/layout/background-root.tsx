import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

export const BACKGROUND_KEY = 'classRecord:background'
const PALETTE_KEY = 'classRecord:backgroundPalette:v1'
let volatileBackground: BackgroundId | null = null
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

export type BackgroundId = 'default' | 'mountain' | 'cloud'

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

export function setBackground(id: BackgroundId) {
  volatileBackground = id
  try {
    localStorage.setItem(BACKGROUND_KEY, id)
  } catch {
    // The selected background remains active for the current page session.
  }
  window.dispatchEvent(new CustomEvent('classrecord:background', { detail: id }))
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
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  await image.decode()
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
  if (volatileBackground) return volatileBackground
  try {
    const value = localStorage.getItem(BACKGROUND_KEY)
    return backgrounds.some((item) => item.id === value) ? (value as BackgroundId) : 'default'
  } catch {
    return 'default'
  }
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
  const [current, setCurrent] = useState(readBackground)
  const [visible, setVisible] = useState(readBackground)
  const [previous, setPrevious] = useState<BackgroundId | null>(null)
  const transitionTimer = useRef<number | null>(null)
  useEffect(() => {
    document.documentElement.style.removeProperty('background')
    delete document.documentElement.dataset.backgroundBootstrap
  }, [])
  useEffect(() => {
    const update = (event: Event) =>
      setCurrent((event as CustomEvent<BackgroundId>).detail || readBackground())
    window.addEventListener('classrecord:background', update)
    return () => window.removeEventListener('classrecord:background', update)
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
    const image = new Image()
    image.decoding = 'async'
    image.src = selected.image
    void image.decode().then(commit, commit)
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
    let active = true
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
  }, [visibleBackground])
  return (
    <div
      className="relative isolate min-h-svh overflow-x-clip bg-background"
      data-background={current}
      data-background-visible={visible}
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
        className="background-layer pointer-events-none fixed inset-0 z-0 bg-cover bg-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
        style={backgroundLayerStyle(visible)}
      />
      <div className="relative z-10 min-h-svh">{children}</div>
    </div>
  )
}
