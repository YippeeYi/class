import assert from 'node:assert/strict'
import { loadTypescriptModule, readFrontend } from './test-react-helpers.mjs'

const markup = await loadTypescriptModule('src/lib/markup.ts')
const component = await readFrontend('src/components/archive/markup-content.tsx')
const valid = markup.extractMarkupReferences('查看 [[illu:photo.webp|这张图片]]。')
const invalid = markup.extractMarkupReferences('拒绝 [[illu:../secret.png|越界图片]]。')
assert.deepEqual(valid.illustrationPaths, ['data/attachments/photo.webp'])
assert.deepEqual(invalid.illustrationPaths, [])
assert.match(component, /IllustrationReference/, 'illustrations need an isolated interactive component')
assert.match(component, /ImageViewer/, 'illustrations must be opened with the shared image viewer')
assert.match(component, /previewOpen \? path : ''/, 'illustration previews must load only after interaction')
assert.doesNotMatch(component, /<img[^>]+data-secure-src/, 'signed paths must not be persisted in markup')
console.log('React illustration checks passed.')
