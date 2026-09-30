import { FAIL_LINE, GAME_HEIGHT, GAME_WIDTH, type MergeQbGame } from './game'
import { QB_LEVELS, type QbLevel } from './levels'

export type QbImages = Map<string, HTMLImageElement>

export function drawGame(context: CanvasRenderingContext2D, game: MergeQbGame, images: QbImages) {
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
) {
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  const image = images.get(level.id)
  if (image?.complete && image.naturalWidth > 0) {
    context.drawImage(
      image,
      offsetX - level.visualSize.width / 2,
      offsetY - level.visualSize.height / 2,
      level.visualSize.width,
      level.visualSize.height,
    )
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
