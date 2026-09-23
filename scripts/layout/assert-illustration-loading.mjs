import assert from 'node:assert/strict'

export async function assertIllustrationLoading(page) {
  const ranges = new Map()
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="300" height="600" fill="gray"/></svg>'
  await page.route('**/storage/v1/object/sign/**/loading-*.svg*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const name = url.pathname.split('/').pop()
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() === 'POST') return route.fulfill({ headers, json: { signedURL: url.pathname.replace('/storage/v1', '') + '?token=test' } })
    if (request.headers().range) ranges.set(name, (ranges.get(name) || 0) + 1)
    return route.fulfill({ headers, contentType: 'image/svg+xml', body: name === 'loading-fail.svg' ? 'invalid image' : svg })
  })
  await page.evaluate(() => window.__setupLoadingTest())
  const render = content => page.evaluate(content => window.__loadingRender(content), content)
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 })
    const name = `loading-cold-${width}.svg`
    await render(`前[[illu:${name}]][[illu:${name}]]后`)
    const images = page.locator('#illustration-loading-tests .record-media-image img')
    await images.first().waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('#illustration-loading-tests .record-media-image img')].every(img => img.complete && img.naturalWidth > 0))
    assert.equal(await images.count(), 2)
    const geometry = await images.first().evaluate(img => ({ width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height }))
    assert.ok(Math.abs(geometry.width / geometry.height - 0.5) < 0.02, `thumbnail preserves source ratio: ${JSON.stringify(geometry)}`)
    assert.equal(ranges.get(name), 1, 'repeated source shares one metadata request')
    assert.ok(geometry.width <= width - 24, 'thumbnail fits the viewport')
  }
  await render('[[illu:loading-fail.svg]]')
  await page.locator('#illustration-loading-tests .record-media-failure').waitFor()
  await render('页面已切换')
  assert.equal(await page.locator('#illustration-loading-tests').innerText(), '页面已切换')
  await page.evaluate(() => window.__loadingCleanup())
  await page.setViewportSize({ width: 1280, height: 1000 })
  console.log('Illustration loading passed: thumbnail ratio, shared metadata, failure and mobile.')
}
