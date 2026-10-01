import type { GameSnapshot } from './game'

const SHARE_WIDTH = 1080
const SHARE_HEIGHT = 1900
const ARENA_MARGIN = 60
const ARENA_WIDTH = SHARE_WIDTH - ARENA_MARGIN * 2
const ARENA_HEIGHT = (ARENA_WIDTH * 14) / 9

export async function createShareImage(
  frozenArena: HTMLCanvasElement,
  snapshot: GameSnapshot,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_WIDTH
  canvas.height = SHARE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('分享图片暂时无法生成')

  const styles = getComputedStyle(document.documentElement)
  const background = styles.getPropertyValue('--background').trim() || '#faf7f2'
  const foreground = styles.getPropertyValue('--foreground').trim() || '#302a26'
  const muted = styles.getPropertyValue('--muted-foreground').trim() || '#786d63'
  const border = styles.getPropertyValue('--border').trim() || '#ddcec1'
  const fontFamily = getComputedStyle(document.body).fontFamily
  context.fillStyle = background
  context.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT)
  context.save()
  context.beginPath()
  context.roundRect(ARENA_MARGIN, ARENA_MARGIN, ARENA_WIDTH, ARENA_HEIGHT, 22)
  context.clip()
  context.drawImage(frozenArena, ARENA_MARGIN, ARENA_MARGIN, ARENA_WIDTH, ARENA_HEIGHT)
  context.restore()
  context.strokeStyle = border
  context.lineWidth = 2
  context.strokeRect(ARENA_MARGIN, ARENA_MARGIN, ARENA_WIDTH, ARENA_HEIGHT)

  const infoTop = ARENA_MARGIN + ARENA_HEIGHT + 56
  const highestName = snapshot.highestMergedLevel?.name ?? '尚未合成'
  context.fillStyle = foreground
  context.font = `600 54px ${fontFamily}`
  context.fillText('合成大QB', ARENA_MARGIN, infoTop)
  context.font = `600 68px ${fontFamily}`
  context.fillText(`${snapshot.score} 分`, ARENA_MARGIN, infoTop + 82)
  context.font = `500 32px ${fontFamily}`
  context.fillText(`最高合成：${highestName}`, ARENA_MARGIN, infoTop + 140)
  context.fillStyle = muted
  context.font = `28px ${fontFamily}`
  const caption = snapshot.highestMergedLevel
    ? `本局获得 ${snapshot.score} 分，最高合成 ${highestName}。`
    : `本局获得 ${snapshot.score} 分，还没有合成新 QB。`
  context.fillText(caption, ARENA_MARGIN, infoTop + 195, ARENA_WIDTH)

  return await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('分享图片暂时无法生成'))
      }, 'image/png')
    } catch {
      reject(new Error('分享图片暂时无法生成'))
    }
  })
}
