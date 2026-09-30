import { FAIL_LINE, GAME_HEIGHT, GAME_WIDTH, type MergeQbGame } from './game'
import { QB_LEVELS, QB_OUTLINE, type QbLevel } from './levels'

export type QbImages = Map<string, HTMLImageElement>
export type QbSprites = Map<string, { canvas: HTMLCanvasElement; padding: number; factor: number }>

export function drawGame(
  context: CanvasRenderingContext2D,
  game: MergeQbGame,
  images: QbImages,
  sprites: QbSprites,
) {
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

  if (!game.snapshot.gameOver) {
    const level = game.snapshot.current
    context.save()
    context.globalAlpha = game.snapshot.canDrop ? 0.82 : 0.42
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
  } else {
    context.fillStyle = level.color
    context.beginPath()
    context.ellipse(
      offsetX,
      offsetY,
      level.visualSize.width / 2,
      level.visualSize.height / 2,
      0,
      0,
      Math.PI * 2,
    )
    context.fill()
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
  maskContext.fillStyle = QB_OUTLINE.color
  maskContext.fillRect(0, 0, width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width + padding * 2
  canvas.height = height + padding * 2
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  const radius = QB_OUTLINE.widthCssPx * dpr
  for (let index = 0; index < 16; index++) {
    const angle = (index * Math.PI) / 8
    context.drawImage(mask, padding + Math.cos(angle) * radius, padding + Math.sin(angle) * radius)
  }
  context.drawImage(image, padding, padding, width, height)
  return { canvas, padding, factor }
}
