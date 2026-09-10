import assert from 'node:assert/strict'
import path from 'node:path'
import { chromium, webkit } from 'playwright'
import { createServer, preview } from 'vite'
import { frontend } from './test-react-helpers.mjs'
import { findSystemChromium } from './layout/browser-runtime.mjs'

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
async function contextFor({ admin = false, mobile = false, authenticated = true } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile, reducedMotion: 'reduce' })
  if (authenticated) await context.addInitScript(({ admin }) => {
    if (!location.protocol.startsWith('http')) return
    const now = new Date().toISOString()
    localStorage.setItem('classRecord:inviteAccess', JSON.stringify({ type: 'invite', token: admin ? 'fixture-admin' : 'fixture-normal', authorizedAt: now }))
    localStorage.setItem('classRecord:lastVisitAt', now)
  }, { admin })
  await context.route('https://*.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push(url.pathname)
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }
    const respond = (data) => route.fulfill({ status: 200, headers, body: JSON.stringify(data) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.includes('/rpc/refresh_invite_access')) return respond(true)
    if (url.pathname.includes('/rpc/verify_invite_code')) return respond({ ok: true, accessToken: 'fixture-normal' })
    if (url.pathname.includes('/rpc/has_class_record_admin_access')) return respond(admin)
    if (url.pathname.includes('/rpc/get_class_record_order')) return respond(records.filter((r) => !r.hidden || (admin && request.postDataJSON()?.include_hidden)).map((r) => ({ file_name: r.file_name, page: '01' })))
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      if (request.method() === 'POST') return respond({ signedURL: url.pathname.replace('/storage/v1', '') + '?token=test' })
      return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'image/svg+xml' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#779999"/></svg>' })
    }
    const table = url.pathname.split('/').at(-1)
    if (table === 'class_records') return respond(records.filter((r) => r.hidden === (url.searchParams.get('hidden') === 'eq.true') && (!r.hidden || admin)))
    if ((table === 'class_record_pages' || table === 'class_quiz_questions') && !admin) return respond([])
    if (['class_page_messages', 'class_page_supplements'].includes(table)) return respond(tables[table].filter((r) => r.hidden === (url.searchParams.get('hidden') === 'eq.true') && (!r.hidden || admin)))
    if (table in tables) return respond(tables[table])
    throw new Error(`Unexpected API request ${url.pathname}`)
  })
  context.on('page', (page) => {
    page.on('pageerror', (error) => problems.push(error.message))
    page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) problems.push(msg.text()) })
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

  for (const route of ['', 'records/', 'people', 'person?id=p1', 'quotes', 'timeline', 'backgrounds', 'quiz/', 'materials/', 'map/', 'credits', 'search?q=正文', '404', 'missing']) {
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
  await touch.locator('#record-r1').focus()
  await touch.keyboard.type('qibaishihuaxia')
  assert.equal(await touch.locator('#record-r3').count(), 0, 'normal session cannot unlock hidden records')
  for (const route of ['', 'people', 'person?id=p1', 'quotes', 'timeline', 'backgrounds', 'quiz/', 'materials/', 'map/', 'credits', 'search?q=正文', 'missing']) {
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
  assert.deepEqual(problems, [], 'browser console and page errors')
  console.log(`Application browser regression passed (${engine === webkit ? 'WebKit' : 'Chromium'}): routes, stream order, permissions, annotations, nested images, keyboard and mobile; API requests=${requests.length}.`)
} finally {
  await browser.close()
  if ('close' in vite) await vite.close()
  else await new Promise((resolve) => vite.httpServer.close(resolve))
}
