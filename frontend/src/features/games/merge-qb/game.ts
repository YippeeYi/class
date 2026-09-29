import Matter, { type Body, type IEventCollision, type Engine as MatterEngine } from 'matter-js'

const { Bodies, Body: MatterBody, Composite, Engine, Events, Vertices } = Matter

import { type ColliderShape, type Point, QB_LEVEL_BY_ID, QB_LEVELS, type QbLevel } from './levels'

export const GAME_WIDTH = 360
export const GAME_HEIGHT = 560
export const FAIL_LINE = 92
const STEP_MS = 1000 / 60
const DROP_DELAY_MS = 480
const LOSS_GRACE_MS = 1900
const LOSS_STILL_MS = 1300

export type GameSnapshot = {
  score: number
  current: QbLevel
  next: QbLevel
  gameOver: boolean
  canDrop: boolean
}

export type GamePiece = {
  body: Body
  level: QbLevel
  imageOffset: Point
  placedAt: number
  overLineSince: number | null
}

function relativePoint(point: Point, level: QbLevel): Point {
  return {
    x: (point.x - 0.5) * level.physicsSize.width,
    y: (point.y - 0.5) * level.physicsSize.height,
  }
}

function shapeBody(shape: ColliderShape, level: QbLevel, x: number, y: number): Body {
  const options = { friction: 0.58, frictionStatic: 0.8, restitution: 0.08, frictionAir: 0.002 }
  if (shape.type === 'circle') {
    const offset = relativePoint(shape, level)
    const radius = shape.radius * Math.min(level.physicsSize.width, level.physicsSize.height)
    return Bodies.circle(x + offset.x, y + offset.y, radius, options)
  }
  if (shape.type === 'rectangle') {
    const offset = relativePoint(shape, level)
    return Bodies.rectangle(
      x + offset.x,
      y + offset.y,
      shape.width * level.physicsSize.width,
      shape.height * level.physicsSize.height,
      options,
    )
  }
  if (shape.vertices.length < 3) throw new Error(`Invalid collider for level ${level.id}`)
  const vertices = shape.vertices.map((point) => {
    const offset = relativePoint(point, level)
    return { x: x + offset.x, y: y + offset.y }
  })
  if (!Vertices.isConvex(vertices)) throw new Error(`Collider for level ${level.id} must be convex`)
  // Only convex vertex sets are accepted here; concave art uses several shapes.
  const centre = Vertices.centre(vertices)
  return Bodies.fromVertices(centre.x, centre.y, [vertices], options)
}

export function makePiece(level: QbLevel, x: number, y: number, time: number): GamePiece {
  const shapes = level.collider.shapes
  if (!shapes.length) throw new Error(`Missing collider for level ${level.id}`)
  const parts = shapes.map((shape) => shapeBody(shape, level, x, y))
  const first = parts[0]
  if (!first) throw new Error(`Missing collider for level ${level.id}`)
  const body = parts.length === 1 ? first : MatterBody.create({ parts })
  return {
    body,
    level,
    imageOffset: { x: x - body.position.x, y: y - body.position.y },
    placedAt: time,
    overLineSince: null,
  }
}

export class MergeQbGame {
  private engine = Engine.create({ enableSleeping: true })
  private pieces = new Map<number, GamePiece>()
  private pendingPairs = new Map<string, [number, number]>()
  private score = 0
  private current: QbLevel
  private next: QbLevel
  private gameOver = false
  private lastDropAt = -Infinity
  private aimX = GAME_WIDTH / 2
  private onChange: (snapshot: GameSnapshot) => void
  private readonly random: () => number

  constructor(onChange: (snapshot: GameSnapshot) => void, random = Math.random) {
    this.onChange = onChange
    this.random = random
    this.current = this.chooseStarter()
    this.next = this.chooseStarter()
    this.createWorld()
    this.publish()
  }

  private chooseStarter() {
    const level = QB_LEVELS[Math.min(4, Math.floor(this.random() * 5))]
    if (!level) throw new Error('No QB levels configured')
    return level
  }

  private readonly onCollision = (event: IEventCollision<MatterEngine>) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent || pair.bodyA
      const b = pair.bodyB.parent || pair.bodyB
      const first = this.pieces.get(a.id)
      const second = this.pieces.get(b.id)
      if (!first || !second || first.level.id !== second.level.id || !first.level.nextId) continue
      const ids: [number, number] = a.id < b.id ? [a.id, b.id] : [b.id, a.id]
      this.pendingPairs.set(`${ids[0]}:${ids[1]}`, ids)
    }
  }

  private createWorld() {
    this.engine.gravity.y = 1.25
    this.engine.positionIterations = 8
    this.engine.velocityIterations = 8
    Composite.add(this.engine.world, [
      Bodies.rectangle(-18, GAME_HEIGHT / 2, 36, GAME_HEIGHT * 2, { isStatic: true }),
      Bodies.rectangle(GAME_WIDTH + 18, GAME_HEIGHT / 2, 36, GAME_HEIGHT * 2, {
        isStatic: true,
      }),
      Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + 18, GAME_WIDTH + 72, 36, {
        isStatic: true,
      }),
    ])
    Events.on(this.engine, 'collisionStart', this.onCollision)
    Events.on(this.engine, 'collisionActive', this.onCollision)
  }

  private publish() {
    this.onChange(this.snapshot)
  }

  get snapshot(): GameSnapshot {
    return {
      score: this.score,
      current: this.current,
      next: this.next,
      gameOver: this.gameOver,
      canDrop: !this.gameOver && this.engine.timing.timestamp - this.lastDropAt >= DROP_DELAY_MS,
    }
  }

  get objects() {
    return this.pieces.values()
  }

  get targetX() {
    return this.aimX
  }

  aim(x: number) {
    const half = this.current.physicsSize.width / 2
    this.aimX = Math.max(half, Math.min(GAME_WIDTH - half, x))
  }

  drop() {
    if (!this.snapshot.canDrop) return false
    const level = this.current
    const y = Math.max(38, level.physicsSize.height / 2 + 3)
    const piece = makePiece(level, this.aimX, y, this.engine.timing.timestamp)
    this.pieces.set(piece.body.id, piece)
    Composite.add(this.engine.world, piece.body)
    this.current = this.next
    this.next = this.chooseStarter()
    this.lastDropAt = this.engine.timing.timestamp
    this.aim(this.aimX)
    this.publish()
    return true
  }

  private mergePending(time: number) {
    const involved = new Set<number>()
    for (const [aId, bId] of this.pendingPairs.values()) {
      if (involved.has(aId) || involved.has(bId)) continue
      const a = this.pieces.get(aId)
      const b = this.pieces.get(bId)
      if (!a || !b || a.level.id !== b.level.id || !a.level.nextId) continue
      const next = QB_LEVEL_BY_ID.get(a.level.nextId)
      if (!next) continue
      involved.add(aId)
      involved.add(bId)
      const x = (a.body.position.x + b.body.position.x) / 2
      const y = (a.body.position.y + b.body.position.y) / 2
      const velocity = {
        x: (a.body.velocity.x + b.body.velocity.x) * 0.4,
        y: (a.body.velocity.y + b.body.velocity.y) * 0.4,
      }
      Composite.remove(this.engine.world, [a.body, b.body])
      this.pieces.delete(aId)
      this.pieces.delete(bId)
      const merged = makePiece(next, x, y, time)
      MatterBody.setVelocity(merged.body, velocity)
      Composite.add(this.engine.world, merged.body)
      this.pieces.set(merged.body.id, merged)
      this.score += next.points
    }
    this.pendingPairs.clear()
    if (involved.size) this.publish()
  }

  private checkLoss(time: number) {
    if (this.gameOver) return
    for (const piece of this.pieces.values()) {
      const settled =
        time - piece.placedAt > LOSS_GRACE_MS && MatterBody.getSpeed(piece.body) < 0.65
      if (piece.body.bounds.min.y < FAIL_LINE && settled) {
        piece.overLineSince ??= time
        if (time - piece.overLineSince >= LOSS_STILL_MS) {
          this.gameOver = true
          this.publish()
          return
        }
      } else {
        piece.overLineSince = null
      }
    }
  }

  step() {
    if (this.gameOver) return
    Engine.update(this.engine, STEP_MS)
    const time = this.engine.timing.timestamp
    this.mergePending(time)
    this.checkLoss(time)
    if (time - this.lastDropAt >= DROP_DELAY_MS && time - this.lastDropAt < DROP_DELAY_MS + STEP_MS)
      this.publish()
  }

  reset() {
    this.disposeWorld()
    this.engine = Engine.create({ enableSleeping: true })
    this.pieces.clear()
    this.pendingPairs.clear()
    this.score = 0
    this.current = this.chooseStarter()
    this.next = this.chooseStarter()
    this.gameOver = false
    this.lastDropAt = -Infinity
    this.aimX = GAME_WIDTH / 2
    this.createWorld()
    this.publish()
  }

  private disposeWorld() {
    Events.off(this.engine, 'collisionStart', this.onCollision)
    Events.off(this.engine, 'collisionActive', this.onCollision)
    Composite.clear(this.engine.world, false)
    Engine.clear(this.engine)
  }

  dispose() {
    this.disposeWorld()
    this.pieces.clear()
    this.pendingPairs.clear()
  }
}
