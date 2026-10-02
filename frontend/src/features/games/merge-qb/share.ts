import type { GameSnapshot } from './game'
import { QB_LEVELS, type QbLevel } from './levels'

export const SHARE_CAPTION_POOLS = [
  {
    maxLevel: 1,
    captions: [
      'QB 已就位，下一局争取让他们碰个头。',
      '这局先认个脸，合成的事下局再说。',
      '还没凑成一对，QB 先来热个场。',
    ],
  },
  {
    maxLevel: 6,
    captions: [
      '小 QB 碰个头，合成之路开张了。',
      '先合几只小 QB，大的还在后面。',
      '有进展了，下一局再往大了合。',
    ],
  },
  {
    maxLevel: 8,
    captions: [
      'QB 越合越大，空位越来越少。',
      '这一局，QB 已经有点分量了。',
      '从小 QB 一路合上来，逐渐找到感觉。',
    ],
  },
  {
    maxLevel: 10,
    captions: [
      '大 QB 到场，留给下一只的位置不多了。',
      '合到这里，手稳和运气都出了点力。',
      'QB 的排面有了，场地开始紧张了。',
    ],
  },
  {
    maxLevel: 11,
    captions: [
      '离终极大 QB 又近了一步。',
      '这一局的 QB，已经快撑满场面了。',
      '合成到这一级，可以在班里晒一晒了。',
    ],
  },
  {
    maxLevel: 12,
    captions: [
      '终极大 QB 合成！这张图得留个纪念。',
      '十二级大 QB 到场，这局圆满了。',
      '从小 QB 合到终点，终极大 QB 已解锁。',
    ],
  },
] as const

export function selectShareCaption(
  highestMergedLevel: QbLevel | null,
  random = Math.random,
): string {
  const highest = highestMergedLevel
    ? QB_LEVELS.findIndex((level) => level.id === highestMergedLevel.id) + 1
    : 0
  const pool =
    SHARE_CAPTION_POOLS.find((category) => highest <= category.maxLevel) ?? SHARE_CAPTION_POOLS[0]
  return (
    pool.captions[
      Math.min(pool.captions.length - 1, Math.max(0, Math.floor(random() * pool.captions.length)))
    ] ?? pool.captions[0]
  )
}

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
  const caption = selectShareCaption(snapshot.highestMergedLevel)
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
