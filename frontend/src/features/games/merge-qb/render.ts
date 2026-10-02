import { FAIL_LINE, GAME_HEIGHT, GAME_WIDTH, type MergeEvent, type MergeQbGame } from './game'
import { levelOutlineBounds, QB_LEVELS, QB_OUTLINE, QB_SHOCKWAVE, type QbLevel } from './levels'

export type QbImages = Map<string, HTMLImageElement>
export type QbSprites = Map<string, { canvas: HTMLCanvasElement; padding: number; factor: number }>

export const QB_OUTLINE_OFFSETS = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI) / 8
  return { x: Math.cos(angle) * QB_OUTLINE.widthCssPx, y: Math.sin(angle) * QB_OUTLINE.widthCssPx }
})

type CelebrationParticle = {
  directionX: number
  directionY: number
  originRadius: number
  speed: number
  size: number
  spin: number
  color: string
}

export type CelebrationEffect = {
  kind: 'confetti' | 'sparkle'
  x: number
  y: number
  radius: number
  startedAt: number
  duration: number
  particles: CelebrationParticle[]
}

const CONFETTI_COLORS = ['#e89a77', '#e6bf6f', '#80bea9', '#a8a0d9']
const SPARKLE_COLORS = ['#efca73', '#fff0b2', '#9ccee0']

function edgeRadius(level: QbLevel, angle: number, fallback: number) {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let radius = 0
  for (const shape of level.collider.shapes) {
    if (shape.type !== 'polygon') continue
    for (let index = 0; index < shape.vertices.length; index++) {
      const first = shape.vertices[index]
      const second = shape.vertices[(index + 1) % shape.vertices.length]
      if (!first || !second) continue
      const ax = (first.x - 0.5) * level.visualSize.width
      const ay = (first.y - 0.5) * level.visualSize.height
      const ex = (second.x - first.x) * level.visualSize.width
      const ey = (second.y - first.y) * level.visualSize.height
      const divisor = dx * ey - dy * ex
      if (Math.abs(divisor) < 1e-6) continue
      const distance = (ax * ey - ay * ex) / divisor
      const alongEdge = (ax * dy - ay * dx) / divisor
      if (distance >= 0 && alongEdge >= 0 && alongEdge <= 1) radius = Math.max(radius, distance)
    }
  }
  return radius || fallback
}

export function createCelebration(
  event: MergeEvent,
  kind: CelebrationEffect['kind'],
  now: number,
  reducedMotion: boolean,
): CelebrationEffect {
  const bounds = levelOutlineBounds(event.level)
  const radiusX = ((bounds.right - bounds.left) * event.level.visualSize.width) / 2
  const radiusY = ((bounds.bottom - bounds.top) * event.level.visualSize.height) / 2
  const radius = Math.max(radiusX, radiusY)
  const colors = kind === 'confetti' ? CONFETTI_COLORS : SPARKLE_COLORS
  const count = reducedMotion ? 5 : kind === 'confetti' ? 18 : 14
  return {
    kind,
    x: event.x,
    y: event.y,
    radius,
    startedAt: now,
    duration: reducedMotion ? 260 : kind === 'confetti' ? 900 : 760,
    particles: Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35
      const ellipseRadius =
        1 /
        Math.sqrt(
          (Math.cos(angle) / Math.max(1, radiusX)) ** 2 +
            (Math.sin(angle) / Math.max(1, radiusY)) ** 2,
        )
      return {
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        originRadius: edgeRadius(event.level, angle, ellipseRadius) + (Math.random() - 0.5) * 4,
        speed: 38 + Math.random() * (kind === 'confetti' ? 55 : 42),
        size: 2.5 + Math.random() * 2.5,
        spin: (Math.random() - 0.5) * Math.PI * 3,
        color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? '#e6bf6f',
      }
    }),
  }
}

export function drawCelebrations(
  context: CanvasRenderingContext2D,
  effects: CelebrationEffect[],
  now: number,
  scale: number,
) {
  for (let index = effects.length - 1; index >= 0; index--) {
    const effect = effects[index]
    if (!effect) continue
    const progress = Math.min(1, (now - effect.startedAt) / effect.duration)
    if (progress >= 1) {
      effects.splice(index, 1)
      continue
    }
    context.save()
    if (effect.kind === 'sparkle') {
      context.strokeStyle = '#efca73'
      context.globalAlpha = 0.3 * (1 - progress)
      context.lineWidth = 1.5 / scale
      context.beginPath()
      context.arc(effect.x, effect.y, effect.radius + progress * 36, 0, Math.PI * 2)
      context.stroke()
    }
    for (const particle of effect.particles) {
      const distance = particle.originRadius + 2 + particle.speed * progress
      const x = effect.x + particle.directionX * distance
      const y = effect.y + particle.directionY * distance + progress * progress * 12
      context.save()
      context.translate(x, y)
      context.rotate(particle.spin * progress)
      context.globalAlpha = (1 - progress) * (effect.kind === 'confetti' ? 0.8 : 0.9)
      if (effect.kind === 'confetti') {
        context.fillStyle = particle.color
        context.fillRect(-particle.size / 2, -particle.size, particle.size, particle.size * 1.7)
      } else {
        context.strokeStyle = particle.color
        context.lineWidth = 1.3 / scale
        context.beginPath()
        context.moveTo(-particle.size, 0)
        context.lineTo(particle.size, 0)
        context.moveTo(0, -particle.size)
        context.lineTo(0, particle.size)
        context.stroke()
      }
      context.restore()
    }
    context.restore()
  }
}

export function drawGame(
  context: CanvasRenderingContext2D,
  game: MergeQbGame,
  images: QbImages,
  sprites: QbSprites,
  scale: number,
) {
  const time = game.time
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

  context.save()
  context.setLineDash([4, 7])
  context.strokeStyle = 'rgba(120, 106, 92, 0.38)'
  context.beginPath()
  context.moveTo(game.targetX, 0)
  context.lineTo(game.targetX, FAIL_LINE)
  context.stroke()
  context.restore()

  for (const piece of game.objects) {
    drawPiece(
      context,
      piece.level,
      piece.body.position.x,
      piece.body.position.y,
      piece.body.angle,
      piece.imageOffset.x,
      piece.imageOffset.y,
      images,
      sprites,
    )
  }

  for (const wave of game.activeShockwaves) {
    const progress = Math.min(1, (time - wave.startedAt) / QB_SHOCKWAVE.durationMs)
    const eased = 1 - (1 - progress) ** 2
    context.save()
    context.globalAlpha = 0.34 * (1 - progress) ** 2
    context.strokeStyle = 'rgb(120 106 92)'
    context.lineWidth = QB_SHOCKWAVE.lineWidthCssPx / scale
    context.beginPath()
    context.arc(
      wave.x,
      wave.y,
      wave.startRadius + (wave.radius - wave.startRadius) * eased,
      0,
      Math.PI * 2,
    )
    context.stroke()
    context.restore()
  }

  if (!game.gameOver) {
    const level = game.currentLevel
    context.save()
    context.globalAlpha = game.canDrop ? 0.82 : 0.42
    drawPiece(
      context,
      level,
      game.targetX,
      Math.max(38, level.physicsSize.height / 2 + 3),
      0,
      0,
      0,
      images,
      sprites,
    )
    context.restore()
  }
}

function drawPiece(
  context: CanvasRenderingContext2D,
  level: QbLevel,
  x: number,
  y: number,
  angle: number,
  offsetX: number,
  offsetY: number,
  images: QbImages,
  sprites: QbSprites,
) {
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  const image = images.get(level.id)
  if (image?.complete && image.naturalWidth > 0) {
    const sprite = sprites.get(level.id)
    if (sprite) {
      context.drawImage(
        sprite.canvas,
        offsetX - level.visualSize.width / 2 - sprite.padding / sprite.factor,
        offsetY - level.visualSize.height / 2 - sprite.padding / sprite.factor,
        sprite.canvas.width / sprite.factor,
        sprite.canvas.height / sprite.factor,
      )
    } else {
      context.drawImage(
        image,
        offsetX - level.visualSize.width / 2,
        offsetY - level.visualSize.height / 2,
        level.visualSize.width,
        level.visualSize.height,
      )
    }
  }
  context.restore()
}

export function createImageMap() {
  const images: QbImages = new Map()
  for (const level of QB_LEVELS) images.set(level.id, new Image())
  return images
}

export function makeOutlinedSprite(
  level: QbLevel,
  image: HTMLImageElement,
  scale: number,
  dpr: number,
  color: string,
) {
  const factor = scale * dpr
  const padding = Math.ceil(QB_OUTLINE.widthCssPx * dpr) + 1
  const width = Math.ceil(level.visualSize.width * factor)
  const height = Math.ceil(level.visualSize.height * factor)
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const maskContext = mask.getContext('2d')
  if (!maskContext) throw new Error('Canvas 2D is unavailable')
  maskContext.drawImage(image, 0, 0, width, height)
  maskContext.globalCompositeOperation = 'source-in'
  maskContext.fillStyle = color
  maskContext.fillRect(0, 0, width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width + padding * 2
  canvas.height = height + padding * 2
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  for (const offset of QB_OUTLINE_OFFSETS) {
    context.drawImage(mask, padding + offset.x * dpr, padding + offset.y * dpr)
  }
  context.drawImage(image, padding, padding, width, height)
  return { canvas, padding, factor }
}
