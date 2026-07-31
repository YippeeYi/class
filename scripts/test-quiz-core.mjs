import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const quiz = await readFrontend('src/pages/quiz-page.tsx')
const engine = await readFrontend('src/features/quiz/quiz-engine.ts')
assert.match(engine, /type: 'choice'/, 'choice questions are missing')
assert.match(engine, /type: index % 4 === 0 \? 'fill'/, 'fill questions are missing')
assert.match(engine, /type: index % 5 === 0 \? 'judge'/, 'judge questions are missing')
assert.match(quiz, /normalizeText\(stripMarkup\(value\)\)/, 'answer normalization is missing')
assert.match(quiz, /buffer !== 'lamian'/, 'admin-only hidden quiz sequence was not preserved')
assert.match(quiz, /!adminResource\.data/, 'hidden quiz data must be admin-gated')
assert.match(quiz, /loadQuizQuestions\(true\)/, 'secret questions must load only after unlock')
console.log('React quiz generation checks passed.')
