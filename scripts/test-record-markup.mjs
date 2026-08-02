import assert from 'node:assert/strict'
import { loadTypescriptModule, readFrontend } from './test-react-helpers.mjs'

const markup = await loadTypescriptModule('src/lib/markup.ts')
const markupContent = await readFrontend('src/components/archive/markup-content.tsx')
const source = '甲 [[person:p01|同学乙]] 说 [[quote:q01|[[red:今天真好]]]]，参见 [[record:2025-01-01-01|记录]]。'
const refs = markup.extractMarkupReferences(source)
assert.deepEqual(refs.participantIds, ['p01'])
assert.deepEqual(refs.quoteIds, ['q01'])
assert.equal(refs.quoteMarkers[0].quote, '[[red:今天真好]]')
const tree = markup.parseMarkup(source)
assert.ok(tree.some((node) => node.type === 'reference' && node.kind === 'person' && node.id === 'p01'))
assert.ok(tree.some((node) => node.type === 'reference' && node.kind === 'record' && node.id === '2025-01-01-01'))
assert.equal(markup.stripMarkup('[[under:甲]][[del:乙]]'), '甲乙')
assert.equal(markup.countTextCharacters('甲 A-1'), 3)
assert.equal(markup.recordAnchor({ fileName: 'folder/2025 01.json' }), 'record-folder-2025-01')
assert.equal(markup.parseMarkup('[[table:1x2|甲|乙]]')[0].type, 'table')
assert.match(markupContent, /<Table>/, 'markup tables must use the shadcn Table component')
assert.match(markupContent, /<TableBody>/, 'markup tables must use the shadcn Table composition')
assert.doesNotMatch(markupContent, /<table>/, 'markup rendering must not maintain a parallel native table')
assert.deepEqual(markup.parseMarkup('<script>alert(1)</script>'), [{ type: 'text', value: '<script>alert(1)</script>' }])
const nestedDelete = markup.parseMarkup('[[del:前 [[person:p01|同学乙]] 后]]')
assert.equal(nestedDelete[0].type, 'style')
assert.equal(nestedDelete[0].style, 'del')
assert.ok(
  nestedDelete[0].children.some(
    (node) => node.type === 'reference' && node.kind === 'person' && node.id === 'p01',
  ),
)
console.log('React record markup parser checks passed.')
