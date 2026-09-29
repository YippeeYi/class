import assert from 'node:assert/strict'
import path from 'node:path'
import Matter from 'matter-js'
import { createServer } from 'vite'

import { frontend } from './test-react-helpers.mjs'

const vite = await createServer({
  configFile: false,
  root: frontend,
  resolve: { alias: { '@': path.join(frontend, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { MergeQbGame, makePiece, FAIL_LINE } = await vite.ssrLoadModule('/src/features/games/merge-qb/game.ts')
  const { QB_LEVELS } = await vite.ssrLoadModule('/src/features/games/merge-qb/levels.ts')
  assert.equal(QB_LEVELS.length, 11)
  for (let index = 0; index < QB_LEVELS.length; index++) {
    const level = QB_LEVELS[index]
    assert.equal(level.nextId, QB_LEVELS[index + 1]?.id ?? null)
  }

  const base = QB_LEVELS[0]
  for (const shape of [
    { type: 'circle', x: 0.5, y: 0.5, radius: 0.4 },
    { type: 'rectangle', x: 0.5, y: 0.5, width: 0.7, height: 0.8 },
    { type: 'polygon', vertices: [
      { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 },
    ] },
  ]) {
    const piece = makePiece({ ...base, collider: { shapes: [shape] } }, 180, 200, 0)
    assert.ok(piece.body.bounds.min.x < 180 && piece.body.bounds.max.x > 180)
    assert.ok(piece.body.bounds.min.y < 200 && piece.body.bounds.max.y > 200)
  }
  const compound = makePiece({ ...base, collider: { shapes: [
    { type: 'circle', x: 0.35, y: 0.5, radius: 0.22 },
    { type: 'circle', x: 0.65, y: 0.5, radius: 0.22 },
  ] } }, 180, 200, 0)
  assert.ok(compound.body.parts.length > 1)
  assert.equal(compound.body.position.x + compound.imageOffset.x, 180)
  const offsetCollider = makePiece({ ...base, collider: { shapes: [
    { type: 'rectangle', x: 0.7, y: 0.5, width: 0.3, height: 0.6 },
  ] } }, 180, 200, 0)
  assert.ok(offsetCollider.body.position.x > 180, 'off-centre collision art keeps its own anchor')
  assert.equal(offsetCollider.body.position.x + offsetCollider.imageOffset.x, 180)
  assert.throws(() => makePiece({ ...base, collider: { shapes: [{ type: 'polygon', vertices: [
    { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.5 },
    { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 },
  ] }] } }, 180, 200, 0), /must be convex/)

  const game = new MergeQbGame(() => {}, () => 0)
  for (let drop = 0; drop < 4; drop++) {
    assert.equal(game.drop(), true)
    assert.equal(game.drop(), false, 'drop cooldown prevents duplicate pointer events')
    for (let step = 0; step < 180; step++) game.step()
  }
  assert.equal(game.snapshot.score, QB_LEVELS[1].points * 2 + QB_LEVELS[2].points)
  assert.deepEqual([...game.objects].map((piece) => piece.level.id), ['03'])
  for (let step = 0; step < 180; step++) game.step()
  assert.equal(game.snapshot.score, 12, 'a settled contact never scores twice')
  game.reset()
  assert.equal(game.snapshot.score, 0)
  assert.equal([...game.objects].length, 0)
  assert.equal(game.drop(), true)
  const blockingPiece = [...game.objects][0]
  Matter.Body.setStatic(blockingPiece.body, true)
  Matter.Body.setPosition(blockingPiece.body, { x: 180, y: FAIL_LINE - 10 })
  for (let step = 0; step < 150; step++) game.step()
  assert.equal(game.snapshot.gameOver, false, 'failure waits for a stable overflow')
  for (let step = 0; step < 60; step++) game.step()
  assert.equal(game.snapshot.gameOver, true)
  game.reset()
  assert.equal(game.snapshot.gameOver, false)
  game.dispose()
  console.log('Merge QB physics, shapes, scoring, delayed failure and reset passed.')
} finally {
  await vite.close()
}
