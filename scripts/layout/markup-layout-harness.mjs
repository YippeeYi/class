export const markupLayoutHarness = String.raw`<!doctype html>
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
      import { SegmentedTabsList } from '/src/components/archive/segmented-tabs.tsx'
      import { SelectionMotionLayer, useSelectionMotion } from '/src/components/archive/selection-motion.tsx'
      import { TooltipProvider } from '/src/components/ui/tooltip.tsx'
      import { DailyDistributionCell } from '/src/features/timeline/daily-distribution.tsx'
      import { BackgroundsPage } from '/src/pages/backgrounds-page.tsx'
      import { HomePage } from '/src/pages/home-page.tsx'
      import { PeoplePage } from '/src/pages/people-page.tsx'
      import { PersonPage } from '/src/pages/person-page.tsx'
      import { SecretImage } from '/src/pages/quiz-page.tsx'
      import { RecordsPage } from '/src/pages/records-page.tsx'
      import { BackgroundRoot } from '/src/components/layout/background-root.tsx'
      import { Badge } from '/src/components/ui/badge.tsx'
      import { Button } from '/src/components/ui/button.tsx'
      import { Input } from '/src/components/ui/input.tsx'
      import { ScrollArea } from '/src/components/ui/scroll-area.tsx'
      import { Sidebar, SidebarContent, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger } from '/src/components/ui/sidebar.tsx'
      import { Tabs } from '/src/components/ui/tabs.tsx'
      import { ArchiveProvider } from '/src/features/archive/archive-context.tsx'
      import { DocumentTitleProvider } from '/src/hooks/use-document-title.ts'
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
        { id: 'p1', name: '人物一', role: 'student', aliases: [], avatarUrl: '' },
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

      function PrivateImageViewerFixture() {
        const preview = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22480%22 height=%22320%22 viewBox=%220 0 480 320%22%3E%3Crect width=%22480%22 height=%22320%22 fill=%22%235a6575%22/%3E%3C/svg%3E'
        return e('section', {
          'data-case': 'private-image-viewer',
          style: { width: '68rem', maxWidth: '100%', margin: '24px auto', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
        }, e(ImageViewer, {
          path: 'fixtures/progressive-original.svg',
          alt: '按需高清测试图片',
          initialUrl: preview,
          initialDimensions: { width: 480, height: 320 },
          trigger: e(Button, { type: 'button', variant: 'ghost', className: 'h-auto p-0', 'aria-label': '打开按需高清测试图片' },
            e('img', { src: preview, alt: '按需图片压缩预览', width: 480, height: 320, style: { pointerEvents: 'none' } }),
          ),
        }))
      }

      function CancelledImageViewerFixture() {
        const preview = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22 viewBox=%220 0 400 300%22%3E%3Crect width=%22400%22 height=%22300%22 fill=%22%236d6175%22/%3E%3C/svg%3E'
        return e('section', {
          'data-case': 'cancelled-image-viewer',
          style: { width: '68rem', maxWidth: '100%', margin: '24px auto', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
        }, e(ImageViewer, {
          path: 'fixtures/progressive-cancel.svg',
          alt: '快速关闭测试图片',
          initialUrl: preview,
          initialDimensions: { width: 400, height: 300 },
          trigger: e(Button, { type: 'button', variant: 'outline' }, '打开快速关闭测试图片'),
        }))
      }

      function SecretImageLayoutFixture() {
        return e('section', {
          'data-secret-image-layout-fixture': '',
          style: { display: 'grid', width: '68rem', maxWidth: '100%', gap: '20px', margin: '24px auto' },
        },
          e('article', { 'data-secret-image-case': 'wide', style: { width: '100%', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' } },
            e(SecretImage, { path: 'fixtures/quiz-wide.svg' }),
          ),
          e('article', { 'data-secret-image-case': 'tall', style: { width: '100%', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' } },
            e(SecretImage, { path: 'fixtures/quiz-tall.svg' }),
          ),
        )
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

      function SidebarFixtureNavigation() {
        const [active, setActive] = React.useState(0)
        const labels = ['侧栏项目一', '侧栏项目二', '侧栏项目三']
        const motion = useSelectionMotion(active, labels.length, {
          targetSelector: ':scope > [data-slot="sidebar-menu-item"] > [data-slot="sidebar-menu-button"]',
        })
        return e(SidebarMenu, { ref: motion.ref, className: 'app-sidebar-navigation' },
          e(SelectionMotionLayer, { listItem: true }),
          labels.map((label, index) => e(SidebarMenuItem, { key: label },
            e(SidebarMenuButton, {
              isActive: active === index,
              className: 'app-sidebar-navigation-item',
              onClick: () => setActive(index),
            }, e('span', null, String(index + 1)), e('span', null, label)),
          )),
        )
      }

      function SidebarFixture() {
        return e('section', { 'data-sidebar-fixture': '', hidden: true, style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } },
          e(SidebarProvider, { defaultOpen: true, className: 'relative overflow-hidden rounded-xl border', style: { minHeight: '18rem' } },
            e(Sidebar, { collapsible: 'icon', className: 'app-sidebar !absolute !inset-y-0 !h-full' },
              e(SidebarContent, null, e(SidebarFixtureNavigation)),
              e(SidebarRail, { 'aria-label': '侧栏边缘折叠测试' }),
            ),
            e(SidebarInset, { className: 'app-main-surface min-h-[18rem]' },
              e('header', { className: 'flex h-14 items-center gap-3 border-b px-4' },
                e(SidebarTrigger, { 'aria-label': '侧栏折叠测试' }),
                e('strong', null, 'shadcn Sidebar 折叠回归'),
              ),
              e('p', { className: 'p-4 text-sm text-muted-foreground' }, '验证官方 icon collapse、宽度变化与菜单选中状态。'),
            ),
          ),
        )
      }

      const segmentedMotionItems = [
        { value: 'first', label: '第一个模式' },
        { value: 'second', label: '第二个模式' },
      ]

      function SegmentedMotionFixture() {
        const [value, setValue] = React.useState('first')
        return e('section', { 'data-segmented-motion-fixture': '', style: { width: '24rem', maxWidth: '100%', margin: '24px auto' } },
          e(Tabs, { value, onValueChange: setValue },
            e(SegmentedTabsList, { value, items: segmentedMotionItems, ariaLabel: '分段切换动画测试' }),
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

      function TitleBoundary({ children }) {
        const location = useLocation()
        return e(DocumentTitleProvider, {
          pathname: location.pathname,
          locationKey: location.pathname + location.search,
        }, children)
      }

      function RecordsRouteFixture() {
        const location = useLocation()
        if (location.pathname !== '/' && location.pathname !== '/records') return null
        return e('section', { 'data-case': 'records', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(RecordsPage))
      }

      function PersonRouteFixture() {
        const location = useLocation()
        if (location.pathname !== '/person') return null
        return e('section', { 'data-case': 'person', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(PersonPage))
      }

      function App() {
        return e(MemoryRouter, null,
          e(TitleBoundary, null,
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
                e(Case, { id: 'nested-redaction', width: '52rem', content: '黑幕嵌套：[[hide:前 [[person:p01|人物标记]] [[under:[[quote:q01|嵌套名言]]]] 后]]' }),
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
                e(SegmentedMotionFixture),
                e(SidebarFixture),
                e('section', { 'data-case': 'app-surface', className: 'app-main-surface bg-background', style: { width: '68rem', maxWidth: '100%', minHeight: '220px', margin: '24px auto', padding: '20px' } },
                  e('header', { className: 'app-topbar rounded-xl border p-4' }, '全局背景表面'),
                  e('aside', { 'data-slot': 'sidebar-container', className: 'app-sidebar mt-4 w-48' },
                    e('div', { 'data-slot': 'sidebar-inner', className: 'rounded-xl bg-sidebar p-4' }, '侧栏磨砂层'),
                  ),
                  e('div', { 'data-slot': 'card', className: 'mt-4 rounded-xl bg-card p-4' }, '内容卡片'),
                ),
                e(ImageViewerFixture),
                e(PrivateImageViewerFixture),
                e(CancelledImageViewerFixture),
                e(SecretImageLayoutFixture),
                e(ArchiveProvider, null,
                  e('section', { 'data-case': 'guide', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(HomePage)),
                  e('section', { 'data-case': 'people', style: { width: '68rem', maxWidth: '100%', margin: '24px auto' } }, e(PeoplePage)),
                  e(PersonRouteFixture),
                ),
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

