import assert from 'node:assert/strict'
import { loadTypescriptModule } from './test-react-helpers.mjs'

const { clampScrollTop, targetScrollTop } = await loadTypescriptModule('src/lib/viewport-scroll.ts')

const page = { viewportHeight: 800, documentHeight: 4000 }
assert.equal(clampScrollTop(-120, page), 0, 'top restoration must not escape the document')
assert.equal(clampScrollTop(9999, page), 3200, 'bottom restoration must stop at the real maximum')
assert.equal(clampScrollTop(Number.NaN, page), 0, 'invalid stored scroll positions must be safe')

const target = {
  ...page,
  scrollY: 0,
  targetHeight: 240,
  topInset: 80,
  bottomInset: 24,
}
assert.equal(
  targetScrollTop({ ...target, targetTop: 48 }),
  0,
  'a target already near the top must not create negative scrolling',
)
assert.equal(
  targetScrollTop({ ...target, targetTop: 1700 }),
  1474.08,
  'a middle target should retain comfortable context below the sticky header',
)
assert.equal(
  targetScrollTop({ ...target, targetTop: 3850 }),
  3200,
  'a target near the bottom must clamp to the real maximum instead of forcing centre',
)
assert.equal(
  targetScrollTop({ ...target, targetTop: 3990, targetHeight: 10 }),
  3200,
  'the final record must never pull the document beyond its last scroll position',
)
assert.equal(
  targetScrollTop({ ...target, targetTop: 1400, targetHeight: 900 }),
  1320,
  'a record taller than the viewport must align below the sticky header',
)

console.log('Record target scroll boundary checks passed.')
