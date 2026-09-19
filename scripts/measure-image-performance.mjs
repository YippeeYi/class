// Read-only live check. Never logs signed URLs, credentials, or image contents.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { loadAdminDotEnv } from './admin-runtime.mjs'
import { findSystemChromium } from './layout/browser-runtime.mjs'

await loadAdminDotEnv(process.cwd())
const base = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
assert.ok(base && key, 'Missing local Storage inspection configuration')
const asset = 'images/record-pages/01.jpeg'
const urls = {}
const results = {}
for (const variant of ['original', 'preview']) {
  const response = await fetch(`${base}/storage/v1/object/sign/classrecord-private/${asset}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60, ...(variant === 'preview' ? { transform: { width: 1200, quality: 72, resize: 'contain' } } : {}) }),
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(response.status, 200, `${variant} signing`)
  const { signedURL } = await response.json()
  urls[variant] = signedURL.startsWith('http') ? signedURL : `${base}/storage/v1${signedURL}`
  const image = await fetch(urls[variant], { signal: AbortSignal.timeout(20000) })
  assert.equal(image.status, 200, `${variant} image`)
  results[variant] = { bytes: (await image.arrayBuffer()).byteLength, type: image.headers.get('content-type'), cacheControl: image.headers.get('cache-control'), expires: image.headers.get('expires') }
}
assert.ok(results.preview.bytes < results.original.bytes / 2, 'preview must materially reduce image bytes')
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
  response.end('<!doctype html><title>Private image cache measurement</title>')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true, executablePath: await findSystemChromium() })
try {
  const page = await browser.newPage()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  let cached = 0
  const headers = []
  const imageRequests = new Set()
  cdp.on('Network.requestWillBeSent', ({ requestId, request }) => { if (request.url === urls.preview) imageRequests.add(requestId) })
  cdp.on('Network.requestServedFromCache', ({ requestId }) => { if (imageRequests.has(requestId)) cached++ })
  cdp.on('Network.responseReceived', ({ response }) => {
    if (response.url === urls.preview) headers.push({ cacheControl: response.headers['cache-control'] ?? response.headers['Cache-Control'] ?? null, expires: response.headers.expires ?? response.headers.Expires ?? null, diskCache: Boolean(response.fromDiskCache) })
  })
  const decode = () => page.evaluate(async (src) => {
    const image = new Image()
    image.decoding = 'async'
    image.src = src
    await image.decode()
    document.body.replaceChildren(image)
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, urls.preview)
  await page.goto(origin)
  results.preview.dimensions = await decode()
  await page.goto(origin)
  await decode()
  results.browser = { repeatCacheHits: cached, responses: headers }
  assert.ok(results.preview.dimensions.width <= 1200)
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
