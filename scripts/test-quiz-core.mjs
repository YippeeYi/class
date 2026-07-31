import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const quiz = await readFrontend('src/pages/quiz-page.tsx')
const engine = await readFrontend('src/features/quiz/quiz-engine.ts')
assert.match(engine, /type: 'choice'/, 'choice questions are missing')
assert.match(engine, /type: 'fill'/, 'fill questions are missing')
assert.match(engine, /type: 'judge'/, 'judge questions are missing')
assert.match(engine, /const sources = unique/, 'question sources must be selected uniformly')
assert.match(engine, /const contents = unique/, 'question content must be selected uniformly within a source')
assert.match(engine, /endsWith\('-00'\)/, 'daily routine records must be excluded from quiz generation')
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
assert.equal(
  (quiz.match(/variant=\{enabled(?:Types|Content)\.has\([^)]*\) \? 'default' : 'outline'\}/g) || []).length,
  2,
  'question type and content filters must share one selected-state color system',
)
console.log('React quiz generation checks passed.')
