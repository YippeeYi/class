import { type ReactNode, useEffect, useState } from 'react'

export const BACKGROUND_KEY = 'classRecord:background'

export type BackgroundId = 'default' | 'mountain' | 'cloud'

export const backgrounds: Array<{
  id: BackgroundId
  label: string
  category: string
  image?: string
  credit: string
}> = [
  { id: 'default', label: '纸本', category: '基础', credit: '编日史内置渐变' },
  {
    id: 'mountain',
    label: '山',
    category: '风景',
    image: '/images/backgrounds/mountain.jpg',
    credit: 'Alessio Soggetti · Unsplash',
  },
  {
    id: 'cloud',
    label: '云',
    category: '风景',
    image: '/images/backgrounds/cloud.jpg',
    credit: 'Agnese Rudzīte · Unsplash',
  },
]

export function setBackground(id: BackgroundId) {
  localStorage.setItem(BACKGROUND_KEY, id)
  window.dispatchEvent(new CustomEvent('classrecord:background', { detail: id }))
}

function readBackground(): BackgroundId {
  const value = localStorage.getItem(BACKGROUND_KEY)
  return backgrounds.some((item) => item.id === value) ? (value as BackgroundId) : 'default'
}

export function BackgroundRoot({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState(readBackground)
  useEffect(() => {
    const update = (event: Event) =>
      setCurrent((event as CustomEvent<BackgroundId>).detail || readBackground())
    window.addEventListener('classrecord:background', update)
    return () => window.removeEventListener('classrecord:background', update)
  }, [])
  const selected = backgrounds.find((item) => item.id === current)
  return (
    <div
      className="min-h-svh bg-background bg-cover bg-fixed bg-center"
      data-background={current}
      style={
        selected?.image
          ? {
              backgroundImage: `linear-gradient(rgb(20 18 15 / .42), rgb(20 18 15 / .58)), url(${selected.image})`,
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
