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
  const { MergeQbGame, makePiece, FAIL_LINE, DANGER_DISTANCE, DANGER_GRACE_MS } = await vite.ssrLoadModule('/src/features/games/merge-qb/game.ts')
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
    const piece = makePiece({ ...base, collider: { shapes: [shape] } }, 180, 200)
    assert.ok(piece.body.bounds.min.x < 180 && piece.body.bounds.max.x > 180)
    assert.ok(piece.body.bounds.min.y < 200 && piece.body.bounds.max.y > 200)
  }
  const compound = makePiece({ ...base, collider: { shapes: [
    { type: 'circle', x: 0.35, y: 0.5, radius: 0.22 },
    { type: 'circle', x: 0.65, y: 0.5, radius: 0.22 },
  ] } }, 180, 200)
  assert.ok(compound.body.parts.length > 1)
  assert.equal(compound.body.position.x + compound.imageOffset.x, 180)
  const offsetCollider = makePiece({ ...base, collider: { shapes: [
    { type: 'rectangle', x: 0.7, y: 0.5, width: 0.3, height: 0.6 },
  ] } }, 180, 200)
  assert.ok(offsetCollider.body.position.x > 180, 'off-centre collision art keeps its own anchor')
  assert.equal(offsetCollider.body.position.x + offsetCollider.imageOffset.x, 180)
  assert.throws(() => makePiece({ ...base, collider: { shapes: [{ type: 'polygon', vertices: [
    { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.5 },
    { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 },
  ] }] } }, 180, 200), /must be convex/)

  const snapshots = []
  const game = new MergeQbGame((snapshot) => snapshots.push(snapshot), () => 0)
  assert.equal(game.snapshot.unlockedCount, 1)
  assert.equal(game.snapshot.current.id, QB_LEVELS[0].id)
  assert.equal(game.snapshot.next.id, QB_LEVELS[0].id)
  for (let drop = 0; drop < 4; drop++) {
    assert.equal(game.drop(), true)
    assert.equal(game.drop(), false, 'drop cooldown prevents duplicate pointer events')
    for (let step = 0; step < 180; step++) game.step()
  }
  assert.equal(game.snapshot.score, QB_LEVELS[1].points * 2 + QB_LEVELS[2].points)
  assert.equal(game.snapshot.unlockedCount, 3, 'successful merges unlock levels two and three')
  assert.deepEqual([...game.objects].map((piece) => piece.level.id), ['03'])
  for (let step = 0; step < 180; step++) game.step()
  assert.equal(game.snapshot.score, 12, 'a settled contact never scores twice')
  game.reset()
  assert.equal(game.snapshot.score, 0)
  assert.equal(game.snapshot.unlockedCount, 1)
  assert.equal(game.snapshot.maxMergeCount, 0)
  assert.equal([...game.objects].length, 0)
  for (let step = 0; step < 20; step++) game.step()
  assert.equal(game.snapshot.danger, 'normal', 'the aim preview does not trigger danger')
  assert.equal(game.drop(), true)
  const first = [...game.objects][0]
  const setTop = (piece, top) => Matter.Body.setPosition(piece.body, {
    x: piece.body.position.x,
    y: piece.body.position.y + top - piece.body.bounds.min.y,
  })
  assert.equal(first.inStack, false, 'newly released pieces are not yet part of the stack')
  for (let step = 0; step < 15; step++) game.step()
  assert.equal(first.inStack, false, 'a falling piece does not trigger the stack warning')
  assert.equal(game.snapshot.danger, 'normal')
  for (let step = 0; step < 180 && !first.inStack; step++) game.step()
  assert.equal(first.inStack, true, 'floor contact enters the stack lifecycle')
  Matter.Body.setStatic(first.body, true)
  setTop(first, FAIL_LINE + DANGER_DISTANCE + 10)
  game.step()
  assert.equal(game.snapshot.danger, 'normal')
  setTop(first, FAIL_LINE + 10)
  game.step()
  assert.equal(game.snapshot.danger, 'near', 'physics bounds trigger the nearby warning')
  setTop(first, FAIL_LINE + DANGER_DISTANCE + 10)
  game.step()
  assert.equal(game.snapshot.danger, 'normal', 'warning clears when the stack becomes safe')
  game.aim(70)
  assert.equal(game.drop(), true)
  const second = [...game.objects].find((piece) => piece !== first)
  assert.ok(second)
  for (let step = 0; step < 180 && !second.inStack; step++) game.step()
  assert.equal(second.inStack, true)
  Matter.Body.setStatic(second.body, true)
  setTop(second, FAIL_LINE + DANGER_DISTANCE + 10)
  game.step()
  setTop(first, FAIL_LINE - 5)
  game.step()
  assert.equal(game.snapshot.danger, 'pending', 'crossing starts a brief observation period')
  assert.equal(game.snapshot.countdown, null, 'the observation period does not show a countdown')
  for (let step = 0; step < Math.floor(DANGER_GRACE_MS / (1000 / 60)) - 2; step++) game.step()
  assert.equal(game.snapshot.countdown, null)
  setTop(first, FAIL_LINE + DANGER_DISTANCE + 10)
  game.step()
  assert.equal(game.snapshot.danger, 'normal', 'returning below the line during the observation period cancels it')
  setTop(first, FAIL_LINE - 5)
  game.step()
  assert.equal(game.snapshot.danger, 'pending', 'a later crossing gets a fresh observation period')
  for (let step = 0; step < Math.ceil(DANGER_GRACE_MS / (1000 / 60)) + 2 && game.snapshot.countdown === null; step++) game.step()
  assert.equal(game.snapshot.countdown, 3, 'a sustained crossing starts a full countdown')
  for (let step = 0; step < 90; step++) game.step()
  assert.equal(game.snapshot.countdown, 2)
  setTop(second, FAIL_LINE - 5)
  game.step()
  const third = makePiece(first.level, first.body.position.x, first.body.position.y)
  third.inStack = true
  Matter.Composite.add(game.engine.world, third.body)
  game.pieces.set(third.body.id, third)
  game.pendingPairs.set(`${first.body.id}:${third.body.id}`, [first.body.id, third.body.id])
  game.step()
  assert.equal(game.pieces.has(first.body.id), false, 'the first crossing piece merged away')
  const merged = [...game.objects].find((piece) => piece !== second)
  assert.equal(merged.level.id, QB_LEVELS[1].id)
  assert.equal(merged.inStack, true, 'the merged piece remains part of the stack')
  Matter.Body.setStatic(merged.body, true)
  setTop(merged, FAIL_LINE + DANGER_DISTANCE + 10)
  game.step()
  assert.equal(game.snapshot.countdown, 2, 'another crossing piece keeps the same countdown')
  for (let step = 0; step < 82; step++) game.step()
  assert.equal(game.snapshot.countdown, 1)
  setTop(second, FAIL_LINE + DANGER_DISTANCE + 10)
  game.step()
  assert.equal(game.snapshot.danger, 'normal', 'all pieces returning to safety cancels countdown')
  assert.equal(game.snapshot.countdown, null)
  setTop(second, FAIL_LINE - 5)
  game.step()
  assert.equal(game.snapshot.danger, 'pending', 'a later crossing starts with the observation period again')
  for (let step = 0; step < Math.ceil(DANGER_GRACE_MS / (1000 / 60)) + 2 && game.snapshot.countdown === null; step++) game.step()
  assert.equal(game.snapshot.countdown, 3, 'a later crossing restarts from three seconds')
  for (let step = 0; step < 181; step++) game.step()
  assert.equal(game.snapshot.gameOver, true)
  assert.equal(game.snapshot.danger, 'game-over')
  assert.equal(game.drop(), false, 'game over blocks further drops')
  const finalScore = game.snapshot.score
  for (let step = 0; step < 120; step++) game.step()
  assert.equal(game.snapshot.score, finalScore, 'the final score stays frozen')
  assert.equal(snapshots.filter((snapshot) => snapshot.gameOver).length, 1, 'game over emits once')
  game.reset()
  assert.equal(game.snapshot.gameOver, false)
  assert.equal(game.snapshot.danger, 'normal')
  assert.equal(game.snapshot.countdown, null)
  game.dispose()

  const selection = new MergeQbGame(() => {}, () => 0.999)
  assert.equal(selection.snapshot.unlockedCount, 1)
  assert.equal(selection.snapshot.current.id, QB_LEVELS[0].id, 'a new game starts with level one')
  assert.equal(selection.snapshot.next.id, QB_LEVELS[0].id)
  for (let index = 0; index < QB_LEVELS.length - 1; index++) {
    const level = QB_LEVELS[index]
    const first = makePiece(level, 140, 300)
    const second = makePiece(level, 180, 300)
    for (const piece of [first, second]) {
      selection.pieces.set(piece.body.id, piece)
      Matter.Composite.add(selection.engine.world, piece.body)
    }
    selection.pendingPairs.set(`${first.body.id}:${second.body.id}`, [first.body.id, second.body.id])
    selection.mergePending()
    assert.equal(selection.snapshot.unlockedCount, index + 2, `merging ${level.id} unlocks only its successor`)
    assert.equal(selection.snapshot.maxMergeCount, index === QB_LEVELS.length - 2 ? 1 : 0)
    const highestDroppable = QB_LEVELS[Math.min(index + 1, 4)]
    assert.equal(selection.chooseStarter().id, highestDroppable.id, 'the drop pool follows unlocks but stops at five')
    selection.lastDropAt = -Infinity
    assert.equal(selection.drop(), true)
    assert.equal(selection.snapshot.next.id, highestDroppable.id, 'the preview uses the same drop pool')
    assert.equal(selection.snapshot.unlockedCount, index + 2, 'dropping does not unlock a level')
  }
  const levelBeforeMaximum = QB_LEVELS.at(-2)
  const firstMaximumPair = makePiece(levelBeforeMaximum, 140, 300)
  const secondMaximumPair = makePiece(levelBeforeMaximum, 180, 300)
  for (const piece of [firstMaximumPair, secondMaximumPair]) {
    selection.pieces.set(piece.body.id, piece)
    Matter.Composite.add(selection.engine.world, piece.body)
  }
  selection.pendingPairs.set(`${firstMaximumPair.body.id}:${secondMaximumPair.body.id}`, [firstMaximumPair.body.id, secondMaximumPair.body.id])
  selection.mergePending()
  assert.equal(selection.snapshot.maxMergeCount, 2, 'each new maximum merge publishes one celebration event')
  selection.mergePending()
  assert.equal(selection.snapshot.maxMergeCount, 2, 'an already handled pair cannot repeat the celebration')
  selection.reset()
  assert.equal(selection.snapshot.unlockedCount, 1)
  assert.equal(selection.snapshot.current.id, QB_LEVELS[0].id)
  assert.equal(selection.snapshot.next.id, QB_LEVELS[0].id)
  assert.equal(selection.snapshot.maxMergeCount, 0)
  selection.dispose()

  const sleepingGame = new MergeQbGame(() => {}, () => 0)
  const unsupported = makePiece(QB_LEVELS[2], 115, 272)
  const merging = [makePiece(base, 140, 300), makePiece(base, 180, 300)]
  for (const piece of [unsupported, ...merging]) {
    sleepingGame.pieces.set(piece.body.id, piece)
    Matter.Composite.add(sleepingGame.engine.world, piece.body)
  }
  Matter.Sleeping.set(unsupported.body, true)
  sleepingGame.pendingPairs.set(`${merging[0].body.id}:${merging[1].body.id}`, [merging[0].body.id, merging[1].body.id])
  sleepingGame.mergePending()
  assert.equal(unsupported.body.isSleeping, false, 'merging wakes sleeping pieces whose support may have disappeared')
  const initialHeight = unsupported.body.position.y
  for (let step = 0; step < 20; step++) sleepingGame.step()
  assert.ok(unsupported.body.position.y > initialHeight + 10, 'a formerly sleeping unsupported piece falls again')
  sleepingGame.dispose()
  console.log('Merge QB physics, scoring, per-game unlocks, capped drops, maximum merge events, danger countdown and reset passed.')
} finally {
  await vite.close()
}
