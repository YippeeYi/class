import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'frontend', 'dist')
const budget = JSON.parse(await readFile(path.join(root, 'bundle-budget.json'), 'utf8'))

const requiredBudgets = [
  'maxJavaScriptChunkGzipBytes',
  'maxStylesheetGzipBytes',
  'maxTotalJavaScriptGzipBytes',
  'maxTotalDistBytes',
]
for (const key of requiredBudgets) {
  assert.ok(Number.isSafeInteger(budget[key]) && budget[key] > 0, `invalid bundle budget: ${key}`)
}

async function walk(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...(await walk(absolute)))
    else if (entry.isFile()) output.push(absolute)
  }
  return output
}

const files = await walk(distRoot).catch(() => {
  throw new Error('frontend/dist is missing; run npm run build before npm run budget')
})
const measurements = []
let totalDistBytes = 0
for (const absolute of files) {
  const relative = path.relative(distRoot, absolute).replaceAll(path.sep, '/')
  const bytes = (await stat(absolute)).size
  totalDistBytes += bytes
  if (!/\.(?:js|css)$/u.test(relative)) continue
  const gzipBytes = gzipSync(await readFile(absolute), { level: 9 }).byteLength
  measurements.push({ relative, bytes, gzipBytes })
}

const failures = []
for (const item of measurements) {
  const limit = item.relative.endsWith('.js')
    ? budget.maxJavaScriptChunkGzipBytes
    : budget.maxStylesheetGzipBytes
  if (item.gzipBytes > limit) {
    failures.push(`${item.relative}: gzip=${item.gzipBytes}, limit=${limit}`)
  }
}
const totalJavaScriptGzipBytes = measurements
  .filter((item) => item.relative.endsWith('.js'))
  .reduce((sum, item) => sum + item.gzipBytes, 0)
if (totalJavaScriptGzipBytes > budget.maxTotalJavaScriptGzipBytes) {
  failures.push(
    `total JavaScript: gzip=${totalJavaScriptGzipBytes}, limit=${budget.maxTotalJavaScriptGzipBytes}`,
  )
}
if (totalDistBytes > budget.maxTotalDistBytes) {
  failures.push(`total dist: bytes=${totalDistBytes}, limit=${budget.maxTotalDistBytes}`)
}

const largest = measurements
  .filter((item) => item.relative.endsWith('.js'))
  .sort((left, right) => right.gzipBytes - left.gzipBytes)
  .slice(0, 5)
  .map((item) => `${item.relative}=${item.gzipBytes}`)
  .join(', ')
console.log(
  `Bundle budget: total-js-gzip=${totalJavaScriptGzipBytes}, total-dist=${totalDistBytes}, largest=[${largest}].`,
)
if (failures.length) throw new Error(`Bundle budget exceeded:\n${failures.join('\n')}`)
