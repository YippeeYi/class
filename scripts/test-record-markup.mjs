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
  '[[table:2x6|超长中文内容需要在窄屏内自然换行并保持完整|SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS|1234567890123456789012345678901234567890|https://example.invalid/a/very/long/path?with=query|[[red:混合]][[latex:\\frac{a}{b}]]|短|甲|B|3|[[under:嵌套标记]]|普通内容|末列]]',
)[0]
assert.equal(extremeTable.type, 'table')
assert.equal(extremeTable.rows.length, 2)
assert.equal(extremeTable.rows[0].length, 6)
assert.equal(extremeTable.rows[0][4][0].type, 'style')
const quizTree = markup.parseQuizMarkup(
  '[[center:[[red:居中题干]]]] [[person:p-secret|人物标签]] [[anno:标准答案|注释标签]] [[illu:answer.png]] [[hide:黑幕答案]] [[record:answer-record|来源标签]]',
)
const serializedQuizTree = JSON.stringify(quizTree)
assert.equal(quizTree[0].type, 'style')
assert.equal(quizTree[0].style, 'center')
assert.match(serializedQuizTree, /居中题干/)
assert.match(serializedQuizTree, /人物标签/)
assert.match(serializedQuizTree, /注释标签/)
assert.doesNotMatch(serializedQuizTree, /插图标签/)
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
      return node.rows.flat().map(quizVisibleText).join('')
    })
    .join('')
const blankAnswers = (nodes) =>
  nodes.flatMap((node) => {
    if (node.type === 'blank') return [node.answer]
    if (node.type === 'style') return blankAnswers(node.children)
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
  materialIds: [],
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

const layout = await loadTypescriptModule('src/lib/markup-layout.ts')
const image = (name) => ({ type: 'media', mediaType: 'image', src: `data/attachments/${name}` })
const video = (name) => ({ type: 'media', mediaType: 'video', src: `data/attachments/${name}` })
assert.deepEqual(markup.parseMarkup('纯文字'), [{ type: 'text', value: '纯文字' }])
assert.deepEqual(markup.parseMarkup('[[illu:a.png]]'), [image('a.png')])
assert.deepEqual(markup.parseMarkup('甲[[illu:a.png]]乙[[illu:b.webp]]'), [
  { type: 'text', value: '甲' }, image('a.png'), { type: 'text', value: '乙' }, image('b.webp'),
])
assert.deepEqual(markup.parseMarkup('[[video:a.mp4]]'), [video('a.mp4')])
assert.deepEqual(markup.parseMarkup('甲[[video:a.mp4]]乙[[video:b.webm]]丙'), [
  { type: 'text', value: '甲' }, video('a.mp4'), { type: 'text', value: '乙' }, video('b.webm'), { type: 'text', value: '丙' },
])
assert.deepEqual(markup.parseMarkup('[[illu:a.png]][[video:a.mp4]][[illu:b.png]]'), [image('a.png'), video('a.mp4'), image('b.png')])
assert.deepEqual(
  markup.extractMarkupMedia('[[anno:注解 [[illu:a.png]]|[[table:1x2|[[video:a.mp4]]|[[illu:a.png]]]]]]'),
  [image('a.png'), video('a.mp4')],
)
assert.deepEqual(markup.parseMarkup('[[illu:a.png|旧字段]]'), [{ type: 'text', value: '[[illu:a.png|旧字段]]' }])
for (const source of ['x^2+y^2', '\\frac{a+b}{c}', '\\sum_{i=1}^{n}i', '\\lim_{x\\to0}\\frac{\\sin x}{x}=1', '\\begin{matrix}a&b\\\\c&d\\end{matrix}', '\\ce{H2O}', '\\ce{2H2 + O2 -> 2H2O}', '\\ce{Fe^{3+}}', '\\ce{CH3COOH <=> CH3COO^- + H^+}', '\\badcommand{']) {
  assert.deepEqual(markup.parseMarkup(`[[latex:${source}]]`), [{ type: 'latex', source }])
}
assert.deepEqual(markup.parseMarkup('甲[[latex:E=mc^2]]乙[[latex:x+y]]'), [
  { type: 'text', value: '甲' }, { type: 'latex', source: 'E=mc^2' }, { type: 'text', value: '乙' }, { type: 'latex', source: 'x+y' },
])
const decoratedFormula = markup.parseMarkup('[[red:[[person:p01|[[under:[[latex:x^{2}+y^{2}]]]]]]]]')
assert.equal(decoratedFormula[0].type, 'style')
assert.equal(decoratedFormula[0].children[0].type, 'reference')
assert.equal(decoratedFormula[0].children[0].children[0].type, 'style')
assert.deepEqual(decoratedFormula[0].children[0].children[0].children[0], { type: 'latex', source: 'x^{2}+y^{2}' })
const latexOuter = markup.parseMarkup('[[latex:[[red:[[person:p01|\\frac{a}{b}]]]]]]')
assert.equal(latexOuter[0].type, 'style')
assert.equal(latexOuter[0].children[0].type, 'reference')
assert.deepEqual(latexOuter[0].children[0].children[0], { type: 'latex', source: '\\frac{a}{b}' })
const matrixSource = '\\begin{matrix}a&b\\\\c&d\\end{matrix}'
assert.deepEqual(markup.parseMarkup(`[[latex:[[red:${matrixSource}]]]]`)[0].children[0], { type: 'latex', source: matrixSource })
assert.deepEqual(markup.extractMarkupReferences('[[latex:[[person:p01|x^2]]]]').participantIds, ['p01'])
assert.deepEqual(markup.parseMarkup('[[record:r1|[[latex:E=mc^2]]]]')[0].children[0], { type: 'latex', source: 'E=mc^2' })
assert.deepEqual(markup.parseMarkup('[[material:m1|[[latex:x_i]]]]')[0].children[0], { type: 'latex', source: 'x_i' })
assert.deepEqual(markup.parseMarkup('[[anno:反应条件|[[latex:\\xrightarrow[\\text{下方}]{\\text{上方}}]]]]')[0].children[0], { type: 'latex', source: '\\xrightarrow[\\text{下方}]{\\text{上方}}' })
const blockFormula = markup.parseMarkup('[[person:p01|[[red:[[latex-block:\\frac{a}{b}]]]]]]')
assert.deepEqual(blockFormula[0].children[0].children[0], { type: 'latex', source: '\\frac{a}{b}', displayMode: 'block' })
const blockLayout = layout.normalizeMarkup(blockFormula)
assert.equal(blockLayout[0].type, 'block')
assert.equal(blockLayout[0].node.type, 'reference')
assert.equal(blockLayout[0].node.children[0].type, 'style')
assert.deepEqual(markup.parseMarkup('[[latex:[[under:x_i]]]]')[0].children[0], { type: 'latex', source: 'x_i' })
assert.equal(markup.parseMarkup('[[latex:]]')[0].type, 'text')
for (const marker of ['[[illu:]]', '[[video:]]', '[[illu:../bad.png]]', '[[video:javascript:bad.mp4]]', '[[video:evil.png]]']) {
  assert.equal(markup.parseMarkup(marker)[0].type, 'text')
}
const mixed = markup.parseMarkup('[[red:甲]][[person:p1|乙]][[under:公式[[latex:\\ce{H2O}]]]][[video:c.mp4]][[table:1x1|丙]]')
assert.deepEqual(mixed.map((node) => node.type), ['style', 'reference', 'style', 'media', 'table'])
const split = layout.normalizeMarkup(markup.parseMarkup('前[[video:a.mp4]]中[[video:b.webm]]后'))
assert.deepEqual(split.map((part) => part.type), ['inline', 'block', 'inline', 'block', 'inline'])
assert.deepEqual(split.filter((part) => part.type === 'block').map((part) => part.node.mediaType), ['video', 'video'])
assert.deepEqual(layout.normalizeMarkup(markup.parseMarkup('[[red:前[[video:a.mp4]]后]]')).map((part) => part.type), ['inline', 'block', 'inline'])
assert.doesNotMatch(JSON.stringify(markup.parseQuizMarkup('[[video:a.mp4]][[illu:a.png]][[latex:x]]')), /a\\.mp4|a\\.png|x/)
console.log('Media, LaTeX and block layout AST checks passed.')
const serializedFormula = JSON.parse('{"content":"[[latex:\\\\frac{a+b}{c}]]"}').content
assert.deepEqual(markup.parseMarkup(serializedFormula), [{ type: 'latex', source: '\\frac{a+b}{c}' }])
assert.deepEqual(markup.parseMarkup('[[latex:a]]b]]'), [{ type: 'latex', source: 'a' }, { type: 'text', value: 'b]]' }])
const katex = (await import('katex')).default
await import('katex/contrib/mhchem')
assert.match(katex.renderToString('\\ce{2H2 + O2 -> 2H2O}', { throwOnError: true, trust: false }), /katex/)
for (const source of [
  '\\xrightarrow[\\text{催化剂}]{\\text{加热}}',
  '\\ce{A ->[\\text{加热}][\\text{催化剂}] B}',
  '\\ce{A <=>[\\text{加热}][\\text{催化剂}] B}',
]) {
  const html = katex.renderToString(source, { throwOnError: true, trust: false, strict: 'error' })
  assert.match(html, /加热/u)
  assert.match(html, /催化剂/u)
}
assert.doesNotMatch(katex.renderToString('\\href{javascript:alert(1)}{x}', { throwOnError: true, trust: false }), /href="javascript:/)
assert.throws(() => katex.renderToString('\\notARealCommand{', { throwOnError: true, trust: false }))
