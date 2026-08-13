(() => {
  const backgroundKey = 'classRecord:background'
  const appearanceKey = 'classRecord:appearance:v1'
  const paletteKey = 'classRecord:backgroundPalette:v1'
  const images = { mountain: 'mountain.webp', cloud: 'cloud.webp' }
  const themes = new Set([
    'auto',
    'paper',
    'mist',
    'apricot',
    'sage',
    'rose',
    'ink',
    'midnight',
    'pine',
    'aurora',
  ])
  const darkThemes = new Set(['ink', 'midnight', 'pine', 'aurora'])
  const themeColors = {
    auto: '#f5f0e8',
    paper: '#f8f5ef',
    mist: '#eef5f7',
    apricot: '#faf1e7',
    ink: '#1d232d',
    sage: '#f0f5ed',
    rose: '#f8f0f2',
    midnight: '#171e31',
    pine: '#19271f',
    aurora: '#1d1b2e',
  }
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
    const appearance = JSON.parse(localStorage.getItem(appearanceKey) || 'null')
    const stored = appearance?.background || localStorage.getItem(backgroundKey)
    const id = stored === 'mountain' || stored === 'cloud' ? stored : 'default'
    const theme = themes.has(appearance?.theme) ? appearance.theme : 'auto'
    const root = document.documentElement
    root.dataset.backgroundBootstrap = id
    root.dataset.themePreset = theme
    root.classList.toggle('dark', darkThemes.has(theme))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme])

    const paletteCache = JSON.parse(localStorage.getItem(paletteKey) || '{}')
    const palette = paletteCache && typeof paletteCache === 'object' ? paletteCache[id] : null
    if (theme === 'auto' && palette && typeof palette === 'object') {
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
