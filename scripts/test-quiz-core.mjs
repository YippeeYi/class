import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { frontend, readFrontend } from './test-react-helpers.mjs'

const quiz = await readFrontend('src/pages/quiz-page.tsx')
const engine = await readFrontend('src/features/quiz/quiz-engine.ts')
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
assert.match(engine, /new Map\(questions\.map/, 'duplicate baseline sources must be collapsed')
assert.match(quiz, /normalizeText\(stripMarkup\(value\)\)/, 'answer normalization is missing')
assert.match(quiz, /buffer !== 'lamian'/, 'admin-only hidden quiz sequence was not preserved')
assert.match(quiz, /!adminResource\.data/, 'hidden quiz data must be admin-gated')
assert.match(quiz, /loadQuizQuestions\(true\)/, 'secret questions must load only after unlock')
assert.match(quiz, /loadPageMessages/, 'written messages must contribute quiz sources')
assert.match(quiz, /secretProgress/, 'secret fill questions must retain correct character positions')
assert.match(quiz, /preloadImageDimensionList\(imagePaths\)/, 'all secret image dimensions must be ready before the pool opens')
assert.match(quiz, /getImageDimensions\(path\)/, 'secret images must reserve their intrinsic ratio')
assert.match(quiz, /aspectRatio:/, 'secret image loading must use a stable frame')
assert.match(quiz, /pendingQuestionTop/, 'question changes must preserve the prompt viewport position')
assert.match(quiz, /Intl\.Segmenter/, 'hidden answers must be split by grapheme clusters')
assert.match(quiz, /inputChars\.every/, 'hidden questions must require one fully correct attempt')
assert.match(quiz, /BlankQuestionBody/, 'person and quote answers must reveal in place after submission')
assert.match(
  quiz,
  /aria-hidden=\{!revealed\}>\{answer\}/,
  'the hidden answer glyphs must remain mounted so revealing an answer cannot change blank width',
)
assert.match(quiz, /CorrectedQuestionBody/, 'judge corrections must render in the source text')
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
  (quiz.match(/variant=\{enabled(?:Types|Content)\.has\([^)]*\) \? 'default' : 'outline'\}/g) || []).length,
  2,
  'question type and content filters must share one selected-state color system',
)

const vite = await createServer({
  configFile: false,
  root: frontend,
  resolve: { alias: { '@': path.join(frontend, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})
try {
  const { pickQuestion } = await vite.ssrLoadModule('/src/features/quiz/quiz-engine.ts')
  const { fixedTimelineChartScale } = await vite.ssrLoadModule('/src/lib/timeline.ts')
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
} finally {
  await vite.close()
}

console.log('React quiz generation and timeline scale checks passed.')
