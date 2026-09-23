import assert from 'node:assert/strict'

export async function assertIllustrationLoading(page) {
  const ranges = new Map()
  const svg = (width, height) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="gray"/></svg>`
  await page.route('**/storage/v1/object/sign/**/loading-*.svg*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const name = url.pathname.split('/').pop()
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() === 'POST') return route.fulfill({ headers, json: { signedURL: url.pathname.replace('/storage/v1', '') + '?token=test' } })
    if (request.headers().range) ranges.set(name, (ranges.get(name) || 0) + 1)
    const dimensions = name?.includes('wide') ? [2000, 100] : name?.includes('thin') ? [100, 2000] : [300, 600]
    return route.fulfill({ headers, contentType: 'image/svg+xml', body: name === 'loading-fail.svg' ? 'invalid image' : svg(...dimensions) })
  })
  await page.evaluate(() => window.__setupLoadingTest())
  const render = content => page.evaluate(content => window.__loadingRender(content), content)
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 })
    const name = `loading-cold-${width}.svg`
    await render(`前[[illu:${name}]][[illu:${name}]]后`)
    const images = page.locator('#illustration-loading-tests .record-media-image img')
    await images.first().waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('#illustration-loading-tests .record-media-image img')].every(img => img.complete && img.naturalWidth > 0))
    assert.equal(await images.count(), 2)
    const geometry = await images.first().evaluate(img => ({
      width: img.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(img.closest('.record-markup')).lineHeight),
    }))
    assert.ok(Math.abs(geometry.width / geometry.height - 0.5) < 0.02, `thumbnail preserves source ratio: ${JSON.stringify(geometry)}`)
    assert.ok(Math.abs(geometry.height - 2 * geometry.lineHeight) < 1, `visible thumbnail height equals two text lines: ${JSON.stringify(geometry)}`)
    assert.equal(ranges.get(name), 1, 'repeated source shares one metadata request')
    assert.ok(geometry.width <= width - 24, 'thumbnail fits the viewport')
    for (const shape of ['wide', 'thin']) {
      await render(`前[[illu:loading-${shape}-${width}.svg]]后`)
      const image = page.locator('#illustration-loading-tests .record-media-image img')
      await image.waitFor()
      await image.evaluate(img => img.decode())
      const bounds = await image.evaluate(img => {
        const imageBounds = img.getBoundingClientRect()
        const parentBounds = img.closest('.record-markup').getBoundingClientRect()
        return {
          width: imageBounds.width,
          height: imageBounds.height,
          parentWidth: parentBounds.width,
          naturalRatio: img.naturalWidth / img.naturalHeight,
          lineHeight: Number.parseFloat(getComputedStyle(img.closest('.record-markup')).lineHeight),
          objectFit: getComputedStyle(img).objectFit,
        }
      })
      assert.ok(bounds.width <= bounds.parentWidth, `${shape} image stays inside text container: ${JSON.stringify(bounds)}`)
      const visibleHeight = Math.min(bounds.height, bounds.width / bounds.naturalRatio)
      const expectedHeight = Math.min(2 * bounds.lineHeight, bounds.parentWidth / bounds.naturalRatio)
      assert.ok(Math.abs(visibleHeight - expectedHeight) < 2, `${shape} image is as tall as its aspect ratio and available width permit: ${JSON.stringify(bounds)}`)
      assert.equal(bounds.objectFit, 'contain', `${shape} image remains uncropped`)
    }
  }
  await render('[[illu:loading-font.svg]]')
  const fontImage = page.locator('#illustration-loading-tests .record-media-image img')
  await fontImage.waitFor()
  await fontImage.evaluate(img => img.decode())
  const resized = await fontImage.evaluate(img => {
    const text = img.closest('.record-markup')
    text.style.fontSize = '22px'
    text.style.lineHeight = '1.45'
    return {
      imageHeight: img.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(text).lineHeight),
    }
  })
  assert.ok(Math.abs(resized.imageHeight - 2 * resized.lineHeight) < 1, `thumbnail follows actual text metrics: ${JSON.stringify(resized)}`)
  await render('[[illu:loading-fail.svg]]')
  await page.locator('#illustration-loading-tests .record-media-failure').waitFor()
  await render('页面已切换')
  assert.equal(await page.locator('#illustration-loading-tests').innerText(), '页面已切换')
  await page.evaluate(() => window.__loadingCleanup())
  await page.setViewportSize({ width: 1280, height: 1000 })
  console.log('Illustration loading passed: thumbnail ratio, shared metadata, failure and mobile.')
}
