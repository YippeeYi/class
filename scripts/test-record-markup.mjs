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
const quizTree = markup.parseQuizMarkup(
  '[[center:[[red:居中题干]]]] [[person:p-secret|人物标签]] [[anno:标准答案|注释标签]] [[illu:answer.png|插图标签]] [[hide:黑幕答案]] [[record:answer-record|来源标签]]',
)
const serializedQuizTree = JSON.stringify(quizTree)
assert.equal(quizTree[0].type, 'style')
assert.equal(quizTree[0].style, 'center')
assert.match(serializedQuizTree, /居中题干/)
assert.match(serializedQuizTree, /人物标签/)
assert.match(serializedQuizTree, /注释标签/)
assert.match(serializedQuizTree, /插图标签/)
assert.match(serializedQuizTree, /来源标签/)
assert.match(serializedQuizTree, /隐藏内容已省略/)
assert.doesNotMatch(serializedQuizTree, /p-secret|标准答案|answer\.png|黑幕答案|answer-record/)
const redactedIdentityTree = markup.parseQuizMarkup(
  '[[person:p1|乙]]和[[person:p1|小乙]]一起出现',
  { kind: 'person', id: 'p1', replacement: '乙' },
)
assert.equal(markup.stripMarkup('[[person:p1|乙]]和[[person:p1|小乙]]一起出现'), '乙和小乙一起出现')
assert.doesNotMatch(JSON.stringify(redactedIdentityTree), /小乙|p1/)
assert.equal(JSON.stringify(redactedIdentityTree).match(/乙/g)?.length, 2)
assert.match(markupContent, /<Table>/, 'markup tables must use the shadcn Table component')
assert.match(markupContent, /export function QuizMarkupContent/, 'quiz must reuse the shared AST renderer')
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
