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
      import { ImageViewer } from '/src/components/archive/image-viewer.tsx'
      import { TooltipProvider } from '/src/components/ui/tooltip.tsx'
      import { DailyDistributionCell } from '/src/pages/timeline-page.tsx'
      import { BackgroundsPage } from '/src/pages/backgrounds-page.tsx'
      import { HomePage } from '/src/pages/home-page.tsx'
      import { PeoplePage } from '/src/pages/people-page.tsx'
      import { RecordsPage } from '/src/pages/records-page.tsx'
      import { BackgroundRoot } from '/src/components/layout/background-root.tsx'
      import { Badge } from '/src/components/ui/badge.tsx'
      import { Button } from '/src/components/ui/button.tsx'
      import { Input } from '/src/components/ui/input.tsx'
      import { ScrollArea } from '/src/components/ui/scroll-area.tsx'
      import { ArchiveProvider } from '/src/features/archive/archive-context.tsx'
      import { rememberImageDimensions } from '/src/services/image-metadata.ts'
      import { installRecordJumpGuard } from '/src/lib/record-navigation.ts'
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
      const recordFixture = (id, recordIndex, date, content) => ({
        id,
        fileName: id + '.json',
        recordIndex,
        date,
        time: '',
        author: '',
        recorder: '',
        content,
        text: content,
        importance: 'normal',
        attachments: [],
        hidden: false,
      })
      sessionStorage.setItem(cachePrefix + 'records:false', cacheEntry([
        recordFixture('r1', 1, todayDate, '今天的记录 [[quote:q1|一句话]]，继续查看 [[record:r2|第二条记录]]。'),
        recordFixture('r2', 2, '2025-02-03', '第二条记录'),
        recordFixture('r3', 3, '2026-05-06', '第三条记录 [[anno:定位后仍可稳定操作弹出内容。|跳转后注释]]，继续查看 [[record:r1|第一条记录]]。'),
      ]))
      sessionStorage.setItem(cachePrefix + 'record-pages:false', cacheEntry([
        { page: '1', startFile: 'r1.json', endFile: 'r2.json', imagePath: 'fixtures/page-1.webp', hidden: false },
        { page: '2', startFile: 'r3.json', endFile: 'r3.json', imagePath: 'fixtures/page-2.webp', hidden: false },
      ]))
      sessionStorage.setItem(cachePrefix + 'page-messages', cacheEntry([]))
      sessionStorage.setItem(cachePrefix + 'page-supplements:false', cacheEntry([]))
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
          className: 'content-frame quiz-question-card overflow-hidden rounded-xl border bg-card text-card-foreground',
          'data-slot': 'card',
          'data-question-type': type,
          'data-quiz-theme-fixture': type,
          style: { display: 'grid' },
        },
          e('header', { 'data-slot': 'card-header', className: 'quiz-question-header', style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' } },
            e('span', { className: 'quiz-question-type-icon', style: { display: 'grid', width: '32px', height: '32px', placeItems: 'center', borderRadius: '8px' } }, 'Q'),
            e(Badge, { className: 'quiz-question-type-badge', variant: 'outline' }, type),
          ),
          e('div', { 'data-slot': 'card-content', style: { display: 'grid', gap: '12px', padding: '16px' } },
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
            e('div', { style: { display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit,minmax(9rem,1fr))' } },
              e(Button, { 'data-quiz-option-state': 'default', className: 'quiz-option', variant: 'outline' },
                e('span', { className: 'quiz-option-label' }, 'A'), e('span', null, '默认选项')),
              e(Button, { 'data-quiz-option-state': 'selected', className: 'quiz-option', variant: 'outline', 'aria-pressed': true },
                e('span', { className: 'quiz-option-label' }, 'B'), e('span', null, '选中选项')),
              e(Button, { 'data-quiz-option-state': 'disabled', className: 'quiz-option disabled:opacity-100', variant: 'outline', disabled: true },
                e('span', { className: 'quiz-option-label' }, 'A'), e('span', null, '禁用选项')),
              e(Button, { 'data-quiz-option-state': 'correct', className: 'quiz-option is-correct disabled:opacity-100', variant: 'outline', disabled: true },
                e('span', { className: 'quiz-option-label' }, 'B'), e('span', null, '正确选项')),
              e(Button, { 'data-quiz-option-state': 'wrong', className: 'quiz-option is-wrong disabled:opacity-100', variant: 'outline', disabled: true },
                e('span', { className: 'quiz-option-label' }, 'C'), e('span', null, '错误选项')),
            ),
          ),
          e('footer', { 'data-slot': 'card-footer', style: { display: 'grid', gap: '8px', padding: '12px', background: 'color-mix(in oklch, var(--muted) 38%, transparent)' } },
            e('div', { className: 'quiz-result-correct' }, '回答正确与解释内容'),
            e('div', { className: 'quiz-result-wrong' }, '回答错误与正确答案'),
          ),
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

      function ImageViewerFixture() {
        const image = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221600%22 height=%221200%22 viewBox=%220 0 1600 1200%22%3E%3Crect width=%221600%22 height=%221200%22 fill=%22%23233a5b%22/%3E%3Ccircle cx=%22800%22 cy=%22600%22 r=%22320%22 fill=%22%237ac7c4%22/%3E%3C/svg%3E'
        return e('section', {
          'data-case': 'image-viewer',
          style: { width: '68rem', maxWidth: '100%', margin: '24px auto', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
        }, e(ImageViewer, {
          path: '',
          alt: '全视口测试图片',
          initialUrl: image,
          trigger: e(Button, { type: 'button', variant: 'outline' }, '打开全视口测试图片'),
        }))
      }

      function ScrollAreaFixture() {
        return e(ScrollArea, {
          'data-scroll-area-fixture': '',
          style: {
            width: '20rem',
            maxWidth: '100%',
            height: '11rem',
            margin: '24px auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
          },
        }, e('div', { style: { display: 'grid', gap: '8px', padding: '12px 24px 12px 12px' } },
          Array.from({ length: 24 }, (_, index) => e('p', { key: index }, '滚动边缘回归行 ' + (index + 1))),
        ))
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

      function RecordsRouteFixture() {
        const location = useLocation()
        if (location.pathname !== '/' && location.pathname !== '/records') return null
        return e('section', { 'data-case': 'records', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(RecordsPage))
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
                e(RecordsRouteFixture),
                e('section', { 'data-case': 'backgrounds', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(BackgroundsPage)),
                e('section', { 'data-case': 'quiz-theme', style: { display: 'grid', width: '68rem', maxWidth: '100%', gap: '12px', margin: '24px auto' } },
                  e(QuizThemeFixture, { type: 'choice' }),
                  e(QuizThemeFixture, { type: 'fill' }),
                  e(QuizThemeFixture, { type: 'judge' }),
                ),
                e(QuizIdentityBlankFixture),
                e(ScrollAreaFixture),
                e('section', { 'data-case': 'app-surface', className: 'app-main-surface bg-background', style: { width: '68rem', maxWidth: '100%', minHeight: '220px', margin: '24px auto', padding: '20px' } },
                  e('header', { className: 'app-topbar rounded-xl border p-4' }, '全局背景表面'),
                  e('aside', { className: 'app-sidebar mt-4 w-48' },
                    e('div', { 'data-slot': 'sidebar-inner', className: 'rounded-xl bg-sidebar p-4' }, '侧栏磨砂层'),
                  ),
                  e('div', { 'data-slot': 'card', className: 'mt-4 rounded-xl bg-card p-4' }, '内容卡片'),
                ),
                e(ImageViewerFixture),
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
      window.__installRecordJumpGuard = installRecordJumpGuard
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
if (process.env.CLASS_RECORD_LAYOUT_SERVER_ONLY === '1') {
  console.log(`CLASS_RECORD_LAYOUT_ORIGIN=${origin}`)
  await new Promise((resolve) => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  await vite.close()
  process.exit(0)
}
const edgePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
const systemEdge = await access(edgePath).then(
  () => edgePath,
  () => undefined,
)
const browser = await chromium.launch({ headless: true, executablePath: systemEdge })

async function assertFullscreenImageViewer(page, label) {
  const trigger = page.getByRole('button', { name: '打开全视口测试图片' })
  await trigger.scrollIntoViewIfNeeded()
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY)
  await trigger.click()
  const dialog = page.locator('.image-viewer-dialog[data-slot="image-viewer-content"]')
  await dialog.waitFor({ state: 'visible' })
  await dialog.locator('img[alt="全视口测试图片"]').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('img[alt="全视口测试图片"]')?.naturalWidth > 0)
  const geometry = await page.evaluate(() => {
    const content = document.querySelector('.image-viewer-dialog[data-slot="image-viewer-content"]')
    const overlay = document.querySelector('.image-viewer-overlay[data-slot="dialog-overlay"]')
    const image = document.querySelector('img[alt="全视口测试图片"]')
    const toolbar = content?.firstElementChild?.nextElementSibling
    const contentBounds = content?.getBoundingClientRect()
    const overlayBounds = overlay?.getBoundingClientRect()
    const imageBounds = image?.getBoundingClientRect()
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      viewportWidth,
      viewportHeight,
      content: contentBounds && {
        top: contentBounds.top,
        left: contentBounds.left,
        right: contentBounds.right,
        bottom: contentBounds.bottom,
        width: contentBounds.width,
        height: contentBounds.height,
      },
      overlay: overlayBounds && {
        top: overlayBounds.top,
        left: overlayBounds.left,
        right: overlayBounds.right,
        bottom: overlayBounds.bottom,
        backdrop: getComputedStyle(overlay).backdropFilter,
        background: getComputedStyle(overlay).backgroundColor,
      },
      image: imageBounds && {
        top: imageBounds.top,
        left: imageBounds.left,
        right: imageBounds.right,
        bottom: imageBounds.bottom,
      },
      position: content ? getComputedStyle(content).position : '',
      transform: content ? getComputedStyle(content).transform : '',
      translate: content ? getComputedStyle(content).translate : '',
      scale: content ? getComputedStyle(content).scale : '',
      portalParent: content?.parentElement?.getAttribute('data-slot') || '',
      containingBlockAncestors: content
        ? [...document.querySelectorAll('html, body, [data-slot="dialog-portal"]')]
            .filter((element) => element.contains(content) && element !== content)
            .map((element) => {
              const style = getComputedStyle(element)
              return {
                slot: element.getAttribute('data-slot') || element.tagName,
                transform: style.transform,
                filter: style.filter,
                perspective: style.perspective,
                contain: style.contain,
              }
            })
            .filter(
              (item) =>
                item.transform !== 'none' ||
                item.filter !== 'none' ||
                item.perspective !== 'none' ||
                /(?:layout|paint|strict|content)/u.test(item.contain),
            )
        : [],
      toolbarOverflow: toolbar
        ? toolbar.scrollWidth - toolbar.clientWidth
        : Number.POSITIVE_INFINITY,
      scrollY: window.scrollY,
    }
  })
  assert.equal(geometry.position, 'fixed', `${label} image viewer must be viewport-fixed`)
  assert.equal(geometry.transform, 'none', `${label} image viewer must not inherit centred-dialog translation`)
  assert.equal(geometry.translate, 'none', `${label} image viewer must clear Tailwind's individual translate property`)
  assert.equal(geometry.scale, 'none', `${label} image viewer must not shrink during a centred-dialog zoom animation`)
  assert.equal(geometry.portalParent, 'dialog-portal', `${label} image viewer must be a direct child of the dialog portal`)
  assert.deepEqual(
    geometry.containingBlockAncestors,
    [],
    `${label} image viewer must not have a transformed, filtered or contained viewport ancestor`,
  )
  assert.ok(
    geometry.content &&
      Math.abs(geometry.content.top) <= 1 &&
      Math.abs(geometry.content.left) <= 1 &&
      Math.abs(geometry.content.right - geometry.viewportWidth) <= 1 &&
      Math.abs(geometry.content.bottom - geometry.viewportHeight) <= 1,
    `${label} image viewer must cover the exact viewport: ${JSON.stringify(geometry)}`,
  )
  assert.notEqual(
    geometry.overlay?.backdrop,
    'none',
    `${label} image overlay must blur the actual page that remains beneath the portal`,
  )
  assert.match(
    geometry.overlay?.background || '',
    /rgba\([^)]*,\s*0\.(?:5[0-9]|6[0-9]|7[0-9])\)/,
    `${label} image overlay must stay translucent instead of replacing the current page`,
  )
  assert.ok(
    geometry.overlay &&
      Math.abs(geometry.overlay.top) <= 1 &&
      Math.abs(geometry.overlay.left) <= 1 &&
      Math.abs(geometry.overlay.right - geometry.viewportWidth) <= 1 &&
      Math.abs(geometry.overlay.bottom - geometry.viewportHeight) <= 1,
    `${label} image overlay must cover the exact viewport: ${JSON.stringify(geometry)}`,
  )
  assert.ok(
    geometry.image &&
      geometry.image.top >= -1 &&
      geometry.image.left >= -1 &&
      geometry.image.right <= geometry.viewportWidth + 1 &&
      geometry.image.bottom <= geometry.viewportHeight + 1,
    `${label} initial image must be fully visible: ${JSON.stringify(geometry)}`,
  )
  assert.ok(geometry.toolbarOverflow <= 1, `${label} image toolbar must not overflow: ${JSON.stringify(geometry)}`)
  assert.ok(
    Math.abs(geometry.scrollY - scrollBeforeOpen) <= 1,
    `${label} opening the viewer must not move the page: ${JSON.stringify({ scrollBeforeOpen, scrollAfterOpen: geometry.scrollY })}`,
  )
  await page.getByRole('button', { name: '关闭大图' }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.ok(
    Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeOpen) <= 1,
    `${label} closing the viewer must restore the unchanged page position`,
  )
}

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

  const recordsFixture = page.locator('[data-case="records"]')
  const sourceJump = recordsFixture.getByRole('button', {
    name: '在书面记录中查看#r3',
  })
  await sourceJump.scrollIntoViewIfNeeded()
  await sourceJump.hover()
  const sourceJumpBounds = await sourceJump.boundingBox()
  assert.ok(sourceJumpBounds, 'record source control must be visible before its real pointer click')
  await page.evaluate(() => {
    window.__recordNativeScrollTo = window.scrollTo.bind(window)
    window.__recordScrollCalls = []
    window.scrollTo = (...args) => {
      window.__recordScrollCalls.push({ args, current: window.scrollY, time: performance.now() })
      return window.__recordNativeScrollTo(...args)
    }
    window.__recordScrollSamples = [window.scrollY]
    window.__recordScrollListener = () => window.__recordScrollSamples.push(window.scrollY)
    window.addEventListener('scroll', window.__recordScrollListener, { passive: true })
  })
  await page.mouse.click(
    sourceJumpBounds.x + sourceJumpBounds.width / 2,
    sourceJumpBounds.y + sourceJumpBounds.height / 2,
  )
  await recordsFixture.locator('#record-r3').waitFor({ state: 'visible' })
  await page.getByRole('alertdialog').waitFor({ state: 'visible' })
  const recordJumpLocation = await page.evaluate(() => window.__memoryLocation)
  assert.equal(
    recordJumpLocation,
    '/records?view=written',
    'client routing must not publish a live fragment before the target is measured',
  )
  assert.equal(
    await page.evaluate(() => window.location.hash),
    '#record-r3',
    'the shareable fragment must be written only after exact positioning',
  )
  assert.equal(
    await recordsFixture.getByText('未找到要跳转的记录，请检查来源是否仍然存在。').count(),
    0,
    'same-route list-to-written source jumps must not discard their anchor before written data loads',
  )
  assert.match(
    (await recordsFixture.getByText(/第 2 页/).first().textContent()) || '',
    /第 2 页/,
    'a source jump must switch to the written page that actually contains the record',
  )
  const writtenPageSelector = recordsFixture.getByLabel('跳转书面页')
  assert.match(
    (await writtenPageSelector.textContent()) || '',
    /第 2 页/,
    'the written page selector must display the actual one-based page instead of its zero-based index',
  )
  const initialJumpHighlight = await recordsFixture.locator('#record-r3').evaluate((target) => {
    const style = getComputedStyle(target)
    return {
      active: target.getAttribute('data-record-jump-highlight'),
      cycle: target.getAttribute('data-record-jump-cycle'),
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
    }
  })
  assert.equal(
    initialJumpHighlight.active,
    'true',
    'the located record must expose one semantic highlight state after scrolling settles',
  )
  assert.equal(
    initialJumpHighlight.borderStyle,
    'solid',
    'the located record highlight must retain its real material boundary',
  )
  assert.ok(
    Number.parseFloat(initialJumpHighlight.borderWidth) >= 1,
    `the located record highlight must be clearly visible: ${JSON.stringify(initialJumpHighlight)}`,
  )
  assert.doesNotMatch(
    initialJumpHighlight.borderColor,
    /(?:\/ 0\)|, 0\))$/,
    `the located record highlight must retain theme color: ${JSON.stringify(initialJumpHighlight)}`,
  )
  assert.equal(
    initialJumpHighlight.boxShadow,
    'none',
    'the located record highlight must not use an outer shadow that a scroll container can clip',
  )
  assert.doesNotMatch(
    initialJumpHighlight.backgroundColor,
    /(?:\/ 0\)|, 0\))$/,
    'the located record highlight must reinforce its real border with an in-box surface tint',
  )
  const recordScrollTrajectory = await page.evaluate(() => {
    window.removeEventListener('scroll', window.__recordScrollListener)
    const samples = window.__recordScrollSamples || []
    const calls = window.__recordScrollCalls || []
    window.scrollTo = window.__recordNativeScrollTo
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      samples,
      calls,
      maximum: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
    }
  })
  assert.ok(recordScrollTrajectory.samples.length >= 1, 'record positioning must expose a stable scroll sample')
  assert.equal(recordScrollTrajectory.calls.length, 1, `record positioning must issue one window.scrollTo call: ${JSON.stringify(recordScrollTrajectory)}`)
  assert.equal(recordScrollTrajectory.calls[0]?.args?.[0]?.behavior, 'smooth', 'the single record scroll must remain browser-native smooth movement')
  const recordScrollStart = recordScrollTrajectory.samples[0]
  const recordScrollEnd = recordScrollTrajectory.samples.at(-1)
  assert.ok(
    recordScrollTrajectory.samples.every(
      (value) => value >= -1 && value <= recordScrollTrajectory.maximum + 1,
    ),
    `record positioning must stay inside the real document range: ${JSON.stringify(recordScrollTrajectory)}`,
  )
  if (recordScrollEnd >= recordScrollStart) {
    assert.ok(
      Math.min(...recordScrollTrajectory.samples) >= recordScrollStart - 1 &&
        Math.max(...recordScrollTrajectory.samples) <= recordScrollEnd + 1,
      `record positioning must not overshoot and rebound: ${JSON.stringify(recordScrollTrajectory)}`,
    )
  } else {
    assert.ok(
      Math.max(...recordScrollTrajectory.samples) <= recordScrollStart + 1 &&
        Math.min(...recordScrollTrajectory.samples) >= recordScrollEnd - 1,
      `record positioning must not undershoot and rebound: ${JSON.stringify(recordScrollTrajectory)}`,
    )
  }
  const scrollBeforeDialogClose = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: '留在此处' }).click()
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
  const dialogCloseState = await page.evaluate(() => ({
    scrollY: window.scrollY,
    focusedId: document.activeElement?.id || '',
    highlight: document.querySelector('#record-r3')?.getAttribute('data-record-jump-highlight'),
    highlightPending: document
      .querySelector('#record-r3')
      ?.getAttribute('data-record-jump-pending-fade'),
    highlightAnimation: document.querySelector('#record-r3')
      ? getComputedStyle(document.querySelector('#record-r3')).animationName
      : '',
  }))
  assert.ok(
    Math.abs(dialogCloseState.scrollY - scrollBeforeDialogClose) <= 1,
    `closing the jump dialog must not return-scroll to its old trigger: ${JSON.stringify({ scrollBeforeDialogClose, dialogCloseState })}`,
  )
  assert.equal(
    dialogCloseState.focusedId,
    'record-r3',
    'closing the jump dialog must leave focus on the visible record',
  )
  assert.equal(
    dialogCloseState.highlight,
    'true',
    'closing the jump dialog must expose a fresh visible target highlight',
  )
  assert.equal(
    dialogCloseState.highlightPending,
    'true',
    'the visible record highlight must hold briefly before its fade begins',
  )
  const postJumpScroll = dialogCloseState.scrollY
  const postJumpAnnotation = recordsFixture
    .locator('#record-r3')
    .getByRole('button', { name: '跳转后注释' })
  await postJumpAnnotation.hover()
  await page.locator('.record-annotation-popup[data-open]').waitFor({ state: 'visible' })
  assert.ok(
    Math.abs((await page.evaluate(() => window.scrollY)) - postJumpScroll) <= 1,
    'opening a popover immediately after record location must not move the document',
  )
  await page.mouse.move(4, 4)
  await page.locator('.record-annotation-popup[data-open]').waitFor({ state: 'hidden' })
  const locatedRecordGeometry = await recordsFixture.locator('#record-r3').evaluate((target) => {
    const bounds = target.getBoundingClientRect()
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      viewportHeight,
      scrollY: window.scrollY,
      maximumScroll: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
    }
  })
  assert.ok(
    locatedRecordGeometry.top >= -1 && locatedRecordGeometry.bottom <= locatedRecordGeometry.viewportHeight + 1,
    `the written record target must settle inside the real viewport: ${JSON.stringify(locatedRecordGeometry)}`,
  )
  assert.ok(
    locatedRecordGeometry.scrollY <= locatedRecordGeometry.maximumScroll + 1,
    `record location must not exceed the real document scroll range: ${JSON.stringify(locatedRecordGeometry)}`,
  )

  for (const [sourceId, linkName, targetId] of [
    ['record-r3', '第一条记录', 'record-r1'],
    ['record-r1', '第二条记录', 'record-r2'],
  ]) {
    const repeatLink = recordsFixture
      .locator(`#${sourceId} .record-link`)
      .filter({ hasText: linkName })
    await repeatLink.scrollIntoViewIfNeeded()
    const repeatLinkBounds = await repeatLink.boundingBox()
    assert.ok(repeatLinkBounds, `${sourceId} link must be visible before jumping to ${targetId}`)
    await page.evaluate(() => {
      window.__recordRepeatSamples = [window.scrollY]
      window.__recordRepeatListener = () => window.__recordRepeatSamples.push(window.scrollY)
      window.addEventListener('scroll', window.__recordRepeatListener, { passive: true })
    })
    await page.mouse.click(
      repeatLinkBounds.x + repeatLinkBounds.width / 2,
      repeatLinkBounds.y + repeatLinkBounds.height / 2,
    )
    await recordsFixture.locator(`#${targetId}`).waitFor({ state: 'visible' })
    await page.getByRole('alertdialog').waitFor({ state: 'visible' })
    const repeatTrajectory = await page.evaluate(() => {
      window.removeEventListener('scroll', window.__recordRepeatListener)
      const samples = window.__recordRepeatSamples || []
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      return {
        samples,
        maximum: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
      }
    })
    const repeatStart = repeatTrajectory.samples[0]
    const repeatEnd = repeatTrajectory.samples.at(-1)
    assert.ok(
      repeatTrajectory.samples.every(
        (value) => value >= -1 && value <= repeatTrajectory.maximum + 1,
      ),
      `repeated jump to ${targetId} must stay inside the document: ${JSON.stringify(repeatTrajectory)}`,
    )
    if (repeatEnd >= repeatStart) {
      assert.ok(
        Math.min(...repeatTrajectory.samples) >= repeatStart - 1 &&
          Math.max(...repeatTrajectory.samples) <= repeatEnd + 1,
        `repeated jump to ${targetId} must move downward without overshoot: ${JSON.stringify(repeatTrajectory)}`,
      )
    } else {
      assert.ok(
        Math.max(...repeatTrajectory.samples) <= repeatStart + 1 &&
          Math.min(...repeatTrajectory.samples) >= repeatEnd - 1,
        `repeated jump to ${targetId} must move upward without rebound: ${JSON.stringify(repeatTrajectory)}`,
      )
    }
    const beforeClose = await page.evaluate(() => window.scrollY)
    await page.getByRole('button', { name: '留在此处' }).click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    const afterClose = await page.evaluate(() => ({
      scrollY: window.scrollY,
      focusedId: document.activeElement?.id || '',
      maximum: Math.max(
        0,
        document.documentElement.scrollHeight -
          (window.visualViewport?.height || window.innerHeight),
      ),
    }))
    assert.ok(
      Math.abs(afterClose.scrollY - beforeClose) <= 1,
      `repeated record jump dialog close must preserve scroll: ${JSON.stringify({ sourceId, targetId, beforeClose, afterClose })}`,
    )
    assert.equal(afterClose.focusedId, targetId, `repeated record jump must focus ${targetId}`)
    assert.ok(
      afterClose.scrollY >= -1 && afterClose.scrollY <= afterClose.maximum + 1,
      `repeated record jump must stay inside the document: ${JSON.stringify({ targetId, afterClose })}`,
    )
  }

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
  await assertFullscreenImageViewer(page, 'default 1280px')
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
  assert.equal(await themeOptions.count(), 10, 'automatic plus nine designed light/dark theme presets must remain available')
  const themeModeGroups = page.locator('[data-theme-mode-group]')
  assert.equal(await themeModeGroups.count(), 3, 'automatic, light, and dark choices must have separate visual groups')
  assert.equal(await page.locator('[data-theme-mode="light"]').count(), 5, 'five distinct light themes must remain available')
  assert.equal(await page.locator('[data-theme-mode="dark"]').count(), 4, 'four distinct dark themes must remain available')
  const autoThemeControl = page.locator('[data-theme-preset-option="auto"]')
  const autoThemeGeometry = await autoThemeControl.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
    radioSlot: element.querySelector('[data-slot="radio-group-item"]')?.getAttribute('data-slot'),
    hasPreview: Boolean(element.querySelector('[data-theme-preview]')),
  }))
  assert.equal(
    autoThemeGeometry.radioSlot,
    'radio-group-item',
    'automatic palette must share the same shadcn RadioGroup as designed palettes',
  )
  assert.ok(
    autoThemeGeometry.height >= 40 && autoThemeGeometry.height <= 52,
    `automatic palette control must retain a readable touch target without becoming oversized: ${JSON.stringify(autoThemeGeometry)}`,
  )
  assert.equal(autoThemeGeometry.hasPreview, false, 'automatic palette must not render a full preview card')
  const appearanceTabsGeometry = await page
    .getByRole('tablist', { name: '风格设置分区' })
    .evaluate((list) => {
    const bounds = list.getBoundingClientRect()
    return {
      height: bounds.height,
      triggers: [...list.querySelectorAll('[data-slot="tabs-trigger"]')].map((trigger) => {
        const triggerBounds = trigger.getBoundingClientRect()
        return {
          top: triggerBounds.top - bounds.top,
          bottom: bounds.bottom - triggerBounds.bottom,
          height: triggerBounds.height,
        }
      }),
    }
  })
  assert.ok(
    appearanceTabsGeometry.height >= 40 && appearanceTabsGeometry.height <= 54,
    `appearance tab rail must reuse the compact standard control height: ${JSON.stringify(appearanceTabsGeometry)}`,
  )
  appearanceTabsGeometry.triggers.forEach((trigger) => {
    assert.ok(
      trigger.top >= -1 && trigger.bottom >= -1 && trigger.height >= 40,
      `appearance tab controls must stay fully inside the rail: ${JSON.stringify(appearanceTabsGeometry)}`,
    )
  })
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
  assert.equal(themePreviewColors.length, 9, 'all designed light/dark themes need compact previews')
  assert.equal(new Set(themePreviewColors.map((item) => `${item.background}|${item.accent}`)).size, 9, 'every designed theme preset needs a distinct visible preview')
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
    const darkIds = new Set(['ink', 'midnight', 'pine', 'aurora'])
    const relativeLuminance = (value) => {
      const oklch = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
      if (oklch) {
        const lightness = Number(oklch[1])
        const chroma = Number(oklch[2])
        const hue = Number(oklch[3]) * Math.PI / 180
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
      const oklab = value.match(/oklab\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
      if (oklab) {
        const lightness = Number(oklab[1])
        const a = Number(oklab[2])
        const b = Number(oklab[3])
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
      const toLinear = (channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
      if (srgb) {
        const [red, green, blue] = srgb.slice(1, 4).map((channel) => toLinear(Number(channel)))
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const rgb = value.match(/rgba?\(\s*([\d.]+)%?[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?/)
      if (rgb) {
        const percent = value.includes('%')
        const divisor = percent ? 100 : 255
        const [red, green, blue] = rgb
          .slice(1, 4)
          .map((channel) => toLinear(Number(channel) / divisor))
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      return null
    }
    const ratio = (first, second) => {
      const a = relativeLuminance(first)
      const b = relativeLuminance(second)
      if (a === null || b === null) return 0
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    window.__contrastRatio = ratio
    const output = ids.map((id) => {
      root.dataset.themePreset = id
      root.classList.toggle('dark', darkIds.has(id))
      const styles = getComputedStyle(root)
      const quiz = [...document.querySelectorAll('[data-quiz-theme-fixture]')].map((card) => {
        const cardStyles = getComputedStyle(card)
        const options = [...card.querySelectorAll('[data-quiz-option-state]')].map((option) => {
          const optionStyles = getComputedStyle(option)
          const label = option.querySelector('.quiz-option-label')
          const labelStyles = getComputedStyle(label)
          return {
            state: option.getAttribute('data-quiz-option-state'),
            background: optionStyles.backgroundColor,
            foreground: optionStyles.color,
            text: ratio(optionStyles.backgroundColor, optionStyles.color),
            labelBackground: labelStyles.backgroundColor,
            labelForeground: labelStyles.color,
            label: ratio(labelStyles.backgroundColor, labelStyles.color),
          }
        })
        return {
          type: card.getAttribute('data-question-type'),
          typeText: ratio(cardStyles.getPropertyValue('--quiz-type-surface'), cardStyles.getPropertyValue('--quiz-type-ink')),
          success: ratio(cardStyles.getPropertyValue('--quiz-success-surface'), cardStyles.getPropertyValue('--quiz-success-foreground')),
          successEmphasis: ratio(cardStyles.getPropertyValue('--quiz-success-emphasis'), cardStyles.getPropertyValue('--quiz-success-emphasis-foreground')),
          error: ratio(cardStyles.getPropertyValue('--quiz-error-surface'), cardStyles.getPropertyValue('--quiz-error-foreground')),
          errorEmphasis: ratio(cardStyles.getPropertyValue('--quiz-error-emphasis'), cardStyles.getPropertyValue('--quiz-error-emphasis-foreground')),
          options,
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
  }, ['auto', 'paper', 'mist', 'apricot', 'sage', 'rose', 'ink', 'midnight', 'pine', 'aurora'])
  themeContrasts.forEach((theme) => {
    assert.ok(theme.page >= 7, `${theme.id} page text contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.card >= 7, `${theme.id} card text contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.primary >= 4.5, `${theme.id} primary control contrast is too low: ${JSON.stringify(theme)}`)
    assert.ok(theme.muted >= 4.5, `${theme.id} muted text contrast is too low: ${JSON.stringify(theme)}`)
    theme.quiz.forEach((sample) => {
      for (const [state, contrast] of Object.entries(sample).filter(
        ([key]) => key !== 'type' && key !== 'options',
      )) {
        assert.ok(contrast >= 4.5, `${theme.id} ${sample.type} quiz ${state} contrast is too low: ${JSON.stringify(sample)}`)
      }
      sample.options.forEach((option) => {
        assert.ok(option.text >= 4.5, `${theme.id} ${sample.type} quiz ${option.state} text contrast is too low: ${JSON.stringify(option)}`)
        assert.ok(option.label >= 4.5, `${theme.id} ${sample.type} quiz ${option.state} label contrast is too low: ${JSON.stringify(option)}`)
      })
    })
  })

  const assertQuizOptionInteractions = async (themeId) => {
    await page.locator(`[data-theme-preset-option="${themeId}"]`).click()
    await page.waitForFunction(
      (id) => document.documentElement.dataset.themePreset === id,
      themeId,
    )
    await page.waitForTimeout(220)
    const option = page.locator(
      '[data-quiz-theme-fixture="choice"] [data-quiz-option-state="default"]',
    )
    const readState = () =>
      option.evaluate((target) => {
        const style = getComputedStyle(target)
        return {
          contrast: window.__contrastRatio(style.backgroundColor, style.color),
          background: style.backgroundColor,
          foreground: style.color,
          boxShadow: style.boxShadow,
          outline: style.outlineStyle,
          bounds: target.getBoundingClientRect().toJSON(),
        }
      })
    const normal = await readState()
    assert.ok(normal.contrast >= 4.5, `${themeId} default quiz option contrast is too low`)
    await option.hover()
    const hovered = await readState()
    assert.ok(
      hovered.contrast >= 4.5,
      `${themeId} hovered quiz option contrast is too low: ${JSON.stringify(hovered)}`,
    )
    assert.deepEqual(hovered.bounds, normal.bounds, `${themeId} quiz option hover must not move or resize`)
    await page
      .locator('[data-quiz-theme-fixture="choice"] [data-quiz-option-state="selected"]')
      .focus()
    await page.keyboard.press('Shift+Tab')
    assert.equal(
      await option.evaluate((target) => document.activeElement === target),
      true,
      `${themeId} keyboard traversal must focus the default quiz option`,
    )
    const focused = await readState()
    assert.ok(
      focused.contrast >= 4.5,
      `${themeId} focused quiz option contrast is too low: ${JSON.stringify(focused)}`,
    )
    assert.ok(
      focused.boxShadow !== 'none' || focused.outline !== 'none',
      `${themeId} focused quiz option must keep an explicit keyboard indicator`,
    )
    const bounds = await option.boundingBox()
    assert.ok(bounds, `${themeId} quiz option must be measurable before pressed-state testing`)
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    const pressed = await readState()
    await page.mouse.up()
    assert.ok(pressed.contrast >= 4.5, `${themeId} pressed quiz option contrast is too low`)
    assert.deepEqual(pressed.bounds, normal.bounds, `${themeId} quiz option press must not move or resize`)
  }
  await assertQuizOptionInteractions('paper')
  await assertQuizOptionInteractions('midnight')
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'auto')

  await page.locator('[data-theme-preset-option="pine"]').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')?.theme === 'pine')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__markupLayoutReady === true)
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'pine' && document.documentElement.classList.contains('dark'))
  assert.equal(await page.locator('[data-theme-preset-option="pine"]').getAttribute('data-selected'), 'true', 'the selected dark preset must survive a full bootstrap and React remount')
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && document.documentElement.dataset.themePreset === 'auto')

  const paletteChoice = page.locator('[data-theme-preset-option="mist"]')
  await paletteChoice.scrollIntoViewIfNeeded()
  const paletteBoundsBefore = await paletteChoice.boundingBox()
  await paletteChoice.hover()
  await page.waitForTimeout(220)
  const paletteBoundsAfter = await paletteChoice.boundingBox()
  assert.deepEqual(paletteBoundsAfter, paletteBoundsBefore, 'palette hover must not move or resize its real label hit target')

  await page.getByRole('tab', { name: /^背景/ }).click()
  const backgroundCards = page.locator('[data-background-id]')
  assert.equal(await backgroundCards.count(), 3, 'all baseline background choices must remain available')
  await backgroundCards.last().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-background-id] img')].every((image) => image.naturalWidth > 0))
  const mountainBoundsBefore = await page.locator('[data-background-id="mountain"]').boundingBox()
  await page.locator('[data-background-id="mountain"]').hover()
  await page.waitForTimeout(220)
  const mountainBoundsAfter = await page.locator('[data-background-id="mountain"]').boundingBox()
  assert.deepEqual(mountainBoundsAfter, mountainBoundsBefore, 'background hover must preserve the exact selectable-card geometry')
  const backgroundHoverTransforms = await page.locator('[data-background-id] img').evaluateAll((images) =>
    images.map((image) => ({
      id: image.closest('[data-background-id]')?.getAttribute('data-background-id'),
      scale: getComputedStyle(image).scale,
    })),
  )
  assert.notEqual(
    backgroundHoverTransforms.find((item) => item.id === 'mountain')?.scale,
    'none',
    'the hovered background preview must receive its restrained scale feedback',
  )
  assert.equal(
    backgroundHoverTransforms.find((item) => item.id === 'cloud')?.scale,
    'none',
    'hovering one background must not lift every preview image',
  )
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
  assert.ok(
    await backgroundCards.evaluateAll((cards) => cards.every((card) => card.tagName === 'LABEL')),
    'each background visual boundary must itself be the complete label hit target',
  )
  assert.equal(new Set(backgroundGeometry.map((card) => card.strip)).size, 3, 'background theme strips must reflect distinct source palettes')
  await page.locator('[data-background-id="default"] [data-slot="radio-group-item"]').focus()
  const focusedBackground = await page.locator('[data-background-id="default"]').evaluate((card) => ({
    outline: getComputedStyle(card).outlineStyle,
    outlineOffset: getComputedStyle(card).outlineOffset,
    shadow: getComputedStyle(card).boxShadow,
    bounds: card.getBoundingClientRect().toJSON(),
  }))
  assert.equal(focusedBackground.outline, 'solid', 'keyboard focus must use an explicit non-shadow boundary')
  assert.ok(Number.parseFloat(focusedBackground.outlineOffset) >= 2, 'keyboard focus must remain separated from the selected border')
  const clippedShadowRisks = await page.locator('#root').evaluate((root) => {
    const risks = []
    const isVisible = (target) => {
      const bounds = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const clips = (value) => /(?:hidden|clip|auto|scroll)/u.test(value)
    for (const target of root.querySelectorAll('*')) {
      const style = getComputedStyle(target)
      if (!isVisible(target) || style.boxShadow === 'none') continue
      const bounds = target.getBoundingClientRect()
      let ancestor = target.parentElement
      while (ancestor && ancestor !== root) {
        const ancestorStyle = getComputedStyle(ancestor)
        const clipsX = clips(ancestorStyle.overflowX)
        const clipsY = clips(ancestorStyle.overflowY)
        if (clipsX || clipsY) {
          const ancestorBounds = ancestor.getBoundingClientRect()
          const slack = {
            top: bounds.top - ancestorBounds.top,
            right: ancestorBounds.right - bounds.right,
            bottom: ancestorBounds.bottom - bounds.bottom,
            left: bounds.left - ancestorBounds.left,
          }
          if (
            (clipsX && (slack.left < 12 || slack.right < 12)) ||
            (clipsY && (slack.top < 12 || slack.bottom < 12))
          ) {
            risks.push({
              target: target.getAttribute('data-slot') || target.className || target.tagName,
              ancestor: ancestor.getAttribute('data-slot') || ancestor.className || ancestor.tagName,
              overflowX: ancestorStyle.overflowX,
              overflowY: ancestorStyle.overflowY,
              slack,
              shadow: style.boxShadow,
            })
          }
        }
        ancestor = ancestor.parentElement
      }
    }
    return risks
  })
  assert.deepEqual(
    clippedShadowRisks,
    [],
    `visible shadows need enough inset from every clipping ancestor: ${JSON.stringify(clippedShadowRisks)}`,
  )
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
      rootImage: getComputedStyle(document.documentElement).backgroundImage,
      bodyColor: getComputedStyle(document.body).backgroundColor,
      rootOverscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
      bodyOverscroll: getComputedStyle(document.body).overscrollBehaviorY,
    }
  })
  assert.match(surfaceGeometry.layerImage, /cloud\.webp/, 'the selected background must remain mounted behind the formal application surface')
  assert.notEqual(surfaceGeometry.surfaceImage, 'none', 'the application surface needs a translucent readability gradient')
  assert.match(surfaceGeometry.surfaceColor, /(?:\/ 0\)|, 0\))$/, `the application surface must not keep an opaque shadcn background: ${JSON.stringify(surfaceGeometry)}`)
  assert.notEqual(surfaceGeometry.topbarBackdrop, 'none', 'the top bar must keep a bounded glass treatment')
  assert.notEqual(surfaceGeometry.sidebarBackdrop, 'none', 'the sidebar must keep a bounded glass treatment')
  assert.match(surfaceGeometry.rootImage, /cloud\.webp/, 'elastic overscroll must reveal the same selected image on the document canvas')
  assert.match(surfaceGeometry.bodyColor, /(?:\/ 0\)|, 0\))$/, `the body must not cover the shared overscroll canvas: ${JSON.stringify(surfaceGeometry)}`)
  assert.equal(surfaceGeometry.rootOverscroll, 'none', 'the root must contain vertical elastic overscroll')
  assert.equal(surfaceGeometry.bodyOverscroll, 'none', 'the body must not reveal a mismatched canvas at either edge')

  await page.getByRole('tab', { name: /^方框/ }).click()
  const boxStyleCards = page.locator('[data-box-style-id]')
  assert.equal(await boxStyleCards.count(), 3, 'compact, standard, and liquid glass must be the only box styles')
  const radiusFamilies = []
  for (const [id, expectedInset] of [
    ['compact', 2],
    ['default', 4],
    ['glass', 7],
  ]) {
    await page.locator(`[data-box-style-id="${id}"]`).click()
    await page.waitForFunction(
      (boxStyle) => document.documentElement.dataset.boxStyle === boxStyle,
      id,
    )
    await page.waitForTimeout(220)
    const geometry = await page.locator('[data-scroll-area-fixture]').evaluate((root) => {
      const scrollbar = root.querySelector(
        '[data-slot="scroll-area-scrollbar"][data-orientation="vertical"]',
      )
      const thumb = scrollbar?.querySelector('[data-slot="scroll-area-thumb"]')
      const rootBounds = root.getBoundingClientRect()
      const scrollbarBounds = scrollbar?.getBoundingClientRect()
      const thumbBounds = thumb?.getBoundingClientRect()
      const rootStyles = getComputedStyle(root)
      return {
        edgeInset: Number.parseFloat(rootStyles.getPropertyValue('--scrollbar-edge-inset')),
        rootRadius: Number.parseFloat(rootStyles.borderTopLeftRadius),
        rootOverflow: rootStyles.overflow,
        scrollbarTopInset: scrollbarBounds ? scrollbarBounds.top - rootBounds.top : -1,
        scrollbarBottomInset: scrollbarBounds ? rootBounds.bottom - scrollbarBounds.bottom : -1,
        scrollbarWidth: scrollbarBounds?.width || 0,
        thumbWidth: thumbBounds?.width || 0,
        thumbRadius: thumb ? Number.parseFloat(getComputedStyle(thumb).borderTopLeftRadius) : 0,
      }
    })
    assert.equal(geometry.edgeInset, expectedInset, `${id} scrollbars must use their radius-family edge inset`)
    assert.equal(geometry.rootOverflow, 'clip', `${id} rounded scroll areas must clip edge leakage`)
    assert.ok(
      Math.abs(geometry.scrollbarTopInset - expectedInset) <= 1 &&
        Math.abs(geometry.scrollbarBottomInset - expectedInset) <= 1,
      `${id} scrollbar must stay clear of both rounded ends: ${JSON.stringify(geometry)}`,
    )
    assert.ok(
      geometry.thumbWidth <= geometry.scrollbarWidth + 1,
      `${id} vertical thumb must not widen beyond its track: ${JSON.stringify(geometry)}`,
    )
    assert.ok(geometry.thumbRadius > 0, `${id} scrollbar thumb must inherit a visible radius`)
    radiusFamilies.push({ id, ...geometry })
  }
  assert.ok(
    radiusFamilies[0].rootRadius < radiusFamilies[1].rootRadius &&
      radiusFamilies[1].rootRadius < radiusFamilies[2].rootRadius,
    `the three product radius families must remain visually distinct: ${JSON.stringify(radiusFamilies)}`,
  )
  await page.locator('[data-box-style-id="default"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.boxStyle === 'default')
  await page.getByRole('tab', { name: /^背景/ }).click()
  const standardSelectionAnimations = await page.locator('.app-segmented-control').evaluate((list) =>
    list
      .getAnimations({ subtree: true })
      .map((animation) => animation.id)
      .filter(Boolean),
  )
  assert.deepEqual(
    standardSelectionAnimations,
    ['app-selection-move'],
    'ordinary segmented controls must use one lightweight shared-surface movement',
  )
  await page.getByRole('tab', { name: /^方框/ }).click()
  const glassChoice = page.locator('[data-box-style-id="glass"]')
  await glassChoice.scrollIntoViewIfNeeded()
  const glassChoiceBoundsBefore = await glassChoice.boundingBox()
  await glassChoice.hover()
  await page.waitForTimeout(220)
  const glassChoiceBoundsAfter = await glassChoice.boundingBox()
  assert.ok(
    glassChoiceBoundsBefore &&
      glassChoiceBoundsAfter &&
      glassChoiceBoundsAfter.width === glassChoiceBoundsBefore.width &&
      glassChoiceBoundsAfter.height === glassChoiceBoundsBefore.height &&
      Math.abs(glassChoiceBoundsAfter.x - glassChoiceBoundsBefore.x) <= 1 &&
      Math.abs(glassChoiceBoundsAfter.y - glassChoiceBoundsBefore.y) <= 1,
    `box-style hover must preserve selectable-card geometry: ${JSON.stringify({ glassChoiceBoundsBefore, glassChoiceBoundsAfter })}`,
  )
  const defaultQuizSizes = await page.locator('[data-quiz-theme-fixture]').evaluateAll((cards) =>
    cards.map((card) => ({
      type: card.getAttribute('data-question-type'),
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
    })),
  )
  await page.locator('[data-box-style-id="glass"]').click()
  await page.waitForFunction(() => {
    const value = JSON.parse(localStorage.getItem('classRecord:appearance:v1') || 'null')
    return value?.box === 'glass' && document.documentElement.dataset.boxStyle === 'glass'
  })
  const glassCardBackdrop = await page
    .locator('[data-case="app-surface"] [data-slot="card"]')
    .evaluate((card) => getComputedStyle(card).backdropFilter)
  assert.equal(
    glassCardBackdrop,
    'none',
    'dense content cards must use the quieter material without repeating an expensive backdrop pass',
  )
  await page.getByRole('tab', { name: /^配色/ }).click()
  const liquidSelectionMotion = await page.locator('.app-segmented-control').evaluate((list) => {
    const indicator = list.querySelector('.app-selection-indicator')
    const bridge = list.querySelector('.app-selection-bridge')
    const refraction = list.querySelector('.app-selection-refraction')
    return {
      switching: list.hasAttribute('data-selection-switching'),
      material: list.getAttribute('data-selection-material'),
      animations: list
        .getAnimations({ subtree: true })
        .map((animation) => animation.id)
        .filter(Boolean)
        .sort(),
      bridgeDisplay: bridge ? getComputedStyle(bridge).display : '',
      backdrop: getComputedStyle(list).backdropFilter,
      indicatorBackdrop: indicator ? getComputedStyle(indicator).backdropFilter : '',
      refractionBackdrop: refraction ? getComputedStyle(refraction).backdropFilter : '',
      refractionFilter: refraction ? getComputedStyle(refraction, '::after').filter : '',
    }
  })
  assert.equal(liquidSelectionMotion.switching, true)
  assert.equal(liquidSelectionMotion.material, 'liquid')
  assert.deepEqual(
    liquidSelectionMotion.animations,
    [
      'app-liquid-selection-bridge',
      'app-liquid-selection-lens',
      'app-liquid-selection-move',
      'app-liquid-selection-reshape',
    ],
    `liquid tabs must reshape through one moving surface and a temporary bridge: ${JSON.stringify(liquidSelectionMotion)}`,
  )
  assert.equal(liquidSelectionMotion.bridgeDisplay, 'block')
  assert.notEqual(liquidSelectionMotion.backdrop, 'none', 'the segmented group must own exactly one bounded backdrop sample')
  assert.equal(liquidSelectionMotion.indicatorBackdrop, 'none', 'the moving selection must not resample the backdrop')
  assert.equal(liquidSelectionMotion.refractionBackdrop, 'none', 'the refracted highlight must not resample the backdrop')
  assert.match(liquidSelectionMotion.refractionFilter, /app-liquid-glass-refraction/, 'liquid highlights must use the bounded shared refraction filter')
  await page.waitForTimeout(440)
  assert.equal(
    await page.locator('.app-segmented-control').getAttribute('data-selection-switching'),
    null,
    'paint-only liquid switching state must settle and release after the animation',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('tab', { name: /^背景/ }).click()
  const reducedLiquidMotion = await page.locator('.app-segmented-control').evaluate((list) => ({
    switching: list.hasAttribute('data-selection-switching'),
    animations: list.getAnimations({ subtree: true }).filter((animation) => animation.id).length,
  }))
  assert.deepEqual(
    reducedLiquidMotion,
    { switching: false, animations: 0 },
    `reduced motion must bypass liquid selection animation: ${JSON.stringify(reducedLiquidMotion)}`,
  )
  await page.waitForTimeout(440)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('tab', { name: /^配色/ }).click()
  await page.getByRole('tab', { name: /^背景/ }).click()
  await page.getByRole('tab', { name: /^方框/ }).click()
  const rapidLiquidSwitch = await page.locator('.app-segmented-control').evaluate((list) => {
    const indicator = list.querySelector('.app-selection-indicator')?.getBoundingClientRect()
    const selected = list.querySelector('[data-slot="tabs-trigger"][data-active]')?.getBoundingClientRect()
    return {
      active: list.querySelector('[data-slot="tabs-trigger"][data-active]')?.textContent?.trim(),
      animationCount: list.getAnimations({ subtree: true }).filter((animation) => animation.id).length,
      centerDelta:
        indicator && selected
          ? Math.abs(indicator.left + indicator.width / 2 - (selected.left + selected.width / 2))
          : Number.POSITIVE_INFINITY,
    }
  })
  assert.match(rapidLiquidSwitch.active || '', /^方框/)
  assert.ok(rapidLiquidSwitch.animationCount <= 4, `rapid switching must keep a bounded animation set: ${JSON.stringify(rapidLiquidSwitch)}`)
  assert.ok(Number.isFinite(rapidLiquidSwitch.centerDelta), 'rapid switching must retain one measurable selected surface')
  await page.waitForTimeout(410)
  const settledSelectionDelta = await page.locator('.app-segmented-control').evaluate((list) => {
    const indicator = list.querySelector('.app-selection-indicator')?.getBoundingClientRect()
    const selected = list.querySelector('[data-slot="tabs-trigger"][data-active]')?.getBoundingClientRect()
    return indicator && selected
      ? Math.abs(indicator.left + indicator.width / 2 - (selected.left + selected.width / 2))
      : Number.POSITIVE_INFINITY
  })
  assert.ok(settledSelectionDelta <= 1, `liquid selection must settle exactly on the active option: ${settledSelectionDelta}`)
  await page.getByRole('tab', { name: /^配色/ }).click()
  for (const themeId of [
    'paper',
    'mist',
    'apricot',
    'sage',
    'rose',
    'ink',
    'midnight',
    'pine',
    'aurora',
  ]) {
    await page.locator(`[data-theme-preset-option="${themeId}"]`).click()
    await page.waitForFunction(
      (id) => document.documentElement.dataset.themePreset === id,
      themeId,
    )
    const recordMaterial = await recordsFixture.locator('#record-r3').evaluate(async (target) => {
      target.removeAttribute('data-record-jump-highlight')
      const normal = getComputedStyle(target)
      const normalState = {
        style: normal.borderStyle,
        width: normal.borderWidth,
        color: normal.borderColor,
      }
      target.setAttribute('data-record-jump-highlight', 'true')
      await new Promise((resolve) => window.setTimeout(resolve, 180))
      const highlighted = getComputedStyle(target)
      const highlightedState = {
        style: highlighted.borderStyle,
        width: highlighted.borderWidth,
        color: highlighted.borderColor,
      }
      target.removeAttribute('data-record-jump-highlight')
      return { normalState, highlightedState }
    })
    assert.equal(
      recordMaterial.normalState.style,
      'solid',
      `${themeId} written records must retain a material boundary`,
    )
    assert.ok(
      Number.parseFloat(recordMaterial.normalState.width) >= 1,
      `${themeId} written record boundary must remain visible: ${JSON.stringify(recordMaterial)}`,
    )
    assert.doesNotMatch(
      recordMaterial.normalState.color,
      /(?:\/ 0\)|, 0\))$/,
      `${themeId} written record boundary must not become transparent`,
    )
    assert.equal(
      recordMaterial.highlightedState.style,
      'solid',
      `${themeId} jump state must retain a semantic boundary`,
    )
    assert.ok(
      Number.parseFloat(recordMaterial.highlightedState.width) >= 1,
      `${themeId} jump highlight must retain the quiet material boundary: ${JSON.stringify(recordMaterial)}`,
    )
    assert.notEqual(
      recordMaterial.highlightedState.color,
      recordMaterial.normalState.color,
      `${themeId} jump highlight must remain distinguishable from the normal boundary`,
    )
  }
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'auto')
  await page.getByRole('tab', { name: /^方框/ }).click()
  const liquidLayers = await page.locator('[data-case="app-surface"]').evaluate((surface) => {
    const describe = (target) => {
      const style = getComputedStyle(target)
      return {
        backdrop: style.backdropFilter,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
      }
    }
    const topbar = surface.querySelector('.app-topbar')
    const sidebar = surface.querySelector('[data-slot="sidebar-inner"]')
    const card = surface.querySelector('[data-slot="card"]')
    return {
      topbar: describe(topbar),
      sidebar: describe(sidebar),
      card: describe(card),
      transientAttributes: document.querySelectorAll('[data-liquid-active]').length,
      inlinePointerStyles: [...document.querySelectorAll('[style]')].filter(
        (target) =>
          target.style.getPropertyValue('--liquid-pointer-x') ||
          target.style.getPropertyValue('--liquid-ambient-local'),
      ).length,
    }
  })
  for (const [name, layer] of Object.entries({
    topbar: liquidLayers.topbar,
    sidebar: liquidLayers.sidebar,
  })) {
    assert.notEqual(layer.backdrop, 'none', `${name} must keep one bounded backdrop sample`)
    assert.doesNotMatch(layer.backgroundImage, /radial-gradient/, `${name} must keep a planar edge response`)
    assert.doesNotMatch(layer.boxShadow, /inset/, `${name} must not create a thick or convex inner rim`)
  }
  assert.equal(liquidLayers.card.backdrop, 'none', 'content cards must remain in the standard material layer')
  assert.equal(liquidLayers.transientAttributes, 0, 'glass must not mutate transient active attributes during pointer movement')
  assert.equal(liquidLayers.inlinePointerStyles, 0, 'glass must not retain pointer-dependent inline paint state')

  await page.getByRole('tab', { name: /^配色/ }).click()
  await page.locator('[data-theme-preset-option="midnight"]').click()
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.themePreset === 'midnight' &&
      document.documentElement.classList.contains('dark'),
  )
  const darkLiquidLayers = await page.locator('[data-case="app-surface"]').evaluate((surface) => {
    const targets = [surface.querySelector('.app-topbar'), surface.querySelector('[data-slot="sidebar-inner"]')]
    return targets.map((target) => {
      const style = getComputedStyle(target)
      return { backgroundImage: style.backgroundImage, boxShadow: style.boxShadow }
    })
  })
  darkLiquidLayers.forEach((layer) => {
    assert.doesNotMatch(layer.backgroundImage, /radial-gradient/, 'dark glass must not use a convex centre highlight')
    assert.doesNotMatch(layer.boxShadow, /inset/, 'dark glass must not use white inner glow or thick-glass shading')
  })
  if (process.env.CLASS_RECORD_DARK_GLASS_SCREENSHOT) {
    await page.screenshot({ path: process.env.CLASS_RECORD_DARK_GLASS_SCREENSHOT, fullPage: true })
  }
  await page.locator('[data-theme-preset-option="auto"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'auto')
  await page.getByRole('tab', { name: /^方框/ }).click()
  const glassQuizGeometry = await page.locator('[data-quiz-theme-fixture]').evaluateAll((cards) =>
    cards.map((card) => ({
      type: card.getAttribute('data-question-type'),
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
      overflowX: card.scrollWidth - card.clientWidth,
      overflowY: card.scrollHeight - card.clientHeight,
      backdrop: getComputedStyle(card).backdropFilter,
      contain: getComputedStyle(card).contain,
      outlineStyle: getComputedStyle(card).outlineStyle,
      overflow: getComputedStyle(card).overflow,
      cardRadius: getComputedStyle(card).borderStartStartRadius,
      edgeContent: getComputedStyle(card, '::before').content,
      backgroundImage: getComputedStyle(card).backgroundImage,
      boxShadow: getComputedStyle(card).boxShadow,
      borderWidths: [
        getComputedStyle(card).borderTopWidth,
        getComputedStyle(card).borderRightWidth,
        getComputedStyle(card).borderBottomWidth,
        getComputedStyle(card).borderLeftWidth,
      ],
      headerTopOffset:
        card.querySelector('[data-slot="card-header"]').getBoundingClientRect().top -
        card.getBoundingClientRect().top,
      headerRadius: getComputedStyle(card.querySelector('[data-slot="card-header"]')).borderStartStartRadius,
      footerRadius: getComputedStyle(card.querySelector('[data-slot="card-footer"]')).borderEndStartRadius,
    })),
  )
  glassQuizGeometry.forEach((card) => {
    assert.ok(
      card.overflowX <= 1 && card.overflowY <= 1,
      `liquid glass must not clip or enlarge ${card.type} quiz content: ${JSON.stringify(card)}`,
    )
    assert.equal(card.backdrop, 'none', `liquid glass quiz cards must avoid duplicated backdrop edge sampling on ${card.type}`)
    assert.equal(card.contain, 'none', `${card.type} quiz cards must not create an independent containment surface at their corners`)
    assert.equal(card.outlineStyle, 'none', `${card.type} quiz cards must not rasterize a second rounded outline`)
    assert.equal(card.overflow, 'hidden', `${card.type} quiz material layers must be clipped by one outer radius`)
    assert.ok(Number.parseFloat(card.cardRadius) > 0, `${card.type} quiz card must retain its outer radius`)
    assert.equal(card.edgeContent, 'none', `${card.type} quiz card must not add a second masked rim that can fracture at corners`)
    assert.equal(card.backgroundImage, 'none', `${card.type} quiz card must not retain a second top-edge gradient layer`)
    assert.equal(card.boxShadow, 'none', `${card.type} quiz card must not rely on a shadow that its locked viewport can clip`)
    assert.equal(new Set(card.borderWidths).size, 1, `${card.type} quiz card must keep one continuous border around all four corners`)
    assert.ok(card.headerTopOffset <= 2, `${card.type} quiz header must begin directly inside the single outer edge`)
    assert.equal(Number.parseFloat(card.headerRadius), 0, `${card.type} quiz header must rely on the single outer top radius`)
    assert.equal(Number.parseFloat(card.footerRadius), 0, `${card.type} quiz footer must rely on the single outer bottom radius`)
  })
  assert.deepEqual(
    glassQuizGeometry.map(({ type, width, height }) => ({ type, width, height })),
    defaultQuizSizes,
    'switching to liquid glass must not resize or reflow quiz cards',
  )
  if (process.env.CLASS_RECORD_GLASS_SCREENSHOT) {
    await page.screenshot({ path: process.env.CLASS_RECORD_GLASS_SCREENSHOT, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 720 })
  await assertFullscreenImageViewer(page, 'liquid-glass 390px')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.locator('[data-box-style-id="default"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.boxStyle === 'default')
  const resetGlassState = await page.locator('[data-case="app-surface"] [data-slot="card"]').evaluate((card) => ({
    backdrop: getComputedStyle(card).backdropFilter,
    activeLayers: document.querySelectorAll('[data-liquid-active="true"]').length,
  }))
  assert.equal(resetGlassState.backdrop, 'none', 'default box mode must not retain liquid-glass blur')
  assert.equal(resetGlassState.activeLayers, 0, 'default box mode must clear transient liquid-glass interaction state')

  await page.evaluate(() => window.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: 'auto' }))
  const bottomBoundary = await page.evaluate(() => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      scrollY: window.scrollY,
      maximum: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
      rootImage: getComputedStyle(document.documentElement).backgroundImage,
    }
  })
  assert.ok(Math.abs(bottomBoundary.scrollY - bottomBoundary.maximum) <= 1, `the document must clamp its final scroll position: ${JSON.stringify(bottomBoundary)}`)
  assert.match(bottomBoundary.rootImage, /cloud\.webp/, 'the selected root background must remain continuous at the lower scroll edge')

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
  const guideLogo = guide.locator('.guide-hero [role="img"]').first()
  const guideLogoSemantics = await guideLogo.evaluate((logo) => {
    const image = logo.querySelector('img')
    return {
      tag: logo.tagName,
      interactiveAncestor: Boolean(logo.closest('a, button, [role="button"]')),
      tabIndex: logo.getAttribute('tabindex'),
      cursor: getComputedStyle(logo).cursor,
      userSelect: getComputedStyle(logo).userSelect,
      imageDraggable: image?.draggable,
      imagePointerEvents: image ? getComputedStyle(image).pointerEvents : '',
      imageUserSelect: image ? getComputedStyle(image).userSelect : '',
    }
  })
  assert.equal(guideLogoSemantics.tag, 'DIV', 'guide logo must be a presentational container')
  assert.equal(guideLogoSemantics.interactiveAncestor, false, 'guide logo must not retain a link, button or button role')
  assert.equal(guideLogoSemantics.tabIndex, null, 'guide logo must not be keyboard focusable')
  assert.notEqual(guideLogoSemantics.cursor, 'pointer', 'guide logo must not advertise click behavior')
  assert.equal(guideLogoSemantics.userSelect, 'none', 'guide logo must not be selectable')
  assert.equal(guideLogoSemantics.imageDraggable, false, 'guide logo image must not be draggable')
  assert.equal(guideLogoSemantics.imagePointerEvents, 'none', 'guide logo image must not receive pointer events')
  assert.equal(guideLogoSemantics.imageUserSelect, 'none', 'guide logo image must not be selectable')
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
  await page.locator('.record-annotation-popup').evaluate((element) => {
    window.__annotationScrollCloseCount = 0
    const observer = new MutationObserver(() => {
      if (element.hasAttribute('data-closed')) window.__annotationScrollCloseCount += 1
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-closed'] })
    window.setTimeout(() => observer.disconnect(), 800)
  })
  await page.evaluate(() => window.scrollBy(0, 2))
  await page.locator('.record-annotation-popup[data-closed]').waitFor({ state: 'visible' })
  await annotationPopup.waitFor({ state: 'hidden' })
  await page.waitForTimeout(180)
  assert.equal(
    await page.evaluate(() => window.__annotationScrollCloseCount),
    1,
    'one vertical scroll must start exactly one annotation exit lifecycle',
  )
  assert.equal(
    await page.locator('.record-annotation-popup[data-open]').count(),
    0,
    'a stationary pointer must not reopen an annotation after scrolling',
  )
  await page.mouse.move(4, 4)
  await shortTrigger.hover()
  await annotationPopup.waitFor({ state: 'visible' })
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
  await longTrigger.scrollIntoViewIfNeeded()
  await page.waitForTimeout(50)
  await longTrigger.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.matches('a.person-link'))
  await nestedPerson.press('Enter')
  await page.waitForFunction(() => window.__memoryLocation === '/person?id=p01')

  await page.setViewportSize({ width: 320, height: 1000 })
  await page.mouse.move(4, 4)
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
  await page.locator('.record-illustration-popup').evaluate((element) => {
    window.__illustrationScrollCloseCount = 0
    const observer = new MutationObserver(() => {
      if (element.hasAttribute('data-closed')) window.__illustrationScrollCloseCount += 1
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-closed'] })
    window.setTimeout(() => observer.disconnect(), 800)
  })
  await page.evaluate(() => window.scrollBy(0, 2))
  await page.locator('.record-illustration-popup[data-closed]').waitFor({ state: 'visible' })
  await illustrationPopup.waitFor({ state: 'hidden' })
  await page.waitForTimeout(180)
  assert.equal(
    await page.evaluate(() => window.__illustrationScrollCloseCount),
    1,
    'one vertical scroll must start exactly one illustration exit lifecycle',
  )
  assert.equal(
    await page.locator('.record-illustration-popup[data-open]').count(),
    0,
    'a stationary pointer must not reopen an illustration after scrolling',
  )
  await page.mouse.move(4, 4)
  await illustration.hover()
  await illustrationPopup.waitFor({ state: 'visible' })
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

  const guardedDirectHash = await page.evaluate(() => {
    history.replaceState(history.state, '', '/class/records?view=written#record-r2')
    window.__installRecordJumpGuard()
    const pending = JSON.parse(
      sessionStorage.getItem('classrecord:pending-record-jump') || 'null',
    )
    const result = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      pendingTarget: pending?.targetAnchorId || '',
    }
    sessionStorage.removeItem('classrecord:pending-record-jump')
    history.replaceState(history.state, '', '/')
    return result
  })
  assert.deepEqual(
    guardedDirectHash,
    {
      pathname: '/class/records',
      search: '?view=written',
      hash: '',
      pendingTarget: 'record-r2',
    },
    'direct record fragments under a deployment basename must be captured before native anchor scrolling',
  )

  assert.deepEqual(pageErrors, [], `browser page errors during interaction regression: ${pageErrors.join('; ')}`)
  assert.deepEqual(consoleProblems, [], `browser console warnings/errors: ${consoleProblems.join('; ')}`)
  assert.ok(
    expectedHarnessNetworkFailures <= 6,
    `the credential-free image harness exceeded the bounded page/illustration retry budget: ${expectedHarnessNetworkFailures}`,
  )

  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const touchErrors = []
  touchPage.on('pageerror', (error) => touchErrors.push(error.message))
  await touchPage.goto(origin, { waitUntil: 'networkidle' })
  await touchPage.waitForFunction(() => window.__markupLayoutReady === true)
  const touchLongTrigger = touchPage.getByRole('button', { name: '长注触发' })
  await touchLongTrigger.scrollIntoViewIfNeeded()
  await touchPage.waitForTimeout(80)
  await touchLongTrigger.tap()
  const touchAnnotation = touchPage.locator('.record-annotation-popup[data-open]')
  await touchAnnotation.waitFor({ state: 'visible' })
  await touchPage.waitForTimeout(160)
  const touchPerson = touchAnnotation.locator('a.person-link', { hasText: '人物标记' })
  await touchPerson.tap()
  await touchPage.waitForFunction(() => window.__memoryLocation === '/person?id=p01')
  assert.deepEqual(touchErrors, [], `touch browser page errors: ${touchErrors.join('; ')}`)
  await touchPage.close()

  for (const deviceScaleFactor of [1.25, 2]) {
    const densityPage = await browser.newPage({
      viewport: { width: 960, height: 720 },
      deviceScaleFactor,
    })
    const densityErrors = []
    densityPage.on('pageerror', (error) => densityErrors.push(error.message))
    await densityPage.goto(origin, { waitUntil: 'networkidle' })
    await densityPage.waitForFunction(() => window.__markupLayoutReady === true)
    await densityPage.getByRole('tab', { name: /^方框/ }).click()
    await densityPage.locator('[data-box-style-id="glass"]').click()
    await densityPage.waitForFunction(
      () => document.documentElement.dataset.boxStyle === 'glass',
    )
    const densityQuizEdges = await densityPage
      .locator('[data-quiz-theme-fixture]')
      .evaluateAll((cards) =>
        cards.map((card) => {
          const style = getComputedStyle(card)
          return {
            outline: style.outlineStyle,
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            backdrop: style.backdropFilter,
            pseudoContent: getComputedStyle(card, '::before').content,
          }
        }),
      )
    densityQuizEdges.forEach((edge) => {
      assert.equal(edge.outline, 'none', `DPR ${deviceScaleFactor} quiz edge must not duplicate its border`)
      assert.deepEqual(
        edge.borderWidths,
        ['1px', '1px', '1px', '1px'],
        `DPR ${deviceScaleFactor} quiz edge must be one continuous box-model border`,
      )
      assert.equal(edge.backdrop, 'none', `DPR ${deviceScaleFactor} quiz edge must not resample the backdrop`)
      assert.equal(edge.pseudoContent, 'none', `DPR ${deviceScaleFactor} quiz edge must not add a masked rim`)
    })
    await assertFullscreenImageViewer(
      densityPage,
      `liquid-glass DPR ${deviceScaleFactor}`,
    )
    assert.deepEqual(
      densityErrors,
      [],
      `DPR ${deviceScaleFactor} browser page errors: ${densityErrors.join('; ')}`,
    )
    await densityPage.close()
  }

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`)
} finally {
  await browser.close()
  await vite.close()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

console.log(
  'Record markup browser layout checks passed at 1280, 768, 390 and 320 CSS pixels plus 1.25x and 2x DPR.',
)
