import assert from 'node:assert/strict'
import { loadTypescriptModule } from './test-react-helpers.mjs'

const markup = await loadTypescriptModule('src/lib/markup.ts')
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
assert.equal(markup.parseMarkup('[[table:1x2|甲|乙]]')[0].type, 'table')
assert.deepEqual(markup.parseMarkup('<script>alert(1)</script>'), [{ type: 'text', value: '<script>alert(1)</script>' }])
console.log('React record markup parser checks passed.')
