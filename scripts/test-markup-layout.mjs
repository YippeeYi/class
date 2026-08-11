import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

import { chromium } from 'playwright'
import { createServer } from 'vite'

import { frontend } from './test-react-helpers.mjs'

const harness = String.raw`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><script src="/theme-bootstrap.js"></script></head>
  <body>
    <main id="root"></main>
    <script type="module">
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { MemoryRouter, useLocation, useNavigate } from 'react-router'
      import { MarkupContent, QuizMarkupContent } from '/src/components/archive/markup-content.tsx'
      import { TooltipProvider } from '/src/components/ui/tooltip.tsx'
      import { DailyDistributionCell } from '/src/pages/timeline-page.tsx'
      import { BackgroundsPage } from '/src/pages/backgrounds-page.tsx'
      import { HomePage } from '/src/pages/home-page.tsx'
      import { PeoplePage } from '/src/pages/people-page.tsx'
      import { BackgroundRoot } from '/src/components/layout/background-root.tsx'
      import { Badge } from '/src/components/ui/badge.tsx'
      import { Button } from '/src/components/ui/button.tsx'
      import { Input } from '/src/components/ui/input.tsx'
      import { ArchiveProvider } from '/src/features/archive/archive-context.tsx'
      import { rememberImageDimensions } from '/src/services/image-metadata.ts'
      import '/src/styles/tailwind.css'

      const e = React.createElement
      const extremeSixColumns = '[[table:2x6|超长中文内容需要在窄屏内自然换行并保持全部可见|SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS|1234567890123456789012345678901234567890|https://example.invalid/a/very/long/path/without/a/natural/break|[[red:混合标记]][[frac:长分子文本|denominator-without-breaks]]|短|甲|B|3|[[under:嵌套标记]]|普通内容|末列]]'
      const manyColumns = '[[table:3x12|一|two|333333333333333333333333|四列较长中文文本用于测试换行|five-with-an-extremely-long-token|6|七|https://example.invalid/really/long/url|[[red:九]]|10|十一|12|第二行中文超长内容在很多列时仍然需要完整显示|b|c|d|e|f|g|h|i|j|k|l|甲|乙|丙|丁|戊|己|庚|辛|壬|癸|子|丑]]'
      const stackContent = '正文甲 [[frac:中英文Mixed numerator 123|较长的中文分母文本]] 正文乙 [[arrow:reaction condition 温度 120°C|催化剂与补充条件]] 正文丙'
      const annotationContent = '[[anno:短注|短注触发]]　[[anno:这是一段会自动限制最大宽度并自然换行的长注释，包含 [[person:p01|人物标记]]、[[frac:分子文字|denominator]] 和连续英文 SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS。|长注触发]]'
      const annotationEdgeContent = '[[anno:靠近视口边缘时仍需保持完整可见的注释内容。|边缘注释]]'
      const illustrationContent = '插图位置测试：[[illu:position-test.png|从这里查看插图]]。'
      const illustrationEdgeContent = '[[illu:position-edge.png|边界插图测试]]'

      const access = { type: 'invite', token: 'layout-test-token', authorizedAt: 'layout-test' }
      localStorage.setItem('classRecord:inviteAccess', JSON.stringify(access))
      const cachePrefix = 'classRecord:dataCache:v5:access-layout-test:'
      const cacheEntry = (data) => JSON.stringify({ time: Date.now(), data })
      const today = new Date()
      const todayDate = String(today.getFullYear()) + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
      sessionStorage.setItem(cachePrefix + 'records:false', cacheEntry([
        { id: 'r1', fileName: 'r1', date: todayDate, content: '今天的记录 [[quote:q1|一句话]]' },
        { id: 'r2', fileName: 'r2', date: '2025-02-03', content: '第二条记录' },
        { id: 'r3', fileName: 'r3', date: '2026-05-06', content: '第三条记录' },
      ]))
      sessionStorage.setItem(cachePrefix + 'people', cacheEntry([
        { id: 'p1', name: '人物一', role: 'student' },
        { id: 'p2', name: '人物二', role: 'student' },
        { id: 'a-teacher', name: '普通老师', role: 'teacher', subject: '数学', main: false },
        { id: 'z-teacher', name: '重点老师', role: 'teacher', subject: '语文', main: true },
      ]))
      sessionStorage.setItem(cachePrefix + 'quotes', cacheEntry([
        { id: 'q1', quote: '一句话', content: '一句话', recordFile: 'r1', sourceDate: todayDate },
      ]))

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

      function QuizThemeFixture({ type }) {
        return e('article', {
          className: 'quiz-question-card',
          'data-question-type': type,
          'data-quiz-theme-fixture': type,
          style: { display: 'grid', gap: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', color: 'var(--card-foreground)', padding: '16px' },
        },
          e('header', { className: 'quiz-question-header', style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' } },
            e('span', { className: 'quiz-question-type-icon', style: { display: 'grid', width: '32px', height: '32px', placeItems: 'center', borderRadius: '8px' } }, 'Q'),
            e(Badge, { className: 'quiz-question-type-badge', variant: 'outline' }, type),
          ),
          e('h2', { className: 'quiz-question-prompt' }, '题干与主要说明文字'),
          e('blockquote', { className: 'quiz-question-source' },
            '题目记录正文 ',
            e('span', { className: 'quiz-answer-blank is-revealed' }, e('span', { className: 'quiz-answer-blank-text' }, '答案')),
            e('span', { className: 'quiz-judge-correction' },
              e('span', { className: 'quiz-judge-wrong' }, '错误'),
              e('span', { className: 'quiz-judge-answer' }, '正确'),
            ),
          ),
          e('div', { className: 'quiz-question-side' },
            e('span', { className: 'quiz-question-side-label' }, '记录人'),
            e('span', { className: 'quiz-question-side-value' }, '人物名称'),
          ),
          e(Input, { 'aria-label': type + ' 填空输入', defaultValue: '已填写内容', disabled: true, className: 'disabled:opacity-75' }),
          e('div', { style: { display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' } },
            e(Button, { className: 'quiz-option disabled:opacity-100', variant: 'outline', disabled: true },
              e('span', { className: 'quiz-option-label' }, 'A'), e('span', null, '禁用选项')),
            e(Button, { className: 'quiz-option is-correct disabled:opacity-100', variant: 'outline', disabled: true },
              e('span', { className: 'quiz-option-label' }, 'B'), e('span', null, '正确选项')),
            e(Button, { className: 'quiz-option is-wrong disabled:opacity-100', variant: 'outline', disabled: true },
              e('span', { className: 'quiz-option-label' }, 'C'), e('span', null, '错误选项')),
          ),
          e('div', { className: 'quiz-result-correct' }, '回答正确与解释内容'),
          e('div', { className: 'quiz-result-wrong' }, '回答错误与正确答案'),
        )
      }

      function QuizIdentityBlankFixture() {
        const [revealed, setRevealed] = React.useState(false)
        const content = '[[person:p1|乙]]，普通文字乙；句中[[under:[[person:p1|乙]]]]与[[person:p1|小乙]]、[[person:p2|乙]]。\n句尾[[person:p1|乙]]'
        return e('section', {
          'data-quiz-identity-blank-fixture': '',
          style: { display: 'grid', gap: '8px', width: '36rem', maxWidth: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
        },
          e(Button, { type: 'button', size: 'sm', style: { width: 'max-content' }, onClick: () => setRevealed((value) => !value) }, revealed ? '隐藏答案' : '显示答案'),
          e('div', { 'data-quiz-blank-body': '', style: { fontSize: '16px', lineHeight: '1.75' } },
            e(QuizMarkupContent, {
              content,
              blankReference: { kind: 'person', id: 'p1', label: '乙' },
              revealed,
            }),
          ),
        )
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
          e(BackgroundRoot, null,
            e(React.Fragment, null,
              e(LocationProbe),
              e(TooltipProvider, { delay: 0 },
                e('div', { style: { width: '100%', maxWidth: '1120px', margin: '0 auto', padding: '12px' } },
                e(Case, { id: 'small', width: '52rem', content: '[[table:2x2|短|较长内容|甲|乙]]' }),
                e(Case, { id: 'six', width: '52rem', content: extremeSixColumns }),
                e(Case, { id: 'many', width: '52rem', content: manyColumns }),
                e(Case, { id: 'stack', width: '52rem', content: stackContent }),
                e(Case, { id: 'annotation', width: '52rem', content: annotationContent }),
                e(Case, { id: 'annotation-edge', width: '52rem', content: annotationEdgeContent, align: 'right' }),
                e(Case, { id: 'illustration', width: '52rem', content: illustrationContent }),
                e(Case, { id: 'illustration-edge', width: '52rem', content: illustrationEdgeContent, align: 'right' }),
                e(DailyGrid, { id: 'narrow', width: '18rem', columns: 4 }),
                e(DailyGrid, { id: 'medium', width: '38rem', columns: 7 }),
                e(DailyGrid, { id: 'wide', width: '52rem', columns: 10 }),
                e('section', { 'data-case': 'backgrounds', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(BackgroundsPage)),
                e('section', { 'data-case': 'quiz-theme', style: { display: 'grid', width: '68rem', maxWidth: '100%', gap: '12px', margin: '24px auto' } },
                  e(QuizThemeFixture, { type: 'choice' }),
                  e(QuizThemeFixture, { type: 'fill' }),
                  e(QuizThemeFixture, { type: 'judge' }),
                ),
                e(QuizIdentityBlankFixture),
                e('section', { 'data-case': 'app-surface', className: 'app-main-surface bg-background', style: { width: '68rem', maxWidth: '100%', minHeight: '220px', margin: '24px auto', padding: '20px' } },
                  e('header', { className: 'app-topbar rounded-xl border p-4' }, '全局背景表面'),
                  e('aside', { className: 'app-sidebar mt-4 w-48' },
                    e('div', { 'data-slot': 'sidebar-inner', className: 'rounded-xl bg-sidebar p-4' }, '侧栏磨砂层'),
                  ),
                  e('div', { 'data-slot': 'card', className: 'mt-4 rounded-xl bg-card p-4' }, '内容卡片'),
                ),
                e(ArchiveProvider, null,
                  e('section', { 'data-case': 'guide', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(HomePage)),
                  e('section', { 'data-case': 'people', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(PeoplePage)),
                ),
                ),
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
  const consoleProblems = []
  let expectedHarnessNetworkFailures = 0
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (/^Failed to load resource: the server responded with a status of 400/u.test(message.text())) {
      expectedHarnessNetworkFailures += 1
      return
    }
    if (message.type() === 'error' || message.type() === 'warning')
      consoleProblems.push(`${message.type()}: ${message.text()}`)
  })
  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__markupLayoutReady === true)
  assert.deepEqual(pageErrors, [], `browser page errors during initial render: ${pageErrors.join('; ')}`)

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
  assert.equal(await themeOptions.count(), 8, 'automatic plus seven designed light/dark theme presets must remain available')
  const themeModeGroups = page.locator('[data-theme-mode-group]')
  assert.equal(await themeModeGroups.count(), 3, 'automatic, light, and dark choices must have separate visual groups')
  assert.equal(await page.locator('[data-theme-mode="light"]').count(), 4, 'four distinct light themes must remain available')
  assert.equal(await page.locator('[data-theme-mode="dark"]').count(), 3, 'three distinct dark themes must remain available')
  const autoThemeControl = page.locator('[data-theme-preset-option="auto"]')
  const autoThemeGeometry = await autoThemeControl.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
    slot: element.getAttribute('data-slot'),
    pressed: element.getAttribute('aria-pressed'),
    hasPreview: Boolean(element.querySelector('[data-theme-preview]')),
  }))
  assert.equal(autoThemeGeometry.slot, 'button', 'automatic palette must use the shared shadcn Button')
  assert.ok(autoThemeGeometry.height <= 36, `automatic palette control must stay compact: ${JSON.stringify(autoThemeGeometry)}`)
  assert.equal(autoThemeGeometry.hasPreview, false, 'automatic palette must not render a full preview card')
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
  assert.equal(themePreviewColors.length, 7, 'all designed light/dark themes need compact previews')
  assert.equal(new Set(themePreviewColors.map((item) => `${item.background}|${item.accent}`)).size, 7, 'every designed theme preset needs a distinct visible preview')
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
    const darkIds = new Set(['ink', 'midnight', 'pine'])
    const parseOklch = (value) => {
      const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
      if (!match) return null
      const lightness = Number(match[1])
      const chroma = Number(match[2])
      const hue = Number(match[3]) * Math.PI / 180
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
    const ratio = (first, second) => {
      const a = parseOklch(first)
      const b = parseOklch(second)
      if (a === null || b === null) return 0
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    const output = ids.map((id) => {
      root.dataset.themePreset = id
      root.classList.toggle('dark', darkIds.has(id))
      const styles = getComputedStyle(root)
      const quiz = [...document.querySelectorAll('[data-quiz-theme-fixture]')].map((card) => {
        const cardStyles = getComputedStyle(card)
        return {
          type: card.getAttribute('data-question-type'),
          typeText: ratio(cardStyles.getPropertyValue('--quiz-type-surface'), cardStyles.getPropertyValue('--quiz-type-ink')),
          success: ratio(cardStyles.getPropertyValue('--quiz-success-surface'), cardStyles.getPropertyValue('--quiz-success-foreground')),
          successEmphasis: ratio(cardStyles.getPropertyValue('--quiz-success-emphasis'), cardStyles.getPropertyValue('--quiz-success-emphasis-foreground')),
          error: ratio(cardStyles.getPropertyValue('--quiz-error-surface'), cardStyles.getPropertyValue('--quiz-error-foreground')),
          errorEmphasis: ratio(cardStyles.getPropertyValue('--quiz-error-emphasis'), cardStyles.getPropertyValue('--quiz-error-emphasis-foreground')),
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
  }, ['auto', 'paper', 'mist', 'apricot', 'sage', 'ink', 'midnight', 'pine'])
  themeContrasts.forEach((theme) => {
    assert.ok(theme.page >= 7, `${theme.id} page text contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.card >= 7, `${theme.id} card text contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.primary >= 4.5, `${theme.id} primary control contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.muted >= 4.5, `${theme.id} muted text contrast is too low: ${JSON.stringify(theme)}`)
    theme.quiz.forEach((sample) => {
      for (const [state, contrast] of Object.entries(sample).filter(([key]) => key !== 'type')) {
        assert.ok(contrast >= 4.5, `${theme.id} ${sample.type} quiz ${state} contrast is too low: ${JSON.stringify(sample)}`)
      }
    })
  })
  await page.locator('[data-theme-preset-option="pine"]').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')?.theme === 'pine')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__markupLayoutReady === true)
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'pine' && document.documentElement.classList.contains('dark'))
  assert.equal(await page.locator('[data-theme-preset-option="pine"]').getAttribute('data-selected'), 'true', 'the selected dark preset must survive a full bootstrap and React remount')
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && document.documentElement.dataset.themePreset === 'auto')

  const backgroundCards = page.locator('[data-background-id]')
  assert.equal(await backgroundCards.count(), 3, 'all baseline background choices must remain available')
  await backgroundCards.last().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-background-id] img')].every((image) => image.naturalWidth > 0))
  const backgroundGeometry = await backgroundCards.evaluateAll((cards) =>
    cards.map((card) => {
      const preview = card.querySelector('[data-slot="aspect-ratio"]')
      const strip = card.querySelector('[data-background-swatch]')
      const glass = card.querySelector('.backdrop-blur-md')
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
        backdrop: glass ? getComputedStyle(glass).backdropFilter : '',
      }
    }),
  )
  backgroundGeometry.forEach((card) => {
    assert.ok(Math.abs(card.ratio - 4 / 3) <= 0.02, `background ${card.id} must keep a stable 4:3 preview: ${JSON.stringify(card)}`)
    assert.notEqual(card.strip, 'none', `background ${card.id} needs a representative theme strip`)
    assert.ok(card.stripIntegrated && card.stripWidthRatio < 0.3, `background ${card.id} swatch must remain a secondary part of its metadata`)
    assert.notEqual(card.backdrop, 'none', `background ${card.id} metadata needs a readable glass surface`)
  })
  assert.equal(new Set(backgroundGeometry.map((card) => card.strip)).size, 3, 'background theme strips must reflect distinct source palettes')
  await page.locator('[data-background-id="default"] [data-slot="radio-group-item"]').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('[data-background-id="mountain"]')?.getAttribute('data-selected') === 'true')
  await page.locator('[data-background-id="cloud"]').click()
  await page.waitForFunction(() => localStorage.getItem('classRecord:background') === 'cloud')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')?.background === 'cloud')
  await page.waitForFunction(() => document.querySelector('[data-background-visible="cloud"]'))
  const surfaceGeometry = await page.locator('[data-case="app-surface"]').evaluate((surface) => {
    const layers = document.querySelectorAll('[data-background-visible="cloud"] > .background-layer')
    const layer = layers[layers.length - 1]
    const topbar = surface.querySelector('.app-topbar')
    const sidebar = surface.querySelector('[data-slot="sidebar-inner"]')
    const card = surface.querySelector('[data-slot="card"]')
    return {
      layerImage: layer ? getComputedStyle(layer).backgroundImage : '',
      surfaceImage: getComputedStyle(surface).backgroundImage,
      surfaceColor: getComputedStyle(surface).backgroundColor,
      topbarBackdrop: topbar ? getComputedStyle(topbar).backdropFilter : '',
      sidebarBackdrop: sidebar ? getComputedStyle(sidebar).backdropFilter : '',
      cardColor: card ? getComputedStyle(card).backgroundColor : '',
    }
  })
  assert.match(surfaceGeometry.layerImage, /cloud\.webp/, 'the selected background must remain mounted behind the formal application surface')
  assert.notEqual(surfaceGeometry.surfaceImage, 'none', 'the application surface needs a translucent readability gradient')
  assert.match(surfaceGeometry.surfaceColor, /(?:\/ 0\)|, 0\))$/, `the application surface must not keep an opaque shadcn background: ${JSON.stringify(surfaceGeometry)}`)
  assert.notEqual(surfaceGeometry.topbarBackdrop, 'none', 'the top bar must keep a bounded glass treatment')
  assert.notEqual(surfaceGeometry.sidebarBackdrop, 'none', 'the sidebar must keep a bounded glass treatment')

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
  assert.equal(await guide.getByRole('link', { name: /记录/ }).count() > 0, true, 'guide must expose the primary records entry')
  assert.equal(await guide.getByRole('link', { name: /致谢/ }).count(), 1, 'guide must restore the baseline credits entry')
  assert.equal(await guide.getByRole('button', { name: /历史上的今天/ }).count(), 1, 'guide must retain the date-matched history entry')
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
  const shortWidth = await annotationPopup.evaluate((element) => element.getBoundingClientRect().width)
  const annotationExitOrigin = await annotationPopup.evaluate((element) => {
    const bounds = element.parentElement?.getBoundingClientRect()
    return { left: bounds?.left || 0, top: bounds?.top || 0 }
  })
  await annotationPopup.evaluate((element) => {
    const samples = []
    window.__annotationExitSamples = samples
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
  await annotationPopup.waitFor({ state: 'hidden' })
  const annotationExitSamples = await page.evaluate(() => window.__annotationExitSamples || [])
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
  await illustrationPopup.waitFor({ state: 'visible' })
  const firstPopup = await illustrationPopup.boundingBox()
  assert.ok(firstPopup)
  assert.ok(Math.abs(firstPopup.x + firstPopup.width / 2 - initialPointerX) <= 2, 'illustration popup must initially center on pointer clientX')
  await page.mouse.move(triggerBox.x + triggerBox.width - 3, triggerBox.y + triggerBox.height / 2)
  await page.waitForTimeout(80)
  const movedPopup = await illustrationPopup.boundingBox()
  assert.ok(movedPopup)
  assert.ok(Math.abs(movedPopup.x - firstPopup.x) <= 1, 'an open illustration popup must not follow later pointer movement')
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

  assert.deepEqual(pageErrors, [], `browser page errors during interaction regression: ${pageErrors.join('; ')}`)
  assert.deepEqual(consoleProblems, [], `browser console warnings/errors: ${consoleProblems.join('; ')}`)
  assert.ok(
    expectedHarnessNetworkFailures <= 2,
    `the credential-free illustration harness made unexpected failing requests: ${expectedHarnessNetworkFailures}`,
  )

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
