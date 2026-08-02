(() => {
  const backgroundKey = 'classRecord:background'
  const paletteKey = 'classRecord:backgroundPalette:v1'
  const images = { mountain: 'mountain.jpg', cloud: 'cloud.jpg' }
  const properties = [
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
  ]

  try {
    const stored = localStorage.getItem(backgroundKey)
    const id = stored === 'mountain' || stored === 'cloud' ? stored : 'default'
    const root = document.documentElement
    root.dataset.backgroundBootstrap = id

    const paletteCache = JSON.parse(localStorage.getItem(paletteKey) || '{}')
    const palette = paletteCache && typeof paletteCache === 'object' ? paletteCache[id] : null
    if (palette && typeof palette === 'object') {
      for (const property of properties) {
        if (typeof palette[property] === 'string') root.style.setProperty(property, palette[property])
      }
    }

    const file = images[id]
    if (file) {
      const scriptUrl = document.currentScript?.src || document.baseURI
      const imageUrl = new URL(`images/backgrounds/${file}`, scriptUrl).href
      root.style.background =
        `linear-gradient(to bottom, rgb(20 18 15 / .34), rgb(20 18 15 / .52)), url("${imageUrl}") center / cover fixed`
      const preload = document.createElement('link')
      preload.rel = 'preload'
      preload.as = 'image'
      preload.href = imageUrl
      document.head.appendChild(preload)
    }
  } catch {
    // The regular React background loader remains the fallback.
  }
})()
