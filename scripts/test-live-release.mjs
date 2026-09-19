import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { createAdminRequest, loadAdminDotEnv } from './admin-runtime.mjs'
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

assert.equal(process.env.CLASS_RECORD_LIVE_RELEASE, '1', 'Explicit CLASS_RECORD_LIVE_RELEASE=1 is required: creates and cleans up temporary test invitations/sessions.')
await loadAdminDotEnv(process.cwd())
const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const pepper = process.env.INVITE_CODE_PEPPER
assert.ok(url && serviceRoleKey && pepper, 'Missing live administration configuration')
const request = createAdminRequest({ url, serviceRoleKey })
const config = await readFile('frontend/src/services/supabase.ts', 'utf8')
const anonKey = config.match(/FALLBACK_ANON_KEY\s*=\s*\n?\s*'([^']+)'/)[1]
const hash = (value) => createHash('sha256').update(`${pepper}:${value}`).digest('hex')
const note = `release-regression:${randomUUID()}`
const json = { 'Content-Type': 'application/json' }
const tokenHashes = new Set()
const rpc = async (name, token, body = {}) => {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...json, apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'x-class-record-access': token }, body: JSON.stringify(body) })
  assert.equal(response.status, 200, `RPC ${name} status`)
  return response.json()
}
const server = await preview({ base: '/class/', configFile: path.resolve('frontend/vite.config.ts'), root: path.resolve('frontend'), logLevel: 'error' })
const browser = await chromium.launch({ headless: true, executablePath: await findSystemChromium() })
const origin = server.resolvedUrls.local[0]
try {
  // An UPDATE matching no rows verifies statement triggers without changing
  // production content. The only changed value is the business revision.
  const beforeVersion = Number((await request('/rest/v1/class_data_version?select=revision'))[0].revision)
  for (const [table, column] of Object.entries({ class_records: 'file_name', class_people: 'id', class_record_pages: 'page', class_page_messages: 'page', class_page_supplements: 'file_name', class_materials: 'id', class_quiz_questions: 'id', class_credits_page: 'id', class_private_assets: 'asset_key' })) {
    const absent = `release-probe-${randomUUID()}`
    await request(`/rest/v1/${table}?${column}=eq.${absent}`, { method: 'PATCH', headers: json, body: JSON.stringify({ [column]: absent }) })
  }
  const afterVersion = Number((await request('/rest/v1/class_data_version?select=revision'))[0].revision)
  assert.ok(afterVersion >= beforeVersion + 9, 'all live business tables must advance the shared revision')
  console.log('PASS live business revision triggers: nine tables; no content rows changed.')
  for (const level of ['normal', 'admin']) {
    const code = `CR-${randomBytes(12).toString('hex').toUpperCase()}`
    await request('/rest/v1/invite_codes', { method: 'POST', headers: json, body: JSON.stringify({ code_hash: hash(code), access_level: level, note, used: false, expires_at: new Date(Date.now() + 600_000).toISOString() }) })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(60_000)
    const errors = []
    let intentionalInvalidation = false
    page.on('response', async (response) => {
      if (!response.url().endsWith('/rpc/verify_invite_code')) return
      const result = await response.json().catch(() => null)
      if (typeof result?.accessToken === 'string') tokenHashes.add(hash(result.accessToken))
    })
    page.on('pageerror', (error) => errors.push({ kind: 'page', message: error.message.replace(/https?:\/\/\S+/g, '[url]') }))
    page.on('console', (message) => {
      if (!['error', 'warning'].includes(message.type())) return
      const url = message.location().url || origin
      const pathname = new URL(url).pathname
      if (intentionalInvalidation && pathname.endsWith('/rpc/get_class_data_version')) return
      errors.push({ kind: message.type(), path: pathname, message: message.text().replace(/https?:\/\/\S+/g, '[url]') })
    })
    await page.goto(origin + 'qb')
    await page.getByLabel('邀请码', { exact: true }).fill(code)
    await page.getByRole('button', { name: '进入档案' }).click()
    await waitQbContent(page)
    if (qbAsset.ready) {
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        const dimensions = await qbContent(page).evaluate((image) => {
          const box = image.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }
        })
        assert.ok(dimensions.width > 0 && dimensions.height > 0)
        assert.ok(dimensions.x >= 0 && dimensions.y >= 0 && dimensions.x + dimensions.width <= width + 1 && dimensions.y + dimensions.height <= 901, `live QB fits ${width}`)
        assert.ok(Math.abs(dimensions.width / dimensions.height - dimensions.naturalWidth / dimensions.naturalHeight) < 0.02, 'live QB preserves the supplied image aspect ratio')
        assert.ok(dimensions.width <= dimensions.naturalWidth + 1, 'small QB image retains its natural size')
      }
    }
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem('classRecord:inviteAccess')).token)
    const tokenHash = hash(token)
    tokenHashes.add(tokenHash)
    assert.equal(await rpc('has_class_record_admin_access', token), level === 'admin')
    assert.match(await rpc('get_class_data_version', token), /^\d+$/)
    const security = await promisify(execFile)(process.execPath, ['scripts/verify-live-security.mjs', `--asset=${qbAsset.ready ? qbAsset.path : 'images/private/meal-map.png'}`], { env: { ...process.env, CLASS_RECORD_ACCESS_TOKEN: token } })
    console.log(security.stdout.trim())
    await page.reload()
    await waitQbContent(page)
    for (const route of ['records', 'people', 'quotes', 'timeline', 'quiz', 'materials', 'map', 'backgrounds', 'credits', 'search?q=记录']) {
      await page.goto(origin + route)
      await page.locator('main').waitFor()
      await page.waitForFunction(() => !/正在打开档案|正在验证访问权限|正在准备页面插图/.test(document.body.innerText))
      assert.equal(await page.getByText('页面发生意外错误', { exact: true }).count(), 0, route)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, route)
    }
    await page.goto(origin + 'qb')
    await waitQbContent(page)
    intentionalInvalidation = true
    const expiry = level === 'normal' ? { expires_at: new Date(Date.now() - 1000).toISOString() } : { revoked_at: new Date().toISOString() }
    await request(`/rest/v1/invite_access_sessions?token_hash=eq.${tokenHash}`, { method: 'PATCH', headers: json, body: JSON.stringify(expiry) })
    assert.equal(await rpc('refresh_invite_access', token, { input_token: token }), false)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.getByLabel('邀请码', { exact: true }).waitFor()
    assert.equal(await qbContent(page).count(), 0)
    assert.deepEqual(errors, [], `${level} live browser console/page errors`)
    await context.close()
    console.log(`PASS live ${level}: invite, QB return/refresh, role RPC, main pages, ${level === 'normal' ? 'expiry' : 'revocation'} and access teardown.`)
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  for (const tokenHash of tokenHashes) {
    await request(`/rest/v1/invite_access_sessions?token_hash=eq.${tokenHash}`, { method: 'DELETE' })
  }
  await request(`/rest/v1/invite_codes?note=eq.${encodeURIComponent(note)}`, { method: 'DELETE' })
  console.log('Temporary release invitations and test sessions cleaned up.')
}
