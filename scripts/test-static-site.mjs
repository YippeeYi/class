import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { existsFrontend, readFrontend } from './test-react-helpers.mjs'

const packageJson = JSON.parse(await readFrontend('package.json'))
const components = JSON.parse(await readFrontend('components.json'))
const index = await readFrontend('index.html')
const app = await readFrontend('src/app.tsx')
const archiveContext = await readFrontend('src/features/archive/archive-context.tsx')
const markup = await readFrontend('src/lib/markup.ts')
const redirects = await readFrontend('public/_redirects')
const ui = (await readdir(new URL('../frontend/src/components/ui/', import.meta.url))).filter((file) => file.endsWith('.tsx'))

assert.match(packageJson.dependencies.react, /^\^19\./)
assert.match(packageJson.devDependencies.tailwindcss, /^\^4\./)
assert.match(packageJson.devDependencies.typescript, /^\^7\./)
assert.ok(packageJson.dependencies['@base-ui/react'])
assert.equal(components.style, 'base-nova')
assert.ok(ui.length >= 55, `expected all shadcn components, found ${ui.length}`)
assert.match(index, /src\/main\.tsx/)
assert.match(app, /lazy\(\(\) =>\s*import/, 'route-level code splitting is missing')
assert.doesNotMatch(app, /LegacyRedirect|\.html/, 'legacy HTML route compatibility must be absent')
assert.match(archiveContext, /ArchiveProvider/, 'shared archive provider is missing')
assert.match(markup, /export type MarkupNode/, 'record markup must parse to a typed AST')
assert.doesNotMatch(markup, /innerHTML|DOMParser/, 'domain markup parser must not use HTML-string rendering')
for (const route of ['records', 'people', 'person', 'quotes', 'timeline', 'search', 'quiz', 'materials', 'map', 'backgrounds', 'credits']) {
  assert.match(app, new RegExp(`path="${route}"`), `${route} route is missing`)
}
assert.match(redirects, /\/\* \/index\.html 200/, 'SPA fallback is missing')
assert.equal(await existsFrontend('public/style.css'), false, 'legacy CSS runtime should be absent')
assert.equal(await existsFrontend('public/record.html'), false, 'legacy HTML runtime should be absent')
console.log(`React static application checks passed: ${ui.length} CLI-generated shadcn Base UI components.`)
