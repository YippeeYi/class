import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const contentRoot = path.join(root, 'private-assets/content')
const recordRoot = path.join(contentRoot, 'record')
const pagesPath = path.join(recordRoot, 'record_pages.json')
const reviewPath = path.join(contentRoot, 'privacy-hidden-records.txt')
const apply = process.argv.includes('--apply')

const reviewed = new Set(
  (await fs.readFile(reviewPath, 'utf8'))
    .split(/\r?\n/u)
    .map((line) => line.replace(/#.*/u, '').trim())
    .filter(Boolean)
    .map((id) => `${id.replace(/\.json$/iu, '')}.json`),
)
const allFiles = (await fs.readdir(recordRoot))
  .filter((file) => /^\d{4}-\d{2}-\d{2}-\d{2}\.json$/u.test(file))
  .sort()
const positions = new Map(allFiles.map((file, index) => [file, index]))

for (const file of reviewed) assert.ok(positions.has(file), `隐私复核清单中的记录不存在：${file}`)

const sourceRecords = new Map()
for (const file of allFiles) {
  sourceRecords.set(file, JSON.parse(await fs.readFile(path.join(recordRoot, file), 'utf8')))
}

function rangeFiles(page) {
  const start = positions.get(page.start)
  const end = positions.get(page.end)
  if (start === undefined || end === undefined) return []
  return allFiles.slice(Math.min(start, end), Math.max(start, end) + 1)
}

function visibleTextWeight(file) {
  const content = String(sourceRecords.get(file)?.content || '')
  const visible = content
    .replace(/\[\[[^|\]]+\|/gu, '')
    .replace(/\]\]/gu, '')
    .replace(/\s+/gu, '')
  const illustrationCount = (content.match(/\[\[illu:/gu) || []).length
  return Math.max(1.5, Math.ceil(visible.length / 26)) + illustrationCount * 5
}

function masksForPage(page, hiddenFiles) {
  const files = rangeFiles(page)
  if (!files.length || !hiddenFiles.length) return []
  const weights = files.map(visibleTextWeight)
  const total = weights.reduce((sum, value) => sum + value, 0)
  let cursor = 14
  const masks = []
  files.forEach((file, index) => {
    const height = ((weights[index] || 0) / total) * 82
    if (hiddenFiles.includes(file)) {
      masks.push({
        x: 4,
        y: Number(Math.max(3, cursor - 1.5).toFixed(2)),
        width: 92,
        height: Number(Math.min(96 - cursor, height + 3).toFixed(2)),
      })
    }
    cursor += height
  })
  return masks.reduce((merged, mask) => {
    const previous = merged.at(-1)
    if (previous && mask.y <= previous.y + previous.height + 0.8) {
      previous.height = Number(
        (Math.max(previous.y + previous.height, mask.y + mask.height) - previous.y).toFixed(2),
      )
    } else merged.push(mask)
    return merged
  }, [])
}

let pages = JSON.parse(await fs.readFile(pagesPath, 'utf8'))
if (apply) {
  for (const [file, record] of sourceRecords) {
    if (!reviewed.has(file)) continue
    record.hidden = true
    await fs.writeFile(path.join(recordRoot, file), `${JSON.stringify(record, null, 4)}\n`)
  }

  const alreadyGenerated = pages.some((page) => page.hidden === true)
  const ordinaryPages = pages.filter((page) => page.hidden !== true)
  const nextPages = []
  const hiddenPages = []
  for (const page of ordinaryPages) {
    if (alreadyGenerated) {
      nextPages.push(page)
      continue
    }
    const files = rangeFiles(page)
    const hiddenFiles = files.filter((file) => reviewed.has(file))
    const visibleFiles = files.filter((file) => !reviewed.has(file))
    const masks = masksForPage(page, hiddenFiles)
    if (page.page === '40') masks.push({ x: 12, y: 60, width: 43, height: 25 })
    nextPages.push({
      ...page,
      start: visibleFiles.at(0) || '',
      end: visibleFiles.at(-1) || '',
      ...(masks.length ? { privacyMasks: masks } : {}),
    })
    if (hiddenFiles.length || page.page === '40') {
      hiddenPages.push({
        page: `H${page.page}`,
        start: hiddenFiles.at(0) || '',
        end: hiddenFiles.at(-1) || '',
        hidden: true,
        image: `H${page.page}`,
        sourceImage: page.page,
      })
    }
  }
  if (!alreadyGenerated) {
    pages = [...nextPages, ...hiddenPages]
    await fs.writeFile(pagesPath, `${JSON.stringify(pages, null, 4)}\n`)
  }

  const supplementPath = path.join(contentRoot, 'page-supplements/40-03.json')
  const supplement = JSON.parse(await fs.readFile(supplementPath, 'utf8'))
  supplement.hidden = true
  supplement.page = 'H40'
  await fs.writeFile(supplementPath, `${JSON.stringify(supplement, null, 4)}\n`)
}

const errors = []
for (const [file, record] of sourceRecords) {
  const hidden = apply ? reviewed.has(file) || record.hidden === true : record.hidden === true
  if (reviewed.has(file) !== hidden) errors.push(`hidden 状态与复核清单不一致：${file}`)
}
const ordinaryPages = new Map(pages.filter((page) => !page.hidden).map((page) => [page.page, page]))
const hiddenPages = pages.filter((page) => page.hidden)
for (const hiddenPage of hiddenPages) {
  const sourcePage = String(hiddenPage.sourceImage || '').trim()
  const ordinary = ordinaryPages.get(sourcePage)
  if (!ordinary) errors.push(`Hxx 页缺少对应普通页：${hiddenPage.page}`)
  if (!Array.isArray(ordinary?.privacyMasks) || !ordinary.privacyMasks.length) {
    errors.push(`普通页缺少隐私遮罩：${sourcePage || hiddenPage.page}`)
  }
  const sourceImage = path.join(root, 'private-assets/record-pages', `${sourcePage}.jpeg`)
  try {
    await fs.access(sourceImage)
  } catch {
    errors.push(`Hxx 页的无损源扫描不存在：${sourceImage}`)
  }
}
for (const file of reviewed) {
  if (
    !hiddenPages.some((page) => {
      const start = positions.get(page.start)
      const end = positions.get(page.end)
      const index = positions.get(file)
      return start !== undefined && end !== undefined && index >= Math.min(start, end) && index <= Math.max(start, end)
    }) &&
    file !== '2026-02-04-04.json'
  ) {
    errors.push(`隐藏记录没有对应 Hxx 扫描页：${file}`)
  }
}
const supplement = JSON.parse(
  await fs.readFile(path.join(contentRoot, 'page-supplements/40-03.json'), 'utf8'),
)
if (supplement.hidden !== true || supplement.page !== 'H40') {
  errors.push('第 40 页定向羞辱补录必须隐藏并映射到 H40。')
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR ${error}`))
  process.exitCode = 1
} else {
  console.log(
    `Privacy audit passed: ${reviewed.size} records, 1 supplement, ${hiddenPages.length} protected scan pages.`,
  )
}
