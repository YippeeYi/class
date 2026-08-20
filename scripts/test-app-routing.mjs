import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend, readFrontend } from './test-react-helpers.mjs'

const vite = await createServer({
  configFile: false,
  root: frontend,
  resolve: { alias: { '@': path.join(frontend, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { normalizeAppPathname } = await vite.ssrLoadModule('/src/lib/app-route.ts')
  const { NAVIGATION_PAGE_NAMES, formatDocumentTitle, formatRouteDocumentTitle, pageNameForPath } =
    await vite.ssrLoadModule('/src/lib/page-title.ts')
  assert.equal(normalizeAppPathname('/'), '/')
  assert.equal(normalizeAppPathname('/records'), '/records')
  assert.equal(normalizeAppPathname('/records/'), '/records')
  assert.equal(normalizeAppPathname('/records///'), '/records')
  assert.equal(normalizeAppPathname('/records/unknown'), '/records/unknown')
  const expectedTitles = {
    '/': '编日史 · 导览',
    '/records': '编日史 · 记录',
    '/people': '编日史 · 人物',
    '/person': '编日史 · 人物',
    '/quotes': '编日史 · 名言',
    '/timeline': '编日史 · 统计',
    '/search': '编日史 · 搜索',
    '/quiz': '编日史 · 答题',
    '/materials': '编日史 · 资料',
    '/map': '编日史 · 地图',
    '/backgrounds': '编日史 · 风格',
    '/credits': '编日史 · 致谢',
    '/auth': '编日史 · 验证',
    '/404': '编日史 · 错误',
    '/unknown': '编日史 · 错误',
  }
  assert.equal(formatDocumentTitle('/person', '张三'), '编日史 · 人物 · 张三')
  for (const [route, title] of Object.entries(expectedTitles)) {
    assert.equal(formatRouteDocumentTitle(route), title)
    assert.equal(Array.from(pageNameForPath(route)).length, 2, `${route} must use a two-character page name`)
  }
  assert.deepEqual(
    Object.values(NAVIGATION_PAGE_NAMES),
    ['导览', '记录', '人物', '名言', '统计', '搜索', '答题', '资料', '地图', '风格', '致谢'],
  )
  const app = await readFrontend('src/app.tsx')
  assert.match(app, /<DocumentTitleProvider/, 'the router must own title updates')
  const titleHook = await readFrontend('src/hooks/use-document-title.ts')
  assert.match(
    titleHook,
    /useLayoutEffect\(\(\) => \{[\s\S]*document\.title = formatDocumentTitle\(pathname, personName\)/,
    'route title changes must commit before the next page paint',
  )
  const indexHtml = await readFrontend('index.html')
  assert.match(indexHtml, /<title>编日史 · 导览<\/title>/, 'the no-script default title must follow the same rule')
  const pageFiles = (await readdir(path.join(frontend, 'src/pages'))).filter((file) =>
    file.endsWith('-page.tsx'),
  )
  for (const file of pageFiles) {
    const source = await readFrontend(`src/pages/${file}`)
    assert.doesNotMatch(source, /useDocumentTitle\(/, `${file} must not bypass route-owned titles`)
    assert.doesNotMatch(source, /document\.title\s*=/, `${file} must not hard-code document.title`)
  }
  console.log('React application route checks passed.')
} finally {
  await vite.close()
}
