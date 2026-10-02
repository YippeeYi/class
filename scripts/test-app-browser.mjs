import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, webkit } from 'playwright'
import { createServer, preview } from 'vite'
import { frontend } from './test-react-helpers.mjs'
import { findSystemChromium } from './layout/browser-runtime.mjs'
import { gameAssetPaths } from './admin-runtime.mjs'
import qbAsset from '../frontend/src/lib/qb-asset.json' with { type: 'json' }

const qbContent = (page) => qbAsset.ready
  ? page.getByRole('img', { name: 'QB', exact: true })
  : page.getByText('图片尚未提供', { exact: true })
const waitQbContent = async (page) => {
  await qbContent(page).waitFor()
  if (qbAsset.ready) await page.waitForFunction(() => {
    const image = document.querySelector('img[alt="QB"]')
    return image?.complete && image.naturalWidth > 0
  })
}

const annotation = '普通注解 [[person:p1|人物一]] [[author:p2|额外记录人]] [[record:r2|跳转记录]] [[material:m1|查看资料]] [[anno:嵌套 [[red:说明]]|注解提示]] [[illu:test.png]] [[latex:\\mathrm{H}_{2}\\mathrm{O}]] [[latex:\\frac{2}{3}]] [[latex:\\xrightarrow[\\text{催化}]{\\text{加热}}]] [[table:2x2|甲|乙|[[under:丙]]|[[del:丁]]]] [[hide:黑幕]] [[center:居中]] [[right:右对齐]]'
const row = (id, hidden, annotation = null) => ({ record_id: id, file_name: `${id}.json`, record_index: Number(id.slice(1)), record_date: '2025-01-01', record_time: '', author: 'p1', content: `正文 ${id} [[person:p1|人物一]] [[quote:q${id}|原话${id}]]`, hidden, attachments: [], importance: 'normal', annotation })
const records = [row('r1', false, annotation), row('r2', false), row('r3', true, '   ')]
const people = ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, name: id === 'p1' ? '人物一' : `人物${id}`, aliases: [], alias: '', role: 'student', subject: '', main: false, bio: '人物简介', avatar_url: '' }))
const tables = {
  class_people: people,
  class_page_messages: [{ page: '01', hidden: false, content: '箴言正文', author: 'p1', annotation: '箴言注解 [[red:[[under:嵌套文字]]]]' }],
  class_page_supplements: [{ page: '01', hidden: false, file_name: '01-01.json', supplement_index: 1, content: '补充正文', author: 'p1', raw: { annotation: `补充注解 ${'长注解。'.repeat(800)}` } }],
  class_materials: [{ id: 'm1', material_id: 'm1', title: '测试资料', content: '资料正文 [[record:r1|来源记录]]', raw: {} }],
  class_record_pages: [{ page: '01', start_file: 'r1.json', end_file: 'r3.json', image_path: 'images/record-pages/01.jpeg', hidden: false, sort_order: 0, raw: {} }],
  class_quiz_questions: [{ id: 'secret', answer: 'a', prompt: '隐藏题', image_path: 'images/quiz/test.png', raw: {} }],
  class_credits_page: { id: 'main', title: '致谢', sections: [], thanks: ['感谢记录者'], original_images: [], raw: {} },
  class_private_assets: { width: 800, height: 600 },
}
tables.class_page_messages.push({ page: '02', hidden: true, content: '隐藏箴言', author: 'p1', annotation: '隐藏箴言注解' })
tables.class_page_supplements.push({ page: '02', hidden: true, file_name: '02-01.json', supplement_index: 1, content: '隐藏补充', author: 'p1', raw: { annotation: '隐藏补充注解' } })
const config = { configFile: path.join(frontend, 'vite.config.ts'), root: frontend, server: { port: 0, host: '127.0.0.1' }, preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }
const vite = process.env.CLASS_RECORD_PREVIEW ? await preview(config) : await createServer(config)
if ('listen' in vite) await vite.listen()
const origin = vite.resolvedUrls.local[0]
const engine = process.env.CLASS_RECORD_BROWSER === 'webkit' ? webkit : chromium
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: await findSystemChromium() } : {}) })
const problems = []
const requests = []
let validAccess = true
let businessVersion = '1'
let businessDelay = 0
let authDelay = 0
let versionDelay = 0
let versionFailure = false
let starRequests = 0
const networkEvents = []
async function contextFor({ admin = false, mobile = false, authenticated = true } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile, reducedMotion: 'reduce' })
  if (authenticated) await context.addInitScript(({ admin }) => {
    if (!location.protocol.startsWith('http')) return
    const now = new Date().toISOString()
    if (localStorage.getItem('classRecord:inviteAccess')) return
    localStorage.setItem('classRecord:inviteAccess', JSON.stringify({ type: 'invite', token: admin ? 'fixture-admin' : 'fixture-normal', authorizedAt: now }))
    localStorage.setItem('classRecord:lastVisitAt', now)
  }, { admin })
  await context.route('https://*.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push(url.pathname)
    if (request.method() !== 'OPTIONS') networkEvents.push({ path: url.pathname, method: request.method(), body: request.postData() || '' })
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }
    const respond = (data) => route.fulfill({ status: 200, headers, body: JSON.stringify(data) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.includes('/rpc/get_class_data_version')) {
      if (versionDelay) await new Promise((resolve) => setTimeout(resolve, versionDelay))
      if (versionFailure) return route.fulfill({ status: 503, headers, body: JSON.stringify({ message: 'fixture unavailable' }) })
      return respond(businessVersion)
    }
    if (url.pathname.includes('/rpc/refresh_invite_access')) {
      if (authDelay) await new Promise((resolve) => setTimeout(resolve, authDelay))
      return respond(validAccess)
    }
    if (url.pathname.includes('/rpc/verify_invite_code')) return respond({ ok: true, accessToken: admin ? 'fixture-admin' : 'fixture-normal' })
    if (url.pathname.includes('/rpc/has_class_record_admin_access')) return respond(admin)
    if (url.pathname.includes('/rpc/get_class_record_order')) return respond(records.filter((r) => !r.hidden || (admin && request.postDataJSON()?.include_hidden)).map((r) => ({ file_name: r.file_name, page: '01' })))
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      if (request.method() === 'POST') return respond({ signedURL: url.pathname.replace('/storage/v1', '') + '?token=test' })
      if (url.pathname.includes('/images/games/merge-qb/')) {
        try {
          const { localPath } = gameAssetPaths({ type: 'game', gameKey: 'merge-qb', file: path.basename(url.pathname) })
          const image = await readFile(path.join(frontend, '..', localPath))
          return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'image/png' }, body: image })
        } catch {
          // Public CI has no ignored private originals; use the SVG fixture below.
        }
      }
      if (url.pathname.endsWith('record-media-dimensions.txt'))
        return respond({ version: 1, dimensions: { 'data/attachments/offscreen-proof.jpg': [300, 600] } })
      return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'image/svg+xml' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#779999"/></svg>' })
    }
    const table = url.pathname.split('/').at(-1)
    if (['class_records', 'class_people', 'class_materials', 'class_record_pages', 'class_page_messages'].includes(table)) {
      const selected = url.searchParams.get('select') || ''
      assert.ok(selected && selected !== '*' && !selected.split(',').includes('raw'), `${table} must request only rendered fields`)
    }
    if (businessDelay && table?.startsWith('class_')) await new Promise((resolve) => setTimeout(resolve, businessDelay))
    if (table === 'class_records') return respond(records.filter((r) => r.hidden === (url.searchParams.get('hidden') === 'eq.true') && (!r.hidden || admin)))
    if ((table === 'class_record_pages' || table === 'class_quiz_questions') && !admin) return respond([])
    if (['class_page_messages', 'class_page_supplements'].includes(table)) return respond(tables[table].filter((r) => r.hidden === (url.searchParams.get('hidden') === 'eq.true') && (!r.hidden || admin)))
    if (table in tables) return respond(tables[table])
    throw new Error(`Unexpected API request ${url.pathname}`)
  })
  await context.route('https://api.github.com/repos/YippeeYi/class', async (route) => {
    starRequests++
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stargazers_count: 17 }) })
  })
  context.on('page', (page) => {
    page.on('pageerror', (error) => problems.push(error.message))
    page.on('console', (msg) => { if (versionFailure && msg.location().url.includes('/rpc/get_class_data_version')) return; if (['error', 'warning'].includes(msg.type())) problems.push(msg.text()) })
  })
  return context
}
async function checkQbColliders(page) {
  const originals = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    const file = `${String(index + 1).padStart(2, '0')}.png`
    try {
      const { localPath } = gameAssetPaths({ type: 'game', gameKey: 'merge-qb', file })
      return (await readFile(path.join(frontend, '..', localPath))).toString('base64')
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }))
  if (originals.every((image) => !image)) return // Private originals are absent in public CI.
  assert.ok(originals.every(Boolean), 'alpha verification requires the complete private image set')
  const measurements = await page.evaluate(async ({ originals, base }) => {
    const { QB_LEVELS } = await import(base + 'src/features/games/merge-qb/levels.ts')
    function distanceField(mask, width, height) {
      const distances = new Float32Array(mask.length).fill(1e6)
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (mask[i]) distances[i] = 0
        else {
          if (x) distances[i] = Math.min(distances[i], distances[i - 1] + 1)
          if (y) distances[i] = Math.min(distances[i], distances[i - width] + 1)
          if (x && y) distances[i] = Math.min(distances[i], distances[i - width - 1] + Math.SQRT2)
          if (x < width - 1 && y) distances[i] = Math.min(distances[i], distances[i - width + 1] + Math.SQRT2)
        }
      }
      for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
        const i = y * width + x
        if (x < width - 1) distances[i] = Math.min(distances[i], distances[i + 1] + 1)
        if (y < height - 1) distances[i] = Math.min(distances[i], distances[i + width] + 1)
        if (x < width - 1 && y < height - 1) distances[i] = Math.min(distances[i], distances[i + width + 1] + Math.SQRT2)
        if (x && y < height - 1) distances[i] = Math.min(distances[i], distances[i + width - 1] + Math.SQRT2)
      }
      return distances
    }
    const results = []
    for (const [index, level] of QB_LEVELS.entries()) {
      const image = new Image()
      image.src = `data:image/png;base64,${originals[index]}`
      await image.decode()
      const width = Math.ceil(level.visualSize.width * 3)
      const height = Math.ceil(level.visualSize.height * 3)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0, width, height)
      const pixels = context.getImageData(0, 0, width, height).data
      const alpha = new Uint8Array(width * height)
      for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3] >= 64 ? 1 : 0
      // Only exterior transparency represents a contact gap; glasses/clothing holes are not cavities.
      const outside = new Uint8Array(alpha.length)
      const queue = []
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x
        if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && !alpha[i]) {
          outside[i] = 1
          queue.push(i)
        }
      }
      for (let i = 0; i < queue.length; i++) {
        const at = queue[i], x = at % width, y = Math.floor(at / width)
        for (const next of [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1]) {
          if (next >= 0 && !alpha[next] && !outside[next]) {
            outside[next] = 1
            queue.push(next)
          }
        }
      }
      context.clearRect(0, 0, width, height)
      context.scale(width, height)
      context.fillStyle = '#000'
      for (const shape of level.collider.shapes) {
        context.beginPath()
        if (shape.type === 'polygon') {
          shape.vertices.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
          context.closePath()
        } else if (shape.type === 'rectangle') context.rect(shape.x - shape.width / 2, shape.y - shape.height / 2, shape.width, shape.height)
        else {
          const radius = shape.radius * Math.min(level.physicsSize.width, level.physicsSize.height)
          context.ellipse(shape.x, shape.y, radius / level.physicsSize.width, radius / level.physicsSize.height, 0, 0, Math.PI * 2)
        }
        context.fill()
      }
      const colliderPixels = context.getImageData(0, 0, width, height).data
      const collider = new Uint8Array(alpha.length)
      for (let i = 0; i < alpha.length; i++) collider[i] = colliderPixels[i * 4 + 3] >= 128 ? 1 : 0
      const toSilhouette = distanceField(outside.map((value) => 1 - value), width, height)
      const toCollider = distanceField(collider, width, height)
      let extra = 0, missing = 0
      for (let i = 0; i < alpha.length; i++) {
        if (collider[i] && outside[i]) extra = Math.max(extra, toSilhouette[i] / 3)
        if (alpha[i] && !collider[i]) missing = Math.max(missing, toCollider[i] / 3)
      }
      results.push({ id: level.id, extra, missing, size: [image.naturalWidth, image.naturalHeight], configuredSize: [level.sourceSize.width, level.sourceSize.height] })
    }
    return results
  }, { originals, base: origin })
  for (const measurement of measurements) {
    assert.deepEqual(measurement.size, measurement.configuredSize, `level ${measurement.id} matches its private original`)
    assert.ok(measurement.extra <= (measurement.id === '11' ? 3.75 : 3), `level ${measurement.id} avoids premature contact in exterior transparency: ${measurement.extra}`)
    assert.ok(measurement.missing <= 1.6, `level ${measurement.id} covers the visible silhouette: ${measurement.missing}`)
  }
  console.log('All 12 QB alpha silhouettes match their calibrated colliders.')
}

async function checkQbPresentation(page) {
  const checks = await page.evaluate(async (base) => {
    const { makeOutlinedSprite, QB_OUTLINE_OFFSETS } = await import(base + 'src/features/games/merge-qb/render.ts')
    const { QB_LEVELS, QB_OUTLINE } = await import(base + 'src/features/games/merge-qb/levels.ts')
    const { themePresets } = await import(base + 'src/components/layout/background-root.tsx')
    const root = document.documentElement
    const originalPreset = root.dataset.themePreset
    const originalClass = root.className
    const source = document.createElement('canvas')
    source.width = source.height = 10
    const sourceContext = source.getContext('2d')
    sourceContext.fillStyle = '#ffffff'
    sourceContext.fillRect(2, 2, 6, 6)
    const image = new Image()
    image.src = source.toDataURL()
    await image.decode()
    const swatch = document.createElement('canvas')
    swatch.width = swatch.height = 1
    const swatchContext = swatch.getContext('2d', { willReadFrequently: true })
    const rgb = color => {
      swatchContext.clearRect(0, 0, 1, 1)
      swatchContext.fillStyle = color
      swatchContext.fillRect(0, 0, 1, 1)
      return [...swatchContext.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const luminance = color => color.map(channel => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const contrast = (first, second) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
    const results = []
    try {
      for (const preset of themePresets) {
        root.dataset.themePreset = preset.id
        root.classList.toggle('dark', preset.mode === 'dark')
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const stage = document.querySelector('.merge-qb-stage')
        await new Promise((resolve, reject) => {
          const deadline = performance.now() + 1000
          const ready = () => {
            const expected = rgb(getComputedStyle(stage).getPropertyValue('--qb-outline-color'))
            const actual = rgb(getComputedStyle(document.querySelector('#merge-qb-image-outline feFlood')).floodColor)
            if (actual.every((channel, index) => channel === expected[index])) return resolve()
            if (performance.now() >= deadline) return reject(new Error(`QB outline did not follow theme ${preset.id}`))
            requestAnimationFrame(ready)
          }
          ready()
        })
        const styles = getComputedStyle(stage)
        const outline = rgb(styles.getPropertyValue('--qb-outline-color'))
        const palette = ['rust', 'ochre', 'teal', 'blue', 'purple'].map(color => rgb(styles.getPropertyValue(`--qb-pop-${color}`)))
        const surface = luminance(rgb(getComputedStyle(document.querySelector('.merge-qb-toolbar')).backgroundColor === 'rgba(0, 0, 0, 0)'
          ? getComputedStyle(root).getPropertyValue('--background') : getComputedStyle(document.querySelector('.merge-qb-toolbar')).backgroundColor))
        const sprites = [1, 2].map(dpr => {
          const sprite = makeOutlinedSprite({ ...QB_LEVELS[0], visualSize: { width: 10, height: 10 } }, image, 1, dpr, styles.getPropertyValue('--qb-outline-color'))
          const context = sprite.canvas.getContext('2d')
          const pixels = context.getImageData(0, 0, sprite.canvas.width, sprite.canvas.height).data
          const edge = ((sprite.padding + 5 * dpr) * sprite.canvas.width + sprite.padding + dpr) * 4
          return { edge: [...pixels.slice(edge, edge + 4)], outer: [...pixels.slice(0, 4)] }
        })
        const images = [...document.querySelectorAll('.merge-qb-next img, .merge-qb-level-icon[data-ready="true"] img')]
        results.push({
          preset: preset.id, dark: preset.mode === 'dark', outline, palette, sprites,
          outlineCss: styles.getPropertyValue('--qb-outline-color'), floodCss: getComputedStyle(document.querySelector('#merge-qb-image-outline feFlood')).floodColor,
          contrast: palette.map(color => contrast(luminance(color), surface)),
          flood: rgb(getComputedStyle(document.querySelector('#merge-qb-image-outline feFlood')).floodColor),
          filters: images.map(image => getComputedStyle(image).filter),
          dimensions: images.map(image => { const rect = image.getBoundingClientRect(); return [rect.width, rect.height] }),
          offsets: [...document.querySelectorAll('#merge-qb-image-outline feOffset')].map(node => [Number(node.getAttribute('dx')), Number(node.getAttribute('dy'))]),
          expectedOffsets: QB_OUTLINE_OFFSETS.map(offset => [offset.x, offset.y]),
          width: QB_OUTLINE.widthCssPx,
          arena: document.querySelector('.merge-qb-arena canvas').toDataURL(),
        })
      }
    } finally {
      if (originalPreset === undefined) delete root.dataset.themePreset
      else root.dataset.themePreset = originalPreset
      root.className = originalClass
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    return results
  }, origin)
  for (const check of checks) {
    assert.equal(new Set(check.palette.map(color => color.join(','))).size, 5, `${check.preset} uses five distinct designed hint colors`)
    assert.ok(check.contrast.every(value => value >= 4.5), `${check.preset} score hints remain readable: ${JSON.stringify(check.contrast)}`)
    assert.deepEqual(check.flood, check.outline, `DOM images and canvas sprites resolve the same theme outline color at ${check.preset}: ${check.outlineCss} / ${check.floodCss}`)
    assert.ok(check.filters.length >= 2 && check.filters.every(filter => filter === check.filters[0] && filter.includes('#merge-qb-image-outline')), 'Next and all visible sequence images share the same alpha outline filter')
    assert.deepEqual(check.offsets, check.expectedOffsets, 'DOM and canvas use the same edge offsets')
    assert.ok(check.offsets.every(([x, y]) => Math.abs(Math.hypot(x, y) - check.width) < 1e-6))
    assert.deepEqual(check.dimensions, checks[0].dimensions, 'theme outlines never change the image layout boxes')
    for (const sprite of check.sprites) {
      assert.ok(sprite.edge[3] > 128 && sprite.edge.slice(0, 3).every((channel, index) => Math.abs(channel - check.outline[index]) <= 3), 'both DPRs render the actual themed outline pixels')
      assert.equal(sprite.outer[3], 0, 'crisp outlines do not add a blurred outer halo')
    }
  }
  const light = checks.find(check => check.preset === 'paper')
  const dark = checks.find(check => check.preset === 'ink')
  assert.notDeepEqual(light.outline, dark.outline)
  assert.notEqual(light.arena, dark.arena, 'switching themes rebuilds the live arena outline, not only the DOM previews')
  console.log('QB themed outlines and five-color hint contrast passed across all presets and both DPRs.')
}

const waitCards = async (page, count) => {
  try {
    await page.waitForFunction((count) => document.querySelectorAll('main .record-surface').length === count, count)
  } catch (error) {
    console.error(await page.locator('body').innerText(), problems)
    throw error
  }
}
const cardKeys = (page) => page.locator('main .record-surface').evaluateAll((cards) => cards.map((card) => card.id))
try {
  const context = await contextFor({ admin: true })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  console.log('Browser ready', origin)
  await page.goto(origin + 'records')
  await waitCards(page, 4)
  console.log('Public records ready')
  assert.equal(await page.getByRole('combobox', { name: '全部年份' }).innerText(), '全部年份')
  assert.equal(await page.getByRole('button', { name: '查看注解', exact: true }).count(), 3)
  await page.getByRole('tab', { name: '正序', exact: true }).click()
  const forward = await cardKeys(page)
  assert.deepEqual(forward, ['record-message-01', 'record-supplement-01-1', 'record-r1', 'record-r2'])
  await page.getByRole('tab', { name: '逆序', exact: true }).click()
  assert.deepEqual(await cardKeys(page), [...forward].reverse())
  const card = page.locator('#record-r1')
  const button = card.getByRole('button', { name: '查看注解' })
  await page.mouse.move(0, 0)
  assert.equal(await button.evaluate((el) => getComputedStyle(el).opacity), '0')
  await card.hover()
  await button.click()
  console.log('Annotation opened')
  const dialog = page.getByRole('dialog', { name: 'r1 · 注解', exact: false })
  await dialog.waitFor()
  assert.deepEqual(
    await dialog.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.animationName, style.transitionProperty]
    }),
    ['none', 'none'],
    'reduced-motion annotation popup has no animations that can delay closing',
  )
  assert.equal(await page.locator('[data-slot="dialog-overlay"]').count(), 0, 'annotation must not mount a modal overlay')
  const annotationBounds = await dialog.boundingBox()
  assert.ok(annotationBounds.x >= 0 && annotationBounds.x + annotationBounds.width <= 1280)
  await button.click()
  await dialog.waitFor({ state: 'hidden' })
  await button.click()
  await dialog.waitFor()
  assert.equal(await dialog.locator('.record-table-scroll').count(), 1)
  assert.equal(await dialog.locator('.person-link').count(), 1)
  await dialog.locator('.record-latex .katex').first().waitFor()
  assert.equal(await dialog.locator('.record-latex .katex').count(), 3)
  await dialog.getByRole('button', { name: '注解提示', exact: true }).hover()
  await page.getByText('嵌套 说明', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: '关闭注解' }).click()
  await dialog.waitFor({ state: 'hidden' })
  await button.focus()
  await page.waitForFunction(() => { const el = document.querySelector('#record-r1 .record-annotation-action'); return el && getComputedStyle(el).opacity === '1' })
  await page.keyboard.press('Enter')
  await dialog.waitFor()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await button.click()
  await dialog.getByRole('button', { name: '查看大图' }).click()
  await page.locator('[data-image-viewer-dialog]').waitFor()
  await page.getByRole('button', { name: '关闭大图' }).click()
  await page.locator('[data-image-viewer-dialog]').waitFor({ state: 'hidden' })
  const nextRecordY = await page.locator('#record-r1').evaluate((element) => element.getBoundingClientRect().top + scrollY)
  await dialog.locator('a.record-link').click()
  await dialog.waitFor({ state: 'hidden' })
  const jumpPanel = page.locator('[data-record-jump-actions]')
  await jumpPanel.waitFor()
  assert.equal(await jumpPanel.evaluate((element) => element.parentElement?.previousElementSibling?.id), 'record-r2', 'jump actions follow the target record')
  assert.equal(await page.locator('[data-slot="alert-dialog-overlay"]').count(), 0, 'jump actions do not add a modal overlay')
  assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '', 'jump actions do not lock page scrolling')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-record-jump-actions]')).opacity === '1')
  const targetBounds = await page.locator('#record-r2').boundingBox()
  const jumpBounds = await jumpPanel.boundingBox()
  assert.ok(jumpBounds.y >= targetBounds.y + targetBounds.height - 1 && Math.abs((jumpBounds.x + jumpBounds.width / 2) - (targetBounds.x + targetBounds.width / 2)) < 2 && jumpBounds.width < targetBounds.width, 'jump actions sit centered directly below the target record')
  assert.ok(await jumpPanel.evaluate((panel) => [...panel.querySelectorAll('button')].every((button) => button.getBoundingClientRect().right <= panel.getBoundingClientRect().right && button.scrollWidth <= button.clientWidth)), 'jump action buttons fit inside the narrower panel')
  assert.ok(Math.abs(await page.locator('#record-r1').evaluate((element) => element.getBoundingClientRect().top + scrollY) - nextRecordY) < 1, 'jump actions do not move following records')
  assert.ok(await jumpPanel.evaluate((element) => Math.abs(element.parentElement.parentElement.getBoundingClientRect().bottom - element.parentElement.previousElementSibling.getBoundingClientRect().bottom) < 1), 'jump actions do not enlarge the record wrapper')
  await page.screenshot({ path: '/tmp/class-record-jump-desktop.png' })
  const lightJumpSurface = await jumpPanel.evaluate((element) => getComputedStyle(element).backgroundColor)
  await page.evaluate(async (base) => {
    const { setThemePreset } = await import(base + 'src/components/layout/background-root.tsx')
    setThemePreset('ink')
  }, origin)
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'ink')
  await jumpPanel.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  assert.notEqual(await jumpPanel.evaluate((element) => getComputedStyle(element).backgroundColor), lightJumpSurface, 'jump actions follow the dark theme surface')
  await page.waitForFunction(() =>
    getComputedStyle(document.querySelector('[data-record-jump-actions]')).color ===
    getComputedStyle(document.body).color,
  )
  await page.screenshot({ path: '/tmp/class-record-jump-dark.png' })
  await page.evaluate(async (base) => {
    const { setThemePreset } = await import(base + 'src/components/layout/background-root.tsx')
    setThemePreset('auto')
  }, origin)
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'auto')
  await jumpPanel.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  await page.evaluate(() => window.scrollBy({ top: -2, behavior: 'instant' }))
  assert.equal(await jumpPanel.count(), 1, 'programmatic scroll does not close jump actions')
  await jumpPanel.getByRole('button', { name: '留在此处' }).click()
  await jumpPanel.waitFor({ state: 'detached' })
  const openJump = async () => {
    await card.hover()
    await button.click()
    await dialog.waitFor()
    await dialog.locator('a.record-link').click()
    await jumpPanel.waitFor()
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openJump()
  await jumpPanel.getByRole('button', { name: '留在此处' }).click()
  assert.equal(await jumpPanel.getAttribute('data-closing'), 'true', 'stay starts the exit animation')
  await jumpPanel.waitFor({ state: 'detached' })
  await openJump()
  await jumpPanel.getByRole('button', { name: '留在此处' }).focus()
  await page.keyboard.press('Escape')
  await jumpPanel.waitFor({ state: 'detached' })
  await page.evaluate(() => { document.body.style.paddingTop = '800px' })
  await openJump()
  assert.ok(await page.evaluate(() => window.scrollY > 0), 'upward scroll scenario starts below the top')
  await page.mouse.move(0, 0)
  await page.mouse.wheel(0, -240)
  await jumpPanel.waitFor({ state: 'detached' })
  await page.evaluate(() => { document.body.style.removeProperty('padding-top'); document.body.style.paddingBottom = '800px' })
  await openJump()
  await page.mouse.move(0, 0)
  await page.mouse.wheel(0, 240)
  await jumpPanel.waitFor({ state: 'detached' })
  await page.evaluate(() => { document.body.style.removeProperty('padding-bottom') })
  await openJump()
  const previousJumpSequence = await jumpPanel.getAttribute('data-jump-sequence')
  await openJump()
  await page.waitForFunction((sequence) => {
    const panel = document.querySelector('[data-record-jump-actions]')
    return panel && panel.getAttribute('data-jump-sequence') !== sequence
  }, previousJumpSequence)
  assert.equal(await jumpPanel.count(), 1, 'consecutive jumps leave one action panel')
  await jumpPanel.getByRole('button', { name: '返回' }).click()
  await jumpPanel.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.id === 'record-r1')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  console.log('Annotation navigation passed')
  await page.locator('#record-r2').focus()
  await page.keyboard.type('qibaishihuaxia')
  await waitCards(page, 7)
  await page.getByRole('tab', { name: '正序', exact: true }).click()
  const allForward = await cardKeys(page)
  assert.deepEqual(allForward, [...forward, 'record-r3', 'record-message-02', 'record-supplement-02-1'])
  assert.equal(await page.getByRole('button', { name: '查看注解', exact: true }).count(), 5)
  await page.getByRole('tab', { name: '书面记录', exact: true }).click()
  await waitCards(page, 5)
  const writtenForward = await cardKeys(page)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await waitCards(page, 2)
  writtenForward.push(...await cardKeys(page))
  assert.deepEqual(writtenForward, allForward)
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await waitCards(page, 4)
  assert.deepEqual(await cardKeys(page), forward)
  assert.equal(await page.evaluate(() => Object.values(sessionStorage).some((value) => /隐藏箴言|隐藏补充|正文 r3/.test(value))), false, 'hidden data must not persist')
  await page.locator('#record-r1').focus()
  await page.keyboard.type('qibaishihuaxia')
  await waitCards(page, 7)
  assert.deepEqual(await cardKeys(page), allForward, 'reentering hidden mode keeps the same unique order')
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await waitCards(page, 4)
  await page.getByLabel('搜索记录正文').fill('箴言')
  await waitCards(page, 1)
  assert.deepEqual(await cardKeys(page), ['record-message-01'])
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await waitCards(page, 4)
  await page.getByRole('combobox', { name: '全部年份' }).click()
  await page.getByRole('option', { name: '2025 年', exact: true }).click()
  await waitCards(page, 2)
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await waitCards(page, 4)
  await page.screenshot({ path: '/tmp/class-release-records.png', fullPage: true })

  for (const route of ['', 'records/', 'qb', 'qb/', 'people', 'person?id=p1', 'quotes', 'timeline', 'backgrounds', 'quiz/', 'materials/', 'map/', 'credits', 'search?q=正文', '404', 'missing']) {
    console.log('Route', route || '/')
    await page.goto(origin + route)
    await page.locator('main').waitFor()
    await page.waitForFunction(() => !document.body.innerText.includes('正在打开档案') && !document.body.innerText.includes('正在准备页面插图') && !document.body.innerText.includes('正在验证访问权限'))
    assert.equal(await page.getByText('页面发生意外错误', { exact: true }).count(), 0, route)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, route)
    if (route === 'timeline') {
      const summary = page.locator('main section.mb-4.grid.gap-3').first()
      const cards = summary.locator(':scope > [data-slot="card"]')
      await cards.first().waitFor()
      assert.equal(await cards.count(), 5)
      for (const width of [1280, 1440, 1024, 390]) {
        await page.setViewportSize({ width, height: 900 })
        const rows = await cards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top))
        assert.equal(rows.slice(0, width >= 1280 ? 5 : width >= 1024 ? 3 : 1).every((top) => Math.abs(top - rows[0]) <= 1), true, `${width}px summary cards use the expected first row`)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}px timeline has no horizontal overflow`)
      }
      await page.setViewportSize({ width: 1280, height: 900 })
    }
  }
  await page.goto(origin + 'search?q=正文')
  await page.locator('#search-record').locator('..').getByRole('link').first().click()
  await page.waitForURL(/\/records(?:#|$)/)
  const externalJumpPanel = page.locator('[data-record-jump-actions]')
  await externalJumpPanel.waitFor()
  await externalJumpPanel.getByRole('button', { name: '返回' }).click()
  await page.waitForURL(/search\?q=/)
  await page.getByRole('textbox', { name: '搜索档案' }).waitFor()
  await context.close()
  {
    const quizContext = await contextFor({ admin: true })
    let releaseDimensions
    const dimensionsGate = new Promise((resolve) => { releaseDimensions = resolve })
    let dimensionRequestStarted
    const dimensionRequest = new Promise((resolve) => { dimensionRequestStarted = resolve })
    let rangeReads = 0
    await quizContext.route('**/storage/v1/object/sign/**', async (route) => {
      const request = route.request()
      if (request.method() !== 'GET' || !request.url().includes('images/quiz/test.png') || !request.headers().range) {
        await route.fallback()
        return
      }
      rangeReads++
      dimensionRequestStarted()
      await dimensionsGate
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'image/svg+xml' },
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"/>',
      })
    })
    const quiz = await quizContext.newPage()
    const adminCheck = quiz.waitForResponse((response) => response.url().includes('/rpc/has_class_record_admin_access'))
    await quiz.goto(origin + 'quiz')
    await adminCheck
    await quiz.locator('.quiz-question-card').waitFor()
    await quiz.keyboard.type('lamian')
    await dimensionRequest
    await quiz.getByText('正在准备隐藏题库与图片尺寸').waitFor()
    const secretFilter = quiz.getByRole('button', { name: '???', exact: true })
    assert.equal(await secretFilter.isDisabled(), true, 'hidden questions stay unavailable while dimensions load')
    assert.equal(await quiz.getByRole('button', { name: '换一题' }).isDisabled(), true, 'question changes stay locked during preparation')
    assert.equal(await quiz.locator('[data-secret-image-frame]').count(), 0, 'hidden images do not render before dimensions exist')
    releaseDimensions()
    await quiz.waitForFunction(() => !document.body.innerText.includes('正在准备隐藏题库与图片尺寸'))
    assert.equal(await secretFilter.isDisabled(), false, 'hidden questions unlock after dimensions are ready')
    assert.deepEqual(await quiz.evaluate(async (base) => {
      const { getImageDimensions } = await import(base + 'src/services/image-metadata.ts')
      return getImageDimensions('images/quiz/test.png')
    }, origin), { width: 800, height: 600 })
    await secretFilter.click()
    for (const label of ['记录人', '记录时间', '人名', '名言']) {
      await quiz.getByRole('button', { name: label, exact: true }).click()
    }
    const imageFrame = quiz.locator('[data-secret-image-frame]')
    await imageFrame.waitFor()
    assert.equal(await quiz.locator('[data-secret-image-dimensions-pending]').count(), 0, 'the hidden image starts with its reserved ratio')
    assert.equal(await imageFrame.evaluate((element) => getComputedStyle(element.closest('button') ?? element).aspectRatio), '800 / 600')
    assert.equal(rangeReads, 1, 'showing a prepared hidden image does not repeat its metadata request')
    await quiz.waitForFunction(() => document.querySelector('[data-secret-image-frame]')?.getAttribute('data-image-ready') === 'true')
    for (const [width, height, viewportWidth] of [[1600, 400, 1280], [400, 1600, 390], [2000, 100, 390]]) {
      await quiz.setViewportSize({ width: viewportWidth, height: 844 })
      await imageFrame.locator('img').evaluate((image, size) => {
        image.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}"/>`
      }, [width, height])
      await quiz.waitForFunction(([expectedWidth, expectedHeight]) => {
        const image = document.querySelector('[data-secret-image-frame] img')
        return image?.complete && image.naturalWidth === expectedWidth && image.naturalHeight === expectedHeight &&
          getComputedStyle(image.closest('button')).aspectRatio === `${expectedWidth} / ${expectedHeight}`
      }, [width, height])
      const geometry = await imageFrame.evaluate((frame) => {
        const bounds = frame.getBoundingClientRect()
        const image = frame.querySelector('img')
        const badge = frame.parentElement.querySelector('.app-media-affordance').getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, badgeY: badge.y, viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, fit: getComputedStyle(image).objectFit }
      })
      assert.ok(geometry.width > 0 && geometry.height > 0, 'hidden image frame must have usable dimensions')
      assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= viewportWidth, 'hidden image frame must fit the viewport')
      assert.ok(geometry.badgeY >= geometry.y + geometry.height, 'large-image control must not cover the image')
      assert.equal(geometry.fit, 'contain', 'hidden images preserve their full extent')
      assert.ok(geometry.documentWidth <= viewportWidth, 'hidden images must not add horizontal page overflow')
    }
    await quizContext.close()
    const ordinaryContext = await contextFor()
    const ordinaryQuiz = await ordinaryContext.newPage()
    const ordinaryCheck = ordinaryQuiz.waitForResponse((response) => response.url().includes('/rpc/has_class_record_admin_access'))
    const hiddenReadsBefore = networkEvents.filter((event) => event.path.endsWith('/class_quiz_questions')).length
    await ordinaryQuiz.goto(origin + 'quiz')
    await ordinaryCheck
    await ordinaryQuiz.locator('.quiz-question-card').waitFor()
    await ordinaryQuiz.keyboard.type('lamian')
    assert.equal(await ordinaryQuiz.getByRole('button', { name: '???', exact: true }).count(), 0, 'ordinary visitors cannot unlock hidden questions')
    assert.equal(networkEvents.filter((event) => event.path.endsWith('/class_quiz_questions')).length, hiddenReadsBefore, 'ordinary visitors do not request hidden questions')
    await ordinaryQuiz.getByRole('button', { name: '填空题' }).click()
    await ordinaryQuiz.getByRole('button', { name: '判断题' }).click()
    await ordinaryQuiz.evaluate(() => document.activeElement?.blur())
    await ordinaryQuiz.keyboard.press('Enter')
    assert.equal(await ordinaryQuiz.locator('.quiz-question-card').getAttribute('data-answer-result'), 'pending', 'Enter does nothing before an answer')
    for (let index = 0; index < 3; index++) {
      await ordinaryQuiz.locator('.quiz-option').first().click()
      assert.notEqual(await ordinaryQuiz.locator('.quiz-question-card').getAttribute('data-answer-result'), 'pending')
      assert.equal(await ordinaryQuiz.locator('.quiz-feedback-slot [data-slot="alert"]').count(), 0, 'answer feedback must not mount a nested alert card')
      const spacing = await ordinaryQuiz.locator('.quiz-feedback-slot').evaluate((slot) => {
        const feedback = slot.querySelector('.quiz-result-feedback').getBoundingClientRect()
        const icon = slot.querySelector('.quiz-result-icon').getBoundingClientRect()
        const bounds = slot.getBoundingClientRect()
        const button = slot.parentElement.querySelector('button').getBoundingClientRect()
        return {
          top: feedback.top - bounds.top,
          bottom: bounds.bottom - feedback.bottom,
          iconCenters: Math.abs((icon.top + icon.bottom) / 2 - (feedback.top + feedback.bottom) / 2),
          buttonCenters: Math.abs((button.top + button.bottom) / 2 - (bounds.top + bounds.bottom) / 2),
        }
      })
      assert.ok(Math.abs(spacing.top - spacing.bottom) <= 1, 'answer feedback has balanced vertical space')
      assert.ok(spacing.iconCenters <= 1, 'answer icon is vertically centered in its feedback box')
      assert.ok(spacing.buttonCenters <= 1, 'next button aligns with the feedback slot')
      if (index === 0) {
        await ordinaryQuiz.evaluate(() => {
          const input = document.createElement('input')
          input.id = 'quiz-keyboard-proof'
          document.body.append(input)
          input.focus()
        })
        await ordinaryQuiz.keyboard.press('Enter')
        assert.notEqual(await ordinaryQuiz.locator('.quiz-question-card').getAttribute('data-answer-result'), 'pending', 'focused input retains Enter')
        await ordinaryQuiz.evaluate(() => document.getElementById('quiz-keyboard-proof').remove())
      }
      if (index === 1) {
        await ordinaryQuiz.getByRole('button', { name: '下一题' }).focus()
      } else {
        await ordinaryQuiz.evaluate(() => document.activeElement?.blur())
      }
      await ordinaryQuiz.keyboard.press('Enter')
      assert.equal(await ordinaryQuiz.locator('.quiz-question-card').getAttribute('data-answer-result'), 'pending', 'Enter advances exactly one question')
    }
    await ordinaryContext.close()
  }
  const mobile = await contextFor({ mobile: true })
  const touch = await mobile.newPage()
  await touch.goto(origin + 'records')
  await waitCards(touch, 4)
  const annotationButton = touch.locator('#record-supplement-01-1').getByRole('button', { name: '查看注解' })
  assert.equal(await annotationButton.evaluate((el) => getComputedStyle(el).opacity), '1')
  await annotationButton.tap()
  const longDialog = touch.getByRole('dialog')
  await longDialog.waitFor()
  const bounds = await longDialog.boundingBox()
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844, 'long annotation fits mobile viewport')
  const scroll = longDialog.locator('[data-slot="scroll-area-viewport"]')
  assert.equal(await scroll.evaluate((el) => { el.scrollTop = 200; return el.scrollTop > 0 }), true)
  await touch.screenshot({ path: '/tmp/class-release-annotation-mobile.png' })
  await touch.getByRole('button', { name: '关闭注解' }).tap()
  await longDialog.waitFor({ state: 'hidden' })
  await annotationButton.tap()
  await longDialog.waitFor()
  await touch.touchscreen.tap(4, 4)
  await longDialog.waitFor({ state: 'hidden' })
  await touch.locator('#record-r1').getByRole('button', { name: '查看注解' }).tap()
  const mobileReference = touch.getByRole('dialog', { name: 'r1 · 注解', exact: false })
  await mobileReference.locator('a.record-link').tap()
  const mobileJumpPanel = touch.locator('[data-record-jump-actions]')
  await mobileJumpPanel.waitFor()
  const mobileJumpBounds = await mobileJumpPanel.boundingBox()
  assert.ok(mobileJumpBounds.x >= 0 && mobileJumpBounds.x + mobileJumpBounds.width <= 390, 'jump actions fit the mobile viewport')
  const mobileTargetBounds = await touch.locator('#record-r1').boundingBox()
  assert.ok(Math.abs((mobileJumpBounds.x + mobileJumpBounds.width / 2) - (mobileTargetBounds.x + mobileTargetBounds.width / 2)) < 2, 'mobile jump actions center on their target record')
  assert.ok(await mobileJumpPanel.evaluate((panel) => [...panel.querySelectorAll('button')].every((button) => button.getBoundingClientRect().right <= panel.getBoundingClientRect().right && button.scrollWidth <= button.clientWidth)), 'mobile jump action buttons remain readable and inside the panel')
  assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'mobile jump actions do not overflow')
  await touch.screenshot({ path: '/tmp/class-record-jump-mobile.png' })
  await touch.setViewportSize({ width: 320, height: 844 })
  assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'jump actions fit a narrow phone')
  await touch.setViewportSize({ width: 390, height: 844 })
  if (engine === chromium) {
    await touch.evaluate(() => { document.body.style.paddingBottom = '800px' })
    const cdp = await mobile.newCDPSession(touch)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 700 }] })
    for (const y of [600, 500, 400, 300])
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await mobileJumpPanel.waitFor({ state: 'detached' })
    await touch.evaluate(() => { document.body.style.removeProperty('padding-bottom') })
  } else {
    await mobileJumpPanel.getByRole('button', { name: '留在此处' }).tap()
    await mobileJumpPanel.waitFor({ state: 'detached' })
  }
  await touch.locator('[data-slot="sidebar-trigger"]').click()
  await touch.locator('[data-mobile="true"] a[href$="/people"]').click()
  await touch.waitForURL(/people$/)
  await touch.locator('[data-mobile="true"]').waitFor({ state: 'hidden' })
  await touch.goto(origin + 'records')
  await waitCards(touch, 4)
  await touch.locator('#record-r1').focus()
  await touch.keyboard.type('qibaishihuaxia')
  assert.equal(await touch.locator('#record-r3').count(), 0, 'normal session cannot unlock hidden records')
  for (const route of ['', 'qb', 'people', 'person?id=p1', 'quotes', 'timeline', 'backgrounds', 'quiz/', 'games/', 'games/merge-qb/', 'materials/', 'map/', 'credits', 'search?q=正文', 'missing']) {
    await touch.goto(origin + route)
    await touch.locator('main').waitFor()
    await touch.waitForFunction(() => !document.body.innerText.includes('正在打开档案') && !document.body.innerText.includes('正在准备页面插图') && !document.body.innerText.includes('正在验证访问权限'))
    assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `mobile ${route}`)
  }
  assert.notEqual(await touch.locator('main').evaluate((main) => getComputedStyle(main).userSelect), 'none', 'other pages retain text selection')
  await touch.goto(origin + 'games')
  await touch.getByRole('link', { name: '合成大QB' }).tap()
  await touch.waitForURL(/games\/merge-qb\/?$/)
  const touchBoard = touch.getByRole('button', { name: /合成大QB游戏区域/ })
  await touchBoard.waitFor()
  await touch.locator('.merge-qb-next img').waitFor()
  const fitsMobileGame = async (size) => {
    // Viewport emulation updates container/viewport units across resize frames.
    await touch.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const geometry = await touch.evaluate(() => {
      const arena = document.querySelector('.merge-qb-arena').getBoundingClientRect()
      const toolbarElement = document.querySelector('.merge-qb-toolbar')
      const toolbar = toolbarElement.getBoundingClientRect()
      const main = document.querySelector('main')
      const title = toolbarElement.querySelector('.merge-qb-title').getBoundingClientRect()
      const restart = toolbarElement.querySelector('.merge-qb-actions button[aria-label="重新开始"]')?.getBoundingClientRect()
      const score = toolbarElement.querySelector('.merge-qb-score').getBoundingClientRect()
      const next = toolbarElement.querySelector('.merge-qb-next').getBoundingClientRect()
      return { arena: [arena.top, arena.bottom, arena.width, arena.height, arena.left, arena.right], toolbar: [toolbar.top, toolbar.bottom], viewport: [innerWidth, innerHeight], scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], overflow: getComputedStyle(main).overflowY, controls: [title.right, restart?.left, restart?.right, score.left, score.right, next.left] }
    })
    assert.ok(geometry.toolbar[1] < geometry.arena[0] && geometry.arena[1] <= geometry.viewport[1] + 1 && geometry.scroll[1] <= geometry.viewport[1] + 1 && geometry.scroll[0] <= geometry.viewport[0] + 1 && geometry.overflow === 'hidden' && Math.abs(geometry.arena[2] / geometry.arena[3] - 360 / 560) < 0.01, `mobile game fits without scrolling at ${size}: ${JSON.stringify(geometry)}`)
    assert.ok(geometry.arena[4] >= 8 && geometry.viewport[0] - geometry.arena[5] >= 8 && Math.abs(geometry.arena[4] - (geometry.viewport[0] - geometry.arena[5])) < 2, `mobile arena has symmetric side space at ${size}: ${JSON.stringify(geometry)}`)
    assert.ok(geometry.controls[0] <= geometry.controls[1] && geometry.controls[2] <= geometry.controls[3] && geometry.controls[5] - geometry.controls[4] >= 8, `mobile title, restart, score and next remain separated at ${size}: ${JSON.stringify(geometry)}`)
  }
  await fitsMobileGame('390×844')
  for (const width of [320, 375, 390, 430]) {
    for (const height of [568, 844]) {
      await touch.setViewportSize({ width, height })
      await touch.waitForTimeout(100)
      await fitsMobileGame(`${width}×${height}`)
      assert.ok(await touch.locator('.merge-qb-toolbar').evaluate((toolbar) => {
        const style = getComputedStyle(toolbar)
        const elements = [...toolbar.querySelectorAll('a, button, h1, .merge-qb-score > span, .merge-qb-next > span, .merge-qb-next-preview')]
          .filter((element) => element.getBoundingClientRect().width > 0)
        const centre = (rect) => (rect.top + rect.bottom) / 2
        const bar = toolbar.getBoundingClientRect()
        return style.flexWrap === 'nowrap' && elements.every((element) => {
          const rect = element.getBoundingClientRect()
          return Math.abs(centre(rect) - centre(bar)) < 2 && getComputedStyle(element).whiteSpace === 'nowrap' && rect.left >= bar.left && rect.right <= bar.right
        }) && parseFloat(style.paddingTop) === 12 && parseFloat(style.paddingBottom) === 12
      }), 'mobile toolbar controls and both label/value pairs remain centred on one line')
      assert.equal(await touch.locator('.merge-qb-title').evaluate((node) => {
        const style = getComputedStyle(node)
        return style.userSelect || style.getPropertyValue('-webkit-user-select')
      }), 'none')
      assert.ok(await touch.locator('.merge-qb-stage img').evaluateAll((images) => images.every((image) => !image.draggable)))
      assert.ok(await touch.locator('.merge-qb-mobile-restart').evaluate((button) =>
        button.getBoundingClientRect().width >= 40 && button.getBoundingClientRect().height === 32),
        'responsive restart preserves a usable button area and its existing height')
    }
  }
  await touch.setViewportSize({ width: 390, height: 844 })
  await touch.waitForTimeout(100)
  assert.equal(await touch.locator('.app-topbar').isVisible(), false, 'mobile game uses only its own top bar')
  assert.ok(await touch.locator('.merge-qb-toolbar').evaluate((toolbar) => toolbar.getBoundingClientRect().top < 1), 'mobile game toolbar starts at the top of the viewport')
  assert.equal(await touch.getByRole('button', { name: '重新开始' }).isVisible(), true)
  assert.equal(await touch.getByRole('button', { name: '全屏游玩' }).count(), 0, 'mobile game hides its fullscreen button')
  assert.equal(await touch.getByRole('button', { name: '进入全屏' }).count(), 0, 'mobile game hides the shell fullscreen button')
  assert.ok(await touch.evaluate(() => document.querySelector('.merge-qb-score').getBoundingClientRect().right <= document.querySelector('.merge-qb-next').getBoundingClientRect().left), 'mobile score precedes the next preview in one row')
  assert.equal(await touch.locator('.merge-qb-sequence').isVisible(), false, 'mobile size sequence takes no space')
  await touch.screenshot({ path: '/tmp/class-merge-qb-mobile.png', fullPage: true })
  assert.equal(await touch.getByRole('button', { name: '放下当前 QB' }).count(), 0)
  await touchBoard.tap()
  await touch.waitForTimeout(600)
  await touchBoard.tap()
  await touch.waitForFunction(() => document.querySelector('.merge-qb-score strong')?.textContent === '3')
  await touch.getByRole('button', { name: '重新开始' }).tap()
  await touch.getByRole('alertdialog').waitFor()
  assert.equal(await touch.locator('.merge-qb-score strong').innerText(), '3', 'opening restart confirmation preserves the score')
  await touch.getByRole('button', { name: '取消' }).tap()
  assert.equal(await touch.locator('.merge-qb-score strong').innerText(), '3', 'canceling restart preserves the game')
  await touch.getByRole('button', { name: '重新开始' }).tap()
  await touch.getByRole('alertdialog').getByRole('button', { name: '重新开始' }).tap()
  assert.equal(await touch.locator('.merge-qb-score strong').innerText(), '0', 'mobile restart uses the existing reset path')
  await touch.setViewportSize({ width: 320, height: 844 })
  assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'game fits a narrow phone')
  await fitsMobileGame('320×844')
  await touch.evaluate(async (base) => {
    const { MergeQbGame } = await import(base + 'src/features/games/merge-qb/game.ts')
    const step = MergeQbGame.prototype.step
    MergeQbGame.prototype.step = function () {
      window.__mobileMergeGame = this
      step.call(this)
    }
  }, origin)
  await touch.waitForFunction(() => window.__mobileMergeGame)
  await touch.evaluate(() => document.fonts.ready)
  for (const width of [280, 320, 375, 390, 430]) {
    await touch.setViewportSize({ width, height: 844 })
    await touch.waitForTimeout(100)
    let stableLayout
    for (const score of [0, 9, 99, 999, 9999, 99999]) {
      await touch.evaluate((score) => { window.__mobileMergeGame.score = score; window.__mobileMergeGame.publish() }, score)
      await touch.waitForFunction((score) => document.querySelector('.merge-qb-score strong')?.textContent === String(score), score)
      await fitsMobileGame(`${width}×844 score ${score}`)
      assert.ok(await touch.locator('.merge-qb-score-value').evaluate(value =>
        Math.abs(value.querySelector('strong').getBoundingClientRect().left - value.getBoundingClientRect().left) < 0.1),
        'one to five digits stay left aligned within the reserved number slot')
      const layout = await touch.evaluate(() => ['.merge-qb-actions', '.merge-qb-score', '.merge-qb-next', '.merge-qb-arena'].map((selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return [rect.left, rect.top, rect.width, rect.height]
      }))
      if (stableLayout) assert.deepEqual(layout, stableLayout, 'one to five digits do not move the controls or resize the arena')
      stableLayout = layout
    }
    const numberSlot = await touch.locator('.merge-qb-score-value').evaluate((value) => {
      const digits = value.querySelector('strong')
      return {
        reservedWidth: value.getBoundingClientRect().width,
        digitsWidth: digits.getBoundingClientRect().width,
        slotWeight: getComputedStyle(value).fontWeight,
        digitsWeight: getComputedStyle(digits).fontWeight,
        tabular: getComputedStyle(value).fontVariantNumeric.includes('tabular-nums'),
      }
    })
    assert.ok(numberSlot.reservedWidth >= numberSlot.digitsWidth && numberSlot.tabular,
      `the number slot reserves at least five complete tabular digits at ${width}px: ${JSON.stringify(numberSlot)}`)
    for (let index = 0; index < 5; index++) {
      await touch.evaluate(async ({ index, base }) => {
        const { QB_LEVELS } = await import(base + 'src/features/games/merge-qb/levels.ts')
        window.__mobileMergeGame.next = QB_LEVELS[index]
        window.__mobileMergeGame.publish()
      }, { index, base: origin })
      await touch.waitForFunction((index) => {
        const image = document.querySelector('.merge-qb-next img')
        return image?.alt === ['一级 QB', '二级 QB', '三级 QB', '四级 QB', '五级 QB'][index] && image.complete && image.naturalWidth > 0
      }, index)
      assert.ok(await touch.locator('.merge-qb-next img').evaluate((image) => {
        const rect = image.getBoundingClientRect()
        return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight) < 0.01
      }), 'each mobile Next image preserves the source aspect ratio')
      await fitsMobileGame(`${width}×844 next level ${index + 1}`)
    }
    await touch.evaluate(() => { window.__mobileMergeGame.danger = 'game-over'; window.__mobileMergeGame.publish() })
    await touch.locator('.merge-qb-game-over-label').waitFor()
    await fitsMobileGame(`${width}×844 game over with five digits`)
    await touch.evaluate(() => { window.__mobileMergeGame.danger = 'normal'; window.__mobileMergeGame.publish() })
  }
  await touch.setViewportSize({ width: 320, height: 844 })
  await touch.evaluate(() => {
    window.__mobileMergeGame.score = 123456
    window.__mobileMergeGame.publish()
  })
  await fitsMobileGame('320×844 with long score')
  await touch.getByRole('button', { name: '重新开始' }).tap()
  await touch.getByRole('alertdialog').getByRole('button', { name: '重新开始' }).tap()
  assert.ok(Number(await touch.locator('.merge-qb-toolbar strong[aria-live="polite"]').innerText()) >= 0)
  await touch.setViewportSize({ width: 320, height: 568 })
  await touch.waitForTimeout(100)
  await fitsMobileGame('320×568')
  await touch.setViewportSize({ width: 390, height: 568 })
  await touch.waitForTimeout(100)
  await fitsMobileGame('390×568')
  await touch.screenshot({ path: '/tmp/class-merge-qb-mobile-short.png' })
  await touch.evaluate(() => {
    window.__mobileMergeGame.danger = 'game-over'
    window.__mobileMergeGame.publish()
  })
  const mobileGameOver = touch.locator('.merge-qb-game-over-label')
  await mobileGameOver.waitFor()
  await fitsMobileGame('390×568 game over')
  assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'mobile game over title does not overflow')
  assert.ok(await touch.evaluate(() => {
    const title = document.querySelector('.merge-qb-game-over-label').getBoundingClientRect()
    const share = document.querySelector('.merge-qb-share-mobile').getBoundingClientRect()
    return share.left >= title.right && Math.abs((share.top + share.bottom - title.top - title.bottom) / 2) < 2
  }), 'mobile share icon sits beside the game-over title')
  await touch.screenshot({ path: '/tmp/class-merge-qb-game-over-mobile.png' })
  await touch.getByRole('button', { name: '分享游戏结果' }).tap()
  await touch.getByRole('dialog', { name: '分享本局结果' }).waitFor()
  await touch.locator('.merge-qb-share-preview').waitFor()
  await touch.waitForFunction(() => document.querySelector('.merge-qb-share-preview')?.naturalWidth > 0)
  assert.deepEqual(await touch.locator('.merge-qb-share-preview').evaluate((img) => [img.naturalWidth, img.naturalHeight]), [1080, 1900], 'share preview is a separate high-resolution game image')
  await touch.getByRole('dialog', { name: '分享本局结果' }).getByRole('button', { name: '取消' }).tap()
  await mobileGameOver.tap()
  await touch.getByRole('alertdialog').waitFor()
  assert.equal(await touch.locator('.merge-qb-arena').isDisabled(), true, 'replay confirmation does not restart prematurely')
  await touch.getByRole('alertdialog').getByRole('button', { name: '再来一局' }).tap()
  assert.equal(await touchBoard.isDisabled(), false, 'mobile game over restart restores play')
  await touch.getByRole('button', { name: '返回游戏库' }).tap()
  await touch.getByRole('alertdialog').getByRole('button', { name: '取消' }).tap()
  assert.match(touch.url(), /games\/merge-qb\/?$/, 'canceling exit stays in the game')
  await touch.getByRole('button', { name: '返回游戏库' }).tap()
  await touch.getByRole('alertdialog').getByRole('button', { name: '退出游戏' }).tap()
  await touch.waitForURL(/games\/?$/)
  await mobile.close()
  {
    const gameContext = await contextFor()
    await gameContext.addInitScript(() => { Math.random = () => 0 })
    const gamePage = await gameContext.newPage()
    await gamePage.goto(origin + 'records')
    await waitCards(gamePage, 4)
    await gamePage.locator('.app-sidebar-navigation a[href$="/games"]').click()
    await gamePage.waitForURL(/games\/?$/)
    const gameCard = gamePage.getByRole('link', { name: '合成大QB', exact: true })
    assert.equal(await gameCard.locator('[data-slot="card-title"]').innerText(), '合成大QB')
    assert.equal(await gameCard.locator('[data-slot="card-description"], [data-slot="card-content"]').count(), 0)
    assert.equal(await gamePage.getByText('选一个小游戏，随时开始。').count(), 0)
    assert.ok(await gameCard.evaluate((link) => {
      const icon = link.querySelector('[data-slot="card-header"] svg').getBoundingClientRect()
      const title = link.querySelector('[data-slot="card-title"]').getBoundingClientRect()
      const bounds = link.getBoundingClientRect()
      return title.left > icon.right && title.right <= bounds.right && bounds.width >= 150 && bounds.width < 200
    }), 'compact game entry places its name beside the icon')
    const idleCardColor = await gameCard.locator('[data-slot="card"]').evaluate((card) => getComputedStyle(card).backgroundColor)
    await gameCard.hover()
    if (await gamePage.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches))
      await gamePage.waitForFunction((idle) => {
        const card = document.querySelector('a.app-interactive-card [data-slot="card"]')
        return card && getComputedStyle(card).backgroundColor !== idle
      }, idleCardColor)
    await gamePage.keyboard.press('Tab')
    await gameCard.focus()
    await gamePage.waitForFunction(() => {
      const link = document.querySelector('a.app-interactive-card')
      return link && getComputedStyle(link).boxShadow !== 'none'
    })
    await gamePage.screenshot({ path: '/tmp/class-merge-qb-game-list.png' })
    const firstImageRoute = '**/storage/v1/object/sign/**/images/games/merge-qb/01.png*'
    let releaseFirstImage
    const firstImageGate = new Promise(resolve => { releaseFirstImage = resolve })
    await gameContext.route(firstImageRoute, async route => {
      if (route.request().method() !== 'GET') return route.fallback()
      await firstImageGate
      return route.fallback()
    })
    await gamePage.keyboard.press('Enter')
    await gamePage.waitForURL(/games\/merge-qb\/?$/)
    const gameLevels = (await vite.ssrLoadModule('/src/features/games/merge-qb/levels.ts')).QB_LEVELS
    const board = gamePage.getByRole('button', { name: /合成大QB游戏区域/ })
    await board.waitFor()
    const firstIcon = gamePage.locator('.merge-qb-level[data-level-id="01"] .merge-qb-level-icon')
    await firstIcon.waitFor()
    await gamePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.ok(await firstIcon.locator('.merge-qb-locked').evaluate(placeholder => {
      const style = getComputedStyle(placeholder)
      const bounds = placeholder.getBoundingClientRect()
      return placeholder.textContent.trim() === '?' && style.borderTopStyle === 'dashed' &&
        style.borderRadius === '50%' && bounds.width === 36 && bounds.height === 36 &&
        style.visibility === 'visible' && style.opacity === '1'
    }), 'even the known first QB keeps the dashed question mark until its image loads')
    assert.equal(await firstIcon.locator('img').count(), 0, 'pending private images never render a blank or broken img')
    assert.match(await gamePage.locator('.merge-qb-level[data-level-id="01"]').getAttribute('aria-label'), /一级 QB/)
    const firstIconBeforeLoad = await firstIcon.boundingBox()
    releaseFirstImage()
    await gamePage.waitForFunction(() => document.querySelector('.merge-qb-level:first-child .merge-qb-level-icon')?.dataset.ready === 'true')
    await firstIcon.locator('.merge-qb-locked').waitFor({ state: 'hidden' })
    assert.deepEqual(await firstIcon.boundingBox(), firstIconBeforeLoad, 'loading the first QB preserves its complete slot geometry')
    await gameContext.unroute(firstImageRoute)
    assert.equal(await gamePage.locator('.merge-qb-level img').count(), 1, 'only level one is revealed at the start')
    assert.equal(await gamePage.locator('.merge-qb-sequence .merge-qb-level-icon:not([data-ready="true"]) .merge-qb-locked').count(), 10)
    assert.equal(await gamePage.locator('.merge-qb-sequence .merge-qb-level-icon:not([data-ready="true"]) .merge-qb-locked').first().innerText(), '?')
    assert.match(await gamePage.locator('.merge-qb-next img').getAttribute('src'), /^blob:/)
    if (!process.env.CLASS_RECORD_PREVIEW) {
      await checkQbColliders(gamePage)
      await checkQbPresentation(gamePage)
    }
    await gamePage.emulateMedia({ reducedMotion: 'no-preference' })
    const warningLine = board.locator('.merge-qb-warning-line')
    assert.equal(await warningLine.count(), 1, 'one warning line is always present')
    const normalLineColor = await warningLine.evaluate((line) => getComputedStyle(line).borderTopColor)
    await board.evaluate((arena) => { arena.dataset.danger = 'near' })
    assert.notEqual(await warningLine.evaluate((line) => getComputedStyle(line).borderTopColor), normalLineColor, 'the original line turns red near danger')
    assert.notEqual(await warningLine.evaluate((line) => getComputedStyle(line).animationName), 'none', 'near danger animates the line')
    await board.evaluate((arena) => { arena.dataset.danger = 'pending' })
    assert.notEqual(await warningLine.evaluate((line) => getComputedStyle(line).animationName), 'none', 'the pending period keeps warning on the original line')
    assert.equal(await board.evaluate((arena) => getComputedStyle(arena).animationName), 'none', 'the arena does not flash before the countdown')
    await board.evaluate((arena) => { arena.dataset.danger = 'countdown' })
    assert.notEqual(await board.evaluate((arena) => getComputedStyle(arena).animationName), 'none', 'countdown animates the arena')
    assert.equal(await warningLine.evaluate((line) => getComputedStyle(line).animationName), 'none', 'countdown does not add a second line animation')
    await board.evaluate((arena) => { arena.dataset.danger = 'normal' })
    assert.equal(await board.evaluate((arena) => getComputedStyle(arena).animationName), 'none', 'danger animation clears when safe')
    assert.equal(await warningLine.evaluate((line) => getComputedStyle(line).borderTopColor), normalLineColor)
    await gamePage.emulateMedia({ reducedMotion: 'reduce' })
    const score = gamePage.locator('.merge-qb-toolbar strong[aria-live="polite"]')
    const fitGame = async (height) => {
      await gamePage.waitForFunction(
        (viewport) => innerWidth === viewport.width && innerHeight === viewport.height,
        gamePage.viewportSize(),
      )
      await gamePage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await gamePage.waitForFunction(
        (height) => document.querySelector('.merge-qb-arena')?.getBoundingClientRect().bottom <= height + 1,
        height,
      )
      await gamePage.waitForFunction((expected) => {
        const canvas = document.querySelector('.merge-qb-arena canvas')
        const preview = document.querySelector('.merge-qb-next img')
        return canvas && preview && Math.abs(preview.getBoundingClientRect().width - canvas.getBoundingClientRect().width * expected / 360) < 1
      }, gameLevels[0].visualSize.width)
      const geometry = await gamePage.evaluate((firstVisualWidth) => {
        const arena = document.querySelector('.merge-qb-arena').getBoundingClientRect()
        const canvas = document.querySelector('.merge-qb-arena canvas').getBoundingClientRect()
        const sequence = document.querySelector('.merge-qb-sequence').getBoundingClientRect()
        const sidebar = document.querySelector('.merge-qb-toolbar').getBoundingClientRect()
        const actions = document.querySelector('.merge-qb-actions').getBoundingClientRect()
        const nextBox = document.querySelector('.merge-qb-next').getBoundingClientRect()
        const scoreBox = document.querySelector('.merge-qb-score').getBoundingClientRect()
        const main = document.querySelector('main').getBoundingClientRect()
        const scoreLabel = document.querySelector('.merge-qb-score span').getBoundingClientRect()
        const nextLabel = document.querySelector('.merge-qb-next span').getBoundingClientRect()
        const scoreValue = document.querySelector('.merge-qb-score strong').getBoundingClientRect()
        const nextPreview = document.querySelector('.merge-qb-next img').getBoundingClientRect()
        const levels = [...document.querySelectorAll('.merge-qb-level')].map((node) => node.getBoundingClientRect())
        const controls = ['返回游戏库', '重新开始', '全屏游玩'].map((name) => [...document.querySelectorAll(`[aria-label="${name}"]`)].map((node) => node.getBoundingClientRect()).find((rect) => rect.width > 0)).filter(Boolean)
        return {
          bottom: Math.max(arena.bottom, sequence.bottom),
          ratio: arena.width / arena.height,
          sidebarRightOfArena: sidebar.left >= arena.right,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          groupCenterOffset: Math.abs((arena.left + sidebar.right - main.left - main.right) / 2),
          gap: sidebar.left - arena.right,
          topOffset: Math.abs(sidebar.top - arena.top),
          bottomOffset: Math.abs(sidebar.bottom - arena.bottom),
          sectionOrder: actions.bottom < nextBox.top && nextBox.bottom < scoreBox.top && scoreBox.bottom < sequence.top,
          centerOffsets: [scoreLabel, nextLabel, scoreValue, nextPreview, sequence].map((rect) => Math.abs((rect.left + rect.right - sidebar.left - sidebar.right) / 2)),
          nextSizeError: Math.abs(nextPreview.width - canvas.width * firstVisualWidth / 360),
          nodeSizes: levels.map((rect) => [rect.width, rect.height]),
          controlSizes: controls.map((rect) => rect && [rect.width, rect.height]),
        }
      }, gameLevels[0].visualSize.width)
      assert.ok(geometry.bottom <= height + 1, `game is fully visible at ${height}px viewport height: ${JSON.stringify(geometry)}`)
      assert.ok(Math.abs(geometry.ratio - 360 / 560) < 0.01, 'render scale keeps the physics aspect ratio')
      assert.equal(geometry.sidebarRightOfArena, true, 'desktop status stays beside the game arena')
      assert.equal(geometry.overflow, false)
      assert.ok(geometry.groupCenterOffset < 2, `the arena and sidebar center together: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.gap >= 10 && geometry.gap <= 16, 'desktop arena and controls stay closely grouped')
      assert.ok(geometry.topOffset < 1 && geometry.bottomOffset < 1, `desktop controls fill the arena height: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.sectionOrder, 'controls, next preview, score and sequence appear in that order')
      assert.ok(geometry.centerOffsets.every((offset) => offset < 2), 'the three information areas share the sidebar center')
      assert.ok(geometry.nextSizeError < 1, `next preview matches the level one game diameter: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.nodeSizes.every(([width, height]) => width === geometry.nodeSizes[0][0] && height === geometry.nodeSizes[0][1]), 'all sequence nodes keep the same slot size')
      assert.ok(geometry.controlSizes.every(([width, height]) => width === geometry.controlSizes[0][0] && height === geometry.controlSizes[0][1]), 'toolbar icon buttons share one hit target size')
    }
    await fitGame(900)
    assert.equal(await gamePage.locator('.merge-qb-toolbar').evaluate((toolbar) => getComputedStyle(toolbar).borderTopStyle), 'dashed', 'the right game controls have a dashed separating border')
    assert.ok(await gamePage.locator('.merge-qb-next, .merge-qb-score, .merge-qb-sequence').evaluateAll((sections) => sections.every((section) => getComputedStyle(section).borderTopStyle === 'dashed')), 'all four sidebar areas have dashed separators')
    assert.equal(await gamePage.locator('.merge-qb-sequence').getByText('QB大小顺序').count(), 0, 'the gallery has no visible title')
    assert.ok(await gamePage.locator('.merge-qb-level[data-level-id]').last().locator('.merge-qb-level-icon').evaluate((icon) => icon.getBoundingClientRect().width >= 36), 'the level gallery icons are legible')
    assert.ok(await gamePage.locator('.merge-qb-sequence').evaluate((sequence) => {
      const rows = [...sequence.querySelectorAll('.merge-qb-sequence-row')]
      const turns = [...sequence.querySelectorAll('.merge-qb-sequence-turn')]
      if (turns.length !== rows.length - 1) return false
      const firstTwo = [...rows[0].querySelectorAll('.merge-qb-level[data-level-id]')].slice(0, 2).map((level) => level.getBoundingClientRect())
      const columnGap = Math.abs((firstTwo[1].left + firstTwo[1].right - firstTwo[0].left - firstTwo[0].right) / 2)
      return rows.every((row, index) => {
        const levels = [...row.querySelectorAll('.merge-qb-level[data-level-id]')]
        const arrows = [...row.querySelectorAll('.merge-qb-sequence-arrow')].filter((arrow) => arrow.querySelector('svg'))
        const centers = levels.map((level) => { const rect = level.getBoundingClientRect(); return (rect.left + rect.right) / 2 })
        const direction = index % 2 === 0 ? 1 : -1
        if (!centers.slice(1).every((center, position) => (center - centers[position]) * direction > 0)) return false
        if (!centers.slice(1).every((center, position) => Math.abs(Math.abs(center - centers[position]) - columnGap) < 1)) return false
        if (arrows.length !== levels.length - 1 || !arrows.every((arrow) => arrow.querySelector(direction === 1 ? '.lucide-arrow-right' : '.lucide-arrow-left'))) return false
        if (index === rows.length - 1) return true
        const turn = turns[index].querySelector('svg').getBoundingClientRect()
        const next = rows[index + 1].querySelector('.merge-qb-level[data-level-id]').getBoundingClientRect()
        return Math.abs((turn.left + turn.right - 2 * centers.at(-1)) / 2) < 1 && Math.abs((next.left + next.right - 2 * centers.at(-1)) / 2) < 1
      })
    }), 'every row and turn arrow follows the continuous snake path')
    const levelTwoBefore = await gamePage.locator('.merge-qb-level[data-level-id]').nth(1).boundingBox()
    await gamePage.setViewportSize({ width: 1366, height: 768 })
    await fitGame(768)
    await gamePage.setViewportSize({ width: 960, height: 900 })
    await fitGame(900)
    await gamePage.setViewportSize({ width: 820, height: 900 })
    assert.ok(await gamePage.evaluate(() => {
      const arena = document.querySelector('.merge-qb-arena').getBoundingClientRect()
      const sidebar = document.querySelector('.merge-qb-toolbar').getBoundingClientRect()
      return sidebar.top >= arena.bottom && document.documentElement.scrollWidth <= innerWidth + 1
    }), 'narrow layouts stack without horizontal overflow')
    await gamePage.setViewportSize({ width: 1280, height: 900 })
    await fitGame(900)
    if (!process.env.CLASS_RECORD_PREVIEW) {
      assert.deepEqual(
        await gamePage.locator('.merge-qb-level[data-level-id]').evaluateAll((items) => items.map((item) => item.dataset.levelId)),
        gameLevels.slice(0, -1).map((level) => level.id),
        'the secret level has no initial sequence entry',
      )
    }
    await gamePage.screenshot({ path: '/tmp/class-merge-qb-desktop.png', fullPage: true })
    const boardBox = await board.boundingBox()
    await gamePage.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y + boardBox.height / 2)
    await gamePage.mouse.down()
    await gamePage.waitForTimeout(150)
    const pressedBox = await board.evaluate((arena) => {
      const box = arena.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    for (const dimension of ['x', 'y', 'width', 'height'])
      assert.ok(Math.abs(pressedBox[dimension] - boardBox[dimension]) < 0.5, `pressing the board keeps ${dimension} stable`)
    await gamePage.mouse.up()
    await gamePage.getByRole('button', { name: '重新开始' }).click()
    await gamePage.getByRole('alertdialog').getByRole('button', { name: '重新开始' }).click()
    await board.click()
    await gamePage.waitForTimeout(600)
    await board.click()
    await gamePage.waitForFunction(() => document.querySelector('.merge-qb-toolbar strong')?.textContent === '3')
    await gamePage.waitForFunction(() => document.querySelector('.merge-qb-level[data-level-id="02"] .merge-qb-level-icon')?.dataset.ready === 'true')
    assert.equal(await gamePage.locator('.merge-qb-level img').count(), 2, 'merging level one reveals level two')
    assert.equal(await gamePage.locator('.merge-qb-sequence .merge-qb-level-icon:not([data-ready="true"]) .merge-qb-locked').count(), 9)
    const levelTwoAfter = await gamePage.locator('.merge-qb-level[data-level-id]').nth(1).boundingBox()
    assert.deepEqual(levelTwoAfter, levelTwoBefore, 'unlocking a level does not move its gallery slot')
    // Chromium rejects window-bound changes while its window is fullscreen.
    await gamePage.setViewportSize({ width: 1024, height: 768 })
    await fitGame(768)
    assert.equal(await score.innerText(), '3', 'viewport resize retains the game state')
    if (await gamePage.evaluate(() => document.fullscreenEnabled)) {
      const nextBeforeFullscreen = await gamePage.locator('.merge-qb-next img').getAttribute('src')
      await gamePage.evaluate(() => { window.__mergeCanvas = document.querySelector('.merge-qb-arena canvas') })
      await gamePage.getByRole('button', { name: '全屏游玩' }).click()
      await gamePage.waitForFunction(() => document.fullscreenElement?.classList.contains('merge-qb-stage'))
      await gamePage.waitForFunction(() => {
        const arena = document.querySelector('.merge-qb-arena').getBoundingClientRect()
        const sidebar = document.querySelector('.merge-qb-toolbar').getBoundingClientRect()
        return Math.abs((arena.left + sidebar.right - innerWidth) / 2) < 2
      })
      assert.equal(await gamePage.locator('.merge-qb-stage').getByRole('button', { name: '返回游戏库' }).isVisible(), true)
      assert.equal(await gamePage.locator('.merge-qb-stage').getByRole('heading', { name: '合成大QB' }).isVisible(), true)
      assert.equal(await gamePage.evaluate(() => {
        const arena = document.querySelector('.merge-qb-arena').getBoundingClientRect()
        const sidebar = document.querySelector('.merge-qb-toolbar').getBoundingClientRect()
        const actions = document.querySelector('.merge-qb-actions').getBoundingClientRect()
        const next = document.querySelector('.merge-qb-next').getBoundingClientRect()
        const score = document.querySelector('.merge-qb-score').getBoundingClientRect()
        const sequence = document.querySelector('.merge-qb-sequence').getBoundingClientRect()
        return sidebar.left >= arena.right && Math.abs(sidebar.top - arena.top) < 1 && Math.abs(sidebar.bottom - arena.bottom) < 1 && actions.bottom < next.top && next.bottom < score.top && score.bottom < sequence.top
      }), true, 'fullscreen keeps all game controls distributed beside the arena')
      const fullscreenCenter = await gamePage.evaluate(() => {
        const arena = document.querySelector('.merge-qb-arena').getBoundingClientRect()
        const sidebar = document.querySelector('.merge-qb-toolbar').getBoundingClientRect()
        return { arenaLeft: arena.left, arenaRight: arena.right, sidebarLeft: sidebar.left, sidebarRight: sidebar.right, viewportWidth: innerWidth }
      })
      assert.ok(Math.abs((fullscreenCenter.arenaLeft + fullscreenCenter.sidebarRight - fullscreenCenter.viewportWidth) / 2) < 2, `fullscreen centers the arena and controls together: ${JSON.stringify(fullscreenCenter)}`)
      assert.equal(await score.innerText(), '3', 'entering fullscreen retains the score')
      assert.equal(await gamePage.locator('.merge-qb-next img').getAttribute('src'), nextBeforeFullscreen)
      assert.equal(await gamePage.evaluate(() => document.querySelector('.merge-qb-arena canvas') === window.__mergeCanvas), true, 'fullscreen keeps the same canvas')
      assert.equal(await gamePage.evaluate(() => document.fullscreenElement.querySelector('.app-sidebar, .app-topbar')), null)
      await gamePage.screenshot({ path: '/tmp/class-merge-qb-fullscreen.png' })
      assert.ok(await gamePage.evaluate(() => {
        const rect = document.querySelector('.merge-qb-arena').getBoundingClientRect()
        return Math.abs(rect.width / rect.height - 360 / 560) < 0.01
      }), 'fullscreen keeps canvas proportions')
      await gamePage.keyboard.press('Escape')
      await gamePage.waitForFunction(() => document.fullscreenElement === null)
      assert.equal(await score.innerText(), '3', 'Esc retains the game state')
      await gamePage.getByRole('button', { name: '全屏游玩' }).click()
      await gamePage.waitForFunction(() => document.fullscreenElement?.classList.contains('merge-qb-stage'))
      await gamePage.waitForFunction(() => {
        const rect = document.querySelector('.merge-qb-arena').getBoundingClientRect()
        return Math.abs(rect.width / rect.height - 360 / 560) < 0.01
      })
      assert.equal(await score.innerText(), '3', 'resized fullscreen retains the game state')
      await gamePage.locator('.merge-qb-stage').getByRole('button', { name: '退出全屏' }).click()
      await gamePage.waitForFunction(() => document.fullscreenElement === null)
      assert.equal(await score.innerText(), '3', 'the exit control retains the game state')
      assert.equal(await gamePage.evaluate(() => document.querySelector('.merge-qb-arena canvas') === window.__mergeCanvas), true)
    }
    await gamePage.getByRole('button', { name: '重新开始' }).click()
    await gamePage.getByRole('alertdialog').getByRole('button', { name: '重新开始' }).click()
    assert.equal(await score.innerText(), '0')
    assert.equal(await gamePage.locator('.merge-qb-level img').count(), 1, 'restart resets this game’s discoveries')
    assert.equal(await gamePage.locator('.merge-qb-sequence .merge-qb-level-icon:not([data-ready="true"]) .merge-qb-locked').count(), 10)
    assert.equal(await gamePage.locator('.merge-qb-next img').getAttribute('alt'), '一级 QB')
    await gamePage.reload()
    await board.waitFor()
    assert.equal(await gamePage.locator('.app-sidebar-navigation a[href$="/games"][data-active]').count(), 1)
    await gamePage.getByRole('button', { name: '返回游戏库' }).click()
    await gamePage.getByRole('alertdialog').getByRole('button', { name: '退出游戏' }).click()
    await gamePage.getByRole('link', { name: '合成大QB', exact: true }).click()
    await board.waitFor()
    assert.equal(await score.innerText(), '0')
    if (!process.env.CLASS_RECORD_PREVIEW) {
      await gamePage.evaluate(async (origin) => {
        const { MergeQbGame } = await import(origin + 'src/features/games/merge-qb/game.ts')
        const step = MergeQbGame.prototype.step
        window.__mergeQbTestGame = undefined
        window.__mergeQbFrameCounts = { steps: 0, draws: 0 }
        MergeQbGame.prototype.step = function () {
          window.__mergeQbTestGame = this
          window.__mergeQbFrameCounts.steps++
          step.call(this)
        }
        const clearRect = CanvasRenderingContext2D.prototype.clearRect
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
          if (this.canvas.matches('.merge-qb-arena canvas')) window.__mergeQbFrameCounts.draws++
          return clearRect.apply(this, args)
        }
      }, origin)
      await gamePage.waitForFunction(() => window.__mergeQbTestGame)
      const shareChecks = await gamePage.evaluate(async (base) => {
        const { createShareImage, SHARE_CAPTION_POOLS } = await import(base + 'src/features/games/merge-qb/share.ts')
        const { QB_LEVELS } = await import(base + 'src/features/games/merge-qb/levels.ts')
        const frozen = document.querySelector('.merge-qb-arena canvas')
        const fillText = CanvasRenderingContext2D.prototype.fillText
        const drawImage = CanvasRenderingContext2D.prototype.drawImage
        const random = Math.random
        let texts = [], draws = []
        CanvasRenderingContext2D.prototype.fillText = function (...args) {
          if (this.canvas.width === 1080 && this.canvas.height === 1900) texts.push(args)
          return fillText.apply(this, args)
        }
        CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
          if (this.canvas.width === 1080 && this.canvas.height === 1900) draws.push([source === frozen, ...args])
          return drawImage.call(this, source, ...args)
        }
        const checks = []
        try {
          for (const [category, level] of [null, QB_LEVELS[7], QB_LEVELS[8], QB_LEVELS[9], QB_LEVELS[10], QB_LEVELS[11]].entries()) {
            const snapshot = { ...window.__mergeQbTestGame.snapshot, score: 12345, highestMergedLevel: level }
            const variants = []
            for (const choice of [0, 0.999999]) {
              Math.random = () => choice
              texts = []; draws = []
              const blob = await createShareImage(frozen, snapshot)
              const image = await createImageBitmap(blob)
              variants.push({ texts, draws, size: [image.width, image.height] })
              image.close()
            }
            checks.push({ category, variants, captions: [...SHARE_CAPTION_POOLS[category].captions], highest: level?.name ?? '尚未合成' })
          }
        } finally {
          Math.random = random
          CanvasRenderingContext2D.prototype.fillText = fillText
          CanvasRenderingContext2D.prototype.drawImage = drawImage
        }
        return checks
      }, origin)
      for (const check of shareChecks) {
        assert.deepEqual(check.variants[0].texts.slice(0, 3), check.variants[1].texts.slice(0, 3), 'caption randomness preserves score, highest level and layout')
        assert.deepEqual(check.variants[0].texts.slice(0, 3).map(([text]) => text), ['合成大QB', '12345 分', `最高合成：${check.highest}`])
        assert.notEqual(check.variants[0].texts[3][0], check.variants[1].texts[3][0], 'repeated shares can draw different captions')
        for (const variant of check.variants) {
          assert.deepEqual(variant.size, [1080, 1900])
          assert.ok(check.captions.includes(variant.texts[3][0]), 'share image caption belongs to the achieved-level category')
          assert.deepEqual(variant.draws, [[true, 60, 60, 960, 960 * 14 / 9]], 'share preserves the frozen arena and its placement')
        }
      }

      const previewBefore = await gamePage.locator('.merge-qb-next').boundingBox()
      const scoreBefore = await gamePage.locator('.merge-qb-score').boundingBox()
      await gamePage.evaluate(async (origin) => {
        const { QB_LEVELS } = await import(origin + 'src/features/games/merge-qb/levels.ts')
        window.__mergeQbTestGame.next = QB_LEVELS[4]
        window.__mergeQbTestGame.publish()
      }, origin)
      await gamePage.waitForFunction(() => document.querySelector('.merge-qb-next img')?.getAttribute('alt') === '五级 QB')
      await gamePage.waitForFunction((width) => {
        const canvas = document.querySelector('.merge-qb-arena canvas').getBoundingClientRect()
        const preview = document.querySelector('.merge-qb-next img').getBoundingClientRect()
        return Math.abs(preview.width - canvas.width * width / 360) < 1
      }, gameLevels[4].visualSize.width)
      const previewDimensions = await gamePage.evaluate(() => {
        const canvas = document.querySelector('.merge-qb-arena canvas').getBoundingClientRect()
        const preview = document.querySelector('.merge-qb-next img').getBoundingClientRect()
        return { canvas: [canvas.width, canvas.height], preview: [preview.width, preview.height] }
      })
      assert.ok(Math.abs(previewDimensions.preview[0] - previewDimensions.canvas[0] * gameLevels[4].visualSize.width / 360) < 1 && Math.abs(previewDimensions.preview[1] - previewDimensions.canvas[1] * gameLevels[4].visualSize.height / 560) < 1, `level five next preview matches its rendered game size: ${JSON.stringify(previewDimensions)}`)
      assert.deepEqual(await gamePage.locator('.merge-qb-next').boundingBox(), previewBefore, 'a larger preview does not move its area')
      assert.deepEqual(await gamePage.locator('.merge-qb-score').boundingBox(), scoreBefore, 'a larger preview does not move the score')
      await gamePage.evaluate(async (origin) => {
        const { QB_LEVELS } = await import(origin + 'src/features/games/merge-qb/levels.ts')
        window.__mergeQbTestGame.next = QB_LEVELS[0]
        window.__mergeQbTestGame.publish()
      }, origin)
      await gamePage.waitForFunction(() => document.querySelector('.merge-qb-next img')?.getAttribute('alt') === '一级 QB')
      await gamePage.evaluate(() => {
        window.__mergeQbTestGame.score = 12345
        window.__mergeQbTestGame.publish()
      })
      await gamePage.waitForFunction(() => document.querySelector('.merge-qb-score strong')?.textContent === '12345')
      assert.deepEqual(await gamePage.locator('.merge-qb-score').boundingBox(), scoreBefore, 'score growth does not resize its area')
      await gamePage.evaluate(() => {
        window.__mergeQbTestGame.score = 0
        window.__mergeQbTestGame.publish()
      })
      await gamePage.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal(await gamePage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), false)
      const triggerMerge = (levelIndex) => gamePage.evaluate(async ([origin, index]) => {
        const { makePiece } = await import(origin + 'src/features/games/merge-qb/game.ts')
        const { QB_LEVELS } = await import(origin + 'src/features/games/merge-qb/levels.ts')
        const game = window.__mergeQbTestGame
        const level = QB_LEVELS[index]
        const first = makePiece(level, 140, 300)
        const second = makePiece(level, 180, 300)
        game.pieces.set(first.body.id, first)
        game.pieces.set(second.body.id, second)
        game.pendingPairs.set(`${first.body.id}:${second.body.id}`, [first.body.id, second.body.id])
        game.mergePending()
      }, [origin, levelIndex])
      assert.equal(await gamePage.locator('.merge-qb-level[data-level-id="12"]').count(), 0, 'level 12 has no initial placeholder')
      await triggerMerge(9)
      await gamePage.waitForFunction(() => document.querySelector('.merge-qb-score strong')?.textContent === '66')
      assert.equal(await gamePage.evaluate(() => window.__mergeQbTestGame.snapshot.highestMergedLevel.id), '11')
      assert.equal(await gamePage.locator('.merge-qb-score-pop').last().innerText(), '+66', 'score hint uses the actual merge delta')
      assert.equal(await gamePage.locator('.merge-qb-level[data-level-id="12"]').count(), 0, 'first level-11 merge does not reveal the egg')
      await triggerMerge(0)
      await gamePage.waitForFunction(() => document.querySelectorAll('.merge-qb-score-pop').length === 2)
      assert.ok(await gamePage.locator('.merge-qb-score-pop').evaluateAll((pops) => {
        const score = document.querySelector('.merge-qb-score-value').getBoundingClientRect()
        return pops.every((pop) => {
          const style = getComputedStyle(pop)
          const offsetX = parseFloat(pop.style.getPropertyValue('--pop-offset-x'))
          const offsetY = parseFloat(pop.style.getPropertyValue('--pop-offset-y'))
          const rise = parseFloat(pop.style.getPropertyValue('--pop-rise'))
          const duration = parseFloat(pop.style.animationDuration)
          return style.position === 'absolute' &&
            Math.abs(offsetX) <= 2.5 && Math.abs(offsetY) <= 2 &&
            rise >= 16 && rise <= 25 && duration >= 720 && duration <= 900 &&
            pop.getBoundingClientRect().left >= score.right - 4 &&
            pop.getBoundingClientRect().left <= score.right + 10
        }) && Math.abs(parseFloat(getComputedStyle(pops[0]).top) - parseFloat(getComputedStyle(pops[1]).top)) <= 4
      }), 'consecutive score hints share one anchor with bounded jitter and independent animation')
      const hintColors = await gamePage.locator('.merge-qb-score-pop').evaluateAll(pops => pops.map(pop => getComputedStyle(pop).color))
      assert.notEqual(hintColors[0], hintColors[1], 'consecutive hints draw distinct colors from the designed pool')
      await gamePage.screenshot({ path: '/tmp/class-merge-qb-celebration.png' })
      await gamePage.locator('.merge-qb-score-pop').last().waitFor({ state: 'detached', timeout: 5000 })
      await gamePage.setViewportSize({ width: 390, height: 844 })
      const mobileScoreBeforePop = await gamePage.locator('.merge-qb-score').boundingBox()
      const mobileNextBeforePop = await gamePage.locator('.merge-qb-next').boundingBox()
      await triggerMerge(1)
      await gamePage.locator('.merge-qb-score-pop').last().waitFor()
      assert.equal(await gamePage.locator('.merge-qb-score-pop').last().innerText(), '+6')
      const mobileHintGeometry = await gamePage.locator('.merge-qb-score-pop').last().evaluate((pop) => {
        const hint = pop.getBoundingClientRect()
        const score = document.querySelector('.merge-qb-score-value').getBoundingClientRect()
        const restart = document.querySelector('.merge-qb-mobile-restart').getBoundingClientRect()
        const next = document.querySelector('.merge-qb-next').getBoundingClientRect()
        return { hint: hint.toJSON(), score: score.toJSON(), restart: restart.toJSON(), next: next.toJSON(), viewportWidth: innerWidth }
      })
      assert.ok(mobileHintGeometry.hint.left >= mobileHintGeometry.score.right - 4 &&
        mobileHintGeometry.hint.right < mobileHintGeometry.next.left &&
        mobileHintGeometry.hint.right <= mobileHintGeometry.viewportWidth &&
        (mobileHintGeometry.hint.right <= mobileHintGeometry.restart.left ||
          mobileHintGeometry.hint.left >= mobileHintGeometry.restart.right ||
          mobileHintGeometry.hint.bottom <= mobileHintGeometry.restart.top ||
          mobileHintGeometry.hint.top >= mobileHintGeometry.restart.bottom),
        `mobile score hint stays beside the score, on screen and away from restart: ${JSON.stringify(mobileHintGeometry)}`)
      assert.deepEqual(await gamePage.locator('.merge-qb-score').boundingBox(), mobileScoreBeforePop)
      assert.deepEqual(await gamePage.locator('.merge-qb-next').boundingBox(), mobileNextBeforePop)
      const anchorScore = await gamePage.evaluate(() => window.__mergeQbTestGame.score)
      const hint = gamePage.locator('.merge-qb-score-pop').last()
      await hint.evaluate(pop => pop.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 300 }))
      let fixedAnchor
      for (const value of [1, 12, 123, 1234, 12345]) {
        await gamePage.evaluate(value => { window.__mergeQbTestGame.score = value; window.__mergeQbTestGame.publish() }, value)
        await gamePage.waitForFunction(value => document.querySelector('.merge-qb-score strong')?.textContent === String(value), value)
        const anchor = await hint.evaluate(pop => {
          const value = document.querySelector('.merge-qb-score-value').getBoundingClientRect()
          const digits = document.querySelector('.merge-qb-score strong').getBoundingClientRect()
          const next = document.querySelector('.merge-qb-next').getBoundingClientRect()
          const rect = pop.getBoundingClientRect()
          return { slotLeft: value.left, slotWidth: value.width, digitsLeft: digits.left, hintLeft: rect.left, hintRight: rect.right, nextLeft: next.left }
        })
        assert.ok(Math.abs(anchor.digitsLeft - anchor.slotLeft) < 0.1 && anchor.hintRight < anchor.nextLeft)
        if (fixedAnchor) assert.deepEqual(anchor, fixedAnchor, 'score length never moves the digits anchor or the active hint')
        fixedAnchor = anchor
      }
      await gamePage.evaluate(value => { window.__mergeQbTestGame.score = value; window.__mergeQbTestGame.publish() }, anchorScore)
      await hint.evaluate(pop => pop.getAnimations().forEach(animation => animation.play()))
      await gamePage.setViewportSize({ width: 1280, height: 900 })
      await triggerMerge(10)
      await gamePage.locator('.merge-qb-level[data-level-id="12"] img').waitFor()
      assert.equal(await gamePage.evaluate(() => window.__mergeQbTestGame.snapshot.highestMergedLevel.id), '12')
      assert.equal(await gamePage.evaluate(() => window.__mergeQbTestGame.snapshot.maxMergeCount), 1)
      assert.equal(await gamePage.locator('.merge-qb-score-pop').last().innerText(), '+78')
      assert.equal(await gamePage.locator('.merge-qb-next img').getAttribute('alt'), '一级 QB', 'the egg never enters Next')
      await gamePage.screenshot({ path: '/tmp/class-merge-qb-easter-unlock.png' })
      await gamePage.evaluate(() => { Math.random = () => 1 - Number.EPSILON })
      for (const width of [280, 320, 375, 390, 430]) {
        for (const height of [568, 844]) {
          await gamePage.setViewportSize({ width, height })
          await gamePage.waitForTimeout(100)
          await gamePage.getByRole('button', { name: '重新开始' }).click()
          await gamePage.getByRole('alertdialog').getByRole('button', { name: '重新开始' }).click()
          await gamePage.evaluate(width => {
            window.__mergeQbTestGame.score = width === 280 ? 99000 : 123456
            window.__mergeQbTestGame.publish()
          }, width)
          await triggerMerge(10)
          await triggerMerge(0)
          await gamePage.waitForFunction(() => document.querySelectorAll('.merge-qb-score-pop').length === 2)
          const geometry = await gamePage.evaluate(() => {
            const score = document.querySelector('.merge-qb-score-value').getBoundingClientRect()
            const next = document.querySelector('.merge-qb-next').getBoundingClientRect()
            const restart = document.querySelector('.merge-qb-mobile-restart').getBoundingClientRect()
            const pops = [...document.querySelectorAll('.merge-qb-score-pop')]
            return {
              score: score.toJSON(), next: next.toJSON(), restart: restart.toJSON(),
              hints: pops.map((pop) => ({ rect: pop.getBoundingClientRect().toJSON(), top: parseFloat(getComputedStyle(pop).top) })),
              scrollWidth: document.documentElement.scrollWidth,
            }
          })
          assert.ok(geometry.scrollWidth <= width && geometry.hints.every(({ rect }) =>
            rect.right < geometry.next.left && rect.left >= geometry.score.right - 4),
            `score hints leave Next a safe gap with a long score at ${width}×${height}: ${JSON.stringify(geometry)}`)
          assert.ok(Math.abs(geometry.hints[0].top - geometry.hints[1].top) <= 4, 'rapid hints never stack into lower slots')
          await gamePage.getByRole('alertdialog').waitFor({ state: 'detached' })
          await gamePage.screenshot({ path: `/tmp/class-merge-qb-mobile-${width}-${height}.png` })
        }
      }
      await gamePage.evaluate(() => { Math.random = () => 0 })
      await gamePage.setViewportSize({ width: 1280, height: 900 })
      await gamePage.getByRole('button', { name: '全屏游玩' }).click()
      await gamePage.waitForFunction(() => document.fullscreenElement?.classList.contains('merge-qb-stage'))
      await gamePage.evaluate(() => {
        window.__mergeQbTestGame.danger = 'game-over'
        window.__mergeQbTestGame.publish()
      })
      const gameOverLabel = gamePage.locator('.merge-qb-game-over-label')
      await gameOverLabel.waitFor()
      assert.equal(await gamePage.locator('.merge-qb-next img').count(), 0)
      assert.equal(await board.isDisabled(), true)
      await gamePage.screenshot({ path: '/tmp/class-merge-qb-game-over-fullscreen.png' })
      await gamePage.getByRole('button', { name: '分享', exact: true }).click()
      await gamePage.getByRole('dialog', { name: '分享本局结果' }).waitFor()
      await gamePage.locator('.merge-qb-share-preview').waitFor()
      assert.equal(await gamePage.evaluate(() => document.fullscreenElement), null, 'the share dialog remains visible after leaving fullscreen')
      await gamePage.waitForFunction(() => document.querySelector('.merge-qb-share-preview')?.naturalWidth > 0)
      assert.deepEqual(await gamePage.locator('.merge-qb-share-preview').evaluate((img) => [img.naturalWidth, img.naturalHeight]), [1080, 1900])
      const download = gamePage.waitForEvent('download')
      await gamePage.getByRole('dialog', { name: '分享本局结果' }).getByRole('button', { name: '保存图片' }).click()
      const savedImage = await download
      assert.match(savedImage.suggestedFilename(), /^merge-qb-\d+\.png$/)
      await savedImage.saveAs('/tmp/class-merge-qb-share.png')
      await gamePage.getByRole('dialog', { name: '分享本局结果' }).getByRole('button', { name: '取消' }).click()
      assert.equal(await gamePage.locator('.merge-qb-arena').isDisabled(), true, 'closing share retains the final game')
      await gameOverLabel.click()
      await gamePage.getByRole('alertdialog').waitFor()
      await gamePage.getByRole('alertdialog').getByRole('button', { name: '取消' }).click()
      assert.equal(await gamePage.locator('.merge-qb-arena').isDisabled(), true, 'canceling replay preserves the final game')
      await gameOverLabel.click()
      await gamePage.getByRole('alertdialog').getByRole('button', { name: '再来一局' }).click()
      await gameOverLabel.waitFor({ state: 'hidden' })
      assert.equal(await gamePage.locator('.merge-qb-level[data-level-id="12"]').count(), 0, 'a new game hides the egg again')
      assert.equal(await gamePage.evaluate(() => window.__mergeQbTestGame.snapshot.highestMergedLevel), null)
      const sampleFrames = async () => {
        await gamePage.evaluate(() => { window.__mergeQbFrameCounts = { steps: 0, draws: 0 } })
        await gamePage.waitForTimeout(200)
        return gamePage.evaluate(() => window.__mergeQbFrameCounts)
      }
      const gameImageRequests = () => requests.filter((request) => request.includes('/images/games/merge-qb/')).length
      const imageRequestsBefore = gameImageRequests()
      for (let round = 0; round < 4; round++) {
        const running = await sampleFrames()
        assert.ok(running.steps > 0 && running.draws > 0, 'replay resumes the existing animation loop')
        await gamePage.evaluate(() => {
          window.__mergeQbTestGame.danger = 'game-over'
          window.__mergeQbTestGame.publish()
        })
        await gamePage.waitForTimeout(100)
        assert.deepEqual(await sampleFrames(), { steps: 0, draws: 0 }, 'finished boards stop all physics and canvas frames')
        await gamePage.getByRole('button', { name: '再来一局' }).click()
        await gamePage.getByRole('alertdialog').getByRole('button', { name: '取消' }).click()
        await gamePage.waitForFunction(() => document.fullscreenElement?.classList.contains('merge-qb-stage'))
        await gamePage.waitForTimeout(100)
        assert.deepEqual(await sampleFrames(), { steps: 0, draws: 0 }, 'canceling replay does not restart a finished loop')
        await gamePage.getByRole('button', { name: '再来一局' }).click()
        await gamePage.getByRole('alertdialog').getByRole('button', { name: '再来一局' }).click()
      }
      assert.equal(gameImageRequests(), imageRequestsBefore, 'multiple replays reuse the decoded private assets without network requests')

    }
    await gameContext.close()
    const retryContext = await contextFor({ mobile: true })
    const retryPage = await retryContext.newPage()
    let corruptGameImage = true
    await retryContext.route('**/storage/v1/object/sign/**/images/games/merge-qb/01.png*', async (route) => {
      if (route.request().method() !== 'GET' || !corruptGameImage) return route.fallback()
      corruptGameImage = false
      return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: 'invalid image fixture' })
    })
    await retryPage.setViewportSize({ width: 320, height: 568 })
    await retryPage.goto(origin + 'games/merge-qb/')
    await retryPage.getByRole('button', { name: '重试', exact: true }).waitFor()
    assert.equal(await retryPage.locator('.merge-qb-arena').isDisabled(), true, 'image failure keeps the arena disabled')
    const failedIcon = retryPage.locator('.merge-qb-level[data-level-id="01"] .merge-qb-level-icon')
    assert.equal(await failedIcon.locator('img').count(), 0, 'failed decoding does not expose a broken first QB image')
    assert.equal((await failedIcon.locator('.merge-qb-locked').textContent()).trim(), '?')
    assert.ok(await retryPage.locator('.merge-qb-toolbar').evaluate((toolbar) =>
      [...toolbar.querySelectorAll('button, h1, .merge-qb-score, .merge-qb-next')]
        .filter((node) => node.getBoundingClientRect().width)
        .every((node) => node.getBoundingClientRect().right <= toolbar.getBoundingClientRect().right)),
      'mobile retry fits alongside the existing controls')
    await retryPage.setViewportSize({ width: 1280, height: 900 })
    await retryPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await failedIcon.locator('.merge-qb-locked').waitFor()
    assert.ok(await failedIcon.locator('.merge-qb-locked').evaluate(node => getComputedStyle(node).borderTopStyle === 'dashed'))
    // Retry removes existing error controls; verify image geometry within its gallery slot.
    const slotGeometry = node => {
      const icon = node.getBoundingClientRect()
      const slot = node.closest('.merge-qb-level').getBoundingClientRect()
      return { left: icon.left - slot.left, top: icon.top - slot.top, width: icon.width, height: icon.height }
    }
    const failedSlot = await failedIcon.evaluate(slotGeometry)
    await retryPage.getByRole('button', { name: '重试', exact: true }).click()
    await retryPage.locator('.merge-qb-next img').waitFor()
    await retryPage.waitForFunction(() => !document.querySelector('.merge-qb-arena').disabled)
    await retryPage.waitForFunction(() => document.querySelector('.merge-qb-level[data-level-id="01"] .merge-qb-level-icon')?.dataset.ready === 'true')
    assert.deepEqual(await failedIcon.evaluate(slotGeometry), failedSlot, 'retry replaces the placeholder without resizing or moving it within its slot')
    await retryContext.close()
  }
  const anonymous = await contextFor({ authenticated: false })
  const auth = await anonymous.newPage()
  await auth.goto(origin + 'records')
  await auth.getByLabel('邀请码', { exact: true }).fill('CR-TEST-TEST-TEST')
  await auth.getByRole('button', { name: '进入档案' }).click()
  await waitCards(auth, 4)
  await anonymous.close()
  for (const admin of [false, true]) {
    const session = await contextFor({ authenticated: false, admin })
    const visitor = await session.newPage()
    const before = requests.length
    await visitor.goto(origin + 'qb')
    await visitor.getByLabel('邀请码', { exact: true }).waitFor()
    assert.equal(requests.slice(before).some((url) => url.includes('/storage/') || /class_records|class_people/.test(url)), false, 'anonymous QB must not fetch protected content')
    await visitor.getByLabel('邀请码', { exact: true }).fill('CR-TEST-TEST-TEST')
    await visitor.getByRole('button', { name: '进入档案' }).click()
    await waitQbContent(visitor)
    assert.match(new URL(visitor.url()).pathname, /\/qb\/?$/)
    assert.equal(await visitor.locator('a[href$="/qb"], a[href$="/qb/"]').count(), 0, 'QB must have no navigation entry')
    await visitor.reload()
    await waitQbContent(visitor)
    await visitor.goto(origin + 'people')
    await visitor.goBack()
    await waitQbContent(visitor)
    validAccess = false
    await visitor.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await visitor.getByLabel('邀请码', { exact: true }).waitFor()
    assert.equal(await qbContent(visitor).count(), 0, 'revocation must unmount protected QB')
    await visitor.reload()
    await visitor.getByLabel('邀请码', { exact: true }).waitFor()
    validAccess = true
    await visitor.getByLabel('邀请码', { exact: true }).fill('CR-TEST-TEST-TEST')
    await visitor.getByRole('button', { name: '进入档案' }).click()
    await visitor.locator('[data-slot="sidebar-menu-button"]').first().waitFor()
    await visitor.getByRole('button', { name: '移除访问权限', exact: true }).click()
    await visitor.getByRole('button', { name: '移除并清理', exact: true }).click()
    await visitor.getByLabel('邀请码', { exact: true }).waitFor()
    assert.equal(await visitor.evaluate(() => localStorage.getItem('classRecord:inviteAccess')), null, 'logout clears credentials')
    await session.close()
  }
  const tablet = await contextFor()
  const tabletPage = await tablet.newPage()
  await tabletPage.setViewportSize({ width: 768, height: 1024 })
  for (const route of ['qb', 'records', 'materials', 'timeline', 'quiz', 'backgrounds']) {
    await tabletPage.goto(origin + route)
    await tabletPage.locator('main').waitFor()
    await tabletPage.waitForFunction(() => !/正在打开档案|正在验证访问权限|正在准备页面插图/.test(document.body.innerText))
    assert.equal(await tabletPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `tablet ${route}`)
  }
  await tablet.close()
  if (!process.env.CLASS_RECORD_PREVIEW) {
    // Exercise both placeholder and enabled states in this isolated browser,
    // independently of whether the production image has already been supplied.
    const images = await contextFor()
    const picture = await images.newPage()
    await picture.goto(origin + 'people')
    await picture.evaluate(async (origin) => {
      const { default: qbAsset } = await import(origin + 'src/lib/qb-asset.json?import')
      qbAsset.ready = false
      history.pushState({}, '', origin + 'qb')
      dispatchEvent(new PopStateEvent('popstate'))
    }, origin)
    await picture.getByText('图片尚未提供', { exact: true }).waitFor()
    await picture.evaluate(async (origin) => {
      const { default: qbAsset } = await import(origin + 'src/lib/qb-asset.json?import')
      qbAsset.ready = true
      history.pushState({}, '', origin + 'people')
      dispatchEvent(new PopStateEvent('popstate'))
    }, origin)
    await picture.getByText('图片尚未提供', { exact: true }).waitFor({ state: 'hidden' })
    await picture.evaluate((origin) => {
      history.pushState({}, '', origin + 'qb')
      dispatchEvent(new PopStateEvent('popstate'))
    }, origin)
    const qbImage = picture.getByRole('img', { name: 'QB', exact: true })
    await qbImage.waitFor()
    await picture.waitForFunction(() => { const img = document.querySelector('img[alt="QB"]'); return img?.complete && img.naturalWidth > 0 })
    for (const width of [320, 390, 768, 1280]) {
      await picture.setViewportSize({ width, height: 844 })
      const box = await qbImage.boundingBox()
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 844, `QB image fits ${width}`)
      assert.ok(Math.abs(box.width / box.height - 800 / 600) < 0.02, 'QB image preserves its aspect ratio')
    }
    await picture.screenshot({ path: '/tmp/class-release-qb-image.png' })
    await images.close()
  }
  {
    const entryContext = await contextFor({ admin: true })
    const entry = await entryContext.newPage()
    await entry.addInitScript(() => {
      window.__homeEntry = { states: [], requested: false }
      const observe = () => {
        const sample = window.__homeEntry
        if (sample.requested) return
        const stage = document.querySelector('.guide-body') ? 'guide'
          : document.querySelector('.guide-cover') ? 'logo'
            : document.body?.innerText.includes('正在打开档案') ? 'route-loading'
              : document.body?.innerText.includes('正在验证访问权限') ? 'verification'
                : ''
        if (stage && sample.states.at(-1) !== stage) sample.states.push(stage)
      }
      new MutationObserver(observe).observe(document, { childList: true, subtree: true })
    })
    authDelay = 450
    businessDelay = 450
    for (const visit of ['first', 'reload']) {
      const firstRecordRequest = visit === 'first'
        ? entry.waitForRequest((request) => request.url().includes('/class_records'))
        : null
      if (visit === 'first') await entry.goto(origin)
      else await entry.reload()
      await entry.getByText('正在验证访问权限…').waitFor()
      if (firstRecordRequest) {
        await firstRecordRequest
        assert.equal(await entry.locator('.guide-cover').count(), 0, 'Logo waits for initial archive data')
        await entry.getByText('正在验证访问权限…').waitFor()
      }
      await entry.locator('.guide-cover').waitFor()
      await entry.waitForTimeout(550)
      assert.deepEqual(await entry.evaluate(() => window.__homeEntry.states), ['verification', 'logo'], `${visit} must go straight from access validation to the logo`)
      assert.equal(await entry.locator('.guide-body').count(), 0, 'guide content must not mount before entry')
      await entry.evaluate(() => { window.__homeEntry.requested = true })
      await entry.keyboard.press('Enter')
      await entry.locator('.guide-cover').waitFor({ state: 'detached' })
      await entry.locator('.guide-content').waitFor()
      assert.equal(await entry.locator('.guide-cover').count(), 0, 'logo must not restart after entry')
    }
    authDelay = 0
    businessDelay = 0
    await entryContext.close()
    const firstAccessContext = await contextFor({ authenticated: false })
    const firstAccess = await firstAccessContext.newPage()
    await firstAccess.goto(origin)
    await firstAccess.getByLabel('邀请码', { exact: true }).fill('CR-TEST-TEST-TEST')
    await firstAccess.getByRole('button', { name: '进入档案' }).click()
    await firstAccess.locator('.guide-cover').waitFor()
    assert.equal(await firstAccess.locator('.guide-body').count(), 0, 'a new grant opens at the logo')
    await firstAccess.keyboard.press('Enter')
    await firstAccess.locator('.guide-content').waitFor()
    await firstAccessContext.close()
    console.log('Home entry passed: new grant, slow validation, slow data, cached reload and no pre-entry guide mount.')
  }
  {
    const originals = records.map(record => ({ ...record }))
    const beforeStars = starRequests
    for (const hasHistory of [true, false]) {
      const homeContext = await contextFor({ admin: true })
      const home = await homeContext.newPage()
      const { today, other, month, day } = await home.evaluate(() => {
        const now = new Date()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return { today: `2025-${month}-${day}`, other: `2025-${month}-${day === '01' ? '02' : '01'}`, month, day }
      })
      records[0].record_date = other
      records[1].record_date = hasHistory ? today : other
      records[1].content = '历史摘录 [[red:标记文字]] 傻逼 [[quote:home|摘录名言]]'
      records[2].record_date = today
      await home.goto(origin)
      const setting = home.getByRole('switch', { name: '隐藏所有记录中的脏话' })
      const logo = home.locator('[data-guide-logo]')
      await logo.waitFor()
      assert.equal(await logo.locator('img').count(), 1)
      assert.ok((await logo.locator('img').getAttribute('src')).endsWith('/logo-guide-preview.png'))
      assert.equal(await home.locator('.guide-body').count(), 0, 'the logo phase has no guide body')
      await home.keyboard.press('Enter')
      await home.locator('.guide-cover').waitFor({ state: 'detached' })
      await home.waitForLoadState('networkidle')
      await home.waitForTimeout(300)
      const excerpt = home.locator('.guide-history-excerpt')
      await excerpt.waitFor()
      if (hasHistory) {
        assert.equal(await excerpt.innerText(), '历史摘录 标记文字 *** 摘录名言')
      } else {
        assert.equal(await home.getByText('今日留白', { exact: true }).count(), 1)
        assert.equal(await excerpt.innerText(), '今天的篇章，留给正在发生的故事。')
        assert.equal(await home.locator('.guide-history [data-guide-panel="static"]').count(), 1, 'empty-date panel is reading content, not a button')
      }
      assert.equal(await home.locator('.guide-history').count(), 1, 'the date panel remains present without a matching record')
      assert.equal(await home.locator('.guide-home a').count(), Number(hasHistory), 'only history navigation remains')
      for (const preset of ['paper', 'midnight']) {
        for (const width of [320, 390, 768, 1024, 1920]) {
          await home.setViewportSize({ width, height: 900 })
          await home.reload()
          await home.locator('.guide-cover').waitFor()
          assert.equal(await home.locator('.guide-body').count(), 0)
          await home.evaluate(preset => {
            document.documentElement.dataset.themePreset = preset
            document.documentElement.classList.toggle('dark', preset === 'midnight')
          }, preset)
          const cover = await home.locator('.guide-cover').boundingBox()
          const brand = await logo.boundingBox()
          const hint = await home.locator('.guide-scroll-hint').boundingBox()
          const masthead = await home.locator('.guide-masthead').boundingBox()
          assert.ok(cover.y === 0 && cover.height >= 899, 'opaque cover fills the viewport')
          assert.ok(brand.y > 100 && Math.abs(brand.y + brand.height / 2 - 450) <= 40, 'masthead is centered with a safe top margin')
          assert.ok(masthead.width >= Math.min(width * 0.75, 1088) && masthead.width <= width - 32, 'long rules retain side margins')
          assert.ok(hint.y > brand.y + brand.height && hint.y + hint.height < 880)
          assert.equal(await home.locator('#root').evaluate(e => e.inert), true, 'covered content cannot receive focus')
          assert.equal(await home.locator('.guide-masthead').evaluate(e => getComputedStyle(e).animationName), 'none')
          if (width === 390 || width === 1920) await home.screenshot({ path: `/tmp/class-curtain-${hasHistory}-${preset}-${width}.png` })
          await home.mouse.move(width / 2, 500)
          await home.mouse.wheel(0, 8)
          assert.equal(await home.locator('.guide-cover').count(), 1, 'small trackpad jitter cannot dismiss the cover')
          const reducedExit = await home.locator('.guide-cover').evaluate(element => {
            element.dispatchEvent(new WheelEvent('wheel', { deltaY: 72, cancelable: true }))
            const animation = element.getAnimations().find(item => item.id === 'guide-cover-exit')
            animation.pause()
            animation.currentTime = 120
            const opacity = Number(getComputedStyle(element).opacity)
            animation.play()
            return { opacity, duration: animation.effect.getTiming().duration }
          })
          assert.equal(reducedExit.duration, 240)
          assert.ok(reducedExit.opacity > 0 && reducedExit.opacity < 1, 'reduced motion fades instead of removing the logo instantly')
          await home.locator('.guide-cover').waitFor({ state: 'detached' })
          assert.equal(await home.locator('#root').evaluate(e => e.inert), false)
          assert.equal(await home.evaluate(() => document.documentElement.style.overflow), '')
          await home.mouse.wheel(0, 160)
          assert.equal(await home.evaluate(() => window.scrollY), 0, 'default guide fits without vertical scrolling')
          assert.equal(await home.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth), 'none')
          assert.ok((await home.locator('.guide-content').boundingBox()).width <= 800)
          await home.mouse.wheel(0, -1200)
          await home.keyboard.press('Home')
          await home.evaluate(() => window.scrollTo(0, 0))
          assert.equal(await home.locator('.guide-cover').count(), 0, 'reverse scrolling and Home cannot restore the cover')
          assert.equal(await home.locator('.guide-home').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true)
          assert.equal(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
          const settingBounds = await home.locator('.guide-setting').boundingBox()
          assert.ok(settingBounds.height >= 44 && settingBounds.x >= 0 && settingBounds.x + settingBounds.width <= width)
          if (width === 390 || width === 1920) await home.screenshot({ path: `/tmp/class-curtain-content-${hasHistory}-${preset}-${width}.png` })
        }
      }
      for (const viewport of [{ width: 1280, height: 600 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1536, height: 864 }, { width: 1024, height: 600 }]) {
        await home.setViewportSize(viewport)
        await home.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        await home.evaluate(() => window.scrollTo(0, 0))
        const fit = await home.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: innerHeight, width: document.documentElement.scrollWidth, viewportWidth: innerWidth }))
        assert.ok(fit.height <= fit.viewport + 1, `desktop content fits one screen: ${JSON.stringify({ viewport, fit })}`)
        assert.ok(fit.width <= fit.viewportWidth)
        const privacy = await home.locator('.guide-privacy').boundingBox()
        assert.ok(privacy.y + privacy.height <= viewport.height, 'privacy footer stays visible')
        assert.ok(privacy.y + privacy.height > viewport.height * 0.75, 'guide sections use the available screen height')
        if (viewport.width === 1366) {
          const history = await home.locator('.guide-history').boundingBox()
          const setting = await home.locator('.guide-setting').boundingBox()
          const random = await home.locator('.guide-random').boundingBox()
          assert.ok(Math.abs(history.y - setting.y) <= 1, 'date and setting panels share a top edge')
          assert.ok(Math.abs(history.y + history.height - random.y - random.height) <= 1, 'date and random panels share a bottom edge')
          assert.ok(random.y - setting.y - setting.height >= 14 && random.y - setting.y - setting.height <= 25, 'right-side panel gap stays balanced')
          await home.screenshot({ path: `/tmp/class-guide-roomy-${hasHistory}.png` })
        }
      }
      for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 320 }, { width: 390, height: 667 }]) {
        await home.setViewportSize(viewport)
        await home.reload()
        await home.locator('.guide-cover').waitFor()
        const hint = await home.locator('.guide-scroll-hint').boundingBox()
        const brand = await logo.boundingBox()
        assert.ok(hint.y > brand.y + brand.height)
        assert.ok(hint.y + hint.height <= viewport.height - 16)
        await home.keyboard.press('Tab')
        await home.getByRole('button', { name: '进入导览内容' }).press('Enter')
        await home.locator('.guide-cover').waitFor({ state: 'detached' })
        if (await home.evaluate(() => document.documentElement.scrollHeight > innerHeight)) {
          await home.keyboard.press('PageDown')
          await home.waitForFunction(() => window.scrollY > 0)
        }
      }
      await home.setViewportSize({ width: 1920, height: 900 })
      await home.emulateMedia({ reducedMotion: 'no-preference' })
      await home.reload()
      await home.locator('.guide-cover').waitFor()
      const ruleFrames = await home.locator('.guide-masthead').evaluate(element => {
        const animations = element.getAnimations({ subtree: true }).filter(animation => animation.animationName === 'guide-rule-unfold')
        const sample = time => {
          for (const animation of animations) { animation.pause(); animation.currentTime = time }
          return ['::before', '::after'].map(pseudo => {
            const style = getComputedStyle(element, pseudo)
            return { scale: new DOMMatrix(style.transform).a, opacity: Number(style.opacity) }
          })
        }
        const frames = { count: animations.length, start: sample(0), middle: sample(650), end: sample(1150) }
        for (const animation of animations) animation.finish()
        return frames
      })
      assert.equal(ruleFrames.count, 2)
      assert.deepEqual(ruleFrames.start, [{ scale: 0, opacity: 0 }, { scale: 0, opacity: 0 }])
      assert.deepEqual(ruleFrames.middle[0], ruleFrames.middle[1], 'masthead rules expand symmetrically')
      assert.ok(ruleFrames.middle[0].scale > 0 && ruleFrames.middle[0].scale < 1)
      assert.deepEqual(ruleFrames.end, [{ scale: 1, opacity: 1 }, { scale: 1, opacity: 1 }])
      await home.mouse.move(960, 500)
      await home.mouse.wheel(0, 80)
      await home.waitForFunction(() => document.querySelector('.guide-cover')?.dataset.state === 'leaving')
      await home.mouse.wheel(0, 600)
      await home.mouse.wheel(0, -300)
      await home.waitForTimeout(250)
      const liveExit = await home.locator('.guide-cover').evaluate(element => {
        const logo = element.querySelector('.guide-masthead')
        const style = getComputedStyle(logo)
        return { connected: logo.isConnected, opacity: Number(style.opacity), brightness: style.filter, y: logo.getBoundingClientRect().y }
      })
      assert.ok(liveExit.connected && liveExit.opacity > 0 && liveExit.opacity < 1, 'logo stays mounted and visibly fades during real time')
      assert.ok(Number(liveExit.brightness.match(/brightness\(([^)]+)\)/)?.[1]) < 1, 'logo darkens during real time')
      assert.equal(await home.locator('.guide-cover').evaluate(e => e.getAnimations().filter(item => item.id === 'guide-cover-exit').length), 1, 'inertia cannot start a second exit animation')
      const exitState = await home.locator('.guide-cover').evaluate(element => {
        const animation = element.getAnimations().find(item => item.id === 'guide-cover-exit')
        const duration = animation.effect.getTiming().duration
        animation.pause()
        const masthead = element.querySelector('.guide-masthead')
        const darkening = masthead.getAnimations().find(item => item.effect.getKeyframes().some(frame => frame.filter))
        darkening.pause()
        animation.currentTime = duration / 2
        darkening.currentTime = duration / 2
        const brightness = getComputedStyle(masthead).filter
        const samples = [0.2, 0.5, 0.85].map(progress => {
          animation.currentTime = duration * progress
          darkening.currentTime = duration * progress
          const style = getComputedStyle(masthead)
          return { opacity: Number(style.opacity), y: masthead.getBoundingClientRect().y }
        })
        animation.currentTime = duration / 2
        darkening.currentTime = duration / 2
        const result = { duration, brightness, samples, opacity: Number(getComputedStyle(element).opacity), logoBottom: element.querySelector('[data-guide-logo]').getBoundingClientRect().bottom }
        animation.play()
        darkening.play()
        return result
      })
      assert.ok(exitState.duration >= 1000 && exitState.duration <= 1200, 'cover departure is deliberately slower')
      const brightness = Number(exitState.brightness.match(/brightness\(([^)]+)\)/)?.[1])
      assert.ok(brightness > 0.5 && brightness < 1, 'logo dims gradually without turning black')
      assert.ok(exitState.opacity > 0.6 && exitState.opacity < 1 && exitState.logoBottom > 0, 'logo remains visible halfway through departure')
      for (let i = 1; i < exitState.samples.length; i++) {
        assert.ok(exitState.samples[i].opacity < exitState.samples[i - 1].opacity)
        assert.ok(exitState.samples[i].y < exitState.samples[i - 1].y)
        assert.ok(exitState.samples[i].y > 0, 'logo stays on screen while fading, rather than sliding out abruptly')
      }
      await home.locator('.guide-cover').screenshot({ path: `/tmp/class-guide-exit-${hasHistory}.png` })
      await home.locator('.guide-cover').waitFor({ state: 'detached' })
      await home.emulateMedia({ reducedMotion: 'reduce' })
      await setting.focus()
      assert.notEqual(await home.locator('.guide-setting').evaluate(element => getComputedStyle(element).boxShadow), 'none', 'setting focus remains visible across the full row')
      const switchThumb = setting.locator('[data-slot="switch-thumb"]')
      const checkedTranslate = await switchThumb.evaluate(e => getComputedStyle(e).translate)
      await home.keyboard.press('Space')
      assert.equal(await setting.getAttribute('aria-checked'), 'false')
      await home.waitForFunction(previous => getComputedStyle(document.querySelector('.guide-setting [data-slot="switch-thumb"]')).translate !== previous, checkedTranslate)
      await home.getByText('已关闭', { exact: true }).waitFor()
      if (hasHistory) assert.match(await excerpt.innerText(), /傻逼/)
      await home.reload()
      await home.locator('.guide-cover').waitFor()
      await home.keyboard.press('PageDown')
      await home.locator('.guide-cover').waitFor({ state: 'detached' })
      await setting.waitFor()
      assert.equal(await setting.getAttribute('aria-checked'), 'false', 'preference persists across reload')
      await home.locator('.guide-setting .guide-action-description').click()
      assert.equal(await setting.getAttribute('aria-checked'), 'true', 'clicking the full label toggles exactly once')
      if (hasHistory) {
        await excerpt.waitFor()
        assert.doesNotMatch(await excerpt.innerText(), /傻逼/)
        const history = home.getByRole('link', { name: '历史上的今天' })
        assert.equal(await history.evaluate(link => link.href), new URL(`records?month=${month}&day=${day}`, origin).href)
        await history.click()
        await home.waitForURL(`**/records?month=${month}&day=${day}`)
        await home.locator('#record-r2').waitFor()
      }
      await home.goto(origin)
      await home.locator('.guide-cover').waitFor()
      await home.keyboard.press('Enter')
      await home.locator('.guide-cover').waitFor({ state: 'detached' })
      await home.getByRole('button', { name: '随机记录' }).click()
      await home.waitForURL('**/records*')
      await home.locator('#record-r1, #record-r2').first().waitFor()
      await homeContext.close()
    }
    {
      const historyContext = await contextFor({ admin: true })
      await historyContext.addInitScript(() => {
        if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') return
        window.__homeDraw = Number(sessionStorage.getItem('__homeDraw') ?? '0.01')
        Math.random = () => window.__homeDraw
      })
      const historyPage = await historyContext.newPage()
      const today = await historyPage.evaluate(() => {
        const now = new Date()
        return `2025-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      })
      const firstExcerpt = `第一条历史 ${'中文内容'.repeat(40)} ${'LongEnglishContent'.repeat(20)} ${'1234567890'.repeat(20)}`
      const secondExcerpt = `第二条历史 ${'混合内容ABC123'.repeat(40)}`
      records[0].record_date = today
      records[0].content = firstExcerpt
      records[1].record_date = today
      records[1].content = secondExcerpt
      records[2].record_date = today
      records[2].content = '隐藏记录绝不展示'
      await historyPage.goto(origin)
      await historyPage.locator('.guide-cover').waitFor()
      await historyPage.keyboard.press('Enter')
      await historyPage.locator('.guide-cover').waitFor({ state: 'detached' })
      const historyExcerpt = historyPage.locator('.guide-history-excerpt')
      await historyExcerpt.waitFor()
      assert.equal(await historyExcerpt.innerText(), secondExcerpt, 'the first eligible record can be drawn')
      for (const width of [320, 390, 1280]) {
        await historyPage.setViewportSize({ width, height: 900 })
        const clipping = await historyExcerpt.evaluate(element => {
          const style = getComputedStyle(element)
          return {
            whiteSpace: style.whiteSpace,
            overflow: style.overflow,
            ellipsis: style.textOverflow,
            clipped: element.scrollWidth > element.clientWidth,
            height: element.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(style.lineHeight),
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
          }
        })
        assert.equal(clipping.whiteSpace, 'nowrap')
        assert.equal(clipping.overflow, 'hidden')
        assert.equal(clipping.ellipsis, 'ellipsis')
        assert.equal(clipping.clipped, true, `${width}px long mixed excerpt must show an ellipsis`)
        assert.ok(clipping.height <= clipping.lineHeight + 1, `${width}px excerpt stays one line`)
        assert.equal(clipping.pageOverflow, false, `${width}px excerpt does not expand the page`)
        assert.equal(await historyExcerpt.innerText(), secondExcerpt, 'resizing does not reroll the history record')
      }
      await historyPage.getByRole('switch', { name: '隐藏所有记录中的脏话' }).click()
      assert.equal(await historyExcerpt.innerText(), secondExcerpt, 'preference updates do not reroll the history record')
      await historyPage.emulateMedia({ reducedMotion: 'no-preference' })
      const tip = historyPage.locator('.guide-tip-text')
      const firstTip = await tip.innerText()
      const tipBounds = await historyPage.locator('.guide-tip').boundingBox()
      await historyPage.waitForFunction(() => document.querySelector('.guide-tip-text')?.dataset.switching === 'true', undefined, { polling: 'raf', timeout: 8000 })
      assert.equal(await tip.innerText(), firstTip, 'old tip remains while it fades out')
      await historyPage.waitForTimeout(50)
      const fading = await tip.evaluate(element => ({ opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform }))
      assert.ok(fading.opacity < 1 && fading.opacity > 0, 'the old tip fades out continuously')
      assert.notEqual(fading.transform, 'none', 'the old tip moves slightly during the fade')
      await historyPage.waitForFunction(previous => {
        const element = document.querySelector('.guide-tip-text')
        return element?.dataset.switching !== 'true' && element?.textContent !== previous
      }, firstTip)
      await historyPage.waitForFunction(() => Number(getComputedStyle(document.querySelector('.guide-tip-text')).opacity) === 1)
      assert.equal(await historyPage.locator('.guide-tip-text').count(), 1, 'tip transitions use one text node')
      const nextBounds = await historyPage.locator('.guide-tip').boundingBox()
      assert.ok(Math.abs(nextBounds.height - tipBounds.height) <= 1 && Math.abs(nextBounds.y - tipBounds.y) <= 1, 'tip switching keeps the module position and height')
      assert.equal(await historyExcerpt.innerText(), secondExcerpt, 'automatic tip changes do not reroll history')
      await historyPage.evaluate(() => { sessionStorage.setItem('__homeDraw', '0.99') })
      await historyPage.getByRole('link', { name: '历史上的今天' }).click()
      await historyPage.waitForURL('**/records?month=*')
      await historyPage.goto(origin)
      await historyPage.locator('.guide-cover').waitFor()
      await historyPage.keyboard.press('Enter')
      await historyPage.locator('.guide-cover').waitFor({ state: 'detached' })
      assert.equal(await historyExcerpt.innerText(), firstExcerpt, 're-entering the guide draws another eligible record')
      assert.notEqual(await historyExcerpt.innerText(), records[2].content, 'hidden records never enter the draw')
      await historyContext.close()
    }
    if (engine === chromium) {
      const touchContext = await contextFor({ admin: true, mobile: true })
      const touchPage = await touchContext.newPage()
      await touchPage.goto(origin)
      await touchPage.locator('.guide-cover').waitFor()
      const input = await touchContext.newCDPSession(touchPage)
      const touch = (type, y) => input.send('Input.dispatchTouchEvent', {
        type, touchPoints: y === undefined ? [] : [{ x: 195, y }],
      })
      await touch('touchStart', 550)
      await touch('touchMove', 515)
      assert.equal(await touchPage.locator('.guide-cover').count(), 1, 'short touch motion is below the threshold')
      await touch('touchMove', 460)
      await touch('touchEnd')
      await touchPage.locator('.guide-cover').waitFor({ state: 'detached' })
      await touch('touchStart', 250)
      await touch('touchMove', 550)
      await touch('touchEnd')
      assert.equal(await touchPage.locator('.guide-cover').count(), 0, 'touch pullback cannot reopen the cover')
      assert.equal(await touchPage.locator('#root').evaluate(e => e.inert), false)
      await touchPage.emulateMedia({ reducedMotion: 'no-preference' })
      await touchPage.reload()
      await touchPage.locator('.guide-cover').waitFor()
      const mobileLogoStart = await touchPage.locator('.guide-masthead').boundingBox()
      await touch('touchStart', 550)
      await touch('touchMove', 460)
      await touch('touchEnd')
      await touchPage.waitForTimeout(300)
      const mobileLogoExit = await touchPage.locator('.guide-masthead').evaluate(element => ({
        opacity: Number(getComputedStyle(element).opacity),
        y: element.getBoundingClientRect().y,
      }))
      assert.ok(mobileLogoExit.opacity > 0 && mobileLogoExit.opacity < 1 && mobileLogoExit.y < mobileLogoStart.y, 'mobile logo visibly moves and fades before unmount')
      await touchPage.locator('.guide-cover').waitFor({ state: 'detached' })
      await touchPage.reload()
      await touchPage.locator('.guide-cover').waitFor()
      await touchPage.evaluate(url => {
        history.pushState({}, '', url)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, new URL('records', origin).href)
      await touchPage.locator('.guide-cover').waitFor({ state: 'detached' })
      assert.equal(await touchPage.locator('#root').evaluate(e => e.inert), false, 'route unmount clears inert')
      assert.equal(await touchPage.evaluate(() => document.documentElement.style.overflow), '', 'route unmount clears the scroll lock')
      assert.notEqual(await touchPage.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth), 'none', 'guide scrollbar styling does not leak to other routes')
      await touchContext.close()
    }
    records.forEach((record, index) => Object.assign(record, originals[index]))
    assert.equal(starRequests, beforeStars, 'home no longer loads project statistics')
    console.log('Home passed: conditional history, hidden records, filtered preview, responsive presence/absence, keyboard setting, persistence and date navigation.')
  }
  {
    const cacheContext = await contextFor()
    const cachedPage = await cacheContext.newPage()
    await cachedPage.addInitScript(() => {
      window.__performance = { shifts: 0, longTasks: [], lcp: 0 }
      for (const type of ['layout-shift', 'longtask', 'largest-contentful-paint']) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (type === 'layout-shift' && !entry.hadRecentInput) window.__performance.shifts += entry.value
            if (type === 'longtask') window.__performance.longTasks.push(entry.duration)
            if (type === 'largest-contentful-paint') window.__performance.lcp = entry.startTime
          }
        }).observe({ type, buffered: true })
      }
    })
    const originalContent = records[0].content
    records[0].content += ' [[illu:offscreen-proof.jpg]]'
    const since = networkEvents.length
    versionDelay = 300
    await cachedPage.goto(origin + 'records')
    await waitCards(cachedPage, 4)
    const cold = networkEvents.slice(since)
    const business = (events) => events.filter((e) => /\/class_|get_class_record_order/.test(e.path))
    const versions = (events) => events.filter((e) => e.path.endsWith('get_class_data_version'))
    assert.equal(versions(cold).length, 1, 'cold concurrent readers share one initial version check')
    assert.equal(cold.some((e) => e.path.includes('offscreen-proof')), false, 'known dimensions must avoid offscreen image downloads')
    assert.ok(cold.some((e) => e.path.endsWith('record-media-dimensions.txt')), 'record data loads the protected dimensions manifest')
    assert.equal(new Set(business(cold).map((e) => e.path)).size, business(cold).length, 'cold business loads are deduplicated')
    const grant = await cachedPage.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')))
    const warmStart = networkEvents.length
    await cachedPage.reload()
    await waitCards(cachedPage, 4)
    const warm = networkEvents.slice(warmStart)
    assert.equal(versions(warm).length, 1, 'full reload checks the version once')
    assert.equal(business(warm).length, 0, 'unchanged reload uses cached business data exclusively')
    // Persistence writes are asynchronous; verify they have landed before simulating a reopened tab.
    await cachedPage.waitForFunction(async () => {
      const prefix = 'classRecord:dataCache:v6:'
      const keys = Object.keys(sessionStorage).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
      if (!keys.length) return false
      const access = JSON.parse(localStorage.getItem('classRecord:inviteAccess'))
      const scope = `v6:access-${access.authorizedAt}:`
      const required = ['records:false', 'page-messages', 'page-supplements', 'record-page-positions:false'].map((key) => scope + key)
      const database = await new Promise((resolve) => {
        const request = indexedDB.open('classRecord-data-cache-v2', 1)
        request.onsuccess = () => resolve(request.result)
        request.onerror = request.onblocked = () => resolve(null)
      })
      if (!database) return false
      const stored = await new Promise((resolve) => {
        const request = database.transaction('entries', 'readonly').objectStore('entries').getAll()
        request.onsuccess = () => resolve(new Map(request.result.map((entry) => [entry.key, entry])))
        request.onerror = () => resolve(new Map())
      })
      database.close()
      return required.every((key) => stored.has(key)) && keys.every((key) => {
        const session = JSON.parse(sessionStorage.getItem(prefix + key))
        const entry = stored.get(key)
        return entry && entry.time === session.time && entry.version === session.version
      })
    })
    const reopenWithoutSession = async () => {
      const reopenedPage = await cacheContext.newPage()
      await reopenedPage.addInitScript(() => {
        window.__initialCacheKeys = Object.keys(sessionStorage).filter((key) => key.startsWith('classRecord:dataCache:v6:'))
      })
      const reopenedStart = networkEvents.length
      await reopenedPage.goto(origin + 'records')
      await waitCards(reopenedPage, 4)
      assert.deepEqual(await reopenedPage.evaluate(() => window.__initialCacheKeys), [], 'reopened page starts without session cache')
      const reopenedBusiness = business(networkEvents.slice(reopenedStart))
      await reopenedPage.close()
      return reopenedBusiness
    }
    const reopenedBusiness = await reopenWithoutSession()
    if (reopenedBusiness.length) {
      const retryBusiness = await reopenWithoutSession()
      assert.equal(retryBusiness.length, 0, `reopened site must reuse IndexedDB after a transient read failure: ${JSON.stringify({ reopenedBusiness, retryBusiness })}`)
    }
    businessVersion = '2'
    records[0].content += ' 再次进入前已更新'
    const updatedStart = networkEvents.length
    await cachedPage.reload()
    await cachedPage.getByText('再次进入前已更新', { exact: false }).waitFor()
    const updated = networkEvents.slice(updatedStart)
    assert.equal(versions(updated).length, 1)
    assert.equal(business(updated).length, business(cold).length, 'new revision loads each resource once, without an old-data first pass')
    versionDelay = 0
    versionFailure = true
    const failedStart = networkEvents.length
    await cachedPage.reload()
    await cachedPage.getByText('再次进入前已更新', { exact: false }).waitFor()
    assert.equal(business(networkEvents.slice(failedStart)).length, 0, 'version outage keeps valid cached content usable')
    const after = await cachedPage.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')))
    assert.equal(after.token, grant.token)
    assert.equal(after.authorizedAt, grant.authorizedAt)
    const metrics = await cachedPage.evaluate(() => ({ ...window.__performance, resources: performance.getEntriesByType('resource').length }))
    console.log('Cache entry performance:', JSON.stringify({ coldBusinessReads: business(cold).length, warmBusinessReads: business(warm).length, versionChecksPerEntry: versions(warm).length, ...metrics }))
    versionFailure = false
    businessVersion = '1'
    records[0].content = originalContent
    await cacheContext.close()
  }
  if (!process.env.CLASS_RECORD_PREVIEW) {
    const tabs = await contextFor()
    const first = await tabs.newPage()
    const second = await tabs.newPage()
    const now = new Date()
    await first.clock.install({ time: now })
    await second.clock.install({ time: now })
    await first.goto(origin + 'records')
    await waitCards(first, 4)
    await second.goto(origin + 'materials')
    await second.getByText('资料正文', { exact: false }).waitFor()
    await first.waitForFunction(() => localStorage.getItem('classRecord:businessVersion') === '1')
    const grantBefore = await first.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')))
    await first.evaluate(async (origin) => {
      const { signAssetUrl } = await import(origin + 'src/services/data.ts')
      const { preloadImageDimensions, preloadMediaManifest } = await import(origin + 'src/services/image-metadata.ts')
      await preloadMediaManifest()
      await signAssetUrl('data/attachments/cache-proof.png')
      await preloadImageDimensions('data/attachments/cache-proof.png')
      await (await caches.open('static-proof')).put('/static-proof', new Response('preserved'))
      window.__recordNode = document.querySelector('#record-r1')
    }, origin)
    await second.evaluate(async (origin) => {
      const { preloadMediaManifest } = await import(origin + 'src/services/image-metadata.ts')
      await preloadMediaManifest()
    }, origin)
    const imageSignCount = () => requests.filter((path) => path.includes('/storage/v1/object/sign/') && !path.endsWith('record-media-dimensions.txt')).length
    const businessCount = () => requests.filter((path) => /\/class_|get_class_record_order/.test(path)).length
    const authCount = () => requests.filter((path) => path.endsWith('refresh_invite_access')).length
    const initialReads = businessCount()
    const initialAuth = authCount()
    const initialSigns = imageSignCount()
    await first.clock.fastForward(60_000)
    await new Promise((resolve) => setTimeout(resolve, 250))
    assert.equal(businessCount(), initialReads, 'unchanged version must not reload any business data')
    assert.ok(authCount() <= initialAuth + 2, 'same-token storage notifications must not cause an auth request storm')
    // A hidden second tab does not poll; it still receives the revision broadcast.
    await second.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }))
    records[0].content += ' 数据版本已更新'
    tables.class_materials[0].content = '更新后的资料正文'
    people[0].name = '人物一更新'
    businessVersion = '2'
    businessDelay = 200
    await first.clock.fastForward(60_000)
    assert.ok(await first.locator('#record-r1').count(), 'existing records stay mounted during revalidation')
    await first.getByText('数据版本已更新', { exact: false }).first().waitFor()
    await second.getByText('更新后的资料正文', { exact: false }).waitFor()
    businessDelay = 0
    assert.equal(await first.evaluate(() => document.querySelector('#record-r1') === window.__recordNode), true, 'background refresh updates in place')
    assert.equal(await second.evaluate(() => localStorage.getItem('classRecord:businessVersion')), '2')
    await first.evaluate(async (origin) => {
      const { signAssetUrl } = await import(origin + 'src/services/data.ts')
      const { getImageDimensions } = await import(origin + 'src/services/image-metadata.ts')
      await signAssetUrl('data/attachments/cache-proof.png')
      if (!getImageDimensions('data/attachments/cache-proof.png')) throw new Error('image dimensions were discarded')
      if (!(await caches.match('/static-proof'))) throw new Error('static cache was discarded')
    }, origin)
    assert.equal(imageSignCount(), initialSigns, 'database changes must not re-sign unchanged images')
    const grantAfter = await first.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')))
    assert.equal(grantAfter.token, grantBefore.token)
    assert.equal(grantAfter.authorizedAt, grantBefore.authorizedAt)
    assert.equal(await first.getByLabel('邀请码', { exact: true }).count(), 0)
    const readsAfter = businessCount()
    await first.clock.fastForward(60_000)
    await new Promise((resolve) => setTimeout(resolve, 250))
    assert.equal(businessCount(), readsAfter, 'settled version must not create a refresh loop')
    await first.reload()
    await first.getByText('数据版本已更新', { exact: false }).first().waitFor()
    assert.equal((await first.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')))).token, grantBefore.token, 'page refresh retains access')
    await first.goto(origin + 'people')
    await first.getByRole('link', { name: '人物一更新', exact: true }).waitFor()
    await tabs.close()
    console.log('Business updates passed: open clients, hidden second tab, retained credentials, reload, in-place UI, idle dedupe, image/static cache preservation.')
  }
  assert.deepEqual(problems, [], 'browser console and page errors')
  console.log(`Application browser regression passed (${engine === webkit ? 'WebKit' : 'Chromium'}): routes, stream order, permissions, annotations, nested images, keyboard and mobile; API requests=${requests.length}.`)
} catch (error) {
  if (process.env.GITHUB_ACTIONS) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`::error title=Application browser regression::${message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`)
  }
  throw error
} finally {
  await browser.close()
  if ('close' in vite) await vite.close()
  else await new Promise((resolve) => vite.httpServer.close(resolve))
}
