import assert from 'node:assert/strict'
import { loadTypescriptModule, readFrontend } from './test-react-helpers.mjs'

const markup = await loadTypescriptModule('src/lib/markup.ts')
const markupContent = await readFrontend('src/components/archive/markup-content.tsx')
const styles = await readFrontend('src/styles/tailwind.css')
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
const normalizedMinimumTable = markup.parseMarkup('[[table:0x0|保留内容]]')[0]
assert.equal(normalizedMinimumTable.type, 'table')
assert.equal(normalizedMinimumTable.rows.length, 1)
assert.equal(normalizedMinimumTable.rows[0].length, 1)
const extremeTable = markup.parseMarkup(
  '[[table:2x6|超长中文内容需要在窄屏内自然换行并保持完整|SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS|1234567890123456789012345678901234567890|https://example.invalid/a/very/long/path?with=query|[[red:混合]][[frac:长分子文本|denominator-without-breaks]]|短|甲|B|3|[[under:嵌套标记]]|普通内容|末列]]',
)[0]
assert.equal(extremeTable.type, 'table')
assert.equal(extremeTable.rows.length, 2)
assert.equal(extremeTable.rows[0].length, 6)
assert.equal(extremeTable.rows[0][4][0].type, 'style')
assert.equal(markup.parseMarkup('[[frac:分子|分母]]')[0].kind, 'frac')
assert.equal(markup.parseMarkup('[[arrow:上方|下方]]')[0].kind, 'arrow')
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
  '[[person:p1|乙]]和普通文字乙以及[[person:p1|乙]][[person:p1|小乙]][[person:p2|乙]]',
  { kind: 'person', id: 'p1', label: '乙' },
)
const quizVisibleText = (nodes) =>
  nodes
    .map((node) => {
      if (node.type === 'text') return node.value
      if (node.type === 'blank') return '＿'
      if (node.type === 'style') return quizVisibleText(node.children)
      if (node.type === 'stack') return `${quizVisibleText(node.top)}${quizVisibleText(node.bottom)}`
      return node.rows.flat().map(quizVisibleText).join('')
    })
    .join('')
const blankAnswers = (nodes) =>
  nodes.flatMap((node) => {
    if (node.type === 'blank') return [node.answer]
    if (node.type === 'style') return blankAnswers(node.children)
    if (node.type === 'stack') return [...blankAnswers(node.top), ...blankAnswers(node.bottom)]
    if (node.type === 'table') return node.rows.flat().flatMap(blankAnswers)
    return []
  })
assert.deepEqual(blankAnswers(redactedIdentityTree), ['乙', '乙'])
assert.equal(quizVisibleText(redactedIdentityTree), '＿和普通文字乙以及＿小乙乙')
assert.doesNotMatch(JSON.stringify(redactedIdentityTree), /p1|p2/)
const redactedQuoteTree = markup.parseQuizMarkup(
  '[[quote:q1|[[red:名言，甲。]]]]与普通文字名言，甲。；[[quote:q1|名言，甲。]][[quote:q2|名言，甲。]]',
  { kind: 'quote', id: 'q1', label: '名言，甲。' },
)
assert.deepEqual(blankAnswers(redactedQuoteTree), ['名言，甲。', '名言，甲。'])
assert.equal(quizVisibleText(redactedQuoteTree), '＿与普通文字名言，甲。；＿名言，甲。')
assert.doesNotMatch(JSON.stringify(redactedQuoteTree), /q1|q2/)
const positionalIdentityTree = markup.parseQuizMarkup(
  '[[person:p1|乙]]，句中[[under:[[person:p1|乙]]]]。\n句尾[[person:p1|乙]]',
  { kind: 'person', id: 'p1', label: '乙' },
)
assert.deepEqual(blankAnswers(positionalIdentityTree), ['乙', '乙', '乙'])
assert.equal(quizVisibleText(positionalIdentityTree), '＿，句中＿。\n句尾＿')
const tabularIdentityTree = markup.parseQuizMarkup(
  '[[table:2x2|[[person:p1|乙]]|普通文字乙|[[person:p1|小乙]]|[[person:p2|乙]]]]',
  { kind: 'person', id: 'p1', label: '乙' },
)
assert.deepEqual(blankAnswers(tabularIdentityTree), ['乙'])
assert.equal(quizVisibleText(tabularIdentityTree), '＿普通文字乙小乙乙')
const adjacentIdentityTree = markup.parseQuizMarkup(
  '相邻：[[person:p1|乙]][[person:p1|乙]]。',
  { kind: 'person', id: 'p1', label: '乙' },
)
assert.deepEqual(blankAnswers(adjacentIdentityTree), ['乙', '乙'])
assert.equal(quizVisibleText(adjacentIdentityTree), '相邻：＿＿。')
assert.match(markupContent, /<Table\b/, 'markup tables must use the shadcn Table component')
assert.match(markupContent, /export function QuizMarkupContent/, 'quiz must reuse the shared AST renderer')
assert.doesNotMatch(markupContent, /\.split\(/, 'quiz blanks must never use global display-text replacement')
assert.match(markupContent, /node\.type === 'blank'/, 'quiz blanks must render from entity-aware safe AST nodes')
assert.match(markupContent, /<TableBody>/, 'markup tables must use the shadcn Table composition')
assert.doesNotMatch(markupContent, /<table>/, 'markup rendering must not maintain a parallel native table')
assert.match(markupContent, /record-stack--\$\{node\.kind\}/, 'arrow and fraction rendering must not share an indistinguishable class')
assert.match(markupContent, /record-stack-line/, 'arrow and fraction rendering must include a dedicated measured rule')
assert.doesNotMatch(markupContent, /record-table-min-width/, 'markup tables must never request a width larger than their content lane')
assert.deepEqual(markup.parseMarkup('<script>alert(1)</script>'), [{ type: 'text', value: '<script>alert(1)</script>' }])
const nestedDelete = markup.parseMarkup('[[del:前 [[person:p01|同学乙]] 后]]')
assert.equal(nestedDelete[0].type, 'style')
assert.equal(nestedDelete[0].style, 'del')
assert.ok(
  nestedDelete[0].children.some(
    (node) => node.type === 'reference' && node.kind === 'person' && node.id === 'p01',
  ),
)
const nestedRedaction = markup.parseMarkup(
  '[[hide:前 [[person:p01|同学乙]] [[under:[[quote:q01|嵌套名言]]]] [[anno:注释|说明]] 后]]',
)
assert.equal(nestedRedaction[0].type, 'style')
assert.equal(nestedRedaction[0].style, 'hide')
assert.deepEqual(markup.extractMarkupReferences('[[hide:[[person:p01|同学乙]][[quote:q01|名言]]]]'), {
  participantIds: ['p01'],
  extraAuthorIds: [],
  quoteIds: ['q01'],
  illustrationPaths: [],
  personMarkers: [{ id: 'p01', label: '同学乙' }],
  quoteMarkers: [{ id: 'q01', quote: '名言', label: '名言' }],
})
assert.match(
  markupContent,
  /node\.style === 'hide' \? 'redacted'/,
  'nested redactions must continue through the shared recursive renderer',
)
assert.match(
  styles,
  /\.record-redacted:not\(:hover, :active, :focus-within\) :where\(\*\)[\s\S]*color: transparent;[\s\S]*text-decoration-color: transparent;/,
  'a concealed redaction must suppress every recursively rendered descendant style',
)
assert.doesNotMatch(
  styles,
  /record-redacted[^}]+markup-(?:person|link)/,
  'nested redaction styling must not special-case one marker type',
)
console.log('React record markup parser checks passed.')
