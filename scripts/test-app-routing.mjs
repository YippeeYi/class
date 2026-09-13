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
  const { normalizeAppPathname, protectedPaths } = await vite.ssrLoadModule('/src/lib/app-route.ts')
  const { NAVIGATION_PAGE_NAMES, formatDocumentTitle, formatRouteDocumentTitle, pageNameForPath } =
    await vite.ssrLoadModule('/src/lib/page-title.ts')
  assert.equal(normalizeAppPathname('/'), '/')
  assert.equal(normalizeAppPathname('/records'), '/records')
  assert.equal(normalizeAppPathname('/records/'), '/records')
  assert.equal(normalizeAppPathname('/records///'), '/records')
  assert.equal(normalizeAppPathname('/records/unknown'), '/records/unknown')
  assert.ok(protectedPaths.has('/qb'))
  assert.equal(protectedPaths.has('/qb/unknown'), false)
  assert.equal(pageNameForPath('/qb'), 'QB')
  assert.equal('/qb' in NAVIGATION_PAGE_NAMES, false, 'QB must not become a navigation page')
  const expectedTitles = {
    '/qb': '编日史',
    '/': '编日史',
    '/records': '编日史',
    '/people': '编日史',
    '/person': '编日史',
    '/quotes': '编日史',
    '/timeline': '编日史',
    '/search': '编日史',
    '/quiz': '编日史',
    '/materials': '编日史',
    '/map': '编日史',
    '/backgrounds': '编日史',
    '/credits': '编日史',
    '/auth': '编日史',
    '/404': '编日史',
    '/unknown': '编日史',
  }
  assert.equal(formatDocumentTitle('/person', '张三'), '编日史')
  for (const [route, title] of Object.entries(expectedTitles)) {
    assert.equal(formatRouteDocumentTitle(route), title)
    assert.ok(pageNameForPath(route), `${route} must retain a visible information-architecture name`)
  }
  assert.deepEqual(
    Object.values(NAVIGATION_PAGE_NAMES),
    ['编日史', '记录', '人物', '名言', '统计', '搜索', '答题', '资料', '地图', '风格', '致谢'],
  )
  const app = await readFrontend('src/app.tsx')
  const shell = await readFrontend('src/components/layout/app-shell.tsx')
  const illustrationGate = await readFrontend('src/features/illustrations/route-illustration-gate.tsx')
  assert.match(app, /<DocumentTitleProvider/, 'the router must own title updates')
  assert.match(shell, /<Suspense[\s\S]*<RouteIllustrationGate>[\s\S]*<Outlet/, 'route loading must stay inside the persistent application shell')
  assert.doesNotMatch(shell, /<(?:RouteIllustrationGate|Outlet)[^>]*key=\{location\.pathname\}/, 'route changes must not remount the complete content frame')
  assert.doesNotMatch(shell, /id="page-content"[\s\S]{0,300}animate-in|id="page-content"[\s\S]{0,300}fade-in/, 'the complete page frame must not fade on every route change')
  assert.match(illustrationGate, /settledRoutes[\s\S]*inflightRoutes/, 'illustration gates must deduplicate and remember settled routes')
  assert.match(illustrationGate, /if \(settledRoutes\.has\(routeKey\)\)/, 'cache-hit routes must not re-enter the visible loading gate')
  const titleHook = await readFrontend('src/hooks/use-document-title.ts')
  assert.match(
    titleHook,
    /useLayoutEffect\(\(\) => \{[\s\S]*document\.title = formatDocumentTitle\(pathname, personName\)/,
    'route title changes must commit before the next page paint',
  )
  const indexHtml = await readFrontend('index.html')
  assert.match(indexHtml, /<title>编日史<\/title>/, 'the no-script default title must follow the same rule')
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
