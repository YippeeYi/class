import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const contentRoot = path.join(root, 'private-assets/content')
const recordRoot = path.join(contentRoot, 'record')
const messageRoot = path.join(contentRoot, 'messages')
const supplementRoot = path.join(contentRoot, 'page-supplements')
const pagesPath = path.join(recordRoot, 'record_pages.json')
const reviewPath = path.join(contentRoot, 'privacy-hidden-records.txt')
const obsoleteMessageReviewPath = path.join(contentRoot, 'privacy-hidden-messages.txt')
const apply = process.argv.includes('--apply')
const digitalOnlyHiddenRecords = new Set(['2026-02-04-04.json'])

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
const sourceRecords = new Map()
for (const file of allFiles) {
  sourceRecords.set(file, JSON.parse(await fs.readFile(path.join(recordRoot, file), 'utf8')))
}
for (const file of reviewed) assert.ok(positions.has(file), `隐私复核清单中的记录不存在：${file}`)

function rangeFiles(page) {
  const start = positions.get(page.start || page.startFile)
  const end = positions.get(page.end || page.endFile)
  if (start === undefined || end === undefined) return []
  return allFiles.slice(Math.min(start, end), Math.max(start, end) + 1)
}

function recordRange(page) {
  const indexes = rangeFiles(page).map((file) => positions.get(file)).filter(Number.isInteger)
  return indexes.length ? [Math.min(...indexes), Math.max(...indexes)] : null
}

let pages = JSON.parse(await fs.readFile(pagesPath, 'utf8'))
const hiddenPagesBeforeApply = pages.filter((page) => page.hidden === true)

if (apply) {
  for (const [file, record] of sourceRecords) {
    if (reviewed.has(file)) record.hidden = true
    else delete record.hidden
    await fs.writeFile(path.join(recordRoot, file), `${JSON.stringify(record, null, 4)}\n`)
  }

  const retainedHiddenPages = hiddenPagesBeforeApply.filter((page) =>
    rangeFiles(page).some((file) => reviewed.has(file)),
  )
  const retainedBySource = new Map(
    retainedHiddenPages.map((page) => [String(page.sourceImage || page.page).replace(/^H/u, ''), page]),
  )
  const publicPages = pages
    .filter((page) => page.hidden !== true)
    .map((page) => {
      const next = { ...page }
      delete next.privacyMasks
      const hiddenPage = retainedBySource.get(String(next.page))
      const publicRange = recordRange(next)
      const hiddenRange = hiddenPage ? recordRange(hiddenPage) : null
      if (publicRange && hiddenRange) {
        next.start = allFiles[Math.min(publicRange[0], hiddenRange[0])]
        next.end = allFiles[Math.max(publicRange[1], hiddenRange[1])]
      }
      return next
    })
  const hiddenPages = retainedHiddenPages
    .map((page) => {
      const next = { ...page }
      delete next.privacyMasks
      return next
    })
    .sort((left, right) => Number(String(left.page).slice(1)) - Number(String(right.page).slice(1)))
  pages = [...publicPages, ...hiddenPages]
  await fs.writeFile(pagesPath, `${JSON.stringify(pages, null, 4)}\n`)

  for (const file of (await fs.readdir(messageRoot)).filter((item) => /^\d{2}\.json$/u.test(item))) {
    const messagePath = path.join(messageRoot, file)
    const message = JSON.parse(await fs.readFile(messagePath, 'utf8'))
    delete message.hidden
    message.page = file.replace(/\.json$/u, '')
    await fs.writeFile(messagePath, `${JSON.stringify(message, null, 4)}\n`)
  }
  for (const file of (await fs.readdir(supplementRoot)).filter((item) => /^\d+-\d+\.json$/u.test(item))) {
    const supplementPath = path.join(supplementRoot, file)
    const supplement = JSON.parse(await fs.readFile(supplementPath, 'utf8'))
    delete supplement.hidden
    supplement.page = String(Number(file.split('-')[0]))
    await fs.writeFile(supplementPath, `${JSON.stringify(supplement, null, 4)}\n`)
  }
  await fs.rm(obsoleteMessageReviewPath, { force: true })
}

const errors = []
for (const [file, record] of sourceRecords) {
  if ((record.hidden === true) !== reviewed.has(file)) {
    errors.push(`hidden 状态与普通记录复核清单不一致：${file}`)
  }
}

const publicPages = new Map(
  pages.filter((page) => page.hidden !== true).map((page) => [String(page.page), page]),
)
const hiddenPages = pages.filter((page) => page.hidden === true)
for (const page of pages) {
  if ('privacyMasks' in page) errors.push(`仍存在已废弃的遮罩坐标：${page.page}`)
}
for (const hiddenPage of hiddenPages) {
  const sourcePage = String(hiddenPage.sourceImage || '').trim()
  if (!/^H\d+$/u.test(String(hiddenPage.page))) errors.push(`隐藏页编号不是 Hxx：${hiddenPage.page}`)
  if (!publicPages.has(sourcePage)) errors.push(`Hxx 页缺少对应普通页：${hiddenPage.page}`)
  if (!rangeFiles(hiddenPage).some((file) => reviewed.has(file))) {
    errors.push(`Hxx 页没有任何普通隐藏记录：${hiddenPage.page}`)
  }
  const sourceImage = path.join(root, 'private-assets/record-pages', `${sourcePage}.jpeg`)
  try {
    await fs.access(sourceImage)
  } catch {
    errors.push(`Hxx 页的无损源扫描不存在：${sourceImage}`)
  }
}
for (const file of reviewed) {
  if (digitalOnlyHiddenRecords.has(file)) continue
  if (!hiddenPages.some((page) => rangeFiles(page).includes(file))) {
    errors.push(`隐藏记录没有对应 Hxx 扫描页：${file}`)
  }
}
for (const file of digitalOnlyHiddenRecords) {
  if (!reviewed.has(file)) errors.push(`无扫描隐藏记录未纳入复核清单：${file}`)
}

for (const file of (await fs.readdir(messageRoot)).filter((item) => /^\d{2}\.json$/u.test(item))) {
  const message = JSON.parse(await fs.readFile(path.join(messageRoot, file), 'utf8'))
  if (message.hidden === true || /^H\d+$/u.test(String(message.page || ''))) {
    errors.push(`箴言不得进入隐藏分区：${file}`)
  }
}
for (const file of (await fs.readdir(supplementRoot)).filter((item) => /^\d+-\d+\.json$/u.test(item))) {
  const supplement = JSON.parse(await fs.readFile(path.join(supplementRoot, file), 'utf8'))
  if (supplement.hidden === true || /^H\d+$/u.test(String(supplement.page || ''))) {
    errors.push(`补充记录不得进入隐藏分区：${file}`)
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR ${error}`))
  process.exitCode = 1
} else {
  console.log(
    `Privacy audit passed: ${reviewed.size} ordinary hidden records, ${hiddenPages.length} protected Hxx scan pages, ${digitalOnlyHiddenRecords.size} digital-only hidden record, and no privacy masks.`,
  )
}
