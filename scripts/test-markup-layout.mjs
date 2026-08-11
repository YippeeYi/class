import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

import { chromium } from 'playwright'
import { createServer } from 'vite'

import { frontend } from './test-react-helpers.mjs'

const harness = String.raw`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body>
    <main id="root"></main>
    <script type="module">
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { MemoryRouter, useLocation, useNavigate } from 'react-router'
      import { MarkupContent } from '/src/components/archive/markup-content.tsx'
      import { TooltipProvider } from '/src/components/ui/tooltip.tsx'
      import { DailyDistributionCell } from '/src/pages/timeline-page.tsx'
      import { rememberImageDimensions } from '/src/services/image-metadata.ts'
      import '/src/styles/tailwind.css'

      const e = React.createElement
      const extremeSixColumns = '[[table:2x6|超长中文内容需要在窄屏内自然换行并保持全部可见|SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS|1234567890123456789012345678901234567890|https://example.invalid/a/very/long/path/without/a/natural/break|[[red:混合标记]][[frac:长分子文本|denominator-without-breaks]]|短|甲|B|3|[[under:嵌套标记]]|普通内容|末列]]'
      const manyColumns = '[[table:3x12|一|two|333333333333333333333333|四列较长中文文本用于测试换行|five-with-an-extremely-long-token|6|七|https://example.invalid/really/long/url|[[red:九]]|10|十一|12|第二行中文超长内容在很多列时仍然需要完整显示|b|c|d|e|f|g|h|i|j|k|l|甲|乙|丙|丁|戊|己|庚|辛|壬|癸|子|丑]]'
      const stackContent = '正文甲 [[frac:中英文Mixed numerator 123|较长的中文分母文本]] 正文乙 [[arrow:reaction condition 温度 120°C|催化剂与补充条件]] 正文丙'
      const annotationContent = '[[anno:短注|短注触发]]　[[anno:这是一段会自动限制最大宽度并自然换行的长注释，包含 [[person:p01|人物标记]]、[[frac:分子文字|denominator]] 和连续英文 SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS。|长注触发]]'
      const illustrationContent = '插图位置测试：[[illu:position-test.png|从这里查看插图]]。'
      const illustrationEdgeContent = '[[illu:position-edge.png|边界插图测试]]'

      rememberImageDimensions('data/attachments/position-test.png', { width: 320, height: 200 })
      rememberImageDimensions('data/attachments/position-edge.png', { width: 360, height: 240 })

      function Case({ id, width, content, align = 'left' }) {
        return e('section', {
          'data-case': id,
          style: { width, maxWidth: '100%', margin: '16px auto', padding: '12px', border: '1px solid #ccc', textAlign: align },
        }, e(MarkupContent, { content }))
      }

      const dailyItems = [
        { day: '01', records: [], value: 0, important: 0, authors: [] },
        { day: '08', records: [{}], value: 7, important: 0, authors: [['p1', 7]] },
        { day: '18', records: [{}, {}], value: 42, important: 12, authors: [['p1', 30], ['p2', 12]] },
        { day: '28', records: [{}, {}, {}], value: 9876543, important: 2345678, authors: [['p1', 5000000], ['p2', 4876543]] },
      ]
      const dailyColors = new Map([['p1', '#3978d4'], ['p2', '#e56b36']])

      function DailyGrid({ id, width, columns }) {
        return e('section', {
          'data-daily-grid': id,
          style: { display: 'grid', width, maxWidth: '100%', gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))', gap: '6px', margin: '16px auto' },
        }, dailyItems.map((item) => e(DailyDistributionCell, {
          key: item.day,
          item,
          year: '2026',
          month: '08',
          unit: '字',
          colors: dailyColors,
          activeAuthor: null,
        })))
      }

      function LocationProbe() {
        const location = useLocation()
        const navigate = useNavigate()
        React.useEffect(() => {
          window.__memoryLocation = location.pathname + location.search + location.hash
          window.__memoryNavigate = navigate
        }, [location, navigate])
        return null
      }

      function App() {
        return e(MemoryRouter, null,
          e(React.Fragment, null,
            e(LocationProbe),
            e(TooltipProvider, { delay: 0 },
              e('div', { style: { width: '100%', maxWidth: '1120px', margin: '0 auto', padding: '12px' } },
                e(Case, { id: 'small', width: '52rem', content: '[[table:2x2|短|较长内容|甲|乙]]' }),
                e(Case, { id: 'six', width: '52rem', content: extremeSixColumns }),
                e(Case, { id: 'many', width: '52rem', content: manyColumns }),
                e(Case, { id: 'stack', width: '52rem', content: stackContent }),
                e(Case, { id: 'annotation', width: '52rem', content: annotationContent }),
                e(Case, { id: 'illustration', width: '52rem', content: illustrationContent }),
                e(Case, { id: 'illustration-edge', width: '52rem', content: illustrationEdgeContent, align: 'right' }),
                e(DailyGrid, { id: 'narrow', width: '18rem', columns: 4 }),
                e(DailyGrid, { id: 'medium', width: '38rem', columns: 7 }),
                e(DailyGrid, { id: 'wide', width: '52rem', columns: 10 }),
              ),
            ),
          ),
        )
      }

      createRoot(document.getElementById('root')).render(e(App))
      requestAnimationFrame(() => { window.__markupLayoutReady = true })
    </script>
  </body>
</html>`

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
      const html = await vite.transformIndexHtml('/', harness)
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
const edgePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
const systemEdge = await access(edgePath).then(
  () => edgePath,
  () => undefined,
)
const browser = await chromium.launch({ headless: true, executablePath: systemEdge })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__markupLayoutReady === true)

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

  const dailyCells = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-distribution-cell')].map((cell) => {
      const bounds = cell.getBoundingClientRect()
      const date = cell.querySelector('.daily-distribution-date')?.getBoundingClientRect()
      const unit = cell.querySelector('.daily-distribution-unit')?.getBoundingClientRect()
      const pie = cell.querySelector('.daily-distribution-pie')?.getBoundingClientRect()
      const main = cell.children[1]?.getBoundingClientRect()
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
        squareDelta: Math.abs(bounds.width - bounds.height),
        childrenInside,
        grid: cell.closest('[data-daily-grid]')?.getAttribute('data-daily-grid'),
        pieWidth: pie?.width || 0,
        pieHeight: pie?.height || 0,
        mainHeight: main?.height || 0,
        bounds: { width: bounds.width, height: bounds.height, top: bounds.top, bottom: bounds.bottom },
        children: [...cell.children].map((child) => {
          const childBounds = child.getBoundingClientRect()
          return { top: childBounds.top, bottom: childBounds.bottom, height: childBounds.height, text: child.textContent }
        }),
        topOverlap: date && unit ? Math.max(0, date.right - unit.left) : 0,
      }
    }),
  )
  assert.equal(dailyCells.length, 12)
  dailyCells.forEach((cell, index) => {
    assert.ok(
      cell.overflowX <= 1 && cell.overflowY <= 1,
      `daily cell ${index + 1} overflowed: ${JSON.stringify(cell)}`,
    )
    assert.ok(cell.squareDelta <= 1, `daily cell ${index + 1} must retain a stable square frame`)
    assert.equal(cell.childrenInside, true, `daily cell ${index + 1} content must remain inside its frame`)
    assert.ok(cell.topOverlap <= 0.5, `daily cell ${index + 1} date and metric unit must not overlap`)
    assert.ok(cell.pieWidth >= 24 && Math.abs(cell.pieWidth - cell.pieHeight) <= 0.5, `daily cell ${index + 1} pie must remain prominent and circular: ${JSON.stringify(cell)}`)
    assert.ok(cell.pieWidth / cell.bounds.width >= 0.34, `daily cell ${index + 1} pie must use a meaningful share of the card`)
    assert.ok(cell.mainHeight / cell.bounds.height >= 0.58, `daily cell ${index + 1} main visualization row must not leave excessive blank space`)
  })
  const largeDailyValue = page.locator('.daily-distribution-value[title="9,876,543 字"]').first()
  await largeDailyValue.waitFor({ state: 'visible' })
  assert.notEqual(await largeDailyValue.textContent(), '9,876,543', 'large daily values must use compact visible notation')
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
  await shortTrigger.hover()
  const annotationPopup = page.locator('.record-annotation-popup[data-open]')
  await annotationPopup.waitFor({ state: 'visible' })
  const shortWidth = await annotationPopup.evaluate((element) => element.getBoundingClientRect().width)
  await page.mouse.move(4, 4)
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
  await longTrigger.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.matches('a.person-link'))
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__memoryLocation === '/person?id=p01')

  await page.setViewportSize({ width: 320, height: 1000 })
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

  const illustration = page.getByRole('button', { name: '从这里查看插图' })
  const triggerBox = await illustration.boundingBox()
  assert.ok(triggerBox)
  const initialPointerX = triggerBox.x + Math.min(12, triggerBox.width / 3)
  await page.mouse.move(initialPointerX, triggerBox.y + triggerBox.height / 2)
  const illustrationPopup = page.locator('.record-illustration-popup[data-open]')
  await illustrationPopup.waitFor({ state: 'visible' })
  const firstPopup = await illustrationPopup.boundingBox()
  assert.ok(firstPopup)
  assert.ok(Math.abs(firstPopup.x + firstPopup.width / 2 - initialPointerX) <= 2, 'illustration popup must initially center on pointer clientX')
  await page.mouse.move(triggerBox.x + triggerBox.width - 3, triggerBox.y + triggerBox.height / 2)
  await page.waitForTimeout(80)
  const movedPopup = await illustrationPopup.boundingBox()
  assert.ok(movedPopup)
  assert.ok(Math.abs(movedPopup.x - firstPopup.x) <= 1, 'an open illustration popup must not follow later pointer movement')

  const edgeIllustration = page.getByRole('button', { name: '边界插图测试' })
  const edgeTriggerBox = await edgeIllustration.boundingBox()
  assert.ok(edgeTriggerBox)
  await page.mouse.move(edgeTriggerBox.x + edgeTriggerBox.width - 2, edgeTriggerBox.y + edgeTriggerBox.height / 2)
  await illustrationPopup.waitFor({ state: 'visible' })
  await page.waitForTimeout(50)
  const edgePopup = await illustrationPopup.boundingBox()
  assert.ok(edgePopup)
  assert.ok(edgePopup.x >= 4 && edgePopup.x + edgePopup.width <= 1276, 'viewport collision handling must keep edge-anchored illustration popups fully visible')

  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const touchErrors = []
  touchPage.on('pageerror', (error) => touchErrors.push(error.message))
  await touchPage.goto(origin, { waitUntil: 'networkidle' })
  await touchPage.waitForFunction(() => window.__markupLayoutReady === true)
  await touchPage.getByRole('button', { name: '长注触发' }).tap()
  const touchAnnotation = touchPage.locator('.record-annotation-popup[data-open]')
  await touchAnnotation.waitFor({ state: 'visible' })
  const touchPerson = touchAnnotation.locator('a.person-link', { hasText: '人物标记' })
  await touchPerson.tap()
  await touchPage.waitForFunction(() => window.__memoryLocation === '/person?id=p01')
  assert.deepEqual(touchErrors, [], `touch browser page errors: ${touchErrors.join('; ')}`)
  await touchPage.close()

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`)
} finally {
  await browser.close()
  await vite.close()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

console.log('Record markup browser layout checks passed at 1280, 768, 390 and 320 CSS pixels.')
