import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const recordRoot = path.join(root, 'private-assets/content/record')
const scanRoot = path.join(root, 'private-assets/record-pages')
const outputRoot = process.argv[2] || path.join(os.tmpdir(), 'class-privacy-mask-review')
const requestedPages = new Set(process.argv.slice(3).map((value) => value.padStart(2, '0')))

const files = (await fs.readdir(recordRoot))
  .filter((file) => /^\d{4}-\d{2}-\d{2}-\d{2}\.json$/u.test(file))
  .sort()
const positions = new Map(files.map((file, index) => [file, index]))
const records = new Map()
for (const file of files) {
  records.set(file, JSON.parse(await fs.readFile(path.join(recordRoot, file), 'utf8')))
}
const pages = JSON.parse(await fs.readFile(path.join(recordRoot, 'record_pages.json'), 'utf8'))
const publicPages = pages.filter((page) => page.hidden !== true && page.privacyMasks?.length)

function rangeForPage(page) {
  const linked = pages.filter(
    (candidate) => candidate === page || candidate.sourceImage === page.page,
  )
  const indexes = linked.flatMap((candidate) =>
    [candidate.start, candidate.end]
      .map((file) => positions.get(file))
      .filter((index) => index !== undefined),
  )
  if (!indexes.length) return []
  return files.slice(Math.min(...indexes), Math.max(...indexes) + 1)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

await fs.mkdir(outputRoot, { recursive: true })
const edgePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
const browser = await chromium.launch({
  headless: true,
  ...(await fs.access(edgePath).then(
    () => ({ executablePath: edgePath }),
    () => ({}),
  )),
})
const browserPage = await browser.newPage({ viewport: { width: 1800, height: 1500 } })

for (const page of publicPages) {
  if (requestedPages.size && !requestedPages.has(page.page)) continue
  const scanPath = path.join(scanRoot, `${page.page}.jpeg`)
  const scan = await fs.readFile(scanPath)
  const source = `data:image/jpeg;base64,${scan.toString('base64')}`
  const recordRows = rangeForPage(page)
    .map((file) => {
      const record = records.get(file) || {}
      const content = String(record.content || '')
        .replace(/\[\[[^|\]]+\|/gu, '')
        .replace(/\]\]/gu, '')
        .replace(/\s+/gu, ' ')
      return `<li class="${record.hidden === true ? 'hidden' : 'public'}"><b>${record.hidden === true ? 'H' : 'P'} ${escapeHtml(file.replace('.json', ''))}</b><span>${escapeHtml(content.slice(0, 120))}</span></li>`
    })
    .join('')
  const masks = page.privacyMasks
    .map(
      (mask, index) =>
        `<span class="mask" style="left:${mask.x}%;top:${mask.y}%;width:${mask.width}%;height:${mask.height}%"><b>${index + 1}</b></span>`,
    )
    .join('')
  await browserPage.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;padding:20px;background:#18202a;color:#eef2f6;font:16px/1.45 system-ui,sans-serif}
    h1{margin:0 0 14px;font-size:24px}.layout{display:grid;grid-template-columns:minmax(0,930px) minmax(0,1fr);gap:20px;align-items:start}
    figure{position:relative;margin:0;background:#fff}img{display:block;width:100%;height:auto}.mask{position:absolute;background:rgb(245 55 65 / 34%);border:3px solid #f30;color:#fff}.mask b{position:absolute;left:0;top:0;padding:2px 6px;background:#d20;font-size:18px}
    ol{margin:0;padding:0;list-style:none;display:grid;gap:7px}li{padding:7px 9px;border-left:5px solid;border-radius:4px;background:#25303d}li.hidden{border-color:#ff5252}li.public{border-color:#55d47b}li b{display:block;font-size:14px}li span{display:block;color:#d5dbe2;font-size:14px}
  </style><h1>第 ${escapeHtml(page.page)} 页 · ${page.privacyMasks.length} 个遮罩</h1><div class="layout"><figure><img src="${source}">${masks}</figure><ol>${recordRows}</ol></div>`)
  await browserPage.locator('img').waitFor({ state: 'visible' })
  await browserPage.screenshot({ path: path.join(outputRoot, `${page.page}.png`), fullPage: true })
}

await browser.close()
console.log(`Privacy mask review sheets written to ${outputRoot}`)
