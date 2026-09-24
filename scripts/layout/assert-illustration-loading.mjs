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
    return route.fulfill({ headers, contentType: 'image/svg+xml', body: name?.startsWith('loading-fail') ? 'invalid image' : svg(...dimensions) })
  })
  await page.evaluate(() => window.__setupLoadingTest())
  const render = content => page.evaluate(content => window.__loadingRender(content), content)
  const waitForImages = (name, count) => page.waitForFunction(({ name, count }) => {
    const images = [...document.querySelectorAll('#illustration-loading-tests .record-media-image img')]
    return images.length === count && images.every(img =>
      img.currentSrc && new URL(img.currentSrc).pathname.endsWith(`/${name}`) && img.complete && img.naturalWidth > 0)
  }, { name, count })
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 })
    const name = `loading-cold-${width}.svg`
    await render(`前[[illu:${name}]][[illu:${name}]]后`)
    const images = page.locator('#illustration-loading-tests .record-media-image img')
    await waitForImages(name, 2)
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
      const name = `loading-${shape}-${width}.svg`
      await render(`前[[illu:${name}]]后`)
      const image = page.locator('#illustration-loading-tests .record-media-image img')
      await waitForImages(name, 1)
      const bounds = await image.evaluate(img => {
        const imageBounds = img.getBoundingClientRect()
        const frame = img.closest('.record-media-image')
        const frameBounds = frame.getBoundingClientRect()
        const parentBounds = img.closest('.record-markup').getBoundingClientRect()
        return {
          width: imageBounds.width,
          height: imageBounds.height,
          parentWidth: parentBounds.width,
          naturalRatio: img.naturalWidth / img.naturalHeight,
          lineHeight: Number.parseFloat(getComputedStyle(img.closest('.record-markup')).lineHeight),
          objectFit: getComputedStyle(img).objectFit,
          edgeGap: Math.max(
            Math.abs(imageBounds.left - frameBounds.left - 1),
            Math.abs(imageBounds.top - frameBounds.top - 1),
            Math.abs(frameBounds.right - imageBounds.right - 1),
            Math.abs(frameBounds.bottom - imageBounds.bottom - 1),
          ),
          frameOverflow: getComputedStyle(frame).overflow,
          imageRadius: getComputedStyle(img).borderRadius,
          triggerRadius: getComputedStyle(img.parentElement).borderRadius,
        }
      })
      assert.ok(bounds.width <= bounds.parentWidth, `${shape} image stays inside text container: ${JSON.stringify(bounds)}`)
      const visibleHeight = Math.min(bounds.height, bounds.width / bounds.naturalRatio)
      const expectedHeight = Math.min(2 * bounds.lineHeight, bounds.parentWidth / bounds.naturalRatio)
      assert.ok(Math.abs(visibleHeight - expectedHeight) < 2, `${shape} image is as tall as its aspect ratio and available width permit: ${JSON.stringify(bounds)}`)
      assert.equal(bounds.objectFit, 'contain', `${shape} image remains uncropped`)
      assert.ok(bounds.edgeGap < 1, `${shape} image touches the frame's inner border: ${JSON.stringify(bounds)}`)
      assert.equal(bounds.frameOverflow, 'hidden')
      assert.equal(bounds.imageRadius, '0px')
      assert.equal(bounds.triggerRadius, '0px')
    }
  }
  await render('[[illu:loading-font.svg]]')
  const fontImage = page.locator('#illustration-loading-tests .record-media-image img')
  await waitForImages('loading-font.svg', 1)
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
  await page.evaluate(() => {
    window.__rememberLoadingDimensions('data/attachments/table-slow.svg', { width: 1600, height: 1200 })
    window.__rememberLoadingDimensions('data/attachments/table-other.svg', { width: 1600, height: 1200 })
  })
  let releaseImage
  const imageReady = new Promise(resolve => { releaseImage = resolve })
  await page.route('**/table-slow.svg*', async route => {
    if (route.request().method() === 'GET' && !route.request().headers().range) await imageReady
    await route.fallback()
  })
  await render('[[table:1x1|[[illu:table-slow.svg]]]]')
  await page.locator('#illustration-loading-tests .record-table-scroll--media .record-media-spinner').waitFor()
  const tableBefore = await page.locator('#illustration-loading-tests .record-table-scroll--media').evaluate(table => ({
    columnWidth: table.querySelector('td[data-media]').getBoundingClientRect().width,
    frameHeight: table.querySelector('.record-media-image').getBoundingClientRect().height,
    tableWidth: table.querySelector('table').getBoundingClientRect().width,
    border: getComputedStyle(table.querySelector('.record-media-image')).border,
    radius: getComputedStyle(table.querySelector('.record-media-image')).borderRadius,
    overflow: getComputedStyle(table.querySelector('.record-media-image')).overflow,
  }))
  assert.ok(tableBefore.columnWidth >= 130, `single-column media gets readable width: ${JSON.stringify(tableBefore)}`)
  assert.notEqual(tableBefore.border, 'none', 'thumbnail border remains visible while loading')
  assert.equal(tableBefore.overflow, 'hidden', 'the outer thumbnail frame clips all loading states')
  releaseImage()
  await page.locator('#illustration-loading-tests .record-media-image-content.is-loaded').waitFor()
  const tableAfter = await page.locator('#illustration-loading-tests .record-table-scroll--media').evaluate(table => ({
    columnWidth: table.querySelector('td[data-media]').getBoundingClientRect().width,
    frameHeight: table.querySelector('.record-media-image').getBoundingClientRect().height,
    tableWidth: table.querySelector('table').getBoundingClientRect().width,
    border: getComputedStyle(table.querySelector('.record-media-image')).border,
    radius: getComputedStyle(table.querySelector('.record-media-image')).borderRadius,
    overflow: getComputedStyle(table.querySelector('.record-media-image')).overflow,
  }))
  for (const key of ['columnWidth', 'frameHeight', 'tableWidth'])
    assert.ok(Math.abs(tableBefore[key] - tableAfter[key]) < 1, `table ${key} stays fixed while preview loads`)
  assert.equal(tableAfter.border, tableBefore.border, 'thumbnail border persists after loading')
  assert.equal(tableAfter.radius, tableBefore.radius, 'thumbnail radius remains fixed while loading')
  await page.setViewportSize({ width: 320, height: 800 })
  await render('[[table:2x3|标题|[[illu:table-slow.svg]]|这是一段很长的文字用于验证文字列仍能换行|第二行|[[illu:table-other.svg]]|结尾]]')
  await page.locator('#illustration-loading-tests .record-table-scroll--media td[data-media]').first().waitFor()
  const mobileTable = await page.locator('#illustration-loading-tests .record-table-scroll--media').evaluate(table => ({
    columnWidth: table.querySelector('td[data-media]').getBoundingClientRect().width,
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    scrollWidth: table.scrollWidth,
    clientWidth: table.clientWidth,
    images: table.querySelectorAll('td[data-media] .record-media-image').length,
  }))
  assert.equal(mobileTable.images, 2)
  assert.ok(mobileTable.columnWidth >= 130, `multi-column image is not compressed: ${JSON.stringify(mobileTable)}`)
  assert.ok(mobileTable.scrollWidth >= mobileTable.clientWidth, 'wide tables may scroll within their own region')
  assert.ok(mobileTable.pageWidth <= mobileTable.viewportWidth, `table must not overflow the page: ${JSON.stringify(mobileTable)}`)
  await page.unroute('**/table-slow.svg*')
  await render('[[illu:loading-fail.svg]]')
  await page.locator('#illustration-loading-tests .record-media-failure').waitFor()
  const failure = await page.locator('#illustration-loading-tests .record-media-image').evaluate(frame => ({
    width: frame.getBoundingClientRect().width,
    height: frame.getBoundingClientRect().height,
    overflow: getComputedStyle(frame).overflow,
    radius: getComputedStyle(frame).borderRadius,
  }))
  assert.ok(failure.width > 60 && failure.height > 20, `failed illustration remains readable: ${JSON.stringify(failure)}`)
  assert.equal(failure.overflow, 'hidden')
  assert.equal(failure.radius, tableAfter.radius)
  await page.evaluate(() => window.__rememberLoadingDimensions('data/attachments/loading-fail-measured.svg', { width: 300, height: 600 }))
  await render('[[illu:loading-fail-measured.svg]]')
  await page.locator('#illustration-loading-tests .record-media-image--measured .record-media-failure').waitFor()
  const measuredFailure = await page.locator('#illustration-loading-tests .record-media-image--measured').evaluate(frame => {
    const bounds = frame.getBoundingClientRect()
    const content = frame.querySelector('.record-media-failure').getBoundingClientRect()
    const lineHeight = Number.parseFloat(getComputedStyle(frame.closest('.record-markup')).lineHeight)
    return { height: bounds.height, contentHeight: content.height, lineHeight }
  })
  assert.ok(Math.abs(measuredFailure.height - (2 * measuredFailure.lineHeight + 2)) < 1, `measured frame keeps its height on failure: ${JSON.stringify(measuredFailure)}`)
  assert.ok(Math.abs(measuredFailure.contentHeight - (measuredFailure.height - 2)) < 1)
  await render('页面已切换')
  assert.equal(await page.locator('#illustration-loading-tests').innerText(), '页面已切换')
  await page.evaluate(() => window.__loadingCleanup())
  await page.setViewportSize({ width: 1280, height: 1000 })
  console.log('Illustration loading passed: thumbnail ratio, shared metadata, failure and mobile.')
}
