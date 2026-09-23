import assert from 'node:assert/strict'
import path from 'node:path'
import { chromium, webkit } from 'playwright'
import { createServer, preview } from 'vite'
import { frontend } from './test-react-helpers.mjs'
import { findSystemChromium } from './layout/browser-runtime.mjs'
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

const annotation = '普通注解 [[person:p1|人物一]] [[author:p2|额外记录人]] [[record:r2|跳转记录]] [[material:m1|查看资料]] [[anno:嵌套 [[red:说明]]|注解提示]] [[illu:test.png|注解插图]] [[frac:[[sup:2]]|3]] [[arrow:加热|催化]] [[table:2x2|甲|乙|[[under:丙]]|[[del:丁]]]] [[hide:黑幕]] [[center:居中]] [[right:右对齐]]'
const row = (id, hidden, raw = {}) => ({ record_id: id, file_name: `${id}.json`, record_index: Number(id.slice(1)), record_date: '2025-01-01', record_time: '', author: 'p1', content: `正文 ${id} [[person:p1|人物一]] [[quote:q${id}|原话${id}]]`, hidden, attachments: [], importance: 'normal', raw })
const records = [row('r1', false, { annotation }), row('r2', false), row('r3', true, { annotation: '   ' })]
const people = ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, person_id: id, name: id === 'p1' ? '人物一' : `人物${id}`, aliases: [], alias: '', role: 'student', subject: '', main: false, bio: '人物简介', avatar_url: '', raw: {} }))
const tables = {
  class_people: people,
  class_page_messages: [{ page: '01', hidden: false, content: '箴言正文', author: 'p1', raw: { annotation: '箴言注解 [[red:[[under:嵌套文字]]]]' } }],
  class_page_supplements: [{ page: '01', hidden: false, file_name: '01-01.json', supplement_index: 1, content: '补充正文', author: 'p1', raw: { annotation: `补充注解 ${'长注解。'.repeat(800)}` } }],
  class_materials: [{ id: 'm1', material_id: 'm1', title: '测试资料', content: '资料正文 [[record:r1|来源记录]]', raw: {} }],
  class_record_pages: [{ page: '01', start_file: 'r1.json', end_file: 'r3.json', image_path: 'images/record-pages/01.jpeg', hidden: false, sort_order: 0, raw: {} }],
  class_quiz_questions: [{ id: 'secret', answer: 'a', prompt: '隐藏题', image_path: 'images/quiz/test.png', raw: {} }],
  class_credits_page: { id: 'main', title: '致谢', sections: [], thanks: ['感谢记录者'], original_images: [], raw: {} },
  class_private_assets: { width: 800, height: 600 },
}
tables.class_page_messages.push({ page: '02', hidden: true, content: '隐藏箴言', author: 'p1', raw: { annotation: '隐藏箴言注解' } })
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
    if (url.pathname.includes('/rpc/refresh_invite_access')) return respond(validAccess)
    if (url.pathname.includes('/rpc/verify_invite_code')) return respond({ ok: true, accessToken: admin ? 'fixture-admin' : 'fixture-normal' })
    if (url.pathname.includes('/rpc/has_class_record_admin_access')) return respond(admin)
    if (url.pathname.includes('/rpc/get_class_record_order')) return respond(records.filter((r) => !r.hidden || (admin && request.postDataJSON()?.include_hidden)).map((r) => ({ file_name: r.file_name, page: '01' })))
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      if (request.method() === 'POST') return respond({ signedURL: url.pathname.replace('/storage/v1', '') + '?token=test' })
      return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'image/svg+xml' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#779999"/></svg>' })
    }
    const table = url.pathname.split('/').at(-1)
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
  assert.equal(await page.locator('[data-slot="dialog-overlay"]').count(), 0, 'annotation must not mount a modal overlay')
  const annotationBounds = await dialog.boundingBox()
  assert.ok(annotationBounds.x >= 0 && annotationBounds.x + annotationBounds.width <= 1280)
  await button.click()
  await dialog.waitFor({ state: 'hidden' })
  await button.click()
  await dialog.waitFor()
  assert.equal(await dialog.locator('.record-table-scroll').count(), 1)
  assert.equal(await dialog.locator('.person-link').count(), 1)
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
  await dialog.getByRole('button', { name: '注解插图' }).click()
  await page.locator('[data-image-viewer-dialog]').waitFor()
  await page.getByRole('button', { name: '关闭大图' }).click()
  await page.locator('[data-image-viewer-dialog]').waitFor({ state: 'hidden' })
  await dialog.locator('a.record-link').click()
  await dialog.waitFor({ state: 'hidden' })
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('button', { name: '留在此处' }).click()
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
  }
  await context.close()
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
  await touch.locator('[data-slot="sidebar-trigger"]').click()
  await touch.locator('[data-mobile="true"] a[href$="/people"]').click()
  await touch.waitForURL(/people$/)
  await touch.locator('[data-mobile="true"]').waitFor({ state: 'hidden' })
  await touch.goto(origin + 'records')
  await waitCards(touch, 4)
  await touch.locator('#record-r1').focus()
  await touch.keyboard.type('qibaishihuaxia')
  assert.equal(await touch.locator('#record-r3').count(), 0, 'normal session cannot unlock hidden records')
  for (const route of ['', 'qb', 'people', 'person?id=p1', 'quotes', 'timeline', 'backgrounds', 'quiz/', 'materials/', 'map/', 'credits', 'search?q=正文', 'missing']) {
    await touch.goto(origin + route)
    await touch.locator('main').waitFor()
    await touch.waitForFunction(() => !document.body.innerText.includes('正在打开档案') && !document.body.innerText.includes('正在准备页面插图') && !document.body.innerText.includes('正在验证访问权限'))
    assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `mobile ${route}`)
  }
  await mobile.close()
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
    records[0].content += ' [[illu:offscreen-proof.jpg|尚未展开的插图]]'
    const since = networkEvents.length
    versionDelay = 300
    await cachedPage.goto(origin + 'records')
    await waitCards(cachedPage, 4)
    const cold = networkEvents.slice(since)
    const business = (events) => events.filter((e) => /\/class_|get_class_record_order/.test(e.path))
    const versions = (events) => events.filter((e) => e.path.endsWith('get_class_data_version'))
    assert.equal(versions(cold).length, 1, 'cold concurrent readers share one initial version check')
    assert.equal(cold.some((e) => e.path.includes('offscreen-proof')), false, 'closed illustrations must not be prefetched')
    assert.equal(new Set(business(cold).map((e) => e.path)).size, business(cold).length, 'cold business loads are deduplicated')
    const grant = await cachedPage.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')))
    const warmStart = networkEvents.length
    await cachedPage.reload()
    await waitCards(cachedPage, 4)
    const warm = networkEvents.slice(warmStart)
    assert.equal(versions(warm).length, 1, 'full reload checks the version once')
    assert.equal(business(warm).length, 0, 'unchanged reload uses cached business data exclusively')
    await cachedPage.evaluate(() => sessionStorage.clear())
    const reopenedStart = networkEvents.length
    await cachedPage.reload()
    await waitCards(cachedPage, 4)
    assert.equal(business(networkEvents.slice(reopenedStart)).length, 0, 'reopened site reuses IndexedDB when session cache is absent')
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
      const { preloadImageDimensions } = await import(origin + 'src/services/image-metadata.ts')
      await signAssetUrl('data/attachments/cache-proof.png')
      await preloadImageDimensions('data/attachments/cache-proof.png')
      await (await caches.open('static-proof')).put('/static-proof', new Response('preserved'))
      window.__recordNode = document.querySelector('#record-r1')
    }, origin)
    const signCount = () => requests.filter((path) => path.includes('/storage/v1/object/sign/')).length
    const businessCount = () => requests.filter((path) => /\/class_|get_class_record_order/.test(path)).length
    const authCount = () => requests.filter((path) => path.endsWith('refresh_invite_access')).length
    const initialReads = businessCount()
    const initialAuth = authCount()
    const initialSigns = signCount()
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
    assert.equal(signCount(), initialSigns, 'database changes must not re-sign unchanged images')
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
} finally {
  await browser.close()
  if ('close' in vite) await vite.close()
  else await new Promise((resolve) => vite.httpServer.close(resolve))
}
