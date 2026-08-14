import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend, readFrontend } from './test-react-helpers.mjs'

const quiz = await readFrontend('src/pages/quiz-page.tsx')
const filterToggle = await readFrontend('src/components/archive/filter-toggle.tsx')
const engine = await readFrontend('src/features/quiz/quiz-engine.ts')
const markupContent = await readFrontend('src/components/archive/markup-content.tsx')
const styles = await readFrontend('src/styles/tailwind.css')
assert.match(engine, /type: 'choice'/, 'choice questions are missing')
assert.match(engine, /type: 'fill'/, 'fill questions are missing')
assert.match(engine, /type: 'judge'/, 'judge questions are missing')
assert.match(engine, /const sources = unique/, 'question sources must be selected uniformly')
assert.match(engine, /const contents = unique/, 'question content must be selected uniformly within a source')
assert.match(engine, /endsWith\('-00'\)/, 'daily routine records must be excluded from quiz generation')
assert.match(engine, /personMarkers/, 'person questions must use the labels present in record markup')
assert.match(engine, /person\.aliases/, 'person aliases must remain available as choice distractors')
assert.match(engine, /dateChoicePool/, 'date questions must preserve the baseline distractor strategy')
assert.match(engine, /姓名拼音首字母/, 'author fill questions must ask for pinyin initials')
assert.match(engine, /judgeTemplate/, 'judge questions must be randomized from the source record')
assert.match(engine, /corrections/, 'judge questions must retain inline correction metadata')
assert.match(engine, /markupBody: record\.content\.trim\(\)/, 'quiz sources must retain shared markup')
assert.match(engine, /originalMarkup/, 'randomized judge questions must preserve safe layout markup')
assert.match(engine, /new Map\(questions\.map/, 'duplicate baseline sources must be collapsed')
assert.doesNotMatch(engine, /blankAnswer/, 'question state must not duplicate the selected display label')
assert.match(quiz, /normalizeText\(stripMarkup\(value\)\)/, 'answer normalization is missing')
assert.match(quiz, /buffer !== 'lamian'/, 'admin-only hidden quiz sequence was not preserved')
assert.match(quiz, /!adminResource\.data/, 'hidden quiz data must be admin-gated')
assert.match(quiz, /loadQuizQuestions\(true\)/, 'secret questions must load only after unlock')
assert.match(quiz, /loadSupplementalRecords/, 'written messages and supplements must share quiz sources')
assert.match(engine, /entryId = recordDisplayNumber\(record\)/, 'quiz source labels must use shared visible record numbers')
assert.doesNotMatch(quiz, /fileName: item\.fileName/, 'quiz source labels must not expose supplement file names')
assert.match(quiz, /secretProgress/, 'secret fill questions must retain correct character positions')
assert.match(quiz, /preloadImageDimensionList\(imagePaths\)/, 'all secret image dimensions must be ready before the pool opens')
assert.match(quiz, /getImageDimensions\(path\)/, 'secret images must reserve their intrinsic ratio')
assert.match(quiz, /aspectRatio:/, 'secret image loading must use a stable frame')
assert.match(quiz, /pendingQuestionTop/, 'question changes must preserve the prompt viewport position')
assert.match(
  quiz,
  /setCurrent\(pickQuestion\(candidates\)\)[\s\S]*setInput\(''\)[\s\S]*setResult\(null\)[\s\S]*setSecretProgress\(\[\]\)/,
  'moving to the next question must clear revealed answers, input, and secret progress together',
)
assert.match(quiz, /Intl\.Segmenter/, 'hidden answers must be split by grapheme clusters')
assert.match(quiz, /inputChars\.every/, 'hidden questions must require one fully correct attempt')
assert.match(quiz, /QuizMarkupContent/, 'question bodies must use the shared safe markup renderer')
assert.match(
  quiz,
  /blankReference=\{question\.blankReference\}/,
  'the selected person or quote entity and exact display label must reach the safe renderer',
)
assert.match(
  markupContent,
  /className="quiz-answer-blank-text" aria-hidden=\{!revealed\}>[\s\S]*\{answer\}/,
  'the same rendered answer glyphs must reserve the blank before and after reveal',
)
assert.doesNotMatch(
  markupContent,
  /Array\.from\(answer\)|quiz-blank-width/,
  'blank width must not be estimated from code-point count',
)
assert.match(
  styles,
  /\.quiz-answer-blank-text[\s\S]*color: transparent[\s\S]*\.quiz-answer-blank\.is-revealed \.quiz-answer-blank-text[\s\S]*color: currentColor/,
  'revealing an answer must only change paint, never layout geometry',
)
assert.match(markupContent, /parseQuizMarkup/, 'quiz prompts must use the shared AST safe mode')
assert.match(quiz, /全选可用/, 'the baseline reset-to-all filter action must be available')
assert.match(quiz, /data-question-type/, 'the question card must expose its current type for theming')
assert.match(styles, /data-question-type="fill"/, 'fill questions need a distinct low-saturation tone')
assert.match(styles, /data-question-type="judge"/, 'judge questions need a distinct low-saturation tone')
assert.match(
  quiz,
  /quiz-question-card min-h-0 flex-1 gap-0 overflow-hidden[^"]*py-0/,
  'the question type surface must meet the card edge without a padding gap',
)
assert.match(quiz, /<ScrollArea key={current.id}/, 'each question must own an internal scroll viewport')
assert.match(quiz, /<CardFooter/, 'answer feedback and next-question controls must remain visible')
assert.doesNotMatch(
  quiz,
  /setSecret\(extra\)\s*setEnabledContent/,
  'unlocking the hidden pool must expose, but not automatically select, the hidden content filter',
)
assert.equal(
  (quiz.match(/<FilterToggle[\s\S]*?pressed=\{enabled(?:Types|Content)\.has\([^)]*\)\}/g) || [])
    .length,
  2,
  'question type and content filters must share the persistent filter toggle contract',
)
assert.match(filterToggle, /<Toggle[\s\S]*variant="outline"/, 'shared filters must compose the shadcn Toggle outline variant')

const vite = await createServer({
  configFile: false,
  root: frontend,
  resolve: { alias: { '@': path.join(frontend, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})
try {
  const { buildQuestions, pickQuestion } = await vite.ssrLoadModule(
    '/src/features/quiz/quiz-engine.ts',
  )
  const { fixedTimelineChartScale } = await vite.ssrLoadModule('/src/lib/timeline.ts')
  const { buildPieSectorPaths } = await vite.ssrLoadModule('/src/lib/stats.ts')
  const runtimeQuestions = [
    { id: 'a-person-choice', sourceId: 'a', content: 'person', type: 'choice' },
    { id: 'a-person-fill', sourceId: 'a', content: 'person', type: 'fill' },
    { id: 'a-quote-fill', sourceId: 'a', content: 'quote', type: 'fill' },
    { id: 'b-person-fill', sourceId: 'b', content: 'person', type: 'fill' },
    { id: 'c-date-choice', sourceId: 'c', content: 'date', type: 'choice' },
  ]
  const sequenceRandom = (values) => {
    let index = 0
    return () => values[index++ % values.length]
  }
  const sourceCounts = { a: 0, b: 0, c: 0 }
  const equalSourceRandom = sequenceRandom([0.01, 0, 0, 0.34, 0, 0, 0.67, 0, 0])
  for (let index = 0; index < 300; index += 1) {
    const picked = pickQuestion(runtimeQuestions, equalSourceRandom)
    sourceCounts[picked.sourceId] += 1
  }
  assert.deepEqual(sourceCounts, { a: 100, b: 100, c: 100 }, 'eligible sources need equal weight')
  assert.equal(
    pickQuestion(runtimeQuestions, () => 0).id,
    pickQuestion(runtimeQuestions, () => 0).id,
    'baseline sampling must not remove the previous question and distort source weights',
  )
  assert.deepEqual(fixedTimelineChartScale([0, 88], 100, 25), {
    max: 100,
    ticks: [0, 25, 50, 75, 100],
  })
  assert.deepEqual(fixedTimelineChartScale([126], 100, 25), {
    max: 150,
    ticks: [0, 25, 50, 75, 100, 125, 150],
  })
  const contiguousSectors = buildPieSectorPaths([
    { id: 'first', value: 1 },
    { id: 'second', value: 2 },
    { id: 'third', value: 3 },
  ])
  assert.equal(contiguousSectors.length, 3)
  const sectorStart = (path) => path.match(/^M 20 20 L (-?[\d.]+) (-?[\d.]+) A/)?.slice(1)
  const sectorEnd = (path) => path.match(/ 1 (-?[\d.]+) (-?[\d.]+) Z$/)?.slice(1)
  assert.deepEqual(
    sectorEnd(contiguousSectors[0].path),
    sectorStart(contiguousSectors[1].path),
    'adjacent daily pie sectors must reuse one exact SVG boundary',
  )
  assert.deepEqual(
    sectorEnd(contiguousSectors[2].path),
    sectorStart(contiguousSectors[0].path),
    'the final daily pie sector must close on the initial SVG boundary',
  )
  assert.match(
    buildPieSectorPaths([{ id: 'only', value: 4 }])[0].path,
    /A 19 19 0 1 1[\s\S]*A 19 19 0 1 1/,
    'single-author daily pies must render as one complete circle',
  )
  const centeredQuestions = buildQuestions(
    [
      {
        id: 'centered-record',
        fileName: 'centered-record.json',
        date: '2025-01-01',
        time: '',
        author: '甲',
        content: '[[center:请判断 [[person:p1|乙]] 的表现]]',
        attachments: [],
      },
    ],
    [
      { id: 'p1', name: '乙' },
      { id: 'p2', name: '丙' },
      { id: 'p3', name: '丁' },
      { id: 'p4', name: '戊' },
    ],
    [],
  )
  const centeredFill = centeredQuestions.find(
    (question) => question.content === 'person' && question.type === 'fill',
  )
  assert.match(
    centeredFill?.markupBody || '',
    /\[\[center:/,
    'center alignment markup must survive question generation',
  )
  assert.deepEqual(centeredFill?.blankReference, {
    kind: 'person',
    id: 'p1',
    label: '乙',
  })
  const originalRandom = Math.random
  Math.random = () => 0
  let identityQuestions
  try {
    identityQuestions = buildQuestions(
      [
        {
          id: 'identity-record',
          fileName: 'identity-record.json',
          date: '2025-01-02',
          time: '',
          author: '甲',
          content:
            '[[person:p1|乙]]和普通文字乙；[[person:p1|乙]][[person:p1|小乙]][[person:p2|乙]]。[[quote:q1|名言，甲。]]与普通文字名言，甲。；[[quote:q1|名言，甲。]][[quote:q2|名言，甲。]]',
          attachments: [],
        },
      ],
      [
        { id: 'p1', name: '乙', aliases: ['小乙'] },
        { id: 'p2', name: '乙' },
        { id: 'p3', name: '丙' },
        { id: 'p4', name: '丁' },
      ],
      [
        { id: 'q1', quote: '名言，甲。', content: '名言，甲。', recordFile: 'identity-record' },
        { id: 'q2', quote: '名言，甲。', content: '名言，甲。', recordFile: 'identity-record' },
        { id: 'q3', quote: '另一名言', content: '另一名言', recordFile: 'other' },
        { id: 'q4', quote: '第三名言', content: '第三名言', recordFile: 'other' },
        { id: 'q5', quote: '第四名言', content: '第四名言', recordFile: 'other' },
      ],
    )
  } finally {
    Math.random = originalRandom
  }
  const identityPersonFill = identityQuestions.find(
    (question) => question.content === 'person' && question.type === 'fill',
  )
  const identityQuoteFill = identityQuestions.find(
    (question) => question.content === 'quote' && question.type === 'fill',
  )
  assert.deepEqual(identityPersonFill?.blankReference, {
    kind: 'person',
    id: 'p1',
    label: '乙',
  })
  assert.deepEqual(identityQuoteFill?.blankReference, {
    kind: 'quote',
    id: 'q1',
    label: '名言，甲。',
  })
} finally {
  await vite.close()
}

console.log('React quiz generation and timeline scale checks passed.')
