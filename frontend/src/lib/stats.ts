import { countTextCharacters, extractAuthorIds, extractParticipantIds } from '@/lib/markup'
import type { RecordItem } from '@/types/domain'

type PieSectorDatum = {
  id: string
  value: number
}

type Point = {
  x: number
  y: number
}

export type PieSectorPath = {
  id: string
  path: string
}

const MINI_PIE_CENTER = 20
const MINI_PIE_RADIUS = 19

function svgNumber(value: number) {
  return Number(value.toFixed(6))
}

function pieBoundary(fraction: number): Point {
  const angle = fraction * Math.PI * 2 - Math.PI / 2
  return {
    x: svgNumber(MINI_PIE_CENTER + Math.cos(angle) * MINI_PIE_RADIUS),
    y: svgNumber(MINI_PIE_CENTER + Math.sin(angle) * MINI_PIE_RADIUS),
  }
}

/**
 * Builds true, contiguous SVG sectors. Every adjacent slice reuses the exact
 * same boundary coordinate and the final slice closes at one full turn, so
 * floating-point accumulation cannot create a dash gap or overlap.
 */
export function buildPieSectorPaths(data: PieSectorDatum[]): PieSectorPath[] {
  const slices = data.filter((item) => item.value > 0)
  const total = slices.reduce((sum, item) => sum + item.value, 0)
  if (!total) return []
  if (slices.length === 1) {
    const [slice] = slices
    if (!slice) return []
    return [
      {
        id: slice.id,
        path: 'M 20 1 A 19 19 0 1 1 20 39 A 19 19 0 1 1 20 1 Z',
      },
    ]
  }

  const fractions = [0]
  let cumulative = 0
  slices.forEach((item, index) => {
    cumulative += item.value
    fractions.push(index === slices.length - 1 ? 1 : cumulative / total)
  })
  const boundaries = fractions.map(pieBoundary)

  return slices.map((item, index) => {
    const start = boundaries[index]
    const end = boundaries[index + 1]
    const startFraction = fractions[index]
    const endFraction = fractions[index + 1]
    if (!start || !end || startFraction === undefined || endFraction === undefined) {
      return { id: item.id, path: '' }
    }
    const largeArc = endFraction - startFraction > 0.5 ? 1 : 0
    return {
      id: item.id,
      path: `M ${MINI_PIE_CENTER} ${MINI_PIE_CENTER} L ${start.x} ${start.y} A ${MINI_PIE_RADIUS} ${MINI_PIE_RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`,
    }
  })
}

export function buildPeopleStats(records: RecordItem[]) {
  const participation = new Map<string, number>()
  const authored = new Map<string, number>()
  const characters = new Map<string, number>()
  for (const record of records) {
    for (const id of extractParticipantIds(record.content))
      participation.set(id, (participation.get(id) || 0) + 1)
    for (const id of extractAuthorIds(record)) authored.set(id, (authored.get(id) || 0) + 1)
    if (record.author)
      characters.set(
        record.author,
        (characters.get(record.author) || 0) + countTextCharacters(record.content),
      )
  }
  return { participation, authored, characters }
}
