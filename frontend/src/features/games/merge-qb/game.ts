import Matter, { type Body, type IEventCollision, type Engine as MatterEngine } from 'matter-js'

const { Bodies, Body: MatterBody, Composite, Engine, Events, Vertices } = Matter

import { type ColliderShape, type Point, QB_LEVEL_BY_ID, QB_LEVELS, type QbLevel } from './levels'

export const GAME_WIDTH = 360
export const GAME_HEIGHT = 560
export const FAIL_LINE = 92
export const DANGER_DISTANCE = 38
export const DANGER_COUNTDOWN_MS = 3000
const STEP_MS = 1000 / 60
const DROP_DELAY_MS = 480
const MAX_DROP_LEVEL_COUNT = 5

export type DangerState = 'normal' | 'near' | 'countdown' | 'game-over'

export type GameSnapshot = {
  score: number
  current: QbLevel
  next: QbLevel
  gameOver: boolean
  canDrop: boolean
  danger: DangerState
  countdown: number | null
  unlockedCount: number
  maxMergeCount: number
}

export type GamePiece = {
  body: Body
  level: QbLevel
  imageOffset: Point
  inStack: boolean
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

export function makePiece(level: QbLevel, x: number, y: number): GamePiece {
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
    inStack: false,
  }
}

export class MergeQbGame {
  private engine = Engine.create({ enableSleeping: true })
  private floorId = 0
  private pieces = new Map<number, GamePiece>()
  private pendingPairs = new Map<string, [number, number]>()
  private score = 0
  private unlockedCount = 1
  private maxMergeCount = 0
  private current: QbLevel
  private next: QbLevel
  private danger: DangerState = 'normal'
  private dangerStartedAt: number | null = null
  private countdown = 0
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
    const poolSize = Math.min(this.unlockedCount, MAX_DROP_LEVEL_COUNT)
    const level = QB_LEVELS[Math.min(poolSize - 1, Math.floor(this.random() * poolSize))]
    if (!level) throw new Error('No QB levels configured')
    return level
  }

  private readonly onCollision = (event: IEventCollision<MatterEngine>) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent || pair.bodyA
      const b = pair.bodyB.parent || pair.bodyB
      const first = this.pieces.get(a.id)
      const second = this.pieces.get(b.id)
      if (a.id === this.floorId && second) second.inStack = true
      if (b.id === this.floorId && first) first.inStack = true
      if (first && second && (first.inStack || second.inStack)) {
        first.inStack = true
        second.inStack = true
      }
      if (!first || !second || first.level.id !== second.level.id || !first.level.nextId) continue
      const ids: [number, number] = a.id < b.id ? [a.id, b.id] : [b.id, a.id]
      this.pendingPairs.set(`${ids[0]}:${ids[1]}`, ids)
    }
  }

  private createWorld() {
    this.engine.gravity.y = 1.25
    this.engine.positionIterations = 8
    this.engine.velocityIterations = 8
    const floor = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + 18, GAME_WIDTH + 72, 36, {
      isStatic: true,
    })
    this.floorId = floor.id
    Composite.add(this.engine.world, [
      Bodies.rectangle(-18, GAME_HEIGHT / 2, 36, GAME_HEIGHT * 2, { isStatic: true }),
      Bodies.rectangle(GAME_WIDTH + 18, GAME_HEIGHT / 2, 36, GAME_HEIGHT * 2, {
        isStatic: true,
      }),
      floor,
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
      gameOver: this.danger === 'game-over',
      canDrop:
        this.danger !== 'game-over' &&
        this.engine.timing.timestamp - this.lastDropAt >= DROP_DELAY_MS,
      danger: this.danger,
      countdown: this.danger === 'countdown' ? this.countdown : null,
      unlockedCount: this.unlockedCount,
      maxMergeCount: this.maxMergeCount,
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
    const piece = makePiece(level, this.aimX, y)
    this.pieces.set(piece.body.id, piece)
    Composite.add(this.engine.world, piece.body)
    this.current = this.next
    this.next = this.chooseStarter()
    this.lastDropAt = this.engine.timing.timestamp
    this.aim(this.aimX)
    this.publish()
    return true
  }

  private mergePending() {
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
      const merged = makePiece(next, x, y)
      merged.inStack = a.inStack || b.inStack
      MatterBody.setVelocity(merged.body, velocity)
      Composite.add(this.engine.world, merged.body)
      this.pieces.set(merged.body.id, merged)
      this.score += next.points
      this.unlockedCount = Math.max(this.unlockedCount, QB_LEVELS.indexOf(next) + 1)
      if (!next.nextId) this.maxMergeCount += 1
    }
    this.pendingPairs.clear()
    if (involved.size) this.publish()
  }

  private hasOverLinePiece() {
    for (const piece of this.pieces.values()) {
      if (piece.inStack && piece.body.bounds.min.y < FAIL_LINE) return true
    }
    return false
  }

  private checkDanger(time: number) {
    let highest = Infinity
    for (const piece of this.pieces.values()) {
      if (piece.inStack) highest = Math.min(highest, piece.body.bounds.min.y)
    }

    if (highest >= FAIL_LINE) {
      this.dangerStartedAt = null
      this.countdown = 0
      const next = highest < FAIL_LINE + DANGER_DISTANCE ? 'near' : 'normal'
      if (this.danger !== next) {
        this.danger = next
        this.publish()
      }
      return
    }

    if (this.danger !== 'countdown') {
      this.danger = 'countdown'
      this.dangerStartedAt = time
      this.countdown = Math.ceil(DANGER_COUNTDOWN_MS / 1000)
      this.publish()
      return
    }

    if (time - (this.dangerStartedAt ?? time) >= DANGER_COUNTDOWN_MS) {
      // Check current bodies again after this frame's collisions and merges.
      if (this.hasOverLinePiece()) {
        this.danger = 'game-over'
        this.dangerStartedAt = null
        this.countdown = 0
        this.pendingPairs.clear()
        this.publish()
      } else {
        this.danger = 'normal'
        this.dangerStartedAt = null
        this.countdown = 0
        this.publish()
      }
      return
    }

    const remaining = Math.ceil(
      (DANGER_COUNTDOWN_MS - (time - (this.dangerStartedAt ?? time))) / 1000,
    )
    if (remaining !== this.countdown) {
      this.countdown = remaining
      this.publish()
    }
  }

  step() {
    if (this.danger === 'game-over') return
    Engine.update(this.engine, STEP_MS)
    const time = this.engine.timing.timestamp
    this.mergePending()
    this.checkDanger(time)
    if (this.snapshot.gameOver) return
    if (time - this.lastDropAt >= DROP_DELAY_MS && time - this.lastDropAt < DROP_DELAY_MS + STEP_MS)
      this.publish()
  }

  reset() {
    this.disposeWorld()
    this.engine = Engine.create({ enableSleeping: true })
    this.pieces.clear()
    this.pendingPairs.clear()
    this.score = 0
    this.unlockedCount = 1
    this.maxMergeCount = 0
    this.current = this.chooseStarter()
    this.next = this.chooseStarter()
    this.danger = 'normal'
    this.dangerStartedAt = null
    this.countdown = 0
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
