import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'

import { chromium } from 'playwright'
import { createServer } from 'vite'

import { assertFullscreenImageViewer } from './layout/assert-image-viewer.mjs'
import { findSystemChromium } from './layout/browser-runtime.mjs'
import { markupLayoutHarness } from './layout/markup-layout-harness.mjs'
import { frontend } from './test-react-helpers.mjs'

function withoutDeploymentBase(assetPath) {
  const publicAssetStart = assetPath.indexOf('/images/')
  return publicAssetStart >= 0 ? assetPath.slice(publicAssetStart) : assetPath
}

const layoutReadyTimeoutMs = 90_000

async function waitForMarkupLayoutReady(
  page,
  { pageErrors = [], consoleProblems = [] } = {},
) {
  await page
    .waitForFunction(() => window.__markupLayoutReady === true, undefined, {
      timeout: layoutReadyTimeoutMs,
    })
    .catch((error) => {
      error.message += `\nBrowser page errors: ${pageErrors.join('; ') || 'none'}\nBrowser console problems: ${consoleProblems.join('; ') || 'none'}`
      throw error
    })
}

const vite = await createServer({
  configFile: path.join(frontend, 'vite.config.ts'),
  root: frontend,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/' && !url.searchParams.has('html-proxy')) {
    try {
      const html = await vite.transformIndexHtml('/', markupLayoutHarness)
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(html)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(String(error))
    }
    return
  }
  vite.middlewares(request, response, () => {
    response.writeHead(404)
    response.end('Not found')
  })
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert.ok(address && typeof address === 'object')
const origin = `http://127.0.0.1:${address.port}`
if (process.env.CLASS_RECORD_LAYOUT_SERVER_ONLY === '1') {
  console.log(`CLASS_RECORD_LAYOUT_ORIGIN=${origin}`)
  await new Promise((resolve) => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  await vite.close()
  process.exit(0)
}
const systemEdge = await findSystemChromium()
const browser = await chromium.launch({ headless: true, executablePath: systemEdge })


try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const pageErrors = []
  const consoleProblems = []
  const imageRequests = []
  const storageRequests = []
  let expectedHarnessNetworkFailures = 0
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    if (request.url().includes('/storage/v1/object/sign/')) {
      storageRequests.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        url: request.url(),
        resourceType: request.resourceType(),
        postData: request.postData() || '',
      })
    }
    if (request.resourceType() !== 'image') return
    try {
      imageRequests.push(new URL(request.url()).pathname)
    } catch {
      imageRequests.push(request.url())
    }
  })
  await page.route('**/storage/v1/object/sign/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    if (request.method() === 'POST') {
      const requestBody = JSON.parse(request.postData() || '{}')
      const rendition = requestBody.transform ? 'preview' : 'original'
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          signedURL: `${url.pathname.replace('/storage/v1', '')}?token=layout-image&rendition=${rendition}`,
        }),
      })
      return
    }
    if (
      request.method() === 'GET' &&
      /\/fixtures\/progressive-(?:original|cancel)\.svg$/u.test(url.pathname) &&
      url.searchParams.get('rendition') === 'original'
    ) {
      await new Promise((resolve) => setTimeout(resolve, 180))
    }
    const svg = url.pathname.endsWith('/fixtures/quiz-wide.svg')
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="#233a5b"/></svg>'
      : url.pathname.endsWith('/fixtures/quiz-tall.svg')
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200" viewBox="0 0 600 1200"><rect width="600" height="1200" fill="#7a4f68"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200"><rect width="1600" height="1200" fill="#233a5b"/><circle cx="800" cy="600" r="320" fill="#7ac7c4"/></svg>'
    await route.fulfill({
      status: 200,
      headers: {
        ...corsHeaders,
        'cache-control': 'public, max-age=3600, immutable',
        'content-type': 'image/svg+xml',
      },
      body: svg,
    })
  })
  page.on('console', (message) => {
    if (/^Failed to load resource: the server responded with a status of 400/u.test(message.text())) {
      expectedHarnessNetworkFailures += 1
      return
    }
    if (message.type() === 'error' || message.type() === 'warning')
      consoleProblems.push(`${message.type()}: ${message.text()}`)
  })
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await waitForMarkupLayoutReady(page, { pageErrors, consoleProblems })
  assert.deepEqual(pageErrors, [], `browser page errors during initial render: ${pageErrors.join('; ')}`)
  assert.equal(await page.title(), '编日史 · 导览')
  for (const [route, title] of [
    ['/records', '编日史 · 记录'],
    ['/person?id=p01', '编日史 · 人物'],
    ['/credits', '编日史 · 致谢'],
    ['/unknown', '编日史 · 错误'],
    ['/', '编日史 · 导览'],
  ]) {
    await page.evaluate((nextRoute) => window.__memoryNavigate(nextRoute), route)
    await page.waitForFunction((expected) => document.title === expected, title)
  }

  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-secret-image-case] img[alt="题目插图"]')].every(
      (image) => image.naturalWidth > 0 && getComputedStyle(image).opacity === '1',
    ),
  )
  const readSecretImageGeometry = () =>
    page.locator('[data-secret-image-case]').evaluateAll((cases) =>
      cases.map((item) => {
        const trigger = item.querySelector('button[aria-label="查看题目插图大图"]')
        const frame = trigger?.firstElementChild
        const image = frame?.querySelector('img[alt="题目插图"]')
        const itemBounds = item.getBoundingClientRect()
        const triggerBounds = trigger?.getBoundingClientRect()
        const frameBounds = frame?.getBoundingClientRect()
        const imageBounds = image?.getBoundingClientRect()
        return {
          id: item.getAttribute('data-secret-image-case'),
          itemWidth: itemBounds.width,
          centerDelta: triggerBounds
            ? Math.abs(
                triggerBounds.left + triggerBounds.width / 2 -
                  (itemBounds.left + itemBounds.width / 2),
              )
            : Number.POSITIVE_INFINITY,
          triggerWidth: triggerBounds?.width || 0,
          triggerHeight: triggerBounds?.height || 0,
          frameWidth: frameBounds?.width || 0,
          frameHeight: frameBounds?.height || 0,
          imageWidth: imageBounds?.width || 0,
          imageHeight: imageBounds?.height || 0,
          overflow: frame ? frame.scrollWidth - frame.clientWidth : Number.POSITIVE_INFINITY,
        }
      }),
    )
  const assertSecretImageGeometry = (geometry, label) => {
    assert.equal(geometry.length, 2, `${label} must render both hidden-image aspect ratios`)
    for (const item of geometry) {
      assert.ok(item.centerDelta <= 1, `${label} ${item.id} hidden image must be horizontally centered: ${JSON.stringify(item)}`)
      assert.ok(
        Math.abs(item.triggerWidth - item.frameWidth) <= 2.1 &&
          Math.abs(item.triggerHeight - item.frameHeight) <= 2.1,
        `${label} ${item.id} clickable frame must tightly wrap the displayed image: ${JSON.stringify(item)}`,
      )
      assert.ok(
        Math.abs(item.frameWidth - item.imageWidth) <= 1 &&
          Math.abs(item.frameHeight - item.imageHeight) <= 1,
        `${label} ${item.id} preview must fill its aspect-ratio frame without extra blank space: ${JSON.stringify(item)}`,
      )
      assert.ok(item.triggerWidth < item.itemWidth - 16, `${label} ${item.id} frame must not be forced to the full content width`)
      assert.ok(item.overflow <= 1, `${label} ${item.id} hidden image must not overflow its frame`)
    }
    const wide = geometry.find((item) => item.id === 'wide')
    const tall = geometry.find((item) => item.id === 'tall')
    assert.ok(wide && Math.abs(wide.imageWidth / wide.imageHeight - 2) <= 0.02)
    assert.ok(tall && Math.abs(tall.imageWidth / tall.imageHeight - 0.5) <= 0.02)
  }
  assertSecretImageGeometry(await readSecretImageGeometry(), '1280px')
  for (const name of ['quiz-wide.svg', 'quiz-tall.svg']) {
    const requestPath = `/storage/v1/object/sign/classrecord-private/fixtures/${name}`
    const signs = storageRequests.filter(
      (request) => request.method === 'POST' && request.path === requestPath,
    )
    assert.equal(signs.length, 1, `${name} compressed preview must be signed exactly once`)
    assert.equal(JSON.parse(signs[0].postData).transform?.width, 960)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(50)
  assertSecretImageGeometry(await readSecretImageGeometry(), '390px')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.waitForTimeout(50)
  const wideSecretTrigger = page
    .locator('[data-secret-image-case="wide"]')
    .getByRole('button', { name: '查看题目插图大图' })
  await wideSecretTrigger.click()
  const secretImageDialog = page.locator('.image-viewer-dialog[data-slot="dialog-content"]')
  await secretImageDialog.waitFor({ state: 'visible' })
  await page.waitForFunction(() =>
    document
      .querySelector('.image-viewer-dialog img[alt="题目插图"]')
      ?.src.includes('/fixtures/quiz-wide.svg'),
  )
  const wideSecretPath = '/storage/v1/object/sign/classrecord-private/fixtures/quiz-wide.svg'
  const wideOriginalSigns = storageRequests.filter(
    (request) =>
      request.method === 'POST' &&
      request.path === wideSecretPath &&
      !JSON.parse(request.postData).transform,
  )
  assert.equal(wideOriginalSigns.length, 1, 'opening one hidden image must sign only its matching original')
  assert.equal(
    storageRequests.filter(
      (request) =>
        request.method === 'POST' &&
        request.path.endsWith('/fixtures/quiz-tall.svg') &&
        !JSON.parse(request.postData).transform,
    ).length,
    0,
    'opening the wide hidden image must not sign another hidden image original',
  )
  await page.getByRole('button', { name: '关闭大图' }).click()
  await secretImageDialog.waitFor({ state: 'hidden' })
  await wideSecretTrigger.click()
  await secretImageDialog.waitFor({ state: 'visible' })
  assert.match(
    (await secretImageDialog.locator('img[alt="题目插图"]').getAttribute('src')) || '',
    /rendition=original/,
    'reopening a decoded hidden image must display the cached original immediately',
  )
  await page.waitForFunction(() =>
    document
      .querySelector('.image-viewer-dialog img[alt="题目插图"]')
      ?.src.includes('/fixtures/quiz-wide.svg'),
  )
  assert.equal(
    storageRequests.filter(
      (request) =>
        request.method === 'POST' &&
        request.path === wideSecretPath &&
        !JSON.parse(request.postData).transform,
    ).length,
    1,
    'reopening a hidden image must reuse its signed original URL during the same session',
  )
  await page.getByRole('button', { name: '关闭大图' }).click()
  await secretImageDialog.waitFor({ state: 'hidden' })

  const segmentedMotionFixture = page.getByRole('tablist', { name: '分段切换动画测试' })
  const firstSegment = segmentedMotionFixture.getByRole('tab', { name: '第一个模式' })
  const secondSegment = segmentedMotionFixture.getByRole('tab', { name: '第二个模式' })
  const readSegmentedAlignment = () => segmentedMotionFixture.evaluate((list) => {
    const indicator = list.querySelector('.app-selection-indicator')?.getBoundingClientRect()
    const active = list.querySelector('[data-slot="tabs-trigger"][data-active]')?.getBoundingClientRect()
    return {
      activeLabel: list.querySelector('[data-slot="tabs-trigger"][data-active]')?.textContent?.trim(),
      centerDelta: indicator && active
        ? Math.abs(indicator.left + indicator.width / 2 - (active.left + active.width / 2))
        : Number.POSITIVE_INFINITY,
      sizeDelta: indicator && active
        ? Math.max(Math.abs(indicator.width - active.width), Math.abs(indicator.height - active.height))
        : Number.POSITIVE_INFINITY,
      switching: list.hasAttribute('data-selection-switching'),
      animationIds: list.getAnimations({ subtree: true }).map((animation) => animation.id).filter(Boolean),
    }
  })
  const initialSegmentedAlignment = await readSegmentedAlignment()
  assert.equal(initialSegmentedAlignment.activeLabel, '第一个模式')
  assert.ok(initialSegmentedAlignment.centerDelta <= 1 && initialSegmentedAlignment.sizeDelta <= 1)
  await secondSegment.click()
  const movingSegmentedState = await readSegmentedAlignment()
  assert.equal(movingSegmentedState.switching, true)
  assert.deepEqual(movingSegmentedState.animationIds, ['app-selection-move'])
  await firstSegment.click()
  await secondSegment.click()
  await firstSegment.click()
  const interruptedSegmentedState = await readSegmentedAlignment()
  assert.equal(interruptedSegmentedState.activeLabel, '第一个模式')
  assert.ok(
    interruptedSegmentedState.animationIds.length <= 1,
    `rapid segmented switching must retain one interruptible animation: ${JSON.stringify(interruptedSegmentedState)}`,
  )
  await page.waitForTimeout(260)
  const settledSegmentedAlignment = await readSegmentedAlignment()
  assert.ok(
    settledSegmentedAlignment.centerDelta <= 1 && settledSegmentedAlignment.sizeDelta <= 1,
    `the moving selected surface must settle exactly on its shadcn trigger: ${JSON.stringify(settledSegmentedAlignment)}`,
  )
  await page.locator('[data-segmented-motion-fixture]').evaluate((fixture) => {
    fixture.style.width = '17rem'
  })
  await page.waitForTimeout(50)
  const resizedSegmentedAlignment = await readSegmentedAlignment()
  assert.ok(
    resizedSegmentedAlignment.centerDelta <= 1 && resizedSegmentedAlignment.sizeDelta <= 1,
    `the selected surface must remeasure its real trigger after responsive resizing: ${JSON.stringify(resizedSegmentedAlignment)}`,
  )
  await page.locator('[data-segmented-motion-fixture]').evaluate((fixture) => {
    fixture.style.width = '24rem'
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await secondSegment.click()
  const reducedSegmentedState = await readSegmentedAlignment()
  assert.equal(reducedSegmentedState.switching, false)
  assert.deepEqual(reducedSegmentedState.animationIds, [])
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const orderControlState = (control) =>
    control.evaluate((list) => {
      const indicator = list.querySelector('.app-selection-indicator')?.getBoundingClientRect()
      const active = list.querySelector('[data-slot="tabs-trigger"][data-active]')?.getBoundingClientRect()
      return {
        active: list.querySelector('[data-slot="tabs-trigger"][data-active]')?.textContent?.trim(),
        centerDelta: indicator && active
          ? Math.abs(indicator.left + indicator.width / 2 - (active.left + active.width / 2))
          : Number.POSITIVE_INFINITY,
        sizeDelta: indicator && active
          ? Math.max(Math.abs(indicator.width - active.width), Math.abs(indicator.height - active.height))
          : Number.POSITIVE_INFINITY,
        switching: list.hasAttribute('data-selection-switching'),
        animationIds: list.getAnimations({ subtree: true }).map((animation) => animation.id).filter(Boolean),
      }
    })

  const peopleFixture = page.locator('[data-case="people"]')
  const peopleOrderControls = peopleFixture.getByRole('tablist', { name: /显示顺序/ })
  assert.equal(
    await peopleOrderControls.count(),
    await peopleFixture.locator('[data-people-role]').count(),
    'every visible people-list section must expose the shared order control',
  )
  const studentOrderControl = peopleFixture.getByRole('tablist', { name: '同学显示顺序' })
  const studentNames = () =>
    peopleFixture
      .locator('[data-people-role="student"] tbody tr a')
      .evaluateAll((links) => links.map((link) => link.textContent?.trim()))
  assert.deepEqual(await studentNames(), ['人物一', '人物二'])
  assert.equal((await orderControlState(studentOrderControl)).active, '正序')
  await studentOrderControl.getByRole('tab', { name: '逆序' }).click()
  const movingStudentOrder = await orderControlState(studentOrderControl)
  assert.equal(movingStudentOrder.switching, true)
  assert.deepEqual(movingStudentOrder.animationIds, ['app-selection-move'])
  assert.deepEqual(await studentNames(), ['人物二', '人物一'])
  await page.waitForTimeout(260)
  const settledStudentOrder = await orderControlState(studentOrderControl)
  assert.ok(
    settledStudentOrder.centerDelta <= 1 && settledStudentOrder.sizeDelta <= 1,
    `student order selection did not settle: ${JSON.stringify(settledStudentOrder)}`,
  )

  const teacherOrderControl = peopleFixture.getByRole('tablist', { name: '老师显示顺序' })
  assert.equal((await orderControlState(teacherOrderControl)).active, '正序')
  await teacherOrderControl.getByRole('tab', { name: '逆序' }).click()
  assert.equal((await orderControlState(teacherOrderControl)).switching, true)
  await page.waitForTimeout(260)
  const settledTeacherOrder = await orderControlState(teacherOrderControl)
  assert.ok(
    settledTeacherOrder.centerDelta <= 1 && settledTeacherOrder.sizeDelta <= 1,
    `teacher order selection did not settle: ${JSON.stringify(settledTeacherOrder)}`,
  )

  await page.evaluate(() => window.__memoryNavigate('/person?id=p1'))
  await page.waitForFunction(() => document.title === '编日史 · 人物 · 人物一')
  const personFixture = page.locator('[data-case="person"]')
  const personOrderControl = personFixture.getByRole('tablist', {
    name: '人物相关记录显示顺序',
  })
  await personOrderControl.waitFor({ state: 'visible' })
  assert.equal((await orderControlState(personOrderControl)).active, '逆序')
  await personOrderControl.getByRole('tab', { name: '正序' }).click()
  const movingPersonOrder = await orderControlState(personOrderControl)
  assert.equal(movingPersonOrder.switching, true)
  assert.deepEqual(movingPersonOrder.animationIds, ['app-selection-move'])
  await page.waitForTimeout(260)
  const settledPersonOrder = await orderControlState(personOrderControl)
  assert.ok(
    settledPersonOrder.centerDelta <= 1 && settledPersonOrder.sizeDelta <= 1,
    `person order selection did not settle: ${JSON.stringify(settledPersonOrder)}`,
  )
  await page.evaluate(() => window.__memoryNavigate('/'))
  await page.waitForFunction(() => document.title === '编日史 · 导览')

  const nestedRedaction = page.locator('[data-case="nested-redaction"] .record-redacted')
  const nestedRedactionLink = nestedRedaction.locator('.markup-link').first()
  const concealedNestedRedaction = await nestedRedactionLink.evaluate((link) => ({
    color: getComputedStyle(link).color,
    decoration: getComputedStyle(link).textDecorationColor,
  }))
  assert.match(
    concealedNestedRedaction.color,
    /(?:rgba\(0, 0, 0, 0\)|\/ 0\))$/,
    `nested reference color must remain concealed by its parent redaction: ${JSON.stringify(concealedNestedRedaction)}`,
  )
  await nestedRedaction.hover()
  const revealedNestedRedaction = await nestedRedactionLink.evaluate((link) => ({
    color: getComputedStyle(link).color,
    decoration: getComputedStyle(link).textDecorationColor,
  }))
  assert.notEqual(
    revealedNestedRedaction.color,
    concealedNestedRedaction.color,
    'hovering a redaction must reveal the recursively rendered reference without replacing it',
  )
  await page.mouse.move(4, 4)

  const recordsFixture = page.locator('[data-case="records"]')
  await page.setViewportSize({ width: 600, height: 1000 })
  await page.waitForTimeout(50)
  const recordOrderTabs = recordsFixture.getByRole('tablist', { name: '记录显示顺序' })
  const visibleRecordIds = () =>
    recordsFixture.locator('.record-surface').evaluateAll((records) => records.map((record) => record.id))
  assert.deepEqual(await visibleRecordIds(), ['record-r3', 'record-r2', 'record-r1'])
  await recordOrderTabs.getByRole('tab', { name: '正序' }).click()
  assert.deepEqual(await visibleRecordIds(), ['record-r1', 'record-r2', 'record-r3'])
  await recordOrderTabs.getByRole('tab', { name: '逆序' }).click()
  assert.deepEqual(await visibleRecordIds(), ['record-r3', 'record-r2', 'record-r1'])
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.waitForTimeout(50)
  const sourceJump = recordsFixture.getByRole('button', {
    name: '在书面记录中查看#r3',
  })
  await sourceJump.scrollIntoViewIfNeeded()
  await sourceJump.hover()
  const sourceJumpBounds = await sourceJump.boundingBox()
  assert.ok(sourceJumpBounds, 'record source control must be visible before its real pointer click')
  await page.evaluate(() => {
    window.__recordNativeScrollTo = window.scrollTo.bind(window)
    window.__recordScrollCalls = []
    window.scrollTo = (...args) => {
      window.__recordScrollCalls.push({ args, current: window.scrollY, time: performance.now() })
      return window.__recordNativeScrollTo(...args)
    }
    window.__recordScrollSamples = [window.scrollY]
    window.__recordScrollListener = () => window.__recordScrollSamples.push(window.scrollY)
    window.addEventListener('scroll', window.__recordScrollListener, { passive: true })
  })
  await page.mouse.click(
    sourceJumpBounds.x + sourceJumpBounds.width / 2,
    sourceJumpBounds.y + sourceJumpBounds.height / 2,
  )
  await recordsFixture.locator('#record-r3').waitFor({ state: 'visible' })
  await page.getByRole('alertdialog').waitFor({ state: 'visible' })
  const recordJumpLocation = await page.evaluate(() => window.__memoryLocation)
  assert.equal(
    recordJumpLocation,
    '/records?view=written',
    'client routing must not publish a live fragment before the target is measured',
  )
  assert.equal(
    await page.evaluate(() => window.location.hash),
    '#record-r3',
    'the shareable fragment must be written only after exact positioning',
  )
  assert.equal(
    await recordsFixture.getByText('未找到要跳转的记录，请检查来源是否仍然存在。').count(),
    0,
    'same-route list-to-written source jumps must not discard their anchor before written data loads',
  )
  assert.match(
    (await recordsFixture.getByText(/第 2 页/).first().textContent()) || '',
    /第 2 页/,
    'a source jump must switch to the written page that actually contains the record',
  )
  const writtenPageSelector = recordsFixture.getByLabel('跳转书面页')
  assert.match(
    (await writtenPageSelector.textContent()) || '',
    /第 2 页/,
    'the written page selector must display the actual one-based page instead of its zero-based index',
  )
  const initialJumpHighlight = await recordsFixture.locator('#record-r3').evaluate((target) => {
    const style = getComputedStyle(target)
    return {
      active: target.getAttribute('data-record-jump-highlight'),
      cycle: target.getAttribute('data-record-jump-cycle'),
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
    }
  })
  assert.equal(
    initialJumpHighlight.active,
    'true',
    'the located record must expose one semantic highlight state after scrolling settles',
  )
  assert.equal(
    initialJumpHighlight.borderStyle,
    'solid',
    'the located record highlight must retain its real material boundary',
  )
  assert.ok(
    Number.parseFloat(initialJumpHighlight.borderWidth) >= 1,
    `the located record highlight must be clearly visible: ${JSON.stringify(initialJumpHighlight)}`,
  )
  assert.doesNotMatch(
    initialJumpHighlight.borderColor,
    /(?:\/ 0\)|, 0\))$/,
    `the located record highlight must retain theme color: ${JSON.stringify(initialJumpHighlight)}`,
  )
  assert.equal(
    initialJumpHighlight.boxShadow,
    'none',
    'the located record highlight must not use an outer shadow that a scroll container can clip',
  )
  assert.doesNotMatch(
    initialJumpHighlight.backgroundColor,
    /(?:\/ 0\)|, 0\))$/,
    'the located record highlight must reinforce its real border with an in-box surface tint',
  )
  const recordScrollTrajectory = await page.evaluate(() => {
    window.removeEventListener('scroll', window.__recordScrollListener)
    const samples = window.__recordScrollSamples || []
    const calls = window.__recordScrollCalls || []
    window.scrollTo = window.__recordNativeScrollTo
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      samples,
      calls,
      maximum: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
    }
  })
  assert.ok(recordScrollTrajectory.samples.length >= 1, 'record positioning must expose a stable scroll sample')
  assert.equal(recordScrollTrajectory.calls.length, 1, `record positioning must issue one window.scrollTo call: ${JSON.stringify(recordScrollTrajectory)}`)
  assert.equal(recordScrollTrajectory.calls[0]?.args?.[0]?.behavior, 'smooth', 'the single record scroll must remain browser-native smooth movement')
  const recordScrollStart = recordScrollTrajectory.samples[0]
  const recordScrollEnd = recordScrollTrajectory.samples.at(-1)
  assert.ok(
    recordScrollTrajectory.samples.every(
      (value) => value >= -1 && value <= recordScrollTrajectory.maximum + 1,
    ),
    `record positioning must stay inside the real document range: ${JSON.stringify(recordScrollTrajectory)}`,
  )
  if (recordScrollEnd >= recordScrollStart) {
    assert.ok(
      Math.min(...recordScrollTrajectory.samples) >= recordScrollStart - 1 &&
        Math.max(...recordScrollTrajectory.samples) <= recordScrollEnd + 1,
      `record positioning must not overshoot and rebound: ${JSON.stringify(recordScrollTrajectory)}`,
    )
  } else {
    assert.ok(
      Math.max(...recordScrollTrajectory.samples) <= recordScrollStart + 1 &&
        Math.min(...recordScrollTrajectory.samples) >= recordScrollEnd - 1,
      `record positioning must not undershoot and rebound: ${JSON.stringify(recordScrollTrajectory)}`,
    )
  }
  const scrollBeforeDialogClose = await page.evaluate(() => window.scrollY)
  await recordsFixture.locator('#record-r3').evaluate((target) => {
    const transitions = []
    const capture = () => {
      transitions.push({
        at: performance.now(),
        highlight: target.getAttribute('data-record-jump-highlight'),
        pending: target.getAttribute('data-record-jump-pending-fade'),
        fading: target.getAttribute('data-record-jump-fading'),
      })
    }
    const observer = new MutationObserver(capture)
    observer.observe(target, {
      attributes: true,
      attributeFilter: [
        'data-record-jump-highlight',
        'data-record-jump-pending-fade',
        'data-record-jump-fading',
      ],
    })
    window.__recordJumpFadeObserver = observer
    window.__recordJumpFadeTransitions = transitions
    capture()
  })
  await page.getByRole('button', { name: '留在此处' }).click()
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
  const dialogCloseState = await page.evaluate(() => ({
    scrollY: window.scrollY,
    focusedId: document.activeElement?.id || '',
    highlight: document.querySelector('#record-r3')?.getAttribute('data-record-jump-highlight'),
    highlightPending: document
      .querySelector('#record-r3')
      ?.getAttribute('data-record-jump-pending-fade'),
    highlightAnimation: document.querySelector('#record-r3')
      ? getComputedStyle(document.querySelector('#record-r3')).animationName
      : '',
  }))
  assert.ok(
    Math.abs(dialogCloseState.scrollY - scrollBeforeDialogClose) <= 1,
    `closing the jump dialog must not return-scroll to its old trigger: ${JSON.stringify({ scrollBeforeDialogClose, dialogCloseState })}`,
  )
  assert.equal(
    dialogCloseState.focusedId,
    'record-r3',
    'closing the jump dialog must leave focus on the visible record',
  )
  assert.equal(
    dialogCloseState.highlight,
    'true',
    'closing the jump dialog must expose a fresh visible target highlight',
  )
  await page.waitForFunction(
    () =>
      document.querySelector('#record-r3')?.getAttribute('data-record-jump-fading') === 'true',
  )
  const highlightTransitions = await page.evaluate(() => {
    window.__recordJumpFadeObserver?.disconnect()
    const transitions = window.__recordJumpFadeTransitions || []
    delete window.__recordJumpFadeObserver
    delete window.__recordJumpFadeTransitions
    return transitions
  })
  const pendingTransition = highlightTransitions.find((transition) => transition.pending === 'true')
  const fadingTransition = highlightTransitions.find((transition) => transition.fading === 'true')
  assert.ok(
    pendingTransition,
    `the visible record highlight must enter its hold state: ${JSON.stringify(highlightTransitions)}`,
  )
  assert.ok(
    fadingTransition && fadingTransition.at - pendingTransition.at >= 500,
    `the visible record highlight must hold before its fade begins: ${JSON.stringify(highlightTransitions)}`,
  )
  const postJumpScroll = dialogCloseState.scrollY
  const postJumpAnnotation = recordsFixture
    .locator('#record-r3')
    .getByRole('button', { name: '跳转后注释' })
  await postJumpAnnotation.hover()
  await page.locator('.record-annotation-popup[data-open]').waitFor({ state: 'visible' })
  assert.ok(
    Math.abs((await page.evaluate(() => window.scrollY)) - postJumpScroll) <= 1,
    'opening a popover immediately after record location must not move the document',
  )
  await page.mouse.move(4, 4)
  await page.locator('.record-annotation-popup[data-open]').waitFor({ state: 'hidden' })
  const locatedRecordGeometry = await recordsFixture.locator('#record-r3').evaluate((target) => {
    const bounds = target.getBoundingClientRect()
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      viewportHeight,
      scrollY: window.scrollY,
      maximumScroll: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
    }
  })
  assert.ok(
    locatedRecordGeometry.top >= -1 && locatedRecordGeometry.bottom <= locatedRecordGeometry.viewportHeight + 1,
    `the written record target must settle inside the real viewport: ${JSON.stringify(locatedRecordGeometry)}`,
  )
  assert.ok(
    locatedRecordGeometry.scrollY <= locatedRecordGeometry.maximumScroll + 1,
    `record location must not exceed the real document scroll range: ${JSON.stringify(locatedRecordGeometry)}`,
  )

  for (const [sourceId, linkName, targetId] of [
    ['record-r3', '第一条记录', 'record-r1'],
    ['record-r1', '第二条记录', 'record-r2'],
  ]) {
    const repeatLink = recordsFixture
      .locator(`#${sourceId} .record-link`)
      .filter({ hasText: linkName })
    await repeatLink.scrollIntoViewIfNeeded()
    const repeatLinkBounds = await repeatLink.boundingBox()
    assert.ok(repeatLinkBounds, `${sourceId} link must be visible before jumping to ${targetId}`)
    await page.evaluate(() => {
      window.__recordRepeatSamples = [window.scrollY]
      window.__recordRepeatListener = () => window.__recordRepeatSamples.push(window.scrollY)
      window.addEventListener('scroll', window.__recordRepeatListener, { passive: true })
    })
    await page.mouse.click(
      repeatLinkBounds.x + repeatLinkBounds.width / 2,
      repeatLinkBounds.y + repeatLinkBounds.height / 2,
    )
    await recordsFixture.locator(`#${targetId}`).waitFor({ state: 'visible' })
    await page.getByRole('alertdialog').waitFor({ state: 'visible' })
    const repeatTrajectory = await page.evaluate(() => {
      window.removeEventListener('scroll', window.__recordRepeatListener)
      const samples = window.__recordRepeatSamples || []
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      return {
        samples,
        maximum: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
      }
    })
    const repeatStart = repeatTrajectory.samples[0]
    const repeatEnd = repeatTrajectory.samples.at(-1)
    assert.ok(
      repeatTrajectory.samples.every(
        (value) => value >= -1 && value <= repeatTrajectory.maximum + 1,
      ),
      `repeated jump to ${targetId} must stay inside the document: ${JSON.stringify(repeatTrajectory)}`,
    )
    if (repeatEnd >= repeatStart) {
      assert.ok(
        Math.min(...repeatTrajectory.samples) >= repeatStart - 1 &&
          Math.max(...repeatTrajectory.samples) <= repeatEnd + 1,
        `repeated jump to ${targetId} must move downward without overshoot: ${JSON.stringify(repeatTrajectory)}`,
      )
    } else {
      assert.ok(
        Math.max(...repeatTrajectory.samples) <= repeatStart + 1 &&
          Math.min(...repeatTrajectory.samples) >= repeatEnd - 1,
        `repeated jump to ${targetId} must move upward without rebound: ${JSON.stringify(repeatTrajectory)}`,
      )
    }
    const beforeClose = await page.evaluate(() => window.scrollY)
    await page.getByRole('button', { name: '留在此处' }).click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    const afterClose = await page.evaluate(() => ({
      scrollY: window.scrollY,
      focusedId: document.activeElement?.id || '',
      maximum: Math.max(
        0,
        document.documentElement.scrollHeight -
          (window.visualViewport?.height || window.innerHeight),
      ),
    }))
    assert.ok(
      Math.abs(afterClose.scrollY - beforeClose) <= 1,
      `repeated record jump dialog close must preserve scroll: ${JSON.stringify({ sourceId, targetId, beforeClose, afterClose })}`,
    )
    assert.equal(afterClose.focusedId, targetId, `repeated record jump must focus ${targetId}`)
    assert.ok(
      afterClose.scrollY >= -1 && afterClose.scrollY <= afterClose.maximum + 1,
      `repeated record jump must stay inside the document: ${JSON.stringify({ targetId, afterClose })}`,
    )
  }

  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const layout = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tables: [...document.querySelectorAll('.record-table-scroll')].map((wrapper) => {
        const table = wrapper.querySelector('table')
        const container = wrapper.querySelector('[data-slot="table-container"]')
        return {
          wrapperWidth: wrapper.clientWidth,
          wrapperOverflow: wrapper.scrollWidth - wrapper.clientWidth,
          containerWidth: container?.clientWidth || 0,
          containerOverflow: container ? container.scrollWidth - container.clientWidth : 0,
          containerOverflowMode: container ? getComputedStyle(container).overflowX : '',
          tableWidth: table?.getBoundingClientRect().width || 0,
          tableLeft: table?.getBoundingClientRect().left || 0,
          tableRight: table?.getBoundingClientRect().right || 0,
          wrapperRight: wrapper.getBoundingClientRect().right,
          cellOverflows: [...wrapper.querySelectorAll('td')].map((cell) => cell.scrollWidth - cell.clientWidth),
        }
      }),
    }))
    assert.ok(layout.documentOverflow <= 1, `${width}px viewport must not overflow horizontally`)
    layout.tables.forEach((table, index) => {
      assert.ok(table.wrapperOverflow <= 1, `${width}px table ${index + 1} wrapper overflowed by ${table.wrapperOverflow}px`)
      assert.ok(
        table.containerOverflow <= 1,
        `${width}px table ${index + 1} shadcn container overflowed: ${JSON.stringify(table)}`,
      )
      assert.equal(
        table.containerOverflowMode,
        'visible',
        `${width}px table ${index + 1} shadcn container must not be a horizontal scroller`,
      )
      assert.ok(table.tableRight <= table.wrapperRight + 1, `${width}px table ${index + 1} must stay inside its content lane`)
      assert.ok(table.cellOverflows.every((overflow) => overflow <= 1), `${width}px table ${index + 1} cell overflows: ${table.cellOverflows.join(', ')}`)
    })
  }

  await page.setViewportSize({ width: 1280, height: 1000 })
  await assertFullscreenImageViewer(page, 'default 1280px')
  const privateViewerPath = '/storage/v1/object/sign/classrecord-private/fixtures/progressive-original.svg'
  assert.equal(
    storageRequests.filter(
      (request) => request.path === privateViewerPath && request.method === 'POST',
    ).length,
    0,
    'rendering a compressed private-image trigger must not sign its original',
  )
  const privateViewerTrigger = page.getByRole('button', { name: '打开按需高清测试图片' })
  await privateViewerTrigger.scrollIntoViewIfNeeded()
  await privateViewerTrigger.click()
  const privateViewerDialog = page.locator('.image-viewer-dialog[data-slot="dialog-content"]')
  await privateViewerDialog.waitFor({ state: 'visible' })
  await privateViewerDialog.evaluate((dialog) => {
    const samples = []
    window.__viewerOpenSamples = samples
    const started = performance.now()
    const capture = () => {
      const image = dialog.querySelector('img[alt="按需高清测试图片"]')
      if (image) {
        const bounds = image.getBoundingClientRect()
        samples.push({
          width: bounds.width,
          height: bounds.height,
          original: image.src.includes('rendition=original'),
        })
      }
      if (dialog.isConnected && performance.now() - started < 1200) requestAnimationFrame(capture)
    }
    requestAnimationFrame(capture)
  })
  await page.waitForFunction(() =>
    document
      .querySelector('img[alt="按需高清测试图片"]')
      ?.src.includes('/fixtures/progressive-original.svg'),
  )
  await page.waitForTimeout(80)
  const viewerOpenSamples = await page.evaluate(() => window.__viewerOpenSamples || [])
  assert.ok(
    viewerOpenSamples.some((sample) => !sample.original) &&
      viewerOpenSamples.some((sample) => sample.original),
    `the viewer must keep its preview mounted until the delayed original is decoded: ${JSON.stringify(viewerOpenSamples)}`,
  )
  const viewerOpenWidths = viewerOpenSamples.map((sample) => sample.width)
  const viewerOpenHeights = viewerOpenSamples.map((sample) => sample.height)
  assert.ok(
    Math.max(...viewerOpenWidths) - Math.min(...viewerOpenWidths) <= 1 &&
      Math.max(...viewerOpenHeights) - Math.min(...viewerOpenHeights) <= 1,
    `preview-to-original replacement must preserve the exact large-image frame: ${JSON.stringify(viewerOpenSamples)}`,
  )
  const firstPrivateViewerRequests = storageRequests.filter(
    (request) => request.path === privateViewerPath,
  )
  assert.equal(
    firstPrivateViewerRequests.filter((request) => request.method === 'POST').length,
    1,
    `opening a large image must sign its original exactly once: ${JSON.stringify(firstPrivateViewerRequests)}`,
  )
  const firstPrivateViewerGets = firstPrivateViewerRequests.filter(
    (request) => request.method === 'GET' && request.resourceType === 'image',
  )
  assert.ok(
    firstPrivateViewerGets.length >= 1 &&
      new Set(firstPrivateViewerGets.map((request) => request.url)).size === 1,
    `opening a large image must use only its one signed original URL: ${JSON.stringify(firstPrivateViewerRequests)}`,
  )
  assert.equal(
    JSON.parse(firstPrivateViewerRequests.find((request) => request.method === 'POST').postData)
      .transform,
    undefined,
    'the viewer request must target the original rendition rather than another thumbnail',
  )
  const viewerBeforeClose = await privateViewerDialog
    .locator('img[alt="按需高清测试图片"]')
    .evaluate((image) => {
      const bounds = image.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    })
  await privateViewerDialog.evaluate((dialog) => {
    const samples = []
    window.__viewerCloseSamples = samples
    const started = performance.now()
    const capture = () => {
      const image = dialog.querySelector('img[alt="按需高清测试图片"]')
      if (image) {
        const bounds = image.getBoundingClientRect()
        if (bounds.width > 0 && bounds.height > 0)
          samples.push({
            closed: dialog.hasAttribute('data-closed'),
            width: bounds.width,
            height: bounds.height,
          })
      }
      if (dialog.isConnected && performance.now() - started < 800) requestAnimationFrame(capture)
    }
    requestAnimationFrame(capture)
  })
  await page.getByRole('button', { name: '关闭大图' }).click()
  await privateViewerDialog.waitFor({ state: 'hidden' })
  const viewerCloseSamples = (await page.evaluate(() => window.__viewerCloseSamples || [])).filter(
    (sample) => sample.closed,
  )
  assert.ok(viewerCloseSamples.length > 0, 'the large viewer must retain its existing exit phase')
  assert.ok(
    viewerCloseSamples.every(
      (sample) =>
        Math.abs(sample.width - viewerBeforeClose.width) <= 1 &&
        Math.abs(sample.height - viewerBeforeClose.height) <= 1,
    ),
    `closing the viewer must preserve its frame until the exit animation unmounts: ${JSON.stringify(viewerCloseSamples)}`,
  )
  await privateViewerTrigger.click()
  await privateViewerDialog.waitFor({ state: 'visible' })
  await page.waitForFunction(() =>
    document
      .querySelector('img[alt="按需高清测试图片"]')
      ?.src.includes('/fixtures/progressive-original.svg'),
  )
  await page.getByRole('button', { name: '关闭大图' }).click()
  await privateViewerDialog.waitFor({ state: 'hidden' })
  const repeatedPrivateViewerRequests = storageRequests.filter(
    (request) => request.path === privateViewerPath,
  )
  assert.equal(
    repeatedPrivateViewerRequests.filter((request) => request.method === 'POST').length,
    1,
    `reopening a large image must reuse its signed URL: ${JSON.stringify(repeatedPrivateViewerRequests)}`,
  )
  const repeatedPrivateViewerGets = repeatedPrivateViewerRequests.filter(
    (request) => request.method === 'GET' && request.resourceType === 'image',
  )
  assert.deepEqual(
    [...new Set(repeatedPrivateViewerGets.map((request) => request.url))],
    [...new Set(firstPrivateViewerGets.map((request) => request.url))],
    `reopening a large image must reuse the same signed original URL: ${JSON.stringify(repeatedPrivateViewerRequests)}`,
  )
  const cancelledViewerPath =
    '/storage/v1/object/sign/classrecord-private/fixtures/progressive-cancel.svg'
  const cancelledViewerTrigger = page.getByRole('button', {
    name: '打开快速关闭测试图片',
  })
  await cancelledViewerTrigger.click()
  await privateViewerDialog.waitFor({ state: 'visible' })
  await page.waitForTimeout(40)
  await page.getByRole('button', { name: '关闭大图' }).click()
  await privateViewerDialog.waitFor({ state: 'hidden' })
  await cancelledViewerTrigger.click()
  await privateViewerDialog.waitFor({ state: 'visible' })
  await page.waitForFunction(() =>
    document
      .querySelector('img[alt="快速关闭测试图片"]')
      ?.src.includes('/fixtures/progressive-cancel.svg'),
  )
  const cancelledViewerRequests = storageRequests.filter(
    (request) => request.path === cancelledViewerPath,
  )
  assert.equal(
    cancelledViewerRequests.filter((request) => request.method === 'POST').length,
    1,
    `closing during load and reopening must reuse the pending signed URL: ${JSON.stringify(cancelledViewerRequests)}`,
  )
  const cancelledViewerGets = cancelledViewerRequests.filter(
    (request) => request.method === 'GET' && request.resourceType === 'image',
  )
  assert.ok(
    cancelledViewerGets.length >= 1 &&
      new Set(cancelledViewerGets.map((request) => request.url)).size === 1,
    `closing during load and reopening must reuse the pending original URL: ${JSON.stringify(cancelledViewerRequests)}`,
  )
  await page.getByRole('button', { name: '关闭大图' }).click()
  await privateViewerDialog.waitFor({ state: 'hidden' })
  const writtenPreviewSigns = storageRequests.filter(
    (request) =>
      request.method === 'POST' &&
      request.path.endsWith('/classrecord-private/fixtures/page-2.webp'),
  )
  assert.ok(writtenPreviewSigns.length >= 1, 'the visible written page must request its compressed rendition')
  assert.ok(
    writtenPreviewSigns.every(
      (request) => JSON.parse(request.postData).transform?.width === 1200,
    ),
    `written pages must not sign an original outside the large viewer: ${JSON.stringify(writtenPreviewSigns)}`,
  )
  const tableBalance = await page.evaluate(() => {
    const small = document.querySelector('[data-case="small"]')
    const smallTable = small?.querySelector('table')
    const six = document.querySelector('[data-case="six"]')
    const firstRow = six?.querySelectorAll('tr')[0]
    const cells = firstRow ? [...firstRow.querySelectorAll('td')] : []
    return {
      smallRatio: smallTable && small ? smallTable.getBoundingClientRect().width / small.getBoundingClientRect().width : 1,
      smallComputedWidth: smallTable ? getComputedStyle(smallTable).width : '',
      smallPreferredWidth: small?.querySelector('.record-table-scroll')
        ? getComputedStyle(small.querySelector('.record-table-scroll')).getPropertyValue('--record-table-preferred-width')
        : '',
      sixWidths: cells.map((cell) => cell.getBoundingClientRect().width),
    }
  })
  assert.ok(
    tableBalance.smallRatio < 0.7,
    `a small two-column table must not consume the entire reading lane (${JSON.stringify(tableBalance)})`,
  )
  assert.ok(
    Math.max(...tableBalance.sixWidths.slice(0, 5)) > tableBalance.sixWidths[5] * 1.15,
    'content-heavy columns must receive more width than a short trailing column',
  )

  const identityBlankFixture = page.locator('[data-quiz-identity-blank-fixture]')
  const identityBlanks = identityBlankFixture.locator('.quiz-answer-blank')
  assert.equal(
    await identityBlanks.count(),
    3,
    'every repeated reference with the same entity and exact label must be blanked',
  )
  assert.equal(
    await identityBlankFixture.locator('.markup-link').count(),
    0,
    'quiz-safe markup must flatten all remaining entity references',
  )
  const hiddenBlankGeometry = await identityBlankFixture.evaluate((fixture) => {
    const body = fixture.querySelector('[data-quiz-blank-body]')
    const bounds = body.getBoundingClientRect()
    return {
      body: { width: bounds.width, height: bounds.height },
      blanks: [...fixture.querySelectorAll('.quiz-answer-blank')].map((blank) => {
        const blankBounds = blank.getBoundingClientRect()
        return {
          left: blankBounds.left - bounds.left,
          top: blankBounds.top - bounds.top,
          width: blankBounds.width,
          height: blankBounds.height,
        }
      }),
    }
  })
  await identityBlankFixture.getByRole('button', { name: '显示答案' }).click()
  const revealedBlankGeometry = await identityBlankFixture.evaluate((fixture) => {
    const body = fixture.querySelector('[data-quiz-blank-body]')
    const bounds = body.getBoundingClientRect()
    return {
      body: { width: bounds.width, height: bounds.height },
      blanks: [...fixture.querySelectorAll('.quiz-answer-blank')].map((blank) => {
        const blankBounds = blank.getBoundingClientRect()
        return {
          left: blankBounds.left - bounds.left,
          top: blankBounds.top - bounds.top,
          width: blankBounds.width,
          height: blankBounds.height,
        }
      }),
    }
  })
  assert.ok(
    Math.abs(hiddenBlankGeometry.body.height - revealedBlankGeometry.body.height) <= 0.5,
    `revealing all matching blanks must not change the question height: ${JSON.stringify({ hiddenBlankGeometry, revealedBlankGeometry })}`,
  )
  hiddenBlankGeometry.blanks.forEach((blank, index) => {
    const revealed = revealedBlankGeometry.blanks[index]
    assert.ok(
      revealed &&
        Math.abs(blank.left - revealed.left) <= 0.5 &&
        Math.abs(blank.top - revealed.top) <= 0.5 &&
        Math.abs(blank.width - revealed.width) <= 0.5 &&
        Math.abs(blank.height - revealed.height) <= 0.5,
      `blank ${index + 1} must preserve its exact inline geometry while revealing: ${JSON.stringify({ blank, revealed })}`,
    )
  })

  const dailyCells = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-distribution-cell')].map((cell) => {
      const bounds = cell.getBoundingClientRect()
      const date = cell.querySelector('.daily-distribution-date')?.getBoundingClientRect()
      const important = cell.querySelector('.daily-distribution-important-marker')?.getBoundingClientRect()
      const pie = cell.querySelector('.daily-distribution-pie')?.getBoundingClientRect()
      const mainElement = cell.children[1]
      const main = mainElement?.getBoundingClientRect()
      const childrenInside = [...cell.querySelectorAll('*')].every((child) => {
        const childBounds = child.getBoundingClientRect()
        return (
          childBounds.left >= bounds.left - 1 &&
          childBounds.right <= bounds.right + 1 &&
          childBounds.top >= bounds.top - 1 &&
          childBounds.bottom <= bounds.bottom + 1
        )
      })
      return {
        overflowX: cell.scrollWidth - cell.clientWidth,
        overflowY: cell.scrollHeight - cell.clientHeight,
        height: bounds.height,
        squareDelta: Math.abs(bounds.width - bounds.height),
        childrenInside,
        grid: cell.closest('[data-daily-grid]')?.getAttribute('data-daily-grid'),
        pieWidth: pie?.width || 0,
        pieHeight: pie?.height || 0,
        mainHeight: main?.height || 0,
        mainWidth: main?.width || 0,
        mainChildren: mainElement ? Array.from(mainElement.children).map((child) => ({
          width: child.getBoundingClientRect().width,
          scrollWidth: child.scrollWidth,
          text: child.textContent,
        })) : [],
        computed: {
          paddingInline: getComputedStyle(cell).paddingInline,
          columnGap: mainElement ? getComputedStyle(mainElement).columnGap : '',
          fontSize: getComputedStyle(cell).fontSize,
        },
        bounds: { width: bounds.width, height: bounds.height, top: bounds.top, bottom: bounds.bottom },
        children: [...cell.children].map((child) => {
          const childBounds = child.getBoundingClientRect()
          return { top: childBounds.top, bottom: childBounds.bottom, height: childBounds.height, text: child.textContent }
        }),
        visibleText: cell.textContent || '',
        dateLeft: date ? date.left - bounds.left : -1,
        dateTop: date ? date.top - bounds.top : -1,
        hasImportantMarker: Boolean(important),
        topOverlap: date && important ? Math.max(0, date.right - important.left) : 0,
      }
    }),
  )
  assert.equal(dailyCells.length, 12)
  dailyCells.forEach((cell, index) => {
    assert.ok(
      cell.overflowX <= 1 && cell.overflowY <= 1,
      `daily cell ${index + 1} overflowed: ${JSON.stringify(cell)}`,
    )
    assert.ok(cell.squareDelta <= 1, `daily cell ${index + 1} must retain a stable square frame: ${JSON.stringify(cell)}`)
    assert.equal(cell.childrenInside, true, `daily cell ${index + 1} content must remain inside its frame`)
    assert.ok(cell.topOverlap <= 0.5, `daily cell ${index + 1} date and important marker must not overlap`)
    assert.ok(cell.dateLeft >= 3 && cell.dateLeft <= 8, `daily cell ${index + 1} date must keep a compact left inset: ${JSON.stringify(cell)}`)
    assert.ok(cell.dateTop >= 3 && cell.dateTop <= 8, `daily cell ${index + 1} date must keep a compact top inset: ${JSON.stringify(cell)}`)
    assert.ok(!/[日条字]/u.test(cell.visibleText), `daily cell ${index + 1} must omit redundant visible units: ${cell.visibleText}`)
    assert.ok(!/(?:重要|重)/u.test(cell.visibleText), `daily cell ${index + 1} must use a non-text important marker: ${cell.visibleText}`)
    assert.ok(cell.pieWidth >= 32 && Math.abs(cell.pieWidth - cell.pieHeight) <= 0.5, `daily cell ${index + 1} pie must remain prominent and circular: ${JSON.stringify(cell)}`)
    assert.ok(cell.pieWidth / cell.bounds.width >= 0.45, `daily cell ${index + 1} pie must be the square's primary visual: ${JSON.stringify(cell)}`)
    assert.ok(cell.mainHeight / cell.bounds.height >= 0.56, `daily cell ${index + 1} main visualization row must use most available space: ${JSON.stringify(cell)}`)
  })
  assert.ok(Math.max(...dailyCells.map((cell) => cell.dateLeft)) - Math.min(...dailyCells.map((cell) => cell.dateLeft)) <= 0.5, 'all daily dates must share one left alignment')
  assert.ok(Math.max(...dailyCells.map((cell) => cell.dateTop)) - Math.min(...dailyCells.map((cell) => cell.dateTop)) <= 0.5, 'all daily dates must share one top alignment')
  assert.equal(dailyCells.filter((cell) => cell.hasImportantMarker).length, 6, 'only important days may render the visual marker')
  const largeDailyValue = page.locator('.daily-distribution-value[title="9,876,543 字"]').first()
  await largeDailyValue.waitFor({ state: 'visible' })
  assert.notEqual(await largeDailyValue.textContent(), '9,876,543', 'large daily values must use compact visible notation')

  const themeOptions = page.locator('[data-theme-preset-option]')
  assert.equal(await themeOptions.count(), 10, 'automatic plus nine designed light/dark theme presets must remain available')
  const themeModeGroups = page.locator('[data-theme-mode-group]')
  assert.equal(await themeModeGroups.count(), 3, 'automatic, light, and dark choices must have separate visual groups')
  assert.equal(await page.locator('[data-theme-mode="light"]').count(), 5, 'five distinct light themes must remain available')
  assert.equal(await page.locator('[data-theme-mode="dark"]').count(), 4, 'four distinct dark themes must remain available')
  const autoThemeControl = page.locator('[data-theme-preset-option="auto"]')
  const autoThemeGeometry = await autoThemeControl.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
    radioSlot: element.querySelector('[data-slot="radio-group-item"]')?.getAttribute('data-slot'),
    hasPreview: Boolean(element.querySelector('[data-theme-preview]')),
  }))
  assert.equal(
    autoThemeGeometry.radioSlot,
    'radio-group-item',
    'automatic palette must share the same shadcn RadioGroup as designed palettes',
  )
  assert.ok(
    autoThemeGeometry.height >= 40 && autoThemeGeometry.height <= 52,
    `automatic palette control must retain a readable touch target without becoming oversized: ${JSON.stringify(autoThemeGeometry)}`,
  )
  assert.equal(autoThemeGeometry.hasPreview, false, 'automatic palette must not render a full preview card')
  const appearanceTabsGeometry = await page
    .getByRole('tablist', { name: '风格设置分区' })
    .evaluate((list) => {
    const bounds = list.getBoundingClientRect()
    return {
      height: bounds.height,
      triggers: [...list.querySelectorAll('[data-slot="tabs-trigger"]')].map((trigger) => {
        const triggerBounds = trigger.getBoundingClientRect()
        return {
          top: triggerBounds.top - bounds.top,
          bottom: bounds.bottom - triggerBounds.bottom,
          height: triggerBounds.height,
        }
      }),
    }
  })
  assert.ok(
    appearanceTabsGeometry.height >= 40 && appearanceTabsGeometry.height <= 54,
    `appearance tab rail must reuse the compact standard control height: ${JSON.stringify(appearanceTabsGeometry)}`,
  )
  appearanceTabsGeometry.triggers.forEach((trigger) => {
    assert.ok(
      trigger.top >= -1 && trigger.bottom >= -1 && trigger.height >= 40,
      `appearance tab controls must stay fully inside the rail: ${JSON.stringify(appearanceTabsGeometry)}`,
    )
  })
  const designedThemeOptions = page.locator('[data-theme-preset-option]:not([data-theme-preset-option="auto"])')
  const themePreviewColors = await designedThemeOptions.evaluateAll((options) =>
    options.map((option) => {
      const preview = option.querySelector('[data-theme-preview]')
      const accent = option.querySelector('.appearance-preset-preview-accent')
      return {
        id: option.getAttribute('data-theme-preset-option'),
        background: preview ? getComputedStyle(preview).backgroundColor : '',
        accent: accent ? getComputedStyle(accent).backgroundColor : '',
      }
    }),
  )
  assert.equal(themePreviewColors.length, 9, 'all designed light/dark themes need compact previews')
  assert.equal(new Set(themePreviewColors.map((item) => `${item.background}|${item.accent}`)).size, 9, 'every designed theme preset needs a distinct visible preview')
  await page.locator('[data-theme-preset-option="midnight"]').click()
  await page.waitForFunction(() => {
    const value = JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')
    return value?.theme === 'midnight' && document.documentElement.dataset.themePreset === 'midnight' && document.documentElement.classList.contains('dark')
  })
  const darkThemeTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return ['--background', '--foreground', '--card', '--border', '--primary'].map((name) => styles.getPropertyValue(name).trim())
  })
  await page.locator('[data-theme-preset-option="paper"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'paper' && !document.documentElement.classList.contains('dark'))
  const lightThemeTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return ['--background', '--foreground', '--card', '--border', '--primary'].map((name) => styles.getPropertyValue(name).trim())
  })
  assert.notDeepEqual(lightThemeTokens, darkThemeTokens, 'switching light/dark presets must update the complete surface token set')
  const themeContrasts = await page.evaluate((ids) => {
    const root = document.documentElement
    const original = root.dataset.themePreset
    const originallyDark = root.classList.contains('dark')
    const darkIds = new Set(['ink', 'midnight', 'pine', 'aurora'])
    const relativeLuminance = (value) => {
      const oklch = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
      if (oklch) {
        const lightness = Number(oklch[1])
        const chroma = Number(oklch[2])
        const hue = Number(oklch[3]) * Math.PI / 180
        const a = chroma * Math.cos(hue)
        const b = chroma * Math.sin(hue)
        const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
        const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
        const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
        const l = lPrime ** 3
        const m = mPrime ** 3
        const s = sPrime ** 3
        const red = Math.min(1, Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))
        const green = Math.min(1, Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))
        const blue = Math.min(1, Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const oklab = value.match(/oklab\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
      if (oklab) {
        const lightness = Number(oklab[1])
        const a = Number(oklab[2])
        const b = Number(oklab[3])
        const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
        const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
        const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
        const l = lPrime ** 3
        const m = mPrime ** 3
        const s = sPrime ** 3
        const red = Math.min(1, Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))
        const green = Math.min(1, Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))
        const blue = Math.min(1, Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const toLinear = (channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
      if (srgb) {
        const [red, green, blue] = srgb.slice(1, 4).map((channel) => toLinear(Number(channel)))
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const rgb = value.match(/rgba?\(\s*([\d.]+)%?[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?/)
      if (rgb) {
        const percent = value.includes('%')
        const divisor = percent ? 100 : 255
        const [red, green, blue] = rgb
          .slice(1, 4)
          .map((channel) => toLinear(Number(channel) / divisor))
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      return null
    }
    const ratio = (first, second) => {
      const a = relativeLuminance(first)
      const b = relativeLuminance(second)
      if (a === null || b === null) return 0
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    window.__contrastRatio = ratio
    const output = ids.map((id) => {
      root.dataset.themePreset = id
      root.classList.toggle('dark', darkIds.has(id))
      const styles = getComputedStyle(root)
      const quiz = [...document.querySelectorAll('[data-quiz-theme-fixture]')].map((card) => {
        const cardStyles = getComputedStyle(card)
        const options = [...card.querySelectorAll('[data-quiz-option-state]')].map((option) => {
          const optionStyles = getComputedStyle(option)
          const label = option.querySelector('.quiz-option-label')
          const labelStyles = getComputedStyle(label)
          return {
            state: option.getAttribute('data-quiz-option-state'),
            background: optionStyles.backgroundColor,
            foreground: optionStyles.color,
            text: ratio(optionStyles.backgroundColor, optionStyles.color),
            labelBackground: labelStyles.backgroundColor,
            labelForeground: labelStyles.color,
            label: ratio(labelStyles.backgroundColor, labelStyles.color),
          }
        })
        return {
          type: card.getAttribute('data-question-type'),
          typeText: ratio(cardStyles.getPropertyValue('--quiz-type-surface'), cardStyles.getPropertyValue('--quiz-type-ink')),
          success: ratio(cardStyles.getPropertyValue('--quiz-success-surface'), cardStyles.getPropertyValue('--quiz-success-foreground')),
          successEmphasis: ratio(cardStyles.getPropertyValue('--quiz-success-emphasis'), cardStyles.getPropertyValue('--quiz-success-emphasis-foreground')),
          error: ratio(cardStyles.getPropertyValue('--quiz-error-surface'), cardStyles.getPropertyValue('--quiz-error-foreground')),
          errorEmphasis: ratio(cardStyles.getPropertyValue('--quiz-error-emphasis'), cardStyles.getPropertyValue('--quiz-error-emphasis-foreground')),
          options,
        }
      })
      return {
        id,
        page: ratio(styles.getPropertyValue('--background'), styles.getPropertyValue('--foreground')),
        card: ratio(styles.getPropertyValue('--card'), styles.getPropertyValue('--card-foreground')),
        primary: ratio(styles.getPropertyValue('--primary'), styles.getPropertyValue('--primary-foreground')),
        muted: ratio(styles.getPropertyValue('--muted'), styles.getPropertyValue('--muted-foreground')),
        quiz,
      }
    })
    root.dataset.themePreset = original
    root.classList.toggle('dark', originallyDark)
    return output
  }, ['auto', 'paper', 'mist', 'apricot', 'sage', 'rose', 'ink', 'midnight', 'pine', 'aurora'])
  themeContrasts.forEach((theme) => {
    assert.ok(theme.page >= 7, `${theme.id} page text contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.card >= 7, `${theme.id} card text contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.primary >= 4.5, `${theme.id} primary control contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.muted >= 4.5, `${theme.id} muted text contrast is too low: ${JSON.stringify(theme)}`)
    theme.quiz.forEach((sample) => {
      for (const [state, contrast] of Object.entries(sample).filter(
        ([key]) => key !== 'type' && key !== 'options',
      )) {
        assert.ok(contrast >= 4.5, `${theme.id} ${sample.type} quiz ${state} contrast is too low: ${JSON.stringify(sample)}`)
      }
      sample.options.forEach((option) => {
        assert.ok(option.text >= 4.5, `${theme.id} ${sample.type} quiz ${option.state} text contrast is too low: ${JSON.stringify(option)}`)
        assert.ok(option.label >= 4.5, `${theme.id} ${sample.type} quiz ${option.state} label contrast is too low: ${JSON.stringify(option)}`)
      })
    })
  })

  const assertQuizOptionInteractions = async (themeId) => {
    await page.locator(`[data-theme-preset-option="${themeId}"]`).click()
    await page.waitForFunction(
      (id) => document.documentElement.dataset.themePreset === id,
      themeId,
    )
    await page.waitForTimeout(220)
    const option = page.locator(
      '[data-quiz-theme-fixture="choice"] [data-quiz-option-state="default"]',
    )
    const readState = () =>
      option.evaluate((target) => {
        const style = getComputedStyle(target)
        return {
          contrast: window.__contrastRatio(style.backgroundColor, style.color),
          background: style.backgroundColor,
          foreground: style.color,
          boxShadow: style.boxShadow,
          outline: style.outlineStyle,
          bounds: target.getBoundingClientRect().toJSON(),
        }
      })
    const normal = await readState()
    assert.ok(normal.contrast >= 4.5, `${themeId} default quiz option contrast is too low`)
    await option.hover()
    const hovered = await readState()
    assert.ok(
      hovered.contrast >= 4.5,
      `${themeId} hovered quiz option contrast is too low: ${JSON.stringify(hovered)}`,
    )
    assert.deepEqual(hovered.bounds, normal.bounds, `${themeId} quiz option hover must not move or resize`)
    await page
      .locator('[data-quiz-theme-fixture="choice"] [data-quiz-option-state="selected"]')
      .focus()
    await page.keyboard.press('Shift+Tab')
    assert.equal(
      await option.evaluate((target) => document.activeElement === target),
      true,
      `${themeId} keyboard traversal must focus the default quiz option`,
    )
    const focused = await readState()
    assert.ok(
      focused.contrast >= 4.5,
      `${themeId} focused quiz option contrast is too low: ${JSON.stringify(focused)}`,
    )
    assert.ok(
      focused.boxShadow !== 'none' || focused.outline !== 'none',
      `${themeId} focused quiz option must keep an explicit keyboard indicator`,
    )
    const bounds = await option.boundingBox()
    assert.ok(bounds, `${themeId} quiz option must be measurable before pressed-state testing`)
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    const pressed = await readState()
    await page.mouse.up()
    assert.ok(pressed.contrast >= 4.5, `${themeId} pressed quiz option contrast is too low`)
    assert.notEqual(pressed.background, hovered.background, `${themeId} quiz option press must keep a visible shadcn state change`)
    assert.ok(
      pressed.bounds.width < normal.bounds.width &&
        pressed.bounds.width >= normal.bounds.width * 0.97 &&
        pressed.bounds.height < normal.bounds.height &&
        pressed.bounds.height >= normal.bounds.height * 0.96,
      `${themeId} quiz option press must use the shared restrained compression: ${JSON.stringify({ normal: normal.bounds, pressed: pressed.bounds })}`,
    )
    assert.ok(
      Math.abs(
        pressed.bounds.left + pressed.bounds.width / 2 -
          (normal.bounds.left + normal.bounds.width / 2),
      ) <= 1 &&
        Math.abs(
          pressed.bounds.top + pressed.bounds.height / 2 -
            (normal.bounds.top + normal.bounds.height / 2),
        ) <= 1.5,
      `${themeId} button press must preserve its perceived centre without layout movement`,
    )
    await page.waitForTimeout(240)
    const released = await readState()
    assert.ok(
      Math.abs(released.bounds.width - normal.bounds.width) <= 0.5 &&
        Math.abs(released.bounds.height - normal.bounds.height) <= 0.5,
      `${themeId} quiz option release must settle to its exact original geometry: ${JSON.stringify({ normal: normal.bounds, released: released.bounds })}`,
    )
  }
  await assertQuizOptionInteractions('paper')
  await assertQuizOptionInteractions('midnight')
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'auto')

  await page.locator('[data-theme-preset-option="pine"]').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')?.theme === 'pine')
  await page.reload({ waitUntil: 'networkidle' })
  await waitForMarkupLayoutReady(page, { pageErrors, consoleProblems })
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'pine' && document.documentElement.classList.contains('dark'))
  assert.equal(await page.locator('[data-theme-preset-option="pine"]').getAttribute('data-selected'), 'true', 'the selected dark preset must survive a full bootstrap and React remount')
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && document.documentElement.dataset.themePreset === 'auto')

  const paletteChoice = page.locator('[data-theme-preset-option="mist"]')
  await paletteChoice.scrollIntoViewIfNeeded()
  const paletteBoundsBefore = await paletteChoice.boundingBox()
  await paletteChoice.hover()
  await page.waitForTimeout(220)
  const paletteBoundsAfter = await paletteChoice.boundingBox()
  assert.deepEqual(paletteBoundsAfter, paletteBoundsBefore, 'palette hover must not move or resize its real label hit target')

  await page.getByRole('tab', { name: /^背景/ }).click()
  const backgroundCards = page.locator('[data-background-id]')
  assert.equal(await backgroundCards.count(), 3, 'all baseline background choices must remain available')
  await backgroundCards.last().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-background-id] img')].every((image) => image.naturalWidth > 0))
  const chooserImageRequests = imageRequests.filter((request) =>
    /\/images\/backgrounds\/(?:mountain|cloud)(?:-preview)?\.(?:jpg|webp)$/u.test(request),
  )
  assert.deepEqual(
    [...new Set(chooserImageRequests.map(withoutDeploymentBase))].sort(),
    ['/images/backgrounds/cloud-preview.jpg', '/images/backgrounds/mountain-preview.jpg'],
    `opening the chooser must request only its two compressed previews: ${JSON.stringify(chooserImageRequests)}`,
  )
  const mountainBoundsBefore = await page.locator('[data-background-id="mountain"]').boundingBox()
  await page.locator('[data-background-id="mountain"]').hover()
  await page.waitForTimeout(220)
  const mountainBoundsAfter = await page.locator('[data-background-id="mountain"]').boundingBox()
  assert.deepEqual(mountainBoundsAfter, mountainBoundsBefore, 'background hover must preserve the exact selectable-card geometry')
  const backgroundHoverTransforms = await page.locator('[data-background-id] img').evaluateAll((images) =>
    images.map((image) => ({
      id: image.closest('[data-background-id]')?.getAttribute('data-background-id'),
      scale: getComputedStyle(image).scale,
    })),
  )
  assert.ok(
    backgroundHoverTransforms.every((item) => item.scale === 'none'),
    `background selection previews must not move when hovered: ${JSON.stringify(backgroundHoverTransforms)}`,
  )
  const backgroundGeometry = await backgroundCards.evaluateAll((cards) =>
    cards.map((card) => {
      const preview = card.querySelector('[data-slot="aspect-ratio"]')
      const strip = card.querySelector('[data-background-swatch]')
      const metadata = card.querySelector('.backdrop-blur-md')
      const bounds = preview?.getBoundingClientRect()
      return {
        id: card.getAttribute('data-background-id'),
        ratio: bounds ? bounds.width / bounds.height : 0,
        width: bounds?.width || 0,
        height: bounds?.height || 0,
        computedAspect: preview ? getComputedStyle(preview).aspectRatio : '',
        strip: strip ? getComputedStyle(strip).backgroundImage : '',
        stripWidthRatio: strip ? strip.getBoundingClientRect().width / card.getBoundingClientRect().width : 1,
        stripIntegrated: strip ? strip !== card.firstElementChild : false,
        backdrop: metadata ? getComputedStyle(metadata).backdropFilter : '',
      }
    }),
  )
  backgroundGeometry.forEach((card) => {
    assert.ok(Math.abs(card.ratio - 4 / 3) <= 0.02, `background ${card.id} must keep a stable 4:3 preview: ${JSON.stringify(card)}`)
    assert.notEqual(card.strip, 'none', `background ${card.id} needs a representative theme strip`)
    assert.ok(card.stripIntegrated && card.stripWidthRatio < 0.3, `background ${card.id} swatch must remain a secondary part of its metadata`)
    assert.notEqual(card.backdrop, 'none', `background ${card.id} metadata needs its existing readable overlay`)
  })
  assert.ok(
    await backgroundCards.evaluateAll((cards) => cards.every((card) => card.tagName === 'LABEL')),
    'each background visual boundary must itself be the complete label hit target',
  )
  assert.equal(new Set(backgroundGeometry.map((card) => card.strip)).size, 3, 'background theme strips must reflect distinct source palettes')
  const defaultBackgroundRadio = page.locator(
    '[data-background-id="default"] [data-slot="radio-group-item"]',
  )
  await defaultBackgroundRadio.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  assert.equal(
    await defaultBackgroundRadio.evaluate((radio) => radio.matches(':focus-visible')),
    true,
    'the focus assertion must enter the control through keyboard modality',
  )
  const focusedBackground = await page.locator('[data-background-id="default"]').evaluate((card) => ({
    outline: getComputedStyle(card).outlineStyle,
    outlineOffset: getComputedStyle(card).outlineOffset,
    shadow: getComputedStyle(card).boxShadow,
    bounds: card.getBoundingClientRect().toJSON(),
  }))
  assert.equal(focusedBackground.outline, 'solid', 'keyboard focus must use an explicit non-shadow boundary')
  assert.ok(Number.parseFloat(focusedBackground.outlineOffset) >= 2, 'keyboard focus must remain separated from the selected border')
  const clippedShadowRisks = await page.locator('#root').evaluate((root) => {
    const risks = []
    const isVisible = (target) => {
      const bounds = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const clips = (value) => /(?:hidden|clip|auto|scroll)/u.test(value)
    for (const target of root.querySelectorAll('*')) {
      const style = getComputedStyle(target)
      if (!isVisible(target) || style.boxShadow === 'none') continue
      const bounds = target.getBoundingClientRect()
      let ancestor = target.parentElement
      while (ancestor && ancestor !== root) {
        const ancestorStyle = getComputedStyle(ancestor)
        const clipsX = clips(ancestorStyle.overflowX)
        const clipsY = clips(ancestorStyle.overflowY)
        if (clipsX || clipsY) {
          const ancestorBounds = ancestor.getBoundingClientRect()
          const slack = {
            top: bounds.top - ancestorBounds.top,
            right: ancestorBounds.right - bounds.right,
            bottom: ancestorBounds.bottom - bounds.bottom,
            left: bounds.left - ancestorBounds.left,
          }
          if (
            (clipsX && (slack.left < 12 || slack.right < 12)) ||
            (clipsY && (slack.top < 12 || slack.bottom < 12))
          ) {
            risks.push({
              target: target.getAttribute('data-slot') || target.className || target.tagName,
              ancestor: ancestor.getAttribute('data-slot') || ancestor.className || ancestor.tagName,
              overflowX: ancestorStyle.overflowX,
              overflowY: ancestorStyle.overflowY,
              slack,
              shadow: style.boxShadow,
            })
          }
        }
        ancestor = ancestor.parentElement
      }
    }
    return risks
  })
  assert.deepEqual(
    clippedShadowRisks,
    [],
    `visible shadows need enough inset from every clipping ancestor: ${JSON.stringify(clippedShadowRisks)}`,
  )
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('[data-background-id="mountain"]')?.getAttribute('data-selected') === 'true')
  await page.locator('[data-background-id="cloud"]').click()
  await page.waitForFunction(() => localStorage.getItem('classRecord:background') === 'cloud')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')?.background === 'cloud')
  await page.waitForFunction(() => document.querySelector('[data-background-visible="cloud"]'))
  const selectedOriginalRequests = imageRequests.filter((request) =>
    /\/images\/backgrounds\/(?:mountain|cloud)\.webp$/u.test(request),
  )
  assert.deepEqual(
    [...new Set(selectedOriginalRequests.map(withoutDeploymentBase))].sort(),
    ['/images/backgrounds/cloud.webp', '/images/backgrounds/mountain.webp'],
    `only backgrounds actually selected during the test may request originals: ${JSON.stringify(selectedOriginalRequests)}`,
  )
  assert.ok(
    selectedOriginalRequests.filter((request) => request.endsWith('/cloud.webp')).length <= 2 &&
      selectedOriginalRequests.filter((request) => request.endsWith('/mountain.webp')).length <= 2,
    `selected originals must stay within one decode and one render request when interception disables the HTTP cache: ${JSON.stringify(selectedOriginalRequests)}`,
  )
  const surfaceGeometry = await page.locator('[data-case="app-surface"]').evaluate((surface) => {
    const layers = document.querySelectorAll('[data-background-visible="cloud"] > .background-layer')
    const layer = layers[layers.length - 1]
    const topbar = surface.querySelector('.app-topbar')
    const sidebar = surface.querySelector('[data-slot="sidebar-container"]')
    const card = surface.querySelector('[data-slot="card"]')
    return {
      layerImage: layer ? getComputedStyle(layer).backgroundImage : '',
      surfaceImage: getComputedStyle(surface).backgroundImage,
      surfaceColor: getComputedStyle(surface).backgroundColor,
      topbarBackdrop: topbar ? getComputedStyle(topbar).backdropFilter : '',
      sidebarBackdrop: sidebar ? getComputedStyle(sidebar).backdropFilter : '',
      cardColor: card ? getComputedStyle(card).backgroundColor : '',
      rootImage: getComputedStyle(document.documentElement).backgroundImage,
      bodyColor: getComputedStyle(document.body).backgroundColor,
      rootOverscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
      bodyOverscroll: getComputedStyle(document.body).overscrollBehaviorY,
    }
  })
  assert.match(surfaceGeometry.layerImage, /cloud\.webp/, 'the selected background must remain mounted behind the formal application surface')
  assert.notEqual(surfaceGeometry.surfaceImage, 'none', 'the application surface needs a translucent readability gradient')
  assert.match(surfaceGeometry.surfaceColor, /(?:\/ 0\)|, 0\))$/, `the application surface must not keep an opaque shadcn background: ${JSON.stringify(surfaceGeometry)}`)
  assert.notEqual(surfaceGeometry.topbarBackdrop, 'none', 'the top bar must keep its existing bounded backdrop treatment')
  assert.notEqual(surfaceGeometry.sidebarBackdrop, 'none', 'the sidebar must keep its existing bounded backdrop treatment')
  assert.match(surfaceGeometry.rootImage, /cloud\.webp/, 'elastic overscroll must reveal the same selected image on the document canvas')
  assert.match(surfaceGeometry.bodyColor, /(?:\/ 0\)|, 0\))$/, `the body must not cover the shared overscroll canvas: ${JSON.stringify(surfaceGeometry)}`)
  assert.equal(surfaceGeometry.rootOverscroll, 'none', 'the root must contain vertical elastic overscroll')
  assert.equal(surfaceGeometry.bodyOverscroll, 'none', 'the body must not reveal a mismatched canvas at either edge')

  await page.getByRole('tab', { name: /^方框/ }).click()
  const boxStyleCards = page.locator('[data-box-style-id]')
  assert.equal(await boxStyleCards.count(), 3, 'compact, standard, and rounded must be the only box styles')
  const boxPreviewStyles = await boxStyleCards.evaluateAll((cards) =>
    cards.map((card) => {
      const preview = card.querySelector('.box-style-preview')
      const surface = card.querySelector('.box-style-preview-surface')
      const control = card.querySelector('.box-style-preview-control')
      const inset = card.querySelector('.box-style-preview-inset')
      const previewBounds = preview.getBoundingClientRect()
      const surfaceStyle = getComputedStyle(surface)
      return {
        id: card.getAttribute('data-box-style-id'),
        previewWidth: previewBounds.width,
        previewHeight: previewBounds.height,
        pattern: [...surface.classList].find((name) => name.startsWith('box-style-preview-surface--')),
        surfaceRadius: Number.parseFloat(surfaceStyle.borderTopLeftRadius),
        controlRadius: Number.parseFloat(getComputedStyle(control).borderTopLeftRadius),
        insetRadius: Number.parseFloat(getComputedStyle(inset).borderTopLeftRadius),
        borderWidth: Number.parseFloat(surfaceStyle.borderTopWidth),
        background: surfaceStyle.backgroundColor,
        shadow: surfaceStyle.boxShadow,
      }
    }),
  )
  assert.ok(
    boxPreviewStyles[0].surfaceRadius < boxPreviewStyles[1].surfaceRadius &&
      boxPreviewStyles[1].surfaceRadius < boxPreviewStyles[2].surfaceRadius,
    `box previews must show the three real radius families: ${JSON.stringify(boxPreviewStyles)}`,
  )
  boxPreviewStyles.forEach((preview) => {
    assert.ok(
      preview.previewWidth >= 240 && preview.previewHeight >= 140,
      preview.id + ' preview must remain visibly sized inside the shadcn Label: ' + JSON.stringify(preview),
    )
    assert.equal(preview.surfaceRadius, preview.controlRadius, `${preview.id} preview surfaces must share one radius family`)
    assert.ok(preview.insetRadius < preview.surfaceRadius, `${preview.id} preview controls must use the corresponding smaller control radius`)
    assert.ok(preview.borderWidth >= 1, `${preview.id} preview must retain a visible ordinary border`)
    assert.notEqual(preview.background, 'rgba(0, 0, 0, 0)', `${preview.id} preview must retain its card background`)
    assert.notEqual(preview.shadow, 'none', `${preview.id} preview must retain its restrained card elevation`)
  })
  assert.equal(
    new Set(boxPreviewStyles.map((preview) => preview.pattern)).size,
    3,
    'every box style must expose a distinct real preview pattern: ' + JSON.stringify(boxPreviewStyles),
  )
  const radiusFamilies = []
  for (const [id, expectedInset] of [
    ['compact', 2],
    ['default', 4],
    ['rounded', 7],
  ]) {
    await page.locator(`[data-box-style-id="${id}"]`).click()
    await page.waitForFunction(
      (boxStyle) => document.documentElement.dataset.boxStyle === boxStyle,
      id,
    )
    await page.waitForTimeout(220)
    const geometry = await page.locator('[data-scroll-area-fixture]').evaluate((root) => {
      const scrollbar = root.querySelector(
        '[data-slot="scroll-area-scrollbar"][data-orientation="vertical"]',
      )
      const thumb = scrollbar?.querySelector('[data-slot="scroll-area-thumb"]')
      const rootBounds = root.getBoundingClientRect()
      const scrollbarBounds = scrollbar?.getBoundingClientRect()
      const thumbBounds = thumb?.getBoundingClientRect()
      const rootStyles = getComputedStyle(root)
      return {
        edgeInset: Number.parseFloat(rootStyles.getPropertyValue('--scrollbar-edge-inset')),
        rootRadius: Number.parseFloat(rootStyles.borderTopLeftRadius),
        rootOverflow: rootStyles.overflow,
        scrollbarTopInset: scrollbarBounds ? scrollbarBounds.top - rootBounds.top : -1,
        scrollbarBottomInset: scrollbarBounds ? rootBounds.bottom - scrollbarBounds.bottom : -1,
        scrollbarWidth: scrollbarBounds?.width || 0,
        thumbWidth: thumbBounds?.width || 0,
        thumbRadius: thumb ? Number.parseFloat(getComputedStyle(thumb).borderTopLeftRadius) : 0,
      }
    })
    assert.equal(geometry.edgeInset, expectedInset, `${id} scrollbars must use their radius-family edge inset`)
    assert.equal(geometry.rootOverflow, 'clip', `${id} rounded scroll areas must clip edge leakage`)
    assert.ok(
      Math.abs(geometry.scrollbarTopInset - expectedInset) <= 1 &&
        Math.abs(geometry.scrollbarBottomInset - expectedInset) <= 1,
      `${id} scrollbar must stay clear of both rounded ends: ${JSON.stringify(geometry)}`,
    )
    assert.ok(
      geometry.thumbWidth <= geometry.scrollbarWidth + 1,
      `${id} vertical thumb must not widen beyond its track: ${JSON.stringify(geometry)}`,
    )
    assert.ok(geometry.thumbRadius > 0, `${id} scrollbar thumb must inherit a visible radius`)
    radiusFamilies.push({ id, ...geometry })
  }
  assert.ok(
    radiusFamilies[0].rootRadius < radiusFamilies[1].rootRadius &&
      radiusFamilies[1].rootRadius < radiusFamilies[2].rootRadius,
    `the three product radius families must remain visually distinct: ${JSON.stringify(radiusFamilies)}`,
  )
  await page.locator('[data-box-style-id="default"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.boxStyle === 'default')
  await page.getByRole('tab', { name: /^背景/ }).click()
  await page.locator('[data-background-id="mountain"]').click()
  await page.locator('[data-background-id="cloud"]').click()
  const backgroundSelectionState = await page.locator('[data-background-id]').evaluateAll((cards) => {
    const panel = cards[0]?.closest('[data-slot="tabs-content"]')
    return {
      selected: cards.filter((card) => card.getAttribute('data-selected') === 'true').map((card) => card.getAttribute('data-background-id')),
      movingLayers: panel?.querySelectorAll('.app-selection-indicator, [data-selection-option]').length || 0,
    }
  })
  assert.deepEqual(backgroundSelectionState.selected, ['cloud'], 'background selection must update directly on the chosen label')
  assert.equal(backgroundSelectionState.movingLayers, 0, 'background selection must not mount a moving shared frame')
  await page.getByRole('tab', { name: /^方框/ }).click()
  await page.waitForTimeout(220)
  const roundedChoice = page.locator('[data-box-style-id="rounded"]')
  await roundedChoice.scrollIntoViewIfNeeded()
  const readRoundedChoiceDocumentBounds = () => roundedChoice.evaluate((choice) => {
    const bounds = choice.getBoundingClientRect()
    return {
      x: bounds.x + window.scrollX,
      y: bounds.y + window.scrollY,
      width: bounds.width,
      height: bounds.height,
    }
  })
  const roundedChoiceBoundsBefore = await readRoundedChoiceDocumentBounds()
  await roundedChoice.hover()
  await page.waitForTimeout(220)
  const roundedChoiceBoundsAfter = await readRoundedChoiceDocumentBounds()
  assert.ok(
    roundedChoiceBoundsAfter.width === roundedChoiceBoundsBefore.width &&
      roundedChoiceBoundsAfter.height === roundedChoiceBoundsBefore.height &&
      Math.abs(roundedChoiceBoundsAfter.x - roundedChoiceBoundsBefore.x) <= 1 &&
      Math.abs(roundedChoiceBoundsAfter.y - roundedChoiceBoundsBefore.y) <= 1,
    `box-style hover must preserve selectable-card geometry: ${JSON.stringify({ roundedChoiceBoundsBefore, roundedChoiceBoundsAfter })}`,
  )
  const defaultQuizSizes = await page.locator('[data-quiz-theme-fixture]').evaluateAll((cards) =>
    cards.map((card) => ({
      type: card.getAttribute('data-question-type'),
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
    })),
  )
  await roundedChoice.click()
  await page.waitForFunction(() => {
    const value = JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')
    return value?.box === 'rounded' && document.documentElement.dataset.boxStyle === 'rounded'
  })
  const roundedCardBackdrop = await page
    .locator('[data-case="app-surface"] [data-slot="card"]')
    .evaluate((card) => getComputedStyle(card).backdropFilter)
  assert.equal(
    roundedCardBackdrop,
    'none',
    'rounded content cards must remain ordinary opaque card surfaces without a backdrop pass',
  )
  await page.getByRole('tab', { name: /^配色/ }).click()
  await page.locator('[data-theme-preset-option="mist"]').click()
  await page.locator('[data-theme-preset-option="paper"]').click()
  const paletteSelectionState = await page.locator('[data-theme-preset-option]').evaluateAll((cards) => {
    const panel = cards[0]?.closest('[data-slot="tabs-content"]')
    return {
      selected: cards.filter((card) => card.getAttribute('data-selected') === 'true').map((card) => card.getAttribute('data-theme-preset-option')),
      movingLayers: panel?.querySelectorAll('.app-selection-indicator, [data-selection-option]').length || 0,
    }
  })
  assert.deepEqual(paletteSelectionState.selected, ['paper'], 'palette selection must update directly on the chosen label')
  assert.equal(paletteSelectionState.movingLayers, 0, 'palette selection must not mount a moving shared frame')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('tab', { name: /^背景/ }).click()
  const reducedSelectionMotion = await page.getByRole('tablist', { name: '风格设置分区' }).evaluate((list) => ({
    transforms: [...list.querySelectorAll('[data-slot="tabs-trigger"]')].map((trigger) => getComputedStyle(trigger).transform),
    movingLayers: list.querySelectorAll('.app-selection-indicator').length,
    switching: list.hasAttribute('data-selection-switching'),
    animationIds: list.getAnimations({ subtree: true }).map((animation) => animation.id).filter(Boolean),
  }))
  assert.ok(reducedSelectionMotion.transforms.every((transform) => transform === 'none'))
  assert.equal(reducedSelectionMotion.movingLayers, 1, 'reduced motion must retain one stable selected surface')
  assert.equal(reducedSelectionMotion.switching, false)
  assert.deepEqual(reducedSelectionMotion.animationIds, [])
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('tab', { name: /^配色/ }).click()
  await page.getByRole('tab', { name: /^背景/ }).click()
  await page.getByRole('tab', { name: /^方框/ }).click()
  const rapidSelectionState = await page.getByRole('tablist', { name: '风格设置分区' }).evaluate((list) => ({
    active: [...list.querySelectorAll('[data-slot="tabs-trigger"][data-active]')].map((trigger) => trigger.textContent?.trim()),
    transforms: [...list.querySelectorAll('[data-slot="tabs-trigger"]')].map((trigger) => getComputedStyle(trigger).transform),
    movingLayers: list.querySelectorAll('.app-selection-indicator').length,
    switching: list.hasAttribute('data-selection-switching'),
    animationIds: list.getAnimations({ subtree: true }).map((animation) => animation.id).filter(Boolean),
  }))
  assert.equal(rapidSelectionState.active.length, 1)
  assert.match(rapidSelectionState.active[0] || '', /^方框/)
  assert.ok(rapidSelectionState.transforms.every((transform) => transform === 'none'))
  assert.equal(rapidSelectionState.movingLayers, 1, 'rapid tab switching must retain one shared selected frame')
  assert.equal(rapidSelectionState.switching, true)
  assert.ok(
    rapidSelectionState.animationIds.length <= 1,
    'rapid appearance switching must retain one interruptible animation: ' + JSON.stringify(rapidSelectionState),
  )
  await page.waitForTimeout(260)
  const settledAppearanceSelection = await page.getByRole('tablist', { name: '风格设置分区' }).evaluate((list) => {
    const indicator = list.querySelector('.app-selection-indicator')?.getBoundingClientRect()
    const active = list.querySelector('[data-slot="tabs-trigger"][data-active]')?.getBoundingClientRect()
    return {
      centerDelta: indicator && active
        ? Math.abs(indicator.left + indicator.width / 2 - (active.left + active.width / 2))
        : Number.POSITIVE_INFINITY,
      sizeDelta: indicator && active
        ? Math.max(Math.abs(indicator.width - active.width), Math.abs(indicator.height - active.height))
        : Number.POSITIVE_INFINITY,
    }
  })
  assert.ok(
    settledAppearanceSelection.centerDelta <= 1 && settledAppearanceSelection.sizeDelta <= 1,
    'appearance selection must settle exactly on its shadcn trigger: ' + JSON.stringify(settledAppearanceSelection),
  )

  const sidebarFixture = page.locator('[data-sidebar-fixture]')
  await sidebarFixture.evaluate((fixture) => {
    fixture.hidden = false
  })
  await sidebarFixture.scrollIntoViewIfNeeded()
  const sidebarTrigger = sidebarFixture.getByRole('button', { name: '侧栏折叠测试' })
  for (let index = 0; index < 8; index += 1) await sidebarTrigger.click()
  await page.waitForTimeout(240)
  assert.equal(
    await sidebarFixture.locator('[data-slot="sidebar"]').first().getAttribute('data-state'),
    'expanded',
    'rapid shadcn Sidebar toggles must preserve the final controlled state',
  )
  await sidebarTrigger.click()
  await page.waitForTimeout(240)
  const collapsedSidebar = await sidebarFixture.locator('[data-slot="sidebar-container"]').evaluate((container) => ({
    width: container.getBoundingClientRect().width,
    contentOverflow: (() => {
      const content = container.querySelector('[data-slot="sidebar-inner"]')
      return content ? content.scrollWidth - content.clientWidth : Number.POSITIVE_INFINITY
    })(),
    overflowingNodes: (() => {
      const content = container.querySelector('[data-slot="sidebar-inner"]')
      if (!content) return []
      const bounds = content.getBoundingClientRect()
      return [...content.querySelectorAll('*')]
        .map((node) => {
          const nodeBounds = node.getBoundingClientRect()
          return {
            slot: node.getAttribute('data-slot'),
            className: node.className?.baseVal || node.className || '',
            left: Math.round((nodeBounds.left - bounds.left) * 10) / 10,
            right: Math.round((nodeBounds.right - bounds.right) * 10) / 10,
            width: Math.round(nodeBounds.width * 10) / 10,
            position: getComputedStyle(node).position,
          }
        })
        .filter((node) => node.left < -1 || node.right > 1)
    })(),
  }))
  assert.ok(
    collapsedSidebar.width <= 52 && collapsedSidebar.contentOverflow <= 1,
    `shadcn icon collapse must settle without clipped or overflowing content: ${JSON.stringify(collapsedSidebar)}`,
  )
  await sidebarTrigger.click()
  await page.waitForTimeout(240)
  const sidebarBoundary = await sidebarFixture.evaluate((fixture) => {
    const container = fixture.querySelector('[data-slot="sidebar-container"]')
    const inset = fixture.querySelector('[data-slot="sidebar-inset"]')
    const rail = fixture.querySelector('[data-slot="sidebar-rail"]')
    const containerBounds = container?.getBoundingClientRect()
    const railBounds = rail?.getBoundingClientRect()
    return {
      sidebarBorder: container ? Number.parseFloat(getComputedStyle(container).borderRightWidth) : -1,
      insetBorder: inset ? Number.parseFloat(getComputedStyle(inset).borderLeftWidth) : -1,
      railCenterDelta: containerBounds && railBounds
        ? Math.abs(containerBounds.right - (railBounds.left + railBounds.width / 2))
        : Number.POSITIVE_INFINITY,
    }
  })
  assert.equal(sidebarBoundary.sidebarBorder, 1, 'the official Sidebar container must own the single right boundary')
  assert.equal(sidebarBoundary.insetBorder, 0, 'SidebarInset must not draw a duplicate adjacent boundary')
  assert.ok(
    sidebarBoundary.railCenterDelta <= 1,
    'SidebarRail must stay centered on the official boundary: ' + JSON.stringify(sidebarBoundary),
  )
  const unselectedSidebarItem = sidebarFixture.getByRole('button', { name: /侧栏项目二/ })
  const selectedSidebarWeight = await sidebarFixture
    .getByRole('button', { name: /侧栏项目一/ })
    .evaluate((button) => getComputedStyle(button.lastElementChild).fontWeight)
  const unselectedSidebarBefore = await unselectedSidebarItem.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    color: getComputedStyle(button).color,
    labelColor: getComputedStyle(button.lastElementChild).color,
    labelWeight: getComputedStyle(button.lastElementChild).fontWeight,
  }))
  await unselectedSidebarItem.hover()
  await page.waitForTimeout(180)
  const unselectedSidebarAfter = await unselectedSidebarItem.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    color: getComputedStyle(button).color,
    labelColor: getComputedStyle(button.lastElementChild).color,
    labelWeight: getComputedStyle(button.lastElementChild).fontWeight,
  }))
  assert.equal(
    unselectedSidebarAfter.background,
    unselectedSidebarBefore.background,
    'unselected Sidebar hover must not paint a background block',
  )
  assert.equal(
    unselectedSidebarAfter.color,
    unselectedSidebarBefore.color,
    'unselected Sidebar hover must not recolor the complete option',
  )
  assert.equal(
    unselectedSidebarAfter.labelColor,
    unselectedSidebarBefore.labelColor,
    'unselected Sidebar hover must not recolor its text label',
  )
  assert.notEqual(
    unselectedSidebarAfter.labelWeight,
    unselectedSidebarBefore.labelWeight,
    'unselected Sidebar hover must only strengthen its text weight',
  )
  assert.equal(
    unselectedSidebarAfter.labelWeight,
    selectedSidebarWeight,
    'hovered and selected Sidebar labels must use the exact same bold weight',
  )
  await page.mouse.down()
  const unselectedSidebarPressed = await unselectedSidebarItem.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    color: getComputedStyle(button).color,
    labelColor: getComputedStyle(button.lastElementChild).color,
    labelWeight: getComputedStyle(button.lastElementChild).fontWeight,
  }))
  assert.deepEqual(
    unselectedSidebarPressed,
    {
      ...unselectedSidebarBefore,
      labelWeight: selectedSidebarWeight,
    },
    'pressing an unselected Sidebar item must retain only the shared bold text feedback',
  )
  await page.mouse.up()
  await sidebarFixture.getByRole('button', { name: /侧栏项目一/ }).click()
  await sidebarFixture.getByRole('button', { name: /侧栏项目三/ }).click()
  await sidebarFixture.getByRole('button', { name: /侧栏项目二/ }).click()
  const sidebarMenuState = await sidebarFixture.locator('[data-slot="sidebar-menu"]').evaluate((list) => ({
    active: [...list.querySelectorAll('[data-slot="sidebar-menu-button"][data-active]')].map((button) => button.textContent?.trim()),
    movingLayers: list.querySelectorAll('.app-selection-indicator').length,
    switching: list.hasAttribute('data-selection-switching'),
    animationIds: list.getAnimations({ subtree: true }).map((animation) => animation.id).filter(Boolean),
  }))
  assert.deepEqual(sidebarMenuState.active, ['2侧栏项目二'])
  assert.equal(sidebarMenuState.movingLayers, 1)
  assert.equal(sidebarMenuState.switching, true)
  assert.ok(
    sidebarMenuState.animationIds.length <= 1,
    'rapid sidebar switching must retain one interruptible animation: ' + JSON.stringify(sidebarMenuState),
  )
  await page.waitForTimeout(260)
  const settledSidebarSelection = await sidebarFixture.locator('[data-slot="sidebar-menu"]').evaluate((list) => {
    const indicator = list.querySelector('.app-selection-indicator')?.getBoundingClientRect()
    const active = list.querySelector('[data-slot="sidebar-menu-button"][data-active]')?.getBoundingClientRect()
    return {
      centerDelta: indicator && active
        ? Math.max(
            Math.abs(indicator.left + indicator.width / 2 - (active.left + active.width / 2)),
            Math.abs(indicator.top + indicator.height / 2 - (active.top + active.height / 2)),
          )
        : Number.POSITIVE_INFINITY,
      sizeDelta: indicator && active
        ? Math.max(Math.abs(indicator.width - active.width), Math.abs(indicator.height - active.height))
        : Number.POSITIVE_INFINITY,
    }
  })
  assert.ok(
    settledSidebarSelection.centerDelta <= 1 && settledSidebarSelection.sizeDelta <= 1,
    'sidebar selection must settle exactly on its shadcn button: ' + JSON.stringify(settledSidebarSelection),
  )
  await sidebarFixture.evaluate((fixture) => {
    fixture.hidden = true
  })
  await page.getByRole('tab', { name: /^配色/ }).click()
  for (const themeId of [
    'paper',
    'mist',
    'apricot',
    'sage',
    'rose',
    'ink',
    'midnight',
    'pine',
    'aurora',
  ]) {
    await page.locator(`[data-theme-preset-option="${themeId}"]`).click()
    await page.waitForFunction(
      (id) => document.documentElement.dataset.themePreset === id,
      themeId,
    )
    const recordMaterial = await recordsFixture.locator('#record-r3').evaluate(async (target) => {
      target.removeAttribute('data-record-jump-highlight')
      const normal = getComputedStyle(target)
      const normalState = {
        style: normal.borderStyle,
        width: normal.borderWidth,
        color: normal.borderColor,
      }
      target.setAttribute('data-record-jump-highlight', 'true')
      await new Promise((resolve) => window.setTimeout(resolve, 180))
      const highlighted = getComputedStyle(target)
      const highlightedState = {
        style: highlighted.borderStyle,
        width: highlighted.borderWidth,
        color: highlighted.borderColor,
      }
      target.removeAttribute('data-record-jump-highlight')
      return { normalState, highlightedState }
    })
    assert.equal(
      recordMaterial.normalState.style,
      'solid',
      `${themeId} written records must retain a material boundary`,
    )
    assert.ok(
      Number.parseFloat(recordMaterial.normalState.width) >= 1,
      `${themeId} written record boundary must remain visible: ${JSON.stringify(recordMaterial)}`,
    )
    assert.doesNotMatch(
      recordMaterial.normalState.color,
      /(?:\/ 0\)|, 0\))$/,
      `${themeId} written record boundary must not become transparent`,
    )
    assert.equal(
      recordMaterial.highlightedState.style,
      'solid',
      `${themeId} jump state must retain a semantic boundary`,
    )
    assert.ok(
      Number.parseFloat(recordMaterial.highlightedState.width) >= 1,
      `${themeId} jump highlight must retain the quiet material boundary: ${JSON.stringify(recordMaterial)}`,
    )
    assert.notEqual(
      recordMaterial.highlightedState.color,
      recordMaterial.normalState.color,
      `${themeId} jump highlight must remain distinguishable from the normal boundary`,
    )
  }
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'auto')
  await page.getByRole('tab', { name: /^方框/ }).click()
  await page.locator('[data-box-style-id="rounded"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.boxStyle === 'rounded')
  const roundedSurfaceState = await page.locator('[data-case="app-surface"]').evaluate((surface) => {
    const card = surface.querySelector('[data-slot="card"]')
    const style = getComputedStyle(card)
    return {
      backdrop: style.backdropFilter,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
    }
  })
  assert.deepEqual(
    roundedSurfaceState,
    { backdrop: 'none', backgroundImage: 'none', boxShadow: 'none' },
    'rounded mode must remain an ordinary card surface with no special material layer',
  )
  const roundedQuizGeometry = await page.locator('[data-quiz-theme-fixture]').evaluateAll((cards) =>
    cards.map((card) => ({
      type: card.getAttribute('data-question-type'),
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
      overflowX: card.scrollWidth - card.clientWidth,
      overflowY: card.scrollHeight - card.clientHeight,
      backdrop: getComputedStyle(card).backdropFilter,
      contain: getComputedStyle(card).contain,
      outlineStyle: getComputedStyle(card).outlineStyle,
      overflow: getComputedStyle(card).overflow,
      cardRadius: getComputedStyle(card).borderStartStartRadius,
      edgeContent: getComputedStyle(card, '::before').content,
      backgroundImage: getComputedStyle(card).backgroundImage,
      boxShadow: getComputedStyle(card).boxShadow,
      borderWidths: [
        getComputedStyle(card).borderTopWidth,
        getComputedStyle(card).borderRightWidth,
        getComputedStyle(card).borderBottomWidth,
        getComputedStyle(card).borderLeftWidth,
      ],
      headerTopOffset:
        card.querySelector('[data-slot="card-header"]').getBoundingClientRect().top -
        card.getBoundingClientRect().top,
      headerRadius: getComputedStyle(card.querySelector('[data-slot="card-header"]')).borderStartStartRadius,
      footerRadius: getComputedStyle(card.querySelector('[data-slot="card-footer"]')).borderEndStartRadius,
    })),
  )
  roundedQuizGeometry.forEach((card) => {
    assert.ok(
      card.overflowX <= 1 && card.overflowY <= 1,
      `rounded mode must not clip or enlarge ${card.type} quiz content: ${JSON.stringify(card)}`,
    )
    assert.equal(card.backdrop, 'none', `rounded quiz cards must avoid backdrop sampling on ${card.type}`)
    assert.equal(card.contain, 'none', `${card.type} quiz cards must not create an independent containment surface at their corners`)
    assert.equal(card.outlineStyle, 'none', `${card.type} quiz cards must not rasterize a second rounded outline`)
    assert.equal(card.overflow, 'hidden', `${card.type} quiz material layers must be clipped by one outer radius`)
    assert.ok(Number.parseFloat(card.cardRadius) > 0, `${card.type} quiz card must retain its outer radius`)
    assert.equal(card.edgeContent, 'none', `${card.type} quiz card must not add a second masked rim that can fracture at corners`)
    assert.equal(card.backgroundImage, 'none', `${card.type} quiz card must not retain a second top-edge gradient layer`)
    assert.equal(card.boxShadow, 'none', `${card.type} quiz card must not rely on a shadow that its locked viewport can clip`)
    assert.equal(new Set(card.borderWidths).size, 1, `${card.type} quiz card must keep one continuous border around all four corners`)
    assert.ok(card.headerTopOffset <= 2, `${card.type} quiz header must begin directly inside the single outer edge`)
    assert.equal(Number.parseFloat(card.headerRadius), 0, `${card.type} quiz header must rely on the single outer top radius`)
    assert.equal(Number.parseFloat(card.footerRadius), 0, `${card.type} quiz footer must rely on the single outer bottom radius`)
  })
  assert.deepEqual(
    roundedQuizGeometry.map(({ type, width, height }) => ({ type, width, height })),
    defaultQuizSizes,
    'switching to rounded mode must not resize or reflow quiz cards',
  )
  if (process.env.CLASS_RECORD_ROUNDED_SCREENSHOT) {
    await page.screenshot({ path: process.env.CLASS_RECORD_ROUNDED_SCREENSHOT, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 720 })
  await assertFullscreenImageViewer(page, 'rounded 390px')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.locator('[data-box-style-id="default"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.boxStyle === 'default')
  const resetRoundedState = await page.locator('[data-case="app-surface"] [data-slot="card"]').evaluate((card) => ({
    backdrop: getComputedStyle(card).backdropFilter,
  }))
  assert.deepEqual(resetRoundedState, { backdrop: 'none' }, 'default box mode must retain the same ordinary card material')

  await page.evaluate(() => window.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: 'auto' }))
  const bottomBoundary = await page.evaluate(() => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      scrollY: window.scrollY,
      maximum: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
      rootImage: getComputedStyle(document.documentElement).backgroundImage,
    }
  })
  assert.ok(Math.abs(bottomBoundary.scrollY - bottomBoundary.maximum) <= 1, `the document must clamp its final scroll position: ${JSON.stringify(bottomBoundary)}`)
  assert.match(bottomBoundary.rootImage, /cloud\.webp/, 'the selected root background must remain continuous at the lower scroll edge')

  const teacherSection = page.locator('[data-people-role="teacher"]')
  await teacherSection.scrollIntoViewIfNeeded()
  assert.equal(await teacherSection.locator('tbody tr').count(), 2, 'the teacher group must retain all people')
  assert.equal(await teacherSection.locator('tbody tr').first().getByRole('link').textContent(), '普通老师', 'default ID sorting must remain unchanged')
  assert.equal(await teacherSection.locator('tbody').getByText('主要', { exact: true }).count(), 0, 'main teachers must not expose a visible badge')
  await teacherSection.getByRole('button', { name: '主要老师优先' }).click()
  assert.equal(await teacherSection.locator('tbody tr').first().getByRole('link').textContent(), '重点老师', 'main-teacher priority must still move the marked person first')

  const guide = page.locator('[data-case="guide"]')
  await guide.scrollIntoViewIfNeeded()
  await guide.getByRole('link', { name: /记录/ }).first().waitFor({ state: 'visible' })
  const guideLogo = guide.locator('.guide-hero [role="img"]').first()
  const guideLogoSemantics = await guideLogo.evaluate((logo) => {
    const image = logo.querySelector('img')
    return {
      tag: logo.tagName,
      interactiveAncestor: Boolean(logo.closest('a, button, [role="button"]')),
      tabIndex: logo.getAttribute('tabindex'),
      cursor: getComputedStyle(logo).cursor,
      userSelect: getComputedStyle(logo).userSelect,
      imageDraggable: image?.draggable,
      imagePointerEvents: image ? getComputedStyle(image).pointerEvents : '',
      imageUserSelect: image ? getComputedStyle(image).userSelect : '',
    }
  })
  assert.equal(guideLogoSemantics.tag, 'DIV', 'guide logo must be a presentational container')
  assert.equal(guideLogoSemantics.interactiveAncestor, false, 'guide logo must not retain a link, button or button role')
  assert.equal(guideLogoSemantics.tabIndex, null, 'guide logo must not be keyboard focusable')
  assert.notEqual(guideLogoSemantics.cursor, 'pointer', 'guide logo must not advertise click behavior')
  assert.equal(guideLogoSemantics.userSelect, 'none', 'guide logo must not be selectable')
  assert.equal(guideLogoSemantics.imageDraggable, false, 'guide logo image must not be draggable')
  assert.equal(guideLogoSemantics.imagePointerEvents, 'none', 'guide logo image must not receive pointer events')
  assert.equal(guideLogoSemantics.imageUserSelect, 'none', 'guide logo image must not be selectable')
  assert.equal(await guide.getByRole('link', { name: /记录/ }).count() > 0, true, 'guide must expose the primary records entry')
  assert.equal(await guide.getByRole('link', { name: /致谢/ }).count(), 1, 'guide must restore the baseline credits entry')
  assert.equal(await guide.getByRole('button', { name: /历史上的今天/ }).count(), 1, 'guide must retain the date-matched history entry')
  const guideRecordItem = guide.locator('a.app-interactive-item[href="/records"]').last()
  const guideTimelineItem = guide.locator('a.app-interactive-item[href="/timeline"]')
  const readGuideItemState = (item) =>
    item.evaluate((link) => {
      const bounds = link.getBoundingClientRect()
      const styles = getComputedStyle(link)
      return {
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        background: styles.backgroundColor,
        border: styles.borderColor,
      }
    })
  const guideItemBefore = await readGuideItemState(guideRecordItem)
  await guideRecordItem.hover()
  await page.waitForTimeout(220)
  const guidePrimaryAfter = await readGuideItemState(guideRecordItem)
  assert.deepEqual(
    guidePrimaryAfter.bounds,
    guideItemBefore.bounds,
    'guide entry hover must not move or resize the shared interactive item',
  )
  assert.ok(
    guidePrimaryAfter.background !== guideItemBefore.background ||
      guidePrimaryAfter.border !== guideItemBefore.border,
    `guide entry hover must expose the shared item feedback: ${JSON.stringify({ guideItemBefore, guidePrimaryAfter })}`,
  )
  await guideTimelineItem.hover()
  await page.waitForTimeout(220)
  const guideSecondaryAfter = await readGuideItemState(guideTimelineItem)
  assert.deepEqual(
    {
      background: guidePrimaryAfter.background,
      border: guidePrimaryAfter.border,
    },
    {
      background: guideSecondaryAfter.background,
      border: guideSecondaryAfter.border,
    },
    'primary and secondary guide entries must share the same hover colors',
  )
  await page.keyboard.press('Tab')
  await guideRecordItem.focus()
  assert.notEqual(
    await guideRecordItem.evaluate((link) => getComputedStyle(link).boxShadow),
    'none',
    'guide entry keyboard focus must expose the shared focus-visible ring',
  )
  const guideGeometry = await guide.evaluate((section) => ({
    overflow: section.scrollWidth - section.clientWidth,
    heroColumns: getComputedStyle(section.querySelector('.guide-hero [data-slot="card-content"]')).gridTemplateColumns,
    primaryLinks: new Set([...section.querySelectorAll('a[href="/records"], a[href="/people"], a[href="/quotes"]')].map((link) => link.getAttribute('href'))).size,
    toolLinks: new Set([...section.querySelectorAll('a[href="/timeline"], a[href="/search"], a[href="/quiz"], a[href="/materials"], a[href="/map"], a[href="/backgrounds"], a[href="/credits"]')].map((link) => link.getAttribute('href'))).size,
  }))
  assert.ok(guideGeometry.overflow <= 1, 'guide layout must not overflow its content lane')
  assert.equal(guideGeometry.primaryLinks, 3, 'guide must retain all three primary archive entries')
  assert.equal(guideGeometry.toolLinks, 7, 'guide must retain all baseline secondary entries')
  if (process.env.CLASS_RECORD_LAYOUT_SCREENSHOT) {
    await page.screenshot({ path: process.env.CLASS_RECORD_LAYOUT_SCREENSHOT, fullPage: true })
  }

  const stacks = await page.evaluate(() =>
    [...document.querySelectorAll('[data-case="stack"] .record-stack')].map((stack) => {
      const top = stack.querySelector('.record-stack-top')
      const bottom = stack.querySelector('.record-stack-bottom')
      const line = stack.querySelector('.record-stack-line')
      const before = line ? getComputedStyle(line, '::before') : null
      const topBounds = top?.getBoundingClientRect()
      const bottomBounds = bottom?.getBoundingClientRect()
      const lineBounds = line?.getBoundingClientRect()
      return {
        line: line?.getBoundingClientRect().width || 0,
        label: Math.max(top?.getBoundingClientRect().width || 0, bottom?.getBoundingClientRect().width || 0),
        extension: Math.abs(Number.parseFloat(before?.left || '0')) + Math.abs(Number.parseFloat(before?.right || '0')),
        marginLeft: Number.parseFloat(getComputedStyle(stack).marginLeft),
        marginRight: Number.parseFloat(getComputedStyle(stack).marginRight),
        fontSize: Number.parseFloat(getComputedStyle(stack).fontSize),
        topGap: topBounds && lineBounds ? lineBounds.top - topBounds.bottom : 0,
        bottomGap: bottomBounds && lineBounds ? bottomBounds.top - lineBounds.bottom : 0,
      }
    }),
  )
  assert.ok(stacks.length === 2)
  stacks.forEach((stack) => {
    assert.ok(stack.line >= stack.label - 1, 'stack rule must derive from the widest rendered label')
    assert.ok(stack.extension >= stack.fontSize * 0.6, 'stack rule must visibly extend beyond the widest label')
    assert.ok(stack.marginLeft >= stack.fontSize * 0.4 && stack.marginRight >= stack.fontSize * 0.4, 'stack rules must keep a clear gap from adjacent text')
    assert.ok(stack.topGap >= 1.5 && stack.bottomGap >= 1.5, 'stack labels must not touch or overlap their rule')
  })

  const shortTrigger = page.getByRole('button', { name: '短注触发' })
  await shortTrigger.scrollIntoViewIfNeeded()
  const shortTriggerBox = await shortTrigger.boundingBox()
  assert.ok(shortTriggerBox)
  const annotationPointerX = shortTriggerBox.x + Math.min(8, shortTriggerBox.width / 3)
  await page.mouse.move(annotationPointerX, shortTriggerBox.y + shortTriggerBox.height / 2)
  const annotationPopup = page.locator('.record-annotation-popup[data-open]')
  await annotationPopup.waitFor({ state: 'visible' })
  const firstAnnotationPopup = await annotationPopup.boundingBox()
  assert.ok(firstAnnotationPopup)
  assert.ok(Math.abs(firstAnnotationPopup.x + firstAnnotationPopup.width / 2 - annotationPointerX) <= 2, 'annotation popup must initially center on pointer clientX')
  await page.mouse.move(shortTriggerBox.x + shortTriggerBox.width - 2, shortTriggerBox.y + shortTriggerBox.height / 2)
  await page.waitForTimeout(80)
  const movedAnnotationPopup = await annotationPopup.boundingBox()
  assert.ok(movedAnnotationPopup)
  assert.ok(Math.abs(movedAnnotationPopup.x - firstAnnotationPopup.x) <= 1, 'an open annotation popup must not follow later pointer movement')
  await page.locator('.record-annotation-popup').evaluate((element) => {
    window.__annotationScrollCloseCount = 0
    const observer = new MutationObserver(() => {
      if (element.hasAttribute('data-closed')) window.__annotationScrollCloseCount += 1
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-closed'] })
    window.setTimeout(() => observer.disconnect(), 800)
  })
  await page.evaluate(() => window.scrollBy(0, 2))
  await page.locator('.record-annotation-popup[data-closed]').waitFor({ state: 'visible' })
  await annotationPopup.waitFor({ state: 'hidden' })
  await page.waitForTimeout(180)
  assert.equal(
    await page.evaluate(() => window.__annotationScrollCloseCount),
    1,
    'one vertical scroll must start exactly one annotation exit lifecycle',
  )
  assert.equal(
    await page.locator('.record-annotation-popup[data-open]').count(),
    0,
    'a stationary pointer must not reopen an annotation after scrolling',
  )
  await page.mouse.move(4, 4)
  await shortTrigger.hover()
  await annotationPopup.waitFor({ state: 'visible' })
  const shortWidth = await annotationPopup.evaluate((element) => element.getBoundingClientRect().width)
  const annotationExitOrigin = await annotationPopup.evaluate((element) => {
    const bounds = element.parentElement?.getBoundingClientRect()
    return { left: bounds?.left || 0, top: bounds?.top || 0 }
  })
  await annotationPopup.evaluate((element) => {
    const samples = []
    window.__annotationExitSamples = samples
    const started = performance.now()
    const sample = () => {
      if (element.isConnected) {
        const bounds = element.parentElement?.getBoundingClientRect()
        samples.push({
          closed: element.hasAttribute('data-closed'),
          left: bounds?.left || 0,
          top: bounds?.top || 0,
        })
      }
    }
    const capture = () => {
      sample()
      if (element.isConnected && performance.now() - started < 2000) requestAnimationFrame(capture)
    }
    window.__annotationExitObserver = new MutationObserver(sample)
    window.__annotationExitObserver.observe(element, {
      attributes: true,
      attributeFilter: ['data-closed'],
    })
    requestAnimationFrame(capture)
  })
  await page.mouse.move(4, 4)
  await annotationPopup.waitFor({ state: 'hidden' })
  const annotationExitSamples = await page.evaluate(() => {
    window.__annotationExitObserver?.disconnect()
    delete window.__annotationExitObserver
    return window.__annotationExitSamples || []
  })
  const closedAnnotationSamples = annotationExitSamples.filter((sample) => sample.closed)
  assert.ok(closedAnnotationSamples.length > 0, 'annotation popup must retain a real exit-animation phase')
  assert.ok(
    closedAnnotationSamples.every(
      (sample) =>
        Math.abs(sample.left - annotationExitOrigin.left) <= 1 &&
        Math.abs(sample.top - annotationExitOrigin.top) <= 1,
    ),
    `annotation exit position jumped: ${JSON.stringify(closedAnnotationSamples)}`,
  )
  await shortTrigger.focus()
  await page.keyboard.press('Enter')
  await annotationPopup.waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await annotationPopup.waitFor({ state: 'hidden' })
  const longTrigger = page.getByRole('button', { name: '长注触发' })
  await longTrigger.hover()
  await annotationPopup.waitFor({ state: 'visible' })
  await page.waitForTimeout(50)
  const longGeometry = await annotationPopup.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    right: element.getBoundingClientRect().right,
    left: element.getBoundingClientRect().left,
    overflow: element.scrollWidth - element.clientWidth,
  }))
  assert.ok(shortWidth < longGeometry.width, 'short annotations must not reserve the long-content width')
  assert.ok(longGeometry.width <= 352.5, 'long annotations must respect the business max width')
  assert.ok(longGeometry.left >= 0 && longGeometry.right <= 1280, 'annotation collision handling must keep the popup visible')
  assert.ok(longGeometry.overflow <= 1, 'long and unbreakable annotation content must wrap safely')
  const annotationHtml = await annotationPopup.innerHTML()
  assert.match(annotationHtml, /person-link/, `nested person markup must render as a link: ${annotationHtml}`)
  const nestedPerson = annotationPopup.locator('a.person-link', { hasText: '人物标记' })
  assert.equal(await nestedPerson.getAttribute('href'), '/person?id=p01', 'nested person markup must keep the canonical person target')
  await nestedPerson.click()
  await page.waitForFunction(() => window.__memoryLocation === '/person?id=p01')
  await page.evaluate(() => window.__memoryNavigate('/'))
  await page.waitForFunction(() => window.__memoryLocation === '/')
  await longTrigger.scrollIntoViewIfNeeded()
  await page.waitForTimeout(50)
  await longTrigger.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.matches('a.person-link'))
  await nestedPerson.press('Enter')
  await page.waitForFunction(() => window.__memoryLocation === '/person?id=p01')

  await page.setViewportSize({ width: 320, height: 1000 })
  await page.mouse.move(4, 4)
  await longTrigger.hover()
  await annotationPopup.waitFor({ state: 'visible' })
  const mobileAnnotation = await annotationPopup.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    overflow: element.scrollWidth - element.clientWidth,
  }))
  assert.ok(mobileAnnotation.width <= 312.5, 'mobile annotations must respect viewport padding')
  assert.ok(mobileAnnotation.left >= 0 && mobileAnnotation.right <= 320, 'mobile annotation collision handling must keep the popup visible')
  assert.ok(mobileAnnotation.overflow <= 1, 'mobile annotation content must wrap without clipping')

  await page.setViewportSize({ width: 1280, height: 1000 })

  const edgeAnnotation = page.getByRole('button', { name: '边缘注释' })
  await edgeAnnotation.scrollIntoViewIfNeeded()
  const edgeAnnotationBox = await edgeAnnotation.boundingBox()
  assert.ok(edgeAnnotationBox)
  await page.mouse.move(edgeAnnotationBox.x + edgeAnnotationBox.width - 1, edgeAnnotationBox.y + edgeAnnotationBox.height / 2)
  await annotationPopup.waitFor({ state: 'visible' })
  const edgeAnnotationPopup = await annotationPopup.boundingBox()
  assert.ok(edgeAnnotationPopup)
  assert.ok(edgeAnnotationPopup.x >= 4 && edgeAnnotationPopup.x + edgeAnnotationPopup.width <= 1276, 'annotation collision handling must keep edge-anchored popups fully visible')

  const illustration = page.getByRole('button', { name: '从这里查看插图' })
  const triggerBox = await illustration.boundingBox()
  assert.ok(triggerBox)
  const initialPointerX = triggerBox.x + Math.min(12, triggerBox.width / 3)
  await page.mouse.move(initialPointerX, triggerBox.y + triggerBox.height / 2)
  const illustrationPopup = page.locator('.record-illustration-popup[data-open]')
  await illustrationPopup.waitFor({ state: 'visible', timeout: 300 })
  const firstPopup = await illustrationPopup.boundingBox()
  assert.ok(firstPopup)
  assert.ok(Math.abs(firstPopup.x + firstPopup.width / 2 - initialPointerX) <= 2, 'illustration popup must initially center on pointer clientX')
  await page.mouse.move(triggerBox.x + triggerBox.width - 3, triggerBox.y + triggerBox.height / 2)
  await page.waitForTimeout(80)
  const movedPopup = await illustrationPopup.boundingBox()
  assert.ok(movedPopup)
  assert.ok(
    Math.abs(movedPopup.x + movedPopup.width / 2 - initialPointerX) <= 2,
    'an open illustration popup must remain anchored to the pointer position that opened it',
  )
  await page.locator('.record-illustration-popup').evaluate((element) => {
    window.__illustrationScrollCloseCount = 0
    const observer = new MutationObserver(() => {
      if (element.hasAttribute('data-closed')) window.__illustrationScrollCloseCount += 1
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-closed'] })
    window.setTimeout(() => observer.disconnect(), 800)
  })
  await page.evaluate(() => window.scrollBy(0, 2))
  await page.locator('.record-illustration-popup[data-closed]').waitFor({ state: 'visible' })
  await illustrationPopup.waitFor({ state: 'hidden' })
  await page.waitForTimeout(180)
  assert.equal(
    await page.evaluate(() => window.__illustrationScrollCloseCount),
    1,
    'one vertical scroll must start exactly one illustration exit lifecycle',
  )
  assert.equal(
    await page.locator('.record-illustration-popup[data-open]').count(),
    0,
    'a stationary pointer must not reopen an illustration after scrolling',
  )
  await page.mouse.move(4, 4)
  await illustration.hover()
  await illustrationPopup.waitFor({ state: 'visible' })
  const illustrationExitOrigin = await illustrationPopup.evaluate((element) => {
    const bounds = element.parentElement?.getBoundingClientRect()
    return { left: bounds?.left || 0, top: bounds?.top || 0 }
  })
  await illustrationPopup.evaluate((element) => {
    const samples = []
    window.__illustrationExitSamples = samples
    const started = performance.now()
    const capture = () => {
      if (element.isConnected) {
        const bounds = element.parentElement?.getBoundingClientRect()
        samples.push({
          closed: element.hasAttribute('data-closed'),
          left: bounds?.left || 0,
          top: bounds?.top || 0,
        })
      }
      if (element.isConnected && performance.now() - started < 2000) requestAnimationFrame(capture)
    }
    requestAnimationFrame(capture)
  })
  await page.mouse.move(4, 4)
  await illustrationPopup.waitFor({ state: 'hidden' })
  const illustrationExitSamples = await page.evaluate(() => window.__illustrationExitSamples || [])
  const closedIllustrationSamples = illustrationExitSamples.filter((sample) => sample.closed)
  assert.ok(closedIllustrationSamples.length > 0, 'illustration popup must retain a real exit-animation phase')
  assert.ok(
    closedIllustrationSamples.every(
      (sample) =>
        Math.abs(sample.left - illustrationExitOrigin.left) <= 1 &&
        Math.abs(sample.top - illustrationExitOrigin.top) <= 1,
    ),
    `illustration exit position jumped: ${JSON.stringify(closedIllustrationSamples)}`,
  )

  const edgeIllustration = page.getByRole('button', { name: '边界插图测试' })
  const edgeTriggerBox = await edgeIllustration.boundingBox()
  assert.ok(edgeTriggerBox)
  await page.mouse.move(edgeTriggerBox.x + edgeTriggerBox.width - 2, edgeTriggerBox.y + edgeTriggerBox.height / 2)
  await illustrationPopup.waitFor({ state: 'visible' })
  await page.waitForTimeout(50)
  const edgePopup = await illustrationPopup.boundingBox()
  assert.ok(edgePopup)
  assert.ok(edgePopup.x >= 4 && edgePopup.x + edgePopup.width <= 1276, 'viewport collision handling must keep edge-anchored illustration popups fully visible')

  const guardedDirectHash = await page.evaluate(() => {
    history.replaceState(history.state, '', '/class/records?view=written#record-r2')
    window.__installRecordJumpGuard()
    const pending = JSON.parse(
      sessionStorage.getItem('classrecord:pending-record-jump') || 'null',
    )
    const result = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      pendingTarget: pending?.targetAnchorId || '',
    }
    sessionStorage.removeItem('classrecord:pending-record-jump')
    history.replaceState(history.state, '', '/')
    return result
  })
  assert.deepEqual(
    guardedDirectHash,
    {
      pathname: '/class/records',
      search: '?view=written',
      hash: '',
      pendingTarget: 'record-r2',
    },
    'direct record fragments under a deployment basename must be captured before native anchor scrolling',
  )

  assert.deepEqual(pageErrors, [], `browser page errors during interaction regression: ${pageErrors.join('; ')}`)
  assert.deepEqual(consoleProblems, [], `browser console warnings/errors: ${consoleProblems.join('; ')}`)
  assert.ok(
    expectedHarnessNetworkFailures <= 6,
    `the credential-free image harness exceeded the bounded page/illustration retry budget: ${expectedHarnessNetworkFailures}`,
  )

  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const touchErrors = []
  touchPage.on('pageerror', (error) => touchErrors.push(error.message))
  await touchPage.goto(origin, { waitUntil: 'domcontentloaded' })
  await waitForMarkupLayoutReady(touchPage, { pageErrors: touchErrors })
  const touchLongTrigger = touchPage.getByRole('button', { name: '长注触发' })
  await touchLongTrigger.scrollIntoViewIfNeeded()
  await touchPage.waitForTimeout(80)
  await touchLongTrigger.tap()
  const touchAnnotation = touchPage.locator('.record-annotation-popup[data-open]')
  await touchAnnotation.waitFor({ state: 'visible' })
  await touchPage.waitForTimeout(160)
  const touchPerson = touchAnnotation.locator('a.person-link', { hasText: '人物标记' })
  await touchPerson.tap()
  await touchPage.waitForFunction(() => window.__memoryLocation === '/person?id=p01')
  assert.deepEqual(touchErrors, [], `touch browser page errors: ${touchErrors.join('; ')}`)
  await touchPage.close()

  for (const deviceScaleFactor of [1.25, 2]) {
    const densityPage = await browser.newPage({
      viewport: { width: 960, height: 720 },
      deviceScaleFactor,
    })
    const densityErrors = []
    densityPage.on('pageerror', (error) => densityErrors.push(error.message))
    await densityPage.goto(origin, { waitUntil: 'domcontentloaded' })
    await waitForMarkupLayoutReady(densityPage, { pageErrors: densityErrors })
    await densityPage.getByRole('tab', { name: /^方框/ }).click()
    await densityPage.locator('[data-box-style-id="rounded"]').click()
    await densityPage.waitForFunction(
      () => document.documentElement.dataset.boxStyle === 'rounded',
    )
    const densityQuizEdges = await densityPage
      .locator('[data-quiz-theme-fixture]')
      .evaluateAll((cards) =>
        cards.map((card) => {
          const style = getComputedStyle(card)
          return {
            outline: style.outlineStyle,
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            backdrop: style.backdropFilter,
            pseudoContent: getComputedStyle(card, '::before').content,
          }
        }),
      )
    densityQuizEdges.forEach((edge) => {
      assert.equal(edge.outline, 'none', `DPR ${deviceScaleFactor} quiz edge must not duplicate its border`)
      assert.deepEqual(
        edge.borderWidths,
        ['1px', '1px', '1px', '1px'],
        `DPR ${deviceScaleFactor} quiz edge must be one continuous box-model border`,
      )
      assert.equal(edge.backdrop, 'none', `DPR ${deviceScaleFactor} quiz edge must not resample the backdrop`)
      assert.equal(edge.pseudoContent, 'none', `DPR ${deviceScaleFactor} quiz edge must not add a masked rim`)
    })
    await assertFullscreenImageViewer(
      densityPage,
      `rounded DPR ${deviceScaleFactor}`,
    )
    assert.deepEqual(
      densityErrors,
      [],
      `DPR ${deviceScaleFactor} browser page errors: ${densityErrors.join('; ')}`,
    )
    await densityPage.close()
  }

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`)
} finally {
  await browser.close()
  await vite.close()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

console.log(
  'Record markup browser layout checks passed at 1280, 768, 390 and 320 CSS pixels plus 1.25x and 2x DPR.',
)
