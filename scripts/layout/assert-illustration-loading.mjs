import assert from 'node:assert/strict'

export async function assertIllustrationLoading(page) {
  const counts = new Map()
  const releases = new Map()
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="300" height="600" fill="gray"/></svg>'
  await page.route('**/storage/v1/object/sign/**/loading-*.png*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const name = url.pathname.split('/').pop()
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() === 'POST') return route.fulfill({ headers, json: { signedURL: url.pathname.replace('/storage/v1', '') + '?token=test' } })
    const range = Boolean(request.headers().range)
    if (range) counts.set(name, (counts.get(name) || 0) + 1)
    if ((range && name !== 'loading-body.png') || (!range && name === 'loading-body.png')) {
      await new Promise(resolve => { const timer = setTimeout(resolve, 15000); releases.set(name, () => { clearTimeout(timer); resolve() }) })
    }
    return route.fulfill({ headers, contentType: 'image/svg+xml', body: name === 'loading-fail.png' || name === 'loading-body.png' ? 'invalid image' : svg }).catch(() => {})
  })
  await page.evaluate(() => window.__setupLoadingTest())
  const popup = page.locator('.record-illustration-popup[data-open]').last()
  const render = content => page.evaluate(content => window.__loadingRender(content), content)
  const release = async name => {
    for (let attempt = 0; attempt < 100 && !releases.has(name); attempt++) await page.waitForTimeout(25)
    assert.ok(releases.has(name), `request started: ${name}`)
    releases.get(name)()
    releases.delete(name)
  }
  for (const width of [390,1280]) {
    await page.setViewportSize({ width, height: 1000 })
    const name = `loading-cold-${width}.png`
    await render(`[[red:周围文字]] [[illu:${name}|冷图]] [[illu:${name}|重复图]]`)
    await page.getByRole('button', { name: '冷图', exact: true }).hover()
    await popup.getByRole('status').waitFor()
    assert.equal(await popup.locator('[data-illustration-frame]').count(), 0)
    assert.ok((await popup.boundingBox()).height < 80, 'unknown dimensions use only compact status')
    await release(name)
    await popup.getByRole('img').waitFor()
    const bounds = await popup.locator('[data-illustration-frame]').evaluate(e => ({ width: e.offsetWidth, height: e.offsetHeight }))
    assert.ok(Math.abs(bounds.width / bounds.height - 0.5) < 0.01)
    await page.getByRole('button', { name: '重复图', exact: true }).hover()
    await popup.getByRole('img').waitFor()
    assert.equal(counts.get(name), 1, 'repeated path reuses shared metadata')
  }
  await render('[[illu:loading-fail.png|坏尺寸]]')
  await page.getByRole('button', { name: '坏尺寸' }).hover()
  await popup.getByRole('status').waitFor()
  await release('loading-fail.png')
  await popup.getByText('无法获取图片尺寸，请稍后重试').waitFor()
  assert.equal(await popup.locator('[data-illustration-frame]').count(), 0)
  // Known metadata with a delayed, then corrupt, image body is a separate error phase.
  await page.evaluate(async () => {
    const { rememberImageDimensions } = await import('/src/services/image-metadata.ts')
    rememberImageDimensions('data/attachments/loading-body.png', { width: 300, height: 600 })
  })
  await render('[[illu:loading-body.png|坏图片]]')
  await page.getByRole('button', { name: '坏图片' }).hover()
  await popup.locator('[data-illustration-frame]').waitFor()
  const before = await popup.locator('[data-illustration-frame]').evaluate(e => ({ width: e.offsetWidth, height: e.offsetHeight }))
  await release('loading-body.png')
  await popup.getByRole('button', { name: '图片加载失败，重试' }).waitFor()
  const after = await popup.locator('[data-illustration-frame]').evaluate(e => ({ width: e.offsetWidth, height: e.offsetHeight }))
  assert.equal(before.width, after.width)
  assert.equal(before.height, after.height)
  await render('[[illu:loading-unmount.png|切换前]]')
  await page.getByRole('button', { name: '切换前' }).hover()
  await popup.getByRole('status').waitFor()
  await render('页面已切换')
  await release('loading-unmount.png')
  await page.waitForTimeout(200)
  assert.equal(await page.locator('#illustration-loading-tests').innerText(), '页面已切换')
  await page.evaluate(() => window.__loadingCleanup())
  await page.setViewportSize({ width: 1280, height: 1000 })
  console.log('Illustration loading passed: cold/warm, delayed metadata, duplicate paths, metadata/body failures, mobile and unmount.')
}
